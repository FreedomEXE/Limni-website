import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized, query } from "@database/db/client";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 60D: bpr-source-eligibility";
const COMMAND = "npm run engine:gate60d:bpr-source-eligibility";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate60d/GATE60D_BPR_SOURCE_ELIGIBILITY_2026-06-27.md";
const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const BPR_DATASET_ID = "01a3b789-2928-4886-a627-eaf5ae689790";
const SOURCE_REGISTRY_VERSION = "gate60d_bpr_source_registry_v2";
const PUBLICATION_TIMING_PROOF_VERSION = "gate60d_bpr_publication_timing_proof_v1";
const CURRENCY_ATOM_LEDGER_VERSION = "gate60d_bpr_currency_week_atom_ledger_v1";
const FAIL_CLOSED_REPORT_VERSION = "gate60d_bpr_fail_closed_quarantine_report_v1";

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
  source_family: "bpr";
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
  source_family: "bpr";
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
  source_family: "bpr";
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

type BprContract = {
  atom_key: "bpr_futures" | "bpr_futures_and_options";
  label: string;
  source_id: "cftc_bpr_futures" | "cftc_bpr_options";
  instrument: "bank_participation_futures" | "bank_participation_futures_and_options";
  value_key: "netShareOfGross";
};

type PublicationTimingProofRow = {
  row_key: string;
  proof_version: string;
  dataset_id: string;
  source_id: string;
  instrument: string;
  currency: string;
  observation_date: string;
  selected_observation_id: string;
  availability_event_id: string | null;
  raw_artifact_ids: string[];
  availability_evidence_artifact_id: string | null;
  available_at_utc: string | null;
  endpoint_available_at_utc: string | null;
  source_eligible_from_week_open_utc: string | null;
  availability_basis: string | null;
  retrieval_capability: string | null;
  availability_precision: string | null;
  eligibility_policy: string | null;
  availability_confidence: string | null;
  availability_rule_version: string | null;
  exception_or_delay_flag: boolean | null;
  source_flags: Record<string, unknown>;
  event_flags: Record<string, unknown> | null;
  timing_status: "CLEAN_POINT_IN_TIME" | "FAIL_CLOSED";
  fail_closed_reasons: string[];
  content_hash: string;
};

type CurrencyWeekAtomRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: string;
  atom_key: BprContract["atom_key"];
  source_id: BprContract["source_id"];
  instrument: BprContract["instrument"];
  value_key: BprContract["value_key"];
  status: "FILLED_POINT_IN_TIME" | "FAIL_CLOSED";
  value_available: boolean;
  value: number | null;
  normalized_value_hash: string | null;
  selected_observation_id: string | null;
  selected_publication_timing_row_key: string | null;
  selected_availability_event_id: string | null;
  selected_raw_artifact_ids: string[];
  selected_observation_date: string | null;
  effective_at_utc: string | null;
  available_at_utc: string | null;
  endpoint_available_at_utc: string | null;
  source_eligible_from_week_open_utc: string | null;
  eligibility_rule_version: "gate60d_latest_bpr_event_available_at_or_before_alpha_week_open_v1";
  eligibility_reason: string | null;
  candidate_reports_available_at_or_before_week_open: number;
  latest_candidate_timing_status: PublicationTimingProofRow["timing_status"] | null;
  stale: boolean;
  missing: boolean;
  quarantined: boolean;
  source_ambiguous: boolean;
  fail_closed_reasons: string[];
  content_hash: string;
};

type UnresolvedRow = {
  row_scope: "source_observation" | "currency_week_atom";
  row_key: string;
  alpha_week_open_utc?: string;
  currency: string;
  source_id: string;
  instrument: string;
  atom_key?: string;
  observation_date?: string | null;
  fail_closed_reasons: string[];
};

const BPR_CONTRACTS: BprContract[] = [
  {
    atom_key: "bpr_futures",
    label: "BPR bank participation futures",
    source_id: "cftc_bpr_futures",
    instrument: "bank_participation_futures",
    value_key: "netShareOfGross",
  },
  {
    atom_key: "bpr_futures_and_options",
    label: "BPR bank participation futures and options",
    source_id: "cftc_bpr_options",
    instrument: "bank_participation_futures_and_options",
    value_key: "netShareOfGross",
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

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
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

function sourceRowKey(contract: BprContract, currency: string, observationDate: string, selectedId: string | null) {
  return `${contract.atom_key}|${currency}|${observationDate}|${selectedId ?? "missing_observation_id"}`;
}

function observationContract(row: ObservationRecord): BprContract | null {
  return BPR_CONTRACTS.find((contract) =>
    contract.source_id === row.source_id &&
    contract.instrument === row.instrument) ?? null;
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

function isSourceAmbiguous(row: ObservationRecord | null, timingProof: PublicationTimingProofRow | null) {
  if (!row) return false;
  return boolValue(row.coverage.sourceAmbiguous, false) ||
    boolValue(row.flags.sourceAmbiguous, false) ||
    timingProof?.timing_status === "FAIL_CLOSED";
}

function compareObservationSelectionPriority(left: ObservationRecord, right: ObservationRecord) {
  const leftKey = [
    iso(left.available_at_utc),
    left.observation_date,
    iso(left.effective_at_utc),
    selectedObservationId(left) ?? "",
  ];
  const rightKey = [
    iso(right.available_at_utc),
    right.observation_date,
    iso(right.effective_at_utc),
    selectedObservationId(right) ?? "",
  ];
  for (let index = 0; index < leftKey.length; index += 1) {
    const comparison = leftKey[index].localeCompare(rightKey[index]);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function selectLatestReportAvailableAtOrBeforeWeek(rows: ObservationRecord[], alphaWeekOpenUtc: string) {
  let selected: ObservationRecord | null = null;
  let candidateCount = 0;
  for (const row of rows) {
    if (iso(row.available_at_utc) > alphaWeekOpenUtc) continue;
    candidateCount += 1;
    if (!selected || compareObservationSelectionPriority(row, selected) > 0) {
      selected = row;
    }
  }
  return { selected, candidateCount };
}

async function readAlphaRows(alphaLedgerPath: string) {
  const text = await readFile(alphaLedgerPath, "utf8");
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as AlphaLedgerRow);
}

async function readBprDataset() {
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
    WHERE regime_dataset_id = $1::uuid
  `, [BPR_DATASET_ID]);
  return rows[0] ?? null;
}

async function readBprObservations() {
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
    WHERE regime_dataset_id = $1::uuid
      AND source_family = 'bpr'
      AND currency <> 'ALL'
    ORDER BY source_id, currency, instrument, observation_date, available_at_utc, source_observation_id
  `, [BPR_DATASET_ID]);
}

async function readBprArtifacts() {
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
    WHERE regime_dataset_id = $1::uuid
      AND source_family = 'bpr'
    ORDER BY source_id, currency, endpoint_id, artifact_id
  `, [BPR_DATASET_ID]);
}

async function readBprAvailabilityEvents() {
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
    WHERE regime_dataset_id = $1::uuid
      AND source_family = 'bpr'
      AND currency <> 'ALL'
    ORDER BY source_id, currency, instrument, observation_date, availability_event_id
  `, [BPR_DATASET_ID]);
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
    increment(counts, String(symbols.size));
    return counts;
  }, {});
  const rawRowHistogram = [...rawRowsPerWeek.values()].reduce<Record<string, number>>((counts, count) => {
    increment(counts, String(count));
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

function artifactById(rows: SourceArtifactRecord[]) {
  return new Map(rows.map((row) => [row.artifact_id, row]));
}

function eventById(rows: AvailabilityEventRecord[]) {
  return new Map(rows.map((row) => [row.availability_event_id, row]));
}

function observationTimingIssues(
  row: ObservationRecord,
  event: AvailabilityEventRecord | null,
  artifacts: Map<string, SourceArtifactRecord>,
) {
  const issues: string[] = [];
  const eventId = selectedAvailabilityEventId(row);
  const rawArtifactIds = selectedRawArtifactIds(row);

  if (!eventId) issues.push("missing_availability_event_id");
  if (eventId && !event) issues.push("availability_event_row_missing");
  if (!row.available_at_utc) issues.push("missing_observation_available_at_utc");
  if (rawArtifactIds.length === 0) issues.push("missing_raw_artifact_id");
  for (const artifactId of rawArtifactIds) {
    const artifact = artifacts.get(artifactId);
    if (!artifact) {
      issues.push(`raw_artifact_missing:${artifactId}`);
      continue;
    }
    if (!artifact.raw_payload_sha256) issues.push(`raw_artifact_missing_payload_hash:${artifactId}`);
    if (artifact.http_status < 200 || artifact.http_status >= 300) {
      issues.push(`raw_artifact_http_status_not_success:${artifactId}:${artifact.http_status}`);
    }
  }

  if (event) {
    if (event.source_id !== row.source_id) issues.push("availability_event_source_id_mismatch");
    if (event.instrument !== row.instrument) issues.push("availability_event_instrument_mismatch");
    if (event.currency !== row.currency) issues.push("availability_event_currency_mismatch");
    if (event.observation_date !== row.observation_date) issues.push("availability_event_observation_date_mismatch");
    if (!event.endpoint_available_at_utc) issues.push("missing_endpoint_available_at_utc");
    if (event.endpoint_available_at_utc && row.available_at_utc && iso(event.endpoint_available_at_utc) !== iso(row.available_at_utc)) {
      issues.push("observation_available_at_endpoint_available_at_mismatch");
    }
    if (!event.eligible_from_week_open_utc) issues.push("missing_source_eligible_from_week_open_utc");
    if (event.exception_or_delay_flag === null) issues.push("missing_exception_or_delay_flag");
    if (!["cftc_publication_schedule", "cftc_publication_schedule_exception_calendar"].includes(event.availability_basis ?? "")) {
      issues.push(`invalid_availability_basis:${event.availability_basis ?? "missing"}`);
    }
    if (event.retrieval_capability !== "release_event_filterable") {
      issues.push(`invalid_retrieval_capability:${event.retrieval_capability ?? "missing"}`);
    }
    if (!["scheduled_window", "exact_timestamp"].includes(event.availability_precision ?? "")) {
      issues.push(`invalid_availability_precision:${event.availability_precision ?? "missing"}`);
    }
    if (event.eligibility_policy !== "eligible_at_or_before_freeze") {
      issues.push(`invalid_eligibility_policy:${event.eligibility_policy ?? "missing"}`);
    }
    if (event.availability_confidence !== "scheduled_exact_unless_exception") {
      issues.push(`invalid_availability_confidence:${event.availability_confidence ?? "missing"}`);
    }
    if (event.availability_timezone !== "America/New_York") {
      issues.push(`invalid_availability_timezone:${event.availability_timezone ?? "missing"}`);
    }
    if (event.availability_rule_version !== "macro_availability_event_v1") {
      issues.push(`invalid_availability_rule_version:${event.availability_rule_version ?? "missing"}`);
    }
    if (event.availability_evidence_artifact_id) {
      const evidenceArtifact = artifacts.get(event.availability_evidence_artifact_id);
      if (!evidenceArtifact) issues.push(`availability_evidence_artifact_missing:${event.availability_evidence_artifact_id}`);
      if (evidenceArtifact && !evidenceArtifact.raw_payload_sha256) {
        issues.push(`availability_evidence_artifact_missing_payload_hash:${event.availability_evidence_artifact_id}`);
      }
    }
  }

  if (boolValue(row.flags.latestVintageResearchApproximation, false)) issues.push("latest_vintage_research_approximation");
  if (boolValue(row.flags.promotionBlockedUntilExactPublicationDate, false)) {
    issues.push("promotion_blocked_until_exact_publication_date");
  }
  if (boolValue(row.flags.promotionBlockedUntilPointInTimeAvailability, false)) {
    issues.push("promotion_blocked_until_point_in_time_availability");
  }
  if (row.coverage.retrievalCapability && row.coverage.retrievalCapability !== "release_event_filterable") {
    issues.push(`observation_invalid_retrieval_capability:${String(row.coverage.retrievalCapability)}`);
  }
  if (row.coverage.availabilityPrecision && !["scheduled_window", "exact_timestamp"].includes(String(row.coverage.availabilityPrecision))) {
    issues.push(`observation_invalid_availability_precision:${String(row.coverage.availabilityPrecision)}`);
  }
  if (row.coverage.eligibilityPolicy && row.coverage.eligibilityPolicy !== "eligible_at_or_before_freeze") {
    issues.push(`observation_invalid_eligibility_policy:${String(row.coverage.eligibilityPolicy)}`);
  }
  if (row.coverage.availabilityConfidence && row.coverage.availabilityConfidence !== "scheduled_exact_unless_exception") {
    issues.push(`observation_invalid_availability_confidence:${String(row.coverage.availabilityConfidence)}`);
  }

  return uniqueSorted(issues);
}

function buildPublicationTimingProofRows(
  observations: ObservationRecord[],
  events: Map<string, AvailabilityEventRecord>,
  artifacts: Map<string, SourceArtifactRecord>,
) {
  const rows: PublicationTimingProofRow[] = [];
  for (const observation of observations) {
    const contract = observationContract(observation);
    if (!contract) continue;
    const eventId = selectedAvailabilityEventId(observation);
    const event = eventId ? events.get(eventId) ?? null : null;
    const issues = observationTimingIssues(observation, event, artifacts);
    const selectedId = selectedObservationId(observation);
    const rowKey = sourceRowKey(contract, observation.currency, observation.observation_date, selectedId);
    const proofBase = {
      row_key: rowKey,
      proof_version: PUBLICATION_TIMING_PROOF_VERSION,
      dataset_id: BPR_DATASET_ID,
      source_id: observation.source_id,
      instrument: observation.instrument,
      currency: observation.currency,
      observation_date: observation.observation_date,
      selected_observation_id: selectedId ?? observation.source_observation_id,
      availability_event_id: eventId,
      raw_artifact_ids: selectedRawArtifactIds(observation),
      availability_evidence_artifact_id: event?.availability_evidence_artifact_id ?? null,
      available_at_utc: observation.available_at_utc ? iso(observation.available_at_utc) : null,
      endpoint_available_at_utc: event?.endpoint_available_at_utc ? iso(event.endpoint_available_at_utc) : null,
      source_eligible_from_week_open_utc: event?.eligible_from_week_open_utc ? iso(event.eligible_from_week_open_utc) : null,
      availability_basis: event?.availability_basis ?? null,
      retrieval_capability: event?.retrieval_capability ?? null,
      availability_precision: event?.availability_precision ?? null,
      eligibility_policy: event?.eligibility_policy ?? null,
      availability_confidence: event?.availability_confidence ?? null,
      availability_rule_version: event?.availability_rule_version ?? null,
      exception_or_delay_flag: event?.exception_or_delay_flag ?? null,
      source_flags: record(observation.flags),
      event_flags: event ? record(event.flags) : null,
      timing_status: issues.length === 0 ? "CLEAN_POINT_IN_TIME" as const : "FAIL_CLOSED" as const,
      fail_closed_reasons: issues,
    };
    rows.push({
      ...proofBase,
      content_hash: sha256Stable(proofBase),
    });
  }
  return rows.sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function rowsByContractCurrency(observations: ObservationRecord[]) {
  const result = new Map<string, ObservationRecord[]>();
  for (const contract of BPR_CONTRACTS) {
    for (const row of observations) {
      if (row.source_id !== contract.source_id || row.instrument !== contract.instrument) continue;
      const key = `${contract.atom_key}|${row.currency}`;
      const rows = result.get(key) ?? [];
      rows.push(row);
      result.set(key, rows);
    }
  }
  for (const rows of result.values()) {
    rows.sort(compareObservationSelectionPriority);
  }
  return result;
}

function buildCurrencyWeekAtomRows(input: {
  alphaWeeks: string[];
  currencies: string[];
  observations: ObservationRecord[];
  publicationRows: PublicationTimingProofRow[];
}) {
  const sourceRows = rowsByContractCurrency(input.observations);
  const publicationByRowKey = new Map(input.publicationRows.map((row) => [row.row_key, row]));
  const atomRows: CurrencyWeekAtomRow[] = [];

  for (const alphaWeekOpenUtc of input.alphaWeeks) {
    for (const currency of input.currencies) {
      for (const contract of BPR_CONTRACTS) {
        const candidates = sourceRows.get(`${contract.atom_key}|${currency}`) ?? [];
        const { selected, candidateCount } = selectLatestReportAvailableAtOrBeforeWeek(candidates, alphaWeekOpenUtc);
        const selectedId = selectedObservationId(selected);
        const selectedPublicationKey = selected
          ? sourceRowKey(contract, selected.currency, selected.observation_date, selectedId)
          : null;
        const timingProof = selectedPublicationKey ? publicationByRowKey.get(selectedPublicationKey) ?? null : null;
        const value = numberValue(selected?.normalized_value_json[contract.value_key]);
        const failClosedReasons = uniqueSorted([
          ...(selected ? [] : ["no_bpr_report_available_at_or_before_alpha_week_open"]),
          ...(timingProof ? timingProof.fail_closed_reasons : selected ? ["missing_publication_timing_proof_row"] : []),
          ...(selected && value === null ? [`missing_numeric_value:${contract.value_key}`] : []),
          ...(selected && isStale(selected) ? ["source_stale"] : []),
        ]);
        const status = failClosedReasons.length === 0 ? "FILLED_POINT_IN_TIME" as const : "FAIL_CLOSED" as const;
        const selectedArtifacts = selectedRawArtifactIds(selected);
        const atomBase = {
          row_key: `${contract.atom_key}|${alphaWeekOpenUtc}|${currency}`,
          ledger_version: CURRENCY_ATOM_LEDGER_VERSION,
          alpha_week_open_utc: alphaWeekOpenUtc,
          mapped_macro_week_id: macroWeekIdFor(alphaWeekOpenUtc),
          currency,
          atom_key: contract.atom_key,
          source_id: contract.source_id,
          instrument: contract.instrument,
          value_key: contract.value_key,
          status,
          value_available: value !== null && status === "FILLED_POINT_IN_TIME",
          value: status === "FILLED_POINT_IN_TIME" ? value : null,
          normalized_value_hash: selected && status === "FILLED_POINT_IN_TIME" ? sha256Stable(selected.normalized_value_json) : null,
          selected_observation_id: selectedId,
          selected_publication_timing_row_key: selectedPublicationKey,
          selected_availability_event_id: selectedAvailabilityEventId(selected),
          selected_raw_artifact_ids: selectedArtifacts,
          selected_observation_date: selected?.observation_date ?? null,
          effective_at_utc: selected?.effective_at_utc ? iso(selected.effective_at_utc) : null,
          available_at_utc: selected?.available_at_utc ? iso(selected.available_at_utc) : null,
          endpoint_available_at_utc: timingProof?.endpoint_available_at_utc ?? null,
          source_eligible_from_week_open_utc: timingProof?.source_eligible_from_week_open_utc ?? null,
          eligibility_rule_version: "gate60d_latest_bpr_event_available_at_or_before_alpha_week_open_v1" as const,
          eligibility_reason: selected
            ? "latest_bpr_report_available_at_or_before_alpha_week_open"
            : null,
          candidate_reports_available_at_or_before_week_open: candidateCount,
          latest_candidate_timing_status: timingProof?.timing_status ?? null,
          stale: selected ? isStale(selected) : false,
          missing: !selected || value === null,
          quarantined: status === "FAIL_CLOSED",
          source_ambiguous: isSourceAmbiguous(selected, timingProof),
          fail_closed_reasons: failClosedReasons,
        };
        atomRows.push({
          ...atomBase,
          content_hash: sha256Stable(atomBase),
        });
      }
    }
  }

  return atomRows.sort((left, right) => left.row_key.localeCompare(right.row_key));
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
    endpoint_available_at_utc: row.endpoint_available_at_utc,
    availability_basis: row.availability_basis,
    retrieval_capability: row.retrieval_capability,
    availability_precision: row.availability_precision,
    eligibility_policy: row.eligibility_policy,
    availability_timezone: row.availability_timezone,
    availability_evidence_artifact_id: row.availability_evidence_artifact_id,
    availability_rule_version: row.availability_rule_version,
    availability_confidence: row.availability_confidence,
    eligible_from_week_open_utc: row.eligible_from_week_open_utc,
    exception_or_delay_flag: row.exception_or_delay_flag,
    coverage_hash: sha256Stable(row.coverage),
    flags_hash: sha256Stable(row.flags),
  })).sort((left, right) => left.map_key.localeCompare(right.map_key));
}

function rawObservationHashMapRows(rows: ObservationRecord[]) {
  return rows.map((row) => ({
    map_key: `${row.regime_dataset_id}|${row.source_id}|${row.currency}|${row.instrument}|${row.observation_date}|${selectedObservationId(row) ?? row.source_observation_id}`,
    content_hash: sha256Stable(row),
    regime_dataset_id: row.regime_dataset_id,
    source_family: row.source_family,
    source_id: row.source_id,
    currency: row.currency,
    instrument: row.instrument,
    source_observation_id: row.source_observation_id,
    selected_observation_id: selectedObservationId(row),
    observation_date: row.observation_date,
    effective_at_utc: row.effective_at_utc,
    available_at_utc: row.available_at_utc,
    source_hash: row.source_hash,
    raw_value_hash: sha256Stable(row.raw_value_json),
    normalized_value_hash: sha256Stable(row.normalized_value_json),
    coverage_hash: sha256Stable(row.coverage),
    flags_hash: sha256Stable(row.flags),
  })).sort((left, right) => left.map_key.localeCompare(right.map_key));
}

function buildSourceRegistry(input: {
  dataset: DatasetRecord | null;
  observations: ObservationRecord[];
  publicationRows: PublicationTimingProofRow[];
  atomRows: CurrencyWeekAtomRow[];
}) {
  const publicationByContract = BPR_CONTRACTS.map((contract) => {
    const rows = input.publicationRows.filter((row) => row.source_id === contract.source_id && row.instrument === contract.instrument);
    const atomRows = input.atomRows.filter((row) => row.atom_key === contract.atom_key);
    return {
      atom_key: contract.atom_key,
      label: contract.label,
      source_id: contract.source_id,
      instrument: contract.instrument,
      value_key: contract.value_key,
      source_exists: rows.length > 0,
      raw_source_observation_rows: rows.length,
      clean_publication_rows: rows.filter((row) => row.timing_status === "CLEAN_POINT_IN_TIME").length,
      fail_closed_publication_rows: rows.filter((row) => row.timing_status === "FAIL_CLOSED").length,
      currency_week_atom_rows: atomRows.length,
      filled_currency_week_atom_rows: atomRows.filter((row) => row.status === "FILLED_POINT_IN_TIME").length,
      fail_closed_currency_week_atom_rows: atomRows.filter((row) => row.status === "FAIL_CLOSED").length,
      source_state: rows.some((row) => row.timing_status === "FAIL_CLOSED") || atomRows.some((row) => row.status === "FAIL_CLOSED")
        ? "QUARANTINED_WITH_EXPLICIT_FAIL_CLOSED_ROWS"
        : "POINT_IN_TIME_ELIGIBLE_SOURCE_ONLY",
      allowed_use: "BPR source eligibility evidence only; no Regime transform, matrix, LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, or source mutation.",
    };
  });

  return {
    gate_id: GATE_ID,
    registry_version: SOURCE_REGISTRY_VERSION,
    dataset_id: BPR_DATASET_ID,
    dataset: input.dataset,
    source_family: "bpr",
    source_contracts: publicationByContract,
    eligibility_contract: {
      alpha_denominator: "Gate 59 Alpha v1 atom ledger",
      row_level_rule:
        "For each Alpha week/currency/BPR contract, choose the latest BPR source report whose endpoint_available_at_utc is at or before alpha_week_open_utc. If that latest report has missing, inferred, approximate, non-filterable, blocked, or unhashable publication evidence, fail closed. Do not backfill across an unresolved newer report.",
      accepted_availability_basis: ["cftc_publication_schedule", "cftc_publication_schedule_exception_calendar"],
      accepted_retrieval_capability: ["release_event_filterable"],
      accepted_availability_precision: ["scheduled_window", "exact_timestamp"],
      accepted_eligibility_policy: ["eligible_at_or_before_freeze"],
      accepted_availability_confidence: ["scheduled_exact_unless_exception"],
      required_timezone: "America/New_York",
      required_rule_version: "macro_availability_event_v1",
      required_exception_flag: true,
      no_neutral_fill: true,
      no_forward_fill_across_unresolved_new_report: true,
      no_imputation: true,
      no_skipping_rows: true,
      no_source_mutation: true,
    },
  };
}

function buildUnresolvedRows(
  publicationRows: PublicationTimingProofRow[],
  atomRows: CurrencyWeekAtomRow[],
) {
  const publicationUnresolved: UnresolvedRow[] = publicationRows
    .filter((row) => row.timing_status === "FAIL_CLOSED")
    .map((row) => ({
      row_scope: "source_observation",
      row_key: row.row_key,
      currency: row.currency,
      source_id: row.source_id,
      instrument: row.instrument,
      observation_date: row.observation_date,
      fail_closed_reasons: row.fail_closed_reasons,
    }));
  const atomUnresolved: UnresolvedRow[] = atomRows
    .filter((row) => row.status === "FAIL_CLOSED")
    .map((row) => ({
      row_scope: "currency_week_atom",
      row_key: row.row_key,
      alpha_week_open_utc: row.alpha_week_open_utc,
      currency: row.currency,
      source_id: row.source_id,
      instrument: row.instrument,
      atom_key: row.atom_key,
      observation_date: row.selected_observation_date,
      fail_closed_reasons: row.fail_closed_reasons,
    }));
  return [...publicationUnresolved, ...atomUnresolved].sort((left, right) => {
    const scopeComparison = left.row_scope.localeCompare(right.row_scope);
    return scopeComparison || left.row_key.localeCompare(right.row_key);
  });
}

function buildFailClosedReport(input: {
  publicationRows: PublicationTimingProofRow[];
  atomRows: CurrencyWeekAtomRow[];
  unresolvedRows: UnresolvedRow[];
}) {
  const reasonCounts: Record<string, number> = {};
  for (const row of input.unresolvedRows) {
    for (const reason of row.fail_closed_reasons) increment(reasonCounts, reason);
  }
  const byAtom = BPR_CONTRACTS.map((contract) => {
    const rows = input.atomRows.filter((row) => row.atom_key === contract.atom_key);
    const failClosedWeeks = uniqueSorted(rows.filter((row) => row.status === "FAIL_CLOSED").map((row) => row.alpha_week_open_utc));
    return {
      atom_key: contract.atom_key,
      source_id: contract.source_id,
      instrument: contract.instrument,
      rows: rows.length,
      filled_rows: rows.filter((row) => row.status === "FILLED_POINT_IN_TIME").length,
      fail_closed_rows: rows.filter((row) => row.status === "FAIL_CLOSED").length,
      fail_closed_week_count: failClosedWeeks.length,
      first_fail_closed_week: failClosedWeeks[0] ?? null,
      last_fail_closed_week: failClosedWeeks.at(-1) ?? null,
      fail_closed_weeks_sample: failClosedWeeks.slice(0, 8),
    };
  });
  const byPublicationDate = input.publicationRows
    .filter((row) => row.timing_status === "FAIL_CLOSED")
    .reduce<Record<string, number>>((counts, row) => {
      increment(counts, `${row.source_id}|${row.instrument}|${row.observation_date}`);
      return counts;
    }, {});

  return {
    report_version: FAIL_CLOSED_REPORT_VERSION,
    publication_timing_rows: input.publicationRows.length,
    clean_publication_timing_rows: input.publicationRows.filter((row) => row.timing_status === "CLEAN_POINT_IN_TIME").length,
    fail_closed_publication_timing_rows: input.publicationRows.filter((row) => row.timing_status === "FAIL_CLOSED").length,
    currency_week_atom_rows: input.atomRows.length,
    filled_currency_week_atom_rows: input.atomRows.filter((row) => row.status === "FILLED_POINT_IN_TIME").length,
    fail_closed_currency_week_atom_rows: input.atomRows.filter((row) => row.status === "FAIL_CLOSED").length,
    unresolved_rows: input.unresolvedRows.length,
    reason_counts: Object.fromEntries(Object.entries(reasonCounts).sort((left, right) => left[0].localeCompare(right[0]))),
    by_atom: byAtom,
    fail_closed_publication_dates: Object.fromEntries(Object.entries(byPublicationDate).sort((left, right) => left[0].localeCompare(right[0]))),
    quarantine_note:
      "Rows remain fail-closed when BPR publication timing is inferred, requires capture-before-freeze proof, or carries promotion-blocking flags. Older clean reports are not used across a newer unresolved BPR report.",
  };
}

function renderSummaryMarkdown(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  failClosedReport: ReturnType<typeof buildFailClosedReport>;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60D BPR Source Eligibility Summary",
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
    "## BPR Atom Coverage",
    "",
    "| Atom | Rows | Filled | Fail-closed | Fail-closed week count | First fail-closed | Last fail-closed | Sample |",
    "|---|---:|---:|---:|---:|---|---|---|",
    ...input.failClosedReport.by_atom.map((row) =>
      `| ${row.atom_key} | ${row.rows} | ${row.filled_rows} | ${row.fail_closed_rows} | ${row.fail_closed_week_count} | ${row.first_fail_closed_week ?? "-"} | ${row.last_fail_closed_week ?? "-"} | ${row.fail_closed_weeks_sample.join(", ") || "-"} |`),
    "",
    "## Fail-Closed Reasons",
    "",
    "```json",
    JSON.stringify(input.failClosedReport.reason_counts, null, 2),
    "```",
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
  dataset: DatasetRecord | null;
  observationsRead: number;
  artifactsRead: number;
  availabilityEventsRead: number;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60D BPR Query/Rebuild Receipt",
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
    "## Source Dataset Included",
    "",
    "| Dataset | Snapshot state | Dataset status | Promotion manifest | Contract manifest hash |",
    "|---|---|---|---|---|",
    input.dataset
      ? `| ${input.dataset.regime_dataset_id} | ${input.dataset.snapshot_state} | ${input.dataset.status} | ${input.dataset.promotion_manifest_id ?? "-"} | ${input.dataset.contract_manifest_hash ?? "-"} |`
      : "| MISSING | - | - | - | - |",
    "",
    "## Probe/Rebuild Counts",
    "",
    `- BPR source observations read: \`${input.observationsRead}\``,
    `- BPR source artifacts read: \`${input.artifactsRead}\``,
    `- BPR availability events read: \`${input.availabilityEventsRead}\``,
    `- BPR source registry hash: \`${input.hashes.bpr_source_registry_hash}\``,
    `- BPR source content invariant hash: \`${input.hashes.bpr_source_content_invariant_hash}\``,
    `- BPR currency atom ledger hash: \`${input.hashes.bpr_currency_week_atom_ledger_hash}\``,
    "",
    "## Boundary",
    "",
    "Read-only database probe and non-mutating BPR source eligibility proof against the frozen Gate 59 Alpha v1 denominator. No Regime transform, matrix, LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation was run.",
    "",
  ].join("\n");
}

function renderReport(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  failClosedReport: ReturnType<typeof buildFailClosedReport>;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60D BPR Source Eligibility",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Verdict",
    "",
    `\`${input.verdict}\``,
    "",
    "Gate 60D is BPR-only. It resolves publication timing, availability evidence, source hashes, and point-in-time eligibility against the frozen Gate 59 Alpha v1 denominator. It emits no Regime transform, no matrix, no macro LONG/SHORT side, no support/oppose/fade labels, no P&L, no attribution, no Alpha v2, and no risk/execution/MT5/live/app work.",
    "",
    "## Contract",
    "",
    `BPR source registry version: \`${SOURCE_REGISTRY_VERSION}\``,
    "",
    "- BPR rows are source-only eligibility evidence.",
    "- Every Gate 59 Alpha week/currency/BPR contract is emitted in the currency-week atom ledger.",
    "- The latest BPR report available at or before the Alpha week open is the only candidate for that row.",
    "- If that latest available report is inferred, approximate, non-filterable, promotion-blocked, missing evidence, stale, or unhashable, the row fails closed.",
    "- Older clean BPR rows are not carried across a newer unresolved BPR report.",
    "- No neutral fill, forward fill, imputation, row skipping, source mutation, Regime side, or matrix is performed.",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(input.denominator, null, 2),
    "```",
    "",
    "## BPR Result",
    "",
    "| Atom | Rows | Filled | Fail-closed | Fail-closed week count | First fail-closed | Last fail-closed | Sample |",
    "|---|---:|---:|---:|---:|---|---|---|",
    ...input.failClosedReport.by_atom.map((row) =>
      `| ${row.atom_key} | ${row.rows} | ${row.filled_rows} | ${row.fail_closed_rows} | ${row.fail_closed_week_count} | ${row.first_fail_closed_week ?? "-"} | ${row.last_fail_closed_week ?? "-"} | ${row.fail_closed_weeks_sample.join(", ") || "-"} |`),
    "",
    "## Fail-Closed Reasons",
    "",
    "```json",
    JSON.stringify(input.failClosedReport.reason_counts, null, 2),
    "```",
    "",
    "## Hashes",
    "",
    "```json",
    JSON.stringify(input.hashes, null, 2),
    "```",
    "",
    "## Stop Line",
    "",
    "Stop here. Do not proceed to Regime atom transforms, broad matrix, Regime LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation.",
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
    throw new Error(`Gate 60D denominator invariant failed: ${JSON.stringify(denominator, null, 2)}`);
  }

  const alphaWeeks = uniqueSorted(alphaRows.map((row) => row.week.week_open_utc));
  const alphaCurrencies = uniqueSorted(alphaRows.flatMap((row) => [
    row.instrument.base_currency,
    row.instrument.quote_currency,
  ]));

  const [dataset, observations, artifacts, availabilityEvents] = await Promise.all([
    readBprDataset(),
    readBprObservations(),
    readBprArtifacts(),
    readBprAvailabilityEvents(),
  ]);

  const artifactsById = artifactById(artifacts);
  const eventsById = eventById(availabilityEvents);
  const publicationRows = buildPublicationTimingProofRows(observations, eventsById, artifactsById);
  const atomRows = buildCurrencyWeekAtomRows({
    alphaWeeks,
    currencies: alphaCurrencies,
    observations,
    publicationRows,
  });
  const unresolvedRows = buildUnresolvedRows(publicationRows, atomRows);
  const failClosedReport = buildFailClosedReport({ publicationRows, atomRows, unresolvedRows });
  const registry = buildSourceRegistry({ dataset, observations, publicationRows, atomRows });
  const artifactHashMap = sourceArtifactHashMapRows(artifacts);
  const rawObservationHashMap = rawObservationHashMapRows(observations);
  const availabilityEventHashMap = availabilityEventHashMapRows(availabilityEvents);

  const outputDenominator = {
    ...denominator,
    bpr_currency_week_atom_rows: atomRows.length,
    expected_bpr_currency_week_atom_rows: alphaWeeks.length * alphaCurrencies.length * BPR_CONTRACTS.length,
    dropped_bpr_currency_week_atom_rows: alphaWeeks.length * alphaCurrencies.length * BPR_CONTRACTS.length - atomRows.length,
    duplicate_bpr_currency_week_atom_row_keys: countDuplicates(atomRows.map((row) => row.row_key)),
    bpr_publication_timing_rows: publicationRows.length,
    duplicate_bpr_publication_timing_row_keys: countDuplicates(publicationRows.map((row) => row.row_key)),
  };
  if (
    outputDenominator.bpr_currency_week_atom_rows !== outputDenominator.expected_bpr_currency_week_atom_rows ||
    outputDenominator.dropped_bpr_currency_week_atom_rows !== 0 ||
    outputDenominator.duplicate_bpr_currency_week_atom_row_keys !== 0 ||
    outputDenominator.duplicate_bpr_publication_timing_row_keys !== 0
  ) {
    throw new Error(`Gate 60D output invariant failed: ${JSON.stringify(outputDenominator, null, 2)}`);
  }

  const verdict = unresolvedRows.length === 0
    ? "PASS_BPR_SOURCE_ELIGIBILITY_PROOF_SOURCE_ONLY__NO_REGIME_SIDE"
    : "FAIL_CLOSED_BPR_SOURCE_ELIGIBILITY_UNRESOLVED_ROWS_REMAIN__NO_REGIME_SIDE";

  const artifactDir = options.artifactDir;
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const registryPath = path.join(artifactDir, "gate60d-bpr-source-registry-v2.contract.json");
  const publicationTimingPath = path.join(artifactDir, "gate60d-bpr-publication-timing-proof.rows.jsonl");
  const artifactHashMapPath = path.join(artifactDir, "gate60d-bpr-raw-artifact-hash-map.json");
  const rawObservationHashMapPath = path.join(artifactDir, "gate60d-bpr-raw-observation-hash-map.json");
  const availabilityEventHashMapPath = path.join(artifactDir, "gate60d-bpr-availability-event-hash-map.json");
  const atomLedgerPath = path.join(artifactDir, "gate60d-bpr-currency-week-atom-ledger.rows.jsonl");
  const failClosedReportPath = path.join(artifactDir, "gate60d-bpr-fail-closed-quarantine-report.json");
  const unresolvedRowsPath = path.join(artifactDir, "gate60d-bpr-unresolved-rows.rows.jsonl");
  const summaryJsonPath = path.join(artifactDir, "gate60d-bpr-source-eligibility.summary.json");
  const summaryMdPath = path.join(artifactDir, "gate60d-bpr-source-eligibility.summary.md");
  const receiptPath = path.join(artifactDir, "gate60d-bpr-source-eligibility.query-receipt.md");
  const shaPath = path.join(artifactDir, "gate60d-bpr-source-eligibility.sha256.txt");

  const registryText = `${JSON.stringify(registry, null, 2)}\n`;
  const publicationRowsText = `${publicationRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const artifactHashMapText = `${JSON.stringify(artifactHashMap)}\n`;
  const rawObservationHashMapText = `${JSON.stringify(rawObservationHashMap)}\n`;
  const availabilityEventHashMapText = `${JSON.stringify(availabilityEventHashMap)}\n`;
  const atomRowsText = `${atomRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const failClosedReportText = `${JSON.stringify(failClosedReport, null, 2)}\n`;
  const unresolvedRowsText = unresolvedRows.length > 0 ? `${unresolvedRows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";

  const hashes = {
    gate59_alpha_ledger_jsonl_sha256: sha256Text(await readFile(options.alphaLedgerPath, "utf8")),
    bpr_source_registry_hash: sha256Stable(registry),
    bpr_publication_timing_proof_hash: sha256Text(publicationRowsText),
    bpr_raw_artifact_hash_map_hash: sha256Text(artifactHashMapText),
    bpr_raw_observation_hash_map_hash: sha256Text(rawObservationHashMapText),
    bpr_availability_event_hash_map_hash: sha256Text(availabilityEventHashMapText),
    bpr_currency_week_atom_ledger_hash: sha256Text(atomRowsText),
    bpr_fail_closed_quarantine_report_hash: sha256Text(failClosedReportText),
    bpr_unresolved_rows_hash: sha256Text(unresolvedRowsText),
    bpr_source_content_invariant_hash: sha256Stable({
      registry_hash: sha256Stable(registry),
      dataset,
      publication_timing_proof_hash: sha256Text(publicationRowsText),
      artifact_hash_map_hash: sha256Text(artifactHashMapText),
      raw_observation_hash_map_hash: sha256Text(rawObservationHashMapText),
      availability_event_hash_map_hash: sha256Text(availabilityEventHashMapText),
      currency_week_atom_ledger_hash: sha256Text(atomRowsText),
      fail_closed_quarantine_report_hash: sha256Text(failClosedReportText),
      unresolved_rows_hash: sha256Text(unresolvedRowsText),
    }),
  };

  const summary = {
    gate_id: GATE_ID,
    verdict,
    command: COMMAND,
    denominator: outputDenominator,
    source_registry_version: SOURCE_REGISTRY_VERSION,
    publication_timing_proof_version: PUBLICATION_TIMING_PROOF_VERSION,
    currency_atom_ledger_version: CURRENCY_ATOM_LEDGER_VERSION,
    fail_closed_report_version: FAIL_CLOSED_REPORT_VERSION,
    dataset_id: BPR_DATASET_ID,
    bpr_contracts: BPR_CONTRACTS,
    fail_closed_report: failClosedReport,
    hashes,
    stop_line:
      "No Regime atom transforms, broad matrix, Regime LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, COT/Strength/Alpha v1/Gate59 mutation, or macro source row mutation.",
  };
  const summaryJsonText = `${JSON.stringify(summary, null, 2)}\n`;
  const summaryMdText = renderSummaryMarkdown({
    generatedAt,
    verdict,
    denominator: outputDenominator,
    failClosedReport,
    hashes,
  });
  const receiptText = renderReceipt({
    generatedAt,
    gitCommit: gitState.commit,
    dirtyStatus: gitState.dirtyStatus,
    dirtyFiles: gitState.dirtyFiles,
    dataset,
    observationsRead: observations.length,
    artifactsRead: artifacts.length,
    availabilityEventsRead: availabilityEvents.length,
    hashes,
  });
  const reportText = renderReport({
    generatedAt,
    verdict,
    denominator: outputDenominator,
    failClosedReport,
    hashes,
  });

  const shaEntries = [
    ["gate59_alpha_ledger_jsonl", options.alphaLedgerPath, hashes.gate59_alpha_ledger_jsonl_sha256],
    ["bpr_source_registry", registryPath, sha256Text(registryText)],
    ["bpr_publication_timing_proof", publicationTimingPath, hashes.bpr_publication_timing_proof_hash],
    ["bpr_raw_artifact_hash_map", artifactHashMapPath, hashes.bpr_raw_artifact_hash_map_hash],
    ["bpr_raw_observation_hash_map", rawObservationHashMapPath, hashes.bpr_raw_observation_hash_map_hash],
    ["bpr_availability_event_hash_map", availabilityEventHashMapPath, hashes.bpr_availability_event_hash_map_hash],
    ["bpr_currency_week_atom_ledger", atomLedgerPath, hashes.bpr_currency_week_atom_ledger_hash],
    ["bpr_fail_closed_quarantine_report", failClosedReportPath, hashes.bpr_fail_closed_quarantine_report_hash],
    ["bpr_unresolved_rows", unresolvedRowsPath, hashes.bpr_unresolved_rows_hash],
    ["summary_json", summaryJsonPath, sha256Text(summaryJsonText)],
    ["summary_md", summaryMdPath, sha256Text(summaryMdText)],
    ["query_receipt", receiptPath, sha256Text(receiptText)],
    ["report", options.reportPath, sha256Text(reportText)],
    ["combined_hash", "content", sha256Stable(hashes)],
  ];
  const shaText = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${generatedAt}`,
    `git_commit ${gitState.commit}`,
    `verdict ${verdict}`,
    ...shaEntries.map(([label, filePath, hash]) => `${label} ${hash} ${filePath === "content" ? filePath : toRepoRelative(filePath)}`),
    "",
  ].join("\n");

  await Promise.all([
    writeFile(registryPath, registryText),
    writeFile(publicationTimingPath, publicationRowsText),
    writeFile(artifactHashMapPath, artifactHashMapText),
    writeFile(rawObservationHashMapPath, rawObservationHashMapText),
    writeFile(availabilityEventHashMapPath, availabilityEventHashMapText),
    writeFile(atomLedgerPath, atomRowsText),
    writeFile(failClosedReportPath, failClosedReportText),
    writeFile(unresolvedRowsPath, unresolvedRowsText),
    writeFile(summaryJsonPath, summaryJsonText),
    writeFile(summaryMdPath, summaryMdText),
    writeFile(receiptPath, receiptText),
    writeFile(shaPath, shaText),
    writeFile(options.reportPath, reportText),
  ]);

  console.log(JSON.stringify({
    gate_id: GATE_ID,
    verdict,
    command: COMMAND,
    denominator: outputDenominator,
    fail_closed_report: failClosedReport,
    hashes,
    artifacts: {
      registry: toRepoRelative(registryPath),
      publication_timing_proof: toRepoRelative(publicationTimingPath),
      raw_artifact_hash_map: toRepoRelative(artifactHashMapPath),
      raw_observation_hash_map: toRepoRelative(rawObservationHashMapPath),
      availability_event_hash_map: toRepoRelative(availabilityEventHashMapPath),
      currency_week_atom_ledger: toRepoRelative(atomLedgerPath),
      fail_closed_quarantine_report: toRepoRelative(failClosedReportPath),
      unresolved_rows: toRepoRelative(unresolvedRowsPath),
      sha_identity: toRepoRelative(shaPath),
      report: toRepoRelative(options.reportPath),
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized();
  });
