/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: intradayThresholds.ts
 *
 * Description:
 * Provisional ADR threshold map for the intraday forward-test board.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";

export type IntradayThresholdConfig = {
  assetClass: AssetClass;
  adrMultiplier: number;
  sourceLabel: string;
};

export const INTRADAY_ADR_THRESHOLDS: Record<AssetClass, IntradayThresholdConfig> = {
  fx: {
    assetClass: "fx",
    adrMultiplier: 1.5,
    sourceLabel: "FX ADR + 1H engulfing + 5m EMA50 research",
  },
  indices: {
    assetClass: "indices",
    adrMultiplier: 0.75,
    sourceLabel: "Indices ADR-only matrix study",
  },
  crypto: {
    assetClass: "crypto",
    adrMultiplier: 1.5,
    sourceLabel: "Crypto ADR-only matrix study",
  },
  commodities: {
    assetClass: "commodities",
    adrMultiplier: 1,
    sourceLabel: "Commodities ADR-only matrix study",
  },
};

export function getIntradayAdrThreshold(assetClass: AssetClass) {
  return INTRADAY_ADR_THRESHOLDS[assetClass];
}
