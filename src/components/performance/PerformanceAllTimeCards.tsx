"use client";

import { useState } from "react";
import InfoModal from "@/components/InfoModal";
import type { PerformanceModel } from "@/lib/performanceLab";

type AllTimeStat = {
  model: PerformanceModel;
  totalPercent: number;
  weeks: number;
  winRate: number;
  avgWeekly: number;
  label: string;
};

type PerformanceAllTimeCardsProps = {
  stats: AllTimeStat[];
};

export default function PerformanceAllTimeCards({ stats }: PerformanceAllTimeCardsProps) {
  const [active, setActive] = useState<AllTimeStat | null>(null);

  return (
    <>
      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            All-time performance
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            Aggregated weekly totals across all tracked snapshots.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <button
              key={`alltime-${stat.model}`}
              type="button"
              onClick={() => setActive(stat)}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4 text-left"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {stat.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                View
              </p>
            </button>
          ))}
        </div>
      </section>

      {active ? (
        <InfoModal title={active.label} onClose={() => setActive(null)}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span className="font-semibold text-[var(--foreground)]">
                {active.totalPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Weeks tracked</span>
              <span className="font-semibold text-[var(--foreground)]">
                {active.weeks}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Win rate</span>
              <span className="font-semibold text-[var(--foreground)]">
                {active.winRate.toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Avg weekly</span>
              <span className="font-semibold text-[var(--foreground)]">
                {active.avgWeekly.toFixed(2)}%
              </span>
            </div>
          </div>
        </InfoModal>
      ) : null}
    </>
  );
}
