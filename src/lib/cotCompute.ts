import type { Bias, MarketSnapshot, PairSnapshot } from "./cotTypes";
import type { PairDefinition } from "./cotPairs";

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
): MarketSnapshot {
  const net = dealerShort - dealerLong;
  return {
    dealer_long: dealerLong,
    dealer_short: dealerShort,
    net,
    bias: biasFromNet(net),
  };
}

export function derivePairDirections(
  markets: Record<string, MarketSnapshot>,
  pairDefs: PairDefinition[],
): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};

  for (const pairDef of pairDefs) {
    const base = markets[pairDef.base];
    const quote = markets[pairDef.quote];

    if (!base || !quote) {
      continue;
    }

    if (base.bias === "NEUTRAL" || quote.bias === "NEUTRAL") {
      continue;
    }

    if (base.bias === quote.bias) {
      continue;
    }

    if (base.bias === "BULLISH" && quote.bias === "BEARISH") {
      pairs[pairDef.pair] = {
        direction: "LONG",
        base_bias: base.bias,
        quote_bias: quote.bias,
      };
      continue;
    }

    if (base.bias === "BEARISH" && quote.bias === "BULLISH") {
      pairs[pairDef.pair] = {
        direction: "SHORT",
        base_bias: base.bias,
        quote_bias: quote.bias,
      };
    }
  }

  return pairs;
}
