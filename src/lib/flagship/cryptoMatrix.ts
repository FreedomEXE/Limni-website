/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: cryptoMatrix.ts
 *
 * Description:
 * Shared types for the Phase 1 crypto matrix API and UI.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { MatrixContextView, MatrixTrendState } from "@/lib/flagship/matrixStyles";
import type { CryptoUniverseTier } from "@/lib/flagship/cryptoUniverse";

export type CryptoBiasDirection = "LONG" | "SHORT" | "NEUTRAL";
export type CryptoConfidenceTier = "HIGH" | "MEDIUM" | "NEUTRAL";
export type CryptoTimeframeKey = "H4" | "H1" | "M15";

export type CryptoTfVote = {
  timeframe: CryptoTimeframeKey;
  direction: MatrixTrendState;
};

export type CryptoCandleDetail = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bodyPct: number;
} | null;

export type CryptoAnchorRegime = {
  symbol: "BTC" | "ETH";
  weeklyBias: CryptoBiasDirection;
  dealerBias: MatrixTrendState;
  commercialBias: MatrixTrendState;
  sentimentBias: MatrixTrendState;
  cotReportDate: string | null;
  sentimentDate: string | null;
  direction: CryptoBiasDirection;
  tier: CryptoConfidenceTier;
  votes: Record<CryptoTimeframeKey, MatrixTrendState>;
};

export type CryptoMatrixRow = {
  symbol: string;
  bitgetSymbol: string;
  tier: CryptoUniverseTier;
  rank: number;
  compositeScore: number;
  btcCorrelation7d: number;
  opportunityScore: number;
  change24hPct: number | null;
  volume24hUsd: number | null;
  bias: CryptoBiasDirection;
  biasSource: "BTC" | "ETH" | "BTC_ETH" | "MIXED";
  btcVote: MatrixTrendState;
  ethVote: MatrixTrendState;
  altTrend: MatrixTrendState;
  altTrendCandle: CryptoCandleDetail;
  oiDelta24hPct: number | null;
  openInterest: number | null;
  fundingRate: number | null;
  liquidationTilt: "ABOVE" | "BELOW" | "BALANCED" | "NONE" | null;
  largestAboveNotional: number | null;
  largestBelowNotional: number | null;
  strength1h: number | null;
  strength4h: number | null;
  strength24h: number | null;
  strengthState: MatrixTrendState | null;
  gammaState: MatrixContextView;
  liquidationAgree: boolean;
  oiAgree: boolean;
  fundingAgree: boolean;
  adrPct: number | null;
  adrBarsUsed: number;
  adrMultiplier: number | null;
  weekOpenUtc: string | null;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  oneAdrLongTriggerPrice: number | null;
  oneAdrShortTriggerPrice: number | null;
  oneAdrTouched: boolean;
  touched: boolean;
  sizing: string;
};

export type CryptoMatrixPayload = {
  generatedUtc: string;
  visibleCount: number;
  trackedUniverseCount: number;
  regimes: {
    btc: CryptoAnchorRegime;
    eth: CryptoAnchorRegime;
  };
  rows: CryptoMatrixRow[];
};
