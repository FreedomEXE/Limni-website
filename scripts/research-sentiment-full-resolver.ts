/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-sentiment-full-resolver.ts
 *
 * Description:
 * Full sentiment resolver research on the canonical app/engine path.
 * Tests prior-week carry, any-lean fade, and guaranteed fallback closure
 * to reach full 360/360 weekly coverage.
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
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/SENTIMENT_FULL_RESOLVER_RESEARCH_2026-04-05.md";
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "crypto", "commodities"];

type Direction = "LONG" | "SHORT";
type StackName = "sa" | "sb" | "sc" | "sd" | "se";
type TierName = "tierA" | "tierR" | "tierF";
type TierFSubStep = "prior_s1" | "prior_lean" | "two_week_lean" | "hardcoded";

type ResolverTiers = {
  tierA: Direction | null;
  tierR: Direction | null;
  tierF: Direction;
  tierFSubStep: TierFSubStep;
};

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  sentS1: Direction | null;
  sentHasData: boolean;
  sentIsNeutral: boolean;
  aggLongPct: number | null;
  priorS1: Direction | null;
  priorLongPct: number | null;
  prior2S1: Direction | null;
  prior2LongPct: number | null;
  tiers: ResolverTiers | null;
};

type TierQualityStats = {
  fills: number;
  totalPct: number;
  avgPct: number;
  winRatePct: number;
};

type StackStats = {
  totalTrades: number;
  totalReturnPct: number;
  maxDdPct: number;
  winRatePct: number;
  losingWeeks: number;
  coverage: string;
  resolvedTrades: number;
  resolvedReturnPct: number;
  resolvedWinRate: number;
  tierFills: Record<TierName, number>;
};

type CoverageRow = {
  weekOpenUtc: string;
  s1: number;
  sa: number;
  sb: number;
  sc: number;
  sd: number;
  se: number;
};

type ExtremityBucket = {
  label: string;
  minDist: number;
  maxDist: number;
};

const EXTREMITY_BUCKETS: ExtremityBucket[] = [
  { label: "0-1% from 50", minDist: 0, maxDist: 1 },
  { label: "1-2% from 50", minDist: 1, maxDist: 2 },
  { label: "2-5% from 50", minDist: 2, maxDist: 5 },
  { label: "5-10% from 50", minDist: 5, maxDist: 10 },
  { label: "10-15% from 50", minDist: 10, maxDist: 15.000001 },
];

const STACK_LABELS: Record<StackName, string> = {
  sa: "SA: Prior-S1 carry only",
  sb: "SB: Prior-S1 carry + relative extremity",
  sc: "SC: Prior-S1 carry + relative extremity + forced lean",
  sd: "SD: Relative extremity only",
  se: "SE: Relative extremity + forced lean",
};

const STACK_TIERS: Record<StackName, TierName[]> = {
  sa: ["tierA"],
  sb: ["tierA", "tierR"],
  sc: ["tierA", "tierR", "tierF"],
  sd: ["tierR"],
  se: ["tierR", "tierF"],
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signedPct(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function directionalReturn(row: Row, direction: Direction) {
  return (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
}

function computeMaxDd(weeklyReturns: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const ret of weeklyReturns) {
    cumulative += ret;
    if (cumulative > peak) peak = cumulative;
    maxDd = Math.max(maxDd, peak - cumulative);
  }
  return round(maxDd);
}

function sentimentS1(agg: SentimentAggregate | undefined | null): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return null;
  if (crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG") return "SHORT";
  if (crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT") return "LONG";
  return null;
}

function tierA_priorS1Carry(row: Row): Direction | null {
  if (!row.sentIsNeutral) return null;
  return row.priorS1;
}

function tierR_relativeExtremityFade(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null) return null;
  if (row.aggLongPct > 50) return "SHORT";
  if (row.aggLongPct < 50) return "LONG";
  return null;
}

function tierF_forcedLean(row: Row): { direction: Direction; subStep: TierFSubStep } {
  if (row.priorS1) {
    return { direction: row.priorS1, subStep: "prior_s1" };
  }
  if (row.priorLongPct !== null) {
    if (row.priorLongPct > 50) return { direction: "SHORT", subStep: "prior_lean" };
    if (row.priorLongPct < 50) return { direction: "LONG", subStep: "prior_lean" };
  }
  const twoWeekVals = [row.priorLongPct, row.prior2LongPct].filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (twoWeekVals.length > 0) {
    const avg = twoWeekVals.reduce((sum, value) => sum + value, 0) / twoWeekVals.length;
    if (avg > 50) return { direction: "SHORT", subStep: "two_week_lean" };
    if (avg < 50) return { direction: "LONG", subStep: "two_week_lean" };
  }
  return { direction: "SHORT", subStep: "hardcoded" };
}

function resolveStack(row: Row, stack: StackName): { direction: Direction | null; tier: TierName | null; tierFSubStep: TierFSubStep | null } {
  if (row.sentS1) {
    return { direction: row.sentS1, tier: null, tierFSubStep: null };
  }

  for (const tier of STACK_TIERS[stack]) {
    if (tier === "tierF") {
      const direction = row.tiers?.tierF ?? null;
      if (direction) {
        return { direction, tier, tierFSubStep: row.tiers?.tierFSubStep ?? null };
      }
      continue;
    }

    const direction = row.tiers?.[tier] ?? null;
    if (direction) {
      return { direction, tier, tierFSubStep: null };
    }
  }
  return { direction: null, tier: null, tierFSubStep: null };
}

function emptyTierCounts(): Record<TierName, number> {
  return { tierA: 0, tierR: 0, tierF: 0 };
}

function computeTierQuality(rows: Row[], getDirection: (row: Row) => Direction | null): TierQualityStats {
  let fills = 0;
  let total = 0;
  let wins = 0;
  for (const row of rows) {
    const direction = getDirection(row);
    if (!direction) continue;
    const ret = directionalReturn(row, direction);
    fills += 1;
    total += ret;
    if (ret > 0) wins += 1;
  }
  return {
    fills,
    totalPct: round(total),
    avgPct: fills > 0 ? round(total / fills, 3) : 0,
    winRatePct: fills > 0 ? round((wins / fills) * 100, 1) : 0,
  };
}

function computeStackStats(rows: Row[], possibleTrades: number, stack: StackName | null): StackStats {
  const tierFills = emptyTierCounts();
  const byWeek = new Map<string, { ret: number; trades: number; wins: number }>();
  let resolvedTrades = 0;
  let resolvedReturn = 0;
  let resolvedWins = 0;

  for (const row of rows) {
    const resolved = stack ? resolveStack(row, stack) : { direction: row.sentS1, tier: null as TierName | null, tierFSubStep: null as TierFSubStep | null };
    const direction = resolved.direction;
    if (!direction) continue;

    const ret = directionalReturn(row, direction);
    const week = byWeek.get(row.weekOpenUtc) ?? { ret: 0, trades: 0, wins: 0 };
    week.ret += ret;
    week.trades += 1;
    if (ret > 0) week.wins += 1;
    byWeek.set(row.weekOpenUtc, week);

    if (resolved.tier) {
      tierFills[resolved.tier] += 1;
      resolvedTrades += 1;
      resolvedReturn += ret;
      if (ret > 0) resolvedWins += 1;
    }
  }

  const weekly = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weeklyReturns = weekly.map(([, value]) => value.ret);
  const totalTrades = weekly.reduce((sum, [, value]) => sum + value.trades, 0);
  const totalWins = weekly.reduce((sum, [, value]) => sum + value.wins, 0);
  return {
    totalTrades,
    totalReturnPct: round(weeklyReturns.reduce((sum, ret) => sum + ret, 0)),
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: totalTrades > 0 ? round((totalWins / totalTrades) * 100, 1) : 0,
    losingWeeks: weeklyReturns.filter((ret) => ret < 0).length,
    coverage: `${totalTrades}/${possibleTrades}`,
    resolvedTrades,
    resolvedReturnPct: round(resolvedReturn),
    resolvedWinRate: resolvedTrades > 0 ? round((resolvedWins / resolvedTrades) * 100, 1) : 0,
    tierFills,
  };
}

function renderTierQualityTable(rows: Array<{ label: string; stats: TierQualityStats }>) {
  const lines = [
    "## Individual Tier Quality",
    "",
    "| Tier | Fills | Total% | Avg% | Win% |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${row.stats.fills} | ${signedPct(row.stats.totalPct)} | ${signedPct(row.stats.avgPct, 3)} | ${row.stats.winRatePct.toFixed(1)}% |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderExtremityBuckets(rows: Row[]) {
  const lines = [
    "## Tier R: Extremity Bucket Breakdown",
    "",
    "| Bucket | Fills | Total% | Avg% | Win% |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];
  for (const bucket of EXTREMITY_BUCKETS) {
    const filtered = rows.filter((row) => {
      if (!row.sentIsNeutral || row.aggLongPct === null) return false;
      const direction = row.tiers?.tierR ?? null;
      if (!direction) return false;
      const dist = Math.abs(row.aggLongPct - 50);
      return dist >= bucket.minDist && dist < bucket.maxDist;
    });
    const stats = computeTierQuality(filtered, (row) => row.tiers?.tierR ?? null);
    lines.push(
      `| ${bucket.label} | ${stats.fills} | ${signedPct(stats.totalPct)} | ${signedPct(stats.avgPct, 3)} | ${stats.winRatePct.toFixed(1)}% |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderFlatDiagnostic(rows: Row[]) {
  const neutralRows = rows.filter((row) => row.sentIsNeutral && row.aggLongPct !== null);
  const exactFlat = neutralRows.filter((row) => row.aggLongPct === 50).length;
  const withinHalf = neutralRows.filter((row) => Math.abs((row.aggLongPct ?? 50) - 50) < 0.5).length;
  const withinOne = neutralRows.filter((row) => Math.abs((row.aggLongPct ?? 50) - 50) < 1).length;
  return [
    "## Flat / Near-50 Diagnostic",
    "",
    `- Rows with \`agg_long_pct === 50.000\` (exactly flat): ${exactFlat}`,
    `- Rows with \`|agg_long_pct - 50| < 0.5\` (near-flat): ${withinHalf}`,
    `- Rows with \`|agg_long_pct - 50| < 1.0\`: ${withinOne}`,
    "",
    "These are the rows most likely to produce noise rather than signal from Tier R.",
    "",
  ].join("\n");
}

function renderTierFBreakdown(rows: Row[]) {
  const counts: Record<TierFSubStep, number> = {
    prior_s1: 0,
    prior_lean: 0,
    two_week_lean: 0,
    hardcoded: 0,
  };
  let fills = 0;
  for (const row of rows) {
    if (!row.sentIsNeutral || !row.tiers) continue;
    if (row.tiers.tierA || row.tiers.tierR === "LONG" || row.tiers.tierR === "SHORT") continue;
    counts[row.tiers.tierFSubStep] += 1;
    fills += 1;
  }

  const lines = [
    "## Tier F Sub-Step Breakdown",
    "",
    "| Sub-Step | Fills |",
    "| --- | ---: |",
    `| Prior-week S1 | ${counts.prior_s1} |`,
    `| Prior-week lean | ${counts.prior_lean} |`,
    `| 2-week average lean | ${counts.two_week_lean} |`,
    `| Hardcoded SHORT (synthetic) | ${counts.hardcoded} |`,
    "",
    `Total Tier F fills: ${fills}`,
    "",
  ];
  return lines.join("\n");
}

function renderStackAssetTable(label: string, byAsset: Record<AssetClass | "combined", StackStats>) {
  const combined = byAsset.combined;
  const lines = [
    `### ${label}`,
    "",
    "| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const assetClass of ASSET_CLASSES) {
    const stats = byAsset[assetClass];
    lines.push(
      `| ${assetClass} | ${stats.totalTrades} | ${signedPct(stats.totalReturnPct)} | ${stats.maxDdPct.toFixed(2)}% | ${stats.winRatePct.toFixed(1)}% | ${stats.losingWeeks} | ${stats.coverage} |`,
    );
  }
  lines.push(
    `| combined | ${combined.totalTrades} | ${signedPct(combined.totalReturnPct)} | ${combined.maxDdPct.toFixed(2)}% | ${combined.winRatePct.toFixed(1)}% | ${combined.losingWeeks} | ${combined.coverage} |`,
  );
  lines.push(
    `| *of which resolver* | ${combined.resolvedTrades} | ${signedPct(combined.resolvedReturnPct)} | — | ${combined.resolvedWinRate.toFixed(1)}% | — | — |`,
  );
  lines.push("");
  lines.push(`Tier fills: tierA=${combined.tierFills.tierA}, tierR=${combined.tierFills.tierR}, tierF=${combined.tierFills.tierF}`);
  lines.push("");
  return lines.join("\n");
}

function renderStackComparison(stacks: Array<{ name: string; stats: StackStats }>) {
  const sorted = [...stacks].sort(
    (a, b) => a.stats.losingWeeks - b.stats.losingWeeks || b.stats.totalReturnPct - a.stats.totalReturnPct,
  );
  const lines = [
    "## Stack Comparison",
    "",
    "| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Full 36/36? |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of sorted) {
    const full = row.stats.totalTrades === 360 ? "Yes" : "No";
    lines.push(
      `| ${row.name} | ${row.stats.totalTrades} | ${signedPct(row.stats.totalReturnPct)} | ${row.stats.maxDdPct.toFixed(2)}% | ${row.stats.winRatePct.toFixed(1)}% | ${row.stats.losingWeeks} | ${row.stats.coverage} | ${full} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderResolverOnly(stacks: Array<{ name: string; stats: StackStats }>) {
  const lines = [
    "## Resolver-Only Performance",
    "",
    "| Stack | Resolver Trades | Resolver Total% | Resolver Avg% | Resolver Win% |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];
  for (const row of stacks) {
    const avg = row.stats.resolvedTrades > 0 ? round(row.stats.resolvedReturnPct / row.stats.resolvedTrades, 3) : 0;
    lines.push(
      `| ${row.name} | ${row.stats.resolvedTrades} | ${signedPct(row.stats.resolvedReturnPct)} | ${signedPct(avg, 3)} | ${row.stats.resolvedWinRate.toFixed(1)}% |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderCoverageVerification(rows: CoverageRow[]) {
  const lines = [
    "## Per-Week Coverage Verification",
    "",
    "| Week | S1 | SA | SB | SC | SD | SE |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${weekLabel(row.weekOpenUtc)} | ${row.s1} | ${row.sa} | ${row.sb} | ${row.sc} | ${row.sd} | ${row.se} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const possibleByClass = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, weeks.length * PAIRS_BY_ASSET_CLASS[assetClass].length]),
  ) as Record<AssetClass, number>;
  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);

  const availability = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, { present: 0, possible: possibleByClass[assetClass] }]),
  ) as Record<AssetClass, { present: number; possible: number }>;

  const rows: Row[] = [];

  for (const rawWeekOpenUtc of weeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const close = open.plus({ days: 7 });
    const prior1Open = open.minus({ weeks: 1 });
    const prior2Open = open.minus({ weeks: 2 });
    const prior1Close = prior1Open.plus({ days: 7 });
    const prior2Close = prior2Open.plus({ days: 7 });

    const [weeklyReturns, adrMap, currentSentiment, prior1Sentiment, prior2Sentiment] = await Promise.all([
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
      getAggregatesForWeekStartWithBackfill(open.toUTC().toISO()!, close.toUTC().toISO()!),
      getAggregatesForWeekStartWithBackfill(prior1Open.toUTC().toISO()!, prior1Close.toUTC().toISO()!),
      getAggregatesForWeekStartWithBackfill(prior2Open.toUTC().toISO()!, prior2Close.toUTC().toISO()!),
    ]);

    const returnMap = new Map(
      weeklyReturns.map((row) => {
        const adrPct = getAdrPct(adrMap, row.symbol.toUpperCase(), row.assetClass);
        return [
          row.symbol.toUpperCase(),
          {
            rawReturnPct: row.returnPct,
            adrMultiplier: adrPct > 0 ? targetAdr / adrPct : 1,
          },
        ] as const;
      }),
    );
    const sentMap = new Map(currentSentiment.map((agg) => [agg.symbol.toUpperCase(), agg]));
    const prior1Map = new Map(prior1Sentiment.map((agg) => [agg.symbol.toUpperCase(), agg]));
    const prior2Map = new Map(prior2Sentiment.map((agg) => [agg.symbol.toUpperCase(), agg]));

    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const ret = returnMap.get(pair);
        if (!ret) continue;

        const agg = sentMap.get(pair) ?? null;
        const prior1Agg = prior1Map.get(pair) ?? null;
        const prior2Agg = prior2Map.get(pair) ?? null;
        const sentS1 = sentimentS1(agg);
        const sentHasData = Boolean(agg);
        const sentIsNeutral = sentHasData && sentS1 === null;
        if (sentHasData) availability[assetClass].present += 1;

        const row: Row = {
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: ret.rawReturnPct,
          adrMultiplier: ret.adrMultiplier,
          sentS1,
          sentHasData,
          sentIsNeutral,
          aggLongPct: agg?.agg_long_pct ?? null,
          priorS1: sentimentS1(prior1Agg),
          priorLongPct: prior1Agg?.agg_long_pct ?? null,
          prior2S1: sentimentS1(prior2Agg),
          prior2LongPct: prior2Agg?.agg_long_pct ?? null,
          tiers: null,
        };

        if (sentIsNeutral) {
          const forced = tierF_forcedLean(row);
          row.tiers = {
            tierA: tierA_priorS1Carry(row),
            tierR: tierR_relativeExtremityFade(row),
            tierF: forced.direction,
            tierFSubStep: forced.subStep,
          };
        }
        rows.push(row);
      }
    }
  }

  const baseline = computeStackStats(rows, combinedPossible, null);
  const stackStats = Object.fromEntries(
    (Object.keys(STACK_LABELS) as StackName[]).map((stack) => [stack, computeStackStats(rows, combinedPossible, stack)]),
  ) as Record<StackName, StackStats>;
  const stackByAsset = Object.fromEntries(
    (Object.keys(STACK_LABELS) as StackName[]).map((stack) => [
      stack,
      {
        fx: computeStackStats(rows.filter((row) => row.assetClass === "fx"), possibleByClass.fx, stack),
        indices: computeStackStats(rows.filter((row) => row.assetClass === "indices"), possibleByClass.indices, stack),
        crypto: computeStackStats(rows.filter((row) => row.assetClass === "crypto"), possibleByClass.crypto, stack),
        commodities: computeStackStats(rows.filter((row) => row.assetClass === "commodities"), possibleByClass.commodities, stack),
        combined: stackStats[stack],
      },
    ]),
  ) as Record<StackName, Record<AssetClass | "combined", StackStats>>;

  const neutralRows = rows.filter((row) => row.sentIsNeutral);
  const tierAStats = computeTierQuality(neutralRows, (row) => row.tiers?.tierA ?? null);
  const tierRStats = computeTierQuality(neutralRows, (row) => row.tiers?.tierR ?? null);
  const tierFStats = computeTierQuality(
    neutralRows.filter((row) => !(row.tiers?.tierA || row.tiers?.tierR)),
    (row) => row.tiers?.tierF ?? null,
  );

  if (
    baseline.totalTrades !== 265 ||
    baseline.totalReturnPct !== 92.4 ||
    baseline.maxDdPct !== 19.56 ||
    baseline.winRatePct !== 60.8 ||
    baseline.losingWeeks !== 5
  ) {
    throw new Error(
      `Baseline mismatch: expected 265 / 92.40 / 19.56 / 60.8 / 5, got ${baseline.totalTrades} / ${baseline.totalReturnPct} / ${baseline.maxDdPct} / ${baseline.winRatePct} / ${baseline.losingWeeks}`,
    );
  }

  if (
    stackStats.sa.totalTrades !== 295 ||
    stackStats.sa.totalReturnPct !== 99.94 ||
    stackStats.sa.maxDdPct !== 19.6 ||
    stackStats.sa.winRatePct !== 61.7 ||
    stackStats.sa.losingWeeks !== 5
  ) {
    throw new Error(
      `SA mismatch: expected 295 / 99.94 / 19.60 / 61.7 / 5, got ${stackStats.sa.totalTrades} / ${stackStats.sa.totalReturnPct} / ${stackStats.sa.maxDdPct} / ${stackStats.sa.winRatePct} / ${stackStats.sa.losingWeeks}`,
    );
  }

  if (stackStats.sc.totalTrades !== 360 || stackStats.se.totalTrades !== 360) {
    throw new Error(`SC/SE coverage mismatch: SC=${stackStats.sc.totalTrades}, SE=${stackStats.se.totalTrades}`);
  }

  const gapRows = weeks.map((rawWeekOpenUtc) => {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const weekRows = rows.filter((row) => row.weekOpenUtc === weekOpenUtc);
    const s1Trades = weekRows.filter((row) => row.sentS1 !== null).length;
    const neutrals = weekRows.filter((row) => row.sentIsNeutral).length;
    const noData = weekRows.filter((row) => !row.sentHasData).length;
    return { weekOpenUtc, s1Trades, neutrals, noData, totalGaps: neutrals + noData };
  });

  const coverageRows: CoverageRow[] = weeks.map((rawWeekOpenUtc) => {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const weekRows = rows.filter((row) => row.weekOpenUtc === weekOpenUtc);
    const countFor = (stack: StackName | null) =>
      weekRows.filter((row) => (stack ? resolveStack(row, stack).direction : row.sentS1) !== null).length;
    return {
      weekOpenUtc,
      s1: countFor(null),
      sa: countFor("sa"),
      sb: countFor("sb"),
      sc: countFor("sc"),
      sd: countFor("sd"),
      se: countFor("se"),
    };
  });

  const stackList = [
    { name: "S1 Baseline (no resolver)", stats: baseline },
    { name: STACK_LABELS.sa, stats: stackStats.sa },
    { name: STACK_LABELS.sb, stats: stackStats.sb },
    { name: STACK_LABELS.sc, stats: stackStats.sc },
    { name: STACK_LABELS.sd, stats: stackStats.sd },
    { name: STACK_LABELS.se, stats: stackStats.se },
  ];

  const lines: string[] = [];
  lines.push("# Sentiment Full Resolver Research (Canonical Path)");
  lines.push("");
  lines.push(`Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} -> ${weekLabel(weeks.at(-1)!)}).`);
  lines.push(`Universe: 36 pairs × ${weeks.length} weeks = ${combinedPossible} possible pair-weeks.`);
  lines.push("Data loader: getAggregatesForWeekStartWithBackfill (canonical app/engine path).");
  lines.push("");
  lines.push("## Gap Analysis");
  lines.push("");
  lines.push(`- S1 baseline: ${baseline.totalTrades}/${combinedPossible} trades`);
  lines.push(`- Neutrals with data: ${neutralRows.length} pair-weeks`);
  lines.push(`- Neutrals without data: ${rows.filter((row) => !row.sentHasData).length} pair-weeks`);
  lines.push(`- Data ceiling: ${rows.filter((row) => row.sentHasData).length}/${combinedPossible} (${((rows.filter((row) => row.sentHasData).length / combinedPossible) * 100).toFixed(1)}%)`);
  lines.push("");
  lines.push("### Per-Week Gap Breakdown");
  lines.push("");
  lines.push("| Week | S1 Trades | Neutrals (data) | No Data | Total Gaps |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const row of gapRows) {
    lines.push(`| ${weekLabel(row.weekOpenUtc)} | ${row.s1Trades} | ${row.neutrals} | ${row.noData} | ${row.totalGaps} |`);
  }
  lines.push("");
  lines.push(renderTierQualityTable([
    { label: "A: Prior-week S1 carry", stats: tierAStats },
    { label: "R: Relative extremity fade", stats: tierRStats },
    { label: "F: Forced lean", stats: tierFStats },
  ]));
  lines.push(renderExtremityBuckets(rows));
  lines.push(renderFlatDiagnostic(rows));
  lines.push(renderTierFBreakdown(rows));
  lines.push("## Stack Results");
  lines.push("");
  for (const stack of (Object.keys(STACK_LABELS) as StackName[])) {
    lines.push(renderStackAssetTable(STACK_LABELS[stack], stackByAsset[stack]));
  }
  lines.push(renderStackComparison(stackList));
  lines.push(renderResolverOnly(stackList.slice(1)));
  lines.push(renderCoverageVerification(coverageRows));

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
