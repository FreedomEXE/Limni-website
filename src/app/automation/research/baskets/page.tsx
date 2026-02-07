import DashboardLayout from "@/components/DashboardLayout";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import ResearchSectionNav from "@/components/research/ResearchSectionNav";
import WeekSelector from "@/components/accounts/WeekSelector";
import QueryBuilder from "@/components/filters/QueryBuilder";
import KpiGroup from "@/components/metrics/KpiGroup";
import KpiCard from "@/components/metrics/KpiCard";
import DebugReadout from "@/components/DebugReadout";
import { buildPerModelBasketSummary } from "@/lib/universalBasket";
import { formatDateTimeET } from "@/lib/time";
import { unstable_cache } from "next/cache";
import { getWeekOpenUtc } from "@/lib/performanceSnapshots";

export const revalidate = 900;

type PageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function maxDrawdown(points: Array<{ equity_pct: number }>) {
  if (points.length === 0) return 0;
  let peak = points[0].equity_pct;
  let maxDd = 0;
  for (const point of points) {
    if (point.equity_pct > peak) peak = point.equity_pct;
    const dd = peak - point.equity_pct;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

export default async function BasketResearchPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const weekParam = pickParam(params?.week);
  const modelParam = pickParam(params?.model);
  const getBasketSummary = unstable_cache(
    async () =>
      buildPerModelBasketSummary({
        timeframe: "M1",
        limitWeeks: 8,
        includeCurrentWeek: false,
        trailStartPct: 10,
        trailOffsetPct: 5,
      }),
    ["research-baskets-m1-8w-10-5"],
    { revalidate: 900 },
  );
  const summary = await getBasketSummary();
  const currentWeekOpenUtc = getWeekOpenUtc();
  const weekLabelMap = new Map<string, string>();
  summary.models.forEach((model) => {
    model.by_week.forEach((row) => {
      if (!weekLabelMap.has(row.week_open_utc)) {
        weekLabelMap.set(row.week_open_utc, row.week_label);
      }
    });
  });
  const weekOptions = Array.from(weekLabelMap.entries()).map(([value, label]) => ({
    value,
    label,
  }));
  const selectedWeek =
    weekParam && weekOptions.some((option) => option.value === weekParam)
      ? weekParam
      : (weekOptions[0]?.value ?? null);
  const modelOptions = summary.models.map((model) => ({
    value: model.model,
    label: model.model_label,
  }));
  const selectedModelKey =
    modelParam && modelOptions.some((option) => option.value === modelParam)
      ? modelParam
      : (modelOptions[0]?.value ?? null);
  const selectedModel = selectedModelKey
    ? summary.models.find((model) => model.model === selectedModelKey) ?? null
    : null;
  const selectedModelWeek =
    selectedModel && selectedWeek
      ? selectedModel.by_week.find((row) => row.week_open_utc === selectedWeek) ?? null
      : null;
  const selectedModelWeekDrawdown = selectedModelWeek
    ? maxDrawdown(selectedModelWeek.equity_curve)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Research</h1>
          <ResearchSectionNav />
        </header>

        <section
          data-cot-surface="true"
          className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Per-Model Basket Simulation
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Each basket is simulated separately using trail start{" "}
                {summary.assumptions.trail_start_pct.toFixed(0)}% and trail offset{" "}
                {summary.assumptions.trail_offset_pct.toFixed(0)}% on minute data.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Updated {formatDateTimeET(summary.generated_at)}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <WeekSelector
              weekOptions={weekOptions.map((option) => option.value)}
              currentWeek={currentWeekOpenUtc}
              selectedWeek={selectedWeek ?? ""}
            />
            <DebugReadout
              items={[
                { label: "Scope", value: "research:baskets" },
                { label: "Window", value: selectedWeek ?? "--" },
                { label: "Series", value: "equity_curve" },
              ]}
            />
          </div>

          <div className="mt-4">
            <QueryBuilder
              title="Basket filters"
              mode={(modelParam as "isolate" | "compare") || "compare"}
              weekParam={selectedWeek}
              sections={[
                {
                  label: "Models",
                  paramKey: "model",
                  options: modelOptions,
                  selected: selectedModelKey ? [selectedModelKey] : [],
                  multiple: false,
                },
              ]}
            />
          </div>

          {selectedModel ? (
            <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
              <KpiGroup title="Performance" description="Selected model performance for the chosen week.">
                <KpiCard label="Basket" value={selectedModel.model_label} />
                <KpiCard
                  label="Raw % (week)"
                  value={`${(selectedModelWeek?.total_percent ?? 0).toFixed(2)}%`}
                />
                <KpiCard
                  label="Locked % (week)"
                  value={`${(selectedModelWeek?.simulated_locked_percent ?? 0).toFixed(2)}%`}
                />
              </KpiGroup>
              <div className="mt-4" />
              <KpiGroup title="Risk" description="Drawdown and trail behavior.">
                <KpiCard
                  label="Peak % (week)"
                  value={`${(selectedModelWeek?.observed_peak_percent ?? 0).toFixed(2)}%`}
                />
                <KpiCard
                  label="Max DD % (week)"
                  value={`${selectedModelWeekDrawdown.toFixed(2)}%`}
                  tone={selectedModelWeekDrawdown > 0 ? "negative" : "neutral"}
                />
                <KpiCard
                  label="Trail hit"
                  value={selectedModelWeek?.trailing_hit ? "Yes" : "No"}
                />
              </KpiGroup>
              <div className="mt-4">
                <EquityCurveChart
                  title={`${selectedModel.model_label} ${selectedModelWeek?.week_label ?? "week"} equity curve`}
                  points={selectedModelWeek?.equity_curve ?? []}
                  interactive
                />
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {summary.models.map((model) => (
              <div
                key={model.model}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {model.model_label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {model.overall.total_percent.toFixed(2)}%
                </p>
                <div className="mt-3 space-y-1 text-sm text-[var(--foreground)]">
                  {selectedWeek ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span>Selected week</span>
                        <span>
                          {model.by_week.find((row) => row.week_open_utc === selectedWeek)?.week_label ??
                            "--"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Raw (week)</span>
                        <span>
                          {(
                            model.by_week.find((row) => row.week_open_utc === selectedWeek)?.total_percent ?? 0
                          ).toFixed(2)}
                          %
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Locked (week)</span>
                        <span>
                          {(
                            model.by_week.find((row) => row.week_open_utc === selectedWeek)
                              ?.simulated_locked_percent ?? 0
                          ).toFixed(2)}
                          %
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Max DD (week)</span>
                        <span>
                          {maxDrawdown(
                            model.by_week.find((row) => row.week_open_utc === selectedWeek)?.equity_curve ?? [],
                          ).toFixed(2)}
                          %
                        </span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span>Locked total</span>
                    <span>{model.overall.simulated_locked_total_percent.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Weeks</span>
                    <span>{model.overall.weeks}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Avg locked/week</span>
                    <span>{model.overall.avg_simulated_locked_percent.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Win rate</span>
                    <span>{model.overall.win_rate.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {summary.models.map((model) => (
            <div
              key={`${model.model}-table`}
              className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
            >
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {model.model_label} weekly table
              </h3>
              <div className="mt-4 max-h-64 overflow-auto">
                <table className="w-full text-left text-sm text-[var(--foreground)]">
                  <thead className="sticky top-0 bg-[var(--panel)]/95 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    <tr>
                      <th className="py-2">Week</th>
                      <th className="py-2 text-right">Raw %</th>
                      <th className="py-2 text-right">Locked %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const sorted = [...model.by_week].sort((a, b) => b.total_percent - a.total_percent);
                      const top = new Set(sorted.slice(0, 2).map((row) => row.week_open_utc));
                      const bottom = new Set(sorted.slice(-2).map((row) => row.week_open_utc));
                      return model.by_week.map((row) => (
                        <tr
                          key={`${model.model}-${row.week_open_utc}`}
                          className={`border-t border-[var(--panel-border)]/60 ${
                            selectedWeek === row.week_open_utc
                              ? "bg-[var(--accent)]/10"
                              : top.has(row.week_open_utc)
                                ? "bg-emerald-50/60"
                                : bottom.has(row.week_open_utc)
                                  ? "bg-rose-50/60"
                                  : ""
                          }`}
                        >
                          <td className="py-2">{row.week_label}</td>
                          <td className="py-2 text-right">{row.total_percent.toFixed(2)}%</td>
                          <td className="py-2 text-right">{row.simulated_locked_percent.toFixed(2)}%</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      </div>
    </DashboardLayout>
  );
}
