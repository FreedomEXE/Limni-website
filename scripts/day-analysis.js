const { Pool } = require("pg");
const p = new Pool({
  connectionString: "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const r = await p.query(
    `SELECT entry_time_utc, exit_time_utc, exit_reason, pnl_pct::float, symbol, direction, week_open_utc
     FROM strategy_backtest_trades
     WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z'
     ORDER BY entry_time_utc`
  );

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  console.log("Total trades (9 completed weeks):", r.rows.length);

  const byReason = {};
  r.rows.forEach(x => { byReason[x.exit_reason] = (byReason[x.exit_reason] || 0) + 1; });
  console.log("By exit reason:", JSON.stringify(byReason));
  console.log();

  // Entry day breakdown
  const stats = {};
  for (const d of days) stats[d] = { entries: 0, tp: 0, wc: 0, active: 0 };
  r.rows.forEach(x => {
    const d = days[new Date(x.entry_time_utc).getUTCDay()];
    stats[d].entries++;
    if (x.exit_reason === "tp") stats[d].tp++;
    else if (x.exit_reason === "week_close") stats[d].wc++;
    else stats[d].active++;
  });

  console.log("=== ENTRY DAY BREAKDOWN ===");
  console.log("Day".padEnd(6), "Enter".padEnd(6), "TP".padEnd(5), "WkClose".padEnd(8), "WinRate");
  console.log("-".repeat(45));
  for (const d of days) {
    const s = stats[d];
    if (!s.entries) continue;
    const wr = s.entries > 0 ? ((s.tp / s.entries) * 100).toFixed(1) : "0";
    console.log(d.padEnd(6), String(s.entries).padEnd(6), String(s.tp).padEnd(5), String(s.wc).padEnd(8), wr + "%");
  }

  // Non-TP trades detail
  console.log("\n=== NON-TP TRADES ===");
  const nonTp = r.rows.filter(x => x.exit_reason !== "tp");
  nonTp.forEach(x => {
    const ed = new Date(x.entry_time_utc);
    const d = days[ed.getUTCDay()];
    const pnl = x.pnl_pct !== null ? x.pnl_pct.toFixed(3) + "%" : "n/a";
    console.log(d, x.symbol.padEnd(10), x.direction.padEnd(6), "entry:" + ed.toISOString().slice(5, 16), "exit:" + x.exit_reason, "pnl:" + pnl);
  });

  // Entry HOUR breakdown for non-TP
  console.log("\n=== ENTRY HOUR (UTC) for non-TP trades ===");
  const hourBuckets = {};
  nonTp.forEach(x => {
    const h = new Date(x.entry_time_utc).getUTCHours();
    hourBuckets[h] = (hourBuckets[h] || 0) + 1;
  });
  Object.entries(hourBuckets).sort((a, b) => +a[0] - +b[0]).forEach(([h, c]) => {
    console.log(h.toString().padStart(2, "0") + ":00 UTC", c, "trades");
  });

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
