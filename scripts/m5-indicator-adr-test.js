const KEY = "c777758b5c9cb4bbc9f7486aa3f375f0-7aba11691f54eb0353b5a33dc20a1093";
const BASE = "https://api-fxtrade.oanda.com";

// ALL pairs with indicator's EXACT ADR from screenshots (pips -> absolute)
const PAIRS = [
  { pair: "AUDJPY", inst: "AUD_JPY", dir: "LONG", adr: 1.237, ws: "2026-03-22T21:00:00Z", ind: 3 },
  { pair: "AUDNZD", inst: "AUD_NZD", dir: "LONG", adr: 0.00685, ws: "2026-03-22T21:00:00Z", ind: 1 },
  { pair: "AUDUSD", inst: "AUD_USD", dir: "LONG", adr: 0.00964, ws: "2026-03-22T21:00:00Z", ind: 3 },
  { pair: "CADCHF", inst: "CAD_CHF", dir: "SHORT", adr: 0.00376, ws: "2026-03-22T21:00:00Z", ind: 1 },
  { pair: "CADJPY", inst: "CAD_JPY", dir: "LONG", adr: 0.904, ws: "2026-03-22T21:00:00Z", ind: 1 },
  { pair: "CHFJPY", inst: "CHF_JPY", dir: "LONG", adr: 1.28, ws: "2026-03-22T21:00:00Z", ind: 2 },
  { pair: "EURAUD", inst: "EUR_AUD", dir: "SHORT", adr: 0.01337, ws: "2026-03-22T21:00:00Z", ind: 4 },
  { pair: "EURCHF", inst: "EUR_CHF", dir: "SHORT", adr: 0.00447, ws: "2026-03-22T21:00:00Z", ind: 2 },
  { pair: "EURJPY", inst: "EUR_JPY", dir: "LONG", adr: 0.98, ws: "2026-03-22T21:00:00Z", ind: 2 },
  { pair: "EURNZD", inst: "EUR_NZD", dir: "LONG", adr: 0.01236, ws: "2026-03-22T21:00:00Z", ind: 2 },
  { pair: "GBPAUD", inst: "GBP_AUD", dir: "SHORT", adr: 0.01552, ws: "2026-03-22T21:00:00Z", ind: 4 },
  { pair: "GBPCHF", inst: "GBP_CHF", dir: "SHORT", adr: 0.00577, ws: "2026-03-22T21:00:00Z", ind: 3 },
  { pair: "GBPNZD", inst: "GBP_NZD", dir: "SHORT", adr: 0.01535, ws: "2026-03-22T21:00:00Z", ind: 3 },
  { pair: "NIKKEIUSD", inst: "JP225_USD", dir: "LONG", adr: 1925.36, ws: "2026-03-22T22:00:00Z", ind: 2 },
  { pair: "NDXUSD", inst: "NAS100_USD", dir: "SHORT", adr: 510.59, ws: "2026-03-22T22:00:00Z", ind: 1 },
  { pair: "NZDCAD", inst: "NZD_CAD", dir: "SHORT", adr: 0.00862, ws: "2026-03-22T21:00:00Z", ind: 2 },
  { pair: "NZDCHF", inst: "NZD_CHF", dir: "SHORT", adr: 0.00374, ws: "2026-03-22T21:00:00Z", ind: 2 },
  { pair: "NZDJPY", inst: "NZD_JPY", dir: "LONG", adr: 0.849, ws: "2026-03-22T21:00:00Z", ind: 2 },
  { pair: "NZDUSD", inst: "NZD_USD", dir: "SHORT", adr: 0.00733, ws: "2026-03-22T21:00:00Z", ind: 2 },
  { pair: "SPXUSD", inst: "SPX500_USD", dir: "LONG", adr: 119.47, ws: "2026-03-22T22:00:00Z", ind: 3 },
  { pair: "USDCHF", inst: "USD_CHF", dir: "SHORT", adr: 0.00656, ws: "2026-03-22T21:00:00Z", ind: 3 },
  { pair: "USDJPY", inst: "USD_JPY", dir: "LONG", adr: 1.093, ws: "2026-03-22T21:00:00Z", ind: 1 },
  { pair: "XAUUSD", inst: "XAU_USD", dir: "SHORT", adr: 143.746, ws: "2026-03-22T22:00:00Z", ind: 1 },
];

async function fetchM5(inst, from, to) {
  const url = `${BASE}/v3/instruments/${inst}/candles?price=M&granularity=M5&from=${from}&to=${to}`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + KEY } });
  const d = await r.json();
  return (d.candles || []).filter(c => c.complete && c.mid).map(c => ({
    ts: new Date(c.time).getTime(),
    high: +c.mid.h,
    low: +c.mid.l,
  }));
}

function scan(bars, dir, rawAdr) {
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
    const e = dir === "LONG" ? pr - rawAdr : pr + rawAdr;
    const t = dir === "LONG" ? e + rawAdr * 0.25 : e - rawAdr * 0.25;
    if (dir === "LONG" ? b.low <= e : b.high >= e) { n++; tp = t; it = true; }
  }
  return n;
}

async function main() {
  let match = 0, total = 0;
  const res = [];

  for (const { pair, inst, dir, adr, ws, ind } of PAIRS) {
    const b1 = await fetchM5(inst, ws, "2026-03-24T12:00:00Z");
    const b2 = await fetchM5(inst, "2026-03-24T12:00:00Z", "2026-03-26T12:00:00Z");
    const b3 = await fetchM5(inst, "2026-03-26T12:00:00Z", "2026-03-27T02:00:00Z");
    const bars = [...b1, ...b2, ...b3];
    const t = scan(bars, dir, adr);
    const g = t - ind;
    const st = g === 0 ? "MATCH" : g > 0 ? "+" + g + " ghost" : g + " under";
    res.push({ pair, ind, t, g, st });
    if (g === 0) match++;
    total++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("\n=== M5 + INDICATOR EXACT ADR + CORRECTED WEEK START ===\n");
  console.log("Pair".padEnd(12), "Ind", "M5", "Gap", "Status");
  console.log("-".repeat(50));
  res.forEach(r => console.log(r.pair.padEnd(12), String(r.ind).padEnd(4), String(r.t).padEnd(4), String(r.g).padEnd(5), r.st));
  console.log("-".repeat(50));
  console.log("Match:", match + "/" + total, "(" + Math.round(match / total * 100) + "%)");
}

main().catch(e => console.error(e.message));
