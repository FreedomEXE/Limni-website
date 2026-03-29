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

// ── Config ─────────────────────────────────────────────────────────

const COT_LOOKBACK_WEEKS = 156;
const SENTIMENT_LOOKBACK_WEEKS = 52;
const EXTREME_THRESHOLD = 0.8;
const SELECTOR_ENGINE_CACHE_TTL_MS = Number(
  process.env.SELECTOR_ENGINE_CACHE_TTL_MS ?? "300000",
);
const SELECTOR_ENGINE_VERSION = "selector-engine-v2";

// ── Types ──────────────────────────────────────────────────────────

type Direction = "LONG" | "SHORT";

type SourceMetrics = {
  score: number;       // -1 to +1, positive = LONG, negative = SHORT
  extremity: number;   // 0 to 1, how stretched the source is
};

type PairContext = {
  pair: string;
  assetClass: AssetClass;
  dealer: SourceMetrics;
  commercial: SourceMetrics;
  sentiment: SourceMetrics;
};

type CotHistoryPoint = {
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

// ── Helpers ────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function minMaxIndex(series: number[], current: number) {
  if (!series.length) return 50;
  const low = Math.min(...series);
  const high = Math.max(...series);
  if (high === low) return 50;
  return ((current - low) / (high - low)) * 100;
}

function scoreToDirection(score: number): Direction {
  return score >= 0 ? "LONG" : "SHORT";
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

// ── COT Data Loading ───────────────────────────────────────────────

async function loadCotHistory(): Promise<Map<AssetClass, CotHistoryPoint[]>> {
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

type SentimentRow = { ts: number; aggNet: number };

async function loadSentimentHistory(): Promise<Map<string, SentimentRow[]>> {
  return getOrSetRuntimeCache(
    `selectorEngine:sentimentHistory:${SELECTOR_ENGINE_VERSION}`,
    getSelectorEngineCacheTtlMs(),
    async () => {
      const rows = await query<{ symbol: string; timestamp_utc: Date; agg_net: string | number }>(
        `SELECT symbol, timestamp_utc, agg_net
           FROM sentiment_aggregates
          ORDER BY symbol ASC, timestamp_utc ASC`,
        [],
      );
      const bySymbol = new Map<string, SentimentRow[]>();
      for (const row of rows) {
        const symbol = row.symbol.toUpperCase();
        const list = bySymbol.get(symbol) ?? [];
        list.push({ ts: row.timestamp_utc.getTime(), aggNet: Number(row.agg_net) });
        bySymbol.set(symbol, list);
      }
      return bySymbol;
    },
  );
}

function latestSentimentValue(rows: SentimentRow[], targetTs: number): number {
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

function computeCotMetrics(
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
  const baseIndex = minMaxIndex(baseSeries, baseCurrent);

  if (pairDef.assetClass === "fx") {
    const quoteSeries = slice
      .map((row) => resolveMarketBias(row.snapshot.currencies[pairDef.quote]!, mode)?.net ?? null)
      .filter((v): v is number => v !== null);

    if (quoteSeries.length === 0) {
      const score = clamp((baseIndex - 50) / 50, -1, 1);
      return { score, extremity: Math.abs(score) };
    }

    const quoteCurrent = quoteSeries[quoteSeries.length - 1]!;
    const quoteIndex = minMaxIndex(quoteSeries, quoteCurrent);
    const score = clamp((baseIndex - quoteIndex) / 100, -1, 1);
    return {
      score,
      extremity: Math.max(Math.abs(baseIndex - 50), Math.abs(quoteIndex - 50)) / 50,
    };
  }

  const score = clamp((baseIndex - 50) / 50, -1, 1);
  return { score, extremity: Math.abs(score) };
}

function computeSentimentMetrics(
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

  return {
    score: -centered, // contrarian: crowded long → SHORT
    extremity: Math.abs(centered),
  };
}

// ── Context Builder ────────────────────────────────────────────────

type PairDefWithAsset = PairDefinition & { assetClass: AssetClass };

function buildPairUniverse(): PairDefWithAsset[] {
  const universe: PairDefWithAsset[] = [];
  for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
    for (const pair of PAIRS_BY_ASSET_CLASS[assetClass]) {
      universe.push({ ...pair, assetClass });
    }
  }
  return universe;
}

async function buildContextForWeek(
  weekOpenUtc: string,
  universe: PairDefWithAsset[],
  cotHistory: Map<AssetClass, CotHistoryPoint[]>,
  sentimentBySymbol: Map<string, SentimentRow[]>,
  closedWeeksForLookback: string[],
): Promise<Map<string, PairContext>> {
  const contexts = new Map<string, PairContext>();
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
    });
  }
  return contexts;
}

// ── Policy: Sentiment Context Override ──────────────────────────────

function policySentimentContextOverride(
  context: PairContext,
  previousContext: PairContext | null,
  previousWeekReturn: number | null,
): { direction: Direction; score: number } {
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
      return { direction: scoreToDirection(context.sentiment.score), score: context.sentiment.score };
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
        return { direction: dealerDir, score: context.dealer.score + context.commercial.score };
      }

      // Otherwise use the less-stretched COT source
      const cotCandidates = [
        { score: context.dealer.score, extremity: context.dealer.extremity },
        { score: context.commercial.score, extremity: context.commercial.extremity },
      ]
        .filter((c) => Math.abs(c.score) > 0.000001)
        .sort((a, b) => a.extremity - b.extremity);

      if (cotCandidates.length > 0) {
        return { direction: scoreToDirection(cotCandidates[0]!.score), score: cotCandidates[0]!.score };
      }
    }

    // Fallback: still follow sentiment
    return { direction: scoreToDirection(context.sentiment.score), score: context.sentiment.score };
  }

  // No sentiment signal → fallback chain: dealer → commercial → previous week → LONG
  return fallbackDirection(
    [context.dealer.score, context.commercial.score],
    previousWeekReturn,
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
export async function resolveSelectorDirections(
  weekOpenUtc: string,
): Promise<DirectionMap> {
  const canonicalWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  return getOrSetRuntimeCache(
    `selectorEngine:resolve:${SELECTOR_ENGINE_VERSION}:${canonicalWeekOpenUtc}`,
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
        ),
        prevWeekOpenUtc
          ? buildContextForWeek(prevWeekOpenUtc, universe, cotHistory, sentimentBySymbol, allWeeks)
          : Promise.resolve(null),
        prevWeekOpenUtc ? getWeeklyPairReturns(prevWeekOpenUtc) : Promise.resolve([]),
      ]);

      const previousWeekReturnByPair = new Map(
        previousWeekReturns.map((row) => [row.symbol.toUpperCase(), row.returnPct]),
      );

      const directions: DirectionMap = new Map();
      for (const pairDef of universe) {
        const ctx = currentContext.get(pairDef.pair);
        if (!ctx) continue;
        const prevCtx = previousContext?.get(pairDef.pair) ?? null;
        const previousWeekReturn = previousWeekReturnByPair.get(pairDef.pair.toUpperCase()) ?? null;

        const { direction } = policySentimentContextOverride(ctx, prevCtx, previousWeekReturn);
        directions.set(pairDef.pair, {
          direction,
          source: "selector_sentiment_override",
          tier: null,
          assetClass: pairDef.assetClass,
        });
      }

      return directions;
    },
  );
}
