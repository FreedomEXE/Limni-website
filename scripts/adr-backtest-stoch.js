/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * ADR Backtest — Stochastic confirmation filter
 *
 * Logic: ADR entry qualifies the zone, then wait for stoch K to confirm:
 *   SHORT: wait for stoch K to cross ABOVE 80 (overbought = bounce exhausted)
 *   LONG:  wait for stoch K to cross BELOW 20 (oversold = dip exhausted)
 *
 * Settings (Freedom's custom RRanjanFX):
 *   K=100, D=21, Smooth=3, RSI Length=3
 *   Overbought=80, Oversold=20
 *
 * Usage: node scripts/adr-backtest-stoch.js
 */

const { readFileSync } = require("node:fs");
const path = require("node:path");
try {
  const envContent = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const KEY = process.env.OANDA_API_KEY;
const BASE = "https://api-fxtrade.oanda.com";

// Stoch settings
const STOCH_K = 100;
const STOCH_SMOOTH = 3;
const STOCH_D = 21;
const OB_LEVEL = 80; // overbought
const OS_LEVEL = 20; // oversold

/* ---- Stochastic calculation (matches Pine: sma(stoch(close,high,low,K), Smooth)) ---- */
function computeStochK(bars) {
  // bars = [{high, low, close}, ...]
  // Raw stoch
  const rawStoch = new Array(bars.length).fill(null);
  for (let i = STOCH_K - 1; i < bars.length; i++) {
    let lowestLow = Infinity, highestHigh = -Infinity;
    for (let j = i - STOCH_K + 1; j <= i; j++) {
      lowestLow = Math.min(lowestLow, bars[j].low);
      highestHigh = Math.max(highestHigh, bars[j].high);
    }
    const range = highestHigh - lowestLow;
    rawStoch[i] = range === 0 ? 0 : 100 * (bars[i].close - lowestLow) / range;
  }

  // SMA smooth (K line = lK in Pine)
  const kLine = sma(rawStoch, STOCH_SMOOTH);
  return kLine;
}

function sma(values, length) {
  const out = new Array(values.length).fill(null);
  let sum = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) { sum += values[i]; count++; }
    if (i >= length && values[i - length] !== null) { sum -= values[i - length]; count--; }
    if (i >= length - 1 && count === length) out[i] = sum / length;
  }
  return out;
}

/* ---- Oanda fetch ---- */
async function fetchAllM5(inst, fromUtc) {
  const bars = [];
  let cursor = fromUtc;
  for (let page = 0; page < 20; page++) {
    const r = await fetch(`${BASE}/v3/instruments/${inst}/candles?price=M&granularity=M5&from=${cursor}&count=500`, { headers: { Authorization: "Bearer " + KEY } });
    const d = await r.json();
    const b = (d.candles || []).filter(c => c.complete && c.mid);
    if (!b.length) break;
    for (const c of b) bars.push({ ts: new Date(c.time).getTime(), high: +c.mid.h, low: +c.mid.l, close: +c.mid.c });
    cursor = new Date(new Date(b[b.length - 1].time).getTime() + 1000).toISOString();
    if (b.length < 500) break;
    await new Promise(r => setTimeout(r, 80));
  }
  return bars;
}

async function fetchDailyAdr(inst, beforeUtc, alignment) {
  const from = new Date(new Date(beforeUtc).getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const r = await fetch(`${BASE}/v3/instruments/${inst}/candles?price=M&granularity=D&from=${from}&count=500&dailyAlignment=${alignment}&alignmentTimezone=America%2FNew_York`, { headers: { Authorization: "Bearer " + KEY } });
  const d = await r.json();
  const bars = (d.candles || []).filter(c => c.complete && c.mid && new Date(c.time) < new Date(beforeUtc));
  const skip1 = bars.slice(0, -1);
  const last10 = skip1.slice(-10);
  if (last10.length < 5) return null;
  return last10.reduce((s, c) => (+c.mid.h) - (+c.mid.l) + s, 0) / last10.length;
}

/* ---- Scanners ---- */

// Baseline: static TP, no stoch filter
function scanBaseline(bars, weekStartIdx, dir, rawAdr) {
  let a = null, it = false, n = 0, tp = 0, ep = 0, entryTs = 0;
  const trades = [];
  for (let i = weekStartIdx; i < bars.length; i++) {
    const b = bars[i];
    if (it) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        trades.push({ ep, tp, exit: tp, exitType: "TP_HIT", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100, entryTs });
        it = false; a = dir === "LONG" ? b.high : b.low; continue;
      }
      continue;
    }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    const t = dir === "LONG" ? e + rawAdr * 0.25 : e - rawAdr * 0.25;
    if (dir === "LONG" ? b.low <= e : b.high >= e) {
      ep = e; tp = t; entryTs = b.ts; it = true; n++;
      a = dir === "LONG" ? b.high : b.low; // anchor seed fix included in entry
    }
  }
  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ ep, tp, exit: lc, exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100, entryTs });
  }
  return trades;
}

// Stoch-filtered: ADR qualifies zone, wait for stoch confirmation to enter
function scanWithStoch(bars, weekStartIdx, dir, rawAdr, stochK) {
  let a = null, it = false, n = 0, tp = 0, ep = 0, entryTs = 0;
  let adrQualified = false; // ADR zone has been reached
  let qualifiedEntry = 0;   // the entry price when ADR qualified
  let qualifiedTp = 0;
  const trades = [];

  for (let i = weekStartIdx; i < bars.length; i++) {
    const b = bars[i];
    const sk = stochK[i]; // may be null for warmup bars

    if (it) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        trades.push({ ep, tp, exit: tp, exitType: "TP_HIT", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100, entryTs });
        it = false;
        adrQualified = false;
        a = dir === "LONG" ? b.high : b.low;
        continue;
      }
      continue;
    }

    // Tracking phase
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    const t = dir === "LONG" ? e + rawAdr * 0.25 : e - rawAdr * 0.25;

    // Check if ADR zone is reached
    if (!adrQualified && (dir === "LONG" ? b.low <= e : b.high >= e)) {
      adrQualified = true;
      qualifiedEntry = e;
      qualifiedTp = t;
    }

    // If ADR qualified, wait for stoch confirmation
    if (adrQualified && !it && sk !== null) {
      const stochConfirm = dir === "SHORT" ? sk >= OB_LEVEL : sk <= OS_LEVEL;
      if (stochConfirm) {
        // Enter at CURRENT price (not the old ADR level — price has moved)
        ep = dir === "LONG" ? b.low : b.high; // approximate: enter at bar's extreme in our direction
        // TP from current entry (static 0.25 ADR from entry)
        tp = dir === "LONG" ? ep + rawAdr * 0.25 : ep - rawAdr * 0.25;
        entryTs = b.ts;
        it = true;
        n++;
        adrQualified = false;
        a = dir === "LONG" ? b.high : b.low;
      }
    }

    // If anchor moves past qualified level, re-qualify
    if (adrQualified) {
      const newE = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
      qualifiedEntry = newE;
      qualifiedTp = dir === "LONG" ? newE + rawAdr * 0.25 : newE - rawAdr * 0.25;
    }
  }

  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ ep, tp, exit: lc, exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100, entryTs });
  }
  return trades;
}

/* ---- Signals & mapping ---- */
async function getSignals(weekOpenUtc) {
  const r = await pool.query(
    `SELECT symbol, direction, (array_agg(metadata::text))[1] m
     FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc = $1
     GROUP BY symbol, direction`, [weekOpenUtc]);
  return r.rows.map(x => {
    const md = JSON.parse(x.m);
    return { pair: x.symbol, direction: x.direction, assetClass: md.assetClass || "fx" };
  });
}

const OANDA_MAP = {
  AUDJPY: "AUD_JPY", AUDNZD: "AUD_NZD", AUDUSD: "AUD_USD", CADCHF: "CAD_CHF",
  CADJPY: "CAD_JPY", CHFJPY: "CHF_JPY", EURAUD: "EUR_AUD", EURCHF: "EUR_CHF",
  EURJPY: "EUR_JPY", EURNZD: "EUR_NZD", EURUSD: "EUR_USD", EURCAD: "EUR_CAD",
  GBPAUD: "GBP_AUD", GBPCAD: "GBP_CAD", GBPCHF: "GBP_CHF", GBPJPY: "GBP_JPY",
  GBPNZD: "GBP_NZD", GBPUSD: "GBP_USD", NZDCAD: "NZD_CAD", NZDCHF: "NZD_CHF",
  NZDJPY: "NZD_JPY", NZDUSD: "NZD_USD", USDCHF: "USD_CHF", USDJPY: "USD_JPY",
  XAUUSD: "XAU_USD", NIKKEIUSD: "JP225_USD", NDXUSD: "NAS100_USD", SPXUSD: "SPX500_USD",
  BTCUSD: "BTC_USD", ETHUSD: "ETH_USD",
};

/* ---- Main ---- */
async function main() {
  const weeks = await pool.query(
    `SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`
  );

  // Need extra bars before week start for stoch warmup (K=100 needs ~100 M5 bars = ~8 hours)
  const WARMUP_HOURS = 12; // 12 hours of M5 = 144 bars, plenty for K=100+Smooth

  let base = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };
  let stoch = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0, skipped: 0 };
  const weekResults = [];

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const signals = await getSignals(weekOpenUtc);
    let weekBase = 0, weekStoch = 0;

    for (const signal of signals) {
      const inst = OANDA_MAP[signal.pair];
      if (!inst) continue;
      const isFx = signal.assetClass === "fx";
      const weekStart = new Date(new Date(weekOpenUtc).getTime() - (isFx ? 2 : 1) * 3600000).toISOString();
      const warmupStart = new Date(new Date(weekStart).getTime() - WARMUP_HOURS * 3600000).toISOString();
      const weekCloseMs = new Date(weekStart).getTime() + 5 * 24 * 3600000;

      const adr = await fetchDailyAdr(inst, weekStart, isFx ? 17 : 18);
      if (!adr) continue;

      const allBars = await fetchAllM5(inst, warmupStart);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (bars.length === 0) continue;

      // Find the index where the week actually starts
      const weekStartMs = new Date(weekStart).getTime();
      const weekStartIdx = bars.findIndex(b => b.ts >= weekStartMs);
      if (weekStartIdx < 0) continue;

      // Compute stoch K on ALL bars (including warmup)
      const stochK = computeStochK(bars);

      // Baseline (no stoch)
      const baseTrades = scanBaseline(bars, weekStartIdx, signal.direction, adr);
      for (const t of baseTrades) {
        base.trades++;
        if (t.exitType === "TP_HIT") { base.tp++; base.tpPnl += t.pnl; }
        else { base.wc++; base.wcPnl += t.pnl; }
        weekBase += t.pnl;
      }

      // Stoch filtered
      const stochTrades = scanWithStoch(bars, weekStartIdx, signal.direction, adr, stochK);
      for (const t of stochTrades) {
        stoch.trades++;
        if (t.exitType === "TP_HIT") { stoch.tp++; stoch.tpPnl += t.pnl; }
        else { stoch.wc++; stoch.wcPnl += t.pnl; }
        weekStoch += t.pnl;
      }

      if (baseTrades.length > 0 && stochTrades.length === 0) stoch.skipped++;

      await new Promise(r => setTimeout(r, 150));
    }

    const label = new Date(new Date(weekOpenUtc).getTime() + 86400000).toISOString().slice(5, 10);
    weekResults.push({ label, base: weekBase, stoch: weekStoch });
    process.stdout.write(".");
  }

  console.log("\n\n=== STOCHASTIC CONFIRMATION BACKTEST ===");
  console.log("Stoch settings: K=" + STOCH_K + " D=" + STOCH_D + " Smooth=" + STOCH_SMOOTH);
  console.log("OB=" + OB_LEVEL + " OS=" + OS_LEVEL);
  console.log("Entry: ADR qualifies zone, wait for stoch K to cross OB/OS, enter at current price\n");

  console.log("Week".padEnd(10), "Baseline".padEnd(12), "Stoch");
  console.log("-".repeat(35));
  for (const w of weekResults) {
    console.log(w.label.padEnd(10), ((w.base > 0 ? "+" : "") + w.base.toFixed(2) + "%").padEnd(12), (w.stoch > 0 ? "+" : "") + w.stoch.toFixed(2) + "%");
  }

  console.log("\n=== SUMMARY ===\n");
  console.log("".padEnd(15), "Baseline".padEnd(15), "Stoch Filter");
  console.log("-".repeat(45));
  console.log("Trades".padEnd(15), String(base.trades).padEnd(15), stoch.trades);
  console.log("TP Hits".padEnd(15), String(base.tp).padEnd(15), stoch.tp);
  console.log("Week Close".padEnd(15), String(base.wc).padEnd(15), stoch.wc);
  console.log("TP Profit".padEnd(15), ("+" + base.tpPnl.toFixed(2) + "%").padEnd(15), "+" + stoch.tpPnl.toFixed(2) + "%");
  console.log("WC Loss".padEnd(15), (base.wcPnl.toFixed(2) + "%").padEnd(15), stoch.wcPnl.toFixed(2) + "%");
  const baseNet = base.tpPnl + base.wcPnl;
  const stochNet = stoch.tpPnl + stoch.wcPnl;
  console.log("Net".padEnd(15), ((baseNet > 0 ? "+" : "") + baseNet.toFixed(2) + "%").padEnd(15), (stochNet > 0 ? "+" : "") + stochNet.toFixed(2) + "%");
  console.log("Win Rate".padEnd(15), ((base.tp / base.trades * 100).toFixed(1) + "%").padEnd(15), (stoch.tp / stoch.trades * 100).toFixed(1) + "%");
  console.log("Skipped".padEnd(15), "0".padEnd(15), stoch.skipped + " pair-weeks");

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
