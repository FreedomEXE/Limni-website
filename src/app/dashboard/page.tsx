import DashboardLayout from "@/components/DashboardLayout";
import SummaryCards from "@/components/SummaryCards";
import MiniBiasStrip from "@/components/MiniBiasStrip";
import PairHeatmap from "@/components/PairHeatmap";
import ViewToggle from "@/components/ViewToggle";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
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
  derivePairDirectionsWithNeutral,
  derivePairDirectionsByBaseWithNeutral,
  resolveMarketBias,
  type BiasMode,
} from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS, type PairDefinition } from "@/lib/cotPairs";
import { listSnapshotDates, readSnapshot } from "@/lib/cotStore";
import type { CotSnapshotResponse } from "@/lib/cotTypes";
import { getPairPerformance } from "@/lib/pricePerformance";
import type { PairSnapshot } from "@/lib/cotTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type ResolvedBias = {
  long: number;
  short: number;
  net: number;
  bias: string;
};

function formatCftcNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function buildBiasDetails({
  pairDef,
  direction,
  dataType,
  assetLabel,
  baseBias,
  quoteBias,
  baseResolved,
  quoteResolved,
}: {
  pairDef: PairDefinition;
  direction: PairSnapshot["direction"];
  dataType: "dealer" | "commercial";
  assetLabel: string;
  baseBias: PairSnapshot["base_bias"];
  quoteBias: PairSnapshot["quote_bias"];
  baseResolved?: ResolvedBias;
  quoteResolved?: ResolvedBias;
}) {
  return [
    { label: "Direction", value: direction },
    {
      label: "Data Type",
      value: dataType === "dealer" ? "Dealer" : "Commercial",
    },
    { label: "Asset Class", value: assetLabel },
    { label: "Base Market", value: pairDef.base },
    { label: "Base Bias", value: baseBias },
    { label: "Base Long", value: formatCftcNumber(baseResolved?.long) },
    { label: "Base Short", value: formatCftcNumber(baseResolved?.short) },
    { label: "Base Net", value: formatCftcNumber(baseResolved?.net) },
    { label: "Quote Market", value: pairDef.quote },
    { label: "Quote Bias", value: quoteBias },
    { label: "Quote Long", value: formatCftcNumber(quoteResolved?.long) },
    { label: "Quote Short", value: formatCftcNumber(quoteResolved?.short) },
    { label: "Quote Net", value: formatCftcNumber(quoteResolved?.net) },
  ];
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
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
  const selectedBiasForFilter = biasMode === "commercial" ? "commercial" : "dealer";
  const view =
    viewParam === "list" || viewParam === "heatmap" ? viewParam : "heatmap";
  const reportDate =
    Array.isArray(reportParam) ? reportParam[0] : reportParam;
  const assetClasses = listAssetClasses();
  const availableDates = isAll
    ? await Promise.all(
        assetClasses.map((asset) => listSnapshotDates(asset.id)),
      ).then((lists) => {
        const union = new Set<string>();
        lists.forEach((list) => {
          list.forEach((date) => union.add(date));
        });
        return Array.from(union);
      })
    : await listSnapshotDates(assetClass);
  const orderedDates = [...availableDates].sort((a, b) => b.localeCompare(a));
  const selectedReportDate =
    reportDate && orderedDates.includes(reportDate)
      ? reportDate
      : orderedDates[0];
  const previousReportDate =
    selectedReportDate
      ? orderedDates[orderedDates.indexOf(selectedReportDate) + 1] ?? null
      : null;
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
    direction: "LONG" | "SHORT" | "NEUTRAL";
    performance: Awaited<ReturnType<typeof getPairPerformance>>["performance"][string] | null;
    subtitle?: string;
    details: Array<{ label: string; value: string }>;
  }>;
  let missingPairs: string[] = [];
  let combinedRefresh = data.last_refresh_utc;

  // Calculate total pairs for counting purposes
  const totalPairsCount = isAll
    ? assetClasses.reduce((sum, asset) => sum + (PAIRS_BY_ASSET_CLASS[asset.id]?.length ?? 0), 0)
    : PAIRS_BY_ASSET_CLASS[assetClass]?.length ?? 0;

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

    const aggregateResults = await Promise.all(
      snapshotEntries.map(async (entry) => {
        const entrySnapshot = entry.snapshot!;
        const marketLabels = entry.asset.markets;
        const pairDefs = PAIRS_BY_ASSET_CLASS[entry.asset.id];
        const resolvedByCurrency = new Map<string, ResolvedBias>();

        Object.entries(entrySnapshot.currencies).forEach(([currency, snapshotValue]) => {
          const resolved = resolveMarketBias(snapshotValue, biasMode);
          if (resolved) {
            resolvedByCurrency.set(currency, {
              long: resolved.long,
              short: resolved.short,
              net: resolved.net,
              bias: resolved.bias,
            });
          }
        });

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

        const derivedPairs: Record<string, PairSnapshot> =
          entry.asset.id === "fx"
            ? derivePairDirectionsWithNeutral(entrySnapshot.currencies, pairDefs, biasMode)
            : derivePairDirectionsByBaseWithNeutral(entrySnapshot.currencies, pairDefs, biasMode);

        // Ensure all pairs are included (add missing ones as NEUTRAL)
        const allPairs: Record<string, PairSnapshot> = {};
        for (const pairDef of pairDefs) {
          if (derivedPairs[pairDef.pair]) {
            allPairs[pairDef.pair] = derivedPairs[pairDef.pair];
          } else {
            allPairs[pairDef.pair] = {
              direction: "NEUTRAL",
              base_bias: "NEUTRAL",
              quote_bias: "NEUTRAL",
            };
          }
        }

        const perfResult = await getPairPerformance(allPairs, {
          assetClass: entry.asset.id,
          reportDate: entrySnapshot.report_date,
          isLatestReport: false,
        });

        return {
          assetLabel: entry.asset.label,
          currencyRows: resolvedCurrencyRows,
          pairRows: pairDefs.map((pairDef) => {
            const row = allPairs[pairDef.pair];
            return {
              pair: `${pairDef.pair} (${entry.asset.label})`,
              direction: row.direction,
              performance: perfResult.performance[pairDef.pair] ?? null,
              subtitle: entry.asset.label,
              details: buildBiasDetails({
                pairDef,
                direction: row.direction,
                dataType: selectedBiasForFilter,
                assetLabel: entry.asset.label,
                baseBias: row.base_bias,
                quoteBias: row.quote_bias,
                baseResolved: resolvedByCurrency.get(pairDef.base),
                quoteResolved: resolvedByCurrency.get(pairDef.quote),
              }),
            };
          }),
          missingPairs: perfResult.missingPairs.map(
            (pair) => `${pair} (${entry.asset.label})`,
          ),
        };
      }),
    );

    aggregateResults.forEach((result) => {
      result.currencyRows.forEach((row) => {
        currencyRows.push({
          assetLabel: result.assetLabel,
          currency: row.currency,
          label: row.label,
          long: row.long,
          short: row.short,
          net: row.net,
          bias: row.bias,
        });
      });
      result.pairRows.forEach((row) => pairRowsWithPerf.push(row));
      missingPairs = missingPairs.concat(result.missingPairs);
    });

    currencyRows.sort((a, b) =>
      `${a.assetLabel}-${a.currency}`.localeCompare(`${b.assetLabel}-${b.currency}`),
    );
    pairRowsWithPerf.sort((a, b) => a.pair.localeCompare(b.pair));
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

    const derivedPairs: Record<string, PairSnapshot> = assetClass === "fx"
        ? derivePairDirectionsWithNeutral(data.currencies, pairDefs, biasMode)
        : derivePairDirectionsByBaseWithNeutral(data.currencies, pairDefs, biasMode);

    // Ensure all pairs are included (add missing ones as NEUTRAL)
    const allPairs: Record<string, PairSnapshot> = {};
    for (const pairDef of pairDefs) {
      if (derivedPairs[pairDef.pair]) {
        allPairs[pairDef.pair] = derivedPairs[pairDef.pair];
      } else {
        allPairs[pairDef.pair] = {
          direction: "NEUTRAL",
          base_bias: "NEUTRAL",
          quote_bias: "NEUTRAL",
        };
      }
    }

    const pairRows = pairDefs
      .map((pairDef) => ({
        pairDef,
        row: allPairs[pairDef.pair],
      }))
      .sort((a, b) => a.pairDef.pair.localeCompare(b.pairDef.pair));
    const perfResult =
      pairRows.length > 0
        ? await getPairPerformance(allPairs, {
            assetClass,
            reportDate: data.report_date || selectedReportDate,
            isLatestReport: false,
          })
        : { performance: {}, note: "No pairs to price.", missingPairs: [] };
    missingPairs = perfResult.missingPairs;
    pairRows.forEach(({ pairDef, row }) => {
      pairRowsWithPerf.push({
        pair: pairDef.pair,
        ...row,
        performance: perfResult.performance[pairDef.pair] ?? null,
        subtitle: assetDefinition.label,
        details: buildBiasDetails({
          pairDef,
          direction: row.direction,
          dataType: selectedBiasForFilter,
          assetLabel: assetDefinition.label,
          baseBias: row.base_bias,
          quoteBias: row.quote_bias,
          baseResolved: data.currencies[pairDef.base]
            ? (resolveMarketBias(data.currencies[pairDef.base], biasMode) ?? undefined)
            : undefined,
          quoteResolved: data.currencies[pairDef.quote]
            ? (resolveMarketBias(data.currencies[pairDef.quote], biasMode) ?? undefined)
            : undefined,
        }),
      });
    });
  }

  const biasLabel = isAll ? "Asset" : assetDefinition.biasLabel;
  const viewParams = new URLSearchParams();
  viewParams.set("asset", isAll ? "all" : assetClass);
  if (selectedReportDate) {
    viewParams.set("report", selectedReportDate);
  }
  viewParams.set("bias", selectedBiasForFilter);
  const viewItems = (["heatmap", "list"] as const).map((option) => {
    const params = new URLSearchParams(viewParams);
    params.set("view", option);
    return {
      value: option,
      label: option,
      href: `/dashboard?${params.toString()}`,
    };
  });
  const longDetails = pairRowsWithPerf
    .filter((row) => row.direction === "LONG")
    .map((row) => ({ label: row.pair, value: "LONG" }));
  const shortDetails = pairRowsWithPerf
    .filter((row) => row.direction === "SHORT")
    .map((row) => ({ label: row.pair, value: "SHORT" }));
  const neutralDetails = pairRowsWithPerf
    .filter((row) => row.direction === "NEUTRAL")
    .map((row) => ({ label: row.pair, value: "NEUTRAL" }));
  const previousDirectionMap = new Map<string, "LONG" | "SHORT" | "NEUTRAL">();
  if (previousReportDate) {
    if (isAll) {
      const previousSnapshots = await Promise.all(
        assetClasses.map((asset) =>
          readSnapshot({ assetClass: asset.id, reportDate: previousReportDate }),
        ),
      );
      previousSnapshots.forEach((prevSnapshot, index) => {
        if (!prevSnapshot) {
          return;
        }
        const asset = assetClasses[index];
        const pairDefs = PAIRS_BY_ASSET_CLASS[asset.id];
        const derivedPairs =
          asset.id === "fx"
            ? derivePairDirectionsWithNeutral(prevSnapshot.currencies, pairDefs, biasMode)
            : derivePairDirectionsByBaseWithNeutral(prevSnapshot.currencies, pairDefs, biasMode);
        pairDefs.forEach((pairDef) => {
          const direction = derivedPairs[pairDef.pair]?.direction ?? "NEUTRAL";
          previousDirectionMap.set(`${pairDef.pair} (${asset.label})`, direction);
        });
      });
    } else {
      const previousSnapshot = await readSnapshot({
        assetClass,
        reportDate: previousReportDate,
      });
      if (previousSnapshot) {
        const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
        const derivedPairs =
          assetClass === "fx"
            ? derivePairDirectionsWithNeutral(previousSnapshot.currencies, pairDefs, biasMode)
            : derivePairDirectionsByBaseWithNeutral(previousSnapshot.currencies, pairDefs, biasMode);
        pairDefs.forEach((pairDef) => {
          const direction = derivedPairs[pairDef.pair]?.direction ?? "NEUTRAL";
          previousDirectionMap.set(pairDef.pair, direction);
        });
      }
    }
  }
  const flipDetails = pairRowsWithPerf
    .map((row) => {
      const prior = previousDirectionMap.get(row.pair);
      if (!prior || prior === row.direction) {
        return null;
      }
      return { label: row.pair, value: `${prior} → ${row.direction}` };
    })
    .filter((detail): detail is { label: string; value: string } => Boolean(detail));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Bias</h1>
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {combinedRefresh ? `Last refresh ${formatDateTimeET(combinedRefresh)}` : "No refresh yet"}
          </div>
        </header>

        <div data-cot-surface="true">
          <SummaryCards
            title="Bias"
            centered={true}
            cards={[
              {
                id: "pairs",
                label: "Pairs tracked",
                value: String(totalPairsCount),
              },
              {
                id: "long",
                label: "Long signals",
                value: String(pairRowsWithPerf.filter((row) => row.direction === "LONG").length),
                tone: "positive",
                details: longDetails,
              },
              {
                id: "short",
                label: "Short signals",
                value: String(pairRowsWithPerf.filter((row) => row.direction === "SHORT").length),
                tone: "negative",
                details: shortDetails,
              },
              {
                id: "neutral",
                label: "Neutral/ignored",
                value: String(pairRowsWithPerf.filter((row) => row.direction === "NEUTRAL").length),
                details: neutralDetails,
              },
              {
                id: "flips",
                label: "Flips",
                value: String(flipDetails.length),
                details: flipDetails,
              },
            ]}
          />
        </div>

        <section
          data-cot-surface="true"
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <DashboardFilters
              assetOptions={assetClasses.map((asset) => ({
                id: asset.id,
                label: asset.label,
              }))}
              reportOptions={availableDates.map((date) => {
                const report = DateTime.fromISO(date, { zone: "America/New_York" });
                if (!report.isValid) {
                  return { value: date, label: formatDateET(date) };
                }
                const daysUntilMonday = (8 - report.weekday) % 7;
                const monday = report
                  .plus({ days: daysUntilMonday })
                  .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                return { value: date, label: formatDateET(monday.toUTC().toISO()) };
              })}
              selectedAsset={isAll ? "all" : assetClass}
              selectedReport={selectedReportDate ?? ""}
              selectedBias={selectedBiasForFilter}
              selectedView={view}
            />
            <ViewToggle value={view} items={viewItems} />
          </div>
          <div className="mt-6">
            <PairHeatmap
              rows={pairRowsWithPerf}
              view={view}
              missingPairs={missingPairs}
            />
          </div>
          <div className="mt-6">
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
        </section>
      </div>
    </DashboardLayout>
  );
}
