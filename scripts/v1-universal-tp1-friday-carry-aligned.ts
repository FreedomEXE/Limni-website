/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/v1-universal-tp1-friday-carry-aligned.ts
 *
 * Description:
 * Universal V1 weekly TP/carry simulator with optional ADR emergency stops,
 * net vs non-net signal construction, and week-level risk diagnostics.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { readPerformanceSnapshotsByWeek } from "../src/lib/performanceSnapshots";
import { groupSignals } from "../src/lib/plannedTrades";
import { PERFORMANCE_V1_MODELS } from "../src/lib/performance/modelConfig";
import { getPerformanceWindow } from "../src/lib/pricePerformance";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getOandaInstrument } from "../src/lib/oandaPrices";
import type { PerformanceModel } from "../src/lib/performanceLab";
import { upsertStrategyBacktestSnapshot } from "../src/lib/performance/strategyBacktestStore";

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
  model_key: string;
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
  model_key: string;
  asset_class: AssetClass;
  pair: string;
  direction: Direction;
  entry_price: number;
  stop_price: number | null;
};

type WeekStats = {
  week_open_utc: string;
  week_label: string;
  desired_legs: number;
  opened_new: number;
  closed_refresh_unaligned: number;
  closed_tp_1pct: number;
  closed_stop_adr: number;
  closed_friday_profit: number;
  closed_friday_forced: number;
  open_positions_end: number;
  week_start_equity_pct: number;
  week_min_equity_pct: number;
  week_drawdown_pct: number;
  week_floating_pct: number;
  week_realized_delta_pct: number;
  week_end_equity_pct: number;
  week_delta_equity_pct: number;
};

type UniversalBacktestOutput = {
  generated_utc: string | null;
  config: {
    backtest_weeks: number;
    universal_mode: string;
    carry_mode: string;
    stop_mode: string;
    adr_lookback_days: number;
    adr_stop_multiplier: number;
    tp_pct: number;
  };
  totals: {
    desired_legs: number;
    opened_positions: number;
    closed_tp_1pct: number;
    closed_stop_adr: number;
    closed_friday_profit: number;
    closed_friday_forced: number;
    closed_refresh_unaligned: number;
    closed_positions: number;
    wins: number;
    losses: number;
    win_rate_pct: number;
    avg_closed_pnl_pct: number;
    profit_factor: number | string;
    max_drawdown_pct: number;
    open_positions_end: number;
    realized_pct: number;
    floating_pct: number;
    equity_pct: number;
  };
  weekly: WeekStats[];
};

type SeriesForSymbol = {
  points: OhlcPoint[];
  week_points: OhlcPoint[];
  by_ts_week: Map<number, OhlcPoint>;
};

const HIT_TP_PCT = Number(process.env.TP_PCT ?? "1");
const BACKTEST_WEEKS = Number(process.env.BACKTEST_WEEKS ?? "6");
const STOP_MODE = (process.env.STOP_MODE ?? "none").toLowerCase();
const UNIVERSAL_MODE = (process.env.UNIVERSAL_MODE ?? "non_net").toLowerCase();
const CARRY_MODE = (process.env.CARRY_MODE ?? "aligned").toLowerCase();
const ADR_LOOKBACK_DAYS = Number(process.env.ADR_LOOKBACK_DAYS ?? "20");
const ADR_STOP_MULTIPLIER = Number(process.env.ADR_STOP_MULTIPLIER ?? "1");
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

function keyForLeg(modelKey: string, assetClass: AssetClass, pair: string, direction: Direction) {
  return `${modelKey}|${assetClass}|${pair}|${direction}`;
}

function getLastCompletedWeekOpens(weeks: number): string[] {
  const count = Math.max(1, Math.trunc(weeks));
  const thisWeekOpen = getCanonicalWeekOpenUtc(DateTime.utc());
  const thisWeek = DateTime.fromISO(thisWeekOpen, { zone: "utc" });
  const out: string[] = [];
  for (let i = count; i >= 1; i -= 1) {
    out.push(thisWeek.minus({ weeks: i }).toUTC().toISO() ?? "");
  }
  return out.filter(Boolean);
}

function priceAtOrBeforeTs(points: OhlcPoint[], ts: number): number | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midTs = points[mid]!.ts;
    if (midTs <= ts) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (idx < 0) return null;
  return points[idx]!.close;
}

function computeAdrAbs(points: OhlcPoint[], beforeTs: number): number | null {
  const daily = new Map<string, { high: number; low: number }>();
  for (const point of points) {
    if (point.ts >= beforeTs) continue;
    const day = DateTime.fromMillis(point.ts, { zone: "utc" }).toISODate();
    if (!day) continue;
    const prev = daily.get(day);
    if (!prev) {
      daily.set(day, { high: point.high, low: point.low });
      continue;
    }
    prev.high = Math.max(prev.high, point.high);
    prev.low = Math.min(prev.low, point.low);
  }
  const days = Array.from(daily.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-Math.max(1, ADR_LOOKBACK_DAYS));
  if (!days.length) return null;
  const avgRange = days.reduce((sum, [, row]) => sum + Math.max(0, row.high - row.low), 0) / days.length;
  return avgRange > 0 ? avgRange : null;
}

function computeFloatingPctAtTs(
  positions: Map<string, OpenPosition>,
  seriesBySymbol: Map<string, SeriesForSymbol | null>,
  ts: number,
): number {
  let floating = 0;
  for (const pos of positions.values()) {
    const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
    if (!series) continue;
    const mark = priceAtOrBeforeTs(series.week_points, ts);
    if (!Number.isFinite(mark)) continue;
    floating += pctMove(pos.entry_price, mark as number, pos.direction);
  }
  return floating;
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
  const weekOpen = DateTime.fromISO(window.openUtc.toISO() ?? "", { zone: "utc" });
  const toUtc = DateTime.fromISO(window.closeUtc.toISO() ?? "", { zone: "utc" });
  const fromUtc = weekOpen.minus({ days: ADR_LOOKBACK_DAYS + 5 });
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
    const weekOpenTs = weekOpen.toMillis();
    const weekCloseTs = toUtc.toMillis();
    const weekPoints = points.filter((p) => p.ts >= weekOpenTs && p.ts < weekCloseTs);
    if (!weekPoints.length) return null;
    return {
      points,
      week_points: weekPoints,
      by_ts_week: new Map(weekPoints.map((p) => [p.ts, p])),
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

  const isNetMode = UNIVERSAL_MODE === "net";
  const plannedPairs = groupSignals(allSignals, PERFORMANCE_V1_MODELS, { dropNetted: isNetMode });
  const desiredLegs: WeekLeg[] = [];
  for (const pair of plannedPairs) {
    const assetClass = pair.assetClass as AssetClass;
    if (isNetMode) {
      if (pair.net === 0) continue;
      const direction: Direction = pair.net > 0 ? "LONG" : "SHORT";
      const units = Math.abs(pair.net);
      for (let idx = 0; idx < units; idx += 1) {
        const modelKey = `net_${idx + 1}`;
        desiredLegs.push({
          key: keyForLeg(modelKey, assetClass, pair.symbol, direction),
          model_key: modelKey,
          asset_class: assetClass,
          pair: pair.symbol,
          direction,
        });
      }
      continue;
    }
    for (const leg of pair.legs) {
      if (leg.direction !== "LONG" && leg.direction !== "SHORT") continue;
      desiredLegs.push({
        key: keyForLeg(leg.model, assetClass, pair.symbol, leg.direction),
        model_key: leg.model,
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

function approximateWeeklyWinsLosses(week: WeekStats) {
  const closedCount =
    week.closed_tp_1pct
    + week.closed_stop_adr
    + week.closed_friday_profit
    + week.closed_friday_forced
    + week.closed_refresh_unaligned;
  let wins = week.closed_tp_1pct + week.closed_friday_profit;
  let losses = week.closed_stop_adr + week.closed_friday_forced;
  const unresolved = Math.max(0, closedCount - wins - losses);
  if (unresolved > 0) {
    if (week.week_realized_delta_pct >= 0) {
      wins += unresolved;
    } else {
      losses += unresolved;
    }
  }
  return { wins, losses, closedCount };
}

async function persistUniversalBacktestToDb(out: UniversalBacktestOutput) {
  if (!process.env.DATABASE_URL) {
    console.log("DB upsert skipped: DATABASE_URL is not configured.");
    return;
  }

  const weeklyRows = out.weekly.map((week) => {
    const grossProfitPct = Math.max(0, week.week_realized_delta_pct);
    const grossLossPct = Math.abs(Math.min(0, week.week_realized_delta_pct));
    const approx = approximateWeeklyWinsLosses(week);
    return {
      weekOpenUtc: week.week_open_utc,
      returnPct: week.week_delta_equity_pct,
      trades: approx.closedCount,
      wins: approx.wins,
      losses: approx.losses,
      stopHits: week.closed_stop_adr,
      drawdownPct: week.week_drawdown_pct,
      grossProfitPct,
      grossLossPct,
      equityEndPct: week.week_end_equity_pct,
      pnlUsd: null,
    };
  });

  const result = await upsertStrategyBacktestSnapshot({
    run: {
      botId: "universal_v1_tp1_friday_carry_aligned",
      variant: "v1",
      market: "multi_asset",
      strategyName: "Universal v1 TP1 Friday Carry Aligned",
      carryMode: out.config.carry_mode,
      stopMode: out.config.stop_mode,
      adrMultiplier: out.config.stop_mode === "adr" ? out.config.adr_stop_multiplier : null,
      universalMode: out.config.universal_mode,
      backtestWeeks: out.config.backtest_weeks,
      generatedUtc: out.generated_utc,
      configJson: {
        ...out.config,
        totals: out.totals,
      },
    },
    weekly: weeklyRows,
    trades: [],
  });

  console.log(
    `DB upsert complete (universal v1): run_id=${result.runId}, weekly=${result.weeklyUpserted}, trades=${result.tradesInserted}`,
  );
}

async function main() {
  loadDotEnv();

  const weeks = getLastCompletedWeekOpens(BACKTEST_WEEKS).sort((a, b) => Date.parse(a) - Date.parse(b));
  if (!weeks.length) {
    throw new Error("No weeks found for BACKTEST_WEEKS.");
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
  let totalFridayForced = 0;
  let totalStopAdr = 0;
  let totalRefreshUnaligned = 0;
  let closedCount = 0;
  let wins = 0;
  let losses = 0;
  let sumWinPct = 0;
  let sumLossPctAbs = 0;
  let maxWeeklyDrawdownPct = 0;

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
    let weekFridayForced = 0;
    let weekStopAdr = 0;
    let weekRefreshUnaligned = 0;
    const realizedAtWeekStart = realizedPct;
    const weekStartEquityPct = prevEndEquityPct;
    const weekStartEquityAbs = 100 + weekStartEquityPct;
    let weekMinEquityAbs = weekStartEquityAbs;

    // Weekly refresh: close losers/winners that are no longer aligned.
    for (const [key, pos] of Array.from(openPositions.entries())) {
      if (plan.desired_keys.has(key)) continue;
      const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
      if (!series || !series.week_points.length) continue;
      const openPrice = series.week_points[0]!.open;
      const pnlPct = pctMove(pos.entry_price, openPrice, pos.direction);
      realizedPct += pnlPct;
      closedCount += 1;
      if (pnlPct > 0) {
        wins += 1;
        sumWinPct += pnlPct;
      } else if (pnlPct < 0) {
        losses += 1;
        sumLossPctAbs += Math.abs(pnlPct);
      }
      openPositions.delete(key);
      weekRefreshUnaligned += 1;
    }

    // Open this week's new desired legs.
    for (const leg of plan.desired_legs) {
      if (openPositions.has(leg.key)) continue;
      const series = seriesBySymbol.get(pairKey(leg.asset_class, leg.pair));
      if (!series || !series.week_points.length) continue;
      const entryBar = series.week_points[0]!;
      const entry = entryBar.open;
      if (!(entry > 0)) continue;
      let stopPrice: number | null = null;
      if (STOP_MODE === "adr") {
        const adrAbs = computeAdrAbs(series.points, entryBar.ts);
        if (adrAbs && Number.isFinite(adrAbs) && adrAbs > 0) {
          const stopDistance = adrAbs * ADR_STOP_MULTIPLIER;
          stopPrice = leg.direction === "LONG" ? entry - stopDistance : entry + stopDistance;
          if (!(stopPrice > 0)) stopPrice = null;
        }
      }
      openPositions.set(leg.key, {
        key: leg.key,
        model_key: leg.model_key,
        asset_class: leg.asset_class,
        pair: leg.pair,
        direction: leg.direction,
        entry_price: entry,
        stop_price: stopPrice,
      });
      weekOpened += 1;
    }

    // Intraweek TP at +1%.
    const timestamps = Array.from(
      new Set(
        Array.from(seriesBySymbol.values())
          .flatMap((series) => series?.week_points.map((p) => p.ts) ?? []),
      ),
    ).sort((a, b) => a - b);

    if (timestamps.length > 0) {
      const startFloating = computeFloatingPctAtTs(openPositions, seriesBySymbol, timestamps[0]!);
      const startEquityAbs = 100 + realizedPct + startFloating;
      if (startEquityAbs < weekMinEquityAbs) {
        weekMinEquityAbs = startEquityAbs;
      }
    }

    for (const ts of timestamps) {
      for (const [key, pos] of Array.from(openPositions.entries())) {
        const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
        if (!series) continue;
        const bar = series.by_ts_week.get(ts);
        if (!bar) continue;

        if (STOP_MODE === "adr" && pos.stop_price && Number.isFinite(pos.stop_price)) {
          const stopHit = pos.direction === "LONG" ? bar.low <= pos.stop_price : bar.high >= pos.stop_price;
          if (stopHit) {
            const pnlPct = pctMove(pos.entry_price, pos.stop_price, pos.direction);
            realizedPct += pnlPct;
            closedCount += 1;
            if (pnlPct > 0) {
              wins += 1;
              sumWinPct += pnlPct;
            } else if (pnlPct < 0) {
              losses += 1;
              sumLossPctAbs += Math.abs(pnlPct);
            }
            openPositions.delete(key);
            weekStopAdr += 1;
            continue;
          }
        }

        const tpPrice =
          pos.direction === "LONG"
            ? pos.entry_price * (1 + HIT_TP_PCT / 100)
            : pos.entry_price * (1 - HIT_TP_PCT / 100);
        const hit = pos.direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
        if (!hit) continue;

        const pnlPct = HIT_TP_PCT;
        realizedPct += pnlPct;
        closedCount += 1;
        wins += 1;
        sumWinPct += pnlPct;
        openPositions.delete(key);
        weekTp += 1;
      }

      const tsFloating = computeFloatingPctAtTs(openPositions, seriesBySymbol, ts);
      const tsEquityAbs = 100 + realizedPct + tsFloating;
      if (tsEquityAbs < weekMinEquityAbs) {
        weekMinEquityAbs = tsEquityAbs;
      }
    }

    // Friday close policy:
    // - aligned carry mode: close winners only, carry losers if still aligned
    // - none: force close all remaining positions at week close
    for (const [key, pos] of Array.from(openPositions.entries())) {
      const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
      if (!series || !series.week_points.length) continue;
      const closePrice = series.week_points[series.week_points.length - 1]!.close;
      const pnlPct = pctMove(pos.entry_price, closePrice, pos.direction);

      if (CARRY_MODE === "none") {
        realizedPct += pnlPct;
        closedCount += 1;
        if (pnlPct > 0) {
          wins += 1;
          sumWinPct += pnlPct;
          weekFridayProfit += 1;
        } else if (pnlPct < 0) {
          losses += 1;
          sumLossPctAbs += Math.abs(pnlPct);
        }
        openPositions.delete(key);
        weekFridayForced += 1;
        continue;
      }

      if (pnlPct > 0) {
        realizedPct += pnlPct;
        closedCount += 1;
        wins += 1;
        sumWinPct += pnlPct;
        openPositions.delete(key);
        weekFridayProfit += 1;
      }
    }

    let floatingPct = 0;
    for (const pos of openPositions.values()) {
      const series = seriesBySymbol.get(pairKey(pos.asset_class, pos.pair));
      if (!series || !series.week_points.length) continue;
      const closePrice = series.week_points[series.week_points.length - 1]!.close;
      floatingPct += pctMove(pos.entry_price, closePrice, pos.direction);
    }
    const endEquityPct = realizedPct + floatingPct;
    const deltaEquityPct = endEquityPct - prevEndEquityPct;
    const weekRealizedDeltaPct = realizedPct - realizedAtWeekStart;
    const endEquityAbs = 100 + endEquityPct;
    if (endEquityAbs < weekMinEquityAbs) {
      weekMinEquityAbs = endEquityAbs;
    }
    const weekDrawdownPct =
      weekStartEquityAbs > 0
        ? Math.max(0, ((weekStartEquityAbs - weekMinEquityAbs) / weekStartEquityAbs) * 100)
        : 0;
    if (weekDrawdownPct > maxWeeklyDrawdownPct) {
      maxWeeklyDrawdownPct = weekDrawdownPct;
    }
    prevEndEquityPct = endEquityPct;

    totalOpened += weekOpened;
    totalTp += weekTp;
    totalFridayProfit += weekFridayProfit;
    totalFridayForced += weekFridayForced;
    totalStopAdr += weekStopAdr;
    totalRefreshUnaligned += weekRefreshUnaligned;

    weekly.push({
      week_open_utc: plan.week_open_utc,
      week_label: plan.week_label,
      desired_legs: plan.desired_legs.length,
      opened_new: weekOpened,
      closed_refresh_unaligned: weekRefreshUnaligned,
      closed_tp_1pct: weekTp,
      closed_stop_adr: weekStopAdr,
      closed_friday_profit: weekFridayProfit,
      closed_friday_forced: weekFridayForced,
      open_positions_end: openPositions.size,
      week_start_equity_pct: round(weekStartEquityPct, 4),
      week_min_equity_pct: round(weekMinEquityAbs - 100, 4),
      week_drawdown_pct: round(weekDrawdownPct, 4),
      week_floating_pct: round(floatingPct, 4),
      week_realized_delta_pct: round(weekRealizedDeltaPct, 4),
      week_end_equity_pct: round(endEquityPct, 4),
      week_delta_equity_pct: round(deltaEquityPct, 4),
    });
  }

  const finalFloatingPct = weekly.length ? weekly[weekly.length - 1]!.week_floating_pct : 0;
  const finalEquityPct = round(realizedPct + finalFloatingPct, 4);
  const maxDrawdownPct = round(maxWeeklyDrawdownPct, 4);
  const winRatePct = closedCount ? (wins / closedCount) * 100 : 0;
  const avgClosedPnlPct = closedCount ? realizedPct / closedCount : 0;
  const profitFactor = sumLossPctAbs > 0 ? sumWinPct / sumLossPctAbs : sumWinPct > 0 ? Number.POSITIVE_INFINITY : 0;

  const out = {
    generated_utc: DateTime.utc().toISO(),
    system: "v1_universal",
    weeks,
    rules: [
      `TP: close any open trade immediately when +${HIT_TP_PCT.toFixed(2)}% favorable move is hit intraweek.`,
      CARRY_MODE === "none"
        ? "Friday: force close all remaining open trades at week close (no carry)."
        : "Friday: close any remaining open trade only if currently in profit.",
      CARRY_MODE === "none"
        ? "Carry: disabled."
        : "Carry: keep remaining losers open into next week only if exact key stays aligned (model + asset + pair + direction).",
      CARRY_MODE === "none"
        ? "Weekly refresh: not expected to trigger under no-carry mode."
        : "Weekly refresh: if a carried trade is no longer aligned, close it at current week open.",
      "No sizing/scaling: pure 1:1 percent accounting per trade leg.",
    ],
    config: {
      backtest_weeks: weeks.length,
      universal_mode: UNIVERSAL_MODE,
      carry_mode: CARRY_MODE,
      stop_mode: STOP_MODE,
      adr_lookback_days: ADR_LOOKBACK_DAYS,
      adr_stop_multiplier: ADR_STOP_MULTIPLIER,
      tp_pct: HIT_TP_PCT,
    },
    totals: {
      desired_legs: totalDesired,
      opened_positions: totalOpened,
      closed_tp_1pct: totalTp,
      closed_stop_adr: totalStopAdr,
      closed_friday_profit: totalFridayProfit,
      closed_friday_forced: totalFridayForced,
      closed_refresh_unaligned: totalRefreshUnaligned,
      closed_positions: closedCount,
      wins,
      losses,
      win_rate_pct: round(winRatePct, 4),
      avg_closed_pnl_pct: round(avgClosedPnlPct, 4),
      profit_factor: Number.isFinite(profitFactor) ? round(profitFactor, 4) : "INF",
      max_drawdown_pct: maxDrawdownPct,
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
  md.push(`Universal mode: ${UNIVERSAL_MODE}`);
  md.push(`Carry mode: ${CARRY_MODE}`);
  md.push(`Stop mode: ${STOP_MODE}`);
  if (STOP_MODE === "adr") {
    md.push(`ADR stop: ${ADR_STOP_MULTIPLIER}x ADR(${ADR_LOOKBACK_DAYS})`);
  }
  md.push("");
  md.push("## Totals");
  md.push(`- Desired legs: ${out.totals.desired_legs}`);
  md.push(`- Opened positions: ${out.totals.opened_positions}`);
  md.push(`- Closed at TP (+${HIT_TP_PCT.toFixed(2)}%): ${out.totals.closed_tp_1pct}`);
  md.push(`- Closed at ADR stop: ${out.totals.closed_stop_adr}`);
  md.push(`- Closed Friday in profit: ${out.totals.closed_friday_profit}`);
  md.push(`- Closed Friday forced (no-carry): ${out.totals.closed_friday_forced}`);
  md.push(`- Closed on refresh (unaligned): ${out.totals.closed_refresh_unaligned}`);
  md.push(`- Closed positions total: ${out.totals.closed_positions}`);
  md.push(`- Wins / Losses: ${out.totals.wins} / ${out.totals.losses}`);
  md.push(`- Win rate: ${Number(out.totals.win_rate_pct).toFixed(2)}%`);
  md.push(`- Avg closed PnL %: ${Number(out.totals.avg_closed_pnl_pct).toFixed(4)}%`);
  md.push(
    `- Profit factor: ${
      typeof out.totals.profit_factor === "string"
        ? out.totals.profit_factor
        : Number(out.totals.profit_factor).toFixed(4)
    }`,
  );
  md.push(`- Max drawdown %: ${Number(out.totals.max_drawdown_pct).toFixed(4)}%`);
  md.push(`- Open positions at end: ${out.totals.open_positions_end}`);
  md.push(`- Realized PnL %: ${out.totals.realized_pct.toFixed(4)}%`);
  md.push(`- Floating PnL % (end): ${out.totals.floating_pct.toFixed(4)}%`);
  md.push(`- Equity PnL % (realized + floating): ${out.totals.equity_pct.toFixed(4)}%`);
  md.push("");
  md.push("## Weekly");
  md.push(
    "| Week | Desired | Opened | TP Closes | ADR Stop Closes | Friday Profit Closes | Friday Forced Closes | Refresh Unaligned Closes | Open End | Start Equity % | Min Equity % | Week DD % | Realized Delta % | Floating % | End Equity % | Delta Equity % |",
  );
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of weekly) {
    md.push(
      `| ${row.week_label} | ${row.desired_legs} | ${row.opened_new} | ${row.closed_tp_1pct} | ${row.closed_stop_adr} | ${row.closed_friday_profit} | ${row.closed_friday_forced} | ${row.closed_refresh_unaligned} | ${row.open_positions_end} | ${row.week_start_equity_pct.toFixed(4)}% | ${row.week_min_equity_pct.toFixed(4)}% | ${row.week_drawdown_pct.toFixed(4)}% | ${row.week_realized_delta_pct.toFixed(4)}% | ${row.week_floating_pct.toFixed(4)}% | ${row.week_end_equity_pct.toFixed(4)}% | ${row.week_delta_equity_pct.toFixed(4)}% |`,
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
  try {
    await persistUniversalBacktestToDb(out);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`DB upsert skipped (universal v1): ${message}`);
  }
}

main().catch((error) => {
  console.error("v1-universal-tp1-friday-carry-aligned failed:", error);
  process.exit(1);
});
