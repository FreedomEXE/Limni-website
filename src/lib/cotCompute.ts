import type { Bias, MarketSnapshot, PairSnapshot } from "./cotTypes";
import type { PairDefinition } from "./cotPairs";

export type BiasMode = "dealer" | "commercial" | "blended";

export const BIAS_WEIGHTS = {
  dealer: 0.6,
  commercial: 0.4,
};

export function biasFromNet(net: number): Bias {
  if (net > 0) {
    return "BULLISH";
  }
  if (net < 0) {
    return "BEARISH";
  }
  return "NEUTRAL";
}

export function buildMarketSnapshot(
  dealerLong: number,
  dealerShort: number,
  commercialLong: number | null,
  commercialShort: number | null,
): MarketSnapshot {
  const dealerNet = dealerShort - dealerLong;
  const dealerBias = biasFromNet(dealerNet);
  const commercialNet =
    typeof commercialLong === "number" && typeof commercialShort === "number"
      ? commercialShort - commercialLong
      : null;
  const commercialBias =
    typeof commercialNet === "number" ? biasFromNet(commercialNet) : null;
  const blendedLong =
    typeof commercialLong === "number"
      ? dealerLong * BIAS_WEIGHTS.dealer +
        commercialLong * BIAS_WEIGHTS.commercial
      : dealerLong;
  const blendedShort =
    typeof commercialShort === "number"
      ? dealerShort * BIAS_WEIGHTS.dealer +
        commercialShort * BIAS_WEIGHTS.commercial
      : dealerShort;
  const blendedNet = blendedShort - blendedLong;
  const blendedBias = biasFromNet(blendedNet);

  return {
    dealer_long: dealerLong,
    dealer_short: dealerShort,
    dealer_net: dealerNet,
    dealer_bias: dealerBias,
    commercial_long: commercialLong,
    commercial_short: commercialShort,
    commercial_net: commercialNet,
    commercial_bias: commercialBias,
    blended_long: blendedLong,
    blended_short: blendedShort,
    blended_net: blendedNet,
    blended_bias: blendedBias,
  };
}

export function resolveMarketBias(
  market: MarketSnapshot,
  mode: BiasMode,
): { long: number; short: number; net: number; bias: Bias } | null {
  const dealerNet =
    typeof market.dealer_net === "number"
      ? market.dealer_net
      : market.dealer_short - market.dealer_long;
  const dealerBias =
    market.dealer_bias ?? biasFromNet(dealerNet);
  const commercialNet =
    typeof market.commercial_net === "number"
      ? market.commercial_net
      : typeof market.commercial_long === "number" &&
          typeof market.commercial_short === "number"
        ? market.commercial_short - market.commercial_long
        : null;
  const commercialBias =
    commercialNet === null
      ? null
      : market.commercial_bias ?? biasFromNet(commercialNet);
  const blendedLong =
    typeof market.blended_long === "number"
      ? market.blended_long
      : typeof market.commercial_long === "number"
        ? market.dealer_long * BIAS_WEIGHTS.dealer +
          market.commercial_long * BIAS_WEIGHTS.commercial
        : market.dealer_long;
  const blendedShort =
    typeof market.blended_short === "number"
      ? market.blended_short
      : typeof market.commercial_short === "number"
        ? market.dealer_short * BIAS_WEIGHTS.dealer +
          market.commercial_short * BIAS_WEIGHTS.commercial
        : market.dealer_short;
  const blendedNet =
    typeof market.blended_net === "number"
      ? market.blended_net
      : blendedShort - blendedLong;
  const blendedBias =
    market.blended_bias ?? biasFromNet(blendedNet);

  if (mode === "dealer") {
    return {
      long: market.dealer_long,
      short: market.dealer_short,
      net: dealerNet,
      bias: dealerBias,
    };
  }

  if (mode === "commercial") {
    if (commercialNet === null || !commercialBias) {
      return null;
    }
    return {
      long: market.commercial_long as number,
      short: market.commercial_short as number,
      net: commercialNet,
      bias: commercialBias,
    };
  }

  return {
    long: blendedLong,
    short: blendedShort,
    net: blendedNet,
    bias: blendedBias,
  };
}

export function derivePairDirections(
  markets: Record<string, MarketSnapshot>,
  pairDefs: PairDefinition[],
  mode: BiasMode = "dealer",
): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};

  for (const pairDef of pairDefs) {
    const base = markets[pairDef.base];
    const quote = markets[pairDef.quote];
    const baseBias = base ? resolveMarketBias(base, mode) : null;
    const quoteBias = quote ? resolveMarketBias(quote, mode) : null;

    if (!baseBias || !quoteBias) {
      continue;
    }

    if (baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL") {
      continue;
    }

    if (baseBias.bias === quoteBias.bias) {
      continue;
    }

    if (baseBias.bias === "BULLISH" && quoteBias.bias === "BEARISH") {
      pairs[pairDef.pair] = {
        direction: "LONG",
        base_bias: baseBias.bias,
        quote_bias: quoteBias.bias,
      };
      continue;
    }

    if (baseBias.bias === "BEARISH" && quoteBias.bias === "BULLISH") {
      pairs[pairDef.pair] = {
        direction: "SHORT",
        base_bias: baseBias.bias,
        quote_bias: quoteBias.bias,
      };
    }
  }

  return pairs;
}

export function derivePairDirectionsByBase(
  markets: Record<string, MarketSnapshot>,
  pairDefs: PairDefinition[],
  mode: BiasMode = "dealer",
): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};

  for (const pairDef of pairDefs) {
    const base = markets[pairDef.base];
    const quote = markets[pairDef.quote];
    const baseBias = base ? resolveMarketBias(base, mode) : null;
    const quoteBias = quote ? resolveMarketBias(quote, mode) : null;

    if (!baseBias || baseBias.bias === "NEUTRAL") {
      continue;
    }

    pairs[pairDef.pair] = {
      direction: baseBias.bias === "BULLISH" ? "LONG" : "SHORT",
      base_bias: baseBias.bias,
      quote_bias: quoteBias?.bias ?? "NEUTRAL",
    };
  }

  return pairs;
}
