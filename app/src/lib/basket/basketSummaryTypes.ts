/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketSummaryTypes.ts
 *
 * Description:
 * Serializable closed-history basket bundle contracts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";
import type { TradeDirection, TradeOrigin, TradeStrategyFamily } from "@/lib/trades/tradeTypes";

export type BasketRowKind = "trade" | "grid" | "fill";

export type BasketReturnMatrix = {
  canonical: { rawPct: number } | null;
  execution: { rawPct: number } | null;
  adrPct: number | null;
};

export type BasketRiskMatrix = {
  canonical: {
    maeRawPct: number | null;
    pathDrawdownRawPct: number | null;
  } | null;
  execution: {
    maeRawPct: number | null;
    pathDrawdownRawPct: number | null;
  } | null;
  adrPct: number | null;
};

export type ClosedHistoryRow = {
  rowKind: BasketRowKind;
  origin: TradeOrigin;
  strategyFamily: TradeStrategyFamily;
  strategyVariant: string;
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  sourceModel: string | null;
  tier: number | null;
  direction: TradeDirection | null;
  fillSeq: number | null;
  parentNaturalRef: string | null;
  canonicalTradeId: string | null;
  executionTradeId: string | null;
  entryUtc: string | null;
  exitUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  returnMatrix: BasketReturnMatrix;
  riskMatrix?: BasketRiskMatrix;
  exitReason: string | null;
  capActiveFillsAtEntry: number | null;
  capThresholdAtEntry: number | null;
  capViolated: boolean;
  warnings: string[];
};

export type ClosedHistoryLedgerIdentity = {
  executionLedgerId: string;
  tradeRowLedgerId: string;
  rowCount: number;
  generatedFrom: "strategy-runtime";
};

export type ClosedHistoryBundle = {
  rows: ClosedHistoryRow[];
  strategyVariant: string;
  scope: AssetClass[];
  generatedAt: string;
  ledgerIdentity?: ClosedHistoryLedgerIdentity;
};

export type CurrentWeekSlice = {
  rows: ClosedHistoryRow[];
  strategyVariant: string;
  scope: AssetClass[];
  generatedAt: string;
};

export type ClosedHistoryResponse = {
  bundle: ClosedHistoryBundle;
};

// QUARANTINED 2026-05-30 - legacy paginated Basket browser contracts.
// The active Basket hierarchy uses ClosedHistoryBundle above. These aliases keep
// the preserved Phase 2 files parseable until a future cleanup pass removes them.
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
  anchorType: string;
  returnRows: BasketReturnMatrixRow[];
  tradeCount: number;
  pairCount: number;
  bestPair: BasketPairExtreme | null;
  worstPair: BasketPairExtreme | null;
  warnings: string[];
};

export type BasketPairSummary = {
  symbol: string;
  returnRows: BasketReturnMatrixRow[];
  strategyCount: number;
  tradeCount: number;
  warnings: string[];
};

export type BasketWeeksResponse = {
  weeks: BasketWeekSummary[];
  hasMore: boolean;
};

export type BasketWeekPairsResponse = {
  pairs: BasketPairSummary[];
};
