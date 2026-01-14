import type { SentimentAggregate } from "@/lib/sentiment/types";

type SentimentHeatmapProps = {
  aggregates: SentimentAggregate[];
};

function getCrowdingColor(state: string): string {
  switch (state) {
    case "CROWDED_LONG":
      return "bg-rose-500";
    case "CROWDED_SHORT":
      return "bg-emerald-500";
    default:
      return "bg-slate-300";
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
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Retail Sentiment Heatmap
          </h2>
          <p className="text-sm text-slate-600">
            Crowding indicators across FX pairs
          </p>
        </div>
        <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">No sentiment data yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Trigger a manual refresh or start the sentiment poller
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...aggregates].sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Retail Sentiment Heatmap
        </h2>
        <p className="text-sm text-slate-600">
          Crowding indicators across FX pairs
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {sorted.map((agg) => (
          <div
            key={agg.symbol}
            className="group relative overflow-hidden rounded-lg border border-slate-200"
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
                <div className="mt-1 text-[10px] text-yellow-300">
                  {agg.flip_state === "FLIPPED_UP" ? "↑" : "↓"} FLIP
                </div>
              )}
            </div>

            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 opacity-0 transition group-hover:opacity-100">
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

      <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
        <div className="flex gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-rose-500 opacity-100" />
            <span>Crowded Long</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-emerald-500 opacity-100" />
            <span>Crowded Short</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-slate-300 opacity-100" />
            <span>Neutral</span>
          </div>
        </div>
        {aggregates[0] && (
          <p className="text-xs text-slate-500">
            Updated {new Date(aggregates[0].timestamp_utc).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
