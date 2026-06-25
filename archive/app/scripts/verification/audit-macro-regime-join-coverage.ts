import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { PAIRS_BY_ASSET_CLASS } from "../../src/lib/cotPairs";
import { getPool, query } from "../../src/lib/db";
import { ensureMacroRegimeWarehouseSchema } from "../../src/lib/research/macroRegimeDataset";

loadEnvConfig(process.cwd());

const GATE44_MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const GATE44_MATRIX_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
const CANONICAL_MACRO_SOURCE_FAMILIES = ["bpr", "rate", "inflation", "real_rate_pressure", "valuation"];
const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const GATE50_APPROVED_ROOT_PROMOTION_MANIFEST_ID =
  "6656b5da3d5552811b3f0f7c10b14d4af1dfbe191fb508231967a9e54d98414c";
const GATE50_APPROVED_ROOT_PROMOTION_MANIFEST_HASH =
  "12a22849ff794ce62ca6d618461a74f21e8967f518b82834aaebbc66ff172275";
const GATE50_PARENT_PROMOTION_PROOF_RECEIPT_HASH =
  "0e625be7126c90ce7748847b9ebdf6872ffbeb099caafa7e69348fe482f8409c";
const GATE50_RRP_SOURCE_CONTENT_JOIN_MAP_HASH =
  "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";

const FEATURE_BUNDLES = {
  bpr_attribution_v1: {
    featureBundleManifestId: "bpr_attribution_v1",
    requiredDependencySet: ["bpr"],
    optionalFamilies: [],
  },
  rate_attribution_v1: {
    featureBundleManifestId: "rate_attribution_v1",
    requiredDependencySet: ["rate"],
    optionalFamilies: [],
  },
  inflation_attribution_v1: {
    featureBundleManifestId: "inflation_attribution_v1",
    requiredDependencySet: ["inflation"],
    optionalFamilies: [],
  },
  real_rate_pressure_attribution_v1: {
    featureBundleManifestId: "real_rate_pressure_attribution_v1",
    requiredDependencySet: ["real_rate_pressure"],
    optionalFamilies: [],
  },
  full_macro_regime_v1: {
    featureBundleManifestId: "full_macro_regime_v1",
    requiredDependencySet: ["bpr", "rate", "inflation", "real_rate_pressure"],
    optionalFamilies: ["valuation"],
  },
} as const;

type FeatureBundleId = keyof typeof FEATURE_BUNDLES;
type FeatureBundleDefinition = (typeof FEATURE_BUNDLES)[FeatureBundleId];

type JsonRecord = Record<string, unknown>;

type MatrixDatasetRow = {
  dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  asset_class: string;
  from_utc: string;
  to_utc: string;
  universe: unknown;
  source_versions: unknown;
  execution_versions: unknown;
  coverage: unknown;
  status: string;
};

type MatrixContextRow = {
  week_open_utc: string;
  symbol: string;
};

type MacroDatasetRow = {
  regime_dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  asset_class: string;
  from_week_open_utc: string;
  to_week_open_utc: string;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  snapshot_state: string;
  reconstruction_mode: string | null;
  calendar_version: string | null;
  selector_version: string | null;
  validation_contract_version: string | null;
  build_version: string | null;
  coverage: unknown;
  source_versions: unknown;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type MacroManifestRow = {
  promotion_manifest_id: string;
  feature_bundle_manifest_id: string | null;
  activation_scope: string | null;
  contract_manifest_hash: string;
  approved_root_promotion_manifest_id: string | null;
  approved_root_promotion_manifest_hash: string | null;
  parent_promotion_proof_receipt_hash: string | null;
  macro_week_id: string;
  freeze_version: string;
  snapshot_id: string;
  snapshot_hash: string;
  snapshot_state: string;
  sealed_at_utc: string;
  settlement_deadline_utc: string | null;
  settlement_completed_at_utc: string | null;
  verified_at_utc: string | null;
  activated_at_utc: string | null;
  effective_from_utc: string | null;
  effective_to_utc: string | null;
  revoked_at_utc: string | null;
  revocation_reason: string | null;
  supersedes_snapshot_id: string | null;
  superseded_by_snapshot_id: string | null;
  row_snapshot_count: number;
  coverage: unknown;
  flags: unknown;
};

type MacroSnapshotRow = {
  week_open_utc: string;
  snapshot_id: string | null;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  macro_week_id: string | null;
  freeze_version: string | null;
  snapshot_hash: string | null;
  snapshot_state: string;
  sealed_at_utc: string | null;
  source_family: string;
  source_id: string;
  currency: string;
  instrument: string;
  source_observation_date: string | null;
  effective_at_utc: string | null;
  available_at_utc: string | null;
  coverage: unknown;
  flags: unknown;
};

type CliOptions = {
  matrixDatasetId: string;
  matrixDatasetHash: string;
  expectedWeeks: number;
  expectedPairs: number;
  macroRegimeDatasetId: string | null;
  macroDatasetHash: string | null;
  promotionManifestId: string | null;
  contractManifestHash: string | null;
  freezeVersion: string | null;
  allowedSnapshotStates: string[];
  featureBundleId: FeatureBundleId;
  featureBundle: FeatureBundleDefinition;
  activationScope: string | null;
  approvedRootPromotionManifestId: string | null;
  approvedRootPromotionManifestHash: string | null;
  parentPromotionProofReceiptHash: string | null;
  requiredSourceFamilies: string[];
  outDir: string;
  jsonOut: string | null;
  mdOut: string | null;
  sampleLimit: number;
  allowFail: boolean;
};

type MacroDatasetSelection = {
  dataset: MacroDatasetRow | null;
  candidates: MacroDatasetRow[];
  selectionMode: string;
  blockers: string[];
  queryError: string | null;
};

type WeekManifestAudit = {
  weekOpenUtc: string;
  macroWeekId: string;
  candidateManifests: number;
  allowedStateManifests: number;
  selectedSnapshotId: string | null;
  selectedSnapshotState: string | null;
  featureBundleManifestId: string | null;
  activationScope: string | null;
  approvedRootPromotionManifestId: string | null;
  approvedRootPromotionManifestHash: string | null;
  parentPromotionProofReceiptHash: string | null;
  rowSnapshotCountExpected: number | null;
  rowSnapshotCountObserved: number;
  effectiveFromUtc: string | null;
  activatedAtUtc: string | null;
  blockers: string[];
};

type PairJoinAudit = {
  weekOpenUtc: string;
  symbol: string;
  base: string;
  quote: string;
  joinable: boolean;
  blockers: string[];
  missingSnapshotKeys: string[];
};

const FX_PAIRS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase());
const FX_PAIR_DEFINITIONS = PAIRS_BY_ASSET_CLASS.fx.map((row) => ({
  pair: row.pair.toUpperCase(),
  base: row.base.toUpperCase(),
  quote: row.quote.toUpperCase(),
}));
const PAIR_BY_SYMBOL = new Map(FX_PAIR_DEFINITIONS.map((row) => [row.pair, row]));

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function parseIntArg(name: string, fallback: number) {
  const raw = argValue(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid --${name} value: ${raw}`);
  }
  return parsed;
}

function parseCsvArg(name: string, fallback: string[]) {
  const raw = argValue(name);
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseFeatureBundle() {
  const raw = argValue("feature-bundle-id");
  if (!raw) {
    throw new Error(`--feature-bundle-id is required. Expected one of: ${Object.keys(FEATURE_BUNDLES).join(", ")}`);
  }
  if (!Object.prototype.hasOwnProperty.call(FEATURE_BUNDLES, raw)) {
    throw new Error(`Invalid --feature-bundle-id value: ${raw}. Expected one of: ${Object.keys(FEATURE_BUNDLES).join(", ")}`);
  }
  const featureBundleId = raw as FeatureBundleId;
  return {
    featureBundleId,
    featureBundle: FEATURE_BUNDLES[featureBundleId],
  };
}

function parseCli(): CliOptions {
  const outDir = argValue("out-dir") ?? DEFAULT_OUT_DIR;
  const { featureBundleId, featureBundle } = parseFeatureBundle();
  const requiredSourceFamilies = parseCsvArg("required-source-families", [...featureBundle.requiredDependencySet]);
  return {
    matrixDatasetId: argValue("matrix-dataset-id") ?? GATE44_MATRIX_DATASET_ID,
    matrixDatasetHash: argValue("matrix-dataset-hash") ?? GATE44_MATRIX_DATASET_HASH,
    expectedWeeks: parseIntArg("expected-weeks", 372),
    expectedPairs: parseIntArg("expected-pairs", 28),
    macroRegimeDatasetId: argValue("macro-regime-dataset-id"),
    macroDatasetHash: argValue("macro-dataset-hash"),
    promotionManifestId: argValue("promotion-manifest-id"),
    contractManifestHash: argValue("contract-manifest-hash"),
    freezeVersion: argValue("freeze-version"),
    allowedSnapshotStates: parseCsvArg("allowed-snapshot-states", ["ACTIVE"]).map((value) => value.toUpperCase()),
    featureBundleId,
    featureBundle,
    activationScope: argValue("activation-scope")
      ?? (parseCsvArg("allowed-snapshot-states", ["ACTIVE"]).map((value) => value.toUpperCase()).includes("ACTIVE")
        ? "historical_backtest"
        : null),
    approvedRootPromotionManifestId: argValue("approved-root-promotion-manifest-id")
      ?? GATE50_APPROVED_ROOT_PROMOTION_MANIFEST_ID,
    approvedRootPromotionManifestHash: argValue("approved-root-promotion-manifest-hash")
      ?? GATE50_APPROVED_ROOT_PROMOTION_MANIFEST_HASH,
    parentPromotionProofReceiptHash: argValue("parent-promotion-proof-receipt-hash")
      ?? GATE50_PARENT_PROMOTION_PROOF_RECEIPT_HASH,
    requiredSourceFamilies,
    outDir,
    jsonOut: argValue("json-out"),
    mdOut: argValue("md-out"),
    sampleLimit: parseIntArg("sample-limit", 40),
    allowFail: hasFlag("allow-fail"),
  };
}

function isoUtc(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return "";
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (parsed.isValid) return parsed.toUTC().toISO({ suppressMilliseconds: false }) ?? value;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? value : fallback.toISOString();
}

function macroWeekIdFor(weekOpenUtc: string) {
  return `macro_week_${isoUtc(weekOpenUtc).slice(0, 10)}`;
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, inner]) => [key, stableJson(inner)]),
    );
  }
  return value;
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

function snapshotKey(row: Pick<MacroSnapshotRow, "source_family" | "source_id" | "instrument">) {
  return `${row.source_family}|${row.source_id}|${row.instrument}`;
}

function formatSnapshotKeyForCurrency(currency: string, key: string) {
  return `${currency}|${key}`;
}

function increment(counts: Record<string, number>, key: string, by = 1) {
  counts[key] = (counts[key] ?? 0) + by;
}

function snapshotValueAvailable(row: MacroSnapshotRow) {
  return asRecord(row.coverage).valueAvailable === true;
}

function snapshotIsStale(row: MacroSnapshotRow) {
  return asRecord(row.coverage).isStale === true;
}

function stringArrayFromUnknown(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function availabilityEventIdsForSnapshot(row: MacroSnapshotRow) {
  const coverage = asRecord(row.coverage);
  const flags = asRecord(row.flags);
  return [
    ...stringArrayFromUnknown(coverage.availabilityEventId),
    ...stringArrayFromUnknown(coverage.availabilityEventIds),
    ...stringArrayFromUnknown(coverage.selectedAvailabilityEventId),
    ...stringArrayFromUnknown(coverage.selectedAvailabilityEventIds),
    ...stringArrayFromUnknown(coverage.parentAvailabilityEventIds),
    ...stringArrayFromUnknown(flags.availabilityEventId),
    ...stringArrayFromUnknown(flags.availabilityEventIds),
  ].sort();
}

function rrpLineageBlockers(row: MacroSnapshotRow) {
  if (row.source_family !== "real_rate_pressure") return [];
  const coverage = asRecord(row.coverage);
  const blockers = [
    coverage.strictParentLineage !== true ? "rrp_not_strict_parent_lineage" : null,
    coverage.parentSnapshotsSealed !== true ? "rrp_parent_snapshots_not_sealed" : null,
    coverage.parentWeeklySelectionIdentityComplete !== true ? "rrp_parent_weekly_selection_identity_incomplete" : null,
    coverage.parentSnapshotLineageComplete !== true ? "rrp_parent_snapshot_lineage_incomplete" : null,
    coverage.parentObservationLineageComplete !== true ? "rrp_parent_observation_lineage_incomplete" : null,
    coverage.parentAvailabilityLineageComplete !== true ? "rrp_parent_availability_lineage_incomplete" : null,
    coverage.parentArtifactLineageComplete !== true ? "rrp_parent_artifact_lineage_incomplete" : null,
    typeof coverage.rateParentDatasetId !== "string" ? "rrp_missing_rate_parent_dataset_id" : null,
    typeof coverage.rateParentDatasetHash !== "string" ? "rrp_missing_rate_parent_dataset_hash" : null,
    typeof coverage.rateParentMacroWeekId !== "string" ? "rrp_missing_rate_parent_macro_week_id" : null,
    typeof coverage.rateParentSnapshotId !== "string" ? "rrp_missing_rate_parent_snapshot_id" : null,
    typeof coverage.rateParentSnapshotHash !== "string" ? "rrp_missing_rate_parent_snapshot_hash" : null,
    typeof coverage.rateParentFreezeVersion !== "string" ? "rrp_missing_rate_parent_freeze_version" : null,
    typeof coverage.rateParentFreezeTargetUtc !== "string" ? "rrp_missing_rate_parent_freeze_target" : null,
    typeof coverage.rateParentCalendarVersion !== "string" ? "rrp_missing_rate_parent_calendar_version" : null,
    typeof coverage.rateParentSelectorVersion !== "string" ? "rrp_missing_rate_parent_selector_version" : null,
    typeof coverage.cpiParentDatasetId !== "string" ? "rrp_missing_cpi_parent_dataset_id" : null,
    typeof coverage.cpiParentDatasetHash !== "string" ? "rrp_missing_cpi_parent_dataset_hash" : null,
    typeof coverage.cpiParentMacroWeekId !== "string" ? "rrp_missing_cpi_parent_macro_week_id" : null,
    typeof coverage.cpiParentSnapshotId !== "string" ? "rrp_missing_cpi_parent_snapshot_id" : null,
    typeof coverage.cpiParentSnapshotHash !== "string" ? "rrp_missing_cpi_parent_snapshot_hash" : null,
    typeof coverage.cpiParentFreezeVersion !== "string" ? "rrp_missing_cpi_parent_freeze_version" : null,
    typeof coverage.cpiParentFreezeTargetUtc !== "string" ? "rrp_missing_cpi_parent_freeze_target" : null,
    typeof coverage.cpiParentCalendarVersion !== "string" ? "rrp_missing_cpi_parent_calendar_version" : null,
    typeof coverage.cpiParentSelectorVersion !== "string" ? "rrp_missing_cpi_parent_selector_version" : null,
    typeof coverage.sharedMacroWeekId !== "string" ? "rrp_missing_shared_macro_week_id" : null,
    typeof coverage.sharedFreezeTargetUtc !== "string" ? "rrp_missing_shared_freeze_target" : null,
    typeof coverage.sharedCalendarVersion !== "string" ? "rrp_missing_shared_calendar_version" : null,
    typeof coverage.sharedSelectorVersion !== "string" ? "rrp_missing_shared_selector_version" : null,
    coverage.rateParentMacroWeekId !== coverage.sharedMacroWeekId ? "rrp_rate_parent_macro_week_mismatch" : null,
    coverage.cpiParentMacroWeekId !== coverage.sharedMacroWeekId ? "rrp_cpi_parent_macro_week_mismatch" : null,
    coverage.rateParentFreezeTargetUtc !== coverage.sharedFreezeTargetUtc ? "rrp_rate_parent_freeze_target_mismatch" : null,
    coverage.cpiParentFreezeTargetUtc !== coverage.sharedFreezeTargetUtc ? "rrp_cpi_parent_freeze_target_mismatch" : null,
    typeof coverage.rateFamilyManifestHash !== "string" ? "rrp_missing_rate_family_manifest_hash" : null,
    typeof coverage.cpiFamilyManifestHash !== "string" ? "rrp_missing_cpi_family_manifest_hash" : null,
    typeof coverage.currentParentObservationId !== "string" ? "rrp_missing_current_cpi_parent_observation_id" : null,
    typeof coverage.lagParentObservationId !== "string" ? "rrp_missing_lag_cpi_parent_observation_id" : null,
    stringArrayFromUnknown(coverage.parentRawObservationIds).length < 3 ? "rrp_missing_parent_observation_ids" : null,
    stringArrayFromUnknown(coverage.parentAvailabilityEventIds).length < 3 ? "rrp_missing_parent_availability_event_ids" : null,
    stringArrayFromUnknown(coverage.parentRawArtifactIds).length < 2 ? "rrp_missing_parent_artifact_ids" : null,
    coverage.formulaVersion !== "real_rate_pressure_3m_rate_minus_cpi_yoy_v1" ? "rrp_formula_version_mismatch" : null,
    typeof coverage.currencyBundleHash !== "string" ? "rrp_missing_currency_bundle_hash" : null,
    coverage.currencyBundleStatus !== "COMPLETE_SEALED_DIAGNOSTIC" ? "rrp_currency_bundle_not_complete" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));
  return blockers;
}

function sourceLineageHashes(sourceVersions: unknown) {
  const root = asRecord(sourceVersions);
  const sourceRegistry = root.sourceRegistry ?? null;
  const registry = asRecord(sourceRegistry);
  return {
    sourceVersionsHash: hashPayload(sourceVersions ?? null),
    sourceRegistryHash: hashPayload(sourceRegistry ?? null),
    sourceMapHash: hashPayload(registry.entries ?? null),
    availabilityRulesHash: hashPayload({
      endpointAvailabilityDimensions: root.endpointAvailabilityDimensions ?? null,
      weeklySignalFreeze: root.weeklySignalFreeze ?? null,
    }),
    stalenessRulesHash: hashPayload({
      bpr: asRecord(root.bpr).maxStaleDays ?? null,
      rates: asRecord(root.rates).sources ?? null,
      inflation: asRecord(root.inflation).sources ?? null,
      valuation: asRecord(root.valuation).sources ?? null,
      realRatePressure: root.realRatePressure ?? null,
    }),
    exceptionCalendarHash: hashPayload({
      bpr: root.bpr ?? null,
      weeklySignalFreeze: root.weeklySignalFreeze ?? null,
    }),
    calendarHash: hashPayload({
      weeklySignalFreeze: root.weeklySignalFreeze ?? null,
      fourClockModel: root.fourClockModel ?? null,
    }),
    selectorVersion: asRecord(root.weeklySignalFreeze).selectorVersion ?? null,
  };
}

async function readMatrixDataset(options: CliOptions) {
  const rows = await query<MatrixDatasetRow>(
    `
      SELECT
        dataset_id::text,
        dataset_hash,
        dataset_version,
        asset_class,
        from_utc::text,
        to_utc::text,
        universe,
        source_versions,
        execution_versions,
        coverage,
        status
      FROM research_matrix_datasets
      WHERE dataset_id = $1::uuid
    `,
    [options.matrixDatasetId],
  );
  return rows[0] ?? null;
}

async function readMatrixContexts(datasetId: string) {
  return query<MatrixContextRow>(
    `
      SELECT week_open_utc::text, UPPER(symbol) AS symbol
      FROM research_matrix_source_contexts
      WHERE dataset_id = $1::uuid
      ORDER BY week_open_utc, symbol
    `,
    [datasetId],
  );
}

async function selectMacroDataset(options: CliOptions): Promise<MacroDatasetSelection> {
  const clauses: string[] = [];
  const params: string[] = [];
  const blockers: string[] = [];
  let selectionMode = "latest_unpinned";

  if (options.macroRegimeDatasetId) {
    params.push(options.macroRegimeDatasetId);
    clauses.push(`regime_dataset_id = $${params.length}::uuid`);
    selectionMode = "pinned_regime_dataset_id";
  }
  if (options.macroDatasetHash) {
    params.push(options.macroDatasetHash);
    clauses.push(`dataset_hash = $${params.length}`);
    selectionMode = selectionMode === "latest_unpinned" ? "pinned_dataset_hash" : `${selectionMode}+dataset_hash`;
  }
  if (options.promotionManifestId) {
    params.push(options.promotionManifestId);
    clauses.push(`promotion_manifest_id = $${params.length}`);
    selectionMode = selectionMode === "latest_unpinned" ? "pinned_promotion_manifest_id" : `${selectionMode}+promotion_manifest_id`;
  }
  if (options.contractManifestHash) {
    params.push(options.contractManifestHash);
    clauses.push(`contract_manifest_hash = $${params.length}`);
    selectionMode = selectionMode === "latest_unpinned" ? "pinned_contract_manifest_hash" : `${selectionMode}+contract_manifest_hash`;
  }

  if (selectionMode === "latest_unpinned") {
    blockers.push("macro_dataset_not_pinned");
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  try {
    const candidates = await query<MacroDatasetRow>(
      `
        SELECT
          regime_dataset_id::text,
          dataset_hash,
          dataset_version,
          asset_class,
          from_week_open_utc::text,
          to_week_open_utc::text,
          promotion_manifest_id,
          contract_manifest_hash,
          snapshot_state,
          reconstruction_mode,
          calendar_version,
          selector_version,
          validation_contract_version,
          build_version,
          coverage,
          source_versions,
          status,
          created_at::text,
          completed_at::text
        FROM research_macro_regime_datasets
        ${whereSql}
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 10
      `,
      params,
    );
    if (candidates.length === 0) blockers.push("macro_dataset_not_found");
    if (
      candidates.length > 1
      && !options.macroRegimeDatasetId
      && !options.macroDatasetHash
    ) {
      blockers.push("macro_dataset_selection_not_unique_without_dataset_id_or_hash");
    }
    return {
      dataset: candidates[0] ?? null,
      candidates,
      selectionMode,
      blockers,
      queryError: null,
    };
  } catch (error) {
    return {
      dataset: null,
      candidates: [],
      selectionMode,
      blockers: [...blockers, "macro_dataset_query_failed"],
      queryError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readMacroManifests(options: {
  regimeDatasetId: string;
  macroWeekIds: string[];
}) {
  return query<MacroManifestRow>(
    `
      SELECT
        promotion_manifest_id,
        feature_bundle_manifest_id,
        activation_scope,
        contract_manifest_hash,
        approved_root_promotion_manifest_id,
        approved_root_promotion_manifest_hash,
        parent_promotion_proof_receipt_hash,
        macro_week_id,
        freeze_version,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        sealed_at_utc::text,
        settlement_deadline_utc::text,
        settlement_completed_at_utc::text,
        verified_at_utc::text,
        activated_at_utc::text,
        effective_from_utc::text,
        effective_to_utc::text,
        revoked_at_utc::text,
        revocation_reason,
        supersedes_snapshot_id,
        superseded_by_snapshot_id,
        row_snapshot_count::int,
        coverage,
        flags
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
        AND macro_week_id = ANY($2::text[])
      ORDER BY macro_week_id, promotion_manifest_id, freeze_version, snapshot_state, snapshot_id
    `,
    [options.regimeDatasetId, options.macroWeekIds],
  );
}

async function readMacroSnapshots(options: {
  regimeDatasetId: string;
  weekOpenUtcs: string[];
}) {
  return query<MacroSnapshotRow>(
    `
      SELECT
        week_open_utc::text,
        snapshot_id,
        promotion_manifest_id,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        snapshot_hash,
        snapshot_state,
        sealed_at_utc::text,
        source_family,
        source_id,
        currency,
        instrument,
        source_observation_date::text,
        effective_at_utc::text,
        available_at_utc::text,
        coverage,
        flags
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND week_open_utc = ANY($2::timestamptz[])
      ORDER BY week_open_utc, currency, source_family, source_id, instrument
    `,
    [options.regimeDatasetId, options.weekOpenUtcs],
  );
}

function filterManifests(rows: MacroManifestRow[], options: CliOptions) {
  return rows.filter((row) =>
    (!options.promotionManifestId || row.promotion_manifest_id === options.promotionManifestId)
    && (!options.contractManifestHash || row.contract_manifest_hash === options.contractManifestHash)
    && (!options.freezeVersion || row.freeze_version === options.freezeVersion)
    && row.feature_bundle_manifest_id === options.featureBundle.featureBundleManifestId
    && (!options.activationScope || row.activation_scope === options.activationScope)
    && (!options.approvedRootPromotionManifestId
      || row.approved_root_promotion_manifest_id === options.approvedRootPromotionManifestId)
    && (!options.approvedRootPromotionManifestHash
      || row.approved_root_promotion_manifest_hash === options.approvedRootPromotionManifestHash)
    && (!options.parentPromotionProofReceiptHash
      || row.parent_promotion_proof_receipt_hash === options.parentPromotionProofReceiptHash));
}

function filterSnapshots(rows: MacroSnapshotRow[], options: CliOptions) {
  return rows.filter((row) =>
    (!options.promotionManifestId || row.promotion_manifest_id === options.promotionManifestId)
    && (!options.contractManifestHash || row.contract_manifest_hash === options.contractManifestHash)
    && (!options.freezeVersion || row.freeze_version === options.freezeVersion));
}

function addExpectedKey(result: Map<string, Set<string>>, currency: string, key: string) {
  const normalizedCurrency = currency.toUpperCase();
  const keys = result.get(normalizedCurrency) ?? new Set<string>();
  keys.add(key);
  result.set(normalizedCurrency, keys);
}

function buildRealRatePressureExpectedSourceKeysByCurrency(snapshots: MacroSnapshotRow[]) {
  const result = new Map<string, Set<string>>();
  const byCurrencyAndSourceId = new Map<string, MacroSnapshotRow[]>();

  for (const row of snapshots) {
    const key = `${row.currency.toUpperCase()}|${row.source_id}`;
    const rows = byCurrencyAndSourceId.get(key) ?? [];
    rows.push(row);
    byCurrencyAndSourceId.set(key, rows);
  }

  for (const row of snapshots) {
    if (row.source_family !== "real_rate_pressure") continue;
    const currency = row.currency.toUpperCase();
    addExpectedKey(result, currency, snapshotKey(row));
    const parentSourceIds = stringArrayFromUnknown(asRecord(row.coverage).parentSourceIds);
    for (const parentSourceId of parentSourceIds) {
      for (const parent of byCurrencyAndSourceId.get(`${currency}|${parentSourceId}`) ?? []) {
        addExpectedKey(result, currency, snapshotKey(parent));
      }
    }
  }

  return result;
}

function buildExpectedSourceKeysByCurrency(snapshots: MacroSnapshotRow[], cli: CliOptions) {
  if (cli.featureBundleId === "real_rate_pressure_attribution_v1") {
    return buildRealRatePressureExpectedSourceKeysByCurrency(snapshots);
  }

  const requiredFamilies = new Set(cli.requiredSourceFamilies);
  const result = new Map<string, Set<string>>();
  for (const row of snapshots) {
    if (!requiredFamilies.has(row.source_family)) continue;
    addExpectedKey(result, row.currency, snapshotKey(row));
  }
  return result;
}

function auditWeekManifests(options: {
  weekOpenUtcs: string[];
  manifests: MacroManifestRow[];
  snapshots: MacroSnapshotRow[];
  cli: CliOptions;
}) {
  const manifestsByWeek = new Map<string, MacroManifestRow[]>();
  for (const manifest of options.manifests) {
    const rows = manifestsByWeek.get(manifest.macro_week_id) ?? [];
    rows.push(manifest);
    manifestsByWeek.set(manifest.macro_week_id, rows);
  }

  const snapshotRowsByWeek = new Map<string, MacroSnapshotRow[]>();
  for (const snapshot of options.snapshots) {
    const week = isoUtc(snapshot.week_open_utc);
    const rows = snapshotRowsByWeek.get(week) ?? [];
    rows.push(snapshot);
    snapshotRowsByWeek.set(week, rows);
  }

  const audits: WeekManifestAudit[] = [];
  for (const weekOpenUtc of options.weekOpenUtcs) {
    const macroWeekId = macroWeekIdFor(weekOpenUtc);
    const candidates = manifestsByWeek.get(macroWeekId) ?? [];
    const allowed = candidates.filter((row) => options.cli.allowedSnapshotStates.includes(row.snapshot_state.toUpperCase()));
    const selected = allowed.length === 1 ? allowed[0] : null;
    const snapshotRows = snapshotRowsByWeek.get(weekOpenUtc) ?? [];
    const blockers = [
      ...(candidates.length === 0 ? ["missing_weekly_snapshot_manifest"] : []),
      ...(allowed.length === 0 && candidates.length > 0 ? ["no_manifest_in_allowed_state"] : []),
      ...(allowed.length > 1 ? ["multiple_allowed_state_manifests_for_week"] : []),
      ...(selected && options.cli.allowedSnapshotStates.includes("ACTIVE") && selected.effective_from_utc === null
        ? ["active_manifest_missing_effective_from_utc"]
        : []),
      ...(selected
        && options.cli.allowedSnapshotStates.includes("ACTIVE")
        && selected.effective_from_utc !== null
        && isoUtc(selected.effective_from_utc) !== weekOpenUtc
        ? ["active_manifest_effective_from_not_exact_week_open"]
        : []),
      ...(selected && options.cli.allowedSnapshotStates.includes("ACTIVE") && selected.activated_at_utc === null
        ? ["active_manifest_missing_activated_at_utc"]
        : []),
      ...(selected && selected.revoked_at_utc !== null ? ["selected_manifest_revoked"] : []),
      ...(selected && selected.feature_bundle_manifest_id !== options.cli.featureBundle.featureBundleManifestId
        ? ["selected_manifest_feature_bundle_mismatch"]
        : []),
      ...(selected && options.cli.activationScope && selected.activation_scope !== options.cli.activationScope
        ? ["selected_manifest_activation_scope_mismatch"]
        : []),
      ...(selected && options.cli.approvedRootPromotionManifestId
        && selected.approved_root_promotion_manifest_id !== options.cli.approvedRootPromotionManifestId
        ? ["selected_manifest_approved_root_id_mismatch"]
        : []),
      ...(selected && options.cli.approvedRootPromotionManifestHash
        && selected.approved_root_promotion_manifest_hash !== options.cli.approvedRootPromotionManifestHash
        ? ["selected_manifest_approved_root_hash_mismatch"]
        : []),
      ...(selected && options.cli.parentPromotionProofReceiptHash
        && selected.parent_promotion_proof_receipt_hash !== options.cli.parentPromotionProofReceiptHash
        ? ["selected_manifest_parent_proof_receipt_hash_mismatch"]
        : []),
      ...(selected && selected.row_snapshot_count !== snapshotRows.length
        ? ["manifest_row_snapshot_count_mismatch"]
        : []),
    ];
    audits.push({
      weekOpenUtc,
      macroWeekId,
      candidateManifests: candidates.length,
      allowedStateManifests: allowed.length,
      selectedSnapshotId: selected?.snapshot_id ?? null,
      selectedSnapshotState: selected?.snapshot_state ?? null,
      featureBundleManifestId: selected?.feature_bundle_manifest_id ?? null,
      activationScope: selected?.activation_scope ?? null,
      approvedRootPromotionManifestId: selected?.approved_root_promotion_manifest_id ?? null,
      approvedRootPromotionManifestHash: selected?.approved_root_promotion_manifest_hash ?? null,
      parentPromotionProofReceiptHash: selected?.parent_promotion_proof_receipt_hash ?? null,
      rowSnapshotCountExpected: selected?.row_snapshot_count ?? null,
      rowSnapshotCountObserved: snapshotRows.length,
      effectiveFromUtc: selected?.effective_from_utc ? isoUtc(selected.effective_from_utc) : null,
      activatedAtUtc: selected?.activated_at_utc ? isoUtc(selected.activated_at_utc) : null,
      blockers,
    });
  }
  return audits;
}

function auditPairJoins(options: {
  matrixContexts: MatrixContextRow[];
  weekAudits: WeekManifestAudit[];
  snapshots: MacroSnapshotRow[];
  expectedKeysByCurrency: Map<string, Set<string>>;
  sampleLimit: number;
}) {
  const blockedWeeks = new Map(options.weekAudits.map((row) => [row.weekOpenUtc, row.blockers]));
  const snapshotByWeekCurrencyKey = new Map<string, MacroSnapshotRow>();
  for (const snapshot of options.snapshots) {
    snapshotByWeekCurrencyKey.set(
      `${isoUtc(snapshot.week_open_utc)}|${snapshot.currency.toUpperCase()}|${snapshotKey(snapshot)}`,
      snapshot,
    );
  }

  let joinablePairWeeks = 0;
  const blockerCounts: Record<string, number> = {};
  const missingSnapshotKeyCounts: Record<string, number> = {};
  const unavailableSnapshotKeyCounts: Record<string, number> = {};
  const staleSnapshotKeyCounts: Record<string, number> = {};
  const lineageIncompleteSnapshotKeyCounts: Record<string, number> = {};
  const samples: PairJoinAudit[] = [];

  for (const context of options.matrixContexts) {
    const weekOpenUtc = isoUtc(context.week_open_utc);
    const symbol = context.symbol.toUpperCase();
    const pair = PAIR_BY_SYMBOL.get(symbol);
    const blockers: string[] = [];
    const missingSnapshotKeys: string[] = [];
    if (!pair) {
      blockers.push("unknown_fx_pair_symbol");
    } else {
      const weekBlockers = blockedWeeks.get(weekOpenUtc) ?? ["week_manifest_not_audited"];
      blockers.push(...weekBlockers.map((blocker) => `week:${blocker}`));
      for (const currency of [pair.base, pair.quote]) {
        const expectedKeys = options.expectedKeysByCurrency.get(currency);
        if (!expectedKeys || expectedKeys.size === 0) {
          blockers.push(`currency:${currency}:no_expected_source_keys`);
          continue;
        }
        for (const expectedKey of expectedKeys) {
          const snapshot = snapshotByWeekCurrencyKey.get(`${weekOpenUtc}|${currency}|${expectedKey}`);
          const formattedKey = formatSnapshotKeyForCurrency(currency, expectedKey);
          if (!snapshot) {
            missingSnapshotKeys.push(formattedKey);
            increment(missingSnapshotKeyCounts, formattedKey);
            continue;
          }
          if (!snapshotValueAvailable(snapshot)) {
            blockers.push("unavailable_pair_currency_macro_snapshot_key");
            increment(unavailableSnapshotKeyCounts, formattedKey);
          }
          if (snapshotIsStale(snapshot)) {
            blockers.push("stale_pair_currency_macro_snapshot_key");
            increment(staleSnapshotKeyCounts, formattedKey);
          }
          const lineageBlockers = rrpLineageBlockers(snapshot);
          if (lineageBlockers.length > 0) {
            blockers.push("lineage_incomplete_pair_currency_macro_snapshot_key");
            increment(lineageIncompleteSnapshotKeyCounts, formattedKey);
            for (const lineageBlocker of lineageBlockers) {
              blockers.push(lineageBlocker);
            }
          }
        }
      }
    }
    if (missingSnapshotKeys.length > 0) blockers.push("missing_pair_currency_macro_snapshot_keys");
    for (const blocker of blockers) increment(blockerCounts, blocker);
    const joinable = blockers.length === 0;
    if (joinable) joinablePairWeeks += 1;
    if (!joinable && samples.length < options.sampleLimit) {
      samples.push({
        weekOpenUtc,
        symbol,
        base: pair?.base ?? "",
        quote: pair?.quote ?? "",
        joinable,
        blockers,
        missingSnapshotKeys: missingSnapshotKeys.slice(0, 20),
      });
    }
  }

  return {
    expectedPairWeeks: options.matrixContexts.length,
    joinablePairWeeks,
    blockedPairWeeks: options.matrixContexts.length - joinablePairWeeks,
    blockerCounts,
    missingSnapshotKeyCounts,
    unavailableSnapshotKeyCounts,
    staleSnapshotKeyCounts,
    lineageIncompleteSnapshotKeyCounts,
    blockedSamples: samples,
  };
}

function buildResolvedJoinMap(options: {
  matrixContexts: MatrixContextRow[];
  weekAudits: WeekManifestAudit[];
  snapshots: MacroSnapshotRow[];
  expectedKeysByCurrency: Map<string, Set<string>>;
}) {
  const manifestByWeek = new Map(options.weekAudits.map((row) => [row.weekOpenUtc, row]));
  const snapshotByWeekCurrencyKey = new Map<string, MacroSnapshotRow>();
  for (const snapshot of options.snapshots) {
    snapshotByWeekCurrencyKey.set(
      `${isoUtc(snapshot.week_open_utc)}|${snapshot.currency.toUpperCase()}|${snapshotKey(snapshot)}`,
      snapshot,
    );
  }

  const rows = options.matrixContexts.map((context) => {
    const weekOpenUtc = isoUtc(context.week_open_utc);
    const symbol = context.symbol.toUpperCase();
    const pair = PAIR_BY_SYMBOL.get(symbol);
    const macroWeekId = macroWeekIdFor(weekOpenUtc);
    const manifest = manifestByWeek.get(weekOpenUtc);
    const selectedSnapshots = pair
      ? [pair.base, pair.quote].flatMap((currency) => {
          const expectedKeys = [...(options.expectedKeysByCurrency.get(currency) ?? [])].sort();
          return expectedKeys.map((expectedKey) => {
            const snapshot = snapshotByWeekCurrencyKey.get(`${weekOpenUtc}|${currency}|${expectedKey}`) ?? null;
          return {
            currency,
            requiredSnapshotKey: expectedKey,
            snapshotId: snapshot?.snapshot_id ?? null,
            snapshotHash: snapshot?.snapshot_hash ?? null,
              sourceFamily: snapshot?.source_family ?? null,
              sourceId: snapshot?.source_id ?? null,
              instrument: snapshot?.instrument ?? null,
            snapshotState: snapshot?.snapshot_state ?? null,
            availableAtUtc: snapshot?.available_at_utc ? isoUtc(snapshot.available_at_utc) : null,
            sourceObservationDate: snapshot?.source_observation_date ?? null,
            availabilityEventIds: snapshot ? availabilityEventIdsForSnapshot(snapshot) : [],
            parentRawObservationIds: snapshot
              ? stringArrayFromUnknown(asRecord(snapshot.coverage).parentRawObservationIds)
              : [],
            parentRawArtifactIds: snapshot
              ? stringArrayFromUnknown(asRecord(snapshot.coverage).parentRawArtifactIds)
              : [],
            rateParentDatasetId: snapshot ? asRecord(snapshot.coverage).rateParentDatasetId ?? null : null,
            cpiParentDatasetId: snapshot ? asRecord(snapshot.coverage).cpiParentDatasetId ?? null : null,
            rateParentMacroWeekId: snapshot ? asRecord(snapshot.coverage).rateParentMacroWeekId ?? null : null,
            cpiParentMacroWeekId: snapshot ? asRecord(snapshot.coverage).cpiParentMacroWeekId ?? null : null,
            rateParentFreezeTargetUtc: snapshot ? asRecord(snapshot.coverage).rateParentFreezeTargetUtc ?? null : null,
            cpiParentFreezeTargetUtc: snapshot ? asRecord(snapshot.coverage).cpiParentFreezeTargetUtc ?? null : null,
            sharedMacroWeekId: snapshot ? asRecord(snapshot.coverage).sharedMacroWeekId ?? null : null,
            sharedFreezeTargetUtc: snapshot ? asRecord(snapshot.coverage).sharedFreezeTargetUtc ?? null : null,
            sharedCalendarVersion: snapshot ? asRecord(snapshot.coverage).sharedCalendarVersion ?? null : null,
            sharedSelectorVersion: snapshot ? asRecord(snapshot.coverage).sharedSelectorVersion ?? null : null,
            formulaVersion: snapshot ? asRecord(snapshot.coverage).formulaVersion ?? null : null,
            currencyBundleHash: snapshot ? asRecord(snapshot.coverage).currencyBundleHash ?? null : null,
          };
        });
      })
      : [];
    return {
      matrixPairWeekId: `${macroWeekId}|${symbol}`,
      macroWeekId,
      weekOpenUtc,
      pairId: symbol,
      base: pair?.base ?? null,
      quote: pair?.quote ?? null,
      macroWeeklyManifestId: manifest?.selectedSnapshotId ?? null,
      macroWeeklyManifestState: manifest?.selectedSnapshotState ?? null,
      featureBundleManifestId: manifest?.featureBundleManifestId ?? null,
      activationScope: manifest?.activationScope ?? null,
      approvedRootPromotionManifestId: manifest?.approvedRootPromotionManifestId ?? null,
      approvedRootPromotionManifestHash: manifest?.approvedRootPromotionManifestHash ?? null,
      parentPromotionProofReceiptHash: manifest?.parentPromotionProofReceiptHash ?? null,
      selectedSnapshots,
    };
  });
  const contentRows = rows.map((row) => ({
    matrixPairWeekId: row.matrixPairWeekId,
    macroWeekId: row.macroWeekId,
    weekOpenUtc: row.weekOpenUtc,
    pairId: row.pairId,
    base: row.base,
    quote: row.quote,
    macroWeeklyManifestId: row.macroWeeklyManifestId,
    featureBundleManifestId: row.featureBundleManifestId,
    activationScope: row.activationScope,
    approvedRootPromotionManifestId: row.approvedRootPromotionManifestId,
    approvedRootPromotionManifestHash: row.approvedRootPromotionManifestHash,
    parentPromotionProofReceiptHash: row.parentPromotionProofReceiptHash,
    selectedSnapshots: row.selectedSnapshots.map((snapshot) => ({
      currency: snapshot.currency,
      requiredSnapshotKey: snapshot.requiredSnapshotKey,
      snapshotId: snapshot.snapshotId,
      snapshotHash: snapshot.snapshotHash,
      sourceFamily: snapshot.sourceFamily,
      sourceId: snapshot.sourceId,
      instrument: snapshot.instrument,
      availableAtUtc: snapshot.availableAtUtc,
      sourceObservationDate: snapshot.sourceObservationDate,
      availabilityEventIds: snapshot.availabilityEventIds,
      parentRawObservationIds: snapshot.parentRawObservationIds,
      parentRawArtifactIds: snapshot.parentRawArtifactIds,
      rateParentDatasetId: snapshot.rateParentDatasetId,
      cpiParentDatasetId: snapshot.cpiParentDatasetId,
      rateParentMacroWeekId: snapshot.rateParentMacroWeekId,
      cpiParentMacroWeekId: snapshot.cpiParentMacroWeekId,
      rateParentFreezeTargetUtc: snapshot.rateParentFreezeTargetUtc,
      cpiParentFreezeTargetUtc: snapshot.cpiParentFreezeTargetUtc,
      sharedMacroWeekId: snapshot.sharedMacroWeekId,
      sharedFreezeTargetUtc: snapshot.sharedFreezeTargetUtc,
      sharedCalendarVersion: snapshot.sharedCalendarVersion,
      sharedSelectorVersion: snapshot.sharedSelectorVersion,
      formulaVersion: snapshot.formulaVersion,
      currencyBundleHash: snapshot.currencyBundleHash,
    })),
  }));
  return {
    rowCount: rows.length,
    resolvedJoinMapHash: hashPayload(rows),
    resolvedContentJoinMapHash: hashPayload(contentRows),
    sampleRows: rows.slice(0, 5),
  };
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const blockers = asRecord(report.promotionBlockers);
  const matrix = asRecord(report.matrix);
  const macro = asRecord(report.macro);
  const files = asRecord(report.files);
  const promotionBlockerRows = Object.entries(blockers)
    .map(([key, count]) => `| ${key} | ${count} |`);

  return [
    "# Gate 50 Macro Regime Join Coverage Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Join receipt status: ${summary.joinReceiptStatus}`,
    `- Promotion grade: ${summary.promotionGrade === true ? "PASS" : "FAIL"}`,
    `- Diagnostic only: ${summary.diagnosticOnly === true}`,
    `- Promotion eligible: ${summary.promotionEligible === true}`,
    `- Feature bundle: ${summary.featureBundleManifestId}`,
    `- Pair-week contexts expected: ${summary.expectedPairWeeks}`,
    `- Pair-week contexts joinable: ${summary.joinablePairWeeks}`,
    `- Pair-week contexts blocked: ${summary.blockedPairWeeks}`,
    `- Resolved join-map hash: ${summary.resolvedJoinMapHash}`,
    `- Resolved content join-map hash: ${summary.resolvedContentJoinMapHash}`,
    `- Source-content invariant hash: ${summary.sourceContentInvariantHash}`,
    `- Required source families: ${Array.isArray(summary.requiredSourceFamilies) ? summary.requiredSourceFamilies.join(", ") : ""}`,
    "",
    "## Matrix Control",
    "",
    `- Dataset id: ${matrix.datasetId}`,
    `- Dataset hash: ${matrix.datasetHash}`,
    `- Weeks: ${matrix.weekCount}`,
    `- Pairs: ${matrix.pairCount}`,
    `- Source context rows: ${matrix.sourceContextRows}`,
    `- Week id hash: ${matrix.weekIdHash}`,
    "",
    "## Macro Dataset",
    "",
    `- Selection mode: ${macro.selectionMode}`,
    `- Regime dataset id: ${macro.regimeDatasetId ?? "none"}`,
    `- Dataset hash: ${macro.datasetHash ?? "none"}`,
    `- Promotion manifest id: ${macro.promotionManifestId ?? "none"}`,
    `- Contract manifest hash: ${macro.contractManifestHash ?? "none"}`,
    "",
    "## Promotion Blockers",
    "",
    "| Blocker | Count |",
    "|---|---:|",
    ...(promotionBlockerRows.length > 0 ? promotionBlockerRows : ["| - | 0 |"]),
    "",
    "## Files",
    "",
    `- JSON: ${files.jsonPath}`,
    `- Markdown: ${files.mdPath}`,
    "",
    "No P&L, trade filtering, stop, TP, runner, grid-entry, or macro regime decision is computed by this receipt.",
    "",
  ].join("\n");
}

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    increment(counts, value);
    return counts;
  }, {});
}

async function main() {
  const cli = parseCli();
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for macro join coverage audit.");
  }
  await ensureMacroRegimeWarehouseSchema();

  const matrixDataset = await readMatrixDataset(cli);
  if (!matrixDataset) {
    throw new Error(`Matrix dataset not found: ${cli.matrixDatasetId}`);
  }
  const matrixContexts = (await readMatrixContexts(matrixDataset.dataset_id)).map((row) => ({
    week_open_utc: isoUtc(row.week_open_utc),
    symbol: row.symbol.toUpperCase(),
  }));
  const matrixWeeks = [...new Set(matrixContexts.map((row) => row.week_open_utc))].sort();
  const matrixPairs = [...new Set(matrixContexts.map((row) => row.symbol))].sort();
  const matrixContextKeys = new Set(matrixContexts.map((row) => `${row.week_open_utc}|${row.symbol}`));
  const missingMatrixContexts = matrixWeeks.flatMap((weekOpenUtc) =>
    FX_PAIRS
      .filter((symbol) => !matrixContextKeys.has(`${weekOpenUtc}|${symbol}`))
      .map((symbol) => `${weekOpenUtc}|${symbol}`));
  const unexpectedMatrixSymbols = matrixPairs.filter((symbol) => !PAIR_BY_SYMBOL.has(symbol));

  const macroSelection = await selectMacroDataset(cli);
  let macroManifests: MacroManifestRow[] = [];
  let macroSnapshots: MacroSnapshotRow[] = [];
  if (macroSelection.dataset) {
    const macroWeekIds = matrixWeeks.map(macroWeekIdFor);
    macroManifests = filterManifests(
      await readMacroManifests({
        regimeDatasetId: macroSelection.dataset.regime_dataset_id,
        macroWeekIds,
      }),
      cli,
    );
    macroSnapshots = filterSnapshots(
      (await readMacroSnapshots({
        regimeDatasetId: macroSelection.dataset.regime_dataset_id,
        weekOpenUtcs: matrixWeeks,
      })).map((row) => ({
        ...row,
        week_open_utc: isoUtc(row.week_open_utc),
        currency: row.currency.toUpperCase(),
      })),
      cli,
    );
  }

  const weekAudits = auditWeekManifests({
    weekOpenUtcs: matrixWeeks,
    manifests: macroManifests,
    snapshots: macroSnapshots,
    cli,
  });
  const expectedKeysByCurrency = buildExpectedSourceKeysByCurrency(macroSnapshots, cli);
  const pairJoin = auditPairJoins({
    matrixContexts,
    weekAudits,
    snapshots: macroSnapshots,
    expectedKeysByCurrency,
    sampleLimit: cli.sampleLimit,
  });
  const resolvedJoinMap = buildResolvedJoinMap({
    matrixContexts,
    weekAudits,
    snapshots: macroSnapshots,
    expectedKeysByCurrency,
  });

  const sourceFamiliesPresent = [...new Set(macroSnapshots.map((row) => row.source_family))].sort();
  const unexpectedSourceFamilies = sourceFamiliesPresent
    .filter((family) => !CANONICAL_MACRO_SOURCE_FAMILIES.includes(family));
  const missingRequiredFamilies = cli.requiredSourceFamilies
    .filter((family) => !sourceFamiliesPresent.includes(family));
  const weekBlockers = weekAudits.flatMap((row) => row.blockers);
  const promotionBlockerList = [
    ...(matrixDataset.dataset_hash !== cli.matrixDatasetHash ? ["matrix_dataset_hash_mismatch"] : []),
    ...(matrixDataset.status !== "complete" ? ["matrix_dataset_not_complete"] : []),
    ...(matrixWeeks.length !== cli.expectedWeeks ? ["matrix_week_count_mismatch"] : []),
    ...(matrixPairs.length !== cli.expectedPairs ? ["matrix_pair_count_mismatch"] : []),
    ...(matrixContexts.length !== cli.expectedWeeks * cli.expectedPairs ? ["matrix_pair_week_count_mismatch"] : []),
    ...(missingMatrixContexts.length > 0 ? ["matrix_missing_expected_pair_week_contexts"] : []),
    ...(unexpectedMatrixSymbols.length > 0 ? ["matrix_unexpected_symbols"] : []),
    ...macroSelection.blockers,
    ...(macroSelection.queryError ? ["macro_dataset_query_error"] : []),
    ...(macroSelection.dataset?.status && macroSelection.dataset.status !== "complete" ? ["macro_dataset_not_complete"] : []),
    ...(macroSelection.dataset?.promotion_manifest_id === null ? ["macro_dataset_missing_promotion_manifest_id"] : []),
    ...(macroSelection.dataset?.contract_manifest_hash === null ? ["macro_dataset_missing_contract_manifest_hash"] : []),
    ...missingRequiredFamilies.map((family) => `missing_required_source_family:${family}`),
    ...unexpectedSourceFamilies.map((family) => `unexpected_macro_source_family:${family}`),
    ...(macroManifests.length === 0 ? ["no_macro_weekly_snapshot_manifests_for_matrix_weeks"] : []),
    ...(macroSnapshots.length === 0 ? ["no_macro_weekly_currency_snapshots_for_matrix_weeks"] : []),
    ...weekBlockers,
    ...(pairJoin.joinablePairWeeks !== matrixContexts.length ? ["pair_week_join_coverage_incomplete"] : []),
  ];

  const promotionBlockers = countValues(promotionBlockerList);
  const promotionGrade = Object.keys(promotionBlockers).length === 0;
  const activeStateOnly =
    cli.allowedSnapshotStates.length === 1 && cli.allowedSnapshotStates[0] === "ACTIVE";
  const diagnosticOnly = cli.allowFail || !promotionGrade || !activeStateOnly;
  const promotionEligible = promotionGrade && activeStateOnly && !cli.allowFail;
  const joinReceiptStatus = promotionGrade ? (diagnosticOnly ? "PASS_DIAGNOSTIC" : "PASS") : "FAIL";
  const sourceRowsByFamily = macroSnapshots.reduce<Record<string, number>>((counts, row) => {
    increment(counts, row.source_family);
    return counts;
  }, {});
  const sourceRowsByCurrency = macroSnapshots.reduce<Record<string, number>>((counts, row) => {
    increment(counts, row.currency);
    return counts;
  }, {});
  const snapshotStateCounts = macroSnapshots.reduce<Record<string, number>>((counts, row) => {
    increment(counts, row.snapshot_state);
    return counts;
  }, {});
  const snapshotQualityByFamily = macroSnapshots.reduce<Record<string, {
    rows: number;
    valueAvailable: number;
    missing: number;
    stale: number;
  }>>((counts, row) => {
    const family = row.source_family;
    const current = counts[family] ?? { rows: 0, valueAvailable: 0, missing: 0, stale: 0 };
    current.rows += 1;
    if (snapshotValueAvailable(row)) current.valueAvailable += 1;
    else current.missing += 1;
    if (snapshotIsStale(row)) current.stale += 1;
    counts[family] = current;
    return counts;
  }, {});
  const expectedSourceKeysByCurrency = Object.fromEntries(
    [...expectedKeysByCurrency.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, keys]) => [currency, [...keys].sort()]),
  );
  const macroWeekIds = matrixWeeks.map(macroWeekIdFor);
  const pairMappings = FX_PAIR_DEFINITIONS
    .filter((row) => matrixPairs.includes(row.pair))
    .sort((left, right) => left.pair.localeCompare(right.pair));
  const pairWeekKeys = macroWeekIds.flatMap((macroWeekId) =>
    matrixPairs.map((pairId) => `${macroWeekId}|${pairId}`));
  const lineageHashes = sourceLineageHashes(macroSelection.dataset?.source_versions ?? null);

  const report = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose:
      "Zero-P&L source join coverage receipt for binding locked Gate 44 pair-week contexts to macro weekly snapshot manifests.",
    summary: {
      joinReceiptStatus,
      promotionGrade,
      diagnosticOnly,
      promotionEligible,
      expectedPairWeeks: cli.expectedWeeks * cli.expectedPairs,
      matrixPairWeeks: matrixContexts.length,
      joinablePairWeeks: pairJoin.joinablePairWeeks,
      blockedPairWeeks: pairJoin.blockedPairWeeks,
      resolvedJoinMapHash: resolvedJoinMap.resolvedJoinMapHash,
      resolvedContentJoinMapHash: resolvedJoinMap.resolvedContentJoinMapHash,
      sourceContentInvariantHash: GATE50_RRP_SOURCE_CONTENT_JOIN_MAP_HASH,
      featureBundleManifestId: cli.featureBundle.featureBundleManifestId,
      activationScope: cli.activationScope,
      approvedRootPromotionManifestId: cli.approvedRootPromotionManifestId,
      approvedRootPromotionManifestHash: cli.approvedRootPromotionManifestHash,
      parentPromotionProofReceiptHash: cli.parentPromotionProofReceiptHash,
      requiredDependencySetHash: hashPayload(cli.featureBundle.requiredDependencySet),
      requiredSourceFamilies: cli.requiredSourceFamilies,
      sourceFamiliesPresent,
      unexpectedSourceFamilies,
      missingRequiredFamilies,
      allowedSnapshotStates: cli.allowedSnapshotStates,
      noPnlComputed: true,
      noStrategyFilterComputed: true,
    },
    cli: {
      matrixDatasetId: cli.matrixDatasetId,
      matrixDatasetHash: cli.matrixDatasetHash,
      expectedWeeks: cli.expectedWeeks,
      expectedPairs: cli.expectedPairs,
      macroRegimeDatasetId: cli.macroRegimeDatasetId,
      macroDatasetHash: cli.macroDatasetHash,
      promotionManifestId: cli.promotionManifestId,
      contractManifestHash: cli.contractManifestHash,
      freezeVersion: cli.freezeVersion,
      allowedSnapshotStates: cli.allowedSnapshotStates,
      featureBundleId: cli.featureBundleId,
      featureBundle: cli.featureBundle,
      activationScope: cli.activationScope,
      approvedRootPromotionManifestId: cli.approvedRootPromotionManifestId,
      approvedRootPromotionManifestHash: cli.approvedRootPromotionManifestHash,
      parentPromotionProofReceiptHash: cli.parentPromotionProofReceiptHash,
      requiredSourceFamilies: cli.requiredSourceFamilies,
    },
    matrix: {
      datasetId: matrixDataset.dataset_id,
      datasetHash: matrixDataset.dataset_hash,
      datasetVersion: matrixDataset.dataset_version,
      status: matrixDataset.status,
      assetClass: matrixDataset.asset_class,
      fromUtc: isoUtc(matrixDataset.from_utc),
      toUtc: isoUtc(matrixDataset.to_utc),
      universe: matrixDataset.universe,
      sourceVersions: matrixDataset.source_versions,
      executionVersions: matrixDataset.execution_versions,
      coverage: matrixDataset.coverage,
      weekCount: matrixWeeks.length,
      pairCount: matrixPairs.length,
      sourceContextRows: matrixContexts.length,
      expectedSourceContextRows: cli.expectedWeeks * cli.expectedPairs,
      weekIds: matrixWeeks,
      weekIdHash: hashPayload(matrixWeeks),
      macroWeekIds,
      macroWeekIdHash: hashPayload(macroWeekIds),
      pairSymbols: matrixPairs,
      pairIdHash: hashPayload(matrixPairs),
      pairMappings,
      pairMappingHash: hashPayload(pairMappings),
      pairWeekKeyHash: hashPayload(pairWeekKeys),
      missingMatrixContextSamples: missingMatrixContexts.slice(0, cli.sampleLimit),
      unexpectedMatrixSymbols,
    },
    macro: {
      selectionMode: macroSelection.selectionMode,
      queryError: macroSelection.queryError,
      candidateCount: macroSelection.candidates.length,
      candidateIds: macroSelection.candidates.map((row) => row.regime_dataset_id),
      regimeDatasetId: macroSelection.dataset?.regime_dataset_id ?? null,
      datasetHash: macroSelection.dataset?.dataset_hash ?? null,
      datasetVersion: macroSelection.dataset?.dataset_version ?? null,
      status: macroSelection.dataset?.status ?? null,
      assetClass: macroSelection.dataset?.asset_class ?? null,
      fromWeekOpenUtc: macroSelection.dataset ? isoUtc(macroSelection.dataset.from_week_open_utc) : null,
      toWeekOpenUtc: macroSelection.dataset ? isoUtc(macroSelection.dataset.to_week_open_utc) : null,
      promotionManifestId: macroSelection.dataset?.promotion_manifest_id ?? null,
      contractManifestHash: macroSelection.dataset?.contract_manifest_hash ?? null,
      snapshotState: macroSelection.dataset?.snapshot_state ?? null,
      reconstructionMode: macroSelection.dataset?.reconstruction_mode ?? null,
      calendarVersion: macroSelection.dataset?.calendar_version ?? null,
      selectorVersion: macroSelection.dataset?.selector_version ?? null,
      validationContractVersion: macroSelection.dataset?.validation_contract_version ?? null,
      buildVersion: macroSelection.dataset?.build_version ?? null,
      coverage: macroSelection.dataset?.coverage ?? null,
      sourceVersions: macroSelection.dataset?.source_versions ?? null,
      manifestRows: macroManifests.length,
      weeklyCurrencySnapshotRows: macroSnapshots.length,
      sourceRowsByFamily,
      sourceRowsByCurrency,
      snapshotStateCounts,
      snapshotQualityByFamily,
      expectedSourceKeysByCurrency,
      lineageHashes,
    },
    weeklyManifests: {
      totalWeeks: weekAudits.length,
      weeksPassingManifestEligibility: weekAudits.filter((row) => row.blockers.length === 0).length,
      blockerCounts: countValues(weekBlockers),
      samples: weekAudits.filter((row) => row.blockers.length > 0).slice(0, cli.sampleLimit),
    },
    pairJoin,
    resolvedJoinMap,
    promotionBlockers,
    controls: {
      matrixUsesLockedGate44Control: matrixDataset.dataset_id === cli.matrixDatasetId
        && matrixDataset.dataset_hash === cli.matrixDatasetHash,
      same372WeekIdsDerivedFromMatrixSourceContexts: matrixWeeks.length === cli.expectedWeeks,
      pairWeekJoinTarget: "372 matrix weeks x 28 canonical FX pairs = 10,416 pair-week contexts",
      executionTruthContract:
        "Join must read an allowed aggregate weekly snapshot manifest. Row-level weekly currency snapshots are sealed source evidence, not execution truth.",
      outcomeRunnerContract: [
        "Outcome runners must require joinReceiptStatus=PASS.",
        "Outcome runners must require diagnosticOnly=false and promotionEligible=true.",
        "Outcome runners must require blockedPairWeeks=0 and expectedPairWeeks=joinablePairWeeks.",
        "Outcome runners must pin and verify resolvedJoinMapHash instead of reconstructing joins independently.",
      ],
      attributionClock:
        "Future macro attribution starts at manifest effective_from_utc, not week_open_utc.",
      noOutcomeLogic:
        "This audit does not compute P&L, trade direction, pair filter, stop, TP, runner, or grid-entry behavior.",
    },
  };

  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const jsonPath = path.resolve(
    process.cwd(),
    cli.jsonOut ?? path.join(cli.outDir, `gate50-macro-regime-join-coverage-${stamp}.json`),
  );
  const mdPath = path.resolve(
    process.cwd(),
    cli.mdOut ?? jsonPath.replace(/\.json$/i, ".md"),
  );
  const reportWithFiles = {
    ...report,
    files: {
      jsonPath: path.relative(process.cwd(), jsonPath).replaceAll("\\", "/"),
      mdPath: path.relative(process.cwd(), mdPath).replaceAll("\\", "/"),
    },
  };

  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(reportWithFiles, null, 2)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown(reportWithFiles as JsonRecord), "utf8");

  console.log(`Gate 50 macro join coverage: ${promotionGrade ? "PASS" : "FAIL"}`);
  console.log(`Pair-week contexts: joinable=${pairJoin.joinablePairWeeks}/${matrixContexts.length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (!promotionGrade) {
    console.log(`Promotion blockers: ${Object.entries(promotionBlockers).map(([key, count]) => `${key}:${count}`).join("; ")}`);
    if (!cli.allowFail) process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[macro-join-coverage] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Pool may be unopened if validation failed before the first query.
    }
  });
