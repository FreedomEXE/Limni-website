/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MonthlyReturnsHeatmap.tsx
 *
 * Description:
 * MyFXBook-style monthly returns grid. Aggregates weekly returns into
 * month buckets and renders a Year × Month heatmap with color intensity.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type WeekReturn = {
  weekOpenUtc: string;
  returnPct: number;
};

type MonthCell = {
  returnPct: number;
  weekCount: number;
};

function aggregateToMonths(weeks: WeekReturn[]): Map<string, MonthCell> {
  const map = new Map<string, MonthCell>();
  for (const week of weeks) {
    const d = new Date(week.weekOpenUtc);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const existing = map.get(key);
    if (existing) {
      existing.returnPct += week.returnPct;
      existing.weekCount += 1;
    } else {
      map.set(key, { returnPct: week.returnPct, weekCount: 1 });
    }
  }
  return map;
}

function cellColor(returnPct: number, maxAbs: number): string {
  if (maxAbs === 0) return "rgba(148,163,184,0.08)";
  const intensity = Math.min(Math.abs(returnPct) / maxAbs, 1);
  const alpha = 0.1 + intensity * 0.5;
  return returnPct >= 0
    ? `rgba(16,185,129,${alpha.toFixed(2)})`
    : `rgba(244,63,94,${alpha.toFixed(2)})`;
}

export default function MonthlyReturnsHeatmap({ weeks }: { weeks: WeekReturn[] }) {
  if (weeks.length === 0) return null;

  const monthMap = aggregateToMonths(weeks);
  const years = [...new Set(weeks.map((w) => new Date(w.weekOpenUtc).getUTCFullYear()))].sort();
  const maxAbs = Math.max(
    ...Array.from(monthMap.values()).map((c) => Math.abs(c.returnPct)),
    0.01,
  );

  const yearTotals = new Map<number, number>();
  for (const year of years) {
    let total = 0;
    for (let month = 0; month < 12; month += 1) {
      const cell = monthMap.get(`${year}-${month}`);
      if (cell) total += cell.returnPct;
    }
    yearTotals.set(year, total);
  }

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Monthly Returns
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-1 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Year
              </th>
              {MONTH_LABELS.map((m) => (
                <th
                  key={m}
                  className="px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]"
                >
                  {m}
                </th>
              ))}
              <th className="px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const yearTotal = yearTotals.get(year) ?? 0;
              return (
                <tr key={year}>
                  <td className="px-1 py-1 text-[11px] font-bold text-[var(--foreground)]">
                    {year}
                  </td>
                  {Array.from({ length: 12 }, (_, month) => {
                    const cell = monthMap.get(`${year}-${month}`);
                    if (!cell) {
                      return (
                        <td key={month} className="px-0.5 py-0.5">
                          <div className="rounded-md px-1 py-1.5 text-center text-[color:var(--muted)]">
                            —
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={month} className="px-0.5 py-0.5">
                        <div
                          className="rounded-md px-1 py-1.5 text-center font-semibold"
                          style={{ backgroundColor: cellColor(cell.returnPct, maxAbs) }}
                          title={`${MONTH_LABELS[month]} ${year}: ${cell.returnPct >= 0 ? "+" : ""}${cell.returnPct.toFixed(2)}% (${cell.weekCount} weeks)`}
                        >
                          <span className={cell.returnPct >= 0 ? "text-lime-400" : "text-red-400"}>
                            {cell.returnPct >= 0 ? "+" : ""}{cell.returnPct.toFixed(1)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-0.5 py-0.5">
                    <div
                      className="rounded-md px-1 py-1.5 text-center font-bold"
                      style={{ backgroundColor: cellColor(yearTotal, maxAbs) }}
                    >
                      <span className={yearTotal >= 0 ? "text-lime-400" : "text-red-400"}>
                        {yearTotal >= 0 ? "+" : ""}{yearTotal.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
