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

