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

// Single source of truth for Antikythera signal cap across UI/bots/performance.
// Keeping this high avoids accidental truncation discrepancies between surfaces.
export const ANTIKYTHERA_MAX_SIGNALS = 200;

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
  biasMode?: BiasMode;
}) {
  const { assetClass, snapshot, sentiment, maxSignals = ANTIKYTHERA_MAX_SIGNALS, biasMode = "blended" } = options;
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

    const biasLabel = biasMode === "blended" ? "Blended COT bias aligned" :
                      biasMode === "dealer" ? "Dealer COT bias aligned" :
                      "Commercial COT bias aligned";
    const reasons: string[] = [biasLabel];
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

export function buildAntikytheraAgreementSignals(options: {
  assetClass: AssetClass;
  snapshot: CotSnapshot;
  sentiment: SentimentAggregate[];
  maxSignals?: number;
}) {
  const { assetClass, snapshot, sentiment, maxSignals = ANTIKYTHERA_MAX_SIGNALS } = options;
  const sentimentMap = new Map(sentiment.map((item) => [item.symbol, item]));
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  const dealerPairs =
    assetClass === "fx"
      ? derivePairDirections(snapshot.currencies, pairDefs, "dealer")
      : derivePairDirectionsByBase(snapshot.currencies, pairDefs, "dealer");
  const commercialPairs =
    assetClass === "fx"
      ? derivePairDirections(snapshot.currencies, pairDefs, "commercial")
      : derivePairDirectionsByBase(snapshot.currencies, pairDefs, "commercial");

  const signals: AntikytheraSignal[] = [];
  for (const pairDef of pairDefs) {
    const dealerDirection = dealerPairs[pairDef.pair]?.direction ?? "NEUTRAL";
    const commercialDirection = commercialPairs[pairDef.pair]?.direction ?? "NEUTRAL";
    const sentimentAgg = sentimentMap.get(pairDef.pair);
    const sentimentBias = sentimentDirection(sentimentAgg) ?? "NEUTRAL";

    if (
      dealerDirection === "NEUTRAL" ||
      commercialDirection === "NEUTRAL" ||
      sentimentBias === "NEUTRAL"
    ) {
      continue;
    }

    if (dealerDirection !== commercialDirection || dealerDirection !== sentimentBias) {
      continue;
    }

    const sentimentResult = sentimentAlignment(dealerDirection, sentimentAgg);
    const reasons = [
      "Dealer COT bias aligned",
      "Commercial COT bias aligned",
      ...(sentimentResult.reasons.length > 0
        ? sentimentResult.reasons
        : ["Sentiment bias aligned"]),
    ];

    signals.push({
      pair: pairDef.pair,
      direction: dealerDirection,
      reasons,
      confidence: 95,
    });
  }

  return signals.sort((a, b) => b.confidence - a.confidence).slice(0, maxSignals);
}
