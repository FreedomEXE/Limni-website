import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import * as perfNs from "../src/lib/performanceSnapshots";
import * as bitgetNs from "../src/lib/bitget";
import * as oandaNs from "../src/lib/oandaPrices";

const perf: any = (perfNs as any).default ?? perfNs;
const bitget: any = (bitgetNs as any).default ?? bitgetNs;
const oanda: any = (oandaNs as any).default ?? oandaNs;

type AssetClass = "fx" | "indices" | "commodities" | "crypto";
type Leg = { key: string; assetClass: AssetClass; pair: string; direction: 1 | -1; scale: number; reportDate: string | null };
type SeriesPoint = { ts: number; close: number };
type SymbolSeries = { key: string; points: SeriesPoint[] };

const WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
];

function loadDotEnv() {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function fxSymbol(pair: string): string {
  if (pair.includes("/")) return pair;
  if (pair.length === 6) return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  return pair;
}

function getCryptoBase(pair: string): "BTC" | "ETH" | null {
  if (pair.startsWith("BTC")) return "BTC";
  if (pair.startsWith("ETH")) return "ETH";
  return null;
}

function getWindowForAsset(assetClass: AssetClass, reportDate: string | null, weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (assetClass === "crypto") {
    if (reportDate) {
      const report = DateTime.fromISO(reportDate, { zone: "utc" });
      if (report.isValid) {
        const nextMonday = report.startOf("week").plus({ weeks: 1 });
        return { openUtc: nextMonday.toUTC(), closeUtc: nextMonday.plus({ weeks: 1 }).toUTC() };
      }
    }
    return { openUtc: weekOpen, closeUtc: weekOpen.plus({ weeks: 1 }) };
  }
  if (reportDate) {
    const reportNy = DateTime.fromISO(reportDate, { zone: "America/New_York" });
    if (reportNy.isValid) {
      const daysUntilSunday = (7 - (reportNy.weekday % 7)) % 7;
      const sunday = reportNy.plus({ days: daysUntilSunday }).set({ hour: assetClass === "fx" ? 17 : 18, minute: 0, second: 0, millisecond: 0 });
      const friday = sunday.plus({ days: 5 }).set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
      return { openUtc: sunday.toUTC(), closeUtc: friday.toUTC() };
    }
  }
  return { openUtc: weekOpen, closeUtc: weekOpen.plus({ days: 5 }) };
}

async function runWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const safe = Math.max(1, limit);
  const out: R[] = [];
  for (let i = 0; i < items.length; i += safe) {
    const chunk = items.slice(i, i + safe);
    const res = await Promise.all(chunk.map(task));
    out.push(...res);
  }
  return out;
}

async function fetchSeries(input: { assetClass: AssetClass; pair: string; reportDate: string | null; weekOpenUtc: string }): Promise<SymbolSeries | null> {
  const { assetClass, pair, reportDate, weekOpenUtc } = input;
  const window = getWindowForAsset(assetClass, reportDate, weekOpenUtc);
  const nowUtc = DateTime.utc().minus({ minutes: 5 });
  const closeUtc = window.closeUtc > nowUtc ? nowUtc : window.closeUtc;
  if (closeUtc.toMillis() <= window.openUtc.toMillis()) return null;
  try {
    if (assetClass === "crypto") {
      const base = getCryptoBase(pair);
      if (!base) return null;
      const candles = await bitget.fetchBitgetMinuteSeries(base, { openUtc: window.openUtc, closeUtc });
      if (!candles.length) return null;
      return { key: `${assetClass}|${pair}`, points: candles.map((c: any) => ({ ts: c.ts, close: c.close })) };
    }
    const symbol = assetClass === "fx" ? fxSymbol(pair) : pair;
    const candles = await oanda.fetchOandaMinuteSeries(oanda.getOandaInstrument(symbol), window.openUtc, closeUtc);
    if (!candles.length) return null;
    return { key: `${assetClass}|${pair}`, points: candles.map((c: any) => ({ ts: c.ts, close: c.close })) };
  } catch {
    return null;
  }
}

function latestPointAtOrBefore(points: SeriesPoint[], ts: number): SeriesPoint | null {
  let left = 0, right = points.length - 1, best = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (points[mid].ts <= ts) { best = mid; left = mid + 1; }
    else { right = mid - 1; }
  }
  return best < 0 ? null : points[best];
}

function buildNetLegs(rows: any[]): Leg[] {
  const models = new Set(["antikythera", "blended", "dealer", "commercial", "sentiment"]);
  const bySym = new Map<string, { assetClass: AssetClass; pair: string; net: number; reportDate: string | null }>();
  for (const row of rows) {
    if (!models.has(row.model)) continue;
    const assetClass = row.asset_class as AssetClass;
    for (const d of row.pair_details ?? []) {
      if (d.direction !== "LONG" && d.direction !== "SHORT") continue;
      const key = `${assetClass}|${d.pair}`;
      const curr = bySym.get(key) ?? { assetClass, pair: d.pair, net: 0, reportDate: row.report_date ?? null };
      curr.net += d.direction === "LONG" ? 1 : -1;
      if (!curr.reportDate && row.report_date) curr.reportDate = row.report_date;
      bySym.set(key, curr);
    }
  }
  const out: Leg[] = [];
  for (const [key, v] of bySym.entries()) {
    if (!v.net) continue;
    const absNet = Math.abs(v.net);
    const scale = (v.assetClass === "fx" ? 0.10 : 0.05) * absNet;
    out.push({ key, assetClass: v.assetClass, pair: v.pair, direction: v.net > 0 ? 1 : -1, scale, reportDate: v.reportDate });
  }
  return out;
}

function inFlatWindowEt(ts: number) {
  const et = DateTime.fromMillis(ts, { zone: "America/New_York" });
  const mins = et.hour * 60 + et.minute;
  return mins >= (16 * 60 + 30) && mins < (19 * 60);
}

function computePctMove(legs: Leg[], seriesByKey: Map<string, SymbolSeries>, startTs: number, endTs: number) {
  let total = 0;
  for (const leg of legs) {
    const series = seriesByKey.get(leg.key);
    if (!series) continue;
    const startPt = latestPointAtOrBefore(series.points, startTs);
    const endPt = latestPointAtOrBefore(series.points, endTs);
    if (!startPt || !endPt || startPt.close <= 0) continue;
    const retPct = ((endPt.close - startPt.close) / startPt.close) * 100 * leg.direction;
    total += retPct * leg.scale;
  }
  return total;
}

async function main() {
  loadDotEnv();
  const weeklyWindowPnl: any[] = [];

  for (const weekOpenUtc of WEEKS) {
    const rows = await perf.readPerformanceSnapshotsByWeek(weekOpenUtc);
    const legs = buildNetLegs(rows);
    const uniqueSymbols = new Map<string, { assetClass: AssetClass; pair: string; reportDate: string | null; weekOpenUtc: string }>();
    for (const leg of legs) {
      uniqueSymbols.set(leg.key, { assetClass: leg.assetClass, pair: leg.pair, reportDate: leg.reportDate, weekOpenUtc });
    }
    const seriesListRaw = await runWithConcurrency(Array.from(uniqueSymbols.values()), 8, fetchSeries);
    const seriesList = seriesListRaw.filter((s): s is SymbolSeries => s !== null);
    const seriesByKey = new Map(seriesList.map((s) => [s.key, s]));
    const usableLegs = legs.filter((l) => seriesByKey.has(l.key));

    // Get all timestamps
    const allTs = Array.from(new Set(seriesList.flatMap((s) => s.points.map((p) => p.ts)))).sort((a, b) => a - b);

    // Find all flat window segments
    let windowPnl = 0;
    let windowCount = 0;
    for (let i = 0; i < allTs.length - 1; i++) {
      const curr = allTs[i];
      const next = allTs[i + 1];
      const currInWindow = inFlatWindowEt(curr);
      const nextInWindow = inFlatWindowEt(next);

      // If we transition from in-window to out-window, or both are in window, measure the segment
      if (currInWindow && nextInWindow) {
        const segPnl = computePctMove(usableLegs, seriesByKey, curr, next);
        windowPnl += segPnl;
      }

      // Count window entries
      if (!currInWindow && nextInWindow) {
        windowCount++;
      }
    }

    weeklyWindowPnl.push({
      week: weekOpenUtc.slice(0, 10),
      window_pnl_pct: Number(windowPnl.toFixed(4)),
      window_entries: windowCount,
      symbols: usableLegs.length,
    });
  }

  const totalWindowPnl = weeklyWindowPnl.reduce((s, r) => s + r.window_pnl_pct, 0);

  console.log(JSON.stringify({
    generated_utc: DateTime.utc().toISO(),
    note: "Measures P&L during 4:30-7:00 PM ET flat window only. Negative = we benefit from being flat. Positive = opportunity cost.",
    weekly: weeklyWindowPnl,
    total_5weeks: {
      window_pnl_pct: Number(totalWindowPnl.toFixed(4)),
      window_pnl_usd_100k: Number((totalWindowPnl * 1000).toFixed(2)),
      interpretation: totalWindowPnl < 0
        ? `Being flat saves ${Math.abs(totalWindowPnl).toFixed(2)}% by avoiding losses during rollover window`
        : `Being flat costs ${totalWindowPnl.toFixed(2)}% opportunity by missing gains during rollover window`,
    },
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
