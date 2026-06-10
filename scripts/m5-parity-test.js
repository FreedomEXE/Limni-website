const { Pool } = require("pg");
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const KEY = "c777758b5c9cb4bbc9f7486aa3f375f0-7aba11691f54eb0353b5a33dc20a1093";
const BASE = "https://api-fxtrade.oanda.com";

const PAIRS = [
  { pair: "AUDJPY", oanda: "AUD_JPY", dir: "LONG" },
  { pair: "AUDNZD", oanda: "AUD_NZD", dir: "LONG" },
  { pair: "AUDUSD", oanda: "AUD_USD", dir: "LONG" },
  { pair: "CADCHF", oanda: "CAD_CHF", dir: "SHORT" },
  { pair: "CADJPY", oanda: "CAD_JPY", dir: "LONG" },
  { pair: "CHFJPY", oanda: "CHF_JPY", dir: "LONG" },
  { pair: "EURAUD", oanda: "EUR_AUD", dir: "SHORT" },
  { pair: "EURCHF", oanda: "EUR_CHF", dir: "SHORT" },
  { pair: "EURJPY", oanda: "EUR_JPY", dir: "LONG" },
  { pair: "EURNZD", oanda: "EUR_NZD", dir: "LONG" },
  { pair: "GBPAUD", oanda: "GBP_AUD", dir: "SHORT" },
  { pair: "GBPCHF", oanda: "GBP_CHF", dir: "SHORT" },
  { pair: "GBPNZD", oanda: "GBP_NZD", dir: "SHORT" },
  { pair: "NIKKEIUSD", oanda: "JP225_USD", dir: "LONG" },
  { pair: "NDXUSD", oanda: "NAS100_USD", dir: "SHORT" },
  { pair: "NZDCAD", oanda: "NZD_CAD", dir: "SHORT" },
  { pair: "NZDCHF", oanda: "NZD_CHF", dir: "SHORT" },
  { pair: "NZDJPY", oanda: "NZD_JPY", dir: "LONG" },
  { pair: "NZDUSD", oanda: "NZD_USD", dir: "SHORT" },
  { pair: "SPXUSD", oanda: "SPX500_USD", dir: "LONG" },
  { pair: "USDCHF", oanda: "USD_CHF", dir: "SHORT" },
  { pair: "USDJPY", oanda: "USD_JPY", dir: "LONG" },
  { pair: "XAUUSD", oanda: "XAU_USD", dir: "SHORT" },
];

const INDICATOR = {
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

async function getAdr(pair) {
  const rows = await p.query(
    "SELECT high_price::float as h, low_price::float as l FROM canonical_price_bars WHERE symbol=$1 AND timeframe='1d' AND bar_open_utc < '2026-03-22T23:00:00Z' ORDER BY bar_open_utc DESC LIMIT 10",
    [pair]
  );
  if (rows.rows.length < 5) return null;
  const ranges = rows.rows.map(r => r.h - r.l);
  return ranges.reduce((s, v) => s + v, 0) / ranges.length;
}

// Inline scanner (matches adrTradeScanner.ts with anchor seed fix)
function scan(bars, dir, rawAdr) {
  const entryDist = rawAdr;
  let anchor = null, inTrade = false, n = 0, tp = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (inTrade) {
      if (dir === "LONG" ? b.high >= tp : b.low <= tp) {
        inTrade = false;
        anchor = dir === "LONG" ? b.high : b.low; // Fresh Start seed from TP bar
      }
      continue;
    }
    if (anchor === null) { anchor = dir === "LONG" ? b.high : b.low; continue; }
    const prev = anchor;
    anchor = dir === "LONG" ? Math.max(anchor, b.high) : Math.min(anchor, b.low);
    const e = dir === "LONG" ? prev - entryDist : prev + entryDist;
    const t = dir === "LONG" ? e + rawAdr * 0.25 : e - rawAdr * 0.25;
    const hit = dir === "LONG" ? b.low <= e : b.high >= e;
    if (hit) { n++; tp = t; inTrade = true; }
  }
  return n;
}

async function main() {
  let match = 0, total = 0;
  const results = [];

  for (const { pair, oanda, dir } of PAIRS) {
    const adr = await getAdr(pair);
    if (!adr) { console.log(pair, "SKIP (no ADR)"); continue; }

    const b1 = await fetchM5(oanda, "2026-03-22T23:00:00Z", "2026-03-24T12:00:00Z");
    const b2 = await fetchM5(oanda, "2026-03-24T12:00:00Z", "2026-03-26T12:00:00Z");
    const b3 = await fetchM5(oanda, "2026-03-26T12:00:00Z", "2026-03-27T00:00:00Z");
    const bars = [...b1, ...b2, ...b3];

    const trades = scan(bars, dir, adr);
    const ind = INDICATOR[pair] || 0;
    const gap = trades - ind;
    const status = gap === 0 ? "MATCH" : gap > 0 ? "+" + gap + " ghost" : gap + " under";
    results.push({ pair, dir, ind, trades, gap, status });
    if (gap === 0) match++;
    total++;

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  console.log("\n=== M5 PARITY TEST (anchor seed fix) ===\n");
  console.log("Pair".padEnd(12), "Dir".padEnd(6), "Ind", "M5", "Gap", "Status");
  console.log("-".repeat(55));
  results.forEach(r => {
    console.log(r.pair.padEnd(12), r.dir.padEnd(6), String(r.ind).padEnd(4), String(r.trades).padEnd(4), String(r.gap).padEnd(5), r.status);
  });
  console.log("-".repeat(55));
  console.log("Match:", match + "/" + total, "(" + Math.round(match/total*100) + "%)");

  await p.end();
}
main().catch(e => { console.error(e.message); p.end(); });
