import type { WeekOption } from "@/lib/weekState";
import type { ReactNode } from "react";
import type { Mt5PlanningDiagnostics } from "@/lib/accounts/mt5Planning";

export type HeaderConfig = {
  title: string;
  providerLabel: string;
  tradeModeLabel?: string;
  riskModeLabel?: string | null;
  statusLabel?: string;
  statusToneClass?: string;
  dataSourceLabel?: string | null;
  reconstructionStatus?: string | null;
  reconstructionNote?: string | null;
  lastSyncUtcRaw?: string | null;
  lastSync?: string;
  weekOptions: WeekOption[];
  currentWeek: string;
  selectedWeek: WeekOption;
  weekLabelMode?: "week_open_utc" | "monday_et";
  showStopLoss1pct?: boolean;
  onBackHref: string;
};

export type DrawerData = {
  plannedPairs: Array<{
    symbol: string;
    assetClass: string;
    net: number;
    legsCount: number;
    legs?: Array<{
      model: string;
      direction: string;
      units?: number | null;
      move1pctUsd?: number | null;
      sizeDisplay?: string | null;
      riskDisplay?: string | null;
    }>;
    units?: number | null;
    netUnits?: number | null;
    move1pctUsd?: number | null;
    sizeDisplay?: string | null;
    riskDisplay?: string | null;
    entryPrice?: number | null;
    stopLoss1pct?: number | null;
  }>;
  mappingRows: Array<{
    symbol: string;
    instrument: string;
    available: boolean;
  }>;
  openPositions: Array<{
    symbol: string;
    side: string;
    lots: number;
    pnl: number;
    legs?: Array<{
      id: string | number;
      basket: string;
      side: string;
      lots: number;
      pnl: number;
    }>;
  }>;
  closedGroups: Array<{
    symbol: string;
    side: string;
    net: number;
    lots: number;
    legs?: Array<{
      id: string | number;
      basket: string;
      side: string;
      lots: number;
      pnl: number;
      openTime?: string;
      closeTime?: string;
    }>;
  }>;
  journalRows: Array<{
    label: string;
    value: string;
  }>;
  kpiRows: Array<{
    label: string;
    value: string;
  }>;
};

export type AccountClientViewProps = {
  activeView: "overview" | "trades" | "analytics";
  header: HeaderConfig;
  kpi: {
    weeklyPnlPct: number;
    maxDrawdownPct: number;
    tradesThisWeek: number;
    openPositions?: number;
    baselineEquity?: number;
    equity: number;
    balance: number;
    currency: string;
    scopeLabel: string;
  };
  overview: {
    openPositions: number;
    plannedCount: number;
    mappingCount: number;
    plannedNote?: string | null;
    journalCount?: number;
  };
  plannedSummary?: {
    marginUsed?: number | null;
    marginUsedBestCase?: number | null;
    marginAvailable?: number | null;
    scale?: number | null;
    currency?: string | null;
  };
  equity: {
    title: string;
    points: { ts_utc: string; equity_pct: number; lock_pct: number | null }[];
  };
  debug: {
    selectedWeekKey: string;
    kpiWeekKey: string;
    equityWeekKey: string;
  };
  planningDiagnostics?: Mt5PlanningDiagnostics & {
    sizingBaselineSource?: "week_start_baseline" | "current_equity";
    sizingBaselineValue?: number;
  };
  drawerData: DrawerData;
  settingsExtras?: ReactNode;
};
