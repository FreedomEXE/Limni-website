/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-sentiment-strength.ts
 *
 * Description:
 * Researches neutral-bucket handling variants for sentiment and strength
 * across all 4 asset classes using ADR-normalized weekly returns.
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

const OUTPUT_PATH = "docs/SENTIMENT_STRENGTH_RESEARCH_2026-04-04.md";
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "crypto", "commodities"];

type Direction = "LONG" | "SHORT";
type SentimentMethod =
  | "s1_baseline"
  | "s2_60_40"
  | "s3_neutral_tiebreak"
  | "s4_persistence"
  | "s5_flip_only"
  | "s6_crowding_only";
type StrengthMethod =
  | "t1_baseline"
  | "t2_threshold4"
  | "t3_threshold3"
  | "t4_weighted"
  | "t5_neutral_resolver"
  | "t6_persistence"
  | "t7_weighted_raw";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  sentiment: Record<SentimentMethod, Direction | null>;
  strength: Record<StrengthMethod, Direction | null>;
  sentimentAgg?: SentimentAggregate;
  strengthRow?: WeeklyPairStrength;
};

type Stats = {
  trades: number;
  totalPct: number;
  maxDdPct: number;
  winRatePct: number;
  losingWeeks: number;
  coverage: string;
};

type AvailabilityStats = {
  present: number;
  possible: number;
};

const SENTIMENT_LABELS: Record<SentimentMethod, string> = {
  s1_baseline: "S1 Baseline",
  s2_60_40: "S2 60/40",
  s3_neutral_tiebreak: "S3 Neutral Tiebreak",
  s4_persistence: "S4 2+ Week Persistence",
  s5_flip_only: "S5 Flip-only",
  s6_crowding_only: "S6 Crowding-only",
};

const STRENGTH_LABELS: Record<StrengthMethod, string> = {
  t1_baseline: "T1 Baseline",
  t2_threshold4: "T2 Threshold=4",
  t3_threshold3: "T3 Threshold=3",
  t4_weighted: "T4 Weighted Windows",
  t5_neutral_resolver: "T5 Neutral Resolver",
  t6_persistence: "T6 2+ Week Persistence",
  t7_weighted_raw: "T7 Weighted Raw Spread",
};

const DIR_SCORE: Record<Direction | "NEUTRAL", number> = {
  LONG: 1,
  SHORT: -1,
  NEUTRAL: 0,
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

function directionalReturn(row: Row, direction: Direction): number {
  return (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
}

function classifySpreadCustom(spread: number | null, threshold: number): Direction | "NEUTRAL" {
  if (spread === null || !Number.isFinite(spread)) return "NEUTRAL";
  if (spread > threshold) return "LONG";
  if (spread < -threshold) return "SHORT";
  return "NEUTRAL";
}

function compositeToDirection(score: number): Direction | null {
  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
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

function sentimentS2(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return null;
  if (agg.agg_long_pct >= 60) return "SHORT";
  if (agg.agg_long_pct <= 40) return "LONG";
  return null;
}

function sentimentS3(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const s1 = sentimentS1(agg);
  if (s1 !== null) return s1;
  if (agg.agg_long_pct > 50) return "SHORT";
  if (agg.agg_long_pct < 50) return "LONG";
  return null;
}

function sentimentS4(
  agg: SentimentAggregate | undefined,
  priorAgg: SentimentAggregate | undefined,
): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return null;
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();
  const priorCrowding = priorAgg ? String(priorAgg.crowding_state ?? "").trim().toUpperCase() : "";
  if (
    (crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG") &&
    (priorCrowding === "CROWDED_LONG" || priorCrowding === "EXTREME_LONG")
  ) {
    return "SHORT";
  }
  if (
    (crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT") &&
    (priorCrowding === "CROWDED_SHORT" || priorCrowding === "EXTREME_SHORT")
  ) {
    return "LONG";
  }
  return null;
}

function sentimentS5(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  return null;
}

function sentimentS6(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();
  if (crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG") return "SHORT";
  if (crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT") return "LONG";
  return null;
}

function strengthT1(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  return ps.compositeDirection === "NEUTRAL" ? null : ps.compositeDirection;
}

function strengthT2(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available) continue;
    score += DIR_SCORE[classifySpreadCustom(w.signedSpread, 4)];
  }
  return compositeToDirection(score);
}

function strengthT3(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available) continue;
    score += DIR_SCORE[classifySpreadCustom(w.signedSpread, 3)];
  }
  return compositeToDirection(score);
}

function strengthT4(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available) continue;
    const weight = w.window === "24h" ? 2 : 1;
    score += weight * DIR_SCORE[classifySpreadCustom(w.signedSpread, 5)];
  }
  return compositeToDirection(score);
}

function strengthT5(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  const t1 = strengthT1(ps);
  if (t1 !== null) return t1;
  let rawSum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)) {
      rawSum += w.signedSpread;
      hasData = true;
    }
  }
  if (!hasData) return null;
  return compositeToDirection(rawSum);
}

function strengthT6(
  ps: WeeklyPairStrength | undefined,
  priorPs: WeeklyPairStrength | undefined,
): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  const current = strengthT1(ps);
  if (current === null) return null;
  const prior = strengthT1(priorPs);
  return prior === current ? current : null;
}

function strengthT7(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  let weightedSum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (!w.available || w.signedSpread === null || !Number.isFinite(w.signedSpread)) continue;
    const weight = w.window === "24h" ? 2 : 1;
    weightedSum += weight * w.signedSpread;
    hasData = true;
  }
  if (!hasData) return null;
  return compositeToDirection(weightedSum);
}

function computeStats<TMethod extends string>(
  rows: Row[],
  source: "sentiment" | "strength",
  method: TMethod,
  assetClass: AssetClass | "combined",
  possibleTrades: number,
): Stats {
  const filtered = assetClass === "combined" ? rows : rows.filter((row) => row.assetClass === assetClass);
  const byWeek = new Map<string, { ret: number; trades: number; wins: number }>();

  for (const row of filtered) {
    const direction = row[source][method as keyof typeof row[typeof source]] as Direction | null;
    if (!direction) continue;
    const ret = directionalReturn(row, direction);
    const week = byWeek.get(row.weekOpenUtc) ?? { ret: 0, trades: 0, wins: 0 };
    week.ret += ret;
    week.trades += 1;
    if (ret > 0) week.wins += 1;
    byWeek.set(row.weekOpenUtc, week);
  }

  const sortedWeekly = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weeklyReturns = sortedWeekly.map(([, value]) => value.ret);
  const trades = sortedWeekly.reduce((sum, [, value]) => sum + value.trades, 0);
  const wins = sortedWeekly.reduce((sum, [, value]) => sum + value.wins, 0);
  const losingWeeks = weeklyReturns.filter((ret) => ret < 0).length;
  const total = round(weeklyReturns.reduce((sum, ret) => sum + ret, 0));

  return {
    trades,
    totalPct: total,
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: trades > 0 ? round((wins / trades) * 100, 1) : 0,
    losingWeeks,
    coverage: `${trades}/${possibleTrades}`,
  };
}

function renderStatsTable<TMethod extends string>(
  title: string,
  rows: Row[],
  source: "sentiment" | "strength",
  labels: Record<TMethod, string>,
  possibleByClass: Record<AssetClass, number>,
) {
  const lines = [`## ${title}`, ""];
  for (const method of Object.keys(labels) as TMethod[]) {
    lines.push(`### ${labels[method]}`);
    lines.push("");
    lines.push("| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const assetClass of ASSET_CLASSES) {
      const stats = computeStats(rows, source, method, assetClass, possibleByClass[assetClass]);
      lines.push(
        `| ${assetClass} | ${stats.trades} | ${signedPct(stats.totalPct)} | ${stats.maxDdPct.toFixed(2)}% | ${stats.winRatePct.toFixed(1)}% | ${stats.losingWeeks} | ${stats.coverage} |`,
      );
    }
    const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
    const combined = computeStats(rows, source, method, "combined", combinedPossible);
    lines.push(
      `| combined | ${combined.trades} | ${signedPct(combined.totalPct)} | ${combined.maxDdPct.toFixed(2)}% | ${combined.winRatePct.toFixed(1)}% | ${combined.losingWeeks} | ${combined.coverage} |`,
    );
    lines.push("");
  }
  return lines.join("\n");
}

function renderSummary<TMethod extends string>(
  title: string,
  rows: Row[],
  source: "sentiment" | "strength",
  labels: Record<TMethod, string>,
  combinedPossible: number,
) {
  const summary = (Object.keys(labels) as TMethod[]).map((method) => ({
    method,
    stats: computeStats(rows, source, method, "combined", combinedPossible),
  }));
  const sorted = [...summary].sort(
    (a, b) =>
      a.stats.losingWeeks - b.stats.losingWeeks ||
      a.stats.maxDdPct - b.stats.maxDdPct ||
      b.stats.totalPct - a.stats.totalPct ||
      b.stats.winRatePct - a.stats.winRatePct,
  );

  const lines = [`## ${title}`, "", "| Method | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"];
  for (const row of sorted) {
    lines.push(
      `| ${labels[row.method]} | ${row.stats.trades} | ${signedPct(row.stats.totalPct)} | ${row.stats.maxDdPct.toFixed(2)}% | ${row.stats.winRatePct.toFixed(1)}% | ${row.stats.losingWeeks} | ${row.stats.coverage} |`,
    );
  }
  lines.push("");
  return { markdown: lines.join("\n"), sorted };
}

function renderAvailability(
  title: string,
  availability: Record<AssetClass, AvailabilityStats>,
) {
  const totalPresent = Object.values(availability).reduce((sum, row) => sum + row.present, 0);
  const totalPossible = Object.values(availability).reduce((sum, row) => sum + row.possible, 0);
  const lines = [`## ${title}`, "", "| Asset Class | Present | Possible | Coverage |", "| --- | ---: | ---: | ---: |"];
  for (const assetClass of ASSET_CLASSES) {
    const row = availability[assetClass];
    lines.push(`| ${assetClass} | ${row.present} | ${row.possible} | ${((row.present / row.possible) * 100).toFixed(1)}% |`);
  }
  lines.push(`| combined | ${totalPresent} | ${totalPossible} | ${((totalPresent / totalPossible) * 100).toFixed(1)}% |`);
  lines.push("");
  return lines.join("\n");
}

function renderSentimentExtremityDiagnostic(rows: Row[]) {
  const sentimentRows = rows.filter((row) => row.sentimentAgg);
  const buckets = [
    { label: "Very weak (0-5)", min: 0, max: 5 },
    { label: "Weak (5-10)", min: 5, max: 10 },
    { label: "Moderate (10-15)", min: 10, max: 15 },
    { label: "Strong (15+)", min: 15, max: Number.POSITIVE_INFINITY },
  ];
  const lines = ["## Sentiment Extremity Diagnostic", "", "| Bucket | Trades | Total% | Win% | Avg |", "| --- | ---: | ---: | ---: | ---: |"];
  for (const bucket of buckets) {
    const filtered = sentimentRows.filter((row) => {
      const agg = row.sentimentAgg!;
      const extremity = Math.abs(agg.agg_long_pct - 50);
      return extremity >= bucket.min && extremity < bucket.max;
    });
    const byWeek = new Map<string, { ret: number; trades: number; wins: number }>();
    let totalTrades = 0;
    let totalWins = 0;
    let total = 0;
    for (const row of filtered) {
      const direction = row.sentiment.s1_baseline;
      if (!direction) continue;
      const ret = directionalReturn(row, direction);
      totalTrades++;
      total += ret;
      if (ret > 0) totalWins++;
      const week = byWeek.get(row.weekOpenUtc) ?? { ret: 0, trades: 0, wins: 0 };
      week.ret += ret;
      week.trades++;
      if (ret > 0) week.wins++;
      byWeek.set(row.weekOpenUtc, week);
    }
    const avg = totalTrades > 0 ? total / totalTrades : 0;
    lines.push(
      `| ${bucket.label} | ${totalTrades} | ${signedPct(round(total))} | ${totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : "0.0"}% | ${signedPct(round(avg, 3), 3)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   Sentiment + Strength Research                                ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weekOpenUtcs = (await listDataSectionWeeks())
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const possibleByClass = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, weekOpenUtcs.length * PAIRS_BY_ASSET_CLASS[assetClass].length]),
  ) as Record<AssetClass, number>;

  const sentimentAvailability = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, { present: 0, possible: possibleByClass[assetClass] }]),
  ) as Record<AssetClass, AvailabilityStats>;
  const strengthAvailability = Object.fromEntries(
    ASSET_CLASSES.map((assetClass) => [assetClass, { present: 0, possible: possibleByClass[assetClass] }]),
  ) as Record<AssetClass, AvailabilityStats>;

  const rows: Row[] = [];

  for (const rawWeekOpenUtc of weekOpenUtcs) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const priorWeekOpenUtc =
      DateTime.fromISO(weekOpenUtc, { zone: "utc" }).minus({ weeks: 1 }).toUTC().toISO() ?? weekOpenUtc;

    const [weeklyReturns, adrMap, sentimentCurrent, sentimentPrior, strengthCurrent, strengthPrior] = await Promise.all([
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
      getAggregatesAsOf(weekOpenUtc),
      getAggregatesAsOf(priorWeekOpenUtc),
      readWeeklyPairStrengths(weekOpenUtc),
      readWeeklyPairStrengths(priorWeekOpenUtc),
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
    const sentimentMap = new Map(sentimentCurrent.map((agg) => [agg.symbol.toUpperCase(), agg]));
    const sentimentPriorMap = new Map(sentimentPrior.map((agg) => [agg.symbol.toUpperCase(), agg]));
    const strengthMap = new Map(strengthCurrent.map((row) => [row.pair.toUpperCase(), row]));
    const strengthPriorMap = new Map(strengthPrior.map((row) => [row.pair.toUpperCase(), row]));

    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const ret = returnMap.get(pair);
        if (!ret) continue;

        const agg = sentimentMap.get(pair);
        const priorAgg = sentimentPriorMap.get(pair);
        const strength = strengthMap.get(pair);
        const priorStrength = strengthPriorMap.get(pair);

        if (agg) sentimentAvailability[assetClass].present++;
        if (strength && strength.availableWindows > 0) strengthAvailability[assetClass].present++;

        rows.push({
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: ret.rawReturnPct,
          adrMultiplier: ret.adrMultiplier,
          sentiment: {
            s1_baseline: sentimentS1(agg),
            s2_60_40: sentimentS2(agg),
            s3_neutral_tiebreak: sentimentS3(agg),
            s4_persistence: sentimentS4(agg, priorAgg),
            s5_flip_only: sentimentS5(agg),
            s6_crowding_only: sentimentS6(agg),
          },
          strength: {
            t1_baseline: strengthT1(strength),
            t2_threshold4: strengthT2(strength),
            t3_threshold3: strengthT3(strength),
            t4_weighted: strengthT4(strength),
            t5_neutral_resolver: strengthT5(strength),
            t6_persistence: strengthT6(strength, priorStrength),
            t7_weighted_raw: strengthT7(strength),
          },
          sentimentAgg: agg,
          strengthRow: strength,
        });
      }
    }
  }

  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
  const sentimentSummary = renderSummary("Sentiment Summary", rows, "sentiment", SENTIMENT_LABELS, combinedPossible);
  const strengthSummary = renderSummary("Strength Summary", rows, "strength", STRENGTH_LABELS, combinedPossible);

  const lines: string[] = [];
  lines.push("# Sentiment + Strength Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${weekOpenUtcs.length} (${weekLabel(weekOpenUtcs[0]!)} -> ${weekLabel(weekOpenUtcs.at(-1)!)}).`);
  lines.push("");
  lines.push(renderAvailability("Sentiment Data Availability", sentimentAvailability));
  lines.push(renderAvailability("Strength Data Availability", strengthAvailability));
  lines.push(renderStatsTable("Sentiment Methods", rows, "sentiment", SENTIMENT_LABELS, possibleByClass));
  lines.push(renderSentimentExtremityDiagnostic(rows));
  lines.push(sentimentSummary.markdown);
  lines.push(renderStatsTable("Strength Methods", rows, "strength", STRENGTH_LABELS, possibleByClass));
  lines.push(strengthSummary.markdown);

  lines.push("## Recommendations");
  lines.push("");
  lines.push(`1. Sentiment winner by risk-first ranking: \`${SENTIMENT_LABELS[sentimentSummary.sorted[0]!.method]}\`.`);
  lines.push(`2. Strength winner by risk-first ranking: \`${STRENGTH_LABELS[strengthSummary.sorted[0]!.method]}\`.`);
  lines.push("3. Treat these as research results only. No canonical change should happen until the standalone winners are clearly preferable and repeatable.");
  lines.push("");

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log("Sentiment ranking:");
  for (const row of sentimentSummary.sorted) {
    console.log(
      `  ${SENTIMENT_LABELS[row.method]} :: ${row.stats.trades} / ${row.stats.totalPct.toFixed(2)}% / ${row.stats.maxDdPct.toFixed(2)} DD / ${row.stats.winRatePct.toFixed(1)}% / LW ${row.stats.losingWeeks}`,
    );
  }
  console.log("Strength ranking:");
  for (const row of strengthSummary.sorted) {
    console.log(
      `  ${STRENGTH_LABELS[row.method]} :: ${row.stats.trades} / ${row.stats.totalPct.toFixed(2)}% / ${row.stats.maxDdPct.toFixed(2)} DD / ${row.stats.winRatePct.toFixed(1)}% / LW ${row.stats.losingWeeks}`,
    );
  }
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
