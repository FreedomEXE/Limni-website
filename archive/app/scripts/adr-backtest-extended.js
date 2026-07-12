/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-extended.js
 *
 * Description:
 * Extended 26-week ADR backtest — Dealer vs Commercial vs Neutral.
 * Tests whether institutional positioning holds up over 6 months of
 * different market regimes, not just a 9-week sample.
 *
 * Bias sources:
 *   1. Dealer only (COT dealer/intermediary positioning)
 *   2. Commercial only (COT commercial/hedger positioning)
 *   3. Neutral (LONG + SHORT independently)
 *
 * Both baseline and stoch confirmation on each.
 * COT data: cot_snapshots table. M5 data: Oanda API.
 *
 * Usage: node scripts/adr-backtest-extended.js
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

/* ─── Stoch settings ─────────────────────────────────────────── */
const STOCH_K = 100;
const STOCH_SMOOTH = 3;
const OB_LEVEL = 80;
const OS_LEVEL = 20;
const WARMUP_MS = 14 * 3600 * 1000;

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
  let a = null, it = false, tp = 0, ep = 0, adrQualified = false;
  const trades = [];
  for (let i = startIdx; i < bars.length; i++) {
    const b = bars[i];
    const sk = stochK[i];
    if (it) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        trades.push({ exitType: "TP_HIT", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100 });
        it = false; adrQualified = false; a = dir === "LONG" ? b.high : b.low; continue;
      }
      continue;
    }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    if (!adrQualified && (dir === "LONG" ? b.low <= e : b.high >= e)) adrQualified = true;
    if (adrQualified && !it && sk !== null) {
      const confirm = dir === "SHORT" ? sk >= OB_LEVEL : sk <= OS_LEVEL;
      if (confirm) {
        ep = dir === "LONG" ? b.low : b.high;
        tp = dir === "LONG" ? ep + rawAdr * 0.25 : ep - rawAdr * 0.25;
        it = true; adrQualified = false; a = dir === "LONG" ? b.high : b.low;
      }
    }
  }
  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 });
  }
  return trades;
}

/* ─── COT direction derivation ───────────────────────────────── */

const PAIR_CURRENCIES = {};
for (const { pair, ac } of ALL_PAIRS) {
  if (ac === "fx") {
    PAIR_CURRENCIES[pair] = { type: "fx", base: pair.slice(0, 3), quote: pair.slice(3) };
  } else {
    const marketMap = { XAUUSD: "XAU", XAGUSD: "XAG", WTIUSD: "WTI", SPXUSD: "SPX", NDXUSD: "NDX", NIKKEIUSD: "NIKKEI", BTCUSD: "BTC", ETHUSD: "ETH" };
    PAIR_CURRENCIES[pair] = { type: ac, market: marketMap[pair] };
  }
}

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
    return null;
  } else {
    const snap = cotByAc[info.type];
    if (!snap || !snap[info.market]) return null;
    const bias = snap[info.market][model + "_bias"];
    if (bias === "BULLISH") return "LONG";
    if (bias === "BEARISH") return "SHORT";
    return null;
  }
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
function net(acc) { return acc.tpPnl + acc.wcPnl; }
function wr(acc) { return acc.trades > 0 ? (acc.tp / acc.trades * 100) : 0; }
function fmt(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }

/* ─── Main ───────────────────────────────────────────────────── */

async function main() {
  const NUM_WEEKS = 26;
  console.log(`Loading COT data for ${NUM_WEEKS}-week extended backtest...\n`);

  // Load all COT snapshots
  const cotRaw = await pool.query(`
    SELECT report_date::text, asset_class, currencies
    FROM cot_snapshots ORDER BY report_date
  `);
  const cotByDate = {};
  for (const r of cotRaw.rows) {
    if (!cotByDate[r.report_date]) cotByDate[r.report_date] = {};
    cotByDate[r.report_date][r.asset_class] = r.currencies;
  }
  const allDates = Object.keys(cotByDate).sort();
  // Take the most recent NUM_WEEKS, excluding the current week (last one)
  const testDates = allDates.slice(-(NUM_WEEKS + 1), -1);
  console.log(`  COT: ${allDates.length} total weeks, testing ${testDates.length} (${testDates[0]} → ${testDates[testDates.length - 1]})`);

  // Derive week open from COT report_date (Tuesday → previous Sunday at 00:00 UTC)
  function weekOpenFromReport(reportDate) {
    const rd = new Date(reportDate + "T00:00:00Z");
    const day = rd.getUTCDay(); // Tuesday = 2
    return new Date(rd.getTime() - day * 24 * 3600 * 1000);
  }

  // Accumulators
  const acc = {
    dealerBase: makeAcc(), dealerStoch: makeAcc(),
    commBase: makeAcc(), commStoch: makeAcc(),
    nLongBase: makeAcc(), nLongStoch: makeAcc(),
    nShortBase: makeAcc(), nShortStoch: makeAcc(),
  };
  const weekDetail = [];
  let skippedPairWeeks = 0;

  for (let wi = 0; wi < testDates.length; wi++) {
    const reportDate = testDates[wi];
    const cotSnap = cotByDate[reportDate];
    const weekOpen = weekOpenFromReport(reportDate);
    const weekOpenMs = weekOpen.getTime();

    const wk = {
      dealerBase: makeAcc(), dealerStoch: makeAcc(),
      commBase: makeAcc(), commStoch: makeAcc(),
      nLongBase: makeAcc(), nLongStoch: makeAcc(),
      nShortBase: makeAcc(), nShortStoch: makeAcc(),
    };
    let pairsProcessed = 0;

    for (const { pair, inst, ac } of ALL_PAIRS) {
      const isFx = ac === "fx";
      const weekStartMs = weekOpenMs - (isFx ? 2 : 1) * 3600000;
      const weekCloseMs = weekStartMs + 5 * 24 * 3600000;
      const warmupStartUtc = new Date(weekStartMs - WARMUP_MS).toISOString();
      const weekStartUtc = new Date(weekStartMs).toISOString();

      const adr = await fetchDailyAdr(inst, weekStartUtc, isFx ? 17 : 18);
      if (!adr) { skippedPairWeeks++; continue; }
      const allBars = await fetchAllM5(inst, warmupStartUtc);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (bars.length === 0) { skippedPairWeeks++; continue; }

      const weekStartIdx = bars.findIndex(b => b.ts >= weekStartMs);
      if (weekStartIdx < 0) { skippedPairWeeks++; continue; }

      const stochK = computeStochK(bars);
      pairsProcessed++;

      // Dealer
      const dealerDir = cotDirection(pair, cotSnap, "dealer");
      if (dealerDir) {
        addTrades(wk.dealerBase, scanBaseline(bars, weekStartIdx, dealerDir, adr));
        addTrades(wk.dealerStoch, scanStoch(bars, weekStartIdx, dealerDir, adr, stochK));
      }

      // Commercial
      const commDir = cotDirection(pair, cotSnap, "commercial");
      if (commDir) {
        addTrades(wk.commBase, scanBaseline(bars, weekStartIdx, commDir, adr));
        addTrades(wk.commStoch, scanStoch(bars, weekStartIdx, commDir, adr, stochK));
      }

      // Neutral
      addTrades(wk.nLongBase, scanBaseline(bars, weekStartIdx, "LONG", adr));
      addTrades(wk.nLongStoch, scanStoch(bars, weekStartIdx, "LONG", adr, stochK));
      addTrades(wk.nShortBase, scanBaseline(bars, weekStartIdx, "SHORT", adr));
      addTrades(wk.nShortStoch, scanStoch(bars, weekStartIdx, "SHORT", adr, stochK));

      await new Promise(r => setTimeout(r, 100));
    }

    // Merge
    for (const key of Object.keys(acc)) {
      acc[key].trades += wk[key].trades;
      acc[key].tp += wk[key].tp;
      acc[key].wc += wk[key].wc;
      acc[key].tpPnl += wk[key].tpPnl;
      acc[key].wcPnl += wk[key].wcPnl;
    }

    const label = reportDate.slice(5);
    const nBase = net(wk.nLongBase) + net(wk.nShortBase);
    const nStoch = net(wk.nLongStoch) + net(wk.nShortStoch);
    weekDetail.push({ label, reportDate, wk, pairsProcessed });
    console.log(`  [${wi + 1}/${testDates.length}] ${label} (${pairsProcessed} pairs): Dealer ${fmt(net(wk.dealerBase))}→${fmt(net(wk.dealerStoch))} | Comm ${fmt(net(wk.commBase))}→${fmt(net(wk.commStoch))} | Neut ${fmt(nBase)}→${fmt(nStoch)}`);
  }

  // ─── Results ──────────────────────────────────────────────────
  const nCombBase = { trades: acc.nLongBase.trades + acc.nShortBase.trades, tp: acc.nLongBase.tp + acc.nShortBase.tp, wc: acc.nLongBase.wc + acc.nShortBase.wc, tpPnl: acc.nLongBase.tpPnl + acc.nShortBase.tpPnl, wcPnl: acc.nLongBase.wcPnl + acc.nShortBase.wcPnl };
  const nCombStoch = { trades: acc.nLongStoch.trades + acc.nShortStoch.trades, tp: acc.nLongStoch.tp + acc.nShortStoch.tp, wc: acc.nLongStoch.wc + acc.nShortStoch.wc, tpPnl: acc.nLongStoch.tpPnl + acc.nShortStoch.tpPnl, wcPnl: acc.nLongStoch.wcPnl + acc.nShortStoch.wcPnl };

  console.log("\n" + "=".repeat(95));
  console.log(`  EXTENDED ${NUM_WEEKS}-WEEK BACKTEST — DEALER vs COMMERCIAL vs NEUTRAL`);
  console.log(`  Period: ${testDates[0]} → ${testDates[testDates.length - 1]}`);
  console.log(`  Stoch: K=${STOCH_K} Smooth=${STOCH_SMOOTH} OB=${OB_LEVEL} OS=${OS_LEVEL}`);
  console.log(`  Skipped pair-weeks (no Oanda data): ${skippedPairWeeks}`);
  console.log("=".repeat(95));

  // Per-week table
  console.log("\n── PER-WEEK NET RETURNS (baseline → stoch) ──\n");
  console.log("Week".padEnd(8), "Pairs".padEnd(6), "Dealer".padEnd(22), "Commercial".padEnd(22), "Neutral".padEnd(22));
  console.log("-".repeat(80));
  for (const { label, wk, pairsProcessed } of weekDetail) {
    const nBase = net(wk.nLongBase) + net(wk.nShortBase);
    const nStoch = net(wk.nLongStoch) + net(wk.nShortStoch);
    const fmtP = (b, s) => fmt(b) + "→" + fmt(s);
    console.log(label.padEnd(8), String(pairsProcessed).padEnd(6),
      fmtP(net(wk.dealerBase), net(wk.dealerStoch)).padEnd(22),
      fmtP(net(wk.commBase), net(wk.commStoch)).padEnd(22),
      fmtP(nBase, nStoch).padEnd(22));
  }

  // Cumulative running total
  console.log("\n── CUMULATIVE RETURN BY WEEK ──\n");
  let cumDealer = 0, cumDealerS = 0, cumComm = 0, cumCommS = 0, cumNeut = 0, cumNeutS = 0;
  console.log("Week".padEnd(8), "Dealer".padEnd(12), "Dealer+S".padEnd(12), "Comm".padEnd(12), "Comm+S".padEnd(12), "Neutral".padEnd(12), "Neut+S");
  console.log("-".repeat(72));
  for (const { label, wk } of weekDetail) {
    cumDealer += net(wk.dealerBase); cumDealerS += net(wk.dealerStoch);
    cumComm += net(wk.commBase); cumCommS += net(wk.commStoch);
    const nB = net(wk.nLongBase) + net(wk.nShortBase);
    const nS = net(wk.nLongStoch) + net(wk.nShortStoch);
    cumNeut += nB; cumNeutS += nS;
    console.log(label.padEnd(8), fmt(cumDealer).padEnd(12), fmt(cumDealerS).padEnd(12), fmt(cumComm).padEnd(12), fmt(cumCommS).padEnd(12), fmt(cumNeut).padEnd(12), fmt(cumNeutS));
  }

  // Summary
  console.log("\n── SUMMARY ──\n");
  const variants = [
    ["Dealer Baseline", acc.dealerBase],
    ["Dealer + Stoch", acc.dealerStoch],
    ["Commercial Baseline", acc.commBase],
    ["Commercial + Stoch", acc.commStoch],
    ["Neutral Baseline", nCombBase],
    ["Neutral + Stoch", nCombStoch],
    ["  (Neutral LONG)", acc.nLongBase],
    ["  (Neutral LONG+S)", acc.nLongStoch],
    ["  (Neutral SHORT)", acc.nShortBase],
    ["  (Neutral SHORT+S)", acc.nShortStoch],
  ];

  console.log("Variant".padEnd(22), "Trades".padEnd(8), "TP".padEnd(6), "WC".padEnd(6), "TP Pnl".padEnd(12), "WC Pnl".padEnd(12), "Net".padEnd(12), "WR");
  console.log("-".repeat(88));
  for (const [name, a] of variants) {
    console.log(
      name.padEnd(22), String(a.trades).padEnd(8), String(a.tp).padEnd(6), String(a.wc).padEnd(6),
      ("+" + a.tpPnl.toFixed(2) + "%").padEnd(12), (a.wcPnl.toFixed(2) + "%").padEnd(12),
      ((net(a) >= 0 ? "+" : "") + net(a).toFixed(2) + "%").padEnd(12), wr(a).toFixed(1) + "%"
    );
  }

  // Stoch impact
  console.log("\n── STOCH IMPACT ──\n");
  const impact = [
    ["Dealer", acc.dealerBase, acc.dealerStoch],
    ["Commercial", acc.commBase, acc.commStoch],
    ["Neutral (combined)", nCombBase, nCombStoch],
  ];
  console.log("Bias Source".padEnd(22), "Base Net".padEnd(12), "Stoch Net".padEnd(12), "Delta".padEnd(12), "Base WR".padEnd(10), "Stoch WR");
  console.log("-".repeat(75));
  for (const [name, base, stch] of impact) {
    console.log(name.padEnd(22), fmt(net(base)).padEnd(12), fmt(net(stch)).padEnd(12), fmt(net(stch) - net(base)).padEnd(12), (wr(base).toFixed(1) + "%").padEnd(10), wr(stch).toFixed(1) + "%");
  }

  // Per-week annualized
  const weeksCount = testDates.length;
  console.log("\n── ANNUALIZED (extrapolated from " + weeksCount + " weeks) ──\n");
  for (const [name, base, stch] of impact) {
    const baseAnn = net(base) / weeksCount * 52;
    const stochAnn = net(stch) / weeksCount * 52;
    console.log(name.padEnd(22), "Base: " + fmt(baseAnn) + "/yr", "  Stoch: " + fmt(stochAnn) + "/yr");
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
