import { DateTime } from "luxon";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDateTimeET } from "@/lib/time";
import {
  listNewsWeeks,
  readNewsWeeklySnapshot,
  writeNewsWeeklySnapshot,
} from "@/lib/news/store";
import { refreshNewsSnapshot } from "@/lib/news/refresh";
import NewsContentTabs from "@/components/news/NewsContentTabs";
import { buildNormalizedWeekOptions, resolveWeekSelection } from "@/lib/weekOptions";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import type { NewsEvent, NewsWeeklySnapshot } from "@/lib/news/types";

export const revalidate = 300;

type PageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function weekLabel(weekOpenUtc: string) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  if (!parsed.isValid) return weekOpenUtc;
  const monday = parsed.weekday === 7 ? parsed.plus({ days: 1 }).startOf("day") : parsed.startOf("day");
  return `Week of ${monday.toFormat("MMM dd, yyyy")}`;
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

function inferWeekFromEvents(events: NewsEvent[]) {
  let firstMs: number | null = null;
  for (const event of events) {
    const ms = eventMs(event);
    if (ms === null) continue;
    if (firstMs === null || ms < firstMs) firstMs = ms;
  }
  if (firstMs === null) return null;
  const firstEventTime = DateTime.fromMillis(firstMs, { zone: "utc" });
  if (!firstEventTime.isValid) return null;
  return getDisplayWeekOpenUtc(firstEventTime as DateTime<true>);
}

async function normalizeNewsWeekKeys(weeks: string[]) {
  const validWeeks: string[] = [];
  let wroteAny = false;

  for (const week of weeks) {
    const snapshot = await readNewsWeeklySnapshot(week);
    if (!snapshot) continue;
    if (hasEventsForWeek(snapshot.calendar, week)) {
      validWeeks.push(week);
      continue;
    }
    const inferredWeek = inferWeekFromEvents(snapshot.calendar);
    if (inferredWeek && inferredWeek !== week) {
      await writeNewsWeeklySnapshot({
        week_open_utc: inferredWeek,
        source: snapshot.source,
        announcements: snapshot.announcements,
        calendar: snapshot.calendar,
      });
      wroteAny = true;
    }
  }

  if (!wroteAny) {
    return validWeeks;
  }

  const refreshedWeeks = await listNewsWeeks(520);
  const refreshedValid: string[] = [];
  for (const week of refreshedWeeks) {
    const snapshot = await readNewsWeeklySnapshot(week);
    if (!snapshot) continue;
    if (hasEventsForWeek(snapshot.calendar, week)) {
      refreshedValid.push(week);
    }
  }
  return refreshedValid;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const weekParam = pickParam(params?.week);
  const viewParam = pickParam(params?.view);
  const view =
    viewParam === "announcements" || viewParam === "impact" ? viewParam : "calendar";

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  let newsWeeks = await listNewsWeeks(520);
  if (newsWeeks.length === 0 || !newsWeeks.includes(currentWeekOpenUtc)) {
    await refreshNewsSnapshot();
    newsWeeks = await listNewsWeeks(520);
  }
  newsWeeks = await normalizeNewsWeekKeys(newsWeeks);

  // Show only weeks that actually have news data.
  const weekOptions = buildNormalizedWeekOptions({
    historicalWeeks: newsWeeks,
    currentWeekOpenUtc,
    includeAll: false,
    includeCurrent: false,
    includeFuture: true,
    currentPosition: "sorted",
    limit: 520,
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
            <form action="/news" method="get" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="view" value={view} />
              <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Week
              </label>
              {weekOptions.length > 0 ? (
                <>
                  <select
                    name="week"
                    defaultValue={selectedWeek ?? undefined}
                    className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
                  >
                    {weekOptions.map((week) => (
                      <option key={week} value={week}>
                        {weekLabel(week)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
                  >
                    View
                  </button>
                </>
              ) : (
                <span className="text-xs text-[color:var(--muted)]">No weeks with news data yet.</span>
              )}
            </form>
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
          selectedWeek={selectedWeek}
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
