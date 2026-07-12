/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-veto-base-source.ts
 *
 * Description:
 * Standardized 2/4 veto research on canonical 36/36 base sources.
 * Tests raw sleeves, veto-filtered sleeves, 3-of-4 reference, and veto unions.
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

type TradeRow = {
  key: string;
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  direction: Direction;
  returnPct: number;
};

type StrategyStats = {
  id: string;
  label: string;
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  losingWeeks: number;
  tradesPerWeek: number;
  byAssetClass: Record<string, { trades: number; totalReturnPct: number; winRatePct: number }>;
};

const OUTPUT_PATH = "docs/VETO_BASE_SOURCE_RESEARCH_2026-04-06.md";
const TARGET_ADR = getTargetAdrPct();

const ALL_KNOWN_PAIRS = new Set<string>(
  Object.values(PAIRS_BY_ASSET_CLASS).flat().map((pair) => pair.pair.toUpperCase()),
);

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

function inferAssetClass(pair: string): AssetClass {
  for (const [assetClass, pairs] of Object.entries(PAIRS_BY_ASSET_CLASS) as [AssetClass, typeof PAIRS_BY_ASSET_CLASS[AssetClass]][]) {
    if (pairs.some((item) => item.pair.toUpperCase() === pair.toUpperCase())) {
      return assetClass;
    }
  }
  return "fx";
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

function vetoFires(
  sourceDirection: Direction,
  otherDirections: (Direction | null)[],
): boolean {
  let disagreeCount = 0;
  for (const other of otherDirections) {
    if (other !== null && other !== sourceDirection) {
      disagreeCount += 1;
    }
  }
  return disagreeCount >= 2;
}

function majority3of4(row: Row): Direction | null {
  const directions = [row.dealer, row.commercial, row.sentiment, row.strength].filter(Boolean) as Direction[];
  const longs = directions.filter((direction) => direction === "LONG").length;
  const shorts = directions.filter((direction) => direction === "SHORT").length;
  if (longs >= 3) return "LONG";
  if (shorts >= 3) return "SHORT";
  return null;
}

async function loadRows(): Promise<{ rows: Row[]; weeks: string[] }> {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const weeks = (await listDataSectionWeeks())
    .filter((week) => normalizeWeekOpenUtc(week) < currentWeek)
    .slice(-10);

  const rows: Row[] = [];

  for (const weekOpenUtc of weeks) {
    const basket = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = nonNeutralSignals(filterByModel(basket, "dealer"));
    const commercialSignals = nonNeutralSignals(filterByModel(basket, "commercial"));
    const sentimentSignals = nonNeutralSignals(filterByModel(basket, "sentiment"));
    const strengthSignals = nonNeutralSignals(filterByModel(basket, "strength"));

    const dealerMap = new Map(dealerSignals.map((signal) => [signal.symbol.toUpperCase(), signal.direction as Direction]));
    const commMap = new Map(commercialSignals.map((signal) => [signal.symbol.toUpperCase(), signal.direction as Direction]));
    const sentMap = new Map(sentimentSignals.map((signal) => [signal.symbol.toUpperCase(), signal.direction as Direction]));
    const strMap = new Map(strengthSignals.map((signal) => [signal.symbol.toUpperCase(), signal.direction as Direction]));

    const pairReturns = await getWeeklyPairReturns(weekOpenUtc);
    const returnBySymbol = new Map(pairReturns.map((row) => [row.symbol.toUpperCase(), row.returnPct]));
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    for (const pair of ALL_KNOWN_PAIRS) {
      const rawReturn = returnBySymbol.get(pair);
      if (rawReturn === undefined) continue;
      const assetClass = inferAssetClass(pair);
      const pairAdr = getAdrPct(adrMap, pair, assetClass);
      rows.push({
        weekOpenUtc,
        assetClass,
        pair,
        rawReturnPct: rawReturn,
        adrMultiplier: TARGET_ADR / pairAdr,
        dealer: dealerMap.get(pair) ?? null,
        commercial: commMap.get(pair) ?? null,
        sentiment: sentMap.get(pair) ?? null,
        strength: strMap.get(pair) ?? null,
      });
    }

    for (const [label, map] of [
      ["dealer", dealerMap],
      ["commercial", commMap],
      ["sentiment", sentMap],
      ["strength", strMap],
    ] as const) {
      if (map.size !== 36) {
        throw new Error(`${label} coverage mismatch for ${weekOpenUtc}: expected 36, got ${map.size}`);
      }
    }
  }

  return { rows, weeks };
}

function buildStrategyStats(trades: TradeRow[], weeks: string[]): Omit<StrategyStats, "id" | "label"> {
  const weekly = new Map<string, number>();
  const byAssetClass = new Map<string, { trades: number; returnPct: number; wins: number }>();
  let wins = 0;
  let total = 0;

  for (const trade of trades) {
    weekly.set(trade.weekOpenUtc, (weekly.get(trade.weekOpenUtc) ?? 0) + trade.returnPct);
    total += trade.returnPct;
    if (trade.returnPct > 0) wins += 1;
    const bucket = byAssetClass.get(trade.assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    bucket.trades += 1;
    bucket.returnPct += trade.returnPct;
    if (trade.returnPct > 0) bucket.wins += 1;
    byAssetClass.set(trade.assetClass, bucket);
  }

  const weeklyReturns = weeks.map((week) => weekly.get(week) ?? 0);
  const byAssetClassRecord: StrategyStats["byAssetClass"] = {};
  for (const assetClass of ["fx", "crypto", "indices", "commodities"] as const) {
    const bucket = byAssetClass.get(assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    byAssetClassRecord[assetClass] = {
      trades: bucket.trades,
      totalReturnPct: round(bucket.returnPct),
      winRatePct: round(bucket.trades > 0 ? (bucket.wins / bucket.trades) * 100 : 0, 1),
    };
  }

  return {
    trades: trades.length,
    totalReturnPct: round(total),
    maxDrawdownPct: computeMaxDd(weeklyReturns),
    winRatePct: round(trades.length > 0 ? (wins / trades.length) * 100 : 0, 1),
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    tradesPerWeek: round(trades.length / weeks.length, 1),
    byAssetClass: byAssetClassRecord,
  };
}

function mapToTrades(id: string, rows: Row[], resolver: (row: Row) => Direction | null): TradeRow[] {
  const trades: TradeRow[] = [];
  for (const row of rows) {
    const direction = resolver(row);
    if (!direction) continue;
    trades.push({
      key: `${row.weekOpenUtc}|${row.pair}`,
      weekOpenUtc: row.weekOpenUtc,
      assetClass: row.assetClass,
      pair: row.pair,
      direction,
      returnPct: directionalReturn(row.rawReturnPct, direction) * row.adrMultiplier,
    });
  }
  return trades;
}

function unionTrades(id: string, groups: TradeRow[][]): TradeRow[] {
  const map = new Map<string, TradeRow>();
  for (const group of groups) {
    for (const trade of group) {
      const existing = map.get(trade.key);
      if (existing && existing.direction !== trade.direction) {
        throw new Error(`Direction mismatch in ${id} union for ${trade.key}`);
      }
      if (!existing) {
        map.set(trade.key, trade);
      }
    }
  }
  return Array.from(map.values());
}

async function main() {
  const { rows, weeks } = await loadRows();

  const rawTrades = {
    dealer_raw: mapToTrades("dealer_raw", rows, (row) => row.dealer),
    commercial_raw: mapToTrades("commercial_raw", rows, (row) => row.commercial),
    sentiment_raw: mapToTrades("sentiment_raw", rows, (row) => row.sentiment),
    strength_raw: mapToTrades("strength_raw", rows, (row) => row.strength),
  };

  const vetoPassed = {
    dealer_veto: mapToTrades("dealer_veto", rows, (row) =>
      row.dealer && !vetoFires(row.dealer, [row.commercial, row.sentiment, row.strength]) ? row.dealer : null),
    commercial_veto: mapToTrades("commercial_veto", rows, (row) =>
      row.commercial && !vetoFires(row.commercial, [row.dealer, row.sentiment, row.strength]) ? row.commercial : null),
    sentiment_veto: mapToTrades("sentiment_veto", rows, (row) =>
      row.sentiment && !vetoFires(row.sentiment, [row.dealer, row.commercial, row.strength]) ? row.sentiment : null),
    strength_veto: mapToTrades("strength_veto", rows, (row) =>
      row.strength && !vetoFires(row.strength, [row.dealer, row.commercial, row.sentiment]) ? row.strength : null),
  };

  const agree3of4 = mapToTrades("agree_3of4_reference", rows, (row) => majority3of4(row));

  const sleeves = {
    dealer_strength_union: unionTrades("dealer_strength_union", [vetoPassed.dealer_veto, vetoPassed.strength_veto]),
    dealer_sentiment_union: unionTrades("dealer_sentiment_union", [vetoPassed.dealer_veto, vetoPassed.sentiment_veto]),
    dealer_strength_sentiment_union: unionTrades("dealer_strength_sentiment_union", [vetoPassed.dealer_veto, vetoPassed.strength_veto, vetoPassed.sentiment_veto]),
    all_4_veto_union: unionTrades("all_4_veto_union", [vetoPassed.dealer_veto, vetoPassed.commercial_veto, vetoPassed.sentiment_veto, vetoPassed.strength_veto]),
  };

  const allStats: StrategyStats[] = [
    { id: "dealer_raw", label: "Dealer Raw", ...buildStrategyStats(rawTrades.dealer_raw, weeks) },
    { id: "commercial_raw", label: "Commercial Raw", ...buildStrategyStats(rawTrades.commercial_raw, weeks) },
    { id: "sentiment_raw", label: "Sentiment Raw", ...buildStrategyStats(rawTrades.sentiment_raw, weeks) },
    { id: "strength_raw", label: "Strength Raw", ...buildStrategyStats(rawTrades.strength_raw, weeks) },
    { id: "dealer_veto", label: "Dealer Veto", ...buildStrategyStats(vetoPassed.dealer_veto, weeks) },
    { id: "commercial_veto", label: "Commercial Veto", ...buildStrategyStats(vetoPassed.commercial_veto, weeks) },
    { id: "sentiment_veto", label: "Sentiment Veto", ...buildStrategyStats(vetoPassed.sentiment_veto, weeks) },
    { id: "strength_veto", label: "Strength Veto", ...buildStrategyStats(vetoPassed.strength_veto, weeks) },
    { id: "agree_3of4_reference", label: "Agree 3-of-4 Reference", ...buildStrategyStats(agree3of4, weeks) },
    { id: "dealer_strength_union", label: "Dealer + Strength Veto Union", ...buildStrategyStats(sleeves.dealer_strength_union, weeks) },
    { id: "dealer_sentiment_union", label: "Dealer + Sentiment Veto Union", ...buildStrategyStats(sleeves.dealer_sentiment_union, weeks) },
    { id: "dealer_strength_sentiment_union", label: "Dealer + Strength + Sentiment Veto Union", ...buildStrategyStats(sleeves.dealer_strength_sentiment_union, weeks) },
    { id: "all_4_veto_union", label: "All 4 Veto Union", ...buildStrategyStats(sleeves.all_4_veto_union, weeks) },
  ];

  const vetoSummary = [
    {
      source: "dealer",
      rawTrades: rawTrades.dealer_raw.length,
      vetoPassed: vetoPassed.dealer_veto.length,
      vetoFailed: rawTrades.dealer_raw.length - vetoPassed.dealer_veto.length,
      failedTrades: rawTrades.dealer_raw.filter((trade) => !new Set(vetoPassed.dealer_veto.map((item) => item.key)).has(trade.key)),
    },
    {
      source: "commercial",
      rawTrades: rawTrades.commercial_raw.length,
      vetoPassed: vetoPassed.commercial_veto.length,
      vetoFailed: rawTrades.commercial_raw.length - vetoPassed.commercial_veto.length,
      failedTrades: rawTrades.commercial_raw.filter((trade) => !new Set(vetoPassed.commercial_veto.map((item) => item.key)).has(trade.key)),
    },
    {
      source: "sentiment",
      rawTrades: rawTrades.sentiment_raw.length,
      vetoPassed: vetoPassed.sentiment_veto.length,
      vetoFailed: rawTrades.sentiment_raw.length - vetoPassed.sentiment_veto.length,
      failedTrades: rawTrades.sentiment_raw.filter((trade) => !new Set(vetoPassed.sentiment_veto.map((item) => item.key)).has(trade.key)),
    },
    {
      source: "strength",
      rawTrades: rawTrades.strength_raw.length,
      vetoPassed: vetoPassed.strength_veto.length,
      vetoFailed: rawTrades.strength_raw.length - vetoPassed.strength_veto.length,
      failedTrades: rawTrades.strength_raw.filter((trade) => !new Set(vetoPassed.strength_veto.map((item) => item.key)).has(trade.key)),
    },
  ];

  const overlapSets = {
    dealer_veto: new Set(vetoPassed.dealer_veto.map((trade) => trade.key)),
    commercial_veto: new Set(vetoPassed.commercial_veto.map((trade) => trade.key)),
    sentiment_veto: new Set(vetoPassed.sentiment_veto.map((trade) => trade.key)),
    strength_veto: new Set(vetoPassed.strength_veto.map((trade) => trade.key)),
  };

  const overlapNames = Object.keys(overlapSets) as (keyof typeof overlapSets)[];
  const overlapMatrix = overlapNames.map((left) => ({
    row: left,
    cols: overlapNames.map((right) => {
      let count = 0;
      for (const key of overlapSets[left]) {
        if (overlapSets[right].has(key)) count += 1;
      }
      return count;
    }),
  }));

  const uniqueRows = overlapNames.map((name) => {
    const own = overlapSets[name];
    const uniqueKeys = new Set<string>();
    for (const key of own) {
      const shared = overlapNames.some((other) => other !== name && overlapSets[other].has(key));
      if (!shared) uniqueKeys.add(key);
    }
    const allTradesForSource =
      name === "dealer_veto" ? vetoPassed.dealer_veto :
      name === "commercial_veto" ? vetoPassed.commercial_veto :
      name === "sentiment_veto" ? vetoPassed.sentiment_veto :
      vetoPassed.strength_veto;
    const uniqueTrades = allTradesForSource.filter((trade) => uniqueKeys.has(trade.key));
    const uniqueStats = buildStrategyStats(uniqueTrades, weeks);
    return {
      source: name,
      vetoPassed: own.size,
      unique: uniqueKeys.size,
      shared: own.size - uniqueKeys.size,
      uniqueReturn: uniqueStats.totalReturnPct,
      uniqueWr: uniqueStats.winRatePct,
    };
  });

  const unionKeys = new Set(sleeves.all_4_veto_union.map((trade) => trade.key));
  const agreeKeys = new Set(agree3of4.map((trade) => trade.key));
  const mismatches = [
    ...Array.from(unionKeys).filter((key) => !agreeKeys.has(key)),
    ...Array.from(agreeKeys).filter((key) => !unionKeys.has(key)),
  ];

  const weekTables: Record<string, Map<string, { trades: number; total: number }>> = {};
  for (const stat of [
    ["dealer_raw", rawTrades.dealer_raw],
    ["dealer_veto", vetoPassed.dealer_veto],
    ["strength_raw", rawTrades.strength_raw],
    ["strength_veto", vetoPassed.strength_veto],
    ["sentiment_veto", vetoPassed.sentiment_veto],
    ["agree_3of4_reference", agree3of4],
    ["dealer_strength_union", sleeves.dealer_strength_union],
    ["dealer_strength_sentiment_union", sleeves.dealer_strength_sentiment_union],
  ] as const) {
    const map = new Map<string, { trades: number; total: number }>();
    for (const trade of stat[1]) {
      const bucket = map.get(trade.weekOpenUtc) ?? { trades: 0, total: 0 };
      bucket.trades += 1;
      bucket.total += trade.returnPct;
      map.set(trade.weekOpenUtc, bucket);
    }
    weekTables[stat[0]] = map;
  }

  const lines: string[] = [
    "# Veto Base Source Research at 36/36",
    "",
    `Weeks analyzed: ${weeks.length} (${formatWeek(weeks[0]!)} -> ${formatWeek(weeks.at(-1)!)}).`,
    "Universe: 360 pair-weeks.",
    "Data loader: getCanonicalBasketWeek (canonical app/engine path).",
    "All returns ADR-normalized.",
    "",
    "Veto rule: 2/4 standardized — skip when 2+ of the other 3 sources actively disagree.",
    "",
    "## Veto Filter Summary",
    "",
    "| Source | Raw Trades | Veto-Passed | Veto-Failed | Failed Return | Failed WR |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...vetoSummary.map((row) => {
      const stats = buildStrategyStats(row.failedTrades, weeks);
      return `| ${row.source} | ${row.rawTrades} | ${row.vetoPassed} | ${row.vetoFailed} | ${signedPct(stats.totalReturnPct)} | ${stats.winRatePct.toFixed(1)}% |`;
    }),
    "",
    "## Master Comparison",
    "",
    "| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...allStats
      .sort((left, right) => {
        if (left.losingWeeks !== right.losingWeeks) return left.losingWeeks - right.losingWeeks;
        if (left.maxDrawdownPct !== right.maxDrawdownPct) return left.maxDrawdownPct - right.maxDrawdownPct;
        return right.totalReturnPct - left.totalReturnPct;
      })
      .map((row) => `| ${row.label} | ${row.trades} | ${signedPct(row.totalReturnPct)} | ${row.maxDrawdownPct.toFixed(2)}% | ${row.winRatePct.toFixed(1)}% | ${row.losingWeeks} | ${row.tradesPerWeek.toFixed(1)} |`),
    "",
    "## Asset Breakdown",
    "",
  ];

  for (const stat of allStats) {
    lines.push(`### ${stat.label}`);
    lines.push("");
    lines.push("| Asset Class | Trades | Total% | Win% |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const assetClass of ["fx", "crypto", "indices", "commodities"] as const) {
      const bucket = stat.byAssetClass[assetClass];
      lines.push(`| ${assetClass} | ${bucket.trades} | ${signedPct(bucket.totalReturnPct)} | ${bucket.winRatePct.toFixed(1)}% |`);
    }
    lines.push("");
  }

  lines.push("## Overlap Matrix");
  lines.push("");
  lines.push(`| | ${overlapNames.join(" | ")} |`);
  lines.push(`| --- | ${overlapNames.map(() => "---:").join(" | ")} |`);
  for (const row of overlapMatrix) {
    lines.push(`| ${row.row} | ${row.cols.join(" | ")} |`);
  }
  lines.push("");

  lines.push("## Unique Trades Per Source");
  lines.push("");
  lines.push("| Source | Veto-Passed | Unique | Shared | Unique Return | Unique WR |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of uniqueRows) {
    lines.push(`| ${row.source} | ${row.vetoPassed} | ${row.unique} | ${row.shared} | ${signedPct(row.uniqueReturn)} | ${row.uniqueWr.toFixed(1)}% |`);
  }
  lines.push("");

  lines.push("## Structural Verification");
  lines.push("");
  lines.push(`- 4-source veto union = agree_3of4: ${mismatches.length === 0 ? "YES" : "NO"}`);
  lines.push(`- Pair-weeks in union: ${unionKeys.size}`);
  lines.push(`- Pair-weeks in agree_3of4: ${agreeKeys.size}`);
  lines.push(`- Mismatches: ${mismatches.length}`);
  if (mismatches.length > 0) {
    lines.push("- Mismatch keys:");
    for (const key of mismatches.slice(0, 20)) {
      lines.push(`  - ${key}`);
    }
  }
  lines.push("");

  lines.push("## Per-Week Profile");
  lines.push("");
  lines.push("| Week | dealer_raw | dealer_veto | strength_raw | strength_veto | sentiment_veto | agree_3of4 | D+St sleeve | D+St+Se sleeve |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const week of weeks) {
    const dealerRaw = weekTables.dealer_raw.get(week) ?? { trades: 0, total: 0 };
    const dealerVeto = weekTables.dealer_veto.get(week) ?? { trades: 0, total: 0 };
    const strengthRaw = weekTables.strength_raw.get(week) ?? { trades: 0, total: 0 };
    const strengthVeto = weekTables.strength_veto.get(week) ?? { trades: 0, total: 0 };
    const sentimentVeto = weekTables.sentiment_veto.get(week) ?? { trades: 0, total: 0 };
    const agree = weekTables.agree_3of4_reference.get(week) ?? { trades: 0, total: 0 };
    const dSt = weekTables.dealer_strength_union.get(week) ?? { trades: 0, total: 0 };
    const dStSe = weekTables.dealer_strength_sentiment_union.get(week) ?? { trades: 0, total: 0 };
    lines.push(`| ${formatWeek(week)} | ${signedPct(dealerRaw.total)} | ${signedPct(dealerVeto.total)} | ${signedPct(strengthRaw.total)} | ${signedPct(strengthVeto.total)} | ${signedPct(sentimentVeto.total)} | ${signedPct(agree.total)} | ${signedPct(dSt.total)} | ${signedPct(dStSe.total)} |`);
  }

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
