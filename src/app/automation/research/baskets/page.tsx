import DashboardLayout from "@/components/DashboardLayout";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import ResearchSectionNav from "@/components/research/ResearchSectionNav";
import { buildPerModelBasketSummary } from "@/lib/universalBasket";
import { formatDateTimeET } from "@/lib/time";
import { unstable_cache } from "next/cache";

export const revalidate = 900;

type PageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Research</h1>
          <ResearchSectionNav />
        </header>

        <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
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
          {selectedWeek ? (
            <form action="/automation/research/baskets" method="get" className="mt-4 flex items-center gap-2">
              <select
                name="model"
                defaultValue={selectedModelKey ?? undefined}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-sm text-[var(--foreground)]"
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                name="week"
                defaultValue={selectedWeek}
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
                View week
              </button>
            </form>
          ) : null}

          {selectedModel ? (
            <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
              <div className="grid gap-4 md:grid-cols-5">
                <Metric label="Basket" value={selectedModel.model_label} />
                <Metric
                  label="Raw % (week)"
                  value={`${(selectedModelWeek?.total_percent ?? 0).toFixed(2)}%`}
                />
                <Metric
                  label="Peak % (week)"
                  value={`${(selectedModelWeek?.observed_peak_percent ?? 0).toFixed(2)}%`}
                />
                <Metric
                  label="Locked % (week)"
                  value={`${(selectedModelWeek?.simulated_locked_percent ?? 0).toFixed(2)}%`}
                />
                <Metric
                  label="Trail hit"
                  value={selectedModelWeek?.trailing_hit ? "Yes" : "No"}
                />
              </div>
              <div className="mt-4">
                <EquityCurveChart
                  title={`${selectedModel.model_label} ${selectedModelWeek?.week_label ?? "week"} equity curve`}
                  points={selectedModelWeek?.equity_curve ?? []}
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
                  {model.overall.simulated_locked_total_percent.toFixed(2)}%
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
                    </>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span>Raw total</span>
                    <span>{model.overall.total_percent.toFixed(2)}%</span>
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
                  <thead className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    <tr>
                      <th className="py-2">Week</th>
                      <th className="py-2 text-right">Raw %</th>
                      <th className="py-2 text-right">Locked %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.by_week.map((row) => (
                      <tr
                        key={`${model.model}-${row.week_open_utc}`}
                        className={`border-t border-[var(--panel-border)]/60 ${
                          selectedWeek === row.week_open_utc ? "bg-[var(--accent)]/10" : ""
                        }`}
                      >
                        <td className="py-2">{row.week_label}</td>
                        <td className="py-2 text-right">{row.total_percent.toFixed(2)}%</td>
                        <td className="py-2 text-right">{row.simulated_locked_percent.toFixed(2)}%</td>
                      </tr>
                    ))}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
