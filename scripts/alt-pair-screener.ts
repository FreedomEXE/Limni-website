/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: alt-pair-screener.ts
 *
 * Description:
 * Screens all Bitget USDT-FUTURES perpetual symbols, scores each
 * alt pair for 3-way handshake suitability, and writes ranked outputs
 * for downstream Variant K backtests.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

type Candle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  quoteVolume: number;
};

type TickerRow = {
  symbol: string;
  lastPr?: string;
  askPr?: string;
  bidPr?: string;
  usdtVolume?: string;
  fundingRate?: string;
  holdingAmount?: string;
};

type ContractRow = {
  symbol?: string;
  baseCoin?: string;
  symbolStatus?: string;
  maxLever?: string;
};

type PairScore = {
  symbol: string;
  baseCoin: string;
  btcCorrelation7d: number;
  avgDailyVolumeUsd: number;
  avgDailyVolatilityPct: number;
  openInterestUsd: number;
  fundingRate: number;
  spreadPct: number;
  maxLeverage: number;
  compositeScore: number;
  tier: "A" | "B" | "C" | "REJECT";
  hardFailReason: string | null;
  sampleHours: number;
};

type WeeklyRecommendation = {
  weekOpenUtc: string;
  lookbackStartUtc: string;
  lookbackEndUtc: string;
  recommendedSymbols: string[];
  pairCount: number;
};

const BITGET_BASE_URL = "https://api.bitget.com";
const PRODUCT_TYPE = "USDT-FUTURES";
const CANDLE_GRANULARITY = "1H";
const CANDLE_LIMIT = 200;
const LOOKBACK_DAYS = 7;
const API_DELAY_MS = 200;
const WEEKLY_SNAPSHOT_COUNT = 5;

const MIN_BTC_CORRELATION = 0.5;
const MIN_DAILY_VOLUME_USD = 5_000_000;
const MIN_ATR_PCT = 1.5;
const MAX_ATR_PCT = 20;
const MIN_OI_USD = 2_000_000;
const MIN_MAX_LEVERAGE = 20;

const WEIGHTS = {
  btcCorrelation: 0.35,
  volume: 0.2,
  volatility: 0.2,
  openInterest: 0.15,
  spread: 0.1,
} as const;

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLastCompletedWeekOpens(count: number) {
  const currentWeekOpen = DateTime.fromISO(getCanonicalWeekOpenUtc(), { zone: "utc" });
  if (!currentWeekOpen.isValid) throw new Error("Failed to resolve canonical week anchor.");
  const out: string[] = [];
  for (let i = count; i >= 1; i -= 1) {
    const iso = currentWeekOpen.minus({ weeks: i }).toUTC().toISO();
    if (iso) out.push(iso);
  }
  return out;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return (await response.json()) as T;
}

function parseSymbolBase(symbol: string) {
  const upper = symbol.toUpperCase();
  if (!upper.endsWith("USDT")) return null;
  return upper.slice(0, -4);
}

async function fetchTickers(): Promise<TickerRow[]> {
  const url = `${BITGET_BASE_URL}/api/v2/mix/market/tickers?productType=${PRODUCT_TYPE}`;
  const body = await fetchJson<{ code?: string; data?: TickerRow[] }>(url);
  if (body.code && body.code !== "00000") throw new Error(`Ticker API error: ${body.code}`);
  return body.data ?? [];
}

async function fetchContracts(): Promise<ContractRow[]> {
  const url = `${BITGET_BASE_URL}/api/v2/mix/market/contracts?productType=${PRODUCT_TYPE}`;
  const body = await fetchJson<{ code?: string; data?: ContractRow[] }>(url);
  if (body.code && body.code !== "00000") throw new Error(`Contracts API error: ${body.code}`);
  return body.data ?? [];
}

async function fetchHourlyCandles(baseCoin: string, startMs: number, endMs: number): Promise<Candle[]> {
  const url = new URL(`${BITGET_BASE_URL}/api/v2/mix/market/history-candles`);
  url.searchParams.set("symbol", `${baseCoin}USDT`);
  url.searchParams.set("productType", PRODUCT_TYPE);
  url.searchParams.set("granularity", CANDLE_GRANULARITY);
  url.searchParams.set("startTime", String(startMs));
  url.searchParams.set("endTime", String(endMs));
  url.searchParams.set("limit", String(CANDLE_LIMIT));

  const body = await fetchJson<{ code?: string; data?: string[][] }>(url.toString());
  if (body.code && body.code !== "00000") throw new Error(`Candle API error ${baseCoin}: ${body.code}`);

  return (body.data ?? [])
    .map((row) => ({
      ts: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      quoteVolume: Number(row[6] ?? row[5] ?? 0),
    }))
    .filter((row) => Number.isFinite(row.ts) && Number.isFinite(row.open) && Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close))
    .sort((a, b) => a.ts - b.ts);
}

function buildReturnSeries(candles: Candle[]) {
  const out = new Map<number, number>();
  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!(prev.close > 0) || !(curr.close > 0)) continue;
    out.set(curr.ts, Math.log(curr.close / prev.close));
  }
  return out;
}

function pearsonCorrelation(xs: number[], ys: number[]) {
  if (xs.length !== ys.length || xs.length < 3) return NaN;
  const n = xs.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  if (!(denom > 0)) return NaN;
  return numerator / denom;
}

function calcCorrelationToBtc(altCandles: Candle[], btcReturnMap: Map<number, number>) {
  const altMap = buildReturnSeries(altCandles);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [ts, altRet] of altMap.entries()) {
    const btcRet = btcReturnMap.get(ts);
    if (btcRet === undefined) continue;
    xs.push(altRet);
    ys.push(btcRet);
  }
  return { correlation: pearsonCorrelation(xs, ys), samples: xs.length };
}

function calcAvgDailyVolumeUsd(candles: Candle[]) {
  const byDay = new Map<string, number>();
  for (const candle of candles) {
    const day = new Date(candle.ts).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (candle.quoteVolume || 0));
  }
  if (!byDay.size) return 0;
  const total = Array.from(byDay.values()).reduce((sum, value) => sum + value, 0);
  return total / byDay.size;
}

function calcAvgDailyVolatilityPct(candles: Candle[]) {
  const byDay = new Map<string, { high: number; low: number; close: number }>();
  for (const candle of candles) {
    const day = new Date(candle.ts).toISOString().slice(0, 10);
    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, { high: candle.high, low: candle.low, close: candle.close });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
  }
  const values = Array.from(byDay.values())
    .filter((row) => row.close > 0)
    .map((row) => ((row.high - row.low) / row.close) * 100);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minMaxNormalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (Math.abs(max - min) < 1e-12) return 1;
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized));
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function scoreAndTier(rows: PairScore[]) {
  const passing = rows.filter((row) => !row.hardFailReason);
  if (!passing.length) return rows.map((row) => ({ ...row, compositeScore: 0, tier: "REJECT" as const }));

  const corrMin = Math.min(...passing.map((row) => row.btcCorrelation7d));
  const corrMax = Math.max(...passing.map((row) => row.btcCorrelation7d));
  const volMin = Math.min(...passing.map((row) => Math.log10(Math.max(row.avgDailyVolumeUsd, 1))));
  const volMax = Math.max(...passing.map((row) => Math.log10(Math.max(row.avgDailyVolumeUsd, 1))));
  const atrMin = Math.min(...passing.map((row) => row.avgDailyVolatilityPct));
  const atrMax = Math.max(...passing.map((row) => row.avgDailyVolatilityPct));
  const oiMin = Math.min(...passing.map((row) => Math.log10(Math.max(row.openInterestUsd, 1))));
  const oiMax = Math.max(...passing.map((row) => Math.log10(Math.max(row.openInterestUsd, 1))));
  const spreadMin = Math.min(...passing.map((row) => row.spreadPct));
  const spreadMax = Math.max(...passing.map((row) => row.spreadPct));

  const scored = rows.map((row) => {
    if (row.hardFailReason) return { ...row, compositeScore: 0, tier: "REJECT" as const };
    const corrScore = minMaxNormalize(row.btcCorrelation7d, corrMin, corrMax);
    const volumeScore = minMaxNormalize(Math.log10(Math.max(row.avgDailyVolumeUsd, 1)), volMin, volMax);
    const volatilityScore = minMaxNormalize(row.avgDailyVolatilityPct, atrMin, atrMax);
    const oiScore = minMaxNormalize(Math.log10(Math.max(row.openInterestUsd, 1)), oiMin, oiMax);
    const spreadScore = 1 - minMaxNormalize(row.spreadPct, spreadMin, spreadMax);
    const compositeScore = 100 * (
      WEIGHTS.btcCorrelation * corrScore +
      WEIGHTS.volume * volumeScore +
      WEIGHTS.volatility * volatilityScore +
      WEIGHTS.openInterest * oiScore +
      WEIGHTS.spread * spreadScore
    );
    return { ...row, compositeScore };
  });

  const validScores = scored.filter((row) => !row.hardFailReason).map((row) => row.compositeScore);
  const p25 = percentile(validScores, 0.25);
  const p50 = percentile(validScores, 0.5);
  const p75 = percentile(validScores, 0.75);

  return scored.map((row) => {
    if (row.hardFailReason) return { ...row, tier: "REJECT" as const };
    if (row.compositeScore >= p75) return { ...row, tier: "A" as const };
    if (row.compositeScore >= p50) return { ...row, tier: "B" as const };
    if (row.compositeScore >= p25) return { ...row, tier: "C" as const };
    return { ...row, tier: "REJECT" as const };
  });
}

async function rankPairsForWindow(params: {
  endMs: number;
  tickers: TickerRow[];
  contractBySymbol: Map<string, ContractRow>;
}) {
  const { endMs, tickers, contractBySymbol } = params;
  const startMs = endMs - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const btcCandles = await fetchHourlyCandles("BTC", startMs, endMs);
  const btcReturnMap = buildReturnSeries(btcCandles);
  if (btcCandles.length < 100) throw new Error("Insufficient BTC candles for screener window.");

  const candidateTickers = tickers
    .map((ticker) => ({ ticker, symbol: String(ticker.symbol ?? "").toUpperCase() }))
    .filter((row) => row.symbol.endsWith("USDT") && row.symbol !== "BTCUSDT" && row.symbol !== "ETHUSDT")
    .filter((row) => {
      const contract = contractBySymbol.get(row.symbol);
      const status = String(contract?.symbolStatus ?? "").toLowerCase();
      return status === "normal";
    })
    .filter((row) => Number(row.ticker.usdtVolume ?? 0) >= MIN_DAILY_VOLUME_USD);

  const scores: PairScore[] = [];
  for (const row of candidateTickers) {
    const contract = contractBySymbol.get(row.symbol);
    const baseCoin = String(contract?.baseCoin ?? parseSymbolBase(row.symbol) ?? "").toUpperCase();
    if (!baseCoin) continue;
    try {
      const candles = await fetchHourlyCandles(baseCoin, startMs, endMs);
      await sleep(API_DELAY_MS);
      if (candles.length < 72) {
        scores.push({
          symbol: row.symbol,
          baseCoin,
          btcCorrelation7d: 0,
          avgDailyVolumeUsd: 0,
          avgDailyVolatilityPct: 0,
          openInterestUsd: 0,
          fundingRate: Number(row.ticker.fundingRate ?? 0),
          spreadPct: 0,
          maxLeverage: Number(contract?.maxLever ?? 0),
          compositeScore: 0,
          tier: "REJECT",
          hardFailReason: "insufficient_candles",
          sampleHours: candles.length,
        });
        continue;
      }

      const { correlation, samples } = calcCorrelationToBtc(candles, btcReturnMap);
      const avgDailyVolumeUsd = calcAvgDailyVolumeUsd(candles);
      const avgDailyVolatilityPct = calcAvgDailyVolatilityPct(candles);
      const bid = Number(row.ticker.bidPr ?? 0);
      const ask = Number(row.ticker.askPr ?? 0);
      const mid = (bid + ask) / 2;
      const spreadPct = mid > 0 ? ((ask - bid) / mid) * 100 : 99;
      const last = Number(row.ticker.lastPr ?? 0);
      const oiContracts = Number(row.ticker.holdingAmount ?? 0);
      const openInterestUsd = last > 0 && oiContracts > 0 ? last * oiContracts : 0;
      const maxLeverage = Number(contract?.maxLever ?? 0);
      const fundingRate = Number(row.ticker.fundingRate ?? 0);

      const hardFails: string[] = [];
      if (!Number.isFinite(correlation) || correlation < MIN_BTC_CORRELATION) hardFails.push("corr<0.50");
      if (avgDailyVolumeUsd < MIN_DAILY_VOLUME_USD) hardFails.push("vol<$5m");
      if (avgDailyVolatilityPct < MIN_ATR_PCT || avgDailyVolatilityPct > MAX_ATR_PCT) hardFails.push("atr_outside");
      if (openInterestUsd < MIN_OI_USD) hardFails.push("oi<$2m");
      if (maxLeverage < MIN_MAX_LEVERAGE) hardFails.push("maxLev<20");

      scores.push({
        symbol: row.symbol,
        baseCoin,
        btcCorrelation7d: Number.isFinite(correlation) ? correlation : 0,
        avgDailyVolumeUsd,
        avgDailyVolatilityPct,
        openInterestUsd,
        fundingRate,
        spreadPct,
        maxLeverage,
        compositeScore: 0,
        tier: "REJECT",
        hardFailReason: hardFails.length ? hardFails.join(",") : null,
        sampleHours: samples,
      });
    } catch (error) {
      scores.push({
        symbol: row.symbol,
        baseCoin,
        btcCorrelation7d: 0,
        avgDailyVolumeUsd: 0,
        avgDailyVolatilityPct: 0,
        openInterestUsd: 0,
        fundingRate: Number(row.ticker.fundingRate ?? 0),
        spreadPct: 0,
        maxLeverage: Number(contract?.maxLever ?? 0),
        compositeScore: 0,
        tier: "REJECT",
        hardFailReason: `fetch_error:${String(error).slice(0, 80)}`,
        sampleHours: 0,
      });
      await sleep(API_DELAY_MS);
    }
  }

  const scored = scoreAndTier(scores)
    .map((row) => ({
      ...row,
      compositeScore: round(row.compositeScore, 4),
      btcCorrelation7d: round(row.btcCorrelation7d, 6),
      avgDailyVolumeUsd: round(row.avgDailyVolumeUsd, 2),
      avgDailyVolatilityPct: round(row.avgDailyVolatilityPct, 4),
      openInterestUsd: round(row.openInterestUsd, 2),
      fundingRate: round(row.fundingRate, 8),
      spreadPct: round(row.spreadPct, 6),
    }))
    .sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
      return a.symbol.localeCompare(b.symbol);
    });

  const recommendedSymbols = scored
    .filter((row) => row.tier === "A" || row.tier === "B")
    .map((row) => row.baseCoin);

  return { startMs, endMs, scored, recommendedSymbols };
}

function buildMarkdown(
  rows: PairScore[],
  recommendedSymbols: string[],
  generatedUtc: string,
  weeklyRecommendations: WeeklyRecommendation[],
) {
  const lines: string[] = [];
  lines.push("# Alt Pair Rankings (Bitget USDT-FUTURES)", "");
  lines.push(`Generated (UTC): ${generatedUtc}`);
  lines.push(`Lookback: ${LOOKBACK_DAYS} days (hourly candles)`, "");
  lines.push(`Recommended ALT_SYMBOLS (Tier A+B): ${JSON.stringify(recommendedSymbols)}`, "");
  lines.push("| Rank | Symbol | Base | Tier | Score | Corr7d | Avg Daily Vol USD | Avg Daily ATR% | OI USD | Spread% | Max Lev | Funding | Samples | Hard Fail |");
  lines.push("| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");

  rows.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${row.symbol} | ${row.baseCoin} | ${row.tier} | ${row.compositeScore.toFixed(2)} | ${row.btcCorrelation7d.toFixed(3)} | ${row.avgDailyVolumeUsd.toFixed(0)} | ${row.avgDailyVolatilityPct.toFixed(2)} | ${row.openInterestUsd.toFixed(0)} | ${row.spreadPct.toFixed(4)} | ${row.maxLeverage.toFixed(0)} | ${row.fundingRate.toFixed(6)} | ${row.sampleHours} | ${row.hardFailReason ?? ""} |`,
    );
  });

  lines.push("", "## Weekly Recommendations (Week-Anchored)", "");
  lines.push("| Week Open UTC | Lookback Start UTC | Lookback End UTC | Pair Count | Recommended ALT_SYMBOLS (Tier A+B) |");
  lines.push("| --- | --- | --- | ---: | --- |");
  for (const row of weeklyRecommendations) {
    lines.push(`| ${row.weekOpenUtc} | ${row.lookbackStartUtc} | ${row.lookbackEndUtc} | ${row.pairCount} | ${row.recommendedSymbols.join(", ")} |`);
  }

  return lines.join("\n");
}

async function main() {
  const generatedUtc = new Date().toISOString();
  const [tickers, contracts] = await Promise.all([fetchTickers(), fetchContracts()]);
  const contractBySymbol = new Map(
    contracts
      .filter((row) => row.symbol)
      .map((row) => [String(row.symbol).toUpperCase(), row]),
  );

  const currentWindow = await rankPairsForWindow({
    endMs: Date.now(),
    tickers,
    contractBySymbol,
  });
  const scored = currentWindow.scored;
  const recommendedSymbols = currentWindow.recommendedSymbols;

  const weeklyRecommendations: WeeklyRecommendation[] = [];
  const weekOpens = getLastCompletedWeekOpens(WEEKLY_SNAPSHOT_COUNT);
  for (const weekOpenUtc of weekOpens) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    if (!weekOpen.isValid) continue;
    const weekWindow = await rankPairsForWindow({
      endMs: weekOpen.toMillis(),
      tickers,
      contractBySymbol,
    });
    weeklyRecommendations.push({
      weekOpenUtc,
      lookbackStartUtc: new Date(weekWindow.startMs).toISOString(),
      lookbackEndUtc: new Date(weekWindow.endMs).toISOString(),
      recommendedSymbols: weekWindow.recommendedSymbols,
      pairCount: weekWindow.scored.length,
    });
  }

  const outDir = path.join(process.cwd(), "docs", "bots");
  mkdirSync(outDir, { recursive: true });

  const outputJson = {
    generatedUtc,
    lookbackDays: LOOKBACK_DAYS,
    currentLookback: {
      startUtc: new Date(currentWindow.startMs).toISOString(),
      endUtc: new Date(currentWindow.endMs).toISOString(),
    },
    weights: WEIGHTS,
    hardMinimums: {
      minBtcCorrelation: MIN_BTC_CORRELATION,
      minDailyVolumeUsd: MIN_DAILY_VOLUME_USD,
      minAtrPct: MIN_ATR_PCT,
      maxAtrPct: MAX_ATR_PCT,
      minOiUsd: MIN_OI_USD,
      minMaxLeverage: MIN_MAX_LEVERAGE,
    },
    recommendedSymbols,
    weeklyRecommendations,
    pairScores: scored,
  };

  writeFileSync(path.join(outDir, "alt-pair-rankings.json"), JSON.stringify(outputJson, null, 2), "utf8");
  writeFileSync(
    path.join(outDir, "alt-pair-rankings.md"),
    buildMarkdown(scored, recommendedSymbols, generatedUtc, weeklyRecommendations),
    "utf8",
  );

  console.table(
    scored.slice(0, 25).map((row) => ({
      symbol: row.symbol,
      tier: row.tier,
      score: round(row.compositeScore, 2),
      corr: round(row.btcCorrelation7d, 3),
      volUsd: Math.round(row.avgDailyVolumeUsd),
      atrPct: round(row.avgDailyVolatilityPct, 2),
      oiUsd: Math.round(row.openInterestUsd),
      spreadPct: round(row.spreadPct, 4),
      maxLev: row.maxLeverage,
    })),
  );
  console.log(`Recommended ALT_SYMBOLS for backtest: ${JSON.stringify(recommendedSymbols)}`);
}

main().catch((error) => {
  console.error("alt-pair-screener failed:", error);
  process.exitCode = 1;
});
