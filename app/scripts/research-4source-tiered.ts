/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-4source-tiered.ts
 *
 * Description:
 * Canonical 4-source weighted tiered research using fixed coarse weights.
 * Compares weighted scoring variants, dealer-led confirmation, and both
 * 4-source agreement baselines on the canonical basket path.
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
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

type Direction = "LONG" | "SHORT";
type StrategyId =
  | "tiered_W1"
  | "tiered_W1_t2"
  | "tiered_W2"
  | "tiered_W2_t2"
  | "tiered_W3"
  | "tiered_W3_t2"
  | "dealer_led"
  | "agree_3of4_skip"
  | "agree_3of4_selective"
  | "dealer";
type WeightPackId = "W1" | "W2" | "W3";

type WeightPack = {
  id: WeightPackId;
  label: string;
  dealer: number;
  commercial: number;
  sentiment: number;
  strength: number;
};

type TierThresholds = {
  tier1: number;
  tier2: number;
  skip: number;
};

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  dealer: Direction | null;
  commercial: Direction | null;
  sentiment: Direction | null;
  strength: Direction | null;
};

type Resolution = {
  direction: Direction | null;
  tier: number | null;
  score: number | null;
};

type ScoreDistribution = {
  tier1: number;
  tier2: number;
  tier3: number;
  skip: number;
  minAbs: number;
  maxAbs: number;
  meanAbs: number;
};

type TierPerformance = {
  tier: number;
  trades: number;
  totalReturnPct: number;
  avgReturnPct: number;
  winRatePct: number;
};

type Stats = {
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  losingWeeks: number;
  coveragePct: number;
  tradesPerWeek: number;
};

type AssetBreakdownRow = {
  assetClass: AssetClass | "combined";
  stats: Stats;
};

type StrategyResult = {
  id: StrategyId;
  label: string;
  breakdown: AssetBreakdownRow[];
  combined: Stats;
};

const OUTPUT_PATH = "docs/4SOURCE_TIERED_RESEARCH_2026-04-05.md";
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
const TARGET_ADR = getTargetAdrPct();
const THRESHOLDS: TierThresholds = { tier1: 4.0, tier2: 2.0, skip: 0 };

const WEIGHT_PACKS: WeightPack[] = [
  { id: "W1", label: "D=2.0 St=1.5 Se=1.25 C=0.75", dealer: 2.0, strength: 1.5, sentiment: 1.25, commercial: 0.75 },
  { id: "W2", label: "D=2.0 St=1.5 Se=1.5 C=0.5", dealer: 2.0, strength: 1.5, sentiment: 1.5, commercial: 0.5 },
  { id: "W3", label: "D=1.75 St=1.5 Se=1.5 C=0.75", dealer: 1.75, strength: 1.5, sentiment: 1.5, commercial: 0.75 },
];

const STRATEGY_LABELS: Record<StrategyId, string> = {
  tiered_W1: "W1 Full",
  tiered_W1_t2: "W1 T2",
  tiered_W2: "W2 Full",
  tiered_W2_t2: "W2 T2",
  tiered_W3: "W3 Full",
  tiered_W3_t2: "W3 T2",
  dealer_led: "Dealer-Led",
  agree_3of4_skip: "agree_3of4 skip",
  agree_3of4_selective: "agree_3of4 selective",
  dealer: "Dealer standalone",
};

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function signedPct(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function directionalReturn(rawReturnPct: number, direction: Direction) {
  return direction === "SHORT" ? -rawReturnPct : rawReturnPct;
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

function buildDirectionMap(signals: ReturnType<typeof nonNeutralSignals>) {
  return new Map(signals.map((signal) => [signal.symbol.toUpperCase(), signal.direction as Direction] as const));
}

function computeWeightedScore(row: Row, weights: WeightPack) {
  let score = 0;
  if (row.dealer === "LONG") score += weights.dealer;
  else if (row.dealer === "SHORT") score -= weights.dealer;

  if (row.commercial === "LONG") score += weights.commercial;
  else if (row.commercial === "SHORT") score -= weights.commercial;

  if (row.sentiment === "LONG") score += weights.sentiment;
  else if (row.sentiment === "SHORT") score -= weights.sentiment;

  if (row.strength === "LONG") score += weights.strength;
  else if (row.strength === "SHORT") score -= weights.strength;

  return score;
}

function resolveWeighted(row: Row, weights: WeightPack, thresholds: TierThresholds, skipTier3: boolean): Resolution {
  const score = computeWeightedScore(row, weights);
  const absScore = Math.abs(score);

  if (absScore >= thresholds.tier1) {
    return { direction: score > 0 ? "LONG" : "SHORT", tier: 1, score };
  }
  if (absScore >= thresholds.tier2) {
    return { direction: score > 0 ? "LONG" : "SHORT", tier: 2, score };
  }
  if (!skipTier3 && absScore > thresholds.skip) {
    return { direction: score > 0 ? "LONG" : "SHORT", tier: 3, score };
  }
  return { direction: null, tier: null, score };
}

function resolveDealerLed(row: Row): Resolution {
  if (!row.dealer) return { direction: null, tier: null, score: null };
  const others = [row.commercial, row.sentiment, row.strength].filter(Boolean) as Direction[];
  const agreeing = others.filter((direction) => direction === row.dealer).length;
  if (agreeing === 3) return { direction: row.dealer, tier: 1, score: null };
  if (agreeing === 2) return { direction: row.dealer, tier: 2, score: null };
  if (agreeing === 1) return { direction: row.dealer, tier: 3, score: null };
  return { direction: null, tier: null, score: null };
}

function resolveAgreeSkip(row: Row): Resolution {
  const votes = [row.dealer, row.commercial, row.sentiment, row.strength].filter(Boolean) as Direction[];
  const longs = votes.filter((direction) => direction === "LONG").length;
  const shorts = votes.filter((direction) => direction === "SHORT").length;
  if (longs >= 3) return { direction: "LONG", tier: null, score: null };
  if (shorts >= 3) return { direction: "SHORT", tier: null, score: null };
  return { direction: null, tier: null, score: null };
}

function resolveAgreeSelective(row: Row): Resolution {
  const base = resolveAgreeSkip(row);
  if (base.direction) return base;
  const { dealer, commercial, sentiment, strength } = row;
  if (!dealer || !commercial || !sentiment || !strength) return base;
  if (dealer === commercial && sentiment === strength && dealer !== sentiment) {
    return { direction: sentiment, tier: null, score: null };
  }
  return base;
}

function resolveDealerStandalone(row: Row): Resolution {
  return { direction: row.dealer, tier: null, score: null };
}

function resolveStrategy(row: Row, strategyId: StrategyId): Resolution {
  switch (strategyId) {
    case "tiered_W1":
      return resolveWeighted(row, WEIGHT_PACKS[0]!, THRESHOLDS, false);
    case "tiered_W1_t2":
      return resolveWeighted(row, WEIGHT_PACKS[0]!, THRESHOLDS, true);
    case "tiered_W2":
      return resolveWeighted(row, WEIGHT_PACKS[1]!, THRESHOLDS, false);
    case "tiered_W2_t2":
      return resolveWeighted(row, WEIGHT_PACKS[1]!, THRESHOLDS, true);
    case "tiered_W3":
      return resolveWeighted(row, WEIGHT_PACKS[2]!, THRESHOLDS, false);
    case "tiered_W3_t2":
      return resolveWeighted(row, WEIGHT_PACKS[2]!, THRESHOLDS, true);
    case "dealer_led":
      return resolveDealerLed(row);
    case "agree_3of4_skip":
      return resolveAgreeSkip(row);
    case "agree_3of4_selective":
      return resolveAgreeSelective(row);
    case "dealer":
      return resolveDealerStandalone(row);
  }
}

function computeStats(rows: Row[], weeks: string[], strategyId: StrategyId): Stats {
  const weekly = new Map<string, number>();
  let trades = 0;
  let wins = 0;
  let totalReturnPct = 0;

  for (const row of rows) {
    const resolved = resolveStrategy(row, strategyId);
    if (!resolved.direction) continue;
    const ret = directionalReturn(row.rawReturnPct, resolved.direction) * row.adrMultiplier;
    weekly.set(row.weekOpenUtc, (weekly.get(row.weekOpenUtc) ?? 0) + ret);
    trades += 1;
    totalReturnPct += ret;
    if (ret > 0) wins += 1;
  }

  const weeklyReturns = weeks.map((week) => weekly.get(week) ?? 0);
  return {
    trades,
    totalReturnPct: round(totalReturnPct),
    maxDrawdownPct: computeMaxDd(weeklyReturns),
    winRatePct: round(trades > 0 ? (wins / trades) * 100 : 0, 1),
    losingWeeks: weeklyReturns.filter((ret) => ret < 0).length,
    coveragePct: round((trades / rows.length) * 100, 1),
    tradesPerWeek: round(trades / weeks.length, 1),
  };
}

function computeBreakdown(rows: Row[], weeks: string[], strategyId: StrategyId): AssetBreakdownRow[] {
  const perAsset = ASSET_CLASSES.map((assetClass) => ({
    assetClass,
    stats: computeStats(rows.filter((row) => row.assetClass === assetClass), weeks, strategyId),
  }));
  return [
    ...perAsset,
    { assetClass: "combined", stats: computeStats(rows, weeks, strategyId) },
  ];
}

function computeScoreDistribution(rows: Row[], weights: WeightPack): ScoreDistribution {
  const absScores = rows.map((row) => Math.abs(computeWeightedScore(row, weights)));
  const tier1 = absScores.filter((score) => score >= THRESHOLDS.tier1).length;
  const tier2 = absScores.filter((score) => score >= THRESHOLDS.tier2 && score < THRESHOLDS.tier1).length;
  const tier3 = absScores.filter((score) => score > THRESHOLDS.skip && score < THRESHOLDS.tier2).length;
  const skip = absScores.filter((score) => score === 0).length;
  const totalAbs = absScores.reduce((sum, score) => sum + score, 0);
  return {
    tier1,
    tier2,
    tier3,
    skip,
    minAbs: round(Math.min(...absScores)),
    maxAbs: round(Math.max(...absScores)),
    meanAbs: round(totalAbs / absScores.length),
  };
}

function computeTierPerformance(rows: Row[], weights: WeightPack): TierPerformance[] {
  const buckets = new Map<number, number[]>();
  for (const row of rows) {
    const resolved = resolveWeighted(row, weights, THRESHOLDS, false);
    if (!resolved.direction || !resolved.tier) continue;
    const ret = directionalReturn(row.rawReturnPct, resolved.direction) * row.adrMultiplier;
    if (!buckets.has(resolved.tier)) buckets.set(resolved.tier, []);
    buckets.get(resolved.tier)!.push(ret);
  }
  return [1, 2, 3].map((tier) => {
    const returns = buckets.get(tier) ?? [];
    const totalReturnPct = returns.reduce((sum, ret) => sum + ret, 0);
    const wins = returns.filter((ret) => ret > 0).length;
    return {
      tier,
      trades: returns.length,
      totalReturnPct: round(totalReturnPct),
      avgReturnPct: round(returns.length > 0 ? totalReturnPct / returns.length : 0),
      winRatePct: round(returns.length > 0 ? (wins / returns.length) * 100 : 0, 1),
    };
  });
}

function formatAssetBreakdown(result: StrategyResult) {
  return [
    `### ${result.label}`,
    "",
    "| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...result.breakdown.map((row) => {
      const label = row.assetClass === "combined" ? "combined" : row.assetClass;
      return `| ${label} | ${row.stats.trades} | ${signedPct(row.stats.totalReturnPct)} | ${row.stats.maxDrawdownPct.toFixed(2)}% | ${row.stats.winRatePct.toFixed(1)}% | ${row.stats.losingWeeks} | ${row.stats.coveragePct.toFixed(1)}% |`;
    }),
    "",
  ].join("\n");
}

function assertApprox(name: string, actual: number, expected: number, tolerance = 0.01) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${name} mismatch: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const weeks = (await listDataSectionWeeks()).filter((week) => normalizeWeekOpenUtc(week) < currentWeek);
  const rows: Row[] = [];

  for (const weekOpenUtc of weeks) {
    const basket = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "dealer")));
    const commercialMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "commercial")));
    const sentimentMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "sentiment")));
    const strengthMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "strength")));
    const returns = await getWeeklyPairReturns(weekOpenUtc);
    const returnMap = new Map(returns.map((row) => [row.symbol.toUpperCase(), row] as const));
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const priceRow = returnMap.get(pair);
        if (!priceRow) continue;
        const pairAdr = getAdrPct(adrMap, pair, assetClass);
        rows.push({
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: priceRow.returnPct,
          adrMultiplier: TARGET_ADR / pairAdr,
          dealer: dealerMap.get(pair) ?? null,
          commercial: commercialMap.get(pair) ?? null,
          sentiment: sentimentMap.get(pair) ?? null,
          strength: strengthMap.get(pair) ?? null,
        });
      }
    }
  }

  if (rows.length === 0) {
    throw new Error("No research rows built.");
  }

  const strategyIds: StrategyId[] = [
    "tiered_W1",
    "tiered_W1_t2",
    "tiered_W2",
    "tiered_W2_t2",
    "tiered_W3",
    "tiered_W3_t2",
    "dealer_led",
    "agree_3of4_skip",
    "agree_3of4_selective",
    "dealer",
  ];

  const results: StrategyResult[] = strategyIds.map((id) => {
    const breakdown = computeBreakdown(rows, weeks, id);
    return {
      id,
      label: STRATEGY_LABELS[id],
      breakdown,
      combined: breakdown.find((row) => row.assetClass === "combined")!.stats,
    };
  });

  const baselineSkip = results.find((result) => result.id === "agree_3of4_skip")!.combined;
  assertApprox("agree_3of4 skip trades", baselineSkip.trades, 244, 0);
  assertApprox("agree_3of4 skip total", baselineSkip.totalReturnPct, 85.36);
  assertApprox("agree_3of4 skip dd", baselineSkip.maxDrawdownPct, 7.61);
  assertApprox("agree_3of4 skip win", baselineSkip.winRatePct, 60.7, 0.1);
  assertApprox("agree_3of4 skip losing weeks", baselineSkip.losingWeeks, 3, 0);

  const baselineSelective = results.find((result) => result.id === "agree_3of4_selective")!.combined;
  assertApprox("agree_3of4 selective trades", baselineSelective.trades, 268, 0);
  assertApprox("agree_3of4 selective total", baselineSelective.totalReturnPct, 98.14);
  assertApprox("agree_3of4 selective dd", baselineSelective.maxDrawdownPct, 17.42);
  assertApprox("agree_3of4 selective win", baselineSelective.winRatePct, 61.2, 0.1);
  assertApprox("agree_3of4 selective losing weeks", baselineSelective.losingWeeks, 3, 0);

  const baselineDealer = results.find((result) => result.id === "dealer")!.combined;
  assertApprox("dealer trades", baselineDealer.trades, 360, 0);
  assertApprox("dealer total", baselineDealer.totalReturnPct, 96.51);
  assertApprox("dealer dd", baselineDealer.maxDrawdownPct, 0.0);
  assertApprox("dealer win", baselineDealer.winRatePct, 57.8, 0.1);
  assertApprox("dealer losing weeks", baselineDealer.losingWeeks, 0, 0);

  const scoreDistributions = WEIGHT_PACKS.map((weights) => ({
    weights,
    distribution: computeScoreDistribution(rows, weights),
    tierPerformance: computeTierPerformance(rows, weights),
  }));

  for (const { distribution, weights } of scoreDistributions) {
    const total = distribution.tier1 + distribution.tier2 + distribution.tier3 + distribution.skip;
    if (total !== rows.length) {
      throw new Error(`Score distribution for ${weights.id} does not sum to ${rows.length}.`);
    }
  }

  const master = [...results].sort((a, b) => {
    if (a.combined.losingWeeks !== b.combined.losingWeeks) {
      return a.combined.losingWeeks - b.combined.losingWeeks;
    }
    return b.combined.totalReturnPct - a.combined.totalReturnPct;
  });

  const perWeekCoverage = weeks.map((week) => {
    const weekRows = rows.filter((row) => row.weekOpenUtc === week);
    const countFor = (strategyId: StrategyId) => weekRows.filter((row) => resolveStrategy(row, strategyId).direction !== null).length;
    return {
      week,
      W1: countFor("tiered_W1"),
      W1T2: countFor("tiered_W1_t2"),
      W2: countFor("tiered_W2"),
      W2T2: countFor("tiered_W2_t2"),
      W3: countFor("tiered_W3"),
      W3T2: countFor("tiered_W3_t2"),
      dealerLed: countFor("dealer_led"),
      agreeSkip: countFor("agree_3of4_skip"),
      agreeSelective: countFor("agree_3of4_selective"),
    };
  });

  const lines: string[] = [
    "# 4-Source Weighted Tiered Research",
    "",
    `Weeks analyzed: ${weeks.length} (${weekLabel(weeks.at(-1) ?? weeks[0]!)} -> ${weekLabel(weeks[0]!)}).`,
    `Universe: ${rows.length} pair-weeks.`,
    "Data loader: getCanonicalBasketWeek (canonical app/engine path).",
    "All returns ADR-normalized.",
    "",
    "## Score Distribution",
    "",
    "| Weight Pack | Tier 1 (>=4.0) | Tier 2 (2.0-3.99) | Tier 3 (0.01-1.99) | Skip (0) | Total |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...scoreDistributions.map(({ weights, distribution }) => `| ${weights.id} | ${distribution.tier1} | ${distribution.tier2} | ${distribution.tier3} | ${distribution.skip} | ${rows.length} |`),
    "",
    "### Score Statistics",
    "",
    "| Weight Pack | Min Abs | Max Abs | Mean Abs |",
    "| --- | ---: | ---: | ---: |",
    ...scoreDistributions.map(({ weights, distribution }) => `| ${weights.id} | ${distribution.minAbs.toFixed(2)} | ${distribution.maxAbs.toFixed(2)} | ${distribution.meanAbs.toFixed(2)} |`),
    "",
  ];

  for (const { weights, tierPerformance } of scoreDistributions) {
    lines.push(`## Tier Performance: ${weights.id}`);
    lines.push("");
    lines.push("| Tier | Trades | Total% | Avg% | Win% |");
    lines.push("| --- | ---: | ---: | ---: | ---: |");
    for (const tier of tierPerformance) {
      lines.push(`| ${tier.tier} | ${tier.trades} | ${signedPct(tier.totalReturnPct)} | ${signedPct(tier.avgReturnPct)} | ${tier.winRatePct.toFixed(1)}% |`);
    }
    lines.push("");
  }

  lines.push("## Full Variant Results");
  lines.push("");
  for (const result of results) {
    lines.push(formatAssetBreakdown(result));
  }

  lines.push("## Master Comparison");
  lines.push("");
  lines.push("| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Trades/Wk |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const result of master) {
    lines.push(`| ${result.label} | ${result.combined.trades} | ${signedPct(result.combined.totalReturnPct)} | ${result.combined.maxDrawdownPct.toFixed(2)}% | ${result.combined.winRatePct.toFixed(1)}% | ${result.combined.losingWeeks} | ${result.combined.coveragePct.toFixed(1)}% | ${result.combined.tradesPerWeek.toFixed(1)} |`);
  }
  lines.push("");

  lines.push("## Per-Week Coverage");
  lines.push("");
  lines.push("| Week | W1 Full | W1 T2 | W2 Full | W2 T2 | W3 Full | W3 T2 | Dealer-Led | agree_3of4 skip | agree_3of4 selective |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of perWeekCoverage) {
    lines.push(`| ${weekLabel(row.week)} | ${row.W1} | ${row.W1T2} | ${row.W2} | ${row.W2T2} | ${row.W3} | ${row.W3T2} | ${row.dealerLed} | ${row.agreeSkip} | ${row.agreeSelective} |`);
  }
  lines.push("");

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
