import { DateTime } from "luxon";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildNormalizedWeekOptions, resolveWeekSelection } from "@/lib/weekOptions";
import {
  listNewsWeeks,
  readNewsWeeklySnapshot,
  writeNewsWeeklySnapshot,
} from "@/lib/news/store";
import { refreshNewsSnapshot, shouldRefreshForPendingActuals } from "@/lib/news/refresh";
import type { NewsEvent, NewsWeeklySnapshot } from "@/lib/news/types";
import type { NewsPayload } from "@/lib/news/newsPayload";

const MAX_NEWS_WEEKS = 52;
const NEWS_PAGE_CACHE_TTL_MS = Number(process.env.NEWS_PAGE_CACHE_TTL_MS ?? "30000");

function getNewsPageCacheTtlMs() {
  return Number.isFinite(NEWS_PAGE_CACHE_TTL_MS) && NEWS_PAGE_CACHE_TTL_MS >= 0
    ? Math.floor(NEWS_PAGE_CACHE_TTL_MS)
    : 30000;
}

function eventMs(event: NewsEvent) {
  if (!event.datetime_utc) return null;
  const ms = Date.parse(event.datetime_utc);
  return Number.isFinite(ms) ? ms : null;
}

function hasEventsForWeek(events: NewsEvent[], weekOpenUtc: string) {
  const startMs = Date.parse(weekOpenUtc);
  if (!Number.isFinite(startMs)) return false;
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  return events.some((event) => {
    const ms = eventMs(event);
    return ms !== null && ms >= startMs && ms < endMs;
  });
}

function getWeekWindowStats(events: NewsEvent[], weekOpenUtc: string) {
  const startMs = Date.parse(weekOpenUtc);
  if (!Number.isFinite(startMs)) {
    return { inWeek: 0, beforeWeek: 0, afterWeek: 0 };
  }
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  let inWeek = 0;
  let beforeWeek = 0;
  let afterWeek = 0;
  for (const event of events) {
    const ms = eventMs(event);
    if (ms === null) continue;
    if (ms < startMs) beforeWeek++;
    else if (ms >= endMs) afterWeek++;
    else inWeek++;
  }
  return { inWeek, beforeWeek, afterWeek };
}

function countDistinctEventDaysInWeek(events: NewsEvent[], weekOpenUtc: string) {
  const startMs = Date.parse(weekOpenUtc);
  if (!Number.isFinite(startMs)) return 0;
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  const days = new Set<string>();
  for (const event of events) {
    const ms = eventMs(event);
    if (ms === null || ms < startMs || ms >= endMs) continue;
    const dayKey = DateTime.fromMillis(ms, { zone: "utc" }).toISODate();
    if (dayKey) days.add(dayKey);
  }
  return days.size;
}

function isWeekSnapshotUsable(
  snapshot: NewsWeeklySnapshot,
  weekOpenUtc: string,
  currentWeekOpenUtc: string,
) {
  if (!hasEventsForWeek(snapshot.calendar, weekOpenUtc)) {
    return false;
  }
  const stats = getWeekWindowStats(snapshot.calendar, weekOpenUtc);
  const distinctDays = countDistinctEventDaysInWeek(snapshot.calendar, weekOpenUtc);
  const hasForwardSpill = stats.afterWeek > 0;

  if (weekOpenUtc !== currentWeekOpenUtc) {
    return stats.inWeek >= 30 && distinctDays >= 3 && !hasForwardSpill;
  }
  return stats.inWeek > 0 && distinctDays >= 1 && !hasForwardSpill;
}

function inferWeekFromEvents(events: NewsEvent[]) {
  const weekVotes = new Map<string, number>();
  let fallbackWeek: string | null = null;
  for (const event of events) {
    const ms = eventMs(event);
    if (ms === null) continue;
    const eventTime = DateTime.fromMillis(ms, { zone: "utc" });
    if (!eventTime.isValid) continue;
    const voteWeek = getDisplayWeekOpenUtc(eventTime as DateTime<true>);
    if (!fallbackWeek) fallbackWeek = voteWeek;
    weekVotes.set(voteWeek, (weekVotes.get(voteWeek) ?? 0) + 1);
  }
  if (weekVotes.size === 0) return null;
  let bestWeek = fallbackWeek;
  let bestVotes = -1;
  for (const [week, votes] of weekVotes.entries()) {
    if (votes > bestVotes) {
      bestVotes = votes;
      bestWeek = week;
    }
  }
  return bestWeek;
}

function countActualValues(events: NewsEvent[]) {
  return events.filter((event) => typeof event.actual === "string" && event.actual.trim().length > 0).length;
}

async function findBestSnapshotForDisplayWeek(displayWeekOpenUtc: string) {
  const weeks = await listNewsWeeks(MAX_NEWS_WEEKS);
  const entries = await Promise.all(
    weeks.map(async (week) => ({
      week,
      snapshot: await readNewsWeeklySnapshot(week),
    })),
  );
  let best: NewsWeeklySnapshot | null = null;
  let bestActual = -1;
  for (const entry of entries) {
    const candidate = entry.snapshot;
    if (!candidate) continue;
    if (!hasEventsForWeek(candidate.calendar, displayWeekOpenUtc)) continue;
    const actualCount = countActualValues(candidate.calendar);
    if (actualCount > bestActual) {
      best = candidate;
      bestActual = actualCount;
    }
  }
  return best;
}

async function normalizeNewsWeekKeys(weeks: string[], currentWeekOpenUtc: string) {
  const snapshots = await Promise.all(
    weeks.map(async (week) => ({
      week,
      snapshot: await readNewsWeeklySnapshot(week),
    })),
  );
  const validWeeks: string[] = [];
  const rewriteTasks: Array<Promise<void>> = [];

  for (const entry of snapshots) {
    const snapshot = entry.snapshot;
    if (!snapshot) continue;
    if (isWeekSnapshotUsable(snapshot, entry.week, currentWeekOpenUtc)) {
      validWeeks.push(entry.week);
      continue;
    }
    const inferredWeek = inferWeekFromEvents(snapshot.calendar);
    if (inferredWeek && inferredWeek !== entry.week) {
      rewriteTasks.push(
        writeNewsWeeklySnapshot({
          week_open_utc: inferredWeek,
          source: snapshot.source,
          announcements: snapshot.announcements,
          calendar: snapshot.calendar,
        }),
      );
    }
  }

  if (rewriteTasks.length === 0) {
    return validWeeks;
  }
  await Promise.all(rewriteTasks);

  const refreshedWeeks = await listNewsWeeks(MAX_NEWS_WEEKS);
  const refreshedSnapshots = await Promise.all(
    refreshedWeeks.map(async (week) => ({
      week,
      snapshot: await readNewsWeeklySnapshot(week),
    })),
  );
  return refreshedSnapshots
    .filter((entry) => entry.snapshot && isWeekSnapshotUsable(entry.snapshot, entry.week, currentWeekOpenUtc))
    .map((entry) => entry.week);
}

async function getNormalizedNewsWeeksCached(weeks: string[], currentWeekOpenUtc: string) {
  const key = `newsPage:normalizedWeeks:${currentWeekOpenUtc}:${weeks.join(",")}`;
  return getOrSetRuntimeCache(
    key,
    getNewsPageCacheTtlMs(),
    () => normalizeNewsWeekKeys(weeks, currentWeekOpenUtc),
  );
}

async function loadSnapshotsByWeek(weekOptions: string[]) {
  const entries = await Promise.all(
    weekOptions.map(async (week) => [week, await readNewsWeeklySnapshot(week)] as const),
  );
  return Object.fromEntries(entries) as Record<string, NewsWeeklySnapshot | null>;
}

export async function loadNewsPayload(requestedWeek?: string | null): Promise<NewsPayload> {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  let weekOptions: string[] = [];
  let selectedWeek: string | null = null;
  let loadError: string | null = null;

  try {
    let newsWeeks = await listNewsWeeks(MAX_NEWS_WEEKS);
    if (newsWeeks.length === 0 || !newsWeeks.includes(currentWeekOpenUtc)) {
      try {
        await refreshNewsSnapshot();
        newsWeeks = await listNewsWeeks(MAX_NEWS_WEEKS);
      } catch (refreshError) {
        console.warn(
          "News refresh unavailable during payload load:",
          refreshError instanceof Error ? refreshError.message : String(refreshError),
        );
      }
    }

    newsWeeks = await getNormalizedNewsWeeksCached(newsWeeks, currentWeekOpenUtc);
    weekOptions = buildNormalizedWeekOptions({
      historicalWeeks: newsWeeks,
      currentWeekOpenUtc,
      includeAll: false,
      includeCurrent: false,
      includeFuture: true,
      currentPosition: "sorted",
      limit: MAX_NEWS_WEEKS,
    }).filter((item): item is string => item !== "all");

    selectedWeek = weekOptions.length
      ? ((resolveWeekSelection({
          requestedWeek,
          weekOptions,
          currentWeekOpenUtc,
          allowAll: false,
        }) as string | null) ?? null)
      : null;

    let snapshot = selectedWeek ? await readNewsWeeklySnapshot(selectedWeek) : null;

    if (snapshot && selectedWeek && !hasEventsForWeek(snapshot.calendar, selectedWeek)) {
      const inferredWeek = inferWeekFromEvents(snapshot.calendar);
      if (inferredWeek) {
        await writeNewsWeeklySnapshot({
          week_open_utc: inferredWeek,
          source: snapshot.source,
          announcements: snapshot.announcements,
          calendar: snapshot.calendar,
        });
        selectedWeek = inferredWeek;
        snapshot = await readNewsWeeklySnapshot(selectedWeek);
      }
    }

    if (!snapshot && selectedWeek === currentWeekOpenUtc) {
      try {
        await refreshNewsSnapshot();
        snapshot = await readNewsWeeklySnapshot(selectedWeek);
      } catch (refreshError) {
        console.warn(
          "Current-week news refresh unavailable during payload load:",
          refreshError instanceof Error ? refreshError.message : String(refreshError),
        );
      }
    }

    if (
      snapshot &&
      selectedWeek === currentWeekOpenUtc &&
      shouldRefreshForPendingActuals(snapshot)
    ) {
      try {
        await refreshNewsSnapshot();
        snapshot = await readNewsWeeklySnapshot(selectedWeek);
      } catch (refreshError) {
        console.warn(
          "Pending-actual news refresh unavailable during payload load:",
          refreshError instanceof Error ? refreshError.message : String(refreshError),
        );
      }
    }

    if (snapshot && selectedWeek === currentWeekOpenUtc && countActualValues(snapshot.calendar) === 0) {
      const bestSnapshot = await findBestSnapshotForDisplayWeek(currentWeekOpenUtc);
      if (bestSnapshot && countActualValues(bestSnapshot.calendar) > 0) {
        await writeNewsWeeklySnapshot({
          week_open_utc: currentWeekOpenUtc,
          source: bestSnapshot.source,
          announcements: bestSnapshot.announcements,
          calendar: bestSnapshot.calendar,
        });
      }
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
    console.warn("News payload fallback activated:", loadError);
  }

  let snapshotsByWeek: Record<string, NewsWeeklySnapshot | null> = {};
  try {
    snapshotsByWeek = weekOptions.length > 0 ? await loadSnapshotsByWeek(weekOptions) : {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loadError = loadError ? `${loadError}; ${message}` : message;
    console.warn("News snapshots fallback activated:", message);
  }

  return {
    currentWeekOpenUtc,
    weekOptions,
    selectedWeek,
    snapshotsByWeek,
    loadError,
    fetchedAtUtc: new Date().toISOString(),
  };
}
