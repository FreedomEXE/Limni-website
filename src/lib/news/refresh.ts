import { DateTime } from "luxon";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { fetchForexFactoryCalendarEvents } from "./fetch";
import { writeNewsWeeklySnapshot } from "./store";
import type { NewsEvent } from "./types";

function buildAnnouncements(events: NewsEvent[], nowUtc: DateTime) {
  const recentWindowStart = nowUtc.minus({ days: 7 }).toUTC().toMillis();
  const upcomingWindowEnd = nowUtc.plus({ days: 3 }).toUTC().toMillis();
  return events
    .filter((event) => event.impact === "High" || event.impact === "Medium")
    .filter((event) => {
      if (!event.datetime_utc) return true;
      const ts = Date.parse(event.datetime_utc);
      return ts >= recentWindowStart && ts <= upcomingWindowEnd;
    })
    .slice(0, 20);
}

export async function refreshNewsSnapshot() {
  const events = await fetchForexFactoryCalendarEvents();
  const nowUtc = DateTime.utc();
  const weekOpenUtc = getDisplayWeekOpenUtc(nowUtc);
  const announcements = buildAnnouncements(events, nowUtc);

  await writeNewsWeeklySnapshot({
    week_open_utc: weekOpenUtc,
    source: "forexfactory",
    announcements,
    calendar: events,
  });

  return {
    ok: true,
    week_open_utc: weekOpenUtc,
    announcements: announcements.length,
    calendar_events: events.length,
  };
}
