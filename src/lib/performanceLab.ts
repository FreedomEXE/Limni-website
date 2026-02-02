import type { AssetClass } from "./cotMarkets";
import type { Bias, Direction, PairSnapshot, CotSnapshot } from "./cotTypes";
import type { SentimentAggregate } from "./sentiment/types";
import { DateTime } from "luxon";
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
  pair_details: Array<{
    pair: string;
    direction: Direction;
    reason: string[];
    percent: number | null;
  }>;
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

  if (agg.flip_state === "FLIPPED_NEUTRAL") {
    return null;
  }

  if (agg.crowding_state === "CROWDED_LONG") {
    return "SHORT";
  }

  if (agg.crowding_state === "CROWDED_SHORT") {
    return "LONG";
  }

  return null;
}

type SentimentWindow = {
  openUtc: DateTime;
  closeUtc: DateTime;
  direction: Direction;
  reason?: string[];
};

export function buildSentimentPairsWithHistory(options: {
  assetClass: AssetClass;
  sentimentHistory: SentimentAggregate[];
  weekOpenUtc: DateTime;
  weekCloseUtc: DateTime;
  fallbackAggregates?: SentimentAggregate[];
}): {
  pairs: Record<string, PairSnapshot>;
  windows: Record<string, SentimentWindow>;
  reasonOverrides: Map<string, string[]>;
} {
  const { assetClass, sentimentHistory, weekOpenUtc, weekCloseUtc, fallbackAggregates } = options;
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  const historyBySymbol = new Map<string, SentimentAggregate[]>();
  const fallbackMap = new Map(
    (fallbackAggregates ?? []).map((agg) => [agg.symbol, agg]),
  );

  for (const agg of sentimentHistory) {
    if (!historyBySymbol.has(agg.symbol)) {
      historyBySymbol.set(agg.symbol, []);
    }
    historyBySymbol.get(agg.symbol)?.push(agg);
  }

  for (const list of historyBySymbol.values()) {
    list.sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());
  }

  const pairs: Record<string, PairSnapshot> = {};
  const windows: Record<string, SentimentWindow> = {};
  const reasonOverrides = new Map<string, string[]>();

  for (const pairDef of pairDefs) {
    const history = historyBySymbol.get(pairDef.pair);
    if (!history || history.length === 0) {
      const fallback = fallbackMap.get(pairDef.pair);
      const fallbackDirection = sentimentDirection(fallback);
      if (!fallbackDirection) {
        continue;
      }
      pairs[pairDef.pair] = pairSnapshot(fallbackDirection);
      windows[pairDef.pair] = {
        openUtc: weekOpenUtc,
        closeUtc: weekCloseUtc,
        direction: fallbackDirection,
        reason: ["Latest sentiment snapshot (no history in window)"],
      };
      reasonOverrides.set(pairDef.pair, ["Latest sentiment snapshot (no history in window)"]);
      continue;
    }

    const openMs = weekOpenUtc.toMillis();
    const closeMs = weekCloseUtc.toMillis();
    const historyWithTimes = history
      .map((agg) => ({
        agg,
        time: DateTime.fromISO(agg.timestamp_utc, { zone: "utc" }),
      }))
      .filter((entry) => entry.time.isValid);

    if (historyWithTimes.length === 0) {
      continue;
    }

    const beforeOpen = historyWithTimes
      .filter((entry) => entry.time.toMillis() <= openMs)
      .at(-1);

    let activeDirection = beforeOpen ? sentimentDirection(beforeOpen.agg) : null;
    let openTime = weekOpenUtc;
    let closeTime = weekCloseUtc;
    let reason: string[] | undefined;

    if (!activeDirection) {
      const firstDirectional = historyWithTimes.find((entry) => {
        if (entry.time.toMillis() < openMs) {
          return false;
        }
        return sentimentDirection(entry.agg);
      });
      if (!firstDirectional) {
        continue;
      }
      activeDirection = sentimentDirection(firstDirectional.agg);
      if (!activeDirection) {
        continue;
      }
      openTime = weekOpenUtc;
      reason = [
        `Sentiment snapshot ${firstDirectional.time.toUTC().toISO() ?? "after week open"}`,
      ];
    }

    const firstChange = historyWithTimes.find((entry) => {
      if (entry.time.toMillis() <= openTime.toMillis()) {
        return false;
      }
      const direction = sentimentDirection(entry.agg);
      return direction !== activeDirection;
    });

    if (firstChange) {
      closeTime = firstChange.time;
      const nextDirection = sentimentDirection(firstChange.agg);
      if (!reason) {
        reason = [];
      }
      if (!nextDirection) {
        reason.push("Sentiment neutralized");
      } else {
        reason.push(`Sentiment flipped to ${nextDirection.toLowerCase()}`);
      }
    }

    if (closeTime.toMillis() > closeMs) {
      closeTime = weekCloseUtc;
    }

    if (closeTime.toMillis() <= openTime.toMillis()) {
      continue;
    }

    pairs[pairDef.pair] = pairSnapshot(activeDirection);
    windows[pairDef.pair] = {
      openUtc: openTime,
      closeUtc: closeTime,
      direction: activeDirection,
      reason,
    };
    if (reason && reason.length > 0) {
      reasonOverrides.set(pairDef.pair, reason);
    }
  }

  return { pairs, windows, reasonOverrides };
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

function sentimentReason(agg: SentimentAggregate | undefined, direction: Direction) {
  if (!agg) {
    return ["Sentiment signal"];
  }
  if (agg.flip_state === "FLIPPED_UP") {
    return ["Sentiment flip up"];
  }
  if (agg.flip_state === "FLIPPED_DOWN") {
    return ["Sentiment flip down"];
  }
  if (agg.flip_state === "FLIPPED_NEUTRAL") {
    return ["Sentiment neutralized"];
  }
  if (agg.crowding_state === "CROWDED_LONG") {
    return ["Retail crowding long (fade)"];
  }
  if (agg.crowding_state === "CROWDED_SHORT") {
    return ["Retail crowding short (fade)"];
  }
  return [`Sentiment ${direction.toLowerCase()} bias`];
}

function biasReason(
  model: PerformanceModel,
  assetClass: AssetClass,
  info: PairSnapshot,
) {
  const label =
    model === "blended"
      ? "Blended"
      : model === "dealer"
        ? "Dealer"
        : "Commercial";
  if (assetClass === "fx") {
    return [
      `${label} bias: base ${info.base_bias.toLowerCase()} vs quote ${info.quote_bias.toLowerCase()}`,
    ];
  }
  return [`${label} bias: base ${info.base_bias.toLowerCase()}`];
}

export async function computeModelPerformance(options: {
  model: PerformanceModel;
  assetClass: AssetClass;
  snapshot: CotSnapshot;
  sentiment: SentimentAggregate[];
  performance?: Awaited<ReturnType<typeof getPairPerformance>>;
  pairsOverride?: Record<string, PairSnapshot>;
  reasonOverrides?: Map<string, string[]>;
}): Promise<ModelPerformance> {
  const { model, assetClass, snapshot, sentiment, performance, pairsOverride, reasonOverrides } = options;
  const sentimentMap = new Map(sentiment.map((item) => [item.symbol, item]));
  let pairs: Record<string, PairSnapshot> = {};
  const reasonMap = new Map<string, string[]>();

  if (model === "sentiment") {
    pairs = pairsOverride ?? buildSentimentPairs(assetClass, sentiment);
    Object.entries(pairs).forEach(([pair, info]) => {
      const override = reasonOverrides?.get(pair);
      if (override && override.length > 0) {
        reasonMap.set(pair, override);
        return;
      }
      const agg = sentimentMap.get(pair);
      reasonMap.set(pair, sentimentReason(agg, info.direction));
    });
  } else if (model === "antikythera") {
    const signals = buildAntikytheraSignals({
      assetClass,
      snapshot,
      sentiment,
      maxSignals: 50,
    });
    signals.forEach((signal) => {
      pairs[signal.pair] = pairSnapshot(signal.direction);
      reasonMap.set(signal.pair, signal.reasons);
    });
  } else {
    pairs = buildModelPairs({
      model,
      assetClass,
      snapshot,
      sentiment,
    });
    Object.entries(pairs).forEach(([pair, info]) => {
      reasonMap.set(pair, biasReason(model, assetClass, info));
    });
  }
  const total = Object.keys(pairs).length;
  if (total === 0) {
    return {
      model,
      percent: 0,
      priced: 0,
      total: 0,
      note: "No pairs.",
      returns: [],
      pair_details: [],
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
  const pairDetails: ModelPerformance["pair_details"] = [];
  let percent = 0;
  let priced = 0;
  for (const [pair, info] of Object.entries(pairs)) {
    const result = perf.performance[pair];
    if (!result) {
      pairDetails.push({
        pair,
        direction: info.direction,
        reason: reasonMap.get(pair) ?? ["Bias alignment"],
        percent: null,
      });
      continue;
    }
    const adjusted = result.percent * directionFactor(info.direction);
    percent += adjusted;
    returns.push({ pair, percent: adjusted });
    priced += 1;
    pairDetails.push({
      pair,
      direction: info.direction,
      reason: reasonMap.get(pair) ?? ["Bias alignment"],
      percent: adjusted,
    });
  }

  return {
    model,
    percent,
    priced,
    total,
    note: perf.note,
    returns,
    pair_details: pairDetails,
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
