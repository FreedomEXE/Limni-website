import { notFound } from "next/navigation";
import { unstable_noStore } from "next/cache";

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
import DashboardLayout from "@/components/DashboardLayout";
import AccountClientView from "@/components/accounts/AccountClientView";
import { DateTime } from "luxon";
import { formatCurrencySafe } from "@/lib/formatters";
import { formatDateTimeET } from "@/lib/time";
import { readPerformanceSnapshotsByWeek } from "@/lib/performanceSnapshots";
import { buildBasketSignals } from "@/lib/basketSignals";
import { groupSignals, signalsFromSnapshots } from "@/lib/plannedTrades";

export const dynamic = "force-dynamic";

type AccountPageProps = {
  params: Promise<{ accountId: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "n/a";
  }
  if (seconds <= 1) {
    return "now";
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [] as string[];
  if (hrs > 0) {
    parts.push(`${hrs}h`);
  }
  if (mins > 0 || hrs > 0) {
    parts.push(`${mins}m`);
  }
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function statusTone(status: string) {
  if (status === "LIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "DEMO") {
    return "bg-[var(--panel-border)]/50 text-[var(--foreground)]/70";
  }
  return "bg-rose-100 text-rose-700";
}

function basketTone(state: string) {
  if (state === "ACTIVE") {
    return "text-emerald-700";
  }
  if (state === "READY") {
    return "text-[var(--foreground)]/70";
  }
  if (state === "PAUSED") {
    return "text-rose-700";
  }
  return "text-[color:var(--muted)]";
}

function parseBasketFromComment(comment: string) {
  if (!comment) {
    return null;
  }
  const match = comment.match(/LimniBasket\s+([A-Za-z0-9_]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function toQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function extendToWindow(
  points: { ts_utc: string; equity_pct: number; lock_pct: number | null }[],
  windowEndUtc: string | null
) {
  if (!windowEndUtc || points.length === 0) {
    return points;
  }
  const last = points[points.length - 1];
  if (DateTime.fromISO(last.ts_utc, { zone: "utc" }) >= DateTime.fromISO(windowEndUtc, { zone: "utc" })) {
    return points;
  }
  return [...points, { ...last, ts_utc: windowEndUtc }];
}

function computeMaxDrawdown(points: { equity_pct: number }[]) {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;
  for (const point of points) {
    if (point.equity_pct > peak) {
      peak = point.equity_pct;
    }
    const drawdown = peak - point.equity_pct;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

export default async function AccountPage({ params, searchParams }: AccountPageProps) {
  unstable_noStore();
  const { accountId } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const requestedWeek = toQueryParam(resolvedSearchParams?.week);
  const viewParam = toQueryParam(resolvedSearchParams?.view);
  const basketFilter = (toQueryParam(resolvedSearchParams?.basket) ?? "").toLowerCase();
  const symbolFilter = (toQueryParam(resolvedSearchParams?.symbol) ?? "").toUpperCase();
  const activeView = (() => {
    if (!viewParam) return "overview" as const;
    if (viewParam === "equity") return "overview" as const;
    if (viewParam === "positions") return "trades" as const;
    if (viewParam === "settings") return "analytics" as const;
    if (["overview", "trades", "analytics"].includes(viewParam)) {
      return viewParam as "overview" | "trades" | "analytics";
    }
    return "overview" as const;
  })();
  const desiredWeeks = 4;
  const currentWeekOpenUtc = getMt5WeekOpenUtc();
  const currentWeekStart = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  const nextWeekOpenUtc = currentWeekStart.isValid
    ? currentWeekStart.plus({ days: 7 }).toUTC().toISO()
    : null;
  let weekOptions: string[] = [];
  try {
    const recentWeeks = await listMt5WeekOptions(accountId, desiredWeeks);
    const ordered: string[] = [];
    const seen = new Set<string>();
    if (nextWeekOpenUtc) {
      ordered.push(nextWeekOpenUtc);
      seen.add(nextWeekOpenUtc);
    }
    if (currentWeekOpenUtc && !seen.has(currentWeekOpenUtc)) {
      ordered.push(currentWeekOpenUtc);
      seen.add(currentWeekOpenUtc);
    }
    for (const week of recentWeeks) {
      if (!seen.has(week)) {
        ordered.push(week);
        seen.add(week);
      }
    }
    weekOptions = ordered.slice(0, desiredWeeks);
  } catch (error) {
    console.error(
      "MT5 week list failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (weekOptions.length === 0) {
    const fallback: string[] = [];
    if (nextWeekOpenUtc) {
      fallback.push(nextWeekOpenUtc);
    }
    if (currentWeekOpenUtc && !fallback.includes(currentWeekOpenUtc)) {
      fallback.push(currentWeekOpenUtc);
    }
    weekOptions = fallback;
  }
  const nowUtc = DateTime.utc();
  const hoursToNext =
    nextWeekOpenUtc
      ? DateTime.fromISO(nextWeekOpenUtc, { zone: "utc" }).diff(nowUtc, "hours").hours
      : null;
  const selectedWeek =
    requestedWeek && weekOptions.includes(requestedWeek)
      ? requestedWeek
      : hoursToNext !== null && hoursToNext <= 48 && nextWeekOpenUtc && weekOptions.includes(nextWeekOpenUtc)
        ? nextWeekOpenUtc
        : weekOptions.includes(currentWeekOpenUtc)
          ? currentWeekOpenUtc
          : weekOptions[0] ?? currentWeekOpenUtc;
  const isSelectedMt5Week = selectedWeek ? isMt5WeekOpenUtc(selectedWeek) : false;
  const statsWeekOpenUtc = isSelectedMt5Week ? selectedWeek : getMt5WeekOpenUtc();
  let account = null;
  let closedPositions: Awaited<ReturnType<typeof readMt5ClosedPositionsByWeek>> = [];
  let closedSummary: Awaited<ReturnType<typeof readMt5ClosedSummary>> = [];
  let changeLog: Awaited<ReturnType<typeof readMt5ChangeLog>> = [];
  let weeklyDrawdown = 0;
  let currentWeekNet = { net: 0, trades: 0 };
  let equityCurvePoints: { ts_utc: string; equity_pct: number; lock_pct: number | null }[] = [];
  let basketSignals: Awaited<ReturnType<typeof buildBasketSignals>> | null = null;
  try {
    account = await getMt5AccountById(accountId);
    closedSummary = await readMt5ClosedSummary(accountId, 12);
    changeLog = await readMt5ChangeLog(accountId, 12);
    closedPositions = isSelectedMt5Week
      ? await readMt5ClosedPositionsByWeek(accountId, selectedWeek, 500)
      : [];
    const weekOpen = statsWeekOpenUtc;
    const weekEnd = DateTime.fromISO(weekOpen, { zone: "utc" }).plus({ days: 7 }).toISO();
    if (weekEnd) {
      weeklyDrawdown = await readMt5DrawdownRange(accountId, weekOpen, weekEnd);
      currentWeekNet = await readMt5ClosedNetForWeek(accountId, weekOpen);
      const snapshots = await readMt5EquityCurveByRange(accountId, weekOpen, weekEnd);
      console.log(
        `[MT5 KPI] account=${accountId} week=${weekOpen} equitySnapshots=${snapshots.length}`
      );
      if (snapshots.length > 0) {
        const startEquity = snapshots[0].equity;
        const lockPct =
          account && Number.isFinite(account.locked_profit_pct) && account.locked_profit_pct > 0
            ? account.locked_profit_pct
            : null;
        equityCurvePoints = snapshots.map((point) => ({
          ts_utc: point.snapshot_at,
          equity_pct:
            startEquity > 0
              ? ((point.equity - startEquity) / startEquity) * 100
              : 0,
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
    console.error(
      "Account load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!account) {
    notFound();
  }

  const openFloatingPnl = (account.positions ?? []).reduce(
    (acc, position) => acc + position.profit + position.swap + position.commission,
    0,
  );
  const inferredStartBalance =
    account.balance - currentWeekNet.net > 0 ? account.balance - currentWeekNet.net : account.balance;
  const derivedWeeklyPnlPct =
    inferredStartBalance > 0
      ? (currentWeekNet.net / inferredStartBalance) * 100
      : 0;
  const derivedBasketPnlPct =
    account.baseline_equity > 0
      ? ((account.equity - account.baseline_equity) / account.baseline_equity) * 100
      : derivedWeeklyPnlPct + (inferredStartBalance > 0 ? (openFloatingPnl / inferredStartBalance) * 100 : 0);

  const weeklyPnlToShow =
    Math.abs(account.weekly_pnl_pct) > 0.001 || currentWeekNet.trades === 0
      ? account.weekly_pnl_pct
      : derivedWeeklyPnlPct;
  const basketPnlToShow =
    Math.abs(account.basket_pnl_pct) > 0.001 ||
    Math.abs(account.baseline_equity) > 0.001
      ? account.basket_pnl_pct
      : derivedBasketPnlPct;

  const basketOptions = Array.from(
    new Set(
      [
        ...(account.positions ?? []).map((position) => parseBasketFromComment(position.comment)),
        ...closedPositions.map((position) => parseBasketFromComment(position.comment)),
      ].filter((value): value is string => value !== null),
    ),
  ).sort();

  const symbolOptions = Array.from(
    new Set(
      [
        ...(account.positions ?? []).map((position) => position.symbol),
        ...closedPositions.map((position) => position.symbol),
      ],
    ),
  ).sort();

  const effectiveBasketFilter =
    basketFilter && basketOptions.includes(basketFilter) ? basketFilter : "";
  const effectiveSymbolFilter =
    symbolFilter && symbolOptions.includes(symbolFilter) ? symbolFilter : "";

  const filteredOpenPositions = (account.positions ?? []).filter((position) => {
    const basket = parseBasketFromComment(position.comment);
    if (effectiveBasketFilter && basket !== effectiveBasketFilter) {
      return false;
    }
    if (effectiveSymbolFilter && position.symbol !== effectiveSymbolFilter) {
      return false;
    }
    return true;
  });

  const filteredClosedPositions = closedPositions.filter((position) => {
    const basket = parseBasketFromComment(position.comment);
    if (effectiveBasketFilter && basket !== effectiveBasketFilter) {
      return false;
    }
    if (effectiveSymbolFilter && position.symbol !== effectiveSymbolFilter) {
      return false;
    }
    return true;
  });

  const closedGroups = (() => {
    const groups = new Map<
      string,
      {
        key: string;
        symbol: string;
        type: "BUY" | "SELL";
        basket: string;
        openDate: string;
        trades: typeof filteredClosedPositions;
        net: number;
        lots: number;
        closeTimeMin: string;
        closeTimeMax: string;
      }
    >();
    for (const trade of filteredClosedPositions) {
      const basket = parseBasketFromComment(trade.comment) ?? "unknown";
      const openDate = trade.open_time.slice(0, 10);
      const key = `${basket}|${trade.symbol}|${trade.type}|${openDate}`;
      const net = trade.profit + trade.swap + trade.commission;
      const existing = groups.get(key);
      if (existing) {
        existing.trades.push(trade);
        existing.net += net;
        existing.lots += trade.lots;
        existing.closeTimeMin =
          existing.closeTimeMin < trade.close_time ? existing.closeTimeMin : trade.close_time;
        existing.closeTimeMax =
          existing.closeTimeMax > trade.close_time ? existing.closeTimeMax : trade.close_time;
      } else {
        groups.set(key, {
          key,
          symbol: trade.symbol,
          type: trade.type,
          basket,
          openDate,
          trades: [trade],
          net,
          lots: trade.lots,
          closeTimeMin: trade.close_time,
          closeTimeMax: trade.close_time,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.net - a.net);
  })();


  let plannedPairs = basketSignals ? groupSignals(basketSignals.pairs) : [];
  const allowPlannedWeek =
    selectedWeek === currentWeekOpenUtc ||
    (nextWeekOpenUtc ? selectedWeek === nextWeekOpenUtc : false);
  if (!allowPlannedWeek) {
    plannedPairs = [];
  }
  const lotMapBySymbol = new Map(
    account?.lot_map?.map((row) => [row.symbol, row]) ?? [],
  );
  if (plannedPairs.length > 0 && lotMapBySymbol.size > 0) {
    plannedPairs = plannedPairs.map((pair) => {
      const sizing = lotMapBySymbol.get(pair.symbol);
      if (!sizing || !Number.isFinite(sizing.lot)) {
        return pair;
      }
      const perLegLot = sizing.lot;
      const netLots = perLegLot * pair.net;
      const movePerLeg = Number.isFinite(sizing.move_1pct_usd)
        ? (sizing.move_1pct_usd as number)
        : null;
      const moveNet = movePerLeg !== null ? Math.abs(pair.net) * movePerLeg : null;
      return {
        ...pair,
        units: perLegLot,
        netUnits: netLots,
        move1pctUsd: moveNet ?? undefined,
        legs: pair.legs.map((leg) => ({
          ...leg,
          units: perLegLot,
          move1pctUsd: movePerLeg ?? undefined,
        })),
      } as typeof pair & {
        units: number;
        netUnits: number;
        move1pctUsd?: number;
        legs: Array<typeof pair.legs[number] & { units: number; move1pctUsd?: number }>;
      };
    });
  }
  const journalRows = [
    ...(account.recent_logs ?? []).map((log) => ({
      label: "Runtime",
      value: log,
    })),
    ...changeLog.map((entry) => ({
      label: entry.strategy ?? "Change",
      value: entry.title,
    })),
  ];

  const maxDrawdownPct = computeMaxDrawdown(equityCurvePoints);

  return (
    <DashboardLayout>
      <AccountClientView
        activeView={activeView}
        header={{
          title: account?.label ?? "Account",
          providerLabel: "MT5",
          statusLabel: account?.status ?? "UNKNOWN",
          statusToneClass: statusTone(account?.status ?? "PAUSED"),
          lastSync: account?.last_sync_utc ? formatDateTimeET(account.last_sync_utc) : "—",
          weekOptions,
          currentWeek: currentWeekOpenUtc,
          selectedWeek,
          onBackHref: "/accounts",
        }}
        kpi={{
          weeklyPnlPct: weeklyPnlToShow,
          maxDrawdownPct,
          tradesThisWeek: account.trade_count_week,
          equity: account.equity,
          balance: account.balance,
          currency: account.currency,
          scopeLabel: "Week • Account",
        }}
        overview={{
          openPositions: filteredOpenPositions.length,
          plannedCount: plannedPairs.length,
          mappingCount: 0,
          plannedNote: null,
          journalCount: journalRows.length,
        }}
        equity={{
          title: "Weekly equity curve (%)",
          points: equityCurvePoints,
        }}
        debug={{
          selectedWeekKey: selectedWeek ?? currentWeekOpenUtc,
          kpiWeekKey: statsWeekOpenUtc,
          equityWeekKey: statsWeekOpenUtc,
        }}
        drawerData={{
          plannedPairs: plannedPairs.map((pair) => ({
            symbol: pair.symbol,
            assetClass: pair.assetClass,
            net: pair.net,
            legsCount: pair.legs.length,
            legs: pair.legs,
            units: "units" in pair ? (pair as any).units : null,
            netUnits: "netUnits" in pair ? (pair as any).netUnits : null,
            move1pctUsd: "move1pctUsd" in pair ? (pair as any).move1pctUsd : null,
          })),
          mappingRows: [],
          openPositions: filteredOpenPositions.map((pos) => ({
            symbol: pos.symbol,
            side: pos.type,
            lots: pos.lots,
            pnl: pos.profit + pos.swap + pos.commission,
            legs: [
              {
                id: pos.ticket,
                basket: parseBasketFromComment(pos.comment) ?? "unknown",
                side: pos.type,
                lots: pos.lots,
                pnl: pos.profit + pos.swap + pos.commission,
              },
            ],
          })),
          closedGroups: closedGroups.map((group) => ({
            symbol: group.symbol,
            side: group.type,
            net: group.net,
            lots: group.lots,
            legs: group.trades.map((trade) => ({
              id: trade.ticket,
              basket: parseBasketFromComment(trade.comment) ?? "unknown",
              side: trade.type,
              lots: trade.lots,
              pnl: trade.profit + trade.swap + trade.commission,
              openTime: trade.open_time,
              closeTime: trade.close_time,
            })),
          })),
          journalRows: [
            ...(account.recent_logs ?? []).map((log) => ({
              label: "Runtime",
              value: log,
            })),
            ...changeLog.map((entry) => ({
              label: entry.strategy ?? "Change",
              value: entry.title,
            })),
          ],
          kpiRows: [
            { label: "Equity", value: formatCurrencySafe(account.equity, account.currency) },
            { label: "Balance", value: formatCurrencySafe(account.balance, account.currency) },
            { label: "Basket PnL", value: formatPercent(basketPnlToShow) },
            { label: "Risk Used", value: formatPercent(account.risk_used_pct) },
            { label: "Max DD (all)", value: formatPercent(account.max_drawdown_pct) },
            { label: "Margin", value: formatCurrencySafe(account.margin, account.currency) },
            { label: "Free Margin", value: formatCurrencySafe(account.free_margin, account.currency) },
          ],
        }}
      />
    </DashboardLayout>
  );
}
