import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BRAIN_ARCHITECTURE, flattenBrainAtomInventory } from "@engine/brain/architecture";
import { sha256Stable, sha256Text } from "@engine/research/hash";

const GATE_ID = "Gate 64A: silent-missing-atom-audit";
const COMMAND = "npm run engine:gate64a:silent-missing-atom-audit";
const DEFAULT_ALPHA_LEDGER_PATH =
  "docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl";
const DEFAULT_GATE60C_DIR = "docs/research/gates/gate60c/artifacts/gate60c-regime-source-atom-fill";
const DEFAULT_GATE60G_DIR = "docs/research/gates/gate60g/artifacts/gate60g-bpr-forced28-source-direction-ledger";
const DEFAULT_GATE60H_DIR = "docs/research/gates/gate60h/artifacts/gate60h-bpr-source-direction-eligibility-classes";
const DEFAULT_GATE61B_DIR = "docs/research/gates/gate61b/artifacts/gate61b-universal-cell-atom-readiness";
const DEFAULT_GATE63_DIR = "docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit";
const DEFAULT_REPORT_PATH = "docs/research/gates/gate64a/GATE64A_SILENT_MISSING_ATOM_AUDIT_2026-06-27.md";

const EXPECTED_ROWS = 10_444;
const EXPECTED_WEEKS = 373;
const EXPECTED_SYMBOLS_PER_WEEK = 28;
const EXPECTED_CURRENCY_WEEK_ROWS = 2_984;

type CellId = "cot" | "strength" | "regime";
type AtomClass = "raw_source_atom" | "derived_atom" | "source_quality_atom" | "direction_atom" | "shadow_only_atom" | "fail_closed_not_versioned_atom";
type BodyDecision = "already_covered" | "required_now" | "optional_shadow_only" | "fail_closed_with_reason";

type CliOptions = {
  alphaLedgerPath: string;
  gate60cDir: string;
  gate60gDir: string;
  gate60hDir: string;
  gate61bDir: string;
  gate63Dir: string;
  artifactDir: string;
  reportPath: string;
};

type AlphaLedgerRow = {
  row_key: string;
  week: { week_open_utc: string };
  instrument: { symbol: string };
  cot_atoms: Record<string, unknown>;
  strength_atoms: Record<string, unknown>;
  arbitration: Record<string, unknown>;
  outcomes: Record<string, unknown>;
};

type BprPairDirectionRow = {
  row_key: string;
  base_source_quality: string;
  quote_source_quality: string;
  bpr_source_direction: string;
  bpr_source_direction_rule: string;
  promotion_eligible_pair_direction: boolean;
  pair_source_direction_eligible: boolean;
  source_rows_mutated: boolean;
};

type ExpectedAtom = {
  cell_id: CellId;
  atom_id: string;
  label: string;
  atom_class: AtomClass;
  expected_scope: "pair_week" | "currency_week" | "conceptual";
  required_before_body: boolean;
  expected_source: string;
  emitted_probe:
    | { kind: "alpha_path"; path: string }
    | { kind: "gate60c_atom"; atom_key: string }
    | { kind: "bpr_pair_field"; field: keyof BprPairDirectionRow }
    | { kind: "conceptual_only"; reason: string };
  matrix_atom_keys: string[];
  fail_closed_reason?: string;
};

type AtomMapRow = ExpectedAtom & {
  emitted_rows: number;
  expected_rows: number;
  emitted_status: "emitted" | "not_emitted" | "conceptual_fail_closed";
  brain_architecture_visible: boolean;
  matrix_visible: boolean;
  matrix_candidate_ids: string[];
  required_before_body_decision: BodyDecision;
  decision_reason: string;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    alphaLedgerPath: DEFAULT_ALPHA_LEDGER_PATH,
    gate60cDir: DEFAULT_GATE60C_DIR,
    gate60gDir: DEFAULT_GATE60G_DIR,
    gate60hDir: DEFAULT_GATE60H_DIR,
    gate61bDir: DEFAULT_GATE61B_DIR,
    gate63Dir: DEFAULT_GATE63_DIR,
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
    if (key === "--gate63-dir") options.gate63Dir = value;
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

function getPath(row: Record<string, unknown>, dottedPath: string) {
  return dottedPath.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, row);
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null;
}

function countAlphaPath(rows: AlphaLedgerRow[], dottedPath: string) {
  return rows.filter((row) => hasValue(getPath(row as unknown as Record<string, unknown>, dottedPath))).length;
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function rowsPerWeek(rows: AlphaLedgerRow[]) {
  const counts = countBy(rows, (row) => row.week.week_open_utc);
  return {
    weeks: Object.keys(counts).length,
    full_weeks: Object.values(counts).filter((count) => count === EXPECTED_SYMBOLS_PER_WEEK).length,
    histogram: countBy(Object.values(counts), (count) => String(count)),
  };
}

function duplicateCount(values: string[]) {
  return Object.values(countBy(values, (value) => value)).filter((count) => count > 1).length;
}

function expectedAtoms(): ExpectedAtom[] {
  const alpha = (cell_id: CellId, atom_id: string, label: string, atom_class: AtomClass, pathName: string, matrixAtomKeys = [atom_id]): ExpectedAtom => ({
    cell_id,
    atom_id,
    label,
    atom_class,
    expected_scope: "pair_week",
    required_before_body: true,
    expected_source: "Gate 59 Alpha v1 atom ledger",
    emitted_probe: { kind: "alpha_path", path: pathName },
    matrix_atom_keys: matrixAtomKeys,
  });
  const regime = (atom_id: string, label: string, atom_class: AtomClass, atomKey: string, matrixAtomKeys = [atom_id]): ExpectedAtom => ({
    cell_id: "regime",
    atom_id,
    label,
    atom_class,
    expected_scope: "currency_week",
    required_before_body: true,
    expected_source: "Gate 60C currency-week source atom ledger",
    emitted_probe: { kind: "gate60c_atom", atom_key: atomKey },
    matrix_atom_keys: matrixAtomKeys,
  });
  return [
    alpha("cot", "cot_side", "locked COT direction side", "direction_atom", "cot_atoms.side"),
    alpha("cot", "cot_tei_spread", "COT base-minus-quote TEI spread", "raw_source_atom", "cot_atoms.tei_spread"),
    alpha("cot", "cot_abs_tei_spread", "COT absolute TEI spread", "source_quality_atom", "cot_atoms.abs_tei_spread"),
    alpha("cot", "cot_tei_spread_bucket", "COT TEI spread bucket", "source_quality_atom", "cot_atoms.tei_spread_bucket"),
    alpha("cot", "cot_tie_flag", "COT tie flag", "source_quality_atom", "cot_atoms.tie_flag"),
    alpha("cot", "cot_carry_forward_flag", "COT carry-forward flag", "source_quality_atom", "cot_atoms.carry_forward_flag"),
    alpha("cot", "cot_carry_previous_flag", "COT carry-previous flag", "source_quality_atom", "cot_atoms.carry_previous_flag"),
    alpha("cot", "cot_lifecycle_state", "COT report lifecycle state", "source_quality_atom", "cot_atoms.lifecycle_state"),
    alpha("strength", "strength_gate57e_side", "locked Gate 57E Strength side", "direction_atom", "strength_atoms.gate57e_side"),
    alpha("strength", "strength_parent_side", "Strength parent side", "direction_atom", "strength_atoms.parent_side"),
    alpha("strength", "strength_score_spread", "Strength base-minus-quote score spread", "raw_source_atom", "strength_atoms.score_spread"),
    alpha("strength", "strength_abs_score_spread", "Strength absolute score spread", "source_quality_atom", "strength_atoms.abs_score_spread"),
    alpha("strength", "strength_score_spread_bucket", "Strength score spread bucket", "source_quality_atom", "strength_atoms.score_spread_bucket"),
    alpha("strength", "strength_lifecycle_bucket", "Strength lifecycle bucket", "source_quality_atom", "strength_atoms.lifecycle_bucket"),
    alpha("strength", "strength_phase_bucket", "Strength phase bucket", "source_quality_atom", "strength_atoms.phase_bucket"),
    alpha("strength", "strength_lifecycle_phase_key", "Strength lifecycle/phase key", "source_quality_atom", "strength_atoms.lifecycle_phase_key"),
    alpha("strength", "strength_gate57c_side", "Strength Gate 57C rollback side", "direction_atom", "strength_atoms.gate57c_side"),
    alpha("strength", "strength_gate57c_action_label", "Strength Gate 57C selected/fade label", "source_quality_atom", "strength_atoms.gate57c_action_label"),
    alpha("strength", "strength_gate57d_side", "Strength Gate 57D rollback side", "direction_atom", "strength_atoms.gate57d_side"),
    alpha("strength", "strength_gate57d_action_label", "Strength Gate 57D selected/fade label", "source_quality_atom", "strength_atoms.gate57d_action_label"),
    alpha("strength", "strength_gate57e_action_label", "Strength Gate 57E selected/fade label", "source_quality_atom", "strength_atoms.gate57e_action_label"),
    regime("bpr_futures", "BPR futures required source atom", "raw_source_atom", "bpr_futures", ["bpr"]),
    regime("bpr_futures_and_options", "BPR futures/options shadow source atom", "shadow_only_atom", "bpr_futures_and_options", ["bpr"]),
    {
      cell_id: "regime",
      atom_id: "bpr_futures_carried_state",
      label: "BPR futures carried source-quality state",
      atom_class: "source_quality_atom",
      expected_scope: "pair_week",
      required_before_body: true,
      expected_source: "Gate 60G BPR pair-direction ledger",
      emitted_probe: { kind: "bpr_pair_field", field: "base_source_quality" },
      matrix_atom_keys: ["bpr"],
    },
    {
      cell_id: "regime",
      atom_id: "bpr_futures_synthetic_usd_state",
      label: "BPR synthetic USD source-quality state",
      atom_class: "source_quality_atom",
      expected_scope: "pair_week",
      required_before_body: true,
      expected_source: "Gate 60G BPR pair-direction ledger",
      emitted_probe: { kind: "bpr_pair_field", field: "quote_source_quality" },
      matrix_atom_keys: ["bpr"],
    },
    regime("nominal_rate_3m", "nominal 3m interbank rate", "raw_source_atom", "nominal_rate_3m"),
    regime("cpi_inflation_yoy", "CPI year-over-year inflation", "raw_source_atom", "cpi_inflation_yoy"),
    regime("rrp_derived", "real-rate pressure derived atom", "derived_atom", "rrp_derived"),
    regime("ppp", "purchasing power parity raw valuation atom", "raw_source_atom", "ppp"),
    regime("neer", "nominal effective exchange rate raw valuation atom", "raw_source_atom", "neer"),
    regime("reer", "real effective exchange rate raw valuation atom", "raw_source_atom", "reer"),
    {
      cell_id: "regime",
      atom_id: "valuation_gap",
      label: "valuation gap derived Regime atom",
      atom_class: "fail_closed_not_versioned_atom",
      expected_scope: "conceptual",
      required_before_body: true,
      expected_source: "Gate 60C derived valuation contract",
      emitted_probe: { kind: "conceptual_only", reason: "valuation_gap_formula_not_versioned" },
      matrix_atom_keys: ["valuation_gap"],
      fail_closed_reason: "valuation_gap_formula_not_versioned",
    },
  ];
}

function matrixVisibilityMap(candidateContracts: Array<{ candidate_id: string; atom_keys?: string[] }>) {
  const byAtom = new Map<string, string[]>();
  for (const candidate of candidateContracts) {
    for (const atomKey of candidate.atom_keys ?? []) {
      byAtom.set(atomKey, [...(byAtom.get(atomKey) ?? []), candidate.candidate_id]);
    }
  }
  return byAtom;
}

function buildAtomMap(
  atoms: ExpectedAtom[],
  alphaRows: AlphaLedgerRow[],
  gate60cSummary: Record<string, unknown>,
  bprRows: BprPairDirectionRow[],
  matrixByAtom: Map<string, string[]>,
): AtomMapRow[] {
  const architectureAtoms = new Set(flattenBrainAtomInventory().map((atom) => atom.atom_id));
  const gate60cCoverage = new Map(
    (((gate60cSummary.atom_coverage as Record<string, unknown>)?.by_atom as Array<Record<string, unknown>> | undefined) ?? []).map((row) => [
      String(row.atom_key),
      Number(row.rows ?? 0),
    ]),
  );
  return atoms.map((atom) => {
    let emittedRows = 0;
    let expectedRows = atom.expected_scope === "currency_week" ? EXPECTED_CURRENCY_WEEK_ROWS : EXPECTED_ROWS;
    if (atom.expected_scope === "conceptual") expectedRows = 0;
    if (atom.emitted_probe.kind === "alpha_path") emittedRows = countAlphaPath(alphaRows, atom.emitted_probe.path);
    if (atom.emitted_probe.kind === "gate60c_atom") emittedRows = gate60cCoverage.get(atom.emitted_probe.atom_key) ?? 0;
    if (atom.emitted_probe.kind === "bpr_pair_field") emittedRows = bprRows.filter((row) => hasValue(row[atom.emitted_probe.field])).length;
    const matrixCandidateIds = [...new Set(atom.matrix_atom_keys.flatMap((key) => matrixByAtom.get(key) ?? []))];
    const emittedStatus =
      atom.expected_scope === "conceptual" ? "conceptual_fail_closed" : emittedRows === expectedRows ? "emitted" : "not_emitted";
    const brainVisible = architectureAtoms.has(atom.atom_id);
    const matrixVisible = matrixCandidateIds.length > 0;
    let requiredDecision: BodyDecision = "already_covered";
    let decisionReason = "emitted and available before Body";
    if (atom.atom_class === "shadow_only_atom") {
      requiredDecision = "optional_shadow_only";
      decisionReason = "shadow-only atom is explicit and not silently missing";
    }
    if (atom.expected_scope === "conceptual") {
      requiredDecision = "required_now";
      decisionReason = atom.fail_closed_reason ?? "conceptual atom is not emitted";
    }
    if (emittedStatus === "not_emitted") {
      requiredDecision = atom.required_before_body ? "required_now" : "fail_closed_with_reason";
      decisionReason = `expected ${expectedRows} rows but found ${emittedRows}`;
    }
    return {
      ...atom,
      emitted_rows: emittedRows,
      expected_rows: expectedRows,
      emitted_status: emittedStatus,
      brain_architecture_visible: brainVisible,
      matrix_visible: matrixVisible,
      matrix_candidate_ids: matrixCandidateIds,
      required_before_body_decision: requiredDecision,
      decision_reason: decisionReason,
    };
  });
}

function renderReport(summary: Record<string, unknown>, missingReport: Record<string, unknown>, visibility: Record<string, unknown>) {
  return [
    "# Gate 64A Silent Missing-Atom Audit",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Boundary",
    "",
    "- Audit only: COT, Strength, and Regime expected atoms versus emitted ledgers and Gate 63 matrix visibility.",
    "- No Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning, Regime source mutation, or broad Brain refactor.",
    "",
    "## Denominator",
    "",
    "```json",
    JSON.stringify(summary.denominator, null, 2),
    "```",
    "",
    "## Missing Required Atoms",
    "",
    "```json",
    JSON.stringify(missingReport, null, 2),
    "```",
    "",
    "## Matrix Visibility",
    "",
    "```json",
    JSON.stringify(visibility, null, 2),
    "```",
    "",
    "## Decision",
    "",
    "Valuation gap is the required conceptual Regime atom that is not emitted in Gate 63. It is routed to Gate 64B. No other required atom was silently missing from the source ledgers audited here.",
    "",
    "## Artifacts",
    "",
    `- Expected inventory: \`${summary.artifacts.expectedInventory}\``,
    `- Emitted map: \`${summary.artifacts.emittedMap}\``,
    `- Missing report: \`${summary.artifacts.missingReport}\``,
    `- Matrix visibility: \`${summary.artifacts.matrixVisibility}\``,
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
  const bprPairPath = path.join(options.gate60gDir, "gate60g-bpr-pair-direction-ledger.rows.jsonl");
  const bprRows = await readJsonl<BprPairDirectionRow>(bprPairPath);
  const gate60cSummaryPath = path.join(options.gate60cDir, "gate60c-regime-source-atom-fill.summary.json");
  const gate60cRegistryPath = path.join(options.gate60cDir, "gate60c-regime-source-registry-v2.contract.json");
  const gate60hSummaryPath = path.join(options.gate60hDir, "gate60h-bpr-source-direction-eligibility-summary.json");
  const gate61bInventoryPath = path.join(options.gate61bDir, "universal-cell-atom-inventory.contract.json");
  const gate63ContractsPath = path.join(options.gate63Dir, "gate63-universal-atom-candidate-contracts.json");
  const gate60cSummary = await readJson<Record<string, unknown>>(gate60cSummaryPath);
  const gate63Contracts = await readJson<{ candidate_contracts: Array<{ candidate_id: string; atom_keys?: string[] }> }>(
    gate63ContractsPath,
  );
  const matrixByAtom = matrixVisibilityMap(gate63Contracts.candidate_contracts);
  const expectedInventory = expectedAtoms();
  const emittedMap = buildAtomMap(expectedInventory, alphaRows, gate60cSummary, bprRows, matrixByAtom);
  const weekShape = rowsPerWeek(alphaRows);
  const valuationGapRows = emittedMap.filter((row) => row.atom_id === "valuation_gap");
  const requiredMissingRows = emittedMap.filter((row) => row.required_before_body_decision === "required_now");
  const nonValuationRequiredMissing = requiredMissingRows.filter((row) => row.atom_id !== "valuation_gap");
  const pass =
    alphaRows.length === EXPECTED_ROWS &&
    weekShape.weeks === EXPECTED_WEEKS &&
    weekShape.full_weeks === EXPECTED_WEEKS &&
    duplicateCount(alphaRows.map((row) => `${row.week.week_open_utc}|${row.instrument.symbol}`)) === 0 &&
    bprRows.length === EXPECTED_ROWS &&
    valuationGapRows.length === 1 &&
    nonValuationRequiredMissing.length === 0;

  const missingReport = {
    required_missing_count: requiredMissingRows.length,
    required_missing_atoms: requiredMissingRows.map((row) => ({
      cell_id: row.cell_id,
      atom_id: row.atom_id,
      decision_reason: row.decision_reason,
      route: row.atom_id === "valuation_gap" ? "Gate 64B valuation-gap derived atom lock" : "stop_before_gate64b",
    })),
    non_valuation_required_missing_count: nonValuationRequiredMissing.length,
    valuation_gap_status: valuationGapRows[0],
  };
  const matrixVisibility = {
    matrix_visible_atoms: emittedMap.filter((row) => row.matrix_visible).map((row) => row.atom_id),
    emitted_not_matrix_visible_atoms: emittedMap
      .filter((row) => row.emitted_status === "emitted" && !row.matrix_visible)
      .map((row) => ({
        atom_id: row.atom_id,
        cell_id: row.cell_id,
        atom_class: row.atom_class,
        decision: row.required_before_body_decision,
      })),
    conceptual_not_matrix_visible_atoms: emittedMap.filter((row) => row.emitted_status === "conceptual_fail_closed").map((row) => row.atom_id),
  };

  const artifactPaths = {
    expectedInventory: toRepoRelative(path.join(artifactDir, "expected-atom-inventory.contract.json")),
    emittedMap: toRepoRelative(path.join(artifactDir, "emitted-vs-expected-atom-map.json")),
    missingReport: toRepoRelative(path.join(artifactDir, "missing-atom-report.json")),
    matrixVisibility: toRepoRelative(path.join(artifactDir, "matrix-visibility-report.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate64a-silent-missing-atom-audit.sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_SILENT_MISSING_ATOM_AUDIT__VALUATION_GAP_REQUIRED_FOR_GATE64B__NO_OTHER_REQUIRED_MISSING"
      : "FAIL_SILENT_MISSING_ATOM_AUDIT",
    denominator: {
      alpha_rows: alphaRows.length,
      expected_alpha_rows: EXPECTED_ROWS,
      alpha_weeks: weekShape.weeks,
      expected_alpha_weeks: EXPECTED_WEEKS,
      symbols_per_week_histogram: weekShape.histogram,
      expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
      full_weeks: weekShape.full_weeks,
      duplicate_week_symbol_rows: duplicateCount(alphaRows.map((row) => `${row.week.week_open_utc}|${row.instrument.symbol}`)),
      bpr_pair_direction_rows: bprRows.length,
      expected_atom_count: expectedInventory.length,
      required_missing_count: requiredMissingRows.length,
      non_valuation_required_missing_count: nonValuationRequiredMissing.length,
      valuation_gap_missing: true,
      source_mutation_rows: bprRows.filter((row) => row.source_rows_mutated).length,
    },
    decisions: {
      required_now: requiredMissingRows.map((row) => row.atom_id),
      optional_shadow_only: emittedMap.filter((row) => row.required_before_body_decision === "optional_shadow_only").map((row) => row.atom_id),
      already_covered: emittedMap.filter((row) => row.required_before_body_decision === "already_covered").map((row) => row.atom_id),
      fail_closed_with_reason: emittedMap.filter((row) => row.required_before_body_decision === "fail_closed_with_reason").map((row) => row.atom_id),
    },
    input_hashes: {
      gate59_alpha_ledger: await fileHash(options.alphaLedgerPath),
      gate60c_summary: await fileHash(gate60cSummaryPath),
      gate60c_registry: await fileHash(gate60cRegistryPath),
      gate60g_bpr_pair_direction_ledger: await fileHash(bprPairPath),
      gate60h_summary: await fileHash(gate60hSummaryPath),
      gate61b_inventory: await fileHash(gate61bInventoryPath),
      gate63_candidate_contracts: await fileHash(gate63ContractsPath),
    },
    stop_line:
      "Stop Gate 64A after audit. Proceed to Gate 64B only because valuation_gap is the only required missing atom and it can be tested against existing valuation inputs without source mutation.",
    artifacts: artifactPaths,
  };

  const expectedInventoryPath = path.join(artifactDir, "expected-atom-inventory.contract.json");
  const emittedMapPath = path.join(artifactDir, "emitted-vs-expected-atom-map.json");
  const missingReportPath = path.join(artifactDir, "missing-atom-report.json");
  const matrixVisibilityPath = path.join(artifactDir, "matrix-visibility-report.json");
  const summaryPath = path.join(artifactDir, "gate64a-silent-missing-atom-audit.summary.json");
  const shaPath = path.join(artifactDir, "gate64a-silent-missing-atom-audit.sha256.txt");

  await writeFile(
    expectedInventoryPath,
    `${JSON.stringify({ gate_id: GATE_ID, brain_architecture: BRAIN_ARCHITECTURE, expected_atoms: expectedInventory }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(emittedMapPath, `${JSON.stringify({ gate_id: GATE_ID, atoms: emittedMap }, null, 2)}\n`, "utf8");
  await writeFile(missingReportPath, `${JSON.stringify({ gate_id: GATE_ID, ...missingReport }, null, 2)}\n`, "utf8");
  await writeFile(matrixVisibilityPath, `${JSON.stringify({ gate_id: GATE_ID, ...matrixVisibility }, null, 2)}\n`, "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(summary, missingReport, matrixVisibility), "utf8");

  const contentInvariant = sha256Stable({
    denominator: summary.denominator,
    expected_atoms: expectedInventory.map((row) => row.atom_id),
    emitted_map_hash: sha256Stable(emittedMap),
    missing_report_hash: sha256Stable(missingReport),
    visibility_hash: sha256Stable(matrixVisibility),
    input_hashes: summary.input_hashes,
  });
  const shaLines = [
    `gate_id ${GATE_ID}`,
    `command ${COMMAND}`,
    `generated_at ${summary.generated_at}`,
    `git_commit ${summary.git_commit}`,
    `verdict ${summary.verdict}`,
    `expected_inventory ${await fileHash(expectedInventoryPath)} ${toRepoRelative(expectedInventoryPath)}`,
    `emitted_map ${await fileHash(emittedMapPath)} ${toRepoRelative(emittedMapPath)}`,
    `missing_report ${await fileHash(missingReportPath)} ${toRepoRelative(missingReportPath)}`,
    `matrix_visibility ${await fileHash(matrixVisibilityPath)} ${toRepoRelative(matrixVisibilityPath)}`,
    `summary_json ${await fileHash(summaryPath)} ${toRepoRelative(summaryPath)}`,
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
  console.log(`Expected atoms: ${expectedInventory.length}`);
  console.log(`Required missing: ${requiredMissingRows.map((row) => row.atom_id).join(", ")}`);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
  console.log(`SHA identity: ${toRepoRelative(shaPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
