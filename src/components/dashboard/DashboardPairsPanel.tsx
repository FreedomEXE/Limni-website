"use client";

import { useMemo, useState } from "react";
import PairHeatmap from "@/components/PairHeatmap";
import type { Direction } from "@/lib/cotTypes";
import type { PairPerformance } from "@/lib/priceStore";

type PairRow = {
  pair: string;
  direction: Direction;
  performance: PairPerformance | null;
};

type DashboardPairsPanelProps = {
  initialView: "heatmap" | "list";
  rows: PairRow[];
  note: string;
  missingPairs: string[];
};

function setViewQueryParam(nextView: "heatmap" | "list") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("view", nextView);
  window.history.replaceState({}, "", url.toString());
}

export default function DashboardPairsPanel({
  initialView,
  rows,
  note,
  missingPairs,
}: DashboardPairsPanelProps) {
  const [view, setView] = useState<"heatmap" | "list">(initialView);

  const viewTabs = useMemo(
    () => [
      { value: "heatmap" as const, label: "Heatmap" },
      { value: "list" as const, label: "List" },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-border)] bg-[var(--panel)] p-1">
          {viewTabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setView(item.value);
                setViewQueryParam(item.value);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                view === item.value
                  ? "border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "text-[color:var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div data-cot-surface="true">
        <PairHeatmap
          rows={rows}
          view={view}
          note={note}
          missingPairs={missingPairs}
        />
      </div>
    </div>
  );
}
