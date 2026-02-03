import DashboardLayout from "@/components/DashboardLayout";
import SentimentHeatmap from "@/components/SentimentHeatmap";
import PageTabs from "@/components/PageTabs";
import ViewToggle from "@/components/ViewToggle";
import SummaryCards from "@/components/SummaryCards";
import { fetchLiquidationSummary } from "@/lib/coinank";
import { fetchBitgetFuturesSnapshot } from "@/lib/bitget";
import { fetchCryptoSpotPrice } from "@/lib/cryptoPrices";
import {
  getAggregatesForWeekStart,
  getLatestAggregates,
  getLatestAggregatesLocked,
} from "@/lib/sentiment/store";
import { formatDateTimeET, latestIso } from "@/lib/time";
import { DateTime } from "luxon";
import {
  SENTIMENT_ASSET_CLASSES,
  ALL_SENTIMENT_SYMBOLS,
  type SentimentAssetClass,
} from "@/lib/sentiment/symbols";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import {
  getWeekOpenUtc,
  listPerformanceWeeks,
  readPerformanceSnapshotsByWeek,
  weekLabelFromOpen,
} from "@/lib/performanceSnapshots";

export const revalidate = 120;

type SentimentPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

type SentimentView = SentimentAssetClass | "all";

function getAssetClass(value?: string | null): SentimentView {
  if (!value || value === "all") {
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
  const weekParam = resolvedSearchParams?.week;
  const viewParam = resolvedSearchParams?.view;
  const assetClass = getAssetClass(
    Array.isArray(assetParam) ? assetParam[0] : assetParam,
  );
  const view =
    viewParam === "list" || viewParam === "heatmap" ? viewParam : "heatmap";
  const weekValue = Array.isArray(weekParam) ? weekParam[0] : weekParam;

  const weeks = await listPerformanceWeeks();
  const selectedWeek = weekValue && weeks.includes(weekValue) ? weekValue : weeks[0] ?? null;
  const currentWeekOpen = getWeekOpenUtc();
  const isCurrentWeek = !selectedWeek || selectedWeek === currentWeekOpen;

  let aggregates: SentimentAggregate[] = [];
  try {
    if (selectedWeek && !isCurrentWeek) {
      const open = DateTime.fromISO(selectedWeek, { zone: "utc" });
      const close = open.isValid ? open.plus({ days: 7 }) : open;
      aggregates = open.isValid
        ? await getAggregatesForWeekStart(
            open.toUTC().toISO() ?? selectedWeek,
            close.toUTC().toISO() ?? selectedWeek,
          )
        : await getLatestAggregatesLocked();
    } else {
      // Current week is live for manual trading visibility (hourly refresh + flips).
      aggregates = await getLatestAggregates();
    }
  } catch (error) {
    console.error(
      "Sentiment load failed:",
      error instanceof Error ? error.message : String(error),
    );
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
  const latestAggregateTimestamp = latestIso(
    filteredAggregates.map((agg) => agg.timestamp_utc),
  );

  const crowdedLong = filteredAggregates.filter(
    (a) => a.crowding_state === "CROWDED_LONG",
  ).length;
  const crowdedShort = filteredAggregates.filter(
    (a) => a.crowding_state === "CROWDED_SHORT",
  ).length;
  const neutral = filteredAggregates.filter(
    (a) => a.crowding_state === "NEUTRAL",
  ).length;
  const flips = filteredAggregates.filter((a) => a.flip_state !== "NONE").length;

  const performanceByPair: Record<string, number | null> = {};
  if (selectedWeek) {
    try {
      const weekSnapshots = await readPerformanceSnapshotsByWeek(selectedWeek);
      weekSnapshots
        .filter((row) => row.model === "sentiment")
        .forEach((row) => {
          row.pair_details.forEach((detail) => {
            performanceByPair[detail.pair] = detail.percent ?? null;
          });
        });
    } catch (error) {
      console.error("Sentiment performance load failed:", error);
    }
  }
  const viewParams = new URLSearchParams();
  if (selectedWeek) {
    viewParams.set("week", selectedWeek);
  }
  viewParams.set("asset", assetClass);
  const viewItems = (["heatmap", "list"] as const).map((option) => {
    const params = new URLSearchParams(viewParams);
    params.set("view", option);
    return {
      value: option,
      label: option,
      href: `/sentiment?${params.toString()}`,
    };
  });

  let liquidationSummaries: Array<
    Awaited<ReturnType<typeof fetchLiquidationSummary>>
  > = [];
  let bitgetSnapshots: Array<
    Awaited<ReturnType<typeof fetchBitgetFuturesSnapshot>>
  > = [];
  if (assetClass === "crypto") {
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
    try {
      const priceMap = new Map<"BTC" | "ETH", { price: number; source: "Bitget Futures" | "CMC Spot" }>();

      for (const snapshot of bitgetSnapshots) {
        const base = snapshot.symbol.startsWith("BTC") ? "BTC" : "ETH";
        if (Number.isFinite(snapshot.lastPrice) && snapshot.lastPrice !== null) {
          priceMap.set(base, { price: snapshot.lastPrice, source: "Bitget Futures" });
        }
      }

      for (const base of ["BTC", "ETH"] as const) {
        if (!priceMap.has(base)) {
          const spot = await fetchCryptoSpotPrice(base);
          if (Number.isFinite(spot ?? NaN)) {
            priceMap.set(base, { price: spot as number, source: "CMC Spot" });
          }
        }
      }

      liquidationSummaries = await Promise.all([
        fetchLiquidationSummary("BTC", priceMap.get("BTC")?.price, priceMap.get("BTC")?.source),
        fetchLiquidationSummary("ETH", priceMap.get("ETH")?.price, priceMap.get("ETH")?.source),
      ]);
    } catch (error) {
      console.error(
        "Coinank liquidation load failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Sentiment</h1>
          <PageTabs />
        </header>

        <SummaryCards
          title="Sentiment"
          cards={[
            { id: "pairs", label: "Pairs tracked", value: String(filteredAggregates.length) },
            { id: "long", label: "Crowded long", value: String(crowdedLong), tone: "negative" },
            { id: "short", label: "Crowded short", value: String(crowdedShort), tone: "positive" },
            { id: "neutral", label: "Neutral", value: String(neutral) },
            { id: "flips", label: "Flips", value: String(flips) },
          ]}
        />

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <form action="/sentiment" method="get" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="view" value={view} />
              <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Week
              </label>
              <select
                name="week"
                defaultValue={selectedWeek ?? ""}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {weeks.map((week) => (
                  <option key={week} value={week}>
                    {weekLabelFromOpen(week)}
                  </option>
                ))}
              </select>
              <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Asset class
              </label>
              <select
                name="asset"
                defaultValue={assetClass}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <option value="all">ALL</option>
                {Object.entries(SENTIMENT_ASSET_CLASSES).map(([id, info]) => (
                  <option key={id} value={id}>
                    {info.label}
                  </option>
                ))}
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

          <div className="mt-6">
            <SentimentHeatmap
              aggregates={sortedAggregates}
              view={view}
              performanceByPair={performanceByPair}
            />
          </div>
        </section>

        {assetClass === "crypto" && liquidationSummaries.length > 0 ? (
          <section className="grid gap-6 lg:grid-cols-2">
            {liquidationSummaries.map((summary) => (
              <div
                key={summary.baseCoin}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">
                      {summary.baseCoin} Liquidations
                    </h2>
                    <p className="text-sm text-[color:var(--muted)]">
                      Recent liquidation clusters from Coinank.
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Updated {formatDateTimeET(summary.lastUpdated)}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)]/80">
                  <div className="flex items-center justify-between">
                    <span>Long liquidations</span>
                    <span className="font-semibold text-rose-700">
                      {summary.totalLongUsd.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Short liquidations</span>
                    <span className="font-semibold text-[var(--accent-strong)]">
                      {summary.totalShortUsd.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Dominant: {summary.dominantSide}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {latestAggregateTimestamp
            ? `Last refresh ${formatDateTimeET(latestAggregateTimestamp)}`
            : "No refresh yet"}
        </div>
      </div>
    </DashboardLayout>
  );
}
