/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * ADR Backtest — Grid entries + Net Profit TP
 *
 * Grid: new position every 0.25 ADR past 1.0 ADR (1.0, 1.25, 1.5, ...)
 * Net TP: TP = average entry price ± tpMult * ADR (guarantees net profit)
 * When TP hits, ALL positions close. Fresh Start after.
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

function scanGrid(bars, dir, rawAdr, gridStep, tpMult, maxAdrDepth) {
  let anchor = null;
  let frozenAnchor = 0; // anchor frozen at first entry for grid levels
  let positions = [];
  let nextGridLevel = 1;
  const results = [];

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];

    if (positions.length > 0) {
      // Check for new grid entries (using frozen anchor), capped at maxAdrDepth
      if (nextGridLevel <= maxAdrDepth) {
        const gridEntry = dir === "LONG"
          ? frozenAnchor - rawAdr * nextGridLevel
          : frozenAnchor + rawAdr * nextGridLevel;
        if (dir === "LONG" ? b.low <= gridEntry : b.high >= gridEntry) {
          positions.push({ entryPrice: gridEntry });
          nextGridLevel += gridStep;
        }
      }

      // Net TP: average entry ± tpMult * ADR
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice, 0) / positions.length;
      const tp = dir === "LONG" ? avgEntry + rawAdr * tpMult : avgEntry - rawAdr * tpMult;

      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        const totalPnl = positions.reduce((s, p) => {
          return s + (dir === "LONG" ? (tp - p.entryPrice) / p.entryPrice * 100 : (p.entryPrice - tp) / p.entryPrice * 100);
        }, 0);
        results.push({ posCount: positions.length, avgEntry, tp, exitType: "TP_HIT", totalPnl });
        positions = [];
        anchor = dir === "LONG" ? b.high : b.low;
        nextGridLevel = 1;
        continue;
      }
      continue;
    }

    // Tracking phase
    if (anchor === null) { anchor = dir === "LONG" ? b.high : b.low; continue; }
    const prevAnchor = anchor;
    anchor = dir === "LONG" ? Math.max(anchor, b.high) : Math.min(anchor, b.low);

    const ep = dir === "LONG" ? prevAnchor - rawAdr : prevAnchor + rawAdr;
    if (dir === "LONG" ? b.low <= ep : b.high >= ep) {
      frozenAnchor = prevAnchor;
      positions.push({ entryPrice: ep });
      nextGridLevel = 1 + gridStep;
    }
  }

  if (positions.length > 0) {
    const lastClose = bars[bars.length - 1].close;
    const avgEntry = positions.reduce((s, p) => s + p.entryPrice, 0) / positions.length;
    const totalPnl = positions.reduce((s, p) => {
      return s + (dir === "LONG" ? (lastClose - p.entryPrice) / p.entryPrice * 100 : (p.entryPrice - lastClose) / p.entryPrice * 100);
    }, 0);
    results.push({ posCount: positions.length, avgEntry, tp: null, exitType: "WEEK_CLOSE", totalPnl });
  }
  return results;
}

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

async function main() {
  const weeks = await pool.query(
    `SELECT DISTINCT week_open_utc FROM strategy_backtest_trades WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' ORDER BY week_open_utc`
  );

  const gridStep = 0.25;
  const tpMultiples = [0.125, 0.25, 0.375, 0.5, 0.75, 1.0];
  const maxDepthOptions = [2.0, 3.0, 999]; // 2 ADR cap (5 pos), 3 ADR cap (9 pos), no cap

  // Pre-fetch all data (shared across TP variants)
  const allData = []; // { signal, bars, adr }
  for (const weekRow of weeks.rows) {
    const weekOpenUtc = weekRow.week_open_utc.toISOString();
    const signals = await getSignals(weekOpenUtc);
    for (const signal of signals) {
      const inst = OANDA_MAP[signal.pair];
      if (!inst) continue;
      const isFx = signal.assetClass === "fx";
      const weekStart = new Date(new Date(weekOpenUtc).getTime() - (isFx ? 2 : 1) * 3600000).toISOString();
      const weekCloseMs = new Date(weekStart).getTime() + 5 * 24 * 3600000;
      const adr = await fetchDailyAdr(inst, weekStart, isFx ? 17 : 18);
      if (!adr) continue;
      const allBars = await fetchAllM5(inst, weekStart);
      const bars = allBars.filter(b => b.ts < weekCloseMs);
      if (bars.length === 0) continue;
      allData.push({ signal, bars, adr, weekOpenUtc });
      await new Promise(r => setTimeout(r, 120));
    }
    process.stdout.write(".");
  }
  console.log("\nData loaded:", allData.length, "pair-weeks\n");

  // Run each combo of TP multiple × grid cap
  for (const maxDepthAdr of maxDepthOptions) {
    const capLabel = maxDepthAdr >= 999 ? "NO CAP" : maxDepthAdr + "x ADR cap";
    const maxPos = maxDepthAdr >= 999 ? "unlimited" : Math.floor((maxDepthAdr - 1) / gridStep) + 1 + " max";
    console.log(`\n=== GRID: ${capLabel} (${maxPos}) | Net Profit TP ===\n`);
    console.log("Net TP".padEnd(10), "Cycles".padEnd(8), "TP".padEnd(5), "WC".padEnd(5), "Positions".padEnd(10), "TP Pnl".padEnd(12), "WC Pnl".padEnd(12), "Net".padEnd(10), "WR".padEnd(7), "MaxDepth");
    console.log("-".repeat(95));

    for (const tpMult of tpMultiples) {
      let cycles = 0, tpCount = 0, wcCount = 0, tpPnl = 0, wcPnl = 0, positions = 0, maxDepth = 0;

      for (const { signal, bars, adr } of allData) {
        const results = scanGrid(bars, signal.direction, adr, gridStep, tpMult, maxDepthAdr);
        for (const r of results) {
          cycles++;
          positions += r.posCount;
          if (r.posCount > maxDepth) maxDepth = r.posCount;
          if (r.exitType === "TP_HIT") { tpCount++; tpPnl += r.totalPnl; }
          else { wcCount++; wcPnl += r.totalPnl; }
        }
      }

      const net = tpPnl + wcPnl;
      const wr = cycles > 0 ? (tpCount / cycles * 100).toFixed(1) : "0";
      console.log(
        (tpMult + "x ADR").padEnd(10),
        String(cycles).padEnd(8),
        String(tpCount).padEnd(5),
        String(wcCount).padEnd(5),
        String(positions).padEnd(10),
        ("+" + tpPnl.toFixed(2) + "%").padEnd(12),
        (wcPnl.toFixed(2) + "%").padEnd(12),
        ((net > 0 ? "+" : "") + net.toFixed(2) + "%").padEnd(10),
        (wr + "%").padEnd(7),
        maxDepth
      );
    }
  }

  console.log("\n=== COMPARISON ===");
  console.log("Static 0.25x TP (no grid): +3.10% net, 173 trades, 84.4% WR");

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
