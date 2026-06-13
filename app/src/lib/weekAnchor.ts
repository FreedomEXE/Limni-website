import { DateTime } from "luxon";

const DISPLAY_WEEK_ROLLOVER_ZONE = "America/New_York";
const DISPLAY_WEEK_ROLLOVER_LOCAL_WEEKDAY = 5;
const DISPLAY_WEEK_ROLLOVER_LOCAL_HOUR = 17;

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
  const currentWeekOpenUtc = getCanonicalWeekOpenUtc(now);
  const currentWeekOpen = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  if (!currentWeekOpen.isValid) {
    return currentWeekOpenUtc;
  }

  const nextWeekOpen = currentWeekOpen
    .setZone(DISPLAY_WEEK_ROLLOVER_ZONE)
    .plus({ weeks: 1 });
  const nextWeekOpenUtc = nextWeekOpen.toUTC().toISO() ?? currentWeekOpenUtc;
  const daysBackToRollover = (nextWeekOpen.weekday - DISPLAY_WEEK_ROLLOVER_LOCAL_WEEKDAY + 7) % 7;
  const rollover = nextWeekOpen.minus({ days: daysBackToRollover }).set({
    hour: DISPLAY_WEEK_ROLLOVER_LOCAL_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  return now.toUTC().toMillis() >= rollover.toUTC().toMillis()
    ? nextWeekOpenUtc
    : currentWeekOpenUtc;
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
