/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-weekly-hold-trailing-sweep.ts
 *
 * Description:
 * Gate 34 Dealer-only Weekly Hold execution research. Compares the untouched
 * week-close baseline against simple ADR trailing exits that follow the running
 * favorable weekly extreme using canonical 1H bars.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { getPool } from "@/lib/db";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import {
  filterByModel,
  getCanonicalBasketWeek,
  type BasketDirection,
} from "@/lib/performance/basketSource";
import { getExecutionWeeklyPairReturns } from "@/lib/pairReturns";
import { loadExecutionWeeklyReturnFromHourlyBars } from "@/lib/executionWeeklyReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import { loadPathBars, type PathBarMap } from "@/lib/performance/pathBarLoader";
import {
  computeBasketPath,
  computeMultiWeekBasketPath,
  type BasketPathPoint,
  type BasketPathResult,
} from "@/lib/performance/basketPathEngine";
import { buildWeeklyHoldLedger } from "@/lib/performance/positionLedger";
import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";

loadEnvConfig(process.cwd());

type ExecutionSource = "stored_pair_period_returns" | "derived_canonical_1h" | "missing";
type ExitReason = "week_close" | "trail_stop";

type Variant = {
  id: string;
  label: string;
  trailMultipleAdr: number | null;
};

type BasePairWeek = {
  weekOpenUtc: string;
  weekLabel: string;
  pineWeekKey: string;
  symbol: string;
  assetClass: AssetClass;
  direction: BasketDirection | "MISSING";
  sourceReportDate: string | null;
  executionReturnSource: ExecutionSource;
  executionReturnComplete: boolean | null;
  executionReturnWarnings: string[];
  entryTimeUtc: string;
  weekCloseTimeUtc: string;
  entryPrice: number | null;
  weekClosePrice: number | null;
  pairAdrPct: number;
  adrSource: "canonical_price_bars" | "asset_default";
  bars: CanonicalPriceBar[];
  missingReason: string | null;
};

type VariantPairRow = {
  variantId: string;
  variantLabel: string;
  trailMultipleAdr: number | null;
  weekOpenUtc: string;
  weekLabel: string;
  pineWeekKey: string;
  symbol: string;
  assetClass: AssetClass;
  direction: BasketDirection | "MISSING";
  sourceReportDate: string | null;
  executionReturnSource: ExecutionSource;
  executionReturnComplete: boolean | null;
  executionReturnWarnings: string[];
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  exitReason: ExitReason | "MISSING";
  entryPrice: number | null;
  exitPrice: number | null;
  pairAdrPct: number | null;
  adrSource: "canonical_price_bars" | "asset_default" | "missing";
  rawReturnPct: number | null;
  adrReturnPct: number | null;
  maxAdverseRawPct: number | null;
  maxAdverseAdrPct: number | null;
  trailAnchorPrice: number | null;
  trailStopPrice: number | null;
  trailHitBarUtc: string | null;
  holdingHours: number | null;
  outcome: "WIN" | "LOSS" | "FLAT" | "NO_TRADE" | "MISSING_SIGNAL" | "MISSING_RETURN";
  missingReason: string | null;
};

type PathSummaryReceipt = {
  totalReturnPct: number;
  peakPct: number;
  peakTsUtc: string | null;
  troughPct: number;
  troughTsUtc: string | null;
  closeEquityMaxDrawdownPct: number;
  closeEquityMaxDrawdownTsUtc: string | null;
  adverseMaxDrawdownPct: number;
  adverseMaxDrawdownTsUtc: string | null;
  peakToCloseGivebackPct: number;
  troughToCloseRecoveryPct: number;
  maxActivePositions: number;
  points: number;
};

type WeekReceipt = {
  variantId: string;
  weekOpenUtc: string;
  weekLabel: string;
  pineWeekKey: string;
  pairRows: VariantPairRow[];
  pathBarsBySymbol: Record<string, number>;
  missingPathBars: string[];
  totals: {
    expectedPairs: number;
    tradeRows: number;
    wins: number;
    losses: number;
    flat: number;
    trailStopExits: number;
    weekCloseExits: number;
    missingSignalRows: number;
    missingReturnRows: number;
    rawReturnPct: number;
    adrReturnPct: number;
    grossRawProfitPct: number;
    grossRawLossPct: number;
    grossAdrProfitPct: number;
    grossAdrLossPct: number;
    rawProfitFactor: number | null;
    adrProfitFactor: number | null;
  };
  path: {
    raw: PathSummaryReceipt;
    adr: PathSummaryReceipt;
  };
};

type SummaryStats = {
  variantId: string;
  variantLabel: string;
  trailMultipleAdr: number | null;
  weeks: number;
  expectedPairs: number;
  totalTradeRows: number;
  weeklyWins: number;
  weeklyLosses: number;
  weeklyFlat: number;
  weeklyWinRatePct: number;
  tradeWins: number;
  tradeLosses: number;
  tradeFlat: number;
  tradeWinRatePct: number;
  trailStopExits: number;
  weekCloseExits: number;
  totalRawPct: number;
  totalAdrPct: number;
  weeklyRawProfitFactor: number | null;
  weeklyAdrProfitFactor: number | null;
  tradeRawProfitFactor: number | null;
  tradeAdrProfitFactor: number | null;
  rawPeakPct: number;
  rawAdverseDrawdownPct: number;
  rawPeakGivebackPct: number;
  adrPeakPct: number;
  adrAdverseDrawdownPct: number;
  adrPeakGivebackPct: number;
};

type PairSummary = {
  variantId: string;
  symbol: string;
  tradeRows: number;
  wins: number;
  losses: number;
  flat: number;
  trailStopExits: number;
  weekCloseExits: number;
  totalRawPct: number;
  totalAdrPct: number;
  maxAdverseRawPct: number;
  maxAdverseAdrPct: number;
  avgHoldingHours: number;
  missingRows: number;
};

const CSV_COLUMNS = [
  "variantId",
  "variantLabel",
  "trailMultipleAdr",
  "weekLabel",
  "symbol",
  "direction",
  "exitReason",
  "entryTimeUtc",
  "exitTimeUtc",
  "entryPrice",
  "exitPrice",
  "pairAdrPct",
  "rawReturnPct",
  "adrReturnPct",
  "maxAdverseRawPct",
  "maxAdverseAdrPct",
  "trailAnchorPrice",
  "trailStopPrice",
  "trailHitBarUtc",
  "holdingHours",
  "outcome",
  "missingReason",
] as const;

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseAssetClass(): AssetClass {
  const value = (argValue("asset-class") ?? "fx").trim().toLowerCase();
  if (value === "fx" || value === "indices" || value === "commodities" || value === "crypto") {
    return value;
  }
  throw new Error("--asset-class must be fx, indices, commodities, or crypto.");
}

function parseTrailMultiples(): number[] {
  const raw = argValue("trail-multiples") ?? "0.5,1,1.5,2";
  const multiples = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (multiples.length === 0) {
    throw new Error("--trail-multiples must include at least one positive number.");
  }
  return Array.from(new Set(multiples)).sort((left, right) => left - right);
}

function defaultOutDir() {
  const fromAppDir = path.basename(process.cwd()).toLowerCase() === "app";
  return fromAppDir
    ? "reports/data-verification/weekly-hold-exit-sweep"
    : "app/reports/data-verification/weekly-hold-exit-sweep";
}

function weekLabel(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.toFormat("yyyy-LL-dd") : weekOpenUtc.slice(0, 10);
}

function pineWeekKey(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.plus({ days: 1 }).toISODate() ?? weekOpenUtc.slice(0, 10) : weekOpenUtc.slice(0, 10);
}

function selectClosedWeeks(allWeeks: string[], currentWeekOpenUtc: string) {
  return allWeeks
    .map((week) => week.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .filter((week) => week < currentWeekOpenUtc);
}

function filterWeeksByDate(weeks: string[], options: { from: string | null; to: string | null }) {
  return weeks.filter((weekOpenUtc) => {
    const key = pineWeekKey(weekOpenUtc);
    if (options.from && key < options.from) return false;
    if (options.to && key > options.to) return false;
    return true;
  });
}

function round(value: number | null, places = 6) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function fixed(value: number | null, places = 2) {
  return value === null || !Number.isFinite(value) ? "-" : value.toFixed(places);
}

function signed(value: number | null, places = 2) {
  return value === null || !Number.isFinite(value)
    ? "-"
    : `${value >= 0 ? "+" : ""}${value.toFixed(places)}%`;
}

function formatProfitFactor(value: number | null) {
  if (value === null) return "-";
  return Number.isFinite(value) ? value.toFixed(2) : "inf";
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(";") : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: VariantPairRow[]) {
  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function profitFactor(grossProfit: number, grossLoss: number) {
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function outcomeFor(direction: BasketDirection | "MISSING", raw: number | null, normalized: number | null) {
  if (direction === "MISSING") return "MISSING_SIGNAL" as const;
  if (direction === "NEUTRAL") return "NO_TRADE" as const;
  if (raw === null || normalized === null) return "MISSING_RETURN" as const;
  if (normalized > 0) return "WIN" as const;
  if (normalized < 0) return "LOSS" as const;
  return "FLAT" as const;
}

function directionAdjustedReturn(direction: BasketDirection, entryPrice: number, exitPrice: number) {
  const raw = ((exitPrice - entryPrice) / entryPrice) * 100;
  if (direction === "SHORT") return -raw;
  if (direction === "LONG") return raw;
  return null;
}

function holdingHours(entryTimeUtc: string, exitTimeUtc: string) {
  const entryMs = Date.parse(entryTimeUtc);
  const exitMs = Date.parse(exitTimeUtc);
  return Number.isFinite(entryMs) && Number.isFinite(exitMs)
    ? (exitMs - entryMs) / 3_600_000
    : null;
}

function barsForWindow(bars: CanonicalPriceBar[], entryTimeUtc: string, exitTimeUtc: string) {
  const entryMs = Date.parse(entryTimeUtc);
  const exitMs = Date.parse(exitTimeUtc);
  return bars
    .filter((bar) => {
      const openMs = Date.parse(bar.barOpenUtc);
      return Number.isFinite(openMs) && Number.isFinite(entryMs) && Number.isFinite(exitMs)
        && openMs >= entryMs && openMs < exitMs;
    })
    .sort((left, right) => left.barOpenUtc.localeCompare(right.barOpenUtc));
}

function maxAdverseRawPct(options: {
  direction: BasketDirection | "MISSING";
  entryPrice: number | null;
  bars: CanonicalPriceBar[];
}) {
  if (options.direction !== "LONG" && options.direction !== "SHORT") return null;
  if (options.entryPrice === null || !Number.isFinite(options.entryPrice) || options.entryPrice <= 0) return null;
  if (options.bars.length === 0) return null;

  let adverse = 0;
  for (const bar of options.bars) {
    const adverseMove = options.direction === "SHORT"
      ? bar.highPrice - options.entryPrice
      : options.entryPrice - bar.lowPrice;
    adverse = Math.max(adverse, adverseMove);
  }
  return (adverse / options.entryPrice) * 100;
}

function summarizePath(pathResult: BasketPathResult): PathSummaryReceipt {
  const points = pathResult.points;
  const peakPoint = points.reduce<BasketPathPoint | null>((best, point) =>
    !best || point.equityPct > best.equityPct ? point : best, null);
  const troughPoint = points.reduce<BasketPathPoint | null>((best, point) =>
    !best || point.equityPct < best.equityPct ? point : best, null);
  const adverseDdPoint = points.reduce<BasketPathPoint | null>((best, point) =>
    !best || point.drawdownPct < best.drawdownPct ? point : best, null);

  let closePeakPct = 0;
  let closeMaxDrawdownPct = 0;
  let closeMaxDrawdownTsUtc: string | null = null;
  for (const point of points) {
    closePeakPct = Math.max(closePeakPct, point.equityPct);
    const drawdown = (100 + closePeakPct) <= 0
      ? 100
      : Math.abs((((100 + point.equityPct) / (100 + closePeakPct)) - 1) * 100);
    if (drawdown > closeMaxDrawdownPct) {
      closeMaxDrawdownPct = drawdown;
      closeMaxDrawdownTsUtc = point.tsUtc;
    }
  }

  return {
    totalReturnPct: round(pathResult.summary.totalReturnPct) ?? 0,
    peakPct: round(pathResult.summary.peakPct) ?? 0,
    peakTsUtc: peakPoint?.tsUtc ?? null,
    troughPct: round(pathResult.summary.troughPct) ?? 0,
    troughTsUtc: troughPoint?.tsUtc ?? null,
    closeEquityMaxDrawdownPct: round(closeMaxDrawdownPct) ?? 0,
    closeEquityMaxDrawdownTsUtc: closeMaxDrawdownTsUtc,
    adverseMaxDrawdownPct: round(pathResult.summary.maxDrawdownPct) ?? 0,
    adverseMaxDrawdownTsUtc: adverseDdPoint?.tsUtc ?? null,
    peakToCloseGivebackPct: round(pathResult.summary.peakToCloseGivebackPct) ?? 0,
    troughToCloseRecoveryPct: round(pathResult.summary.troughToCloseRecoveryPct) ?? 0,
    maxActivePositions: pathResult.summary.maxActivePositions,
    points: points.length,
  };
}

async function resolveExecutionReturn(options: {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  storedRows: Array<{
    symbol: string;
    assetClass: AssetClass;
    returnPct: number;
    openPrice: number;
    closePrice: number;
  }>;
}) {
  const stored = options.storedRows.find((candidate) => candidate.symbol.toUpperCase() === options.symbol);
  if (stored) {
    return {
      row: stored,
      source: "stored_pair_period_returns" as const,
      complete: true,
      warnings: [] as string[],
    };
  }

  const derived = await loadExecutionWeeklyReturnFromHourlyBars({
    symbol: options.symbol,
    assetClass: options.assetClass,
    weekOpenUtc: options.weekOpenUtc,
  });

  if (!derived) {
    return {
      row: null,
      source: "missing" as const,
      complete: null,
      warnings: [] as string[],
    };
  }

  return {
    row: {
      symbol: derived.symbol,
      assetClass: derived.assetClass,
      returnPct: derived.returnPct,
      openPrice: derived.openPrice,
      closePrice: derived.closePrice,
    },
    source: "derived_canonical_1h" as const,
    complete: derived.complete,
    warnings: derived.warnings,
  };
}

function simulateTrailingExit(options: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  weekClosePrice: number;
  entryTimeUtc: string;
  weekCloseTimeUtc: string;
  pairAdrPct: number;
  trailMultipleAdr: number;
  bars: CanonicalPriceBar[];
}) {
  const distancePct = options.pairAdrPct * options.trailMultipleAdr;
  let anchor = options.entryPrice;
  let stopPrice = options.direction === "LONG"
    ? anchor * (1 - distancePct / 100)
    : anchor * (1 + distancePct / 100);

  for (const bar of barsForWindow(options.bars, options.entryTimeUtc, options.weekCloseTimeUtc)) {
    stopPrice = options.direction === "LONG"
      ? anchor * (1 - distancePct / 100)
      : anchor * (1 + distancePct / 100);

    const stopHit = options.direction === "LONG"
      ? bar.lowPrice <= stopPrice
      : bar.highPrice >= stopPrice;

    if (stopHit) {
      return {
        exitPrice: stopPrice,
        exitTimeUtc: bar.barCloseUtc,
        exitReason: "trail_stop" as const,
        trailAnchorPrice: anchor,
        trailStopPrice: stopPrice,
        trailHitBarUtc: bar.barCloseUtc,
      };
    }

    anchor = options.direction === "LONG"
      ? Math.max(anchor, bar.highPrice)
      : Math.min(anchor, bar.lowPrice);
  }

  return {
    exitPrice: options.weekClosePrice,
    exitTimeUtc: options.weekCloseTimeUtc,
    exitReason: "week_close" as const,
    trailAnchorPrice: anchor,
    trailStopPrice: options.direction === "LONG"
      ? anchor * (1 - distancePct / 100)
      : anchor * (1 + distancePct / 100),
    trailHitBarUtc: null,
  };
}

function simulatePair(base: BasePairWeek, variant: Variant, targetAdrPct: number): VariantPairRow {
  if (base.direction !== "LONG" && base.direction !== "SHORT") {
    const outcome = outcomeFor(base.direction, null, null);
    return {
      variantId: variant.id,
      variantLabel: variant.label,
      trailMultipleAdr: variant.trailMultipleAdr,
      weekOpenUtc: base.weekOpenUtc,
      weekLabel: base.weekLabel,
      pineWeekKey: base.pineWeekKey,
      symbol: base.symbol,
      assetClass: base.assetClass,
      direction: base.direction,
      sourceReportDate: base.sourceReportDate,
      executionReturnSource: base.executionReturnSource,
      executionReturnComplete: base.executionReturnComplete,
      executionReturnWarnings: base.executionReturnWarnings,
      entryTimeUtc: null,
      exitTimeUtc: null,
      exitReason: "MISSING",
      entryPrice: null,
      exitPrice: null,
      pairAdrPct: base.pairAdrPct,
      adrSource: base.adrSource,
      rawReturnPct: null,
      adrReturnPct: null,
      maxAdverseRawPct: null,
      maxAdverseAdrPct: null,
      trailAnchorPrice: null,
      trailStopPrice: null,
      trailHitBarUtc: null,
      holdingHours: null,
      outcome,
      missingReason: base.missingReason,
    };
  }

  if (!base.entryPrice || !base.weekClosePrice) {
    return {
      variantId: variant.id,
      variantLabel: variant.label,
      trailMultipleAdr: variant.trailMultipleAdr,
      weekOpenUtc: base.weekOpenUtc,
      weekLabel: base.weekLabel,
      pineWeekKey: base.pineWeekKey,
      symbol: base.symbol,
      assetClass: base.assetClass,
      direction: base.direction,
      sourceReportDate: base.sourceReportDate,
      executionReturnSource: base.executionReturnSource,
      executionReturnComplete: base.executionReturnComplete,
      executionReturnWarnings: base.executionReturnWarnings,
      entryTimeUtc: null,
      exitTimeUtc: null,
      exitReason: "MISSING",
      entryPrice: round(base.entryPrice),
      exitPrice: round(base.weekClosePrice),
      pairAdrPct: base.pairAdrPct,
      adrSource: base.adrSource,
      rawReturnPct: null,
      adrReturnPct: null,
      maxAdverseRawPct: null,
      maxAdverseAdrPct: null,
      trailAnchorPrice: null,
      trailStopPrice: null,
      trailHitBarUtc: null,
      holdingHours: null,
      outcome: "MISSING_RETURN",
      missingReason: base.missingReason ?? "missing_execution_return",
    };
  }

  const exit = variant.trailMultipleAdr === null
    ? {
        exitPrice: base.weekClosePrice,
        exitTimeUtc: base.weekCloseTimeUtc,
        exitReason: "week_close" as const,
        trailAnchorPrice: null,
        trailStopPrice: null,
        trailHitBarUtc: null,
      }
    : simulateTrailingExit({
        direction: base.direction,
        entryPrice: base.entryPrice,
        weekClosePrice: base.weekClosePrice,
        entryTimeUtc: base.entryTimeUtc,
        weekCloseTimeUtc: base.weekCloseTimeUtc,
        pairAdrPct: base.pairAdrPct,
        trailMultipleAdr: variant.trailMultipleAdr,
        bars: base.bars,
      });

  const rawReturn = directionAdjustedReturn(base.direction, base.entryPrice, exit.exitPrice);
  const adrReturn = rawReturn !== null && base.pairAdrPct > 0
    ? rawReturn * (targetAdrPct / base.pairAdrPct)
    : null;
  const heldBars = barsForWindow(base.bars, base.entryTimeUtc, exit.exitTimeUtc);
  const adverseRaw = maxAdverseRawPct({
    direction: base.direction,
    entryPrice: base.entryPrice,
    bars: heldBars,
  });
  const adverseAdr = adverseRaw !== null && base.pairAdrPct > 0
    ? adverseRaw * (targetAdrPct / base.pairAdrPct)
    : null;

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    trailMultipleAdr: variant.trailMultipleAdr,
    weekOpenUtc: base.weekOpenUtc,
    weekLabel: base.weekLabel,
    pineWeekKey: base.pineWeekKey,
    symbol: base.symbol,
    assetClass: base.assetClass,
    direction: base.direction,
    sourceReportDate: base.sourceReportDate,
    executionReturnSource: base.executionReturnSource,
    executionReturnComplete: base.executionReturnComplete,
    executionReturnWarnings: base.executionReturnWarnings,
    entryTimeUtc: base.entryTimeUtc,
    exitTimeUtc: exit.exitTimeUtc,
    exitReason: exit.exitReason,
    entryPrice: round(base.entryPrice),
    exitPrice: round(exit.exitPrice),
    pairAdrPct: round(base.pairAdrPct),
    adrSource: base.adrSource,
    rawReturnPct: round(rawReturn),
    adrReturnPct: round(adrReturn),
    maxAdverseRawPct: round(adverseRaw),
    maxAdverseAdrPct: round(adverseAdr),
    trailAnchorPrice: round(exit.trailAnchorPrice),
    trailStopPrice: round(exit.trailStopPrice),
    trailHitBarUtc: exit.trailHitBarUtc,
    holdingHours: round(holdingHours(base.entryTimeUtc, exit.exitTimeUtc)),
    outcome: outcomeFor(base.direction, rawReturn, adrReturn),
    missingReason: null,
  };
}

function tradeFromRow(row: VariantPairRow, targetAdrPct: number): WeeklyHoldTrade | null {
  if (row.direction !== "LONG" && row.direction !== "SHORT") return null;
  if (!row.entryPrice || !row.exitPrice || row.rawReturnPct === null || row.adrReturnPct === null) return null;
  const pairAdrPct = row.pairAdrPct ?? getTargetAdrPct();
  return {
    symbol: row.symbol,
    assetClass: row.assetClass,
    direction: row.direction,
    openPrice: row.entryPrice,
    closePrice: row.exitPrice,
    returnPct: row.adrReturnPct,
    rawReturnPct: row.rawReturnPct,
    normalizedReturnPct: row.adrReturnPct,
    displayReturnPct: row.adrReturnPct,
    adrPct: pairAdrPct,
    adrMultiplier: targetAdrPct / pairAdrPct,
    returnMode: "normalized",
    source: "dealer",
    tier: null,
    detail: {
      tradeNumber: 0,
      entryTimeUtc: row.entryTimeUtc,
      exitTimeUtc: row.exitTimeUtc,
      exitReason: row.exitReason,
      anchorPrice: row.trailAnchorPrice,
      tpPrice: row.trailStopPrice,
      adrPct: pairAdrPct,
      maePct: row.maxAdverseRawPct,
    },
  };
}

async function buildBaseWeek(options: {
  weekOpenUtc: string;
  assetClass: AssetClass;
  expectedPairs: string[];
}) {
  const { weekOpenUtc, assetClass, expectedPairs } = options;
  const [basketWeek, executionRows, adrMap] = await Promise.all([
    getCanonicalBasketWeek(weekOpenUtc),
    getExecutionWeeklyPairReturns(weekOpenUtc),
    loadWeeklyAdrMap(weekOpenUtc),
  ]);
  const signals = filterByModel(basketWeek, "dealer")
    .filter((signal) => signal.assetClass === assetClass);
  const signalBySymbol = new Map(signals.map((signal) => [signal.symbol.toUpperCase(), signal]));
  const executionRowsForAsset = executionRows.filter((row) => row.assetClass === assetClass);
  const executionWindow = getExecutionWeekWindow(weekOpenUtc, assetClass);
  const entryTimeUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? weekOpenUtc;
  const weekCloseTimeUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? weekOpenUtc;
  const bars = await loadPathBars(expectedPairs, entryTimeUtc, weekCloseTimeUtc);
  const rows: BasePairWeek[] = [];

  for (const symbol of expectedPairs) {
    const signal = signalBySymbol.get(symbol) ?? null;
    const direction = signal?.direction ?? "MISSING";
    const execution = await resolveExecutionReturn({
      symbol,
      assetClass,
      weekOpenUtc,
      storedRows: executionRowsForAsset,
    });
    const pairAdrPct = getAdrPct(adrMap, symbol, assetClass);
    const missingReason = direction === "MISSING"
      ? "missing_signal"
      : !execution.row
        ? "missing_execution_return"
        : direction === "NEUTRAL"
          ? "neutral_signal"
          : null;

    rows.push({
      weekOpenUtc,
      weekLabel: weekLabel(weekOpenUtc),
      pineWeekKey: pineWeekKey(weekOpenUtc),
      symbol,
      assetClass,
      direction,
      sourceReportDate: signal?.sourceReportDate ?? null,
      executionReturnSource: execution.source,
      executionReturnComplete: execution.complete,
      executionReturnWarnings: execution.warnings,
      entryTimeUtc,
      weekCloseTimeUtc,
      entryPrice: execution.row?.openPrice ?? null,
      weekClosePrice: execution.row?.closePrice ?? null,
      pairAdrPct,
      adrSource: adrMap.has(symbol) ? "canonical_price_bars" : "asset_default",
      bars: bars.get(symbol) ?? [],
      missingReason,
    });
  }

  return {
    rows,
    pathBarsBySymbol: Object.fromEntries(expectedPairs.map((symbol) => [symbol, bars.get(symbol)?.length ?? 0])),
    missingPathBars: expectedPairs.filter((symbol) => (bars.get(symbol)?.length ?? 0) === 0),
    weekOpenUtc,
    entryTimeUtc,
    weekCloseTimeUtc,
    bars,
  };
}

async function buildVariantWeek(options: {
  variant: Variant;
  baseWeek: Awaited<ReturnType<typeof buildBaseWeek>>;
  expectedPairs: string[];
  targetAdrPct: number;
}): Promise<{ receipt: WeekReceipt; rawPath: BasketPathResult; adrPath: BasketPathResult }> {
  const { variant, baseWeek, expectedPairs, targetAdrPct } = options;
  const pairRows = baseWeek.rows.map((row) => simulatePair(row, variant, targetAdrPct));
  const trades = pairRows
    .map((row) => tradeFromRow(row, targetAdrPct))
    .filter((trade): trade is WeeklyHoldTrade => trade !== null)
    .map((trade, index) => ({
      ...trade,
      detail: trade.detail ? { ...trade.detail, tradeNumber: index + 1 } : trade.detail,
    }));
  const rawReturnPct = trades.reduce((sum, trade) => sum + (trade.rawReturnPct ?? 0), 0);
  const adrReturnPct = trades.reduce((sum, trade) => sum + (trade.normalizedReturnPct ?? trade.returnPct), 0);
  const result: WeeklyHoldResult = {
    weekOpenUtc: baseWeek.weekOpenUtc,
    executionWindowOpenUtc: baseWeek.entryTimeUtc,
    executionWindowCloseUtc: baseWeek.weekCloseTimeUtc,
    biasSourceId: "dealer",
    trades,
    totalReturnPct: adrReturnPct,
    rawTotalReturnPct: rawReturnPct,
    normalizedTotalReturnPct: adrReturnPct,
    displayTotalReturnPct: adrReturnPct,
    returnMode: "normalized",
    winCount: trades.filter((trade) => trade.returnPct > 0).length,
    lossCount: trades.filter((trade) => trade.returnPct < 0).length,
    winRate: trades.length > 0 ? (trades.filter((trade) => trade.returnPct > 0).length / trades.length) * 100 : 0,
    tradeCount: trades.length,
    signals: trades.map((trade) => ({
      symbol: trade.symbol,
      assetClass: trade.assetClass,
      direction: trade.direction,
      source: trade.source,
      tier: trade.tier,
    })),
    isRealized: true,
    missingPriceSymbols: pairRows
      .filter((row) => row.executionReturnSource === "missing")
      .map((row) => row.symbol),
  };
  const ledger = await buildWeeklyHoldLedger(result, { entryStyleId: variant.id });
  const rawPath = computeBasketPath(ledger, baseWeek.bars as PathBarMap, { returnMode: "raw" });
  const adrPath = computeBasketPath(ledger, baseWeek.bars as PathBarMap, { returnMode: "normalized" });
  const rawReturns = pairRows.map((row) => row.rawReturnPct ?? 0);
  const adrReturns = pairRows.map((row) => row.adrReturnPct ?? 0);
  const grossRawProfitPct = rawReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossRawLossPct = Math.abs(rawReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const grossAdrProfitPct = adrReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossAdrLossPct = Math.abs(adrReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));

  return {
    receipt: {
      variantId: variant.id,
      weekOpenUtc: baseWeek.weekOpenUtc,
      weekLabel: weekLabel(baseWeek.weekOpenUtc),
      pineWeekKey: pineWeekKey(baseWeek.weekOpenUtc),
      pairRows,
      pathBarsBySymbol: baseWeek.pathBarsBySymbol,
      missingPathBars: baseWeek.missingPathBars,
      totals: {
        expectedPairs: expectedPairs.length,
        tradeRows: trades.length,
        wins: pairRows.filter((row) => row.outcome === "WIN").length,
        losses: pairRows.filter((row) => row.outcome === "LOSS").length,
        flat: pairRows.filter((row) => row.outcome === "FLAT").length,
        trailStopExits: pairRows.filter((row) => row.exitReason === "trail_stop").length,
        weekCloseExits: pairRows.filter((row) => row.exitReason === "week_close").length,
        missingSignalRows: pairRows.filter((row) => row.outcome === "MISSING_SIGNAL").length,
        missingReturnRows: pairRows.filter((row) => row.outcome === "MISSING_RETURN").length,
        rawReturnPct: round(rawReturnPct) ?? 0,
        adrReturnPct: round(adrReturnPct) ?? 0,
        grossRawProfitPct: round(grossRawProfitPct) ?? 0,
        grossRawLossPct: round(grossRawLossPct) ?? 0,
        grossAdrProfitPct: round(grossAdrProfitPct) ?? 0,
        grossAdrLossPct: round(grossAdrLossPct) ?? 0,
        rawProfitFactor: profitFactor(grossRawProfitPct, grossRawLossPct),
        adrProfitFactor: profitFactor(grossAdrProfitPct, grossAdrLossPct),
      },
      path: {
        raw: summarizePath(rawPath),
        adr: summarizePath(adrPath),
      },
    },
    rawPath,
    adrPath,
  };
}

function summarizeStats(options: {
  variant: Variant;
  weeks: WeekReceipt[];
  rawPath: PathSummaryReceipt;
  adrPath: PathSummaryReceipt;
}): SummaryStats {
  const { variant, weeks, rawPath, adrPath } = options;
  const weeklyRawReturns = weeks.map((week) => week.totals.rawReturnPct);
  const weeklyAdrReturns = weeks.map((week) => week.totals.adrReturnPct);
  const allRows = weeks.flatMap((week) => week.pairRows);
  const tradeRows = allRows.filter((row) => row.outcome === "WIN" || row.outcome === "LOSS" || row.outcome === "FLAT");
  const tradeRawReturns = tradeRows.map((row) => row.rawReturnPct ?? 0);
  const tradeAdrReturns = tradeRows.map((row) => row.adrReturnPct ?? 0);
  const weeklyRawProfit = weeklyRawReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const weeklyRawLoss = Math.abs(weeklyRawReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const weeklyAdrProfit = weeklyAdrReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const weeklyAdrLoss = Math.abs(weeklyAdrReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const tradeRawProfit = tradeRawReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const tradeRawLoss = Math.abs(tradeRawReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const tradeAdrProfit = tradeAdrReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const tradeAdrLoss = Math.abs(tradeAdrReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const weeklyWins = weeklyAdrReturns.filter((value) => value > 0).length;
  const weeklyLosses = weeklyAdrReturns.filter((value) => value < 0).length;
  const weeklyFlat = weeklyAdrReturns.filter((value) => value === 0).length;
  const tradeWins = tradeRows.filter((row) => (row.adrReturnPct ?? 0) > 0).length;
  const tradeLosses = tradeRows.filter((row) => (row.adrReturnPct ?? 0) < 0).length;
  const tradeFlat = tradeRows.filter((row) => (row.adrReturnPct ?? 0) === 0).length;

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    trailMultipleAdr: variant.trailMultipleAdr,
    weeks: weeks.length,
    expectedPairs: weeks[0]?.totals.expectedPairs ?? 0,
    totalTradeRows: tradeRows.length,
    weeklyWins,
    weeklyLosses,
    weeklyFlat,
    weeklyWinRatePct: weeks.length > 0 ? (weeklyWins / weeks.length) * 100 : 0,
    tradeWins,
    tradeLosses,
    tradeFlat,
    tradeWinRatePct: tradeRows.length > 0 ? (tradeWins / tradeRows.length) * 100 : 0,
    trailStopExits: tradeRows.filter((row) => row.exitReason === "trail_stop").length,
    weekCloseExits: tradeRows.filter((row) => row.exitReason === "week_close").length,
    totalRawPct: rawPath.totalReturnPct,
    totalAdrPct: adrPath.totalReturnPct,
    weeklyRawProfitFactor: profitFactor(weeklyRawProfit, weeklyRawLoss),
    weeklyAdrProfitFactor: profitFactor(weeklyAdrProfit, weeklyAdrLoss),
    tradeRawProfitFactor: profitFactor(tradeRawProfit, tradeRawLoss),
    tradeAdrProfitFactor: profitFactor(tradeAdrProfit, tradeAdrLoss),
    rawPeakPct: rawPath.peakPct,
    rawAdverseDrawdownPct: rawPath.adverseMaxDrawdownPct,
    rawPeakGivebackPct: rawPath.peakToCloseGivebackPct,
    adrPeakPct: adrPath.peakPct,
    adrAdverseDrawdownPct: adrPath.adverseMaxDrawdownPct,
    adrPeakGivebackPct: adrPath.peakToCloseGivebackPct,
  };
}

function buildPairSummaries(rows: VariantPairRow[], expectedPairs: string[]): PairSummary[] {
  const variantIds = Array.from(new Set(rows.map((row) => row.variantId)));
  return variantIds.flatMap((variantId) => expectedPairs.map((symbol) => {
    const symbolRows = rows.filter((row) => row.variantId === variantId && row.symbol === symbol);
    const tradeRows = symbolRows.filter((row) => row.outcome === "WIN" || row.outcome === "LOSS" || row.outcome === "FLAT");
    const heldRows = tradeRows.filter((row) => row.holdingHours !== null);
    return {
      variantId,
      symbol,
      tradeRows: tradeRows.length,
      wins: tradeRows.filter((row) => row.outcome === "WIN").length,
      losses: tradeRows.filter((row) => row.outcome === "LOSS").length,
      flat: tradeRows.filter((row) => row.outcome === "FLAT").length,
      trailStopExits: tradeRows.filter((row) => row.exitReason === "trail_stop").length,
      weekCloseExits: tradeRows.filter((row) => row.exitReason === "week_close").length,
      totalRawPct: round(tradeRows.reduce((sum, row) => sum + (row.rawReturnPct ?? 0), 0)) ?? 0,
      totalAdrPct: round(tradeRows.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0)) ?? 0,
      maxAdverseRawPct: round(Math.max(0, ...tradeRows.map((row) => row.maxAdverseRawPct ?? 0))) ?? 0,
      maxAdverseAdrPct: round(Math.max(0, ...tradeRows.map((row) => row.maxAdverseAdrPct ?? 0))) ?? 0,
      avgHoldingHours: round(
        heldRows.length > 0
          ? heldRows.reduce((sum, row) => sum + (row.holdingHours ?? 0), 0) / heldRows.length
          : 0,
      ) ?? 0,
      missingRows: symbolRows.filter((row) => row.outcome === "MISSING_SIGNAL" || row.outcome === "MISSING_RETURN").length,
    };
  }));
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  assetClass: AssetClass;
  fromDate: string | null;
  toDate: string | null;
  targetAdrPct: number;
  expectedPairs: string[];
  variants: Variant[];
  summaries: SummaryStats[];
  weeksByVariant: Record<string, WeekReceipt[]>;
  jsonPath: string;
  csvPath: string;
}) {
  const lines = [
    "# Gate 34 Dealer Weekly Hold ADR Trailing Exit Sweep",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    "- Gate: Gate 34 weekly-hold-engine-research",
    "- Source model: dealer only",
    "- Asset class: fx",
    "- Entry style: unchanged Weekly Hold",
    "- Risk overlay: none",
    "- Pair filtering/caps: none",
    "- Basket exits: none",
    "- Baseline variant: week close",
    `- Trail variants: ${options.variants.filter((variant) => variant.trailMultipleAdr !== null).map((variant) => `${variant.trailMultipleAdr}x ADR`).join(", ")}`,
    `- Expected pair count: ${options.expectedPairs.length}`,
    `- Displayed week filter: ${options.fromDate ?? "-"} -> ${options.toDate ?? "-"}`,
    `- Target ADR percent: ${options.targetAdrPct}`,
    "",
    "## Trail Rule",
    "",
    "- Long: track the running favorable weekly high known before each 1H bar; exit if that bar trades below `runningHigh - X * ADR`.",
    "- Short: track the running favorable weekly low known before each 1H bar; exit if that bar trades above `runningLow + X * ADR`.",
    "- Sequencing: anchors update after each bar if no stop was hit, so a bar cannot create a new extreme and trigger from that same new extreme at 1H resolution.",
    "",
    "## Variant Summary",
    "",
    "| Variant | Raw | ADR Norm | Weekly W/L/F | Weekly WR | Weekly Raw PF | Weekly ADR PF | Trade PF Raw/ADR | Trail Exits | Week Close Exits | Raw Peak | Raw Adv DD | ADR Peak | ADR Adv DD | ADR Giveback |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const summary of options.summaries) {
    lines.push(
      `| ${summary.variantLabel} | ${signed(summary.totalRawPct)} | ${signed(summary.totalAdrPct)} | ${summary.weeklyWins}/${summary.weeklyLosses}/${summary.weeklyFlat} | ${fixed(summary.weeklyWinRatePct)}% | ${formatProfitFactor(summary.weeklyRawProfitFactor)} | ${formatProfitFactor(summary.weeklyAdrProfitFactor)} | ${formatProfitFactor(summary.tradeRawProfitFactor)}/${formatProfitFactor(summary.tradeAdrProfitFactor)} | ${summary.trailStopExits} | ${summary.weekCloseExits} | ${signed(summary.rawPeakPct)} | ${fixed(summary.rawAdverseDrawdownPct)}% | ${signed(summary.adrPeakPct)} | ${fixed(summary.adrAdverseDrawdownPct)}% | ${fixed(summary.adrPeakGivebackPct)}% |`,
    );
  }

  for (const variant of options.variants) {
    const weeks = options.weeksByVariant[variant.id] ?? [];
    lines.push(
      "",
      `## Weekly Rows - ${variant.label}`,
      "",
      "| Week | Trades | W/L/F | Raw | ADR Norm | Trail Exits | Week Close Exits | Raw Adv DD | ADR Adv DD | Missing Signal | Missing Return | Missing Bars |",
      "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    );
    for (const week of weeks) {
      lines.push(
        `| ${week.pineWeekKey} | ${week.totals.tradeRows} | ${week.totals.wins}/${week.totals.losses}/${week.totals.flat} | ${signed(week.totals.rawReturnPct)} | ${signed(week.totals.adrReturnPct)} | ${week.totals.trailStopExits} | ${week.totals.weekCloseExits} | ${fixed(week.path.raw.adverseMaxDrawdownPct)}% | ${fixed(week.path.adr.adverseMaxDrawdownPct)}% | ${week.totals.missingSignalRows} | ${week.totals.missingReturnRows} | ${week.missingPathBars.length} |`,
      );
    }
  }

  lines.push(
    "",
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- CSV: ${options.csvPath}`,
    "",
  );

  return lines.join("\n");
}

async function main() {
  const assetClass = parseAssetClass();
  const fromDate = argValue("from") ?? "2026-01-01";
  const toDate = argValue("to") ?? "2026-06-08";
  const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? defaultOutDir());
  const trailMultiples = parseTrailMultiples();
  const variants: Variant[] = [
    { id: "week_close", label: "Week Close", trailMultipleAdr: null },
    ...trailMultiples.map((multiple) => ({
      id: `trail_${String(multiple).replace(".", "p")}x_adr`,
      label: `Trail ${multiple}x ADR`,
      trailMultipleAdr: multiple,
    })),
  ];
  const expectedPairs = PAIRS_BY_ASSET_CLASS[assetClass].map((pair) => pair.pair.toUpperCase());
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = filterWeeksByDate(
    selectClosedWeeks(await listDataSectionWeeks(), currentWeekOpenUtc),
    { from: fromDate, to: toDate },
  );
  const targetAdrPct = getTargetAdrPct();

  if (assetClass !== "fx") {
    throw new Error("This first Gate 34 trailing sweep is intentionally limited to --asset-class fx.");
  }
  if (weeks.length === 0) {
    throw new Error("No closed weeks were found for the trailing sweep.");
  }

  await mkdir(outDir, { recursive: true });

  const baseWeeks = [];
  for (const weekOpenUtc of weeks) {
    baseWeeks.push(await buildBaseWeek({ weekOpenUtc, assetClass, expectedPairs }));
  }

  const weeksByVariant: Record<string, WeekReceipt[]> = {};
  const rawPathsByVariant: Record<string, BasketPathResult[]> = {};
  const adrPathsByVariant: Record<string, BasketPathResult[]> = {};
  for (const variant of variants) {
    weeksByVariant[variant.id] = [];
    rawPathsByVariant[variant.id] = [];
    adrPathsByVariant[variant.id] = [];
    for (const baseWeek of baseWeeks) {
      const { receipt, rawPath, adrPath } = await buildVariantWeek({
        variant,
        baseWeek,
        expectedPairs,
        targetAdrPct,
      });
      weeksByVariant[variant.id]?.push(receipt);
      rawPathsByVariant[variant.id]?.push(rawPath);
      adrPathsByVariant[variant.id]?.push(adrPath);
    }
  }

  const summaries: SummaryStats[] = [];
  const basketPathByVariant: Record<string, {
    raw: { summary: PathSummaryReceipt; points: BasketPathPoint[] };
    adrNormalized: { summary: PathSummaryReceipt; points: BasketPathPoint[] };
  }> = {};

  for (const variant of variants) {
    const rawMulti = computeMultiWeekBasketPath(rawPathsByVariant[variant.id] ?? []);
    const adrMulti = computeMultiWeekBasketPath(adrPathsByVariant[variant.id] ?? []);
    const rawSummary = summarizePath({
      weekOpenUtc: weeks[0] ?? "",
      strategyId: "dealer",
      entryStyleId: variant.id,
      returnMode: "raw",
      resolution: "1h",
      points: rawMulti.points,
      summary: rawMulti.summary,
    });
    const adrSummary = summarizePath({
      weekOpenUtc: weeks[0] ?? "",
      strategyId: "dealer",
      entryStyleId: variant.id,
      returnMode: "normalized",
      resolution: "1h",
      points: adrMulti.points,
      summary: adrMulti.summary,
    });
    summaries.push(summarizeStats({
      variant,
      weeks: weeksByVariant[variant.id] ?? [],
      rawPath: rawSummary,
      adrPath: adrSummary,
    }));
    basketPathByVariant[variant.id] = {
      raw: { summary: rawSummary, points: rawMulti.points },
      adrNormalized: { summary: adrSummary, points: adrMulti.points },
    };
  }

  const allPairRows = Object.values(weeksByVariant).flatMap((variantWeeks) =>
    variantWeeks.flatMap((week) => week.pairRows),
  );
  const pairSummaries = buildPairSummaries(allPairRows, expectedPairs);
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `${assetClass}-${expectedPairs.length}pair-dealer-weekly-hold-trailing-sweep-${weeks.length}w-${stamp}`;
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);
  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 34 weekly-hold-engine-research",
      sourceModel: "dealer",
      assetClass,
      expectedPairs,
      expectedPairCount: expectedPairs.length,
      displayedWeekFrom: fromDate,
      displayedWeekTo: toDate,
      weekOpenUtcs: weeks,
      closedWeeksOnly: true,
      currentWeekOpenUtc,
      entryStyle: "weekly_hold",
      variants,
      strategyChanges: "execution_exit_sweep_only",
      targetAdrPct,
      pathResolution: "1h",
      sequencing: "trail anchors update after each bar if no stop was hit",
    },
    summaries,
    pairSummaries,
    basketPathByVariant,
    weeksByVariant,
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(allPairRows)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    assetClass,
    fromDate,
    toDate,
    targetAdrPct,
    expectedPairs,
    variants,
    summaries,
    weeksByVariant,
    jsonPath,
    csvPath,
  }), "utf8");

  console.log(`Dealer Weekly Hold trailing sweep: ${assetClass} ${expectedPairs.length} pairs`);
  console.log(`Weeks: ${weeks.length}`);
  for (const summary of summaries) {
    console.log([
      summary.variantLabel.padEnd(16),
      `Raw ${summary.totalRawPct >= 0 ? "+" : ""}${summary.totalRawPct.toFixed(2)}%`,
      `ADR ${summary.totalAdrPct >= 0 ? "+" : ""}${summary.totalAdrPct.toFixed(2)}%`,
      `W/L/F ${summary.weeklyWins}/${summary.weeklyLosses}/${summary.weeklyFlat}`,
      `ADR DD ${summary.adrAdverseDrawdownPct.toFixed(2)}%`,
      `trail exits ${summary.trailStopExits}`,
    ].join(" | "));
  }
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Markdown: ${mdPath}`);
  await getPool().end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
