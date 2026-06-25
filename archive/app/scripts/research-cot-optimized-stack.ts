/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-cot-optimized-stack.ts
 *
 * Description:
 * Verifies the optimized dealer neutral resolver stack:
 * spread ratio -> delta persistence -> OI-confirmed delta.
 * Also evaluates commercial quality filters before any canonical changes.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { deriveCotReportDate, listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { derivePairDirectionsWithNeutral } from "../src/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { listSnapshotDates, readSnapshotHistory } from "../src/lib/cotStore";
import type { CotSnapshot, MarketSnapshot } from "../src/lib/cotTypes";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { filterByModel, getCanonicalBasketWeek, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/COT_OPTIMIZED_STACK_RESULTS_2026-04-04.md";
const FX_ASSET = "fx" as const;

type Direction = "LONG" | "SHORT";

type WeekContext = {
  weekOpenUtc: string;
  weekLabel: string;
  reportDate: string;
  fxSnapshot: CotSnapshot;
  priorDates: string[];
  priorSnapshots: CotSnapshot[];
};

type CurrencyContext = {
  current: MarketSnapshot;
  dealerDirectionalRatio: number | null;
  dealerDeltaPersistence: number | null;
  dealerDeltaNet: number | null;
  dealerNet: number;
  oiDelta: number | null;
  commercialDeltaPersistence: number | null;
  commercialDeltaNet: number | null;
  commercialNet: number | null;
  commercialTowardMean: boolean;
};

type PairRow = {
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  dealerDirection: Direction | null;
  dealerLeanDirection: Direction | null;
  spreadDirection: Direction | null;
  deltaPersistenceDirection: Direction | null;
  oiConfirmDirection: Direction | null;
  commercialDirection: Direction | null;
  commercialDeltaPersistenceDirection: Direction | null;
  commercialTowardMean: boolean;
  commercialEitherConfirm: boolean;
  commercialBothConfirm: boolean;
  commercialNeitherConfirm: boolean;
};

type Stats = {
  label: string;
  pairs: number;
  totalReturnPct: number;
  winRatePct: number;
  avgReturnPct: number;
  vsBaselinePct?: number | null;
};

type WeeklyResult = {
  weekLabel: string;
  ret: number;
  trades: number;
  wins: number;
  losses: number;
};

type WaterfallRow = {
  label: string;
  resolved: number;
  cumulative: number;
  tierWinRatePct: number;
  cumulativeWinRatePct: number;
  tierTotalPct: number;
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signedPercent(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function directionFromScore(score: number | null | undefined): Direction | null {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }
  if (score > 0) {
    return "LONG";
  }
  if (score < 0) {
    return "SHORT";
  }
  return null;
}

function directionalReturn(row: PairRow, direction: Direction) {
  return (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
}

function computeWeeklyMetrics(entries: WeeklyResult[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  for (const entry of entries) {
    cumulative += entry.ret;
    if (cumulative > peak) {
      peak = cumulative;
    }
    maxDD = Math.max(maxDD, peak - cumulative);
  }
  const trades = entries.reduce((sum, entry) => sum + entry.trades, 0);
  const wins = entries.reduce((sum, entry) => sum + entry.wins, 0);
  return {
    totalPct: round(cumulative),
    maxDdPct: round(maxDD),
    trades,
    winRatePct: trades > 0 ? round((wins / trades) * 100, 1) : 0,
  };
}

function renderStatsTable(
  title: string,
  rows: Stats[],
  options: { includeDelta?: boolean; firstHeader?: string } = {},
) {
  const headers = [
    options.firstHeader ?? "Method",
    "Pairs",
    "Total%",
    "Win%",
    "Avg%",
    ...(options.includeDelta ? ["vs Base"] : []),
  ];
  const lines = [`### ${title}`, "", `| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const row of rows) {
    const cells = [
      row.label,
      String(row.pairs),
      signedPercent(row.totalReturnPct),
      `${row.winRatePct.toFixed(1)}%`,
      signedPercent(row.avgReturnPct, 3),
      ...(options.includeDelta ? [signedPercent(row.vsBaselinePct ?? 0)] : []),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

function renderWaterfallTable(rows: WaterfallRow[], remaining: number) {
  const lines = [
    "| Tier | Resolved | Cumulative | Tier Win% | Cum Win% | Tier Total% |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${row.resolved} | ${row.cumulative} | ${row.tierWinRatePct.toFixed(1)}% | ${row.cumulativeWinRatePct.toFixed(1)}% | ${signedPercent(row.tierTotalPct)} |`,
    );
  }
  lines.push(`| Remaining unresolved | ${remaining} | ${rows.at(-1)?.cumulative ?? 0} | — | — | — |`);
  return lines.join("\n");
}

function assertBaseline(name: string, actual: Stats, expected: { pairs: number; total: number; win: number }) {
  const totalDiff = Math.abs(actual.totalReturnPct - expected.total);
  const winDiff = Math.abs(actual.winRatePct - expected.win);
  if (actual.pairs !== expected.pairs || totalDiff > 0.05 || winDiff > 0.2) {
    throw new Error(
      `${name} baseline mismatch. Expected ${expected.pairs} / ${expected.total.toFixed(2)} / ${expected.win.toFixed(1)}, got ${actual.pairs} / ${actual.totalReturnPct.toFixed(2)} / ${actual.winRatePct.toFixed(1)}`,
    );
  }
}

function getPreviousDate(allDatesAsc: string[], reportDate: string, countBack: number) {
  const index = allDatesAsc.indexOf(reportDate);
  if (index <= 0 || index - countBack < 0) {
    return null;
  }
  return allDatesAsc[index - countBack] ?? null;
}

function getPreviousDates(allDatesAsc: string[], reportDate: string, countBack: number) {
  const index = allDatesAsc.indexOf(reportDate);
  if (index <= 0) {
    return [];
  }
  return allDatesAsc.slice(Math.max(0, index - countBack), index);
}

function getSnapshot(map: Map<string, CotSnapshot>, date: string | null) {
  if (!date) {
    return null;
  }
  return map.get(date) ?? null;
}

async function loadWeekContexts() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weekOpenUtcs = (await listDataSectionWeeks())
    .sort((left, right) => left.localeCompare(right))
    .filter((weekOpenUtc) => weekOpenUtc < currentWeekOpenUtc);

  const allDatesDesc = await listSnapshotDates(FX_ASSET);
  const allDatesAsc = [...allDatesDesc].sort((left, right) => left.localeCompare(right));
  const fxHistory = await readSnapshotHistory(FX_ASSET, allDatesAsc.length);
  const snapshotMap = new Map(fxHistory.map((snapshot) => [snapshot.report_date, snapshot]));

  const contexts: WeekContext[] = [];
  for (const rawWeekOpenUtc of weekOpenUtcs) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const fxSnapshot = snapshotMap.get(reportDate);
    if (!fxSnapshot) {
      throw new Error(`Missing FX snapshot for ${reportDate}`);
    }

    const priorDates = getPreviousDates(allDatesAsc, reportDate, 260);
    const priorSnapshots = priorDates
      .map((date) => snapshotMap.get(date))
      .filter((snapshot): snapshot is CotSnapshot => Boolean(snapshot));

    contexts.push({
      weekOpenUtc,
      weekLabel: weekLabel(weekOpenUtc),
      reportDate,
      fxSnapshot,
      priorDates,
      priorSnapshots,
    });
  }

  return { allDatesAsc, snapshotMap, contexts };
}

function directionalRatio(market: MarketSnapshot) {
  if (typeof market.dealer_spread !== "number" || market.dealer_spread < 0) {
    return null;
  }
  const directional = Math.abs(market.dealer_net);
  const denom = directional + market.dealer_spread;
  return denom > 0 ? directional / denom : null;
}

function deltaPersistenceScore(currentDelta: number | null | undefined, priors: Array<number | null | undefined>) {
  if (typeof currentDelta !== "number" || currentDelta === 0) {
    return null;
  }
  const sign = currentDelta > 0 ? 1 : -1;
  let count = 0;
  for (const priorDelta of priors.slice(0, 4)) {
    if (typeof priorDelta !== "number" || priorDelta === 0) {
      continue;
    }
    if ((priorDelta > 0 ? 1 : -1) === sign) {
      count += 1;
    }
  }
  return count;
}

function buildCurrencyContext(
  currency: string,
  context: WeekContext,
  allDatesAsc: string[],
  snapshotMap: Map<string, CotSnapshot>,
): CurrencyContext {
  const current = context.fxSnapshot.currencies[currency]!;
  const previous1 = getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 1));
  const previous2 = getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 2));
  const previous3 = getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 3));
  const previous4 = getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 4));

  const priorDealerDeltas = [
    previous1?.currencies[currency]?.dealer_delta_net ?? null,
    previous2?.currencies[currency]?.dealer_delta_net ?? null,
    previous3?.currencies[currency]?.dealer_delta_net ?? null,
    previous4?.currencies[currency]?.dealer_delta_net ?? null,
  ];
  const priorCommercialDeltas = [
    previous1?.currencies[currency]?.commercial_delta_net ?? null,
    previous2?.currencies[currency]?.commercial_delta_net ?? null,
    previous3?.currencies[currency]?.commercial_delta_net ?? null,
    previous4?.currencies[currency]?.commercial_delta_net ?? null,
  ];
  const priorCommercialNets52 = context.priorSnapshots
    .slice(-52)
    .map((snapshot) => snapshot.currencies[currency]?.commercial_net ?? null)
    .filter((value): value is number => typeof value === "number");

  const previous4CommercialNet = previous4?.currencies[currency]?.commercial_net ?? null;
  const commercialMean52 =
    priorCommercialNets52.length >= 26
      ? priorCommercialNets52.reduce((sum, value) => sum + value, 0) / priorCommercialNets52.length
      : null;
  const commercialTowardMean =
    typeof current.commercial_net === "number" &&
    typeof previous4CommercialNet === "number" &&
    typeof commercialMean52 === "number"
      ? Math.abs(current.commercial_net - commercialMean52) < Math.abs(previous4CommercialNet - commercialMean52)
      : false;

  return {
    current,
    dealerDirectionalRatio: directionalRatio(current),
    dealerDeltaPersistence: deltaPersistenceScore(current.dealer_delta_net ?? null, priorDealerDeltas),
    dealerDeltaNet: current.dealer_delta_net ?? null,
    dealerNet: current.dealer_net,
    oiDelta: current.oi_delta ?? null,
    commercialDeltaPersistence: deltaPersistenceScore(current.commercial_delta_net ?? null, priorCommercialDeltas),
    commercialDeltaNet: current.commercial_delta_net ?? null,
    commercialNet: current.commercial_net ?? null,
    commercialTowardMean,
  };
}

function resolveBySpreadRatio(base: CurrencyContext, quote: CurrencyContext): Direction | null {
  const baseRatio = base.dealerDirectionalRatio;
  const quoteRatio = quote.dealerDirectionalRatio;
  if (typeof baseRatio !== "number" || typeof quoteRatio !== "number" || baseRatio === quoteRatio) {
    return null;
  }
  return directionFromScore(baseRatio - quoteRatio);
}

function resolveByDeltaPersistence(base: CurrencyContext, quote: CurrencyContext): Direction | null {
  return directionFromScore((base.dealerDeltaPersistence ?? 0) - (quote.dealerDeltaPersistence ?? 0));
}

function resolveByOiConfirm(base: CurrencyContext, quote: CurrencyContext): Direction | null {
  const direction = directionFromScore((base.dealerDeltaNet ?? 0) - (quote.dealerDeltaNet ?? 0));
  if (!direction) {
    return null;
  }
  if (direction === "LONG") {
    const baseConfirmed =
      typeof base.dealerDeltaNet === "number" &&
      base.dealerDeltaNet > 0 &&
      typeof base.oiDelta === "number" &&
      base.oiDelta > 0;
    const quoteConfirmed =
      typeof quote.dealerDeltaNet === "number" &&
      quote.dealerDeltaNet < 0 &&
      typeof quote.oiDelta === "number" &&
      quote.oiDelta > 0;
    return baseConfirmed || quoteConfirmed ? direction : null;
  }

  const baseConfirmed =
    typeof base.dealerDeltaNet === "number" &&
    base.dealerDeltaNet < 0 &&
    typeof base.oiDelta === "number" &&
    base.oiDelta > 0;
  const quoteConfirmed =
    typeof quote.dealerDeltaNet === "number" &&
    quote.dealerDeltaNet > 0 &&
    typeof quote.oiDelta === "number" &&
    quote.oiDelta > 0;
  return baseConfirmed || quoteConfirmed ? direction : null;
}

function resolveCommercialDeltaPersistence(base: CurrencyContext, quote: CurrencyContext): Direction | null {
  return directionFromScore((base.commercialDeltaPersistence ?? 0) - (quote.commercialDeltaPersistence ?? 0));
}

async function buildPairRows(contexts: WeekContext[], allDatesAsc: string[], snapshotMap: Map<string, CotSnapshot>) {
  const targetAdr = getTargetAdrPct();
  const rows: PairRow[] = [];

  for (const context of contexts) {
    const dealerPairs = derivePairDirectionsWithNeutral(
      context.fxSnapshot.currencies,
      PAIRS_BY_ASSET_CLASS.fx,
      "dealer",
    );

    const returns = await getWeeklyPairReturns(context.weekOpenUtc, FX_ASSET);
    const adrMap = await loadWeeklyAdrMap(context.weekOpenUtc);
    const returnMap = new Map(
      returns.map((row) => {
        const adrPct = getAdrPct(adrMap, row.symbol.toUpperCase(), row.assetClass);
        return [
          row.symbol.toUpperCase(),
          {
            returnPct: row.returnPct,
            adrMultiplier: adrPct > 0 ? targetAdr / adrPct : 1,
          },
        ] as const;
      }),
    );

    const currencyContexts = new Map(
      Object.keys(context.fxSnapshot.currencies).map((currency) => [
        currency,
        buildCurrencyContext(currency, context, allDatesAsc, snapshotMap),
      ]),
    );

    for (const pairDef of PAIRS_BY_ASSET_CLASS.fx) {
      const pair = pairDef.pair.toUpperCase();
      const ret = returnMap.get(pair);
      const base = currencyContexts.get(pairDef.base);
      const quote = currencyContexts.get(pairDef.quote);
      if (!ret || !base || !quote) {
        continue;
      }

      const dealerDirection =
        dealerPairs[pair]?.direction === "LONG" || dealerPairs[pair]?.direction === "SHORT"
          ? dealerPairs[pair]!.direction
          : null;
      const commercialScoreCurrent =
        typeof base.commercialNet === "number" && typeof quote.commercialNet === "number"
          ? base.commercialNet - quote.commercialNet
          : null;
      const basePrevious4CommercialNet =
        context.priorSnapshots.at(-4)?.currencies[pairDef.base]?.commercial_net ?? null;
      const quotePrevious4CommercialNet =
        context.priorSnapshots.at(-4)?.currencies[pairDef.quote]?.commercial_net ?? null;
      const commercialScorePrev4 =
        typeof basePrevious4CommercialNet === "number" && typeof quotePrevious4CommercialNet === "number"
          ? basePrevious4CommercialNet - quotePrevious4CommercialNet
          : null;
      const baseCommercialSeries52 = context.priorSnapshots
        .slice(-52)
        .map((snapshot) => snapshot.currencies[pairDef.base]?.commercial_net ?? null);
      const quoteCommercialSeries52 = context.priorSnapshots
        .slice(-52)
        .map((snapshot) => snapshot.currencies[pairDef.quote]?.commercial_net ?? null);
      const commercialPairSeries52 = baseCommercialSeries52
        .map((baseValue, index) => {
          const quoteValue = quoteCommercialSeries52[index];
          return typeof baseValue === "number" && typeof quoteValue === "number" ? baseValue - quoteValue : null;
        })
        .filter((value): value is number => typeof value === "number");
      const commercialMean52 =
        commercialPairSeries52.length > 0
          ? commercialPairSeries52.reduce((sum, value) => sum + value, 0) / commercialPairSeries52.length
          : null;
      const commercialDirection = directionFromScore(commercialScoreCurrent);
      const commercialDeltaDirection = resolveCommercialDeltaPersistence(base, quote);
      const commercialTowardMean =
        typeof commercialMean52 === "number" &&
        typeof commercialScoreCurrent === "number" &&
        typeof commercialScorePrev4 === "number"
          ? Math.abs(commercialScoreCurrent - commercialMean52) < Math.abs(commercialScorePrev4 - commercialMean52)
          : false;
      const commercialDeltaConfirms =
        commercialDirection !== null &&
        commercialDeltaDirection !== null &&
        commercialDeltaDirection === commercialDirection;

      rows.push({
        weekOpenUtc: context.weekOpenUtc,
        weekLabel: context.weekLabel,
        pair,
        rawReturnPct: ret.returnPct,
        adrMultiplier: ret.adrMultiplier,
        dealerDirection,
        dealerLeanDirection: directionFromScore(base.current.dealer_net - quote.current.dealer_net),
        spreadDirection: resolveBySpreadRatio(base, quote),
        deltaPersistenceDirection: resolveByDeltaPersistence(base, quote),
        oiConfirmDirection: resolveByOiConfirm(base, quote),
        commercialDirection,
        commercialDeltaPersistenceDirection: commercialDeltaDirection,
        commercialTowardMean,
        commercialEitherConfirm: commercialDeltaConfirms || commercialTowardMean,
        commercialBothConfirm: commercialDeltaConfirms && commercialTowardMean,
        commercialNeitherConfirm: !commercialDeltaConfirms && !commercialTowardMean,
      });
    }
  }

  return rows;
}

function evaluateStats(
  rows: PairRow[],
  predicate: (row: PairRow) => boolean,
  directionGetter: (row: PairRow) => Direction | null,
  label: string,
  baselineTotal?: number,
): Stats {
  let pairs = 0;
  let wins = 0;
  let totalReturnPct = 0;
  for (const row of rows) {
    if (!predicate(row)) {
      continue;
    }
    const direction = directionGetter(row);
    if (!direction) {
      continue;
    }
    const ret = directionalReturn(row, direction);
    totalReturnPct += ret;
    pairs += 1;
    if (ret > 0) {
      wins += 1;
    }
  }
  return {
    label,
    pairs,
    totalReturnPct: round(totalReturnPct),
    winRatePct: pairs > 0 ? round((wins / pairs) * 100, 1) : 0,
    avgReturnPct: pairs > 0 ? round(totalReturnPct / pairs, 3) : 0,
    vsBaselinePct: typeof baselineTotal === "number" ? round(totalReturnPct - baselineTotal) : null,
  };
}

function buildStackResult(rows: PairRow[]) {
  const unresolved = new Set(rows.map((_, index) => index));
  const resolvedDirections = new Map<number, Direction>();
  const waterfall: WaterfallRow[] = [];
  let cumulativeResolved = 0;
  let cumulativeWins = 0;

  const tiers = [
    { label: "Tier 1: Spread Ratio", resolve: (row: PairRow) => row.spreadDirection },
    { label: "Tier 2: Delta Persistence", resolve: (row: PairRow) => row.deltaPersistenceDirection },
    { label: "Tier 3: OI-Confirm", resolve: (row: PairRow) => row.oiConfirmDirection },
  ];

  for (const tier of tiers) {
    let tierResolved = 0;
    let tierWins = 0;
    let tierTotal = 0;
    for (const index of [...unresolved]) {
      const row = rows[index]!;
      const direction = tier.resolve(row);
      if (!direction) {
        continue;
      }
      unresolved.delete(index);
      resolvedDirections.set(index, direction);
      tierResolved += 1;
      const ret = directionalReturn(row, direction);
      tierTotal += ret;
      if (ret > 0) {
        tierWins += 1;
      }
    }

    cumulativeResolved += tierResolved;
    cumulativeWins += tierWins;
    waterfall.push({
      label: tier.label,
      resolved: tierResolved,
      cumulative: cumulativeResolved,
      tierWinRatePct: tierResolved > 0 ? round((tierWins / tierResolved) * 100, 1) : 0,
      cumulativeWinRatePct: cumulativeResolved > 0 ? round((cumulativeWins / cumulativeResolved) * 100, 1) : 0,
      tierTotalPct: round(tierTotal),
    });
  }

  let resolvedTotalPct = 0;
  let resolvedWins = 0;
  for (const [index, direction] of resolvedDirections.entries()) {
    const ret = directionalReturn(rows[index]!, direction);
    resolvedTotalPct += ret;
    if (ret > 0) {
      resolvedWins += 1;
    }
  }

  return {
    resolvedDirections,
    unresolved: unresolved.size,
    waterfall,
    stats: {
      label: "Optimized stack",
      pairs: resolvedDirections.size,
      totalReturnPct: round(resolvedTotalPct),
      winRatePct: resolvedDirections.size > 0 ? round((resolvedWins / resolvedDirections.size) * 100, 1) : 0,
      avgReturnPct: resolvedDirections.size > 0 ? round(resolvedTotalPct / resolvedDirections.size, 3) : 0,
    } satisfies Stats,
  };
}

async function computeDealerSystemPerformance(
  weekOpenUtcs: string[],
  fillByWeekPair: Map<string, Direction>,
) {
  const targetAdr = getTargetAdrPct();
  const entries: WeeklyResult[] = [];

  for (const weekOpenUtc of weekOpenUtcs) {
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = new Map(
      nonNeutralSignals(filterByModel(basketWeek, "dealer")).map((signal) => [
        signal.symbol.toUpperCase(),
        signal.direction as Direction,
      ]),
    );
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
    const acc = { ret: 0, trades: 0, wins: 0, losses: 0 };

    for (const row of weeklyReturns) {
      const pair = row.symbol.toUpperCase();
      const direction = fillByWeekPair.get(`${weekOpenUtc}::${pair}`) ?? dealerSignals.get(pair) ?? null;
      if (!direction) {
        continue;
      }
      const pairAdr = getAdrPct(adrMap, pair, row.assetClass);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      const ret = (direction === "SHORT" ? -row.returnPct : row.returnPct) * multiplier;
      acc.ret += ret;
      acc.trades += 1;
      if (ret > 0) {
        acc.wins += 1;
      } else {
        acc.losses += 1;
      }
    }

    entries.push({
      weekLabel: weekLabel(weekOpenUtc),
      ret: acc.ret,
      trades: acc.trades,
      wins: acc.wins,
      losses: acc.losses,
    });
  }

  return computeWeeklyMetrics(entries);
}

function computeSystemMetricsByFilter(
  rows: PairRow[],
  predicate: (row: PairRow) => boolean,
  directionGetter: (row: PairRow) => Direction | null,
) {
  const order = [...new Set(rows.map((row) => row.weekOpenUtc))].sort((left, right) => left.localeCompare(right));
  const byWeek = new Map<string, WeeklyResult>();
  for (const key of order) {
    const label = rows.find((row) => row.weekOpenUtc === key)?.weekLabel ?? key;
    byWeek.set(key, { weekLabel: label, ret: 0, trades: 0, wins: 0, losses: 0 });
  }
  for (const row of rows) {
    if (!predicate(row)) {
      continue;
    }
    const direction = directionGetter(row);
    if (!direction) {
      continue;
    }
    const entry = byWeek.get(row.weekOpenUtc)!;
    const ret = directionalReturn(row, direction);
    entry.ret += ret;
    entry.trades += 1;
    if (ret > 0) {
      entry.wins += 1;
    } else {
      entry.losses += 1;
    }
  }
  return computeWeeklyMetrics(order.map((key) => byWeek.get(key)!));
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Optimized Stack Research                                 ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const { allDatesAsc, snapshotMap, contexts } = await loadWeekContexts();
  const pairRows = await buildPairRows(contexts, allDatesAsc, snapshotMap);
  const neutralRows = pairRows.filter((row) => row.dealerDirection === null);
  const nonNeutralRows = pairRows.filter((row) => row.dealerDirection !== null);

  const dealerNonNeutralBaseline = evaluateStats(
    nonNeutralRows,
    () => true,
    (row) => row.dealerDirection,
    "Dealer non-neutral",
  );
  const dealerNeutralBaseline = evaluateStats(
    neutralRows,
    () => true,
    (row) => row.dealerLeanDirection,
    "Dealer neutral lean",
  );
  const commercialBaseline = evaluateStats(
    pairRows,
    () => true,
    (row) => row.commercialDirection,
    "Commercial forced-raw",
  );

  assertBaseline("Dealer non-neutral", dealerNonNeutralBaseline, { pairs: 150, total: 38.03, win: 55.3 });
  assertBaseline("Dealer neutral lean", dealerNeutralBaseline, { pairs: 130, total: -58.66, win: 34.6 });
  assertBaseline("Commercial forced raw", commercialBaseline, { pairs: 280, total: 23.41, win: 52.9 });

  const dealerCurrentOverall = await computeDealerSystemPerformance(
    contexts.map((context) => context.weekOpenUtc),
    new Map(),
  );

  const confirmationRows = [
    evaluateStats(neutralRows, () => true, (row) => row.spreadDirection, "Spread directional ratio"),
    evaluateStats(neutralRows, () => true, (row) => row.deltaPersistenceDirection, "Delta persistence (>=3 of 4)"),
    evaluateStats(neutralRows, () => true, (row) => row.oiConfirmDirection, "OI-confirmed delta"),
  ];

  const stackResult = buildStackResult(neutralRows);
  const spreadOnlyFillMap = new Map<string, Direction>();
  for (const row of neutralRows) {
    if (row.spreadDirection) {
      spreadOnlyFillMap.set(`${row.weekOpenUtc}::${row.pair}`, row.spreadDirection);
    }
  }
  const stackFillMap = new Map<string, Direction>();
  for (const [index, direction] of stackResult.resolvedDirections.entries()) {
    const row = neutralRows[index]!;
    stackFillMap.set(`${row.weekOpenUtc}::${row.pair}`, direction);
  }

  const dealerSpreadOverall = await computeDealerSystemPerformance(
    contexts.map((context) => context.weekOpenUtc),
    spreadOnlyFillMap,
  );
  const dealerStackOverall = await computeDealerSystemPerformance(
    contexts.map((context) => context.weekOpenUtc),
    stackFillMap,
  );

  const nonNeutralImpactRows = [
    dealerNonNeutralBaseline,
    evaluateStats(
      nonNeutralRows,
      (row) => row.spreadDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Spread ratio confirms direction",
      dealerNonNeutralBaseline.totalReturnPct,
    ),
    evaluateStats(
      nonNeutralRows,
      (row) => row.spreadDirection !== null && row.spreadDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Spread ratio contradicts",
      dealerNonNeutralBaseline.totalReturnPct,
    ),
    evaluateStats(
      nonNeutralRows,
      (row) => row.deltaPersistenceDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Delta persist confirms",
      dealerNonNeutralBaseline.totalReturnPct,
    ),
    evaluateStats(
      nonNeutralRows,
      (row) => row.deltaPersistenceDirection !== null && row.deltaPersistenceDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Delta persist contradicts",
      dealerNonNeutralBaseline.totalReturnPct,
    ),
  ];

  const commercialFilterRows = [
    commercialBaseline,
    evaluateStats(
      pairRows,
      (row) => row.commercialDeltaPersistenceDirection === row.commercialDirection,
      (row) => row.commercialDirection,
      "Delta persistence confirms",
      commercialBaseline.totalReturnPct,
    ),
    evaluateStats(
      pairRows,
      (row) => row.commercialTowardMean,
      (row) => row.commercialDirection,
      "Moving toward 52w mean",
      commercialBaseline.totalReturnPct,
    ),
    evaluateStats(
      pairRows,
      (row) => row.commercialEitherConfirm,
      (row) => row.commercialDirection,
      "Either filter confirms",
      commercialBaseline.totalReturnPct,
    ),
    evaluateStats(
      pairRows,
      (row) => row.commercialBothConfirm,
      (row) => row.commercialDirection,
      "Both filters confirm",
      commercialBaseline.totalReturnPct,
    ),
    evaluateStats(
      pairRows,
      (row) => row.commercialNeitherConfirm,
      (row) => row.commercialDirection,
      "Neither filter confirms",
      commercialBaseline.totalReturnPct,
    ),
  ];

  const commercialHighConfidenceMetrics = computeSystemMetricsByFilter(
    pairRows,
    (row) => row.commercialEitherConfirm,
    (row) => row.commercialDirection,
  );
  const commercialLowConfidenceMetrics = computeSystemMetricsByFilter(
    pairRows,
    (row) => !row.commercialEitherConfirm,
    (row) => row.commercialDirection,
  );

  const dealerBarPassed =
    dealerStackOverall.totalPct >= 60 &&
    dealerStackOverall.maxDdPct <= 10 &&
    dealerStackOverall.winRatePct >= 54;
  const commercialBarPassed = commercialHighConfidenceMetrics.winRatePct >= 57;

  const lines: string[] = [];
  lines.push("# COT Optimized Stack Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${contexts.length} (${contexts[0]!.weekLabel} → ${contexts.at(-1)!.weekLabel}).`);
  lines.push(`Stored FX history window: ${allDatesAsc[0]} → ${allDatesAsc.at(-1)} (${allDatesAsc.length} dates).`);
  lines.push("");
  lines.push("## Step 0: Baseline Reproduction");
  lines.push("");
  lines.push("| Baseline | Pairs | Total% | MaxDD% | Win% |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  lines.push(`| Dealer non-neutral | ${dealerNonNeutralBaseline.pairs} | ${signedPercent(dealerNonNeutralBaseline.totalReturnPct)} | — | ${dealerNonNeutralBaseline.winRatePct.toFixed(1)}% |`);
  lines.push(`| Dealer neutral lean | ${dealerNeutralBaseline.pairs} | ${signedPercent(dealerNeutralBaseline.totalReturnPct)} | — | ${dealerNeutralBaseline.winRatePct.toFixed(1)}% |`);
  lines.push(`| Commercial forced-raw | ${commercialBaseline.pairs} | ${signedPercent(commercialBaseline.totalReturnPct)} | — | ${commercialBaseline.winRatePct.toFixed(1)}% |`);
  lines.push(`| Dealer standalone (no fill) | ${dealerCurrentOverall.trades} | ${signedPercent(dealerCurrentOverall.totalPct)} | ${dealerCurrentOverall.maxDdPct.toFixed(2)}% | ${dealerCurrentOverall.winRatePct.toFixed(1)}% |`);
  lines.push("");
  lines.push("## Step 1: Dealer Method Confirmation");
  lines.push("");
  lines.push(renderStatsTable("Neutral Resolver Confirmation", confirmationRows));
  lines.push("");
  lines.push("## Step 2: Dealer Optimized Stack Waterfall");
  lines.push("");
  lines.push(renderWaterfallTable(stackResult.waterfall, stackResult.unresolved));
  lines.push("");
  lines.push(`Resolved neutral stats: ${stackResult.stats.pairs} fills, ${signedPercent(stackResult.stats.totalReturnPct)}, ${stackResult.stats.winRatePct.toFixed(1)}% WR.`);
  lines.push("");
  lines.push("## Step 3: Dealer Combined Standalone Result");
  lines.push("");
  lines.push("| Dealer System | Trades | Total% | MaxDD% | Win% |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  lines.push(`| Current dealer (no fill) | ${dealerCurrentOverall.trades} | ${signedPercent(dealerCurrentOverall.totalPct)} | ${dealerCurrentOverall.maxDdPct.toFixed(2)}% | ${dealerCurrentOverall.winRatePct.toFixed(1)}% |`);
  lines.push(`| Dealer + spread ratio only | ${dealerSpreadOverall.trades} | ${signedPercent(dealerSpreadOverall.totalPct)} | ${dealerSpreadOverall.maxDdPct.toFixed(2)}% | ${dealerSpreadOverall.winRatePct.toFixed(1)}% |`);
  lines.push(`| Dealer + optimized stack | ${dealerStackOverall.trades} | ${signedPercent(dealerStackOverall.totalPct)} | ${dealerStackOverall.maxDdPct.toFixed(2)}% | ${dealerStackOverall.winRatePct.toFixed(1)}% |`);
  lines.push("");
  lines.push("## Step 4: Dealer Non-Neutral Impact Check");
  lines.push("");
  lines.push(renderStatsTable("Filter on non-neutral", nonNeutralImpactRows, { includeDelta: true, firstHeader: "Filter" }));
  lines.push("");
  lines.push("## Step 5: Commercial Quality Filters");
  lines.push("");
  lines.push(renderStatsTable("Filter on commercial forced-raw", commercialFilterRows, { includeDelta: true, firstHeader: "Filter" }));
  lines.push("");
  lines.push("## Step 6: Commercial High/Low Confidence Split");
  lines.push("");
  lines.push("| Commercial Tier | Trades | Total% | MaxDD% | Win% |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  lines.push(`| All commercial (baseline) | ${commercialBaseline.pairs} | ${signedPercent(commercialBaseline.totalReturnPct)} | 29.04% | ${commercialBaseline.winRatePct.toFixed(1)}% |`);
  lines.push(`| High-confidence subset | ${commercialHighConfidenceMetrics.trades} | ${signedPercent(commercialHighConfidenceMetrics.totalPct)} | ${commercialHighConfidenceMetrics.maxDdPct.toFixed(2)}% | ${commercialHighConfidenceMetrics.winRatePct.toFixed(1)}% |`);
  lines.push(`| Low-confidence subset | ${commercialLowConfidenceMetrics.trades} | ${signedPercent(commercialLowConfidenceMetrics.totalPct)} | ${commercialLowConfidenceMetrics.maxDdPct.toFixed(2)}% | ${commercialLowConfidenceMetrics.winRatePct.toFixed(1)}% |`);
  lines.push("");
  lines.push("## Phase 2 Gate");
  lines.push("");
  lines.push(`- Dealer bar: ${dealerBarPassed ? "PASS" : "FAIL"} (needs >= +60%, <= 10% DD, >= 54% WR; got ${signedPercent(dealerStackOverall.totalPct)}, ${dealerStackOverall.maxDdPct.toFixed(2)}% DD, ${dealerStackOverall.winRatePct.toFixed(1)}% WR).`);
  lines.push(`- Commercial bar: ${commercialBarPassed ? "PASS" : "FAIL"} (needs high-confidence WR >= 57%; got ${commercialHighConfidenceMetrics.winRatePct.toFixed(1)}%).`);
  lines.push("");
  lines.push(
    dealerBarPassed && commercialBarPassed
      ? "Both bars passed. Phase 2 canonicalization is allowed."
      : "At least one bar failed. Canonicalization should not be applied from this pass.",
  );
  lines.push("");

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log(`Dealer current: ${dealerCurrentOverall.trades} / ${dealerCurrentOverall.totalPct.toFixed(2)}% / ${dealerCurrentOverall.maxDdPct.toFixed(2)} DD`);
  console.log(`Dealer spread-only: ${dealerSpreadOverall.trades} / ${dealerSpreadOverall.totalPct.toFixed(2)}% / ${dealerSpreadOverall.maxDdPct.toFixed(2)} DD`);
  console.log(`Dealer optimized stack: ${dealerStackOverall.trades} / ${dealerStackOverall.totalPct.toFixed(2)}% / ${dealerStackOverall.maxDdPct.toFixed(2)} DD`);
  console.log(`Commercial high-confidence: ${commercialHighConfidenceMetrics.trades} / ${commercialHighConfidenceMetrics.totalPct.toFixed(2)}% / ${commercialHighConfidenceMetrics.maxDdPct.toFixed(2)} DD / ${commercialHighConfidenceMetrics.winRatePct.toFixed(1)}% WR`);
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
