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

type DailyCell = {
  dateKey: string;
  dayLabel: string;
  returnPct: number;
  maxDrawdownPct: number;
  activePositions: number;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function isWeekendPoint(tsUtc: string): boolean {
  const d = new Date(tsUtc);
  const day = d.getUTCDay();
  if (day === 6) return true;
  if (day === 0 && d.getUTCHours() < 21) return true;
  return false;
}

function filterMarketHours(points: PerformanceSimulationSeries["points"]) {
  const now = Date.now();
  const filtered = points.filter((point) => !isWeekendPoint(point.ts_utc) && new Date(point.ts_utc).getTime() <= now);
  if (filtered.length > 0) return filtered;
  const pastPoints = points.filter((point) => new Date(point.ts_utc).getTime() <= now);
  if (pastPoints.length > 0) return pastPoints;
  return points.length > 0 ? [points[0]] : [];
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function buildDailyCells(series: PerformanceSimulationSeries): DailyCell[] {
  const groups = new Map<string, PerformanceSimulationSeries["points"]>();
  for (const point of filterMarketHours(series.points)) {
    const dateKey = point.ts_utc.slice(0, 10);
    const label = formatDayLabel(dateKey);
    if (!WEEKDAYS.includes(label)) continue;
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(point);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, points]) => {
      const ordered = [...points].sort((left, right) => Date.parse(left.ts_utc) - Date.parse(right.ts_utc));
      const first = ordered[0];
      const last = ordered.at(-1);
      const drawdowns = ordered
        .map((point) => point.drawdown_pct)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      return {
        dateKey,
        dayLabel: formatDayLabel(dateKey),
        returnPct: first && last ? last.equity_pct - first.equity_pct : 0,
        maxDrawdownPct: drawdowns.length > 0 ? Math.abs(Math.min(...drawdowns)) : 0,
        activePositions: last?.active_positions ?? 0,
      };
    });
}

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
  const cells = buildDailyCells(series);
  if (cells.length === 0) return null;
  const cellsByDay = new Map(cells.map((cell) => [cell.dayLabel, cell]));
  const maxAbs = Math.max(...cells.map((cell) => Math.abs(cell.returnPct)), 0.01);

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Daily Returns
      </h3>
      <div className="grid gap-2 md:grid-cols-5">
        {WEEKDAYS.map((dayLabel) => {
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
              <div className={`mt-2 text-xl font-semibold ${!cell || cell.returnPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
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
