"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  v3: ComparisonMetrics;
};

export default function PerformanceComparisonPanel() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestedSystem = searchParams.get("system");
  const initialTab = requestedSystem === "v2" || requestedSystem === "v3" ? requestedSystem : "v1";
  const [activeTab, setActiveTab] = useState<"v1" | "v2" | "v3">(initialTab);

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

  const v1Metrics = data?.v1 ?? { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0 };
  const v2Metrics = data?.v2 ?? { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0 };
  const v3Metrics = data?.v3 ?? { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0 };
  const activeMetrics = activeTab === "v1" ? v1Metrics : activeTab === "v2" ? v2Metrics : v3Metrics;
  const activeLabel =
    activeTab === "v1" ? "Universal V1" : activeTab === "v2" ? "Universal V2" : "Universal V3";
  const activeBadge = activeTab === "v1" ? "5 Baskets" : activeTab === "v2" ? "3 Baskets" : "4 Baskets";
  const activeCardClass =
    activeTab === "v1"
      ? "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4"
      : activeTab === "v2"
        ? "rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4"
        : "rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-4";
  const valueClass =
    activeTab === "v1"
      ? "text-[var(--foreground)]"
      : activeTab === "v2"
        ? "text-emerald-900 dark:text-emerald-100"
        : "text-cyan-900 dark:text-cyan-100";
  const labelClass =
    activeTab === "v1"
      ? "text-[color:var(--muted)]"
      : activeTab === "v2"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-cyan-700 dark:text-cyan-300";
  const badgeClass =
    activeTab === "v1"
      ? "rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]"
      : activeTab === "v2"
        ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-800 dark:text-emerald-200"
        : "rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-200";
  const hasHistoricalData = v1Metrics.weeks > 0 || v2Metrics.weeks > 0 || v3Metrics.weeks > 0;
  const setSystem = (next: "v1" | "v2" | "v3") => {
    setActiveTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("system", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-system-change", { detail: next }));
  };

  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          System Comparison
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setSystem("v1")}
          className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
            activeTab === "v1"
              ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
              : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-[var(--accent)]/40"
          }`}
        >
          Universal V1
        </button>
        <button
          type="button"
          onClick={() => setSystem("v2")}
          className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
            activeTab === "v2"
              ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-emerald-400/50"
          }`}
        >
          Universal V2
        </button>
        <button
          type="button"
          onClick={() => setSystem("v3")}
          className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
            activeTab === "v3"
              ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200"
              : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-cyan-400/50"
          }`}
        >
          Universal V3
        </button>
      </div>

      <div className={activeCardClass}>
        <div className="mb-3 flex items-center justify-between">
          <div className={`text-sm font-semibold ${valueClass}`}>{activeLabel}</div>
          <div className={badgeClass}>{activeBadge}</div>
        </div>

        <div className="mb-4">
          <div className={`text-2xl font-bold ${valueClass}`}>
            {activeMetrics.totalReturn >= 0 ? "+" : ""}
            {activeMetrics.totalReturn.toFixed(2)}%
          </div>
          <div className={`text-[10px] uppercase tracking-[0.2em] ${labelClass}`}>
            Total Return
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.winRate.toFixed(0)}%
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Win Rate
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.sharpe.toFixed(2)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Sharpe
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.avgWeekly >= 0 ? "+" : ""}
              {activeMetrics.avgWeekly.toFixed(2)}%
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Avg Weekly
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.weeks}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Weeks
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">Loading comparison...</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            Fetching snapshot metrics
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-rose-700">Failed to load comparison data</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-rose-600">
            {error}
          </div>
        </div>
      ) : null}

      {!loading && !error && !hasHistoricalData ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">No closed weeks available yet</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            Waiting for historical snapshots
          </div>
        </div>
      ) : null}

      {!loading && !error && activeTab !== "v1" ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">
            {activeMetrics.totalReturn > v1Metrics.totalReturn ? "↑" : "↓"}{" "}
            {Math.abs(activeMetrics.totalReturn - v1Metrics.totalReturn).toFixed(2)}%
          </div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {activeTab.toUpperCase()} vs V1 Delta
          </div>
        </div>
      ) : null}
    </div>
  );
}
