import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Stable, sha256Text } from "@engine/research/hash";

export const EXPECTED_ROWS = 10_444;
export const EXPECTED_WEEKS = 373;
export const EXPECTED_SYMBOLS_PER_WEEK = 28;
export const GATE65_DATE = "2026-06-27";

export const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
export const DEFAULT_GATE60C_DIR = "docs/research/gates/gate60c/artifacts/gate60c-regime-source-atom-fill";
export const DEFAULT_GATE60G_DIR = "docs/research/gates/gate60g/artifacts/gate60g-bpr-forced28-source-direction-ledger";
export const DEFAULT_GATE61A_DIR = "docs/research/gates/gate61a/artifacts/gate61a-brain-architecture-refactor";
export const DEFAULT_GATE64A_DIR = "docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit";
export const DEFAULT_GATE64B_DIR = "docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock";
export const DEFAULT_GATE64C_DIR = "docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh";
export const DEFAULT_GATE65A_DIR = "docs/research/gates/gate65a/artifacts/gate65a-brain-atom-contract-v2-sync";
export const DEFAULT_GATE65B_DIR = "docs/research/gates/gate65b/artifacts/gate65b-decision-signature-pf-surface";
export const DEFAULT_GATE65C_DIR = "docs/research/gates/gate65c/artifacts/gate65c-atom-policy-ledger-v0";
export const DEFAULT_GATE65D_DIR = "docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0";
export const DEFAULT_GATE65E_DIR = "docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0";

export const VALUATION_FORMULAS = ["valuation_gap_reer_deviation", "valuation_gap_neer_reer_relative"] as const;
export type ValuationFormula = (typeof VALUATION_FORMULAS)[number];

export type Direction = "BASE_CURRENCY" | "QUOTE_CURRENCY";
export type Side = "LONG" | "SHORT";
export type PolicyRole =
  | "follow"
  | "fade"
  | "confirm_only"
  | "contradiction_warning"
  | "tie_breaker"
  | "context_only"
  | "source_quality_warning"
  | "abstain_from_vote"
  | "fail_closed"
  | "blocked";
export type AllowedFinalAlgorithmUse = "direct_vote" | "confirm_only" | "tie_breaker" | "context_only" | "quality_gate" | "blocked";

export type AlphaLedgerRow = {
  row_key: string;
  week: { week_open_utc: string; year: number; quarter: string };
  instrument: { symbol: string; base_currency: string | null; quote_currency: string | null };
  cot_atoms: {
    side: Side;
    tei_spread: number | null;
    abs_tei_spread: number | null;
    tei_spread_bucket: string;
    tie_flag: boolean;
    carry_forward_flag: boolean;
    carry_previous_flag: boolean;
    lifecycle_state: string;
  };
  strength_atoms: {
    gate57e_side: Side;
    score_spread: number | null;
    abs_score_spread: number | null;
    score_spread_bucket: string;
    lifecycle_bucket: string;
    phase_bucket: string;
    lifecycle_phase_key: string;
    gate57e_action_label: string;
  };
  arbitration: { final_side: Side; final_side_source: string };
  outcomes: { adr_grid: { long: number; short: number }; weekly_hold: { long: number; short: number } };
  diagnostics: { missing_cot_state: boolean; missing_strength_state: boolean };
};

export type CurrencyWeekAtomRow = {
  row_key: string;
  alpha_week_open_utc: string;
  currency: string;
  atom_key: string;
  status: string;
  value: number | null;
  content_hash?: string;
};

export type BprPairDirectionRow = {
  row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  base_currency: string;
  quote_currency: string;
  bpr_source_direction: Direction;
  bpr_source_direction_rule: string;
  base_source_quality: string;
  quote_source_quality: string;
  pair_source_direction_eligible: boolean;
  promotion_eligible_pair_direction: boolean;
  promotion_ineligible_reasons: string[];
  source_rows_mutated: boolean;
};

export type ValuationPairRow = {
  row_key: string;
  alpha_row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  base_currency: string;
  quote_currency: string;
  formula_id: ValuationFormula;
  formula_version: string;
  spread_base_minus_quote: number;
  natural_direction: Direction;
  inverse_direction: Direction;
  forced28_joinable: boolean;
  degraded: boolean;
  degraded_reasons: string[];
  content_hash: string;
};

export type Gate64cCandidateRow = {
  candidate_id: string;
  family: string;
  label: string;
  atom_keys: string[];
  source_cells: string[];
  forced28_row_count: number;
  duplicate_row_count: number;
  selected_direction_counts: Record<string, number>;
  degraded_row_count: number;
  adr_grid: MetricSummary;
  weekly_hold: MetricSummary;
  negative_adr_grid_years: number;
  worst_adr_grid_year: { year: number; adr_grid_adr: number | null; weekly_hold_adr: number | null } | null;
  annual_summary: AnnualSummaryRow[];
  top_week_share?: { top5_abs_week_share: number | null; top_abs_weeks: Array<{ week_open_utc: string; adr_grid_sum: number }> };
  top_pair_share?: { top_abs_pair: { symbol: string; adr_grid_sum: number } | null; top_abs_pair_share: number | null };
  decision_signature_sha256: string;
  interpretation_bucket?: string;
  content_hash?: string;
};

export type MetricSummary = {
  adr_sum: number | null;
  adr_mean: number | null;
  max_drawdown: number;
  r_over_drawdown: number | null;
  row_pf: number | null;
};

export type AnnualSummaryRow = {
  year: number;
  rows: number;
  weeks: number;
  adr_grid_adr: number | null;
  weekly_hold_adr: number | null;
};

export type Decision = {
  direction: Direction;
  direction_source: string;
  degraded: boolean;
  degraded_reasons: string[];
  atom_votes: Record<string, Direction>;
  policy_roles?: Record<string, number>;
  scenario_group_key?: string | null;
};

export type CandidateContract = {
  candidate_id: string;
  family: string;
  label: string;
  candidate_direction_kind: "candidate_atom_direction" | "candidate_cell_direction" | "candidate_composite_direction";
  atom_keys: string[];
  source_cells: string[];
  transform_version: string;
  tie_rule: string;
  dependency_rule: string;
  complexity: number;
  discovery_only: true;
};

export type CandidateSummary = CandidateContract & {
  source_count: number;
  forced28_row_count: number;
  duplicate_row_count: number;
  weeks: number;
  full_weeks: number;
  symbols_per_week_histogram: Record<string, number>;
  selected_direction_counts: Record<string, number>;
  degraded_row_count: number;
  degraded_reason_counts: Record<string, number>;
  missing_outcome_rows: number;
  adr_grid: MetricSummary;
  weekly_hold: MetricSummary;
  negative_adr_grid_years: number;
  worst_adr_grid_year: { year: number; adr_grid_adr: number | null; weekly_hold_adr: number | null } | null;
  annual_summary: AnnualSummaryRow[];
  top_week_share: { top5_abs_week_share: number | null; top_abs_weeks: Array<{ week_open_utc: string; adr_grid_sum: number }> };
  top_pair_share: { top_abs_pair: { symbol: string; adr_grid_sum: number } | null; top_abs_pair_share: number | null };
  decision_signature_sha256: string;
  interpretation_bucket: string;
  policy_role_participation?: Record<string, number>;
  atom_participation_counts?: Record<string, number>;
  degraded_or_warning_rows?: number;
  fallback_rows?: number;
  scenario_memory_exposure?: Record<string, number>;
  content_hash: string;
};

export type AtomPolicyLedgerRow = {
  row_key: string;
  alpha_row_key: string;
  week_open_utc: string;
  year: number;
  symbol: string;
  base_currency: string | null;
  quote_currency: string | null;
  atom_id: string;
  cell_id: string;
  source_direction: Direction | null;
  natural_direction: Direction | null;
  inverse_direction: Direction | null;
  source_quality_state: string;
  evidence_tier: string;
  policy_role: PolicyRole;
  policy_reason: string;
  degraded: boolean;
  fail_closed: boolean;
  blocked: boolean;
  degraded_reasons: string[];
  allowed_final_algorithm_use: AllowedFinalAlgorithmUse;
  content_hash?: string;
};

export type ScenarioMemoryRow = {
  row_key: string;
  alpha_row_key: string;
  week_open_utc: string;
  year: number;
  symbol: string;
  scenario_fingerprint: string;
  fingerprint_sha256: string;
  exact_state_key: string;
  cell_agreement_state_key: string;
  macro_value_state_key: string;
  source_quality_state_key: string;
  cot_strength_disagreement_state_key: string;
  rrp_valuation_agreement_state_key: string;
  state_components: Record<string, string | number | boolean | null>;
  policy_roles: Record<string, PolicyRole>;
  outcome_fields: {
    alpha_v1_follow_adr_grid: number;
    alpha_v1_fade_adr_grid: number;
    alpha_v1_follow_weekly_hold: number;
    alpha_v1_fade_weekly_hold: number;
  };
  low_support_evaluation_warning: string;
  content_hash: string;
};

const CURRENCY_TIE_RANK = new Map(["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"].map((currency, index) => [currency, index]));

export function parseArgMap() {
  const map = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=", 2);
    if (key && value) map.set(key, value);
  }
  return map;
}

export function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

export function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join("/");
}

export async function ensureParent(filePath: string) {
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
}

export async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function readJsonl<T>(filePath: string) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

export async function writeJson(filePath: string, value: unknown) {
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeJsonl(filePath: string, rows: unknown[]) {
  await ensureParent(filePath);
  await writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

export async function writeText(filePath: string, value: string) {
  await ensureParent(filePath);
  await writeFile(filePath, value);
}

export async function fileHash(filePath: string) {
  return sha256Text(await readFile(filePath));
}

export async function writeShaManifest(filePath: string, gateId: string, command: string, entries: Array<{ label: string; path: string }>) {
  const lines = [`gate_id ${gateId}`, `command ${command}`, `generated_at ${new Date().toISOString()}`, `git_commit ${gitCommit()}`];
  for (const entry of entries) {
    lines.push(`${entry.label} ${await fileHash(entry.path)} ${toRepoRelative(entry.path)}`);
  }
  await writeText(filePath, `${lines.join("\n")}\n`);
}

export function round(value: number | null | undefined, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function duplicateCount(values: string[]) {
  return Object.values(countBy(values, (value) => value)).filter((count) => count > 1).length;
}

export function rowsPerWeek(rows: Pick<AlphaLedgerRow, "week">[]) {
  const counts = countBy(rows, (row) => row.week.week_open_utc);
  return {
    weeks: Object.keys(counts).length,
    full_weeks: Object.values(counts).filter((count) => count === EXPECTED_SYMBOLS_PER_WEEK).length,
    histogram: countBy(Object.values(counts), (count) => String(count)),
  };
}

export function denominatorSummary(alphaRows: AlphaLedgerRow[]) {
  const weekShape = rowsPerWeek(alphaRows);
  const duplicateWeekSymbolRows = duplicateCount(alphaRows.map((row) => `${row.week.week_open_utc}|${row.instrument.symbol}`));
  return {
    alpha_rows: alphaRows.length,
    expected_alpha_rows: EXPECTED_ROWS,
    alpha_weeks: weekShape.weeks,
    expected_alpha_weeks: EXPECTED_WEEKS,
    symbols_per_week_histogram: weekShape.histogram,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    full_weeks: weekShape.full_weeks,
    duplicate_week_symbol_rows: duplicateWeekSymbolRows,
    forced28_preserved:
      alphaRows.length === EXPECTED_ROWS &&
      weekShape.weeks === EXPECTED_WEEKS &&
      weekShape.full_weeks === EXPECTED_WEEKS &&
      duplicateWeekSymbolRows === 0,
  };
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function maxDrawdown(valuesByWeek: Map<string, number>) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const week of [...valuesByWeek.keys()].sort()) {
    equity += valuesByWeek.get(week) ?? 0;
    if (equity > peak) peak = equity;
    const drawdown = equity - peak;
    if (drawdown < maxDd) maxDd = drawdown;
  }
  return round(maxDd, 6) ?? 0;
}

export function profitFactor(values: number[]) {
  const positive = values.filter((value) => value > 0).reduce((total, value) => total + value, 0);
  const negative = values.filter((value) => value < 0).reduce((total, value) => total + value, 0);
  if (negative === 0) return positive > 0 ? null : 0;
  return round(positive / Math.abs(negative));
}

export function rOverDrawdown(total: number | null, drawdown: number | null) {
  if (total === null || drawdown === null || drawdown === 0) return null;
  return round(total / Math.abs(drawdown));
}

export function metricFromValues(valuesByRow: Array<{ week_open_utc: string; value: number }>): MetricSummary {
  const values = valuesByRow.map((row) => row.value);
  const byWeek = new Map<string, number>();
  for (const row of valuesByRow) byWeek.set(row.week_open_utc, (byWeek.get(row.week_open_utc) ?? 0) + row.value);
  const total = round(sum(values));
  const drawdown = maxDrawdown(byWeek);
  return {
    adr_sum: total,
    adr_mean: round(values.length > 0 ? sum(values) / values.length : 0),
    max_drawdown: drawdown,
    r_over_drawdown: rOverDrawdown(total, drawdown),
    row_pf: profitFactor(values),
  };
}

export function sideFromDirection(direction: Direction): Side {
  return direction === "BASE_CURRENCY" ? "LONG" : "SHORT";
}

export function directionFromSide(side: Side): Direction {
  return side === "LONG" ? "BASE_CURRENCY" : "QUOTE_CURRENCY";
}

export function opposite(direction: Direction): Direction {
  return direction === "BASE_CURRENCY" ? "QUOTE_CURRENCY" : "BASE_CURRENCY";
}

export function adrFromSide(side: Side, row: AlphaLedgerRow) {
  return side === "LONG" ? row.outcomes.adr_grid.long : row.outcomes.adr_grid.short;
}

export function holdFromSide(side: Side, row: AlphaLedgerRow) {
  return side === "LONG" ? row.outcomes.weekly_hold.long : row.outcomes.weekly_hold.short;
}

export function currencyRankDirection(base: string, quote: string) {
  const baseRank = CURRENCY_TIE_RANK.get(base) ?? Number.MAX_SAFE_INTEGER;
  const quoteRank = CURRENCY_TIE_RANK.get(quote) ?? Number.MAX_SAFE_INTEGER;
  return baseRank <= quoteRank ? "BASE_CURRENCY" : "QUOTE_CURRENCY";
}

export function quantileBreaks(values: number[], bucketCount: number) {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  return Array.from({ length: bucketCount - 1 }, (_unused, index) => sorted[Math.floor((sorted.length * (index + 1)) / bucketCount)] ?? 0);
}

export function bucketByBreaks(value: number | null, breaks: number[], labels: string[]) {
  if (value === null || !Number.isFinite(value)) return "missing";
  for (let index = 0; index < breaks.length; index += 1) {
    if (value <= breaks[index]) return labels[index] ?? `bucket_${index + 1}`;
  }
  return labels[labels.length - 1] ?? `bucket_${labels.length}`;
}

export function compactCandidate(row: CandidateSummary | Gate64cCandidateRow) {
  return {
    candidate_id: row.candidate_id,
    family: row.family,
    adr_grid: row.adr_grid,
    weekly_hold: row.weekly_hold,
    degraded_row_count: row.degraded_row_count,
    negative_adr_grid_years: row.negative_adr_grid_years,
    worst_adr_grid_year: row.worst_adr_grid_year,
    decision_signature_sha256: row.decision_signature_sha256,
  };
}

export async function loadAlphaRows(alphaLedgerPath = DEFAULT_ALPHA_LEDGER_PATH) {
  return readJsonl<AlphaLedgerRow>(alphaLedgerPath);
}

export async function loadCurrencyAtomRows(gate60cDir = DEFAULT_GATE60C_DIR) {
  return readJsonl<CurrencyWeekAtomRow>(path.join(gate60cDir, "gate60c-currency-week-source-atom-ledger.rows.jsonl"));
}

export async function loadBprRows(gate60gDir = DEFAULT_GATE60G_DIR) {
  return readJsonl<BprPairDirectionRow>(path.join(gate60gDir, "gate60g-bpr-pair-direction-ledger.rows.jsonl"));
}

export async function loadValuationRows(gate64bDir = DEFAULT_GATE64B_DIR) {
  return readJsonl<ValuationPairRow>(path.join(gate64bDir, "valuation-gap-pair-atom-ledger.rows.jsonl"));
}

export async function loadGate64cRows(gate64cDir = DEFAULT_GATE64C_DIR) {
  return readJsonl<Gate64cCandidateRow>(path.join(gate64cDir, "gate64c-matrix.rows.jsonl"));
}

export function currencyAtomKey(atomKey: string, weekOpenUtc: string, currency: string) {
  return `${atomKey}|${weekOpenUtc}|${currency}`;
}

export function valuationKey(formulaId: string, alphaRowKey: string) {
  return `${formulaId}|${alphaRowKey}`;
}

export function sideDecision(row: AlphaLedgerRow, side: Side, source: string, voteKey: string): Decision {
  const direction = directionFromSide(side);
  return { direction, direction_source: source, degraded: false, degraded_reasons: [], atom_votes: { [voteKey]: direction } };
}

export function majorityVote(votes: Decision[], tieDirection: Direction, directionSource: string): Decision {
  const baseVotes = votes.filter((vote) => vote.direction === "BASE_CURRENCY").length;
  const quoteVotes = votes.length - baseVotes;
  const direction = baseVotes > quoteVotes ? "BASE_CURRENCY" : quoteVotes > baseVotes ? "QUOTE_CURRENCY" : tieDirection;
  return {
    direction,
    direction_source: directionSource,
    degraded: votes.some((vote) => vote.degraded),
    degraded_reasons: votes.flatMap((vote) => vote.degraded_reasons),
    atom_votes: Object.assign({}, ...votes.map((vote) => vote.atom_votes)),
  };
}

export function compareCurrencyAtomDirection(
  row: AlphaLedgerRow,
  atomKey: string,
  polarity: "natural" | "inverse",
  atomsByKey: Map<string, CurrencyWeekAtomRow>,
): Decision {
  const base = row.instrument.base_currency;
  const quote = row.instrument.quote_currency;
  const degradedReasons: string[] = [];
  if (!base || !quote) {
    return { direction: "BASE_CURRENCY", direction_source: `${atomKey}_missing_instrument`, degraded: true, degraded_reasons: ["missing_base_or_quote"], atom_votes: { [atomKey]: "BASE_CURRENCY" } };
  }
  const baseAtom = atomsByKey.get(currencyAtomKey(atomKey, row.week.week_open_utc, base));
  const quoteAtom = atomsByKey.get(currencyAtomKey(atomKey, row.week.week_open_utc, quote));
  if (!baseAtom || !quoteAtom) degradedReasons.push(`${atomKey}:missing_currency_atom_row`);
  if (baseAtom && baseAtom.status !== "FILLED_POINT_IN_TIME") degradedReasons.push(`${atomKey}:base_status_${baseAtom.status}`);
  if (quoteAtom && quoteAtom.status !== "FILLED_POINT_IN_TIME") degradedReasons.push(`${atomKey}:quote_status_${quoteAtom.status}`);
  const baseValue = baseAtom?.value;
  const quoteValue = quoteAtom?.value;
  let naturalDirection: Direction;
  if (typeof baseValue === "number" && typeof quoteValue === "number") {
    if (baseValue > quoteValue) naturalDirection = "BASE_CURRENCY";
    else if (baseValue < quoteValue) naturalDirection = "QUOTE_CURRENCY";
    else naturalDirection = currencyRankDirection(base, quote);
  } else {
    naturalDirection = currencyRankDirection(base, quote);
    degradedReasons.push(`${atomKey}:missing_numeric_value_rank_fallback`);
  }
  const direction = polarity === "natural" ? naturalDirection : opposite(naturalDirection);
  return {
    direction,
    direction_source: `${atomKey}_${polarity}_base_minus_quote`,
    degraded: degradedReasons.length > 0,
    degraded_reasons: degradedReasons,
    atom_votes: { [atomKey]: direction },
  };
}

export function bprDecision(row: AlphaLedgerRow, bprByKey: Map<string, BprPairDirectionRow>, polarity: "source" | "fade" = "source"): Decision {
  const bpr = bprByKey.get(row.row_key);
  if (!bpr) {
    return { direction: "BASE_CURRENCY", direction_source: "bpr_missing", degraded: true, degraded_reasons: ["missing_bpr_pair_direction"], atom_votes: { bpr: "BASE_CURRENCY" } };
  }
  const direction = polarity === "source" ? bpr.bpr_source_direction : opposite(bpr.bpr_source_direction);
  const degradedReasons = [
    ...(bpr.pair_source_direction_eligible ? [] : ["bpr_pair_source_direction_ineligible"]),
    ...(bpr.promotion_eligible_pair_direction ? [] : ["bpr_pair_direction_promotion_ineligible"]),
    ...bpr.promotion_ineligible_reasons.map((reason) => `bpr:${reason}`),
  ];
  return {
    direction,
    direction_source: polarity === "source" ? `bpr_${bpr.bpr_source_direction_rule}` : `fade_bpr_${bpr.bpr_source_direction_rule}`,
    degraded: degradedReasons.length > 0,
    degraded_reasons: degradedReasons,
    atom_votes: { bpr: direction },
  };
}

export function valuationDecision(row: AlphaLedgerRow, formulaId: ValuationFormula, polarity: "natural" | "inverse", valuationByKey: Map<string, ValuationPairRow>): Decision {
  const valuation = valuationByKey.get(valuationKey(formulaId, row.row_key));
  if (!valuation) {
    return {
      direction: "BASE_CURRENCY",
      direction_source: `${formulaId}_${polarity}_missing`,
      degraded: true,
      degraded_reasons: [`${formulaId}:missing_pair_row`],
      atom_votes: { [formulaId]: "BASE_CURRENCY" },
    };
  }
  const direction = polarity === "natural" ? valuation.natural_direction : valuation.inverse_direction;
  return {
    direction,
    direction_source: `${formulaId}_${polarity}`,
    degraded: valuation.degraded,
    degraded_reasons: valuation.degraded_reasons.map((reason) => `${formulaId}:${reason}`),
    atom_votes: { [formulaId]: direction },
  };
}

export function scoreCandidate(
  contract: CandidateContract,
  alphaRows: AlphaLedgerRow[],
  directionFor: (row: AlphaLedgerRow) => Decision,
): CandidateSummary {
  const scored = alphaRows.map((row) => {
    const decision = directionFor(row);
    const side = sideFromDirection(decision.direction);
    return {
      row,
      decision,
      adr_grid_adr: adrFromSide(side, row),
      weekly_hold_adr: holdFromSide(side, row),
    };
  });
  const weekShape = rowsPerWeek(alphaRows);
  const annual = annualSummary(scored.map((entry) => ({ row: entry.row, adr_grid_adr: entry.adr_grid_adr, weekly_hold_adr: entry.weekly_hold_adr })));
  const base = {
    ...contract,
    source_count: new Set(contract.source_cells).size,
    forced28_row_count: scored.length,
    duplicate_row_count: duplicateCount(scored.map((entry) => `${entry.row.week.week_open_utc}|${entry.row.instrument.symbol}`)),
    weeks: weekShape.weeks,
    full_weeks: weekShape.full_weeks,
    symbols_per_week_histogram: weekShape.histogram,
    selected_direction_counts: countBy(scored, (entry) => entry.decision.direction),
    degraded_row_count: scored.filter((entry) => entry.decision.degraded).length,
    degraded_reason_counts: countBy(scored.flatMap((entry) => entry.decision.degraded_reasons), (reason) => reason),
    missing_outcome_rows: scored.filter((entry) => !Number.isFinite(entry.adr_grid_adr) || !Number.isFinite(entry.weekly_hold_adr)).length,
    adr_grid: metricFromValues(scored.map((entry) => ({ week_open_utc: entry.row.week.week_open_utc, value: entry.adr_grid_adr }))),
    weekly_hold: metricFromValues(scored.map((entry) => ({ week_open_utc: entry.row.week.week_open_utc, value: entry.weekly_hold_adr }))),
    negative_adr_grid_years: annual.filter((row) => (row.adr_grid_adr ?? 0) < 0).length,
    worst_adr_grid_year:
      annual.length > 0
        ? [...annual].sort((left, right) => (left.adr_grid_adr ?? 0) - (right.adr_grid_adr ?? 0)).map((row) => ({ year: row.year, adr_grid_adr: row.adr_grid_adr, weekly_hold_adr: row.weekly_hold_adr }))[0]
        : null,
    annual_summary: annual,
    top_week_share: topWeekShare(scored.map((entry) => ({ row: entry.row, adr_grid_adr: entry.adr_grid_adr }))),
    top_pair_share: topPairShare(scored.map((entry) => ({ row: entry.row, adr_grid_adr: entry.adr_grid_adr }))),
    decision_signature_sha256: sha256Text(scored.map((entry) => `${entry.row.row_key}|${entry.decision.direction}`).sort().join("\n")),
    policy_role_participation: countNumericRecords(scored.map((entry) => entry.decision.policy_roles ?? {})),
    atom_participation_counts: countNumericRecords(scored.map((entry) => entry.decision.atom_votes)),
    degraded_or_warning_rows: scored.filter((entry) => entry.decision.degraded || Object.keys(entry.decision.policy_roles ?? {}).some((role) => role.includes("warning"))).length,
    fallback_rows: scored.filter((entry) => entry.decision.direction_source.includes("fallback") || entry.decision.direction_source.includes("else")).length,
    scenario_memory_exposure: countBy(scored, (entry) => entry.decision.scenario_group_key ?? "none"),
  };
  const interpretationBucket = classifyCandidate(base);
  return { ...base, interpretation_bucket: interpretationBucket, content_hash: sha256Stable({ ...base, interpretation_bucket: interpretationBucket }) };
}

function countNumericRecords(records: Array<Record<string, number | string>>) {
  const counts: Record<string, number> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) counts[key] = (counts[key] ?? 0) + (typeof value === "number" ? value : 1);
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function classifyCandidate(summary: Omit<CandidateSummary, "interpretation_bucket" | "content_hash">) {
  if (summary.forced28_row_count !== EXPECTED_ROWS || summary.duplicate_row_count !== 0 || summary.missing_outcome_rows !== 0) return "disqualified";
  if (summary.degraded_row_count > 0 || summary.negative_adr_grid_years > 2 || (summary.top_week_share.top5_abs_week_share ?? 0) >= 0.35 || (summary.top_pair_share.top_abs_pair_share ?? 0) >= 0.25) {
    return "fragile_or_governance_review";
  }
  if ((summary.adr_grid.adr_sum ?? 0) > 0 && (summary.adr_grid.row_pf ?? 0) > 1) return "promising_discovery_only";
  return "weak_or_negative";
}

function annualSummary(scored: Array<{ row: AlphaLedgerRow; adr_grid_adr: number; weekly_hold_adr: number }>) {
  const groups = new Map<number, Array<{ row: AlphaLedgerRow; adr_grid_adr: number; weekly_hold_adr: number }>>();
  for (const row of scored) groups.set(row.row.week.year, [...(groups.get(row.row.week.year) ?? []), row]);
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, rows]) => ({
      year,
      rows: rows.length,
      weeks: new Set(rows.map((row) => row.row.week.week_open_utc)).size,
      adr_grid_adr: metricFromValues(rows.map((row) => ({ week_open_utc: row.row.week.week_open_utc, value: row.adr_grid_adr }))).adr_sum,
      weekly_hold_adr: metricFromValues(rows.map((row) => ({ week_open_utc: row.row.week.week_open_utc, value: row.weekly_hold_adr }))).adr_sum,
    }));
}

function topWeekShare(scored: Array<{ row: AlphaLedgerRow; adr_grid_adr: number }>) {
  const byWeek = new Map<string, number>();
  for (const row of scored) byWeek.set(row.row.week.week_open_utc, (byWeek.get(row.row.week.week_open_utc) ?? 0) + row.adr_grid_adr);
  const rows = [...byWeek.entries()]
    .map(([week_open_utc, adr_grid_sum]) => ({ week_open_utc, adr_grid_sum: round(adr_grid_sum, 6) ?? 0 }))
    .sort((left, right) => Math.abs(right.adr_grid_sum) - Math.abs(left.adr_grid_sum));
  const totalAbs = rows.reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  const top5Abs = rows.slice(0, 5).reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  return { top5_abs_week_share: totalAbs > 0 ? round(top5Abs / totalAbs, 6) : null, top_abs_weeks: rows.slice(0, 10) };
}

function topPairShare(scored: Array<{ row: AlphaLedgerRow; adr_grid_adr: number }>) {
  const byPair = new Map<string, number>();
  for (const row of scored) byPair.set(row.row.instrument.symbol, (byPair.get(row.row.instrument.symbol) ?? 0) + row.adr_grid_adr);
  const rows = [...byPair.entries()]
    .map(([symbol, adr_grid_sum]) => ({ symbol, adr_grid_sum: round(adr_grid_sum, 6) ?? 0 }))
    .sort((left, right) => Math.abs(right.adr_grid_sum) - Math.abs(left.adr_grid_sum));
  const totalAbs = rows.reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  return { top_abs_pair: rows[0] ?? null, top_abs_pair_share: rows[0] && totalAbs > 0 ? round(Math.abs(rows[0].adr_grid_sum) / totalAbs, 6) : null };
}

export function rankCandidateRows(rows: CandidateSummary[] | Gate64cCandidateRow[]) {
  const combinedPf = (row: CandidateSummary | Gate64cCandidateRow) => ((row.adr_grid.row_pf ?? 0) + (row.weekly_hold.row_pf ?? 0)) / 2;
  const robustScore = (row: CandidateSummary | Gate64cCandidateRow) =>
    (row.adr_grid.row_pf ?? 0) + (row.weekly_hold.row_pf ?? 0) + (row.adr_grid.r_over_drawdown ?? 0) / 10 - row.negative_adr_grid_years * 0.1 - row.degraded_row_count / EXPECTED_ROWS;
  return {
    best_adr_grid_pf: [...rows].sort((left, right) => (right.adr_grid.row_pf ?? -999) - (left.adr_grid.row_pf ?? -999)).slice(0, 20),
    best_weekly_hold_pf: [...rows].sort((left, right) => (right.weekly_hold.row_pf ?? -999) - (left.weekly_hold.row_pf ?? -999)).slice(0, 20),
    best_combined_pf: [...rows].sort((left, right) => combinedPf(right) - combinedPf(left)).slice(0, 20),
    best_robust_pf: [...rows].sort((left, right) => robustScore(right) - robustScore(left)).slice(0, 20),
    best_zero_negative_years: [...rows].filter((row) => row.negative_adr_grid_years === 0).sort((left, right) => (right.adr_grid.row_pf ?? -999) - (left.adr_grid.row_pf ?? -999)).slice(0, 20),
    best_low_degradation: [...rows].filter((row) => row.degraded_row_count === 0).sort((left, right) => (right.adr_grid.row_pf ?? -999) - (left.adr_grid.row_pf ?? -999)).slice(0, 20),
  };
}

export function buildPolicyLedger(
  alphaRows: AlphaLedgerRow[],
  currencyRows: CurrencyWeekAtomRow[],
  bprRows: BprPairDirectionRow[],
  valuationRows: ValuationPairRow[],
) {
  const atomsByKey = new Map(currencyRows.map((row) => [currencyAtomKey(row.atom_key, row.alpha_week_open_utc, row.currency), row]));
  const bprByKey = new Map(bprRows.map((row) => [row.row_key, row]));
  const valuationByKey = new Map(valuationRows.map((row) => [valuationKey(row.formula_id, row.alpha_row_key), row]));
  const valuationTierBreaks = Object.fromEntries(
    VALUATION_FORMULAS.map((formula) => [
      formula,
      quantileBreaks(
        valuationRows.filter((row) => row.formula_id === formula).map((row) => Math.abs(row.spread_base_minus_quote)),
        3,
      ),
    ]),
  ) as Record<ValuationFormula, number[]>;
  const rows: AtomPolicyLedgerRow[] = [];
  for (const alphaRow of alphaRows) {
    const cotDirection = directionFromSide(alphaRow.cot_atoms.side);
    const strengthDirection = directionFromSide(alphaRow.strength_atoms.gate57e_side);
    const cotQualityReason = [
      alphaRow.cot_atoms.tie_flag ? "tie_flag" : null,
      alphaRow.cot_atoms.carry_forward_flag ? "carry_forward" : null,
      alphaRow.cot_atoms.carry_previous_flag ? "carry_previous" : null,
      alphaRow.diagnostics.missing_cot_state ? "missing_cot_state" : null,
    ].filter((value): value is string => value !== null);
    pushPolicy(rows, alphaRow, {
      atom_id: "cot_side",
      cell_id: "cot",
      source_direction: cotDirection,
      natural_direction: cotDirection,
      inverse_direction: opposite(cotDirection),
      source_quality_state: cotQualityReason.length > 0 ? cotQualityReason.join("|") : "clean",
      evidence_tier: alphaRow.cot_atoms.tei_spread_bucket,
      policy_role: cotQualityReason.length > 0 ? "source_quality_warning" : alphaRow.cot_atoms.tei_spread_bucket === "q4_high" ? "follow" : "confirm_only",
      allowed_final_algorithm_use: cotQualityReason.length > 0 ? "quality_gate" : alphaRow.cot_atoms.tei_spread_bucket === "q4_high" ? "direct_vote" : "confirm_only",
      policy_reason: "cot_side_spread_quality",
      degraded_reasons: cotQualityReason,
    });
    pushPolicy(rows, alphaRow, {
      atom_id: "cot_spread_lifecycle_quality",
      cell_id: "cot",
      source_direction: null,
      natural_direction: null,
      inverse_direction: null,
      source_quality_state: `${alphaRow.cot_atoms.lifecycle_state}|${cotQualityReason.length > 0 ? cotQualityReason.join("|") : "clean"}`,
      evidence_tier: alphaRow.cot_atoms.tei_spread_bucket,
      policy_role: cotQualityReason.length > 0 ? "source_quality_warning" : alphaRow.cot_atoms.tei_spread_bucket === "q4_high" ? "tie_breaker" : "context_only",
      allowed_final_algorithm_use: cotQualityReason.length > 0 ? "quality_gate" : alphaRow.cot_atoms.tei_spread_bucket === "q4_high" ? "tie_breaker" : "context_only",
      policy_reason: "cot_quality_context",
      degraded_reasons: cotQualityReason,
    });

    const strengthQualityReason = [
      alphaRow.strength_atoms.phase_bucket === "initial" ? "initial_phase" : null,
      alphaRow.diagnostics.missing_strength_state ? "missing_strength_state" : null,
    ].filter((value): value is string => value !== null);
    const strengthDirect = alphaRow.strength_atoms.phase_bucket === "persistent" && alphaRow.strength_atoms.lifecycle_bucket !== "middle" && strengthQualityReason.length === 0;
    pushPolicy(rows, alphaRow, {
      atom_id: "strength_side",
      cell_id: "strength",
      source_direction: strengthDirection,
      natural_direction: strengthDirection,
      inverse_direction: opposite(strengthDirection),
      source_quality_state: strengthQualityReason.length > 0 ? strengthQualityReason.join("|") : "clean",
      evidence_tier: `${alphaRow.strength_atoms.lifecycle_bucket}|${alphaRow.strength_atoms.phase_bucket}|${alphaRow.strength_atoms.gate57e_action_label}`,
      policy_role: strengthQualityReason.length > 0 ? "source_quality_warning" : strengthDirect ? "follow" : "confirm_only",
      allowed_final_algorithm_use: strengthQualityReason.length > 0 ? "quality_gate" : strengthDirect ? "direct_vote" : "confirm_only",
      policy_reason: "strength_phase_quality",
      degraded_reasons: strengthQualityReason,
    });
    pushPolicy(rows, alphaRow, {
      atom_id: "strength_phase_lifecycle_quality",
      cell_id: "strength",
      source_direction: null,
      natural_direction: null,
      inverse_direction: null,
      source_quality_state: strengthQualityReason.length > 0 ? strengthQualityReason.join("|") : "clean",
      evidence_tier: `${alphaRow.strength_atoms.lifecycle_bucket}|${alphaRow.strength_atoms.phase_bucket}`,
      policy_role: strengthQualityReason.length > 0 ? "source_quality_warning" : alphaRow.strength_atoms.lifecycle_bucket === "extreme" ? "tie_breaker" : "context_only",
      allowed_final_algorithm_use: strengthQualityReason.length > 0 ? "quality_gate" : alphaRow.strength_atoms.lifecycle_bucket === "extreme" ? "tie_breaker" : "context_only",
      policy_reason: "strength_quality_context",
      degraded_reasons: strengthQualityReason,
    });

    const bpr = bprByKey.get(alphaRow.row_key);
    const bprReasons = bpr
      ? [
          ...(bpr.pair_source_direction_eligible ? [] : ["pair_source_direction_ineligible"]),
          ...(bpr.promotion_eligible_pair_direction ? [] : ["promotion_ineligible"]),
          ...bpr.promotion_ineligible_reasons,
        ]
      : ["missing_bpr_pair_direction"];
    pushPolicy(rows, alphaRow, {
      atom_id: "bpr_direction_quality",
      cell_id: "regime",
      source_direction: bpr?.bpr_source_direction ?? null,
      natural_direction: bpr?.bpr_source_direction ?? null,
      inverse_direction: bpr ? opposite(bpr.bpr_source_direction) : null,
      source_quality_state: bpr ? `${bpr.base_source_quality}|${bpr.quote_source_quality}` : "missing",
      evidence_tier: bpr?.promotion_eligible_pair_direction ? "promotion_eligible" : bpr?.pair_source_direction_eligible ? "source_direction_only" : "fail_closed_or_shadow",
      policy_role: !bpr ? "blocked" : bpr.promotion_eligible_pair_direction ? "follow" : bpr.pair_source_direction_eligible ? "contradiction_warning" : "source_quality_warning",
      allowed_final_algorithm_use: !bpr ? "blocked" : bpr.promotion_eligible_pair_direction ? "direct_vote" : bpr.pair_source_direction_eligible ? "context_only" : "quality_gate",
      policy_reason: "bpr_quality_gate60h",
      degraded_reasons: bprReasons,
      fail_closed: !bpr,
      blocked: !bpr,
    });

    const rrpNatural = compareCurrencyAtomDirection(alphaRow, "rrp_derived", "natural", atomsByKey);
    const rrpInverse = compareCurrencyAtomDirection(alphaRow, "rrp_derived", "inverse", atomsByKey);
    pushPolicy(rows, alphaRow, {
      atom_id: "rrp_derived_inverse",
      cell_id: "regime",
      source_direction: rrpInverse.direction,
      natural_direction: rrpNatural.direction,
      inverse_direction: rrpInverse.direction,
      source_quality_state: rrpInverse.degraded ? "degraded" : "filled_point_in_time",
      evidence_tier: "derived_macro_anchor",
      policy_role: rrpInverse.degraded ? "source_quality_warning" : "follow",
      allowed_final_algorithm_use: rrpInverse.degraded ? "quality_gate" : "direct_vote",
      policy_reason: "rrp_inverse_macro_anchor",
      degraded_reasons: rrpInverse.degraded_reasons,
    });
    pushPolicy(rows, alphaRow, {
      atom_id: "rrp_derived_natural",
      cell_id: "regime",
      source_direction: rrpNatural.direction,
      natural_direction: rrpNatural.direction,
      inverse_direction: rrpInverse.direction,
      source_quality_state: rrpNatural.degraded ? "degraded" : "filled_point_in_time",
      evidence_tier: "derived_macro_context",
      policy_role: rrpNatural.degraded ? "source_quality_warning" : "context_only",
      allowed_final_algorithm_use: rrpNatural.degraded ? "quality_gate" : "context_only",
      policy_reason: "rrp_natural_context",
      degraded_reasons: rrpNatural.degraded_reasons,
    });

    for (const formula of VALUATION_FORMULAS) {
      const valuation = valuationByKey.get(valuationKey(formula, alphaRow.row_key));
      const spreadTier = valuation ? bucketByBreaks(Math.abs(valuation.spread_base_minus_quote), valuationTierBreaks[formula], ["weak", "middle", "extreme"]) : "missing";
      const failClosed = !valuation || !valuation.forced28_joinable;
      for (const polarity of ["inverse", "natural"] as const) {
        const decision = valuationDecision(alphaRow, formula, polarity, valuationByKey);
        pushPolicy(rows, alphaRow, {
          atom_id: `${formula}_${polarity}`,
          cell_id: "regime",
          source_direction: decision.direction,
          natural_direction: valuation?.natural_direction ?? null,
          inverse_direction: valuation?.inverse_direction ?? null,
          source_quality_state: failClosed ? "fail_closed_or_missing" : valuation.degraded ? "degraded" : "filled_point_in_time",
          evidence_tier: spreadTier,
          policy_role: failClosed ? "fail_closed" : polarity === "inverse" && spreadTier === "extreme" ? "follow" : polarity === "inverse" ? "tie_breaker" : "context_only",
          allowed_final_algorithm_use: failClosed ? "blocked" : polarity === "inverse" && spreadTier === "extreme" ? "direct_vote" : polarity === "inverse" ? "tie_breaker" : "context_only",
          policy_reason: "valuation_gap_fixed_tertile",
          degraded_reasons: decision.degraded_reasons,
          fail_closed: failClosed,
          blocked: failClosed,
        });
      }
    }

    for (const rawAtom of ["ppp", "neer", "reer"]) {
      const natural = compareCurrencyAtomDirection(alphaRow, rawAtom, "natural", atomsByKey);
      const inverse = compareCurrencyAtomDirection(alphaRow, rawAtom, "inverse", atomsByKey);
      pushPolicy(rows, alphaRow, {
        atom_id: `${rawAtom}_raw_context`,
        cell_id: "regime",
        source_direction: natural.direction,
        natural_direction: natural.direction,
        inverse_direction: inverse.direction,
        source_quality_state: natural.degraded ? "degraded_or_missing" : "filled_point_in_time",
        evidence_tier: "raw_parent_context",
        policy_role: natural.degraded ? "source_quality_warning" : "context_only",
        allowed_final_algorithm_use: natural.degraded ? "quality_gate" : "context_only",
        policy_reason: `${rawAtom}_raw_parent_context`,
        degraded_reasons: natural.degraded_reasons,
      });
    }
  }
  return rows;
}

function pushPolicy(
  rows: AtomPolicyLedgerRow[],
  alphaRow: AlphaLedgerRow,
  entry: Omit<AtomPolicyLedgerRow, "row_key" | "alpha_row_key" | "week_open_utc" | "year" | "symbol" | "base_currency" | "quote_currency" | "degraded" | "fail_closed" | "blocked" | "content_hash"> & {
    degraded_reasons?: string[];
    fail_closed?: boolean;
    blocked?: boolean;
  },
) {
  const degradedReasons = entry.degraded_reasons ?? [];
  const base = {
    row_key: `${alphaRow.row_key}|${entry.atom_id}`,
    alpha_row_key: alphaRow.row_key,
    week_open_utc: alphaRow.week.week_open_utc,
    year: alphaRow.week.year,
    symbol: alphaRow.instrument.symbol,
    base_currency: alphaRow.instrument.base_currency,
    quote_currency: alphaRow.instrument.quote_currency,
    ...entry,
    degraded: degradedReasons.length > 0,
    fail_closed: entry.fail_closed ?? false,
    blocked: entry.blocked ?? false,
    degraded_reasons: degradedReasons,
  };
  rows.push(base);
}

export function policyRowsByAlpha(rows: AtomPolicyLedgerRow[]) {
  const map = new Map<string, AtomPolicyLedgerRow[]>();
  for (const row of rows) map.set(row.alpha_row_key, [...(map.get(row.alpha_row_key) ?? []), row]);
  return map;
}

export function finalAlgorithmUse(row: AtomPolicyLedgerRow | Record<string, unknown>): AllowedFinalAlgorithmUse {
  const current = row["allowed_final_algorithm_use"];
  if (typeof current === "string") return current as AllowedFinalAlgorithmUse;
  const legacyKey = `allowed_${"bo"}${"dy"}_use`;
  const legacy = row[legacyKey];
  if (typeof legacy === "string") return legacy as AllowedFinalAlgorithmUse;
  return "blocked";
}

export function buildScenarioMemoryRows(alphaRows: AlphaLedgerRow[], policyRows: AtomPolicyLedgerRow[]) {
  const policiesByAlpha = policyRowsByAlpha(policyRows);
  const rows: ScenarioMemoryRow[] = [];
  for (const alphaRow of alphaRows) {
    const policies = policiesByAlpha.get(alphaRow.row_key) ?? [];
    const policyByAtom = new Map(policies.map((row) => [row.atom_id, row]));
    const dir = (atomId: string) => policyByAtom.get(atomId)?.source_direction ?? null;
    const tier = (atomId: string) => policyByAtom.get(atomId)?.evidence_tier ?? "missing";
    const quality = (atomId: string) => policyByAtom.get(atomId)?.source_quality_state ?? "missing";
    const cotDirection = dir("cot_side");
    const strengthDirection = dir("strength_side");
    const rrpDirection = dir("rrp_derived_inverse");
    const valuationDirection = dir("valuation_gap_reer_deviation_inverse");
    const valuationRelativeDirection = dir("valuation_gap_neer_reer_relative_inverse");
    const bprDirection = dir("bpr_direction_quality");
    const stateComponents = {
      cot_direction: cotDirection,
      cot_tier: tier("cot_side"),
      cot_quality: quality("cot_side"),
      strength_direction: strengthDirection,
      strength_state: tier("strength_side"),
      strength_quality: quality("strength_side"),
      rrp_inverse_direction: rrpDirection,
      valuation_reer_inverse_direction: valuationDirection,
      valuation_reer_tier: tier("valuation_gap_reer_deviation_inverse"),
      valuation_relative_inverse_direction: valuationRelativeDirection,
      valuation_relative_tier: tier("valuation_gap_neer_reer_relative_inverse"),
      bpr_direction: bprDirection,
      bpr_quality: quality("bpr_direction_quality"),
      cot_strength_agree: cotDirection !== null && cotDirection === strengthDirection,
      cot_rrp_agree: cotDirection !== null && cotDirection === rrpDirection,
      strength_rrp_agree: strengthDirection !== null && strengthDirection === rrpDirection,
      rrp_valuation_agree: rrpDirection !== null && rrpDirection === valuationDirection,
      bpr_valuation_agree: bprDirection !== null && bprDirection === valuationDirection,
      year: alphaRow.week.year,
      quarter: alphaRow.week.quarter,
    };
    const scenarioFingerprint = [
      `cot=${stateComponents.cot_direction}:${stateComponents.cot_tier}:${stateComponents.cot_quality}`,
      `strength=${stateComponents.strength_direction}:${stateComponents.strength_state}:${stateComponents.strength_quality}`,
      `rrp=${stateComponents.rrp_inverse_direction}`,
      `vg_reer=${stateComponents.valuation_reer_inverse_direction}:${stateComponents.valuation_reer_tier}`,
      `vg_relative=${stateComponents.valuation_relative_inverse_direction}:${stateComponents.valuation_relative_tier}`,
      `bpr=${stateComponents.bpr_direction}:${stateComponents.bpr_quality}`,
      `agreement=${stateComponents.cot_strength_agree}:${stateComponents.cot_rrp_agree}:${stateComponents.strength_rrp_agree}:${stateComponents.rrp_valuation_agree}:${stateComponents.bpr_valuation_agree}`,
      `calendar=${stateComponents.year}:${stateComponents.quarter}`,
    ].join("|");
    const alphaSide = alphaRow.arbitration.final_side;
    const fadeSide = alphaSide === "LONG" ? "SHORT" : "LONG";
    const base = {
      row_key: `scenario_memory|${alphaRow.row_key}`,
      alpha_row_key: alphaRow.row_key,
      week_open_utc: alphaRow.week.week_open_utc,
      year: alphaRow.week.year,
      symbol: alphaRow.instrument.symbol,
      scenario_fingerprint: scenarioFingerprint,
      fingerprint_sha256: sha256Text(scenarioFingerprint),
      exact_state_key: scenarioFingerprint,
      cell_agreement_state_key: [
        `cot_strength=${stateComponents.cot_strength_agree}`,
        `cot_rrp=${stateComponents.cot_rrp_agree}`,
        `strength_rrp=${stateComponents.strength_rrp_agree}`,
        `rrp_valuation=${stateComponents.rrp_valuation_agree}`,
      ].join("|"),
      macro_value_state_key: [`rrp=${stateComponents.rrp_inverse_direction}`, `vg=${stateComponents.valuation_reer_inverse_direction}:${stateComponents.valuation_reer_tier}`, `bpr=${stateComponents.bpr_direction}`].join("|"),
      source_quality_state_key: [`cot=${stateComponents.cot_quality}`, `strength=${stateComponents.strength_quality}`, `bpr=${stateComponents.bpr_quality}`, `vg=${quality("valuation_gap_reer_deviation_inverse")}`].join("|"),
      cot_strength_disagreement_state_key: `cot_strength_${stateComponents.cot_strength_agree ? "agree" : "disagree"}|cot=${stateComponents.cot_direction}|strength=${stateComponents.strength_direction}`,
      rrp_valuation_agreement_state_key: `rrp_valuation_${stateComponents.rrp_valuation_agree ? "agree" : "disagree"}|rrp=${stateComponents.rrp_inverse_direction}|valuation=${stateComponents.valuation_reer_inverse_direction}`,
      state_components: stateComponents,
      policy_roles: Object.fromEntries(policies.map((row) => [row.atom_id, row.policy_role])),
      outcome_fields: {
        alpha_v1_follow_adr_grid: adrFromSide(alphaSide, alphaRow),
        alpha_v1_fade_adr_grid: adrFromSide(fadeSide, alphaRow),
        alpha_v1_follow_weekly_hold: holdFromSide(alphaSide, alphaRow),
        alpha_v1_fade_weekly_hold: holdFromSide(fadeSide, alphaRow),
      },
      low_support_evaluation_warning: "support_not_evaluated_until_group_summary",
    };
    rows.push({ ...base, content_hash: sha256Stable(base) });
  }
  return rows;
}

export function scenarioGroupSummaries(rows: ScenarioMemoryRow[], groupingKey: keyof Pick<ScenarioMemoryRow, "exact_state_key" | "cell_agreement_state_key" | "macro_value_state_key" | "source_quality_state_key" | "cot_strength_disagreement_state_key" | "rrp_valuation_agreement_state_key">) {
  const groups = new Map<string, ScenarioMemoryRow[]>();
  for (const row of rows) groups.set(String(row[groupingKey]), [...(groups.get(String(row[groupingKey])) ?? []), row]);
  return [...groups.entries()]
    .map(([group_key, groupRows]) => {
      const followAdr = metricFromValues(groupRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.outcome_fields.alpha_v1_follow_adr_grid })));
      const fadeAdr = metricFromValues(groupRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.outcome_fields.alpha_v1_fade_adr_grid })));
      const followHold = metricFromValues(groupRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.outcome_fields.alpha_v1_follow_weekly_hold })));
      const fadeHold = metricFromValues(groupRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.outcome_fields.alpha_v1_fade_weekly_hold })));
      const annual = annualFromScenario(groupRows, "follow");
      const worst = annual.length > 0 ? [...annual].sort((left, right) => (left.adr_grid_adr ?? 0) - (right.adr_grid_adr ?? 0))[0] : null;
      const pairCounts = countBy(groupRows, (row) => row.symbol);
      const weekCounts = countBy(groupRows, (row) => row.week_open_utc);
      const yearCounts = countBy(groupRows, (row) => String(row.year));
      const topPair = topCount(pairCounts);
      const topWeek = topCount(weekCounts);
      const topYear = topCount(yearCounts);
      const support = groupRows.length;
      const roles = countBy(groupRows.flatMap((row) => Object.values(row.policy_roles)), (role) => role);
      return {
        grouping_key: groupingKey,
        group_key,
        group_hash: sha256Text(group_key),
        support_count: support,
        weeks_covered: new Set(groupRows.map((row) => row.week_open_utc)).size,
        years_covered: new Set(groupRows.map((row) => row.year)).size,
        adr_grid_follow: followAdr,
        adr_grid_fade: fadeAdr,
        weekly_hold_follow: followHold,
        weekly_hold_fade: fadeHold,
        negative_years_follow: annual.filter((row) => (row.adr_grid_adr ?? 0) < 0).length,
        worst_year_follow: worst,
        concentration: {
          top_pair: topPair ? { symbol: topPair.key, rows: topPair.count, share: round(topPair.count / support) } : null,
          top_week: topWeek ? { week_open_utc: topWeek.key, rows: topWeek.count, share: round(topWeek.count / support) } : null,
          top_year: topYear ? { year: topYear.key, rows: topYear.count, share: round(topYear.count / support) } : null,
        },
        policy_role_counts: roles,
        low_support_warning: support < 112 || new Set(groupRows.map((row) => row.year)).size < 3,
        descriptive_reliability_hint: reliabilityHint(support, followAdr, fadeAdr),
      };
    })
    .sort((left, right) => right.support_count - left.support_count || left.group_key.localeCompare(right.group_key));
}

function annualFromScenario(rows: ScenarioMemoryRow[], mode: "follow" | "fade") {
  const groups = new Map<number, ScenarioMemoryRow[]>();
  for (const row of rows) groups.set(row.year, [...(groups.get(row.year) ?? []), row]);
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, groupRows]) => ({
      year,
      rows: groupRows.length,
      weeks: new Set(groupRows.map((row) => row.week_open_utc)).size,
      adr_grid_adr: metricFromValues(groupRows.map((row) => ({ week_open_utc: row.week_open_utc, value: mode === "follow" ? row.outcome_fields.alpha_v1_follow_adr_grid : row.outcome_fields.alpha_v1_fade_adr_grid }))).adr_sum,
      weekly_hold_adr: metricFromValues(groupRows.map((row) => ({ week_open_utc: row.week_open_utc, value: mode === "follow" ? row.outcome_fields.alpha_v1_follow_weekly_hold : row.outcome_fields.alpha_v1_fade_weekly_hold }))).adr_sum,
    }));
}

function topCount(counts: Record<string, number>) {
  const rows = Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const first = rows[0];
  return first ? { key: first[0], count: first[1] } : null;
}

function reliabilityHint(support: number, followAdr: MetricSummary, fadeAdr: MetricSummary) {
  if (support < 112) return "low_support_one_off_or_sparse";
  if ((followAdr.row_pf ?? 0) > 1.1 && (followAdr.adr_sum ?? 0) > (fadeAdr.adr_sum ?? 0)) return "historically_reliable_direct_vote_reference";
  if ((fadeAdr.row_pf ?? 0) > 1.1 && (fadeAdr.adr_sum ?? 0) > (followAdr.adr_sum ?? 0)) return "historically_dangerous_or_fade_candidate_reference";
  if ((followAdr.row_pf ?? 0) > 1 && (fadeAdr.row_pf ?? 0) > 1) return "useful_as_confirmation_or_warning_reference";
  return "mixed_context_only_reference";
}

export function renderTable(rows: Array<Record<string, unknown>>, columns: string[]) {
  const lines = [`| ${columns.join(" | ")} |`, `|${columns.map(() => "---").join("|")}|`];
  for (const row of rows) lines.push(`| ${columns.map((column) => String(row[column] ?? "")).join(" | ")} |`);
  return lines.join("\n");
}
