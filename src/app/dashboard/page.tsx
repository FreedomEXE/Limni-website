import DashboardLayout from "@/components/DashboardLayout";
import PairPerformanceTable from "@/components/PairPerformanceTable";
import BiasHeatmap from "@/components/BiasHeatmap";
import PairHeatmap from "@/components/PairHeatmap";
import PageTabs from "@/components/PageTabs";
import ViewToggle from "@/components/ViewToggle";
import SummaryCards from "@/components/SummaryCards";
import MiniBiasStrip from "@/components/MiniBiasStrip";
import { evaluateFreshness } from "@/lib/cotFreshness";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import { DateTime } from "luxon";
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
} from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { listSnapshotDates, readSnapshot } from "@/lib/cotStore";
import type { CotSnapshotResponse } from "@/lib/cotTypes";
import { getPairPerformance } from "@/lib/pricePerformance";
import { refreshAppData } from "@/lib/appRefresh";

export const dynamic = "force-dynamic";

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
  if (value === "dealer" || value === "commercial") {
    return value;
  }
  return "dealer";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  refreshAppData().catch((error) => {
    console.error("App refresh failed:", error);
  });

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const assetParam = resolvedSearchParams?.asset;
  const reportParam = resolvedSearchParams?.report;
  const biasParam = resolvedSearchParams?.bias;
  const viewParam = resolvedSearchParams?.view;
  const rawAsset = Array.isArray(assetParam) ? assetParam[0] : assetParam;
  const isAll = rawAsset === "all" || !rawAsset;
  const assetClass = getAssetClass(rawAsset);
  const biasMode = getBiasMode(
    Array.isArray(biasParam) ? biasParam[0] : biasParam,
  );
  const view =
    viewParam === "list" || viewParam === "heatmap" ? viewParam : "heatmap";
  const reportDate =
    Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const assetClasses = listAssetClasses();
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
  let combinedRefresh = data.last_refresh_utc;

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
        isLatestReport: false,
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
    const refreshDates = snapshotEntries
      .map((entry) => entry.snapshot?.last_refresh_utc)
      .filter((value): value is string => Boolean(value));
    combinedRefresh = refreshDates.length > 0 ? refreshDates.sort().at(-1) ?? "" : "";
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
            isLatestReport: false,
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

  const biasLabel = isAll ? "Asset" : assetDefinition.biasLabel;
  const reportWeekLabel = (() => {
    if (!selectedReportDate) {
      return "";
    }
    const report = DateTime.fromISO(selectedReportDate, { zone: "America/New_York" });
    if (!report.isValid) {
      return formatDateET(selectedReportDate);
    }
    const daysUntilMonday = (8 - report.weekday) % 7;
    const monday = report
      .plus({ days: daysUntilMonday })
      .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    return formatDateET(monday.toUTC().toISO());
  })();
  const viewParams = new URLSearchParams();
  viewParams.set("asset", isAll ? "all" : assetClass);
  if (selectedReportDate) {
    viewParams.set("report", selectedReportDate);
  }
  viewParams.set("bias", biasMode);
  const viewItems = (["heatmap", "list"] as const).map((option) => {
    const params = new URLSearchParams(viewParams);
    params.set("view", option);
    return {
      value: option,
      label: option,
      href: `/dashboard?${params.toString()}`,
    };
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Bias</h1>
          <PageTabs />
        </header>

        <SummaryCards
          title="Bias"
          cards={[
            {
              id: "pairs",
              label: "Pairs tracked",
              value: String(pairRowsWithPerf.length),
            },
            {
              id: "long",
              label: "Long signals",
              value: String(pairRowsWithPerf.filter((row) => row.direction === "LONG").length),
              tone: "positive",
            },
            {
              id: "short",
              label: "Short signals",
              value: String(pairRowsWithPerf.filter((row) => row.direction === "SHORT").length),
              tone: "negative",
            },
            {
              id: "neutral",
              label: "Neutral/ignored",
              value: String(Math.max(0, currencyRows.length - pairRowsWithPerf.length)),
            },
          ]}
        />

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <form action="/dashboard" method="get" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="view" value={view} />
              <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Asset class
              </label>
              <select
                name="asset"
                defaultValue={isAll ? "all" : assetClass}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <option value="all">ALL</option>
                {assetClasses.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.label}
                  </option>
                ))}
              </select>
              <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Trading week
              </label>
              <select
                name="report"
                defaultValue={selectedReportDate ?? ""}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {(() => {
                      const report = DateTime.fromISO(date, { zone: "America/New_York" });
                      if (!report.isValid) {
                        return formatDateET(date);
                      }
                      const daysUntilMonday = (8 - report.weekday) % 7;
                      const monday = report
                        .plus({ days: daysUntilMonday })
                        .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                      return formatDateET(monday.toUTC().toISO());
                    })()}
                  </option>
                ))}
              </select>
              <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Bias mode
              </label>
              <select
                name="bias"
                defaultValue={biasMode}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <option value="dealer">DEALER</option>
                <option value="commercial">COMMERCIAL</option>
              </select>
              <button
                type="submit"
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                View
              </button>
            </form>
            <ViewToggle value={view} items={viewItems} />
          </div>
          {selectedReportDate ? (
            <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              COT report date {formatDateET(selectedReportDate)}
              {reportWeekLabel ? ` · Trading week ${reportWeekLabel}` : ""}
            </div>
          ) : null}

          <div className="mt-6 space-y-6">
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {biasLabel} bias strip
              </h2>
              <div className="mt-3">
                <MiniBiasStrip
                  items={currencyRows.map((row) => ({
                    id: `${row.assetLabel}-${row.currency}`,
                    label: row.label,
                    bias: row.bias,
                  }))}
                />
              </div>
            </div>

            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Pair view
              </h2>
              <div className="mt-3">
                {view === "heatmap" ? (
                  <PairHeatmap rows={pairRowsWithPerf} />
                ) : (
                  <PairPerformanceTable
                    rows={pairRowsWithPerf}
                    note={pairNote}
                    missingPairs={missingPairs}
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {combinedRefresh ? `Last refresh ${formatDateTimeET(combinedRefresh)}` : "No refresh yet"}
        </div>
      </div>
    </DashboardLayout>
  );
}
