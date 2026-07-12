import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized, query } from "@database/db/client";
import { COT_ASSET_CLASSES } from "@engine/contracts/cotMarkets";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 60E: bpr-value-source-contract-rescue";
const COMMAND = "npm run engine:gate60e:bpr-value-source-contract-rescue";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate60e/artifacts/gate60e-bpr-value-source-contract-rescue";
const DEFAULT_REPORT_PATH =
  "docs/research/gates/gate60e/GATE60E_BPR_VALUE_SOURCE_CONTRACT_RESCUE_2026-06-27.md";
const EXPECTED_ALPHA_ROWS = 10_444;
const EXPECTED_ALPHA_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const BPR_DATASET_ID = "01a3b789-2928-4886-a627-eaf5ae689790";
const VALUE_SOURCE_CONTRACT_VERSION = "gate60e_bpr_value_source_contract_v1";
const RAW_ARTIFACT_INDEX_VERSION = "gate60e_bpr_raw_artifact_value_index_v1";
const SOURCE_OBSERVATION_DIAGNOSTIC_VERSION = "gate60e_bpr_source_observation_value_diagnostic_v1";
const VALUE_MATRIX_VERSION = "gate60e_bpr_value_availability_matrix_v1";
const PUBLICATION_TIMING_SEPARATE_VERSION = "gate60e_bpr_publication_timing_separate_v1";
const FAIL_CLOSED_RECEIPT_VERSION = "gate60e_bpr_value_fail_closed_receipt_v1";

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
  raw_payload_text: string | null;
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
  report_type: "f" | "o";
  instrument: "bank_participation_futures" | "bank_participation_futures_and_options";
  value_key: "netShareOfGross";
};

type BankSide = {
  long: number;
  short: number;
};

type BankCommodityRow = {
  commodity: string;
  us: BankSide | null;
  nonUs: BankSide | null;
};

type RawArtifactIndexRow = {
  row_key: string;
  index_version: string;
  artifact_id: string;
  source_id: string;
  endpoint_id: string;
  endpoint_url: string;
  report_type: string | null;
  report_date: string | null;
  raw_payload_sha256: string;
  raw_payload_size_bytes: number;
  raw_payload_text_available: boolean;
  raw_payload_text_sha256: string | null;
  raw_payload_text_sha_matches_stored: boolean | null;
  http_status: number;
  parser_replay_status: "PARSED" | "FAIL_CLOSED";
  parser_replay_error: string | null;
  parsed_market_count: number;
  parsed_fx_market_labels: string[];
  fx_currency_presence: Record<string, CurrencyArtifactPresence>;
  coverage_hash: string;
  flags_hash: string;
  content_hash: string;
};

type CurrencyArtifactPresence = {
  current_contract_labels: string[];
  rescue_alias_labels: string[];
  current_contract_label_present: boolean;
  rescue_alias_label_present: boolean;
  expected_source_label_present: boolean;
  parsed_current_contract_market_present: boolean;
  parsed_rescue_alias_market_present: boolean;
  parsed_expected_market_present: boolean;
};

type MissingReason =
  | "not_missing"
  | "truly_absent_from_cftc_bpr_report"
  | "parser_extraction_failure"
  | "source_id_instrument_mapping_error"
  | "currency_mapping_error"
  | "wrong_chosen_bpr_atom_value_definition"
  | "futures_options_contract_limitation"
  | "irreducible_source_absence";

type SourceObservationDiagnosticRow = {
  row_key: string;
  diagnostic_version: string;
  source_id: string;
  instrument: string;
  report_type: "f" | "o" | null;
  currency: string;
  observation_date: string;
  selected_observation_id: string;
  raw_artifact_ids: string[];
  raw_artifact_hashes: string[];
  value_key: "netShareOfGross";
  net_share_of_gross_available: boolean;
  net_share_of_gross: number | null;
  raw_commodity: string | null;
  raw_us_present: boolean;
  raw_non_us_present: boolean;
  raw_total_long_contracts: number | null;
  raw_total_short_contracts: number | null;
  raw_gross_contracts: number | null;
  raw_net_contracts: number | null;
  current_contract_label_present: boolean;
  rescue_alias_label_present: boolean;
  expected_source_label_present: boolean;
  parsed_expected_market_present: boolean;
  same_date_other_contract_value_available: boolean;
  same_date_other_contract_source_id: string | null;
  missing_reason: MissingReason;
  missing_reason_detail: string | null;
  determination: string;
  source_contract_mutation_required_for_rescue: boolean;
  content_hash: string;
};

type PublicationTimingRow = {
  row_key: string;
  timing_version: string;
  source_id: string;
  instrument: string;
  currency: string;
  observation_date: string;
  selected_observation_id: string;
  availability_event_id: string | null;
  raw_artifact_ids: string[];
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
  late_2025_publication_timing_scope: boolean;
  timing_status: "CLEAN_POINT_IN_TIME" | "FAIL_CLOSED";
  fail_closed_reasons: string[];
  content_hash: string;
};

type ValueAvailabilityMatrixRow = {
  row_key: string;
  matrix_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  source_id: BprContract["source_id"];
  instrument: BprContract["instrument"];
  atom_key: BprContract["atom_key"];
  currency: string;
  observation_date: string | null;
  selected_observation_id: string | null;
  raw_artifact_ids: string[];
  raw_artifact_hashes: string[];
  value_key: "netShareOfGross";
  net_share_of_gross_available: boolean;
  net_share_of_gross: number | null;
  timing_status: "CLEAN_POINT_IN_TIME" | "FAIL_CLOSED_PUBLICATION_TIMING" | "NO_SELECTED_OBSERVATION";
  timing_fail_closed_reasons: string[];
  late_2025_publication_timing_row: boolean;
  value_status: "VALUE_PRESENT" | "VALUE_MISSING";
  value_missing_reason: MissingReason;
  value_missing_reason_detail: string | null;
  current_contract_label_present: boolean;
  rescue_alias_label_present: boolean;
  expected_source_label_present: boolean;
  parsed_expected_market_present: boolean;
  raw_commodity: string | null;
  same_date_other_contract_value_available: boolean;
  status: "SOURCE_VALUE_AVAILABLE" | "FAIL_CLOSED";
  fail_closed_reasons: string[];
  content_hash: string;
};

type UnresolvedRow = {
  row_scope: "value_availability_matrix" | "publication_timing_source_observation";
  row_key: string;
  alpha_week_open_utc?: string;
  source_id: string;
  instrument: string;
  currency: string;
  observation_date: string | null;
  value_missing_reason?: MissingReason;
  timing_fail_closed_reasons?: string[];
  fail_closed_reasons: string[];
  content_hash: string;
};

const BPR_CONTRACTS: BprContract[] = [
  {
    atom_key: "bpr_futures",
    label: "BPR bank participation futures",
    source_id: "cftc_bpr_futures",
    report_type: "f",
    instrument: "bank_participation_futures",
    value_key: "netShareOfGross",
  },
  {
    atom_key: "bpr_futures_and_options",
    label: "BPR bank participation futures and options",
    source_id: "cftc_bpr_options",
    report_type: "o",
    instrument: "bank_participation_futures_and_options",
    value_key: "netShareOfGross",
  },
];

const BPR_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"];

const RESCUE_ALIAS_LABELS: Record<string, string[]> = {
  AUD: [],
  CAD: [],
  CHF: [],
  EUR: [],
  GBP: ["BRITISH POUND STERLING"],
  JPY: [],
  NZD: ["NEW ZEALAND DOLLAR"],
  USD: ["U.S. DOLLAR INDEX", "US DOLLAR INDEX", "DOLLAR INDEX"],
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
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function contractLabelsForCurrency(currency: string) {
  return uniqueSorted(COT_ASSET_CLASSES.fx.markets[currency]?.marketNames ?? []);
}

function rescueLabelsForCurrency(currency: string) {
  return uniqueSorted(RESCUE_ALIAS_LABELS[currency] ?? []);
}

function allExpectedLabelsForCurrency(currency: string) {
  return uniqueSorted([...contractLabelsForCurrency(currency), ...rescueLabelsForCurrency(currency)]);
}

function observationContract(row: ObservationRecord | null): BprContract | null {
  if (!row) return null;
  return BPR_CONTRACTS.find((contract) =>
    contract.source_id === row.source_id &&
    contract.instrument === row.instrument) ?? null;
}

function sourceRowKey(contract: BprContract, currency: string, observationDate: string, selectedId: string | null) {
  return `${contract.atom_key}|${currency}|${observationDate}|${selectedId ?? "missing_observation_id"}`;
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

function parseUsDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeBprHtmlCells(html: string) {
  return html
    .replace(/\r/g, "")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\n")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((cell) => cell.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeArtifactTextForSearch(html: string | null) {
  if (!html) return "";
  return html
    .toUpperCase()
    .replace(/\r/g, "")
    .replace(/&NBSP;/g, " ")
    .replace(/&AMP;/g, "&")
    .replace(/&#X27;/g, "'")
    .replace(/&QUOT;/g, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBprNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBprBankType(value: string) {
  const upper = value.toUpperCase().replace(/\s+/g, " ");
  return upper === "U.S." || upper === "U.S" || upper === "NON U.S." || upper === "NON U.S";
}

function bprBankTypeKey(value: string): "us" | "nonUs" | null {
  const upper = value.toUpperCase().replace(/\s+/g, " ");
  if (upper.startsWith("NON U.S")) return "nonUs";
  if (upper.startsWith("U.S")) return "us";
  return null;
}

function isLikelyBprCommodityStart(cells: string[], index: number) {
  const value = cells[index];
  const next = cells[index + 1];
  if (!value || !next || !isBprBankType(next)) return false;
  if (value.toUpperCase() === "COMMODITY" || value.toUpperCase().startsWith("REPORT DATE")) return false;
  return parseBprNumber(value) === null;
}

function parseBprSide(cells: string[], bankTypeIndex: number, bankType: "us" | "nonUs"): BankSide | null {
  const numbers: number[] = [];
  for (let index = bankTypeIndex + 1; index < cells.length && numbers.length < 6; index += 1) {
    if (isBprBankType(cells[index]) || isLikelyBprCommodityStart(cells, index)) break;
    const parsed = parseBprNumber(cells[index]);
    if (parsed === null) break;
    numbers.push(parsed);
  }
  if (numbers.length < 4) return null;

  const firstLooksLikeBankCount =
    bankType === "us"
      ? numbers.length >= 6 && numbers[0] <= 100 && Number.isInteger(numbers[0])
      : numbers[0] <= 100 && Number.isInteger(numbers[0]);
  const longIndex = firstLooksLikeBankCount ? 1 : 0;
  const shortIndex = firstLooksLikeBankCount ? 3 : 2;
  const long = numbers[longIndex];
  const short = numbers[shortIndex];
  if (!Number.isFinite(long) || !Number.isFinite(short)) return null;

  return { long, short };
}

function parseBprReportHtmlForInspection(html: string) {
  const dateMatch = html.match(/REPORT DATE:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);
  if (!dateMatch) throw new Error("BPR report missing REPORT DATE.");
  const reportDate = parseUsDate(dateMatch[1]);
  if (!reportDate) throw new Error(`Invalid BPR report date: ${dateMatch[1]}`);

  const cells = normalizeBprHtmlCells(html);
  const marketMap = new Map<string, BankCommodityRow>();
  let currentCommodity = "";

  for (let index = 0; index < cells.length; index += 1) {
    if (isLikelyBprCommodityStart(cells, index)) {
      currentCommodity = cells[index].toUpperCase();
      if (!marketMap.has(currentCommodity)) {
        marketMap.set(currentCommodity, { commodity: currentCommodity, us: null, nonUs: null });
      }
      continue;
    }

    const bankType = bprBankTypeKey(cells[index]);
    if (!bankType || !currentCommodity) continue;
    const side = parseBprSide(cells, index, bankType);
    if (!side) continue;
    const existing = marketMap.get(currentCommodity) ?? { commodity: currentCommodity, us: null, nonUs: null };
    if (bankType === "us") existing.us = side;
    else existing.nonUs = side;
    marketMap.set(currentCommodity, existing);
  }

  return {
    reportDate,
    markets: [...marketMap.values()].filter((row) => row.us || row.nonUs),
  };
}

function labelsPresentInText(labels: string[], normalizedText: string) {
  return labels.some((label) => normalizedText.includes(label.toUpperCase()));
}

function labelsPresentInMarkets(labels: string[], markets: BankCommodityRow[]) {
  const upperLabels = labels.map((label) => label.toUpperCase());
  return markets.some((market) => upperLabels.some((label) => market.commodity.includes(label)));
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
      raw_payload_text,
      coverage,
      flags
    FROM research_macro_source_artifacts
    WHERE regime_dataset_id = $1::uuid
      AND source_family = 'bpr'
    ORDER BY source_id, endpoint_url, artifact_id
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
    expected_input_rows: EXPECTED_ALPHA_ROWS,
    alpha_weeks: weeks.length,
    expected_alpha_weeks: EXPECTED_ALPHA_WEEKS,
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

function buildRawArtifactIndexRows(artifacts: SourceArtifactRecord[]) {
  return artifacts.map((artifact) => {
    let reportDate: string | null = null;
    let markets: BankCommodityRow[] = [];
    let parserReplayStatus: RawArtifactIndexRow["parser_replay_status"] = "FAIL_CLOSED";
    let parserReplayError: string | null = null;
    const rawPayloadTextSha = artifact.raw_payload_text ? sha256Text(artifact.raw_payload_text) : null;

    if (artifact.raw_payload_text) {
      try {
        const parsed = parseBprReportHtmlForInspection(artifact.raw_payload_text);
        reportDate = parsed.reportDate;
        markets = parsed.markets;
        parserReplayStatus = "PARSED";
      } catch (error) {
        parserReplayError = error instanceof Error ? error.message : String(error);
      }
    } else {
      parserReplayError = "raw_payload_text_missing";
    }

    const normalizedText = normalizeArtifactTextForSearch(artifact.raw_payload_text);
    const parsedFxMarketLabels = markets
      .map((row) => row.commodity)
      .filter((commodity) => BPR_CURRENCIES.some((currency) =>
        labelsPresentInText(allExpectedLabelsForCurrency(currency), commodity)))
      .sort();
    const fxCurrencyPresence = Object.fromEntries(BPR_CURRENCIES.map((currency) => {
      const currentLabels = contractLabelsForCurrency(currency);
      const rescueLabels = rescueLabelsForCurrency(currency);
      const currentText = labelsPresentInText(currentLabels, normalizedText);
      const rescueText = labelsPresentInText(rescueLabels, normalizedText);
      const currentParsed = labelsPresentInMarkets(currentLabels, markets);
      const rescueParsed = labelsPresentInMarkets(rescueLabels, markets);
      return [currency, {
        current_contract_labels: currentLabels,
        rescue_alias_labels: rescueLabels,
        current_contract_label_present: currentText,
        rescue_alias_label_present: rescueText,
        expected_source_label_present: currentText || rescueText,
        parsed_current_contract_market_present: currentParsed,
        parsed_rescue_alias_market_present: rescueParsed,
        parsed_expected_market_present: currentParsed || rescueParsed,
      }];
    })) as Record<string, CurrencyArtifactPresence>;

    const rowBase = {
      row_key: `${artifact.source_id}|${artifact.artifact_id}`,
      index_version: RAW_ARTIFACT_INDEX_VERSION,
      artifact_id: artifact.artifact_id,
      source_id: artifact.source_id,
      endpoint_id: artifact.endpoint_id,
      endpoint_url: artifact.endpoint_url,
      report_type: stringValue(artifact.coverage.reportType),
      report_date: reportDate,
      raw_payload_sha256: artifact.raw_payload_sha256,
      raw_payload_size_bytes: artifact.raw_payload_size_bytes,
      raw_payload_text_available: artifact.raw_payload_text !== null,
      raw_payload_text_sha256: rawPayloadTextSha,
      raw_payload_text_sha_matches_stored: rawPayloadTextSha ? rawPayloadTextSha === artifact.raw_payload_sha256.toUpperCase() : null,
      http_status: artifact.http_status,
      parser_replay_status: parserReplayStatus,
      parser_replay_error: parserReplayError,
      parsed_market_count: markets.length,
      parsed_fx_market_labels: parsedFxMarketLabels,
      fx_currency_presence: fxCurrencyPresence,
      coverage_hash: sha256Stable(artifact.coverage),
      flags_hash: sha256Stable(artifact.flags),
    };
    return {
      ...rowBase,
      content_hash: sha256Stable(rowBase),
    };
  }).sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function observationByContractCurrencyDate(rows: ObservationRecord[]) {
  const result = new Map<string, ObservationRecord>();
  for (const row of rows) {
    const contract = observationContract(row);
    if (!contract) continue;
    result.set(`${contract.atom_key}|${row.currency}|${row.observation_date}`, row);
  }
  return result;
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

function rawTotals(row: ObservationRecord | null) {
  const raw = record(row?.raw_value_json);
  const us = record(raw.us);
  const nonUs = record(raw.nonUs);
  const usLong = numberValue(us.long);
  const usShort = numberValue(us.short);
  const nonUsLong = numberValue(nonUs.long);
  const nonUsShort = numberValue(nonUs.short);
  const hasAny = [usLong, usShort, nonUsLong, nonUsShort].some((value) => value !== null);
  if (!hasAny) {
    return {
      usPresent: false,
      nonUsPresent: false,
      totalLong: null,
      totalShort: null,
      gross: null,
      net: null,
    };
  }
  const totalLong = (usLong ?? 0) + (nonUsLong ?? 0);
  const totalShort = (usShort ?? 0) + (nonUsShort ?? 0);
  return {
    usPresent: usLong !== null || usShort !== null,
    nonUsPresent: nonUsLong !== null || nonUsShort !== null,
    totalLong,
    totalShort,
    gross: totalLong + totalShort,
    net: totalLong - totalShort,
  };
}

function classifyMissingValue(input: {
  row: ObservationRecord | null;
  contract: BprContract | null;
  artifactIndexes: RawArtifactIndexRow[];
  otherContractValueAvailable: boolean;
}) {
  if (!input.row) {
    return {
      missing_reason: "irreducible_source_absence" as MissingReason,
      missing_reason_detail: "No selected BPR observation exists at or before the Alpha week open.",
      determination: "irreducible_source_absence:no_selected_observation",
      source_contract_mutation_required_for_rescue: false,
    };
  }

  const rawReportType = stringValue(input.row.raw_value_json.reportType);
  if (!input.contract || rawReportType !== input.contract.report_type) {
    return {
      missing_reason: "source_id_instrument_mapping_error" as MissingReason,
      missing_reason_detail: `Observation source/instrument/reportType does not match the contracted BPR atom; raw reportType=${rawReportType ?? "missing"}.`,
      determination: "source_id_instrument_mapping_error",
      source_contract_mutation_required_for_rescue: false,
    };
  }

  const totals = rawTotals(input.row);
  if ((totals.usPresent || totals.nonUsPresent) && totals.gross !== null) {
    return {
      missing_reason: "wrong_chosen_bpr_atom_value_definition" as MissingReason,
      missing_reason_detail: "Raw bank long/short fields are present, but normalized netShareOfGross is absent.",
      determination: "wrong_chosen_bpr_atom_value_definition_or_normalization_gap",
      source_contract_mutation_required_for_rescue: false,
    };
  }

  const currentContractPresent = input.artifactIndexes.some((row) =>
    row.fx_currency_presence[input.row!.currency]?.current_contract_label_present ||
    row.fx_currency_presence[input.row!.currency]?.parsed_current_contract_market_present);
  const rescueAliasPresent = input.artifactIndexes.some((row) =>
    row.fx_currency_presence[input.row!.currency]?.rescue_alias_label_present ||
    row.fx_currency_presence[input.row!.currency]?.parsed_rescue_alias_market_present);
  const expectedPresent = currentContractPresent || rescueAliasPresent;
  const artifactTextMissing = input.artifactIndexes.length === 0 ||
    input.artifactIndexes.some((row) => !row.raw_payload_text_available);

  if (rescueAliasPresent && !currentContractPresent) {
    return {
      missing_reason: "currency_mapping_error" as MissingReason,
      missing_reason_detail:
        "The raw artifact contains a currency alias not covered by the current contracted FX market label set.",
      determination: "currency_mapping_error:contracted_currency_label_too_narrow",
      source_contract_mutation_required_for_rescue: true,
    };
  }

  if (currentContractPresent && !stringValue(input.row.raw_value_json.commodity)) {
    return {
      missing_reason: "parser_extraction_failure" as MissingReason,
      missing_reason_detail:
        "The raw artifact contains the current contracted currency label, but the stored observation has no matched commodity row.",
      determination: "parser_extraction_failure:expected_commodity_present_in_artifact",
      source_contract_mutation_required_for_rescue: true,
    };
  }

  if (!expectedPresent && input.contract.source_id === "cftc_bpr_options") {
    return {
      missing_reason: "futures_options_contract_limitation" as MissingReason,
      missing_reason_detail: input.otherContractValueAvailable
        ? "The BPR futures-and-options artifact lacks this currency row while the futures report has a same-date value."
        : "The BPR futures-and-options artifact lacks the expected contracted currency row.",
      determination: "futures_options_contract_limitation:expected_commodity_absent",
      source_contract_mutation_required_for_rescue: false,
    };
  }

  if (!expectedPresent && input.contract.source_id === "cftc_bpr_futures") {
    return {
      missing_reason: "truly_absent_from_cftc_bpr_report" as MissingReason,
      missing_reason_detail: "The BPR futures artifact does not contain the expected contracted currency row.",
      determination: "truly_absent_from_cftc_bpr_report:expected_commodity_absent",
      source_contract_mutation_required_for_rescue: false,
    };
  }

  if (artifactTextMissing) {
    return {
      missing_reason: "irreducible_source_absence" as MissingReason,
      missing_reason_detail: "Raw artifact text is unavailable, so the missing value cannot be reduced further.",
      determination: "irreducible_source_absence:artifact_text_unavailable",
      source_contract_mutation_required_for_rescue: false,
    };
  }

  return {
    missing_reason: "irreducible_source_absence" as MissingReason,
    missing_reason_detail: "No allowed Gate 60E source-contract category could reduce this missing BPR value.",
    determination: "irreducible_source_absence:unclassified",
    source_contract_mutation_required_for_rescue: false,
  };
}

function otherContractFor(contract: BprContract | null) {
  if (!contract) return null;
  return BPR_CONTRACTS.find((candidate) => candidate.atom_key !== contract.atom_key) ?? null;
}

function buildSourceObservationDiagnostics(input: {
  observations: ObservationRecord[];
  artifactIndexes: Map<string, RawArtifactIndexRow>;
}) {
  const byContractCurrencyDate = observationByContractCurrencyDate(input.observations);
  const rows: SourceObservationDiagnosticRow[] = [];
  for (const observation of input.observations) {
    const contract = observationContract(observation);
    if (!contract) continue;
    const artifactIds = selectedRawArtifactIds(observation);
    const artifactIndexRows = artifactIds
      .map((artifactId) => input.artifactIndexes.get(artifactId))
      .filter((row): row is RawArtifactIndexRow => row !== undefined);
    const rawArtifactHashes = artifactIndexRows.map((row) => row.raw_payload_sha256);
    const totals = rawTotals(observation);
    const netShare = numberValue(observation.normalized_value_json[contract.value_key]);
    const otherContract = otherContractFor(contract);
    const otherObservation = otherContract
      ? byContractCurrencyDate.get(`${otherContract.atom_key}|${observation.currency}|${observation.observation_date}`) ?? null
      : null;
    const sameDateOtherContractValueAvailable = numberValue(otherObservation?.normalized_value_json[contract.value_key]) !== null;
    const classification = netShare !== null
      ? {
          missing_reason: "not_missing" as MissingReason,
          missing_reason_detail: null,
          determination: "source_value_present",
          source_contract_mutation_required_for_rescue: false,
        }
      : classifyMissingValue({
          row: observation,
          contract,
          artifactIndexes: artifactIndexRows,
          otherContractValueAvailable: sameDateOtherContractValueAvailable,
        });
    const currentContractLabelPresent = artifactIndexRows.some((row) =>
      row.fx_currency_presence[observation.currency]?.current_contract_label_present ||
      row.fx_currency_presence[observation.currency]?.parsed_current_contract_market_present);
    const rescueAliasLabelPresent = artifactIndexRows.some((row) =>
      row.fx_currency_presence[observation.currency]?.rescue_alias_label_present ||
      row.fx_currency_presence[observation.currency]?.parsed_rescue_alias_market_present);
    const parsedExpectedMarketPresent = artifactIndexRows.some((row) =>
      row.fx_currency_presence[observation.currency]?.parsed_expected_market_present);
    const rowBase = {
      row_key: sourceRowKey(contract, observation.currency, observation.observation_date, selectedObservationId(observation)),
      diagnostic_version: SOURCE_OBSERVATION_DIAGNOSTIC_VERSION,
      source_id: contract.source_id,
      instrument: contract.instrument,
      report_type: stringValue(observation.raw_value_json.reportType) as "f" | "o" | null,
      currency: observation.currency,
      observation_date: observation.observation_date,
      selected_observation_id: selectedObservationId(observation) ?? observation.source_observation_id,
      raw_artifact_ids: artifactIds,
      raw_artifact_hashes: rawArtifactHashes,
      value_key: contract.value_key,
      net_share_of_gross_available: netShare !== null,
      net_share_of_gross: netShare,
      raw_commodity: stringValue(observation.raw_value_json.commodity),
      raw_us_present: totals.usPresent,
      raw_non_us_present: totals.nonUsPresent,
      raw_total_long_contracts: totals.totalLong,
      raw_total_short_contracts: totals.totalShort,
      raw_gross_contracts: totals.gross,
      raw_net_contracts: totals.net,
      current_contract_label_present: currentContractLabelPresent,
      rescue_alias_label_present: rescueAliasLabelPresent,
      expected_source_label_present: currentContractLabelPresent || rescueAliasLabelPresent,
      parsed_expected_market_present: parsedExpectedMarketPresent,
      same_date_other_contract_value_available: sameDateOtherContractValueAvailable,
      same_date_other_contract_source_id: otherObservation?.source_id ?? null,
      missing_reason: classification.missing_reason,
      missing_reason_detail: classification.missing_reason_detail,
      determination: classification.determination,
      source_contract_mutation_required_for_rescue: classification.source_contract_mutation_required_for_rescue,
    };
    rows.push({
      ...rowBase,
      content_hash: sha256Stable(rowBase),
    });
  }
  return rows.sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function buildPublicationTimingRows(input: {
  observations: ObservationRecord[];
  events: Map<string, AvailabilityEventRecord>;
  artifacts: Map<string, SourceArtifactRecord>;
}) {
  const rows: PublicationTimingRow[] = [];
  for (const observation of input.observations) {
    const contract = observationContract(observation);
    if (!contract) continue;
    const eventId = selectedAvailabilityEventId(observation);
    const event = eventId ? input.events.get(eventId) ?? null : null;
    const issues = observationTimingIssues(observation, event, input.artifacts);
    const rowBase = {
      row_key: sourceRowKey(contract, observation.currency, observation.observation_date, selectedObservationId(observation)),
      timing_version: PUBLICATION_TIMING_SEPARATE_VERSION,
      source_id: contract.source_id,
      instrument: contract.instrument,
      currency: observation.currency,
      observation_date: observation.observation_date,
      selected_observation_id: selectedObservationId(observation) ?? observation.source_observation_id,
      availability_event_id: eventId,
      raw_artifact_ids: selectedRawArtifactIds(observation),
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
      late_2025_publication_timing_scope: ["2025-10-07", "2025-11-04"].includes(observation.observation_date),
      timing_status: issues.length === 0 ? "CLEAN_POINT_IN_TIME" as const : "FAIL_CLOSED" as const,
      fail_closed_reasons: issues,
    };
    rows.push({
      ...rowBase,
      content_hash: sha256Stable(rowBase),
    });
  }
  return rows.sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function buildValueAvailabilityMatrix(input: {
  alphaWeeks: string[];
  currencies: string[];
  observations: ObservationRecord[];
  sourceDiagnostics: Map<string, SourceObservationDiagnosticRow>;
  publicationTimingRows: Map<string, PublicationTimingRow>;
}) {
  const sourceRows = rowsByContractCurrency(input.observations);
  const matrixRows: ValueAvailabilityMatrixRow[] = [];
  for (const alphaWeekOpenUtc of input.alphaWeeks) {
    for (const currency of input.currencies) {
      for (const contract of BPR_CONTRACTS) {
        const candidates = sourceRows.get(`${contract.atom_key}|${currency}`) ?? [];
        const { selected } = selectLatestReportAvailableAtOrBeforeWeek(candidates, alphaWeekOpenUtc);
        const selectedId = selectedObservationId(selected);
        const selectedPublicationKey = selected
          ? sourceRowKey(contract, selected.currency, selected.observation_date, selectedId)
          : null;
        const diagnostic = selectedPublicationKey ? input.sourceDiagnostics.get(selectedPublicationKey) ?? null : null;
        const timing = selectedPublicationKey ? input.publicationTimingRows.get(selectedPublicationKey) ?? null : null;
        const netShare = numberValue(selected?.normalized_value_json[contract.value_key]);
        const timingFailReasons = timing?.timing_status === "FAIL_CLOSED" ? timing.fail_closed_reasons : [];
        const valueMissing = netShare === null;
        const valueMissingReason = valueMissing
          ? diagnostic?.missing_reason ?? "irreducible_source_absence"
          : "not_missing";
        const failClosedReasons = uniqueSorted([
          ...(selected ? [] : ["no_bpr_report_available_at_or_before_alpha_week_open"]),
          ...(timingFailReasons.length > 0 ? timingFailReasons.map((reason) => `publication_timing:${reason}`) : []),
          ...(valueMissing ? [`value_missing:${valueMissingReason}`] : []),
        ]);
        const rowBase = {
          row_key: `${contract.atom_key}|${alphaWeekOpenUtc}|${currency}`,
          matrix_version: VALUE_MATRIX_VERSION,
          alpha_week_open_utc: alphaWeekOpenUtc,
          mapped_macro_week_id: macroWeekIdFor(alphaWeekOpenUtc),
          source_id: contract.source_id,
          instrument: contract.instrument,
          atom_key: contract.atom_key,
          currency,
          observation_date: selected?.observation_date ?? null,
          selected_observation_id: selectedId,
          raw_artifact_ids: selectedRawArtifactIds(selected),
          raw_artifact_hashes: diagnostic?.raw_artifact_hashes ?? [],
          value_key: contract.value_key,
          net_share_of_gross_available: netShare !== null,
          net_share_of_gross: netShare,
          timing_status: !selected
            ? "NO_SELECTED_OBSERVATION" as const
            : timingFailReasons.length > 0
              ? "FAIL_CLOSED_PUBLICATION_TIMING" as const
              : "CLEAN_POINT_IN_TIME" as const,
          timing_fail_closed_reasons: timingFailReasons,
          late_2025_publication_timing_row: timing?.late_2025_publication_timing_scope ?? false,
          value_status: valueMissing ? "VALUE_MISSING" as const : "VALUE_PRESENT" as const,
          value_missing_reason: valueMissingReason,
          value_missing_reason_detail: valueMissing ? diagnostic?.missing_reason_detail ?? "missing selected diagnostic row" : null,
          current_contract_label_present: diagnostic?.current_contract_label_present ?? false,
          rescue_alias_label_present: diagnostic?.rescue_alias_label_present ?? false,
          expected_source_label_present: diagnostic?.expected_source_label_present ?? false,
          parsed_expected_market_present: diagnostic?.parsed_expected_market_present ?? false,
          raw_commodity: diagnostic?.raw_commodity ?? null,
          same_date_other_contract_value_available: diagnostic?.same_date_other_contract_value_available ?? false,
          status: failClosedReasons.length === 0 ? "SOURCE_VALUE_AVAILABLE" as const : "FAIL_CLOSED" as const,
          fail_closed_reasons: failClosedReasons,
        };
        matrixRows.push({
          ...rowBase,
          content_hash: sha256Stable(rowBase),
        });
      }
    }
  }
  return matrixRows.sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    increment(result, value);
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function buildUnresolvedRows(input: {
  matrixRows: ValueAvailabilityMatrixRow[];
  publicationTimingRows: PublicationTimingRow[];
}) {
  const matrixUnresolved: UnresolvedRow[] = input.matrixRows
    .filter((row) => row.status === "FAIL_CLOSED")
    .map((row) => {
      const rowBase = {
        row_scope: "value_availability_matrix" as const,
        row_key: row.row_key,
        alpha_week_open_utc: row.alpha_week_open_utc,
        source_id: row.source_id,
        instrument: row.instrument,
        currency: row.currency,
        observation_date: row.observation_date,
        value_missing_reason: row.value_missing_reason,
        timing_fail_closed_reasons: row.timing_fail_closed_reasons,
        fail_closed_reasons: row.fail_closed_reasons,
      };
      return {
        ...rowBase,
        content_hash: sha256Stable(rowBase),
      };
    });

  const timingUnresolved: UnresolvedRow[] = input.publicationTimingRows
    .filter((row) => row.timing_status === "FAIL_CLOSED")
    .map((row) => {
      const rowBase = {
        row_scope: "publication_timing_source_observation" as const,
        row_key: row.row_key,
        source_id: row.source_id,
        instrument: row.instrument,
        currency: row.currency,
        observation_date: row.observation_date,
        timing_fail_closed_reasons: row.fail_closed_reasons,
        fail_closed_reasons: row.fail_closed_reasons,
      };
      return {
        ...rowBase,
        content_hash: sha256Stable(rowBase),
      };
    });

  return [...matrixUnresolved, ...timingUnresolved].sort((left, right) => {
    const scopeComparison = left.row_scope.localeCompare(right.row_scope);
    return scopeComparison || left.row_key.localeCompare(right.row_key);
  });
}

function buildValueSourceContract(input: {
  dataset: DatasetRecord | null;
  sourceDiagnostics: SourceObservationDiagnosticRow[];
  matrixRows: ValueAvailabilityMatrixRow[];
  publicationTimingRows: PublicationTimingRow[];
}) {
  return {
    gate_id: GATE_ID,
    contract_version: VALUE_SOURCE_CONTRACT_VERSION,
    dataset_id: BPR_DATASET_ID,
    dataset: input.dataset,
    source_family: "bpr",
    required_value_key: "netShareOfGross",
    allowed_use:
      "BPR value source-contract investigation only. No Regime transform, broad matrix, Regime LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, or source mutation.",
    bpr_contracts: BPR_CONTRACTS.map((contract) => {
      const sourceRows = input.sourceDiagnostics.filter((row) => row.source_id === contract.source_id);
      const matrixRows = input.matrixRows.filter((row) => row.source_id === contract.source_id);
      return {
        atom_key: contract.atom_key,
        label: contract.label,
        source_id: contract.source_id,
        report_type: contract.report_type,
        instrument: contract.instrument,
        current_contract_market_labels_by_currency: Object.fromEntries(BPR_CURRENCIES.map((currency) => [
          currency,
          contractLabelsForCurrency(currency),
        ])),
        rescue_alias_labels_by_currency: Object.fromEntries(BPR_CURRENCIES.map((currency) => [
          currency,
          rescueLabelsForCurrency(currency),
        ])),
        source_observation_rows: sourceRows.length,
        source_observation_value_present_rows: sourceRows.filter((row) => row.net_share_of_gross_available).length,
        source_observation_value_missing_rows: sourceRows.filter((row) => !row.net_share_of_gross_available).length,
        matrix_rows: matrixRows.length,
        matrix_value_present_rows: matrixRows.filter((row) => row.net_share_of_gross_available).length,
        matrix_value_missing_rows: matrixRows.filter((row) => !row.net_share_of_gross_available).length,
        matrix_fail_closed_rows: matrixRows.filter((row) => row.status === "FAIL_CLOSED").length,
      };
    }),
    value_classification_policy: {
      truly_absent_from_cftc_bpr_report:
        "A contracted futures currency row is absent from the raw CFTC BPR futures artifact text and parser replay.",
      parser_extraction_failure:
        "The raw artifact contains the current contracted currency label, but the stored observation has no matched commodity row.",
      source_id_instrument_mapping_error:
        "The stored source_id, instrument, or raw reportType is incompatible with the contracted BPR atom.",
      currency_mapping_error:
        "The raw artifact contains a currency alias that is not included in the current contracted currency label set.",
      wrong_chosen_bpr_atom_value_definition:
        "Raw bank long/short fields are present, but normalized netShareOfGross is absent.",
      futures_options_contract_limitation:
        "The CFTC BPR futures-and-options artifact lacks the contracted currency row.",
      irreducible_source_absence:
        "The missing value cannot be reduced with available raw artifact text and contracted labels.",
    },
    hard_rules: {
      no_neutral_fill: true,
      no_forward_fill: true,
      no_imputation: true,
      no_row_skipping: true,
      no_source_mutation: true,
      late_2025_publication_timing_rows_separate: true,
    },
    publication_timing_scope: {
      late_2025_publication_timing_source_rows: input.publicationTimingRows.filter((row) => row.timing_status === "FAIL_CLOSED").length,
      late_2025_publication_timing_observation_dates: uniqueSorted(input.publicationTimingRows
        .filter((row) => row.timing_status === "FAIL_CLOSED")
        .map((row) => row.observation_date)),
    },
  };
}

function buildFailClosedReceipt(input: {
  matrixRows: ValueAvailabilityMatrixRow[];
  sourceDiagnostics: SourceObservationDiagnosticRow[];
  publicationTimingRows: PublicationTimingRow[];
  unresolvedRows: UnresolvedRow[];
}) {
  const valueMissingRows = input.matrixRows.filter((row) => !row.net_share_of_gross_available);
  const timingMatrixRows = input.matrixRows.filter((row) => row.timing_status === "FAIL_CLOSED_PUBLICATION_TIMING");
  const timingSourceRows = input.publicationTimingRows.filter((row) => row.timing_status === "FAIL_CLOSED");
  const sourceMissingRows = input.sourceDiagnostics.filter((row) => !row.net_share_of_gross_available);
  const matrixByReason = countBy(valueMissingRows, (row) => row.value_missing_reason);
  const sourceByReason = countBy(sourceMissingRows, (row) => row.missing_reason);
  return {
    receipt_version: FAIL_CLOSED_RECEIPT_VERSION,
    verdict: "FAIL_CLOSED_BPR_VALUE_SOURCE_CONTRACT_UNRESOLVED_ROWS_REMAIN__NO_REGIME_SIDE",
    matrix_rows: input.matrixRows.length,
    matrix_value_present_rows: input.matrixRows.filter((row) => row.net_share_of_gross_available).length,
    matrix_value_missing_rows: valueMissingRows.length,
    matrix_fail_closed_rows: input.matrixRows.filter((row) => row.status === "FAIL_CLOSED").length,
    matrix_publication_timing_fail_closed_rows: timingMatrixRows.length,
    matrix_value_missing_and_publication_timing_overlap_rows: input.matrixRows.filter((row) =>
      !row.net_share_of_gross_available &&
      row.timing_status === "FAIL_CLOSED_PUBLICATION_TIMING").length,
    source_observation_rows: input.sourceDiagnostics.length,
    source_observation_value_present_rows: input.sourceDiagnostics.filter((row) => row.net_share_of_gross_available).length,
    source_observation_value_missing_rows: sourceMissingRows.length,
    late_2025_publication_timing_source_rows_separate: timingSourceRows.length,
    unresolved_rows: input.unresolvedRows.length,
    matrix_missing_reason_counts: matrixByReason,
    source_observation_missing_reason_counts: sourceByReason,
    matrix_missing_reason_counts_by_source_currency: Object.fromEntries(
      BPR_CONTRACTS.flatMap((contract) => BPR_CURRENCIES.map((currency) => {
        const rows = valueMissingRows.filter((row) => row.source_id === contract.source_id && row.currency === currency);
        return [`${contract.source_id}|${currency}`, countBy(rows, (row) => row.value_missing_reason)] as const;
      })).filter(([, counts]) => Object.keys(counts).length > 0),
    ),
    repair_candidates_without_source_mutation: {
      source_observation_currency_mapping_errors: sourceMissingRows.filter((row) => row.missing_reason === "currency_mapping_error").length,
      matrix_currency_mapping_error_rows: valueMissingRows.filter((row) => row.value_missing_reason === "currency_mapping_error").length,
      source_observation_parser_extraction_failures: sourceMissingRows.filter((row) => row.missing_reason === "parser_extraction_failure").length,
      matrix_parser_extraction_failure_rows: valueMissingRows.filter((row) => row.value_missing_reason === "parser_extraction_failure").length,
    },
    stop_line:
      "Gate 60E stops at BPR value source-contract diagnosis. No Regime transform, broad matrix, Regime side, support/oppose/fade label, P&L, attribution, Alpha v2, risk/execution/MT5/live/app work, or source mutation was run.",
  };
}

function renderSummaryMarkdown(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  failClosedReceipt: Record<string, unknown>;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60E BPR Value Source-Contract Rescue Summary",
    "",
    `Generated: \`${input.generatedAt}\``,
    "",
    `Verdict: \`${input.verdict}\``,
    "",
    "## Denominator",
    "",
    `- Gate 59 input rows: \`${input.denominator.input_rows}\``,
    `- Gate 59 weeks: \`${input.denominator.alpha_weeks}\``,
    `- Symbols per week histogram: \`${JSON.stringify(input.denominator.symbols_per_week_histogram)}\``,
    `- BPR value matrix rows: \`${input.denominator.bpr_value_matrix_rows}\``,
    "",
    "## Value Missing Classification",
    "",
    `- Matrix value missing rows: \`${input.failClosedReceipt.matrix_value_missing_rows}\``,
    `- Matrix publication-timing fail-closed rows: \`${input.failClosedReceipt.matrix_publication_timing_fail_closed_rows}\``,
    `- Separate late-2025 publication timing source rows: \`${input.failClosedReceipt.late_2025_publication_timing_source_rows_separate}\``,
    `- Matrix missing reason counts: \`${JSON.stringify(input.failClosedReceipt.matrix_missing_reason_counts)}\``,
    `- Source-observation missing reason counts: \`${JSON.stringify(input.failClosedReceipt.source_observation_missing_reason_counts)}\``,
    "",
    "## Hashes",
    "",
    `- Value source contract hash: \`${input.hashes.bpr_value_source_contract_hash}\``,
    `- Value availability matrix hash: \`${input.hashes.bpr_value_availability_matrix_hash}\``,
    `- Fail-closed receipt hash: \`${input.hashes.bpr_value_fail_closed_receipt_hash}\``,
    `- Source content invariant hash: \`${input.hashes.bpr_value_source_content_invariant_hash}\``,
    "",
  ].join("\n");
}

function renderReceipt(input: {
  generatedAt: string;
  gitCommit: string;
  dirtyStatus: string;
  dirtyFiles: string[];
  dataset: DatasetRecord | null;
  observationsRead: number;
  artifactsRead: number;
  availabilityEventsRead: number;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60E BPR Value Source-Contract Rescue Query Receipt",
    "",
    `Generated: \`${input.generatedAt}\``,
    `Command: \`${COMMAND}\``,
    `Git commit: \`${input.gitCommit}\``,
    `Git dirty status before artifact write: \`${input.dirtyStatus}\``,
    `Git dirty files before artifact write: \`${input.dirtyFiles.join(", ") || "none"}\``,
    "",
    "## Source Reads",
    "",
    `- BPR dataset id: \`${BPR_DATASET_ID}\``,
    `- BPR dataset version: \`${input.dataset?.dataset_version ?? "missing"}\``,
    `- BPR source observations read: \`${input.observationsRead}\``,
    `- BPR raw artifacts read: \`${input.artifactsRead}\``,
    `- BPR availability events read: \`${input.availabilityEventsRead}\``,
    "",
    "Read-only database probe and raw-artifact inspection against the frozen Gate 59 Alpha v1 denominator. No macro source rows were inserted, updated, deleted, neutralized, forward-filled, imputed, or skipped.",
    "",
    "## Content Hashes",
    "",
    `- BPR value source contract hash: \`${input.hashes.bpr_value_source_contract_hash}\``,
    `- BPR raw artifact value index hash: \`${input.hashes.bpr_raw_artifact_value_index_hash}\``,
    `- BPR source observation value diagnostic hash: \`${input.hashes.bpr_source_observation_value_diagnostic_hash}\``,
    `- BPR value availability matrix hash: \`${input.hashes.bpr_value_availability_matrix_hash}\``,
    `- BPR publication timing separate hash: \`${input.hashes.bpr_publication_timing_separate_hash}\``,
    `- BPR unresolved rows hash: \`${input.hashes.bpr_unresolved_rows_hash}\``,
    `- BPR value source content invariant hash: \`${input.hashes.bpr_value_source_content_invariant_hash}\``,
    "",
  ].join("\n");
}

function renderReport(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  failClosedReceipt: ReturnType<typeof buildFailClosedReceipt>;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60E BPR Value Source-Contract Rescue",
    "",
    `Generated: \`${input.generatedAt}\``,
    "",
    `Verdict: \`${input.verdict}\``,
    "",
    "Gate 60E is BPR-only and source-contract-only. It investigates missing `netShareOfGross` values against raw CFTC BPR artifacts and the frozen Gate 59 Alpha v1 denominator. It emits no Regime transform, no broad matrix, no Regime LONG/SHORT side, no support/oppose/fade labels, no P&L, no attribution, no Alpha v2, and no risk/execution/MT5/live/app work.",
    "",
    "## Boundary",
    "",
    "- No COT, Strength, Alpha v1, Gate 59, or macro source row mutation.",
    "- No neutral fill, forward fill, imputation, or row skipping.",
    "- Late-2025 BPR publication timing rows remain separate from value-missing rows.",
    "- Any rescue candidate requires a separately versioned source contract before rows may be changed.",
    "",
    "## Denominator",
    "",
    `- Gate 59 rows: \`${input.denominator.input_rows}\``,
    `- Gate 59 weeks: \`${input.denominator.alpha_weeks}\``,
    `- Symbols per week histogram: \`${JSON.stringify(input.denominator.symbols_per_week_histogram)}\``,
    `- Duplicate Gate 59 row keys: \`${input.denominator.duplicate_input_row_keys}\``,
    `- BPR value matrix rows: \`${input.denominator.bpr_value_matrix_rows}\``,
    `- Duplicate BPR value matrix row keys: \`${input.denominator.duplicate_bpr_value_matrix_row_keys}\``,
    "",
    "## Classification",
    "",
    `- Matrix value present rows: \`${input.failClosedReceipt.matrix_value_present_rows}\``,
    `- Matrix value missing rows: \`${input.failClosedReceipt.matrix_value_missing_rows}\``,
    `- Matrix fail-closed rows: \`${input.failClosedReceipt.matrix_fail_closed_rows}\``,
    `- Matrix publication-timing fail-closed rows: \`${input.failClosedReceipt.matrix_publication_timing_fail_closed_rows}\``,
    `- Matrix value/timing overlap rows: \`${input.failClosedReceipt.matrix_value_missing_and_publication_timing_overlap_rows}\``,
    `- Separate late-2025 publication timing source rows: \`${input.failClosedReceipt.late_2025_publication_timing_source_rows_separate}\``,
    "",
    "Matrix missing reason counts:",
    "",
    "```json",
    JSON.stringify(input.failClosedReceipt.matrix_missing_reason_counts, null, 2),
    "```",
    "",
    "Source-observation missing reason counts:",
    "",
    "```json",
    JSON.stringify(input.failClosedReceipt.source_observation_missing_reason_counts, null, 2),
    "```",
    "",
    "Matrix missing reason counts by source/currency:",
    "",
    "```json",
    JSON.stringify(input.failClosedReceipt.matrix_missing_reason_counts_by_source_currency, null, 2),
    "```",
    "",
    "## Result",
    "",
    "BPR remains fail-closed. The only source-contract rescue candidate is a currency-label contract issue: March 2020 NZD futures uses `CME NEW ZEALAND DOLLAR`, while the current contracted FX label set only includes `NZ DOLLAR`. Gate 60E records this but does not mutate the source rows. The dominant missing rows remain CFTC report absence or futures/options contract limitation.",
    "",
    "## Hashes",
    "",
    `- BPR value source contract hash: \`${input.hashes.bpr_value_source_contract_hash}\``,
    `- BPR raw artifact value index hash: \`${input.hashes.bpr_raw_artifact_value_index_hash}\``,
    `- BPR source observation value diagnostic hash: \`${input.hashes.bpr_source_observation_value_diagnostic_hash}\``,
    `- BPR value availability matrix hash: \`${input.hashes.bpr_value_availability_matrix_hash}\``,
    `- BPR fail-closed receipt hash: \`${input.hashes.bpr_value_fail_closed_receipt_hash}\``,
    `- BPR source content invariant hash: \`${input.hashes.bpr_value_source_content_invariant_hash}\``,
    "",
    "## Stop",
    "",
    "Stop here. Do not proceed to BPR promotion, Regime atom transforms, broad matrix, Regime side construction, Alpha v2, risk, execution, MT5/live, app work, or source mutation.",
    "",
  ].join("\n");
}

function gitState() {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  const dirtyFiles = status.trim().split(/\r?\n/).filter(Boolean);
  return {
    commit,
    dirtyStatus: dirtyFiles.length === 0 ? "clean" : "dirty",
    dirtyFiles,
  };
}

async function main() {
  const options = parseCli();
  const generatedAt = new Date().toISOString();
  const git = gitState();
  const alphaRows = await readAlphaRows(options.alphaLedgerPath);
  const alphaLedgerText = await readFile(options.alphaLedgerPath, "utf8");
  const dataset = await readBprDataset();
  const observations = await readBprObservations();
  const artifacts = await readBprArtifacts();
  const availabilityEvents = await readBprAvailabilityEvents();

  const denominator = denominatorProof(alphaRows);
  const alphaWeeks = uniqueSorted(alphaRows.map((row) => row.week.week_open_utc));
  const alphaCurrencies = uniqueSorted(alphaRows.flatMap((row) => [
    row.instrument.base_currency,
    row.instrument.quote_currency,
  ])).filter((currency) => BPR_CURRENCIES.includes(currency));

  const artifactRows = buildRawArtifactIndexRows(artifacts);
  const artifactIndexById = new Map(artifactRows.map((row) => [row.artifact_id, row]));
  const sourceDiagnostics = buildSourceObservationDiagnostics({ observations, artifactIndexes: artifactIndexById });
  const sourceDiagnosticByKey = new Map(sourceDiagnostics.map((row) => [row.row_key, row]));
  const publicationTimingRows = buildPublicationTimingRows({
    observations,
    events: eventById(availabilityEvents),
    artifacts: artifactById(artifacts),
  });
  const publicationTimingByKey = new Map(publicationTimingRows.map((row) => [row.row_key, row]));
  const matrixRows = buildValueAvailabilityMatrix({
    alphaWeeks,
    currencies: alphaCurrencies,
    observations,
    sourceDiagnostics: sourceDiagnosticByKey,
    publicationTimingRows: publicationTimingByKey,
  });
  const publicationTimingSeparateRows = publicationTimingRows.filter((row) => row.timing_status === "FAIL_CLOSED");
  const unresolvedRows = buildUnresolvedRows({ matrixRows, publicationTimingRows });
  const valueSourceContract = buildValueSourceContract({
    dataset,
    sourceDiagnostics,
    matrixRows,
    publicationTimingRows,
  });
  const failClosedReceipt = buildFailClosedReceipt({
    matrixRows,
    sourceDiagnostics,
    publicationTimingRows,
    unresolvedRows,
  });

  const outputDenominator = {
    ...denominator,
    bpr_currencies: alphaCurrencies,
    expected_bpr_currencies: BPR_CURRENCIES,
    bpr_value_matrix_rows: matrixRows.length,
    expected_bpr_value_matrix_rows: alphaWeeks.length * alphaCurrencies.length * BPR_CONTRACTS.length,
    dropped_bpr_value_matrix_rows: alphaWeeks.length * alphaCurrencies.length * BPR_CONTRACTS.length - matrixRows.length,
    duplicate_bpr_value_matrix_row_keys: countDuplicates(matrixRows.map((row) => row.row_key)),
    bpr_source_observation_diagnostic_rows: sourceDiagnostics.length,
    duplicate_bpr_source_observation_diagnostic_row_keys: countDuplicates(sourceDiagnostics.map((row) => row.row_key)),
    bpr_raw_artifact_index_rows: artifactRows.length,
    duplicate_bpr_raw_artifact_index_row_keys: countDuplicates(artifactRows.map((row) => row.row_key)),
  };
  if (
    outputDenominator.input_rows !== EXPECTED_ALPHA_ROWS ||
    outputDenominator.alpha_weeks !== EXPECTED_ALPHA_WEEKS ||
    outputDenominator.duplicate_input_row_keys !== 0 ||
    outputDenominator.duplicate_input_week_symbol_rows !== 0 ||
    outputDenominator.bpr_value_matrix_rows !== outputDenominator.expected_bpr_value_matrix_rows ||
    outputDenominator.dropped_bpr_value_matrix_rows !== 0 ||
    outputDenominator.duplicate_bpr_value_matrix_row_keys !== 0 ||
    outputDenominator.duplicate_bpr_source_observation_diagnostic_row_keys !== 0 ||
    outputDenominator.duplicate_bpr_raw_artifact_index_row_keys !== 0
  ) {
    throw new Error(`Gate 60E denominator invariant failed: ${JSON.stringify(outputDenominator, null, 2)}`);
  }

  const verdict = failClosedReceipt.unresolved_rows === 0
    ? "PASS_BPR_VALUE_SOURCE_CONTRACT_RESCUE_SOURCE_ONLY__NO_REGIME_SIDE"
    : "FAIL_CLOSED_BPR_VALUE_SOURCE_CONTRACT_UNRESOLVED_ROWS_REMAIN__NO_REGIME_SIDE";

  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const valueSourceContractPath = path.join(options.artifactDir, "gate60e-bpr-value-source-contract-v1.contract.json");
  const rawArtifactIndexPath = path.join(options.artifactDir, "gate60e-bpr-raw-artifact-value-index.rows.jsonl");
  const sourceObservationDiagnosticPath = path.join(options.artifactDir, "gate60e-bpr-source-observation-value-diagnostic.rows.jsonl");
  const valueMatrixPath = path.join(options.artifactDir, "gate60e-bpr-value-availability-matrix.rows.jsonl");
  const publicationTimingSeparatePath = path.join(options.artifactDir, "gate60e-bpr-publication-timing-separate.rows.jsonl");
  const failClosedReceiptPath = path.join(options.artifactDir, "gate60e-bpr-value-fail-closed-receipt.json");
  const unresolvedRowsPath = path.join(options.artifactDir, "gate60e-bpr-value-unresolved-rows.rows.jsonl");
  const summaryJsonPath = path.join(options.artifactDir, "gate60e-bpr-value-source-contract-rescue.summary.json");
  const summaryMdPath = path.join(options.artifactDir, "gate60e-bpr-value-source-contract-rescue.summary.md");
  const receiptPath = path.join(options.artifactDir, "gate60e-bpr-value-source-contract-rescue.query-receipt.md");
  const shaPath = path.join(options.artifactDir, "gate60e-bpr-value-source-contract-rescue.sha256.txt");

  const valueSourceContractText = `${JSON.stringify(valueSourceContract, null, 2)}\n`;
  const rawArtifactIndexText = `${artifactRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const sourceObservationDiagnosticText = `${sourceDiagnostics.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const valueMatrixText = `${matrixRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const publicationTimingSeparateText = `${publicationTimingSeparateRows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const failClosedReceiptText = `${JSON.stringify(failClosedReceipt, null, 2)}\n`;
  const unresolvedRowsText = unresolvedRows.length > 0 ? `${unresolvedRows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";

  const hashes = {
    gate59_alpha_ledger_jsonl_sha256: sha256Text(alphaLedgerText),
    bpr_value_source_contract_hash: sha256Text(valueSourceContractText),
    bpr_raw_artifact_value_index_hash: sha256Text(rawArtifactIndexText),
    bpr_source_observation_value_diagnostic_hash: sha256Text(sourceObservationDiagnosticText),
    bpr_value_availability_matrix_hash: sha256Text(valueMatrixText),
    bpr_publication_timing_separate_hash: sha256Text(publicationTimingSeparateText),
    bpr_value_fail_closed_receipt_hash: sha256Text(failClosedReceiptText),
    bpr_unresolved_rows_hash: sha256Text(unresolvedRowsText),
    bpr_value_source_content_invariant_hash: sha256Stable({
      dataset,
      value_source_contract_hash: sha256Text(valueSourceContractText),
      raw_artifact_value_index_hash: sha256Text(rawArtifactIndexText),
      source_observation_value_diagnostic_hash: sha256Text(sourceObservationDiagnosticText),
      value_availability_matrix_hash: sha256Text(valueMatrixText),
      publication_timing_separate_hash: sha256Text(publicationTimingSeparateText),
      fail_closed_receipt_hash: sha256Text(failClosedReceiptText),
      unresolved_rows_hash: sha256Text(unresolvedRowsText),
    }),
  };

  const summary = {
    gate_id: GATE_ID,
    verdict,
    command: COMMAND,
    denominator: outputDenominator,
    value_source_contract_version: VALUE_SOURCE_CONTRACT_VERSION,
    raw_artifact_index_version: RAW_ARTIFACT_INDEX_VERSION,
    source_observation_diagnostic_version: SOURCE_OBSERVATION_DIAGNOSTIC_VERSION,
    value_matrix_version: VALUE_MATRIX_VERSION,
    publication_timing_separate_version: PUBLICATION_TIMING_SEPARATE_VERSION,
    fail_closed_receipt_version: FAIL_CLOSED_RECEIPT_VERSION,
    dataset_id: BPR_DATASET_ID,
    fail_closed_receipt: failClosedReceipt,
    hashes,
    stop_line:
      "Stop after BPR value source-contract rescue. No Regime transform, broad matrix, Regime LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, COT/Strength/Alpha v1/Gate59 mutation, or macro source row mutation.",
  };
  const summaryJsonText = `${JSON.stringify(summary, null, 2)}\n`;
  const summaryMdText = renderSummaryMarkdown({
    generatedAt,
    verdict,
    denominator: outputDenominator,
    failClosedReceipt,
    hashes,
  });
  const receiptText = renderReceipt({
    generatedAt,
    gitCommit: git.commit,
    dirtyStatus: git.dirtyStatus,
    dirtyFiles: git.dirtyFiles,
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
    failClosedReceipt,
    hashes,
  });

  const shaEntries = [
    ["gate59_alpha_ledger_jsonl", options.alphaLedgerPath, hashes.gate59_alpha_ledger_jsonl_sha256],
    ["bpr_value_source_contract", valueSourceContractPath, hashes.bpr_value_source_contract_hash],
    ["bpr_raw_artifact_value_index", rawArtifactIndexPath, hashes.bpr_raw_artifact_value_index_hash],
    ["bpr_source_observation_value_diagnostic", sourceObservationDiagnosticPath, hashes.bpr_source_observation_value_diagnostic_hash],
    ["bpr_value_availability_matrix", valueMatrixPath, hashes.bpr_value_availability_matrix_hash],
    ["bpr_publication_timing_separate", publicationTimingSeparatePath, hashes.bpr_publication_timing_separate_hash],
    ["bpr_value_fail_closed_receipt", failClosedReceiptPath, hashes.bpr_value_fail_closed_receipt_hash],
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
    `git_commit ${git.commit}`,
    `verdict ${verdict}`,
    ...shaEntries.map(([label, filePath, hash]) => `${label} ${hash} ${filePath === "content" ? filePath : toRepoRelative(filePath)}`),
    "",
  ].join("\n");

  await Promise.all([
    writeFile(valueSourceContractPath, valueSourceContractText),
    writeFile(rawArtifactIndexPath, rawArtifactIndexText),
    writeFile(sourceObservationDiagnosticPath, sourceObservationDiagnosticText),
    writeFile(valueMatrixPath, valueMatrixText),
    writeFile(publicationTimingSeparatePath, publicationTimingSeparateText),
    writeFile(failClosedReceiptPath, failClosedReceiptText),
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
    fail_closed_receipt: failClosedReceipt,
    hashes,
    artifacts: {
      value_source_contract: toRepoRelative(valueSourceContractPath),
      raw_artifact_value_index: toRepoRelative(rawArtifactIndexPath),
      source_observation_value_diagnostic: toRepoRelative(sourceObservationDiagnosticPath),
      value_availability_matrix: toRepoRelative(valueMatrixPath),
      publication_timing_separate: toRepoRelative(publicationTimingSeparatePath),
      fail_closed_receipt: toRepoRelative(failClosedReceiptPath),
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
