/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-dip-session-breakdown.ts
 *
 * Description:
 * Test 5 in the ADR dip-entry research program.
 *
 * Uses the same signal universe and H1 re-entry engine as Test 3 Variant A
 * (TP 0.25 ADR + unlimited re-entry, no session gating), but emits individual
 * fill records so performance can be decomposed by UTC session and hour.
 *
 * Usage: .\node_modules\.bin\tsx.cmd scripts/adr-dip-session-breakdown.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Load .env.local for DATABASE_URL and OANDA credentials
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
const REPORT_PATH = path.resolve(process.cwd(), "reports", "adr-dip-session-breakdown.md");

const MODEL_TO_TIER: Record<string, string | null> = {
  antikythera: null,
  antikythera_v2: null,
  antikythera_v3: "HIGH",
  blended: null,
  dealer: "MEDIUM",
  commercial: "LOW",
  sentiment: null,
};

const SESSION_ORDER = ["Asian", "London", "NY_Overlap", "NY_Afternoon", "Off_Hours"] as const;

type Direction = "LONG" | "SHORT";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type SignalMode = "GATED" | "NON_GATED";
type SessionBucket = typeof SESSION_ORDER[number];

type FillRecord = {
  pair: string;
  assetClass: AssetClass;
  direction: Direction;
  week: string;
  fillHour: number;
  fillTs: number;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  tpHit: boolean;
  isReentry: boolean;
  sessionBucket: SessionBucket;
  maePct: number;
  maeAdrMultiple: number;
  maxAdversePrice: number;
  barsToMaxAdverse: number;
  mfePct: number;
};

type InternalFillRecord = FillRecord & {
  signalMode: SignalMode;
  gateDecision: GateDecision;
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
  adrPct: number | null;
  dipEntryPrice: number | null;
  weekOpenPrice: number | null;
  weekClosePrice: number | null;
  eligible: boolean;
  skipReason: string | null;
  fills: InternalFillRecord[];
};

type AggregateStats = {
  fills: number;
  totalReturn: number;
  wins: number;
  tpHits: number;
  reentries: number;
};

type OpenFillState = Omit<InternalFillRecord, "exitPrice" | "returnPct" | "tpHit" | "maePct" | "maeAdrMultiple" | "maxAdversePrice" | "barsToMaxAdverse" | "mfePct"> & {
  adrPct: number;
  fillBarIndex: number;
  maxAdversePrice: number;
  bestFavorablePrice: number;
  barsToMaxAdverse: number;
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
  const dt = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
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

function sessionBucketForHour(hour: number): SessionBucket {
  if (hour >= 22 || hour < 7) return "Asian";
  if (hour >= 7 && hour < 12) return "London";
  if (hour >= 12 && hour < 16) return "NY_Overlap";
  if (hour >= 16 && hour < 20) return "NY_Afternoon";
  return "Off_Hours";
}

function emptyAggregate(): AggregateStats {
  return {
    fills: 0,
    totalReturn: 0,
    wins: 0,
    tpHits: 0,
    reentries: 0,
  };
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

function aggregateFills(fills: InternalFillRecord[]): AggregateStats {
  const stats = emptyAggregate();
  for (const fill of fills) {
    stats.fills += 1;
    stats.totalReturn += fill.returnPct;
    if (fill.returnPct > 0) stats.wins += 1;
    if (fill.tpHit) stats.tpHits += 1;
    if (fill.isReentry) stats.reentries += 1;
  }
  return stats;
}

function aggregateToRow(stats: AggregateStats) {
  return {
    fills: stats.fills,
    totalReturn: stats.fills > 0 ? stats.totalReturn : null,
    avgReturnPerFill: stats.fills > 0 ? stats.totalReturn / stats.fills : null,
    winRate: stats.fills > 0 ? (stats.wins / stats.fills) * 100 : null,
    tpHitRate: stats.fills > 0 ? (stats.tpHits / stats.fills) * 100 : null,
    reentries: stats.reentries,
  };
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

function median(values: number[]) {
  return quantile(values, 0.5);
}

function computeMaePct(direction: Direction, entryPrice: number, maxAdversePrice: number) {
  if (direction === "LONG") {
    return Math.max(0, ((entryPrice - maxAdversePrice) / entryPrice) * 100);
  }
  return Math.max(0, ((maxAdversePrice - entryPrice) / entryPrice) * 100);
}

function computeMfePct(direction: Direction, entryPrice: number, bestFavorablePrice: number) {
  if (direction === "LONG") {
    return Math.max(0, ((bestFavorablePrice - entryPrice) / entryPrice) * 100);
  }
  return Math.max(0, ((entryPrice - bestFavorablePrice) / entryPrice) * 100);
}

function updateOpenFillExtremes(
  openFill: OpenFillState,
  bar: OandaHourlyCandle,
  barIndex: number,
) {
  if (openFill.direction === "LONG") {
    if (bar.low < openFill.maxAdversePrice) {
      openFill.maxAdversePrice = bar.low;
      openFill.barsToMaxAdverse = barIndex - openFill.fillBarIndex;
    }
    if (bar.high > openFill.bestFavorablePrice) {
      openFill.bestFavorablePrice = bar.high;
    }
    return;
  }

  if (bar.high > openFill.maxAdversePrice) {
    openFill.maxAdversePrice = bar.high;
    openFill.barsToMaxAdverse = barIndex - openFill.fillBarIndex;
  }
  if (bar.low < openFill.bestFavorablePrice) {
    openFill.bestFavorablePrice = bar.low;
  }
}

function finalizeOpenFill(openFill: OpenFillState, exitPrice: number, tpHit: boolean): InternalFillRecord {
  const maePct = computeMaePct(openFill.direction, openFill.entryPrice, openFill.maxAdversePrice);
  return {
    pair: openFill.pair,
    assetClass: openFill.assetClass,
    direction: openFill.direction,
    week: openFill.week,
    fillHour: openFill.fillHour,
    fillTs: openFill.fillTs,
    entryPrice: openFill.entryPrice,
    exitPrice,
    returnPct: tpHit ? TP_MULTIPLIER * openFill.adrPct : signedReturnPct(openFill.direction, openFill.entryPrice, exitPrice),
    tpHit,
    isReentry: openFill.isReentry,
    sessionBucket: openFill.sessionBucket,
    maePct,
    maeAdrMultiple: openFill.adrPct > 0 ? maePct / openFill.adrPct : 0,
    maxAdversePrice: openFill.maxAdversePrice,
    barsToMaxAdverse: openFill.barsToMaxAdverse,
    mfePct: computeMfePct(openFill.direction, openFill.entryPrice, openFill.bestFavorablePrice),
    signalMode: openFill.signalMode,
    gateDecision: openFill.gateDecision,
  };
}

function simulateVariantAFills(options: {
  pair: string;
  assetClass: AssetClass;
  direction: Direction;
  week: string;
  bars: OandaHourlyCandle[];
  adrPct: number;
  dipEntryPrice: number;
  signalMode: SignalMode;
  gateDecision: GateDecision;
}): InternalFillRecord[] {
  if (options.bars.length === 0) return [];

  const fills: InternalFillRecord[] = [];
  const tpPrice =
    options.direction === "LONG"
      ? options.dipEntryPrice * (1 + ((TP_MULTIPLIER * options.adrPct) / 100))
      : options.dipEntryPrice * (1 - ((TP_MULTIPLIER * options.adrPct) / 100));
  let openFill: OpenFillState | null = null;
  let fillCount = 0;

  for (let barIndex = 0; barIndex < options.bars.length; barIndex += 1) {
    const bar = options.bars[barIndex]!;
    if (!openFill) {
      const fillHit = options.direction === "LONG"
        ? bar.low <= options.dipEntryPrice
        : bar.high >= options.dipEntryPrice;
      if (!fillHit) continue;

      const fillHour = DateTime.fromMillis(bar.ts, { zone: "utc" }).hour;
      openFill = {
        pair: options.pair,
        assetClass: options.assetClass,
        direction: options.direction,
        week: options.week,
        fillHour,
        fillTs: bar.ts,
        entryPrice: options.dipEntryPrice,
        isReentry: fillCount > 0,
        sessionBucket: sessionBucketForHour(fillHour),
        adrPct: options.adrPct,
        fillBarIndex: barIndex,
        maxAdversePrice: options.direction === "LONG" ? Math.min(options.dipEntryPrice, bar.low) : Math.max(options.dipEntryPrice, bar.high),
        bestFavorablePrice: options.direction === "LONG" ? Math.max(options.dipEntryPrice, bar.high) : Math.min(options.dipEntryPrice, bar.low),
        barsToMaxAdverse: 0,
        signalMode: options.signalMode,
        gateDecision: options.gateDecision,
      };
      fillCount += 1;

      const sameBarTpHit = options.direction === "LONG"
        ? bar.high >= tpPrice
        : bar.low <= tpPrice;
      if (sameBarTpHit) {
        fills.push(finalizeOpenFill(openFill, tpPrice, true));
        openFill = null;
      }
      continue;
    }

    updateOpenFillExtremes(openFill, bar, barIndex);
    const tpHit = options.direction === "LONG"
      ? bar.high >= tpPrice
      : bar.low <= tpPrice;
    if (tpHit) {
      fills.push(finalizeOpenFill(openFill, tpPrice, true));
      openFill = null;
    }
  }

  if (openFill) {
    const lastClose = options.bars[options.bars.length - 1]!.close;
    fills.push(finalizeOpenFill(openFill, lastClose, false));
  }

  return fills;
}

function buildMaeDistributionRows(fills: InternalFillRecord[]): string[][] {
  const buckets = [
    { label: "0.00 - 0.10", min: 0, max: 0.1 },
    { label: "0.10 - 0.25", min: 0.1, max: 0.25 },
    { label: "0.25 - 0.50", min: 0.25, max: 0.5 },
    { label: "0.50 - 0.75", min: 0.5, max: 0.75 },
    { label: "0.75 - 1.00", min: 0.75, max: 1.0 },
    { label: "1.00 - 1.50", min: 1.0, max: 1.5 },
    { label: "1.50+", min: 1.5, max: Number.POSITIVE_INFINITY },
  ];
  let cumulative = 0;
  return buckets.map((bucket) => {
    const bucketFills = fills.filter((fill) =>
      bucket.max === Number.POSITIVE_INFINITY
        ? fill.maeAdrMultiple >= bucket.min
        : fill.maeAdrMultiple >= bucket.min && fill.maeAdrMultiple < bucket.max,
    );
    const stats = aggregateToRow(aggregateFills(bucketFills));
    const pctOfTotal = fills.length > 0 ? (bucketFills.length / fills.length) * 100 : null;
    cumulative += bucketFills.length;
    const cumulativePct = fills.length > 0 ? (cumulative / fills.length) * 100 : null;
    return [
      bucket.label,
      String(bucketFills.length),
      fmtRate(pctOfTotal),
      fmtRate(cumulativePct),
      fmtPct(stats.avgReturnPerFill),
      fmtRate(stats.winRate),
    ];
  });
}

function buildMaePerAssetRows(fills: InternalFillRecord[]): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  return assetClasses.map((assetClass) => {
    const values = fills
      .filter((fill) => fill.assetClass === assetClass)
      .map((fill) => fill.maeAdrMultiple);
    return [
      assetClass,
      fmtNum(values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null),
      fmtNum(median(values)),
      fmtNum(quantile(values, 0.95)),
      fmtNum(values.length > 0 ? Math.max(...values) : null),
    ];
  });
}

function buildMaeVsOutcomeRows(fills: InternalFillRecord[]): string[][] {
  const groups = [
    { label: "TP Hit", rows: fills.filter((fill) => fill.tpHit) },
    { label: "Fallback Win", rows: fills.filter((fill) => !fill.tpHit && fill.returnPct > 0) },
    { label: "Fallback Loss", rows: fills.filter((fill) => !fill.tpHit && fill.returnPct <= 0) },
  ];
  return groups.map((group) => {
    const values = group.rows.map((fill) => fill.maeAdrMultiple);
    return [
      group.label,
      String(group.rows.length),
      fmtNum(values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null),
      fmtNum(median(values)),
      fmtNum(quantile(values, 0.95)),
    ];
  });
}

function buildWorstFillsRows(fills: InternalFillRecord[]): string[][] {
  return [...fills]
    .sort((a, b) => b.maeAdrMultiple - a.maeAdrMultiple)
    .slice(0, 10)
    .map((fill, index) => [
      String(index + 1),
      fill.pair,
      weekLabel(fill.week),
      fill.direction,
      fmtNum(fill.maeAdrMultiple),
      fmtPct(fill.maePct),
      String(fill.barsToMaxAdverse),
      fmtPct(fill.returnPct),
      fill.tpHit ? "YES" : "NO",
    ]);
}

function buildPositionSizingSection(fills: InternalFillRecord[]): string[] {
  const maeValues = fills.map((fill) => fill.maeAdrMultiple);
  const p95Mae = quantile(maeValues, 0.95);
  const stopLevels = [0.5, 0.75, 1.0].map((level) => ({
    level,
    stoppedPct: fills.length > 0
      ? (fills.filter((fill) => fill.maeAdrMultiple >= level).length / fills.length) * 100
      : 0,
  }));

  const recommendation = p95Mae !== null
    ? `Inference: size each fill assuming at least a ${p95Mae.toFixed(2)}x ADR adverse move, and because re-entries can cluster, keep per-fill account risk conservative rather than using an aggressive full-size weekly position.`
    : "Not enough fills to derive a meaningful sizing recommendation.";

  return [
    `At 0.50x ADR stop: ${stopLevels[0]!.stoppedPct.toFixed(1)}% of fills would be stopped out.`,
    `At 0.75x ADR stop: ${stopLevels[1]!.stoppedPct.toFixed(1)}% of fills would be stopped out.`,
    `At 1.00x ADR stop: ${stopLevels[2]!.stoppedPct.toFixed(1)}% of fills would be stopped out.`,
    `Combined P95 MAE: ${fmtNum(p95Mae)}x ADR.`,
    `Recommended maximum risk per trade: ${recommendation}`,
  ];
}

function sortSessionsByReturnDesc(fills: InternalFillRecord[]) {
  const totals = new Map<SessionBucket, number>();
  for (const session of SESSION_ORDER) {
    totals.set(session, 0);
  }
  for (const fill of fills) {
    totals.set(fill.sessionBucket, (totals.get(fill.sessionBucket) ?? 0) + fill.returnPct);
  }
  return [...SESSION_ORDER].sort((a, b) => {
    const delta = (totals.get(b) ?? 0) - (totals.get(a) ?? 0);
    if (delta !== 0) return delta;
    return SESSION_ORDER.indexOf(a) - SESSION_ORDER.indexOf(b);
  });
}

function buildSessionSummaryRows(fills: InternalFillRecord[]): string[][] {
  const rows = SESSION_ORDER.map((session) => {
    const sessionFills = fills.filter((fill) => fill.sessionBucket === session);
    const stats = aggregateToRow(aggregateFills(sessionFills));
    return {
      session,
      cells: [
        session,
        String(stats.fills),
        fmtPct(stats.totalReturn),
        fmtPct(stats.avgReturnPerFill),
        fmtRate(stats.winRate),
        fmtRate(stats.tpHitRate),
        String(stats.reentries),
      ],
      totalReturn: stats.totalReturn ?? Number.NEGATIVE_INFINITY,
    };
  });

  return rows
    .sort((a, b) => b.totalReturn - a.totalReturn)
    .map((row) => row.cells);
}

function buildSessionAssetRows(fills: InternalFillRecord[]): string[][] {
  const sessionOrder = sortSessionsByReturnDesc(fills);
  const rows: Array<{ sessionIndex: number; totalReturn: number; cells: string[] }> = [];

  for (const session of sessionOrder) {
    const sessionFills = fills.filter((fill) => fill.sessionBucket === session);
    const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
    for (const assetClass of assetClasses) {
      const assetFills = sessionFills.filter((fill) => fill.assetClass === assetClass);
      const stats = aggregateToRow(aggregateFills(assetFills));
      rows.push({
        sessionIndex: sessionOrder.indexOf(session),
        totalReturn: stats.totalReturn ?? Number.NEGATIVE_INFINITY,
        cells: [
          session,
          assetClass,
          String(stats.fills),
          fmtPct(stats.totalReturn),
          fmtPct(stats.avgReturnPerFill),
          fmtRate(stats.winRate),
        ],
      });
    }
  }

  return rows
    .sort((a, b) => {
      if (a.sessionIndex !== b.sessionIndex) return a.sessionIndex - b.sessionIndex;
      return b.totalReturn - a.totalReturn;
    })
    .map((row) => row.cells);
}

function buildPerHourRows(fills: InternalFillRecord[]): string[][] {
  const rows: string[][] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const hourFills = fills.filter((fill) => fill.fillHour === hour);
    const stats = aggregateToRow(aggregateFills(hourFills));
    rows.push([
      String(hour).padStart(2, "0"),
      String(stats.fills),
      fmtPct(stats.totalReturn),
      fmtPct(stats.avgReturnPerFill),
      fmtRate(stats.winRate),
      sessionBucketForHour(hour),
    ]);
  }
  return rows;
}

function buildBestSessionPerAssetRows(fills: InternalFillRecord[]): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  return assetClasses.map((assetClass) => {
    const assetFills = fills.filter((fill) => fill.assetClass === assetClass);
    if (assetFills.length === 0) {
      return [assetClass, "No fills", "0", "—", "—"];
    }
    const candidates = SESSION_ORDER.map((session) => {
      const stats = aggregateToRow(
        aggregateFills(assetFills.filter((fill) => fill.sessionBucket === session)),
      );
      return { session, stats };
    });
    candidates.sort((a, b) => {
      const returnDelta = (b.stats.totalReturn ?? Number.NEGATIVE_INFINITY) - (a.stats.totalReturn ?? Number.NEGATIVE_INFINITY);
      if (returnDelta !== 0) return returnDelta;
      return (b.stats.fills ?? 0) - (a.stats.fills ?? 0);
    });
    const best = candidates[0]!;
    return [
      assetClass,
      best.session,
      String(best.stats.fills),
      fmtPct(best.stats.totalReturn),
      fmtRate(best.stats.winRate),
    ];
  });
}

function buildModeSessionRows(fills: InternalFillRecord[]): string[][] {
  const rows: Array<{ totalReturn: number; cells: string[] }> = [];
  const modes: SignalMode[] = ["GATED", "NON_GATED"];
  const sessionOrder = sortSessionsByReturnDesc(fills);
  for (const session of sessionOrder) {
    for (const mode of modes) {
      const modeFills = fills.filter((fill) => fill.sessionBucket === session && fill.signalMode === mode);
      const stats = aggregateToRow(aggregateFills(modeFills));
      rows.push({
        totalReturn: stats.totalReturn ?? Number.NEGATIVE_INFINITY,
        cells: [
          session,
          mode === "GATED" ? "GATED (PASS/NO_DATA)" : "NON-GATED (SKIP/REDUCE)",
          String(stats.fills),
          fmtPct(stats.totalReturn),
          fmtPct(stats.avgReturnPerFill),
          fmtRate(stats.winRate),
        ],
      });
    }
  }
  return rows.map((row) => row.cells);
}

function buildCanYouTradeOneSessionSection(fills: InternalFillRecord[]): string[] {
  const overallStats = aggregateToRow(aggregateFills(fills));
  const sessionStats = SESSION_ORDER
    .map((session) => {
      const stats = aggregateToRow(aggregateFills(fills.filter((fill) => fill.sessionBucket === session)));
      return { session, stats };
    })
    .sort((a, b) => (b.stats.totalReturn ?? Number.NEGATIVE_INFINITY) - (a.stats.totalReturn ?? Number.NEGATIVE_INFINITY));

  const best = sessionStats[0]!;
  const fillCapturePct =
    overallStats.fills > 0
      ? (best.stats.fills / overallStats.fills) * 100
      : 0;
  const returnCapturePct =
    overallStats.totalReturn !== null && overallStats.totalReturn !== 0 && best.stats.totalReturn !== null
      ? (best.stats.totalReturn / overallStats.totalReturn) * 100
      : 0;
  const opportunityCost =
    overallStats.totalReturn !== null && best.stats.totalReturn !== null
      ? overallStats.totalReturn - best.stats.totalReturn
      : null;

  const recommendation =
    returnCapturePct >= 60
      ? `Yes. ${best.session} captures enough of the edge to justify focusing execution there first.`
      : returnCapturePct >= 40
        ? `Partially. ${best.session} is the best primary focus, but skipping the rest of the day leaves material return on the table.`
        : `No. ${best.session} leads, but the edge is too distributed across the day to justify a one-session-only rule.`;

  return [
    `Best session: **${best.session}**.`,
    `It captures **${fillCapturePct.toFixed(1)}%** of all fills and **${returnCapturePct.toFixed(1)}%** of total return.`,
    `Skipping every other session would leave **${fmtPct(opportunityCost)}** of return on the table.`,
    `Recommendation: ${recommendation}`,
  ];
}

function buildGateDecisionRows(records: PairWeekRecord[]): string[][] {
  const decisions: GateDecision[] = ["PASS", "NO_DATA", "REDUCE", "SKIP"];
  return decisions.map((decision) => [
    decision,
    String(records.filter((record) => record.gateDecision === decision).length),
  ]);
}

function buildSkipReasonRows(records: PairWeekRecord[]): string[][] {
  const skipCounts = new Map<string, number>();
  for (const record of records) {
    if (!record.skipReason) continue;
    skipCounts.set(record.skipReason, (skipCounts.get(record.skipReason) ?? 0) + 1);
  }
  return [...skipCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([reason, count]) => [reason, String(count)]);
}

function buildMarkdownReport(options: {
  records: PairWeekRecord[];
  fills: InternalFillRecord[];
  generatedAtIso: string;
}): string {
  const bestSessionSection = buildCanYouTradeOneSessionSection(options.fills);
  const positionSizingSection = buildPositionSizingSection(options.fills);
  const sections = [
    "# ADR Dip Session Breakdown",
    "",
    `Generated: ${options.generatedAtIso}`,
    "",
    "## What We're Building And Why",
    "",
    "This test isolates the Test 3 winner: TP 0.25 ADR with unlimited re-entry and no session gating. Instead of asking whether a hard session filter improves returns, the goal here is twofold: identify which UTC session actually produces the best fills, and measure how far filled trades typically travel against the position before recovering so execution and sizing can be tuned together.",
    "",
    "The engine is otherwise unchanged from Test 3. It uses the same Tiered V3 directional universe, the same 1x ADR dip-entry anchor, the same H1 OANDA candles, and the same unlimited re-entry state machine.",
    "",
    "## Universe Summary",
    "",
    renderMarkdownTable(
      ["Metric", "Value"],
      [
        ["Signals processed", String(options.records.length)],
        ["Eligible pair-weeks", String(options.records.filter((record) => record.eligible).length)],
        ["Skipped pair-weeks", String(options.records.filter((record) => !record.eligible).length)],
        ["Total fills", String(options.fills.length)],
        ["Total return", fmtPct(aggregateToRow(aggregateFills(options.fills)).totalReturn)],
      ],
    ),
    "",
    renderMarkdownTable(["Gate Decision", "Signals"], buildGateDecisionRows(options.records)),
    "",
  ];

  const skipReasonRows = buildSkipReasonRows(options.records);
  if (skipReasonRows.length > 0) {
    sections.push(renderMarkdownTable(["Skip Reason", "Signals"], skipReasonRows));
    sections.push("");
  }

  sections.push("## Session Summary");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Session", "Fills", "Total Return", "Avg Return/Fill", "Win Rate", "TP Hit Rate", "Re-entries"],
      buildSessionSummaryRows(options.fills),
    ),
  );
  sections.push("");

  sections.push("## Session x Asset Class Breakdown");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Session", "Asset Class", "Fills", "Total Return", "Avg Return/Fill", "Win Rate"],
      buildSessionAssetRows(options.fills),
    ),
  );
  sections.push("");

  sections.push("## Per-Hour Heatmap");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Hour (UTC)", "Fills", "Total Return", "Avg Return/Fill", "Win Rate", "Session"],
      buildPerHourRows(options.fills),
    ),
  );
  sections.push("");

  sections.push("## Best Session Per Asset Class");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Asset Class", "Best Session", "Fills", "Total Return", "Win Rate"],
      buildBestSessionPerAssetRows(options.fills),
    ),
  );
  sections.push("");

  sections.push("## Gated Vs Non-Gated Session Split");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Session", "Mode", "Fills", "Total Return", "Avg Return/Fill", "Win Rate"],
      buildModeSessionRows(options.fills),
    ),
  );
  sections.push("");

  sections.push('## "Can You Trade One Session?" Analysis');
  sections.push("");
  sections.push(...bestSessionSection);
  sections.push("");

  sections.push("## MAE Distribution");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["MAE Bucket (xADR)", "Fills", "% of Total", "Cumulative %", "Avg Return", "Win Rate"],
      buildMaeDistributionRows(options.fills),
    ),
  );
  sections.push("");

  sections.push("## MAE Per Asset Class");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Asset Class", "Avg MAE (xADR)", "Median MAE (xADR)", "P95 MAE (xADR)", "Max MAE (xADR)"],
      buildMaePerAssetRows(options.fills),
    ),
  );
  sections.push("");

  sections.push("## MAE Vs Outcome");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Outcome", "Count", "Avg MAE (xADR)", "Median MAE (xADR)", "P95 MAE (xADR)"],
      buildMaeVsOutcomeRows(options.fills),
    ),
  );
  sections.push("");

  sections.push("## Worst Fills");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Rank", "Pair", "Week", "Direction", "MAE (xADR)", "maePct", "Bars to MAE", "Final Return", "TP Hit?"],
      buildWorstFillsRows(options.fills),
    ),
  );
  sections.push("");

  sections.push("## Position Sizing Implications");
  sections.push("");
  sections.push(...positionSizingSection);
  sections.push("");

  return sections.join("\n");
}

async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  const generatedAtIso = DateTime.utc().toISO() ?? new Date().toISOString();

  console.log("\nADR Dip Session Breakdown");
  console.log(`${weekOpens.length} completed weeks | H1 execution | Variant A only`);
  console.log("Universe: Tiered V3 directional signals across all asset classes\n");

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
            reduceAsSkip: false,
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
        adrPct: null,
        dipEntryPrice: null,
        weekOpenPrice: null,
        weekClosePrice: null,
        eligible: false,
        skipReason: null,
        fills: [],
      };

      const adrRowsPromise = query<{ open_price: string; high_price: string; low_price: string }>(
        `SELECT open_price, high_price, low_price
         FROM pair_period_returns
         WHERE symbol = $1
           AND period_type = 'daily'
           AND period_open_utc < $2::timestamptz
         ORDER BY period_open_utc DESC
         LIMIT $3`,
        [signal.pair, weekWindow.openUtc.toISO(), ADR_LOOKBACK_DAYS],
      );
      const barsPromise = fetchOandaCandleSeries(signal.pair, weekWindow.openUtc, weekWindow.closeUtc);

      const [adrResult, barsResult] = await Promise.allSettled([adrRowsPromise, barsPromise]);
      if (adrResult.status === "rejected") {
        record.skipReason = "adr_query_failed";
        return record;
      }
      if (barsResult.status === "rejected") {
        record.skipReason = "oanda_fetch_failed";
        return record;
      }

      const adrRows = adrResult.value;
      const bars = barsResult.value;

      const adrRanges = adrRows
        .map((row) => {
          const openPrice = toFinite(row.open_price);
          const highPrice = toFinite(row.high_price);
          const lowPrice = toFinite(row.low_price);
          if (openPrice === null || openPrice <= 0 || highPrice === null || lowPrice === null) return null;
          return ((highPrice - lowPrice) / openPrice) * 100;
        })
        .filter((value): value is number => value !== null && Number.isFinite(value));

      if (adrRanges.length < ADR_MIN_REQUIRED_DAYS) {
        record.skipReason = "insufficient_adr";
        return record;
      }
      if (bars.length === 0) {
        record.skipReason = "no_h1_bars";
        return record;
      }

      record.eligible = true;
      record.adrPct = adrRanges.reduce((sum, value) => sum + value, 0) / adrRanges.length;
      record.weekOpenPrice = bars[0]!.open;
      record.weekClosePrice = bars[bars.length - 1]!.close;

      const thresholdPct = record.adrPct * ADR_MULTIPLIER;
      record.dipEntryPrice =
        signal.direction === "LONG"
          ? record.weekOpenPrice * (1 - (thresholdPct / 100))
          : record.weekOpenPrice * (1 + (thresholdPct / 100));

      record.fills = simulateVariantAFills({
        pair: signal.pair,
        assetClass: signal.assetClass,
        direction: signal.direction,
        week: weekOpenUtc,
        bars,
        adrPct: record.adrPct,
        dipEntryPrice: record.dipEntryPrice,
        signalMode: signal.signalMode,
        gateDecision: signal.gateDecision,
      });

      return record;
    });

    const eligibleCount = weekResults.filter((record) => record.eligible).length;
    const fillCount = weekResults.reduce((sum, record) => sum + record.fills.length, 0);
    console.log(`  Signals: ${weekResults.length} | Eligible: ${eligibleCount} | Fills: ${fillCount}`);
    records.push(...weekResults);
  }

  const fills = records.flatMap((record) => record.fills);
  const overallStats = aggregateToRow(aggregateFills(fills));

  console.log("\nSession Summary");
  console.log(renderMarkdownTable(
    ["Session", "Fills", "Total Return", "Avg Return/Fill", "Win Rate", "TP Hit Rate", "Re-entries"],
    buildSessionSummaryRows(fills),
  ));
  console.log("");
  console.log(`Total fills: ${overallStats.fills}`);
  console.log(`Total return: ${fmtPct(overallStats.totalReturn)}`);

  const reportText = buildMarkdownReport({
    records,
    fills,
    generatedAtIso,
  });
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${reportText}\n`, "utf8");

  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
