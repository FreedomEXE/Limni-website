import DashboardLayout from "@/components/DashboardLayout";
import RefreshSentimentButton from "@/components/RefreshSentimentButton";
import SentimentHeatmap from "@/components/SentimentHeatmap";
import { getLatestAggregates, readSourceHealth } from "@/lib/sentiment/store";
import type { SentimentAggregate, SourceHealth } from "@/lib/sentiment/types";

export const dynamic = "force-dynamic";

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}`;
}

function crowdingTone(state: string) {
  if (state === "CROWDED_LONG") {
    return "text-rose-700";
  }
  if (state === "CROWDED_SHORT") {
    return "text-emerald-700";
  }
  return "text-slate-500";
}

function sourceTone(status: string) {
  if (status === "HEALTHY") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "DEGRADED") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-rose-100 text-rose-700";
}

export default async function SentimentPage() {
  let aggregates: SentimentAggregate[] = [];
  let sources: SourceHealth[] = [];
  try {
    [aggregates, sources] = await Promise.all([
      getLatestAggregates(),
      readSourceHealth(),
    ]);
  } catch (error) {
    console.error(
      "Sentiment load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  const sortedAggregates = aggregates.sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );

  const crowdedLong = aggregates.filter(
    (a) => a.crowding_state === "CROWDED_LONG",
  ).length;
  const crowdedShort = aggregates.filter(
    (a) => a.crowding_state === "CROWDED_SHORT",
  ).length;
  const flips = aggregates.filter((a) => a.flip_state !== "NONE").length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">
            Retail Sentiment
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Aggregated positioning data from IG, OANDA, and Myfxbook. Identify
            crowding and path risk across FX pairs.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Pairs tracked
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {aggregates.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Crowded long
            </p>
            <p className="mt-2 text-2xl font-semibold text-rose-700">
              {crowdedLong}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Crowded short
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">
              {crowdedShort}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Recent flips
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">{flips}</p>
          </div>
        </section>

        <SentimentHeatmap aggregates={aggregates} />

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Sentiment Details
              </h2>
              <p className="text-sm text-slate-600">
                Detailed positioning and confidence scores
              </p>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-white/80 text-xs uppercase text-slate-500 backdrop-blur-sm">
                  <tr>
                    <th className="py-2">Pair</th>
                    <th className="py-2">Long %</th>
                    <th className="py-2">Net</th>
                    <th className="py-2">State</th>
                    <th className="py-2">Conf</th>
                  </tr>
                </thead>
                <tbody className="text-slate-900">
                  {sortedAggregates.map((agg) => (
                    <tr
                      key={agg.symbol}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-2 font-semibold">{agg.symbol}</td>
                      <td className="py-2">{agg.agg_long_pct.toFixed(1)}%</td>
                      <td className="py-2">{formatPercent(agg.agg_net)}</td>
                      <td
                        className={`py-2 text-xs font-semibold ${crowdingTone(
                          agg.crowding_state,
                        )}`}
                      >
                        {agg.crowding_state.replace("_", " ")}
                      </td>
                      <td className="py-2 text-xs">{agg.confidence_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Data Sources
              </h2>
              <p className="text-sm text-slate-600">
                Provider health and last update times
              </p>
            </div>
            <div className="space-y-4">
              {sources.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No source data yet. Trigger a manual refresh to fetch sentiment.
                </p>
              ) : (
                sources.map((source) => (
                  <div
                    key={source.name}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">
                        {source.name}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${sourceTone(
                          source.status,
                        )}`}
                      >
                        {source.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      {source.last_success_at ? (
                        <p>
                          Last success:{" "}
                          {new Date(source.last_success_at).toLocaleString()}
                        </p>
                      ) : (
                        <p>No successful fetches yet</p>
                      )}
                      {source.last_error && (
                        <p className="mt-1 text-rose-600">
                          Error: {source.last_error}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <RefreshSentimentButton />
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
