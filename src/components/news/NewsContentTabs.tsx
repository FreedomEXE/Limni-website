"use client";

import { useMemo } from "react";
import type { NewsEvent } from "@/lib/news/types";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import { DateTime } from "luxon";

type NewsContentTabsProps = {
  selectedWeek: string | null;
  view: "announcements" | "calendar" | "impact";
  announcements: NewsEvent[];
  calendar: NewsEvent[];
};

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

function resolveEventDate(event: NewsEvent) {
  if (event.datetime_utc) {
    const parsed = DateTime.fromISO(event.datetime_utc, { zone: "utc" });
    return parsed.isValid ? parsed.setZone("America/New_York") : null;
  }
  if (event.date) {
    const parsed = DateTime.fromFormat(event.date, "MM-dd-yyyy", {
      zone: "America/New_York",
    });
    return parsed.isValid ? parsed : null;
  }
  return null;
}

function formatEventTime(event: NewsEvent, date: DateTime | null) {
  if (date && event.datetime_utc) {
    return date.toFormat("h:mm a");
  }
  return event.time || "—";
}

function impactTone(impact: NewsEvent["impact"]) {
  if (impact === "High") return "bg-rose-100 text-rose-700";
  if (impact === "Medium") return "bg-amber-100 text-amber-700";
  if (impact === "Low") return "bg-emerald-100 text-emerald-700";
  if (impact === "Holiday") return "bg-slate-200 text-slate-600";
  return "bg-[var(--panel-border)]/60 text-[color:var(--muted)]";
}

export default function NewsContentTabs({
  selectedWeek,
  view,
  announcements,
  calendar,
}: NewsContentTabsProps) {
  const filteredCalendar = useMemo(() => {
    if (view !== "impact") return calendar;
    return calendar.filter((event) => event.impact === "High" || event.impact === "Medium");
  }, [calendar, view]);

  const groupedCalendar = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; ts: number; events: NewsEvent[] }
    >();
    for (const event of filteredCalendar) {
      const date = resolveEventDate(event);
      const key = date ? date.toFormat("yyyy-LL-dd") : event.date || "unknown";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: date ? date.toFormat("cccc, MMM dd") : event.date || "Unknown date",
          ts: date ? date.toMillis() : Number.MAX_SAFE_INTEGER,
          events: [],
        });
      }
      groups.get(key)!.events.push(event);
    }
    return Array.from(groups.values()).sort((a, b) => a.ts - b.ts);
  }, [filteredCalendar]);

  return (
    <>
      {view === "announcements" ? (
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
      ) : (
        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {view === "impact" ? "High Impact Calendar" : "Economic Calendar"}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Full week event list from ForexFactory.
          </p>
          <div className="mt-4 max-h-[72vh] overflow-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70">
            {filteredCalendar.length === 0 ? (
              <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
                No calendar events found for this week.
              </div>
            ) : (
              <div className="divide-y divide-[var(--panel-border)]">
                {groupedCalendar.map((group) => (
                  <div key={group.key} className="bg-[var(--panel)]/40">
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--panel-border)] bg-[var(--panel)]/95 px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          {group.label}
                        </p>
                        <p className="text-sm text-[var(--foreground)]">
                          {group.events.length} event{group.events.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="hidden text-xs uppercase tracking-[0.2em] text-[color:var(--muted)] md:flex md:items-center md:gap-6">
                        <span className="w-20 text-left">Time</span>
                        <span className="w-20 text-left">Country</span>
                        <span className="w-20 text-left">Impact</span>
                        <span className="w-40 text-right">Actual</span>
                        <span className="w-40 text-right">Forecast</span>
                        <span className="w-40 text-right">Previous</span>
                      </div>
                    </div>
                    <div className="divide-y divide-[var(--panel-border)]">
                      {group.events.map((event, index) => {
                        const date = resolveEventDate(event);
                        return (
                          <div
                            key={`${event.title}-${event.datetime_utc ?? event.date}-${index}`}
                            className="grid gap-2 px-4 py-3 md:grid-cols-[90px_90px_110px_1fr_140px_140px_140px] md:items-center"
                          >
                            <div className="text-xs font-semibold text-[var(--foreground)]">
                              {formatEventTime(event, date)}
                            </div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                              {event.country}
                            </div>
                            <div>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${impactTone(
                                  event.impact,
                                )}`}
                              >
                                {event.impact}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[var(--foreground)]">
                                {event.title}
                              </p>
                              {event.datetime_utc ? (
                                <p className="mt-1 text-xs text-[color:var(--muted)]">
                                  {formatEventMoment(event)}
                                </p>
                              ) : null}
                            </div>
                            <div className="text-right text-xs font-semibold text-[var(--foreground)]">
                              <span className="md:hidden text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                                Actual{" "}
                              </span>
                              {event.actual ?? "—"}
                            </div>
                            <div className="text-right text-xs text-[var(--foreground)]">
                              <span className="md:hidden text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                                Forecast{" "}
                              </span>
                              {event.forecast ?? "—"}
                            </div>
                            <div className="text-right text-xs text-[var(--foreground)]">
                              <span className="md:hidden text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                                Previous{" "}
                              </span>
                              {event.previous ?? "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
