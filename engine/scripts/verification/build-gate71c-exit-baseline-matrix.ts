import { mkdir } from "node:fs/promises";
import path from "node:path";

import { getPool } from "@database/db/client";
import { clearRuntimeCacheByPrefix } from "@engine/cache/runtimeCache";
import { assertBasketPathWarehouseReady } from "@engine/research/basketPathWarehouse";

import { fileHash, gitCommit, parseArgMap, toRepoRelative, writeJson, writeJsonl, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  DEFAULT_GATE71A_DIR,
  DEFAULT_GATE71B_DIR,
  DEFAULT_GATE71C_DIR,
  GATE71_DATE,
  GATE71_EXIT_MATRIX,
  GATE71_EXPECTED_WEEKS,
  buildCandidateBWeeklyBasketPathFromWarehouse,
  buildGate71BasketPathWarehouseConfig,
  buildGate71BasketPathWarehouseManifestId,
  buildCandidateBWeeklyBasketPath,
  evaluateExitRule,
  groupCandidateBRowsByWeek,
  loadLegacyAdrGridControlsByWeek,
  loadCandidateBRows,
  loadGate71aSummary,
  preloadGate71AdrMaps,
  summarizeExitResults,
  validateCandidateBRows,
} from "./gate71-utils";
import { readJson } from "./gate65-utils";

const GATE_ID = "Gate 71C: exit-baseline-matrix";
const COMMAND = "npm run engine:gate71c:exit-baseline-matrix";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate71c/GATE71C_EXIT_BASELINE_MATRIX_${GATE71_DATE}.md`;

type Gate71bSummary = {
  verdict: string;
  validation: {
    weeks_built: number;
    expected_weeks: number;
    legacy_adr_grid_used_as_foundation: boolean;
    exit_selection_started: boolean;
    risk_filters_started: boolean;
    basket_path_warehouse_id?: string | null;
    raw_m1_rebuild_performed?: boolean;
  };
};

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE71C_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate71aDir: args.get("--gate71a-dir") ?? DEFAULT_GATE71A_DIR,
    gate71bDir: args.get("--gate71b-dir") ?? DEFAULT_GATE71B_DIR,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
    basketPathWarehouseId: args.get("--basket-path-warehouse-id"),
    allowRawPathBuild: process.argv.includes("--allow-raw-path-build"),
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
    logProgress: process.argv.includes("--log-progress"),
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 71C Exit Baseline Matrix",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Executes the predeclared basket-exit matrix against the clean Gate 71A/71B basket path.",
    "- Replays exit policies from the Gate 71B-M frozen basket path warehouse by default.",
    "- Keeps legacy ADR Grid as a control only.",
    "- Excludes time-based profit capture and pure peak trailing from first-pass execution unless later diagnostics justify them.",
    "- Does not promote an exit, apply risk filters, prune pairs, or mutate Candidate B.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Top Preview",
    "",
    "```json",
    JSON.stringify(summary.top_preview, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Predeclared matrix: \`${summary.artifacts["predeclaredMatrix"]}\``,
    `- Weekly matrix rows: \`${summary.artifacts["weeklyMatrixRows"]}\``,
    `- Candidate summaries: \`${summary.artifacts["candidateSummaries"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 71C is a baseline matrix execution only. It ranks for review but does not promote an exit rule.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  if (options.maxWeeks !== null && (!Number.isInteger(options.maxWeeks) || options.maxWeeks <= 0)) {
    throw new Error(`Invalid --max-weeks: ${options.maxWeeks}`);
  }
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate71a = await loadGate71aSummary(options.gate71aDir);
  const gate71b = await readJson<Gate71bSummary>(path.join(options.gate71bDir, "gate71b-summary.json"));
  const rows = await loadCandidateBRows(options.candidateBLedgerPath);
  const denominator = validateCandidateBRows(rows);
  const candidateBLedgerHash = await fileHash(options.candidateBLedgerPath);
  const weeks = groupCandidateBRowsByWeek(rows).slice(0, options.maxWeeks ?? undefined);
  const selectedWeekIds = weeks.map(([weekOpenUtc]) => weekOpenUtc);
  const basketWarehouseConfig = buildGate71BasketPathWarehouseConfig({
    rows,
    weeks: selectedWeekIds,
    candidateBLedgerHash,
    entryExposureModelId: gate71a.protocol.clean_entry_exposure_model_id,
  });
  const basketPathWarehouseId = options.basketPathWarehouseId
    ?? gate71b.validation.basket_path_warehouse_id
    ?? buildGate71BasketPathWarehouseManifestId(basketWarehouseConfig);
  if (!options.allowRawPathBuild) {
    await assertBasketPathWarehouseReady({
      manifestId: basketPathWarehouseId,
      expectedWeeks: selectedWeekIds,
      config: basketWarehouseConfig,
    });
  }
  const adrMaps = options.allowRawPathBuild
    ? await preloadGate71AdrMaps({
        weeks: selectedWeekIds,
        symbols: rows.map((row) => row.symbol),
      })
    : new Map();
  const legacyControls = await loadLegacyAdrGridControlsByWeek({
    rows: weeks.flatMap(([, weekRows]) => weekRows),
  });
  const weeklyRows: Array<Record<string, unknown> & {
    rule_id: string;
    week_open_utc: string;
    year: number;
    exit_adr: number;
    closed_before_friday: boolean;
    stopped_out: boolean;
    available: boolean;
  }> = [];
  const startedAt = Date.now();

  for (const [index, [weekOpenUtc, weekRows]] of weeks.entries()) {
    const built = options.allowRawPathBuild
      ? await buildCandidateBWeeklyBasketPath({
          weekOpenUtc,
          rows: weekRows,
          candidateBLedgerHash,
          entryExposureModelId: gate71a.protocol.clean_entry_exposure_model_id,
          includePoints: true,
          includeLegacyAdrGridControl: false,
          adrMap: adrMaps.get(weekOpenUtc),
        })
      : await buildCandidateBWeeklyBasketPathFromWarehouse({
          manifestId: basketPathWarehouseId,
          weekOpenUtc,
        });
    built.legacyAdrGridControl = legacyControls.controls.get(weekOpenUtc) ?? built.legacyAdrGridControl;
    for (const rule of GATE71_EXIT_MATRIX) {
      const result = evaluateExitRule(rule, built);
      weeklyRows.push({
        schema_version: 1,
        gate_id: GATE_ID,
        rule_id: rule.id,
        rule_family: rule.family,
        week_open_utc: weekOpenUtc,
        year: built.diagnostic.year,
        exit_adr: result.exit_adr,
        exit_timestamp_utc: result.exit_timestamp_utc,
        exit_reason: result.exit_reason,
        closed_before_friday: result.closed_before_friday,
        stopped_out: result.stopped_out,
        available: result.available,
        candidate_b_ledger_hash: candidateBLedgerHash,
        path_diagnostic_hash: built.diagnostic.content_hash,
      });
    }
    if (options.logProgress) {
      console.log(`gate71c ${options.allowRawPathBuild ? "rawWeek" : "warehouseWeek"}=${index + 1}/${weeks.length} ${weekOpenUtc.slice(0, 10)} rules=${GATE71_EXIT_MATRIX.length}`);
    }
    if (options.allowRawPathBuild) {
      clearRuntimeCacheByPrefix("pathBarLoader");
      clearRuntimeCacheByPrefix("pathBarTimelines");
    }
  }

  const summaries = GATE71_EXIT_MATRIX.map((rule) => ({
    rule,
    summary: summarizeExitResults(weeklyRows.filter((row) => row.rule_id === rule.id)),
  })).map((row) => ({
    rule_id: row.rule.id,
    rule_family: row.rule.family,
    rule: row.rule,
    ...row.summary,
  }));
  const topPreview = summaries
    .filter((row) => row.unavailable_weeks === 0)
    .sort((left, right) =>
      right.profitable_week_rate - left.profitable_week_rate ||
      right.total_adr - left.total_adr ||
      right.max_drawdown_adr - left.max_drawdown_adr ||
      left.rule_id.localeCompare(right.rule_id),
    )
    .slice(0, 10)
    .map((row) => ({
      rule_id: row.rule_id,
      family: row.rule_family,
      profitable_week_rate: row.profitable_week_rate,
      total_adr: row.total_adr,
      max_drawdown_adr: row.max_drawdown_adr,
      worst_week_adr: row.worst_week_adr,
      negative_years: row.negative_years,
    }));
  const matrix = {
    gate_id: GATE_ID,
    matrix_version: "gate71_candidate_b_basket_exit_baseline_matrix_v1",
    executed_rule_count: GATE71_EXIT_MATRIX.length,
    excluded_first_pass_families: [
      "time_based_profit_capture",
      "pure_peak_trailing",
      "pair_specific_exits",
      "regime_specific_exits",
      "risk_or_fair_value_pruning",
    ],
    rules: GATE71_EXIT_MATRIX,
  };
  const runtimeSeconds = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
  const artifacts = {
    predeclaredMatrix: toRepoRelative(path.join(artifactDir, "predeclared-exit-baseline-matrix.json")),
    weeklyMatrixRows: toRepoRelative(path.join(artifactDir, "exit-baseline-matrix.weekly.rows.jsonl")),
    candidateSummaries: toRepoRelative(path.join(artifactDir, "exit-baseline-matrix.candidate-summaries.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate71c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate71c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  await writeJson(path.join(artifactDir, "predeclared-exit-baseline-matrix.json"), matrix);
  await writeJsonl(path.join(artifactDir, "exit-baseline-matrix.weekly.rows.jsonl"), weeklyRows);
  await writeJson(path.join(artifactDir, "exit-baseline-matrix.candidate-summaries.json"), summaries);
  const pass =
    gate71a.verdict.startsWith("PASS_") &&
    gate71b.verdict.startsWith("PASS_") &&
    gate71b.validation.legacy_adr_grid_used_as_foundation === false &&
    gate71b.validation.exit_selection_started === false &&
    gate71b.validation.risk_filters_started === false &&
    options.allowRawPathBuild === false &&
    denominator.forced28_preserved &&
    weeks.length === (options.maxWeeks ?? GATE71_EXPECTED_WEEKS) &&
    weeklyRows.length === weeks.length * GATE71_EXIT_MATRIX.length;
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE71C_EXIT_BASELINE_MATRIX__PREDECLARED_BASKET_RULES_SCORED" : "FAIL_GATE71C_EXIT_BASELINE_MATRIX",
    validation: {
      gate71a_passed: gate71a.verdict.startsWith("PASS_"),
      gate71b_passed: gate71b.verdict.startsWith("PASS_"),
      candidate_b_forced28_preserved: denominator.forced28_preserved,
      clean_basket_path_used: true,
      basket_path_warehouse_id: basketPathWarehouseId,
      exit_policy_replay_from_frozen_warehouse: !options.allowRawPathBuild,
      raw_m1_rebuild_performed: options.allowRawPathBuild,
      legacy_adr_grid_used_as_foundation: false,
      legacy_adr_grid_control_only: true,
      rules_scored: GATE71_EXIT_MATRIX.length,
      legacy_adr_grid_control_warehouse_id: legacyControls.warehouse_manifest_id,
      legacy_adr_grid_control_missing_weeks: legacyControls.missing_week_count,
      weeks_scored: weeks.length,
      weekly_matrix_rows: weeklyRows.length,
      expected_weekly_matrix_rows: weeks.length * GATE71_EXIT_MATRIX.length,
      time_based_profit_capture_executed: false,
      pure_peak_trailing_executed: false,
      pair_specific_exits_executed: false,
      regime_specific_exits_executed: false,
      risk_filters_started: false,
      brain_truth_mutated: false,
      exit_promotion_performed: false,
      runtime_seconds: runtimeSeconds,
    },
    top_preview: topPreview,
    artifacts,
  };
  await writeJson(path.join(artifactDir, "gate71c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate71c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "predeclared_matrix", path: path.join(artifactDir, "predeclared-exit-baseline-matrix.json") },
    { label: "weekly_matrix_rows", path: path.join(artifactDir, "exit-baseline-matrix.weekly.rows.jsonl") },
    { label: "candidate_summaries", path: path.join(artifactDir, "exit-baseline-matrix.candidate-summaries.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate71c-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation: summary.validation, top_preview: topPreview }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Pool may not have been created.
    }
    if (process.exitCode && process.exitCode !== 0) process.exit(process.exitCode);
  });
