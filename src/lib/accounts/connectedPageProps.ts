import { formatDateTimeET } from "@/lib/time";
import type { PlannedPair } from "@/lib/plannedTrades";
import type { NormalizedOpenPosition } from "@/lib/accounts/connectedViewHelpers";
import {
  buildConnectedDrawerKpiRows,
  buildConnectedDrawerPlannedPairs,
  resolveConnectedTradeModeLabel,
} from "@/lib/accounts/connectedPageViewModel";

type ConnectedPropsInput = {
  activeView: "overview" | "trades" | "analytics";
  account: {
    account_key: string;
    label: string | null;
    provider: "oanda" | "bitget" | "mt5";
    risk_mode?: string | null;
    config: Record<string, unknown> | null;
    last_sync_utc: string | null;
  };
  weekOptionsWithUpcoming: string[];
  currentWeekOpenUtc: string;
  selectedWeek: string;
  stats: {
    weekOpenUtc: string | "all";
    equity: number;
    balance: number;
    weeklyPnlPct: number;
    basketPnlPct: number;
    currency: string;
    lockedProfitPct: number | null;
    openPositions: number;
    tradesThisWeek: number;
    leverage: number | null;
    margin: number | null;
    freeMargin: number | null;
    riskUsedPct: number | null;
  };
  plannedPairs: PlannedPair[];
  plannedNote: string | null;
  plannedSummary: {
    marginUsed?: number | null;
    marginAvailable?: number | null;
    scale?: number | null;
    currency?: string | null;
  } | null;
  equityCurve: {
    ts_utc: string;
    equity_pct: number;
    lock_pct: number | null;
    equity_usd?: number;
    static_baseline_usd?: number | null;
    static_drawdown_pct?: number;
    trailing_drawdown_pct?: number;
  }[];
  staticDrawdownPct: number;
  trailingDrawdownPct: number;
  mappedRows: Array<{ symbol: string; instrument: string; available: boolean }>;
  openPositions: NormalizedOpenPosition[];
};

export function buildConnectedAccountClientViewProps(input: ConnectedPropsInput) {
  const {
    activeView,
    account,
    weekOptionsWithUpcoming,
    currentWeekOpenUtc,
    selectedWeek,
    stats,
    plannedPairs,
    plannedNote,
    plannedSummary,
    equityCurve,
    staticDrawdownPct,
    trailingDrawdownPct,
    mappedRows,
    openPositions,
  } = input;

  const accountCurrency = stats.currency;
  const isHistoricalWeekEstimate = selectedWeek !== "all" && selectedWeek !== currentWeekOpenUtc;
  return {
    activeView,
    header: {
      title: account.label ?? account.account_key,
      providerLabel: account.provider.toUpperCase(),
      tradeModeLabel: resolveConnectedTradeModeLabel(account.config),
      riskModeLabel: account.risk_mode ?? null,
      dataSourceLabel: isHistoricalWeekEstimate ? "estimated" : "realtime",
      reconstructionStatus: isHistoricalWeekEstimate ? "estimated" : "none",
      reconstructionNote: isHistoricalWeekEstimate
        ? "Historical week uses latest connected snapshot (estimation)."
        : null,
      lastSyncUtcRaw: account.last_sync_utc,
      lastSync: account.last_sync_utc ? formatDateTimeET(account.last_sync_utc) : "—",
      weekOptions: weekOptionsWithUpcoming,
      currentWeek: currentWeekOpenUtc,
      selectedWeek,
      onBackHref: "/accounts",
    },
    kpi: {
      weeklyPnlPct: stats.weeklyPnlPct,
      staticDrawdownPct,
      trailingDrawdownPct,
      tradesThisWeek: stats.tradesThisWeek,
      openPositions: stats.openPositions,
      equity: stats.equity,
      balance: stats.balance,
      currency: accountCurrency,
      scopeLabel: selectedWeek === "all" ? "All • Account" : "Week • Account",
    },
    overview: {
      openPositions: stats.openPositions,
      plannedCount: plannedPairs.length,
      mappingCount: mappedRows.length,
      plannedNote: plannedNote ?? null,
    },
    plannedSummary: plannedSummary ?? undefined,
    equity: {
      title: selectedWeek === "all" ? "All-time equity curve" : "Weekly equity curve (%)",
      points: equityCurve,
      watermarkText:
        account.provider === "mt5"
          ? "Manual"
          : account.label ?? account.provider.toUpperCase(),
    },
    debug: {
      selectedWeekKey: selectedWeek === "all" ? "all" : String(selectedWeek),
      kpiWeekKey: stats.weekOpenUtc,
      equityWeekKey: selectedWeek === "all" ? "all" : String(selectedWeek),
    },
    drawerData: {
      plannedPairs: buildConnectedDrawerPlannedPairs(plannedPairs),
      mappingRows: mappedRows.map((row) => ({
        symbol: row.symbol,
        instrument: row.instrument,
        available: row.available,
      })),
      openPositions,
      closedGroups: [],
      journalRows: [],
      kpiRows: buildConnectedDrawerKpiRows(stats, accountCurrency),
    },
  };
}
