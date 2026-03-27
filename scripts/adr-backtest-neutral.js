/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * ADR Backtest — Neutral (both directions, no bias filter)
 *
 * Tests whether ADR mean-reversion works WITHOUT any directional signal.
 * Runs BOTH long AND short on every pair. Whichever direction triggers first
 * from the running anchor takes the trade. Fresh Start after TP.
 *
 * Usage: node scripts/adr-backtest-neutral.js
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

async function fetchAllM5(inst, fromUtc) {
  const bars = [];
  let cursor = fromUtc;
  for (let page = 0; page < 15; page++) {
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

// Single-direction scanner (same as corrected baseline)
function scanDir(bars, dir, rawAdr) {
  let a = null, it = false, tp = 0, ep = 0, entryTs = 0;
  const trades = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (it) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        trades.push({ dir, ep, tp, exit: tp, exitType: "TP_HIT", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100 });
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
      ep = e; tp = t; entryTs = b.ts; it = true;
    }
  }
  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ dir, ep, tp, exit: lc, exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 });
  }
  return trades;
}

// All FX + indices + commodities pairs available on Oanda
const ALL_PAIRS = [
  { pair: "AUDJPY", inst: "AUD_JPY", ac: "fx" },
  { pair: "AUDNZD", inst: "AUD_NZD", ac: "fx" },
  { pair: "AUDUSD", inst: "AUD_USD", ac: "fx" },
  { pair: "AUDCHF", inst: "AUD_CHF", ac: "fx" },
  { pair: "AUDCAD", inst: "AUD_CAD", ac: "fx" },
  { pair: "CADCHF", inst: "CAD_CHF", ac: "fx" },
  { pair: "CADJPY", inst: "CAD_JPY", ac: "fx" },
  { pair: "CHFJPY", inst: "CHF_JPY", ac: "fx" },
  { pair: "EURAUD", inst: "EUR_AUD", ac: "fx" },
  { pair: "EURCAD", inst: "EUR_CAD", ac: "fx" },
  { pair: "EURCHF", inst: "EUR_CHF", ac: "fx" },
  { pair: "EURGBP", inst: "EUR_GBP", ac: "fx" },
  { pair: "EURJPY", inst: "EUR_JPY", ac: "fx" },
  { pair: "EURNZD", inst: "EUR_NZD", ac: "fx" },
  { pair: "EURUSD", inst: "EUR_USD", ac: "fx" },
  { pair: "GBPAUD", inst: "GBP_AUD", ac: "fx" },
  { pair: "GBPCAD", inst: "GBP_CAD", ac: "fx" },
  { pair: "GBPCHF", inst: "GBP_CHF", ac: "fx" },
  { pair: "GBPJPY", inst: "GBP_JPY", ac: "fx" },
  { pair: "GBPNZD", inst: "GBP_NZD", ac: "fx" },
  { pair: "GBPUSD", inst: "GBP_USD", ac: "fx" },
  { pair: "NZDCAD", inst: "NZD_CAD", ac: "fx" },
  { pair: "NZDCHF", inst: "NZD_CHF", ac: "fx" },
  { pair: "NZDJPY", inst: "NZD_JPY", ac: "fx" },
  { pair: "NZDUSD", inst: "NZD_USD", ac: "fx" },
  { pair: "USDCAD", inst: "USD_CAD", ac: "fx" },
  { pair: "USDCHF", inst: "USD_CHF", ac: "fx" },
  { pair: "USDJPY", inst: "USD_JPY", ac: "fx" },
  { pair: "XAUUSD", inst: "XAU_USD", ac: "commodities" },
  { pair: "SPXUSD", inst: "SPX500_USD", ac: "indices" },
  { pair: "NDXUSD", inst: "NAS100_USD", ac: "indices" },
  { pair: "NIKKEIUSD", inst: "JP225_USD", ac: "indices" },
];

async function main() {
  // Build completed weeks from DB
  const weeks = await pool.query(
    `SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`
  );

  let biased = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };
  let neutral = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };
  const weekResults = [];

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    let weekBiased = 0, weekNeutral = 0;

    // Get biased signals for this week (from existing DB)
    const biasedSignals = await pool.query(
      `SELECT symbol, direction, (array_agg(metadata::text))[1] m
       FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc = $1
       GROUP BY symbol, direction`, [weekOpenUtc]
    );
    const biasedPairs = new Set();
    const biasedMap = {};
    biasedSignals.rows.forEach(x => {
      const md = JSON.parse(x.m);
      biasedPairs.add(x.symbol);
      biasedMap[x.symbol] = { direction: x.direction, ac: md.assetClass || "fx" };
    });

    for (const { pair, inst, ac } of ALL_PAIRS) {
      const isFx = ac === "fx";
      const weekStart = new Date(new Date(weekOpenUtc).getTime() - (isFx ? 2 : 1) * 3600000).toISOString();
      const weekCloseMs = new Date(weekStart).getTime() + 5 * 24 * 3600000;

      const adr = await fetchDailyAdr(inst, weekStart, isFx ? 17 : 18);
      if (!adr) continue;
      const allBars = await fetchAllM5(inst, weekStart);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (bars.length === 0) continue;

      // Biased: only run if pair is in the v3 basket, only in that direction
      if (biasedMap[pair]) {
        const trades = scanDir(bars, biasedMap[pair].direction, adr);
        for (const t of trades) {
          biased.trades++;
          if (t.exitType === "TP_HIT") { biased.tp++; biased.tpPnl += t.pnl; }
          else { biased.wc++; biased.wcPnl += t.pnl; }
          weekBiased += t.pnl;
        }
      }

      // Neutral: run BOTH directions
      for (const dir of ["LONG", "SHORT"]) {
        const trades = scanDir(bars, dir, adr);
        for (const t of trades) {
          neutral.trades++;
          if (t.exitType === "TP_HIT") { neutral.tp++; neutral.tpPnl += t.pnl; }
          else { neutral.wc++; neutral.wcPnl += t.pnl; }
          weekNeutral += t.pnl;
        }
      }

      await new Promise(r => setTimeout(r, 120));
    }

    const label = new Date(new Date(weekOpenUtc).getTime() + 86400000).toISOString().slice(5, 10);
    weekResults.push({ label, biased: weekBiased, neutral: weekNeutral });
    process.stdout.write(".");
  }

  console.log("\n\n=== NEUTRAL vs BIASED BACKTEST (9 weeks) ===\n");
  console.log("Week".padEnd(10), "Biased (v3)".padEnd(14), "Neutral (both dirs)");
  console.log("-".repeat(45));
  for (const w of weekResults) {
    console.log(w.label.padEnd(10),
      ((w.biased > 0 ? "+" : "") + w.biased.toFixed(2) + "%").padEnd(14),
      (w.neutral > 0 ? "+" : "") + w.neutral.toFixed(2) + "%");
  }

  console.log("\n=== SUMMARY ===\n");
  console.log("".padEnd(15), "Biased (v3)".padEnd(18), "Neutral (all pairs both dirs)");
  console.log("-".repeat(60));
  console.log("Pairs".padEnd(15), (biased.trades > 0 ? "~" + biasedPairs.size : "0").padEnd(18), ALL_PAIRS.length + " × 2 dirs");
  console.log("Trades".padEnd(15), String(biased.trades).padEnd(18), neutral.trades);
  console.log("TP Hits".padEnd(15), String(biased.tp).padEnd(18), neutral.tp);
  console.log("Week Close".padEnd(15), String(biased.wc).padEnd(18), neutral.wc);
  const biasedNet = biased.tpPnl + biased.wcPnl;
  const neutralNet = neutral.tpPnl + neutral.wcPnl;
  console.log("TP Profit".padEnd(15), ("+" + biased.tpPnl.toFixed(2) + "%").padEnd(18), "+" + neutral.tpPnl.toFixed(2) + "%");
  console.log("WC Loss".padEnd(15), (biased.wcPnl.toFixed(2) + "%").padEnd(18), neutral.wcPnl.toFixed(2) + "%");
  console.log("Net".padEnd(15), ((biasedNet > 0 ? "+" : "") + biasedNet.toFixed(2) + "%").padEnd(18), (neutralNet > 0 ? "+" : "") + neutralNet.toFixed(2) + "%");
  console.log("Win Rate".padEnd(15), ((biased.tp / biased.trades * 100).toFixed(1) + "%").padEnd(18), (neutral.tp / neutral.trades * 100).toFixed(1) + "%");

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
