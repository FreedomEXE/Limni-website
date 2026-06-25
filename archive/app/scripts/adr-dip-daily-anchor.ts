/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-dip-daily-anchor.ts
 *
 * Description:
 * Test 6 in the ADR dip-entry research program.
 *
 * Compares the weekly-anchored ADR dip baseline against a daily-anchored
 * variant over the same 9 completed canonical weeks.
 *
 * Variants:
 *   W. Weekly anchor, one fill per pair per week, exit at TP or week close
 *   D. Daily anchor, one fill per pair per day, exit at TP or day close
 *
 * Usage: .\node_modules\.bin\tsx.cmd scripts/adr-dip-daily-anchor.ts
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

const LOOKBACK_WEEKS = 9;
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ADR_MULTIPLIER = 1.0;
const TP_MULTIPLIER = 0.25;
const FETCH_CONCURRENCY = 6;
const REPORT_PATH = path.resolve(process.cwd(), "app", "reports", "adr-dip-daily-anchor.md");
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

type Direction = "LONG" | "SHORT";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type SignalMode = "GATED" | "NON_GATED";
type VariantKey = "W" | "D";

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
  periodOpenUtc: string;
  periodCloseUtc: string;
  periodKey: string;
  fillTs: number;
  exitTs: number;
  exitPrice: number;
  returnPct: number;
  tpHit: boolean;
  maePrice: number;
  maeXAdr: number;
};

type PeriodEvaluation = {
  periodOpenUtc: string;
  periodCloseUtc: string;
  periodKey: string;
  anchorPrice: number | null;
  adrPct: number | null;
  eligible: boolean;
  skipReason: string | null;
  fill: FillRecord | null;
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
  weekly: PeriodEvaluation;
  daily: PeriodEvaluation[];
};

type DailySegment = {
  periodKey: string;
  periodOpenUtc: DateTime;
  periodCloseUtc: DateTime;
  bars: OandaHourlyCandle[];
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
};

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

function weekLabel(weekOpenUtc: string): string {
  const dt = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone(NEW_YORK_TZ);
  if (!dt.isValid) return weekOpenUtc.slice(0, 10);
  return dt.plus({ days: 1 }).startOf("day").toFormat("MMM dd");
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
  return lowerValue + ((upperValue - lowerValue) * weight);
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function tradingDayKeyFromTs(ts: number) {
  const ny = DateTime.fromMillis(ts, { zone: "utc" }).setZone(NEW_YORK_TZ);
  const anchorDay = ny.hour >= 17 ? ny.startOf("day") : ny.minus({ days: 1 }).startOf("day");
  return anchorDay.toISODate() ?? ny.toISODate() ?? String(ts);
}

function isWeekdayTradingSegment(ts: number) {
  const ny = DateTime.fromMillis(ts, { zone: "utc" }).setZone(NEW_YORK_TZ);
  const anchorDay = ny.hour >= 17 ? ny.startOf("day") : ny.minus({ days: 1 }).startOf("day");
  return anchorDay.weekday !== 5 && anchorDay.weekday !== 6;
}

function buildDailySegments(bars: OandaHourlyCandle[]): DailySegment[] {
  if (bars.length === 0) return [];
  const segments: DailySegment[] = [];
  let currentBars: OandaHourlyCandle[] = [];
  let currentKey: string | null = null;

  for (const bar of bars) {
    const key = tradingDayKeyFromTs(bar.ts);
    if (currentKey === null || key !== currentKey) {
      if (currentBars.length > 0) {
        const openUtc = DateTime.fromMillis(currentBars[0]!.ts, { zone: "utc" });
        const closeUtc = DateTime.fromMillis(currentBars[currentBars.length - 1]!.ts, { zone: "utc" }).plus({ hours: 1 });
        if (isWeekdayTradingSegment(currentBars[0]!.ts)) {
          segments.push({
            periodKey: currentKey!,
            periodOpenUtc: openUtc,
            periodCloseUtc: closeUtc,
            bars: currentBars,
          });
        }
      }
      currentKey = key;
      currentBars = [bar];
      continue;
    }
    currentBars.push(bar);
  }

  if (currentBars.length > 0 && currentKey !== null) {
    const openUtc = DateTime.fromMillis(currentBars[0]!.ts, { zone: "utc" });
    const closeUtc = DateTime.fromMillis(currentBars[currentBars.length - 1]!.ts, { zone: "utc" }).plus({ hours: 1 });
    if (isWeekdayTradingSegment(currentBars[0]!.ts)) {
      segments.push({
        periodKey: currentKey,
        periodOpenUtc: openUtc,
        periodCloseUtc: closeUtc,
        bars: currentBars,
      });
    }
  }

  return segments;
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

function simulateSingleFill(options: {
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
  bars: OandaHourlyCandle[];
  periodOpenUtc: string;
  periodCloseUtc: string;
  periodKey: string;
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
      ? entryPrice * (1 + ((TP_MULTIPLIER * options.adrPct) / 100))
      : entryPrice * (1 - ((TP_MULTIPLIER * options.adrPct) / 100));

  let fillTs: number | null = null;
  let maePrice: number | null = null;

  for (const bar of options.bars) {
    if (fillTs === null) {
      const fillHit = options.direction === "LONG"
        ? bar.low <= entryPrice
        : bar.high >= entryPrice;
      if (!fillHit) {
        continue;
      }

      fillTs = bar.ts;
      maePrice = options.direction === "LONG"
        ? Math.min(entryPrice, bar.low)
        : Math.max(entryPrice, bar.high);

      const sameBarTpHit = options.direction === "LONG"
        ? bar.high >= tpPrice
        : bar.low <= tpPrice;
      if (sameBarTpHit) {
        return {
          variant: options.variant,
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
          periodOpenUtc: options.periodOpenUtc,
          periodCloseUtc: options.periodCloseUtc,
          periodKey: options.periodKey,
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

    maePrice = options.direction === "LONG"
      ? Math.min(maePrice ?? entryPrice, bar.low)
      : Math.max(maePrice ?? entryPrice, bar.high);

    const tpHit = options.direction === "LONG"
      ? bar.high >= tpPrice
      : bar.low <= tpPrice;
    if (tpHit) {
      return {
        variant: options.variant,
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
        periodOpenUtc: options.periodOpenUtc,
        periodCloseUtc: options.periodCloseUtc,
        periodKey: options.periodKey,
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

  if (fillTs === null) {
    return null;
  }

  const lastBar = options.bars[options.bars.length - 1]!;
  const finalMaePrice = maePrice ?? entryPrice;
  return {
    variant: options.variant,
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
    periodOpenUtc: options.periodOpenUtc,
    periodCloseUtc: options.periodCloseUtc,
    periodKey: options.periodKey,
    fillTs,
    exitTs: lastBar.ts,
    exitPrice: lastBar.close,
    returnPct: signedReturnPct(options.direction, entryPrice, lastBar.close),
    tpHit: false,
    maePrice: finalMaePrice,
    maeXAdr: Math.abs(finalMaePrice - entryPrice) / adrDistance,
  };
}

function emptyPeriodEvaluation(periodOpenUtc: string, periodCloseUtc: string, periodKey: string): PeriodEvaluation {
  return {
    periodOpenUtc,
    periodCloseUtc,
    periodKey,
    anchorPrice: null,
    adrPct: null,
    eligible: false,
    skipReason: null,
    fill: null,
  };
}

function getVariantEvaluations(records: PairWeekRecord[], variant: VariantKey) {
  if (variant === "W") {
    return records.map((record) => record.weekly);
  }
  return records.flatMap((record) => record.daily);
}

function getVariantFills(records: PairWeekRecord[], variant: VariantKey) {
  return getVariantEvaluations(records, variant)
    .map((evaluation) => evaluation.fill)
    .filter((fill): fill is FillRecord => fill !== null);
}

function buildVariantSummary(records: PairWeekRecord[], variant: VariantKey): VariantSummary {
  const evaluations = getVariantEvaluations(records, variant);
  const fills = getVariantFills(records, variant);
  const returns = fills.map((fill) => fill.returnPct);
  const maeValues = fills.map((fill) => fill.maeXAdr);
  const eligibleSignals = evaluations.filter((evaluation) => evaluation.eligible).length;
  const weeks = [...new Set(records.map((record) => record.week))];
  const losingWeeks = weeks.filter((week) => {
    const weekReturn = fills
      .filter((fill) => fill.week === week)
      .reduce((sum, fill) => sum + fill.returnPct, 0);
    return weekReturn < 0;
  }).length;

  return {
    totalSignals: evaluations.length,
    eligibleSignals,
    totalFills: fills.length,
    fillRate: eligibleSignals > 0 ? (fills.length / eligibleSignals) * 100 : null,
    avgReturnPerFill: average(returns),
    totalReturn: fills.length > 0 ? returns.reduce((sum, value) => sum + value, 0) : null,
    winRate: fills.length > 0 ? (fills.filter((fill) => fill.returnPct > 0).length / fills.length) * 100 : null,
    tpHitRate: fills.length > 0 ? (fills.filter((fill) => fill.tpHit).length / fills.length) * 100 : null,
    avgMaeXAdr: average(maeValues),
    p95MaeXAdr: quantile(maeValues, 0.95),
    losingWeeks,
  };
}

function buildSummaryComparisonRows(records: PairWeekRecord[]): string[][] {
  const weekly = buildVariantSummary(records, "W");
  const daily = buildVariantSummary(records, "D");
  return [
    ["Total signals", String(weekly.totalSignals), String(daily.totalSignals)],
    ["Eligible signals", String(weekly.eligibleSignals), String(daily.eligibleSignals)],
    ["Total fills", String(weekly.totalFills), String(daily.totalFills)],
    ["Fill rate", fmtRate(weekly.fillRate), fmtRate(daily.fillRate)],
    ["Avg return/fill", fmtPct(weekly.avgReturnPerFill), fmtPct(daily.avgReturnPerFill)],
    ["Total return", fmtPct(weekly.totalReturn), fmtPct(daily.totalReturn)],
    ["Win rate", fmtRate(weekly.winRate), fmtRate(daily.winRate)],
    ["TP hit rate", fmtRate(weekly.tpHitRate), fmtRate(daily.tpHitRate)],
    ["Avg MAE (xADR)", fmtNum(weekly.avgMaeXAdr), fmtNum(daily.avgMaeXAdr)],
    ["P95 MAE (xADR)", fmtNum(weekly.p95MaeXAdr), fmtNum(daily.p95MaeXAdr)],
    ["Losing weeks", String(weekly.losingWeeks), String(daily.losingWeeks)],
  ];
}

function buildPerWeekComparisonRows(records: PairWeekRecord[], weeks: string[]): string[][] {
  const weeklyFills = getVariantFills(records, "W");
  const dailyFills = getVariantFills(records, "D");
  return weeks.map((week) => {
    const weeklyWeek = weeklyFills.filter((fill) => fill.week === week);
    const dailyWeek = dailyFills.filter((fill) => fill.week === week);
    const weeklyReturn = weeklyWeek.reduce((sum, fill) => sum + fill.returnPct, 0);
    const dailyReturn = dailyWeek.reduce((sum, fill) => sum + fill.returnPct, 0);
    return [
      weekLabel(week),
      String(weeklyWeek.length),
      fmtPct(weeklyWeek.length > 0 ? weeklyReturn : 0),
      String(dailyWeek.length),
      fmtPct(dailyWeek.length > 0 ? dailyReturn : 0),
      fmtPct(dailyReturn - weeklyReturn),
    ];
  });
}

function buildAssetClassRows(records: PairWeekRecord[]): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  const weeklyFills = getVariantFills(records, "W");
  const dailyFills = getVariantFills(records, "D");
  return assetClasses.map((assetClass) => {
    const weeklyAsset = weeklyFills.filter((fill) => fill.assetClass === assetClass);
    const dailyAsset = dailyFills.filter((fill) => fill.assetClass === assetClass);
    const weeklyReturn = weeklyAsset.reduce((sum, fill) => sum + fill.returnPct, 0);
    const dailyReturn = dailyAsset.reduce((sum, fill) => sum + fill.returnPct, 0);
    return [
      assetClass,
      String(weeklyAsset.length),
      fmtPct(weeklyAsset.length > 0 ? weeklyReturn : 0),
      String(dailyAsset.length),
      fmtPct(dailyAsset.length > 0 ? dailyReturn : 0),
      fmtPct(dailyReturn - weeklyReturn),
    ];
  });
}

function buildMaeDistributionRows(fills: FillRecord[]): string[][] {
  return MAE_BUCKETS.map((bucket) => {
    const bucketFills = fills.filter((fill) =>
      bucket.max === Number.POSITIVE_INFINITY
        ? fill.maeXAdr >= bucket.min
        : fill.maeXAdr >= bucket.min && fill.maeXAdr < bucket.max,
    );
    const avgReturn = average(bucketFills.map((fill) => fill.returnPct));
    const winRate = bucketFills.length > 0
      ? (bucketFills.filter((fill) => fill.returnPct > 0).length / bucketFills.length) * 100
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

function buildDailyFillFrequencyRows(records: PairWeekRecord[]): string[][] {
  const signalWeeksByPair = new Map<string, Set<string>>();
  const fillsByPair = new Map<string, FillRecord[]>();

  for (const record of records) {
    if (!signalWeeksByPair.has(record.pair)) {
      signalWeeksByPair.set(record.pair, new Set());
    }
    signalWeeksByPair.get(record.pair)!.add(record.week);
  }

  for (const fill of getVariantFills(records, "D")) {
    if (!fillsByPair.has(fill.pair)) {
      fillsByPair.set(fill.pair, []);
    }
    fillsByPair.get(fill.pair)!.push(fill);
  }

  return [...signalWeeksByPair.entries()]
    .map(([pair, signalWeeks]) => {
      const fills = fillsByPair.get(pair) ?? [];
      const filledWeeks = new Set(fills.map((fill) => fill.week));
      return {
        pair,
        cells: [
          pair,
          String(signalWeeks.size),
          String(fills.length),
          fmtNum(signalWeeks.size > 0 ? fills.length / signalWeeks.size : null),
          String(filledWeeks.size),
          fmtNum(filledWeeks.size > 0 ? fills.length / filledWeeks.size : null),
        ],
        avgPerSignalWeek: signalWeeks.size > 0 ? fills.length / signalWeeks.size : -1,
      };
    })
    .sort((a, b) => b.avgPerSignalWeek - a.avgPerSignalWeek || a.pair.localeCompare(b.pair))
    .map((row) => row.cells);
}

function buildTopBottomDeltaRows(records: PairWeekRecord[], order: "top" | "bottom"): string[][] {
  const assetClassByPair = new Map<string, AssetClass>();
  for (const record of records) {
    assetClassByPair.set(record.pair, record.assetClass);
  }

  const weeklyByPair = new Map<string, FillRecord[]>();
  const dailyByPair = new Map<string, FillRecord[]>();
  for (const fill of getVariantFills(records, "W")) {
    if (!weeklyByPair.has(fill.pair)) weeklyByPair.set(fill.pair, []);
    weeklyByPair.get(fill.pair)!.push(fill);
  }
  for (const fill of getVariantFills(records, "D")) {
    if (!dailyByPair.has(fill.pair)) dailyByPair.set(fill.pair, []);
    dailyByPair.get(fill.pair)!.push(fill);
  }

  const allPairs = [...new Set([...assetClassByPair.keys(), ...weeklyByPair.keys(), ...dailyByPair.keys()])];
  const rows = allPairs.map((pair) => {
    const weekly = weeklyByPair.get(pair) ?? [];
    const daily = dailyByPair.get(pair) ?? [];
    const weeklyReturn = weekly.reduce((sum, fill) => sum + fill.returnPct, 0);
    const dailyReturn = daily.reduce((sum, fill) => sum + fill.returnPct, 0);
    const delta = dailyReturn - weeklyReturn;
    return {
      delta,
      cells: [
        pair,
        assetClassByPair.get(pair) ?? "fx",
        String(weekly.length),
        fmtPct(weekly.length > 0 ? weeklyReturn : 0),
        String(daily.length),
        fmtPct(daily.length > 0 ? dailyReturn : 0),
        fmtPct(delta),
      ],
    };
  });

  const sorted = rows.sort((a, b) => order === "top" ? b.delta - a.delta : a.delta - b.delta);
  return sorted.slice(0, 10).map((row) => row.cells);
}

function buildGateSplitSections(records: PairWeekRecord[]): string[] {
  const sections: string[] = [];
  const modes: Array<{ key: SignalMode; title: string }> = [
    { key: "GATED", title: "GATED (PASS / NO_DATA)" },
    { key: "NON_GATED", title: "NON_GATED (SKIP / REDUCE)" },
  ];

  for (const mode of modes) {
    const modeRecords = records.filter((record) => record.signalMode === mode.key);
    sections.push(`### ${mode.title}`);
    sections.push("");
    sections.push(
      renderMarkdownTable(
        ["Metric", "Weekly (W)", "Daily (D)"],
        buildSummaryComparisonRows(modeRecords),
      ),
    );
    sections.push("");
  }

  return sections;
}

function buildMarkdownReport(options: {
  records: PairWeekRecord[];
  weeks: string[];
  generatedAtIso: string;
}): string {
  const weeklyFills = getVariantFills(options.records, "W");
  const dailyFills = getVariantFills(options.records, "D");
  const dailySummary = buildVariantSummary(options.records, "D");
  const dailySignalWeeks = new Set(options.records.map((record) => `${record.week}:${record.pair}`));

  const sections = [
    "# ADR Dip Daily Anchor — Test 6",
    "",
    `Generated: ${options.generatedAtIso}`,
    `Week range: ${weekLabel(options.weeks[0]!)} -> ${weekLabel(options.weeks[options.weeks.length - 1]!)}`,
    "Script: `app/scripts/adr-dip-daily-anchor.ts`",
    "",
    "## Summary Comparison",
    "",
    renderMarkdownTable(
      ["Metric", "Weekly (W)", "Daily (D)"],
      buildSummaryComparisonRows(options.records),
    ),
    "",
    "## Per-Week Comparison",
    "",
    renderMarkdownTable(
      ["Week", "W Fills", "W Return", "D Fills", "D Return", "Delta"],
      buildPerWeekComparisonRows(options.records, options.weeks),
    ),
    "",
    "## Per-Asset-Class Breakdown",
    "",
    renderMarkdownTable(
      ["Asset Class", "W Fills", "W Return", "D Fills", "D Return", "Delta"],
      buildAssetClassRows(options.records),
    ),
    "",
    "## MAE Distribution — Weekly (W)",
    "",
    renderMarkdownTable(
      ["MAE Bucket (xADR)", "Fills", "% of Total", "Avg Return", "Win Rate"],
      buildMaeDistributionRows(weeklyFills),
    ),
    "",
    "## MAE Distribution — Daily (D)",
    "",
    renderMarkdownTable(
      ["MAE Bucket (xADR)", "Fills", "% of Total", "Avg Return", "Win Rate"],
      buildMaeDistributionRows(dailyFills),
    ),
    "",
    "## Fill Frequency Analysis — Daily (D)",
    "",
    `Overall avg fills per pair-week: ${fmtNum(dailySignalWeeks.size > 0 ? dailySummary.totalFills / dailySignalWeeks.size : null)}`,
    "",
    renderMarkdownTable(
      ["Pair", "Signal Weeks", "Total Fills", "Avg Fills/Signal Week", "Weeks w/ Fill", "Avg Fills/Filled Week"],
      buildDailyFillFrequencyRows(options.records),
    ),
    "",
    "## Gated Vs Non-Gated Split",
    "",
    ...buildGateSplitSections(options.records),
    "## Top 10 Pairs By Return Delta (D - W)",
    "",
    renderMarkdownTable(
      ["Pair", "Asset Class", "W Fills", "W Return", "D Fills", "D Return", "Delta"],
      buildTopBottomDeltaRows(options.records, "top"),
    ),
    "",
    "## Bottom 10 Pairs By Return Delta (D - W)",
    "",
    renderMarkdownTable(
      ["Pair", "Asset Class", "W Fills", "W Return", "D Fills", "D Return", "Delta"],
      buildTopBottomDeltaRows(options.records, "bottom"),
    ),
    "",
    "## Notes",
    "",
    "- Weekly baseline uses one fill maximum per pair per week. No re-entries.",
    "- Daily variant uses one fill maximum per pair per rollover-defined trading day.",
    "- Direction is still weekly. Only the anchor granularity changes between variants.",
    "- Daily anchor periods are segmented from H1 bars using the 17:00 ET rollover rule.",
    "- Exit is TP or period close only. No stop loss, no confirmation logic.",
    "",
  ];

  return sections.join("\n");
}

async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  const generatedAtIso = DateTime.utc().toISO() ?? new Date().toISOString();

  console.log("\nADR Dip Daily Anchor — Test 6");
  console.log(`${weekOpens.length} completed weeks | Weekly vs Daily anchor | H1 execution\n`);

  console.log("Loading gate artifacts...");
  const gateMap = buildGateMap();
  const cotContext = await buildCotGateContext();
  console.log("Ready.\n");

  const records: PairWeekRecord[] = [];

  for (let weekIndex = 0; weekIndex < weekOpens.length; weekIndex += 1) {
    const weekOpenUtc = weekOpens[weekIndex]!;
    const label = weekLabel(weekOpenUtc);
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
        weekly: emptyPeriodEvaluation(
          canonicalWeekOpen.toISO() ?? weekOpenUtc,
          weekWindow.closeUtc.toISO() ?? weekOpenUtc,
          weekOpenUtc,
        ),
        daily: [],
      };

      let bars: OandaHourlyCandle[];
      try {
        bars = await fetchOandaCandleSeries(signal.pair, weekWindow.openUtc, weekWindow.closeUtc);
      } catch {
        record.weekly.skipReason = "oanda_fetch_failed";
        return record;
      }

      const dailySegments = buildDailySegments(bars);
      record.daily = dailySegments.map((segment) =>
        emptyPeriodEvaluation(
          segment.periodOpenUtc.toISO() ?? weekOpenUtc,
          segment.periodCloseUtc.toISO() ?? weekOpenUtc,
          segment.periodKey,
        ),
      );

      if (bars.length === 0) {
        record.weekly.skipReason = "no_h1_bars";
        for (const evaluation of record.daily) {
          evaluation.skipReason = "no_h1_bars";
        }
        return record;
      }

      const weeklyBars = bars.filter((bar) => bar.ts >= canonicalWeekOpen.toMillis());
      if (weeklyBars.length === 0) {
        record.weekly.skipReason = "no_week_anchor_bars";
      } else {
        record.weekly.anchorPrice = weeklyBars[0]!.open;
      }

      if (record.weekly.anchorPrice !== null) {
        try {
          const weekAdrPct = await computeAdrPct(signal.pair, canonicalWeekOpen.toISO() ?? weekOpenUtc);
          if (weekAdrPct === null) {
            record.weekly.skipReason = "insufficient_adr";
          } else {
            record.weekly.adrPct = weekAdrPct;
            record.weekly.eligible = true;
            record.weekly.fill = simulateSingleFill({
              variant: "W",
              week: weekOpenUtc,
              weekLabel: label,
              pair: signal.pair,
              direction: signal.direction,
              assetClass: signal.assetClass,
              signalMode: signal.signalMode,
              gateDecision: signal.gateDecision,
              anchorPrice: record.weekly.anchorPrice,
              adrPct: weekAdrPct,
              bars: weeklyBars,
              periodOpenUtc: record.weekly.periodOpenUtc,
              periodCloseUtc: record.weekly.periodCloseUtc,
              periodKey: record.weekly.periodKey,
            });
          }
        } catch {
          record.weekly.skipReason = "adr_query_failed";
        }
      }

      for (let index = 0; index < dailySegments.length; index += 1) {
        const segment = dailySegments[index]!;
        const evaluation = record.daily[index]!;
        evaluation.anchorPrice = segment.bars[0]?.open ?? null;
        if (segment.bars.length === 0 || evaluation.anchorPrice === null) {
          evaluation.skipReason = "no_h1_bars";
          continue;
        }

        try {
          const adrPct = await computeAdrPct(signal.pair, segment.periodOpenUtc.toISO() ?? weekOpenUtc);
          if (adrPct === null) {
            evaluation.skipReason = "insufficient_adr";
            continue;
          }

          evaluation.adrPct = adrPct;
          evaluation.eligible = true;
          evaluation.fill = simulateSingleFill({
            variant: "D",
            week: weekOpenUtc,
            weekLabel: label,
            pair: signal.pair,
            direction: signal.direction,
            assetClass: signal.assetClass,
            signalMode: signal.signalMode,
            gateDecision: signal.gateDecision,
            anchorPrice: evaluation.anchorPrice,
            adrPct,
            bars: segment.bars,
            periodOpenUtc: evaluation.periodOpenUtc,
            periodCloseUtc: evaluation.periodCloseUtc,
            periodKey: evaluation.periodKey,
          });
        } catch {
          evaluation.skipReason = "adr_query_failed";
        }
      }

      return record;
    });

    const weeklyEligible = weekResults.filter((record) => record.weekly.eligible).length;
    const weeklyFills = weekResults.filter((record) => record.weekly.fill !== null).length;
    const dailyEligible = weekResults.flatMap((record) => record.daily).filter((evaluation) => evaluation.eligible).length;
    const dailyFills = weekResults.flatMap((record) => record.daily).filter((evaluation) => evaluation.fill !== null).length;
    console.log(`  Signals: ${weekResults.length} | W eligible/fills: ${weeklyEligible}/${weeklyFills} | D eligible/fills: ${dailyEligible}/${dailyFills}`);

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
  console.log(renderMarkdownTable(
    ["Metric", "Weekly (W)", "Daily (D)"],
    buildSummaryComparisonRows(records),
  ));
  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log("Done.");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
