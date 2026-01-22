import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import SignalTiles from "@/components/antikythera/SignalTiles";
import { fetchLiquidationSummary } from "@/lib/coinank";
import { buildAntikytheraSignals } from "@/lib/antikythera";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
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
  const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
  let sentiment: SentimentAggregate[] = [];
  let btcLiq: Awaited<ReturnType<typeof fetchLiquidationSummary>> | null = null;
  let ethLiq: Awaited<ReturnType<typeof fetchLiquidationSummary>> | null = null;

  try {
    const [snapshotResults, sentimentResult] = await Promise.all([
      Promise.all(
        assetIds.map((assetClass) =>
          readSnapshot({ assetClass }),
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
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Antikythera
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Signal-first intelligence blending bias, sentiment, and liquidation cues.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Bias map
            </Link>
            <Link
              href="/sentiment"
              className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Sentiment map
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Top Signals
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Highest-conviction setups across all asset classes.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {topSignals.length} active
            </span>
          </div>
          {topSignals.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">
              No aligned signals yet. Check Bias and Sentiment maps for context.
            </p>
          ) : (
            <SignalTiles
              topSignals={topSignals.map((signal) => ({
                assetLabel: signal.assetLabel,
                pair: signal.pair,
                direction: signal.direction,
                reasons: signal.reasons,
                confidence: signal.confidence,
              }))}
              groups={signalGroups.map((group) => ({
                id: group.asset.id,
                label: group.asset.label,
                hasHistory: group.hasHistory,
                signals: group.signals.map((signal) => ({
                  assetLabel: group.asset.label,
                  pair: signal.pair,
                  direction: signal.direction,
                  reasons: signal.reasons,
                  confidence: signal.confidence,
                })),
              }))}
              showGroups={false}
              showSignals={false}
            />
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Signal Heatmap
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Where the strongest signals cluster by asset class.
              </p>
            </div>
            <SignalTiles
              topSignals={[]}
              groups={signalGroups.map((group) => ({
                id: group.asset.id,
                label: group.asset.label,
                hasHistory: group.hasHistory,
                signals: group.signals.map((signal) => ({
                  assetLabel: group.asset.label,
                  pair: signal.pair,
                  direction: signal.direction,
                  reasons: signal.reasons,
                  confidence: signal.confidence,
                })),
              }))}
              showTop={false}
              showSignals={false}
            />
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Signal Drivers
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Fast context from Bias, Sentiment, and Liquidity flows.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/dashboard"
                className="flex items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-sm text-[var(--foreground)]/80 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <span>Bias map</span>
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  View
                </span>
              </Link>
              <Link
                href="/sentiment"
                className="flex items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-sm text-[var(--foreground)]/80 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <span>Sentiment map</span>
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  View
                </span>
              </Link>
              <Link
                href="/performance"
                className="flex items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-sm text-[var(--foreground)]/80 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <span>Performance lab</span>
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  View
                </span>
              </Link>
              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-sm text-[var(--foreground)]/80">
                Liquidation clusters update for BTC + ETH below.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Signals by Asset
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Detailed signal lists for each asset class.
            </p>
          </div>
          {signalGroups.map((group) => (
            <div key={group.asset.id} className="mb-6 last:mb-0">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {group.asset.label}
                </h3>
                {!group.hasHistory ? (
                  <span className="text-xs text-[color:var(--muted)]">
                    Not enough history
                  </span>
                ) : null}
              </div>
              {group.signals.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">
                  No aligned signals yet.
                </p>
              ) : (
                <SignalTiles
                  topSignals={[]}
                  groups={[
                    {
                      id: group.asset.id,
                      label: group.asset.label,
                      hasHistory: group.hasHistory,
                      signals: group.signals.map((signal) => ({
                        assetLabel: group.asset.label,
                        pair: signal.pair,
                        direction: signal.direction,
                        reasons: signal.reasons,
                        confidence: signal.confidence,
                      })),
                    },
                  ]}
                  showTop={false}
                  showGroups={false}
                />
              )}
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {liquidationSummaries.map((summary) => (
            <div
              key={summary.baseCoin}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    {summary.baseCoin} Liquidations
                  </h2>
                  <p className="text-sm text-[color:var(--muted)]">
                    Recent liquidation clusters from Coinank.
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Updated {formatTime(summary.lastUpdated)}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)]/80">
                <div className="flex items-center justify-between">
                  <span>Long liquidations</span>
                  <span className="font-semibold text-rose-700">
                    {summary.totalLongUsd.toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Short liquidations</span>
                  <span className="font-semibold text-[var(--accent-strong)]">
                    {summary.totalShortUsd.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
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
