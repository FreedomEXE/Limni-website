"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeET } from "@/lib/time";
import type { NewsPayload } from "@/lib/news/newsPayload";
import {
  seedNewsPayload,
  useNewsSession,
} from "@/lib/news/newsSessionStore";
import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";
import NewsContentTabs from "@/components/news/NewsContentTabs";

type NewsPageClientProps = {
  initialPayload: NewsPayload;
};

export default function NewsPageClient({ initialPayload }: NewsPageClientProps) {
  const store = useNewsSession();
  const payload = store.payload ?? initialPayload;
  const [selectedWeek, setSelectedWeek] = useState<string | null>(
    initialPayload.selectedWeek,
  );
  const activeWeek = selectedWeek && payload.weekOptions.includes(selectedWeek)
    ? selectedWeek
    : payload.selectedWeek ?? payload.weekOptions[0] ?? null;

  useEffect(() => {
    seedNewsPayload(initialPayload);
  }, [initialPayload]);

  useEffect(() => {
    if (!activeWeek) return;
    const url = new URL(window.location.href);
    url.searchParams.set("week", activeWeek);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [activeWeek]);

  const snapshot = activeWeek ? payload.snapshotsByWeek[activeWeek] ?? null : null;
  const announcements = useMemo(() => snapshot?.announcements ?? [], [snapshot]);
  const calendar = useMemo(() => snapshot?.calendar ?? [], [snapshot]);
  const highImpactCount = useMemo(
    () => calendar.filter((event) => event.impact === "High").length,
    [calendar],
  );
  const mediumImpactCount = useMemo(
    () => calendar.filter((event) => event.impact === "Medium").length,
    [calendar],
  );

  const errorMessage = payload.loadError || store.error;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">News</h1>
        <p className="text-sm text-[color:var(--muted)]">
          ForexFactory macro events with weekly snapshots for historical review.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
          News data is temporarily unavailable in this environment. Existing snapshots will appear automatically once the runtime can reach the news store again.
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {payload.weekOptions.length > 0 && activeWeek ? (
            <ScrollableWeekStrip
              options={payload.weekOptions}
              selected={activeWeek}
              currentWeek={payload.currentWeekOpenUtc}
              label="Week"
              paramName="week"
              onChange={(week) => {
                if (week !== "all") setSelectedWeek(week);
              }}
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

      {!snapshot && activeWeek ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
          No news snapshot is available for the selected week.
        </div>
      ) : null}

      <NewsContentTabs
        key={`${activeWeek ?? "none"}:${snapshot?.fetched_at ?? "none"}`}
        announcements={announcements}
        calendar={calendar}
      />
    </div>
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
