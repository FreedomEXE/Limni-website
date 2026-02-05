import { DateTime } from "luxon";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import { listNewsWeeks, readNewsWeeklySnapshot } from "@/lib/news/store";
import { refreshNewsSnapshot } from "@/lib/news/refresh";
import type { NewsEvent } from "@/lib/news/types";

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

function formatEventMoment(event: NewsEvent) {
  if (event.datetime_utc) {
    return formatDateTimeET(event.datetime_utc);
  }
  if (event.date) {
    const asIso = DateTime.fromFormat(event.date, "MM-dd-yyyy", {
      zone: "America/New_York",
    });
    if (asIso.isValid) {
      return `${formatDateET(asIso.toUTC().toISO())} ${event.time}`;
    }
  }
  return `${event.date} ${event.time}`.trim();
}

export default async function NewsPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const weekParam = pickParam(params?.week);

  let weeks = await listNewsWeeks(52);
  if (weeks.length === 0) {
    await refreshNewsSnapshot();
    weeks = await listNewsWeeks(52);
  }

  const selectedWeek =
    weekParam && weeks.includes(weekParam) ? weekParam : (weeks[0] ?? null);
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
              <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Week
              </label>
              <select
                name="week"
                defaultValue={selectedWeek ?? undefined}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
              >
                {weeks.map((week) => (
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

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Announcements</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Recent major macro events likely to move markets.
          </p>
          <div className="mt-4 space-y-3">
            {announcements.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">No announcements for this week.</p>
            ) : (
              announcements.map((event, index) => (
                <article
                  key={`${event.title}-${event.datetime_utc ?? event.date}-${index}`}
                  className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--panel-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {event.impact}
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">
                      {event.country}
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">
                      {formatEventMoment(event)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-[var(--foreground)]">{event.title}</h3>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Economic Calendar</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Full week event list from ForexFactory.
          </p>
          <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border border-[var(--panel-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--panel)]/90 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">Impact</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2 text-right">Forecast</th>
                  <th className="px-3 py-2 text-right">Previous</th>
                </tr>
              </thead>
              <tbody>
                {calendar.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-[color:var(--muted)]" colSpan={6}>
                      No calendar events found for this week.
                    </td>
                  </tr>
                ) : (
                  calendar.map((event, index) => (
                    <tr
                      key={`${event.title}-${event.datetime_utc ?? event.date}-${index}`}
                      className="border-t border-[var(--panel-border)]/60"
                    >
                      <td className="px-3 py-2">{formatEventMoment(event)}</td>
                      <td className="px-3 py-2">{event.country}</td>
                      <td className="px-3 py-2">{event.impact}</td>
                      <td className="px-3 py-2">{event.title}</td>
                      <td className="px-3 py-2 text-right">{event.forecast ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{event.previous ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
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
