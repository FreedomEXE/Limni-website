import { DateTime } from "luxon";
import fs from "node:fs";
import path from "node:path";

import type { Mt5AccountSnapshot, Mt5ClosedPosition } from "@/lib/mt5Store";
import { fetchOandaCandle } from "@/lib/oandaPrices";
import { listAssetClasses } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

type AssetClassId = ReturnType<typeof listAssetClasses>[number]["id"];

function loadDotEnv() {
  const cwd = process.cwd();
  const candidates = [".env.local", ".env"];
  for (const filename of candidates) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (!key) continue;
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function parseBasketFromComment(comment: string) {
  if (!comment) {
    return null;
  }
  const match = comment.match(/LimniBasket\s+([A-Za-z0-9_]+)/i);
  const normalized = match?.[1]?.toLowerCase() ?? null;
  if (normalized) return normalized;
  const lower = comment.toLowerCase();
  for (const key of ["antikythera", "blended", "dealer", "commercial", "sentiment"]) {
    if (lower.includes(key)) return key;
  }
  return null;
}

function normalizeSymbol(symbol: string) {
  const upper = symbol.trim().toUpperCase();
  if (!upper) return "";
  // Strip common broker suffixes/prefixes and separators.
  // Examples: "EURUSD.m" -> "EURUSD", "XAUUSD-ECN" -> "XAUUSD"
  const cleaned = upper.replace(/[^A-Z0-9]/g, "");
  // Many FX pairs are 6 chars. If it looks like FX with suffix, trim to 6.
  if (cleaned.length > 6 && /^[A-Z]{6}[A-Z0-9]+$/.test(cleaned)) {
    return cleaned.slice(0, 6);
  }
  return cleaned;
}

function buildAssetClassMap() {
  const map = new Map<string, AssetClassId>();
  for (const asset of listAssetClasses()) {
    const defs = PAIRS_BY_ASSET_CLASS[asset.id];
    for (const def of defs) {
      map.set(def.pair.toUpperCase(), asset.id);
    }
  }
  // Helpful aliases for common broker naming.
  map.set("SPX500", "indices");
  map.set("NAS100", "indices");
  map.set("NDX100", "indices");
  map.set("JP225", "indices");
  map.set("JPN225", "indices");
  map.set("WTICO", "commodities");
  map.set("USOUSD", "commodities");
  return map;
}

async function main() {
  loadDotEnv();

  const baseUrl =
    (process.env.LIMNI_API_BASE ?? "").trim() || "https://limni-website-nine.vercel.app";

  async function fetchJson<T>(pathname: string): Promise<T> {
    const url = new URL(pathname, baseUrl);
    const res = await fetch(url.toString(), { headers: { "cache-control": "no-store" } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} ${url.toString()}: ${body}`);
    }
    return (await res.json()) as T;
  }

  const { accounts } = await fetchJson<{ accounts: Mt5AccountSnapshot[] }>("/api/mt5/accounts");
  const eightcapCandidates = accounts
    .filter((a) => /eightcap/i.test(`${a.broker ?? ""} ${a.server ?? ""} ${a.label ?? ""}`))
    .sort((a, b) => (b.equity ?? 0) - (a.equity ?? 0));

  if (eightcapCandidates.length === 0) {
    console.log("No MT5 accounts matched 'Eightcap'. Available accounts:");
    for (const a of accounts) {
      console.log(`- ${a.account_id} | ${a.label} | ${a.broker} | ${a.trade_mode ?? "AUTO"} | equity=${a.equity}`);
    }
    process.exitCode = 1;
    return;
  }

  const account = eightcapCandidates[0];
  const accountId = account.account_id;
  const lotMapRows = account.lot_map ?? [];
  const targetWeek = (process.env.WEEK_OPEN_UTC ?? "2026-02-02T05:00:00.000Z").trim();

  if (!targetWeek) {
    console.log(`No week options for account ${accountId}`);
    process.exitCode = 1;
    return;
  }

  const weekOpen = DateTime.fromISO(targetWeek, { zone: "utc" });
  const weekEnd = weekOpen.plus({ days: 7 });
  const nowUtc = DateTime.utc();
  // OANDA rejects `to` in the future. Clamp the sim window end to "now" when running mid-week.
  const simEnd = weekEnd <= nowUtc ? weekEnd : nowUtc.minus({ minutes: 5 });

  const closedResp = await fetchJson<{
    account_id: string;
    count: number;
    positions: Mt5ClosedPosition[];
  }>(`/api/mt5/closed-positions/${encodeURIComponent(accountId)}?limit=5000`);

  const closedAll = closedResp.positions ?? [];
  const closed = closedAll.filter((t) => {
    const ct = DateTime.fromISO(t.close_time, { zone: "utc" });
    return ct.isValid && ct >= weekOpen && ct < weekEnd;
  });
  const assetClassMap = buildAssetClassMap();

  type Row = {
    symbol: string;
    canonical: string;
    assetClass: string;
    basket: string;
    type: "BUY" | "SELL";
    lots: number;
    net: number;
    open_time: string;
    open_price: number;
    close_time: string;
    close_price: number;
  };

  const rows: Row[] = closed.map((t) => {
    const canonical = normalizeSymbol(t.symbol);
    const assetClass = assetClassMap.get(canonical) ?? assetClassMap.get(t.symbol.toUpperCase()) ?? "unknown";
    const basket = parseBasketFromComment(t.comment) ?? "unknown";
    const net = t.profit + t.swap + t.commission;
    return {
      symbol: t.symbol,
      canonical,
      assetClass,
      basket,
      type: t.type,
      lots: t.lots,
      net,
      open_time: t.open_time,
      open_price: t.open_price,
      close_time: t.close_time,
      close_price: t.close_price,
    };
  });

  const totalNet = rows.reduce((acc, r) => acc + r.net, 0);
  const byAsset = new Map<string, { net: number; trades: number; absLots: number }>();
  const byBasket = new Map<string, { net: number; trades: number }>();

  for (const r of rows) {
    const a = byAsset.get(r.assetClass) ?? { net: 0, trades: 0, absLots: 0 };
    a.net += r.net;
    a.trades += 1;
    a.absLots += Math.abs(r.lots);
    byAsset.set(r.assetClass, a);

    const b = byBasket.get(r.basket) ?? { net: 0, trades: 0 };
    b.net += r.net;
    b.trades += 1;
    byBasket.set(r.basket, b);
  }

  console.log(`Eightcap account: ${accountId} | ${account.label} | equity=${account.equity}`);
  console.log(`Week: ${targetWeek} -> ${weekEnd.toUTC().toISO()}`);
  console.log(`Closed trades: ${rows.length}`);
  console.log(`Realized net (profit+swap+commission): ${totalNet.toFixed(2)} ${account.currency ?? "USD"}`);

  console.log("\nBy asset class (realized):");
  for (const [asset, agg] of Array.from(byAsset.entries()).sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))) {
    console.log(`- ${asset}: net=${agg.net.toFixed(2)} trades=${agg.trades} absLots=${agg.absLots.toFixed(2)}`);
  }

  console.log("\nBy basket (realized):");
  for (const [basket, agg] of Array.from(byBasket.entries()).sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))) {
    console.log(`- ${basket}: net=${agg.net.toFixed(2)} trades=${agg.trades}`);
  }

  const findLotMapEntry = (symbol: string) => {
    const target = symbol.trim().toUpperCase();
    if (!target) return null;

    const aliasMap: Record<string, string[]> = {
      SPXUSD: ["SPX500", "SPXUSD"],
      NDXUSD: ["NDX100", "NDXUSD"],
      NIKKEIUSD: ["JPN225", "NIKKEIUSD"],
      WTIUSD: ["WTICO", "USOUSD", "WTIUSD"],
      BTCUSD: ["BTCUSD", "BTCUSDT", "BTC_USD"],
      ETHUSD: ["ETHUSD", "ETHUSDT", "ETH_USD"],
    };

    const candidates = Array.from(new Set([target, ...(aliasMap[target] ?? [])]));

    for (const candidate of candidates) {
      const exact = lotMapRows.find((row) => String(row.symbol ?? "").toUpperCase() === candidate);
      if (exact) return exact;
    }
    for (const candidate of candidates) {
      const starts = lotMapRows.find((row) => String(row.symbol ?? "").toUpperCase().startsWith(candidate));
      if (starts) return starts;
    }
    if (target.length === 6) {
      const fx = lotMapRows.find((row) => String(row.symbol ?? "").toUpperCase().startsWith(target));
      if (fx) return fx;
    }
    return null;
  };

  // Hold-to-week-end simulation (price move from open_price to week-end close).
  // This ignores funding/overnight costs; it is directional MTM using OANDA hourly candles.
  const priceCache = new Map<string, number | null>();
  let oandaDisabled = false;
  async function getWeekEndClose(symbol: string) {
    if (oandaDisabled) return null;
    // For hold-to-week-end we only need the week-end close. Use a single window per symbol.
    const key = `${symbol}|${weekOpen.toISO()}|${simEnd.toISO()}`;
    if (priceCache.has(key)) return priceCache.get(key) ?? null;
    try {
      const candle = await fetchOandaCandle(symbol, weekOpen, simEnd);
      const close = candle?.close ?? null;
      priceCache.set(key, close);
      return close;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // If OANDA isn't configured or is unauthorized locally, skip the sim but keep the realized breakdown.
      if (message.includes("OANDA_API_KEY") || message.includes("[401]") || message.includes("authorization")) {
        oandaDisabled = true;
      }
      priceCache.set(key, null);
      return null;
    }
  }

  let simCovered = 0;
  let simTotalUsd = 0;
  const simByAssetUsd = new Map<string, number>();
  const simMissingLotMap = new Set<string>();
  const simMissingPrice = new Set<string>();

  for (const r of rows) {
    if (!Number.isFinite(r.open_price) || r.open_price <= 0) continue;

    const lotMap = findLotMapEntry(r.canonical || r.symbol);
    const baseLotRaw = lotMap?.lot;
    const move1pctUsdRaw = (lotMap as any)?.move_1pct_usd;
    const baseLot = typeof baseLotRaw === "number" ? baseLotRaw : Number(baseLotRaw);
    const move1pctUsd = typeof move1pctUsdRaw === "number" ? move1pctUsdRaw : Number(move1pctUsdRaw);
    if (!Number.isFinite(baseLot) || !Number.isFinite(move1pctUsd) || baseLot <= 0) {
      simMissingLotMap.add(r.canonical || r.symbol);
      continue;
    }

    // Use canonical symbols for OANDA mapping (overrides exist for indices/commodities/crypto).
    const candleClose = await getWeekEndClose(r.canonical || r.symbol);
    if (candleClose === null || !Number.isFinite(candleClose)) {
      simMissingPrice.add(r.canonical || r.symbol);
      continue;
    }

    const pctMove = ((candleClose - r.open_price) / r.open_price) * 100; // percent
    const direction = r.type === "BUY" ? 1 : -1;

    const scaledMove1pctUsd = move1pctUsd * (r.lots / baseLot);
    const pnlUsd = direction * pctMove * scaledMove1pctUsd;

    simCovered += 1;
    simTotalUsd += pnlUsd;
    simByAssetUsd.set(r.assetClass, (simByAssetUsd.get(r.assetClass) ?? 0) + pnlUsd);
  }

  console.log("\nHold-to-week-end sim coverage:");
  if (oandaDisabled) {
    console.log("- Skipped: OANDA price access is not configured/authorized in this environment.");
  } else {
    console.log(`- Sim window: ${weekOpen.toISO()} -> ${simEnd.toISO()}${simEnd < weekEnd ? " (clamped to now)" : ""}`);
    console.log(`- Covered trades: ${simCovered}/${rows.length}`);
    console.log(`- Sim net (MTM proxy): ${simTotalUsd.toFixed(2)} ${account.currency ?? "USD"}`);
    console.log("By asset class (sim MTM proxy):");
    for (const [asset, val] of Array.from(simByAssetUsd.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
      console.log(`- ${asset}: ${val.toFixed(2)}`);
    }
  }

  console.log("\nNotes:");
  console.log("- Realized PnL above is authoritative (from broker history).");
  console.log("- Hold-to-week-end sim uses OANDA price changes (open_price -> week-end close) and EA-provided lot_map.move_1pct_usd for $ scaling.");
  console.log("- Funding/rollover, spreads, and intra-week exits are ignored; this is a 'held to week-end' MTM estimate.");
  if (simMissingLotMap.size > 0) {
    console.log(`- Missing lot_map entries for: ${Array.from(simMissingLotMap).sort().join(", ")}`);
  }
  if (simMissingPrice.size > 0) {
    console.log(`- Missing OANDA prices for: ${Array.from(simMissingPrice).sort().join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
