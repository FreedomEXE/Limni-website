/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyConfig.ts
 *
 * Description:
 * Config-driven strategy definitions for Performance and Matrix sections.
 * Three selection levels:
 *   Strategy   — directional bias source (Dealer, Tiered V3, etc.)
 *   Filter 1   — basket-level filter (Weekly Hold, COT Gate, etc.)
 *   Filter 2   — intraday entry filter (None, ADR Pullback, Stoch RSI, etc.)
 *
 * Adding a new option is just adding an entry to the array.
 * URL params: ?strategy=dealer&f1=weekly_hold&f2=none
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

/* ─── Strategy (directional bias source) ──────────────────────── */

export type StrategyType = "single" | "tiered" | "agreement" | "tandem";

export type StrategyConfig = {
  id: string;
  label: string;
  type: StrategyType;
  description: string;
  /** What the 3 performance cards represent for this source */
  cardBreakdown: "asset_class" | "tiers" | "per_model";
};

export const STRATEGIES: StrategyConfig[] = [
  {
    id: "dealer",
    label: "Dealer",
    type: "single",
    description: "COT dealer/intermediary positioning",
    cardBreakdown: "asset_class",
  },
  {
    id: "commercial",
    label: "Commercial",
    type: "single",
    description: "COT commercial/hedger positioning",
    cardBreakdown: "asset_class",
  },
  {
    id: "sentiment",
    label: "Sentiment",
    type: "single",
    description: "Retail crowd contrarian positioning",
    cardBreakdown: "asset_class",
  },
  {
    id: "tiered_v3",
    label: "Tiered V3",
    type: "tiered",
    description: "Dealer + Commercial + Sentiment voting (3 tiers)",
    cardBreakdown: "tiers",
  },
  {
    id: "agree_2of3",
    label: "2-of-3 Agree",
    type: "agreement",
    description: "Any 2 of Dealer/Commercial/Sentiment agree",
    cardBreakdown: "asset_class",
  },
  {
    id: "tandem",
    label: "Tandem",
    type: "tandem",
    description: "All 3 models running independently",
    cardBreakdown: "per_model",
  },
];

/* ─── Filter 1 (basket-level) ─────────────────────────────────── */

export type BasketFilterConfig = {
  id: string;
  label: string;
  description: string;
};

export const BASKET_FILTERS: BasketFilterConfig[] = [
  {
    id: "weekly_hold",
    label: "Weekly Hold",
    description: "Enter at week open, exit at week close",
  },
  // Future:
  // { id: "cot_gate", label: "COT Gate", description: "COT positioning gate filters weak setups" },
  // { id: "net_hold_gated", label: "Net Hold Gated", description: "Net weekly hold with gate filtering" },
];

/* ─── Filter 2 (intraday entry) ───────────────────────────────── */

export type IntradayFilterConfig = {
  id: string;
  label: string;
  description: string;
  /** Whether this filter produces trade-level data in strategy_backtest_trades */
  hasTradeLog: boolean;
  /** P/L model: "weekly_hold" = open→close, "adr" = 0.25% per TP, losses at week close */
  plModel: "weekly_hold" | "adr";
  /** Matrix display behavior for this filter. */
  matrixUi: {
    showStatsBar: boolean;
    showTriggerState: boolean;
    showIntradayDetail: boolean;
    currentColumnLabel: string;
    historicalColumnLabel: string;
    detailTitle: string | null;
  };
};

export const INTRADAY_FILTERS: IntradayFilterConfig[] = [
  {
    id: "none",
    label: "None",
    description: "No intraday filter — pure weekly hold",
    hasTradeLog: false,
    plModel: "weekly_hold",
    matrixUi: {
      showStatsBar: false,
      showTriggerState: false,
      showIntradayDetail: false,
      currentColumnLabel: "Trades",
      historicalColumnLabel: "Trades",
      detailTitle: null,
    },
  },
  {
    id: "adr_pullback",
    label: "ADR Pullback",
    description: "Enter on 1 ADR pullback from weekly anchor",
    hasTradeLog: true,
    plModel: "adr",
    matrixUi: {
      showStatsBar: true,
      showTriggerState: true,
      showIntradayDetail: true,
      currentColumnLabel: "Trigger / Trades",
      historicalColumnLabel: "Trades",
      detailTitle: "Pullback Detail",
    },
  },
  // Future:
  // { id: "stoch_rsi", label: "Stoch RSI", description: "Stochastic RSI confirmation entry", hasTradeLog: true, plModel: "adr" },
  // { id: "adr_stoch", label: "ADR + Stoch", description: "ADR qualifies zone, stoch confirms entry", hasTradeLog: true, plModel: "adr" },
];

/* ─── Lookup helpers ──────────────────────────────────────────── */

export function getStrategy(id: string): StrategyConfig | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

export function getBasketFilter(id: string): BasketFilterConfig | undefined {
  return BASKET_FILTERS.find((f) => f.id === id);
}

export function getIntradayFilter(id: string): IntradayFilterConfig | undefined {
  return INTRADAY_FILTERS.find((f) => f.id === id);
}

export function resolveStrategyId(value: string | undefined | null): string {
  if (value && STRATEGIES.some((s) => s.id === value)) return value;
  return "dealer";
}

export function resolveBasketFilterId(value: string | undefined | null): string {
  if (value && BASKET_FILTERS.some((f) => f.id === value)) return value;
  return "weekly_hold";
}

export function resolveIntradayFilterId(value: string | undefined | null): string {
  if (value && INTRADAY_FILTERS.some((f) => f.id === value)) return value;
  return "none";
}

/* ─── Backward compatibility (old names → new) ────────────────── */

/** @deprecated Use STRATEGIES */
export const BIAS_SOURCES = STRATEGIES;
/** @deprecated Use StrategyConfig */
export type BiasSourceConfig = StrategyConfig;
/** @deprecated Use StrategyType */
export type BiasSourceType = StrategyType;
/** @deprecated Use BASKET_FILTERS */
export const STRATEGY_FILTERS = BASKET_FILTERS.map((f) => ({
  ...f,
  hasTradeLog: false,
}));
/** @deprecated Use BasketFilterConfig */
export type StrategyFilterConfig = BasketFilterConfig & { hasTradeLog: boolean };
/** @deprecated Use resolveStrategyId */
export const resolveBiasSourceId = resolveStrategyId;
/** @deprecated Use resolveBasketFilterId */
export const resolveStrategyFilterId = resolveBasketFilterId;
/** @deprecated Use getStrategy */
export const getBiasSource = getStrategy;
/** @deprecated Use getBasketFilter */
export const getStrategyFilter = getBasketFilter;
