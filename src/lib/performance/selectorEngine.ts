/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: selectorEngine.ts
 *
 * Description:
 * Weekly bias context selector for the app strategy
 * "selector_sentiment_override" (research alias:
 * "selector_sentiment_context_override").
 *
 * Sits on TOP of basketSource as a context-scoring layer.
 * Consumes dealer, commercial, and sentiment base signals, then applies:
 *   - COT extremity indexing (min-max over 156-week lookback)
 *   - Sentiment extremity indexing (min-max over 52-week lookback)
 *   - Strengthening / weakening detection (current vs previous week)
 *   - Policy logic: follow sentiment unless stretched+weakening → COT override
 *
 * Returns a DirectionMap in the same format as other resolvers in weeklyHoldEngine.
 *
 * Research source: scripts/backtest-weekly-bias-context-selector.ts
 * Spec: docs/bots/WEEKLY_BIAS_CONTEXT_ENGINE_SPEC_2026-03-29.md
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { query } from "@/lib/db";
import { readSnapshotHistory } from "@/lib/cotStore";
import { resolveMarketBias, type BiasMode } from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS, type PairDefinition } from "@/lib/cotPairs";
import type { CotSnapshot } from "@/lib/cotTypes";
import type { AssetClass } from "@/lib/cotMarkets";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "@/lib/pairReturns";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import { weekOpenFromCotReportDate } from "@/lib/performance/gateEvaluation";
import { readWeeklyPairStrengths, type WeeklyPairStrength } from "@/lib/strength/weeklyStrength";

// ── Config ─────────────────────────────────────────────────────────

const COT_LOOKBACK_WEEKS = 156;
const SENTIMENT_LOOKBACK_WEEKS = 52;
const EXTREME_THRESHOLD = 0.8;
const COMMERCIAL_CAUTION_THRESHOLD = 0.85;
const SELECTOR_ENGINE_CACHE_TTL_MS = Number(
  process.env.SELECTOR_ENGINE_CACHE_TTL_MS ?? "300000",
);
export const SELECTOR_ENGINE_VERSION = "selector-engine-v6";

// ── Types ──────────────────────────────────────────────────────────

export type Direction = "LONG" | "SHORT";
export type SelectorDirectionalState = Direction | "NEUTRAL";

type CotSideDebug = {
  series: number[];
  current: number;
  minMaxIndex: number;
  low: number;
  high: number;
  crossesZero: boolean;
  maxAbs: number;
  score: number;
  normalization: "minmax" | "one_sided_abs";
};

type CotMetricsDebug = {
  type: "cot";
  mode: BiasMode;
  pairType: AssetClass;
  base: CotSideDebug;
  quote: CotSideDebug | null;
};

type SentimentMetricsDebug = {
  type: "sentiment";
  lookbackSeries: number[];
  currentAggNet: number;
  minMaxIndex: number;
  centered: number;
  low: number | null;
  high: number | null;
  zeroVariance: boolean;
  normalization: "minmax" | "thin_data_raw_contrarian";
};

export type SourceMetrics = {
  score: number;       // -1 to +1, positive = LONG, negative = SHORT
  extremity: number;   // 0 to 1, how stretched the source is
  debug?: CotMetricsDebug | SentimentMetricsDebug;
};

export type PairContext = {
  pair: string;
  assetClass: AssetClass;
  dealer: SourceMetrics;
  commercial: SourceMetrics;
  sentiment: SourceMetrics;
  strength: SelectorStrengthContext;
};

export type CotHistoryPoint = {
  weekOpenUtc: string;
  weekOpenMs: number;
  snapshot: CotSnapshot;
};

export type DirectionEntry = {
  direction: Direction;
  source: string;
  tier: number | null;
  assetClass: string;
};
export type DirectionMap = Map<string, DirectionEntry>;

export type SelectorStrengthContext = {
  compositeScore: number;
  compositeDirection: SelectorDirectionalState;
  availableWindows: number;
  latestSnapshotUtc: string | null;
};

export type SelectorStrengthRelation =
  | "strong_agree"
  | "agree"
  | "neutral"
  | "disagree"
  | "strong_disagree";

export type SelectorStrengthBranch =
  | "strength_confirmed"
  | "strength_neutral"
  | "strength_disagreed_but_not_blocking"
  | "strength_veto_passed"
  | "strength_veto_neutral"
  | "strength_veto_blocked"
  | "strength_tiebreak_sentiment"
  | "strength_tiebreak_dealer"
  | "strength_tiebreak_neutral_fallback"
  | "strength_tiebreak_ambiguous_fallback"
  | "strength_tiebreak_no_conflict_fallback";

export type SelectorCommercialBranch =
  | "commercial_no_caution"
  | "commercial_caution_flag"
  | "commercial_caution_skip"
  | "commercial_strength_disagree_skip";

export type SelectorVariant =
  | "strength_confirmation"
  | "strength_veto"
  | "strength_tiebreak"
  | "commercial_audit_only"
  | "commercial_caution_skip"
  | "commercial_strength_disagree_skip";

export type SelectorAuditEntry = {
  weekOpenUtc: string;
  pair: string;
  assetClass: AssetClass;
  selectorVariant: SelectorVariant;
  sentimentScore: number;
  sentimentDirection: SelectorDirectionalState;
  dealerScore: number;
  dealerDirection: SelectorDirectionalState;
  commercialScore: number;
  commercialDirection: SelectorDirectionalState;
  strengthCompositeScore: number;
  strengthCompositeDirection: SelectorDirectionalState;
  strengthAvailableWindows: number;
  strengthLatestSnapshotUtc: string | null;
  strengthRelationToProposed: SelectorStrengthRelation;
  baseSelectorBranch: SelectorPolicyDecision["branch"];
  strengthBranch: SelectorStrengthBranch;
  commercialExtremity: number;
  commercialCaution: boolean;
  commercialBranch: SelectorCommercialBranch;
  baseDirection: Direction;
  finalDirection: SelectorDirectionalState;
  finalScore: number;
};

export type SelectorAuditWeek = {
  weekOpenUtc: string;
  variant: SelectorVariant;
  entries: SelectorAuditEntry[];
  directions: DirectionMap;
};

// ── Helpers ────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function minMaxIndex(series: number[], current: number) {
  if (!series.length) return 50;
  const low = Math.min(...series);
  const high = Math.max(...series);
  if (high === low) return 50;
  return ((current - low) / (high - low)) * 100;
}

function scoreToDirection(score: number): Direction {
  return score >= 0 ? "LONG" : "SHORT";
}

function scoreToDirectionalState(score: number): SelectorDirectionalState {
  return Math.abs(score) <= 0.000001 ? "NEUTRAL" : scoreToDirection(score);
}

function getSelectorEngineCacheTtlMs() {
  return Number.isFinite(SELECTOR_ENGINE_CACHE_TTL_MS) && SELECTOR_ENGINE_CACHE_TTL_MS >= 0
    ? SELECTOR_ENGINE_CACHE_TTL_MS
    : 300000;
}

function fallbackDirection(
  scores: number[],
  previousWeekReturn: number | null,
): { direction: Direction; score: number } {
  for (const score of scores) {
    if (Math.abs(score) > 0.000001) {
      return { direction: scoreToDirection(score), score };
    }
  }
  if (previousWeekReturn !== null && Number.isFinite(previousWeekReturn)) {
    return {
      direction: previousWeekReturn >= 0 ? "LONG" : "SHORT",
      score: previousWeekReturn >= 0 ? 0.0001 : -0.0001,
    };
  }
  return { direction: "LONG", score: 0.0001 };
}

function toStrengthContext(
  row: WeeklyPairStrength | undefined,
  pair: string,
  weekOpenUtc: string,
  options?: { requireStrength?: boolean },
): SelectorStrengthContext {
  if (!row && options?.requireStrength) {
    throw new Error(`Missing strength context for ${pair} on ${weekOpenUtc}`);
  }
  if (!row) {
    return {
      compositeScore: 0,
      compositeDirection: "NEUTRAL",
      availableWindows: 0,
      latestSnapshotUtc: null,
    };
  }
  return {
    compositeScore: row.compositeScore,
    compositeDirection: row.compositeDirection,
    availableWindows: row.availableWindows,
    latestSnapshotUtc: row.latestSnapshotUtc,
  };
}

function classifyStrengthRelation(
  strength: SelectorStrengthContext,
  proposedDirection: Direction,
): SelectorStrengthRelation {
  const score = strength.compositeScore;
  if (score === 0) return "neutral";

  const sameSign =
    (proposedDirection === "LONG" && score > 0)
    || (proposedDirection === "SHORT" && score < 0);

  if (sameSign) {
    return Math.abs(score) >= 2 ? "strong_agree" : "agree";
  }
  return Math.abs(score) >= 2 ? "strong_disagree" : "disagree";
}

function strengthBranchFromRelation(relation: SelectorStrengthRelation): SelectorStrengthBranch {
  if (relation === "strong_agree" || relation === "agree") {
    return "strength_confirmed";
  }
  if (relation === "neutral") {
    return "strength_neutral";
  }
  return "strength_disagreed_but_not_blocking";
}

function directionMatchesStrength(
  direction: SelectorDirectionalState,
  strength: SelectorStrengthContext,
): boolean {
  if (direction === "NEUTRAL" || strength.compositeDirection === "NEUTRAL") {
    return false;
  }
  return direction === strength.compositeDirection;
}

function classifyCommercialCaution(
  commercial: SourceMetrics,
  finalDirection: SelectorDirectionalState,
): { commercialCaution: boolean; commercialBranch: SelectorCommercialBranch } {
  const commercialDirection = scoreToDirectionalState(commercial.score);
  const commercialCaution =
    finalDirection !== "NEUTRAL"
    && commercial.extremity >= COMMERCIAL_CAUTION_THRESHOLD
    && commercialDirection !== "NEUTRAL"
    && commercialDirection !== finalDirection;

  return {
    commercialCaution,
    commercialBranch: commercialCaution ? "commercial_caution_flag" : "commercial_no_caution",
  };
}

// ── COT Data Loading ───────────────────────────────────────────────

export async function loadCotHistory(): Promise<Map<AssetClass, CotHistoryPoint[]>> {
  return getOrSetRuntimeCache(
    `selectorEngine:cotHistory:${SELECTOR_ENGINE_VERSION}`,
    getSelectorEngineCacheTtlMs(),
    async () => {
      const assetClasses: AssetClass[] = ["fx", "indices", "commodities", "crypto"];
      const results = await Promise.all(
        assetClasses.map(async (assetClass) => {
          const rows = await readSnapshotHistory(assetClass, 260);
          const history = rows
            .map((snapshot) => {
              const weekOpenUtc = weekOpenFromCotReportDate(snapshot.report_date);
              if (!weekOpenUtc) return null;
              const canonical = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
              const weekOpenMs = DateTime.fromISO(canonical, { zone: "utc" }).toMillis();
              if (!Number.isFinite(weekOpenMs)) return null;
              return { weekOpenUtc: canonical, weekOpenMs, snapshot } satisfies CotHistoryPoint;
            })
            .filter((row): row is CotHistoryPoint => row !== null)
            .sort((a, b) => a.weekOpenMs - b.weekOpenMs);
          return [assetClass, history] as const;
        }),
      );
      return new Map(results);
    },
  );
}

// ── Sentiment Data Loading ─────────────────────────────────────────

export type SentimentRow = { ts: number; aggNet: number };

const SENTIMENT_TIMESTAMP_ZONE = "America/New_York";

function parseUtcSqlTimestampToMillis(value: string): number | null {
  const parsed = DateTime.fromSQL(value, { zone: SENTIMENT_TIMESTAMP_ZONE });
  return parsed.isValid ? parsed.toMillis() : null;
}

export async function loadSentimentHistory(): Promise<Map<string, SentimentRow[]>> {
  return getOrSetRuntimeCache(
    `selectorEngine:sentimentHistory:${SELECTOR_ENGINE_VERSION}`,
    getSelectorEngineCacheTtlMs(),
    async () => {
      const rows = await query<{ symbol: string; timestamp_utc: string; agg_net: string | number }>(
        `SELECT symbol, timestamp_utc::text AS timestamp_utc, agg_net
           FROM sentiment_aggregates
          ORDER BY symbol ASC, timestamp_utc ASC`,
        [],
      );
      const bySymbol = new Map<string, SentimentRow[]>();
      for (const row of rows) {
        const timestampMs = parseUtcSqlTimestampToMillis(row.timestamp_utc);
        if (timestampMs === null) {
          continue;
        }
        const symbol = row.symbol.toUpperCase();
        const list = bySymbol.get(symbol) ?? [];
        list.push({ ts: timestampMs, aggNet: Number(row.agg_net) });
        bySymbol.set(symbol, list);
      }
      return bySymbol;
    },
  );
}

export function latestSentimentValue(rows: SentimentRow[], targetTs: number): number {
  let bestIndex = -1;
  let left = 0;
  let right = rows.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (rows[mid]!.ts <= targetTs) {
      bestIndex = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return bestIndex;
}

// ── Metrics Computation ────────────────────────────────────────────

function computeCotSideDebug(series: number[], current: number): CotSideDebug {
  const low = Math.min(...series);
  const high = Math.max(...series);
  const minMax = minMaxIndex(series, current);
  const crossesZero = low < 0 && high > 0;
  const maxAbs = Math.max(Math.abs(low), Math.abs(high));
  const score = crossesZero
    ? clamp((minMax - 50) / 50, -1, 1)
    : maxAbs > 0
      ? clamp(current / maxAbs, -1, 1)
      : 0;

  return {
    series,
    current,
    minMaxIndex: minMax,
    low,
    high,
    crossesZero,
    maxAbs,
    score,
    normalization: crossesZero ? "minmax" : "one_sided_abs",
  };
}

export function computeCotMetrics(
  pairDef: PairDefinition & { assetClass: AssetClass },
  weekOpenUtc: string,
  mode: BiasMode,
  cotHistory: Map<AssetClass, CotHistoryPoint[]>,
): SourceMetrics {
  const history = cotHistory.get(pairDef.assetClass) ?? [];
  const targetMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  if (!Number.isFinite(targetMs) || history.length === 0) {
    return { score: 0, extremity: 0 };
  }

  let snapshotIndex = -1;
  for (let i = 0; i < history.length; i++) {
    if (history[i]!.weekOpenMs <= targetMs) snapshotIndex = i;
    else break;
  }
  if (snapshotIndex < 0) return { score: 0, extremity: 0 };

  const slice = history.slice(Math.max(0, snapshotIndex + 1 - COT_LOOKBACK_WEEKS), snapshotIndex + 1);
  const baseSeries = slice
    .map((row) => resolveMarketBias(row.snapshot.currencies[pairDef.base]!, mode)?.net ?? null)
    .filter((v): v is number => v !== null);

  if (baseSeries.length === 0) return { score: 0, extremity: 0 };

  const baseCurrent = baseSeries[baseSeries.length - 1]!;
  const baseDebug = computeCotSideDebug(baseSeries, baseCurrent);

  if (pairDef.assetClass === "fx") {
    const quoteSeries = slice
      .map((row) => resolveMarketBias(row.snapshot.currencies[pairDef.quote]!, mode)?.net ?? null)
      .filter((v): v is number => v !== null);

    if (quoteSeries.length === 0) {
      return {
        score: baseDebug.score,
        extremity: Math.abs(baseDebug.score),
        debug: {
          type: "cot",
          mode,
          pairType: pairDef.assetClass,
          base: baseDebug,
          quote: null,
        },
      };
    }

    const quoteCurrent = quoteSeries[quoteSeries.length - 1]!;
    const quoteDebug = computeCotSideDebug(quoteSeries, quoteCurrent);
    const score = clamp(baseDebug.score - quoteDebug.score, -1, 1);
    return {
      score,
      extremity: Math.max(Math.abs(baseDebug.score), Math.abs(quoteDebug.score)),
      debug: {
        type: "cot",
        mode,
        pairType: pairDef.assetClass,
        base: baseDebug,
        quote: quoteDebug,
      },
    };
  }

  return {
    score: baseDebug.score,
    extremity: Math.abs(baseDebug.score),
    debug: {
      type: "cot",
      mode,
      pairType: pairDef.assetClass,
      base: baseDebug,
      quote: null,
    },
  };
}

export function computeSentimentMetrics(
  pair: string,
  weekOpenUtc: string,
  sentimentBySymbol: Map<string, SentimentRow[]>,
  closedWeeksForLookback: string[],
): SourceMetrics {
  const history = sentimentBySymbol.get(pair.toUpperCase()) ?? [];
  if (history.length === 0) return { score: 0, extremity: 0 };

  const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const currentIndex = latestSentimentValue(history, weekMs);
  if (currentIndex < 0) return { score: 0, extremity: 0 };

  const selectedWeeklyValues: number[] = [];
  for (const historicalWeek of closedWeeksForLookback) {
    if (Date.parse(historicalWeek) > Date.parse(weekOpenUtc)) break;
    const historicalWeekMs = DateTime.fromISO(historicalWeek, { zone: "utc" }).toMillis();
    const idx = latestSentimentValue(history, historicalWeekMs);
    if (idx >= 0) selectedWeeklyValues.push(history[idx]!.aggNet);
  }

  const lookbackSeries = selectedWeeklyValues.slice(-SENTIMENT_LOOKBACK_WEEKS);
  const currentAggNet = history[currentIndex]!.aggNet;
  const index = minMaxIndex(lookbackSeries, currentAggNet);
  const centered = clamp((index - 50) / 50, -1, 1);
  const low = lookbackSeries.length > 0 ? Math.min(...lookbackSeries) : null;
  const high = lookbackSeries.length > 0 ? Math.max(...lookbackSeries) : null;
  const zeroVariance = low === null || high === null || Math.abs(high - low) < 0.000001;

  if (zeroVariance && Math.abs(currentAggNet) > 0.001) {
    const rawContrarian = currentAggNet > 0 ? -1 : 1;
    const moderateScore = rawContrarian * 0.3;
    return {
      score: moderateScore,
      extremity: 0.3,
      debug: {
        type: "sentiment",
        lookbackSeries,
        currentAggNet,
        minMaxIndex: index,
        centered,
        low,
        high,
        zeroVariance,
        normalization: "thin_data_raw_contrarian",
      },
    };
  }

  return {
    score: -centered, // contrarian: crowded long → SHORT
    extremity: Math.abs(centered),
    debug: {
      type: "sentiment",
      lookbackSeries,
      currentAggNet,
      minMaxIndex: index,
      centered,
      low,
      high,
      zeroVariance,
      normalization: "minmax",
    },
  };
}

// ── Context Builder ────────────────────────────────────────────────

export type PairDefWithAsset = PairDefinition & { assetClass: AssetClass };

export function buildPairUniverse(): PairDefWithAsset[] {
  const universe: PairDefWithAsset[] = [];
  for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
    for (const pair of PAIRS_BY_ASSET_CLASS[assetClass]) {
      universe.push({ ...pair, assetClass });
    }
  }
  return universe;
}

export async function buildContextForWeek(
  weekOpenUtc: string,
  universe: PairDefWithAsset[],
  cotHistory: Map<AssetClass, CotHistoryPoint[]>,
  sentimentBySymbol: Map<string, SentimentRow[]>,
  closedWeeksForLookback: string[],
  options?: { requireStrength?: boolean },
): Promise<Map<string, PairContext>> {
  const contexts = new Map<string, PairContext>();
  const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
  const strengthByPair = new Map(
    strengthRows.map((row) => [row.pair.toUpperCase(), row]),
  );
  for (const pairDef of universe) {
    const dealer = computeCotMetrics(pairDef, weekOpenUtc, "dealer", cotHistory);
    const commercial = computeCotMetrics(pairDef, weekOpenUtc, "commercial", cotHistory);
    const sentiment = computeSentimentMetrics(pairDef.pair, weekOpenUtc, sentimentBySymbol, closedWeeksForLookback);
    contexts.set(pairDef.pair, {
      pair: pairDef.pair,
      assetClass: pairDef.assetClass,
      dealer,
      commercial,
      sentiment,
      strength: toStrengthContext(
        strengthByPair.get(pairDef.pair.toUpperCase()),
        pairDef.pair,
        weekOpenUtc,
        options,
      ),
    });
  }
  return contexts;
}

// ── Policy: Sentiment Context Override ──────────────────────────────

export type SelectorPolicyDecision = {
  direction: Direction;
  score: number;
  branch:
    | "follow_sentiment"
    | "follow_sentiment_strengthening"
    | "override_cot_agreement"
    | "override_cot_less_stretched"
    | "fallback_sentiment"
    | "fallback_chain";
};

export function policySentimentContextOverride(
  context: PairContext,
  previousContext: PairContext | null,
  previousWeekReturn: number | null,
): SelectorPolicyDecision {
  const sentimentPrev = previousContext?.sentiment ?? null;

  const sentimentStrengthening =
    sentimentPrev !== null &&
    Math.sign(context.sentiment.score) === Math.sign(sentimentPrev.score) &&
    Math.abs(context.sentiment.score) > Math.abs(sentimentPrev.score) + 0.000001;

  const sentimentWeakening =
    sentimentPrev !== null &&
    Math.sign(context.sentiment.score) === Math.sign(sentimentPrev.score) &&
    Math.abs(context.sentiment.score) + 0.000001 < Math.abs(sentimentPrev.score);

  // If sentiment has a signal
  if (Math.abs(context.sentiment.score) > 0.000001) {
    // Not stretched, or stretched but still strengthening → follow sentiment
    if (context.sentiment.extremity < EXTREME_THRESHOLD || sentimentStrengthening) {
      return {
        direction: scoreToDirection(context.sentiment.score),
        score: context.sentiment.score,
        branch: sentimentStrengthening ? "follow_sentiment_strengthening" : "follow_sentiment",
      };
    }

    // Stretched AND weakening (or very extreme ≥0.9) → try COT override
    if (sentimentWeakening || context.sentiment.extremity >= 0.9) {
      const dealerDir = scoreToDirection(context.dealer.score);
      const commercialDir = scoreToDirection(context.commercial.score);

      // If dealer + commercial agree → use their combined direction
      if (
        Math.abs(context.dealer.score) > 0.000001 &&
        Math.abs(context.commercial.score) > 0.000001 &&
        dealerDir === commercialDir
      ) {
        return {
          direction: dealerDir,
          score: context.dealer.score + context.commercial.score,
          branch: "override_cot_agreement",
        };
      }

      // Otherwise use the less-stretched COT source
      const cotCandidates = [
        { score: context.dealer.score, extremity: context.dealer.extremity },
        { score: context.commercial.score, extremity: context.commercial.extremity },
      ]
        .filter((c) => Math.abs(c.score) > 0.000001)
        .sort((a, b) => a.extremity - b.extremity);

      if (cotCandidates.length > 0) {
        return {
          direction: scoreToDirection(cotCandidates[0]!.score),
          score: cotCandidates[0]!.score,
          branch: "override_cot_less_stretched",
        };
      }
    }

    // Fallback: still follow sentiment
    return {
      direction: scoreToDirection(context.sentiment.score),
      score: context.sentiment.score,
      branch: "fallback_sentiment",
    };
  }

  // No sentiment signal → fallback chain: dealer → commercial → previous week → LONG
  const fallback = fallbackDirection(
    [context.dealer.score, context.commercial.score],
    previousWeekReturn,
  );
  return { ...fallback, branch: "fallback_chain" };
}

function applyStrengthConfirmationVariant(
  weekOpenUtc: string,
  context: PairContext,
  baseDecision: SelectorPolicyDecision,
): SelectorAuditEntry {
  const strengthRelationToProposed = classifyStrengthRelation(context.strength, baseDecision.direction);
  const strengthBranch = strengthBranchFromRelation(strengthRelationToProposed);
  const { commercialCaution, commercialBranch } = classifyCommercialCaution(
    context.commercial,
    baseDecision.direction,
  );

  return {
    weekOpenUtc,
    pair: context.pair,
    assetClass: context.assetClass,
    selectorVariant: "strength_confirmation",
    sentimentScore: context.sentiment.score,
    sentimentDirection: scoreToDirectionalState(context.sentiment.score),
    dealerScore: context.dealer.score,
    dealerDirection: scoreToDirectionalState(context.dealer.score),
    commercialScore: context.commercial.score,
    commercialDirection: scoreToDirectionalState(context.commercial.score),
    strengthCompositeScore: context.strength.compositeScore,
    strengthCompositeDirection: context.strength.compositeDirection,
    strengthAvailableWindows: context.strength.availableWindows,
    strengthLatestSnapshotUtc: context.strength.latestSnapshotUtc,
    strengthRelationToProposed,
    baseSelectorBranch: baseDecision.branch,
    strengthBranch,
    commercialExtremity: context.commercial.extremity,
    commercialCaution,
    commercialBranch,
    baseDirection: baseDecision.direction,
    finalDirection: baseDecision.direction,
    finalScore: baseDecision.score,
  };
}

function applyStrengthVetoVariant(
  weekOpenUtc: string,
  context: PairContext,
  baseDecision: SelectorPolicyDecision,
): SelectorAuditEntry {
  const strengthRelationToProposed = classifyStrengthRelation(context.strength, baseDecision.direction);
  const blocked = strengthRelationToProposed === "strong_disagree";
  const finalDirection: SelectorDirectionalState = blocked ? "NEUTRAL" : baseDecision.direction;
  const strengthBranch: SelectorStrengthBranch =
    strengthRelationToProposed === "neutral"
      ? "strength_veto_neutral"
      : blocked
        ? "strength_veto_blocked"
        : "strength_veto_passed";
  const { commercialCaution, commercialBranch } = classifyCommercialCaution(
    context.commercial,
    finalDirection,
  );

  return {
    weekOpenUtc,
    pair: context.pair,
    assetClass: context.assetClass,
    selectorVariant: "strength_veto",
    sentimentScore: context.sentiment.score,
    sentimentDirection: scoreToDirectionalState(context.sentiment.score),
    dealerScore: context.dealer.score,
    dealerDirection: scoreToDirectionalState(context.dealer.score),
    commercialScore: context.commercial.score,
    commercialDirection: scoreToDirectionalState(context.commercial.score),
    strengthCompositeScore: context.strength.compositeScore,
    strengthCompositeDirection: context.strength.compositeDirection,
    strengthAvailableWindows: context.strength.availableWindows,
    strengthLatestSnapshotUtc: context.strength.latestSnapshotUtc,
    strengthRelationToProposed,
    baseSelectorBranch: baseDecision.branch,
    strengthBranch,
    commercialExtremity: context.commercial.extremity,
    commercialCaution,
    commercialBranch,
    baseDirection: baseDecision.direction,
    finalDirection,
    finalScore: blocked ? 0 : baseDecision.score,
  };
}

function applyStrengthTiebreakVariant(
  weekOpenUtc: string,
  context: PairContext,
  baseDecision: SelectorPolicyDecision,
): SelectorAuditEntry {
  const sentimentDirection = scoreToDirectionalState(context.sentiment.score);
  const dealerDirection = scoreToDirectionalState(context.dealer.score);
  const strengthRelationToProposed = classifyStrengthRelation(context.strength, baseDecision.direction);

  let finalDirection: SelectorDirectionalState = baseDecision.direction;
  let finalScore = baseDecision.score;
  let strengthBranch: SelectorStrengthBranch = "strength_tiebreak_no_conflict_fallback";

  const hasConflict =
    sentimentDirection !== "NEUTRAL"
    && dealerDirection !== "NEUTRAL"
    && sentimentDirection !== dealerDirection;

  if (hasConflict) {
    const strengthNeutral = context.strength.compositeDirection === "NEUTRAL";
    const supportsSentiment = directionMatchesStrength(sentimentDirection, context.strength);
    const supportsDealer = directionMatchesStrength(dealerDirection, context.strength);

    if (supportsSentiment && !supportsDealer) {
      finalDirection = sentimentDirection;
      finalScore = context.sentiment.score;
      strengthBranch = "strength_tiebreak_sentiment";
    } else if (supportsDealer && !supportsSentiment) {
      finalDirection = dealerDirection;
      finalScore = context.dealer.score;
      strengthBranch = "strength_tiebreak_dealer";
    } else if (strengthNeutral) {
      strengthBranch = "strength_tiebreak_neutral_fallback";
    } else {
      strengthBranch = "strength_tiebreak_ambiguous_fallback";
    }
  }
  const { commercialCaution, commercialBranch } = classifyCommercialCaution(
    context.commercial,
    finalDirection,
  );

  return {
    weekOpenUtc,
    pair: context.pair,
    assetClass: context.assetClass,
    selectorVariant: "strength_tiebreak",
    sentimentScore: context.sentiment.score,
    sentimentDirection,
    dealerScore: context.dealer.score,
    dealerDirection,
    commercialScore: context.commercial.score,
    commercialDirection: scoreToDirectionalState(context.commercial.score),
    strengthCompositeScore: context.strength.compositeScore,
    strengthCompositeDirection: context.strength.compositeDirection,
    strengthAvailableWindows: context.strength.availableWindows,
    strengthLatestSnapshotUtc: context.strength.latestSnapshotUtc,
    strengthRelationToProposed,
    baseSelectorBranch: baseDecision.branch,
    strengthBranch,
    commercialExtremity: context.commercial.extremity,
    commercialCaution,
    commercialBranch,
    baseDirection: baseDecision.direction,
    finalDirection,
    finalScore,
  };
}

function applyCommercialAuditOnlyVariant(
  weekOpenUtc: string,
  context: PairContext,
  baseDecision: SelectorPolicyDecision,
): SelectorAuditEntry {
  const tieBreakEntry = applyStrengthTiebreakVariant(weekOpenUtc, context, baseDecision);
  const { commercialCaution, commercialBranch } = classifyCommercialCaution(
    context.commercial,
    tieBreakEntry.finalDirection,
  );

  return {
    ...tieBreakEntry,
    selectorVariant: "commercial_audit_only",
    commercialExtremity: context.commercial.extremity,
    commercialCaution,
    commercialBranch,
  };
}

function applyCommercialCautionSkipVariant(
  weekOpenUtc: string,
  context: PairContext,
  baseDecision: SelectorPolicyDecision,
): SelectorAuditEntry {
  const tieBreakEntry = applyStrengthTiebreakVariant(weekOpenUtc, context, baseDecision);
  const { commercialCaution } = classifyCommercialCaution(
    context.commercial,
    tieBreakEntry.finalDirection,
  );

  return {
    ...tieBreakEntry,
    selectorVariant: "commercial_caution_skip",
    commercialExtremity: context.commercial.extremity,
    commercialCaution,
    commercialBranch: commercialCaution ? "commercial_caution_skip" : "commercial_no_caution",
    finalDirection: commercialCaution ? "NEUTRAL" : tieBreakEntry.finalDirection,
    finalScore: commercialCaution ? 0 : tieBreakEntry.finalScore,
  };
}

function applyCommercialStrengthDisagreeSkipVariant(
  weekOpenUtc: string,
  context: PairContext,
  baseDecision: SelectorPolicyDecision,
): SelectorAuditEntry {
  const tieBreakEntry = applyStrengthTiebreakVariant(weekOpenUtc, context, baseDecision);
  const { commercialCaution } = classifyCommercialCaution(
    context.commercial,
    tieBreakEntry.finalDirection,
  );
  const strengthRelationToFinal =
    tieBreakEntry.finalDirection === "NEUTRAL"
      ? "neutral"
      : classifyStrengthRelation(context.strength, tieBreakEntry.finalDirection);
  const blocked =
    commercialCaution
    && strengthRelationToFinal === "strong_disagree";

  return {
    ...tieBreakEntry,
    selectorVariant: "commercial_strength_disagree_skip",
    strengthRelationToProposed: strengthRelationToFinal,
    commercialExtremity: context.commercial.extremity,
    commercialCaution,
    commercialBranch: blocked ? "commercial_strength_disagree_skip" : "commercial_no_caution",
    finalDirection: blocked ? "NEUTRAL" : tieBreakEntry.finalDirection,
    finalScore: blocked ? 0 : tieBreakEntry.finalScore,
  };
}

async function resolveSelectorAuditInternal(
  weekOpenUtc: string,
  variant: SelectorVariant,
  options?: { requireStrength?: boolean },
): Promise<SelectorAuditWeek> {
  const canonicalWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  return getOrSetRuntimeCache(
    `selectorEngine:audit:${SELECTOR_ENGINE_VERSION}:${variant}:${canonicalWeekOpenUtc}`,
    getSelectorEngineCacheTtlMs(),
    async () => {
      const universe = buildPairUniverse();
      const [cotHistory, sentimentBySymbol, historicalWeeks] = await Promise.all([
        loadCotHistory(),
        loadSentimentHistory(),
        listDataSectionWeeks(),
      ]);

      const allWeeks = Array.from(
        new Set([...historicalWeeks, canonicalWeekOpenUtc]),
      ).sort((a, b) => a.localeCompare(b));

      const targetDt = DateTime.fromISO(canonicalWeekOpenUtc, { zone: "utc" });
      const prevWeekOpenUtc = allWeeks
        .filter((week) => DateTime.fromISO(week, { zone: "utc" }).toMillis() < targetDt.toMillis())
        .pop() ?? null;

      const [currentContext, previousContext, previousWeekReturns] = await Promise.all([
        buildContextForWeek(
          canonicalWeekOpenUtc,
          universe,
          cotHistory,
          sentimentBySymbol,
          allWeeks,
          options,
        ),
        prevWeekOpenUtc
          ? buildContextForWeek(prevWeekOpenUtc, universe, cotHistory, sentimentBySymbol, allWeeks, options)
          : Promise.resolve(null),
        prevWeekOpenUtc ? getWeeklyPairReturns(prevWeekOpenUtc) : Promise.resolve([]),
      ]);

      const previousWeekReturnByPair = new Map(
        previousWeekReturns.map((row) => [row.symbol.toUpperCase(), row.returnPct]),
      );

      const directions: DirectionMap = new Map();
      const entries: SelectorAuditEntry[] = [];
      for (const pairDef of universe) {
        const ctx = currentContext.get(pairDef.pair);
        if (!ctx) continue;
        const prevCtx = previousContext?.get(pairDef.pair) ?? null;
        const previousWeekReturn = previousWeekReturnByPair.get(pairDef.pair.toUpperCase()) ?? null;

        const baseDecision = policySentimentContextOverride(ctx, prevCtx, previousWeekReturn);
        const auditEntry = variant === "strength_veto"
          ? applyStrengthVetoVariant(canonicalWeekOpenUtc, ctx, baseDecision)
          : variant === "strength_tiebreak"
            ? applyStrengthTiebreakVariant(canonicalWeekOpenUtc, ctx, baseDecision)
            : variant === "commercial_audit_only"
              ? applyCommercialAuditOnlyVariant(canonicalWeekOpenUtc, ctx, baseDecision)
              : variant === "commercial_caution_skip"
                ? applyCommercialCautionSkipVariant(canonicalWeekOpenUtc, ctx, baseDecision)
                : variant === "commercial_strength_disagree_skip"
                  ? applyCommercialStrengthDisagreeSkipVariant(canonicalWeekOpenUtc, ctx, baseDecision)
              : applyStrengthConfirmationVariant(canonicalWeekOpenUtc, ctx, baseDecision);
        entries.push(auditEntry);
        if (auditEntry.finalDirection !== "NEUTRAL") {
          directions.set(pairDef.pair, {
            direction: auditEntry.finalDirection,
            source: "selector_sentiment_override",
            tier: null,
            assetClass: pairDef.assetClass,
          });
        }
      }

      return {
        weekOpenUtc: canonicalWeekOpenUtc,
        variant,
        entries,
        directions,
      };
    },
  );
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Resolve selector_sentiment_context_override directions for a given week.
 * Returns a DirectionMap keyed by pair symbol, matching the engine's expected format.
 *
 * This function loads COT history and sentiment history, computes context scores
 * for both the target week and the previous week, then runs the policy for each pair.
 */
export async function resolveSelectorAudit(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "strength_tiebreak", { requireStrength: true });
}

export async function resolveSelectorStrengthVetoAudit(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "strength_veto", { requireStrength: true });
}

export async function resolveSelectorStrengthTiebreakAudit(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "strength_tiebreak", { requireStrength: true });
}

export async function resolveSelectorCommercialAuditOnly(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "commercial_audit_only", { requireStrength: true });
}

export async function resolveSelectorCommercialCautionSkip(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "commercial_caution_skip", { requireStrength: true });
}

export async function resolveSelectorCommercialStrengthDisagreeSkip(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "commercial_strength_disagree_skip", { requireStrength: true });
}

export async function resolveSelectorDirections(
  weekOpenUtc: string,
): Promise<DirectionMap> {
  const resolved = await resolveSelectorAudit(weekOpenUtc);
  return new Map(resolved.directions);
}
