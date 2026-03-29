/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-sentiment.js
 *
 * Description:
 * ADR Backtest — Sentiment Only (contrarian crowd positioning)
 * Tests whether ADR mean-reversion gated by sentiment ALONE beats Tiered V3.
 * Uses the same backfill logic as production (closest sentiment to week open).
 *
 * Usage: node scripts/adr-backtest-sentiment.js
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

/* ─── Oanda helpers (same as corrected baseline) ──────────────── */

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
  const skip1 = bars.slice(0, -1); // skip most recent daily bar (Pine does high[1..10])
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

/* ─── Sentiment direction (matches production basketSignals.ts) ── */

function sentimentDirection(agg) {
  if (!agg) return null;
  // Flip state takes priority
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return null;
  // Contrarian: crowded long = go short
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return null; // NEUTRAL = no signal
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
  console.log("Loading sentiment data...");

  // Step 1: Load ALL sentiment aggregates (same as production backfill)
  const allAggs = await pool.query(`
    SELECT symbol, crowding_state, flip_state, timestamp_utc
    FROM sentiment_aggregates
    ORDER BY timestamp_utc ASC
  `);
  const aggs = allAggs.rows.map(r => ({
    symbol: r.symbol,
    crowding_state: r.crowding_state,
    flip_state: r.flip_state,
    ts: new Date(r.timestamp_utc).getTime()
  }));
  console.log(`  Loaded ${aggs.length} sentiment rows (${new Date(aggs[0].ts).toISOString().slice(0,10)} → ${new Date(aggs[aggs.length-1].ts).toISOString().slice(0,10)})`);

  // Group by symbol for fast lookup
  const bySymbol = {};
  for (const a of aggs) {
    if (!bySymbol[a.symbol]) bySymbol[a.symbol] = [];
    bySymbol[a.symbol].push(a);
  }

  // Step 2: Get completed weeks from DB
  const weeks = await pool.query(
    `SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`
  );
  console.log(`  Found ${weeks.rows.length} completed weeks\n`);

  // Step 3: Get V3 comparison data from DB
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

  // Resolve sentiment for a week open: closest-to-open per symbol
  // (latest before open, else first after open — matches production backfill)
  function resolveSentiment(weekOpenMs) {
    const result = {};
    for (const [sym, rows] of Object.entries(bySymbol)) {
      let latestBefore = null;
      let firstAfter = null;
      for (const r of rows) {
        if (r.ts <= weekOpenMs) latestBefore = r;
        if (r.ts > weekOpenMs && !firstAfter) firstAfter = r;
        if (firstAfter) break; // rows are sorted ASC, no need to continue
      }
      const pick = latestBefore || firstAfter;
      if (pick) result[sym] = pick;
    }
    return result;
  }

  // Accumulators
  let sent = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };
  let v3Tot = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };
  const weekResults = [];
  const pairDetail = {}; // pair → { sentPnl, sentTrades, v3Pnl, v3Trades }

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const weekOpenMs = new Date(weekOpenUtc).getTime();
    let weekSent = 0, weekSentTrades = 0;

    // Resolve sentiment for this week
    const sentMap = resolveSentiment(weekOpenMs);
    let signalCount = 0, skipCount = 0;

    for (const { pair, inst, ac } of ALL_PAIRS) {
      const dir = sentimentDirection(sentMap[pair]);
      if (!dir) { skipCount++; continue; }
      signalCount++;

      const isFx = ac === "fx";
      const weekStart = new Date(weekOpenMs - (isFx ? 2 : 1) * 3600000).toISOString();
      const weekCloseMs = new Date(weekStart).getTime() + 5 * 24 * 3600000;

      const adr = await fetchDailyAdr(inst, weekStart, isFx ? 17 : 18);
      if (!adr) continue;
      const allBars = await fetchAllM5(inst, weekStart);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (bars.length === 0) continue;

      const trades = scanDir(bars, dir, adr);
      for (const t of trades) {
        sent.trades++;
        weekSentTrades++;
        if (t.exitType === "TP_HIT") { sent.tp++; sent.tpPnl += t.pnl; }
        else { sent.wc++; sent.wcPnl += t.pnl; }
        weekSent += t.pnl;

        if (!pairDetail[pair]) pairDetail[pair] = { sentPnl: 0, sentTrades: 0 };
        pairDetail[pair].sentPnl += t.pnl;
        pairDetail[pair].sentTrades++;
      }

      await new Promise(r => setTimeout(r, 100));
    }

    // V3 comparison from DB
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
    const sentNet = weekSent;
    weekResults.push({ label, sentNet, sentTrades: weekSentTrades, signalCount, skipCount, v3Net, v3Trades: v3w ? v3w.trades : 0 });
    console.log(`  Week ${label}: sentiment ${sentNet >= 0 ? "+" : ""}${sentNet.toFixed(2)}% (${weekSentTrades} trades, ${signalCount} signals) | v3 ${v3Net >= 0 ? "+" : ""}${v3Net.toFixed(2)}% (${v3w ? v3w.trades : 0} trades)`);
  }

  // ─── Results ─────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("  SENTIMENT-ONLY vs TIERED V3 — ADR BACKTEST (9 weeks)");
  console.log("=".repeat(70) + "\n");

  console.log("Week".padEnd(8), "Sentiment".padEnd(14), "Trades".padEnd(8), "Signals".padEnd(9), "V3".padEnd(14), "Trades".padEnd(8), "Delta");
  console.log("-".repeat(72));
  for (const w of weekResults) {
    const sStr = (w.sentNet >= 0 ? "+" : "") + w.sentNet.toFixed(2) + "%";
    const vStr = (w.v3Net >= 0 ? "+" : "") + w.v3Net.toFixed(2) + "%";
    const delta = w.sentNet - w.v3Net;
    const dStr = (delta >= 0 ? "+" : "") + delta.toFixed(2) + "%";
    console.log(w.label.padEnd(8), sStr.padEnd(14), String(w.sentTrades).padEnd(8), String(w.signalCount).padEnd(9), vStr.padEnd(14), String(w.v3Trades).padEnd(8), dStr);
  }

  const sentNet = sent.tpPnl + sent.wcPnl;
  const v3Net = v3Tot.tpPnl + v3Tot.wcPnl;

  console.log("\n" + "=".repeat(70));
  console.log("  SUMMARY");
  console.log("=".repeat(70) + "\n");
  console.log("".padEnd(18), "Sentiment Only".padEnd(22), "Tiered V3 (from DB)");
  console.log("-".repeat(60));
  console.log("Total Trades".padEnd(18), String(sent.trades).padEnd(22), v3Tot.trades);
  console.log("TP Hits".padEnd(18), String(sent.tp).padEnd(22), v3Tot.tp);
  console.log("Week Close".padEnd(18), String(sent.wc).padEnd(22), v3Tot.wc);
  console.log("TP Profit".padEnd(18), ("+" + sent.tpPnl.toFixed(2) + "%").padEnd(22), "+" + v3Tot.tpPnl.toFixed(2) + "%");
  console.log("WC Loss".padEnd(18), (sent.wcPnl.toFixed(2) + "%").padEnd(22), v3Tot.wcPnl.toFixed(2) + "%");
  console.log("Net Return".padEnd(18), ((sentNet >= 0 ? "+" : "") + sentNet.toFixed(2) + "%").padEnd(22), (v3Net >= 0 ? "+" : "") + v3Net.toFixed(2) + "%");
  console.log("Win Rate".padEnd(18), ((sent.tp / sent.trades * 100).toFixed(1) + "%").padEnd(22), (v3Tot.tp / v3Tot.trades * 100).toFixed(1) + "%");

  // Per-pair breakdown
  console.log("\n" + "=".repeat(70));
  console.log("  PER-PAIR SENTIMENT DETAIL");
  console.log("=".repeat(70) + "\n");
  const sorted = Object.entries(pairDetail).sort((a, b) => b[1].sentPnl - a[1].sentPnl);
  console.log("Pair".padEnd(12), "Trades".padEnd(8), "Net PnL");
  console.log("-".repeat(35));
  for (const [p, d] of sorted) {
    console.log(p.padEnd(12), String(d.sentTrades).padEnd(8), (d.sentPnl >= 0 ? "+" : "") + d.sentPnl.toFixed(2) + "%");
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
