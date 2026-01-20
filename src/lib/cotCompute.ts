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
      ? commercialLong - commercialShort
      : null;
  const commercialBias =
    typeof commercialNet === "number" ? biasFromNet(commercialNet) : null;
  const dealerTotal = dealerLong + dealerShort;
  const commercialTotal =
    typeof commercialLong === "number" && typeof commercialShort === "number"
      ? commercialLong + commercialShort
      : null;
  const blendedNet =
    typeof commercialNet === "number"
      ? dealerNet * BIAS_WEIGHTS.dealer +
        commercialNet * BIAS_WEIGHTS.commercial
      : dealerNet;
  const blendedTotal =
    typeof commercialTotal === "number"
      ? dealerTotal * BIAS_WEIGHTS.dealer +
        commercialTotal * BIAS_WEIGHTS.commercial
      : dealerTotal;
  const blendedShort = (blendedTotal + blendedNet) / 2;
  const blendedLong = blendedTotal - blendedShort;
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
  const dealerNet = market.dealer_short - market.dealer_long;
  const dealerBias = biasFromNet(dealerNet);
  const commercialNet =
    typeof market.commercial_long === "number" &&
    typeof market.commercial_short === "number"
      ? market.commercial_long - market.commercial_short
      : null;
  const commercialBias =
    commercialNet === null ? null : biasFromNet(commercialNet);
  const dealerTotal = market.dealer_long + market.dealer_short;
  const commercialTotal =
    typeof market.commercial_long === "number" &&
    typeof market.commercial_short === "number"
      ? market.commercial_long + market.commercial_short
      : null;
  const blendedNet =
    commercialNet !== null
      ? dealerNet * BIAS_WEIGHTS.dealer +
        commercialNet * BIAS_WEIGHTS.commercial
      : dealerNet;
  const blendedTotal =
    commercialTotal !== null
      ? dealerTotal * BIAS_WEIGHTS.dealer +
        commercialTotal * BIAS_WEIGHTS.commercial
      : dealerTotal;
  const blendedShort = (blendedTotal + blendedNet) / 2;
  const blendedLong = blendedTotal - blendedShort;
  const blendedBias = biasFromNet(blendedNet);

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
