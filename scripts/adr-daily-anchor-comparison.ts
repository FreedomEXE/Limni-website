/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-daily-anchor-comparison.ts
 *
 * Description:
 * Test 9 in the ADR dip-entry research program.
 * Compares daily ADR anchored to day open (static) vs anchored to running
 * daily high/low (dynamic). Both variants use one fill per pair per day.
 * Answers: does anchoring to the running daily extreme instead of the open
 * increase fill rates, improve returns, or increase drawdowns?
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
import { getCanonicalWeekWindow, listCanonicalDailyWindowsForWeek } from "@/lib/canonicalPriceWindows";
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
const REPORT_PATH = path.resolve(process.cwd(), "reports", "adr-daily-anchor-comparison.md");
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
type VariantKey = "D" | "DH";

type FillRecord = {
  variant: VariantKey;
  week: string;
  weekLabel: string;
  day: string;
  dayLabel: string;
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

type PairDayRecord = {
  week: string;
  weekLabel: string;
  day: string;
  dayLabel: string;
  pair: string;
  direction: Direction;
  tier: string;
  model: string;
  assetClass: AssetClass;
  gateDecision: GateDecision;
  signalMode: SignalMode;
  dFill: FillRecord | null;
  dhFill: FillRecord | null;
  eligible: boolean;
  skipReason: string | null;
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
  losingDays: number;
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

function dayLabelFn(dayOpenUtc: string): string {
  const dt = DateTime.fromISO(dayOpenUtc, { zone: "utc" }).setZone(NEW_YORK_TZ);
  if (!dt.isValid) return dayOpenUtc.slice(0, 10);
  return dt.toFormat("MMM dd");
}

function toFinite(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function fmtPct(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function fmtRate(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtNum(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
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

/* ─── Variant D: Daily Open Anchor (Static) ─── */

function simulateVariantD(options: {
  week: string;
  weekLabel: string;
  day: string;
  dayLabel: string;
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
          variant: "D",
          week: options.week,
          weekLabel: options.weekLabel,
          day: options.day,
          dayLabel: options.dayLabel,
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
        variant: "D",
        week: options.week,
        weekLabel: options.weekLabel,
        day: options.day,
        dayLabel: options.dayLabel,
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
    variant: "D",
    week: options.week,
    weekLabel: options.weekLabel,
    day: options.day,
    dayLabel: options.dayLabel,
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

/* ─── Variant DH: Running Daily High/Low Anchor (Dynamic) ─── */

function simulateVariantDH(options: {
  week: string;
  weekLabel: string;
  day: string;
  dayLabel: string;
  pair: string;
  direction: Direction;
  assetClass: AssetClass;
  signalMode: SignalMode;
  gateDecision: GateDecision;
  adrPct: number;
  bars: OandaHourlyCandle[];
}): FillRecord | null {
  if (options.bars.length === 0) return null;
  if (!Number.isFinite(options.adrPct) || options.adrPct <= 0) return null;

  const firstBarOpen = options.bars[0]!.open;
  const adrDistance = (firstBarOpen * options.adrPct * ADR_MULTIPLIER) / 100;
  if (!Number.isFinite(adrDistance) || adrDistance <= 0) return null;

  let runningExtreme: number | null = null;
  let fillTs: number | null = null;
  let fillBarIndex = -1;
  let entryPrice = 0;
  let tpPrice = 0;
  let maePrice = 0;
  let anchorAtFill = 0;

  for (let i = 0; i < options.bars.length; i += 1) {
    const bar = options.bars[i]!;

    if (fillTs === null) {
      // Update running extreme
      if (runningExtreme === null) {
        runningExtreme = options.direction === "LONG" ? bar.high : bar.low;
      } else {
        runningExtreme =
          options.direction === "LONG"
            ? Math.max(runningExtreme, bar.high)
            : Math.min(runningExtreme, bar.low);
      }

      // Calculate dynamic entry level
      const dynamicEntry =
        options.direction === "LONG"
          ? runningExtreme - adrDistance
          : runningExtreme + adrDistance;

      // Check if price reached entry
      const triggerHit =
        options.direction === "LONG"
          ? bar.low <= dynamicEntry
          : bar.high >= dynamicEntry;

      if (triggerHit) {
        entryPrice = dynamicEntry;
        tpPrice =
          options.direction === "LONG"
            ? entryPrice * (1 + (TP_MULTIPLIER * options.adrPct) / 100)
            : entryPrice * (1 - (TP_MULTIPLIER * options.adrPct) / 100);
        fillTs = bar.ts;
        fillBarIndex = i;
        anchorAtFill = runningExtreme;
        maePrice =
          options.direction === "LONG"
            ? Math.min(entryPrice, bar.low)
            : Math.max(entryPrice, bar.high);

        // Check same-bar TP
        const sameBarTp =
          options.direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
        if (sameBarTp) {
          return {
            variant: "DH",
            week: options.week,
            weekLabel: options.weekLabel,
            day: options.day,
            dayLabel: options.dayLabel,
            pair: options.pair,
            direction: options.direction,
            assetClass: options.assetClass,
            signalMode: options.signalMode,
            gateDecision: options.gateDecision,
            anchorPrice: anchorAtFill,
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
      continue;
    }

    // In trade: track MAE and check TP
    maePrice =
      options.direction === "LONG"
        ? Math.min(maePrice, bar.low)
        : Math.max(maePrice, bar.high);

    const tpHit =
      options.direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;
    if (tpHit) {
      return {
        variant: "DH",
        week: options.week,
        weekLabel: options.weekLabel,
        day: options.day,
        dayLabel: options.dayLabel,
        pair: options.pair,
        direction: options.direction,
        assetClass: options.assetClass,
        signalMode: options.signalMode,
        gateDecision: options.gateDecision,
        anchorPrice: anchorAtFill,
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
  }

  // Day close
  if (fillTs === null) return null;

  const lastBar = options.bars[options.bars.length - 1]!;
  return {
    variant: "DH",
    week: options.week,
    weekLabel: options.weekLabel,
    day: options.day,
    dayLabel: options.dayLabel,
    pair: options.pair,
    direction: options.direction,
    assetClass: options.assetClass,
    signalMode: options.signalMode,
    gateDecision: options.gateDecision,
    anchorPrice: anchorAtFill,
    adrPct: options.adrPct,
    entryPrice,
    tpPrice,
    fillBarIndex,
    fillTs,
    exitTs: lastBar.ts,
    exitPrice: lastBar.close,
    returnPct: signedReturnPct(options.direction, entryPrice, lastBar.close),
    tpHit: false,
    maePrice,
    maeXAdr: Math.abs(maePrice - entryPrice) / adrDistance,
  };
}

/* ─── Report Building ─── */

function getAllFills(records: PairDayRecord[], variant: VariantKey): FillRecord[] {
  if (variant === "D") {
    return records.map((r) => r.dFill).filter((f): f is FillRecord => f !== null);
  }
  return records.map((r) => r.dhFill).filter((f): f is FillRecord => f !== null);
}

function buildVariantSummary(records: PairDayRecord[], variant: VariantKey): VariantSummary {
  const fills = getAllFills(records, variant);
  const returns = fills.map((f) => f.returnPct);
  const maeValues = fills.map((f) => f.maeXAdr);

  const totalSignals = records.length;
  const eligibleSignals = records.filter((r) => r.eligible).length;

  const days = Array.from(new Set(records.map((r) => r.day)));
  const losingDays = days.filter((day) => {
    const dayReturn = fills
      .filter((f) => f.day === day)
      .reduce((sum, f) => sum + f.returnPct, 0);
    return dayReturn < 0;
  }).length;

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
    losingDays,
  };
}

function buildSummaryRows(records: PairDayRecord[]): string[][] {
  const variants: VariantKey[] = ["D", "DH"];
  const summaries = variants.map((v) => buildVariantSummary(records, v));

  const metricRows: Array<[string, (s: VariantSummary) => string]> = [
    ["Total signals", (s) => String(s.totalSignals)],
    ["Eligible signals", (s) => String(s.eligibleSignals)],
    ["Total fills", (s) => String(s.totalFills)],
    ["Fill rate", (s) => fmtRate(s.fillRate)],
    ["Avg return/fill", (s) => fmtPct(s.avgReturnPerFill)],
    ["Total return", (s) => fmtPct(s.totalReturn)],
    ["Win rate", (s) => fmtRate(s.winRate)],
    ["TP hit rate", (s) => fmtRate(s.tpHitRate)],
    ["Avg MAE (xADR)", (s) => fmtNum(s.avgMaeXAdr)],
    ["P95 MAE (xADR)", (s) => fmtNum(s.p95MaeXAdr)],
    ["Losing days", (s) => String(s.losingDays)],
  ];

  return metricRows.map(([label, fn]) => [label, ...summaries.map(fn)]);
}

function buildPerDayRows(records: PairDayRecord[]): string[][] {
  const days = Array.from(new Set(records.map((r) => r.day))).sort();
  return days.map((day) => {
    const dFills = getAllFills(records, "D").filter((f) => f.day === day);
    const dhFills = getAllFills(records, "DH").filter((f) => f.day === day);
    const dReturn = dFills.reduce((sum, f) => sum + f.returnPct, 0);
    const dhReturn = dhFills.reduce((sum, f) => sum + f.returnPct, 0);
    return [
      dayLabelFn(day),
      String(dFills.length),
      fmtPct(dFills.length > 0 ? dReturn : 0),
      String(dhFills.length),
      fmtPct(dhFills.length > 0 ? dhReturn : 0),
    ];
  });
}

function buildPerWeekAggregateRows(records: PairDayRecord[], weeks: string[]): string[][] {
  return weeks.map((week) => {
    const dFills = getAllFills(records, "D").filter((f) => f.week === week);
    const dhFills = getAllFills(records, "DH").filter((f) => f.week === week);
    const dReturn = dFills.reduce((sum, f) => sum + f.returnPct, 0);
    const dhReturn = dhFills.reduce((sum, f) => sum + f.returnPct, 0);
    return [
      weekLabelFn(week),
      String(dFills.length),
      fmtPct(dFills.length > 0 ? dReturn : 0),
      String(dhFills.length),
      fmtPct(dhFills.length > 0 ? dhReturn : 0),
    ];
  });
}

function buildAssetClassRows(records: PairDayRecord[]): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  return assetClasses.map((ac) => {
    const dFills = getAllFills(records, "D").filter((f) => f.assetClass === ac);
    const dhFills = getAllFills(records, "DH").filter((f) => f.assetClass === ac);
    const dReturn = dFills.reduce((sum, f) => sum + f.returnPct, 0);
    const dhReturn = dhFills.reduce((sum, f) => sum + f.returnPct, 0);
    return [
      ac,
      String(dFills.length),
      fmtPct(dFills.length > 0 ? dReturn : 0),
      String(dhFills.length),
      fmtPct(dhFills.length > 0 ? dhReturn : 0),
    ];
  });
}

function buildGateSplitSections(records: PairDayRecord[]): string[] {
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
        ["Metric", "Daily Open (D)", "Running Extreme (DH)"],
        buildSummaryRows(modeRecords),
      ),
    );
    sections.push("");
  }

  return sections;
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

function buildPerPairPerformance(records: PairDayRecord[]): string[] {
  const fills = getAllFills(records, "DH");
  const sections: string[] = [];
  sections.push("## Variant DH — Per-Pair Performance");
  sections.push("");

  const pairMap = new Map<string, { fills: FillRecord[]; assetClass: AssetClass }>();
  for (const f of fills) {
    if (!pairMap.has(f.pair)) pairMap.set(f.pair, { fills: [], assetClass: f.assetClass });
    pairMap.get(f.pair)!.fills.push(f);
  }

  const headers = [
    "Pair", "Class", "Fills", "Win Rate", "Avg Return", "Total Return",
    "Avg MAE (xADR)", "P95 MAE (xADR)",
  ];

  const rows = Array.from(pairMap.entries())
    .map(([pair, data]) => {
      const returns = data.fills.map((f) => f.returnPct);
      const maeValues = data.fills.map((f) => f.maeXAdr);
      const winRate = data.fills.length > 0
        ? (data.fills.filter((f) => f.returnPct > 0).length / data.fills.length) * 100
        : null;
      const totalReturn = returns.reduce((sum, v) => sum + v, 0);

      return {
        totalReturn,
        cells: [
          pair, data.assetClass, String(data.fills.length), fmtRate(winRate),
          fmtPct(average(returns)), fmtPct(totalReturn),
          fmtNum(average(maeValues)), fmtNum(quantile(maeValues, 0.95)),
        ],
      };
    })
    .sort((a, b) => b.totalReturn - a.totalReturn)
    .map((r) => r.cells);

  sections.push(renderMarkdownTable(headers, rows));
  sections.push("");
  return sections;
}

function buildWorstFills(records: PairDayRecord[]): string[] {
  const fills = getAllFills(records, "DH");
  const sections: string[] = [];
  sections.push("## Variant DH — Worst 10 Fills");
  sections.push("");

  const sorted = [...fills].sort((a, b) => a.returnPct - b.returnPct).slice(0, 10);
  const headers = ["Pair", "Day", "Direction", "Return", "MAE (xADR)", "TP Hit", "Gate"];
  const rows = sorted.map((f) => [
    f.pair,
    dayLabelFn(f.day),
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

function buildDeltaAnalysis(records: PairDayRecord[]): string[] {
  const sections: string[] = [];
  sections.push("## Delta Analysis — Where Both D and DH Filled");
  sections.push("");

  const bothFilled = records.filter((r) => r.dFill !== null && r.dhFill !== null);
  if (bothFilled.length === 0) {
    sections.push("No pair-days where both variants filled.");
    sections.push("");
    return sections;
  }

  const dhBeatD = bothFilled.filter((r) => r.dhFill!.returnPct > r.dFill!.returnPct).length;
  const dBeatDH = bothFilled.filter((r) => r.dFill!.returnPct > r.dhFill!.returnPct).length;
  const ties = bothFilled.filter((r) => r.dFill!.returnPct === r.dhFill!.returnPct).length;

  const deltas = bothFilled.map((r) => r.dhFill!.returnPct - r.dFill!.returnPct);
  const avgDelta = average(deltas);

  sections.push(`**Total pair-days where both filled**: ${bothFilled.length}`);
  sections.push(`**DH beat D**: ${dhBeatD} (${fmtRate((dhBeatD / bothFilled.length) * 100)})`);
  sections.push(`**D beat DH**: ${dBeatDH} (${fmtRate((dBeatDH / bothFilled.length) * 100)})`);
  sections.push(`**Ties**: ${ties}`);
  sections.push(`**Avg delta (DH - D)**: ${fmtPct(avgDelta)}`);
  sections.push("");

  const headers = ["Pair", "Day", "Direction", "D Return", "DH Return", "Delta"];
  const rows = bothFilled
    .map((r) => ({
      delta: r.dhFill!.returnPct - r.dFill!.returnPct,
      cells: [
        r.pair,
        dayLabelFn(r.day),
        r.direction,
        fmtPct(r.dFill!.returnPct),
        fmtPct(r.dhFill!.returnPct),
        fmtPct(r.dhFill!.returnPct - r.dFill!.returnPct),
      ],
    }))
    .sort((a, b) => b.delta - a.delta)
    .map((x) => x.cells);

  sections.push(renderMarkdownTable(headers, rows.slice(0, 20)));
  sections.push("");
  sections.push("(Showing top 20 by delta)");
  sections.push("");

  return sections;
}

function buildMarkdownReport(options: {
  records: PairDayRecord[];
  weeks: string[];
  generatedAtIso: string;
}): string {
  const sections = [
    "# ADR Daily Anchor Comparison — Test 9",
    "",
    `Generated: ${options.generatedAtIso}`,
    `Week range: ${weekLabelFn(options.weeks[0]!)} → ${weekLabelFn(options.weeks[options.weeks.length - 1]!)}`,
    "Script: `scripts/adr-daily-anchor-comparison.ts`",
    "",
    "## Variant Legend",
    "",
    "- **D (Daily Open)**: Static anchor at daily open price. Entry = dayOpen ± 1.0 ADR. One fill max per pair per day.",
    "- **DH (Running Daily High/Low)**: Dynamic anchor. For LONG: running daily high, entry = runningHigh - 1.0 ADR. For SHORT: running daily low, entry = runningLow + 1.0 ADR. Anchor updates each H1 bar. One fill max per pair per day (first trigger only).",
    "",
    "Both variants: TP = 0.25 ADR from fill price. Exit at TP or day close.",
    "",
    "## Summary Comparison",
    "",
    renderMarkdownTable(
      ["Metric", "Daily Open (D)", "Running Extreme (DH)"],
      buildSummaryRows(options.records),
    ),
    "",
    "## Per-Week Aggregate",
    "",
    renderMarkdownTable(
      ["Week", "D Fills", "D Return", "DH Fills", "DH Return"],
      buildPerWeekAggregateRows(options.records, options.weeks),
    ),
    "",
    "## Per-Day Comparison (Last 20 Days)",
    "",
  ];

  const perDayRows = buildPerDayRows(options.records);
  sections.push(
    renderMarkdownTable(
      ["Day", "D Fills", "D Return", "DH Fills", "DH Return"],
      perDayRows.slice(-20),
    ),
  );
  sections.push("");

  sections.push(
    "## Per-Asset-Class Breakdown",
    "",
    renderMarkdownTable(
      ["Asset Class", "D Fills", "D Return", "DH Fills", "DH Return"],
      buildAssetClassRows(options.records),
    ),
    "",
    "## Gated vs Non-Gated Split",
    "",
    ...buildGateSplitSections(options.records),
  );

  // MAE distribution for both
  const variantKeys: VariantKey[] = ["D", "DH"];
  const variantLabels: Record<VariantKey, string> = {
    D: "Daily Open (D)",
    DH: "Running Extreme (DH)",
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

  sections.push(...buildPerPairPerformance(options.records));
  sections.push(...buildWorstFills(options.records));
  sections.push(...buildDeltaAnalysis(options.records));

  sections.push("## Notes");
  sections.push("");
  sections.push("- Both variants enforce one fill maximum per pair per day. No re-entries.");
  sections.push("- Variant D anchors to the first H1 bar open price of the canonical trading day (static, known at day start).");
  sections.push("- Variant DH anchors to the running daily high (LONG) or low (SHORT), which updates each H1 bar (dynamic).");
  sections.push("- ADR: 10-day lookback, 5-day minimum, calculated at week boundary and reused for all days in that week.");
  sections.push("- Trigger: 1.0x ADR from anchor. TP: 0.25x ADR from fill price. Exit: TP or day close.");
  sections.push("- Direction source: Tiered V3 weekly system (direction determined at week level, applied to each day).");
  sections.push("- Gate evaluation: Once per week per pair, applied to all days in that week.");
  sections.push("- Key question: Does the dynamic daily anchor improve fill rate, returns, or risk profile vs static day open?");
  sections.push("");

  return sections.join("\n");
}

/* ─── Main ─── */

async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  const generatedAtIso = DateTime.utc().toISO() ?? new Date().toISOString();

  console.log("\nADR Daily Anchor Comparison — Test 9");
  console.log(`${weekOpens.length} completed weeks | D vs DH | H1 execution\n`);

  console.log("Loading gate artifacts...");
  const gateMap = buildGateMap();
  const cotContext = await buildCotGateContext();
  console.log("Ready.\n");

  const records: PairDayRecord[] = [];

  for (let weekIndex = 0; weekIndex < weekOpens.length; weekIndex += 1) {
    const weekOpenUtc = weekOpens[weekIndex]!;
    const weekLabel = weekLabelFn(weekOpenUtc);
    console.log(`Processing week ${weekIndex + 1}/${weekOpens.length}: ${weekLabel} (${weekOpenUtc})...`);

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

    // Calculate ADR once per week per pair
    const adrCache = new Map<string, number | null>();
    const weekDt = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const uniquePairs = Array.from(new Set(signalInputs.map((s) => s.pair)));

    for (const pair of uniquePairs) {
      try {
        const adrPct = await computeAdrPct(pair, weekDt.toISO() ?? weekOpenUtc);
        adrCache.set(pair, adrPct);
      } catch {
        adrCache.set(pair, null);
      }
    }

    // Group signals by asset class to process trading days correctly
    const signalsByAssetClass = new Map<AssetClass, typeof signalInputs>();
    for (const signal of signalInputs) {
      if (!signalsByAssetClass.has(signal.assetClass)) {
        signalsByAssetClass.set(signal.assetClass, []);
      }
      signalsByAssetClass.get(signal.assetClass)!.push(signal);
    }

    let weekTotalDFills = 0;
    let weekTotalDHFills = 0;

    // Process each asset class separately (they have different trading day windows)
    for (const [assetClass, assetSignals] of signalsByAssetClass.entries()) {
      const dailyWindows = listCanonicalDailyWindowsForWeek(weekOpenUtc, assetClass);

      for (const dayWindow of dailyWindows) {
        const dayLabel = dayLabelFn(dayWindow.periodOpenUtc);

        const dayResults = await mapWithConcurrency(assetSignals, FETCH_CONCURRENCY, async (signal) => {
        const record: PairDayRecord = {
          week: weekOpenUtc,
          weekLabel,
          day: dayWindow.periodOpenUtc,
          dayLabel,
          pair: signal.pair,
          direction: signal.direction,
          tier: signal.tier,
          model: signal.model,
          assetClass: signal.assetClass,
          gateDecision: signal.gateDecision,
          signalMode: signal.signalMode,
          dFill: null,
          dhFill: null,
          eligible: false,
          skipReason: null,
        };

        const adrPct = adrCache.get(signal.pair) ?? null;
        if (adrPct === null) {
          record.skipReason = "insufficient_adr";
          return record;
        }

        let dayBars: OandaHourlyCandle[];
        try {
          dayBars = await fetchOandaCandleSeries(
            signal.pair,
            dayWindow.openUtc,
            dayWindow.closeUtc,
          );
        } catch {
          record.skipReason = "oanda_fetch_failed";
          return record;
        }

        if (dayBars.length === 0) {
          record.skipReason = "no_h1_bars";
          return record;
        }

        record.eligible = true;

        // Variant D: static anchor at day open
        const dayAnchorPrice = dayBars[0]!.open;
        record.dFill = simulateVariantD({
          week: weekOpenUtc,
          weekLabel,
          day: dayWindow.periodOpenUtc,
          dayLabel,
          pair: signal.pair,
          direction: signal.direction,
          assetClass: signal.assetClass,
          signalMode: signal.signalMode,
          gateDecision: signal.gateDecision,
          anchorPrice: dayAnchorPrice,
          adrPct,
          bars: dayBars,
        });

        // Variant DH: dynamic running extreme anchor
        record.dhFill = simulateVariantDH({
          week: weekOpenUtc,
          weekLabel,
          day: dayWindow.periodOpenUtc,
          dayLabel,
          pair: signal.pair,
          direction: signal.direction,
          assetClass: signal.assetClass,
          signalMode: signal.signalMode,
          gateDecision: signal.gateDecision,
          adrPct,
          bars: dayBars,
        });

          return record;
        });

        const dFills = dayResults.filter((r) => r.dFill !== null).length;
        const dhFills = dayResults.filter((r) => r.dhFill !== null).length;
        weekTotalDFills += dFills;
        weekTotalDHFills += dhFills;

        records.push(...dayResults);
      }
    }

    console.log(`  Week total signals: ${signalInputs.length} | D: ${weekTotalDFills} | DH: ${weekTotalDHFills}`);
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
      ["Metric", "Daily Open (D)", "Running Extreme (DH)"],
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
