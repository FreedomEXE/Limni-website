/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: CorrelationTab.tsx
 *
 * Description:
 * FX correlation heatmap for Katarakti — displays self-computed
 * rolling Pearson correlation matrix across all tracked pairs.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useMemo } from "react";
import {
  toNumber,
  toIsoString,
  type CorrelationMatrixRow,
} from "@/components/mt5-forex-lite/types";
import { formatDateTimeET } from "@/lib/time";

type CorrelationTabProps = {
  correlationMatrix: CorrelationMatrixRow[];
};

function corrTone(value: number): string {
  if (value >= 0.7) return "bg-emerald-500/70 text-white";
  if (value >= 0.4) return "bg-emerald-500/30 text-emerald-200";
  if (value >= 0.1) return "bg-emerald-500/10 text-emerald-300/70";
  if (value > -0.1) return "bg-[var(--panel)]/50 text-[color:var(--muted)]";
  if (value > -0.4) return "bg-rose-500/10 text-rose-300/70";
  if (value > -0.7) return "bg-rose-500/30 text-rose-200";
  return "bg-rose-500/70 text-white";
}

export default function CorrelationTab({
  correlationMatrix,
}: CorrelationTabProps) {
  const { symbols, grid, computedAt } = useMemo(() => {
    const symSet = new Set<string>();
    const pairMap = new Map<string, number>();
    let latestComputedMs = Number.NEGATIVE_INFINITY;
    let latestComputedAt: string | null = null;

    for (const row of correlationMatrix) {
      symSet.add(row.symbol_a);
      symSet.add(row.symbol_b);
      const corr = toNumber(row.correlation) ?? 0;
      pairMap.set(`${row.symbol_a}:${row.symbol_b}`, corr);
      pairMap.set(`${row.symbol_b}:${row.symbol_a}`, corr);

      const computedAtIso = toIsoString(row.computed_at);
      if (!computedAtIso) continue;
      const computedMs = Date.parse(computedAtIso);
      if (Number.isFinite(computedMs) && computedMs >= latestComputedMs) {
        latestComputedMs = computedMs;
        latestComputedAt = computedAtIso;
      } else if (!Number.isFinite(computedMs) && latestComputedAt === null) {
        latestComputedAt = computedAtIso;
      }
    }

    const sortedSymbols = Array.from(symSet).sort();

    const gridData: number[][] = sortedSymbols.map((rowSym) =>
      sortedSymbols.map((colSym) => {
        if (rowSym === colSym) return 1;
        return pairMap.get(`${rowSym}:${colSym}`) ?? 0;
      }),
    );

    return { symbols: sortedSymbols, grid: gridData, computedAt: latestComputedAt };
  }, [correlationMatrix]);

  if (symbols.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6">
        <p className="text-center text-xs text-[color:var(--muted)]">
          No correlation data available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          FX Pair Correlation Matrix
        </h3>
        {computedAt && (
          <span className="text-xs text-[color:var(--muted)]">
            Computed: {formatDateTimeET(computedAt)}
          </span>
        )}
      </div>

      <div className="overflow-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]">
        <table className="text-[10px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-[var(--panel)] px-2 py-1" />
              {symbols.map((sym) => (
                <th
                  key={sym}
                  className="px-1 py-1 text-center font-medium text-[color:var(--muted)]"
                  style={{ writingMode: "vertical-rl", minWidth: "28px" }}
                >
                  {sym}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((rowSym, rowIdx) => (
              <tr key={rowSym}>
                <td className="sticky left-0 z-10 bg-[var(--panel)] px-2 py-1 font-medium text-[var(--foreground)]">
                  {rowSym}
                </td>
                {grid[rowIdx].map((corr, colIdx) => (
                  <td
                    key={symbols[colIdx]}
                    className={`px-1 py-1 text-center font-mono ${corrTone(corr)}`}
                    title={`${rowSym} / ${symbols[colIdx]}: ${corr.toFixed(3)}`}
                  >
                    {rowIdx === colIdx ? "" : corr.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-[color:var(--muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-500/70" /> ≥0.70
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-500/30" /> 0.40–0.69
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[var(--panel)]/80 border border-[var(--panel-border)]" /> ~0
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-rose-500/30" /> -0.40–-0.69
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-rose-500/70" /> ≤-0.70
        </span>
      </div>
    </div>
  );
}

