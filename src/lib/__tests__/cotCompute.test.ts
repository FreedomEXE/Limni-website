import { describe, expect, it } from "vitest";
import {
  biasFromNet,
  buildMarketSnapshot,
  derivePairDirections,
  derivePairDirectionsWithNeutral,
  derivePairDirectionsByBase,
  resolveCommercialFxDirection,
  resolveDealerNeutral,
} from "../cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../cotPairs";
import type { MarketSnapshot } from "../cotTypes";

const neutralSnapshot: MarketSnapshot = {
  dealer_long: 10,
  dealer_short: 10,
  dealer_net: 0,
  dealer_bias: "NEUTRAL",
  commercial_long: null,
  commercial_short: null,
  commercial_net: null,
  commercial_bias: null,
  blended_long: 10,
  blended_short: 10,
  blended_net: 0,
  blended_bias: "NEUTRAL",
  dealer_delta_long: 0,
  dealer_delta_short: 0,
  dealer_delta_net: 0,
  commercial_delta_long: null,
  commercial_delta_short: null,
  commercial_delta_net: null,
  open_interest: null,
  oi_delta: null,
  dealer_pct_of_oi: null,
  commercial_pct_of_oi: null,
  conc_gross_4_long: null,
  conc_gross_4_short: null,
  conc_gross_8_long: null,
  conc_gross_8_short: null,
  dealer_spread: null,
  dealer_spread_delta: null,
  dealer_directional_ratio: null,
  dealer_delta_persistence: null,
  commercial_delta_persistence: null,
  dealer_pct_oi_long: null,
  dealer_pct_oi_short: null,
  dealer_traders_long: null,
  dealer_traders_short: null,
  asset_mgr_long: null,
  asset_mgr_short: null,
  asset_mgr_spread: null,
  asset_mgr_net: null,
  asset_mgr_delta_long: null,
  asset_mgr_delta_short: null,
  asset_mgr_delta_net: null,
  asset_mgr_pct_oi_long: null,
  asset_mgr_pct_oi_short: null,
  asset_mgr_traders_long: null,
  asset_mgr_traders_short: null,
  lev_money_long: null,
  lev_money_short: null,
  lev_money_spread: null,
  lev_money_net: null,
  lev_money_delta_long: null,
  lev_money_delta_short: null,
  lev_money_delta_net: null,
  lev_money_pct_oi_long: null,
  lev_money_pct_oi_short: null,
  lev_money_traders_long: null,
  lev_money_traders_short: null,
  other_rept_long: null,
  other_rept_short: null,
  other_rept_spread: null,
  other_rept_net: null,
  other_rept_delta_long: null,
  other_rept_delta_short: null,
  other_rept_delta_net: null,
  nonrept_long: null,
  nonrept_short: null,
  nonrept_net: null,
  nonrept_delta_long: null,
  nonrept_delta_short: null,
  nonrept_delta_net: null,
  noncomm_long: null,
  noncomm_short: null,
  noncomm_spread: null,
  noncomm_net: null,
  noncomm_delta_long: null,
  noncomm_delta_short: null,
  noncomm_delta_spread: null,
  noncomm_delta_net: null,
  noncomm_pct_oi_long: null,
  noncomm_pct_oi_short: null,
  noncomm_traders_long: null,
  noncomm_traders_short: null,
  noncomm_traders_spread: null,
  commercial_traders_long: null,
  commercial_traders_short: null,
  commercial_pct_oi_long: null,
  commercial_pct_oi_short: null,
  conc_net_4_long: null,
  conc_net_4_short: null,
  conc_net_8_long: null,
  conc_net_8_short: null,
};

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

  it("forces commercial FX direction from raw base-minus-quote net", () => {
    const markets: Record<string, MarketSnapshot> = {
      AUD: buildMarketSnapshot(10, 10, 80, 120),
      CAD: buildMarketSnapshot(10, 10, 95, 105),
    };

    const pairs = derivePairDirections(markets, [
      { pair: "AUDCAD", base: "AUD", quote: "CAD" },
    ], "commercial");

    expect(pairs.AUDCAD?.direction).toBe("SHORT");
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

describe("buildMarketSnapshot enrichment", () => {
  it("derives delta net and pct of oi fields", () => {
    const market = buildMarketSnapshot(10, 20, 30, 25, {
      dealer_delta_long: 2,
      dealer_delta_short: 5,
      commercial_delta_long: 7,
      commercial_delta_short: 3,
      asset_mgr_long: 40,
      asset_mgr_short: 10,
      asset_mgr_delta_long: 5,
      asset_mgr_delta_short: 1,
      lev_money_long: 8,
      lev_money_short: 12,
      lev_money_delta_long: 2,
      lev_money_delta_short: 6,
      noncomm_long: 18,
      noncomm_short: 9,
      noncomm_delta_long: 4,
      noncomm_delta_short: 1,
      commercial_traders_long: 11,
      commercial_traders_short: 7,
      open_interest: 100,
      oi_delta: 4,
      conc_gross_4_long: 12,
      conc_gross_4_short: 18,
      conc_gross_8_long: 22,
      conc_gross_8_short: 28,
      conc_net_4_long: 4,
      conc_net_4_short: 9,
    });

    expect(market.dealer_net).toBe(10);
    expect(market.dealer_delta_net).toBe(3);
    expect(market.commercial_net).toBe(5);
    expect(market.commercial_delta_net).toBe(4);
    expect(market.asset_mgr_net).toBe(30);
    expect(market.asset_mgr_delta_net).toBe(4);
    expect(market.lev_money_net).toBe(-4);
    expect(market.lev_money_delta_net).toBe(-4);
    expect(market.noncomm_net).toBe(9);
    expect(market.noncomm_delta_net).toBe(3);
    expect(market.dealer_pct_of_oi).toBe(0.1);
    expect(market.commercial_pct_of_oi).toBe(0.05);
    expect(market.commercial_traders_long).toBe(11);
    expect(market.oi_delta).toBe(4);
    expect(market.conc_gross_8_short).toBe(28);
    expect(market.conc_net_4_short).toBe(9);
  });
});

describe("resolveDealerNeutral", () => {
  it("resolves via spread ratio when ratios differ", () => {
    const base = { ...neutralSnapshot, dealer_directional_ratio: 0.8 };
    const quote = { ...neutralSnapshot, dealer_directional_ratio: 0.3 };

    expect(resolveDealerNeutral(base, quote)).toBe("LONG");
  });

  it("returns short when quote ratio is higher", () => {
    const base = { ...neutralSnapshot, dealer_directional_ratio: 0.2 };
    const quote = { ...neutralSnapshot, dealer_directional_ratio: 0.7 };

    expect(resolveDealerNeutral(base, quote)).toBe("SHORT");
  });

  it("falls through to delta persistence when spread ratios tie", () => {
    const base = {
      ...neutralSnapshot,
      dealer_directional_ratio: 0.5,
      dealer_delta_persistence: 4,
      dealer_delta_net: 1000,
    };
    const quote = {
      ...neutralSnapshot,
      dealer_directional_ratio: 0.5,
      dealer_delta_persistence: 1,
      dealer_delta_net: -500,
    };

    expect(resolveDealerNeutral(base, quote)).toBe("LONG");
  });

  it("falls through to forced lean as last resort", () => {
    const base = { ...neutralSnapshot, dealer_net: 100 };
    const quote = { ...neutralSnapshot, dealer_net: -200 };

    expect(resolveDealerNeutral(base, quote)).toBe("LONG");
  });

  it("does not affect non-neutral dealer pairs", () => {
    const markets: Record<string, MarketSnapshot> = {
      AUD: buildMarketSnapshot(10, 20, null, null),
      USD: buildMarketSnapshot(20, 10, null, null),
    };

    const pairs = derivePairDirectionsWithNeutral(markets, [
      { pair: "AUDUSD", base: "AUD", quote: "USD" },
    ], "dealer");

    expect(pairs.AUDUSD?.direction).toBe("LONG");
    expect(pairs.AUDUSD?.base_bias).toBe("BULLISH");
    expect(pairs.AUDUSD?.quote_bias).toBe("BEARISH");
  });
});

describe("resolveCommercialFxDirection", () => {
  it("keeps forced-raw when persistence does not disagree", () => {
    const base = {
      ...neutralSnapshot,
      commercial_net: 150,
      commercial_delta_persistence: 4,
    };
    const quote = {
      ...neutralSnapshot,
      commercial_net: 50,
      commercial_delta_persistence: 1,
    };

    expect(resolveCommercialFxDirection(base, quote)).toBe("LONG");
  });

  it("flips forced-raw when persistence strongly disagrees", () => {
    const base = {
      ...neutralSnapshot,
      commercial_net: 150,
      commercial_delta_persistence: 1,
    };
    const quote = {
      ...neutralSnapshot,
      commercial_net: 50,
      commercial_delta_persistence: 4,
    };

    expect(resolveCommercialFxDirection(base, quote)).toBe("SHORT");
  });

  it("uses the flipped commercial direction in pair derivation", () => {
    const markets: Record<string, MarketSnapshot> = {
      AUD: {
        ...neutralSnapshot,
        commercial_long: 120,
        commercial_short: 20,
        commercial_net: 100,
        commercial_bias: "BULLISH",
        commercial_delta_persistence: 1,
      },
      CAD: {
        ...neutralSnapshot,
        commercial_long: 80,
        commercial_short: 60,
        commercial_net: 20,
        commercial_bias: "BULLISH",
        commercial_delta_persistence: 4,
      },
    };

    const pairs = derivePairDirectionsWithNeutral(markets, [
      { pair: "AUDCAD", base: "AUD", quote: "CAD" },
    ], "commercial");

    expect(pairs.AUDCAD?.direction).toBe("SHORT");
  });
});
