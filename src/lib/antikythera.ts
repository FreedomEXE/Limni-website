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
  direction: "LONG" | "SHORT" | "NEUTRAL";
  reasons: string[];
  confidence: number;
};

type SentimentResult = {
  aligned: boolean;
  reasons: string[];
};

function sentimentDirection(agg?: SentimentAggregate): "LONG" | "SHORT" | null {
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
  if (agg.agg_net > 0) {
    return "LONG";
  }
  if (agg.agg_net < 0) {
    return "SHORT";
  }
  return null;
}

function sentimentAlignment(
  direction: "LONG" | "SHORT" | "NEUTRAL",
  agg?: SentimentAggregate,
): SentimentResult {
  if (!agg || direction === "NEUTRAL") {
    return { aligned: false, reasons: [] };
  }

  const alignedDirection = sentimentDirection(agg);
  if (alignedDirection && alignedDirection === direction) {
    const reasons: string[] = [];
    if (agg.flip_state === "FLIPPED_UP" || agg.flip_state === "FLIPPED_DOWN") {
      reasons.push(`Sentiment flip: ${agg.flip_state.replace("_", " ")}`);
    } else if (agg.crowding_state === "CROWDED_LONG") {
      reasons.push("Retail crowding skewed long (fade)");
    } else if (agg.crowding_state === "CROWDED_SHORT") {
      reasons.push("Retail crowding skewed short (fade)");
    } else {
      reasons.push("Sentiment bias aligned");
    }
    return { aligned: true, reasons };
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
    const requireSentiment = true;
    if (!hasSentiment || !sentimentResult.aligned) {
      continue;
    }

    const reasons: string[] = ["Blended COT bias aligned"];
    if (hasSentiment && sentimentResult.aligned) {
      reasons.push(...sentimentResult.reasons);
    }

    signals.push({
      pair: pairDef.pair,
      direction,
      reasons,
      confidence: hasSentiment && sentimentResult.aligned ? 85 : 65,
    });
  }

  return signals.sort((a, b) => b.confidence - a.confidence).slice(0, maxSignals);
}
