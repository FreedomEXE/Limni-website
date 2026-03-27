/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonicalPriceWindows.ts
 * Description: Canonical week and day window helpers for the shared price layer.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import type { AssetClass } from "./cotMarkets";
import { getCanonicalWeekOpenUtc, normalizeWeekOpenUtc } from "./weekAnchor";

export type CanonicalPriceWindow = {
  periodOpenUtc: string;
  openUtc: DateTime;
  closeUtc: DateTime;
};

export type CanonicalTradingDayWindow = CanonicalPriceWindow & {
  cutoffHourEt: number;
};

// Dynamic week list — generates all canonical week opens from the start date
// through the current week. No more hardcoded arrays to update manually.
const CANONICAL_WEEKS_START = "2026-01-19T00:00:00.000Z";

function buildCanonicalWeeks(): string[] {
  const weeks: string[] = [];
  const startDt = DateTime.fromISO(CANONICAL_WEEKS_START, { zone: "utc" });
  const nowUtc = DateTime.utc();
  let cursor = startDt;

  while (cursor <= nowUtc) {
    const shifted = cursor.plus({ hours: 24 });
    if (!shifted.isValid) { cursor = cursor.plus({ weeks: 1 }); continue; }
    const weekOpen = getCanonicalWeekOpenUtc(shifted as DateTime<true>);
    if (!weeks.includes(weekOpen)) {
      weeks.push(weekOpen);
    }
    cursor = cursor.plus({ weeks: 1 });
  }

  // Always include the current week
  const currentWeek = getCanonicalWeekOpenUtc(nowUtc);
  if (!weeks.includes(currentWeek)) {
    weeks.push(currentWeek);
  }

  return weeks.sort();
}

export const CANONICAL_WEEKS: readonly string[] = buildCanonicalWeeks();

function parseWeekOpenUtc(weekOpenUtc: string) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid canonical week open: ${weekOpenUtc}`);
  }
  return parsed;
}

export function getCanonicalWeekKeyUtc(value: string | DateTime) {
  const date = typeof value === "string"
    ? DateTime.fromISO(value, { zone: "utc" })
    : value.toUTC();
  if (!date.isValid) {
    throw new Error(`Invalid datetime for canonical week key: ${value}`);
  }
  return getCanonicalWeekOpenUtc(date);
}

export function getCanonicalWeekWindow(
  weekOpenUtc: string,
  assetClass: AssetClass,
): CanonicalPriceWindow {
  const canonicalWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const weekKey = parseWeekOpenUtc(canonicalWeekOpenUtc);

  if (assetClass === "fx") {
    return {
      periodOpenUtc: canonicalWeekOpenUtc,
      openUtc: weekKey.minus({ hours: 2 }),
      closeUtc: weekKey.plus({ hours: 118 }),
    };
  }

  if (assetClass === "indices" || assetClass === "commodities") {
    // Indices/commodities market opens 1 hour after FX (6PM ET vs 5PM ET)
    return {
      periodOpenUtc: canonicalWeekOpenUtc,
      openUtc: weekKey.minus({ hours: 1 }),
      closeUtc: weekKey.plus({ hours: 117 }),
    };
  }

  const cryptoOpenUtc = weekKey.hour === 23 ? weekKey.plus({ hours: 1 }) : weekKey;
  return {
    periodOpenUtc: canonicalWeekOpenUtc,
    openUtc: cryptoOpenUtc,
    closeUtc: cryptoOpenUtc.plus({ days: 7 }),
  };
}

function getTradingDayCutoffHourEt(assetClass: AssetClass) {
  if (assetClass === "commodities") return 18;
  if (assetClass === "crypto") return 20;
  return 17;
}

export function getCanonicalTradingDayWindow(
  assetClass: AssetClass,
  now: DateTime = DateTime.utc(),
): CanonicalTradingDayWindow {
  const cutoffHourEt = getTradingDayCutoffHourEt(assetClass);
  const nyNow = now.setZone("America/New_York");
  let openEt = nyNow.set({
    hour: cutoffHourEt,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  if (nyNow.toMillis() < openEt.toMillis()) {
    openEt = openEt.minus({ days: 1 });
  }

  const openUtc = openEt.toUTC();
  const closeUtc = openEt.plus({ days: 1 }).toUTC();

  return {
    periodOpenUtc: openUtc.toISO() ?? now.toUTC().toISO() ?? "",
    openUtc,
    closeUtc,
    cutoffHourEt,
  };
}

export function listCanonicalDailyWindowsForWeek(
  weekOpenUtc: string,
  assetClass: AssetClass,
): CanonicalPriceWindow[] {
  const weekly = getCanonicalWeekWindow(weekOpenUtc, assetClass);
  const count = assetClass === "crypto" ? 7 : 5;
  const closeOffsetHours = assetClass === "indices" || assetClass === "commodities" ? 23 : 24;
  const windows: CanonicalPriceWindow[] = [];

  for (let index = 0; index < count; index += 1) {
    const openUtc = weekly.openUtc.plus({ days: index });
    const closeUtc = openUtc.plus({ hours: closeOffsetHours });
    windows.push({
      periodOpenUtc: openUtc.toUTC().toISO() ?? weekly.periodOpenUtc,
      openUtc,
      closeUtc: closeUtc > weekly.closeUtc ? weekly.closeUtc : closeUtc,
    });
  }

  return windows;
}

export function getCanonicalDailyBackfillRange(
  assetClass: AssetClass,
  weeks: readonly string[] = CANONICAL_WEEKS,
): { fromUtc: DateTime; toUtc: DateTime } {
  if (weeks.length === 0) {
    throw new Error("Cannot compute backfill range without weeks");
  }
  const firstWeek = getCanonicalWeekWindow(weeks[0]!, assetClass);
  const lastWeek = getCanonicalWeekWindow(weeks[weeks.length - 1]!, assetClass);
  return {
    fromUtc: firstWeek.openUtc,
    toUtc: lastWeek.closeUtc,
  };
}

export function weekContainsBarOpen(
  weekOpenUtc: string,
  assetClass: AssetClass,
  barOpenUtc: string,
) {
  const barOpen = DateTime.fromISO(barOpenUtc, { zone: "utc" });
  if (!barOpen.isValid) {
    return false;
  }
  const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
  return barOpen.toMillis() >= window.openUtc.toMillis() && barOpen.toMillis() < window.closeUtc.toMillis();
}
