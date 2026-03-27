const { Pool } = require("pg");
const p = new Pool({
  connectionString: "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const r = await p.query(
    `SELECT entry_time_utc, symbol, direction, entry_price::float ep, exit_price::float xp, pnl_pct::float pnl, exit_reason, week_open_utc
     FROM strategy_backtest_trades
     WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' AND exit_reason = 'week_close'
     ORDER BY pnl_pct ASC`
  );

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  console.log("=== ALL 26 WEEK-CLOSE (LOSING) TRADES ===\n");
  console.log("Day".padEnd(5), "Pair".padEnd(12), "Dir".padEnd(6), "P/L".padEnd(10), "Entry Time");
  console.log("-".repeat(60));

  let total = 0;
  const byDay = {};
  for (const d of days) byDay[d] = { count: 0, pnl: 0 };

  r.rows.forEach(x => {
    const d = days[new Date(x.entry_time_utc).getUTCDay()];
    byDay[d].count++;
    byDay[d].pnl += x.pnl;
    total += x.pnl;
    const pnlStr = (x.pnl > 0 ? "+" : "") + x.pnl.toFixed(2) + "%";
    console.log(d.padEnd(5), x.symbol.padEnd(12), x.direction.padEnd(6), pnlStr.padEnd(10), x.entry_time_utc.toISOString().slice(5, 16));
  });

  console.log("-".repeat(60));
  console.log("Total week-close loss:", total.toFixed(2) + "%");
  console.log("Count:", r.rows.length);

  console.log("\n=== LOSS BY ENTRY DAY ===\n");
  console.log("Day".padEnd(6), "Count".padEnd(7), "Total Loss".padEnd(12), "Avg Loss");
  console.log("-".repeat(40));
  for (const d of days) {
    const s = byDay[d];
    if (s.count === 0) continue;
    const avg = (s.pnl / s.count).toFixed(2);
    console.log(d.padEnd(6), String(s.count).padEnd(7), (s.pnl.toFixed(2) + "%").padEnd(12), avg + "%");
  }
  console.log("-".repeat(40));
  console.log("\nIf we stopped entering after Wednesday:");
  const thuFriLoss = (byDay["Thu"].pnl + byDay["Fri"].pnl);
  const thuFriCount = byDay["Thu"].count + byDay["Fri"].count;
  console.log("  Would eliminate", thuFriCount, "losers saving", Math.abs(thuFriLoss).toFixed(2) + "%");
  console.log("  But also lose Thu+Fri TP winners...");

  // Count Thu+Fri TP trades
  const tp = await p.query(
    `SELECT entry_time_utc FROM strategy_backtest_trades
     WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z' AND exit_reason = 'tp'`
  );
  let thuFriTp = 0;
  tp.rows.forEach(x => {
    const d = days[new Date(x.entry_time_utc).getUTCDay()];
    if (d === "Thu" || d === "Fri") thuFriTp++;
  });
  console.log("  Would also lose", thuFriTp, "TP winners (", (thuFriTp * 0.25).toFixed(2) + "% profit)");
  console.log("  Net impact:", (Math.abs(thuFriLoss) - thuFriTp * 0.25).toFixed(2) + "% saved");

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
