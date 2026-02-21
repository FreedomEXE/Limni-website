// Set DATABASE_URL before any imports
process.env.DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function main() {
  console.log("\n=== Verifying V2 Fix ===\n");

  // Get antikythera vs antikythera_v2 for a specific week
  const weekOpen = "2026-01-19T00:00:00.000Z";

  const result = await pool.query(
    `SELECT model, asset_class, total, priced, percent, pair_details
     FROM performance_snapshots
     WHERE week_open_utc = $1
     AND model IN ('antikythera', 'antikythera_v2')
     ORDER BY asset_class, model`,
    [weekOpen]
  );

  console.log(`Week: ${weekOpen}\n`);

  for (const row of result.rows) {
    const pairDetails = row.pair_details || [];
    const firstPair = pairDetails[0];
    const reason = firstPair?.reason?.[0] || "N/A";

    console.log(`[${row.asset_class}] ${row.model}:`);
    console.log(`  Total pairs: ${row.total}`);
    console.log(`  Priced: ${row.priced}`);
    console.log(`  Return: +${parseFloat(row.percent || 0).toFixed(2)}%`);
    console.log(`  First pair reason: ${reason}`);
    console.log();
  }

  // Get summary across all 5 weeks
  console.log("=== 5-Week Summary ===\n");

  const summary = await pool.query(
    `SELECT model,
            COUNT(*) as weeks,
            SUM(priced) as total_trades,
            SUM(percent) as total_return
     FROM performance_snapshots
     WHERE model IN ('antikythera', 'antikythera_v2')
     GROUP BY model
     ORDER BY model`
  );

  for (const row of summary.rows) {
    console.log(`${row.model}:`);
    console.log(`  Total return: +${parseFloat(row.total_return).toFixed(2)}%`);
    console.log(`  Total trades: ${row.total_trades}`);
    console.log(`  Snapshots: ${row.weeks}`);
    console.log();
  }

  await pool.end();
}

main().catch(console.error);
