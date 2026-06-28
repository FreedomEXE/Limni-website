import { mkdir } from "node:fs/promises";
import path from "node:path";

import { getPool } from "@database/db/client";
import { clearRuntimeCacheByPrefix } from "@engine/cache/runtimeCache";

import { fileHash, gitCommit, parseArgMap, toRepoRelative, writeJson, writeJsonl, writeShaManifest, writeText } from "./gate65-utils";
import {
  ADVERSE_THRESHOLDS_ADR,
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  DEFAULT_GATE71A_DIR,
  DEFAULT_GATE71B_DIR,
  GATE71_DATE,
  GATE71_EXPECTED_WEEKS,
  POSITIVE_THRESHOLDS_ADR,
  buildCandidateBWeeklyBasketPath,
  groupCandidateBRowsByWeek,
  loadCandidateBRows,
  loadGate71aSummary,
  preloadGate71AdrMaps,
  validateCandidateBRows,
} from "./gate71-utils";

const GATE_ID = "Gate 71B: basket-adr-path-diagnostics";
const COMMAND = "npm run engine:gate71b:basket-adr-path-diagnostics";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate71b/GATE71B_BASKET_ADR_PATH_DIAGNOSTICS_${GATE71_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_GATE71B_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate71aDir: args.get("--gate71a-dir") ?? DEFAULT_GATE71A_DIR,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
    logProgress: process.argv.includes("--log-progress"),
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 71B Basket ADR Path Diagnostics",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Builds the non-selective Candidate B weekly basket ADR path diagnostic ledger.",
    "- Uses the Gate 71A clean weekly basket-hold exposure model, not legacy ADR Grid.",
    "- Records compact MFE/MAE/threshold/giveback diagnostics; full minute paths are regenerated deterministically for matrix scoring.",
    "- Does not select exits, apply risk filters, prune pairs, or mutate Candidate B.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Diagnostic Summary",
    "",
    "```json",
    JSON.stringify(summary.diagnostic_summary, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Weekly path diagnostics: \`${summary.artifacts["weeklyPathDiagnostics"]}\``,
    `- Threshold summary: \`${summary.artifacts["thresholdSummary"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 71B is diagnostics only. Exit selection and promotion are not performed here.",
    "",
  ].join("\n");
}

function rate(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 1_000_000) / 1_000_000 : 0;
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
  const rows = await loadCandidateBRows(options.candidateBLedgerPath);
  const denominator = validateCandidateBRows(rows);
  const candidateBLedgerHash = gate71a.validation.candidate_b_hash_locked
    ? (await fileHash(options.candidateBLedgerPath)).toUpperCase()
    : await fileHash(options.candidateBLedgerPath);
  const weeks = groupCandidateBRowsByWeek(rows).slice(0, options.maxWeeks ?? undefined);
  const adrMaps = await preloadGate71AdrMaps({
    weeks: weeks.map(([weekOpenUtc]) => weekOpenUtc),
    symbols: rows.map((row) => row.symbol),
  });
  const diagnosticRows = [];
  const startedAt = Date.now();

  for (const [index, [weekOpenUtc, weekRows]] of weeks.entries()) {
    const built = await buildCandidateBWeeklyBasketPath({
      weekOpenUtc,
      rows: weekRows,
      candidateBLedgerHash,
      entryExposureModelId: gate71a.protocol.clean_entry_exposure_model_id,
      includePoints: false,
      includeLegacyAdrGridControl: false,
      adrMap: adrMaps.get(weekOpenUtc),
    });
    diagnosticRows.push(built.diagnostic);
    if (options.logProgress) {
      console.log(`gate71b week=${index + 1}/${weeks.length} ${weekOpenUtc.slice(0, 10)} close=${built.diagnostic.friday_close_adr}`);
    }
    clearRuntimeCacheByPrefix("pathBarLoader");
    clearRuntimeCacheByPrefix("pathBarTimelines");
  }

  const thresholdSummary = {
    gate_id: GATE_ID,
    weeks: diagnosticRows.length,
    positive_hit_rates: Object.fromEntries(POSITIVE_THRESHOLDS_ADR.map((threshold) => {
      const key = `plus_${String(Math.round(threshold * 100)).padStart(3, "0")}`;
      return [key, rate(diagnosticRows.filter((row) => row.first_positive_hits[key] !== null).length, diagnosticRows.length)];
    })),
    adverse_hit_rates: Object.fromEntries(ADVERSE_THRESHOLDS_ADR.map((threshold) => {
      const key = `minus_${String(Math.round(Math.abs(threshold) * 100)).padStart(3, "0")}`;
      return [key, rate(diagnosticRows.filter((row) => row.first_adverse_hits[key] !== null).length, diagnosticRows.length)];
    })),
    profit_before_drawdown_rate: rate(diagnosticRows.filter((row) => row.profit_before_drawdown === true).length, diagnosticRows.filter((row) => row.profit_before_drawdown !== null).length),
    drawdown_before_profit_rate: rate(diagnosticRows.filter((row) => row.drawdown_before_profit === true).length, diagnosticRows.filter((row) => row.drawdown_before_profit !== null).length),
    average_peak_to_friday_giveback_adr: diagnosticRows.length > 0
      ? Math.round((diagnosticRows.reduce((sum, row) => sum + row.peak_to_friday_giveback_adr, 0) / diagnosticRows.length) * 1_000_000) / 1_000_000
      : 0,
    max_mfe_adr: diagnosticRows.length > 0 ? Math.max(...diagnosticRows.map((row) => row.mfe_adr)) : 0,
    min_mae_adr: diagnosticRows.length > 0 ? Math.min(...diagnosticRows.map((row) => row.mae_adr)) : 0,
    missing_price_weeks: diagnosticRows.filter((row) => row.missing_price_symbols.length > 0).length,
    default_adr_weeks: diagnosticRows.filter((row) => row.default_adr_symbols.length > 0).length,
  };
  const runtimeSeconds = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
  const artifacts = {
    weeklyPathDiagnostics: toRepoRelative(path.join(artifactDir, "candidate-b-basket-adr-path-diagnostics.rows.jsonl")),
    thresholdSummary: toRepoRelative(path.join(artifactDir, "threshold-hit-summary.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate71b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate71b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  await writeJsonl(path.join(artifactDir, "candidate-b-basket-adr-path-diagnostics.rows.jsonl"), diagnosticRows);
  await writeJson(path.join(artifactDir, "threshold-hit-summary.json"), thresholdSummary);
  const pathLedgerHash = await fileHash(path.join(artifactDir, "candidate-b-basket-adr-path-diagnostics.rows.jsonl"));
  const pass =
    gate71a.verdict.startsWith("PASS_") &&
    denominator.forced28_preserved &&
    diagnosticRows.length === (options.maxWeeks ?? GATE71_EXPECTED_WEEKS) &&
    diagnosticRows.every((row) => row.decision_rows === 28) &&
    diagnosticRows.every((row) => row.missing_price_symbols.length === 0);
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE71B_BASKET_ADR_PATH_DIAGNOSTICS__CLEAN_PATH_LEDGER_BUILT" : "FAIL_GATE71B_BASKET_ADR_PATH_DIAGNOSTICS",
    validation: {
      gate71a_passed: gate71a.verdict.startsWith("PASS_"),
      candidate_b_forced28_preserved: denominator.forced28_preserved,
      clean_entry_exposure_model_id: gate71a.protocol.clean_entry_exposure_model_id,
      legacy_adr_grid_used_as_foundation: false,
      legacy_adr_grid_control_only: true,
      weeks_built: diagnosticRows.length,
      expected_weeks: options.maxWeeks ?? GATE71_EXPECTED_WEEKS,
      all_weeks_have_28_rows: diagnosticRows.every((row) => row.decision_rows === 28),
      missing_price_weeks: thresholdSummary.missing_price_weeks,
      default_adr_weeks: thresholdSummary.default_adr_weeks,
      exit_selection_started: false,
      risk_filters_started: false,
      brain_truth_mutated: false,
      runtime_seconds: runtimeSeconds,
      path_ledger_sha256: pathLedgerHash,
    },
    diagnostic_summary: thresholdSummary,
    artifacts,
  };
  await writeJson(path.join(artifactDir, "gate71b-summary.json"), summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(path.join(artifactDir, "gate71b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "weekly_path_diagnostics", path: path.join(artifactDir, "candidate-b-basket-adr-path-diagnostics.rows.jsonl") },
    { label: "threshold_summary", path: path.join(artifactDir, "threshold-hit-summary.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate71b-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation: summary.validation, diagnostic_summary: thresholdSummary }, null, 2));
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
