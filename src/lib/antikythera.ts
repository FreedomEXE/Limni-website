import type { AssetClass } from "./cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";
import type { CotSnapshot } from "./cotTypes";
import type { SentimentAggregate } from "./sentiment/types";
import {
  derivePairDirections,
  derivePairDirectionsByBase,
  resolveMarketBias,
  type BiasMode,
} from "./cotCompute";

export type AntikytheraSignal = {
  pair: string;
  direction: "LONG" | "SHORT";
  reasons: string[];
  confidence: number;
};

type Thresholds = {
  regime: { medium: number; strong: number };
  timing: { medium: number; strong: number };
};

type ScoreResult = {
  score: number;
  reasons: string[];
};

const THRESHOLDS: Record<AssetClass, Thresholds> = {
  fx: { regime: { medium: 0.8, strong: 1.2 }, timing: { medium: 1.0, strong: 1.5 } },
  indices: { regime: { medium: 1.0, strong: 1.5 }, timing: { medium: 1.5, strong: 2.0 } },
  crypto: { regime: { medium: 1.2, strong: 1.8 }, timing: { medium: 1.8, strong: 2.4 } },
  commodities: { regime: { medium: 0.7, strong: 1.1 }, timing: { medium: 1.0, strong: 1.4 } },
};

function zscore(value: number, values: number[]) {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (!Number.isFinite(std) || std === 0) {
    return 0;
  }
  return (value - mean) / std;
}

function computeZscores(
  history: CotSnapshot[],
  lookback: number,
  mode: BiasMode,
): Record<string, number> {
  const sliced = history.slice(0, Math.min(history.length, lookback));
  if (sliced.length === 0) {
    return {};
  }

  const latest = sliced[0].currencies;
  const scores: Record<string, number> = {};

  for (const currency of Object.keys(latest)) {
    const values = sliced
      .map((snapshot) => {
        const market = snapshot.currencies[currency];
        const resolved = market ? resolveMarketBias(market, mode) : null;
        return resolved?.net;
      })
      .filter((value): value is number => typeof value === "number");
    const latestResolved = resolveMarketBias(latest[currency], mode);
    const latestValue = latestResolved?.net;
    if (typeof latestValue !== "number" || values.length === 0) {
      continue;
    }
    scores[currency] = zscore(latestValue, values);
  }

  return scores;
}

function scoreBand(value: number, thresholds: { medium: number; strong: number }) {
  const absValue = Math.abs(value);
  if (absValue >= thresholds.strong) {
    return 2;
  }
  if (absValue >= thresholds.medium) {
    return 1;
  }
  return 0;
}

function sentimentScore(
  direction: "LONG" | "SHORT",
  agg?: SentimentAggregate,
): ScoreResult {
  if (!agg) {
    return { score: 0, reasons: [] };
  }

  if (direction === "LONG" && agg.crowding_state === "CROWDED_SHORT") {
    return { score: 2, reasons: ["Retail crowding skewed short"] };
  }

  if (direction === "SHORT" && agg.crowding_state === "CROWDED_LONG") {
    return { score: 2, reasons: ["Retail crowding skewed long"] };
  }

  if (agg.flip_state !== "NONE") {
    return {
      score: 2,
      reasons: [`Sentiment flip: ${agg.flip_state.replace("_", " ")}`],
    };
  }

  return { score: 0, reasons: [] };
}

function formatReason(label: string, value: number) {
  return `${label} z-score ${value.toFixed(2)}`;
}

export function buildAntikytheraSignals(options: {
  assetClass: AssetClass;
  snapshot: CotSnapshot;
  history: CotSnapshot[];
  sentiment: SentimentAggregate[];
  maxSignals?: number;
}) {
  const { assetClass, snapshot, history, sentiment, maxSignals = 8 } = options;
  const biasMode: BiasMode = "blended";
  const thresholds = THRESHOLDS[assetClass];
  const regimeZ = computeZscores(history, 104, biasMode);
  const timingZ = computeZscores(history, 26, biasMode);
  const sentimentMap = new Map(sentiment.map((item) => [item.symbol, item]));

  const signals: AntikytheraSignal[] = [];

  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  const derivedPairs =
    assetClass === "fx"
      ? derivePairDirections(snapshot.currencies, pairDefs, biasMode)
      : derivePairDirectionsByBase(snapshot.currencies, pairDefs, biasMode);

  for (const pairDef of pairDefs) {
    const info = derivedPairs[pairDef.pair];
    if (!info) {
      continue;
    }
    const base = pairDef.base;
    const quote = pairDef.quote;
    const regimeValue = (regimeZ[base] ?? 0) - (regimeZ[quote] ?? 0);
    const timingValue = (timingZ[base] ?? 0) - (timingZ[quote] ?? 0);

    const direction = regimeValue >= 0 ? "LONG" : "SHORT";

    if (direction !== info.direction) {
      continue;
    }

    const regimeScore = scoreBand(regimeValue, thresholds.regime);
    const timingScore = scoreBand(timingValue, thresholds.timing);
    const sentimentResult = sentimentScore(
      direction,
      sentimentMap.get(pairDef.pair),
    );

    const alignedCount = [
      regimeScore > 0,
      timingScore > 0,
      sentimentResult.score > 0,
    ].filter(Boolean).length;
    if (alignedCount < 2) {
      continue;
    }

    const score = regimeScore + timingScore + sentimentResult.score;
    const reasons: string[] = [];
    if (regimeScore > 0) {
      reasons.push(formatReason("Regime", regimeValue));
    }
    if (timingScore > 0) {
      reasons.push(formatReason("Timing", timingValue));
    }
    reasons.push(...sentimentResult.reasons);

    signals.push({
      pair: pairDef.pair,
      direction,
      reasons,
      confidence: Math.min(100, score * 15),
    });
  }

  return signals.sort((a, b) => b.confidence - a.confidence).slice(0, maxSignals);
}
