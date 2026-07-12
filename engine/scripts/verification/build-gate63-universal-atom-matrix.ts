import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BRAIN_ARCHITECTURE, flattenBrainAtomInventory } from "@engine/brain/architecture";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 63: universal-atom-matrix";
const COMMAND = "npm run engine:gate63:universal-atom-matrix";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_GATE60C_DIR = "docs/research/gates/gate60c/artifacts/gate60c-regime-source-atom-fill";
const DEFAULT_GATE60G_DIR = "docs/research/gates/gate60g/artifacts/gate60g-bpr-forced28-source-direction-ledger";
const DEFAULT_GATE60H_DIR = "docs/research/gates/gate60h/artifacts/gate60h-bpr-source-direction-eligibility-classes";
const DEFAULT_GATE61B_DIR = "docs/research/gates/gate61b/artifacts/gate61b-universal-cell-atom-readiness";
const DEFAULT_GATE62_DIR = "docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate63/GATE63_UNIVERSAL_ATOM_MATRIX_2026-06-27.md";

const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const CURRENCY_TIE_RANK = new Map(["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"].map((currency, index) => [currency, index]));

type Direction = "BASE_CURRENCY" | "QUOTE_CURRENCY";
type Side = "LONG" | "SHORT";
type Polarity = "natural" | "inverse";
type AtomKey = "nominal_rate_3m" | "cpi_inflation_yoy" | "rrp_derived" | "ppp" | "neer" | "reer";
type CandidateDirectionKind = "candidate_atom_direction" | "candidate_cell_direction" | "candidate_composite_direction";

type CliOptions = {
  alphaLedgerPath: string;
  gate60cDir: string;
  gate60gDir: string;
  gate60hDir: string;
  gate61bDir: string;
  gate62Dir: string;
  artifactDir: string;
  reportPath: string;
};

type AlphaLedgerRow = {
  row_key: string;
  week: { week_open_utc: string; year: number; quarter: string };
  instrument: { symbol: string; base_currency: string | null; quote_currency: string | null };
  cot_atoms: {
    side: Side;
    base_tei: number | null;
    quote_tei: number | null;
    tei_spread: number | null;
    abs_tei_spread: number | null;
    tei_spread_bucket: string;
    tie_flag: boolean;
    carry_forward_flag: boolean;
    carry_previous_flag: boolean;
    lifecycle_state: string;
  };
  strength_atoms: {
    parent_side: Side;
    gate57e_side: Side;
    base_score: number | null;
    quote_score: number | null;
    score_spread: number | null;
    abs_score_spread: number | null;
    score_spread_bucket: string;
    lifecycle_bucket: string;
    phase_bucket: string;
    lifecycle_phase_key: string;
    gate57e_action_label: string;
  };
  arbitration: {
    final_side: Side;
    final_side_source: string;
    healthy_strength_state: boolean;
    cot_vs_strength_parent: string;
    cot_vs_gate57e: string;
    final_side_equals_cot: boolean;
    final_side_equals_gate57e_strength: boolean;
  };
  outcomes: {
    adr_grid: { long: number; short: number; chosen?: number };
    weekly_hold: { long: number; short: number; chosen?: number };
  };
  diagnostics: {
    missing_cot_state: boolean;
    missing_strength_state: boolean;
    missing_long_outcome: boolean;
    missing_short_outcome: boolean;
  };
};

type CurrencyWeekAtomRow = {
  row_key: string;
  alpha_week_open_utc: string;
  currency: string;
  atom_key: string;
  source_family: string;
  source_state: string;
  atom_role: string;
  status: string;
  promotion_eligible: boolean;
  value_available: boolean;
  value: number | null;
  missing: boolean;
  stale: boolean;
  quarantined: boolean;
  source_ambiguous: boolean;
  fail_closed_reasons: string[];
  content_hash: string;
};

type BprPairDirectionRow = {
  row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  bpr_source_direction: Direction;
  bpr_source_direction_rule: string;
  base_source_quality: string;
  quote_source_quality: string;
  base_promotion_eligible_currency_state: boolean;
  quote_promotion_eligible_currency_state: boolean;
  pair_source_direction_eligible: boolean;
  promotion_eligible_pair_direction: boolean;
  promotion_ineligible_reasons: string[];
  no_regime_side: boolean;
  no_long_short_side: boolean;
  source_rows_mutated: boolean;
};

type DirectionDecision = {
  direction: Direction;
  direction_source: string;
  degraded: boolean;
  degraded_reasons: string[];
  atom_votes: Record<string, Direction>;
};

type Candidate = {
  candidate_id: string;
  family: string;
  label: string;
  candidate_direction_kind: CandidateDirectionKind;
  transform_version: string;
  atom_keys: string[];
  source_cells: Array<"cot" | "strength" | "regime" | "alpha_v1">;
  polarity: Polarity | "bpr_source" | "mixed" | "alpha_v1" | "locked";
  tie_rule: string;
  complexity: number;
  directionFor: (row: AlphaLedgerRow) => DirectionDecision;
};

type ScoredRow = {
  row: AlphaLedgerRow;
  direction: Direction;
  side: Side;
  adr_grid_adr: number;
  weekly_hold_adr: number;
  degraded: boolean;
  degraded_reasons: string[];
  atom_votes: Record<string, Direction>;
};

type MetricSummary = {
  adr_sum: number | null;
  adr_mean: number | null;
  max_drawdown: number;
  r_over_drawdown: number | null;
  row_pf: number | null;
};

type CandidateSummary = {
  candidate_id: string;
  family: string;
  label: string;
  candidate_direction_kind: CandidateDirectionKind;
  transform_version: string;
  atom_keys: string[];
  source_cells: string[];
  polarity: string;
  tie_rule: string;
  complexity: number;
  source_count: number;
  forced28_row_count: number;
  duplicate_row_count: number;
  weeks: number;
  full_weeks: number;
  symbols_per_week_histogram: Record<string, number>;
  selected_direction_counts: Record<string, number>;
  missing_degraded_row_count: number;
  missing_degraded_reason_counts: Record<string, number>;
  missing_outcome_rows: number;
  quality_flag_counts: Record<string, number>;
  adr_grid: MetricSummary;
  weekly_hold: MetricSummary;
  top_week_share: {
    top5_abs_week_share: number | null;
    top_abs_weeks: Array<{ week_open_utc: string; adr_grid_sum: number }>;
  };
  top_pair_share: {
    top_abs_pair: { symbol: string; adr_grid_sum: number } | null;
    top_abs_pair_share: number | null;
  };
  annual_summary: Array<{ year: number; rows: number; weeks: number; adr_grid_adr: number | null; weekly_hold_adr: number | null }>;
  negative_adr_grid_years: number;
  worst_adr_grid_year: { year: number; adr_grid_adr: number | null; weekly_hold_adr: number | null } | null;
  interpretation_bucket: string;
  decision_signature_sha256: string;
  content_hash: string;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    alphaLedgerPath: DEFAULT_ALPHA_LEDGER_PATH,
    gate60cDir: DEFAULT_GATE60C_DIR,
    gate60gDir: DEFAULT_GATE60G_DIR,
    gate60hDir: DEFAULT_GATE60H_DIR,
    gate61bDir: DEFAULT_GATE61B_DIR,
    gate62Dir: DEFAULT_GATE62_DIR,
    artifactDir: DEFAULT_ARTIFACT_DIR,
    reportPath: DEFAULT_REPORT_PATH,
  };
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=", 2);
    if (!value) continue;
    if (key === "--alpha-ledger-path") options.alphaLedgerPath = value;
    if (key === "--gate60c-dir") options.gate60cDir = value;
    if (key === "--gate60g-dir") options.gate60gDir = value;
    if (key === "--gate60h-dir") options.gate60hDir = value;
    if (key === "--gate61b-dir") options.gate61bDir = value;
    if (key === "--gate62-dir") options.gate62Dir = value;
    if (key === "--artifact-dir") options.artifactDir = value;
    if (key === "--report-path") options.reportPath = value;
  }
  return options;
}

function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join("/");
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

async function readJsonl<T>(filePath: string) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function fileHash(filePath: string) {
  return sha256Text(await readFile(filePath));
}

function round(value: number | null | undefined, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function duplicateCount(values: string[]) {
  return Object.values(countBy(values, (value) => value)).filter((count) => count > 1).length;
}

function rowsPerWeek(rows: AlphaLedgerRow[]) {
  const counts = countBy(rows, (row) => row.week.week_open_utc);
  return {
    weeks: Object.keys(counts).length,
    full_weeks: Object.values(counts).filter((count) => count === EXPECTED_SYMBOLS_PER_WEEK).length,
    histogram: countBy(Object.values(counts), (count) => String(count)),
  };
}

function maxDrawdown(valuesByWeek: Map<string, number>) {
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

function profitFactor(values: number[]) {
  const positive = values.filter((value) => value > 0).reduce((total, value) => total + value, 0);
  const negative = values.filter((value) => value < 0).reduce((total, value) => total + value, 0);
  if (negative === 0) return positive > 0 ? null : 0;
  return round(positive / Math.abs(negative), 6);
}

function rOverDrawdown(total: number | null, drawdown: number | null) {
  if (total === null || drawdown === null || drawdown === 0) return null;
  return round(total / Math.abs(drawdown), 6);
}

function sideFromDirection(direction: Direction): Side {
  return direction === "BASE_CURRENCY" ? "LONG" : "SHORT";
}

function directionFromSideLabel(side: Side): Direction {
  return side === "LONG" ? "BASE_CURRENCY" : "QUOTE_CURRENCY";
}

function adrFromSide(side: Side, row: AlphaLedgerRow) {
  return side === "LONG" ? row.outcomes.adr_grid.long : row.outcomes.adr_grid.short;
}

function holdFromSide(side: Side, row: AlphaLedgerRow) {
  return side === "LONG" ? row.outcomes.weekly_hold.long : row.outcomes.weekly_hold.short;
}

function opposite(direction: Direction): Direction {
  return direction === "BASE_CURRENCY" ? "QUOTE_CURRENCY" : "BASE_CURRENCY";
}

function currencyRankDirection(base: string, quote: string) {
  const baseRank = CURRENCY_TIE_RANK.get(base) ?? Number.MAX_SAFE_INTEGER;
  const quoteRank = CURRENCY_TIE_RANK.get(quote) ?? Number.MAX_SAFE_INTEGER;
  return baseRank <= quoteRank ? "BASE_CURRENCY" : "QUOTE_CURRENCY";
}

function atomMapKey(atomKey: string, weekOpenUtc: string, currency: string) {
  return `${atomKey}|${weekOpenUtc}|${currency}`;
}

function metric(scored: ScoredRow[], getValue: (row: ScoredRow) => number): MetricSummary {
  const values = scored.map(getValue);
  const byWeek = new Map<string, number>();
  for (const row of scored) {
    byWeek.set(row.row.week.week_open_utc, (byWeek.get(row.row.week.week_open_utc) ?? 0) + getValue(row));
  }
  const total = round(sum(values), 6);
  const drawdown = maxDrawdown(byWeek);
  return {
    adr_sum: total,
    adr_mean: round(values.length > 0 ? sum(values) / values.length : 0, 6),
    max_drawdown: drawdown,
    r_over_drawdown: rOverDrawdown(total, drawdown),
    row_pf: profitFactor(values),
  };
}

function metricForDirection(rows: AlphaLedgerRow[], directionFor: (row: AlphaLedgerRow) => Direction) {
  const scored = rows.map((row) => {
    const direction = directionFor(row);
    const side = sideFromDirection(direction);
    return {
      row,
      direction,
      side,
      adr_grid_adr: adrFromSide(side, row),
      weekly_hold_adr: holdFromSide(side, row),
      degraded: false,
      degraded_reasons: [],
      atom_votes: {},
    };
  });
  return {
    rows: scored.length,
    adr_grid: metric(scored, (row) => row.adr_grid_adr),
    weekly_hold: metric(scored, (row) => row.weekly_hold_adr),
  };
}

function topWeekShare(scored: ScoredRow[]) {
  const byWeek = new Map<string, number>();
  for (const row of scored) {
    byWeek.set(row.row.week.week_open_utc, (byWeek.get(row.row.week.week_open_utc) ?? 0) + row.adr_grid_adr);
  }
  const rows = [...byWeek.entries()]
    .map(([week_open_utc, adr_grid_sum]) => ({ week_open_utc, adr_grid_sum: round(adr_grid_sum, 6) ?? 0 }))
    .sort((left, right) => Math.abs(right.adr_grid_sum) - Math.abs(left.adr_grid_sum));
  const totalAbs = rows.reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  const top5Abs = rows.slice(0, 5).reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  return {
    top5_abs_week_share: totalAbs > 0 ? round(top5Abs / totalAbs, 6) : null,
    top_abs_weeks: rows.slice(0, 10),
  };
}

function topPairShare(scored: ScoredRow[]) {
  const byPair = new Map<string, number>();
  for (const row of scored) {
    byPair.set(row.row.instrument.symbol, (byPair.get(row.row.instrument.symbol) ?? 0) + row.adr_grid_adr);
  }
  const rows = [...byPair.entries()]
    .map(([symbol, adr_grid_sum]) => ({ symbol, adr_grid_sum: round(adr_grid_sum, 6) ?? 0 }))
    .sort((left, right) => Math.abs(right.adr_grid_sum) - Math.abs(left.adr_grid_sum));
  const totalAbs = rows.reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  return {
    top_abs_pair: rows[0] ?? null,
    top_abs_pair_share: rows[0] && totalAbs > 0 ? round(Math.abs(rows[0].adr_grid_sum) / totalAbs, 6) : null,
  };
}

function annualSummary(scored: ScoredRow[]) {
  const groups = new Map<number, ScoredRow[]>();
  for (const row of scored) {
    groups.set(row.row.week.year, [...(groups.get(row.row.week.year) ?? []), row]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, rows]) => ({
      year,
      rows: rows.length,
      weeks: new Set(rows.map((row) => row.row.week.week_open_utc)).size,
      adr_grid_adr: metric(rows, (row) => row.adr_grid_adr).adr_sum,
      weekly_hold_adr: metric(rows, (row) => row.weekly_hold_adr).adr_sum,
    }));
}

function classifyCandidate(summary: Omit<CandidateSummary, "interpretation_bucket" | "content_hash">) {
  if (summary.forced28_row_count !== EXPECTED_ROWS || summary.duplicate_row_count !== 0 || summary.missing_outcome_rows !== 0) {
    return "disqualified";
  }
  const topWeek = summary.top_week_share.top5_abs_week_share ?? 0;
  const topPair = summary.top_pair_share.top_abs_pair_share ?? 0;
  if (summary.missing_degraded_row_count > 0 || topWeek >= 0.35 || topPair >= 0.25 || summary.negative_adr_grid_years > 2) {
    return "fragile_or_governance_review";
  }
  if ((summary.adr_grid.adr_sum ?? 0) > 0 && (summary.adr_grid.row_pf ?? 0) > 1) {
    return "promising_discovery_only";
  }
  return "weak_or_negative";
}

function compareAtomDirection(
  row: AlphaLedgerRow,
  atomKey: AtomKey,
  polarity: Polarity,
  atomsByKey: Map<string, CurrencyWeekAtomRow>,
): DirectionDecision {
  const base = row.instrument.base_currency;
  const quote = row.instrument.quote_currency;
  const degradedReasons: string[] = [];
  if (!base || !quote) {
    return {
      direction: "BASE_CURRENCY",
      direction_source: `${atomKey}_${polarity}_missing_instrument_fallback`,
      degraded: true,
      degraded_reasons: ["missing_base_or_quote_currency"],
      atom_votes: { [atomKey]: "BASE_CURRENCY" },
    };
  }
  const baseAtom = atomsByKey.get(atomMapKey(atomKey, row.week.week_open_utc, base));
  const quoteAtom = atomsByKey.get(atomMapKey(atomKey, row.week.week_open_utc, quote));
  if (!baseAtom || !quoteAtom) degradedReasons.push(`${atomKey}:missing_currency_atom_row`);
  if (baseAtom && baseAtom.status !== "FILLED_POINT_IN_TIME") degradedReasons.push(`${atomKey}:base_status_${baseAtom.status}`);
  if (quoteAtom && quoteAtom.status !== "FILLED_POINT_IN_TIME") degradedReasons.push(`${atomKey}:quote_status_${quoteAtom.status}`);
  const baseValue = baseAtom?.value;
  const quoteValue = quoteAtom?.value;
  let naturalDirection: Direction;
  if (typeof baseValue === "number" && Number.isFinite(baseValue) && typeof quoteValue === "number" && Number.isFinite(quoteValue)) {
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

function bprDirection(row: AlphaLedgerRow, bprByKey: Map<string, BprPairDirectionRow>): DirectionDecision {
  const bpr = bprByKey.get(row.row_key);
  if (!bpr) {
    return {
      direction: "BASE_CURRENCY",
      direction_source: "bpr_missing_rank_fallback",
      degraded: true,
      degraded_reasons: ["missing_bpr_pair_direction_row"],
      atom_votes: { bpr: "BASE_CURRENCY" },
    };
  }
  const degradedReasons = [
    ...(bpr.pair_source_direction_eligible ? [] : ["bpr_pair_source_direction_ineligible"]),
    ...(bpr.promotion_eligible_pair_direction ? [] : ["bpr_pair_direction_promotion_ineligible"]),
    ...bpr.promotion_ineligible_reasons.map((reason) => `bpr:${reason}`),
  ];
  return {
    direction: bpr.bpr_source_direction,
    direction_source: `bpr_${bpr.bpr_source_direction_rule}`,
    degraded: degradedReasons.length > 0,
    degraded_reasons: degradedReasons,
    atom_votes: { bpr: bpr.bpr_source_direction },
  };
}

function sideDecision(row: AlphaLedgerRow, side: Side, source: string, voteKey: string): DirectionDecision {
  const direction = directionFromSideLabel(side);
  return {
    direction,
    direction_source: source,
    degraded: false,
    degraded_reasons: [],
    atom_votes: { [voteKey]: direction },
  };
}

function majorityVote(votes: DirectionDecision[], tieDirection: Direction, directionSource: string): DirectionDecision {
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

function buildCandidates(atomsByKey: Map<string, CurrencyWeekAtomRow>, bprByKey: Map<string, BprPairDirectionRow>): Candidate[] {
  const cot = (): Candidate => ({
    candidate_id: "cot_cell_locked_cot_side",
    family: "single_cell_baseline",
    label: "COT-only locked side baseline",
    candidate_direction_kind: "candidate_cell_direction",
    transform_version: "gate59_cot_side_locked_v1",
    atom_keys: ["cot_side"],
    source_cells: ["cot"],
    polarity: "locked",
    tie_rule: "uses locked Gate 59 COT side",
    complexity: 1,
    directionFor: (row) => sideDecision(row, row.cot_atoms.side, "cot_side", "cot_side"),
  });
  const strength = (): Candidate => ({
    candidate_id: "strength_cell_gate57e_side",
    family: "single_cell_baseline",
    label: "Strength-only Gate 57E side baseline",
    candidate_direction_kind: "candidate_cell_direction",
    transform_version: "gate59_strength_gate57e_side_locked_v1",
    atom_keys: ["strength_gate57e_side"],
    source_cells: ["strength"],
    polarity: "locked",
    tie_rule: "uses locked Gate 57E Strength side",
    complexity: 1,
    directionFor: (row) => sideDecision(row, row.strength_atoms.gate57e_side, "strength_gate57e_side", "strength_gate57e_side"),
  });
  const alpha = (): Candidate => ({
    candidate_id: "alpha_v1_frozen_final_side",
    family: "single_cell_baseline",
    label: "Alpha v1 frozen final side baseline",
    candidate_direction_kind: "candidate_cell_direction",
    transform_version: "gate59_alpha_v1_final_side_v1",
    atom_keys: ["alpha_v1_final_side", "cot_side", "strength_gate57e_side"],
    source_cells: ["alpha_v1", "cot", "strength"],
    polarity: "alpha_v1",
    tie_rule: "uses frozen Gate 59 Alpha v1 row-level arbitration",
    complexity: 2,
    directionFor: (row) => sideDecision(row, row.arbitration.final_side, "alpha_v1_final_side", "alpha_v1_final_side"),
  });
  const atomCandidate = (candidateId: string, family: string, label: string, atomKey: AtomKey, polarity: Polarity): Candidate => ({
    candidate_id: candidateId,
    family,
    label,
    candidate_direction_kind: "candidate_atom_direction",
    transform_version: `gate63_${atomKey}_${polarity}_base_minus_quote_v1`,
    atom_keys: [atomKey],
    source_cells: ["regime"],
    polarity,
    tie_rule: "equal numeric spread uses deterministic currency rank AUD,CAD,CHF,EUR,GBP,JPY,NZD,USD",
    complexity: 1,
    directionFor: (row) => compareAtomDirection(row, atomKey, polarity, atomsByKey),
  });
  const bpr = (): Candidate => ({
    candidate_id: "bpr_only_forced28_source_direction",
    family: "single_regime_atom",
    label: "BPR-only forced-28 source direction",
    candidate_direction_kind: "candidate_atom_direction",
    transform_version: "gate60g_bpr_forced28_source_direction_policy_v1",
    atom_keys: ["bpr"],
    source_cells: ["regime"],
    polarity: "bpr_source",
    tie_rule: "Gate 60G deterministic forced-28 BPR source-direction policy",
    complexity: 1,
    directionFor: (row) => bprDirection(row, bprByKey),
  });
  const composite = (
    candidateId: string,
    family: string,
    label: string,
    atomKeys: string[],
    sourceCells: Candidate["source_cells"],
    tieRule: string,
    directionFor: (row: AlphaLedgerRow) => DirectionDecision,
  ): Candidate => ({
    candidate_id: candidateId,
    family,
    label,
    candidate_direction_kind: "candidate_composite_direction",
    transform_version: `gate63_${candidateId}_simple_majority_v1`,
    atom_keys: atomKeys,
    source_cells: sourceCells,
    polarity: "mixed",
    tie_rule: tieRule,
    complexity: atomKeys.length,
    directionFor,
  });

  const cotDecision = (row: AlphaLedgerRow) => sideDecision(row, row.cot_atoms.side, "cot_side", "cot_side");
  const strengthDecision = (row: AlphaLedgerRow) => sideDecision(row, row.strength_atoms.gate57e_side, "strength_gate57e_side", "strength_gate57e_side");
  const alphaDecision = (row: AlphaLedgerRow) => sideDecision(row, row.arbitration.final_side, "alpha_v1_final_side", "alpha_v1_final_side");
  const rrpInverse = (row: AlphaLedgerRow) => compareAtomDirection(row, "rrp_derived", "inverse", atomsByKey);
  const pppInverse = (row: AlphaLedgerRow) => compareAtomDirection(row, "ppp", "inverse", atomsByKey);
  const reerInverse = (row: AlphaLedgerRow) => compareAtomDirection(row, "reer", "inverse", atomsByKey);
  const neerInverse = (row: AlphaLedgerRow) => compareAtomDirection(row, "neer", "inverse", atomsByKey);
  const bprDecision = (row: AlphaLedgerRow) => bprDirection(row, bprByKey);
  const fullRegimeInverse = (row: AlphaLedgerRow) =>
    majorityVote(
      [
        bprDecision(row),
        compareAtomDirection(row, "nominal_rate_3m", "inverse", atomsByKey),
        compareAtomDirection(row, "cpi_inflation_yoy", "inverse", atomsByKey),
        rrpInverse(row),
        pppInverse(row),
        neerInverse(row),
        reerInverse(row),
      ],
      rrpInverse(row).direction,
      "full_regime_inverse_simple_majority_tie_rrp_inverse",
    );

  return [
    cot(),
    strength(),
    alpha(),
    {
      ...atomCandidate("regime_cell_gate62_best_rrp_derived_inverse", "single_cell_baseline", "Regime-only Gate 62 best RRP inverse baseline", "rrp_derived", "inverse"),
      candidate_direction_kind: "candidate_cell_direction",
      source_cells: ["regime"],
      complexity: 1,
    },
    bpr(),
    atomCandidate("rates_nominal_rate_3m_natural", "single_regime_atom", "Rates-only natural polarity", "nominal_rate_3m", "natural"),
    atomCandidate("rates_nominal_rate_3m_inverse", "single_regime_atom", "Rates-only inverse polarity", "nominal_rate_3m", "inverse"),
    atomCandidate("inflation_cpi_yoy_natural", "single_regime_atom", "CPI/inflation-only natural polarity", "cpi_inflation_yoy", "natural"),
    atomCandidate("inflation_cpi_yoy_inverse", "single_regime_atom", "CPI/inflation-only inverse polarity", "cpi_inflation_yoy", "inverse"),
    atomCandidate("rrp_derived_natural", "single_regime_atom", "RRP-only natural polarity", "rrp_derived", "natural"),
    atomCandidate("rrp_derived_inverse", "single_regime_atom", "RRP-only inverse polarity", "rrp_derived", "inverse"),
    atomCandidate("ppp_natural", "single_regime_atom", "PPP-only natural polarity", "ppp", "natural"),
    atomCandidate("ppp_inverse", "single_regime_atom", "PPP-only inverse polarity", "ppp", "inverse"),
    atomCandidate("neer_natural", "single_regime_atom", "NEER-only natural polarity", "neer", "natural"),
    atomCandidate("neer_inverse", "single_regime_atom", "NEER-only inverse polarity", "neer", "inverse"),
    atomCandidate("reer_natural", "single_regime_atom", "REER-only natural polarity", "reer", "natural"),
    atomCandidate("reer_inverse", "single_regime_atom", "REER-only inverse polarity", "reer", "inverse"),
    composite("cot_plus_rrp_inverse_tie_cot", "two_cell_composite", "COT + RRP inverse, tie to COT", ["cot_side", "rrp_derived"], ["cot", "regime"], "two-vote majority; ties resolve to COT", (row) =>
      majorityVote([cotDecision(row), rrpInverse(row)], cotDecision(row).direction, "cot_rrp_inverse_tie_cot"),
    ),
    composite(
      "cot_plus_rrp_inverse_tie_rrp",
      "two_cell_composite",
      "COT + RRP inverse, tie to RRP inverse",
      ["cot_side", "rrp_derived"],
      ["cot", "regime"],
      "two-vote majority; ties resolve to RRP inverse",
      (row) => majorityVote([cotDecision(row), rrpInverse(row)], rrpInverse(row).direction, "cot_rrp_inverse_tie_rrp"),
    ),
    composite(
      "strength_plus_rrp_inverse_tie_strength",
      "two_cell_composite",
      "Strength + RRP inverse, tie to Strength",
      ["strength_gate57e_side", "rrp_derived"],
      ["strength", "regime"],
      "two-vote majority; ties resolve to Strength",
      (row) => majorityVote([strengthDecision(row), rrpInverse(row)], strengthDecision(row).direction, "strength_rrp_inverse_tie_strength"),
    ),
    composite(
      "strength_plus_rrp_inverse_tie_rrp",
      "two_cell_composite",
      "Strength + RRP inverse, tie to RRP inverse",
      ["strength_gate57e_side", "rrp_derived"],
      ["strength", "regime"],
      "two-vote majority; ties resolve to RRP inverse",
      (row) => majorityVote([strengthDecision(row), rrpInverse(row)], rrpInverse(row).direction, "strength_rrp_inverse_tie_rrp"),
    ),
    composite(
      "alpha_v1_plus_rrp_inverse_tie_alpha",
      "alpha_regime_composite",
      "Alpha v1 + RRP inverse, tie to Alpha v1",
      ["alpha_v1_final_side", "rrp_derived"],
      ["alpha_v1", "regime"],
      "two-vote majority; ties resolve to Alpha v1",
      (row) => majorityVote([alphaDecision(row), rrpInverse(row)], alphaDecision(row).direction, "alpha_v1_rrp_inverse_tie_alpha"),
    ),
    composite(
      "alpha_v1_plus_rrp_inverse_tie_rrp",
      "alpha_regime_composite",
      "Alpha v1 + RRP inverse, tie to RRP inverse",
      ["alpha_v1_final_side", "rrp_derived"],
      ["alpha_v1", "regime"],
      "two-vote majority; ties resolve to RRP inverse",
      (row) => majorityVote([alphaDecision(row), rrpInverse(row)], rrpInverse(row).direction, "alpha_v1_rrp_inverse_tie_rrp"),
    ),
    composite(
      "cot_strength_rrp_inverse_majority",
      "three_cell_composite",
      "COT + Strength + RRP inverse simple majority",
      ["cot_side", "strength_gate57e_side", "rrp_derived"],
      ["cot", "strength", "regime"],
      "three-vote simple majority",
      (row) => majorityVote([cotDecision(row), strengthDecision(row), rrpInverse(row)], rrpInverse(row).direction, "cot_strength_rrp_inverse_majority"),
    ),
    composite(
      "cot_strength_bpr_majority",
      "three_cell_composite",
      "COT + Strength + BPR source direction simple majority",
      ["cot_side", "strength_gate57e_side", "bpr"],
      ["cot", "strength", "regime"],
      "three-vote simple majority",
      (row) => majorityVote([cotDecision(row), strengthDecision(row), bprDecision(row)], bprDecision(row).direction, "cot_strength_bpr_majority"),
    ),
    composite(
      "cot_strength_ppp_inverse_majority",
      "three_cell_composite",
      "COT + Strength + PPP inverse simple majority",
      ["cot_side", "strength_gate57e_side", "ppp"],
      ["cot", "strength", "regime"],
      "three-vote simple majority",
      (row) => majorityVote([cotDecision(row), strengthDecision(row), pppInverse(row)], pppInverse(row).direction, "cot_strength_ppp_inverse_majority"),
    ),
    composite(
      "cot_strength_reer_inverse_majority",
      "three_cell_composite",
      "COT + Strength + REER inverse simple majority",
      ["cot_side", "strength_gate57e_side", "reer"],
      ["cot", "strength", "regime"],
      "three-vote simple majority",
      (row) => majorityVote([cotDecision(row), strengthDecision(row), reerInverse(row)], reerInverse(row).direction, "cot_strength_reer_inverse_majority"),
    ),
    composite(
      "cot_strength_regime_best_rrp_inverse",
      "three_cell_composite",
      "COT + Strength + Gate 62 best Regime atom RRP inverse",
      ["cot_side", "strength_gate57e_side", "rrp_derived"],
      ["cot", "strength", "regime"],
      "three-vote simple majority; Regime leg is Gate 62 best RRP inverse",
      (row) => majorityVote([cotDecision(row), strengthDecision(row), rrpInverse(row)], rrpInverse(row).direction, "cot_strength_gate62_best_rrp_inverse_majority"),
    ),
    composite(
      "cot_strength_full_regime_inverse_majority",
      "three_cell_composite",
      "COT + Strength + full Regime inverse simple-majority leg",
      ["cot_side", "strength_gate57e_side", "bpr", "nominal_rate_3m", "cpi_inflation_yoy", "rrp_derived", "ppp", "neer", "reer"],
      ["cot", "strength", "regime"],
      "three-vote cell majority; Regime leg is full inverse Regime majority",
      (row) => majorityVote([cotDecision(row), strengthDecision(row), fullRegimeInverse(row)], fullRegimeInverse(row).direction, "cot_strength_full_regime_inverse_majority"),
    ),
    composite(
      "cot_strength_rrp_ppp_reer_inverse_majority",
      "cross_atom_composite",
      "COT + Strength + RRP/PPP/REER inverse atom majority",
      ["cot_side", "strength_gate57e_side", "rrp_derived", "ppp", "reer"],
      ["cot", "strength", "regime"],
      "five-vote simple majority",
      (row) => majorityVote([cotDecision(row), strengthDecision(row), rrpInverse(row), pppInverse(row), reerInverse(row)], rrpInverse(row).direction, "cot_strength_rrp_ppp_reer_inverse_majority"),
    ),
    composite(
      "cot_strength_rrp_ppp_neer_reer_inverse_majority",
      "cross_atom_composite",
      "COT + Strength + RRP/PPP/NEER/REER inverse atom majority",
      ["cot_side", "strength_gate57e_side", "rrp_derived", "ppp", "neer", "reer"],
      ["cot", "strength", "regime"],
      "six-vote simple majority; ties resolve to RRP inverse",
      (row) =>
        majorityVote(
          [cotDecision(row), strengthDecision(row), rrpInverse(row), pppInverse(row), neerInverse(row), reerInverse(row)],
          rrpInverse(row).direction,
          "cot_strength_rrp_ppp_neer_reer_inverse_majority",
        ),
    ),
    composite(
      "cot_strength_bpr_rrp_inverse_majority_tie_rrp",
      "cross_atom_composite",
      "COT + Strength + BPR + RRP inverse majority, tie to RRP",
      ["cot_side", "strength_gate57e_side", "bpr", "rrp_derived"],
      ["cot", "strength", "regime"],
      "four-vote simple majority; ties resolve to RRP inverse",
      (row) => majorityVote([cotDecision(row), strengthDecision(row), bprDecision(row), rrpInverse(row)], rrpInverse(row).direction, "cot_strength_bpr_rrp_inverse_tie_rrp"),
    ),
  ];
}

function qualityFlagsFor(row: ScoredRow) {
  return [
    ...(row.row.diagnostics.missing_cot_state ? ["cot_missing_state"] : []),
    ...(row.row.cot_atoms.tie_flag ? ["cot_tie_flag"] : []),
    ...(row.row.cot_atoms.carry_forward_flag ? ["cot_carry_forward"] : []),
    ...(row.row.cot_atoms.carry_previous_flag ? ["cot_carry_previous"] : []),
    ...(row.row.diagnostics.missing_strength_state ? ["strength_missing_state"] : []),
    ...(row.degraded ? ["candidate_degraded"] : []),
    ...row.degraded_reasons,
  ];
}

function scoreCandidate(candidate: Candidate, alphaRows: AlphaLedgerRow[]): CandidateSummary {
  const scored: ScoredRow[] = alphaRows.map((row) => {
    const decision = candidate.directionFor(row);
    const side = sideFromDirection(decision.direction);
    return {
      row,
      direction: decision.direction,
      side,
      adr_grid_adr: adrFromSide(side, row),
      weekly_hold_adr: holdFromSide(side, row),
      degraded: decision.degraded,
      degraded_reasons: decision.degraded_reasons,
      atom_votes: decision.atom_votes,
    };
  });
  const weekShape = rowsPerWeek(alphaRows);
  const annual = annualSummary(scored);
  const topWeeks = topWeekShare(scored);
  const topPairs = topPairShare(scored);
  const qualityFlagCounts = countBy(
    scored.flatMap((row) => qualityFlagsFor(row)),
    (flag) => flag,
  );
  const baseSummary = {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    label: candidate.label,
    candidate_direction_kind: candidate.candidate_direction_kind,
    transform_version: candidate.transform_version,
    atom_keys: candidate.atom_keys,
    source_cells: candidate.source_cells,
    polarity: candidate.polarity,
    tie_rule: candidate.tie_rule,
    complexity: candidate.complexity,
    source_count: new Set(candidate.source_cells).size,
    forced28_row_count: scored.length,
    duplicate_row_count: duplicateCount(scored.map((row) => `${row.row.week.week_open_utc}|${row.row.instrument.symbol}`)),
    weeks: weekShape.weeks,
    full_weeks: weekShape.full_weeks,
    symbols_per_week_histogram: weekShape.histogram,
    selected_direction_counts: countBy(scored, (row) => row.direction),
    missing_degraded_row_count: scored.filter((row) => row.degraded).length,
    missing_degraded_reason_counts: countBy(
      scored.flatMap((row) => row.degraded_reasons),
      (reason) => reason,
    ),
    missing_outcome_rows: scored.filter((row) => !Number.isFinite(row.adr_grid_adr) || !Number.isFinite(row.weekly_hold_adr)).length,
    quality_flag_counts: qualityFlagCounts,
    adr_grid: metric(scored, (row) => row.adr_grid_adr),
    weekly_hold: metric(scored, (row) => row.weekly_hold_adr),
    top_week_share: topWeeks,
    top_pair_share: topPairs,
    annual_summary: annual,
    negative_adr_grid_years: annual.filter((row) => (row.adr_grid_adr ?? 0) < 0).length,
    worst_adr_grid_year:
      annual.length > 0
        ? [...annual].sort((left, right) => (left.adr_grid_adr ?? 0) - (right.adr_grid_adr ?? 0)).map((row) => ({
            year: row.year,
            adr_grid_adr: row.adr_grid_adr,
            weekly_hold_adr: row.weekly_hold_adr,
          }))[0]
        : null,
    decision_signature_sha256: sha256Text(scored.map((row) => `${row.row.row_key}|${row.direction}`).sort().join("\n")),
  };
  const interpretationBucket = classifyCandidate(baseSummary);
  return {
    ...baseSummary,
    interpretation_bucket: interpretationBucket,
    content_hash: sha256Stable({ ...baseSummary, interpretation_bucket: interpretationBucket }),
  };
}

function rankRows(candidateRows: CandidateSummary[]) {
  const simpleRows = candidateRows.filter((row) => row.complexity <= 3 && row.missing_degraded_row_count === 0);
  const crossCellRows = candidateRows.filter((row) => row.source_count >= 3 || row.family.includes("composite"));
  const balancedScore = (row: CandidateSummary) => (row.adr_grid.r_over_drawdown ?? -999) + (row.weekly_hold.r_over_drawdown ?? -999);
  return {
    best_by_adr_grid_r_over_drawdown: [...candidateRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)).slice(0, 20),
    best_by_adr_grid_total: [...candidateRows].sort((left, right) => (right.adr_grid.adr_sum ?? -999) - (left.adr_grid.adr_sum ?? -999)).slice(0, 20),
    best_by_weekly_hold_r_over_drawdown: [...candidateRows].sort((left, right) => (right.weekly_hold.r_over_drawdown ?? -999) - (left.weekly_hold.r_over_drawdown ?? -999)).slice(0, 20),
    best_balanced_adr_and_weekly_hold: [...candidateRows].sort((left, right) => balancedScore(right) - balancedScore(left)).slice(0, 20),
    best_low_degradation: [...candidateRows]
      .sort(
        (left, right) =>
          left.missing_degraded_row_count - right.missing_degraded_row_count ||
          (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999),
      )
      .slice(0, 20),
    best_simple: [...simpleRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)).slice(0, 20),
    best_cross_cell_composite: [...crossCellRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)).slice(0, 20),
  };
}

function compactRankRow(row: CandidateSummary) {
  return {
    candidate_id: row.candidate_id,
    family: row.family,
    candidate_direction_kind: row.candidate_direction_kind,
    interpretation_bucket: row.interpretation_bucket,
    complexity: row.complexity,
    source_count: row.source_count,
    adr_grid: row.adr_grid,
    weekly_hold: row.weekly_hold,
    missing_degraded_row_count: row.missing_degraded_row_count,
    negative_adr_grid_years: row.negative_adr_grid_years,
    worst_adr_grid_year: row.worst_adr_grid_year,
  };
}

function atomValue(row: AlphaLedgerRow, atomKey: AtomKey, currency: string, atomsByKey: Map<string, CurrencyWeekAtomRow>) {
  return atomsByKey.get(atomMapKey(atomKey, row.week.week_open_utc, currency))?.value ?? null;
}

function quantileBreaks(values: number[], bucketCount: number) {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  return Array.from({ length: bucketCount - 1 }, (_unused, index) => sorted[Math.floor((sorted.length * (index + 1)) / bucketCount)] ?? 0);
}

function bucketByBreaks(value: number | null, breaks: number[], labels: string[]) {
  if (value === null || !Number.isFinite(value)) return "missing";
  for (let index = 0; index < breaks.length; index += 1) {
    if (value <= breaks[index]) return labels[index] ?? `bucket_${index + 1}`;
  }
  return labels[labels.length - 1] ?? `bucket_${labels.length}`;
}

function scoreDiagnosticCohort(
  cohortId: string,
  description: string,
  rows: AlphaLedgerRow[],
  directionFor: (row: AlphaLedgerRow) => Direction,
  extra: Record<string, unknown> = {},
) {
  const scored = metricForDirection(rows, directionFor);
  return {
    cohort_id: cohortId,
    description,
    rows: rows.length,
    weeks: new Set(rows.map((row) => row.week.week_open_utc)).size,
    adr_grid: scored.adr_grid,
    weekly_hold: scored.weekly_hold,
    ...extra,
  };
}

function buildRrpInverseDiagnostics(alphaRows: AlphaLedgerRow[], atomsByKey: Map<string, CurrencyWeekAtomRow>, bprByKey: Map<string, BprPairDirectionRow>) {
  const enriched = alphaRows.map((row) => {
    const base = row.instrument.base_currency ?? "";
    const quote = row.instrument.quote_currency ?? "";
    const baseValue = atomValue(row, "rrp_derived", base, atomsByKey);
    const quoteValue = atomValue(row, "rrp_derived", quote, atomsByKey);
    const pppDirection = compareAtomDirection(row, "ppp", "inverse", atomsByKey).direction;
    const reerDirection = compareAtomDirection(row, "reer", "inverse", atomsByKey).direction;
    const rrpDirection = compareAtomDirection(row, "rrp_derived", "inverse", atomsByKey).direction;
    const spread = typeof baseValue === "number" && typeof quoteValue === "number" ? baseValue - quoteValue : null;
    return {
      row,
      baseValue,
      quoteValue,
      spread,
      absSpread: spread === null ? null : Math.abs(spread),
      rrpDirection,
      cotDirection: directionFromSideLabel(row.cot_atoms.side),
      strengthDirection: directionFromSideLabel(row.strength_atoms.gate57e_side),
      bprDirection: bprByKey.get(row.row_key)?.bpr_source_direction ?? "BASE_CURRENCY",
      pppDirection,
      reerDirection,
    };
  });
  const spreadValues = enriched.flatMap((row) => (row.absSpread === null ? [] : [row.absSpread]));
  const spreadTier3Breaks = quantileBreaks(spreadValues, 3);
  const spreadTier5Breaks = quantileBreaks(spreadValues, 5);
  const weekCurrencyValues = new Map<string, Array<{ currency: string; value: number }>>();
  for (const row of alphaRows) {
    for (const currency of [row.instrument.base_currency, row.instrument.quote_currency]) {
      if (!currency) continue;
      const key = row.week.week_open_utc;
      const value = atomValue(row, "rrp_derived", currency, atomsByKey);
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const rows = weekCurrencyValues.get(key) ?? [];
      if (!rows.some((entry) => entry.currency === currency)) rows.push({ currency, value });
      weekCurrencyValues.set(key, rows);
    }
  }
  const rankTier = (row: AlphaLedgerRow, direction: Direction, bucketCount: 3 | 5) => {
    const currency = direction === "BASE_CURRENCY" ? row.instrument.base_currency : row.instrument.quote_currency;
    if (!currency) return "missing";
    const ranked = [...(weekCurrencyValues.get(row.week.week_open_utc) ?? [])].sort((left, right) => right.value - left.value);
    const index = ranked.findIndex((entry) => entry.currency === currency);
    if (index < 0) return "missing";
    const tier = Math.min(bucketCount, Math.floor((index / Math.max(1, ranked.length)) * bucketCount) + 1);
    return bucketCount === 3 ? ["high", "middle", "low"][tier - 1] : `q${tier}`;
  };
  const rrpDirectionFor = (row: AlphaLedgerRow) => compareAtomDirection(row, "rrp_derived", "inverse", atomsByKey).direction;
  const cohorts: Array<Record<string, unknown>> = [];
  for (const label of ["weak", "middle", "extreme"]) {
    cohorts.push(
      scoreDiagnosticCohort(
        `rrp_inverse_spread_tier3_${label}`,
        `RRP inverse rows where absolute base-minus-quote spread is tier3 ${label}.`,
        enriched.filter((row) => bucketByBreaks(row.absSpread, spreadTier3Breaks, ["weak", "middle", "extreme"]) === label).map((row) => row.row),
        rrpDirectionFor,
      ),
    );
  }
  for (const label of ["q1", "q2", "q3", "q4", "q5"]) {
    cohorts.push(
      scoreDiagnosticCohort(
        `rrp_inverse_spread_tier5_${label}`,
        `RRP inverse rows where absolute base-minus-quote spread is tier5 ${label}.`,
        enriched.filter((row) => bucketByBreaks(row.absSpread, spreadTier5Breaks, ["q1", "q2", "q3", "q4", "q5"]) === label).map((row) => row.row),
        rrpDirectionFor,
      ),
    );
  }
  for (const label of ["high", "middle", "low"]) {
    cohorts.push(
      scoreDiagnosticCohort(
        `rrp_inverse_selected_currency_rank_tier3_${label}`,
        `RRP inverse rows where selected currency RRP rank tier3 is ${label}.`,
        alphaRows.filter((row) => rankTier(row, rrpDirectionFor(row), 3) === label),
        rrpDirectionFor,
      ),
    );
  }
  for (const label of ["q1", "q2", "q3", "q4", "q5"]) {
    cohorts.push(
      scoreDiagnosticCohort(
        `rrp_inverse_selected_currency_rank_tier5_${label}`,
        `RRP inverse rows where selected currency RRP rank tier5 is ${label}.`,
        alphaRows.filter((row) => rankTier(row, rrpDirectionFor(row), 5) === label),
        rrpDirectionFor,
      ),
    );
  }
  for (const [key, directionKey] of [
    ["cot", "cotDirection"],
    ["strength", "strengthDirection"],
    ["bpr", "bprDirection"],
    ["ppp_inverse", "pppDirection"],
    ["reer_inverse", "reerDirection"],
  ] as const) {
    cohorts.push(
      scoreDiagnosticCohort(
        `rrp_inverse_agrees_with_${key}`,
        `RRP inverse rows where direction agrees with ${key}.`,
        enriched.filter((row) => row.rrpDirection === row[directionKey]).map((row) => row.row),
        rrpDirectionFor,
      ),
    );
    cohorts.push(
      scoreDiagnosticCohort(
        `rrp_inverse_disagrees_with_${key}`,
        `RRP inverse rows where direction disagrees with ${key}.`,
        enriched.filter((row) => row.rrpDirection !== row[directionKey]).map((row) => row.row),
        rrpDirectionFor,
      ),
    );
  }
  return {
    diagnostic_only: true,
    rrp_inverse_binary_direction_counts: countBy(enriched, (row) => row.rrpDirection),
    spread_tier3_breaks: spreadTier3Breaks.map((value) => round(value, 6)),
    spread_tier5_breaks: spreadTier5Breaks.map((value) => round(value, 6)),
    cohorts,
  };
}

function buildCellQualityDiagnostics(alphaRows: AlphaLedgerRow[], atomsByKey: Map<string, CurrencyWeekAtomRow>, bprByKey: Map<string, BprPairDirectionRow>) {
  const cotDirection = (row: AlphaLedgerRow) => directionFromSideLabel(row.cot_atoms.side);
  const strengthDirection = (row: AlphaLedgerRow) => directionFromSideLabel(row.strength_atoms.gate57e_side);
  const rrpDirection = (row: AlphaLedgerRow) => compareAtomDirection(row, "rrp_derived", "inverse", atomsByKey).direction;
  const bprDir = (row: AlphaLedgerRow) => bprByKey.get(row.row_key)?.bpr_source_direction ?? "BASE_CURRENCY";
  const cotCohorts = [
    ...["LONG", "SHORT"].map((side) =>
      scoreDiagnosticCohort(`cot_side_${side.toLowerCase()}`, `COT rows with ${side} side.`, alphaRows.filter((row) => row.cot_atoms.side === side), cotDirection),
    ),
    ...Object.keys(countBy(alphaRows, (row) => row.cot_atoms.tei_spread_bucket)).map((bucket) =>
      scoreDiagnosticCohort(`cot_tei_spread_bucket_${bucket}`, `COT rows in TEI spread bucket ${bucket}.`, alphaRows.filter((row) => row.cot_atoms.tei_spread_bucket === bucket), cotDirection),
    ),
    ...Object.keys(countBy(alphaRows, (row) => row.cot_atoms.lifecycle_state)).map((state) =>
      scoreDiagnosticCohort(`cot_lifecycle_${state}`, `COT lifecycle state ${state}.`, alphaRows.filter((row) => row.cot_atoms.lifecycle_state === state), cotDirection),
    ),
    scoreDiagnosticCohort("cot_tie_flag", "COT rows with tie flag.", alphaRows.filter((row) => row.cot_atoms.tie_flag), cotDirection),
    scoreDiagnosticCohort("cot_carry_forward", "COT rows with carry-forward flag.", alphaRows.filter((row) => row.cot_atoms.carry_forward_flag), cotDirection),
    scoreDiagnosticCohort("cot_carry_previous", "COT rows with carry-previous flag.", alphaRows.filter((row) => row.cot_atoms.carry_previous_flag), cotDirection),
    scoreDiagnosticCohort("cot_agrees_with_strength", "COT rows agreeing with Strength Gate 57E.", alphaRows.filter((row) => cotDirection(row) === strengthDirection(row)), cotDirection),
    scoreDiagnosticCohort("cot_disagrees_with_strength", "COT rows disagreeing with Strength Gate 57E.", alphaRows.filter((row) => cotDirection(row) !== strengthDirection(row)), cotDirection),
    scoreDiagnosticCohort("cot_agrees_with_rrp_inverse", "COT rows agreeing with RRP inverse.", alphaRows.filter((row) => cotDirection(row) === rrpDirection(row)), cotDirection),
    scoreDiagnosticCohort("cot_disagrees_with_rrp_inverse", "COT rows disagreeing with RRP inverse.", alphaRows.filter((row) => cotDirection(row) !== rrpDirection(row)), cotDirection),
  ];
  const strengthCohorts = [
    ...["LONG", "SHORT"].map((side) =>
      scoreDiagnosticCohort(
        `strength_side_${side.toLowerCase()}`,
        `Strength rows with ${side} side.`,
        alphaRows.filter((row) => row.strength_atoms.gate57e_side === side),
        strengthDirection,
      ),
    ),
    ...Object.keys(countBy(alphaRows, (row) => row.strength_atoms.score_spread_bucket)).map((bucket) =>
      scoreDiagnosticCohort(
        `strength_score_spread_bucket_${bucket}`,
        `Strength rows in score spread bucket ${bucket}.`,
        alphaRows.filter((row) => row.strength_atoms.score_spread_bucket === bucket),
        strengthDirection,
      ),
    ),
    ...Object.keys(countBy(alphaRows, (row) => row.strength_atoms.lifecycle_bucket)).map((bucket) =>
      scoreDiagnosticCohort(
        `strength_lifecycle_${bucket}`,
        `Strength lifecycle bucket ${bucket}.`,
        alphaRows.filter((row) => row.strength_atoms.lifecycle_bucket === bucket),
        strengthDirection,
      ),
    ),
    ...Object.keys(countBy(alphaRows, (row) => row.strength_atoms.phase_bucket)).map((bucket) =>
      scoreDiagnosticCohort(
        `strength_phase_${bucket}`,
        `Strength phase bucket ${bucket}.`,
        alphaRows.filter((row) => row.strength_atoms.phase_bucket === bucket),
        strengthDirection,
      ),
    ),
    ...Object.keys(countBy(alphaRows, (row) => row.strength_atoms.gate57e_action_label)).map((label) =>
      scoreDiagnosticCohort(
        `strength_action_${label}`,
        `Strength Gate 57E action label ${label}.`,
        alphaRows.filter((row) => row.strength_atoms.gate57e_action_label === label),
        strengthDirection,
      ),
    ),
    scoreDiagnosticCohort("strength_agrees_with_cot", "Strength rows agreeing with COT.", alphaRows.filter((row) => strengthDirection(row) === cotDirection(row)), strengthDirection),
    scoreDiagnosticCohort("strength_disagrees_with_cot", "Strength rows disagreeing with COT.", alphaRows.filter((row) => strengthDirection(row) !== cotDirection(row)), strengthDirection),
    scoreDiagnosticCohort(
      "strength_agrees_with_rrp_inverse",
      "Strength rows agreeing with RRP inverse.",
      alphaRows.filter((row) => strengthDirection(row) === rrpDirection(row)),
      strengthDirection,
    ),
    scoreDiagnosticCohort(
      "strength_disagrees_with_rrp_inverse",
      "Strength rows disagreeing with RRP inverse.",
      alphaRows.filter((row) => strengthDirection(row) !== rrpDirection(row)),
      strengthDirection,
    ),
  ];
  const bprCohorts = [
    scoreDiagnosticCohort(
      "bpr_promotion_eligible_pair_direction",
      "Rows where Gate 60H marks the BPR pair direction promotion eligible.",
      alphaRows.filter((row) => bprByKey.get(row.row_key)?.promotion_eligible_pair_direction === true),
      bprDir,
    ),
    scoreDiagnosticCohort(
      "bpr_source_direction_eligible",
      "Rows where Gate 60G source-direction eligibility is true regardless of promotion eligibility.",
      alphaRows.filter((row) => bprByKey.get(row.row_key)?.pair_source_direction_eligible === true),
      bprDir,
    ),
    scoreDiagnosticCohort(
      "bpr_promotion_ineligible_pair_direction",
      "Rows where BPR forced-28 direction exists but promotion eligibility is false.",
      alphaRows.filter((row) => bprByKey.get(row.row_key)?.promotion_eligible_pair_direction === false),
      bprDir,
    ),
  ];
  return {
    diagnostic_only: true,
    cot: {
      side_counts: countBy(alphaRows, (row) => row.cot_atoms.side),
      tei_spread_bucket_counts: countBy(alphaRows, (row) => row.cot_atoms.tei_spread_bucket),
      lifecycle_state_counts: countBy(alphaRows, (row) => row.cot_atoms.lifecycle_state),
      tie_flag_rows: alphaRows.filter((row) => row.cot_atoms.tie_flag).length,
      carry_forward_rows: alphaRows.filter((row) => row.cot_atoms.carry_forward_flag).length,
      carry_previous_rows: alphaRows.filter((row) => row.cot_atoms.carry_previous_flag).length,
      cohorts: cotCohorts,
    },
    strength: {
      side_counts: countBy(alphaRows, (row) => row.strength_atoms.gate57e_side),
      score_spread_bucket_counts: countBy(alphaRows, (row) => row.strength_atoms.score_spread_bucket),
      lifecycle_bucket_counts: countBy(alphaRows, (row) => row.strength_atoms.lifecycle_bucket),
      phase_bucket_counts: countBy(alphaRows, (row) => row.strength_atoms.phase_bucket),
      action_label_counts: countBy(alphaRows, (row) => row.strength_atoms.gate57e_action_label),
      cohorts: strengthCohorts,
    },
    bpr: {
      base_quality_counts: countBy([...bprByKey.values()], (row) => row.base_source_quality),
      quote_quality_counts: countBy([...bprByKey.values()], (row) => row.quote_source_quality),
      direction_rule_counts: countBy([...bprByKey.values()], (row) => row.bpr_source_direction_rule),
      cohorts: bprCohorts,
    },
  };
}

function buildCrossCellAgreementDiagnostics(alphaRows: AlphaLedgerRow[], atomsByKey: Map<string, CurrencyWeekAtomRow>, bprByKey: Map<string, BprPairDirectionRow>) {
  const cotDirection = (row: AlphaLedgerRow) => directionFromSideLabel(row.cot_atoms.side);
  const strengthDirection = (row: AlphaLedgerRow) => directionFromSideLabel(row.strength_atoms.gate57e_side);
  const alphaDirection = (row: AlphaLedgerRow) => directionFromSideLabel(row.arbitration.final_side);
  const rrpDirection = (row: AlphaLedgerRow) => compareAtomDirection(row, "rrp_derived", "inverse", atomsByKey).direction;
  const bprDirectionFor = (row: AlphaLedgerRow) => bprByKey.get(row.row_key)?.bpr_source_direction ?? "BASE_CURRENCY";
  const cohorts = [
    scoreDiagnosticCohort("cot_strength_agree", "COT and Strength agree.", alphaRows.filter((row) => cotDirection(row) === strengthDirection(row)), alphaDirection),
    scoreDiagnosticCohort("cot_strength_disagree", "COT and Strength disagree.", alphaRows.filter((row) => cotDirection(row) !== strengthDirection(row)), alphaDirection),
    scoreDiagnosticCohort("cot_rrp_inverse_agree", "COT and RRP inverse agree.", alphaRows.filter((row) => cotDirection(row) === rrpDirection(row)), rrpDirection),
    scoreDiagnosticCohort("cot_rrp_inverse_disagree", "COT and RRP inverse disagree.", alphaRows.filter((row) => cotDirection(row) !== rrpDirection(row)), rrpDirection),
    scoreDiagnosticCohort("strength_rrp_inverse_agree", "Strength and RRP inverse agree.", alphaRows.filter((row) => strengthDirection(row) === rrpDirection(row)), rrpDirection),
    scoreDiagnosticCohort("strength_rrp_inverse_disagree", "Strength and RRP inverse disagree.", alphaRows.filter((row) => strengthDirection(row) !== rrpDirection(row)), rrpDirection),
    scoreDiagnosticCohort(
      "cot_strength_rrp_inverse_all_agree",
      "COT, Strength, and RRP inverse all agree.",
      alphaRows.filter((row) => cotDirection(row) === strengthDirection(row) && strengthDirection(row) === rrpDirection(row)),
      rrpDirection,
    ),
    scoreDiagnosticCohort(
      "cot_strength_agree_rrp_disagrees",
      "COT and Strength agree while RRP inverse disagrees.",
      alphaRows.filter((row) => cotDirection(row) === strengthDirection(row) && strengthDirection(row) !== rrpDirection(row)),
      rrpDirection,
    ),
    scoreDiagnosticCohort(
      "cot_rrp_agree_strength_disagrees",
      "COT and RRP inverse agree while Strength disagrees.",
      alphaRows.filter((row) => cotDirection(row) === rrpDirection(row) && strengthDirection(row) !== rrpDirection(row)),
      rrpDirection,
    ),
    scoreDiagnosticCohort(
      "strength_rrp_agree_cot_disagrees",
      "Strength and RRP inverse agree while COT disagrees.",
      alphaRows.filter((row) => strengthDirection(row) === rrpDirection(row) && cotDirection(row) !== rrpDirection(row)),
      rrpDirection,
    ),
    scoreDiagnosticCohort("rrp_inverse_bpr_agree", "RRP inverse and BPR agree.", alphaRows.filter((row) => rrpDirection(row) === bprDirectionFor(row)), rrpDirection),
    scoreDiagnosticCohort("rrp_inverse_bpr_disagree", "RRP inverse and BPR disagree.", alphaRows.filter((row) => rrpDirection(row) !== bprDirectionFor(row)), rrpDirection),
  ];
  return {
    diagnostic_only: true,
    direction_pair_counts: {
      cot_vs_strength: countBy(alphaRows, (row) => (cotDirection(row) === strengthDirection(row) ? "agree" : "disagree")),
      cot_vs_rrp_inverse: countBy(alphaRows, (row) => (cotDirection(row) === rrpDirection(row) ? "agree" : "disagree")),
      strength_vs_rrp_inverse: countBy(alphaRows, (row) => (strengthDirection(row) === rrpDirection(row) ? "agree" : "disagree")),
      rrp_inverse_vs_bpr: countBy(alphaRows, (row) => (rrpDirection(row) === bprDirectionFor(row) ? "agree" : "disagree")),
    },
    cohorts,
  };
}

function buildYearDiagnostics(candidateRows: CandidateSummary[]) {
  const top20 = [...candidateRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)).slice(0, 20);
  const rrpVariants = candidateRows.filter((row) => row.candidate_id.includes("rrp") && row.candidate_id.includes("inverse"));
  const ids = [...new Set([...top20, ...rrpVariants].map((row) => row.candidate_id))];
  return {
    diagnostic_only: true,
    selection_rule: "top 20 by ADR Grid R/DD plus every candidate whose id contains rrp and inverse",
    candidate_count: ids.length,
    candidates: ids.map((id) => {
      const row = candidateRows.find((candidate) => candidate.candidate_id === id);
      return {
        candidate_id: id,
        family: row?.family,
        adr_grid: row?.adr_grid,
        weekly_hold: row?.weekly_hold,
        negative_adr_grid_years: row?.negative_adr_grid_years,
        worst_adr_grid_year: row?.worst_adr_grid_year,
        annual_summary: row?.annual_summary,
      };
    }),
  };
}

function architecturePaths() {
  const rg = (args: string[]) => {
    try {
      return execFileSync("rg", args, { encoding: "utf8" })
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);
    } catch {
      return [];
    }
  };
  const normalize = (rows: string[]) => rows.map((row) => row.split(path.sep).join("/").replaceAll("\\", "/"));
  return {
    brain_paths: normalize(rg(["--files", "engine/src/brain"])),
    old_signal_paths_still_present: normalize(rg(["--files", "engine/src/signals", "app/src/lib/research", "app/src/lib/performance"])),
    brain_references: normalize(rg(["-n", "brain|Brain|BRAIN_ARCHITECTURE|cot_atoms|strength_atoms|regime", "engine/src", "engine/scripts"]).slice(0, 200)),
  };
}

function renderArchitectureDebtMap(summary: Record<string, unknown>) {
  const paths = architecturePaths();
  return [
    "# Gate 63 Brain Architecture Debt Map",
    "",
    "Discovery-only debt map. Gate 63 does not move code, rename runtime paths, or consolidate sources.",
    "",
    "## Existing Brain Paths",
    "",
    ...paths.brain_paths.map((file) => `- \`${file}\``),
    "",
    "## Old Signal Paths Still Present",
    "",
    "These paths still carry real historical signal/source/evaluator behavior or app-facing compatibility. They are not moved in Gate 63.",
    "",
    ...paths.old_signal_paths_still_present.slice(0, 120).map((file) => `- \`${file}\``),
    "",
    "## Current Code Ownership",
    "",
    "- COT atom evidence lives in Gate 59 ledger rows and transitional Brain placeholders under `engine/src/brain/cells/cot`.",
    "- Strength atom evidence lives in Gate 59 ledger rows and historical Strength source/evaluator paths under `engine/src/signals/strength`.",
    "- Regime atom evidence lives in Gate 60C/60G/60H artifacts, with inventory contracts in `engine/src/brain/architecture.ts`.",
    "- Body arbitration under `engine/src/brain/body/arbitration` is a reserved namespace only; no final Body algorithm exists here.",
    "",
    "## Placeholder Versus Real Implementation",
    "",
    "- Real implementation today: artifact builders and historical signal paths that generate locked ledgers.",
    "- Real implementation today: `engine/src/brain/architecture.ts` inventory contract.",
    "- Placeholder today: cell subfolders such as `cells/*/atoms`, `contracts`, and `ledgers` mostly expose namespace markers.",
    "- Placeholder today: Body/Risk namespaces are reserved and must not reduce forced-28 signal rows.",
    "",
    "## Future Move Suggestions",
    "",
    "- Move reusable COT atom derivation into `engine/src/brain/cells/cot` only after Gate 63 review confirms which atoms matter.",
    "- Move reusable Strength atom derivation into `engine/src/brain/cells/strength` only after preserving Gate 57E parity.",
    "- Move reusable Regime atom transforms into `engine/src/brain/cells/regime` only after source contracts remain locked.",
    "- Keep immutable `docs/research/gates/**` evidence in place; do not rewrite historical artifacts into source modules.",
    "- Suggested next refactor gate if Freedom opens it: `Gate 64A: Brain source consolidation after universal atom matrix`.",
    "",
    "## Gate 63 Stop Line",
    "",
    String(summary.stop_line),
    "",
  ].join("\n");
}

function renderBestCandidates(ranking: ReturnType<typeof rankRows>) {
  const lines = [
    "# Gate 63 Universal Atom Best Candidates",
    "",
    "Discovery-only ranking. These are not promoted Body logic, Alpha v2, risk, execution, or app runtime changes.",
    "",
  ];
  const sections: Array<[string, CandidateSummary[]]> = [
    ["Best ADR Grid R/DD", ranking.best_by_adr_grid_r_over_drawdown],
    ["Best ADR Grid Total", ranking.best_by_adr_grid_total],
    ["Best Weekly Hold R/DD", ranking.best_by_weekly_hold_r_over_drawdown],
    ["Best Balanced ADR + Weekly Hold", ranking.best_balanced_adr_and_weekly_hold],
    ["Best Low-Degradation", ranking.best_low_degradation],
    ["Best Simple", ranking.best_simple],
    ["Best Cross-Cell Composite", ranking.best_cross_cell_composite],
  ];
  for (const [title, rows] of sections) {
    lines.push(`## ${title}`, "", "| Rank | Candidate | Family | ADR Grid | DD | R/DD | PF | Weekly Hold | WH R/DD | Degraded | Negative Years |", "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
    rows.slice(0, 12).forEach((row, index) => {
      lines.push(
        `| ${index + 1} | ${row.candidate_id} | ${row.family} | ${row.adr_grid.adr_sum} | ${row.adr_grid.max_drawdown} | ${row.adr_grid.r_over_drawdown} | ${row.adr_grid.row_pf} | ${row.weekly_hold.adr_sum} | ${row.weekly_hold.r_over_drawdown} | ${row.missing_degraded_row_count} | ${row.negative_adr_grid_years} |`,
      );
    });
    lines.push("");
  }
  return lines.join("\n");
}

function renderReport(summary: Record<string, unknown>, ranking: ReturnType<typeof rankRows>) {
  const topRows = ranking.best_by_adr_grid_r_over_drawdown.slice(0, 16);
  const table = topRows
    .map(
      (row, index) =>
        `| ${index + 1} | ${row.candidate_id} | ${row.family} | ${row.adr_grid.adr_sum} | ${row.adr_grid.max_drawdown} | ${row.adr_grid.r_over_drawdown} | ${row.weekly_hold.adr_sum} | ${row.missing_degraded_row_count} | ${row.negative_adr_grid_years} |`,
    )
    .join("\n");
  return [
    "# Gate 63 Universal Atom Matrix",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Boundary",
    "",
    "- Universal all-atom discovery matrix across COT, Strength, and Regime cells.",
    "- Uses frozen Gate 59 outcomes and Gate 60C/60G/60H Regime artifacts.",
    "- Candidate labels use `candidate_atom_direction`, `candidate_cell_direction`, and `candidate_composite_direction`.",
    "- No promotion, Body algorithm, Alpha v2, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning, or broad Brain refactor.",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(summary.denominator, null, 2),
    "```",
    "",
    "## Top Candidates By ADR Grid R/DD",
    "",
    "| Rank | Candidate | Family | ADR Grid | DD | R/DD | Weekly Hold | Degraded Rows | Negative Years |",
    "|---:|---|---|---:|---:|---:|---:|---:|---:|",
    table,
    "",
    "## Ranking Views",
    "",
    "```json",
    JSON.stringify(summary.ranking_views, null, 2),
    "```",
    "",
    "## Architecture Debt Map",
    "",
    `- Debt map: \`${summary.artifacts.brainArchitectureDebtMapMd}\``,
    "- Recommended future refactor gate, only if opened later: `Gate 64A: Brain source consolidation after universal atom matrix`.",
    "",
    "## Artifacts",
    "",
    `- Candidate contracts: \`${summary.artifacts.candidateContracts}\``,
    `- Matrix rows: \`${summary.artifacts.matrixRowsJsonl}\``,
    `- Summary JSON: \`${summary.artifacts.summaryJson}\``,
    `- Best candidates: \`${summary.artifacts.bestCandidatesMd}\``,
    `- Year diagnostics: \`${summary.artifacts.yearDiagnosticsJson}\``,
    `- Quality diagnostics: \`${summary.artifacts.qualityDiagnosticsJson}\``,
    `- RRP inverse diagnostics: \`${summary.artifacts.rrpInverseTierDiagnosticsJson}\``,
    `- Cross-cell diagnostics: \`${summary.artifacts.crossCellAgreementDiagnosticsJson}\``,
    `- Query/rebuild receipt: \`${summary.artifacts.queryReceipt}\``,
    `- SHA identity: \`${summary.artifacts.shaIdentity}\``,
    "",
    "## Stop Line",
    "",
    String(summary.stop_line),
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const alphaRows = await readJsonl<AlphaLedgerRow>(options.alphaLedgerPath);
  const currencyAtomPath = path.join(options.gate60cDir, "gate60c-currency-week-source-atom-ledger.rows.jsonl");
  const bprPairPath = path.join(options.gate60gDir, "gate60g-bpr-pair-direction-ledger.rows.jsonl");
  const gate60hSummaryPath = path.join(options.gate60hDir, "gate60h-bpr-source-direction-eligibility-summary.json");
  const gate61bSummaryPath = path.join(options.gate61bDir, "universal-cell-atom-readiness.summary.json");
  const gate62SummaryPath = path.join(options.gate62Dir, "gate62-regime-cell-matrix.summary.json");
  const currencyAtomRows = await readJsonl<CurrencyWeekAtomRow>(currencyAtomPath);
  const bprPairRows = await readJsonl<BprPairDirectionRow>(bprPairPath);
  const gate60hSummary = await readJson<Record<string, unknown>>(gate60hSummaryPath);
  const gate61bSummary = await readJson<Record<string, unknown>>(gate61bSummaryPath);
  const gate62Summary = await readJson<Record<string, unknown>>(gate62SummaryPath);
  if (!String(gate61bSummary.verdict).startsWith("PASS_")) {
    throw new Error(`Gate 61B readiness did not pass: ${gate61bSummary.verdict}`);
  }
  if (!String(gate62Summary.verdict).startsWith("PASS_")) {
    throw new Error(`Gate 62 matrix did not pass: ${gate62Summary.verdict}`);
  }

  const atomsByKey = new Map(currencyAtomRows.map((row) => [atomMapKey(row.atom_key, row.alpha_week_open_utc, row.currency), row]));
  const bprByKey = new Map(bprPairRows.map((row) => [row.row_key, row]));
  const candidates = buildCandidates(atomsByKey, bprByKey);
  const candidateRows = candidates.map((candidate) => scoreCandidate(candidate, alphaRows));
  const ranking = rankRows(candidateRows);
  const rrpDiagnostics = buildRrpInverseDiagnostics(alphaRows, atomsByKey, bprByKey);
  const qualityDiagnostics = buildCellQualityDiagnostics(alphaRows, atomsByKey, bprByKey);
  const crossCellDiagnostics = buildCrossCellAgreementDiagnostics(alphaRows, atomsByKey, bprByKey);
  const yearDiagnostics = buildYearDiagnostics(candidateRows);
  const weekShape = rowsPerWeek(alphaRows);
  const denominator = {
    alpha_rows: alphaRows.length,
    expected_alpha_rows: EXPECTED_ROWS,
    alpha_weeks: weekShape.weeks,
    expected_alpha_weeks: EXPECTED_WEEKS,
    symbols_per_week_histogram: weekShape.histogram,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    full_weeks: weekShape.full_weeks,
    duplicate_week_symbol_rows: duplicateCount(alphaRows.map((row) => `${row.week.week_open_utc}|${row.instrument.symbol}`)),
    bpr_pair_direction_rows: bprPairRows.length,
    candidate_count: candidateRows.length,
    disqualified_candidates: candidateRows.filter((row) => row.interpretation_bucket === "disqualified").length,
    candidate_direction_kind_counts: countBy(candidateRows, (row) => row.candidate_direction_kind),
    source_mutation_rows: bprPairRows.filter((row) => row.source_rows_mutated).length,
    body_algorithm_started: false,
    promotion_started: false,
  };

  const pass =
    denominator.alpha_rows === EXPECTED_ROWS &&
    denominator.alpha_weeks === EXPECTED_WEEKS &&
    denominator.full_weeks === EXPECTED_WEEKS &&
    denominator.duplicate_week_symbol_rows === 0 &&
    denominator.bpr_pair_direction_rows === EXPECTED_ROWS &&
    denominator.disqualified_candidates === 0 &&
    denominator.source_mutation_rows === 0;

  const candidateContracts = {
    gate_id: GATE_ID,
    brain_architecture: BRAIN_ARCHITECTURE,
    atom_inventory: flattenBrainAtomInventory(),
    candidate_contracts: candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      family: candidate.family,
      label: candidate.label,
      candidate_direction_kind: candidate.candidate_direction_kind,
      transform_version: candidate.transform_version,
      atom_keys: candidate.atom_keys,
      source_cells: candidate.source_cells,
      polarity: candidate.polarity,
      tie_rule: candidate.tie_rule,
      complexity: candidate.complexity,
      row_policy: "forced_28_rows_preserved",
    })),
    non_candidate_diagnostics: {
      rrp_inverse_tiers: true,
      cot_quality: true,
      strength_quality: true,
      bpr_quality: true,
      cross_cell_agreement: true,
    },
  };

  const artifactPaths = {
    candidateContracts: toRepoRelative(path.join(artifactDir, "gate63-universal-atom-candidate-contracts.json")),
    matrixRowsJsonl: toRepoRelative(path.join(artifactDir, "gate63-universal-atom-matrix.rows.jsonl")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate63-universal-atom-matrix.summary.json")),
    bestCandidatesMd: toRepoRelative(path.join(artifactDir, "gate63-universal-atom-best-candidates.md")),
    yearDiagnosticsJson: toRepoRelative(path.join(artifactDir, "gate63-universal-atom-year-by-year-diagnostics.json")),
    qualityDiagnosticsJson: toRepoRelative(path.join(artifactDir, "gate63-universal-atom-quality-diagnostics.json")),
    rrpInverseTierDiagnosticsJson: toRepoRelative(path.join(artifactDir, "gate63-rrp-inverse-tier-diagnostics.json")),
    crossCellAgreementDiagnosticsJson: toRepoRelative(path.join(artifactDir, "gate63-cross-cell-agreement-diagnostics.json")),
    brainArchitectureDebtMapMd: toRepoRelative(path.join(artifactDir, "gate63-brain-architecture-debt-map.md")),
    queryReceipt: toRepoRelative(path.join(artifactDir, "gate63-universal-atom-matrix.query-receipt.md")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate63-universal-atom-matrix.sha256.txt")),
    report: toRepoRelative(reportPath),
  };

  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_UNIVERSAL_ATOM_MATRIX__FORCED28_PRESERVED__DISCOVERY_ONLY__NO_BODY" : "FAIL_UNIVERSAL_ATOM_MATRIX",
    denominator,
    ranking_views: Object.fromEntries(Object.entries(ranking).map(([key, rows]) => [key, rows.slice(0, 10).map(compactRankRow)])),
    gate60h_bpr_class_counts: gate60hSummary.decision_class_counts,
    gate62_best_candidate_reference: {
      best_by_adr_grid_r_over_drawdown: (gate62Summary.best_by_adr_grid_r_over_drawdown as Array<Record<string, unknown>> | undefined)?.[0] ?? null,
    },
    input_hashes: {
      gate59_alpha_ledger: await fileHash(options.alphaLedgerPath),
      gate60c_currency_atom_ledger: await fileHash(currencyAtomPath),
      gate60g_bpr_pair_direction_ledger: await fileHash(bprPairPath),
      gate60h_eligibility_summary: await fileHash(gate60hSummaryPath),
      gate61b_readiness_summary: await fileHash(gate61bSummaryPath),
      gate62_summary: await fileHash(gate62SummaryPath),
    },
    stop_line:
      "Stop after Gate 63. Do not proceed to Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime, source mutation, COT retuning, Strength retuning, or broad Brain source refactor.",
    artifacts: artifactPaths,
  };

  const candidateContractsPath = path.join(artifactDir, "gate63-universal-atom-candidate-contracts.json");
  const matrixRowsPath = path.join(artifactDir, "gate63-universal-atom-matrix.rows.jsonl");
  const summaryPath = path.join(artifactDir, "gate63-universal-atom-matrix.summary.json");
  const bestCandidatesPath = path.join(artifactDir, "gate63-universal-atom-best-candidates.md");
  const yearDiagnosticsPath = path.join(artifactDir, "gate63-universal-atom-year-by-year-diagnostics.json");
  const qualityDiagnosticsPath = path.join(artifactDir, "gate63-universal-atom-quality-diagnostics.json");
  const rrpDiagnosticsPath = path.join(artifactDir, "gate63-rrp-inverse-tier-diagnostics.json");
  const crossCellDiagnosticsPath = path.join(artifactDir, "gate63-cross-cell-agreement-diagnostics.json");
  const debtMapPath = path.join(artifactDir, "gate63-brain-architecture-debt-map.md");
  const queryReceiptPath = path.join(artifactDir, "gate63-universal-atom-matrix.query-receipt.md");
  const shaPath = path.join(artifactDir, "gate63-universal-atom-matrix.sha256.txt");

  await writeFile(candidateContractsPath, `${JSON.stringify(candidateContracts, null, 2)}\n`, "utf8");
  await writeFile(matrixRowsPath, `${candidateRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(bestCandidatesPath, renderBestCandidates(ranking), "utf8");
  await writeFile(yearDiagnosticsPath, `${JSON.stringify(yearDiagnostics, null, 2)}\n`, "utf8");
  await writeFile(qualityDiagnosticsPath, `${JSON.stringify(qualityDiagnostics, null, 2)}\n`, "utf8");
  await writeFile(rrpDiagnosticsPath, `${JSON.stringify(rrpDiagnostics, null, 2)}\n`, "utf8");
  await writeFile(crossCellDiagnosticsPath, `${JSON.stringify(crossCellDiagnostics, null, 2)}\n`, "utf8");
  await writeFile(debtMapPath, renderArchitectureDebtMap(summary), "utf8");
  const queryReceipt = [
    "# Gate 63 Query/Rebuild Receipt",
    "",
    `Command: \`${COMMAND}\``,
    `Generated: \`${summary.generated_at}\``,
    `Git commit at generation: \`${summary.git_commit}\``,
    "",
    "Inputs:",
    `- Gate 59 Alpha ledger: \`${options.alphaLedgerPath}\``,
    `- Gate 60C currency atom ledger: \`${currencyAtomPath}\``,
    `- Gate 60G BPR pair-direction ledger: \`${bprPairPath}\``,
    `- Gate 60H eligibility summary: \`${gate60hSummaryPath}\``,
    `- Gate 61B readiness summary: \`${gate61bSummaryPath}\``,
    `- Gate 62 summary: \`${gate62SummaryPath}\``,
    "",
    "No database query, raw M1 simulation, source mutation, promotion, Body algorithm, Alpha v2, risk, exits, execution, MT5/live, app/runtime work, COT retuning, Strength retuning, or broad Brain source refactor was run.",
    "",
  ].join("\n");
  await writeFile(queryReceiptPath, queryReceipt, "utf8");
  const reportText = renderReport(summary, ranking);
  await writeFile(reportPath, reportText, "utf8");

  const contentInvariant = sha256Stable({
    denominator,
    candidate_hashes: candidateRows.map((row) => row.content_hash),
    ranking_view_hash: sha256Stable(summary.ranking_views),
    rrp_diagnostics_hash: sha256Stable(rrpDiagnostics),
    quality_diagnostics_hash: sha256Stable(qualityDiagnostics),
    cross_cell_diagnostics_hash: sha256Stable(crossCellDiagnostics),
    year_diagnostics_hash: sha256Stable(yearDiagnostics),
    input_hashes: summary.input_hashes,
    stop_line: summary.stop_line,
  });
  const shaLines = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${summary.generated_at}`,
    `git_commit ${summary.git_commit}`,
    `verdict ${summary.verdict}`,
    `candidate_contracts ${await fileHash(candidateContractsPath)} ${toRepoRelative(candidateContractsPath)}`,
    `matrix_rows_jsonl ${await fileHash(matrixRowsPath)} ${toRepoRelative(matrixRowsPath)}`,
    `summary_json ${await fileHash(summaryPath)} ${toRepoRelative(summaryPath)}`,
    `best_candidates_md ${await fileHash(bestCandidatesPath)} ${toRepoRelative(bestCandidatesPath)}`,
    `year_diagnostics_json ${await fileHash(yearDiagnosticsPath)} ${toRepoRelative(yearDiagnosticsPath)}`,
    `quality_diagnostics_json ${await fileHash(qualityDiagnosticsPath)} ${toRepoRelative(qualityDiagnosticsPath)}`,
    `rrp_inverse_tier_diagnostics_json ${await fileHash(rrpDiagnosticsPath)} ${toRepoRelative(rrpDiagnosticsPath)}`,
    `cross_cell_agreement_diagnostics_json ${await fileHash(crossCellDiagnosticsPath)} ${toRepoRelative(crossCellDiagnosticsPath)}`,
    `brain_architecture_debt_map_md ${await fileHash(debtMapPath)} ${toRepoRelative(debtMapPath)}`,
    `query_receipt ${await fileHash(queryReceiptPath)} ${toRepoRelative(queryReceiptPath)}`,
    `report ${await fileHash(reportPath)} ${toRepoRelative(reportPath)}`,
    `content_invariant ${contentInvariant} content`,
    "",
  ].join("\n");
  await writeFile(shaPath, shaLines, "utf8");

  if (!pass) {
    console.error(summary.verdict);
    process.exit(1);
  }
  console.log(summary.verdict);
  console.log(`Candidates: ${candidateRows.length}`);
  console.log(`Best by ADR Grid R/DD: ${ranking.best_by_adr_grid_r_over_drawdown[0]?.candidate_id}`);
  console.log(`Best cross-cell composite: ${ranking.best_cross_cell_composite[0]?.candidate_id}`);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
  console.log(`SHA identity: ${toRepoRelative(shaPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
