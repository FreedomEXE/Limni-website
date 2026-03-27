const { Pool } = require("pg");
const p = new Pool({
  connectionString: "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const r = await p.query(
    `SELECT symbol, direction, exit_reason, pnl_pct::float pnl, metadata::text m, week_open_utc
     FROM strategy_backtest_trades
     WHERE run_id = 54 AND week_open_utc < '2026-03-22T23:00:00Z'`
  );

  const classes = {};
  for (const ac of ["fx", "indices", "commodities", "crypto"]) {
    classes[ac] = { trades: 0, tp: 0, wc: 0, tpPnl: 0, wcPnl: 0, pairs: new Set(), weeks: new Set() };
  }

  r.rows.forEach(x => {
    const md = JSON.parse(x.m);
    const ac = md.assetClass || "fx";
    const c = classes[ac];
    if (!c) return;
    c.trades++;
    c.pairs.add(x.symbol);
    c.weeks.add(x.week_open_utc.toISOString().slice(0, 10));
    if (x.exit_reason === "tp") { c.tp++; c.tpPnl += (x.pnl || 0); }
    else if (x.exit_reason === "week_close") { c.wc++; c.wcPnl += (x.pnl || 0); }
  });

  console.log("=== BACKTEST BY ASSET CLASS (9 weeks) ===\n");

  for (const [ac, c] of Object.entries(classes)) {
    if (c.trades === 0) continue;
    const net = c.tpPnl + c.wcPnl;
    const wr = c.trades > 0 ? ((c.tp / c.trades) * 100).toFixed(1) : "0";
    console.log(ac.toUpperCase());
    console.log("  Pairs:", c.pairs.size, "| Trades:", c.trades, "| TP:", c.tp, "| Week Close:", c.wc);
    console.log("  TP profit:  +" + c.tpPnl.toFixed(2) + "%");
    console.log("  WC loss:    " + c.wcPnl.toFixed(2) + "%");
    console.log("  Net return: " + (net > 0 ? "+" : "") + net.toFixed(2) + "%");
    console.log("  Win Rate:   " + wr + "%");
    console.log("  Avg/trade:  " + (net / c.trades > 0 ? "+" : "") + (net / c.trades).toFixed(3) + "%");
    console.log();
  }

  // Also show the worst individual losers per class
  console.log("=== WORST LOSERS PER ASSET CLASS ===\n");
  const byClass = {};
  r.rows.filter(x => x.exit_reason === "week_close").forEach(x => {
    const md = JSON.parse(x.m);
    const ac = md.assetClass || "fx";
    if (!byClass[ac]) byClass[ac] = [];
    byClass[ac].push({ symbol: x.symbol, direction: x.direction, pnl: x.pnl });
  });

  for (const [ac, trades] of Object.entries(byClass)) {
    trades.sort((a, b) => a.pnl - b.pnl);
    console.log(ac.toUpperCase() + ":");
    trades.slice(0, 5).forEach(t => {
      console.log("  " + t.symbol.padEnd(12) + t.direction.padEnd(6) + " " + t.pnl.toFixed(2) + "%");
    });
    console.log();
  }

  await p.end();
}
run().catch(e => { console.error(e.message); p.end(); });
