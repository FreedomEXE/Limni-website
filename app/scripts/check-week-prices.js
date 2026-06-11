const { Pool } = require("pg");
const { readFileSync } = require("fs");
try {
  const e = readFileSync(".env.local", "utf8");
  e.split("\n").forEach(l => {
    const t = l.trim(); if (!t || t[0] === "#") return;
    const i = t.indexOf("="); if (i < 0) return;
    const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
    if ((v[0] === '"' || v[0] === "'") && v[0] === v.at(-1)) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  });
} catch {}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  // Current week (Mar 22)
  const r = await pool.query(`
    SELECT symbol, asset_class ac, open_price op, close_price cp, return_pct rp
    FROM pair_period_returns
    WHERE period_type = 'weekly' AND period_open_utc = '2026-03-22T23:00:00+00'
    ORDER BY asset_class, symbol
  `);

  console.log("=== MAR 22 WEEK (current/closing) — VERIFY vs TRADINGVIEW ===\n");
  console.log("Symbol".padEnd(12), "AC".padEnd(8), "Open".padEnd(14), "Close".padEnd(14), "Return");
  console.log("-".repeat(60));
  for (const x of r.rows) {
    console.log(
      x.symbol.padEnd(12),
      x.ac.padEnd(8),
      String(x.op).padEnd(14),
      String(x.cp).padEnd(14),
      (x.rp >= 0 ? "+" : "") + Number(x.rp).toFixed(3) + "%"
    );
  }

  // Also check a random older week for validation
  const r2 = await pool.query(`
    SELECT symbol, asset_class ac, open_price op, close_price cp, return_pct rp
    FROM pair_period_returns
    WHERE period_type = 'weekly' AND period_open_utc = '2026-02-23T00:00:00+00'
    ORDER BY asset_class, symbol
  `);

  console.log("\n=== FEB 23 WEEK (historical spot check) ===\n");
  console.log("Symbol".padEnd(12), "AC".padEnd(8), "Open".padEnd(14), "Close".padEnd(14), "Return");
  console.log("-".repeat(60));
  for (const x of r2.rows) {
    console.log(
      x.symbol.padEnd(12),
      x.ac.padEnd(8),
      String(x.op).padEnd(14),
      String(x.cp).padEnd(14),
      (x.rp >= 0 ? "+" : "") + Number(x.rp).toFixed(3) + "%"
    );
  }

  // Show the raw daily bars for a few key pairs to check open/close timing
  console.log("\n=== DAILY BAR TIMING CHECK — EURUSD Mar 22 week ===\n");
  const r3 = await pool.query(`
    SELECT bar_open_utc::text bo, bar_close_utc::text bc, open_price op, close_price cp
    FROM canonical_price_bars
    WHERE symbol = 'EURUSD' AND timeframe = '1d'
      AND bar_open_utc >= '2026-03-22T00:00:00Z' AND bar_open_utc < '2026-03-28T00:00:00Z'
    ORDER BY bar_open_utc
  `);
  for (const x of r3.rows) console.log(x.bo, "→", x.bc, "O:", x.op, "C:", x.cp);

  console.log("\n=== DAILY BAR TIMING CHECK — XAUUSD Mar 22 week ===\n");
  const r4 = await pool.query(`
    SELECT bar_open_utc::text bo, bar_close_utc::text bc, open_price op, close_price cp
    FROM canonical_price_bars
    WHERE symbol = 'XAUUSD' AND timeframe = '1d'
      AND bar_open_utc >= '2026-03-22T00:00:00Z' AND bar_open_utc < '2026-03-28T00:00:00Z'
    ORDER BY bar_open_utc
  `);
  for (const x of r4.rows) console.log(x.bo, "→", x.bc, "O:", x.op, "C:", x.cp);

  console.log("\n=== DAILY BAR TIMING CHECK — BTCUSD Mar 22 week ===\n");
  const r5 = await pool.query(`
    SELECT bar_open_utc::text bo, bar_close_utc::text bc, open_price op, close_price cp
    FROM canonical_price_bars
    WHERE symbol = 'BTCUSD' AND timeframe = '1d'
      AND bar_open_utc >= '2026-03-22T00:00:00Z' AND bar_open_utc < '2026-03-30T00:00:00Z'
    ORDER BY bar_open_utc
  `);
  for (const x of r5.rows) console.log(x.bo, "→", x.bc, "O:", x.op, "C:", x.cp);

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
