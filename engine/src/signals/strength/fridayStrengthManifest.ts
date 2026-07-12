import { DateTime } from "luxon";

import { PAIRS_BY_ASSET_CLASS } from "@engine/contracts/cotPairs";
import { normalizeWeekOpenUtc } from "@engine/contracts/weekAnchor";
import {
  attachResearchDecisionManifestHash,
  RESEARCH_DECISION_MANIFEST_VERSION,
  type ResearchDecisionManifest,
  type ResearchDecisionRow,
  type ResearchDecisionSide,
} from "@engine/research/decisionManifest";
import { sha256Stable } from "@engine/research/hash";
import {
  buildFxStrengthHistoryIndex,
  buildFxWeeklyStrengthContextFromIndex,
  deriveFxStrengthHistoryAtTimesFromM1,
  FX_M1_STRENGTH_DERIVATION_VERSION,
  getFxWeeklyStrengthDecisionPoints,
  INSTITUTIONAL_M1_PAIR_COVERAGE_PCT,
  type FxWeeklyPairStrengthDecision,
  type HistoricalStrengthWindow,
} from "@engine/signals/strength/historicalStrength";

export const GATE55E_PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
export const GATE56E_GATE_ID = "Gate 56E: gate55g-equivalent-manifest-parity";
export const GATE55G_DEFAULT_FROM_WEEK = "2019-01-07T00:00:00.000Z";
export const GATE55G_DEFAULT_TO_WEEK_EXCLUSIVE = "2026-06-08T00:00:00.000Z";
export const GATE55G_DEFAULT_WINDOWS: HistoricalStrengthWindow[] = ["1h", "4h", "24h", "1w", "1m"];
export const GATE55G_FEATURE_BUNDLE_ID = "gate55f_fx_m1_currency_strength_v1_friday_close_context";
export const GATE55G_SOURCE_BATCH_WEEKS = 16;

const FX_PAIRS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase()).sort();

export type Gate55GStrengthManifestSignalId = "selected" | "fade";

export type Gate55GStrengthManifestBuildOptions = {
  fromWeek?: string;
  toWeekExclusive?: string;
  windows?: HistoricalStrengthWindow[];
  cadenceMinutes?: number;
  fridayBackwardMinutes?: number;
  minPairCoveragePct?: number;
  batchWeeks?: number;
  onProgress?: (message: string) => void;
};

export type Gate55GStrengthDecision = {
  weekOpenUtc: string;
  symbol: string;
  selectedSide: ResearchDecisionSide;
  resolvedTimeUtc: string | null;
  requestedTimeUtc: string;
  compositeScore: number | null;
  availableWindows: number;
  signedSpreadSum: number | null;
  voteTie: boolean;
  exactSpreadTie: boolean;
};

export type Gate55GStrengthSourceWeekSummary = {
  weekOpenUtc: string;
  parentRows: number;
  retainedRows: number;
  removedRows: number;
  longRows: number;
  shortRows: number;
  voteTieRows: number;
  exactSpreadTieRows: number;
  minAvailableWindows: number;
  maxAvailableWindows: number;
  missingReasons: Record<string, number>;
};

export type Gate55GStrengthManifestBuild = {
  manifests: Record<Gate55GStrengthManifestSignalId, ResearchDecisionManifest>;
  source: {
    weeks: string[];
    sourceWeeks: Gate55GStrengthSourceWeekSummary[];
    decisions: Gate55GStrengthDecision[];
    snapshotTimes: number;
    snapshotRows: number;
    completeSnapshotRows: number;
    incompleteSnapshotRows: number;
    minCoveragePct: number;
    maxCoveragePct: number;
  };
};

function normalizeWeek(value: string, field: string) {
  const normalized = normalizeWeekOpenUtc(value);
  if (normalized) return normalized;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) throw new Error(`Invalid ${field}: ${value}`);
  return parsed.toUTC().toISO() ?? value;
}

function generateWeeks(fromWeek: string, toWeekExclusive: string) {
  const from = DateTime.fromISO(normalizeWeek(fromWeek, "fromWeek"), { zone: "utc" });
  const to = DateTime.fromISO(normalizeWeek(toWeekExclusive, "toWeekExclusive"), { zone: "utc" });
  if (!from.isValid || !to.isValid || to <= from) {
    throw new Error(`Invalid Gate 55G week range: from=${fromWeek} to=${toWeekExclusive}`);
  }
  const weeks: string[] = [];
  for (let cursor = from; cursor.toMillis() < to.toMillis(); cursor = cursor.plus({ weeks: 1 })) {
    const raw = cursor.toUTC().toISO() ?? cursor.toJSDate().toISOString();
    weeks.push(normalizeWeekOpenUtc(raw) ?? raw);
  }
  return [...new Set(weeks)];
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function fridaySnapshotTimes(weeks: string[], cadenceMinutes: number, backwardMinutes: number) {
  const times = new Set<string>();
  const cadence = Math.max(1, Math.floor(cadenceMinutes));
  const backward = Math.max(0, Math.floor(backwardMinutes));

  for (const weekOpenUtc of weeks) {
    const fridayPoint = getFxWeeklyStrengthDecisionPoints(weekOpenUtc)
      .find((point) => point.id === "friday_close");
    if (!fridayPoint) continue;
    const requested = DateTime.fromISO(fridayPoint.requestedTimeUtc, { zone: "utc" });
    if (!requested.isValid) continue;
    for (let offset = backward; offset >= 0; offset -= cadence) {
      times.add(requested.minus({ minutes: offset }).toUTC().toISO() ?? fridayPoint.requestedTimeUtc);
    }
    times.add(fridayPoint.requestedTimeUtc);
  }

  return [...times].sort();
}

function rowSpreadSum(row: FxWeeklyPairStrengthDecision) {
  const values = row.windows
    .map((window) => window.signedSpread)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function toStrengthDecision(row: FxWeeklyPairStrengthDecision): Gate55GStrengthDecision | null {
  if (!row.available || row.availableWindows !== row.windows.length) return null;
  if (row.direction !== "LONG" && row.direction !== "SHORT") return null;
  const signedSpreadSum = rowSpreadSum(row);
  const voteTie = row.compositeScore === 0;
  const exactSpreadTie = voteTie && signedSpreadSum !== null && Math.abs(signedSpreadSum) < 1e-12;
  return {
    weekOpenUtc: row.weekOpenUtc,
    symbol: row.pair.toUpperCase(),
    selectedSide: row.direction,
    resolvedTimeUtc: row.resolvedTimeUtc,
    requestedTimeUtc: row.requestedTimeUtc,
    compositeScore: row.compositeScore,
    availableWindows: row.availableWindows,
    signedSpreadSum,
    voteTie,
    exactSpreadTie,
  };
}

function summarizeSourceWeek(
  weekOpenUtc: string,
  rows: FxWeeklyPairStrengthDecision[],
): Gate55GStrengthSourceWeekSummary {
  const retained = rows.map(toStrengthDecision).filter((row): row is Gate55GStrengthDecision => row !== null);
  const availableWindowCounts = rows.map((row) => row.availableWindows);
  return {
    weekOpenUtc,
    parentRows: rows.length,
    retainedRows: retained.length,
    removedRows: rows.length - retained.length,
    longRows: retained.filter((row) => row.selectedSide === "LONG").length,
    shortRows: retained.filter((row) => row.selectedSide === "SHORT").length,
    voteTieRows: retained.filter((row) => row.voteTie).length,
    exactSpreadTieRows: retained.filter((row) => row.exactSpreadTie).length,
    minAvailableWindows: availableWindowCounts.length > 0 ? Math.min(...availableWindowCounts) : 0,
    maxAvailableWindows: availableWindowCounts.length > 0 ? Math.max(...availableWindowCounts) : 0,
    missingReasons: countBy(rows, (row) => row.missingReason),
  };
}

function opposite(side: ResearchDecisionSide): ResearchDecisionSide {
  return side === "LONG" ? "SHORT" : "LONG";
}

function signalSide(decision: Gate55GStrengthDecision, signalId: Gate55GStrengthManifestSignalId) {
  return signalId === "selected" ? decision.selectedSide : opposite(decision.selectedSide);
}

function buildConfigHash(options: {
  signalId: Gate55GStrengthManifestSignalId;
  fromWeek: string;
  toWeekExclusive: string;
  windows: HistoricalStrengthWindow[];
  cadenceMinutes: number;
  fridayBackwardMinutes: number;
  minPairCoveragePct: number;
}) {
  return sha256Stable({
    gate: GATE56E_GATE_ID,
    source_gate: "Gate 55G: canonical-friday-strength-selected-vs-fade-baseline",
    signal_id: options.signalId,
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    feature_bundle_id: GATE55G_FEATURE_BUNDLE_ID,
    derivation_version: FX_M1_STRENGTH_DERIVATION_VERSION,
    from_week: options.fromWeek,
    to_week_exclusive: options.toWeekExclusive,
    windows: options.windows,
    cadence_minutes: options.cadenceMinutes,
    friday_backward_minutes: options.fridayBackwardMinutes,
    min_pair_coverage_pct: options.minPairCoveragePct,
    pairs: FX_PAIRS,
  });
}

function buildRows(
  decisions: Gate55GStrengthDecision[],
  signalId: Gate55GStrengthManifestSignalId,
): ResearchDecisionRow[] {
  return decisions.map((decision) => ({
    row_id: `gate55g_${signalId}_${decision.weekOpenUtc.slice(0, 10)}_${decision.symbol}`,
    week_open_utc: decision.weekOpenUtc,
    symbol: decision.symbol,
    side: signalSide(decision, signalId),
    decision_timestamp_utc: decision.requestedTimeUtc,
    source_metadata: {
      source_gate: "Gate 55G",
      source_signal: signalId === "selected" ? "friday_strength_selected" : "friday_strength_fade",
      requested_time_utc: decision.requestedTimeUtc,
      resolved_time_utc: decision.resolvedTimeUtc,
      selected_side: decision.selectedSide,
      vote_tie: decision.voteTie,
      exact_spread_tie: decision.exactSpreadTie,
    },
    signal_scores: {
      composite_score: decision.compositeScore,
      signed_spread_sum: decision.signedSpreadSum,
      available_windows: decision.availableWindows,
    },
    bucket_id: null,
    regime_id: null,
  }));
}

function buildManifest(options: {
  signalId: Gate55GStrengthManifestSignalId;
  decisions: Gate55GStrengthDecision[];
  weeks: string[];
  fromWeek: string;
  toWeekExclusive: string;
  windows: HistoricalStrengthWindow[];
  cadenceMinutes: number;
  fridayBackwardMinutes: number;
  minPairCoveragePct: number;
}) {
  const signalLabel = options.signalId === "selected" ? "selected" : "fade";
  const manifest: ResearchDecisionManifest = {
    manifest_id: `gate56e_gate55g_friday_strength_${signalLabel}_equivalent_manifest_v1`,
    manifest_version: RESEARCH_DECISION_MANIFEST_VERSION,
    gate_id: GATE56E_GATE_ID,
    hypothesis_id: "gate55g_friday_strength_selected_vs_fade_equivalent_manifest_parity",
    signal_id: `gate55g_friday_strength_${signalLabel}`,
    signal_version: `${FX_M1_STRENGTH_DERIVATION_VERSION}_gate55g_friday_close_v1`,
    decision_scope: `fx_28pair_weekly_friday_strength_${signalLabel}`,
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    feature_bundle_id: GATE55G_FEATURE_BUNDLE_ID,
    source_context_ids: [
      "docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md",
      "docs/research/GATE55F_CANONICAL_STRENGTH_SOURCE_CONTEXT_PROOF_2026-06-25.md",
      "docs/research/GATE55G_CANONICAL_FRIDAY_STRENGTH_SELECTED_VS_FADE_BASELINE_2026-06-25.md",
    ],
    universe: {
      asset_class: "fx",
      symbols: FX_PAIRS,
    },
    week_range: {
      from_week_open_utc: options.weeks[0] ?? options.fromWeek,
      to_week_open_utc: options.weeks.at(-1) ?? options.toWeekExclusive,
    },
    source_metadata: {
      source_gate: "Gate 55G",
      source_script: "archive/app/scripts/verification/audit-gate55-friday-strength-baseline.ts",
      to_week_exclusive: options.toWeekExclusive,
      windows: options.windows,
      cadence_minutes: options.cadenceMinutes,
      friday_backward_minutes: options.fridayBackwardMinutes,
      min_pair_coverage_pct: options.minPairCoveragePct,
      direction_rule: options.signalId === "selected"
        ? "Use canonical M1-derived Friday Strength direction."
        : "Use the opposite of canonical M1-derived Friday Strength direction.",
    },
    config_hash: buildConfigHash(options),
    decisions: buildRows(options.decisions, options.signalId),
  };
  return attachResearchDecisionManifestHash(manifest);
}

export async function buildGate55GFridayStrengthManifests(
  rawOptions: Gate55GStrengthManifestBuildOptions = {},
): Promise<Gate55GStrengthManifestBuild> {
  const fromWeek = normalizeWeek(rawOptions.fromWeek ?? GATE55G_DEFAULT_FROM_WEEK, "fromWeek");
  const toWeekExclusive = normalizeWeek(
    rawOptions.toWeekExclusive ?? GATE55G_DEFAULT_TO_WEEK_EXCLUSIVE,
    "toWeekExclusive",
  );
  const windows = rawOptions.windows ?? GATE55G_DEFAULT_WINDOWS;
  const cadenceMinutes = Math.max(1, Math.floor(rawOptions.cadenceMinutes ?? 15));
  const fridayBackwardMinutes = Math.max(0, Math.floor(rawOptions.fridayBackwardMinutes ?? 60));
  const minPairCoveragePct = Math.max(
    0,
    Math.min(100, rawOptions.minPairCoveragePct ?? INSTITUTIONAL_M1_PAIR_COVERAGE_PCT),
  );
  const batchWeeks = Math.max(1, Math.floor(rawOptions.batchWeeks ?? 16));
  const weeks = generateWeeks(fromWeek, toWeekExclusive);
  const decisions: Gate55GStrengthDecision[] = [];
  const sourceWeeks: Gate55GStrengthSourceWeekSummary[] = [];
  let snapshotTimes = 0;
  let snapshotRows = 0;
  let completeSnapshotRows = 0;
  let incompleteSnapshotRows = 0;
  let minCoveragePct = Number.POSITIVE_INFINITY;
  let maxCoveragePct = Number.NEGATIVE_INFINITY;

  const batches = chunkArray(weeks, batchWeeks);
  for (const [batchIndex, batch] of batches.entries()) {
    const startedAt = Date.now();
    const batchStartIndex = batchIndex * batchWeeks;
    const batchEndIndex = batchStartIndex + batch.length;
    const sourceBatchStartIndex =
      Math.floor(batchStartIndex / GATE55G_SOURCE_BATCH_WEEKS) * GATE55G_SOURCE_BATCH_WEEKS;
    const sourceLookupWeeks = weeks.slice(sourceBatchStartIndex, batchEndIndex);
    const carryInWeeks = Math.max(0, batchStartIndex - sourceBatchStartIndex);
    const times = fridaySnapshotTimes(sourceLookupWeeks, cadenceMinutes, fridayBackwardMinutes);
    const derived = await deriveFxStrengthHistoryAtTimesFromM1({
      snapshotTimesUtc: times,
      windows,
      minPairCoveragePct,
    });
    const index = buildFxStrengthHistoryIndex(derived.snapshots);
    snapshotTimes += derived.summary.snapshotsGenerated;
    snapshotRows += derived.summary.rowsGenerated;
    completeSnapshotRows += derived.summary.completeRows;
    incompleteSnapshotRows += derived.summary.incompleteRows;
    minCoveragePct = Math.min(minCoveragePct, derived.summary.minCoveragePct);
    maxCoveragePct = Math.max(maxCoveragePct, derived.summary.maxCoveragePct);

    for (const weekOpenUtc of batch) {
      const context = buildFxWeeklyStrengthContextFromIndex({
        weekOpenUtc,
        index,
        pairs: FX_PAIRS,
        windows,
      });
      const fridayRows = context.rows.filter((row) => row.pointId === "friday_close");
      sourceWeeks.push(summarizeSourceWeek(weekOpenUtc, fridayRows));
      for (const row of fridayRows) {
        const decision = toStrengthDecision(row);
        if (decision) decisions.push(decision);
      }
    }

    rawOptions.onProgress?.(
      [
        `manifestBatch=${batchIndex + 1}/${batches.length}`,
        `weeks=${batch[0]?.slice(0, 10)}..${batch.at(-1)?.slice(0, 10)}`,
        `sourcePrefixWeeks=${carryInWeeks}`,
        `snapshotTimes=${derived.summary.snapshotsGenerated}`,
        `rows=${derived.summary.rowsGenerated}`,
        `completeRows=${derived.summary.completeRows}`,
        `elapsed=${((Date.now() - startedAt) / 1000).toFixed(2)}s`,
      ].join(" | "),
    );
  }

  const manifestOptions = {
    decisions,
    weeks,
    fromWeek,
    toWeekExclusive,
    windows,
    cadenceMinutes,
    fridayBackwardMinutes,
    minPairCoveragePct,
  };

  return {
    manifests: {
      selected: buildManifest({ ...manifestOptions, signalId: "selected" }),
      fade: buildManifest({ ...manifestOptions, signalId: "fade" }),
    },
    source: {
      weeks,
      sourceWeeks,
      decisions,
      snapshotTimes,
      snapshotRows,
      completeSnapshotRows,
      incompleteSnapshotRows,
      minCoveragePct: Number.isFinite(minCoveragePct) ? minCoveragePct : 0,
      maxCoveragePct: Number.isFinite(maxCoveragePct) ? maxCoveragePct : 0,
    },
  };
}
