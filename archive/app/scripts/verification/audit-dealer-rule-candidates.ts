/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: audit-dealer-rule-candidates.ts
 *
 * Description:
 * Gate 34 research receipt for alternate Dealer-only Weekly Hold source rules.
 * Reuses corrected week-close baseline receipts, then rescores direction rows
 * without rebuilding price history.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { readSnapshot } from "@/lib/cotStore";
import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { resolveMarketBias } from "@/lib/cotCompute";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT" | "NEUTRAL" | "MISSING";

type PairRow = {
  weekOpenUtc: string;
  pineWeekKey: string;
  symbol: string;
  direction: Direction;
  rawReturnPct: number | null;
  adrReturnPct: number | null;
  pairAdrPct: number | null;
};

type WeekReceipt = {
  weekOpenUtc: string;
  pineWeekKey: string;
  pairRows: PairRow[];
  totals: {
    rawReturnPct: number;
    adrReturnPct: number;
  };
};

type BaselineReceipt = {
  generatedAtUtc: string;
  scope: {
    displayedWeekFrom: string;
    displayedWeekTo: string;
    selectedWeekCount: number;
  };
  weeks: WeekReceipt[];
};

type DealerRule = {
  tier: string;
  direction: Direction | null;
  ratioDirection: Direction | null;
  deltaDirection: Direction | null;
  signedSpreadDirection: Direction | null;
  subtractiveSpreadDirection: Direction | null;
  signedSpreadScore: number | null;
  subtractiveSpreadScore: number | null;
  minLegDirectionalRatio: number | null;
  baseRatio: number | null;
  quoteRatio: number | null;
};

type ScoredTrade = {
  week: string;
  symbol: string;
  ruleTier: string;
  originalDirection: Direction;
  direction: Direction;
  raw: number;
  adr: number;
};

const PAIR_DEF_BY_SYMBOL = new Map(
  PAIRS_BY_ASSET_CLASS.fx.map((pair) => [pair.pair.toUpperCase(), pair]),
);

const YEAR_WINDOWS = [
  { label: "clean 2019", weeks: "43w", displayedWeekFrom: "2019-01-01", displayedWeekTo: "2019-12-31" },
  { label: "clean 2020", weeks: "52w", displayedWeekFrom: "2020-01-01", displayedWeekTo: "2020-12-31" },
  { label: "clean 2021", weeks: "52w", displayedWeekFrom: "2021-01-01", displayedWeekTo: "2021-12-31" },
  { label: "clean 2022", weeks: "52w", displayedWeekFrom: "2022-01-01", displayedWeekTo: "2022-12-31" },
  { label: "clean 2023", weeks: "45w", displayedWeekFrom: "2023-01-01", displayedWeekTo: "2023-12-31" },
  { label: "2024", weeks: "52w", displayedWeekFrom: "2024-01-09", displayedWeekTo: "2024-12-31" },
  { label: "clean 2025", weeks: "39w", displayedWeekFrom: "2025-01-06", displayedWeekTo: "2025-09-29" },
  { label: "current 2026", weeks: "23w", displayedWeekFrom: "2026-01-01", displayedWeekTo: "2026-06-08" },
  { label: "clean 2025 + current 2026", weeks: "62w", displayedWeekFrom: "2025-01-06", displayedWeekTo: "2026-06-08" },
];

const HISTORY_LABELS = ["clean 2019", "clean 2020", "clean 2021", "clean 2022", "clean 2023"];
const HISTORY_2024_LABELS = [...HISTORY_LABELS, "2024"];
const FULL_CLEAN_LABELS = [...HISTORY_2024_LABELS, "clean 2025", "current 2026"];
const HISTORY_WINDOW_LABEL = "source-clean 2019-2023";
const HISTORY_2024_WINDOW_LABEL = "source-clean 2019-2024";
const FULL_CLEAN_WINDOW_LABEL = "source-clean 2019-current";
const THREE_WINDOW_LABEL = "2024 + clean 2025 + current 2026";
const RATIO_FOCUS_VARIANTS = ["current", "direct_ratio_override", "ratio_direction_all"] as const;

const VARIANT_LABELS: Record<string, string> = {
  current: "Current Dealer rule",
  neutral_only: "Trade only neutral/tiebreaker rows",
  direct_only: "Trade only direct opposed-bias rows",
  direct_inverted: "Invert only direct opposed-bias rows",
  direct_ratio_confirmed: "Keep direct rows only when directional-ratio agrees",
  direct_ratio_override: "Use directional-ratio on direct rows",
  ratio_direction_all: "Use directional-ratio direction for every row",
  direct_delta_confirmed: "Keep direct rows only when delta-diff agrees",
  direct_delta_override: "Use delta-diff direction on direct rows",
  delta_direction_all: "Use delta-diff direction for every row",
  direct_signed_spread_confirmed: "Keep direct rows only when signed spread score agrees",
  direct_signed_spread_override: "Use signed spread score on direct rows",
  signed_spread_all: "Use signed spread score for every row",
  signed_spread_all_min0p25: "Use signed spread score when abs(pair score) >= 0.25",
  signed_spread_all_min0p50: "Use signed spread score when abs(pair score) >= 0.50",
  direct_subtractive_spread_confirmed: "Keep direct rows only when net-minus-spread agrees",
  direct_subtractive_spread_override: "Use net-minus-spread on direct rows",
  subtractive_spread_all: "Use net-minus-spread score for every row",
  direct_2of3_spread0p25: "Direct rows use raw/delta/spread-clean 2-of-3, spread threshold 0.25",
  direct_2of3_spread0p50: "Direct rows use raw/delta/spread-clean 2-of-3, spread threshold 0.50",
  direct_raw_delta_spread0p25: "Direct rows require raw+delta agreement and spread threshold 0.25",
  direct_raw_delta_spread0p50: "Direct rows require raw+delta agreement and spread threshold 0.50",
  direct_min_leg_ratio0p50: "Keep direct rows only when both legs have Dealer ratio >= 0.50",
  direct_min_leg_ratio0p66: "Keep direct rows only when both legs have Dealer ratio >= 0.66",
  direct_min_leg_ratio0p75: "Keep direct rows only when both legs have Dealer ratio >= 0.75",
  direct_2of3_leg_ratio0p66: "Direct rows use raw/delta/leg-ratio-clean 2-of-3, threshold 0.66",
  direct_2of3_leg_ratio0p75: "Direct rows use raw/delta/leg-ratio-clean 2-of-3, threshold 0.75",
  direct_raw_delta_leg_ratio0p66: "Direct rows require raw+delta agreement and leg ratio >= 0.66",
  direct_raw_delta_leg_ratio0p75: "Direct rows require raw+delta agreement and leg ratio >= 0.75",
};

function argValue(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function latestMatchingFile(dir: string, includes: string[]) {
  const entries = await readdir(dir);
  const candidates = await Promise.all(entries
    .filter((entry) => entry.endsWith(".json") && includes.every((part) => entry.includes(part)))
    .map(async (entry) => {
      const fullPath = path.join(dir, entry);
      const info = await stat(fullPath);
      return { fullPath, mtimeMs: info.mtimeMs };
    }));
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  if (!candidates[0]) {
    throw new Error(`No matching receipt in ${dir}: ${includes.join(", ")}`);
  }
  return candidates[0].fullPath;
}

async function latestMatchingBaselineFile(
  dir: string,
  window: { weeks: string; displayedWeekFrom?: string; displayedWeekTo?: string },
) {
  const entries = await readdir(dir);
  const candidates = await Promise.all(entries
    .filter((entry) => entry.endsWith(".json") && entry.includes(`baseline-${window.weeks}`))
    .map(async (entry) => {
      const fullPath = path.join(dir, entry);
      const info = await stat(fullPath);
      return { fullPath, mtimeMs: info.mtimeMs };
    }));
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (const candidate of candidates) {
    const receipt = await readJson<BaselineReceipt>(candidate.fullPath);
    if (
      (!window.displayedWeekFrom || receipt.scope.displayedWeekFrom === window.displayedWeekFrom) &&
      (!window.displayedWeekTo || receipt.scope.displayedWeekTo === window.displayedWeekTo)
    ) {
      return { baselinePath: candidate.fullPath, receipt };
    }
  }

  throw new Error(
    `No matching baseline receipt in ${dir}: baseline-${window.weeks} ${window.displayedWeekFrom ?? "*"} -> ${window.displayedWeekTo ?? "*"}`,
  );
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function round(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function fmtNumber(value: number | null | undefined, digits = 2) {
  const rounded = round(value, digits);
  if (rounded === null) return "n/a";
  return rounded.toFixed(digits);
}

function signed(value: number | null | undefined, digits = 2) {
  const rounded = round(value, digits);
  if (rounded === null) return "n/a";
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(digits)}%`;
}

function directionSign(direction: Direction) {
  if (direction === "LONG") return 1;
  if (direction === "SHORT") return -1;
  return 0;
}

function invertDirection(direction: Direction): Direction | null {
  if (direction === "LONG") return "SHORT";
  if (direction === "SHORT") return "LONG";
  return null;
}

function directionFromScore(score: number | null | undefined): Direction | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score === 0) return null;
  return score > 0 ? "LONG" : "SHORT";
}

function dealerDirectionalRatio(market: any) {
  if (typeof market?.dealer_directional_ratio === "number") return market.dealer_directional_ratio;
  if (typeof market?.dealer_spread !== "number" || market.dealer_spread < 0) return null;
  const directional = Math.abs(Number(market.dealer_net));
  const denom = directional + market.dealer_spread;
  return denom > 0 ? directional / denom : null;
}

function signedSpreadStrength(market: any) {
  if (typeof market?.dealer_net !== "number") return null;
  if (typeof market?.dealer_spread !== "number" || market.dealer_spread < 0) return null;
  const directional = Math.abs(market.dealer_net);
  const denom = directional + market.dealer_spread;
  return denom > 0 ? market.dealer_net / denom : null;
}

function subtractiveSpreadNet(market: any) {
  if (typeof market?.dealer_net !== "number") return null;
  if (typeof market?.dealer_spread !== "number" || market.dealer_spread < 0) return null;
  const adjusted = Math.max(Math.abs(market.dealer_net) - market.dealer_spread, 0);
  return Math.sign(market.dealer_net) * adjusted;
}

function spreadCleanVote(rawDirection: Direction | null, signedSpreadScore: number | null, threshold: number) {
  if (!rawDirection || typeof signedSpreadScore !== "number" || !Number.isFinite(signedSpreadScore)) return null;
  return Math.abs(signedSpreadScore) >= threshold ? rawDirection : null;
}

function qualityCleanVote(rawDirection: Direction | null, quality: number | null, threshold: number) {
  if (!rawDirection || typeof quality !== "number" || !Number.isFinite(quality)) return null;
  return quality >= threshold ? rawDirection : null;
}

function majorityDirection(votes: Array<Direction | null>) {
  const longVotes = votes.filter((vote) => vote === "LONG").length;
  const shortVotes = votes.filter((vote) => vote === "SHORT").length;
  if (longVotes >= 2 && longVotes > shortVotes) return "LONG";
  if (shortVotes >= 2 && shortVotes > longVotes) return "SHORT";
  return null;
}

function classifyDealerRule(base: any, quote: any): DealerRule {
  const baseRatio = dealerDirectionalRatio(base);
  const quoteRatio = dealerDirectionalRatio(quote);
  const minLegDirectionalRatio =
    typeof baseRatio === "number" && typeof quoteRatio === "number"
      ? Math.min(baseRatio, quoteRatio)
      : null;
  const baseSignedSpreadStrength = signedSpreadStrength(base);
  const quoteSignedSpreadStrength = signedSpreadStrength(quote);
  const baseSubtractiveSpreadNet = subtractiveSpreadNet(base);
  const quoteSubtractiveSpreadNet = subtractiveSpreadNet(quote);
  const signedSpreadScore =
    typeof baseSignedSpreadStrength === "number" && typeof quoteSignedSpreadStrength === "number"
      ? baseSignedSpreadStrength - quoteSignedSpreadStrength
      : null;
  const subtractiveSpreadScore =
    typeof baseSubtractiveSpreadNet === "number" && typeof quoteSubtractiveSpreadNet === "number"
      ? baseSubtractiveSpreadNet - quoteSubtractiveSpreadNet
      : null;
  const ratioDirection =
    typeof baseRatio === "number" && typeof quoteRatio === "number"
      ? directionFromScore(baseRatio - quoteRatio)
      : null;
  const deltaDirection =
    typeof base?.dealer_delta_net === "number" && typeof quote?.dealer_delta_net === "number"
      ? directionFromScore(base.dealer_delta_net - quote.dealer_delta_net)
      : null;
  const signedSpreadDirection = directionFromScore(signedSpreadScore);
  const subtractiveSpreadDirection = directionFromScore(subtractiveSpreadScore);

  const baseBias = base ? resolveMarketBias(base, "dealer") : null;
  const quoteBias = quote ? resolveMarketBias(quote, "dealer") : null;
  if (!baseBias || !quoteBias) {
    return {
      tier: "missing_market",
      direction: null,
      ratioDirection,
      deltaDirection,
      signedSpreadDirection,
      subtractiveSpreadDirection,
      signedSpreadScore,
      subtractiveSpreadScore,
      minLegDirectionalRatio,
      baseRatio,
      quoteRatio,
    };
  }

  if (
    baseBias.bias !== "NEUTRAL" &&
    quoteBias.bias !== "NEUTRAL" &&
    baseBias.bias !== quoteBias.bias
  ) {
    return {
      tier: "direct_opposed_bias",
      direction: baseBias.bias === "BULLISH" && quoteBias.bias === "BEARISH" ? "LONG" : "SHORT",
      ratioDirection,
      deltaDirection,
      signedSpreadDirection,
      subtractiveSpreadDirection,
      signedSpreadScore,
      subtractiveSpreadScore,
      minLegDirectionalRatio,
      baseRatio,
      quoteRatio,
    };
  }

  if (ratioDirection) {
    return {
      tier: "neutral_tier1_directional_ratio",
      direction: ratioDirection,
      ratioDirection,
      deltaDirection,
      signedSpreadDirection,
      subtractiveSpreadDirection,
      signedSpreadScore,
      subtractiveSpreadScore,
      minLegDirectionalRatio,
      baseRatio,
      quoteRatio,
    };
  }

  const basePersistence = base.dealer_delta_persistence ?? 0;
  const quotePersistence = quote.dealer_delta_persistence ?? 0;
  if (basePersistence !== quotePersistence && (basePersistence >= 3 || quotePersistence >= 3)) {
    if (
      basePersistence > quotePersistence &&
      basePersistence >= 3 &&
      typeof base.dealer_delta_net === "number" &&
      base.dealer_delta_net !== 0
    ) {
      return {
        tier: "neutral_tier2_delta_persistence",
        direction: base.dealer_delta_net > 0 ? "LONG" : "SHORT",
        ratioDirection,
        deltaDirection,
        signedSpreadDirection,
        subtractiveSpreadDirection,
        signedSpreadScore,
        subtractiveSpreadScore,
        minLegDirectionalRatio,
        baseRatio,
        quoteRatio,
      };
    }
    if (
      quotePersistence > basePersistence &&
      quotePersistence >= 3 &&
      typeof quote.dealer_delta_net === "number" &&
      quote.dealer_delta_net !== 0
    ) {
      return {
        tier: "neutral_tier2_delta_persistence",
        direction: quote.dealer_delta_net > 0 ? "SHORT" : "LONG",
        ratioDirection,
        deltaDirection,
        signedSpreadDirection,
        subtractiveSpreadDirection,
        signedSpreadScore,
        subtractiveSpreadScore,
        minLegDirectionalRatio,
        baseRatio,
        quoteRatio,
      };
    }
  }

  const baseConfirmed =
    typeof base.dealer_delta_net === "number" &&
    typeof base.oi_delta === "number" &&
    base.dealer_delta_net !== 0 &&
    base.oi_delta !== 0 &&
    Math.sign(base.dealer_delta_net) === Math.sign(base.oi_delta);
  const quoteConfirmed =
    typeof quote.dealer_delta_net === "number" &&
    typeof quote.oi_delta === "number" &&
    quote.dealer_delta_net !== 0 &&
    quote.oi_delta !== 0 &&
    Math.sign(quote.dealer_delta_net) === Math.sign(quote.oi_delta);

  if (baseConfirmed && !quoteConfirmed) {
    return {
      tier: "neutral_tier3_oi_confirmed_delta",
      direction: base.dealer_delta_net > 0 ? "LONG" : "SHORT",
      ratioDirection,
      deltaDirection,
      signedSpreadDirection,
      subtractiveSpreadDirection,
      signedSpreadScore,
      subtractiveSpreadScore,
      minLegDirectionalRatio,
      baseRatio,
      quoteRatio,
    };
  }
  if (quoteConfirmed && !baseConfirmed) {
    return {
      tier: "neutral_tier3_oi_confirmed_delta",
      direction: quote.dealer_delta_net > 0 ? "SHORT" : "LONG",
      ratioDirection,
      deltaDirection,
      signedSpreadDirection,
      subtractiveSpreadDirection,
      signedSpreadScore,
      subtractiveSpreadScore,
      minLegDirectionalRatio,
      baseRatio,
      quoteRatio,
    };
  }
  if (baseConfirmed && quoteConfirmed && deltaDirection) {
    return {
      tier: "neutral_tier3_oi_confirmed_delta_diff",
      direction: deltaDirection,
      ratioDirection,
      deltaDirection,
      signedSpreadDirection,
      subtractiveSpreadDirection,
      signedSpreadScore,
      subtractiveSpreadScore,
      minLegDirectionalRatio,
      baseRatio,
      quoteRatio,
    };
  }

  if (deltaDirection) {
    return {
      tier: "neutral_tier4_raw_delta_diff",
      direction: deltaDirection,
      ratioDirection,
      deltaDirection,
      signedSpreadDirection,
      subtractiveSpreadDirection,
      signedSpreadScore,
      subtractiveSpreadScore,
      minLegDirectionalRatio,
      baseRatio,
      quoteRatio,
    };
  }

  const forced = directionFromScore(base.dealer_net - quote.dealer_net);
  return {
    tier: forced ? "neutral_tier5_forced_net" : "neutral_unresolved",
    direction: forced,
    ratioDirection,
    deltaDirection,
    signedSpreadDirection,
    subtractiveSpreadDirection,
    signedSpreadScore,
    subtractiveSpreadScore,
    minLegDirectionalRatio,
    baseRatio,
    quoteRatio,
  };
}

function directTwoOfThreeDirection(current: Direction, rule: DealerRule, spreadThreshold: number) {
  return majorityDirection([
    current,
    rule.deltaDirection,
    spreadCleanVote(current, rule.signedSpreadScore, spreadThreshold),
  ]);
}

function directRawDeltaSpreadDirection(current: Direction, rule: DealerRule, spreadThreshold: number) {
  if (rule.deltaDirection !== current) return null;
  return spreadCleanVote(current, rule.signedSpreadScore, spreadThreshold);
}

function directTwoOfThreeLegRatioDirection(current: Direction, rule: DealerRule, threshold: number) {
  return majorityDirection([
    current,
    rule.deltaDirection,
    qualityCleanVote(current, rule.minLegDirectionalRatio, threshold),
  ]);
}

function directRawDeltaLegRatioDirection(current: Direction, rule: DealerRule, threshold: number) {
  if (rule.deltaDirection !== current) return null;
  return qualityCleanVote(current, rule.minLegDirectionalRatio, threshold);
}

function selectCandidateDirection(variant: string, row: PairRow, rule: DealerRule): Direction | null {
  const isDirect = rule.tier === "direct_opposed_bias";
  const isNeutral = !isDirect && rule.tier.startsWith("neutral_");
  const current = row.direction === "LONG" || row.direction === "SHORT" ? row.direction : null;
  if (!current) return null;

  switch (variant) {
    case "current":
      return current;
    case "neutral_only":
      return isNeutral ? current : null;
    case "direct_only":
      return isDirect ? current : null;
    case "direct_inverted":
      return isDirect ? invertDirection(current) : current;
    case "direct_ratio_confirmed":
      return isDirect ? (rule.ratioDirection === current ? current : null) : current;
    case "direct_ratio_override":
      return isDirect ? rule.ratioDirection : current;
    case "ratio_direction_all":
      return rule.ratioDirection;
    case "direct_delta_confirmed":
      return isDirect ? (rule.deltaDirection === current ? current : null) : current;
    case "direct_delta_override":
      return isDirect ? rule.deltaDirection : current;
    case "delta_direction_all":
      return rule.deltaDirection;
    case "direct_signed_spread_confirmed":
      return isDirect ? (rule.signedSpreadDirection === current ? current : null) : current;
    case "direct_signed_spread_override":
      return isDirect ? rule.signedSpreadDirection : current;
    case "signed_spread_all":
      return rule.signedSpreadDirection;
    case "signed_spread_all_min0p25":
      return typeof rule.signedSpreadScore === "number" && Math.abs(rule.signedSpreadScore) >= 0.25
        ? rule.signedSpreadDirection
        : null;
    case "signed_spread_all_min0p50":
      return typeof rule.signedSpreadScore === "number" && Math.abs(rule.signedSpreadScore) >= 0.5
        ? rule.signedSpreadDirection
        : null;
    case "direct_subtractive_spread_confirmed":
      return isDirect ? (rule.subtractiveSpreadDirection === current ? current : null) : current;
    case "direct_subtractive_spread_override":
      return isDirect ? rule.subtractiveSpreadDirection : current;
    case "subtractive_spread_all":
      return rule.subtractiveSpreadDirection;
    case "direct_2of3_spread0p25":
      return isDirect ? directTwoOfThreeDirection(current, rule, 0.25) : current;
    case "direct_2of3_spread0p50":
      return isDirect ? directTwoOfThreeDirection(current, rule, 0.5) : current;
    case "direct_raw_delta_spread0p25":
      return isDirect ? directRawDeltaSpreadDirection(current, rule, 0.25) : current;
    case "direct_raw_delta_spread0p50":
      return isDirect ? directRawDeltaSpreadDirection(current, rule, 0.5) : current;
    case "direct_min_leg_ratio0p50":
      return isDirect ? qualityCleanVote(current, rule.minLegDirectionalRatio, 0.5) : current;
    case "direct_min_leg_ratio0p66":
      return isDirect ? qualityCleanVote(current, rule.minLegDirectionalRatio, 0.66) : current;
    case "direct_min_leg_ratio0p75":
      return isDirect ? qualityCleanVote(current, rule.minLegDirectionalRatio, 0.75) : current;
    case "direct_2of3_leg_ratio0p66":
      return isDirect ? directTwoOfThreeLegRatioDirection(current, rule, 0.66) : current;
    case "direct_2of3_leg_ratio0p75":
      return isDirect ? directTwoOfThreeLegRatioDirection(current, rule, 0.75) : current;
    case "direct_raw_delta_leg_ratio0p66":
      return isDirect ? directRawDeltaLegRatioDirection(current, rule, 0.66) : current;
    case "direct_raw_delta_leg_ratio0p75":
      return isDirect ? directRawDeltaLegRatioDirection(current, rule, 0.75) : current;
    default:
      throw new Error(`Unknown variant: ${variant}`);
  }
}

function scoreRow(row: PairRow, candidateDirection: Direction): { raw: number; adr: number } | null {
  if (
    (row.direction !== "LONG" && row.direction !== "SHORT") ||
    (candidateDirection !== "LONG" && candidateDirection !== "SHORT") ||
    typeof row.rawReturnPct !== "number" ||
    !Number.isFinite(row.rawReturnPct) ||
    typeof row.pairAdrPct !== "number" ||
    !Number.isFinite(row.pairAdrPct) ||
    row.pairAdrPct <= 0
  ) {
    return null;
  }

  const longMovePct = row.rawReturnPct * directionSign(row.direction);
  const raw = longMovePct * directionSign(candidateDirection);
  return { raw, adr: raw / row.pairAdrPct };
}

function profitFactor(values: number[]) {
  const grossProfit = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return grossLoss > 0 ? grossProfit / grossLoss : null;
}

function maxDrawdown(values: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  }
  return maxDd;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg === null) return null;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function summarizeTrades(trades: ScoredTrade[], weeks: WeekReceipt[]) {
  const byWeek = new Map<string, number>();
  const byWeekTradeCounts = new Map<string, number>();
  for (const week of weeks) {
    byWeek.set(week.pineWeekKey, 0);
    byWeekTradeCounts.set(week.pineWeekKey, 0);
  }
  for (const trade of trades) {
    byWeek.set(trade.week, (byWeek.get(trade.week) ?? 0) + trade.adr);
    byWeekTradeCounts.set(trade.week, (byWeekTradeCounts.get(trade.week) ?? 0) + 1);
  }

  const weeklyAdr = [...byWeek.values()];
  const tradeAdr = trades.map((trade) => trade.adr);
  const tradeRaw = trades.map((trade) => trade.raw);
  const weeklyMean = mean(weeklyAdr);
  const weeklySd = standardDeviation(weeklyAdr);
  const totalAdr = tradeAdr.reduce((sum, value) => sum + value, 0);
  const totalRaw = tradeRaw.reduce((sum, value) => sum + value, 0);
  const weeklyWins = weeklyAdr.filter((value) => value > 0).length;
  const weeklyLosses = weeklyAdr.filter((value) => value < 0).length;
  const weeklyFlats = weeklyAdr.filter((value) => value === 0).length;
  const tradeWins = tradeAdr.filter((value) => value > 0).length;
  const tradeLosses = tradeAdr.filter((value) => value < 0).length;
  const weeklyDd = maxDrawdown(weeklyAdr);
  const byRule = new Map<string, { trades: number; adr: number; raw: number; wins: number; losses: number }>();

  for (const trade of trades) {
    const current = byRule.get(trade.ruleTier) ?? { trades: 0, adr: 0, raw: 0, wins: 0, losses: 0 };
    current.trades += 1;
    current.adr += trade.adr;
    current.raw += trade.raw;
    if (trade.adr > 0) current.wins += 1;
    if (trade.adr < 0) current.losses += 1;
    byRule.set(trade.ruleTier, current);
  }

  return {
    trades: trades.length,
    activeWeeks: [...byWeekTradeCounts.values()].filter((count) => count > 0).length,
    totalRawPct: round(totalRaw, 2),
    totalAdrPct: round(totalAdr, 2),
    weeklyAdrProfitFactor: round(profitFactor(weeklyAdr), 2),
    tradeAdrProfitFactor: round(profitFactor(tradeAdr), 2),
    tradeRawProfitFactor: round(profitFactor(tradeRaw), 2),
    tradeAdrExpectancyPct: round(mean(tradeAdr), 3),
    weeklyAdrExpectancyPct: round(weeklyMean, 3),
    weeklyAdrSharpeStyleScore: round(
      weeklyMean !== null && weeklySd !== null && weeklySd > 0 ? weeklyMean / weeklySd : null,
      3,
    ),
    weeklyEquityMaxDrawdownAdrPct: round(weeklyDd, 2),
    adverseDdPerAdrReturn: round(totalAdr > 0 ? weeklyDd / totalAdr : null, 3),
    weeklyWins,
    weeklyLosses,
    weeklyFlats,
    tradeWins,
    tradeLosses,
    byRule: [...byRule.entries()]
      .map(([ruleTier, value]) => ({
        ruleTier,
        trades: value.trades,
        wins: value.wins,
        losses: value.losses,
        raw: round(value.raw, 2),
        adr: round(value.adr, 2),
      }))
      .sort((left, right) => Number(right.adr) - Number(left.adr)),
  };
}

function summarizeWeeklyTrades(trades: ScoredTrade[], weeks: WeekReceipt[]) {
  const tradesByWeek = new Map<string, ScoredTrade[]>();
  for (const week of weeks) {
    tradesByWeek.set(week.pineWeekKey, []);
  }
  for (const trade of trades) {
    const existing = tradesByWeek.get(trade.week) ?? [];
    existing.push(trade);
    tradesByWeek.set(trade.week, existing);
  }

  return weeks.map((week) => {
    const weekTrades = tradesByWeek.get(week.pineWeekKey) ?? [];
    const raw = weekTrades.reduce((sum, trade) => sum + trade.raw, 0);
    const adr = weekTrades.reduce((sum, trade) => sum + trade.adr, 0);
    return {
      week: week.pineWeekKey,
      trades: weekTrades.length,
      raw: round(raw, 2),
      adr: round(adr, 2),
      wins: weekTrades.filter((trade) => trade.adr > 0).length,
      losses: weekTrades.filter((trade) => trade.adr < 0).length,
      flats: weekTrades.filter((trade) => trade.adr === 0).length,
      directRows: weekTrades.filter((trade) => trade.ruleTier === "direct_opposed_bias").length,
      neutralRows: weekTrades.filter((trade) => trade.ruleTier.startsWith("neutral_")).length,
      longRows: weekTrades.filter((trade) => trade.direction === "LONG").length,
      shortRows: weekTrades.filter((trade) => trade.direction === "SHORT").length,
    };
  });
}

async function scoreReceipt(receipt: BaselineReceipt) {
  const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
  const variants = Object.keys(VARIANT_LABELS);
  const tradesByVariant = new Map<string, ScoredTrade[]>(variants.map((variant) => [variant, []]));
  const disagreementCounts = {
    directRows: 0,
    directRatioAgrees: 0,
    directRatioDisagrees: 0,
    directRatioMissing: 0,
    directDeltaAgrees: 0,
    directDeltaDisagrees: 0,
    directDeltaMissing: 0,
    directSignedSpreadAgrees: 0,
    directSignedSpreadDisagrees: 0,
    directSignedSpreadMissing: 0,
    directSubtractiveSpreadAgrees: 0,
    directSubtractiveSpreadDisagrees: 0,
    directSubtractiveSpreadMissing: 0,
    directSpreadClean0p25: 0,
    directSpreadClean0p50: 0,
    directMinLegRatio0p50: 0,
    directMinLegRatio0p66: 0,
    directMinLegRatio0p75: 0,
  };

  for (const week of receipt.weeks) {
    const reportDate = deriveCotReportDate(week.weekOpenUtc);
    if (!snapshots.has(reportDate)) {
      snapshots.set(reportDate, await readSnapshot({ assetClass: "fx", reportDate }));
    }
    const snapshot = snapshots.get(reportDate);
    for (const row of week.pairRows) {
      if (row.direction !== "LONG" && row.direction !== "SHORT") continue;
      const pairDef = PAIR_DEF_BY_SYMBOL.get(row.symbol.toUpperCase());
      if (!snapshot || !pairDef) continue;
      const rule = classifyDealerRule(snapshot.currencies[pairDef.base], snapshot.currencies[pairDef.quote]);

      if (rule.tier === "direct_opposed_bias") {
        disagreementCounts.directRows += 1;
        if (!rule.ratioDirection) disagreementCounts.directRatioMissing += 1;
        else if (rule.ratioDirection === row.direction) disagreementCounts.directRatioAgrees += 1;
        else disagreementCounts.directRatioDisagrees += 1;

        if (!rule.deltaDirection) disagreementCounts.directDeltaMissing += 1;
        else if (rule.deltaDirection === row.direction) disagreementCounts.directDeltaAgrees += 1;
        else disagreementCounts.directDeltaDisagrees += 1;

        if (!rule.signedSpreadDirection) disagreementCounts.directSignedSpreadMissing += 1;
        else if (rule.signedSpreadDirection === row.direction) disagreementCounts.directSignedSpreadAgrees += 1;
        else disagreementCounts.directSignedSpreadDisagrees += 1;

        if (!rule.subtractiveSpreadDirection) disagreementCounts.directSubtractiveSpreadMissing += 1;
        else if (rule.subtractiveSpreadDirection === row.direction) disagreementCounts.directSubtractiveSpreadAgrees += 1;
        else disagreementCounts.directSubtractiveSpreadDisagrees += 1;

        if (spreadCleanVote(row.direction, rule.signedSpreadScore, 0.25)) {
          disagreementCounts.directSpreadClean0p25 += 1;
        }
        if (spreadCleanVote(row.direction, rule.signedSpreadScore, 0.5)) {
          disagreementCounts.directSpreadClean0p50 += 1;
        }
        if (qualityCleanVote(row.direction, rule.minLegDirectionalRatio, 0.5)) {
          disagreementCounts.directMinLegRatio0p50 += 1;
        }
        if (qualityCleanVote(row.direction, rule.minLegDirectionalRatio, 0.66)) {
          disagreementCounts.directMinLegRatio0p66 += 1;
        }
        if (qualityCleanVote(row.direction, rule.minLegDirectionalRatio, 0.75)) {
          disagreementCounts.directMinLegRatio0p75 += 1;
        }
      }

      for (const variant of variants) {
        const candidateDirection = selectCandidateDirection(variant, row, rule);
        if (!candidateDirection) continue;
        const score = scoreRow(row, candidateDirection);
        if (!score) continue;
        tradesByVariant.get(variant)?.push({
          week: week.pineWeekKey,
          symbol: row.symbol.toUpperCase(),
          ruleTier: rule.tier,
          originalDirection: row.direction,
          direction: candidateDirection,
          raw: score.raw,
          adr: score.adr,
        });
      }
    }
  }

  return {
    disagreementCounts,
    variants: variants.map((variant) => ({
      variant,
      label: VARIANT_LABELS[variant],
      ...summarizeTrades(tradesByVariant.get(variant) ?? [], receipt.weeks),
    })),
    weeklyBreakdowns: Object.fromEntries(RATIO_FOCUS_VARIANTS.map((variant) => [
      variant,
      summarizeWeeklyTrades(tradesByVariant.get(variant) ?? [], receipt.weeks),
    ])),
  };
}

function table(headers: string[], rows: Array<Array<string | number | null>>) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.map((cell) => cell ?? "n/a").join(" | ")} |`);
  }
  return lines.join("\n");
}

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

function ratioWeeklyRowsForResult(result: any) {
  const currentRows = result.weeklyBreakdowns.current ?? [];
  const directRatioRows = result.weeklyBreakdowns.direct_ratio_override ?? [];
  const ratioAllRows = result.weeklyBreakdowns.ratio_direction_all ?? [];
  return currentRows.map((current: any, index: number) => {
    const directRatio = directRatioRows[index] ?? {};
    const ratioAll = ratioAllRows[index] ?? {};
    return {
      week: current.week,
      current,
      directRatio,
      ratioAll,
    };
  });
}

function ratioFocusSummaryRows(results: any[]) {
  return results.flatMap((result) => RATIO_FOCUS_VARIANTS.map((variant) => {
    const summary = result.variants.find((entry: any) => entry.variant === variant);
    return [
      result.label,
      variant,
      summary?.trades ?? 0,
      summary?.activeWeeks ?? 0,
      signed(summary?.totalRawPct),
      signed(summary?.totalAdrPct),
      fmtNumber(summary?.weeklyAdrProfitFactor),
      fmtNumber(summary?.tradeAdrProfitFactor),
      fmtNumber(summary?.weeklyAdrSharpeStyleScore, 3),
      signed(summary?.weeklyEquityMaxDrawdownAdrPct),
      `${summary?.weeklyWins ?? 0}/${summary?.weeklyLosses ?? 0}/${summary?.weeklyFlats ?? 0}`,
      `${summary?.tradeWins ?? 0}/${summary?.tradeLosses ?? 0}`,
    ];
  }));
}

function primaryRatioWeeklyResult(results: any[]) {
  return results.find((result) => result.label === FULL_CLEAN_WINDOW_LABEL)
    ?? results.find((result) => result.label === HISTORY_2024_WINDOW_LABEL)
    ?? results.find((result) => result.label === THREE_WINDOW_LABEL);
}

function buildRatioFocusMd(results: any[], generatedAtUtc: string) {
  const combined = primaryRatioWeeklyResult(results);
  const md: string[] = [];
  md.push("# Gate 34 Dealer Ratio Rule Weekly Audit");
  md.push("");
  md.push(`Generated: ${generatedAtUtc}`);
  md.push("");
  md.push("## Scope");
  md.push("");
  md.push("- Dealer source only.");
  md.push("- FX 28-pair Weekly Hold week-close rows only.");
  md.push("- Runtime strategy logic was not changed.");
  md.push("- Clean historical windows exclude early-2019 shutdown catch-up source reports and the 2023 ION-delayed source reports.");
  md.push("- Clean 2025 excludes CFTC shutdown source report dates already excluded in Gate 34.");
  md.push("- Ratio variants are forced comparison tests: they pick the higher Dealer directional ratio when available.");
  md.push("");
  md.push("## Variants");
  md.push("");
  md.push(table(
    ["Variant", "Meaning"],
    RATIO_FOCUS_VARIANTS.map((variant) => [variant, VARIANT_LABELS[variant]]),
  ));
  md.push("");
  md.push("## Window Summary");
  md.push("");
  md.push(table(
    [
      "Window",
      "Variant",
      "Trades",
      "Active weeks",
      "Raw",
      "ADR",
      "Weekly PF",
      "Trade PF",
      "Sharpe-style",
      "Weekly DD",
      "Weekly W/L/F",
      "Trade W/L",
    ],
    ratioFocusSummaryRows(results),
  ));

  if (combined) {
    md.push("");
    md.push(`## ${combined.label} Weekly Breakdown`);
    md.push("");
    md.push(`Window: ${combined.displayedWeekFrom} through ${combined.displayedWeekTo} (${combined.selectedWeekCount} clean weeks).`);
    md.push("");
    md.push(table(
      [
        "Week",
        "Current ADR",
        "Direct ratio ADR",
        "Ratio-all ADR",
        "Direct ratio W/L/F",
        "Ratio-all W/L/F",
        "Direct ratio trades",
        "Ratio-all trades",
      ],
      ratioWeeklyRowsForResult(combined).map((row: any) => [
        row.week,
        signed(row.current.adr),
        signed(row.directRatio.adr),
        signed(row.ratioAll.adr),
        `${row.directRatio.wins ?? 0}/${row.directRatio.losses ?? 0}/${row.directRatio.flats ?? 0}`,
        `${row.ratioAll.wins ?? 0}/${row.ratioAll.losses ?? 0}/${row.ratioAll.flats ?? 0}`,
        row.directRatio.trades ?? 0,
        row.ratioAll.trades ?? 0,
      ]),
    ));

    md.push("");
    md.push("## Worst Ratio-All Weeks");
    md.push("");
    const worstRatioAll = [...ratioWeeklyRowsForResult(combined)]
      .sort((left: any, right: any) => (left.ratioAll.adr ?? 0) - (right.ratioAll.adr ?? 0))
      .slice(0, 15);
    md.push(table(
      ["Week", "Ratio-all ADR", "W/L/F", "Trades", "Long/Short"],
      worstRatioAll.map((row: any) => [
        row.week,
        signed(row.ratioAll.adr),
        `${row.ratioAll.wins ?? 0}/${row.ratioAll.losses ?? 0}/${row.ratioAll.flats ?? 0}`,
        row.ratioAll.trades ?? 0,
        `${row.ratioAll.longRows ?? 0}/${row.ratioAll.shortRows ?? 0}`,
      ]),
    ));
  }

  return md.join("\n");
}

async function main() {
  const baselineDir = path.resolve(process.cwd(), "app/reports/data-verification/weekly-hold-basket-baseline");
  const reportDir = path.resolve(process.cwd(), "app/reports/data-verification/weekly-hold-audit");
  const docsOut = path.resolve(
    process.cwd(),
    argValue("docs-out") ?? "docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md",
  );
  const jsonOut = path.resolve(
    process.cwd(),
    argValue("json-out") ?? "app/reports/data-verification/weekly-hold-audit/dealer-rule-candidate-audit-20260614.json",
  );
  const ratioDocsOut = path.resolve(
    process.cwd(),
    argValue("ratio-docs-out") ?? "docs/research/GATE34_DEALER_RATIO_RULE_WEEKLY_AUDIT_2026-06-14.md",
  );
  const ratioJsonOut = path.resolve(
    process.cwd(),
    argValue("ratio-json-out") ?? "app/reports/data-verification/weekly-hold-audit/dealer-ratio-rule-weekly-audit-20260614.json",
  );
  const ratioCsvOut = path.resolve(
    process.cwd(),
    argValue("ratio-csv-out") ?? "app/reports/data-verification/weekly-hold-audit/dealer-ratio-rule-weekly-audit-20260614.csv",
  );

  await mkdir(path.dirname(docsOut), { recursive: true });
  await mkdir(path.dirname(jsonOut), { recursive: true });
  await mkdir(path.dirname(ratioDocsOut), { recursive: true });
  await mkdir(path.dirname(ratioJsonOut), { recursive: true });
  await mkdir(path.dirname(ratioCsvOut), { recursive: true });
  await mkdir(reportDir, { recursive: true });

  const results = [];
  const receiptsByLabel = new Map<string, BaselineReceipt>();
  for (const window of YEAR_WINDOWS) {
    const { baselinePath, receipt } = await latestMatchingBaselineFile(baselineDir, window);
    receiptsByLabel.set(window.label, receipt);
    const scored = await scoreReceipt(receipt);
    results.push({
      label: window.label,
      weeks: window.weeks,
      baselinePath: path.relative(process.cwd(), baselinePath),
      generatedAtUtc: receipt.generatedAtUtc,
      displayedWeekFrom: receipt.scope.displayedWeekFrom,
      displayedWeekTo: receipt.scope.displayedWeekTo,
      selectedWeekCount: receipt.scope.selectedWeekCount,
      ...scored,
    });
  }

  const pushCombinedResult = async (labels: string[], label: string, baselinePath: string) => {
    const receipts = labels
      .map((entry) => receiptsByLabel.get(entry))
      .filter((receipt): receipt is BaselineReceipt => Boolean(receipt));
    if (receipts.length !== labels.length) return;

    const combinedReceipt: BaselineReceipt = {
      generatedAtUtc: receipts.map((receipt) => receipt.generatedAtUtc).join(" + "),
      scope: {
        displayedWeekFrom: receipts[0].scope.displayedWeekFrom,
        displayedWeekTo: receipts[receipts.length - 1].scope.displayedWeekTo,
        selectedWeekCount: receipts.reduce((sum, receipt) => sum + receipt.scope.selectedWeekCount, 0),
      },
      weeks: receipts.flatMap((receipt) => receipt.weeks),
    };
    const scored = await scoreReceipt(combinedReceipt);
    results.push({
      label,
      weeks: `${combinedReceipt.scope.selectedWeekCount}w`,
      baselinePath,
      generatedAtUtc: combinedReceipt.generatedAtUtc,
      displayedWeekFrom: combinedReceipt.scope.displayedWeekFrom,
      displayedWeekTo: combinedReceipt.scope.displayedWeekTo,
      selectedWeekCount: combinedReceipt.scope.selectedWeekCount,
      ...scored,
    });
  };

  await pushCombinedResult(
    HISTORY_LABELS,
    HISTORY_WINDOW_LABEL,
    "combined from source-clean 2019, 2020, 2021, 2022, and 2023 baseline receipts",
  );
  await pushCombinedResult(
    HISTORY_2024_LABELS,
    HISTORY_2024_WINDOW_LABEL,
    "combined from source-clean 2019-2023 and corrected 2024 baseline receipts",
  );
  await pushCombinedResult(
    ["2024", "clean 2025", "current 2026"],
    THREE_WINDOW_LABEL,
    "combined from corrected 2024, clean 2025, and current 2026 baseline receipts",
  );
  await pushCombinedResult(
    FULL_CLEAN_LABELS,
    FULL_CLEAN_WINDOW_LABEL,
    "combined from source-clean 2019-2024, clean 2025, and current 2026 baseline receipts",
  );

  const generatedAtUtc = new Date().toISOString();
  const md: string[] = [];
  md.push("# Gate 34 Dealer Rule Candidate Audit");
  md.push("");
  md.push(`Generated: ${generatedAtUtc}`);
  md.push("");
  md.push("## Scope");
  md.push("");
  md.push("- Dealer source only.");
  md.push("- Week-close baseline rows only; this does not retest fixed TP/SL exits.");
  md.push("- Uses corrected baseline receipts with canonical daily ADR coverage.");
  md.push("- Alternate candidates rescore direction only; price path is not rebuilt here.");
  md.push("- Drawdown shown here is weekly cumulative ADR equity drawdown, not intrabar adverse excursion.");
  md.push("");
  md.push("## Candidate Rules");
  md.push("");
  md.push(table(
    ["Variant", "Meaning"],
    Object.entries(VARIANT_LABELS).map(([variant, label]) => [variant, label]),
  ));

  for (const result of results) {
    md.push("");
    md.push(`## ${result.label}`);
    md.push("");
    md.push(`Receipt: \`${result.baselinePath}\``);
    md.push("");
    md.push(`Window: ${result.displayedWeekFrom} through ${result.displayedWeekTo} (${result.selectedWeekCount} weeks).`);
    md.push("");
    md.push("### Direct-Rule Agreement Checks");
    md.push("");
    md.push(table(
      [
        "Direct rows",
        "Ratio agrees",
        "Ratio disagrees",
        "Ratio missing",
        "Delta agrees",
        "Delta disagrees",
        "Delta missing",
        "Signed spread agrees",
        "Signed spread disagrees",
        "Signed spread missing",
        "Net-spread agrees",
        "Net-spread disagrees",
        "Net-spread missing",
        "Spread clean >=0.25",
        "Spread clean >=0.50",
        "Min leg ratio >=0.50",
        "Min leg ratio >=0.66",
        "Min leg ratio >=0.75",
      ],
      [[
        result.disagreementCounts.directRows,
        result.disagreementCounts.directRatioAgrees,
        result.disagreementCounts.directRatioDisagrees,
        result.disagreementCounts.directRatioMissing,
        result.disagreementCounts.directDeltaAgrees,
        result.disagreementCounts.directDeltaDisagrees,
        result.disagreementCounts.directDeltaMissing,
        result.disagreementCounts.directSignedSpreadAgrees,
        result.disagreementCounts.directSignedSpreadDisagrees,
        result.disagreementCounts.directSignedSpreadMissing,
        result.disagreementCounts.directSubtractiveSpreadAgrees,
        result.disagreementCounts.directSubtractiveSpreadDisagrees,
        result.disagreementCounts.directSubtractiveSpreadMissing,
        result.disagreementCounts.directSpreadClean0p25,
        result.disagreementCounts.directSpreadClean0p50,
        result.disagreementCounts.directMinLegRatio0p50,
        result.disagreementCounts.directMinLegRatio0p66,
        result.disagreementCounts.directMinLegRatio0p75,
      ]],
    ));
    md.push("");
    md.push("### Variant Summary");
    md.push("");
    md.push(table(
      [
        "Variant",
        "Trades",
        "Active weeks",
        "Raw",
        "ADR",
        "Weekly PF",
        "Trade PF",
        "Expectancy/trade",
        "Weekly Sharpe-style",
        "Weekly DD",
        "DD/return",
        "Weekly W/L/F",
        "Trade W/L",
      ],
      result.variants.map((variant) => [
        variant.variant,
        variant.trades,
        variant.activeWeeks,
        signed(variant.totalRawPct),
        signed(variant.totalAdrPct),
        fmtNumber(variant.weeklyAdrProfitFactor),
        fmtNumber(variant.tradeAdrProfitFactor),
        signed(variant.tradeAdrExpectancyPct, 3),
        fmtNumber(variant.weeklyAdrSharpeStyleScore, 3),
        signed(variant.weeklyEquityMaxDrawdownAdrPct),
        fmtNumber(variant.adverseDdPerAdrReturn, 3),
        `${variant.weeklyWins}/${variant.weeklyLosses}/${variant.weeklyFlats}`,
        `${variant.tradeWins}/${variant.tradeLosses}`,
      ]),
    ));
    md.push("");
    md.push("### Current Rule Contribution");
    md.push("");
    const current = result.variants.find((variant) => variant.variant === "current");
    md.push(table(
      ["Rule tier", "Trades", "W/L", "Raw", "ADR"],
      (current?.byRule ?? []).map((rule) => [
        rule.ruleTier,
        rule.trades,
        `${rule.wins}/${rule.losses}`,
        signed(rule.raw),
        signed(rule.adr),
      ]),
    ));
  }

  const payload = { generatedAtUtc, results };
  await writeFile(jsonOut, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(docsOut, `${md.join("\n")}\n`, "utf8");

  const ratioPayload = {
    generatedAtUtc,
    variants: RATIO_FOCUS_VARIANTS,
    results: results.map((result: any) => ({
      label: result.label,
      weeks: result.weeks,
      displayedWeekFrom: result.displayedWeekFrom,
      displayedWeekTo: result.displayedWeekTo,
      selectedWeekCount: result.selectedWeekCount,
      summaries: RATIO_FOCUS_VARIANTS.map((variant) => result.variants.find((entry: any) => entry.variant === variant)),
      weeklyBreakdowns: result.weeklyBreakdowns,
    })),
  };
  const combinedRatioRows = ratioWeeklyRowsForResult(primaryRatioWeeklyResult(results) ?? { weeklyBreakdowns: {} });
  await writeFile(ratioJsonOut, `${JSON.stringify(ratioPayload, null, 2)}\n`, "utf8");
  await writeFile(ratioDocsOut, `${buildRatioFocusMd(results, generatedAtUtc)}\n`, "utf8");
  await writeFile(ratioCsvOut, `${csv(
    [
      "week",
      "current_trades",
      "current_adr",
      "direct_ratio_trades",
      "direct_ratio_adr",
      "direct_ratio_wins",
      "direct_ratio_losses",
      "ratio_all_trades",
      "ratio_all_adr",
      "ratio_all_wins",
      "ratio_all_losses",
      "ratio_all_long_rows",
      "ratio_all_short_rows",
    ],
    combinedRatioRows.map((row: any) => [
      row.week,
      row.current.trades,
      row.current.adr,
      row.directRatio.trades,
      row.directRatio.adr,
      row.directRatio.wins,
      row.directRatio.losses,
      row.ratioAll.trades,
      row.ratioAll.adr,
      row.ratioAll.wins,
      row.ratioAll.losses,
      row.ratioAll.longRows,
      row.ratioAll.shortRows,
    ]),
  )}\n`, "utf8");

  console.log(`Wrote ${path.relative(process.cwd(), docsOut)}`);
  console.log(`Wrote ${path.relative(process.cwd(), jsonOut)}`);
  console.log(`Wrote ${path.relative(process.cwd(), ratioDocsOut)}`);
  console.log(`Wrote ${path.relative(process.cwd(), ratioJsonOut)}`);
  console.log(`Wrote ${path.relative(process.cwd(), ratioCsvOut)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
