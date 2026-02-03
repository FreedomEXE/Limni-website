import DashboardLayout from "@/components/DashboardLayout";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import ResearchSectionNav from "@/components/research/ResearchSectionNav";
import { buildUniversalBasketSummary } from "@/lib/universalBasket";
import { formatDateTimeET } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function UniversalResearchPage() {
  const universalSummary = await buildUniversalBasketSummary({
    timeframe: "M1",
    limitWeeks: 8,
    includeCurrentWeek: false,
  });
  const latestUniversalWeek = universalSummary.by_week[0] ?? null;

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

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <Metric label="Weeks" value={`${universalSummary.overall.weeks}`} />
            <Metric label="Total return" value={`${universalSummary.overall.total_percent.toFixed(2)}%`} />
            <Metric
              label="Locked total"
              value={`${universalSummary.overall.simulated_locked_total_percent.toFixed(2)}%`}
            />
            <Metric label="Avg weekly" value={`${universalSummary.overall.avg_weekly_percent.toFixed(2)}%`} />
            <Metric label="Win rate" value={`${universalSummary.overall.win_rate.toFixed(0)}%`} />
          </div>

          <div className="mt-6 max-h-80 overflow-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
            <table className="w-full text-left text-sm text-[var(--foreground)]">
              <thead className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <tr>
                  <th className="py-2">Week</th>
                  <th className="py-2 text-right">Raw %</th>
                  <th className="py-2 text-right">Peak %</th>
                  <th className="py-2 text-right">Locked %</th>
                </tr>
              </thead>
              <tbody>
                {universalSummary.by_week.map((row) => (
                  <tr key={row.week_open_utc} className="border-t border-[var(--panel-border)]/60">
                    <td className="py-2">{row.week_label}</td>
                    <td className="py-2 text-right">{row.total_percent.toFixed(2)}%</td>
                    <td className="py-2 text-right">{row.observed_peak_percent.toFixed(2)}%</td>
                    <td className="py-2 text-right">{row.simulated_locked_percent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {latestUniversalWeek ? (
            <div className="mt-6">
              <EquityCurveChart
                title={`${latestUniversalWeek.week_label} equity curve`}
                points={latestUniversalWeek.equity_curve}
              />
            </div>
          ) : null}
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
