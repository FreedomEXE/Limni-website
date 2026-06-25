const { Pool } = require("pg");
const { readFileSync } = require("fs");
try { const e = readFileSync(".env.local","utf8"); e.split("\n").forEach(l => { const t=l.trim(); if(!t||t[0]==="#")return; const i=t.indexOf("="); if(i<0)return; const k=t.slice(0,i).trim(); let v=t.slice(i+1).trim(); if((v[0]==='"'||v[0]==="'")&&v[0]===v.at(-1))v=v.slice(1,-1); if(!process.env[k])process.env[k]=v; }); } catch{}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function run() {
  const r = await pool.query(`
    SELECT bar_open_utc::text bo, bar_close_utc::text bc, open_price op, close_price cp
    FROM canonical_price_bars
    WHERE symbol = 'BTCUSD' AND timeframe = '1d'
      AND bar_open_utc >= '2026-03-21' AND bar_open_utc < '2026-03-24'
    ORDER BY bar_open_utc
  `);
  console.log("BTCUSD daily bars around week open:");
  for (const x of r.rows) console.log(x.bo, "→", x.bc, "O:", x.op, "C:", x.cp);

  // What does the weekly return use?
  const r2 = await pool.query(`
    SELECT open_price op, close_price cp, period_open_utc::text po
    FROM pair_period_returns
    WHERE symbol = 'BTCUSD' AND period_type = 'weekly' AND period_open_utc = '2026-03-22T23:00:00+00'
  `);
  console.log("\nWeekly return row:", r2.rows[0]);

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
