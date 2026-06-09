import { DateTime } from "luxon";

// Canonical trading week anchor across platform: Sunday 19:00 ET.
export function getCanonicalWeekOpenUtc(now = DateTime.utc()): string {
  const nyNow = now.setZone("America/New_York");
  const daysSinceSunday = nyNow.weekday % 7;
  let sunday = nyNow.minus({ days: daysSinceSunday });

  let open = sunday.set({
    hour: 19,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  if (daysSinceSunday === 0 && nyNow.toMillis() < open.toMillis()) {
    sunday = sunday.minus({ days: 7 });
    open = sunday.set({
      hour: 19,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
  }

  return open.toUTC().toISO() ?? now.toUTC().toISO();
}

export function normalizeWeekOpenUtc(isoValue: string): string | null {
  const parsed = DateTime.fromISO(isoValue, { zone: "utc" });
  if (!parsed.isValid) {
    return null;
  }
  return getCanonicalWeekOpenUtc(parsed);
}

export function getDisplayWeekOpenUtc(now = DateTime.utc()): string {
  return getCanonicalWeekOpenUtc(now);
}

export function getTradingWeekLabelDate(weekOpenUtc: string): DateTime | null {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!parsed.isValid) return null;

  return parsed
    .setZone("America/New_York")
    .plus({ days: 1 })
    .startOf("day");
}

export function formatTradingWeekLabelDate(weekOpenUtc: string): string {
  const labelDate = getTradingWeekLabelDate(weekOpenUtc);
  return labelDate?.toFormat("MMM dd yyyy") ?? weekOpenUtc;
}

export function formatTradingWeekLabelIsoDate(weekOpenUtc: string): string {
  const labelDate = getTradingWeekLabelDate(weekOpenUtc);
  return labelDate?.toFormat("yyyy-MM-dd") ?? weekOpenUtc.split("T")[0] ?? weekOpenUtc;
}
