/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceSidebar.tsx
 *
 * Description:
 * Performance sidebar with bias source / filter dropdowns and
 * engine-driven stats card showing week + all-time metrics.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PerformanceStrategySelector from "@/components/performance/PerformanceStrategySelector";
import { resolveBiasSourceId } from "@/lib/performance/strategyConfig";
import type { EngineSidebarStats } from "@/lib/performance/engineAdapter";

function formatPF(pf: number | null | undefined): string {
  if (pf == null) return "—";
  if (!isFinite(pf)) return "∞";
  return pf.toFixed(2);
}

function EngineSidebarStatsCard() {
  const searchParams = useSearchParams();
  const bias = resolveBiasSourceId(searchParams.get("bias"));
  const week = searchParams.get("week") ?? "";
  const [stats, setStats] = useState<EngineSidebarStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("bias", bias);
    if (week) params.set("week", week);

    fetch(`/api/performance/engine-stats?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setStats(null);
        } else {
          setStats(d);
        }
        setLoading(false);
      })
      .catch(() => {
        setStats(null);
        setLoading(false);
      });
  }, [bias, week]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="text-xs text-[color:var(--muted)]">Computing stats...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="text-xs text-[color:var(--muted)]">No data available.</div>
      </div>
    );
  }

  const returnColor = stats.weekReturnPct >= 0 ? "text-lime-400" : "text-red-400";
  const at = stats.allTime;

  return (
    <div className="space-y-3">
      {/* Selected week stats */}
      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
          {stats.biasSourceLabel} · Weekly Hold
        </div>

        <div className={`mt-3 text-3xl font-bold ${returnColor}`}>
          {stats.weekReturnPct >= 0 ? "+" : ""}{stats.weekReturnPct.toFixed(2)}%
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
          Week Return
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
          <div>
            <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Win Rate</div>
            <div className="font-bold">{stats.winRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Trades</div>
            <div className="font-bold">{stats.tradeCount}</div>
          </div>
          <div>
            <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Wins</div>
            <div className="font-bold text-lime-400">{stats.winCount}</div>
          </div>
          <div>
            <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Losses</div>
            <div className="font-bold text-red-400">{stats.lossCount}</div>
          </div>
        </div>
      </div>

      {/* All-time aggregate stats */}
      {at && (
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            All Time · {at.weeks} Weeks
          </div>

          <div className={`mt-2 text-xl font-bold ${at.totalReturnPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
            {at.totalReturnPct >= 0 ? "+" : ""}{at.totalReturnPct.toFixed(2)}%
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Weekly WR</div>
              <div className="font-bold">{at.weeklyWinRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Max DD</div>
              <div className="font-bold text-red-400">{at.maxDrawdownPct.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Sharpe</div>
              <div className="font-bold">{at.sharpe.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Profit Factor</div>
              <div className="font-bold">{formatPF(at.profitFactor)}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Avg Weekly</div>
              <div className="font-bold">{at.avgWeeklyReturn >= 0 ? "+" : ""}{at.avgWeeklyReturn.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Total Trades</div>
              <div className="font-bold">{at.totalTrades}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerformanceSidebar() {
  return (
    <div className="flex-1 space-y-4 p-4">
      <PerformanceStrategySelector
        initialBiasSource="dealer"
        initialFilter="weekly_hold"
      />

      <div className="border-t border-[var(--panel-border)] pt-4">
        <EngineSidebarStatsCard />
      </div>
    </div>
  );
}
