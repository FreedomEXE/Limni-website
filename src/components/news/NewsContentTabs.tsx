/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: NewsContentTabs.tsx
 *
 * Description:
 * Unified News timeline with top announcements, high-impact focus, and current-day-first calendar grouping.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useMemo, useState } from "react";
import type { NewsEvent } from "@/lib/news/types";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import { DateTime } from "luxon";

const NEWS_TIME_ZONE = "America/Toronto";

type NewsContentTabsProps = {
  announcements: NewsEvent[];
  calendar: NewsEvent[];
};

function formatEventMoment(event: NewsEvent) {
  if (event.datetime_utc) {
    return formatDateTimeET(event.datetime_utc);
  }
  if (event.date) {
    const asIso = DateTime.fromFormat(event.date, "MM-dd-yyyy", {
      zone: NEWS_TIME_ZONE,
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
    return parsed.isValid ? parsed.setZone(NEWS_TIME_ZONE) : null;
  }
  if (event.date) {
    const parsed = DateTime.fromFormat(event.date, "MM-dd-yyyy", {
      zone: NEWS_TIME_ZONE,
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
  if (impact === "High") return "bg-rose-100 dark:bg-rose-900/20 text-rose-700";
  if (impact === "Medium") return "bg-amber-100 text-amber-700";
  if (impact === "Low") return "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700";
  if (impact === "Holiday") return "bg-slate-200 text-slate-600";
  return "bg-[var(--panel-border)]/60 text-[color:var(--muted)]";
}

export default function NewsContentTabs({
  announcements,
  calendar,
}: NewsContentTabsProps) {
  const groupedCalendar = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; ts: number; events: NewsEvent[] }
    >();
    for (const event of calendar) {
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
    return Array.from(groups.values()).sort((a, b) => b.ts - a.ts);
  }, [calendar]);

  const leadingGroupKey = useMemo(() => {
    if (groupedCalendar.length === 0) return null;
    return groupedCalendar[0]?.key ?? null;
  }, [groupedCalendar]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    leadingGroupKey ? new Set([leadingGroupKey]) : new Set(),
  );

  const todayKey = DateTime.now().setZone(NEWS_TIME_ZONE).toFormat("yyyy-LL-dd");
  const highImpactEvents = useMemo(
    () => calendar.filter((event) => event.impact === "High"),
    [calendar],
  );
  const topAnnouncements = useMemo(() => announcements.slice(0, 8), [announcements]);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Top Announcements</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Week-leading macro events and scheduled releases in one feed.
          </p>
          <div className="mt-4 space-y-3">
            {topAnnouncements.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">No announcements for this week.</p>
            ) : (
              topAnnouncements.map((event, index) => (
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
                  <h3 className="mt-2 text-base font-semibold text-[var(--foreground)]">
                    {event.title}
                  </h3>
                </article>
              ))
            )}
          </div>
        </div>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">High Impact Focus</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Immediate priority list for the current week.
          </p>
          <div className="mt-4 space-y-3">
            {highImpactEvents.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">No high-impact events for this week.</p>
            ) : (
              highImpactEvents.slice(0, 6).map((event, index) => (
                <div
                  key={`${event.title}-${event.datetime_utc ?? event.date}-${index}`}
                  className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${impactTone(
                        event.impact,
                      )}`}
                    >
                      {event.impact}
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">
                      {event.country}
                    </span>
                    <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">
                      {formatEventMoment(event)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {event.title}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Economic Calendar</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Unified weekly timeline with current day surfaced first.
        </p>
        <div className="mt-4 max-h-[72vh] overflow-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70">
          {calendar.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
              No calendar events found for this week.
            </div>
          ) : (
            <div className="divide-y divide-[var(--panel-border)]">
              {groupedCalendar.map((group) => {
                const isOpen = openGroups.has(group.key);
                const isCurrentDay = group.key === todayKey;
                const isLeading = group.key === leadingGroupKey;
                return (
                  <div key={group.key} className="bg-[var(--panel)]/40">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className={`w-full border-b border-[var(--panel-border)] px-4 py-3 text-left transition ${
                        isCurrentDay || isLeading ? "bg-emerald-50/60 dark:bg-emerald-900/20" : "bg-[var(--panel)]/95"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            {group.label}
                            {isCurrentDay ? " • Current Day" : isLeading ? " • Latest" : ""}
                          </p>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {group.events.length} event{group.events.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          {isOpen ? "Hide" : "Show"}
                        </span>
                      </div>
                    </button>
                    {isOpen ? (
                      <>
                        <div className="hidden border-b border-[var(--panel-border)] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)] md:grid md:grid-cols-[90px_90px_110px_1fr_140px_140px_140px]">
                          <span className="text-left">Time</span>
                          <span className="text-left">Country</span>
                          <span className="text-left">Impact</span>
                          <span className="text-left">Event</span>
                          <span className="text-right">Actual</span>
                          <span className="text-right">Forecast</span>
                          <span className="text-right">Previous</span>
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
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
