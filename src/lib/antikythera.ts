import type { AssetClass } from "./cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";
import type { CotSnapshot } from "./cotTypes";
import type { SentimentAggregate } from "./sentiment/types";
import {
  derivePairDirections,
  derivePairDirectionsByBase,
  type BiasMode,
} from "./cotCompute";

export type AntikytheraSignal = {
  pair: string;
  direction: "LONG" | "SHORT";
  reasons: string[];
  confidence: number;
};

type SentimentResult = {
  aligned: boolean;
  reasons: string[];
};

function sentimentAlignment(
  direction: "LONG" | "SHORT",
  agg?: SentimentAggregate,
): SentimentResult {
  if (!agg) {
    return { aligned: false, reasons: [] };
  }

  if (direction === "LONG" && agg.crowding_state === "CROWDED_SHORT") {
    return { aligned: true, reasons: ["Retail crowding skewed short"] };
  }

  if (direction === "SHORT" && agg.crowding_state === "CROWDED_LONG") {
    return { aligned: true, reasons: ["Retail crowding skewed long"] };
  }

  if (agg.flip_state !== "NONE") {
    return {
      aligned: true,
      reasons: [`Sentiment flip: ${agg.flip_state.replace("_", " ")}`],
    };
  }

  return { aligned: false, reasons: [] };
}

export function buildAntikytheraSignals(options: {
  assetClass: AssetClass;
  snapshot: CotSnapshot;
  sentiment: SentimentAggregate[];
  maxSignals?: number;
}) {
  const { assetClass, snapshot, sentiment, maxSignals = 8 } = options;
  const biasMode: BiasMode = "blended";
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

    const direction = info.direction;
    const sentimentResult = sentimentAlignment(
      direction,
      sentimentMap.get(pairDef.pair),
    );
    const hasSentiment = Boolean(sentimentMap.get(pairDef.pair));
    if (hasSentiment && !sentimentResult.aligned) {
      continue;
    }

    const reasons: string[] = ["Blended COT bias aligned"];
    reasons.push(...sentimentResult.reasons);

    signals.push({
      pair: pairDef.pair,
      direction,
      reasons,
      confidence: hasSentiment && sentimentResult.aligned ? 85 : 65,
    });
  }

  return signals.sort((a, b) => b.confidence - a.confidence).slice(0, maxSignals);
}
