import { DateTime } from "luxon";
import type { AssetClass } from "./cotMarkets";

/**
 * Week window with market-specific open and close times
 */
export type WeekWindow = {
  openUtc: DateTime;
  closeUtc: DateTime;
  marketCloseHour: number; // ET hour (17 for FX, 18 for crypto)
  durationDays: number;
};

/**
 * Gets the week trading window for a specific asset class
 *
 * FIXED: All weeks now run full 7 days (Sunday → Sunday) to capture complete weekly equity changes
 * Previously, FX/commodity weeks stopped on Friday, missing 2 days of potential P&L
 *
 * Market-specific close times:
 * - FX: Sunday 19:00 ET → Sunday 19:00 ET (7 days)
 * - Crypto: Sunday 18:00 ET → Sunday 18:00 ET (7 days)
 * - Commodity: Sunday 18:00 ET → Sunday 18:00 ET (7 days)
 *
 * @param assetClass - The asset class (fx, crypto, commodity)
 * @param reportDate - The COT report date (optional)
 * @param weekOpenUtc - Fallback week open timestamp
 * @returns Week window with open/close times in UTC
 */
export function getWeekWindow(
  assetClass: AssetClass,
  reportDate: string | null,
  weekOpenUtc: string
): WeekWindow {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });

  // Crypto uses Monday-to-Monday cycles
  if (assetClass === "crypto") {
    if (reportDate) {
      const report = DateTime.fromISO(reportDate, { zone: "utc" });
      if (report.isValid) {
        const nextMonday = report.startOf("week").plus({ weeks: 1 });
        return {
          openUtc: nextMonday.toUTC(),
          closeUtc: nextMonday.plus({ weeks: 1 }).toUTC(),
          marketCloseHour: 18, // Crypto markets close at 6pm ET on Sunday
          durationDays: 7,
        };
      }
    }
    const fallbackOpen = weekOpen.isValid ? weekOpen : DateTime.utc().startOf("week");
    return {
      openUtc: fallbackOpen,
      closeUtc: fallbackOpen.plus({ weeks: 1 }),
      marketCloseHour: 18,
      durationDays: 7,
    };
  }

  // FX and commodities use Sunday-to-Sunday cycles with ET market hours
  if (reportDate) {
    const reportNy = DateTime.fromISO(reportDate, { zone: "America/New_York" });
    if (reportNy.isValid) {
      // Find next Sunday after report date
      const daysUntilSunday = (7 - (reportNy.weekday % 7)) % 7;
      const closeHour = assetClass === "fx" ? 17 : 18; // FX 5pm, Commodity 6pm

      const sunday = reportNy
        .plus({ days: daysUntilSunday })
        .set({ hour: closeHour, minute: 0, second: 0, millisecond: 0 });

      // FIXED: Full 7-day week (Sunday → Sunday), not 5 days (Sunday → Friday)
      const nextSunday = sunday
        .plus({ days: 7 }) // Changed from 5 to 7
        .set({ hour: closeHour, minute: 0, second: 0, millisecond: 0 });

      return {
        openUtc: sunday.toUTC(),
        closeUtc: nextSunday.toUTC(),
        marketCloseHour: closeHour,
        durationDays: 7,
      };
    }
  }

  // Fallback to standard week
  const fallback = weekOpen.isValid ? weekOpen : DateTime.utc().startOf("week");
  return {
    openUtc: fallback,
    closeUtc: fallback.plus({ days: 7 }), // Changed from 5 to 7
    marketCloseHour: assetClass === "fx" ? 17 : 18,
    durationDays: 7,
  };
}

/**
 * Checks if a timestamp is within a week window
 */
export function isWithinWeekWindow(
  timestamp: DateTime,
  window: WeekWindow
): boolean {
  const ts = timestamp.toMillis();
  return ts >= window.openUtc.toMillis() && ts <= window.closeUtc.toMillis();
}

/**
 * Gets the current week window for an asset class
 */
export function getCurrentWeekWindow(
  assetClass: AssetClass,
  weekOpenUtc: string
): WeekWindow {
  return getWeekWindow(assetClass, null, weekOpenUtc);
}

/**
 * Format week window for display
 */
export function formatWeekWindow(window: WeekWindow): string {
  const openEt = window.openUtc.setZone("America/New_York");
  const closeEt = window.closeUtc.setZone("America/New_York");

  return `${openEt.toFormat("MMM dd, yyyy HH:mm")} ET → ${closeEt.toFormat("MMM dd, yyyy HH:mm")} ET (${window.durationDays} days)`;
}
