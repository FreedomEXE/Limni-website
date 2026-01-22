"use client";

import { useState } from "react";
import type { SentimentAggregate } from "@/lib/sentiment/types";

type SentimentHeatmapProps = {
  aggregates: SentimentAggregate[];
};

function getCrowdingColor(state: string): string {
  switch (state) {
    case "CROWDED_LONG":
      return "bg-rose-400";
    case "CROWDED_SHORT":
      return "bg-emerald-500";
    default:
      return "bg-[var(--panel-border)]/60";
  }
}

export default function SentimentHeatmap({
  aggregates,
}: SentimentHeatmapProps) {
  const [active, setActive] = useState<SentimentAggregate | null>(null);
  if (aggregates.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Retail Sentiment Heatmap
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Crowding indicators across FX pairs
          </p>
        </div>
        <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70">
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">No sentiment data yet</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Trigger a manual refresh or start the sentiment poller
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...aggregates].sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Retail Sentiment Heatmap
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Crowding indicators across FX pairs
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {sorted.map((agg) => (
          <div
            key={agg.symbol}
            className="group relative overflow-hidden rounded-lg border border-[var(--panel-border)]"
          >
            <div
              className={`flex flex-col items-center justify-center p-4 transition ${getCrowdingColor(
                agg.crowding_state,
              )}`}
              role="button"
              tabIndex={0}
              onClick={() => setActive(agg)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setActive(agg);
                }
              }}
            >
              <div className="text-xs font-bold text-white">{agg.symbol}</div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/90 opacity-0 transition group-hover:opacity-100">
              <div className="text-center text-xs text-white">
                <p className="font-semibold">{agg.symbol}</p>
                <p className="mt-1">Long: {agg.agg_long_pct.toFixed(1)}%</p>
                <p>Short: {agg.agg_short_pct.toFixed(1)}%</p>
                <p className="mt-1 text-[10px]">
                  Confidence: {agg.confidence_score}
                </p>
                <p className="text-[10px]">
                  Sources: {agg.sources_used.length}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[var(--panel-border)] pt-4">
        <div className="flex gap-4 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-rose-400 opacity-100" />
            <span>Crowded Long</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-emerald-500 opacity-100" />
            <span>Crowded Short</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-[var(--panel-border)]/60 opacity-100" />
            <span>Neutral</span>
          </div>
        </div>
        {aggregates[0] && (
          <p className="text-xs text-[var(--muted)]">
            Updated {new Date(aggregates[0].timestamp_utc).toLocaleTimeString()}
          </p>
        )}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 p-6"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Sentiment detail
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {active.symbol}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Long</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {active.agg_long_pct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Short</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {active.agg_short_pct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Net</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {active.agg_net.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Crowding</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {active.crowding_state.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Flip state</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {active.flip_state.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Confidence</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {active.confidence_score}
                </span>
              </div>
              <div className="pt-2 text-xs text-[color:var(--muted)]">
                Sources: {active.sources_used.join(", ")}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
