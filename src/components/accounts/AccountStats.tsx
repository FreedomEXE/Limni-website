"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AccountWeekStats } from "@/lib/accountStats";
import { formatCurrencySafe } from "@/lib/formatters";
import type { WeekOption } from "@/lib/weekState";

type AccountStatsProps = {
  accountKey: string;
  initialStats: AccountWeekStats;
};

/**
 * Format percentage with sign and color
 */
function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Skeleton loader for stat cards
 */
function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm animate-pulse">
      <div className="h-3 w-16 bg-[var(--muted)]/20 rounded mb-3" />
      <div className="h-8 w-24 bg-[var(--muted)]/20 rounded" />
    </div>
  );
}

/**
 * Individual stat card component
 */
function StatCard({
  label,
  value,
  colorClass,
  loading,
}: {
  label: string;
  value: string;
  colorClass?: string;
  loading?: boolean;
}) {
  if (loading) {
    return <StatCardSkeleton />;
  }

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm transition-all duration-200 hover:shadow-md">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${colorClass ?? "text-[var(--foreground)]"}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Reactive account stats component
 *
 * Features:
 * - Fetches week-specific stats when query params change
 * - Smooth loading transitions with skeleton screens
 * - Error handling with fallback to initial stats
 * - Optimistic UI updates
 * - Accessibility: announces loading state to screen readers
 *
 * UX Design:
 * - Shows skeleton loaders during fetch (no jarring spinners)
 * - Maintains layout to prevent content shift
 * - Color-codes P&L metrics (green/red)
 * - Smooth fade transitions between stat updates
 * - Graceful error handling (silent fallback)
 */
export default function AccountStats({ accountKey, initialStats }: AccountStatsProps) {
  const searchParams = useSearchParams();
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get selected week from URL
  const weekParam = searchParams.get("week");
  const viewParam = searchParams.get("view");
  const selectedWeek: WeekOption = viewParam === "all" ? "all" : weekParam ?? initialStats.weekOpenUtc;

  useEffect(() => {
    // Skip fetch if week hasn't changed
    if (selectedWeek === stats.weekOpenUtc) {
      return;
    }

    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/accounts/connected/${accountKey}/stats?week=${selectedWeek}`
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        if (cancelled) return;

        if (data.success && data.data) {
          setStats(data.data);
        } else {
          throw new Error(data.error ?? "Unknown error");
        }
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to fetch account stats:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch stats");

        // Fallback: keep showing initial stats on error
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [accountKey, selectedWeek, stats.weekOpenUtc]);

  return (
    <>
      {/* Accessibility: announce loading/error state */}
      {loading && (
        <span className="sr-only" role="status" aria-live="polite">
          Loading account statistics...
        </span>
      )}
      {error && (
        <span className="sr-only" role="alert" aria-live="assertive">
          Error loading statistics: {error}
        </span>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Equity"
          value={formatCurrencySafe(stats.equity, stats.currency)}
          loading={loading}
        />

        <StatCard
          label="Balance"
          value={formatCurrencySafe(stats.balance, stats.currency)}
          loading={loading}
        />

        <StatCard
          label={stats.weekOpenUtc === "all" ? "Total PnL" : "Weekly PnL"}
          value={formatPercent(stats.weeklyPnlPct)}
          colorClass={stats.weeklyPnlPct >= 0 ? "text-emerald-700" : "text-rose-700"}
          loading={loading}
        />

        <StatCard
          label="Basket PnL"
          value={formatPercent(stats.basketPnlPct)}
          colorClass={stats.basketPnlPct >= 0 ? "text-emerald-700" : "text-rose-700"}
          loading={loading}
        />
      </div>

      {/* Optional: Error banner (non-intrusive) */}
      {error && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-600">
          <strong>Note:</strong> Could not load updated stats. Showing cached data.
        </div>
      )}
    </>
  );
}
