/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-comparison.js
 *
 * Description:
 * Unified ADR comparison — tests 5 bias sources × 2 filters on the SAME data.
 *
 * Bias sources:
 *   1. Tiered V3 (direction from DB run_id=54)
 *   2. Sentiment only (contrarian retail crowd positioning)
 *   3. Dealer only (COT dealer/intermediary positioning)
 *   4. Commercial only (COT commercial/hedger positioning)
 *   5. Neutral (LONG + SHORT independently on every pair)
 *
 * Filters:
 *   A. Baseline (plain ADR, static 0.25x TP)
 *   B. Stoch confirmation (ADR qualifies zone, stoch K confirms entry)
 *
 * All variants use identical M5 bars, ADR values, and scanner logic.
 * Data fetched ONCE per pair-week. 36 pairs × 9 weeks.
 *
 * Usage: node scripts/adr-backtest-comparison.js
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

/* ─── Stoch settings (RRanjanFX) ─────────────────────────────── */
const STOCH_K = 100;
const STOCH_SMOOTH = 3;
const OB_LEVEL = 80;
const OS_LEVEL = 20;

/* ─── Pair universe (all 36) ─────────────────────────────────── */
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

/* ─── Oanda helpers ──────────────────────────────────────────── */

async function fetchAllM5(inst, fromUtc) {
  const bars = [];
  let cursor = fromUtc;
  for (let page = 0; page < 20; page++) {
    const url = `${BASE}/v3/instruments/${inst}/candles?price=M&granularity=M5&from=${cursor}&count=500`;
    const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
    const d = await r.json();
    const b = (d.candles || []).filter(c => c.complete && c.mid);
    if (!b.length) break;
    for (const c of b)
      bars.push({ ts: new Date(c.time).getTime(), high: +c.mid.h, low: +c.mid.l, close: +c.mid.c });
    cursor = new Date(new Date(b[b.length - 1].time).getTime() + 1000).toISOString();
    if (b.length < 500) break;
    await new Promise(r => setTimeout(r, 80));
  }
  return bars;
}

async function fetchDailyAdr(inst, beforeUtc, alignment) {
  const from = new Date(new Date(beforeUtc).getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const url = `${BASE}/v3/instruments/${inst}/candles?price=M&granularity=D&from=${from}&count=500&dailyAlignment=${alignment}&alignmentTimezone=America%2FNew_York`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
  const d = await r.json();
  const bars = (d.candles || []).filter(c => c.complete && c.mid && new Date(c.time) < new Date(beforeUtc));
  const skip1 = bars.slice(0, -1); // skip most recent (Pine high[1..10])
  const last10 = skip1.slice(-10);
  if (last10.length < 5) return null;
  return last10.reduce((s, c) => (+c.mid.h) - (+c.mid.l) + s, 0) / last10.length;
}

/* ─── Stochastic K computation ───────────────────────────────── */

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
    let lowestLow = Infinity, highestHigh = -Infinity;
    for (let j = i - STOCH_K + 1; j <= i; j++) {
      lowestLow = Math.min(lowestLow, bars[j].low);
      highestHigh = Math.max(highestHigh, bars[j].high);
    }
    const range = highestHigh - lowestLow;
    rawStoch[i] = range === 0 ? 0 : 100 * (bars[i].close - lowestLow) / range;
  }
  return sma(rawStoch, STOCH_SMOOTH);
}

/* ─── Scanners ───────────────────────────────────────────────── */

// Baseline scanner: Fresh Start, static 0.25x TP
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
    if (dir === "LONG" ? b.low <= e : b.high >= e) {
      ep = e; tp = t; it = true;
    }
  }
  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 });
  }
  return trades;
}

// Stoch scanner: ADR qualifies zone, wait for stoch K to confirm entry
function scanStoch(bars, startIdx, dir, rawAdr, stochK) {
  let a = null, it = false, tp = 0, ep = 0;
  let adrQualified = false;
  const trades = [];

  for (let i = startIdx; i < bars.length; i++) {
    const b = bars[i];
    const sk = stochK[i];

    if (it) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        trades.push({ exitType: "TP_HIT", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100 });
        it = false; adrQualified = false;
        a = dir === "LONG" ? b.high : b.low;
        continue;
      }
      continue;
    }

    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;

    // Check if ADR zone is reached
    if (!adrQualified && (dir === "LONG" ? b.low <= e : b.high >= e)) {
      adrQualified = true;
    }

    // If ADR qualified, wait for stoch confirmation
    if (adrQualified && !it && sk !== null) {
      const stochConfirm = dir === "SHORT" ? sk >= OB_LEVEL : sk <= OS_LEVEL;
      if (stochConfirm) {
        ep = dir === "LONG" ? b.low : b.high;
        tp = dir === "LONG" ? ep + rawAdr * 0.25 : ep - rawAdr * 0.25;
        it = true;
        adrQualified = false;
        a = dir === "LONG" ? b.high : b.low;
      }
    }
  }

  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 });
  }
  return trades;
}

/* ─── Sentiment direction (matches production basketSignals.ts) ── */

function sentimentDirection(agg) {
  if (!agg) return null;
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return null;
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return null;
}

/* ─── COT direction derivation ───────────────────────────────── */

// Map pairs to base/quote currencies (FX) or market name (non-FX)
const PAIR_CURRENCIES = {};
for (const { pair, ac } of ALL_PAIRS) {
  if (ac === "fx") {
    PAIR_CURRENCIES[pair] = { type: "fx", base: pair.slice(0, 3), quote: pair.slice(3) };
  } else {
    // Non-FX: map to COT market name
    const marketMap = {
      XAUUSD: "XAU", XAGUSD: "XAG", WTIUSD: "WTI",
      SPXUSD: "SPX", NDXUSD: "NDX", NIKKEIUSD: "NIKKEI",
      BTCUSD: "BTC", ETHUSD: "ETH",
    };
    PAIR_CURRENCIES[pair] = { type: ac, market: marketMap[pair] };
  }
}

// Derive direction from COT currency biases for a specific model (dealer or commercial)
function cotDirection(pair, cotByAc, model) {
  const info = PAIR_CURRENCIES[pair];
  if (!info) return null;

  if (info.type === "fx") {
    const fxSnap = cotByAc["fx"];
    if (!fxSnap) return null;
    const baseBias = fxSnap[info.base] ? fxSnap[info.base][model + "_bias"] : null;
    const quoteBias = fxSnap[info.quote] ? fxSnap[info.quote][model + "_bias"] : null;
    if (!baseBias || !quoteBias) return null;
    if (baseBias === "BULLISH" && quoteBias === "BEARISH") return "LONG";
    if (baseBias === "BEARISH" && quoteBias === "BULLISH") return "SHORT";
    return null; // same bias or NEUTRAL = no signal
  } else {
    // Non-FX: use market's own bias
    const snap = cotByAc[info.type];
    if (!snap || !snap[info.market]) return null;
    const bias = snap[info.market][model + "_bias"];
    if (bias === "BULLISH") return "LONG";
    if (bias === "BEARISH") return "SHORT";
    return null;
  }
}

/* ─── Accumulator helper ─────────────────────────────────────── */

function makeAcc() { return { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 }; }
function addTrades(acc, trades) {
  for (const t of trades) {
    acc.trades++;
    if (t.exitType === "TP_HIT") { acc.tp++; acc.tpPnl += t.pnl; }
    else { acc.wc++; acc.wcPnl += t.pnl; }
  }
}
function net(acc) { return acc.tpPnl + acc.wcPnl; }
function wr(acc) { return acc.trades > 0 ? (acc.tp / acc.trades * 100) : 0; }

/* ─── Main ───────────────────────────────────────────────────── */

async function main() {
  console.log("Loading data...\n");

  // 1. Load ALL sentiment aggregates
  const allAggs = await pool.query(
    `SELECT symbol, crowding_state, flip_state, timestamp_utc FROM sentiment_aggregates ORDER BY timestamp_utc ASC`
  );
  const aggs = allAggs.rows.map(r => ({
    symbol: r.symbol,
    crowding_state: r.crowding_state,
    flip_state: r.flip_state,
    ts: new Date(r.timestamp_utc).getTime()
  }));
  const bySymbol = {};
  for (const a of aggs) {
    if (!bySymbol[a.symbol]) bySymbol[a.symbol] = [];
    bySymbol[a.symbol].push(a);
  }
  console.log(`  Sentiment: ${aggs.length} rows loaded`);

  function resolveSentiment(weekOpenMs) {
    const result = {};
    for (const [sym, rows] of Object.entries(bySymbol)) {
      let latestBefore = null, firstAfter = null;
      for (const r of rows) {
        if (r.ts <= weekOpenMs) latestBefore = r;
        if (r.ts > weekOpenMs && !firstAfter) firstAfter = r;
        if (firstAfter) break;
      }
      const pick = latestBefore || firstAfter;
      if (pick) result[sym] = pick;
    }
    return result;
  }

  // 2. Get completed weeks
  const weeks = await pool.query(
    `SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`
  );
  console.log(`  Weeks: ${weeks.rows.length}`);

  // 3. Get V3 signals per week (pair → direction)
  const v3Raw = await pool.query(`
    SELECT DISTINCT ON (week_open_utc, symbol) week_open_utc, symbol, direction
    FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z'
    ORDER BY week_open_utc, symbol, entry_time_utc ASC
  `);
  const v3Signals = {}; // weekISO → { PAIR: "LONG"|"SHORT" }
  for (const r of v3Raw.rows) {
    const wk = new Date(r.week_open_utc).toISOString();
    if (!v3Signals[wk]) v3Signals[wk] = {};
    v3Signals[wk][r.symbol] = r.direction;
  }
  console.log(`  V3 signals: loaded`);

  // 4. Load COT snapshots (dealer + commercial biases per currency per week)
  const cotRaw = await pool.query(`
    SELECT report_date::text, asset_class, currencies
    FROM cot_snapshots
    WHERE report_date >= '2026-01-20' AND report_date <= '2026-03-17'
    ORDER BY report_date
  `);
  // Group by report_date → { asset_class: currencies }
  const cotByDate = {};
  for (const r of cotRaw.rows) {
    if (!cotByDate[r.report_date]) cotByDate[r.report_date] = {};
    cotByDate[r.report_date][r.asset_class] = r.currencies;
  }
  // Map week_open_utc to closest COT report_date
  // COT report_date is Tuesday of each week; week_open is Sunday/Monday
  const cotReportDates = Object.keys(cotByDate).sort();
  function findCotForWeek(weekOpenMs) {
    // Find report_date within 4 days after week open (Tuesday of that week)
    const weekOpenDate = new Date(weekOpenMs);
    for (const rd of cotReportDates) {
      const rdMs = new Date(rd + "T00:00:00Z").getTime();
      const diffDays = (rdMs - weekOpenMs) / (24 * 3600 * 1000);
      if (diffDays >= 0 && diffDays <= 4) return cotByDate[rd];
    }
    return null;
  }
  console.log(`  COT snapshots: ${cotReportDates.length} weeks loaded\n`);

  // Warmup: stoch K=100 needs ~100 M5 bars = ~8.3 hrs. Use 14 hrs for safety.
  const WARMUP_MS = 14 * 3600 * 1000;

  // Accumulators — {v3, sentiment, dealer, commercial, neutralLong, neutralShort} × {baseline, stoch}
  const acc = {
    v3Base: makeAcc(), v3Stoch: makeAcc(),
    sentBase: makeAcc(), sentStoch: makeAcc(),
    dealerBase: makeAcc(), dealerStoch: makeAcc(),
    commBase: makeAcc(), commStoch: makeAcc(),
    nLongBase: makeAcc(), nLongStoch: makeAcc(),
    nShortBase: makeAcc(), nShortStoch: makeAcc(),
  };
  const weekDetail = []; // per-week results

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const weekOpenMs = new Date(weekOpenUtc).getTime();
    const sentMap = resolveSentiment(weekOpenMs);
    const v3Map = v3Signals[weekOpenUtc] || {};
    const cotSnap = findCotForWeek(weekOpenMs); // { fx: {...}, indices: {...}, ... }

    // Per-week accumulators
    const wk = {
      v3Base: makeAcc(), v3Stoch: makeAcc(),
      sentBase: makeAcc(), sentStoch: makeAcc(),
      dealerBase: makeAcc(), dealerStoch: makeAcc(),
      commBase: makeAcc(), commStoch: makeAcc(),
      nLongBase: makeAcc(), nLongStoch: makeAcc(),
      nShortBase: makeAcc(), nShortStoch: makeAcc(),
    };

    for (const { pair, inst, ac } of ALL_PAIRS) {
      const isFx = ac === "fx";
      const weekStartMs = weekOpenMs - (isFx ? 2 : 1) * 3600000;
      const weekCloseMs = weekStartMs + 5 * 24 * 3600000;
      const warmupStartUtc = new Date(weekStartMs - WARMUP_MS).toISOString();
      const weekStartUtc = new Date(weekStartMs).toISOString();

      // Fetch data ONCE
      const adr = await fetchDailyAdr(inst, weekStartUtc, isFx ? 17 : 18);
      if (!adr) continue;
      const allBars = await fetchAllM5(inst, warmupStartUtc);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (bars.length === 0) continue;

      const weekStartIdx = bars.findIndex(b => b.ts >= weekStartMs);
      if (weekStartIdx < 0) continue;

      // Compute stoch K ONCE (on all bars including warmup)
      const stochK = computeStochK(bars);

      // ── V3: only if pair has a V3 signal this week ──
      const v3Dir = v3Map[pair];
      if (v3Dir) {
        addTrades(wk.v3Base, scanBaseline(bars, weekStartIdx, v3Dir, adr));
        addTrades(wk.v3Stoch, scanStoch(bars, weekStartIdx, v3Dir, adr, stochK));
      }

      // ── Sentiment: only if sentiment gives a direction ──
      const sentDir = sentimentDirection(sentMap[pair]);
      if (sentDir) {
        addTrades(wk.sentBase, scanBaseline(bars, weekStartIdx, sentDir, adr));
        addTrades(wk.sentStoch, scanStoch(bars, weekStartIdx, sentDir, adr, stochK));
      }

      // ── Dealer: only if COT dealer gives a direction ──
      if (cotSnap) {
        const dealerDir = cotDirection(pair, cotSnap, "dealer");
        if (dealerDir) {
          addTrades(wk.dealerBase, scanBaseline(bars, weekStartIdx, dealerDir, adr));
          addTrades(wk.dealerStoch, scanStoch(bars, weekStartIdx, dealerDir, adr, stochK));
        }
      }

      // ── Commercial: only if COT commercial gives a direction ──
      if (cotSnap) {
        const commDir = cotDirection(pair, cotSnap, "commercial");
        if (commDir) {
          addTrades(wk.commBase, scanBaseline(bars, weekStartIdx, commDir, adr));
          addTrades(wk.commStoch, scanStoch(bars, weekStartIdx, commDir, adr, stochK));
        }
      }

      // ── Neutral: LONG and SHORT independently, always ──
      addTrades(wk.nLongBase, scanBaseline(bars, weekStartIdx, "LONG", adr));
      addTrades(wk.nLongStoch, scanStoch(bars, weekStartIdx, "LONG", adr, stochK));
      addTrades(wk.nShortBase, scanBaseline(bars, weekStartIdx, "SHORT", adr));
      addTrades(wk.nShortStoch, scanStoch(bars, weekStartIdx, "SHORT", adr, stochK));

      await new Promise(r => setTimeout(r, 100));
    }

    // Merge week into totals
    for (const key of Object.keys(acc)) {
      acc[key].trades += wk[key].trades;
      acc[key].tp += wk[key].tp;
      acc[key].wc += wk[key].wc;
      acc[key].tpPnl += wk[key].tpPnl;
      acc[key].wcPnl += wk[key].wcPnl;
    }

    const label = new Date(weekOpenMs + 86400000).toISOString().slice(5, 10);
    weekDetail.push({ label, wk });

    // Progress
    const nCombBase = net(wk.nLongBase) + net(wk.nShortBase);
    const nCombStoch = net(wk.nLongStoch) + net(wk.nShortStoch);
    console.log(`  ${label}: V3 ${fmt(net(wk.v3Base))}→${fmt(net(wk.v3Stoch))} | Sent ${fmt(net(wk.sentBase))}→${fmt(net(wk.sentStoch))} | Dealer ${fmt(net(wk.dealerBase))}→${fmt(net(wk.dealerStoch))} | Comm ${fmt(net(wk.commBase))}→${fmt(net(wk.commStoch))} | Neut ${fmt(nCombBase)}→${fmt(nCombStoch)}`);
  }

  // ─── RESULTS ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(100));
  console.log("  UNIFIED COMPARISON — 5 BIAS SOURCES × BASELINE vs STOCH (9 weeks, 36 pairs)");
  console.log("  Stoch: K=" + STOCH_K + " Smooth=" + STOCH_SMOOTH + " OB=" + OB_LEVEL + " OS=" + OS_LEVEL);
  console.log("=".repeat(100));

  // Per-week table
  console.log("\n── PER-WEEK NET RETURNS (baseline → stoch) ──\n");
  console.log("Week".padEnd(7), "V3".padEnd(20), "Sentiment".padEnd(20), "Dealer".padEnd(20), "Commercial".padEnd(20), "Neutral".padEnd(20));
  console.log("-".repeat(107));
  for (const { label, wk } of weekDetail) {
    const nBase = net(wk.nLongBase) + net(wk.nShortBase);
    const nStoch = net(wk.nLongStoch) + net(wk.nShortStoch);
    const fmtPair = (b, s) => fmt(b) + "→" + fmt(s);
    console.log(label.padEnd(7),
      fmtPair(net(wk.v3Base), net(wk.v3Stoch)).padEnd(20),
      fmtPair(net(wk.sentBase), net(wk.sentStoch)).padEnd(20),
      fmtPair(net(wk.dealerBase), net(wk.dealerStoch)).padEnd(20),
      fmtPair(net(wk.commBase), net(wk.commStoch)).padEnd(20),
      fmtPair(nBase, nStoch).padEnd(20));
  }

  // Summary table
  console.log("\n── SUMMARY ──\n");
  const nLongBase = acc.nLongBase, nLongStoch = acc.nLongStoch;
  const nShortBase = acc.nShortBase, nShortStoch = acc.nShortStoch;
  const nCombBase = { trades: nLongBase.trades + nShortBase.trades, tp: nLongBase.tp + nShortBase.tp, wc: nLongBase.wc + nShortBase.wc, tpPnl: nLongBase.tpPnl + nShortBase.tpPnl, wcPnl: nLongBase.wcPnl + nShortBase.wcPnl };
  const nCombStoch = { trades: nLongStoch.trades + nShortStoch.trades, tp: nLongStoch.tp + nShortStoch.tp, wc: nLongStoch.wc + nShortStoch.wc, tpPnl: nLongStoch.tpPnl + nShortStoch.tpPnl, wcPnl: nLongStoch.wcPnl + nShortStoch.wcPnl };

  const variants = [
    ["V3 Baseline", acc.v3Base],
    ["V3 + Stoch", acc.v3Stoch],
    ["Sentiment Baseline", acc.sentBase],
    ["Sentiment + Stoch", acc.sentStoch],
    ["Dealer Baseline", acc.dealerBase],
    ["Dealer + Stoch", acc.dealerStoch],
    ["Commercial Baseline", acc.commBase],
    ["Commercial + Stoch", acc.commStoch],
    ["Neutral Baseline", nCombBase],
    ["Neutral + Stoch", nCombStoch],
    ["  (Neutral LONG)", nLongBase],
    ["  (Neutral LONG+S)", nLongStoch],
    ["  (Neutral SHORT)", nShortBase],
    ["  (Neutral SHORT+S)", nShortStoch],
  ];

  console.log("Variant".padEnd(22), "Trades".padEnd(8), "TP".padEnd(6), "WC".padEnd(6), "TP Pnl".padEnd(12), "WC Pnl".padEnd(12), "Net".padEnd(12), "WR");
  console.log("-".repeat(88));
  for (const [name, a] of variants) {
    const n = net(a);
    const w = wr(a);
    console.log(
      name.padEnd(22),
      String(a.trades).padEnd(8),
      String(a.tp).padEnd(6),
      String(a.wc).padEnd(6),
      ("+" + a.tpPnl.toFixed(2) + "%").padEnd(12),
      (a.wcPnl.toFixed(2) + "%").padEnd(12),
      ((n >= 0 ? "+" : "") + n.toFixed(2) + "%").padEnd(12),
      w.toFixed(1) + "%"
    );
  }

  // Impact summary
  console.log("\n── STOCH IMPACT ──\n");
  const pairs = [
    ["V3", acc.v3Base, acc.v3Stoch],
    ["Sentiment", acc.sentBase, acc.sentStoch],
    ["Dealer", acc.dealerBase, acc.dealerStoch],
    ["Commercial", acc.commBase, acc.commStoch],
    ["Neutral (combined)", nCombBase, nCombStoch],
  ];
  console.log("Bias Source".padEnd(22), "Base Net".padEnd(12), "Stoch Net".padEnd(12), "Delta".padEnd(12), "Base WR".padEnd(10), "Stoch WR");
  console.log("-".repeat(75));
  for (const [name, base, stch] of pairs) {
    const bNet = net(base), sNet = net(stch);
    console.log(
      name.padEnd(22),
      fmt(bNet).padEnd(12), fmt(sNet).padEnd(12),
      fmt(sNet - bNet).padEnd(12),
      (wr(base).toFixed(1) + "%").padEnd(10),
      wr(stch).toFixed(1) + "%"
    );
  }

  await pool.end();
}

function fmt(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }

main().catch(e => { console.error(e); pool.end(); });
