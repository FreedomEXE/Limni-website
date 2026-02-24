"use client";

import type { SentimentAggregate } from "@/lib/sentiment/types";
import PairSignalSurface, {
  type PairSignalSurfaceItem,
} from "@/components/PairSignalSurface";

export type MyfxbookPositioning = {
  longLots: number | null;
  shortLots: number | null;
  totalLots: number | null;
  longPositions: number | null;
  shortPositions: number | null;
  totalPositions: number | null;
  avgLongPrice: number | null;
  avgShortPrice: number | null;
  updatedAtUtc: string | null;
};

type SentimentHeatmapProps = {
  aggregates: SentimentAggregate[];
  view?: "heatmap" | "list";
  performanceByPair?: Record<string, number | null>;
  myfxbookPositioningBySymbol?: Record<string, MyfxbookPositioning | undefined>;
};

function crowdingTone(
  state: SentimentAggregate["crowding_state"],
): PairSignalSurfaceItem["tone"] {
  if (state === "CROWDED_LONG") {
    return "negative";
  }
  if (state === "CROWDED_SHORT") {
    return "positive";
  }
  return "neutral";
}

export default function SentimentHeatmap({
  aggregates,
  view = "heatmap",
  performanceByPair = {},
  myfxbookPositioningBySymbol = {},
}: SentimentHeatmapProps) {
  const formatLots = (value: number | null) =>
    value === null || !Number.isFinite(value) ? "—" : value.toFixed(2);
  const formatCount = (value: number | null) =>
    value === null || !Number.isFinite(value) ? "—" : Math.round(value).toLocaleString();
  const formatPrice = (value: number | null) =>
    value === null || !Number.isFinite(value) ? "—" : value.toFixed(5);

  const sorted = [...aggregates].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const items: PairSignalSurfaceItem[] = sorted.map((agg) => {
    const myfxbook = myfxbookPositioningBySymbol[agg.symbol];
    return {
      id: agg.symbol,
      label: agg.symbol,
      tone: crowdingTone(agg.crowding_state),
      statusLabel: agg.crowding_state.replace("_", " "),
      modalTitle: agg.symbol,
      modalDetails: [
        { label: "Long", value: `${agg.agg_long_pct.toFixed(1)}%` },
        { label: "Short", value: `${agg.agg_short_pct.toFixed(1)}%` },
        { label: "Net", value: agg.agg_net.toFixed(1) },
        { label: "Crowding", value: agg.crowding_state.replace("_", " ") },
        { label: "Flip", value: agg.flip_state.replace("_", " ") },
        { label: "Confidence", value: String(agg.confidence_score) },
        { label: "Sources", value: agg.sources_used.join(", ") || "—" },
        { label: "Myfxbook lots long", value: formatLots(myfxbook?.longLots ?? null) },
        { label: "Myfxbook lots short", value: formatLots(myfxbook?.shortLots ?? null) },
        { label: "Myfxbook lots total", value: formatLots(myfxbook?.totalLots ?? null) },
        {
          label: "Myfxbook positions long",
          value: formatCount(myfxbook?.longPositions ?? null),
        },
        {
          label: "Myfxbook positions short",
          value: formatCount(myfxbook?.shortPositions ?? null),
        },
        {
          label: "Myfxbook positions total",
          value: formatCount(myfxbook?.totalPositions ?? null),
        },
        {
          label: "Myfxbook avg long price",
          value: formatPrice(myfxbook?.avgLongPrice ?? null),
        },
        {
          label: "Myfxbook avg short price",
          value: formatPrice(myfxbook?.avgShortPrice ?? null),
        },
        {
          label: "Myfxbook updated (UTC)",
          value: myfxbook?.updatedAtUtc ?? "—",
        },
      ],
      performancePercent: performanceByPair[agg.symbol] ?? null,
    };
  });

  return (
    <PairSignalSurface
      title="Retail Sentiment Heatmap"
      description="Crowding indicators across FX pairs"
      items={items}
      view={view}
      emptyTitle="No sentiment data yet"
      emptyDescription="Trigger a manual refresh or start the sentiment poller"
    />
  );
}
