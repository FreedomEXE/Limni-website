const { Pool } = require("pg");
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  // For each of the 9 weeks, find the most recent sentiment snapshot at or near week open
  const weeks = [
    "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09",
    "2026-02-16", "2026-02-23", "2026-03-02", "2026-03-09", "2026-03-16"
  ];

  for (const week of weeks) {
    // Get the closest sentiment snapshot on or after this date
    const r = await p.query(
      `SELECT DISTINCT ON (symbol) symbol, crowding_state, agg_long_pct::float lp, timestamp_utc
       FROM sentiment_aggregates
       WHERE timestamp_utc >= $1::date AND timestamp_utc < ($1::date + interval '2 days')
       ORDER BY symbol, timestamp_utc ASC`,
      [week]
    );

    const long = r.rows.filter(x => x.crowding_state === "CROWDED_SHORT").length; // contrarian: crowd short = go long
    const short = r.rows.filter(x => x.crowding_state === "CROWDED_LONG").length;
    const neutral = r.rows.filter(x => x.crowding_state === "NEUTRAL").length;
    console.log(week, "pairs:", r.rows.length, "LONG:", long, "SHORT:", short, "NEUTRAL:", neutral);
  }

  // Show Jan 19 detail
  console.log("\nJan 19 detail:");
  const detail = await p.query(
    `SELECT DISTINCT ON (symbol) symbol, crowding_state, agg_long_pct::float lp
     FROM sentiment_aggregates
     WHERE timestamp_utc >= '2026-01-19' AND timestamp_utc < '2026-01-21'
     ORDER BY symbol, timestamp_utc ASC`
  );
  detail.rows.forEach(x => {
    const dir = x.crowding_state === "CROWDED_SHORT" ? "LONG" : x.crowding_state === "CROWDED_LONG" ? "SHORT" : "NEUTRAL";
    console.log("  " + x.symbol.padEnd(10) + dir.padEnd(8) + x.crowding_state.padEnd(15) + x.lp + "% long");
  });

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
