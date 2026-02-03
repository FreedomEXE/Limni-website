import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import ResearchSectionNav from "@/components/research/ResearchSectionNav";
import { buildSymbolResearchSummary } from "@/lib/universalBasket";
import type { PerformanceModel } from "@/lib/performanceLab";
import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import { formatDateTimeET } from "@/lib/time";
import { unstable_cache } from "next/cache";

export const revalidate = 900;

type PageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

const MODEL_OPTIONS: Array<{ value: "all" | PerformanceModel; label: string }> = [
  { value: "all", label: "All models" },
  { value: "antikythera", label: "Antikythera" },
  { value: "blended", label: "Blended" },
  { value: "dealer", label: "Dealer" },
  { value: "commercial", label: "Commercial" },
  { value: "sentiment", label: "Sentiment" },
];

export default async function SymbolResearchPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const modelParam = params?.model;
  const symbolParam = params?.symbol;
  const weekParam = params?.week;
  const selectedModel =
    typeof modelParam === "string" &&
    MODEL_OPTIONS.some((item) => item.value === modelParam)
      ? (modelParam as "all" | PerformanceModel)
      : "all";

  const getSymbolSummary = unstable_cache(
    async (modelFilter: "all" | PerformanceModel) =>
      buildSymbolResearchSummary({
        modelFilter,
        includeCurrentWeek: false,
        limitWeeks: 8,
      }),
    [`research-symbols-m1-8w-${selectedModel}`],
    { revalidate: 900 },
  );
  const summary = await getSymbolSummary(selectedModel);
  const weekOptions = summary.equity_curve
    .map((point) => point.ts_utc)
    .slice()
    .reverse()
    .map((week) => ({ value: week, label: weekLabelFromOpen(week) }));
  const selectedWeekRaw = typeof weekParam === "string" ? weekParam : Array.isArray(weekParam) ? weekParam[0] : undefined;
  const selectedWeek =
    selectedWeekRaw && weekOptions.some((option) => option.value === selectedWeekRaw)
      ? selectedWeekRaw
      : (weekOptions[0]?.value ?? null);

  const rowWeekPercent = (symbol: string) => {
    const row = summary.rows.find((item) => item.symbol === symbol);
    if (!row || !selectedWeek) {
      return 0;
    }
    return row.weekly.find((item) => item.week_open_utc === selectedWeek)?.percent ?? 0;
  };

  const displayRows = [...summary.rows].sort((a, b) => {
    if (!selectedWeek) {
      return Math.abs(b.total_percent) - Math.abs(a.total_percent);
    }
    return rowWeekPercent(b.symbol) - rowWeekPercent(a.symbol);
  });

  const selectedSymbol =
    typeof symbolParam === "string" && displayRows.some((row) => row.symbol === symbolParam)
      ? symbolParam
      : displayRows[0]?.symbol ?? null;
  const symbolRow = selectedSymbol
    ? displayRows.find((row) => row.symbol === selectedSymbol) ?? null
    : null;
  const symbolCurve = symbolRow
    ? symbolRow.weekly.map((row) => ({
        ts_utc: row.week_open_utc,
        equity_pct: row.percent,
        lock_pct: null,
      }))
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Research</h1>
          <ResearchSectionNav />
        </header>

        <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Per-Symbol Breakdown</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Analyze universal behavior at symbol level before changing EA/backtest logic.
              </p>
            </div>
            <form action="/automation/research/symbols" method="get" className="flex items-center gap-2">
              <select
                name="model"
                defaultValue={selectedModel}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-sm text-[var(--foreground)]"
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                name="week"
                defaultValue={selectedWeek ?? undefined}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-sm text-[var(--foreground)]"
              >
                {weekOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--accent-strong)]"
              >
                Apply
              </button>
            </form>
          </div>

          <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Updated {formatDateTimeET(summary.generated_at)}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Metric label="Weeks" value={`${summary.weeks}`} />
            <Metric label="Symbols" value={`${summary.rows.length}`} />
            <Metric label="Trades" value={`${summary.priced_trades}/${summary.total_trades}`} />
            <Metric label="Total %" value={`${summary.total_percent.toFixed(2)}%`} />
            <Metric label="Focused week" value={selectedWeek ? weekLabelFromOpen(selectedWeek).replace("Week of ", "") : "--"} />
          </div>

          <div className="mt-6">
            <EquityCurveChart
              title={`Cumulative by week (${selectedModel === "all" ? "all models" : selectedModel})`}
              points={summary.equity_curve}
            />
          </div>

          {symbolRow ? (
            <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Selected symbol: {symbolRow.symbol}
                </h3>
                <div className="text-xs text-[color:var(--muted)]">
                  Assets: {symbolRow.asset_classes.join(", ")} | Models: {symbolRow.models.join(", ")}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <Metric label="Total %" value={`${symbolRow.total_percent.toFixed(2)}%`} />
                <Metric label="Avg/trade %" value={`${symbolRow.avg_percent.toFixed(2)}%`} />
                <Metric label="Win rate" value={`${symbolRow.win_rate.toFixed(0)}%`} />
                <Metric label="Best trade" value={`${(symbolRow.best_trade_percent ?? 0).toFixed(2)}%`} />
                <Metric label="Worst trade" value={`${(symbolRow.worst_trade_percent ?? 0).toFixed(2)}%`} />
                <Metric
                  label="Selected week %"
                  value={`${(
                    symbolRow.weekly.find((item) => item.week_open_utc === selectedWeek)?.percent ?? 0
                  ).toFixed(2)}%`}
                />
              </div>
              <div className="mt-4">
                <EquityCurveChart title={`${symbolRow.symbol} weekly returns`} points={symbolCurve} />
              </div>
            </div>
          ) : null}

          <div className="mt-6 max-h-96 overflow-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
            <table className="w-full text-left text-sm text-[var(--foreground)]">
              <thead className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <tr>
                  <th className="py-2">Symbol</th>
                  <th className="py-2 text-right">Total %</th>
                  <th className="py-2 text-right">Week %</th>
                  <th className="py-2 text-right">Avg %</th>
                  <th className="py-2 text-right">Win rate</th>
                  <th className="py-2 text-right">Trades</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={row.symbol} className="border-t border-[var(--panel-border)]/60">
                    <td className="py-2">
                      <Link
                        href={`/automation/research/symbols?model=${selectedModel}&week=${selectedWeek ?? ""}&symbol=${encodeURIComponent(row.symbol)}`}
                        className="font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="py-2 text-right">{row.total_percent.toFixed(2)}%</td>
                    <td className="py-2 text-right">
                      {(row.weekly.find((item) => item.week_open_utc === selectedWeek)?.percent ?? 0).toFixed(2)}%
                    </td>
                    <td className="py-2 text-right">{row.avg_percent.toFixed(2)}%</td>
                    <td className="py-2 text-right">{row.win_rate.toFixed(0)}%</td>
                    <td className="py-2 text-right">
                      {row.priced_trades}/{row.trades}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
