/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-neutral-resolvers.ts
 *
 * Description:
 * Builds hierarchical neutral-only resolver stacks for sentiment and strength.
 * Existing non-neutral logic is preserved; only neutral buckets are engineered.
 * All returns are ADR-normalized.
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
import { getAggregatesAsOf } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { readWeeklyPairStrengths, type WeeklyPairStrength } from "../src/lib/strength/weeklyStrength";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/NEUTRAL_RESOLVER_RESEARCH_2026-04-04.md";
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "crypto", "commodities"];

type Direction = "LONG" | "SHORT";
type SentTierName = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";
type StrTierName = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";
type SentStackName = "sa" | "sb" | "sc" | "sd" | "se";
type StrStackName = "ta" | "tb" | "tc" | "td";

type AvailabilityStats = { present: number; possible: number };

type SentTiers = {
  tier1: Direction | null;
  tier2: Direction | null;
  tier3Standalone: Direction | null;
  tier3Stack: Direction | null;
  tier4: Direction | null;
  tier5: Direction | null;
};

type StrTiers = {
  tier1: Direction | null;
  tier2: Direction | null;
  tier3: Direction | null;
  tier4: Direction | null;
  tier5: Direction | null;
};

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  sentS1: Direction | null;
  strT1: Direction | null;
  sentIsNeutral: boolean;
  strIsNeutral: boolean;
  sentHasData: boolean;
  strHasData: boolean;
  sentTiers: SentTiers | null;
  strTiers: StrTiers | null;
  aggLongPct: number | null;
  priorAggLongPct: number | null;
};

type TierQualityStats = {
  fills: number;
  totalPct: number;
  avgPct: number;
  winRatePct: number;
};

type StackStats = {
  baselineTrades: number;
  baselineReturnPct: number;
  resolvedTrades: number;
  resolvedReturnPct: number;
  resolvedWinRate: number;
  totalTrades: number;
  totalReturnPct: number;
  maxDdPct: number;
  winRatePct: number;
  coverage: string;
  losingWeeks: number;
  tierFills: Record<string, number>;
};

const SENT_STACK_LABELS: Record<SentStackName, string> = {
  sa: "SA: Conservative",
  sb: "SB: Moderate",
  sc: "SC: Full",
  sd: "SD: No Forced Lean",
  se: "SE: Quality-First",
};

const STR_STACK_LABELS: Record<StrStackName, string> = {
  ta: "TA: Simple",
  tb: "TB: Moderate",
  tc: "TC: Full",
  td: "TD: Conservative",
};

const SENT_STACK_DESCRIPTIONS: Record<SentStackName, string> = {
  sa: "Tier 1 (60/40) only",
  sb: "Tier 1 -> Tier 2 -> Tier 4",
  sc: "Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5",
  sd: "Tier 1 -> Tier 2 -> Tier 3 -> Tier 4",
  se: "Tier 1 -> Tier 2 -> Tier 3",
};

const STR_STACK_DESCRIPTIONS: Record<StrStackName, string> = {
  ta: "Tier 1 (raw spread sum) only",
  tb: "Tier 1 -> Tier 2 -> Tier 3",
  tc: "Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5",
  td: "Tier 1 -> Tier 3",
};

const SENT_STACK_TIERS: Record<SentStackName, SentTierName[]> = {
  sa: ["tier1"],
  sb: ["tier1", "tier2", "tier4"],
  sc: ["tier1", "tier2", "tier3", "tier4", "tier5"],
  sd: ["tier1", "tier2", "tier3", "tier4"],
  se: ["tier1", "tier2", "tier3"],
};

const STR_STACK_TIERS: Record<StrStackName, StrTierName[]> = {
  ta: ["tier1"],
  tb: ["tier1", "tier2", "tier3"],
  tc: ["tier1", "tier2", "tier3", "tier4", "tier5"],
  td: ["tier1", "tier3"],
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

function computeMedian(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
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

function sentimentS1(agg: SentimentAggregate | undefined): Direction | null {
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

function sentTier1MildCrowding(agg: SentimentAggregate): Direction | null {
  if (agg.agg_long_pct >= 60) return "SHORT";
  if (agg.agg_long_pct <= 40) return "LONG";
  return null;
}

function sentTier2Persistence(
  current: SentimentAggregate,
  prior: SentimentAggregate | undefined,
): Direction | null {
  if (!prior) return null;
  const currentSide = current.agg_long_pct > 50 ? "long" : current.agg_long_pct < 50 ? "short" : null;
  const priorSide = prior.agg_long_pct > 50 ? "long" : prior.agg_long_pct < 50 ? "short" : null;
  if (!currentSide || !priorSide || currentSide !== priorSide) return null;
  const avg = (current.agg_long_pct + prior.agg_long_pct) / 2;
  if (avg >= 55) return "SHORT";
  if (avg <= 45) return "LONG";
  return null;
}

function sentTier4SoftFade(agg: SentimentAggregate): Direction | null {
  if (agg.agg_long_pct >= 53) return "SHORT";
  if (agg.agg_long_pct <= 47) return "LONG";
  return null;
}

function sentTier5ForcedLean(agg: SentimentAggregate): Direction | null {
  if (agg.agg_long_pct >= 51) return "SHORT";
  if (agg.agg_long_pct <= 49) return "LONG";
  return null;
}

function strengthT1(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  if (ps.compositeDirection === "NEUTRAL") return null;
  return ps.compositeDirection;
}

function strTier1RawSpreadSum(ps: WeeklyPairStrength): Direction | null {
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)) {
      sum += w.signedSpread;
      hasData = true;
    }
  }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}

function strTier2WeightedSpread(ps: WeeklyPairStrength): Direction | null {
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)) {
      const weight = w.window === "24h" ? 2 : 1;
      sum += weight * w.signedSpread;
      hasData = true;
    }
  }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}

function strTier324hOnly(ps: WeeklyPairStrength): Direction | null {
  const w24h = ps.windows.find((w) => w.window === "24h");
  if (!w24h || !w24h.available || w24h.signedSpread === null) return null;
  if (w24h.signedSpread > 0) return "LONG";
  if (w24h.signedSpread < 0) return "SHORT";
  return null;
}

function strTier4SoftThreshold(ps: WeeklyPairStrength): Direction | null {
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available || w.signedSpread === null) continue;
    if (w.signedSpread > 4) score += 1;
    else if (w.signedSpread < -4) score -= 1;
  }
  if (score === 0) return null;
  return score > 0 ? "LONG" : "SHORT";
}

function strTier5AnyWindowLean(ps: WeeklyPairStrength): Direction | null {
  let maxAbsSpread = 0;
  let maxDir: Direction | null = null;
  for (const w of ps.windows) {
    if (!w.available || w.signedSpread === null) continue;
    const abs = Math.abs(w.signedSpread);
    if (abs > maxAbsSpread) {
      maxAbsSpread = abs;
      maxDir = w.signedSpread > 0 ? "LONG" : "SHORT";
    }
  }
  return maxDir;
}

function makeEmptyTierCounts(names: string[]) {
  return Object.fromEntries(names.map((name) => [name, 0])) as Record<string, number>;
}

function resolveSentimentStack(row: Row, stack: SentStackName) {
  if (!row.sentIsNeutral || !row.sentTiers) return { direction: row.sentS1, tier: null as string | null };
  for (const tier of SENT_STACK_TIERS[stack]) {
    const direction = tier === "tier3" ? row.sentTiers.tier3Stack : row.sentTiers[tier];
    if (direction) return { direction, tier };
  }
  return { direction: null, tier: null };
}

function resolveStrengthStack(row: Row, stack: StrStackName) {
  if (!row.strIsNeutral || !row.strTiers) return { direction: row.strT1, tier: null as string | null };
  for (const tier of STR_STACK_TIERS[stack]) {
    const direction = row.strTiers[tier];
    if (direction) return { direction, tier };
  }
  return { direction: null, tier: null };
}

function computeSimpleMethodStats(
  rows: Row[],
  possibleTrades: number,
  directionForRow: (row: Row) => Direction | null,
): {
  trades: number;
  totalPct: number;
  maxDdPct: number;
  winRatePct: number;
  losingWeeks: number;
  coverage: string;
} {
  const byWeek = new Map<string, { ret: number; trades: number; wins: number }>();
  for (const row of rows) {
    const direction = directionForRow(row);
    if (!direction) continue;
    const ret = directionalReturn(row, direction);
    const week = byWeek.get(row.weekOpenUtc) ?? { ret: 0, trades: 0, wins: 0 };
    week.ret += ret;
    week.trades += 1;
    if (ret > 0) week.wins += 1;
    byWeek.set(row.weekOpenUtc, week);
  }
  const weekly = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totalTrades = weekly.reduce((sum, [, value]) => sum + value.trades, 0);
  const totalWins = weekly.reduce((sum, [, value]) => sum + value.wins, 0);
  const weeklyReturns = weekly.map(([, value]) => value.ret);
  const totalReturnPct = round(weeklyReturns.reduce((sum, ret) => sum + ret, 0));
  return {
    trades: totalTrades,
    totalPct: totalReturnPct,
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: totalTrades > 0 ? round((totalWins / totalTrades) * 100, 1) : 0,
    losingWeeks: weeklyReturns.filter((ret) => ret < 0).length,
    coverage: `${totalTrades}/${possibleTrades}`,
  };
}

function computeTierQualityStats(
  rows: Row[],
  possibleTrades: number,
  directionForTier: (row: Row) => Direction | null,
): TierQualityStats & { coverage: string } {
  const stats = computeSimpleMethodStats(rows, possibleTrades, directionForTier);
  return {
    fills: stats.trades,
    totalPct: stats.totalPct,
    avgPct: stats.trades > 0 ? round(stats.totalPct / stats.trades, 3) : 0,
    winRatePct: stats.winRatePct,
    coverage: stats.coverage,
  };
}

function computeSentimentStackStats(
  rows: Row[],
  possibleTrades: number,
  stack: SentStackName | null,
): StackStats {
  const tierFills = makeEmptyTierCounts(["tier1", "tier2", "tier3", "tier4", "tier5"]);
  const byWeek = new Map<string, { totalRet: number; totalTrades: number; totalWins: number }>();
  let baselineTrades = 0;
  let baselineReturnPct = 0;
  let resolvedTrades = 0;
  let resolvedReturnPct = 0;
  let resolvedWins = 0;

  for (const row of rows) {
    let direction: Direction | null = row.sentS1;
    let usedTier: string | null = null;
    if (direction === null && stack) {
      const resolved = resolveSentimentStack(row, stack);
      direction = resolved.direction;
      usedTier = resolved.tier;
    }
    if (!direction) continue;

    const ret = directionalReturn(row, direction);
    const week = byWeek.get(row.weekOpenUtc) ?? { totalRet: 0, totalTrades: 0, totalWins: 0 };
    week.totalRet += ret;
    week.totalTrades += 1;
    if (ret > 0) week.totalWins += 1;
    byWeek.set(row.weekOpenUtc, week);

    if (row.sentS1 !== null) {
      baselineTrades += 1;
      baselineReturnPct += ret;
    } else if (usedTier) {
      resolvedTrades += 1;
      resolvedReturnPct += ret;
      if (ret > 0) resolvedWins += 1;
      tierFills[usedTier] += 1;
    }
  }

  const weekly = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weeklyReturns = weekly.map(([, value]) => value.totalRet);
  const totalTrades = weekly.reduce((sum, [, value]) => sum + value.totalTrades, 0);
  const totalWins = weekly.reduce((sum, [, value]) => sum + value.totalWins, 0);

  return {
    baselineTrades,
    baselineReturnPct: round(baselineReturnPct),
    resolvedTrades,
    resolvedReturnPct: round(resolvedReturnPct),
    resolvedWinRate: resolvedTrades > 0 ? round((resolvedWins / resolvedTrades) * 100, 1) : 0,
    totalTrades,
    totalReturnPct: round(weeklyReturns.reduce((sum, ret) => sum + ret, 0)),
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: totalTrades > 0 ? round((totalWins / totalTrades) * 100, 1) : 0,
    coverage: `${totalTrades}/${possibleTrades}`,
    losingWeeks: weeklyReturns.filter((ret) => ret < 0).length,
    tierFills,
  };
}

function computeStrengthStackStats(
  rows: Row[],
  possibleTrades: number,
  stack: StrStackName | null,
): StackStats {
  const tierFills = makeEmptyTierCounts(["tier1", "tier2", "tier3", "tier4", "tier5"]);
  const byWeek = new Map<string, { totalRet: number; totalTrades: number; totalWins: number }>();
  let baselineTrades = 0;
  let baselineReturnPct = 0;
  let resolvedTrades = 0;
  let resolvedReturnPct = 0;
  let resolvedWins = 0;

  for (const row of rows) {
    let direction: Direction | null = row.strT1;
    let usedTier: string | null = null;
    if (direction === null && stack) {
      const resolved = resolveStrengthStack(row, stack);
      direction = resolved.direction;
      usedTier = resolved.tier;
    }
    if (!direction) continue;

    const ret = directionalReturn(row, direction);
    const week = byWeek.get(row.weekOpenUtc) ?? { totalRet: 0, totalTrades: 0, totalWins: 0 };
    week.totalRet += ret;
    week.totalTrades += 1;
    if (ret > 0) week.totalWins += 1;
    byWeek.set(row.weekOpenUtc, week);

    if (row.strT1 !== null) {
      baselineTrades += 1;
      baselineReturnPct += ret;
    } else if (usedTier) {
      resolvedTrades += 1;
      resolvedReturnPct += ret;
      if (ret > 0) resolvedWins += 1;
      tierFills[usedTier] += 1;
    }
  }

  const weekly = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weeklyReturns = weekly.map(([, value]) => value.totalRet);
  const totalTrades = weekly.reduce((sum, [, value]) => sum + value.totalTrades, 0);
  const totalWins = weekly.reduce((sum, [, value]) => sum + value.totalWins, 0);

  return {
    baselineTrades,
    baselineReturnPct: round(baselineReturnPct),
    resolvedTrades,
    resolvedReturnPct: round(resolvedReturnPct),
    resolvedWinRate: resolvedTrades > 0 ? round((resolvedWins / resolvedTrades) * 100, 1) : 0,
    totalTrades,
    totalReturnPct: round(weeklyReturns.reduce((sum, ret) => sum + ret, 0)),
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: totalTrades > 0 ? round((totalWins / totalTrades) * 100, 1) : 0,
    coverage: `${totalTrades}/${possibleTrades}`,
    losingWeeks: weeklyReturns.filter((ret) => ret < 0).length,
    tierFills,
  };
}

function renderAvailability(title: string, availability: Record<AssetClass, AvailabilityStats>) {
  const totalPresent = Object.values(availability).reduce((sum, row) => sum + row.present, 0);
  const totalPossible = Object.values(availability).reduce((sum, row) => sum + row.possible, 0);
  const lines = [`## ${title}`, "", "| Asset Class | Present | Possible | Coverage |", "| --- | ---: | ---: | ---: |"];
  for (const assetClass of ASSET_CLASSES) {
    const row = availability[assetClass];
    lines.push(
      `| ${assetClass} | ${row.present} | ${row.possible} | ${((row.present / row.possible) * 100).toFixed(1)}% |`,
    );
  }
  lines.push(`| combined | ${totalPresent} | ${totalPossible} | ${((totalPresent / totalPossible) * 100).toFixed(1)}% |`);
  lines.push("");
  return lines.join("\n");
}

function renderTierQualityTable(
  title: string,
  tierRows: Array<{ name: string; stats: TierQualityStats }>,
) {
  const lines = [`### ${title}`, "", "| Tier | Fills | Total% | Avg% | Win% |", "| --- | ---: | ---: | ---: | ---: |"];
  for (const row of tierRows) {
    lines.push(
      `| ${row.name} | ${row.stats.fills} | ${signedPct(row.stats.totalPct)} | ${signedPct(row.stats.avgPct, 3)} | ${row.stats.winRatePct.toFixed(1)}% |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderStackAssetTable(
  label: string,
  description: string,
  byAsset: Record<AssetClass | "combined", StackStats>,
) {
  const combined = byAsset.combined;
  const resolverAvg = combined.resolvedTrades > 0 ? round(combined.resolvedReturnPct / combined.resolvedTrades, 3) : 0;
  const tierFills = Object.entries(combined.tierFills)
    .filter(([, fills]) => fills > 0)
    .map(([tier, fills]) => `${tier}=${fills}`)
    .join(", ");

  const lines = [`#### ${label} (${description})`, "", "| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"];
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
    `| *of which resolver* | ${combined.resolvedTrades} | ${signedPct(combined.resolvedReturnPct)} | — | ${combined.resolvedWinRate.toFixed(1)}% | — | avg ${signedPct(resolverAvg, 3)} |`,
  );
  lines.push("");
  lines.push(`Tier fills: ${tierFills || "none"}`);
  lines.push("");
  return lines.join("\n");
}

function renderStackComparison(
  title: string,
  baselineLabel: string,
  baseline: StackStats,
  stacks: Array<{ label: string; stats: StackStats }>,
) {
  const lines = [
    `### ${title}`,
    "",
    "| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Resolver Avg% |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${baselineLabel} | ${baseline.totalTrades} | ${signedPct(baseline.totalReturnPct)} | ${baseline.maxDdPct.toFixed(2)}% | ${baseline.winRatePct.toFixed(1)}% | ${baseline.losingWeeks} | ${baseline.coverage} | — |`,
  ];
  for (const stack of stacks) {
    const resolverAvg = stack.stats.resolvedTrades > 0
      ? round(stack.stats.resolvedReturnPct / stack.stats.resolvedTrades, 3)
      : 0;
    lines.push(
      `| ${stack.label} | ${stack.stats.totalTrades} | ${signedPct(stack.stats.totalReturnPct)} | ${stack.stats.maxDdPct.toFixed(2)}% | ${stack.stats.winRatePct.toFixed(1)}% | ${stack.stats.losingWeeks} | ${stack.stats.coverage} | ${signedPct(resolverAvg, 3)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   Neutral Resolver Stack Research                              ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const possibleByClass = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, weeks.length * PAIRS_BY_ASSET_CLASS[assetClass].length]),
  ) as Record<AssetClass, number>;
  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);

  const sentimentAvailability = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, { present: 0, possible: possibleByClass[assetClass] }]),
  ) as Record<AssetClass, AvailabilityStats>;
  const strengthAvailability = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, { present: 0, possible: possibleByClass[assetClass] }]),
  ) as Record<AssetClass, AvailabilityStats>;

  const rows: Row[] = [];

  for (const rawWeekOpenUtc of weeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const priorWeekOpenUtc =
      DateTime.fromISO(weekOpenUtc, { zone: "utc" }).minus({ weeks: 1 }).toUTC().toISO() ?? weekOpenUtc;

    const [weeklyReturns, adrMap, currentSentiment, priorSentiment, currentStrength] = await Promise.all([
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
      getAggregatesAsOf(weekOpenUtc),
      getAggregatesAsOf(priorWeekOpenUtc),
      readWeeklyPairStrengths(weekOpenUtc),
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
    const currentSentMap = new Map(currentSentiment.map((agg) => [agg.symbol.toUpperCase(), agg]));
    const priorSentMap = new Map(priorSentiment.map((agg) => [agg.symbol.toUpperCase(), agg]));
    const currentStrengthMap = new Map(currentStrength.map((row) => [row.pair.toUpperCase(), row]));

    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const ret = returnMap.get(pair);
        if (!ret) continue;

        const agg = currentSentMap.get(pair);
        const priorAgg = priorSentMap.get(pair);
        const sentS1 = sentimentS1(agg);
        const sentHasData = Boolean(agg);
        const sentIsNeutral = sentHasData && sentS1 === null;
        if (sentHasData) sentimentAvailability[assetClass].present++;

        const sentTiers = sentIsNeutral && agg
          ? {
              tier1: sentTier1MildCrowding(agg),
              tier2: sentTier2Persistence(agg, priorAgg),
              tier3Standalone: null,
              tier3Stack: null,
              tier4: sentTier4SoftFade(agg),
              tier5: sentTier5ForcedLean(agg),
            }
          : null;

        const str = currentStrengthMap.get(pair);
        const strT1 = strengthT1(str);
        const strHasData = Boolean(str && str.availableWindows > 0);
        const strIsNeutral = strHasData && strT1 === null;
        if (strHasData) strengthAvailability[assetClass].present++;

        const strTiers = strIsNeutral && str
          ? {
              tier1: strTier1RawSpreadSum(str),
              tier2: strTier2WeightedSpread(str),
              tier3: strTier324hOnly(str),
              tier4: strTier4SoftThreshold(str),
              tier5: strTier5AnyWindowLean(str),
            }
          : null;

        rows.push({
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: ret.rawReturnPct,
          adrMultiplier: ret.adrMultiplier,
          sentS1,
          strT1,
          sentIsNeutral,
          strIsNeutral,
          sentHasData,
          strHasData,
          sentTiers,
          strTiers,
          aggLongPct: agg?.agg_long_pct ?? null,
          priorAggLongPct: priorAgg?.agg_long_pct ?? null,
        });
      }
    }
  }

  for (const week of weeks.map((w) => normalizeWeekOpenUtc(w) ?? w)) {
    const weekSentNeutrals = rows.filter((row) => row.weekOpenUtc === week && row.sentIsNeutral && row.aggLongPct !== null);
    if (weekSentNeutrals.length > 0) {
      const standaloneMedian = computeMedian(
        weekSentNeutrals.map((row) => Math.abs((row.aggLongPct ?? 50) - 50)),
      );
      for (const row of weekSentNeutrals) {
        const extremity = Math.abs((row.aggLongPct ?? 50) - 50);
        if (extremity > standaloneMedian && row.sentTiers) {
          row.sentTiers.tier3Standalone =
            row.aggLongPct! > 50 ? "SHORT" : row.aggLongPct! < 50 ? "LONG" : null;
        }
      }
    }

    const post12Neutrals = rows.filter(
      (row) =>
        row.weekOpenUtc === week &&
        row.sentIsNeutral &&
        row.sentTiers !== null &&
        row.sentTiers.tier1 === null &&
        row.sentTiers.tier2 === null &&
        row.aggLongPct !== null,
    );
    if (post12Neutrals.length > 0) {
      const stackMedian = computeMedian(
        post12Neutrals.map((row) => Math.abs((row.aggLongPct ?? 50) - 50)),
      );
      for (const row of post12Neutrals) {
        const extremity = Math.abs((row.aggLongPct ?? 50) - 50);
        if (extremity > stackMedian && row.sentTiers) {
          row.sentTiers.tier3Stack =
            row.aggLongPct! > 50 ? "SHORT" : row.aggLongPct! < 50 ? "LONG" : null;
        }
      }
    }
  }

  const sentimentBaseline = computeSentimentStackStats(rows, combinedPossible, null);
  const strengthBaseline = computeStrengthStackStats(rows, combinedPossible, null);

  const sentTierQuality: Array<{ name: string; stats: TierQualityStats }> = [
    {
      name: "Tier 1: 60/40",
      stats: computeTierQualityStats(rows.filter((row) => row.sentIsNeutral), combinedPossible, (row) => row.sentTiers?.tier1 ?? null),
    },
    {
      name: "Tier 2: Persistence (55/45 avg)",
      stats: computeTierQualityStats(rows.filter((row) => row.sentIsNeutral), combinedPossible, (row) => row.sentTiers?.tier2 ?? null),
    },
    {
      name: "Tier 3: Relative extremity",
      stats: computeTierQualityStats(rows.filter((row) => row.sentIsNeutral), combinedPossible, (row) => row.sentTiers?.tier3Standalone ?? null),
    },
    {
      name: "Tier 4: Soft fade (53/47)",
      stats: computeTierQualityStats(rows.filter((row) => row.sentIsNeutral), combinedPossible, (row) => row.sentTiers?.tier4 ?? null),
    },
    {
      name: "Tier 5: Forced lean (51/49)",
      stats: computeTierQualityStats(rows.filter((row) => row.sentIsNeutral), combinedPossible, (row) => row.sentTiers?.tier5 ?? null),
    },
  ];

  const strTierQuality: Array<{ name: string; stats: TierQualityStats }> = [
    {
      name: "Tier 1: Raw spread sum",
      stats: computeTierQualityStats(rows.filter((row) => row.strIsNeutral), combinedPossible, (row) => row.strTiers?.tier1 ?? null),
    },
    {
      name: "Tier 2: Weighted (24h×2)",
      stats: computeTierQualityStats(rows.filter((row) => row.strIsNeutral), combinedPossible, (row) => row.strTiers?.tier2 ?? null),
    },
    {
      name: "Tier 3: 24h only",
      stats: computeTierQualityStats(rows.filter((row) => row.strIsNeutral), combinedPossible, (row) => row.strTiers?.tier3 ?? null),
    },
    {
      name: "Tier 4: Softer threshold (4)",
      stats: computeTierQualityStats(rows.filter((row) => row.strIsNeutral), combinedPossible, (row) => row.strTiers?.tier4 ?? null),
    },
    {
      name: "Tier 5: Any window lean",
      stats: computeTierQualityStats(rows.filter((row) => row.strIsNeutral), combinedPossible, (row) => row.strTiers?.tier5 ?? null),
    },
  ];

  const sentStackCombined = Object.fromEntries(
    (Object.keys(SENT_STACK_LABELS) as SentStackName[]).map((stack) => [stack, computeSentimentStackStats(rows, combinedPossible, stack)]),
  ) as Record<SentStackName, StackStats>;
  const strStackCombined = Object.fromEntries(
    (Object.keys(STR_STACK_LABELS) as StrStackName[]).map((stack) => [stack, computeStrengthStackStats(rows, combinedPossible, stack)]),
  ) as Record<StrStackName, StackStats>;

  const sentStackPerAsset = Object.fromEntries(
    (Object.keys(SENT_STACK_LABELS) as SentStackName[]).map((stack) => [
      stack,
      {
        fx: computeSentimentStackStats(rows.filter((row) => row.assetClass === "fx"), possibleByClass.fx, stack),
        indices: computeSentimentStackStats(rows.filter((row) => row.assetClass === "indices"), possibleByClass.indices, stack),
        crypto: computeSentimentStackStats(rows.filter((row) => row.assetClass === "crypto"), possibleByClass.crypto, stack),
        commodities: computeSentimentStackStats(rows.filter((row) => row.assetClass === "commodities"), possibleByClass.commodities, stack),
        combined: sentStackCombined[stack],
      },
    ]),
  ) as Record<SentStackName, Record<AssetClass | "combined", StackStats>>;

  const strStackPerAsset = Object.fromEntries(
    (Object.keys(STR_STACK_LABELS) as StrStackName[]).map((stack) => [
      stack,
      {
        fx: computeStrengthStackStats(rows.filter((row) => row.assetClass === "fx"), possibleByClass.fx, stack),
        indices: computeStrengthStackStats(rows.filter((row) => row.assetClass === "indices"), possibleByClass.indices, stack),
        crypto: computeStrengthStackStats(rows.filter((row) => row.assetClass === "crypto"), possibleByClass.crypto, stack),
        commodities: computeStrengthStackStats(rows.filter((row) => row.assetClass === "commodities"), possibleByClass.commodities, stack),
        combined: strStackCombined[stack],
      },
    ]),
  ) as Record<StrStackName, Record<AssetClass | "combined", StackStats>>;

  const gapSentNeutralsWithData = rows.filter((row) => row.sentIsNeutral).length;
  const gapSentNoData = rows.filter((row) => !row.sentHasData).length;
  const gapStrNeutralsWithData = rows.filter((row) => row.strIsNeutral).length;
  const gapStrNoData = rows.filter((row) => !row.strHasData).length;

  const lines: string[] = [];
  lines.push("# Neutral Resolver Stack Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} -> ${weekLabel(weeks.at(-1)!)}).`);
  lines.push("Universe: 36 pairs × 10 weeks = 360 possible pair-weeks.");
  lines.push("");
  lines.push("## Gap Analysis");
  lines.push("");
  lines.push("### Sentiment");
  lines.push(`- S1 baseline: ${sentimentBaseline.totalTrades}/360 trades`);
  lines.push(`- Neutrals with data: ${gapSentNeutralsWithData} pair-weeks`);
  lines.push(`- Neutrals without data: ${gapSentNoData} pair-weeks`);
  lines.push(`- Data ceiling: ${combinedPossible - gapSentNoData}/${combinedPossible} (${(((combinedPossible - gapSentNoData) / combinedPossible) * 100).toFixed(1)}%)`);
  lines.push("");
  lines.push("### Strength");
  lines.push(`- T1 baseline: ${strengthBaseline.totalTrades}/360 trades`);
  lines.push(`- Neutrals with data: ${gapStrNeutralsWithData} pair-weeks`);
  lines.push(`- Neutrals without data: ${gapStrNoData} pair-weeks`);
  lines.push(`- Data ceiling: ${combinedPossible - gapStrNoData}/${combinedPossible} (${(((combinedPossible - gapStrNoData) / combinedPossible) * 100).toFixed(1)}%)`);
  lines.push("");
  lines.push(renderAvailability("Sentiment Data Availability", sentimentAvailability));
  lines.push(renderAvailability("Strength Data Availability", strengthAvailability));
  lines.push("## Sentiment Resolver");
  lines.push("");
  lines.push(renderTierQualityTable("Individual Tier Quality", sentTierQuality));
  lines.push("### Sentiment Stack Results");
  lines.push("");
  for (const stack of Object.keys(SENT_STACK_LABELS) as SentStackName[]) {
    lines.push(renderStackAssetTable(SENT_STACK_LABELS[stack], SENT_STACK_DESCRIPTIONS[stack], sentStackPerAsset[stack]));
  }
  lines.push(
    renderStackComparison(
      "Sentiment Stack Comparison",
      "S1 Baseline (no resolver)",
      sentimentBaseline,
      (Object.keys(SENT_STACK_LABELS) as SentStackName[]).map((stack) => ({
        label: SENT_STACK_LABELS[stack],
        stats: sentStackCombined[stack],
      })),
    ),
  );
  lines.push("## Strength Resolver");
  lines.push("");
  lines.push(renderTierQualityTable("Individual Tier Quality", strTierQuality));
  lines.push("### Strength Stack Results");
  lines.push("");
  for (const stack of Object.keys(STR_STACK_LABELS) as StrStackName[]) {
    lines.push(renderStackAssetTable(STR_STACK_LABELS[stack], STR_STACK_DESCRIPTIONS[stack], strStackPerAsset[stack]));
  }
  lines.push(
    renderStackComparison(
      "Strength Stack Comparison",
      "T1 Baseline (no resolver)",
      strengthBaseline,
      (Object.keys(STR_STACK_LABELS) as StrStackName[]).map((stack) => ({
        label: STR_STACK_LABELS[stack],
        stats: strStackCombined[stack],
      })),
    ),
  );

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
