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

export const CANONICAL_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
  "2026-02-23T00:00:00.000Z",
  "2026-03-02T00:00:00.000Z",
  "2026-03-08T23:00:00.000Z",
  "2026-03-15T23:00:00.000Z",
] as const;

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
    return {
      periodOpenUtc: canonicalWeekOpenUtc,
      openUtc: weekKey.minus({ hours: 2 }),
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
