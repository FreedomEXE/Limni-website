import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchLiquidationSummary } from "@/lib/coinank";
import { buildAntikytheraSignals } from "@/lib/antikythera";
import { listAssetClasses } from "@/lib/cotMarkets";
import { ensureSnapshotForClass } from "@/lib/cotStore";
import { getLatestAggregates } from "@/lib/sentiment/store";
import type { SentimentAggregate } from "@/lib/sentiment/types";

export const dynamic = "force-dynamic";

function formatTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default async function AntikytheraPage() {
  const assetClasses = listAssetClasses();
  const assetIds = assetClasses.map((asset) => asset.id);
  const snapshots = new Map<string, Awaited<ReturnType<typeof ensureSnapshotForClass>>>();
  let sentiment: SentimentAggregate[] = [];
  let btcLiq: Awaited<ReturnType<typeof fetchLiquidationSummary>> | null = null;
  let ethLiq: Awaited<ReturnType<typeof fetchLiquidationSummary>> | null = null;

  try {
    const [snapshotResults, sentimentResult] = await Promise.all([
      Promise.all(
        assetIds.map((assetClass) =>
          ensureSnapshotForClass(assetClass),
        ),
      ),
      getLatestAggregates(),
    ]);
    snapshotResults.forEach((snapshot, index) => {
      snapshots.set(assetIds[index], snapshot);
    });
    sentiment = sentimentResult;
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

  const signalGroups = assetClasses.map((asset) => {
    const snapshot = snapshots.get(asset.id) ?? null;
    const signals =
      snapshot
        ? buildAntikytheraSignals({
            assetClass: asset.id,
            snapshot,
            history: [],
            sentiment,
          })
        : [];
    return { asset, signals, hasHistory: Boolean(snapshot) };
  });

  const allSignals = signalGroups.flatMap((group) =>
    group.signals.map((signal) => ({
      ...signal,
      assetId: group.asset.id,
      assetLabel: group.asset.label,
    })),
  );
  const topSignals = [...allSignals]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Antikythera</h1>
            <p className="mt-2 text-sm text-slate-600">
              Signal-first intelligence blending bias, sentiment, and liquidation cues.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-teal-500 hover:text-teal-700"
            >
              Bias map
            </Link>
            <Link
              href="/sentiment"
              className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-teal-500 hover:text-teal-700"
            >
              Sentiment map
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Top Signals
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Highest-conviction setups across all asset classes.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {topSignals.length} active
            </span>
          </div>
          {topSignals.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">
              No aligned signals yet. Check Bias and Sentiment maps for context.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topSignals.map((signal) => (
                <div
                  key={`${signal.assetId}-${signal.pair}-${signal.direction}`}
                  className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {signal.assetLabel}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {signal.pair} • {signal.direction}
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
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Signal Heatmap
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Where the strongest signals cluster by asset class.
              </p>
            </div>
            <div className="grid gap-3">
              {signalGroups.map((group) => {
                const topSignal = group.signals[0];
                return (
                  <div
                    key={group.asset.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {group.asset.label}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {group.signals.length} active signals
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {topSignal
                        ? `${topSignal.pair} ${topSignal.direction}`
                        : group.hasHistory
                          ? "No aligned signals"
                          : "Not enough history"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Signal Drivers
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Fast context from Bias, Sentiment, and Liquidity flows.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/dashboard"
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
              >
                <span>Bias map</span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  View
                </span>
              </Link>
              <Link
                href="/sentiment"
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
              >
                <span>Sentiment map</span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  View
                </span>
              </Link>
              <Link
                href="/performance"
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
              >
                <span>Performance lab</span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  View
                </span>
              </Link>
              <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700">
                Liquidation clusters update for BTC + ETH below.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Signals by Asset
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Detailed signal lists for each asset class.
            </p>
          </div>
          <div className="space-y-6">
            {signalGroups.map((group) => (
              <div key={group.asset.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {group.asset.label}
                  </h3>
                  {!group.hasHistory ? (
                    <span className="text-xs text-slate-400">
                      Not enough history
                    </span>
                  ) : null}
                </div>
                {group.signals.length === 0 ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    No aligned signals yet.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {group.signals.map((signal) => (
                      <div
                        key={`${group.asset.id}-${signal.pair}-${signal.direction}`}
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
              </div>
            ))}
          </div>
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
