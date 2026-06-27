import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getPool, query } from "@database/db/client";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 60B: regime-source-foundation-parity";
const COMMAND = "npm run engine:gate60b:regime-source-foundation";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate60b/artifacts/gate60b-regime-source-foundation";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate60b/GATE60B_REGIME_SOURCE_FOUNDATION_2026-06-27.md";
const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const SOURCE_REGISTRY_VERSION = "gate60b_regime_source_registry_v1";
const ALPHA_WEEK_REBUILD_VERSION = "gate60b_alpha_week_source_shadow_rebuild_v1";
const JOIN_MAP_VERSION = "gate60b_alpha_v1_macro_source_foundation_join_v1";

const RATE_DATASET_ID = "dcdc850a-80a2-4178-8d08-dd759be6afb8";
const CPI_DATASET_ID = "37b4081b-880e-4ae6-8d53-20ba900dff07";
const RRP_DATASET_ID = "220fd5fd-d017-4db2-bdde-524a3c664c72";
const BPR_DATASET_ID = "01a3b789-2928-4886-a627-eaf5ae689790";
const VALUATION_DATASET_ID = "97266ab2-6feb-4962-936b-a47d73c06684";

const RATE_SOURCE_FAMILY_MANIFEST_ID = "rate_3m_market_family_v1";
const CPI_SOURCE_FAMILY_MANIFEST_ID = "cpi_all_items_family_v1";
const RRP_FEATURE_BUNDLE_ID = "real_rate_pressure_attribution_v1";
const RRP_FORMULA_VERSION = "rrp_percent_v1__nominal_3m_interbank_minus_cpi_yoy";

type SourceKey = "rrp" | "rate_parent" | "cpi_parent" | "bpr" | "valuation";
type RegistryState = "ACTIVE_FEATURE" | "SEALED_PARENT" | "BUILDING_SHADOW" | "QUARANTINED" | "RAW_SOURCE_ONLY" | "MISSING";
type SourceFamily = "rate" | "inflation" | "real_rate_pressure" | "bpr" | "valuation";

type CliOptions = {
  alphaLedgerPath: string;
  artifactDir: string;
  reportPath: string;
};

type AtomLedgerRow = {
  row_key: string;
  week: { week_open_utc: string };
  instrument: {
    symbol: string;
    base_currency: string | null;
    quote_currency: string | null;
  };
};

type DatasetRecord = {
  regime_dataset_id: string;
  dataset_version: string;
  dataset_hash: string;
  status: string;
  snapshot_state: string;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  from_week_open_utc: string;
  to_week_open_utc: string;
  source_versions: Record<string, unknown>;
  coverage: Record<string, unknown>;
};

type ManifestRecord = {
  regime_dataset_id: string;
  promotion_manifest_id: string;
  feature_bundle_manifest_id: string | null;
  activation_scope: string | null;
  contract_manifest_hash: string;
  macro_week_id: string;
  freeze_version: string;
  snapshot_id: string;
  snapshot_hash: string;
  snapshot_state: string;
  row_snapshot_count: number;
};

type ObservationRecord = {
  source_family: SourceFamily;
  source_id: string;
  currency: string;
  instrument: string;
  source_observation_id: string;
  observation_date: string;
  effective_at_utc: string;
  available_at_utc: string;
  source_url: string;
  source_hash: string | null;
  raw_value_json: Record<string, unknown>;
  normalized_value_json: Record<string, unknown>;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

type WeeklySnapshotRecord = {
  regime_dataset_id: string;
  source_family: SourceFamily;
  source_id: string;
  currency: string;
  instrument: string;
  week_open_utc: string;
  macro_week_id: string | null;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  snapshot_id: string | null;
  snapshot_hash: string | null;
  snapshot_state: string;
  source_observation_date: string | null;
  effective_at_utc: string | null;
  available_at_utc: string | null;
  normalized_value_json: Record<string, unknown>;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

type SourceRegistryEntry = {
  source_key: SourceKey;
  family: SourceFamily;
  label: string;
  dataset_id: string;
  dataset_hash: string | null;
  dataset_state: string | null;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  registry_state: RegistryState;
  raw_source_exists: boolean;
  sealed_parent: boolean;
  active_feature: boolean;
  building_shadow: boolean;
  quarantined: boolean;
  non_promoted: boolean;
  feature_bundle_manifest_id: string | null;
  role: string;
  eligibility_read: string;
  blocking_reason: string | null;
  allowed_use: string;
};

type ParentShadowSnapshot = {
  row_key: string;
  rebuild_version: string;
  alpha_week_open_utc: string;
  macro_week_id: string;
  source_key: "rate_parent" | "cpi_parent";
  source_family: "rate" | "inflation";
  dataset_id: string;
  dataset_hash: string | null;
  currency: string;
  source_id: string | null;
  instrument: string | null;
  value_available: boolean;
  value_key: "ratePercent" | "inflationYoYPercent";
  value: number | null;
  selected_observation_date: string | null;
  selected_observation_id: string | null;
  selected_availability_event_id: string | null;
  selected_raw_artifact_ids: string[];
  effective_at_utc: string | null;
  available_at_utc: string | null;
  eligible_candidates: number;
  eligibility_reason: string | null;
  stale: boolean;
  source_ambiguous: boolean;
  missing_reason: string | null;
  source_content_hash: string;
};

type RrpShadowSnapshot = {
  row_key: string;
  rebuild_version: string;
  alpha_week_open_utc: string;
  macro_week_id: string;
  source_key: "rrp";
  source_family: "real_rate_pressure";
  dataset_id: string;
  currency: string;
  value_available: boolean;
  real_rate_pressure_percent: number | null;
  rate_parent_hash: string | null;
  cpi_parent_hash: string | null;
  rate_parent_observation_id: string | null;
  cpi_parent_observation_id: string | null;
  parent_lineage_complete: boolean;
  missing_reasons: string[];
  source_content_hash: string;
};

type FoundationJoinRow = {
  row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  base: string | null;
  quote: string | null;
  mapped_macro_week_id: string;
  join_map_version: string;
  rrp_shadow_status: {
    state: "BUILDING_SHADOW";
    base_available: boolean;
    quote_available: boolean;
    base_hash: string | null;
    quote_hash: string | null;
    mapped_rows_available: boolean;
    missing_reasons: string[];
  };
  rate_parent_status: {
    state: "SEALED_PARENT";
    base_available: boolean;
    quote_available: boolean;
    missing_reasons: string[];
  };
  cpi_parent_status: {
    state: "SEALED_PARENT";
    base_available: boolean;
    quote_available: boolean;
    missing_reasons: string[];
  };
  bpr_status: {
    state: "QUARANTINED";
    fail_closed_reason: string;
  };
  valuation_status: {
    state: "BUILDING_SHADOW";
    fail_closed_reason: string;
  };
  full_family_source_eligible: false;
  fail_closed_reasons: string[];
};

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  const value = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  return {
    alphaLedgerPath: value("alpha-ledger") ?? DEFAULT_ALPHA_LEDGER_PATH,
    artifactDir: value("artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: value("report") ?? DEFAULT_REPORT_PATH,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return "";
}

function macroWeekIdFor(weekOpenUtc: string) {
  return `macro_week_${iso(weekOpenUtc).slice(0, 10)}`;
}

function compareIso(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return left.localeCompare(right);
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))].sort();
}

function countDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates.size;
}

function selectedObservationId(row: ObservationRecord | null) {
  if (!row) return null;
  return stringValue(row.coverage.rawObservationId) ??
    stringValue(row.flags.rawObservationId) ??
    row.source_observation_id;
}

function selectedAvailabilityEventId(row: ObservationRecord | null) {
  if (!row) return null;
  return stringValue(row.coverage.availabilityEventId) ?? stringValue(row.flags.availabilityEventId);
}

function selectedRawArtifactIds(row: ObservationRecord | null) {
  if (!row) return [];
  return uniqueSorted([
    stringValue(row.coverage.rawArtifactId),
    stringValue(row.flags.rawArtifactId),
    ...stringArray(row.coverage.rawArtifactIds),
    ...stringArray(row.flags.rawArtifactIds),
  ]);
}

function observationKey(row: Pick<ObservationRecord, "source_family" | "source_id" | "currency" | "instrument">) {
  return `${row.source_family}|${row.source_id}|${row.currency}|${row.instrument}`;
}

function compareObservationSelectionPriority(left: ObservationRecord, right: ObservationRecord) {
  const leftKey = [
    left.observation_date,
    left.effective_at_utc,
    stringValue(left.coverage.vintageDate) ?? stringValue(left.raw_value_json.realtimeStart) ?? left.available_at_utc,
    left.available_at_utc,
    selectedObservationId(left) ?? "",
  ];
  const rightKey = [
    right.observation_date,
    right.effective_at_utc,
    stringValue(right.coverage.vintageDate) ?? stringValue(right.raw_value_json.realtimeStart) ?? right.available_at_utc,
    right.available_at_utc,
    selectedObservationId(right) ?? "",
  ];
  for (let index = 0; index < leftKey.length; index += 1) {
    const comparison = leftKey[index].localeCompare(rightKey[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function rateRealtimePeriodContainsFreeze(row: ObservationRecord, freezeTargetUtc: string) {
  if (row.source_family !== "rate") return true;
  const realtimeStart = stringValue(row.raw_value_json.realtimeStart) ?? stringValue(row.coverage.realtimeStart);
  const realtimeEnd = stringValue(row.raw_value_json.realtimeEnd) ?? stringValue(row.coverage.realtimeEnd);
  if (!realtimeStart || !realtimeEnd) return true;
  const freezeDate = freezeTargetUtc.slice(0, 10);
  return realtimeStart <= freezeDate && freezeDate <= realtimeEnd;
}

function freezeEligibility(row: ObservationRecord, freezeTargetUtc: string) {
  if (!rateRealtimePeriodContainsFreeze(row, freezeTargetUtc)) {
    return { eligible: false, reason: "realtime_period_not_valid_for_freeze_date" };
  }
  const availableAt = iso(row.available_at_utc);
  if (availableAt < freezeTargetUtc) {
    return { eligible: true, reason: "available_before_freeze_target" };
  }
  if (availableAt > freezeTargetUtc) {
    return { eligible: false, reason: "available_after_freeze_target" };
  }
  const precision = row.coverage.availabilityPrecision;
  const policy = row.coverage.eligibilityPolicy;
  if (
    row.source_family === "rate" &&
    row.coverage.asOfQueryDateEligibleAtFreezeDate === true &&
    policy === "eligible_at_or_before_freeze"
  ) {
    return { eligible: true, reason: "as_of_query_date_matches_freeze_date" };
  }
  if (
    policy === "eligible_at_or_before_freeze" &&
    (precision === "scheduled_window" || precision === "exact_timestamp")
  ) {
    return { eligible: true, reason: "trusted_exact_boundary_timestamp" };
  }
  return { eligible: false, reason: "date_only_or_approximate_boundary_rolls_forward" };
}

function selectObservationForFreeze(rows: ObservationRecord[], freezeTargetUtc: string) {
  let selected: ObservationRecord | null = null;
  let selectedEligibilityReason: string | null = null;
  let eligibleCandidates = 0;
  for (const row of rows) {
    const eligibility = freezeEligibility(row, freezeTargetUtc);
    if (!eligibility.eligible) continue;
    eligibleCandidates += 1;
    if (!selected || compareObservationSelectionPriority(row, selected) > 0) {
      selected = row;
      selectedEligibilityReason = eligibility.reason;
    }
  }
  return { selected, selectedEligibilityReason, eligibleCandidates };
}

async function readAlphaRows(alphaLedgerPath: string) {
  const text = await readFile(alphaLedgerPath, "utf8");
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as AtomLedgerRow);
}

async function readDatasets() {
  const ids = [RRP_DATASET_ID, RATE_DATASET_ID, CPI_DATASET_ID, BPR_DATASET_ID, VALUATION_DATASET_ID];
  const rows = await query<DatasetRecord>(`
    SELECT
      regime_dataset_id::text,
      dataset_version,
      dataset_hash,
      status,
      snapshot_state,
      promotion_manifest_id,
      contract_manifest_hash,
      to_char(from_week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS from_week_open_utc,
      to_char(to_week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS to_week_open_utc,
      source_versions,
      coverage
    FROM research_macro_regime_datasets
    WHERE regime_dataset_id = ANY($1::uuid[])
    ORDER BY regime_dataset_id::text
  `, [ids]);
  return new Map(rows.map((row) => [row.regime_dataset_id, row]));
}

async function readManifests() {
  const ids = [RRP_DATASET_ID, RATE_DATASET_ID, CPI_DATASET_ID, BPR_DATASET_ID, VALUATION_DATASET_ID];
  return query<ManifestRecord>(`
    SELECT
      regime_dataset_id::text,
      promotion_manifest_id,
      feature_bundle_manifest_id,
      activation_scope,
      contract_manifest_hash,
      macro_week_id,
      freeze_version,
      snapshot_id,
      snapshot_hash,
      snapshot_state,
      row_snapshot_count
    FROM research_macro_weekly_snapshot_manifests
    WHERE regime_dataset_id = ANY($1::uuid[])
    ORDER BY regime_dataset_id::text, macro_week_id, promotion_manifest_id, snapshot_id
  `, [ids]);
}

async function readObservations(datasetId: string, sourceFamily: "rate" | "inflation") {
  return query<ObservationRecord>(`
    SELECT
      source_family,
      source_id,
      currency,
      instrument,
      source_observation_id,
      observation_date::text,
      to_char(effective_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS effective_at_utc,
      to_char(available_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS available_at_utc,
      source_url,
      source_hash,
      raw_value_json,
      normalized_value_json,
      coverage,
      flags
    FROM research_macro_source_observations
    WHERE regime_dataset_id = $1::uuid
      AND source_family = $2
      AND currency <> 'ALL'
    ORDER BY source_family, source_id, currency, instrument, observation_date, available_at_utc, source_observation_id
  `, [datasetId, sourceFamily]);
}

async function readWeeklySnapshots() {
  const ids = [RRP_DATASET_ID, RATE_DATASET_ID, CPI_DATASET_ID, BPR_DATASET_ID, VALUATION_DATASET_ID];
  return query<WeeklySnapshotRecord>(`
    SELECT
      regime_dataset_id::text,
      source_family,
      source_id,
      currency,
      instrument,
      to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc,
      macro_week_id,
      promotion_manifest_id,
      contract_manifest_hash,
      snapshot_id,
      snapshot_hash,
      snapshot_state,
      source_observation_date::text,
      CASE WHEN effective_at_utc IS NULL THEN NULL ELSE to_char(effective_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS effective_at_utc,
      CASE WHEN available_at_utc IS NULL THEN NULL ELSE to_char(available_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS available_at_utc,
      normalized_value_json,
      coverage,
      flags
    FROM research_macro_weekly_currency_snapshots
    WHERE regime_dataset_id = ANY($1::uuid[])
    ORDER BY regime_dataset_id::text, week_open_utc, source_family, source_id, currency, instrument
  `, [ids]);
}

function denominatorProof(alphaRows: AtomLedgerRow[]) {
  const rowKeys = alphaRows.map((row) => row.row_key);
  const weeks = uniqueSorted(alphaRows.map((row) => row.week.week_open_utc));
  const rowsPerWeek = new Map<string, number>();
  for (const row of alphaRows) {
    rowsPerWeek.set(row.week.week_open_utc, (rowsPerWeek.get(row.week.week_open_utc) ?? 0) + 1);
  }
  const histogram = [...rowsPerWeek.values()].reduce<Record<string, number>>((counts, count) => {
    counts[String(count)] = (counts[String(count)] ?? 0) + 1;
    return counts;
  }, {});
  return {
    input_rows: alphaRows.length,
    expected_input_rows: EXPECTED_ROWS,
    alpha_weeks: weeks.length,
    expected_alpha_weeks: EXPECTED_WEEKS,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    rows_per_week_histogram: histogram,
    full_weeks: [...rowsPerWeek.entries()].filter(([, count]) => count === EXPECTED_SYMBOLS_PER_WEEK).length,
    non_full_weeks: [...rowsPerWeek.entries()]
      .filter(([, count]) => count !== EXPECTED_SYMBOLS_PER_WEEK)
      .map(([week_open_utc, rows]) => ({ week_open_utc, rows })),
    duplicate_input_row_keys: countDuplicates(rowKeys),
  };
}

function buildRegistry(
  datasets: Map<string, DatasetRecord>,
  manifests: ManifestRecord[],
  weeklySnapshots: WeeklySnapshotRecord[],
): SourceRegistryEntry[] {
  const weeklyByDataset = (datasetId: string) => weeklySnapshots.filter((row) => row.regime_dataset_id === datasetId);
  const manifestByDataset = (datasetId: string) => manifests.filter((row) => row.regime_dataset_id === datasetId);
  const entry = (input: Omit<SourceRegistryEntry, "dataset_hash" | "dataset_state" | "promotion_manifest_id" | "contract_manifest_hash" | "raw_source_exists">): SourceRegistryEntry => {
    const dataset = datasets.get(input.dataset_id);
    const sourceRows = weeklyByDataset(input.dataset_id);
    return {
      ...input,
      dataset_hash: dataset?.dataset_hash ?? null,
      dataset_state: dataset?.snapshot_state ?? null,
      promotion_manifest_id: dataset?.promotion_manifest_id ?? null,
      contract_manifest_hash: dataset?.contract_manifest_hash ?? null,
      raw_source_exists: sourceRows.length > 0 || manifestByDataset(input.dataset_id).length > 0,
    };
  };

  return [
    entry({
      source_key: "rrp",
      family: "real_rate_pressure",
      label: "real-rate pressure attribution",
      dataset_id: RRP_DATASET_ID,
      registry_state: "ACTIVE_FEATURE",
      sealed_parent: false,
      active_feature: true,
      building_shadow: false,
      quarantined: false,
      non_promoted: false,
      feature_bundle_manifest_id: RRP_FEATURE_BUNDLE_ID,
      role: "active_feature_with_alpha_week_shadow_rebuild_required",
      eligibility_read:
        "Existing ACTIVE RRP feature is promotion-bound on its original week identity; Gate 60B rebuilds a non-mutating Alpha-week shadow from sealed rate/CPI parent observations.",
      blocking_reason: "shadow_rebuild_requires_review_before_warehouse_promotion",
      allowed_use: "source coverage proof only; no Regime side or trade filter",
    }),
    entry({
      source_key: "rate_parent",
      family: "rate",
      label: "nominal rate parent",
      dataset_id: RATE_DATASET_ID,
      registry_state: "SEALED_PARENT",
      sealed_parent: true,
      active_feature: false,
      building_shadow: false,
      quarantined: false,
      non_promoted: false,
      feature_bundle_manifest_id: null,
      role: "sealed_parent_source",
      eligibility_read: "Clean SEALED parent for RRP rebuild only; not standalone ACTIVE Regime feature.",
      blocking_reason: "not_versioned_as_standalone_active_feature_bundle",
      allowed_use: "parent source evidence for RRP source foundation",
    }),
    entry({
      source_key: "cpi_parent",
      family: "inflation",
      label: "CPI/inflation parent",
      dataset_id: CPI_DATASET_ID,
      registry_state: "SEALED_PARENT",
      sealed_parent: true,
      active_feature: false,
      building_shadow: false,
      quarantined: false,
      non_promoted: false,
      feature_bundle_manifest_id: null,
      role: "sealed_parent_source",
      eligibility_read: "Clean SEALED parent for RRP rebuild only; not standalone ACTIVE Regime feature.",
      blocking_reason: "not_versioned_as_standalone_active_feature_bundle",
      allowed_use: "parent source evidence for RRP source foundation",
    }),
    entry({
      source_key: "bpr",
      family: "bpr",
      label: "BPR / bank positioning",
      dataset_id: BPR_DATASET_ID,
      registry_state: "QUARANTINED",
      sealed_parent: false,
      active_feature: false,
      building_shadow: false,
      quarantined: true,
      non_promoted: false,
      feature_bundle_manifest_id: null,
      role: "quarantined_source_family",
      eligibility_read: "Blocked by Gate 52A until exact publication timing is proven or a clean-window version is separately contracted.",
      blocking_reason: "gate52a_source_ambiguity_quarantine",
      allowed_use: "source existence diagnostics only",
    }),
    entry({
      source_key: "valuation",
      family: "valuation",
      label: "valuation / PPP / NEER / REER",
      dataset_id: VALUATION_DATASET_ID,
      registry_state: "BUILDING_SHADOW",
      sealed_parent: false,
      active_feature: false,
      building_shadow: true,
      quarantined: false,
      non_promoted: true,
      feature_bundle_manifest_id: null,
      role: "raw_source_only_shadow",
      eligibility_read: "Raw PPP/NEER/REER source rows exist but valuation-gap formula and source promotion are not versioned.",
      blocking_reason: "valuation_formula_and_promotion_missing",
      allowed_use: "raw/source-only diagnostics; no Regime evidence side",
    }),
  ];
}

function buildParentSnapshots(input: {
  alphaWeeks: string[];
  observations: ObservationRecord[];
  dataset: DatasetRecord | null;
  sourceKey: "rate_parent" | "cpi_parent";
  valueKey: "ratePercent" | "inflationYoYPercent";
}) {
  const byContract = new Map<string, ObservationRecord[]>();
  for (const observation of input.observations) {
    const key = observationKey(observation);
    byContract.set(key, [...(byContract.get(key) ?? []), observation]);
  }
  for (const rows of byContract.values()) {
    rows.sort((left, right) => compareObservationSelectionPriority(left, right));
  }

  const contracts = uniqueSorted(input.observations.map((row) => observationKey(row)))
    .map((key) => input.observations.find((row) => observationKey(row) === key)!)
    .sort((left, right) => `${left.currency}|${left.source_id}|${left.instrument}`.localeCompare(`${right.currency}|${right.source_id}|${right.instrument}`));

  const snapshots: ParentShadowSnapshot[] = [];
  for (const contract of contracts) {
    const rows = byContract.get(observationKey(contract)) ?? [];
    for (const alphaWeekOpenUtc of input.alphaWeeks) {
      const macroWeekId = macroWeekIdFor(alphaWeekOpenUtc);
      const { selected, selectedEligibilityReason, eligibleCandidates } = selectObservationForFreeze(rows, alphaWeekOpenUtc);
      const selectedCoverage = record(selected?.coverage);
      const value = selected ? numberValue(selected.normalized_value_json[input.valueKey]) : null;
      const valueAvailable = selected !== null && value !== null && boolValue(selectedCoverage.valueAvailable, false);
      const sourceAmbiguous = input.sourceKey === "cpi_parent"
        ? false
        : boolValue(selected?.flags.latestVintageResearchApproximation, false) ||
          boolValue(selected?.flags.promotionBlockedUntilPointInTimeAvailability, false);
      const stale = false;
      const missingReason = !selected
        ? "no_observation_available_as_of_alpha_week_open"
        : value === null
          ? `${input.valueKey}_missing`
          : valueAvailable
            ? null
            : "selected_observation_value_unavailable";
      const selectedId = selectedObservationId(selected);
      const sourceContentHash = sha256Stable({
        rebuild_version: ALPHA_WEEK_REBUILD_VERSION,
        source_key: input.sourceKey,
        dataset_id: input.dataset?.regime_dataset_id ?? null,
        dataset_hash: input.dataset?.dataset_hash ?? null,
        alpha_week_open_utc: alphaWeekOpenUtc,
        macro_week_id: macroWeekId,
        source_id: contract.source_id,
        currency: contract.currency,
        instrument: contract.instrument,
        selected_observation_id: selectedId,
        selected_observation_date: selected?.observation_date ?? null,
        selected_availability_event_id: selectedAvailabilityEventId(selected),
        selected_raw_artifact_ids: selectedRawArtifactIds(selected),
        value_key: input.valueKey,
        value,
        value_available: valueAvailable,
        eligibility_reason: selectedEligibilityReason,
        eligible_candidates: eligibleCandidates,
      });
      snapshots.push({
        row_key: `${input.sourceKey}|${alphaWeekOpenUtc}|${contract.currency}`,
        rebuild_version: ALPHA_WEEK_REBUILD_VERSION,
        alpha_week_open_utc: alphaWeekOpenUtc,
        macro_week_id: macroWeekId,
        source_key: input.sourceKey,
        source_family: contract.source_family === "rate" ? "rate" : "inflation",
        dataset_id: input.dataset?.regime_dataset_id ?? (input.sourceKey === "rate_parent" ? RATE_DATASET_ID : CPI_DATASET_ID),
        dataset_hash: input.dataset?.dataset_hash ?? null,
        currency: contract.currency,
        source_id: contract.source_id,
        instrument: contract.instrument,
        value_available: valueAvailable,
        value_key: input.valueKey,
        value,
        selected_observation_date: selected?.observation_date ?? null,
        selected_observation_id: selectedId,
        selected_availability_event_id: selectedAvailabilityEventId(selected),
        selected_raw_artifact_ids: selectedRawArtifactIds(selected),
        effective_at_utc: selected?.effective_at_utc ?? null,
        available_at_utc: selected?.available_at_utc ?? null,
        eligible_candidates: eligibleCandidates,
        eligibility_reason: selectedEligibilityReason,
        stale,
        source_ambiguous: sourceAmbiguous,
        missing_reason: missingReason,
        source_content_hash: sourceContentHash,
      });
    }
  }
  return snapshots.sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function buildRrpSnapshots(input: {
  alphaWeeks: string[];
  rateSnapshots: ParentShadowSnapshot[];
  cpiSnapshots: ParentShadowSnapshot[];
}) {
  const rateByWeekCurrency = new Map(input.rateSnapshots.map((row) => [`${row.alpha_week_open_utc}|${row.currency}`, row]));
  const cpiByWeekCurrency = new Map(input.cpiSnapshots.map((row) => [`${row.alpha_week_open_utc}|${row.currency}`, row]));
  const currencies = uniqueSorted([...input.rateSnapshots, ...input.cpiSnapshots].map((row) => row.currency));
  const rows: RrpShadowSnapshot[] = [];
  for (const currency of currencies) {
    for (const alphaWeekOpenUtc of input.alphaWeeks) {
      const macroWeekId = macroWeekIdFor(alphaWeekOpenUtc);
      const rate = rateByWeekCurrency.get(`${alphaWeekOpenUtc}|${currency}`) ?? null;
      const cpi = cpiByWeekCurrency.get(`${alphaWeekOpenUtc}|${currency}`) ?? null;
      const reasons = [
        rate ? null : "missing_rate_parent_snapshot",
        cpi ? null : "missing_cpi_parent_snapshot",
        rate && !rate.value_available ? `rate_parent_${rate.missing_reason ?? "value_unavailable"}` : null,
        cpi && !cpi.value_available ? `cpi_parent_${cpi.missing_reason ?? "value_unavailable"}` : null,
      ].filter((reason): reason is string => Boolean(reason));
      const valueAvailable = reasons.length === 0;
      const rrpValue = valueAvailable && rate?.value !== null && cpi?.value !== null && rate && cpi
        ? rate.value - cpi.value
        : null;
      const hash = sha256Stable({
        rebuild_version: ALPHA_WEEK_REBUILD_VERSION,
        formula_version: RRP_FORMULA_VERSION,
        alpha_week_open_utc: alphaWeekOpenUtc,
        macro_week_id: macroWeekId,
        currency,
        rate_parent_hash: rate?.source_content_hash ?? null,
        cpi_parent_hash: cpi?.source_content_hash ?? null,
        rate_parent_observation_id: rate?.selected_observation_id ?? null,
        cpi_parent_observation_id: cpi?.selected_observation_id ?? null,
        value_available: valueAvailable,
        real_rate_pressure_percent: rrpValue,
        missing_reasons: reasons,
      });
      rows.push({
        row_key: `rrp|${alphaWeekOpenUtc}|${currency}`,
        rebuild_version: ALPHA_WEEK_REBUILD_VERSION,
        alpha_week_open_utc: alphaWeekOpenUtc,
        macro_week_id: macroWeekId,
        source_key: "rrp",
        source_family: "real_rate_pressure",
        dataset_id: RRP_DATASET_ID,
        currency,
        value_available: valueAvailable,
        real_rate_pressure_percent: rrpValue,
        rate_parent_hash: rate?.source_content_hash ?? null,
        cpi_parent_hash: cpi?.source_content_hash ?? null,
        rate_parent_observation_id: rate?.selected_observation_id ?? null,
        cpi_parent_observation_id: cpi?.selected_observation_id ?? null,
        parent_lineage_complete: Boolean(rate?.selected_observation_id && cpi?.selected_observation_id),
        missing_reasons: reasons,
        source_content_hash: hash,
      });
    }
  }
  return rows.sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function missingReasonFor(snapshot: ParentShadowSnapshot | RrpShadowSnapshot | null, prefix: string) {
  if (!snapshot) return [`${prefix}_missing_snapshot`];
  if ("missing_reason" in snapshot && snapshot.missing_reason) return [`${prefix}_${snapshot.missing_reason}`];
  if ("missing_reasons" in snapshot && snapshot.missing_reasons.length > 0) {
    return snapshot.missing_reasons.map((reason) => `${prefix}_${reason}`);
  }
  return snapshot.value_available ? [] : [`${prefix}_value_unavailable`];
}

function buildJoinRows(alphaRows: AtomLedgerRow[], input: {
  rateSnapshots: ParentShadowSnapshot[];
  cpiSnapshots: ParentShadowSnapshot[];
  rrpSnapshots: RrpShadowSnapshot[];
}) {
  const rateMap = new Map(input.rateSnapshots.map((row) => [`${row.alpha_week_open_utc}|${row.currency}`, row]));
  const cpiMap = new Map(input.cpiSnapshots.map((row) => [`${row.alpha_week_open_utc}|${row.currency}`, row]));
  const rrpMap = new Map(input.rrpSnapshots.map((row) => [`${row.alpha_week_open_utc}|${row.currency}`, row]));

  return alphaRows.map((alpha): FoundationJoinRow => {
    const week = alpha.week.week_open_utc;
    const base = alpha.instrument.base_currency;
    const quote = alpha.instrument.quote_currency;
    const baseRate = base ? rateMap.get(`${week}|${base}`) ?? null : null;
    const quoteRate = quote ? rateMap.get(`${week}|${quote}`) ?? null : null;
    const baseCpi = base ? cpiMap.get(`${week}|${base}`) ?? null : null;
    const quoteCpi = quote ? cpiMap.get(`${week}|${quote}`) ?? null : null;
    const baseRrp = base ? rrpMap.get(`${week}|${base}`) ?? null : null;
    const quoteRrp = quote ? rrpMap.get(`${week}|${quote}`) ?? null : null;
    const rrpMissing = [
      ...missingReasonFor(baseRrp, "rrp_base"),
      ...missingReasonFor(quoteRrp, "rrp_quote"),
    ];
    const rateMissing = [
      ...missingReasonFor(baseRate, "rate_base"),
      ...missingReasonFor(quoteRate, "rate_quote"),
    ];
    const cpiMissing = [
      ...missingReasonFor(baseCpi, "cpi_base"),
      ...missingReasonFor(quoteCpi, "cpi_quote"),
    ];
    return {
      row_key: alpha.row_key,
      alpha_week_open_utc: week,
      symbol: alpha.instrument.symbol,
      base,
      quote,
      mapped_macro_week_id: macroWeekIdFor(week),
      join_map_version: JOIN_MAP_VERSION,
      rrp_shadow_status: {
        state: "BUILDING_SHADOW",
        base_available: Boolean(baseRrp?.value_available),
        quote_available: Boolean(quoteRrp?.value_available),
        base_hash: baseRrp?.source_content_hash ?? null,
        quote_hash: quoteRrp?.source_content_hash ?? null,
        mapped_rows_available: rrpMissing.length === 0,
        missing_reasons: rrpMissing,
      },
      rate_parent_status: {
        state: "SEALED_PARENT",
        base_available: Boolean(baseRate?.value_available),
        quote_available: Boolean(quoteRate?.value_available),
        missing_reasons: rateMissing,
      },
      cpi_parent_status: {
        state: "SEALED_PARENT",
        base_available: Boolean(baseCpi?.value_available),
        quote_available: Boolean(quoteCpi?.value_available),
        missing_reasons: cpiMissing,
      },
      bpr_status: {
        state: "QUARANTINED",
        fail_closed_reason: "gate52a_source_ambiguity_quarantine",
      },
      valuation_status: {
        state: "BUILDING_SHADOW",
        fail_closed_reason: "valuation_ppp_neer_reer_formula_and_promotion_not_versioned",
      },
      full_family_source_eligible: false,
      fail_closed_reasons: uniqueSorted([
        ...rrpMissing,
        ...rateMissing,
        ...cpiMissing,
        "rrp_alpha_week_shadow_not_active_feature_bundle",
        "rate_parent_not_standalone_active_feature",
        "cpi_parent_not_standalone_active_feature",
        "bpr_gate52a_source_ambiguity_quarantine",
        "valuation_formula_and_promotion_not_versioned",
      ]),
    };
  }).sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function sourceFamilyCoverage(rows: FoundationJoinRow[]) {
  const count = (predicate: (row: FoundationJoinRow) => boolean) => rows.filter(predicate).length;
  return {
    rrp_shadow: {
      mapped_rows: count((row) => row.rrp_shadow_status.mapped_rows_available),
      missing_rows: count((row) => !row.rrp_shadow_status.mapped_rows_available),
      state: "BUILDING_SHADOW",
      active_feature_rows: 0,
      note: "Alpha-week shadow rebuild proves row coverage only; it is not a promoted ACTIVE feature bundle.",
    },
    rate_parent: {
      mapped_rows: count((row) => row.rate_parent_status.missing_reasons.length === 0),
      missing_rows: count((row) => row.rate_parent_status.missing_reasons.length > 0),
      state: "SEALED_PARENT",
      active_feature_rows: 0,
    },
    cpi_parent: {
      mapped_rows: count((row) => row.cpi_parent_status.missing_reasons.length === 0),
      missing_rows: count((row) => row.cpi_parent_status.missing_reasons.length > 0),
      state: "SEALED_PARENT",
      active_feature_rows: 0,
    },
    bpr: {
      mapped_rows: 0,
      missing_rows: rows.length,
      state: "QUARANTINED",
      reason: "Gate 52A quarantine/source ambiguity remains binding.",
    },
    valuation: {
      mapped_rows: 0,
      missing_rows: rows.length,
      state: "BUILDING_SHADOW",
      reason: "PPP/NEER/REER raw sources exist, but valuation formula and promotion are not versioned.",
    },
  };
}

function renderSummaryMarkdown(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  coverage: ReturnType<typeof sourceFamilyCoverage>;
  hashes: Record<string, string>;
}) {
  const rows = Object.entries(input.coverage)
    .map(([key, value]) => {
      const row = value as { mapped_rows: number; missing_rows: number; state: string; active_feature_rows?: number };
      return `| ${key} | ${row.state} | ${row.mapped_rows} | ${row.missing_rows} | ${row.active_feature_rows ?? 0} |`;
    });
  return [
    "# Gate 60B Regime Source Foundation Summary",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Verdict",
    "",
    `\`${input.verdict}\``,
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(input.denominator, null, 2),
    "```",
    "",
    "## Source-Family Coverage",
    "",
    "| Source | Registry state | Mapped rows | Missing rows | ACTIVE feature rows |",
    "|---|---:|---:|---:|---:|",
    ...rows,
    "",
    "## Hashes",
    "",
    "```json",
    JSON.stringify(input.hashes, null, 2),
    "```",
    "",
  ].join("\n");
}

function renderReceipt(input: {
  generatedAt: string;
  gitCommit: string;
  dirtyStatus: string;
  dirtyFiles: number;
  datasets: DatasetRecord[];
  manifestsRead: number;
  observationsRead: number;
  weeklySnapshotsRead: number;
  hashes: Record<string, string>;
}) {
  const datasetRows = input.datasets.map((dataset) =>
    `| ${dataset.regime_dataset_id} | ${dataset.snapshot_state} | ${dataset.status} | ${dataset.promotion_manifest_id ?? "-"} | ${dataset.contract_manifest_hash ?? "-"} |`);
  return [
    "# Gate 60B Query/Rebuild Receipt",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Command",
    "",
    "```powershell",
    COMMAND,
    "```",
    "",
    "## Runtime",
    "",
    `- Git commit: \`${input.gitCommit}\``,
    `- Dirty tree status at script start: \`${input.dirtyStatus}\``,
    `- Dirty files: \`${input.dirtyFiles}\``,
    "",
    "## Source Datasets Included",
    "",
    "| Dataset | Snapshot state | Dataset status | Promotion manifest | Contract manifest hash |",
    "|---|---|---|---|---|",
    ...datasetRows,
    "",
    "## Probe/Rebuild Counts",
    "",
    `- Source manifest rows read: \`${input.manifestsRead}\``,
    `- Source observations read: \`${input.observationsRead}\``,
    `- Source weekly snapshot rows read: \`${input.weeklySnapshotsRead}\``,
    `- Source registry hash: \`${input.hashes.source_registry_hash}\``,
    `- Source content invariant hash: \`${input.hashes.source_content_invariant_hash}\``,
    `- Join-map hash: \`${input.hashes.join_map_hash}\``,
    "",
    "## Boundary",
    "",
    "Read-only database probe and non-mutating Alpha-week shadow rebuild. No macro source rows, Gate 59 rows, COT, Strength, Alpha v1, app runtime, Regime side, P&L, risk, execution, MT5/live, or Alpha v2 work was run.",
    "",
  ].join("\n");
}

function renderReport(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  coverage: ReturnType<typeof sourceFamilyCoverage>;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60B Regime Source Foundation",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Verdict",
    "",
    `\`${input.verdict}\``,
    "",
    "Gate 60B builds a versioned, source-only Regime source registry and a non-mutating Alpha-week shadow rebuild against the frozen Gate 59 Alpha v1 atom ledger. It does not build a Regime LONG/SHORT side, run P&L, attribution, Alpha v2, risk, execution, MT5/live, or app work.",
    "",
    "## Source Registry Contract",
    "",
    `Registry version: \`${SOURCE_REGISTRY_VERSION}\``,
    "",
    "The registry separates raw source existence from promotion eligibility:",
    "",
    "- RRP is an existing ACTIVE feature on the older macro week identity; Gate 60B rebuilds a source-only Alpha-week shadow from sealed rate/CPI parents.",
    "- Rate and CPI remain SEALED parents, not standalone ACTIVE feature bundles.",
    "- BPR remains quarantined under Gate 52A until exact publication timing or an explicitly versioned clean-window source contract exists.",
    "- Valuation remains PPP/NEER/REER raw/source-only until source promotion and valuation-gap formula are separately versioned.",
    "",
    "## Alpha Week Rebuild Result",
    "",
    "- Alpha rows: `10,444`",
    "- Alpha weeks: `373`",
    "- Expected rows per week: `28`",
    `- RRP shadow mapped rows: \`${input.coverage.rrp_shadow.mapped_rows} / ${EXPECTED_ROWS}\``,
    `- Full-family source eligible rows: \`0 / ${EXPECTED_ROWS}\``,
    "",
    "RRP shadow coverage is not a promoted Regime side. It only proves that the rate/CPI source foundation can be projected onto the Gate 59 Alpha v1 week identity without neutralizing, imputing, or skipping pair rows. Parent observations are selected by the existing latest-eligible source contracts, not by filling missing Gate 60A rows.",
    "",
    "## Source-Family Coverage",
    "",
    "| Source | Registry state | Mapped rows | Missing rows | ACTIVE feature rows |",
    "|---|---:|---:|---:|---:|",
    ...Object.entries(input.coverage).map(([key, value]) => {
      const row = value as { mapped_rows: number; missing_rows: number; state: string; active_feature_rows?: number };
      return `| ${key} | ${row.state} | ${row.mapped_rows} | ${row.missing_rows} | ${row.active_feature_rows ?? 0} |`;
    }),
    "",
    "## Hashes",
    "",
    "```json",
    JSON.stringify(input.hashes, null, 2),
    "```",
    "",
    "## Stop Line",
    "",
    "Stop here. Do not proceed to Regime shadow-signal construction, macro LONG/SHORT decisions, P&L, attribution, strategy tests, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation.",
    "",
  ].join("\n");
}

function currentGitState() {
  const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const commit = git(["rev-parse", "HEAD"]);
  const statusLines = git(["status", "--porcelain"]).split(/\r?\n/).filter(Boolean);
  return {
    commit,
    dirtyStatus: statusLines.length === 0 ? "clean" : "dirty",
    dirtyFiles: statusLines.length,
  };
}

async function main() {
  const options = parseCli();
  const generatedAt = new Date().toISOString();
  const gitState = currentGitState();
  const alphaRows = await readAlphaRows(options.alphaLedgerPath);
  const denominator = denominatorProof(alphaRows);
  if (
    denominator.input_rows !== EXPECTED_ROWS ||
    denominator.alpha_weeks !== EXPECTED_WEEKS ||
    denominator.full_weeks !== EXPECTED_WEEKS ||
    denominator.duplicate_input_row_keys !== 0
  ) {
    throw new Error(`Gate 60B denominator invariant failed: ${JSON.stringify(denominator, null, 2)}`);
  }

  const alphaWeeks = uniqueSorted(alphaRows.map((row) => row.week.week_open_utc));
  const datasets = await readDatasets();
  const manifests = await readManifests();
  const weeklySnapshots = await readWeeklySnapshots();
  const [rateObservations, cpiObservations] = await Promise.all([
    readObservations(RATE_DATASET_ID, "rate"),
    readObservations(CPI_DATASET_ID, "inflation"),
  ]);

  const registry = {
    registry_version: SOURCE_REGISTRY_VERSION,
    gate_id: GATE_ID,
    denominator_contract: {
      source: "Gate 59 Alpha v1 atom ledger",
      expected_rows: EXPECTED_ROWS,
      expected_weeks: EXPECTED_WEEKS,
      expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    },
    layer_target: {
      cot: "positioning / crowding evidence",
      strength: "price-flow / timing evidence",
      regime: "macro value / moneyflow evidence",
      risk: "only layer allowed to reduce actual traded positions",
    },
    entries: buildRegistry(datasets, manifests, weeklySnapshots),
    no_go: [
      "no_regime_long_short_side",
      "no_pnl",
      "no_attribution",
      "no_alpha_v2",
      "no_risk",
      "no_execution",
      "no_mt5_live",
      "no_app_runtime",
      "no_cot_strength_alpha_v1_gate59_mutation",
      "no_macro_source_row_mutation",
      "no_neutralize_forward_fill_impute_or_skip_missing_macro_rows",
    ],
  };

  const rateSnapshots = buildParentSnapshots({
    alphaWeeks,
    observations: rateObservations,
    dataset: datasets.get(RATE_DATASET_ID) ?? null,
    sourceKey: "rate_parent",
    valueKey: "ratePercent",
  });
  const cpiSnapshots = buildParentSnapshots({
    alphaWeeks,
    observations: cpiObservations,
    dataset: datasets.get(CPI_DATASET_ID) ?? null,
    sourceKey: "cpi_parent",
    valueKey: "inflationYoYPercent",
  });
  const rrpSnapshots = buildRrpSnapshots({ alphaWeeks, rateSnapshots, cpiSnapshots });
  const sourceRows = [...rateSnapshots, ...cpiSnapshots, ...rrpSnapshots].sort((left, right) =>
    left.row_key.localeCompare(right.row_key));
  const joinRows = buildJoinRows(alphaRows, { rateSnapshots, cpiSnapshots, rrpSnapshots });
  const coverage = sourceFamilyCoverage(joinRows);
  const verdict = coverage.rrp_shadow.mapped_rows === EXPECTED_ROWS
    ? "PASS_RRP_ALPHA_WEEK_SHADOW_REBUILD_FULL_COVERAGE__FULL_FAMILY_STILL_BLOCKED"
    : "FAIL_STOP_RRP_ALPHA_WEEK_IRREDUCIBLE_GAPS";

  const outputDenominator = {
    ...denominator,
    output_join_map_rows: joinRows.length,
    dropped_rows: alphaRows.length - joinRows.length,
    duplicate_output_row_keys: countDuplicates(joinRows.map((row) => row.row_key)),
    output_row_keys_match_input_row_keys:
      joinRows.map((row) => row.row_key).join("\n") ===
      [...alphaRows.map((row) => row.row_key)].sort().join("\n"),
  };
  if (
    outputDenominator.output_join_map_rows !== EXPECTED_ROWS ||
    outputDenominator.dropped_rows !== 0 ||
    outputDenominator.duplicate_output_row_keys !== 0
  ) {
    throw new Error(`Gate 60B output invariant failed: ${JSON.stringify(outputDenominator, null, 2)}`);
  }

  const artifactDir = options.artifactDir;
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const registryPath = path.join(artifactDir, "gate60b-regime-source-registry.contract.json");
  const sourceRowsPath = path.join(artifactDir, "gate60b-alpha-week-source-foundation.rows.jsonl");
  const joinRowsPath = path.join(artifactDir, "gate60b-alpha-v1-source-foundation-join-map.rows.jsonl");
  const summaryJsonPath = path.join(artifactDir, "gate60b-regime-source-foundation.summary.json");
  const summaryMdPath = path.join(artifactDir, "gate60b-regime-source-foundation.summary.md");
  const receiptPath = path.join(artifactDir, "gate60b-regime-source-foundation.query-receipt.md");
  const shaPath = path.join(artifactDir, "gate60b-regime-source-foundation.sha256.txt");

  const sourceRegistryHash = sha256Stable(registry);
  const sourceRowsText = `${sourceRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const joinRowsText = `${joinRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const sourceContentInvariantHash = sha256Stable({
    registry_hash: sourceRegistryHash,
    datasets: [...datasets.values()].map((dataset) => ({
      regime_dataset_id: dataset.regime_dataset_id,
      dataset_hash: dataset.dataset_hash,
      dataset_version: dataset.dataset_version,
      snapshot_state: dataset.snapshot_state,
      promotion_manifest_id: dataset.promotion_manifest_id,
      contract_manifest_hash: dataset.contract_manifest_hash,
    })),
    manifest_hash: sha256Stable(manifests),
    rate_observation_hash: sha256Stable(rateObservations),
    cpi_observation_hash: sha256Stable(cpiObservations),
    alpha_week_source_rows_hash: sha256Text(sourceRowsText),
  });
  const joinMapHash = sha256Text(joinRowsText);
  const summary = {
    gate_id: GATE_ID,
    verdict,
    command: COMMAND,
    denominator: outputDenominator,
    source_registry_hash: sourceRegistryHash,
    source_content_invariant_hash: sourceContentInvariantHash,
    join_map_hash: joinMapHash,
    alpha_week_rebuild_version: ALPHA_WEEK_REBUILD_VERSION,
    join_map_version: JOIN_MAP_VERSION,
    rrp_formula_version: RRP_FORMULA_VERSION,
    source_family_coverage: coverage,
    source_rows: {
      total: sourceRows.length,
      rate_parent: rateSnapshots.length,
      cpi_parent: cpiSnapshots.length,
      rrp_shadow: rrpSnapshots.length,
      unavailable: sourceRows.filter((row) => row.value_available !== true).length,
    },
    stop_line:
      "No Regime side, LONG/SHORT macro decisions, P&L, attribution, Alpha v2, risk, execution, MT5/live, app work, COT/Strength/Alpha v1/Gate 59 row changes, or macro source row mutation.",
  };
  const summaryJsonText = `${JSON.stringify(summary, null, 2)}\n`;
  const hashes = {
    gate59_alpha_ledger_jsonl_sha256: sha256Text(await readFile(options.alphaLedgerPath, "utf8")),
    source_registry_hash: sourceRegistryHash,
    source_content_invariant_hash: sourceContentInvariantHash,
    source_rows_jsonl_sha256: sha256Text(sourceRowsText),
    join_map_hash: joinMapHash,
    summary_json_sha256: sha256Text(summaryJsonText),
  };
  const summaryMdText = renderSummaryMarkdown({
    generatedAt,
    verdict,
    denominator: outputDenominator,
    coverage,
    hashes,
  });
  const receiptText = renderReceipt({
    generatedAt,
    gitCommit: gitState.commit,
    dirtyStatus: gitState.dirtyStatus,
    dirtyFiles: gitState.dirtyFiles,
    datasets: [...datasets.values()],
    manifestsRead: manifests.length,
    observationsRead: rateObservations.length + cpiObservations.length,
    weeklySnapshotsRead: weeklySnapshots.length,
    hashes,
  });
  const reportText = renderReport({
    generatedAt,
    verdict,
    denominator: outputDenominator,
    coverage,
    hashes,
  });
  const finalHashes = {
    ...hashes,
    summary_md_sha256: sha256Text(summaryMdText),
    query_receipt_md_sha256: sha256Text(receiptText),
    report_text_sha256: sha256Text(reportText),
  };
  const shaText = [
    "# Gate 60B Regime source foundation identity",
    "",
    `${finalHashes.gate59_alpha_ledger_jsonl_sha256}  ${options.alphaLedgerPath}`,
    `${finalHashes.source_registry_hash}  source_registry_hash`,
    `${finalHashes.source_content_invariant_hash}  source_content_invariant_hash`,
    `${finalHashes.source_rows_jsonl_sha256}  ${sourceRowsPath}`,
    `${finalHashes.join_map_hash}  ${joinRowsPath}`,
    `${finalHashes.summary_json_sha256}  ${summaryJsonPath}`,
    `${finalHashes.summary_md_sha256}  ${summaryMdPath}`,
    `${finalHashes.query_receipt_md_sha256}  ${receiptPath}`,
    `${finalHashes.report_text_sha256}  ${options.reportPath}.report-text`,
    "",
    `combined_hash ${sha256Stable(finalHashes)}`,
    `rebuild_command ${COMMAND}`,
    `source_registry_version ${SOURCE_REGISTRY_VERSION}`,
    `alpha_week_rebuild_version ${ALPHA_WEEK_REBUILD_VERSION}`,
    `join_map_version ${JOIN_MAP_VERSION}`,
    "",
  ].join("\n");

  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  await writeFile(sourceRowsPath, sourceRowsText, "utf8");
  await writeFile(joinRowsPath, joinRowsText, "utf8");
  await writeFile(summaryJsonPath, summaryJsonText, "utf8");
  await writeFile(summaryMdPath, summaryMdText, "utf8");
  await writeFile(receiptPath, receiptText, "utf8");
  await writeFile(options.reportPath, reportText, "utf8");
  await writeFile(shaPath, shaText, "utf8");

  console.log(`Gate 60B verdict: ${verdict}`);
  console.log(`Gate 60B join-map rows: ${joinRows.length}`);
  console.log(`Gate 60B RRP shadow mapped rows: ${coverage.rrp_shadow.mapped_rows}`);
  console.log(`Gate 60B full-family eligible rows: 0`);
  console.log(`Source registry hash: ${sourceRegistryHash}`);
  console.log(`Source content invariant hash: ${sourceContentInvariantHash}`);
  console.log(`Join-map hash: ${joinMapHash}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
  });
