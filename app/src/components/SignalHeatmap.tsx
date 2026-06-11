"use client";

import PairSignalSurface, {
  type PairSignalSurfaceItem,
} from "@/components/PairSignalSurface";
import type { ReturnMatrix } from "@/lib/viewMode/resolveDisplayValue";

type SignalRow = {
  pair: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  assetLabel: string;
  reasons: string[];
};

type SignalHeatmapProps = {
  signals: SignalRow[];
  view: "heatmap" | "list";
  performanceByPair?: Record<string, number | ReturnMatrix | null>;
  title?: string;
  description?: string;
};

function isReturnMatrix(value: number | ReturnMatrix | null | undefined): value is ReturnMatrix {
  return Boolean(value && typeof value === "object" && "adrPct" in value);
}

function signalTone(
  direction: SignalRow["direction"],
): PairSignalSurfaceItem["tone"] {
  if (direction === "LONG") {
    return "positive";
  }
  if (direction === "SHORT") {
    return "negative";
  }
  return "neutral";
}

export default function SignalHeatmap({
  signals,
  view,
  performanceByPair = {},
  title = "Antikythera Signals",
  description = "Bias and sentiment aligned trading opportunities",
}: SignalHeatmapProps) {
  const items: PairSignalSurfaceItem[] = signals.map((signal) => {
    const key = `${signal.pair} (${signal.assetLabel})`;
    const performance = performanceByPair[key] ?? null;
    const details =
      signal.reasons.length > 0
        ? signal.reasons.map((reason, index) => ({
            label: `Reason ${index + 1}`,
            value: reason,
          }))
        : [{ label: "Reason", value: "No explanation available." }];
    return {
      id: key,
      label: signal.pair,
      tone: signalTone(signal.direction),
      statusLabel: signal.direction,
      secondaryLabel: signal.assetLabel,
      modalTitle: `${signal.pair} ${signal.direction}`,
      modalSubtitle: signal.assetLabel,
      modalDetails: details,
      performancePercent: typeof performance === "number" ? performance : null,
      returnMatrix: isReturnMatrix(performance) ? performance : null,
    };
  });

  return (
    <PairSignalSurface
      title={title}
      description={description}
      items={items}
      view={view}
      emptyTitle="No aligned signals yet"
      emptyDescription="Signals appear when bias and sentiment align"
    />
  );
}
