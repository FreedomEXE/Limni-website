import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import PairPerformanceTable from "@/components/PairPerformanceTable";
import RefreshControl from "@/components/RefreshControl";
import BiasHeatmap from "@/components/BiasHeatmap";
import { evaluateFreshness } from "@/lib/cotFreshness";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import {
  COT_VARIANT,
  getAssetClass,
  getAssetClassDefinition,
  listAssetClasses,
} from "@/lib/cotMarkets";
import {
  derivePairDirections,
  derivePairDirectionsByBase,
  resolveMarketBias,
  type BiasMode,
  BIAS_WEIGHTS,
} from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { listSnapshotDates, readSnapshot } from "@/lib/cotStore";
import type { CotSnapshotResponse } from "@/lib/cotTypes";
import { getPairPerformance } from "@/lib/pricePerformance";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormatter.format(value);
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

function getBiasMode(value?: string): BiasMode {
  if (value === "dealer" || value === "commercial" || value === "blended") {
    return value;
  }
  return "blended";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const assetParam = resolvedSearchParams?.asset;
  const reportParam = resolvedSearchParams?.report;
  const biasParam = resolvedSearchParams?.bias;
  const rawAsset = Array.isArray(assetParam) ? assetParam[0] : assetParam;
  const isAll = rawAsset === "all" || !rawAsset;
  const assetClass = getAssetClass(rawAsset);
  const biasMode = getBiasMode(
    Array.isArray(biasParam) ? biasParam[0] : biasParam,
  );
  const reportDate =
    Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const assetClasses = listAssetClasses();
  const tabAssets = [
    { id: "all", label: "ALL" },
    ...assetClasses.map((asset) => ({ id: asset.id, label: asset.label })),
  ];
  const availableDates = isAll
    ? await Promise.all(
        assetClasses.map((asset) => listSnapshotDates(asset.id)),
      ).then((lists) => {
        if (lists.length === 0) {
          return [];
        }
        return lists.reduce((acc, list) => acc.filter((date) => list.includes(date)));
      })
    : await listSnapshotDates(assetClass);
  const selectedReportDate =
    reportDate && availableDates.includes(reportDate)
      ? reportDate
      : availableDates[0];
  const snapshot = isAll
    ? null
    : selectedReportDate
      ? await readSnapshot({
          assetClass,
          reportDate: selectedReportDate,
        })
      : await readSnapshot({ assetClass });
  const data = buildResponse(snapshot, assetClass);
  const assetDefinition = getAssetClassDefinition(assetClass);

  const currencyRows = [] as Array<{
    assetLabel: string;
    currency: string;
    label: string;
    long: number;
    short: number;
    net: number;
    bias: string;
  }>;
  const pairRowsWithPerf = [] as Array<{
    pair: string;
    direction: "LONG" | "SHORT";
    performance: Awaited<ReturnType<typeof getPairPerformance>>["performance"][string] | null;
  }>;
  let pairNote = "No pairs to price.";
  let missingPairs: string[] = [];
  let combinedReportDate = data.report_date;
  let combinedRefresh = data.last_refresh_utc;
  let combinedTradingAllowed = data.trading_allowed;
  let combinedReason = data.reason;

  if (isAll) {
    const snapshots = await Promise.all(
      assetClasses.map((asset) =>
        selectedReportDate
          ? readSnapshot({ assetClass: asset.id, reportDate: selectedReportDate })
          : readSnapshot({ assetClass: asset.id }),
      ),
    );
    const snapshotEntries = assetClasses
      .map((asset, index) => ({
        asset,
        snapshot: snapshots[index],
      }))
      .filter((entry) => Boolean(entry.snapshot));

    for (const entry of snapshotEntries) {
      const entrySnapshot = entry.snapshot!;
      const marketLabels = entry.asset.markets;
      const pairDefs = PAIRS_BY_ASSET_CLASS[entry.asset.id];
      const resolvedCurrencyRows = Object.entries(entrySnapshot.currencies)
        .map(([currency, snapshotValue]) => {
          const resolved = resolveMarketBias(snapshotValue, biasMode);
          if (!resolved) {
            return null;
          }
          if (entry.asset.id !== "fx" && currency === "USD") {
            return null;
          }
        return {
          assetLabel: entry.asset.label,
          currency,
          long: resolved.long,
          short: resolved.short,
          net: resolved.net,
          bias: resolved.bias,
          label: marketLabels[currency]?.label ?? currency,
        };
      })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      resolvedCurrencyRows.forEach((row) => {
        currencyRows.push({
          assetLabel: entry.asset.label,
          currency: row.currency,
          label: row.label,
          long: row.long,
          short: row.short,
          net: row.net,
          bias: row.bias,
        });
      });

      const derivedPairs =
        entry.asset.id === "fx"
          ? derivePairDirections(entrySnapshot.currencies, pairDefs, biasMode)
          : derivePairDirectionsByBase(entrySnapshot.currencies, pairDefs, biasMode);
      const perfResult = await getPairPerformance(derivedPairs, {
        assetClass: entry.asset.id,
        reportDate: entrySnapshot.report_date,
        isLatestReport: true,
      });
      Object.entries(derivedPairs).forEach(([pair, row]) => {
        pairRowsWithPerf.push({
          pair: `${pair} (${entry.asset.label})`,
          direction: row.direction,
          performance: perfResult.performance[pair] ?? null,
        });
      });
      missingPairs = missingPairs.concat(
        perfResult.missingPairs.map((pair) => `${pair} (${entry.asset.label})`),
      );
    }

    currencyRows.sort((a, b) =>
      `${a.assetLabel}-${a.currency}`.localeCompare(`${b.assetLabel}-${b.currency}`),
    );
    pairRowsWithPerf.sort((a, b) => a.pair.localeCompare(b.pair));
    pairNote =
      "Combined view across asset classes. Refresh prices per asset class to reduce missing data.";
    const reportDates = snapshotEntries
      .map((entry) => entry.snapshot?.report_date)
      .filter((value): value is string => Boolean(value));
    combinedReportDate = reportDates.length > 0 ? reportDates.sort().at(-1) ?? "" : "";
    const refreshDates = snapshotEntries
      .map((entry) => entry.snapshot?.last_refresh_utc)
      .filter((value): value is string => Boolean(value));
    combinedRefresh = refreshDates.length > 0 ? refreshDates.sort().at(-1) ?? "" : "";
    combinedTradingAllowed = snapshotEntries.some(
      (entry) => entry.snapshot && entry.snapshot.currencies && Object.keys(entry.snapshot.currencies).length > 0,
    );
    combinedReason = snapshotEntries.length > 0
      ? "Composite view across asset classes."
      : "no snapshot available";
  } else {
    const marketLabels = assetDefinition.markets;
    const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
    Object.entries(data.currencies)
      .map(([currency, snapshotValue]) => {
        const resolved = resolveMarketBias(snapshotValue, biasMode);
        return resolved
          ? {
              assetLabel: assetDefinition.label,
              currency,
              label: marketLabels[currency]?.label ?? currency,
              long: resolved.long,
              short: resolved.short,
              net: resolved.net,
              bias: resolved.bias,
            }
          : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => assetClass === "fx" || row.currency !== "USD")
      .sort((a, b) => a.currency.localeCompare(b.currency))
      .forEach((row) => currencyRows.push(row));

    const derivedPairs =
      assetClass === "fx"
        ? derivePairDirections(data.currencies, pairDefs, biasMode)
        : derivePairDirectionsByBase(data.currencies, pairDefs, biasMode);
    const pairRows = Object.entries(derivedPairs).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const isLatestReport =
      !selectedReportDate ||
      (availableDates.length > 0 && availableDates[0] === selectedReportDate);
    const perfResult =
      pairRows.length > 0
        ? await getPairPerformance(derivedPairs, {
            assetClass,
            reportDate: selectedReportDate,
            isLatestReport,
          })
        : { performance: {}, note: "No pairs to price.", missingPairs: [] };
    pairNote = perfResult.note;
    missingPairs = perfResult.missingPairs;
    pairRows.forEach(([pair, row]) => {
      pairRowsWithPerf.push({
        pair,
        ...row,
        performance: perfResult.performance[pair] ?? null,
      });
    });
  }

  const displayAssetLabel = isAll ? "All Assets" : assetDefinition.label;
  const biasLabel = isAll ? "Asset" : assetDefinition.biasLabel;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {tabAssets.map((asset) => {
                const href = selectedReportDate
                  ? `/dashboard?asset=${asset.id}&report=${selectedReportDate}&bias=${biasMode}`
                  : `/dashboard?asset=${asset.id}&bias=${biasMode}`;
                const isActive = asset.id === (isAll ? "all" : assetClass);
                return (
                  <Link
                    key={asset.id}
                    href={href}
                    className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      isActive
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--panel-border)] text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[color:var(--accent-strong)]"
                    }`}
                  >
                    {asset.label}
                  </Link>
                );
              })}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-[var(--foreground)]">
                Bias Dashboard
              </h1>
              <p className="text-sm text-[color:var(--muted)]">
                Weighted blend of dealer and commercial positioning from CFTC COT ({COT_VARIANT}). Sentiment is not included.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
            <RefreshControl
              lastRefreshUtc={isAll ? combinedRefresh : data.last_refresh_utc}
            />
          </div>
        </header>

        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Asset class
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              {displayAssetLabel}
            </p>
          </div>
          <form
            action="/dashboard"
            method="get"
            className="flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="asset" value={isAll ? "all" : assetClass} />
            <input type="hidden" name="bias" value={biasMode} />
            <>
              <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Report week
              </label>
              <select
                name="report"
                defaultValue={selectedReportDate ?? ""}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-sm text-[var(--foreground)]"
              >
                {availableDates.length === 0 ? (
                  <option value="">No snapshots</option>
                ) : (
                  availableDates.map((date) => (
                    <option key={date} value={date}>
                      {formatDateET(date)}
                    </option>
                  ))
                )}
              </select>
            </>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Bias mode
            </span>
            <div className="flex items-center gap-2">
              {(["blended", "dealer", "commercial"] as BiasMode[]).map((mode) => {
                const href = new URLSearchParams();
                href.set("asset", assetClass);
                if (selectedReportDate) {
                  href.set("report", selectedReportDate);
                }
                href.set("bias", mode);
                return (
                  <Link
                    key={mode}
                    href={`/dashboard?${href.toString()}`}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      biasMode === mode
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--panel-border)] text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[color:var(--accent-strong)]"
                    }`}
                  >
                    {mode}
                  </Link>
                );
              })}
            </div>
            {availableDates.length > 0 ? (
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--accent-strong)]"
              >
                View
              </button>
            ) : null}
          </form>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Report date
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatDateET(combinedReportDate)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Trading allowed
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                combinedTradingAllowed ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {combinedTradingAllowed ? "Yes" : "No"}
            </p>
            <p className="text-sm text-[color:var(--muted)]">{combinedReason}</p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatDateTimeET(combinedRefresh)}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {biasLabel} bias
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                {biasMode === "blended"
                  ? `Blended bias (${Math.round(
                      BIAS_WEIGHTS.dealer * 100,
                    )}% dealer / ${Math.round(
                      BIAS_WEIGHTS.commercial * 100,
                    )}% commercial).`
                  : biasMode === "dealer"
                    ? "Dealer short minus Dealer long."
                    : "Commercial long minus Commercial short."}
              </p>
            </div>
            <div className="overflow-x-auto">
              {currencyRows.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">No data yet.</p>
              ) : (
                <BiasHeatmap rows={currencyRows} showAssetLabel={isAll} />
              )}
            </div>
          </div>

          <PairPerformanceTable
            rows={pairRowsWithPerf}
            note={pairNote}
            missingPairs={missingPairs}
          />
        </section>
      </div>
    </DashboardLayout>
  );
}
