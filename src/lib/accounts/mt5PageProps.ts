import { formatDateTimeET } from "@/lib/time";
import { statusTone } from "@/lib/accounts/uiTones";
import type { PlannedPair } from "@/lib/plannedTrades";
import {
  type Mt5AccountLike,
  type Mt5Position,
  type OpenPositionLike,
  buildMt5ClosedGroups,
  buildMt5DrawerClosedGroups,
  buildMt5DrawerKpiRows,
  buildMt5DrawerOpenPositions,
  buildMt5DrawerPlannedPairs,
  buildMt5JournalRows,
} from "@/lib/accounts/mt5PageViewModel";
import type { Mt5PlanningDiagnostics } from "@/lib/accounts/mt5Planning";

type Mt5PageHeaderAccount = Partial<Mt5AccountLike> & {
  label?: string | null;
  trade_mode?: string | null;
  risk_mode?: string | null;
  status?: string | null;
  baseline_equity?: number | null;
  last_sync_utc?: string | null;
  trade_count_week?: number | null;
  recent_logs?: string[] | null;
  data_source?: string | null;
  reconstruction_status?: string | null;
  reconstruction_note?: string | null;
};

type Mt5PagePropsInput = {
  activeView: "overview" | "trades" | "analytics";
  account: Mt5PageHeaderAccount;
  weekOptions: string[];
  currentWeekOpenUtc: string;
  selectedWeek: string;
  statsWeekOpenUtc: string;
  showStopLoss1pct: boolean;
  weeklyPnlToShow: number;
  basketPnlToShow: number;
  maxDrawdownPct: number;
  filteredOpenPositions: OpenPositionLike[];
  filteredClosedPositions: Mt5Position[];
  plannedPairs: PlannedPair[];
  plannedSummary: {
    marginUsed?: number | null;
    marginUsedBestCase?: number | null;
    marginAvailable?: number | null;
    scale?: number | null;
    currency?: string | null;
  } | null;
  planningDiagnostics?: Mt5PlanningDiagnostics;
  planningMode?: "available" | "missing" | "legacy" | "disabled";
  equityCurvePoints: { ts_utc: string; equity_pct: number; lock_pct: number | null }[];
  changeLog: Array<{ strategy?: string | null; title: string }>;
};

export function buildMt5AccountClientViewProps(input: Mt5PagePropsInput) {
  const {
    activeView,
    account,
    weekOptions,
    currentWeekOpenUtc,
    selectedWeek,
    statsWeekOpenUtc,
    showStopLoss1pct,
    weeklyPnlToShow,
    basketPnlToShow,
    maxDrawdownPct,
    filteredOpenPositions,
    filteredClosedPositions,
    plannedPairs,
    plannedSummary,
    planningDiagnostics,
    planningMode,
    equityCurvePoints,
    changeLog,
  } = input;

  const closedGroups = buildMt5ClosedGroups(filteredClosedPositions);
  const journalRows = buildMt5JournalRows(account.recent_logs ?? [], changeLog);
  const kpiAccount: Mt5AccountLike = {
    equity: Number(account.equity ?? 0),
    balance: Number(account.balance ?? 0),
    currency: String(account.currency ?? "USD"),
    risk_used_pct: Number(account.risk_used_pct ?? 0),
    max_drawdown_pct: Number(account.max_drawdown_pct ?? 0),
    margin: Number(account.margin ?? 0),
    free_margin: Number(account.free_margin ?? 0),
  };
  const sizingBaselineSource: "week_start_baseline" | "current_equity" =
    Number(account.baseline_equity ?? 0) > 0 ? "week_start_baseline" : "current_equity";
  const sizingBaselineValue =
    Number(account.baseline_equity ?? 0) > 0
      ? Number(account.baseline_equity ?? 0)
      : Number(account.equity ?? 0);
  return {
    activeView,
    header: {
      title: String(account?.label ?? "Account"),
      providerLabel: "MT5",
      tradeModeLabel: String(account?.trade_mode ?? "AUTO"),
      riskModeLabel: account?.risk_mode ?? null,
      statusLabel: String(account?.status ?? "UNKNOWN"),
      statusToneClass: statusTone(String(account?.status ?? "PAUSED")),
      dataSourceLabel: account?.data_source ?? "realtime",
      reconstructionStatus: account?.reconstruction_status ?? "none",
      reconstructionNote: account?.reconstruction_note ?? null,
      lastSyncUtcRaw: account?.last_sync_utc ?? null,
      lastSync: account?.last_sync_utc ? formatDateTimeET(String(account.last_sync_utc)) : "—",
      weekOptions,
      currentWeek: currentWeekOpenUtc,
      selectedWeek,
      weekLabelMode: "monday_et" as const,
      showStopLoss1pct,
      onBackHref: "/accounts",
    },
    kpi: {
      weeklyPnlPct: weeklyPnlToShow,
      maxDrawdownPct,
      tradesThisWeek: Number(account.trade_count_week ?? 0),
      openPositions: filteredOpenPositions.length,
      baselineEquity: Number(account.baseline_equity ?? 0),
      equity: Number(account.equity ?? 0),
      balance: Number(account.balance ?? 0),
      currency: String(account.currency ?? "USD"),
      scopeLabel: "Week • Account",
    },
    overview: {
      openPositions: filteredOpenPositions.length,
      plannedCount: plannedPairs.length,
      mappingCount: 0,
      plannedNote: null,
      journalCount: journalRows.length,
    },
    plannedSummary: plannedSummary ?? undefined,
    equity: {
      title: "Weekly equity curve (%)",
      points: equityCurvePoints,
    },
    debug: {
      selectedWeekKey: selectedWeek ?? currentWeekOpenUtc,
      kpiWeekKey: statsWeekOpenUtc,
      equityWeekKey: statsWeekOpenUtc,
    },
    planningDiagnostics: planningDiagnostics
      ? {
          ...planningDiagnostics,
          sizingBaselineSource,
          sizingBaselineValue,
        }
      : undefined,
    planningMode: planningMode ?? "missing",
    drawerData: {
      plannedPairs: buildMt5DrawerPlannedPairs(plannedPairs),
      mappingRows: [],
      openPositions: buildMt5DrawerOpenPositions(filteredOpenPositions),
      closedGroups: buildMt5DrawerClosedGroups(closedGroups),
      journalRows,
      kpiRows: buildMt5DrawerKpiRows(kpiAccount, basketPnlToShow),
    },
  };
}
