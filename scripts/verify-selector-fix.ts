/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-selector-fix.ts
 *
 * Description:
 * Verifies the selector fix by comparing legacy selector math vs the
 * current engine, recomputing weekly-hold baselines, and auditing BTC/ETH
 * directions against raw sentiment and dealer baskets.
 *
 * Usage:
 *   npx tsx scripts/verify-selector-fix.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { loadEnvConfig } from "@next/env";

import { PAIRS_BY_ASSET_CLASS, type PairDefinition } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { resolveMarketBias, type BiasMode } from "../src/lib/cotCompute";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { filterByModel, getCanonicalBasketWeek } from "../src/lib/performance/basketSource";
import {
  buildPairUniverse,
  clamp,
  loadCotHistory,
  loadSentimentHistory,
  minMaxIndex,
  policySentimentContextOverride,
  resolveSelectorDirections,
  type CotHistoryPoint,
  type PairContext,
  type PairDefWithAsset,
  type SentimentRow,
  type SourceMetrics,
} from "../src/lib/performance/selectorEngine";
import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy } from "../src/lib/performance/strategyConfig";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";

type LegacyWeekResult = {
  weekOpenUtc: string;
  totalReturnPct: number;
};

type LegacySummary = {
  totalReturnPct: number;
  maxDrawdownPct: number;
  byAssetClass: Record<string, { returnPct: number; trades: number; wins: number }>;
  weeks: LegacyWeekResult[];
};

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
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

function legacyComputeCotMetrics(
  pairDef: PairDefWithAsset,
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
  for (let i = 0; i < history.length; i += 1) {
    if (history[i]!.weekOpenMs <= targetMs) snapshotIndex = i;
    else break;
  }
  if (snapshotIndex < 0) return { score: 0, extremity: 0 };

  const slice = history.slice(Math.max(0, snapshotIndex + 1 - 156), snapshotIndex + 1);
  const baseSeries = slice
    .map((row) => resolveMarketBias(row.snapshot.currencies[pairDef.base]!, mode)?.net ?? null)
    .filter((value): value is number => value !== null);

  if (baseSeries.length === 0) return { score: 0, extremity: 0 };

  const baseCurrent = baseSeries[baseSeries.length - 1]!;
  const baseIndex = minMaxIndex(baseSeries, baseCurrent);

  if (pairDef.assetClass === "fx") {
    const quoteSeries = slice
      .map((row) => resolveMarketBias(row.snapshot.currencies[pairDef.quote]!, mode)?.net ?? null)
      .filter((value): value is number => value !== null);

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

function legacyComputeSentimentMetrics(
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

  const lookbackSeries = selectedWeeklyValues.slice(-52);
  const currentAggNet = history[currentIndex]!.aggNet;
  const index = minMaxIndex(lookbackSeries, currentAggNet);
  const centered = clamp((index - 50) / 50, -1, 1);

  return {
    score: -centered,
    extremity: Math.abs(centered),
  };
}

async function buildLegacyContextForWeek(
  weekOpenUtc: string,
  universe: PairDefWithAsset[],
  cotHistory: Map<AssetClass, CotHistoryPoint[]>,
  sentimentBySymbol: Map<string, SentimentRow[]>,
  closedWeeksForLookback: string[],
): Promise<Map<string, PairContext>> {
  const contexts = new Map<string, PairContext>();
  for (const pairDef of universe) {
    contexts.set(pairDef.pair, {
      pair: pairDef.pair,
      assetClass: pairDef.assetClass,
      dealer: legacyComputeCotMetrics(pairDef, weekOpenUtc, "dealer", cotHistory),
      commercial: legacyComputeCotMetrics(pairDef, weekOpenUtc, "commercial", cotHistory),
      sentiment: legacyComputeSentimentMetrics(pairDef.pair, weekOpenUtc, sentimentBySymbol, closedWeeksForLookback),
      strength: {
        compositeScore: 0,
        compositeDirection: "NEUTRAL",
        availableWindows: 0,
        latestSnapshotUtc: null,
      },
    });
  }
  return contexts;
}

function summarizeLegacyWeeks(weeks: LegacyWeekResult[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const week of weeks) {
    cumulative += week.totalReturnPct;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
  }
  return maxDrawdown;
}

async function main() {
  const weeksAsc = (await listDataSectionWeeks()).sort((left, right) => left.localeCompare(right));
  const strategy = getStrategy("selector_sentiment_override");
  if (!strategy) {
    throw new Error("selector_sentiment_override not found in strategy config.");
  }

  const [newDirectionsByWeek, cotHistory, sentimentHistory] = await Promise.all([
    Promise.all(
      weeksAsc.map(async (weekOpenUtc) => [weekOpenUtc, await resolveSelectorDirections(weekOpenUtc)] as const),
    ).then((entries) => new Map(entries)),
    loadCotHistory(),
    loadSentimentHistory(),
  ]);
  const universe = buildPairUniverse();
  const currentSummary = await computeMultiWeekHold(strategy, weeksAsc);
  const realizedWeeks = currentSummary.weeks.map((week) => week.weekOpenUtc);
  const realizedWeekSet = new Set(realizedWeeks);

  const legacyByAssetClass: Record<string, { returnPct: number; trades: number; wins: number }> = {};
  const legacyWeeks: LegacyWeekResult[] = [];
  const cryptoAuditRows: Array<{
    weekOpenUtc: string;
    pair: string;
    legacySelector: string;
    newSelector: string;
    rawSentiment: string;
    rawDealer: string;
  }> = [];

  let previousLegacyContext: Map<string, PairContext> | null = null;
  let previousWeekOpenUtc: string | null = null;

  for (const weekOpenUtc of weeksAsc) {
    const [legacyContext, basketWeek, pairReturns, previousWeekReturns] = await Promise.all([
      buildLegacyContextForWeek(weekOpenUtc, universe, cotHistory, sentimentHistory, weeksAsc),
      getCanonicalBasketWeek(weekOpenUtc),
      getWeeklyPairReturns(weekOpenUtc),
      previousWeekOpenUtc ? getWeeklyPairReturns(previousWeekOpenUtc) : Promise.resolve([]),
    ]);

    const pairReturnBySymbol = new Map(pairReturns.map((row) => [row.symbol.toUpperCase(), row]));
    const previousWeekReturnByPair = new Map(
      previousWeekReturns.map((row) => [row.symbol.toUpperCase(), row.returnPct]),
    );
    const rawSentimentByPair = new Map(
      filterByModel(basketWeek, "sentiment").map((signal) => [signal.symbol.toUpperCase(), signal.direction]),
    );
    const rawDealerByPair = new Map(
      filterByModel(basketWeek, "dealer").map((signal) => [signal.symbol.toUpperCase(), signal.direction]),
    );

    let legacyWeekReturn = 0;
    for (const pairDef of universe) {
      const legacyPairContext = legacyContext.get(pairDef.pair);
      if (!legacyPairContext) continue;

      const previousPairContext = previousLegacyContext?.get(pairDef.pair) ?? null;
      const previousWeekReturn = previousWeekReturnByPair.get(pairDef.pair.toUpperCase()) ?? null;
      const legacyDecision = policySentimentContextOverride(
        legacyPairContext,
        previousPairContext,
        previousWeekReturn,
      );
      const newDecision = newDirectionsByWeek.get(weekOpenUtc)?.get(pairDef.pair)?.direction ?? "LONG";
      const rawSentiment = rawSentimentByPair.get(pairDef.pair.toUpperCase()) ?? "NEUTRAL";
      const rawDealer = rawDealerByPair.get(pairDef.pair.toUpperCase()) ?? "NEUTRAL";

      if (pairDef.assetClass === "crypto" && (pairDef.pair === "BTCUSD" || pairDef.pair === "ETHUSD")) {
        cryptoAuditRows.push({
          weekOpenUtc,
          pair: pairDef.pair,
          legacySelector: legacyDecision.direction,
          newSelector: newDecision,
          rawSentiment,
          rawDealer,
        });
      }

      if (!realizedWeekSet.has(weekOpenUtc)) {
        continue;
      }

      const pairReturn = pairReturnBySymbol.get(pairDef.pair.toUpperCase());
      if (!pairReturn) continue;

      const directedReturn = legacyDecision.direction === "SHORT" ? -pairReturn.returnPct : pairReturn.returnPct;
      legacyWeekReturn += directedReturn;

      if (!legacyByAssetClass[pairDef.assetClass]) {
        legacyByAssetClass[pairDef.assetClass] = { returnPct: 0, trades: 0, wins: 0 };
      }
      legacyByAssetClass[pairDef.assetClass]!.returnPct += directedReturn;
      legacyByAssetClass[pairDef.assetClass]!.trades += 1;
      if (directedReturn > 0) {
        legacyByAssetClass[pairDef.assetClass]!.wins += 1;
      }
    }

    if (realizedWeekSet.has(weekOpenUtc)) {
      legacyWeeks.push({ weekOpenUtc, totalReturnPct: legacyWeekReturn });
    }

    previousLegacyContext = legacyContext;
    previousWeekOpenUtc = weekOpenUtc;
  }

  const legacySummary: LegacySummary = {
    totalReturnPct: legacyWeeks.reduce((sum, week) => sum + week.totalReturnPct, 0),
    maxDrawdownPct: summarizeLegacyWeeks(legacyWeeks),
    byAssetClass: legacyByAssetClass,
    weeks: legacyWeeks,
  };

  console.log("=== Selector Fix Verification ===\n");
  console.log(`Weeks in app: ${weeksAsc.length}`);
  console.log(`Realized weeks used for totals: ${currentSummary.weeks.length}\n`);

  console.log("Overall weekly-hold baseline:");
  console.log(`  Before fix: ${formatSigned(legacySummary.totalReturnPct)} | DD ${formatSigned(legacySummary.maxDrawdownPct)}`);
  console.log(`  After fix:  ${formatSigned(currentSummary.totalReturnPct)} | DD ${formatSigned(currentSummary.maxDrawdownPct)}\n`);

  console.log("Per-asset-class return comparison:");
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const before = legacySummary.byAssetClass[assetClass]?.returnPct ?? 0;
    const after = currentSummary.byAssetClass[assetClass]?.returnPct ?? 0;
    console.log(`  ${assetClass}: before ${formatSigned(before)} | after ${formatSigned(after)}`);
  }

  console.log("\nBTC/ETH direction audit:");
  for (const row of cryptoAuditRows) {
    console.log(
      `  ${row.weekOpenUtc.slice(0, 10)} ${row.pair}: legacy=${row.legacySelector} new=${row.newSelector} rawSentiment=${row.rawSentiment} rawDealer=${row.rawDealer}`,
    );
  }

  const jan19Rows = cryptoAuditRows.filter((row) => row.weekOpenUtc.startsWith("2026-01-19"));
  console.log("\nJan 19, 2026 crypto check:");
  if (jan19Rows.length === 0) {
    console.log("  No BTC/ETH rows found for 2026-01-19.");
  } else {
    for (const row of jan19Rows) {
      const status = row.rawSentiment !== "NEUTRAL" && row.newSelector === row.rawSentiment ? "OK" : "CHECK";
      console.log(
        `  ${row.pair}: new=${row.newSelector} rawSentiment=${row.rawSentiment} rawDealer=${row.rawDealer} status=${status}`,
      );
    }
  }

  const jan19Mismatches = jan19Rows.filter(
    (row) => row.rawSentiment !== "NEUTRAL" && row.newSelector !== row.rawSentiment,
  );
  console.log(`\nJan 19 mismatches remaining: ${jan19Mismatches.length}`);
}

main().catch((error) => {
  console.error("Selector verification failed:", error);
  process.exit(1);
});
