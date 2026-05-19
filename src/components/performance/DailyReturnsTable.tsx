/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: DailyReturnsTable.tsx
 *
 * Description:
 * Compact week-view daily returns table derived from a simulation equity curve.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import type { PerformanceSimulationSeries } from "@/components/performance/PerformanceSimulationSection";
import { buildDailySimulationReturns, WEEKDAY_LABELS } from "@/components/performance/dailySimulationReturns";

function cellColor(returnPct: number, maxAbs: number) {
  if (maxAbs <= 0) return "rgba(148,163,184,0.08)";
  const intensity = Math.min(Math.abs(returnPct) / maxAbs, 1);
  const alpha = 0.1 + intensity * 0.5;
  return returnPct >= 0
    ? `rgba(16,185,129,${alpha.toFixed(2)})`
    : `rgba(244,63,94,${alpha.toFixed(2)})`;
}

export default function DailyReturnsTable({
  series,
}: {
  series: PerformanceSimulationSeries;
}) {
  const cells = buildDailySimulationReturns(series);
  if (cells.length === 0) return null;
  const cellsByDay = new Map(cells.map((cell) => [cell.dayLabel, cell]));
  const maxAbs = Math.max(...cells.map((cell) => Math.abs(cell.returnPct)), 0.01);

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Daily Returns
      </h3>
      <div className="grid gap-2 md:grid-cols-5">
        {WEEKDAY_LABELS.map((dayLabel) => {
          const cell = cellsByDay.get(dayLabel);
          return (
            <div
              key={dayLabel}
              className="rounded-xl border border-[var(--panel-border)] p-3"
              style={cell ? { backgroundColor: cellColor(cell.returnPct, maxAbs) } : undefined}
              title={cell ? `${cell.dateKey}: DD ${cell.maxDrawdownPct.toFixed(2)}%, active ${cell.activePositions}` : undefined}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                {dayLabel}
              </div>
              <div className={`mt-2 text-xl font-semibold ${!cell ? "text-[color:var(--muted)]" : cell.returnPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
                {cell ? `${cell.returnPct >= 0 ? "+" : ""}${cell.returnPct.toFixed(2)}%` : "-"}
              </div>
              {cell ? (
                <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
                  DD {cell.maxDrawdownPct.toFixed(2)}% - Active {cell.activePositions}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
