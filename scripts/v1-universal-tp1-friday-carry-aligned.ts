import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { readPerformanceSnapshotsByWeek } from "../src/lib/performanceSnapshots";
import { groupSignals } from "../src/lib/plannedTrades";
import { PERFORMANCE_V1_MODELS } from "../src/lib/performance/modelConfig";
import { getPerformanceWindow } from "../src/lib/pricePerformance";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getOandaInstrument } from "../src/lib/oandaPrices";
import type { PerformanceModel } from "../src/lib/performanceLab";

type Direction = "LONG" | "SHORT";

type OhlcPoint = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type WeekLeg = {
  key: string;
  model: PerformanceModel;
  asset_class: AssetClass;
  pair: string;
  direction: Direction;
};

type WeekPlan = {
  week_open_utc: string;
  week_label: string;
  desired_legs: WeekLeg[];
  desired_keys: Set<string>;
  report_date_by_asset: Map<AssetClass, string | null>;
};

type OpenPosition = {
  key: string;
  model: PerformanceModel;
  asset_class: AssetClass;
  pair: string;
  direction: Direction;
  entry_price: number;
};

type WeekStats = {
  week_open_utc: string;
  week_label: string;
  desired_legs: number;
  opened_new: number;
  closed_refresh_unaligned: number;
  closed_tp_1pct: number;
  closed_friday_profit: number;
  open_positions_end: number;
  week_floating_pct: number;
  week_end_equity_pct: number;
  week_delta_equity_pct: number;
};

type SeriesForSymbol = {
  points: OhlcPoint[];
  by_ts: Map<number, OhlcPoint>;
};

const HIT_TP_PCT = Number(process.env.TP_PCT ?? "1");
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
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
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

function getOandaBaseUrl() {
  return process.env.OANDA_ENV === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
}

function getOandaAuthHeaders() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) throw new Error("OANDA_API_KEY is not configured.");
  return { Authorization: `Bearer ${apiKey}` };
}

function getBitgetProductType() {
  return process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
}

function pctMove(entry: number, mark: number, direction: Direction): number {
  if (!(entry > 0) || !Number.isFinite(mark)) return 0;
  const raw = ((mark - entry) / entry) * 100;
  return direction === "LONG" ? raw : -raw;
}

function keyForLeg(model: PerformanceModel, assetClass: AssetClass, pair: string, direction: Direction) {
  return `${model}|${assetClass}|${pair}|${direction}`;
}

function pairKey(assetClass: AssetClass, pair: string) {
  return `${assetClass}|${pair}`;
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

function resolveWindow(weekOpenUtc: string, assetClass: AssetClass, reportDate: string | null) {
  if (reportDate) {
    return getPerformanceWindow({
      assetClass,
      reportDate,
      isLatestReport: false,
    });
  }
  const openUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (assetClass === "crypto") {
    return { openUtc, closeUtc: openUtc.plus({ weeks: 1 }) };
  }
  return { openUtc, closeUtc: openUtc.plus({ days: 5 }) };
}

async function fetchSeriesForWeekSymbol(
  weekOpenUtc: string,
  assetClass: AssetClass,
  pair: string,
  reportDate: string | null,
): Promise<SeriesForSymbol | null> {
  const window = resolveWindow(weekOpenUtc, assetClass, reportDate);
  const fromUtc = DateTime.fromISO(window.openUtc.toISO() ?? "", { zone: "utc" });
  const toUtc = DateTime.fromISO(window.closeUtc.toISO() ?? "", { zone: "utc" });
  if (!fromUtc.isValid || !toUtc.isValid || toUtc.toMillis() <= fromUtc.toMillis()) {
    return null;
  }

  try {
    let points: OhlcPoint[] = [];
    if (assetClass === "crypto") {
      const base = getCryptoBase(pair);
      if (!base) return null;
      points = await fetchBitgetOhlcSeries(base, fromUtc, toUtc);
    } else {
      const symbol = assetClass === "fx" ? fxSymbol(pair) : pair;
      points = await fetchOandaOhlcSeries(symbol, fromUtc, toUtc);
    }
    if (!points.length) return null;
    return {
      points,
      by_ts: new Map(points.map((p) => [p.ts, p])),
    };
  } catch {
    return null;
  }
}

async function buildWeekPlan(weekOpenUtc: string): Promise<WeekPlan> {
  const rows = await readPerformanceSnapshotsByWeek(weekOpenUtc);
  const reportDateByAssetModel = new Map<string, string | null>();
  const reportDateByAsset = new Map<AssetClass, string | null>();
  const allSignals: Array<{
    symbol: string;
    direction: Direction;
    model: PerformanceModel;
    asset_class: AssetClass;
  }> = [];

  for (const row of rows) {
    if (!PERFORMANCE_V1_MODELS.includes(row.model)) continue;
    const assetClass = row.asset_class as AssetClass;
    if (!["fx", "indices", "commodities", "crypto"].includes(assetClass)) continue;
    const reportDate = row.report_date ?? null;
    reportDateByAssetModel.set(`${assetClass}|${row.model}`, reportDate);
    if (!reportDateByAsset.has(assetClass)) {
      reportDateByAsset.set(assetClass, reportDate);
    }
    for (const detail of row.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      allSignals.push({
        symbol: detail.pair,
        direction: detail.direction,
        model: row.model,
        asset_class: assetClass,
      });
    }
  }

  const plannedPairs = groupSignals(allSignals, PERFORMANCE_V1_MODELS, { dropNetted: false });
  const desiredLegs: WeekLeg[] = [];
  for (const pair of plannedPairs) {
    const assetClass = pair.assetClass as AssetClass;
    for (const leg of pair.legs) {
      if (leg.direction !== "LONG" && leg.direction !== "SHORT") continue;
      desiredLegs.push({
        key: keyForLeg(leg.model, assetClass, pair.symbol, leg.direction),
        model: leg.model,
        asset_class: assetClass,
        pair: pair.symbol,
        direction: leg.direction,
      });
    }
  }

  return {
    week_open_utc: weekOpenUtc,
    week_label: DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy-LL-dd"),
    desired_legs: desiredLegs,
    desired_keys: new Set(desiredLegs.map((leg) => leg.key)),
    report_date_by_asset: reportDateByAsset,
  };
}

async function main() {
  loadDotEnv();

  const compare = JSON.parse(
    fs.readFileSync("reports/eightcap-3k-5week-floor-clamped-compare-latest.json", "utf8"),
  ) as { weeks: string[] };
  const weeks = [...(compare.weeks ?? [])].sort((a, b) => Date.parse(a) - Date.parse(b));
  if (!weeks.length) {
    throw new Error("No weeks found in compare report.");
  }

  const weekPlans = await Promise.all(weeks.map((w) => buildWeekPlan(w)));

  const openPositions = new Map<string, OpenPosition>();
  const weekly: WeekStats[] = [];
  let realizedPct = 0;
  let prevEndEquityPct = 0;
  let totalDesired = 0;
  let totalOpened = 0;
  let totalTp = 0;
  let totalFridayProfit = 0;
  let totalRefreshUnaligned = 0;

  for (const plan of weekPlans) {
    totalDesired += plan.desired_legs.length;
    const neededSymbols = new Map<string, { assetClass: AssetClass; pair: string; reportDate: string | null }>();

    for (const leg of plan.desired_legs) {
      const reportDate = plan.report_date_by_asset.get(leg.asset_class) ?? null;
      neededSymbols.set(pairKey(leg.asset_class, leg.pair), {
        assetClass: leg.asset_class,
        pair: leg.pair,
        reportDate,
      });
    }
    for (const pos of openPositions.values()) {
      const reportDate = plan.report_date_by_asset.get(pos.asset_class) ?? null;
      neededSymbols.set(pairKey(pos.asset_class, pos.pair), {
        assetClass: pos.asset_class,
        pair: pos.pair,
        reportDate,
      });
    }

    const seriesRows = await runWithConcurrency(
      Array.from(neededSymbols.values()),
      FETCH_CONCURRENCY,
      async (sym) => ({
        symbolKey: pairKey(sym.assetClass, sym.pair),
        series: await fetchSeriesForWeekSymbol(plan.week_open_utc, sym.assetClass, sym.pair, sym.reportDate),
      }),
    );
    const seriesBySymbol = new Map(seriesRows.map((row) => [row.symbolKey, row.series]));

    let weekOpened = 0;
    let weekTp = 0;
    let weekFridayProfit = 0;
    let weekRefreshUnaligned = 0;

    // Weekly refresh: close losers/winners that are no longer aligned.
    for (const [key, pos] of Array.from(openPositions.entries())) {
      if (plan.desired_keys.has(key)) continue;
      const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
      if (!series || !series.points.length) continue;
      const openPrice = series.points[0]!.open;
      realizedPct += pctMove(pos.entry_price, openPrice, pos.direction);
      openPositions.delete(key);
      weekRefreshUnaligned += 1;
    }

    // Open this week's new desired legs.
    for (const leg of plan.desired_legs) {
      if (openPositions.has(leg.key)) continue;
      const series = seriesBySymbol.get(pairKey(leg.asset_class, leg.pair));
      if (!series || !series.points.length) continue;
      const entry = series.points[0]!.open;
      if (!(entry > 0)) continue;
      openPositions.set(leg.key, {
        key: leg.key,
        model: leg.model,
        asset_class: leg.asset_class,
        pair: leg.pair,
        direction: leg.direction,
        entry_price: entry,
      });
      weekOpened += 1;
    }

    // Intraweek TP at +1%.
    const timestamps = Array.from(
      new Set(
        Array.from(seriesBySymbol.values())
          .flatMap((series) => series?.points.map((p) => p.ts) ?? []),
      ),
    ).sort((a, b) => a - b);

    for (const ts of timestamps) {
      for (const [key, pos] of Array.from(openPositions.entries())) {
        const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
        if (!series) continue;
        const bar = series.by_ts.get(ts);
        if (!bar) continue;

        const tpPrice =
          pos.direction === "LONG"
            ? pos.entry_price * (1 + HIT_TP_PCT / 100)
            : pos.entry_price * (1 - HIT_TP_PCT / 100);
        const hit = pos.direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
        if (!hit) continue;

        realizedPct += HIT_TP_PCT;
        openPositions.delete(key);
        weekTp += 1;
      }
    }

    // Friday close: close remaining winners only.
    for (const [key, pos] of Array.from(openPositions.entries())) {
      const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
      if (!series || !series.points.length) continue;
      const closePrice = series.points[series.points.length - 1]!.close;
      const pnlPct = pctMove(pos.entry_price, closePrice, pos.direction);
      if (pnlPct > 0) {
        realizedPct += pnlPct;
        openPositions.delete(key);
        weekFridayProfit += 1;
      }
    }

    let floatingPct = 0;
    for (const pos of openPositions.values()) {
      const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
      if (!series || !series.points.length) continue;
      const closePrice = series.points[series.points.length - 1]!.close;
      floatingPct += pctMove(pos.entry_price, closePrice, pos.direction);
    }
    const endEquityPct = realizedPct + floatingPct;
    const deltaEquityPct = endEquityPct - prevEndEquityPct;
    prevEndEquityPct = endEquityPct;

    totalOpened += weekOpened;
    totalTp += weekTp;
    totalFridayProfit += weekFridayProfit;
    totalRefreshUnaligned += weekRefreshUnaligned;

    weekly.push({
      week_open_utc: plan.week_open_utc,
      week_label: plan.week_label,
      desired_legs: plan.desired_legs.length,
      opened_new: weekOpened,
      closed_refresh_unaligned: weekRefreshUnaligned,
      closed_tp_1pct: weekTp,
      closed_friday_profit: weekFridayProfit,
      open_positions_end: openPositions.size,
      week_floating_pct: round(floatingPct, 4),
      week_end_equity_pct: round(endEquityPct, 4),
      week_delta_equity_pct: round(deltaEquityPct, 4),
    });
  }

  const finalFloatingPct = weekly.length ? weekly[weekly.length - 1]!.week_floating_pct : 0;
  const finalEquityPct = round(realizedPct + finalFloatingPct, 4);

  const out = {
    generated_utc: DateTime.utc().toISO(),
    system: "v1_universal",
    weeks,
    rules: [
      `TP: close any open trade immediately when +${HIT_TP_PCT.toFixed(2)}% favorable move is hit intraweek.`,
      "Friday: close any remaining open trade only if currently in profit.",
      "Carry: keep remaining losers open into next week only if exact key stays aligned (model + asset + pair + direction).",
      "Weekly refresh: if a carried trade is no longer aligned, close it at current week open.",
      "No sizing/scaling: pure 1:1 percent accounting per trade leg.",
    ],
    totals: {
      desired_legs: totalDesired,
      opened_positions: totalOpened,
      closed_tp_1pct: totalTp,
      closed_friday_profit: totalFridayProfit,
      closed_refresh_unaligned: totalRefreshUnaligned,
      open_positions_end: openPositions.size,
      realized_pct: round(realizedPct, 4),
      floating_pct: round(finalFloatingPct, 4),
      equity_pct: finalEquityPct,
    },
    weekly,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/v1-universal-tp1-friday-carry-aligned-${stamp}.json`;
  const latestJsonPath = "reports/v1-universal-tp1-friday-carry-aligned-latest.json";
  const mdPath = `reports/v1-universal-tp1-friday-carry-aligned-${stamp}.md`;
  const latestMdPath = "reports/v1-universal-tp1-friday-carry-aligned-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# V1 Universal TP1 + Friday Profit Close + Carry Aligned Losers");
  md.push("");
  md.push(`Generated: ${out.generated_utc}`);
  md.push(`Weeks: ${weeks.join(", ")}`);
  md.push("");
  md.push("## Totals");
  md.push(`- Desired legs: ${out.totals.desired_legs}`);
  md.push(`- Opened positions: ${out.totals.opened_positions}`);
  md.push(`- Closed at TP (+${HIT_TP_PCT.toFixed(2)}%): ${out.totals.closed_tp_1pct}`);
  md.push(`- Closed Friday in profit: ${out.totals.closed_friday_profit}`);
  md.push(`- Closed on refresh (unaligned): ${out.totals.closed_refresh_unaligned}`);
  md.push(`- Open positions at end: ${out.totals.open_positions_end}`);
  md.push(`- Realized PnL %: ${out.totals.realized_pct.toFixed(4)}%`);
  md.push(`- Floating PnL % (end): ${out.totals.floating_pct.toFixed(4)}%`);
  md.push(`- Equity PnL % (realized + floating): ${out.totals.equity_pct.toFixed(4)}%`);
  md.push("");
  md.push("## Weekly");
  md.push("| Week | Desired | Opened | TP Closes | Friday Profit Closes | Refresh Unaligned Closes | Open End | Floating % | End Equity % | Delta Equity % |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of weekly) {
    md.push(
      `| ${row.week_label} | ${row.desired_legs} | ${row.opened_new} | ${row.closed_tp_1pct} | ${row.closed_friday_profit} | ${row.closed_refresh_unaligned} | ${row.open_positions_end} | ${row.week_floating_pct.toFixed(4)}% | ${row.week_end_equity_pct.toFixed(4)}% | ${row.week_delta_equity_pct.toFixed(4)}% |`,
    );
  }
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
  console.error("v1-universal-tp1-friday-carry-aligned failed:", error);
  process.exit(1);
});
