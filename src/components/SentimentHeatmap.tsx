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

function getIntensity(net: number): string {
  const abs = Math.abs(net);
  if (abs >= 40) return "opacity-100";
  if (abs >= 25) return "opacity-75";
  if (abs >= 10) return "opacity-50";
  return "opacity-30";
}

export default function SentimentHeatmap({
  aggregates,
}: SentimentHeatmapProps) {
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
              )} ${getIntensity(agg.agg_net)}`}
            >
              <div className="text-xs font-bold text-white">{agg.symbol}</div>
              <div className="mt-1 text-[10px] text-white/90">
                {agg.agg_long_pct.toFixed(0)}% L
              </div>
              {agg.flip_state !== "NONE" && (
                <div className="mt-1 text-[10px] text-white/80">
                  {agg.flip_state === "FLIPPED_UP" ? "UP" : "DOWN"} FLIP
                </div>
              )}
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
    </div>
  );
}
