import { NextResponse } from "next/server";
import { readNewsWeeklySnapshot } from "@/lib/news/store";
import { refreshNewsSnapshot } from "@/lib/news/refresh";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const revalidate = 300;

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

export async function GET() {
  try {
    const displayWeekOpenUtc = getDisplayWeekOpenUtc();
    let snapshot = await readNewsWeeklySnapshot();
    if (!snapshot || shouldRefreshSnapshot(snapshot, displayWeekOpenUtc)) {
      await refreshNewsSnapshot();
      snapshot = await readNewsWeeklySnapshot();
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
