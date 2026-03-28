/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceSidebar.tsx
 *
 * Description:
 * Performance sidebar with bias source selector and engine-driven
 * stats. Reads ?bias= and ?week= from URL, fetches stats from the
 * engine-stats API route.
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

function EngineSidebarStats() {
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
        <div className="text-xs text-[color:var(--muted)]">No data available for this selection.</div>
      </div>
    );
  }

  const returnColor = stats.weekReturnPct >= 0 ? "text-lime-400" : "text-red-400";
  const fxTrades = stats.trades.filter((t) => t.assetClass === "fx");
  const otherTrades = stats.trades.filter((t) => t.assetClass !== "fx");
  const fxReturn = fxTrades.reduce((s, t) => s + t.returnPct, 0);
  const otherReturn = otherTrades.reduce((s, t) => s + t.returnPct, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
          {stats.biasSourceLabel} · Weekly Hold
        </div>

        <div className={`mt-4 text-3xl font-bold ${returnColor}`}>
          {stats.weekReturnPct >= 0 ? "+" : ""}{stats.weekReturnPct.toFixed(2)}%
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
          Week Return
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
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

        <div className="mt-3 border-t border-[var(--panel-border)] pt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">FX ({fxTrades.length})</span>
            <span className={fxReturn >= 0 ? "text-lime-400" : "text-red-400"}>
              {fxReturn >= 0 ? "+" : ""}{fxReturn.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[color:var(--muted)]">Other ({otherTrades.length})</span>
            <span className={otherReturn >= 0 ? "text-lime-400" : "text-red-400"}>
              {otherReturn >= 0 ? "+" : ""}{otherReturn.toFixed(2)}%
            </span>
          </div>
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
        <EngineSidebarStats />
      </div>
    </div>
  );
}
