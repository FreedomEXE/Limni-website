import type {
  CrowdingState,
  FlipState,
  ProviderSentiment,
  SentimentAggregate,
  SentimentConfig,
  SentimentProvider,
} from "./types";
import { DEFAULT_SENTIMENT_CONFIG } from "./types";

export function aggregateSentiment(
  snapshots: ProviderSentiment[],
  config: SentimentConfig = DEFAULT_SENTIMENT_CONFIG,
): SentimentAggregate[] {
  const bySymbol = new Map<string, ProviderSentiment[]>();

  for (const snapshot of snapshots) {
    const existing = bySymbol.get(snapshot.symbol) || [];
    existing.push(snapshot);
    bySymbol.set(snapshot.symbol, existing);
  }

  const results: SentimentAggregate[] = [];

  for (const [symbol, providerSnapshots] of bySymbol) {
    const aggregate = computeAggregate(symbol, providerSnapshots, config);
    results.push(aggregate);
  }

  return results;
}

function computeAggregate(
  symbol: string,
  snapshots: ProviderSentiment[],
  config: SentimentConfig,
): SentimentAggregate {
  const now = new Date();
  const staleThresholdMs = config.stale_threshold_minutes * 60 * 1000;

  const freshSnapshots = snapshots.filter((s) => {
    const snapshotTime = new Date(s.timestamp_utc);
    return now.getTime() - snapshotTime.getTime() < staleThresholdMs;
  });

  if (freshSnapshots.length === 0) {
    return {
      symbol,
      timestamp_utc: now.toISOString(),
      agg_long_pct: 50,
      agg_short_pct: 50,
      agg_net: 0,
      sources_used: [],
      confidence_score: 0,
      crowding_state: "NEUTRAL",
      flip_state: "NONE",
    };
  }

  const availableWeights = freshSnapshots.reduce((sum, s) => {
    return sum + config.weights[s.provider];
  }, 0);

  let weightedLongSum = 0;

  for (const snapshot of freshSnapshots) {
    const weight = config.weights[snapshot.provider] / availableWeights;
    weightedLongSum += snapshot.long_pct * weight;
  }

  const aggLongPct = Number(weightedLongSum.toFixed(2));
  const aggShortPct = Number((100 - aggLongPct).toFixed(2));
  const aggNet = Number((aggLongPct - aggShortPct).toFixed(2));

  const sourcesUsed = freshSnapshots.map((s) => s.provider);
  const confidenceScore = calculateConfidence(
    freshSnapshots,
    config,
  );

  const crowdingState = determineCrowdingState(
    aggLongPct,
    config.crowding_thresholds,
  );

  return {
    symbol,
    timestamp_utc: now.toISOString(),
    agg_long_pct: aggLongPct,
    agg_short_pct: aggShortPct,
    agg_net: aggNet,
    sources_used: sourcesUsed,
    confidence_score: confidenceScore,
    crowding_state: crowdingState,
    flip_state: "NONE",
  };
}

function calculateConfidence(
  snapshots: ProviderSentiment[],
  config: SentimentConfig,
): number {
  const baseScore = 30;
  const perSourceBonus = 25;

  let score = baseScore + snapshots.length * perSourceBonus;

  const now = Date.now();
  for (const snapshot of snapshots) {
    const ageMinutes =
      (now - new Date(snapshot.timestamp_utc).getTime()) / (1000 * 60);
    if (ageMinutes > 15) {
      score -= 10;
    }
    if (ageMinutes > 20) {
      score -= 10;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function determineCrowdingState(
  longPct: number,
  thresholds: { long: number; short: number },
): CrowdingState {
  if (longPct >= thresholds.long) {
    return "CROWDED_LONG";
  }
  if (longPct <= thresholds.short) {
    return "CROWDED_SHORT";
  }
  return "NEUTRAL";
}

export function detectFlips(
  current: SentimentAggregate[],
  previous: SentimentAggregate[],
  config: SentimentConfig = DEFAULT_SENTIMENT_CONFIG,
): SentimentAggregate[] {
  const prevBySymbol = new Map(previous.map((a) => [a.symbol, a]));

  return current.map((agg) => {
    const prev = prevBySymbol.get(agg.symbol);
    if (!prev) {
      return agg;
    }

    const flipState = determineFlipState(
      prev.crowding_state,
      agg.crowding_state,
      prev.timestamp_utc,
      agg.timestamp_utc,
      config.flip_persistence_minutes,
    );

    return { ...agg, flip_state: flipState };
  });
}

function determineFlipState(
  prevCrowding: CrowdingState,
  currentCrowding: CrowdingState,
  prevTimestamp: string,
  currentTimestamp: string,
  persistenceMinutes: number,
): FlipState {
  const prevTime = new Date(prevTimestamp).getTime();
  const currentTime = new Date(currentTimestamp).getTime();
  const elapsedMinutes = (currentTime - prevTime) / (1000 * 60);

  if (elapsedMinutes < persistenceMinutes) {
    return "NONE";
  }

  if (
    prevCrowding === "CROWDED_LONG" &&
    currentCrowding === "CROWDED_SHORT"
  ) {
    return "FLIPPED_DOWN";
  }

  if (
    prevCrowding === "CROWDED_SHORT" &&
    currentCrowding === "CROWDED_LONG"
  ) {
    return "FLIPPED_UP";
  }

  if (
    (prevCrowding === "CROWDED_LONG" || prevCrowding === "CROWDED_SHORT") &&
    currentCrowding === "NEUTRAL"
  ) {
    return "FLIPPED_NEUTRAL";
  }

  return "NONE";
}
