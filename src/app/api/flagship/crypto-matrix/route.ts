/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Builds the live crypto matrix from BTC/ETH weekly bias, Bitget
 * USDT-M anchor direction, and a regime-ranked perp universe.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import {
  fetchBitget15mSeries,
  fetchBitget4hSeries,
  fetchBitgetCandleSeries,
  fetchBitgetDailySeries,
  fetchBitgetMarketContracts,
  fetchBitgetMarketTickers,
  type BitgetHourlyCandle,
  type BitgetMarketContract,
  type BitgetMarketTicker,
} from "@/lib/bitget";
import { readAllLatestAssetStrengths } from "@/lib/assetStrength";
import { getCanonicalTradingDayWindow } from "@/lib/canonicalPriceWindows";
import { fetchLiquidationHeatmap } from "@/lib/coinank";
import { derivePairDirectionsByBaseWithNeutral } from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { query } from "@/lib/db";
import { getIntradayAdrThreshold } from "@/lib/flagship/intradayThresholds";
import { CURATED_CRYPTO_LOOKUP, type CryptoUniverseEntry } from "@/lib/flagship/cryptoUniverse";
import {
  type CryptoAnchorRegime,
  type CryptoBiasDirection,
  type CryptoCandleDetail,
  type CryptoConfidenceTier,
  type CryptoMatrixPayload,
  type CryptoMatrixRow,
  type CryptoTimeframeKey,
} from "@/lib/flagship/cryptoMatrix";
import type { MatrixContextView, MatrixTrendState } from "@/lib/flagship/matrixStyles";
import { readNearestLiquidationHeatmapSnapshot } from "@/lib/marketSnapshots";
import { readSnapshot } from "@/lib/cotStore";
import { readLatestDailySentimentLock } from "@/lib/sentiment/daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISPLAY_LIMIT = 40;
const PRELIMINARY_FETCH_LIMIT = 60;
const MIN_VOLUME_USD = 1_000_000;
const MAX_VOLUME_CANDIDATES = 140;
const ALT_FETCH_CONCURRENCY = 5;
const CRYPTO_ADR_LOOKBACK_DAYS = 10;
const CRYPTO_ADR_MIN_REQUIRED_DAYS = 5;

type OiRow = {
  symbol: string;
  open_interest: string | number;
};

type FundingRow = {
  symbol: string;
  funding_rate: string | number;
};

type LiquidationRow = {
  symbol: string;
  dominant_side: "long" | "short" | "flat" | string;
  largest_above_notional: string | number | null;
  largest_below_notional: string | number | null;
};

type LiquidationContext = {
  largestAboveNotional: number | null;
  largestBelowNotional: number | null;
};

type StrengthMap = Record<"1h" | "4h" | "24h", number | null>;

type AltFetchResult = {
  symbol: string;
  altTrend: MatrixTrendState;
  altTrendCandle: CryptoCandleDetail;
};

type WeeklyBiasSnapshot = Omit<CryptoAnchorRegime, "direction" | "tier" | "votes" | "symbol">;

type CryptoAdrContext = {
  adrPct: number | null;
  adrBarsUsed: number;
  adrMultiplier: number;
  weekOpenUtc: string;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  oneAdrLongTriggerPrice: number | null;
  oneAdrShortTriggerPrice: number | null;
};

type MarketCandidate = {
  symbol: string;
  bitgetSymbol: string;
  tier: CryptoMatrixRow["tier"];
  curatedScore: number;
  btcCorrelation7d: number;
  change24hPct: number | null;
  volume24hUsd: number | null;
  fundingRate: number | null;
  openInterestUsd: number | null;
  maxLeverage: number | null;
  preliminaryScore: number;
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function toPct(high: number, low: number, open: number) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(open) || open <= 0) {
    return null;
  }
  return ((high - low) / open) * 100;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function minMaxNormalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (Math.abs(max - min) < 1e-12) return 1;
  return clamp01((value - min) / (max - min));
}

function toTrendState(direction: CryptoBiasDirection): MatrixTrendState {
  if (direction === "LONG") return "BULLISH";
  if (direction === "SHORT") return "BEARISH";
  return "NEUTRAL";
}

function alignBoundary(nowUtc: DateTime, timeframe: CryptoTimeframeKey) {
  if (timeframe === "H1") {
    return nowUtc.startOf("hour");
  }
  if (timeframe === "H4") {
    const hourBoundary = nowUtc.startOf("hour");
    return hourBoundary.minus({ hours: hourBoundary.hour % 4 });
  }
  const minuteBoundary = nowUtc.startOf("minute");
  return minuteBoundary.minus({ minutes: minuteBoundary.minute % 15 });
}

async function fetchLastCompletedCandle(symbolBase: string, timeframe: CryptoTimeframeKey) {
  const nowUtc = DateTime.utc();
  const closeUtc = alignBoundary(nowUtc, timeframe);
  const openUtc =
    timeframe === "H4"
      ? closeUtc.minus({ hours: 16 })
      : timeframe === "H1"
        ? closeUtc.minus({ hours: 4 })
        : closeUtc.minus({ hours: 2 });

  const candles =
    timeframe === "H4"
      ? await fetchBitget4hSeries(symbolBase, { openUtc, closeUtc })
      : timeframe === "H1"
        ? await fetchBitgetCandleSeries(symbolBase, { openUtc, closeUtc })
        : await fetchBitget15mSeries(symbolBase, { openUtc, closeUtc });

  const sorted = [...candles].sort((a, b) => a.ts - b.ts);
  return sorted.length >= 2 ? sorted[sorted.length - 1] : sorted[sorted.length - 1] ?? null;
}

function voteFromCandle(candle: BitgetHourlyCandle | null): MatrixTrendState {
  if (!candle) return "NEUTRAL";
  if (candle.close > candle.open) return "BULLISH";
  if (candle.close < candle.open) return "BEARISH";
  return "NEUTRAL";
}

function classifyTier(votes: MatrixTrendState[]): CryptoConfidenceTier {
  const bulls = votes.filter((vote) => vote === "BULLISH").length;
  const bears = votes.filter((vote) => vote === "BEARISH").length;
  if (bulls === 3 || bears === 3) return "HIGH";
  if (bulls >= 2 || bears >= 2) return "MEDIUM";
  return "NEUTRAL";
}

function classifyDirection(votes: MatrixTrendState[]): CryptoBiasDirection {
  const bulls = votes.filter((vote) => vote === "BULLISH").length;
  const bears = votes.filter((vote) => vote === "BEARISH").length;
  if (bulls >= 2) return "LONG";
  if (bears >= 2) return "SHORT";
  return "NEUTRAL";
}

function directionToState(direction: "LONG" | "SHORT" | "NEUTRAL"): MatrixTrendState {
  if (direction === "LONG") return "BULLISH";
  if (direction === "SHORT") return "BEARISH";
  return "NEUTRAL";
}

function majorityBias(votes: MatrixTrendState[]): CryptoBiasDirection {
  const bulls = votes.filter((vote) => vote === "BULLISH").length;
  const bears = votes.filter((vote) => vote === "BEARISH").length;
  if (bulls >= 2) return "LONG";
  if (bears >= 2) return "SHORT";
  return "NEUTRAL";
}

async function readWeeklyCryptoBias() {
  const [snapshot, sentimentLock] = await Promise.all([
    readSnapshot({ assetClass: "crypto" }),
    readLatestDailySentimentLock().catch(() => null),
  ]);

  const pairDefs = PAIRS_BY_ASSET_CLASS.crypto;
  const dealerPairs = snapshot
    ? derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, "dealer")
    : {};
  const commercialPairs = snapshot
    ? derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, "commercial")
    : {};
  const sentimentByPair = new Map(
    (sentimentLock?.rows ?? [])
      .filter((row) => row.symbol === "BTCUSD" || row.symbol === "ETHUSD")
      .map((row) => [row.symbol, row.sentimentDirection]),
  );

  const bySymbol = new Map<"BTC" | "ETH", WeeklyBiasSnapshot>();

  for (const pairDef of pairDefs) {
    const pair = pairDef.pair.toUpperCase();
    const symbol = pairDef.base.toUpperCase() as "BTC" | "ETH";
    const dealerBias = directionToState(dealerPairs[pair]?.direction ?? "NEUTRAL");
    const commercialBias = directionToState(commercialPairs[pair]?.direction ?? "NEUTRAL");
    const sentimentBias = directionToState(sentimentByPair.get(pair) ?? "NEUTRAL");

    bySymbol.set(symbol, {
      weeklyBias: majorityBias([dealerBias, commercialBias, sentimentBias]),
      dealerBias,
      commercialBias,
      sentimentBias,
      cotReportDate: snapshot?.report_date ?? null,
      sentimentDate: sentimentLock?.snapshotDateUtc ?? null,
    });
  }

  return bySymbol;
}

async function buildAnchorRegime(symbol: "BTC" | "ETH"): Promise<CryptoAnchorRegime> {
  const [h4, h1, m15] = await Promise.all([
    fetchLastCompletedCandle(symbol, "H4"),
    fetchLastCompletedCandle(symbol, "H1"),
    fetchLastCompletedCandle(symbol, "M15"),
  ]);

  const votes = {
    H4: voteFromCandle(h4),
    H1: voteFromCandle(h1),
    M15: voteFromCandle(m15),
  } satisfies Record<CryptoTimeframeKey, MatrixTrendState>;

  const voteValues = Object.values(votes);
  return {
    symbol,
    weeklyBias: "NEUTRAL",
    dealerBias: "NEUTRAL",
    commercialBias: "NEUTRAL",
    sentimentBias: "NEUTRAL",
    cotReportDate: null,
    sentimentDate: null,
    direction: classifyDirection(voteValues),
    tier: classifyTier(voteValues),
    votes,
  };
}

function deriveAltTrend(candle: BitgetHourlyCandle | null): AltFetchResult["altTrend"] {
  if (!candle || candle.open <= 0) return "NEUTRAL";
  const bodyPct = ((candle.close - candle.open) / candle.open) * 100;
  if (bodyPct > 0.1) return "BULLISH";
  if (bodyPct < -0.1) return "BEARISH";
  return "NEUTRAL";
}

function buildCandleDetail(candle: BitgetHourlyCandle | null): CryptoCandleDetail {
  if (!candle || candle.open <= 0) return null;
  return {
    ts: candle.ts,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    bodyPct: ((candle.close - candle.open) / candle.open) * 100,
  };
}

function deriveMarketBias(
  btcWeeklyBias: CryptoBiasDirection,
  ethWeeklyBias: CryptoBiasDirection,
): { bias: CryptoBiasDirection; source: CryptoMatrixRow["biasSource"] } {
  if (btcWeeklyBias !== "NEUTRAL" && btcWeeklyBias === ethWeeklyBias) {
    return { bias: btcWeeklyBias, source: "BTC_ETH" };
  }
  if (btcWeeklyBias !== "NEUTRAL" && ethWeeklyBias === "NEUTRAL") {
    return { bias: btcWeeklyBias, source: "BTC" };
  }
  if (ethWeeklyBias !== "NEUTRAL" && btcWeeklyBias === "NEUTRAL") {
    return { bias: ethWeeklyBias, source: "ETH" };
  }
  return { bias: "NEUTRAL", source: "MIXED" };
}

function deriveRowBias(
  symbol: string,
  btcWeeklyBias: CryptoBiasDirection,
  ethWeeklyBias: CryptoBiasDirection,
): { bias: CryptoBiasDirection; biasSource: CryptoMatrixRow["biasSource"] } {
  if (symbol === "BTC") {
    return { bias: btcWeeklyBias, biasSource: "BTC" };
  }
  if (symbol === "ETH") {
    return { bias: ethWeeklyBias, biasSource: "ETH" };
  }
  const marketBias = deriveMarketBias(btcWeeklyBias, ethWeeklyBias);
  return { bias: marketBias.bias, biasSource: marketBias.source };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function readAnchorMarketData() {
  const symbols = ["BTC", "ETH"];
  const [latestOiRows, oi24Rows, fundingRows, liquidationRows] = await Promise.all([
    query<OiRow>(
      `SELECT DISTINCT ON (symbol) symbol, open_interest
         FROM market_oi_snapshots
        WHERE symbol = ANY($1::text[])
        ORDER BY symbol, snapshot_time_utc DESC`,
      [symbols],
    ),
    query<OiRow>(
      `SELECT DISTINCT ON (symbol) symbol, open_interest
         FROM market_oi_snapshots
        WHERE symbol = ANY($1::text[])
          AND snapshot_time_utc <= NOW() - INTERVAL '24 hours'
        ORDER BY symbol, snapshot_time_utc DESC`,
      [symbols],
    ),
    query<FundingRow>(
      `SELECT DISTINCT ON (symbol) symbol, funding_rate
         FROM market_funding_snapshots
        WHERE symbol = ANY($1::text[])
        ORDER BY symbol, snapshot_time_utc DESC`,
      [symbols],
    ),
    query<LiquidationRow>(
      `SELECT DISTINCT ON (symbol)
          symbol,
          dominant_side,
          largest_above_notional,
          largest_below_notional
         FROM market_liquidation_snapshots
        WHERE symbol = ANY($1::text[])
        ORDER BY symbol, snapshot_time_utc DESC`,
      [symbols],
    ),
  ]);

  return {
    oiLatestBySymbol: new Map(latestOiRows.map((row) => [row.symbol.toUpperCase(), toNumber(row.open_interest)])),
    oi24BySymbol: new Map(oi24Rows.map((row) => [row.symbol.toUpperCase(), toNumber(row.open_interest)])),
    fundingBySymbol: new Map(fundingRows.map((row) => [row.symbol.toUpperCase(), toNumber(row.funding_rate)])),
    liquidationBySymbol: new Map(
      liquidationRows.map((row) => [
        row.symbol.toUpperCase(),
        {
          dominantSide: String(row.dominant_side ?? "flat").toLowerCase(),
          largestAboveNotional: toNumber(row.largest_above_notional),
          largestBelowNotional: toNumber(row.largest_below_notional),
        },
      ]),
    ),
  };
}

function pickHeatmapBand(
  items: Array<{ band_pct?: number; estimated_liquidations_usd?: number }> | undefined,
) {
  const rows = Array.isArray(items) ? items : [];
  return (
    rows.find((item) => Number(item.band_pct) === 5) ??
    rows.find((item) => Number(item.band_pct) === 2) ??
    rows[0] ??
    null
  );
}

function deriveHeatmapContext(
  heatmap:
    | Awaited<ReturnType<typeof readNearestLiquidationHeatmapSnapshot>>
    | Awaited<ReturnType<typeof fetchLiquidationHeatmap>>
    | null,
): LiquidationContext | null {
  if (!heatmap) return null;
  const bands = "bands_json" in heatmap
    ? (heatmap.bands_json as {
        longs?: Array<{ band_pct?: number; estimated_liquidations_usd?: number }>;
        shorts?: Array<{ band_pct?: number; estimated_liquidations_usd?: number }>;
      })
    : (heatmap.liquidation_bands as {
        longs?: Array<{ band_pct?: number; estimated_liquidations_usd?: number }>;
        shorts?: Array<{ band_pct?: number; estimated_liquidations_usd?: number }>;
      });

  const aboveBand = pickHeatmapBand(bands.shorts);
  const belowBand = pickHeatmapBand(bands.longs);

  return {
    largestAboveNotional: toNumber(aboveBand?.estimated_liquidations_usd),
    largestBelowNotional: toNumber(belowBand?.estimated_liquidations_usd),
  };
}

async function readHeatmapContexts(symbols: string[]) {
  const contexts = await mapWithConcurrency(Array.from(new Set(symbols)), 4, async (symbol) => {
    try {
      const stored = await readNearestLiquidationHeatmapSnapshot({
        symbol,
        atUtc: new Date().toISOString(),
        interval: "1d",
        exchangeGroup: "binance_bybit",
        maxAgeMinutes: 1440,
      });
      if (stored) {
        return [symbol, deriveHeatmapContext(stored)] as const;
      }
    } catch {
      // fall through to live fetch
    }

    try {
      const live = await fetchLiquidationHeatmap(symbol, {
        interval: "1d",
        exchanges: ["Binance", "Bybit"],
      });
      return [symbol, deriveHeatmapContext(live)] as const;
    } catch {
      return [symbol, null] as const;
    }
  });

  return new Map(
    contexts.filter((entry): entry is readonly [string, LiquidationContext] => Boolean(entry[1])),
  );
}

async function readCryptoStrengths() {
  const strengthResults = await readAllLatestAssetStrengths("crypto");
  const out = new Map<string, StrengthMap>();

  for (const bucket of strengthResults) {
    for (const strength of bucket.strengths) {
      const symbol = strength.asset.toUpperCase();
      if (!out.has(symbol)) {
        out.set(symbol, { "1h": null, "4h": null, "24h": null });
      }
      out.get(symbol)![bucket.window] = Number(strength.normalized);
    }
  }

  return out;
}

function strengthStateFromScore(score: number | null): MatrixTrendState | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score >= 55) return "BULLISH";
  if (score <= 45) return "BEARISH";
  return "NEUTRAL";
}

function isTradableUsdtPerp(ticker: BitgetMarketTicker, contract: BitgetMarketContract | undefined) {
  if (!ticker.symbol.endsWith("USDT")) return false;
  if (!contract) return false;
  const status = String(contract.symbolStatus ?? "").trim().toLowerCase();
  if (status && status !== "normal") return false;
  if (!(ticker.lastPrice !== null && ticker.lastPrice > 0)) return false;
  if (!(ticker.volume24hUsd !== null && ticker.volume24hUsd >= MIN_VOLUME_USD)) return false;
  return true;
}

function deriveCandidateTier(
  symbol: string,
  curated: CryptoUniverseEntry | undefined,
  volume24hUsd: number | null,
): CryptoMatrixRow["tier"] {
  if (symbol === "BTC" || symbol === "ETH") return "ANCHOR";
  if (curated?.tier) return curated.tier;
  if ((volume24hUsd ?? 0) >= 50_000_000) return "A";
  if ((volume24hUsd ?? 0) >= 10_000_000) return "B";
  return "MARKET";
}

function opportunityDistance(
  marketBias: CryptoBiasDirection,
  change24hPct: number | null,
  anchorAvgChangePct: number,
) {
  const change = change24hPct ?? 0;
  if (marketBias === "SHORT") {
    return Math.max(change - anchorAvgChangePct, 0);
  }
  if (marketBias === "LONG") {
    return Math.max(anchorAvgChangePct - change, 0);
  }
  return Math.abs(change - anchorAvgChangePct) * 0.35;
}

function fundingOpportunity(marketBias: CryptoBiasDirection, fundingRate: number | null) {
  const funding = fundingRate ?? 0;
  if (marketBias === "SHORT") return Math.max(funding, 0);
  if (marketBias === "LONG") return Math.max(-funding, 0);
  return Math.abs(funding);
}

function buildDynamicUniverse(params: {
  tickers: BitgetMarketTicker[];
  contracts: BitgetMarketContract[];
  marketBias: CryptoBiasDirection;
}) {
  const { tickers, contracts, marketBias } = params;
  const contractBySymbol = new Map(contracts.map((contract) => [contract.symbol.toUpperCase(), contract]));
  const tickerBySymbol = new Map(tickers.map((ticker) => [ticker.symbol.toUpperCase(), ticker]));
  const btcChange = tickerBySymbol.get("BTCUSDT")?.change24hPct ?? 0;
  const ethChange = tickerBySymbol.get("ETHUSDT")?.change24hPct ?? 0;
  const anchorAvgChangePct = (btcChange + ethChange) / 2;

  const tradable = tickers
    .filter((ticker) => !["BTCUSDT", "ETHUSDT"].includes(ticker.symbol))
    .filter((ticker) => isTradableUsdtPerp(ticker, contractBySymbol.get(ticker.symbol)))
    .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
    .slice(0, MAX_VOLUME_CANDIDATES);

  const rawCandidates = tradable.map((ticker) => {
    const curated = CURATED_CRYPTO_LOOKUP.get(ticker.baseCoin);
    return {
      symbol: ticker.baseCoin,
      bitgetSymbol: ticker.symbol,
      tier: deriveCandidateTier(ticker.baseCoin, curated, ticker.volume24hUsd),
      curatedScore: curated?.compositeScore ?? 42,
      btcCorrelation7d: curated?.btcCorrelation7d ?? 0,
      change24hPct: ticker.change24hPct,
      volume24hUsd: ticker.volume24hUsd,
      fundingRate: ticker.fundingRate,
      openInterestUsd: ticker.openInterestUsd,
      maxLeverage: contractBySymbol.get(ticker.symbol)?.maxLeverage ?? null,
      preliminaryScore: 0,
    } satisfies MarketCandidate;
  });

  if (!rawCandidates.length) {
    return {
      trackedUniverseCount: 0,
      visibleCandidates: [] as MarketCandidate[],
      anchorTickerBySymbol: tickerBySymbol,
    };
  }

  const stretchValues = rawCandidates.map((row) =>
    opportunityDistance(marketBias, row.change24hPct, anchorAvgChangePct),
  );
  const volumeLogs = rawCandidates.map((row) => Math.log10(Math.max(row.volume24hUsd ?? 1, 1)));
  const oiLogs = rawCandidates.map((row) => Math.log10(Math.max(row.openInterestUsd ?? 1, 1)));
  const fundingValues = rawCandidates.map((row) => fundingOpportunity(marketBias, row.fundingRate));
  const qualityValues = rawCandidates.map((row) => row.curatedScore / 100);

  const stretchMin = Math.min(...stretchValues);
  const stretchMax = Math.max(...stretchValues);
  const volumeMin = Math.min(...volumeLogs);
  const volumeMax = Math.max(...volumeLogs);
  const oiMin = Math.min(...oiLogs);
  const oiMax = Math.max(...oiLogs);
  const fundingMin = Math.min(...fundingValues);
  const fundingMax = Math.max(...fundingValues);
  const qualityMin = Math.min(...qualityValues);
  const qualityMax = Math.max(...qualityValues);

  const scoredCandidates = rawCandidates.map((row, index) => {
    const stretchScore = minMaxNormalize(stretchValues[index], stretchMin, stretchMax);
    const volumeScore = minMaxNormalize(volumeLogs[index], volumeMin, volumeMax);
    const oiScore = minMaxNormalize(oiLogs[index], oiMin, oiMax);
    const fundingScore = minMaxNormalize(fundingValues[index], fundingMin, fundingMax);
    const qualityScore = minMaxNormalize(qualityValues[index], qualityMin, qualityMax);
    const preliminaryScore =
      100 *
      (0.5 * stretchScore +
        0.22 * volumeScore +
        0.12 * oiScore +
        0.1 * qualityScore +
        0.06 * fundingScore);

    return {
      ...row,
      preliminaryScore: round(preliminaryScore, 4),
    };
  });

  const visibleCandidates = scoredCandidates
    .sort((a, b) => {
      if (b.preliminaryScore !== a.preliminaryScore) return b.preliminaryScore - a.preliminaryScore;
      return a.symbol.localeCompare(b.symbol);
    })
    .slice(0, PRELIMINARY_FETCH_LIMIT);

  return {
    trackedUniverseCount: tradable.length,
    visibleCandidates,
    anchorTickerBySymbol: tickerBySymbol,
  };
}

function applyTrendOpportunityBonus(
  baseScore: number,
  bias: CryptoBiasDirection,
  altTrend: MatrixTrendState,
) {
  const bonus =
    bias === "SHORT"
      ? altTrend === "BULLISH"
        ? 10
        : altTrend === "NEUTRAL"
          ? 4
          : 0
      : bias === "LONG"
        ? altTrend === "BEARISH"
          ? 10
          : altTrend === "NEUTRAL"
            ? 4
            : 0
        : altTrend === "NEUTRAL"
          ? 2
          : 0;
  return round(baseScore + bonus, 4);
}

function deriveLiquidationTilt(params: {
  largestAboveNotional: number | null;
  largestBelowNotional: number | null;
}) {
  const above = params.largestAboveNotional ?? 0;
  const below = params.largestBelowNotional ?? 0;
  if (!(above > 0) && !(below > 0)) return "NONE" as const;
  if (above > below * 1.15) return "ABOVE" as const;
  if (below > above * 1.15) return "BELOW" as const;
  return "BALANCED" as const;
}

function deriveCryptoGamma(row: {
  bias: CryptoBiasDirection;
  liquidationTilt: CryptoMatrixRow["liquidationTilt"];
  openInterest: number | null;
  fundingRate: number | null;
}) {
  if (row.bias === "NEUTRAL") {
    return {
      gammaState: "N/A" as MatrixContextView,
      liquidationAgree: null,
      oiAgree: null,
      fundingAgree: null,
      availableCount: 0,
      agreeCount: 0,
    };
  }

  const liquidationAgree =
    row.liquidationTilt === null || row.liquidationTilt === "NONE"
      ? null
      : row.bias === "LONG"
        ? row.liquidationTilt === "ABOVE"
        : row.liquidationTilt === "BELOW";
  const oiAgree = row.openInterest === null ? null : row.openInterest >= 20_000_000;
  const fundingAgree =
    row.fundingRate === null
      ? null
      : row.bias === "LONG"
        ? row.fundingRate <= 0
        : row.fundingRate >= 0;
  const inputs = [liquidationAgree, oiAgree, fundingAgree];
  const availableCount = inputs.filter((value) => value !== null).length;
  const agreeCount = inputs.filter((value) => value === true).length;

  return {
    gammaState:
      availableCount === 0
        ? ("N/A" as MatrixContextView)
        : agreeCount >= 2 && agreeCount / availableCount >= 2 / 3
        ? ("CONFIRM" as MatrixContextView)
        : agreeCount >= 1
          ? ("MIXED" as MatrixContextView)
          : ("CONFLICT" as MatrixContextView),
    liquidationAgree,
    oiAgree,
    fundingAgree,
    availableCount,
    agreeCount,
  };
}

async function readAdrContexts(symbols: string[]) {
  const threshold = getIntradayAdrThreshold("crypto");
  const nowUtc = DateTime.utc();
  const tradingDayWindow = getCanonicalTradingDayWindow("crypto", nowUtc);
  const lookbackOpenUtc = tradingDayWindow.openUtc.minus({ days: CRYPTO_ADR_LOOKBACK_DAYS + 2 });

  const entries = await mapWithConcurrency(symbols, 4, async (symbol): Promise<readonly [string, CryptoAdrContext]> => {
    try {
      const [adrBars, weekBars] = await Promise.all([
        fetchBitgetDailySeries(symbol, { openUtc: lookbackOpenUtc, closeUtc: tradingDayWindow.openUtc }),
        fetchBitgetCandleSeries(symbol, { openUtc: tradingDayWindow.openUtc, closeUtc: nowUtc }),
      ]);

      const adrRanges = adrBars
        .slice(-CRYPTO_ADR_LOOKBACK_DAYS)
        .map((bar) => toPct(bar.high, bar.low, bar.open))
        .filter((value): value is number => value !== null && Number.isFinite(value));

      const adrPct =
        adrRanges.length >= CRYPTO_ADR_MIN_REQUIRED_DAYS
          ? adrRanges.reduce((sum, value) => sum + value, 0) / adrRanges.length
          : null;

      const orderedWeekBars = [...weekBars].sort((left, right) => left.ts - right.ts);
      const firstWeekBar = orderedWeekBars[0] ?? null;
      const lastWeekBar = orderedWeekBars[orderedWeekBars.length - 1] ?? null;
      const weekOpenPrice = firstWeekBar?.open ?? null;
      const weekHighPrice =
        orderedWeekBars.length > 0
          ? orderedWeekBars.reduce((max, bar) => Math.max(max, bar.high), Number.NEGATIVE_INFINITY)
          : null;
      const weekLowPrice =
        orderedWeekBars.length > 0
          ? orderedWeekBars.reduce((min, bar) => Math.min(min, bar.low), Number.POSITIVE_INFINITY)
          : null;
      const currentPrice = lastWeekBar?.close ?? null;

      const thresholdPct = adrPct === null ? null : adrPct * threshold.adrMultiplier;
      const longTriggerPrice =
        weekOpenPrice !== null && thresholdPct !== null
          ? weekOpenPrice * (1 - thresholdPct / 100)
          : null;
      const shortTriggerPrice =
        weekOpenPrice !== null && thresholdPct !== null
          ? weekOpenPrice * (1 + thresholdPct / 100)
          : null;
      const oneAdrLongTriggerPrice =
        weekOpenPrice !== null && adrPct !== null
          ? weekOpenPrice * (1 - adrPct / 100)
          : null;
      const oneAdrShortTriggerPrice =
        weekOpenPrice !== null && adrPct !== null
          ? weekOpenPrice * (1 + adrPct / 100)
          : null;

      return [
        symbol,
        {
          adrPct,
          adrBarsUsed: adrRanges.length,
          adrMultiplier: threshold.adrMultiplier,
          weekOpenUtc: tradingDayWindow.periodOpenUtc,
          weekOpenPrice,
          weekHighPrice,
          weekLowPrice,
          currentPrice,
          longTriggerPrice,
          shortTriggerPrice,
          oneAdrLongTriggerPrice,
          oneAdrShortTriggerPrice,
        },
      ] as const;
    } catch {
      return [
        symbol,
        {
          adrPct: null,
          adrBarsUsed: 0,
          adrMultiplier: threshold.adrMultiplier,
          weekOpenUtc: tradingDayWindow.periodOpenUtc,
          weekOpenPrice: null,
          weekHighPrice: null,
          weekLowPrice: null,
          currentPrice: null,
          longTriggerPrice: null,
          shortTriggerPrice: null,
          oneAdrLongTriggerPrice: null,
          oneAdrShortTriggerPrice: null,
        },
      ] as const;
    }
  });

  return new Map(entries);
}

export async function GET() {
  try {
    const [
      btcDirectionRegime,
      ethDirectionRegime,
      anchorMarketData,
      strengthBySymbol,
      weeklyBiasBySymbol,
      tickers,
      contracts,
    ] = await Promise.all([
      buildAnchorRegime("BTC"),
      buildAnchorRegime("ETH"),
      readAnchorMarketData(),
      readCryptoStrengths(),
      readWeeklyCryptoBias(),
      fetchBitgetMarketTickers(),
      fetchBitgetMarketContracts(),
    ]);

    const btcRegime: CryptoAnchorRegime = {
      ...btcDirectionRegime,
      ...(weeklyBiasBySymbol.get("BTC") ?? {
        weeklyBias: "NEUTRAL",
        dealerBias: "NEUTRAL",
        commercialBias: "NEUTRAL",
        sentimentBias: "NEUTRAL",
        cotReportDate: null,
        sentimentDate: null,
      }),
    };
    const ethRegime: CryptoAnchorRegime = {
      ...ethDirectionRegime,
      ...(weeklyBiasBySymbol.get("ETH") ?? {
        weeklyBias: "NEUTRAL",
        dealerBias: "NEUTRAL",
        commercialBias: "NEUTRAL",
        sentimentBias: "NEUTRAL",
        cotReportDate: null,
        sentimentDate: null,
      }),
    };

    const marketBias = deriveMarketBias(btcRegime.weeklyBias, ethRegime.weeklyBias);
    const {
      trackedUniverseCount,
      visibleCandidates,
      anchorTickerBySymbol,
    } = buildDynamicUniverse({
      tickers,
      contracts,
      marketBias: marketBias.bias,
    });

    const anchorSymbols = ["BTC", "ETH"];
    const symbolsToFetch = [
      ...anchorSymbols,
      ...visibleCandidates.map((candidate) => candidate.symbol).filter((symbol) => !anchorSymbols.includes(symbol)),
    ];

    const altRows = await mapWithConcurrency(symbolsToFetch, ALT_FETCH_CONCURRENCY, async (symbol) => {
      try {
        const candle = symbol === "BTC"
          ? await fetchLastCompletedCandle("BTC", "H4")
          : symbol === "ETH"
            ? await fetchLastCompletedCandle("ETH", "H4")
            : await fetchLastCompletedCandle(symbol, "H4");
        return {
          symbol,
          altTrend: deriveAltTrend(candle),
          altTrendCandle: buildCandleDetail(candle),
        } satisfies AltFetchResult;
      } catch {
        return {
          symbol,
          altTrend: "NEUTRAL",
          altTrendCandle: null,
        } satisfies AltFetchResult;
      }
    });

    const altFetchBySymbol = new Map(altRows.map((row) => [row.symbol, row]));

    const anchorRowsBase: CryptoMatrixRow[] = (["BTC", "ETH"] as const).map((symbol) => {
      const ticker = anchorTickerBySymbol.get(`${symbol}USDT`);
      const altFetch = altFetchBySymbol.get(symbol);
      const strength = strengthBySymbol.get(symbol) ?? { "1h": null, "4h": null, "24h": null };
      const oiLatestDb = anchorMarketData.oiLatestBySymbol.get(symbol) ?? null;
      const oi24 = anchorMarketData.oi24BySymbol.get(symbol) ?? null;
      const oiDelta24hPct =
        oiLatestDb !== null && oi24 !== null && oi24 > 0
          ? ((oiLatestDb - oi24) / oi24) * 100
          : null;
      const liquidation = anchorMarketData.liquidationBySymbol.get(symbol) ?? null;

      return {
        symbol,
        bitgetSymbol: `${symbol}USDT`,
        tier: "ANCHOR",
        rank: 0,
        compositeScore: 0,
        btcCorrelation7d: symbol === "BTC" ? 1 : 0.95,
        opportunityScore: 0,
        change24hPct: ticker?.change24hPct ?? null,
        volume24hUsd: ticker?.volume24hUsd ?? null,
        bias: symbol === "BTC" ? btcRegime.weeklyBias : ethRegime.weeklyBias,
        biasSource: symbol,
        btcVote: toTrendState(btcRegime.direction),
        ethVote: toTrendState(ethRegime.direction),
        altTrend:
          symbol === "BTC"
            ? toTrendState(btcRegime.direction)
            : symbol === "ETH"
              ? toTrendState(ethRegime.direction)
              : altFetch?.altTrend ?? "NEUTRAL",
        altTrendCandle: altFetch?.altTrendCandle ?? null,
        oiDelta24hPct,
        openInterest: ticker?.openInterestUsd ?? oiLatestDb,
        fundingRate: ticker?.fundingRate ?? anchorMarketData.fundingBySymbol.get(symbol) ?? null,
        liquidationTilt: liquidation ? deriveLiquidationTilt(liquidation) : null,
        largestAboveNotional: liquidation?.largestAboveNotional ?? null,
        largestBelowNotional: liquidation?.largestBelowNotional ?? null,
        strength1h: strength["1h"],
        strength4h: strength["4h"],
        strength24h: strength["24h"],
        strengthState: strengthStateFromScore(strength["1h"]),
        gammaState: "N/A",
        liquidationAgree: false,
        oiAgree: false,
        fundingAgree: false,
        adrPct: null,
        adrBarsUsed: 0,
        adrMultiplier: null,
        weekOpenUtc: null,
        weekOpenPrice: null,
        weekHighPrice: null,
        weekLowPrice: null,
        currentPrice: null,
        longTriggerPrice: null,
        shortTriggerPrice: null,
        oneAdrLongTriggerPrice: null,
        oneAdrShortTriggerPrice: null,
        oneAdrTouched: false,
        touched: false,
        sizing: "TBD",
      };
    });

    const candidateRows = visibleCandidates.map((candidate) => {
      const altFetch = altFetchBySymbol.get(candidate.symbol);
      const { bias, biasSource } = deriveRowBias(candidate.symbol, btcRegime.weeklyBias, ethRegime.weeklyBias);
      const strength = strengthBySymbol.get(candidate.symbol) ?? { "1h": null, "4h": null, "24h": null };
      return {
        symbol: candidate.symbol,
        bitgetSymbol: candidate.bitgetSymbol,
        tier: candidate.tier,
        rank: 0,
        compositeScore: candidate.curatedScore,
        btcCorrelation7d: candidate.btcCorrelation7d,
        opportunityScore: applyTrendOpportunityBonus(candidate.preliminaryScore, bias, altFetch?.altTrend ?? "NEUTRAL"),
        change24hPct: candidate.change24hPct,
        volume24hUsd: candidate.volume24hUsd,
        bias,
        biasSource,
        btcVote: toTrendState(btcRegime.direction),
        ethVote: toTrendState(ethRegime.direction),
        altTrend: altFetch?.altTrend ?? "NEUTRAL",
        altTrendCandle: altFetch?.altTrendCandle ?? null,
        oiDelta24hPct: null,
        openInterest: candidate.openInterestUsd,
        fundingRate: candidate.fundingRate,
        liquidationTilt: null,
        largestAboveNotional: null,
        largestBelowNotional: null,
        strength1h: strength["1h"],
        strength4h: strength["4h"],
        strength24h: strength["24h"],
        strengthState: strengthStateFromScore(strength["1h"]),
        gammaState: "N/A",
        liquidationAgree: false,
        oiAgree: false,
        fundingAgree: false,
        adrPct: null,
        adrBarsUsed: 0,
        adrMultiplier: null,
        weekOpenUtc: null,
        weekOpenPrice: null,
        weekHighPrice: null,
        weekLowPrice: null,
        currentPrice: null,
        longTriggerPrice: null,
        shortTriggerPrice: null,
        oneAdrLongTriggerPrice: null,
        oneAdrShortTriggerPrice: null,
        oneAdrTouched: false,
        touched: false,
        sizing: "TBD",
      } satisfies CryptoMatrixRow;
    });

    const sortedCandidateRowsBase = candidateRows
      .sort((a, b) => {
        if (b.opportunityScore !== a.opportunityScore) return b.opportunityScore - a.opportunityScore;
        if ((b.volume24hUsd ?? 0) !== (a.volume24hUsd ?? 0)) {
          return (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0);
        }
        return a.symbol.localeCompare(b.symbol);
      })
      .slice(0, DISPLAY_LIMIT)
      .map((row, index) => ({
        ...row,
        rank: index + 1,
      }));

    const adrContextBySymbol = await readAdrContexts([
      ...anchorRowsBase.map((row) => row.symbol),
      ...sortedCandidateRowsBase.map((row) => row.symbol),
    ]);

    const heatmapContextBySymbol = await readHeatmapContexts([
      ...anchorRowsBase.map((row) => row.symbol),
      ...sortedCandidateRowsBase.map((row) => row.symbol),
    ]);

    const anchorRows = anchorRowsBase.map((row) => {
      const heatmapContext = heatmapContextBySymbol.get(row.symbol) ?? null;
      const adrContext = adrContextBySymbol.get(row.symbol) ?? null;
      const liquidation = heatmapContext ?? {
        largestAboveNotional: row.largestAboveNotional,
        largestBelowNotional: row.largestBelowNotional,
      };
      const liquidationTilt = deriveLiquidationTilt(liquidation);
      const gamma = deriveCryptoGamma({
        bias: row.bias,
        liquidationTilt,
        openInterest: row.openInterest,
        fundingRate: row.fundingRate,
      });
      const touched =
        row.bias === "LONG"
          ? Boolean(
              adrContext &&
                adrContext.longTriggerPrice !== null &&
                adrContext.weekLowPrice !== null &&
                adrContext.weekLowPrice <= adrContext.longTriggerPrice,
            )
          : row.bias === "SHORT"
            ? Boolean(
                adrContext &&
                  adrContext.shortTriggerPrice !== null &&
                  adrContext.weekHighPrice !== null &&
                  adrContext.weekHighPrice >= adrContext.shortTriggerPrice,
              )
            : false;
      const oneAdrTouched =
        row.bias === "LONG"
          ? Boolean(
              adrContext &&
                adrContext.oneAdrLongTriggerPrice !== null &&
                adrContext.weekLowPrice !== null &&
                adrContext.weekLowPrice <= adrContext.oneAdrLongTriggerPrice,
            )
          : row.bias === "SHORT"
            ? Boolean(
                adrContext &&
                  adrContext.oneAdrShortTriggerPrice !== null &&
                  adrContext.weekHighPrice !== null &&
                  adrContext.weekHighPrice >= adrContext.oneAdrShortTriggerPrice,
              )
            : false;
      return {
        ...row,
        liquidationTilt,
        largestAboveNotional: liquidation.largestAboveNotional ?? null,
        largestBelowNotional: liquidation.largestBelowNotional ?? null,
        ...gamma,
        adrPct: adrContext?.adrPct ?? null,
        adrBarsUsed: adrContext?.adrBarsUsed ?? 0,
        adrMultiplier: adrContext?.adrMultiplier ?? null,
        weekOpenUtc: adrContext?.weekOpenUtc ?? null,
        weekOpenPrice: adrContext?.weekOpenPrice ?? null,
        weekHighPrice: adrContext?.weekHighPrice ?? null,
        weekLowPrice: adrContext?.weekLowPrice ?? null,
        currentPrice: adrContext?.currentPrice ?? null,
        longTriggerPrice: adrContext?.longTriggerPrice ?? null,
        shortTriggerPrice: adrContext?.shortTriggerPrice ?? null,
        oneAdrLongTriggerPrice: adrContext?.oneAdrLongTriggerPrice ?? null,
        oneAdrShortTriggerPrice: adrContext?.oneAdrShortTriggerPrice ?? null,
        oneAdrTouched,
        touched,
      };
    });

    const sortedCandidateRows = sortedCandidateRowsBase.map((row) => {
      const liquidation = heatmapContextBySymbol.get(row.symbol) ?? null;
      const adrContext = adrContextBySymbol.get(row.symbol) ?? null;
      const liquidationTilt = liquidation ? deriveLiquidationTilt(liquidation) : null;
      const gamma = deriveCryptoGamma({
        bias: row.bias,
        liquidationTilt,
        openInterest: row.openInterest,
        fundingRate: row.fundingRate,
      });
      const touched =
        row.bias === "LONG"
          ? Boolean(
              adrContext &&
                adrContext.longTriggerPrice !== null &&
                adrContext.weekLowPrice !== null &&
                adrContext.weekLowPrice <= adrContext.longTriggerPrice,
            )
          : row.bias === "SHORT"
            ? Boolean(
                adrContext &&
                  adrContext.shortTriggerPrice !== null &&
                  adrContext.weekHighPrice !== null &&
                  adrContext.weekHighPrice >= adrContext.shortTriggerPrice,
              )
            : false;
      const oneAdrTouched =
        row.bias === "LONG"
          ? Boolean(
              adrContext &&
                adrContext.oneAdrLongTriggerPrice !== null &&
                adrContext.weekLowPrice !== null &&
                adrContext.weekLowPrice <= adrContext.oneAdrLongTriggerPrice,
            )
          : row.bias === "SHORT"
            ? Boolean(
                adrContext &&
                  adrContext.oneAdrShortTriggerPrice !== null &&
                  adrContext.weekHighPrice !== null &&
                  adrContext.weekHighPrice >= adrContext.oneAdrShortTriggerPrice,
              )
            : false;
      return {
        ...row,
        liquidationTilt,
        largestAboveNotional: liquidation?.largestAboveNotional ?? null,
        largestBelowNotional: liquidation?.largestBelowNotional ?? null,
        ...gamma,
        adrPct: adrContext?.adrPct ?? null,
        adrBarsUsed: adrContext?.adrBarsUsed ?? 0,
        adrMultiplier: adrContext?.adrMultiplier ?? null,
        weekOpenUtc: adrContext?.weekOpenUtc ?? null,
        weekOpenPrice: adrContext?.weekOpenPrice ?? null,
        weekHighPrice: adrContext?.weekHighPrice ?? null,
        weekLowPrice: adrContext?.weekLowPrice ?? null,
        currentPrice: adrContext?.currentPrice ?? null,
        longTriggerPrice: adrContext?.longTriggerPrice ?? null,
        shortTriggerPrice: adrContext?.shortTriggerPrice ?? null,
        oneAdrLongTriggerPrice: adrContext?.oneAdrLongTriggerPrice ?? null,
        oneAdrShortTriggerPrice: adrContext?.oneAdrShortTriggerPrice ?? null,
        oneAdrTouched,
        touched,
      };
    });

    const payload: CryptoMatrixPayload = {
      generatedUtc: new Date().toISOString(),
      visibleCount: sortedCandidateRows.length,
      trackedUniverseCount,
      regimes: {
        btc: btcRegime,
        eth: ethRegime,
      },
      rows: [...anchorRows, ...sortedCandidateRows],
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build crypto matrix" },
      { status: 500 },
    );
  }
}
