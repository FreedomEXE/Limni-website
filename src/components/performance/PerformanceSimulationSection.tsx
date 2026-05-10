/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceSimulationSection.tsx
 *
 * Description:
 * Shared simulation surface for Performance using the canonical equity
 * curve series and the same chart language used in Accounts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useMemo, useState } from "react";
import EquityCurveChart from "@/components/research/EquityCurveChart";

export type PerformanceSimulationSeries = {
  id: string;
  label: string;
  color?: string;
  points: Array<{
    ts_utc: string;
    equity_pct: number;
    lock_pct: number | null;
  }>;
};

export type PerformanceSimulationMetrics = {
  returnPct: number | null;
  maxDrawdownPct: number | null;
  trades: number | null;
};

export type PerformanceSimulationGroup = {
  title: string;
  description: string;
  metrics: PerformanceSimulationMetrics;
  series: PerformanceSimulationSeries[];
  seriesGroups?: Array<{
    id: string;
    label: string;
    description: string;
    seriesIds: string[];
  }>;
};

function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

export default function PerformanceSimulationSection({
  group,
}: {
  group: PerformanceSimulationGroup | null;
}) {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const seriesGroups = useMemo(() => group?.seriesGroups ?? [], [group]);
  const activeSeriesGroup = useMemo(() => {
    if (!group || seriesGroups.length === 0) return null;
    return seriesGroups.find((item) => item.id === activeGroupId)
      ?? seriesGroups.find((item) => item.id === "assets")
      ?? seriesGroups[0]
      ?? null;
  }, [activeGroupId, group, seriesGroups]);
  const activeSeries = useMemo(() => {
    if (!group || !activeSeriesGroup) return group?.series ?? [];
    const requested = new Set(activeSeriesGroup.seriesIds);
    return group.series.filter((series) => requested.has(series.id));
  }, [activeSeriesGroup, group]);

  if (!group) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
        No simulation data is available for this selection yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/75 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Simulation
        </div>
        <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
          {group.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          {activeSeriesGroup?.description ?? group.description}
        </p>
        {seriesGroups.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {seriesGroups.map((item) => {
              const active = (activeSeriesGroup?.id ?? "assets") === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveGroupId(item.id)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                      : "border-[var(--panel-border)] text-[color:var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <EquityCurveChart
        title={`${group.title} equity curve`}
        series={activeSeries}
        interactive
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Return
          </div>
          <div data-testid="sim-return" className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {formatSignedPercent(group.metrics.returnPct)}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Max DD
          </div>
          <div data-testid="sim-maxdd" className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {formatPercent(group.metrics.maxDrawdownPct)}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Trades
          </div>
          <div data-testid="sim-trades" className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {group.metrics.trades ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
