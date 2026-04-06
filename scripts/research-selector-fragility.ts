/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-selector-fragility.ts
 *
 * Description:
 * Selector fragility formula research. Tests concrete skip formulas built
 * from commercial-derived fragility tags on top of the canonical selector.
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
  type SourceMetrics,
} from "../src/lib/performance/selectorEngine";
import type { AssetClass } from "../src/lib/cotMarkets";
import { normalizeWeekOpenUtc, getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

type VariantId =
  | "baseline"
  | "skip_score_3"
  | "skip_score_2_3"
  | "skip_building_against"
  | "skip_building_against_opposed"
  | "skip_high_extremity_opposed"
  | "skip_score_1_2_3"
  | "skip_opposed_and_building_against";

type TradeRow = {
  weekOpenUtc: string;
  pair: string;
  assetClass: AssetClass;
  direction: Direction;
  returnPct: number;
  fragilityScore: number;
  opposed: boolean;
  highExtremity: boolean;
  buildingAgainst: boolean;
};

type VariantStats = {
  id: VariantId;
  label: string;
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  losingWeeks: number;
  tradesPerWeek: number;
  skippedTrades: number;
  skippedReturnPct: number;
  skippedWinRatePct: number;
  byAssetClass: Record<string, { trades: number; totalReturnPct: number; winRatePct: number }>;
};

type Fragility = {
  score: number;
  opposed: boolean;
  highExtremity: boolean;
  buildingAgainst: boolean;
};

const OUTPUT_PATH = "docs/SELECTOR_FRAGILITY_RESEARCH_2026-04-06.md";
const TARGET_ADR = getTargetAdrPct();

const VARIANT_LABELS: Record<VariantId, string> = {
  baseline: "Baseline strength_tiebreak",
  skip_score_3: "Skip fragility 3",
  skip_score_2_3: "Skip fragility 2-3",
  skip_building_against: "Skip building_against",
  skip_building_against_opposed: "Skip building_against + opposed",
  skip_high_extremity_opposed: "Skip high_extremity + opposed",
  skip_score_1_2_3: "Skip fragility 1-2-3 (score 0 only)",
  skip_opposed_and_building_against: "Skip opposed OR building_against",
};

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

function scoreToDir(score: number): SelectorDirectionalState {
  return Math.abs(score) <= 0.000001 ? "NEUTRAL" : score >= 0 ? "LONG" : "SHORT";
}

function computeFragilityScore(
  selectorDirection: Direction,
  commercial: SourceMetrics,
  prevCommercial: SourceMetrics | null,
): Fragility {
  const commDir = scoreToDir(commercial.score);
  const opposed =
    commDir !== "NEUTRAL"
    && commDir !== selectorDirection
    && Math.abs(commercial.score) >= 0.1;
  const highExtremity = commercial.extremity >= 0.7;

  let buildingAgainst = false;
  if (prevCommercial !== null) {
    const scoreDelta = commercial.score - prevCommercial.score;
    const selectorIsLong = selectorDirection === "LONG";
    buildingAgainst = selectorIsLong ? scoreDelta < -0.05 : scoreDelta > 0.05;
  }

  const score = (opposed ? 1 : 0) + (highExtremity ? 1 : 0) + (buildingAgainst ? 1 : 0);
  return { score, opposed, highExtremity, buildingAgainst };
}

function shouldSkip(variant: VariantId, fragility: Fragility): boolean {
  switch (variant) {
    case "baseline":
      return false;
    case "skip_score_3":
      return fragility.score >= 3;
    case "skip_score_2_3":
      return fragility.score >= 2;
    case "skip_building_against":
      return fragility.buildingAgainst;
    case "skip_building_against_opposed":
      return fragility.buildingAgainst && fragility.opposed;
    case "skip_high_extremity_opposed":
      return fragility.highExtremity && fragility.opposed;
    case "skip_score_1_2_3":
      return fragility.score >= 1;
    case "skip_opposed_and_building_against":
      return fragility.opposed || fragility.buildingAgainst;
  }
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

function buildStats(
  weeks: string[],
  kept: TradeRow[],
  skipped: TradeRow[],
): Omit<VariantStats, "id" | "label"> {
  const weekly = new Map<string, number>();
  const byAssetClass = new Map<string, { trades: number; returnPct: number; wins: number }>();
  let total = 0;
  let wins = 0;

  for (const trade of kept) {
    weekly.set(trade.weekOpenUtc, (weekly.get(trade.weekOpenUtc) ?? 0) + trade.returnPct);
    total += trade.returnPct;
    if (trade.returnPct > 0) wins += 1;
    const bucket = byAssetClass.get(trade.assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    bucket.trades += 1;
    bucket.returnPct += trade.returnPct;
    if (trade.returnPct > 0) bucket.wins += 1;
    byAssetClass.set(trade.assetClass, bucket);
  }

  const skippedTotal = skipped.reduce((sum, trade) => sum + trade.returnPct, 0);
  const skippedWins = skipped.filter((trade) => trade.returnPct > 0).length;

  const weeklyReturns = weeks.map((week) => weekly.get(week) ?? 0);
  const byAssetClassRecord: VariantStats["byAssetClass"] = {};
  for (const assetClass of ["fx", "crypto", "indices", "commodities"] as const) {
    const bucket = byAssetClass.get(assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    byAssetClassRecord[assetClass] = {
      trades: bucket.trades,
      totalReturnPct: round(bucket.returnPct),
      winRatePct: round(bucket.trades > 0 ? (bucket.wins / bucket.trades) * 100 : 0, 1),
    };
  }

  return {
    trades: kept.length,
    totalReturnPct: round(total),
    maxDrawdownPct: computeMaxDd(weeklyReturns),
    winRatePct: round(kept.length > 0 ? (wins / kept.length) * 100 : 0, 1),
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    tradesPerWeek: round(kept.length / weeks.length, 1),
    skippedTrades: skipped.length,
    skippedReturnPct: round(skippedTotal),
    skippedWinRatePct: round(skipped.length > 0 ? (skippedWins / skipped.length) * 100 : 0, 1),
    byAssetClass: byAssetClassRecord,
  };
}

function assertClose(actual: number, expected: number, tolerance: number, label: string) {
  if (Math.abs(actual - expected) > tolerance) {
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
  const baselineByWeek = new Map(baselineAudits.map((audit) => [audit.weekOpenUtc, audit] as const));

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

  const allTrades: TradeRow[] = [];

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
      const rawReturn = entry.finalDirection === "SHORT" ? -priceRow.returnPct : priceRow.returnPct;
      const adrReturn = rawReturn * (TARGET_ADR / pairAdr);
      const prevCommercial = prevContexts?.get(pair)?.commercial ?? null;
      const fragility = computeFragilityScore(entry.finalDirection, context.commercial, prevCommercial);

      allTrades.push({
        weekOpenUtc: week,
        pair,
        assetClass: entry.assetClass,
        direction: entry.finalDirection,
        returnPct: adrReturn,
        fragilityScore: fragility.score,
        opposed: fragility.opposed,
        highExtremity: fragility.highExtremity,
        buildingAgainst: fragility.buildingAgainst,
      });
    }
  }

  const score0 = allTrades.filter((trade) => trade.fragilityScore === 0).length;
  const score1 = allTrades.filter((trade) => trade.fragilityScore === 1).length;
  const score2 = allTrades.filter((trade) => trade.fragilityScore === 2).length;
  const score3 = allTrades.filter((trade) => trade.fragilityScore === 3).length;

  assertClose(score0, 58, 0, "Fragility score 0");
  assertClose(score1, 143, 0, "Fragility score 1");
  assertClose(score2, 144, 0, "Fragility score 2");
  assertClose(score3, 15, 0, "Fragility score 3");

  const variants: VariantId[] = [
    "baseline",
    "skip_score_3",
    "skip_score_2_3",
    "skip_building_against",
    "skip_building_against_opposed",
    "skip_high_extremity_opposed",
    "skip_score_1_2_3",
    "skip_opposed_and_building_against",
  ];

  const results: VariantStats[] = variants.map((variant) => {
    const kept = allTrades.filter((trade) => !shouldSkip(variant, {
      score: trade.fragilityScore,
      opposed: trade.opposed,
      highExtremity: trade.highExtremity,
      buildingAgainst: trade.buildingAgainst,
    }));
    const skipped = allTrades.filter((trade) => shouldSkip(variant, {
      score: trade.fragilityScore,
      opposed: trade.opposed,
      highExtremity: trade.highExtremity,
      buildingAgainst: trade.buildingAgainst,
    }));
    return {
      id: variant,
      label: VARIANT_LABELS[variant],
      ...buildStats(weeks, kept, skipped),
    };
  });

  const baseline = results.find((result) => result.id === "baseline");
  if (!baseline) throw new Error("Missing baseline result");

  assertClose(baseline.trades, 360, 0, "Baseline trades");
  assertClose(baseline.totalReturnPct, 91.96, 0.05, "Baseline return");
  assertClose(baseline.maxDrawdownPct, 4.01, 0.05, "Baseline DD");
  assertClose(baseline.winRatePct, 54.2, 0.2, "Baseline WR");
  assertClose(baseline.losingWeeks, 1, 0, "Baseline losing weeks");

  const skipScore3 = results.find((result) => result.id === "skip_score_3");
  const skipScore23 = results.find((result) => result.id === "skip_score_2_3");
  if (!skipScore3 || !skipScore23) throw new Error("Missing skip variants");
  assertClose(skipScore3.skippedTrades, 15, 0, "skip_score_3 removals");
  assertClose(skipScore23.skippedTrades, 159, 0, "skip_score_2_3 removals");
  assertClose(round(baseline.totalReturnPct), round(skipScore3.totalReturnPct + skipScore3.skippedReturnPct), 0.05, "skip_score_3 return sum");

  const topThree = [...results]
    .sort((left, right) => {
      if (left.losingWeeks !== right.losingWeeks) return left.losingWeeks - right.losingWeeks;
      if (left.maxDrawdownPct !== right.maxDrawdownPct) return left.maxDrawdownPct - right.maxDrawdownPct;
      return right.totalReturnPct - left.totalReturnPct;
    })
    .slice(0, 3);

  const perWeekMaps = new Map<VariantId, Map<string, { trades: number; returnPct: number }>>();
  for (const variant of variants) {
    const map = new Map<string, { trades: number; returnPct: number }>();
    for (const trade of allTrades) {
      const skip = shouldSkip(variant, {
        score: trade.fragilityScore,
        opposed: trade.opposed,
        highExtremity: trade.highExtremity,
        buildingAgainst: trade.buildingAgainst,
      });
      if (skip) continue;
      const bucket = map.get(trade.weekOpenUtc) ?? { trades: 0, returnPct: 0 };
      bucket.trades += 1;
      bucket.returnPct += trade.returnPct;
      map.set(trade.weekOpenUtc, bucket);
    }
    perWeekMaps.set(variant, map);
  }

  const lines: string[] = [
    "# Selector Fragility Formula Research",
    "",
    `Weeks analyzed: ${weeks.length} (${formatWeek(weeks[0]!)} -> ${formatWeek(weeks.at(-1)!)}).`,
    "Baseline: canonical selector strength_tiebreak.",
    "All returns ADR-normalized.",
    "",
    "Fragility score = commercial opposed (+1) + high extremity (+1) + building against (+1).",
    "",
    "## Master Comparison",
    "",
    "| Variant | Trades | Skipped | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Skipped Return | Skipped WR |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...results
      .sort((left, right) => {
        if (left.losingWeeks !== right.losingWeeks) return left.losingWeeks - right.losingWeeks;
        if (left.maxDrawdownPct !== right.maxDrawdownPct) return left.maxDrawdownPct - right.maxDrawdownPct;
        return right.totalReturnPct - left.totalReturnPct;
      })
      .map((row) => `| ${row.label} | ${row.trades} | ${row.skippedTrades} | ${signedPct(row.totalReturnPct)} | ${row.maxDrawdownPct.toFixed(2)}% | ${row.winRatePct.toFixed(1)}% | ${row.losingWeeks} | ${row.tradesPerWeek.toFixed(1)} | ${signedPct(row.skippedReturnPct)} | ${row.skippedWinRatePct.toFixed(1)}% |`),
    "",
    "## Asset Breakdown",
    "",
  ];

  for (const result of results) {
    lines.push(`### ${result.label}`);
    lines.push("");
    lines.push("| Asset Class | Trades | Total% | Win% |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const assetClass of ["fx", "crypto", "indices", "commodities"] as const) {
      const row = result.byAssetClass[assetClass];
      lines.push(`| ${assetClass} | ${row.trades} | ${signedPct(row.totalReturnPct)} | ${row.winRatePct.toFixed(1)}% |`);
    }
    lines.push("");
  }

  for (const top of topThree) {
    lines.push(`## Skipped Trades: ${top.label}`);
    lines.push("");
    lines.push("| Week | Pair | Direction | Return% | Fragility | Opposed | High Ext | Building Against |");
    lines.push("| --- | --- | --- | ---: | ---: | --- | --- | --- |");
    const skipped = allTrades
      .filter((trade) => shouldSkip(top.id, {
        score: trade.fragilityScore,
        opposed: trade.opposed,
        highExtremity: trade.highExtremity,
        buildingAgainst: trade.buildingAgainst,
      }))
      .sort((left, right) => {
        if (left.weekOpenUtc !== right.weekOpenUtc) return left.weekOpenUtc.localeCompare(right.weekOpenUtc);
        return left.pair.localeCompare(right.pair);
      });
    for (const trade of skipped) {
      lines.push(`| ${formatWeek(trade.weekOpenUtc)} | ${trade.pair} | ${trade.direction} | ${signedPct(trade.returnPct)} | ${trade.fragilityScore} | ${trade.opposed ? "Y" : "N"} | ${trade.highExtremity ? "Y" : "N"} | ${trade.buildingAgainst ? "Y" : "N"} |`);
    }
    lines.push("");
  }

  lines.push("## Per-Week Profile");
  lines.push("");
  lines.push(`| Week | Baseline Trades | Baseline Return | ${topThree[0]!.label} Trades | ${topThree[0]!.label} Return | ${topThree[1]!.label} Trades | ${topThree[1]!.label} Return | ${topThree[2]!.label} Trades | ${topThree[2]!.label} Return |`);
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const week of weeks) {
    const baselineWeek = perWeekMaps.get("baseline")?.get(week) ?? { trades: 0, returnPct: 0 };
    const a = perWeekMaps.get(topThree[0]!.id)?.get(week) ?? { trades: 0, returnPct: 0 };
    const b = perWeekMaps.get(topThree[1]!.id)?.get(week) ?? { trades: 0, returnPct: 0 };
    const c = perWeekMaps.get(topThree[2]!.id)?.get(week) ?? { trades: 0, returnPct: 0 };
    lines.push(`| ${formatWeek(week)} | ${baselineWeek.trades} | ${signedPct(baselineWeek.returnPct)} | ${a.trades} | ${signedPct(a.returnPct)} | ${b.trades} | ${signedPct(b.returnPct)} | ${c.trades} | ${signedPct(c.returnPct)} |`);
  }

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
