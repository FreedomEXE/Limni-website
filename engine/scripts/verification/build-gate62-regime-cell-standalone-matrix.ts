import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { REGIME_CELL_ATOMS } from "@engine/brain/architecture";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 62: regime-cell-standalone-matrix";
const COMMAND = "npm run engine:gate62:regime-cell-standalone-matrix";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_GATE60C_DIR = "docs/research/gates/gate60c/artifacts/gate60c-regime-source-atom-fill";
const DEFAULT_GATE60G_DIR = "docs/research/gates/gate60g/artifacts/gate60g-bpr-forced28-source-direction-ledger";
const DEFAULT_GATE60H_DIR = "docs/research/gates/gate60h/artifacts/gate60h-bpr-source-direction-eligibility-classes";
const DEFAULT_GATE61B_DIR = "docs/research/gates/gate61b/artifacts/gate61b-universal-cell-atom-readiness";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix";
const DEFAULT_REPORT_PATH =
  "docs/research/gates/gate62/GATE62_REGIME_CELL_STANDALONE_MATRIX_2026-06-27.md";

const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const CURRENCY_TIE_RANK = new Map(["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"].map((currency, index) => [currency, index]));

type Direction = "BASE_CURRENCY" | "QUOTE_CURRENCY";
type Side = "LONG" | "SHORT";
type Polarity = "natural" | "inverse";
type AtomKey = "nominal_rate_3m" | "cpi_inflation_yoy" | "rrp_derived" | "ppp" | "neer" | "reer";

type CliOptions = {
  alphaLedgerPath: string;
  gate60cDir: string;
  gate60gDir: string;
  gate60hDir: string;
  gate61bDir: string;
  artifactDir: string;
  reportPath: string;
};

type AlphaLedgerRow = {
  row_key: string;
  week: { week_open_utc: string; year: number; quarter: string };
  instrument: { symbol: string; base_currency: string | null; quote_currency: string | null };
  outcomes: {
    adr_grid: { long: number; short: number };
    weekly_hold: { long: number; short: number };
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
  transform_version: string;
  atom_keys: string[];
  polarity: Polarity | "bpr_source";
  tie_rule: string;
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
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    alphaLedgerPath: DEFAULT_ALPHA_LEDGER_PATH,
    gate60cDir: DEFAULT_GATE60C_DIR,
    gate60gDir: DEFAULT_GATE60G_DIR,
    gate60hDir: DEFAULT_GATE60H_DIR,
    gate61bDir: DEFAULT_GATE61B_DIR,
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

function directionFromSide(side: Side, row: AlphaLedgerRow) {
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

function metric(scored: ScoredRow[], getValue: (row: ScoredRow) => number) {
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

function classifyCandidate(summary: Record<string, unknown>) {
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

function buildCandidates(
  atomsByKey: Map<string, CurrencyWeekAtomRow>,
  bprByKey: Map<string, BprPairDirectionRow>,
): Candidate[] {
  const atomCandidate = (candidateId: string, family: string, label: string, atomKey: AtomKey, polarity: Polarity): Candidate => ({
    candidate_id: candidateId,
    family,
    label,
    transform_version: `gate62_${atomKey}_${polarity}_base_minus_quote_v1`,
    atom_keys: [atomKey],
    polarity,
    tie_rule: "equal numeric spread uses deterministic currency rank AUD,CAD,CHF,EUR,GBP,JPY,NZD,USD",
    directionFor: (row) => compareAtomDirection(row, atomKey, polarity, atomsByKey),
  });
  const bundleCandidate = (
    candidateId: string,
    family: string,
    label: string,
    atomKeys: AtomKey[],
    polarity: Polarity,
    includeBpr: boolean,
  ): Candidate => ({
    candidate_id: candidateId,
    family,
    label,
    transform_version: `gate62_${candidateId}_${polarity}_simple_majority_v1`,
    atom_keys: includeBpr ? ["bpr", ...atomKeys] : atomKeys,
    polarity,
    tie_rule: includeBpr ? "simple majority; ties resolve to BPR source direction" : "simple majority; no tie expected for odd atom count",
    directionFor: (row) => {
      const bpr = includeBpr ? bprDirection(row, bprByKey) : null;
      const atomVotes = atomKeys.map((atomKey) => compareAtomDirection(row, atomKey, polarity, atomsByKey));
      const fallback = bpr?.direction ?? atomVotes[0]?.direction ?? "BASE_CURRENCY";
      return majorityVote([...(bpr ? [bpr] : []), ...atomVotes], fallback, `${candidateId}_${polarity}_majority`);
    },
  });

  const candidates: Candidate[] = [
    {
      candidate_id: "bpr_only_forced28_source_direction",
      family: "bpr_only",
      label: "BPR-only forced-28 source direction",
      transform_version: "gate60g_bpr_forced28_source_direction_policy_v1",
      atom_keys: ["bpr"],
      polarity: "bpr_source",
      tie_rule: "Gate 60G deterministic forced-28 BPR source-direction policy",
      directionFor: (row) => bprDirection(row, bprByKey),
    },
    atomCandidate("rates_nominal_rate_3m_natural", "rates_only", "Rates-only natural polarity", "nominal_rate_3m", "natural"),
    atomCandidate("rates_nominal_rate_3m_inverse", "rates_only", "Rates-only inverse polarity", "nominal_rate_3m", "inverse"),
    atomCandidate("inflation_cpi_yoy_natural", "inflation_only", "CPI/inflation-only natural polarity", "cpi_inflation_yoy", "natural"),
    atomCandidate("inflation_cpi_yoy_inverse", "inflation_only", "CPI/inflation-only inverse polarity", "cpi_inflation_yoy", "inverse"),
    atomCandidate("rrp_derived_natural", "rrp_only", "RRP-only natural polarity", "rrp_derived", "natural"),
    atomCandidate("rrp_derived_inverse", "rrp_only", "RRP-only inverse polarity", "rrp_derived", "inverse"),
    atomCandidate("ppp_natural", "valuation_single", "PPP-only natural polarity", "ppp", "natural"),
    atomCandidate("ppp_inverse", "valuation_single", "PPP-only inverse polarity", "ppp", "inverse"),
    atomCandidate("neer_natural", "valuation_single", "NEER-only natural polarity", "neer", "natural"),
    atomCandidate("neer_inverse", "valuation_single", "NEER-only inverse polarity", "neer", "inverse"),
    atomCandidate("reer_natural", "valuation_single", "REER-only natural polarity", "reer", "natural"),
    atomCandidate("reer_inverse", "valuation_single", "REER-only inverse polarity", "reer", "inverse"),
    bundleCandidate("valuation_bundle_ppp_neer_reer_natural", "valuation_bundle", "PPP + NEER + REER natural simple majority", ["ppp", "neer", "reer"], "natural", false),
    bundleCandidate("valuation_bundle_ppp_neer_reer_inverse", "valuation_bundle", "PPP + NEER + REER inverse simple majority", ["ppp", "neer", "reer"], "inverse", false),
    bundleCandidate(
      "rate_inflation_bundle_rates_cpi_rrp_natural",
      "rate_inflation_bundle",
      "Rates + CPI + RRP natural simple majority",
      ["nominal_rate_3m", "cpi_inflation_yoy", "rrp_derived"],
      "natural",
      false,
    ),
    bundleCandidate(
      "rate_inflation_bundle_rates_cpi_rrp_inverse",
      "rate_inflation_bundle",
      "Rates + CPI + RRP inverse simple majority",
      ["nominal_rate_3m", "cpi_inflation_yoy", "rrp_derived"],
      "inverse",
      false,
    ),
    bundleCandidate(
      "bpr_plus_rate_inflation_bundle_natural",
      "bpr_plus_rate_inflation_bundle",
      "BPR + rates/CPI/RRP natural simple majority",
      ["nominal_rate_3m", "cpi_inflation_yoy", "rrp_derived"],
      "natural",
      true,
    ),
    bundleCandidate(
      "bpr_plus_rate_inflation_bundle_inverse",
      "bpr_plus_rate_inflation_bundle",
      "BPR + rates/CPI/RRP inverse simple majority",
      ["nominal_rate_3m", "cpi_inflation_yoy", "rrp_derived"],
      "inverse",
      true,
    ),
    bundleCandidate(
      "bpr_plus_valuation_bundle_natural",
      "bpr_plus_valuation_bundle",
      "BPR + PPP/NEER/REER natural simple majority",
      ["ppp", "neer", "reer"],
      "natural",
      true,
    ),
    bundleCandidate(
      "bpr_plus_valuation_bundle_inverse",
      "bpr_plus_valuation_bundle",
      "BPR + PPP/NEER/REER inverse simple majority",
      ["ppp", "neer", "reer"],
      "inverse",
      true,
    ),
    bundleCandidate(
      "full_regime_simple_composite_natural",
      "full_regime_simple_composite",
      "Full Regime simple composite natural numeric polarity plus BPR",
      ["nominal_rate_3m", "cpi_inflation_yoy", "rrp_derived", "ppp", "neer", "reer"],
      "natural",
      true,
    ),
    bundleCandidate(
      "full_regime_simple_composite_inverse",
      "full_regime_simple_composite",
      "Full Regime simple composite inverse numeric polarity plus BPR",
      ["nominal_rate_3m", "cpi_inflation_yoy", "rrp_derived", "ppp", "neer", "reer"],
      "inverse",
      true,
    ),
  ];
  return candidates;
}

function scoreCandidate(candidate: Candidate, alphaRows: AlphaLedgerRow[]) {
  const scored: ScoredRow[] = alphaRows.map((row) => {
    const decision = candidate.directionFor(row);
    const side = sideFromDirection(decision.direction);
    return {
      row,
      direction: decision.direction,
      side,
      adr_grid_adr: directionFromSide(side, row),
      weekly_hold_adr: holdFromSide(side, row),
      degraded: decision.degraded,
      degraded_reasons: decision.degraded_reasons,
    };
  });
  const weekShape = rowsPerWeek(alphaRows);
  const annual = annualSummary(scored);
  const topWeeks = topWeekShare(scored);
  const topPairs = topPairShare(scored);
  const summary = {
    candidate_id: candidate.candidate_id,
    family: candidate.family,
    label: candidate.label,
    transform_version: candidate.transform_version,
    atom_keys: candidate.atom_keys,
    polarity: candidate.polarity,
    tie_rule: candidate.tie_rule,
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
    adr_grid: metric(scored, (row) => row.adr_grid_adr),
    weekly_hold: metric(scored, (row) => row.weekly_hold_adr),
    top_week_share: topWeeks,
    top_pair_share: topPairs,
    annual_summary: annual,
    negative_adr_grid_years: annual.filter((row) => (row.adr_grid_adr ?? 0) < 0).length,
    decision_signature_sha256: sha256Text(scored.map((row) => `${row.row.row_key}|${row.direction}`).sort().join("\n")),
  };
  return {
    ...summary,
    interpretation_bucket: classifyCandidate(summary),
    content_hash: sha256Stable(summary),
  };
}

function scoreBprCohort(
  cohortId: string,
  description: string,
  alphaRows: AlphaLedgerRow[],
  bprByKey: Map<string, BprPairDirectionRow>,
  filter: (row: AlphaLedgerRow, bpr: BprPairDirectionRow | undefined) => boolean,
) {
  const subset = alphaRows.filter((row) => filter(row, bprByKey.get(row.row_key)));
  const scored: ScoredRow[] = subset.map((row) => {
    const decision = bprDirection(row, bprByKey);
    const side = sideFromDirection(decision.direction);
    return {
      row,
      direction: decision.direction,
      side,
      adr_grid_adr: directionFromSide(side, row),
      weekly_hold_adr: holdFromSide(side, row),
      degraded: decision.degraded,
      degraded_reasons: decision.degraded_reasons,
    };
  });
  return {
    cohort_id: cohortId,
    description,
    diagnostic_only: true,
    rows: scored.length,
    weeks: new Set(scored.map((row) => row.row.week.week_open_utc)).size,
    selected_direction_counts: countBy(scored, (row) => row.direction),
    adr_grid: metric(scored, (row) => row.adr_grid_adr),
    weekly_hold: metric(scored, (row) => row.weekly_hold_adr),
    degraded_rows: scored.filter((row) => row.degraded).length,
    degradation_reason_counts: countBy(
      scored.flatMap((row) => row.degraded_reasons),
      (reason) => reason,
    ),
  };
}

function buildBprCohorts(alphaRows: AlphaLedgerRow[], bprByKey: Map<string, BprPairDirectionRow>) {
  const rawFresh = new Set(["raw_present", "carried_fresh"]);
  return [
    scoreBprCohort(
      "bpr_promotion_eligible_pair_direction",
      "Rows where Gate 60H marks the BPR pair direction promotion eligible.",
      alphaRows,
      bprByKey,
      (_row, bpr) => bpr?.promotion_eligible_pair_direction === true,
    ),
    scoreBprCohort(
      "bpr_source_direction_eligible",
      "Rows where Gate 60G source-direction eligibility is true regardless of promotion eligibility.",
      alphaRows,
      bprByKey,
      (_row, bpr) => bpr?.pair_source_direction_eligible === true,
    ),
    scoreBprCohort(
      "bpr_raw_or_fresh_only_both_sides",
      "Rows where both BPR currency states are raw_present or carried_fresh.",
      alphaRows,
      bprByKey,
      (_row, bpr) => Boolean(bpr && rawFresh.has(bpr.base_source_quality) && rawFresh.has(bpr.quote_source_quality)),
    ),
    scoreBprCohort(
      "bpr_excluding_stale_carried",
      "Rows excluding any carried_stale BPR side.",
      alphaRows,
      bprByKey,
      (_row, bpr) => Boolean(bpr && bpr.base_source_quality !== "carried_stale" && bpr.quote_source_quality !== "carried_stale"),
    ),
    scoreBprCohort(
      "bpr_excluding_synthetic_usd",
      "Rows excluding any synthetic_usd BPR side.",
      alphaRows,
      bprByKey,
      (_row, bpr) => Boolean(bpr && bpr.base_source_quality !== "synthetic_usd" && bpr.quote_source_quality !== "synthetic_usd"),
    ),
    scoreBprCohort(
      "bpr_promotion_ineligible_pair_direction",
      "Rows where BPR forced-28 direction exists but promotion eligibility is false.",
      alphaRows,
      bprByKey,
      (_row, bpr) => bpr?.promotion_eligible_pair_direction === false,
    ),
  ];
}

function renderBestCandidates(candidateRows: Array<Record<string, unknown>>) {
  const sorted = [...candidateRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999));
  const lines = [
    "# Gate 62 Regime-Cell Best Candidates",
    "",
    "Discovery-only ranking. These are not promoted Regime sides, not Alpha v2, and not final Body logic.",
    "",
    "| Rank | Candidate | Bucket | ADR Grid | DD | R/DD | PF | Weekly Hold | Degraded Rows | Negative Years |",
    "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|",
  ];
  sorted.slice(0, 12).forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${row.candidate_id} | ${row.interpretation_bucket} | ${row.adr_grid.adr_sum} | ${row.adr_grid.max_drawdown} | ${row.adr_grid.r_over_drawdown} | ${row.adr_grid.row_pf} | ${row.weekly_hold.adr_sum} | ${row.missing_degraded_row_count} | ${row.negative_adr_grid_years} |`,
    );
  });
  lines.push(
    "",
    "## Interpretation",
    "",
    "- `promising_discovery_only`: positive row-complete discovery result with no promotion claim.",
    "- `fragile_or_governance_review`: row-complete but has BPR degradation, concentration, or year-stability caveats.",
    "- `weak_or_negative`: row-complete but weak or negative discovery result.",
    "- `disqualified`: row-shape or outcome failure. None should pass Gate 62 if disqualified.",
    "",
  );
  return lines.join("\n");
}

function renderReport(summary: Record<string, unknown>, candidateRows: Array<Record<string, unknown>>) {
  const sorted = [...candidateRows].sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999));
  const table = sorted
    .slice(0, 16)
    .map(
      (row, index) =>
        `| ${index + 1} | ${row.candidate_id} | ${row.interpretation_bucket} | ${row.adr_grid.adr_sum} | ${row.adr_grid.max_drawdown} | ${row.adr_grid.r_over_drawdown} | ${row.adr_grid.row_pf} | ${row.weekly_hold.adr_sum} | ${row.missing_degraded_row_count} |`,
    )
    .join("\n");
  return [
    "# Gate 62 Regime-Cell Standalone Matrix",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Boundary",
    "",
    "- Regime-cell discovery matrix only.",
    "- Uses Regime atoms only: BPR, rates, CPI/inflation, RRP, PPP, NEER, and REER.",
    "- BPR remains inside Regime.",
    "- No COT atoms, Strength atoms, universal all-atom matrix, Gate 63, Alpha v2, final Body algorithm, risk, execution, MT5/live, app/runtime work, source mutation, row dropping, COT retuning, or Strength retuning.",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(summary.denominator, null, 2),
    "```",
    "",
    "## Candidate Ranking",
    "",
    "| Rank | Candidate | Bucket | ADR Grid | DD | R/DD | PF | Weekly Hold | Degraded Rows |",
    "|---:|---|---|---:|---:|---:|---:|---:|---:|",
    table,
    "",
    "## BPR Quality Cohorts",
    "",
    "BPR cohort diagnostics are intentionally separate from row-complete matrix candidates. They do not silently drop rows from candidate scoring.",
    "",
    "```json",
    JSON.stringify(summary.bpr_quality_cohort_overview, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Candidate contracts: \`${summary.artifacts.candidateContracts}\``,
    `- Matrix rows: \`${summary.artifacts.matrixRowsJsonl}\``,
    `- Summary JSON: \`${summary.artifacts.summaryJson}\``,
    `- Quality cohorts: \`${summary.artifacts.qualityCohortsJson}\``,
    `- Best candidates: \`${summary.artifacts.bestCandidatesMd}\``,
    `- Query/rebuild receipt: \`${summary.artifacts.queryReceipt}\``,
    `- SHA identity: \`${summary.artifacts.shaIdentity}\``,
    "",
    "## Stop Line",
    "",
    "Gate 62 stops here for Freedom review. No Gate 63 work, universal atom matrix, Alpha v2, final Body algorithm, risk, execution, MT5/live, app/runtime work, or source mutation was started.",
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
  const currencyAtomRows = await readJsonl<CurrencyWeekAtomRow>(currencyAtomPath);
  const bprPairRows = await readJsonl<BprPairDirectionRow>(bprPairPath);
  const gate60hSummary = await readJson<Record<string, unknown>>(gate60hSummaryPath);
  const gate61bSummary = await readJson<Record<string, unknown>>(gate61bSummaryPath);
  if (!String(gate61bSummary.verdict).startsWith("PASS_")) {
    throw new Error(`Gate 61B readiness did not pass: ${gate61bSummary.verdict}`);
  }

  const atomsByKey = new Map(currencyAtomRows.map((row) => [atomMapKey(row.atom_key, row.alpha_week_open_utc, row.currency), row]));
  const bprByKey = new Map(bprPairRows.map((row) => [row.row_key, row]));
  const candidates = buildCandidates(atomsByKey, bprByKey);
  const candidateRows = candidates.map((candidate) => scoreCandidate(candidate, alphaRows));
  const bprCohorts = buildBprCohorts(alphaRows, bprByKey);
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
    cot_atoms_used: false,
    strength_atoms_used: false,
    source_rows_mutated: false,
  };

  const pass =
    denominator.alpha_rows === EXPECTED_ROWS &&
    denominator.alpha_weeks === EXPECTED_WEEKS &&
    denominator.full_weeks === EXPECTED_WEEKS &&
    denominator.duplicate_week_symbol_rows === 0 &&
    denominator.bpr_pair_direction_rows === EXPECTED_ROWS &&
    denominator.disqualified_candidates === 0;

  const candidateContracts = {
    gate_id: GATE_ID,
    regime_cell_atoms: REGIME_CELL_ATOMS,
    candidate_contracts: candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      family: candidate.family,
      label: candidate.label,
      transform_version: candidate.transform_version,
      atom_keys: candidate.atom_keys,
      polarity: candidate.polarity,
      tie_rule: candidate.tie_rule,
      row_policy: "forced_28_rows_preserved",
    })),
    non_candidate_diagnostics: {
      bpr_quality_cohorts: bprCohorts.map((cohort) => cohort.cohort_id),
      note: "BPR cohorts are diagnostics only and do not drop rows from row-complete matrix candidates.",
    },
  };

  const bprQualityCohortOverview = bprCohorts.map((cohort) => ({
    cohort_id: cohort.cohort_id,
    rows: cohort.rows,
    weeks: cohort.weeks,
    adr_grid_adr: cohort.adr_grid.adr_sum,
    weekly_hold_adr: cohort.weekly_hold.adr_sum,
    degraded_rows: cohort.degraded_rows,
  }));

  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_REGIME_CELL_STANDALONE_MATRIX__FORCED28_PRESERVED__NO_GATE63"
      : "FAIL_REGIME_CELL_STANDALONE_MATRIX",
    denominator,
    best_by_adr_grid_r_over_drawdown: [...candidateRows]
      .sort((left, right) => (right.adr_grid.r_over_drawdown ?? -999) - (left.adr_grid.r_over_drawdown ?? -999))
      .slice(0, 10)
      .map((row) => ({
        candidate_id: row.candidate_id,
        interpretation_bucket: row.interpretation_bucket,
        adr_grid: row.adr_grid,
        weekly_hold: row.weekly_hold,
        missing_degraded_row_count: row.missing_degraded_row_count,
        negative_adr_grid_years: row.negative_adr_grid_years,
      })),
    best_by_adr_grid_total: [...candidateRows]
      .sort((left, right) => (right.adr_grid.adr_sum ?? -999) - (left.adr_grid.adr_sum ?? -999))
      .slice(0, 10)
      .map((row) => ({
        candidate_id: row.candidate_id,
        interpretation_bucket: row.interpretation_bucket,
        adr_grid: row.adr_grid,
        weekly_hold: row.weekly_hold,
        missing_degraded_row_count: row.missing_degraded_row_count,
        negative_adr_grid_years: row.negative_adr_grid_years,
      })),
    bpr_quality_cohort_overview: bprQualityCohortOverview,
    gate60h_bpr_class_counts: gate60hSummary.decision_class_counts,
    input_hashes: {
      gate59_alpha_ledger: await fileHash(options.alphaLedgerPath),
      gate60c_currency_atom_ledger: await fileHash(currencyAtomPath),
      gate60g_bpr_pair_direction_ledger: await fileHash(bprPairPath),
      gate60h_eligibility_summary: await fileHash(gate60hSummaryPath),
      gate61b_readiness_summary: await fileHash(gate61bSummaryPath),
    },
    stop_line:
      "Stop after Gate 62. Do not proceed to Gate 63, universal all-atom matrix, Alpha v2, final Body algorithm, risk, execution, MT5/live, app/runtime work, or source mutation.",
    artifacts: {
      candidateContracts: toRepoRelative(path.join(artifactDir, "gate62-regime-cell-candidate-contracts.json")),
      matrixRowsJsonl: toRepoRelative(path.join(artifactDir, "gate62-regime-cell-matrix.rows.jsonl")),
      summaryJson: toRepoRelative(path.join(artifactDir, "gate62-regime-cell-matrix.summary.json")),
      qualityCohortsJson: toRepoRelative(path.join(artifactDir, "gate62-regime-cell-quality-cohorts.json")),
      bestCandidatesMd: toRepoRelative(path.join(artifactDir, "gate62-regime-cell-best-candidates.md")),
      queryReceipt: toRepoRelative(path.join(artifactDir, "gate62-regime-cell-standalone-matrix.query-receipt.md")),
      shaIdentity: toRepoRelative(path.join(artifactDir, "gate62-regime-cell-standalone-matrix.sha256.txt")),
      report: toRepoRelative(reportPath),
    },
  };

  const candidateContractsPath = path.join(artifactDir, "gate62-regime-cell-candidate-contracts.json");
  const matrixRowsPath = path.join(artifactDir, "gate62-regime-cell-matrix.rows.jsonl");
  const summaryPath = path.join(artifactDir, "gate62-regime-cell-matrix.summary.json");
  const qualityCohortsPath = path.join(artifactDir, "gate62-regime-cell-quality-cohorts.json");
  const bestCandidatesPath = path.join(artifactDir, "gate62-regime-cell-best-candidates.md");
  const queryReceiptPath = path.join(artifactDir, "gate62-regime-cell-standalone-matrix.query-receipt.md");
  const shaPath = path.join(artifactDir, "gate62-regime-cell-standalone-matrix.sha256.txt");

  await writeFile(candidateContractsPath, `${JSON.stringify(candidateContracts, null, 2)}\n`, "utf8");
  await writeFile(matrixRowsPath, `${candidateRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(qualityCohortsPath, `${JSON.stringify({ gate_id: GATE_ID, cohorts: bprCohorts }, null, 2)}\n`, "utf8");
  await writeFile(bestCandidatesPath, renderBestCandidates(candidateRows), "utf8");
  const queryReceipt = [
    "# Gate 62 Query/Rebuild Receipt",
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
    "",
    "No database query, raw M1 simulation, source mutation, COT atom use, Strength atom use, risk, execution, MT5/live, app/runtime work, Gate 63 work, or universal all-atom matrix was run.",
    "",
  ].join("\n");
  await writeFile(queryReceiptPath, queryReceipt, "utf8");
  const reportText = renderReport(summary, candidateRows);
  await writeFile(reportPath, reportText, "utf8");

  const contentInvariant = sha256Stable({
    denominator,
    candidate_hashes: candidateRows.map((row) => row.content_hash),
    bpr_cohorts: bprQualityCohortOverview,
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
    `quality_cohorts_json ${await fileHash(qualityCohortsPath)} ${toRepoRelative(qualityCohortsPath)}`,
    `best_candidates_md ${await fileHash(bestCandidatesPath)} ${toRepoRelative(bestCandidatesPath)}`,
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
  console.log(`Best by R/DD: ${summary.best_by_adr_grid_r_over_drawdown[0]?.candidate_id}`);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
  console.log(`SHA identity: ${toRepoRelative(shaPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
