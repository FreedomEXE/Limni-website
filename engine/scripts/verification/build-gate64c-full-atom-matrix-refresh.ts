import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BRAIN_ARCHITECTURE, flattenBrainAtomInventory } from "@engine/brain/architecture";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 64C: full-atom-matrix-refresh";
const COMMAND = "npm run engine:gate64c:full-atom-matrix-refresh";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_GATE60C_DIR = "docs/research/gates/gate60c/artifacts/gate60c-regime-source-atom-fill";
const DEFAULT_GATE60G_DIR = "docs/research/gates/gate60g/artifacts/gate60g-bpr-forced28-source-direction-ledger";
const DEFAULT_GATE63_DIR = "docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix";
const DEFAULT_GATE64A_DIR = "docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit";
const DEFAULT_GATE64B_DIR = "docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate64c/GATE64C_FULL_ATOM_MATRIX_REFRESH_2026-06-27.md";

const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const CURRENCY_TIE_RANK = new Map(["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"].map((currency, index) => [currency, index]));
const VALUATION_FORMULAS = ["valuation_gap_reer_deviation", "valuation_gap_neer_reer_relative"] as const;

type Direction = "BASE_CURRENCY" | "QUOTE_CURRENCY";
type Side = "LONG" | "SHORT";
type Polarity = "natural" | "inverse";
type AtomKey = "nominal_rate_3m" | "cpi_inflation_yoy" | "rrp_derived" | "ppp" | "neer" | "reer";
type ValuationFormula = (typeof VALUATION_FORMULAS)[number];

type CliOptions = {
  alphaLedgerPath: string;
  gate60cDir: string;
  gate60gDir: string;
  gate63Dir: string;
  gate64aDir: string;
  gate64bDir: string;
  artifactDir: string;
  reportPath: string;
};

type AlphaLedgerRow = {
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

type CurrencyWeekAtomRow = {
  alpha_week_open_utc: string;
  currency: string;
  atom_key: string;
  status: string;
  value: number | null;
};

type BprPairDirectionRow = {
  row_key: string;
  bpr_source_direction: Direction;
  bpr_source_direction_rule: string;
  base_source_quality: string;
  quote_source_quality: string;
  pair_source_direction_eligible: boolean;
  promotion_eligible_pair_direction: boolean;
  promotion_ineligible_reasons: string[];
  source_rows_mutated: boolean;
};

type ValuationPairRow = {
  row_key: string;
  alpha_row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
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

type Decision = {
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
  candidate_direction_kind: "candidate_atom_direction" | "candidate_cell_direction" | "candidate_composite_direction";
  atom_keys: string[];
  source_cells: string[];
  transform_version: string;
  tie_rule: string;
  dependency_rule: string;
  complexity: number;
  directionFor: (row: AlphaLedgerRow) => Decision;
};

type ScoredRow = {
  row: AlphaLedgerRow;
  direction: Direction;
  side: Side;
  adr_grid_adr: number;
  weekly_hold_adr: number;
  degraded: boolean;
  degraded_reasons: string[];
};

type CandidateSummary = {
  candidate_id: string;
  family: string;
  label: string;
  candidate_direction_kind: string;
  atom_keys: string[];
  source_cells: string[];
  transform_version: string;
  tie_rule: string;
  dependency_rule: string;
  complexity: number;
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
  annual_summary: Array<{ year: number; rows: number; weeks: number; adr_grid_adr: number | null; weekly_hold_adr: number | null }>;
  top_week_share: { top5_abs_week_share: number | null; top_abs_weeks: Array<{ week_open_utc: string; adr_grid_sum: number }> };
  top_pair_share: { top_abs_pair: { symbol: string; adr_grid_sum: number } | null; top_abs_pair_share: number | null };
  interpretation_bucket: string;
  decision_signature_sha256: string;
  content_hash: string;
};

type MetricSummary = {
  adr_sum: number | null;
  adr_mean: number | null;
  max_drawdown: number;
  r_over_drawdown: number | null;
  row_pf: number | null;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    alphaLedgerPath: DEFAULT_ALPHA_LEDGER_PATH,
    gate60cDir: DEFAULT_GATE60C_DIR,
    gate60gDir: DEFAULT_GATE60G_DIR,
    gate63Dir: DEFAULT_GATE63_DIR,
    gate64aDir: DEFAULT_GATE64A_DIR,
    gate64bDir: DEFAULT_GATE64B_DIR,
    artifactDir: DEFAULT_ARTIFACT_DIR,
    reportPath: DEFAULT_REPORT_PATH,
  };
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=", 2);
    if (!value) continue;
    if (key === "--alpha-ledger-path") options.alphaLedgerPath = value;
    if (key === "--gate60c-dir") options.gate60cDir = value;
    if (key === "--gate60g-dir") options.gate60gDir = value;
    if (key === "--gate63-dir") options.gate63Dir = value;
    if (key === "--gate64a-dir") options.gate64aDir = value;
    if (key === "--gate64b-dir") options.gate64bDir = value;
    if (key === "--artifact-dir") options.artifactDir = value;
    if (key === "--report-path") options.reportPath = value;
  }
  return options;
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

function toRepoRelative(filePath: string) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join("/");
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readJsonl<T>(filePath: string) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

async function fileHash(filePath: string) {
  return sha256Text(await readFile(filePath));
}

function round(value: number | null | undefined, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
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

function sideFromDirection(direction: Direction): Side {
  return direction === "BASE_CURRENCY" ? "LONG" : "SHORT";
}

function directionFromSide(side: Side): Direction {
  return side === "LONG" ? "BASE_CURRENCY" : "QUOTE_CURRENCY";
}

function opposite(direction: Direction): Direction {
  return direction === "BASE_CURRENCY" ? "QUOTE_CURRENCY" : "BASE_CURRENCY";
}

function adrFromSide(side: Side, row: AlphaLedgerRow) {
  return side === "LONG" ? row.outcomes.adr_grid.long : row.outcomes.adr_grid.short;
}

function holdFromSide(side: Side, row: AlphaLedgerRow) {
  return side === "LONG" ? row.outcomes.weekly_hold.long : row.outcomes.weekly_hold.short;
}

function currencyRankDirection(base: string, quote: string) {
  const baseRank = CURRENCY_TIE_RANK.get(base) ?? Number.MAX_SAFE_INTEGER;
  const quoteRank = CURRENCY_TIE_RANK.get(quote) ?? Number.MAX_SAFE_INTEGER;
  return baseRank <= quoteRank ? "BASE_CURRENCY" : "QUOTE_CURRENCY";
}

function atomMapKey(atomKey: string, weekOpenUtc: string, currency: string) {
  return `${atomKey}|${weekOpenUtc}|${currency}`;
}

function valuationMapKey(formulaId: string, alphaRowKey: string) {
  return `${formulaId}|${alphaRowKey}`;
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

function sideDecision(row: AlphaLedgerRow, side: Side, source: string, voteKey: string): Decision {
  const direction = directionFromSide(side);
  return { direction, direction_source: source, degraded: false, degraded_reasons: [], atom_votes: { [voteKey]: direction } };
}

function majorityVote(votes: Decision[], tieDirection: Direction, directionSource: string): Decision {
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

function compareAtomDirection(
  row: AlphaLedgerRow,
  atomKey: AtomKey,
  polarity: Polarity,
  atomsByKey: Map<string, CurrencyWeekAtomRow>,
): Decision {
  const base = row.instrument.base_currency;
  const quote = row.instrument.quote_currency;
  const degradedReasons: string[] = [];
  if (!base || !quote) {
    return { direction: "BASE_CURRENCY", direction_source: `${atomKey}_missing_instrument`, degraded: true, degraded_reasons: ["missing_base_or_quote"], atom_votes: { [atomKey]: "BASE_CURRENCY" } };
  }
  const baseAtom = atomsByKey.get(atomMapKey(atomKey, row.week.week_open_utc, base));
  const quoteAtom = atomsByKey.get(atomMapKey(atomKey, row.week.week_open_utc, quote));
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

function bprDecision(row: AlphaLedgerRow, bprByKey: Map<string, BprPairDirectionRow>, polarity: "source" | "fade" = "source"): Decision {
  const bpr = bprByKey.get(row.row_key);
  if (!bpr) {
    return { direction: "BASE_CURRENCY", direction_source: "bpr_missing", degraded: true, degraded_reasons: ["missing_bpr_pair_direction"], atom_votes: { bpr: "BASE_CURRENCY" } };
  }
  const sourceDirection = polarity === "source" ? bpr.bpr_source_direction : opposite(bpr.bpr_source_direction);
  const degradedReasons = [
    ...(bpr.pair_source_direction_eligible ? [] : ["bpr_pair_source_direction_ineligible"]),
    ...(bpr.promotion_eligible_pair_direction ? [] : ["bpr_pair_direction_promotion_ineligible"]),
    ...bpr.promotion_ineligible_reasons.map((reason) => `bpr:${reason}`),
  ];
  return {
    direction: sourceDirection,
    direction_source: polarity === "source" ? `bpr_${bpr.bpr_source_direction_rule}` : `fade_bpr_${bpr.bpr_source_direction_rule}`,
    degraded: degradedReasons.length > 0,
    degraded_reasons: degradedReasons,
    atom_votes: { bpr: sourceDirection },
  };
}

function valuationDecision(row: AlphaLedgerRow, formulaId: ValuationFormula, polarity: Polarity, valuationByKey: Map<string, ValuationPairRow>): Decision {
  const valuation = valuationByKey.get(valuationMapKey(formulaId, row.row_key));
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

function annualSummary(scored: ScoredRow[]) {
  const groups = new Map<number, ScoredRow[]>();
  for (const row of scored) groups.set(row.row.week.year, [...(groups.get(row.row.week.year) ?? []), row]);
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

function topWeekShare(scored: ScoredRow[]) {
  const byWeek = new Map<string, number>();
  for (const row of scored) byWeek.set(row.row.week.week_open_utc, (byWeek.get(row.row.week.week_open_utc) ?? 0) + row.adr_grid_adr);
  const rows = [...byWeek.entries()]
    .map(([week_open_utc, adr_grid_sum]) => ({ week_open_utc, adr_grid_sum: round(adr_grid_sum, 6) ?? 0 }))
    .sort((left, right) => Math.abs(right.adr_grid_sum) - Math.abs(left.adr_grid_sum));
  const totalAbs = rows.reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  const top5Abs = rows.slice(0, 5).reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  return { top5_abs_week_share: totalAbs > 0 ? round(top5Abs / totalAbs, 6) : null, top_abs_weeks: rows.slice(0, 10) };
}

function topPairShare(scored: ScoredRow[]) {
  const byPair = new Map<string, number>();
  for (const row of scored) byPair.set(row.row.instrument.symbol, (byPair.get(row.row.instrument.symbol) ?? 0) + row.adr_grid_adr);
  const rows = [...byPair.entries()]
    .map(([symbol, adr_grid_sum]) => ({ symbol, adr_grid_sum: round(adr_grid_sum, 6) ?? 0 }))
    .sort((left, right) => Math.abs(right.adr_grid_sum) - Math.abs(left.adr_grid_sum));
  const totalAbs = rows.reduce((total, row) => total + Math.abs(row.adr_grid_sum), 0);
  return { top_abs_pair: rows[0] ?? null, top_abs_pair_share: rows[0] && totalAbs > 0 ? round(Math.abs(rows[0].adr_grid_sum) / totalAbs, 6) : null };
}

function classifyCandidate(summary: Omit<CandidateSummary, "interpretation_bucket" | "content_hash">) {
  if (summary.forced28_row_count !== EXPECTED_ROWS || summary.duplicate_row_count !== 0 || summary.missing_outcome_rows !== 0) return "disqualified";
  if (summary.degraded_row_count > 0 || summary.negative_adr_grid_years > 2 || (summary.top_week_share.top5_abs_week_share ?? 0) >= 0.35 || (summary.top_pair_share.top_abs_pair_share ?? 0) >= 0.25) {
    return "fragile_or_governance_review";
  }
  if ((summary.adr_grid.adr_sum ?? 0) > 0 && (summary.adr_grid.row_pf ?? 0) > 1) return "promising_discovery_only";
  return "weak_or_negative";
}

function scoreCandidate(candidate: Candidate, alphaRows: AlphaLedgerRow[]): CandidateSummary {
  const scored = alphaRows.map((row) => {
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
    };
  });
  const weekShape = rowsPerWeek(alphaRows);
  const annual = annualSummary(scored);
  const base = {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    label: candidate.label,
    candidate_direction_kind: candidate.candidate_direction_kind,
    atom_keys: candidate.atom_keys,
    source_cells: candidate.source_cells,
    transform_version: candidate.transform_version,
    tie_rule: candidate.tie_rule,
    dependency_rule: candidate.dependency_rule,
    complexity: candidate.complexity,
    source_count: new Set(candidate.source_cells).size,
    forced28_row_count: scored.length,
    duplicate_row_count: duplicateCount(scored.map((row) => `${row.row.week.week_open_utc}|${row.row.instrument.symbol}`)),
    weeks: weekShape.weeks,
    full_weeks: weekShape.full_weeks,
    symbols_per_week_histogram: weekShape.histogram,
    selected_direction_counts: countBy(scored, (row) => row.direction),
    degraded_row_count: scored.filter((row) => row.degraded).length,
    degraded_reason_counts: countBy(scored.flatMap((row) => row.degraded_reasons), (reason) => reason),
    missing_outcome_rows: scored.filter((row) => !Number.isFinite(row.adr_grid_adr) || !Number.isFinite(row.weekly_hold_adr)).length,
    adr_grid: metric(scored, (row) => row.adr_grid_adr),
    weekly_hold: metric(scored, (row) => row.weekly_hold_adr),
    negative_adr_grid_years: annual.filter((row) => (row.adr_grid_adr ?? 0) < 0).length,
    worst_adr_grid_year:
      annual.length > 0
        ? [...annual].sort((left, right) => (left.adr_grid_adr ?? 0) - (right.adr_grid_adr ?? 0)).map((row) => ({ year: row.year, adr_grid_adr: row.adr_grid_adr, weekly_hold_adr: row.weekly_hold_adr }))[0]
        : null,
    annual_summary: annual,
    top_week_share: topWeekShare(scored),
    top_pair_share: topPairShare(scored),
    decision_signature_sha256: sha256Text(scored.map((row) => `${row.row.row_key}|${row.direction}`).sort().join("\n")),
  };
  const interpretationBucket = classifyCandidate(base);
  return { ...base, interpretation_bucket: interpretationBucket, content_hash: sha256Stable({ ...base, interpretation_bucket: interpretationBucket }) };
}

function buildCandidates(
  alphaRows: AlphaLedgerRow[],
  atomsByKey: Map<string, CurrencyWeekAtomRow>,
  bprByKey: Map<string, BprPairDirectionRow>,
  valuationByKey: Map<string, ValuationPairRow>,
) {
  const cot = (row: AlphaLedgerRow) => sideDecision(row, row.cot_atoms.side, "cot_side", "cot_side");
  const strength = (row: AlphaLedgerRow) => sideDecision(row, row.strength_atoms.gate57e_side, "strength_gate57e_side", "strength_gate57e_side");
  const alpha = (row: AlphaLedgerRow) => sideDecision(row, row.arbitration.final_side, "alpha_v1_final_side", "alpha_v1_final_side");
  const rrpInverse = (row: AlphaLedgerRow) => compareAtomDirection(row, "rrp_derived", "inverse", atomsByKey);
  const rrpNatural = (row: AlphaLedgerRow) => compareAtomDirection(row, "rrp_derived", "natural", atomsByKey);
  const pppInverse = (row: AlphaLedgerRow) => compareAtomDirection(row, "ppp", "inverse", atomsByKey);
  const neerInverse = (row: AlphaLedgerRow) => compareAtomDirection(row, "neer", "inverse", atomsByKey);
  const reerInverse = (row: AlphaLedgerRow) => compareAtomDirection(row, "reer", "inverse", atomsByKey);
  const vg = (formula: ValuationFormula, polarity: Polarity) => (row: AlphaLedgerRow) => valuationDecision(row, formula, polarity, valuationByKey);
  const valuationRowsByFormula = new Map<ValuationFormula, ValuationPairRow[]>();
  for (const formula of VALUATION_FORMULAS) valuationRowsByFormula.set(formula, [...valuationByKey.values()].filter((row) => row.formula_id === formula));
  const tierBreaks = new Map<ValuationFormula, number[]>(
    VALUATION_FORMULAS.map((formula) => [
      formula,
      quantileBreaks(
        (valuationRowsByFormula.get(formula) ?? []).map((row) => Math.abs(row.spread_base_minus_quote)),
        3,
      ),
    ]),
  );
  const isValuationExtreme = (row: AlphaLedgerRow, formula: ValuationFormula) => {
    const valuation = valuationByKey.get(valuationMapKey(formula, row.row_key));
    if (!valuation) return false;
    return bucketByBreaks(Math.abs(valuation.spread_base_minus_quote), tierBreaks.get(formula) ?? [], ["weak", "middle", "extreme"]) === "extreme";
  };
  const cotExtremeBreak = quantileBreaks(alphaRows.flatMap((row) => (typeof row.cot_atoms.abs_tei_spread === "number" ? [row.cot_atoms.abs_tei_spread] : [])), 5)[3] ?? 0;
  const candidate = (
    candidate_id: string,
    family: string,
    label: string,
    atom_keys: string[],
    source_cells: string[],
    complexity: number,
    dependency_rule: string,
    directionFor: (row: AlphaLedgerRow) => Decision,
  ): Candidate => ({
    candidate_id,
    family,
    label,
    candidate_direction_kind: source_cells.length > 1 || family.includes("composite") || family.includes("dependency") ? "candidate_composite_direction" : "candidate_atom_direction",
    atom_keys,
    source_cells,
    transform_version: `gate64c_${candidate_id}_v1`,
    tie_rule: "predeclared simple majority or explicit fallback, no optimized threshold",
    dependency_rule,
    complexity,
    directionFor,
  });

  return [
    candidate("gate63_alpha_v1_frozen_final_side", "gate63_continuity", "Gate 63 Alpha v1 baseline", ["alpha_v1_final_side"], ["alpha_v1"], 1, "follow frozen Alpha v1", alpha),
    candidate("gate63_rrp_derived_inverse", "gate63_continuity", "Gate 63 RRP inverse reference", ["rrp_derived"], ["regime"], 1, "follow RRP inverse", rrpInverse),
    candidate("gate63_cot_strength_rrp_inverse_majority", "gate63_continuity", "Gate 63 COT + Strength + RRP inverse majority", ["cot_side", "strength_gate57e_side", "rrp_derived"], ["cot", "strength", "regime"], 3, "three-vote majority", (row) =>
      majorityVote([cot(row), strength(row), rrpInverse(row)], rrpInverse(row).direction, "cot_strength_rrp_inverse_majority"),
    ),
    candidate("bpr_follow_source_direction", "follow_fade", "Follow BPR source direction", ["bpr"], ["regime"], 1, "follow BPR source direction with degraded rows explicit", (row) => bprDecision(row, bprByKey, "source")),
    candidate("bpr_fade_source_direction", "follow_fade", "Fade BPR source direction", ["bpr"], ["regime"], 1, "fade BPR source direction with degraded rows explicit", (row) => bprDecision(row, bprByKey, "fade")),
    candidate("rrp_derived_natural", "follow_fade", "Follow RRP natural", ["rrp_derived"], ["regime"], 1, "follow RRP natural polarity", rrpNatural),
    candidate("valuation_gap_reer_deviation_natural", "valuation_gap_single", "Valuation gap REER deviation natural", ["valuation_gap_reer_deviation"], ["regime"], 1, "follow valuation gap natural polarity", vg("valuation_gap_reer_deviation", "natural")),
    candidate("valuation_gap_reer_deviation_inverse", "valuation_gap_single", "Valuation gap REER deviation inverse", ["valuation_gap_reer_deviation"], ["regime"], 1, "fade valuation gap via inverse polarity", vg("valuation_gap_reer_deviation", "inverse")),
    candidate("valuation_gap_neer_reer_relative_natural", "valuation_gap_single", "Valuation gap NEER/REER relative natural", ["valuation_gap_neer_reer_relative"], ["regime"], 1, "follow valuation gap natural polarity", vg("valuation_gap_neer_reer_relative", "natural")),
    candidate("valuation_gap_neer_reer_relative_inverse", "valuation_gap_single", "Valuation gap NEER/REER relative inverse", ["valuation_gap_neer_reer_relative"], ["regime"], 1, "fade valuation gap via inverse polarity", vg("valuation_gap_neer_reer_relative", "inverse")),
    candidate("valuation_gap_reer_inverse_extreme_else_rrp_inverse", "valuation_gap_tiered", "Use valuation REER inverse on extreme valuation spreads else RRP inverse", ["valuation_gap_reer_deviation", "rrp_derived"], ["regime"], 2, "valuation gap as fixed tier context flag", (row) =>
      isValuationExtreme(row, "valuation_gap_reer_deviation") ? vg("valuation_gap_reer_deviation", "inverse")(row) : rrpInverse(row),
    ),
    candidate("valuation_gap_relative_inverse_extreme_else_rrp_inverse", "valuation_gap_tiered", "Use valuation relative inverse on extreme valuation spreads else RRP inverse", ["valuation_gap_neer_reer_relative", "rrp_derived"], ["regime"], 2, "valuation gap as fixed tier context flag", (row) =>
      isValuationExtreme(row, "valuation_gap_neer_reer_relative") ? vg("valuation_gap_neer_reer_relative", "inverse")(row) : rrpInverse(row),
    ),
    candidate("cot_strength_tie_breaker_valuation_reer_inverse", "valuation_gap_tie_breaker", "Use valuation REER inverse when COT and Strength disagree", ["cot_side", "strength_gate57e_side", "valuation_gap_reer_deviation"], ["cot", "strength", "regime"], 3, "valuation gap as tie-breaker", (row) =>
      cot(row).direction === strength(row).direction ? cot(row) : vg("valuation_gap_reer_deviation", "inverse")(row),
    ),
    candidate("cot_strength_tie_breaker_valuation_relative_inverse", "valuation_gap_tie_breaker", "Use valuation relative inverse when COT and Strength disagree", ["cot_side", "strength_gate57e_side", "valuation_gap_neer_reer_relative"], ["cot", "strength", "regime"], 3, "valuation gap as tie-breaker", (row) =>
      cot(row).direction === strength(row).direction ? cot(row) : vg("valuation_gap_neer_reer_relative", "inverse")(row),
    ),
    candidate("rrp_inverse_when_agrees_valuation_reer_else_alpha", "atom_dependency", "Use RRP inverse only when it agrees with valuation REER inverse else Alpha", ["rrp_derived", "valuation_gap_reer_deviation", "alpha_v1_final_side"], ["alpha_v1", "regime"], 3, "RRP depends on valuation confirmation", (row) =>
      rrpInverse(row).direction === vg("valuation_gap_reer_deviation", "inverse")(row).direction ? rrpInverse(row) : alpha(row),
    ),
    candidate("rrp_inverse_when_disagrees_valuation_reer_else_valuation", "atom_dependency", "Use RRP inverse only when it contradicts valuation REER inverse else valuation", ["rrp_derived", "valuation_gap_reer_deviation"], ["regime"], 2, "RRP contradiction diagnostic", (row) =>
      rrpInverse(row).direction !== vg("valuation_gap_reer_deviation", "inverse")(row).direction ? rrpInverse(row) : vg("valuation_gap_reer_deviation", "inverse")(row),
    ),
    candidate("bpr_when_agrees_valuation_reer_else_rrp", "atom_dependency", "Use BPR only when it agrees with valuation REER inverse else RRP", ["bpr", "valuation_gap_reer_deviation", "rrp_derived"], ["regime"], 3, "BPR depends on valuation confirmation", (row) =>
      bprDecision(row, bprByKey).direction === vg("valuation_gap_reer_deviation", "inverse")(row).direction ? bprDecision(row, bprByKey) : rrpInverse(row),
    ),
    candidate("cot_when_agrees_valuation_reer_else_rrp", "atom_dependency", "Use COT only when it agrees with valuation REER inverse else RRP", ["cot_side", "valuation_gap_reer_deviation", "rrp_derived"], ["cot", "regime"], 3, "COT depends on valuation confirmation", (row) =>
      cot(row).direction === vg("valuation_gap_reer_deviation", "inverse")(row).direction ? cot(row) : rrpInverse(row),
    ),
    candidate("strength_when_agrees_valuation_reer_else_rrp", "atom_dependency", "Use Strength only when it agrees with valuation REER inverse else RRP", ["strength_gate57e_side", "valuation_gap_reer_deviation", "rrp_derived"], ["strength", "regime"], 3, "Strength depends on valuation confirmation", (row) =>
      strength(row).direction === vg("valuation_gap_reer_deviation", "inverse")(row).direction ? strength(row) : rrpInverse(row),
    ),
    candidate("cot_strength_rrp_valuation_reer_majority", "cross_cell_composite", "COT + Strength + RRP inverse + valuation REER inverse majority", ["cot_side", "strength_gate57e_side", "rrp_derived", "valuation_gap_reer_deviation"], ["cot", "strength", "regime"], 4, "four-vote majority, tie to RRP inverse", (row) =>
      majorityVote([cot(row), strength(row), rrpInverse(row), vg("valuation_gap_reer_deviation", "inverse")(row)], rrpInverse(row).direction, "cot_strength_rrp_valuation_reer_majority"),
    ),
    candidate("cot_strength_rrp_valuation_relative_majority", "cross_cell_composite", "COT + Strength + RRP inverse + valuation relative inverse majority", ["cot_side", "strength_gate57e_side", "rrp_derived", "valuation_gap_neer_reer_relative"], ["cot", "strength", "regime"], 4, "four-vote majority, tie to RRP inverse", (row) =>
      majorityVote([cot(row), strength(row), rrpInverse(row), vg("valuation_gap_neer_reer_relative", "inverse")(row)], rrpInverse(row).direction, "cot_strength_rrp_valuation_relative_majority"),
    ),
    candidate("cot_strength_regime_valuation_bundle_reer", "cross_cell_composite", "COT + Strength + RRP/PPP/NEER/REER + valuation REER inverse bundle", ["cot_side", "strength_gate57e_side", "rrp_derived", "ppp", "neer", "reer", "valuation_gap_reer_deviation"], ["cot", "strength", "regime"], 7, "seven-vote valuation bundle majority", (row) =>
      majorityVote([cot(row), strength(row), rrpInverse(row), pppInverse(row), neerInverse(row), reerInverse(row), vg("valuation_gap_reer_deviation", "inverse")(row)], rrpInverse(row).direction, "cot_strength_regime_valuation_bundle_reer"),
    ),
    candidate("cot_extreme_follow_else_alpha", "follow_fade", "Follow COT only at top-quintile COT spread else Alpha", ["cot_side", "cot_abs_tei_spread"], ["cot", "alpha_v1"], 2, "COT extreme context flag", (row) =>
      typeof row.cot_atoms.abs_tei_spread === "number" && row.cot_atoms.abs_tei_spread >= cotExtremeBreak ? cot(row) : alpha(row),
    ),
    candidate("cot_extreme_fade_else_alpha", "follow_fade", "Fade COT only at top-quintile COT spread else Alpha", ["cot_side", "cot_abs_tei_spread"], ["cot", "alpha_v1"], 2, "COT extreme fade context flag", (row) => {
      if (typeof row.cot_atoms.abs_tei_spread === "number" && row.cot_atoms.abs_tei_spread >= cotExtremeBreak) {
        const cotSide = cot(row);
        return { ...cotSide, direction: opposite(cotSide.direction), direction_source: "fade_cot_extreme", atom_votes: { cot_extreme_fade: opposite(cotSide.direction) } };
      }
      return alpha(row);
    }),
    candidate("strength_persistent_follow_else_alpha", "follow_fade", "Follow Strength when phase is persistent else Alpha", ["strength_gate57e_side", "strength_phase_bucket"], ["strength", "alpha_v1"], 2, "Strength persistent state context flag", (row) => (row.strength_atoms.phase_bucket === "persistent" ? strength(row) : alpha(row))),
    candidate("strength_persistent_fade_else_alpha", "follow_fade", "Fade Strength when phase is persistent else Alpha", ["strength_gate57e_side", "strength_phase_bucket"], ["strength", "alpha_v1"], 2, "Strength persistent state fade context flag", (row) => {
      if (row.strength_atoms.phase_bucket === "persistent") {
        const strengthSide = strength(row);
        return { ...strengthSide, direction: opposite(strengthSide.direction), direction_source: "fade_strength_persistent", atom_votes: { strength_persistent_fade: opposite(strengthSide.direction) } };
      }
      return alpha(row);
    }),
  ];
}

function rankRows(rows: CandidateSummary[]) {
  const balancedScore = (row: CandidateSummary) => (row.adr_grid.r_over_drawdown ?? -999) + (row.weekly_hold.r_over_drawdown ?? -999);
  return {
    best_by_adr_grid_r_over_drawdown: [...rows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)).slice(0, 20),
    best_by_adr_grid_total: [...rows].sort((left, right) => (right.adr_grid.adr_sum ?? -999) - (left.adr_grid.adr_sum ?? -999)).slice(0, 20),
    best_by_weekly_hold_r_over_drawdown: [...rows].sort((left, right) => (right.weekly_hold.r_over_drawdown ?? -999) - (left.weekly_hold.r_over_drawdown ?? -999)).slice(0, 20),
    best_balanced: [...rows].sort((left, right) => balancedScore(right) - balancedScore(left)).slice(0, 20),
    best_low_degradation: [...rows].sort((left, right) => left.degraded_row_count - right.degraded_row_count || (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)).slice(0, 20),
    best_valuation_gap_enhanced: [...rows].filter((row) => row.atom_keys.some((atom) => atom.startsWith("valuation_gap"))).sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)).slice(0, 20),
  };
}

function compact(row: CandidateSummary) {
  return {
    candidate_id: row.candidate_id,
    family: row.family,
    interpretation_bucket: row.interpretation_bucket,
    adr_grid: row.adr_grid,
    weekly_hold: row.weekly_hold,
    degraded_row_count: row.degraded_row_count,
    negative_adr_grid_years: row.negative_adr_grid_years,
    worst_adr_grid_year: row.worst_adr_grid_year,
    complexity: row.complexity,
  };
}

function buildYearDiagnostics(candidateRows: CandidateSummary[]) {
  const top20 = [...candidateRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999)).slice(0, 20);
  const valuation = candidateRows.filter((row) => row.atom_keys.some((atom) => atom.startsWith("valuation_gap")));
  const ids = [...new Set([...top20, ...valuation].map((row) => row.candidate_id))];
  return {
    diagnostic_only: true,
    selection_rule: "top 20 by ADR Grid R/DD plus every valuation-gap candidate",
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

function buildDiagnostics(alphaRows: AlphaLedgerRow[], bprByKey: Map<string, BprPairDirectionRow>, valuationByKey: Map<string, ValuationPairRow>, candidateRows: CandidateSummary[]) {
  const cotDirection = (row: AlphaLedgerRow) => directionFromSide(row.cot_atoms.side);
  const strengthDirection = (row: AlphaLedgerRow) => directionFromSide(row.strength_atoms.gate57e_side);
  const formulaDiagnostics = Object.fromEntries(
    VALUATION_FORMULAS.map((formula) => {
      const rows = [...valuationByKey.values()].filter((row) => row.formula_id === formula);
      const breaks = quantileBreaks(rows.map((row) => Math.abs(row.spread_base_minus_quote)), 3);
      const inverseDirection = (row: AlphaLedgerRow) => valuationByKey.get(valuationMapKey(formula, row.row_key))?.inverse_direction ?? "BASE_CURRENCY";
      return [
        formula,
        {
          pair_rows: rows.length,
          inverse_direction_counts: countBy(rows, (row) => row.inverse_direction),
          natural_direction_counts: countBy(rows, (row) => row.natural_direction),
          spread_tier3_breaks: breaks.map((value) => round(value, 6)),
          agrees_with_cot: alphaRows.filter((row) => inverseDirection(row) === cotDirection(row)).length,
          agrees_with_strength: alphaRows.filter((row) => inverseDirection(row) === strengthDirection(row)).length,
          agrees_with_bpr: alphaRows.filter((row) => inverseDirection(row) === (bprByKey.get(row.row_key)?.bpr_source_direction ?? "BASE_CURRENCY")).length,
        },
      ];
    }),
  );
  return {
    valuationGapDiagnostics: { diagnostic_only: true, formulas: formulaDiagnostics },
    atomDependencyDiagnostics: {
      diagnostic_only: true,
      dependency_candidate_count: candidateRows.filter((row) => row.family.includes("dependency") || row.family.includes("tie_breaker") || row.family.includes("tiered")).length,
      best_dependency_candidates: candidateRows
        .filter((row) => row.family.includes("dependency") || row.family.includes("tie_breaker") || row.family.includes("tiered"))
        .sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))
        .slice(0, 15)
        .map(compact),
    },
    qualityDiagnostics: {
      diagnostic_only: true,
      bpr_quality_counts: {
        base: countBy([...bprByKey.values()], (row) => row.base_source_quality),
        quote: countBy([...bprByKey.values()], (row) => row.quote_source_quality),
        promotion_eligible_rows: [...bprByKey.values()].filter((row) => row.promotion_eligible_pair_direction).length,
        promotion_ineligible_rows: [...bprByKey.values()].filter((row) => !row.promotion_eligible_pair_direction).length,
      },
      candidate_degradation: candidateRows.map((row) => ({
        candidate_id: row.candidate_id,
        degraded_row_count: row.degraded_row_count,
        top_degraded_reasons: Object.fromEntries(Object.entries(row.degraded_reason_counts).slice(0, 8)),
      })),
    },
  };
}

function renderBestCandidates(ranking: ReturnType<typeof rankRows>) {
  const sections: Array<[string, CandidateSummary[]]> = [
    ["Best ADR Grid R/DD", ranking.best_by_adr_grid_r_over_drawdown],
    ["Best ADR Grid Total", ranking.best_by_adr_grid_total],
    ["Best Weekly Hold R/DD", ranking.best_by_weekly_hold_r_over_drawdown],
    ["Best Balanced", ranking.best_balanced],
    ["Best Low-Degradation", ranking.best_low_degradation],
    ["Best Valuation-Gap Enhanced", ranking.best_valuation_gap_enhanced],
  ];
  const lines = ["# Gate 64C Best Candidates", "", "Discovery-only ranking. No Alpha v2, Body, risk, execution, or app/runtime promotion.", ""];
  for (const [title, rows] of sections) {
    lines.push(`## ${title}`, "", "| Rank | Candidate | Family | ADR Grid | DD | R/DD | PF | Weekly Hold | WH R/DD | Degraded | Negative Years |", "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
    rows.slice(0, 12).forEach((row, index) => {
      lines.push(`| ${index + 1} | ${row.candidate_id} | ${row.family} | ${row.adr_grid.adr_sum} | ${row.adr_grid.max_drawdown} | ${row.adr_grid.r_over_drawdown} | ${row.adr_grid.row_pf} | ${row.weekly_hold.adr_sum} | ${row.weekly_hold.r_over_drawdown} | ${row.degraded_row_count} | ${row.negative_adr_grid_years} |`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

function renderReport(summary: Record<string, unknown>, ranking: ReturnType<typeof rankRows>) {
  const rows = ranking.best_by_adr_grid_r_over_drawdown.slice(0, 16);
  return [
    "# Gate 64C Full Atom Matrix Refresh",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Boundary",
    "",
    "- Full atom matrix refresh with Gate 64A audit and Gate 64B valuation-gap atoms included.",
    "- Dependency-style interactions are predeclared and small: follow, fade, confirm, contradict, quality/tier context, and tie-breaker.",
    "- No final Body algorithm, Alpha v2 lock, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT/Strength retuning, optimized thresholds, pair exclusions, or date exclusions.",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(summary.denominator, null, 2),
    "```",
    "",
    "## Top Candidates By ADR Grid R/DD",
    "",
    "| Rank | Candidate | Family | ADR Grid | DD | R/DD | Weekly Hold | Degraded | Negative Years |",
    "|---:|---|---|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row, index) => `| ${index + 1} | ${row.candidate_id} | ${row.family} | ${row.adr_grid.adr_sum} | ${row.adr_grid.max_drawdown} | ${row.adr_grid.r_over_drawdown} | ${row.weekly_hold.adr_sum} | ${row.degraded_row_count} | ${row.negative_adr_grid_years} |`),
    "",
    "## Gate 63 Comparison",
    "",
    "```json",
    JSON.stringify(summary.gate63_comparison, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Candidate contracts: \`${summary.artifacts.candidateContracts}\``,
    `- Matrix rows: \`${summary.artifacts.matrixRows}\``,
    `- Summary JSON: \`${summary.artifacts.summaryJson}\``,
    `- Best candidates: \`${summary.artifacts.bestCandidates}\``,
    `- Year diagnostics: \`${summary.artifacts.yearDiagnostics}\``,
    `- Valuation-gap diagnostics: \`${summary.artifacts.valuationGapDiagnostics}\``,
    `- Atom dependency diagnostics: \`${summary.artifacts.atomDependencyDiagnostics}\``,
    `- Quality diagnostics: \`${summary.artifacts.qualityDiagnostics}\``,
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
  const gate63SummaryPath = path.join(options.gate63Dir, "gate63-universal-atom-matrix.summary.json");
  const gate64aSummaryPath = path.join(options.gate64aDir, "gate64a-silent-missing-atom-audit.summary.json");
  const gate64bSummaryPath = path.join(options.gate64bDir, "gate64b-valuation-gap-atom-lock.summary.json");
  const valuationPairPath = path.join(options.gate64bDir, "valuation-gap-pair-atom-ledger.rows.jsonl");
  const currencyAtomRows = await readJsonl<CurrencyWeekAtomRow>(currencyAtomPath);
  const bprRows = await readJsonl<BprPairDirectionRow>(bprPairPath);
  const valuationRows = await readJsonl<ValuationPairRow>(valuationPairPath);
  const gate63Summary = await readJson<Record<string, unknown>>(gate63SummaryPath);
  const gate64aSummary = await readJson<Record<string, unknown>>(gate64aSummaryPath);
  const gate64bSummary = await readJson<Record<string, unknown>>(gate64bSummaryPath);
  if (!String(gate64aSummary.verdict).startsWith("PASS_")) throw new Error(`Gate 64A did not pass: ${gate64aSummary.verdict}`);
  if (!String(gate64bSummary.verdict).startsWith("PASS_")) throw new Error(`Gate 64B did not pass: ${gate64bSummary.verdict}`);

  const atomsByKey = new Map(currencyAtomRows.map((row) => [atomMapKey(row.atom_key, row.alpha_week_open_utc, row.currency), row]));
  const bprByKey = new Map(bprRows.map((row) => [row.row_key, row]));
  const valuationByKey = new Map(valuationRows.map((row) => [valuationMapKey(row.formula_id, row.alpha_row_key), row]));
  const candidates = buildCandidates(alphaRows, atomsByKey, bprByKey, valuationByKey);
  const candidateRows = candidates.map((candidate) => scoreCandidate(candidate, alphaRows));
  const ranking = rankRows(candidateRows);
  const diagnostics = buildDiagnostics(alphaRows, bprByKey, valuationByKey, candidateRows);
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
    bpr_pair_direction_rows: bprRows.length,
    valuation_gap_pair_rows: valuationRows.length,
    candidate_count: candidateRows.length,
    disqualified_candidates: candidateRows.filter((row) => row.interpretation_bucket === "disqualified").length,
    source_mutation_rows: bprRows.filter((row) => row.source_rows_mutated).length,
    body_algorithm_started: false,
    alpha_v2_started: false,
  };
  const pass =
    denominator.alpha_rows === EXPECTED_ROWS &&
    denominator.alpha_weeks === EXPECTED_WEEKS &&
    denominator.full_weeks === EXPECTED_WEEKS &&
    denominator.duplicate_week_symbol_rows === 0 &&
    denominator.bpr_pair_direction_rows === EXPECTED_ROWS &&
    denominator.valuation_gap_pair_rows === VALUATION_FORMULAS.length * EXPECTED_ROWS &&
    denominator.disqualified_candidates === 0 &&
    denominator.source_mutation_rows === 0;
  const gate63Best = ((gate63Summary.ranking_views as Record<string, unknown>)?.best_by_adr_grid_r_over_drawdown as Array<Record<string, unknown>> | undefined)?.[0];
  const best64 = ranking.best_by_adr_grid_r_over_drawdown[0];
  const bestValuation = ranking.best_valuation_gap_enhanced[0];

  const artifactPaths = {
    candidateContracts: toRepoRelative(path.join(artifactDir, "gate64c-candidate-contracts.json")),
    matrixRows: toRepoRelative(path.join(artifactDir, "gate64c-matrix.rows.jsonl")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate64c-summary.json")),
    bestCandidates: toRepoRelative(path.join(artifactDir, "gate64c-best-candidates.md")),
    yearDiagnostics: toRepoRelative(path.join(artifactDir, "gate64c-year-by-year-diagnostics.json")),
    valuationGapDiagnostics: toRepoRelative(path.join(artifactDir, "gate64c-valuation-gap-diagnostics.json")),
    atomDependencyDiagnostics: toRepoRelative(path.join(artifactDir, "gate64c-atom-dependency-diagnostics.json")),
    qualityDiagnostics: toRepoRelative(path.join(artifactDir, "gate64c-quality-diagnostics.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate64c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_FULL_ATOM_MATRIX_REFRESH__VALUATION_GAP_INCLUDED__DISCOVERY_ONLY_NO_BODY" : "FAIL_FULL_ATOM_MATRIX_REFRESH",
    denominator,
    ranking_views: Object.fromEntries(Object.entries(ranking).map(([key, rows]) => [key, rows.slice(0, 10).map(compact)])),
    gate63_comparison: {
      gate63_best_by_adr_grid_r_over_drawdown: gate63Best ?? null,
      gate64c_best_by_adr_grid_r_over_drawdown: best64 ? compact(best64) : null,
      gate64c_best_valuation_gap_enhanced: bestValuation ? compact(bestValuation) : null,
      interpretation: "Gate 64C is discovery-only; comparison does not promote Alpha v2 or Body logic.",
    },
    input_hashes: {
      gate59_alpha_ledger: await fileHash(options.alphaLedgerPath),
      gate60c_currency_atom_ledger: await fileHash(currencyAtomPath),
      gate60g_bpr_pair_direction_ledger: await fileHash(bprPairPath),
      gate63_summary: await fileHash(gate63SummaryPath),
      gate64a_summary: await fileHash(gate64aSummaryPath),
      gate64b_summary: await fileHash(gate64bSummaryPath),
      gate64b_valuation_pair_ledger: await fileHash(valuationPairPath),
    },
    stop_line:
      "Stop after Gate 64C. Do not proceed to Body design, Alpha v2, exit-layer research, risk, execution, MT5/live, app/runtime, source mutation, COT retuning, Strength retuning, or broad Brain source consolidation.",
    artifacts: artifactPaths,
  };

  const candidateContractsPath = path.join(artifactDir, "gate64c-candidate-contracts.json");
  const matrixRowsPath = path.join(artifactDir, "gate64c-matrix.rows.jsonl");
  const summaryPath = path.join(artifactDir, "gate64c-summary.json");
  const bestCandidatesPath = path.join(artifactDir, "gate64c-best-candidates.md");
  const yearDiagnosticsPath = path.join(artifactDir, "gate64c-year-by-year-diagnostics.json");
  const valuationGapDiagnosticsPath = path.join(artifactDir, "gate64c-valuation-gap-diagnostics.json");
  const atomDependencyDiagnosticsPath = path.join(artifactDir, "gate64c-atom-dependency-diagnostics.json");
  const qualityDiagnosticsPath = path.join(artifactDir, "gate64c-quality-diagnostics.json");
  const shaPath = path.join(artifactDir, "gate64c-sha256.txt");

  await writeFile(
    candidateContractsPath,
    `${JSON.stringify(
      {
        gate_id: GATE_ID,
        brain_architecture: BRAIN_ARCHITECTURE,
        atom_inventory: flattenBrainAtomInventory(),
        candidate_contracts: candidates.map((candidate) => ({
          candidate_id: candidate.candidate_id,
          family: candidate.family,
          label: candidate.label,
          candidate_direction_kind: candidate.candidate_direction_kind,
          atom_keys: candidate.atom_keys,
          source_cells: candidate.source_cells,
          transform_version: candidate.transform_version,
          tie_rule: candidate.tie_rule,
          dependency_rule: candidate.dependency_rule,
          complexity: candidate.complexity,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(matrixRowsPath, `${candidateRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(bestCandidatesPath, renderBestCandidates(ranking), "utf8");
  await writeFile(yearDiagnosticsPath, `${JSON.stringify(yearDiagnostics, null, 2)}\n`, "utf8");
  await writeFile(valuationGapDiagnosticsPath, `${JSON.stringify(diagnostics.valuationGapDiagnostics, null, 2)}\n`, "utf8");
  await writeFile(atomDependencyDiagnosticsPath, `${JSON.stringify(diagnostics.atomDependencyDiagnostics, null, 2)}\n`, "utf8");
  await writeFile(qualityDiagnosticsPath, `${JSON.stringify(diagnostics.qualityDiagnostics, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(summary, ranking), "utf8");

  const contentInvariant = sha256Stable({
    denominator,
    candidate_hashes: candidateRows.map((row) => row.content_hash),
    valuation_gap_diagnostics_hash: sha256Stable(diagnostics.valuationGapDiagnostics),
    dependency_diagnostics_hash: sha256Stable(diagnostics.atomDependencyDiagnostics),
    year_diagnostics_hash: sha256Stable(yearDiagnostics),
    input_hashes: summary.input_hashes,
  });
  const shaLines = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${summary.generated_at}`,
    `git_commit ${summary.git_commit}`,
    `verdict ${summary.verdict}`,
    `candidate_contracts ${await fileHash(candidateContractsPath)} ${toRepoRelative(candidateContractsPath)}`,
    `matrix_rows ${await fileHash(matrixRowsPath)} ${toRepoRelative(matrixRowsPath)}`,
    `summary_json ${await fileHash(summaryPath)} ${toRepoRelative(summaryPath)}`,
    `best_candidates ${await fileHash(bestCandidatesPath)} ${toRepoRelative(bestCandidatesPath)}`,
    `year_diagnostics ${await fileHash(yearDiagnosticsPath)} ${toRepoRelative(yearDiagnosticsPath)}`,
    `valuation_gap_diagnostics ${await fileHash(valuationGapDiagnosticsPath)} ${toRepoRelative(valuationGapDiagnosticsPath)}`,
    `atom_dependency_diagnostics ${await fileHash(atomDependencyDiagnosticsPath)} ${toRepoRelative(atomDependencyDiagnosticsPath)}`,
    `quality_diagnostics ${await fileHash(qualityDiagnosticsPath)} ${toRepoRelative(qualityDiagnosticsPath)}`,
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
  console.log(`Best by ADR Grid R/DD: ${best64?.candidate_id}`);
  console.log(`Best valuation-gap enhanced: ${bestValuation?.candidate_id}`);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
  console.log(`SHA identity: ${toRepoRelative(shaPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
