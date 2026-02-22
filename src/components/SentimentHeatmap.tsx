"use client";

import type { SentimentAggregate } from "@/lib/sentiment/types";
import PairSignalSurface, {
  type PairSignalSurfaceItem,
} from "@/components/PairSignalSurface";

type SentimentHeatmapProps = {
  aggregates: SentimentAggregate[];
  view?: "heatmap" | "list";
  performanceByPair?: Record<string, number | null>;
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
}: SentimentHeatmapProps) {
  const sorted = [...aggregates].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const items: PairSignalSurfaceItem[] = sorted.map((agg) => ({
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
    ],
    performancePercent: performanceByPair[agg.symbol] ?? null,
  }));

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
