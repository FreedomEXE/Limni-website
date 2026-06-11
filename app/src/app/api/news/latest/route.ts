import { NextResponse } from "next/server";
import { listNewsWeeks, readNewsWeeklySnapshot, writeNewsWeeklySnapshot } from "@/lib/news/store";
import { refreshNewsSnapshot, shouldRefreshForPendingActuals } from "@/lib/news/refresh";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const revalidate = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toMillis(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldRefreshSnapshot(snapshot: { week_open_utc: string; fetched_at: string }, displayWeekOpenUtc: string) {
  const snapshotWeekMs = toMillis(snapshot.week_open_utc);
  const displayWeekMs = toMillis(displayWeekOpenUtc);
  if (snapshotWeekMs === null || displayWeekMs === null) {
    return true;
  }
  if (snapshotWeekMs < displayWeekMs) {
    return true;
  }

  const maxAgeHoursRaw = Number(process.env.NEWS_MAX_AGE_HOURS ?? "6");
  const maxAgeHours = Number.isFinite(maxAgeHoursRaw) && maxAgeHoursRaw > 0 ? maxAgeHoursRaw : 6;
  const fetchedAtMs = toMillis(snapshot.fetched_at);
  const nowMs = Date.now();
  if (fetchedAtMs === null) {
    return true;
  }
  return nowMs - fetchedAtMs > maxAgeHours * 60 * 60 * 1000;
}

function snapshotContainsDisplayWeekEvents(
  snapshot: { calendar: Array<{ datetime_utc?: string | null }> },
  displayWeekOpenUtc: string,
): boolean {
  const startMs = toMillis(displayWeekOpenUtc);
  if (startMs === null) {
    return false;
  }
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  for (const event of snapshot.calendar ?? []) {
    const eventMs = toMillis(event.datetime_utc ?? null);
    if (eventMs !== null && eventMs >= startMs && eventMs < endMs) {
      return true;
    }
  }
  return false;
}

function countActualValues(snapshot: { calendar: Array<{ actual?: string | null }> }) {
  let count = 0;
  for (const event of snapshot.calendar ?? []) {
    if (typeof event.actual === "string" && event.actual.trim().length > 0) {
      count++;
    }
  }
  return count;
}

async function findBestSnapshotForDisplayWeek(displayWeekOpenUtc: string) {
  const weeks = await listNewsWeeks(24);
  let best: Awaited<ReturnType<typeof readNewsWeeklySnapshot>> = null;
  let bestActual = -1;
  for (const week of weeks) {
    const candidate = await readNewsWeeklySnapshot(week);
    if (!candidate) continue;
    if (!snapshotContainsDisplayWeekEvents(candidate, displayWeekOpenUtc)) continue;
    const actualCount = countActualValues(candidate);
    if (actualCount > bestActual) {
      best = candidate;
      bestActual = actualCount;
    }
  }
  return best;
}

export async function GET() {
  try {
    const displayWeekOpenUtc = getDisplayWeekOpenUtc();
    let snapshot = await readNewsWeeklySnapshot();
    if (
      snapshot &&
      snapshot.week_open_utc !== displayWeekOpenUtc &&
      snapshotContainsDisplayWeekEvents(snapshot, displayWeekOpenUtc)
    ) {
      await writeNewsWeeklySnapshot({
        week_open_utc: displayWeekOpenUtc,
        source: snapshot.source,
        announcements: snapshot.announcements,
        calendar: snapshot.calendar,
      });
      snapshot = await readNewsWeeklySnapshot(displayWeekOpenUtc);
    }
    if (!snapshot || shouldRefreshSnapshot(snapshot, displayWeekOpenUtc)) {
      await refreshNewsSnapshot();
      snapshot = await readNewsWeeklySnapshot();
    }
    if (
      snapshot &&
      snapshot.week_open_utc === displayWeekOpenUtc &&
      shouldRefreshForPendingActuals(snapshot)
    ) {
      await refreshNewsSnapshot();
      snapshot = await readNewsWeeklySnapshot(displayWeekOpenUtc);
    }
    if (snapshot && snapshot.week_open_utc === displayWeekOpenUtc && countActualValues(snapshot) === 0) {
      const bestSnapshot = await findBestSnapshotForDisplayWeek(displayWeekOpenUtc);
      if (bestSnapshot && countActualValues(bestSnapshot) > 0) {
        await writeNewsWeeklySnapshot({
          week_open_utc: displayWeekOpenUtc,
          source: bestSnapshot.source,
          announcements: bestSnapshot.announcements,
          calendar: bestSnapshot.calendar,
        });
        snapshot = await readNewsWeeklySnapshot(displayWeekOpenUtc);
      }
    }
    return NextResponse.json(
      snapshot ?? {
        week_open_utc: null,
        source: "forexfactory",
        announcements: [],
        calendar: [],
        fetched_at: null,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
