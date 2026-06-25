/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-fx-basket-adr-pressure-bands.ts
 *
 * Description:
 * Gate 36b research-only probe for the full 28-pair FX basket as one
 * ADR-normalized pressure index. Each pair contributes its listed-orientation
 * percent move divided by that pair's weekly ADR%; the basket pressure is the
 * average of those 28 normalized moves.
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
type FirstBeforeResult = true | false | null;

type WeekPoint = {
  tsUtc: string;
  listedLongBasketAdr: number;
  listedShortBasketAdr: number;
  listedLongRawPct: number;
  listedShortRawPct: number;
  maxAbsBasketAdr: number;
};

type BandEventRow = {
  weekOpenUtc: string;
  pineWeekKey: string;
  thresholdAdr: number;
  nextThresholdAdr: number;
  side: BasketSide;
  touchTimeUtc: string;
  touchHours: number;
  pressureAtTouchAdr: number;
  halfReversionTimeUtc: string | null;
  halfReversionHours: number | null;
  zeroReversionTimeUtc: string | null;
  zeroReversionHours: number | null;
  nextContinuationTimeUtc: string | null;
  nextContinuationHours: number | null;
  halfBeforeNext: FirstBeforeResult;
  zeroBeforeNext: FirstBeforeResult;
  nextBeforeZero: FirstBeforeResult;
  closeSideSignedAdr: number;
  closeBelowTouch: boolean;
  closeAtOrThroughZero: boolean;
  peakContinuationAdr: number;
  maxReversionFromTouchAdr: number;
};

type WeekRow = {
  weekOpenUtc: string;
  pineWeekKey: string;
  sourceReportDate: string;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  commonHourlyPoints: number;
  missingSymbols: string[];
  defaultAdrSymbols: string[];
  listedLongCloseBasketAdr: number | null;
  listedLongPeakBasketAdr: number | null;
  listedLongTroughBasketAdr: number | null;
  listedLongMaxAbsBasketAdr: number | null;
  listedLongMaxAbsBasketAdrTimeUtc: string | null;
  listedLongCloseRawPct: number | null;
  listedLongPeakRawPct: number | null;
  listedLongTroughRawPct: number | null;
  bandEvents: BandEventRow[];
};

type BandSummary = {
  thresholdAdr: number;
  nextThresholdAdr: number;
  completeWeeks: number;
  touchedWeeks: number;
  touchRate: number | null;
  listedLongTouches: number;
  listedShortTouches: number;
  halfReversions: number;
  zeroReversions: number;
  nextContinuations: number;
  halfBeforeNext: number;
  zeroBeforeNext: number;
  nextBeforeZero: number;
  closeBelowTouch: number;
  closeAtOrThroughZero: number;
  medianTouchHours: number | null;
  medianHalfReversionHours: number | null;
  medianZeroReversionHours: number | null;
  medianNextContinuationHours: number | null;
  avgCloseSideSignedAdr: number | null;
  medianPeakContinuationAdr: number | null;
  medianMaxReversionFromTouchAdr: number | null;
};

type YearSummary = {
  year: string;
  completeWeeks: number;
  medianMaxAbsBasketAdr: number | null;
  p75MaxAbsBasketAdr: number | null;
  p90MaxAbsBasketAdr: number | null;
  maxAbsBasketAdr: number | null;
  touch0p75Weeks: number;
  touch1p0Weeks: number;
  touch1p5Weeks: number;
  zeroBeforeNext1p0: number;
};

const DEFAULT_BANDS = [0.5, 0.75, 1, 1.25, 1.5];

const EVENT_CSV_COLUMNS: Array<keyof BandEventRow> = [
  "weekOpenUtc",
  "pineWeekKey",
  "thresholdAdr",
  "nextThresholdAdr",
  "side",
  "touchTimeUtc",
  "touchHours",
  "pressureAtTouchAdr",
  "halfReversionTimeUtc",
  "halfReversionHours",
  "zeroReversionTimeUtc",
  "zeroReversionHours",
  "nextContinuationTimeUtc",
  "nextContinuationHours",
  "halfBeforeNext",
  "zeroBeforeNext",
  "nextBeforeZero",
  "closeSideSignedAdr",
  "closeBelowTouch",
  "closeAtOrThroughZero",
  "peakContinuationAdr",
  "maxReversionFromTouchAdr",
];

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseBoolean(name: string, fallback: boolean) {
  const raw = argValue(name);
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`--${name} must be true or false.`);
}

function parseBands() {
  const raw = argValue("bands");
  if (!raw) return DEFAULT_BANDS;
  const bands = raw.split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  if (bands.length === 0) throw new Error("--bands must contain positive numbers.");
  return Array.from(new Set(bands));
}

function round(value: number | null | undefined, places = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function fixed(value: number | null | undefined, places = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(places) : "-";
}

function signed(value: number | null | undefined, places = 2, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(places)}${suffix}`;
}

function pct(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

function csvEscape(value: unknown) {
  if (Array.isArray(value)) return csvEscape(value.join("|"));
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: BandEventRow[]) {
  return [
    EVENT_CSV_COLUMNS.join(","),
    ...rows.map((row) => EVENT_CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
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

function percentile(values: number[], pctValue: number) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pctValue / 100) * sorted.length) - 1));
  return sorted[index] ?? null;
}

function average(values: number[]) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function hoursBetween(startUtc: string, endUtc: string | null) {
  if (!endUtc) return null;
  const start = DateTime.fromISO(startUtc, { zone: "utc" }).toMillis();
  const end = DateTime.fromISO(endUtc, { zone: "utc" }).toMillis();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return round((end - start) / 3_600_000, 2);
}

function firstBefore(first: string | null, second: string | null): FirstBeforeResult {
  if (first && second) return first <= second;
  if (first && !second) return true;
  if (!first && second) return false;
  return null;
}

function buildBarMaps(bars: CanonicalPriceBar[]) {
  const byClose = new Map<string, CanonicalPriceBar>();
  for (const bar of bars) byClose.set(bar.barCloseUtc, bar);
  return byClose;
}

function sideSignedPressure(point: WeekPoint, side: BasketSide) {
  return side === "listed_long" ? point.listedLongBasketAdr : point.listedShortBasketAdr;
}

function nextThresholdFor(bands: number[], threshold: number) {
  const next = bands.find((band) => band > threshold);
  return next ?? threshold + 0.5;
}

function buildBandEvents(options: {
  weekOpenUtc: string;
  points: WeekPoint[];
  bands: number[];
  windowOpenUtc: string;
}): BandEventRow[] {
  const events: BandEventRow[] = [];
  const pineKey = pineWeekKey(options.weekOpenUtc);
  for (const threshold of options.bands) {
    const touchIndex = options.points.findIndex((point) =>
      point.listedLongBasketAdr >= threshold || point.listedShortBasketAdr >= threshold,
    );
    if (touchIndex < 0) continue;

    const touch = options.points[touchIndex]!;
    const side: BasketSide = touch.listedLongBasketAdr >= threshold ? "listed_long" : "listed_short";
    const nextThreshold = nextThresholdFor(options.bands, threshold);
    const after = options.points.slice(touchIndex);
    const signedAfter = after.map((point) => ({
      tsUtc: point.tsUtc,
      value: sideSignedPressure(point, side),
    }));
    const halfReversionTimeUtc = signedAfter.find((point) => point.value <= threshold / 2)?.tsUtc ?? null;
    const zeroReversionTimeUtc = signedAfter.find((point) => point.value <= 0)?.tsUtc ?? null;
    const nextContinuationTimeUtc = signedAfter.find((point) => point.value >= nextThreshold)?.tsUtc ?? null;
    const closeSideSignedAdr = signedAfter[signedAfter.length - 1]?.value ?? sideSignedPressure(touch, side);
    const pressureAtTouchAdr = sideSignedPressure(touch, side);
    const peakContinuationAdr = Math.max(...signedAfter.map((point) => point.value), pressureAtTouchAdr);
    const troughAfterTouchAdr = Math.min(...signedAfter.map((point) => point.value), pressureAtTouchAdr);

    const zeroBeforeNext = firstBefore(zeroReversionTimeUtc, nextContinuationTimeUtc);
    events.push({
      weekOpenUtc: options.weekOpenUtc,
      pineWeekKey: pineKey,
      thresholdAdr: round(threshold, 4) ?? threshold,
      nextThresholdAdr: round(nextThreshold, 4) ?? nextThreshold,
      side,
      touchTimeUtc: touch.tsUtc,
      touchHours: hoursBetween(options.windowOpenUtc, touch.tsUtc) ?? 0,
      pressureAtTouchAdr: round(pressureAtTouchAdr, 4) ?? pressureAtTouchAdr,
      halfReversionTimeUtc,
      halfReversionHours: hoursBetween(touch.tsUtc, halfReversionTimeUtc),
      zeroReversionTimeUtc,
      zeroReversionHours: hoursBetween(touch.tsUtc, zeroReversionTimeUtc),
      nextContinuationTimeUtc,
      nextContinuationHours: hoursBetween(touch.tsUtc, nextContinuationTimeUtc),
      halfBeforeNext: firstBefore(halfReversionTimeUtc, nextContinuationTimeUtc),
      zeroBeforeNext,
      nextBeforeZero: zeroBeforeNext === null ? null : !zeroBeforeNext,
      closeSideSignedAdr: round(closeSideSignedAdr, 4) ?? closeSideSignedAdr,
      closeBelowTouch: closeSideSignedAdr < pressureAtTouchAdr,
      closeAtOrThroughZero: closeSideSignedAdr <= 0,
      peakContinuationAdr: round(peakContinuationAdr, 4) ?? peakContinuationAdr,
      maxReversionFromTouchAdr: round(pressureAtTouchAdr - troughAfterTouchAdr, 4) ?? 0,
    });
  }
  return events;
}

async function buildWeekRow(options: {
  weekOpenUtc: string;
  expectedPairs: string[];
  strictAdr: boolean;
  bands: number[];
}): Promise<WeekRow> {
  const executionWindow = getExecutionWeekWindow(options.weekOpenUtc, "fx");
  const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? options.weekOpenUtc;
  const [adrMap, barsBySymbol] = await Promise.all([
    loadWeeklyAdrMap(options.weekOpenUtc),
    loadPathBars(options.expectedPairs, windowOpenUtc, windowCloseUtc),
  ]);

  const missingSymbols: string[] = [];
  const defaultAdrSymbols: string[] = [];
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
    if (!adrMap.has(symbol)) defaultAdrSymbols.push(symbol);
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
  const uniqueDefaultAdr = Array.from(new Set(defaultAdrSymbols)).sort();
  const points: WeekPoint[] = [];
  const adrBlocked = options.strictAdr && uniqueDefaultAdr.length > 0;

  if (uniqueMissing.length === 0 && !adrBlocked) {
    for (const tsUtc of commonTimestamps) {
      let listedLongAdrSum = 0;
      let listedLongRawPctSum = 0;
      let valid = true;

      for (const symbol of options.expectedPairs) {
        const bar = barMapsBySymbol.get(symbol)?.get(tsUtc);
        const entryPrice = entryPriceBySymbol.get(symbol);
        const pairAdrPct = pairAdrBySymbol.get(symbol);
        if (!bar || !entryPrice || !pairAdrPct || pairAdrPct <= 0) {
          valid = false;
          break;
        }

        const rawReturnPct = ((bar.closePrice - entryPrice) / entryPrice) * 100;
        listedLongRawPctSum += rawReturnPct;
        listedLongAdrSum += rawReturnPct / pairAdrPct;
      }

      if (!valid) continue;

      const listedLongBasketAdr = listedLongAdrSum / options.expectedPairs.length;
      const listedLongRawPct = listedLongRawPctSum / options.expectedPairs.length;
      points.push({
        tsUtc,
        listedLongBasketAdr,
        listedShortBasketAdr: -listedLongBasketAdr,
        listedLongRawPct,
        listedShortRawPct: -listedLongRawPct,
        maxAbsBasketAdr: Math.abs(listedLongBasketAdr),
      });
    }
  }

  const longAdrValues = points.map((point) => point.listedLongBasketAdr);
  const rawValues = points.map((point) => point.listedLongRawPct);
  const maxAbsPoint = points.reduce<WeekPoint | null>(
    (best, point) => (!best || point.maxAbsBasketAdr > best.maxAbsBasketAdr ? point : best),
    null,
  );
  const bandEvents = buildBandEvents({
    weekOpenUtc: options.weekOpenUtc,
    points,
    bands: options.bands,
    windowOpenUtc,
  });

  return {
    weekOpenUtc: options.weekOpenUtc,
    pineWeekKey: pineWeekKey(options.weekOpenUtc),
    sourceReportDate: deriveCotReportDate(options.weekOpenUtc),
    entryTimeUtc: points[0]?.tsUtc ?? null,
    exitTimeUtc: points[points.length - 1]?.tsUtc ?? null,
    commonHourlyPoints: points.length,
    missingSymbols: uniqueMissing,
    defaultAdrSymbols: uniqueDefaultAdr,
    listedLongCloseBasketAdr: round(longAdrValues[longAdrValues.length - 1], 4),
    listedLongPeakBasketAdr: round(longAdrValues.length > 0 ? Math.max(...longAdrValues, 0) : null, 4),
    listedLongTroughBasketAdr: round(longAdrValues.length > 0 ? Math.min(...longAdrValues, 0) : null, 4),
    listedLongMaxAbsBasketAdr: round(maxAbsPoint?.maxAbsBasketAdr, 4),
    listedLongMaxAbsBasketAdrTimeUtc: maxAbsPoint?.tsUtc ?? null,
    listedLongCloseRawPct: round(rawValues[rawValues.length - 1], 4),
    listedLongPeakRawPct: round(rawValues.length > 0 ? Math.max(...rawValues, 0) : null, 4),
    listedLongTroughRawPct: round(rawValues.length > 0 ? Math.min(...rawValues, 0) : null, 4),
    bandEvents,
  };
}

function summarizeBands(weeks: WeekRow[], bands: number[]): BandSummary[] {
  const completeWeeks = weeks.filter((week) =>
    week.commonHourlyPoints > 0 && week.missingSymbols.length === 0 && week.defaultAdrSymbols.length === 0,
  );
  const events = weeks.flatMap((week) => week.bandEvents);
  return bands.map((threshold) => {
    const thresholdEvents = events.filter((event) => event.thresholdAdr === threshold);
    const hours = (field: keyof BandEventRow) =>
      thresholdEvents.map((event) => event[field]).filter((value): value is number => typeof value === "number");
    const nextThreshold = nextThresholdFor(bands, threshold);
    return {
      thresholdAdr: threshold,
      nextThresholdAdr: nextThreshold,
      completeWeeks: completeWeeks.length,
      touchedWeeks: thresholdEvents.length,
      touchRate: completeWeeks.length > 0 ? thresholdEvents.length / completeWeeks.length : null,
      listedLongTouches: thresholdEvents.filter((event) => event.side === "listed_long").length,
      listedShortTouches: thresholdEvents.filter((event) => event.side === "listed_short").length,
      halfReversions: thresholdEvents.filter((event) => event.halfReversionTimeUtc).length,
      zeroReversions: thresholdEvents.filter((event) => event.zeroReversionTimeUtc).length,
      nextContinuations: thresholdEvents.filter((event) => event.nextContinuationTimeUtc).length,
      halfBeforeNext: thresholdEvents.filter((event) => event.halfBeforeNext === true).length,
      zeroBeforeNext: thresholdEvents.filter((event) => event.zeroBeforeNext === true).length,
      nextBeforeZero: thresholdEvents.filter((event) => event.nextBeforeZero === true).length,
      closeBelowTouch: thresholdEvents.filter((event) => event.closeBelowTouch).length,
      closeAtOrThroughZero: thresholdEvents.filter((event) => event.closeAtOrThroughZero).length,
      medianTouchHours: round(percentile(hours("touchHours"), 50), 2),
      medianHalfReversionHours: round(percentile(hours("halfReversionHours"), 50), 2),
      medianZeroReversionHours: round(percentile(hours("zeroReversionHours"), 50), 2),
      medianNextContinuationHours: round(percentile(hours("nextContinuationHours"), 50), 2),
      avgCloseSideSignedAdr: round(average(hours("closeSideSignedAdr")), 4),
      medianPeakContinuationAdr: round(percentile(hours("peakContinuationAdr"), 50), 4),
      medianMaxReversionFromTouchAdr: round(percentile(hours("maxReversionFromTouchAdr"), 50), 4),
    };
  });
}

function summarizeYears(weeks: WeekRow[], bands: number[]): YearSummary[] {
  const groups = new Map<string, WeekRow[]>();
  for (const row of weeks) {
    const year = row.pineWeekKey.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), row]);
  }
  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([year, yearRows]) => {
    const completeRows = yearRows.filter((row) =>
      row.commonHourlyPoints > 0 && row.missingSymbols.length === 0 && row.defaultAdrSymbols.length === 0,
    );
    const pressures = completeRows
      .map((row) => row.listedLongMaxAbsBasketAdr)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const events = completeRows.flatMap((row) => row.bandEvents);
    const touchCount = (threshold: number) => events.filter((event) => event.thresholdAdr === threshold).length;
    const oneAdrEvents = events.filter((event) => event.thresholdAdr === 1);
    return {
      year,
      completeWeeks: completeRows.length,
      medianMaxAbsBasketAdr: round(percentile(pressures, 50), 4),
      p75MaxAbsBasketAdr: round(percentile(pressures, 75), 4),
      p90MaxAbsBasketAdr: round(percentile(pressures, 90), 4),
      maxAbsBasketAdr: round(pressures.length > 0 ? Math.max(...pressures) : null, 4),
      touch0p75Weeks: bands.includes(0.75) ? touchCount(0.75) : 0,
      touch1p0Weeks: bands.includes(1) ? touchCount(1) : 0,
      touch1p5Weeks: bands.includes(1.5) ? touchCount(1.5) : 0,
      zeroBeforeNext1p0: oneAdrEvents.filter((event) => event.zeroBeforeNext === true).length,
    };
  });
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  fromDate: string | null;
  toDate: string | null;
  expectedPairs: string[];
  strictAdr: boolean;
  bands: number[];
  weeks: WeekRow[];
  bandSummaries: BandSummary[];
  yearSummaries: YearSummary[];
  jsonPath: string;
  csvPath: string;
}) {
  const completeWeeks = options.weeks.filter((row) =>
    row.commonHourlyPoints > 0 && row.missingSymbols.length === 0 && row.defaultAdrSymbols.length === 0,
  );
  const maxPressures = completeWeeks
    .map((row) => row.listedLongMaxAbsBasketAdr)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const incompleteWeeks = options.weeks.filter((row) => row.missingSymbols.length > 0 || row.defaultAdrSymbols.length > 0);
  const topPressure = [...completeWeeks]
    .sort((left, right) => (right.listedLongMaxAbsBasketAdr ?? 0) - (left.listedLongMaxAbsBasketAdr ?? 0))
    .slice(0, 12);

  const lines = [
    "# Gate 36b FX Basket ADR Pressure Bands",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Displayed week filter: ${options.fromDate ?? "-"} -> ${options.toDate ?? "-"}`,
    `- Pairs: ${options.expectedPairs.join(", ")}`,
    `- Pair count: ${options.expectedPairs.length}`,
    "- Pressure unit: average of each repo-listed pair's percent move divided by that pair's weekly ADR%.",
    "- `+1.00` means the listed-long 28-pair basket is stretched by one average ADR unit.",
    "- `-1.00` means the listed-short mirror is stretched by one average ADR unit.",
    `- Bands: ${options.bands.map((band) => band.toFixed(2)).join(", ")} ADR units.`,
    `- Strict ADR coverage: ${options.strictAdr ? "on" : "off"}.`,
    "- Exclusions: no spread, commission, swap, slippage, martingale, ADR Grid, or COT regime filter.",
    "",
    "## Summary",
    "",
    `- Weeks selected: ${options.weeks.length}`,
    `- Complete strict-ADR weeks: ${completeWeeks.length}`,
    `- Incomplete or default-ADR weeks: ${incompleteWeeks.length}`,
    `- Median weekly max absolute basket ADR pressure: ${signed(percentile(maxPressures, 50), 2)}`,
    `- P75 weekly max absolute basket ADR pressure: ${signed(percentile(maxPressures, 75), 2)}`,
    `- P90 weekly max absolute basket ADR pressure: ${signed(percentile(maxPressures, 90), 2)}`,
    `- P95 weekly max absolute basket ADR pressure: ${signed(percentile(maxPressures, 95), 2)}`,
    `- Max weekly absolute basket ADR pressure: ${signed(maxPressures.length > 0 ? Math.max(...maxPressures) : null, 2)}`,
    "",
    "## Band Summary",
    "",
    "| Band | Touches | Touch Rate | Long/Short | Half Revert | Zero Revert | Next Continue | Zero Before Next | Next Before Zero | Median Touch Hrs | Median Zero Hrs | Avg Close Side-Signed |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.bandSummaries.map((row) =>
      `| ${row.thresholdAdr.toFixed(2)} | ${row.touchedWeeks}/${row.completeWeeks} | ${pct(row.touchRate)} | ${row.listedLongTouches}/${row.listedShortTouches} | ${row.halfReversions} | ${row.zeroReversions} | ${row.nextContinuations} | ${row.zeroBeforeNext} | ${row.nextBeforeZero} | ${fixed(row.medianTouchHours)} | ${fixed(row.medianZeroReversionHours)} | ${signed(row.avgCloseSideSignedAdr, 2)} |`),
    "",
    "## Year Summary",
    "",
    "| Year | Complete Weeks | Median Max Abs | P75 Max Abs | P90 Max Abs | Max Abs | Touch >=0.75 | Touch >=1.00 | Touch >=1.50 | 1.00 Zero Before Next |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.yearSummaries.map((row) =>
      `| ${row.year} | ${row.completeWeeks} | ${signed(row.medianMaxAbsBasketAdr, 2)} | ${signed(row.p75MaxAbsBasketAdr, 2)} | ${signed(row.p90MaxAbsBasketAdr, 2)} | ${signed(row.maxAbsBasketAdr, 2)} | ${row.touch0p75Weeks} | ${row.touch1p0Weeks} | ${row.touch1p5Weeks} | ${row.zeroBeforeNext1p0} |`),
    "",
    "## Largest Basket ADR Pressure Events",
    "",
    "| Week | Max Abs Basket ADR | Time | Close ADR | Peak ADR | Trough ADR | Close Raw % | Points |",
    "|---|---:|---|---:|---:|---:|---:|---:|",
    ...topPressure.map((row) =>
      `| ${row.pineWeekKey} | ${signed(row.listedLongMaxAbsBasketAdr, 2)} | ${row.listedLongMaxAbsBasketAdrTimeUtc ?? "-"} | ${signed(row.listedLongCloseBasketAdr, 2)} | ${signed(row.listedLongPeakBasketAdr, 2)} | ${signed(row.listedLongTroughBasketAdr, 2)} | ${signed(row.listedLongCloseRawPct, 2, "%")} | ${row.commonHourlyPoints} |`),
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
  const strictAdr = parseBoolean("strict-adr", true);
  const bands = parseBands();
  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/fx-basket-adr-pressure-bands",
  );
  const expectedPairs = PAIRS_BY_ASSET_CLASS.fx.map((pair) => pair.pair.toUpperCase());
  const currentWeekOpenUtc = getDisplayWeekOpenUtc(DateTime.utc());
  const weeks = filterWeeksByDate(
    buildCalendarWeeks({ fromDate, toDate, currentWeekOpenUtc }),
    { from: fromDate, to: toDate },
  );
  const rows: WeekRow[] = [];

  for (const weekOpenUtc of weeks) {
    rows.push(await buildWeekRow({
      weekOpenUtc,
      expectedPairs,
      strictAdr,
      bands,
    }));
  }

  const bandEvents = rows.flatMap((row) => row.bandEvents);
  const bandSummaries = summarizeBands(rows, bands);
  const yearSummaries = summarizeYears(rows, bands);
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `fx-28pair-basket-adr-pressure-bands-${weeks.length}w-${stamp}`;
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);
  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 36b fx-basket-adr-pressure-bands",
      displayedWeekFrom: fromDate,
      displayedWeekTo: toDate,
      expectedPairs,
      expectedPairCount: expectedPairs.length,
      weekOpenUtcs: weeks,
      selectedWeekCount: weeks.length,
      strictAdr,
      bands,
      pressureDefinition: "average((close - entry) / entry * 100 / weeklyAdrPct) across all 28 listed-orientation FX pairs",
      exclusions: ["spread", "commission", "swap", "slippage", "martingale", "adr_grid", "cot_regime_filter"],
    },
    bandSummaries,
    yearSummaries,
    weeks: rows,
    bandEvents,
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(bandEvents)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    fromDate,
    toDate,
    expectedPairs,
    strictAdr,
    bands,
    weeks: rows,
    bandSummaries,
    yearSummaries,
    jsonPath,
    csvPath,
  }), "utf8");

  const completeRows = rows.filter((row) =>
    row.commonHourlyPoints > 0 && row.missingSymbols.length === 0 && row.defaultAdrSymbols.length === 0,
  );
  const maxPressures = completeRows
    .map((row) => row.listedLongMaxAbsBasketAdr)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  console.log(`FX basket ADR pressure bands: ${expectedPairs.length} pairs`);
  console.log(`Weeks: ${weeks.length}, complete strict-ADR=${completeRows.length}`);
  console.log(`Median/P90/P95 max basket ADR: ${signed(percentile(maxPressures, 50), 2)} / ${signed(percentile(maxPressures, 90), 2)} / ${signed(percentile(maxPressures, 95), 2)}`);
  for (const summary of bandSummaries) {
    console.log(`Band ${summary.thresholdAdr.toFixed(2)}: touches=${summary.touchedWeeks}/${summary.completeWeeks}, zeroBeforeNext=${summary.zeroBeforeNext}, nextBeforeZero=${summary.nextBeforeZero}`);
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
