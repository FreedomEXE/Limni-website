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
import { usePathname, useSearchParams } from "next/navigation";
import StrategySelector from "@/components/shared/StrategySelector";
import { getEntryStyle, getRiskOverlay } from "@/lib/performance/strategyConfig";
import type { EngineSidebarStats } from "@/lib/performance/engineAdapter";
import {
  STRATEGY_SELECTION_COMMIT_EVENT,
  STRATEGY_SIDEBAR_STATS_EVENT,
  type RuntimeStrategySelection,
  type StrategySelectionCommitDetail,
  type StrategySidebarStatsDetail,
} from "@/lib/performance/strategySelection";
import { readSelectionFromParams } from "@/components/shared/StrategySelector";

function formatPF(pf: number | null | undefined): string {
  if (pf == null) return "∞";
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
  empty?: boolean;
};

function EngineSidebarStatsCard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSelection = readSelectionFromParams(searchParams);
  const [activeSelection, setActiveSelection] = useState<RuntimeStrategySelection>(initialSelection);
  const [allTimeStats, setAllTimeStats] = useState<EngineSidebarStats | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onSelectionCommit = (event: Event) => {
      const custom = event as CustomEvent<StrategySelectionCommitDetail>;
      setActiveSelection(custom.detail.selection);
      setWeekStats(null);
    };
    const onSidebarStats = (event: Event) => {
      const custom = event as CustomEvent<StrategySidebarStatsDetail>;
      setActiveSelection(custom.detail.selection);
      setAllTimeStats(custom.detail.stats);
      setLoading(false);
    };
    window.addEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
    window.addEventListener(STRATEGY_SIDEBAR_STATS_EVENT, onSidebarStats);
    return () => {
      window.removeEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
      window.removeEventListener(STRATEGY_SIDEBAR_STATS_EVENT, onSidebarStats);
    };
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/performance") || pathname.startsWith("/matrix")) {
      return;
    }
    fetch(`/api/performance/engine-stats?bias=${activeSelection.strategy}&f1=${activeSelection.f1}&f2=${activeSelection.f2}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setAllTimeStats(null);
        else setAllTimeStats(d);
        setLoading(false);
      })
      .catch(() => { setAllTimeStats(null); setLoading(false); });
  }, [activeSelection, pathname]);

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
  const entryStyleLabel = getEntryStyle(activeSelection.f1)?.label ?? activeSelection.f1;
  const riskOverlay = getRiskOverlay(activeSelection.f2);
  const overlayLabel = riskOverlay && riskOverlay.id !== "none" ? riskOverlay.label : null;
  const allTimeLabel = [
    allTimeStats?.biasSourceLabel,
    entryStyleLabel,
    overlayLabel,
  ].filter(Boolean).join(" · ");
  const activeReturn = isAllTime
    ? at?.totalReturnPct ?? 0
    : allTimeStats?.weekReturnPct ?? weekStats?.returnPct ?? 0;
  const activeWinRate = isAllTime
    ? at?.weeklyWinRate ?? 0
    : allTimeStats?.winRate ?? weekStats?.winRate ?? 0;
  const activeMaxDrawdown = isAllTime
    ? at?.maxDrawdownPct ?? 0
    : allTimeStats?.maxDrawdownPct ?? 0;
  const activeTrades = isAllTime
    ? at?.totalTrades ?? 0
    : allTimeStats?.tradeCount ?? weekStats?.tradeCount ?? 0;
  const activeWins = isAllTime
    ? null
    : allTimeStats?.winCount ?? weekStats?.winCount ?? 0;
  const activeLosses = isAllTime
    ? null
    : allTimeStats?.lossCount ?? weekStats?.lossCount ?? 0;

  return (
    <div className="space-y-3">
      {(at || allTimeStats) && (
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
            {allTimeLabel}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
            {isAllTime ? `${at?.weeks ?? 0} Weeks Tracked` : "Selected Week"}
          </div>

          {weekStats?.empty && !isAllTime ? (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-2 text-xs text-[color:var(--muted)]">
              No realized performance data.
            </div>
          ) : (
          <>
          <div data-testid="sidebar-return" className={`mt-3 text-3xl font-bold ${returnColor(activeReturn)}`}>
            {activeReturn >= 0 ? "+" : ""}{activeReturn.toFixed(2)}%
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            {isAllTime ? "Total Return" : "Week Return"}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">{isAllTime ? "Weekly WR" : "Win Rate"}</div>
              <div data-testid="sidebar-winrate" className="font-bold">{activeWinRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Max DD</div>
              <div data-testid="sidebar-maxdd" className="font-bold text-red-400">{activeMaxDrawdown.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">{isAllTime ? "Sharpe" : "Trades"}</div>
              <div data-testid={!isAllTime ? "sidebar-trades" : undefined} className="font-bold">{isAllTime && at ? at.sharpe.toFixed(2) : activeTrades}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Sortino</div>
              <div className="font-bold">{isAllTime && at?.sortino != null ? (at.sortino >= 99 ? "∞" : at.sortino.toFixed(2)) : "—"}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Profit Factor</div>
              <div className="font-bold">{isAllTime && at ? formatPF(at.profitFactor) : "—"}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Calmar</div>
              <div className="font-bold">{isAllTime && at?.calmar != null ? at.calmar.toFixed(2) : "—"}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">{isAllTime ? "Avg Weekly" : "Wins"}</div>
              <div className="font-bold">
                {isAllTime && at ? `${at.avgWeeklyReturn >= 0 ? "+" : ""}${at.avgWeeklyReturn.toFixed(2)}%` : <span className="text-lime-400">{activeWins ?? 0}</span>}
              </div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">{isAllTime ? "Total Trades" : "Losses"}</div>
              <div data-testid={isAllTime ? "sidebar-trades" : undefined} className={`font-bold ${isAllTime ? "" : "text-red-400"}`}>{isAllTime ? activeTrades : activeLosses ?? 0}</div>
            </div>
          </div>

          {isAllTime && at && at.expectancy != null && (
          <div className="mt-3 border-t border-[var(--panel-border)] pt-3 grid grid-cols-2 gap-2.5 text-sm">
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Expectancy</div>
              <div className={`font-bold ${returnColor(at.expectancy)}`}>{at.expectancy >= 0 ? "+" : ""}{at.expectancy.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Avg Win / Loss</div>
              <div className="font-bold text-xs">+{(at.avgWin ?? 0).toFixed(1)} / -{(at.avgLoss ?? 0).toFixed(1)}</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Best Streak</div>
              <div className="font-bold text-lime-400">{at.maxConsecutiveWins ?? 0}W</div>
            </div>
            <div>
              <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Worst Streak</div>
              <div className="font-bold text-red-400">{at.maxConsecutiveLosses ?? 0}L</div>
            </div>
          </div>
          )}
          </>
          )}
        </div>
      )}
    </div>
  );
}

export default function StrategySidebar() {
  const searchParams = useSearchParams();
  const selection = readSelectionFromParams(searchParams);
  const sidebarKey = `${selection.strategy}:${selection.f1}:${selection.f2}`;

  return (
    <div className="flex-1 space-y-4 p-4">
      <StrategySelector key={`selector:${sidebarKey}`} />

      <div className="border-t border-[var(--panel-border)] pt-4">
        <EngineSidebarStatsCard key={`stats:${sidebarKey}`} />
      </div>
    </div>
  );
}
