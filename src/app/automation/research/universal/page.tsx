import DashboardLayout from "@/components/DashboardLayout";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import ResearchSectionNav from "@/components/research/ResearchSectionNav";
import { buildUniversalBasketSummary } from "@/lib/universalBasket";
import { formatDateTimeET } from "@/lib/time";
import { unstable_cache } from "next/cache";
import WeekSelector from "@/components/accounts/WeekSelector";
import KpiGroup from "@/components/metrics/KpiGroup";
import KpiCard from "@/components/metrics/KpiCard";
import DebugReadout from "@/components/DebugReadout";
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

export default async function UniversalResearchPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams);
  const weekParam = pickParam(params?.week);
  const getUniversalSummary = unstable_cache(
    async () =>
      buildUniversalBasketSummary({
        timeframe: "M1",
        limitWeeks: 8,
        includeCurrentWeek: false,
      }),
    ["research-universal-m1-8w"],
    { revalidate: 900 },
  );
  const universalSummary = await getUniversalSummary();
  const currentWeekOpenUtc = getWeekOpenUtc();
  const selectedWeek =
    weekParam && universalSummary.by_week.some((row) => row.week_open_utc === weekParam)
      ? weekParam
      : (universalSummary.by_week[0]?.week_open_utc ?? null);
  const selectedUniversalWeek =
    selectedWeek
      ? universalSummary.by_week.find((row) => row.week_open_utc === selectedWeek) ?? null
      : null;
  const selectedWeekDrawdown = selectedUniversalWeek
    ? maxDrawdown(selectedUniversalWeek.equity_curve)
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
                Universal Basket (All Models Combined)
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Minute-level simulation with trail start{" "}
                {universalSummary.assumptions.trail_start_pct.toFixed(0)}% and trail offset{" "}
                {universalSummary.assumptions.trail_offset_pct.toFixed(0)}%.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Updated {formatDateTimeET(universalSummary.generated_at)}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <WeekSelector
              weekOptions={universalSummary.by_week.map((row) => row.week_open_utc)}
              currentWeek={currentWeekOpenUtc}
              selectedWeek={selectedWeek ?? ""}
            />
            <DebugReadout
              items={[
                { label: "Scope", value: "research:universal" },
                { label: "Window", value: selectedWeek ?? "--" },
                { label: "Series", value: "equity_curve" },
              ]}
            />
          </div>

          <div className="mt-6 space-y-6">
            <KpiGroup title="Performance" description="Overall results and headline weekly stats.">
              <KpiCard
                label="Total return"
                value={`${universalSummary.overall.total_percent.toFixed(2)}%`}
                tone={universalSummary.overall.total_percent >= 0 ? "positive" : "negative"}
                emphasis="primary"
              />
              <KpiCard
                label="Avg weekly"
                value={`${universalSummary.overall.avg_weekly_percent.toFixed(2)}%`}
              />
              <KpiCard label="Win rate" value={`${universalSummary.overall.win_rate.toFixed(0)}%`} />
            </KpiGroup>

            <KpiGroup title="Risk" description="Drawdown and trailing lock behavior.">
              <KpiCard
                label="Locked total"
                value={`${universalSummary.overall.simulated_locked_total_percent.toFixed(2)}%`}
              />
              <KpiCard label="Weeks" value={`${universalSummary.overall.weeks}`} />
              <KpiCard
                label="Trail start"
                value={`${universalSummary.assumptions.trail_start_pct.toFixed(0)}%`}
              />
            </KpiGroup>

            {selectedUniversalWeek ? (
              <KpiGroup title="Selected Week" description="Week-specific stats for the chosen window.">
                <KpiCard label="Week" value={selectedUniversalWeek.week_label.replace("Week of ", "")} />
                <KpiCard label="Raw %" value={`${selectedUniversalWeek.total_percent.toFixed(2)}%`} />
                <KpiCard
                  label="Max DD %"
                  value={`${selectedWeekDrawdown.toFixed(2)}%`}
                  tone={selectedWeekDrawdown > 0 ? "negative" : "neutral"}
                />
              </KpiGroup>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
                New week — no data yet. This section will populate once the week starts.
              </div>
            )}
          </div>

          <div className="mt-6 max-h-80 overflow-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
            <table className="w-full text-left text-sm text-[var(--foreground)]">
              <thead className="sticky top-0 bg-[var(--panel)]/95 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <tr>
                  <th className="py-2">Week</th>
                  <th className="py-2 text-right">Raw %</th>
                  <th className="py-2 text-right">Peak %</th>
                  <th className="py-2 text-right">Locked %</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = [...universalSummary.by_week].sort((a, b) => b.total_percent - a.total_percent);
                  const top = new Set(sorted.slice(0, 2).map((row) => row.week_open_utc));
                  const bottom = new Set(sorted.slice(-2).map((row) => row.week_open_utc));
                  return universalSummary.by_week.map((row) => (
                    <tr
                      key={row.week_open_utc}
                      className={`border-t border-[var(--panel-border)]/60 ${
                        top.has(row.week_open_utc)
                          ? "bg-emerald-50/60"
                          : bottom.has(row.week_open_utc)
                            ? "bg-rose-50/60"
                            : ""
                      }`}
                    >
                      <td className="py-2">{row.week_label}</td>
                      <td className="py-2 text-right">{row.total_percent.toFixed(2)}%</td>
                      <td className="py-2 text-right">{row.observed_peak_percent.toFixed(2)}%</td>
                      <td className="py-2 text-right">{row.simulated_locked_percent.toFixed(2)}%</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <EquityCurveChart
              title={`${selectedUniversalWeek?.week_label ?? "Selected week"} equity curve`}
              points={selectedUniversalWeek?.equity_curve ?? []}
              interactive
            />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
