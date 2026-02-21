"use client";

import { useState } from "react";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { formatDateTimeET, latestIso } from "@/lib/time";
import PairModal from "@/components/PairModal";

type SentimentHeatmapProps = {
  aggregates: SentimentAggregate[];
  view?: "heatmap" | "list";
  performanceByPair?: Record<string, number | null>;
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
  view = "heatmap",
  performanceByPair = {},
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
  const latestAggregateTimestamp = latestIso(
    aggregates.map((aggregate) => aggregate.timestamp_utc),
  );

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

      {view === "heatmap" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {sorted.map((agg) => (
            <div
              key={agg.symbol}
              className="group relative min-h-[96px] overflow-hidden rounded-lg border border-[var(--panel-border)]"
            >
              <div
                className={`flex h-full flex-col items-center justify-center px-4 py-3 transition ${getCrowdingColor(
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

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/90 opacity-0 transition group-hover:opacity-100">
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
      ) : (
        <div className="space-y-2">
          {sorted.map((agg) => {
            const percent = performanceByPair[agg.symbol] ?? null;
            const percentLabel =
              percent === null || !Number.isFinite(percent)
                ? "—"
                : `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
            const percentTone =
              percent === null || !Number.isFinite(percent)
                ? "text-[var(--muted)]"
                : percent > 0
                  ? "text-emerald-600"
                  : percent < 0
                    ? "text-rose-600"
                    : "text-[var(--foreground)]";
            return (
              <button
                key={agg.symbol}
                type="button"
                onClick={() => setActive(agg)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-left text-sm transition hover:border-[var(--accent)]"
              >
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {agg.symbol}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {agg.crowding_state.replace("_", " ")}
                  </p>
                </div>
                <span className={`text-xs font-semibold ${percentTone}`}>
                  {percentLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

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
        {latestAggregateTimestamp && (
          <p className="text-xs text-[var(--muted)]">
            Updated {formatDateTimeET(latestAggregateTimestamp)}
          </p>
        )}
      </div>

      {active ? (
        <PairModal
          title={active.symbol}
          onClose={() => setActive(null)}
          details={[
            { label: "Long", value: `${active.agg_long_pct.toFixed(1)}%` },
            { label: "Short", value: `${active.agg_short_pct.toFixed(1)}%` },
            { label: "Net", value: active.agg_net.toFixed(1) },
            { label: "Crowding", value: active.crowding_state.replace("_", " ") },
            { label: "Flip", value: active.flip_state.replace("_", " ") },
            { label: "Confidence", value: String(active.confidence_score) },
            { label: "Sources", value: active.sources_used.join(", ") || "—" },
          ]}
          performance={{
            percent: performanceByPair[active.symbol] ?? null,
          }}
        />
      ) : null}
    </div>
  );
}
