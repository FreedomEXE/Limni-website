/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: StrategySidebar.tsx
 *
 * Description:
 * Shared strategy sidebar used by Performance, Matrix, and any future
 * section that needs strategy/filter selection + aggregate stats.
 * Contains the StrategySelector dropdowns and engine-driven stats card.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import StrategySelector from "@/components/shared/StrategySelector";
import { resolveStrategyId, resolveIntradayFilterId, getIntradayFilter } from "@/lib/performance/strategyConfig";
import type { EngineSidebarStats } from "@/lib/performance/engineAdapter";

function formatPF(pf: number | null | undefined): string {
  if (pf == null) return "—";
  if (!isFinite(pf)) return "∞";
  return pf.toFixed(2);
}

type WeekStats = {
  weekKey: string;
  returnPct: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
};

function EngineSidebarStatsCard() {
  const searchParams = useSearchParams();
  const bias = resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias"));
  const f2 = resolveIntradayFilterId(searchParams.get("f2"));
  const [allTimeStats, setAllTimeStats] = useState<EngineSidebarStats | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch all-time stats on bias or filter change
  useEffect(() => {
    setLoading(true);
    fetch(`/api/performance/engine-stats?bias=${bias}&f2=${f2}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setAllTimeStats(null);
        else setAllTimeStats(d);
        setLoading(false);
      })
      .catch(() => { setAllTimeStats(null); setLoading(false); });
  }, [bias, f2]);

  // Listen for week change events from ViewSection
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<WeekStats>;
      setWeekStats(custom.detail);
    };
    window.addEventListener("performance-week-stats", handler);
    return () => window.removeEventListener("performance-week-stats", handler);
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="text-xs text-[color:var(--muted)]">Computing stats...</div>
      </div>
    );
  }

  const at = allTimeStats?.allTime;
  const isAllTime = weekStats?.weekKey === "all" || !weekStats;
  const returnColor = (v: number) => v >= 0 ? "text-lime-400" : "text-red-400";
  const filterLabel = f2 !== "none" ? ` · ${getIntradayFilter(f2)?.label ?? f2}` : "";

  return (
    <div className="space-y-3">
      {/* Selected week stats */}
      {weekStats && !isAllTime && (
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            Selected Week
          </div>

          <div className={`mt-2 text-2xl font-bold ${returnColor(weekStats.returnPct)}`}>
            {weekStats.returnPct >= 0 ? "+" : ""}{weekStats.returnPct.toFixed(2)}%
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Win Rate</div>
              <div className="font-bold">{weekStats.winRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Trades</div>
              <div className="font-bold">{weekStats.tradeCount}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Wins</div>
              <div className="font-bold text-lime-400">{weekStats.winCount}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Losses</div>
              <div className="font-bold text-red-400">{weekStats.lossCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* All-time aggregate stats */}
      {at && (
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
            {allTimeStats?.biasSourceLabel} · Weekly Hold{filterLabel}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
            {at.weeks} Weeks Tracked
          </div>

          <div className={`mt-3 text-3xl font-bold ${returnColor(at.totalReturnPct)}`}>
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
      )}
    </div>
  );
}

export default function StrategySidebar() {
  return (
    <div className="flex-1 space-y-4 p-4">
      <StrategySelector />

      <div className="border-t border-[var(--panel-border)] pt-4">
        <EngineSidebarStatsCard />
      </div>
    </div>
  );
}
