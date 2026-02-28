/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: StrategyPerformanceSummary.tsx
 *
 * Description:
 * Lightweight strategy performance cards for the main Performance page.
 * Shows aggregated bot performance with links to full dashboards.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Link from "next/link";

export type StrategyMarket = "crypto_futures" | "mt5_forex";

export type StrategySummary = {
  market: StrategyMarket;
  name: string;
  href: string;
  totalTrades: number;
  wins: number;
  totalPnlUsd: number;
  maxDrawdownPct: number | null;
  status: "LIVE" | "BACKTEST" | "OFFLINE";
};

type StrategyPerformanceSummaryProps = {
  strategies: StrategySummary[];
};

function statusTone(status: StrategySummary["status"]) {
  switch (status) {
    case "LIVE":
      return "border-emerald-300/40 bg-emerald-500/10 text-emerald-200";
    case "BACKTEST":
      return "border-amber-300/40 bg-amber-500/10 text-amber-200";
    case "OFFLINE":
      return "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]";
  }
}

function pnlColor(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-[color:var(--muted)]";
}

function formatUsd(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function StrategyPerformanceSummary({
  strategies,
}: StrategyPerformanceSummaryProps) {
  if (strategies.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Bot Strategy Performance
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {strategies.map((strategy) => {
          const winRate =
            strategy.totalTrades > 0
              ? `${((strategy.wins / strategy.totalTrades) * 100).toFixed(1)}%`
              : "—";

          return (
            <Link
              key={strategy.name}
              href={strategy.href}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {strategy.name}
                </h3>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${statusTone(strategy.status)}`}
                >
                  {strategy.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
                <div>
                  <p className="text-[color:var(--muted)]">Total PnL</p>
                  <p className={`font-semibold ${pnlColor(strategy.totalPnlUsd)}`}>
                    {strategy.totalPnlUsd >= 0 ? "+" : ""}
                    {formatUsd(strategy.totalPnlUsd)}
                  </p>
                </div>
                <div>
                  <p className="text-[color:var(--muted)]">Win Rate</p>
                  <p className="font-semibold text-[var(--foreground)]">
                    {winRate}
                  </p>
                </div>
                <div>
                  <p className="text-[color:var(--muted)]">Trades</p>
                  <p className="font-semibold text-[var(--foreground)]">
                    {strategy.totalTrades}
                  </p>
                </div>
                <div>
                  <p className="text-[color:var(--muted)]">Max DD</p>
                  <p className="font-semibold text-[var(--foreground)]">
                    {strategy.maxDrawdownPct !== null
                      ? `${strategy.maxDrawdownPct.toFixed(2)}%`
                      : "—"}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
