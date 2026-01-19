import DashboardLayout from "@/components/DashboardLayout";
import { fetchLiquidationSummary } from "@/lib/coinank";
import { readSnapshot } from "@/lib/cotStore";
import { getLatestAggregates } from "@/lib/sentiment/store";
import type { SentimentAggregate } from "@/lib/sentiment/types";

export const dynamic = "force-dynamic";

type Signal = {
  pair: string;
  direction: "LONG" | "SHORT";
  reasons: string[];
  confidence: number;
};

function buildFxSignals(
  pairs: Record<string, { direction: "LONG" | "SHORT" }>,
  sentiment: SentimentAggregate[],
): Signal[] {
  const bySymbol = new Map(sentiment.map((item) => [item.symbol, item]));
  const results: Signal[] = [];

  for (const [pair, info] of Object.entries(pairs)) {
    const agg = bySymbol.get(pair);
    if (!agg) {
      continue;
    }

    const reasons: string[] = [];

    if (info.direction === "LONG" && agg.crowding_state === "CROWDED_SHORT") {
      reasons.push("COT bias favors long positioning");
      reasons.push("Retail crowding skewed short");
    } else if (
      info.direction === "SHORT" &&
      agg.crowding_state === "CROWDED_LONG"
    ) {
      reasons.push("COT bias favors short positioning");
      reasons.push("Retail crowding skewed long");
    }

    if (agg.flip_state !== "NONE") {
      reasons.push(`Sentiment flip: ${agg.flip_state.replace("_", " ")}`);
    }

    if (reasons.length > 0) {
      results.push({
        pair,
        direction: info.direction,
        reasons,
        confidence: agg.confidence_score,
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

function formatTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default async function AntikytheraPage() {
  let fxSnapshot: Awaited<ReturnType<typeof readSnapshot>> = null;
  let sentiment: SentimentAggregate[] = [];
  let btcLiq: Awaited<ReturnType<typeof fetchLiquidationSummary>> | null = null;
  let ethLiq: Awaited<ReturnType<typeof fetchLiquidationSummary>> | null = null;

  try {
    [fxSnapshot, sentiment] = await Promise.all([
      readSnapshot({ assetClass: "fx" }),
      getLatestAggregates(),
    ]);
  } catch (error) {
    console.error(
      "Antikythera data load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    [btcLiq, ethLiq] = await Promise.all([
      fetchLiquidationSummary("BTC"),
      fetchLiquidationSummary("ETH"),
    ]);
  } catch (error) {
    console.error(
      "Antikythera liquidation load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const liquidationSummaries = [btcLiq, ethLiq].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );

  const signals = fxSnapshot
    ? buildFxSignals(fxSnapshot.pairs, sentiment)
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">Antikythera</h1>
          <p className="mt-2 text-sm text-slate-600">
            Condensed signals blending bias, sentiment, and liquidation cues.
          </p>
        </header>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Top FX Signals
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              COT bias aligned with extreme retail sentiment.
            </p>
          </div>
          {signals.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">
              No aligned FX signals yet. Refresh bias and sentiment data to
              populate this list.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {signals.map((signal) => (
                <div
                  key={`${signal.pair}-${signal.direction}`}
                  className="rounded-xl border border-slate-200 bg-white/80 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {signal.pair}
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {signal.direction}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      {signal.confidence.toFixed(0)}%
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-slate-600">
                    {signal.reasons.map((reason) => (
                      <li key={reason}>- {reason}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {liquidationSummaries.map((summary) => (
            <div
              key={summary.baseCoin}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {summary.baseCoin} Liquidations
                  </h2>
                  <p className="text-sm text-[color:var(--muted)]">
                    Recent liquidation clusters from Coinank.
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Updated {formatTime(summary.lastUpdated)}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Long liquidations</span>
                  <span className="font-semibold text-rose-700">
                    {summary.totalLongUsd.toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Short liquidations</span>
                  <span className="font-semibold text-emerald-700">
                    {summary.totalShortUsd.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                Dominant: {summary.dominantSide}
              </div>
            </div>
          ))}
          {liquidationSummaries.length === 0 ? (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-sm text-[color:var(--muted)] shadow-sm">
              Liquidation data unavailable. Check Coinank connectivity.
            </div>
          ) : null}
        </section>
      </div>
    </DashboardLayout>
  );
}
