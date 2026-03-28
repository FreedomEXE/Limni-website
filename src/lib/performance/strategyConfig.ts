/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyConfig.ts
 *
 * Description:
 * Config-driven bias source and strategy filter definitions for the
 * Performance section. Adding a new bias source or filter is just
 * adding an entry to the array — no page rewrites needed.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type BiasSourceType = "single" | "tiered" | "agreement" | "tandem";

export type BiasSourceConfig = {
  id: string;
  label: string;
  type: BiasSourceType;
  description: string;
  /** What the 3 performance cards represent for this source */
  cardBreakdown: "asset_class" | "tiers" | "per_model";
};

export type StrategyFilterConfig = {
  id: string;
  label: string;
  description: string;
  /** Whether this filter has trade-level data in strategy_backtest_trades */
  hasTradeLog: boolean;
};

export const BIAS_SOURCES: BiasSourceConfig[] = [
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

export const STRATEGY_FILTERS: StrategyFilterConfig[] = [
  {
    id: "weekly_hold",
    label: "Weekly Hold",
    description: "Enter at week open, exit at week close",
    hasTradeLog: false,
  },
  // Future filters — just add entries here:
  // { id: "adr_pullback", label: "ADR Pullback", description: "Enter on 1 ADR pullback from anchor", hasTradeLog: true },
  // { id: "adr_stoch", label: "ADR + Stoch", description: "ADR qualifies zone, stoch confirms entry", hasTradeLog: true },
  // { id: "adr_stoch_grid", label: "ADR + Stoch + Grid", description: "Stoch entry with grid DCA", hasTradeLog: true },
];

export function getBiasSource(id: string): BiasSourceConfig | undefined {
  return BIAS_SOURCES.find((s) => s.id === id);
}

export function getStrategyFilter(id: string): StrategyFilterConfig | undefined {
  return STRATEGY_FILTERS.find((f) => f.id === id);
}

export function resolveBiasSourceId(value: string | undefined | null): string {
  if (value && BIAS_SOURCES.some((s) => s.id === value)) return value;
  return "dealer"; // default
}

export function resolveStrategyFilterId(value: string | undefined | null): string {
  if (value && STRATEGY_FILTERS.some((f) => f.id === value)) return value;
  return "weekly_hold"; // default
}
