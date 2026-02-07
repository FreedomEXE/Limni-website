import { DateTime } from "luxon";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDateTimeET } from "@/lib/time";
import { listNewsWeeks, readNewsWeeklySnapshot } from "@/lib/news/store";
import { refreshNewsSnapshot } from "@/lib/news/refresh";
import NewsContentTabs from "@/components/news/NewsContentTabs";
import { getNextWeekOpen } from "@/lib/weekState";
import { getWeekOpenUtc } from "@/lib/performanceSnapshots";

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
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "America/New_York" });
  if (!parsed.isValid) return weekOpenUtc;
  return `Week of ${parsed.toFormat("MMM dd, yyyy")}`;
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const weekParam = pickParam(params?.week);
  const viewParam = pickParam(params?.view);
  const view = viewParam === "calendar" ? "calendar" : "announcements";

  let weeks = await listNewsWeeks(52);
  if (weeks.length === 0) {
    await refreshNewsSnapshot();
    weeks = await listNewsWeeks(52);
  }

  const currentWeekOpenUtc = getWeekOpenUtc();
  const nextWeekOpenUtc = getNextWeekOpen(currentWeekOpenUtc);
  const weekOptions = Array.from(
    new Set([nextWeekOpenUtc, currentWeekOpenUtc, ...weeks].filter(Boolean)),
  );
  const selectedWeek =
    weekParam && weekOptions.includes(weekParam)
      ? weekParam
      : weekOptions.includes(nextWeekOpenUtc)
        ? nextWeekOpenUtc
        : weekOptions.includes(currentWeekOpenUtc)
          ? currentWeekOpenUtc
          : weekOptions[0] ?? null;
  const snapshot = selectedWeek ? await readNewsWeeklySnapshot(selectedWeek) : null;

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
          initialView={view}
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
