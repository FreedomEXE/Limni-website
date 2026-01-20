import type { AssetClass } from "./cotMarkets";
import type { Bias, Direction, PairSnapshot, CotSnapshot } from "./cotTypes";
import type { SentimentAggregate } from "./sentiment/types";
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";
import { getPairPerformance } from "./pricePerformance";
import {
  derivePairDirections,
  derivePairDirectionsByBase,
  type BiasMode,
} from "./cotCompute";
import { buildAntikytheraSignals } from "./antikythera";

export type PerformanceModel =
  | "blended"
  | "dealer"
  | "commercial"
  | "sentiment"
  | "antikythera";

export type ModelPerformance = {
  model: PerformanceModel;
  percent: number;
  priced: number;
  total: number;
  note: string;
  returns: Array<{ pair: string; percent: number }>;
  stats: {
    avg_return: number;
    median_return: number;
    win_rate: number;
    volatility: number;
    best_pair: { pair: string; percent: number } | null;
    worst_pair: { pair: string; percent: number } | null;
  };
};

const NEUTRAL_BIAS: Bias = "NEUTRAL";

function directionFactor(direction: Direction) {
  return direction === "LONG" ? 1 : -1;
}

function pairSnapshot(direction: Direction): PairSnapshot {
  return {
    direction,
    base_bias: NEUTRAL_BIAS,
    quote_bias: NEUTRAL_BIAS,
  };
}

function sentimentDirection(agg?: SentimentAggregate): Direction | null {
  if (!agg) {
    return null;
  }

  if (agg.flip_state === "FLIPPED_UP") {
    return "LONG";
  }

  if (agg.flip_state === "FLIPPED_DOWN") {
    return "SHORT";
  }

  if (agg.crowding_state === "CROWDED_LONG") {
    return "SHORT";
  }

  if (agg.crowding_state === "CROWDED_SHORT") {
    return "LONG";
  }

  return null;
}

function buildSentimentPairs(
  assetClass: AssetClass,
  sentiment: SentimentAggregate[],
): Record<string, PairSnapshot> {
  const sentimentMap = new Map(sentiment.map((item) => [item.symbol, item]));
  const pairs: Record<string, PairSnapshot> = {};
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];

  for (const pairDef of pairDefs) {
    const agg = sentimentMap.get(pairDef.pair);
    const direction = sentimentDirection(agg);
    if (!direction) {
      continue;
    }
    pairs[pairDef.pair] = pairSnapshot(direction);
  }

  return pairs;
}

function buildBiasPairs(
  assetClass: AssetClass,
  snapshot: CotSnapshot,
  mode: BiasMode,
): Record<string, PairSnapshot> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  return assetClass === "fx"
    ? derivePairDirections(snapshot.currencies, pairDefs, mode)
    : derivePairDirectionsByBase(snapshot.currencies, pairDefs, mode);
}

function buildAntikytheraPairs(
  assetClass: AssetClass,
  snapshot: CotSnapshot,
  sentiment: SentimentAggregate[],
): Record<string, PairSnapshot> {
  const signals = buildAntikytheraSignals({
    assetClass,
    snapshot,
    sentiment,
    maxSignals: 50,
  });
  const pairs: Record<string, PairSnapshot> = {};
  for (const signal of signals) {
    pairs[signal.pair] = pairSnapshot(signal.direction);
  }
  return pairs;
}

function buildModelPairs(options: {
  model: PerformanceModel;
  assetClass: AssetClass;
  snapshot: CotSnapshot;
  sentiment: SentimentAggregate[];
}): Record<string, PairSnapshot> {
  const { model, assetClass, snapshot, sentiment } = options;

  if (model === "sentiment") {
    return buildSentimentPairs(assetClass, sentiment);
  }

  if (model === "antikythera") {
    return buildAntikytheraPairs(assetClass, snapshot, sentiment);
  }

  const biasMode: BiasMode = model;
  return buildBiasPairs(assetClass, snapshot, biasMode);
}

export async function computeModelPerformance(options: {
  model: PerformanceModel;
  assetClass: AssetClass;
  snapshot: CotSnapshot;
  sentiment: SentimentAggregate[];
  performance?: Awaited<ReturnType<typeof getPairPerformance>>;
}): Promise<ModelPerformance> {
  const { model, assetClass, snapshot, sentiment, performance } = options;
  const pairs = buildModelPairs({
    model,
    assetClass,
    snapshot,
    sentiment,
  });
  const total = Object.keys(pairs).length;
  if (total === 0) {
    return {
      model,
      percent: 0,
      priced: 0,
      total: 0,
      note: "No pairs.",
      returns: [],
      stats: {
        avg_return: 0,
        median_return: 0,
        win_rate: 0,
        volatility: 0,
        best_pair: null,
        worst_pair: null,
      },
    };
  }

  const perf =
    performance ??
    (await getPairPerformance(pairs, {
      assetClass,
      reportDate: snapshot.report_date,
      isLatestReport: true,
    }));

  const returns: Array<{ pair: string; percent: number }> = [];
  let percent = 0;
  let priced = 0;
  for (const [pair, info] of Object.entries(pairs)) {
    const result = perf.performance[pair];
    if (!result) {
      continue;
    }
    const adjusted = result.percent * directionFactor(info.direction);
    percent += adjusted;
    returns.push({ pair, percent: adjusted });
    priced += 1;
  }

  return {
    model,
    percent,
    priced,
    total,
    note: perf.note,
    returns,
    stats: computeReturnStats(returns),
  };
}

export function computeReturnStats(
  returns: Array<{ pair: string; percent: number }>,
) {
  if (returns.length === 0) {
    return {
      avg_return: 0,
      median_return: 0,
      win_rate: 0,
      volatility: 0,
      best_pair: null,
      worst_pair: null,
    };
  }
  const values = returns.map((item) => item.percent).sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);
  const avg = sum / values.length;
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  const wins = values.filter((value) => value > 0).length;
  const winRate = (wins / values.length) * 100;
  const variance =
    values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / values.length;
  const volatility = Math.sqrt(variance);
  const bestPair = returns.reduce((best, current) =>
    current.percent > best.percent ? current : best,
  );
  const worstPair = returns.reduce((worst, current) =>
    current.percent < worst.percent ? current : worst,
  );
  return {
    avg_return: avg,
    median_return: median,
    win_rate: winRate,
    volatility,
    best_pair: bestPair,
    worst_pair: worstPair,
  };
}
