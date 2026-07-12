/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-tandem.js
 *
 * Description:
 * Tests running dealer, commercial, and sentiment as 3 independent portfolios
 * simultaneously (tandem mode) vs 2-of-3 agreement filter.
 *
 * Tandem: each model operates independently. A pair can have conflicting
 * positions from different models. Combined P&L = sum of all 3 portfolios.
 *
 * Outputs: per-week equity curve, per-pair breakdown, per-asset-class breakdown,
 * drawdowns, worst weeks, hedging effect analysis.
 *
 * All with stoch confirmation. 9 weeks, 36 pairs.
 *
 * Usage: node scripts/adr-backtest-tandem.js
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

/* ─── Oanda + Stoch + Scanner (same as other scripts) ────────── */

async function fetchAllM5(inst, fromUtc) {
  const bars = []; let cursor = fromUtc;
  for (let page = 0; page < 20; page++) {
    const r = await fetch(`${BASE}/v3/instruments/${inst}/candles?price=M&granularity=M5&from=${cursor}&count=500`, { headers: { Authorization: "Bearer " + KEY } });
    const d = await r.json(); const b = (d.candles || []).filter(c => c.complete && c.mid);
    if (!b.length) break;
    for (const c of b) bars.push({ ts: new Date(c.time).getTime(), high: +c.mid.h, low: +c.mid.l, close: +c.mid.c });
    cursor = new Date(new Date(b[b.length - 1].time).getTime() + 1000).toISOString();
    if (b.length < 500) break; await new Promise(r => setTimeout(r, 80));
  }
  return bars;
}

async function fetchDailyAdr(inst, beforeUtc, alignment) {
  const from = new Date(new Date(beforeUtc).getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const r = await fetch(`${BASE}/v3/instruments/${inst}/candles?price=M&granularity=D&from=${from}&count=500&dailyAlignment=${alignment}&alignmentTimezone=America%2FNew_York`, { headers: { Authorization: "Bearer " + KEY } });
  const d = await r.json();
  const bars = (d.candles || []).filter(c => c.complete && c.mid && new Date(c.time) < new Date(beforeUtc));
  const s = bars.slice(0, -1), l = s.slice(-10);
  if (l.length < 5) return null;
  return l.reduce((s, c) => (+c.mid.h) - (+c.mid.l) + s, 0) / l.length;
}

function sma(v, len) { const o = new Array(v.length).fill(null); let s = 0, c = 0; for (let i = 0; i < v.length; i++) { if (v[i] !== null) { s += v[i]; c++; } if (i >= len && v[i - len] !== null) { s -= v[i - len]; c--; } if (i >= len - 1 && c === len) o[i] = s / len; } return o; }

function computeStochK(bars) {
  const raw = new Array(bars.length).fill(null);
  for (let i = STOCH_K - 1; i < bars.length; i++) {
    let lo = Infinity, hi = -Infinity;
    for (let j = i - STOCH_K + 1; j <= i; j++) { lo = Math.min(lo, bars[j].low); hi = Math.max(hi, bars[j].high); }
    raw[i] = hi === lo ? 0 : 100 * (bars[i].close - lo) / (hi - lo);
  }
  return sma(raw, STOCH_SMOOTH);
}

function scanStoch(bars, startIdx, dir, rawAdr, stochK) {
  let a = null, it = false, tp = 0, ep = 0, adrQ = false;
  const trades = [];
  for (let i = startIdx; i < bars.length; i++) {
    const b = bars[i], sk = stochK[i];
    if (it) { if (dir === "LONG" ? b.high >= tp : b.low <= tp) { trades.push({ exitType: "TP_HIT", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100 }); it = false; adrQ = false; a = dir === "LONG" ? b.high : b.low; continue; } continue; }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a; a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    if (!adrQ && (dir === "LONG" ? b.low <= e : b.high >= e)) adrQ = true;
    if (adrQ && !it && sk !== null) { if (dir === "SHORT" ? sk >= OB_LEVEL : sk <= OS_LEVEL) { ep = dir === "LONG" ? b.low : b.high; tp = dir === "LONG" ? ep + rawAdr * 0.25 : ep - rawAdr * 0.25; it = true; adrQ = false; a = dir === "LONG" ? b.high : b.low; } }
  }
  if (it) { const lc = bars[bars.length - 1].close; trades.push({ exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 }); }
  return trades;
}

/* ─── Direction derivation ───────────────────────────────────── */

const PC = {};
for (const { pair, ac } of ALL_PAIRS) {
  if (ac === "fx") PC[pair] = { type: "fx", base: pair.slice(0, 3), quote: pair.slice(3) };
  else { const m = { XAUUSD: "XAU", XAGUSD: "XAG", WTIUSD: "WTI", SPXUSD: "SPX", NDXUSD: "NDX", NIKKEIUSD: "NIKKEI", BTCUSD: "BTC", ETHUSD: "ETH" }; PC[pair] = { type: ac, market: m[pair] }; }
}

function cotDir(pair, snap, model) {
  const info = PC[pair]; if (!info) return null;
  if (info.type === "fx") { const s = snap?.["fx"]; if (!s) return null; const bb = s[info.base]?.[model + "_bias"], qb = s[info.quote]?.[model + "_bias"]; if (!bb || !qb) return null; if (bb === "BULLISH" && qb === "BEARISH") return "LONG"; if (bb === "BEARISH" && qb === "BULLISH") return "SHORT"; return null; }
  const bias = snap?.[info.type]?.[info.market]?.[model + "_bias"]; if (bias === "BULLISH") return "LONG"; if (bias === "BEARISH") return "SHORT"; return null;
}

function sentDir(agg) {
  if (!agg) return null;
  if (agg.flip_state === "FLIPPED_UP") return "LONG"; if (agg.flip_state === "FLIPPED_DOWN") return "SHORT"; if (agg.flip_state === "FLIPPED_NEUTRAL") return null;
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT"; if (agg.crowding_state === "CROWDED_SHORT") return "LONG"; return null;
}

function agree2of3(d1, d2, d3) {
  const v = [d1, d2, d3].filter(Boolean); if (v.length < 2) return null;
  const l = v.filter(x => x === "LONG").length; if (l >= 2) return "LONG";
  if (v.filter(x => x === "SHORT").length >= 2) return "SHORT"; return null;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function fmt(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
function tradePnl(trades) { return trades.reduce((s, t) => s + t.pnl, 0); }

/* ─── Main ───────────────────────────────────────────────────── */

async function main() {
  console.log("Loading data...\n");

  // Sentiment
  const allAggs = await pool.query(`SELECT symbol, crowding_state, flip_state, timestamp_utc FROM sentiment_aggregates ORDER BY timestamp_utc ASC`);
  const aggs = allAggs.rows.map(r => ({ symbol: r.symbol, crowding_state: r.crowding_state, flip_state: r.flip_state, ts: new Date(r.timestamp_utc).getTime() }));
  const bySymbol = {}; for (const a of aggs) { if (!bySymbol[a.symbol]) bySymbol[a.symbol] = []; bySymbol[a.symbol].push(a); }
  function resolveSent(ms) { const r = {}; for (const [s, rows] of Object.entries(bySymbol)) { let lb = null, fa = null; for (const x of rows) { if (x.ts <= ms) lb = x; if (x.ts > ms && !fa) fa = x; if (fa) break; } if (lb || fa) r[s] = lb || fa; } return r; }

  const weeks = await pool.query(`SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`);
  const cotRaw = await pool.query(`SELECT report_date::text, asset_class, currencies FROM cot_snapshots WHERE report_date >= '2026-01-20' AND report_date <= '2026-03-17' ORDER BY report_date`);
  const cotByDate = {}; for (const r of cotRaw.rows) { if (!cotByDate[r.report_date]) cotByDate[r.report_date] = {}; cotByDate[r.report_date][r.asset_class] = r.currencies; }
  const cotDates = Object.keys(cotByDate).sort();
  function findCot(ms) { for (const rd of cotDates) { const d = (new Date(rd + "T00:00:00Z").getTime() - ms) / (24 * 3600000); if (d >= 0 && d <= 4) return cotByDate[rd]; } return null; }

  console.log(`  ${weeks.rows.length} weeks, ${aggs.length} sentiment rows, ${cotDates.length} COT weeks\n`);

  // Track per-pair, per-week, per-model results
  const pairResults = {}; // pair → { dealer: totalPnl, comm: totalPnl, sent: totalPnl, tandem: totalPnl, agree2: totalPnl }
  const weekData = []; // per-week full breakdown

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const weekOpenMs = new Date(weekOpenUtc).getTime();
    const sentMap = resolveSent(weekOpenMs);
    const cotSnap = findCot(weekOpenMs);

    const wk = { label: "", dealer: 0, comm: 0, sent: 0, tandem: 0, agree2: 0,
      dealerTrades: 0, commTrades: 0, sentTrades: 0, tandemTrades: 0, agree2Trades: 0,
      dealerTP: 0, commTP: 0, sentTP: 0, tandemTP: 0, agree2TP: 0,
      pairBreakdown: [], acBreakdown: { fx: { tandem: 0, agree2: 0 }, commodities: { tandem: 0, agree2: 0 }, indices: { tandem: 0, agree2: 0 }, crypto: { tandem: 0, agree2: 0 } },
      conflicting: 0, aligned: 0, singleSignal: 0, noSignal: 0 };

    for (const { pair, inst, ac } of ALL_PAIRS) {
      const isFx = ac === "fx";
      const weekStartMs = weekOpenMs - (isFx ? 2 : 1) * 3600000;
      const weekCloseMs = weekStartMs + 5 * 24 * 3600000;
      const warmupUtc = new Date(weekStartMs - WARMUP_MS).toISOString();
      const weekStartUtc = new Date(weekStartMs).toISOString();

      const dDir = cotSnap ? cotDir(pair, cotSnap, "dealer") : null;
      const cDir = cotSnap ? cotDir(pair, cotSnap, "commercial") : null;
      const sDir = sentDir(sentMap[pair]);
      const a2Dir = agree2of3(dDir, cDir, sDir);

      const signals = [dDir, cDir, sDir].filter(Boolean);
      const uniqueDirs = [...new Set(signals)];
      if (signals.length === 0) { wk.noSignal++; continue; }
      if (signals.length >= 2 && uniqueDirs.length > 1) wk.conflicting++;
      else if (signals.length >= 2) wk.aligned++;
      else wk.singleSignal++;

      // Fetch data ONCE
      const adr = await fetchDailyAdr(inst, weekStartUtc, isFx ? 17 : 18);
      if (!adr) continue;
      const allBars = await fetchAllM5(inst, warmupUtc);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (!bars.length) continue;
      const si = bars.findIndex(b => b.ts >= weekStartMs);
      if (si < 0) continue;
      const stochK = computeStochK(bars);

      // Run each model independently
      const dTrades = dDir ? scanStoch(bars, si, dDir, adr, stochK) : [];
      const cTrades = cDir ? scanStoch(bars, si, cDir, adr, stochK) : [];
      const sTrades = sDir ? scanStoch(bars, si, sDir, adr, stochK) : [];
      const a2Trades = a2Dir ? scanStoch(bars, si, a2Dir, adr, stochK) : [];

      const dPnl = tradePnl(dTrades), cPnl = tradePnl(cTrades), sPnl = tradePnl(sTrades);
      const tandemPnl = dPnl + cPnl + sPnl;
      const a2Pnl = tradePnl(a2Trades);

      // Accumulate per-model
      wk.dealer += dPnl; wk.comm += cPnl; wk.sent += sPnl;
      wk.tandem += tandemPnl; wk.agree2 += a2Pnl;
      wk.dealerTrades += dTrades.length; wk.commTrades += cTrades.length; wk.sentTrades += sTrades.length;
      wk.tandemTrades += dTrades.length + cTrades.length + sTrades.length; wk.agree2Trades += a2Trades.length;
      wk.dealerTP += dTrades.filter(t => t.exitType === "TP_HIT").length;
      wk.commTP += cTrades.filter(t => t.exitType === "TP_HIT").length;
      wk.sentTP += sTrades.filter(t => t.exitType === "TP_HIT").length;
      wk.tandemTP += dTrades.filter(t => t.exitType === "TP_HIT").length + cTrades.filter(t => t.exitType === "TP_HIT").length + sTrades.filter(t => t.exitType === "TP_HIT").length;
      wk.agree2TP += a2Trades.filter(t => t.exitType === "TP_HIT").length;

      // Asset class
      if (wk.acBreakdown[ac]) { wk.acBreakdown[ac].tandem += tandemPnl; wk.acBreakdown[ac].agree2 += a2Pnl; }

      // Per-pair tracking
      if (!pairResults[pair]) pairResults[pair] = { ac, dealer: 0, comm: 0, sent: 0, tandem: 0, agree2: 0 };
      pairResults[pair].dealer += dPnl; pairResults[pair].comm += cPnl; pairResults[pair].sent += sPnl;
      pairResults[pair].tandem += tandemPnl; pairResults[pair].agree2 += a2Pnl;

      // Per-pair for this week
      if (tandemPnl !== 0 || a2Pnl !== 0) {
        wk.pairBreakdown.push({
          pair, ac, dDir, cDir, sDir, a2Dir,
          dPnl, cPnl, sPnl, tandemPnl, a2Pnl,
          dTrades: dTrades.length, cTrades: cTrades.length, sTrades: sTrades.length, a2Trades: a2Trades.length
        });
      }

      await new Promise(r => setTimeout(r, 100));
    }

    wk.label = new Date(weekOpenMs + 86400000).toISOString().slice(5, 10);
    weekData.push(wk);
    console.log(`  ${wk.label}: Tandem ${fmt(wk.tandem)} (${wk.tandemTrades}t) | 2of3 ${fmt(wk.agree2)} (${wk.agree2Trades}t) | conflict:${wk.conflicting} aligned:${wk.aligned} single:${wk.singleSignal} none:${wk.noSignal}`);
  }

  // ─── Results ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(100));
  console.log("  TANDEM vs AGREEMENT — 9 WEEKS, 36 PAIRS (all with Stoch)");
  console.log("  Tandem = dealer + commercial + sentiment running independently, combined P&L");
  console.log("  Agreement = only trade when 2-of-3 models agree on direction");
  console.log("=".repeat(100));

  // Weekly equity curve + drawdown
  console.log("\n── WEEKLY EQUITY CURVE & DRAWDOWN ──\n");
  let cumTandem = 0, cumAgree = 0, peakTandem = 0, peakAgree = 0, maxDdTandem = 0, maxDdAgree = 0;
  console.log("Week".padEnd(7), "Tandem Wk".padEnd(12), "Tandem Cum".padEnd(12), "Tandem DD".padEnd(11),
    "2of3 Wk".padEnd(12), "2of3 Cum".padEnd(12), "2of3 DD".padEnd(11), "Trades(T/A)");
  console.log("-".repeat(95));
  for (const w of weekData) {
    cumTandem += w.tandem; cumAgree += w.agree2;
    peakTandem = Math.max(peakTandem, cumTandem); peakAgree = Math.max(peakAgree, cumAgree);
    const ddT = cumTandem - peakTandem; const ddA = cumAgree - peakAgree;
    maxDdTandem = Math.min(maxDdTandem, ddT); maxDdAgree = Math.min(maxDdAgree, ddA);
    console.log(w.label.padEnd(7),
      fmt(w.tandem).padEnd(12), fmt(cumTandem).padEnd(12), fmt(ddT).padEnd(11),
      fmt(w.agree2).padEnd(12), fmt(cumAgree).padEnd(12), fmt(ddA).padEnd(11),
      (w.tandemTrades + "/" + w.agree2Trades));
  }
  console.log("-".repeat(95));
  console.log("Max DD".padEnd(7), "".padEnd(24), fmt(maxDdTandem).padEnd(11), "".padEnd(24), fmt(maxDdAgree));

  // Summary comparison
  const tandemTotal = weekData.reduce((s, w) => ({ pnl: s.pnl + w.tandem, trades: s.trades + w.tandemTrades, tp: s.tp + w.tandemTP }), { pnl: 0, trades: 0, tp: 0 });
  const agreeTotal = weekData.reduce((s, w) => ({ pnl: s.pnl + w.agree2, trades: s.trades + w.agree2Trades, tp: s.tp + w.agree2TP }), { pnl: 0, trades: 0, tp: 0 });

  console.log("\n── SUMMARY ──\n");
  console.log("".padEnd(20), "Tandem (3 indep)".padEnd(22), "2-of-3 Agreement");
  console.log("-".repeat(58));
  console.log("Net Return".padEnd(20), fmt(tandemTotal.pnl).padEnd(22), fmt(agreeTotal.pnl));
  console.log("Trades".padEnd(20), String(tandemTotal.trades).padEnd(22), agreeTotal.trades);
  console.log("TP Hits".padEnd(20), String(tandemTotal.tp).padEnd(22), agreeTotal.tp);
  console.log("Win Rate".padEnd(20), ((tandemTotal.tp / tandemTotal.trades * 100).toFixed(1) + "%").padEnd(22), (agreeTotal.tp / agreeTotal.trades * 100).toFixed(1) + "%");
  console.log("Return/Trade".padEnd(20), (tandemTotal.pnl / tandemTotal.trades).toFixed(3) + "%/t".padEnd(22), (agreeTotal.pnl / agreeTotal.trades).toFixed(3) + "%/t");
  console.log("Max Drawdown".padEnd(20), fmt(maxDdTandem).padEnd(22), fmt(maxDdAgree));
  console.log("Losing Weeks".padEnd(20), (weekData.filter(w => w.tandem < 0).length + "/9").padEnd(22), weekData.filter(w => w.agree2 < 0).length + "/9");
  console.log("Worst Week".padEnd(20), fmt(Math.min(...weekData.map(w => w.tandem))).padEnd(22), fmt(Math.min(...weekData.map(w => w.agree2))));

  // Per-model contribution to tandem
  console.log("\n── PER-MODEL CONTRIBUTION (Stoch, within Tandem) ──\n");
  const dTotal = weekData.reduce((s, w) => s + w.dealer, 0);
  const cTotal = weekData.reduce((s, w) => s + w.comm, 0);
  const sTotal = weekData.reduce((s, w) => s + w.sent, 0);
  console.log("Dealer:".padEnd(15), fmt(dTotal), `(${((dTotal / tandemTotal.pnl) * 100).toFixed(0)}% of tandem)`);
  console.log("Commercial:".padEnd(15), fmt(cTotal), `(${((cTotal / tandemTotal.pnl) * 100).toFixed(0)}% of tandem)`);
  console.log("Sentiment:".padEnd(15), fmt(sTotal), `(${((sTotal / tandemTotal.pnl) * 100).toFixed(0)}% of tandem)`);

  // Signal alignment analysis
  console.log("\n── SIGNAL ALIGNMENT (per pair-week) ──\n");
  const totConflict = weekData.reduce((s, w) => s + w.conflicting, 0);
  const totAligned = weekData.reduce((s, w) => s + w.aligned, 0);
  const totSingle = weekData.reduce((s, w) => s + w.singleSignal, 0);
  const totNone = weekData.reduce((s, w) => s + w.noSignal, 0);
  console.log("Conflicting (models disagree): ", totConflict, "pair-weeks");
  console.log("Aligned (2+ agree):            ", totAligned, "pair-weeks");
  console.log("Single signal only:            ", totSingle, "pair-weeks");
  console.log("No signal:                     ", totNone, "pair-weeks");

  // Per asset class
  console.log("\n── PER ASSET CLASS (9-week total, Stoch) ──\n");
  const acTotals = { fx: { tandem: 0, agree2: 0 }, commodities: { tandem: 0, agree2: 0 }, indices: { tandem: 0, agree2: 0 }, crypto: { tandem: 0, agree2: 0 } };
  for (const w of weekData) { for (const [ac, v] of Object.entries(w.acBreakdown)) { acTotals[ac].tandem += v.tandem; acTotals[ac].agree2 += v.agree2; } }
  console.log("Asset Class".padEnd(15), "Tandem".padEnd(14), "2-of-3 Agree");
  console.log("-".repeat(42));
  for (const [ac, v] of Object.entries(acTotals)) { console.log(ac.padEnd(15), fmt(v.tandem).padEnd(14), fmt(v.agree2)); }

  // Per-pair breakdown (sorted by tandem P&L)
  console.log("\n── PER-PAIR BREAKDOWN (9-week total, Stoch) ──\n");
  const sorted = Object.entries(pairResults).sort((a, b) => b[1].tandem - a[1].tandem);
  console.log("Pair".padEnd(12), "AC".padEnd(6), "Dealer".padEnd(10), "Comm".padEnd(10), "Sent".padEnd(10), "Tandem".padEnd(10), "2of3");
  console.log("-".repeat(68));
  for (const [pair, d] of sorted) {
    console.log(pair.padEnd(12), d.ac.slice(0, 5).padEnd(6),
      fmt(d.dealer).padEnd(10), fmt(d.comm).padEnd(10), fmt(d.sent).padEnd(10),
      fmt(d.tandem).padEnd(10), fmt(d.agree2));
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
