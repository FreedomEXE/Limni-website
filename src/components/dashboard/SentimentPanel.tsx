/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: SentimentPanel.tsx
 *
 * Description:
 * Server component that renders the sentiment content panel.
 * Layout matches Dealer/Commercial: header → cards → filters+heatmap.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import SentimentHeatmap, {
  type MyfxbookPositioning,
} from "@/components/SentimentHeatmap";
import SegmentedToggle from "@/components/common/SegmentedToggle";
import SummaryCards from "@/components/SummaryCards";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import {
  getAggregatesForWeekStartWithBackfill,
  getLatestAggregatesLocked,
  getLatestSnapshotsByProvider,
} from "@/lib/sentiment/store";
import { formatDateTimeET, latestIso } from "@/lib/time";
import { DateTime } from "luxon";
import {
  SENTIMENT_ASSET_CLASSES,
  ALL_SENTIMENT_SYMBOLS,
  type SentimentAssetClass,
} from "@/lib/sentiment/symbols";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { loadWeeklyReturnDisplayRows } from "@/lib/weeklyReturnDisplay";
import type { ReturnMatrix } from "@/lib/viewMode/resolveDisplayValue";

type MyfxbookRawPayload = {
  longVolume?: number | string;
  shortVolume?: number | string;
  longPositions?: number | string;
  shortPositions?: number | string;
  totalPositions?: number | string;
  avgLongPrice?: number | string;
  avgShortPrice?: number | string;
};

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") { const p = Number(value); return Number.isFinite(p) ? p : null; }
  return null;
}

function parseMyfxbookPositioning(payload: unknown, timestampUtc: string): MyfxbookPositioning | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as MyfxbookRawPayload;
  const longLots = toNullableNumber(row.longVolume);
  const shortLots = toNullableNumber(row.shortVolume);
  return {
    longLots, shortLots,
    totalLots: longLots !== null && shortLots !== null ? longLots + shortLots : null,
    longPositions: toNullableNumber(row.longPositions),
    shortPositions: toNullableNumber(row.shortPositions),
    totalPositions: toNullableNumber(row.totalPositions),
    avgLongPrice: toNullableNumber(row.avgLongPrice),
    avgShortPrice: toNullableNumber(row.avgShortPrice),
    updatedAtUtc: timestampUtc || null,
  };
}

type SentimentPanelProps = {
  weekOpenUtc: string | null;
  assetClass: string;
  view: "heatmap" | "list";
  reportOptions: Array<{ value: string; label: string }>;
  selectedReport: string;
  currentWeekOpenUtc: string;
  viewItems: Array<{ value: "heatmap" | "list"; label: string; href: string }>;
};

export default async function SentimentPanel({
  weekOpenUtc, assetClass, view,
  reportOptions, selectedReport, currentWeekOpenUtc, viewItems,
}: SentimentPanelProps) {
  const sentimentAsset: SentimentAssetClass | "all" =
    assetClass === "all" || !(assetClass in SENTIMENT_ASSET_CLASSES)
      ? "all"
      : (assetClass as SentimentAssetClass);

  let aggregates: SentimentAggregate[] = [];
  let previousAggregates: SentimentAggregate[] = [];
  try {
    if (weekOpenUtc) {
      const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
      const close = open.isValid ? open.plus({ days: 7 }) : open;
      aggregates = open.isValid
        ? await getAggregatesForWeekStartWithBackfill(open.toUTC().toISO() ?? weekOpenUtc, close.toUTC().toISO() ?? weekOpenUtc)
        : await getLatestAggregatesLocked();
      const prevOpen = open.isValid ? open.minus({ days: 7 }) : null;
      if (prevOpen?.isValid) {
        const prevClose = prevOpen.plus({ days: 7 });
        previousAggregates = await getAggregatesForWeekStartWithBackfill(prevOpen.toUTC().toISO()!, prevClose.toUTC().toISO()!);
      }
    } else {
      aggregates = await getLatestAggregatesLocked();
    }
  } catch (error) {
    console.error("Sentiment load failed:", error instanceof Error ? error.message : String(error));
  }

  const symbols = sentimentAsset === "all" ? ALL_SENTIMENT_SYMBOLS : SENTIMENT_ASSET_CLASSES[sentimentAsset].symbols;
  const filteredAggregates = aggregates.filter((agg) => symbols.includes(agg.symbol));
  const sortedAggregates = filteredAggregates.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const latestAggregateTimestamp = latestIso(filteredAggregates.map((agg) => agg.timestamp_utc));

  const crowdedLong = filteredAggregates.filter((a) => a.crowding_state === "CROWDED_LONG").length;
  const crowdedShort = filteredAggregates.filter((a) => a.crowding_state === "CROWDED_SHORT").length;
  const neutral = filteredAggregates.filter((a) => a.crowding_state === "NEUTRAL").length;
  const previousBySymbol = new Map(
    previousAggregates.filter((agg) => symbols.includes(agg.symbol)).map((agg) => [agg.symbol, agg.crowding_state]),
  );
  const flipDetails = filteredAggregates
    .map((agg) => {
      const prior = previousBySymbol.get(agg.symbol);
      if (!prior || prior === agg.crowding_state) return null;
      return { label: agg.symbol, value: `${prior.replace("CROWDED_", "")} → ${agg.crowding_state.replace("CROWDED_", "")}` };
    })
    .filter((d): d is { label: string; value: string } => Boolean(d));

  const shortTradeDetails = sortedAggregates
    .filter((agg) => agg.crowding_state === "CROWDED_LONG")
    .map((agg) => ({ label: agg.symbol, value: "Crowded Long" }));
  const longTradeDetails = sortedAggregates
    .filter((agg) => agg.crowding_state === "CROWDED_SHORT")
    .map((agg) => ({ label: agg.symbol, value: "Crowded Short" }));
  const neutralDetails = sortedAggregates.filter((agg) => agg.crowding_state === "NEUTRAL").map((agg) => ({ label: agg.symbol, value: "NEUTRAL" }));

  const performanceByPair: Record<string, ReturnMatrix | null> = {};
  if (weekOpenUtc) {
    try {
      const weeklyReturns = await loadWeeklyReturnDisplayRows(weekOpenUtc);
      weeklyReturns.forEach((row) => {
        performanceByPair[row.symbol] = {
          canonical: row.canonical,
          execution: row.execution,
          adrPct: row.adrPct,
        };
      });
    } catch {}
  }

  let myfxbookPositioningBySymbol: Record<string, MyfxbookPositioning | undefined> = {};
  try {
    const myfxbookSnapshots = await getLatestSnapshotsByProvider("MYFXBOOK", Array.from(symbols));
    myfxbookPositioningBySymbol = myfxbookSnapshots.reduce<Record<string, MyfxbookPositioning | undefined>>((acc, snapshot) => {
      acc[snapshot.symbol] = parseMyfxbookPositioning(snapshot.raw_payload, snapshot.timestamp_utc) ?? undefined;
      return acc;
    }, {});
  } catch {}

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-[var(--foreground)]">Sentiment</h1>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {latestAggregateTimestamp ? `Last refresh ${formatDateTimeET(latestAggregateTimestamp)}` : "No refresh yet"}
        </div>
      </header>

      <SummaryCards
        title="Sentiment"
        cards={[
          { id: "pairs", label: "Pairs tracked", value: String(filteredAggregates.length),
            details: sortedAggregates.map((agg) => ({ label: agg.symbol, value: agg.crowding_state.replace("CROWDED_", "") })) },
          { id: "short", label: "Short", value: String(crowdedLong), tone: "negative", details: shortTradeDetails },
          { id: "long", label: "Long", value: String(crowdedShort), tone: "positive", details: longTradeDetails },
          { id: "neutral", label: "Neutral", value: String(neutral), details: neutralDetails },
          { id: "flips", label: "Flips", value: String(flipDetails.length), details: flipDetails },
        ]}
      />

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <DashboardFilters
            assetOptions={[
              { id: "all", label: "ALL" },
              { id: "fx", label: "FX" },
              { id: "indices", label: "Indices" },
              { id: "crypto", label: "Crypto" },
              { id: "commodities", label: "Commodities" },
            ]}
            reportOptions={reportOptions}
            selectedAsset={assetClass}
            selectedReport={selectedReport}
            selectedBias="sentiment"
            selectedView={view}
            currentWeekOpenUtc={currentWeekOpenUtc}
          />
          <SegmentedToggle value={view} items={viewItems} />
        </div>
        <div className="mt-6">
          <SentimentHeatmap
            aggregates={sortedAggregates}
            view={view}
            performanceByPair={performanceByPair}
            myfxbookPositioningBySymbol={myfxbookPositioningBySymbol}
          />
        </div>
      </section>
    </>
  );
}
