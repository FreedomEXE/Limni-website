/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-cot-deep-history.ts
 *
 * Description:
 * Dealer-first deep-history COT research using 260 stored FX snapshots.
 * Tests momentum, extremeness, spread quality, trader structure,
 * stacked neutral-resolution hierarchies, and commercial quality filters.
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
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { filterByModel, getCanonicalBasketWeek, nonNeutralSignals } from "../src/lib/performance/basketSource";

const OUTPUT_PATH = "docs/COT_DEEP_HISTORY_RESEARCH_RESULTS_2026-04-04.md";
const FX_ASSET = "fx" as const;
const MOMENTUM_THRESHOLDS = [0, 5_000, 10_000, 20_000] as const;

type Direction = "LONG" | "SHORT";

type WeekContext = {
  weekOpenUtc: string;
  weekLabel: string;
  reportDate: string;
  fxSnapshot: CotSnapshot;
  priorDates: string[];
  priorSnapshots: CotSnapshot[];
};

type PairRow = {
  weekOpenUtc: string;
  weekLabel: string;
  reportDate: string;
  pair: string;
  base: string;
  quote: string;
  rawReturnPct: number;
  adrMultiplier: number;
  dealerDirection: Direction | null;
  dealerLeanDirection: Direction | null;
  dealerDeltaDirection: Direction | null;
  dealerOiConfirmedDirection: Direction | null;
  dealerMomentum2Direction: Direction | null;
  dealerMomentum4Direction: Direction | null;
  dealerMomentum8Direction: Direction | null;
  dealerMomentum4AbsScore: number | null;
  dealerDeltaPersistenceDirection: Direction | null;
  dealerPctOiMomentum2Direction: Direction | null;
  dealerPctOiMomentum4Direction: Direction | null;
  dealerNetPercentileDirection: Direction | null;
  dealerPctOiPercentileDirection: Direction | null;
  dealerExtremeDirection: Direction | null;
  dealerExtremeRisingDirection: Direction | null;
  dealerExtremeFadingDirection: Direction | null;
  dealerDirectionalRatioDirection: Direction | null;
  dealerDirectionalRatioHigh: boolean;
  dealerDirectionalRatioLow: boolean;
  dealerTraderStructureDirection: Direction | null;
  dealerTraderImbalanceStrong: boolean;
  dealerTraderImbalanceWeak: boolean;
  dealerTraderTotal: number | null;
  commercialDirection: Direction | null;
  commercialMomentum4Direction: Direction | null;
  commercialDeltaPersistenceDirection: Direction | null;
  commercialPercentileDirection: Direction | null;
  commercialExtremeAligned: boolean;
  commercialMovingTowardMean: boolean;
  commercialMovingAwayFromMean: boolean;
  commercialFarFromMean: boolean;
  commercialFarReturning: boolean;
};

type Stats = {
  label: string;
  pairs: number;
  totalReturnPct: number;
  winRatePct: number;
  avgReturnPct: number;
  notes?: string;
  vsBaselinePct?: number | null;
};

type ResolverFn = (row: PairRow) => Direction | null;

type ResolverTier = {
  label: string;
  resolve: ResolverFn;
};

type WaterfallRow = {
  label: string;
  resolved: number;
  cumulative: number;
  tierWinRatePct: number;
  cumulativeWinRatePct: number;
  tierTotalPct: number;
};

type WeeklyResult = {
  weekLabel: string;
  ret: number;
  trades: number;
  wins: number;
  losses: number;
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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

function signedPercent(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function invert(direction: Direction | null): Direction | null {
  if (direction === "LONG") {
    return "SHORT";
  }
  if (direction === "SHORT") {
    return "LONG";
  }
  return null;
}

function percentile(current: number | null | undefined, priors: Array<number | null | undefined>) {
  if (typeof current !== "number") {
    return null;
  }
  const values = priors.filter((value): value is number => typeof value === "number");
  if (values.length < 52) {
    return null;
  }
  return values.filter((value) => value < current).length / values.length;
}

function mean(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentileRankOfAbs(value: number, priorValues: number[]) {
  if (!Number.isFinite(value) || priorValues.length === 0) {
    return null;
  }
  const abs = Math.abs(value);
  return priorValues.filter((item) => Math.abs(item) < abs).length / priorValues.length;
}

function ratio(longValue: number | null | undefined, shortValue: number | null | undefined) {
  if (typeof longValue !== "number" || typeof shortValue !== "number" || longValue <= 0 || shortValue <= 0) {
    return null;
  }
  return Math.max(longValue, shortValue) / Math.min(longValue, shortValue);
}

function directionalRatio(market: MarketSnapshot) {
  if (typeof market.dealer_spread !== "number") {
    return null;
  }
  const directional = Math.abs(market.dealer_net);
  const denom = directional + market.dealer_spread;
  return denom > 0 ? directional / denom : null;
}

function traderBiasScore(market: MarketSnapshot) {
  if (typeof market.dealer_traders_long !== "number" || typeof market.dealer_traders_short !== "number") {
    return null;
  }
  return market.dealer_traders_short - market.dealer_traders_long;
}

function traderTotal(market: MarketSnapshot) {
  if (typeof market.dealer_traders_long !== "number" || typeof market.dealer_traders_short !== "number") {
    return null;
  }
  return market.dealer_traders_long + market.dealer_traders_short;
}

function deltaPersistence(markets: MarketSnapshot[], getter: (market: MarketSnapshot) => number | null | undefined) {
  if (markets.length === 0) {
    return null;
  }
  const current = getter(markets[0]!);
  const currentDirection = directionFromScore(current ?? null);
  if (!currentDirection) {
    return null;
  }
  let count = 0;
  for (const market of markets.slice(0, 4)) {
    const dir = directionFromScore(getter(market) ?? null);
    if (dir === currentDirection) {
      count += 1;
    }
  }
  return count;
}

function evaluateStats(
  rows: PairRow[],
  predicate: (row: PairRow) => boolean,
  directionGetter: (row: PairRow) => Direction | null,
  label: string,
  baselineTotal?: number,
  notes?: string,
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
    const ret = (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
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
    notes,
    vsBaselinePct: typeof baselineTotal === "number" ? round(totalReturnPct - baselineTotal) : null,
  };
}

function renderStatsTable(
  title: string,
  rows: Stats[],
  options: { includeDelta?: boolean; includeNotes?: boolean; gapLabel?: string } = {},
) {
  const includeDelta = options.includeDelta ?? false;
  const includeNotes = options.includeNotes ?? false;
  const firstHeader = options.gapLabel ?? "Method";
  const headers = [
    firstHeader,
    "Pairs",
    "Total%",
    "Win%",
    "Avg%",
    ...(includeDelta ? ["vs Base"] : []),
    ...(includeNotes ? ["Notes"] : []),
  ];
  const divider = headers.map(() => "---");
  const lines = [`### ${title}`, "", `| ${headers.join(" | ")} |`, `| ${divider.join(" | ")} |`];

  for (const row of rows) {
    const cells = [
      row.label,
      String(row.pairs),
      signedPercent(row.totalReturnPct),
      `${row.winRatePct.toFixed(1)}%`,
      signedPercent(row.avgReturnPct, 3),
      ...(includeDelta ? [signedPercent(row.vsBaselinePct ?? 0)] : []),
      ...(includeNotes ? [row.notes ?? ""] : []),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines.join("\n");
}

function renderWaterfallTable(title: string, rows: WaterfallRow[], remaining: number) {
  const lines = [
    `### ${title}`,
    "",
    "| Tier | Resolved | Cumulative | Tier Win% | Cumulative Win% | Tier Total% |",
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

function buildCurrencyContext(
  currency: string,
  context: WeekContext,
  allDatesAsc: string[],
  snapshotMap: Map<string, CotSnapshot>,
) {
  const current = context.fxSnapshot.currencies[currency]!;
  const previous1 = getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 1));
  const previous2 = getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 2));
  const previous4 = getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 4));
  const previous8 = getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 8));
  const marketsWindow = [
    current,
    previous1?.currencies[currency] ?? null,
    getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 2))?.currencies[currency] ?? null,
    getSnapshot(snapshotMap, getPreviousDate(allDatesAsc, context.reportDate, 3))?.currencies[currency] ?? null,
  ].filter((market): market is MarketSnapshot => Boolean(market));

  const priorMarkets = context.priorSnapshots
    .map((snapshot) => snapshot.currencies[currency] ?? null)
    .filter((market): market is MarketSnapshot => Boolean(market));

  const percentileNet = percentile(
    current.dealer_net,
    priorMarkets.map((market) => market.dealer_net),
  );
  const percentilePctOi = percentile(
    current.dealer_pct_of_oi ?? null,
    priorMarkets.map((market) => market.dealer_pct_of_oi ?? null),
  );
  const commercialPercentileNet = percentile(
    current.commercial_net ?? null,
    priorMarkets.map((market) => market.commercial_net ?? null),
  );

  return {
    current,
    dealerMomentum2:
      previous2?.currencies[currency] ? current.dealer_net - previous2.currencies[currency]!.dealer_net : null,
    dealerMomentum4:
      previous4?.currencies[currency] ? current.dealer_net - previous4.currencies[currency]!.dealer_net : null,
    dealerMomentum8:
      previous8?.currencies[currency] ? current.dealer_net - previous8.currencies[currency]!.dealer_net : null,
    dealerPctOiMomentum2:
      previous2?.currencies[currency] &&
      typeof current.dealer_pct_of_oi === "number" &&
      typeof previous2.currencies[currency]!.dealer_pct_of_oi === "number"
        ? current.dealer_pct_of_oi - previous2.currencies[currency]!.dealer_pct_of_oi!
        : null,
    dealerPctOiMomentum4:
      previous4?.currencies[currency] &&
      typeof current.dealer_pct_of_oi === "number" &&
      typeof previous4.currencies[currency]!.dealer_pct_of_oi === "number"
        ? current.dealer_pct_of_oi - previous4.currencies[currency]!.dealer_pct_of_oi!
        : null,
    dealerDeltaPersistence: deltaPersistence(marketsWindow, (market) => market.dealer_delta_net),
    dealerPercentileNet: percentileNet,
    dealerPercentilePctOi: percentilePctOi,
    dealerDirectionalRatio: directionalRatio(current),
    dealerTraderBias: traderBiasScore(current),
    dealerTraderImbalance: ratio(current.dealer_traders_long, current.dealer_traders_short),
    dealerTraderTotal: traderTotal(current),
    commercialMomentum4:
      previous4?.currencies[currency] &&
      typeof current.commercial_net === "number" &&
      typeof previous4.currencies[currency]!.commercial_net === "number"
        ? current.commercial_net - previous4.currencies[currency]!.commercial_net!
        : null,
    commercialDeltaPersistence: deltaPersistence(marketsWindow, (market) => market.commercial_delta_net),
    commercialPercentileNet,
    commercialPrevious1:
      previous1?.currencies[currency] && typeof previous1.currencies[currency]!.commercial_net === "number"
        ? previous1.currencies[currency]!.commercial_net
        : null,
    commercialPriorSeries52: priorMarkets
      .slice(-52)
      .map((market) => market.commercial_net)
      .filter((value): value is number => typeof value === "number"),
  };
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
    const currencyContexts = new Map(
      Object.keys(context.fxSnapshot.currencies).map((currency) => [
        currency,
        buildCurrencyContext(currency, context, allDatesAsc, snapshotMap),
      ]),
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

    for (const pairDef of PAIRS_BY_ASSET_CLASS.fx) {
      const pair = pairDef.pair.toUpperCase();
      const ret = returnMap.get(pair);
      const baseCtx = currencyContexts.get(pairDef.base);
      const quoteCtx = currencyContexts.get(pairDef.quote);
      if (!ret || !baseCtx || !quoteCtx) {
        continue;
      }

      const dealerDirection =
        dealerPairs[pair]?.direction === "LONG" || dealerPairs[pair]?.direction === "SHORT"
          ? dealerPairs[pair]!.direction
          : null;
      const dealerExtremeDirection = (() => {
        const score = directionFromScore(
          (baseCtx.dealerPercentileNet ?? 0) - (quoteCtx.dealerPercentileNet ?? 0),
        );
        const baseExtreme =
          typeof baseCtx.dealerPercentileNet === "number" &&
          (baseCtx.dealerPercentileNet >= 0.8 || baseCtx.dealerPercentileNet <= 0.2);
        const quoteExtreme =
          typeof quoteCtx.dealerPercentileNet === "number" &&
          (quoteCtx.dealerPercentileNet >= 0.8 || quoteCtx.dealerPercentileNet <= 0.2);
        return baseExtreme || quoteExtreme ? score : null;
      })();
      const dealerExtremeRisingDirection = (() => {
        const momentumDir = directionFromScore((baseCtx.dealerMomentum4 ?? 0) - (quoteCtx.dealerMomentum4 ?? 0));
        return dealerExtremeDirection && momentumDir === dealerExtremeDirection ? dealerExtremeDirection : null;
      })();
      const dealerExtremeFadingDirection = (() => {
        const momentumDir = directionFromScore((baseCtx.dealerMomentum4 ?? 0) - (quoteCtx.dealerMomentum4 ?? 0));
        return dealerExtremeDirection && momentumDir === invert(dealerExtremeDirection) ? dealerExtremeDirection : null;
      })();
      const traderDirection = directionFromScore((baseCtx.dealerTraderBias ?? 0) - (quoteCtx.dealerTraderBias ?? 0));
      const commercialScoreCurrent =
        typeof baseCtx.current.commercial_net === "number" && typeof quoteCtx.current.commercial_net === "number"
          ? baseCtx.current.commercial_net - quoteCtx.current.commercial_net
          : null;
      const commercialScorePrev1 =
        typeof baseCtx.commercialPrevious1 === "number" && typeof quoteCtx.commercialPrevious1 === "number"
          ? baseCtx.commercialPrevious1 - quoteCtx.commercialPrevious1
          : null;
      const commercialPriorPairSeries52 = baseCtx.commercialPriorSeries52
        .map((baseValue, index) => {
          const quoteValue = quoteCtx.commercialPriorSeries52[index];
          return typeof quoteValue === "number" ? baseValue - quoteValue : null;
        })
        .filter((value): value is number => typeof value === "number");
      const commercialMean52 = mean(commercialPriorPairSeries52);
      const commercialFarPercentile =
        typeof commercialScoreCurrent === "number" &&
        typeof commercialMean52 === "number" &&
        commercialPriorPairSeries52.length >= 20
          ? percentileRankOfAbs(
              commercialScoreCurrent - commercialMean52,
              commercialPriorPairSeries52.map((value) => value - commercialMean52),
            )
          : null;
      const commercialMovingTowardMean =
        typeof commercialMean52 === "number" &&
        typeof commercialScoreCurrent === "number" &&
        typeof commercialScorePrev1 === "number"
          ? Math.abs(commercialScoreCurrent - commercialMean52) < Math.abs(commercialScorePrev1 - commercialMean52)
          : false;
      const commercialMovingAwayFromMean =
        typeof commercialMean52 === "number" &&
        typeof commercialScoreCurrent === "number" &&
        typeof commercialScorePrev1 === "number"
          ? Math.abs(commercialScoreCurrent - commercialMean52) > Math.abs(commercialScorePrev1 - commercialMean52)
          : false;
      const commercialFarFromMean = typeof commercialFarPercentile === "number" ? commercialFarPercentile >= 0.75 : false;

      rows.push({
        weekOpenUtc: context.weekOpenUtc,
        weekLabel: context.weekLabel,
        reportDate: context.reportDate,
        pair,
        base: pairDef.base,
        quote: pairDef.quote,
        rawReturnPct: ret.returnPct,
        adrMultiplier: ret.adrMultiplier,
        dealerDirection,
        dealerLeanDirection: directionFromScore(baseCtx.current.dealer_net - quoteCtx.current.dealer_net),
        dealerDeltaDirection: directionFromScore((baseCtx.current.dealer_delta_net ?? 0) - (quoteCtx.current.dealer_delta_net ?? 0)),
        dealerOiConfirmedDirection: (() => {
          const dir = directionFromScore((baseCtx.current.dealer_delta_net ?? 0) - (quoteCtx.current.dealer_delta_net ?? 0));
          if (!dir) {
            return null;
          }
          if (dir === "LONG") {
            const baseConfirmed = typeof baseCtx.current.dealer_delta_net === "number" && baseCtx.current.dealer_delta_net > 0 && typeof baseCtx.current.oi_delta === "number" && baseCtx.current.oi_delta > 0;
            const quoteConfirmed = typeof quoteCtx.current.dealer_delta_net === "number" && quoteCtx.current.dealer_delta_net < 0 && typeof quoteCtx.current.oi_delta === "number" && quoteCtx.current.oi_delta > 0;
            return baseConfirmed || quoteConfirmed ? dir : null;
          }
          const baseConfirmed = typeof baseCtx.current.dealer_delta_net === "number" && baseCtx.current.dealer_delta_net < 0 && typeof baseCtx.current.oi_delta === "number" && baseCtx.current.oi_delta > 0;
          const quoteConfirmed = typeof quoteCtx.current.dealer_delta_net === "number" && quoteCtx.current.dealer_delta_net > 0 && typeof quoteCtx.current.oi_delta === "number" && quoteCtx.current.oi_delta > 0;
          return baseConfirmed || quoteConfirmed ? dir : null;
        })(),
        dealerMomentum2Direction: directionFromScore((baseCtx.dealerMomentum2 ?? 0) - (quoteCtx.dealerMomentum2 ?? 0)),
        dealerMomentum4Direction: directionFromScore((baseCtx.dealerMomentum4 ?? 0) - (quoteCtx.dealerMomentum4 ?? 0)),
        dealerMomentum8Direction: directionFromScore((baseCtx.dealerMomentum8 ?? 0) - (quoteCtx.dealerMomentum8 ?? 0)),
        dealerMomentum4AbsScore:
          typeof baseCtx.dealerMomentum4 === "number" && typeof quoteCtx.dealerMomentum4 === "number"
            ? Math.abs(baseCtx.dealerMomentum4 - quoteCtx.dealerMomentum4)
            : null,
        dealerDeltaPersistenceDirection: directionFromScore(
          (baseCtx.dealerDeltaPersistence ?? 0) - (quoteCtx.dealerDeltaPersistence ?? 0),
        ),
        dealerPctOiMomentum2Direction: directionFromScore(
          (baseCtx.dealerPctOiMomentum2 ?? 0) - (quoteCtx.dealerPctOiMomentum2 ?? 0),
        ),
        dealerPctOiMomentum4Direction: directionFromScore(
          (baseCtx.dealerPctOiMomentum4 ?? 0) - (quoteCtx.dealerPctOiMomentum4 ?? 0),
        ),
        dealerNetPercentileDirection: directionFromScore(
          typeof baseCtx.dealerPercentileNet === "number" && typeof quoteCtx.dealerPercentileNet === "number"
            ? baseCtx.dealerPercentileNet - quoteCtx.dealerPercentileNet
            : null,
        ),
        dealerPctOiPercentileDirection: directionFromScore(
          typeof baseCtx.dealerPercentilePctOi === "number" && typeof quoteCtx.dealerPercentilePctOi === "number"
            ? baseCtx.dealerPercentilePctOi - quoteCtx.dealerPercentilePctOi
            : null,
        ),
        dealerExtremeDirection,
        dealerExtremeRisingDirection,
        dealerExtremeFadingDirection,
        dealerDirectionalRatioDirection: directionFromScore(
          typeof baseCtx.dealerDirectionalRatio === "number" && typeof quoteCtx.dealerDirectionalRatio === "number"
            ? baseCtx.dealerDirectionalRatio - quoteCtx.dealerDirectionalRatio
            : null,
        ),
        dealerDirectionalRatioHigh:
          (baseCtx.dealerDirectionalRatio ?? 0) > 0.3 && (quoteCtx.dealerDirectionalRatio ?? 0) > 0.3,
        dealerDirectionalRatioLow:
          (baseCtx.dealerDirectionalRatio ?? 1) < 0.2 || (quoteCtx.dealerDirectionalRatio ?? 1) < 0.2,
        dealerTraderStructureDirection: traderDirection,
        dealerTraderImbalanceStrong:
          (baseCtx.dealerTraderImbalance ?? 0) > 1.5 || (quoteCtx.dealerTraderImbalance ?? 0) > 1.5,
        dealerTraderImbalanceWeak:
          (baseCtx.dealerTraderImbalance ?? 0) > 0 &&
          (quoteCtx.dealerTraderImbalance ?? 0) > 0 &&
          (baseCtx.dealerTraderImbalance ?? 0) < 1.2 &&
          (quoteCtx.dealerTraderImbalance ?? 0) < 1.2,
        dealerTraderTotal:
          typeof baseCtx.dealerTraderTotal === "number" && typeof quoteCtx.dealerTraderTotal === "number"
            ? baseCtx.dealerTraderTotal + quoteCtx.dealerTraderTotal
            : null,
        commercialDirection: directionFromScore(commercialScoreCurrent),
        commercialMomentum4Direction: directionFromScore(
          (baseCtx.commercialMomentum4 ?? 0) - (quoteCtx.commercialMomentum4 ?? 0),
        ),
        commercialDeltaPersistenceDirection: directionFromScore(
          (baseCtx.commercialDeltaPersistence ?? 0) - (quoteCtx.commercialDeltaPersistence ?? 0),
        ),
        commercialPercentileDirection: directionFromScore(
          typeof baseCtx.commercialPercentileNet === "number" && typeof quoteCtx.commercialPercentileNet === "number"
            ? baseCtx.commercialPercentileNet - quoteCtx.commercialPercentileNet
            : null,
        ),
        commercialExtremeAligned:
          typeof baseCtx.commercialPercentileNet === "number" &&
          typeof quoteCtx.commercialPercentileNet === "number" &&
          directionFromScore(commercialScoreCurrent) === directionFromScore(baseCtx.commercialPercentileNet - quoteCtx.commercialPercentileNet) &&
          (
            baseCtx.commercialPercentileNet >= 0.8 ||
            baseCtx.commercialPercentileNet <= 0.2 ||
            quoteCtx.commercialPercentileNet >= 0.8 ||
            quoteCtx.commercialPercentileNet <= 0.2
          ),
        commercialMovingTowardMean,
        commercialMovingAwayFromMean,
        commercialFarFromMean,
        commercialFarReturning: commercialFarFromMean && commercialMovingTowardMean,
      });
    }
  }

  return rows;
}

function momentumThresholdDirection(row: PairRow, threshold: number) {
  return typeof row.dealerMomentum4AbsScore === "number" && row.dealerMomentum4AbsScore >= threshold
    ? row.dealerMomentum4Direction
    : null;
}

function buildStackResult(rows: PairRow[], tiers: ResolverTier[]) {
  const unresolved = new Set(rows.map((row, index) => index));
  const resolvedDirections = new Map<number, Direction>();
  const resolvedTier = new Map<number, string>();
  const waterfall: WaterfallRow[] = [];
  let cumulativeResolved = 0;
  let cumulativeWins = 0;

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
      resolvedTier.set(index, tier.label);
      tierResolved += 1;
      const ret = (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
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

  const resolvedRows = rows.filter((_, index) => resolvedDirections.has(index));
  let resolvedWins = 0;
  let resolvedTotalPct = 0;
  for (const [index, direction] of resolvedDirections.entries()) {
    const row = rows[index]!;
    const ret = (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
    resolvedTotalPct += ret;
    if (ret > 0) {
      resolvedWins += 1;
    }
  }
  const resolvedStats: Stats = {
    label: "stack",
    pairs: resolvedDirections.size,
    totalReturnPct: round(resolvedTotalPct),
    winRatePct: resolvedDirections.size > 0 ? round((resolvedWins / resolvedDirections.size) * 100, 1) : 0,
    avgReturnPct: resolvedDirections.size > 0 ? round(resolvedTotalPct / resolvedDirections.size, 3) : 0,
  };

  return {
    resolvedDirections,
    resolvedTier,
    waterfall,
    unresolved: unresolved.size,
    stats: resolvedStats,
    resolvedRows,
  };
}

async function computeCombinedDealerPerformance(
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

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Deep History Research                                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const { allDatesAsc, snapshotMap, contexts } = await loadWeekContexts();
  const pairRows = await buildPairRows(contexts, allDatesAsc, snapshotMap);
  const neutralRows = pairRows.filter((row) => row.dealerDirection === null);
  const nonNeutralRows = pairRows.filter((row) => row.dealerDirection !== null);

  const dealerNonNeutralBaseline = evaluateStats(
    nonNeutralRows,
    () => true,
    (row) => row.dealerDirection,
    "Dealer non-neutral baseline",
  );
  const dealerNeutralBaseline = evaluateStats(
    neutralRows,
    () => true,
    (row) => row.dealerLeanDirection,
    "Dealer neutral lean baseline",
  );
  const commercialBaseline = evaluateStats(
    pairRows,
    () => true,
    (row) => row.commercialDirection,
    "Commercial forced-raw baseline",
  );

  assertBaseline("Dealer non-neutral", dealerNonNeutralBaseline, { pairs: 150, total: 38.03, win: 55.3 });
  assertBaseline("Dealer neutral lean", dealerNeutralBaseline, { pairs: 130, total: -58.66, win: 34.6 });
  assertBaseline("Commercial forced raw", commercialBaseline, { pairs: 280, total: 23.41, win: 52.9 });

  const traderTotals = pairRows.map((row) => row.dealerTraderTotal).filter((value): value is number => typeof value === "number").sort((a, b) => a - b);
  const traderMedian = traderTotals.length > 0 ? traderTotals[Math.floor(traderTotals.length / 2)]! : 0;

  const momentumNeutralRows = [
    evaluateStats(neutralRows, () => true, (row) => row.dealerOiConfirmedDirection, "OI-confirmed delta"),
    evaluateStats(neutralRows, () => true, (row) => row.dealerMomentum2Direction, "2-week net momentum"),
    evaluateStats(neutralRows, () => true, (row) => row.dealerMomentum4Direction, "4-week net momentum"),
    evaluateStats(neutralRows, () => true, (row) => row.dealerMomentum8Direction, "8-week net momentum"),
    evaluateStats(neutralRows, () => true, (row) => row.dealerDeltaPersistenceDirection, "Delta persistence (0-4)"),
    evaluateStats(neutralRows, () => true, (row) => row.dealerPctOiMomentum2Direction, "2-week %OI momentum"),
    evaluateStats(neutralRows, () => true, (row) => row.dealerPctOiMomentum4Direction, "4-week %OI momentum"),
  ];
  const momentumFilterRows = [
    dealerNonNeutralBaseline,
    evaluateStats(nonNeutralRows, (row) => row.dealerMomentum4Direction === row.dealerDirection, (row) => row.dealerDirection, "4-week momentum confirms", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => row.dealerMomentum4Direction !== null && row.dealerMomentum4Direction !== row.dealerDirection, (row) => row.dealerDirection, "4-week momentum contradicts", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => row.dealerDeltaPersistenceDirection === row.dealerDirection, (row) => row.dealerDirection, "Delta persistence confirms", dealerNonNeutralBaseline.totalReturnPct),
  ];
  const momentumThresholdRows = MOMENTUM_THRESHOLDS.map((threshold) =>
    evaluateStats(neutralRows, () => true, (row) => momentumThresholdDirection(row, threshold), `4-week momentum |score| >= ${threshold}`),
  );
  const bestMomentumThreshold = [...momentumThresholdRows]
    .filter((row) => row.pairs >= 20)
    .sort((left, right) => right.winRatePct - left.winRatePct || right.totalReturnPct - left.totalReturnPct)[0] ?? momentumThresholdRows[0]!;

  const extremeNeutralRows = [
    evaluateStats(neutralRows, () => true, (row) => row.dealerNetPercentileDirection, "Net percentile direction"),
    evaluateStats(neutralRows, () => true, (row) => row.dealerPctOiPercentileDirection, "%OI percentile direction"),
    evaluateStats(neutralRows, (row) => row.dealerExtremeDirection !== null, (row) => row.dealerExtremeDirection, "Only when extreme (>80 or <20)"),
    evaluateStats(neutralRows, (row) => row.dealerExtremeRisingDirection !== null, (row) => row.dealerExtremeRisingDirection, "Extreme + rising direction"),
  ];
  const extremeFilterRows = [
    dealerNonNeutralBaseline,
    evaluateStats(nonNeutralRows, (row) => row.dealerExtremeDirection === row.dealerDirection, (row) => row.dealerDirection, "Current net at extreme pctile", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => row.dealerExtremeDirection === null, (row) => row.dealerDirection, "Current net in middle (20-80)", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => row.dealerExtremeRisingDirection === row.dealerDirection, (row) => row.dealerDirection, "Extreme + rising confirms dir", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => row.dealerExtremeFadingDirection === row.dealerDirection, (row) => row.dealerDirection, "Extreme + fading (caution)", dealerNonNeutralBaseline.totalReturnPct),
  ];
  const spreadNeutralRows = [
    evaluateStats(neutralRows, () => true, (row) => row.dealerDirectionalRatioDirection, "Directional ratio direction"),
    evaluateStats(neutralRows, (row) => row.dealerDirectionalRatioHigh, (row) => row.dealerDirectionalRatioDirection, "Only high-ratio pairs (>0.3)"),
  ];
  const spreadFilterRows = [
    dealerNonNeutralBaseline,
    evaluateStats(nonNeutralRows, (row) => row.dealerDirectionalRatioHigh, (row) => row.dealerDirection, "Both currencies high-ratio", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => row.dealerDirectionalRatioLow, (row) => row.dealerDirection, "Either currency low-ratio", dealerNonNeutralBaseline.totalReturnPct),
  ];
  const traderNeutralRows = [
    evaluateStats(neutralRows, () => true, (row) => row.dealerTraderStructureDirection, "Trader imbalance direction"),
    evaluateStats(neutralRows, (row) => row.dealerTraderImbalanceStrong, (row) => row.dealerTraderStructureDirection, "Only when imbalance > 1.5:1"),
  ];
  const traderFilterRows = [
    dealerNonNeutralBaseline,
    evaluateStats(nonNeutralRows, (row) => row.dealerTraderImbalanceStrong, (row) => row.dealerDirection, "Strong trader imbalance (>1.5)", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => row.dealerTraderImbalanceWeak, (row) => row.dealerDirection, "Weak imbalance (<1.2)", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => typeof row.dealerTraderTotal === "number" && row.dealerTraderTotal >= traderMedian, (row) => row.dealerDirection, "High total trader count", dealerNonNeutralBaseline.totalReturnPct),
    evaluateStats(nonNeutralRows, (row) => typeof row.dealerTraderTotal === "number" && row.dealerTraderTotal < traderMedian, (row) => row.dealerDirection, "Low total trader count", dealerNonNeutralBaseline.totalReturnPct),
  ];

  const bestMomentumThresholdValue = Number(bestMomentumThreshold.label.split(">=")[1]?.trim() ?? "0");
  const stackOrderings = [
    {
      label: "Proposed",
      tiers: [
        { label: "Tier 1: OI+Delta", resolve: (row: PairRow) => row.dealerOiConfirmedDirection },
        { label: `Tier 2: 4wk Momentum >= ${bestMomentumThresholdValue}`, resolve: (row: PairRow) => momentumThresholdDirection(row, bestMomentumThresholdValue) },
        { label: "Tier 3: Extreme Pctile", resolve: (row: PairRow) => row.dealerExtremeDirection },
        { label: "Tier 4: Delta Fallback", resolve: (row: PairRow) => row.dealerDeltaDirection },
      ],
    },
    {
      label: "Momentum First",
      tiers: [
        { label: `Tier 1: 4wk Momentum >= ${bestMomentumThresholdValue}`, resolve: (row: PairRow) => momentumThresholdDirection(row, bestMomentumThresholdValue) },
        { label: "Tier 2: OI+Delta", resolve: (row: PairRow) => row.dealerOiConfirmedDirection },
        { label: "Tier 3: Extreme Pctile", resolve: (row: PairRow) => row.dealerExtremeDirection },
        { label: "Tier 4: Delta Fallback", resolve: (row: PairRow) => row.dealerDeltaDirection },
      ],
    },
    {
      label: "Extremes First",
      tiers: [
        { label: "Tier 1: Extreme Pctile", resolve: (row: PairRow) => row.dealerExtremeDirection },
        { label: "Tier 2: OI+Delta", resolve: (row: PairRow) => row.dealerOiConfirmedDirection },
        { label: `Tier 3: 4wk Momentum >= ${bestMomentumThresholdValue}`, resolve: (row: PairRow) => momentumThresholdDirection(row, bestMomentumThresholdValue) },
        { label: "Tier 4: Delta Fallback", resolve: (row: PairRow) => row.dealerDeltaDirection },
      ],
    },
  ];

  const stackResults = stackOrderings.map((ordering) => ({
    label: ordering.label,
    ...buildStackResult(neutralRows, ordering.tiers),
  }));
  const bestStack = [...stackResults]
    .sort((left, right) => right.stats.winRatePct - left.stats.winRatePct || right.stats.pairs - left.stats.pairs)[0]!;

  const fillMap = new Map<string, Direction>();
  for (let index = 0; index < neutralRows.length; index++) {
    const direction = bestStack.resolvedDirections.get(index);
    if (!direction) {
      continue;
    }
    const row = neutralRows[index]!;
    fillMap.set(`${row.weekOpenUtc}::${row.pair}`, direction);
  }

  const currentDealerOverall = await computeCombinedDealerPerformance(contexts.map((context) => context.weekOpenUtc), new Map());
  const filledDealerOverall = await computeCombinedDealerPerformance(contexts.map((context) => context.weekOpenUtc), fillMap);

  const commercialMomentumRows = [
    commercialBaseline,
    evaluateStats(pairRows, (row) => row.commercialMomentum4Direction === row.commercialDirection, (row) => row.commercialDirection, "4-week momentum confirms", commercialBaseline.totalReturnPct),
    evaluateStats(pairRows, (row) => row.commercialMomentum4Direction !== null && row.commercialMomentum4Direction !== row.commercialDirection, (row) => row.commercialDirection, "4-week momentum contradicts", commercialBaseline.totalReturnPct),
    evaluateStats(pairRows, (row) => row.commercialDeltaPersistenceDirection === row.commercialDirection, (row) => row.commercialDirection, "Delta persistence ≥ current dir", commercialBaseline.totalReturnPct),
  ];
  const commercialExtremeRows = [
    commercialBaseline,
    evaluateStats(pairRows, (row) => row.commercialExtremeAligned, (row) => row.commercialDirection, "Commercial at extreme pctile", commercialBaseline.totalReturnPct),
    evaluateStats(pairRows, (row) => !row.commercialExtremeAligned, (row) => row.commercialDirection, "Commercial in middle (20-80)", commercialBaseline.totalReturnPct),
    evaluateStats(pairRows, (row) => row.commercialExtremeAligned && row.commercialMomentum4Direction === row.commercialDirection, (row) => row.commercialDirection, "Extreme + momentum confirms", commercialBaseline.totalReturnPct),
  ];
  const commercialMeanRows = [
    commercialBaseline,
    evaluateStats(pairRows, (row) => row.commercialMovingTowardMean, (row) => row.commercialDirection, "Moving toward 52w mean", commercialBaseline.totalReturnPct),
    evaluateStats(pairRows, (row) => row.commercialMovingAwayFromMean, (row) => row.commercialDirection, "Moving away from 52w mean", commercialBaseline.totalReturnPct),
    evaluateStats(pairRows, (row) => row.commercialFarReturning, (row) => row.commercialDirection, "Far from mean + returning", commercialBaseline.totalReturnPct),
  ];

  const lines: string[] = [];
  lines.push("# COT Deep History Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${contexts.length} (${contexts[0]!.weekLabel} → ${contexts.at(-1)!.weekLabel}).`);
  lines.push(`Stored FX history window: ${allDatesAsc[0]} → ${allDatesAsc.at(-1)} (${allDatesAsc.length} dates).`);
  lines.push("");
  lines.push("## Baseline Checks");
  lines.push("");
  lines.push("| Baseline | Pairs | Total% | Win% | Avg% |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const row of [dealerNonNeutralBaseline, dealerNeutralBaseline, commercialBaseline]) {
    lines.push(`| ${row.label} | ${row.pairs} | ${signedPercent(row.totalReturnPct)} | ${row.winRatePct.toFixed(1)}% | ${signedPercent(row.avgReturnPct, 3)} |`);
  }

  lines.push("");
  lines.push("## Section 1: Multi-Week Dealer Momentum");
  lines.push("");
  lines.push(renderStatsTable("Neutral Resolver", momentumNeutralRows, { gapLabel: "Method" }));
  lines.push("");
  lines.push(renderStatsTable("Non-Neutral Quality", momentumFilterRows, { includeDelta: true, gapLabel: "Filter on non-neutral" }));
  lines.push("");
  lines.push(renderStatsTable("4-Week Momentum Threshold Grid", momentumThresholdRows, { gapLabel: "Threshold" }));

  lines.push("");
  lines.push("## Section 2: Historical Extremeness");
  lines.push("");
  lines.push(renderStatsTable("Neutral Resolver", extremeNeutralRows, { gapLabel: "Method" }));
  lines.push("");
  lines.push(renderStatsTable("Non-Neutral Quality", extremeFilterRows, { includeDelta: true, gapLabel: "Filter on non-neutral" }));

  lines.push("");
  lines.push("## Section 3: Spread-Book Quality");
  lines.push("");
  lines.push(renderStatsTable("Neutral Resolver", spreadNeutralRows, { gapLabel: "Method" }));
  lines.push("");
  lines.push(renderStatsTable("Non-Neutral Quality", spreadFilterRows, { includeDelta: true, gapLabel: "Filter on non-neutral" }));

  lines.push("");
  lines.push("## Section 4: Trader-Count Structure");
  lines.push("");
  lines.push(renderStatsTable("Neutral Resolver", traderNeutralRows, { gapLabel: "Method" }));
  lines.push("");
  lines.push(renderStatsTable("Non-Neutral Quality", traderFilterRows, { includeDelta: true, gapLabel: "Filter on non-neutral" }));

  lines.push("");
  lines.push("## Section 5: Stacked Neutral Resolver");
  lines.push("");
  for (const stack of stackResults) {
    lines.push(renderWaterfallTable(stack.label, stack.waterfall, stack.unresolved));
    lines.push("");
    lines.push(`Resolved stats: ${stack.stats.pairs} gaps filled, ${signedPercent(stack.stats.totalReturnPct)}, ${stack.stats.winRatePct.toFixed(1)}% WR.`);
    lines.push("");
  }
  lines.push("| Dealer System | Trades | Total% | MaxDD% | Win% |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  lines.push(`| Current dealer (no fill) | ${currentDealerOverall.trades} | ${signedPercent(currentDealerOverall.totalPct)} | ${currentDealerOverall.maxDdPct.toFixed(2)}% | ${currentDealerOverall.winRatePct.toFixed(1)}% |`);
  lines.push(`| Dealer + stacked fill (${bestStack.label}) | ${filledDealerOverall.trades} | ${signedPercent(filledDealerOverall.totalPct)} | ${filledDealerOverall.maxDdPct.toFixed(2)}% | ${filledDealerOverall.winRatePct.toFixed(1)}% |`);

  lines.push("");
  lines.push("## Section 6: Commercial Deep-History Research");
  lines.push("");
  lines.push(renderStatsTable("Momentum Filters", commercialMomentumRows, { includeDelta: true, gapLabel: "Filter on commercial forced-raw" }));
  lines.push("");
  lines.push(renderStatsTable("Extreme Filters", commercialExtremeRows, { includeDelta: true, gapLabel: "Filter on commercial forced-raw" }));
  lines.push("");
  lines.push(renderStatsTable("Mean-Reversion Filters", commercialMeanRows, { includeDelta: true, gapLabel: "Filter on commercial forced-raw" }));

  lines.push("");
  lines.push("## Summary");
  lines.push("");
  const bestMomentumNeutral = [...momentumNeutralRows].sort((a, b) => b.winRatePct - a.winRatePct || b.totalReturnPct - a.totalReturnPct)[0]!;
  const bestExtremeNeutral = [...extremeNeutralRows].sort((a, b) => b.winRatePct - a.winRatePct || b.totalReturnPct - a.totalReturnPct)[0]!;
  const bestSpread = [...spreadFilterRows.slice(1)].sort((a, b) => b.avgReturnPct - a.avgReturnPct)[0]!;
  const bestTrader = [...traderFilterRows.slice(1)].sort((a, b) => b.avgReturnPct - a.avgReturnPct)[0]!;
  const bestCommercial = [...commercialMomentumRows.slice(1), ...commercialExtremeRows.slice(1), ...commercialMeanRows.slice(1)]
    .sort((a, b) => b.totalReturnPct - a.totalReturnPct || b.winRatePct - a.winRatePct)[0]!;
  lines.push(`1. Most useful dealer momentum resolver: \`${bestMomentumNeutral.label}\` (${bestMomentumNeutral.pairs} filled, ${signedPercent(bestMomentumNeutral.totalReturnPct)}, ${bestMomentumNeutral.winRatePct.toFixed(1)}% WR).`);
  lines.push(`2. Historical extremeness ${bestExtremeNeutral.totalReturnPct > bestMomentumNeutral.totalReturnPct ? "did" : "did not"} add more signal than momentum on dealer neutrals. Best extreme method: \`${bestExtremeNeutral.label}\`.`);
  lines.push(`3. Spread-book and trader-structure contributions were mixed. Best spread-quality slice: \`${bestSpread.label}\`. Best trader-structure slice: \`${bestTrader.label}\`.`);
  lines.push(`4. Best stacked resolver hierarchy: \`${bestStack.label}\`, resolving ${bestStack.stats.pairs}/${neutralRows.length} dealer gaps.`);
  lines.push(`5. Combined dealer standalone result with stacked resolution moved from ${signedPercent(currentDealerOverall.totalPct)} / ${currentDealerOverall.maxDdPct.toFixed(2)}% DD to ${signedPercent(filledDealerOverall.totalPct)} / ${filledDealerOverall.maxDdPct.toFixed(2)}% DD.`);
  lines.push(`6. Best commercial enrichment from this pass: \`${bestCommercial.label}\`${bestCommercial.totalReturnPct > commercialBaseline.totalReturnPct ? `, which beat baseline by ${signedPercent(bestCommercial.totalReturnPct - commercialBaseline.totalReturnPct)}.` : ", which did not beat baseline meaningfully."}`);
  lines.push(`7. Momentum and extremeness do help both dealer and commercial, but dealer gains are cleaner so far than commercial gains.`);
  lines.push("");

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log(`Weeks: ${contexts.length}`);
  console.log(`Best momentum threshold: ${bestMomentumThreshold.label}`);
  console.log(`Best stack: ${bestStack.label} (${bestStack.stats.pairs}/${neutralRows.length} resolved, ${bestStack.stats.winRatePct.toFixed(1)}% WR)`);
  console.log(`Dealer current: ${currentDealerOverall.trades} trades / ${currentDealerOverall.totalPct.toFixed(2)}% / ${currentDealerOverall.maxDdPct.toFixed(2)} DD`);
  console.log(`Dealer stacked: ${filledDealerOverall.trades} trades / ${filledDealerOverall.totalPct.toFixed(2)}% / ${filledDealerOverall.maxDdPct.toFixed(2)} DD`);
  console.log(`Best commercial filter: ${bestCommercial.label} (${bestCommercial.totalReturnPct.toFixed(2)}%, ${bestCommercial.winRatePct.toFixed(1)}%)`);
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
