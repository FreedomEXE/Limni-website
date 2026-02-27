import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { listPerformanceWeeks, readPerformanceSnapshotsByWeek, weekLabelFromOpen } from "../src/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import { getOandaInstrument } from "../src/lib/oandaPrices";

type AssetClass = "fx" | "indices" | "commodities" | "crypto";
type Direction = "LONG" | "SHORT";
type BreakoutBasis = "touch" | "close";
type BreakoutExitReason = "tp" | "sl" | "friday" | "no_trigger";
type VariantId =
  | "v1_antikythera"
  | "v2_antikythera"
  | "v3_antikythera"
  | "v1_tier1"
  | "v2_tier1"
  | "v3_tier1"
  | "triplet_antikythera"
  | "triplet_tier1";

type SnapshotRow = Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>>[number];

type Signal = {
  assetClass: AssetClass;
  pair: string;
  direction: Direction;
};

type OhlcPoint = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type SymbolSeries = {
  key: string;
  assetClass: AssetClass;
  pair: string;
  points: OhlcPoint[];
};

type TradeEval = {
  baseline_return_pct: number | null;
  breakout_return_pct: number | null;
  triggered: boolean;
  breakout_exit_reason: BreakoutExitReason | null;
};

type VariantWeek = {
  week_open_utc: string;
  week_label: string;
  trades: number;
  priced_trades: number;
  triggered_trades: number;
  baseline_return_pct: number;
  breakout_return_pct: number;
};

type Stats = {
  weeks: number;
  arithmetic_total_pct: number;
  compounded_total_pct: number;
  avg_weekly_pct: number;
  best_week_pct: number;
  worst_week_pct: number;
  win_weeks: number;
  loss_weeks: number;
  max_drawdown_pct: number;
};

type VariantSummary = {
  summary_id: string;
  id: VariantId;
  label: string;
  scope: "single" | "composite";
  breakout_profile: {
    id: string;
    tp_r: number;
    sl_r: number;
    intrabar_priority: "sl_first";
  };
  baseline: Stats & {
    total_trades: number;
    priced_trades: number;
  };
  breakout: Stats & {
    total_trades: number;
    priced_trades: number;
    triggered_trades: number;
    trigger_rate_pct: number;
  };
  delta: {
    arithmetic_total_pct: number;
    compounded_total_pct: number;
    max_drawdown_pct: number;
  };
  weekly: VariantWeek[];
};

const LOOKBACK_WEEKS = Number(process.env.LOOKBACK_WEEKS ?? "52");
const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY ?? "6");
const BREAKOUT_BASIS = (process.env.BREAKOUT_BASIS ?? "touch") as BreakoutBasis;
const BREAKOUT_BUFFER_PCT = Number(process.env.BREAKOUT_BUFFER_PCT ?? "0");
const BREAKOUT_TP_R_VALUES = parseNumberList(process.env.BREAKOUT_TP_R_VALUES ?? "0.5,1.0,1.5", [0.5, 1.0, 1.5]);
const BREAKOUT_SL_R_VALUES = parseNumberList(process.env.BREAKOUT_SL_R_VALUES ?? "0.5,1.0", [0.5, 1.0]);
const INCLUDE_CURRENT_WEEK = (process.env.INCLUDE_CURRENT_WEEK ?? "false").toLowerCase() === "true";

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";
const BITGET_BASE_URL = "https://api.bitget.com";

const VARIANT_LABELS: Record<VariantId, string> = {
  v1_antikythera: "V1 Antikythera",
  v2_antikythera: "V2 Antikythera",
  v3_antikythera: "V3 Antikythera",
  v1_tier1: "V1 Tier 1",
  v2_tier1: "V2 Tier 1",
  v3_tier1: "V3 Tier 1",
  triplet_antikythera: "Triplet Antikythera (V1+V2+V3)",
  triplet_tier1: "Triplet Tier 1 (V1+V2+V3)",
};

const TIER1_SOURCES: Record<"v1" | "v2" | "v3", string[]> = {
  v1: ["blended", "dealer", "commercial", "sentiment"],
  v2: ["dealer", "sentiment"],
  v3: ["dealer", "commercial", "sentiment"],
};

type BreakoutProfile = {
  id: string;
  tp_r: number;
  sl_r: number;
};

function parseNumberList(raw: string, fallback: number[]) {
  const parsed = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (parsed.length === 0) return fallback;
  return Array.from(new Set(parsed.map((v) => Number(v.toFixed(4))))).sort((a, b) => a - b);
}

function buildBreakoutProfiles() {
  const profiles: BreakoutProfile[] = [];
  for (const tp of BREAKOUT_TP_R_VALUES) {
    for (const sl of BREAKOUT_SL_R_VALUES) {
      profiles.push({
        id: `tp${tp.toFixed(2)}_sl${sl.toFixed(2)}`,
        tp_r: tp,
        sl_r: sl,
      });
    }
  }
  return profiles;
}

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

function toAssetClass(value: string): AssetClass | null {
  if (value === "fx" || value === "indices" || value === "commodities" || value === "crypto") return value;
  return null;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function computeStats(weeklyReturns: number[]): Stats {
  const weeks = weeklyReturns.length;
  const arithmetic = weeklyReturns.reduce((s, x) => s + x, 0);
  let compounded = 1;
  for (const r of weeklyReturns) compounded *= 1 + r / 100;
  const best = weeks ? Math.max(...weeklyReturns) : 0;
  const worst = weeks ? Math.min(...weeklyReturns) : 0;
  const wins = weeklyReturns.filter((x) => x > 0).length;
  const losses = weeklyReturns.filter((x) => x < 0).length;

  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  for (const r of weeklyReturns) {
    equity *= 1 + r / 100;
    if (equity > peak) peak = equity;
    const dd = ((equity - peak) / peak) * 100;
    if (dd < maxDd) maxDd = dd;
  }

  return {
    weeks,
    arithmetic_total_pct: round(arithmetic),
    compounded_total_pct: round((compounded - 1) * 100),
    avg_weekly_pct: round(weeks ? arithmetic / weeks : 0),
    best_week_pct: round(best),
    worst_week_pct: round(worst),
    win_weeks: wins,
    loss_weeks: losses,
    max_drawdown_pct: round(maxDd),
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

function getBitgetProductType() {
  return process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";
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

function getWeekWindow(weekOpenUtc: string, assetClass: AssetClass) {
  const openUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (assetClass === "crypto") {
    return { openUtc, closeUtc: openUtc.plus({ weeks: 1 }) };
  }
  return { openUtc, closeUtc: openUtc.plus({ days: 5 }) };
}

function getEquivalentModelRows(rows: SnapshotRow[], model: string) {
  return rows.filter((row) => row.model === model);
}

function directionalMapFromRow(row: SnapshotRow | undefined) {
  const out = new Map<string, Direction>();
  if (!row) return out;
  for (const detail of row.pair_details ?? []) {
    if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
    out.set(detail.pair, detail.direction);
  }
  return out;
}

function deriveAntikytheraV2Signals(rows: SnapshotRow[]): Signal[] {
  const out: Signal[] = [];
  for (const assetClass of ["fx", "indices", "commodities", "crypto"] as const) {
    const dealer = rows.find((row) => row.asset_class === assetClass && row.model === "dealer");
    const sentiment = rows.find((row) => row.asset_class === assetClass && row.model === "sentiment");
    if (!dealer || !sentiment) continue;
    const dealerMap = directionalMapFromRow(dealer);
    const sentimentMap = directionalMapFromRow(sentiment);
    for (const [pair, direction] of sentimentMap.entries()) {
      if (dealerMap.get(pair) !== direction) continue;
      out.push({ assetClass, pair, direction });
    }
  }
  return out;
}

function buildAntikytheraSignals(rows: SnapshotRow[], system: "v1" | "v2" | "v3"): Signal[] {
  if (system === "v2") {
    const directRows = getEquivalentModelRows(rows, "antikythera_v2");
    if (directRows.length === 0) return deriveAntikytheraV2Signals(rows);
  }
  const modelName = system === "v1" ? "antikythera" : system === "v2" ? "antikythera_v2" : "antikythera_v3";
  const out: Signal[] = [];
  for (const row of getEquivalentModelRows(rows, modelName)) {
    const assetClass = toAssetClass(row.asset_class);
    if (!assetClass) continue;
    for (const detail of row.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      out.push({ assetClass, pair: detail.pair, direction: detail.direction });
    }
  }
  return out;
}

function buildTier1Signals(rows: SnapshotRow[], system: "v1" | "v2" | "v3"): Signal[] {
  const models = TIER1_SOURCES[system];
  const out: Signal[] = [];

  for (const assetClass of ["fx", "indices", "commodities", "crypto"] as const) {
    const modelMaps = models.map((model) => directionalMapFromRow(
      rows.find((row) => row.asset_class === assetClass && row.model === model),
    ));
    const allPairs = new Set<string>();
    for (const m of modelMaps) for (const pair of m.keys()) allPairs.add(pair);

    for (const pair of allPairs) {
      let longCount = 0;
      let shortCount = 0;
      for (const m of modelMaps) {
        const direction = m.get(pair);
        if (direction === "LONG") longCount += 1;
        if (direction === "SHORT") shortCount += 1;
      }
      if (longCount === models.length) {
        out.push({ assetClass, pair, direction: "LONG" });
      } else if (shortCount === models.length) {
        out.push({ assetClass, pair, direction: "SHORT" });
      }
    }
  }
  return out;
}

async function runWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const safeLimit = Math.max(1, limit);
  const out: R[] = [];
  for (let i = 0; i < items.length; i += safeLimit) {
    const chunk = items.slice(i, i + safeLimit);
    const chunkOut = await Promise.all(chunk.map((item) => task(item)));
    out.push(...chunkOut);
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
      throw new Error(`OANDA OHLC fetch failed (${instrument}) [${response.status}] ${body}`);
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
      throw new Error(`Bitget OHLC fetch failed (${symbol}) [${response.status}] ${body}`);
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

async function fetchSeriesForSymbol(
  assetClass: AssetClass,
  pair: string,
  fromUtc: DateTime,
  toUtc: DateTime,
): Promise<SymbolSeries | null> {
  try {
    if (assetClass === "crypto") {
      const base = getCryptoBase(pair);
      if (!base) return null;
      const points = await fetchBitgetOhlcSeries(base, fromUtc, toUtc);
      return { key: `${assetClass}|${pair}`, assetClass, pair, points };
    }

    const symbol = assetClass === "fx" ? fxSymbol(pair) : pair;
    const points = await fetchOandaOhlcSeries(getOandaInstrument(symbol), fromUtc, toUtc);
    return { key: `${assetClass}|${pair}`, assetClass, pair, points };
  } catch (error) {
    console.error("Series fetch failed:", assetClass, pair, error);
    return null;
  }
}

function slicePoints(points: OhlcPoint[], fromTs: number, toTs: number) {
  return points.filter((p) => p.ts >= fromTs && p.ts < toTs);
}

function evalTrade(
  points: OhlcPoint[],
  direction: Direction,
  weekOpenTs: number,
  weekCloseTs: number,
  prevOpenTs: number,
  prevCloseTs: number,
  profile: BreakoutProfile,
): TradeEval {
  const prevWeek = slicePoints(points, prevOpenTs, prevCloseTs);
  const week = slicePoints(points, weekOpenTs, weekCloseTs);

  if (prevWeek.length === 0 || week.length === 0) {
    return { baseline_return_pct: null, breakout_return_pct: null, triggered: false, breakout_exit_reason: null };
  }

  const prevHigh = prevWeek.reduce((m, p) => Math.max(m, p.high), Number.NEGATIVE_INFINITY);
  const prevLow = prevWeek.reduce((m, p) => Math.min(m, p.low), Number.POSITIVE_INFINITY);
  const prevRange = prevHigh - prevLow;
  const entryOpen = week[0]!.open;
  const exitClose = week[week.length - 1]!.close;
  if (!(entryOpen > 0) || !(exitClose > 0) || !(prevHigh > 0) || !(prevLow > 0)) {
    return { baseline_return_pct: null, breakout_return_pct: null, triggered: false, breakout_exit_reason: null };
  }

  const sign = direction === "LONG" ? 1 : -1;
  const baseline = ((exitClose - entryOpen) / entryOpen) * 100 * sign;
  if (!(prevRange > 0)) {
    return { baseline_return_pct: baseline, breakout_return_pct: 0, triggered: false, breakout_exit_reason: "no_trigger" };
  }

  const upLevel = prevHigh * (1 + BREAKOUT_BUFFER_PCT / 100);
  const downLevel = prevLow * (1 - BREAKOUT_BUFFER_PCT / 100);
  let triggered = false;
  let breakoutEntry = 0;
  let triggerIndex = -1;

  for (let i = 0; i < week.length; i += 1) {
    const candle = week[i]!;
    if (direction === "LONG") {
      const hit = BREAKOUT_BASIS === "close" ? candle.close > upLevel : candle.high > upLevel;
      if (hit) {
        triggered = true;
        breakoutEntry = BREAKOUT_BASIS === "close" ? candle.close : upLevel;
        triggerIndex = i;
        break;
      }
    } else {
      const hit = BREAKOUT_BASIS === "close" ? candle.close < downLevel : candle.low < downLevel;
      if (hit) {
        triggered = true;
        breakoutEntry = BREAKOUT_BASIS === "close" ? candle.close : downLevel;
        triggerIndex = i;
        break;
      }
    }
  }

  if (!triggered || breakoutEntry <= 0 || triggerIndex < 0) {
    return { baseline_return_pct: baseline, breakout_return_pct: 0, triggered: false, breakout_exit_reason: "no_trigger" };
  }

  const tpDist = prevRange * profile.tp_r;
  const slDist = prevRange * profile.sl_r;
  let exitPrice = exitClose;
  let exitReason: BreakoutExitReason = "friday";

  if (tpDist > 0 && slDist > 0) {
    const tpPrice = direction === "LONG" ? breakoutEntry + tpDist : breakoutEntry - tpDist;
    const slPrice = direction === "LONG" ? breakoutEntry - slDist : breakoutEntry + slDist;
    const startIndex = BREAKOUT_BASIS === "close" ? triggerIndex + 1 : triggerIndex;

    for (let i = startIndex; i < week.length; i += 1) {
      const candle = week[i]!;
      const hitTp = direction === "LONG" ? candle.high >= tpPrice : candle.low <= tpPrice;
      const hitSl = direction === "LONG" ? candle.low <= slPrice : candle.high >= slPrice;
      if (hitTp && hitSl) {
        // Conservative intrabar ordering under OHLC ambiguity.
        exitPrice = slPrice;
        exitReason = "sl";
        break;
      }
      if (hitSl) {
        exitPrice = slPrice;
        exitReason = "sl";
        break;
      }
      if (hitTp) {
        exitPrice = tpPrice;
        exitReason = "tp";
        break;
      }
    }
  }

  const breakout = ((exitPrice - breakoutEntry) / breakoutEntry) * 100 * sign;
  return {
    baseline_return_pct: baseline,
    breakout_return_pct: breakout,
    triggered: true,
    breakout_exit_reason: exitReason,
  };
}

function dedupeCanonicalWeeks(weeksDesc: string[]) {
  const uniq = new Map<string, string>();
  for (const week of weeksDesc) {
    const parsedWeek = DateTime.fromISO(week, { zone: "utc" });
    if (!parsedWeek.isValid) continue;
    const canonical = getCanonicalWeekOpenUtc(parsedWeek);
    if (!uniq.has(canonical)) uniq.set(canonical, canonical);
  }
  return Array.from(uniq.values()).sort((a, b) => Date.parse(a) - Date.parse(b));
}

function variantSignalsForWeek(rows: SnapshotRow[]) {
  const v1Anti = buildAntikytheraSignals(rows, "v1");
  const v2Anti = buildAntikytheraSignals(rows, "v2");
  const v3Anti = buildAntikytheraSignals(rows, "v3");
  const v1T1 = buildTier1Signals(rows, "v1");
  const v2T1 = buildTier1Signals(rows, "v2");
  const v3T1 = buildTier1Signals(rows, "v3");

  return {
    v1_antikythera: v1Anti,
    v2_antikythera: v2Anti,
    v3_antikythera: v3Anti,
    v1_tier1: v1T1,
    v2_tier1: v2T1,
    v3_tier1: v3T1,
    triplet_antikythera: [...v1Anti, ...v2Anti, ...v3Anti],
    triplet_tier1: [...v1T1, ...v2T1, ...v3T1],
  } satisfies Record<VariantId, Signal[]>;
}

function isCurrentWeek(weekOpenUtc: string) {
  return weekOpenUtc === getCanonicalWeekOpenUtc();
}

async function main() {
  loadDotEnv();
  const rawWeeks = await listPerformanceWeeks(Math.max(LOOKBACK_WEEKS * 3, 90));
  const canonicalWeeksAsc = dedupeCanonicalWeeks(rawWeeks)
    .filter((week) => (INCLUDE_CURRENT_WEEK ? true : !isCurrentWeek(week)))
    .slice(-LOOKBACK_WEEKS);

  if (canonicalWeeksAsc.length === 0) {
    throw new Error("No performance weeks found for breakout overlay.");
  }

  const rowsByWeek = new Map<string, SnapshotRow[]>();
  const signalsByWeek = new Map<string, Record<VariantId, Signal[]>>();

  for (const week of canonicalWeeksAsc) {
    const rows = await readPerformanceSnapshotsByWeek(week);
    rowsByWeek.set(week, rows);
    signalsByWeek.set(week, variantSignalsForWeek(rows));
  }

  type RangeRow = {
    assetClass: AssetClass;
    pair: string;
    fromTs: number;
    toTs: number;
  };
  const ranges = new Map<string, RangeRow>();
  for (const week of canonicalWeeksAsc) {
    const weekSignals = signalsByWeek.get(week)!;
    const weekOpen = DateTime.fromISO(week, { zone: "utc" });
    for (const signals of Object.values(weekSignals)) {
      for (const signal of signals) {
        const window = getWeekWindow(week, signal.assetClass);
        const prevOpen = window.openUtc.minus({ weeks: 1 });
        const key = `${signal.assetClass}|${signal.pair}`;
        const nextFrom = prevOpen.toMillis();
        const nextTo = window.closeUtc.toMillis();
        const prev = ranges.get(key);
        if (!prev) {
          ranges.set(key, {
            assetClass: signal.assetClass,
            pair: signal.pair,
            fromTs: nextFrom,
            toTs: nextTo,
          });
        } else {
          prev.fromTs = Math.min(prev.fromTs, nextFrom);
          prev.toTs = Math.max(prev.toTs, nextTo);
        }
      }
    }
  }

  const seriesRows = await runWithConcurrency(Array.from(ranges.values()), FETCH_CONCURRENCY, async (row) =>
    fetchSeriesForSymbol(
      row.assetClass,
      row.pair,
      DateTime.fromMillis(row.fromTs, { zone: "utc" }),
      DateTime.fromMillis(row.toTs, { zone: "utc" }),
    ),
  );
  const seriesByKey = new Map(
    seriesRows
      .filter((row): row is SymbolSeries => row !== null)
      .map((row) => [row.key, row]),
  );

  const variants = Object.keys(VARIANT_LABELS) as VariantId[];
  const breakoutProfiles = buildBreakoutProfiles();
  const summaries: VariantSummary[] = [];

  for (const profile of breakoutProfiles) {
    const variantWeekly = new Map<VariantId, VariantWeek[]>();
    for (const variant of variants) variantWeekly.set(variant, []);

    for (const week of canonicalWeeksAsc) {
      const weekSignals = signalsByWeek.get(week)!;
      for (const variant of variants) {
        const signals = weekSignals[variant];
        let trades = 0;
        let priced = 0;
        let triggered = 0;
        let baselineReturn = 0;
        let breakoutReturn = 0;

        for (const signal of signals) {
          trades += 1;
          const series = seriesByKey.get(`${signal.assetClass}|${signal.pair}`);
          if (!series) continue;
          const window = getWeekWindow(week, signal.assetClass);
          const prevOpen = window.openUtc.minus({ weeks: 1 });
          const prevClose = window.closeUtc.minus({ weeks: 1 });

          const evalRow = evalTrade(
            series.points,
            signal.direction,
            window.openUtc.toMillis(),
            window.closeUtc.toMillis(),
            prevOpen.toMillis(),
            prevClose.toMillis(),
            profile,
          );
          if (evalRow.baseline_return_pct === null || evalRow.breakout_return_pct === null) continue;
          priced += 1;
          baselineReturn += evalRow.baseline_return_pct;
          breakoutReturn += evalRow.breakout_return_pct;
          if (evalRow.triggered) triggered += 1;
        }

        variantWeekly.get(variant)!.push({
          week_open_utc: week,
          week_label: weekLabelFromOpen(week),
          trades,
          priced_trades: priced,
          triggered_trades: triggered,
          baseline_return_pct: round(baselineReturn),
          breakout_return_pct: round(breakoutReturn),
        });
      }
    }

    for (const id of variants) {
      const weekly = variantWeekly.get(id)!;
      const baselineSeries = weekly.map((row) => row.baseline_return_pct);
      const breakoutSeries = weekly.map((row) => row.breakout_return_pct);
      const baselineStats = computeStats(baselineSeries);
      const breakoutStats = computeStats(breakoutSeries);
      const totalTrades = weekly.reduce((s, row) => s + row.trades, 0);
      const totalPriced = weekly.reduce((s, row) => s + row.priced_trades, 0);
      const totalTriggered = weekly.reduce((s, row) => s + row.triggered_trades, 0);

      summaries.push({
        summary_id: `${profile.id}::${id}`,
        id,
        label: VARIANT_LABELS[id],
        scope: id.startsWith("triplet_") ? "composite" : "single",
        breakout_profile: {
          id: profile.id,
          tp_r: profile.tp_r,
          sl_r: profile.sl_r,
          intrabar_priority: "sl_first",
        },
        baseline: {
          ...baselineStats,
          total_trades: totalTrades,
          priced_trades: totalPriced,
        },
        breakout: {
          ...breakoutStats,
          total_trades: totalTrades,
          priced_trades: totalPriced,
          triggered_trades: totalTriggered,
          trigger_rate_pct: round(totalPriced > 0 ? (totalTriggered / totalPriced) * 100 : 0, 2),
        },
        delta: {
          arithmetic_total_pct: round(breakoutStats.arithmetic_total_pct - baselineStats.arithmetic_total_pct),
          compounded_total_pct: round(breakoutStats.compounded_total_pct - baselineStats.compounded_total_pct),
          max_drawdown_pct: round(breakoutStats.max_drawdown_pct - baselineStats.max_drawdown_pct),
        },
        weekly,
      });
    }
  }

  summaries.sort((a, b) => b.breakout.compounded_total_pct - a.breakout.compounded_total_pct);

  const out = {
    generated_utc: DateTime.utc().toISO(),
    lookback_weeks: canonicalWeeksAsc.length,
    breakout_basis: BREAKOUT_BASIS,
    breakout_buffer_pct: BREAKOUT_BUFFER_PCT,
    breakout_profiles: breakoutProfiles,
    summaries_ranked_by_breakout_compound: summaries.map((row) => row.summary_id),
    assumptions: [
      "Phase-1 universe only: Antikythera (V1/V2/V3) and Tier1 (V1/V2/V3), plus triplet composites.",
      "Weekly entry anchor uses canonical week open (Sunday 19:00 ET, UTC-normalized).",
      "Breakout rule: LONG waits for prior-week high breach; SHORT waits for prior-week low breach.",
      `Breakout basis=${BREAKOUT_BASIS}; buffer=${BREAKOUT_BUFFER_PCT.toFixed(4)}%.`,
      "Breakout exit uses TP/SL targets sized by prior-week range (R-multiple sweep).",
      "TP/SL profile applied per run row: tp_r and sl_r.",
      "If both TP and SL hit in the same bar, SL is assumed first (conservative intrabar ordering).",
      "If no breakout occurs during week window, trade is skipped (0 contribution for breakout variant).",
      "Baseline = immediate entry at week open and hold to week close.",
      "Returns are summed across trades per week (same style as existing basket model aggregation).",
      "Costs/slippage/spread/commission/swap not included in this first-pass overlay test.",
    ],
    summaries,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-breakout-overlay-phase1-${stamp}.json`;
  const mdPath = `reports/universal-breakout-overlay-phase1-${stamp}.md`;
  const latestJson = "reports/universal-breakout-overlay-phase1-latest.json";
  const latestMd = "reports/universal-breakout-overlay-phase1-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJson, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal Breakout Overlay Phase 1");
  md.push("");
  md.push(`Generated: ${out.generated_utc}`);
  md.push(`Weeks: ${out.lookback_weeks}`);
  md.push(`Breakout basis: ${BREAKOUT_BASIS}`);
  md.push(`Breakout buffer: ${BREAKOUT_BUFFER_PCT.toFixed(4)}%`);
  md.push(`Profiles: ${breakoutProfiles.map((p) => p.id).join(", ")}`);
  md.push("");
  md.push("## Ranked Rows (Breakout Compounded Return)");
  md.push("| Rank | Profile | Variant | Baseline Comp % | Breakout Comp % | Delta Comp % | Baseline Worst Wk % | Breakout Worst Wk % | Trigger Rate % |");
  md.push("| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [idx, row] of summaries.entries()) {
    md.push(
      `| ${idx + 1} | ${row.breakout_profile.id} | ${row.id} | ${row.baseline.compounded_total_pct.toFixed(2)} | ${row.breakout.compounded_total_pct.toFixed(2)} | ${row.delta.compounded_total_pct.toFixed(2)} | ${row.baseline.worst_week_pct.toFixed(2)} | ${row.breakout.worst_week_pct.toFixed(2)} | ${row.breakout.trigger_rate_pct.toFixed(2)} |`,
    );
  }
  md.push("");
  md.push("## Assumptions");
  for (const line of out.assumptions) md.push(`- ${line}`);
  md.push("");
  md.push(`JSON: \`${jsonPath}\``);

  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(latestMd, md.join("\n"), "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${latestJson}`);
  console.log(`Wrote ${latestMd}`);
}

main().catch((error) => {
  console.error("universal-breakout-overlay-phase1 failed:", error);
  process.exit(1);
});
