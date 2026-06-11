/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: tradeTypes.ts
 *
 * Description:
 * Shared types for the universal trade ledger.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type TradeOrigin = "backtest" | "simulation" | "live" | "research";
export type TradeStrategyFamily = "weekly_hold" | "adr_grid" | string;
export type AnchorType = "canonical" | "execution";
export type TradeDirection = "LONG" | "SHORT";
export type TradeSurface = "performance" | "data" | "matrix" | "research" | "live";

export type TradeNaturalKey = {
  origin: TradeOrigin;
  strategyFamily: TradeStrategyFamily;
  strategyVariant: string;
  engineVersion: string;
  anchorType: AnchorType;
  anchorVersion: string;
  symbol: string;
  direction: TradeDirection | null;
  weekOpenUtc: string;
  sourceModel?: string | null;
  tier?: number | null;
  parentTradeId?: string | null;
  fillSeq?: number | null;
};

export type LiveTradeIdentityInput = {
  brokerId: string;
  brokerTradeId: string;
};

export type Trade = {
  tradeId: string;
  origin: TradeOrigin;
  strategyFamily: TradeStrategyFamily;
  strategyVariant: string;
  engineVersion: string;
  anchorType: AnchorType;
  anchorVersion: string;
  symbol: string;
  assetClass: string;
  direction: TradeDirection | null;
  sourceModel: string | null;
  tier: number | null;
  weekOpenUtc: string;
  entryUtc: string | null;
  exitUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  rawPct: number | null;
  adrNormalizedPct: number | null;
  adrPct: number | null;
  weight: number | null;
  exitReason: string | null;
  parentTradeId: string | null;
  fillSeq: number | null;
  activeFillsAtEntry: number | null;
  capThresholdAtEntry: number | null;
  capViolated: boolean;
  liveTradeId: string | null;
  warnings: string[];
  createdAtUtc: string;
};
