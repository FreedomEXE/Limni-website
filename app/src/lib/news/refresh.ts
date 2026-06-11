import { DateTime } from "luxon";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { fetchForexFactoryCalendarEvents } from "./fetch";
import { writeNewsWeeklySnapshot } from "./store";
import type { NewsEvent } from "./types";

function parsePositiveNumber(raw: string | undefined, fallback: number) {
  const parsed = Number(raw ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

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

export function countPendingActualEvents(events: NewsEvent[], nowUtc = DateTime.utc()) {
  const graceMinutes = parsePositiveNumber(process.env.NEWS_RELEASE_GRACE_MINUTES, 3);
  const lookbackHours = parsePositiveNumber(process.env.NEWS_PENDING_ACTUAL_LOOKBACK_HOURS, 36);

  const pastCutoffMs = nowUtc.minus({ minutes: graceMinutes }).toUTC().toMillis();
  const lookbackStartMs = nowUtc.minus({ hours: lookbackHours }).toUTC().toMillis();

  let pending = 0;
  for (const event of events) {
    if (!event.datetime_utc || hasValue(event.actual)) {
      continue;
    }
    const eventMs = Date.parse(event.datetime_utc);
    if (!Number.isFinite(eventMs)) {
      continue;
    }
    if (eventMs >= lookbackStartMs && eventMs <= pastCutoffMs) {
      pending++;
    }
  }
  return pending;
}

export function shouldRefreshForPendingActuals(
  snapshot: { calendar: NewsEvent[]; fetched_at: string },
  nowUtc = DateTime.utc(),
) {
  const pending = countPendingActualEvents(snapshot.calendar, nowUtc);
  if (pending <= 0) {
    return false;
  }
  const fetchedAt = DateTime.fromISO(snapshot.fetched_at, { zone: "utc" });
  if (!fetchedAt.isValid) {
    return true;
  }
  const fastRefreshMinutes = parsePositiveNumber(process.env.NEWS_PENDING_ACTUAL_REFRESH_MINUTES, 5);
  const ageMs = nowUtc.toUTC().toMillis() - fetchedAt.toUTC().toMillis();
  return ageMs >= fastRefreshMinutes * 60 * 1000;
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
