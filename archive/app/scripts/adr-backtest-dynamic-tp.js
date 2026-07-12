/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * ADR Backtest — Dynamic TP variant
 *
 * Dynamic TP: instead of TP = entry ± 0.25 ADR (static),
 * TP recalculates from the running low (LONG) or high (SHORT)
 * since trade entry. TP = extremeSinceEntry + tpMultiple * ADR.
 *
 * This means if price dips deeper past entry, the TP follows
 * the dip — capturing more of the reversion.
 *
 * Usage: node scripts/adr-backtest-dynamic-tp.js
 */

const { readFileSync } = require("node:fs");
const path = require("node:path");

// Load env
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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const KEY = process.env.OANDA_API_KEY;
const BASE = "https://api-fxtrade.oanda.com";

/* ---- Oanda fetch (from+count, no from+to bug) ---- */
async function fetchAllM5(inst, fromUtc) {
  const bars = [];
  let cursor = fromUtc;
  for (let page = 0; page < 15; page++) {
    const url = `${BASE}/v3/instruments/${inst}/candles?price=M&granularity=M5&from=${cursor}&count=500`;
    const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
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
  const url = `${BASE}/v3/instruments/${inst}/candles?price=M&granularity=D&from=${from}&count=500&dailyAlignment=${alignment}&alignmentTimezone=America%2FNew_York`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
  const d = await r.json();
  const bars = (d.candles || []).filter(c => c.complete && c.mid && new Date(c.time) < new Date(beforeUtc));
  const skip1 = bars.slice(0, -1);
  const last10 = skip1.slice(-10);
  if (last10.length < 5) return null;
  return last10.reduce((s, c) => (+c.mid.h) - (+c.mid.l) + s, 0) / last10.length;
}

/* ---- Static TP scanner (baseline, matches production) ---- */
function scanStatic(bars, dir, rawAdr, tpMult) {
  let a = null, it = false, n = 0, tp = 0, ep = 0, maeP = 0, entryTs = 0;
  const trades = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (it) {
      maeP = dir === "LONG" ? Math.min(maeP, b.low) : Math.max(maeP, b.high);
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        trades.push({ entry: ep, tp, exit: tp, exitType: "TP_HIT", pnl: tpMult * rawAdr / ep * 100 * (dir === "LONG" ? 1 : 1), entryTs });
        it = false; a = dir === "LONG" ? b.high : b.low; continue;
      }
      continue;
    }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    const t = dir === "LONG" ? e + rawAdr * tpMult : e - rawAdr * tpMult;
    if (dir === "LONG" ? b.low <= e : b.high >= e) {
      ep = e; tp = t; entryTs = b.ts; it = true; n++;
      maeP = dir === "LONG" ? Math.min(e, b.low) : Math.max(e, b.high);
    }
  }
  if (it) {
    const lastClose = bars[bars.length - 1].close;
    const pnl = dir === "LONG" ? (lastClose - ep) / ep * 100 : (ep - lastClose) / ep * 100;
    trades.push({ entry: ep, tp, exit: lastClose, exitType: "WEEK_CLOSE", pnl, entryTs });
  }
  return trades;
}

/* ---- Dynamic TP scanner ---- */
function scanDynamic(bars, dir, rawAdr, tpMult) {
  let a = null, it = false, n = 0, ep = 0, maeP = 0, entryTs = 0;
  let extremeSinceEntry = 0; // running low (LONG) or high (SHORT) since entry
  const trades = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (it) {
      // Update running extreme since entry
      extremeSinceEntry = dir === "LONG" ? Math.min(extremeSinceEntry, b.low) : Math.max(extremeSinceEntry, b.high);
      maeP = extremeSinceEntry;

      // Dynamic TP: calculated from the extreme since entry
      const dynTp = dir === "LONG"
        ? extremeSinceEntry + rawAdr * tpMult
        : extremeSinceEntry - rawAdr * tpMult;

      if (dir === "LONG" ? b.high >= dynTp : b.low <= dynTp) {
        const pnl = dir === "LONG" ? (dynTp - ep) / ep * 100 : (ep - dynTp) / ep * 100;
        trades.push({ entry: ep, tp: dynTp, exit: dynTp, exitType: "TP_HIT", pnl, entryTs });
        it = false; a = dir === "LONG" ? b.high : b.low; continue;
      }
      continue;
    }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    if (dir === "LONG" ? b.low <= e : b.high >= e) {
      ep = e; entryTs = b.ts; it = true; n++;
      extremeSinceEntry = dir === "LONG" ? Math.min(e, b.low) : Math.max(e, b.high);
      maeP = extremeSinceEntry;
    }
  }
  if (it) {
    const lastClose = bars[bars.length - 1].close;
    const pnl = dir === "LONG" ? (lastClose - ep) / ep * 100 : (ep - lastClose) / ep * 100;
    trades.push({ entry: ep, tp: null, exit: lastClose, exitType: "WEEK_CLOSE", pnl, entryTs });
  }
  return trades;
}

/* ---- Signals from DB ---- */
async function getSignals(weekOpenUtc) {
  const r = await pool.query(
    `SELECT symbol, direction, (array_agg(metadata::text))[1] m
     FROM strategy_backtest_trades
     WHERE run_id = 54 AND week_open_utc = $1
     GROUP BY symbol, direction`,
    [weekOpenUtc]
  );
  return r.rows.map(x => {
    const md = JSON.parse(x.m);
    return { pair: x.symbol, direction: x.direction, assetClass: md.assetClass || "fx" };
  });
}

/* ---- Oanda instrument mapping ---- */
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
  // Get all weeks from the backtest
  const weeks = await pool.query(
    `SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`
  );

  const TP_MULT = 0.25;
  let staticTotal = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };
  let dynTotal = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };

  // Also try different dynamic TP multiples
  const dynMultiples = [0.25, 0.5, 0.75, 1.0];
  const dynByMult = {};
  for (const m of dynMultiples) dynByMult[m] = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0 };

  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const signals = await getSignals(weekOpenUtc);

    for (const signal of signals) {
      const inst = OANDA_MAP[signal.pair];
      if (!inst) continue;

      const isFx = signal.assetClass === "fx";
      const alignment = isFx ? 17 : 18;
      const weekStart = isFx ? new Date(new Date(weekOpenUtc).getTime() - 2 * 3600000).toISOString()
        : new Date(new Date(weekOpenUtc).getTime() - 1 * 3600000).toISOString();

      const adr = await fetchDailyAdr(inst, weekStart, alignment);
      if (!adr) continue;

      // Week close = ~5 days after week start (FX closes Friday 21:00 UTC)
      const weekCloseMs = new Date(weekStart).getTime() + 5 * 24 * 3600000;
      const allBars = await fetchAllM5(inst, weekStart);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (bars.length === 0) continue;

      // Static TP (baseline)
      const staticTrades = scanStatic(bars, signal.direction, adr, TP_MULT);
      for (const t of staticTrades) {
        staticTotal.trades++;
        if (t.exitType === "TP_HIT") { staticTotal.tp++; staticTotal.tpPnl += t.pnl; }
        else { staticTotal.wc++; staticTotal.wcPnl += t.pnl; }
      }

      // Dynamic TP at different multiples
      for (const mult of dynMultiples) {
        const dynTrades = scanDynamic(bars, signal.direction, adr, mult);
        const dt = dynByMult[mult];
        for (const t of dynTrades) {
          dt.trades++;
          if (t.exitType === "TP_HIT") { dt.tp++; dt.tpPnl += t.pnl; }
          else { dt.wc++; dt.wcPnl += t.pnl; }
        }
      }

      await new Promise(r => setTimeout(r, 150));
    }
    process.stdout.write(".");
  }

  console.log("\n\n=== STATIC TP (baseline, 0.25 ADR from entry) ===");
  console.log("Trades:", staticTotal.trades, "TP:", staticTotal.tp, "WC:", staticTotal.wc);
  console.log("TP profit:", "+" + staticTotal.tpPnl.toFixed(2) + "%", "WC loss:", staticTotal.wcPnl.toFixed(2) + "%");
  console.log("Net:", (staticTotal.tpPnl + staticTotal.wcPnl).toFixed(2) + "%");
  console.log("Win Rate:", (staticTotal.tp / staticTotal.trades * 100).toFixed(1) + "%");

  console.log("\n=== DYNAMIC TP (from running extreme since entry) ===\n");
  console.log("TP Mult".padEnd(10), "Trades".padEnd(8), "TP".padEnd(5), "WC".padEnd(5), "TP Profit".padEnd(12), "WC Loss".padEnd(12), "Net".padEnd(10), "WR");
  console.log("-".repeat(75));

  for (const mult of dynMultiples) {
    const dt = dynByMult[mult];
    const net = dt.tpPnl + dt.wcPnl;
    const wr = dt.trades > 0 ? (dt.tp / dt.trades * 100).toFixed(1) : "0";
    console.log(
      (mult + "x ADR").padEnd(10),
      String(dt.trades).padEnd(8),
      String(dt.tp).padEnd(5),
      String(dt.wc).padEnd(5),
      ("+" + dt.tpPnl.toFixed(2) + "%").padEnd(12),
      (dt.wcPnl.toFixed(2) + "%").padEnd(12),
      ((net > 0 ? "+" : "") + net.toFixed(2) + "%").padEnd(10),
      wr + "%"
    );
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
