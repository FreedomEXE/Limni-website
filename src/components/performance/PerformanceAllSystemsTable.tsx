/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceAllSystemsTable.tsx
 *
 * Description:
 * Canonical comparison table for composite systems and standalone model
 * rows. Baseline and gated metrics are shown side-by-side.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

type SystemMetrics = {
  returnPct: number | null;
  winRatePct: number | null;
  maxDrawdownPct: number | null;
  trades: number | null;
  weeks: number | null;
};

export type PerformanceSystemComparisonRow = {
  id: string;
  strategyName: string;
  familyLabel: string;
  promoted?: boolean;
  baseline: SystemMetrics | null;
  gated: SystemMetrics | null;
};

function formatPercent(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function deltaTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-[var(--foreground)]";
  if (value > 0) return "text-emerald-400 dark:text-emerald-300";
  if (value < 0) return "text-rose-400 dark:text-rose-300";
  return "text-[var(--foreground)]";
}

function renderMetricCell(value: string, tone?: string) {
  return (
    <td className={`border-b border-[var(--panel-border)]/20 px-3 py-3 font-mono ${tone ?? "text-[var(--foreground)]"}`}>
      {value}
    </td>
  );
}

export default function PerformanceAllSystemsTable({
  rows,
  id = "all-systems",
  title = "All Systems",
  description,
}: {
  rows: PerformanceSystemComparisonRow[];
  id?: string;
  title?: string;
  description?: string;
}) {
  return (
    <details id={id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-5">
      <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--foreground)]">
        {title}
      </summary>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        {description ?? "Canonical comparison across baseline and gated system variants."}
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
            <tr>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Strategy</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Base Ret</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Base Win</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Base DD</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Base Trd</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Gated Ret</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Gated Win</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Gated DD</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Gated Trd</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Delta Ret</th>
              <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Weeks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const deltaReturn =
                row.gated?.returnPct !== null
                  && row.gated?.returnPct !== undefined
                  && row.baseline?.returnPct !== null
                  && row.baseline?.returnPct !== undefined
                  ? row.gated.returnPct - row.baseline.returnPct
                  : null;
              const weeks = row.gated?.weeks ?? row.baseline?.weeks ?? null;

              return (
                <tr key={row.id} className="odd:bg-[var(--background)]/10">
                  <td className="border-b border-[var(--panel-border)]/20 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-[var(--foreground)]">{row.strategyName}</div>
                      {row.promoted ? (
                        <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                          Flagship
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">
                      {row.familyLabel}
                    </div>
                  </td>
                  {renderMetricCell(formatPercent(row.baseline?.returnPct ?? null))}
                  {renderMetricCell(formatPercent(row.baseline?.winRatePct ?? null))}
                  {renderMetricCell(formatPercent(row.baseline?.maxDrawdownPct ?? null))}
                  {renderMetricCell(
                    typeof row.baseline?.trades === "number" ? String(row.baseline.trades) : "—",
                  )}
                  {renderMetricCell(formatPercent(row.gated?.returnPct ?? null))}
                  {renderMetricCell(formatPercent(row.gated?.winRatePct ?? null))}
                  {renderMetricCell(formatPercent(row.gated?.maxDrawdownPct ?? null))}
                  {renderMetricCell(
                    typeof row.gated?.trades === "number" ? String(row.gated.trades) : "—",
                  )}
                  {renderMetricCell(formatPercent(deltaReturn), deltaTone(deltaReturn))}
                  {renderMetricCell(typeof weeks === "number" ? String(weeks) : "—")}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
