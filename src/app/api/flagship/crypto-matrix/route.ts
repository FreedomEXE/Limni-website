/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Phase 1 crypto matrix API. Builds BTC/ETH anchor regimes and the
 * ranked alt board for the manual crypto matrix.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import {
  fetchBitget15mSeries,
  fetchBitget4hSeries,
  fetchBitgetCandleSeries,
  type BitgetHourlyCandle,
} from "@/lib/bitget";
import { readAllLatestAssetStrengths } from "@/lib/assetStrength";
import { derivePairDirectionsByBaseWithNeutral } from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { readSnapshot } from "@/lib/cotStore";
import { CRYPTO_UNIVERSE, type CryptoUniverseEntry } from "@/lib/flagship/cryptoUniverse";
import {
  type CryptoAnchorRegime,
  type CryptoBiasDirection,
  type CryptoCandleDetail,
  type CryptoConfidenceTier,
  type CryptoMatrixPayload,
  type CryptoMatrixRow,
  type CryptoTimeframeKey,
} from "@/lib/flagship/cryptoMatrix";
import type { MatrixTrendState } from "@/lib/flagship/matrixStyles";
import { readLatestDailySentimentLock } from "@/lib/sentiment/daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OiRow = {
  symbol: string;
  open_interest: string | number;
};

type FundingRow = {
  symbol: string;
  funding_rate: string | number;
};

type StrengthMap = Record<"1h" | "4h" | "24h", number | null>;

type AltFetchResult = {
  symbol: string;
  altTrend: MatrixTrendState;
  altTrendCandle: CryptoCandleDetail;
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  const bySymbol = new Map<"BTC" | "ETH", Omit<CryptoAnchorRegime, "direction" | "tier" | "votes" | "symbol">>();

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

function deriveAnchorVote(
  correlation: number,
  regime: CryptoAnchorRegime,
): MatrixTrendState {
  if (regime.direction === "NEUTRAL") return "NEUTRAL";
  if (correlation >= 0.75) return toTrendState(regime.direction);
  if (correlation >= 0.5 && regime.tier === "HIGH") return toTrendState(regime.direction);
  return "NEUTRAL";
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

function deriveAltBias(
  row: CryptoUniverseEntry,
  btcWeeklyBias: CryptoBiasDirection,
  ethWeeklyBias: CryptoBiasDirection,
  altTrend: MatrixTrendState,
): { bias: CryptoBiasDirection; biasSource: CryptoMatrixRow["biasSource"] } {
  if (row.symbol === "BTC") {
    return { bias: btcWeeklyBias, biasSource: "BTC" };
  }

  if (row.symbol === "ETH") {
    return { bias: ethWeeklyBias, biasSource: "ETH" };
  }

  if (btcWeeklyBias !== "NEUTRAL" && btcWeeklyBias === ethWeeklyBias) {
    return { bias: btcWeeklyBias, biasSource: "BTC_ETH" };
  }

  if (btcWeeklyBias !== "NEUTRAL" && ethWeeklyBias === "NEUTRAL") {
    return { bias: btcWeeklyBias, biasSource: "BTC" };
  }

  if (ethWeeklyBias !== "NEUTRAL" && btcWeeklyBias === "NEUTRAL") {
    return { bias: ethWeeklyBias, biasSource: "ETH" };
  }

  return { bias: "NEUTRAL", biasSource: "MIXED" };
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
  const [latestOiRows, oi24Rows, fundingRows] = await Promise.all([
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
  ]);

  const oiLatestBySymbol = new Map(latestOiRows.map((row) => [row.symbol.toUpperCase(), toNumber(row.open_interest)]));
  const oi24BySymbol = new Map(oi24Rows.map((row) => [row.symbol.toUpperCase(), toNumber(row.open_interest)]));
  const fundingBySymbol = new Map(fundingRows.map((row) => [row.symbol.toUpperCase(), toNumber(row.funding_rate)]));

  return {
    oiLatestBySymbol,
    oi24BySymbol,
    fundingBySymbol,
  };
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

export async function GET() {
  try {
    const [btcDirectionRegime, ethDirectionRegime, anchorMarketData, strengthBySymbol, weeklyBiasBySymbol] = await Promise.all([
      buildAnchorRegime("BTC"),
      buildAnchorRegime("ETH"),
      readAnchorMarketData(),
      readCryptoStrengths(),
      readWeeklyCryptoBias(),
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

    const altRows = await mapWithConcurrency(CRYPTO_UNIVERSE, 4, async (entry) => {
      try {
        const candle = await fetchLastCompletedCandle(entry.symbol, "H4");
        return {
          symbol: entry.symbol,
          altTrend: deriveAltTrend(candle),
          altTrendCandle: buildCandleDetail(candle),
        } satisfies AltFetchResult;
      } catch {
        return {
          symbol: entry.symbol,
          altTrend: "NEUTRAL",
          altTrendCandle: null,
        } satisfies AltFetchResult;
      }
    });

    const altFetchBySymbol = new Map(altRows.map((row) => [row.symbol, row]));

    const rows: CryptoMatrixRow[] = CRYPTO_UNIVERSE.map((entry) => {
      const altFetch = altFetchBySymbol.get(entry.symbol);
      const altTrend = altFetch?.altTrend ?? "NEUTRAL";
      const altTrendCandle = altFetch?.altTrendCandle ?? null;
      const { bias, biasSource } = deriveAltBias(entry, btcRegime.weeklyBias, ethRegime.weeklyBias, altTrend);
      const btcVote = deriveAnchorVote(entry.btcCorrelation7d, btcRegime);
      const ethVote = deriveAnchorVote(entry.btcCorrelation7d, ethRegime);
      const strength = strengthBySymbol.get(entry.symbol) ?? { "1h": null, "4h": null, "24h": null };
      const oiLatest =
        entry.symbol === "BTC" || entry.symbol === "ETH"
          ? anchorMarketData.oiLatestBySymbol.get(entry.symbol) ?? null
          : null;
      const oi24 =
        entry.symbol === "BTC" || entry.symbol === "ETH"
          ? anchorMarketData.oi24BySymbol.get(entry.symbol) ?? null
          : null;
      const oiDelta24hPct =
        oiLatest !== null && oi24 !== null && oi24 > 0
          ? ((oiLatest - oi24) / oi24) * 100
          : null;

      return {
        symbol: entry.symbol,
        bitgetSymbol: entry.bitgetSymbol,
        tier: entry.tier,
        rank: entry.rank,
        compositeScore: entry.compositeScore,
        btcCorrelation7d: entry.btcCorrelation7d,
        bias,
        biasSource,
        btcVote,
        ethVote,
        altTrend,
        altTrendCandle,
        oiDelta24hPct,
        openInterest: oiLatest,
        fundingRate:
          entry.symbol === "BTC" || entry.symbol === "ETH"
            ? anchorMarketData.fundingBySymbol.get(entry.symbol) ?? null
            : null,
        strength1h: strength["1h"],
        strength4h: strength["4h"],
        strength24h: strength["24h"],
        strengthState: strengthStateFromScore(strength["1h"]),
        trigger: "TBD",
        sizing: "TBD",
      };
    });

    const payload: CryptoMatrixPayload = {
      generatedUtc: new Date().toISOString(),
      regimes: {
        btc: btcRegime,
        eth: ethRegime,
      },
      rows,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build crypto matrix" },
      { status: 500 },
    );
  }
}
