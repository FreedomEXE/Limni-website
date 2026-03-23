/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonicalInstruments.ts
 * Description: Canonical instrument registry definitions for the price layer.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "./cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";
import { getOandaInstrument } from "./oandaPrices";

export type CanonicalInstrument = {
  symbol: string;
  assetClass: AssetClass;
  primaryProvider: "oanda" | "bitget";
  oandaInstrument: string | null;
  bitgetBaseCoin: string | null;
  isActive: boolean;
};

function buildCanonicalInstruments(): CanonicalInstrument[] {
  const instruments: CanonicalInstrument[] = [];

  for (const definition of PAIRS_BY_ASSET_CLASS.fx) {
    instruments.push({
      symbol: definition.pair,
      assetClass: "fx",
      primaryProvider: "oanda",
      oandaInstrument: getOandaInstrument(definition.pair),
      bitgetBaseCoin: null,
      isActive: true,
    });
  }

  for (const definition of PAIRS_BY_ASSET_CLASS.indices) {
    instruments.push({
      symbol: definition.pair,
      assetClass: "indices",
      primaryProvider: "oanda",
      oandaInstrument: getOandaInstrument(definition.pair),
      bitgetBaseCoin: null,
      isActive: true,
    });
  }

  for (const definition of PAIRS_BY_ASSET_CLASS.crypto) {
    instruments.push({
      symbol: definition.pair,
      assetClass: "crypto",
      primaryProvider: "bitget",
      oandaInstrument: null,
      bitgetBaseCoin: definition.base,
      isActive: true,
    });
  }

  for (const definition of PAIRS_BY_ASSET_CLASS.commodities) {
    instruments.push({
      symbol: definition.pair,
      assetClass: "commodities",
      primaryProvider: "oanda",
      oandaInstrument: getOandaInstrument(definition.pair),
      bitgetBaseCoin: null,
      isActive: true,
    });
  }

  return instruments;
}

export const CANONICAL_INSTRUMENTS: CanonicalInstrument[] = buildCanonicalInstruments();

export function getCanonicalInstrument(symbol: string): CanonicalInstrument | null {
  const normalized = symbol.trim().toUpperCase();
  return CANONICAL_INSTRUMENTS.find((instrument) => instrument.symbol === normalized) ?? null;
}

export function listCanonicalInstruments(assetClass?: AssetClass): CanonicalInstrument[] {
  if (!assetClass) {
    return [...CANONICAL_INSTRUMENTS];
  }
  return CANONICAL_INSTRUMENTS.filter((instrument) => instrument.assetClass === assetClass);
}
