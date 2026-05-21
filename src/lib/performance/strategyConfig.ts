/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyConfig.ts
 *
 * Description:
 * Config-driven strategy definitions for Performance and Matrix sections.
 * Three selection levels:
 *   Signal Model — directional source system (Tandem, Tiered, Agreement, Selector)
 *   Execution    — entry/exit engine (Weekly Hold, ADR Grid)
 *   Risk Overlay — optional execution-compatible risk layer
 *
 * Adding a new option is just adding an entry to the array.
 * URL params: ?strategy=dealer&f1=weekly_hold&f2=none
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

/* ─── Strategy (directional bias source) ──────────────────────── */

import type { PerformanceModel } from "@/lib/performanceLab";

export type StrategyType = "single" | "tiered" | "agreement" | "tandem";

export type StrategyConfig = {
  id: string;
  label: string;
  type: StrategyType;
  description: string;
  /** What the performance cards represent for this source */
  cardBreakdown: "asset_class" | "tiers" | "per_model";
  /** For per-model strategies: which models fill the rendered slots. */
  models?: readonly PerformanceModel[];
  /** Optional display labels for model slots when a system reuses generic slots. */
  modelLabels?: Partial<Record<PerformanceModel, string>>;
};

export const SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID = "selector_sentiment_override";
export const SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID = "selector_sentiment_context_override";
export const SELECTOR_STRATEGY_ID = "selector";
export const SELECTOR_FRAG3_STRATEGY_ID = "selector_frag3";
export const SELECTOR_SELECTIVE_STRATEGY_ID = "selector_selective";
export const AGREE_3OF4_STRATEGY_ID = "agree_3of4";
export const AGREE_3PLUS_STRATEGY_ID = "agree_3plus";
export const TIERED_4W_STRATEGY_ID = "tiered_4w";

function normalizeStrategyLookupId(value: string | undefined | null): string | null {
  if (!value) return null;
  if (
    value === SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID
    || value === SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID
  ) {
    return SELECTOR_STRATEGY_ID;
  }
  if (value === "tiered_v3" || value === "tiered_3_nocomm") {
    return TIERED_4W_STRATEGY_ID;
  }
  if (value === "agree_2of3" || value === "agree_2of3_nocomm" || value === AGREE_3PLUS_STRATEGY_ID) {
    return AGREE_3OF4_STRATEGY_ID;
  }
  return value;
}

const CONSOLIDATED_SOURCE_STRATEGY_IDS = new Set(["dealer", "commercial", "sentiment", "strength"]);

export const STRATEGIES: StrategyConfig[] = [
  {
    id: "dealer",
    label: "Dealer",
    type: "single",
    description: "Follows COT dealer/intermediary net positioning. Dealers are the informed counterparty in futures flow, so persistent directional positioning can signal institutional bias. Direction is derived from net long versus short positioning and normalized over a 156-week lookback.",
    cardBreakdown: "asset_class",
  },
  {
    id: "sentiment",
    label: "Sentiment",
    type: "single",
    description: "Contrarian retail sentiment. When the retail crowd is heavily long, go short and vice versa. Uses aggregated retail net positioning normalized over a 52-week lookback. Strong standalone edge in FX and crypto where crowding tends to be a reliable fade signal.",
    cardBreakdown: "asset_class",
  },
  {
    id: "strength",
    label: "Strength",
    type: "single",
    description: "Multi-timeframe currency strength composite. Scores each pair across 1-hour, 4-hour, and 24-hour windows by measuring relative currency performance against peers. Each window votes LONG, SHORT, or NEUTRAL, producing a composite score from -3 to +3.",
    cardBreakdown: "asset_class",
  },
  {
    id: "commercial",
    label: "Commercial",
    type: "single",
    description: "Follows COT commercial/hedger net positioning. Commercials are producers and consumers hedging real exposure, so they tend to buy low and sell high at extremes. That makes them structurally early on reversals and weaker as a standalone weekly hold signal.",
    cardBreakdown: "asset_class",
  },
  {
    id: "tandem",
    label: "Tandem",
    type: "tandem",
    description: "Independent sleeve portfolio. Dealer, commercial, sentiment, and strength each run their own basket as separate sleeves with no voting or blending. It shows which sources are adding edge and which are dragging the portfolio.",
    cardBreakdown: "per_model",
    models: ["dealer", "commercial", "sentiment", "strength"],
  },
  {
    id: TIERED_4W_STRATEGY_ID,
    label: "Tiered",
    type: "tiered",
    description: "Selective weighted 4-source tiered system. Dealer, Strength, Sentiment, and Commercial contribute fixed coarse weights, and only Tier 1 plus Tier 2 weighted majorities are traded. Weak Tier 3 leans are skipped to keep the composite selective.",
    cardBreakdown: "tiers",
  },
  {
    id: AGREE_3OF4_STRATEGY_ID,
    label: "Agreement",
    type: "agreement",
    description: "Four-source agreement filter. Trades when 3 or more of Dealer, Commercial, Sentiment, and Strength align on direction. Ties are selectively resolved when the Sentiment+Strength side agrees, otherwise the pair is skipped.",
    cardBreakdown: "asset_class",
  },
  {
    id: AGREE_3PLUS_STRATEGY_ID,
    label: "Agreement 3+",
    type: "agreement",
    description: "Strict four-source agreement system. Trades only when at least 3 of Dealer, Commercial, Sentiment, and Strength align on direction. Ties are skipped.",
    cardBreakdown: "asset_class",
  },
  {
    id: SELECTOR_FRAG3_STRATEGY_ID,
    label: "Selector Base",
    type: "single",
    description: "Sentiment-primary weekly selector with strength tiebreak and commercial fragility filter. Follows sentiment as the base signal, allows a dealer override when sentiment is stretched and weakening, uses strength to resolve conflicts, and skips trades where commercial is simultaneously opposed, extreme, and building against.",
    cardBreakdown: "asset_class",
  },
  {
    id: SELECTOR_SELECTIVE_STRATEGY_ID,
    label: "Selector Selective",
    type: "single",
    description: "Highly selective selector sleeve. Keeps only the cleanest selector trades by skipping when commercial opposes the trade or commercial flow is building against it.",
    cardBreakdown: "asset_class",
  },
  {
    id: SELECTOR_STRATEGY_ID,
    label: "Selector",
    type: "tandem",
    description: "Consolidated selector view. Shows the base selector and the selective selector as separate sleeves side by side, while preserving a combined total for equity and basket review.",
    cardBreakdown: "per_model",
    models: ["dealer", "commercial"],
    modelLabels: {
      dealer: "Selector",
      commercial: "Selector Selective",
    },
  },
];

/* ─── Filter 1 (entry style) ──────────────────────────────────── */

export type EntryStyleConfig = {
  id: string;
  label: string;
  description: string;
  /** Whether this filter produces trade-level data in strategy_backtest_trades */
  hasTradeLog: boolean;
  /** P/L model: "weekly_hold" = open→close, "adr" = scanner TP, "adr_grid" = app-simulated close/rearm grid */
  plModel: "weekly_hold" | "adr" | "adr_grid";
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

export const ENTRY_STYLE_FILTERS: EntryStyleConfig[] = [
  {
    id: "weekly_hold",
    label: "Weekly Hold",
    description: "Enter at week open, exit at week close",
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
    id: "adr_grid",
    label: "ADR Grid",
    description: "0.20 ADR close-and-rearm grid",
    hasTradeLog: true,
    plModel: "adr_grid",
    matrixUi: {
      showStatsBar: true,
      showTriggerState: true,
      showIntradayDetail: true,
      currentColumnLabel: "Grid / Fills",
      historicalColumnLabel: "Fills",
      detailTitle: "Grid Detail",
    },
  },
];

/* ─── Risk Overlay ────────────────────────────────────────────── */

export type RiskOverlayConfig = {
  id: string;
  label: string;
  description: string;
  /** Which entry styles this overlay applies to. "all" = universal, string[] = specific IDs only. */
  appliesToEntryStyles: "all" | readonly string[];
};

export const RISK_OVERLAYS: RiskOverlayConfig[] = [
  {
    id: "none",
    label: "None",
    description: "No additional risk overlay",
    appliesToEntryStyles: "all",
  },
  {
    id: "pair_fill_cap",
    label: "Pair Fill Cap",
    description: "Max 3 active grid fills per pair. Prevents deep averaging into losing positions.",
    appliesToEntryStyles: ["adr_grid"],
  },
];

const LEGACY_RISK_OVERLAYS: RiskOverlayConfig[] = [
  {
    id: "none",
    label: "None",
    description: "No overlay — retained only for backward compatibility",
    appliesToEntryStyles: "all",
  },
  {
    id: "adr_normalized",
    label: "ADR Normalized",
    description: "Canonical risk layer retained only for backward compatibility",
    appliesToEntryStyles: "all",
  },
  {
    id: "exposure_cap",
    label: "Exposure Cap",
    description: "Legacy overlay — replaced by Pair Fill Cap",
    appliesToEntryStyles: ["adr_grid"],
  },
];

function isKnownId<T extends { id: string }>(items: readonly T[], value: string | undefined | null): value is string {
  return Boolean(value) && items.some((item) => item.id === value);
}

export function normalizeFilterSelection(value: {
  f1?: string | null;
  f2?: string | null;
}) {
  const rawF1 = value.f1 ?? null;
  const rawF2 = value.f2 ?? null;
  const legacyEntryStyleId = isKnownId(ENTRY_STYLE_FILTERS, rawF2) ? rawF2 : null;
  const entryStyleId = legacyEntryStyleId
    ?? (isKnownId(ENTRY_STYLE_FILTERS, rawF1) ? rawF1 : "adr_grid");
  const mappedF2 = rawF2 === "exposure_cap" ? "pair_fill_cap" : rawF2;
  const overlay = isKnownId(RISK_OVERLAYS, mappedF2) ? getRiskOverlay(mappedF2) : undefined;
  const defaultOverlayId = entryStyleId === "adr_grid" ? "pair_fill_cap" : "none";
  const f2 = overlay && isRiskOverlayValidForEntryStyle(overlay, entryStyleId)
    ? overlay.id
    : defaultOverlayId;
  return {
    f1: entryStyleId,
    f2,
  };
}

/* ─── Lookup helpers ──────────────────────────────────────────── */

export function getStrategy(id: string): StrategyConfig | undefined {
  const normalized = normalizeStrategyLookupId(id);
  if (!normalized) return undefined;
  return STRATEGIES.find((s) => s.id === normalized);
}

export function getEntryStyle(id: string): EntryStyleConfig | undefined {
  return ENTRY_STYLE_FILTERS.find((f) => f.id === id);
}

export function isRiskOverlayValidForEntryStyle(
  overlay: RiskOverlayConfig | undefined,
  entryStyleId: string,
): boolean {
  if (!overlay || overlay.id === "none") return true;
  if (overlay.appliesToEntryStyles === "all") return true;
  return overlay.appliesToEntryStyles.includes(entryStyleId);
}

export function getRiskOverlay(id: string): RiskOverlayConfig | undefined {
  return RISK_OVERLAYS.find((f) => f.id === id)
    ?? LEGACY_RISK_OVERLAYS.find((f) => f.id === id);
}

export function resolveStrategyId(value: string | undefined | null): string {
  const normalized = normalizeStrategyLookupId(value);
  if (normalized === SELECTOR_FRAG3_STRATEGY_ID || normalized === SELECTOR_SELECTIVE_STRATEGY_ID) {
    return SELECTOR_STRATEGY_ID;
  }
  if (normalized && CONSOLIDATED_SOURCE_STRATEGY_IDS.has(normalized)) {
    return "tandem";
  }
  if (normalized && STRATEGIES.some((s) => s.id === normalized)) return normalized;
  return "tandem";
}

export function resolveEntryStyleId(value: string | undefined | null): string {
  if (value && ENTRY_STYLE_FILTERS.some((f) => f.id === value)) return value;
  return "adr_grid";
}

export function resolveRiskOverlayId(value: string | undefined | null): string {
  if (value && RISK_OVERLAYS.some((f) => f.id === value)) return value;
  return "none";
}

/* ─── Backward compatibility (old names → new) ────────────────── */

/** @deprecated Use STRATEGIES */
export const BIAS_SOURCES = STRATEGIES;
/** @deprecated Use StrategyConfig */
export type BiasSourceConfig = StrategyConfig;
/** @deprecated Use StrategyType */
export type BiasSourceType = StrategyType;
/** @deprecated Use ENTRY_STYLE_FILTERS */
export const STRATEGY_FILTERS = ENTRY_STYLE_FILTERS.map((f) => ({
  ...f,
}));
/** @deprecated Use EntryStyleConfig */
export type StrategyFilterConfig = EntryStyleConfig;
/** @deprecated Use resolveStrategyId */
export const resolveBiasSourceId = resolveStrategyId;
/** @deprecated Use resolveEntryStyleId */
export const resolveStrategyFilterId = resolveEntryStyleId;
/** @deprecated Use getStrategy */
export const getBiasSource = getStrategy;
/** @deprecated Use getEntryStyle */
export const getStrategyFilter = getEntryStyle;
/** @deprecated Use ENTRY_STYLE_FILTERS */
export const BASKET_FILTERS = ENTRY_STYLE_FILTERS;
/** @deprecated Use EntryStyleConfig */
export type BasketFilterConfig = EntryStyleConfig;
/** @deprecated Use getEntryStyle */
export const getBasketFilter = getEntryStyle;
/** @deprecated Use resolveEntryStyleId */
export const resolveBasketFilterId = resolveEntryStyleId;
/** @deprecated Use ENTRY_STYLE_FILTERS */
export const INTRADAY_FILTERS = ENTRY_STYLE_FILTERS;
/** @deprecated Use EntryStyleConfig */
export type IntradayFilterConfig = EntryStyleConfig;
/** @deprecated Use getEntryStyle */
export const getIntradayFilter = getEntryStyle;
/** @deprecated Use resolveEntryStyleId */
export const resolveIntradayFilterId = resolveEntryStyleId;
/** @deprecated Use RiskOverlayConfig */
export type StrengthGateConfig = RiskOverlayConfig;
/** @deprecated Use RISK_OVERLAYS */
export const STRENGTH_GATES = RISK_OVERLAYS;
/** @deprecated Use getRiskOverlay */
export const getStrengthGate = getRiskOverlay;
/** @deprecated Use resolveRiskOverlayId */
export const resolveStrengthGateId = resolveRiskOverlayId;
