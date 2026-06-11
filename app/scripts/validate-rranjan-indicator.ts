/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/validate-rranjan-indicator.ts
 *
 * Description:
 * Outputs side-by-side indicator values for two competing interpretations of
 * RRanjanFX's "Stoch+RSI With Color Combination" so they can be checked
 * against TradingView on exact candles:
 * 1. Current backtest model: Stoch RSI (21,13,3,3)
 * 2. Candidate model from Claude's review: Slow Stochastic D on price
 *    with period 21, K smoothing 3, D smoothing 13, plus RSI(3)
 *
 * Run:
 *   npx tsx scripts/validate-rranjan-indicator.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getOandaInstrument } from "../src/lib/oandaPrices";

loadEnvConfig(process.cwd());

type Timeframe = "H4" | "H1" | "M15" | "M5";

type OhlcCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ValidationCase = {
  symbol: string;
  timeframe: Timeframe;
  bars: number;
};

type ValidationRow = {
  timeUtc: string;
  open: number;
  high: number;
  low: number;
  close: number;
  currentModelStochRsiK: number | null;
  currentModelStochRsiD: number | null;
  candidateSlowStochK: number | null;
  candidateSlowStochD: number | null;
  candidateRsi3: number | null;
};

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";
const REPORTS_DIR = path.join(process.cwd(), "app", "reports");

const DEFAULT_CASES: ValidationCase[] = [
  { symbol: "EURUSD", timeframe: "H4", bars: 12 },
  { symbol: "BTCUSD", timeframe: "H1", bars: 12 },
  { symbol: "SPXUSD", timeframe: "H1", bars: 12 },
];

function getOandaBaseUrl() {
  return process.env.OANDA_ENV === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
}

function getOandaAuthHeaders() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OANDA_API_KEY is not configured.");
  }
  return { Authorization: `Bearer ${apiKey}` };
}

function timeframeMinutes(timeframe: Timeframe) {
  switch (timeframe) {
    case "H4":
      return 240;
    case "H1":
      return 60;
    case "M15":
      return 15;
    case "M5":
      return 5;
  }
}

function round(value: number | null, digits = 4) {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

async function fetchOhlcSeries(symbol: string, timeframe: Timeframe, barsNeeded: number): Promise<OhlcCandle[]> {
  const instrument = getOandaInstrument(symbol);
  const granularity = timeframe;
  const lookbackBars = Math.max(300, barsNeeded * 12);
  const now = DateTime.utc().startOf("minute");
  const fromUtc = now.minus({ minutes: lookbackBars * timeframeMinutes(timeframe) });
  const url = new URL(`${getOandaBaseUrl()}/v3/instruments/${instrument}/candles`);
  url.searchParams.set("price", "M");
  url.searchParams.set("granularity", granularity);
  url.searchParams.set("from", fromUtc.toISO() ?? "");
  url.searchParams.set("to", now.toISO() ?? "");

  const response = await fetch(url.toString(), { headers: getOandaAuthHeaders() });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OANDA ${instrument} ${granularity} fetch failed [${response.status}]: ${body}`);
  }

  const data = (await response.json()) as {
    candles?: Array<{
      time: string;
      complete: boolean;
      mid?: { o?: string; h?: string; l?: string; c?: string };
    }>;
  };

  return (data.candles ?? [])
    .filter((row) => row.complete && row.mid)
    .map((row) => ({
      ts: DateTime.fromISO(row.time, { zone: "utc" }).toMillis(),
      open: Number(row.mid?.o ?? NaN),
      high: Number(row.mid?.h ?? NaN),
      low: Number(row.mid?.l ?? NaN),
      close: Number(row.mid?.c ?? NaN),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.ts) &&
        Number.isFinite(row.open) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.close),
    )
    .slice(-barsNeeded);
}

function computeRsi(closes: number[], length: number) {
  const out: Array<number | null> = Array.from({ length: closes.length }, () => null);
  if (closes.length <= length) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= length; i += 1) {
    const change = closes[i] - closes[i - 1];
    gainSum += Math.max(change, 0);
    lossSum += Math.max(-change, 0);
  }

  let avgGain = gainSum / length;
  let avgLoss = lossSum / length;
  out[length] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = length + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = ((avgGain * (length - 1)) + gain) / length;
    avgLoss = ((avgLoss * (length - 1)) + loss) / length;
    out[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  return out;
}

function computeSma(values: Array<number | null>, length: number) {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i += 1) {
    const current = values[i];
    if (current !== null) {
      sum += current;
      count += 1;
    }
    const remove = i >= length ? values[i - length] : null;
    if (remove !== null) {
      sum -= remove;
      count -= 1;
    }
    if (i >= length - 1 && count === length) {
      out[i] = sum / length;
    }
  }

  return out;
}

function computeCurrentModel(candles: OhlcCandle[]) {
  const closes = candles.map((candle) => candle.close);
  const rsi = computeRsi(closes, 21);
  const stochRaw: Array<number | null> = Array.from({ length: candles.length }, () => null);

  for (let i = 0; i < rsi.length; i += 1) {
    if (rsi[i] === null || i < 12) continue;
    const window = rsi.slice(i - 12, i + 1).filter((value): value is number => value !== null);
    if (window.length !== 13) continue;
    const min = Math.min(...window);
    const max = Math.max(...window);
    const range = max - min;
    stochRaw[i] = range === 0 ? 0 : (((rsi[i] ?? 0) - min) / range) * 100;
  }

  const k = computeSma(stochRaw, 3);
  const d = computeSma(k, 3);
  return { k, d };
}

function computeCandidateSlowStochPlusRsi(candles: OhlcCandle[]) {
  const rawK: Array<number | null> = Array.from({ length: candles.length }, () => null);
  for (let i = 0; i < candles.length; i += 1) {
    if (i < 20) continue;
    const window = candles.slice(i - 20, i + 1);
    const lowestLow = Math.min(...window.map((candle) => candle.low));
    const highestHigh = Math.max(...window.map((candle) => candle.high));
    const range = highestHigh - lowestLow;
    rawK[i] = range === 0 ? 0 : ((candles[i].close - lowestLow) / range) * 100;
  }
  const slowK = computeSma(rawK, 3);
  const slowD = computeSma(slowK, 13);
  const rsi3 = computeRsi(candles.map((candle) => candle.close), 3);
  return { slowK, slowD, rsi3 };
}

async function main() {
  const cases = DEFAULT_CASES;
  const result = {
    generatedUtc: DateTime.utc().toISO(),
    note:
      "Compare TradingView RRanjanFX values against both model columns. If Claude's hypothesis is right, orange should match candidateSlowStochD and green should match candidateRsi3.",
    cases: [] as Array<{
      symbol: string;
      timeframe: Timeframe;
      rows: ValidationRow[];
    }>,
  };

  for (const validationCase of cases) {
    const candles = await fetchOhlcSeries(validationCase.symbol, validationCase.timeframe, validationCase.bars + 80);
    const current = computeCurrentModel(candles);
    const candidate = computeCandidateSlowStochPlusRsi(candles);
    const rows = candles.slice(-validationCase.bars).map((candle, indexFromTail) => {
      const absoluteIndex = candles.length - validationCase.bars + indexFromTail;
      return {
        timeUtc: DateTime.fromMillis(candle.ts, { zone: "utc" }).toISO() ?? "",
        open: Number(candle.open.toFixed(5)),
        high: Number(candle.high.toFixed(5)),
        low: Number(candle.low.toFixed(5)),
        close: Number(candle.close.toFixed(5)),
        currentModelStochRsiK: round(current.k[absoluteIndex]),
        currentModelStochRsiD: round(current.d[absoluteIndex]),
        candidateSlowStochK: round(candidate.slowK[absoluteIndex]),
        candidateSlowStochD: round(candidate.slowD[absoluteIndex]),
        candidateRsi3: round(candidate.rsi3[absoluteIndex]),
      };
    });

    result.cases.push({
      symbol: validationCase.symbol,
      timeframe: validationCase.timeframe,
      rows,
    });
  }

  mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = DateTime.utc().toFormat("yyyyMMdd-HHmmss");
  const reportPath = path.join(REPORTS_DIR, `validate-rranjan-indicator-${timestamp}.json`);
  const latestPath = path.join(REPORTS_DIR, "validate-rranjan-indicator-latest.json");
  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  writeFileSync(latestPath, JSON.stringify(result, null, 2));

  console.log(`RRanjan indicator validation report written.`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
