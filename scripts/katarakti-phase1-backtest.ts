
// Set DATABASE_URL before imports for standalone script runs.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import { getPool, query } from "../src/lib/db";
import { readMarketSnapshot } from "../src/lib/priceStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getOandaInstrument } from "../src/lib/oandaPrices";
import { PERFORMANCE_V1_MODELS } from "../src/lib/performance/modelConfig";
import type { PerformanceModel } from "../src/lib/performanceLab";

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type BiasDirection = Direction | "EXCLUDED";
type BiasSystem = "universal_v1" | "tiered_v1";
type NeutralMode = "both_ways" | "skip";
type EntryMode = "sweep" | "week_open_hold";
type SignalDirection = "LONG" | "SHORT";
type SweepSide = "HIGH" | "LOW";
type TestPlan = "phase1" | "phase2";
type StopStep =
  | "hard_sl"
  | "breakeven"
  | "lock_015"
  | "lock_035"
  | "lock_055"
  | "trailing"
  | "week_close";
type ExitMode = "stepped_with_hard_sl" | "stepped_no_hard_sl";
type LockStyle = "fixed_pct" | "atr";
type TierRiskModel = "flat" | "weighted";

type HandshakeConfig = {
  enabled: boolean;
  corrThresholdAbs: number;
  minConfirmations: number;
  includeAntiCorrelation: boolean;
  lookbackHours: number;
};

type HandshakeDiagnostics = {
  total_signals: number;
  clustered_signals: number;
  clustered_passed_signals: number;
  standalone_signals: number;
  passed_signals: number;
  gated_out_signals: number;
  trigger_rate_pct: number;
  avg_cluster_size_triggered: number;
};

type CorrelationEdge = {
  pairKey: string;
  correlation: number;
};

type WeekCorrelationData = {
  week_open_utc: string;
  lookback_hours: number;
  matrix_rows: Array<{
    pair_a: string;
    pair_b: string;
    correlation: number;
    sample_size: number;
  }>;
  adjacency: Map<string, CorrelationEdge[]>;
};

type OhlcCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type PairInfo = {
  assetClass: AssetClass;
  pair: string;
};

type SnapshotRow = {
  week_open_utc: Date;
  asset_class: AssetClass;
  model: PerformanceModel;
  pair_details:
    | Array<{
      pair?: string;
      direction?: Direction | null;
    }>
    | string
    | null;
};

type WeekBiasMaps = {
  universal: Map<string, BiasDirection>;
  tieredDirection: Map<string, BiasDirection>;
  tieredTier: Map<string, 1 | 2 | null>;
};

type SignalCandidate = {
  assetClass: AssetClass;
  pair: string;
  entrySource: EntryMode;
  direction: SignalDirection;
  sweepSide: SweepSide;
  sessionName: "asia_ref" | "ny_ref";
  entryCandleIndex: number;
  entryCandleTs: number;
  entryTimeMs: number;
  entryPrice: number;
};

type AcceptedTrade = {
  weekOpenUtc: string;
  biasSystem: BiasSystem;
  neutralMode: NeutralMode;
  assetClass: AssetClass;
  pair: string;
  entrySource: EntryMode;
  biasDirection: BiasDirection;
  direction: SignalDirection;
  sweepSide: SweepSide;
  sessionName: "asia_ref" | "ny_ref";
  entryTimeUtc: string;
  exitTimeUtc: string;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  stopDistance: number;
  riskPct: number;
  riskUsd: number;
  notionalUsd: number;
  grossPnlUsd: number;
  costUsd: number;
  netPnlUsd: number;
  returnPctOnEntryEquity: number;
  rMultipleGross: number;
  rMultipleNet: number;
  exitReason: "STOP" | "WEEK_CLOSE";
  exitStep: StopStep;
  peakProfitPct: number;
  reached025: boolean;
  reached050: boolean;
  reached075: boolean;
  reached100: boolean;
  durationHours: number;
  entryTimeMs: number;
  exitTimeMs: number;
};

type WeekVariantSummary = {
  week_open_utc: string;
  week_label: string;
  starting_equity_usd: number;
  ending_equity_usd: number;
  week_return_pct: number;
  trades: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  avg_trade_return_pct: number;
  avg_trade_duration_hours: number;
};

type VariantRun = {
  id: string;
  bias_system: BiasSystem;
  neutral_mode: NeutralMode;
  headline: {
    start_equity_usd: number;
    end_equity_usd: number;
    total_return_pct: number;
    compounded_return_pct: number;
    max_drawdown_pct: number;
    win_rate_pct: number;
    trades: number;
    avg_trade_duration_hours: number;
    avg_trade_return_pct: number;
    trades_per_week: number;
    risk_adjusted_return: number;
    exit_step_distribution: Record<StopStep, number>;
    milestone_reach_rates_pct: {
      reached_025: number;
      reached_050: number;
      reached_075: number;
      reached_100: number;
    };
    handshake_diagnostics: HandshakeDiagnostics | null;
  };
  weekly: WeekVariantSummary[];
  trades: AcceptedTrade[];
};

type BaselineSummary = {
  system: BiasSystem;
  weekly: Array<{
    week_open_utc: string;
    week_label: string;
    return_pct: number;
    trades: number;
    wins: number;
    win_rate_pct: number;
  }>;
  total: {
    arithmetic_return_pct: number;
    compounded_return_pct: number;
    trades: number;
    win_rate_pct: number;
  };
};

const WEEKS_TO_BACKTEST = Number(process.env.BACKTEST_WEEKS ?? "5");
const WEEKS = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);

const STARTING_EQUITY_USD = Number(process.env.KATARAKTI_STARTING_EQUITY_USD ?? "100000");
const FETCH_CONCURRENCY = Number(process.env.KATARAKTI_FETCH_CONCURRENCY ?? "6");
const MAX_ENTRIES_PER_PAIR_PER_WEEK = Number(process.env.KATARAKTI_MAX_ENTRIES_PER_PAIR_PER_WEEK ?? "1");
const ENTRY_MODE: EntryMode =
  process.env.KATARAKTI_ENTRY_MODE === "week_open_hold"
    ? "week_open_hold"
    : "sweep";
const BLOCK_SWEEP_THU_FRI =
  process.env.KATARAKTI_SWEEP_BLOCK_THU_FRI === "1" ||
  process.env.KATARAKTI_SWEEP_BLOCK_THU_FRI?.toLowerCase() === "true";
const ENTRY_DAY_TZ = process.env.KATARAKTI_ENTRY_DAY_TZ ?? "America/New_York";
const LOCK_STYLE: LockStyle =
  process.env.KATARAKTI_LOCK_STYLE === "atr"
    ? "atr"
    : "fixed_pct";
const EXIT_MODE: ExitMode =
  process.env.KATARAKTI_EXIT_MODE === "stepped_no_hard_sl"
    ? "stepped_no_hard_sl"
    : "stepped_with_hard_sl";
const PAIR_FILTER_RAW = (process.env.KATARAKTI_PAIR_FILTER ?? "").trim();
const REPORT_TAG = (process.env.KATARAKTI_REPORT_TAG ?? "").trim();
const INCLUDE_NEUTRAL_BOTH_WAYS =
  process.env.KATARAKTI_INCLUDE_BOTH_WAYS === "1" ||
  process.env.KATARAKTI_INCLUDE_BOTH_WAYS?.toLowerCase() === "true";
const PHASE1_BASELINE_VARIANT_ID = "universal_v1__skip__sweep010";
const TEST_PLAN: TestPlan = process.env.KATARAKTI_TEST_PLAN === "phase2" ? "phase2" : "phase1";
const CORRELATION_LOOKBACK_HOURS = Number(process.env.KATARAKTI_CORR_LOOKBACK_HOURS ?? "672");
const PHASE2_REQUIRE_ATR =
  process.env.KATARAKTI_PHASE2_REQUIRE_ATR === undefined
    ? true
    : process.env.KATARAKTI_PHASE2_REQUIRE_ATR === "1" ||
      process.env.KATARAKTI_PHASE2_REQUIRE_ATR?.toLowerCase() === "true";
const PHASE2_REQUIRE_NO_HARD_SL =
  process.env.KATARAKTI_PHASE2_REQUIRE_NO_HARD_SL === undefined
    ? true
    : process.env.KATARAKTI_PHASE2_REQUIRE_NO_HARD_SL === "1" ||
      process.env.KATARAKTI_PHASE2_REQUIRE_NO_HARD_SL?.toLowerCase() === "true";

const RISK_PER_TRADE_PCT = 1;
const MAX_CONCURRENT_POSITIONS = 8;
const MAX_PORTFOLIO_RISK_PCT = 8;
const DISPLACEMENT_BODY_MIN_PCT = 0.05;
const CLOSE_ZONE_PCT = 0.30;

const HARD_STOP_PCT = 1.0;
const BREAKEVEN_TRIGGER_PCT = 0.25;
const LOCK_015_TRIGGER_PCT = 0.50;
const LOCK_035_TRIGGER_PCT = 0.75;
const LOCK_055_TRIGGER_PCT = 1.00;
const TRAIL_ACTIVE_ABOVE_PCT = 1.00;
const TRAIL_OFFSET_PCT = 0.45;
const ATR_PERIOD = Number(process.env.KATARAKTI_ATR_PERIOD ?? "14");
const ATR_BREAKEVEN_TRIGGER_X = Number(process.env.KATARAKTI_ATR_BREAKEVEN_TRIGGER_X ?? "1.0");
const ATR_LOCK1_TRIGGER_X = Number(process.env.KATARAKTI_ATR_LOCK1_TRIGGER_X ?? "2.0");
const ATR_LOCK1_LOCK_X = Number(process.env.KATARAKTI_ATR_LOCK1_LOCK_X ?? "0.8");
const ATR_LOCK2_TRIGGER_X = Number(process.env.KATARAKTI_ATR_LOCK2_TRIGGER_X ?? "3.0");
const ATR_LOCK2_LOCK_X = Number(process.env.KATARAKTI_ATR_LOCK2_LOCK_X ?? "1.8");
const ATR_TRAIL_ACTIVATE_X = Number(process.env.KATARAKTI_ATR_TRAIL_ACTIVATE_X ?? "3.0");
const ATR_TRAIL_OFFSET_X = Number(process.env.KATARAKTI_ATR_TRAIL_OFFSET_X ?? "1.5");
const TIERED_MIN_TIER: 1 | 2 = 1;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

const FX_MAJORS = new Set([
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
]);

const EXIT_STEP_KEYS: StopStep[] = [
  "hard_sl",
  "breakeven",
  "lock_015",
  "lock_035",
  "lock_055",
  "trailing",
  "week_close",
];

function loadDotEnv() {
  const cwd = process.cwd();
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
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

function getLastCompletedWeekOpens(count: number) {
  const currentWeekOpen = DateTime.fromISO(getCanonicalWeekOpenUtc(), { zone: "utc" });
  if (!currentWeekOpen.isValid) {
    throw new Error("Failed to resolve canonical week anchor.");
  }
  const out: string[] = [];
  for (let i = count; i >= 1; i -= 1) {
    out.push(currentWeekOpen.minus({ weeks: i }).toUTC().toISO() ?? "");
  }
  return out.filter(Boolean);
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function parsePairFilter(raw: string) {
  if (!raw) return null;
  const items = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
  if (items.length === 0) return null;
  return new Set(items);
}

function pairKey(assetClass: AssetClass, pair: string) {
  return `${assetClass}|${pair}`;
}

function modelPairKey(assetClass: AssetClass, pair: string, model: PerformanceModel) {
  return `${assetClass}|${pair}|${model}`;
}

function parsePairDetails(value: SnapshotRow["pair_details"]) {
  if (!value) return [] as Array<{ pair: string; direction: Direction }>;
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        pair: String(item?.pair ?? "").toUpperCase(),
        direction:
          item?.direction === "LONG" || item?.direction === "SHORT" || item?.direction === "NEUTRAL"
            ? item.direction
            : "NEUTRAL",
      }))
      .filter((item) => item.pair.length > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsePairDetails(parsed as SnapshotRow["pair_details"]);
    } catch {
      return [];
    }
  }
  return [];
}

function getOandaBaseUrl() {
  return process.env.OANDA_ENV === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
}

function getOandaAuthHeaders() {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OANDA_API_KEY is not configured.");
  }
  return { Authorization: `Bearer ${apiKey}` };
}

function oandaSymbol(pair: string, assetClass: AssetClass) {
  if (assetClass === "fx" && pair.length === 6) {
    return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  }
  return pair;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const safeLimit = Math.max(1, limit);
  const out: R[] = [];
  for (let i = 0; i < items.length; i += safeLimit) {
    const chunk = items.slice(i, i + safeLimit);
    const rows = await Promise.all(chunk.map((item) => task(item)));
    out.push(...rows);
  }
  return out;
}

async function fetchOandaOhlcSeries(
  symbol: string,
  fromUtc: DateTime,
  toUtc: DateTime,
): Promise<OhlcCandle[]> {
  const instrument = getOandaInstrument(symbol);
  const stepMs = HOUR_MS;
  const maxBarsPerRequest = 4000;
  const all = new Map<number, OhlcCandle>();

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

    let response: Response | null = null;
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await fetch(url.toString(), { headers: getOandaAuthHeaders() });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`OANDA ${instrument} [${response.status}] ${body}`);
        }
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
        }
      }
    }
    if (!response || lastError) {
      throw lastError ?? new Error(`Failed to fetch OANDA candles for ${instrument}`);
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

function computeMaxDrawdownPct(equityCurve: number[]) {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDd = 0;
  for (const value of equityCurve) {
    if (value > peak) peak = value;
    if (peak > 0) {
      const ddPct = ((peak - value) / peak) * 100;
      if (ddPct > maxDd) maxDd = ddPct;
    }
  }
  return maxDd;
}

function calcAtr(candles: OhlcCandle[], period: number, upToIndex: number) {
  if (!(period > 0) || upToIndex <= 0) return 0;
  const start = Math.max(1, upToIndex - period + 1);
  const tr: number[] = [];
  for (let i = start; i <= upToIndex; i += 1) {
    const current = candles[i];
    const prev = candles[i - 1];
    if (!current || !prev) continue;
    tr.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close),
      ),
    );
  }
  if (tr.length === 0) return 0;
  return tr.reduce((sum, v) => sum + v, 0) / tr.length;
}

function closeInsideRange(candle: OhlcCandle, rangeLow: number, rangeHigh: number) {
  return candle.close >= rangeLow && candle.close <= rangeHigh;
}

function displacementValid(candle: OhlcCandle, side: SweepSide) {
  const body = Math.abs(candle.close - candle.open);
  const bodyPct = candle.open > 0 ? (body / candle.open) * 100 : 0;
  if (bodyPct <= DISPLACEMENT_BODY_MIN_PCT) return false;

  const fullRange = candle.high - candle.low;
  if (!(fullRange > 0)) return false;

  if (side === "HIGH") {
    if (!(candle.open > candle.close)) return false;
    const closeFromLowPct = (candle.close - candle.low) / fullRange;
    return closeFromLowPct <= CLOSE_ZONE_PCT;
  }

  if (!(candle.close > candle.open)) return false;
  const closeFromHighPct = (candle.high - candle.close) / fullRange;
  return closeFromHighPct <= CLOSE_ZONE_PCT;
}

function checkSweep(
  candle: OhlcCandle,
  side: SweepSide,
  rangeLow: number,
  rangeHigh: number,
  sweepThresholdPct: number,
) {
  if (side === "HIGH") {
    if (!(rangeHigh > 0)) return false;
    const breachPct = ((candle.high - rangeHigh) / rangeHigh) * 100;
    return breachPct >= sweepThresholdPct;
  }
  if (!(rangeLow > 0)) return false;
  const breachPct = ((rangeLow - candle.low) / rangeLow) * 100;
  return breachPct >= sweepThresholdPct;
}

function detectSignalsInWindow(params: {
  candles: OhlcCandle[];
  rangeLow: number;
  rangeHigh: number;
  sweepThresholdPct: number;
  entryIndices: number[];
  sessionName: "asia_ref" | "ny_ref";
  allowedDirections: Set<SignalDirection>;
}): SignalCandidate[] {
  const { candles, rangeLow, rangeHigh, sweepThresholdPct, entryIndices, sessionName, allowedDirections } = params;
  if (entryIndices.length === 0) return [];
  const entryIndexSet = new Set(entryIndices);
  const seen = new Set<string>();
  const out: SignalCandidate[] = [];

  const pushSignal = (entryIdx: number, direction: SignalDirection, side: SweepSide) => {
    const candle = candles[entryIdx]!;
    const key = `${entryIdx}|${direction}|${side}|${sessionName}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      assetClass: "fx",
      pair: "",
      entrySource: "sweep",
      direction,
      sweepSide: side,
      sessionName,
      entryCandleIndex: entryIdx,
      entryCandleTs: candle.ts,
      entryTimeMs: candle.ts + HOUR_MS,
      entryPrice: candle.close,
    });
  };

  for (const idx of entryIndices) {
    const sweepCandle = candles[idx]!;
    for (const side of ["HIGH", "LOW"] as const) {
      if (!checkSweep(sweepCandle, side, rangeLow, rangeHigh, sweepThresholdPct)) continue;
      const direction: SignalDirection = side === "HIGH" ? "SHORT" : "LONG";
      if (!allowedDirections.has(direction)) continue;

      // 1-bar signal: sweep + rejection + displacement on same candle.
      if (
        closeInsideRange(sweepCandle, rangeLow, rangeHigh) &&
        displacementValid(sweepCandle, side)
      ) {
        pushSignal(idx, direction, side);
        continue;
      }

      // 2-bar signal: sweep on N, rejection+displacement on N+1 only.
      const nextIdx = idx + 1;
      if (!entryIndexSet.has(nextIdx)) continue;
      const reject = candles[nextIdx]!;
      if (
        closeInsideRange(reject, rangeLow, rangeHigh) &&
        displacementValid(reject, side)
      ) {
        pushSignal(nextIdx, direction, side);
      }
    }
  }
  out.sort((a, b) => {
    if (a.entryTimeMs !== b.entryTimeMs) return a.entryTimeMs - b.entryTimeMs;
    if (a.entryCandleIndex !== b.entryCandleIndex) return a.entryCandleIndex - b.entryCandleIndex;
    return a.direction.localeCompare(b.direction);
  });
  return out;
}

function findIndicesInRange(candles: OhlcCandle[], startMs: number, endMs: number) {
  const out: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const ts = candles[i]!.ts;
    if (ts >= startMs && ts < endMs) out.push(i);
  }
  return out;
}

function buildWeekSessions(weekStartMs: number, weekEndMs: number) {
  const sessions: Array<{
    sessionName: "asia_ref" | "ny_ref";
    rangeStartMs: number;
    rangeEndMs: number;
    entryStartMs: number;
    entryEndMs: number;
  }> = [];

  for (let dayMs = weekStartMs; dayMs < weekEndMs; dayMs += DAY_MS) {
    const asiaRangeStart = dayMs;
    const asiaRangeEnd = dayMs + 8 * HOUR_MS;
    const asiaEntryStart = dayMs + 8 * HOUR_MS;
    const asiaEntryEnd = dayMs + 21 * HOUR_MS;
    const clippedAsiaEntryEnd = Math.min(asiaEntryEnd, weekEndMs);
    if (clippedAsiaEntryEnd > asiaEntryStart) {
      sessions.push({
        sessionName: "asia_ref",
        rangeStartMs: asiaRangeStart,
        rangeEndMs: asiaRangeEnd,
        entryStartMs: asiaEntryStart,
        entryEndMs: clippedAsiaEntryEnd,
      });
    }

    const nyRangeStart = dayMs + 13 * HOUR_MS;
    const nyRangeEnd = dayMs + 21 * HOUR_MS;
    const nyEntryStart = dayMs + DAY_MS;
    const nyEntryEnd = nyEntryStart + 13 * HOUR_MS;
    const clippedNyEntryStart = Math.max(nyEntryStart, weekStartMs);
    const clippedNyEntryEnd = Math.min(nyEntryEnd, weekEndMs);
    if (clippedNyEntryEnd > clippedNyEntryStart) {
      sessions.push({
        sessionName: "ny_ref",
        rangeStartMs: nyRangeStart,
        rangeEndMs: nyRangeEnd,
        entryStartMs: clippedNyEntryStart,
        entryEndMs: clippedNyEntryEnd,
      });
    }
  }

  return sessions.sort((a, b) => a.entryStartMs - b.entryStartMs);
}

function resolveAllowedDirections(bias: BiasDirection, neutralMode: NeutralMode) {
  const allowed = new Set<SignalDirection>();
  if (bias === "LONG") allowed.add("LONG");
  if (bias === "SHORT") allowed.add("SHORT");
  if (bias === "NEUTRAL" && neutralMode === "both_ways") {
    allowed.add("LONG");
    allowed.add("SHORT");
  }
  return allowed;
}

function getCostPct(_assetClass: AssetClass, _pair: string) {
  return 0;
}

function findSignalsForPair(params: {
  assetClass: AssetClass;
  pair: string;
  candles: OhlcCandle[];
  weekOpenUtc: string;
  bias: BiasDirection;
  neutralMode: NeutralMode;
  sweepThresholdPct: number;
}): SignalCandidate[] {
  const { assetClass, pair, candles, weekOpenUtc, bias, neutralMode, sweepThresholdPct } = params;
  if (candles.length === 0) return [];
  if (bias === "EXCLUDED") return [];
  if (bias === "NEUTRAL" && neutralMode === "skip") return [];

  const allowed = resolveAllowedDirections(bias, neutralMode);
  if (allowed.size === 0) return [];

  const weekStartMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const weekEndMs = weekStartMs + 7 * DAY_MS;
  const sessions = buildWeekSessions(weekStartMs, weekEndMs);
  const out: SignalCandidate[] = [];

  for (const session of sessions) {
    const rangeIndices = findIndicesInRange(candles, session.rangeStartMs, session.rangeEndMs);
    if (rangeIndices.length === 0) continue;
    const entryIndices = findIndicesInRange(candles, session.entryStartMs, session.entryEndMs);
    if (entryIndices.length === 0) continue;

    let rangeHigh = Number.NEGATIVE_INFINITY;
    let rangeLow = Number.POSITIVE_INFINITY;
    for (const idx of rangeIndices) {
      const candle = candles[idx]!;
      if (candle.high > rangeHigh) rangeHigh = candle.high;
      if (candle.low < rangeLow) rangeLow = candle.low;
    }
    if (!(rangeHigh > rangeLow)) continue;

    const detected = detectSignalsInWindow({
      candles,
      rangeLow,
      rangeHigh,
      sweepThresholdPct,
      entryIndices,
      sessionName: session.sessionName,
      allowedDirections: allowed,
    });
    for (const signal of detected) {
      out.push({
        ...signal,
        assetClass,
        pair,
      });
    }
  }

  out.sort((a, b) => {
    if (a.entryTimeMs !== b.entryTimeMs) return a.entryTimeMs - b.entryTimeMs;
    if (a.entryCandleIndex !== b.entryCandleIndex) return a.entryCandleIndex - b.entryCandleIndex;
    return a.direction.localeCompare(b.direction);
  });
  return out;
}

function findWeekOpenSignalsForPair(params: {
  assetClass: AssetClass;
  pair: string;
  candles: OhlcCandle[];
  weekOpenUtc: string;
  bias: BiasDirection;
  neutralMode: NeutralMode;
}): SignalCandidate[] {
  const { assetClass, pair, candles, weekOpenUtc, bias, neutralMode } = params;
  if (candles.length === 0) return [];
  if (bias === "EXCLUDED") return [];
  if (bias === "NEUTRAL" && neutralMode === "skip") return [];

  const allowed = resolveAllowedDirections(bias, neutralMode);
  if (allowed.size === 0) return [];

  const weekStartMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const weekEndMs = weekStartMs + 7 * DAY_MS;
  const entryIdx = candles.findIndex((c) => c.ts >= weekStartMs && c.ts < weekEndMs);
  if (entryIdx < 0) return [];
  const entryCandle = candles[entryIdx]!;
  const out: SignalCandidate[] = [];

  for (const direction of allowed) {
    out.push({
      assetClass,
      pair,
      entrySource: "week_open_hold",
      direction,
      sweepSide: direction === "LONG" ? "LOW" : "HIGH",
      sessionName: "asia_ref",
      entryCandleIndex: entryIdx,
      entryCandleTs: entryCandle.ts,
      entryTimeMs: entryCandle.ts,
      entryPrice: entryCandle.open,
    });
  }

  out.sort((a, b) => a.direction.localeCompare(b.direction));
  return out;
}

function findLastCandleBefore(candles: OhlcCandle[], tsExclusive: number) {
  let out: OhlcCandle | null = null;
  for (const candle of candles) {
    if (candle.ts < tsExclusive) out = candle;
    else break;
  }
  return out;
}

function profitPctForPrice(entryPrice: number, price: number, direction: SignalDirection) {
  if (!(entryPrice > 0) || !Number.isFinite(price)) return 0;
  const longPct = ((price - entryPrice) / entryPrice) * 100;
  return direction === "LONG" ? longPct : -longPct;
}

function stopPriceForLockedPct(entryPrice: number, direction: SignalDirection, lockedPct: number) {
  if (direction === "LONG") return entryPrice * (1 + lockedPct / 100);
  return entryPrice * (1 - lockedPct / 100);
}

function lockStateFromPeak(peakProfitPct: number): { lockedPct: number; step: StopStep } {
  if (peakProfitPct > TRAIL_ACTIVE_ABOVE_PCT) {
    return {
      lockedPct: Math.max(0.55, peakProfitPct - TRAIL_OFFSET_PCT),
      step: "trailing",
    };
  }
  if (peakProfitPct >= LOCK_055_TRIGGER_PCT) return { lockedPct: 0.55, step: "lock_055" };
  if (peakProfitPct >= LOCK_035_TRIGGER_PCT) return { lockedPct: 0.35, step: "lock_035" };
  if (peakProfitPct >= LOCK_015_TRIGGER_PCT) return { lockedPct: 0.15, step: "lock_015" };
  if (peakProfitPct >= BREAKEVEN_TRIGGER_PCT) return { lockedPct: 0, step: "breakeven" };
  return { lockedPct: -HARD_STOP_PCT, step: "hard_sl" };
}

function profitMoveAbs(entryPrice: number, price: number, direction: SignalDirection) {
  if (direction === "LONG") return price - entryPrice;
  return entryPrice - price;
}

function stopPriceForLockedMoveAbs(entryPrice: number, direction: SignalDirection, lockedMoveAbs: number) {
  if (direction === "LONG") return entryPrice + lockedMoveAbs;
  return entryPrice - lockedMoveAbs;
}

function atrLockStateFromPeakMove(
  peakMoveAbs: number,
  atr: number,
): { lockedMoveAbs: number; step: StopStep } {
  if (!(atr > 0)) return { lockedMoveAbs: Number.NEGATIVE_INFINITY, step: "breakeven" };

  if (peakMoveAbs > ATR_TRAIL_ACTIVATE_X * atr) {
    return {
      lockedMoveAbs: Math.max(ATR_LOCK2_LOCK_X * atr, peakMoveAbs - ATR_TRAIL_OFFSET_X * atr),
      step: "trailing",
    };
  }
  if (peakMoveAbs >= ATR_LOCK2_TRIGGER_X * atr) {
    return { lockedMoveAbs: ATR_LOCK2_LOCK_X * atr, step: "lock_035" };
  }
  if (peakMoveAbs >= ATR_LOCK1_TRIGGER_X * atr) {
    return { lockedMoveAbs: ATR_LOCK1_LOCK_X * atr, step: "lock_015" };
  }
  if (peakMoveAbs >= ATR_BREAKEVEN_TRIGGER_X * atr) {
    return { lockedMoveAbs: 0, step: "breakeven" };
  }
  return { lockedMoveAbs: Number.NEGATIVE_INFINITY, step: "breakeven" };
}

function simulateExit(params: {
  candles: OhlcCandle[];
  entryIdx: number;
  entryPrice: number;
  direction: SignalDirection;
  weekEndMs: number;
  exitMode: ExitMode;
  lockStyle: LockStyle;
  atrAtEntry: number;
}) {
  const { candles, entryIdx, entryPrice, direction, weekEndMs, exitMode, lockStyle, atrAtEntry } = params;
  const hardStopEnabled = exitMode === "stepped_with_hard_sl";

  if (lockStyle === "atr") {
    const hardStopPrice = hardStopEnabled
      ? direction === "LONG"
        ? entryPrice * (1 - HARD_STOP_PCT / 100)
        : entryPrice * (1 + HARD_STOP_PCT / 100)
      : Number.NaN;

    let lockedMoveAbs = Number.NEGATIVE_INFINITY;
    let stopStep: StopStep = "breakeven";
    let peakProfitPct = 0;
    let peakMoveAbs = 0;

    for (let i = entryIdx + 1; i < candles.length; i += 1) {
      const c = candles[i]!;
      if (c.ts >= weekEndMs) break;

      if (hardStopEnabled && Number.isFinite(hardStopPrice)) {
        if (direction === "LONG" && c.low <= hardStopPrice) {
          return {
            exitPrice: hardStopPrice,
            exitReason: "STOP" as const,
            exitStep: "hard_sl" as const,
            peakProfitPct,
            reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
            reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
            reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
            reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
            exitTimeMs: Math.min(weekEndMs, c.ts + HOUR_MS - 1),
          };
        }
        if (direction === "SHORT" && c.high >= hardStopPrice) {
          return {
            exitPrice: hardStopPrice,
            exitReason: "STOP" as const,
            exitStep: "hard_sl" as const,
            peakProfitPct,
            reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
            reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
            reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
            reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
            exitTimeMs: Math.min(weekEndMs, c.ts + HOUR_MS - 1),
          };
        }
      }

      const favorablePrice = direction === "LONG" ? c.high : c.low;
      const favorablePct = profitPctForPrice(entryPrice, favorablePrice, direction);
      if (favorablePct > peakProfitPct) peakProfitPct = favorablePct;

      const moveAbs = profitMoveAbs(entryPrice, favorablePrice, direction);
      if (moveAbs > peakMoveAbs) peakMoveAbs = moveAbs;

      const atrState = atrLockStateFromPeakMove(peakMoveAbs, atrAtEntry);
      if (atrState.lockedMoveAbs > lockedMoveAbs) {
        lockedMoveAbs = atrState.lockedMoveAbs;
        stopStep = atrState.step;
      }
      if (!Number.isFinite(lockedMoveAbs)) continue;

      const stopPrice = stopPriceForLockedMoveAbs(entryPrice, direction, lockedMoveAbs);
      if (direction === "LONG") {
        if (c.low <= stopPrice) {
          return {
            exitPrice: stopPrice,
            exitReason: "STOP" as const,
            exitStep: stopStep,
            peakProfitPct,
            reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
            reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
            reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
            reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
            exitTimeMs: Math.min(weekEndMs, c.ts + HOUR_MS - 1),
          };
        }
      } else {
        if (c.high >= stopPrice) {
          return {
            exitPrice: stopPrice,
            exitReason: "STOP" as const,
            exitStep: stopStep,
            peakProfitPct,
            reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
            reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
            reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
            reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
            exitTimeMs: Math.min(weekEndMs, c.ts + HOUR_MS - 1),
          };
        }
      }
    }

    const last = findLastCandleBefore(candles, weekEndMs);
    if (!last) {
      return {
        exitPrice: entryPrice,
        exitReason: "WEEK_CLOSE" as const,
        exitStep: "week_close" as const,
        peakProfitPct,
        reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
        reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
        reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
        reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
        exitTimeMs: weekEndMs,
      };
    }
    return {
      exitPrice: last.close,
      exitReason: "WEEK_CLOSE" as const,
      exitStep: "week_close" as const,
      peakProfitPct,
      reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
      reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
      reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
      reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
      exitTimeMs: Math.min(weekEndMs, last.ts + HOUR_MS),
    };
  }

  let lockedPct = hardStopEnabled ? -HARD_STOP_PCT : Number.NEGATIVE_INFINITY;
  let stopStep: StopStep = hardStopEnabled ? "hard_sl" : "breakeven";
  let peakProfitPct = 0;

  for (let i = entryIdx + 1; i < candles.length; i += 1) {
    const c = candles[i]!;
    if (c.ts >= weekEndMs) break;

    const favorablePrice = direction === "LONG" ? c.high : c.low;
    const favorablePct = profitPctForPrice(entryPrice, favorablePrice, direction);
    if (favorablePct > peakProfitPct) peakProfitPct = favorablePct;

    const lockState = lockStateFromPeak(peakProfitPct);
    const canActivateProfitLock = hardStopEnabled || lockState.step !== "hard_sl";
    if (canActivateProfitLock && lockState.lockedPct > lockedPct) {
      lockedPct = lockState.lockedPct;
      stopStep = lockState.step;
    }
    if (!Number.isFinite(lockedPct)) continue;
    const stopPrice = stopPriceForLockedPct(entryPrice, direction, lockedPct);

    if (direction === "LONG") {
      if (c.low <= stopPrice) {
        return {
          exitPrice: stopPrice,
          exitReason: "STOP" as const,
          exitStep: stopStep,
          peakProfitPct,
          reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
          reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
          reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
          reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
          exitTimeMs: Math.min(weekEndMs, c.ts + HOUR_MS - 1),
        };
      }
    } else {
      if (c.high >= stopPrice) {
        return {
          exitPrice: stopPrice,
          exitReason: "STOP" as const,
          exitStep: stopStep,
          peakProfitPct,
          reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
          reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
          reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
          reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
          exitTimeMs: Math.min(weekEndMs, c.ts + HOUR_MS - 1),
        };
      }
    }
  }

  const last = findLastCandleBefore(candles, weekEndMs);
  if (!last) {
    return {
      exitPrice: entryPrice,
      exitReason: "WEEK_CLOSE" as const,
      exitStep: "week_close" as const,
      peakProfitPct,
      reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
      reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
      reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
      reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
      exitTimeMs: weekEndMs,
    };
  }
  return {
    exitPrice: last.close,
    exitReason: "WEEK_CLOSE" as const,
    exitStep: "week_close" as const,
    peakProfitPct,
    reached025: peakProfitPct >= BREAKEVEN_TRIGGER_PCT,
    reached050: peakProfitPct >= LOCK_015_TRIGGER_PCT,
    reached075: peakProfitPct >= LOCK_035_TRIGGER_PCT,
    reached100: peakProfitPct >= LOCK_055_TRIGGER_PCT,
    exitTimeMs: Math.min(weekEndMs, last.ts + HOUR_MS),
  };
}

function classifyUniversalV1(votes: Direction[]): BiasDirection {
  const longVotes = votes.filter((v) => v === "LONG").length;
  const shortVotes = votes.filter((v) => v === "SHORT").length;
  const directionalVotes = longVotes + shortVotes;
  if (directionalVotes === 0) return "EXCLUDED";
  if (longVotes >= 3) return "LONG";
  if (shortVotes >= 3) return "SHORT";
  return "NEUTRAL";
}

function classifyTieredV1(votes: Direction[]): { direction: BiasDirection; tier: 1 | 2 | null } {
  const longVotes = votes.filter((v) => v === "LONG").length;
  const shortVotes = votes.filter((v) => v === "SHORT").length;
  const directionalVotes = longVotes + shortVotes;
  if (directionalVotes === 0) return { direction: "EXCLUDED", tier: null };

  const maxVotes = Math.max(longVotes, shortVotes);
  const direction: BiasDirection =
    longVotes > shortVotes ? "LONG" : shortVotes > longVotes ? "SHORT" : "NEUTRAL";
  if (direction !== "LONG" && direction !== "SHORT") {
    return { direction: "NEUTRAL", tier: null };
  }
  if (maxVotes >= 4) return { direction, tier: 1 };
  if (maxVotes === 3) return { direction, tier: 2 };
  return { direction: "NEUTRAL", tier: null };
}

function growthFromWeeklyReturns(returnsPct: number[]) {
  return returnsPct.reduce((acc, ret) => acc * (1 + ret / 100), 1);
}

function computeWinRate(wins: number, trades: number) {
  return trades > 0 ? (wins / trades) * 100 : 0;
}

async function loadBiasMapsByWeek(
  weeks: readonly string[],
  pairUniverse: PairInfo[],
): Promise<Map<string, WeekBiasMaps>> {
  const rows = await query<SnapshotRow>(
    `SELECT week_open_utc, asset_class, model, pair_details
     FROM performance_snapshots
     WHERE week_open_utc = ANY($1::timestamptz[])
       AND model = ANY($2::text[])`,
    [weeks, PERFORMANCE_V1_MODELS],
  );

  const byWeek = new Map<string, Map<string, Direction>>();
  for (const week of weeks) byWeek.set(week, new Map<string, Direction>());

  for (const row of rows) {
    const weekOpenUtc = row.week_open_utc.toISOString();
    const bucket = byWeek.get(weekOpenUtc);
    if (!bucket) continue;
    const details = parsePairDetails(row.pair_details);
    for (const detail of details) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      bucket.set(modelPairKey(row.asset_class, detail.pair, row.model), detail.direction);
    }
  }

  const out = new Map<string, WeekBiasMaps>();
  for (const week of weeks) {
    const modelMap = byWeek.get(week) ?? new Map<string, Direction>();
    const universal = new Map<string, BiasDirection>();
    const tieredDirection = new Map<string, BiasDirection>();
    const tieredTier = new Map<string, 1 | 2 | null>();

    for (const pairInfo of pairUniverse) {
      const votes = PERFORMANCE_V1_MODELS.map(
        (model) =>
          modelMap.get(modelPairKey(pairInfo.assetClass, pairInfo.pair, model)) ?? "NEUTRAL",
      );
      universal.set(
        pairKey(pairInfo.assetClass, pairInfo.pair),
        classifyUniversalV1(votes),
      );
      const tiered = classifyTieredV1(votes);
      tieredDirection.set(pairKey(pairInfo.assetClass, pairInfo.pair), tiered.direction);
      tieredTier.set(pairKey(pairInfo.assetClass, pairInfo.pair), tiered.tier);
    }

    out.set(week, { universal, tieredDirection, tieredTier });
  }

  return out;
}

async function loadCandleSeriesForUniverse(params: {
  pairUniverse: PairInfo[];
  fetchFromUtc: DateTime;
  fetchToUtc: DateTime;
}) {
  const { pairUniverse, fetchFromUtc, fetchToUtc } = params;
  const missingPairs: string[] = [];

  const rows = await runWithConcurrency(
    pairUniverse,
    FETCH_CONCURRENCY,
    async (item) => {
      try {
        const symbol = oandaSymbol(item.pair, item.assetClass);
        const candles = await fetchOandaOhlcSeries(symbol, fetchFromUtc, fetchToUtc);
        return { key: pairKey(item.assetClass, item.pair), candles };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        missingPairs.push(`${item.assetClass}:${item.pair} (${message})`);
        return { key: pairKey(item.assetClass, item.pair), candles: [] as OhlcCandle[] };
      }
    },
  );

  const map = new Map<string, OhlcCandle[]>();
  for (const row of rows) map.set(row.key, row.candles);

  return { map, missingPairs };
}

function buildPairUniverse(pairFilter: Set<string> | null) {
  const out: PairInfo[] = [];
  (Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, Array<{ pair: string }>]>).forEach(
    ([assetClass, defs]) => {
      for (const def of defs) {
        if (pairFilter && !pairFilter.has(def.pair.toUpperCase())) continue;
        out.push({ assetClass, pair: def.pair });
      }
    },
  );
  return out.sort((a, b) => pairKey(a.assetClass, a.pair).localeCompare(pairKey(b.assetClass, b.pair)));
}

function systemDirectionMap(weekBias: WeekBiasMaps, system: BiasSystem) {
  return system === "universal_v1" ? weekBias.universal : weekBias.tieredDirection;
}

function resolveBias(map: Map<string, BiasDirection>, assetClass: AssetClass, pair: string) {
  return map.get(pairKey(assetClass, pair)) ?? "EXCLUDED";
}

function weeklyLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy-LL-dd");
}

function buildCandidateForPair(params: {
  entryMode: EntryMode;
  assetClass: AssetClass;
  pair: string;
  candles: OhlcCandle[];
  weekOpenUtc: string;
  bias: BiasDirection;
  neutralMode: NeutralMode;
  sweepThresholdPct: number;
}): SignalCandidate[] {
  const { entryMode } = params;
  if (entryMode === "week_open_hold") {
    return findWeekOpenSignalsForPair(params);
  }
  return findSignalsForPair(params);
}

function calculateEntryEquity(startEquity: number, accepted: AcceptedTrade[], entryTimeMs: number) {
  let equity = startEquity;
  for (const trade of accepted) {
    if (trade.exitTimeMs <= entryTimeMs) equity += trade.netPnlUsd;
  }
  return equity;
}

function openPositionsAt(accepted: AcceptedTrade[], entryTimeMs: number) {
  let open = 0;
  for (const trade of accepted) {
    if (trade.entryTimeMs < entryTimeMs && trade.exitTimeMs > entryTimeMs) open += 1;
  }
  return open;
}

function openRiskPctAt(accepted: AcceptedTrade[], entryTimeMs: number) {
  let openRisk = 0;
  for (const trade of accepted) {
    if (trade.entryTimeMs < entryTimeMs && trade.exitTimeMs > entryTimeMs) {
      openRisk += trade.riskPct;
    }
  }
  return openRisk;
}

function pairHasOpenPositionAt(
  accepted: AcceptedTrade[],
  assetClass: AssetClass,
  pair: string,
  entryTimeMs: number,
) {
  for (const trade of accepted) {
    if (trade.assetClass !== assetClass || trade.pair !== pair) continue;
    if (trade.entryTimeMs <= entryTimeMs && trade.exitTimeMs > entryTimeMs) return true;
  }
  return false;
}

function isBlockedSweepEntry(entryTimeMs: number) {
  if (!BLOCK_SWEEP_THU_FRI) return false;
  const weekday = DateTime.fromMillis(entryTimeMs, { zone: ENTRY_DAY_TZ }).weekday;
  return weekday === 4 || weekday === 5;
}

function sessionBucketKey(candidate: SignalCandidate) {
  const dt = DateTime.fromMillis(candidate.entryTimeMs, { zone: "utc" });
  if (candidate.entrySource === "week_open_hold") {
    return `week_open|${dt.toISODate() ?? "unknown"}`;
  }
  if (candidate.sessionName === "asia_ref") {
    return `asia_ref|${dt.toISODate() ?? "unknown"}`;
  }
  return `ny_ref|${dt.minus({ days: 1 }).toISODate() ?? "unknown"}`;
}

function computeLogReturnSeries(candles: OhlcCandle[], startMs: number, endMs: number) {
  const filtered = candles.filter((c) => c.ts >= startMs && c.ts < endMs);
  if (filtered.length < 2) return new Map<number, number>();
  const out = new Map<number, number>();
  for (let i = 1; i < filtered.length; i += 1) {
    const prev = filtered[i - 1]!;
    const curr = filtered[i]!;
    if (!(prev.close > 0) || !(curr.close > 0)) continue;
    const ret = Math.log(curr.close / prev.close);
    if (Number.isFinite(ret)) out.set(curr.ts, ret);
  }
  return out;
}

function pearsonFromReturnMaps(a: Map<number, number>, b: Map<number, number>) {
  const xs: number[] = [];
  const ys: number[] = [];
  const [small, large, smallIsA] =
    a.size <= b.size ? [a, b, true] as const : [b, a, false] as const;
  for (const [ts, vSmall] of small) {
    const vLarge = large.get(ts);
    if (vLarge === undefined) continue;
    if (smallIsA) {
      xs.push(vSmall);
      ys.push(vLarge);
    } else {
      xs.push(vLarge);
      ys.push(vSmall);
    }
  }
  const n = xs.length;
  if (n < 24) return { correlation: null as number | null, sampleSize: n };

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i += 1) {
    const x = xs[i]!;
    const y = ys[i]!;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    sumXY += x * y;
  }
  const num = n * sumXY - sumX * sumY;
  const denLeft = n * sumXX - sumX * sumX;
  const denRight = n * sumYY - sumY * sumY;
  const den = Math.sqrt(Math.max(0, denLeft) * Math.max(0, denRight));
  if (!(den > 0)) return { correlation: null as number | null, sampleSize: n };
  const corr = num / den;
  if (!Number.isFinite(corr)) return { correlation: null as number | null, sampleSize: n };
  return { correlation: Math.max(-1, Math.min(1, corr)), sampleSize: n };
}

function buildWeekCorrelationData(params: {
  weekOpenUtc: string;
  lookbackHours: number;
  pairUniverse: PairInfo[];
  candlesByPair: Map<string, OhlcCandle[]>;
}) {
  const { weekOpenUtc, lookbackHours, pairUniverse, candlesByPair } = params;
  const weekStartMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const startMs = weekStartMs - lookbackHours * HOUR_MS;
  const endMs = weekStartMs;

  const returnByPair = new Map<string, Map<number, number>>();
  for (const pairInfo of pairUniverse) {
    const pKey = pairKey(pairInfo.assetClass, pairInfo.pair);
    const candles = candlesByPair.get(pKey) ?? [];
    returnByPair.set(pKey, computeLogReturnSeries(candles, startMs, endMs));
  }

  const adjacency = new Map<string, CorrelationEdge[]>();
  const matrix_rows: WeekCorrelationData["matrix_rows"] = [];
  const keys = pairUniverse.map((p) => pairKey(p.assetClass, p.pair));
  for (const key of keys) adjacency.set(key, []);

  for (let i = 0; i < keys.length; i += 1) {
    const a = keys[i]!;
    const ra = returnByPair.get(a) ?? new Map<number, number>();
    for (let j = i + 1; j < keys.length; j += 1) {
      const b = keys[j]!;
      const rb = returnByPair.get(b) ?? new Map<number, number>();
      const corr = pearsonFromReturnMaps(ra, rb);
      if (corr.correlation === null) continue;
      matrix_rows.push({
        pair_a: a,
        pair_b: b,
        correlation: corr.correlation,
        sample_size: corr.sampleSize,
      });
      adjacency.get(a)!.push({ pairKey: b, correlation: corr.correlation });
      adjacency.get(b)!.push({ pairKey: a, correlation: corr.correlation });
    }
  }

  return {
    week_open_utc: weekOpenUtc,
    lookback_hours: lookbackHours,
    matrix_rows,
    adjacency,
  } satisfies WeekCorrelationData;
}

function simulateWeekForVariant(params: {
  weekOpenUtc: string;
  biasSystem: BiasSystem;
  neutralMode: NeutralMode;
  entryMode: EntryMode;
  sweepThresholdPct: number;
  exitMode: ExitMode;
  startEquityUsd: number;
  pairUniverse: PairInfo[];
  weekBiasMaps: WeekBiasMaps;
  candlesByPair: Map<string, OhlcCandle[]>;
  tieredMaxTier: 1 | 2;
  tierRiskModel: TierRiskModel;
  handshakeConfig: HandshakeConfig;
  weekCorrelation: WeekCorrelationData | null;
}) {
  const {
    weekOpenUtc,
    biasSystem,
    neutralMode,
    entryMode,
    sweepThresholdPct,
    exitMode,
    startEquityUsd,
    pairUniverse,
    weekBiasMaps,
    candlesByPair,
    tieredMaxTier,
    tierRiskModel,
    handshakeConfig,
    weekCorrelation,
  } = params;
  const weekStartMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const weekEndMs = weekStartMs + 7 * DAY_MS;

  const directionMap = systemDirectionMap(weekBiasMaps, biasSystem);
  const candidates: Array<
    SignalCandidate & {
      bias: BiasDirection;
      tier: 1 | 2 | null;
      pairK: string;
      sessionBucket: string;
      handshakePass: boolean;
      handshakeClusterSize: number;
    }
  > = [];

  for (const pairInfo of pairUniverse) {
    const pairK = pairKey(pairInfo.assetClass, pairInfo.pair);
    const candles = candlesByPair.get(pairK) ?? [];
    if (candles.length === 0) continue;

    const tier = weekBiasMaps.tieredTier.get(pairK) ?? null;
    let bias = resolveBias(directionMap, pairInfo.assetClass, pairInfo.pair);
    if (biasSystem === "tiered_v1") {
      if (tier === null || tier > tieredMaxTier) bias = "EXCLUDED";
    }
    const pairCandidates = buildCandidateForPair({
      entryMode,
      assetClass: pairInfo.assetClass,
      pair: pairInfo.pair,
      candles,
      weekOpenUtc,
      bias,
      neutralMode,
      sweepThresholdPct,
    });
    for (const candidate of pairCandidates) {
      candidates.push({
        ...candidate,
        bias,
        tier,
        pairK,
        sessionBucket: sessionBucketKey(candidate),
        handshakePass: true,
        handshakeClusterSize: 1,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.entryTimeMs !== b.entryTimeMs) return a.entryTimeMs - b.entryTimeMs;
    return pairKey(a.assetClass, a.pair).localeCompare(pairKey(b.assetClass, b.pair));
  });

  const handshakeStats: HandshakeDiagnostics = {
    total_signals: 0,
    clustered_signals: 0,
    clustered_passed_signals: 0,
    standalone_signals: 0,
    passed_signals: 0,
    gated_out_signals: 0,
    trigger_rate_pct: 0,
    avg_cluster_size_triggered: 0,
  };
  if (handshakeConfig.enabled && entryMode === "sweep") {
    const bucketToIndexes = new Map<string, number[]>();
    for (let i = 0; i < candidates.length; i += 1) {
      const key = candidates[i]!.sessionBucket;
      const arr = bucketToIndexes.get(key) ?? [];
      arr.push(i);
      bucketToIndexes.set(key, arr);
    }

    let triggeredClusterCount = 0;
    let triggeredClusterSizeSum = 0;
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i]!;
      handshakeStats.total_signals += 1;
      const edges = weekCorrelation?.adjacency.get(candidate.pairK) ?? [];
      const filteredEdges = edges.filter((edge) => {
        if (Math.abs(edge.correlation) < handshakeConfig.corrThresholdAbs) return false;
        if (!handshakeConfig.includeAntiCorrelation && edge.correlation < 0) return false;
        return true;
      });
      if (filteredEdges.length === 0) {
        handshakeStats.standalone_signals += 1;
        handshakeStats.passed_signals += 1;
        continue;
      }

      handshakeStats.clustered_signals += 1;
      const corrByPair = new Map<string, number>();
      for (const edge of filteredEdges) corrByPair.set(edge.pairKey, edge.correlation);

      const bucketIndexes = bucketToIndexes.get(candidate.sessionBucket) ?? [];
      const confirmingPairs = new Set<string>();
      for (const otherIdx of bucketIndexes) {
        if (otherIdx === i) continue;
        const other = candidates[otherIdx]!;
        const corr = corrByPair.get(other.pairK);
        if (corr === undefined) continue;

        const sameDirection = other.direction === candidate.direction;
        if (corr >= 0 && sameDirection) confirmingPairs.add(other.pairK);
        if (corr < 0 && handshakeConfig.includeAntiCorrelation && !sameDirection) {
          confirmingPairs.add(other.pairK);
        }
      }

      const confirmations = 1 + confirmingPairs.size;
      if (confirmations >= handshakeConfig.minConfirmations) {
        candidate.handshakePass = true;
        candidate.handshakeClusterSize = confirmations;
        handshakeStats.clustered_passed_signals += 1;
        handshakeStats.passed_signals += 1;
        triggeredClusterCount += 1;
        triggeredClusterSizeSum += confirmations;
      } else {
        candidate.handshakePass = false;
        handshakeStats.gated_out_signals += 1;
      }
    }
    handshakeStats.trigger_rate_pct = handshakeStats.total_signals > 0
      ? (handshakeStats.clustered_signals > 0
        ? (handshakeStats.clustered_passed_signals / handshakeStats.clustered_signals) * 100
        : 0)
      : 0;
    handshakeStats.avg_cluster_size_triggered = triggeredClusterCount > 0
      ? triggeredClusterSizeSum / triggeredClusterCount
      : 0;
  }

  const accepted: AcceptedTrade[] = [];
  const entriesPerPair = new Map<string, number>();

  for (const candidate of candidates) {
    if (handshakeConfig.enabled && entryMode === "sweep" && !candidate.handshakePass) continue;
    if (entryMode === "sweep" && isBlockedSweepEntry(candidate.entryTimeMs)) continue;

    const perPairKey = pairKey(candidate.assetClass, candidate.pair);
    const usedEntries = entriesPerPair.get(perPairKey) ?? 0;
    if (usedEntries >= MAX_ENTRIES_PER_PAIR_PER_WEEK) continue;
    if (pairHasOpenPositionAt(accepted, candidate.assetClass, candidate.pair, candidate.entryTimeMs)) continue;

    const openNow = openPositionsAt(accepted, candidate.entryTimeMs);
    if (openNow >= MAX_CONCURRENT_POSITIONS) continue;
    const candidateRiskPct =
      biasSystem === "tiered_v1" && tierRiskModel === "weighted"
        ? candidate.tier === 1
          ? 1.5
          : candidate.tier === 2
            ? 0.75
            : RISK_PER_TRADE_PCT
        : RISK_PER_TRADE_PCT;
    const openRiskPct = openRiskPctAt(accepted, candidate.entryTimeMs);
    if (openRiskPct + candidateRiskPct > MAX_PORTFOLIO_RISK_PCT) continue;

    const candles = candlesByPair.get(perPairKey) ?? [];
    const entryIdx = candles.findIndex((c) => c.ts === candidate.entryCandleTs);
    if (entryIdx < 0) continue;
    if (candidate.entryTimeMs >= weekEndMs) continue;

    const stopDistance = candidate.entryPrice * (HARD_STOP_PCT / 100);
    if (!(stopDistance > 0)) continue;
    const atrAtEntry = calcAtr(candles, ATR_PERIOD, entryIdx);

    const initialStop =
      candidate.direction === "LONG"
        ? candidate.entryPrice - stopDistance
        : candidate.entryPrice + stopDistance;

    const exit = simulateExit({
      candles,
      entryIdx,
      entryPrice: candidate.entryPrice,
      direction: candidate.direction,
      weekEndMs,
      exitMode,
      lockStyle: LOCK_STYLE,
      atrAtEntry,
    });

    const entryEquity = calculateEntryEquity(startEquityUsd, accepted, candidate.entryTimeMs);
    if (!(entryEquity > 0)) continue;

    const riskUsd = entryEquity * (candidateRiskPct / 100);
    const units = riskUsd / stopDistance;
    const directionMultiplier = candidate.direction === "LONG" ? 1 : -1;
    const grossPnlUsd = directionMultiplier * (exit.exitPrice - candidate.entryPrice) * units;
    const notionalUsd = Math.abs(units * candidate.entryPrice);
    const costPct = getCostPct(candidate.assetClass, candidate.pair);
    const costUsd = notionalUsd * (costPct / 100);
    const netPnlUsd = grossPnlUsd - costUsd;
    const rMultipleGross = riskUsd > 0 ? grossPnlUsd / riskUsd : 0;
    const rMultipleNet = riskUsd > 0 ? netPnlUsd / riskUsd : 0;
    const durationHours = Math.max(0, (exit.exitTimeMs - candidate.entryTimeMs) / HOUR_MS);
    const returnPctOnEntryEquity = entryEquity > 0 ? (netPnlUsd / entryEquity) * 100 : 0;

    accepted.push({
      weekOpenUtc,
      biasSystem,
      neutralMode,
      assetClass: candidate.assetClass,
      pair: candidate.pair,
      entrySource: candidate.entrySource,
      biasDirection: candidate.bias,
      direction: candidate.direction,
      sweepSide: candidate.sweepSide,
      sessionName: candidate.sessionName,
      entryTimeUtc: new Date(candidate.entryTimeMs).toISOString(),
      exitTimeUtc: new Date(exit.exitTimeMs).toISOString(),
      entryPrice: candidate.entryPrice,
      exitPrice: exit.exitPrice,
      stopPrice: initialStop,
      stopDistance,
      riskPct: candidateRiskPct,
      riskUsd,
      notionalUsd,
      grossPnlUsd,
      costUsd,
      netPnlUsd,
      returnPctOnEntryEquity,
      rMultipleGross,
      rMultipleNet,
      exitReason: exit.exitReason,
      exitStep: exit.exitStep,
      peakProfitPct: exit.peakProfitPct,
      reached025: exit.reached025,
      reached050: exit.reached050,
      reached075: exit.reached075,
      reached100: exit.reached100,
      durationHours,
      entryTimeMs: candidate.entryTimeMs,
      exitTimeMs: exit.exitTimeMs,
    });

    entriesPerPair.set(perPairKey, usedEntries + 1);
  }

  accepted.sort((a, b) => a.exitTimeMs - b.exitTimeMs);
  const endEquity = accepted.reduce((eq, trade) => eq + trade.netPnlUsd, startEquityUsd);
  const wins = accepted.filter((trade) => trade.netPnlUsd > 0).length;
  const losses = accepted.filter((trade) => trade.netPnlUsd < 0).length;
  const avgDur = accepted.length > 0
    ? accepted.reduce((sum, trade) => sum + trade.durationHours, 0) / accepted.length
    : 0;
  const avgTradeRet = accepted.length > 0
    ? accepted.reduce((sum, trade) => sum + trade.returnPctOnEntryEquity, 0) / accepted.length
    : 0;

  const summary: WeekVariantSummary = {
    week_open_utc: weekOpenUtc,
    week_label: weeklyLabel(weekOpenUtc),
    starting_equity_usd: startEquityUsd,
    ending_equity_usd: endEquity,
    week_return_pct: startEquityUsd > 0 ? ((endEquity - startEquityUsd) / startEquityUsd) * 100 : 0,
    trades: accepted.length,
    wins,
    losses,
    win_rate_pct: computeWinRate(wins, accepted.length),
    avg_trade_return_pct: avgTradeRet,
    avg_trade_duration_hours: avgDur,
  };

  return {
    trades: accepted,
    summary,
    endEquity,
    handshakeDiagnostics: handshakeConfig.enabled && entryMode === "sweep" ? handshakeStats : null,
  };
}

function buildBaselineFromMarketSnapshots(params: {
  weeks: readonly string[];
  pairUniverse: PairInfo[];
  biasByWeek: Map<string, WeekBiasMaps>;
  system: BiasSystem;
}) {
  const { weeks, pairUniverse, biasByWeek, system } = params;
  const weekly: BaselineSummary["weekly"] = [];

  return (async () => {
    for (const week of weeks) {
      const weekBias = biasByWeek.get(week);
      if (!weekBias) {
        weekly.push({
          week_open_utc: week,
          week_label: weeklyLabel(week),
          return_pct: 0,
          trades: 0,
          wins: 0,
          win_rate_pct: 0,
        });
        continue;
      }

      const byAsset = new Map<AssetClass, Map<string, number>>();
      for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
        const snap = await readMarketSnapshot(week, assetClass);
        const map = new Map<string, number>();
        for (const [pair, info] of Object.entries(snap?.pairs ?? {})) {
          if (info && typeof info.percent === "number" && Number.isFinite(info.percent)) {
            map.set(pair, info.percent);
          }
        }
        byAsset.set(assetClass, map);
      }

      const directionMap = systemDirectionMap(weekBias, system);
      let ret = 0;
      let trades = 0;
      let wins = 0;
      for (const pairInfo of pairUniverse) {
        const pKey = pairKey(pairInfo.assetClass, pairInfo.pair);
        if (system === "tiered_v1") {
          const tier = weekBias.tieredTier.get(pKey) ?? null;
          if (tier === null || tier > TIERED_MIN_TIER) continue;
        }
        const bias = resolveBias(directionMap, pairInfo.assetClass, pairInfo.pair);
        if (bias !== "LONG" && bias !== "SHORT") continue;
        const raw = byAsset.get(pairInfo.assetClass)?.get(pairInfo.pair);
        if (raw === undefined) continue;
        const adjusted = bias === "LONG" ? raw : -raw;
        trades += 1;
        ret += adjusted;
        if (adjusted > 0) wins += 1;
      }
      weekly.push({
        week_open_utc: week,
        week_label: weeklyLabel(week),
        return_pct: ret,
        trades,
        wins,
        win_rate_pct: computeWinRate(wins, trades),
      });
    }

    const totalTrades = weekly.reduce((sum, row) => sum + row.trades, 0);
    const totalWins = weekly.reduce((sum, row) => sum + row.wins, 0);
    const arithmetic = weekly.reduce((sum, row) => sum + row.return_pct, 0);
    const compounded = (growthFromWeeklyReturns(weekly.map((row) => row.return_pct)) - 1) * 100;
    return {
      system,
      weekly,
      total: {
        arithmetic_return_pct: arithmetic,
        compounded_return_pct: compounded,
        trades: totalTrades,
        win_rate_pct: computeWinRate(totalWins, totalTrades),
      },
    } satisfies BaselineSummary;
  })();
}

async function runVariant(params: {
  id: string;
  biasSystem: BiasSystem;
  neutralMode: NeutralMode;
  entryMode: EntryMode;
  sweepThresholdPct: number;
  exitMode: ExitMode;
  tieredMaxTier: 1 | 2;
  tierRiskModel: TierRiskModel;
  handshakeConfig: HandshakeConfig;
  weeks: readonly string[];
  pairUniverse: PairInfo[];
  biasByWeek: Map<string, WeekBiasMaps>;
  candlesByPair: Map<string, OhlcCandle[]>;
  correlationByWeek: Map<string, WeekCorrelationData>;
}) {
  const {
    id,
    biasSystem,
    neutralMode,
    entryMode,
    sweepThresholdPct,
    exitMode,
    tieredMaxTier,
    tierRiskModel,
    handshakeConfig,
    weeks,
    pairUniverse,
    biasByWeek,
    candlesByPair,
    correlationByWeek,
  } = params;

  let equity = STARTING_EQUITY_USD;
  const equityCurve = [equity];
  const weekly: WeekVariantSummary[] = [];
  const trades: AcceptedTrade[] = [];
  const handshakeAggregate: HandshakeDiagnostics = {
    total_signals: 0,
    clustered_signals: 0,
    clustered_passed_signals: 0,
    standalone_signals: 0,
    passed_signals: 0,
    gated_out_signals: 0,
    trigger_rate_pct: 0,
    avg_cluster_size_triggered: 0,
  };
  let handshakeClusterWeightedSum = 0;
  let handshakeClusterWeightedDenom = 0;

  for (const week of weeks) {
    const weekBias = biasByWeek.get(week);
    if (!weekBias) {
      weekly.push({
        week_open_utc: week,
        week_label: weeklyLabel(week),
        starting_equity_usd: equity,
        ending_equity_usd: equity,
        week_return_pct: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        win_rate_pct: 0,
        avg_trade_return_pct: 0,
        avg_trade_duration_hours: 0,
      });
      continue;
    }

    const weekSim = simulateWeekForVariant({
      weekOpenUtc: week,
      biasSystem,
      neutralMode,
      entryMode,
      sweepThresholdPct,
      exitMode,
      startEquityUsd: equity,
      pairUniverse,
      weekBiasMaps: weekBias,
      candlesByPair,
      tieredMaxTier,
      tierRiskModel,
      handshakeConfig,
      weekCorrelation: correlationByWeek.get(week) ?? null,
    });
    weekly.push(weekSim.summary);
    trades.push(...weekSim.trades);
    if (weekSim.handshakeDiagnostics) {
      handshakeAggregate.total_signals += weekSim.handshakeDiagnostics.total_signals;
      handshakeAggregate.clustered_signals += weekSim.handshakeDiagnostics.clustered_signals;
      handshakeAggregate.clustered_passed_signals += weekSim.handshakeDiagnostics.clustered_passed_signals;
      handshakeAggregate.standalone_signals += weekSim.handshakeDiagnostics.standalone_signals;
      handshakeAggregate.passed_signals += weekSim.handshakeDiagnostics.passed_signals;
      handshakeAggregate.gated_out_signals += weekSim.handshakeDiagnostics.gated_out_signals;
      handshakeClusterWeightedSum +=
        weekSim.handshakeDiagnostics.avg_cluster_size_triggered
        * weekSim.handshakeDiagnostics.clustered_passed_signals;
      handshakeClusterWeightedDenom += weekSim.handshakeDiagnostics.clustered_passed_signals;
    }

    // Realized-equity walk for drawdown tracking.
    for (const trade of weekSim.trades) {
      equity += trade.netPnlUsd;
      equityCurve.push(equity);
    }
    if (weekSim.trades.length === 0) {
      equityCurve.push(equity);
    }
  }

  const totalTrades = trades.length;
  const wins = trades.filter((trade) => trade.netPnlUsd > 0).length;
  const avgDur = totalTrades > 0
    ? trades.reduce((sum, trade) => sum + trade.durationHours, 0) / totalTrades
    : 0;
  const avgTradeRet = totalTrades > 0
    ? trades.reduce((sum, trade) => sum + trade.returnPctOnEntryEquity, 0) / totalTrades
    : 0;
  const weeklyReturns = weekly.map((row) => row.week_return_pct);
  const growth = growthFromWeeklyReturns(weeklyReturns);
  const totalReturnPct = STARTING_EQUITY_USD > 0 ? ((equity - STARTING_EQUITY_USD) / STARTING_EQUITY_USD) * 100 : 0;
  const maxDd = computeMaxDrawdownPct(equityCurve);
  const exitStepDistribution: Record<StopStep, number> = {
    hard_sl: 0,
    breakeven: 0,
    lock_015: 0,
    lock_035: 0,
    lock_055: 0,
    trailing: 0,
    week_close: 0,
  };
  for (const trade of trades) exitStepDistribution[trade.exitStep] += 1;
  const reached025 = trades.filter((trade) => trade.reached025).length;
  const reached050 = trades.filter((trade) => trade.reached050).length;
  const reached075 = trades.filter((trade) => trade.reached075).length;
  const reached100 = trades.filter((trade) => trade.reached100).length;
  const finalHandshakeDiagnostics =
    handshakeConfig.enabled && entryMode === "sweep"
      ? {
        ...handshakeAggregate,
        trigger_rate_pct: handshakeAggregate.clustered_signals > 0
          ? (handshakeAggregate.clustered_passed_signals / handshakeAggregate.clustered_signals) * 100
          : 0,
        avg_cluster_size_triggered: handshakeClusterWeightedDenom > 0
          ? handshakeClusterWeightedSum / handshakeClusterWeightedDenom
          : 0,
      }
      : null;

  return {
    id,
    bias_system: biasSystem,
    neutral_mode: neutralMode,
    headline: {
      start_equity_usd: STARTING_EQUITY_USD,
      end_equity_usd: equity,
      total_return_pct: totalReturnPct,
      compounded_return_pct: (growth - 1) * 100,
      max_drawdown_pct: maxDd,
      win_rate_pct: computeWinRate(wins, totalTrades),
      trades: totalTrades,
      avg_trade_duration_hours: avgDur,
      avg_trade_return_pct: avgTradeRet,
      trades_per_week: weeks.length > 0 ? totalTrades / weeks.length : 0,
      risk_adjusted_return: maxDd > 0 ? totalReturnPct / maxDd : 0,
      exit_step_distribution: exitStepDistribution,
      milestone_reach_rates_pct: {
        reached_025: computeWinRate(reached025, totalTrades),
        reached_050: computeWinRate(reached050, totalTrades),
        reached_075: computeWinRate(reached075, totalTrades),
        reached_100: computeWinRate(reached100, totalTrades),
      },
      handshake_diagnostics: finalHandshakeDiagnostics,
    },
    weekly,
    trades,
  } satisfies VariantRun;
}

function fmtPct(value: number, digits = 2) {
  const rounded = round(value, digits);
  const sign = rounded >= 0 ? "+" : "-";
  return `${sign}${Math.abs(rounded).toFixed(digits)}%`;
}

function fmtUsd(value: number) {
  const rounded = round(value, 2);
  const sign = rounded >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(rounded).toFixed(2)}`;
}

async function main() {
  loadDotEnv();

  if (!Number.isFinite(STARTING_EQUITY_USD) || STARTING_EQUITY_USD <= 0) {
    throw new Error(`Invalid KATARAKTI_STARTING_EQUITY_USD: ${String(STARTING_EQUITY_USD)}`);
  }
  if (!Number.isFinite(FETCH_CONCURRENCY) || FETCH_CONCURRENCY <= 0) {
    throw new Error(`Invalid KATARAKTI_FETCH_CONCURRENCY: ${String(FETCH_CONCURRENCY)}`);
  }
  if (!Number.isFinite(MAX_ENTRIES_PER_PAIR_PER_WEEK) || MAX_ENTRIES_PER_PAIR_PER_WEEK <= 0) {
    throw new Error(`Invalid KATARAKTI_MAX_ENTRIES_PER_PAIR_PER_WEEK: ${String(MAX_ENTRIES_PER_PAIR_PER_WEEK)}`);
  }
  if (LOCK_STYLE === "atr") {
    const atrParams = [
      ["KATARAKTI_ATR_PERIOD", ATR_PERIOD],
      ["KATARAKTI_ATR_BREAKEVEN_TRIGGER_X", ATR_BREAKEVEN_TRIGGER_X],
      ["KATARAKTI_ATR_LOCK1_TRIGGER_X", ATR_LOCK1_TRIGGER_X],
      ["KATARAKTI_ATR_LOCK1_LOCK_X", ATR_LOCK1_LOCK_X],
      ["KATARAKTI_ATR_LOCK2_TRIGGER_X", ATR_LOCK2_TRIGGER_X],
      ["KATARAKTI_ATR_LOCK2_LOCK_X", ATR_LOCK2_LOCK_X],
      ["KATARAKTI_ATR_TRAIL_ACTIVATE_X", ATR_TRAIL_ACTIVATE_X],
      ["KATARAKTI_ATR_TRAIL_OFFSET_X", ATR_TRAIL_OFFSET_X],
    ] as const;
    for (const [name, value] of atrParams) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid ${name}: ${String(value)}`);
      }
    }
  }
  if (TEST_PLAN === "phase2") {
    if (PHASE2_REQUIRE_ATR && LOCK_STYLE !== "atr") {
      throw new Error("Phase 2 requires ATR lock mode. Set KATARAKTI_LOCK_STYLE=atr.");
    }
    if (PHASE2_REQUIRE_NO_HARD_SL && EXIT_MODE !== "stepped_no_hard_sl") {
      throw new Error("Phase 2 requires no hard stop mode. Set KATARAKTI_EXIT_MODE=stepped_no_hard_sl.");
    }
    if (!Number.isFinite(CORRELATION_LOOKBACK_HOURS) || CORRELATION_LOOKBACK_HOURS < 24) {
      throw new Error(`Invalid KATARAKTI_CORR_LOOKBACK_HOURS: ${String(CORRELATION_LOOKBACK_HOURS)}`);
    }
  }
  const pairFilter = parsePairFilter(PAIR_FILTER_RAW);

  const pairUniverse = buildPairUniverse(pairFilter);
  if (pairUniverse.length === 0) {
    throw new Error(`No pairs selected. KATARAKTI_PAIR_FILTER=${PAIR_FILTER_RAW}`);
  }
  const activeEntryMode: EntryMode = TEST_PLAN === "phase2" ? "sweep" : ENTRY_MODE;
  const activeExitMode: ExitMode = TEST_PLAN === "phase2" ? "stepped_no_hard_sl" : EXIT_MODE;
  const weekStart = DateTime.fromISO(WEEKS[0], { zone: "utc" });
  const weekEnd = DateTime.fromISO(WEEKS[WEEKS.length - 1], { zone: "utc" }).plus({ days: 7 });
  const correlationLookbackDays = Math.ceil(CORRELATION_LOOKBACK_HOURS / 24);
  const fetchLookbackDays = TEST_PLAN === "phase2" ? Math.max(7, correlationLookbackDays + 1) : 7;
  const fetchFromUtc = weekStart.minus({ days: fetchLookbackDays });
  const fetchToUtc = weekEnd.plus({ days: 1 });

  const [biasByWeek, candlesData] = await Promise.all([
    loadBiasMapsByWeek(WEEKS, pairUniverse),
    loadCandleSeriesForUniverse({
      pairUniverse,
      fetchFromUtc,
      fetchToUtc,
    }),
  ]);

  const correlationByWeek = new Map<string, WeekCorrelationData>();
  if (TEST_PLAN === "phase2") {
    for (const week of WEEKS) {
      correlationByWeek.set(
        week,
        buildWeekCorrelationData({
          weekOpenUtc: week,
          lookbackHours: CORRELATION_LOOKBACK_HOURS,
          pairUniverse,
          candlesByPair: candlesData.map,
        }),
      );
    }
  }

  const noHandshake: HandshakeConfig = {
    enabled: false,
    corrThresholdAbs: 0,
    minConfirmations: 1,
    includeAntiCorrelation: false,
    lookbackHours: CORRELATION_LOOKBACK_HOURS,
  };

  const variantDefs: Array<{
    id: string;
    biasSystem: BiasSystem;
    neutralMode: NeutralMode;
    entryMode: EntryMode;
    sweepThresholdPct: number;
    exitMode: ExitMode;
    tieredMaxTier: 1 | 2;
    tierRiskModel: TierRiskModel;
    handshakeConfig: HandshakeConfig;
  }> = [
    ...(TEST_PLAN === "phase2"
      ? [
        {
          id: "univ__hs2__corr070",
          biasSystem: "universal_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: {
            enabled: true,
            corrThresholdAbs: 0.70,
            minConfirmations: 2,
            includeAntiCorrelation: true,
            lookbackHours: CORRELATION_LOOKBACK_HOURS,
          },
        },
        {
          id: "univ__hs3__corr070",
          biasSystem: "universal_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: {
            enabled: true,
            corrThresholdAbs: 0.70,
            minConfirmations: 3,
            includeAntiCorrelation: true,
            lookbackHours: CORRELATION_LOOKBACK_HOURS,
          },
        },
        {
          id: "univ__hs2__corr060",
          biasSystem: "universal_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: {
            enabled: true,
            corrThresholdAbs: 0.60,
            minConfirmations: 2,
            includeAntiCorrelation: true,
            lookbackHours: CORRELATION_LOOKBACK_HOURS,
          },
        },
        {
          id: "univ__hs2__corr070__no_anti",
          biasSystem: "universal_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: {
            enabled: true,
            corrThresholdAbs: 0.70,
            minConfirmations: 2,
            includeAntiCorrelation: false,
            lookbackHours: CORRELATION_LOOKBACK_HOURS,
          },
        },
        {
          id: "univ__no_hs",
          biasSystem: "universal_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: noHandshake,
        },
        {
          id: "tiered__t1_only__1pct",
          biasSystem: "tiered_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: noHandshake,
        },
        {
          id: "tiered__t1t2__flat_1pct",
          biasSystem: "tiered_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 2 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: noHandshake,
        },
        {
          id: "tiered__t1t2__weighted",
          biasSystem: "tiered_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 2 as const,
          tierRiskModel: "weighted" as const,
          handshakeConfig: noHandshake,
        },
        {
          id: "tiered__t1t2__weighted__hs2__corr070",
          biasSystem: "tiered_v1" as const,
          neutralMode: "skip" as const,
          entryMode: "sweep" as const,
          sweepThresholdPct: 0.10,
          exitMode: "stepped_no_hard_sl" as const,
          tieredMaxTier: 2 as const,
          tierRiskModel: "weighted" as const,
          handshakeConfig: {
            enabled: true,
            corrThresholdAbs: 0.70,
            minConfirmations: 2,
            includeAntiCorrelation: true,
            lookbackHours: CORRELATION_LOOKBACK_HOURS,
          },
        },
      ]
      : [
        {
          id: "universal_v1__skip__sweep010",
          biasSystem: "universal_v1" as const,
          neutralMode: "skip" as const,
          entryMode: activeEntryMode,
          sweepThresholdPct: 0.10,
          exitMode: activeExitMode,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: noHandshake,
        },
        {
          id: "universal_v1__skip__sweep025",
          biasSystem: "universal_v1" as const,
          neutralMode: "skip" as const,
          entryMode: activeEntryMode,
          sweepThresholdPct: 0.25,
          exitMode: activeExitMode,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: noHandshake,
        },
        {
          id: "tiered_v1__skip__sweep010",
          biasSystem: "tiered_v1" as const,
          neutralMode: "skip" as const,
          entryMode: activeEntryMode,
          sweepThresholdPct: 0.10,
          exitMode: activeExitMode,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: noHandshake,
        },
        {
          id: "tiered_v1__skip__sweep025",
          biasSystem: "tiered_v1" as const,
          neutralMode: "skip" as const,
          entryMode: activeEntryMode,
          sweepThresholdPct: 0.25,
          exitMode: activeExitMode,
          tieredMaxTier: 1 as const,
          tierRiskModel: "flat" as const,
          handshakeConfig: noHandshake,
        },
      ]),
  ];
  if (TEST_PLAN !== "phase2" && INCLUDE_NEUTRAL_BOTH_WAYS) {
    variantDefs.splice(1, 0, {
      id: "universal_v1__both__sweep010",
      biasSystem: "universal_v1",
      neutralMode: "both_ways",
      entryMode: activeEntryMode,
      sweepThresholdPct: 0.10,
      exitMode: activeExitMode,
      tieredMaxTier: 1,
      tierRiskModel: "flat",
      handshakeConfig: noHandshake,
    });
    variantDefs.splice(3, 0, {
      id: "universal_v1__both__sweep025",
      biasSystem: "universal_v1",
      neutralMode: "both_ways",
      entryMode: activeEntryMode,
      sweepThresholdPct: 0.25,
      exitMode: activeExitMode,
      tieredMaxTier: 1,
      tierRiskModel: "flat",
      handshakeConfig: noHandshake,
    });
  }
  const variants = await Promise.all(
    variantDefs.map((def) =>
      runVariant({
        id: def.id,
        biasSystem: def.biasSystem,
        neutralMode: def.neutralMode,
        entryMode: def.entryMode,
        sweepThresholdPct: def.sweepThresholdPct,
        exitMode: def.exitMode,
        tieredMaxTier: def.tieredMaxTier,
        tierRiskModel: def.tierRiskModel,
        handshakeConfig: def.handshakeConfig,
        weeks: WEEKS,
        pairUniverse,
        biasByWeek,
        candlesByPair: candlesData.map,
        correlationByWeek,
      })),
  );

  const [baselineUniversal, baselineTiered] = await Promise.all([
    buildBaselineFromMarketSnapshots({
      weeks: WEEKS,
      pairUniverse,
      biasByWeek,
      system: "universal_v1",
    }),
    buildBaselineFromMarketSnapshots({
      weeks: WEEKS,
      pairUniverse,
      biasByWeek,
      system: "tiered_v1",
    }),
  ]);
  const [holdBaselineUniversal, holdBaselineTiered] = await Promise.all([
    runVariant({
      id: "hold_portfolio__universal_v1__skip",
      biasSystem: "universal_v1",
      neutralMode: "skip",
      entryMode: "week_open_hold",
      sweepThresholdPct: 0.10,
      exitMode: activeExitMode,
      tieredMaxTier: 1,
      tierRiskModel: "flat",
      handshakeConfig: noHandshake,
      weeks: WEEKS,
      pairUniverse,
      biasByWeek,
      candlesByPair: candlesData.map,
      correlationByWeek,
    }),
    runVariant({
      id: "hold_portfolio__tiered_v1__skip",
      biasSystem: "tiered_v1",
      neutralMode: "skip",
      entryMode: "week_open_hold",
      sweepThresholdPct: 0.10,
      exitMode: activeExitMode,
      tieredMaxTier: 1,
      tierRiskModel: "flat",
      handshakeConfig: noHandshake,
      weeks: WEEKS,
      pairUniverse,
      biasByWeek,
      candlesByPair: candlesData.map,
      correlationByWeek,
    }),
  ]);
  const phase1Baseline = variants.find((variant) => variant.id === PHASE1_BASELINE_VARIANT_ID) ?? null;

  const report = {
    generated_utc: DateTime.utc().toISO(),
    spec_date_utc:
      DateTime.fromISO(WEEKS[WEEKS.length - 1], { zone: "utc" })
        .plus({ weeks: 1 })
        .toISODate() ?? DateTime.utc().toISODate(),
    test_plan: TEST_PLAN,
    config: {
      weeks: [...WEEKS],
      pair_universe_count: pairUniverse.length,
      timeframe: "H1",
      sweep_thresholds_pct_tested: [0.10, 0.25],
      displacement_min_body_pct: DISPLACEMENT_BODY_MIN_PCT,
      displacement_close_zone_pct: CLOSE_ZONE_PCT * 100,
      stop_ladder_pct: {
        hard_stop_loss: -HARD_STOP_PCT,
        breakeven_trigger: BREAKEVEN_TRIGGER_PCT,
        lock_015_trigger: LOCK_015_TRIGGER_PCT,
        lock_035_trigger: LOCK_035_TRIGGER_PCT,
        lock_055_trigger: LOCK_055_TRIGGER_PCT,
        trailing_above: TRAIL_ACTIVE_ABOVE_PCT,
        trailing_offset: TRAIL_OFFSET_PCT,
      },
      lock_style: LOCK_STYLE,
      atr_lock_params:
        LOCK_STYLE === "atr"
          ? {
            atr_period: ATR_PERIOD,
            breakeven_trigger_atr: ATR_BREAKEVEN_TRIGGER_X,
            lock1_trigger_atr: ATR_LOCK1_TRIGGER_X,
            lock1_lock_atr: ATR_LOCK1_LOCK_X,
            lock2_trigger_atr: ATR_LOCK2_TRIGGER_X,
            lock2_lock_atr: ATR_LOCK2_LOCK_X,
            trail_activate_atr: ATR_TRAIL_ACTIVATE_X,
            trail_offset_atr: ATR_TRAIL_OFFSET_X,
          }
          : null,
      risk_per_trade_pct: RISK_PER_TRADE_PCT,
      max_entries_per_pair_per_week: MAX_ENTRIES_PER_PAIR_PER_WEEK,
      max_concurrent_positions: MAX_CONCURRENT_POSITIONS,
      max_portfolio_risk_pct: MAX_PORTFOLIO_RISK_PCT,
      transaction_costs_enabled: false,
      tiered_v1_min_tier: TIERED_MIN_TIER,
      include_neutral_both_ways: INCLUDE_NEUTRAL_BOTH_WAYS,
      phase1_baseline_variant_id: PHASE1_BASELINE_VARIANT_ID,
      entry_mode: activeEntryMode,
      pair_filter: pairFilter ? [...pairFilter] : null,
      sweep_block_thu_fri: BLOCK_SWEEP_THU_FRI,
      entry_day_timezone: ENTRY_DAY_TZ,
      exit_mode: activeExitMode,
      correlation_lookback_hours: TEST_PLAN === "phase2" ? CORRELATION_LOOKBACK_HOURS : null,
      execution: {
        entry_fill: activeEntryMode === "week_open_hold" ? "week_open_candle_open" : "displacement_candle_close",
        stop_fill:
          activeExitMode === "stepped_with_hard_sl"
            ? "intrabar_touch_at_stop_price_most_protective_level"
            : "profit_lock_only_no_hard_sl_intrabar_touch",
        week_end_close_fill: "last_candle_close",
      },
      fetch_window_utc: {
        from: fetchFromUtc.toISO(),
        to: fetchToUtc.toISO(),
      },
      starting_equity_usd: STARTING_EQUITY_USD,
    },
    data_quality: {
      missing_candle_series_count: candlesData.missingPairs.length,
      missing_candle_series: candlesData.missingPairs,
    },
    correlation_by_week:
      TEST_PLAN === "phase2"
        ? Array.from(correlationByWeek.values()).map((row) => ({
          week_open_utc: row.week_open_utc,
          lookback_hours: row.lookback_hours,
          matrix_rows: row.matrix_rows.map((r) => ({
            pair_a: r.pair_a,
            pair_b: r.pair_b,
            correlation: round(r.correlation, 6),
            sample_size: r.sample_size,
          })),
        }))
        : [],
    phase1_baseline_headline: phase1Baseline
      ? {
        id: phase1Baseline.id,
        return_pct: phase1Baseline.headline.total_return_pct,
        max_drawdown_pct: phase1Baseline.headline.max_drawdown_pct,
        win_rate_pct: phase1Baseline.headline.win_rate_pct,
        trades: phase1Baseline.headline.trades,
      }
      : null,
    baselines: [baselineUniversal, baselineTiered],
    portfolio_hold_baselines: [
      {
        id: holdBaselineUniversal.id,
        bias_system: holdBaselineUniversal.bias_system,
        neutral_mode: holdBaselineUniversal.neutral_mode,
        entry_mode: "week_open_hold" as const,
        exit_mode: activeExitMode,
        headline: holdBaselineUniversal.headline,
      },
      {
        id: holdBaselineTiered.id,
        bias_system: holdBaselineTiered.bias_system,
        neutral_mode: holdBaselineTiered.neutral_mode,
        entry_mode: "week_open_hold" as const,
        exit_mode: activeExitMode,
        headline: holdBaselineTiered.headline,
      },
    ],
    variants,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const autoSuffixParts: string[] = [];
  if (TEST_PLAN === "phase2") autoSuffixParts.push("phase2");
  if (activeEntryMode !== "sweep") autoSuffixParts.push(activeEntryMode);
  if (activeExitMode !== "stepped_with_hard_sl") autoSuffixParts.push(activeExitMode);
  if (LOCK_STYLE !== "fixed_pct") autoSuffixParts.push(LOCK_STYLE);
  const suffix = REPORT_TAG
    ? `-${REPORT_TAG}`
    : autoSuffixParts.length > 0
      ? `-${autoSuffixParts.join("-")}`
      : "";
  const jsonPath = `reports/katarakti-phase1-backtest-${stamp}${suffix}.json`;
  const mdPath = `reports/katarakti-phase1-backtest-${stamp}${suffix}.md`;
  const latestJsonPath = `reports/katarakti-phase1-backtest-latest${suffix}.json`;
  const latestMdPath = `reports/katarakti-phase1-backtest-latest${suffix}.md`;

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push(`# Katarakti ${TEST_PLAN === "phase2" ? "Phase 2" : "Phase 1"} Backtest`);
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Test plan: ${TEST_PLAN}`);
  md.push(`Weeks: ${WEEKS.join(", ")}`);
  md.push(`Universe size: ${pairUniverse.length}`);
  md.push(`Starting equity: ${fmtUsd(STARTING_EQUITY_USD)}`);
  md.push(`Entry mode: ${activeEntryMode}`);
  md.push(`Exit mode: ${activeExitMode}`);
  md.push(`Lock style: ${LOCK_STYLE}`);
  md.push(`Max entries per pair/week: ${MAX_ENTRIES_PER_PAIR_PER_WEEK}`);
  md.push(`Sweep Thu/Fri block (ET): ${BLOCK_SWEEP_THU_FRI ? "on" : "off"}`);
  md.push(`Neutral both_ways variants included: ${INCLUDE_NEUTRAL_BOTH_WAYS ? "yes" : "no"}`);
  md.push(`Locked baseline variant: ${PHASE1_BASELINE_VARIANT_ID}`);
  if (TEST_PLAN === "phase2") md.push(`Correlation lookback (hours): ${CORRELATION_LOOKBACK_HOURS}`);
  if (pairFilter) md.push(`Pair filter: ${[...pairFilter].join(", ")}`);
  md.push("");
  md.push("## Variant Summary");
  md.push("");
  md.push("| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const variant of variants) {
    md.push(
      `| ${variant.id} | ${fmtPct(variant.headline.total_return_pct)} | ${fmtPct(variant.headline.max_drawdown_pct)} | ${variant.headline.win_rate_pct.toFixed(2)}% | ${variant.headline.trades} | ${fmtPct(variant.headline.avg_trade_return_pct)} | ${variant.headline.risk_adjusted_return.toFixed(3)} |`,
    );
  }
  md.push("");
  const handshakeVariants = variants.filter((v) => v.headline.handshake_diagnostics !== null);
  if (handshakeVariants.length > 0) {
    md.push("## Handshake Diagnostics");
    md.push("");
    md.push("| Variant | Signals | Clustered | Confirmed | Standalone | Passed | Gated Out | Trigger Rate | Avg Triggered Cluster |");
    md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const variant of handshakeVariants) {
      const h = variant.headline.handshake_diagnostics!;
      md.push(
        `| ${variant.id} | ${h.total_signals} | ${h.clustered_signals} | ${h.clustered_passed_signals} | ${h.standalone_signals} | ${h.passed_signals} | ${h.gated_out_signals} | ${h.trigger_rate_pct.toFixed(2)}% | ${h.avg_cluster_size_triggered.toFixed(2)} |`,
      );
    }
    md.push("");
  }
  if (TEST_PLAN === "phase2") {
    md.push("## Correlation Coverage");
    md.push("");
    md.push("| Week | Lookback (h) | Pairwise Corr Rows |");
    md.push("| --- | ---: | ---: |");
    for (const row of Array.from(correlationByWeek.values())) {
      md.push(`| ${row.week_open_utc.slice(0, 10)} | ${row.lookback_hours} | ${row.matrix_rows.length} |`);
    }
    md.push("");
  }
  md.push("## Exit Diagnostics (Per Variant)");
  md.push("");
  md.push("| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const variant of variants) {
    const dist = variant.headline.exit_step_distribution;
    const reach = variant.headline.milestone_reach_rates_pct;
    md.push(
      `| ${variant.id} | ${dist.hard_sl} | ${dist.breakeven} | ${dist.lock_015} | ${dist.lock_035} | ${dist.lock_055} | ${dist.trailing} | ${dist.week_close} | ${reach.reached_025.toFixed(2)}% | ${reach.reached_050.toFixed(2)}% | ${reach.reached_075.toFixed(2)}% | ${reach.reached_100.toFixed(2)}% |`,
    );
  }
  md.push("");
  md.push("## Baseline (Bias Hold, Weekly Snapshot Returns)");
  md.push("");
  md.push("| System | Return (arith) | Return (compounded) | Trades | Win Rate |");
  md.push("| --- | ---: | ---: | ---: | ---: |");
  for (const base of [baselineUniversal, baselineTiered]) {
    md.push(
      `| ${base.system} | ${fmtPct(base.total.arithmetic_return_pct)} | ${fmtPct(base.total.compounded_return_pct)} | ${base.total.trades} | ${base.total.win_rate_pct.toFixed(2)}% |`,
    );
  }
  md.push("");
  md.push("## Portfolio Baseline (Apples-to-Apples Week-Open Hold)");
  md.push("");
  md.push("| Baseline | Return | Max DD | Win Rate | Trades | Avg/Trade |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const hold of [holdBaselineUniversal, holdBaselineTiered]) {
    md.push(
      `| ${hold.id} | ${fmtPct(hold.headline.total_return_pct)} | ${fmtPct(hold.headline.max_drawdown_pct)} | ${hold.headline.win_rate_pct.toFixed(2)}% | ${hold.headline.trades} | ${fmtPct(hold.headline.avg_trade_return_pct)} |`,
    );
  }
  md.push("");
  if (candlesData.missingPairs.length > 0) {
    md.push("## Missing Candle Series");
    md.push("");
    for (const row of candlesData.missingPairs) {
      md.push(`- ${row}`);
    }
    md.push("");
  }
  md.push(`JSON: \`${jsonPath}\``);

  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(latestMdPath, md.join("\n"), "utf8");

  console.log(JSON.stringify({
    json: jsonPath,
    md: mdPath,
    latest_json: latestJsonPath,
    latest_md: latestMdPath,
    variants: variants.map((v) => ({
      id: v.id,
      return_pct: round(v.headline.total_return_pct, 4),
      max_dd_pct: round(v.headline.max_drawdown_pct, 4),
      trades: v.headline.trades,
      win_rate_pct: round(v.headline.win_rate_pct, 2),
    })),
  }, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${latestJsonPath}`);
  console.log(`Wrote ${latestMdPath}`);

  await getPool().end();
}

main().catch(async (error) => {
  console.error("katarakti-phase1-backtest failed:", error);
  try {
    await getPool().end();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
