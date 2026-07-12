import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_GATE65C_DIR,
  DEFAULT_GATE65D_DIR,
  EXPECTED_ROWS,
  EXPECTED_SYMBOLS_PER_WEEK,
  EXPECTED_WEEKS,
  countBy,
  gitCommit,
  parseArgMap,
  renderTable,
  toRepoRelative,
  writeJson,
  writeJsonl,
  writeShaManifest,
  writeText,
} from "./gate65-utils";
import {
  CellId,
  DEFAULT_GATE67A_DIR,
  GATE67_DATE,
  buildCellOpinionLedger,
  forced28Validation,
  loadGate67Inputs,
  summarizeCellOpinions,
} from "./gate67-utils";

const GATE_ID = "Gate 67A: cell-opinion-packet-contract";
const COMMAND = "npm run engine:gate67a:cell-opinion-packet-contract";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate67a/GATE67A_CELL_OPINION_PACKET_CONTRACT_${GATE67_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE67A_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate65cDir: args.get("--gate65c-dir") ?? DEFAULT_GATE65C_DIR,
    gate65dDir: args.get("--gate65d-dir") ?? DEFAULT_GATE65D_DIR,
  };
}

function renderReport(summary: Record<string, unknown>, roleRows: Array<Record<string, unknown>>, qualityRows: Array<Record<string, unknown>>) {
  return [
    "# Gate 67A Cell Opinion Packet Contract",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Converts Gate 65 atom policy and scenario context into compact cell opinion packets.",
    "- Emits one packet per COT, Strength, and Regime cell for every pair-week.",
    "- Does not emit a final forced-28 algorithm direction.",
    "- Does not use outcome fields for opinion assignment.",
    "",
    "## Role Counts By Cell",
    "",
    renderTable(roleRows, ["cell_id", "role", "rows"]),
    "",
    "## Quality Counts By Cell",
    "",
    renderTable(qualityRows, ["cell_id", "quality_state", "rows"]),
    "",
    "## Forced-28 Joinability",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Contract: \`${summary.artifacts["contractJson"]}\``,
    `- Opinion ledger: \`${summary.artifacts["ledgerRows"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- Quality summary: \`${summary.artifacts["qualitySummary"]}\``,
    `- Year summary: \`${summary.artifacts["yearSummary"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 67A stops at cell opinion packets. It does not define or score the final forced-28 algorithm.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const inputs = await loadGate67Inputs({ gate65cDir: options.gate65cDir, gate65dDir: options.gate65dDir });
  const rows = buildCellOpinionLedger(inputs.alphaRows, inputs.policyRows, inputs.scenarioRows);
  const cells: CellId[] = ["cot", "strength", "regime"];
  const duplicateOpinionRows = Object.values(countBy(rows, (row) => row.row_key)).filter((count) => count > 1).length;
  const rowsByAlpha = countBy(rows, (row) => row.alpha_row_key);
  const rowsPerAlphaHistogram = countBy(Object.values(rowsByAlpha), (count) => String(count));
  const rowsByCell = countBy(rows, (row) => row.cell_id);
  const missingCellRows = cells.filter((cell) => rowsByCell[cell] !== EXPECTED_ROWS);
  const alphaShape = forced28Validation(inputs.alphaRows.length, 0, new Set(inputs.alphaRows.map((row) => row.week.week_open_utc)).size, EXPECTED_WEEKS);
  const opinionSummary = summarizeCellOpinions(rows);
  const roleRows = opinionSummary.role_counts_by_cell as Array<Record<string, unknown>>;
  const qualityRows = opinionSummary.quality_counts_by_cell as Array<Record<string, unknown>>;
  const qualitySummary = {
    gate_id: GATE_ID,
    quality_counts_by_cell: qualityRows,
    direct_vote_allowed_by_cell: opinionSummary.direct_vote_allowed_by_cell,
    warning_active_by_cell: opinionSummary.warning_active_by_cell,
  };
  const yearSummary = {
    gate_id: GATE_ID,
    year_counts_by_cell_role: opinionSummary.year_counts_by_cell_role,
  };
  const contract = {
    gate_id: GATE_ID,
    contract_version: "gate67a_cell_opinion_packet_contract_v0",
    required_rows_per_cell: EXPECTED_ROWS,
    required_cells: cells,
    row_shape: {
      row_key: "string",
      week_open_utc: "ISO string",
      symbol: "FX pair",
      cell_id: "cot | strength | regime",
      primary_direction: "BASE_CURRENCY | QUOTE_CURRENCY | ABSTAIN",
      role: "ANCHOR | CONFIRM | WARNING | TIE_BREAKER | CONTEXT | ABSTAIN",
      confidence: "LOW | MEDIUM | HIGH",
      quality_state: "CLEAN | CAUTION | DEGRADED | FAIL_CLOSED",
      direct_vote_allowed: "boolean",
      warning_active: "boolean",
      confirmation_target: "optional string",
      source_atom_ids: "string[]",
      reason_codes: "string[]",
      content_hash: "stable sha256",
    },
    assignment_inputs: [
      "Gate 65C atom policy ledger roles and allowed final algorithm use",
      "Gate 65D scenario memory fingerprint binding for context only",
      "Gate 59 Alpha v1 pair-week denominator",
    ],
    outcome_fields_used_for_opinion_assignment: false,
    final_algorithm_direction_emitted: false,
  };
  const pass =
    rows.length === EXPECTED_ROWS * cells.length &&
    duplicateOpinionRows === 0 &&
    missingCellRows.length === 0 &&
    rowsPerAlphaHistogram[String(cells.length)] === EXPECTED_ROWS &&
    alphaShape.forced28_preserved;
  const artifacts = {
    contractJson: toRepoRelative(path.join(artifactDir, "cell-opinion-contract.json")),
    ledgerRows: toRepoRelative(path.join(artifactDir, "cell-opinion-ledger.rows.jsonl")),
    summaryJson: toRepoRelative(path.join(artifactDir, "cell-opinion-summary.json")),
    qualitySummary: toRepoRelative(path.join(artifactDir, "cell-opinion-quality-summary.json")),
    yearSummary: toRepoRelative(path.join(artifactDir, "cell-opinion-year-summary.json")),
    gateSummary: toRepoRelative(path.join(artifactDir, "gate67a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate67a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_CELL_OPINION_PACKET_CONTRACT__THREE_CELLS_FORCED28_JOINABLE__NO_FINAL_ALGORITHM_DIRECTION" : "FAIL_CELL_OPINION_PACKET_CONTRACT",
    row_count: rows.length,
    expected_row_count: EXPECTED_ROWS * cells.length,
    rows_per_alpha_histogram: rowsPerAlphaHistogram,
    missing_cell_rows: missingCellRows,
    duplicate_opinion_rows: duplicateOpinionRows,
    validation: {
      alpha_denominator: alphaShape,
      expected_symbols_per_week: EXPECTED_SYMBOLS_PER_WEEK,
      one_packet_per_cell_per_pair_week: rowsPerAlphaHistogram[String(cells.length)] === EXPECTED_ROWS,
      every_cell_has_expected_rows: missingCellRows.length === 0,
      duplicate_opinion_rows: duplicateOpinionRows,
      outcome_fields_used_for_opinion_assignment: false,
      final_algorithm_direction_emitted: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "cell-opinion-contract.json"), contract);
  await writeJsonl(path.join(artifactDir, "cell-opinion-ledger.rows.jsonl"), rows);
  await writeJson(path.join(artifactDir, "cell-opinion-summary.json"), opinionSummary);
  await writeJson(path.join(artifactDir, "cell-opinion-quality-summary.json"), qualitySummary);
  await writeJson(path.join(artifactDir, "cell-opinion-year-summary.json"), yearSummary);
  await writeJson(path.join(artifactDir, "gate67a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, roleRows, qualityRows));
  await writeShaManifest(path.join(artifactDir, "gate67a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "contract_json", path: path.join(artifactDir, "cell-opinion-contract.json") },
    { label: "ledger_rows", path: path.join(artifactDir, "cell-opinion-ledger.rows.jsonl") },
    { label: "summary_json", path: path.join(artifactDir, "cell-opinion-summary.json") },
    { label: "quality_summary", path: path.join(artifactDir, "cell-opinion-quality-summary.json") },
    { label: "year_summary", path: path.join(artifactDir, "cell-opinion-year-summary.json") },
    { label: "gate_summary", path: path.join(artifactDir, "gate67a-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation: summary.validation }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
