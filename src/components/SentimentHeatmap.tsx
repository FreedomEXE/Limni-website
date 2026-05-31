"use client";

import type { SentimentAggregate } from "@/lib/sentiment/types";
import type { ReturnMatrix } from "@/lib/viewMode/resolveDisplayValue";
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

export type CanonicalSentimentHeatmapRow = {
  symbol: string;
  assetClass?: string;
  direction: "LONG" | "SHORT";
  tier: "S1" | "A" | "R" | "F";
  tierFSubStep?: "prior_s1" | "prior_lean" | "two_week_lean" | "hardcoded" | null;
};

type SentimentHeatmapProps = {
  aggregates: SentimentAggregate[];
  resolvedRows?: CanonicalSentimentHeatmapRow[];
  view?: "heatmap" | "list";
  performanceByPair?: Record<string, number | ReturnMatrix | null>;
  myfxbookPositioningBySymbol?: Record<string, MyfxbookPositioning | undefined>;
};

function isReturnMatrix(value: number | ReturnMatrix | null | undefined): value is ReturnMatrix {
  return Boolean(value && typeof value === "object" && "adrPct" in value);
}

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

function tradeBiasLabel(
  state: SentimentAggregate["crowding_state"],
): string {
  if (state === "CROWDED_LONG") {
    return "SHORT";
  }
  if (state === "CROWDED_SHORT") {
    return "LONG";
  }
  return "NEUTRAL";
}

function canonicalTone(
  direction: "LONG" | "SHORT",
): PairSignalSurfaceItem["tone"] {
  return direction === "LONG" ? "positive" : "negative";
}

function tierLabel(row: CanonicalSentimentHeatmapRow | undefined) {
  if (!row) return "Raw crowding";
  if (row.tier !== "F") return `Tier ${row.tier}`;
  return row.tierFSubStep ? `Tier F · ${row.tierFSubStep}` : "Tier F";
}

export default function SentimentHeatmap({
  aggregates,
  resolvedRows = [],
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

  const aggregateBySymbol = new Map(aggregates.map((agg) => [agg.symbol, agg] as const));
  const resolvedBySymbol = new Map(resolvedRows.map((row) => [row.symbol, row] as const));
  const symbols = resolvedRows.length > 0
    ? resolvedRows.map((row) => row.symbol).sort((a, b) => a.localeCompare(b))
    : [...aggregates].map((agg) => agg.symbol).sort((a, b) => a.localeCompare(b));
  const items: PairSignalSurfaceItem[] = symbols.map((symbol) => {
    const agg = aggregateBySymbol.get(symbol);
    const resolved = resolvedBySymbol.get(symbol);
    const myfxbook = myfxbookPositioningBySymbol[symbol];
    const performance = performanceByPair[symbol] ?? null;
    const crowdingState = agg?.crowding_state ?? "NEUTRAL";
    const canonicalDirection = resolved?.direction ?? tradeBiasLabel(crowdingState);
    return {
      id: symbol,
      label: symbol,
      tone: resolved ? canonicalTone(resolved.direction) : crowdingTone(crowdingState),
      statusLabel: canonicalDirection,
      secondaryLabel: `${tierLabel(resolved)} · ${crowdingState.replace("_", " ")}`,
      modalTitle: symbol,
      modalDetails: [
        { label: "Trade Bias", value: canonicalDirection },
        { label: "Resolver Tier", value: tierLabel(resolved) },
        { label: "Long", value: agg ? `${agg.agg_long_pct.toFixed(1)}%` : "—" },
        { label: "Short", value: agg ? `${agg.agg_short_pct.toFixed(1)}%` : "—" },
        { label: "Net", value: agg ? agg.agg_net.toFixed(1) : "—" },
        { label: "Crowding", value: crowdingState.replace("_", " ") },
        { label: "Flip", value: agg ? agg.flip_state.replace("_", " ") : "—" },
        { label: "Confidence", value: agg ? String(agg.confidence_score) : "—" },
        { label: "Sources", value: agg ? agg.sources_used.join(", ") || "—" : "—" },
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
      performancePercent: typeof performance === "number" ? performance : null,
      returnMatrix: isReturnMatrix(performance) ? performance : null,
    };
  });

  return (
    <PairSignalSurface
      title="Retail Sentiment Heatmap"
      description="Contrarian trade direction derived from retail crowding"
      items={items}
      view={view}
      emptyTitle="No sentiment data yet"
      emptyDescription="Trigger a manual refresh or start the sentiment poller"
    />
  );
}
