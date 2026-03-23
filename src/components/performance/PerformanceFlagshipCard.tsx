/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceFlagshipCard.tsx
 *
 * Description:
 * Canonical flagship card for the refactored Performance page. Supports
 * promoted weekly systems and research/provisional placeholders.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

type WeeklyRow = {
  weekOpenUtc: string;
  returnPercent: number;
  pricedTrades: number;
  wins: number;
};

type ComparisonMetrics = {
  label: string;
  returnPct: number | null;
  winRatePct: number | null;
  maxDrawdownPct: number | null;
  trades: number | null;
};

export type PerformanceFlagshipCardData = {
  id: string;
  heading: string;
  strategyName: string;
  sourceLabel: string;
  reason: string;
  statusLabel: string;
  statusTone: "positive" | "neutral" | "warning";
  returnPct: number | null;
  winRatePct: number | null;
  maxDrawdownPct: number | null;
  trades: number | null;
  weeksCovered: number | null;
  weeklyRows: WeeklyRow[];
  comparison?: ComparisonMetrics | null;
};

function formatPercent(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function valueTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-[var(--foreground)]";
  if (value > 0) return "text-emerald-400 dark:text-emerald-300";
  if (value < 0) return "text-rose-400 dark:text-rose-300";
  return "text-[var(--foreground)]";
}

function statusToneClass(tone: PerformanceFlagshipCardData["statusTone"]) {
  if (tone === "positive") {
    return "border-emerald-400/35 bg-emerald-500/10 text-emerald-300";
  }
  if (tone === "warning") {
    return "border-amber-400/35 bg-amber-500/10 text-amber-300";
  }
  return "border-[var(--panel-border)] bg-[var(--panel)]/80 text-[var(--muted)]";
}

function MetricCard({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)]/70 bg-[var(--background)]/20 p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 font-mono text-[var(--foreground)] ${large ? "text-3xl font-bold" : "text-xl font-semibold"}`}>
        {value}
      </div>
    </div>
  );
}

export default function PerformanceFlagshipCard({
  data,
}: {
  data: PerformanceFlagshipCardData;
}) {
  return (
    <section
      id={data.id}
      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-5 transition-all duration-200 hover:border-[var(--accent)]/40"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              {data.heading}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {data.strategyName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
              {data.reason}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${statusToneClass(
              data.statusTone,
            )}`}
          >
            {data.statusLabel}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--panel-border)]/70 bg-[var(--background)]/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Simple Return
            </div>
            <div className={`mt-2 text-3xl font-bold ${valueTone(data.returnPct)} font-mono`}>
              {formatPercent(data.returnPct)}
            </div>
          </div>
          <MetricCard label="Weekly Win" value={formatPercent(data.winRatePct)} />
          <MetricCard label="Max DD" value={formatPercent(data.maxDrawdownPct)} />
          <div className="rounded-2xl border border-[var(--panel-border)]/70 bg-[var(--background)]/20 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Trades
                </div>
                <div className="mt-2 text-xl font-semibold font-mono text-[var(--foreground)]">
                  {typeof data.trades === "number" ? data.trades : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Weeks
                </div>
                <div className="mt-2 text-xl font-semibold font-mono text-[var(--foreground)]">
                  {typeof data.weeksCovered === "number" ? data.weeksCovered : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-[var(--panel-border)]/70 bg-[var(--background)]/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Source
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--foreground)]/88">
              {data.sourceLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)]/70 bg-[var(--background)]/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Comparison
            </div>
            {data.comparison ? (
              <div className="mt-3 space-y-2 text-sm text-[var(--foreground)]/88">
                <div className="font-semibold text-[var(--foreground)]">{data.comparison.label}</div>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div>Return {formatPercent(data.comparison.returnPct)}</div>
                  <div>Win {formatPercent(data.comparison.winRatePct)}</div>
                  <div>DD {formatPercent(data.comparison.maxDrawdownPct)}</div>
                  <div>Trades {typeof data.comparison.trades === "number" ? data.comparison.trades : "—"}</div>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                No comparison series is promoted for this card yet.
              </div>
            )}
          </div>
        </div>

        <details className="rounded-2xl border border-[var(--panel-border)]/70 bg-[var(--background)]/20 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--foreground)]">
            Weekly Breakdown
          </summary>
          <div className="mt-4 overflow-x-auto">
            {data.weeklyRows.length === 0 ? (
              <div className="text-sm text-[color:var(--muted)]">
                Weekly canonical breakdown is not available for this surface yet.
              </div>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  <tr>
                    <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Week</th>
                    <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Return</th>
                    <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Trades</th>
                    <th className="border-b border-[var(--panel-border)]/30 px-3 py-2">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeklyRows.map((row) => (
                    <tr key={row.weekOpenUtc} className="odd:bg-[var(--background)]/10">
                      <td className="border-b border-[var(--panel-border)]/20 px-3 py-2 font-mono text-[var(--foreground)]/90">
                        {row.weekOpenUtc.slice(0, 10)}
                      </td>
                      <td className={`border-b border-[var(--panel-border)]/20 px-3 py-2 font-mono ${valueTone(row.returnPercent)}`}>
                        {formatPercent(row.returnPercent)}
                      </td>
                      <td className="border-b border-[var(--panel-border)]/20 px-3 py-2 font-mono text-[var(--foreground)]/90">
                        {row.pricedTrades}
                      </td>
                      <td className="border-b border-[var(--panel-border)]/20 px-3 py-2 font-mono text-[var(--foreground)]/90">
                        {row.wins}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
