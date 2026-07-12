import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 60G: bpr-forced28-source-direction-ledger";
const COMMAND = "npm run engine:gate60g:bpr-forced28-source-direction-ledger";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_GATE60E_DIR =
  "docs/research/gates/gate60e/artifacts/gate60e-bpr-value-source-contract-rescue";
const DEFAULT_GATE60F_DIR =
  "docs/research/gates/gate60f/artifacts/gate60f-bpr-carry-source-policy";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate60g/artifacts/gate60g-bpr-forced28-source-direction-ledger";
const DEFAULT_REPORT_PATH =
  "docs/research/gates/gate60g/GATE60G_BPR_FORCED28_SOURCE_DIRECTION_LEDGER_2026-06-27.md";

const EXPECTED_ALPHA_ROWS = 10_444;
const EXPECTED_ALPHA_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const EXPECTED_BPR_CURRENCY_STATE_ROWS = 2_984;
const EXPECTED_BPR_PAIR_DIRECTION_ROWS = 10_444;
const BPR_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"] as const;
const NON_USD_BPR_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD"] as const;
const CURRENCY_TIE_RANK = new Map(BPR_CURRENCIES.map((currency, index) => [currency, index]));

const SOURCE_DIRECTION_POLICY_VERSION = "gate60g_bpr_forced28_source_direction_policy_v1";
const CURRENCY_STATE_LEDGER_VERSION = "gate60g_bpr_currency_state_ledger_v1";
const SYNTHETIC_USD_LEDGER_VERSION = "gate60g_bpr_synthetic_usd_state_ledger_v1";
const PAIR_DIRECTION_LEDGER_VERSION = "gate60g_bpr_pair_source_direction_ledger_v1";
const UNRESOLVED_DEGRADED_LEDGER_VERSION = "gate60g_bpr_unresolved_degraded_state_report_v1";
const SUMMARY_VERSION = "gate60g_bpr_forced28_source_direction_summary_v1";
const SYNTHETIC_USD_FORMULA_VERSION = "gate60g_synthetic_usd_inverse_average_non_usd_bpr_futures_v1";
const CARRY_POLICY_VERSION =
  "gate60f_bpr_futures_carry_last_valid_clean_futures_until_next_clean_report_stale_after_45d_v1";

type CliOptions = {
  alphaLedgerPath: string;
  gate60eDir: string;
  gate60fDir: string;
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
  currency: CurrencyCode;
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

type Gate60fCarryComparisonRow = {
  row_key: string;
  policy_key: string;
  carry_policy_version: string;
  raw_present_rows: number;
  repaired_alias_rows: number;
  true_absence_rows_carried: number;
  stale_carried_rows: number;
  still_fail_closed_rows: number;
  timing_blocked_rows: number;
  futures_options_shadow_rows: number;
  content_hash: string;
};

type CurrencyCode = (typeof BPR_CURRENCIES)[number];
type NonUsdCurrencyCode = (typeof NON_USD_BPR_CURRENCIES)[number];

type CurrencySourceQuality =
  | "raw_present"
  | "carried_fresh"
  | "carried_stale"
  | "synthetic_usd"
  | "timing_blocked_carry"
  | "unresolved_no_prior"
  | "unresolved_source_ambiguous";

type CurrencyStateRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: CurrencyCode;
  source_id: "cftc_bpr_futures" | "synthetic_usd_bpr_futures";
  atom_key: "bpr_futures" | "bpr_futures_carried_state" | "bpr_futures_synthetic_usd_state";
  source_state:
    | "RAW_PRESENT"
    | "DERIVED_CARRIED_STATE"
    | "SYNTHETIC_USD_STATE"
    | "FAIL_CLOSED_UNRESOLVED_STATE";
  source_quality: CurrencySourceQuality;
  bpr_net_share_of_gross: number | null;
  current_report_observation_date: string | null;
  current_report_source_observation_id: string | null;
  current_report_artifact_hashes: string[];
  current_report_absence_reason: string;
  carried_from_observation_date: string | null;
  carried_from_source_observation_id: string | null;
  carried_from_artifact_hash: string | null;
  carry_age_days: number | null;
  synthetic_formula_version: string | null;
  synthetic_component_count: number;
  synthetic_component_currencies: CurrencyCode[];
  synthetic_component_quality_counts: Record<string, number>;
  promotion_eligible_currency_state: boolean;
  promotion_ineligible_reasons: string[];
  source_rows_mutated: false;
  content_hash: string;
};

type SyntheticUsdLedgerRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  currency: "USD";
  source_id: "synthetic_usd_bpr_futures";
  atom_key: "bpr_futures_synthetic_usd_state";
  synthetic_formula_version: string;
  synthetic_value: number | null;
  direct_usd_source_status: string;
  direct_usd_observation_date: string | null;
  component_count: number;
  component_currencies: CurrencyCode[];
  component_quality_counts: Record<string, number>;
  component_state_hashes: string[];
  promotion_eligible_currency_state: boolean;
  promotion_ineligible_reasons: string[];
  source_rows_mutated: false;
  content_hash: string;
};

type PairDirectionRow = {
  row_key: string;
  ledger_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  symbol: string;
  base: CurrencyCode;
  quote: CurrencyCode;
  required_bpr_v1_source: "bpr_futures";
  shadow_only_source: "bpr_futures_and_options";
  derived_atoms: ["bpr_futures_carried_state", "bpr_futures_synthetic_usd_state"];
  bpr_source_direction: "BASE_CURRENCY" | "QUOTE_CURRENCY";
  bpr_source_direction_currency: CurrencyCode;
  bpr_source_direction_rule:
    | "numeric_value_comparison"
    | "numeric_equal_currency_rank_tiebreak"
    | "single_numeric_state_degraded"
    | "deterministic_unresolved_currency_rank_fallback";
  bpr_source_direction_is_neutral: false;
  base_bpr_net_share_of_gross: number | null;
  quote_bpr_net_share_of_gross: number | null;
  bpr_net_share_spread_base_minus_quote: number | null;
  base_source_quality: CurrencySourceQuality;
  quote_source_quality: CurrencySourceQuality;
  base_currency_state_row_key: string;
  quote_currency_state_row_key: string;
  base_promotion_eligible_currency_state: boolean;
  quote_promotion_eligible_currency_state: boolean;
  pair_source_direction_eligible: boolean;
  promotion_eligible_pair_direction: boolean;
  promotion_ineligible_reasons: string[];
  no_futures_options_mixing: true;
  no_regime_side: true;
  no_long_short_side: true;
  source_rows_mutated: false;
  content_hash: string;
};

type DegradedStateReportRow = {
  row_key: string;
  report_version: string;
  alpha_week_open_utc: string;
  mapped_macro_week_id: string;
  report_scope: "currency_state" | "pair_direction";
  currency: CurrencyCode | null;
  symbol: string | null;
  source_quality: CurrencySourceQuality | null;
  bpr_source_direction: PairDirectionRow["bpr_source_direction"] | null;
  degradation_reasons: string[];
  promotion_eligible: boolean;
  content_hash: string;
};

type LastValidCleanState = {
  currency: NonUsdCurrencyCode;
  observation_date: string;
  selected_observation_id: string;
  raw_artifact_hash: string;
  value: number;
  source_state_hash: string;
};

type Summary = {
  gate_id: string;
  summary_version: string;
  verdict: string;
  command: string;
  generated_at: string;
  policy: Record<string, unknown>;
  denominator: Record<string, unknown>;
  quality_summary: Record<string, unknown>;
  hashes: Record<string, string>;
  artifacts: Record<string, string>;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    alphaLedgerPath: DEFAULT_ALPHA_LEDGER_PATH,
    gate60eDir: DEFAULT_GATE60E_DIR,
    gate60fDir: DEFAULT_GATE60F_DIR,
    artifactDir: DEFAULT_ARTIFACT_DIR,
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (const arg of argv) {
    const [key, value] = arg.split("=", 2);
    if (!value) continue;
    if (key === "--alpha-ledger") options.alphaLedgerPath = value;
    if (key === "--gate60e-dir") options.gate60eDir = value;
    if (key === "--gate60f-dir") options.gate60fDir = value;
    if (key === "--artifact-dir") options.artifactDir = value;
    if (key === "--report") options.reportPath = value;
  }

  return options;
}

function stableRowHash<T extends Record<string, unknown>>(row: Omit<T, "content_hash">) {
  return sha256Stable(row);
}

function withContentHash<T extends { content_hash: string }>(row: Omit<T, "content_hash">): T {
  return { ...row, content_hash: stableRowHash(row as Record<string, unknown>) } as T;
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

function countBy<T>(rows: T[], keyFn: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = keyFn(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
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
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function isCurrency(value: string | null): value is CurrencyCode {
  return BPR_CURRENCIES.includes(value as CurrencyCode);
}

function isNonUsdCurrency(value: string | null): value is NonUsdCurrencyCode {
  return NON_USD_BPR_CURRENCIES.includes(value as NonUsdCurrencyCode);
}

function requireCurrency(value: string | null, context: string): CurrencyCode {
  if (!isCurrency(value)) throw new Error(`Unsupported currency ${value ?? "null"} in ${context}`);
  return value;
}

function getGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getGitStatus() {
  try {
    const status = execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim();
    return {
      status: status.length === 0 ? "clean" : "dirty",
      files: status.length === 0 ? [] : status.split(/\r?\n/),
    };
  } catch {
    return { status: "unknown", files: [] };
  }
}

function isRawPresent(row: Gate60eValueMatrixRow) {
  return row.timing_status === "CLEAN_POINT_IN_TIME" && row.net_share_of_gross_available && row.net_share_of_gross !== null;
}

function promotionReasonsForCurrencyState(row: Omit<CurrencyStateRow, "content_hash">) {
  const reasons: string[] = [];
  if (row.bpr_net_share_of_gross === null) reasons.push("currency_state_value_missing");
  if (row.source_quality === "carried_stale") reasons.push("currency_state_carried_stale");
  if (row.source_quality === "timing_blocked_carry") reasons.push("currency_state_timing_blocked_carry");
  if (row.source_quality === "unresolved_no_prior") reasons.push("currency_state_unresolved_no_prior");
  if (row.source_quality === "unresolved_source_ambiguous") reasons.push("currency_state_source_ambiguous");
  if (row.source_quality === "synthetic_usd" && row.synthetic_component_count !== NON_USD_BPR_CURRENCIES.length) {
    reasons.push("synthetic_usd_partial_component_coverage");
  }
  for (const [quality, count] of Object.entries(row.synthetic_component_quality_counts)) {
    if (count > 0 && !["raw_present", "carried_fresh"].includes(quality)) {
      reasons.push(`synthetic_usd_component_quality:${quality}`);
    }
  }
  return uniqueSorted(reasons);
}

function buildRawState(row: Gate60eValueMatrixRow): CurrencyStateRow {
  if (!isNonUsdCurrency(row.currency) || row.net_share_of_gross === null || !row.selected_observation_id) {
    throw new Error(`Invalid raw BPR futures state ${row.row_key}`);
  }

  const draft: Omit<CurrencyStateRow, "content_hash"> = {
    row_key: `${row.alpha_week_open_utc}|${row.currency}`,
    ledger_version: CURRENCY_STATE_LEDGER_VERSION,
    alpha_week_open_utc: row.alpha_week_open_utc,
    mapped_macro_week_id: row.mapped_macro_week_id,
    currency: row.currency,
    source_id: "cftc_bpr_futures",
    atom_key: "bpr_futures",
    source_state: "RAW_PRESENT",
    source_quality: "raw_present",
    bpr_net_share_of_gross: row.net_share_of_gross,
    current_report_observation_date: row.observation_date,
    current_report_source_observation_id: row.selected_observation_id,
    current_report_artifact_hashes: row.raw_artifact_hashes,
    current_report_absence_reason: "not_missing",
    carried_from_observation_date: null,
    carried_from_source_observation_id: null,
    carried_from_artifact_hash: null,
    carry_age_days: null,
    synthetic_formula_version: null,
    synthetic_component_count: 0,
    synthetic_component_currencies: [],
    synthetic_component_quality_counts: {},
    promotion_eligible_currency_state: true,
    promotion_ineligible_reasons: [],
    source_rows_mutated: false,
  };

  return withContentHash(draft);
}

function buildCarriedState(row: Gate60eValueMatrixRow, lastValid: LastValidCleanState, sourceQuality: "carried_fresh" | "carried_stale" | "timing_blocked_carry"): CurrencyStateRow {
  if (!isNonUsdCurrency(row.currency)) throw new Error(`Invalid carried BPR futures currency ${row.currency}`);
  const observationDate = row.observation_date ?? row.alpha_week_open_utc.slice(0, 10);
  const carryAgeDays = dateDiffDays(observationDate, lastValid.observation_date);
  const draft: Omit<CurrencyStateRow, "content_hash"> = {
    row_key: `${row.alpha_week_open_utc}|${row.currency}`,
    ledger_version: CURRENCY_STATE_LEDGER_VERSION,
    alpha_week_open_utc: row.alpha_week_open_utc,
    mapped_macro_week_id: row.mapped_macro_week_id,
    currency: row.currency,
    source_id: "cftc_bpr_futures",
    atom_key: "bpr_futures_carried_state",
    source_state: "DERIVED_CARRIED_STATE",
    source_quality: sourceQuality,
    bpr_net_share_of_gross: lastValid.value,
    current_report_observation_date: row.observation_date,
    current_report_source_observation_id: row.selected_observation_id,
    current_report_artifact_hashes: row.raw_artifact_hashes,
    current_report_absence_reason: row.timing_status === "CLEAN_POINT_IN_TIME" ? row.value_missing_reason : row.timing_status,
    carried_from_observation_date: lastValid.observation_date,
    carried_from_source_observation_id: lastValid.selected_observation_id,
    carried_from_artifact_hash: lastValid.raw_artifact_hash,
    carry_age_days: carryAgeDays,
    synthetic_formula_version: null,
    synthetic_component_count: 0,
    synthetic_component_currencies: [],
    synthetic_component_quality_counts: {},
    promotion_eligible_currency_state: sourceQuality === "carried_fresh",
    promotion_ineligible_reasons:
      sourceQuality === "carried_fresh"
        ? []
        : sourceQuality === "carried_stale"
          ? ["currency_state_carried_stale"]
          : ["currency_state_timing_blocked_carry"],
    source_rows_mutated: false,
  };

  return withContentHash(draft);
}

function buildUnresolvedState(row: Gate60eValueMatrixRow, sourceQuality: "unresolved_no_prior" | "unresolved_source_ambiguous"): CurrencyStateRow {
  if (!isNonUsdCurrency(row.currency)) throw new Error(`Invalid unresolved BPR futures currency ${row.currency}`);
  const draft: Omit<CurrencyStateRow, "content_hash"> = {
    row_key: `${row.alpha_week_open_utc}|${row.currency}`,
    ledger_version: CURRENCY_STATE_LEDGER_VERSION,
    alpha_week_open_utc: row.alpha_week_open_utc,
    mapped_macro_week_id: row.mapped_macro_week_id,
    currency: row.currency,
    source_id: "cftc_bpr_futures",
    atom_key: "bpr_futures",
    source_state: "FAIL_CLOSED_UNRESOLVED_STATE",
    source_quality: sourceQuality,
    bpr_net_share_of_gross: null,
    current_report_observation_date: row.observation_date,
    current_report_source_observation_id: row.selected_observation_id,
    current_report_artifact_hashes: row.raw_artifact_hashes,
    current_report_absence_reason: row.timing_status === "CLEAN_POINT_IN_TIME" ? row.value_missing_reason : row.timing_status,
    carried_from_observation_date: null,
    carried_from_source_observation_id: null,
    carried_from_artifact_hash: null,
    carry_age_days: null,
    synthetic_formula_version: null,
    synthetic_component_count: 0,
    synthetic_component_currencies: [],
    synthetic_component_quality_counts: {},
    promotion_eligible_currency_state: false,
    promotion_ineligible_reasons: [sourceQuality === "unresolved_no_prior" ? "currency_state_unresolved_no_prior" : "currency_state_source_ambiguous"],
    source_rows_mutated: false,
  };

  return withContentHash(draft);
}

function buildCurrencyStates(futuresRows: Gate60eValueMatrixRow[]) {
  const rowsByWeek = new Map<string, Gate60eValueMatrixRow[]>();
  for (const row of futuresRows) {
    const rows = rowsByWeek.get(row.alpha_week_open_utc) ?? [];
    rows.push(row);
    rowsByWeek.set(row.alpha_week_open_utc, rows);
  }

  const lastValidByCurrency = new Map<NonUsdCurrencyCode, LastValidCleanState>();
  const nonUsdStates: CurrencyStateRow[] = [];
  const syntheticUsdRows: SyntheticUsdLedgerRow[] = [];
  const syntheticStates: CurrencyStateRow[] = [];

  for (const week of [...rowsByWeek.keys()].sort()) {
    const weekRows = rowsByWeek.get(week) ?? [];
    const weekStates: CurrencyStateRow[] = [];

    for (const currency of NON_USD_BPR_CURRENCIES) {
      const row = weekRows.find((candidate) => candidate.currency === currency && candidate.atom_key === "bpr_futures");
      if (!row) throw new Error(`Missing BPR futures row for ${week}|${currency}`);

      let state: CurrencyStateRow;
      if (isRawPresent(row)) {
        state = buildRawState(row);
        lastValidByCurrency.set(currency, {
          currency,
          observation_date: row.observation_date ?? row.alpha_week_open_utc.slice(0, 10),
          selected_observation_id: row.selected_observation_id ?? "",
          raw_artifact_hash: row.raw_artifact_hashes[0] ?? "",
          value: row.net_share_of_gross ?? 0,
          source_state_hash: state.content_hash,
        });
      } else {
        const lastValid = lastValidByCurrency.get(currency);
        if (row.timing_status !== "CLEAN_POINT_IN_TIME") {
          state = lastValid
            ? buildCarriedState(row, lastValid, "timing_blocked_carry")
            : buildUnresolvedState(row, "unresolved_no_prior");
          lastValidByCurrency.delete(currency);
        } else if (row.value_missing_reason === "truly_absent_from_cftc_bpr_report") {
          if (lastValid) {
            const observationDate = row.observation_date ?? row.alpha_week_open_utc.slice(0, 10);
            const carryAgeDays = dateDiffDays(observationDate, lastValid.observation_date);
            state = buildCarriedState(row, lastValid, carryAgeDays <= 45 ? "carried_fresh" : "carried_stale");
          } else {
            state = buildUnresolvedState(row, "unresolved_no_prior");
          }
        } else {
          state = buildUnresolvedState(row, "unresolved_source_ambiguous");
        }
      }

      nonUsdStates.push(state);
      weekStates.push(state);
    }

    const directUsdRow = weekRows.find((candidate) => candidate.currency === "USD" && candidate.atom_key === "bpr_futures");
    if (!directUsdRow) throw new Error(`Missing direct USD BPR futures row for ${week}`);
    const components = weekStates.filter((state) => state.bpr_net_share_of_gross !== null);
    const syntheticValue =
      components.length > 0
        ? -components.reduce((sum, state) => sum + (state.bpr_net_share_of_gross ?? 0), 0) / components.length
        : null;
    const componentQualityCounts = countBy(components, (state) => state.source_quality);
    const syntheticPromotionReasons = uniqueSorted([
      ...(components.length !== NON_USD_BPR_CURRENCIES.length ? ["synthetic_usd_partial_component_coverage"] : []),
      ...Object.entries(componentQualityCounts)
        .filter(([quality]) => !["raw_present", "carried_fresh"].includes(quality))
        .map(([quality]) => `synthetic_usd_component_quality:${quality}`),
      ...(syntheticValue === null ? ["synthetic_usd_value_missing"] : []),
    ]);

    const syntheticLedgerDraft: Omit<SyntheticUsdLedgerRow, "content_hash"> = {
      row_key: `${week}|USD`,
      ledger_version: SYNTHETIC_USD_LEDGER_VERSION,
      alpha_week_open_utc: week,
      mapped_macro_week_id: directUsdRow.mapped_macro_week_id,
      currency: "USD",
      source_id: "synthetic_usd_bpr_futures",
      atom_key: "bpr_futures_synthetic_usd_state",
      synthetic_formula_version: SYNTHETIC_USD_FORMULA_VERSION,
      synthetic_value: syntheticValue,
      direct_usd_source_status: directUsdRow.status,
      direct_usd_observation_date: directUsdRow.observation_date,
      component_count: components.length,
      component_currencies: components.map((state) => state.currency).sort(),
      component_quality_counts: componentQualityCounts,
      component_state_hashes: components.map((state) => state.content_hash).sort(),
      promotion_eligible_currency_state: syntheticPromotionReasons.length === 0,
      promotion_ineligible_reasons: syntheticPromotionReasons,
      source_rows_mutated: false,
    };
    const syntheticLedgerRow = withContentHash(syntheticLedgerDraft);
    syntheticUsdRows.push(syntheticLedgerRow);

    const syntheticCurrencyDraft: Omit<CurrencyStateRow, "content_hash"> = {
      row_key: `${week}|USD`,
      ledger_version: CURRENCY_STATE_LEDGER_VERSION,
      alpha_week_open_utc: week,
      mapped_macro_week_id: directUsdRow.mapped_macro_week_id,
      currency: "USD",
      source_id: "synthetic_usd_bpr_futures",
      atom_key: "bpr_futures_synthetic_usd_state",
      source_state: syntheticValue === null ? "FAIL_CLOSED_UNRESOLVED_STATE" : "SYNTHETIC_USD_STATE",
      source_quality: syntheticValue === null ? "unresolved_no_prior" : "synthetic_usd",
      bpr_net_share_of_gross: syntheticValue,
      current_report_observation_date: directUsdRow.observation_date,
      current_report_source_observation_id: directUsdRow.selected_observation_id,
      current_report_artifact_hashes: directUsdRow.raw_artifact_hashes,
      current_report_absence_reason: directUsdRow.value_missing_reason,
      carried_from_observation_date: null,
      carried_from_source_observation_id: null,
      carried_from_artifact_hash: null,
      carry_age_days: null,
      synthetic_formula_version: SYNTHETIC_USD_FORMULA_VERSION,
      synthetic_component_count: components.length,
      synthetic_component_currencies: components.map((state) => state.currency).sort(),
      synthetic_component_quality_counts: componentQualityCounts,
      promotion_eligible_currency_state: syntheticPromotionReasons.length === 0,
      promotion_ineligible_reasons: syntheticPromotionReasons,
      source_rows_mutated: false,
    };
    syntheticStates.push(withContentHash(syntheticCurrencyDraft));
  }

  const currencyStates = [...nonUsdStates, ...syntheticStates].sort((left, right) =>
    left.alpha_week_open_utc.localeCompare(right.alpha_week_open_utc) || left.currency.localeCompare(right.currency),
  );

  return { currencyStates, syntheticUsdRows };
}

function determinePairDirection(baseState: CurrencyStateRow, quoteState: CurrencyStateRow) {
  const baseValue = baseState.bpr_net_share_of_gross;
  const quoteValue = quoteState.bpr_net_share_of_gross;

  if (baseValue !== null && quoteValue !== null) {
    if (baseValue > quoteValue) return { direction: "BASE_CURRENCY" as const, rule: "numeric_value_comparison" as const };
    if (quoteValue > baseValue) return { direction: "QUOTE_CURRENCY" as const, rule: "numeric_value_comparison" as const };
    const baseRank = CURRENCY_TIE_RANK.get(baseState.currency) ?? 99;
    const quoteRank = CURRENCY_TIE_RANK.get(quoteState.currency) ?? 99;
    return {
      direction: baseRank <= quoteRank ? ("BASE_CURRENCY" as const) : ("QUOTE_CURRENCY" as const),
      rule: "numeric_equal_currency_rank_tiebreak" as const,
    };
  }

  if (baseValue !== null || quoteValue !== null) {
    return {
      direction: baseValue !== null ? ("BASE_CURRENCY" as const) : ("QUOTE_CURRENCY" as const),
      rule: "single_numeric_state_degraded" as const,
    };
  }

  const baseRank = CURRENCY_TIE_RANK.get(baseState.currency) ?? 99;
  const quoteRank = CURRENCY_TIE_RANK.get(quoteState.currency) ?? 99;
  return {
    direction: baseRank <= quoteRank ? ("BASE_CURRENCY" as const) : ("QUOTE_CURRENCY" as const),
    rule: "deterministic_unresolved_currency_rank_fallback" as const,
  };
}

function promotionReasonsForPair(baseState: CurrencyStateRow, quoteState: CurrencyStateRow, rule: PairDirectionRow["bpr_source_direction_rule"]) {
  const reasons = new Set<string>();
  if (rule !== "numeric_value_comparison") reasons.add(`pair_direction_rule:${rule}`);
  if (!baseState.promotion_eligible_currency_state) {
    reasons.add("base_currency_state_not_promotion_eligible");
    for (const reason of baseState.promotion_ineligible_reasons) reasons.add(`base:${reason}`);
  }
  if (!quoteState.promotion_eligible_currency_state) {
    reasons.add("quote_currency_state_not_promotion_eligible");
    for (const reason of quoteState.promotion_ineligible_reasons) reasons.add(`quote:${reason}`);
  }
  if (baseState.bpr_net_share_of_gross === null) reasons.add("base_currency_value_missing");
  if (quoteState.bpr_net_share_of_gross === null) reasons.add("quote_currency_value_missing");
  return [...reasons].sort();
}

function buildPairDirectionRows(alphaRows: AlphaLedgerRow[], currencyStates: CurrencyStateRow[]) {
  const stateByWeekCurrency = new Map(currencyStates.map((state) => [`${state.alpha_week_open_utc}|${state.currency}`, state]));
  return alphaRows.map((alphaRow): PairDirectionRow => {
    const week = alphaRow.week.week_open_utc;
    const symbol = alphaRow.instrument.symbol;
    const base = requireCurrency(alphaRow.instrument.base_currency, alphaRow.row_key);
    const quote = requireCurrency(alphaRow.instrument.quote_currency, alphaRow.row_key);
    const baseState = stateByWeekCurrency.get(`${week}|${base}`);
    const quoteState = stateByWeekCurrency.get(`${week}|${quote}`);
    if (!baseState || !quoteState) throw new Error(`Missing BPR currency state for ${alphaRow.row_key}`);

    const direction = determinePairDirection(baseState, quoteState);
    const directionCurrency = direction.direction === "BASE_CURRENCY" ? base : quote;
    const spread =
      baseState.bpr_net_share_of_gross !== null && quoteState.bpr_net_share_of_gross !== null
        ? Number((baseState.bpr_net_share_of_gross - quoteState.bpr_net_share_of_gross).toFixed(12))
        : null;
    const promotionReasons = promotionReasonsForPair(baseState, quoteState, direction.rule);

    const draft: Omit<PairDirectionRow, "content_hash"> = {
      row_key: alphaRow.row_key,
      ledger_version: PAIR_DIRECTION_LEDGER_VERSION,
      alpha_week_open_utc: week,
      mapped_macro_week_id: `macro_week_${week.slice(0, 10)}`,
      symbol,
      base,
      quote,
      required_bpr_v1_source: "bpr_futures",
      shadow_only_source: "bpr_futures_and_options",
      derived_atoms: ["bpr_futures_carried_state", "bpr_futures_synthetic_usd_state"],
      bpr_source_direction: direction.direction,
      bpr_source_direction_currency: directionCurrency,
      bpr_source_direction_rule: direction.rule,
      bpr_source_direction_is_neutral: false,
      base_bpr_net_share_of_gross: baseState.bpr_net_share_of_gross,
      quote_bpr_net_share_of_gross: quoteState.bpr_net_share_of_gross,
      bpr_net_share_spread_base_minus_quote: spread,
      base_source_quality: baseState.source_quality,
      quote_source_quality: quoteState.source_quality,
      base_currency_state_row_key: baseState.row_key,
      quote_currency_state_row_key: quoteState.row_key,
      base_promotion_eligible_currency_state: baseState.promotion_eligible_currency_state,
      quote_promotion_eligible_currency_state: quoteState.promotion_eligible_currency_state,
      pair_source_direction_eligible: baseState.bpr_net_share_of_gross !== null && quoteState.bpr_net_share_of_gross !== null,
      promotion_eligible_pair_direction: promotionReasons.length === 0,
      promotion_ineligible_reasons: promotionReasons,
      no_futures_options_mixing: true,
      no_regime_side: true,
      no_long_short_side: true,
      source_rows_mutated: false,
    };

    return withContentHash(draft);
  });
}

function buildDegradedReport(currencyStates: CurrencyStateRow[], pairRows: PairDirectionRow[]) {
  const currencyDegraded = currencyStates
    .filter((state) => !state.promotion_eligible_currency_state)
    .map((state): DegradedStateReportRow =>
      withContentHash({
        row_key: `currency|${state.row_key}`,
        report_version: UNRESOLVED_DEGRADED_LEDGER_VERSION,
        alpha_week_open_utc: state.alpha_week_open_utc,
        mapped_macro_week_id: state.mapped_macro_week_id,
        report_scope: "currency_state",
        currency: state.currency,
        symbol: null,
        source_quality: state.source_quality,
        bpr_source_direction: null,
        degradation_reasons: state.promotion_ineligible_reasons,
        promotion_eligible: state.promotion_eligible_currency_state,
      }),
    );

  const pairDegraded = pairRows
    .filter((row) => !row.promotion_eligible_pair_direction)
    .map((row): DegradedStateReportRow =>
      withContentHash({
        row_key: `pair|${row.row_key}`,
        report_version: UNRESOLVED_DEGRADED_LEDGER_VERSION,
        alpha_week_open_utc: row.alpha_week_open_utc,
        mapped_macro_week_id: row.mapped_macro_week_id,
        report_scope: "pair_direction",
        currency: null,
        symbol: row.symbol,
        source_quality: null,
        bpr_source_direction: row.bpr_source_direction,
        degradation_reasons: row.promotion_ineligible_reasons,
        promotion_eligible: row.promotion_eligible_pair_direction,
      }),
    );

  return [...currencyDegraded, ...pairDegraded];
}

async function writeTextArtifact(filePath: string, text: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const gitCommit = getGitCommit();
  const gitStatus = getGitStatus();
  const valueMatrixPath = path.join(options.gate60eDir, "gate60e-bpr-value-availability-matrix.rows.jsonl");
  const gate60fCarryComparisonPath = path.join(options.gate60fDir, "gate60f-bpr-futures-carry-policy-comparison.rows.jsonl");
  const gate60fShaIdentityPath = path.join(options.gate60fDir, "gate60f-bpr-carry-source-policy.sha256.txt");

  const alphaRows = (await readJsonl<AlphaLedgerRow>(options.alphaLedgerPath)).sort((left, right) => left.row_key.localeCompare(right.row_key));
  const valueMatrixRows = await readJsonl<Gate60eValueMatrixRow>(valueMatrixPath);
  const gate60fComparisonRows = await readJsonl<Gate60fCarryComparisonRow>(gate60fCarryComparisonPath);
  const gate60fCarryPolicyRow = gate60fComparisonRows.find((row) => row.carry_policy_version === CARRY_POLICY_VERSION);
  if (!gate60fCarryPolicyRow) throw new Error(`Missing Gate 60F carry policy comparison row ${CARRY_POLICY_VERSION}`);

  const futuresRows = valueMatrixRows.filter((row) => row.atom_key === "bpr_futures");
  const futuresOptionsRows = valueMatrixRows.filter((row) => row.atom_key === "bpr_futures_and_options");
  const alphaWeeks = uniqueSorted(alphaRows.map((row) => row.week.week_open_utc));
  const symbolsPerWeek = countBy(alphaRows, (row) => row.week.week_open_utc);
  const symbolsPerWeekHistogram = countBy(Object.values(symbolsPerWeek), (count) => String(count));

  const { currencyStates, syntheticUsdRows } = buildCurrencyStates(futuresRows);
  const pairRows = buildPairDirectionRows(alphaRows, currencyStates);
  const degradedRows = buildDegradedReport(currencyStates, pairRows);

  const artifactPaths = {
    currencyStateLedger: path.join(options.artifactDir, "gate60g-bpr-currency-state-ledger.rows.jsonl"),
    syntheticUsdLedger: path.join(options.artifactDir, "gate60g-bpr-synthetic-usd-ledger.rows.jsonl"),
    pairDirectionLedger: path.join(options.artifactDir, "gate60g-bpr-pair-direction-ledger.rows.jsonl"),
    qualitySummaryJson: path.join(options.artifactDir, "gate60g-bpr-source-quality-summary.json"),
    qualitySummaryMd: path.join(options.artifactDir, "gate60g-bpr-source-quality-summary.md"),
    degradedReport: path.join(options.artifactDir, "gate60g-bpr-unresolved-degraded-state-report.rows.jsonl"),
    queryReceipt: path.join(options.artifactDir, "gate60g-bpr-forced28-source-direction-ledger.query-receipt.md"),
    shaIdentity: path.join(options.artifactDir, "gate60g-bpr-forced28-source-direction-ledger.sha256.txt"),
    report: options.reportPath,
  };

  const denominator = {
    input_rows: alphaRows.length,
    expected_input_rows: EXPECTED_ALPHA_ROWS,
    alpha_weeks: alphaWeeks.length,
    expected_alpha_weeks: EXPECTED_ALPHA_WEEKS,
    symbols_per_week_histogram: symbolsPerWeekHistogram,
    full_weeks: Object.values(symbolsPerWeek).filter((count) => count === EXPECTED_SYMBOLS_PER_WEEK).length,
    duplicate_alpha_row_keys: countDuplicates(alphaRows.map((row) => row.row_key)),
    futures_required_rows: futuresRows.length,
    expected_futures_required_rows: EXPECTED_BPR_CURRENCY_STATE_ROWS,
    futures_options_shadow_rows: futuresOptionsRows.length,
    expected_futures_options_shadow_rows: EXPECTED_BPR_CURRENCY_STATE_ROWS,
    currency_state_rows: currencyStates.length,
    expected_currency_state_rows: EXPECTED_BPR_CURRENCY_STATE_ROWS,
    synthetic_usd_rows: syntheticUsdRows.length,
    expected_synthetic_usd_rows: EXPECTED_ALPHA_WEEKS,
    pair_direction_rows: pairRows.length,
    expected_pair_direction_rows: EXPECTED_BPR_PAIR_DIRECTION_ROWS,
    duplicate_currency_state_row_keys: countDuplicates(currencyStates.map((row) => row.row_key)),
    duplicate_synthetic_usd_row_keys: countDuplicates(syntheticUsdRows.map((row) => row.row_key)),
    duplicate_pair_direction_row_keys: countDuplicates(pairRows.map((row) => row.row_key)),
    neutral_pair_direction_rows: pairRows.filter((row) => row.bpr_source_direction_is_neutral).length,
    futures_options_mixing_rows: pairRows.filter((row) => !row.no_futures_options_mixing).length,
  };

  const qualitySummary = {
    currency_state_quality_counts: countBy(currencyStates, (row) => row.source_quality),
    currency_state_source_state_counts: countBy(currencyStates, (row) => row.source_state),
    promotion_eligible_currency_states: currencyStates.filter((row) => row.promotion_eligible_currency_state).length,
    promotion_ineligible_currency_states: currencyStates.filter((row) => !row.promotion_eligible_currency_state).length,
    pair_direction_counts: countBy(pairRows, (row) => row.bpr_source_direction),
    pair_direction_rule_counts: countBy(pairRows, (row) => row.bpr_source_direction_rule),
    pair_base_quality_counts: countBy(pairRows, (row) => row.base_source_quality),
    pair_quote_quality_counts: countBy(pairRows, (row) => row.quote_source_quality),
    pair_source_direction_eligible_rows: pairRows.filter((row) => row.pair_source_direction_eligible).length,
    promotion_eligible_pair_direction_rows: pairRows.filter((row) => row.promotion_eligible_pair_direction).length,
    promotion_ineligible_pair_direction_rows: pairRows.filter((row) => !row.promotion_eligible_pair_direction).length,
    degraded_report_rows: degradedRows.length,
    gate60f_selected_carry_policy: {
      carry_policy_version: gate60fCarryPolicyRow.carry_policy_version,
      raw_present_rows: gate60fCarryPolicyRow.raw_present_rows,
      true_absence_rows_carried: gate60fCarryPolicyRow.true_absence_rows_carried,
      stale_carried_rows: gate60fCarryPolicyRow.stale_carried_rows,
      still_fail_closed_rows: gate60fCarryPolicyRow.still_fail_closed_rows,
      timing_blocked_rows: gate60fCarryPolicyRow.timing_blocked_rows,
      content_hash: gate60fCarryPolicyRow.content_hash,
    },
  };

  const invariantFailures = [
    ...(denominator.input_rows !== EXPECTED_ALPHA_ROWS ? ["alpha_input_row_count_mismatch"] : []),
    ...(denominator.alpha_weeks !== EXPECTED_ALPHA_WEEKS ? ["alpha_week_count_mismatch"] : []),
    ...(denominator.full_weeks !== EXPECTED_ALPHA_WEEKS ? ["not_all_alpha_weeks_are_full_28"] : []),
    ...(denominator.duplicate_alpha_row_keys !== 0 ? ["duplicate_alpha_row_keys"] : []),
    ...(denominator.futures_required_rows !== EXPECTED_BPR_CURRENCY_STATE_ROWS ? ["bpr_futures_required_row_count_mismatch"] : []),
    ...(denominator.futures_options_shadow_rows !== EXPECTED_BPR_CURRENCY_STATE_ROWS ? ["bpr_futures_options_shadow_row_count_mismatch"] : []),
    ...(denominator.currency_state_rows !== EXPECTED_BPR_CURRENCY_STATE_ROWS ? ["currency_state_row_count_mismatch"] : []),
    ...(denominator.synthetic_usd_rows !== EXPECTED_ALPHA_WEEKS ? ["synthetic_usd_row_count_mismatch"] : []),
    ...(denominator.pair_direction_rows !== EXPECTED_BPR_PAIR_DIRECTION_ROWS ? ["pair_direction_row_count_mismatch"] : []),
    ...(denominator.duplicate_currency_state_row_keys !== 0 ? ["duplicate_currency_state_row_keys"] : []),
    ...(denominator.duplicate_synthetic_usd_row_keys !== 0 ? ["duplicate_synthetic_usd_row_keys"] : []),
    ...(denominator.duplicate_pair_direction_row_keys !== 0 ? ["duplicate_pair_direction_row_keys"] : []),
    ...(denominator.neutral_pair_direction_rows !== 0 ? ["neutral_pair_direction_rows_present"] : []),
    ...(denominator.futures_options_mixing_rows !== 0 ? ["futures_options_mixing_rows_present"] : []),
  ];

  const verdict =
    invariantFailures.length === 0
      ? "PASS_BPR_FORCED28_SOURCE_DIRECTION_LEDGER__DEGRADED_FLAGS_SEPARATE__NO_REGIME_SIDE"
      : "FAIL_BPR_FORCED28_SOURCE_DIRECTION_LEDGER_INVARIANTS";

  const currencyStateText = jsonlText(currencyStates);
  const syntheticUsdText = jsonlText(syntheticUsdRows);
  const pairDirectionText = jsonlText(pairRows);
  const degradedText = jsonlText(degradedRows);

  const contentHashes = {
    gate59_alpha_ledger_jsonl_sha256: sha256Text(await readFile(options.alphaLedgerPath)),
    gate60e_value_matrix_file_sha256: sha256Text(await readFile(valueMatrixPath)),
    gate60f_carry_policy_comparison_file_sha256: sha256Text(await readFile(gate60fCarryComparisonPath)),
    gate60f_sha_identity_file_sha256: sha256Text(await readFile(gate60fShaIdentityPath)),
    bpr_currency_state_ledger_hash: sha256Text(currencyStateText),
    bpr_synthetic_usd_ledger_hash: sha256Text(syntheticUsdText),
    bpr_pair_direction_ledger_hash: sha256Text(pairDirectionText),
    bpr_unresolved_degraded_state_report_hash: sha256Text(degradedText),
    bpr_forced28_source_direction_content_invariant_hash: sha256Stable({
      currencyStates: currencyStates.map((row) => row.content_hash),
      syntheticUsdRows: syntheticUsdRows.map((row) => row.content_hash),
      pairRows: pairRows.map((row) => row.content_hash),
      degradedRows: degradedRows.map((row) => row.content_hash),
      policy: SOURCE_DIRECTION_POLICY_VERSION,
    }),
  };

  const summary: Summary = {
    gate_id: GATE_ID,
    summary_version: SUMMARY_VERSION,
    verdict,
    command: COMMAND,
    generated_at: generatedAt,
    policy: {
      source_direction_policy_version: SOURCE_DIRECTION_POLICY_VERSION,
      required_bpr_v1_source: "bpr_futures",
      shadow_only_source: "bpr_futures_and_options",
      derived_carried_atom: "bpr_futures_carried_state",
      derived_synthetic_usd_atom: "bpr_futures_synthetic_usd_state",
      carry_policy_version: CARRY_POLICY_VERSION,
      synthetic_usd_formula_version: SYNTHETIC_USD_FORMULA_VERSION,
      no_neutral_rows: true,
      no_futures_options_mixing: true,
      no_regime_side: true,
      no_long_short_side: true,
      source_rows_mutated: false,
    },
    denominator,
    quality_summary: qualitySummary,
    hashes: contentHashes,
    artifacts: Object.fromEntries(Object.entries(artifactPaths).map(([key, value]) => [key, toRepoRelative(value)])),
  };

  const summaryJsonText = `${JSON.stringify(summary, null, 2)}\n`;
  const summaryMdText = [
    "# Gate 60G BPR Forced-28 Source-Direction Summary",
    "",
    `Generated: \`${generatedAt}\``,
    "",
    `Verdict: \`${verdict}\``,
    "",
    "## Denominator",
    "",
    `- Gate 59 rows: \`${denominator.input_rows}\``,
    `- Gate 59 weeks: \`${denominator.alpha_weeks}\``,
    `- Symbols per week histogram: \`${JSON.stringify(denominator.symbols_per_week_histogram)}\``,
    `- BPR currency-state rows: \`${denominator.currency_state_rows}\``,
    `- BPR pair-direction rows: \`${denominator.pair_direction_rows}\``,
    `- Neutral pair-direction rows: \`${denominator.neutral_pair_direction_rows}\``,
    "",
    "## Quality Counts",
    "",
    `- Currency-state quality counts: \`${JSON.stringify(qualitySummary.currency_state_quality_counts)}\``,
    `- Pair direction rule counts: \`${JSON.stringify(qualitySummary.pair_direction_rule_counts)}\``,
    `- Pair source-direction eligible rows: \`${qualitySummary.pair_source_direction_eligible_rows}\``,
    `- Promotion eligible pair-direction rows: \`${qualitySummary.promotion_eligible_pair_direction_rows}\``,
    `- Promotion ineligible pair-direction rows: \`${qualitySummary.promotion_ineligible_pair_direction_rows}\``,
    "",
    "## Hashes",
    "",
    `- Currency-state ledger hash: \`${contentHashes.bpr_currency_state_ledger_hash}\``,
    `- Synthetic USD ledger hash: \`${contentHashes.bpr_synthetic_usd_ledger_hash}\``,
    `- Pair-direction ledger hash: \`${contentHashes.bpr_pair_direction_ledger_hash}\``,
    `- Content invariant hash: \`${contentHashes.bpr_forced28_source_direction_content_invariant_hash}\``,
    "",
  ].join("\n");

  const queryReceiptText = [
    "# Gate 60G BPR Forced-28 Source-Direction Query Receipt",
    "",
    `Generated: \`${generatedAt}\``,
    `Command: \`${COMMAND}\``,
    `Git commit: \`${gitCommit}\``,
    `Git dirty status before artifact write: \`${gitStatus.status}\``,
    `Git dirty files before artifact write: \`${gitStatus.files.join(", ")}\``,
    "",
    "## Source Reads",
    "",
    `- Gate 59 Alpha ledger rows read: \`${alphaRows.length}\``,
    `- Gate 60E BPR value availability matrix rows read: \`${valueMatrixRows.length}\``,
    `- Gate 60F carry policy comparison rows read: \`${gate60fComparisonRows.length}\``,
    "",
    "Read-only file probe against Gate 60E, Gate 60F, and the frozen Gate 59 Alpha denominator. No database write, source mutation, futures/options mixing, Regime transform, broad matrix, Regime LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, or app work was run.",
    "",
    "## Content Hashes",
    "",
    `- BPR currency-state ledger hash: \`${contentHashes.bpr_currency_state_ledger_hash}\``,
    `- BPR pair-direction ledger hash: \`${contentHashes.bpr_pair_direction_ledger_hash}\``,
    `- BPR forced-28 source-direction content invariant hash: \`${contentHashes.bpr_forced28_source_direction_content_invariant_hash}\``,
    "",
  ].join("\n");

  const reportText = [
    "# Gate 60G BPR Forced-28 Source-Direction Ledger",
    "",
    `Generated: \`${generatedAt}\``,
    "",
    `Verdict: \`${verdict}\``,
    "",
    "Gate 60G is BPR-only and source-direction-only. It builds a forced-28 BPR pair-direction ledger against the frozen Gate 59 Alpha v1 denominator while keeping source quality and promotion eligibility separate from direction. It emits no Regime transform, no broad matrix, no Regime LONG/SHORT side, no support/oppose/fade labels, no P&L, no attribution, no Alpha v2, and no risk/execution/MT5/live/app work.",
    "",
    "## Source Direction Contract",
    "",
    "- Required BPR v1 source: `bpr_futures`.",
    "- Shadow-only source: `bpr_futures_and_options`.",
    "- Derived carried atom: `bpr_futures_carried_state`.",
    "- Derived synthetic USD atom: `bpr_futures_synthetic_usd_state`.",
    "- Synthetic USD formula: inverse average of available non-USD BPR futures states for the same Alpha week.",
    "- Pair rows carry `BASE_CURRENCY` / `QUOTE_CURRENCY` source direction only; they do not encode LONG/SHORT or Regime side.",
    "- No futures/options row is used to fill a futures row.",
    "",
    "## Denominator",
    "",
    `- Gate 59 rows: \`${denominator.input_rows}\``,
    `- Gate 59 weeks: \`${denominator.alpha_weeks}\``,
    `- BPR currency-state rows: \`${denominator.currency_state_rows}\``,
    `- BPR pair-direction rows: \`${denominator.pair_direction_rows}\``,
    `- Duplicate pair-direction row keys: \`${denominator.duplicate_pair_direction_row_keys}\``,
    `- Neutral pair-direction rows: \`${denominator.neutral_pair_direction_rows}\``,
    "",
    "## Quality Summary",
    "",
    `- Currency-state quality counts: \`${JSON.stringify(qualitySummary.currency_state_quality_counts)}\``,
    `- Pair direction rule counts: \`${JSON.stringify(qualitySummary.pair_direction_rule_counts)}\``,
    `- Pair source-direction eligible rows: \`${qualitySummary.pair_source_direction_eligible_rows}\``,
    `- Promotion eligible pair-direction rows: \`${qualitySummary.promotion_eligible_pair_direction_rows}\``,
    `- Promotion ineligible pair-direction rows: \`${qualitySummary.promotion_ineligible_pair_direction_rows}\``,
    "",
    "## Interpretation",
    "",
    "The ledger forces every Alpha pair-week to a non-neutral BPR source direction, but degraded rows are not hidden. Early no-prior BPR futures absences, stale carries, timing-blocked carries, and partial synthetic USD component coverage are explicit promotion-ineligibility reasons. This keeps forced-28 shape parity without silently promoting weak source states.",
    "",
    "## Hashes",
    "",
    `- Currency-state ledger hash: \`${contentHashes.bpr_currency_state_ledger_hash}\``,
    `- Synthetic USD ledger hash: \`${contentHashes.bpr_synthetic_usd_ledger_hash}\``,
    `- Pair-direction ledger hash: \`${contentHashes.bpr_pair_direction_ledger_hash}\``,
    `- Degraded-state report hash: \`${contentHashes.bpr_unresolved_degraded_state_report_hash}\``,
    `- Source-direction content invariant hash: \`${contentHashes.bpr_forced28_source_direction_content_invariant_hash}\``,
    "",
    "## Stop",
    "",
    "Stop here. Do not proceed to BPR promotion, Regime transforms, broad matrix, Regime side construction, Alpha v2, risk, execution, MT5/live, app work, or source mutation.",
    "",
  ].join("\n");

  const qualitySummaryJsonHash = sha256Text(summaryJsonText);
  const qualitySummaryMdHash = sha256Text(summaryMdText);
  const queryReceiptHash = sha256Text(queryReceiptText);
  const reportHash = sha256Text(reportText);
  const shaIdentityText = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${generatedAt}`,
    `git_commit ${gitCommit}`,
    `verdict ${verdict}`,
    `gate59_alpha_ledger_jsonl ${contentHashes.gate59_alpha_ledger_jsonl_sha256} ${toRepoRelative(options.alphaLedgerPath)}`,
    `gate60e_value_matrix ${contentHashes.gate60e_value_matrix_file_sha256} ${toRepoRelative(valueMatrixPath)}`,
    `gate60f_carry_policy_comparison ${contentHashes.gate60f_carry_policy_comparison_file_sha256} ${toRepoRelative(gate60fCarryComparisonPath)}`,
    `gate60f_sha_identity ${contentHashes.gate60f_sha_identity_file_sha256} ${toRepoRelative(gate60fShaIdentityPath)}`,
    `bpr_currency_state_ledger ${contentHashes.bpr_currency_state_ledger_hash} ${toRepoRelative(artifactPaths.currencyStateLedger)}`,
    `bpr_synthetic_usd_ledger ${contentHashes.bpr_synthetic_usd_ledger_hash} ${toRepoRelative(artifactPaths.syntheticUsdLedger)}`,
    `bpr_pair_direction_ledger ${contentHashes.bpr_pair_direction_ledger_hash} ${toRepoRelative(artifactPaths.pairDirectionLedger)}`,
    `bpr_unresolved_degraded_state_report ${contentHashes.bpr_unresolved_degraded_state_report_hash} ${toRepoRelative(artifactPaths.degradedReport)}`,
    `quality_summary_json ${qualitySummaryJsonHash} ${toRepoRelative(artifactPaths.qualitySummaryJson)}`,
    `quality_summary_md ${qualitySummaryMdHash} ${toRepoRelative(artifactPaths.qualitySummaryMd)}`,
    `query_receipt ${queryReceiptHash} ${toRepoRelative(artifactPaths.queryReceipt)}`,
    `report ${reportHash} ${toRepoRelative(artifactPaths.report)}`,
    `combined_hash ${sha256Stable({ ...contentHashes, qualitySummaryJsonHash, qualitySummaryMdHash, queryReceiptHash, reportHash })} content`,
    "",
  ].join("\n");

  await writeTextArtifact(artifactPaths.currencyStateLedger, currencyStateText);
  await writeTextArtifact(artifactPaths.syntheticUsdLedger, syntheticUsdText);
  await writeTextArtifact(artifactPaths.pairDirectionLedger, pairDirectionText);
  await writeTextArtifact(artifactPaths.degradedReport, degradedText);
  await writeTextArtifact(artifactPaths.qualitySummaryJson, summaryJsonText);
  await writeTextArtifact(artifactPaths.qualitySummaryMd, summaryMdText);
  await writeTextArtifact(artifactPaths.queryReceipt, queryReceiptText);
  await writeTextArtifact(artifactPaths.shaIdentity, shaIdentityText);
  await writeTextArtifact(artifactPaths.report, reportText);

  if (invariantFailures.length > 0) {
    throw new Error(`Gate 60G invariant failure: ${invariantFailures.join(", ")}`);
  }

  console.log(
    JSON.stringify(
      {
        gate_id: GATE_ID,
        verdict,
        command: COMMAND,
        denominator,
        quality_summary: qualitySummary,
        hashes: contentHashes,
        artifacts: Object.fromEntries(Object.entries(artifactPaths).map(([key, value]) => [key, toRepoRelative(value)])),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
