/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketSummaryTypes.ts
 *
 * Description:
 * Serializable payload contracts for the all-time Basket browser.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AnchorType } from "@/lib/trades/tradeTypes";

export type BasketReturnMatrixRow = {
  canonical: { rawPct: number } | null;
  execution: { rawPct: number } | null;
  adrPct: number | null;
};

export type BasketPairExtreme = {
  symbol: string;
  rawPct: number | null;
  adrNormalizedPct: number | null;
};

export type BasketWeekSummary = {
  weekOpenUtc: string;
  anchorType: AnchorType;
  totalRawPct: number | null;
  totalAdrPct: number | null;
  tradeCount: number;
  pairCount: number;
  bestPair: BasketPairExtreme | null;
  worstPair: BasketPairExtreme | null;
  returnRows: BasketReturnMatrixRow[];
  warnings: string[];
};

export type BasketPairSummary = {
  symbol: string;
  anchorType: AnchorType;
  totalRawPct: number | null;
  totalAdrPct: number | null;
  strategyCount: number;
  tradeCount: number;
  returnRows: BasketReturnMatrixRow[];
  warnings: string[];
};

export type BasketWeeksResponse = {
  weeks: BasketWeekSummary[];
  hasMore: boolean;
  meta: {
    strategyVariant: string;
    anchorType: AnchorType;
    limit: number;
    offset: number;
  };
};

export type BasketWeekPairsResponse = {
  pairs: BasketPairSummary[];
  meta: {
    weekOpenUtc: string;
    strategyVariant: string;
    anchorType: AnchorType;
  };
};
