/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: audit-data-integrity.ts
 *
 * Description:
 * Read-only diagnostic audit for canonical weekly signal coverage, price
 * coverage, signal/price cross-reference gaps, and weekly-hold engine trade
 * counts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getPool, query } from "../src/lib/db";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import {
  filterByModel,
  getCanonicalBasketWeek,
  type BaseBasketModel,
  type BasketDirection,
  type CanonicalBasketSignal,
} from "../src/lib/performance/basketSource";
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import { getEntryStyle, getStrategy } from "../src/lib/performance/strategyConfig";

type WeekRow = {
  period_open_utc: Date;
};

type PriceRow = {
  symbol: string;
  asset_class: AssetClass;
  return_pct: number | string;
  open_price: number | string;
  close_price: number | string;
};

type CanonicalPair = {
  symbol: string;
  assetClass: AssetClass;
};

type SignalCoverage = {
  weekOpenUtc: string;
  emittedCount: number;
  longCount: number;
  shortCount: number;
  neutralCount: number;
  missingCount: number;
  neutralPairs: string[];
  missingPairs: string[];
  signalMap: Map<string, CanonicalBasketSignal>;
};

type PriceCoverage = {
  weekOpenUtc: string;
  rowCount: number;
  coveredCount: number;
  missingPairs: string[];
  extraPairs: string[];
  duplicatePairs: string[];
  priceMap: Map<string, PriceRow>;
};

type CrossGap = {
  source: BaseBasketModel;
  weekOpenUtc: string;
  directionNoPrice: string[];
  priceNeutralOrMissingSignal: string[];
};

type EngineCheck = {
  strategyId: string;
  weekOpenUtc: string;
  tradeCount: number | null;
  expectedTrades: number | null;
  totalReturnPct: number | null;
  winCount: number | null;
  lossCount: number | null;
  error: string | null;
};

const BASE_SOURCES: BaseBasketModel[] = ["dealer", "commercial", "sentiment", "strength"];
const STRATEGY_IDS = ["dealer", "selector_frag3", "agree_3of4"] as const;
const DIRECTIONAL: ReadonlySet<BasketDirection> = new Set(["LONG", "SHORT"]);

function canonicalPairs(): CanonicalPair[] {
  const orderedAssetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  return orderedAssetClasses.flatMap((assetClass) =>
    (PAIRS_BY_ASSET_CLASS[assetClass] ?? []).map((pairDef) => ({
      symbol: pairDef.pair.toUpperCase(),
      assetClass,
    })),
  );
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function weekLabel(weekOpenUtc: string): string {
  return weekOpenUtc.slice(0, 10);
}

function signedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function status(ok: boolean): string {
  return ok ? "OK" : "FAIL";
}

function countDirections(signals: CanonicalBasketSignal[]) {
  return signals.reduce(
    (counts, signal) => {
      if (signal.direction === "LONG") counts.longCount += 1;
      else if (signal.direction === "SHORT") counts.shortCount += 1;
      else counts.neutralCount += 1;
      return counts;
    },
    { longCount: 0, shortCount: 0, neutralCount: 0 },
  );
}

async function listWeeklyPeriods(): Promise<string[]> {
  const rows = await query<WeekRow>(
    `SELECT DISTINCT period_open_utc
       FROM pair_period_returns
      WHERE period_type = 'weekly'
      ORDER BY period_open_utc DESC`,
    [],
  );
  return rows.map((row) => toIso(row.period_open_utc));
}

async function loadPriceCoverage(
  weekOpenUtc: string,
  canonical: CanonicalPair[],
): Promise<PriceCoverage> {
  const rows = await query<PriceRow>(
    `SELECT symbol, asset_class, return_pct, open_price, close_price
       FROM pair_period_returns
      WHERE period_type = 'weekly'
        AND period_open_utc = $1::timestamptz
      ORDER BY asset_class, symbol`,
    [weekOpenUtc],
  );

  const canonicalSet = new Set(canonical.map((pair) => pair.symbol));
  const seen = new Set<string>();
  const duplicateSet = new Set<string>();
  const priceMap = new Map<string, PriceRow>();

  for (const row of rows) {
    const symbol = row.symbol.toUpperCase();
    if (seen.has(symbol)) {
      duplicateSet.add(symbol);
    }
    seen.add(symbol);
    priceMap.set(symbol, row);
  }

  const missingPairs = canonical
    .map((pair) => pair.symbol)
    .filter((symbol) => !priceMap.has(symbol));
  const extraPairs = Array.from(priceMap.keys())
    .filter((symbol) => !canonicalSet.has(symbol))
    .sort();

  return {
    weekOpenUtc,
    rowCount: rows.length,
    coveredCount: canonical.length - missingPairs.length,
    missingPairs,
    extraPairs,
    duplicatePairs: Array.from(duplicateSet).sort(),
    priceMap,
  };
}

function buildSignalCoverage(
  weekOpenUtc: string,
  source: BaseBasketModel,
  signals: CanonicalBasketSignal[],
  canonical: CanonicalPair[],
): SignalCoverage {
  const signalMap = new Map<string, CanonicalBasketSignal>();
  for (const signal of signals) {
    signalMap.set(signal.symbol.toUpperCase(), signal);
  }

  const neutralPairs: string[] = [];
  const missingPairs: string[] = [];
  for (const pair of canonical) {
    const signal = signalMap.get(pair.symbol);
    if (!signal) {
      missingPairs.push(pair.symbol);
    } else if (signal.direction === "NEUTRAL") {
      neutralPairs.push(pair.symbol);
    }
  }

  const counts = countDirections(signals);
  return {
    weekOpenUtc,
    emittedCount: signals.length,
    ...counts,
    missingCount: missingPairs.length,
    neutralPairs,
    missingPairs,
    signalMap,
  };
}

function buildCrossGap(
  source: BaseBasketModel,
  signalCoverage: SignalCoverage,
  priceCoverage: PriceCoverage,
  canonical: CanonicalPair[],
): CrossGap {
  const directionNoPrice: string[] = [];
  const priceNeutralOrMissingSignal: string[] = [];

  for (const pair of canonical) {
    const signal = signalCoverage.signalMap.get(pair.symbol);
    const hasPrice = priceCoverage.priceMap.has(pair.symbol);

    if (signal && DIRECTIONAL.has(signal.direction) && !hasPrice) {
      directionNoPrice.push(`${pair.symbol}=${signal.direction}`);
      continue;
    }

    if (hasPrice && (!signal || signal.direction === "NEUTRAL")) {
      priceNeutralOrMissingSignal.push(`${pair.symbol}=${signal?.direction ?? "MISSING_SIGNAL"}`);
    }
  }

  return {
    source,
    weekOpenUtc: signalCoverage.weekOpenUtc,
    directionNoPrice,
    priceNeutralOrMissingSignal,
  };
}

async function runEngineCheck(
  strategyId: typeof STRATEGY_IDS[number],
  weekOpenUtc: string,
  canonicalCount: number,
): Promise<EngineCheck> {
  const strategy = getStrategy(strategyId);
  const entryStyle = getEntryStyle("weekly_hold");
  if (!strategy || !entryStyle) {
    return {
      strategyId,
      weekOpenUtc,
      tradeCount: null,
      expectedTrades: null,
      totalReturnPct: null,
      winCount: null,
      lossCount: null,
      error: `Missing strategy or weekly_hold entry style for ${strategyId}`,
    };
  }

  try {
    const result = await computeWeeklyHold(strategy, weekOpenUtc, entryStyle);
    const expectedTrades = strategyId === "dealer" ? canonicalCount : result.signals.length;
    return {
      strategyId,
      weekOpenUtc,
      tradeCount: result.tradeCount,
      expectedTrades,
      totalReturnPct: result.totalReturnPct,
      winCount: result.winCount,
      lossCount: result.lossCount,
      error: null,
    };
  } catch (error) {
    return {
      strategyId,
      weekOpenUtc,
      tradeCount: null,
      expectedTrades: null,
      totalReturnPct: null,
      winCount: null,
      lossCount: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printSignalCoverage(
  signalCoverageBySource: Map<BaseBasketModel, SignalCoverage[]>,
  canonicalCount: number,
) {
  console.log("--- SIGNAL COVERAGE ---");
  for (const source of BASE_SOURCES) {
    console.log(`Source: ${source}`);
    for (const coverage of signalCoverageBySource.get(source) ?? []) {
      const directionalCount = coverage.longCount + coverage.shortCount;
      const ok =
        coverage.emittedCount === canonicalCount
        && coverage.neutralCount === 0
        && coverage.missingCount === 0;
      const details: string[] = [];
      if (coverage.neutralPairs.length > 0) {
        details.push(`NEUTRAL: ${formatList(coverage.neutralPairs)}`);
      }
      if (coverage.missingPairs.length > 0) {
        details.push(`MISSING_SIGNAL: ${formatList(coverage.missingPairs)}`);
      }
      console.log(
        `  ${weekLabel(coverage.weekOpenUtc)}: ${directionalCount}/${canonicalCount} ${status(ok)}`
        + ` (emitted=${coverage.emittedCount}, long=${coverage.longCount}, short=${coverage.shortCount}, neutral=${coverage.neutralCount})`
        + (details.length > 0 ? ` [${details.join("; ")}]` : ""),
      );
    }
    console.log("");
  }
}

function printPriceCoverage(priceCoverages: PriceCoverage[], canonicalCount: number) {
  console.log("--- PRICE RETURN COVERAGE ---");
  for (const coverage of priceCoverages) {
    const ok =
      coverage.coveredCount === canonicalCount
      && coverage.extraPairs.length === 0
      && coverage.duplicatePairs.length === 0;
    const details: string[] = [];
    if (coverage.missingPairs.length > 0) details.push(`MISSING: ${formatList(coverage.missingPairs)}`);
    if (coverage.extraPairs.length > 0) details.push(`EXTRA: ${formatList(coverage.extraPairs)}`);
    if (coverage.duplicatePairs.length > 0) details.push(`DUPLICATE: ${formatList(coverage.duplicatePairs)}`);
    console.log(
      `  ${weekLabel(coverage.weekOpenUtc)}: ${coverage.coveredCount}/${canonicalCount} ${status(ok)}`
      + ` (rows=${coverage.rowCount})`
      + (details.length > 0 ? ` [${details.join("; ")}]` : ""),
    );
  }
  console.log("");
}

function printCrossReference(crossGaps: CrossGap[]) {
  console.log("--- CROSS-REFERENCE (signals vs prices) ---");
  let printed = false;
  for (const gap of crossGaps) {
    if (gap.directionNoPrice.length === 0 && gap.priceNeutralOrMissingSignal.length === 0) {
      continue;
    }
    printed = true;
    if (gap.directionNoPrice.length > 0) {
      console.log(
        `  ${gap.source} x ${weekLabel(gap.weekOpenUtc)}: ${gap.directionNoPrice.length} direction signal(s) with no price [${formatList(gap.directionNoPrice)}]`,
      );
    }
    if (gap.priceNeutralOrMissingSignal.length > 0) {
      console.log(
        `  ${gap.source} x ${weekLabel(gap.weekOpenUtc)}: ${gap.priceNeutralOrMissingSignal.length} priced pair(s) with neutral/missing signal [${formatList(gap.priceNeutralOrMissingSignal)}]`,
      );
    }
  }
  if (!printed) {
    console.log("  No signal/price cross-reference gaps found.");
  }
  console.log("");
}

function printEngineChecks(engineChecks: EngineCheck[]) {
  console.log("--- ENGINE TRADE COUNTS ---");
  for (const strategyId of STRATEGY_IDS) {
    console.log(`Strategy: ${strategyId}`);
    for (const check of engineChecks.filter((entry) => entry.strategyId === strategyId)) {
      if (check.error) {
        console.log(`  ${weekLabel(check.weekOpenUtc)}: ERROR [${check.error}]`);
        continue;
      }
      const expected = check.expectedTrades ?? 0;
      const tradeCount = check.tradeCount ?? 0;
      const ok = tradeCount >= expected;
      console.log(
        `  ${weekLabel(check.weekOpenUtc)}: ${tradeCount} trades, `
        + `${signedPct(check.totalReturnPct ?? 0)}, wins=${check.winCount}, losses=${check.lossCount} ${status(ok)}`
        + (ok ? "" : ` (expected ${expected})`),
      );
    }
    console.log("");
  }
}

function printSummary(params: {
  signalCoverageBySource: Map<BaseBasketModel, SignalCoverage[]>;
  priceCoverages: PriceCoverage[];
  crossGaps: CrossGap[];
  engineChecks: EngineCheck[];
  canonicalCount: number;
}) {
  const signalGapCount = Array.from(params.signalCoverageBySource.values())
    .flat()
    .reduce((sum, coverage) => sum + coverage.neutralCount + coverage.missingCount, 0);
  const priceGapCount = params.priceCoverages.reduce(
    (sum, coverage) => sum + coverage.missingPairs.length + coverage.duplicatePairs.length,
    0,
  );
  const directionNoPriceCount = params.crossGaps.reduce(
    (sum, gap) => sum + gap.directionNoPrice.length,
    0,
  );
  const priceNeutralSignalCount = params.crossGaps.reduce(
    (sum, gap) => sum + gap.priceNeutralOrMissingSignal.length,
    0,
  );
  const engineShortfalls = params.engineChecks.filter((check) =>
    check.error || (
      check.tradeCount !== null
      && check.expectedTrades !== null
      && check.tradeCount < check.expectedTrades
    ),
  ).length;

  console.log("=== SUMMARY ===");
  console.log(`Signal gaps: ${signalGapCount} total neutral/missing source-pair weeks`);
  console.log(`Price gaps: ${priceGapCount} total missing/duplicate canonical price rows`);
  console.log(`Direction-without-price gaps: ${directionNoPriceCount}`);
  console.log(`Price-with-neutral/missing-signal gaps: ${priceNeutralSignalCount}`);
  console.log(`Engine shortfalls/errors: ${engineShortfalls} strategy-week checks`);

  const failed =
    signalGapCount > 0
    || priceGapCount > 0
    || directionNoPriceCount > 0
    || priceNeutralSignalCount > 0
    || engineShortfalls > 0;

  process.exitCode = failed ? 1 : 0;
}

async function main() {
  const canonical = canonicalPairs();
  const canonicalCount = canonical.length;
  const weeks = await listWeeklyPeriods();
  const displayWeekOpenUtc = getDisplayWeekOpenUtc();

  console.log("=== DATA INTEGRITY AUDIT ===");
  console.log(`Weeks checked: ${weeks.length}`);
  console.log(`Current display week: ${displayWeekOpenUtc}`);
  console.log(`Canonical pairs: ${canonicalCount}`);
  console.log("");

  const signalCoverageBySource = new Map<BaseBasketModel, SignalCoverage[]>(
    BASE_SOURCES.map((source) => [source, []]),
  );
  const priceCoverages: PriceCoverage[] = [];
  const crossGaps: CrossGap[] = [];
  const engineChecks: EngineCheck[] = [];

  for (const weekOpenUtc of weeks) {
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const priceCoverage = await loadPriceCoverage(weekOpenUtc, canonical);
    priceCoverages.push(priceCoverage);

    for (const source of BASE_SOURCES) {
      const sourceSignals = filterByModel(basketWeek, source);
      const signalCoverage = buildSignalCoverage(weekOpenUtc, source, sourceSignals, canonical);
      signalCoverageBySource.get(source)!.push(signalCoverage);
      crossGaps.push(buildCrossGap(source, signalCoverage, priceCoverage, canonical));
    }

    for (const strategyId of STRATEGY_IDS) {
      engineChecks.push(await runEngineCheck(strategyId, weekOpenUtc, canonicalCount));
    }
  }

  printSignalCoverage(signalCoverageBySource, canonicalCount);
  printPriceCoverage(priceCoverages, canonicalCount);
  printCrossReference(crossGaps);
  printEngineChecks(engineChecks);
  printSummary({
    signalCoverageBySource,
    priceCoverages,
    crossGaps,
    engineChecks,
    canonicalCount,
  });
}

main()
  .catch((error) => {
    console.error("Audit failed:", error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // If the pool was never initialized, there is nothing to close.
    }
  });
