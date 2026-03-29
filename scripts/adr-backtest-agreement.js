/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-agreement.js
 *
 * Description:
 * Tests whether requiring agreement between bias sources improves ADR results.
 *
 * Variants:
 *   1. Dealer only
 *   2. Commercial only
 *   3. Sentiment only
 *   4. 2-of-3 agree (any 2 of dealer/commercial/sentiment)
 *   5. 3-of-3 agree (all must agree)
 *   6. V3 (from DB, reference)
 *
 * All with baseline and stoch. 9 weeks, 36 pairs.
 *
 * Usage: node scripts/adr-backtest-agreement.js
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

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

const STOCH_K = 100, STOCH_SMOOTH = 3, OB_LEVEL = 80, OS_LEVEL = 20;
const WARMUP_MS = 14 * 3600 * 1000;

const ALL_PAIRS = [
  { pair: "AUDCAD", inst: "AUD_CAD", ac: "fx" },
  { pair: "AUDCHF", inst: "AUD_CHF", ac: "fx" },
  { pair: "AUDJPY", inst: "AUD_JPY", ac: "fx" },
  { pair: "AUDNZD", inst: "AUD_NZD", ac: "fx" },
  { pair: "AUDUSD", inst: "AUD_USD", ac: "fx" },
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
  { pair: "BTCUSD", inst: "BTC_USD", ac: "crypto" },
  { pair: "ETHUSD", inst: "ETH_USD", ac: "crypto" },
  { pair: "WTIUSD", inst: "WTICO_USD", ac: "commodities" },
  { pair: "XAGUSD", inst: "XAG_USD", ac: "commodities" },
  { pair: "XAUUSD", inst: "XAU_USD", ac: "commodities" },
  { pair: "SPXUSD", inst: "SPX500_USD", ac: "indices" },
  { pair: "NDXUSD", inst: "NAS100_USD", ac: "indices" },
  { pair: "NIKKEIUSD", inst: "JP225_USD", ac: "indices" },
];

/* ─── Oanda ──────────────────────────────────────────────────── */

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

/* ─── Stochastic ─────────────────────────────────────────────── */

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

function computeStochK(bars) {
  const rawStoch = new Array(bars.length).fill(null);
  for (let i = STOCH_K - 1; i < bars.length; i++) {
    let lo = Infinity, hi = -Infinity;
    for (let j = i - STOCH_K + 1; j <= i; j++) { lo = Math.min(lo, bars[j].low); hi = Math.max(hi, bars[j].high); }
    rawStoch[i] = hi === lo ? 0 : 100 * (bars[i].close - lo) / (hi - lo);
  }
  return sma(rawStoch, STOCH_SMOOTH);
}

/* ─── Scanners ───────────────────────────────────────────────── */

function scanBaseline(bars, startIdx, dir, rawAdr) {
  let a = null, it = false, tp = 0, ep = 0;
  const trades = [];
  for (let i = startIdx; i < bars.length; i++) {
    const b = bars[i];
    if (it) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        trades.push({ exitType: "TP_HIT", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100 });
        it = false; a = dir === "LONG" ? b.high : b.low; continue;
      }
      continue;
    }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    const t = dir === "LONG" ? e + rawAdr * 0.25 : e - rawAdr * 0.25;
    if (dir === "LONG" ? b.low <= e : b.high >= e) { ep = e; tp = t; it = true; }
  }
  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 });
  }
  return trades;
}

function scanStoch(bars, startIdx, dir, rawAdr, stochK) {
  let a = null, it = false, tp = 0, ep = 0, adrQ = false;
  const trades = [];
  for (let i = startIdx; i < bars.length; i++) {
    const b = bars[i], sk = stochK[i];
    if (it) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        trades.push({ exitType: "TP_HIT", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100 });
        it = false; adrQ = false; a = dir === "LONG" ? b.high : b.low; continue;
      }
      continue;
    }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    if (!adrQ && (dir === "LONG" ? b.low <= e : b.high >= e)) adrQ = true;
    if (adrQ && !it && sk !== null) {
      if (dir === "SHORT" ? sk >= OB_LEVEL : sk <= OS_LEVEL) {
        ep = dir === "LONG" ? b.low : b.high;
        tp = dir === "LONG" ? ep + rawAdr * 0.25 : ep - rawAdr * 0.25;
        it = true; adrQ = false; a = dir === "LONG" ? b.high : b.low;
      }
    }
  }
  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 });
  }
  return trades;
}

/* ─── Direction derivation ───────────────────────────────────── */

const PAIR_CURRENCIES = {};
for (const { pair, ac } of ALL_PAIRS) {
  if (ac === "fx") PAIR_CURRENCIES[pair] = { type: "fx", base: pair.slice(0, 3), quote: pair.slice(3) };
  else {
    const m = { XAUUSD: "XAU", XAGUSD: "XAG", WTIUSD: "WTI", SPXUSD: "SPX", NDXUSD: "NDX", NIKKEIUSD: "NIKKEI", BTCUSD: "BTC", ETHUSD: "ETH" };
    PAIR_CURRENCIES[pair] = { type: ac, market: m[pair] };
  }
}

function cotDirection(pair, cotByAc, model) {
  const info = PAIR_CURRENCIES[pair];
  if (!info) return null;
  if (info.type === "fx") {
    const snap = cotByAc["fx"];
    if (!snap) return null;
    const bb = snap[info.base]?.[model + "_bias"];
    const qb = snap[info.quote]?.[model + "_bias"];
    if (!bb || !qb) return null;
    if (bb === "BULLISH" && qb === "BEARISH") return "LONG";
    if (bb === "BEARISH" && qb === "BULLISH") return "SHORT";
    return null;
  }
  const snap = cotByAc[info.type];
  const bias = snap?.[info.market]?.[model + "_bias"];
  if (bias === "BULLISH") return "LONG";
  if (bias === "BEARISH") return "SHORT";
  return null;
}

function sentimentDirection(agg) {
  if (!agg) return null;
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return null;
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return null;
}

// Agreement logic: takes 3 directions (can be null), returns agreed direction or null
function agree2of3(d1, d2, d3) {
  const votes = [d1, d2, d3].filter(Boolean);
  if (votes.length < 2) return null;
  const longs = votes.filter(v => v === "LONG").length;
  const shorts = votes.filter(v => v === "SHORT").length;
  if (longs >= 2) return "LONG";
  if (shorts >= 2) return "SHORT";
  return null;
}

function agree3of3(d1, d2, d3) {
  if (!d1 || !d2 || !d3) return null;
  if (d1 === d2 && d2 === d3) return d1;
  return null;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function makeAcc() { return { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 }; }
function addTrades(acc, trades) {
  for (const t of trades) {
    acc.trades++;
    if (t.exitType === "TP_HIT") { acc.tp++; acc.tpPnl += t.pnl; }
    else { acc.wc++; acc.wcPnl += t.pnl; }
  }
}
function net(a) { return a.tpPnl + a.wcPnl; }
function wr(a) { return a.trades > 0 ? (a.tp / a.trades * 100) : 0; }
function fmt(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }

/* ─── Main ───────────────────────────────────────────────────── */

async function main() {
  console.log("Loading data...\n");

  // Sentiment
  const allAggs = await pool.query(`SELECT symbol, crowding_state, flip_state, timestamp_utc FROM sentiment_aggregates ORDER BY timestamp_utc ASC`);
  const aggs = allAggs.rows.map(r => ({ symbol: r.symbol, crowding_state: r.crowding_state, flip_state: r.flip_state, ts: new Date(r.timestamp_utc).getTime() }));
  const bySymbol = {};
  for (const a of aggs) { if (!bySymbol[a.symbol]) bySymbol[a.symbol] = []; bySymbol[a.symbol].push(a); }
  console.log(`  Sentiment: ${aggs.length} rows`);

  function resolveSentiment(weekOpenMs) {
    const result = {};
    for (const [sym, rows] of Object.entries(bySymbol)) {
      let lb = null, fa = null;
      for (const r of rows) { if (r.ts <= weekOpenMs) lb = r; if (r.ts > weekOpenMs && !fa) fa = r; if (fa) break; }
      if (lb || fa) result[sym] = lb || fa;
    }
    return result;
  }

  // Weeks
  const weeks = await pool.query(`SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`);
  console.log(`  Weeks: ${weeks.rows.length}`);

  // V3
  const v3Raw = await pool.query(`SELECT DISTINCT ON (week_open_utc, symbol) week_open_utc, symbol, direction FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc, symbol, entry_time_utc ASC`);
  const v3Signals = {};
  for (const r of v3Raw.rows) { const wk = new Date(r.week_open_utc).toISOString(); if (!v3Signals[wk]) v3Signals[wk] = {}; v3Signals[wk][r.symbol] = r.direction; }

  // COT
  const cotRaw = await pool.query(`SELECT report_date::text, asset_class, currencies FROM cot_snapshots WHERE report_date >= '2026-01-20' AND report_date <= '2026-03-17' ORDER BY report_date`);
  const cotByDate = {};
  for (const r of cotRaw.rows) { if (!cotByDate[r.report_date]) cotByDate[r.report_date] = {}; cotByDate[r.report_date][r.asset_class] = r.currencies; }
  const cotDates = Object.keys(cotByDate).sort();
  function findCot(weekOpenMs) {
    for (const rd of cotDates) {
      const diff = (new Date(rd + "T00:00:00Z").getTime() - weekOpenMs) / (24 * 3600000);
      if (diff >= 0 && diff <= 4) return cotByDate[rd];
    }
    return null;
  }
  console.log(`  COT: ${cotDates.length} weeks`);
  console.log();

  // Variant keys
  const KEYS = ["dealer", "comm", "sent", "agree2", "agree3", "v3"];
  const acc = {};
  for (const k of KEYS) { acc[k + "B"] = makeAcc(); acc[k + "S"] = makeAcc(); }
  const weekResults = [];

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const weekOpenMs = new Date(weekOpenUtc).getTime();
    const sentMap = resolveSentiment(weekOpenMs);
    const v3Map = v3Signals[weekOpenUtc] || {};
    const cotSnap = findCot(weekOpenMs);

    const wk = {};
    for (const k of KEYS) { wk[k + "B"] = makeAcc(); wk[k + "S"] = makeAcc(); }

    // Track signal counts per variant this week
    const signals = {};
    for (const k of KEYS) signals[k] = 0;

    for (const { pair, inst, ac } of ALL_PAIRS) {
      const isFx = ac === "fx";
      const weekStartMs = weekOpenMs - (isFx ? 2 : 1) * 3600000;
      const weekCloseMs = weekStartMs + 5 * 24 * 3600000;
      const warmupUtc = new Date(weekStartMs - WARMUP_MS).toISOString();
      const weekStartUtc = new Date(weekStartMs).toISOString();

      // Get all 3 directions for this pair
      const dealerDir = cotSnap ? cotDirection(pair, cotSnap, "dealer") : null;
      const commDir = cotSnap ? cotDirection(pair, cotSnap, "commercial") : null;
      const sentDir = sentimentDirection(sentMap[pair]);
      const v3Dir = v3Map[pair] || null;
      const a2Dir = agree2of3(dealerDir, commDir, sentDir);
      const a3Dir = agree3of3(dealerDir, commDir, sentDir);

      // Skip if NO variant needs this pair (optimization)
      const dirs = { dealer: dealerDir, comm: commDir, sent: sentDir, agree2: a2Dir, agree3: a3Dir, v3: v3Dir };
      const hasAny = Object.values(dirs).some(Boolean);
      if (!hasAny) continue;

      // Fetch data ONCE
      const adr = await fetchDailyAdr(inst, weekStartUtc, isFx ? 17 : 18);
      if (!adr) continue;
      const allBars = await fetchAllM5(inst, warmupUtc);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (!bars.length) continue;
      const weekStartIdx = bars.findIndex(b => b.ts >= weekStartMs);
      if (weekStartIdx < 0) continue;
      const stochK = computeStochK(bars);

      // Run scanners for each variant that has a signal
      for (const k of KEYS) {
        const dir = dirs[k];
        if (!dir) continue;
        signals[k]++;
        addTrades(wk[k + "B"], scanBaseline(bars, weekStartIdx, dir, adr));
        addTrades(wk[k + "S"], scanStoch(bars, weekStartIdx, dir, adr, stochK));
      }

      await new Promise(r => setTimeout(r, 100));
    }

    // Merge
    for (const k of KEYS) {
      for (const suffix of ["B", "S"]) {
        const key = k + suffix;
        acc[key].trades += wk[key].trades;
        acc[key].tp += wk[key].tp;
        acc[key].wc += wk[key].wc;
        acc[key].tpPnl += wk[key].tpPnl;
        acc[key].wcPnl += wk[key].wcPnl;
      }
    }

    const label = new Date(weekOpenMs + 86400000).toISOString().slice(5, 10);
    weekResults.push({ label, wk, signals });
    console.log(`  ${label}: Dealer ${fmt(net(wk.dealerB))}→${fmt(net(wk.dealerS))} | Comm ${fmt(net(wk.commB))}→${fmt(net(wk.commS))} | Sent ${fmt(net(wk.sentB))}→${fmt(net(wk.sentS))} | 2of3 ${fmt(net(wk.agree2B))}→${fmt(net(wk.agree2S))} | 3of3 ${fmt(net(wk.agree3B))}→${fmt(net(wk.agree3S))} | V3 ${fmt(net(wk.v3B))}→${fmt(net(wk.v3S))}`);
  }

  // ─── Results ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(100));
  console.log("  AGREEMENT TEST — 9 WEEKS, 36 PAIRS");
  console.log("  Does requiring 2-of-3 or 3-of-3 agreement beat individual signals?");
  console.log("=".repeat(100));

  // Summary table
  console.log("\n── SUMMARY ──\n");
  const names = { dealer: "Dealer", comm: "Commercial", sent: "Sentiment", agree2: "2-of-3 Agree", agree3: "3-of-3 Agree", v3: "V3 (ref)" };
  console.log("Variant".padEnd(20), "Trades".padEnd(8), "TP".padEnd(6), "WC".padEnd(6), "Net Base".padEnd(12), "Net Stoch".padEnd(12), "Base WR".padEnd(10), "Stoch WR".padEnd(10), "Stoch Δ");
  console.log("-".repeat(100));
  for (const k of KEYS) {
    const b = acc[k + "B"], s = acc[k + "S"];
    console.log(
      names[k].padEnd(20),
      String(b.trades).padEnd(8),
      String(b.tp).padEnd(6),
      String(b.wc).padEnd(6),
      fmt(net(b)).padEnd(12),
      fmt(net(s)).padEnd(12),
      (wr(b).toFixed(1) + "%").padEnd(10),
      (wr(s).toFixed(1) + "%").padEnd(10),
      fmt(net(s) - net(b))
    );
  }

  // Signals per week
  console.log("\n── SIGNALS PER WEEK (how many pairs traded) ──\n");
  console.log("Week".padEnd(7), "Dealer".padEnd(8), "Comm".padEnd(8), "Sent".padEnd(8), "2of3".padEnd(8), "3of3".padEnd(8), "V3".padEnd(8));
  console.log("-".repeat(55));
  for (const { label, signals } of weekResults) {
    console.log(label.padEnd(7),
      String(signals.dealer).padEnd(8), String(signals.comm).padEnd(8), String(signals.sent).padEnd(8),
      String(signals.agree2).padEnd(8), String(signals.agree3).padEnd(8), String(signals.v3).padEnd(8));
  }

  // Per-week net (stoch only — the interesting comparison)
  console.log("\n── PER-WEEK STOCH NET ──\n");
  console.log("Week".padEnd(7), "Dealer+S".padEnd(11), "Comm+S".padEnd(11), "Sent+S".padEnd(11), "2of3+S".padEnd(11), "3of3+S".padEnd(11), "V3+S".padEnd(11));
  console.log("-".repeat(72));
  for (const { label, wk } of weekResults) {
    console.log(label.padEnd(7),
      fmt(net(wk.dealerS)).padEnd(11), fmt(net(wk.commS)).padEnd(11), fmt(net(wk.sentS)).padEnd(11),
      fmt(net(wk.agree2S)).padEnd(11), fmt(net(wk.agree3S)).padEnd(11), fmt(net(wk.v3S)).padEnd(11));
  }

  // Return per trade (efficiency)
  console.log("\n── EFFICIENCY (net return / trade count) ──\n");
  for (const k of KEYS) {
    const b = acc[k + "B"], s = acc[k + "S"];
    const bEff = b.trades > 0 ? net(b) / b.trades : 0;
    const sEff = s.trades > 0 ? net(s) / s.trades : 0;
    console.log(names[k].padEnd(20), "Base:", (bEff >= 0 ? "+" : "") + bEff.toFixed(3) + "% / trade", "  Stoch:", (sEff >= 0 ? "+" : "") + sEff.toFixed(3) + "% / trade");
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
