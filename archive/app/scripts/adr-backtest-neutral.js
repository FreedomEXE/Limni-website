/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-neutral.js
 *
 * Description:
 * ADR Backtest — Neutral (no directional bias)
 * Runs LONG-only and SHORT-only SEPARATELY across all 32 pairs for 9 weeks.
 * Both directions run independently — a pair can have concurrent long & short trades.
 * Combines results to answer: does directional bias even matter?
 *
 * Compares: LONG-only | SHORT-only | Combined (neutral) | Sentiment-only | V3
 *
 * Usage: node scripts/adr-backtest-neutral.js
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

/* ─── Oanda helpers ──────────────────────────────────────────── */

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

/* ─── ADR scanner (Fresh Start, single direction) ─────────────── */

function scanDir(bars, dir, rawAdr) {
  let a = null, it = false, tp = 0, ep = 0;
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
      ep = e; tp = t; it = true;
    }
  }
  if (it) {
    const lc = bars[bars.length - 1].close;
    trades.push({ dir, ep, tp, exit: lc, exitType: "WEEK_CLOSE", pnl: dir === "LONG" ? (lc - ep) / ep * 100 : (ep - lc) / ep * 100 });
  }
  return trades;
}

/* ─── Pair universe ──────────────────────────────────────────── */

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

/* ─── Main ───────────────────────────────────────────────────── */

async function main() {
  // Get completed weeks
  const weeks = await pool.query(
    `SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`
  );
  console.log(`Found ${weeks.rows.length} completed weeks. Running LONG-only and SHORT-only separately on all ${ALL_PAIRS.length} pairs.\n`);

  // Get V3 comparison from DB
  const v3Data = await pool.query(`
    SELECT week_open_utc,
           count(*)::int trades,
           sum(case when exit_reason = 'tp' then 1 else 0 end)::int tp,
           sum(case when exit_reason != 'tp' then 1 else 0 end)::int wc,
           sum(case when exit_reason = 'tp' then pnl_pct else 0 end)::float tp_pnl,
           sum(case when exit_reason != 'tp' then pnl_pct else 0 end)::float wc_pnl
    FROM strategy_backtest_trades
    WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z'
    GROUP BY 1 ORDER BY 1
  `);
  const v3ByWeek = {};
  for (const r of v3Data.rows) v3ByWeek[new Date(r.week_open_utc).toISOString()] = r;

  // Accumulators
  const acc = {
    long:  { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 },
    short: { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 },
  };
  let v3Tot = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };
  const weekResults = [];
  const pairDetail = {}; // pair → { longPnl, longTrades, shortPnl, shortTrades }

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const weekOpenMs = new Date(weekOpenUtc).getTime();
    let weekLong = 0, weekShort = 0, weekLongTrades = 0, weekShortTrades = 0;

    for (const { pair, inst, ac } of ALL_PAIRS) {
      const isFx = ac === "fx";
      const weekStart = new Date(weekOpenMs - (isFx ? 2 : 1) * 3600000).toISOString();
      const weekCloseMs = new Date(weekStart).getTime() + 5 * 24 * 3600000;

      const adr = await fetchDailyAdr(inst, weekStart, isFx ? 17 : 18);
      if (!adr) continue;
      const allBars = await fetchAllM5(inst, weekStart);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (bars.length === 0) continue;

      if (!pairDetail[pair]) pairDetail[pair] = { longPnl: 0, longTrades: 0, shortPnl: 0, shortTrades: 0 };

      // Run LONG scanner
      const longTrades = scanDir(bars, "LONG", adr);
      for (const t of longTrades) {
        acc.long.trades++;
        weekLongTrades++;
        if (t.exitType === "TP_HIT") { acc.long.tp++; acc.long.tpPnl += t.pnl; }
        else { acc.long.wc++; acc.long.wcPnl += t.pnl; }
        weekLong += t.pnl;
        pairDetail[pair].longPnl += t.pnl;
        pairDetail[pair].longTrades++;
      }

      // Run SHORT scanner (independent — same bars, different direction)
      const shortTrades = scanDir(bars, "SHORT", adr);
      for (const t of shortTrades) {
        acc.short.trades++;
        weekShortTrades++;
        if (t.exitType === "TP_HIT") { acc.short.tp++; acc.short.tpPnl += t.pnl; }
        else { acc.short.wc++; acc.short.wcPnl += t.pnl; }
        weekShort += t.pnl;
        pairDetail[pair].shortPnl += t.pnl;
        pairDetail[pair].shortTrades++;
      }

      await new Promise(r => setTimeout(r, 100));
    }

    // V3 from DB
    const v3w = v3ByWeek[weekOpenUtc];
    const v3Net = v3w ? v3w.tp_pnl + v3w.wc_pnl : 0;
    if (v3w) {
      v3Tot.trades += v3w.trades;
      v3Tot.tp += v3w.tp;
      v3Tot.wc += v3w.wc;
      v3Tot.tpPnl += v3w.tp_pnl;
      v3Tot.wcPnl += v3w.wc_pnl;
    }

    const label = new Date(weekOpenMs + 86400000).toISOString().slice(5, 10);
    weekResults.push({ label, weekLong, weekShort, weekLongTrades, weekShortTrades, v3Net, v3Trades: v3w ? v3w.trades : 0 });
    const combined = weekLong + weekShort;
    console.log(`  Week ${label}: LONG ${weekLong >= 0 ? "+" : ""}${weekLong.toFixed(2)}% (${weekLongTrades}) | SHORT ${weekShort >= 0 ? "+" : ""}${weekShort.toFixed(2)}% (${weekShortTrades}) | COMBINED ${combined >= 0 ? "+" : ""}${combined.toFixed(2)}% | v3 ${v3Net >= 0 ? "+" : ""}${v3Net.toFixed(2)}%`);
  }

  // ─── Results ─────────────────────────────────────────────────
  const longNet = acc.long.tpPnl + acc.long.wcPnl;
  const shortNet = acc.short.tpPnl + acc.short.wcPnl;
  const combinedNet = longNet + shortNet;
  const combinedTrades = acc.long.trades + acc.short.trades;
  const combinedTp = acc.long.tp + acc.short.tp;
  const combinedWc = acc.long.wc + acc.short.wc;
  const v3Net = v3Tot.tpPnl + v3Tot.wcPnl;

  console.log("\n" + "=".repeat(80));
  console.log("  NEUTRAL TEST — LONG-ONLY vs SHORT-ONLY vs COMBINED (9 weeks, 32 pairs)");
  console.log("=".repeat(80) + "\n");

  console.log("Week".padEnd(8), "LONG".padEnd(14), "SHORT".padEnd(14), "COMBINED".padEnd(14), "V3".padEnd(14));
  console.log("-".repeat(68));
  for (const w of weekResults) {
    const lStr = (w.weekLong >= 0 ? "+" : "") + w.weekLong.toFixed(2) + "%";
    const sStr = (w.weekShort >= 0 ? "+" : "") + w.weekShort.toFixed(2) + "%";
    const cStr = ((w.weekLong + w.weekShort) >= 0 ? "+" : "") + (w.weekLong + w.weekShort).toFixed(2) + "%";
    const vStr = (w.v3Net >= 0 ? "+" : "") + w.v3Net.toFixed(2) + "%";
    console.log(w.label.padEnd(8), lStr.padEnd(14), sStr.padEnd(14), cStr.padEnd(14), vStr.padEnd(14));
  }

  console.log("\n" + "=".repeat(80));
  console.log("  SUMMARY");
  console.log("=".repeat(80) + "\n");
  console.log("".padEnd(18), "LONG Only".padEnd(16), "SHORT Only".padEnd(16), "Combined".padEnd(16), "V3 (DB)");
  console.log("-".repeat(75));
  console.log("Trades".padEnd(18), String(acc.long.trades).padEnd(16), String(acc.short.trades).padEnd(16), String(combinedTrades).padEnd(16), v3Tot.trades);
  console.log("TP Hits".padEnd(18), String(acc.long.tp).padEnd(16), String(acc.short.tp).padEnd(16), String(combinedTp).padEnd(16), v3Tot.tp);
  console.log("Week Close".padEnd(18), String(acc.long.wc).padEnd(16), String(acc.short.wc).padEnd(16), String(combinedWc).padEnd(16), v3Tot.wc);
  console.log("TP Profit".padEnd(18),
    ("+" + acc.long.tpPnl.toFixed(2) + "%").padEnd(16),
    ("+" + acc.short.tpPnl.toFixed(2) + "%").padEnd(16),
    ("+" + (acc.long.tpPnl + acc.short.tpPnl).toFixed(2) + "%").padEnd(16),
    "+" + v3Tot.tpPnl.toFixed(2) + "%");
  console.log("WC Loss".padEnd(18),
    (acc.long.wcPnl.toFixed(2) + "%").padEnd(16),
    (acc.short.wcPnl.toFixed(2) + "%").padEnd(16),
    ((acc.long.wcPnl + acc.short.wcPnl).toFixed(2) + "%").padEnd(16),
    v3Tot.wcPnl.toFixed(2) + "%");
  console.log("Net Return".padEnd(18),
    ((longNet >= 0 ? "+" : "") + longNet.toFixed(2) + "%").padEnd(16),
    ((shortNet >= 0 ? "+" : "") + shortNet.toFixed(2) + "%").padEnd(16),
    ((combinedNet >= 0 ? "+" : "") + combinedNet.toFixed(2) + "%").padEnd(16),
    (v3Net >= 0 ? "+" : "") + v3Net.toFixed(2) + "%");
  console.log("Win Rate".padEnd(18),
    ((acc.long.tp / acc.long.trades * 100).toFixed(1) + "%").padEnd(16),
    ((acc.short.tp / acc.short.trades * 100).toFixed(1) + "%").padEnd(16),
    ((combinedTp / combinedTrades * 100).toFixed(1) + "%").padEnd(16),
    (v3Tot.tp / v3Tot.trades * 100).toFixed(1) + "%");

  // Quick reference line
  console.log("\n  Sentiment-only reference: +17.41% net, 396 trades, 83.1% WR");
  console.log("  Stoch confirmation reference: +27.97% net, 89.7% WR");

  // Per-pair detail
  console.log("\n" + "=".repeat(80));
  console.log("  PER-PAIR BREAKDOWN (sorted by combined net)");
  console.log("=".repeat(80) + "\n");
  const sorted = Object.entries(pairDetail).sort((a, b) => (b[1].longPnl + b[1].shortPnl) - (a[1].longPnl + a[1].shortPnl));
  console.log("Pair".padEnd(12), "LONG".padEnd(16), "SHORT".padEnd(16), "Combined");
  console.log("-".repeat(55));
  for (const [p, d] of sorted) {
    const combined = d.longPnl + d.shortPnl;
    const lStr = (d.longPnl >= 0 ? "+" : "") + d.longPnl.toFixed(2) + "% (" + d.longTrades + ")";
    const sStr = (d.shortPnl >= 0 ? "+" : "") + d.shortPnl.toFixed(2) + "% (" + d.shortTrades + ")";
    const cStr = (combined >= 0 ? "+" : "") + combined.toFixed(2) + "%";
    console.log(p.padEnd(12), lStr.padEnd(16), sStr.padEnd(16), cStr);
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
