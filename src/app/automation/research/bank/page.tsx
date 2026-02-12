import DashboardLayout from "@/components/DashboardLayout";
import KpiGroup from "@/components/metrics/KpiGroup";
import KpiCard from "@/components/metrics/KpiCard";
import { computeBankComparison } from "@/lib/research/bankComparison";
import { formatDateTimeET } from "@/lib/time";
import { unstable_cache } from "next/cache";

export const revalidate = 900;

export default async function BankResearchPage() {
  const getBankFutures = unstable_cache(
    async () =>
      computeBankComparison({
        weeks: 156,
        months: 30,
        assets: ["fx", "indices", "crypto", "commodities"],
        reportType: "f",
      }),
    ["research-bank-comparison-f"],
    { revalidate: 900 },
  );

  const getBankOptions = unstable_cache(
    async () =>
      computeBankComparison({
        weeks: 156,
        months: 30,
        assets: ["fx", "indices", "crypto", "commodities"],
        reportType: "o",
      }),
    ["research-bank-comparison-o"],
    { revalidate: 900 },
  );

  const [futures, options] = await Promise.all([getBankFutures(), getBankOptions()]);

  const futuresDirectional = futures.summary.directional;
  const optionsDirectional = options.summary.directional;
  const latestWeek = futures.rows[0]?.week_open_utc ?? null;
  const latestWeekF = futures.rows.filter(
    (row) => row.week_open_utc === latestWeek && row.bank_mode === "directional",
  );
  const latestWeekO = options.rows.filter(
    (row) => row.week_open_utc === latestWeek && row.bank_mode === "directional",
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Research</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Bank Participation integration (research-only). No EA/bot/live model routing changes.
          </p>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Updated {formatDateTimeET(futures.generated_at)}
          </p>
        </header>

        <section
          data-cot-surface="true"
          className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Bank Futures vs Bank Options</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Directional bank model performance over the same historical sample.
          </p>

          <div className="mt-6 space-y-6">
            <KpiGroup title="Bank Futures" description="CFTC Bank Participation futures report (f).">
              <KpiCard label="Rows" value={`${futuresDirectional.rows}`} />
              <KpiCard label="Avg return" value={`${futuresDirectional.return_stats.avg_return.toFixed(2)}%`} />
              <KpiCard label="Win rate" value={`${futuresDirectional.return_stats.win_rate.toFixed(1)}%`} />
              <KpiCard label="Delta vs Blended" value={`${futuresDirectional.avg_delta_vs_blended.toFixed(2)}%`} />
            </KpiGroup>

            <KpiGroup title="Bank Options" description="CFTC Bank Participation options report (o).">
              <KpiCard label="Rows" value={`${optionsDirectional.rows}`} />
              <KpiCard label="Avg return" value={`${optionsDirectional.return_stats.avg_return.toFixed(2)}%`} />
              <KpiCard label="Win rate" value={`${optionsDirectional.return_stats.win_rate.toFixed(1)}%`} />
              <KpiCard label="Delta vs Blended" value={`${optionsDirectional.avg_delta_vs_blended.toFixed(2)}%`} />
            </KpiGroup>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Latest Week - Futures
              </h3>
              <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-[var(--panel-border)]/60">
                <table className="w-full text-left text-sm text-[var(--foreground)]">
                  <thead className="bg-[var(--panel)]/90 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    <tr>
                      <th className="px-3 py-2">Asset</th>
                      <th className="px-3 py-2 text-right">Pairs</th>
                      <th className="px-3 py-2 text-right">Bank %</th>
                      <th className="px-3 py-2 text-right">Bank Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestWeekF.map((row) => (
                      <tr key={`f-${row.asset_class}`} className="border-t border-[var(--panel-border)]/50">
                        <td className="px-3 py-2 uppercase">{row.asset_class}</td>
                        <td className="px-3 py-2 text-right">{row.total}</td>
                        <td className="px-3 py-2 text-right">{row.bank_percent.toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right">{row.bank_report_date ?? "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Latest Week - Options
              </h3>
              <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-[var(--panel-border)]/60">
                <table className="w-full text-left text-sm text-[var(--foreground)]">
                  <thead className="bg-[var(--panel)]/90 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    <tr>
                      <th className="px-3 py-2">Asset</th>
                      <th className="px-3 py-2 text-right">Pairs</th>
                      <th className="px-3 py-2 text-right">Bank %</th>
                      <th className="px-3 py-2 text-right">Bank Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestWeekO.map((row) => (
                      <tr key={`o-${row.asset_class}`} className="border-t border-[var(--panel-border)]/50">
                        <td className="px-3 py-2 uppercase">{row.asset_class}</td>
                        <td className="px-3 py-2 text-right">{row.total}</td>
                        <td className="px-3 py-2 text-right">{row.bank_percent.toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right">{row.bank_report_date ?? "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
