import DashboardLayout from "@/components/DashboardLayout";
import PairPerformanceTable from "@/components/PairPerformanceTable";
import RefreshControl from "@/components/RefreshControl";
import { evaluateFreshness } from "@/lib/cotFreshness";
import { COT_VARIANT } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import type { CotSnapshotResponse } from "@/lib/cotTypes";
import { getStoredPairPerformance } from "@/lib/pricePerformance";
import type { PairPerformance } from "@/lib/priceStore";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value?: string) {
  if (!value) {
    return "Unknown";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function buildResponse(
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): CotSnapshotResponse {
  if (!snapshot) {
    return {
      report_date: "",
      last_refresh_utc: "",
      trading_allowed: false,
      reason: "no snapshot available",
      currencies: {},
      pairs: {},
    };
  }

  const freshness = evaluateFreshness(
    snapshot.report_date,
    snapshot.last_refresh_utc,
  );

  return { ...snapshot, ...freshness };
}

export default async function DashboardPage() {
  const snapshot = await readSnapshot();
  const data = buildResponse(snapshot);
  const currencyRows = Object.entries(data.currencies).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const pairRows = Object.entries(data.pairs).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const { performance, note } =
    pairRows.length > 0
      ? await getStoredPairPerformance(data.pairs)
      : { performance: {}, note: "Price data not refreshed yet." };
  const pairRowsWithPerf = pairRows.map(([pair, row]) => ({
    pair,
    ...row,
    performance: performance[pair] ?? null,
  }));
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900">
              COT Bias Dashboard
            </h1>
            <p className="text-sm text-slate-600">
              Dealer positioning from CFTC TFF ({COT_VARIANT}) with a trading
              readiness gate.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
            <RefreshControl lastRefreshUtc={data.last_refresh_utc} />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Report date
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatDate(data.report_date)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Trading allowed
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                data.trading_allowed ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {data.trading_allowed ? "Yes" : "No"}
            </p>
            <p className="text-sm text-[color:var(--muted)]">{data.reason}</p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatDate(data.last_refresh_utc)}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Currency bias
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Dealer short minus dealer long.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-[color:var(--muted)]">
                  <tr>
                    <th className="py-2">Currency</th>
                    <th className="py-2">Dealer long</th>
                    <th className="py-2">Dealer short</th>
                    <th className="py-2">Net</th>
                    <th className="py-2">Bias</th>
                  </tr>
                </thead>
                <tbody className="text-slate-900">
                  {currencyRows.length === 0 ? (
                    <tr>
                      <td className="py-3 text-sm text-[color:var(--muted)]">
                        No data yet.
                      </td>
                    </tr>
                  ) : (
                    currencyRows.map(([currency, row]) => (
                      <tr
                        key={currency}
                        className={`border-t border-[var(--panel-border)] ${
                          row.bias === "BULLISH"
                            ? "bg-emerald-50/60"
                            : row.bias === "BEARISH"
                              ? "bg-rose-50/60"
                              : ""
                        }`}
                      >
                        <td className="py-2 font-semibold">{currency}</td>
                        <td className="py-2">
                          {formatNumber(row.dealer_long)}
                        </td>
                        <td className="py-2">
                          {formatNumber(row.dealer_short)}
                        </td>
                        <td className="py-2">{formatNumber(row.net)}</td>
                        <td
                          className={`py-2 font-semibold ${
                            row.bias === "BULLISH"
                              ? "text-emerald-700"
                              : row.bias === "BEARISH"
                                ? "text-rose-700"
                                : "text-slate-500"
                          }`}
                        >
                          {row.bias}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <PairPerformanceTable rows={pairRowsWithPerf} note={note} />
        </section>
      </div>
    </DashboardLayout>
  );
}
