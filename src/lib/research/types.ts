export type ResearchMode = "as_traded_replay" | "hypothetical_sim";
export type ResearchProvider = "oanda" | "bitget" | "mt5";
export type ResearchAssetClass = "fx" | "indices" | "commodities" | "crypto";
export type ResearchModel =
  | "antikythera"
  | "blended"
  | "dealer"
  | "commercial"
  | "sentiment";

export type ResearchConfig = {
  mode: ResearchMode;
  accountKey?: string;
  provider: ResearchProvider;
  dateRange: { from: string; to: string };
  universe: {
    assetClasses: ResearchAssetClass[];
    symbols?: string[];
  };
  models: ResearchModel[];
  execution: {
    legMode: "full_legs" | "net_only";
    includeNeutral: boolean;
    order: "grouped_by_symbol" | "leg_sequence";
  };
  risk: {
    startingEquity?: number;
    riskMode?: string;
    sizingModel?: "broker_native" | "fixed_risk" | "vol_target" | "custom";
    marginBuffer: number;
    leverage?: number;
    sizing: "broker_native" | "fixed_risk";
    stopLoss?: { type: "pct"; value: number };
    trailing?: { startPct: number; offsetPct: number };
  };
  realism: {
    slippageBps?: number;
    commissionBps?: number;
    allowPartialFills: boolean;
  };
};

export type ResearchRunResult = {
  runId: string;
  configHash: string;
  generatedAt: string;
  assumptions: {
    dataGranularity: "weekly" | "hourly" | "mixed";
    notes: string[];
  };
  headline: {
    totalReturnPct: number;
    staticDrawdownPct: number;
    trailingDrawdownPct: number;
    winRatePct: number;
    trades: number;
    pricedTrades: number;
  };
  risk: {
    avgMarginUsedPct: number;
    peakMarginUsedPct: number;
    fillRatePct: number;
  };
  equityCurve: Array<{
    ts_utc: string;
    equity_pct: number;
    equity_usd?: number;
    static_baseline_usd?: number | null;
    lock_pct: number | null;
  }>;
  weekly: Array<{
    week_open_utc: string;
    return_pct: number;
    static_drawdown_pct: number;
    trailing_drawdown_pct: number;
  }>;
  byModel: Array<{
    model: string;
    return_pct: number;
    static_drawdown_pct: number;
    trailing_drawdown_pct: number;
    trades: number;
  }>;
  bySymbol: Array<{ symbol: string; return_pct: number; win_rate_pct: number; trades: number }>;
  byWeekday?: Array<{ weekday: number; return_pct: number; trades: number }>;
};

export type ResearchRunStatus = "pending" | "running" | "complete" | "error";
