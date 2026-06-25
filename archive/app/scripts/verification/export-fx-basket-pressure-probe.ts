/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-fx-basket-pressure-probe.ts
 *
 * Description:
 * Gate 36 research-only probe for the full 28-pair FX basket as one synthetic
 * pressure instrument. This measures all-listed-long and all-listed-short
 * equal-lot books before any COT, ADR Grid, martingale, spread, swap, or
 * commission model is introduced.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getPool } from "@/lib/db";
import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { getAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import { loadPathBars } from "@/lib/performance/pathBarLoader";
import { getCanonicalWeekOpenUtc, getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "@/lib/weekAnchor";

loadEnvConfig(process.cwd());

type BasketSide = "listed_long" | "listed_short";

type WeekPoint = {
  tsUtc: string;
  listedLongPnlUsd: number;
  listedShortPnlUsd: number;
  listedLongAdversePnlUsd: number;
  listedShortAdversePnlUsd: number;
  listedLongAdr: number;
  listedShortAdr: number;
  absolutePressureUsd: number;
};

type WeekRow = {
  weekOpenUtc: string;
  pineWeekKey: string;
  sourceReportDate: string;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  commonHourlyPoints: number;
  missingSymbols: string[];
  listedLongFinalUsd: number | null;
  listedLongPeakUsd: number | null;
  listedLongTroughUsd: number | null;
  listedLongMaxDrawdownUsd: number | null;
  listedLongAdverseDrawdownUsd: number | null;
  listedLongFinalAdr: number | null;
  listedShortFinalUsd: number | null;
  listedShortPeakUsd: number | null;
  listedShortTroughUsd: number | null;
  listedShortMaxDrawdownUsd: number | null;
  listedShortAdverseDrawdownUsd: number | null;
  listedShortFinalAdr: number | null;
  firstTargetSide: BasketSide | null;
  firstTargetTimeUtc: string | null;
  firstTargetHours: number | null;
  firstTargetUsd: number | null;
  oppositePnlAtFirstTargetUsd: number | null;
  maxAbsolutePressureUsd: number | null;
  maxAbsolutePressureTimeUtc: string | null;
};

type SideSummary = {
  finalUsd: number;
  peakUsd: number;
  troughUsd: number;
  maxDrawdownUsd: number;
  adverseDrawdownUsd: number;
  finalAdr: number;
};

type YearSummary = {
  year: string;
  weeks: number;
  firstTargetHits: number;
  listedLongFirstHits: number;
  listedShortFirstHits: number;
  noTargetWeeks: number;
  medianMaxAbsPressureUsd: number | null;
  p90MaxAbsPressureUsd: number | null;
  p95MaxAbsPressureUsd: number | null;
  maxAbsPressureUsd: number | null;
};

const STANDARD_LOT_UNITS = 100_000;
const CSV_COLUMNS: Array<keyof WeekRow> = [
  "weekOpenUtc",
  "pineWeekKey",
  "sourceReportDate",
  "entryTimeUtc",
  "exitTimeUtc",
  "commonHourlyPoints",
  "missingSymbols",
  "listedLongFinalUsd",
  "listedLongPeakUsd",
  "listedLongTroughUsd",
  "listedLongMaxDrawdownUsd",
  "listedLongAdverseDrawdownUsd",
  "listedLongFinalAdr",
  "listedShortFinalUsd",
  "listedShortPeakUsd",
  "listedShortTroughUsd",
  "listedShortMaxDrawdownUsd",
  "listedShortAdverseDrawdownUsd",
  "listedShortFinalAdr",
  "firstTargetSide",
  "firstTargetTimeUtc",
  "firstTargetHours",
  "firstTargetUsd",
  "oppositePnlAtFirstTargetUsd",
  "maxAbsolutePressureUsd",
  "maxAbsolutePressureTimeUtc",
];

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseNumber(name: string, fallback: number) {
  const raw = argValue(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} must be a positive number.`);
  }
  return value;
}

function round(value: number | null | undefined, places = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function fixed(value: number | null | undefined, places = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(places) : "-";
}

function money(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
}

function signed(value: number | null | undefined, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

function csvEscape(value: unknown) {
  if (Array.isArray(value)) return csvEscape(value.join("|"));
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: WeekRow[]) {
  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function pineWeekKey(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.plus({ days: 1 }).toISODate() ?? weekOpenUtc.slice(0, 10) : weekOpenUtc.slice(0, 10);
}

function filterWeeksByDate(weeks: string[], options: { from: string | null; to: string | null }) {
  return weeks.filter((weekOpenUtc) => {
    const key = pineWeekKey(weekOpenUtc);
    if (options.from && key < options.from) return false;
    if (options.to && key > options.to) return false;
    return true;
  });
}

function selectClosedWeeks(weeks: string[], currentWeekOpenUtc: string) {
  const normalizedCurrent = normalizeWeekOpenUtc(currentWeekOpenUtc) ?? currentWeekOpenUtc;
  return weeks
    .map((week) => normalizeWeekOpenUtc(week) ?? week)
    .filter((value, index, all) => all.indexOf(value) === index)
    .filter((week) => week < normalizedCurrent)
    .sort((left, right) => left.localeCompare(right));
}

function buildCalendarWeeks(options: {
  fromDate: string | null;
  toDate: string | null;
  currentWeekOpenUtc: string;
}) {
  const from = DateTime.fromISO(options.fromDate ?? "2019-01-01", { zone: "utc" });
  const to = DateTime.fromISO(options.toDate ?? DateTime.utc().toISODate() ?? "2026-06-08", { zone: "utc" });
  if (!from.isValid || !to.isValid) throw new Error("--from and --to must be ISO dates.");

  const candidates: string[] = [];
  let cursor = from.minus({ weeks: 2 }).startOf("day");
  const final = to.plus({ weeks: 2 }).startOf("day");
  while (cursor <= final) {
    candidates.push(getCanonicalWeekOpenUtc(cursor));
    cursor = cursor.plus({ weeks: 1 });
  }

  return selectClosedWeeks(candidates, options.currentWeekOpenUtc)
    .filter((weekOpenUtc) => {
      const key = pineWeekKey(weekOpenUtc);
      if (options.fromDate && key < options.fromDate) return false;
      if (options.toDate && key > options.toDate) return false;
      return true;
    });
}

function percentile(values: number[], pct: number) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index] ?? null;
}

function summarizeSide(points: WeekPoint[], side: BasketSide): SideSummary | null {
  if (points.length === 0) return null;
  const equity = side === "listed_long"
    ? points.map((point) => point.listedLongPnlUsd)
    : points.map((point) => point.listedShortPnlUsd);
  const adverse = side === "listed_long"
    ? points.map((point) => point.listedLongAdversePnlUsd)
    : points.map((point) => point.listedShortAdversePnlUsd);
  const adr = side === "listed_long"
    ? points[points.length - 1]?.listedLongAdr ?? 0
    : points[points.length - 1]?.listedShortAdr ?? 0;
  let peak = 0;
  let maxDrawdown = 0;
  let adverseDrawdown = 0;
  for (let index = 0; index < equity.length; index += 1) {
    const value = equity[index] ?? 0;
    const adverseValue = adverse[index] ?? value;
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, value - peak);
    adverseDrawdown = Math.min(adverseDrawdown, adverseValue - peak);
  }
  return {
    finalUsd: equity[equity.length - 1] ?? 0,
    peakUsd: Math.max(...equity, 0),
    troughUsd: Math.min(...equity, 0),
    maxDrawdownUsd: maxDrawdown,
    adverseDrawdownUsd: adverseDrawdown,
    finalAdr: adr,
  };
}

function buildBarMaps(bars: CanonicalPriceBar[]) {
  const byClose = new Map<string, CanonicalPriceBar>();
  for (const bar of bars) byClose.set(bar.barCloseUtc, bar);
  return byClose;
}

function quoteToUsd(currency: string, prices: Map<string, number>) {
  if (currency === "USD") return 1;
  const direct = prices.get(`${currency}USD`);
  if (typeof direct === "number" && direct > 0) return direct;
  const inverse = prices.get(`USD${currency}`);
  if (typeof inverse === "number" && inverse > 0) return 1 / inverse;
  return null;
}

function pairPnlUsd(options: {
  entryPrice: number;
  markPrice: number;
  quoteToUsd: number;
  units: number;
  side: BasketSide;
}) {
  const listedLong = options.units * (options.markPrice - options.entryPrice) * options.quoteToUsd;
  return options.side === "listed_long" ? listedLong : -listedLong;
}

async function buildWeekRow(options: {
  weekOpenUtc: string;
  expectedPairs: string[];
  pairQuoteBySymbol: Map<string, string>;
  units: number;
  accountEquityUsd: number;
  profitTargetUsd: number;
}): Promise<WeekRow> {
  const executionWindow = getExecutionWeekWindow(options.weekOpenUtc, "fx");
  const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const [adrMap, barsBySymbol] = await Promise.all([
    loadWeeklyAdrMap(options.weekOpenUtc),
    loadPathBars(options.expectedPairs, windowOpenUtc, windowCloseUtc),
  ]);

  const missingSymbols = options.expectedPairs.filter((symbol) => (barsBySymbol.get(symbol)?.length ?? 0) === 0);
  const barMapsBySymbol = new Map<string, Map<string, CanonicalPriceBar>>();
  const entryPriceBySymbol = new Map<string, number>();
  const pairAdrBySymbol = new Map<string, number>();

  for (const symbol of options.expectedPairs) {
    const bars = barsBySymbol.get(symbol) ?? [];
    barMapsBySymbol.set(symbol, buildBarMaps(bars));
    const first = bars[0] ?? null;
    if (first && Number.isFinite(first.openPrice) && first.openPrice > 0) {
      entryPriceBySymbol.set(symbol, first.openPrice);
    } else {
      missingSymbols.push(symbol);
    }
    pairAdrBySymbol.set(symbol, getAdrPct(adrMap, symbol, "fx"));
  }

  const timestampSets = options.expectedPairs.map((symbol) =>
    new Set((barsBySymbol.get(symbol) ?? []).map((bar) => bar.barCloseUtc)),
  );
  const commonTimestamps = timestampSets.length > 0
    ? Array.from(timestampSets[0] ?? new Set<string>())
      .filter((ts) => timestampSets.every((set) => set.has(ts)))
      .sort((left, right) => left.localeCompare(right))
    : [];

  const uniqueMissing = Array.from(new Set(missingSymbols)).sort();
  const points: WeekPoint[] = [];
  const entryMs = DateTime.fromISO(windowOpenUtc, { zone: "utc" }).toMillis();
  let firstTargetSide: BasketSide | null = null;
  let firstTargetTimeUtc: string | null = null;
  let firstTargetUsd: number | null = null;
  let oppositePnlAtFirstTargetUsd: number | null = null;
  let maxAbsolutePressureUsd = 0;
  let maxAbsolutePressureTimeUtc: string | null = null;

  if (uniqueMissing.length === 0) {
    for (const tsUtc of commonTimestamps) {
      const closePrices = new Map<string, number>();
      for (const symbol of options.expectedPairs) {
        const bar = barMapsBySymbol.get(symbol)?.get(tsUtc);
        if (bar) closePrices.set(symbol, bar.closePrice);
      }

      let listedLongPnlUsd = 0;
      let listedShortPnlUsd = 0;
      let listedLongAdversePnlUsd = 0;
      let listedShortAdversePnlUsd = 0;
      let listedLongAdr = 0;
      let conversionMissing = false;

      for (const symbol of options.expectedPairs) {
        const bar = barMapsBySymbol.get(symbol)?.get(tsUtc);
        const entryPrice = entryPriceBySymbol.get(symbol);
        const quote = options.pairQuoteBySymbol.get(symbol);
        if (!bar || !entryPrice || !quote) {
          conversionMissing = true;
          break;
        }
        const conversion = quoteToUsd(quote, closePrices);
        if (!conversion) {
          conversionMissing = true;
          break;
        }

        const longPnl = pairPnlUsd({
          entryPrice,
          markPrice: bar.closePrice,
          quoteToUsd: conversion,
          units: options.units,
          side: "listed_long",
        });
        const shortPnl = -longPnl;
        listedLongPnlUsd += longPnl;
        listedShortPnlUsd += shortPnl;
        listedLongAdversePnlUsd += pairPnlUsd({
          entryPrice,
          markPrice: bar.lowPrice,
          quoteToUsd: conversion,
          units: options.units,
          side: "listed_long",
        });
        listedShortAdversePnlUsd += pairPnlUsd({
          entryPrice,
          markPrice: bar.highPrice,
          quoteToUsd: conversion,
          units: options.units,
          side: "listed_short",
        });

        const rawReturnPct = ((bar.closePrice - entryPrice) / entryPrice) * 100;
        const pairAdrPct = pairAdrBySymbol.get(symbol) ?? 0;
        if (pairAdrPct > 0) listedLongAdr += rawReturnPct / pairAdrPct;
      }

      if (conversionMissing) continue;

      const point: WeekPoint = {
        tsUtc,
        listedLongPnlUsd,
        listedShortPnlUsd,
        listedLongAdversePnlUsd,
        listedShortAdversePnlUsd,
        listedLongAdr,
        listedShortAdr: -listedLongAdr,
        absolutePressureUsd: Math.max(Math.abs(listedLongPnlUsd), Math.abs(listedShortPnlUsd)),
      };
      points.push(point);

      if (point.absolutePressureUsd > maxAbsolutePressureUsd) {
        maxAbsolutePressureUsd = point.absolutePressureUsd;
        maxAbsolutePressureTimeUtc = tsUtc;
      }

      if (!firstTargetSide) {
        if (listedLongPnlUsd >= options.profitTargetUsd) {
          firstTargetSide = "listed_long";
          firstTargetTimeUtc = tsUtc;
          firstTargetUsd = listedLongPnlUsd;
          oppositePnlAtFirstTargetUsd = listedShortPnlUsd;
        } else if (listedShortPnlUsd >= options.profitTargetUsd) {
          firstTargetSide = "listed_short";
          firstTargetTimeUtc = tsUtc;
          firstTargetUsd = listedShortPnlUsd;
          oppositePnlAtFirstTargetUsd = listedLongPnlUsd;
        }
      }
    }
  }

  const longSummary = summarizeSide(points, "listed_long");
  const shortSummary = summarizeSide(points, "listed_short");
  const firstTargetMs = firstTargetTimeUtc
    ? DateTime.fromISO(firstTargetTimeUtc, { zone: "utc" }).toMillis()
    : Number.NaN;

  return {
    weekOpenUtc: options.weekOpenUtc,
    pineWeekKey: pineWeekKey(options.weekOpenUtc),
    sourceReportDate: deriveCotReportDate(options.weekOpenUtc),
    entryTimeUtc: points[0]?.tsUtc ?? null,
    exitTimeUtc: points[points.length - 1]?.tsUtc ?? null,
    commonHourlyPoints: points.length,
    missingSymbols: uniqueMissing,
    listedLongFinalUsd: round(longSummary?.finalUsd, 2),
    listedLongPeakUsd: round(longSummary?.peakUsd, 2),
    listedLongTroughUsd: round(longSummary?.troughUsd, 2),
    listedLongMaxDrawdownUsd: round(longSummary?.maxDrawdownUsd, 2),
    listedLongAdverseDrawdownUsd: round(longSummary?.adverseDrawdownUsd, 2),
    listedLongFinalAdr: round(longSummary?.finalAdr, 4),
    listedShortFinalUsd: round(shortSummary?.finalUsd, 2),
    listedShortPeakUsd: round(shortSummary?.peakUsd, 2),
    listedShortTroughUsd: round(shortSummary?.troughUsd, 2),
    listedShortMaxDrawdownUsd: round(shortSummary?.maxDrawdownUsd, 2),
    listedShortAdverseDrawdownUsd: round(shortSummary?.adverseDrawdownUsd, 2),
    listedShortFinalAdr: round(shortSummary?.finalAdr, 4),
    firstTargetSide,
    firstTargetTimeUtc,
    firstTargetHours: Number.isFinite(firstTargetMs) && Number.isFinite(entryMs)
      ? round((firstTargetMs - entryMs) / 3_600_000, 2)
      : null,
    firstTargetUsd: round(firstTargetUsd, 2),
    oppositePnlAtFirstTargetUsd: round(oppositePnlAtFirstTargetUsd, 2),
    maxAbsolutePressureUsd: round(maxAbsolutePressureUsd, 2),
    maxAbsolutePressureTimeUtc,
  };
}

function summarizeYears(rows: WeekRow[]): YearSummary[] {
  const groups = new Map<string, WeekRow[]>();
  for (const row of rows) {
    const year = row.pineWeekKey.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), row]);
  }
  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([year, yearRows]) => {
    const pressures = yearRows
      .map((row) => row.maxAbsolutePressureUsd)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return {
      year,
      weeks: yearRows.length,
      firstTargetHits: yearRows.filter((row) => row.firstTargetSide !== null).length,
      listedLongFirstHits: yearRows.filter((row) => row.firstTargetSide === "listed_long").length,
      listedShortFirstHits: yearRows.filter((row) => row.firstTargetSide === "listed_short").length,
      noTargetWeeks: yearRows.filter((row) => row.firstTargetSide === null).length,
      medianMaxAbsPressureUsd: round(percentile(pressures, 50), 2),
      p90MaxAbsPressureUsd: round(percentile(pressures, 90), 2),
      p95MaxAbsPressureUsd: round(percentile(pressures, 95), 2),
      maxAbsPressureUsd: round(pressures.length > 0 ? Math.max(...pressures) : null, 2),
    };
  });
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  fromDate: string | null;
  toDate: string | null;
  expectedPairs: string[];
  lotSize: number;
  units: number;
  accountEquityUsd: number;
  profitTargetUsd: number;
  weeks: WeekRow[];
  yearSummaries: YearSummary[];
  jsonPath: string;
  csvPath: string;
}) {
  const completeWeeks = options.weeks.filter((row) => row.commonHourlyPoints > 0 && row.missingSymbols.length === 0);
  const pressures = completeWeeks
    .map((row) => row.maxAbsolutePressureUsd)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const targetRows = completeWeeks.filter((row) => row.firstTargetSide !== null);
  const topPressure = [...completeWeeks]
    .sort((left, right) => (right.maxAbsolutePressureUsd ?? 0) - (left.maxAbsolutePressureUsd ?? 0))
    .slice(0, 12);
  const fastestTargets = [...targetRows]
    .sort((left, right) => (left.firstTargetHours ?? Number.POSITIVE_INFINITY) - (right.firstTargetHours ?? Number.POSITIVE_INFINITY))
    .slice(0, 12);

  const lines = [
    "# Gate 36 FX Basket Pressure Probe",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Displayed week filter: ${options.fromDate ?? "-"} -> ${options.toDate ?? "-"}`,
    `- Pairs: ${options.expectedPairs.join(", ")}`,
    `- Pair count: ${options.expectedPairs.length}`,
    `- Listed orientation: long means long each repo-listed pair, e.g. long EURUSD and long USDJPY.`,
    `- Lot sizing: ${options.lotSize} standard lots per pair (${options.units.toLocaleString()} base units per pair).`,
    `- Account equity model: ${money(options.accountEquityUsd)} reference equity.`,
    `- Profit target probe: ${money(options.profitTargetUsd)} on either mirrored book.`,
    "- Exclusions: no spread, commission, swap, slippage, martingale, ADR Grid, or COT regime filter.",
    "- USD conversion: pair P/L is converted through same-hour USD crosses from the 28-pair universe.",
    "",
    "## Summary",
    "",
    `- Weeks selected: ${options.weeks.length}`,
    `- Complete weeks: ${completeWeeks.length}`,
    `- Weeks with either mirrored book hitting target: ${targetRows.length}/${completeWeeks.length}`,
    `- First target side split: listed long ${targetRows.filter((row) => row.firstTargetSide === "listed_long").length}, listed short ${targetRows.filter((row) => row.firstTargetSide === "listed_short").length}`,
    `- Median weekly max absolute pressure: ${money(percentile(pressures, 50))}`,
    `- P75 weekly max absolute pressure: ${money(percentile(pressures, 75))}`,
    `- P90 weekly max absolute pressure: ${money(percentile(pressures, 90))}`,
    `- P95 weekly max absolute pressure: ${money(percentile(pressures, 95))}`,
    `- Max weekly absolute pressure: ${money(pressures.length > 0 ? Math.max(...pressures) : null)}`,
    "",
    "## Year Summary",
    "",
    "| Year | Weeks | Target Hits | Long First | Short First | No Target | Median Max Pressure | P90 Max Pressure | P95 Max Pressure | Max Pressure |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.yearSummaries.map((row) =>
      `| ${row.year} | ${row.weeks} | ${row.firstTargetHits} | ${row.listedLongFirstHits} | ${row.listedShortFirstHits} | ${row.noTargetWeeks} | ${money(row.medianMaxAbsPressureUsd)} | ${money(row.p90MaxAbsPressureUsd)} | ${money(row.p95MaxAbsPressureUsd)} | ${money(row.maxAbsPressureUsd)} |`),
    "",
    "## Largest Weekly Pressure Events",
    "",
    "| Week | Max Abs Pressure | Side First Target | First Target Time | Hours | Opposite P/L At Target | Long Close | Short Close | Points |",
    "|---|---:|---|---|---:|---:|---:|---:|---:|",
    ...topPressure.map((row) =>
      `| ${row.pineWeekKey} | ${money(row.maxAbsolutePressureUsd)} | ${row.firstTargetSide ?? "-"} | ${row.firstTargetTimeUtc ?? "-"} | ${fixed(row.firstTargetHours)} | ${money(row.oppositePnlAtFirstTargetUsd)} | ${money(row.listedLongFinalUsd)} | ${money(row.listedShortFinalUsd)} | ${row.commonHourlyPoints} |`),
    "",
    "## Fastest Target Hits",
    "",
    "| Week | Side | First Target Time | Hours | First Target P/L | Opposite P/L | Max Abs Pressure |",
    "|---|---|---|---:|---:|---:|---:|",
    ...fastestTargets.map((row) =>
      `| ${row.pineWeekKey} | ${row.firstTargetSide ?? "-"} | ${row.firstTargetTimeUtc ?? "-"} | ${fixed(row.firstTargetHours)} | ${money(row.firstTargetUsd)} | ${money(row.oppositePnlAtFirstTargetUsd)} | ${money(row.maxAbsolutePressureUsd)} |`),
    "",
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- CSV: ${options.csvPath}`,
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const fromDate = argValue("from") ?? "2019-01-01";
  const toDate = argValue("to") ?? "2026-06-08";
  const lotSize = parseNumber("lot-size", 0.01);
  const accountEquityUsd = parseNumber("account-equity-usd", 1000);
  const profitTargetUsd = parseNumber("profit-target-usd", 100);
  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/fx-basket-pressure-probe",
  );
  const expectedPairs = PAIRS_BY_ASSET_CLASS.fx.map((pair) => pair.pair.toUpperCase());
  const pairQuoteBySymbol = new Map(PAIRS_BY_ASSET_CLASS.fx.map((pair) => [pair.pair.toUpperCase(), pair.quote.toUpperCase()]));
  const currentWeekOpenUtc = getDisplayWeekOpenUtc(DateTime.utc());
  const weeks = filterWeeksByDate(
    buildCalendarWeeks({ fromDate, toDate, currentWeekOpenUtc }),
    { from: fromDate, to: toDate },
  );
  const units = lotSize * STANDARD_LOT_UNITS;
  const rows: WeekRow[] = [];

  for (const weekOpenUtc of weeks) {
    rows.push(await buildWeekRow({
      weekOpenUtc,
      expectedPairs,
      pairQuoteBySymbol,
      units,
      accountEquityUsd,
      profitTargetUsd,
    }));
  }

  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `fx-28pair-basket-pressure-probe-${weeks.length}w-${stamp}`;
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);
  const yearSummaries = summarizeYears(rows);
  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 36 fx-basket-pressure-probe",
      displayedWeekFrom: fromDate,
      displayedWeekTo: toDate,
      expectedPairs,
      expectedPairCount: expectedPairs.length,
      weekOpenUtcs: weeks,
      selectedWeekCount: weeks.length,
      lotSize,
      unitsPerPair: units,
      accountEquityUsd,
      profitTargetUsd,
      exclusions: ["spread", "commission", "swap", "slippage", "martingale", "adr_grid", "cot_regime_filter"],
    },
    yearSummaries,
    weeks: rows,
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(rows)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    fromDate,
    toDate,
    expectedPairs,
    lotSize,
    units,
    accountEquityUsd,
    profitTargetUsd,
    weeks: rows,
    yearSummaries,
    jsonPath,
    csvPath,
  }), "utf8");

  const completeRows = rows.filter((row) => row.commonHourlyPoints > 0 && row.missingSymbols.length === 0);
  const targetRows = completeRows.filter((row) => row.firstTargetSide !== null);
  const pressures = completeRows
    .map((row) => row.maxAbsolutePressureUsd)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  console.log(`FX basket pressure probe: ${expectedPairs.length} pairs`);
  console.log(`Weeks: ${weeks.length}, complete=${completeRows.length}`);
  console.log(`Target hits: ${targetRows.length}/${completeRows.length}`);
  console.log(`Median/P90/P95 max pressure: ${money(percentile(pressures, 50))} / ${money(percentile(pressures, 90))} / ${money(percentile(pressures, 95))}`);
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
