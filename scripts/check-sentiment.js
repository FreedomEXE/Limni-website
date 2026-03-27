const { Pool } = require("pg");
const p = new Pool({
  connectionString: "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  // Check all sentiment tables
  for (const table of ["sentiment_aggregates", "sentiment_daily_snapshots", "sentiment_data"]) {
    const cols = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [table]);
    console.log(table + ":");
    cols.rows.forEach(x => console.log("  " + x.column_name));

    // Check date range
    const dateCol = cols.rows.find(x => x.column_name.includes("date") || x.column_name.includes("timestamp"));
    if (dateCol) {
      const range = await p.query("SELECT MIN(" + dateCol.column_name + ") as e, MAX(" + dateCol.column_name + ") as l, COUNT(*) as t FROM " + table);
      console.log("  Range:", range.rows[0].e?.toISOString?.()?.slice(0, 10) || range.rows[0].e, "to", range.rows[0].l?.toISOString?.()?.slice(0, 10) || range.rows[0].l, "(" + range.rows[0].t + " rows)");
    }
    console.log();
  }

  // Check if there's a weekly sentiment table or pair_period_returns with sentiment
  const weeklyCheck = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%weekly%' OR table_name LIKE '%week%' ORDER BY table_name");
  console.log("Tables with 'week' in name:");
  weeklyCheck.rows.forEach(x => console.log("  " + x.table_name));

  // Check pair_period_returns for sentiment model
  const pprCheck = await p.query("SELECT DISTINCT model FROM pair_period_returns WHERE model LIKE '%sentiment%' OR model LIKE '%crowd%' LIMIT 10");
  console.log("\npair_period_returns sentiment models:");
  pprCheck.rows.forEach(x => console.log("  " + x.model));

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
