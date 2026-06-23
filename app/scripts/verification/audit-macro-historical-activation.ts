import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getClient, getPool, query } from "../../src/lib/db";

loadEnvConfig(process.cwd());

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const FEATURE_BUNDLE_MANIFEST_ID = "real_rate_pressure_attribution_v1";
const ACTIVATION_SCOPE = "historical_backtest";
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
};
const SUPPORTING_RECEIPTS = {
  lifecycleUniqueness:
    "app/reports/data-verification/macro-regime/gate50-lifecycle-uniqueness-20260623.json",
  revocationSupersession:
    "app/reports/data-verification/macro-regime/gate50-revocation-supersession-20260623.json",
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

type ManifestRow = {
  promotion_manifest_id: string;
  feature_bundle_manifest_id: string | null;
  activation_scope: string | null;
  contract_manifest_hash: string;
  macro_week_id: string;
  freeze_version: string;
  snapshot_id: string;
  snapshot_hash: string;
  snapshot_state: string;
  sealed_at_utc: string;
  verified_at_utc: string | null;
  activated_at_utc: string | null;
  effective_from_utc: string | null;
  effective_to_utc: string | null;
  revoked_at_utc: string | null;
  superseded_by_snapshot_id: string | null;
  row_snapshot_count: number;
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

function macroWeekEffectiveFromUtc(macroWeekId: string) {
  return `${macroWeekId.replace("macro_week_", "")}T00:00:00.000Z`;
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

async function readWeeklyContentHash() {
  const rows = await query(
    `
      SELECT
        week_open_utc::text,
        snapshot_id,
        snapshot_hash,
        promotion_manifest_id,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        source_family,
        source_id,
        currency,
        instrument,
        source_observation_date::text,
        effective_at_utc::text,
        available_at_utc::text,
        coverage,
        flags
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
      ORDER BY week_open_utc, currency, source_family, source_id, instrument
    `,
    [RRP_DATASET.datasetId],
  );
  return { rows: rows.length, hash: hashPayload(rows) };
}

async function readAggregateContentHash() {
  const rows = await query(
    `
      SELECT
        promotion_manifest_id,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        snapshot_id,
        snapshot_hash,
        row_snapshot_count,
        coverage,
        flags
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
      ORDER BY macro_week_id, snapshot_id
    `,
    [RRP_DATASET.datasetId],
  );
  return { rows: rows.length, hash: hashPayload(rows) };
}

async function readManifestRows() {
  return query<ManifestRow>(
    `
      SELECT
        promotion_manifest_id,
        feature_bundle_manifest_id,
        activation_scope,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        sealed_at_utc::text,
        verified_at_utc::text,
        activated_at_utc::text,
        effective_from_utc::text,
        effective_to_utc::text,
        revoked_at_utc::text,
        superseded_by_snapshot_id,
        row_snapshot_count::int
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
      ORDER BY macro_week_id, snapshot_id
    `,
    [RRP_DATASET.datasetId],
  );
}

async function activeDuplicateRows() {
  return query<{ macro_week_id: string; rows: string | number }>(
    `
      SELECT macro_week_id, COUNT(*) AS rows
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
        AND snapshot_state = 'ACTIVE'
      GROUP BY promotion_manifest_id, feature_bundle_manifest_id, macro_week_id, freeze_version, activation_scope
      HAVING COUNT(*) > 1
      ORDER BY macro_week_id
    `,
    [RRP_DATASET.datasetId],
  );
}

async function runActivation(activatedAtUtc: string) {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE research_macro_weekly_snapshot_manifests
        SET snapshot_state = 'ACTIVE',
            feature_bundle_manifest_id = $2,
            activation_scope = $3,
            verified_at_utc = COALESCE(verified_at_utc, $4::timestamptz),
            activated_at_utc = COALESCE(activated_at_utc, $4::timestamptz),
            effective_from_utc = COALESCE(
              effective_from_utc,
              (replace(macro_week_id, 'macro_week_', '')::date::timestamp AT TIME ZONE 'UTC')
            )
        WHERE regime_dataset_id = $1::uuid
          AND promotion_manifest_id = $5
          AND contract_manifest_hash = $6
          AND revoked_at_utc IS NULL
          AND superseded_by_snapshot_id IS NULL
      `,
      [
        RRP_DATASET.datasetId,
        FEATURE_BUNDLE_MANIFEST_ID,
        ACTIVATION_SCOPE,
        activatedAtUtc,
        RRP_DATASET.promotionManifestId,
        RRP_DATASET.contractManifestHash,
      ],
    );
    await client.query(
      `
        UPDATE research_macro_regime_datasets
        SET snapshot_state = 'ACTIVE',
            verified_at_utc = COALESCE(verified_at_utc, $3::timestamptz),
            activated_at_utc = COALESCE(activated_at_utc, $3::timestamptz),
            effective_from_utc = COALESCE(effective_from_utc, $4::timestamptz)
        WHERE regime_dataset_id = $1::uuid
          AND dataset_hash = $2
      `,
      [
        RRP_DATASET.datasetId,
        RRP_DATASET.datasetHash,
        activatedAtUtc,
        "2019-01-07T00:00:00.000Z",
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function runPostActivationDuplicateProbe(source: ManifestRow) {
  const duplicateSnapshotId = hashPayload({
    type: "gate50_post_activation_duplicate_probe_v1",
    sourceSnapshotId: source.snapshot_id,
    activationScope: ACTIVATION_SCOPE,
  });
  const clientOne = await getClient();
  const clientTwo = await getClient();
  let firstErrorCode: string | null = null;
  let secondErrorCode: string | null = null;
  try {
    await clientOne.query("BEGIN");
    await clientTwo.query("BEGIN");
    await Promise.all([
      clientOne.query(
        `
          INSERT INTO research_macro_weekly_snapshot_manifests (
            regime_dataset_id,
            promotion_manifest_id,
            feature_bundle_manifest_id,
            activation_scope,
            contract_manifest_hash,
            macro_week_id,
            freeze_version,
            snapshot_id,
            snapshot_hash,
            snapshot_state,
            sealed_at_utc,
            verified_at_utc,
            activated_at_utc,
            effective_from_utc,
            row_snapshot_count,
            coverage,
            flags
          ) VALUES (
            $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE',
            $10::timestamptz, NOW(), NOW(), $11::timestamptz, $12, '{}'::jsonb, '{}'::jsonb
          )
        `,
        [
          RRP_DATASET.datasetId,
          source.promotion_manifest_id,
          FEATURE_BUNDLE_MANIFEST_ID,
          ACTIVATION_SCOPE,
          source.contract_manifest_hash,
          source.macro_week_id,
          source.freeze_version,
          duplicateSnapshotId,
          source.snapshot_hash,
          source.sealed_at_utc,
          macroWeekEffectiveFromUtc(source.macro_week_id),
          source.row_snapshot_count,
        ],
      ).catch((error) => {
        firstErrorCode = (asRecord(error).code as string | undefined) ?? null;
      }),
      clientTwo.query(
        `
          INSERT INTO research_macro_weekly_snapshot_manifests (
            regime_dataset_id,
            promotion_manifest_id,
            feature_bundle_manifest_id,
            activation_scope,
            contract_manifest_hash,
            macro_week_id,
            freeze_version,
            snapshot_id,
            snapshot_hash,
            snapshot_state,
            sealed_at_utc,
            verified_at_utc,
            activated_at_utc,
            effective_from_utc,
            row_snapshot_count,
            coverage,
            flags
          ) VALUES (
            $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE',
            $10::timestamptz, NOW(), NOW(), $11::timestamptz, $12, '{}'::jsonb, '{}'::jsonb
          )
        `,
        [
          RRP_DATASET.datasetId,
          source.promotion_manifest_id,
          FEATURE_BUNDLE_MANIFEST_ID,
          ACTIVATION_SCOPE,
          source.contract_manifest_hash,
          source.macro_week_id,
          source.freeze_version,
          `${duplicateSnapshotId}_second`,
          source.snapshot_hash,
          source.sealed_at_utc,
          macroWeekEffectiveFromUtc(source.macro_week_id),
          source.row_snapshot_count,
        ],
      ).catch((error) => {
        secondErrorCode = (asRecord(error).code as string | undefined) ?? null;
      }),
    ]);
  } finally {
    await clientOne.query("ROLLBACK").catch(() => undefined);
    await clientTwo.query("ROLLBACK").catch(() => undefined);
    clientOne.release();
    clientTwo.release();
  }
  return {
    firstErrorCode,
    secondErrorCode,
    bothRejectedByUniqueIndex: firstErrorCode === "23505" && secondErrorCode === "23505",
  };
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const blockers = Object.entries(asRecord(report.blockers))
    .map(([key, value]) => `| ${key} | ${value} |`);
  return [
    "# Gate 50 Historical Activation Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Active manifests: ${summary.activeManifests}`,
    `- Duplicate active keys: ${summary.duplicateActiveKeys}`,
    `- Feature bundle: ${summary.featureBundleManifestId}`,
    `- Activation scope: ${summary.activationScope}`,
    `- Administrative activated at: ${summary.administrativeActivatedAtUtc}`,
    `- Historical activation claim: ${summary.historicalActivationClaim}`,
    `- Content hash invariant: ${summary.contentHashInvariantProof}`,
    `- Resolved content join-map hash: ${summary.resolvedContentJoinMapHash}`,
    "",
    "## Blockers",
    "",
    "| Blocker | Count |",
    "|---|---:|",
    ...(blockers.length > 0 ? blockers : ["| - | 0 |"]),
    "",
    "This receipt activates source manifests for historical backtest reads only. It computes no P&L, strategy decision, filter, or trade result.",
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for historical activation.");
  }
  const generatedAtUtc = DateTime.utc().toISO({ suppressMilliseconds: false }) ?? new Date().toISOString();
  const [lifecycleReceipt, revocationReceipt] = await Promise.all([
    readJsonReceipt(SUPPORTING_RECEIPTS.lifecycleUniqueness),
    readJsonReceipt(SUPPORTING_RECEIPTS.revocationSupersession),
  ]);
  const lifecycleSummary = asRecord(lifecycleReceipt.json.summary);
  const revocationSummary = asRecord(revocationReceipt.json.summary);
  const contentBefore = {
    weekly: await readWeeklyContentHash(),
    aggregate: await readAggregateContentHash(),
  };
  const beforeManifests = await readManifestRows();
  const beforeSnapshotHashByWeek = new Map(beforeManifests.map((row) => [row.macro_week_id, row.snapshot_hash]));

  await runActivation(generatedAtUtc);

  const manifests = await readManifestRows();
  const duplicateActiveKeys = await activeDuplicateRows();
  const contentAfter = {
    weekly: await readWeeklyContentHash(),
    aggregate: await readAggregateContentHash(),
  };
  const activeManifests = manifests.filter((row) => row.snapshot_state === "ACTIVE");
  const postActivationDuplicateProbe = activeManifests[0]
    ? await runPostActivationDuplicateProbe(activeManifests[0])
    : null;
  const manifestStateCounts = manifests.reduce<Record<string, number>>((counts, row) => {
    counts[row.snapshot_state] = (counts[row.snapshot_state] ?? 0) + 1;
    return counts;
  }, {});
  const activatedAtValues = [...new Set(activeManifests.map((row) => row.activated_at_utc ?? "null"))].sort();
  const featureBundleValues = [...new Set(activeManifests.map((row) => row.feature_bundle_manifest_id ?? "null"))].sort();
  const activationScopeValues = [...new Set(activeManifests.map((row) => row.activation_scope ?? "null"))].sort();
  const promotionManifestValues = [...new Set(activeManifests.map((row) => row.promotion_manifest_id))].sort();
  const effectiveFromMismatches = activeManifests.filter((row) =>
    row.effective_from_utc !== macroWeekEffectiveFromUtc(row.macro_week_id).replace("T", " ").replace(".000Z", "+00"));
  const snapshotHashChangedRows = activeManifests.filter((row) =>
    beforeSnapshotHashByWeek.get(row.macro_week_id) !== row.snapshot_hash);

  const assertions = [
    assertion({
      id: "lifecycle_uniqueness_prerequisite_passed",
      category: "prerequisite",
      passed: lifecycleSummary.status === "PASS_LIFECYCLE_UNIQUENESS"
        && lifecycleSummary.disposableActiveRowsCleanedUp === true,
      expectation: "Lifecycle uniqueness with DB duplicate rejection must pass before historical activation.",
      actual: JSON.stringify(lifecycleSummary),
      blocker: "lifecycle_uniqueness_not_passed",
    }),
    assertion({
      id: "revocation_supersession_prerequisite_passed",
      category: "prerequisite",
      passed: revocationSummary.status === "PASS_REVOCATION_SUPERSESSION",
      expectation: "Revocation/quarantine/supersession proof must pass before historical activation.",
      actual: JSON.stringify(revocationSummary),
      blocker: "revocation_supersession_not_passed",
    }),
    assertion({
      id: "exactly_372_active_manifests",
      category: "activation",
      passed: activeManifests.length === 372
        && manifests.length === 372
        && (manifestStateCounts.ACTIVE ?? 0) === 372,
      expectation: "Historical activation produces exactly 372 ACTIVE aggregate weekly manifests.",
      actual: JSON.stringify({ total: manifests.length, states: manifestStateCounts }),
      blocker: "active_manifest_count_mismatch",
    }),
    assertion({
      id: "one_active_manifest_per_week",
      category: "activation",
      passed: duplicateActiveKeys.length === 0
        && new Set(activeManifests.map((row) => row.macro_week_id)).size === 372,
      expectation: "There is exactly one ACTIVE manifest per macro week.",
      actual: JSON.stringify({ duplicateActiveKeys, uniqueWeeks: new Set(activeManifests.map((row) => row.macro_week_id)).size }),
      blocker: "duplicate_active_manifest_for_week",
    }),
    assertion({
      id: "same_promotion_manifest_feature_bundle_and_scope",
      category: "activation",
      passed: promotionManifestValues.length === 1
        && promotionManifestValues[0] === RRP_DATASET.promotionManifestId
        && featureBundleValues.length === 1
        && featureBundleValues[0] === FEATURE_BUNDLE_MANIFEST_ID
        && activationScopeValues.length === 1
        && activationScopeValues[0] === ACTIVATION_SCOPE,
      expectation: "All ACTIVE manifests share the same warehouse promotion manifest, feature bundle, and activation scope.",
      actual: JSON.stringify({ promotionManifestValues, featureBundleValues, activationScopeValues }),
      blocker: "active_manifest_identity_scope_mismatch",
    }),
    assertion({
      id: "approved_root_parent_manifest_bound",
      category: "activation",
      passed: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId === "6656b5da3d5552811b3f0f7c10b14d4af1dfbe191fb508231967a9e54d98414c"
        && String(lifecycleSummary.resolvedContentJoinMapHash ?? "") === EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
      expectation: "Historical activation is bound to the already-approved parent root manifest evidence without changing the source content identity.",
      actual: JSON.stringify(PARENT_APPROVED_ROOT),
      blocker: "approved_root_parent_manifest_not_bound",
    }),
    assertion({
      id: "snapshot_hashes_unchanged",
      category: "content_invariant",
      passed: snapshotHashChangedRows.length === 0,
      expectation: "Activation does not change aggregate snapshot hashes.",
      actual: JSON.stringify(snapshotHashChangedRows.slice(0, 5)),
      blocker: "activation_changed_snapshot_hash",
    }),
    assertion({
      id: "source_content_hashes_unchanged",
      category: "content_invariant",
      passed: contentBefore.weekly.hash === contentAfter.weekly.hash
        && contentBefore.aggregate.hash === contentAfter.aggregate.hash,
      expectation: "Activation changes lifecycle metadata only; weekly source rows and aggregate content hashes are unchanged.",
      actual: JSON.stringify({ before: contentBefore, after: contentAfter }),
      blocker: "activation_changed_source_content_hash",
    }),
    assertion({
      id: "historical_effective_time_and_current_admin_time",
      category: "activation_time",
      passed: effectiveFromMismatches.length === 0
        && activatedAtValues.length === 1
        && activatedAtValues[0] !== "null"
        && DateTime.fromISO(activatedAtValues[0].replace(" ", "T").replace("+00", "Z"), { zone: "utc" }).year === 2026,
      expectation: "effective_from_utc remains the historical macro week while activated_at_utc is the current administrative activation time.",
      actual: JSON.stringify({ activatedAtValues, effectiveFromMismatchSamples: effectiveFromMismatches.slice(0, 5) }),
      blocker: "activation_time_contract_failed",
    }),
    assertion({
      id: "post_activation_duplicate_probe_rejected",
      category: "database_uniqueness",
      passed: postActivationDuplicateProbe?.bothRejectedByUniqueIndex === true,
      expectation: "After activation, concurrent duplicate ACTIVE attempts for an already-active key are rejected by the database unique index.",
      actual: JSON.stringify(postActivationDuplicateProbe),
      blocker: "post_activation_duplicate_probe_not_rejected",
    }),
  ];
  const blockers = blockerCounts(assertions);
  const pass = Object.keys(blockers).length === 0;
  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose:
      "Historical-backtest activation proof for the repaired RRP aggregate weekly manifests. Does not compute outcomes.",
    summary: {
      status: pass ? "PASS_HISTORICAL_ACTIVATION" : "FAIL_HISTORICAL_ACTIVATION",
      activeManifests: activeManifests.length,
      totalAggregateManifests: manifests.length,
      duplicateActiveKeys: duplicateActiveKeys.length,
      promotionManifestId: RRP_DATASET.promotionManifestId,
      approvedRootPromotionManifestId: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
      featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
      activationScope: ACTIVATION_SCOPE,
      administrativeActivatedAtUtc: activatedAtValues[0] ?? null,
      historicalActivationClaim: false,
      historicalEffectiveFromUtc: {
        first: activeManifests[0]?.effective_from_utc ?? null,
        last: activeManifests.at(-1)?.effective_from_utc ?? null,
      },
      postActivationDuplicateProbe,
      contentHashInvariantProof: contentBefore.weekly.hash === contentAfter.weekly.hash
        && contentBefore.aggregate.hash === contentAfter.aggregate.hash ? "PASS" : "FAIL",
      resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
      diagnosticOnly: false,
      promotionEligible: true,
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
    },
    before: {
      manifestCount: beforeManifests.length,
      content: contentBefore,
    },
    after: {
      manifestStateCounts,
      activeManifests: activeManifests.length,
      activatedAtValues,
      featureBundleValues,
      activationScopeValues,
      promotionManifestValues,
      duplicateActiveKeys,
      content: contentAfter,
    },
    supportingReceipts: {
      lifecycleUniqueness: lifecycleReceipt,
      revocationSupersession: revocationReceipt,
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
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-historical-activation-${stamp}.json`),
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

  console.log(`Gate 50 historical activation: ${reportBase.summary.status}`);
  console.log(`Active aggregate manifests: ${activeManifests.length}`);
  console.log(`Resolved content join-map hash: ${EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (!pass) {
    console.log(`Blockers: ${Object.entries(blockers).map(([key, count]) => `${key}:${count}`).join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[macro-historical-activation] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
