const { Pool } = require("pg");
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const KEY = "c777758b5c9cb4bbc9f7486aa3f375f0-7aba11691f54eb0353b5a33dc20a1093";
const BASE = "https://api-fxtrade.oanda.com";

// FX = Sunday 21:00 UTC (5PM ET), Gold/Commodities/Indices = Sunday 22:00 UTC (6PM ET)
const PAIRS = [
  { pair: "AUDJPY", oanda: "AUD_JPY", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "AUDNZD", oanda: "AUD_NZD", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "AUDUSD", oanda: "AUD_USD", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "CADCHF", oanda: "CAD_CHF", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "CADJPY", oanda: "CAD_JPY", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "CHFJPY", oanda: "CHF_JPY", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "EURAUD", oanda: "EUR_AUD", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "EURCHF", oanda: "EUR_CHF", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "EURJPY", oanda: "EUR_JPY", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "EURNZD", oanda: "EUR_NZD", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "GBPAUD", oanda: "GBP_AUD", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "GBPCHF", oanda: "GBP_CHF", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "GBPNZD", oanda: "GBP_NZD", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "NIKKEIUSD", oanda: "JP225_USD", dir: "LONG", ws: "2026-03-22T22:00:00Z" },
  { pair: "NDXUSD", oanda: "NAS100_USD", dir: "SHORT", ws: "2026-03-22T22:00:00Z" },
  { pair: "NZDCAD", oanda: "NZD_CAD", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "NZDCHF", oanda: "NZD_CHF", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "NZDJPY", oanda: "NZD_JPY", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "NZDUSD", oanda: "NZD_USD", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "SPXUSD", oanda: "SPX500_USD", dir: "LONG", ws: "2026-03-22T22:00:00Z" },
  { pair: "USDCHF", oanda: "USD_CHF", dir: "SHORT", ws: "2026-03-22T21:00:00Z" },
  { pair: "USDJPY", oanda: "USD_JPY", dir: "LONG", ws: "2026-03-22T21:00:00Z" },
  { pair: "XAUUSD", oanda: "XAU_USD", dir: "SHORT", ws: "2026-03-22T22:00:00Z" },
];

const IND = {
  AUDJPY:3,AUDNZD:1,AUDUSD:3,CADCHF:1,CADJPY:1,CHFJPY:2,
  EURAUD:4,EURCHF:2,EURJPY:2,EURNZD:2,GBPAUD:4,GBPCHF:3,
  GBPNZD:3,NIKKEIUSD:2,NDXUSD:1,NZDCAD:2,NZDCHF:2,NZDJPY:2,
  NZDUSD:2,SPXUSD:3,USDCHF:3,USDJPY:1,XAUUSD:1,
};

async function fetchM5(oanda, from, to) {
  const url = `${BASE}/v3/instruments/${oanda}/candles?price=M&granularity=M5&from=${from}&to=${to}`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
  const d = await r.json();
  return (d.candles || []).filter(c => c.complete && c.mid).map(c => ({
    ts: new Date(c.time).getTime(),
    high: +c.mid.h,
    low: +c.mid.l,
  }));
}

async function getAdr(pair, before) {
  const rows = await p.query(
    "SELECT high_price::float as h, low_price::float as l FROM canonical_price_bars WHERE symbol=$1 AND timeframe='1d' AND bar_open_utc < $2 ORDER BY bar_open_utc DESC LIMIT 10",
    [pair, before]
  );
  if (rows.rows.length < 5) return null;
  const ranges = rows.rows.map(r => r.h - r.l);
  return ranges.reduce((s, v) => s + v, 0) / ranges.length;
}

function scan(bars, dir, rawAdr) {
  const ed = rawAdr;
  let a = null, it = false, n = 0, tp = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (it) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        it = false;
        a = dir === "LONG" ? b.high : b.low;
      }
      continue;
    }
    if (a === null) { a = dir === "LONG" ? b.high : b.low; continue; }
    const pr = a;
    a = dir === "LONG" ? Math.max(a, b.high) : Math.min(a, b.low);
    const e = dir === "LONG" ? pr - ed : pr + ed;
    const t = dir === "LONG" ? e + rawAdr * 0.25 : e - rawAdr * 0.25;
    if (dir === "LONG" ? b.low <= e : b.high >= e) { n++; tp = t; it = true; }
  }
  return n;
}

async function main() {
  let match = 0;
  const res = [];
  for (const { pair, oanda, dir, ws } of PAIRS) {
    const adr = await getAdr(pair, ws);
    if (!adr) { console.log(pair, "SKIP (no ADR)"); continue; }
    const b1 = await fetchM5(oanda, ws, "2026-03-24T12:00:00Z");
    const b2 = await fetchM5(oanda, "2026-03-24T12:00:00Z", "2026-03-26T12:00:00Z");
    const b3 = await fetchM5(oanda, "2026-03-26T12:00:00Z", "2026-03-27T02:00:00Z");
    const bars = [...b1, ...b2, ...b3];
    const t = scan(bars, dir, adr);
    const ind = IND[pair] || 0;
    const g = t - ind;
    const st = g === 0 ? "MATCH" : g > 0 ? "+" + g + " ghost" : g + " under";
    res.push({ pair, ind, t, g, st });
    if (g === 0) match++;
    await new Promise(r => setTimeout(r, 250));
  }
  console.log("\n=== M5 + CORRECTED WEEK START ===\n");
  console.log("Pair".padEnd(12), "Ind", "M5", "Gap", "Status");
  console.log("-".repeat(50));
  res.forEach(r => console.log(r.pair.padEnd(12), String(r.ind).padEnd(4), String(r.t).padEnd(4), String(r.g).padEnd(5), r.st));
  console.log("-".repeat(50));
  console.log("Match:", match + "/" + res.length, "(" + Math.round(match / res.length * 100) + "%)");
  await p.end();
}
main().catch(e => { console.error(e.message); p.end(); });
