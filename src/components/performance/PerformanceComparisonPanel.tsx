"use client";

import { useEffect, useState } from "react";

type ComparisonMetrics = {
  totalReturn: number;
  weeks: number;
  winRate: number;
  sharpe: number;
  avgWeekly: number;
};

type ComparisonData = {
  v1: ComparisonMetrics;
  v2: ComparisonMetrics;
};

export default function PerformanceComparisonPanel() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/performance/comparison");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        if (json.error) {
          throw new Error(json.error);
        }
        setData(json);
      } catch (err) {
        console.error("PerformanceComparisonPanel error:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4">
        <div className="animate-pulse rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/40 px-4 py-8">
          <div className="text-xs text-center text-[color:var(--muted)]">Loading comparison...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
          Failed to load comparison data: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-xs text-[var(--accent-strong)]">
          No performance data available yet.
        </div>
      </div>
    );
  }

  const { v1: v1Metrics, v2: v2Metrics } = data;

  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          System Comparison
        </div>
      </div>

      {/* V1 Card */}
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--foreground)]">V1 · Current</div>
          <div className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]">
            5 Baskets
          </div>
        </div>

        <div className="mb-4">
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {v1Metrics.totalReturn >= 0 ? "+" : ""}{v1Metrics.totalReturn.toFixed(2)}%
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Total Return
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {v1Metrics.winRate.toFixed(0)}%
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
              Win Rate
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {v1Metrics.sharpe.toFixed(2)}
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
              Sharpe
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {v1Metrics.avgWeekly >= 0 ? "+" : ""}{v1Metrics.avgWeekly.toFixed(2)}%
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
              Avg Weekly
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {v1Metrics.weeks}
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
              Weeks
            </div>
          </div>
        </div>
      </div>

      {/* V2 Card */}
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">V2 · Proposed</div>
          <div className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-800 dark:text-emerald-200">
            3 Baskets
          </div>
        </div>

        <div className="mb-4">
          <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            {v2Metrics.totalReturn >= 0 ? "+" : ""}{v2Metrics.totalReturn.toFixed(2)}%
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            Total Return
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {v2Metrics.winRate.toFixed(0)}%
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">
              Win Rate
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {v2Metrics.sharpe.toFixed(2)}
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">
              Sharpe
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {v2Metrics.avgWeekly >= 0 ? "+" : ""}{v2Metrics.avgWeekly.toFixed(2)}%
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">
              Avg Weekly
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {v2Metrics.weeks}
            </div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">
              Weeks
            </div>
          </div>
        </div>
      </div>

      {/* Delta Indicator */}
      {v2Metrics.totalReturn !== v1Metrics.totalReturn ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">
            {v2Metrics.totalReturn > v1Metrics.totalReturn ? "↑" : "↓"}{" "}
            {Math.abs(v2Metrics.totalReturn - v1Metrics.totalReturn).toFixed(2)}%
          </div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            Delta
          </div>
        </div>
      ) : null}
    </div>
  );
}
