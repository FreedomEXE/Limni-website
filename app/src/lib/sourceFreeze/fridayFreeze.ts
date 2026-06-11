import { DateTime } from "luxon";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";

export const SOURCE_FREEZE_ZONE = "America/New_York";
export const SOURCE_FREEZE_LOCAL_HOUR = 17;
export const SENTIMENT_FRIDAY_CLOSE_SOURCE_VERSION = "sentiment_friday_close_v1";
export const STRENGTH_FRIDAY_CLOSE_SOURCE_VERSION = "strength_friday_close_v1";

export const V203_CLEAN_14W_FREEZE_WEEKS = [
  "2026-02-23T00:00:00.000Z",
  "2026-03-02T00:00:00.000Z",
  "2026-03-08T23:00:00.000Z",
  "2026-03-15T23:00:00.000Z",
  "2026-03-22T23:00:00.000Z",
  "2026-03-29T23:00:00.000Z",
  "2026-04-05T23:00:00.000Z",
  "2026-04-12T23:00:00.000Z",
  "2026-04-19T23:00:00.000Z",
  "2026-04-26T23:00:00.000Z",
  "2026-05-03T23:00:00.000Z",
  "2026-05-10T23:00:00.000Z",
  "2026-05-17T23:00:00.000Z",
  "2026-05-24T23:00:00.000Z",
] as const;

export function getFridayFreezeTargetUtc(weekOpenUtc: string): string {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!weekOpen.isValid) {
    throw new Error(`Invalid weekOpenUtc for Friday freeze: ${weekOpenUtc}`);
  }

  const nyWeekOpen = weekOpen.setZone(SOURCE_FREEZE_ZONE);
  const daysBackToFriday = (nyWeekOpen.weekday - 5 + 7) % 7;
  const fridayCloseNy = nyWeekOpen.minus({ days: daysBackToFriday }).set({
    hour: SOURCE_FREEZE_LOCAL_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  return fridayCloseNy.toUTC().toISO() ?? weekOpenUtc;
}

export function getFridayFreezeDisplayWeekOpenUtc(now = DateTime.utc()): string {
  const currentWeekOpenUtc = getCanonicalWeekOpenUtc(now);
  const currentWeekOpen = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  if (!currentWeekOpen.isValid) {
    return currentWeekOpenUtc;
  }

  const nextWeekOpen = currentWeekOpen.setZone(SOURCE_FREEZE_ZONE).plus({ weeks: 1 });
  const nextWeekOpenUtc = nextWeekOpen.toUTC().toISO() ?? currentWeekOpenUtc;
  const nextFreezeTarget = DateTime.fromISO(getFridayFreezeTargetUtc(nextWeekOpenUtc), { zone: "utc" });
  if (nextFreezeTarget.isValid && now.toUTC().toMillis() >= nextFreezeTarget.toMillis()) {
    return nextWeekOpenUtc;
  }

  return currentWeekOpenUtc;
}
