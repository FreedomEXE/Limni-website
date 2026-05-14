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
    peak_pct?: number;
    drawdown_pct?: number;
    active_positions?: number;
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

function computeMixedSeries(series: PerformanceSimulationSeries[]): PerformanceSimulationSeries {
  const timestamps = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.ts_utc))))
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  const pointMaps = series.map((item) => new Map(item.points.map((point) => [point.ts_utc, point])));
  const lastEquityBySeries = new Array<number>(series.length).fill(0);
  const lastActiveBySeries = new Array<number>(series.length).fill(0);
  let runningPeakPct = 0;
  const points = timestamps.map((tsUtc) => {
    for (let index = 0; index < pointMaps.length; index += 1) {
      const point = pointMaps[index]?.get(tsUtc);
      if (point) {
        lastEquityBySeries[index] = point.equity_pct;
        lastActiveBySeries[index] = point.active_positions ?? 0;
      }
    }
    const equityPct = lastEquityBySeries.reduce((sum, value) => sum + value, 0);
    const activePositions = lastActiveBySeries.reduce((sum, value) => sum + value, 0);
    runningPeakPct = Math.max(runningPeakPct, equityPct);
    const drawdownPct = (100 + runningPeakPct) <= 0
      ? -100
      : (((100 + equityPct) / (100 + runningPeakPct)) - 1) * 100;
    return {
      ts_utc: tsUtc,
      equity_pct: equityPct,
      lock_pct: null,
      peak_pct: runningPeakPct,
      drawdown_pct: drawdownPct,
      active_positions: activePositions,
    };
  });

  return {
    id: "active-mix",
    label: series.length === 1 ? series[0]?.label ?? "Active Mix" : "Active Mix",
    color: "#10b981",
    points,
  };
}

function summarizeMixedSeries(series: PerformanceSimulationSeries, fallbackTrades: number | null) {
  const last = series.points.at(-1);
  const drawdowns = series.points
    .map((point) => point.drawdown_pct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    returnPct: last?.equity_pct ?? null,
    maxDrawdownPct: drawdowns.length > 0 ? Math.abs(Math.min(...drawdowns)) : null,
    trades: fallbackTrades,
  };
}

export default function PerformanceSimulationSection({
  group,
}: {
  group: PerformanceSimulationGroup | null;
}) {
  const sleeveSeries = useMemo(() => {
    const assetSleeves = group?.series.filter((series) => series.id.startsWith("asset:")) ?? [];
    if (assetSleeves.length > 0) return assetSleeves;
    return group?.series.filter((series) => series.id !== "equity" && series.id !== "total") ?? [];
  }, [group]);
  const [selectedSleeves, setSelectedSleeves] = useState<string[] | null>(null);
  const sleeveIds = sleeveSeries.map((series) => series.id);
  const selectedSleevesInGroup = selectedSleeves?.filter((id) => sleeveIds.includes(id)) ?? null;
  const resolvedSelectedSleeves = selectedSleevesInGroup && selectedSleevesInGroup.length > 0
    ? selectedSleevesInGroup
    : sleeveIds;
  const activeSleeves = sleeveSeries.filter((series) => resolvedSelectedSleeves.includes(series.id));
  const mixedSeries = computeMixedSeries(activeSleeves.length > 0 ? activeSleeves : sleeveSeries);
  const allSleevesSelected = sleeveSeries.length > 0 && resolvedSelectedSleeves.length === sleeveSeries.length;
  const mixedMetrics = summarizeMixedSeries(mixedSeries, allSleevesSelected ? group?.metrics.trades ?? null : null);

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
          Select sleeves to view one combined path and matching path metrics.
        </p>
        {sleeveSeries.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {sleeveSeries.map((item) => {
              const active = resolvedSelectedSleeves.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedSleeves((previous) => {
                      const current = previous ?? sleeveSeries.map((series) => series.id);
                      const next = current.includes(item.id)
                        ? current.filter((id) => id !== item.id)
                        : [...current, item.id];
                      return next.length > 0 ? next : current;
                    });
                  }}
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
            <button
              type="button"
              onClick={() => setSelectedSleeves(sleeveSeries.map((series) => series.id))}
              className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
            >
              All
            </button>
          </div>
        ) : null}
      </div>

      <EquityCurveChart
        title={`${group.title} equity curve`}
        series={[mixedSeries]}
        interactive={false}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Return
          </div>
          <div data-testid="sim-return" className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {formatSignedPercent(mixedMetrics.returnPct)}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Max DD
          </div>
          <div data-testid="sim-maxdd" className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {formatPercent(mixedMetrics.maxDrawdownPct)}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Trades
          </div>
          <div data-testid="sim-trades" className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {mixedMetrics.trades ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
