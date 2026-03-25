/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-dip-running-extreme.ts
 *
 * Description:
 * Test 7 in the ADR dip-entry research program.
 *
 * Tests the Dynamic Running Extreme concept from the spec
 * (docs/ADR_DYNAMIC_RUNNING_EXTREME_SPEC_2026-03-24.md).
 *
 * Instead of anchoring ADR levels to a fixed time boundary (weekly open, daily open),
 * this tracks a running extreme — the highest high or lowest low — and triggers
 * when price moves 1.0x ADR away from that extreme.
 *
 * Variants:
 *   W. Weekly baseline (same as Test 3/6: one fill per pair per week from weekly open)
 *   A. Fresh Start — after exit, reset anchor to na, begin tracking from next bar
 *   B. Consumed Trigger — after exit, anchor stays but is marked "used"; only resets on new extreme beyond old
 *   C. Side Flip — after LONG trigger from high, the low near fill becomes SHORT anchor, and vice versa
 *
 * All variants use weekly scope boundary (anchor resets at each week boundary).
 * NEUTRAL pairs track both sides. Bias-gated pairs track their bias direction only.
 * C variant respects bias gate: if bias blocks the flipped direction, it degenerates to A.
 *
 * Usage: .\node_modules\.bin\tsx.cmd scripts/adr-dip-running-extreme.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

import { DateTime } from "luxon";
import { query } from "@/lib/db";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { fetchOandaCandleSeries, type OandaHourlyCandle } from "@/lib/oandaPrices";
import { computeTieredWeekForSystem } from "@/lib/performance/tiered";
import {
  buildCotGateContext,
  buildGateMap,
  evaluatePairWithGate,
  type GateDecision,
} from "@/lib/performance/gateEvaluation";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";

/* ─── Constants ─── */

const LOOKBACK_WEEKS = 9;
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ADR_MULTIPLIER = 1.0;
const TP_MULTIPLIER = 0.25;
const FETCH_CONCURRENCY = 6;
const REPORT_PATH = path.resolve(process.cwd(), "reports", "adr-dip-running-extreme.md");
const NEW_YORK_TZ = "America/New_York";

const MODEL_TO_TIER: Record<string, string | null> = {
  antikythera: null,
  antikythera_v2: null,
  antikythera_v3: "HIGH",
  blended: null,
  dealer: "MEDIUM",
  commercial: "LOW",
  sentiment: null,
};

const MAE_BUCKETS = [
  { label: "0.00 - 0.10", min: 0, max: 0.1 },
  { label: "0.10 - 0.25", min: 0.1, max: 0.25 },
  { label: "0.25 - 0.50", min: 0.25, max: 0.5 },
  { label: "0.50 - 0.75", min: 0.5, max: 0.75 },
  { label: "0.75 - 1.00", min: 0.75, max: 1.0 },
  { label: "1.00 - 1.50", min: 1.0, max: 1.5 },
  { label: "1.50+", min: 1.5, max: Number.POSITIVE_INFINITY },
] as const;

/* ─── Types ─── */

type Direction = "LONG" | "SHORT";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type SignalMode = "GATED" | "NON_GATED";
type VariantKey = "W" | "A" | "B" | "C";

type FillRecord = {
  variant: VariantKey;
  week: string;
  weekLabel: string;
  pair: string;
  direction: Direction;
  assetClass: AssetClass;
  signalMode: SignalMode;
  gateDecision: GateDecision;
  anchorPrice: number;
  adrPct: number;
  entryPrice: number;
  tpPrice: number;
  fillBarIndex: number;
  fillTs: number;
  exitTs: number;
  exitPrice: number;
  returnPct: number;
  tpHit: boolean;
  maePrice: number;
  maeXAdr: number;
};

type PairWeekRecord = {
  week: string;
  weekLabel: string;
  pair: string;
  direction: Direction;
  tier: string;
  model: string;
  assetClass: AssetClass;
  gateDecision: GateDecision;
  signalMode: SignalMode;
  weeklyFill: FillRecord | null;
  weeklyEligible: boolean;
  weeklySkipReason: string | null;
  variantFills: Record<"A" | "B" | "C", FillRecord[]>;
  variantEligible: boolean;
};

type VariantSummary = {
  totalSignals: number;
  eligibleSignals: number;
  totalFills: number;
  fillRate: number | null;
  avgReturnPerFill: number | null;
  totalReturn: number | null;
  winRate: number | null;
  tpHitRate: number | null;
  avgMaeXAdr: number | null;
  p95MaeXAdr: number | null;
  losingWeeks: number;
  avgFillsPerPairWeek: number | null;
};

/* ─── Utility Functions ─── */

function buildCompletedWeekOpens(count: number): string[] {
  const now = DateTime.utc();
  const currentWeekOpen = getCanonicalWeekOpenUtc(now);
  const currentWeekOpenDt = DateTime.fromISO(currentWeekOpen, { zone: "utc" });
  const lastCompleted = currentWeekOpenDt.minus({ weeks: 1 });
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const weekOpen = lastCompleted.minus({ weeks: i });
    weeks.push(getCanonicalWeekOpenUtc(weekOpen.plus({ hours: 1 })));
  }
  return weeks;
}

function weekLabelFn(weekOpenUtc: string): string {
  const dt = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone(NEW_YORK_TZ);
  if (!dt.isValid) return weekOpenUtc.slice(0, 10);
  return dt.plus({ days: 1 }).startOf("day").toFormat("MMM dd");
}

function toFinite(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function fmtPct(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function fmtRate(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  return `${value.toFixed(digits)}%`;
}

function fmtNum(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "\u2014";
  return value.toFixed(digits);
}

function classifySignalMode(decision: GateDecision): SignalMode {
  return decision === "SKIP" || decision === "REDUCE" ? "NON_GATED" : "GATED";
}

function signedReturnPct(direction: Direction, entryPrice: number, exitPrice: number): number {
  const rawPct = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "LONG" ? rawPct : -rawPct;
}

function renderMarkdownTable(headers: string[], rows: string[][]): string {
  const divider = headers.map(() => "---");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  if (items.length === 0) return [] as R[];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) return;
        results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
      }
    }),
  );
  return results;
}

function quantile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? null;
  const weight = index - lower;
  const lowerValue = sorted[lower]!;
  const upperValue = sorted[upper]!;
  return lowerValue + (upperValue - lowerValue) * weight;
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

async function computeAdrPct(symbol: string, beforeUtcIso: string): Promise<number | null> {
  const rows = await query<{ open_price: string; high_price: string; low_price: string }>(
    `SELECT open_price, high_price, low_price
     FROM pair_period_returns
     WHERE symbol = $1
       AND period_type = 'daily'
       AND period_open_utc < $2::timestamptz
     ORDER BY period_open_utc DESC
     LIMIT $3`,
    [symbol, beforeUtcIso, ADR_LOOKBACK_DAYS],
  );

  const adrRanges = rows
    .map((row) => {
      const openPrice = toFinite(row.open_price);
      const highPrice = toFinite(row.high_price);
      const lowPrice = toFinite(row.low_price);
      if (openPrice === null || openPrice <= 0 || highPrice === null || lowPrice === null) return null;
      return ((highPrice - lowPrice) / openPrice) * 100;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (adrRanges.length < ADR_MIN_REQUIRED_DAYS) {
    return null;
  }

  return adrRanges.reduce((sum, value) => sum + value, 0) / adrRanges.length;
}

/* ─── Weekly Baseline Simulation (same as Test 6 variant W) ─── */

function simulateWeeklyBaseline(options: {
  week: string;
  weekLabel: string;
  pair: string;
  direction: Direction;
  assetClass: AssetClass;
  signalMode: SignalMode;
  gateDecision: GateDecision;
  anchorPrice: number;
  adrPct: number;
  bars: OandaHourlyCandle[];
}): FillRecord | null {
  if (options.bars.length === 0) return null;

  const adrDistance = options.anchorPrice * ((options.adrPct * ADR_MULTIPLIER) / 100);
  if (!Number.isFinite(adrDistance) || adrDistance <= 0) return null;

  const entryPrice =
    options.direction === "LONG"
      ? options.anchorPrice - adrDistance
      : options.anchorPrice + adrDistance;
  const tpPrice =
    options.direction === "LONG"
      ? entryPrice * (1 + (TP_MULTIPLIER * options.adrPct) / 100)
      : entryPrice * (1 - (TP_MULTIPLIER * options.adrPct) / 100);

  let fillTs: number | null = null;
  let fillBarIndex = -1;
  let maePrice: number | null = null;

  for (let i = 0; i < options.bars.length; i += 1) {
    const bar = options.bars[i]!;
    if (fillTs === null) {
      const fillHit =
        options.direction === "LONG" ? bar.low <= entryPrice : bar.high >= entryPrice;
      if (!fillHit) continue;

      fillTs = bar.ts;
      fillBarIndex = i;
      maePrice =
        options.direction === "LONG"
          ? Math.min(entryPrice, bar.low)
          : Math.max(entryPrice, bar.high);

      const sameBarTpHit =
        options.direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (sameBarTpHit) {
        return {
          variant: "W",
          week: options.week,
          weekLabel: options.weekLabel,
          pair: options.pair,
          direction: options.direction,
          assetClass: options.assetClass,
          signalMode: options.signalMode,
          gateDecision: options.gateDecision,
          anchorPrice: options.anchorPrice,
          adrPct: options.adrPct,
          entryPrice,
          tpPrice,
          fillBarIndex,
          fillTs,
          exitTs: bar.ts,
          exitPrice: tpPrice,
          returnPct: TP_MULTIPLIER * options.adrPct,
          tpHit: true,
          maePrice,
          maeXAdr: Math.abs(maePrice - entryPrice) / adrDistance,
        };
      }
      continue;
    }

    maePrice =
      options.direction === "LONG"
        ? Math.min(maePrice ?? entryPrice, bar.low)
        : Math.max(maePrice ?? entryPrice, bar.high);

    const tpHit =
      options.direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
    if (tpHit) {
      return {
        variant: "W",
        week: options.week,
        weekLabel: options.weekLabel,
        pair: options.pair,
        direction: options.direction,
        assetClass: options.assetClass,
        signalMode: options.signalMode,
        gateDecision: options.gateDecision,
        anchorPrice: options.anchorPrice,
        adrPct: options.adrPct,
        entryPrice,
        tpPrice,
        fillBarIndex,
        fillTs,
        exitTs: bar.ts,
        exitPrice: tpPrice,
        returnPct: TP_MULTIPLIER * options.adrPct,
        tpHit: true,
        maePrice: maePrice ?? entryPrice,
        maeXAdr: Math.abs((maePrice ?? entryPrice) - entryPrice) / adrDistance,
      };
    }
  }

  if (fillTs === null) return null;

  const lastBar = options.bars[options.bars.length - 1]!;
  const finalMaePrice = maePrice ?? entryPrice;
  return {
    variant: "W",
    week: options.week,
    weekLabel: options.weekLabel,
    pair: options.pair,
    direction: options.direction,
    assetClass: options.assetClass,
    signalMode: options.signalMode,
    gateDecision: options.gateDecision,
    anchorPrice: options.anchorPrice,
    adrPct: options.adrPct,
    entryPrice,
    tpPrice,
    fillBarIndex,
    fillTs,
    exitTs: lastBar.ts,
    exitPrice: lastBar.close,
    returnPct: signedReturnPct(options.direction, entryPrice, lastBar.close),
    tpHit: false,
    maePrice: finalMaePrice,
    maeXAdr: Math.abs(finalMaePrice - entryPrice) / adrDistance,
  };
}

/* ─── Running Extreme State Machine ─── */

type RunningExtremeState =
  | { phase: "TRACKING"; trackingDirection: Direction; anchor: number | null }
  | {
      phase: "IN_TRADE";
      trackingDirection: Direction;
      anchor: number;
      entryPrice: number;
      tpPrice: number;
      fillTs: number;
      fillBarIndex: number;
      maePrice: number;
    }
  | { phase: "WAITING_NEW_EXTREME"; trackingDirection: Direction; oldAnchor: number };

/**
 * Simulate running extreme fills for a single pair-week.
 *
 * For LONG bias: track running high, trigger on 1 ADR pullback
 * For SHORT bias: track running low, trigger on 1 ADR rally
 * For NEUTRAL: track both sides independently
 *
 * Returns fills for variants A, B, and C.
 */
function simulateRunningExtreme(options: {
  week: string;
  weekLabel: string;
  pair: string;
  direction: Direction;
  assetClass: AssetClass;
  signalMode: SignalMode;
  gateDecision: GateDecision;
  adrPct: number;
  bars: OandaHourlyCandle[];
}): { A: FillRecord[]; B: FillRecord[]; C: FillRecord[] } {
  const result: { A: FillRecord[]; B: FillRecord[]; C: FillRecord[] } = { A: [], B: [], C: [] };
  if (options.bars.length === 0 || !Number.isFinite(options.adrPct) || options.adrPct <= 0) {
    return result;
  }

  const adrDistance = (options.bars[0]!.open * options.adrPct * ADR_MULTIPLIER) / 100;
  if (!Number.isFinite(adrDistance) || adrDistance <= 0) return result;

  /* Determine which directions to track */
  const directionsToTrack: Direction[] =
    options.direction === "LONG"
      ? ["LONG"]
      : options.direction === "SHORT"
        ? ["SHORT"]
        : ["LONG", "SHORT"];

  /* For each direction, run all three variant state machines independently */
  for (const trackDir of directionsToTrack) {
    const fillsA = simulateVariantA(trackDir, options, adrDistance);
    const fillsB = simulateVariantB(trackDir, options, adrDistance);
    result.A.push(...fillsA);
    result.B.push(...fillsB);
  }

  /* Variant C: Side Flip — runs as a single state machine that alternates */
  const fillsC = simulateVariantC(options, adrDistance);
  result.C.push(...fillsC);

  return result;
}

function makeFillRecord(
  variant: VariantKey,
  trackDir: Direction,
  anchor: number,
  entryPrice: number,
  tpPrice: number,
  fillTs: number,
  fillBarIndex: number,
  exitTs: number,
  exitPrice: number,
  tpHit: boolean,
  maePrice: number,
  adrDistance: number,
  options: {
    week: string;
    weekLabel: string;
    pair: string;
    assetClass: AssetClass;
    signalMode: SignalMode;
    gateDecision: GateDecision;
    adrPct: number;
  },
): FillRecord {
  const returnPct = tpHit
    ? TP_MULTIPLIER * options.adrPct
    : signedReturnPct(trackDir, entryPrice, exitPrice);
  return {
    variant,
    week: options.week,
    weekLabel: options.weekLabel,
    pair: options.pair,
    direction: trackDir,
    assetClass: options.assetClass,
    signalMode: options.signalMode,
    gateDecision: options.gateDecision,
    anchorPrice: anchor,
    adrPct: options.adrPct,
    entryPrice,
    tpPrice,
    fillBarIndex,
    fillTs,
    exitTs,
    exitPrice: tpHit ? tpPrice : exitPrice,
    returnPct,
    tpHit,
    maePrice,
    maeXAdr: Math.abs(maePrice - entryPrice) / adrDistance,
  };
}

function computeEntryAndTp(
  trackDir: Direction,
  anchor: number,
  adrDistance: number,
  adrPct: number,
): { entryPrice: number; tpPrice: number } {
  const entryPrice =
    trackDir === "LONG" ? anchor - adrDistance : anchor + adrDistance;
  const tpPrice =
    trackDir === "LONG"
      ? entryPrice * (1 + (TP_MULTIPLIER * adrPct) / 100)
      : entryPrice * (1 - (TP_MULTIPLIER * adrPct) / 100);
  return { entryPrice, tpPrice };
}

/**
 * Option A: Fresh Start
 * After any exit (TP or week close), reset anchor to null.
 * Begin tracking new running extreme from the next bar.
 */
function simulateVariantA(
  trackDir: Direction,
  options: {
    week: string;
    weekLabel: string;
    pair: string;
    assetClass: AssetClass;
    signalMode: SignalMode;
    gateDecision: GateDecision;
    adrPct: number;
    bars: OandaHourlyCandle[];
  },
  adrDistance: number,
): FillRecord[] {
  const fills: FillRecord[] = [];
  let anchor: number | null = null;
  let inTrade = false;
  let entryPrice = 0;
  let tpPrice = 0;
  let fillTs = 0;
  let fillBarIndex = 0;
  let maePrice = 0;

  for (let i = 0; i < options.bars.length; i += 1) {
    const bar = options.bars[i]!;

    if (inTrade) {
      /* Update MAE */
      maePrice =
        trackDir === "LONG"
          ? Math.min(maePrice, bar.low)
          : Math.max(maePrice, bar.high);

      /* Check TP */
      const tpHit =
        trackDir === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (tpHit) {
        fills.push(
          makeFillRecord("A", trackDir, anchor!, entryPrice, tpPrice, fillTs, fillBarIndex, bar.ts, tpPrice, true, maePrice, adrDistance, options),
        );
        inTrade = false;
        anchor = null; /* Fresh start */
        continue;
      }
      continue;
    }

    /* TRACKING phase: update running extreme */
    if (anchor === null) {
      /* First bar after reset: seed anchor */
      anchor = trackDir === "LONG" ? bar.high : bar.low;
    } else {
      anchor =
        trackDir === "LONG"
          ? Math.max(anchor, bar.high)
          : Math.min(anchor, bar.low);
    }

    /* Check if price has moved 1 ADR away from anchor */
    const { entryPrice: ep, tpPrice: tp } = computeEntryAndTp(trackDir, anchor, adrDistance, options.adrPct);
    const triggerHit =
      trackDir === "LONG" ? bar.low <= ep : bar.high >= ep;

    if (triggerHit) {
      entryPrice = ep;
      tpPrice = tp;
      fillTs = bar.ts;
      fillBarIndex = i;
      inTrade = true;
      maePrice = trackDir === "LONG" ? Math.min(ep, bar.low) : Math.max(ep, bar.high);

      /* Check same-bar TP */
      const sameBarTp =
        trackDir === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (sameBarTp) {
        fills.push(
          makeFillRecord("A", trackDir, anchor, entryPrice, tpPrice, fillTs, fillBarIndex, bar.ts, tpPrice, true, maePrice, adrDistance, options),
        );
        inTrade = false;
        anchor = null; /* Fresh start */
      }
    }
  }

  /* Week close: close any open trade */
  if (inTrade && options.bars.length > 0) {
    const lastBar = options.bars[options.bars.length - 1]!;
    fills.push(
      makeFillRecord("A", trackDir, anchor!, entryPrice, tpPrice, fillTs, fillBarIndex, lastBar.ts, lastBar.close, false, maePrice, adrDistance, options),
    );
  }

  return fills;
}

/**
 * Option B: Consumed Trigger
 * After exit, anchor stays at its current value but is marked "used."
 * It cannot trigger again. The anchor only resets when price makes a new
 * extreme BEYOND the old anchor value.
 */
function simulateVariantB(
  trackDir: Direction,
  options: {
    week: string;
    weekLabel: string;
    pair: string;
    assetClass: AssetClass;
    signalMode: SignalMode;
    gateDecision: GateDecision;
    adrPct: number;
    bars: OandaHourlyCandle[];
  },
  adrDistance: number,
): FillRecord[] {
  const fills: FillRecord[] = [];
  let anchor: number | null = null;
  let anchorUsed = false;
  let inTrade = false;
  let entryPrice = 0;
  let tpPrice = 0;
  let fillTs = 0;
  let fillBarIndex = 0;
  let maePrice = 0;

  for (let i = 0; i < options.bars.length; i += 1) {
    const bar = options.bars[i]!;

    if (inTrade) {
      maePrice =
        trackDir === "LONG"
          ? Math.min(maePrice, bar.low)
          : Math.max(maePrice, bar.high);

      const tpHit =
        trackDir === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (tpHit) {
        fills.push(
          makeFillRecord("B", trackDir, anchor!, entryPrice, tpPrice, fillTs, fillBarIndex, bar.ts, tpPrice, true, maePrice, adrDistance, options),
        );
        inTrade = false;
        anchorUsed = true; /* Mark anchor as consumed */
        continue;
      }
      continue;
    }

    /* TRACKING / WAITING_NEW_EXTREME phase */
    if (anchor === null) {
      anchor = trackDir === "LONG" ? bar.high : bar.low;
      anchorUsed = false;
    } else {
      const newExtreme =
        trackDir === "LONG" ? bar.high > anchor : bar.low < anchor;
      if (newExtreme) {
        anchor = trackDir === "LONG" ? bar.high : bar.low;
        anchorUsed = false; /* New extreme beyond old anchor resets the "used" flag */
      }
    }

    /* Only trigger if anchor is not consumed */
    if (anchorUsed) continue;

    const { entryPrice: ep, tpPrice: tp } = computeEntryAndTp(trackDir, anchor, adrDistance, options.adrPct);
    const triggerHit =
      trackDir === "LONG" ? bar.low <= ep : bar.high >= ep;

    if (triggerHit) {
      entryPrice = ep;
      tpPrice = tp;
      fillTs = bar.ts;
      fillBarIndex = i;
      inTrade = true;
      maePrice = trackDir === "LONG" ? Math.min(ep, bar.low) : Math.max(ep, bar.high);

      const sameBarTp =
        trackDir === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (sameBarTp) {
        fills.push(
          makeFillRecord("B", trackDir, anchor, entryPrice, tpPrice, fillTs, fillBarIndex, bar.ts, tpPrice, true, maePrice, adrDistance, options),
        );
        inTrade = false;
        anchorUsed = true;
      }
    }
  }

  /* Week close */
  if (inTrade && options.bars.length > 0) {
    const lastBar = options.bars[options.bars.length - 1]!;
    fills.push(
      makeFillRecord("B", trackDir, anchor!, entryPrice, tpPrice, fillTs, fillBarIndex, lastBar.ts, lastBar.close, false, maePrice, adrDistance, options),
    );
  }

  return fills;
}

/**
 * Option C: Side Flip
 * After a LONG trigger from a running high, the low near the fill becomes
 * the anchor for measuring a SHORT trigger upward, and vice versa.
 * If bias gate blocks the flipped direction, degenerate to Option A behavior.
 */
function simulateVariantC(
  options: {
    week: string;
    weekLabel: string;
    pair: string;
    direction: Direction;
    assetClass: AssetClass;
    signalMode: SignalMode;
    gateDecision: GateDecision;
    adrPct: number;
    bars: OandaHourlyCandle[];
  },
  adrDistance: number,
): FillRecord[] {
  const fills: FillRecord[] = [];

  /* Determine allowed directions */
  const allowLong = options.direction !== "SHORT";
  const allowShort = options.direction !== "LONG";

  /* Determine initial tracking direction */
  let trackDir: Direction | null = null;
  if (allowLong && allowShort) {
    /* NEUTRAL: start by tracking both, pick whichever triggers first.
       For simplicity, run two parallel trackers until the first trigger. */
    trackDir = null; /* Will be resolved below */
  } else if (allowLong) {
    trackDir = "LONG";
  } else {
    trackDir = "SHORT";
  }

  let anchor: number | null = null;
  let inTrade = false;
  let entryPrice = 0;
  let tpPrice = 0;
  let fillTs = 0;
  let fillBarIndex = 0;
  let maePrice = 0;
  let currentTradeDir: Direction = "LONG";

  /* For NEUTRAL initial phase: track both sides until one triggers */
  let longAnchor: number | null = null;
  let shortAnchor: number | null = null;
  let resolvedInitial = trackDir !== null;

  for (let i = 0; i < options.bars.length; i += 1) {
    const bar = options.bars[i]!;

    if (inTrade) {
      maePrice =
        currentTradeDir === "LONG"
          ? Math.min(maePrice, bar.low)
          : Math.max(maePrice, bar.high);

      const tpHit =
        currentTradeDir === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (tpHit) {
        fills.push(
          makeFillRecord("C", currentTradeDir, anchor!, entryPrice, tpPrice, fillTs, fillBarIndex, bar.ts, tpPrice, true, maePrice, adrDistance, options),
        );
        inTrade = false;

        /* Flip: the exit area becomes the anchor for the opposite side */
        const flippedDir: Direction = currentTradeDir === "LONG" ? "SHORT" : "LONG";
        const flipAllowed =
          (flippedDir === "LONG" && allowLong) || (flippedDir === "SHORT" && allowShort);

        if (flipAllowed) {
          trackDir = flippedDir;
          /* Use the extreme near the fill as the new anchor */
          anchor =
            currentTradeDir === "LONG"
              ? bar.low /* Low near TP hit becomes SHORT anchor */
              : bar.high; /* High near TP hit becomes LONG anchor */
          resolvedInitial = true;
        } else {
          /* Bias blocks flip — degenerate to fresh start in same direction */
          trackDir = currentTradeDir;
          anchor = null;
          resolvedInitial = true;
        }
        continue;
      }
      continue;
    }

    /* Not in trade — tracking phase */
    if (!resolvedInitial) {
      /* NEUTRAL: track both sides until one triggers */
      longAnchor = longAnchor === null ? bar.high : Math.max(longAnchor, bar.high);
      shortAnchor = shortAnchor === null ? bar.low : Math.min(shortAnchor, bar.low);

      /* Check LONG trigger (pullback from high) */
      const longEntry = longAnchor - adrDistance;
      const longTrigger = bar.low <= longEntry;

      /* Check SHORT trigger (rally from low) */
      const shortEntry = shortAnchor + adrDistance;
      const shortTrigger = bar.high >= shortEntry;

      if (longTrigger && allowLong) {
        trackDir = "LONG";
        anchor = longAnchor;
        resolvedInitial = true;
        const { entryPrice: ep, tpPrice: tp } = computeEntryAndTp("LONG", anchor, adrDistance, options.adrPct);
        entryPrice = ep;
        tpPrice = tp;
        fillTs = bar.ts;
        fillBarIndex = i;
        currentTradeDir = "LONG";
        inTrade = true;
        maePrice = Math.min(ep, bar.low);

        const sameBarTp = bar.high >= tpPrice;
        if (sameBarTp) {
          fills.push(
            makeFillRecord("C", "LONG", anchor, entryPrice, tpPrice, fillTs, fillBarIndex, bar.ts, tpPrice, true, maePrice, adrDistance, options),
          );
          inTrade = false;
          const flipAllowed = allowShort;
          if (flipAllowed) {
            trackDir = "SHORT";
            anchor = bar.low;
          } else {
            trackDir = "LONG";
            anchor = null;
          }
        }
        continue;
      }

      if (shortTrigger && allowShort) {
        trackDir = "SHORT";
        anchor = shortAnchor;
        resolvedInitial = true;
        const { entryPrice: ep, tpPrice: tp } = computeEntryAndTp("SHORT", anchor, adrDistance, options.adrPct);
        entryPrice = ep;
        tpPrice = tp;
        fillTs = bar.ts;
        fillBarIndex = i;
        currentTradeDir = "SHORT";
        inTrade = true;
        maePrice = Math.max(ep, bar.high);

        const sameBarTp = bar.low <= tpPrice;
        if (sameBarTp) {
          fills.push(
            makeFillRecord("C", "SHORT", anchor, entryPrice, tpPrice, fillTs, fillBarIndex, bar.ts, tpPrice, true, maePrice, adrDistance, options),
          );
          inTrade = false;
          const flipAllowed = allowLong;
          if (flipAllowed) {
            trackDir = "LONG";
            anchor = bar.high;
          } else {
            trackDir = "SHORT";
            anchor = null;
          }
        }
        continue;
      }
      continue;
    }

    /* Resolved direction: single-direction tracking */
    if (anchor === null) {
      anchor = trackDir === "LONG" ? bar.high : bar.low;
    } else {
      anchor =
        trackDir === "LONG"
          ? Math.max(anchor, bar.high)
          : Math.min(anchor, bar.low);
    }

    const { entryPrice: ep, tpPrice: tp } = computeEntryAndTp(trackDir!, anchor, adrDistance, options.adrPct);
    const triggerHit =
      trackDir === "LONG" ? bar.low <= ep : bar.high >= ep;

    if (triggerHit) {
      entryPrice = ep;
      tpPrice = tp;
      fillTs = bar.ts;
      fillBarIndex = i;
      currentTradeDir = trackDir!;
      inTrade = true;
      maePrice = trackDir === "LONG" ? Math.min(ep, bar.low) : Math.max(ep, bar.high);

      const sameBarTp =
        trackDir === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
      if (sameBarTp) {
        fills.push(
          makeFillRecord("C", currentTradeDir, anchor, entryPrice, tpPrice, fillTs, fillBarIndex, bar.ts, tpPrice, true, maePrice, adrDistance, options),
        );
        inTrade = false;

        const flippedDir: Direction = currentTradeDir === "LONG" ? "SHORT" : "LONG";
        const flipAllowed =
          (flippedDir === "LONG" && allowLong) || (flippedDir === "SHORT" && allowShort);
        if (flipAllowed) {
          trackDir = flippedDir;
          anchor =
            currentTradeDir === "LONG" ? bar.low : bar.high;
        } else {
          anchor = null;
        }
      }
    }
  }

  /* Week close */
  if (inTrade && options.bars.length > 0) {
    const lastBar = options.bars[options.bars.length - 1]!;
    fills.push(
      makeFillRecord("C", currentTradeDir, anchor!, entryPrice, tpPrice, fillTs, fillBarIndex, lastBar.ts, lastBar.close, false, maePrice, adrDistance, options),
    );
  }

  return fills;
}

/* ─── Report Building ─── */

function getAllFills(records: PairWeekRecord[], variant: VariantKey): FillRecord[] {
  if (variant === "W") {
    return records.map((r) => r.weeklyFill).filter((f): f is FillRecord => f !== null);
  }
  return records.flatMap((r) => r.variantFills[variant as "A" | "B" | "C"]);
}

function buildVariantSummary(records: PairWeekRecord[], variant: VariantKey): VariantSummary {
  const fills = getAllFills(records, variant);
  const returns = fills.map((f) => f.returnPct);
  const maeValues = fills.map((f) => f.maeXAdr);

  let eligibleSignals: number;
  let totalSignals: number;
  if (variant === "W") {
    totalSignals = records.length;
    eligibleSignals = records.filter((r) => r.weeklyEligible).length;
  } else {
    totalSignals = records.length;
    eligibleSignals = records.filter((r) => r.variantEligible).length;
  }

  const weeks = [...new Set(records.map((r) => r.week))];
  const losingWeeks = weeks.filter((week) => {
    const weekReturn = fills
      .filter((f) => f.week === week)
      .reduce((sum, f) => sum + f.returnPct, 0);
    return weekReturn < 0;
  }).length;

  /* Avg fills per pair-week (for running extreme variants) */
  const pairWeeksWithFills = records.filter((r) =>
    variant === "W" ? r.weeklyFill !== null : r.variantFills[variant as "A" | "B" | "C"].length > 0,
  ).length;

  return {
    totalSignals,
    eligibleSignals,
    totalFills: fills.length,
    fillRate: eligibleSignals > 0 ? (fills.length / eligibleSignals) * 100 : null,
    avgReturnPerFill: average(returns),
    totalReturn: fills.length > 0 ? returns.reduce((sum, v) => sum + v, 0) : null,
    winRate: fills.length > 0 ? (fills.filter((f) => f.returnPct > 0).length / fills.length) * 100 : null,
    tpHitRate: fills.length > 0 ? (fills.filter((f) => f.tpHit).length / fills.length) * 100 : null,
    avgMaeXAdr: average(maeValues),
    p95MaeXAdr: quantile(maeValues, 0.95),
    losingWeeks,
    avgFillsPerPairWeek: eligibleSignals > 0 ? fills.length / eligibleSignals : null,
  };
}

function buildSummaryRows(records: PairWeekRecord[]): string[][] {
  const variants: VariantKey[] = ["W", "A", "B", "C"];
  const summaries = variants.map((v) => buildVariantSummary(records, v));

  const metricRows: Array<[string, (s: VariantSummary) => string]> = [
    ["Total signals", (s) => String(s.totalSignals)],
    ["Eligible signals", (s) => String(s.eligibleSignals)],
    ["Total fills", (s) => String(s.totalFills)],
    ["Avg fills/pair-week", (s) => fmtNum(s.avgFillsPerPairWeek)],
    ["Fill rate", (s) => fmtRate(s.fillRate)],
    ["Avg return/fill", (s) => fmtPct(s.avgReturnPerFill)],
    ["Total return", (s) => fmtPct(s.totalReturn)],
    ["Win rate", (s) => fmtRate(s.winRate)],
    ["TP hit rate", (s) => fmtRate(s.tpHitRate)],
    ["Avg MAE (xADR)", (s) => fmtNum(s.avgMaeXAdr)],
    ["P95 MAE (xADR)", (s) => fmtNum(s.p95MaeXAdr)],
    ["Losing weeks", (s) => String(s.losingWeeks)],
  ];

  return metricRows.map(([label, fn]) => [label, ...summaries.map(fn)]);
}

function buildPerWeekRows(records: PairWeekRecord[], weeks: string[]): string[][] {
  const variants: VariantKey[] = ["W", "A", "B", "C"];
  return weeks.map((week) => {
    const cells: string[] = [weekLabelFn(week)];
    for (const variant of variants) {
      const fills = getAllFills(records, variant).filter((f) => f.week === week);
      const ret = fills.reduce((sum, f) => sum + f.returnPct, 0);
      cells.push(String(fills.length));
      cells.push(fmtPct(fills.length > 0 ? ret : 0));
    }
    return cells;
  });
}

function buildAssetClassRows(records: PairWeekRecord[]): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  const variants: VariantKey[] = ["W", "A", "B", "C"];
  return assetClasses.map((ac) => {
    const cells: string[] = [ac];
    for (const variant of variants) {
      const fills = getAllFills(records, variant).filter((f) => f.assetClass === ac);
      const ret = fills.reduce((sum, f) => sum + f.returnPct, 0);
      cells.push(String(fills.length));
      cells.push(fmtPct(fills.length > 0 ? ret : 0));
    }
    return cells;
  });
}

function buildMaeDistributionRows(fills: FillRecord[]): string[][] {
  return MAE_BUCKETS.map((bucket) => {
    const bucketFills = fills.filter((f) =>
      bucket.max === Number.POSITIVE_INFINITY
        ? f.maeXAdr >= bucket.min
        : f.maeXAdr >= bucket.min && f.maeXAdr < bucket.max,
    );
    const avgReturn = average(bucketFills.map((f) => f.returnPct));
    const winRate =
      bucketFills.length > 0
        ? (bucketFills.filter((f) => f.returnPct > 0).length / bucketFills.length) * 100
        : null;
    return [
      bucket.label,
      String(bucketFills.length),
      fmtRate(fills.length > 0 ? (bucketFills.length / fills.length) * 100 : null),
      fmtPct(avgReturn),
      fmtRate(winRate),
    ];
  });
}

function buildGateSplitSections(records: PairWeekRecord[]): string[] {
  const sections: string[] = [];
  const modes: Array<{ key: SignalMode; title: string }> = [
    { key: "GATED", title: "GATED (PASS / NO_DATA)" },
    { key: "NON_GATED", title: "NON_GATED (SKIP / REDUCE)" },
  ];

  for (const mode of modes) {
    const modeRecords = records.filter((r) => r.signalMode === mode.key);
    sections.push(`### ${mode.title}`);
    sections.push("");
    sections.push(
      renderMarkdownTable(
        ["Metric", "Weekly (W)", "Fresh Start (A)", "Consumed (B)", "Side Flip (C)"],
        buildSummaryRows(modeRecords),
      ),
    );
    sections.push("");
  }

  return sections;
}

function buildFillFrequencyRows(records: PairWeekRecord[], variant: "A" | "B" | "C"): string[][] {
  const pairMap = new Map<string, { signalWeeks: Set<string>; fills: FillRecord[] }>();

  for (const record of records) {
    if (!pairMap.has(record.pair)) {
      pairMap.set(record.pair, { signalWeeks: new Set(), fills: [] });
    }
    pairMap.get(record.pair)!.signalWeeks.add(record.week);
  }

  for (const fill of getAllFills(records, variant)) {
    if (!pairMap.has(fill.pair)) {
      pairMap.set(fill.pair, { signalWeeks: new Set(), fills: [] });
    }
    pairMap.get(fill.pair)!.fills.push(fill);
  }

  return [...pairMap.entries()]
    .map(([pair, data]) => {
      const filledWeeks = new Set(data.fills.map((f) => f.week));
      const avgPerSignalWeek = data.signalWeeks.size > 0 ? data.fills.length / data.signalWeeks.size : -1;
      return {
        avgPerSignalWeek,
        cells: [
          pair,
          String(data.signalWeeks.size),
          String(data.fills.length),
          fmtNum(avgPerSignalWeek >= 0 ? avgPerSignalWeek : null),
          String(filledWeeks.size),
          fmtNum(filledWeeks.size > 0 ? data.fills.length / filledWeeks.size : null),
        ],
      };
    })
    .sort((a, b) => b.avgPerSignalWeek - a.avgPerSignalWeek || a.cells[0]!.localeCompare(b.cells[0]!))
    .map((r) => r.cells);
}

/* ─── Enhanced Analysis Builders (Option A Deep Dive) ─── */

function buildOptionAAssetClassDeepDive(records: PairWeekRecord[]): string[] {
  const fills = getAllFills(records, "A");
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  const sections: string[] = [];
  sections.push("## Option A — Per-Asset-Class Deep Dive");
  sections.push("");

  const headers = [
    "Asset Class", "Fills", "Win Rate", "Avg Return", "Total Return",
    "Avg MAE (xADR)", "P95 MAE (xADR)", "Max MAE (xADR)",
    "Max Consec Losses", "Peak Drawdown",
  ];

  const rows: string[][] = [];
  for (const ac of assetClasses) {
    const acFills = fills.filter((f) => f.assetClass === ac);
    if (acFills.length === 0) {
      rows.push([ac, "0", "\u2014", "\u2014", "\u2014", "\u2014", "\u2014", "\u2014", "\u2014", "\u2014"]);
      continue;
    }
    const returns = acFills.map((f) => f.returnPct);
    const maeValues = acFills.map((f) => f.maeXAdr);
    const winRate = (acFills.filter((f) => f.returnPct > 0).length / acFills.length) * 100;
    const totalReturn = returns.reduce((sum, v) => sum + v, 0);

    /* Max consecutive losses */
    let maxConsecLoss = 0;
    let currentStreak = 0;
    const sortedByTime = [...acFills].sort((a, b) => a.fillTs - b.fillTs);
    for (const f of sortedByTime) {
      if (f.returnPct <= 0) {
        currentStreak += 1;
        maxConsecLoss = Math.max(maxConsecLoss, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    /* Peak drawdown (sequential equity curve) */
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const f of sortedByTime) {
      equity += f.returnPct;
      if (equity > peak) peak = equity;
      const dd = equity - peak;
      if (dd < maxDrawdown) maxDrawdown = dd;
    }

    rows.push([
      ac,
      String(acFills.length),
      fmtRate(winRate),
      fmtPct(average(returns)),
      fmtPct(totalReturn),
      fmtNum(average(maeValues)),
      fmtNum(quantile(maeValues, 0.95)),
      fmtNum(Math.max(...maeValues)),
      String(maxConsecLoss),
      fmtPct(maxDrawdown),
    ]);
  }

  sections.push(renderMarkdownTable(headers, rows));
  sections.push("");
  return sections;
}

function buildEquityCurveSection(records: PairWeekRecord[]): string[] {
  const fills = getAllFills(records, "A");
  const sortedFills = [...fills].sort((a, b) => a.fillTs - b.fillTs);
  const sections: string[] = [];
  sections.push("## Option A — Equity Curve & Drawdown");
  sections.push("");

  /* Per-week equity curve */
  const weeks = [...new Set(fills.map((f) => f.week))].sort();
  let cumReturn = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownWeek = "";

  const headers = ["Week", "Fills", "Week Return", "Cumulative Return", "Peak", "Drawdown"];
  const rows: string[][] = [];

  for (const week of weeks) {
    const weekFills = sortedFills.filter((f) => f.week === week);
    const weekReturn = weekFills.reduce((sum, f) => sum + f.returnPct, 0);
    cumReturn += weekReturn;
    if (cumReturn > peak) peak = cumReturn;
    const dd = cumReturn - peak;
    if (dd < maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownWeek = weekLabelFn(week);
    }
    rows.push([
      weekLabelFn(week),
      String(weekFills.length),
      fmtPct(weekReturn),
      fmtPct(cumReturn),
      fmtPct(peak),
      fmtPct(dd),
    ]);
  }

  sections.push(renderMarkdownTable(headers, rows));
  sections.push("");
  sections.push(`**Max Peak-to-Trough Drawdown**: ${fmtPct(maxDrawdown)} (week of ${maxDrawdownWeek || "N/A"})`);
  sections.push(`**Final Cumulative Return**: ${fmtPct(cumReturn)}`);
  sections.push(`**Recovery**: ${maxDrawdown === 0 ? "No drawdown" : cumReturn >= peak ? "Fully recovered" : "Still in drawdown"}`);
  sections.push("");
  return sections;
}

function buildPerPairPerformance(records: PairWeekRecord[]): string[] {
  const fills = getAllFills(records, "A");
  const sections: string[] = [];
  sections.push("## Option A — Per-Pair Performance");
  sections.push("");

  const pairMap = new Map<string, { fills: FillRecord[]; assetClass: AssetClass }>();
  for (const f of fills) {
    if (!pairMap.has(f.pair)) pairMap.set(f.pair, { fills: [], assetClass: f.assetClass });
    pairMap.get(f.pair)!.fills.push(f);
  }

  const headers = [
    "Pair", "Class", "Fills", "Win Rate", "Avg Return", "Total Return",
    "Avg MAE (xADR)", "P95 MAE (xADR)", "Max Consec Loss",
  ];

  const rows = [...pairMap.entries()]
    .map(([pair, data]) => {
      const returns = data.fills.map((f) => f.returnPct);
      const maeValues = data.fills.map((f) => f.maeXAdr);
      const winRate = data.fills.length > 0
        ? (data.fills.filter((f) => f.returnPct > 0).length / data.fills.length) * 100
        : null;
      const totalReturn = returns.reduce((sum, v) => sum + v, 0);

      let maxConsecLoss = 0;
      let streak = 0;
      const sorted = [...data.fills].sort((a, b) => a.fillTs - b.fillTs);
      for (const f of sorted) {
        if (f.returnPct <= 0) { streak += 1; maxConsecLoss = Math.max(maxConsecLoss, streak); }
        else { streak = 0; }
      }

      return {
        totalReturn,
        cells: [
          pair, data.assetClass, String(data.fills.length), fmtRate(winRate),
          fmtPct(average(returns)), fmtPct(totalReturn),
          fmtNum(average(maeValues)), fmtNum(quantile(maeValues, 0.95)),
          String(maxConsecLoss),
        ],
      };
    })
    .sort((a, b) => b.totalReturn - a.totalReturn)
    .map((r) => r.cells);

  sections.push(renderMarkdownTable(headers, rows));
  sections.push("");
  return sections;
}

function buildWorstFills(records: PairWeekRecord[]): string[] {
  const fills = getAllFills(records, "A");
  const sections: string[] = [];
  sections.push("## Option A — Worst 10 Fills");
  sections.push("");

  const sorted = [...fills].sort((a, b) => a.returnPct - b.returnPct).slice(0, 10);
  const headers = ["Pair", "Week", "Direction", "Return", "MAE (xADR)", "TP Hit", "Gate"];
  const rows = sorted.map((f) => [
    f.pair,
    weekLabelFn(f.week),
    f.direction,
    fmtPct(f.returnPct),
    fmtNum(f.maeXAdr),
    f.tpHit ? "Yes" : "No",
    f.gateDecision,
  ]);

  sections.push(renderMarkdownTable(headers, rows));
  sections.push("");
  return sections;
}

function buildConsecutiveLossAnalysis(records: PairWeekRecord[]): string[] {
  const fills = getAllFills(records, "A");
  const sections: string[] = [];
  sections.push("## Option A — Consecutive Loss Analysis");
  sections.push("");

  const sortedAll = [...fills].sort((a, b) => a.fillTs - b.fillTs);

  /* Overall */
  let maxConsecLoss = 0;
  let streak = 0;
  let maxStreakReturnSum = 0;
  let currentStreakReturn = 0;
  for (const f of sortedAll) {
    if (f.returnPct <= 0) {
      streak += 1;
      currentStreakReturn += f.returnPct;
      if (streak > maxConsecLoss) {
        maxConsecLoss = streak;
        maxStreakReturnSum = currentStreakReturn;
      }
    } else {
      streak = 0;
      currentStreakReturn = 0;
    }
  }

  sections.push(`**Overall max consecutive losses**: ${maxConsecLoss} (total impact: ${fmtPct(maxStreakReturnSum)})`);
  sections.push(`**Total losing fills**: ${fills.filter((f) => f.returnPct <= 0).length} of ${fills.length} (${fmtRate((fills.filter((f) => f.returnPct <= 0).length / fills.length) * 100)})`);
  sections.push("");

  /* Per asset class */
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  const acHeaders = ["Asset Class", "Max Consec Losses", "Streak Impact", "Total Losses", "Loss Rate"];
  const acRows: string[][] = [];
  for (const ac of assetClasses) {
    const acFills = [...fills.filter((f) => f.assetClass === ac)].sort((a, b) => a.fillTs - b.fillTs);
    if (acFills.length === 0) {
      acRows.push([ac, "\u2014", "\u2014", "\u2014", "\u2014"]);
      continue;
    }
    let acMax = 0;
    let acStreak = 0;
    let acStreakReturn = 0;
    let acMaxReturn = 0;
    for (const f of acFills) {
      if (f.returnPct <= 0) {
        acStreak += 1;
        acStreakReturn += f.returnPct;
        if (acStreak > acMax) { acMax = acStreak; acMaxReturn = acStreakReturn; }
      } else { acStreak = 0; acStreakReturn = 0; }
    }
    const losses = acFills.filter((f) => f.returnPct <= 0).length;
    acRows.push([
      ac, String(acMax), fmtPct(acMaxReturn),
      String(losses), fmtRate((losses / acFills.length) * 100),
    ]);
  }
  sections.push(renderMarkdownTable(acHeaders, acRows));
  sections.push("");
  return sections;
}

function buildPositionSizingScenarios(records: PairWeekRecord[]): string[] {
  const fills = getAllFills(records, "A");
  const sections: string[] = [];
  sections.push("## Position Sizing Scenarios — Option A");
  sections.push("");
  sections.push("Simulations assume each fill risks `Risk%` of account equity, with stop at `Stop (xADR)` distance.");
  sections.push("Return per fill is actual backtest return, scaled by (riskPct / stopDistance).");
  sections.push("");

  const sortedFills = [...fills].sort((a, b) => a.fillTs - b.fillTs);
  const riskPcts = [0.25, 0.5, 1.0, 1.5, 2.0];
  const stopDistances = [0.5, 0.75, 1.0, 1.25, 1.5]; /* xADR */

  const headers = ["Risk %", "Stop (xADR)", "Final Equity", "Max DD", "Max DD %", "Avg Fill P/L $", "Worst Week"];

  const rows: string[][] = [];
  for (const riskPct of riskPcts) {
    for (const stopXAdr of stopDistances) {
      let equity = 10000;
      let peak = 10000;
      let maxDd = 0;
      let maxDdPct = 0;
      let totalPl = 0;

      /* Track weekly returns for worst week calc */
      const weekEquity = new Map<string, number>();

      for (const f of sortedFills) {
        /* Position size: risk riskPct of equity at stopXAdr distance */
        /* Actual P/L scales: if returnPct = +0.25% with 1x ADR entry, and we risk riskPct at stopXAdr,
           the dollar P/L = equity * riskPct/100 * (returnPct / (adrPct * stopXAdr)) * 100 */
        /* Simplified: the return on equity = riskPct * (returnPct / (f.adrPct * stopXAdr)) */
        const stopPct = f.adrPct * stopXAdr;
        if (stopPct <= 0) continue;
        const equityReturnPct = (riskPct / 100) * (f.returnPct / stopPct) * 100;
        const pl = equity * equityReturnPct / 100;
        equity += pl;
        totalPl += pl;

        if (!weekEquity.has(f.week)) weekEquity.set(f.week, 0);
        weekEquity.set(f.week, weekEquity.get(f.week)! + pl);

        if (equity > peak) peak = equity;
        const dd = equity - peak;
        if (dd < maxDd) {
          maxDd = dd;
          maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
        }
      }

      const worstWeekPl = weekEquity.size > 0
        ? Math.min(...[...weekEquity.values()])
        : 0;

      rows.push([
        `${riskPct}%`,
        `${stopXAdr}x`,
        `$${equity.toFixed(0)}`,
        `$${maxDd.toFixed(0)}`,
        fmtPct(maxDdPct),
        `$${(totalPl / sortedFills.length).toFixed(2)}`,
        `$${worstWeekPl.toFixed(0)}`,
      ]);
    }
  }

  sections.push(renderMarkdownTable(headers, rows));
  sections.push("");
  sections.push("Starting equity: $10,000. Fills processed chronologically.");
  sections.push("Formula: `equityReturn = (riskPct / stopPct) * fillReturn` where `stopPct = adrPct * stopXAdr`.");
  sections.push("");
  return sections;
}

function buildMarkdownReport(options: {
  records: PairWeekRecord[];
  weeks: string[];
  generatedAtIso: string;
}): string {
  const variantHeaders = ["Metric", "Weekly (W)", "Fresh Start (A)", "Consumed (B)", "Side Flip (C)"];
  const perWeekHeaders = [
    "Week",
    "W Fills", "W Return",
    "A Fills", "A Return",
    "B Fills", "B Return",
    "C Fills", "C Return",
  ];
  const acHeaders = [
    "Asset Class",
    "W Fills", "W Return",
    "A Fills", "A Return",
    "B Fills", "B Return",
    "C Fills", "C Return",
  ];

  const sections = [
    "# ADR Dip Running Extreme — Test 7",
    "",
    `Generated: ${options.generatedAtIso}`,
    `Week range: ${weekLabelFn(options.weeks[0]!)} -> ${weekLabelFn(options.weeks[options.weeks.length - 1]!)}`,
    "Script: `scripts/adr-dip-running-extreme.ts`",
    "",
    "## Variant Legend",
    "",
    "- **W**: Weekly baseline — one fill per pair per week, anchored to weekly open",
    "- **A**: Fresh Start — running extreme, reset anchor after each exit",
    "- **B**: Consumed Trigger — running extreme, anchor stays but cannot re-trigger until new extreme beyond old",
    "- **C**: Side Flip — running extreme, after exit the fill area becomes the anchor for the opposite direction",
    "",
    "## Summary Comparison",
    "",
    renderMarkdownTable(variantHeaders, buildSummaryRows(options.records)),
    "",
    "## Per-Week Comparison",
    "",
    renderMarkdownTable(perWeekHeaders, buildPerWeekRows(options.records, options.weeks)),
    "",
    "## Per-Asset-Class Breakdown",
    "",
    renderMarkdownTable(acHeaders, buildAssetClassRows(options.records)),
    "",
  ];

  /* MAE distribution per variant */
  const variantKeys: VariantKey[] = ["W", "A", "B", "C"];
  const variantLabels: Record<VariantKey, string> = {
    W: "Weekly (W)",
    A: "Fresh Start (A)",
    B: "Consumed (B)",
    C: "Side Flip (C)",
  };
  for (const vk of variantKeys) {
    const fills = getAllFills(options.records, vk);
    sections.push(`## MAE Distribution — ${variantLabels[vk]}`);
    sections.push("");
    sections.push(
      renderMarkdownTable(
        ["MAE Bucket (xADR)", "Fills", "% of Total", "Avg Return", "Win Rate"],
        buildMaeDistributionRows(fills),
      ),
    );
    sections.push("");
  }

  /* Fill frequency for variant A (most signals expected) */
  sections.push("## Fill Frequency Analysis — Fresh Start (A)");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Pair", "Signal Weeks", "Total Fills", "Avg Fills/Signal Week", "Weeks w/ Fill", "Avg Fills/Filled Week"],
      buildFillFrequencyRows(options.records, "A"),
    ),
  );
  sections.push("");

  /* Gate split */
  sections.push("## Gated Vs Non-Gated Split");
  sections.push("");
  sections.push(...buildGateSplitSections(options.records));

  /* Option A deep dive sections */
  sections.push(...buildOptionAAssetClassDeepDive(options.records));
  sections.push(...buildEquityCurveSection(options.records));
  sections.push(...buildPerPairPerformance(options.records));
  sections.push(...buildWorstFills(options.records));
  sections.push(...buildConsecutiveLossAnalysis(options.records));
  sections.push(...buildPositionSizingScenarios(options.records));

  /* Notes */
  sections.push("## Notes");
  sections.push("");
  sections.push("- Weekly baseline uses one fill maximum per pair per week from weekly open. No re-entries.");
  sections.push("- Running extreme variants track H1 bar highs/lows within each week to form dynamic anchors.");
  sections.push("- All variants use weekly scope boundary: anchor resets at each canonical week open.");
  sections.push("- ADR: 10-day lookback, 5-day minimum, recalculated at week boundary.");
  sections.push("- Trigger: 1.0x ADR from running extreme. TP: 0.25x ADR from fill price. Exit: TP or week close.");
  sections.push("- LONG bias tracks running highs (pullback entries). SHORT bias tracks running lows (rally entries).");
  sections.push("- NEUTRAL pairs: A/B track both sides independently. C alternates via side flip.");
  sections.push("- Direction source: Tiered V3 weekly system.");
  sections.push("");

  return sections.join("\n");
}

/* ─── Main ─── */

async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  const generatedAtIso = DateTime.utc().toISO() ?? new Date().toISOString();

  console.log("\nADR Dip Running Extreme — Test 7");
  console.log(`${weekOpens.length} completed weeks | W vs A vs B vs C | H1 execution\n`);

  console.log("Loading gate artifacts...");
  const gateMap = buildGateMap();
  const cotContext = await buildCotGateContext();
  console.log("Ready.\n");

  const records: PairWeekRecord[] = [];

  for (let weekIndex = 0; weekIndex < weekOpens.length; weekIndex += 1) {
    const weekOpenUtc = weekOpens[weekIndex]!;
    const label = weekLabelFn(weekOpenUtc);
    console.log(`Processing week ${weekIndex + 1}/${weekOpens.length}: ${label} (${weekOpenUtc})...`);

    let computed;
    try {
      computed = await computeTieredWeekForSystem({ weekOpenUtc, system: "v3" });
    } catch (error) {
      console.log(`  Failed to compute tiered week: ${error}`);
      continue;
    }

    if (!computed) {
      console.log("  No tiered week data.");
      continue;
    }

    const pairToAssetClass = new Map<string, AssetClass>();
    for (const [assetClass, models] of Object.entries(computed.perAsset)) {
      for (const modelRow of models) {
        for (const detail of (modelRow as { pair_details?: Array<{ pair: string }> }).pair_details ?? []) {
          pairToAssetClass.set(detail.pair.toUpperCase(), assetClass as AssetClass);
        }
      }
    }

    const signalInputs: Array<{
      pair: string;
      direction: Direction;
      tier: string;
      model: string;
      assetClass: AssetClass;
      signalMode: SignalMode;
      gateDecision: GateDecision;
    }> = [];

    for (const modelRow of computed.combined) {
      const tier = MODEL_TO_TIER[modelRow.model];
      if (!tier) continue;

      for (const detail of (modelRow as { pair_details?: Array<{ pair: string; direction: string }> }).pair_details ?? []) {
        const pair = detail.pair.toUpperCase();
        const direction = detail.direction;
        if (direction !== "LONG" && direction !== "SHORT") continue;

        const assetClass = pairToAssetClass.get(pair) ?? "fx";

        let gate: { decision: GateDecision; reasons: string[] };
        try {
          gate = evaluatePairWithGate({
            pair,
            weekOpenUtc,
            direction,
            assetClass,
            gateMap,
            cotContext,
            reduceAsSkip: true,
          });
        } catch {
          gate = { decision: "NO_DATA", reasons: ["gate_eval_error"] };
        }

        signalInputs.push({
          pair,
          direction,
          tier,
          model: modelRow.model,
          assetClass,
          signalMode: classifySignalMode(gate.decision),
          gateDecision: gate.decision,
        });
      }
    }

    const weekResults = await mapWithConcurrency(signalInputs, FETCH_CONCURRENCY, async (signal) => {
      const weekWindow = getCanonicalWeekWindow(weekOpenUtc, signal.assetClass);
      const canonicalWeekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });

      const record: PairWeekRecord = {
        week: weekOpenUtc,
        weekLabel: label,
        pair: signal.pair,
        direction: signal.direction,
        tier: signal.tier,
        model: signal.model,
        assetClass: signal.assetClass,
        gateDecision: signal.gateDecision,
        signalMode: signal.signalMode,
        weeklyFill: null,
        weeklyEligible: false,
        weeklySkipReason: null,
        variantFills: { A: [], B: [], C: [] },
        variantEligible: false,
      };

      let bars: OandaHourlyCandle[];
      try {
        bars = await fetchOandaCandleSeries(signal.pair, weekWindow.openUtc, weekWindow.closeUtc);
      } catch {
        record.weeklySkipReason = "oanda_fetch_failed";
        return record;
      }

      if (bars.length === 0) {
        record.weeklySkipReason = "no_h1_bars";
        return record;
      }

      /* Filter bars to only those after canonical week open */
      const weeklyBars = bars.filter((bar) => bar.ts >= canonicalWeekOpen.toMillis());
      if (weeklyBars.length === 0) {
        record.weeklySkipReason = "no_week_anchor_bars";
        return record;
      }

      /* Compute ADR */
      let adrPct: number | null = null;
      try {
        adrPct = await computeAdrPct(signal.pair, canonicalWeekOpen.toISO() ?? weekOpenUtc);
      } catch {
        record.weeklySkipReason = "adr_query_failed";
        return record;
      }

      if (adrPct === null) {
        record.weeklySkipReason = "insufficient_adr";
        return record;
      }

      /* Weekly baseline (variant W) */
      const weekAnchorPrice = weeklyBars[0]!.open;
      record.weeklyEligible = true;
      record.weeklyFill = simulateWeeklyBaseline({
        week: weekOpenUtc,
        weekLabel: label,
        pair: signal.pair,
        direction: signal.direction,
        assetClass: signal.assetClass,
        signalMode: signal.signalMode,
        gateDecision: signal.gateDecision,
        anchorPrice: weekAnchorPrice,
        adrPct,
        bars: weeklyBars,
      });

      /* Running extreme variants (A, B, C) */
      record.variantEligible = true;
      const extremeFills = simulateRunningExtreme({
        week: weekOpenUtc,
        weekLabel: label,
        pair: signal.pair,
        direction: signal.direction,
        assetClass: signal.assetClass,
        signalMode: signal.signalMode,
        gateDecision: signal.gateDecision,
        adrPct,
        bars: weeklyBars,
      });
      record.variantFills = extremeFills;

      return record;
    });

    const wFills = weekResults.filter((r) => r.weeklyFill !== null).length;
    const aFills = weekResults.reduce((sum, r) => sum + r.variantFills.A.length, 0);
    const bFills = weekResults.reduce((sum, r) => sum + r.variantFills.B.length, 0);
    const cFills = weekResults.reduce((sum, r) => sum + r.variantFills.C.length, 0);
    console.log(`  Signals: ${weekResults.length} | W: ${wFills} | A: ${aFills} | B: ${bFills} | C: ${cFills}`);

    records.push(...weekResults);
  }

  const reportText = buildMarkdownReport({
    records,
    weeks: weekOpens,
    generatedAtIso,
  });
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${reportText}\n`, "utf8");

  console.log("");
  console.log(
    renderMarkdownTable(
      ["Metric", "Weekly (W)", "Fresh Start (A)", "Consumed (B)", "Side Flip (C)"],
      buildSummaryRows(records),
    ),
  );
  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log("Done.");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
