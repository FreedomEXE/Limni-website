/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-4source-agreement-optimization.ts
 *
 * Description:
 * Focused optimization pass for the canonical 4-source agreement winner.
 * Tests selective 2v2 tie inclusion and simple universe restriction on top
 * of the agree_3of4 baseline, without redesigning the composite family.
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
type TiePattern = "D+C vs Se+St" | "D+Se vs C+St" | "D+St vs C+Se";
type VariantId =
  | "agree_3of4"
  | "agree_3of4_plus_sest"
  | "agree_3of4_plus_fx_ties"
  | "agree_3of4_fx_crypto"
  | "agree_3of4_plus_pattern_dcsest"
  | "agree_3of4_plus_pattern_dsecst"
  | "agree_3of4_plus_pattern_dstcse";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
  strength: Direction;
  longs: number;
  shorts: number;
  tiePattern: TiePattern | null;
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
  coveragePct: number;
  addedTieTrades: number;
  addedTieReturnPct: number;
};

type PatternSideStats = {
  count: number;
  sentimentSidePct: number;
  sentimentSideWinPct: number;
  oppositeSidePct: number;
  oppositeSideWinPct: number;
};

const OUTPUT_PATH = "docs/4SOURCE_AGREEMENT_OPTIMIZATION_2026-04-05.md";
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
const VARIANT_LABELS: Record<VariantId, string> = {
  agree_3of4: "agree_3of4",
  agree_3of4_plus_sest: "agree_3of4 + Se+St ties",
  agree_3of4_plus_fx_ties: "agree_3of4 + FX-only sentiment ties",
  agree_3of4_fx_crypto: "agree_3of4 FX+crypto only",
  agree_3of4_plus_pattern_dcsest: "agree_3of4 + only D+C vs Se+St ties",
  agree_3of4_plus_pattern_dsecst: "agree_3of4 + only D+Se vs C+St ties",
  agree_3of4_plus_pattern_dstcse: "agree_3of4 + only D+St vs C+Se ties",
};
const PATTERNS: TiePattern[] = ["D+C vs Se+St", "D+Se vs C+St", "D+St vs C+Se"];

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

function classifyTiePattern(row: Pick<Row, "dealer" | "commercial" | "sentiment" | "strength" | "longs" | "shorts">): TiePattern | null {
  if (!(row.longs === 2 && row.shorts === 2)) return null;
  const sides = [
    ["D", row.dealer],
    ["C", row.commercial],
    ["Se", row.sentiment],
    ["St", row.strength],
  ] as const;
  const longs = sides.filter(([, dir]) => dir === "LONG").map(([id]) => id).sort().join("+");
  const shorts = sides.filter(([, dir]) => dir === "SHORT").map(([id]) => id).sort().join("+");
  const key = [longs, shorts].sort().join(" vs ");
  if (key === "C+D vs Se+St") return "D+C vs Se+St";
  if (key === "C+St vs D+Se") return "D+Se vs C+St";
  if (key === "C+Se vs D+St") return "D+St vs C+Se";
  return null;
}

function agree3of4Direction(row: Row): Direction | null {
  if (row.longs >= 3) return "LONG";
  if (row.shorts >= 3) return "SHORT";
  return null;
}

function sentimentSideForPattern(row: Row, pattern: TiePattern): Direction {
  switch (pattern) {
    case "D+C vs Se+St":
      return row.sentiment;
    case "D+Se vs C+St":
      return row.sentiment;
    case "D+St vs C+Se":
      return row.sentiment;
  }
}

function variantDirection(row: Row, variantId: VariantId): Direction | null {
  const base = agree3of4Direction(row);
  if (variantId === "agree_3of4") {
    return base;
  }
  if (variantId === "agree_3of4_fx_crypto") {
    if (row.assetClass !== "fx" && row.assetClass !== "crypto") return null;
    return base;
  }
  if (base) return base;
  const pattern = row.tiePattern;
  if (!pattern) return null;

  switch (variantId) {
    case "agree_3of4_plus_sest":
      return pattern === "D+C vs Se+St" ? sentimentSideForPattern(row, pattern) : null;
    case "agree_3of4_plus_fx_ties":
      return row.assetClass === "fx" ? row.sentiment : null;
    case "agree_3of4_plus_pattern_dcsest":
      return pattern === "D+C vs Se+St" ? sentimentSideForPattern(row, pattern) : null;
    case "agree_3of4_plus_pattern_dsecst":
      return pattern === "D+Se vs C+St" ? sentimentSideForPattern(row, pattern) : null;
    case "agree_3of4_plus_pattern_dstcse":
      return pattern === "D+St vs C+Se" ? sentimentSideForPattern(row, pattern) : null;
    default:
      return null;
  }
}

function computeVariantStats(rows: Row[], weeks: string[], variantId: VariantId): VariantStats {
  const universeRows = variantId === "agree_3of4_fx_crypto"
    ? rows.filter((row) => row.assetClass === "fx" || row.assetClass === "crypto")
    : rows;

  const trades: Array<{ weekOpenUtc: string; returnPct: number; wasTieAdd: boolean }> = [];
  for (const row of universeRows) {
    const direction = variantDirection(row, variantId);
    if (!direction) continue;
    const baseDirection = agree3of4Direction(row);
    const normalizedReturn = directionalReturn(row.rawReturnPct, direction) * row.adrMultiplier;
    trades.push({
      weekOpenUtc: row.weekOpenUtc,
      returnPct: normalizedReturn,
      wasTieAdd: baseDirection === null,
    });
  }

  const weekly = new Map<string, number>();
  let wins = 0;
  let total = 0;
  let addedTieTrades = 0;
  let addedTieReturnPct = 0;
  for (const trade of trades) {
    weekly.set(trade.weekOpenUtc, (weekly.get(trade.weekOpenUtc) ?? 0) + trade.returnPct);
    total += trade.returnPct;
    if (trade.returnPct > 0) wins += 1;
    if (trade.wasTieAdd) {
      addedTieTrades += 1;
      addedTieReturnPct += trade.returnPct;
    }
  }
  const orderedWeekly = weeks
    .map((week) => weekly.get(week) ?? 0)
    .filter((value) => Number.isFinite(value));

  const possibleTrades = universeRows.length;
  return {
    id: variantId,
    label: VARIANT_LABELS[variantId],
    trades: trades.length,
    totalReturnPct: round(total),
    maxDrawdownPct: computeMaxDd(orderedWeekly),
    winRatePct: round(trades.length > 0 ? (wins / trades.length) * 100 : 0, 1),
    losingWeeks: orderedWeekly.filter((value) => value < 0).length,
    tradesPerWeek: round(trades.length / weeks.length, 1),
    coveragePct: round(possibleTrades > 0 ? (trades.length / possibleTrades) * 100 : 0, 1),
    addedTieTrades,
    addedTieReturnPct: round(addedTieReturnPct),
  };
}

function computePatternSideStats(rows: Row[]): Record<TiePattern, PatternSideStats> {
  const result = {} as Record<TiePattern, PatternSideStats>;
  for (const pattern of PATTERNS) {
    const subset = rows.filter((row) => row.tiePattern === pattern);
    let sentimentWins = 0;
    let oppositeWins = 0;
    let sentimentTotal = 0;
    let oppositeTotal = 0;
    for (const row of subset) {
      const sentimentDir = sentimentSideForPattern(row, pattern);
      const oppositeDir = sentimentDir === "LONG" ? "SHORT" : "LONG";
      const sentimentRet = directionalReturn(row.rawReturnPct, sentimentDir) * row.adrMultiplier;
      const oppositeRet = directionalReturn(row.rawReturnPct, oppositeDir) * row.adrMultiplier;
      sentimentTotal += sentimentRet;
      oppositeTotal += oppositeRet;
      if (sentimentRet > 0) sentimentWins += 1;
      if (oppositeRet > 0) oppositeWins += 1;
    }
    result[pattern] = {
      count: subset.length,
      sentimentSidePct: round(sentimentTotal),
      sentimentSideWinPct: round(subset.length > 0 ? (sentimentWins / subset.length) * 100 : 0, 1),
      oppositeSidePct: round(oppositeTotal),
      oppositeSideWinPct: round(subset.length > 0 ? (oppositeWins / subset.length) * 100 : 0, 1),
    };
  }
  return result;
}

async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc()) ?? getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .map((week) => normalizeWeekOpenUtc(week) ?? week)
    .filter((week) => week < currentWeek)
    .sort();

  const rows: Row[] = [];
  const targetAdrPct = getTargetAdrPct();

  for (const weekOpenUtc of weeks) {
    const basket = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "dealer")));
    const commercialMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "commercial")));
    const sentimentMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "sentiment")));
    const strengthMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "strength")));
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const returnsByKey = new Map(
      weeklyReturns.map((row) => [`${row.assetClass}|${row.symbol.toUpperCase()}`, row] as const),
    );
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const ret = returnsByKey.get(`${assetClass}|${pair}`);
        if (!ret) {
          throw new Error(`Missing weekly return for ${assetClass}|${pair} ${weekOpenUtc}`);
        }
        const dealer = dealerMap.get(pair);
        const commercial = commercialMap.get(pair);
        const sentiment = sentimentMap.get(pair);
        const strength = strengthMap.get(pair);
        if (!dealer || !commercial || !sentiment || !strength) {
          throw new Error(`Missing canonical direction for ${pair} ${weekOpenUtc}`);
        }
        const longs = [dealer, commercial, sentiment, strength].filter((dir) => dir === "LONG").length;
        const shorts = 4 - longs;
        const tiePattern = classifyTiePattern({
          dealer,
          commercial,
          sentiment,
          strength,
          longs,
          shorts,
        });
        const pairAdr = getAdrPct(adrMap, pair, assetClass);
        rows.push({
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: ret.returnPct,
          adrMultiplier: targetAdrPct / pairAdr,
          dealer,
          commercial,
          sentiment,
          strength,
          longs,
          shorts,
          tiePattern,
        });
      }
    }
  }

  const expectedBaseline = {
    trades: 244,
    totalReturnPct: 85.36,
    maxDrawdownPct: 7.61,
    losingWeeks: 3,
  };
  const baseline = computeVariantStats(rows, weeks, "agree_3of4");
  if (
    baseline.trades !== expectedBaseline.trades ||
    Math.abs(baseline.totalReturnPct - expectedBaseline.totalReturnPct) > 0.25 ||
    Math.abs(baseline.maxDrawdownPct - expectedBaseline.maxDrawdownPct) > 0.25 ||
    baseline.losingWeeks !== expectedBaseline.losingWeeks
  ) {
    throw new Error(`Baseline parity failed: ${JSON.stringify(baseline)}`);
  }

  const variants: VariantStats[] = [
    baseline,
    computeVariantStats(rows, weeks, "agree_3of4_plus_sest"),
    computeVariantStats(rows, weeks, "agree_3of4_plus_fx_ties"),
    computeVariantStats(rows, weeks, "agree_3of4_fx_crypto"),
    computeVariantStats(rows, weeks, "agree_3of4_plus_pattern_dcsest"),
    computeVariantStats(rows, weeks, "agree_3of4_plus_pattern_dsecst"),
    computeVariantStats(rows, weeks, "agree_3of4_plus_pattern_dstcse"),
  ].sort((a, b) => {
    if (a.losingWeeks !== b.losingWeeks) return a.losingWeeks - b.losingWeeks;
    return b.totalReturnPct - a.totalReturnPct;
  });

  const tieRows = rows.filter((row) => row.tiePattern !== null);
  const patternStats = computePatternSideStats(tieRows);

  const weeklyCoverage = weeks.map((weekOpenUtc) => {
    const weekRows = rows.filter((row) => row.weekOpenUtc === weekOpenUtc);
    return {
      week: weekLabel(weekOpenUtc),
      base: weekRows.filter((row) => variantDirection(row, "agree_3of4") !== null).length,
      sest: weekRows.filter((row) => variantDirection(row, "agree_3of4_plus_sest") !== null).length,
      fxTies: weekRows.filter((row) => variantDirection(row, "agree_3of4_plus_fx_ties") !== null).length,
      fxCrypto: weekRows.filter((row) => variantDirection(row, "agree_3of4_fx_crypto") !== null).length,
    };
  });

  const markdown = [
    "# 4-Source Agreement Optimization",
    "",
    `Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} -> ${weekLabel(weeks[weeks.length - 1]!)}).`,
    "Base system: agree_3of4 on canonical basket directions.",
    "All returns ADR-normalized.",
    "",
    "## Variant Comparison",
    "",
    "| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Trades/Wk | Added Tie Trades | Added Tie Return |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...variants.map((row) =>
      `| ${row.label} | ${row.trades} | ${signedPct(row.totalReturnPct)} | ${row.maxDrawdownPct.toFixed(2)}% | ${row.winRatePct.toFixed(1)}% | ${row.losingWeeks} | ${row.coveragePct.toFixed(1)}% | ${row.tradesPerWeek.toFixed(1)} | ${row.addedTieTrades} | ${signedPct(row.addedTieReturnPct)} |`,
    ),
    "",
    "## Tie Pattern Breakdown",
    "",
    "| Pattern | Count | Sentiment-Side Total% | Sentiment-Side Win% | Opposite-Side Total% | Opposite-Side Win% |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...PATTERNS.map((pattern) => {
      const row = patternStats[pattern];
      return `| ${pattern} | ${row.count} | ${signedPct(row.sentimentSidePct)} | ${row.sentimentSideWinPct.toFixed(1)}% | ${signedPct(row.oppositeSidePct)} | ${row.oppositeSideWinPct.toFixed(1)}% |`;
    }),
    "",
    "## Per-Week Coverage",
    "",
    "| Week | agree_3of4 | + Se+St ties | + FX-only ties | FX+crypto only |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...weeklyCoverage.map((row) => `| ${row.week} | ${row.base} | ${row.sest} | ${row.fxTies} | ${row.fxCrypto} |`),
    "",
  ].join("\n");

  writeFileSync(OUTPUT_PATH, markdown, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
