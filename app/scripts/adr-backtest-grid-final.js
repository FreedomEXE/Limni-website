/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-grid-final.js
 *
 * Description:
 * Grid overlay on Tandem and 2-of-3 Agreement — the two best strategies.
 * Stoch confirms first entry, grid auto-adds at deeper levels.
 * Net profit TP closes all positions. Fresh Start after.
 *
 * Grid config: 0.25 ADR step, 2x ADR max depth (max 5 positions)
 * Tests both 0.25x and 0.5x net TP multipliers.
 *
 * Usage: node scripts/adr-backtest-grid-final.js
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
const BASE_URL = "https://api-fxtrade.oanda.com";

const STOCH_K = 100, STOCH_SMOOTH = 3, OB = 80, OS = 20;
const WARMUP_MS = 14 * 3600 * 1000;
const GRID_STEP = 0.25;
const MAX_DEPTH = 2.0; // max 5 positions (1.0, 1.25, 1.5, 1.75, 2.0)
const TP_MULTS = [0.25, 0.5]; // test both

const ALL_PAIRS = [
  { pair: "AUDCAD", inst: "AUD_CAD", ac: "fx" }, { pair: "AUDCHF", inst: "AUD_CHF", ac: "fx" },
  { pair: "AUDJPY", inst: "AUD_JPY", ac: "fx" }, { pair: "AUDNZD", inst: "AUD_NZD", ac: "fx" },
  { pair: "AUDUSD", inst: "AUD_USD", ac: "fx" }, { pair: "CADCHF", inst: "CAD_CHF", ac: "fx" },
  { pair: "CADJPY", inst: "CAD_JPY", ac: "fx" }, { pair: "CHFJPY", inst: "CHF_JPY", ac: "fx" },
  { pair: "EURAUD", inst: "EUR_AUD", ac: "fx" }, { pair: "EURCAD", inst: "EUR_CAD", ac: "fx" },
  { pair: "EURCHF", inst: "EUR_CHF", ac: "fx" }, { pair: "EURGBP", inst: "EUR_GBP", ac: "fx" },
  { pair: "EURJPY", inst: "EUR_JPY", ac: "fx" }, { pair: "EURNZD", inst: "EUR_NZD", ac: "fx" },
  { pair: "EURUSD", inst: "EUR_USD", ac: "fx" }, { pair: "GBPAUD", inst: "GBP_AUD", ac: "fx" },
  { pair: "GBPCAD", inst: "GBP_CAD", ac: "fx" }, { pair: "GBPCHF", inst: "GBP_CHF", ac: "fx" },
  { pair: "GBPJPY", inst: "GBP_JPY", ac: "fx" }, { pair: "GBPNZD", inst: "GBP_NZD", ac: "fx" },
  { pair: "GBPUSD", inst: "GBP_USD", ac: "fx" }, { pair: "NZDCAD", inst: "NZD_CAD", ac: "fx" },
  { pair: "NZDCHF", inst: "NZD_CHF", ac: "fx" }, { pair: "NZDJPY", inst: "NZD_JPY", ac: "fx" },
  { pair: "NZDUSD", inst: "NZD_USD", ac: "fx" }, { pair: "USDCAD", inst: "USD_CAD", ac: "fx" },
  { pair: "USDCHF", inst: "USD_CHF", ac: "fx" }, { pair: "USDJPY", inst: "USD_JPY", ac: "fx" },
  { pair: "BTCUSD", inst: "BTC_USD", ac: "crypto" }, { pair: "ETHUSD", inst: "ETH_USD", ac: "crypto" },
  { pair: "WTIUSD", inst: "WTICO_USD", ac: "commodities" }, { pair: "XAGUSD", inst: "XAG_USD", ac: "commodities" },
  { pair: "XAUUSD", inst: "XAU_USD", ac: "commodities" }, { pair: "SPXUSD", inst: "SPX500_USD", ac: "indices" },
  { pair: "NDXUSD", inst: "NAS100_USD", ac: "indices" }, { pair: "NIKKEIUSD", inst: "JP225_USD", ac: "indices" },
];

/* ─── Oanda + Stoch ──────────────────────────────────────────── */

async function fetchAllM5(inst, fromUtc) {
  const bars = []; let cursor = fromUtc;
  for (let p = 0; p < 20; p++) {
    const r = await fetch(`${BASE_URL}/v3/instruments/${inst}/candles?price=M&granularity=M5&from=${cursor}&count=500`, { headers: { Authorization: "Bearer " + KEY } });
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
  const r = await fetch(`${BASE_URL}/v3/instruments/${inst}/candles?price=M&granularity=D&from=${from}&count=500&dailyAlignment=${alignment}&alignmentTimezone=America%2FNew_York`, { headers: { Authorization: "Bearer " + KEY } });
  const d = await r.json();
  const bars = (d.candles || []).filter(c => c.complete && c.mid && new Date(c.time) < new Date(beforeUtc));
  const s = bars.slice(0, -1), l = s.slice(-10);
  return l.length < 5 ? null : l.reduce((s, c) => (+c.mid.h) - (+c.mid.l) + s, 0) / l.length;
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

/* ─── Scanners ───────────────────────────────────────────────── */

// Plain stoch (no grid) — for reference
function scanStoch(bars, si, dir, adr, sk) {
  let a = null, it = false, tp = 0, ep = 0, adrQ = false;
  const trades = [];
  for (let i = si; i < bars.length; i++) {
    const b = bars[i], k = sk[i];
    if (it) { if (dir === "LONG" ? b.high >= tp : b.low <= tp) { trades.push({ et: "TP", pnl: dir === "LONG" ? (tp - ep) / ep * 100 : (ep - tp) / ep * 100 }); it = false; adrQ = false; a = dir === "LONG" ? b.high : b.low; continue; } continue; }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a; a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - adr : pr + adr;
    if (!adrQ && (dir === "LONG" ? b.low <= e : b.high >= e)) adrQ = true;
    if (adrQ && !it && k !== null) { if (dir === "SHORT" ? k >= OB : k <= OS) { ep = dir === "LONG" ? b.low : b.high; tp = dir === "LONG" ? ep + adr * 0.25 : ep - adr * 0.25; it = true; adrQ = false; a = dir === "LONG" ? b.high : b.low; } }
  }
  if (it) { const lc = bars[bars.length - 1].close; trades.push({ et: "WC", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 }); }
  return trades;
}

// Stoch + Grid: stoch confirms first entry, grid auto-adds at deeper levels
function scanStochGrid(bars, si, dir, adr, sk, tpMult) {
  let anchor = null, adrQ = false;
  let frozenAnchor = 0, positions = [], nextGridLevel = 1 + GRID_STEP;
  const results = []; // { posCount, totalPnl, exitType }

  for (let i = si; i < bars.length; i++) {
    const b = bars[i], k = sk[i];

    if (positions.length > 0) {
      // Check for new grid entries (auto, no stoch needed)
      if (nextGridLevel <= MAX_DEPTH) {
        const gridEntry = dir === "LONG"
          ? frozenAnchor - adr * nextGridLevel
          : frozenAnchor + adr * nextGridLevel;
        if (dir === "LONG" ? b.low <= gridEntry : b.high >= gridEntry) {
          positions.push({ entryPrice: gridEntry });
          nextGridLevel += GRID_STEP;
        }
      }

      // Net TP check
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice, 0) / positions.length;
      const tp = dir === "LONG" ? avgEntry + adr * tpMult : avgEntry - adr * tpMult;
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        const totalPnl = positions.reduce((s, p) => s + (dir === "LONG" ? (tp - p.entryPrice) / p.entryPrice * 100 : (p.entryPrice - tp) / p.entryPrice * 100), 0);
        results.push({ posCount: positions.length, totalPnl, exitType: "TP" });
        positions = []; anchor = dir === "LONG" ? b.high : b.low; adrQ = false; nextGridLevel = 1 + GRID_STEP;
        continue;
      }
      continue;
    }

    // Tracking phase (no positions open)
    if (anchor === null) { anchor = dir === "LONG" ? b.high : b.low; continue; }
    const pr = anchor;
    anchor = dir === "LONG" ? Math.max(anchor, b.high) : Math.min(anchor, b.low);
    const e = dir === "LONG" ? pr - adr : pr + adr;

    // ADR zone qualification
    if (!adrQ && (dir === "LONG" ? b.low <= e : b.high >= e)) adrQ = true;

    // Stoch confirmation for first entry
    if (adrQ && positions.length === 0 && k !== null) {
      if (dir === "SHORT" ? k >= OB : k <= OS) {
        const ep = dir === "LONG" ? b.low : b.high;
        frozenAnchor = pr; // freeze anchor for grid levels
        positions.push({ entryPrice: ep });
        nextGridLevel = 1 + GRID_STEP;
        adrQ = false;
        anchor = dir === "LONG" ? b.high : b.low;
      }
    }
  }

  // Week close: close all open positions at last price
  if (positions.length > 0) {
    const lc = bars[bars.length - 1].close;
    const totalPnl = positions.reduce((s, p) => s + (dir === "LONG" ? (lc - p.entryPrice) / p.entryPrice * 100 : (p.entryPrice - lc) / p.entryPrice * 100), 0);
    results.push({ posCount: positions.length, totalPnl, exitType: "WC" });
  }
  return results;
}

/* ─── Direction derivation (same as other scripts) ───────────── */

const PC = {};
for (const { pair, ac } of ALL_PAIRS) {
  if (ac === "fx") PC[pair] = { type: "fx", base: pair.slice(0, 3), quote: pair.slice(3) };
  else { const m = { XAUUSD: "XAU", XAGUSD: "XAG", WTIUSD: "WTI", SPXUSD: "SPX", NDXUSD: "NDX", NIKKEIUSD: "NIKKEI", BTCUSD: "BTC", ETHUSD: "ETH" }; PC[pair] = { type: ac, market: m[pair] }; }
}
function cotDir(pair, snap, model) {
  const info = PC[pair]; if (!info) return null;
  if (info.type === "fx") { const s = snap?.["fx"]; if (!s) return null; const bb = s[info.base]?.[model + "_bias"], qb = s[info.quote]?.[model + "_bias"]; if (!bb || !qb) return null; if (bb === "BULLISH" && qb === "BEARISH") return "LONG"; if (bb === "BEARISH" && qb === "BULLISH") return "SHORT"; return null; }
  const bias = snap?.[info.type]?.[info.market]?.[model + "_bias"]; return bias === "BULLISH" ? "LONG" : bias === "BEARISH" ? "SHORT" : null;
}
function sentDir(agg) { if (!agg) return null; if (agg.flip_state === "FLIPPED_UP") return "LONG"; if (agg.flip_state === "FLIPPED_DOWN") return "SHORT"; if (agg.flip_state === "FLIPPED_NEUTRAL") return null; if (agg.crowding_state === "CROWDED_LONG") return "SHORT"; if (agg.crowding_state === "CROWDED_SHORT") return "LONG"; return null; }
function agree2of3(a, b, c) { const v = [a, b, c].filter(Boolean); if (v.length < 2) return null; if (v.filter(x => x === "LONG").length >= 2) return "LONG"; if (v.filter(x => x === "SHORT").length >= 2) return "SHORT"; return null; }

/* ─── Helpers ────────────────────────────────────────────────── */

function fmt(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }

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

  console.log(`  ${weeks.rows.length} weeks loaded\n`);

  // Accumulators for each variant: tandem/agree × stochOnly/grid025/grid050
  const makeV = () => ({ pnl: 0, trades: 0, tp: 0, wc: 0, maxPos: 0 });
  const acc = {};
  for (const mode of ["tandem", "agree"]) {
    for (const filt of ["stoch", "grid025", "grid050"]) {
      acc[mode + "_" + filt] = makeV();
    }
  }
  const weekResults = [];

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const weekOpenMs = new Date(weekOpenUtc).getTime();
    const sentMap = resolveSent(weekOpenMs);
    const cotSnap = findCot(weekOpenMs);

    const wk = {};
    for (const k of Object.keys(acc)) wk[k] = makeV();

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

      const allDirs = { d: dDir, c: cDir, s: sDir };
      const hasAny = dDir || cDir || sDir;
      if (!hasAny && !a2Dir) continue;

      const adr = await fetchDailyAdr(inst, weekStartUtc, isFx ? 17 : 18);
      if (!adr) continue;
      const allBars = await fetchAllM5(inst, warmupUtc);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (!bars.length) continue;
      const si = bars.findIndex(b => b.ts >= weekStartMs);
      if (si < 0) continue;
      const stochK = computeStochK(bars);

      // Helper to accumulate scanner results
      function addStoch(key, dir) {
        const trades = scanStoch(bars, si, dir, adr, stochK);
        for (const t of trades) { wk[key].trades++; wk[key].pnl += t.pnl; if (t.et === "TP") wk[key].tp++; else wk[key].wc++; }
      }
      function addGrid(key, dir, tpMult) {
        const results = scanStochGrid(bars, si, dir, adr, stochK, tpMult);
        for (const r of results) { wk[key].trades++; wk[key].pnl += r.totalPnl; if (r.exitType === "TP") wk[key].tp++; else wk[key].wc++; wk[key].maxPos = Math.max(wk[key].maxPos, r.posCount); }
      }

      // Tandem: run each model independently
      for (const [mk, dir] of Object.entries(allDirs)) {
        if (!dir) continue;
        addStoch("tandem_stoch", dir);
        addGrid("tandem_grid025", dir, 0.25);
        addGrid("tandem_grid050", dir, 0.5);
      }

      // Agreement: 2-of-3
      if (a2Dir) {
        addStoch("agree_stoch", a2Dir);
        addGrid("agree_grid025", a2Dir, 0.25);
        addGrid("agree_grid050", a2Dir, 0.5);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    // Merge into totals
    for (const k of Object.keys(acc)) {
      acc[k].pnl += wk[k].pnl; acc[k].trades += wk[k].trades;
      acc[k].tp += wk[k].tp; acc[k].wc += wk[k].wc;
      acc[k].maxPos = Math.max(acc[k].maxPos, wk[k].maxPos);
    }

    const label = new Date(weekOpenMs + 86400000).toISOString().slice(5, 10);
    weekResults.push({ label, wk });
    console.log(`  ${label}: Tandem stoch=${fmt(wk.tandem_stoch.pnl)} g025=${fmt(wk.tandem_grid025.pnl)} g050=${fmt(wk.tandem_grid050.pnl)} | Agree stoch=${fmt(wk.agree_stoch.pnl)} g025=${fmt(wk.agree_grid025.pnl)} g050=${fmt(wk.agree_grid050.pnl)}`);
  }

  // ─── Results ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(105));
  console.log("  GRID OVERLAY — TANDEM vs AGREEMENT × STOCH / GRID 0.25x / GRID 0.5x");
  console.log("  Grid: step=0.25 ADR, max depth=2.0 ADR (max 5 positions), Net Profit TP");
  console.log("=".repeat(105));

  // Equity curve with drawdown
  console.log("\n── WEEKLY EQUITY CURVE (cumulative) ──\n");
  const cum = {}; const peak = {}; const maxDD = {};
  for (const k of Object.keys(acc)) { cum[k] = 0; peak[k] = 0; maxDD[k] = 0; }

  console.log("Week".padEnd(7),
    "T:Stoch".padEnd(10), "T:G025".padEnd(10), "T:G050".padEnd(10),
    "A:Stoch".padEnd(10), "A:G025".padEnd(10), "A:G050".padEnd(10));
  console.log("-".repeat(67));
  for (const { label, wk } of weekResults) {
    const vals = [];
    for (const k of ["tandem_stoch", "tandem_grid025", "tandem_grid050", "agree_stoch", "agree_grid025", "agree_grid050"]) {
      cum[k] += wk[k].pnl;
      peak[k] = Math.max(peak[k], cum[k]);
      maxDD[k] = Math.min(maxDD[k], cum[k] - peak[k]);
      vals.push(fmt(cum[k]));
    }
    console.log(label.padEnd(7), ...vals.map(v => v.padEnd(10)));
  }

  // Summary
  console.log("\n── SUMMARY ──\n");
  const labels = {
    tandem_stoch: "Tandem + Stoch", tandem_grid025: "Tandem + Grid 0.25x", tandem_grid050: "Tandem + Grid 0.5x",
    agree_stoch: "Agree + Stoch", agree_grid025: "Agree + Grid 0.25x", agree_grid050: "Agree + Grid 0.5x"
  };
  console.log("Variant".padEnd(24), "Net".padEnd(12), "Trades".padEnd(8), "TP".padEnd(6), "WC".padEnd(6), "WR".padEnd(8), "MaxPos".padEnd(8), "MaxDD");
  console.log("-".repeat(82));
  for (const [k, name] of Object.entries(labels)) {
    const a = acc[k];
    const wr = a.trades > 0 ? (a.tp / a.trades * 100).toFixed(1) + "%" : "N/A";
    console.log(name.padEnd(24), fmt(a.pnl).padEnd(12), String(a.trades).padEnd(8), String(a.tp).padEnd(6), String(a.wc).padEnd(6), wr.padEnd(8), String(a.maxPos).padEnd(8), fmt(maxDD[k]));
  }

  // Grid vs no-grid improvement
  console.log("\n── GRID IMPACT ──\n");
  for (const mode of ["tandem", "agree"]) {
    const base = acc[mode + "_stoch"];
    for (const tp of ["025", "050"]) {
      const grid = acc[mode + "_grid" + tp];
      const modeLabel = mode === "tandem" ? "Tandem" : "Agreement";
      const delta = grid.pnl - base.pnl;
      console.log(`${modeLabel} + Grid ${tp === "025" ? "0.25x" : "0.5x"}: ${fmt(base.pnl)} → ${fmt(grid.pnl)} (${fmt(delta)} delta, max ${grid.maxPos} positions)`);
    }
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
