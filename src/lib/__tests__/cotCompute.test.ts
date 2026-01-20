import { describe, expect, it } from "vitest";
import {
  biasFromNet,
  buildMarketSnapshot,
  derivePairDirections,
  derivePairDirectionsByBase,
} from "../cotCompute";
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
      AUD: buildMarketSnapshot(10, 20, null, null),
      USD: buildMarketSnapshot(20, 10, null, null),
      EUR: buildMarketSnapshot(20, 10, null, null),
      JPY: buildMarketSnapshot(10, 20, null, null),
      CHF: buildMarketSnapshot(10, 20, null, null),
      CAD: buildMarketSnapshot(10, 20, null, null),
      GBP: buildMarketSnapshot(10, 20, null, null),
      NZD: buildMarketSnapshot(10, 20, null, null),
    };

    const pairs = derivePairDirections(markets, PAIRS_BY_ASSET_CLASS.fx, "dealer");
    expect(pairs.AUDUSD?.direction).toBe("LONG");
    expect(pairs.EURJPY?.direction).toBe("SHORT");
    expect(pairs.USDJPY?.direction).toBe("SHORT");
    expect(pairs.AUDJPY).toBeUndefined();
  });
});

describe("derivePairDirectionsByBase", () => {
  it("creates directions based on base bias only", () => {
    const markets: Record<string, MarketSnapshot> = {
      SPX: buildMarketSnapshot(10, 20, null, null),
      USD: buildMarketSnapshot(10, 10, null, null),
    };

    const pairs = derivePairDirectionsByBase(markets, [
      { pair: "SPXUSD", base: "SPX", quote: "USD" },
    ], "dealer");
    expect(pairs.SPXUSD?.direction).toBe("LONG");
    expect(pairs.SPXUSD?.quote_bias).toBe("NEUTRAL");
  });
});
