import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BRAIN_ARCHITECTURE, flattenBrainAtomInventory } from "@engine/brain/architecture";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 61B: universal-cell-atom-readiness-audit";
const COMMAND = "npm run engine:gate61b:universal-cell-atom-readiness";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_GATE60C_DIR = "docs/research/gates/gate60c/artifacts/gate60c-regime-source-atom-fill";
const DEFAULT_GATE60G_DIR = "docs/research/gates/gate60g/artifacts/gate60g-bpr-forced28-source-direction-ledger";
const DEFAULT_GATE60H_DIR = "docs/research/gates/gate60h/artifacts/gate60h-bpr-source-direction-eligibility-classes";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate61b/artifacts/gate61b-universal-cell-atom-readiness";
const DEFAULT_REPORT_PATH =
  "docs/research/gates/gate61b/GATE61B_UNIVERSAL_CELL_ATOM_READINESS_AUDIT_2026-06-27.md";

const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const REGIME_REQUIRED_ATOMS = [
  "bpr_futures",
  "nominal_rate_3m",
  "cpi_inflation_yoy",
  "rrp_derived",
  "ppp",
  "neer",
  "reer",
] as const;

type CliOptions = {
  alphaLedgerPath: string;
  gate60cDir: string;
  gate60gDir: string;
  gate60hDir: string;
  artifactDir: string;
  reportPath: string;
};

type AlphaLedgerRow = {
  row_key: string;
  week: { week_open_utc: string; year: number; quarter: string };
  instrument: { symbol: string; base_currency: string | null; quote_currency: string | null };
  cot_atoms: Record<string, unknown>;
  strength_atoms: Record<string, unknown>;
  outcomes: {
    adr_grid: { long: number | null; short: number | null };
    weekly_hold: { long: number | null; short: number | null };
  };
  diagnostics: {
    missing_cot_state: boolean;
    missing_strength_state: boolean;
    missing_long_outcome: boolean;
    missing_short_outcome: boolean;
  };
};

type PairWeekAtomJoinRow = {
  row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  base: string | null;
  quote: string | null;
  base_atom_hashes: Record<string, string | null>;
  quote_atom_hashes: Record<string, string | null>;
  base_atom_statuses: Record<string, string>;
  quote_atom_statuses: Record<string, string>;
  base_fail_closed_reasons: string[];
  quote_fail_closed_reasons: string[];
  pair_fail_closed_reasons: string[];
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
  missing: boolean;
  stale: boolean;
  quarantined: boolean;
  source_ambiguous: boolean;
  formula_missing: boolean;
  fail_closed_reasons: string[];
};

type BprPairDirectionRow = {
  row_key: string;
  alpha_week_open_utc: string;
  symbol: string;
  bpr_source_direction: "BASE_CURRENCY" | "QUOTE_CURRENCY";
  bpr_source_direction_rule: string;
  base_source_quality: string;
  quote_source_quality: string;
  pair_source_direction_eligible: boolean;
  promotion_eligible_pair_direction: boolean;
  promotion_ineligible_reasons: string[];
  no_regime_side: boolean;
  no_long_short_side: boolean;
  source_rows_mutated: boolean;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    alphaLedgerPath: DEFAULT_ALPHA_LEDGER_PATH,
    gate60cDir: DEFAULT_GATE60C_DIR,
    gate60gDir: DEFAULT_GATE60G_DIR,
    gate60hDir: DEFAULT_GATE60H_DIR,
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

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function histogram(values: number[]) {
  return countBy(values, (value) => String(value));
}

function duplicateCount(values: string[]) {
  const counts = countBy(values, (value) => value);
  return Object.values(counts).filter((count) => count > 1).length;
}

function rowsPerWeek(rows: AlphaLedgerRow[]) {
  const counts = countBy(rows, (row) => row.week.week_open_utc);
  const values = Object.values(counts);
  return {
    weeks: values.length,
    histogram: histogram(values),
    full_weeks: values.filter((value) => value === EXPECTED_SYMBOLS_PER_WEEK).length,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requiredAtomMissing(join: PairWeekAtomJoinRow | undefined, atom: string) {
  if (!join) return true;
  return !join.base_atom_statuses[atom] || !join.quote_atom_statuses[atom];
}

function collectRegimeStatusCounts(rows: CurrencyWeekAtomRow[]) {
  const groups = new Map<string, CurrencyWeekAtomRow[]>();
  for (const row of rows) {
    groups.set(row.atom_key, [...(groups.get(row.atom_key) ?? []), row]);
  }
  return Object.fromEntries(
    [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([atomKey, safeRows]) => [
      atomKey,
      {
        rows: safeRows.length,
        source_state_counts: countBy(safeRows, (row) => row.source_state),
        status_counts: countBy(safeRows, (row) => row.status),
        value_available_rows: safeRows.filter((row) => row.value_available).length,
        promotion_eligible_rows: safeRows.filter((row) => row.promotion_eligible).length,
        missing_rows: safeRows.filter((row) => row.missing).length,
        stale_rows: safeRows.filter((row) => row.stale).length,
        quarantined_rows: safeRows.filter((row) => row.quarantined).length,
        source_ambiguous_rows: safeRows.filter((row) => row.source_ambiguous).length,
        formula_missing_rows: safeRows.filter((row) => row.formula_missing).length,
        fail_closed_rows: safeRows.filter((row) => row.status === "FAIL_CLOSED").length,
        fail_closed_reason_counts: countBy(
          safeRows.flatMap((row) => row.fail_closed_reasons),
          (reason) => reason,
        ),
      },
    ]),
  );
}

function renderReport(summary: Record<string, unknown>) {
  const cellRows = summary.cell_readiness
    .map(
      (cell: Record<string, unknown>) =>
        `| ${cell.cell_id} | ${cell.atom_count} | ${cell.missing_atom_rows} | ${cell.join_complete_rows} | ${cell.quality_flag_rows} |`,
    )
    .join("\n");
  return [
    "# Gate 61B Universal Cell/Atom Readiness Audit",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Boundary",
    "",
    "- Readiness audit only.",
    "- No matrix, Regime transform selection, P&L testing beyond existing outcome-field availability, Alpha v2, risk, execution, MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning, or Regime source mutation.",
    "- BPR remains nested under the Regime cell.",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(summary.denominator, null, 2),
    "```",
    "",
    "## Cell Readiness",
    "",
    "| Cell | Atom count | Missing atom rows | Join-complete rows | Quality-flag rows |",
    "|---|---:|---:|---:|---:|",
    cellRows,
    "",
    "## Outcome Availability",
    "",
    "```json",
    JSON.stringify(summary.outcome_availability, null, 2),
    "```",
    "",
    "## Quality Flags",
    "",
    "```json",
    JSON.stringify(summary.quality_flags, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Inventory contract: \`${summary.artifacts.inventoryContract}\``,
    `- Summary JSON: \`${summary.artifacts.summaryJson}\``,
    `- Row audit JSONL: \`${summary.artifacts.rowAuditJsonl}\``,
    `- Cell quality summary: \`${summary.artifacts.qualitySummaryJson}\``,
    `- Outcome availability summary: \`${summary.artifacts.outcomeSummaryJson}\``,
    `- SHA identity: \`${summary.artifacts.shaIdentity}\``,
    "",
    "## Stop Line",
    "",
    "Gate 61B stops after readiness proof. It does not run the Regime matrix or any universal all-atom matrix.",
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
  const pairJoinPath = path.join(options.gate60cDir, "gate60c-pair-week-source-atom-join-ledger.rows.jsonl");
  const currencyAtomPath = path.join(options.gate60cDir, "gate60c-currency-week-source-atom-ledger.rows.jsonl");
  const bprPairPath = path.join(options.gate60gDir, "gate60g-bpr-pair-direction-ledger.rows.jsonl");
  const gate60gSummaryPath = path.join(options.gate60gDir, "gate60g-bpr-source-quality-summary.json");
  const gate60hSummaryPath = path.join(options.gate60hDir, "gate60h-bpr-source-direction-eligibility-summary.json");

  const pairJoinRows = await readJsonl<PairWeekAtomJoinRow>(pairJoinPath);
  const currencyAtomRows = await readJsonl<CurrencyWeekAtomRow>(currencyAtomPath);
  const bprPairRows = await readJsonl<BprPairDirectionRow>(bprPairPath);
  const gate60gSummary = await readJson<Record<string, unknown>>(gate60gSummaryPath);
  const gate60hSummary = await readJson<Record<string, unknown>>(gate60hSummaryPath);

  const pairJoinByKey = new Map(pairJoinRows.map((row) => [row.row_key, row]));
  const bprPairByKey = new Map(bprPairRows.map((row) => [row.row_key, row]));
  const weekShape = rowsPerWeek(alphaRows);

  let cotCompleteRows = 0;
  let strengthCompleteRows = 0;
  let regimeJoinCompleteRows = 0;
  let bprForced28Rows = 0;
  let outcomeCompleteRows = 0;
  let regimeMissingAtomRows = 0;
  let bprDegradedOrIneligibleRows = 0;

  const rowAuditRows = alphaRows.map((alpha) => {
    const join = pairJoinByKey.get(alpha.row_key);
    const bpr = bprPairByKey.get(alpha.row_key);
    const cotComplete = Boolean(alpha.cot_atoms) && !alpha.diagnostics.missing_cot_state;
    const strengthComplete = Boolean(alpha.strength_atoms) && !alpha.diagnostics.missing_strength_state;
    const missingRegimeAtoms = REGIME_REQUIRED_ATOMS.filter((atom) => requiredAtomMissing(join, atom));
    const regimeComplete = Boolean(join) && missingRegimeAtoms.length === 0;
    const bprPresent = Boolean(bpr) && bpr?.no_long_short_side === true && bpr?.no_regime_side === true && bpr?.source_rows_mutated === false;
    const outcomeComplete =
      isFiniteNumber(alpha.outcomes.adr_grid.long) &&
      isFiniteNumber(alpha.outcomes.adr_grid.short) &&
      isFiniteNumber(alpha.outcomes.weekly_hold.long) &&
      isFiniteNumber(alpha.outcomes.weekly_hold.short) &&
      !alpha.diagnostics.missing_long_outcome &&
      !alpha.diagnostics.missing_short_outcome;
    if (cotComplete) cotCompleteRows += 1;
    if (strengthComplete) strengthCompleteRows += 1;
    if (regimeComplete) regimeJoinCompleteRows += 1;
    if (bprPresent) bprForced28Rows += 1;
    if (outcomeComplete) outcomeCompleteRows += 1;
    if (missingRegimeAtoms.length > 0) regimeMissingAtomRows += 1;
    if (bpr && (!bpr.pair_source_direction_eligible || !bpr.promotion_eligible_pair_direction)) bprDegradedOrIneligibleRows += 1;
    return {
      row_key: alpha.row_key,
      week_open_utc: alpha.week.week_open_utc,
      symbol: alpha.instrument.symbol,
      cot_complete: cotComplete,
      strength_complete: strengthComplete,
      regime_pair_join_present: Boolean(join),
      regime_required_atoms_present: missingRegimeAtoms.length === 0,
      missing_regime_atoms: missingRegimeAtoms,
      bpr_forced28_source_direction_present: bprPresent,
      bpr_source_direction: bpr?.bpr_source_direction ?? null,
      bpr_source_direction_rule: bpr?.bpr_source_direction_rule ?? null,
      bpr_base_source_quality: bpr?.base_source_quality ?? null,
      bpr_quote_source_quality: bpr?.quote_source_quality ?? null,
      bpr_pair_source_direction_eligible: bpr?.pair_source_direction_eligible ?? false,
      bpr_promotion_eligible_pair_direction: bpr?.promotion_eligible_pair_direction ?? false,
      bpr_promotion_ineligible_reasons: bpr?.promotion_ineligible_reasons ?? [],
      adr_grid_outcomes_available: isFiniteNumber(alpha.outcomes.adr_grid.long) && isFiniteNumber(alpha.outcomes.adr_grid.short),
      weekly_hold_outcomes_available: isFiniteNumber(alpha.outcomes.weekly_hold.long) && isFiniteNumber(alpha.outcomes.weekly_hold.short),
      row_complete_for_gate62: cotComplete && strengthComplete && regimeComplete && bprPresent && outcomeComplete,
      content_hash: sha256Stable({
        row_key: alpha.row_key,
        cotComplete,
        strengthComplete,
        regimeComplete,
        bprPresent,
        outcomeComplete,
        missingRegimeAtoms,
        bpr_quality: bpr
          ? {
              base: bpr.base_source_quality,
              quote: bpr.quote_source_quality,
              rule: bpr.bpr_source_direction_rule,
              promotion_eligible: bpr.promotion_eligible_pair_direction,
            }
          : null,
      }),
    };
  });

  const denominator = {
    alpha_rows: alphaRows.length,
    expected_alpha_rows: EXPECTED_ROWS,
    alpha_weeks: weekShape.weeks,
    expected_alpha_weeks: EXPECTED_WEEKS,
    symbols_per_week_histogram: weekShape.histogram,
    expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
    full_weeks: weekShape.full_weeks,
    duplicate_alpha_row_keys: duplicateCount(alphaRows.map((row) => row.row_key)),
    duplicate_week_symbol_rows: duplicateCount(alphaRows.map((row) => `${row.week.week_open_utc}|${row.instrument.symbol}`)),
    gate60c_pair_join_rows: pairJoinRows.length,
    gate60g_bpr_pair_direction_rows: bprPairRows.length,
    gate60c_currency_atom_rows: currencyAtomRows.length,
  };

  const cotQuality = {
    missing_cot_state_rows: alphaRows.filter((row) => row.diagnostics.missing_cot_state).length,
    tie_flag_rows: alphaRows.filter((row) => row.cot_atoms.tie_flag === true).length,
    carry_forward_flag_rows: alphaRows.filter((row) => row.cot_atoms.carry_forward_flag === true).length,
    carry_previous_flag_rows: alphaRows.filter((row) => row.cot_atoms.carry_previous_flag === true).length,
    lifecycle_state_counts: countBy(alphaRows, (row) => String(row.cot_atoms.lifecycle_state ?? "missing")),
  };

  const strengthQuality = {
    missing_strength_state_rows: alphaRows.filter((row) => row.diagnostics.missing_strength_state).length,
    lifecycle_bucket_counts: countBy(alphaRows, (row) => String(row.strength_atoms.lifecycle_bucket ?? "missing")),
    phase_bucket_counts: countBy(alphaRows, (row) => String(row.strength_atoms.phase_bucket ?? "missing")),
    lifecycle_phase_counts: countBy(
      alphaRows,
      (row) => `${String(row.strength_atoms.lifecycle_bucket ?? "missing")}:${String(row.strength_atoms.phase_bucket ?? "missing")}`,
    ),
  };

  const regimeQuality = collectRegimeStatusCounts(currencyAtomRows);
  const bprQuality = {
    gate60g_quality_summary: gate60gSummary.quality_summary,
    gate60h_decision_class_counts: gate60hSummary.decision_class_counts,
    gate60h_gate60g_pair_row_counts: gate60hSummary.gate60g_pair_row_counts,
  };

  const cellReadiness = [
    {
      cell_id: "cot",
      atom_count: BRAIN_ARCHITECTURE.cells.find((cell) => cell.cell_id === "cot")?.atoms.length ?? 0,
      join_complete_rows: cotCompleteRows,
      missing_atom_rows: alphaRows.length - cotCompleteRows,
      quality_flag_rows: cotQuality.tie_flag_rows + cotQuality.carry_forward_flag_rows + cotQuality.carry_previous_flag_rows,
    },
    {
      cell_id: "strength",
      atom_count: BRAIN_ARCHITECTURE.cells.find((cell) => cell.cell_id === "strength")?.atoms.length ?? 0,
      join_complete_rows: strengthCompleteRows,
      missing_atom_rows: alphaRows.length - strengthCompleteRows,
      quality_flag_rows: alphaRows.length - strengthCompleteRows,
    },
    {
      cell_id: "regime",
      atom_count: BRAIN_ARCHITECTURE.cells.find((cell) => cell.cell_id === "regime")?.atoms.length ?? 0,
      join_complete_rows: Math.min(regimeJoinCompleteRows, bprForced28Rows),
      missing_atom_rows: regimeMissingAtomRows,
      quality_flag_rows: bprDegradedOrIneligibleRows,
    },
  ];

  const outcomeAvailability = {
    row_complete_for_gate62_rows: rowAuditRows.filter((row) => row.row_complete_for_gate62).length,
    adr_grid_long_available_rows: alphaRows.filter((row) => isFiniteNumber(row.outcomes.adr_grid.long)).length,
    adr_grid_short_available_rows: alphaRows.filter((row) => isFiniteNumber(row.outcomes.adr_grid.short)).length,
    weekly_hold_long_available_rows: alphaRows.filter((row) => isFiniteNumber(row.outcomes.weekly_hold.long)).length,
    weekly_hold_short_available_rows: alphaRows.filter((row) => isFiniteNumber(row.outcomes.weekly_hold.short)).length,
    missing_long_outcome_rows: alphaRows.filter((row) => row.diagnostics.missing_long_outcome).length,
    missing_short_outcome_rows: alphaRows.filter((row) => row.diagnostics.missing_short_outcome).length,
  };

  const pass =
    denominator.alpha_rows === EXPECTED_ROWS &&
    denominator.alpha_weeks === EXPECTED_WEEKS &&
    denominator.full_weeks === EXPECTED_WEEKS &&
    denominator.duplicate_alpha_row_keys === 0 &&
    denominator.duplicate_week_symbol_rows === 0 &&
    denominator.gate60c_pair_join_rows === EXPECTED_ROWS &&
    denominator.gate60g_bpr_pair_direction_rows === EXPECTED_ROWS &&
    cotCompleteRows === EXPECTED_ROWS &&
    strengthCompleteRows === EXPECTED_ROWS &&
    regimeJoinCompleteRows === EXPECTED_ROWS &&
    bprForced28Rows === EXPECTED_ROWS &&
    outcomeCompleteRows === EXPECTED_ROWS;

  const inventoryContract = {
    gate_id: GATE_ID,
    architecture_version: BRAIN_ARCHITECTURE.version,
    brain: BRAIN_ARCHITECTURE,
    atom_inventory: flattenBrainAtomInventory(),
    taxonomy: {
      cot_cell: ["cot_side", "cot_tei_spread", "cot_carry_flags", "cot_lifecycle_state"],
      strength_cell: ["strength_gate57e_side", "strength_score_spread", "strength_lifecycle_bucket", "strength_phase_bucket"],
      regime_cell: {
        bpr: ["bpr_futures", "bpr_futures_and_options", "bpr_futures_carried_state", "bpr_futures_synthetic_usd_state"],
        rates: ["nominal_rate_3m"],
        inflation: ["cpi_inflation_yoy"],
        rrp: ["rrp_derived"],
        valuation: ["ppp", "neer", "reer"],
      },
    },
  };

  const qualitySummary = {
    cot: cotQuality,
    strength: strengthQuality,
    regime: regimeQuality,
    bpr: bprQuality,
  };

  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_UNIVERSAL_CELL_ATOM_READINESS__GATE59_DENOMINATOR_PRESERVED__REGIME_BPR_JOINABLE"
      : "FAIL_UNIVERSAL_CELL_ATOM_READINESS",
    denominator,
    cell_readiness: cellReadiness,
    outcome_availability: outcomeAvailability,
    quality_flags: qualitySummary,
    row_audit_hash: sha256Text(rowAuditRows.map((row) => JSON.stringify(row)).join("\n")),
    input_hashes: {
      gate59_alpha_ledger: await fileHash(options.alphaLedgerPath),
      gate60c_pair_join_ledger: await fileHash(pairJoinPath),
      gate60c_currency_atom_ledger: await fileHash(currencyAtomPath),
      gate60g_bpr_pair_direction_ledger: await fileHash(bprPairPath),
      gate60g_source_quality_summary: await fileHash(gate60gSummaryPath),
      gate60h_eligibility_summary: await fileHash(gate60hSummaryPath),
    },
    artifacts: {
      inventoryContract: toRepoRelative(path.join(artifactDir, "universal-cell-atom-inventory.contract.json")),
      summaryJson: toRepoRelative(path.join(artifactDir, "universal-cell-atom-readiness.summary.json")),
      rowAuditJsonl: toRepoRelative(path.join(artifactDir, "universal-cell-atom-readiness.rows.jsonl")),
      qualitySummaryJson: toRepoRelative(path.join(artifactDir, "cell-atom-quality-summary.json")),
      outcomeSummaryJson: toRepoRelative(path.join(artifactDir, "outcome-availability-summary.json")),
      shaIdentity: toRepoRelative(path.join(artifactDir, "gate61b-universal-cell-atom-readiness.sha256.txt")),
      report: toRepoRelative(reportPath),
    },
  };

  const inventoryPath = path.join(artifactDir, "universal-cell-atom-inventory.contract.json");
  const summaryPath = path.join(artifactDir, "universal-cell-atom-readiness.summary.json");
  const rowAuditPath = path.join(artifactDir, "universal-cell-atom-readiness.rows.jsonl");
  const qualitySummaryPath = path.join(artifactDir, "cell-atom-quality-summary.json");
  const outcomeSummaryPath = path.join(artifactDir, "outcome-availability-summary.json");
  const shaPath = path.join(artifactDir, "gate61b-universal-cell-atom-readiness.sha256.txt");

  await writeFile(inventoryPath, `${JSON.stringify(inventoryContract, null, 2)}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(rowAuditPath, `${rowAuditRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  await writeFile(qualitySummaryPath, `${JSON.stringify(qualitySummary, null, 2)}\n`, "utf8");
  await writeFile(outcomeSummaryPath, `${JSON.stringify(outcomeAvailability, null, 2)}\n`, "utf8");
  const reportText = renderReport(summary);
  await writeFile(reportPath, reportText, "utf8");

  const contentInvariant = sha256Stable({
    denominator,
    cell_readiness: cellReadiness,
    outcome_availability: outcomeAvailability,
    quality_flags: qualitySummary,
    row_audit_hash: summary.row_audit_hash,
    input_hashes: summary.input_hashes,
  });
  const shaLines = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${summary.generated_at}`,
    `git_commit ${summary.git_commit}`,
    `verdict ${summary.verdict}`,
    `inventory_contract ${await fileHash(inventoryPath)} ${toRepoRelative(inventoryPath)}`,
    `summary_json ${await fileHash(summaryPath)} ${toRepoRelative(summaryPath)}`,
    `row_audit_jsonl ${await fileHash(rowAuditPath)} ${toRepoRelative(rowAuditPath)}`,
    `quality_summary_json ${await fileHash(qualitySummaryPath)} ${toRepoRelative(qualitySummaryPath)}`,
    `outcome_summary_json ${await fileHash(outcomeSummaryPath)} ${toRepoRelative(outcomeSummaryPath)}`,
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
  console.log(`Rows ready for Gate 62: ${outcomeAvailability.row_complete_for_gate62_rows}/${EXPECTED_ROWS}`);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
  console.log(`SHA identity: ${toRepoRelative(shaPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
