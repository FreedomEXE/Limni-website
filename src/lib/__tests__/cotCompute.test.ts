import { describe, expect, it } from "vitest";
import { biasFromNet, derivePairDirections, derivePairDirectionsByBase } from "../cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../cotPairs";
import type { MarketSnapshot } from "../cotTypes";

describe("biasFromNet", () => {
  it("returns bullish when net is positive", () => {
    expect(biasFromNet(10)).toBe("BULLISH");
  });

  it("returns bearish when net is negative", () => {
    expect(biasFromNet(-5)).toBe("BEARISH");
  });

  it("returns neutral when net is zero", () => {
    expect(biasFromNet(0)).toBe("NEUTRAL");
  });
});

describe("derivePairDirections", () => {
  it("creates directions only when biases oppose", () => {
    const markets: Record<string, MarketSnapshot> = {
      AUD: { dealer_long: 10, dealer_short: 20, net: 10, bias: "BULLISH" },
      USD: { dealer_long: 20, dealer_short: 10, net: -10, bias: "BEARISH" },
      EUR: { dealer_long: 20, dealer_short: 10, net: -10, bias: "BEARISH" },
      JPY: { dealer_long: 10, dealer_short: 20, net: 10, bias: "BULLISH" },
      CHF: { dealer_long: 10, dealer_short: 20, net: 10, bias: "BULLISH" },
      CAD: { dealer_long: 10, dealer_short: 20, net: 10, bias: "BULLISH" },
      GBP: { dealer_long: 10, dealer_short: 20, net: 10, bias: "BULLISH" },
      NZD: { dealer_long: 10, dealer_short: 20, net: 10, bias: "BULLISH" },
    };

    const pairs = derivePairDirections(markets, PAIRS_BY_ASSET_CLASS.fx);
    expect(pairs.AUDUSD?.direction).toBe("LONG");
    expect(pairs.EURJPY?.direction).toBe("SHORT");
    expect(pairs.USDJPY?.direction).toBe("SHORT");
    expect(pairs.AUDJPY).toBeUndefined();
  });
});

describe("derivePairDirectionsByBase", () => {
  it("creates directions based on base bias only", () => {
    const markets: Record<string, MarketSnapshot> = {
      SPX: { dealer_long: 10, dealer_short: 20, net: 10, bias: "BULLISH" },
      USD: { dealer_long: 10, dealer_short: 10, net: 0, bias: "NEUTRAL" },
    };

    const pairs = derivePairDirectionsByBase(markets, [
      { pair: "SPXUSD", base: "SPX", quote: "USD" },
    ]);
    expect(pairs.SPXUSD?.direction).toBe("LONG");
    expect(pairs.SPXUSD?.quote_bias).toBe("NEUTRAL");
  });
});
