/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-4source-agreement.ts
 *
 * Description:
 * Canonical 4-source agreement research on the post-upgrade source layer.
 * Loads weekly pair returns and canonical basket directions, then compares
 * standalone, 3-source, and 4-source agreement variants under ADR-normalized
 * weekly-hold returns.
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
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy } from "../src/lib/performance/strategyConfig";

type Direction = "LONG" | "SHORT";
type SourceId = "dealer" | "commercial" | "sentiment" | "strength";
type StrategyId =
  | "dealer"
  | "commercial"
  | "sentiment"
  | "strength"
  | "agree_2of3_DCS"
  | "agree_2of3_DSt"
  | "agree_2of3_DCSt"
  | "agree_2of3_CSSt"
  | "agree_3of4"
  | "agree_4of4"
  | "agree_majority_dealer"
  | "agree_majority_sentiment";
type TiePattern = "D+C vs Se+St" | "D+Se vs C+St" | "D+St vs C+Se" | "other";

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
  longs: number;
  shorts: number;
  voteCount: number;
};

type WeekCoverageRow = {
  weekOpenUtc: string;
  weekLabel: string;
  agree_3of4: number;
  agree_4of4: number;
  agree_majority_dealer: number;
  agree_majority_sentiment: number;
};

type VoteWeek = {
  weekOpenUtc: string;
  weekLabel: string;
  unanimous: number;
  majority31: number;
  tie22: number;
  total: number;
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
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  losingWeeks: number;
  coveragePct: number;
};

type StrategyResult = {
  id: StrategyId;
  label: string;
  family: "standalone" | "three_source" | "four_source";
  stats: Stats;
  byAssetClass: AssetBreakdownRow[];
};

type TiebreakStats = {
  trades: number;
  totalReturnPct: number;
  avgReturnPct: number;
  winRatePct: number;
};

const OUTPUT_PATH = "docs/4SOURCE_AGREEMENT_RESEARCH_2026-04-05.md";
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
const STANDALONE_IDS: StrategyId[] = ["dealer", "commercial", "sentiment", "strength"];
const THREE_SOURCE_IDS: StrategyId[] = [
  "agree_2of3_DCS",
  "agree_2of3_DSt",
  "agree_2of3_DCSt",
  "agree_2of3_CSSt",
];
const FOUR_SOURCE_IDS: StrategyId[] = [
  "agree_3of4",
  "agree_4of4",
  "agree_majority_dealer",
  "agree_majority_sentiment",
];

const STRATEGY_LABELS: Record<StrategyId, string> = {
  dealer: "Dealer",
  commercial: "Commercial",
  sentiment: "Sentiment",
  strength: "Strength",
  agree_2of3_DCS: "agree_2of3_DCS",
  agree_2of3_DSt: "agree_2of3_DSt",
  agree_2of3_DCSt: "agree_2of3_DCSt",
  agree_2of3_CSSt: "agree_2of3_CSSt",
  agree_3of4: "agree_3of4",
  agree_4of4: "agree_4of4",
  agree_majority_dealer: "agree_majority_dealer",
  agree_majority_sentiment: "agree_majority_sentiment",
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function signedPct(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
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

function sourceValue(row: Row, source: SourceId) {
  return row[source];
}

function buildDirectionMap(signals: ReturnType<typeof nonNeutralSignals>) {
  return new Map(signals.map((signal) => [signal.symbol.toUpperCase(), signal.direction as Direction] as const));
}

function allPairsCount() {
  return ASSET_CLASSES.reduce((sum, assetClass) => sum + PAIRS_BY_ASSET_CLASS[assetClass].length, 0);
}

function resolveTiePattern(row: Row): TiePattern {
  const directionEntries = [
    ["D", row.dealer],
    ["C", row.commercial],
    ["Se", row.sentiment],
    ["St", row.strength],
  ] as const;
  const longs = directionEntries.filter(([, dir]) => dir === "LONG").map(([id]) => id).sort().join("+");
  const shorts = directionEntries.filter(([, dir]) => dir === "SHORT").map(([id]) => id).sort().join("+");
  const key = [longs, shorts].sort().join(" vs ");
  if (key === "C+D vs Se+St") return "D+C vs Se+St";
  if (key === "C+St vs D+Se") return "D+Se vs C+St";
  if (key === "C+Se vs D+St") return "D+St vs C+Se";
  return "other";
}

function resolveDirection(row: Row, strategyId: StrategyId): Direction | null {
  const countSubset = (subset: Array<Direction | null>) => {
    const longs = subset.filter((v) => v === "LONG").length;
    const shorts = subset.filter((v) => v === "SHORT").length;
    return { longs, shorts };
  };

  switch (strategyId) {
    case "dealer":
    case "commercial":
    case "sentiment":
    case "strength":
      return sourceValue(row, strategyId);

    case "agree_2of3_DCS": {
      const { longs, shorts } = countSubset([row.dealer, row.commercial, row.sentiment]);
      if (longs >= 2) return "LONG";
      if (shorts >= 2) return "SHORT";
      return null;
    }
    case "agree_2of3_DSt": {
      const { longs, shorts } = countSubset([row.dealer, row.sentiment, row.strength]);
      if (longs >= 2) return "LONG";
      if (shorts >= 2) return "SHORT";
      return null;
    }
    case "agree_2of3_DCSt": {
      const { longs, shorts } = countSubset([row.dealer, row.commercial, row.strength]);
      if (longs >= 2) return "LONG";
      if (shorts >= 2) return "SHORT";
      return null;
    }
    case "agree_2of3_CSSt": {
      const { longs, shorts } = countSubset([row.commercial, row.sentiment, row.strength]);
      if (longs >= 2) return "LONG";
      if (shorts >= 2) return "SHORT";
      return null;
    }

    case "agree_3of4":
      if (row.longs >= 3) return "LONG";
      if (row.shorts >= 3) return "SHORT";
      return null;
    case "agree_4of4":
      if (row.longs === 4) return "LONG";
      if (row.shorts === 4) return "SHORT";
      return null;
    case "agree_majority_dealer":
      if (row.longs >= 3) return "LONG";
      if (row.shorts >= 3) return "SHORT";
      return row.dealer;
    case "agree_majority_sentiment":
      if (row.longs >= 3) return "LONG";
      if (row.shorts >= 3) return "SHORT";
      return row.sentiment;
  }
}

function computeStatsFromReturns(
  trades: Array<{ weekOpenUtc: string; assetClass: AssetClass; returnPct: number }>,
  possibleTrades: number,
  weekCount: number,
): Stats {
  const weekly = new Map<string, number>();
  let wins = 0;
  let total = 0;
  for (const trade of trades) {
    total += trade.returnPct;
    weekly.set(trade.weekOpenUtc, (weekly.get(trade.weekOpenUtc) ?? 0) + trade.returnPct);
    if (trade.returnPct > 0) wins += 1;
  }
  const orderedWeekly = [...weekly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);
  const losingWeeks = orderedWeekly.filter((value) => value < 0).length;
  return {
    trades: trades.length,
    totalReturnPct: round(total),
    maxDrawdownPct: computeMaxDd(orderedWeekly),
    winRatePct: round(trades.length > 0 ? (wins / trades.length) * 100 : 0, 1),
    losingWeeks,
    coveragePct: round(possibleTrades > 0 ? (trades.length / possibleTrades) * 100 : 0, 1),
    tradesPerWeek: round(weekCount > 0 ? trades.length / weekCount : 0, 1),
  };
}

function computeStrategyResult(rows: Row[], strategyId: StrategyId, weekCount: number): StrategyResult {
  const trades: Array<{ weekOpenUtc: string; assetClass: AssetClass; returnPct: number }> = [];
  for (const row of rows) {
    const direction = resolveDirection(row, strategyId);
    if (!direction) continue;
    const normalizedReturn = directionalReturn(row.rawReturnPct, direction) * row.adrMultiplier;
    trades.push({
      weekOpenUtc: row.weekOpenUtc,
      assetClass: row.assetClass,
      returnPct: normalizedReturn,
    });
  }

  const stats = computeStatsFromReturns(trades, rows.length, weekCount);
  const byAssetClass: AssetBreakdownRow[] = ASSET_CLASSES.map((assetClass) => {
    const assetTrades = trades.filter((trade) => trade.assetClass === assetClass);
    const assetRows = rows.filter((row) => row.assetClass === assetClass);
    const assetStats = computeStatsFromReturns(
      assetTrades,
      assetRows.length,
      weekCount,
    );
    return {
      assetClass,
      trades: assetStats.trades,
      totalReturnPct: assetStats.totalReturnPct,
      maxDrawdownPct: assetStats.maxDrawdownPct,
      winRatePct: assetStats.winRatePct,
      losingWeeks: assetStats.losingWeeks,
      coveragePct: assetStats.coveragePct,
    };
  });

  byAssetClass.push({
    assetClass: "combined",
    trades: stats.trades,
    totalReturnPct: stats.totalReturnPct,
    maxDrawdownPct: stats.maxDrawdownPct,
    winRatePct: stats.winRatePct,
    losingWeeks: stats.losingWeeks,
    coveragePct: stats.coveragePct,
  });

  return {
    id: strategyId,
    label: STRATEGY_LABELS[strategyId],
    family: STANDALONE_IDS.includes(strategyId)
      ? "standalone"
      : THREE_SOURCE_IDS.includes(strategyId)
        ? "three_source"
        : "four_source",
    stats,
    byAssetClass,
  };
}

function assertClose(label: string, actual: number, expected: number, tolerance = 0.25) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

async function verifyParity(weeks: string[], results: Map<StrategyId, StrategyResult>) {
  const compareEngineStrategy = async (strategyId: string, resultId: StrategyId) => {
    const strategy = getStrategy(strategyId);
    if (!strategy) throw new Error(`Missing strategy config for ${strategyId}`);
    let trades = 0;
    let total = 0;
    let wins = 0;
    const weekly: number[] = [];
    for (const weekOpenUtc of weeks) {
      const result = await computeWeeklyHold(strategy, weekOpenUtc);
      trades += result.tradeCount;
      total += result.totalReturnPct;
      wins += result.winCount;
      weekly.push(result.totalReturnPct);
    }
    const losingWeeks = weekly.filter((value) => value < 0).length;
    const maxDd = computeMaxDd(weekly);
    const research = results.get(resultId);
    if (!research) throw new Error(`Missing research result for ${resultId}`);
    assertClose(`${strategyId} trades`, research.stats.trades, trades, 0.01);
    assertClose(`${strategyId} total`, research.stats.totalReturnPct, round(total), 0.25);
    assertClose(`${strategyId} drawdown`, research.stats.maxDrawdownPct, maxDd, 0.25);
    assertClose(`${strategyId} win rate`, research.stats.winRatePct, round(trades > 0 ? (wins / trades) * 100 : 0, 1), 0.25);
    assertClose(`${strategyId} losing weeks`, research.stats.losingWeeks, losingWeeks, 0.01);
  };

  for (const standaloneId of STANDALONE_IDS) {
    await compareEngineStrategy(standaloneId, standaloneId);
  }
  await compareEngineStrategy("agree_2of3", "agree_2of3_DCS");
  await compareEngineStrategy("agree_2of3_nocomm", "agree_2of3_DSt");
}

function formatCoverage(trades: number, possibleTrades: number) {
  return `${round((trades / possibleTrades) * 100, 1)}% (${trades}/${possibleTrades})`;
}

function formatStatsTableRow(result: StrategyResult, weekCount: number, totalPossibleTrades: number) {
  return `| ${result.label} | ${result.stats.trades} | ${signedPct(result.stats.totalReturnPct)} | ${result.stats.maxDrawdownPct.toFixed(2)}% | ${result.stats.winRatePct.toFixed(1)}% | ${result.stats.losingWeeks} | ${formatCoverage(result.stats.trades, totalPossibleTrades)} | ${result.stats.tradesPerWeek.toFixed(1)} |`;
}

async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc()) ?? getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .map((week) => normalizeWeekOpenUtc(week) ?? week)
    .filter((week) => week < currentWeek)
    .sort();

  const totalPossiblePairWeeks = allPairsCount() * weeks.length;
  const targetAdrPct = getTargetAdrPct();
  const rows: Row[] = [];
  const voteWeeks: VoteWeek[] = [];
  const tiePatternCounts = new Map<TiePattern, number>([
    ["D+C vs Se+St", 0],
    ["D+Se vs C+St", 0],
    ["D+St vs C+Se", 0],
    ["other", 0],
  ]);

  for (const weekOpenUtc of weeks) {
    const basket = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "dealer")));
    const commMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "commercial")));
    const sentMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "sentiment")));
    const strMap = buildDirectionMap(nonNeutralSignals(filterByModel(basket, "strength")));
    const returns = await getWeeklyPairReturns(weekOpenUtc);
    const returnMap = new Map(
      returns.map((row) => [`${row.assetClass}|${row.symbol.toUpperCase()}`, row] as const),
    );
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    let unanimous = 0;
    let majority31 = 0;
    let tie22 = 0;
    let total = 0;

    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const returnRow = returnMap.get(`${assetClass}|${pair}`);
        if (!returnRow) {
          throw new Error(`Missing pair return for ${assetClass}|${pair} ${weekOpenUtc}`);
        }
        const dealer = dealerMap.get(pair) ?? null;
        const commercial = commMap.get(pair) ?? null;
        const sentiment = sentMap.get(pair) ?? null;
        const strength = strMap.get(pair) ?? null;
        const votes = [dealer, commercial, sentiment, strength].filter(Boolean) as Direction[];
        const longs = votes.filter((value) => value === "LONG").length;
        const shorts = votes.filter((value) => value === "SHORT").length;
        const pairAdr = getAdrPct(adrMap, pair, assetClass);
        const adrMultiplier = targetAdrPct / pairAdr;

        const row: Row = {
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: returnRow.returnPct,
          adrMultiplier,
          dealer,
          commercial,
          sentiment,
          strength,
          longs,
          shorts,
          voteCount: votes.length,
        };
        rows.push(row);

        total += 1;
        if (longs === 4 || shorts === 4) unanimous += 1;
        else if ((longs === 3 && shorts === 1) || (shorts === 3 && longs === 1)) majority31 += 1;
        else if (longs === 2 && shorts === 2) {
          tie22 += 1;
          const pattern = resolveTiePattern(row);
          tiePatternCounts.set(pattern, (tiePatternCounts.get(pattern) ?? 0) + 1);
        }
      }
    }

    voteWeeks.push({
      weekOpenUtc,
      weekLabel: weekLabel(weekOpenUtc),
      unanimous,
      majority31,
      tie22,
      total,
    });
  }

  const results = new Map<StrategyId, StrategyResult>();
  for (const strategyId of [...STANDALONE_IDS, ...THREE_SOURCE_IDS, ...FOUR_SOURCE_IDS]) {
    results.set(strategyId, computeStrategyResult(rows, strategyId, weeks.length));
  }

  await verifyParity(weeks, results);

  const tieRows = rows.filter((row) => row.longs === 2 && row.shorts === 2);
  const tiebreakStats = (source: "dealer" | "sentiment"): TiebreakStats => {
    let trades = 0;
    let totalReturnPct = 0;
    let wins = 0;
    for (const row of tieRows) {
      const direction = row[source];
      if (!direction) continue;
      const normalizedReturn = directionalReturn(row.rawReturnPct, direction) * row.adrMultiplier;
      totalReturnPct += normalizedReturn;
      trades += 1;
      if (normalizedReturn > 0) wins += 1;
    }
    return {
      trades,
      totalReturnPct: round(totalReturnPct),
      avgReturnPct: trades > 0 ? round(totalReturnPct / trades, 3) : 0,
      winRatePct: trades > 0 ? round((wins / trades) * 100, 1) : 0,
    };
  };

  const master = [...results.values()].sort((a, b) => {
    if (a.stats.losingWeeks !== b.stats.losingWeeks) return a.stats.losingWeeks - b.stats.losingWeeks;
    return b.stats.totalReturnPct - a.stats.totalReturnPct;
  });

  const coverageRows: WeekCoverageRow[] = weeks.map((weekOpenUtc) => {
    const weekRows = rows.filter((row) => row.weekOpenUtc === weekOpenUtc);
    const countFor = (strategyId: StrategyId) =>
      weekRows.filter((row) => resolveDirection(row, strategyId) !== null).length;
    return {
      weekOpenUtc,
      weekLabel: weekLabel(weekOpenUtc),
      agree_3of4: countFor("agree_3of4"),
      agree_4of4: countFor("agree_4of4"),
      agree_majority_dealer: countFor("agree_majority_dealer"),
      agree_majority_sentiment: countFor("agree_majority_sentiment"),
    };
  });

  const standaloneTable = STANDALONE_IDS
    .map((id) => results.get(id)!)
    .map((result) => `| ${result.label} | ${result.stats.trades} | ${signedPct(result.stats.totalReturnPct)} | ${result.stats.maxDrawdownPct.toFixed(2)}% | ${result.stats.winRatePct.toFixed(1)}% | ${result.stats.losingWeeks} |`)
    .join("\n");

  const threeSourceTable = THREE_SOURCE_IDS
    .map((id) => results.get(id)!)
    .map((result) => {
      const sources = result.id === "agree_2of3_DCS"
        ? "D+C+Se"
        : result.id === "agree_2of3_DSt"
          ? "D+Se+St"
          : result.id === "agree_2of3_DCSt"
            ? "D+C+St"
            : "C+Se+St";
      return `| ${result.label} | ${sources} | ${result.stats.trades} | ${signedPct(result.stats.totalReturnPct)} | ${result.stats.maxDrawdownPct.toFixed(2)}% | ${result.stats.winRatePct.toFixed(1)}% | ${result.stats.losingWeeks} | ${formatCoverage(result.stats.trades, totalPossiblePairWeeks)} |`;
    })
    .join("\n");

  const fourSourceSections = FOUR_SOURCE_IDS.map((id) => {
    const result = results.get(id)!;
    const rowsMd = result.byAssetClass
      .map((assetRow) => `| ${assetRow.assetClass} | ${assetRow.trades} | ${signedPct(assetRow.totalReturnPct)} | ${assetRow.maxDrawdownPct.toFixed(2)}% | ${assetRow.winRatePct.toFixed(1)}% | ${assetRow.losingWeeks} | ${assetRow.coveragePct.toFixed(1)}% |`)
      .join("\n");
    return `### ${result.label}\n\n| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${rowsMd}`;
  }).join("\n\n");

  const tieTotal = tieRows.length;
  const dealerTie = tiebreakStats("dealer");
  const sentimentTie = tiebreakStats("sentiment");

  const markdown = [
    "# 4-Source Agreement Research",
    "",
    `Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} -> ${weekLabel(weeks[weeks.length - 1]!)}).`,
    `Universe: 36 pairs × ${weeks.length} weeks = ${totalPossiblePairWeeks} possible pair-weeks.`,
    "Data loader: getCanonicalBasketWeek (canonical app/engine path).",
    "All returns ADR-normalized.",
    "",
    "## Vote Distribution",
    "",
    "| Pattern | Count | % of Total |",
    "| --- | ---: | ---: |",
    `| 4-0 (unanimous) | ${voteWeeks.reduce((sum, row) => sum + row.unanimous, 0)} | ${round((voteWeeks.reduce((sum, row) => sum + row.unanimous, 0) / totalPossiblePairWeeks) * 100, 1)}% |`,
    `| 3-1 (strong majority) | ${voteWeeks.reduce((sum, row) => sum + row.majority31, 0)} | ${round((voteWeeks.reduce((sum, row) => sum + row.majority31, 0) / totalPossiblePairWeeks) * 100, 1)}% |`,
    `| 2-2 (tie) | ${voteWeeks.reduce((sum, row) => sum + row.tie22, 0)} | ${round((voteWeeks.reduce((sum, row) => sum + row.tie22, 0) / totalPossiblePairWeeks) * 100, 1)}% |`,
    "",
    "### Per-Week Vote Distribution",
    "",
    "| Week | 4-0 | 3-1 | 2-2 | Total |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...voteWeeks.map((row) => `| ${row.weekLabel} | ${row.unanimous} | ${row.majority31} | ${row.tie22} | ${row.total} |`),
    "",
    "## Tie Analysis (2v2 Splits)",
    "",
    "| Split Pattern | Count | % of Ties |",
    "| --- | ---: | ---: |",
    `| D+C vs Se+St | ${tiePatternCounts.get("D+C vs Se+St") ?? 0} | ${tieTotal > 0 ? round(((tiePatternCounts.get("D+C vs Se+St") ?? 0) / tieTotal) * 100, 1) : 0}% |`,
    `| D+Se vs C+St | ${tiePatternCounts.get("D+Se vs C+St") ?? 0} | ${tieTotal > 0 ? round(((tiePatternCounts.get("D+Se vs C+St") ?? 0) / tieTotal) * 100, 1) : 0}% |`,
    `| D+St vs C+Se | ${tiePatternCounts.get("D+St vs C+Se") ?? 0} | ${tieTotal > 0 ? round(((tiePatternCounts.get("D+St vs C+Se") ?? 0) / tieTotal) * 100, 1) : 0}% |`,
    `| other | ${tiePatternCounts.get("other") ?? 0} | ${tieTotal > 0 ? round(((tiePatternCounts.get("other") ?? 0) / tieTotal) * 100, 1) : 0}% |`,
    "",
    "### Tiebreak-Only Performance",
    "",
    "| Tiebreaker | Tie Trades | Total% | Avg% | Win% |",
    "| --- | ---: | ---: | ---: | ---: |",
    `| Dealer direction | ${dealerTie.trades} | ${signedPct(dealerTie.totalReturnPct)} | ${signedPct(dealerTie.avgReturnPct, 3)} | ${dealerTie.winRatePct.toFixed(1)}% |`,
    `| Sentiment direction | ${sentimentTie.trades} | ${signedPct(sentimentTie.totalReturnPct)} | ${signedPct(sentimentTie.avgReturnPct, 3)} | ${sentimentTie.winRatePct.toFixed(1)}% |`,
    "",
    "## Standalone Source Baselines",
    "",
    "| Source | Trades | Total% | MaxDD% | Win% | Losing Wks |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    standaloneTable,
    "",
    "## 3-Source Agreement Baselines",
    "",
    "| Variant | Sources | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    threeSourceTable,
    "",
    "## 4-Source Agreement Results",
    "",
    fourSourceSections,
    "",
    "## Master Comparison",
    "",
    "| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Trades/Wk |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...master.map((result) => formatStatsTableRow(result, weeks.length, totalPossiblePairWeeks)),
    "",
    "## Per-Week Coverage",
    "",
    "| Week | agree_3of4 | agree_4of4 | agree_majority_dealer | agree_majority_sentiment |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...coverageRows.map((row) => `| ${row.weekLabel} | ${row.agree_3of4} | ${row.agree_4of4} | ${row.agree_majority_dealer} | ${row.agree_majority_sentiment} |`),
    "",
  ].join("\n");

  writeFileSync(OUTPUT_PATH, markdown, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
