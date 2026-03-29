const pg = require("pg");
const pool = new pg.Pool({
  connectionString: "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db",
  ssl: { rejectUnauthorized: false },
});
const KEY = "c777758b5c9cb4bbc9f7486aa3f375f0-7aba11691f54eb0353b5a33dc20a1093";

async function run() {
  // DB daily bars for AUDJPY
  const db = await pool.query(
    "SELECT bar_open_utc, high_price::float h, low_price::float l FROM canonical_price_bars WHERE symbol='AUDJPY' AND timeframe='1d' ORDER BY bar_open_utc DESC LIMIT 12"
  );
  console.log("--- DB daily bars (AUDJPY) ---");
  db.rows.forEach(r => {
    console.log(r.bar_open_utc.toISOString().slice(0, 16), "H:" + r.h.toFixed(3), "L:" + r.l.toFixed(3), "R:" + (r.h - r.l).toFixed(4));
  });

  // Oanda API daily bars
  const url = "https://api-fxtrade.oanda.com/v3/instruments/AUD_JPY/candles?price=M&granularity=D&from=2026-03-08T00:00:00Z&to=2026-03-22T21:00:00Z";
  const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
  const d = await r.json();
  const bars = (d.candles || []).filter(c => c.complete && c.mid);
  console.log("\n--- Oanda API daily bars (AUDJPY) ---");
  bars.forEach(c => {
    const h = parseFloat(c.mid.h), l = parseFloat(c.mid.l);
    console.log(c.time.slice(0, 16), "H:" + h.toFixed(3), "L:" + l.toFixed(3), "R:" + (h - l).toFixed(4));
  });

  // ADR comparison
  const dbRanges = db.rows.slice(0, 10).map(r => r.h - r.l);
  const oaRanges = bars.slice(-10).map(c => parseFloat(c.mid.h) - parseFloat(c.mid.l));
  console.log("\nDB ADR:", (dbRanges.reduce((a, b) => a + b, 0) / dbRanges.length).toFixed(5));
  console.log("Oanda API ADR:", (oaRanges.reduce((a, b) => a + b, 0) / oaRanges.length).toFixed(5));
  console.log("Indicator ADR: 1.23700");

  // Now compute ADR directly from Oanda M5 bars aggregated to daily
  // This matches what TradingView does internally
  const m5url = "https://api-fxtrade.oanda.com/v3/instruments/AUD_JPY/candles?price=M&granularity=M5&from=2026-03-08T21:00:00Z&to=2026-03-22T21:00:00Z";
  const m5r = await fetch(m5url, { headers: { Authorization: "Bearer " + KEY } });
  const m5d = await m5r.json();
  const m5bars = (m5d.candles || []).filter(c => c.complete && c.mid);

  // Aggregate M5 bars into daily bars (21:00-21:00 UTC for FX)
  const dailyBuckets = {};
  m5bars.forEach(c => {
    const ts = new Date(c.time).getTime();
    // Day boundary at 21:00 UTC
    const d = new Date(ts);
    if (d.getUTCHours() < 21) d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(21, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    if (!dailyBuckets[key]) dailyBuckets[key] = { h: -Infinity, l: Infinity };
    dailyBuckets[key].h = Math.max(dailyBuckets[key].h, parseFloat(c.mid.h));
    dailyBuckets[key].l = Math.min(dailyBuckets[key].l, parseFloat(c.mid.l));
  });

  console.log("\n--- M5-aggregated daily bars (21:00 UTC boundary) ---");
  const aggEntries = Object.entries(dailyBuckets).sort().slice(-12);
  aggEntries.forEach(([k, v]) => {
    console.log(k, "H:" + v.h.toFixed(3), "L:" + v.l.toFixed(3), "R:" + (v.h - v.l).toFixed(4));
  });
  const aggRanges = aggEntries.slice(-10).map(([, v]) => v.h - v.l);
  console.log("M5-aggregated ADR:", (aggRanges.reduce((a, b) => a + b, 0) / aggRanges.length).toFixed(5));

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
