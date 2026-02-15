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

// UI display anchor:
// after Friday 15:30 ET release, default to the upcoming trading week.
export function getDisplayWeekOpenUtc(now = DateTime.utc()): string {
  const canonical = getCanonicalWeekOpenUtc(now);
  const currentWeek = DateTime.fromISO(canonical, { zone: "utc" });
  if (!currentWeek.isValid) {
    return canonical;
  }

  // Anchor release check to the canonical trading week (Sunday 19:00 ET),
  // so Sunday pre-open still points to the upcoming week after Friday release.
  const canonicalEt = currentWeek.setZone("America/New_York");
  const fridayReleaseEt = canonicalEt.plus({ days: 5 }).set({
    hour: 15,
    minute: 30,
    second: 0,
    millisecond: 0,
  });
  const releasePassed = now.toUTC().toMillis() >= fridayReleaseEt.toUTC().toMillis();

  if (!releasePassed) {
    return canonical;
  }
  return currentWeek.plus({ days: 7 }).toUTC().toISO() ?? canonical;
}
