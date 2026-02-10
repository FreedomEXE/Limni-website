import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import WeekSelector from "@/components/accounts/WeekSelector";
import QueryBuilder from "@/components/filters/QueryBuilder";
import KpiGroup from "@/components/metrics/KpiGroup";
import KpiCard from "@/components/metrics/KpiCard";
import DebugReadout from "@/components/DebugReadout";
import { buildSymbolResearchSummary } from "@/lib/universalBasket";
import type { PerformanceModel } from "@/lib/performanceLab";
import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import { formatDateTimeET } from "@/lib/time";
import { unstable_cache } from "next/cache";
import { getWeekOpenUtc } from "@/lib/performanceSnapshots";
import {
  buildWeekOptionsFromCurve,
  computeMaxDrawdown,
  pickParam,
  pickParams,
} from "@/lib/research/common";

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
  const modelParam = pickParam(params?.model);
  const weekParam = pickParam(params?.week);
  const modeParam = pickParam(params?.mode);
  const selectedSymbolsRaw = pickParams(params?.symbols);

  const selectedModel =
    modelParam && MODEL_OPTIONS.some((item) => item.value === modelParam)
      ? (modelParam as "all" | PerformanceModel)
      : "all";

  const getSummary = unstable_cache(
    async (model: "all" | PerformanceModel) =>
      buildSymbolResearchSummary({
        modelFilter: model,
        includeCurrentWeek: false,
        limitWeeks: 8,
      }),
    [`research-symbols-m1-8w-${selectedModel}`],
    { revalidate: 900 },
  );

  const [summaryAll, summaryA, summaryB, summaryD, summaryC, summaryS] = await Promise.all([
    getSummary(selectedModel),
    getSummary("antikythera"),
    getSummary("blended"),
    getSummary("dealer"),
    getSummary("commercial"),
    getSummary("sentiment"),
  ]);

  const summary = summaryAll;
  const currentWeekOpenUtc = getWeekOpenUtc();
  const weekOptions = buildWeekOptionsFromCurve(summary.equity_curve);
  const selectedWeek =
    weekParam && weekOptions.some((option) => option.value === weekParam)
      ? weekParam
      : (weekOptions[0]?.value ?? null);

  const rowWeekPercent = (row: (typeof summary.rows)[number]) =>
    row.weekly.find((item) => item.week_open_utc === selectedWeek)?.percent ?? 0;
  const displayRows = [...summary.rows].sort((a, b) => rowWeekPercent(b) - rowWeekPercent(a));
  const topSymbols = new Set(displayRows.slice(0, 3).map((row) => row.symbol));
  const bottomSymbols = new Set(displayRows.slice(-3).map((row) => row.symbol));

  const selectedSymbols = selectedSymbolsRaw.filter((symbol) => displayRows.some((row) => row.symbol === symbol));
  const selectedSet = new Set(selectedSymbols);
  const symbolsForChart = selectedSymbols.length > 0 ? selectedSet : null;

  const buildCurveForSummary = (modelSummary: typeof summary) => {
    const points = weekOptions
      .map((option) => ({
        ts_utc: option.value,
        equity_pct: modelSummary.rows.reduce((sum, row) => {
          if (symbolsForChart && !symbolsForChart.has(row.symbol)) return sum;
          return sum + (row.weekly.find((item) => item.week_open_utc === option.value)?.percent ?? 0);
        }, 0),
        lock_pct: null,
      }))
      .reverse();
    return points;
  };

  const series =
    selectedModel === "all"
      ? [
          { id: "antikythera", label: "Antikythera", points: buildCurveForSummary(summaryA) },
          { id: "blended", label: "Blended", points: buildCurveForSummary(summaryB) },
          { id: "dealer", label: "Dealer", points: buildCurveForSummary(summaryD) },
          { id: "commercial", label: "Commercial", points: buildCurveForSummary(summaryC) },
          { id: "sentiment", label: "Sentiment", points: buildCurveForSummary(summaryS) },
        ]
      : [{ id: selectedModel, label: selectedModel, points: buildCurveForSummary(summary) }];

  const chartDd = Math.max(...series.map((row) => computeMaxDrawdown(row.points)));
  const selectedMode = modeParam === "isolate" ? "isolate" : "compare";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Research</h1>
        </header>

        <section
          data-cot-surface="true"
          className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Per-Symbol Breakdown</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Select one or multiple symbols. One chart overlays model lines when all models are selected.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <WeekSelector
              weekOptions={weekOptions.map((option) => option.value)}
              currentWeek={currentWeekOpenUtc}
              selectedWeek={selectedWeek ?? ""}
            />
            <DebugReadout
              items={[
                { label: "Scope", value: "research:symbols" },
                { label: "Window", value: selectedWeek ?? "--" },
                { label: "Series", value: "equity_curve" },
              ]}
            />
          </div>

          <div className="mt-4">
            <QueryBuilder
              title="Analysis query"
              mode={selectedMode}
              weekParam={selectedWeek}
              sections={[
                {
                  label: "Models",
                  paramKey: "model",
                  options: MODEL_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                  selected: selectedModel ? [selectedModel] : [],
                  multiple: false,
                },
                {
                  label: "Symbols",
                  paramKey: "symbols",
                  options: displayRows.map((row) => ({ value: row.symbol, label: row.symbol })),
                  selected: selectedSymbols,
                  multiple: true,
                },
              ]}
            />
          </div>

          <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Updated {formatDateTimeET(summary.generated_at)}
          </div>

          <div className="mt-6 space-y-6">
            <KpiGroup title="Performance" description="Headline performance stats for selected filters.">
              <KpiCard label="Total %" value={`${summary.total_percent.toFixed(2)}%`} emphasis="primary" />
              <KpiCard label="Weeks" value={`${summary.weeks}`} />
              <KpiCard label="Symbols" value={`${summary.rows.length}`} />
            </KpiGroup>
            <KpiGroup title="Risk" description="Drawdown and exposure context for the chart.">
              <KpiCard label="Chart DD %" value={`${chartDd.toFixed(2)}%`} tone="negative" />
              <KpiCard label="Trades" value={`${summary.priced_trades}/${summary.total_trades}`} />
              <KpiCard
                label="Focused week"
                value={selectedWeek ? weekLabelFromOpen(selectedWeek).replace("Week of ", "") : "--"}
              />
            </KpiGroup>
          </div>

          <div className="mt-6">
            <EquityCurveChart
              title={
                selectedSymbols.length > 0
                  ? `Selected symbols (${selectedSymbols.join(", ")})`
                  : "All symbols"
              }
              series={series}
              interactive
            />
          </div>

          <div className="mt-6 max-h-96 overflow-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
            <table className="w-full text-left text-sm text-[var(--foreground)]">
              <thead className="sticky top-0 bg-[var(--panel)]/95 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
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
                {displayRows.map((row) => {
                  const isTop = topSymbols.has(row.symbol);
                  const isBottom = bottomSymbols.has(row.symbol);
                  return (
                  <tr
                    key={row.symbol}
                    className={`border-t border-[var(--panel-border)]/60 ${
                      isTop ? "bg-emerald-50/60" : isBottom ? "bg-rose-50/60" : ""
                    }`}
                  >
                    <td className="py-2">
                      <Link
                        href={`/automation/research/symbols?model=${selectedModel}&week=${selectedWeek ?? ""}&symbols=${encodeURIComponent(row.symbol)}`}
                        className="font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="py-2 text-right">{row.total_percent.toFixed(2)}%</td>
                    <td className="py-2 text-right">{rowWeekPercent(row).toFixed(2)}%</td>
                    <td className="py-2 text-right">{row.avg_percent.toFixed(2)}%</td>
                    <td className="py-2 text-right">{row.win_rate.toFixed(0)}%</td>
                    <td className="py-2 text-right">
                      {row.priced_trades}/{row.trades}
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
