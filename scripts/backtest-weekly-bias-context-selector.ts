/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-weekly-bias-context-selector.ts
 *
 * Description:
 * First-pass research script for the always-on weekly bias selector.
 *
 * Every pair gets a forced LONG/SHORT direction every closed week.
 * No pair-weeks are skipped.
 *
 * It compares:
 *   - dealer-only forced full-basket choice
 *   - commercial-only forced full-basket choice
 *   - sentiment-only forced full-basket choice
 *   - several always-on context selector variants
 *
 * The selector is based on normalized historical extremity for:
 *   - dealer COT
 *   - commercial COT
 *   - sentiment agg_net
 *
 * Usage:
 *   npx tsx scripts/backtest-weekly-bias-context-selector.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { listPerformanceWeeks } from "../src/lib/performanceSnapshots";
import { query } from "../src/lib/db";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS, type PairDefinition } from "../src/lib/cotPairs";
import { resolveMarketBias, type BiasMode } from "../src/lib/cotCompute";
import type { CotSnapshot } from "../src/lib/cotTypes";
import type { AssetClass } from "../src/lib/cotMarkets";
import { normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { weekOpenFromCotReportDate } from "../src/lib/performance/gateEvaluation";

loadEnvConfig(process.cwd());

const REPORT_DIR = path.resolve(process.cwd(), "reports", "weekly-bias-context");
const REPORT_PATH = path.join(REPORT_DIR, "weekly-bias-context-selector-latest.json");

const REQUESTED_WEEKS = Number(process.env.WEEKLY_BIAS_CONTEXT_WEEKS ?? "52");
const COT_LOOKBACK_WEEKS = Number(process.env.WEEKLY_BIAS_CONTEXT_COT_LOOKBACK ?? "156");
const SENTIMENT_LOOKBACK_WEEKS = Number(process.env.WEEKLY_BIAS_CONTEXT_SENTIMENT_LOOKBACK ?? "52");
const EXTREME_THRESHOLD = Number(process.env.WEEKLY_BIAS_CONTEXT_EXTREME_THRESHOLD ?? "0.8");
const CROWD_THRESHOLD = Number(process.env.WEEKLY_BIAS_CONTEXT_CROWD_THRESHOLD ?? "0.5");

type Direction = "LONG" | "SHORT";

type WeeklyReturnRow = {
  symbol: string;
  asset_class: AssetClass;
  period_open_utc: Date;
  return_pct: string | number;
};

type SentimentAggRow = {
  symbol: string;
  timestamp_utc: Date;
  agg_net: string | number;
};

type CotHistoryPoint = {
  weekOpenUtc: string;
  weekOpenMs: number;
  snapshot: CotSnapshot;
};

type SourceMetrics = {
  score: number;
  extremity: number;
  indexA: number | null;
  indexB: number | null;
};

type PairWeekContext = {
  pair: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  realizedReturnPct: number;
  dealer: SourceMetrics;
  commercial: SourceMetrics;
  sentiment: SourceMetrics;
};

type PolicyTrade = {
  pair: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  direction: Direction;
  returnPct: number;
  score: number;
};

type WeekPolicyResult = {
  weekOpenUtc: string;
  returnPct: number;
  wins: number;
  losses: number;
  longs: number;
  shorts: number;
  trades: PolicyTrade[];
};

type PolicySummary = {
  policy: string;
  trades: number;
  weeks: number;
  returnPct: number;
  winRatePct: number;
  avgTradePct: number;
  maxDrawdownPct: number;
  worstWeekPct: number;
  losingWeeks: number;
  longCount: number;
  shortCount: number;
  weekly: WeekPolicyResult[];
};

type PolicySelector = (
  context: PairWeekContext,
  previousContext: PairWeekContext | null,
  previousWeekReturn: number | null,
) => { direction: Direction; score: number };

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

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

function fallbackDirection(
  scores: Array<number>,
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

function adjustForExtremes(score: number, extremity: number) {
  if (extremity >= EXTREME_THRESHOLD) return score * -0.5;
  if (extremity >= CROWD_THRESHOLD) return score * 0.5;
  return score;
}

function summarizePolicy(policy: string, weekly: WeekPolicyResult[]): PolicySummary {
  const weeklyReturns = weekly.map((week) => week.returnPct);
  const trades = weekly.flatMap((week) => week.trades);
  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const longCount = trades.filter((trade) => trade.direction === "LONG").length;
  const shortCount = trades.length - longCount;

  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const weekReturn of weeklyReturns) {
    equity += weekReturn;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }

  return {
    policy,
    trades: trades.length,
    weeks: weekly.length,
    returnPct: round(weeklyReturns.reduce((sum, value) => sum + value, 0)),
    winRatePct: round(trades.length > 0 ? (wins / trades.length) * 100 : 0),
    avgTradePct: round(trades.length > 0 ? trades.reduce((sum, trade) => sum + trade.returnPct, 0) / trades.length : 0),
    maxDrawdownPct: round(maxDd),
    worstWeekPct: round(weeklyReturns.reduce((min, value) => Math.min(min, value), 0)),
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    longCount,
    shortCount,
    weekly,
  };
}

function buildPairUniverse() {
  const universe: Array<PairDefinition & { assetClass: AssetClass }> = [];
  for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
    for (const pair of PAIRS_BY_ASSET_CLASS[assetClass]) {
      universe.push({ ...pair, assetClass });
    }
  }
  return universe;
}

function buildCotHistoryMap() {
  return Promise.all(
    (Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]).map(async (assetClass) => {
      const rows = await readSnapshotHistory(assetClass, 260);
      const history = rows
        .map((snapshot) => {
          const weekOpenUtc = weekOpenFromCotReportDate(snapshot.report_date);
          if (!weekOpenUtc) return null;
          const canonical = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
          const weekOpenMs = DateTime.fromISO(canonical, { zone: "utc" }).toMillis();
          if (!Number.isFinite(weekOpenMs)) return null;
          return {
            weekOpenUtc: canonical,
            weekOpenMs,
            snapshot,
          } satisfies CotHistoryPoint;
        })
        .filter((row): row is CotHistoryPoint => row !== null)
        .sort((left, right) => left.weekOpenMs - right.weekOpenMs);
      return [assetClass, history] as const;
    }),
  );
}

async function loadWeeklyReturns() {
  const rows = await query<WeeklyReturnRow>(
    `SELECT symbol, asset_class, period_open_utc, return_pct
       FROM pair_period_returns
      WHERE period_type = 'weekly'
      ORDER BY period_open_utc ASC, symbol ASC`,
    [],
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    const weekOpenUtc = row.period_open_utc.toISOString();
    map.set(`${row.symbol.toUpperCase()}|${weekOpenUtc}`, Number(row.return_pct));
  }
  return map;
}

async function loadSentimentHistory() {
  const rows = await query<SentimentAggRow>(
    `SELECT symbol, timestamp_utc, agg_net
       FROM sentiment_aggregates
      ORDER BY symbol ASC, timestamp_utc ASC`,
    [],
  );
  const bySymbol = new Map<string, Array<{ ts: number; aggNet: number }>>();
  for (const row of rows) {
    const symbol = row.symbol.toUpperCase();
    const ts = row.timestamp_utc.getTime();
    const list = bySymbol.get(symbol) ?? [];
    list.push({ ts, aggNet: Number(row.agg_net) });
    bySymbol.set(symbol, list);
  }
  return bySymbol;
}

function latestSentimentValue(
  rows: Array<{ ts: number; aggNet: number }>,
  targetTs: number,
) {
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

function computeSentimentMetrics(
  pair: string,
  weekOpenUtc: string,
  sentimentBySymbol: Map<string, Array<{ ts: number; aggNet: number }>>,
  closedWeeksAsc: string[],
  weeklyReturns: Map<string, number>,
): SourceMetrics {
  const history = sentimentBySymbol.get(pair.toUpperCase()) ?? [];
  if (history.length === 0) {
    return { score: 0, extremity: 0, indexA: null, indexB: null };
  }

  const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const currentIndex = latestSentimentValue(history, weekMs);
  if (currentIndex < 0) {
    return { score: 0, extremity: 0, indexA: null, indexB: null };
  }

  const selectedWeeklyValues: number[] = [];
  for (const historicalWeek of closedWeeksAsc) {
    if (Date.parse(historicalWeek) > Date.parse(weekOpenUtc)) break;
    const historicalWeekMs = DateTime.fromISO(historicalWeek, { zone: "utc" }).toMillis();
    const idx = latestSentimentValue(history, historicalWeekMs);
    if (idx >= 0) {
      selectedWeeklyValues.push(history[idx]!.aggNet);
    }
  }

  const lookbackSeries = selectedWeeklyValues.slice(-SENTIMENT_LOOKBACK_WEEKS);
  const currentAggNet = history[currentIndex]!.aggNet;
  const index = minMaxIndex(lookbackSeries, currentAggNet);
  const centered = clamp((index - 50) / 50, -1, 1);

  return {
    score: -centered,
    extremity: Math.abs(centered),
    indexA: index,
    indexB: null,
  };
}

function computeCotMetrics(
  pairDef: PairDefinition & { assetClass: AssetClass },
  weekOpenUtc: string,
  mode: BiasMode,
  cotHistoryByAsset: Map<AssetClass, CotHistoryPoint[]>,
): SourceMetrics {
  const history = cotHistoryByAsset.get(pairDef.assetClass) ?? [];
  const targetMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  if (!Number.isFinite(targetMs) || history.length === 0) {
    return { score: 0, extremity: 0, indexA: null, indexB: null };
  }

  let snapshotIndex = -1;
  for (let i = 0; i < history.length; i += 1) {
    if (history[i]!.weekOpenMs <= targetMs) snapshotIndex = i;
    else break;
  }
  if (snapshotIndex < 0) {
    return { score: 0, extremity: 0, indexA: null, indexB: null };
  }

  const slice = history.slice(Math.max(0, snapshotIndex + 1 - COT_LOOKBACK_WEEKS), snapshotIndex + 1);
  const baseSeries = slice
    .map((row) => resolveMarketBias(row.snapshot.currencies[pairDef.base]!, mode)?.net ?? null)
    .filter((value): value is number => value !== null);

  if (baseSeries.length === 0) {
    return { score: 0, extremity: 0, indexA: null, indexB: null };
  }

  const baseCurrent = baseSeries[baseSeries.length - 1]!;
  const baseIndex = minMaxIndex(baseSeries, baseCurrent);

  if (pairDef.assetClass === "fx") {
    const quoteSeries = slice
      .map((row) => resolveMarketBias(row.snapshot.currencies[pairDef.quote]!, mode)?.net ?? null)
      .filter((value): value is number => value !== null);
    if (quoteSeries.length === 0) {
      const score = clamp((baseIndex - 50) / 50, -1, 1);
      return {
        score,
        extremity: Math.abs(score),
        indexA: baseIndex,
        indexB: null,
      };
    }

    const quoteCurrent = quoteSeries[quoteSeries.length - 1]!;
    const quoteIndex = minMaxIndex(quoteSeries, quoteCurrent);
    const score = clamp((baseIndex - quoteIndex) / 100, -1, 1);
    return {
      score,
      extremity: Math.max(Math.abs(baseIndex - 50), Math.abs(quoteIndex - 50)) / 50,
      indexA: baseIndex,
      indexB: quoteIndex,
    };
  }

  const score = clamp((baseIndex - 50) / 50, -1, 1);
  return {
    score,
    extremity: Math.abs(score),
    indexA: baseIndex,
    indexB: null,
  };
}

const policyDealerOnly: PolicySelector = (context, previousWeekReturn) => {
  if (Math.abs(context.dealer.score) > 0.000001) {
    return { direction: scoreToDirection(context.dealer.score), score: context.dealer.score };
  }
  return fallbackDirection(
    [context.sentiment.score, context.commercial.score],
    previousWeekReturn,
  );
};

const policyCommercialOnly: PolicySelector = (context, previousWeekReturn) => {
  if (Math.abs(context.commercial.score) > 0.000001) {
    return { direction: scoreToDirection(context.commercial.score), score: context.commercial.score };
  }
  return fallbackDirection(
    [context.sentiment.score, context.dealer.score],
    previousWeekReturn,
  );
};

const policySentimentOnly: PolicySelector = (context, previousWeekReturn) => {
  if (Math.abs(context.sentiment.score) > 0.000001) {
    return { direction: scoreToDirection(context.sentiment.score), score: context.sentiment.score };
  }
  return fallbackDirection(
    [context.dealer.score, context.commercial.score],
    previousWeekReturn,
  );
};

const policyEqualSum: PolicySelector = (context, previousWeekReturn) => {
  const total = context.dealer.score + context.commercial.score + context.sentiment.score;
  if (Math.abs(total) > 0.000001) {
    return { direction: scoreToDirection(total), score: total };
  }
  return fallbackDirection(
    [context.sentiment.score, context.dealer.score, context.commercial.score],
    previousWeekReturn,
  );
};

const policySentimentTilt: PolicySelector = (context, previousWeekReturn) => {
  const total =
    context.dealer.score * 0.75 +
    context.commercial.score * 0.75 +
    context.sentiment.score * 1.25;
  if (Math.abs(total) > 0.000001) {
    return { direction: scoreToDirection(total), score: total };
  }
  return fallbackDirection(
    [context.sentiment.score, context.dealer.score, context.commercial.score],
    previousWeekReturn,
  );
};

const policyFadeExtremes: PolicySelector = (context, previousWeekReturn) => {
  const dealer = adjustForExtremes(context.dealer.score, context.dealer.extremity);
  const commercial = adjustForExtremes(context.commercial.score, context.commercial.extremity);
  const sentiment = adjustForExtremes(context.sentiment.score, context.sentiment.extremity);
  const total = dealer + commercial + sentiment;
  if (Math.abs(total) > 0.000001) {
    return { direction: scoreToDirection(total), score: total };
  }
  return fallbackDirection(
    [sentiment, dealer, commercial],
    previousWeekReturn,
  );
};

const policyLessExtremeWins: PolicySelector = (context, previousWeekReturn) => {
  const candidates = [
    { name: "sentiment", score: context.sentiment.score, extremity: context.sentiment.extremity },
    { name: "dealer", score: context.dealer.score, extremity: context.dealer.extremity },
    { name: "commercial", score: context.commercial.score, extremity: context.commercial.extremity },
  ]
    .filter((candidate) => Math.abs(candidate.score) > 0.000001)
    .sort((left, right) => {
      if (left.extremity !== right.extremity) return left.extremity - right.extremity;
      return Math.abs(right.score) - Math.abs(left.score);
    });

  if (candidates.length > 0) {
    return { direction: scoreToDirection(candidates[0]!.score), score: candidates[0]!.score };
  }
  return fallbackDirection(
    [context.sentiment.score, context.dealer.score, context.commercial.score],
    previousWeekReturn,
  );
};

type CandidateName = "dealer" | "commercial" | "sentiment";

type SourceCandidate = {
  name: CandidateName;
  score: number;
  extremity: number;
};

function getCandidates(context: PairWeekContext): SourceCandidate[] {
  return [
    { name: "sentiment", score: context.sentiment.score, extremity: context.sentiment.extremity },
    { name: "dealer", score: context.dealer.score, extremity: context.dealer.extremity },
    { name: "commercial", score: context.commercial.score, extremity: context.commercial.extremity },
  ].filter((candidate) => Math.abs(candidate.score) > 0.000001);
}

function candidateScore(
  candidate: SourceCandidate,
  previousContext: PairWeekContext | null,
) {
  const previous =
    candidate.name === "dealer"
      ? previousContext?.dealer
      : candidate.name === "commercial"
        ? previousContext?.commercial
        : previousContext?.sentiment;

  const previousScore = previous?.score ?? 0;
  const previousAbs = Math.abs(previousScore);
  const currentAbs = Math.abs(candidate.score);
  const strengthening = currentAbs > previousAbs + 0.000001 && Math.sign(candidate.score) === Math.sign(previousScore);
  const weakening = currentAbs + 0.000001 < previousAbs && Math.sign(candidate.score) === Math.sign(previousScore);
  const flipped = previousAbs > 0.000001 && Math.sign(candidate.score) !== Math.sign(previousScore);

  let quality =
    currentAbs *
    (candidate.name === "sentiment" ? 1.15 : candidate.name === "dealer" ? 1.0 : 0.9);

  quality *= 1 - candidate.extremity * 0.35;

  if (strengthening) quality *= 1.2;
  if (weakening) quality *= 0.8;
  if (flipped) quality *= 0.7;

  if (candidate.extremity >= 0.9) {
    quality *= strengthening ? 0.95 : 0.6;
  } else if (candidate.extremity >= 0.75) {
    quality *= strengthening ? 1.0 : 0.75;
  }

  return {
    quality,
    strengthening,
    weakening,
    flipped,
  };
}

const policyLessExtremeTrend: PolicySelector = (context, previousContext, previousWeekReturn) => {
  const candidates = getCandidates(context)
    .map((candidate) => ({
      ...candidate,
      analysis: candidateScore(candidate, previousContext),
    }))
    .sort((left, right) => {
      if (right.analysis.quality !== left.analysis.quality) {
        return right.analysis.quality - left.analysis.quality;
      }
      return left.extremity - right.extremity;
    });

  if (candidates.length > 0) {
    return { direction: scoreToDirection(candidates[0]!.score), score: candidates[0]!.score };
  }

  return fallbackDirection(
    [context.sentiment.score, context.dealer.score, context.commercial.score],
    previousWeekReturn,
  );
};

const policySentimentContextOverride: PolicySelector = (context, previousContext, previousWeekReturn) => {
  const sentimentPrev = previousContext?.sentiment ?? null;
  const sentimentStrongening =
    sentimentPrev !== null &&
    Math.sign(context.sentiment.score) === Math.sign(sentimentPrev.score) &&
    Math.abs(context.sentiment.score) > Math.abs(sentimentPrev.score) + 0.000001;
  const sentimentWeakening =
    sentimentPrev !== null &&
    Math.sign(context.sentiment.score) === Math.sign(sentimentPrev.score) &&
    Math.abs(context.sentiment.score) + 0.000001 < Math.abs(sentimentPrev.score);

  if (Math.abs(context.sentiment.score) > 0.000001) {
    if (context.sentiment.extremity < 0.8 || sentimentStrongening) {
      return { direction: scoreToDirection(context.sentiment.score), score: context.sentiment.score };
    }

    if (sentimentWeakening || context.sentiment.extremity >= 0.9) {
      const dealerDir = scoreToDirection(context.dealer.score);
      const commercialDir = scoreToDirection(context.commercial.score);
      if (
        Math.abs(context.dealer.score) > 0.000001 &&
        Math.abs(context.commercial.score) > 0.000001 &&
        dealerDir === commercialDir
      ) {
        const combined = context.dealer.score + context.commercial.score;
        return { direction: dealerDir, score: combined };
      }

      const cotCandidates = getCandidates(context)
        .filter((candidate) => candidate.name !== "sentiment")
        .sort((left, right) => left.extremity - right.extremity);
      if (cotCandidates.length > 0) {
        return { direction: scoreToDirection(cotCandidates[0]!.score), score: cotCandidates[0]!.score };
      }
    }

    return { direction: scoreToDirection(context.sentiment.score), score: context.sentiment.score };
  }

  return fallbackDirection(
    [context.dealer.score, context.commercial.score],
    previousWeekReturn,
  );
};

const policyConsensusQuality: PolicySelector = (context, previousContext, previousWeekReturn) => {
  const candidates = getCandidates(context);
  const byDirection = new Map<Direction, SourceCandidate[]>();
  for (const candidate of candidates) {
    const direction = scoreToDirection(candidate.score);
    const list = byDirection.get(direction) ?? [];
    list.push(candidate);
    byDirection.set(direction, list);
  }

  for (const direction of ["LONG", "SHORT"] as Direction[]) {
    const matching = byDirection.get(direction) ?? [];
    if (matching.length >= 2) {
      const avgExtremity =
        matching.reduce((sum, candidate) => sum + candidate.extremity, 0) / matching.length;
      const avgAbsScore =
        matching.reduce((sum, candidate) => sum + Math.abs(candidate.score), 0) / matching.length;
      if (avgExtremity <= 0.78) {
        return {
          direction,
          score: direction === "LONG" ? avgAbsScore : -avgAbsScore,
        };
      }
    }
  }

  return policyLessExtremeTrend(context, previousContext, previousWeekReturn);
};

async function main() {
  const universe = buildPairUniverse();
  const [weeklyReturns, sentimentBySymbol, cotEntries] = await Promise.all([
    loadWeeklyReturns(),
    loadSentimentHistory(),
    buildCotHistoryMap(),
  ]);
  const cotHistoryByAsset = new Map<AssetClass, CotHistoryPoint[]>(cotEntries);
  const requestedWeeks = await listPerformanceWeeks(Math.max(REQUESTED_WEEKS + 8, 24));
  const weekTradeCounts = new Map<string, number>();
  for (const key of weeklyReturns.keys()) {
    const weekOpenUtc = key.split("|")[1];
    weekTradeCounts.set(weekOpenUtc, (weekTradeCounts.get(weekOpenUtc) ?? 0) + 1);
  }
  const closedWeeksAsc = requestedWeeks
    .filter((week) => (weekTradeCounts.get(week) ?? 0) === universe.length)
    .sort((left, right) => Date.parse(left) - Date.parse(right))
    .slice(-REQUESTED_WEEKS);

  if (closedWeeksAsc.length === 0) {
    throw new Error("No closed fully-populated performance weeks available.");
  }

  const pairWeekContexts = new Map<string, PairWeekContext[]>();
  for (const pairDef of universe) {
    const rows: PairWeekContext[] = [];
    for (const weekOpenUtc of closedWeeksAsc) {
      const realizedReturnPct = weeklyReturns.get(`${pairDef.pair.toUpperCase()}|${weekOpenUtc}`);
      if (realizedReturnPct === undefined) continue;

      rows.push({
        pair: pairDef.pair,
        assetClass: pairDef.assetClass,
        weekOpenUtc,
        realizedReturnPct,
        dealer: computeCotMetrics(pairDef, weekOpenUtc, "dealer", cotHistoryByAsset),
        commercial: computeCotMetrics(pairDef, weekOpenUtc, "commercial", cotHistoryByAsset),
        sentiment: computeSentimentMetrics(pairDef.pair, weekOpenUtc, sentimentBySymbol, closedWeeksAsc, weeklyReturns),
      });
    }
    pairWeekContexts.set(pairDef.pair, rows);
  }

  const policies: Array<[string, PolicySelector]> = [
    ["dealer_forced_full_basket", policyDealerOnly],
    ["commercial_forced_full_basket", policyCommercialOnly],
    ["sentiment_forced_full_basket", policySentimentOnly],
    ["selector_equal_sum", policyEqualSum],
    ["selector_sentiment_tilt", policySentimentTilt],
    ["selector_fade_extremes", policyFadeExtremes],
    ["selector_less_extreme_wins", policyLessExtremeWins],
    ["selector_less_extreme_trend", policyLessExtremeTrend],
    ["selector_sentiment_context_override", policySentimentContextOverride],
    ["selector_consensus_quality", policyConsensusQuality],
  ];

  const policyWeekly = new Map<string, WeekPolicyResult[]>();
  for (const [policyName] of policies) {
    policyWeekly.set(policyName, []);
  }

  for (const weekOpenUtc of closedWeeksAsc) {
    const pairContextsForWeek = universe
      .map((pairDef) => pairWeekContexts.get(pairDef.pair)?.find((row) => row.weekOpenUtc === weekOpenUtc) ?? null)
      .filter((row): row is PairWeekContext => row !== null);

    for (const [policyName, selector] of policies) {
      const trades: PolicyTrade[] = [];
      for (const context of pairContextsForWeek) {
        const pairHistory = pairWeekContexts.get(context.pair) ?? [];
        const index = pairHistory.findIndex((row) => row.weekOpenUtc === weekOpenUtc);
        const previousContext = index > 0 ? pairHistory[index - 1] ?? null : null;
        const previousWeekReturn = index > 0 ? pairHistory[index - 1]!.realizedReturnPct : null;
        const decision = selector(context, previousContext, previousWeekReturn);
        const returnPct = decision.direction === "LONG" ? context.realizedReturnPct : -context.realizedReturnPct;
        trades.push({
          pair: context.pair,
          assetClass: context.assetClass,
          weekOpenUtc,
          direction: decision.direction,
          returnPct: round(returnPct, 4),
          score: round(decision.score, 6),
        });
      }

      const weekReturn = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
      const weekWins = trades.filter((trade) => trade.returnPct > 0).length;
      const weekLosses = trades.filter((trade) => trade.returnPct < 0).length;
      const longs = trades.filter((trade) => trade.direction === "LONG").length;

      policyWeekly.get(policyName)!.push({
        weekOpenUtc,
        returnPct: round(weekReturn),
        wins: weekWins,
        losses: weekLosses,
        longs,
        shorts: trades.length - longs,
        trades,
      });
    }
  }

  const summaries = policies.map(([policyName]) => summarizePolicy(policyName, policyWeekly.get(policyName)!));
  const ranked = [...summaries].sort((left, right) => {
    if (right.returnPct !== left.returnPct) return right.returnPct - left.returnPct;
    return right.winRatePct - left.winRatePct;
  });

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        generatedUtc: new Date().toISOString(),
        assumptions: {
          concept: "always_on_weekly_selector",
          note:
            "Single-source baselines in this report are forced full-basket classifiers, not the app's canonical weekly-hold strategies. They emit one LONG/SHORT decision for every pair-week by design.",
          requestedWeeks: REQUESTED_WEEKS,
          analyzedWeeks: closedWeeksAsc.length,
          cotLookbackWeeks: COT_LOOKBACK_WEEKS,
          sentimentLookbackWeeks: SENTIMENT_LOOKBACK_WEEKS,
          extremeThreshold: EXTREME_THRESHOLD,
          crowdThreshold: CROWD_THRESHOLD,
          pairUniverse: universe.map((pair) => ({ pair: pair.pair, assetClass: pair.assetClass })),
          forcedChoiceFallback:
            "sentiment_score -> dealer_score -> commercial_score -> previous_week_return -> LONG",
        },
        weekRange: {
          first: closedWeeksAsc[0],
          last: closedWeeksAsc[closedWeeksAsc.length - 1],
        },
        ranked,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Weekly bias context selector report: ${REPORT_PATH}`);
  console.log(`Weeks analyzed: ${closedWeeksAsc.length} | Pairs per week: ${universe.length}`);
  for (const summary of ranked) {
    console.log(
      `${summary.policy}: ${summary.returnPct >= 0 ? "+" : ""}${summary.returnPct.toFixed(2)}% | WR ${summary.winRatePct.toFixed(1)}% | DD ${summary.maxDrawdownPct.toFixed(2)}% | worst ${summary.worstWeekPct.toFixed(2)}%`,
    );
  }
}

main().catch((error) => {
  console.error("Weekly bias context selector failed:", error);
  process.exit(1);
});
