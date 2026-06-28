import { mkdir } from "node:fs/promises";
import path from "node:path";

import { getPool } from "@database/db/client";
import { getRuntimeCacheStats, resetRuntimeCacheStats } from "@engine/cache/runtimeCache";
import {
  beginBasketPathWarehouse,
  buildBasketPathWarehouseManifestId,
  completeBasketPathWarehouse,
  hashBasketPathWarehouseConfig,
  markBasketPathWarehouseFailed,
} from "@engine/research/basketPathWarehouse";

import { fileHash, gitCommit, parseArgMap, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  DEFAULT_GATE71A_DIR,
  GATE71_DATE,
  GATE71_EXPECTED_WEEKS,
  buildCandidateBWeeklyBasketPath,
  buildGate71BasketPathWarehouseConfig,
  groupCandidateBRowsByWeek,
  loadCandidateBRows,
  loadGate71aSummary,
  preloadGate71AdrMaps,
  validateCandidateBRows,
} from "./gate71-utils";

const GATE_ID = "Gate 71B-M: exit-path-materialization-warehouse";
const COMMAND = "npm run engine:gate71bm:exit-path-materialization-warehouse";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate71b/GATE71B_M_EXIT_PATH_MATERIALIZATION_WAREHOUSE_${GATE71_DATE}.md`;

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate71aDir: args.get("--gate71a-dir") ?? DEFAULT_GATE71A_DIR,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
    manifestId: args.get("--manifest-id"),
    overwrite: process.argv.includes("--overwrite"),
    logProgress: process.argv.includes("--log-progress"),
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
  };
}

function renderReport(summary: Record<string, unknown>) {
  return [
    "# Gate 71B-M Exit Path Materialization Warehouse",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Materializes the clean Candidate B weekly basket floating P/L path once per input/exposure version.",
    "- Separates expensive M1 path construction from cheap exit-policy replay.",
    "- Uses the Gate 71A clean weekly basket-hold exposure model; legacy ADR Grid remains control-only.",
    "- Does not select, optimize, or promote an exit rule.",
    "",
    "## Warehouse",
    "",
    "```json",
    JSON.stringify(summary.warehouse, null, 2),
    "```",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 71B-M is materialization only. Gate 71C must replay exit policies from this warehouse rather than rebuilding raw M1 paths.",
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
  resetRuntimeCacheStats();

  const gate71a = await loadGate71aSummary(options.gate71aDir);
  const rows = await loadCandidateBRows(options.candidateBLedgerPath);
  const denominator = validateCandidateBRows(rows);
  const candidateBLedgerHash = (await fileHash(options.candidateBLedgerPath)).toUpperCase();
  const weeks = groupCandidateBRowsByWeek(rows).slice(0, options.maxWeeks ?? undefined);
  const selectedWeekIds = weeks.map(([weekOpenUtc]) => weekOpenUtc);
  const config = buildGate71BasketPathWarehouseConfig({
    rows,
    weeks: selectedWeekIds,
    candidateBLedgerHash,
    entryExposureModelId: gate71a.protocol.clean_entry_exposure_model_id,
  });
  const manifestId = options.manifestId ?? buildBasketPathWarehouseManifestId(config);
  const configHash = hashBasketPathWarehouseConfig(config);
  const expectedWeeks = options.maxWeeks ?? GATE71_EXPECTED_WEEKS;
  const startedAt = Date.now();
  const adrMaps = await preloadGate71AdrMaps({
    weeks: selectedWeekIds,
    symbols: rows.map((row) => row.symbol),
  });

  await beginBasketPathWarehouse({
    manifestId,
    config,
    overwrite: options.overwrite,
  });

  try {
    let missingPriceWeeks = 0;
    let defaultAdrWeeks = 0;
    for (const [index, [weekOpenUtc, weekRows]] of weeks.entries()) {
      const built = await buildCandidateBWeeklyBasketPath({
        weekOpenUtc,
        rows: weekRows,
        candidateBLedgerHash,
        entryExposureModelId: gate71a.protocol.clean_entry_exposure_model_id,
        includePoints: true,
        includeLegacyAdrGridControl: false,
        adrMap: adrMaps.get(weekOpenUtc),
      });
      if (built.diagnostic.missing_price_symbols.length > 0) missingPriceWeeks += 1;
      if (built.diagnostic.default_adr_symbols.length > 0) defaultAdrWeeks += 1;
      await insertWeek(manifestId, built);
      if (options.logProgress) {
        console.log([
          `gate71bm week=${index + 1}/${weeks.length}`,
          `week=${weekOpenUtc.slice(0, 10)}`,
          `points=${built.points.length}`,
          `close=${built.diagnostic.friday_close_adr}`,
        ].join(" | "));
      }
    }
    const runtimeSeconds = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
    const inspection = await completeBasketPathWarehouse({
      manifestId,
      expectedWeeks: selectedWeekIds,
      runtimeSeconds,
      coverage: {
        missing_price_weeks: missingPriceWeeks,
        default_adr_weeks: defaultAdrWeeks,
        runtime_cache: getRuntimeCacheStats(),
      },
    });
    const artifacts = {
      summaryJson: toRepoRelative(path.join(artifactDir, "gate71bm-summary.json")),
      shaIdentity: toRepoRelative(path.join(artifactDir, "gate71bm-sha256.txt")),
      report: toRepoRelative(reportPath),
    };
    const pass =
      gate71a.verdict.startsWith("PASS_") &&
      denominator.forced28_preserved &&
      weeks.length === expectedWeeks &&
      inspection.week_count === expectedWeeks &&
      inspection.missing_week_count === 0 &&
      inspection.duplicate_week_count === 0 &&
      missingPriceWeeks === 0;
    const summary = {
      gate_id: GATE_ID,
      command: COMMAND,
      generated_at: new Date().toISOString(),
      git_commit: gitCommit(),
      verdict: pass
        ? "PASS_GATE71BM_EXIT_PATH_MATERIALIZATION_WAREHOUSE__FROZEN_PATH_READY_FOR_REPLAY"
        : "FAIL_GATE71BM_EXIT_PATH_MATERIALIZATION_WAREHOUSE",
      warehouse: {
        manifest_id: manifestId,
        config_hash: configHash,
        warehouse_hash: inspection.warehouse_hash,
        point_contract_id: config.point_contract_id,
        price_bundle_id: config.price_bundle_id,
        path_resolution: config.path_resolution,
        candidate_id: config.candidate_id,
        locked_algorithm_id: config.locked_algorithm_id,
        candidate_b_ledger_hash: config.candidate_b_ledger_hash,
        entry_exposure_model_id: config.entry_exposure_model_id,
        adr_target_pct: config.adr_target_pct,
        weeks: inspection.week_count,
        point_count: inspection.point_count,
      },
      validation: {
        gate71a_passed: gate71a.verdict.startsWith("PASS_"),
        candidate_b_forced28_preserved: denominator.forced28_preserved,
        clean_entry_exposure_model_id: gate71a.protocol.clean_entry_exposure_model_id,
        legacy_adr_grid_used_as_foundation: false,
        exit_policy_replay_started: false,
        exit_policy_promoted: false,
        risk_filters_started: false,
        brain_truth_mutated: false,
        weeks_materialized: inspection.week_count,
        expected_weeks: expectedWeeks,
        missing_week_count: inspection.missing_week_count,
        duplicate_week_count: inspection.duplicate_week_count,
        missing_price_weeks: missingPriceWeeks,
        default_adr_weeks: defaultAdrWeeks,
        runtime_seconds: runtimeSeconds,
      },
      artifacts,
    };
    await writeJson(path.join(artifactDir, "gate71bm-summary.json"), summary);
    await writeText(reportPath, renderReport(summary));
    await writeShaManifest(path.join(artifactDir, "gate71bm-sha256.txt"), GATE_ID, COMMAND, [
      { label: "summary_json", path: path.join(artifactDir, "gate71bm-summary.json") },
      { label: "report", path: reportPath },
    ]);
    if (!pass) throw new Error(summary.verdict);
    console.log(summary.verdict);
    console.log(JSON.stringify({ warehouse: summary.warehouse, validation: summary.validation, artifacts }, null, 2));
  } catch (error) {
    await markBasketPathWarehouseFailed(manifestId, error);
    throw error;
  }
}

async function insertWeek(
  manifestId: string,
  built: Awaited<ReturnType<typeof buildCandidateBWeeklyBasketPath>>,
) {
  const { insertBasketPathWarehouseWeek } = await import("@engine/research/basketPathWarehouse");
  await insertBasketPathWarehouseWeek({
    manifestId,
    weekOpenUtc: built.diagnostic.week_open_utc,
    diagnostic: built.diagnostic as unknown as Record<string, unknown>,
    diagnosticHash: built.diagnostic.content_hash,
    points: built.points,
  });
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
