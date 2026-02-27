import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { query } from "../src/lib/db";
import { getPerformanceWindow } from "../src/lib/pricePerformance";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getOandaInstrument } from "../src/lib/oandaPrices";
import { groupSignals } from "../src/lib/plannedTrades";
import type { PerformanceModel } from "../src/lib/performanceLab";
import { PERFORMANCE_V1_MODELS } from "../src/lib/performance/modelConfig";

type Direction = "LONG" | "SHORT";

type TradeRow = {
  week_open_utc: string;
  week_label: string;
  model: PerformanceModel;
  asset_class: AssetClass;
  pair: string;
  direction: Direction;
  report_date: string | null;
};

type OhlcPoint = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type SeriesKey = {
  assetClass: AssetClass;
  pair: string;
  openUtc: string;
  closeUtc: string;
};

type EvalResult = {
  evaluable: boolean;
  hit_1pct: boolean;
  mfe_pct: number | null;
};

const V1_MODELS = [...PERFORMANCE_V1_MODELS];
const HIT_THRESHOLD_PCT = Number(process.env.HIT_THRESHOLD_PCT ?? "1");
const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY ?? "8");
const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";
const BITGET_BASE_URL = "https://api.bitget.com";

function loadDotEnv() {
  const cwd = process.cwd();
  for (const filename of [".env.local", ".env"]) {
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
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function getOandaBaseUrl() {
  return process.env.OANDA_ENV === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
}

function getOandaAuthHeaders() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) throw new Error("OANDA_API_KEY is not configured.");
  return { Authorization: `Bearer ${apiKey}` };
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

function getBitgetProductType() {
  return process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
}

async function runWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const safe = Math.max(1, limit);
  const out: R[] = [];
  for (let i = 0; i < items.length; i += safe) {
    const chunk = items.slice(i, i + safe);
    const res = await Promise.all(chunk.map((item) => task(item)));
    out.push(...res);
  }
  return out;
}

async function fetchOandaOhlcSeries(
  symbol: string,
  fromUtc: DateTime,
  toUtc: DateTime,
): Promise<OhlcPoint[]> {
  const instrument = getOandaInstrument(symbol);
  const stepMs = 60 * 60 * 1000;
  const maxBarsPerRequest = 4000;
  const all = new Map<number, OhlcPoint>();
  let cursor = fromUtc;
  let page = 0;
  while (cursor.toMillis() < toUtc.toMillis() && page < 120) {
    page += 1;
    const requestTo = DateTime.fromMillis(
      Math.min(toUtc.toMillis(), cursor.toMillis() + stepMs * maxBarsPerRequest),
      { zone: "utc" },
    );
    const url = new URL(`${getOandaBaseUrl()}/v3/instruments/${instrument}/candles`);
    url.searchParams.set("price", "M");
    url.searchParams.set("granularity", "H1");
    url.searchParams.set("from", cursor.toISO() ?? "");
    url.searchParams.set("to", requestTo.toISO() ?? "");

    const response = await fetch(url.toString(), { headers: getOandaAuthHeaders() });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OANDA fetch failed (${instrument}) [${response.status}] ${body}`);
    }
    const data = (await response.json()) as {
      candles?: Array<{
        time: string;
        complete: boolean;
        mid?: { o?: string; h?: string; l?: string; c?: string };
      }>;
    };
    const candles = (data.candles ?? [])
      .filter((c) => c.complete && c.mid)
      .map((c) => ({
        ts: DateTime.fromISO(c.time, { zone: "utc" }).toMillis(),
        open: Number(c.mid?.o ?? NaN),
        high: Number(c.mid?.h ?? NaN),
        low: Number(c.mid?.l ?? NaN),
        close: Number(c.mid?.c ?? NaN),
      }))
      .filter(
        (c) =>
          Number.isFinite(c.ts) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close),
      )
      .sort((a, b) => a.ts - b.ts);
    if (candles.length === 0) break;

    for (const candle of candles) {
      if (candle.ts >= fromUtc.toMillis() && candle.ts < toUtc.toMillis()) {
        all.set(candle.ts, candle);
      }
    }

    const lastTs = candles[candles.length - 1]!.ts;
    const nextTs = lastTs + stepMs;
    if (nextTs <= cursor.toMillis()) break;
    cursor = DateTime.fromMillis(nextTs, { zone: "utc" });
  }

  return Array.from(all.values()).sort((a, b) => a.ts - b.ts);
}

async function fetchBitgetOhlcSeries(
  symbolBase: "BTC" | "ETH",
  fromUtc: DateTime,
  toUtc: DateTime,
): Promise<OhlcPoint[]> {
  const productType = getBitgetProductType();
  const symbol = `${symbolBase}USDT`;
  const stepMs = 60 * 60 * 1000;
  const all = new Map<number, OhlcPoint>();
  let cursor = fromUtc.toMillis();
  let page = 0;
  while (cursor < toUtc.toMillis() && page < 120) {
    page += 1;
    const url = new URL(`${BITGET_BASE_URL}/api/v2/mix/market/candles`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("productType", productType);
    url.searchParams.set("granularity", "3600");
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(toUtc.toMillis()));
    url.searchParams.set("limit", "1000");

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Bitget fetch failed (${symbol}) [${response.status}] ${body}`);
    }
    const data = (await response.json()) as { code?: string; data?: string[][] };
    if (data.code && data.code !== "00000") break;
    const rows = (data.data ?? [])
      .map((row) => ({
        ts: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.ts) &&
          Number.isFinite(row.open) &&
          Number.isFinite(row.high) &&
          Number.isFinite(row.low) &&
          Number.isFinite(row.close),
      )
      .filter((row) => row.ts >= fromUtc.toMillis() && row.ts < toUtc.toMillis())
      .sort((a, b) => a.ts - b.ts);

    if (rows.length === 0) break;
    for (const row of rows) all.set(row.ts, row);

    const lastTs = rows[rows.length - 1]!.ts;
    const nextTs = lastTs + stepMs;
    if (nextTs <= cursor) break;
    cursor = nextTs;
  }
  return Array.from(all.values()).sort((a, b) => a.ts - b.ts);
}

async function fetchSeriesForKey(key: SeriesKey): Promise<{ key: string; points: OhlcPoint[] | null }> {
  const fromUtc = DateTime.fromISO(key.openUtc, { zone: "utc" });
  const toUtc = DateTime.fromISO(key.closeUtc, { zone: "utc" });
  if (!fromUtc.isValid || !toUtc.isValid || toUtc.toMillis() <= fromUtc.toMillis()) {
    return { key: `${key.assetClass}|${key.pair}|${key.openUtc}|${key.closeUtc}`, points: null };
  }

  try {
    if (key.assetClass === "crypto") {
      const base = getCryptoBase(key.pair);
      if (!base) return { key: `${key.assetClass}|${key.pair}|${key.openUtc}|${key.closeUtc}`, points: null };
      const points = await fetchBitgetOhlcSeries(base, fromUtc, toUtc);
      return { key: `${key.assetClass}|${key.pair}|${key.openUtc}|${key.closeUtc}`, points };
    }
    const symbol = key.assetClass === "fx" ? fxSymbol(key.pair) : key.pair;
    const points = await fetchOandaOhlcSeries(getOandaInstrument(symbol), fromUtc, toUtc);
    return { key: `${key.assetClass}|${key.pair}|${key.openUtc}|${key.closeUtc}`, points };
  } catch (error) {
    console.error("Series fetch failed:", key.assetClass, key.pair, error);
    return { key: `${key.assetClass}|${key.pair}|${key.openUtc}|${key.closeUtc}`, points: null };
  }
}

function evalTradeHit(points: OhlcPoint[] | null, direction: Direction): EvalResult {
  if (!points || points.length === 0) {
    return { evaluable: false, hit_1pct: false, mfe_pct: null };
  }
  const entry = points[0]!.open;
  if (!(entry > 0)) {
    return { evaluable: false, hit_1pct: false, mfe_pct: null };
  }
  const maxHigh = points.reduce((m, p) => Math.max(m, p.high), Number.NEGATIVE_INFINITY);
  const minLow = points.reduce((m, p) => Math.min(m, p.low), Number.POSITIVE_INFINITY);
  let mfe = 0;
  if (direction === "LONG") {
    mfe = ((maxHigh - entry) / entry) * 100;
  } else {
    mfe = ((entry - minLow) / entry) * 100;
  }
  return {
    evaluable: Number.isFinite(mfe),
    hit_1pct: Number.isFinite(mfe) && mfe >= HIT_THRESHOLD_PCT,
    mfe_pct: Number.isFinite(mfe) ? round(mfe) : null,
  };
}

async function main() {
  loadDotEnv();

  const compare = JSON.parse(
    fs.readFileSync("reports/eightcap-3k-5week-floor-clamped-compare-latest.json", "utf8"),
  ) as { weeks: string[] };
  const weeks = compare.weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) {
    throw new Error("Could not load 5-week window from compare report.");
  }

  const trades: TradeRow[] = [];
  type SnapshotDbRow = {
    week_open_utc: Date;
    asset_class: AssetClass;
    model: PerformanceModel;
    report_date: Date | null;
    pair_details: Array<{ pair?: string; direction?: string }> | string | null;
  };
  for (const week of weeks) {
    const rows = await query<SnapshotDbRow>(
      `SELECT week_open_utc, asset_class, model, report_date, pair_details
         FROM performance_snapshots
        WHERE week_open_utc = $1
          AND model = ANY($2::text[])
        ORDER BY asset_class, model`,
      [week, V1_MODELS],
    );

    const allSignals = [];
    const reportDateByAssetModel = new Map<string, string | null>();

    for (const row of rows) {
      const assetClass = row.asset_class;
      if (!["fx", "indices", "commodities", "crypto"].includes(assetClass)) continue;
      const details = Array.isArray(row.pair_details)
        ? row.pair_details
        : typeof row.pair_details === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(row.pair_details);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [];
      const reportDate = row.report_date
        ? DateTime.fromJSDate(row.report_date, { zone: "utc" }).toISODate()
        : null;
      reportDateByAssetModel.set(`${assetClass}|${row.model}`, reportDate);
      for (const detail of details) {
        if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
        if (!detail.pair) continue;
        allSignals.push({
          symbol: detail.pair,
          direction: detail.direction,
          model: row.model,
          asset_class: assetClass,
        });
      }
    }

    const plannedPairs = groupSignals(allSignals, V1_MODELS, { dropNetted: false });
    for (const pair of plannedPairs) {
      const assetClass = pair.assetClass as AssetClass;
      for (const leg of pair.legs) {
        if (leg.direction !== "LONG" && leg.direction !== "SHORT") continue;
        trades.push({
          week_open_utc: week,
          week_label: DateTime.fromISO(week, { zone: "utc" }).toFormat("yyyy-LL-dd"),
          model: leg.model,
          asset_class: assetClass,
          pair: pair.symbol,
          direction: leg.direction,
          report_date: reportDateByAssetModel.get(`${assetClass}|${leg.model}`) ?? null,
        });
      }
    }
  }

  const seriesKeys: SeriesKey[] = [];
  const seen = new Set<string>();
  for (const trade of trades) {
    const window = getPerformanceWindow({
      assetClass: trade.asset_class,
      reportDate: trade.report_date ?? undefined,
      isLatestReport: false,
    });
    const key = `${trade.asset_class}|${trade.pair}|${window.openUtc.toISO()}|${window.closeUtc.toISO()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seriesKeys.push({
      assetClass: trade.asset_class,
      pair: trade.pair,
      openUtc: window.openUtc.toISO()!,
      closeUtc: window.closeUtc.toISO()!,
    });
  }

  const seriesRows = await runWithConcurrency(seriesKeys, FETCH_CONCURRENCY, fetchSeriesForKey);
  const seriesMap = new Map(seriesRows.map((row) => [row.key, row.points]));

  let evaluable = 0;
  let hits = 0;
  const byModel = new Map<string, { total: number; evaluable: number; hits: number }>();
  const byWeek = new Map<string, { total: number; evaluable: number; hits: number }>();

  for (const trade of trades) {
    const window = getPerformanceWindow({
      assetClass: trade.asset_class,
      reportDate: trade.report_date ?? undefined,
      isLatestReport: false,
    });
    const key = `${trade.asset_class}|${trade.pair}|${window.openUtc.toISO()}|${window.closeUtc.toISO()}`;
    const points = seriesMap.get(key) ?? null;
    const result = evalTradeHit(points, trade.direction);

    if (result.evaluable) evaluable += 1;
    if (result.hit_1pct) hits += 1;

    const modelBucket = byModel.get(trade.model) ?? { total: 0, evaluable: 0, hits: 0 };
    modelBucket.total += 1;
    if (result.evaluable) modelBucket.evaluable += 1;
    if (result.hit_1pct) modelBucket.hits += 1;
    byModel.set(trade.model, modelBucket);

    const weekBucket = byWeek.get(trade.week_label) ?? { total: 0, evaluable: 0, hits: 0 };
    weekBucket.total += 1;
    if (result.evaluable) weekBucket.evaluable += 1;
    if (result.hit_1pct) weekBucket.hits += 1;
    byWeek.set(trade.week_label, weekBucket);
  }

  const out = {
    generated_utc: DateTime.utc().toISO(),
    threshold_pct: HIT_THRESHOLD_PCT,
    weeks,
    totals: {
      trades_total: trades.length,
      trades_evaluable: evaluable,
      hits_1pct: hits,
      hit_rate_on_total_pct: round((hits / Math.max(1, trades.length)) * 100, 2),
      hit_rate_on_evaluable_pct: round((hits / Math.max(1, evaluable)) * 100, 2),
    },
    by_model: Object.fromEntries(
      Array.from(byModel.entries()).map(([model, bucket]) => [
        model,
        {
          ...bucket,
          hit_rate_on_total_pct: round((bucket.hits / Math.max(1, bucket.total)) * 100, 2),
          hit_rate_on_evaluable_pct: round((bucket.hits / Math.max(1, bucket.evaluable)) * 100, 2),
        },
      ]),
    ),
    by_week: Object.fromEntries(
      Array.from(byWeek.entries()).map(([week, bucket]) => [
        week,
        {
          ...bucket,
          hit_rate_on_total_pct: round((bucket.hits / Math.max(1, bucket.total)) * 100, 2),
          hit_rate_on_evaluable_pct: round((bucket.hits / Math.max(1, bucket.evaluable)) * 100, 2),
        },
      ]),
    ),
    assumptions: [
      "Universe: V1 universal models only (antikythera, blended, dealer, commercial, sentiment) for the same 5-week window used in floor-clamped compare.",
      "One trade record per model/pair/week directional signal (same counting basis as V1 universal trade count in compare report).",
      "Hit definition: trade reaches +1.0% favorable excursion at any time during its report-window (MFE >= 1.0%).",
      "Directional MFE uses weekly intraperiod OHLC highs/lows from OANDA/Bitget.",
      "No sizing/scaling; pure 1:1 market percent move evaluation.",
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/v1-universal-hitrate-1pct-${stamp}.json`;
  const latestJsonPath = "reports/v1-universal-hitrate-1pct-latest.json";
  const mdPath = `reports/v1-universal-hitrate-1pct-${stamp}.md`;
  const latestMdPath = "reports/v1-universal-hitrate-1pct-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# V1 Universal +1% Intraweek Hit Rate");
  md.push("");
  md.push(`Generated: ${out.generated_utc}`);
  md.push(`Threshold: ${HIT_THRESHOLD_PCT.toFixed(2)}%`);
  md.push(`Weeks: ${weeks.join(", ")}`);
  md.push("");
  md.push("## Totals");
  md.push(`- Trades total: ${out.totals.trades_total}`);
  md.push(`- Trades evaluable: ${out.totals.trades_evaluable}`);
  md.push(`- Hits (+${HIT_THRESHOLD_PCT.toFixed(2)}%): ${out.totals.hits_1pct}`);
  md.push(`- Hit rate (on total): ${out.totals.hit_rate_on_total_pct.toFixed(2)}%`);
  md.push(`- Hit rate (on evaluable): ${out.totals.hit_rate_on_evaluable_pct.toFixed(2)}%`);
  md.push("");
  md.push("## By Model");
  md.push("| Model | Total | Evaluable | Hits | Hit Rate (Total) | Hit Rate (Evaluable) |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const [model, bucket] of Object.entries(out.by_model)) {
    md.push(
      `| ${model} | ${bucket.total} | ${bucket.evaluable} | ${bucket.hits} | ${bucket.hit_rate_on_total_pct.toFixed(2)}% | ${bucket.hit_rate_on_evaluable_pct.toFixed(2)}% |`,
    );
  }
  md.push("");
  md.push("## Assumptions");
  for (const line of out.assumptions) md.push(`- ${line}`);
  md.push("");
  md.push(`JSON: \`${jsonPath}\``);

  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(latestMdPath, md.join("\n"), "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${latestJsonPath}`);
  console.log(`Wrote ${latestMdPath}`);
}

main().catch((error) => {
  console.error("v1-universal-hitrate-1pct failed:", error);
  process.exit(1);
});
