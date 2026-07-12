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
  // Date range
  const r1 = await pool.query("SELECT min(report_date)::text mn, max(report_date)::text mx, count(*)::int c FROM cot_snapshots");
  console.log("Range:", r1.rows[0].mn, "to", r1.rows[0].mx, "rows:", r1.rows[0].c);

  // Report dates + asset classes in our window
  const r2 = await pool.query(`
    SELECT report_date::text d, array_agg(DISTINCT asset_class ORDER BY asset_class) acs
    FROM cot_snapshots
    WHERE report_date >= '2026-01-14'
    GROUP BY 1 ORDER BY 1
  `);
  console.log("\nReport dates:");
  for (const x of r2.rows) console.log(" ", x.d, x.acs.join(", "));

  // Sample one snapshot's pairs JSONB to see structure
  const r3 = await pool.query(`
    SELECT report_date::text d, asset_class, pairs
    FROM cot_snapshots
    WHERE report_date >= '2026-03-01' AND asset_class = 'fx'
    ORDER BY report_date DESC LIMIT 1
  `);
  if (r3.rows.length > 0) {
    console.log("\nSample FX pairs snapshot (" + r3.rows[0].d + "):");
    const pairs = r3.rows[0].pairs;
    const keys = Object.keys(pairs).sort();
    for (const k of keys.slice(0, 10)) {
      const p = pairs[k];
      console.log(" ", k, JSON.stringify(p));
    }
    console.log("  ... (" + keys.length + " total pairs)");
  }

  // Sample currencies JSONB
  const r4 = await pool.query(`
    SELECT report_date::text d, asset_class, currencies
    FROM cot_snapshots
    WHERE report_date >= '2026-03-01' AND asset_class = 'fx'
    ORDER BY report_date DESC LIMIT 1
  `);
  if (r4.rows.length > 0) {
    console.log("\nSample FX currencies (" + r4.rows[0].d + "):");
    const curr = r4.rows[0].currencies;
    for (const [k, v] of Object.entries(curr)) {
      console.log(" ", k, "dealer:", v.dealer_bias, "commercial:", v.commercial_bias, "blended:", v.blended_bias);
    }
  }

  // Also check indices/commodities
  const r5 = await pool.query(`
    SELECT report_date::text d, asset_class, pairs
    FROM cot_snapshots
    WHERE report_date >= '2026-03-01' AND asset_class IN ('indices', 'commodities')
    ORDER BY report_date DESC LIMIT 2
  `);
  for (const row of r5.rows) {
    console.log("\nSample", row.asset_class, "pairs (" + row.d + "):");
    const pairs = row.pairs;
    for (const [k, v] of Object.entries(pairs)) {
      console.log(" ", k, JSON.stringify(v));
    }
  }

  // Check ALL asset class currencies for dealer vs commercial
  const r6 = await pool.query(`
    SELECT asset_class, currencies FROM cot_snapshots WHERE report_date = '2026-03-17'
  `);
  for (const row of r6.rows) {
    console.log("\n" + row.asset_class + " currencies (dealer vs commercial):");
    for (const [k, v] of Object.entries(row.currencies)) {
      console.log("  " + k, "dealer:" + v.dealer_bias, "commercial:" + (v.commercial_bias || "null"), "blended:" + v.blended_bias);
    }
  }

  // Check a few weeks to see how directions change
  const r7 = await pool.query(`
    SELECT report_date::text d, asset_class, pairs FROM cot_snapshots
    WHERE asset_class = 'fx' AND report_date >= '2026-01-20'
    ORDER BY report_date
  `);
  console.log("\n\nFX pair count per week:");
  for (const row of r7.rows) {
    const p = row.pairs;
    const longs = Object.entries(p).filter(([,v]) => v.direction === "LONG").map(([k]) => k);
    const shorts = Object.entries(p).filter(([,v]) => v.direction === "SHORT").map(([k]) => k);
    console.log("  " + row.d, "LONG:" + longs.length, "SHORT:" + shorts.length, "total:" + Object.keys(p).length);
  }

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
