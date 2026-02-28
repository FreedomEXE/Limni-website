import { DateTime } from "luxon";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDateTimeET } from "@/lib/time";
import {
  listNewsWeeks,
  readNewsWeeklySnapshot,
  writeNewsWeeklySnapshot,
} from "@/lib/news/store";
import { refreshNewsSnapshot, shouldRefreshForPendingActuals } from "@/lib/news/refresh";
import NewsContentTabs from "@/components/news/NewsContentTabs";
import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";
import { buildNormalizedWeekOptions, resolveWeekSelection } from "@/lib/weekOptions";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import type { NewsEvent, NewsWeeklySnapshot } from "@/lib/news/types";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";

export const revalidate = 60;
export const dynamic = "force-dynamic";
const MAX_NEWS_WEEKS = 52;
const NEWS_PAGE_CACHE_TTL_MS = Number(process.env.NEWS_PAGE_CACHE_TTL_MS ?? "30000");

function getNewsPageCacheTtlMs() {
  return Number.isFinite(NEWS_PAGE_CACHE_TTL_MS) && NEWS_PAGE_CACHE_TTL_MS >= 0
    ? Math.floor(NEWS_PAGE_CACHE_TTL_MS)
    : 30000;
}

type PageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
  for (const event of events) {
    const ms = eventMs(event);
    if (ms !== null && ms >= startMs && ms < endMs) {
      return true;
    }
  }
  return false;
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

function isWeekSnapshotUsable(snapshot: NewsWeeklySnapshot, weekOpenUtc: string, currentWeekOpenUtc: string) {
  if (!hasEventsForWeek(snapshot.calendar, weekOpenUtc)) {
    return false;
  }
  const stats = getWeekWindowStats(snapshot.calendar, weekOpenUtc);
  const eventsInWeek = stats.inWeek;
  const distinctDays = countDistinctEventDaysInWeek(snapshot.calendar, weekOpenUtc);
  const hasForwardSpill = stats.afterWeek > 0;

  // Hide low-quality historical snapshots (partial or malformed weeks).
  if (weekOpenUtc !== currentWeekOpenUtc) {
    return eventsInWeek >= 30 && distinctDays >= 3 && !hasForwardSpill;
  }
  // Current display week can still be in-progress.
  return eventsInWeek > 0 && distinctDays >= 1 && !hasForwardSpill;
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
  let count = 0;
  for (const event of events) {
    if (typeof event.actual === "string" && event.actual.trim().length > 0) {
      count++;
    }
  }
  return count;
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
  const validWeeks: string[] = [];
  const snapshots = await Promise.all(
    weeks.map(async (week) => ({
      week,
      snapshot: await readNewsWeeklySnapshot(week),
    })),
  );
  const rewriteTasks: Array<Promise<void>> = [];

  for (const entry of snapshots) {
    const week = entry.week;
    const snapshot = entry.snapshot;
    if (!snapshot) continue;
    if (isWeekSnapshotUsable(snapshot, week, currentWeekOpenUtc)) {
      validWeeks.push(week);
      continue;
    }
    const inferredWeek = inferWeekFromEvents(snapshot.calendar);
    if (inferredWeek && inferredWeek !== week) {
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
  const refreshedValid: string[] = [];
  for (const entry of refreshedSnapshots) {
    const week = entry.week;
    const snapshot = entry.snapshot;
    if (!snapshot) continue;
    if (isWeekSnapshotUsable(snapshot, week, currentWeekOpenUtc)) {
      refreshedValid.push(week);
    }
  }
  return refreshedValid;
}

async function getNormalizedNewsWeeksCached(
  weeks: string[],
  currentWeekOpenUtc: string,
) {
  const key = `newsPage:normalizedWeeks:${currentWeekOpenUtc}:${weeks.join(",")}`;
  return getOrSetRuntimeCache(
    key,
    getNewsPageCacheTtlMs(),
    () => normalizeNewsWeekKeys(weeks, currentWeekOpenUtc),
  );
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const weekParam = pickParam(params?.week);
  const viewParam = pickParam(params?.view);
  const view =
    viewParam === "announcements" || viewParam === "impact" ? viewParam : "calendar";

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  let newsWeeks = await listNewsWeeks(MAX_NEWS_WEEKS);
  if (newsWeeks.length === 0 || !newsWeeks.includes(currentWeekOpenUtc)) {
    await refreshNewsSnapshot();
    newsWeeks = await listNewsWeeks(MAX_NEWS_WEEKS);
  }
  newsWeeks = await getNormalizedNewsWeeksCached(newsWeeks, currentWeekOpenUtc);

  // Show only weeks that actually have news data.
  const weekOptions = buildNormalizedWeekOptions({
    historicalWeeks: newsWeeks,
    currentWeekOpenUtc,
    includeAll: false,
    includeCurrent: false,
    includeFuture: true,
    currentPosition: "sorted",
    limit: MAX_NEWS_WEEKS,
  }).filter((item): item is string => item !== "all");
  let selectedWeek = weekOptions.length
    ? ((resolveWeekSelection({
        requestedWeek: weekParam,
        weekOptions,
        currentWeekOpenUtc,
      allowAll: false,
      }) as string | null) ?? null)
    : null;
  let snapshot: NewsWeeklySnapshot | null = selectedWeek
    ? await readNewsWeeklySnapshot(selectedWeek)
    : null;
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
  if (!snapshot && selectedWeek && selectedWeek === currentWeekOpenUtc) {
    await refreshNewsSnapshot();
    snapshot = await readNewsWeeklySnapshot(selectedWeek);
  }
  if (
    snapshot &&
    selectedWeek &&
    selectedWeek === currentWeekOpenUtc &&
    shouldRefreshForPendingActuals(snapshot)
  ) {
    await refreshNewsSnapshot();
    snapshot = await readNewsWeeklySnapshot(selectedWeek);
  }
  if (
    snapshot &&
    selectedWeek &&
    selectedWeek === currentWeekOpenUtc &&
    countActualValues(snapshot.calendar) === 0
  ) {
    const bestSnapshot = await findBestSnapshotForDisplayWeek(currentWeekOpenUtc);
    if (bestSnapshot && countActualValues(bestSnapshot.calendar) > 0) {
      await writeNewsWeeklySnapshot({
        week_open_utc: currentWeekOpenUtc,
        source: bestSnapshot.source,
        announcements: bestSnapshot.announcements,
        calendar: bestSnapshot.calendar,
      });
      snapshot = await readNewsWeeklySnapshot(currentWeekOpenUtc);
    }
  }

  const announcements = snapshot?.announcements ?? [];
  const calendar = snapshot?.calendar ?? [];
  const highImpactCount = calendar.filter((event) => event.impact === "High").length;
  const mediumImpactCount = calendar.filter((event) => event.impact === "Medium").length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">News</h1>
          <p className="text-sm text-[color:var(--muted)]">
            ForexFactory macro events with weekly snapshots for historical review.
          </p>
        </header>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {weekOptions.length > 0 ? (
              <ScrollableWeekStrip
                options={weekOptions}
                selected={selectedWeek ?? weekOptions[0] ?? ""}
                currentWeek={currentWeekOpenUtc}
                label="Week"
                paramName="week"
                preserveParams={["view"]}
              />
            ) : (
              <span className="text-xs text-[color:var(--muted)]">No weeks with news data yet.</span>
            )}
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {snapshot ? `Last refresh ${formatDateTimeET(snapshot.fetched_at)}` : "No snapshot yet"}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Metric label="Announcements" value={String(announcements.length)} />
            <Metric label="Calendar events" value={String(calendar.length)} />
            <Metric label="High impact" value={String(highImpactCount)} tone="negative" />
            <Metric label="Medium impact" value={String(mediumImpactCount)} tone="neutral" />
          </div>
        </section>
        <NewsContentTabs
          key={`${selectedWeek ?? "none"}:${view}:${snapshot?.fetched_at ?? "none"}`}
          view={view}
          announcements={announcements}
          calendar={calendar}
        />
      </div>
    </DashboardLayout>
  );
}

function Metric({
  label,
  value,
  tone = "positive",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "negative"
            ? "text-rose-600 dark:text-rose-300"
            : tone === "neutral"
              ? "text-[var(--foreground)]"
              : "text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
