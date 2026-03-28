/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AdrStatsBar.tsx
 *
 * Description:
 * Shared ADR forward test stats bar used by both CFD and Crypto matrix boards.
 * Shows: ADR Trades, TP Hits, Losses, Active (current week only), Week Return.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useState } from "react";

export type AdrStatsBarProps = {
  totalTrades: number;
  totalTpHits: number;
  totalActive: number;
  totalLosses: number;
  weekReturnPct: number;
  longPairs: string[];
  shortPairs: string[];
  isPastWeek?: boolean;
};

export default function AdrStatsBar({
  totalTrades,
  totalTpHits,
  totalActive,
  totalLosses,
  weekReturnPct,
  longPairs,
  shortPairs,
  isPastWeek = false,
}: AdrStatsBarProps) {
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const winPct = totalTrades > 0 ? ((totalTpHits / totalTrades) * 100).toFixed(0) : "0";
  const longList = longPairs.join(",");
  const shortList = shortPairs.join(",");

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(`${label} copied!`);
      setTimeout(() => setCopyToast(null), 2000);
    });
  }

  return (
    <>
      <div className={`mb-4 grid gap-3 ${isPastWeek ? "grid-cols-4" : "grid-cols-5"}`}>
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">ADR Trades</div>
          <div className="mt-1 text-xl font-bold text-[var(--foreground)]">{totalTrades}</div>
        </div>
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">TP Hits</div>
          <div className="mt-1 text-xl font-bold text-lime-400">
            {totalTpHits} <span className="text-sm text-[color:var(--muted)]">({winPct}%)</span>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">Losses</div>
          <div className="mt-1 text-xl font-bold text-red-400">{totalLosses}</div>
        </div>
        {!isPastWeek && (
          <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">Active</div>
            <div className="mt-1 text-xl font-bold text-yellow-400">{totalActive}</div>
          </div>
        )}
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">Week Return</div>
          <div className={`mt-1 text-xl font-bold ${weekReturnPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
            {weekReturnPct >= 0 ? "+" : ""}{weekReturnPct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-3">
        <button
          type="button"
          className="rounded border border-lime-500/30 bg-lime-500/10 px-3 py-1.5 text-xs font-semibold text-lime-400 hover:bg-lime-500/20 transition-colors"
          onClick={() => handleCopy(longList, "LONG pairs")}
          title={longList}
        >
          Copy LONG pairs ({longPairs.length})
        </button>
        <button
          type="button"
          className="rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
          onClick={() => handleCopy(shortList, "SHORT pairs")}
          title={shortList}
        >
          Copy SHORT pairs ({shortPairs.length})
        </button>
        {copyToast && (
          <span className="ml-2 rounded bg-lime-500/20 px-2 py-1 text-xs font-semibold text-lime-400 animate-pulse">
            {copyToast}
          </span>
        )}
      </div>
    </>
  );
}
