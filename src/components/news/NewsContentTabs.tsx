"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { NewsEvent } from "@/lib/news/types";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import { DateTime } from "luxon";

type NewsContentTabsProps = {
  selectedWeek: string | null;
  initialView: "announcements" | "calendar";
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

export default function NewsContentTabs({
  selectedWeek,
  initialView,
  announcements,
  calendar,
}: NewsContentTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"announcements" | "calendar">(initialView);

  const week = selectedWeek ?? "";
  const tabHref = useMemo(
    () => ({
      announcements: `${pathname}?week=${encodeURIComponent(week)}&view=announcements`,
      calendar: `${pathname}?week=${encodeURIComponent(week)}&view=calendar`,
    }),
    [pathname, week],
  );

  const switchView = (nextView: "announcements" | "calendar") => {
    if (nextView === view) return;
    setView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    if (week) {
      params.set("week", week);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => switchView("announcements")}
          title={tabHref.announcements}
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
            view === "announcements"
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
              : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]"
          }`}
        >
          Announcements
        </button>
        <button
          type="button"
          onClick={() => switchView("calendar")}
          title={tabHref.calendar}
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
            view === "calendar"
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
              : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]"
          }`}
        >
          Calendar
        </button>
      </div>

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
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Economic Calendar</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Full week event list from ForexFactory.
          </p>
          <div className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-[var(--panel-border)]">
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
      )}
    </>
  );
}
