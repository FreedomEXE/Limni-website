import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getPool, query, transaction } from "../../src/lib/db";
import {
  ensureMacroRegimeWarehouseSchema,
  validateMacroSnapshotConsumptionState,
  validatePinnedMacroExecutionReadRequest,
} from "../../src/lib/research/macroRegimeDataset";

loadEnvConfig(process.cwd());

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const FEATURE_BUNDLE_MANIFEST_ID = "real_rate_pressure_attribution_v1";
const ACTIVATION_SCOPE = "historical_backtest";
const EXECUTION_RUN_ID = process.env.GATE50_EXECUTION_RUN_ID
  ?? `gate50_zero_pnl_exact_pinned_read_${DateTime.utc().toFormat("yyyyLLddHHmmss")}`;
const EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH =
  "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";
const RRP_DATASET = {
  datasetId: "220fd5fd-d017-4db2-bdde-524a3c664c72",
  datasetHash: "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742",
  promotionManifestId: "5f0049dc6dac1470c55309caf922996171b2250f3ee35df2be21cd84b1599def",
  contractManifestHash: "8b168a89bf2f1e812ab4f4b1d60ab9cc06af93802d37d7ed191829bee7d4ace4",
};
const PARENT_APPROVED_ROOT = {
  rootRrpPromotionManifestId: "6656b5da3d5552811b3f0f7c10b14d4af1dfbe191fb508231967a9e54d98414c",
  rootRrpPromotionManifestHash: "12a22849ff794ce62ca6d618461a74f21e8967f518b82834aaebbc66ff172275",
  parentPromotionProofReceiptHash: "0e625be7126c90ce7748847b9ebdf6872ffbeb099caafa7e69348fe482f8409c",
};
const SUPPORTING_RECEIPTS = {
  historicalActivation:
    "app/reports/data-verification/macro-regime/gate50-historical-activation-control-amended-20260623.json",
};

type JsonRecord = Record<string, unknown>;
type Assertion = {
  id: string;
  category: string;
  status: "PASS" | "FAIL";
  expectation: string;
  actual: string;
  blocker: string | null;
};

type ActiveManifestRow = {
  promotion_manifest_id: string;
  feature_bundle_manifest_id: string | null;
  activation_scope: string | null;
  approved_root_promotion_manifest_id: string | null;
  approved_root_promotion_manifest_hash: string | null;
  parent_promotion_proof_receipt_hash: string | null;
  macro_week_id: string;
  freeze_version: string;
  snapshot_id: string;
  snapshot_hash: string;
  snapshot_state: string;
  activated_at_utc: string | null;
  effective_from_utc: string | null;
  effective_to_utc: string | null;
  revoked_at_utc: string | null;
  superseded_by_snapshot_id: string | null;
};

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, inner]) => [key, stableJson(inner)]),
    );
  }
  return value;
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function assertion(input: Omit<Assertion, "status" | "blocker"> & {
  passed: boolean;
  blocker: string;
}): Assertion {
  return {
    id: input.id,
    category: input.category,
    status: input.passed ? "PASS" : "FAIL",
    expectation: input.expectation,
    actual: input.actual,
    blocker: input.passed ? null : input.blocker,
  };
}

function blockerCounts(assertions: Assertion[]) {
  const counts: Record<string, number> = {};
  for (const item of assertions) {
    if (item.status !== "FAIL" || !item.blocker) continue;
    counts[item.blocker] = (counts[item.blocker] ?? 0) + 1;
  }
  return counts;
}

function isoTextToMillis(value: string | null) {
  if (!value) return Number.NaN;
  return DateTime.fromISO(value.replace(" ", "T").replace("+00", "Z"), { zone: "utc" }).toMillis();
}

function decisionAtFor(row: ActiveManifestRow) {
  return `${row.macro_week_id.replace("macro_week_", "")}T00:00:00.000Z`;
}

async function readJsonReceipt(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const text = await readFile(absolutePath, "utf8");
  return {
    path: relativePath.replaceAll("\\", "/"),
    sha256: sha256Text(text),
    json: JSON.parse(text) as JsonRecord,
  };
}

async function readActiveManifests() {
  return query<ActiveManifestRow>(
    `
      SELECT
        promotion_manifest_id,
        feature_bundle_manifest_id,
        activation_scope,
        approved_root_promotion_manifest_id,
        approved_root_promotion_manifest_hash,
        parent_promotion_proof_receipt_hash,
        macro_week_id,
        freeze_version,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        activated_at_utc::text,
        effective_from_utc::text,
        effective_to_utc::text,
        revoked_at_utc::text,
        superseded_by_snapshot_id
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
        AND snapshot_state = 'ACTIVE'
        AND promotion_manifest_id = $2
        AND feature_bundle_manifest_id = $3
        AND activation_scope = $4
        AND approved_root_promotion_manifest_id = $5
        AND approved_root_promotion_manifest_hash = $6
        AND parent_promotion_proof_receipt_hash = $7
      ORDER BY macro_week_id
    `,
    [
      RRP_DATASET.datasetId,
      RRP_DATASET.promotionManifestId,
      FEATURE_BUNDLE_MANIFEST_ID,
      ACTIVATION_SCOPE,
      PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
      PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
      PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
    ],
  );
}

async function writeExecutionReceipts(rows: ActiveManifestRow[], snapshotReadAtUtc: string) {
  const payload = rows.map((row) => ({
    execution_run_id: EXECUTION_RUN_ID,
    decision_at_utc: decisionAtFor(row),
    macro_week_id: row.macro_week_id,
    promotion_manifest_id: row.promotion_manifest_id,
    snapshot_id: row.snapshot_id,
    snapshot_hash: row.snapshot_hash,
    snapshot_state_observed: row.snapshot_state,
    snapshot_read_at_utc: snapshotReadAtUtc,
    coverage: {
      featureBundleManifestId: row.feature_bundle_manifest_id,
      activationScope: row.activation_scope,
      approvedRootPromotionManifestId: row.approved_root_promotion_manifest_id,
      approvedRootPromotionManifestHash: row.approved_root_promotion_manifest_hash,
      parentPromotionProofReceiptHash: row.parent_promotion_proof_receipt_hash,
      exactPinnedRead: true,
      effectiveFromUtc: row.effective_from_utc,
      effectiveToUtc: row.effective_to_utc,
      resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
    },
    flags: {
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
      noTradeFilterComputed: true,
      rejectsLatestAlias: true,
    },
  }));

  await transaction(async (client) => {
    await client.query(
      `
        WITH incoming AS (
          SELECT *
          FROM jsonb_to_recordset($2::jsonb) AS row(
            execution_run_id TEXT,
            decision_at_utc TIMESTAMPTZ,
            macro_week_id TEXT,
            promotion_manifest_id TEXT,
            snapshot_id TEXT,
            snapshot_hash TEXT,
            snapshot_state_observed TEXT,
            snapshot_read_at_utc TIMESTAMPTZ,
            coverage JSONB,
            flags JSONB
          )
        )
        INSERT INTO research_macro_execution_receipts (
          regime_dataset_id,
          execution_run_id,
          decision_at_utc,
          macro_week_id,
          promotion_manifest_id,
          snapshot_id,
          snapshot_hash,
          snapshot_state_observed,
          snapshot_read_at_utc,
          coverage,
          flags
        )
        SELECT
          $1::uuid,
          execution_run_id,
          decision_at_utc,
          macro_week_id,
          promotion_manifest_id,
          snapshot_id,
          snapshot_hash,
          snapshot_state_observed,
          snapshot_read_at_utc,
          COALESCE(coverage, '{}'::jsonb),
          COALESCE(flags, '{}'::jsonb)
        FROM incoming
        ON CONFLICT (regime_dataset_id, execution_run_id, macro_week_id, promotion_manifest_id)
        DO NOTHING
      `,
      [RRP_DATASET.datasetId, JSON.stringify(payload)],
    );
  });
}

async function receiptCount() {
  const rows = await query<{ rows: string | number }>(
    `
      SELECT COUNT(*) AS rows
      FROM research_macro_execution_receipts
      WHERE regime_dataset_id = $1::uuid
        AND execution_run_id = $2
    `,
    [RRP_DATASET.datasetId, EXECUTION_RUN_ID],
  );
  return Number(rows[0]?.rows ?? 0);
}

function exactReadChecks(rows: ActiveManifestRow[]) {
  const invalidPinnedReads = rows.filter((row) => !validatePinnedMacroExecutionReadRequest({
    regimeDatasetId: RRP_DATASET.datasetId,
    promotionManifestId: row.promotion_manifest_id,
    featureBundleManifestId: row.feature_bundle_manifest_id,
    macroWeekId: row.macro_week_id,
    freezeVersion: row.freeze_version,
    activationScope: row.activation_scope,
    snapshotId: row.snapshot_id,
    snapshotHash: row.snapshot_hash,
    resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
  }).ok);
  const ineligibleConsumption = rows.filter((row) => !validateMacroSnapshotConsumptionState({
    snapshotState: row.snapshot_state,
    revokedAtUtc: row.revoked_at_utc,
    supersededBySnapshotId: row.superseded_by_snapshot_id,
  }).ok);
  const effectiveTimeFailures = rows.filter((row) => {
    const decisionAt = DateTime.fromISO(decisionAtFor(row), { zone: "utc" }).toMillis();
    const effectiveFrom = isoTextToMillis(row.effective_from_utc);
    const effectiveTo = row.effective_to_utc ? isoTextToMillis(row.effective_to_utc) : Number.POSITIVE_INFINITY;
    return Number.isNaN(effectiveFrom) || decisionAt < effectiveFrom || decisionAt >= effectiveTo;
  });
  const duplicateKeys = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.promotion_manifest_id}|${row.feature_bundle_manifest_id}|${row.macro_week_id}|${row.freeze_version}|${row.activation_scope}`;
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  }

  return {
    invalidPinnedReads,
    ineligibleConsumption,
    effectiveTimeFailures,
    duplicateKeys: [...duplicateKeys.entries()].filter(([, count]) => count !== 1),
  };
}

function consumerReadAccepted(source: ActiveManifestRow, input: {
  promotionManifestId: string | null;
  featureBundleManifestId: string | null;
  macroWeekId: string | null;
  freezeVersion: string | null;
  activationScope: string | null;
  snapshotId: string | null;
  snapshotHash: string | null;
  snapshotState: string;
  revokedAtUtc?: string | null;
  supersededBySnapshotId?: string | null;
  duplicateCandidateCount?: number;
}) {
  const pinned = validatePinnedMacroExecutionReadRequest({
    regimeDatasetId: RRP_DATASET.datasetId,
    promotionManifestId: input.promotionManifestId,
    featureBundleManifestId: input.featureBundleManifestId,
    macroWeekId: input.macroWeekId,
    freezeVersion: input.freezeVersion,
    activationScope: input.activationScope,
    snapshotId: input.snapshotId,
    snapshotHash: input.snapshotHash,
    resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
  });
  const state = validateMacroSnapshotConsumptionState({
    snapshotState: input.snapshotState,
    revokedAtUtc: input.revokedAtUtc,
    supersededBySnapshotId: input.supersededBySnapshotId,
  });
  const identityMatches =
    input.promotionManifestId === source.promotion_manifest_id
    && input.featureBundleManifestId === source.feature_bundle_manifest_id
    && input.macroWeekId === source.macro_week_id
    && input.freezeVersion === source.freeze_version
    && input.activationScope === source.activation_scope
    && input.snapshotId === source.snapshot_id
    && input.snapshotHash === source.snapshot_hash;
  const duplicateCandidateCount = input.duplicateCandidateCount ?? 1;

  return {
    ok: pinned.ok && state.ok && identityMatches && duplicateCandidateCount === 1,
    pinned,
    state,
    identityMatches,
    duplicateCandidateCount,
  };
}

function negativeReadChecks(source: ActiveManifestRow) {
  const baseInput = {
    promotionManifestId: source.promotion_manifest_id,
    featureBundleManifestId: source.feature_bundle_manifest_id,
    macroWeekId: source.macro_week_id,
    freezeVersion: source.freeze_version,
    activationScope: source.activation_scope,
    snapshotId: source.snapshot_id,
    snapshotHash: source.snapshot_hash,
    snapshotState: "ACTIVE",
  };

  return {
    wrongBundle: consumerReadAccepted(source, { ...baseInput, featureBundleManifestId: "wrong_bundle" }),
    wrongManifest: consumerReadAccepted(source, { ...baseInput, promotionManifestId: "wrong_manifest" }),
    alias: consumerReadAccepted(source, { ...baseInput, snapshotId: "latest" }),
    sealed: consumerReadAccepted(source, { ...baseInput, snapshotState: "SEALED" }),
    revoked: consumerReadAccepted(source, {
      ...baseInput,
      revokedAtUtc: "2026-06-23T00:00:00.000Z",
    }),
    quarantined: consumerReadAccepted(source, { ...baseInput, snapshotState: "QUARANTINED" }),
    superseded: consumerReadAccepted(source, {
      ...baseInput,
      supersededBySnapshotId: "superseding_snapshot",
    }),
    duplicate: consumerReadAccepted(source, { ...baseInput, duplicateCandidateCount: 2 }),
  };
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const blockers = Object.entries(asRecord(report.blockers))
    .map(([key, value]) => `| ${key} | ${value} |`);
  return [
    "# Gate 50 Zero-PnL Exact Pinned Read Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Active manifests read: ${summary.activeManifestsRead}`,
    `- Execution receipts written: ${summary.executionReceiptsWritten}`,
    `- Negative read guard proof: ${summary.negativeReadGuardProof}`,
    `- Effective-time proof: ${summary.effectiveTimeProof}`,
    `- No PnL computed: ${summary.noPnlComputed}`,
    `- No strategy decision computed: ${summary.noStrategyDecisionComputed}`,
    "",
    "## Blockers",
    "",
    "| Blocker | Count |",
    "|---|---:|",
    ...(blockers.length > 0 ? blockers : ["| - | 0 |"]),
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for zero-PnL pinned read proof.");
  }
  await ensureMacroRegimeWarehouseSchema();
  const generatedAtUtc = DateTime.utc().toISO({ suppressMilliseconds: false }) ?? new Date().toISOString();
  const activationReceipt = await readJsonReceipt(SUPPORTING_RECEIPTS.historicalActivation);
  const activationSummary = asRecord(activationReceipt.json.summary);
  const activeRows = await readActiveManifests();
  const exactChecks = exactReadChecks(activeRows);
  const negativeChecks = activeRows[0] ? negativeReadChecks(activeRows[0]) : null;
  await writeExecutionReceipts(activeRows, generatedAtUtc);
  const executionReceiptsWritten = await receiptCount();

  const assertions = [
    assertion({
      id: "historical_activation_prerequisite_passed",
      category: "prerequisite",
      passed: activationSummary.status === "PASS_HISTORICAL_ACTIVATION",
      expectation: "Historical activation must pass before source-only pinned reads.",
      actual: JSON.stringify(activationSummary),
      blocker: "historical_activation_not_passed",
    }),
    assertion({
      id: "all_active_manifests_exactly_pinned",
      category: "pinned_read",
      passed: activeRows.length === 372
        && exactChecks.invalidPinnedReads.length === 0
        && exactChecks.ineligibleConsumption.length === 0
        && exactChecks.duplicateKeys.length === 0,
      expectation: "Source-only consumer reads exactly pinned ACTIVE manifest identities with no duplicates.",
      actual: JSON.stringify({
        activeRows: activeRows.length,
        invalidPinnedReads: exactChecks.invalidPinnedReads.length,
        ineligibleConsumption: exactChecks.ineligibleConsumption.length,
        duplicateKeys: exactChecks.duplicateKeys,
      }),
      blocker: "active_manifest_pinned_read_failed",
    }),
    assertion({
      id: "effective_time_eligibility_passed",
      category: "pinned_read",
      passed: exactChecks.effectiveTimeFailures.length === 0,
      expectation: "Decision time must be within each ACTIVE manifest effective time window.",
      actual: JSON.stringify(exactChecks.effectiveTimeFailures.slice(0, 5)),
      blocker: "effective_time_eligibility_failed",
    }),
    assertion({
      id: "negative_read_guards_reject_invalid_inputs",
      category: "negative_guard",
      passed: negativeChecks !== null
        && negativeChecks.wrongBundle.ok === false
        && negativeChecks.wrongManifest.ok === false
        && negativeChecks.alias.ok === false
        && negativeChecks.sealed.ok === false
        && negativeChecks.revoked.ok === false
        && negativeChecks.quarantined.ok === false
        && negativeChecks.superseded.ok === false
        && negativeChecks.duplicate.ok === false,
      expectation: "Consumer rejects SEALED, revoked, quarantined, superseded, wrong-bundle, wrong-manifest, duplicate, and alias reads.",
      actual: JSON.stringify(negativeChecks),
      blocker: "negative_read_guard_failed",
    }),
    assertion({
      id: "execution_read_receipts_written",
      category: "receipt",
      passed: executionReceiptsWritten === 372,
      expectation: "Source-only consumer writes one execution-read receipt per ACTIVE weekly manifest.",
      actual: String(executionReceiptsWritten),
      blocker: "execution_read_receipt_count_mismatch",
    }),
  ];
  const blockers = blockerCounts(assertions);
  const pass = Object.keys(blockers).length === 0;
  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose:
      "Zero-PnL source-only exact pinned-read proof for ACTIVE historical-backtest macro manifests.",
    summary: {
      status: pass ? "PASS_ZERO_PNL_PINNED_READ" : "FAIL_ZERO_PNL_PINNED_READ",
      activeManifestsRead: activeRows.length,
      executionRunId: EXECUTION_RUN_ID,
      executionReceiptsWritten,
      negativeReadGuardProof: assertions.find((row) => row.id === "negative_read_guards_reject_invalid_inputs")?.status ?? "FAIL",
      effectiveTimeProof: assertions.find((row) => row.id === "effective_time_eligibility_passed")?.status ?? "FAIL",
      resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
      noTradeFilterComputed: true,
      outcomeConsumableProofOnly: true,
    },
    exactChecks: {
      invalidPinnedReads: exactChecks.invalidPinnedReads.length,
      ineligibleConsumption: exactChecks.ineligibleConsumption.length,
      effectiveTimeFailures: exactChecks.effectiveTimeFailures.length,
      duplicateKeys: exactChecks.duplicateKeys,
    },
    negativeChecks,
    supportingReceipts: {
      historicalActivation: activationReceipt,
    },
    assertions,
    blockers,
  };
  const { generatedAtUtc: _generatedAtUtc, ...stableReportBase } = reportBase;
  const receiptHash = hashPayload(stableReportBase);
  const report = {
    ...reportBase,
    receiptHash,
  };
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const jsonPath = path.resolve(
    process.cwd(),
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-zero-pnl-pinned-read-${stamp}.json`),
  );
  const mdPath = path.resolve(
    process.cwd(),
    argValue("md-out") ?? jsonPath.replace(/\.json$/i, ".md"),
  );
  const reportWithFiles = {
    ...report,
    files: {
      jsonPath: path.relative(process.cwd(), jsonPath).replaceAll("\\", "/"),
      mdPath: path.relative(process.cwd(), mdPath).replaceAll("\\", "/"),
    },
  };

  await mkdir(path.dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(reportWithFiles, null, 2)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown(reportWithFiles as JsonRecord), "utf8");

  console.log(`Gate 50 zero-PnL pinned read: ${reportBase.summary.status}`);
  console.log(`Execution-read receipts written: ${executionReceiptsWritten}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (!pass) {
    console.log(`Blockers: ${Object.entries(blockers).map(([key, count]) => `${key}:${count}`).join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[macro-zero-pnl-pinned-read] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
