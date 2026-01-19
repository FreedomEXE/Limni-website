import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import PairPerformanceTable from "@/components/PairPerformanceTable";
import RefreshControl from "@/components/RefreshControl";
import { evaluateFreshness } from "@/lib/cotFreshness";
import {
  COT_VARIANT,
  getAssetClass,
  getAssetClassDefinition,
  listAssetClasses,
} from "@/lib/cotMarkets";
import { listSnapshotDates, readSnapshot } from "@/lib/cotStore";
import type { CotSnapshotResponse } from "@/lib/cotTypes";
import { getPairPerformance } from "@/lib/pricePerformance";

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
  assetClass: ReturnType<typeof getAssetClass>,
): CotSnapshotResponse {
  if (!snapshot) {
    return {
      report_date: "",
      last_refresh_utc: "",
      asset_class: assetClass,
      variant: COT_VARIANT,
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

type DashboardPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const assetParam = resolvedSearchParams?.asset;
  const reportParam = resolvedSearchParams?.report;
  const assetClass = getAssetClass(
    Array.isArray(assetParam) ? assetParam[0] : assetParam,
  );
  const reportDate =
    Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const availableDates = await listSnapshotDates(assetClass);
  const selectedReportDate = reportDate && availableDates.includes(reportDate)
    ? reportDate
    : availableDates[0];
  const snapshot = await readSnapshot({
    assetClass,
    reportDate: selectedReportDate,
  });
  const data = buildResponse(snapshot, assetClass);
  const assetDefinition = getAssetClassDefinition(assetClass);
  const assetClasses = listAssetClasses();
  const marketLabels = assetDefinition.markets;

  const currencyRows = Object.entries(data.currencies)
    .filter(([currency]) => assetClass === "fx" || currency !== "USD")
    .sort(([a], [b]) => a.localeCompare(b));
  const pairRows = Object.entries(data.pairs).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const isLatestReport =
    !selectedReportDate ||
    (availableDates.length > 0 && availableDates[0] === selectedReportDate);
  const perfResult =
    pairRows.length > 0
      ? await getPairPerformance(data.pairs, {
          assetClass,
          reportDate: selectedReportDate,
          isLatestReport,
        })
      : { performance: {}, note: "No pairs to price." };
  const pairRowsWithPerf = pairRows.map(([pair, row]) => ({
    pair,
    ...row,
    performance: perfResult.performance[pair] ?? null,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {assetClasses.map((asset) => {
                const href =
                  selectedReportDate
                    ? `/dashboard?asset=${asset.id}&report=${selectedReportDate}`
                    : `/dashboard?asset=${asset.id}`;
                const isActive = asset.id === assetClass;
                return (
                  <Link
                    key={asset.id}
                    href={href}
                    className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "border border-[var(--panel-border)] text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[color:var(--accent-strong)]"
                    }`}
                  >
                    {asset.label}
                  </Link>
                );
              })}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">
                Bias Dashboard
              </h1>
              <p className="text-sm text-slate-600">
                {assetDefinition.positionLabel} positioning from CFTC COT ({COT_VARIANT})
                with room to layer more bias inputs over time.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
            <RefreshControl
              lastRefreshUtc={data.last_refresh_utc}
              assetClass={assetClass}
            />
          </div>
        </header>

        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Asset class
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {assetDefinition.label}
            </p>
          </div>
          <form
            action="/dashboard"
            method="get"
            className="flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="asset" value={assetClass} />
            <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Report week
            </label>
            <select
              name="report"
              defaultValue={selectedReportDate ?? ""}
              className="rounded-lg border border-[var(--panel-border)] bg-white/80 px-3 py-2 text-sm text-slate-900"
            >
              {availableDates.length === 0 ? (
                <option value="">No snapshots</option>
              ) : (
                availableDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDate(date)}
                  </option>
                ))
              )}
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--accent-strong)]"
            >
              View
            </button>
          </form>
        </div>

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
                {assetDefinition.biasLabel} bias
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                {assetDefinition.positionLabel} short minus {assetDefinition.positionLabel} long.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-[color:var(--muted)]">
                  <tr>
                    <th className="py-2">{assetDefinition.biasLabel}</th>
                    <th className="py-2">{assetDefinition.positionLabel} long</th>
                    <th className="py-2">{assetDefinition.positionLabel} short</th>
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
                        <td className="py-2 font-semibold">
                          {marketLabels[currency]?.label ?? currency}
                        </td>
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

          <PairPerformanceTable rows={pairRowsWithPerf} note={perfResult.note} />
        </section>
      </div>
    </DashboardLayout>
  );
}
