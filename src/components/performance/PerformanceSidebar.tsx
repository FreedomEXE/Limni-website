/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceSidebar.tsx
 *
 * Description:
 * Performance sidebar with bias source / filter dropdowns and
 * all-time aggregate stats. Fetches once per bias source change.
 * Week switching is client-side (no re-fetch needed).
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
  const [stats, setStats] = useState<EngineSidebarStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/performance/engine-stats?bias=${bias}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setStats(null);
        else setStats(d);
        setLoading(false);
      })
      .catch(() => { setStats(null); setLoading(false); });
  }, [bias]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="text-xs text-[color:var(--muted)]">Computing stats...</div>
      </div>
    );
  }

  if (!stats?.allTime) {
    return (
      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="text-xs text-[color:var(--muted)]">No data available.</div>
      </div>
    );
  }

  const at = stats.allTime;
  const returnColor = at.totalReturnPct >= 0 ? "text-lime-400" : "text-red-400";

  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
        {stats.biasSourceLabel} · Weekly Hold
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
        {at.weeks} Weeks Tracked
      </div>

      <div className={`mt-3 text-3xl font-bold ${returnColor}`}>
        {at.totalReturnPct >= 0 ? "+" : ""}{at.totalReturnPct.toFixed(2)}%
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
        Total Return
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
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
