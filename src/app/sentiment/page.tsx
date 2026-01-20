import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import RefreshSentimentButton from "@/components/RefreshSentimentButton";
import SentimentHeatmap from "@/components/SentimentHeatmap";
import { fetchLiquidationSummary } from "@/lib/coinank";
import { fetchBitgetFuturesSnapshot } from "@/lib/bitget";
import { getLatestAggregates, readSourceHealth } from "@/lib/sentiment/store";
import {
  SENTIMENT_ASSET_CLASSES,
  ALL_SENTIMENT_SYMBOLS,
  type SentimentAssetClass,
} from "@/lib/sentiment/symbols";
import type { SentimentAggregate, SourceHealth } from "@/lib/sentiment/types";

export const dynamic = "force-dynamic";

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}`;
}

function crowdingTone(state: string) {
  if (state === "CROWDED_LONG") {
    return "text-rose-700";
  }
  if (state === "CROWDED_SHORT") {
    return "text-emerald-700";
  }
  return "text-slate-500";
}

function sourceTone(status: string) {
  if (status === "HEALTHY") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "DEGRADED") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-rose-100 text-rose-700";
}

function formatUsd(value: number) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return usdFormatter.format(value);
}

function formatTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

type SentimentPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

type SentimentView = SentimentAssetClass | "all";

function getAssetClass(value?: string | null): SentimentView {
  if (value === "all") {
    return "all";
  }
  if (value && value in SENTIMENT_ASSET_CLASSES) {
    return value as SentimentAssetClass;
  }
  return "fx";
}

export default async function SentimentPage({ searchParams }: SentimentPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const assetParam = resolvedSearchParams?.asset;
  const assetClass = getAssetClass(
    Array.isArray(assetParam) ? assetParam[0] : assetParam,
  );
  let aggregates: SentimentAggregate[] = [];
  let sources: SourceHealth[] = [];
  let liquidationSummaries: Array<
    Awaited<ReturnType<typeof fetchLiquidationSummary>>
  > = [];
  let bitgetSnapshots: Array<
    Awaited<ReturnType<typeof fetchBitgetFuturesSnapshot>>
  > = [];
  try {
    [aggregates, sources] = await Promise.all([
      getLatestAggregates(),
      readSourceHealth(),
    ]);
  } catch (error) {
    console.error(
      "Sentiment load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (assetClass === "crypto") {
    try {
      liquidationSummaries = await Promise.all([
        fetchLiquidationSummary("BTC"),
        fetchLiquidationSummary("ETH"),
      ]);
    } catch (error) {
      console.error(
        "Coinank liquidation load failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
    try {
      bitgetSnapshots = await Promise.all([
        fetchBitgetFuturesSnapshot("BTC"),
        fetchBitgetFuturesSnapshot("ETH"),
      ]);
    } catch (error) {
      console.error(
        "Bitget snapshot load failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const symbols =
    assetClass === "all"
      ? ALL_SENTIMENT_SYMBOLS
      : SENTIMENT_ASSET_CLASSES[assetClass].symbols;
  const filteredAggregates = aggregates.filter((agg) =>
    symbols.includes(agg.symbol),
  );
  const sortedAggregates = filteredAggregates.sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );

  const crowdedLong = filteredAggregates.filter(
    (a) => a.crowding_state === "CROWDED_LONG",
  ).length;
  const crowdedShort = filteredAggregates.filter(
    (a) => a.crowding_state === "CROWDED_SHORT",
  ).length;
  const flips = filteredAggregates.filter((a) => a.flip_state !== "NONE").length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {[{ id: "all", label: "ALL" }, ...Object.entries(SENTIMENT_ASSET_CLASSES).map(([id, info]) => ({ id, label: info.label }))].map(
              (item) => {
                const href = `/sentiment?asset=${item.id}`;
                const isActive = item.id === assetClass;
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "border border-[var(--panel-border)] text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[color:var(--accent-strong)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              },
            )}
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Retail Sentiment
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Aggregated positioning data from IG, OANDA, and Myfxbook. Identify
            crowding and path risk across FX pairs.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Pairs tracked
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {filteredAggregates.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Crowded long
            </p>
            <p className="mt-2 text-2xl font-semibold text-rose-700">
              {crowdedLong}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Crowded short
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">
              {crowdedShort}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Recent flips
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">{flips}</p>
          </div>
        </section>

        <SentimentHeatmap aggregates={sortedAggregates} />

        {assetClass === "crypto" ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Liquidation Pulse (Coinank)
                </h2>
                <p className="text-sm text-slate-600">
                  Recent liquidation clusters for BTC and ETH.
                </p>
              </div>
              {liquidationSummaries.length > 0 ? (
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Updated {formatTime(liquidationSummaries[0].lastUpdated)}
                </p>
              ) : null}
            </div>

            {liquidationSummaries.length === 0 ? (
              <p className="text-sm text-slate-500">
                No liquidation data available yet.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {liquidationSummaries.map((summary) => (
                  <div
                    key={summary.baseCoin}
                    className="rounded-xl border border-slate-200 bg-white/90 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {summary.baseCoin}
                      </h3>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                        {summary.dominantSide === "flat"
                          ? "BALANCED"
                          : `${summary.dominantSide.toUpperCase()} LIQS`}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>Long liquidations</span>
                        <span className="font-semibold text-rose-700">
                          {formatUsd(summary.totalLongUsd)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Short liquidations</span>
                        <span className="font-semibold text-emerald-700">
                          {formatUsd(summary.totalShortUsd)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Largest clusters
                      </p>
                      {summary.recentClusters.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">
                          No recent clusters in lookback window.
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2 text-xs text-slate-600">
                          {summary.recentClusters.map((cluster) => (
                            <div
                              key={`${cluster.exchange}-${cluster.timestamp}-${cluster.notional}`}
                              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                            >
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {cluster.exchange} {cluster.contract ?? ""}
                                </p>
                                <p>{formatTime(cluster.timestamp)}</p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`font-semibold ${
                                    cluster.side === "long"
                                      ? "text-rose-700"
                                      : "text-emerald-700"
                                  }`}
                                >
                                  {cluster.side.toUpperCase()}
                                </p>
                                <p>{formatUsd(cluster.notional)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {assetClass === "crypto" ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Bitget Futures Pulse
              </h2>
              <p className="text-sm text-slate-600">
                Funding + open interest snapshots for BTC/ETH perpetuals.
              </p>
            </div>
            {bitgetSnapshots.length === 0 ? (
              <p className="text-sm text-slate-500">
                No Bitget data available yet.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {bitgetSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.symbol}
                    className="rounded-xl border border-slate-200 bg-white/90 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {snapshot.symbol}
                      </h3>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {snapshot.productType}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>Last price</span>
                        <span className="font-semibold">
                          {snapshot.lastPrice ?? "--"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Funding rate</span>
                        <span className="font-semibold">
                          {snapshot.fundingRate !== null
                            ? snapshot.fundingRate.toFixed(6)
                            : "--"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Open interest</span>
                        <span className="font-semibold">
                          {snapshot.openInterest ?? "--"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Updated{" "}
                      {snapshot.lastPriceTime
                        ? formatTime(snapshot.lastPriceTime)
                        : "unknown"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Sentiment Details
              </h2>
              <p className="text-sm text-slate-600">
                Detailed positioning and confidence scores
              </p>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-white/80 text-xs uppercase text-slate-500 backdrop-blur-sm">
                  <tr>
                    <th className="py-2">Pair</th>
                    <th className="py-2">Long %</th>
                    <th className="py-2">Net</th>
                    <th className="py-2">State</th>
                    <th className="py-2">Conf</th>
                  </tr>
                </thead>
                <tbody className="text-slate-900">
                  {sortedAggregates.map((agg) => (
                    <tr
                      key={agg.symbol}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-2 font-semibold">{agg.symbol}</td>
                      <td className="py-2">{agg.agg_long_pct.toFixed(1)}%</td>
                      <td className="py-2">{formatPercent(agg.agg_net)}</td>
                      <td
                        className={`py-2 text-xs font-semibold ${crowdingTone(
                          agg.crowding_state,
                        )}`}
                      >
                        {agg.crowding_state.replace("_", " ")}
                      </td>
                      <td className="py-2 text-xs">{agg.confidence_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Data Sources
              </h2>
              <p className="text-sm text-slate-600">
                Provider health and last update times
              </p>
            </div>
            <div className="space-y-4">
              {sources.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No source data yet. Trigger a manual refresh to fetch sentiment.
                </p>
              ) : (
                sources.map((source) => (
                  <div
                    key={source.name}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">
                        {source.name}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${sourceTone(
                          source.status,
                        )}`}
                      >
                        {source.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      {source.last_success_at ? (
                        <p>
                          Last success:{" "}
                          {new Date(source.last_success_at).toLocaleString()}
                        </p>
                      ) : (
                        <p>No successful fetches yet</p>
                      )}
                      {source.last_error && (
                        <p className="mt-1 text-rose-600">
                          Error: {source.last_error}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <RefreshSentimentButton />
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
