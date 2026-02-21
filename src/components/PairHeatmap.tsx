"use client";

import type { Direction } from "@/lib/cotTypes";
import type { PairPerformance } from "@/lib/priceStore";
import PairSignalSurface, {
  type PairSignalSurfaceItem,
} from "@/components/PairSignalSurface";

type PairRow = {
  pair: string;
  direction: Direction;
  performance?: PairPerformance | null;
  subtitle?: string;
  details?: Array<{ label: string; value: string }>;
};

type PairHeatmapProps = {
  rows: PairRow[];
  view: "heatmap" | "list";
  title?: string;
  description?: string;
  note?: string;
  missingPairs?: string[];
};

function tone(direction: Direction): PairSignalSurfaceItem["tone"] {
  if (direction === "LONG") {
    return "positive";
  }
  if (direction === "SHORT") {
    return "negative";
  }
  return "neutral";
}

function cleanPairName(pair: string): string {
  // Remove asset class suffixes like "(FX)", "(Crypto)", etc.
  return pair.replace(/\s*\([^)]+\)\s*$/, "");
}

export default function PairHeatmap({
  rows,
  view,
  title = "Bias Heatmap",
  description = "COT positioning bias across pairs",
  note,
  missingPairs,
}: PairHeatmapProps) {
  const items: PairSignalSurfaceItem[] = rows.map((row) => ({
    id: row.pair,
    label: cleanPairName(row.pair),
    tone: tone(row.direction),
    statusLabel: row.direction,
    secondaryLabel: row.subtitle,
    modalTitle: `${cleanPairName(row.pair)} ${row.direction}`,
    modalSubtitle: row.subtitle,
    modalDetails:
      row.details && row.details.length > 0
        ? row.details
        : [{ label: "Direction", value: row.direction }],
    performancePercent: row.performance?.percent ?? null,
    performanceNote: note,
  }));

  const footerContent =
    note || (missingPairs && missingPairs.length > 0) ? (
      <div className="space-y-3 text-xs text-[color:var(--muted)]">
        {note ? <p>{note}</p> : null}
        {missingPairs && missingPairs.length > 0 ? (
          <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent-strong)]">
            Missing prices for: {missingPairs.join(", ")}
          </div>
        ) : null}
      </div>
    ) : undefined;

  return (
    <PairSignalSurface
      title={title}
      description={description}
      items={items}
      view={view}
      emptyTitle="No tradable pairs yet"
      emptyDescription="Pairs will appear when bias signals are available"
      footerContent={footerContent}
    />
  );
}
