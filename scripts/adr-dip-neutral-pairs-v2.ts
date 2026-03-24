/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-dip-neutral-pairs-v2.ts
 *
 * Description:
 * Test 4B: Neutral pair both-sides ADR dip backtest clean re-run.
 * Fixes weekly reporting gaps, adds audit detail, and isolates
 * commodity-only and FX-only neutral performance.
 *
 * Usage: .\node_modules\.bin\tsx.cmd scripts/adr-dip-neutral-pairs-v2.ts
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
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { fetchOandaCandleSeries, type OandaHourlyCandle } from "@/lib/oandaPrices";
import { computeTieredWeekForSystem } from "@/lib/performance/tiered";
import { readPerformanceSnapshotsByWeek } from "@/lib/performanceSnapshots";
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
const REPORT_PATH = path.resolve(process.cwd(), "reports", "adr-dip-neutral-pairs-v2.md");

const MODEL_TO_TIER: Record<string, string | null> = {
  antikythera: null,
  antikythera_v2: null,
  antikythera_v3: "HIGH",
  blended: null,
  dealer: "MEDIUM",
  commercial: "LOW",
  sentiment: null,
};

const SOURCE_VOTE_MODELS = ["dealer", "commercial", "sentiment"] as const;
const SESSION_ORDER = ["Asian", "London", "NY_Overlap", "NY_Afternoon", "Off_Hours"] as const;

type Direction = "LONG" | "SHORT";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type SignalMode = "GATED" | "NON_GATED";
type SessionBucket = typeof SESSION_ORDER[number];
type VoteDirection = Direction | "NEUTRAL";
type StrategyMode = "NEUTRAL" | "DIRECTIONAL_SKIP" | "DIRECTIONAL_BASELINE";
type SourceVoteModel = typeof SOURCE_VOTE_MODELS[number];

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
  strategyMode: StrategyMode;
};

type NeutralPairWeekRecord = {
  week: string;
  weekLabel: string;
  pair: string;
  assetClass: AssetClass;
  votes: Record<SourceVoteModel, VoteDirection>;
  neutralKind: "CONFLICTING" | "SILENT";
  adrPct: number | null;
  weekOpenPrice: number | null;
  weekClosePrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  eligible: boolean;
  skipReason: string | null;
  longFills: InternalFillRecord[];
  shortFills: InternalFillRecord[];
};

type DirectionalSkipPairWeekRecord = {
  week: string;
  weekLabel: string;
  pair: string;
  assetClass: AssetClass;
  direction: Direction;
  tier: number;
  adrPct: number | null;
  weekOpenPrice: number | null;
  weekClosePrice: number | null;
  dipEntryPrice: number | null;
  eligible: boolean;
  skipReason: string | null;
  fills: InternalFillRecord[];
};

type NeutralAuditRecord = {
  week: string;
  weekLabel: string;
  pair: string;
  assetClass: AssetClass;
  votes: Record<SourceVoteModel, VoteDirection>;
  neutralKind: "CONFLICTING" | "SILENT";
};

type DirectionalBaselinePairWeekRecord = {
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

function classifyTierForVotes(longCount: number, shortCount: number, neutralCount: number, voters: number) {
  if (voters === 2) {
    if (longCount === 2) return { tier: 1 as const, direction: "LONG" as const };
    if (shortCount === 2) return { tier: 1 as const, direction: "SHORT" as const };
    if (longCount === 1 && neutralCount === 1) return { tier: 2 as const, direction: "LONG" as const };
    if (shortCount === 1 && neutralCount === 1) return { tier: 2 as const, direction: "SHORT" as const };
    return null;
  }

  if (longCount === voters) return { tier: 1 as const, direction: "LONG" as const };
  if (shortCount === voters) return { tier: 1 as const, direction: "SHORT" as const };

  const maxDirectional = Math.max(longCount, shortCount);
  if (maxDirectional === voters - 1) {
    return longCount > shortCount
      ? { tier: 2 as const, direction: "LONG" as const }
      : { tier: 2 as const, direction: "SHORT" as const };
  }

  if (longCount > shortCount && longCount > 0) return { tier: 3 as const, direction: "LONG" as const };
  if (shortCount > longCount && shortCount > 0) return { tier: 3 as const, direction: "SHORT" as const };
  return null;
}

function voteDirectionFromDetails(
  pairDetails: Array<{ pair?: string | null; direction?: string | null }> | null | undefined,
): Map<string, VoteDirection> {
  const output = new Map<string, VoteDirection>();
  for (const detail of pairDetails ?? []) {
    const pair = String(detail.pair ?? "").trim().toUpperCase();
    const direction = String(detail.direction ?? "").trim().toUpperCase();
    if (!pair) continue;
    if (direction === "LONG" || direction === "SHORT") {
      output.set(pair, direction);
    }
  }
  return output;
}

function summarizeVotes(
  pair: string,
  voteMaps: Array<Map<string, VoteDirection>>,
): { longCount: number; shortCount: number; neutralCount: number } {
  let longCount = 0;
  let shortCount = 0;
  let neutralCount = 0;
  for (const voteMap of voteMaps) {
    const direction = voteMap.get(pair) ?? "NEUTRAL";
    if (direction === "LONG") longCount += 1;
    else if (direction === "SHORT") shortCount += 1;
    else neutralCount += 1;
  }
  return { longCount, shortCount, neutralCount };
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
  strategyMode: StrategyMode;
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
        strategyMode: options.strategyMode,
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

function simulateNeutralBothSides(options: {
  pair: string;
  assetClass: AssetClass;
  week: string;
  bars: OandaHourlyCandle[];
  adrPct: number;
  weekOpenPrice: number;
}): { longFills: InternalFillRecord[]; shortFills: InternalFillRecord[] } {
  const triggerDistancePct = options.adrPct * ADR_MULTIPLIER;
  const longTriggerPrice = options.weekOpenPrice * (1 - (triggerDistancePct / 100));
  const shortTriggerPrice = options.weekOpenPrice * (1 + (triggerDistancePct / 100));

  const longFills = simulateVariantAFills({
    pair: options.pair,
    assetClass: options.assetClass,
    direction: "LONG",
    week: options.week,
    bars: options.bars,
    adrPct: options.adrPct,
    dipEntryPrice: longTriggerPrice,
    signalMode: "NON_GATED",
    gateDecision: "NO_DATA",
    strategyMode: "NEUTRAL",
  });
  const shortFills = simulateVariantAFills({
    pair: options.pair,
    assetClass: options.assetClass,
    direction: "SHORT",
    week: options.week,
    bars: options.bars,
    adrPct: options.adrPct,
    dipEntryPrice: shortTriggerPrice,
    signalMode: "NON_GATED",
    gateDecision: "NO_DATA",
    strategyMode: "NEUTRAL",
  });

  return { longFills, shortFills };
}

async function loadWeekCandidates(options: {
  weekOpenUtc: string;
  gateMap: ReturnType<typeof buildGateMap>;
  cotContext: Awaited<ReturnType<typeof buildCotGateContext>>;
}) {
  const snapshots = await readPerformanceSnapshotsByWeek(options.weekOpenUtc);
  const voteMaps = SOURCE_VOTE_MODELS.map((model) => {
    const merged = new Map<string, VoteDirection>();
    for (const snapshot of snapshots.filter((row) => row.model === model)) {
      for (const [pair, direction] of voteDirectionFromDetails(
        snapshot.pair_details as Array<{ pair?: string | null; direction?: string | null }> | null | undefined,
      )) {
        merged.set(pair, direction);
      }
    }
    return merged;
  });

  const neutralCandidates: Array<{
    pair: string;
    assetClass: AssetClass;
    votes: Record<SourceVoteModel, VoteDirection>;
    neutralKind: "CONFLICTING" | "SILENT";
  }> = [];
  const directionalSkipCandidates: Array<{
    pair: string;
    assetClass: AssetClass;
    direction: Direction;
    tier: number;
  }> = [];

  for (const [assetClass, pairDefs] of Object.entries(PAIRS_BY_ASSET_CLASS) as Array<
    [AssetClass, Array<{ pair: string }>]
  >) {
    for (const pairDef of pairDefs) {
      const pair = pairDef.pair.toUpperCase();
      const { longCount, shortCount, neutralCount } = summarizeVotes(pair, voteMaps);
      const votes = Object.fromEntries(
        SOURCE_VOTE_MODELS.map((model, index) => [model, voteMaps[index]!.get(pair) ?? "NEUTRAL"]),
      ) as Record<SourceVoteModel, VoteDirection>;
      const classified = classifyTierForVotes(longCount, shortCount, neutralCount, SOURCE_VOTE_MODELS.length);

      if (!classified) {
        neutralCandidates.push({
          pair,
          assetClass,
          votes,
          neutralKind: longCount === 0 && shortCount === 0 ? "SILENT" : "CONFLICTING",
        });
        continue;
      }

      let gate: { decision: GateDecision; reasons: string[] };
      try {
        gate = evaluatePairWithGate({
          pair,
          weekOpenUtc: options.weekOpenUtc,
          direction: classified.direction,
          assetClass,
          gateMap: options.gateMap,
          cotContext: options.cotContext,
          reduceAsSkip: false,
        });
      } catch {
        gate = { decision: "NO_DATA", reasons: ["gate_eval_error"] };
      }

      if (gate.decision === "SKIP") {
        directionalSkipCandidates.push({
          pair,
          assetClass,
          direction: classified.direction,
          tier: classified.tier,
        });
      }
    }
  }

  return { neutralCandidates, directionalSkipCandidates };
}

function buildNeutralWeekRows(weekOpens: string[], records: NeutralPairWeekRecord[]): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  const rows: string[][] = [];
  for (const weekOpen of weekOpens) {
    const weekRecords = records.filter((record) => record.week === weekOpen);
    const weekLongFills = weekRecords.flatMap((record) => record.longFills);
    const weekShortFills = weekRecords.flatMap((record) => record.shortFills);
    const combinedStats = aggregateToRow(aggregateFills([...weekLongFills, ...weekShortFills]));
    rows.push([
      weekLabel(weekOpen),
      "TOTAL",
      String(weekRecords.length),
      String(weekLongFills.length),
      String(weekShortFills.length),
      fmtPct(combinedStats.totalReturn),
    ]);
    for (const assetClass of assetClasses) {
      const assetRecords = weekRecords.filter((record) => record.assetClass === assetClass);
      const assetLongFills = assetRecords.flatMap((record) => record.longFills);
      const assetShortFills = assetRecords.flatMap((record) => record.shortFills);
      const assetStats = aggregateToRow(aggregateFills([...assetLongFills, ...assetShortFills]));
      rows.push([
        "",
        assetClass,
        String(assetRecords.length),
        String(assetLongFills.length),
        String(assetShortFills.length),
        fmtPct(assetStats.totalReturn),
      ]);
    }
  }
  return rows;
}

function buildVariantWeekRows(weekOpens: string[], records: NeutralPairWeekRecord[]): string[][] {
  return weekOpens.map((weekOpen) => {
    const weekRecords = records.filter((record) => record.week === weekOpen);
    const longFills = weekRecords.flatMap((record) => record.longFills);
    const shortFills = weekRecords.flatMap((record) => record.shortFills);
    const combinedStats = aggregateToRow(aggregateFills([...longFills, ...shortFills]));
    return [
      weekLabel(weekOpen),
      String(weekRecords.length),
      String(longFills.length),
      String(shortFills.length),
      fmtPct(combinedStats.totalReturn),
    ];
  });
}

function buildUniverseSummaryRows(records: NeutralPairWeekRecord[], weekOpens: string[]): string[][] {
  const eligible = records.filter((record) => record.eligible);
  const activeWeekCount = weekOpens.filter((weekOpen) => records.some((record) => record.week === weekOpen)).length;
  const averagePerActiveWeek = activeWeekCount > 0 ? records.length / activeWeekCount : 0;
  return [
    ["Total neutral pair-weeks available", String(records.length)],
    ["Eligible neutral pair-weeks", String(eligible.length)],
    ["Neutral-pair activity", `${records.length} neutral pairs across ${activeWeekCount} active weeks (${activeWeekCount}/${weekOpens.length} weeks had neutral pairs)`],
    ["Average neutral pairs/active week", averagePerActiveWeek.toFixed(2)],
    ["Weeks with zero neutral pairs", String(weekOpens.length - activeWeekCount)],
    ["Skipped neutral pair-weeks", String(records.length - eligible.length)],
  ];
}

function buildUniverseAssetRows(records: NeutralPairWeekRecord[]): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  return assetClasses.map((assetClass) => [
    assetClass,
    String(records.filter((record) => record.assetClass === assetClass).length),
    String(records.filter((record) => record.assetClass === assetClass && record.eligible).length),
  ]);
}

function buildMetricComparisonRows(longFills: InternalFillRecord[], shortFills: InternalFillRecord[]): string[][] {
  const longStats = aggregateToRow(aggregateFills(longFills));
  const shortStats = aggregateToRow(aggregateFills(shortFills));
  const combinedStats = aggregateToRow(aggregateFills([...longFills, ...shortFills]));
  return [
    ["Total fills", String(longStats.fills), String(shortStats.fills), String(combinedStats.fills)],
    ["Avg return/fill", fmtPct(longStats.avgReturnPerFill), fmtPct(shortStats.avgReturnPerFill), fmtPct(combinedStats.avgReturnPerFill)],
    ["Total return", fmtPct(longStats.totalReturn), fmtPct(shortStats.totalReturn), fmtPct(combinedStats.totalReturn)],
    ["Win rate", fmtRate(longStats.winRate), fmtRate(shortStats.winRate), fmtRate(combinedStats.winRate)],
    ["TP hit rate", fmtRate(longStats.tpHitRate), fmtRate(shortStats.tpHitRate), fmtRate(combinedStats.tpHitRate)],
    ["Re-entries", String(longStats.reentries), String(shortStats.reentries), String(combinedStats.reentries)],
  ];
}

function buildAssetClassMetricRows(fills: InternalFillRecord[]): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  return assetClasses.map((assetClass) => {
    const stats = aggregateToRow(aggregateFills(fills.filter((fill) => fill.assetClass === assetClass)));
    return [
      assetClass,
      String(stats.fills),
      fmtPct(stats.totalReturn),
      fmtPct(stats.avgReturnPerFill),
      fmtRate(stats.winRate),
      fmtRate(stats.tpHitRate),
      String(stats.reentries),
    ];
  });
}

function buildPairBreakdownRows(fills: InternalFillRecord[], count: number, best: boolean): string[][] {
  const byPair = new Map<string, InternalFillRecord[]>();
  for (const fill of fills) {
    const rows = byPair.get(fill.pair) ?? [];
    rows.push(fill);
    byPair.set(fill.pair, rows);
  }

  const ranked = [...byPair.entries()]
    .map(([pair, pairFills]) => {
      const stats = aggregateToRow(aggregateFills(pairFills));
      return {
        pair,
        assetClass: pairFills[0]!.assetClass,
        longFills: pairFills.filter((fill) => fill.direction === "LONG").length,
        shortFills: pairFills.filter((fill) => fill.direction === "SHORT").length,
        stats,
      };
    })
    .sort((a, b) => best
      ? (b.stats.totalReturn ?? Number.NEGATIVE_INFINITY) - (a.stats.totalReturn ?? Number.NEGATIVE_INFINITY)
      : (a.stats.totalReturn ?? Number.POSITIVE_INFINITY) - (b.stats.totalReturn ?? Number.POSITIVE_INFINITY))
    .slice(0, count);

  return ranked.map((row) => [
    row.pair,
    row.assetClass,
    String(row.longFills),
    String(row.shortFills),
    String(row.stats.fills),
    fmtPct(row.stats.totalReturn),
    fmtPct(row.stats.avgReturnPerFill),
    fmtRate(row.stats.winRate),
  ]);
}

function buildComparisonRows(neutralFills: InternalFillRecord[], directionalBaselineFills: InternalFillRecord[]): string[][] {
  const neutralStats = aggregateToRow(aggregateFills(neutralFills));
  const directionalStats = aggregateToRow(aggregateFills(directionalBaselineFills));
  return [
    [
      "Neutral Both-Sides",
      String(neutralStats.fills),
      fmtPct(neutralStats.totalReturn),
      fmtPct(neutralStats.avgReturnPerFill),
      fmtRate(neutralStats.winRate),
    ],
    [
      "Directional Variant A (Test 3)",
      String(directionalStats.fills),
      fmtPct(directionalStats.totalReturn),
      fmtPct(directionalStats.avgReturnPerFill),
      fmtRate(directionalStats.winRate),
    ],
  ];
}

function buildWorthTradingSection(
  weekOpens: string[],
  neutralRecords: NeutralPairWeekRecord[],
  neutralFills: InternalFillRecord[],
  directionalBaselineFills: InternalFillRecord[],
): string[] {
  const activeWeekCount = weekOpens.filter((weekOpen) => neutralRecords.some((record) => record.week === weekOpen)).length;
  const eligibleNeutralRecords = neutralRecords.filter((record) => record.eligible);
  const neutralStats = aggregateToRow(aggregateFills(neutralFills));
  const directionalStats = aggregateToRow(aggregateFills(directionalBaselineFills));
  const avgNeutralPairsPerActiveWeek = activeWeekCount > 0 ? neutralRecords.length / activeWeekCount : 0;
  const returnPerPairWeek =
    eligibleNeutralRecords.length > 0 && neutralStats.totalReturn !== null
      ? neutralStats.totalReturn / eligibleNeutralRecords.length
      : null;
  const beatsDirectional =
    neutralStats.totalReturn !== null && directionalStats.totalReturn !== null
      ? neutralStats.totalReturn - directionalStats.totalReturn
      : null;
  const recommendation =
    neutralStats.totalReturn !== null && neutralStats.totalReturn > 0 && avgNeutralPairsPerActiveWeek >= 3
      ? "Inference: the neutral both-sides sleeve is additive research worth monitoring, but only if execution bandwidth can absorb more fills without degrading the directional book."
      : "Inference: the neutral both-sides sleeve looks more like background noise than a primary execution focus.";

  return [
    `Neutral-pair activity: **${neutralRecords.length}** pairs across **${activeWeekCount}** active weeks (**${activeWeekCount}/${weekOpens.length}** weeks had neutral pairs).`,
    `Average neutral pairs per active week: **${avgNeutralPairsPerActiveWeek.toFixed(2)}**.`,
    `Return per eligible neutral pair-week: **${fmtPct(returnPerPairWeek)}**.`,
    `Directional Test 3 Variant A baseline in this run: **${fmtPct(directionalStats.totalReturn)}** total return across **${directionalStats.fills}** fills.`,
    `Neutral sleeve delta versus the directional baseline: **${fmtPct(beatsDirectional)}**.`,
    recommendation,
  ];
}

function buildNeutralAuditSummaryRows(records: NeutralPairWeekRecord[]): string[][] {
  const conflicting = records.filter((record) => record.neutralKind === "CONFLICTING").length;
  const silent = records.filter((record) => record.neutralKind === "SILENT").length;
  return [
    ["Conflicting neutral pair-weeks", String(conflicting)],
    ["Silent neutral pair-weeks", String(silent)],
    ["Conflicting share", fmtRate(records.length > 0 ? (conflicting / records.length) * 100 : null)],
    ["Silent share", fmtRate(records.length > 0 ? (silent / records.length) * 100 : null)],
  ];
}

function buildNeutralAuditRows(records: NeutralPairWeekRecord[]): string[][] {
  return [...records]
    .sort((a, b) => a.week.localeCompare(b.week) || a.pair.localeCompare(b.pair))
    .map((record) => [
      record.weekLabel,
      record.pair,
      record.assetClass,
      record.votes.dealer,
      record.votes.commercial,
      record.votes.sentiment,
      record.neutralKind,
      "NEUTRAL",
    ]);
}

function buildDirectionalAssetComparisonRows(
  neutralFills: InternalFillRecord[],
  directionalBaselineFills: InternalFillRecord[],
): string[][] {
  const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  return assetClasses.map((assetClass) => {
    const neutralStats = aggregateToRow(aggregateFills(neutralFills.filter((fill) => fill.assetClass === assetClass)));
    const directionalStats = aggregateToRow(
      aggregateFills(directionalBaselineFills.filter((fill) => fill.assetClass === assetClass)),
    );
    return [
      assetClass,
      String(neutralStats.fills),
      fmtPct(neutralStats.totalReturn),
      fmtPct(neutralStats.avgReturnPerFill),
      String(directionalStats.fills),
      fmtPct(directionalStats.totalReturn),
      fmtPct(directionalStats.avgReturnPerFill),
    ];
  });
}

function renderNeutralVariantSection(title: string, weekOpens: string[], records: NeutralPairWeekRecord[]): string[] {
  const fills = records.flatMap((record) => [...record.longFills, ...record.shortFills]);
  const longFills = fills.filter((fill) => fill.direction === "LONG");
  const shortFills = fills.filter((fill) => fill.direction === "SHORT");
  return [
    `## ${title}`,
    "",
    renderMarkdownTable(["Metric", "LONG Fills", "SHORT Fills", "Combined"], buildMetricComparisonRows(longFills, shortFills)),
    "",
    renderMarkdownTable(
      ["Week", "Neutral Pairs", "Long Fills", "Short Fills", "Total Return"],
      buildVariantWeekRows(weekOpens, records),
    ),
    "",
    renderMarkdownTable(
      ["Session", "Fills", "Total Return", "Avg Return/Fill", "Win Rate", "TP Hit Rate", "Re-entries"],
      buildSessionSummaryRows(fills),
    ),
    "",
    renderMarkdownTable(
      ["MAE Bucket (xADR)", "Fills", "% of Total", "Cumulative %", "Avg Return", "Win Rate"],
      buildMaeDistributionRows(fills),
    ),
    "",
  ];
}

async function loadPairWeekMarketData(pair: string, assetClass: AssetClass, weekOpenUtc: string) {
  const weekWindow = getCanonicalWeekWindow(weekOpenUtc, assetClass);
  const adrRowsPromise = query<{ open_price: string; high_price: string; low_price: string }>(
    `SELECT open_price, high_price, low_price
     FROM pair_period_returns
     WHERE symbol = $1
       AND period_type = 'daily'
       AND period_open_utc < $2::timestamptz
     ORDER BY period_open_utc DESC
     LIMIT $3`,
    [pair, weekWindow.openUtc.toISO(), ADR_LOOKBACK_DAYS],
  );
  const barsPromise = fetchOandaCandleSeries(pair, weekWindow.openUtc, weekWindow.closeUtc);
  const [adrResult, barsResult] = await Promise.allSettled([adrRowsPromise, barsPromise]);

  if (adrResult.status === "rejected") {
    return { skipReason: "adr_query_failed", adrPct: null, bars: [] as OandaHourlyCandle[] };
  }
  if (barsResult.status === "rejected") {
    return { skipReason: "oanda_fetch_failed", adrPct: null, bars: [] as OandaHourlyCandle[] };
  }

  const adrRanges = adrResult.value
    .map((row) => {
      const openPrice = toFinite(row.open_price);
      const highPrice = toFinite(row.high_price);
      const lowPrice = toFinite(row.low_price);
      if (openPrice === null || openPrice <= 0 || highPrice === null || lowPrice === null) return null;
      return ((highPrice - lowPrice) / openPrice) * 100;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (adrRanges.length < ADR_MIN_REQUIRED_DAYS) {
    return { skipReason: "insufficient_adr", adrPct: null, bars: [] as OandaHourlyCandle[] };
  }
  if (barsResult.value.length === 0) {
    return { skipReason: "no_h1_bars", adrPct: null, bars: [] as OandaHourlyCandle[] };
  }

  return {
    skipReason: null,
    adrPct: adrRanges.reduce((sum, value) => sum + value, 0) / adrRanges.length,
    bars: barsResult.value,
  };
}

function extractDirectionalBaselineSignals(options: {
  computed: Awaited<ReturnType<typeof computeTieredWeekForSystem>>;
  weekOpenUtc: string;
  gateMap: ReturnType<typeof buildGateMap>;
  cotContext: Awaited<ReturnType<typeof buildCotGateContext>>;
}) {
  const pairToAssetClass = new Map<string, AssetClass>();
  for (const [assetClass, models] of Object.entries(options.computed.perAsset)) {
    for (const modelRow of models) {
      for (const detail of (modelRow as { pair_details?: Array<{ pair: string }> }).pair_details ?? []) {
        pairToAssetClass.set(detail.pair.toUpperCase(), assetClass as AssetClass);
      }
    }
  }

  const signals: Array<{
    pair: string;
    direction: Direction;
    tier: string;
    model: string;
    assetClass: AssetClass;
    signalMode: SignalMode;
    gateDecision: GateDecision;
  }> = [];

  for (const modelRow of options.computed.combined) {
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
          weekOpenUtc: options.weekOpenUtc,
          direction,
          assetClass,
          gateMap: options.gateMap,
          cotContext: options.cotContext,
          reduceAsSkip: false,
        });
      } catch {
        gate = { decision: "NO_DATA", reasons: ["gate_eval_error"] };
      }

      signals.push({
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

  return signals;
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
  weekOpens: string[];
  neutralRecords: NeutralPairWeekRecord[];
  directionalBaselineRecords: DirectionalBaselinePairWeekRecord[];
  neutralFills: InternalFillRecord[];
  directionalBaselineFills: InternalFillRecord[];
  generatedAtIso: string;
}): string {
  const longFills = options.neutralFills.filter((fill) => fill.direction === "LONG");
  const shortFills = options.neutralFills.filter((fill) => fill.direction === "SHORT");
  const commodityRecords = options.neutralRecords.filter((record) => record.assetClass === "commodities");
  const fxRecords = options.neutralRecords.filter((record) => record.assetClass === "fx");
  const sections = [
    "# ADR Dip Neutral Pairs V2",
    "",
    `Generated: ${options.generatedAtIso}`,
    "",
    "## Overview",
    "",
    "This clean re-run keeps the Test 4A execution engine intact but fixes the reporting blind spots. Neutral pairs are traded as both-side mean reversion from the weekly open, while the report now keeps all 9 weeks visible, isolates the strongest asset-class sleeves, and audits what neutral actually means at the model-vote level.",
    "",
    "The execution layer stays aligned with the prior ADR research: 10-day ADR, H1 OANDA candles, canonical week windows, no stop loss, and week-close fallback exits when TP does not fire.",
    "",
    "## Universe Summary",
    "",
    renderMarkdownTable(["Metric", "Value"], [
      ...buildUniverseSummaryRows(options.neutralRecords, options.weekOpens),
      ["Directional baseline pair-weeks", String(options.directionalBaselineRecords.length)],
      ["Directional baseline eligible pair-weeks", String(options.directionalBaselineRecords.filter((record) => record.eligible).length)],
    ]),
    "",
    renderMarkdownTable(["Asset Class", "Neutral Pair-Weeks", "Eligible"], buildUniverseAssetRows(options.neutralRecords)),
    "",
    "## Neutral Classification Audit",
    "",
    renderMarkdownTable(["Metric", "Value"], buildNeutralAuditSummaryRows(options.neutralRecords)),
    "",
    renderMarkdownTable(
      ["Week", "Pair", "Asset Class", "Dealer", "Commercial", "Sentiment", "Neutral Kind", "Net"],
      buildNeutralAuditRows(options.neutralRecords),
    ),
    "",
    "## Combined Results",
    "",
    renderMarkdownTable(["Metric", "LONG Fills", "SHORT Fills", "Combined"], buildMetricComparisonRows(longFills, shortFills)),
    "",
    "## Per-Asset-Class Breakdown",
    "",
    renderMarkdownTable(
      ["Asset Class", "Fills", "Total Return", "Avg Return/Fill", "Win Rate", "TP Hit Rate", "Re-entries"],
      buildAssetClassMetricRows(options.neutralFills),
    ),
    "",
    "## Per-Pair Breakdown",
    "",
    "### Top Pairs",
    "",
    renderMarkdownTable(
      ["Pair", "Asset Class", "Long Fills", "Short Fills", "Total Fills", "Total Return", "Avg Return/Fill", "Win Rate"],
      buildPairBreakdownRows(options.neutralFills, 10, true),
    ),
    "",
    "### Bottom Pairs",
    "",
    renderMarkdownTable(
      ["Pair", "Asset Class", "Long Fills", "Short Fills", "Total Fills", "Total Return", "Avg Return/Fill", "Win Rate"],
      buildPairBreakdownRows(options.neutralFills, 10, false),
    ),
    "",
    "## Session Breakdown",
    "",
    renderMarkdownTable(
      ["Session", "Fills", "Total Return", "Avg Return/Fill", "Win Rate", "TP Hit Rate", "Re-entries"],
      buildSessionSummaryRows(options.neutralFills),
    ),
    "",
    "## MAE Distribution",
    "",
    renderMarkdownTable(
      ["MAE Bucket (xADR)", "Fills", "% of Total", "Cumulative %", "Avg Return", "Win Rate"],
      buildMaeDistributionRows(options.neutralFills),
    ),
    "",
    "## MAE Per Asset Class",
    "",
    renderMarkdownTable(
      ["Asset Class", "Avg MAE (xADR)", "Median MAE (xADR)", "P95 MAE (xADR)", "Max MAE (xADR)"],
      buildMaePerAssetRows(options.neutralFills),
    ),
    "",
    "## Comparison Vs Directional",
    "",
    renderMarkdownTable(
      ["Mode", "Fills", "Total Return", "Avg Return/Fill", "Win Rate"],
      buildComparisonRows(options.neutralFills, options.directionalBaselineFills),
    ),
    "",
    renderMarkdownTable(
      ["Asset Class", "Neutral Fills", "Neutral Return", "Neutral Avg/Fill", "Directional Fills", "Directional Return", "Directional Avg/Fill"],
      buildDirectionalAssetComparisonRows(options.neutralFills, options.directionalBaselineFills),
    ),
    "",
    '## "Is This Worth Trading?" Analysis',
    "",
    ...buildWorthTradingSection(options.weekOpens, options.neutralRecords, options.neutralFills, options.directionalBaselineFills),
    "",
    "## Per-Week Breakdown",
    "",
    renderMarkdownTable(
      ["Week", "Scope", "Neutral Pairs", "Long Fills", "Short Fills", "Total Return"],
      buildNeutralWeekRows(options.weekOpens, options.neutralRecords),
    ),
    "",
    ...renderNeutralVariantSection("Commodity-Only Neutral Results", options.weekOpens, commodityRecords),
    ...renderNeutralVariantSection("FX-Only Neutral Results", options.weekOpens, fxRecords),
  ];

  return sections.join("\n");
}

async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  const generatedAtIso = DateTime.utc().toISO() ?? new Date().toISOString();

  console.log("\nADR Dip Neutral Pairs V2");
  console.log(`${weekOpens.length} completed weeks | H1 execution | Both-side neutral fades`);
  console.log("Universe: neutral Tiered V3 pair-weeks plus full directional baseline comparison\n");

  console.log("Loading gate artifacts...");
  const gateMap = buildGateMap();
  const cotContext = await buildCotGateContext();
  console.log("Ready.\n");

  const neutralRecords: NeutralPairWeekRecord[] = [];
  const directionalBaselineRecords: DirectionalBaselinePairWeekRecord[] = [];

  for (let weekIndex = 0; weekIndex < weekOpens.length; weekIndex += 1) {
    const weekOpenUtc = weekOpens[weekIndex]!;
    const label = weekLabel(weekOpenUtc);
    console.log(`Processing week ${weekIndex + 1}/${weekOpens.length}: ${label} (${weekOpenUtc})...`);

    let computed: Awaited<ReturnType<typeof computeTieredWeekForSystem>>;
    try {
      computed = await computeTieredWeekForSystem({ weekOpenUtc, system: "v3" });
    } catch (error) {
      console.log(`  Failed to compute tiered week: ${error}`);
      continue;
    }

    const { neutralCandidates } = await loadWeekCandidates({
      weekOpenUtc,
      gateMap,
      cotContext,
    });
    const directionalSignals = extractDirectionalBaselineSignals({
      computed,
      weekOpenUtc,
      gateMap,
      cotContext,
    });

    const neutralWeekRecords = await mapWithConcurrency(neutralCandidates, FETCH_CONCURRENCY, async (candidate) => {
      const record: NeutralPairWeekRecord = {
        week: weekOpenUtc,
        weekLabel: label,
        pair: candidate.pair,
        assetClass: candidate.assetClass,
        votes: candidate.votes,
        neutralKind: candidate.neutralKind,
        adrPct: null,
        weekOpenPrice: null,
        weekClosePrice: null,
        longTriggerPrice: null,
        shortTriggerPrice: null,
        eligible: false,
        skipReason: null,
        longFills: [],
        shortFills: [],
      };

      const marketData = await loadPairWeekMarketData(candidate.pair, candidate.assetClass, weekOpenUtc);
      if (marketData.skipReason) {
        record.skipReason = marketData.skipReason;
        return record;
      }

      const bars = marketData.bars;
      record.eligible = true;
      record.adrPct = marketData.adrPct;
      record.weekOpenPrice = bars[0]!.open;
      record.weekClosePrice = bars[bars.length - 1]!.close;
      record.longTriggerPrice = record.weekOpenPrice * (1 - ((record.adrPct! * ADR_MULTIPLIER) / 100));
      record.shortTriggerPrice = record.weekOpenPrice * (1 + ((record.adrPct! * ADR_MULTIPLIER) / 100));

      const neutralFills = simulateNeutralBothSides({
        pair: candidate.pair,
        assetClass: candidate.assetClass,
        week: weekOpenUtc,
        bars,
        adrPct: record.adrPct,
        weekOpenPrice: record.weekOpenPrice,
      });
      record.longFills = neutralFills.longFills;
      record.shortFills = neutralFills.shortFills;
      return record;
    });

    const directionalWeekRecords = await mapWithConcurrency(directionalSignals, FETCH_CONCURRENCY, async (signal) => {
      const record: DirectionalBaselinePairWeekRecord = {
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
        weekOpenPrice: null,
        weekClosePrice: null,
        dipEntryPrice: null,
        eligible: false,
        skipReason: null,
        fills: [],
      };

      const marketData = await loadPairWeekMarketData(signal.pair, signal.assetClass, weekOpenUtc);
      if (marketData.skipReason) {
        record.skipReason = marketData.skipReason;
        return record;
      }

      const bars = marketData.bars;
      record.eligible = true;
      record.adrPct = marketData.adrPct;
      record.weekOpenPrice = bars[0]!.open;
      record.weekClosePrice = bars[bars.length - 1]!.close;
      record.dipEntryPrice =
        signal.direction === "LONG"
          ? record.weekOpenPrice * (1 - ((record.adrPct! * ADR_MULTIPLIER) / 100))
          : record.weekOpenPrice * (1 + ((record.adrPct! * ADR_MULTIPLIER) / 100));
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
        strategyMode: "DIRECTIONAL_BASELINE",
      });
      return record;
    });

    const eligibleNeutral = neutralWeekRecords.filter((record) => record.eligible).length;
    const longFillCount = neutralWeekRecords.reduce((sum, record) => sum + record.longFills.length, 0);
    const shortFillCount = neutralWeekRecords.reduce((sum, record) => sum + record.shortFills.length, 0);
    const eligibleDirectional = directionalWeekRecords.filter((record) => record.eligible).length;
    const directionalFillCount = directionalWeekRecords.reduce((sum, record) => sum + record.fills.length, 0);
    const oandaSkips =
      neutralWeekRecords.filter((record) => record.skipReason === "oanda_fetch_failed").length +
      directionalWeekRecords.filter((record) => record.skipReason === "oanda_fetch_failed").length;

    console.log(
      `  Neutral pairs: ${neutralWeekRecords.length} | Eligible: ${eligibleNeutral} | Long fills: ${longFillCount} | Short fills: ${shortFillCount}`,
    );
    console.log(
      `  Directional baseline: ${directionalWeekRecords.length} | Eligible: ${eligibleDirectional} | Fills: ${directionalFillCount} | OANDA skips: ${oandaSkips}`,
    );

    neutralRecords.push(...neutralWeekRecords);
    directionalBaselineRecords.push(...directionalWeekRecords);
  }

  const neutralLongFills = neutralRecords.flatMap((record) => record.longFills);
  const neutralShortFills = neutralRecords.flatMap((record) => record.shortFills);
  const neutralFills = [...neutralLongFills, ...neutralShortFills];
  const directionalBaselineFills = directionalBaselineRecords.flatMap((record) => record.fills);
  const neutralStats = aggregateToRow(aggregateFills(neutralFills));

  console.log("\nCombined Results");
  console.log(renderMarkdownTable(
    ["Metric", "LONG Fills", "SHORT Fills", "Combined"],
    buildMetricComparisonRows(neutralLongFills, neutralShortFills),
  ));
  console.log("");
  console.log(`Neutral total fills: ${neutralStats.fills}`);
  console.log(`Neutral total return: ${fmtPct(neutralStats.totalReturn)}`);

  const reportText = buildMarkdownReport({
    weekOpens,
    neutralRecords,
    directionalBaselineRecords,
    neutralFills,
    directionalBaselineFills,
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
