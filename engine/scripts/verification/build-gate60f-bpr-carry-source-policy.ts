import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 60F: bpr-carry-source-policy";
const COMMAND = "npm run engine:gate60f:bpr-carry-source-policy";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_GATE60E_DIR =
  "docs/research/gates/gate60e/artifacts/gate60e-bpr-value-source-contract-rescue";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate60f/artifacts/gate60f-bpr-carry-source-policy";
const DEFAULT_REPORT_PATH =
  "docs/research/gates/gate60f/GATE60F_BPR_CARRY_SOURCE_POLICY_2026-06-27.md";

const EXPECTED_ALPHA_ROWS = 10_444;
const EXPECTED_ALPHA_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const BPR_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"];

const SOURCE_POLICY_CONTRACT_VERSION = "gate60f_bpr_source_policy_contract_v1";
const ALIAS_POLICY_VERSION = "gate60f_bpr_nzd_alias_candidate_policy_v1";
const CARRY_POLICY_COMPARISON_VERSION = "gate60f_bpr_futures_carry_policy_comparison_v1";
const DERIVED_CARRIED_STATE_LEDGER_VERSION = "gate60f_bpr_futures_derived_carried_state_ledger_v1";
const FAIL_CLOSED_LEDGER_VERSION = "gate60f_bpr_futures_policy_fail_closed_ledger_v1";
const SUMMARY_VERSION = "gate60f_bpr_carry_source_policy_summary_v1";

type CliOptions = {
  alphaLedgerPath: string;
  gate60eDir: string;
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

type Gate60eValueMatrixRow = {
  row_key: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  source_id: "cftc_bpr_futures" | "cftc_bpr_options";
  instrument: "bank_participation_futures" | "bank_participation_futures_and_options";
  atom_key: "bpr_futures" | "bpr_futures_and_options";
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
  value_missing_reason:
    | "not_missing"
    | "truly_absent_from_cftc_bpr_report"
    | "parser_extraction_failure"
    | "source_id_instrument_mapping_error"
    | "currency_mapping_error"
    | "wrong_chosen_bpr_atom_value_definition"
    | "futures_options_contract_limitation"
    | "irreducible_source_absence";
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

type SourceObservationDiagnosticRow = {
  row_key: string;
  source_id: string;
  instrument: string;
  report_type: "f" | "o" | null;
  currency: string;
  observation_date: string;
  selected_observation_id: string;
  raw_artifact_ids: string[];
  raw_artifact_hashes: string[];
  net_share_of_gross_available: boolean;
  raw_commodity: string | null;
  current_contract_label_present: boolean;
  rescue_alias_label_present: boolean;
  expected_source_label_present: boolean;
  parsed_expected_market_present: boolean;
  missing_reason: string;
  missing_reason_detail: string | null;
  determination: string;
  source_contract_mutation_required_for_rescue: boolean;
  content_hash: string;
};

type RawArtifactIndexRow = {
  row_key: string;
  artifact_id: string;
  source_id: string;
  endpoint_id: string;
  endpoint_url: string;
  report_type: string | null;
  report_date: string | null;
  raw_payload_sha256: string;
  raw_payload_size_bytes: number;
  raw_payload_text_available: boolean;
  raw_payload_text_sha_matches_stored: boolean | null;
  http_status: number;
  parser_replay_status: string;
  parsed_market_count: number;
  parsed_fx_market_labels: string[];
  content_hash: string;
};

type PolicyMode = "no_carry" | "carry_max_days" | "carry_until_next_clean_report";

type CarryPolicy = {
  policy_key: "no_carry_fail_closed" | "carry_last_valid_clean_futures_45d" | "carry_last_valid_clean_futures_until_next_clean_report_stale_after_45d";
  carry_policy_version: string;
  mode: PolicyMode;
  maxCarryDays: number | null;
  staleAfterDays: number | null;
  description: string;
};

type LastValidFuturesValue = {
  source_id: "cftc_bpr_futures";
  instrument: "bank_participation_futures";
  currency: string;
  observation_date: string;
  selected_observation_id: string;
  raw_artifact_hash: string;
  raw_artifact_ids: string[];
  alpha_week_open_utc: string;
  value_hash: string;
};

type AliasImpactRow = {
  row_key: string;
  alias_policy_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: "NZD";
  source_id: "cftc_bpr_futures";
  instrument: "bank_participation_futures";
  selected_observation_id: string;
  current_report_observation_date: string;
  current_report_absence_reason: string;
  current_contract_labels: string[];
  candidate_alias_labels: string[];
  raw_artifact_ids: string[];
  raw_artifact_hashes: string[];
  source_state: "CANDIDATE_ALIAS_REPAIRED_STATE";
  candidate_impact_only: true;
  source_rows_mutated: false;
  content_hash: string;
};

type CarriedStateRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: string;
  source_id: "cftc_bpr_futures";
  instrument: "bank_participation_futures";
  required_bpr_v1_source: "bpr_futures";
  derived_atom_key: "bpr_futures_carried_state";
  current_report_observation_date: string;
  current_report_absence_reason: string;
  current_report_source_observation_id: string;
  current_report_artifact_hashes: string[];
  carried_from_observation_date: string;
  carried_from_source_observation_id: string;
  carried_from_artifact_hash: string;
  carried_from_artifact_ids: string[];
  carry_age_days: number;
  stale_carried_row: boolean;
  carry_policy_version: string;
  source_state: "DERIVED_CARRIED_STATE";
  raw_current_source_state: "RAW_CURRENT_REPORT_MISSING";
  source_rows_mutated: false;
  content_hash: string;
};

type FailClosedPolicyRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: string;
  source_id: "cftc_bpr_futures";
  instrument: "bank_participation_futures";
  current_report_observation_date: string | null;
  current_report_source_observation_id: string | null;
  current_report_artifact_hashes: string[];
  value_missing_reason: string;
  fail_closed_reason: string;
  timing_blocked: boolean;
  carry_policy_version: string;
  source_state: "FAIL_CLOSED_SOURCE_POLICY";
  source_rows_mutated: false;
  content_hash: string;
};

type ComparisonRow = {
  row_key: string;
  comparison_version: string;
  policy_key: CarryPolicy["policy_key"];
  carry_policy_version: string;
  required_bpr_v1_source_rows: number;
  raw_present_rows: number;
  repaired_alias_rows: number;
  true_absence_rows_carried: number;
  stale_carried_rows: number;
  still_fail_closed_rows: number;
  still_fail_closed_rows_excluding_timing: number;
  timing_blocked_rows: number;
  total_fail_closed_rows: number;
  futures_options_shadow_rows: number;
  futures_options_shadow_value_present_rows: number;
  futures_options_shadow_value_missing_rows: number;
  no_mixing_control_passed: boolean;
  content_hash: string;
};

const CARRY_POLICIES: CarryPolicy[] = [
  {
    policy_key: "no_carry_fail_closed",
    carry_policy_version: "gate60f_bpr_futures_no_carry_fail_closed_v1",
    mode: "no_carry",
    maxCarryDays: null,
    staleAfterDays: null,
    description: "No carry. Missing current BPR futures rows remain fail-closed.",
  },
  {
    policy_key: "carry_last_valid_clean_futures_45d",
    carry_policy_version: "gate60f_bpr_futures_carry_last_valid_clean_futures_45d_v1",
    mode: "carry_max_days",
    maxCarryDays: 45,
    staleAfterDays: null,
    description: "Carry the same-currency last valid clean BPR futures value only when the current clean futures report is truly absent and carry age is <= 45 days.",
  },
  {
    policy_key: "carry_last_valid_clean_futures_until_next_clean_report_stale_after_45d",
    carry_policy_version: "gate60f_bpr_futures_carry_last_valid_clean_futures_until_next_clean_report_stale_after_45d_v1",
    mode: "carry_until_next_clean_report",
    maxCarryDays: null,
    staleAfterDays: 45,
    description: "Carry the same-currency last valid clean BPR futures value across true source absence until a new clean current futures value appears; expose stale flag after 45 days.",
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
    gate60eDir: value("gate60e-dir") ?? DEFAULT_GATE60E_DIR,
    artifactDir: value("artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: value("report") ?? DEFAULT_REPORT_PATH,
  };
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

function dateDiffDays(leftIsoDate: string, rightIsoDate: string) {
  const left = new Date(`${leftIsoDate}T00:00:00.000Z`).getTime();
  const right = new Date(`${rightIsoDate}T00:00:00.000Z`).getTime();
  return Math.round((left - right) / 86_400_000);
}

function jsonlText<T>(rows: T[]) {
  return rows.length > 0 ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
}

async function readJsonl<T>(filePath: string) {
  const text = await readFile(filePath, "utf8");
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function readAlphaRows(alphaLedgerPath: string) {
  return readJsonl<AlphaLedgerRow>(alphaLedgerPath);
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
  return {
    input_rows: alphaRows.length,
    expected_input_rows: EXPECTED_ALPHA_ROWS,
    alpha_weeks: weeks.length,
    expected_alpha_weeks: EXPECTED_ALPHA_WEEKS,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    symbols_per_week_histogram: Object.fromEntries([...symbolsPerWeek.values()].reduce<Map<string, number>>((counts, symbols) => {
      const key = String(symbols.size);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())),
    raw_rows_per_week_histogram: Object.fromEntries([...rawRowsPerWeek.values()].reduce<Map<string, number>>((counts, count) => {
      const key = String(count);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())),
    full_weeks: [...symbolsPerWeek.values()].filter((symbols) => symbols.size === EXPECTED_SYMBOLS_PER_WEEK).length,
    duplicate_input_row_keys: countDuplicates(rowKeys),
    duplicate_input_week_symbol_rows: countDuplicates(weekSymbolKeys),
  };
}

function diagnosticBySelectedObservation(rows: SourceObservationDiagnosticRow[]) {
  return new Map(rows.map((row) => [row.selected_observation_id, row]));
}

function artifactByHash(rows: RawArtifactIndexRow[]) {
  const result = new Map<string, RawArtifactIndexRow>();
  for (const row of rows) result.set(row.raw_payload_sha256.toUpperCase(), row);
  return result;
}

function isTimingBlocked(row: Gate60eValueMatrixRow) {
  return row.timing_status === "FAIL_CLOSED_PUBLICATION_TIMING" ||
    row.late_2025_publication_timing_row ||
    row.timing_fail_closed_reasons.length > 0;
}

function isRawPresentClean(row: Gate60eValueMatrixRow) {
  return row.atom_key === "bpr_futures" &&
    row.net_share_of_gross_available &&
    row.timing_status === "CLEAN_POINT_IN_TIME";
}

function isAliasCandidate(row: Gate60eValueMatrixRow) {
  return row.atom_key === "bpr_futures" &&
    row.source_id === "cftc_bpr_futures" &&
    row.currency === "NZD" &&
    row.timing_status === "CLEAN_POINT_IN_TIME" &&
    row.value_missing_reason === "currency_mapping_error" &&
    row.rescue_alias_label_present;
}

function isTrueAbsentFutures(row: Gate60eValueMatrixRow) {
  return row.atom_key === "bpr_futures" &&
    row.source_id === "cftc_bpr_futures" &&
    row.timing_status === "CLEAN_POINT_IN_TIME" &&
    row.value_missing_reason === "truly_absent_from_cftc_bpr_report";
}

function makeLastValid(row: Gate60eValueMatrixRow): LastValidFuturesValue {
  if (!row.observation_date || !row.selected_observation_id) {
    throw new Error(`Cannot build carry source from incomplete row ${row.row_key}`);
  }
  return {
    source_id: "cftc_bpr_futures",
    instrument: "bank_participation_futures",
    currency: row.currency,
    observation_date: row.observation_date,
    selected_observation_id: row.selected_observation_id,
    raw_artifact_hash: row.raw_artifact_hashes[0] ?? "missing_artifact_hash",
    raw_artifact_ids: row.raw_artifact_ids,
    alpha_week_open_utc: row.alpha_week_open_utc,
    value_hash: sha256Stable({
      value_key: row.value_key,
      net_share_of_gross: row.net_share_of_gross,
      observation_date: row.observation_date,
      selected_observation_id: row.selected_observation_id,
      raw_artifact_hashes: row.raw_artifact_hashes,
    }),
  };
}

function buildAliasImpactRows(futuresRows: Gate60eValueMatrixRow[]) {
  const rows: AliasImpactRow[] = [];
  for (const row of futuresRows.filter(isAliasCandidate)) {
    if (!row.observation_date || !row.selected_observation_id) continue;
    const rowBase = {
      row_key: `alias_policy|${ALIAS_POLICY_VERSION}|${row.alpha_week_open_utc}|NZD|${row.selected_observation_id}`,
      alias_policy_version: ALIAS_POLICY_VERSION,
      alpha_week_open_utc: row.alpha_week_open_utc,
      mapped_macro_week_id: row.mapped_macro_week_id,
      currency: "NZD" as const,
      source_id: "cftc_bpr_futures" as const,
      instrument: "bank_participation_futures" as const,
      selected_observation_id: row.selected_observation_id,
      current_report_observation_date: row.observation_date,
      current_report_absence_reason: row.value_missing_reason,
      current_contract_labels: ["NZ DOLLAR"],
      candidate_alias_labels: ["NEW ZEALAND DOLLAR", "CME NEW ZEALAND DOLLAR"],
      raw_artifact_ids: row.raw_artifact_ids,
      raw_artifact_hashes: row.raw_artifact_hashes,
      source_state: "CANDIDATE_ALIAS_REPAIRED_STATE" as const,
      candidate_impact_only: true as const,
      source_rows_mutated: false as const,
    };
    rows.push({
      ...rowBase,
      content_hash: sha256Stable(rowBase),
    });
  }
  return rows.sort((left, right) => left.row_key.localeCompare(right.row_key));
}

function failClosedReasonFor(row: Gate60eValueMatrixRow, policy: CarryPolicy, lastValid: LastValidFuturesValue | null) {
  if (isTimingBlocked(row)) return "timing_or_source_ambiguous_report_blocks_carry";
  if (isAliasCandidate(row)) return "candidate_alias_impact_only_not_promoted";
  if (isTrueAbsentFutures(row)) {
    if (policy.mode === "no_carry") return "no_carry_policy_fail_closed";
    if (!lastValid) return "no_prior_valid_clean_futures_value";
    if (!row.observation_date) return "missing_current_report_observation_date";
    const ageDays = dateDiffDays(row.observation_date, lastValid.observation_date);
    if (policy.mode === "carry_max_days" && policy.maxCarryDays !== null && ageDays > policy.maxCarryDays) {
      return `carry_age_exceeds_${policy.maxCarryDays}_days`;
    }
    return "not_fail_closed";
  }
  return `unsupported_bpr_futures_missing_reason:${row.value_missing_reason}`;
}

function evaluatePolicy(input: {
  policy: CarryPolicy;
  futuresRows: Gate60eValueMatrixRow[];
  futuresOptionsRows: Gate60eValueMatrixRow[];
}) {
  const carriedRows: CarriedStateRow[] = [];
  const failClosedRows: FailClosedPolicyRow[] = [];
  const aliasRows = buildAliasImpactRows(input.futuresRows);
  const rawPresentRowKeys = new Set<string>();
  const timingBlockedRowKeys = new Set<string>();
  const sortedFuturesRows = [...input.futuresRows].sort((left, right) => {
    const currencyComparison = left.currency.localeCompare(right.currency);
    return currencyComparison || left.alpha_week_open_utc.localeCompare(right.alpha_week_open_utc);
  });

  const lastValidByCurrency = new Map<string, LastValidFuturesValue | null>();

  for (const row of sortedFuturesRows) {
    const policyRowKey = `${input.policy.carry_policy_version}|${row.row_key}`;
    let lastValid = lastValidByCurrency.get(row.currency) ?? null;

    if (isRawPresentClean(row)) {
      rawPresentRowKeys.add(row.row_key);
      lastValid = makeLastValid(row);
      lastValidByCurrency.set(row.currency, lastValid);
      continue;
    }

    if (isTimingBlocked(row)) {
      timingBlockedRowKeys.add(row.row_key);
      lastValidByCurrency.set(row.currency, null);
      const rowBase = {
        row_key: policyRowKey,
        ledger_version: FAIL_CLOSED_LEDGER_VERSION,
        alpha_week_open_utc: row.alpha_week_open_utc,
        mapped_macro_week_id: row.mapped_macro_week_id,
        currency: row.currency,
        source_id: "cftc_bpr_futures" as const,
        instrument: "bank_participation_futures" as const,
        current_report_observation_date: row.observation_date,
        current_report_source_observation_id: row.selected_observation_id,
        current_report_artifact_hashes: row.raw_artifact_hashes,
        value_missing_reason: row.value_missing_reason,
        fail_closed_reason: "timing_or_source_ambiguous_report_blocks_carry",
        timing_blocked: true,
        carry_policy_version: input.policy.carry_policy_version,
        source_state: "FAIL_CLOSED_SOURCE_POLICY" as const,
        source_rows_mutated: false as const,
      };
      failClosedRows.push({ ...rowBase, content_hash: sha256Stable(rowBase) });
      continue;
    }

    if (isAliasCandidate(row)) {
      const rowBase = {
        row_key: policyRowKey,
        ledger_version: FAIL_CLOSED_LEDGER_VERSION,
        alpha_week_open_utc: row.alpha_week_open_utc,
        mapped_macro_week_id: row.mapped_macro_week_id,
        currency: row.currency,
        source_id: "cftc_bpr_futures" as const,
        instrument: "bank_participation_futures" as const,
        current_report_observation_date: row.observation_date,
        current_report_source_observation_id: row.selected_observation_id,
        current_report_artifact_hashes: row.raw_artifact_hashes,
        value_missing_reason: row.value_missing_reason,
        fail_closed_reason: "candidate_alias_impact_only_not_promoted",
        timing_blocked: false,
        carry_policy_version: input.policy.carry_policy_version,
        source_state: "FAIL_CLOSED_SOURCE_POLICY" as const,
        source_rows_mutated: false as const,
      };
      failClosedRows.push({ ...rowBase, content_hash: sha256Stable(rowBase) });
      continue;
    }

    if (isTrueAbsentFutures(row) && lastValid && row.observation_date && row.selected_observation_id) {
      const ageDays = dateDiffDays(row.observation_date, lastValid.observation_date);
      const withinMaxCarry = input.policy.mode !== "carry_max_days" ||
        input.policy.maxCarryDays === null ||
        ageDays <= input.policy.maxCarryDays;
      if (input.policy.mode !== "no_carry" && withinMaxCarry) {
        const staleCarriedRow = input.policy.staleAfterDays !== null && ageDays > input.policy.staleAfterDays;
        const rowBase = {
          row_key: `${input.policy.carry_policy_version}|${row.alpha_week_open_utc}|${row.currency}|${row.selected_observation_id}`,
          ledger_version: DERIVED_CARRIED_STATE_LEDGER_VERSION,
          alpha_week_open_utc: row.alpha_week_open_utc,
          mapped_macro_week_id: row.mapped_macro_week_id,
          currency: row.currency,
          source_id: "cftc_bpr_futures" as const,
          instrument: "bank_participation_futures" as const,
          required_bpr_v1_source: "bpr_futures" as const,
          derived_atom_key: "bpr_futures_carried_state" as const,
          current_report_observation_date: row.observation_date,
          current_report_absence_reason: row.value_missing_reason,
          current_report_source_observation_id: row.selected_observation_id,
          current_report_artifact_hashes: row.raw_artifact_hashes,
          carried_from_observation_date: lastValid.observation_date,
          carried_from_source_observation_id: lastValid.selected_observation_id,
          carried_from_artifact_hash: lastValid.raw_artifact_hash,
          carried_from_artifact_ids: lastValid.raw_artifact_ids,
          carry_age_days: ageDays,
          stale_carried_row: staleCarriedRow,
          carry_policy_version: input.policy.carry_policy_version,
          source_state: "DERIVED_CARRIED_STATE" as const,
          raw_current_source_state: "RAW_CURRENT_REPORT_MISSING" as const,
          source_rows_mutated: false as const,
        };
        carriedRows.push({ ...rowBase, content_hash: sha256Stable(rowBase) });
        continue;
      }
    }

    const reason = failClosedReasonFor(row, input.policy, lastValid);
    const rowBase = {
      row_key: policyRowKey,
      ledger_version: FAIL_CLOSED_LEDGER_VERSION,
      alpha_week_open_utc: row.alpha_week_open_utc,
      mapped_macro_week_id: row.mapped_macro_week_id,
      currency: row.currency,
      source_id: "cftc_bpr_futures" as const,
      instrument: "bank_participation_futures" as const,
      current_report_observation_date: row.observation_date,
      current_report_source_observation_id: row.selected_observation_id,
      current_report_artifact_hashes: row.raw_artifact_hashes,
      value_missing_reason: row.value_missing_reason,
      fail_closed_reason: reason === "not_fail_closed" ? "policy_failed_to_emit_carried_state" : reason,
      timing_blocked: false,
      carry_policy_version: input.policy.carry_policy_version,
      source_state: "FAIL_CLOSED_SOURCE_POLICY" as const,
      source_rows_mutated: false as const,
    };
    failClosedRows.push({ ...rowBase, content_hash: sha256Stable(rowBase) });
  }

  const stillFailClosedRowsExcludingTiming = failClosedRows.filter((row) => !row.timing_blocked).length;
  const comparisonBase = {
    row_key: input.policy.carry_policy_version,
    comparison_version: CARRY_POLICY_COMPARISON_VERSION,
    policy_key: input.policy.policy_key,
    carry_policy_version: input.policy.carry_policy_version,
    required_bpr_v1_source_rows: input.futuresRows.length,
    raw_present_rows: rawPresentRowKeys.size,
    repaired_alias_rows: aliasRows.length,
    true_absence_rows_carried: carriedRows.length,
    stale_carried_rows: carriedRows.filter((row) => row.stale_carried_row).length,
    still_fail_closed_rows: failClosedRows.length,
    still_fail_closed_rows_excluding_timing: stillFailClosedRowsExcludingTiming,
    timing_blocked_rows: timingBlockedRowKeys.size,
    total_fail_closed_rows: failClosedRows.length,
    futures_options_shadow_rows: input.futuresOptionsRows.length,
    futures_options_shadow_value_present_rows: input.futuresOptionsRows.filter((row) => row.net_share_of_gross_available).length,
    futures_options_shadow_value_missing_rows: input.futuresOptionsRows.filter((row) => !row.net_share_of_gross_available).length,
    no_mixing_control_passed: carriedRows.every((row) => row.source_id === "cftc_bpr_futures") &&
      failClosedRows.every((row) => row.source_id === "cftc_bpr_futures"),
  };

  return {
    aliasRows,
    carriedRows,
    failClosedRows,
    comparisonRow: {
      ...comparisonBase,
      content_hash: sha256Stable(comparisonBase),
    },
  };
}

function buildSourcePolicyContract(input: {
  gate60eHashes: Record<string, string>;
  comparisonRows: ComparisonRow[];
}) {
  return {
    gate_id: GATE_ID,
    contract_version: SOURCE_POLICY_CONTRACT_VERSION,
    required_bpr_v1_candidate: "bpr_futures",
    derived_candidate: "bpr_futures_carried_state",
    shadow_diagnostic_only: "bpr_futures_and_options",
    candidate_alias_policy: {
      alias_policy_version: ALIAS_POLICY_VERSION,
      currency: "NZD",
      source_id: "cftc_bpr_futures",
      current_contract_label: "NZ DOLLAR",
      candidate_alias_labels: ["NEW ZEALAND DOLLAR", "CME NEW ZEALAND DOLLAR"],
      candidate_impact_only: true,
      source_rows_mutated: false,
    },
    hard_rules: {
      bpr_only: true,
      source_policy_only: true,
      no_regime_transform: true,
      no_broad_matrix: true,
      no_regime_side: true,
      no_support_oppose_fade_labels: true,
      no_pnl: true,
      no_attribution: true,
      no_alpha_v2: true,
      no_risk_execution_mt5_live_app: true,
      no_source_mutation: true,
      no_silent_carry_forward: true,
      do_not_mix_bpr_futures_and_futures_options: true,
      do_not_use_one_contract_to_fill_the_other: true,
      do_not_average_bpr_contracts: true,
      do_not_create_combined_bpr_atom_for_regime_v1: true,
      carry_only_within_same_currency_same_source_contract: true,
      current_report_missing_remains_visible: true,
      no_carry_across_timing_or_source_ambiguous_reports: true,
    },
    carry_policies: CARRY_POLICIES,
    gate60e_input_hashes: input.gate60eHashes,
    policy_comparison_hashes: input.comparisonRows.map((row) => ({
      policy_key: row.policy_key,
      carry_policy_version: row.carry_policy_version,
      content_hash: row.content_hash,
    })),
  };
}

function buildGate60eHashMap(shaText: string) {
  const result: Record<string, string> = {};
  for (const line of shaText.split(/\r?\n/)) {
    const match = line.match(/^([a-z0-9_]+)\s+([A-Fa-f0-9]{64})\s+/);
    if (match) result[match[1]] = match[2].toUpperCase();
  }
  return result;
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

function renderSummaryMarkdown(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  comparisonRows: ComparisonRow[];
  hashes: Record<string, string>;
}) {
  const table = [
    "| Policy | Raw present | Alias impact | Carried true absence | Stale carried | Still fail-closed | Timing-blocked | F/O shadow |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...input.comparisonRows.map((row) =>
      `| ${row.policy_key} | ${row.raw_present_rows} | ${row.repaired_alias_rows} | ${row.true_absence_rows_carried} | ${row.stale_carried_rows} | ${row.still_fail_closed_rows} | ${row.timing_blocked_rows} | ${row.futures_options_shadow_rows} |`),
  ].join("\n");

  return [
    "# Gate 60F BPR Carry Source-Policy Summary",
    "",
    `Generated: \`${input.generatedAt}\``,
    "",
    `Verdict: \`${input.verdict}\``,
    "",
    "## Denominator",
    "",
    `- Gate 59 rows: \`${input.denominator.input_rows}\``,
    `- Gate 59 weeks: \`${input.denominator.alpha_weeks}\``,
    `- BPR futures policy rows per candidate: \`${input.denominator.bpr_futures_required_rows}\``,
    `- BPR futures/options shadow rows: \`${input.denominator.bpr_futures_options_shadow_rows}\``,
    "",
    "## Row-Count Comparison",
    "",
    table,
    "",
    "## Hashes",
    "",
    `- Source policy contract hash: \`${input.hashes.bpr_source_policy_contract_hash}\``,
    `- Carry comparison hash: \`${input.hashes.bpr_futures_carry_policy_comparison_hash}\``,
    `- Derived carried-state ledger hash: \`${input.hashes.bpr_futures_derived_carried_state_hash}\``,
    `- Source content invariant hash: \`${input.hashes.bpr_source_policy_content_invariant_hash}\``,
    "",
  ].join("\n");
}

function renderReport(input: {
  generatedAt: string;
  verdict: string;
  denominator: Record<string, unknown>;
  comparisonRows: ComparisonRow[];
  hashes: Record<string, string>;
}) {
  const summaryTable = [
    "| Policy | Raw present rows | Repaired alias rows | True absence rows carried | Stale carried rows | Still fail-closed rows | Timing-blocked rows | Futures/options shadow rows |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...input.comparisonRows.map((row) =>
      `| \`${row.policy_key}\` | \`${row.raw_present_rows}\` | \`${row.repaired_alias_rows}\` | \`${row.true_absence_rows_carried}\` | \`${row.stale_carried_rows}\` | \`${row.still_fail_closed_rows}\` | \`${row.timing_blocked_rows}\` | \`${row.futures_options_shadow_rows}\` |`),
  ].join("\n");
  return [
    "# Gate 60F BPR Carry Source-Policy",
    "",
    `Generated: \`${input.generatedAt}\``,
    "",
    `Verdict: \`${input.verdict}\``,
    "",
    "Gate 60F is BPR-only and source-policy-only. It evaluates candidate source-state policies for truly absent BPR futures rows using Gate 60E artifacts and the frozen Gate 59 Alpha denominator. It emits no Regime transform, no broad matrix, no Regime LONG/SHORT side, no support/oppose/fade labels, no P&L, no attribution, no Alpha v2, and no risk/execution/MT5/live/app work.",
    "",
    "## Locked Source Direction",
    "",
    "- Required BPR v1 candidate: `bpr_futures`.",
    "- Derived candidate: `bpr_futures_carried_state`.",
    "- Shadow / diagnostic only: `bpr_futures_and_options`.",
    "- Do not mix BPR futures and BPR futures/options.",
    "- Do not use one BPR contract to fill the other.",
    "- Do not average the contracts or create a combined BPR atom for Regime v1.",
    "",
    "## Denominator",
    "",
    `- Gate 59 rows: \`${input.denominator.input_rows}\``,
    `- Gate 59 weeks: \`${input.denominator.alpha_weeks}\``,
    `- Symbols per week histogram: \`${JSON.stringify(input.denominator.symbols_per_week_histogram)}\``,
    `- BPR futures required rows: \`${input.denominator.bpr_futures_required_rows}\``,
    `- BPR futures/options shadow rows: \`${input.denominator.bpr_futures_options_shadow_rows}\``,
    "",
    "## Row-Count-Only Policy Comparison",
    "",
    summaryTable,
    "",
    "## Interpretation",
    "",
    "The NZD alias policy has candidate impact only and does not mutate the Gate 60E source rows. Carry-forward is evaluated only within `cftc_bpr_futures`, same currency, same source contract. Timing-blocked late-2025 rows remain fail-closed and reset the carry chain so no derived state crosses an ambiguous report.",
    "",
    "## Hashes",
    "",
    `- Source policy contract hash: \`${input.hashes.bpr_source_policy_contract_hash}\``,
    `- NZD alias impact hash: \`${input.hashes.bpr_nzd_alias_candidate_impact_hash}\``,
    `- Carry comparison hash: \`${input.hashes.bpr_futures_carry_policy_comparison_hash}\``,
    `- Derived carried-state ledger hash: \`${input.hashes.bpr_futures_derived_carried_state_hash}\``,
    `- Fail-closed source-policy ledger hash: \`${input.hashes.bpr_futures_policy_fail_closed_hash}\``,
    `- Source policy content invariant hash: \`${input.hashes.bpr_source_policy_content_invariant_hash}\``,
    "",
    "## Stop",
    "",
    "Stop here. Do not proceed to BPR promotion, Regime transforms, broad matrix, Regime side construction, Alpha v2, risk, execution, MT5/live, app work, or source mutation.",
    "",
  ].join("\n");
}

function renderReceipt(input: {
  generatedAt: string;
  gitCommit: string;
  dirtyStatus: string;
  dirtyFiles: string[];
  sourceReads: Record<string, number>;
  hashes: Record<string, string>;
}) {
  return [
    "# Gate 60F BPR Carry Source-Policy Query Receipt",
    "",
    `Generated: \`${input.generatedAt}\``,
    `Command: \`${COMMAND}\``,
    `Git commit: \`${input.gitCommit}\``,
    `Git dirty status before artifact write: \`${input.dirtyStatus}\``,
    `Git dirty files before artifact write: \`${input.dirtyFiles.join(", ") || "none"}\``,
    "",
    "## Source Reads",
    "",
    `- Gate 59 Alpha ledger rows read: \`${input.sourceReads.alpha_rows}\``,
    `- Gate 60E value availability matrix rows read: \`${input.sourceReads.value_matrix_rows}\``,
    `- Gate 60E raw artifact value index rows read: \`${input.sourceReads.raw_artifact_index_rows}\``,
    `- Gate 60E source-observation diagnostic rows read: \`${input.sourceReads.source_observation_diagnostic_rows}\``,
    `- Gate 60E unresolved rows read: \`${input.sourceReads.unresolved_rows}\``,
    "",
    "Read-only file probe against Gate 60E artifacts and the frozen Gate 59 Alpha denominator. No database write, source mutation, source fill, neutral fill, Regime transform, broad matrix, P&L, attribution, Alpha v2, risk, execution, MT5/live, or app work was run.",
    "",
    "## Content Hashes",
    "",
    `- BPR source policy contract hash: \`${input.hashes.bpr_source_policy_contract_hash}\``,
    `- BPR carry policy comparison hash: \`${input.hashes.bpr_futures_carry_policy_comparison_hash}\``,
    `- BPR source policy content invariant hash: \`${input.hashes.bpr_source_policy_content_invariant_hash}\``,
    "",
  ].join("\n");
}

async function main() {
  const options = parseCli();
  const generatedAt = new Date().toISOString();
  const git = gitState();

  const valueMatrixPath = path.join(options.gate60eDir, "gate60e-bpr-value-availability-matrix.rows.jsonl");
  const rawArtifactIndexPath = path.join(options.gate60eDir, "gate60e-bpr-raw-artifact-value-index.rows.jsonl");
  const sourceDiagnosticPath = path.join(options.gate60eDir, "gate60e-bpr-source-observation-value-diagnostic.rows.jsonl");
  const unresolvedPath = path.join(options.gate60eDir, "gate60e-bpr-value-unresolved-rows.rows.jsonl");
  const gate60eShaPath = path.join(options.gate60eDir, "gate60e-bpr-value-source-contract-rescue.sha256.txt");

  const alphaLedgerText = await readFile(options.alphaLedgerPath, "utf8");
  const gate60eShaText = await readFile(gate60eShaPath, "utf8");
  const valueMatrixText = await readFile(valueMatrixPath, "utf8");
  const rawArtifactIndexText = await readFile(rawArtifactIndexPath, "utf8");
  const sourceDiagnosticText = await readFile(sourceDiagnosticPath, "utf8");
  const unresolvedText = await readFile(unresolvedPath, "utf8");

  const alphaRows = await readAlphaRows(options.alphaLedgerPath);
  const matrixRows = valueMatrixText.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Gate60eValueMatrixRow);
  const artifactRows = rawArtifactIndexText.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as RawArtifactIndexRow);
  const sourceDiagnostics = sourceDiagnosticText.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as SourceObservationDiagnosticRow);
  const unresolvedRows = unresolvedText.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as unknown);

  const futuresRows = matrixRows
    .filter((row) => row.atom_key === "bpr_futures" && row.source_id === "cftc_bpr_futures")
    .sort((left, right) => left.currency.localeCompare(right.currency) || left.alpha_week_open_utc.localeCompare(right.alpha_week_open_utc));
  const futuresOptionsRows = matrixRows
    .filter((row) => row.atom_key === "bpr_futures_and_options" && row.source_id === "cftc_bpr_options")
    .sort((left, right) => left.currency.localeCompare(right.currency) || left.alpha_week_open_utc.localeCompare(right.alpha_week_open_utc));
  const aliasRows = buildAliasImpactRows(futuresRows);
  const diagnosticsByObservation = diagnosticBySelectedObservation(sourceDiagnostics);
  const artifactsByHash = artifactByHash(artifactRows);
  const diagnosticCoverageErrors = aliasRows.filter((row) => !diagnosticsByObservation.has(row.selected_observation_id)).length;
  const carriedSourceArtifactMissingErrors = futuresRows
    .filter(isRawPresentClean)
    .flatMap((row) => row.raw_artifact_hashes)
    .filter((hash) => !artifactsByHash.has(hash.toUpperCase())).length;

  const policyEvaluations = CARRY_POLICIES.map((policy) => evaluatePolicy({ policy, futuresRows, futuresOptionsRows }));
  const comparisonRows = policyEvaluations.map((evaluation) => evaluation.comparisonRow);
  const carriedRows = policyEvaluations.flatMap((evaluation) => evaluation.carriedRows)
    .sort((left, right) => left.row_key.localeCompare(right.row_key));
  const failClosedRows = policyEvaluations.flatMap((evaluation) => evaluation.failClosedRows)
    .sort((left, right) => left.row_key.localeCompare(right.row_key));

  const denominator = {
    ...denominatorProof(alphaRows),
    bpr_futures_required_rows: futuresRows.length,
    expected_bpr_futures_required_rows: EXPECTED_ALPHA_WEEKS * BPR_CURRENCIES.length,
    bpr_futures_options_shadow_rows: futuresOptionsRows.length,
    expected_bpr_futures_options_shadow_rows: EXPECTED_ALPHA_WEEKS * BPR_CURRENCIES.length,
    duplicate_bpr_futures_row_keys: countDuplicates(futuresRows.map((row) => row.row_key)),
    duplicate_bpr_futures_options_shadow_row_keys: countDuplicates(futuresOptionsRows.map((row) => row.row_key)),
    duplicate_alias_impact_row_keys: countDuplicates(aliasRows.map((row) => row.row_key)),
    duplicate_carried_state_row_keys: countDuplicates(carriedRows.map((row) => row.row_key)),
    duplicate_fail_closed_row_keys: countDuplicates(failClosedRows.map((row) => row.row_key)),
    diagnostic_coverage_errors: diagnosticCoverageErrors,
    carried_source_artifact_missing_errors: carriedSourceArtifactMissingErrors,
  };

  if (
    denominator.input_rows !== EXPECTED_ALPHA_ROWS ||
    denominator.alpha_weeks !== EXPECTED_ALPHA_WEEKS ||
    denominator.duplicate_input_row_keys !== 0 ||
    denominator.duplicate_input_week_symbol_rows !== 0 ||
    denominator.bpr_futures_required_rows !== denominator.expected_bpr_futures_required_rows ||
    denominator.bpr_futures_options_shadow_rows !== denominator.expected_bpr_futures_options_shadow_rows ||
    denominator.duplicate_bpr_futures_row_keys !== 0 ||
    denominator.duplicate_bpr_futures_options_shadow_row_keys !== 0 ||
    denominator.duplicate_alias_impact_row_keys !== 0 ||
    denominator.duplicate_carried_state_row_keys !== 0 ||
    denominator.duplicate_fail_closed_row_keys !== 0 ||
    denominator.diagnostic_coverage_errors !== 0 ||
    denominator.carried_source_artifact_missing_errors !== 0 ||
    !comparisonRows.every((row) => row.no_mixing_control_passed)
  ) {
    throw new Error(`Gate 60F invariant failed: ${JSON.stringify(denominator, null, 2)}`);
  }

  const gate60eInputHashes = {
    ...buildGate60eHashMap(gate60eShaText),
    gate60e_sha_identity_file_sha256: sha256Text(gate60eShaText),
    gate59_alpha_ledger_jsonl_sha256: sha256Text(alphaLedgerText),
    gate60e_value_matrix_file_sha256: sha256Text(valueMatrixText),
    gate60e_raw_artifact_index_file_sha256: sha256Text(rawArtifactIndexText),
    gate60e_source_diagnostic_file_sha256: sha256Text(sourceDiagnosticText),
    gate60e_unresolved_rows_file_sha256: sha256Text(unresolvedText),
  };
  const sourcePolicyContract = buildSourcePolicyContract({ gate60eHashes: gate60eInputHashes, comparisonRows });

  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const sourcePolicyContractPath = path.join(options.artifactDir, "gate60f-bpr-source-policy-v1.contract.json");
  const aliasImpactPath = path.join(options.artifactDir, "gate60f-bpr-nzd-alias-candidate-impact.rows.jsonl");
  const comparisonPath = path.join(options.artifactDir, "gate60f-bpr-futures-carry-policy-comparison.rows.jsonl");
  const carriedStatePath = path.join(options.artifactDir, "gate60f-bpr-futures-derived-carried-state.rows.jsonl");
  const failClosedPath = path.join(options.artifactDir, "gate60f-bpr-futures-policy-fail-closed.rows.jsonl");
  const summaryJsonPath = path.join(options.artifactDir, "gate60f-bpr-carry-source-policy.summary.json");
  const summaryMdPath = path.join(options.artifactDir, "gate60f-bpr-carry-source-policy.summary.md");
  const receiptPath = path.join(options.artifactDir, "gate60f-bpr-carry-source-policy.query-receipt.md");
  const shaPath = path.join(options.artifactDir, "gate60f-bpr-carry-source-policy.sha256.txt");

  const sourcePolicyContractText = `${JSON.stringify(sourcePolicyContract, null, 2)}\n`;
  const aliasImpactText = jsonlText(aliasRows);
  const comparisonText = jsonlText(comparisonRows);
  const carriedStateText = jsonlText(carriedRows);
  const failClosedText = jsonlText(failClosedRows);

  const hashes = {
    gate59_alpha_ledger_jsonl_sha256: sha256Text(alphaLedgerText),
    gate60e_sha_identity_file_sha256: sha256Text(gate60eShaText),
    gate60e_value_matrix_file_sha256: sha256Text(valueMatrixText),
    gate60e_raw_artifact_value_index_file_sha256: sha256Text(rawArtifactIndexText),
    gate60e_source_observation_diagnostic_file_sha256: sha256Text(sourceDiagnosticText),
    gate60e_unresolved_rows_file_sha256: sha256Text(unresolvedText),
    bpr_source_policy_contract_hash: sha256Text(sourcePolicyContractText),
    bpr_nzd_alias_candidate_impact_hash: sha256Text(aliasImpactText),
    bpr_futures_carry_policy_comparison_hash: sha256Text(comparisonText),
    bpr_futures_derived_carried_state_hash: sha256Text(carriedStateText),
    bpr_futures_policy_fail_closed_hash: sha256Text(failClosedText),
    bpr_source_policy_content_invariant_hash: sha256Stable({
      gate60e_input_hashes: gate60eInputHashes,
      source_policy_contract_hash: sha256Text(sourcePolicyContractText),
      alias_candidate_impact_hash: sha256Text(aliasImpactText),
      carry_policy_comparison_hash: sha256Text(comparisonText),
      derived_carried_state_hash: sha256Text(carriedStateText),
      policy_fail_closed_hash: sha256Text(failClosedText),
    }),
  };

  const verdict = "PASS_BPR_FUTURES_CARRY_POLICY_SOURCE_ONLY_COMPARISON__NO_REGIME_SIDE";
  const summary = {
    gate_id: GATE_ID,
    summary_version: SUMMARY_VERSION,
    verdict,
    command: COMMAND,
    denominator,
    source_policy_contract_version: SOURCE_POLICY_CONTRACT_VERSION,
    alias_policy_version: ALIAS_POLICY_VERSION,
    carry_policy_comparison_version: CARRY_POLICY_COMPARISON_VERSION,
    derived_carried_state_ledger_version: DERIVED_CARRIED_STATE_LEDGER_VERSION,
    fail_closed_ledger_version: FAIL_CLOSED_LEDGER_VERSION,
    comparison_rows: comparisonRows,
    hashes,
    stop_line:
      "Stop after BPR carry source-policy comparison. No Regime transform, broad matrix, Regime side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app work, or source mutation.",
  };
  const summaryJsonText = `${JSON.stringify(summary, null, 2)}\n`;
  const summaryMdText = renderSummaryMarkdown({
    generatedAt,
    verdict,
    denominator,
    comparisonRows,
    hashes,
  });
  const receiptText = renderReceipt({
    generatedAt,
    gitCommit: git.commit,
    dirtyStatus: git.dirtyStatus,
    dirtyFiles: git.dirtyFiles,
    sourceReads: {
      alpha_rows: alphaRows.length,
      value_matrix_rows: matrixRows.length,
      raw_artifact_index_rows: artifactRows.length,
      source_observation_diagnostic_rows: sourceDiagnostics.length,
      unresolved_rows: unresolvedRows.length,
    },
    hashes,
  });
  const reportText = renderReport({
    generatedAt,
    verdict,
    denominator,
    comparisonRows,
    hashes,
  });

  const shaEntries = [
    ["gate59_alpha_ledger_jsonl", options.alphaLedgerPath, hashes.gate59_alpha_ledger_jsonl_sha256],
    ["gate60e_sha_identity", gate60eShaPath, hashes.gate60e_sha_identity_file_sha256],
    ["gate60e_value_matrix", valueMatrixPath, hashes.gate60e_value_matrix_file_sha256],
    ["gate60e_raw_artifact_value_index", rawArtifactIndexPath, hashes.gate60e_raw_artifact_value_index_file_sha256],
    ["gate60e_source_observation_diagnostic", sourceDiagnosticPath, hashes.gate60e_source_observation_diagnostic_file_sha256],
    ["gate60e_unresolved_rows", unresolvedPath, hashes.gate60e_unresolved_rows_file_sha256],
    ["bpr_source_policy_contract", sourcePolicyContractPath, hashes.bpr_source_policy_contract_hash],
    ["bpr_nzd_alias_candidate_impact", aliasImpactPath, hashes.bpr_nzd_alias_candidate_impact_hash],
    ["bpr_futures_carry_policy_comparison", comparisonPath, hashes.bpr_futures_carry_policy_comparison_hash],
    ["bpr_futures_derived_carried_state", carriedStatePath, hashes.bpr_futures_derived_carried_state_hash],
    ["bpr_futures_policy_fail_closed", failClosedPath, hashes.bpr_futures_policy_fail_closed_hash],
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
    writeFile(sourcePolicyContractPath, sourcePolicyContractText),
    writeFile(aliasImpactPath, aliasImpactText),
    writeFile(comparisonPath, comparisonText),
    writeFile(carriedStatePath, carriedStateText),
    writeFile(failClosedPath, failClosedText),
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
    denominator,
    comparison_rows: comparisonRows,
    hashes,
    artifacts: {
      source_policy_contract: toRepoRelative(sourcePolicyContractPath),
      nzd_alias_candidate_impact: toRepoRelative(aliasImpactPath),
      futures_carry_policy_comparison: toRepoRelative(comparisonPath),
      futures_derived_carried_state: toRepoRelative(carriedStatePath),
      futures_policy_fail_closed: toRepoRelative(failClosedPath),
      sha_identity: toRepoRelative(shaPath),
      report: toRepoRelative(options.reportPath),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
