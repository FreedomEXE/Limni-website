/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/validate-stoch-rsi.ts
 *
 * Description:
 * Validates the CORRECT rranjan fx "Stoch+RSI" indicator implementation
 * against TradingView. The indicator is TWO separate signals:
 *
 *   1. Slow Stochastic of PRICE (close, high, low):
 *      - Raw stoch = 100 * (close - lowest(low, K)) / (highest(high, K) - lowest(low, K))
 *      - K line (lK) = SMA(rawStoch, Smooth)
 *      - D line (bnd) = SMA(K, D)
 *
 *   2. RSI of close:
 *      - RMA-based (Wilder's smoothing) with given length
 *
 * Freedom's settings: K=21, D=13, Smooth=3, RSI Length=3
 *
 * Run:
 *   npx tsx scripts/validate-stoch-rsi.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { getOandaInstrument } from "../src/lib/oandaPrices";

loadEnvConfig(process.cwd());

// ── rranjan fx settings (Freedom's custom) ─────────────────────────
const STOCH_K_PERIOD = 21;   // Pine: odk = input(21, title="K")
const STOCH_D_SMOOTH = 13;   // Pine: dP  = input(13, title="D")
const STOCH_K_SMOOTH = 3;    // Pine: sK  = input(3, title="Smooth")
const RSI_LENGTH = 3;        // Pine: rrfxlen = input(3, title="Length")

// ── Test instruments ───────────────────────────────────────────────
const TEST_INSTRUMENTS = ["EURUSD", "AUDJPY", "XAUUSD"];
const TIMEFRAMES = [
  { id: "H4", granularity: "H4", minutes: 240 },
  { id: "H1", granularity: "H1", minutes: 60 },
  { id: "M15", granularity: "M15", minutes: 15 },
] as const;

const TAIL_COUNT = 15;

// ── OANDA helpers ──────────────────────────────────────────────────
const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

function getOandaBaseUrl() {
  return process.env.OANDA_ENV === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
}

function getOandaAuthHeaders() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) throw new Error("OANDA_API_KEY is not configured.");
  return { Authorization: `Bearer ${apiKey}` };
}

type OhlcCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

async function fetchCandles(
  symbol: string,
  granularity: string,
  count: number,
): Promise<OhlcCandle[]> {
  const instrument = getOandaInstrument(symbol);
  const url = new URL(`${getOandaBaseUrl()}/v3/instruments/${instrument}/candles`);
  url.searchParams.set("price", "M");
  url.searchParams.set("granularity", granularity);
  url.searchParams.set("count", String(count));

  const response = await fetch(url.toString(), { headers: getOandaAuthHeaders() });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OANDA ${instrument} ${granularity} [${response.status}] ${body}`);
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
    .sort((a, b) => a.ts - b.ts);
}

// ═══════════════════════════════════════════════════════════════════
// CORRECT rranjan fx indicator — TWO separate signals
// ═══════════════════════════════════════════════════════════════════

/**
 * Standard Stochastic of PRICE (not RSI).
 * Pine: stoch(close, high, low, length) = 100 * (close - lowest(low, length)) / (highest(high, length) - lowest(low, length))
 */
function computeRawStochastic(candles: OhlcCandle[], period: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: candles.length }, () => null);

  for (let i = period - 1; i < candles.length; i++) {
    let lowestLow = Infinity;
    let highestHigh = -Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      lowestLow = Math.min(lowestLow, candles[j].low);
      highestHigh = Math.max(highestHigh, candles[j].high);
    }
    const range = highestHigh - lowestLow;
    out[i] = range === 0 ? 0 : 100 * (candles[i].close - lowestLow) / range;
  }

  return out;
}

/**
 * Simple Moving Average over nullable array.
 * Only emits when all `length` values in the window are non-null.
 */
function computeSma(values: Array<number | null>, length: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i++) {
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

/**
 * RSI using RMA (Wilder's smoothing) — matches Pine's rma() function.
 * Pine: rma(x, length) = (prev * (length - 1) + x) / length
 *
 * This is identical to Wilder's smoothing: alpha = 1/length
 */
function computeRsi(closes: number[], length: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: closes.length }, () => null);
  if (closes.length <= length) return out;

  // Seed with SMA of first `length` changes (Pine rma seeds the same way)
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= length; i++) {
    const change = closes[i] - closes[i - 1];
    gainSum += Math.max(change, 0);
    lossSum += Math.max(-change, 0);
  }

  let avgGain = gainSum / length;
  let avgLoss = lossSum / length;
  out[length] = avgLoss === 0 ? 100 : avgGain === 0 ? 0 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder's smoothing: rma = (prev * (length - 1) + current) / length
  for (let i = length + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (length - 1) + Math.max(change, 0)) / length;
    avgLoss = (avgLoss * (length - 1) + Math.max(-change, 0)) / length;
    out[i] = avgLoss === 0 ? 100 : avgGain === 0 ? 0 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

/**
 * Full rranjan fx indicator computation.
 * Returns:
 *   stochK — SMA(rawStoch, smooth)           [the "lK" in Pine, NOT plotted]
 *   stochD — SMA(stochK, dPeriod)            [the "%D" orange line, plotted]
 *   rsi    — Wilder's RSI(close, rsiLength)  [the "RSI" green line, plotted]
 */
function computeRranjanFx(candles: OhlcCandle[]) {
  // 1. Stochastic of price
  const rawStoch = computeRawStochastic(candles, STOCH_K_PERIOD);
  const stochK = computeSma(rawStoch, STOCH_K_SMOOTH);
  const stochD = computeSma(stochK, STOCH_D_SMOOTH);

  // 2. RSI
  const closes = candles.map((c) => c.close);
  const rsi = computeRsi(closes, RSI_LENGTH);

  return { rawStoch, stochK, stochD, rsi };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  rranjan fx 'Stoch+RSI' Validation (CORRECTED)");
  console.log("  Stochastic: K=%d, D=%d, Smooth=%d  (of price OHLC)", STOCH_K_PERIOD, STOCH_D_SMOOTH, STOCH_K_SMOOTH);
  console.log("  RSI: Length=%d (Wilder's/RMA, applied to close)", RSI_LENGTH);
  console.log("  Bands: 20/30 oversold zone, 70/80 overbought zone");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // Warmup: stoch needs K_PERIOD(21), then SMA(3), then SMA(13) = ~37 bars
  // RSI needs 3+1 = 4 bars. Fetch 120 to be safe.
  const fetchCount = 120;

  for (const symbol of TEST_INSTRUMENTS) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`  ${symbol}`);
    console.log(`${"─".repeat(70)}`);

    for (const tf of TIMEFRAMES) {
      try {
        const candles = await fetchCandles(symbol, tf.granularity, fetchCount);
        const { stochK, stochD, rsi } = computeRranjanFx(candles);

        console.log(`\n  [${tf.id}] — ${candles.length} candles, last ${TAIL_COUNT}:\n`);
        const header = [
          "  " + "#".padStart(3),
          "Time (UTC)".padEnd(18),
          "Close".padStart(10),
          "StochK".padStart(8),
          "StochD".padStart(8),
          "RSI(3)".padStart(8),
        ].join("  ");
        console.log(header);
        console.log("  " + "─".repeat(72));

        const startIdx = Math.max(0, candles.length - TAIL_COUNT);
        for (let i = startIdx; i < candles.length; i++) {
          const candle = candles[i];
          const dt = DateTime.fromMillis(candle.ts, { zone: "utc" });
          const timeStr = dt.toFormat("yyyy-MM-dd HH:mm");
          const decimals = symbol === "XAUUSD" ? 2 : 5;
          const closeVal = candle.close.toFixed(decimals);
          const kVal = stochK[i] !== null ? (stochK[i] as number).toFixed(2) : "---";
          const dVal = stochD[i] !== null ? (stochD[i] as number).toFixed(2) : "---";
          const rsiVal = rsi[i] !== null ? (rsi[i] as number).toFixed(2) : "---";

          // Zone flags — check both stochD (plotted) and RSI
          const flags: string[] = [];
          if (stochD[i] !== null) {
            if ((stochD[i] as number) <= 20) flags.push("D<20");
            else if ((stochD[i] as number) >= 80) flags.push("D>80");
          }
          if (rsi[i] !== null) {
            if ((rsi[i] as number) <= 20) flags.push("RSI<20");
            else if ((rsi[i] as number) >= 80) flags.push("RSI>80");
          }
          const flagStr = flags.length > 0 ? "  << " + flags.join(" + ") : "";

          const row = [
            "  " + String(i).padStart(3),
            timeStr.padEnd(18),
            closeVal.padStart(10),
            kVal.padStart(8),
            dVal.padStart(8),
            rsiVal.padStart(8),
          ].join("  ");
          console.log(row + flagStr);
        }
      } catch (err) {
        console.error(`  [${tf.id}] ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  VALIDATION INSTRUCTIONS:");
  console.log("  1. Open TradingView → select each instrument + timeframe");
  console.log("  2. Add indicator: 'Stoch+RSI With Color Combination' by RRanjanFX");
  console.log("  3. Settings: K=21, D=13, Smooth=3, Length=3");
  console.log("  4. The ORANGE line on TV = StochD column above");
  console.log("  5. The GREEN line on TV  = RSI(3) column above");
  console.log("  6. StochK is NOT plotted on TV (intermediate calc only)");
  console.log("  7. Values should match within ±0.5 (data source differences)");
  console.log("═══════════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
