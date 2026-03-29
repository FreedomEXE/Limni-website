import { scanAdrTrades } from "../src/lib/flagship/adrTradeScanner.ts";

const OANDA_KEY = "c777758b5c9cb4bbc9f7486aa3f375f0-7aba11691f54eb0353b5a33dc20a1093";
const BASE = "https://api-fxtrade.oanda.com";

async function fetchM5(from: string, to: string) {
  const url = `${BASE}/v3/instruments/XAU_USD/candles?price=M&granularity=M5&from=${from}&to=${to}`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + OANDA_KEY } });
  const d = await r.json() as any;
  return (d.candles || []).filter((c: any) => c.complete && c.mid).map((c: any) => ({
    ts: new Date(c.time).getTime(),
    open: parseFloat(c.mid.o),
    high: parseFloat(c.mid.h),
    low: parseFloat(c.mid.l),
    close: parseFloat(c.mid.c),
  }));
}

const bars1 = await fetchM5("2026-03-22T23:00:00Z", "2026-03-24T01:00:00Z");
const bars2 = await fetchM5("2026-03-24T01:00:00Z", "2026-03-25T03:00:00Z");
const bars3 = await fetchM5("2026-03-25T03:00:00Z", "2026-03-26T05:00:00Z");
const bars4 = await fetchM5("2026-03-26T05:00:00Z", "2026-03-27T00:00:00Z");
const allBars = [...bars1, ...bars2, ...bars3, ...bars4];

console.log("Total M5 bars:", allBars.length);
console.log("First bar:", new Date(allBars[0].ts).toISOString(), "H:", allBars[0].high, "L:", allBars[0].low);
console.log("Week low:", Math.min(...allBars.map(b => b.low)).toFixed(3));

const adrDistance = 143.746;
const adrPct = (adrDistance / allBars[0].open) * 100;

const trades = scanAdrTrades({
  pair: "XAUUSD",
  assetClass: "commodities",
  direction: "SHORT",
  weekOpenUtc: "2026-03-22T23:00:00.000Z",
  adrPct,
  adrAbsoluteDistance: adrDistance,
  bars: allBars,
  entryMultiple: 1.0,
  tpMultiple: 0.25,
});

console.log("\n=== GOLD M5 SCANNER RESULTS ===");
console.log("Total trades:", trades.length);
trades.forEach((t, i) => {
  console.log(`\nTrade ${i + 1}:`);
  console.log("  Entry:", t.entryPrice.toFixed(3), "at", t.entryUtc);
  console.log("  TP:", t.tpPrice.toFixed(3));
  console.log("  Anchor:", t.anchorPrice.toFixed(3));
  console.log("  Exit:", t.exitType, t.exitUtc || "ACTIVE");
});
