/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: audit-fx-hedged-adr-grid-side-selectors.ts
 *
 * Description:
 * Gate 36 research-only audit for COT/strength side selection on hedged
 * FX ADR Grid receipts. Tests whether strength has merit as a fade or
 * timing layer when it disagrees with COT Faces.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { getPool } from "@/lib/db";
import { filterByModel, getCanonicalBasketWeekForModels } from "@/lib/performance/basketSource";
import {
  getPathMarkPriceSeries,
  getPathMarkPriceAtTimestamp,
  getPathTimestampIndex,
  loadPathMarkPriceMatrix,
  type PathMarkPriceMatrix,
} from "@/lib/performance/pathBarLoader";
import { readFxWeeklyStrengthContexts } from "@/lib/strength/historicalStrength";
import {
  RESEARCH_MATRIX_DATASET_VERSION,
  RESEARCH_MATRIX_LOGIC_VERSION,
  createResearchMatrixVariantRuns,
  ensureResearchMatrixWarehouseSchema,
  hashResearchMatrixPayload,
  markResearchMatrixDatasetComplete,
  persistResearchMatrixPairDecisions,
  persistResearchMatrixSourceContexts,
  persistResearchMatrixStopEvents,
  persistResearchMatrixTradeEvents,
  persistResearchMatrixTradeOpportunities,
  persistResearchMatrixVariantWeekResults,
  readResearchMatrixPersistCounts,
  upsertResearchMatrixDataset,
  type ResearchMatrixPairDecision,
  type ResearchMatrixSourceContext,
  type ResearchMatrixStopEvent,
  type ResearchMatrixTradeEvent,
  type ResearchMatrixTradeOpportunity,
  type ResearchMatrixVariantDefinition,
  type ResearchMatrixVariantWeekResult,
} from "@/lib/research/matrixDataset";
import { buildBaseWeek, type SourceRuleId } from "./export-weekly-hold-fixed-band-sweep";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";
type SourceDirection = Direction | "NEUTRAL" | "MISSING";
type ExitReason =
  | "grid_tp"
  | "grid_reset"
  | "week_close"
  | "basket_stop"
  | "pair_stop"
  | "basket_take_profit"
  | "runner_breakeven"
  | "runner_trailing"
  | "runner_week_close";
type CotModeId = Extract<SourceRuleId, "cot_faces_v1_forced" | "cot_faces_v1_commercial_delta_contrarian">;
type AppSourceModeId = "dealer" | "commercial";
type StrengthModeId = "strength_open_canonical" | "strength_friday_snapshot";
type TradeComponent = "grid" | "runner";
type RunnerExitMode = "breakeven" | "trailing" | "breakeven_trailing";

type HedgeReceipt = {
  scope: {
    weekOpenUtc: string;
    weekLabel: string;
    expectedPairs: string[];
    executionWindowOpenUtc: string;
    entryCutoffUtc: string;
    executionWindowCloseUtc: string;
    grid?: {
      spacingAdr?: number;
    };
  };
  summaries: {
    combinedAdr: PathSummary;
    listedLongAdr: PathSummary;
    listedShortAdr: PathSummary;
    fills: {
      total: number;
      long: number;
      short: number;
      tp: number;
      reset: number;
      weekClose: number;
    };
  };
  trades: TradeRow[];
  path: PathPoint[];
};

type PathSummary = {
  final: number;
  peak: number;
  trough: number;
  maxDrawdown: number;
  maxDrawdownTimeUtc: string | null;
  maxActiveFills: number;
  maxActiveAdrExposure: number;
};

type TradeRow = {
  symbol: string;
  direction: Direction;
  fillSeq: number;
  entryTimeUtc: string;
  exitTimeUtc: string;
  exitReason: ExitReason;
  entryPrice: number;
  exitPrice: number;
  pairAdrPct: number;
  rawReturnPct: number;
  adrReturn: number;
  sizeFactor?: number;
  component?: TradeComponent;
};

type PathPoint = {
  tsUtc: string;
  combinedRawPct: number;
  combinedAdr: number;
  listedLongRawPct: number;
  listedLongAdr: number;
  listedShortRawPct: number;
  listedShortAdr: number;
  activeFills: number;
  activeLongFills: number;
  activeShortFills: number;
  activeAdrExposure: number;
};

type PairContext = {
  symbol: string;
  appSource: Record<AppSourceModeId, SourceDirection>;
  cot: Record<CotModeId, SourceDirection>;
  strength: Record<StrengthModeId, SourceDirection>;
  strengthSnapshotUtc: Record<StrengthModeId, string | null>;
};

type Variant = {
  id: string;
  label: string;
  note: string;
  baseVariantId?: string;
  basketStopLossAdr?: number | null;
  basketTakeProfitAdr?: number | null;
  pairInventoryStopLossAdr?: number | null;
  runnerFraction?: number | null;
  runnerExitMode?: RunnerExitMode | null;
  runnerArmAdr?: number | null;
  runnerTrailAdr?: number | null;
  cotModeId?: CotModeId;
  strengthModeId?: StrengthModeId;
  select: (row: PairContext) => Direction[];
};

type VariantWeek = {
  variantId: string;
  variantLabel: string;
  cotModeId: CotModeId | null;
  strengthModeId: StrengthModeId | null;
  weekLabel: string;
  weekOpenUtc: string;
  note: string;
  selectedPairSides: number;
  selectedPairs: number;
  agreementPairs: number;
  disagreementPairs: number;
  fills: number;
  tp: number;
  reset: number;
  weekClose: number;
  pairStop: number;
  pairInventoryStopLossAdr: number | null;
  pairStopHitCount: number;
  pairStopSkippedFills: number;
  basketStop: number;
  basketStopLossAdr: number | null;
  basketStopHit: boolean;
  basketStopTimeUtc: string | null;
  basketStopSkippedFills: number;
  basketTakeProfit: number;
  basketTakeProfitAdr: number | null;
  basketTakeProfitHit: boolean;
  basketTakeProfitTimeUtc: string | null;
  basketTakeProfitSkippedFills: number;
  runnerFraction: number | null;
  runnerExitMode: RunnerExitMode | null;
  runnerArmAdr: number | null;
  runnerTrailAdr: number | null;
  runnerBreakeven: number;
  runnerTrailing: number;
  runnerWeekClose: number;
  gridTpAdr: number;
  runnerAdr: number;
  runnerGivebackAdr: number;
  basketTakeProfitExitAdr: number;
  stopExitAdr: number;
  weekCloseRawPct: number;
  weekCloseAdr: number;
  finalRawPct: number;
  finalAdr: number;
  maxDrawdownRawPct: number;
  maxDrawdownAdr: number;
  maxDrawdownTimeUtc: string | null;
  peakAdr: number;
  troughAdr: number;
  maxActiveFills: number;
  maxActiveAdrExposure: number;
  maxActiveTimeUtc: string | null;
  averageActiveAgeHoursAtMaxActive: number | null;
  maxActiveAgeHoursAtMaxActive: number | null;
  averageActiveAgeHoursAtMaxDrawdown: number | null;
  maxActiveAgeHoursAtMaxDrawdown: number | null;
  worstPair: string | null;
  worstPairAdr: number | null;
  worstCurrency: string | null;
  worstCurrencyAdr: number | null;
  pairAdrContributions: Record<string, number>;
  currencyAdrContributions: Record<string, number>;
  stopEvents: StopEvent[];
};

type StopEvent = {
  variantId: string;
  variantLabel: string;
  weekLabel: string;
  weekOpenUtc: string;
  stopType: Extract<ExitReason, "basket_stop" | "pair_stop" | "basket_take_profit">;
  symbol: string | null;
  direction: Direction | null;
  thresholdAdr: number;
  stopTimeUtc: string;
  triggerAdr: number | null;
  activeClosedFills: number;
  activeMarkedAdr: number;
  activeOriginalAdr: number;
  activeDeltaAdr: number;
  skippedFills: number;
  skippedOriginalAdr: number;
  skippedOriginalTp: number;
  skippedOriginalReset: number;
  skippedOriginalWeekClose: number;
};

type StopEventCore = Omit<StopEvent, "variantId" | "variantLabel" | "weekLabel" | "weekOpenUtc">;

type VariantTradeEvent = TradeRow & {
  variantId: string;
  variantLabel: string;
  weekLabel: string;
  weekOpenUtc: string;
};

type MatrixTradeEventPersistenceMode = "full" | "none" | "selected";

type VariantWeekEvaluation = {
  week: VariantWeek;
  tradeEventRowsAvailable: number;
  tradeEvents: VariantTradeEvent[];
};

type RunnerConfig = {
  fraction: number;
  exitMode: RunnerExitMode;
  armAdr: number | null;
  trailAdr: number | null;
};

type AgreementState =
  | "friday_open_fade_agree"
  | "friday_open_fade_disagree"
  | "missing_friday_strength"
  | "missing_open_canonical_strength"
  | "missing_friday_and_open_strength";

type DealerCommercialAgreementState =
  | "dealer_commercial_agree"
  | "dealer_commercial_disagree"
  | "dealer_not_directional"
  | "commercial_not_directional"
  | "dealer_and_commercial_not_directional";

type PairQualificationRow = {
  variantId: string;
  variantLabel: string;
  weekLabel: string;
  weekOpenUtc: string;
  symbol: string;
  dealerDirection: SourceDirection;
  commercialDirection: SourceDirection;
  dealerCommercialAgreementState: DealerCommercialAgreementState;
  cotFacesDirection: SourceDirection;
  commercialDeltaCotDirection: SourceDirection;
  openStrengthDirection: SourceDirection;
  openFadeDirection: SourceDirection;
  fridayStrengthDirection: SourceDirection;
  fridayFadeDirection: SourceDirection;
  fridayOpenFadeAgreementState: AgreementState;
  agreementState: AgreementState;
  selectedSide: string | null;
  exclusionReason: string | null;
};

type SourceCoverageSummary = {
  variantId: string;
  variantLabel: string;
  weeks: number;
  pairRows: number;
  selectedRows: number;
  selectedPairSides: number;
  missingFridayStrengthRows: number;
  missingOpenStrengthRows: number;
  missingCotDirectionRows: number;
  dealerCommercialDisagreeRows: number;
  dealerNotDirectionalRows: number;
  commercialNotDirectionalRows: number;
  variantFilterNotMetRows: number;
  otherExcludedRows: number;
  exclusionReasons: Record<string, number>;
};

type SourceCoverageWeekRow = {
  variantId: string;
  variantLabel: string;
  weekLabel: string;
  weekOpenUtc: string;
  pairRows: number;
  selectedRows: number;
  selectedPairSides: number;
  exclusionReasons: Record<string, number>;
};

type VariantSummary = {
  variantId: string;
  variantLabel: string;
  cotModeId: CotModeId | null;
  strengthModeId: StrengthModeId | null;
  note: string;
  weeks: number;
  selectedPairSides: number;
  selectedPairs: number;
  agreementPairs: number;
  disagreementPairs: number;
  fills: number;
  tp: number;
  reset: number;
  weekClose: number;
  pairStop: number;
  pairInventoryStopLossAdr: number | null;
  pairStopHitWeeks: number;
  pairStopHitCount: number;
  pairStopSkippedFills: number;
  basketStop: number;
  basketStopLossAdr: number | null;
  basketStopHitWeeks: number;
  basketStopSkippedFills: number;
  basketTakeProfit: number;
  basketTakeProfitAdr: number | null;
  basketTakeProfitHitWeeks: number;
  basketTakeProfitSkippedFills: number;
  runnerFraction: number | null;
  runnerExitMode: RunnerExitMode | null;
  runnerArmAdr: number | null;
  runnerTrailAdr: number | null;
  runnerBreakeven: number;
  runnerTrailing: number;
  runnerWeekClose: number;
  gridTpAdr: number;
  runnerAdr: number;
  runnerGivebackAdr: number;
  basketTakeProfitExitAdr: number;
  stopExitAdr: number;
  weekCloseRawPct: number;
  weekCloseAdr: number;
  totalRawPct: number;
  totalAdr: number;
  averageRawPctPerWeek: number;
  averageAdrPerWeek: number;
  weeklyWins: number;
  weeklyLosses: number;
  worstWeekLabel: string | null;
  worstWeekAdr: number | null;
  worstPathDrawdownAdr: number;
  cumulativeMaxDrawdownAdr: number;
  returnOverWorstPathDd: number | null;
  returnOverCumulativeDd: number | null;
  maxActiveFills: number;
  maxActiveAdrExposure: number;
  maxAverageActiveAgeHoursAtMaxActive: number | null;
  maxActiveAgeHoursAtMaxActive: number | null;
  maxAverageActiveAgeHoursAtMaxDrawdown: number | null;
  maxActiveAgeHoursAtMaxDrawdown: number | null;
  worstPair: string | null;
  worstPairAdr: number | null;
  worstCurrency: string | null;
  worstCurrencyAdr: number | null;
};

type CachedVariantWeekBase = {
  trades: TradeRow[];
  pathPoints: PathPoint[];
  selectedPairs: number;
  selectedPairSides: number;
  agreementPairs: number;
  disagreementPairs: number;
};

type PreparedReceiptWeek = {
  receiptPath: string;
  receipt: HedgeReceipt;
  contexts: PairContext[];
  markPrices?: PathMarkPriceMatrix;
};

type MatrixWeekMetadata = {
  weekOpenUtc: string;
  executionWindowOpenUtc: string;
  executionWindowCloseUtc: string;
  expectedPairs: string[];
  tradeCount: number;
  pathPoints: number;
};

type SourceContextNeeds = {
  cot: boolean;
  appSource: boolean;
  openStrength: boolean;
  fridayStrength: boolean;
};

const COT_MODES: Array<{ id: CotModeId; label: string }> = [
  { id: "cot_faces_v1_forced", label: "COT Faces" },
  { id: "cot_faces_v1_commercial_delta_contrarian", label: "COT Faces commercial-delta contrarian" },
];

const STRENGTH_MODES: Array<{ id: StrengthModeId; label: string; note: string }> = [
  {
    id: "strength_open_canonical",
    label: "Open canonical strength",
    note: "Current canonical week-open strength, including 1w/1m lookback fallback.",
  },
  {
    id: "strength_friday_snapshot",
    label: "Friday frozen strength",
    note: "Latest 1h/4h/24h currency strength snapshot at or before Friday 17:00 New York.",
  },
];

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function argFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parsePositiveIntegerArg(name: string, defaultValue: number) {
  const raw = argValue(name);
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name} value: ${raw}`);
  }
  return parsed;
}

function normalizePathResolution(value: string | null | undefined) {
  const raw = (value ?? "1h").trim().toLowerCase();
  if (raw === "1m" || raw === "m1") return "1m";
  if (raw === "1h" || raw === "h1") return "1h";
  throw new Error(`Unsupported --path-resolution value: ${value}`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) {
        results[index] = await mapper(item, index);
      }
    }
  }));

  return results;
}

type ProfileRow = {
  label: string;
  count: number;
  totalMs: number;
};

const profileTimings = new Map<string, { count: number; totalMs: number }>();

function recordProfile(label: string, startMs: number) {
  if (!argFlag("profile")) return;
  const elapsedMs = performance.now() - startMs;
  const existing = profileTimings.get(label) ?? { count: 0, totalMs: 0 };
  existing.count += 1;
  existing.totalMs += elapsedMs;
  profileTimings.set(label, existing);
}

function profileSync<T>(label: string, task: () => T): T {
  const startMs = performance.now();
  try {
    return task();
  } finally {
    recordProfile(label, startMs);
  }
}

async function profileAsync<T>(label: string, task: () => Promise<T>): Promise<T> {
  const startMs = performance.now();
  try {
    return await task();
  } finally {
    recordProfile(label, startMs);
  }
}

function profileRows(): ProfileRow[] {
  return [...profileTimings.entries()]
    .map(([label, timing]) => ({
      label,
      count: timing.count,
      totalMs: Math.round(timing.totalMs),
    }))
    .sort((left, right) => right.totalMs - left.totalMs);
}

function logProgress(message: string) {
  if (!argFlag("progress")) return;
  const memory = process.memoryUsage();
  console.log(`${message} | heapUsedMb=${(memory.heapUsed / 1024 / 1024).toFixed(1)} rssMb=${(memory.rss / 1024 / 1024).toFixed(1)}`);
}

function parseVariantIds() {
  const raw = argValue("variants") ?? argValue("variant-ids");
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (ids.length === 0) throw new Error("--variants/--variant-ids was provided without any variant ids.");
  return new Set(ids);
}

function parseMatrixTradeEventPersistenceMode(): MatrixTradeEventPersistenceMode {
  const raw = (argValue("matrix-trade-event-mode") ?? "full").trim().toLowerCase();
  if (raw === "full" || raw === "none" || raw === "selected") return raw;
  throw new Error(`Invalid --matrix-trade-event-mode value: ${raw}. Expected full, none, or selected.`);
}

function parseMatrixTradeEventVariantIds() {
  const raw = argValue("matrix-trade-event-variant-ids");
  if (!raw) return new Set<string>();
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (ids.length === 0) throw new Error("--matrix-trade-event-variant-ids was provided without any variant ids.");
  return new Set(ids);
}

function parseNumberList(name: string) {
  const raw = argValue(name);
  if (!raw) return [];
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value));
  const invalid = values.find((value) => !Number.isFinite(value) || value <= 0);
  if (invalid !== undefined) throw new Error(`Invalid --${name} value: ${invalid}`);
  return [...new Set(values)].sort((left, right) => left - right);
}

function parseRunnerConfigs() {
  const raw = argValue("runner-configs");
  if (!raw) return [] as RunnerConfig[];
  const configs = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const [fractionRaw, modeRaw, armRaw, trailRaw] = value.split(":").map((part) => part.trim());
      const fraction = Number(fractionRaw);
      if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= 1) {
        throw new Error(`Invalid --runner-configs fraction: ${value}`);
      }
      if (modeRaw === "be") {
        return { fraction, exitMode: "breakeven", armAdr: null, trailAdr: null } satisfies RunnerConfig;
      }
      if (modeRaw === "trail" || modeRaw === "reset-trail" || modeRaw === "reset_trail") {
        const armAdr = Number(armRaw);
        const trailAdr = Number(trailRaw);
        if (!Number.isFinite(armAdr) || armAdr <= 0 || !Number.isFinite(trailAdr) || trailAdr <= 0) {
          throw new Error(`Invalid --runner-configs trailing config: ${value}`);
        }
        return { fraction, exitMode: "trailing", armAdr, trailAdr } satisfies RunnerConfig;
      }
      if (modeRaw === "be-trail" || modeRaw === "be_trail" || modeRaw === "be-reset-trail" || modeRaw === "be_reset_trail") {
        const armAdr = Number(armRaw);
        const trailAdr = Number(trailRaw);
        if (!Number.isFinite(armAdr) || armAdr <= 0 || !Number.isFinite(trailAdr) || trailAdr <= 0) {
          throw new Error(`Invalid --runner-configs breakeven trailing config: ${value}`);
        }
        return { fraction, exitMode: "breakeven_trailing", armAdr, trailAdr } satisfies RunnerConfig;
      }
      throw new Error(`Invalid --runner-configs mode: ${value}`);
    });
  const seen = new Set<string>();
  return configs.filter((config) => {
    const key = runnerConfigSlug(config);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function thresholdSlug(value: number) {
  return String(value).replaceAll(".", "p");
}

function expandStopLossVariants(options: {
  variants: Variant[];
  basketThresholds: number[];
  pairThresholds: number[];
}) {
  if (options.basketThresholds.length === 0 && options.pairThresholds.length === 0) {
    return options.variants;
  }

  const expanded: Variant[] = [...options.variants];
  for (const variant of options.variants) {
    for (const pairThreshold of options.pairThresholds) {
      expanded.push({
        ...variant,
        id: `${variant.id}_pair_sl_${thresholdSlug(pairThreshold)}`,
        label: `${variant.label} + pair inventory SL ${pairThreshold} ADR`,
        note: `${variant.note} Pair-side inventory stop closes active fills and blocks new fills for that pair-side when adverse distance from active average entry reaches ${pairThreshold} ADR.`,
        baseVariantId: variant.id,
        pairInventoryStopLossAdr: pairThreshold,
      });
    }

    for (const basketThreshold of options.basketThresholds) {
      expanded.push({
        ...variant,
        id: `${variant.id}_basket_sl_${thresholdSlug(basketThreshold)}`,
        label: `${variant.label} + basket SL ${basketThreshold} ADR`,
        note: `${variant.note} Basket-level hard stop closes active selected fills and blocks new selected fills when the selected basket path reaches -${basketThreshold} ADR from week open.`,
        baseVariantId: variant.id,
        basketStopLossAdr: basketThreshold,
      });
    }

    for (const pairThreshold of options.pairThresholds) {
      for (const basketThreshold of options.basketThresholds) {
        expanded.push({
          ...variant,
          id: `${variant.id}_pair_sl_${thresholdSlug(pairThreshold)}_basket_sl_${thresholdSlug(basketThreshold)}`,
          label: `${variant.label} + pair inventory SL ${pairThreshold} ADR + basket SL ${basketThreshold} ADR`,
          note: `${variant.note} Pair-side inventory stop runs first; basket-level hard stop then closes active selected fills and blocks new selected fills if the selected basket path reaches -${basketThreshold} ADR from week open.`,
          baseVariantId: variant.id,
          pairInventoryStopLossAdr: pairThreshold,
          basketStopLossAdr: basketThreshold,
        });
      }
    }
  }
  return expanded;
}

function runnerConfigSlug(config: RunnerConfig) {
  if (config.exitMode === "breakeven") {
    return `runner_${thresholdSlug(config.fraction)}_be`;
  }
  if (config.exitMode === "breakeven_trailing") {
    return `runner_${thresholdSlug(config.fraction)}_be_trail_${thresholdSlug(config.armAdr ?? 0)}_${thresholdSlug(config.trailAdr ?? 0)}`;
  }
  return `runner_${thresholdSlug(config.fraction)}_trail_${thresholdSlug(config.armAdr ?? 0)}_${thresholdSlug(config.trailAdr ?? 0)}`;
}

function runnerConfigLabel(config: RunnerConfig) {
  const percent = `${round(config.fraction * 100, 2) ?? config.fraction * 100}%`;
  if (config.exitMode === "breakeven") {
    return `${percent} runner BE`;
  }
  if (config.exitMode === "breakeven_trailing") {
    return `${percent} runner BE then trail arm ${config.armAdr} ADR / trail ${config.trailAdr} ADR`;
  }
  return `${percent} runner trail arm ${config.armAdr} ADR / trail ${config.trailAdr} ADR`;
}

function expandGate40Variants(options: {
  variants: Variant[];
  basketTakeProfitThresholds: number[];
  runnerConfigs: RunnerConfig[];
}) {
  if (options.basketTakeProfitThresholds.length === 0 && options.runnerConfigs.length === 0) {
    return options.variants;
  }

  const expanded: Variant[] = [...options.variants];
  for (const variant of options.variants) {
    for (const threshold of options.basketTakeProfitThresholds) {
      expanded.push({
        ...variant,
        id: `${variant.id}_basket_tp_${thresholdSlug(threshold)}`,
        label: `${variant.label} + basket TP ${threshold} ADR`,
        note: `${variant.note} Basket-level take profit closes active selected fills and blocks new selected fills when the selected basket path reaches +${threshold} ADR from week open.`,
        baseVariantId: variant.baseVariantId ?? variant.id,
        basketTakeProfitAdr: threshold,
      });
    }

    for (const config of options.runnerConfigs) {
      expanded.push({
        ...variant,
        id: `${variant.id}_${runnerConfigSlug(config)}`,
        label: `${variant.label} + ${runnerConfigLabel(config)}`,
        note: `${variant.note} Grid TP closes ${(1 - config.fraction) * 100}% at the normal 0.20 ADR TP and leaves ${(config.fraction * 100)}% as a ${runnerConfigLabel(config)} research runner.`,
        baseVariantId: variant.baseVariantId ?? variant.id,
        runnerFraction: config.fraction,
        runnerExitMode: config.exitMode,
        runnerArmAdr: config.armAdr,
        runnerTrailAdr: config.trailAdr,
      });
    }
  }
  return expanded;
}

function round(value: number | null | undefined, places = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function signed(value: number | null | undefined, places = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(places)}`;
}

function tradeSize(trade: Pick<TradeRow, "sizeFactor">) {
  return typeof trade.sizeFactor === "number" && Number.isFinite(trade.sizeFactor)
    ? trade.sizeFactor
    : 1;
}

type IndexedTrade = {
  trade: TradeRow;
  entryMs: number;
  exitMs: number;
  size: number;
  markPrices: ReadonlyArray<number | null>;
};

function indexTradesForPath(trades: TradeRow[], markPrices: PathMarkPriceMatrix): IndexedTrade[] {
  return trades.map((trade) => ({
    trade,
    entryMs: toUtcMs(trade.entryTimeUtc),
    exitMs: toUtcMs(trade.exitTimeUtc),
    size: tradeSize(trade),
    markPrices: getPathMarkPriceSeries(markPrices, trade.symbol),
  }));
}

function scaleTrade(trade: TradeRow, sizeFactor: number): TradeRow {
  return {
    ...trade,
    sizeFactor,
    rawReturnPct: round(trade.rawReturnPct * sizeFactor, 6) ?? 0,
    adrReturn: round(trade.adrReturn * sizeFactor, 6) ?? 0,
  };
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toUtcMs(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDirection(value: unknown): SourceDirection {
  if (value === "LONG" || value === "SHORT" || value === "NEUTRAL" || value === "MISSING") {
    return value;
  }
  return "MISSING";
}

function isDirectional(value: SourceDirection): value is Direction {
  return value === "LONG" || value === "SHORT";
}

function opposite(direction: Direction): Direction {
  return direction === "LONG" ? "SHORT" : "LONG";
}

function pairBaseQuote(symbol: string) {
  const upper = symbol.toUpperCase();
  return { base: upper.slice(0, 3), quote: upper.slice(3, 6) };
}

function directedRawReturnPct(direction: Direction, entryPrice: number, markPrice: number | null) {
  if (!markPrice || !Number.isFinite(markPrice) || markPrice <= 0 || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    return 0;
  }
  const raw = ((markPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -raw : raw;
}

function activeTradesAt(trades: TradeRow[], tsUtc: string) {
  const ts = toUtcMs(tsUtc);
  return trades.filter((trade) => toUtcMs(trade.entryTimeUtc) <= ts && toUtcMs(trade.exitTimeUtc) > ts);
}

function activeAgeAt(trades: TradeRow[], tsUtc: string | null) {
  if (!tsUtc) {
    return { averageHours: null, maxHours: null };
  }
  const ts = toUtcMs(tsUtc);
  const ages = activeTradesAt(trades, tsUtc)
    .map((trade) => (ts - toUtcMs(trade.entryTimeUtc)) / 3_600_000)
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (ages.length === 0) {
    return { averageHours: null, maxHours: null };
  }

  return {
    averageHours: round(ages.reduce((sum, value) => sum + value, 0) / ages.length, 2),
    maxHours: round(Math.max(...ages), 2),
  };
}

function maxActivePoint(points: PathPoint[]) {
  return [...points].sort((left, right) =>
    right.activeFills - left.activeFills ||
    right.activeAdrExposure - left.activeAdrExposure ||
    toUtcMs(left.tsUtc) - toUtcMs(right.tsUtc))[0] ?? null;
}

function addContribution(map: Record<string, number>, key: string, value: number) {
  map[key] = round((map[key] ?? 0) + value, 6) ?? 0;
}

function buildPairAdrContributions(trades: TradeRow[]) {
  const contributions: Record<string, number> = {};
  for (const trade of trades) {
    addContribution(contributions, trade.symbol.toUpperCase(), trade.adrReturn);
  }
  return contributions;
}

function buildCurrencyAdrContributions(trades: TradeRow[]) {
  const contributions: Record<string, number> = {};
  for (const trade of trades) {
    const { base, quote } = pairBaseQuote(trade.symbol);
    if (trade.direction === "LONG") {
      addContribution(contributions, base, trade.adrReturn);
      addContribution(contributions, quote, -trade.adrReturn);
    } else {
      addContribution(contributions, base, -trade.adrReturn);
      addContribution(contributions, quote, trade.adrReturn);
    }
  }
  return contributions;
}

function worstContribution(contributions: Record<string, number>) {
  const [key, value] = Object.entries(contributions).sort((left, right) => left[1] - right[1])[0] ?? [];
  return {
    key: key ?? null,
    value: typeof value === "number" && Number.isFinite(value) ? round(value, 6) : null,
  };
}

function aggregateContributions(rows: VariantWeek[], field: "pairAdrContributions" | "currencyAdrContributions") {
  const out: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row[field])) {
      addContribution(out, key, value);
    }
  }
  return out;
}

function summarizePath(points: PathPoint[]): PathSummary {
  let peak = 0;
  let trough = 0;
  let maxDrawdown = 0;
  let maxDrawdownTimeUtc: string | null = null;
  let maxActiveFills = 0;
  let maxActiveAdrExposure = 0;

  for (const point of points) {
    const value = point.combinedAdr;
    peak = Math.max(peak, value);
    trough = Math.min(trough, value);
    const drawdown = value - peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownTimeUtc = point.tsUtc;
    }
    maxActiveFills = Math.max(maxActiveFills, point.activeFills);
    maxActiveAdrExposure = Math.max(maxActiveAdrExposure, point.activeAdrExposure);
  }

  return {
    final: round(points.at(-1)?.combinedAdr, 6) ?? 0,
    peak: round(peak, 6) ?? 0,
    trough: round(trough, 6) ?? 0,
    maxDrawdown: round(maxDrawdown, 6) ?? 0,
    maxDrawdownTimeUtc,
    maxActiveFills,
    maxActiveAdrExposure: round(maxActiveAdrExposure, 6) ?? maxActiveAdrExposure,
  };
}

function summarizeRawPath(points: PathPoint[]) {
  let peak = 0;
  let trough = 0;
  let maxDrawdown = 0;
  let maxDrawdownTimeUtc: string | null = null;

  for (const point of points) {
    const value = point.combinedRawPct;
    peak = Math.max(peak, value);
    trough = Math.min(trough, value);
    const drawdown = value - peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownTimeUtc = point.tsUtc;
    }
  }

  return {
    final: round(points.at(-1)?.combinedRawPct, 6) ?? 0,
    peak: round(peak, 6) ?? 0,
    trough: round(trough, 6) ?? 0,
    maxDrawdown: round(maxDrawdown, 6) ?? 0,
    maxDrawdownTimeUtc,
  };
}

function buildMarkedPath(options: {
  receipt: HedgeReceipt;
  trades: TradeRow[];
  markPrices: PathMarkPriceMatrix;
  gridSpacingAdr: number;
}): PathPoint[] {
  const indexedTrades = indexTradesForPath(options.trades, options.markPrices);
  return options.receipt.path.map((point, pointIndex) => {
    const ts = toUtcMs(point.tsUtc);
    let combinedRawPct = 0;
    let combinedAdr = 0;
    let activeFills = 0;
    let activeLongFills = 0;
    let activeShortFills = 0;

    for (const indexed of indexedTrades) {
      const trade = indexed.trade;
      if (indexed.exitMs <= ts) {
        combinedRawPct += trade.rawReturnPct;
        combinedAdr += trade.adrReturn;
        continue;
      }
      if (indexed.entryMs <= ts && ts < indexed.exitMs) {
        const mark = indexed.markPrices[pointIndex] ?? null;
        const raw = directedRawReturnPct(trade.direction, trade.entryPrice, mark);
        const size = indexed.size;
        combinedRawPct += raw * size;
        combinedAdr += (raw / trade.pairAdrPct) * size;
        activeFills += size;
        if (trade.direction === "LONG") activeLongFills += size;
        else activeShortFills += size;
      }
    }

    return {
      tsUtc: point.tsUtc,
      combinedRawPct: round(combinedRawPct, 6) ?? 0,
      combinedAdr: round(combinedAdr, 6) ?? 0,
      listedLongRawPct: 0,
      listedLongAdr: 0,
      listedShortRawPct: 0,
      listedShortAdr: 0,
      activeFills,
      activeLongFills,
      activeShortFills,
      activeAdrExposure: round(activeFills * options.gridSpacingAdr, 6) ?? activeFills * options.gridSpacingAdr,
    };
  });
}

function tradeAtRunnerExit(options: {
  trade: TradeRow;
  exitTimeUtc: string;
  exitReason: Extract<ExitReason, "runner_breakeven" | "runner_trailing" | "runner_week_close">;
  exitPrice: number | null;
  sizeFactor: number;
}): TradeRow {
  const rawReturnPct = directedRawReturnPct(options.trade.direction, options.trade.entryPrice, options.exitPrice);
  return {
    ...options.trade,
    component: "runner",
    sizeFactor: options.sizeFactor,
    exitTimeUtc: options.exitTimeUtc,
    exitReason: options.exitReason,
    exitPrice: options.exitPrice ?? options.trade.exitPrice,
    rawReturnPct: round(rawReturnPct * options.sizeFactor, 6) ?? 0,
    adrReturn: round((rawReturnPct / options.trade.pairAdrPct) * options.sizeFactor, 6) ?? 0,
  };
}

function favorableAdrForTrade(trade: TradeRow, markPrice: number | null) {
  const raw = directedRawReturnPct(trade.direction, trade.entryPrice, markPrice);
  return raw / trade.pairAdrPct;
}

function simulateRunnerExit(options: {
  trade: TradeRow;
  receipt: HedgeReceipt;
  markPrices: PathMarkPriceMatrix;
  config: RunnerConfig;
}) {
  const originalExitMs = toUtcMs(options.trade.exitTimeUtc);
  const originalExitIndex = getPathTimestampIndex(options.markPrices, options.trade.exitTimeUtc);
  const startIndex = originalExitIndex === null ? 0 : originalExitIndex + 1;
  const markSeries = getPathMarkPriceSeries(options.markPrices, options.trade.symbol);
  let bestFavorableAdr = 0.2;
  let armed = options.config.exitMode === "breakeven";

  for (let pointIndex = startIndex; pointIndex < options.receipt.path.length; pointIndex += 1) {
    const point = options.receipt.path[pointIndex];
    if (!point) continue;
    const ts = toUtcMs(point.tsUtc);
    if (originalExitIndex === null && ts <= originalExitMs) continue;
    const markPrice = markSeries[pointIndex] ?? null;
    const favorableAdr = favorableAdrForTrade(options.trade, markPrice);
    bestFavorableAdr = Math.max(bestFavorableAdr, favorableAdr);

    if (options.config.exitMode === "breakeven") {
      if (favorableAdr <= 0) {
        return {
          exitTimeUtc: point.tsUtc,
          exitReason: "runner_breakeven" as const,
          exitPrice: options.trade.entryPrice,
        };
      }
      continue;
    }

    if (options.config.exitMode === "breakeven_trailing" && !armed && favorableAdr <= 0) {
      return {
        exitTimeUtc: point.tsUtc,
        exitReason: "runner_breakeven" as const,
        exitPrice: options.trade.entryPrice,
      };
    }

    if (!armed && bestFavorableAdr >= (options.config.armAdr ?? Number.POSITIVE_INFINITY)) {
      armed = true;
    }
    const trailStopAdr = bestFavorableAdr - (options.config.trailAdr ?? Number.POSITIVE_INFINITY);
    const effectiveTrailStopAdr = options.config.exitMode === "breakeven_trailing"
      ? Math.max(0, trailStopAdr)
      : trailStopAdr;
    if (armed && favorableAdr <= effectiveTrailStopAdr) {
      return {
        exitTimeUtc: point.tsUtc,
        exitReason: "runner_trailing" as const,
        exitPrice: options.config.exitMode === "breakeven_trailing" && effectiveTrailStopAdr <= 0
          ? options.trade.entryPrice
          : markPrice,
      };
    }
  }

  const finalPoint = options.receipt.path.at(-1);
  const finalTime = finalPoint?.tsUtc ?? options.trade.exitTimeUtc;
  return {
    exitTimeUtc: finalTime,
    exitReason: "runner_week_close" as const,
    exitPrice: getPathMarkPriceAtTimestamp(options.markPrices, options.trade.symbol, finalTime) ?? options.trade.exitPrice,
  };
}

function applyGridRunners(options: {
  trades: TradeRow[];
  receipt: HedgeReceipt;
  markPrices: PathMarkPriceMatrix;
  variant: Variant;
}) {
  const fraction = options.variant.runnerFraction ?? null;
  const exitMode = options.variant.runnerExitMode ?? null;
  if (!fraction || !exitMode) return options.trades;

  const config: RunnerConfig = {
    fraction,
    exitMode,
    armAdr: options.variant.runnerArmAdr ?? null,
    trailAdr: options.variant.runnerTrailAdr ?? null,
  };
  const out: TradeRow[] = [];
  for (const trade of options.trades) {
    if (trade.exitReason !== "grid_tp") {
      out.push({ ...trade, component: "grid", sizeFactor: tradeSize(trade) });
      continue;
    }
    out.push({
      ...scaleTrade(trade, 1 - fraction),
      component: "grid",
    });
    const runnerExit = simulateRunnerExit({
      trade,
      receipt: options.receipt,
      markPrices: options.markPrices,
      config,
    });
    out.push(tradeAtRunnerExit({
      trade,
      exitTimeUtc: runnerExit.exitTimeUtc,
      exitReason: runnerExit.exitReason,
      exitPrice: runnerExit.exitPrice,
      sizeFactor: fraction,
    }));
  }
  return out;
}

function markTradeAtStop(options: {
  trade: TradeRow;
  stopTimeUtc: string;
  exitReason: Extract<ExitReason, "basket_stop" | "pair_stop" | "basket_take_profit">;
  markPrices: PathMarkPriceMatrix;
}): TradeRow {
  const mark = getPathMarkPriceAtTimestamp(options.markPrices, options.trade.symbol, options.stopTimeUtc);
  const rawReturnPct = directedRawReturnPct(options.trade.direction, options.trade.entryPrice, mark);
  const size = tradeSize(options.trade);
  return {
    ...options.trade,
    exitTimeUtc: options.stopTimeUtc,
    exitReason: options.exitReason,
    exitPrice: mark ?? options.trade.exitPrice,
    rawReturnPct: round(rawReturnPct * size, 6) ?? 0,
    adrReturn: round((rawReturnPct / options.trade.pairAdrPct) * size, 6) ?? 0,
  };
}

function pairSideKey(trade: Pick<TradeRow, "symbol" | "direction">) {
  return `${trade.symbol.toUpperCase()}::${trade.direction}`;
}

function adverseAdrFromAverageEntry(options: {
  direction: Direction;
  averageEntryPrice: number;
  markPrice: number | null;
  pairAdrPct: number;
}) {
  const raw = directedRawReturnPct(options.direction, options.averageEntryPrice, options.markPrice);
  if (raw >= 0) return 0;
  return Math.abs(raw / options.pairAdrPct);
}

function sumAdr(trades: TradeRow[]) {
  return round(trades.reduce((sum, trade) => sum + trade.adrReturn, 0), 6) ?? 0;
}

function countExit(trades: TradeRow[], reason: ExitReason) {
  return round(
    trades
      .filter((trade) => trade.exitReason === reason)
      .reduce((sum, trade) => sum + tradeSize(trade), 0),
    6,
  ) ?? 0;
}

function countComponent(trades: TradeRow[], component: TradeComponent) {
  return round(
    trades
      .filter((trade) => (trade.component ?? "grid") === component)
      .reduce((sum, trade) => sum + tradeSize(trade), 0),
    6,
  ) ?? 0;
}

function sumAdrByExit(trades: TradeRow[], reasons: ExitReason[]) {
  const allowed = new Set(reasons);
  return round(trades.filter((trade) => allowed.has(trade.exitReason)).reduce((sum, trade) => sum + trade.adrReturn, 0), 6) ?? 0;
}

function sumAdrByComponent(trades: TradeRow[], component: TradeComponent) {
  return round(trades.filter((trade) => (trade.component ?? "grid") === component).reduce((sum, trade) => sum + trade.adrReturn, 0), 6) ?? 0;
}

function buildStopEventCore(options: {
  stopType: Extract<ExitReason, "basket_stop" | "pair_stop" | "basket_take_profit">;
  symbol: string | null;
  direction: Direction | null;
  thresholdAdr: number;
  stopTimeUtc: string;
  triggerAdr: number | null;
  activeOriginalTrades: TradeRow[];
  activeMarkedTrades: TradeRow[];
  skippedTrades: TradeRow[];
}): StopEventCore {
  const activeMarkedAdr = sumAdr(options.activeMarkedTrades);
  const activeOriginalAdr = sumAdr(options.activeOriginalTrades);
  const skippedOriginalAdr = sumAdr(options.skippedTrades);
  return {
    stopType: options.stopType,
    symbol: options.symbol,
    direction: options.direction,
    thresholdAdr: options.thresholdAdr,
    stopTimeUtc: options.stopTimeUtc,
    triggerAdr: options.triggerAdr === null ? null : round(options.triggerAdr, 6) ?? options.triggerAdr,
    activeClosedFills: countComponent(options.activeMarkedTrades, "grid") + countComponent(options.activeMarkedTrades, "runner"),
    activeMarkedAdr,
    activeOriginalAdr,
    activeDeltaAdr: round(activeMarkedAdr - activeOriginalAdr, 6) ?? 0,
    skippedFills: countComponent(options.skippedTrades, "grid") + countComponent(options.skippedTrades, "runner"),
    skippedOriginalAdr,
    skippedOriginalTp: countExit(options.skippedTrades, "grid_tp"),
    skippedOriginalReset: countExit(options.skippedTrades, "grid_reset"),
    skippedOriginalWeekClose: countExit(options.skippedTrades, "week_close"),
  };
}

function applyPairInventoryStopLoss(options: {
  trades: TradeRow[];
  receipt: HedgeReceipt;
  thresholdAdr: number | null | undefined;
  markPrices: PathMarkPriceMatrix;
}) {
  if (!options.thresholdAdr) {
    return {
      trades: options.trades,
      hitCount: 0,
      skippedFills: 0,
      events: [] as StopEventCore[],
    };
  }

  const stopTimes = new Map<string, {
    symbol: string;
    direction: Direction;
    stopTimeUtc: string;
    triggerAdr: number;
  }>();
  const indexedTrades = indexTradesForPath(options.trades, options.markPrices);
  for (let pointIndex = 0; pointIndex < options.receipt.path.length; pointIndex += 1) {
    const point = options.receipt.path[pointIndex];
    if (!point) continue;
    const ts = toUtcMs(point.tsUtc);
    const activeByKey = new Map<string, IndexedTrade[]>();
    for (const indexed of indexedTrades) {
      const trade = indexed.trade;
      const key = pairSideKey(trade);
      if (stopTimes.has(key)) continue;
      if (indexed.entryMs <= ts && ts < indexed.exitMs) {
        let activeTrades = activeByKey.get(key);
        if (!activeTrades) {
          activeTrades = [];
          activeByKey.set(key, activeTrades);
        }
        activeTrades.push(indexed);
      }
    }

    for (const [key, activeIndexedTrades] of activeByKey.entries()) {
      if (activeIndexedTrades.length === 0) continue;
      const first = activeIndexedTrades[0];
      if (!first) continue;
      const totalSize = activeIndexedTrades.reduce((sum, indexed) => sum + indexed.size, 0);
      const averageEntryPrice =
        activeIndexedTrades.reduce((sum, indexed) => sum + indexed.trade.entryPrice * indexed.size, 0) / totalSize;
      const markPrice = first.markPrices[pointIndex] ?? null;
      const adverseAdr = adverseAdrFromAverageEntry({
        direction: first.trade.direction,
        averageEntryPrice,
        markPrice,
        pairAdrPct: first.trade.pairAdrPct,
      });
      if (adverseAdr >= options.thresholdAdr) {
        stopTimes.set(key, {
          symbol: first.trade.symbol.toUpperCase(),
          direction: first.trade.direction,
          stopTimeUtc: point.tsUtc,
          triggerAdr: adverseAdr,
        });
      }
    }
  }

  if (stopTimes.size === 0) {
    return {
      trades: options.trades,
      hitCount: 0,
      skippedFills: 0,
      events: [] as StopEventCore[],
    };
  }

  let skippedFills = 0;
  const stoppedTrades: TradeRow[] = [];
  for (const trade of options.trades) {
    const stop = stopTimes.get(pairSideKey(trade));
    if (!stop) {
      stoppedTrades.push(trade);
      continue;
    }
    const stopMs = toUtcMs(stop.stopTimeUtc);
    const entryMs = toUtcMs(trade.entryTimeUtc);
    const exitMs = toUtcMs(trade.exitTimeUtc);
    if (entryMs > stopMs) {
      skippedFills += tradeSize(trade);
      continue;
    }
    if (exitMs <= stopMs) {
      stoppedTrades.push(trade);
      continue;
    }
    stoppedTrades.push(markTradeAtStop({
      trade,
      stopTimeUtc: stop.stopTimeUtc,
      exitReason: "pair_stop",
      markPrices: options.markPrices,
    }));
  }

  const events = [...stopTimes.entries()].map(([key, stop]) => {
    const stopMs = toUtcMs(stop.stopTimeUtc);
    const originalPairSideTrades = options.trades.filter((trade) => pairSideKey(trade) === key);
    const activeOriginalTrades = originalPairSideTrades.filter((trade) =>
      toUtcMs(trade.entryTimeUtc) <= stopMs && stopMs < toUtcMs(trade.exitTimeUtc));
    const activeMarkedTrades = activeOriginalTrades.map((trade) => markTradeAtStop({
      trade,
      stopTimeUtc: stop.stopTimeUtc,
      exitReason: "pair_stop",
      markPrices: options.markPrices,
    }));
    const skippedTrades = originalPairSideTrades.filter((trade) => toUtcMs(trade.entryTimeUtc) > stopMs);
    return buildStopEventCore({
      stopType: "pair_stop",
      symbol: stop.symbol,
      direction: stop.direction,
      thresholdAdr: options.thresholdAdr!,
      stopTimeUtc: stop.stopTimeUtc,
      triggerAdr: stop.triggerAdr,
      activeOriginalTrades,
      activeMarkedTrades,
      skippedTrades,
    });
  });

  return {
    trades: stoppedTrades,
    hitCount: stopTimes.size,
    skippedFills,
    events,
  };
}

function applyBasketStopLoss(options: {
  trades: TradeRow[];
  pathPoints: PathPoint[];
  thresholdAdr: number | null | undefined;
  takeProfitThresholdAdr: number | null | undefined;
  markPrices: PathMarkPriceMatrix;
}) {
  if (!options.thresholdAdr && !options.takeProfitThresholdAdr) {
    return {
      trades: options.trades,
      pathPoints: options.pathPoints,
      hit: false,
      stopTimeUtc: null,
      skippedFills: 0,
      takeProfitHit: false,
      takeProfitTimeUtc: null,
      takeProfitSkippedFills: 0,
      events: [] as StopEventCore[],
    };
  }

  const stopHitIndex = options.thresholdAdr
    ? options.pathPoints.findIndex((point) => point.combinedAdr <= -options.thresholdAdr!)
    : -1;
  const takeProfitHitIndex = options.takeProfitThresholdAdr
    ? options.pathPoints.findIndex((point) => point.combinedAdr >= options.takeProfitThresholdAdr!)
    : -1;
  const hitCandidates = [
    stopHitIndex >= 0
      ? {
          index: stopHitIndex,
          exitReason: "basket_stop" as const,
          thresholdAdr: options.thresholdAdr!,
        }
      : null,
    takeProfitHitIndex >= 0
      ? {
          index: takeProfitHitIndex,
          exitReason: "basket_take_profit" as const,
          thresholdAdr: options.takeProfitThresholdAdr!,
        }
      : null,
  ].filter((value): value is { index: number; exitReason: Extract<ExitReason, "basket_stop" | "basket_take_profit">; thresholdAdr: number } => value !== null)
    .sort((left, right) => left.index - right.index);

  const firstHit = hitCandidates[0] ?? null;
  if (!firstHit) {
    return {
      trades: options.trades,
      pathPoints: options.pathPoints,
      hit: false,
      stopTimeUtc: null,
      skippedFills: 0,
      takeProfitHit: false,
      takeProfitTimeUtc: null,
      takeProfitSkippedFills: 0,
      events: [] as StopEventCore[],
    };
  }

  const stopTimeUtc = options.pathPoints[firstHit.index].tsUtc;
  const stopMs = toUtcMs(stopTimeUtc);
  let skippedFills = 0;
  const stoppedTrades: TradeRow[] = [];

  for (const trade of options.trades) {
    const entryMs = toUtcMs(trade.entryTimeUtc);
    const exitMs = toUtcMs(trade.exitTimeUtc);
    if (entryMs > stopMs) {
      skippedFills += tradeSize(trade);
      continue;
    }
    if (exitMs <= stopMs) {
      stoppedTrades.push(trade);
      continue;
    }
    stoppedTrades.push(markTradeAtStop({
      trade,
      stopTimeUtc,
      exitReason: firstHit.exitReason,
      markPrices: options.markPrices,
    }));
  }

  const activeOriginalTrades = options.trades.filter((trade) =>
    toUtcMs(trade.entryTimeUtc) <= stopMs && stopMs < toUtcMs(trade.exitTimeUtc));
  const activeMarkedTrades = activeOriginalTrades.map((trade) => markTradeAtStop({
    trade,
    stopTimeUtc,
    exitReason: firstHit.exitReason,
    markPrices: options.markPrices,
  }));
  const skippedTrades = options.trades.filter((trade) => toUtcMs(trade.entryTimeUtc) > stopMs);
  const events = [
    buildStopEventCore({
      stopType: firstHit.exitReason,
      symbol: null,
      direction: null,
      thresholdAdr: firstHit.thresholdAdr,
      stopTimeUtc,
      triggerAdr: options.pathPoints[firstHit.index].combinedAdr,
      activeOriginalTrades,
      activeMarkedTrades,
      skippedTrades,
    }),
  ];

  return {
    trades: stoppedTrades,
    pathPoints: options.pathPoints.slice(0, firstHit.index + 1),
    hit: firstHit.exitReason === "basket_stop",
    stopTimeUtc: firstHit.exitReason === "basket_stop" ? stopTimeUtc : null,
    skippedFills: firstHit.exitReason === "basket_stop" ? skippedFills : 0,
    takeProfitHit: firstHit.exitReason === "basket_take_profit",
    takeProfitTimeUtc: firstHit.exitReason === "basket_take_profit" ? stopTimeUtc : null,
    takeProfitSkippedFills: firstHit.exitReason === "basket_take_profit" ? skippedFills : 0,
    events,
  };
}

function fridayOpenFadeAgreement(row: PairContext): Direction | null {
  const friday = row.strength.strength_friday_snapshot;
  const open = row.strength.strength_open_canonical;
  if (!isDirectional(friday) || !isDirectional(open)) return null;
  return friday === opposite(open) ? friday : null;
}

function openStrengthFade(row: PairContext): Direction | null {
  const open = row.strength.strength_open_canonical;
  return isDirectional(open) ? opposite(open) : null;
}

function fridayStrengthFade(row: PairContext): Direction | null {
  const friday = row.strength.strength_friday_snapshot;
  return isDirectional(friday) ? opposite(friday) : null;
}

function fridayOpenFadeAgreementState(row: PairContext): AgreementState {
  const friday = row.strength.strength_friday_snapshot;
  const open = row.strength.strength_open_canonical;
  if (!isDirectional(friday) && !isDirectional(open)) return "missing_friday_and_open_strength";
  if (!isDirectional(friday)) return "missing_friday_strength";
  if (!isDirectional(open)) return "missing_open_canonical_strength";
  return friday === opposite(open) ? "friday_open_fade_agree" : "friday_open_fade_disagree";
}

function dealerCommercialAgreement(row: PairContext): Direction | null {
  const dealer = row.appSource.dealer;
  const commercial = row.appSource.commercial;
  return isDirectional(dealer) && dealer === commercial ? dealer : null;
}

function dealerCommercialAgreementState(row: PairContext): DealerCommercialAgreementState {
  const dealerDirectional = isDirectional(row.appSource.dealer);
  const commercialDirectional = isDirectional(row.appSource.commercial);
  if (!dealerDirectional && !commercialDirectional) return "dealer_and_commercial_not_directional";
  if (!dealerDirectional) return "dealer_not_directional";
  if (!commercialDirectional) return "commercial_not_directional";
  return row.appSource.dealer === row.appSource.commercial ? "dealer_commercial_agree" : "dealer_commercial_disagree";
}

function dealerCommercialExclusionReason(row: PairContext, variantId: string) {
  const agreement = dealerCommercialAgreement(row);
  if (!agreement) return dealerCommercialAgreementState(row);
  const open = row.strength.strength_open_canonical;
  const openFade = openStrengthFade(row);
  const friday = row.strength.strength_friday_snapshot;
  const fridayFade = fridayStrengthFade(row);
  const fridayOpenFade = fridayOpenFadeAgreement(row);
  const fridayOpenState = fridayOpenFadeAgreementState(row);

  if (variantId === "dealer_commercial_agreement_selected") return "variant_filter_not_met";
  if (variantId === "dealer_commercial_agreement_open_strength_agree") {
    return isDirectional(open) ? "open_strength_not_confirming_dealer_commercial" : "missing_open_canonical_strength";
  }
  if (variantId === "dealer_commercial_agreement_open_strength_fade_agree") {
    return openFade ? "open_strength_fade_not_confirming_dealer_commercial" : "missing_open_canonical_strength";
  }
  if (variantId === "dealer_commercial_agreement_friday_strength_agree") {
    return isDirectional(friday) ? "friday_strength_not_confirming_dealer_commercial" : "missing_friday_strength";
  }
  if (variantId === "dealer_commercial_agreement_open_friday_strength_agree") {
    if (!isDirectional(open)) return "missing_open_canonical_strength";
    if (!isDirectional(friday)) return "missing_friday_strength";
    return "open_friday_strength_not_confirming_dealer_commercial";
  }
  if (variantId === "dealer_commercial_agreement_friday_strength_fade_agree") {
    return fridayFade ? "friday_strength_fade_not_confirming_dealer_commercial" : "missing_friday_strength";
  }
  if (variantId === "dealer_commercial_agreement_friday_open_fade_agree") {
    return fridayOpenFade ? "friday_open_fade_not_confirming_dealer_commercial" : fridayOpenState;
  }
  return "variant_filter_not_met";
}

function exclusionReasonFor(row: PairContext, variant: Variant, selectedDirections: Direction[]) {
  if (selectedDirections.length > 0) return null;

  if (variant.id.startsWith("dealer_commercial_agreement")) {
    return dealerCommercialExclusionReason(row, variant.id);
  }

  if (variant.id === "cot_faces_v1_commercial_delta_contrarian_selected") {
    return isDirectional(row.cot.cot_faces_v1_commercial_delta_contrarian)
      ? "variant_filter_not_met"
      : "missing_cot_direction";
  }

  if (variant.id === "cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree") {
    const cot = row.cot.cot_faces_v1_commercial_delta_contrarian;
    if (!isDirectional(cot)) return "missing_cot_direction";
    const openFade = openStrengthFade(row);
    return openFade ? "open_strength_fade_not_confirming_cot" : "missing_open_canonical_strength";
  }

  if (variant.id === "cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree") {
    const cot = row.cot.cot_faces_v1_commercial_delta_contrarian;
    if (!isDirectional(cot)) return "missing_cot_direction";
    if (!isDirectional(row.strength.strength_open_canonical)) return "missing_open_canonical_strength";
    if (!isDirectional(row.strength.strength_friday_snapshot)) return "missing_friday_strength";
    return "open_friday_strength_not_confirming_cot";
  }

  if (variant.id === "strength_friday_snapshot_open_canonical_fade_agree") {
    const state = fridayOpenFadeAgreementState(row);
    return state === "friday_open_fade_agree" ? "variant_filter_not_met" : state;
  }

  if (variant.id === "cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree") {
    const cot = row.cot.cot_faces_v1_commercial_delta_contrarian;
    if (!isDirectional(cot)) return "missing_cot_direction";
    const state = fridayOpenFadeAgreementState(row);
    return state === "friday_open_fade_agree" ? "cot_not_confirmed_by_friday_open_fade" : state;
  }

  if (variant.cotModeId && !isDirectional(row.cot[variant.cotModeId])) {
    return `missing_${variant.cotModeId}_direction`;
  }
  if (variant.strengthModeId && !isDirectional(row.strength[variant.strengthModeId])) {
    return `missing_${variant.strengthModeId}_direction`;
  }
  return "variant_filter_not_met";
}

function buildPairQualificationRows(options: {
  receipt: HedgeReceipt;
  contexts: PairContext[];
  variant: Variant;
}): PairQualificationRow[] {
  return options.contexts.map((row) => {
    const selectedDirections = options.variant.select(row);
    const openFade = openStrengthFade(row);
    const fridayFade = fridayStrengthFade(row);
    return {
      variantId: options.variant.id,
      variantLabel: options.variant.label,
      weekLabel: options.receipt.scope.weekLabel,
      weekOpenUtc: options.receipt.scope.weekOpenUtc,
      symbol: row.symbol,
      dealerDirection: row.appSource.dealer,
      commercialDirection: row.appSource.commercial,
      dealerCommercialAgreementState: dealerCommercialAgreementState(row),
      cotFacesDirection: row.cot.cot_faces_v1_forced,
      commercialDeltaCotDirection: row.cot.cot_faces_v1_commercial_delta_contrarian,
      openStrengthDirection: row.strength.strength_open_canonical,
      openFadeDirection: openFade ?? "MISSING",
      fridayStrengthDirection: row.strength.strength_friday_snapshot,
      fridayFadeDirection: fridayFade ?? "MISSING",
      fridayOpenFadeAgreementState: fridayOpenFadeAgreementState(row),
      agreementState: fridayOpenFadeAgreementState(row),
      selectedSide: selectedDirections.length > 0 ? selectedDirections.join(";") : null,
      exclusionReason: exclusionReasonFor(row, options.variant, selectedDirections),
    };
  });
}

function buildVariants(): Variant[] {
  const variants: Variant[] = [
    {
      id: "fully_hedged_baseline",
      label: "Fully hedged baseline",
      note: "Both LONG and SHORT grids for every pair.",
      select: () => ["LONG", "SHORT"],
    },
  ];

  for (const cotMode of COT_MODES) {
    variants.push(
      {
        id: `${cotMode.id}_selected`,
        label: `${cotMode.label} selected`,
        note: `Trade only the ${cotMode.label} side.`,
        cotModeId: cotMode.id,
        select: (row) => (isDirectional(row.cot[cotMode.id]) ? [row.cot[cotMode.id]] : []),
      },
      {
        id: `${cotMode.id}_opposite`,
        label: `${cotMode.label} opposite`,
        note: `Trade only the opposite of ${cotMode.label}.`,
        cotModeId: cotMode.id,
        select: (row) => (isDirectional(row.cot[cotMode.id]) ? [opposite(row.cot[cotMode.id])] : []),
      },
    );
  }

  for (const strengthMode of STRENGTH_MODES) {
    variants.push(
      {
        id: `${strengthMode.id}_selected`,
        label: `${strengthMode.label} selected`,
        note: `Trade only the ${strengthMode.label} side. ${strengthMode.note}`,
        strengthModeId: strengthMode.id,
        select: (row) => (isDirectional(row.strength[strengthMode.id]) ? [row.strength[strengthMode.id]] : []),
      },
      {
        id: `${strengthMode.id}_fade`,
        label: `${strengthMode.label} fade`,
        note: `Trade only the opposite of ${strengthMode.label}. ${strengthMode.note}`,
        strengthModeId: strengthMode.id,
        select: (row) =>
          isDirectional(row.strength[strengthMode.id]) ? [opposite(row.strength[strengthMode.id])] : [],
      },
    );
  }

  variants.push(
    {
      id: "dealer_commercial_agreement_selected",
      label: "Dealer + Commercial agreement selected",
      note: "Trade only when canonical app-style Dealer and Commercial agree on the same side.",
      select: (row) => {
        const agreed = dealerCommercialAgreement(row);
        return agreed ? [agreed] : [];
      },
    },
    {
      id: "cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree",
      label: "COT commercial-delta + open strength fade agree",
      note: "Trade commercial-delta COT only when it agrees with fading open canonical strength.",
      cotModeId: "cot_faces_v1_commercial_delta_contrarian",
      strengthModeId: "strength_open_canonical",
      select: (row) => {
        const cot = row.cot.cot_faces_v1_commercial_delta_contrarian;
        const openFade = openStrengthFade(row);
        return isDirectional(cot) && openFade === cot ? [cot] : [];
      },
    },
    {
      id: "dealer_commercial_agreement_open_strength_agree",
      label: "Dealer + Commercial agreement + open strength agree",
      note: "Trade Dealer/Commercial agreement only when open canonical strength confirms the same side.",
      strengthModeId: "strength_open_canonical",
      select: (row) => {
        const agreed = dealerCommercialAgreement(row);
        return agreed && row.strength.strength_open_canonical === agreed ? [agreed] : [];
      },
    },
    {
      id: "dealer_commercial_agreement_open_strength_fade_agree",
      label: "Dealer + Commercial agreement + open strength fade agree",
      note: "Trade Dealer/Commercial agreement only when fading open canonical strength confirms the same side.",
      strengthModeId: "strength_open_canonical",
      select: (row) => {
        const agreed = dealerCommercialAgreement(row);
        return agreed && openStrengthFade(row) === agreed ? [agreed] : [];
      },
    },
    {
      id: "dealer_commercial_agreement_friday_strength_agree",
      label: "Dealer + Commercial agreement + Friday strength agree",
      note: "Trade Dealer/Commercial agreement only when Friday frozen strength confirms the same side.",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const agreed = dealerCommercialAgreement(row);
        return agreed && row.strength.strength_friday_snapshot === agreed ? [agreed] : [];
      },
    },
    {
      id: "dealer_commercial_agreement_open_friday_strength_agree",
      label: "Dealer + Commercial agreement + open + Friday strength agree",
      note: "Trade Dealer/Commercial agreement only when both open canonical strength and Friday frozen strength confirm the same side.",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const agreed = dealerCommercialAgreement(row);
        return agreed &&
          row.strength.strength_open_canonical === agreed &&
          row.strength.strength_friday_snapshot === agreed
          ? [agreed]
          : [];
      },
    },
    {
      id: "dealer_commercial_agreement_friday_strength_fade_agree",
      label: "Dealer + Commercial agreement + Friday strength fade agree",
      note: "Trade Dealer/Commercial agreement only when fading Friday frozen strength confirms the same side.",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const agreed = dealerCommercialAgreement(row);
        return agreed && fridayStrengthFade(row) === agreed ? [agreed] : [];
      },
    },
    {
      id: "dealer_commercial_agreement_friday_open_fade_agree",
      label: "Dealer + Commercial agreement + Friday/open-fade agree",
      note: "Trade Dealer/Commercial agreement only when Friday frozen strength agrees with open-strength fade and confirms the same side.",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const agreed = dealerCommercialAgreement(row);
        return agreed && fridayOpenFadeAgreement(row) === agreed ? [agreed] : [];
      },
    },
  );

  for (const cotMode of COT_MODES) {
    for (const strengthMode of STRENGTH_MODES) {
      variants.push(
        {
          id: `${cotMode.id}_${strengthMode.id}_agree`,
          label: `${cotMode.label} + ${strengthMode.label} agree`,
          note: `Trade ${cotMode.label} only when ${strengthMode.label} agrees.`,
          cotModeId: cotMode.id,
          strengthModeId: strengthMode.id,
          select: (row) =>
            isDirectional(row.cot[cotMode.id]) && row.cot[cotMode.id] === row.strength[strengthMode.id]
              ? [row.cot[cotMode.id]]
              : [],
        },
        {
          id: `${cotMode.id}_${strengthMode.id}_disagree_cot`,
          label: `${cotMode.label} when ${strengthMode.label} disagrees`,
          note: `Trade ${cotMode.label} when it disagrees with ${strengthMode.label}.`,
          cotModeId: cotMode.id,
          strengthModeId: strengthMode.id,
          select: (row) =>
            isDirectional(row.cot[cotMode.id]) &&
            isDirectional(row.strength[strengthMode.id]) &&
            row.cot[cotMode.id] !== row.strength[strengthMode.id]
              ? [row.cot[cotMode.id]]
              : [],
        },
        {
          id: `${cotMode.id}_${strengthMode.id}_disagree_strength`,
          label: `${strengthMode.label} when it disagrees with ${cotMode.label}`,
          note: `Trade ${strengthMode.label} when it disagrees with ${cotMode.label}.`,
          cotModeId: cotMode.id,
          strengthModeId: strengthMode.id,
          select: (row) =>
            isDirectional(row.cot[cotMode.id]) &&
            isDirectional(row.strength[strengthMode.id]) &&
            row.cot[cotMode.id] !== row.strength[strengthMode.id]
              ? [row.strength[strengthMode.id]]
              : [],
        },
      );
    }
  }

  variants.push(
    {
      id: "strength_friday_snapshot_open_canonical_fade_agree",
      label: "Friday frozen strength + open canonical strength fade agree",
      note: "Trade Friday frozen strength only when it agrees with fading open canonical strength.",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const agreed = fridayOpenFadeAgreement(row);
        return agreed ? [agreed] : [];
      },
    },
    {
      id: "strength_friday_snapshot_open_canonical_fade_friday_remainder",
      label: "Friday frozen strength outside open-strength-fade agreement",
      note: "Trade Friday frozen strength when it does not agree with fading open canonical strength.",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const friday = row.strength.strength_friday_snapshot;
        if (!isDirectional(friday)) return [];
        return fridayOpenFadeAgreement(row) === friday ? [] : [friday];
      },
    },
    {
      id: "strength_friday_snapshot_open_canonical_fade_open_fade_remainder",
      label: "Open canonical strength fade outside Friday agreement",
      note: "Trade open canonical strength fade when it does not agree with Friday frozen strength.",
      strengthModeId: "strength_open_canonical",
      select: (row) => {
        const openFade = openStrengthFade(row);
        if (!openFade) return [];
        return fridayOpenFadeAgreement(row) === openFade ? [] : [openFade];
      },
    },
    {
      id: "cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree",
      label: "COT commercial-delta + Friday/open-fade agree",
      note: "Trade commercial-delta COT only when Friday frozen strength agrees with open-strength fade and COT agrees with that side.",
      cotModeId: "cot_faces_v1_commercial_delta_contrarian",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const cot = row.cot.cot_faces_v1_commercial_delta_contrarian;
        const agreed = fridayOpenFadeAgreement(row);
        return isDirectional(cot) && agreed === cot ? [cot] : [];
      },
    },
    {
      id: "cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree",
      label: "COT commercial-delta + open + Friday strength agree",
      note: "Trade commercial-delta COT only when both open canonical strength and Friday frozen strength confirm the same side.",
      cotModeId: "cot_faces_v1_commercial_delta_contrarian",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const cot = row.cot.cot_faces_v1_commercial_delta_contrarian;
        return isDirectional(cot) &&
          row.strength.strength_open_canonical === cot &&
          row.strength.strength_friday_snapshot === cot
          ? [cot]
          : [];
      },
    },
    {
      id: "cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot",
      label: "COT commercial-delta outside Friday/open-fade agreement",
      note: "Trade commercial-delta COT when it is not confirmed by Friday frozen strength agreeing with open-strength fade.",
      cotModeId: "cot_faces_v1_commercial_delta_contrarian",
      strengthModeId: "strength_friday_snapshot",
      select: (row) => {
        const cot = row.cot.cot_faces_v1_commercial_delta_contrarian;
        if (!isDirectional(cot)) return [];
        return fridayOpenFadeAgreement(row) === cot ? [] : [cot];
      },
    },
  );

  return variants;
}

function sourceContextNeedsForVariants(variants: Variant[]): SourceContextNeeds {
  return {
    cot: variants.some((variant) => variant.id.includes("cot_faces")),
    appSource: variants.some((variant) => variant.id.includes("dealer_commercial")),
    openStrength: variants.some((variant) => variant.id.includes("open")),
    fridayStrength: variants.some((variant) => variant.id.includes("friday")),
  };
}

async function buildPairContexts(receipt: HedgeReceipt, needs: SourceContextNeeds): Promise<PairContext[]> {
  const expectedPairs = receipt.scope.expectedPairs.map((pair) => pair.toUpperCase());
  const sourceRuleIds: SourceRuleId[] = COT_MODES.map((mode) => mode.id);
  const needsStrengthContext = needs.fridayStrength || needs.openStrength;
  const [baseWeek, strengthContexts, basketWeek] = await Promise.all([
    needs.cot
      ? profileAsync("source_context_cot_base", () => buildBaseWeek({
          weekOpenUtc: receipt.scope.weekOpenUtc,
          assetClass: "fx",
          expectedPairs,
        sourceRuleIds,
        includePathBars: false,
        includeExecutionContext: false,
      }))
      : Promise.resolve(null),
    needsStrengthContext
      ? profileAsync("source_context_strength_history", () => readFxWeeklyStrengthContexts({
          weekOpenUtcs: [receipt.scope.weekOpenUtc],
          pairs: expectedPairs,
          windows: ["1h", "4h", "24h"],
          marketOpenForwardMinutes: 180,
        }))
      : Promise.resolve([]),
    needs.appSource
      ? profileAsync("source_context_app_basket", () => getCanonicalBasketWeekForModels(
          receipt.scope.weekOpenUtc,
          ["dealer", "commercial"],
        ))
      : Promise.resolve(null),
  ]);
  const baseBySymbol = new Map((baseWeek?.rows ?? []).map((row) => [row.symbol.toUpperCase(), row]));
  const strengthRows = strengthContexts[0]?.rows ?? [];
  const fridayStrengthBySymbol = new Map(
    strengthRows
      .filter((row) => row.pointId === "friday_close")
      .map((row) => [row.pair.toUpperCase(), row]),
  );
  const marketOpenStrengthBySymbol = new Map(
    strengthRows
      .filter((row) => row.pointId === "market_open_confirmation")
      .map((row) => [row.pair.toUpperCase(), row]),
  );
  const appSourceByModel = basketWeek
    ? {
        dealer: new Map(
          filterByModel(basketWeek, "dealer")
            .filter((row) => row.assetClass === "fx")
            .map((row) => [row.symbol.toUpperCase(), row.direction] as const),
        ),
        commercial: new Map(
          filterByModel(basketWeek, "commercial")
            .filter((row) => row.assetClass === "fx")
            .map((row) => [row.symbol.toUpperCase(), row.direction] as const),
        ),
      }
    : {
        dealer: new Map<string, SourceDirection>(),
        commercial: new Map<string, SourceDirection>(),
      };

  return expectedPairs.map((symbol) => {
    const baseRow = baseBySymbol.get(symbol);
    const fridayStrength = fridayStrengthBySymbol.get(symbol);
    const marketOpenStrength = marketOpenStrengthBySymbol.get(symbol);
    const marketOpen = marketOpenStrength?.available
      ? normalizeDirection(marketOpenStrength.direction)
      : "MISSING";
    const fridayComposite = fridayStrength?.available
      ? normalizeDirection(fridayStrength.direction)
      : "MISSING";
    return {
      symbol,
      appSource: {
        dealer: normalizeDirection(appSourceByModel.dealer.get(symbol)),
        commercial: normalizeDirection(appSourceByModel.commercial.get(symbol)),
      },
      cot: {
        cot_faces_v1_forced: normalizeDirection(baseRow?.sourceRuleDecisions.cot_faces_v1_forced?.direction),
        cot_faces_v1_commercial_delta_contrarian: normalizeDirection(
          baseRow?.sourceRuleDecisions.cot_faces_v1_commercial_delta_contrarian?.direction,
        ),
      },
      strength: {
        strength_open_canonical: marketOpen,
        strength_friday_snapshot: fridayComposite,
      },
      strengthSnapshotUtc: {
        strength_open_canonical: marketOpenStrength?.resolvedTimeUtc ?? null,
        strength_friday_snapshot: fridayStrength?.resolvedTimeUtc ?? null,
      },
    };
  });
}

async function prepareReceiptWeek(options: {
  receiptPath: string;
  sourceContextNeeds: SourceContextNeeds;
  pathResolution: string;
  loadMarkPrices: boolean;
}): Promise<PreparedReceiptWeek> {
  const receiptText = await profileAsync("receipt_json_read", () => readFile(options.receiptPath, "utf8"));
  const receipt = profileSync("receipt_json_parse", () => JSON.parse(receiptText) as HedgeReceipt);
  const contexts = await profileAsync("source_context_build", () => buildPairContexts(receipt, options.sourceContextNeeds));
  const markPrices = options.loadMarkPrices
    ? await profileAsync("canonical_bar_load", () => loadPathMarkPriceMatrix(
        receipt.scope.expectedPairs,
        receipt.scope.executionWindowOpenUtc,
        receipt.scope.executionWindowCloseUtc,
        receipt.path.map((point) => point.tsUtc),
        options.pathResolution,
      ))
    : undefined;
  return {
    receiptPath: options.receiptPath,
    receipt,
    contexts,
    markPrices,
  };
}

function selectedDirectionsBySymbol(contexts: PairContext[], variant: Variant) {
  return new Map(contexts.map((row) => [row.symbol, variant.select(row)] as const));
}

function countAgreement(contexts: PairContext[], cotModeId: CotModeId | undefined, strengthModeId: StrengthModeId | undefined) {
  if (!cotModeId || !strengthModeId) {
    return { agreement: 0, disagreement: 0 };
  }
  let agreement = 0;
  let disagreement = 0;
  for (const row of contexts) {
    const cot = row.cot[cotModeId];
    const strength = row.strength[strengthModeId];
    if (!isDirectional(cot) || !isDirectional(strength)) continue;
    if (cot === strength) agreement += 1;
    else disagreement += 1;
  }
  return { agreement, disagreement };
}

const variantWeekBaseCache = new Map<string, CachedVariantWeekBase>();
const variantWeekPathCache = new Map<string, PathPoint[]>();

function cachedVariantWeekBase(options: {
  receiptPath: string;
  receipt: HedgeReceipt;
  contexts: PairContext[];
  variant: Variant;
  markPrices: PathMarkPriceMatrix;
}) {
  const cacheKey = `${options.receiptPath}::${options.variant.baseVariantId ?? options.variant.id}`;
  const cached = variantWeekBaseCache.get(cacheKey);
  if (cached) return cached;

  const directionsBySymbol = selectedDirectionsBySymbol(options.contexts, options.variant);
  const trades = options.receipt.trades.filter((trade) =>
    (directionsBySymbol.get(trade.symbol.toUpperCase()) ?? []).includes(trade.direction));
  const selectedPairs = [...directionsBySymbol.values()].filter((directions) => directions.length > 0).length;
  const selectedPairSides = [...directionsBySymbol.values()].reduce((sum, directions) => sum + directions.length, 0);
  const pathPoints = profileSync("base_marked_path_build", () => buildMarkedPath({
    receipt: options.receipt,
    trades,
    markPrices: options.markPrices,
    gridSpacingAdr: options.receipt.scope.grid?.spacingAdr ?? 0.2,
  }));
  const counts = countAgreement(options.contexts, options.variant.cotModeId, options.variant.strengthModeId);
  const base = {
    trades,
    pathPoints,
    selectedPairs,
    selectedPairSides,
    agreementPairs: counts.agreement,
    disagreementPairs: counts.disagreement,
  };
  variantWeekBaseCache.set(cacheKey, base);
  return base;
}

function variantPathCacheKey(options: {
  receiptPath: string;
  variant: Variant;
}) {
  return [
    options.receiptPath,
    options.variant.baseVariantId ?? options.variant.id,
    options.variant.runnerFraction ?? "",
    options.variant.runnerExitMode ?? "",
    options.variant.runnerArmAdr ?? "",
    options.variant.runnerTrailAdr ?? "",
    options.variant.pairInventoryStopLossAdr ?? "",
  ].join("::");
}

function cachedVariantPath(options: {
  receiptPath: string;
  receipt: HedgeReceipt;
  base: CachedVariantWeekBase;
  variant: Variant;
  trades: TradeRow[];
  markPrices: PathMarkPriceMatrix;
}) {
  if (options.trades === options.base.trades) {
    return options.base.pathPoints;
  }

  const cacheKey = variantPathCacheKey({
    receiptPath: options.receiptPath,
    variant: options.variant,
  });
  const cached = variantWeekPathCache.get(cacheKey);
  if (cached) return cached;

  const pathPoints = buildMarkedPath({
    receipt: options.receipt,
    trades: options.trades,
    markPrices: options.markPrices,
    gridSpacingAdr: options.receipt.scope.grid?.spacingAdr ?? 0.2,
  });
  variantWeekPathCache.set(cacheKey, pathPoints);
  return pathPoints;
}

async function evaluateVariantWeek(options: {
  receiptPath: string;
  receipt: HedgeReceipt;
  contexts: PairContext[];
  variant: Variant;
  markPrices: PathMarkPriceMatrix;
  collectTradeEvents: boolean;
}): Promise<VariantWeekEvaluation> {
  const base = profileSync("variant_base_cache", () => cachedVariantWeekBase(options));
  const runnerAdjustedTrades = profileSync("runner_simulation", () => applyGridRunners({
    trades: base.trades,
    receipt: options.receipt,
    markPrices: options.markPrices,
    variant: options.variant,
  }));
  const pairStopped = profileSync("pair_stop_simulation", () => applyPairInventoryStopLoss({
    trades: runnerAdjustedTrades,
    receipt: options.receipt,
    thresholdAdr: options.variant.pairInventoryStopLossAdr,
    markPrices: options.markPrices,
  }));
  const pairStoppedPathPoints = profileSync("pair_stop_path_build", () => cachedVariantPath({
    receiptPath: options.receiptPath,
    receipt: options.receipt,
    base,
    variant: options.variant,
    trades: pairStopped.trades,
    markPrices: options.markPrices,
  }));
  const stopped = profileSync("basket_stop_simulation", () => applyBasketStopLoss({
    trades: pairStopped.trades,
    pathPoints: pairStoppedPathPoints,
    thresholdAdr: options.variant.basketStopLossAdr,
    takeProfitThresholdAdr: options.variant.basketTakeProfitAdr,
    markPrices: options.markPrices,
  }));
  const evaluatedTrades = stopped.trades;
  const evaluatedPathPoints = stopped.pathPoints;
  const stopEvents = [...pairStopped.events, ...stopped.events].map((event) => ({
    ...event,
    variantId: options.variant.id,
    variantLabel: options.variant.label,
    weekLabel: options.receipt.scope.weekLabel,
    weekOpenUtc: options.receipt.scope.weekOpenUtc,
  }));
  const metrics = profileSync("variant_metrics", () => {
    const summary = summarizePath(evaluatedPathPoints);
    const rawSummary = summarizeRawPath(evaluatedPathPoints);
    const maxActive = maxActivePoint(evaluatedPathPoints);
    const ageAtMaxActive = activeAgeAt(evaluatedTrades, maxActive?.tsUtc ?? null);
    const ageAtMaxDrawdown = activeAgeAt(evaluatedTrades, summary.maxDrawdownTimeUtc);
    const pairAdrContributions = buildPairAdrContributions(evaluatedTrades);
    const currencyAdrContributions = buildCurrencyAdrContributions(evaluatedTrades);
    const worstPair = worstContribution(pairAdrContributions);
    const worstCurrency = worstContribution(currencyAdrContributions);
    return {
      summary,
      rawSummary,
      maxActive,
      ageAtMaxActive,
      ageAtMaxDrawdown,
      pairAdrContributions,
      currencyAdrContributions,
      worstPair,
      worstCurrency,
    };
  });
  const week: VariantWeek = {
    variantId: options.variant.id,
    variantLabel: options.variant.label,
    cotModeId: options.variant.cotModeId ?? null,
    strengthModeId: options.variant.strengthModeId ?? null,
    weekLabel: options.receipt.scope.weekLabel,
    weekOpenUtc: options.receipt.scope.weekOpenUtc,
    note: options.variant.note,
    selectedPairSides: base.selectedPairSides,
    selectedPairs: base.selectedPairs,
    agreementPairs: base.agreementPairs,
    disagreementPairs: base.disagreementPairs,
    fills: round(evaluatedTrades.reduce((sum, trade) => sum + tradeSize(trade), 0), 6) ?? 0,
    tp: countExit(evaluatedTrades, "grid_tp"),
    reset: countExit(evaluatedTrades, "grid_reset"),
    weekClose: countExit(evaluatedTrades, "week_close") + countExit(evaluatedTrades, "runner_week_close"),
    pairStop: countExit(evaluatedTrades, "pair_stop"),
    pairInventoryStopLossAdr: options.variant.pairInventoryStopLossAdr ?? null,
    pairStopHitCount: pairStopped.hitCount,
    pairStopSkippedFills: pairStopped.skippedFills,
    basketStop: countExit(evaluatedTrades, "basket_stop"),
    basketStopLossAdr: options.variant.basketStopLossAdr ?? null,
    basketStopHit: stopped.hit,
    basketStopTimeUtc: stopped.stopTimeUtc,
    basketStopSkippedFills: stopped.skippedFills,
    basketTakeProfit: countExit(evaluatedTrades, "basket_take_profit"),
    basketTakeProfitAdr: options.variant.basketTakeProfitAdr ?? null,
    basketTakeProfitHit: stopped.takeProfitHit,
    basketTakeProfitTimeUtc: stopped.takeProfitTimeUtc,
    basketTakeProfitSkippedFills: stopped.takeProfitSkippedFills,
    runnerFraction: options.variant.runnerFraction ?? null,
    runnerExitMode: options.variant.runnerExitMode ?? null,
    runnerArmAdr: options.variant.runnerArmAdr ?? null,
    runnerTrailAdr: options.variant.runnerTrailAdr ?? null,
    runnerBreakeven: countExit(evaluatedTrades, "runner_breakeven"),
    runnerTrailing: countExit(evaluatedTrades, "runner_trailing"),
    runnerWeekClose: countExit(evaluatedTrades, "runner_week_close"),
    gridTpAdr: sumAdrByExit(evaluatedTrades.filter((trade) => (trade.component ?? "grid") === "grid"), ["grid_tp"]),
    runnerAdr: sumAdrByComponent(evaluatedTrades, "runner"),
    runnerGivebackAdr: round(
      sumAdrByComponent(evaluatedTrades, "runner") -
        (countComponent(evaluatedTrades, "runner") * (options.receipt.scope.grid?.spacingAdr ?? 0.2)),
      6,
    ) ?? 0,
    basketTakeProfitExitAdr: sumAdrByExit(evaluatedTrades, ["basket_take_profit"]),
    stopExitAdr: sumAdrByExit(evaluatedTrades, ["pair_stop", "basket_stop"]),
    weekCloseRawPct: round(
      evaluatedTrades.filter((trade) => trade.exitReason === "week_close" || trade.exitReason === "runner_week_close").reduce((sum, trade) => sum + trade.rawReturnPct, 0),
      6,
    ) ?? 0,
    weekCloseAdr: round(
      evaluatedTrades.filter((trade) => trade.exitReason === "week_close" || trade.exitReason === "runner_week_close").reduce((sum, trade) => sum + trade.adrReturn, 0),
      6,
    ) ?? 0,
    finalRawPct: metrics.rawSummary.final,
    finalAdr: metrics.summary.final,
    maxDrawdownRawPct: metrics.rawSummary.maxDrawdown,
    maxDrawdownAdr: metrics.summary.maxDrawdown,
    maxDrawdownTimeUtc: metrics.summary.maxDrawdownTimeUtc,
    peakAdr: metrics.summary.peak,
    troughAdr: metrics.summary.trough,
    maxActiveFills: metrics.summary.maxActiveFills,
    maxActiveAdrExposure: metrics.summary.maxActiveAdrExposure,
    maxActiveTimeUtc: metrics.maxActive?.tsUtc ?? null,
    averageActiveAgeHoursAtMaxActive: metrics.ageAtMaxActive.averageHours,
    maxActiveAgeHoursAtMaxActive: metrics.ageAtMaxActive.maxHours,
    averageActiveAgeHoursAtMaxDrawdown: metrics.ageAtMaxDrawdown.averageHours,
    maxActiveAgeHoursAtMaxDrawdown: metrics.ageAtMaxDrawdown.maxHours,
    worstPair: metrics.worstPair.key,
    worstPairAdr: metrics.worstPair.value,
    worstCurrency: metrics.worstCurrency.key,
    worstCurrencyAdr: metrics.worstCurrency.value,
    pairAdrContributions: metrics.pairAdrContributions,
    currencyAdrContributions: metrics.currencyAdrContributions,
    stopEvents,
  };
  return {
    week,
    tradeEventRowsAvailable: evaluatedTrades.length,
    tradeEvents: options.collectTradeEvents
      ? evaluatedTrades.map((trade) => ({
          ...trade,
          variantId: options.variant.id,
          variantLabel: options.variant.label,
          weekLabel: options.receipt.scope.weekLabel,
          weekOpenUtc: options.receipt.scope.weekOpenUtc,
        }))
      : [],
  };
}

function summarizeVariant(variant: Variant, weeks: VariantWeek[]): VariantSummary {
  const totalAdr = weeks.reduce((sum, week) => sum + week.finalAdr, 0);
  const totalRawPct = weeks.reduce((sum, week) => sum + week.finalRawPct, 0);
  let cumulative = 0;
  let peak = 0;
  let cumulativeMaxDrawdown = 0;
  for (const week of weeks) {
    cumulative += week.finalAdr;
    peak = Math.max(peak, cumulative);
    cumulativeMaxDrawdown = Math.min(cumulativeMaxDrawdown, cumulative - peak);
  }
  const worstWeek = [...weeks].sort((left, right) => left.finalAdr - right.finalAdr)[0] ?? null;
  const worstPathDrawdown = weeks.reduce((min, week) => Math.min(min, week.maxDrawdownAdr), 0);
  const pairAdrContributions = aggregateContributions(weeks, "pairAdrContributions");
  const currencyAdrContributions = aggregateContributions(weeks, "currencyAdrContributions");
  const worstPair = worstContribution(pairAdrContributions);
  const worstCurrency = worstContribution(currencyAdrContributions);
  const maxOrNull = (values: Array<number | null>) => {
    const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return finite.length > 0 ? round(Math.max(...finite), 2) : null;
  };
  return {
    variantId: variant.id,
    variantLabel: variant.label,
    cotModeId: variant.cotModeId ?? null,
    strengthModeId: variant.strengthModeId ?? null,
    note: variant.note,
    weeks: weeks.length,
    selectedPairSides: weeks.reduce((sum, week) => sum + week.selectedPairSides, 0),
    selectedPairs: weeks.reduce((sum, week) => sum + week.selectedPairs, 0),
    agreementPairs: weeks.reduce((sum, week) => sum + week.agreementPairs, 0),
    disagreementPairs: weeks.reduce((sum, week) => sum + week.disagreementPairs, 0),
    fills: weeks.reduce((sum, week) => sum + week.fills, 0),
    tp: weeks.reduce((sum, week) => sum + week.tp, 0),
    reset: weeks.reduce((sum, week) => sum + week.reset, 0),
    weekClose: weeks.reduce((sum, week) => sum + week.weekClose, 0),
    pairStop: weeks.reduce((sum, week) => sum + week.pairStop, 0),
    pairInventoryStopLossAdr: variant.pairInventoryStopLossAdr ?? null,
    pairStopHitWeeks: weeks.filter((week) => week.pairStopHitCount > 0).length,
    pairStopHitCount: weeks.reduce((sum, week) => sum + week.pairStopHitCount, 0),
    pairStopSkippedFills: weeks.reduce((sum, week) => sum + week.pairStopSkippedFills, 0),
    basketStop: weeks.reduce((sum, week) => sum + week.basketStop, 0),
    basketStopLossAdr: variant.basketStopLossAdr ?? null,
    basketStopHitWeeks: weeks.filter((week) => week.basketStopHit).length,
    basketStopSkippedFills: weeks.reduce((sum, week) => sum + week.basketStopSkippedFills, 0),
    basketTakeProfit: weeks.reduce((sum, week) => sum + week.basketTakeProfit, 0),
    basketTakeProfitAdr: variant.basketTakeProfitAdr ?? null,
    basketTakeProfitHitWeeks: weeks.filter((week) => week.basketTakeProfitHit).length,
    basketTakeProfitSkippedFills: weeks.reduce((sum, week) => sum + week.basketTakeProfitSkippedFills, 0),
    runnerFraction: variant.runnerFraction ?? null,
    runnerExitMode: variant.runnerExitMode ?? null,
    runnerArmAdr: variant.runnerArmAdr ?? null,
    runnerTrailAdr: variant.runnerTrailAdr ?? null,
    runnerBreakeven: weeks.reduce((sum, week) => sum + week.runnerBreakeven, 0),
    runnerTrailing: weeks.reduce((sum, week) => sum + week.runnerTrailing, 0),
    runnerWeekClose: weeks.reduce((sum, week) => sum + week.runnerWeekClose, 0),
    gridTpAdr: round(weeks.reduce((sum, week) => sum + week.gridTpAdr, 0), 6) ?? 0,
    runnerAdr: round(weeks.reduce((sum, week) => sum + week.runnerAdr, 0), 6) ?? 0,
    runnerGivebackAdr: round(weeks.reduce((sum, week) => sum + week.runnerGivebackAdr, 0), 6) ?? 0,
    basketTakeProfitExitAdr: round(weeks.reduce((sum, week) => sum + week.basketTakeProfitExitAdr, 0), 6) ?? 0,
    stopExitAdr: round(weeks.reduce((sum, week) => sum + week.stopExitAdr, 0), 6) ?? 0,
    weekCloseRawPct: round(weeks.reduce((sum, week) => sum + week.weekCloseRawPct, 0), 6) ?? 0,
    weekCloseAdr: round(weeks.reduce((sum, week) => sum + week.weekCloseAdr, 0), 6) ?? 0,
    totalRawPct: round(totalRawPct, 6) ?? 0,
    totalAdr: round(totalAdr, 6) ?? 0,
    averageRawPctPerWeek: weeks.length > 0 ? round(totalRawPct / weeks.length, 6) ?? 0 : 0,
    averageAdrPerWeek: weeks.length > 0 ? round(totalAdr / weeks.length, 6) ?? 0 : 0,
    weeklyWins: weeks.filter((week) => week.finalAdr > 0).length,
    weeklyLosses: weeks.filter((week) => week.finalAdr < 0).length,
    worstWeekLabel: worstWeek?.weekLabel ?? null,
    worstWeekAdr: worstWeek?.finalAdr ?? null,
    worstPathDrawdownAdr: round(worstPathDrawdown, 6) ?? 0,
    cumulativeMaxDrawdownAdr: round(cumulativeMaxDrawdown, 6) ?? 0,
    returnOverWorstPathDd: worstPathDrawdown < 0 ? round(totalAdr / Math.abs(worstPathDrawdown), 4) : null,
    returnOverCumulativeDd: cumulativeMaxDrawdown < 0 ? round(totalAdr / Math.abs(cumulativeMaxDrawdown), 4) : null,
    maxActiveFills: weeks.reduce((max, week) => Math.max(max, week.maxActiveFills), 0),
    maxActiveAdrExposure: weeks.reduce((max, week) => Math.max(max, week.maxActiveAdrExposure), 0),
    maxAverageActiveAgeHoursAtMaxActive: maxOrNull(weeks.map((week) => week.averageActiveAgeHoursAtMaxActive)),
    maxActiveAgeHoursAtMaxActive: maxOrNull(weeks.map((week) => week.maxActiveAgeHoursAtMaxActive)),
    maxAverageActiveAgeHoursAtMaxDrawdown: maxOrNull(weeks.map((week) => week.averageActiveAgeHoursAtMaxDrawdown)),
    maxActiveAgeHoursAtMaxDrawdown: maxOrNull(weeks.map((week) => week.maxActiveAgeHoursAtMaxDrawdown)),
    worstPair: worstPair.key,
    worstPairAdr: worstPair.value,
    worstCurrency: worstCurrency.key,
    worstCurrencyAdr: worstCurrency.value,
  };
}

function variantWeeksToCsv(rows: VariantWeek[]) {
  const columns: Array<keyof VariantWeek> = [
    "variantId",
    "variantLabel",
    "cotModeId",
    "strengthModeId",
    "weekLabel",
    "selectedPairSides",
    "selectedPairs",
    "agreementPairs",
    "disagreementPairs",
    "fills",
    "tp",
    "reset",
    "weekClose",
    "pairStop",
    "pairInventoryStopLossAdr",
    "pairStopHitCount",
    "pairStopSkippedFills",
    "basketStop",
    "basketStopLossAdr",
    "basketStopHit",
    "basketStopTimeUtc",
    "basketStopSkippedFills",
    "basketTakeProfit",
    "basketTakeProfitAdr",
    "basketTakeProfitHit",
    "basketTakeProfitTimeUtc",
    "basketTakeProfitSkippedFills",
    "runnerFraction",
    "runnerExitMode",
    "runnerArmAdr",
    "runnerTrailAdr",
    "runnerBreakeven",
    "runnerTrailing",
    "runnerWeekClose",
    "gridTpAdr",
    "runnerAdr",
    "runnerGivebackAdr",
    "basketTakeProfitExitAdr",
    "stopExitAdr",
    "weekCloseRawPct",
    "weekCloseAdr",
    "finalRawPct",
    "finalAdr",
    "maxDrawdownRawPct",
    "maxDrawdownAdr",
    "maxDrawdownTimeUtc",
    "peakAdr",
    "troughAdr",
    "maxActiveFills",
    "maxActiveAdrExposure",
    "maxActiveTimeUtc",
    "averageActiveAgeHoursAtMaxActive",
    "maxActiveAgeHoursAtMaxActive",
    "averageActiveAgeHoursAtMaxDrawdown",
    "maxActiveAgeHoursAtMaxDrawdown",
    "worstPair",
    "worstPairAdr",
    "worstCurrency",
    "worstCurrencyAdr",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function stopEventsToCsv(rows: StopEvent[]) {
  const columns: Array<keyof StopEvent> = [
    "variantId",
    "variantLabel",
    "weekLabel",
    "weekOpenUtc",
    "stopType",
    "symbol",
    "direction",
    "thresholdAdr",
    "stopTimeUtc",
    "triggerAdr",
    "activeClosedFills",
    "activeMarkedAdr",
    "activeOriginalAdr",
    "activeDeltaAdr",
    "skippedFills",
    "skippedOriginalAdr",
    "skippedOriginalTp",
    "skippedOriginalReset",
    "skippedOriginalWeekClose",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function pairQualificationsToCsv(rows: PairQualificationRow[]) {
  const columns: Array<keyof PairQualificationRow> = [
    "variantId",
    "variantLabel",
    "weekLabel",
    "weekOpenUtc",
    "symbol",
    "dealerDirection",
    "commercialDirection",
    "dealerCommercialAgreementState",
    "cotFacesDirection",
    "commercialDeltaCotDirection",
    "openStrengthDirection",
    "openFadeDirection",
    "fridayStrengthDirection",
    "fridayFadeDirection",
    "fridayOpenFadeAgreementState",
    "agreementState",
    "selectedSide",
    "exclusionReason",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function selectedSideCount(row: PairQualificationRow) {
  return row.selectedSide?.split(";").filter(Boolean).length ?? 0;
}

function countReason(rows: PairQualificationRow[], predicate: (reason: string) => boolean) {
  return rows.filter((row) => row.exclusionReason && predicate(row.exclusionReason)).length;
}

function exclusionReasonCounts(rows: PairQualificationRow[]) {
  const reasons: Record<string, number> = {};
  for (const row of rows) {
    if (!row.exclusionReason) continue;
    reasons[row.exclusionReason] = (reasons[row.exclusionReason] ?? 0) + 1;
  }
  return reasons;
}

function buildWarehouseSourceContexts(preparedWeeks: PreparedReceiptWeek[]): ResearchMatrixSourceContext[] {
  return preparedWeeks.flatMap((prepared) =>
    prepared.contexts.map((context) => ({
      weekOpenUtc: prepared.receipt.scope.weekOpenUtc,
      symbol: context.symbol,
      assetClass: "fx" as const,
      dealerDirection: context.appSource.dealer,
      commercialDirection: context.appSource.commercial,
      cotFacesDirection: context.cot.cot_faces_v1_forced,
      commercialDeltaCotDirection: context.cot.cot_faces_v1_commercial_delta_contrarian,
      fridayStrengthDirection: context.strength.strength_friday_snapshot,
      marketOpenStrengthDirection: context.strength.strength_open_canonical,
      sourceTimestamps: {
        fridayStrength: context.strengthSnapshotUtc.strength_friday_snapshot,
        marketOpenStrength: context.strengthSnapshotUtc.strength_open_canonical,
      },
      sourceScores: {},
      coverage: {
        dealerDirectional: isDirectional(context.appSource.dealer),
        commercialDirectional: isDirectional(context.appSource.commercial),
        cotFacesDirectional: isDirectional(context.cot.cot_faces_v1_forced),
        commercialDeltaCotDirectional: isDirectional(context.cot.cot_faces_v1_commercial_delta_contrarian),
        fridayStrengthDirectional: isDirectional(context.strength.strength_friday_snapshot),
        marketOpenStrengthDirectional: isDirectional(context.strength.strength_open_canonical),
      },
      flags: {},
    })),
  );
}

function buildWarehouseTradeOpportunities(preparedWeeks: PreparedReceiptWeek[]): ResearchMatrixTradeOpportunity[] {
  return preparedWeeks.flatMap((prepared) =>
    prepared.receipt.trades.map((trade) => ({
      weekOpenUtc: prepared.receipt.scope.weekOpenUtc,
      symbol: trade.symbol,
      direction: trade.direction,
      fillSeq: trade.fillSeq,
      component: trade.component ?? "grid",
      entryTimeUtc: trade.entryTimeUtc,
      entryPrice: trade.entryPrice,
      plannedExitTimeUtc: trade.exitTimeUtc,
      plannedExitReason: trade.exitReason,
      plannedExitPrice: trade.exitPrice,
      pairAdrPct: trade.pairAdrPct,
      rawReturnPct: trade.rawReturnPct,
      adrReturn: trade.adrReturn,
      metadata: {
        receiptPath: prepared.receiptPath,
        weekLabel: prepared.receipt.scope.weekLabel,
      },
    })),
  );
}

function variantDefinition(variant: Variant): ResearchMatrixVariantDefinition {
  return {
    logicVersion: RESEARCH_MATRIX_LOGIC_VERSION,
    variantId: variant.id,
    variantLabel: variant.label,
    parameters: {
      basketStopLossAdr: variant.basketStopLossAdr ?? null,
      basketTakeProfitAdr: variant.basketTakeProfitAdr ?? null,
      pairInventoryStopLossAdr: variant.pairInventoryStopLossAdr ?? null,
      runnerFraction: variant.runnerFraction ?? null,
      runnerExitMode: variant.runnerExitMode ?? null,
      runnerArmAdr: variant.runnerArmAdr ?? null,
      runnerTrailAdr: variant.runnerTrailAdr ?? null,
      baseVariantId: variant.baseVariantId ?? null,
    },
    sourceFilters: {
      cotModeId: variant.cotModeId ?? null,
      strengthModeId: variant.strengthModeId ?? null,
      note: variant.note,
    },
  };
}

function pairQualificationSourceState(row: PairQualificationRow) {
  return {
    dealerDirection: row.dealerDirection,
    commercialDirection: row.commercialDirection,
    dealerCommercialAgreementState: row.dealerCommercialAgreementState,
    cotFacesDirection: row.cotFacesDirection,
    commercialDeltaCotDirection: row.commercialDeltaCotDirection,
    openStrengthDirection: row.openStrengthDirection,
    openFadeDirection: row.openFadeDirection,
    fridayStrengthDirection: row.fridayStrengthDirection,
    fridayFadeDirection: row.fridayFadeDirection,
    fridayOpenFadeAgreementState: row.fridayOpenFadeAgreementState,
    agreementState: row.agreementState,
  };
}

function pairQualificationWarehouseSourceState(row: PairQualificationRow) {
  if ((process.env.RESEARCH_MATRIX_PAIR_DECISION_SOURCE_STATE ?? "join").toLowerCase() === "full") {
    return pairQualificationSourceState(row);
  }

  return {
    sourceStateJoin: "research_matrix_source_contexts",
    joinKeys: {
      weekOpenUtc: row.weekOpenUtc,
      symbol: row.symbol.toUpperCase(),
    },
  };
}

function buildWarehousePairDecisions(
  pairQualifications: PairQualificationRow[],
  variantRunIds: Map<string, string>,
): ResearchMatrixPairDecision[] {
  return pairQualifications.flatMap((row) => {
    const variantRunId = variantRunIds.get(row.variantId);
    if (!variantRunId) return [];
    return {
      variantRunId,
      weekOpenUtc: row.weekOpenUtc,
      symbol: row.symbol,
      selectedSide: row.selectedSide,
      exclusionReason: row.exclusionReason,
      sourceState: pairQualificationWarehouseSourceState(row),
      decisionScores: {
        selectedSideCount: selectedSideCount(row),
      },
    };
  });
}

function buildWarehouseVariantWeekResult(
  row: VariantWeek,
  variantRunId: string,
): ResearchMatrixVariantWeekResult {
  return {
    variantRunId,
    weekOpenUtc: row.weekOpenUtc,
    selectedPairSides: row.selectedPairSides,
    fills: row.fills,
    finalAdr: row.finalAdr,
    finalRawPct: row.finalRawPct,
    maxDrawdownAdr: row.maxDrawdownAdr,
    maxDrawdownTimeUtc: row.maxDrawdownTimeUtc,
    weekCloseAdr: row.weekCloseAdr,
    gridTpAdr: row.gridTpAdr,
    runnerAdr: row.runnerAdr,
    stopExitAdr: row.stopExitAdr,
    basketTakeProfitExitAdr: row.basketTakeProfitExitAdr,
    maxActiveFills: row.maxActiveFills,
    worstPair: row.worstPair,
    worstPairAdr: row.worstPairAdr,
    worstCurrency: row.worstCurrency,
    worstCurrencyAdr: row.worstCurrencyAdr,
    pairContributions: row.pairAdrContributions,
    currencyContributions: row.currencyAdrContributions,
    exitCounts: {
      tp: row.tp,
      reset: row.reset,
      weekClose: row.weekClose,
      pairStop: row.pairStop,
      basketStop: row.basketStop,
      basketTakeProfit: row.basketTakeProfit,
      runnerBreakeven: row.runnerBreakeven,
      runnerTrailing: row.runnerTrailing,
      runnerWeekClose: row.runnerWeekClose,
    },
    metadata: {
      variantId: row.variantId,
      variantLabel: row.variantLabel,
      weekLabel: row.weekLabel,
      cotModeId: row.cotModeId,
      strengthModeId: row.strengthModeId,
      note: row.note,
      selectedPairs: row.selectedPairs,
      agreementPairs: row.agreementPairs,
      disagreementPairs: row.disagreementPairs,
      pairInventoryStopLossAdr: row.pairInventoryStopLossAdr,
      basketStopLossAdr: row.basketStopLossAdr,
      basketTakeProfitAdr: row.basketTakeProfitAdr,
      runnerFraction: row.runnerFraction,
      runnerExitMode: row.runnerExitMode,
      runnerArmAdr: row.runnerArmAdr,
      runnerTrailAdr: row.runnerTrailAdr,
      basketStopHit: row.basketStopHit,
      basketStopTimeUtc: row.basketStopTimeUtc,
      basketTakeProfitHit: row.basketTakeProfitHit,
      basketTakeProfitTimeUtc: row.basketTakeProfitTimeUtc,
      peakAdr: row.peakAdr,
      troughAdr: row.troughAdr,
      maxActiveAdrExposure: row.maxActiveAdrExposure,
      maxActiveTimeUtc: row.maxActiveTimeUtc,
      runnerGivebackAdr: row.runnerGivebackAdr,
    },
  };
}

function buildWarehouseTradeEvent(
  trade: VariantTradeEvent,
  variantRunId: string,
): ResearchMatrixTradeEvent {
  return {
    variantRunId,
    weekOpenUtc: trade.weekOpenUtc,
    symbol: trade.symbol,
    direction: trade.direction,
    fillSeq: trade.fillSeq,
    component: trade.component ?? "grid",
    entryTimeUtc: trade.entryTimeUtc,
    exitTimeUtc: trade.exitTimeUtc,
    exitReason: trade.exitReason,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    pairAdrPct: trade.pairAdrPct,
    rawReturnPct: trade.rawReturnPct,
    adrReturn: trade.adrReturn,
    sizeFactor: tradeSize(trade),
    sourceState: {},
    pathStats: {},
    metadata: {
      variantId: trade.variantId,
      variantLabel: trade.variantLabel,
      weekLabel: trade.weekLabel,
      sourceStateJoin: "research_matrix_pair_decisions",
    },
  };
}

function buildWarehouseStopEvent(event: StopEvent, variantRunId: string): ResearchMatrixStopEvent {
  return {
    variantRunId,
    weekOpenUtc: event.weekOpenUtc,
    stopType: event.stopType,
    symbol: event.symbol,
    direction: event.direction,
    thresholdAdr: event.thresholdAdr,
    stopTimeUtc: event.stopTimeUtc,
    triggerAdr: event.triggerAdr,
    activeClosedFills: event.activeClosedFills,
    activeMarkedAdr: event.activeMarkedAdr,
    activeOriginalAdr: event.activeOriginalAdr,
    activeDeltaAdr: event.activeDeltaAdr,
    skippedFills: event.skippedFills,
    skippedOriginalAdr: event.skippedOriginalAdr,
    skippedExitCounts: {
      tp: event.skippedOriginalTp,
      reset: event.skippedOriginalReset,
      weekClose: event.skippedOriginalWeekClose,
    },
    metadata: {
      variantId: event.variantId,
      variantLabel: event.variantLabel,
      weekLabel: event.weekLabel,
    },
  };
}

async function writeResearchMatrixWarehouse(options: {
  receiptPaths: string[];
  matrixWeeks: MatrixWeekMetadata[];
  universe: string[];
  sourceContexts: ResearchMatrixSourceContext[];
  tradeOpportunities: ResearchMatrixTradeOpportunity[];
  variants: Variant[];
  weekRows: VariantWeek[];
  tradeEvents: VariantTradeEvent[];
  tradeEventRowsAvailable: number;
  stopEvents: StopEvent[];
  pairQualifications: PairQualificationRow[];
  pathResolution: string;
  sourceContextNeeds: SourceContextNeeds;
  tradeEventMode: MatrixTradeEventPersistenceMode;
  tradeEventVariantIds: Set<string>;
}) {
  const firstWeek = [...options.matrixWeeks].sort((left, right) =>
    left.weekOpenUtc.localeCompare(right.weekOpenUtc))[0];
  const lastWeek = [...options.matrixWeeks].sort((left, right) =>
    right.executionWindowCloseUtc.localeCompare(left.executionWindowCloseUtc))[0];
  if (!firstWeek || !lastWeek) throw new Error("Cannot write matrix warehouse without prepared weeks.");

  const datasetHash = argValue("matrix-dataset-hash") ?? hashResearchMatrixPayload({
    datasetVersion: RESEARCH_MATRIX_DATASET_VERSION,
    receiptPaths: options.receiptPaths,
    weeks: options.matrixWeeks,
    pathResolution: options.pathResolution,
    sourceContextNeeds: options.sourceContextNeeds,
    tradeEventMode: options.tradeEventMode,
    tradeEventVariantIds: [...options.tradeEventVariantIds].sort(),
  });

  await ensureResearchMatrixWarehouseSchema();
  const dataset = await upsertResearchMatrixDataset({
    datasetVersion: RESEARCH_MATRIX_DATASET_VERSION,
    datasetHash,
    assetClass: "fx",
    fromUtc: firstWeek.weekOpenUtc,
    toUtc: lastWeek.executionWindowCloseUtc,
    universe: options.universe,
    sourceVersions: {
      cotModes: COT_MODES.map((mode) => mode.id),
      strengthModes: STRENGTH_MODES.map((mode) => mode.id),
      sourceContextNeeds: options.sourceContextNeeds,
    },
    executionVersions: {
      logicVersion: RESEARCH_MATRIX_LOGIC_VERSION,
      pathResolution: options.pathResolution,
      sourceScript: "audit-fx-hedged-adr-grid-side-selectors",
      tradeEventPersistenceMode: options.tradeEventMode,
      tradeEventVariantIds: [...options.tradeEventVariantIds].sort(),
    },
    coverage: {
      weeks: options.matrixWeeks.length,
      pairs: options.universe.length,
      variants: options.variants.length,
      sourceContextRows: options.sourceContexts.length,
      tradeEventRowsAvailable: options.tradeEventRowsAvailable,
    },
    notes: [
      "Gate 44 one-slice matrix warehouse materialization.",
      "Raw receipt trades are stored as reusable trade opportunities; variant events are stored per logic run.",
    ],
    status: "building",
  });

  const variantRunInputs = options.variants.map((variant) => {
    const definition = variantDefinition(variant);
    const resultHash = hashResearchMatrixPayload({
      datasetHash,
      definition,
      weekRows: options.weekRows
        .filter((row) => row.variantId === variant.id)
        .map((row) => ({
          weekOpenUtc: row.weekOpenUtc,
          finalAdr: row.finalAdr,
          maxDrawdownAdr: row.maxDrawdownAdr,
          selectedPairSides: row.selectedPairSides,
          fills: row.fills,
        })),
    });
    return {
      definition,
      resultHash,
      status: "complete",
    } as const;
  });
  const variantRuns = await profileAsync("matrix_variant_runs_upsert", () =>
    createResearchMatrixVariantRuns({
      datasetId: dataset.datasetId,
      runs: variantRunInputs,
    }));
  const variantRunIds = new Map(variantRuns.map((run) => [run.variantId, run.variantRunId] as const));

  const pairDecisions = buildWarehousePairDecisions(options.pairQualifications, variantRunIds);
  const variantWeekResults = options.weekRows.flatMap((row) => {
    const variantRunId = variantRunIds.get(row.variantId);
    return variantRunId ? [buildWarehouseVariantWeekResult(row, variantRunId)] : [];
  });
  const persistedTradeEvents = options.tradeEventMode === "none"
    ? []
    : options.tradeEvents.filter((event) =>
        options.tradeEventMode === "full" || options.tradeEventVariantIds.has(event.variantId));
  const warehouseTradeEvents = persistedTradeEvents.flatMap((event) => {
    const variantRunId = variantRunIds.get(event.variantId);
    return variantRunId ? [buildWarehouseTradeEvent(event, variantRunId)] : [];
  });
  const warehouseStopEvents = options.stopEvents.flatMap((event) => {
    const variantRunId = variantRunIds.get(event.variantId);
    return variantRunId ? [buildWarehouseStopEvent(event, variantRunId)] : [];
  });

  const writeCounts = {
    sourceContexts: await profileAsync("matrix_source_contexts_write", () =>
      persistResearchMatrixSourceContexts({ datasetId: dataset.datasetId, rows: options.sourceContexts })),
    tradeOpportunities: await profileAsync("matrix_trade_opportunities_write", () =>
      persistResearchMatrixTradeOpportunities({ datasetId: dataset.datasetId, rows: options.tradeOpportunities })),
    variantRuns: variantRunIds.size,
    pairDecisions: await profileAsync("matrix_pair_decisions_write", () =>
      persistResearchMatrixPairDecisions(pairDecisions)),
    variantWeekResults: await profileAsync("matrix_variant_week_results_write", () =>
      persistResearchMatrixVariantWeekResults(variantWeekResults)),
    tradeEvents: await profileAsync("matrix_trade_events_write", () =>
      persistResearchMatrixTradeEvents(warehouseTradeEvents)),
    stopEvents: await profileAsync("matrix_stop_events_write", () =>
      persistResearchMatrixStopEvents(warehouseStopEvents)),
  };
  await markResearchMatrixDatasetComplete(dataset.datasetId);
  const persistedCounts = await profileAsync("matrix_persist_counts_read", () =>
    readResearchMatrixPersistCounts(dataset.datasetId));
  return {
    datasetId: dataset.datasetId,
    datasetHash,
    writeCounts,
    persistedCounts,
  };
}

function summarizeSourceCoverage(
  rows: PairQualificationRow[],
): { summaries: SourceCoverageSummary[]; weekRows: SourceCoverageWeekRow[] } {
  const byVariant = new Map<string, PairQualificationRow[]>();
  const byVariantWeek = new Map<string, PairQualificationRow[]>();

  for (const row of rows) {
    const variantRows = byVariant.get(row.variantId) ?? [];
    variantRows.push(row);
    byVariant.set(row.variantId, variantRows);

    const weekKey = `${row.variantId}::${row.weekLabel}`;
    const weekRows = byVariantWeek.get(weekKey) ?? [];
    weekRows.push(row);
    byVariantWeek.set(weekKey, weekRows);
  }

  const summaries = [...byVariant.values()].map((variantRows) => {
    const selectedRows = variantRows.filter((row) => !row.exclusionReason && selectedSideCount(row) > 0).length;
    const missingFridayStrengthRows = countReason(variantRows, (reason) => reason.includes("missing_friday_strength"));
    const missingOpenStrengthRows = countReason(variantRows, (reason) => reason.includes("missing_open_canonical_strength"));
    const missingCotDirectionRows = countReason(variantRows, (reason) => reason.includes("missing_cot"));
    const dealerCommercialDisagreeRows = countReason(variantRows, (reason) => reason === "dealer_commercial_disagree");
    const dealerNotDirectionalRows = countReason(variantRows, (reason) => reason.includes("dealer_not_directional"));
    const commercialNotDirectionalRows = countReason(variantRows, (reason) => reason.includes("commercial_not_directional"));
    const variantFilterNotMetRows = countReason(variantRows, (reason) => reason === "variant_filter_not_met");
    const classifiedExcluded =
      missingFridayStrengthRows +
      missingOpenStrengthRows +
      missingCotDirectionRows +
      dealerCommercialDisagreeRows +
      dealerNotDirectionalRows +
      commercialNotDirectionalRows +
      variantFilterNotMetRows;
    const excludedRows = variantRows.filter((row) => row.exclusionReason).length;
    return {
      variantId: variantRows[0]?.variantId ?? "",
      variantLabel: variantRows[0]?.variantLabel ?? "",
      weeks: new Set(variantRows.map((row) => row.weekLabel)).size,
      pairRows: variantRows.length,
      selectedRows,
      selectedPairSides: variantRows.reduce((sum, row) => sum + selectedSideCount(row), 0),
      missingFridayStrengthRows,
      missingOpenStrengthRows,
      missingCotDirectionRows,
      dealerCommercialDisagreeRows,
      dealerNotDirectionalRows,
      commercialNotDirectionalRows,
      variantFilterNotMetRows,
      otherExcludedRows: Math.max(0, excludedRows - classifiedExcluded),
      exclusionReasons: exclusionReasonCounts(variantRows),
    };
  });

  const weekRows = [...byVariantWeek.values()].map((rowsForWeek) => ({
    variantId: rowsForWeek[0]?.variantId ?? "",
    variantLabel: rowsForWeek[0]?.variantLabel ?? "",
    weekLabel: rowsForWeek[0]?.weekLabel ?? "",
    weekOpenUtc: rowsForWeek[0]?.weekOpenUtc ?? "",
    pairRows: rowsForWeek.length,
    selectedRows: rowsForWeek.filter((row) => !row.exclusionReason && selectedSideCount(row) > 0).length,
    selectedPairSides: rowsForWeek.reduce((sum, row) => sum + selectedSideCount(row), 0),
    exclusionReasons: exclusionReasonCounts(rowsForWeek),
  }));

  return {
    summaries: summaries.sort((left, right) => left.variantLabel.localeCompare(right.variantLabel)),
    weekRows: weekRows.sort((left, right) =>
      left.weekLabel.localeCompare(right.weekLabel) || left.variantLabel.localeCompare(right.variantLabel)),
  };
}

function compactReasonCounts(reasons: Record<string, number>) {
  const entries = Object.entries(reasons).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return entries.length > 0 ? entries.map(([reason, count]) => `${reason}:${count}`).join("; ") : "-";
}

function buildSourceCoverageMarkdown(options: {
  generatedAtUtc: string;
  receiptPaths: string[];
  summaries: SourceCoverageSummary[];
  weekRows: SourceCoverageWeekRow[];
  jsonPath: string;
  pairQualificationCsvPath: string;
  pathResolution: string;
  profileRows: ProfileRow[];
}) {
  const summaryRow = (summary: SourceCoverageSummary) =>
    `| ${summary.variantLabel} | ${summary.weeks} | ${summary.pairRows} | ${summary.selectedRows} | ${summary.selectedPairSides} | ${summary.missingFridayStrengthRows} | ${summary.missingOpenStrengthRows} | ${summary.missingCotDirectionRows} | ${summary.dealerCommercialDisagreeRows} | ${summary.dealerNotDirectionalRows} | ${summary.commercialNotDirectionalRows} | ${summary.variantFilterNotMetRows} | ${summary.otherExcludedRows} |`;
  const weekRow = (row: SourceCoverageWeekRow) =>
    `| ${row.weekLabel} | ${row.variantLabel} | ${row.pairRows} | ${row.selectedRows} | ${row.selectedPairSides} | ${compactReasonCounts(row.exclusionReasons)} |`;

  return [
    "# Gate 42 FX Hedged ADR Grid Source Coverage Audit",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    "- Research-only source coverage receipt. No strategy score is produced.",
    "- Uses the same side-selector prepared source context path as the numeric audit.",
    "- Skips path-bar loading and variant simulation, even when `--path-resolution` is provided.",
    "- Pair qualification CSV carries per-pair source directions, selected side, and exclusion reason.",
    `- Requested path resolution: ${options.pathResolution}.`,
    "",
    "Receipts:",
    "",
    ...options.receiptPaths.map((receiptPath) => `- ${receiptPath}`),
    "",
    "## Source Coverage Summary",
    "",
    "| Variant | Weeks | Pair Rows | Selected Rows | Selected Pair Sides | Missing Friday Strength | Missing Open Strength | Missing COT | Dealer/Commercial Disagree | Dealer Missing | Commercial Missing | Filter Not Met | Other Excluded |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.summaries.map(summaryRow),
    "",
    "## Week Breakout",
    "",
    "| Week | Variant | Pair Rows | Selected Rows | Selected Pair Sides | Exclusion Reasons |",
    "|---|---|---:|---:|---:|---|",
    ...options.weekRows.map(weekRow),
    "",
    ...(options.profileRows.length > 0
      ? [
          "## Profile Timings",
          "",
          "| Bucket | Count | Total ms | Avg ms |",
          "|---|---:|---:|---:|",
          ...options.profileRows.map((row) =>
            `| ${row.label} | ${row.count} | ${row.totalMs} | ${(row.totalMs / Math.max(1, row.count)).toFixed(1)} |`),
          "",
        ]
      : []),
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- Pair qualification CSV: ${options.pairQualificationCsvPath}`,
    "",
  ].join("\n");
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  receiptPaths: string[];
  summaries: VariantSummary[];
  weekRows: VariantWeek[];
  stopEvents: StopEvent[];
  jsonPath: string;
  csvPath: string;
  stopEventsCsvPath: string;
  pairQualificationCsvPath: string;
  pathResolution: string;
  profileRows: ProfileRow[];
}) {
  const hasBasketStopLossSweep = options.summaries.some((summary) => summary.basketStopLossAdr !== null);
  const hasPairStopLossSweep = options.summaries.some((summary) => summary.pairInventoryStopLossAdr !== null);
  const hasBasketTakeProfitSweep = options.summaries.some((summary) => summary.basketTakeProfitAdr !== null);
  const hasRunnerSweep = options.summaries.some((summary) => summary.runnerFraction !== null);
  const hasStopLossSweep = hasBasketStopLossSweep || hasPairStopLossSweep;
  const hasGate40Sweep = hasBasketTakeProfitSweep || hasRunnerSweep;
  const ranked = [...options.summaries].sort((left, right) =>
    (right.returnOverWorstPathDd ?? -999) - (left.returnOverWorstPathDd ?? -999));
  const summaryRow = (summary: VariantSummary) =>
    `| ${summary.variantLabel} | ${summary.pairInventoryStopLossAdr ?? "-"} | ${summary.pairStopHitWeeks} | ${summary.basketStopLossAdr ?? "-"} | ${summary.basketStopHitWeeks} | ${summary.basketTakeProfitAdr ?? "-"} | ${summary.basketTakeProfitHitWeeks} | ${summary.runnerFraction ?? "-"} | ${summary.runnerExitMode ?? "-"} | ${summary.selectedPairSides} | ${signed(summary.totalRawPct, 2)} | ${signed(summary.totalAdr, 2)} | ${signed(summary.averageAdrPerWeek, 2)} | ${summary.weeklyWins}/${summary.weeklyLosses} | ${summary.worstWeekLabel ?? "-"} ${signed(summary.worstWeekAdr, 2)} | ${signed(summary.worstPathDrawdownAdr, 2)} | ${summary.returnOverWorstPathDd === null ? "-" : summary.returnOverWorstPathDd.toFixed(2)} | ${signed(summary.weekCloseAdr, 2)} | ${signed(summary.gridTpAdr, 2)} | ${signed(summary.runnerAdr, 2)} | ${signed(summary.runnerGivebackAdr, 2)} | ${signed(summary.basketTakeProfitExitAdr, 2)} | ${signed(summary.stopExitAdr, 2)} | ${summary.maxActiveFills} | ${summary.maxAverageActiveAgeHoursAtMaxActive ?? "-"} | ${summary.worstPair ?? "-"} ${signed(summary.worstPairAdr, 2)} | ${summary.worstCurrency ?? "-"} ${signed(summary.worstCurrencyAdr, 2)} |`;
  const weekRow = (row: VariantWeek) =>
    `| ${row.weekLabel} | ${row.variantLabel} | ${row.pairInventoryStopLossAdr ?? "-"} | ${row.pairStopHitCount} | ${row.basketStopLossAdr ?? "-"} | ${row.basketStopHit ? "Y" : "N"} | ${row.basketTakeProfitAdr ?? "-"} | ${row.basketTakeProfitHit ? "Y" : "N"} | ${row.runnerFraction ?? "-"} | ${row.runnerExitMode ?? "-"} | ${row.selectedPairSides} | ${signed(row.finalRawPct, 2)} | ${signed(row.finalAdr, 2)} | ${signed(row.maxDrawdownAdr, 2)} | ${signed(row.weekCloseAdr, 2)} | ${signed(row.gridTpAdr, 2)} | ${signed(row.runnerAdr, 2)} | ${signed(row.runnerGivebackAdr, 2)} | ${signed(row.basketTakeProfitExitAdr, 2)} | ${signed(row.stopExitAdr, 2)} | ${row.fills} | ${row.tp}/${row.reset}/${row.weekClose}/${row.pairStop}/${row.basketStop}/${row.basketTakeProfit}/${row.runnerBreakeven}/${row.runnerTrailing}/${row.runnerWeekClose} | ${row.maxActiveFills} | ${row.averageActiveAgeHoursAtMaxActive ?? "-"} | ${row.worstPair ?? "-"} ${signed(row.worstPairAdr, 2)} | ${row.worstCurrency ?? "-"} ${signed(row.worstCurrencyAdr, 2)} |`;
  const stopEventRow = (row: StopEvent) =>
    `| ${row.weekLabel} | ${row.variantLabel} | ${row.stopType} | ${row.symbol ?? "-"} | ${row.direction ?? "-"} | ${row.thresholdAdr} | ${row.stopTimeUtc} | ${signed(row.triggerAdr, 2)} | ${row.activeClosedFills} | ${signed(row.activeMarkedAdr, 2)} | ${signed(row.activeOriginalAdr, 2)} | ${signed(row.activeDeltaAdr, 2)} | ${row.skippedFills} | ${signed(row.skippedOriginalAdr, 2)} | ${row.skippedOriginalTp}/${row.skippedOriginalReset}/${row.skippedOriginalWeekClose} |`;
  const coreSummaries = options.summaries.filter((summary) => summary.variantId !== "fully_hedged_baseline");
  const lines = [
    hasGate40Sweep
      ? "# Gate 40 FX Hedged ADR Grid Take-Profit / Runner Hardening"
      : hasStopLossSweep
      ? "# Gate 39 FX Hedged ADR Grid Stop-Loss Hardening"
      : "# Gate 38 FX Hedged ADR Grid Dealer / Commercial Agreement Audit",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    "- Research-only. No live strategy logic changed.",
    "- Sentiment excluded: stored sample is too short for this gate.",
    `- Uses existing hedged ADR Grid receipts and rebuilds marked paths from recorded fills plus canonical ${options.pathResolution} bars.`,
    "- ADR Grid terms are unchanged: 0.20 ADR spacing/TP, 1.0 ADR reset, 0.20 ADR reset-entry buffer, no SL, no costs, no margin.",
    "- App-style Dealer and Commercial directions come from canonical basketSource output.",
    "- COT modes: cot_faces_v1_forced and cot_faces_v1_commercial_delta_contrarian.",
    "- Strength modes: strength_open_canonical and strength_friday_snapshot.",
    "- strength_open_canonical is the Gate 43 M1-backed market-open confirmation context, resolved from FX market-truth open and kept separate from the later execution window.",
    "- strength_friday_snapshot uses only latest 1h/4h/24h strength snapshots at or before Friday 17:00 New York.",
    "- Pair qualification metadata is emitted for later breakouts: Dealer direction, Commercial direction, Dealer/Commercial agreement state, COT direction, open strength, open-fade direction, Friday strength, Friday-fade direction, selected side, and exclusion reason.",
    ...(hasBasketStopLossSweep
      ? [
          "- Basket SL rows are research-only hard stops on the selected basket path: close active selected fills and block new selected fills when marked selected-basket ADR reaches the listed negative threshold from week open.",
        ]
      : []),
    ...(hasPairStopLossSweep
      ? [
          "- Pair inventory SL rows are research-only hard stops on each pair-side: close active fills and block new fills for that pair-side when adverse distance from active average entry reaches the listed ADR threshold.",
        ]
      : []),
    ...(hasBasketTakeProfitSweep
      ? [
          "- Basket TP rows are research-only positive basket exits: close active selected fills and block new selected fills when marked selected-basket ADR reaches the listed positive threshold from week open.",
        ]
      : []),
    ...(hasRunnerSweep
      ? [
          `- Runner rows split grid TP fills into a normal TP fraction and a small runner fraction. Runner scoring is research-only and uses ${options.pathResolution} marked exits.`,
        ]
      : []),
    "",
    "Receipts:",
    "",
    ...options.receiptPaths.map((receiptPath) => `- ${receiptPath}`),
    "",
    "## Source Mode Matrix",
    "",
    "| Variant | Pair SL | Pair Hit Wks | Basket SL | Basket SL Hit Wks | Basket TP | Basket TP Hit Wks | Runner Frac | Runner Mode | Pair Sides | Total Raw % | Total ADR | Avg/Wk ADR | W/L | Worst Wk | Worst Path DD | R/DD | Week-Close ADR | Grid TP ADR | Runner ADR | Runner Giveback | Basket TP ADR | Stop ADR | Max Active | Age H | Worst Pair | Worst Currency |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...coreSummaries.map(summaryRow),
    "",
    "## Ranked Variants",
    "",
    "| Rank | Variant | Pair SL | Basket SL | Basket TP | Runner | Total ADR | Worst Path DD | R/DD | Week-Close ADR | Grid TP ADR | Runner ADR | Runner Giveback | Basket TP ADR | Stop ADR | Fills | TP/Reset/WC/PairSL/BasketSL/BasketTP/BE/Trail/RunnerWC | Max Active | Age H | Worst Pair | Worst Currency |",
    "|---:|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...ranked.map((summary, index) =>
      `| ${index + 1} | ${summary.variantLabel} | ${summary.pairInventoryStopLossAdr ?? "-"} | ${summary.basketStopLossAdr ?? "-"} | ${summary.basketTakeProfitAdr ?? "-"} | ${summary.runnerFraction === null ? "-" : `${summary.runnerFraction}/${summary.runnerExitMode}`} | ${signed(summary.totalAdr, 2)} | ${signed(summary.worstPathDrawdownAdr, 2)} | ${summary.returnOverWorstPathDd === null ? "-" : summary.returnOverWorstPathDd.toFixed(2)} | ${signed(summary.weekCloseAdr, 2)} | ${signed(summary.gridTpAdr, 2)} | ${signed(summary.runnerAdr, 2)} | ${signed(summary.runnerGivebackAdr, 2)} | ${signed(summary.basketTakeProfitExitAdr, 2)} | ${signed(summary.stopExitAdr, 2)} | ${summary.fills} | ${summary.tp}/${summary.reset}/${summary.weekClose}/${summary.pairStop}/${summary.basketStop}/${summary.basketTakeProfit}/${summary.runnerBreakeven}/${summary.runnerTrailing}/${summary.runnerWeekClose} | ${summary.maxActiveFills} | ${summary.maxAverageActiveAgeHoursAtMaxActive ?? "-"} | ${summary.worstPair ?? "-"} ${signed(summary.worstPairAdr, 2)} | ${summary.worstCurrency ?? "-"} ${signed(summary.worstCurrencyAdr, 2)} |`),
    "",
    "## Weekly Rows",
    "",
    "| Week | Variant | Pair SL | Pair Hits | Basket SL | Basket SL Hit | Basket TP | Basket TP Hit | Runner Frac | Runner Mode | Pair Sides | Final Raw % | Final ADR | Max DD | Week-Close ADR | Grid TP ADR | Runner ADR | Runner Giveback | Basket TP ADR | Stop ADR | Fills | TP/Reset/WC/PairSL/BasketSL/BasketTP/BE/Trail/RunnerWC | Max Active | Age H | Worst Pair | Worst Currency |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.weekRows.map(weekRow),
    "",
    ...(options.stopEvents.length > 0
      ? [
          "## Stop Events",
          "",
          "Stop events show the active fills closed at the stop and the original outcome of fills blocked after the stop. `Active Delta ADR` is marked-stop ADR minus the original unstopped ADR for the same active fills; `Skipped Original ADR` is what the blocked later fills would have produced in the unstopped receipt.",
          "",
          "| Week | Variant | Stop | Symbol | Dir | Threshold ADR | Stop Time | Trigger ADR | Active Closed | Active Marked ADR | Active Original ADR | Active Delta ADR | Skipped | Skipped Original ADR | Skipped TP/Reset/WC |",
          "|---|---|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|",
          ...options.stopEvents.map(stopEventRow),
          "",
        ]
      : []),
    ...(options.profileRows.length > 0
      ? [
          "## Profile Timings",
          "",
          "| Bucket | Count | Total ms | Avg ms |",
          "|---|---:|---:|---:|",
          ...options.profileRows.map((row) =>
            `| ${row.label} | ${row.count} | ${row.totalMs} | ${(row.totalMs / Math.max(1, row.count)).toFixed(1)} |`),
          "",
        ]
      : []),
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- CSV: ${options.csvPath}`,
    `- Stop events CSV: ${options.stopEventsCsvPath}`,
    `- Pair qualification CSV: ${options.pairQualificationCsvPath}`,
    "",
  ];
  return lines.join("\n");
}

async function defaultReceiptPaths() {
  const base = "app/reports/data-verification/fx-hedged-adr-grid";
  return [
    "fx-28pair-hedged-adr-grid-2026-05-11-20260616-035426.json",
    "fx-28pair-hedged-adr-grid-2026-05-18-20260616-035414.json",
    "fx-28pair-hedged-adr-grid-2026-05-25-20260616-035406.json",
    "fx-28pair-hedged-adr-grid-2026-06-01-20260616-035403.json",
    "fx-28pair-hedged-adr-grid-2026-06-08-20260616-033849.json",
  ].map((name) => path.resolve(process.cwd(), base, name));
}

async function main() {
  const receiptArg = argValue("receipts");
  const receiptListFileArg = argValue("receipt-list-file");
  const receiptPaths = receiptArg
    ? receiptArg.split(",").map((value) => path.resolve(process.cwd(), value.trim())).filter(Boolean)
    : receiptListFileArg
      ? (await readFile(path.resolve(process.cwd(), receiptListFileArg), "utf8"))
          .split(/\r?\n|,/)
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => path.resolve(process.cwd(), value))
    : await defaultReceiptPaths();
  if (receiptPaths.length === 0) throw new Error("No receipts selected.");

  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/fx-hedged-adr-grid-side-selectors",
  );
  const pathResolution = normalizePathResolution(argValue("path-resolution"));
  const variantIds = parseVariantIds();
  const baseVariants = variantIds
    ? buildVariants().filter((variant) => variantIds.has(variant.id))
    : buildVariants();
  if (variantIds) {
    const foundIds = new Set(baseVariants.map((variant) => variant.id));
    const missingIds = [...variantIds].filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) throw new Error(`Unknown variant ids: ${missingIds.join(", ")}`);
  }
  const basketStopLossThresholds = parseNumberList("basket-sl-adr-thresholds");
  const pairInventoryStopLossThresholds = parseNumberList("pair-inventory-sl-adr-thresholds");
  const basketTakeProfitThresholds = parseNumberList("basket-tp-adr-thresholds");
  const runnerConfigs = parseRunnerConfigs();
  const sourceCoverageOnly = argFlag("source-coverage-only");
  const skipPairQualifications = argFlag("skip-pair-qualifications");
  const writeMatrixWarehouse = argFlag("write-research-matrix-warehouse");
  const matrixTradeEventMode = parseMatrixTradeEventPersistenceMode();
  const matrixTradeEventVariantIds = parseMatrixTradeEventVariantIds();
  if (writeMatrixWarehouse && sourceCoverageOnly) {
    throw new Error("--write-research-matrix-warehouse requires numeric variant evaluation, not --source-coverage-only.");
  }
  if (writeMatrixWarehouse && skipPairQualifications) {
    throw new Error("--write-research-matrix-warehouse requires pair qualifications for pair-decision provenance.");
  }
  if (matrixTradeEventMode !== "selected" && matrixTradeEventVariantIds.size > 0) {
    throw new Error("--matrix-trade-event-variant-ids requires --matrix-trade-event-mode=selected.");
  }
  if (matrixTradeEventMode === "selected" && matrixTradeEventVariantIds.size === 0) {
    throw new Error("--matrix-trade-event-mode=selected requires --matrix-trade-event-variant-ids.");
  }
  const stopLossVariants = expandStopLossVariants({
    variants: baseVariants,
    basketThresholds: basketStopLossThresholds,
    pairThresholds: pairInventoryStopLossThresholds,
  });
  const variants = expandGate40Variants({
    variants: stopLossVariants,
    basketTakeProfitThresholds,
    runnerConfigs,
  });
  const hasBasketStopLossSweep = basketStopLossThresholds.length > 0;
  const hasPairInventoryStopLossSweep = pairInventoryStopLossThresholds.length > 0;
  const hasBasketTakeProfitSweep = basketTakeProfitThresholds.length > 0;
  const hasRunnerSweep = runnerConfigs.length > 0;
  const hasStopLossSweep = hasBasketStopLossSweep || hasPairInventoryStopLossSweep;
  const hasGate40Sweep = hasBasketTakeProfitSweep || hasRunnerSweep;
  if (matrixTradeEventMode === "selected") {
    const finalVariantIds = new Set(variants.map((variant) => variant.id));
    const missingTradeEventVariantIds = [...matrixTradeEventVariantIds].filter((id) => !finalVariantIds.has(id));
    if (missingTradeEventVariantIds.length > 0) {
      throw new Error(`Unknown --matrix-trade-event-variant-ids values: ${missingTradeEventVariantIds.join(", ")}`);
    }
  }
  const weekRows: VariantWeek[] = [];
  const tradeEvents: VariantTradeEvent[] = [];
  let tradeEventRowsAvailable = 0;
  const pairQualifications: PairQualificationRow[] = [];
  const matrixWeeks: MatrixWeekMetadata[] = [];
  const matrixSourceContexts: ResearchMatrixSourceContext[] = [];
  const matrixTradeOpportunities: ResearchMatrixTradeOpportunity[] = [];
  const matrixUniverse = new Set<string>();
  const sourceContextNeeds = sourceContextNeedsForVariants(variants);
  const defaultPreloadConcurrency = Number(process.env.SIDE_SELECTOR_WEEK_PRELOAD_CONCURRENCY ?? "2");
  const weekPreloadConcurrency = parsePositiveIntegerArg(
    "week-preload-concurrency",
    Number.isInteger(defaultPreloadConcurrency) && defaultPreloadConcurrency > 0 ? defaultPreloadConcurrency : 2,
  );
  const preparedWeeks: PreparedReceiptWeek[] = [];
  let processedWeeks = 0;
  if (sourceCoverageOnly) {
    preparedWeeks.push(...await profileAsync("week_prepare_all", () => mapWithConcurrency(
      receiptPaths,
      weekPreloadConcurrency,
      (receiptPath) => prepareReceiptWeek({
        receiptPath,
        sourceContextNeeds,
        pathResolution,
        loadMarkPrices: false,
      }),
    )));
  } else {
    for (let offset = 0; offset < receiptPaths.length; offset += weekPreloadConcurrency) {
      const batchReceiptPaths = receiptPaths.slice(offset, offset + weekPreloadConcurrency);
      const preparedBatch = await profileAsync("week_prepare_batch", () => mapWithConcurrency(
        batchReceiptPaths,
        weekPreloadConcurrency,
        (receiptPath) => prepareReceiptWeek({
          receiptPath,
          sourceContextNeeds,
          pathResolution,
          loadMarkPrices: true,
        }),
      ));

      for (const prepared of preparedBatch) {
        const { receiptPath, receipt, contexts, markPrices } = prepared;
        if (!markPrices) throw new Error("Missing prepared mark prices for numeric variant evaluation.");
        const warehousePreparedWeek = { receiptPath, receipt, contexts };
        matrixWeeks.push({
          weekOpenUtc: receipt.scope.weekOpenUtc,
          executionWindowOpenUtc: receipt.scope.executionWindowOpenUtc,
          executionWindowCloseUtc: receipt.scope.executionWindowCloseUtc,
          expectedPairs: receipt.scope.expectedPairs.map((symbol) => symbol.toUpperCase()).sort(),
          tradeCount: receipt.trades.length,
          pathPoints: receipt.path.length,
        });
        for (const symbol of receipt.scope.expectedPairs) {
          matrixUniverse.add(symbol.toUpperCase());
        }
        matrixSourceContexts.push(...buildWarehouseSourceContexts([warehousePreparedWeek]));
        matrixTradeOpportunities.push(...buildWarehouseTradeOpportunities([warehousePreparedWeek]));
        for (const variant of variants) {
          const collectTradeEvents = writeMatrixWarehouse &&
            (matrixTradeEventMode === "full" ||
              (matrixTradeEventMode === "selected" && matrixTradeEventVariantIds.has(variant.id)));
          const evaluation = await profileAsync("variant_evaluation", () => evaluateVariantWeek({
            receiptPath,
            receipt,
            contexts,
            variant,
            markPrices,
            collectTradeEvents,
          }));
          weekRows.push(evaluation.week);
          tradeEventRowsAvailable += evaluation.tradeEventRowsAvailable;
          tradeEvents.push(...evaluation.tradeEvents);
          if (!skipPairQualifications) {
            pairQualifications.push(...profileSync("pair_qualification_rows", () => buildPairQualificationRows({ receipt, contexts, variant })));
          }
        }
        variantWeekBaseCache.clear();
        variantWeekPathCache.clear();
        processedWeeks += 1;
        if (processedWeeks === 1 || processedWeeks % 25 === 0 || processedWeeks === receiptPaths.length) {
          logProgress(`processedWeeks=${processedWeeks}/${receiptPaths.length}`);
        }
      }
    }
  }

  if (sourceCoverageOnly) {
    for (const prepared of preparedWeeks) {
      const { receipt, contexts } = prepared;
      for (const variant of variants) {
        pairQualifications.push(...profileSync("pair_qualification_rows", () => buildPairQualificationRows({ receipt, contexts, variant })));
      }
    }
  }

  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `fx-28pair-hedged-adr-grid-side-selectors-${receiptPaths.length}w-${stamp}`;
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const stopEventsCsvPath = path.join(outDir, `${fileStem}-stop-events.csv`);
  const pairQualificationCsvPath = path.join(outDir, `${fileStem}-pair-qualifications.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);
  if (sourceCoverageOnly) {
    const sourceCoverage = profileSync("source_coverage_summary", () => summarizeSourceCoverage(pairQualifications));
    const sourceFileStem = `fx-28pair-hedged-adr-grid-source-coverage-${receiptPaths.length}w-${stamp}`;
    const sourceJsonPath = path.join(outDir, `${sourceFileStem}.json`);
    const sourcePairQualificationCsvPath = path.join(outDir, `${sourceFileStem}-pair-qualifications.csv`);
    const sourceMdPath = path.join(outDir, `${sourceFileStem}.md`);
    const sourceProfileRows = profileRows();
    const sourceReceipt = {
      schemaVersion: 1,
      generatedAtUtc,
      scope: {
        gate: "Gate 42 research-state-cleanup-and-backtest-engine-rearchitecture",
        diagnostic: "source_coverage_only",
        receiptPaths,
        selectedWeekCount: receiptPaths.length,
        selectedVariants: variants.map((variant) => variant.id),
        pathResolution,
        weekPreloadConcurrency,
        sourceContextNeeds,
        sentimentExcluded: true,
      },
      sourceCoverage,
      pairQualifications,
      profileTimings: sourceProfileRows,
    };

    await profileAsync("output_write", async () => {
      await mkdir(outDir, { recursive: true });
      await writeFile(sourceJsonPath, `${JSON.stringify(sourceReceipt, null, 2)}\n`, "utf8");
      await writeFile(sourcePairQualificationCsvPath, `${pairQualificationsToCsv(pairQualifications)}\n`, "utf8");
      await writeFile(sourceMdPath, buildSourceCoverageMarkdown({
        generatedAtUtc,
        receiptPaths,
        summaries: sourceCoverage.summaries,
        weekRows: sourceCoverage.weekRows,
        jsonPath: sourceJsonPath,
        pairQualificationCsvPath: sourcePairQualificationCsvPath,
        pathResolution,
        profileRows: sourceProfileRows,
      }), "utf8");
    });

    console.log(`FX hedged ADR Grid source coverage audit: ${receiptPaths.length} weeks`);
    for (const summary of sourceCoverage.summaries) {
      console.log(`${summary.variantLabel}: selected ${summary.selectedRows}/${summary.pairRows} rows | missing Friday ${summary.missingFridayStrengthRows} | missing open ${summary.missingOpenStrengthRows} | missing COT ${summary.missingCotDirectionRows}`);
    }
    console.log(`JSON: ${sourceJsonPath}`);
    console.log(`Markdown: ${sourceMdPath}`);
    console.log(`Pair qualification CSV: ${sourcePairQualificationCsvPath}`);
    if (argFlag("profile")) {
      console.log("Profile timings:");
      for (const row of profileRows()) {
        console.log(`  ${row.label}: ${row.totalMs} ms / ${row.count} (${(row.totalMs / Math.max(1, row.count)).toFixed(1)} avg)`);
      }
    }
    if (!argFlag("keep-db-open")) {
      await getPool().end();
    }
    return;
  }

  const summaries = profileSync("summary_build", () => variants.map((variant) =>
    summarizeVariant(variant, weekRows.filter((row) => row.variantId === variant.id))));
  const stopEvents = weekRows.flatMap((row) => row.stopEvents);
  const profileBeforeOutputRows = profileRows();
  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: hasStopLossSweep
        ? hasGate40Sweep
          ? "Gate 40 take-profit-runner-hardening"
          : "Gate 39 adr-basket-stop-loss-hardening"
        : hasGate40Sweep
          ? "Gate 40 take-profit-runner-hardening"
          : "Gate 38 dealer-commercial-grid-agreement",
      receiptPaths,
      selectedWeekCount: receiptPaths.length,
      selectedVariants: variants.map((variant) => variant.id),
      basketStopLossThresholdsAdr: basketStopLossThresholds,
      pairInventoryStopLossThresholdsAdr: pairInventoryStopLossThresholds,
      basketTakeProfitThresholdsAdr: basketTakeProfitThresholds,
      runnerConfigs,
      pathResolution,
      weekPreloadConcurrency,
      sourceContextNeeds,
      matrixTradeEventPersistenceMode: writeMatrixWarehouse ? matrixTradeEventMode : null,
      matrixTradeEventVariantIds: writeMatrixWarehouse ? [...matrixTradeEventVariantIds].sort() : [],
      sentimentExcluded: true,
      diagnostic: hasGate40Sweep
        ? "take_profit_runner_hardening_for_source_strength_graduates"
        : hasStopLossSweep
        ? "adr_stop_loss_hardening_for_source_strength_graduates"
        : "dealer_commercial_agreement_vs_cot_faces_strength_confirmation_fade_side_selector",
      cotModes: COT_MODES.map((mode) => mode.id),
      strengthModes: STRENGTH_MODES.map((mode) => mode.id),
      strengthDefinitions: Object.fromEntries(STRENGTH_MODES.map((mode) => [mode.id, mode.note])),
      gridTerms: {
        spacingAdr: 0.2,
        tpAdr: 0.2,
        resetAdr: 1.0,
        resetEntryBufferAdr: 0.2,
        stopLoss: "none",
        costs: "excluded",
        margin: "excluded",
      },
    },
    summaries,
    weekRows,
    stopEvents,
    pairQualifications,
    profileTimings: profileBeforeOutputRows,
  };

  await profileAsync("output_write", async () => {
    await mkdir(outDir, { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    await writeFile(csvPath, `${variantWeeksToCsv(weekRows)}\n`, "utf8");
    await writeFile(stopEventsCsvPath, `${stopEventsToCsv(stopEvents)}\n`, "utf8");
    await writeFile(pairQualificationCsvPath, `${pairQualificationsToCsv(pairQualifications)}\n`, "utf8");
    await writeFile(mdPath, buildMarkdown({
      generatedAtUtc,
      receiptPaths,
      summaries,
      weekRows,
      stopEvents,
      jsonPath,
      csvPath,
      stopEventsCsvPath,
      pairQualificationCsvPath,
      pathResolution,
      profileRows: profileBeforeOutputRows,
    }), "utf8");
  });

  const matrixWarehouseResult = writeMatrixWarehouse
    ? await profileAsync("research_matrix_warehouse_write", () => writeResearchMatrixWarehouse({
        receiptPaths,
        matrixWeeks,
        universe: [...matrixUniverse].sort(),
        sourceContexts: matrixSourceContexts,
        tradeOpportunities: matrixTradeOpportunities,
        variants,
        weekRows,
        tradeEvents,
        tradeEventRowsAvailable,
        stopEvents,
        pairQualifications,
        pathResolution,
        sourceContextNeeds,
        tradeEventMode: matrixTradeEventMode,
        tradeEventVariantIds: matrixTradeEventVariantIds,
      }))
    : null;

  console.log(`FX hedged ADR Grid side-selector audit: ${receiptPaths.length} weeks`);
  for (const summary of [...summaries]
    .sort((left, right) => (right.returnOverWorstPathDd ?? -999) - (left.returnOverWorstPathDd ?? -999))
    .slice(0, 8)) {
    console.log(`${summary.variantLabel}: raw ${signed(summary.totalRawPct, 2)} | ADR ${signed(summary.totalAdr, 2)} | DD ${signed(summary.worstPathDrawdownAdr, 2)} | WC ${signed(summary.weekCloseAdr, 2)} | R/DD ${summary.returnOverWorstPathDd ?? "-"}`);
  }
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  console.log(`Stop events CSV: ${stopEventsCsvPath}`);
  if (matrixWarehouseResult) {
    console.log(`Research matrix dataset: ${matrixWarehouseResult.datasetId}`);
    console.log(`Research matrix hash: ${matrixWarehouseResult.datasetHash}`);
    console.log(`Research matrix write counts: ${JSON.stringify(matrixWarehouseResult.writeCounts)}`);
    console.log(`Research matrix persisted counts: ${JSON.stringify(matrixWarehouseResult.persistedCounts)}`);
  }
  if (argFlag("profile")) {
    console.log("Profile timings:");
    for (const row of profileRows()) {
      console.log(`  ${row.label}: ${row.totalMs} ms / ${row.count} (${(row.totalMs / Math.max(1, row.count)).toFixed(1)} avg)`);
    }
  }
  if (!argFlag("keep-db-open")) {
    await getPool().end();
  }
}

main().catch(async (error) => {
  console.error(error);
  await getPool().end().catch(() => undefined);
  process.exit(1);
});
