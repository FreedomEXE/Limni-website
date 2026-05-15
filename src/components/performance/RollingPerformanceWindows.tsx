/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: RollingPerformanceWindows.tsx
 *
 * Description:
 * Displays trailing 4/8/12-week rolling performance windows showing
 * return, max drawdown, and Sharpe ratio for each window. Gives a
 * quick read on recent momentum vs. all-time stats.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

const WINDOWS = [4, 8, 12] as const;

type WeekReturn = {
  weekOpenUtc: string;
  returnPct: number;
};

type WindowStats = {
  weeks: number;
  returnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
};

function computeWindowStats(returns: number[]): WindowStats {
  const totalReturn = returns.reduce((s, r) => s + r, 0);

  let peak = 0;
  let equity = 0;
  let maxDD = 0;
  for (const r of returns) {
    equity += r;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    maxDD = Math.max(maxDD, dd);
  }

  let sharpe = 0;
  if (returns.length > 1) {
    const avg = totalReturn / returns.length;
    const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? avg / std : 0;
  }

  return {
    weeks: returns.length,
    returnPct: totalReturn,
    maxDrawdownPct: maxDD,
    sharpe,
  };
}

export default function RollingPerformanceWindows({ weeks }: { weeks: WeekReturn[] }) {
  if (weeks.length < WINDOWS[0]) return null;

  const sorted = [...weeks].sort((a, b) => a.weekOpenUtc.localeCompare(b.weekOpenUtc));
  const returns = sorted.map((w) => w.returnPct);

  const windows = WINDOWS
    .filter((size) => returns.length >= size)
    .map((size) => ({
      size,
      stats: computeWindowStats(returns.slice(-size)),
    }));

  if (windows.length === 0) return null;

  const returnColor = (v: number) => (v >= 0 ? "text-lime-400" : "text-red-400");

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Rolling Windows
      </h3>
      <div className="grid gap-3 md:grid-cols-3">
        {windows.map(({ size, stats }) => (
          <div
            key={size}
            className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/50 p-3"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
              Last {size} Weeks
            </div>
            <div className={`mt-1.5 text-xl font-bold ${returnColor(stats.returnPct)}`}>
              {stats.returnPct >= 0 ? "+" : ""}
              {stats.returnPct.toFixed(2)}%
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                  Max DD
                </div>
                <div className="font-bold text-red-400">{stats.maxDrawdownPct.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                  Sharpe
                </div>
                <div className="font-bold">{stats.sharpe.toFixed(2)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
