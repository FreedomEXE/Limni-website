/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceTab.tsx
 *
 * Description:
 * Katarakti performance overview — aggregated stats, weekly PnL
 * breakdown, win rate by session, and exit step distribution.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useMemo } from "react";
import {
  toNumber,
  toIsoString,
  formatCompactUsd,
  pnlTone,
  type KataraktiTradeRow,
} from "@/components/mt5-forex-lite/types";

type PerformanceTabProps = {
  trades: KataraktiTradeRow[];
};

type WeeklySummary = {
  week: string;
  trades: number;
  wins: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  maxWin: number;
  maxLoss: number;
};

type SessionSummary = {
  session: string;
  trades: number;
  wins: number;
  winRate: number;
  totalPnl: number;
};

type ExitStepSummary = {
  step: string;
  count: number;
  pct: number;
  avgPnl: number;
};

type WeeklyAccumulator = {
  trades: number;
  wins: number;
  totalPnl: number;
  maxWin: number;
  maxLoss: number;
};

type SessionAccumulator = {
  trades: number;
  wins: number;
  totalPnl: number;
};

type ExitStepAccumulator = {
  count: number;
  totalPnl: number;
};

export default function PerformanceTab({ trades }: PerformanceTabProps) {
  const closedTrades = useMemo(
    () => trades.filter((t) => t.exit_time_utc),
    [trades],
  );

  /* ── Aggregate stats ───────────────────── */
  const stats = useMemo(() => {
    if (closedTrades.length === 0) {
      return {
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPnl: 0,
        avgPnl: 0,
        maxWin: 0,
        maxLoss: 0,
        avgDuration: 0,
        milestones: { r025: 0, r050: 0, r075: 0, r100: 0 },
      };
    }

    let wins = 0;
    let totalPnl = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let durationSum = 0;
    let durationCount = 0;
    let reached025 = 0;
    let reached050 = 0;
    let reached075 = 0;
    let reached100 = 0;

    for (const trade of closedTrades) {
      const pnl = toNumber(trade.pnl_usd) ?? 0;
      if (pnl > 0) wins += 1;
      totalPnl += pnl;
      if (pnl > maxWin) maxWin = pnl;
      if (pnl < maxLoss) maxLoss = pnl;

      const duration = toNumber(trade.duration_hours);
      if (duration !== null) {
        durationSum += duration;
        durationCount += 1;
      }

      if (trade.reached_025) reached025 += 1;
      if (trade.reached_050) reached050 += 1;
      if (trade.reached_075) reached075 += 1;
      if (trade.reached_100) reached100 += 1;
    }

    return {
      total: closedTrades.length,
      wins,
      losses: closedTrades.length - wins,
      winRate: (wins / closedTrades.length) * 100,
      totalPnl,
      avgPnl: totalPnl / closedTrades.length,
      maxWin,
      maxLoss,
      avgDuration: durationCount > 0 ? durationSum / durationCount : 0,
      milestones: {
        r025: reached025,
        r050: reached050,
        r075: reached075,
        r100: reached100,
      },
    };
  }, [closedTrades]);

  /* ── Weekly/session/exit breakdowns ────── */
  const { weeklyData, sessionData, exitStepData } = useMemo(() => {
    const weekMap = new Map<string, WeeklyAccumulator>();
    const sessionMap = new Map<string, SessionAccumulator>();
    const stepMap = new Map<string, ExitStepAccumulator>();

    for (const trade of closedTrades) {
      const pnl = toNumber(trade.pnl_usd) ?? 0;

      const week = toIsoString(trade.week_anchor)?.slice(0, 10) ?? "unknown";
      const weekly = weekMap.get(week) ?? {
        trades: 0,
        wins: 0,
        totalPnl: 0,
        maxWin: 0,
        maxLoss: 0,
      };
      weekly.trades += 1;
      if (pnl > 0) {
        weekly.wins += 1;
      }
      weekly.totalPnl += pnl;
      if (pnl > weekly.maxWin) {
        weekly.maxWin = pnl;
      }
      if (pnl < weekly.maxLoss) {
        weekly.maxLoss = pnl;
      }
      weekMap.set(week, weekly);

      const session = trade.session_window ?? "unknown";
      const bySession = sessionMap.get(session) ?? {
        trades: 0,
        wins: 0,
        totalPnl: 0,
      };
      bySession.trades += 1;
      if (pnl > 0) {
        bySession.wins += 1;
      }
      bySession.totalPnl += pnl;
      sessionMap.set(session, bySession);

      const step = trade.exit_step ?? trade.exit_reason ?? "unknown";
      const exitStep = stepMap.get(step) ?? { count: 0, totalPnl: 0 };
      exitStep.count += 1;
      exitStep.totalPnl += pnl;
      stepMap.set(step, exitStep);
    }

    const weeklyData: WeeklySummary[] = Array.from(weekMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([week, data]) => ({
        week,
        trades: data.trades,
        wins: data.wins,
        winRate: (data.wins / data.trades) * 100,
        totalPnl: data.totalPnl,
        avgPnl: data.totalPnl / data.trades,
        maxWin: data.maxWin,
        maxLoss: data.maxLoss,
      }));

    const sessionData: SessionSummary[] = Array.from(sessionMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([session, data]) => ({
        session,
        trades: data.trades,
        wins: data.wins,
        winRate: (data.wins / data.trades) * 100,
        totalPnl: data.totalPnl,
      }));

    const exitStepData: ExitStepSummary[] = Array.from(stepMap.entries())
      .map(([step, data]) => ({
        step,
        count: data.count,
        pct: (data.count / closedTrades.length) * 100,
        avgPnl: data.totalPnl / data.count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      weeklyData,
      sessionData,
      exitStepData,
    };
  }, [closedTrades]);

  if (closedTrades.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6">
        <p className="text-center text-xs text-[color:var(--muted)]">
          No closed trades yet. Performance data will populate as Katarakti executes trades.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Headline stats ───────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total PnL" value={formatCompactUsd(stats.totalPnl)} tone={pnlTone(stats.totalPnl)} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} sub={`${stats.wins}W / ${stats.losses}L`} />
        <StatCard label="Avg PnL/Trade" value={formatCompactUsd(stats.avgPnl)} tone={pnlTone(stats.avgPnl)} />
        <StatCard label="Avg Duration" value={`${stats.avgDuration.toFixed(1)}h`} />
      </div>

      {/* ── Milestone reach rates ────────────── */}
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Milestone Reach Rates
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          <MilestoneBar label="+0.25%" reached={stats.milestones.r025} total={stats.total} />
          <MilestoneBar label="+0.50%" reached={stats.milestones.r050} total={stats.total} />
          <MilestoneBar label="+0.75%" reached={stats.milestones.r075} total={stats.total} />
          <MilestoneBar label="+1.00%" reached={stats.milestones.r100} total={stats.total} />
        </div>
      </div>

      {/* ── Weekly breakdown ─────────────────── */}
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Weekly Breakdown
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--panel-border)] text-left text-[color:var(--muted)]">
                <th className="pb-2 pr-4">Week</th>
                <th className="pb-2 pr-4">Trades</th>
                <th className="pb-2 pr-4">WR</th>
                <th className="pb-2 pr-4">PnL</th>
                <th className="pb-2 pr-4">Avg PnL</th>
                <th className="pb-2 pr-4">Max Win</th>
                <th className="pb-2 pr-4">Max Loss</th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((w) => (
                <tr key={w.week} className="border-b border-[var(--panel-border)]/50">
                  <td className="py-2 pr-4 font-medium text-[var(--foreground)]">
                    {w.week}
                  </td>
                  <td className="py-2 pr-4">{w.trades}</td>
                  <td className="py-2 pr-4">{w.winRate.toFixed(1)}%</td>
                  <td className={`py-2 pr-4 font-medium ${pnlTone(w.totalPnl)}`}>
                    {formatCompactUsd(w.totalPnl)}
                  </td>
                  <td className={`py-2 pr-4 ${pnlTone(w.avgPnl)}`}>
                    {formatCompactUsd(w.avgPnl)}
                  </td>
                  <td className="py-2 pr-4 text-emerald-400">
                    {formatCompactUsd(w.maxWin)}
                  </td>
                  <td className="py-2 pr-4 text-rose-400">
                    {formatCompactUsd(w.maxLoss)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Session breakdown ────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            By Session Window
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--panel-border)] text-left text-[color:var(--muted)]">
                  <th className="pb-2 pr-4">Session</th>
                  <th className="pb-2 pr-4">Trades</th>
                  <th className="pb-2 pr-4">WR</th>
                  <th className="pb-2 pr-4">PnL</th>
                </tr>
              </thead>
              <tbody>
                {sessionData.map((s) => (
                  <tr key={s.session} className="border-b border-[var(--panel-border)]/50">
                    <td className="py-2 pr-4 font-medium text-[var(--foreground)]">
                      {s.session}
                    </td>
                    <td className="py-2 pr-4">{s.trades}</td>
                    <td className="py-2 pr-4">{s.winRate.toFixed(1)}%</td>
                    <td className={`py-2 pr-4 font-medium ${pnlTone(s.totalPnl)}`}>
                      {formatCompactUsd(s.totalPnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Exit step distribution ──────────── */}
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Exit Step Distribution
          </h3>
          <div className="mt-3 space-y-2">
            {exitStepData.map((e) => (
              <div key={e.step} className="flex items-center gap-3">
                <span className="w-28 truncate text-xs font-medium text-[var(--foreground)]">
                  {e.step}
                </span>
                <div className="flex-1">
                  <div className="h-4 overflow-hidden rounded-full bg-[var(--panel-border)]/30">
                    <div
                      className={`h-full rounded-full ${
                        e.avgPnl >= 0 ? "bg-emerald-500/50" : "bg-rose-500/50"
                      }`}
                      style={{ width: `${Math.min(e.pct, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 text-right text-[10px] text-[color:var(--muted)]">
                  {e.count} ({e.pct.toFixed(0)}%)
                </span>
                <span className={`w-14 text-right text-[10px] ${pnlTone(e.avgPnl)}`}>
                  avg {formatCompactUsd(e.avgPnl)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────── */

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
      <p className="text-xs text-[color:var(--muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? "text-[var(--foreground)]"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-[color:var(--muted)]">{sub}</p>}
    </div>
  );
}

function MilestoneBar({
  label,
  reached,
  total,
}: {
  label: string;
  reached: number;
  total: number;
}) {
  const pct = total > 0 ? (reached / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-[var(--foreground)]">
          {label}
        </span>
        <span className="text-[10px] text-[color:var(--muted)]">
          {reached}/{total} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel-border)]/30">
        <div
          className="h-full rounded-full bg-[var(--accent)]/50"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

