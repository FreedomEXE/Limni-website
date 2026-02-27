import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { listPerformanceWeeks, readPerformanceSnapshotsByWeek } from "../src/lib/performanceSnapshots";
import { normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { readMarketSnapshot } from "../src/lib/priceStore";
import { groupSignals } from "../src/lib/plannedTrades";
import { PERFORMANCE_V1_MODELS } from "../src/lib/performance/modelConfig";
import type { PerformanceModel } from "../src/lib/performanceLab";
import { getPerformanceWindow } from "../src/lib/pricePerformance";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getOandaInstrument } from "../src/lib/oandaPrices";

type Direction = "LONG" | "SHORT";

type WeekChoice = {
  canonical: string;
  raw: string;
};

type LegResult = {
  key: string;
  model: PerformanceModel;
  asset_class: AssetClass;
  pair: string;
  direction: Direction;
  report_date: string | null;
  return_pct: number | null;
};

type WeekData = {
  week_open_utc: string;
  week_label: string;
  legs: LegResult[];
};

type HistoryStat = {
  samples: number;
  sum: number;
  gross_profit: number;
  gross_loss_abs: number;
};

type OhlcPoint = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type WeeklyEvalRow = {
  week_label: string;
  baseline_return_pct: number;
  candidate_return_pct: number;
  baseline_trades: number;
  candidate_trades: number;
  candidate_tp_hits: number;
  filtered_drag: number;
  filtered_min_samples: number;
  filtered_expectancy: number;
  filtered_pf: number;
};

type CurveStats = {
  weeks: number;
  arithmetic_return_pct: number;
  compounded_return_pct: number;
  cagr_pct: number;
  weekly_avg_return_pct: number;
  weekly_volatility_pct: number;
  win_rate_pct: number;
  max_drawdown_pct: number;
  max_drawdown_duration_weeks: number;
  time_under_water_pct: number;
  calmar: number | null;
  sharpe_weekly: number | null;
  sortino_weekly: number | null;
  cvar_95_weekly_pct: number;
  max_losing_streak_weeks: number;
};

type TradeStats = {
  trades: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  avg_return_pct: number;
  gross_profit_pct: number;
  gross_loss_abs_pct: number;
  profit_factor: number | null;
  expectancy_pct: number;
};

const LOOKBACK_WEEKS = Number(process.env.QUALITY_LOOKBACK_WEEKS ?? "26");
const TEST_WEEKS = Number(process.env.QUALITY_TEST_WEEKS ?? "52");
const MIN_SAMPLES = Number(process.env.QUALITY_MIN_SAMPLES ?? "20");
const PF_THRESHOLD = Number(process.env.QUALITY_PF_THRESHOLD ?? "1.05");
const EXPECTANCY_THRESHOLD = Number(process.env.QUALITY_EXPECTANCY_THRESHOLD ?? "0");
const TP_PCT = Number(process.env.QUALITY_TP_PCT ?? "1");
const TP_SHARE = Number(process.env.QUALITY_TP_SHARE ?? "0.5");
const DRAG_SYMBOLS = (process.env.QUALITY_DRAG_SYMBOLS ?? "NIKKEIUSD,SPXUSD,XAGUSD")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
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

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + ((v - mean) ** 2), 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function maxLosingStreak(returns: number[]) {
  let maxStreak = 0;
  let current = 0;
  for (const r of returns) {
    if (r < 0) {
      current += 1;
      if (current > maxStreak) maxStreak = current;
    } else {
      current = 0;
    }
  }
  return maxStreak;
}

function cvar95(returns: number[]) {
  if (!returns.length) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const tailCount = Math.max(1, Math.floor(sorted.length * 0.05));
  const tail = sorted.slice(0, tailCount);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

function computeCurveStats(weeklyReturns: number[]): CurveStats {
  const weeks = weeklyReturns.length;
  const arithmetic = weeklyReturns.reduce((a, b) => a + b, 0);
  const avg = weeks > 0 ? arithmetic / weeks : 0;
  const vol = stdDev(weeklyReturns);

  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  let currentUnderwater = 0;
  let maxUnderwater = 0;
  let underwaterWeeks = 0;

  for (const r of weeklyReturns) {
    equity *= (1 + (r / 100));
    if (equity >= peak) {
      peak = equity;
      currentUnderwater = 0;
    } else {
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
      currentUnderwater += 1;
      underwaterWeeks += 1;
      if (currentUnderwater > maxUnderwater) maxUnderwater = currentUnderwater;
    }
  }

  const compounded = (equity - 1) * 100;
  const years = weeks > 0 ? (weeks / 52) : 0;
  const cagr = years > 0 ? ((equity ** (1 / years)) - 1) * 100 : 0;
  const winRate = weeks > 0 ? (weeklyReturns.filter((r) => r > 0).length / weeks) * 100 : 0;
  const downside = stdDev(weeklyReturns.filter((r) => r < 0));
  const sharpe = vol > 0 ? (avg / vol) * Math.sqrt(52) : null;
  const sortino = downside > 0 ? (avg / downside) * Math.sqrt(52) : null;
  const calmar = maxDd > 0 ? (cagr / maxDd) : null;

  return {
    weeks,
    arithmetic_return_pct: round(arithmetic, 4),
    compounded_return_pct: round(compounded, 4),
    cagr_pct: round(cagr, 4),
    weekly_avg_return_pct: round(avg, 4),
    weekly_volatility_pct: round(vol, 4),
    win_rate_pct: round(winRate, 2),
    max_drawdown_pct: round(maxDd, 4),
    max_drawdown_duration_weeks: maxUnderwater,
    time_under_water_pct: weeks > 0 ? round((underwaterWeeks / weeks) * 100, 2) : 0,
    calmar: calmar === null ? null : round(calmar, 4),
    sharpe_weekly: sharpe === null ? null : round(sharpe, 4),
    sortino_weekly: sortino === null ? null : round(sortino, 4),
    cvar_95_weekly_pct: round(cvar95(weeklyReturns), 4),
    max_losing_streak_weeks: maxLosingStreak(weeklyReturns),
  };
}

function computeTradeStats(returns: number[]): TradeStats {
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r < 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLossAbs = Math.abs(losses.reduce((a, b) => a + b, 0));
  const pf = grossLossAbs > 0 ? grossProfit / grossLossAbs : (grossProfit > 0 ? Infinity : null);
  const avg = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  return {
    trades: returns.length,
    wins: wins.length,
    losses: losses.length,
    win_rate_pct: returns.length > 0 ? round((wins.length / returns.length) * 100, 2) : 0,
    avg_return_pct: round(avg, 4),
    gross_profit_pct: round(grossProfit, 4),
    gross_loss_abs_pct: round(grossLossAbs, 4),
    profit_factor: pf === null ? null : (Number.isFinite(pf) ? round(pf, 4) : pf),
    expectancy_pct: round(avg, 4),
  };
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

function pairKey(assetClass: AssetClass, pair: string) {
  return `${assetClass}|${pair}`;
}

function legKey(
  model: PerformanceModel,
  assetClass: AssetClass,
  pair: string,
  direction: Direction,
) {
  return `${model}|${assetClass}|${pair}|${direction}`;
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

async function didLegHitTp(
  weekOpenUtc: string,
  leg: LegResult,
  seriesCache: Map<string, OhlcPoint[] | null>,
): Promise<boolean> {
  const cacheKey = `${weekOpenUtc}|${leg.asset_class}|${leg.pair}|${leg.report_date ?? ""}`;
  if (!seriesCache.has(cacheKey)) {
    const window = resolveWindow(weekOpenUtc, leg.asset_class, leg.report_date);
    const fromUtc = DateTime.fromISO(window.openUtc.toISO() ?? "", { zone: "utc" });
    const toUtc = DateTime.fromISO(window.closeUtc.toISO() ?? "", { zone: "utc" });
    if (!fromUtc.isValid || !toUtc.isValid || toUtc.toMillis() <= fromUtc.toMillis()) {
      seriesCache.set(cacheKey, null);
    } else {
      try {
        let points: OhlcPoint[] = [];
        if (leg.asset_class === "crypto") {
          const base = getCryptoBase(leg.pair);
          if (base) {
            points = await fetchBitgetOhlcSeries(base, fromUtc, toUtc);
          }
        } else {
          const symbol = leg.asset_class === "fx" ? fxSymbol(leg.pair) : leg.pair;
          points = await fetchOandaOhlcSeries(symbol, fromUtc, toUtc);
        }
        seriesCache.set(cacheKey, points.length ? points : null);
      } catch {
        seriesCache.set(cacheKey, null);
      }
    }
  }

  const points = seriesCache.get(cacheKey);
  if (!points || !points.length) return false;
  const entry = points[0]!.open;
  if (!(entry > 0)) return false;
  const target =
    leg.direction === "LONG"
      ? entry * (1 + TP_PCT / 100)
      : entry * (1 - TP_PCT / 100);
  if (leg.direction === "LONG") {
    return points.some((p) => p.high >= target);
  }
  return points.some((p) => p.low <= target);
}

async function buildWeekChoices(limit = 160): Promise<WeekChoice[]> {
  const rawWeeks = await listPerformanceWeeks(limit);
  const canonicalMap = new Map<string, string[]>();
  for (const raw of rawWeeks) {
    const canonical = normalizeWeekOpenUtc(raw) ?? raw;
    const existing = canonicalMap.get(canonical) ?? [];
    existing.push(raw);
    canonicalMap.set(canonical, existing);
  }

  const out: WeekChoice[] = [];
  for (const [canonical, raws] of canonicalMap.entries()) {
    let bestRaw = raws[0]!;
    let bestScore = -1;
    for (const raw of raws) {
      const rows = await readPerformanceSnapshotsByWeek(raw);
      const score = rows.reduce((sum, row) => sum + (row.pair_details?.length ?? 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestRaw = raw;
      }
    }
    out.push({ canonical, raw: bestRaw });
  }

  return out.sort((a, b) => Date.parse(a.canonical) - Date.parse(b.canonical));
}

async function loadMarketReturnsByPair(weekOpenUtc: string) {
  const out = new Map<string, number>();
  for (const assetClass of ["fx", "indices", "commodities", "crypto"] as const) {
    const snapshot = await readMarketSnapshot(weekOpenUtc, assetClass);
    if (!snapshot) continue;
    for (const [pair, value] of Object.entries(snapshot.pairs ?? {})) {
      if (value && typeof value.percent === "number" && Number.isFinite(value.percent)) {
        out.set(pairKey(assetClass, pair), value.percent);
      }
    }
  }
  return out;
}

async function buildWeekData(choice: WeekChoice): Promise<WeekData> {
  const rows = await readPerformanceSnapshotsByWeek(choice.raw);
  const marketReturns = await loadMarketReturnsByPair(choice.canonical);
  const reportDateByAssetModel = new Map<string, string | null>();
  const signals: Array<{
    symbol: string;
    direction: Direction;
    model: PerformanceModel;
    asset_class: AssetClass;
  }> = [];

  for (const row of rows) {
    if (!PERFORMANCE_V1_MODELS.includes(row.model)) continue;
    const assetClass = row.asset_class as AssetClass;
    if (!["fx", "indices", "commodities", "crypto"].includes(assetClass)) continue;
    reportDateByAssetModel.set(`${assetClass}|${row.model}`, row.report_date ?? null);
    for (const detail of row.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      signals.push({
        symbol: detail.pair,
        direction: detail.direction,
        model: row.model,
        asset_class: assetClass,
      });
    }
  }

  const plannedPairs = groupSignals(signals, PERFORMANCE_V1_MODELS, { dropNetted: false });
  const legs: LegResult[] = [];
  for (const pair of plannedPairs) {
    const assetClass = pair.assetClass as AssetClass;
    for (const leg of pair.legs) {
      if (leg.direction !== "LONG" && leg.direction !== "SHORT") continue;
      const rawPercent = marketReturns.get(pairKey(assetClass, pair.symbol));
      const ret =
        typeof rawPercent === "number"
          ? (leg.direction === "LONG" ? rawPercent : -rawPercent)
          : null;
      legs.push({
        key: legKey(leg.model, assetClass, pair.symbol, leg.direction),
        model: leg.model,
        asset_class: assetClass,
        pair: pair.symbol,
        direction: leg.direction,
        report_date: reportDateByAssetModel.get(`${assetClass}|${leg.model}`) ?? null,
        return_pct: typeof ret === "number" && Number.isFinite(ret) ? ret : null,
      });
    }
  }

  return {
    week_open_utc: choice.canonical,
    week_label: DateTime.fromISO(choice.canonical, { zone: "utc" }).toFormat("yyyy-LL-dd"),
    legs,
  };
}

function buildHistoryStats(historyWeeks: WeekData[]): Map<string, HistoryStat> {
  const stats = new Map<string, HistoryStat>();
  for (const week of historyWeeks) {
    for (const leg of week.legs) {
      if (leg.return_pct === null) continue;
      const cur = stats.get(leg.key) ?? {
        samples: 0,
        sum: 0,
        gross_profit: 0,
        gross_loss_abs: 0,
      };
      cur.samples += 1;
      cur.sum += leg.return_pct;
      if (leg.return_pct > 0) cur.gross_profit += leg.return_pct;
      if (leg.return_pct < 0) cur.gross_loss_abs += Math.abs(leg.return_pct);
      stats.set(leg.key, cur);
    }
  }
  return stats;
}

function profitFactor(stat: HistoryStat): number {
  if (stat.gross_loss_abs <= 0) return stat.gross_profit > 0 ? Infinity : 0;
  return stat.gross_profit / stat.gross_loss_abs;
}

async function main() {
  loadDotEnv();
  const weekChoices = await buildWeekChoices(220);
  if (weekChoices.length < 3) {
    throw new Error(
      `Not enough weeks (${weekChoices.length}) to run walk-forward.`,
    );
  }

  const effectiveLookback = Math.min(
    LOOKBACK_WEEKS,
    Math.max(1, weekChoices.length - 2),
  );
  const effectiveMinSamples = Math.min(MIN_SAMPLES, Math.max(1, effectiveLookback));
  const maxEvaluableWeeks = weekChoices.length - effectiveLookback;
  const effectiveTestWeeks = Math.min(TEST_WEEKS, Math.max(1, maxEvaluableWeeks));

  const evalStartIndex = Math.max(
    effectiveLookback,
    weekChoices.length - effectiveTestWeeks,
  );
  const firstNeededIndex = Math.max(0, evalStartIndex - effectiveLookback);
  const neededChoices = weekChoices.slice(firstNeededIndex);
  const weekDataList = await Promise.all(neededChoices.map((choice) => buildWeekData(choice)));

  const byCanonical = new Map(weekDataList.map((w) => [w.week_open_utc, w]));
  const baselineWeeklyReturns: number[] = [];
  const candidateWeeklyReturns: number[] = [];
  const baselineTradeReturns: number[] = [];
  const candidateTradeReturns: number[] = [];
  const weeklyRows: WeeklyEvalRow[] = [];
  const seriesCache = new Map<string, OhlcPoint[] | null>();

  let totalFilteredDrag = 0;
  let totalFilteredMinSamples = 0;
  let totalFilteredExpectancy = 0;
  let totalFilteredPf = 0;
  let totalTpHits = 0;
  let totalBaselineTrades = 0;
  let totalCandidateTrades = 0;

  for (let i = evalStartIndex; i < weekChoices.length; i += 1) {
    const currentCanonical = weekChoices[i]!.canonical;
    const current = byCanonical.get(currentCanonical);
    if (!current) continue;

    const historyWeeks: WeekData[] = [];
    for (let j = i - effectiveLookback; j < i; j += 1) {
      const hist = byCanonical.get(weekChoices[j]!.canonical);
      if (hist) historyWeeks.push(hist);
    }
    const histStats = buildHistoryStats(historyWeeks);

    const pricedCurrent = current.legs.filter((leg) => leg.return_pct !== null);
    const baselineReturn = pricedCurrent.reduce((sum, leg) => sum + (leg.return_pct ?? 0), 0);
    baselineWeeklyReturns.push(baselineReturn);
    baselineTradeReturns.push(...pricedCurrent.map((leg) => leg.return_pct ?? 0));
    totalBaselineTrades += pricedCurrent.length;

    const selected: LegResult[] = [];
    let filteredDrag = 0;
    let filteredMinSamples = 0;
    let filteredExpectancy = 0;
    let filteredPf = 0;

    for (const leg of pricedCurrent) {
      if (DRAG_SYMBOLS.includes(leg.pair.toUpperCase())) {
        filteredDrag += 1;
        continue;
      }
      const stat = histStats.get(leg.key);
      const samples = stat?.samples ?? 0;
      if (samples < effectiveMinSamples) {
        filteredMinSamples += 1;
        continue;
      }
      const expectancy = (stat?.sum ?? 0) / Math.max(1, samples);
      if (!(expectancy > EXPECTANCY_THRESHOLD)) {
        filteredExpectancy += 1;
        continue;
      }
      const pf = stat ? profitFactor(stat) : 0;
      if (!(pf > PF_THRESHOLD)) {
        filteredPf += 1;
        continue;
      }
      selected.push(leg);
    }

    const tpFlags = new Map<string, boolean>();
    await runWithConcurrency(selected, FETCH_CONCURRENCY, async (leg) => {
      const key = `${leg.key}|${current.week_open_utc}`;
      const hit = await didLegHitTp(current.week_open_utc, leg, seriesCache);
      tpFlags.set(key, hit);
      return 0;
    });

    let candidateReturn = 0;
    let tpHits = 0;
    for (const leg of selected) {
      const raw = leg.return_pct ?? 0;
      const hit = tpFlags.get(`${leg.key}|${current.week_open_utc}`) ?? false;
      const ret = hit ? (TP_SHARE * TP_PCT) + ((1 - TP_SHARE) * raw) : raw;
      if (hit) tpHits += 1;
      candidateReturn += ret;
      candidateTradeReturns.push(ret);
    }

    candidateWeeklyReturns.push(candidateReturn);
    totalCandidateTrades += selected.length;
    totalTpHits += tpHits;
    totalFilteredDrag += filteredDrag;
    totalFilteredMinSamples += filteredMinSamples;
    totalFilteredExpectancy += filteredExpectancy;
    totalFilteredPf += filteredPf;

    weeklyRows.push({
      week_label: current.week_label,
      baseline_return_pct: round(baselineReturn, 4),
      candidate_return_pct: round(candidateReturn, 4),
      baseline_trades: pricedCurrent.length,
      candidate_trades: selected.length,
      candidate_tp_hits: tpHits,
      filtered_drag: filteredDrag,
      filtered_min_samples: filteredMinSamples,
      filtered_expectancy: filteredExpectancy,
      filtered_pf: filteredPf,
    });
  }

  const baselineCurve = computeCurveStats(baselineWeeklyReturns);
  const candidateCurve = computeCurveStats(candidateWeeklyReturns);
  const baselineTrades = computeTradeStats(baselineTradeReturns);
  const candidateTrades = computeTradeStats(candidateTradeReturns);
  const basePfNum = typeof baselineTrades.profit_factor === "number" ? baselineTrades.profit_factor : 0;
  const candPfNum = typeof candidateTrades.profit_factor === "number" ? candidateTrades.profit_factor : 0;

  const out = {
    generated_utc: DateTime.utc().toISO(),
    config: {
      system: "v1_universal_adaptive_quality_filter",
      lookback_weeks_requested: LOOKBACK_WEEKS,
      lookback_weeks_used: effectiveLookback,
      test_weeks_requested: TEST_WEEKS,
      test_weeks_used: effectiveTestWeeks,
      evaluated_weeks: weeklyRows.length,
      min_samples_requested: MIN_SAMPLES,
      min_samples_used: effectiveMinSamples,
      expectancy_threshold_pct: EXPECTANCY_THRESHOLD,
      profit_factor_threshold: PF_THRESHOLD,
      drag_symbols: DRAG_SYMBOLS,
      tp_pct: TP_PCT,
      tp_share: TP_SHARE,
      friday_flat: true,
      carry_across_weeks: false,
      basis: "1:1 per-leg percent returns (no position sizing)",
    },
    period: {
      from_week: weeklyRows[0]?.week_label ?? null,
      to_week: weeklyRows[weeklyRows.length - 1]?.week_label ?? null,
    },
    baseline_v1_universal: {
      curve: baselineCurve,
      trades: baselineTrades,
    },
    candidate_adaptive: {
      curve: candidateCurve,
      trades: candidateTrades,
      totals: {
        baseline_trades: totalBaselineTrades,
        candidate_trades: totalCandidateTrades,
        trade_participation_pct: totalBaselineTrades > 0
          ? round((totalCandidateTrades / totalBaselineTrades) * 100, 2)
          : 0,
        tp_hits: totalTpHits,
        tp_hit_rate_on_candidate_pct: totalCandidateTrades > 0
          ? round((totalTpHits / totalCandidateTrades) * 100, 2)
          : 0,
        filtered_drag: totalFilteredDrag,
        filtered_min_samples: totalFilteredMinSamples,
        filtered_expectancy: totalFilteredExpectancy,
        filtered_pf: totalFilteredPf,
      },
    },
    deltas: {
      arithmetic_return_pct: round(
        candidateCurve.arithmetic_return_pct - baselineCurve.arithmetic_return_pct,
        4,
      ),
      compounded_return_pct: round(
        candidateCurve.compounded_return_pct - baselineCurve.compounded_return_pct,
        4,
      ),
      max_drawdown_pct: round(
        candidateCurve.max_drawdown_pct - baselineCurve.max_drawdown_pct,
        4,
      ),
      weekly_volatility_pct: round(
        candidateCurve.weekly_volatility_pct - baselineCurve.weekly_volatility_pct,
        4,
      ),
      cvar_95_weekly_pct: round(
        candidateCurve.cvar_95_weekly_pct - baselineCurve.cvar_95_weekly_pct,
        4,
      ),
      trade_win_rate_pct: round(
        candidateTrades.win_rate_pct - baselineTrades.win_rate_pct,
        2,
      ),
      trade_profit_factor_delta: round(candPfNum - basePfNum, 4),
    },
    weekly: weeklyRows,
    assumptions: [
      "Walk-forward: each week uses only prior lookback window stats; no look-ahead.",
      "Signal universe: V1 universal planned legs (dropNetted=false).",
      "Quality key granularity: model + asset_class + pair + direction.",
      "Gate requires all: min samples, expectancy threshold, PF threshold, and not in drag list.",
      "Exit policy: TP on TP_SHARE of position at TP_PCT if touched intraweek (H1 high/low), remainder held to Friday close.",
      "No carry across weeks; no dynamic sizing.",
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/v1-universal-adaptive-quality-filter-${stamp}.json`;
  const latestJsonPath = "reports/v1-universal-adaptive-quality-filter-latest.json";
  const mdPath = `reports/v1-universal-adaptive-quality-filter-${stamp}.md`;
  const latestMdPath = "reports/v1-universal-adaptive-quality-filter-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# V1 Universal Adaptive Quality Filter");
  md.push("");
  md.push(`Generated: ${out.generated_utc}`);
  md.push(`Period: ${out.period.from_week ?? "n/a"} -> ${out.period.to_week ?? "n/a"} (${out.config.evaluated_weeks} weeks)`);
  md.push("");
  md.push("## Config");
  md.push(`- Lookback weeks: ${out.config.lookback_weeks_used} (requested ${out.config.lookback_weeks_requested})`);
  md.push(`- Test weeks: ${out.config.test_weeks_used} (requested ${out.config.test_weeks_requested})`);
  md.push(`- Min samples: ${out.config.min_samples_used} (requested ${out.config.min_samples_requested})`);
  md.push(`- Expectancy threshold: ${EXPECTANCY_THRESHOLD.toFixed(2)}%`);
  md.push(`- PF threshold: ${PF_THRESHOLD.toFixed(2)}`);
  md.push(`- Drag symbols: ${DRAG_SYMBOLS.join(", ")}`);
  md.push(`- TP: ${TP_PCT.toFixed(2)}% on ${(TP_SHARE * 100).toFixed(0)}% size`);
  md.push("");
  md.push("## Investor Metrics");
  md.push("| Metric | Baseline V1 Universal | Candidate Adaptive | Delta |");
  md.push("| --- | ---: | ---: | ---: |");
  md.push(`| Arithmetic Return % | ${baselineCurve.arithmetic_return_pct.toFixed(4)} | ${candidateCurve.arithmetic_return_pct.toFixed(4)} | ${out.deltas.arithmetic_return_pct.toFixed(4)} |`);
  md.push(`| Compounded Return % | ${baselineCurve.compounded_return_pct.toFixed(4)} | ${candidateCurve.compounded_return_pct.toFixed(4)} | ${out.deltas.compounded_return_pct.toFixed(4)} |`);
  md.push(`| Max Drawdown % | ${baselineCurve.max_drawdown_pct.toFixed(4)} | ${candidateCurve.max_drawdown_pct.toFixed(4)} | ${out.deltas.max_drawdown_pct.toFixed(4)} |`);
  md.push(`| Weekly Volatility % | ${baselineCurve.weekly_volatility_pct.toFixed(4)} | ${candidateCurve.weekly_volatility_pct.toFixed(4)} | ${out.deltas.weekly_volatility_pct.toFixed(4)} |`);
  md.push(`| CVaR 95 Weekly % | ${baselineCurve.cvar_95_weekly_pct.toFixed(4)} | ${candidateCurve.cvar_95_weekly_pct.toFixed(4)} | ${out.deltas.cvar_95_weekly_pct.toFixed(4)} |`);
  md.push(`| Calmar | ${baselineCurve.calmar === null ? "n/a" : baselineCurve.calmar.toFixed(4)} | ${candidateCurve.calmar === null ? "n/a" : candidateCurve.calmar.toFixed(4)} | n/a |`);
  md.push(`| Sharpe (weekly) | ${baselineCurve.sharpe_weekly === null ? "n/a" : baselineCurve.sharpe_weekly.toFixed(4)} | ${candidateCurve.sharpe_weekly === null ? "n/a" : candidateCurve.sharpe_weekly.toFixed(4)} | n/a |`);
  md.push("");
  md.push("## Trade Metrics");
  md.push("| Metric | Baseline | Candidate |");
  md.push("| --- | ---: | ---: |");
  md.push(`| Trades | ${baselineTrades.trades} | ${candidateTrades.trades} |`);
  md.push(`| Win Rate % | ${baselineTrades.win_rate_pct.toFixed(2)} | ${candidateTrades.win_rate_pct.toFixed(2)} |`);
  md.push(`| Avg Return / Trade % | ${baselineTrades.avg_return_pct.toFixed(4)} | ${candidateTrades.avg_return_pct.toFixed(4)} |`);
  md.push(`| Profit Factor | ${baselineTrades.profit_factor === null ? "n/a" : String(baselineTrades.profit_factor)} | ${candidateTrades.profit_factor === null ? "n/a" : String(candidateTrades.profit_factor)} |`);
  md.push(`| TP Hits | n/a | ${out.candidate_adaptive.totals.tp_hits} |`);
  md.push(`| Candidate Participation % | n/a | ${out.candidate_adaptive.totals.trade_participation_pct.toFixed(2)} |`);
  md.push("");
  md.push("## Weekly");
  md.push("| Week | Base % | Cand % | Base Trades | Cand Trades | TP Hits | F Drag | F MinN | F Exp | F PF |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of weeklyRows) {
    md.push(`| ${row.week_label} | ${row.baseline_return_pct.toFixed(4)} | ${row.candidate_return_pct.toFixed(4)} | ${row.baseline_trades} | ${row.candidate_trades} | ${row.candidate_tp_hits} | ${row.filtered_drag} | ${row.filtered_min_samples} | ${row.filtered_expectancy} | ${row.filtered_pf} |`);
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
  console.error("v1-universal-adaptive-quality-filter failed:", error);
  process.exit(1);
});
