/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-fx-basket-adr-band-state-probe.ts
 *
 * Description:
 * Gate 36c research-only probe for basket ADR band state. It asks whether the
 * first touch of a basket ADR band continues to the next band or fails back
 * through the touched band, and whether that failure then snaps toward half or
 * zero before retouching the band.
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
type FirstState = "continue_to_next" | "fail_below_band" | "none";
type FirstBeforeResult = true | false | null;

type WeekPoint = {
  tsUtc: string;
  listedLongBasketAdr: number;
};

type BandStateEvent = {
  weekOpenUtc: string;
  pineWeekKey: string;
  thresholdAdr: number;
  nextThresholdAdr: number;
  side: BasketSide;
  touchTimeUtc: string;
  touchHours: number;
  pressureAtTouchAdr: number;
  firstState: FirstState;
  continuationTimeUtc: string | null;
  continuationHoursFromTouch: number | null;
  failureTimeUtc: string | null;
  failureHoursFromTouch: number | null;
  halfSnapTimeUtc: string | null;
  halfSnapHoursFromFailure: number | null;
  zeroSnapTimeUtc: string | null;
  zeroSnapHoursFromFailure: number | null;
  retouchTimeUtc: string | null;
  retouchHoursFromFailure: number | null;
  halfBeforeRetouch: FirstBeforeResult;
  zeroBeforeRetouch: FirstBeforeResult;
  retouchBeforeHalf: FirstBeforeResult;
  retouchBeforeZero: FirstBeforeResult;
  closeSideSignedAdr: number;
  closeBelowBand: boolean;
  closeBelowHalf: boolean;
  closeAtOrThroughZero: boolean;
  minAfterFailureAdr: number | null;
  maxAfterFailureAdr: number | null;
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
  closeBasketAdr: number | null;
  peakBasketAdr: number | null;
  troughBasketAdr: number | null;
  maxAbsBasketAdr: number | null;
  maxAbsBasketAdrTimeUtc: string | null;
  events: BandStateEvent[];
};

type BandSummary = {
  thresholdAdr: number;
  nextThresholdAdr: number;
  completeWeeks: number;
  touches: number;
  touchRate: number | null;
  listedLongTouches: number;
  listedShortTouches: number;
  continuationFirst: number;
  failureFirst: number;
  noDecision: number;
  failureHalfBeforeRetouch: number;
  failureZeroBeforeRetouch: number;
  failureRetouchBeforeHalf: number;
  failureRetouchBeforeZero: number;
  medianTouchHours: number | null;
  medianContinuationHoursFromTouch: number | null;
  medianFailureHoursFromTouch: number | null;
  medianHalfSnapHoursFromFailure: number | null;
  medianZeroSnapHoursFromFailure: number | null;
  medianRetouchHoursFromFailure: number | null;
  avgFailureCloseSideSignedAdr: number | null;
};

type YearSummary = {
  year: string;
  completeWeeks: number;
  touch0p75: number;
  touch1p0: number;
  failureFirst0p75: number;
  failureFirst1p0: number;
  halfBeforeRetouch0p75: number;
  halfBeforeRetouch1p0: number;
  medianMaxAbsBasketAdr: number | null;
  p90MaxAbsBasketAdr: number | null;
};

const DEFAULT_BANDS = [0.5, 0.75, 1, 1.25, 1.5];

const EVENT_COLUMNS: Array<keyof BandStateEvent> = [
  "weekOpenUtc",
  "pineWeekKey",
  "thresholdAdr",
  "nextThresholdAdr",
  "side",
  "touchTimeUtc",
  "touchHours",
  "pressureAtTouchAdr",
  "firstState",
  "continuationTimeUtc",
  "continuationHoursFromTouch",
  "failureTimeUtc",
  "failureHoursFromTouch",
  "halfSnapTimeUtc",
  "halfSnapHoursFromFailure",
  "zeroSnapTimeUtc",
  "zeroSnapHoursFromFailure",
  "retouchTimeUtc",
  "retouchHoursFromFailure",
  "halfBeforeRetouch",
  "zeroBeforeRetouch",
  "retouchBeforeHalf",
  "retouchBeforeZero",
  "closeSideSignedAdr",
  "closeBelowBand",
  "closeBelowHalf",
  "closeAtOrThroughZero",
  "minAfterFailureAdr",
  "maxAfterFailureAdr",
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

function signed(value: number | null | undefined, places = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(places)}`;
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

function toCsv(rows: BandStateEvent[]) {
  return [
    EVENT_COLUMNS.join(","),
    ...rows.map((row) => EVENT_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function pineWeekKey(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.plus({ days: 1 }).toISODate() ?? weekOpenUtc.slice(0, 10) : weekOpenUtc.slice(0, 10);
}

function selectClosedWeeks(weeks: string[], currentWeekOpenUtc: string) {
  const normalizedCurrent = normalizeWeekOpenUtc(currentWeekOpenUtc) ?? currentWeekOpenUtc;
  return weeks
    .map((week) => normalizeWeekOpenUtc(week) ?? week)
    .filter((value, index, all) => all.indexOf(value) === index)
    .filter((week) => week < normalizedCurrent)
    .sort((left, right) => left.localeCompare(right));
}

function buildCalendarWeeks(options: { fromDate: string | null; toDate: string | null; currentWeekOpenUtc: string }) {
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

function hoursBetween(startUtc: string | null, endUtc: string | null) {
  if (!startUtc || !endUtc) return null;
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

function invertFirstBefore(value: FirstBeforeResult): FirstBeforeResult {
  return value === null ? null : !value;
}

function buildBarMaps(bars: CanonicalPriceBar[]) {
  const byClose = new Map<string, CanonicalPriceBar>();
  for (const bar of bars) byClose.set(bar.barCloseUtc, bar);
  return byClose;
}

function sideSignedPressure(point: WeekPoint, side: BasketSide) {
  return side === "listed_long" ? point.listedLongBasketAdr : -point.listedLongBasketAdr;
}

function nextThresholdFor(bands: number[], threshold: number) {
  const next = bands.find((band) => band > threshold);
  return next ?? threshold + 0.5;
}

function buildEvents(options: {
  weekOpenUtc: string;
  points: WeekPoint[];
  bands: number[];
  windowOpenUtc: string;
}) {
  const events: BandStateEvent[] = [];
  const pineKey = pineWeekKey(options.weekOpenUtc);

  for (const threshold of options.bands) {
    const touchIndex = options.points.findIndex((point) =>
      point.listedLongBasketAdr >= threshold || point.listedLongBasketAdr <= -threshold,
    );
    if (touchIndex < 0) continue;

    const touch = options.points[touchIndex]!;
    const side: BasketSide = touch.listedLongBasketAdr >= threshold ? "listed_long" : "listed_short";
    const nextThreshold = nextThresholdFor(options.bands, threshold);
    const signed = options.points.map((point) => ({
      tsUtc: point.tsUtc,
      value: sideSignedPressure(point, side),
    }));
    const afterTouch = signed.slice(touchIndex);
    const afterTouchExcludingTouch = signed.slice(touchIndex + 1);
    const continuationTimeUtc = afterTouch.find((point) => point.value >= nextThreshold)?.tsUtc ?? null;
    const failureTimeUtc = afterTouchExcludingTouch.find((point) => point.value < threshold)?.tsUtc ?? null;

    let firstState: FirstState = "none";
    const continuationBeforeFailure = firstBefore(continuationTimeUtc, failureTimeUtc);
    if (continuationBeforeFailure === true) firstState = "continue_to_next";
    if (continuationBeforeFailure === false) firstState = "fail_below_band";

    const failureIndex = failureTimeUtc
      ? signed.findIndex((point) => point.tsUtc === failureTimeUtc)
      : -1;
    const afterFailure = failureIndex >= 0 ? signed.slice(failureIndex) : [];
    const afterFailureExcludingFailure = failureIndex >= 0 ? signed.slice(failureIndex + 1) : [];
    const halfSnapTimeUtc = afterFailure.find((point) => point.value <= threshold / 2)?.tsUtc ?? null;
    const zeroSnapTimeUtc = afterFailure.find((point) => point.value <= 0)?.tsUtc ?? null;
    const retouchTimeUtc = afterFailureExcludingFailure.find((point) => point.value >= threshold)?.tsUtc ?? null;
    const closeSideSignedAdr = signed[signed.length - 1]?.value ?? sideSignedPressure(touch, side);
    const afterFailureValues = afterFailure.map((point) => point.value);
    const halfBeforeRetouch = firstBefore(halfSnapTimeUtc, retouchTimeUtc);
    const zeroBeforeRetouch = firstBefore(zeroSnapTimeUtc, retouchTimeUtc);

    events.push({
      weekOpenUtc: options.weekOpenUtc,
      pineWeekKey: pineKey,
      thresholdAdr: round(threshold, 4) ?? threshold,
      nextThresholdAdr: round(nextThreshold, 4) ?? nextThreshold,
      side,
      touchTimeUtc: touch.tsUtc,
      touchHours: hoursBetween(options.windowOpenUtc, touch.tsUtc) ?? 0,
      pressureAtTouchAdr: round(sideSignedPressure(touch, side), 4) ?? threshold,
      firstState,
      continuationTimeUtc,
      continuationHoursFromTouch: hoursBetween(touch.tsUtc, continuationTimeUtc),
      failureTimeUtc,
      failureHoursFromTouch: hoursBetween(touch.tsUtc, failureTimeUtc),
      halfSnapTimeUtc,
      halfSnapHoursFromFailure: hoursBetween(failureTimeUtc, halfSnapTimeUtc),
      zeroSnapTimeUtc,
      zeroSnapHoursFromFailure: hoursBetween(failureTimeUtc, zeroSnapTimeUtc),
      retouchTimeUtc,
      retouchHoursFromFailure: hoursBetween(failureTimeUtc, retouchTimeUtc),
      halfBeforeRetouch,
      zeroBeforeRetouch,
      retouchBeforeHalf: invertFirstBefore(halfBeforeRetouch),
      retouchBeforeZero: invertFirstBefore(zeroBeforeRetouch),
      closeSideSignedAdr: round(closeSideSignedAdr, 4) ?? closeSideSignedAdr,
      closeBelowBand: closeSideSignedAdr < threshold,
      closeBelowHalf: closeSideSignedAdr <= threshold / 2,
      closeAtOrThroughZero: closeSideSignedAdr <= 0,
      minAfterFailureAdr: round(afterFailureValues.length > 0 ? Math.min(...afterFailureValues) : null, 4),
      maxAfterFailureAdr: round(afterFailureValues.length > 0 ? Math.max(...afterFailureValues) : null, 4),
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
        listedLongAdrSum += rawReturnPct / pairAdrPct;
      }

      if (!valid) continue;
      points.push({
        tsUtc,
        listedLongBasketAdr: listedLongAdrSum / options.expectedPairs.length,
      });
    }
  }

  const pressureValues = points.map((point) => point.listedLongBasketAdr);
  const maxAbsPoint = points.reduce<WeekPoint | null>(
    (best, point) => (!best || Math.abs(point.listedLongBasketAdr) > Math.abs(best.listedLongBasketAdr) ? point : best),
    null,
  );
  const events = buildEvents({ weekOpenUtc: options.weekOpenUtc, points, bands: options.bands, windowOpenUtc });

  return {
    weekOpenUtc: options.weekOpenUtc,
    pineWeekKey: pineWeekKey(options.weekOpenUtc),
    sourceReportDate: deriveCotReportDate(options.weekOpenUtc),
    entryTimeUtc: points[0]?.tsUtc ?? null,
    exitTimeUtc: points[points.length - 1]?.tsUtc ?? null,
    commonHourlyPoints: points.length,
    missingSymbols: uniqueMissing,
    defaultAdrSymbols: uniqueDefaultAdr,
    closeBasketAdr: round(pressureValues[pressureValues.length - 1], 4),
    peakBasketAdr: round(pressureValues.length > 0 ? Math.max(...pressureValues, 0) : null, 4),
    troughBasketAdr: round(pressureValues.length > 0 ? Math.min(...pressureValues, 0) : null, 4),
    maxAbsBasketAdr: round(maxAbsPoint ? Math.abs(maxAbsPoint.listedLongBasketAdr) : null, 4),
    maxAbsBasketAdrTimeUtc: maxAbsPoint?.tsUtc ?? null,
    events,
  };
}

function summarizeBands(weeks: WeekRow[], bands: number[]): BandSummary[] {
  const completeWeeks = weeks.filter((week) =>
    week.commonHourlyPoints > 0 && week.missingSymbols.length === 0 && week.defaultAdrSymbols.length === 0,
  );
  const events = weeks.flatMap((week) => week.events);
  return bands.map((threshold) => {
    const thresholdEvents = events.filter((event) => event.thresholdAdr === threshold);
    const failures = thresholdEvents.filter((event) => event.firstState === "fail_below_band");
    const numbers = (rows: BandStateEvent[], field: keyof BandStateEvent) =>
      rows.map((event) => event[field]).filter((value): value is number => typeof value === "number");
    const nextThreshold = nextThresholdFor(bands, threshold);
    return {
      thresholdAdr: threshold,
      nextThresholdAdr: nextThreshold,
      completeWeeks: completeWeeks.length,
      touches: thresholdEvents.length,
      touchRate: completeWeeks.length > 0 ? thresholdEvents.length / completeWeeks.length : null,
      listedLongTouches: thresholdEvents.filter((event) => event.side === "listed_long").length,
      listedShortTouches: thresholdEvents.filter((event) => event.side === "listed_short").length,
      continuationFirst: thresholdEvents.filter((event) => event.firstState === "continue_to_next").length,
      failureFirst: failures.length,
      noDecision: thresholdEvents.filter((event) => event.firstState === "none").length,
      failureHalfBeforeRetouch: failures.filter((event) => event.halfBeforeRetouch === true).length,
      failureZeroBeforeRetouch: failures.filter((event) => event.zeroBeforeRetouch === true).length,
      failureRetouchBeforeHalf: failures.filter((event) => event.retouchBeforeHalf === true).length,
      failureRetouchBeforeZero: failures.filter((event) => event.retouchBeforeZero === true).length,
      medianTouchHours: round(percentile(numbers(thresholdEvents, "touchHours"), 50), 2),
      medianContinuationHoursFromTouch: round(percentile(numbers(thresholdEvents, "continuationHoursFromTouch"), 50), 2),
      medianFailureHoursFromTouch: round(percentile(numbers(failures, "failureHoursFromTouch"), 50), 2),
      medianHalfSnapHoursFromFailure: round(percentile(numbers(failures, "halfSnapHoursFromFailure"), 50), 2),
      medianZeroSnapHoursFromFailure: round(percentile(numbers(failures, "zeroSnapHoursFromFailure"), 50), 2),
      medianRetouchHoursFromFailure: round(percentile(numbers(failures, "retouchHoursFromFailure"), 50), 2),
      avgFailureCloseSideSignedAdr: round(average(numbers(failures, "closeSideSignedAdr")), 4),
    };
  });
}

function summarizeYears(weeks: WeekRow[]): YearSummary[] {
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
      .map((row) => row.maxAbsBasketAdr)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const events = completeRows.flatMap((row) => row.events);
    const thresholdEvents = (threshold: number) => events.filter((event) => event.thresholdAdr === threshold);
    return {
      year,
      completeWeeks: completeRows.length,
      touch0p75: thresholdEvents(0.75).length,
      touch1p0: thresholdEvents(1).length,
      failureFirst0p75: thresholdEvents(0.75).filter((event) => event.firstState === "fail_below_band").length,
      failureFirst1p0: thresholdEvents(1).filter((event) => event.firstState === "fail_below_band").length,
      halfBeforeRetouch0p75: thresholdEvents(0.75).filter((event) => event.firstState === "fail_below_band" && event.halfBeforeRetouch === true).length,
      halfBeforeRetouch1p0: thresholdEvents(1).filter((event) => event.firstState === "fail_below_band" && event.halfBeforeRetouch === true).length,
      medianMaxAbsBasketAdr: round(percentile(pressures, 50), 4),
      p90MaxAbsBasketAdr: round(percentile(pressures, 90), 4),
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
  const incompleteWeeks = options.weeks.filter((row) => row.missingSymbols.length > 0 || row.defaultAdrSymbols.length > 0);
  const lines = [
    "# Gate 36c FX Basket ADR Band State Probe",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Displayed week filter: ${options.fromDate ?? "-"} -> ${options.toDate ?? "-"}`,
    `- Pairs: ${options.expectedPairs.join(", ")}`,
    "- Unit: basket ADR pressure, average pair percent move divided by weekly ADR%.",
    `- Bands: ${options.bands.map((band) => band.toFixed(2)).join(", ")} ADR units.`,
    `- Strict ADR coverage: ${options.strictAdr ? "on" : "off"}.`,
    "- Question: after first band touch, does pressure continue to the next band or fail back through the touched band?",
    "- Failure entry check: after failure below touched band, does pressure snap to half/zero before retouching the band?",
    "",
    "## Summary",
    "",
    `- Weeks selected: ${options.weeks.length}`,
    `- Complete strict-ADR weeks: ${completeWeeks.length}`,
    `- Incomplete/default-ADR weeks: ${incompleteWeeks.length}`,
    "",
    "## Band State Summary",
    "",
    "| Band | Touches | Touch Rate | Long/Short | Continue First | Fail First | No Decision | Fail Half Before Retouch | Fail Zero Before Retouch | Retouch Before Half | Median Touch Hrs | Median Fail Hrs | Median Half-Snap Hrs | Avg Failure Close |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.bandSummaries.map((row) =>
      `| ${row.thresholdAdr.toFixed(2)} | ${row.touches}/${row.completeWeeks} | ${pct(row.touchRate)} | ${row.listedLongTouches}/${row.listedShortTouches} | ${row.continuationFirst} | ${row.failureFirst} | ${row.noDecision} | ${row.failureHalfBeforeRetouch} | ${row.failureZeroBeforeRetouch} | ${row.failureRetouchBeforeHalf} | ${fixed(row.medianTouchHours)} | ${fixed(row.medianFailureHoursFromTouch)} | ${fixed(row.medianHalfSnapHoursFromFailure)} | ${signed(row.avgFailureCloseSideSignedAdr)} |`),
    "",
    "## Year Summary",
    "",
    "| Year | Complete Weeks | Touch 0.75 | Fail First 0.75 | Half Before Retouch 0.75 | Touch 1.00 | Fail First 1.00 | Half Before Retouch 1.00 | Median Max Abs | P90 Max Abs |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.yearSummaries.map((row) =>
      `| ${row.year} | ${row.completeWeeks} | ${row.touch0p75} | ${row.failureFirst0p75} | ${row.halfBeforeRetouch0p75} | ${row.touch1p0} | ${row.failureFirst1p0} | ${row.halfBeforeRetouch1p0} | ${signed(row.medianMaxAbsBasketAdr)} | ${signed(row.p90MaxAbsBasketAdr)} |`),
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
    argValue("out-dir") ?? "app/reports/data-verification/fx-basket-adr-band-state",
  );
  const expectedPairs = PAIRS_BY_ASSET_CLASS.fx.map((pair) => pair.pair.toUpperCase());
  const currentWeekOpenUtc = getDisplayWeekOpenUtc(DateTime.utc());
  const weeks = buildCalendarWeeks({ fromDate, toDate, currentWeekOpenUtc });
  const rows: WeekRow[] = [];

  for (const weekOpenUtc of weeks) {
    rows.push(await buildWeekRow({ weekOpenUtc, expectedPairs, strictAdr, bands }));
  }

  const events = rows.flatMap((row) => row.events);
  const bandSummaries = summarizeBands(rows, bands);
  const yearSummaries = summarizeYears(rows);
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `fx-28pair-basket-adr-band-state-${weeks.length}w-${stamp}`;
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);
  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 36c fx-basket-adr-band-state",
      displayedWeekFrom: fromDate,
      displayedWeekTo: toDate,
      expectedPairs,
      expectedPairCount: expectedPairs.length,
      selectedWeekCount: weeks.length,
      weekOpenUtcs: weeks,
      strictAdr,
      bands,
      pressureDefinition: "average((close - entry) / entry * 100 / weeklyAdrPct) across all 28 listed-orientation FX pairs",
      firstStateDefinition: "continue_to_next if next band is reached before failure below touched band; fail_below_band if pressure fails below touched band before next band",
      exclusions: ["spread", "commission", "swap", "slippage", "martingale", "adr_grid", "cot_regime_filter"],
    },
    bandSummaries,
    yearSummaries,
    weeks: rows,
    events,
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(events)}\n`, "utf8");
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
  console.log(`FX basket ADR band-state probe: ${expectedPairs.length} pairs`);
  console.log(`Weeks: ${weeks.length}, complete strict-ADR=${completeRows.length}`);
  for (const summary of bandSummaries) {
    console.log(`Band ${summary.thresholdAdr.toFixed(2)}: touches=${summary.touches}/${summary.completeWeeks}, continueFirst=${summary.continuationFirst}, failFirst=${summary.failureFirst}, halfBeforeRetouch=${summary.failureHalfBeforeRetouch}, zeroBeforeRetouch=${summary.failureZeroBeforeRetouch}`);
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
