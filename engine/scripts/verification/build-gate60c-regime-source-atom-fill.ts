import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized, query } from "@database/db/client";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 60C: atomized-regime-source-foundation-fill";
const COMMAND = "npm run engine:gate60c:regime-source-atom-fill";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate60c/artifacts/gate60c-regime-source-atom-fill";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate60c/GATE60C_REGIME_SOURCE_ATOM_FILL_2026-06-27.md";
const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const SOURCE_REGISTRY_VERSION = "gate60c_regime_source_registry_v2";
const CURRENCY_ATOM_LEDGER_VERSION = "gate60c_currency_week_source_atom_ledger_v1";
const PAIR_JOIN_LEDGER_VERSION = "gate60c_pair_week_source_atom_join_v1";
const RRP_FORMULA_VERSION = "rrp_percent_v1__nominal_3m_interbank_minus_cpi_yoy";
const VALUATION_GAP_FORMULA_VERSION = null;

const RATE_DATASET_ID = "dcdc850a-80a2-4178-8d08-dd759be6afb8";
const CPI_DATASET_ID = "37b4081b-880e-4ae6-8d53-20ba900dff07";
const RRP_DATASET_ID = "220fd5fd-d017-4db2-bdde-524a3c664c72";
const BPR_DATASET_ID = "01a3b789-2928-4886-a627-eaf5ae689790";
const VALUATION_DATASET_ID = "97266ab2-6feb-4962-936b-a47d73c06684";
const DATASET_IDS = [RATE_DATASET_ID, CPI_DATASET_ID, RRP_DATASET_ID, BPR_DATASET_ID, VALUATION_DATASET_ID];

type SourceFamily = "rate" | "inflation" | "real_rate_pressure" | "bpr" | "valuation";
type SourceState = "ACTIVE" | "SEALED" | "BUILDING" | "QUARANTINED";
type AtomStatus = "FILLED_POINT_IN_TIME" | "FAIL_CLOSED";
type AtomRole = "SEALED_PARENT_ATOM" | "DERIVED_ATOM" | "QUARANTINED_RAW_ATOM" | "RAW_SOURCE_ONLY_ATOM";

type CliOptions = {
  alphaLedgerPath: string;
  artifactDir: string;
  reportPath: string;
};

type AlphaLedgerRow = {
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

type ObservationRecord = {
  regime_dataset_id: string;
  source_family: SourceFamily;
  source_id: string;
  currency: string;
  instrument: string;
  source_observation_id: string;
  observation_date: string;
  effective_at_utc: string;
  available_at_utc: string;
  fetched_at_utc: string | null;
  source_url: string;
  source_hash: string | null;
  raw_value_json: Record<string, unknown>;
  normalized_value_json: Record<string, unknown>;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

type SourceArtifactRecord = {
  regime_dataset_id: string;
  artifact_id: string;
  source_family: SourceFamily;
  source_id: string;
  currency: string;
  endpoint_id: string;
  endpoint_url: string;
  fetched_at_utc: string;
  http_status: number;
  raw_content_type: string;
  raw_payload_sha256: string;
  raw_payload_size_bytes: number;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

type AvailabilityEventRecord = {
  regime_dataset_id: string;
  availability_event_id: string;
  source_family: SourceFamily;
  source_id: string;
  currency: string;
  instrument: string;
  observation_date: string;
  release_or_vintage_id: string | null;
  public_release_at_utc: string | null;
  endpoint_available_at_utc: string | null;
  availability_date: string | null;
  availability_basis: string | null;
  retrieval_capability: string | null;
  availability_precision: string | null;
  eligibility_policy: string | null;
  availability_timezone: string | null;
  availability_evidence_artifact_id: string | null;
  availability_rule_version: string | null;
  availability_confidence: string | null;
  eligible_from_week_open_utc: string | null;
  exception_or_delay_flag: boolean | null;
  coverage: Record<string, unknown>;
  flags: Record<string, unknown>;
};

type AtomDefinition = {
  atom_key:
    | "nominal_rate_3m"
    | "cpi_inflation_yoy"
    | "rrp_derived"
    | "bpr_futures"
    | "bpr_futures_and_options"
    | "ppp"
    | "neer"
    | "reer";
  label: string;
  source_family: SourceFamily;
  dataset_id: string;
  source_state: SourceState;
  atom_role: AtomRole;
  source_id: string | null;
  instrument: string | null;
  value_key: string | null;
  promotion_eligible: boolean;
  required_point_in_time_lineage: boolean;
  source_ambiguity_block: string | null;
  allowed_use: string;
};

type CurrencyWeekAtomRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: string;
  atom_key: AtomDefinition["atom_key"];
  source_family: SourceFamily;
  source_state: SourceState;
  atom_role: AtomRole;
  dataset_id: string;
  dataset_hash: string | null;
  source_id: string | null;
  instrument: string | null;
  status: AtomStatus;
  promotion_eligible: boolean;
  value_available: boolean;
  value_key: string | null;
  value: number | null;
  normalized_value_hash: string | null;
  selected_observation_id: string | null;
  selected_availability_event_id: string | null;
  selected_raw_artifact_ids: string[];
  selected_observation_date: string | null;
  effective_at_utc: string | null;
  available_at_utc: string | null;
  eligible_candidates: number;
  eligibility_reason: string | null;
  source_contract_count: number;
  source_contracts: string[];
  parent_atom_row_keys: string[];
  parent_atom_hashes: string[];
  formula_version: string | null;
  missing: boolean;
  stale: boolean;
  quarantined: boolean;
  source_ambiguous: boolean;
  formula_missing: boolean;
  fail_closed_reasons: string[];
  content_hash: string;
};

type PairWeekAtomJoinRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  symbol: string;
  base: string | null;
  quote: string | null;
  mapped_macro_week_id: string;
  base_atom_hashes: Record<string, string | null>;
  quote_atom_hashes: Record<string, string | null>;
  base_atom_statuses: Record<string, AtomStatus | "MISSING_ATOM_ROW">;
  quote_atom_statuses: Record<string, AtomStatus | "MISSING_ATOM_ROW">;
  base_fail_closed_reasons: string[];
  quote_fail_closed_reasons: string[];
  pair_fail_closed_reasons: string[];
};

const ATOMS: AtomDefinition[] = [
  {
    atom_key: "nominal_rate_3m",
    label: "nominal 3m interbank rate",
    source_family: "rate",
    dataset_id: RATE_DATASET_ID,
    source_state: "SEALED",
    atom_role: "SEALED_PARENT_ATOM",
    source_id: null,
    instrument: "oecd_3m_interbank_rate",
    value_key: "ratePercent",
    promotion_eligible: false,
    required_point_in_time_lineage: true,
    source_ambiguity_block: null,
    allowed_use: "sealed parent atom for source fill and RRP derivation only",
  },
  {
    atom_key: "cpi_inflation_yoy",
    label: "CPI all-items year-over-year inflation",
    source_family: "inflation",
    dataset_id: CPI_DATASET_ID,
    source_state: "SEALED",
    atom_role: "SEALED_PARENT_ATOM",
    source_id: null,
    instrument: "cpi_all_items_yoy",
    value_key: "inflationYoYPercent",
    promotion_eligible: false,
    required_point_in_time_lineage: true,
    source_ambiguity_block: null,
    allowed_use: "sealed parent atom for source fill and RRP derivation only",
  },
  {
    atom_key: "rrp_derived",
    label: "real-rate pressure derived atom",
    source_family: "real_rate_pressure",
    dataset_id: RRP_DATASET_ID,
    source_state: "BUILDING",
    atom_role: "DERIVED_ATOM",
    source_id: null,
    instrument: "rate_minus_cpi",
    value_key: "realRatePressurePercent",
    promotion_eligible: false,
    required_point_in_time_lineage: true,
    source_ambiguity_block: null,
    allowed_use: "derived source atom only; not promoted as Regime parent",
  },
  {
    atom_key: "bpr_futures",
    label: "bank participation futures",
    source_family: "bpr",
    dataset_id: BPR_DATASET_ID,
    source_state: "QUARANTINED",
    atom_role: "QUARANTINED_RAW_ATOM",
    source_id: "cftc_bpr_futures",
    instrument: "bank_participation_futures",
    value_key: "netShareOfGross",
    promotion_eligible: false,
    required_point_in_time_lineage: false,
    source_ambiguity_block: "gate52a_source_ambiguity_quarantine",
    allowed_use: "source existence diagnostics only while quarantine remains binding",
  },
  {
    atom_key: "bpr_futures_and_options",
    label: "bank participation futures and options",
    source_family: "bpr",
    dataset_id: BPR_DATASET_ID,
    source_state: "QUARANTINED",
    atom_role: "QUARANTINED_RAW_ATOM",
    source_id: "cftc_bpr_options",
    instrument: "bank_participation_futures_and_options",
    value_key: "netShareOfGross",
    promotion_eligible: false,
    required_point_in_time_lineage: false,
    source_ambiguity_block: "gate52a_source_ambiguity_quarantine",
    allowed_use: "source existence diagnostics only while quarantine remains binding",
  },
  {
    atom_key: "ppp",
    label: "PPP household final consumption",
    source_family: "valuation",
    dataset_id: VALUATION_DATASET_ID,
    source_state: "BUILDING",
    atom_role: "RAW_SOURCE_ONLY_ATOM",
    source_id: "oecd_table4_ppp_household_final_consumption",
    instrument: "ppp_household_final_consumption_xdc_per_usd",
    value_key: "valuationInputValue",
    promotion_eligible: false,
    required_point_in_time_lineage: true,
    source_ambiguity_block: null,
    allowed_use: "raw valuation atom only; no valuation-gap formula",
  },
  {
    atom_key: "neer",
    label: "BIS broad nominal effective exchange rate",
    source_family: "valuation",
    dataset_id: VALUATION_DATASET_ID,
    source_state: "BUILDING",
    atom_role: "RAW_SOURCE_ONLY_ATOM",
    source_id: "bis_eer_monthly_broad_nominal",
    instrument: "neer_broad_index_2020_100",
    value_key: "valuationInputValue",
    promotion_eligible: false,
    required_point_in_time_lineage: true,
    source_ambiguity_block: null,
    allowed_use: "raw valuation atom only; no valuation-gap formula",
  },
  {
    atom_key: "reer",
    label: "BIS broad real effective exchange rate",
    source_family: "valuation",
    dataset_id: VALUATION_DATASET_ID,
    source_state: "BUILDING",
    atom_role: "RAW_SOURCE_ONLY_ATOM",
    source_id: "bis_eer_monthly_broad_real",
    instrument: "reer_broad_index_2020_100",
    value_key: "valuationInputValue",
    promotion_eligible: false,
    required_point_in_time_lineage: true,
    source_ambiguity_block: null,
    allowed_use: "raw valuation atom only; no valuation-gap formula",
  },
];

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

function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(process.cwd(), filePath)).replaceAll(path.sep, "/");
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

function sourceContractKey(row: Pick<ObservationRecord, "source_family" | "source_id" | "instrument">) {
  return `${row.source_family}|${row.source_id}|${row.instrument}`;
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
    return { eligible: true, reason: "available_before_alpha_week_open" };
  }
  if (availableAt > freezeTargetUtc) {
    return { eligible: false, reason: "available_after_alpha_week_open" };
  }
  const precision = row.coverage.availabilityPrecision;
  const policy = row.coverage.eligibilityPolicy;
  if (
    row.source_family === "rate" &&
    row.coverage.asOfQueryDateEligibleAtFreezeDate === true &&
    policy === "eligible_at_or_before_freeze"
  ) {
    return { eligible: true, reason: "as_of_query_date_matches_alpha_week_open" };
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

function isStale(row: ObservationRecord | null) {
  if (!row) return false;
  return boolValue(row.flags.stale, false) ||
    boolValue(row.coverage.stale, false) ||
    boolValue(row.flags.sourceStale, false) ||
    boolValue(row.coverage.sourceStale, false) ||
    boolValue(row.flags.staleSource, false) ||
    boolValue(row.coverage.staleSource, false);
}

function isSourceAmbiguous(definition: AtomDefinition, row: ObservationRecord | null) {
  if (definition.source_ambiguity_block) return true;
  if (!row) return false;
  if (definition.atom_key === "cpi_inflation_yoy") return false;
  if (definition.atom_key === "nominal_rate_3m") {
    return boolValue(row.flags.latestVintageResearchApproximation, false) ||
      boolValue(row.flags.promotionBlockedUntilPointInTimeAvailability, false) ||
      boolValue(row.coverage.sourceAmbiguous, false) ||
      boolValue(row.flags.sourceAmbiguous, false);
  }
  return boolValue(row.coverage.sourceAmbiguous, false) ||
    boolValue(row.flags.sourceAmbiguous, false);
}

async function readAlphaRows(alphaLedgerPath: string) {
  const text = await readFile(alphaLedgerPath, "utf8");
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as AlphaLedgerRow);
}

async function readDatasets() {
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
  `, [DATASET_IDS]);
  return new Map(rows.map((row) => [row.regime_dataset_id, row]));
}

async function readObservations() {
  return query<ObservationRecord>(`
    SELECT
      regime_dataset_id::text,
      source_family,
      source_id,
      currency,
      instrument,
      source_observation_id,
      observation_date::text,
      to_char(effective_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS effective_at_utc,
      to_char(available_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS available_at_utc,
      CASE WHEN fetched_at_utc IS NULL THEN NULL ELSE to_char(fetched_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS fetched_at_utc,
      source_url,
      source_hash,
      raw_value_json,
      normalized_value_json,
      coverage,
      flags
    FROM research_macro_source_observations
    WHERE regime_dataset_id = ANY($1::uuid[])
      AND currency <> 'ALL'
    ORDER BY regime_dataset_id::text, source_family, source_id, currency, instrument, observation_date, available_at_utc, source_observation_id
  `, [DATASET_IDS]);
}

async function readArtifacts() {
  return query<SourceArtifactRecord>(`
    SELECT
      regime_dataset_id::text,
      artifact_id,
      source_family,
      source_id,
      currency,
      endpoint_id,
      endpoint_url,
      to_char(fetched_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fetched_at_utc,
      http_status,
      raw_content_type,
      raw_payload_sha256,
      raw_payload_size_bytes,
      coverage,
      flags
    FROM research_macro_source_artifacts
    WHERE regime_dataset_id = ANY($1::uuid[])
    ORDER BY regime_dataset_id::text, source_family, source_id, currency, endpoint_id, artifact_id
  `, [DATASET_IDS]);
}

async function readAvailabilityEvents() {
  return query<AvailabilityEventRecord>(`
    SELECT
      regime_dataset_id::text,
      availability_event_id,
      source_family,
      source_id,
      currency,
      instrument,
      observation_date::text,
      release_or_vintage_id,
      CASE WHEN public_release_at_utc IS NULL THEN NULL ELSE to_char(public_release_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS public_release_at_utc,
      CASE WHEN endpoint_available_at_utc IS NULL THEN NULL ELSE to_char(endpoint_available_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS endpoint_available_at_utc,
      availability_date::text,
      availability_basis,
      retrieval_capability,
      availability_precision,
      eligibility_policy,
      availability_timezone,
      availability_evidence_artifact_id,
      availability_rule_version,
      availability_confidence,
      CASE WHEN eligible_from_week_open_utc IS NULL THEN NULL ELSE to_char(eligible_from_week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS eligible_from_week_open_utc,
      exception_or_delay_flag,
      coverage,
      flags
    FROM research_macro_availability_events
    WHERE regime_dataset_id = ANY($1::uuid[])
    ORDER BY regime_dataset_id::text, source_family, source_id, currency, instrument, observation_date, availability_event_id
  `, [DATASET_IDS]);
}

function denominatorProof(alphaRows: AlphaLedgerRow[]) {
  const rowKeys = alphaRows.map((row) => row.row_key);
  const weekSymbolKeys = alphaRows.map((row) => `${row.week.week_open_utc}|${row.instrument.symbol}`);
  const weeks = uniqueSorted(alphaRows.map((row) => row.week.week_open_utc));
  const rawRowsPerWeek = new Map<string, number>();
  const symbolsPerWeek = new Map<string, Set<string>>();
  for (const row of alphaRows) {
    rawRowsPerWeek.set(row.week.week_open_utc, (rawRowsPerWeek.get(row.week.week_open_utc) ?? 0) + 1);
    const symbols = symbolsPerWeek.get(row.week.week_open_utc) ?? new Set<string>();
    symbols.add(row.instrument.symbol);
    symbolsPerWeek.set(row.week.week_open_utc, symbols);
  }
  const symbolHistogram = [...symbolsPerWeek.values()].reduce<Record<string, number>>((counts, symbols) => {
    counts[String(symbols.size)] = (counts[String(symbols.size)] ?? 0) + 1;
    return counts;
  }, {});
  const rawRowHistogram = [...rawRowsPerWeek.values()].reduce<Record<string, number>>((counts, count) => {
    counts[String(count)] = (counts[String(count)] ?? 0) + 1;
    return counts;
  }, {});
  return {
    input_rows: alphaRows.length,
    expected_input_rows: EXPECTED_ROWS,
    alpha_weeks: weeks.length,
    expected_alpha_weeks: EXPECTED_WEEKS,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    symbols_per_week_histogram: symbolHistogram,
    raw_rows_per_week_histogram: rawRowHistogram,
    full_weeks: [...symbolsPerWeek.values()].filter((symbols) => symbols.size === EXPECTED_SYMBOLS_PER_WEEK).length,
    duplicate_input_row_keys: countDuplicates(rowKeys),
    duplicate_input_week_symbol_rows: countDuplicates(weekSymbolKeys),
  };
}

function assertSingleContractPerCurrency(
  observations: ObservationRecord[],
  atom: AtomDefinition,
  expectedCurrencies: string[],
) {
  if (!["nominal_rate_3m", "cpi_inflation_yoy", "ppp", "neer", "reer"].includes(atom.atom_key)) return;
  const failures = expectedCurrencies.flatMap((currency) => {
    const contracts = uniqueSorted(observations
      .filter((row) => row.regime_dataset_id === atom.dataset_id)
      .filter((row) => row.source_family === atom.source_family)
      .filter((row) => row.currency === currency)
      .filter((row) => atom.instrument === null || row.instrument === atom.instrument)
      .filter((row) => atom.source_id === null || row.source_id === atom.source_id)
      .map(sourceContractKey));
    if (contracts.length === 1) return [];
    return [{ atom_key: atom.atom_key, currency, contract_count: contracts.length, contracts }];
  });
  if (failures.length > 0) {
    throw new Error(`Gate 60C source contract invariant failed: ${JSON.stringify(failures, null, 2)}`);
  }
}

function contractRowsForAtom(observations: ObservationRecord[], atom: AtomDefinition, currency: string) {
  return observations
    .filter((row) => row.regime_dataset_id === atom.dataset_id)
    .filter((row) => row.source_family === atom.source_family)
    .filter((row) => row.currency === currency)
    .filter((row) => atom.instrument === null || row.instrument === atom.instrument)
    .filter((row) => atom.source_id === null || row.source_id === atom.source_id)
    .sort(compareObservationSelectionPriority);
}

function buildSourceAtomRows(input: {
  alphaWeeks: string[];
  currencies: string[];
  observations: ObservationRecord[];
  datasets: Map<string, DatasetRecord>;
}) {
  for (const atom of ATOMS) {
    assertSingleContractPerCurrency(input.observations, atom, input.currencies);
  }

  const rows: CurrencyWeekAtomRow[] = [];
  const sourceAtoms = ATOMS.filter((atom) => atom.atom_role !== "DERIVED_ATOM");
  for (const atom of sourceAtoms) {
    const dataset = input.datasets.get(atom.dataset_id) ?? null;
    for (const currency of input.currencies) {
      const contractRows = contractRowsForAtom(input.observations, atom, currency);
      const sourceContracts = uniqueSorted(contractRows.map(sourceContractKey));
      for (const alphaWeekOpenUtc of input.alphaWeeks) {
        const macroWeekId = macroWeekIdFor(alphaWeekOpenUtc);
        const shouldSelect = atom.source_state !== "QUARANTINED";
        const { selected, selectedEligibilityReason, eligibleCandidates } = shouldSelect
          ? selectObservationForFreeze(contractRows, alphaWeekOpenUtc)
          : { selected: null, selectedEligibilityReason: null, eligibleCandidates: 0 };
        const value = selected && atom.value_key ? numberValue(selected.normalized_value_json[atom.value_key]) : null;
        const stale = isStale(selected);
        const quarantined = atom.source_state === "QUARANTINED";
        const sourceAmbiguous = isSourceAmbiguous(atom, selected);
        const missing = sourceContracts.length === 0 || (shouldSelect && !selected);
        const valueAvailable = Boolean(selected && value !== null && boolValue(record(selected.coverage).valueAvailable, true));
        const failClosedReasons = uniqueSorted([
          sourceContracts.length === 0 ? "missing_source_contract" : null,
          shouldSelect && !selected ? "no_observation_available_as_of_alpha_week_open" : null,
          selected && atom.value_key && value === null ? `${atom.value_key}_missing` : null,
          selected && !valueAvailable ? "selected_observation_value_unavailable" : null,
          stale ? "selected_observation_stale" : null,
          sourceAmbiguous ? atom.source_ambiguity_block ?? "source_ambiguous" : null,
          quarantined ? "gate52a_source_ambiguity_quarantine" : null,
        ]);
        const status: AtomStatus = failClosedReasons.length === 0 ? "FILLED_POINT_IN_TIME" : "FAIL_CLOSED";
        const normalizedValueHash = selected ? sha256Stable(selected.normalized_value_json) : null;
        const contentHash = sha256Stable({
          ledger_version: CURRENCY_ATOM_LEDGER_VERSION,
          alpha_week_open_utc: alphaWeekOpenUtc,
          mapped_macro_week_id: macroWeekId,
          currency,
          atom_key: atom.atom_key,
          dataset_id: atom.dataset_id,
          dataset_hash: dataset?.dataset_hash ?? null,
          source_id: selected?.source_id ?? atom.source_id,
          instrument: selected?.instrument ?? atom.instrument,
          selected_observation_id: selectedObservationId(selected),
          selected_availability_event_id: selectedAvailabilityEventId(selected),
          selected_raw_artifact_ids: selectedRawArtifactIds(selected),
          selected_observation_date: selected?.observation_date ?? null,
          value_key: atom.value_key,
          value,
          normalized_value_hash: normalizedValueHash,
          status,
          fail_closed_reasons: failClosedReasons,
        });
        rows.push({
          row_key: `${atom.atom_key}|${alphaWeekOpenUtc}|${currency}`,
          ledger_version: CURRENCY_ATOM_LEDGER_VERSION,
          alpha_week_open_utc: alphaWeekOpenUtc,
          mapped_macro_week_id: macroWeekId,
          currency,
          atom_key: atom.atom_key,
          source_family: atom.source_family,
          source_state: atom.source_state,
          atom_role: atom.atom_role,
          dataset_id: atom.dataset_id,
          dataset_hash: dataset?.dataset_hash ?? null,
          source_id: selected?.source_id ?? atom.source_id,
          instrument: selected?.instrument ?? atom.instrument,
          status,
          promotion_eligible: atom.promotion_eligible,
          value_available: valueAvailable,
          value_key: atom.value_key,
          value,
          normalized_value_hash: normalizedValueHash,
          selected_observation_id: selectedObservationId(selected),
          selected_availability_event_id: selectedAvailabilityEventId(selected),
          selected_raw_artifact_ids: selectedRawArtifactIds(selected),
          selected_observation_date: selected?.observation_date ?? null,
          effective_at_utc: selected?.effective_at_utc ?? null,
          available_at_utc: selected?.available_at_utc ?? null,
          eligible_candidates: eligibleCandidates,
          eligibility_reason: selectedEligibilityReason,
          source_contract_count: sourceContracts.length,
          source_contracts: sourceContracts,
          parent_atom_row_keys: [],
          parent_atom_hashes: [],
          formula_version: null,
          missing,
          stale,
          quarantined,
          source_ambiguous: sourceAmbiguous,
          formula_missing: false,
          fail_closed_reasons: failClosedReasons,
          content_hash: contentHash,
        });
      }
    }
  }
  return rows;
}

function buildDerivedRrpRows(sourceRows: CurrencyWeekAtomRow[], alphaWeeks: string[], currencies: string[], datasets: Map<string, DatasetRecord>) {
  const rateByWeekCurrency = new Map(sourceRows
    .filter((row) => row.atom_key === "nominal_rate_3m")
    .map((row) => [`${row.alpha_week_open_utc}|${row.currency}`, row]));
  const cpiByWeekCurrency = new Map(sourceRows
    .filter((row) => row.atom_key === "cpi_inflation_yoy")
    .map((row) => [`${row.alpha_week_open_utc}|${row.currency}`, row]));
  const atom = ATOMS.find((definition) => definition.atom_key === "rrp_derived")!;
  const dataset = datasets.get(RRP_DATASET_ID) ?? null;
  const rows: CurrencyWeekAtomRow[] = [];
  for (const currency of currencies) {
    for (const alphaWeekOpenUtc of alphaWeeks) {
      const macroWeekId = macroWeekIdFor(alphaWeekOpenUtc);
      const rate = rateByWeekCurrency.get(`${alphaWeekOpenUtc}|${currency}`) ?? null;
      const cpi = cpiByWeekCurrency.get(`${alphaWeekOpenUtc}|${currency}`) ?? null;
      const reasons = uniqueSorted([
        rate ? null : "missing_rate_parent_atom",
        cpi ? null : "missing_cpi_parent_atom",
        rate && rate.status !== "FILLED_POINT_IN_TIME" ? `rate_parent_${rate.fail_closed_reasons.join("+") || "fail_closed"}` : null,
        cpi && cpi.status !== "FILLED_POINT_IN_TIME" ? `cpi_parent_${cpi.fail_closed_reasons.join("+") || "fail_closed"}` : null,
        rate && rate.value === null ? "rate_parent_value_missing" : null,
        cpi && cpi.value === null ? "cpi_parent_value_missing" : null,
      ]);
      const valueAvailable = reasons.length === 0;
      const value = valueAvailable && rate?.value !== null && cpi?.value !== null && rate && cpi
        ? rate.value - cpi.value
        : null;
      const normalizedValueHash = valueAvailable
        ? sha256Stable({
            realRatePressurePercent: value,
            ratePercent: rate?.value ?? null,
            inflationYoYPercent: cpi?.value ?? null,
          })
        : null;
      const contentHash = sha256Stable({
        ledger_version: CURRENCY_ATOM_LEDGER_VERSION,
        formula_version: RRP_FORMULA_VERSION,
        alpha_week_open_utc: alphaWeekOpenUtc,
        mapped_macro_week_id: macroWeekId,
        currency,
        rate_parent_hash: rate?.content_hash ?? null,
        cpi_parent_hash: cpi?.content_hash ?? null,
        rate_parent_observation_id: rate?.selected_observation_id ?? null,
        cpi_parent_observation_id: cpi?.selected_observation_id ?? null,
        value,
        value_available: valueAvailable,
        fail_closed_reasons: reasons,
      });
      rows.push({
        row_key: `${atom.atom_key}|${alphaWeekOpenUtc}|${currency}`,
        ledger_version: CURRENCY_ATOM_LEDGER_VERSION,
        alpha_week_open_utc: alphaWeekOpenUtc,
        mapped_macro_week_id: macroWeekId,
        currency,
        atom_key: atom.atom_key,
        source_family: atom.source_family,
        source_state: atom.source_state,
        atom_role: atom.atom_role,
        dataset_id: RRP_DATASET_ID,
        dataset_hash: dataset?.dataset_hash ?? null,
        source_id: "derived_from_rate_and_cpi",
        instrument: atom.instrument,
        status: reasons.length === 0 ? "FILLED_POINT_IN_TIME" : "FAIL_CLOSED",
        promotion_eligible: false,
        value_available: valueAvailable,
        value_key: atom.value_key,
        value,
        normalized_value_hash: normalizedValueHash,
        selected_observation_id: null,
        selected_availability_event_id: null,
        selected_raw_artifact_ids: [],
        selected_observation_date: null,
        effective_at_utc: null,
        available_at_utc: null,
        eligible_candidates: 0,
        eligibility_reason: "derived_from_filled_rate_and_cpi_parent_atoms",
        source_contract_count: 0,
        source_contracts: [],
        parent_atom_row_keys: [rate?.row_key ?? "missing_rate_parent_atom", cpi?.row_key ?? "missing_cpi_parent_atom"],
        parent_atom_hashes: [rate?.content_hash ?? "missing_rate_parent_atom", cpi?.content_hash ?? "missing_cpi_parent_atom"],
        formula_version: RRP_FORMULA_VERSION,
        missing: reasons.length > 0,
        stale: Boolean(rate?.stale || cpi?.stale),
        quarantined: false,
        source_ambiguous: Boolean(rate?.source_ambiguous || cpi?.source_ambiguous),
        formula_missing: false,
        fail_closed_reasons: reasons,
        content_hash: contentHash,
      });
    }
  }
  return rows;
}

function atomFailureReasons(row: CurrencyWeekAtomRow | null, prefix: string) {
  if (!row) return [`${prefix}_missing_atom_row`];
  return row.fail_closed_reasons.map((reason) => `${prefix}_${row.atom_key}_${reason}`);
}

function atomStatus(row: CurrencyWeekAtomRow | null) {
  return row?.status ?? "MISSING_ATOM_ROW";
}

function atomHash(row: CurrencyWeekAtomRow | null) {
  return row?.content_hash ?? null;
}

function buildPairJoinLedger(alphaRows: AlphaLedgerRow[], atomRows: CurrencyWeekAtomRow[]) {
  const atomByWeekCurrency = new Map(atomRows.map((row) => [`${row.alpha_week_open_utc}|${row.currency}|${row.atom_key}`, row]));
  const atomKeys = ATOMS.map((atom) => atom.atom_key).sort();
  return alphaRows.map((alpha): PairWeekAtomJoinRow => {
    const week = alpha.week.week_open_utc;
    const base = alpha.instrument.base_currency;
    const quote = alpha.instrument.quote_currency;
    const baseAtoms = Object.fromEntries(atomKeys.map((atomKey) => [
      atomKey,
      base ? atomByWeekCurrency.get(`${week}|${base}|${atomKey}`) ?? null : null,
    ]));
    const quoteAtoms = Object.fromEntries(atomKeys.map((atomKey) => [
      atomKey,
      quote ? atomByWeekCurrency.get(`${week}|${quote}|${atomKey}`) ?? null : null,
    ]));
    const baseFailClosedReasons = uniqueSorted(atomKeys.flatMap((atomKey) =>
      atomFailureReasons(baseAtoms[atomKey] as CurrencyWeekAtomRow | null, "base")));
    const quoteFailClosedReasons = uniqueSorted(atomKeys.flatMap((atomKey) =>
      atomFailureReasons(quoteAtoms[atomKey] as CurrencyWeekAtomRow | null, "quote")));
    return {
      row_key: alpha.row_key,
      ledger_version: PAIR_JOIN_LEDGER_VERSION,
      alpha_week_open_utc: week,
      symbol: alpha.instrument.symbol,
      base,
      quote,
      mapped_macro_week_id: macroWeekIdFor(week),
      base_atom_hashes: Object.fromEntries(atomKeys.map((atomKey) => [
        atomKey,
        atomHash(baseAtoms[atomKey] as CurrencyWeekAtomRow | null),
      ])),
      quote_atom_hashes: Object.fromEntries(atomKeys.map((atomKey) => [
        atomKey,
        atomHash(quoteAtoms[atomKey] as CurrencyWeekAtomRow | null),
      ])),
      base_atom_statuses: Object.fromEntries(atomKeys.map((atomKey) => [
        atomKey,
        atomStatus(baseAtoms[atomKey] as CurrencyWeekAtomRow | null),
      ])),
      quote_atom_statuses: Object.fromEntries(atomKeys.map((atomKey) => [
        atomKey,
        atomStatus(quoteAtoms[atomKey] as CurrencyWeekAtomRow | null),
      ])),
      base_fail_closed_reasons: baseFailClosedReasons,
      quote_fail_closed_reasons: quoteFailClosedReasons,
      pair_fail_closed_reasons: uniqueSorted([...baseFailClosedReasons, ...quoteFailClosedReasons]),
    };
  }).sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function buildSourceRegistry(datasets: Map<string, DatasetRecord>, observations: ObservationRecord[]) {
  const rawContractCount = (atom: AtomDefinition) => uniqueSorted(observations
    .filter((row) => row.regime_dataset_id === atom.dataset_id)
    .filter((row) => row.source_family === atom.source_family)
    .filter((row) => atom.source_id === null || row.source_id === atom.source_id)
    .filter((row) => atom.instrument === null || row.instrument === atom.instrument)
    .map((row) => `${row.currency}|${sourceContractKey(row)}`)).length;
  return {
    registry_version: SOURCE_REGISTRY_VERSION,
    gate_id: GATE_ID,
    denominator_contract: {
      source: "Gate 59 Alpha v1 atom ledger",
      expected_rows: EXPECTED_ROWS,
      expected_weeks: EXPECTED_WEEKS,
      expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    },
    source_existence_vs_promotion: {
      source_existence: "raw observations, source artifacts, and availability events can exist without promotion eligibility",
      promotion_eligibility: "only explicitly ACTIVE Regime feature bundles may later produce a Regime side; Gate 60C produces none",
    },
    atom_contracts: ATOMS.map((atom) => {
      const dataset = datasets.get(atom.dataset_id) ?? null;
      return {
        ...atom,
        valuation_gap_formula_version: atom.source_family === "valuation" ? VALUATION_GAP_FORMULA_VERSION : null,
        raw_source_exists: rawContractCount(atom) > 0 || atom.atom_role === "DERIVED_ATOM",
        raw_contract_count: rawContractCount(atom),
        dataset_hash: dataset?.dataset_hash ?? null,
        dataset_status: dataset?.status ?? null,
        dataset_snapshot_state: dataset?.snapshot_state ?? null,
        promotion_manifest_id: dataset?.promotion_manifest_id ?? null,
        contract_manifest_hash: dataset?.contract_manifest_hash ?? null,
      };
    }),
    derived_contracts: [
      {
        atom_key: "rrp_derived",
        formula_version: RRP_FORMULA_VERSION,
        parents: ["nominal_rate_3m", "cpi_inflation_yoy"],
        promoted_regime_parent: false,
      },
      {
        atom_key: "valuation_gap",
        formula_version: VALUATION_GAP_FORMULA_VERSION,
        parents: ["ppp", "neer", "reer"],
        emitted_in_atom_ledger: false,
        fail_closed_reason: "valuation_gap_formula_not_versioned",
      },
    ],
    no_go: [
      "no_regime_side",
      "no_macro_long_short_decisions",
      "no_support_oppose_fade_labels",
      "no_pnl",
      "no_attribution_matrix",
      "no_alpha_v2",
      "no_risk_execution_mt5_live_app",
      "no_cot_strength_alpha_v1_gate59_mutation",
      "no_macro_source_row_mutation",
      "no_neutralizing_imputing_forward_filling_or_skipping_unavailable_rows",
    ],
  };
}

function sourceArtifactHashMapRows(rows: SourceArtifactRecord[]) {
  return rows.map((row) => ({
    map_key: `${row.regime_dataset_id}|${row.artifact_id}`,
    content_hash: sha256Stable(row),
    regime_dataset_id: row.regime_dataset_id,
    artifact_id: row.artifact_id,
    source_family: row.source_family,
    source_id: row.source_id,
    currency: row.currency,
    endpoint_id: row.endpoint_id,
    fetched_at_utc: row.fetched_at_utc,
    http_status: row.http_status,
    raw_content_type: row.raw_content_type,
    raw_payload_sha256: row.raw_payload_sha256,
    raw_payload_size_bytes: row.raw_payload_size_bytes,
    coverage_hash: sha256Stable(row.coverage),
    flags_hash: sha256Stable(row.flags),
  })).sort((left, right) => left.map_key.localeCompare(right.map_key));
}

function rawObservationHashMapRows(rows: ObservationRecord[]) {
  return rows.map((row) => ({
    map_key: `${row.regime_dataset_id}|${row.source_observation_id}`,
    content_hash: sha256Stable(row),
    regime_dataset_id: row.regime_dataset_id,
    source_observation_id: row.source_observation_id,
    source_family: row.source_family,
    source_id: row.source_id,
    currency: row.currency,
    instrument: row.instrument,
    observation_date: row.observation_date,
    effective_at_utc: row.effective_at_utc,
    available_at_utc: row.available_at_utc,
    fetched_at_utc: row.fetched_at_utc,
    source_hash: row.source_hash,
    raw_value_hash: sha256Stable(row.raw_value_json),
    normalized_value_hash: sha256Stable(row.normalized_value_json),
    coverage_hash: sha256Stable(row.coverage),
    flags_hash: sha256Stable(row.flags),
  })).sort((left, right) => left.map_key.localeCompare(right.map_key));
}

function availabilityEventHashMapRows(rows: AvailabilityEventRecord[]) {
  return rows.map((row) => ({
    map_key: `${row.regime_dataset_id}|${row.availability_event_id}`,
    content_hash: sha256Stable(row),
    regime_dataset_id: row.regime_dataset_id,
    availability_event_id: row.availability_event_id,
    source_family: row.source_family,
    source_id: row.source_id,
    currency: row.currency,
    instrument: row.instrument,
    observation_date: row.observation_date,
    public_release_at_utc: row.public_release_at_utc,
    endpoint_available_at_utc: row.endpoint_available_at_utc,
    availability_date: row.availability_date,
    availability_basis: row.availability_basis,
    retrieval_capability: row.retrieval_capability,
    availability_precision: row.availability_precision,
    eligibility_policy: row.eligibility_policy,
    availability_evidence_artifact_id: row.availability_evidence_artifact_id,
    availability_rule_version: row.availability_rule_version,
    availability_confidence: row.availability_confidence,
    eligible_from_week_open_utc: row.eligible_from_week_open_utc,
    exception_or_delay_flag: row.exception_or_delay_flag,
    coverage_hash: sha256Stable(row.coverage),
    flags_hash: sha256Stable(row.flags),
  })).sort((left, right) => left.map_key.localeCompare(right.map_key));
}

function buildLineageMap(atomRows: CurrencyWeekAtomRow[]) {
  const rrpRows = atomRows.filter((row) => row.atom_key === "rrp_derived");
  return {
    lineage_map_version: "gate60c_parent_derived_lineage_map_v1",
    rrp_derived: rrpRows.map((row) => ({
      row_key: row.row_key,
      alpha_week_open_utc: row.alpha_week_open_utc,
      currency: row.currency,
      formula_version: row.formula_version,
      parent_atom_row_keys: row.parent_atom_row_keys,
      parent_atom_hashes: row.parent_atom_hashes,
      status: row.status,
      fail_closed_reasons: row.fail_closed_reasons,
      content_hash: row.content_hash,
    })),
    valuation_gap: {
      emitted_in_atom_ledger: false,
      formula_version: VALUATION_GAP_FORMULA_VERSION,
      parent_atoms: ["ppp", "neer", "reer"],
      fail_closed_reason: "valuation_gap_formula_not_versioned",
    },
  };
}

function buildAvailabilityReport(atomRows: CurrencyWeekAtomRow[], pairRows: PairWeekAtomJoinRow[]) {
  const byAtom = ATOMS.map((atom) => {
    const rows = atomRows.filter((row) => row.atom_key === atom.atom_key);
    const reasonCounts = rows.flatMap((row) => row.fail_closed_reasons).reduce<Record<string, number>>((counts, reason) => {
      counts[reason] = (counts[reason] ?? 0) + 1;
      return counts;
    }, {});
    return {
      atom_key: atom.atom_key,
      source_state: atom.source_state,
      rows: rows.length,
      filled_point_in_time_rows: rows.filter((row) => row.status === "FILLED_POINT_IN_TIME").length,
      fail_closed_rows: rows.filter((row) => row.status === "FAIL_CLOSED").length,
      missing_rows: rows.filter((row) => row.missing).length,
      stale_rows: rows.filter((row) => row.stale).length,
      quarantined_rows: rows.filter((row) => row.quarantined).length,
      source_ambiguous_rows: rows.filter((row) => row.source_ambiguous).length,
      formula_missing_rows: rows.filter((row) => row.formula_missing).length,
      fail_closed_reason_counts: reasonCounts,
    };
  });
  return {
    report_version: "gate60c_missing_stale_quarantine_source_ambiguity_report_v1",
    currency_atom_rows: atomRows.length,
    pair_join_rows: pairRows.length,
    pair_rows_with_any_fail_closed_atom: pairRows.filter((row) => row.pair_fail_closed_reasons.length > 0).length,
    by_atom: byAtom,
  };
}

function renderSummaryMarkdown(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  availabilityReport: ReturnType<typeof buildAvailabilityReport>;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60C Regime Source Atom Fill Summary",
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
    "## Atom Coverage",
    "",
    "| Atom | State | Rows | Filled | Fail-closed | Missing | Stale | Quarantined | Source ambiguous |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...input.availabilityReport.by_atom.map((row) =>
      `| ${row.atom_key} | ${row.source_state} | ${row.rows} | ${row.filled_point_in_time_rows} | ${row.fail_closed_rows} | ${row.missing_rows} | ${row.stale_rows} | ${row.quarantined_rows} | ${row.source_ambiguous_rows} |`),
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
  observationsRead: number;
  artifactsRead: number;
  availabilityEventsRead: number;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60C Query/Rebuild Receipt",
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
    ...input.datasets.map((dataset) =>
      `| ${dataset.regime_dataset_id} | ${dataset.snapshot_state} | ${dataset.status} | ${dataset.promotion_manifest_id ?? "-"} | ${dataset.contract_manifest_hash ?? "-"} |`),
    "",
    "## Probe/Rebuild Counts",
    "",
    `- Source observations read: \`${input.observationsRead}\``,
    `- Source artifacts read: \`${input.artifactsRead}\``,
    `- Availability events read: \`${input.availabilityEventsRead}\``,
    `- Source registry hash: \`${input.hashes.source_registry_hash}\``,
    `- Source content invariant hash: \`${input.hashes.source_content_invariant_hash}\``,
    `- Currency atom ledger hash: \`${input.hashes.currency_week_atom_ledger_hash}\``,
    `- Pair join ledger hash: \`${input.hashes.pair_week_atom_join_ledger_hash}\``,
    "",
    "## Boundary",
    "",
    "Read-only database probe and non-mutating source atom fill against the frozen Gate 59 Alpha v1 denominator. No Regime side, macro LONG/SHORT decisions, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation was run.",
    "",
  ].join("\n");
}

function renderReport(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  availabilityReport: ReturnType<typeof buildAvailabilityReport>;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60C Regime Source Atom Fill",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Verdict",
    "",
    `\`${input.verdict}\``,
    "",
    "Gate 60C fills source atoms against the frozen Gate 59 Alpha v1 denominator. It emits no Regime side, no macro LONG/SHORT decisions, no support/oppose/fade labels, no P&L, no attribution matrix, no Alpha v2, and no risk/execution/MT5/live/app work.",
    "",
    "## Contract",
    "",
    `Source registry version: \`${SOURCE_REGISTRY_VERSION}\``,
    "",
    "- Rate and CPI are SEALED parent atoms.",
    "- RRP is a derived atom from rate and CPI only; it is not promoted as the Regime parent.",
    "- BPR futures and futures/options atoms remain QUARANTINED under Gate 52A.",
    "- PPP, NEER, and REER are BUILDING raw/source-only valuation atoms.",
    "- Valuation-gap is not emitted because no valuation-gap formula is versioned.",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(input.denominator, null, 2),
    "```",
    "",
    "## Atom Fill Result",
    "",
    "| Atom | State | Rows | Filled | Fail-closed | Missing | Stale | Quarantined | Source ambiguous |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...input.availabilityReport.by_atom.map((row) =>
      `| ${row.atom_key} | ${row.source_state} | ${row.rows} | ${row.filled_point_in_time_rows} | ${row.fail_closed_rows} | ${row.missing_rows} | ${row.stale_rows} | ${row.quarantined_rows} | ${row.source_ambiguous_rows} |`),
    "",
    "## Hashes",
    "",
    "```json",
    JSON.stringify(input.hashes, null, 2),
    "```",
    "",
    "## Stop Line",
    "",
    "Stop here. Do not proceed to RRP promotion, Regime shadow-signal construction, macro LONG/SHORT decisions, support/oppose/fade labels, P&L, attribution, strategy tests, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation.",
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
    denominator.duplicate_input_row_keys !== 0 ||
    denominator.duplicate_input_week_symbol_rows !== 0
  ) {
    throw new Error(`Gate 60C denominator invariant failed: ${JSON.stringify(denominator, null, 2)}`);
  }

  const alphaWeeks = uniqueSorted(alphaRows.map((row) => row.week.week_open_utc));
  const alphaCurrencies = uniqueSorted(alphaRows.flatMap((row) => [
    row.instrument.base_currency,
    row.instrument.quote_currency,
  ]));

  const [datasets, observations, artifacts, availabilityEvents] = await Promise.all([
    readDatasets(),
    readObservations(),
    readArtifacts(),
    readAvailabilityEvents(),
  ]);

  const sourceRows = buildSourceAtomRows({
    alphaWeeks,
    currencies: alphaCurrencies,
    observations,
    datasets,
  });
  const rrpRows = buildDerivedRrpRows(sourceRows, alphaWeeks, alphaCurrencies, datasets);
  const atomRows = [...sourceRows, ...rrpRows].sort((left, right) => left.row_key.localeCompare(right.row_key));
  const pairRows = buildPairJoinLedger(alphaRows, atomRows);
  const registry = buildSourceRegistry(datasets, observations);
  const artifactHashMap = sourceArtifactHashMapRows(artifacts);
  const rawObservationHashMap = rawObservationHashMapRows(observations);
  const availabilityEventHashMap = availabilityEventHashMapRows(availabilityEvents);
  const lineageMap = buildLineageMap(atomRows);
  const availabilityReport = buildAvailabilityReport(atomRows, pairRows);
  const outputDenominator = {
    ...denominator,
    output_pair_join_rows: pairRows.length,
    dropped_pair_rows: alphaRows.length - pairRows.length,
    duplicate_output_pair_row_keys: countDuplicates(pairRows.map((row) => row.row_key)),
    currency_week_atom_rows: atomRows.length,
    expected_currency_week_atom_rows: alphaWeeks.length * alphaCurrencies.length * ATOMS.length,
    duplicate_currency_atom_row_keys: countDuplicates(atomRows.map((row) => row.row_key)),
  };
  if (
    outputDenominator.output_pair_join_rows !== EXPECTED_ROWS ||
    outputDenominator.dropped_pair_rows !== 0 ||
    outputDenominator.duplicate_output_pair_row_keys !== 0 ||
    outputDenominator.currency_week_atom_rows !== outputDenominator.expected_currency_week_atom_rows ||
    outputDenominator.duplicate_currency_atom_row_keys !== 0
  ) {
    throw new Error(`Gate 60C output invariant failed: ${JSON.stringify(outputDenominator, null, 2)}`);
  }

  const verdict = "PASS_SOURCE_ATOM_FILL_WITH_EXPLICIT_FAIL_CLOSED_ROWS__NO_REGIME_SIDE";

  const artifactDir = options.artifactDir;
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const registryPath = path.join(artifactDir, "gate60c-regime-source-registry-v2.contract.json");
  const atomRowsPath = path.join(artifactDir, "gate60c-currency-week-source-atom-ledger.rows.jsonl");
  const pairRowsPath = path.join(artifactDir, "gate60c-pair-week-source-atom-join-ledger.rows.jsonl");
  const artifactHashMapPath = path.join(artifactDir, "gate60c-source-artifact-hash-map.json");
  const rawObservationHashMapPath = path.join(artifactDir, "gate60c-raw-observation-hash-map.json");
  const availabilityEventHashMapPath = path.join(artifactDir, "gate60c-availability-event-hash-map.json");
  const lineageMapPath = path.join(artifactDir, "gate60c-parent-derived-lineage-map.json");
  const availabilityReportPath = path.join(artifactDir, "gate60c-missing-stale-quarantine-source-ambiguity-report.json");
  const summaryJsonPath = path.join(artifactDir, "gate60c-regime-source-atom-fill.summary.json");
  const summaryMdPath = path.join(artifactDir, "gate60c-regime-source-atom-fill.summary.md");
  const receiptPath = path.join(artifactDir, "gate60c-regime-source-atom-fill.query-receipt.md");
  const shaPath = path.join(artifactDir, "gate60c-regime-source-atom-fill.sha256.txt");

  const registryText = `${JSON.stringify(registry, null, 2)}\n`;
  const atomRowsText = `${atomRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const pairRowsText = `${pairRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const artifactHashMapText = `${JSON.stringify(artifactHashMap)}\n`;
  const rawObservationHashMapText = `${JSON.stringify(rawObservationHashMap)}\n`;
  const availabilityEventHashMapText = `${JSON.stringify(availabilityEventHashMap)}\n`;
  const lineageMapText = `${JSON.stringify(lineageMap)}\n`;
  const availabilityReportText = `${JSON.stringify(availabilityReport, null, 2)}\n`;

  const hashes = {
    gate59_alpha_ledger_jsonl_sha256: sha256Text(await readFile(options.alphaLedgerPath, "utf8")),
    source_registry_hash: sha256Stable(registry),
    currency_week_atom_ledger_hash: sha256Text(atomRowsText),
    pair_week_atom_join_ledger_hash: sha256Text(pairRowsText),
    source_artifact_hash_map_hash: sha256Text(artifactHashMapText),
    raw_observation_hash_map_hash: sha256Text(rawObservationHashMapText),
    availability_event_hash_map_hash: sha256Text(availabilityEventHashMapText),
    parent_derived_lineage_map_hash: sha256Text(lineageMapText),
    availability_report_hash: sha256Text(availabilityReportText),
    source_content_invariant_hash: sha256Stable({
      registry_hash: sha256Stable(registry),
      dataset_hashes: [...datasets.values()].map((dataset) => ({
        regime_dataset_id: dataset.regime_dataset_id,
        dataset_version: dataset.dataset_version,
        dataset_hash: dataset.dataset_hash,
        snapshot_state: dataset.snapshot_state,
        promotion_manifest_id: dataset.promotion_manifest_id,
        contract_manifest_hash: dataset.contract_manifest_hash,
      })),
      artifact_hash_map_hash: sha256Text(artifactHashMapText),
      raw_observation_hash_map_hash: sha256Text(rawObservationHashMapText),
      availability_event_hash_map_hash: sha256Text(availabilityEventHashMapText),
      currency_week_atom_ledger_hash: sha256Text(atomRowsText),
      pair_week_atom_join_ledger_hash: sha256Text(pairRowsText),
    }),
  };
  const summary = {
    gate_id: GATE_ID,
    verdict,
    command: COMMAND,
    denominator: outputDenominator,
    source_registry_version: SOURCE_REGISTRY_VERSION,
    currency_atom_ledger_version: CURRENCY_ATOM_LEDGER_VERSION,
    pair_join_ledger_version: PAIR_JOIN_LEDGER_VERSION,
    rrp_formula_version: RRP_FORMULA_VERSION,
    valuation_gap_formula_version: VALUATION_GAP_FORMULA_VERSION,
    atom_coverage: availabilityReport,
    hashes,
    stop_line:
      "No RRP promotion, Regime side, macro LONG/SHORT decisions, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app work, COT/Strength/Alpha v1/Gate59 mutation, or macro source row mutation.",
  };
  const summaryJsonText = `${JSON.stringify(summary, null, 2)}\n`;
  const summaryMdText = renderSummaryMarkdown({
    generatedAt,
    verdict,
    denominator: outputDenominator,
    availabilityReport,
    hashes,
  });
  const receiptText = renderReceipt({
    generatedAt,
    gitCommit: gitState.commit,
    dirtyStatus: gitState.dirtyStatus,
    dirtyFiles: gitState.dirtyFiles,
    datasets: [...datasets.values()],
    observationsRead: observations.length,
    artifactsRead: artifacts.length,
    availabilityEventsRead: availabilityEvents.length,
    hashes,
  });
  const reportText = renderReport({
    generatedAt,
    verdict,
    denominator: outputDenominator,
    availabilityReport,
    hashes,
  });
  const finalHashes = {
    ...hashes,
    summary_json_sha256: sha256Text(summaryJsonText),
    summary_md_sha256: sha256Text(summaryMdText),
    query_receipt_md_sha256: sha256Text(receiptText),
    report_text_sha256: sha256Text(reportText),
  };
  const shaText = [
    "# Gate 60C Regime source atom fill identity",
    "",
    `${finalHashes.gate59_alpha_ledger_jsonl_sha256}  ${toRepoRelative(options.alphaLedgerPath)}`,
    `${finalHashes.source_registry_hash}  source_registry_hash`,
    `${finalHashes.source_content_invariant_hash}  source_content_invariant_hash`,
    `${finalHashes.currency_week_atom_ledger_hash}  ${toRepoRelative(atomRowsPath)}`,
    `${finalHashes.pair_week_atom_join_ledger_hash}  ${toRepoRelative(pairRowsPath)}`,
    `${finalHashes.source_artifact_hash_map_hash}  ${toRepoRelative(artifactHashMapPath)}`,
    `${finalHashes.raw_observation_hash_map_hash}  ${toRepoRelative(rawObservationHashMapPath)}`,
    `${finalHashes.availability_event_hash_map_hash}  ${toRepoRelative(availabilityEventHashMapPath)}`,
    `${finalHashes.parent_derived_lineage_map_hash}  ${toRepoRelative(lineageMapPath)}`,
    `${finalHashes.availability_report_hash}  ${toRepoRelative(availabilityReportPath)}`,
    `${finalHashes.summary_json_sha256}  ${toRepoRelative(summaryJsonPath)}`,
    `${finalHashes.summary_md_sha256}  ${toRepoRelative(summaryMdPath)}`,
    `${finalHashes.query_receipt_md_sha256}  ${toRepoRelative(receiptPath)}`,
    `${finalHashes.report_text_sha256}  ${toRepoRelative(options.reportPath)}.report-text`,
    "",
    `combined_hash ${sha256Stable(finalHashes)}`,
    `rebuild_command ${COMMAND}`,
    `source_registry_version ${SOURCE_REGISTRY_VERSION}`,
    `currency_atom_ledger_version ${CURRENCY_ATOM_LEDGER_VERSION}`,
    `pair_join_ledger_version ${PAIR_JOIN_LEDGER_VERSION}`,
    `rrp_formula_version ${RRP_FORMULA_VERSION}`,
    `valuation_gap_formula_version ${VALUATION_GAP_FORMULA_VERSION ?? "not_versioned"}`,
    "",
  ].join("\n");

  await writeFile(registryPath, registryText, "utf8");
  await writeFile(atomRowsPath, atomRowsText, "utf8");
  await writeFile(pairRowsPath, pairRowsText, "utf8");
  await writeFile(artifactHashMapPath, artifactHashMapText, "utf8");
  await writeFile(rawObservationHashMapPath, rawObservationHashMapText, "utf8");
  await writeFile(availabilityEventHashMapPath, availabilityEventHashMapText, "utf8");
  await writeFile(lineageMapPath, lineageMapText, "utf8");
  await writeFile(availabilityReportPath, availabilityReportText, "utf8");
  await writeFile(summaryJsonPath, summaryJsonText, "utf8");
  await writeFile(summaryMdPath, summaryMdText, "utf8");
  await writeFile(receiptPath, receiptText, "utf8");
  await writeFile(options.reportPath, reportText, "utf8");
  await writeFile(shaPath, shaText, "utf8");

  console.log(`Gate 60C verdict: ${verdict}`);
  console.log(`Gate 60C pair join rows: ${pairRows.length}`);
  console.log(`Gate 60C currency-week atom rows: ${atomRows.length}`);
  console.log(`Source registry hash: ${hashes.source_registry_hash}`);
  console.log(`Source content invariant hash: ${hashes.source_content_invariant_hash}`);
  console.log(`Pair join ledger hash: ${hashes.pair_week_atom_join_ledger_hash}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized().catch(() => {});
  });
