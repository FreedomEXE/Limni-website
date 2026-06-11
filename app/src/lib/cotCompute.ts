import type { Bias, MarketSnapshot, PairSnapshot } from "./cotTypes";
import type { PairDefinition } from "./cotPairs";

export type BiasMode = "dealer" | "commercial" | "blended";
export type CotEnrichment = {
  dealer_delta_long?: number | null;
  dealer_delta_short?: number | null;
  dealer_delta_persistence?: number | null;
  commercial_delta_long?: number | null;
  commercial_delta_short?: number | null;
  commercial_delta_persistence?: number | null;
  open_interest?: number | null;
  oi_delta?: number | null;
  conc_gross_4_long?: number | null;
  conc_gross_4_short?: number | null;
  conc_gross_8_long?: number | null;
  conc_gross_8_short?: number | null;
  dealer_spread?: number | null;
  dealer_spread_delta?: number | null;
  dealer_pct_oi_long?: number | null;
  dealer_pct_oi_short?: number | null;
  dealer_traders_long?: number | null;
  dealer_traders_short?: number | null;
  asset_mgr_long?: number | null;
  asset_mgr_short?: number | null;
  asset_mgr_spread?: number | null;
  asset_mgr_delta_long?: number | null;
  asset_mgr_delta_short?: number | null;
  asset_mgr_pct_oi_long?: number | null;
  asset_mgr_pct_oi_short?: number | null;
  asset_mgr_traders_long?: number | null;
  asset_mgr_traders_short?: number | null;
  lev_money_long?: number | null;
  lev_money_short?: number | null;
  lev_money_spread?: number | null;
  lev_money_delta_long?: number | null;
  lev_money_delta_short?: number | null;
  lev_money_pct_oi_long?: number | null;
  lev_money_pct_oi_short?: number | null;
  lev_money_traders_long?: number | null;
  lev_money_traders_short?: number | null;
  other_rept_long?: number | null;
  other_rept_short?: number | null;
  other_rept_spread?: number | null;
  other_rept_delta_long?: number | null;
  other_rept_delta_short?: number | null;
  nonrept_long?: number | null;
  nonrept_short?: number | null;
  nonrept_delta_long?: number | null;
  nonrept_delta_short?: number | null;
  noncomm_long?: number | null;
  noncomm_short?: number | null;
  noncomm_spread?: number | null;
  noncomm_delta_long?: number | null;
  noncomm_delta_short?: number | null;
  noncomm_delta_spread?: number | null;
  noncomm_pct_oi_long?: number | null;
  noncomm_pct_oi_short?: number | null;
  noncomm_traders_long?: number | null;
  noncomm_traders_short?: number | null;
  noncomm_traders_spread?: number | null;
  commercial_traders_long?: number | null;
  commercial_traders_short?: number | null;
  commercial_pct_oi_long?: number | null;
  commercial_pct_oi_short?: number | null;
  conc_net_4_long?: number | null;
  conc_net_4_short?: number | null;
  conc_net_8_long?: number | null;
  conc_net_8_short?: number | null;
};

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
  enrichment?: CotEnrichment,
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
  const dealerDeltaNet =
    typeof enrichment?.dealer_delta_long === "number" &&
    typeof enrichment?.dealer_delta_short === "number"
      ? enrichment.dealer_delta_short - enrichment.dealer_delta_long
      : null;
  const commercialDeltaNet =
    typeof enrichment?.commercial_delta_long === "number" &&
    typeof enrichment?.commercial_delta_short === "number"
      ? enrichment.commercial_delta_long - enrichment.commercial_delta_short
      : null;
  const openInterest = enrichment?.open_interest ?? null;
  const dealerDirectionalRatio =
    typeof enrichment?.dealer_spread === "number" && enrichment.dealer_spread >= 0
      ? Math.abs(dealerNet) / (Math.abs(dealerNet) + enrichment.dealer_spread)
      : null;
  const dealerPctOfOi =
    typeof openInterest === "number" && openInterest > 0
      ? dealerNet / openInterest
      : null;
  const commercialPctOfOi =
    typeof openInterest === "number" &&
    openInterest > 0 &&
    typeof commercialNet === "number"
      ? commercialNet / openInterest
      : null;
  const assetMgrNet =
    typeof enrichment?.asset_mgr_long === "number" &&
    typeof enrichment?.asset_mgr_short === "number"
      ? enrichment.asset_mgr_long - enrichment.asset_mgr_short
      : null;
  const assetMgrDeltaNet =
    typeof enrichment?.asset_mgr_delta_long === "number" &&
    typeof enrichment?.asset_mgr_delta_short === "number"
      ? enrichment.asset_mgr_delta_long - enrichment.asset_mgr_delta_short
      : null;
  const levMoneyNet =
    typeof enrichment?.lev_money_long === "number" &&
    typeof enrichment?.lev_money_short === "number"
      ? enrichment.lev_money_long - enrichment.lev_money_short
      : null;
  const levMoneyDeltaNet =
    typeof enrichment?.lev_money_delta_long === "number" &&
    typeof enrichment?.lev_money_delta_short === "number"
      ? enrichment.lev_money_delta_long - enrichment.lev_money_delta_short
      : null;
  const otherReptNet =
    typeof enrichment?.other_rept_long === "number" &&
    typeof enrichment?.other_rept_short === "number"
      ? enrichment.other_rept_long - enrichment.other_rept_short
      : null;
  const otherReptDeltaNet =
    typeof enrichment?.other_rept_delta_long === "number" &&
    typeof enrichment?.other_rept_delta_short === "number"
      ? enrichment.other_rept_delta_long - enrichment.other_rept_delta_short
      : null;
  const nonreptNet =
    typeof enrichment?.nonrept_long === "number" &&
    typeof enrichment?.nonrept_short === "number"
      ? enrichment.nonrept_long - enrichment.nonrept_short
      : null;
  const nonreptDeltaNet =
    typeof enrichment?.nonrept_delta_long === "number" &&
    typeof enrichment?.nonrept_delta_short === "number"
      ? enrichment.nonrept_delta_long - enrichment.nonrept_delta_short
      : null;
  const noncommNet =
    typeof enrichment?.noncomm_long === "number" &&
    typeof enrichment?.noncomm_short === "number"
      ? enrichment.noncomm_long - enrichment.noncomm_short
      : null;
  const noncommDeltaNet =
    typeof enrichment?.noncomm_delta_long === "number" &&
    typeof enrichment?.noncomm_delta_short === "number"
      ? enrichment.noncomm_delta_long - enrichment.noncomm_delta_short
      : null;

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
    dealer_delta_long: enrichment?.dealer_delta_long ?? null,
    dealer_delta_short: enrichment?.dealer_delta_short ?? null,
    dealer_delta_net: dealerDeltaNet,
    commercial_delta_long: enrichment?.commercial_delta_long ?? null,
    commercial_delta_short: enrichment?.commercial_delta_short ?? null,
    commercial_delta_net: commercialDeltaNet,
    open_interest: openInterest,
    oi_delta: enrichment?.oi_delta ?? null,
    dealer_pct_of_oi: dealerPctOfOi,
    commercial_pct_of_oi: commercialPctOfOi,
    conc_gross_4_long: enrichment?.conc_gross_4_long ?? null,
    conc_gross_4_short: enrichment?.conc_gross_4_short ?? null,
    conc_gross_8_long: enrichment?.conc_gross_8_long ?? null,
    conc_gross_8_short: enrichment?.conc_gross_8_short ?? null,
    dealer_spread: enrichment?.dealer_spread ?? null,
    dealer_spread_delta: enrichment?.dealer_spread_delta ?? null,
    dealer_directional_ratio: dealerDirectionalRatio,
    dealer_delta_persistence: enrichment?.dealer_delta_persistence ?? null,
    commercial_delta_persistence: enrichment?.commercial_delta_persistence ?? null,
    dealer_pct_oi_long: enrichment?.dealer_pct_oi_long ?? null,
    dealer_pct_oi_short: enrichment?.dealer_pct_oi_short ?? null,
    dealer_traders_long: enrichment?.dealer_traders_long ?? null,
    dealer_traders_short: enrichment?.dealer_traders_short ?? null,
    asset_mgr_long: enrichment?.asset_mgr_long ?? null,
    asset_mgr_short: enrichment?.asset_mgr_short ?? null,
    asset_mgr_spread: enrichment?.asset_mgr_spread ?? null,
    asset_mgr_net: assetMgrNet,
    asset_mgr_delta_long: enrichment?.asset_mgr_delta_long ?? null,
    asset_mgr_delta_short: enrichment?.asset_mgr_delta_short ?? null,
    asset_mgr_delta_net: assetMgrDeltaNet,
    asset_mgr_pct_oi_long: enrichment?.asset_mgr_pct_oi_long ?? null,
    asset_mgr_pct_oi_short: enrichment?.asset_mgr_pct_oi_short ?? null,
    asset_mgr_traders_long: enrichment?.asset_mgr_traders_long ?? null,
    asset_mgr_traders_short: enrichment?.asset_mgr_traders_short ?? null,
    lev_money_long: enrichment?.lev_money_long ?? null,
    lev_money_short: enrichment?.lev_money_short ?? null,
    lev_money_spread: enrichment?.lev_money_spread ?? null,
    lev_money_net: levMoneyNet,
    lev_money_delta_long: enrichment?.lev_money_delta_long ?? null,
    lev_money_delta_short: enrichment?.lev_money_delta_short ?? null,
    lev_money_delta_net: levMoneyDeltaNet,
    lev_money_pct_oi_long: enrichment?.lev_money_pct_oi_long ?? null,
    lev_money_pct_oi_short: enrichment?.lev_money_pct_oi_short ?? null,
    lev_money_traders_long: enrichment?.lev_money_traders_long ?? null,
    lev_money_traders_short: enrichment?.lev_money_traders_short ?? null,
    other_rept_long: enrichment?.other_rept_long ?? null,
    other_rept_short: enrichment?.other_rept_short ?? null,
    other_rept_spread: enrichment?.other_rept_spread ?? null,
    other_rept_net: otherReptNet,
    other_rept_delta_long: enrichment?.other_rept_delta_long ?? null,
    other_rept_delta_short: enrichment?.other_rept_delta_short ?? null,
    other_rept_delta_net: otherReptDeltaNet,
    nonrept_long: enrichment?.nonrept_long ?? null,
    nonrept_short: enrichment?.nonrept_short ?? null,
    nonrept_net: nonreptNet,
    nonrept_delta_long: enrichment?.nonrept_delta_long ?? null,
    nonrept_delta_short: enrichment?.nonrept_delta_short ?? null,
    nonrept_delta_net: nonreptDeltaNet,
    noncomm_long: enrichment?.noncomm_long ?? null,
    noncomm_short: enrichment?.noncomm_short ?? null,
    noncomm_spread: enrichment?.noncomm_spread ?? null,
    noncomm_net: noncommNet,
    noncomm_delta_long: enrichment?.noncomm_delta_long ?? null,
    noncomm_delta_short: enrichment?.noncomm_delta_short ?? null,
    noncomm_delta_spread: enrichment?.noncomm_delta_spread ?? null,
    noncomm_delta_net: noncommDeltaNet,
    noncomm_pct_oi_long: enrichment?.noncomm_pct_oi_long ?? null,
    noncomm_pct_oi_short: enrichment?.noncomm_pct_oi_short ?? null,
    noncomm_traders_long: enrichment?.noncomm_traders_long ?? null,
    noncomm_traders_short: enrichment?.noncomm_traders_short ?? null,
    noncomm_traders_spread: enrichment?.noncomm_traders_spread ?? null,
    commercial_traders_long: enrichment?.commercial_traders_long ?? null,
    commercial_traders_short: enrichment?.commercial_traders_short ?? null,
    commercial_pct_oi_long: enrichment?.commercial_pct_oi_long ?? null,
    commercial_pct_oi_short: enrichment?.commercial_pct_oi_short ?? null,
    conc_net_4_long: enrichment?.conc_net_4_long ?? null,
    conc_net_4_short: enrichment?.conc_net_4_short ?? null,
    conc_net_8_long: enrichment?.conc_net_8_long ?? null,
    conc_net_8_short: enrichment?.conc_net_8_short ?? null,
  };
}

function directionFromScore(score: number | null | undefined): PairSnapshot["direction"] | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score === 0) {
    return null;
  }
  return score > 0 ? "LONG" : "SHORT";
}

function getDealerDirectionalRatio(market: MarketSnapshot) {
  if (typeof market.dealer_directional_ratio === "number") {
    return market.dealer_directional_ratio;
  }
  if (typeof market.dealer_spread !== "number" || market.dealer_spread < 0) {
    return null;
  }
  const directional = Math.abs(market.dealer_net);
  const denom = directional + market.dealer_spread;
  return denom > 0 ? directional / denom : null;
}

export function resolveDealerNeutral(
  base: MarketSnapshot,
  quote: MarketSnapshot,
): PairSnapshot["direction"] | null {
  const baseRatio = getDealerDirectionalRatio(base);
  const quoteRatio = getDealerDirectionalRatio(quote);

  // Tier 1: Spread directional ratio
  if (typeof baseRatio === "number" && typeof quoteRatio === "number") {
    const dir = directionFromScore(baseRatio - quoteRatio);
    if (dir) {
      return dir;
    }
  }

  // Tier 2: Delta persistence (one side must clearly win and be >= 3)
  const basePersistence = base.dealer_delta_persistence ?? 0;
  const quotePersistence = quote.dealer_delta_persistence ?? 0;
  if (basePersistence !== quotePersistence && (basePersistence >= 3 || quotePersistence >= 3)) {
    if (
      basePersistence > quotePersistence &&
      basePersistence >= 3 &&
      typeof base.dealer_delta_net === "number" &&
      base.dealer_delta_net !== 0
    ) {
      return base.dealer_delta_net > 0 ? "LONG" : "SHORT";
    }
    if (
      quotePersistence > basePersistence &&
      quotePersistence >= 3 &&
      typeof quote.dealer_delta_net === "number" &&
      quote.dealer_delta_net !== 0
    ) {
      return quote.dealer_delta_net > 0 ? "SHORT" : "LONG";
    }
  }

  // Tier 3: OI-confirmed delta
  const baseConfirmed =
    typeof base.dealer_delta_net === "number" &&
    typeof base.oi_delta === "number" &&
    base.dealer_delta_net !== 0 &&
    base.oi_delta !== 0 &&
    Math.sign(base.dealer_delta_net) === Math.sign(base.oi_delta);
  const quoteConfirmed =
    typeof quote.dealer_delta_net === "number" &&
    typeof quote.oi_delta === "number" &&
    quote.dealer_delta_net !== 0 &&
    quote.oi_delta !== 0 &&
    Math.sign(quote.dealer_delta_net) === Math.sign(quote.oi_delta);

  if (baseConfirmed && !quoteConfirmed) {
    return base.dealer_delta_net! > 0 ? "LONG" : "SHORT";
  }
  if (quoteConfirmed && !baseConfirmed) {
    return quote.dealer_delta_net! > 0 ? "SHORT" : "LONG";
  }
  if (baseConfirmed && quoteConfirmed) {
    const dir = directionFromScore((base.dealer_delta_net ?? 0) - (quote.dealer_delta_net ?? 0));
    if (dir) {
      return dir;
    }
  }

  // Tier 4: raw delta difference
  if (typeof base.dealer_delta_net === "number" && typeof quote.dealer_delta_net === "number") {
    const dir = directionFromScore(base.dealer_delta_net - quote.dealer_delta_net);
    if (dir) {
      return dir;
    }
  }

  // Tier 5: forced lean
  return directionFromScore(base.dealer_net - quote.dealer_net);
}

export function resolveCommercialFxDirection(
  base: MarketSnapshot,
  quote: MarketSnapshot,
): PairSnapshot["direction"] | null {
  const forcedRaw = directionFromScore(
    typeof base.commercial_net === "number" && typeof quote.commercial_net === "number"
      ? base.commercial_net - quote.commercial_net
      : null,
  );
  if (!forcedRaw) {
    return null;
  }

  const basePersistence = base.commercial_delta_persistence ?? 0;
  const quotePersistence = quote.commercial_delta_persistence ?? 0;
  if (
    basePersistence !== quotePersistence &&
    (basePersistence >= 3 || quotePersistence >= 3)
  ) {
    const persistenceDirection = directionFromScore(basePersistence - quotePersistence);
    if (persistenceDirection && persistenceDirection !== forcedRaw) {
      return persistenceDirection;
    }
  }

  return forcedRaw;
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

    if (mode === "commercial") {
      const resolved = resolveCommercialFxDirection(base, quote);
      if (resolved === "LONG") {
        pairs[pairDef.pair] = {
          direction: "LONG",
          base_bias: baseBias.bias,
          quote_bias: quoteBias.bias,
        };
      } else if (resolved === "SHORT") {
        pairs[pairDef.pair] = {
          direction: "SHORT",
          base_bias: baseBias.bias,
          quote_bias: quoteBias.bias,
        };
      }
      continue;
    }

    const isNeutral =
      baseBias.bias === "NEUTRAL" ||
      quoteBias.bias === "NEUTRAL" ||
      baseBias.bias === quoteBias.bias;
    if (isNeutral) {
      if (mode === "dealer") {
        const resolved = resolveDealerNeutral(base, quote);
        if (resolved) {
          pairs[pairDef.pair] = {
            direction: resolved,
            base_bias: baseBias.bias,
            quote_bias: quoteBias.bias,
          };
        }
      }
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

export function derivePairDirectionsWithNeutral(
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

    if (mode === "commercial") {
      const resolved = resolveCommercialFxDirection(base, quote);
      if (resolved === "LONG") {
        pairs[pairDef.pair] = {
          direction: "LONG",
          base_bias: baseBias.bias,
          quote_bias: quoteBias.bias,
        };
      } else if (resolved === "SHORT") {
        pairs[pairDef.pair] = {
          direction: "SHORT",
          base_bias: baseBias.bias,
          quote_bias: quoteBias.bias,
        };
      } else {
        pairs[pairDef.pair] = {
          direction: "NEUTRAL",
          base_bias: baseBias.bias,
          quote_bias: quoteBias.bias,
        };
      }
      continue;
    }

    // Include neutral pairs
    if (baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL") {
      if (mode === "dealer") {
        const resolved = resolveDealerNeutral(base, quote);
        if (resolved) {
          pairs[pairDef.pair] = {
            direction: resolved,
            base_bias: baseBias.bias,
            quote_bias: quoteBias.bias,
          };
          continue;
        }
      }
      pairs[pairDef.pair] = {
        direction: "NEUTRAL",
        base_bias: baseBias.bias,
        quote_bias: quoteBias.bias,
      };
      continue;
    }

    if (baseBias.bias === quoteBias.bias) {
      if (mode === "dealer") {
        const resolved = resolveDealerNeutral(base, quote);
        if (resolved) {
          pairs[pairDef.pair] = {
            direction: resolved,
            base_bias: baseBias.bias,
            quote_bias: quoteBias.bias,
          };
          continue;
        }
      }
      pairs[pairDef.pair] = {
        direction: "NEUTRAL",
        base_bias: baseBias.bias,
        quote_bias: quoteBias.bias,
      };
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

export function derivePairDirectionsByBaseWithNeutral(
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

    if (!baseBias) {
      continue;
    }

    if (baseBias.bias === "NEUTRAL") {
      pairs[pairDef.pair] = {
        direction: "NEUTRAL",
        base_bias: baseBias.bias,
        quote_bias: quoteBias?.bias ?? "NEUTRAL",
      };
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
