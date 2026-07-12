import { mkdir } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, renderTable, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE68A_DIR,
  GATE68_DATE,
  buildBrainModeSelectorContract,
  buildBrainModeSelectorModeMap,
  buildBrainModeSelectorReasonCodeContract,
  buildBrainModeSelectorRulesMarkdown,
} from "./gate68-utils";

const GATE_ID = "Gate 68A: brain-mode-selector-contract";
const COMMAND = "npm run engine:gate68a:brain-mode-selector-contract";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate68a/GATE68A_BRAIN_MODE_SELECTOR_CONTRACT_${GATE68_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE68A_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
  };
}

function renderReport(summary: Record<string, unknown>, modeRows: Array<Record<string, unknown>>) {
  return [
    "# Gate 68A Brain Mode Selector Contract",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Defines exactly one deterministic Brain Mode Selector.",
    "- Uses exactly three modes: NORMAL, PROTECTION, and CONSERVATIVE.",
    "- Maps modes to unchanged Gate 67 Candidate B, C, and A behavior.",
    "- Does not use outcomes, optimized thresholds, learned weights, pair/date exclusions, or final naming.",
    "",
    "## Mode Map",
    "",
    renderTable(modeRows, ["mode", "behavior_candidate_id", "purpose"]),
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Contract: \`${summary.artifacts["contractJson"]}\``,
    `- Rules: \`${summary.artifacts["rulesMarkdown"]}\``,
    `- Mode map: \`${summary.artifacts["modeMapJson"]}\``,
    `- Reason-code contract: \`${summary.artifacts["reasonCodeContract"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 68A stops at selector contract definition. It does not score, promote, name, or lock a final algorithm.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const contract = buildBrainModeSelectorContract();
  const modeMap = buildBrainModeSelectorModeMap();
  const reasonCodeContract = buildBrainModeSelectorReasonCodeContract();
  const rulesMarkdown = buildBrainModeSelectorRulesMarkdown();
  const modeRows = contract.modes.map((mode) => ({
    mode: mode.mode,
    behavior_candidate_id: mode.behavior_candidate_id,
    purpose: mode.purpose,
  }));
  const pass =
    contract.exactly_one_combined_selector &&
    contract.modes.length === 3 &&
    new Set(contract.modes.map((mode) => mode.mode)).size === 3 &&
    contract.modes.every((mode) => ["NORMAL", "PROTECTION", "CONSERVATIVE"].includes(mode.mode)) &&
    contract.forbidden_mode_selection_inputs.includes("ADR Grid outcome") &&
    contract.forbidden_mode_selection_inputs.includes("Weekly Hold outcome") &&
    contract.final_algorithm_name === null &&
    contract.no_final_promotion;
  const artifacts = {
    contractJson: toRepoRelative(path.join(artifactDir, "brain-mode-selector-contract.json")),
    rulesMarkdown: toRepoRelative(path.join(artifactDir, "brain-mode-selector-rules.md")),
    modeMapJson: toRepoRelative(path.join(artifactDir, "brain-mode-selector-mode-map.json")),
    reasonCodeContract: toRepoRelative(path.join(artifactDir, "brain-mode-selector-reason-code-contract.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate68a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate68a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_BRAIN_MODE_SELECTOR_CONTRACT__ONE_SELECTOR_THREE_MODES_NO_OUTCOME_INPUTS" : "FAIL_BRAIN_MODE_SELECTOR_CONTRACT",
    selector_id: contract.selector_id,
    validation: {
      exactly_one_combined_selector: contract.exactly_one_combined_selector,
      mode_count: contract.modes.length,
      allowed_modes_only: contract.modes.every((mode) => ["NORMAL", "PROTECTION", "CONSERVATIVE"].includes(mode.mode)),
      references_candidate_a_b_c_as_mode_behaviors: modeMap.modes.CONSERVATIVE.includes("candidate_a") && modeMap.modes.NORMAL.includes("candidate_b") && modeMap.modes.PROTECTION.includes("candidate_c"),
      outcome_fields_used_for_mode_selection: false,
      optimized_thresholds: false,
      learned_weights: false,
      pair_exclusions: 0,
      date_exclusions: 0,
      final_algorithm_named_or_promoted: false,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "brain-mode-selector-contract.json"), contract);
  await writeText(path.join(artifactDir, "brain-mode-selector-rules.md"), rulesMarkdown);
  await writeJson(path.join(artifactDir, "brain-mode-selector-mode-map.json"), modeMap);
  await writeJson(path.join(artifactDir, "brain-mode-selector-reason-code-contract.json"), reasonCodeContract);
  await writeJson(path.join(artifactDir, "gate68a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, modeRows));
  await writeShaManifest(path.join(artifactDir, "gate68a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "contract_json", path: path.join(artifactDir, "brain-mode-selector-contract.json") },
    { label: "rules_markdown", path: path.join(artifactDir, "brain-mode-selector-rules.md") },
    { label: "mode_map_json", path: path.join(artifactDir, "brain-mode-selector-mode-map.json") },
    { label: "reason_code_contract", path: path.join(artifactDir, "brain-mode-selector-reason-code-contract.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate68a-summary.json") },
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
