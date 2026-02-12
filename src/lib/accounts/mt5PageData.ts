import { DateTime } from "luxon";
import {
  getMt5AccountById,
  getMt5WeekOpenUtc,
  isMt5WeekOpenUtc,
  listMt5WeekOptions,
  readMt5ClosedNetForWeek,
  readMt5ClosedPositionsByWeek,
  readMt5ClosedSummary,
  readMt5DrawdownRange,
  readMt5EquityCurveByRange,
  readMt5ChangeLog,
} from "@/lib/mt5Store";
import { getConnectedAccount } from "@/lib/connectedAccounts";
import { buildBasketSignals } from "@/lib/basketSignals";
import { readPerformanceSnapshotsByWeek } from "@/lib/performanceSnapshots";
import { signalsFromSnapshots } from "@/lib/plannedTrades";
import { extendToWindow } from "@/lib/accounts/viewUtils";
import { buildWeekOptionsWithCurrentAndNext, resolveRequestedWeek } from "@/lib/accounts/weekOptions";
import type { OpenPositionLike } from "@/lib/accounts/mt5PageViewModel";
import type { LotMapRow } from "@/lib/accounts/mt5ViewHelpers";
import type { Mt5PlanningDiagnostics } from "@/lib/mt5Store";

export type Mt5PageAccount = {
  id: string;
  provider?: string;
  account_id: string;
  label: string;
  broker: string;
  server: string;
  balance: number;
  equity: number;
  positions: OpenPositionLike[];
  currency: string;
  last_sync_utc: string | null;
  trade_mode: string;
  status: string;
  lot_map: LotMapRow[];
  planning_diagnostics?: Mt5PlanningDiagnostics;
  [key: string]: unknown;
};

type Mt5ConnectedAnalysis = {
  balance?: number;
  nav?: number;
  currency?: string;
  positions?: OpenPositionLike[];
};

export async function resolveMt5WeekContext(options: {
  accountId: string;
  requestedWeek: string | null;
  desiredWeeks?: number;
}) {
  const { accountId, requestedWeek, desiredWeeks = 4 } = options;
  const currentWeekOpenUtc = getMt5WeekOpenUtc();
  const currentWeekStart = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  const nextWeekOpenUtc = currentWeekStart.isValid
    ? currentWeekStart.plus({ days: 7 }).toUTC().toISO()
    : null;
  let weekOptions: string[] = [];
  try {
    const recentWeeks = await listMt5WeekOptions(accountId, desiredWeeks);
    weekOptions = buildWeekOptionsWithCurrentAndNext(
      recentWeeks,
      currentWeekOpenUtc,
      nextWeekOpenUtc ?? null,
      desiredWeeks,
    );
  } catch (error) {
    console.error(
      "MT5 week list failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (weekOptions.length === 0) {
    weekOptions = buildWeekOptionsWithCurrentAndNext(
      [],
      currentWeekOpenUtc,
      nextWeekOpenUtc ?? null,
      desiredWeeks,
    );
  }
  const selectedWeek = resolveRequestedWeek(requestedWeek, weekOptions, currentWeekOpenUtc);
  const isSelectedMt5Week = selectedWeek ? isMt5WeekOpenUtc(selectedWeek) : false;
  const statsWeekOpenUtc = isSelectedMt5Week ? selectedWeek : getMt5WeekOpenUtc();

  return {
    currentWeekOpenUtc,
    nextWeekOpenUtc,
    weekOptions,
    selectedWeek,
    isSelectedMt5Week,
    statsWeekOpenUtc,
  };
}

export async function loadMt5PageData(options: {
  accountId: string;
  selectedWeek: string;
  currentWeekOpenUtc: string;
  statsWeekOpenUtc: string;
  isSelectedMt5Week: boolean;
}) {
  const { accountId, selectedWeek, currentWeekOpenUtc, statsWeekOpenUtc, isSelectedMt5Week } = options;
  let account: Mt5PageAccount | null = null;
  let closedPositions: Awaited<ReturnType<typeof readMt5ClosedPositionsByWeek>> = [];
  let changeLog: Awaited<ReturnType<typeof readMt5ChangeLog>> = [];
  let currentWeekNet = { net: 0, trades: 0 };
  let equityCurvePoints: { ts_utc: string; equity_pct: number; lock_pct: number | null }[] = [];
  let basketSignals: Awaited<ReturnType<typeof buildBasketSignals>> | null = null;

  try {
    if (accountId.includes(":")) {
      const connectedAccount = await getConnectedAccount(accountId);
      if (connectedAccount) {
        const analysis = connectedAccount.analysis as Mt5ConnectedAnalysis | null;
        const provider = connectedAccount.provider.toUpperCase();
        const status = connectedAccount.status ?? "ACTIVE";
        account = {
          id: accountId,
          provider: connectedAccount.provider,
          account_id: connectedAccount.account_id ?? accountId,
          label: connectedAccount.label ?? accountId,
          broker: provider,
          server: "",
          balance: Number(analysis?.balance ?? 0),
          equity: Number(analysis?.nav ?? analysis?.balance ?? 0),
          positions: analysis?.positions ?? [],
          currency: String(analysis?.currency ?? "USD"),
          last_sync_utc: connectedAccount.last_sync_utc,
          trade_mode: "AUTO",
          status,
          lot_map: [],
        };
      }
    } else {
      account = (await getMt5AccountById(accountId)) as Mt5PageAccount | null;
    }
    await readMt5ClosedSummary(accountId, 12);
    changeLog = await readMt5ChangeLog(accountId, 12);
    closedPositions = isSelectedMt5Week
      ? await readMt5ClosedPositionsByWeek(accountId, selectedWeek, 500)
      : [];
    const weekOpen = statsWeekOpenUtc;
    const weekEnd = DateTime.fromISO(weekOpen, { zone: "utc" }).plus({ days: 7 }).toISO();
    if (weekEnd) {
      await readMt5DrawdownRange(accountId, weekOpen, weekEnd);
      currentWeekNet = await readMt5ClosedNetForWeek(accountId, weekOpen);
      const snapshots = await readMt5EquityCurveByRange(accountId, weekOpen, weekEnd);
      console.log(
        `[MT5 KPI] account=${accountId} week=${weekOpen} equitySnapshots=${snapshots.length}`,
      );
      if (snapshots.length > 0) {
        const startEquity = snapshots[0].equity;
        const lockedProfitRaw = account?.locked_profit_pct;
        const lockPct =
          typeof lockedProfitRaw === "number" &&
          Number.isFinite(lockedProfitRaw) &&
          lockedProfitRaw > 0
            ? lockedProfitRaw
            : null;
        equityCurvePoints = snapshots.map((point) => ({
          ts_utc: point.snapshot_at,
          equity_pct: startEquity > 0 ? ((point.equity - startEquity) / startEquity) * 100 : 0,
          lock_pct: lockPct,
        }));
        equityCurvePoints = extendToWindow(equityCurvePoints, weekEnd);
      }
    }
    basketSignals = await buildBasketSignals();
    if (selectedWeek && selectedWeek !== currentWeekOpenUtc) {
      let usedHistory = false;
      try {
        const history = await readPerformanceSnapshotsByWeek(selectedWeek);
        if (history.length > 0) {
          basketSignals = {
            ...basketSignals,
            week_open_utc: selectedWeek,
            pairs: signalsFromSnapshots(history),
          };
          usedHistory = true;
        }
      } catch (error) {
        console.error(
          "Performance snapshot load failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
      if (!usedHistory) {
        basketSignals = { ...basketSignals, week_open_utc: selectedWeek };
      }
    } else {
      basketSignals = { ...basketSignals, week_open_utc: selectedWeek };
    }
  } catch (error) {
    console.error("Account load failed:", error instanceof Error ? error.message : String(error));
  }

  return {
    account,
    closedPositions,
    changeLog,
    currentWeekNet,
    equityCurvePoints,
    basketSignals,
  };
}
