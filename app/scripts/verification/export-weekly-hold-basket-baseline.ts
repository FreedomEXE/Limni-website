/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-weekly-hold-basket-baseline.ts
 *
 * Description:
 * Exports a Gate 34 receipt-backed Weekly Hold basket baseline for one source
 * model and one asset class. The report preserves the app source/ADR math while
 * using the existing hourly basket path engine for portfolio peak/DD proof.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { deriveCotReportDate, listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { AssetClass } from "@/lib/cotMarkets";
import {
  filterByModel,
  getCanonicalBasketWeek,
  type BaseBasketModel,
  type BasketDirection,
} from "@/lib/performance/basketSource";
import { readSnapshot } from "@/lib/cotStore";
import { derivePairDirectionsByBaseWithNeutral, derivePairDirectionsWithNeutral } from "@/lib/cotCompute";
import { readFrozenSourceLedgerWeek } from "@/lib/sourceFreeze/sourceLedger";
import { getPool } from "@/lib/db";
import { getExecutionWeeklyPairReturns } from "@/lib/pairReturns";
import {
  deriveExecutionWeeklyReturnFromHourlyBars,
  loadExecutionWeeklyReturnFromHourlyBars,
  type ExecutionWeeklyReturn,
} from "@/lib/executionWeeklyReturns";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import {
  computeBasketPath,
  computeMultiWeekBasketPath,
  type BasketPathPoint,
  type BasketPathResult,
} from "@/lib/performance/basketPathEngine";
import { loadPathBars, type PathBarMap } from "@/lib/performance/pathBarLoader";
import { buildWeeklyHoldLedger } from "@/lib/performance/positionLedger";
import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";

loadEnvConfig(process.cwd());

type ExecutionSource = "stored_pair_period_returns" | "derived_canonical_1h" | "missing";

type PairWeekRow = {
  weekOpenUtc: string;
  weekLabel: string;
  pineWeekKey: string;
  symbol: string;
  model: BaseBasketModel;
  assetClass: AssetClass;
  direction: BasketDirection | "MISSING";
  sourceReportDate: string | null;
  executionReturnSource: ExecutionSource;
  executionReturnComplete: boolean | null;
  executionReturnWarnings: string[];
  entryPrice: number | null;
  exitPrice: number | null;
  pairAdrPct: number | null;
  adrSource: "canonical_price_bars" | "asset_default" | "missing";
  rawReturnPct: number | null;
  adrReturnPct: number | null;
  maxAdverseRawPct: number | null;
  maxAdverseAdrPct: number | null;
  outcome: "WIN" | "LOSS" | "FLAT" | "NO_TRADE" | "MISSING_SIGNAL" | "MISSING_RETURN";
  missingReason: string | null;
};

type WeekReceipt = {
  weekOpenUtc: string;
  weekLabel: string;
  pineWeekKey: string;
  pairRows: PairWeekRow[];
  pathBarsBySymbol: Record<string, number>;
  missingPathBars: string[];
  totals: {
    expectedPairs: number;
    tradeRows: number;
    wins: number;
    losses: number;
    flat: number;
    noTradeRows: number;
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

type SummaryStats = {
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
  totalRawPct: number;
  totalAdrPct: number;
  grossWeeklyRawProfitPct: number;
  grossWeeklyRawLossPct: number;
  grossWeeklyAdrProfitPct: number;
  grossWeeklyAdrLossPct: number;
  weeklyRawProfitFactor: number | null;
  weeklyAdrProfitFactor: number | null;
  grossTradeRawProfitPct: number;
  grossTradeRawLossPct: number;
  grossTradeAdrProfitPct: number;
  grossTradeAdrLossPct: number;
  tradeRawProfitFactor: number | null;
  tradeAdrProfitFactor: number | null;
};

type PairSummary = {
  symbol: string;
  rows: number;
  tradeRows: number;
  wins: number;
  losses: number;
  flat: number;
  totalRawPct: number;
  totalAdrPct: number;
  maxAdverseRawPct: number;
  maxAdverseAdrPct: number;
  avgAdverseRawPct: number;
  avgAdverseAdrPct: number;
  derivedRows: number;
  defaultAdrRows: number;
  missingSignalRows: number;
  missingReturnRows: number;
};

type ExcludedWeek = {
  weekOpenUtc: string;
  pineWeekKey: string;
  sourceReportDate: string;
  reason: string;
};

const CSV_COLUMNS = [
  "weekLabel",
  "symbol",
  "model",
  "assetClass",
  "direction",
  "executionReturnSource",
  "executionReturnComplete",
  "entryPrice",
  "exitPrice",
  "pairAdrPct",
  "adrSource",
  "rawReturnPct",
  "adrReturnPct",
  "maxAdverseRawPct",
  "maxAdverseAdrPct",
  "outcome",
  "missingReason",
] as const;

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parseExplicitWeeks() {
  const raw = argValue("weeks");
  if (!raw) return null;
  const weeks = raw
    .split(",")
    .map((week) => week.trim())
    .filter(Boolean);
  if (weeks.length === 0) throw new Error("--weeks was provided but did not include any week open UTC values.");
  return weeks;
}

function parseModel(): BaseBasketModel {
  const value = (argValue("model") ?? "dealer").trim().toLowerCase();
  if (value === "dealer" || value === "commercial" || value === "sentiment" || value === "strength") {
    return value;
  }
  throw new Error("--model must be dealer, commercial, sentiment, or strength.");
}

function parseAssetClass(): AssetClass {
  const value = (argValue("asset-class") ?? "fx").trim().toLowerCase();
  if (value === "fx" || value === "indices" || value === "commodities" || value === "crypto") {
    return value;
  }
  throw new Error("--asset-class must be fx, indices, commodities, or crypto.");
}

function defaultOutDir() {
  const fromAppDir = path.basename(process.cwd()).toLowerCase() === "app";
  return fromAppDir
    ? "reports/data-verification/weekly-hold-basket-baseline"
    : "app/reports/data-verification/weekly-hold-basket-baseline";
}

function weekLabel(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.toFormat("yyyy-LL-dd") : weekOpenUtc.slice(0, 10);
}

function pineWeekKey(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.plus({ days: 1 }).toISODate() ?? weekOpenUtc.slice(0, 10) : weekOpenUtc.slice(0, 10);
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

function toCsv(rows: PairWeekRow[]) {
  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
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

function filterWeeksByExcludedSourceReports(
  weeks: string[],
  options: { from: string | null; to: string | null },
) {
  if (!options.from && !options.to) {
    return { kept: weeks, excluded: [] as ExcludedWeek[] };
  }

  const excluded: ExcludedWeek[] = [];
  const kept = weeks.filter((weekOpenUtc) => {
    const sourceReportDate = deriveCotReportDate(weekOpenUtc);
    const inExcludedRange = Boolean(
      sourceReportDate
        && (!options.from || sourceReportDate >= options.from)
        && (!options.to || sourceReportDate <= options.to),
    );
    if (inExcludedRange) {
      excluded.push({
        weekOpenUtc,
        pineWeekKey: pineWeekKey(weekOpenUtc),
        sourceReportDate,
        reason: "excluded_source_report_date",
      });
      return false;
    }
    return true;
  });

  return { kept, excluded };
}

function directionAdjustedReturn(direction: BasketDirection, underlyingRawReturnPct: number) {
  if (direction === "SHORT") return -underlyingRawReturnPct;
  if (direction === "LONG") return underlyingRawReturnPct;
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

function profitFactor(grossProfit: number, grossLoss: number) {
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function maxAdverseRawPct(options: {
  direction: BasketDirection | "MISSING";
  entryPrice: number | null;
  bars: Array<{ highPrice: number; lowPrice: number }>;
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

function barsForTrade(bars: PathBarMap, trade: WeeklyHoldTrade) {
  const entryMs = Date.parse(trade.detail?.entryTimeUtc ?? "");
  const exitMs = Date.parse(trade.detail?.exitTimeUtc ?? "");
  return (bars.get(trade.symbol.toUpperCase()) ?? []).filter((bar) => {
    const openMs = Date.parse(bar.barOpenUtc);
    return Number.isFinite(openMs) && Number.isFinite(entryMs) && Number.isFinite(exitMs)
      && openMs >= entryMs && openMs < exitMs;
  });
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
  deriveMissingExecution: boolean;
  derivedRows?: Map<string, ExecutionWeeklyReturn | null>;
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

  if (!options.deriveMissingExecution) {
    return {
      row: null,
      source: "missing" as const,
      complete: null,
      warnings: [] as string[],
    };
  }

  const derived = options.derivedRows?.has(options.symbol)
    ? options.derivedRows.get(options.symbol) ?? null
    : await loadExecutionWeeklyReturnFromHourlyBars({
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

async function loadModelSignals(options: {
  weekOpenUtc: string;
  model: BaseBasketModel;
  assetClass: AssetClass;
}) {
  const { weekOpenUtc, model, assetClass } = options;
  const frozen = await readFrozenSourceLedgerWeek(weekOpenUtc);
  if (frozen) {
    return frozen.signals.filter(
      (signal) => signal.model === model && signal.assetClass === assetClass,
    );
  }

  if (model === "dealer" || model === "commercial") {
    const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const snapshot = await readSnapshot({ assetClass, reportDate });

    if (!snapshot) {
      return pairDefs.map((pair) => ({
        weekOpenUtc,
        model,
        symbol: pair.pair,
        assetClass,
        direction: "NEUTRAL" as const,
        sourceReportDate: reportDate,
        metadata: { reason: "missing_snapshot" },
      }));
    }

    const derivedPairs = assetClass === "fx"
      ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, model)
      : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, model);

    return pairDefs.map((pair) => {
      const derived = derivedPairs[pair.pair];
      return {
        weekOpenUtc,
        model,
        symbol: pair.pair,
        assetClass,
        direction: (derived?.direction as BasketDirection | undefined) ?? "NEUTRAL",
        sourceReportDate: reportDate,
        metadata: derived ? undefined : { reason: "no_derivation" },
      };
    });
  }

  const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
  return filterByModel(basketWeek, model)
    .filter((signal) => signal.assetClass === assetClass);
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

function summarizeReturnOnly(totalReturnPct: number, maxActivePositions = 0): PathSummaryReceipt {
  const total = round(totalReturnPct) ?? 0;
  return {
    totalReturnPct: total,
    peakPct: Math.max(0, total),
    peakTsUtc: null,
    troughPct: Math.min(0, total),
    troughTsUtc: null,
    closeEquityMaxDrawdownPct: total < 0 ? Math.abs(total) : 0,
    closeEquityMaxDrawdownTsUtc: null,
    adverseMaxDrawdownPct: total < 0 ? Math.abs(total) : 0,
    adverseMaxDrawdownTsUtc: null,
    peakToCloseGivebackPct: total < 0 ? Math.abs(total) : 0,
    troughToCloseRecoveryPct: total > 0 ? total : 0,
    maxActivePositions,
    points: 0,
  };
}

function summarizeReturnOnlyMulti(weeks: WeekReceipt[], field: "rawReturnPct" | "adrReturnPct") {
  const total = weeks.reduce((sum, week) => sum + week.totals[field], 0);
  const maxActivePositions = Math.max(0, ...weeks.map((week) => week.totals.tradeRows));
  return summarizeReturnOnly(total, maxActivePositions);
}

function summarizeStats(weeks: WeekReceipt[], rawMulti: PathSummaryReceipt, adrMulti: PathSummaryReceipt): SummaryStats {
  const weeklyRawReturns = weeks.map((week) => week.totals.rawReturnPct);
  const weeklyAdrReturns = weeks.map((week) => week.totals.adrReturnPct);
  const allRows = weeks.flatMap((week) => week.pairRows);
  const tradeRows = allRows.filter((row) => row.outcome === "WIN" || row.outcome === "LOSS" || row.outcome === "FLAT");
  const grossWeeklyRawProfit = weeklyRawReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossWeeklyRawLoss = Math.abs(weeklyRawReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const grossWeeklyAdrProfit = weeklyAdrReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossWeeklyAdrLoss = Math.abs(weeklyAdrReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const tradeRawReturns = tradeRows.map((row) => row.rawReturnPct ?? 0);
  const tradeAdrReturns = tradeRows.map((row) => row.adrReturnPct ?? 0);
  const grossTradeRawProfit = tradeRawReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossTradeRawLoss = Math.abs(tradeRawReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const grossTradeAdrProfit = tradeAdrReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossTradeAdrLoss = Math.abs(tradeAdrReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const weeklyWins = weeklyAdrReturns.filter((value) => value > 0).length;
  const weeklyLosses = weeklyAdrReturns.filter((value) => value < 0).length;
  const weeklyFlat = weeklyAdrReturns.filter((value) => value === 0).length;
  const tradeWins = tradeRows.filter((row) => (row.adrReturnPct ?? 0) > 0).length;
  const tradeLosses = tradeRows.filter((row) => (row.adrReturnPct ?? 0) < 0).length;
  const tradeFlat = tradeRows.filter((row) => (row.adrReturnPct ?? 0) === 0).length;

  return {
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
    totalRawPct: rawMulti.totalReturnPct,
    totalAdrPct: adrMulti.totalReturnPct,
    grossWeeklyRawProfitPct: round(grossWeeklyRawProfit) ?? 0,
    grossWeeklyRawLossPct: round(grossWeeklyRawLoss) ?? 0,
    grossWeeklyAdrProfitPct: round(grossWeeklyAdrProfit) ?? 0,
    grossWeeklyAdrLossPct: round(grossWeeklyAdrLoss) ?? 0,
    weeklyRawProfitFactor: profitFactor(grossWeeklyRawProfit, grossWeeklyRawLoss),
    weeklyAdrProfitFactor: profitFactor(grossWeeklyAdrProfit, grossWeeklyAdrLoss),
    grossTradeRawProfitPct: round(grossTradeRawProfit) ?? 0,
    grossTradeRawLossPct: round(grossTradeRawLoss) ?? 0,
    grossTradeAdrProfitPct: round(grossTradeAdrProfit) ?? 0,
    grossTradeAdrLossPct: round(grossTradeAdrLoss) ?? 0,
    tradeRawProfitFactor: profitFactor(grossTradeRawProfit, grossTradeRawLoss),
    tradeAdrProfitFactor: profitFactor(grossTradeAdrProfit, grossTradeAdrLoss),
  };
}

function buildPairSummaries(rows: PairWeekRow[], expectedPairs: string[]): PairSummary[] {
  return expectedPairs.map((symbol) => {
    const symbolRows = rows.filter((row) => row.symbol === symbol);
    const tradeRows = symbolRows.filter((row) => row.outcome === "WIN" || row.outcome === "LOSS" || row.outcome === "FLAT");
    const ddRows = symbolRows.filter((row) => row.maxAdverseRawPct !== null || row.maxAdverseAdrPct !== null);
    return {
      symbol,
      rows: symbolRows.length,
      tradeRows: tradeRows.length,
      wins: symbolRows.filter((row) => row.outcome === "WIN").length,
      losses: symbolRows.filter((row) => row.outcome === "LOSS").length,
      flat: symbolRows.filter((row) => row.outcome === "FLAT").length,
      totalRawPct: round(symbolRows.reduce((sum, row) => sum + (row.rawReturnPct ?? 0), 0)) ?? 0,
      totalAdrPct: round(symbolRows.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0)) ?? 0,
      maxAdverseRawPct: round(Math.max(0, ...symbolRows.map((row) => row.maxAdverseRawPct ?? 0))) ?? 0,
      maxAdverseAdrPct: round(Math.max(0, ...symbolRows.map((row) => row.maxAdverseAdrPct ?? 0))) ?? 0,
      avgAdverseRawPct: round(
        ddRows.length > 0
          ? ddRows.reduce((sum, row) => sum + (row.maxAdverseRawPct ?? 0), 0) / ddRows.length
          : 0,
      ) ?? 0,
      avgAdverseAdrPct: round(
        ddRows.length > 0
          ? ddRows.reduce((sum, row) => sum + (row.maxAdverseAdrPct ?? 0), 0) / ddRows.length
          : 0,
      ) ?? 0,
      derivedRows: symbolRows.filter((row) => row.executionReturnSource === "derived_canonical_1h").length,
      defaultAdrRows: symbolRows.filter((row) => row.adrSource === "asset_default").length,
      missingSignalRows: symbolRows.filter((row) => row.outcome === "MISSING_SIGNAL").length,
      missingReturnRows: symbolRows.filter((row) => row.outcome === "MISSING_RETURN").length,
    };
  });
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  model: BaseBasketModel;
  assetClass: AssetClass;
  fromDate: string | null;
  toDate: string | null;
  excludedSourceReportFrom: string | null;
  excludedSourceReportTo: string | null;
  excludedWeeks: ExcludedWeek[];
  explicitWeekCount: number | null;
  deriveMissingExecution: boolean;
  skipPath: boolean;
  targetAdrPct: number;
  expectedPairs: string[];
  summary: SummaryStats;
  rawPath: PathSummaryReceipt;
  adrPath: PathSummaryReceipt;
  weeks: WeekReceipt[];
  pairSummaries: PairSummary[];
  jsonPath: string;
  csvPath: string;
}) {
  const lines = [
    `# Gate 34 Weekly Hold Basket Baseline - ${options.model} ${options.assetClass.toUpperCase()}`,
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    "- Gate: Gate 34 weekly-hold-engine-research",
    "- Entry style: Weekly Hold",
    "- Strategy changes: none",
    `- Source model: ${options.model}`,
    `- Asset class: ${options.assetClass}`,
    `- Expected pair count: ${options.expectedPairs.length}`,
    `- Displayed week filter: ${options.fromDate ?? "-"} -> ${options.toDate ?? "-"}`,
    `- Explicit week inputs: ${options.explicitWeekCount ?? "no"}`,
    `- Excluded source report date filter: ${options.excludedSourceReportFrom ?? "-"} -> ${options.excludedSourceReportTo ?? "-"}`,
    `- Excluded weeks: ${options.excludedWeeks.length}`,
    `- Derive missing execution returns from canonical 1H bars: ${options.deriveMissingExecution ? "yes" : "no"}`,
    `- Intrabar path engine: ${options.skipPath ? "skipped" : "included"}`,
    `- Target ADR percent: ${options.targetAdrPct}`,
    "",
    "## Portfolio Summary",
    "",
    `- Weeks: ${options.summary.weeks}`,
    `- Total trade rows: ${options.summary.totalTradeRows}`,
    `- Weekly W/L/Flat: ${options.summary.weeklyWins}/${options.summary.weeklyLosses}/${options.summary.weeklyFlat}`,
    `- Weekly win rate: ${fixed(options.summary.weeklyWinRatePct)}%`,
    `- Trade W/L/Flat: ${options.summary.tradeWins}/${options.summary.tradeLosses}/${options.summary.tradeFlat}`,
    `- Trade win rate: ${fixed(options.summary.tradeWinRatePct)}%`,
    `- Total raw return: ${signed(options.summary.totalRawPct)}`,
    `- Total ADR-normalized return: ${signed(options.summary.totalAdrPct)}`,
    `- Weekly raw profit factor: ${formatProfitFactor(options.summary.weeklyRawProfitFactor)}`,
    `- Weekly ADR profit factor: ${formatProfitFactor(options.summary.weeklyAdrProfitFactor)}`,
    `- Trade raw profit factor: ${formatProfitFactor(options.summary.tradeRawProfitFactor)}`,
    `- Trade ADR profit factor: ${formatProfitFactor(options.summary.tradeAdrProfitFactor)}`,
    "",
    "## Basket Path",
    "",
    "| Basis | Return | Peak | Peak TS | Trough | Trough TS | Close DD | Adverse DD | Adverse DD TS | Peak Giveback | Max Active |",
    "|---|---:|---:|---|---:|---|---:|---:|---|---:|---:|",
    `| Raw | ${signed(options.rawPath.totalReturnPct)} | ${signed(options.rawPath.peakPct)} | ${options.rawPath.peakTsUtc ?? "-"} | ${signed(options.rawPath.troughPct)} | ${options.rawPath.troughTsUtc ?? "-"} | ${fixed(options.rawPath.closeEquityMaxDrawdownPct)}% | ${fixed(options.rawPath.adverseMaxDrawdownPct)}% | ${options.rawPath.adverseMaxDrawdownTsUtc ?? "-"} | ${fixed(options.rawPath.peakToCloseGivebackPct)}% | ${options.rawPath.maxActivePositions} |`,
    `| ADR Norm | ${signed(options.adrPath.totalReturnPct)} | ${signed(options.adrPath.peakPct)} | ${options.adrPath.peakTsUtc ?? "-"} | ${signed(options.adrPath.troughPct)} | ${options.adrPath.troughTsUtc ?? "-"} | ${fixed(options.adrPath.closeEquityMaxDrawdownPct)}% | ${fixed(options.adrPath.adverseMaxDrawdownPct)}% | ${options.adrPath.adverseMaxDrawdownTsUtc ?? "-"} | ${fixed(options.adrPath.peakToCloseGivebackPct)}% | ${options.adrPath.maxActivePositions} |`,
    "",
    "Drawdown note: close DD uses synchronized hourly close marks. Adverse DD uses each pair's same-hour high/low adverse mark and is intentionally conservative at 1h resolution because intrabar extremes across pairs may not occur at the exact same minute.",
    "",
    "## Weekly Rows",
    "",
    "| Week | Trades | W/L/F | Raw | ADR Norm | Raw Adverse DD | ADR Adverse DD | Missing Signal | Missing Return | Derived | Default ADR | Missing Bars |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const week of options.weeks) {
    const derived = week.pairRows.filter((row) => row.executionReturnSource === "derived_canonical_1h").length;
    const defaultAdr = week.pairRows.filter((row) => row.adrSource === "asset_default").length;
    lines.push(
      `| ${week.pineWeekKey} | ${week.totals.tradeRows} | ${week.totals.wins}/${week.totals.losses}/${week.totals.flat} | ${signed(week.totals.rawReturnPct)} | ${signed(week.totals.adrReturnPct)} | ${fixed(week.path.raw.adverseMaxDrawdownPct)}% | ${fixed(week.path.adr.adverseMaxDrawdownPct)}% | ${week.totals.missingSignalRows} | ${week.totals.missingReturnRows} | ${derived} | ${defaultAdr} | ${week.missingPathBars.length} |`,
    );
  }

  if (options.excludedWeeks.length > 0) {
    lines.push(
      "",
      "## Excluded Source Report Weeks",
      "",
      "| Week | Source Report Date | Reason |",
      "|---|---|---|",
    );
    for (const week of options.excludedWeeks) {
      lines.push(`| ${week.pineWeekKey} | ${week.sourceReportDate} | ${week.reason} |`);
    }
  }

  lines.push(
    "",
    "## Pair Summary",
    "",
    "| Pair | Rows | W/L/F | Raw | ADR Norm | Max Raw DD | Max ADR DD | Avg Raw DD | Avg ADR DD | Derived | Default ADR | Missing |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  );

  for (const pair of options.pairSummaries) {
    lines.push(
      `| ${pair.symbol} | ${pair.tradeRows} | ${pair.wins}/${pair.losses}/${pair.flat} | ${signed(pair.totalRawPct)} | ${signed(pair.totalAdrPct)} | ${fixed(pair.maxAdverseRawPct)}% | ${fixed(pair.maxAdverseAdrPct)}% | ${fixed(pair.avgAdverseRawPct)}% | ${fixed(pair.avgAdverseAdrPct)}% | ${pair.derivedRows} | ${pair.defaultAdrRows} | ${pair.missingSignalRows + pair.missingReturnRows} |`,
    );
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

async function buildWeekReceipt(options: {
  weekOpenUtc: string;
  model: BaseBasketModel;
  assetClass: AssetClass;
  expectedPairs: string[];
  deriveMissingExecution: boolean;
  skipPath: boolean;
  targetAdrPct: number;
}): Promise<{ receipt: WeekReceipt; rawPath: BasketPathResult | null; adrPath: BasketPathResult | null }> {
  const { weekOpenUtc, model, assetClass, expectedPairs, deriveMissingExecution, skipPath, targetAdrPct } = options;
  const [signals, executionRows, adrMap] = await Promise.all([
    loadModelSignals({ weekOpenUtc, model, assetClass }),
    getExecutionWeeklyPairReturns(weekOpenUtc),
    loadWeeklyAdrMap(weekOpenUtc),
  ]);
  const signalBySymbol = new Map(signals.map((signal) => [signal.symbol.toUpperCase(), signal]));
  const executionRowsForAsset = executionRows.filter((row) => row.assetClass === assetClass);
  const executionWindow = getExecutionWeekWindow(weekOpenUtc, assetClass);
  const entryTimeUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? weekOpenUtc;
  const exitTimeUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? weekOpenUtc;
  const storedExecutionSymbols = new Set(executionRowsForAsset.map((row) => row.symbol.toUpperCase()));
  const missingExecutionSymbols = expectedPairs.filter((symbol) => !storedExecutionSymbols.has(symbol));
  const derivedExecutionRows = new Map<string, ExecutionWeeklyReturn | null>();

  if (deriveMissingExecution && missingExecutionSymbols.length > 0) {
    const barsBySymbol = await loadPathBars(missingExecutionSymbols, entryTimeUtc, exitTimeUtc, "1h");
    for (const symbol of missingExecutionSymbols) {
      derivedExecutionRows.set(
        symbol,
        deriveExecutionWeeklyReturnFromHourlyBars({
          symbol,
          assetClass,
          weekOpenUtc,
          bars: barsBySymbol.get(symbol) ?? [],
        }),
      );
    }
  }

  const pairRows: PairWeekRow[] = [];
  const trades: WeeklyHoldTrade[] = [];

  for (const symbol of expectedPairs) {
    const signal = signalBySymbol.get(symbol) ?? null;
    const direction = signal?.direction ?? "MISSING";
    const execution = await resolveExecutionReturn({
      symbol,
      assetClass,
      weekOpenUtc,
      storedRows: executionRowsForAsset,
      deriveMissingExecution,
      derivedRows: derivedExecutionRows,
    });
    const pairAdrPct = getAdrPct(adrMap, symbol, assetClass);
    const adrSource = adrMap.has(symbol) ? "canonical_price_bars" : "asset_default";
    const rawReturn = execution.row && direction !== "MISSING"
      ? directionAdjustedReturn(direction, execution.row.returnPct)
      : null;
    const adrReturn = rawReturn !== null && pairAdrPct > 0
      ? rawReturn * (targetAdrPct / pairAdrPct)
      : null;
    const outcome = outcomeFor(direction, rawReturn, adrReturn);
    const missingReason = direction === "MISSING"
      ? "missing_signal"
      : !execution.row
        ? "missing_execution_return"
        : direction === "NEUTRAL"
          ? "neutral_signal"
          : null;

    if ((direction === "LONG" || direction === "SHORT") && execution.row && rawReturn !== null && adrReturn !== null) {
      trades.push({
        symbol,
        assetClass,
        direction,
        openPrice: execution.row.openPrice,
        closePrice: execution.row.closePrice,
        returnPct: adrReturn,
        rawReturnPct: rawReturn,
        normalizedReturnPct: adrReturn,
        displayReturnPct: adrReturn,
        adrPct: pairAdrPct,
        adrMultiplier: targetAdrPct / pairAdrPct,
        returnMode: "normalized",
        source: model,
        tier: null,
        detail: {
          tradeNumber: trades.length + 1,
          entryTimeUtc,
          exitTimeUtc,
          exitReason: "week_close",
          anchorPrice: execution.row.openPrice,
          tpPrice: null,
          adrPct: pairAdrPct,
          maePct: null,
        },
      });
    }

    pairRows.push({
      weekOpenUtc,
      weekLabel: weekLabel(weekOpenUtc),
      pineWeekKey: pineWeekKey(weekOpenUtc),
      symbol,
      model,
      assetClass,
      direction,
      sourceReportDate: signal?.sourceReportDate ?? null,
      executionReturnSource: execution.source,
      executionReturnComplete: execution.complete,
      executionReturnWarnings: execution.warnings,
      entryPrice: round(execution.row?.openPrice ?? null),
      exitPrice: round(execution.row?.closePrice ?? null),
      pairAdrPct: round(pairAdrPct),
      adrSource,
      rawReturnPct: round(rawReturn),
      adrReturnPct: round(adrReturn),
      maxAdverseRawPct: null,
      maxAdverseAdrPct: null,
      outcome,
      missingReason,
    });
  }

  const rawReturnPct = trades.reduce((sum, trade) => sum + (trade.rawReturnPct ?? 0), 0);
  const adrReturnPct = trades.reduce((sum, trade) => sum + (trade.normalizedReturnPct ?? trade.returnPct), 0);
  const result: WeeklyHoldResult = {
    weekOpenUtc,
    executionWindowOpenUtc: entryTimeUtc,
    executionWindowCloseUtc: exitTimeUtc,
    biasSourceId: model,
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

  let rawPath: BasketPathResult | null = null;
  let adrPath: BasketPathResult | null = null;
  let rawPathSummary = summarizeReturnOnly(rawReturnPct, trades.length);
  let adrPathSummary = summarizeReturnOnly(adrReturnPct, trades.length);
  let pathBarsBySymbol = Object.fromEntries(expectedPairs.map((symbol) => [symbol, 0]));
  let missingPathBars: string[] = [];

  if (!skipPath) {
    const ledger = await buildWeeklyHoldLedger(result, { entryStyleId: "weekly_hold" });
    const bars = await loadPathBars(
      Array.from(new Set(trades.map((trade) => trade.symbol))).sort(),
      ledger.weekOpenUtc,
      ledger.weekCloseUtc,
    );

    for (const row of pairRows) {
      const trade = trades.find((candidate) => candidate.symbol === row.symbol);
      if (!trade) continue;
      const adverseRaw = maxAdverseRawPct({
        direction: row.direction,
        entryPrice: row.entryPrice,
        bars: barsForTrade(bars, trade),
      });
      row.maxAdverseRawPct = round(adverseRaw);
      row.maxAdverseAdrPct = adverseRaw !== null && row.pairAdrPct !== null && row.pairAdrPct > 0
        ? round(adverseRaw * (targetAdrPct / row.pairAdrPct))
        : null;
    }

    rawPath = computeBasketPath(ledger, bars, { returnMode: "raw" });
    adrPath = computeBasketPath(ledger, bars, { returnMode: "normalized" });
    rawPathSummary = summarizePath(rawPath);
    adrPathSummary = summarizePath(adrPath);
    pathBarsBySymbol = Object.fromEntries(
      expectedPairs.map((symbol) => [symbol, bars.get(symbol)?.length ?? 0]),
    );
    missingPathBars = Object.entries(pathBarsBySymbol)
      .filter(([, count]) => count === 0)
      .map(([symbol]) => symbol);
  }
  const wins = pairRows.filter((row) => row.outcome === "WIN").length;
  const losses = pairRows.filter((row) => row.outcome === "LOSS").length;
  const flat = pairRows.filter((row) => row.outcome === "FLAT").length;
  const rawReturns = pairRows.map((row) => row.rawReturnPct ?? 0);
  const adrReturns = pairRows.map((row) => row.adrReturnPct ?? 0);
  const grossRawProfitPct = rawReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossRawLossPct = Math.abs(rawReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const grossAdrProfitPct = adrReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossAdrLossPct = Math.abs(adrReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));

  return {
    receipt: {
      weekOpenUtc,
      weekLabel: weekLabel(weekOpenUtc),
      pineWeekKey: pineWeekKey(weekOpenUtc),
      pairRows,
      pathBarsBySymbol,
      missingPathBars,
      totals: {
        expectedPairs: expectedPairs.length,
        tradeRows: trades.length,
        wins,
        losses,
        flat,
        noTradeRows: pairRows.filter((row) => row.outcome === "NO_TRADE").length,
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
        raw: rawPathSummary,
        adr: adrPathSummary,
      },
    },
    rawPath,
    adrPath,
  };
}

async function main() {
  const model = parseModel();
  const assetClass = parseAssetClass();
  const fromDate = argValue("from") ?? "2026-01-01";
  const toDate = argValue("to") ?? "2026-06-08";
  const excludedSourceReportFrom = argValue("exclude-source-report-from") ?? null;
  const excludedSourceReportTo = argValue("exclude-source-report-to") ?? null;
  const deriveMissingExecution = !hasFlag("no-derive-missing-execution");
  const skipPath = hasFlag("skip-path");
  const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? defaultOutDir());
  const expectedPairs = PAIRS_BY_ASSET_CLASS[assetClass].map((pair) => pair.pair.toUpperCase());
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const explicitWeeks = parseExplicitWeeks();
  const dateFilteredWeeks = filterWeeksByDate(
    selectClosedWeeks(explicitWeeks ?? await listDataSectionWeeks(), currentWeekOpenUtc),
    { from: fromDate, to: toDate },
  );
  const { kept: weeks, excluded: excludedWeeks } = filterWeeksByExcludedSourceReports(
    dateFilteredWeeks,
    { from: excludedSourceReportFrom, to: excludedSourceReportTo },
  );
  const targetAdrPct = getTargetAdrPct();

  if (weeks.length === 0) {
    throw new Error("No closed weeks were found for the basket baseline export.");
  }

  await mkdir(outDir, { recursive: true });

  const weekReceipts: WeekReceipt[] = [];
  const rawPaths: BasketPathResult[] = [];
  const adrPaths: BasketPathResult[] = [];
  for (const weekOpenUtc of weeks) {
    const { receipt, rawPath, adrPath } = await buildWeekReceipt({
      weekOpenUtc,
      model,
      assetClass,
      expectedPairs,
      deriveMissingExecution,
      skipPath,
      targetAdrPct,
    });
    weekReceipts.push(receipt);
    if (rawPath) rawPaths.push(rawPath);
    if (adrPath) adrPaths.push(adrPath);
  }

  const rawMulti = skipPath ? null : computeMultiWeekBasketPath(rawPaths);
  const adrMulti = skipPath ? null : computeMultiWeekBasketPath(adrPaths);
  const rawMultiSummary = rawMulti
    ? summarizePath({
      weekOpenUtc: weeks[0] ?? "",
      strategyId: model,
      entryStyleId: "weekly_hold",
      returnMode: "raw",
      resolution: "1h",
      points: rawMulti.points,
      summary: rawMulti.summary,
    })
    : summarizeReturnOnlyMulti(weekReceipts, "rawReturnPct");
  const adrMultiSummary = adrMulti
    ? summarizePath({
      weekOpenUtc: weeks[0] ?? "",
      strategyId: model,
      entryStyleId: "weekly_hold",
      returnMode: "normalized",
      resolution: "1h",
      points: adrMulti.points,
      summary: adrMulti.summary,
    })
    : summarizeReturnOnlyMulti(weekReceipts, "adrReturnPct");
  const summary = summarizeStats(weekReceipts, rawMultiSummary, adrMultiSummary);
  const allPairRows = weekReceipts.flatMap((week) => week.pairRows);
  const pairSummaries = buildPairSummaries(allPairRows, expectedPairs);
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `${assetClass}-${expectedPairs.length}pair-${model}-weekly-hold-baseline-${weekReceipts.length}w-${stamp}`;
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);

  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 34 weekly-hold-engine-research",
      sourceModel: model,
      assetClass,
      expectedPairs,
      expectedPairCount: expectedPairs.length,
      displayedWeekFrom: fromDate,
      displayedWeekTo: toDate,
      explicitWeekCount: explicitWeeks?.length ?? null,
      dateFilteredWeekCount: dateFilteredWeeks.length,
      selectedWeekCount: weeks.length,
      excludedSourceReportFrom,
      excludedSourceReportTo,
      excludedWeeks,
      weekOpenUtcs: weeks,
      closedWeeksOnly: true,
      currentWeekOpenUtc,
      entryStyle: "weekly_hold",
      strategyChanges: "none",
      targetAdrPct,
      deriveMissingExecution,
      pathResolution: skipPath ? "skipped" : "1h",
      skipPath,
    },
    summary,
    pairSummaries,
    basketPath: {
      raw: {
        summary: rawMultiSummary,
        points: rawMulti?.points ?? [],
      },
      adrNormalized: {
        summary: adrMultiSummary,
        points: adrMulti?.points ?? [],
      },
    },
    weeks: weekReceipts,
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(allPairRows)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    model,
    assetClass,
    fromDate,
    toDate,
    excludedSourceReportFrom,
    excludedSourceReportTo,
    excludedWeeks,
    explicitWeekCount: explicitWeeks?.length ?? null,
    deriveMissingExecution,
    skipPath,
    targetAdrPct,
    expectedPairs,
    summary,
    rawPath: rawMultiSummary,
    adrPath: adrMultiSummary,
    weeks: weekReceipts,
    pairSummaries,
    jsonPath,
    csvPath,
  }), "utf8");

  console.log(`Weekly Hold basket baseline: ${assetClass} ${expectedPairs.length} pairs ${model}`);
  console.log(`Weeks: ${summary.weeks}`);
  console.log(`Excluded source-report weeks: ${excludedWeeks.length}`);
  console.log(`Trade rows: ${summary.totalTradeRows}`);
  console.log(`Weekly W/L/Flat: ${summary.weeklyWins}/${summary.weeklyLosses}/${summary.weeklyFlat}`);
  console.log(`Weekly win rate: ${summary.weeklyWinRatePct.toFixed(2)}%`);
  console.log(`Total raw return: ${summary.totalRawPct >= 0 ? "+" : ""}${summary.totalRawPct.toFixed(2)}%`);
  console.log(`Total ADR return: ${summary.totalAdrPct >= 0 ? "+" : ""}${summary.totalAdrPct.toFixed(2)}%`);
  console.log(`Weekly raw PF: ${formatProfitFactor(summary.weeklyRawProfitFactor)}`);
  console.log(`Weekly ADR PF: ${formatProfitFactor(summary.weeklyAdrProfitFactor)}`);
  console.log(`Raw path peak/DD: ${rawMultiSummary.peakPct.toFixed(2)}% / ${rawMultiSummary.adverseMaxDrawdownPct.toFixed(2)}%`);
  console.log(`ADR path peak/DD: ${adrMultiSummary.peakPct.toFixed(2)}% / ${adrMultiSummary.adverseMaxDrawdownPct.toFixed(2)}%`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Markdown: ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await getPool().end();
});
