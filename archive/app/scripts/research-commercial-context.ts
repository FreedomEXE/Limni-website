/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-commercial-context.ts
 *
 * Description:
 * Commercial context tagging research for the canonical selector baseline.
 * This is a pure diagnostic pass. No selector directions are changed.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import {
  buildContextForWeek,
  buildPairUniverse,
  loadCotHistory,
  loadSentimentHistory,
  resolveSelectorStrengthTiebreakAudit,
  type Direction,
  type PairContext,
  type PairDefWithAsset,
  type SelectorDirectionalState,
} from "../src/lib/performance/selectorEngine";
import type { AssetClass } from "../src/lib/cotMarkets";
import { normalizeWeekOpenUtc, getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

type TaggedTrade = {
  weekOpenUtc: string;
  pair: string;
  assetClass: AssetClass;
  selectorDirection: Direction;
  returnPct: number;
  commercialDirection: SelectorDirectionalState;
  commercialDiverges: boolean;
  alignmentBucket: "aligned" | "neutral" | "opposed";
  commercialExtremity: number;
  extremityBucket: "low" | "medium" | "high";
  commercialScoreCurrent: number;
  commercialScorePrior: number | null;
  deltaDirection: "building_with" | "building_against" | "stable" | "no_prior";
  fragilityScore: 0 | 1 | 2 | 3;
};

type BucketStats = {
  trades: number;
  totalReturnPct: number;
  avgReturnPct: number;
  winRatePct: number;
  losingWeeks: number;
  maxDrawdownPct: number;
};

const OUTPUT_PATH = "docs/COMMERCIAL_CONTEXT_RESEARCH_2026-04-06.md";
const TARGET_ADR = getTargetAdrPct();

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function signedPct(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatWeek(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function scoreToDirectionalState(score: number): SelectorDirectionalState {
  return Math.abs(score) <= 0.000001 ? "NEUTRAL" : score >= 0 ? "LONG" : "SHORT";
}

function computeMaxDd(weeklyReturns: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const ret of weeklyReturns) {
    cumulative += ret;
    peak = Math.max(peak, cumulative);
    maxDd = Math.max(maxDd, peak - cumulative);
  }
  return round(maxDd);
}

function computeBucketStats(trades: TaggedTrade[], orderedWeeks: string[]): BucketStats {
  const weekly = new Map<string, number>();
  let total = 0;
  let wins = 0;

  for (const trade of trades) {
    weekly.set(trade.weekOpenUtc, (weekly.get(trade.weekOpenUtc) ?? 0) + trade.returnPct);
    total += trade.returnPct;
    if (trade.returnPct > 0) wins += 1;
  }

  const weeklyReturns = orderedWeeks.map((week) => weekly.get(week) ?? 0);
  return {
    trades: trades.length,
    totalReturnPct: round(total),
    avgReturnPct: round(trades.length > 0 ? total / trades.length : 0),
    winRatePct: round(trades.length > 0 ? (wins / trades.length) * 100 : 0, 1),
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    maxDrawdownPct: computeMaxDd(weeklyReturns),
  };
}

function bucketLabelWithSample(label: string, count: number) {
  return count < 20 ? `${label} (*)` : label;
}

function assertEqual(actual: number, expected: number, label: string) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const allWeeks = (await listDataSectionWeeks())
    .filter((week) => normalizeWeekOpenUtc(week) < currentWeek);
  const weeks = allWeeks.slice(-10);

  const baselineAudits = await Promise.all(
    weeks.map((week) => resolveSelectorStrengthTiebreakAudit(week)),
  );
  const baselineByWeek = new Map(
    baselineAudits.map((audit) => [audit.weekOpenUtc, audit] as const),
  );

  const [cotHistory, sentimentBySymbol] = await Promise.all([
    loadCotHistory(),
    loadSentimentHistory(),
  ]);
  const universe = buildPairUniverse();

  const contextsByWeek = new Map<string, Map<string, PairContext>>();
  const weeksToLoad = [...weeks];
  const firstWeekIndex = allWeeks.indexOf(weeks[0]!);
  if (firstWeekIndex > 0) {
    weeksToLoad.unshift(allWeeks[firstWeekIndex - 1]!);
  }

  for (const weekOpenUtc of weeksToLoad) {
    const contexts = await buildContextForWeek(
      weekOpenUtc,
      universe as PairDefWithAsset[],
      cotHistory,
      sentimentBySymbol,
      allWeeks,
      { requireStrength: true },
    );
    contextsByWeek.set(weekOpenUtc, contexts);
  }

  const taggedTrades: TaggedTrade[] = [];

  for (const week of weeks) {
    const audit = baselineByWeek.get(week);
    const contexts = contextsByWeek.get(week);
    const prevWeekIndex = allWeeks.indexOf(week);
    const prevWeek = prevWeekIndex > 0 ? allWeeks[prevWeekIndex - 1]! : null;
    const prevContexts = prevWeek ? contextsByWeek.get(prevWeek) ?? null : null;
    const [pairReturns, adrMap] = await Promise.all([
      getWeeklyPairReturns(week),
      loadWeeklyAdrMap(week),
    ]);
    const returnBySymbol = new Map(pairReturns.map((r) => [r.symbol.toUpperCase(), r]));

    if (!audit || !contexts) {
      throw new Error(`Missing baseline audit/context for ${week}`);
    }

    for (const entry of audit.entries) {
      if (entry.finalDirection === "NEUTRAL") continue;

      const pair = entry.pair.toUpperCase();
      const priceRow = returnBySymbol.get(pair);
      const context = contexts.get(pair);
      if (!priceRow || !context) continue;

      const pairAdr = getAdrPct(adrMap, pair, entry.assetClass);
      const rawReturn =
        entry.finalDirection === "SHORT" ? -priceRow.returnPct : priceRow.returnPct;
      const adrReturn = rawReturn * (TARGET_ADR / pairAdr);

      const commScore = context.commercial.score;
      const commExtremity = context.commercial.extremity;
      const commDir = scoreToDirectionalState(commScore);

      const prevContext = prevContexts?.get(pair) ?? null;
      const prevCommScore = prevContext?.commercial.score ?? null;

      const commercialDiverges =
        commDir !== "NEUTRAL" && commDir !== entry.finalDirection;

      const alignmentBucket: TaggedTrade["alignmentBucket"] =
        commDir === entry.finalDirection
          ? "aligned"
          : commDir === "NEUTRAL" || Math.abs(commScore) < 0.1
            ? "neutral"
            : "opposed";

      const extremityBucket: TaggedTrade["extremityBucket"] =
        commExtremity >= 0.7 ? "high" : commExtremity >= 0.4 ? "medium" : "low";

      let deltaDirection: TaggedTrade["deltaDirection"] = "no_prior";
      if (prevCommScore !== null) {
        const scoreDelta = commScore - prevCommScore;
        const selectorIsLong = entry.finalDirection === "LONG";
        const movingWith = selectorIsLong ? scoreDelta > 0.05 : scoreDelta < -0.05;
        const movingAgainst = selectorIsLong ? scoreDelta < -0.05 : scoreDelta > 0.05;
        deltaDirection = movingWith
          ? "building_with"
          : movingAgainst
            ? "building_against"
            : "stable";
      }

      const fragilityScore = (
        (alignmentBucket === "opposed" ? 1 : 0)
        + (extremityBucket === "high" ? 1 : 0)
        + (deltaDirection === "building_against" ? 1 : 0)
      ) as 0 | 1 | 2 | 3;

      taggedTrades.push({
        weekOpenUtc: week,
        pair,
        assetClass: entry.assetClass,
        selectorDirection: entry.finalDirection,
        returnPct: adrReturn,
        commercialDirection: commDir,
        commercialDiverges,
        alignmentBucket,
        commercialExtremity: commExtremity,
        extremityBucket,
        commercialScoreCurrent: commScore,
        commercialScorePrior: prevCommScore,
        deltaDirection,
        fragilityScore,
      });
    }
  }

  const baseline = computeBucketStats(taggedTrades, weeks);
  assertEqual(baseline.trades, 360, "Baseline trades");
  if (Math.abs(baseline.totalReturnPct - 91.96) > 0.05) {
    throw new Error(`Baseline return mismatch: expected ~91.96, got ${baseline.totalReturnPct}`);
  }
  if (Math.abs(baseline.maxDrawdownPct - 4.01) > 0.05) {
    throw new Error(`Baseline drawdown mismatch: expected ~4.01, got ${baseline.maxDrawdownPct}`);
  }
  if (Math.abs(baseline.winRatePct - 54.2) > 0.2) {
    throw new Error(`Baseline win rate mismatch: expected ~54.2, got ${baseline.winRatePct}`);
  }
  assertEqual(baseline.losingWeeks, 1, "Baseline losing weeks");

  const agreesTrades = taggedTrades.filter((trade) => trade.alignmentBucket === "aligned");
  const neutralTrades = taggedTrades.filter((trade) => trade.alignmentBucket === "neutral");
  const opposesTrades = taggedTrades.filter((trade) => trade.alignmentBucket === "opposed");
  assertEqual(agreesTrades.length + neutralTrades.length + opposesTrades.length, baseline.trades, "Alignment bucket total");

  const lowTrades = taggedTrades.filter((trade) => trade.extremityBucket === "low");
  const mediumTrades = taggedTrades.filter((trade) => trade.extremityBucket === "medium");
  const highTrades = taggedTrades.filter((trade) => trade.extremityBucket === "high");
  assertEqual(lowTrades.length + mediumTrades.length + highTrades.length, baseline.trades, "Extremity bucket total");

  const buildingWithTrades = taggedTrades.filter((trade) => trade.deltaDirection === "building_with");
  const stableTrades = taggedTrades.filter((trade) => trade.deltaDirection === "stable");
  const buildingAgainstTrades = taggedTrades.filter((trade) => trade.deltaDirection === "building_against");
  const noPriorTrades = taggedTrades.filter((trade) => trade.deltaDirection === "no_prior");
  assertEqual(
    buildingWithTrades.length + stableTrades.length + buildingAgainstTrades.length + noPriorTrades.length,
    baseline.trades,
    "Delta bucket total",
  );

  const frag0 = taggedTrades.filter((trade) => trade.fragilityScore === 0);
  const frag1 = taggedTrades.filter((trade) => trade.fragilityScore === 1);
  const frag2 = taggedTrades.filter((trade) => trade.fragilityScore === 2);
  const frag3 = taggedTrades.filter((trade) => trade.fragilityScore === 3);
  assertEqual(frag0.length + frag1.length + frag2.length + frag3.length, baseline.trades, "Fragility bucket total");

  const alignmentStats = {
    agrees: computeBucketStats(agreesTrades, weeks),
    neutral: computeBucketStats(neutralTrades, weeks),
    opposes: computeBucketStats(opposesTrades, weeks),
  };

  const extremityStats = {
    low: computeBucketStats(lowTrades, weeks),
    medium: computeBucketStats(mediumTrades, weeks),
    high: computeBucketStats(highTrades, weeks),
  };

  const deltaStats = {
    buildingWith: computeBucketStats(buildingWithTrades, weeks),
    stable: computeBucketStats(stableTrades, weeks),
    buildingAgainst: computeBucketStats(buildingAgainstTrades, weeks),
    noPrior: computeBucketStats(noPriorTrades, weeks),
  };

  const fragilityStats = {
    zero: computeBucketStats(frag0, weeks),
    one: computeBucketStats(frag1, weeks),
    two: computeBucketStats(frag2, weeks),
    three: computeBucketStats(frag3, weeks),
  };

  const crossTabExtremityAlignment = [
    ["high", "aligned"],
    ["high", "neutral"],
    ["high", "opposed"],
    ["medium", "aligned"],
    ["medium", "neutral"],
    ["medium", "opposed"],
    ["low", "aligned"],
    ["low", "neutral"],
    ["low", "opposed"],
  ] as const;

  const crossTabDeltaAlignment = [
    ["building_with", "aligned"],
    ["building_with", "opposed"],
    ["stable", "aligned"],
    ["stable", "opposed"],
    ["building_against", "aligned"],
    ["building_against", "opposed"],
    ["no_prior", "aligned"],
    ["no_prior", "opposed"],
  ] as const;

  const lines: string[] = [
    "# Commercial Context Tagging Research",
    "",
    `Weeks analyzed: ${weeks.length} (${formatWeek(weeks[0]!)} -> ${formatWeek(weeks.at(-1)!)}).`,
    "Baseline: canonical selector strength_tiebreak.",
    "All returns ADR-normalized.",
    `Total baseline trades: ${baseline.trades}`,
    "",
    "This is a diagnostic pass. No selector directions were changed.",
    "Commercial is evaluated as a state/context descriptor, not a directional signal.",
    "",
    "## Baseline Summary",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Trades | ${baseline.trades} |`,
    `| Total Return | ${signedPct(baseline.totalReturnPct)} |`,
    `| Max Drawdown | ${baseline.maxDrawdownPct.toFixed(2)}% |`,
    `| Win Rate | ${baseline.winRatePct.toFixed(1)}% |`,
    `| Losing Weeks | ${baseline.losingWeeks} |`,
    "",
    "## Tag 1: Commercial Divergence",
    "",
    "Does commercial opposing the selector direction predict worse outcomes?",
    "",
    "| Bucket | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${bucketLabelWithSample("Commercial agrees", agreesTrades.length)} | ${alignmentStats.agrees.trades} | ${signedPct(alignmentStats.agrees.totalReturnPct)} | ${signedPct(alignmentStats.agrees.avgReturnPct)} | ${alignmentStats.agrees.winRatePct.toFixed(1)}% | ${alignmentStats.agrees.maxDrawdownPct.toFixed(2)}% | ${alignmentStats.agrees.losingWeeks} |`,
    `| ${bucketLabelWithSample("Commercial neutral", neutralTrades.length)} | ${alignmentStats.neutral.trades} | ${signedPct(alignmentStats.neutral.totalReturnPct)} | ${signedPct(alignmentStats.neutral.avgReturnPct)} | ${alignmentStats.neutral.winRatePct.toFixed(1)}% | ${alignmentStats.neutral.maxDrawdownPct.toFixed(2)}% | ${alignmentStats.neutral.losingWeeks} |`,
    `| ${bucketLabelWithSample("Commercial opposes", opposesTrades.length)} | ${alignmentStats.opposes.trades} | ${signedPct(alignmentStats.opposes.totalReturnPct)} | ${signedPct(alignmentStats.opposes.avgReturnPct)} | ${alignmentStats.opposes.winRatePct.toFixed(1)}% | ${alignmentStats.opposes.maxDrawdownPct.toFixed(2)}% | ${alignmentStats.opposes.losingWeeks} |`,
    "",
    "## Tag 2: Alignment Confidence",
    "",
    "Three-tier alignment bucketing.",
    "",
    "| Bucket | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${bucketLabelWithSample("aligned", agreesTrades.length)} | ${alignmentStats.agrees.trades} | ${signedPct(alignmentStats.agrees.totalReturnPct)} | ${signedPct(alignmentStats.agrees.avgReturnPct)} | ${alignmentStats.agrees.winRatePct.toFixed(1)}% | ${alignmentStats.agrees.maxDrawdownPct.toFixed(2)}% | ${alignmentStats.agrees.losingWeeks} |`,
    `| ${bucketLabelWithSample("neutral", neutralTrades.length)} | ${alignmentStats.neutral.trades} | ${signedPct(alignmentStats.neutral.totalReturnPct)} | ${signedPct(alignmentStats.neutral.avgReturnPct)} | ${alignmentStats.neutral.winRatePct.toFixed(1)}% | ${alignmentStats.neutral.maxDrawdownPct.toFixed(2)}% | ${alignmentStats.neutral.losingWeeks} |`,
    `| ${bucketLabelWithSample("opposed", opposesTrades.length)} | ${alignmentStats.opposes.trades} | ${signedPct(alignmentStats.opposes.totalReturnPct)} | ${signedPct(alignmentStats.opposes.avgReturnPct)} | ${alignmentStats.opposes.winRatePct.toFixed(1)}% | ${alignmentStats.opposes.maxDrawdownPct.toFixed(2)}% | ${alignmentStats.opposes.losingWeeks} |`,
    "",
    "## Tag 3: Commercial Extremity State",
    "",
    "Does commercial extremity level change outcome quality?",
    "",
    "### All Trades by Extremity",
    "",
    "| Extremity | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${bucketLabelWithSample("low (<0.4)", lowTrades.length)} | ${extremityStats.low.trades} | ${signedPct(extremityStats.low.totalReturnPct)} | ${signedPct(extremityStats.low.avgReturnPct)} | ${extremityStats.low.winRatePct.toFixed(1)}% | ${extremityStats.low.maxDrawdownPct.toFixed(2)}% | ${extremityStats.low.losingWeeks} |`,
    `| ${bucketLabelWithSample("medium (0.4-0.7)", mediumTrades.length)} | ${extremityStats.medium.trades} | ${signedPct(extremityStats.medium.totalReturnPct)} | ${signedPct(extremityStats.medium.avgReturnPct)} | ${extremityStats.medium.winRatePct.toFixed(1)}% | ${extremityStats.medium.maxDrawdownPct.toFixed(2)}% | ${extremityStats.medium.losingWeeks} |`,
    `| ${bucketLabelWithSample("high (≥0.7)", highTrades.length)} | ${extremityStats.high.trades} | ${signedPct(extremityStats.high.totalReturnPct)} | ${signedPct(extremityStats.high.avgReturnPct)} | ${extremityStats.high.winRatePct.toFixed(1)}% | ${extremityStats.high.maxDrawdownPct.toFixed(2)}% | ${extremityStats.high.losingWeeks} |`,
    "",
    "### Extremity × Alignment Cross-Tab",
    "",
    "This is the key diagnostic. Does high extremity + opposition predict fragile trades?",
    "",
    "| Extremity | Alignment | Trades | Total% | Avg% | Win% |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...crossTabExtremityAlignment.map(([extremity, alignment]) => {
      const subset = taggedTrades.filter(
        (trade) => trade.extremityBucket === extremity && trade.alignmentBucket === alignment,
      );
      const stats = computeBucketStats(subset, weeks);
      return `| ${extremity} | ${bucketLabelWithSample(alignment, subset.length)} | ${stats.trades} | ${signedPct(stats.totalReturnPct)} | ${signedPct(stats.avgReturnPct)} | ${stats.winRatePct.toFixed(1)}% |`;
    }),
    "",
    "## Tag 4: Commercial Delta-Persistence",
    "",
    "Is commercial flow building with or against the selector direction?",
    "",
    "| Flow Direction | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${bucketLabelWithSample("building_with", buildingWithTrades.length)} | ${deltaStats.buildingWith.trades} | ${signedPct(deltaStats.buildingWith.totalReturnPct)} | ${signedPct(deltaStats.buildingWith.avgReturnPct)} | ${deltaStats.buildingWith.winRatePct.toFixed(1)}% | ${deltaStats.buildingWith.maxDrawdownPct.toFixed(2)}% | ${deltaStats.buildingWith.losingWeeks} |`,
    `| ${bucketLabelWithSample("stable", stableTrades.length)} | ${deltaStats.stable.trades} | ${signedPct(deltaStats.stable.totalReturnPct)} | ${signedPct(deltaStats.stable.avgReturnPct)} | ${deltaStats.stable.winRatePct.toFixed(1)}% | ${deltaStats.stable.maxDrawdownPct.toFixed(2)}% | ${deltaStats.stable.losingWeeks} |`,
    `| ${bucketLabelWithSample("building_against", buildingAgainstTrades.length)} | ${deltaStats.buildingAgainst.trades} | ${signedPct(deltaStats.buildingAgainst.totalReturnPct)} | ${signedPct(deltaStats.buildingAgainst.avgReturnPct)} | ${deltaStats.buildingAgainst.winRatePct.toFixed(1)}% | ${deltaStats.buildingAgainst.maxDrawdownPct.toFixed(2)}% | ${deltaStats.buildingAgainst.losingWeeks} |`,
    `| ${bucketLabelWithSample("no_prior", noPriorTrades.length)} | ${deltaStats.noPrior.trades} | ${signedPct(deltaStats.noPrior.totalReturnPct)} | ${signedPct(deltaStats.noPrior.avgReturnPct)} | ${deltaStats.noPrior.winRatePct.toFixed(1)}% | ${deltaStats.noPrior.maxDrawdownPct.toFixed(2)}% | ${deltaStats.noPrior.losingWeeks} |`,
    "",
    "### Delta-Persistence × Alignment Cross-Tab",
    "",
    "| Flow | Alignment | Trades | Total% | Avg% | Win% |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...crossTabDeltaAlignment.map(([flow, alignment]) => {
      const subset = taggedTrades.filter(
        (trade) => trade.deltaDirection === flow && trade.alignmentBucket === alignment,
      );
      const stats = computeBucketStats(subset, weeks);
      return `| ${flow} | ${bucketLabelWithSample(alignment, subset.length)} | ${stats.trades} | ${signedPct(stats.totalReturnPct)} | ${signedPct(stats.avgReturnPct)} | ${stats.winRatePct.toFixed(1)}% |`;
    }),
    "",
    "## Combined Fragility Score",
    "",
    "Score = sum of:",
    "- commercial opposed: +1",
    "- commercial extremity high: +1",
    "- commercial flow building against: +1",
    "",
    "| Fragility Score | Trades | Total% | Avg% | Win% | MaxDD% |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| ${bucketLabelWithSample("0 (no flags)", frag0.length)} | ${fragilityStats.zero.trades} | ${signedPct(fragilityStats.zero.totalReturnPct)} | ${signedPct(fragilityStats.zero.avgReturnPct)} | ${fragilityStats.zero.winRatePct.toFixed(1)}% | ${fragilityStats.zero.maxDrawdownPct.toFixed(2)}% |`,
    `| ${bucketLabelWithSample("1 (one flag)", frag1.length)} | ${fragilityStats.one.trades} | ${signedPct(fragilityStats.one.totalReturnPct)} | ${signedPct(fragilityStats.one.avgReturnPct)} | ${fragilityStats.one.winRatePct.toFixed(1)}% | ${fragilityStats.one.maxDrawdownPct.toFixed(2)}% |`,
    `| ${bucketLabelWithSample("2 (two flags)", frag2.length)} | ${fragilityStats.two.trades} | ${signedPct(fragilityStats.two.totalReturnPct)} | ${signedPct(fragilityStats.two.avgReturnPct)} | ${fragilityStats.two.winRatePct.toFixed(1)}% | ${fragilityStats.two.maxDrawdownPct.toFixed(2)}% |`,
    `| ${bucketLabelWithSample("3 (all flags)", frag3.length)} | ${fragilityStats.three.trades} | ${signedPct(fragilityStats.three.totalReturnPct)} | ${signedPct(fragilityStats.three.avgReturnPct)} | ${fragilityStats.three.winRatePct.toFixed(1)}% | ${fragilityStats.three.maxDrawdownPct.toFixed(2)}% |`,
    "",
    "## Divergence by Asset Class",
    "",
  ];

  for (const assetClass of ["fx", "crypto", "indices", "commodities"] as const) {
    const assetTrades = taggedTrades.filter((trade) => trade.assetClass === assetClass);
    const assetAgrees = assetTrades.filter((trade) => trade.alignmentBucket === "aligned");
    const assetNeutral = assetTrades.filter((trade) => trade.alignmentBucket === "neutral");
    const assetOpposes = assetTrades.filter((trade) => trade.alignmentBucket === "opposed");
    const assetWeeks = weeks;

    const agreeStats = computeBucketStats(assetAgrees, assetWeeks);
    const neutralStats = computeBucketStats(assetNeutral, assetWeeks);
    const opposeStats = computeBucketStats(assetOpposes, assetWeeks);

    lines.push(`### ${assetClass}`);
    lines.push("");
    lines.push("| Bucket | Trades | Total% | Win% |");
    lines.push("| --- | ---: | ---: | ---: |");
    lines.push(`| ${bucketLabelWithSample("agrees", assetAgrees.length)} | ${agreeStats.trades} | ${signedPct(agreeStats.totalReturnPct)} | ${agreeStats.winRatePct.toFixed(1)}% |`);
    lines.push(`| ${bucketLabelWithSample("neutral", assetNeutral.length)} | ${neutralStats.trades} | ${signedPct(neutralStats.totalReturnPct)} | ${neutralStats.winRatePct.toFixed(1)}% |`);
    lines.push(`| ${bucketLabelWithSample("opposes", assetOpposes.length)} | ${opposeStats.trades} | ${signedPct(opposeStats.totalReturnPct)} | ${opposeStats.winRatePct.toFixed(1)}% |`);
    lines.push("");
  }

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
