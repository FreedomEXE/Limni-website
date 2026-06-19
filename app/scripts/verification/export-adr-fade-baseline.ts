/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-adr-fade-baseline.ts
 *
 * Description:
 * Gate 35 source-free ADR fade baseline. Tests whether first weekly ADR
 * extensions are more exploitable as fades than as directional holds.
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

type FadeSide = "fade_up" | "fade_down";
type CotContextMode = "none" | "cot_aligned" | "cot_inverted";
type VariantSide = FadeSide | CotContextMode;
type ExitModel = "entry_rr_1to1" | "rolling_extreme_1to1";
type ExitReason = "take_profit" | "stop_loss" | "ambiguous_stop_loss" | "week_close" | "no_trigger" | "context_filtered" | "missing";
type Direction = "LONG" | "SHORT";

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
  side: VariantSide;
  contextMode: CotContextMode;
  exitModel: ExitModel;
};

type CotContext = {
  direction: Direction;
  sourceRuleTier: string | null;
  sourceRuleReason: string | null;
  sourceReportDate: string | null;
};

type FadeRow = {
  variantId: string;
  variantLabel: string;
  weekOpenUtc: string;
  pineWeekKey: string;
  symbol: string;
  triggerAdr: number;
  side: FadeSide | null;
  contextMode: CotContextMode;
  cotDirection: Direction | null;
  cotSourceTier: string | null;
  cotSourceReportDate: string | null;
  exitModel: ExitModel;
  direction: Direction | null;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  triggerReferencePrice: number | null;
  triggerPrice: number | null;
  pairAdrPct: number | null;
  adrSource: "canonical_price_bars" | "asset_default" | "missing";
  rawReturnPct: number | null;
  adrReturnPct: number | null;
  tpPrice: number | null;
  slPrice: number | null;
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
  side: VariantSide;
  contextMode: CotContextMode;
  exitModel: ExitModel;
  rows: number;
  trades: number;
  noTriggerRows: number;
  contextFilteredRows: number;
  missingRows: number;
  wins: number;
  losses: number;
  flat: number;
  winRatePct: number | null;
  takeProfitExits: number;
  stopLossExits: number;
  ambiguousExits: number;
  weekCloseExits: number;
  totalRawPct: number;
  totalAdrPct: number;
  profitFactorAdr: number | null;
  expectancyAdr: number | null;
  avgMfeAdr: number | null;
  avgMaeAdr: number | null;
  avgHoldingHours: number | null;
};

const DEFAULT_TRIGGERS = [0.75, 1];
const CSV_COLUMNS: Array<keyof FadeRow> = [
  "variantId",
  "variantLabel",
  "weekOpenUtc",
  "pineWeekKey",
  "symbol",
  "triggerAdr",
  "side",
  "contextMode",
  "cotDirection",
  "cotSourceTier",
  "cotSourceReportDate",
  "exitModel",
  "direction",
  "entryTimeUtc",
  "exitTimeUtc",
  "entryPrice",
  "exitPrice",
  "triggerReferencePrice",
  "triggerPrice",
  "pairAdrPct",
  "adrSource",
  "rawReturnPct",
  "adrReturnPct",
  "tpPrice",
  "slPrice",
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

function parseExitModels() {
  const raw = argValue("exit-models") ?? "entry_rr_1to1";
  const models = raw.split(",").map((part) => part.trim()).filter(Boolean) as ExitModel[];
  for (const model of models) {
    if (model !== "entry_rr_1to1" && model !== "rolling_extreme_1to1") {
      throw new Error("--exit-models must contain entry_rr_1to1 and/or rolling_extreme_1to1.");
    }
  }
  return Array.from(new Set(models));
}

function parseContextModes(hasCotContext: boolean) {
  const raw = argValue("context-modes") ?? (hasCotContext ? "cot_aligned,cot_inverted" : "none");
  const modes = raw.split(",").map((part) => part.trim()).filter(Boolean) as CotContextMode[];
  for (const mode of modes) {
    if (mode !== "none" && mode !== "cot_aligned" && mode !== "cot_inverted") {
      throw new Error("--context-modes must contain none, cot_aligned, and/or cot_inverted.");
    }
    if (mode !== "none" && !hasCotContext) {
      throw new Error("--cot-context-receipt is required for cot_aligned or cot_inverted context modes.");
    }
  }
  return Array.from(new Set(modes));
}

function contextLabel(mode: CotContextMode) {
  if (mode === "cot_aligned") return "COT Aligned Fade";
  if (mode === "cot_inverted") return "COT Inverted Fade";
  return null;
}

function buildVariants(contextModes: CotContextMode[]) {
  const triggers = parseNumberList("triggers", DEFAULT_TRIGGERS);
  const exitModels = parseExitModels();
  return triggers.flatMap((triggerAdr) => contextModes.flatMap((contextMode) => {
    if (contextMode !== "none") {
      return exitModels.map((exitModel): Variant => ({
        id: `${contextMode}_${String(triggerAdr).replace(".", "p")}adr_${exitModel}`,
        label: `${contextLabel(contextMode)} ${triggerAdr} ADR / ${exitModel}`,
        triggerAdr,
        side: contextMode,
        contextMode,
        exitModel,
      }));
    }
    return (["fade_up", "fade_down"] as const).flatMap((side) =>
      exitModels.map((exitModel): Variant => ({
        id: `${side}_${String(triggerAdr).replace(".", "p")}adr_${exitModel}`,
        label: `${side === "fade_up" ? "Fade Up" : "Fade Down"} ${triggerAdr} ADR / ${exitModel}`,
        triggerAdr,
        side,
        contextMode,
        exitModel,
      })),
    );
  }));
}

function cotContextKey(weekOpenUtc: string, symbol: string) {
  return `${weekOpenUtc}|${symbol.toUpperCase()}`;
}

function normalizeDirection(value: unknown): Direction | null {
  return value === "LONG" || value === "SHORT" ? value : null;
}

async function readCotContextMap(receiptPath: string, variantId: string) {
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const weekRows = receipt.weeksByVariant?.[variantId];
  if (!Array.isArray(weekRows)) {
    throw new Error(`COT context receipt does not include weeksByVariant.${variantId}.`);
  }
  const contextMap = new Map<string, CotContext>();
  for (const week of weekRows) {
    const pairRows = Array.isArray(week.pairRows) ? week.pairRows : [];
    for (const row of pairRows) {
      const direction = normalizeDirection(row.direction);
      if (!direction || typeof row.weekOpenUtc !== "string" || typeof row.symbol !== "string") continue;
      contextMap.set(cotContextKey(row.weekOpenUtc, row.symbol), {
        direction,
        sourceRuleTier: typeof row.sourceRuleTier === "string" ? row.sourceRuleTier : null,
        sourceRuleReason: typeof row.sourceRuleReason === "string" ? row.sourceRuleReason : null,
        sourceReportDate: typeof row.sourceReportDate === "string" ? row.sourceReportDate : null,
      });
    }
  }
  return contextMap;
}

function resolveFadeSide(variant: Variant, cotContext: CotContext | null): FadeSide | null {
  if (variant.contextMode === "none") return variant.side === "fade_up" || variant.side === "fade_down" ? variant.side : null;
  if (!cotContext) return null;
  const effectiveDirection = variant.contextMode === "cot_inverted"
    ? (cotContext.direction === "LONG" ? "SHORT" : "LONG")
    : cotContext.direction;
  return effectiveDirection === "LONG" ? "fade_down" : "fade_up";
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

function directedReturnPct(direction: Direction, entryPrice: number, exitPrice: number) {
  const raw = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -raw : raw;
}

function priceAtDistance(price: number, pct: number, side: "up" | "down") {
  return side === "up" ? price * (1 + pct / 100) : price * (1 - pct / 100);
}

function entryBasedExitPrices(direction: Direction, entryPrice: number, distancePct: number) {
  return direction === "LONG"
    ? {
        tpPrice: priceAtDistance(entryPrice, distancePct, "up"),
        slPrice: priceAtDistance(entryPrice, distancePct, "down"),
      }
    : {
        tpPrice: priceAtDistance(entryPrice, distancePct, "down"),
        slPrice: priceAtDistance(entryPrice, distancePct, "up"),
      };
}

function rollingExtremeExitPrices(direction: Direction, runningHigh: number, runningLow: number, distancePct: number) {
  return direction === "LONG"
    ? {
        tpPrice: priceAtDistance(runningLow, distancePct, "up"),
        slPrice: priceAtDistance(runningHigh, distancePct, "down"),
      }
    : {
        tpPrice: priceAtDistance(runningHigh, distancePct, "down"),
        slPrice: priceAtDistance(runningLow, distancePct, "up"),
      };
}

function hitExit(direction: Direction, bar: CanonicalPriceBar, tpPrice: number, slPrice: number) {
  const tpHit = direction === "LONG" ? bar.highPrice >= tpPrice : bar.lowPrice <= tpPrice;
  const slHit = direction === "LONG" ? bar.lowPrice <= slPrice : bar.highPrice >= slPrice;
  return { tpHit, slHit };
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
  side: FadeSide | null;
  cotContext: CotContext | null;
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
    side: options.side,
    contextMode: options.variant.contextMode,
    cotDirection: options.cotContext?.direction ?? null,
    cotSourceTier: options.cotContext?.sourceRuleTier ?? null,
    cotSourceReportDate: options.cotContext?.sourceReportDate ?? null,
    exitModel: options.variant.exitModel,
    direction: null,
    entryTimeUtc: null,
    exitTimeUtc: null,
    entryPrice: null,
    exitPrice: null,
    triggerReferencePrice: null,
    triggerPrice: null,
    pairAdrPct: round(options.pairAdrPct, 4),
    adrSource: options.adrSource,
    rawReturnPct: null,
    adrReturnPct: null,
    tpPrice: null,
    slPrice: null,
    exitReason: options.exitReason,
    ambiguousExit: false,
    holdingHours: null,
    maxFavorableAdr: null,
    maxAdverseAdr: null,
    barsScanned: options.barsScanned,
    missingReason: options.missingReason,
  };
}

function simulateFade(options: {
  variant: Variant;
  side: FadeSide;
  cotContext: CotContext | null;
  weekOpenUtc: string;
  symbol: string;
  bars: CanonicalPriceBar[];
  windowOpenUtc: string;
  windowCloseUtc: string;
  pairAdrPct: number | null;
  adrSource: FadeRow["adrSource"];
  targetAdrPct: number;
}): FadeRow {
  const windowBars = barsForWindow(options.bars, options.windowOpenUtc, options.windowCloseUtc);
  const { variant } = options;
  const fadeSide = options.side;
  if (!options.pairAdrPct || options.pairAdrPct <= 0 || windowBars.length === 0) {
    return noTradeRow({
      variant,
      side: fadeSide,
      cotContext: options.cotContext,
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
  let runningHigh = windowBars[0]?.openPrice ?? null;
  let runningLow = windowBars[0]?.openPrice ?? null;
  if (runningHigh === null || runningLow === null) {
    return noTradeRow({
      variant,
      side: fadeSide,
      cotContext: options.cotContext,
      weekOpenUtc: options.weekOpenUtc,
      symbol: options.symbol,
      pairAdrPct: options.pairAdrPct,
      adrSource: options.adrSource,
      barsScanned: windowBars.length,
      exitReason: "missing",
      missingReason: "missing_window_open",
    });
  }

  let entryBarIndex = -1;
  let entryPrice: number | null = null;
  let triggerReferencePrice: number | null = null;
  let direction: Direction | null = null;
  for (let index = 0; index < windowBars.length; index++) {
    const bar = windowBars[index]!;
    if (fadeSide === "fade_up") {
      const triggerPrice = priceAtDistance(runningLow, distancePct, "up");
      if (bar.highPrice >= triggerPrice) {
        entryBarIndex = index;
        entryPrice = triggerPrice;
        triggerReferencePrice = runningLow;
        direction = "SHORT";
        break;
      }
    } else {
      const triggerPrice = priceAtDistance(runningHigh, distancePct, "down");
      if (bar.lowPrice <= triggerPrice) {
        entryBarIndex = index;
        entryPrice = triggerPrice;
        triggerReferencePrice = runningHigh;
        direction = "LONG";
        break;
      }
    }
    runningHigh = Math.max(runningHigh, bar.highPrice);
    runningLow = Math.min(runningLow, bar.lowPrice);
  }

  if (entryBarIndex < 0 || entryPrice === null || !direction) {
    return noTradeRow({
      variant,
      side: fadeSide,
      cotContext: options.cotContext,
      weekOpenUtc: options.weekOpenUtc,
      symbol: options.symbol,
      pairAdrPct: options.pairAdrPct,
      adrSource: options.adrSource,
      barsScanned: windowBars.length,
      exitReason: "no_trigger",
      missingReason: "fade_trigger_not_hit",
    });
  }

  const entryBar = windowBars[entryBarIndex]!;
  let exitPrice: number | null = null;
  let exitTimeUtc: string | null = null;
  let exitReason: ExitReason | null = null;
  let ambiguousExit = false;
  let lastTpPrice: number | null = null;
  let lastSlPrice: number | null = null;

  const triggerBarPrices = variant.exitModel === "entry_rr_1to1"
    ? entryBasedExitPrices(direction, entryPrice, distancePct)
    : rollingExtremeExitPrices(direction, Math.max(runningHigh, entryBar.highPrice), Math.min(runningLow, entryBar.lowPrice), distancePct);
  lastTpPrice = triggerBarPrices.tpPrice;
  lastSlPrice = triggerBarPrices.slPrice;
  const triggerExit = hitExit(direction, entryBar, triggerBarPrices.tpPrice, triggerBarPrices.slPrice);
  if (triggerExit.slHit) {
    exitPrice = triggerBarPrices.slPrice;
    exitTimeUtc = entryBar.barCloseUtc;
    exitReason = triggerExit.tpHit ? "ambiguous_stop_loss" : "stop_loss";
    ambiguousExit = triggerExit.tpHit;
  }

  runningHigh = Math.max(runningHigh, entryBar.highPrice);
  runningLow = Math.min(runningLow, entryBar.lowPrice);

  for (let index = entryBarIndex + 1; exitReason === null && index < windowBars.length; index++) {
    const bar = windowBars[index]!;
    const prices = variant.exitModel === "entry_rr_1to1"
      ? entryBasedExitPrices(direction, entryPrice, distancePct)
      : rollingExtremeExitPrices(direction, runningHigh, runningLow, distancePct);
    lastTpPrice = prices.tpPrice;
    lastSlPrice = prices.slPrice;
    const hit = hitExit(direction, bar, prices.tpPrice, prices.slPrice);
    if (hit.tpHit || hit.slHit) {
      const useStop = hit.slHit;
      exitPrice = useStop ? prices.slPrice : prices.tpPrice;
      exitTimeUtc = bar.barCloseUtc;
      exitReason = hit.tpHit && hit.slHit ? "ambiguous_stop_loss" : useStop ? "stop_loss" : "take_profit";
      ambiguousExit = hit.tpHit && hit.slHit;
      break;
    }
    runningHigh = Math.max(runningHigh, bar.highPrice);
    runningLow = Math.min(runningLow, bar.lowPrice);
  }

  if (exitReason === null) {
    const closeBar = windowBars[windowBars.length - 1]!;
    exitPrice = closeBar.closePrice;
    exitTimeUtc = closeBar.barCloseUtc;
    exitReason = "week_close";
  }

  const rawReturnPct = directedReturnPct(direction, entryPrice, exitPrice!);
  const adrReturnPct = rawReturnPct * (options.targetAdrPct / options.pairAdrPct);
  const heldBars = windowBars.slice(entryBarIndex, Math.max(entryBarIndex + 1, windowBars.findIndex((bar) => bar.barCloseUtc === exitTimeUtc) + 1));
  const excursions = pathExcursions(direction, entryPrice, options.pairAdrPct, heldBars.length > 0 ? heldBars : [entryBar]);
  const entryMs = Date.parse(entryBar.barCloseUtc);
  const exitMs = Date.parse(exitTimeUtc!);

  return {
    variantId: variant.id,
    variantLabel: variant.label,
    weekOpenUtc: options.weekOpenUtc,
    pineWeekKey: pineWeekKey(options.weekOpenUtc),
    symbol: options.symbol,
    triggerAdr: variant.triggerAdr,
    side: fadeSide,
    contextMode: variant.contextMode,
    cotDirection: options.cotContext?.direction ?? null,
    cotSourceTier: options.cotContext?.sourceRuleTier ?? null,
    cotSourceReportDate: options.cotContext?.sourceReportDate ?? null,
    exitModel: variant.exitModel,
    direction,
    entryTimeUtc: entryBar.barCloseUtc,
    exitTimeUtc,
    entryPrice: round(entryPrice),
    exitPrice: round(exitPrice),
    triggerReferencePrice: round(triggerReferencePrice),
    triggerPrice: round(entryPrice),
    pairAdrPct: round(options.pairAdrPct, 4),
    adrSource: options.adrSource,
    rawReturnPct: round(rawReturnPct),
    adrReturnPct: round(adrReturnPct),
    tpPrice: round(lastTpPrice),
    slPrice: round(lastSlPrice),
    exitReason,
    ambiguousExit,
    holdingHours: Number.isFinite(entryMs) && Number.isFinite(exitMs) ? round((exitMs - entryMs) / 3_600_000) : null,
    maxFavorableAdr: excursions.maxFavorableAdr,
    maxAdverseAdr: excursions.maxAdverseAdr,
    barsScanned: windowBars.length,
    missingReason: null,
  };
}

function summarizeRows(variant: Variant, rows: FadeRow[]): Summary {
  const trades = rows.filter((row) => row.rawReturnPct !== null && row.adrReturnPct !== null);
  const wins = trades.filter((row) => (row.adrReturnPct ?? 0) > 0).length;
  const losses = trades.filter((row) => (row.adrReturnPct ?? 0) < 0).length;
  const flat = trades.filter((row) => row.adrReturnPct === 0).length;
  const grossProfit = trades.reduce((sum, row) => sum + Math.max(row.adrReturnPct ?? 0, 0), 0);
  const grossLoss = trades.reduce((sum, row) => sum + Math.abs(Math.min(row.adrReturnPct ?? 0, 0)), 0);
  return {
    variantId: variant.id,
    variantLabel: variant.label,
    triggerAdr: variant.triggerAdr,
    side: variant.side,
    contextMode: variant.contextMode,
    exitModel: variant.exitModel,
    rows: rows.length,
    trades: trades.length,
    noTriggerRows: rows.filter((row) => row.exitReason === "no_trigger").length,
    contextFilteredRows: rows.filter((row) => row.exitReason === "context_filtered").length,
    missingRows: rows.filter((row) => row.exitReason === "missing").length,
    wins,
    losses,
    flat,
    winRatePct: trades.length > 0 ? (wins / trades.length) * 100 : null,
    takeProfitExits: trades.filter((row) => row.exitReason === "take_profit").length,
    stopLossExits: trades.filter((row) => row.exitReason === "stop_loss").length,
    ambiguousExits: trades.filter((row) => row.exitReason === "ambiguous_stop_loss").length,
    weekCloseExits: trades.filter((row) => row.exitReason === "week_close").length,
    totalRawPct: trades.reduce((sum, row) => sum + (row.rawReturnPct ?? 0), 0),
    totalAdrPct: trades.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0),
    profitFactorAdr: profitFactor(grossProfit, grossLoss),
    expectancyAdr: trades.length > 0 ? trades.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0) / trades.length : null,
    avgMfeAdr: average(trades.map((row) => row.maxFavorableAdr).filter((value): value is number => typeof value === "number")),
    avgMaeAdr: average(trades.map((row) => row.maxAdverseAdr).filter((value): value is number => typeof value === "number")),
    avgHoldingHours: average(trades.map((row) => row.holdingHours).filter((value): value is number => typeof value === "number")),
  };
}

function summarizePairs(rows: FadeRow[]) {
  const groups = new Map<string, FadeRow[]>();
  for (const row of rows) {
    groups.set(row.symbol, [...(groups.get(row.symbol) ?? []), row]);
  }
  return Array.from(groups.entries()).map(([symbol, groupRows]) => {
    const trades = groupRows.filter((row) => row.adrReturnPct !== null);
    return {
      symbol,
      rows: groupRows.length,
      trades: trades.length,
      totalAdrPct: trades.reduce((sum, row) => sum + (row.adrReturnPct ?? 0), 0),
      winRatePct: trades.length > 0 ? (trades.filter((row) => (row.adrReturnPct ?? 0) > 0).length / trades.length) * 100 : null,
      contextFilteredRows: groupRows.filter((row) => row.exitReason === "context_filtered").length,
      noTriggerRows: groupRows.filter((row) => row.exitReason === "no_trigger").length,
    };
  }).sort((left, right) => right.totalAdrPct - left.totalAdrPct);
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  sourceReceiptPath: string;
  cotContextReceiptPath: string | null;
  cotContextVariantId: string | null;
  scope: ReceiptScope;
  variants: Variant[];
  summaries: Summary[];
  rowsByVariant: Record<string, FadeRow[]>;
  jsonPath: string;
  csvPath: string;
}) {
  const lines = [
    "# Gate 35 ADR Fade Baseline",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Source receipt scope: ${options.sourceReceiptPath}`,
    `- Asset class: ${options.scope.assetClass}`,
    `- Pairs: ${options.scope.expectedPairs.join(", ")}`,
    `- Weeks: ${options.scope.weekOpenUtcs.length}`,
    `- Source filter: ${options.cotContextReceiptPath ? "COT Faces context gate" : "none"}`,
    ...(options.cotContextReceiptPath ? [
      `- COT context receipt: ${options.cotContextReceiptPath}`,
      `- COT context variant: ${options.cotContextVariantId}`,
      "- COT aligned mapping: COT LONG allows fade-down; COT SHORT allows fade-up.",
      "- COT inverted mapping: COT LONG allows fade-up; COT SHORT allows fade-down.",
    ] : []),
    "- Entry window: Sunday 20:00 New York through Friday 11:00 New York.",
    "- Entry trigger: first low-to-high or high-to-low move by the configured ADR multiple.",
    "- Same trigger bar policy: stop can trigger on the entry bar; take-profit waits until later bars unless both stop and target hit, where the receipt books the stop.",
    "",
    "## Variant Summary",
    "",
    "| Variant | Rows | Trades | Filtered | No Trigger | W/L/F | WR | ADR | ADR PF | Exp ADR | TP | SL | Ambig | Week Close | Avg MFE | Avg MAE | Avg Hold Hrs |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.summaries.map((summary) =>
      `| ${summary.variantLabel} | ${summary.rows} | ${summary.trades} | ${summary.contextFilteredRows} | ${summary.noTriggerRows} | ${summary.wins}/${summary.losses}/${summary.flat} | ${fixed(summary.winRatePct)}% | ${signed(summary.totalAdrPct)} | ${fixed(summary.profitFactorAdr)} | ${signed(summary.expectancyAdr, 4)} | ${summary.takeProfitExits} | ${summary.stopLossExits} | ${summary.ambiguousExits} | ${summary.weekCloseExits} | ${fixed(summary.avgMfeAdr, 3)} | ${fixed(summary.avgMaeAdr, 3)} | ${fixed(summary.avgHoldingHours, 1)} |`),
    "",
  ];

  for (const variant of options.variants) {
    const rows = options.rowsByVariant[variant.id] ?? [];
    const pairSummary = summarizePairs(rows);
    lines.push(
      `## Pair Summary - ${variant.label}`,
      "",
      "| Pair | Rows | Trades | Filtered | No Trigger | ADR | WR |",
      "|---|---:|---:|---:|---:|---:|---:|",
      ...pairSummary.map((item) =>
        `| ${item.symbol} | ${item.rows} | ${item.trades} | ${item.contextFilteredRows} | ${item.noTriggerRows} | ${signed(item.totalAdrPct)} | ${fixed(item.winRatePct)}% |`),
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
  const cotContextReceiptArg = argValue("cot-context-receipt");
  const cotContextReceiptPath = cotContextReceiptArg ? path.resolve(process.cwd(), cotContextReceiptArg) : null;
  const cotContextVariantId = cotContextReceiptPath
    ? argValue("cot-context-variant") ?? "cot_faces_v1_forced__week_close"
    : null;
  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/adr-fade-baseline",
  );
  const scope = await readScopeFromReceipt(receiptPath);
  const cotContextMap = cotContextReceiptPath && cotContextVariantId
    ? await readCotContextMap(cotContextReceiptPath, cotContextVariantId)
    : null;
  const contextModes = parseContextModes(Boolean(cotContextMap));
  const variants = buildVariants(contextModes);
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
        const cotContext = cotContextMap?.get(cotContextKey(weekOpenUtc, symbol)) ?? null;
        const side = resolveFadeSide(variant, cotContext);
        if (!side) {
          rows.push(noTradeRow({
            variant,
            side: null,
            cotContext,
            weekOpenUtc,
            symbol,
            pairAdrPct,
            adrSource,
            barsScanned: bars.length,
            exitReason: "context_filtered",
            missingReason: cotContext ? "cot_context_gate_filtered" : "missing_cot_context",
          }));
          continue;
        }
        rows.push(simulateFade({
          variant,
          side,
          cotContext,
          weekOpenUtc,
          symbol,
          bars,
          windowOpenUtc,
          windowCloseUtc,
          pairAdrPct,
          adrSource,
          targetAdrPct,
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
  const fileStem = `fx-${scope.expectedPairs.length}pair-${cotContextMap ? "adr-fade-cot-context" : "adr-fade-baseline"}-${scope.weekOpenUtcs.length}w-${stamp}`;
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);

  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 35 adr-fade-baseline",
      sourceReceiptPath: receiptPath,
      cotContextReceiptPath,
      cotContextVariantId,
      assetClass: scope.assetClass,
      expectedPairs: scope.expectedPairs,
      expectedPairCount: scope.expectedPairs.length,
      weekOpenUtcs: scope.weekOpenUtcs,
      selectedWeekCount: scope.weekOpenUtcs.length,
      displayedWeekFrom: scope.displayedWeekFrom ?? null,
      displayedWeekTo: scope.displayedWeekTo ?? null,
      targetAdrPct,
      entryWindow: "Sunday 20:00 New York through Friday 11:00 New York",
      sourceFilter: cotContextMap ? "cot_faces_context_gate" : "none",
      contextModes,
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
    cotContextReceiptPath,
    cotContextVariantId,
    scope,
    variants,
    summaries,
    rowsByVariant,
    jsonPath,
    csvPath,
  }), "utf8");

  console.log(`ADR fade baseline: fx ${scope.expectedPairs.length} pairs`);
  console.log(`Weeks: ${scope.weekOpenUtcs.length}`);
  for (const summary of summaries) {
    console.log(`${summary.variantLabel}: trades=${summary.trades}, ADR=${signed(summary.totalAdrPct)}, PF=${fixed(summary.profitFactorAdr)}, WR=${fixed(summary.winRatePct)}%`);
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
