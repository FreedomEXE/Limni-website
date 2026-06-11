/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: diagnose-selector-crypto.ts
 *
 * Description:
 * Dumps selector internals for every pair across every app week, plus
 * raw sentiment basket directions for comparison. Focuses on exposing
 * the sentiment thin-data path and one-sided COT normalization.
 *
 * Usage:
 *   npx tsx scripts/diagnose-selector-crypto.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { filterByModel, getCanonicalBasketWeek } from "../src/lib/performance/basketSource";
import {
  buildContextForWeek,
  buildPairUniverse,
  loadCotHistory,
  loadSentimentHistory,
  policySentimentContextOverride,
  type PairContext,
} from "../src/lib/performance/selectorEngine";

loadEnvConfig(process.cwd());

const CRYPTO_FOCUS = new Set(["BTCUSD", "ETHUSD"]);

function formatNumber(value: number | null | undefined, decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

function formatSeries(values: number[]) {
  return `[${values.map((value) => formatNumber(value)).join(",")}]`;
}

function policySummary(branch: string) {
  switch (branch) {
    case "follow_sentiment":
      return "FOLLOW_SENTIMENT";
    case "follow_sentiment_strengthening":
      return "FOLLOW_SENTIMENT_STRENGTHENING";
    case "override_cot_agreement":
      return "OVERRIDE_COT_AGREEMENT";
    case "override_cot_less_stretched":
      return "OVERRIDE_COT_LESS_STRETCHED";
    case "fallback_sentiment":
      return "FALLBACK_SENTIMENT";
    case "fallback_chain":
      return "FALLBACK_CHAIN";
    default:
      return branch.toUpperCase();
  }
}

function printTrace(
  weekOpenUtc: string,
  context: PairContext,
  previousContext: PairContext | null,
  previousWeekReturn: number | null,
  rawSentimentDirection: string,
) {
  const decision = policySentimentContextOverride(context, previousContext, previousWeekReturn);
  const sentimentDebug = context.sentiment.debug?.type === "sentiment" ? context.sentiment.debug : null;
  const dealerDebug = context.dealer.debug?.type === "cot" ? context.dealer.debug : null;
  const commercialDebug = context.commercial.debug?.type === "cot" ? context.commercial.debug : null;

  console.log(`Week: ${weekOpenUtc.slice(0, 10)}  Pair: ${context.pair}  Asset: ${context.assetClass}`);

  if (sentimentDebug) {
    console.log(
      `  Sentiment: agg_net=${formatNumber(sentimentDebug.currentAggNet)}  lookback=${formatSeries(sentimentDebug.lookbackSeries)}  minMaxIndex=${formatNumber(sentimentDebug.minMaxIndex)}  score=${formatNumber(context.sentiment.score)}  extremity=${formatNumber(context.sentiment.extremity)}  zeroVariance=${String(sentimentDebug.zeroVariance)}  normalization=${sentimentDebug.normalization}`,
    );
  } else {
    console.log("  Sentiment: unavailable");
  }

  if (dealerDebug) {
    console.log(
      `  Dealer COT: baseSeries=${formatSeries(dealerDebug.base.series)}  baseCurrent=${formatNumber(dealerDebug.base.current)}  minMaxIndex=${formatNumber(dealerDebug.base.minMaxIndex)}  score=${formatNumber(context.dealer.score)}  crossesZero=${String(dealerDebug.base.crossesZero)}  normalization=${dealerDebug.base.normalization}`,
    );
    if (dealerDebug.quote) {
      console.log(
        `    Quote leg: quoteSeries=${formatSeries(dealerDebug.quote.series)}  quoteCurrent=${formatNumber(dealerDebug.quote.current)}  minMaxIndex=${formatNumber(dealerDebug.quote.minMaxIndex)}  quoteScore=${formatNumber(dealerDebug.quote.score)}  crossesZero=${String(dealerDebug.quote.crossesZero)}  normalization=${dealerDebug.quote.normalization}`,
      );
    }
  } else {
    console.log("  Dealer COT: unavailable");
  }

  if (commercialDebug) {
    console.log(
      `  Commercial COT: baseSeries=${formatSeries(commercialDebug.base.series)}  baseCurrent=${formatNumber(commercialDebug.base.current)}  minMaxIndex=${formatNumber(commercialDebug.base.minMaxIndex)}  score=${formatNumber(context.commercial.score)}  crossesZero=${String(commercialDebug.base.crossesZero)}  normalization=${commercialDebug.base.normalization}`,
    );
    if (commercialDebug.quote) {
      console.log(
        `    Quote leg: quoteSeries=${formatSeries(commercialDebug.quote.series)}  quoteCurrent=${formatNumber(commercialDebug.quote.current)}  minMaxIndex=${formatNumber(commercialDebug.quote.minMaxIndex)}  quoteScore=${formatNumber(commercialDebug.quote.score)}  crossesZero=${String(commercialDebug.quote.crossesZero)}  normalization=${commercialDebug.quote.normalization}`,
      );
    }
  } else {
    console.log("  Commercial COT: unavailable");
  }

  console.log(
    `  Policy: sentiment_score=${formatNumber(context.sentiment.score)}  branch=${policySummary(decision.branch)}  dealer_score=${formatNumber(context.dealer.score)}  commercial_score=${formatNumber(context.commercial.score)}  direction=${decision.direction}`,
  );
  console.log(`  Raw sentiment strategy direction: ${rawSentimentDirection}`);

  if (context.assetClass === "crypto" && rawSentimentDirection !== "NEUTRAL" && rawSentimentDirection !== decision.direction) {
    console.log(`  MISMATCH: Selector=${decision.direction}, Raw Sentiment=${rawSentimentDirection}`);
  }

  console.log("  ---");

  return decision;
}

async function main() {
  const weeks = (await listDataSectionWeeks()).sort((left, right) => left.localeCompare(right));
  const universe = buildPairUniverse();
  const [cotHistory, sentimentHistory] = await Promise.all([
    loadCotHistory(),
    loadSentimentHistory(),
  ]);

  const mismatches: Array<{
    weekOpenUtc: string;
    pair: string;
    selectorDirection: string;
    rawSentimentDirection: string;
    policyBranch: string;
  }> = [];

  let previousContext: Map<string, PairContext> | null = null;
  let previousWeekOpenUtc: string | null = null;
  let currentWeekFocus: Array<{
    pair: string;
    sentimentScore: number;
    dealerScore: number;
    commercialScore: number;
    branch: string;
    direction: string;
    rawSentimentDirection: string;
  }> = [];

  for (const weekOpenUtc of weeks) {
    const [contextMap, basketWeek, previousWeekReturns] = await Promise.all([
      buildContextForWeek(weekOpenUtc, universe, cotHistory, sentimentHistory, weeks),
      getCanonicalBasketWeek(weekOpenUtc),
      previousWeekOpenUtc ? getWeeklyPairReturns(previousWeekOpenUtc) : Promise.resolve([]),
    ]);

    const rawSentimentByPair = new Map(
      filterByModel(basketWeek, "sentiment").map((signal) => [signal.symbol.toUpperCase(), signal.direction]),
    );
    const previousWeekReturnByPair = new Map(
      previousWeekReturns.map((row) => [row.symbol.toUpperCase(), row.returnPct]),
    );

    for (const pairDef of universe) {
      const context = contextMap.get(pairDef.pair);
      if (!context) continue;

      const previousPairContext = previousContext?.get(pairDef.pair) ?? null;
      const previousWeekReturn = previousWeekReturnByPair.get(pairDef.pair.toUpperCase()) ?? null;
      const rawSentimentDirection = rawSentimentByPair.get(pairDef.pair.toUpperCase()) ?? "NEUTRAL";
      const decision = printTrace(
        weekOpenUtc,
        context,
        previousPairContext,
        previousWeekReturn,
        rawSentimentDirection,
      );

      if (context.assetClass === "crypto" && rawSentimentDirection !== "NEUTRAL" && rawSentimentDirection !== decision.direction) {
        mismatches.push({
          weekOpenUtc,
          pair: pairDef.pair,
          selectorDirection: decision.direction,
          rawSentimentDirection,
          policyBranch: decision.branch,
        });
      }

      if (weekOpenUtc === weeks[weeks.length - 1] && CRYPTO_FOCUS.has(pairDef.pair)) {
        currentWeekFocus.push({
          pair: pairDef.pair,
          sentimentScore: context.sentiment.score,
          dealerScore: context.dealer.score,
          commercialScore: context.commercial.score,
          branch: decision.branch,
          direction: decision.direction,
          rawSentimentDirection,
        });
      }
    }

    previousContext = contextMap;
    previousWeekOpenUtc = weekOpenUtc;
  }

  console.log("\n=== Current Week Focus (BTC/ETH) ===");
  for (const row of currentWeekFocus.sort((left, right) => left.pair.localeCompare(right.pair))) {
    console.log(
      `${row.pair}: sentiment=${formatNumber(row.sentimentScore)} dealer=${formatNumber(row.dealerScore)} commercial=${formatNumber(row.commercialScore)} branch=${policySummary(row.branch)} direction=${row.direction} rawSentiment=${row.rawSentimentDirection}`,
    );
  }

  console.log("\n=== Crypto Selector vs Raw Sentiment Mismatches ===");
  if (mismatches.length === 0) {
    console.log("None");
    return;
  }

  for (const mismatch of mismatches) {
    console.log(
      `${mismatch.weekOpenUtc.slice(0, 10)}  ${mismatch.pair}  selector=${mismatch.selectorDirection}  rawSentiment=${mismatch.rawSentimentDirection}  branch=${policySummary(mismatch.policyBranch)}`,
    );
  }
}

main().catch((error) => {
  console.error("Selector diagnostic failed:", error);
  process.exit(1);
});
