/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-adr-vwap-fade-baseline.ts
 *
 * Description:
 * Gate 35 research-only anchored HLC3 mean fade baseline. This is VWAP-style
 * fair-value testing for FX canonical bars, which do not carry true volume.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import type { AssetClass } from "@/lib/cotMarkets";
import { getPool } from "@/lib/db";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import { loadPathBars } from "@/lib/performance/pathBarLoader";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";
type SignalMode = "above_mean_short" | "below_mean_long" | "first_touch";
type ActualSide = "above_mean_short" | "below_mean_long";
type ExitModel = "mean_touch" | "entry_rr_1to1";
type ExitReason = "mean_touch" | "take_profit" | "stop_loss" | "ambiguous_stop_loss" | "week_close" | "no_trigger" | "ambiguous_entry" | "missing";

type ReceiptScope = {
  assetClass: AssetClass;
  expectedPairs: string[];
  weekOpenUtcs: string[];
  displayedWeekFrom?: string | null;
  displayedWeekTo?: string | null;
};

type Variant = {
  id: string;
  label: string;
  triggerAdr: number;
  signalMode: SignalMode;
  exitModel: ExitModel;
};

type FadeRow = {
  variantId: string;
  variantLabel: string;
  weekOpenUtc: string;
  pineWeekKey: string;
  symbol: string;
  triggerAdr: number;
  signalMode: SignalMode;
  actualSide: ActualSide | null;
  direction: Direction | null;
  sourcePrice: "hlc3";
  anchorMode: "execution_week";
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  meanAtEntry: number | null;
  meanAtExit: number | null;
  upperBandAtEntry: number | null;
  lowerBandAtEntry: number | null;
  pairAdrPct: number | null;
  adrSource: "canonical_price_bars" | "asset_default" | "missing";
  rawReturnPct: number | null;
  adrReturnPct: number | null;
  targetPrice: number | null;
  stopPrice: number | null;
  exitReason: ExitReason;
  ambiguousExit: boolean;
  holdingHours: number | null;
  maxFavorableAdr: number | null;
  maxAdverseAdr: number | null;
  barsScanned: number;
  missingReason: string | null;
};

type Summary = {
  variantId: string;
  variantLabel: string;
  triggerAdr: number;
  signalMode: SignalMode;
  rows: number;
  trades: number;
  noTriggerRows: number;
  ambiguousEntryRows: number;
  missingRows: number;
  wins: number;
  losses: number;
  flat: number;
  winRatePct: number | null;
  takeProfitExits: number;
  meanTouchExits: number;
  stopLossExits: number;
  ambiguousExits: number;
  weekCloseExits: number;
  totalRawPct: number;
  totalAdrPct: number;
  profitFactorAdr: number | null;
  expectancyAdr: number | null;
  weeklyProfitFactorAdr: number | null;
  maxWeeklyDrawdownAdr: number | null;
  positiveWeeks: number;
  negativeWeeks: number;
  flatWeeks: number;
  avgMfeAdr: number | null;
  avgMaeAdr: number | null;
  avgHoldingHours: number | null;
};

const DEFAULT_TRIGGERS = [0.75, 1];
const SIGNAL_MODES: SignalMode[] = ["above_mean_short", "below_mean_long", "first_touch"];
const EXIT_MODELS: ExitModel[] = ["mean_touch", "entry_rr_1to1"];
const CSV_COLUMNS: Array<keyof FadeRow> = [
  "variantId",
  "variantLabel",
  "weekOpenUtc",
  "pineWeekKey",
  "symbol",
  "triggerAdr",
  "signalMode",
  "actualSide",
  "direction",
  "sourcePrice",
  "anchorMode",
  "entryTimeUtc",
  "exitTimeUtc",
  "entryPrice",
  "exitPrice",
  "meanAtEntry",
  "meanAtExit",
  "upperBandAtEntry",
  "lowerBandAtEntry",
  "pairAdrPct",
  "adrSource",
  "rawReturnPct",
  "adrReturnPct",
  "targetPrice",
  "stopPrice",
  "exitReason",
  "ambiguousExit",
  "holdingHours",
  "maxFavorableAdr",
  "maxAdverseAdr",
  "barsScanned",
  "missingReason",
];

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function round(value: number | null | undefined, places = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function signed(value: number | null | undefined, places = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(places)}%`;
}

function fixed(value: number | null | undefined, places = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(places) : "-";
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: FadeRow[]) {
  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function pineWeekKey(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.plus({ days: 1 }).toISODate() ?? weekOpenUtc.slice(0, 10) : weekOpenUtc.slice(0, 10);
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function profitFactor(grossProfit: number, grossLoss: number) {
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function parseNumberList(name: string, fallback: number[]) {
  const raw = argValue(name);
  if (!raw) return fallback;
  const values = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) throw new Error(`--${name} must include at least one positive number.`);
  return Array.from(new Set(values));
}

function parseSignalModes() {
  const raw = argValue("signal-modes");
  if (!raw) return SIGNAL_MODES;
  const modes = raw.split(",").map((part) => part.trim()).filter(Boolean) as SignalMode[];
  for (const mode of modes) {
    if (!SIGNAL_MODES.includes(mode)) {
      throw new Error("--signal-modes must contain above_mean_short, below_mean_long, and/or first_touch.");
    }
  }
  return Array.from(new Set(modes));
}

function parseExitModels() {
  const raw = argValue("exit-models") ?? "mean_touch";
  const models = raw.split(",").map((part) => part.trim()).filter(Boolean) as ExitModel[];
  for (const model of models) {
    if (!EXIT_MODELS.includes(model)) {
      throw new Error("--exit-models must contain mean_touch and/or entry_rr_1to1.");
    }
  }
  return Array.from(new Set(models));
}

function buildVariants() {
  const triggers = parseNumberList("triggers", DEFAULT_TRIGGERS);
  const signalModes = parseSignalModes();
  const exitModels = parseExitModels();
  return triggers.flatMap((triggerAdr) =>
    signalModes.flatMap((signalMode) => exitModels.map((exitModel): Variant => ({
      id: `${signalMode}_${String(triggerAdr).replace(".", "p")}adr_hlc3_${exitModel}`,
      label: `${signalMode.replaceAll("_", " ")} ${triggerAdr} ADR / HLC3 ${exitModel.replaceAll("_", " ")}`,
      triggerAdr,
      signalMode,
      exitModel,
    }))),
  );
}

async function readScopeFromReceipt(receiptPath: string): Promise<ReceiptScope> {
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const scope = receipt.scope ?? {};
  if (scope.assetClass !== "fx") throw new Error("Gate 35 first pass only supports fx receipts.");
  if (!Array.isArray(scope.expectedPairs) || scope.expectedPairs.length === 0) {
    throw new Error("Receipt scope must include expectedPairs.");
  }
  if (!Array.isArray(scope.weekOpenUtcs) || scope.weekOpenUtcs.length === 0) {
    throw new Error("Receipt scope must include weekOpenUtcs.");
  }
  return {
    assetClass: scope.assetClass,
    expectedPairs: scope.expectedPairs.map((pair: string) => pair.toUpperCase()),
    weekOpenUtcs: scope.weekOpenUtcs,
    displayedWeekFrom: scope.displayedWeekFrom ?? null,
    displayedWeekTo: scope.displayedWeekTo ?? null,
  };
}

function priceAtDistance(price: number, pct: number, side: "up" | "down") {
  return side === "up" ? price * (1 + pct / 100) : price * (1 - pct / 100);
}

function hlc3(bar: CanonicalPriceBar) {
  return (bar.highPrice + bar.lowPrice + bar.closePrice) / 3;
}

function directedReturnPct(direction: Direction, entryPrice: number, exitPrice: number) {
  const raw = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -raw : raw;
}

function barsForWindow(bars: CanonicalPriceBar[], fromUtc: string, toUtc: string) {
  const fromMs = Date.parse(fromUtc);
  const toMs = Date.parse(toUtc);
  return bars
    .filter((bar) => {
      const openMs = Date.parse(bar.barOpenUtc);
      return Number.isFinite(openMs) && Number.isFinite(fromMs) && Number.isFinite(toMs)
        && openMs >= fromMs && openMs < toMs;
    })
    .sort((left, right) => left.barOpenUtc.localeCompare(right.barOpenUtc));
}

function pathExcursions(direction: Direction, entryPrice: number, pairAdrPct: number, bars: CanonicalPriceBar[]) {
  let favorable = 0;
  let adverse = 0;
  for (const bar of bars) {
    const favorableRaw = direction === "LONG"
      ? ((bar.highPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - bar.lowPrice) / entryPrice) * 100;
    const adverseRaw = direction === "LONG"
      ? ((entryPrice - bar.lowPrice) / entryPrice) * 100
      : ((bar.highPrice - entryPrice) / entryPrice) * 100;
    favorable = Math.max(favorable, favorableRaw / pairAdrPct);
    adverse = Math.max(adverse, adverseRaw / pairAdrPct);
  }
  return { maxFavorableAdr: round(favorable, 4), maxAdverseAdr: round(adverse, 4) };
}

function noTradeRow(options: {
  variant: Variant;
  weekOpenUtc: string;
  symbol: string;
  pairAdrPct: number | null;
  adrSource: FadeRow["adrSource"];
  barsScanned: number;
  exitReason: ExitReason;
  missingReason: string | null;
}): FadeRow {
  return {
    variantId: options.variant.id,
    variantLabel: options.variant.label,
    weekOpenUtc: options.weekOpenUtc,
    pineWeekKey: pineWeekKey(options.weekOpenUtc),
    symbol: options.symbol,
    triggerAdr: options.variant.triggerAdr,
    signalMode: options.variant.signalMode,
    actualSide: null,
    direction: null,
    sourcePrice: "hlc3",
    anchorMode: "execution_week",
    entryTimeUtc: null,
    exitTimeUtc: null,
    entryPrice: null,
    exitPrice: null,
    meanAtEntry: null,
    meanAtExit: null,
    upperBandAtEntry: null,
    lowerBandAtEntry: null,
    pairAdrPct: round(options.pairAdrPct, 4),
    adrSource: options.adrSource,
    rawReturnPct: null,
    adrReturnPct: null,
    targetPrice: null,
    stopPrice: null,
    exitReason: options.exitReason,
    ambiguousExit: false,
    holdingHours: null,
    maxFavorableAdr: null,
    maxAdverseAdr: null,
    barsScanned: options.barsScanned,
    missingReason: options.missingReason,
  };
}

function sideDirection(side: ActualSide): Direction {
  return side === "below_mean_long" ? "LONG" : "SHORT";
}

function stopPriceFor(direction: Direction, entryPrice: number, distancePct: number) {
  return direction === "LONG"
    ? priceAtDistance(entryPrice, distancePct, "down")
    : priceAtDistance(entryPrice, distancePct, "up");
}

function targetPriceFor(direction: Direction, entryPrice: number, distancePct: number) {
  return direction === "LONG"
    ? priceAtDistance(entryPrice, distancePct, "up")
    : priceAtDistance(entryPrice, distancePct, "down");
}

function findEntry(options: {
  variant: Variant;
  bars: CanonicalPriceBar[];
  distancePct: number;
}) {
  let sourceSum = 0;
  let sourceCount = 0;
  for (let index = 0; index < options.bars.length; index++) {
    const bar = options.bars[index]!;
    if (sourceCount > 0) {
      const mean = sourceSum / sourceCount;
      const upper = priceAtDistance(mean, options.distancePct, "up");
      const lower = priceAtDistance(mean, options.distancePct, "down");
      const upperHit = bar.highPrice >= upper;
      const lowerHit = bar.lowPrice <= lower;
      if (options.variant.signalMode === "above_mean_short" && upperHit) {
        return { index, side: "above_mean_short" as const, entryPrice: upper, meanAtEntry: mean, upper, lower, ambiguous: false };
      }
      if (options.variant.signalMode === "below_mean_long" && lowerHit) {
        return { index, side: "below_mean_long" as const, entryPrice: lower, meanAtEntry: mean, upper, lower, ambiguous: false };
      }
      if (options.variant.signalMode === "first_touch") {
        if (upperHit && lowerHit) return { index, side: null, entryPrice: null, meanAtEntry: mean, upper, lower, ambiguous: true };
        if (upperHit) return { index, side: "above_mean_short" as const, entryPrice: upper, meanAtEntry: mean, upper, lower, ambiguous: false };
        if (lowerHit) return { index, side: "below_mean_long" as const, entryPrice: lower, meanAtEntry: mean, upper, lower, ambiguous: false };
      }
    }
    sourceSum += hlc3(bar);
    sourceCount += 1;
  }
  return null;
}

function simulateVwapFade(options: {
  variant: Variant;
  weekOpenUtc: string;
  symbol: string;
  bars: CanonicalPriceBar[];
  windowOpenUtc: string;
  windowCloseUtc: string;
  pairAdrPct: number | null;
  adrSource: FadeRow["adrSource"];
}): FadeRow {
  const windowBars = barsForWindow(options.bars, options.windowOpenUtc, options.windowCloseUtc);
  const { variant } = options;
  if (!options.pairAdrPct || options.pairAdrPct <= 0 || windowBars.length === 0) {
    return noTradeRow({
      variant,
      weekOpenUtc: options.weekOpenUtc,
      symbol: options.symbol,
      pairAdrPct: options.pairAdrPct,
      adrSource: options.adrSource,
      barsScanned: windowBars.length,
      exitReason: "missing",
      missingReason: windowBars.length === 0 ? "missing_path_bars" : "missing_adr",
    });
  }

  const distancePct = options.pairAdrPct * variant.triggerAdr;
  const entry = findEntry({ variant, bars: windowBars, distancePct });
  if (!entry) {
    return noTradeRow({
      variant,
      weekOpenUtc: options.weekOpenUtc,
      symbol: options.symbol,
      pairAdrPct: options.pairAdrPct,
      adrSource: options.adrSource,
      barsScanned: windowBars.length,
      exitReason: "no_trigger",
      missingReason: "mean_deviation_not_hit",
    });
  }
  if (entry.ambiguous || !entry.side || entry.entryPrice === null) {
    return noTradeRow({
      variant,
      weekOpenUtc: options.weekOpenUtc,
      symbol: options.symbol,
      pairAdrPct: options.pairAdrPct,
      adrSource: options.adrSource,
      barsScanned: windowBars.length,
      exitReason: "ambiguous_entry",
      missingReason: "upper_and_lower_band_hit_same_bar",
    });
  }

  const direction = sideDirection(entry.side);
  const entryBar = windowBars[entry.index]!;
  const stopPrice = stopPriceFor(direction, entry.entryPrice, distancePct);
  const targetPrice = variant.exitModel === "entry_rr_1to1"
    ? targetPriceFor(direction, entry.entryPrice, distancePct)
    : null;
  let sourceSum = 0;
  let sourceCount = 0;
  for (let index = 0; index <= entry.index; index++) {
    sourceSum += hlc3(windowBars[index]!);
    sourceCount += 1;
  }

  let exitPrice: number | null = null;
  let exitTimeUtc: string | null = null;
  let exitReason: ExitReason | null = null;
  let ambiguousExit = false;
  let meanAtExit: number | null = null;

  const entryBarStopHit = direction === "LONG" ? entryBar.lowPrice <= stopPrice : entryBar.highPrice >= stopPrice;
  if (entryBarStopHit) {
    exitPrice = stopPrice;
    exitTimeUtc = entryBar.barCloseUtc;
    exitReason = "stop_loss";
    meanAtExit = entry.meanAtEntry;
  }

  for (let index = entry.index + 1; exitReason === null && index < windowBars.length; index++) {
    const bar = windowBars[index]!;
    const mean = sourceSum / sourceCount;
    const targetHit = targetPrice !== null
      ? (direction === "LONG" ? bar.highPrice >= targetPrice : bar.lowPrice <= targetPrice)
      : false;
    const meanHit = variant.exitModel === "mean_touch"
      ? (direction === "LONG" ? bar.highPrice >= mean : bar.lowPrice <= mean)
      : false;
    const stopHit = direction === "LONG" ? bar.lowPrice <= stopPrice : bar.highPrice >= stopPrice;
    if (targetHit || meanHit || stopHit) {
      if (stopHit) {
        exitPrice = stopPrice;
        exitReason = meanHit || targetHit ? "ambiguous_stop_loss" : "stop_loss";
        ambiguousExit = meanHit || targetHit;
      } else if (targetHit) {
        exitPrice = targetPrice;
        exitReason = "take_profit";
      } else {
        exitPrice = mean;
        exitReason = "mean_touch";
      }
      exitTimeUtc = bar.barCloseUtc;
      meanAtExit = mean;
      break;
    }
    sourceSum += hlc3(bar);
    sourceCount += 1;
  }

  if (exitReason === null) {
    const closeBar = windowBars[windowBars.length - 1]!;
    exitPrice = closeBar.closePrice;
    exitTimeUtc = closeBar.barCloseUtc;
    exitReason = "week_close";
    meanAtExit = sourceSum / sourceCount;
  }

  const rawReturnPct = directedReturnPct(direction, entry.entryPrice, exitPrice!);
  const adrReturnPct = rawReturnPct / options.pairAdrPct;
  const entryMs = Date.parse(entryBar.barCloseUtc);
  const exitMs = Date.parse(exitTimeUtc!);
  const excursionBars = windowBars.slice(entry.index, Math.max(entry.index + 1, windowBars.findIndex((bar) => bar.barCloseUtc === exitTimeUtc) + 1));
  const excursions = pathExcursions(direction, entry.entryPrice, options.pairAdrPct, excursionBars);

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    weekOpenUtc: options.weekOpenUtc,
    pineWeekKey: pineWeekKey(options.weekOpenUtc),
    symbol: options.symbol,
    triggerAdr: variant.triggerAdr,
    signalMode: variant.signalMode,
    actualSide: entry.side,
    direction,
    sourcePrice: "hlc3",
    anchorMode: "execution_week",
    entryTimeUtc: entryBar.barCloseUtc,
    exitTimeUtc,
    entryPrice: round(entry.entryPrice, 6),
    exitPrice: round(exitPrice, 6),
    meanAtEntry: round(entry.meanAtEntry, 6),
    meanAtExit: round(meanAtExit, 6),
    upperBandAtEntry: round(entry.upper, 6),
    lowerBandAtEntry: round(entry.lower, 6),
    pairAdrPct: round(options.pairAdrPct, 6),
    adrSource: options.adrSource,
    rawReturnPct: round(rawReturnPct),
    adrReturnPct: round(adrReturnPct),
    targetPrice: round(targetPrice, 6),
    stopPrice: round(stopPrice, 6),
    exitReason,
    ambiguousExit,
    holdingHours: Number.isFinite(entryMs) && Number.isFinite(exitMs) ? round((exitMs - entryMs) / 3_600_000) : null,
    maxFavorableAdr: excursions.maxFavorableAdr,
    maxAdverseAdr: excursions.maxAdverseAdr,
    barsScanned: windowBars.length,
    missingReason: null,
  };
}

function summarizeWeekly(trades: FadeRow[]) {
  const weekly = Array.from(Map.groupBy(trades, (row) => row.pineWeekKey).entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([week, rows]) => ({
      week,
      adr: rows.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0),
    }));
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let positiveWeeks = 0;
  let negativeWeeks = 0;
  let flatWeeks = 0;
  for (const week of weekly) {
    cumulative += week.adr;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
    if (week.adr > 0) {
      grossProfit += week.adr;
      positiveWeeks += 1;
    } else if (week.adr < 0) {
      grossLoss += Math.abs(week.adr);
      negativeWeeks += 1;
    } else {
      flatWeeks += 1;
    }
  }
  return {
    weeklyProfitFactorAdr: profitFactor(grossProfit, grossLoss),
    maxWeeklyDrawdownAdr: maxDrawdown,
    positiveWeeks,
    negativeWeeks,
    flatWeeks,
  };
}

function summarizeRows(variant: Variant, rows: FadeRow[]): Summary {
  const trades = rows.filter((row) => row.rawReturnPct !== null && row.adrReturnPct !== null);
  const wins = trades.filter((row) => (row.adrReturnPct ?? 0) > 0).length;
  const losses = trades.filter((row) => (row.adrReturnPct ?? 0) < 0).length;
  const flat = trades.filter((row) => row.adrReturnPct === 0).length;
  const grossProfit = trades.reduce((sum, row) => sum + Math.max(row.adrReturnPct ?? 0, 0), 0);
  const grossLoss = trades.reduce((sum, row) => sum + Math.abs(Math.min(row.adrReturnPct ?? 0, 0)), 0);
  const weekly = summarizeWeekly(trades);
  return {
    variantId: variant.id,
    variantLabel: variant.label,
    triggerAdr: variant.triggerAdr,
    signalMode: variant.signalMode,
    rows: rows.length,
    trades: trades.length,
    noTriggerRows: rows.filter((row) => row.exitReason === "no_trigger").length,
    ambiguousEntryRows: rows.filter((row) => row.exitReason === "ambiguous_entry").length,
    missingRows: rows.filter((row) => row.exitReason === "missing").length,
    wins,
    losses,
    flat,
    winRatePct: trades.length > 0 ? (wins / trades.length) * 100 : null,
    takeProfitExits: trades.filter((row) => row.exitReason === "take_profit").length,
    meanTouchExits: trades.filter((row) => row.exitReason === "mean_touch").length,
    stopLossExits: trades.filter((row) => row.exitReason === "stop_loss").length,
    ambiguousExits: trades.filter((row) => row.exitReason === "ambiguous_stop_loss").length,
    weekCloseExits: trades.filter((row) => row.exitReason === "week_close").length,
    totalRawPct: trades.reduce((sum, row) => sum + (row.rawReturnPct ?? 0), 0),
    totalAdrPct: trades.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0),
    profitFactorAdr: profitFactor(grossProfit, grossLoss),
    expectancyAdr: trades.length > 0 ? trades.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0) / trades.length : null,
    weeklyProfitFactorAdr: weekly.weeklyProfitFactorAdr,
    maxWeeklyDrawdownAdr: weekly.maxWeeklyDrawdownAdr,
    positiveWeeks: weekly.positiveWeeks,
    negativeWeeks: weekly.negativeWeeks,
    flatWeeks: weekly.flatWeeks,
    avgMfeAdr: average(trades.map((row) => row.maxFavorableAdr).filter((value): value is number => typeof value === "number")),
    avgMaeAdr: average(trades.map((row) => row.maxAdverseAdr).filter((value): value is number => typeof value === "number")),
    avgHoldingHours: average(trades.map((row) => row.holdingHours).filter((value): value is number => typeof value === "number")),
  };
}

function summarizePairs(rows: FadeRow[]) {
  const groups = new Map<string, FadeRow[]>();
  for (const row of rows) groups.set(row.symbol, [...(groups.get(row.symbol) ?? []), row]);
  return Array.from(groups.entries()).map(([symbol, groupRows]) => {
    const trades = groupRows.filter((row) => row.adrReturnPct !== null);
    return {
      symbol,
      rows: groupRows.length,
      trades: trades.length,
      totalAdrPct: trades.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0),
      winRatePct: trades.length > 0 ? (trades.filter((row) => (row.adrReturnPct ?? 0) > 0).length / trades.length) * 100 : null,
      noTriggerRows: groupRows.filter((row) => row.exitReason === "no_trigger").length,
      ambiguousEntryRows: groupRows.filter((row) => row.exitReason === "ambiguous_entry").length,
    };
  }).sort((left, right) => right.totalAdrPct - left.totalAdrPct);
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  sourceReceiptPath: string;
  scope: ReceiptScope;
  variants: Variant[];
  summaries: Summary[];
  rowsByVariant: Record<string, FadeRow[]>;
  jsonPath: string;
  csvPath: string;
}) {
  const lines = [
    "# Gate 35 ADR VWAP-Proxy Fade Baseline",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Source receipt scope: ${options.sourceReceiptPath}`,
    `- Asset class: ${options.scope.assetClass}`,
    `- Pairs: ${options.scope.expectedPairs.join(", ")}`,
    `- Weeks: ${options.scope.weekOpenUtcs.length}`,
    "- Source filter: none",
    "- Mean source: anchored equal-weight HLC3, because canonical FX bars do not include volume.",
    "- Anchor: weekly execution window open.",
    "- Entry window: Sunday 20:00 New York through Friday 11:00 New York.",
    "- Entry trigger: configured ADR distance away from anchored HLC3 mean.",
    "- Exit: configured per variant; mean-touch exits use first touch of current anchored HLC3 mean, fixed 1:1 exits use the same ADR distance from entry for target and stop. Same-bar target/stop ambiguity books the stop.",
    "",
    "## Variant Summary",
    "",
    "| Variant | Rows | Trades | No Trigger | Ambig Entry | W/L/F | WR | ADR | ADR PF | Weekly PF | Max Wk DD | Weeks W/L/F | Exp ADR | TP | Mean | SL | Ambig SL | Week Close | Avg MFE | Avg MAE | Avg Hold Hrs |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.summaries.map((summary) =>
      `| ${summary.variantLabel} | ${summary.rows} | ${summary.trades} | ${summary.noTriggerRows} | ${summary.ambiguousEntryRows} | ${summary.wins}/${summary.losses}/${summary.flat} | ${fixed(summary.winRatePct)}% | ${signed(summary.totalAdrPct)} | ${fixed(summary.profitFactorAdr)} | ${fixed(summary.weeklyProfitFactorAdr)} | ${signed(summary.maxWeeklyDrawdownAdr)} | ${summary.positiveWeeks}/${summary.negativeWeeks}/${summary.flatWeeks} | ${signed(summary.expectancyAdr, 4)} | ${summary.takeProfitExits} | ${summary.meanTouchExits} | ${summary.stopLossExits} | ${summary.ambiguousExits} | ${summary.weekCloseExits} | ${fixed(summary.avgMfeAdr, 3)} | ${fixed(summary.avgMaeAdr, 3)} | ${fixed(summary.avgHoldingHours, 1)} |`),
    "",
  ];

  for (const variant of options.variants) {
    const rows = options.rowsByVariant[variant.id] ?? [];
    const pairSummary = summarizePairs(rows);
    lines.push(
      `## Pair Summary - ${variant.label}`,
      "",
      "| Pair | Rows | Trades | No Trigger | Ambig Entry | ADR | WR |",
      "|---|---:|---:|---:|---:|---:|---:|",
      ...pairSummary.map((item) =>
        `| ${item.symbol} | ${item.rows} | ${item.trades} | ${item.noTriggerRows} | ${item.ambiguousEntryRows} | ${signed(item.totalAdrPct)} | ${fixed(item.winRatePct)}% |`),
      "",
    );
  }

  lines.push(
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- CSV: ${options.csvPath}`,
    "",
  );
  return lines.join("\n");
}

async function main() {
  const receiptArg = argValue("receipt");
  if (!receiptArg) throw new Error("--receipt is required.");
  const receiptPath = path.resolve(process.cwd(), receiptArg);
  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/adr-vwap-fade-baseline",
  );
  const scope = await readScopeFromReceipt(receiptPath);
  const variants = buildVariants();
  const targetAdrPct = getTargetAdrPct();
  const rows: FadeRow[] = [];

  for (const weekOpenUtc of scope.weekOpenUtcs) {
    const executionWindow = getExecutionWeekWindow(weekOpenUtc, scope.assetClass);
    const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? weekOpenUtc;
    const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? weekOpenUtc;
    const [adrMap, barsBySymbol] = await Promise.all([
      loadWeeklyAdrMap(weekOpenUtc),
      loadPathBars(scope.expectedPairs, windowOpenUtc, windowCloseUtc),
    ]);
    for (const symbol of scope.expectedPairs) {
      const pairAdrPct = getAdrPct(adrMap, symbol, scope.assetClass);
      const adrSource = adrMap.has(symbol) ? "canonical_price_bars" as const : "asset_default" as const;
      const bars = barsBySymbol.get(symbol) ?? [];
      for (const variant of variants) {
        rows.push(simulateVwapFade({
          variant,
          weekOpenUtc,
          symbol,
          bars,
          windowOpenUtc,
          windowCloseUtc,
          pairAdrPct,
          adrSource,
        }));
      }
    }
  }

  const rowsByVariant = Object.fromEntries(variants.map((variant) => [
    variant.id,
    rows.filter((row) => row.variantId === variant.id),
  ])) as Record<string, FadeRow[]>;
  const summaries = variants.map((variant) => summarizeRows(variant, rowsByVariant[variant.id] ?? []));
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `fx-${scope.expectedPairs.length}pair-adr-vwap-proxy-fade-baseline-${scope.weekOpenUtcs.length}w-${stamp}`;
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);

  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 35 adr-vwap-proxy-fade-baseline",
      sourceReceiptPath: receiptPath,
      assetClass: scope.assetClass,
      expectedPairs: scope.expectedPairs,
      expectedPairCount: scope.expectedPairs.length,
      weekOpenUtcs: scope.weekOpenUtcs,
      selectedWeekCount: scope.weekOpenUtcs.length,
      displayedWeekFrom: scope.displayedWeekFrom ?? null,
      displayedWeekTo: scope.displayedWeekTo ?? null,
      targetAdrPct,
      sourceFilter: "none",
      fairValue: {
        label: "vwap_proxy_equal_weight_hlc3",
        anchor: "execution_week",
        sourcePrice: "hlc3",
        weighting: "equal_weight_1h_bars",
        volumeAvailable: false,
      },
      entryWindow: "Sunday 20:00 New York through Friday 11:00 New York",
      variants,
    },
    summaries,
    pairSummaries: Object.fromEntries(variants.map((variant) => [
      variant.id,
      summarizePairs(rowsByVariant[variant.id] ?? []),
    ])),
    rows,
  };
  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(rows)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    sourceReceiptPath: receiptPath,
    scope,
    variants,
    summaries,
    rowsByVariant,
    jsonPath,
    csvPath,
  }), "utf8");

  console.log(`ADR VWAP-proxy fade baseline: fx ${scope.expectedPairs.length} pairs`);
  console.log(`Weeks: ${scope.weekOpenUtcs.length}`);
  for (const summary of summaries) {
    console.log(`${summary.variantLabel}: trades=${summary.trades}, ADR=${signed(summary.totalAdrPct)}, PF=${fixed(summary.profitFactorAdr)}, weeklyPF=${fixed(summary.weeklyProfitFactorAdr)}, WR=${fixed(summary.winRatePct)}%, maxWkDD=${signed(summary.maxWeeklyDrawdownAdr)}`);
  }
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Markdown: ${mdPath}`);
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error);
  await getPool().end().catch(() => undefined);
  process.exit(1);
});
