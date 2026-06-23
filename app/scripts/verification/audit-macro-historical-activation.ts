import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getClient, getPool, query } from "../../src/lib/db";
import {
  ensureMacroRegimeWarehouseSchema,
  transitionMacroWeeklySnapshotManifestState,
} from "../../src/lib/research/macroRegimeDataset";

loadEnvConfig(process.cwd());

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const FEATURE_BUNDLE_MANIFEST_ID = "real_rate_pressure_attribution_v1";
const ACTIVATION_SCOPE = "historical_backtest";
const GATE44_MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const CONTROL_REPAIR_VERSION = "gate50_lifecycle_effective_time_control_repair_v2";
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
  lifecycleUniqueness:
    "app/reports/data-verification/macro-regime/gate50-lifecycle-uniqueness-control-repaired-20260623.json",
  revocationSupersession:
    "app/reports/data-verification/macro-regime/gate50-revocation-supersession-control-repaired-20260623.json",
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
  supersedes_snapshot_id: string | null;
  superseded_by_snapshot_id: string | null;
  row_snapshot_count: number;
  coverage: unknown;
  flags: unknown;
  approved_root_promotion_manifest_id: string | null;
  approved_root_promotion_manifest_hash: string | null;
  parent_promotion_proof_receipt_hash: string | null;
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

function normalizeDbTimestamp(value: string) {
  return DateTime.fromISO(value.replace(" ", "T").replace("+00", "Z"), { zone: "utc" }).toUTC().toISO({ suppressMilliseconds: false })!;
}

function macroWeekIdFor(weekOpenUtc: string) {
  return `macro_week_${DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toUTC().toFormat("yyyy-LL-dd")}`;
}

async function readExactEffectiveTimeMap() {
  const rows = await query<{ week_open_utc: string }>(
    `
      SELECT DISTINCT week_open_utc::text
      FROM research_matrix_source_contexts
      WHERE dataset_id = $1::uuid
      ORDER BY week_open_utc
    `,
    [GATE44_MATRIX_DATASET_ID],
  );
  return new Map(rows.map((row) => {
    const weekOpenUtc = normalizeDbTimestamp(row.week_open_utc);
    return [macroWeekIdFor(weekOpenUtc), weekOpenUtc];
  }));
}

function exactEffectiveFromUtc(macroWeekId: string, effectiveTimeMap: Map<string, string>) {
  const exact = effectiveTimeMap.get(macroWeekId);
  if (!exact) {
    throw new Error(`Missing exact Gate 44 effective timestamp for ${macroWeekId}`);
  }
  return exact;
}

function repairedSnapshotIdFor(source: ManifestRow, effectiveFromUtc: string) {
  return hashPayload({
    type: CONTROL_REPAIR_VERSION,
    sourceSnapshotId: source.snapshot_id,
    sourceSnapshotHash: source.snapshot_hash,
    promotionManifestId: source.promotion_manifest_id,
    macroWeekId: source.macro_week_id,
    freezeVersion: source.freeze_version,
    activationScope: ACTIVATION_SCOPE,
    effectiveFromUtc,
  });
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
        supersedes_snapshot_id,
        superseded_by_snapshot_id,
        row_snapshot_count::int,
        coverage,
        flags,
        approved_root_promotion_manifest_id,
        approved_root_promotion_manifest_hash,
        parent_promotion_proof_receipt_hash
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
        AND promotion_manifest_id = $2
      ORDER BY macro_week_id, snapshot_id
    `,
    [RRP_DATASET.datasetId, RRP_DATASET.promotionManifestId],
  );
}

async function activeDuplicateRows() {
  return query<{ macro_week_id: string; rows: string | number }>(
    `
      SELECT macro_week_id, COUNT(*) AS rows
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
        AND promotion_manifest_id = $2
        AND snapshot_state = 'ACTIVE'
      GROUP BY promotion_manifest_id, feature_bundle_manifest_id, macro_week_id, freeze_version, activation_scope
      HAVING COUNT(*) > 1
      ORDER BY macro_week_id
    `,
    [RRP_DATASET.datasetId, RRP_DATASET.promotionManifestId],
  );
}

async function insertRepairedSealedManifest(source: ManifestRow, replacementSnapshotId: string) {
  await query(
    `
      INSERT INTO research_macro_weekly_snapshot_manifests (
        regime_dataset_id,
        promotion_manifest_id,
        feature_bundle_manifest_id,
        activation_scope,
        approved_root_promotion_manifest_id,
        approved_root_promotion_manifest_hash,
        parent_promotion_proof_receipt_hash,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        sealed_at_utc,
        row_snapshot_count,
        coverage,
        flags,
        supersedes_snapshot_id
      ) VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        'SEALED',
        $13::timestamptz,
        $14,
        $15::jsonb,
        $16::jsonb,
        $17
      )
      ON CONFLICT (regime_dataset_id, snapshot_id)
      DO UPDATE SET
        promotion_manifest_id = EXCLUDED.promotion_manifest_id,
        feature_bundle_manifest_id = EXCLUDED.feature_bundle_manifest_id,
        activation_scope = EXCLUDED.activation_scope,
        approved_root_promotion_manifest_id = EXCLUDED.approved_root_promotion_manifest_id,
        approved_root_promotion_manifest_hash = EXCLUDED.approved_root_promotion_manifest_hash,
        parent_promotion_proof_receipt_hash = EXCLUDED.parent_promotion_proof_receipt_hash,
        contract_manifest_hash = EXCLUDED.contract_manifest_hash,
        macro_week_id = EXCLUDED.macro_week_id,
        freeze_version = EXCLUDED.freeze_version,
        snapshot_hash = EXCLUDED.snapshot_hash,
        snapshot_state = EXCLUDED.snapshot_state,
        sealed_at_utc = EXCLUDED.sealed_at_utc,
        row_snapshot_count = EXCLUDED.row_snapshot_count,
        coverage = EXCLUDED.coverage,
        flags = EXCLUDED.flags,
        supersedes_snapshot_id = EXCLUDED.supersedes_snapshot_id
    `,
    [
      RRP_DATASET.datasetId,
      source.promotion_manifest_id,
      FEATURE_BUNDLE_MANIFEST_ID,
      ACTIVATION_SCOPE,
      PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
      PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
      PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
      source.contract_manifest_hash,
      source.macro_week_id,
      source.freeze_version,
      replacementSnapshotId,
      source.snapshot_hash,
      source.sealed_at_utc,
      source.row_snapshot_count,
      JSON.stringify({
        ...asRecord(source.coverage),
        gate50ControlRepair: CONTROL_REPAIR_VERSION,
        supersedesSnapshotId: source.snapshot_id,
      }),
      JSON.stringify({
        ...asRecord(source.flags),
        gate50ControlRepair: true,
      }),
      source.snapshot_id,
    ],
  );
}

async function runActivation(activatedAtUtc: string, effectiveTimeMap: Map<string, string>) {
  const candidates = await readManifestRows();
  const legacyActiveRows = candidates.filter((row) =>
    row.promotion_manifest_id === RRP_DATASET.promotionManifestId
    && row.contract_manifest_hash === RRP_DATASET.contractManifestHash
    && row.snapshot_state === "ACTIVE"
    && row.revoked_at_utc === null
    && row.superseded_by_snapshot_id === null
    && row.supersedes_snapshot_id === null);

  for (const row of legacyActiveRows) {
    const effectiveFromUtc = exactEffectiveFromUtc(row.macro_week_id, effectiveTimeMap);
    const replacementSnapshotId = repairedSnapshotIdFor(row, effectiveFromUtc);
    await insertRepairedSealedManifest(row, replacementSnapshotId);
    await transitionMacroWeeklySnapshotManifestState({
      regimeDatasetId: RRP_DATASET.datasetId,
      snapshotId: row.snapshot_id,
      expectedSnapshotHash: row.snapshot_hash,
      fromState: "ACTIVE",
      toState: "REVOKED",
      transitionedAtUtc: activatedAtUtc,
      transitionRunId: `${CONTROL_REPAIR_VERSION}_legacy_supersession`,
      reason: "Gate 50 supersedes legacy direct-ACTIVE control evidence with a legally transitioned replacement manifest.",
      actorOrServiceVersion: "macro_snapshot_transition_service_v2",
      featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
      activationScope: ACTIVATION_SCOPE,
      revocationReason: CONTROL_REPAIR_VERSION,
      supersededBySnapshotId: replacementSnapshotId,
      approvedRootPromotionManifestId: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
      approvedRootPromotionManifestHash: PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
      parentPromotionProofReceiptHash: PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
    });
  }

  const replacementRows = (await readManifestRows()).filter((row) =>
    row.promotion_manifest_id === RRP_DATASET.promotionManifestId
    && row.contract_manifest_hash === RRP_DATASET.contractManifestHash
    && row.supersedes_snapshot_id !== null
    && row.revoked_at_utc === null);

  for (const row of replacementRows) {
    const effectiveFromUtc = exactEffectiveFromUtc(row.macro_week_id, effectiveTimeMap);
    if (row.snapshot_state === "SEALED") {
      await transitionMacroWeeklySnapshotManifestState({
        regimeDatasetId: RRP_DATASET.datasetId,
        snapshotId: row.snapshot_id,
        expectedSnapshotHash: row.snapshot_hash,
        fromState: "SEALED",
        toState: "VERIFIED",
        transitionedAtUtc: activatedAtUtc,
        transitionRunId: `${CONTROL_REPAIR_VERSION}_legal_activation`,
        reason: "Gate 50 verifies replacement source manifest before historical activation.",
        actorOrServiceVersion: "macro_snapshot_transition_service_v2",
        featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
        activationScope: ACTIVATION_SCOPE,
        approvedRootPromotionManifestId: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
        approvedRootPromotionManifestHash: PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
        parentPromotionProofReceiptHash: PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
      });
      await transitionMacroWeeklySnapshotManifestState({
        regimeDatasetId: RRP_DATASET.datasetId,
        snapshotId: row.snapshot_id,
        expectedSnapshotHash: row.snapshot_hash,
        fromState: "VERIFIED",
        toState: "ACTIVE",
        transitionedAtUtc: activatedAtUtc,
        transitionRunId: `${CONTROL_REPAIR_VERSION}_legal_activation`,
        reason: "Gate 50 activates replacement source manifest after verified state.",
        actorOrServiceVersion: "macro_snapshot_transition_service_v2",
        featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
        activationScope: ACTIVATION_SCOPE,
        effectiveFromUtc,
        approvedRootPromotionManifestId: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
        approvedRootPromotionManifestHash: PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
        parentPromotionProofReceiptHash: PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
      });
      continue;
    }
    if (row.snapshot_state === "VERIFIED") {
      await transitionMacroWeeklySnapshotManifestState({
        regimeDatasetId: RRP_DATASET.datasetId,
        snapshotId: row.snapshot_id,
        expectedSnapshotHash: row.snapshot_hash,
        fromState: "VERIFIED",
        toState: "ACTIVE",
        transitionedAtUtc: activatedAtUtc,
        transitionRunId: `${CONTROL_REPAIR_VERSION}_legal_activation`,
        reason: "Gate 50 activates replacement source manifest after verified state.",
        actorOrServiceVersion: "macro_snapshot_transition_service_v2",
        featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
        activationScope: ACTIVATION_SCOPE,
        effectiveFromUtc,
        approvedRootPromotionManifestId: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
        approvedRootPromotionManifestHash: PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
        parentPromotionProofReceiptHash: PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
      });
      continue;
    }
    if (row.snapshot_state !== "ACTIVE") {
      throw new Error(`Historical replacement activation cannot continue from ${row.snapshot_state} for ${row.snapshot_id}`);
    }
  }
}

async function runPostActivationDirectActiveInsertProbe(
  source: ManifestRow,
  effectiveTimeMap: Map<string, string>,
) {
  const duplicateSnapshotId = hashPayload({
    type: "gate50_post_activation_direct_active_insert_probe_v2",
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
          exactEffectiveFromUtc(source.macro_week_id, effectiveTimeMap),
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
          exactEffectiveFromUtc(source.macro_week_id, effectiveTimeMap),
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
    bothRejectedByInsertGuard: firstErrorCode === "23514" && secondErrorCode === "23514",
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
    `- Repaired active manifests: ${summary.repairedActiveManifests}`,
    `- Superseded legacy manifests: ${summary.revokedLegacyManifests}`,
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
  await ensureMacroRegimeWarehouseSchema();
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
  const effectiveTimeMap = await readExactEffectiveTimeMap();
  const beforeManifests = await readManifestRows();

  await runActivation(generatedAtUtc, effectiveTimeMap);

  const manifests = await readManifestRows();
  const duplicateActiveKeys = await activeDuplicateRows();
  const contentAfter = {
    weekly: await readWeeklyContentHash(),
    aggregate: await readAggregateContentHash(),
  };
  const activeManifests = manifests.filter((row) => row.snapshot_state === "ACTIVE");
  const revokedLegacyManifests = manifests.filter((row) =>
    row.snapshot_state === "REVOKED"
    && row.superseded_by_snapshot_id !== null
    && row.supersedes_snapshot_id === null);
  const repairedActiveManifests = activeManifests.filter((row) => row.supersedes_snapshot_id !== null);
  const postActivationDirectActiveInsertProbe = activeManifests[0]
    ? await runPostActivationDirectActiveInsertProbe(activeManifests[0], effectiveTimeMap)
    : null;
  const manifestStateCounts = manifests.reduce<Record<string, number>>((counts, row) => {
    counts[row.snapshot_state] = (counts[row.snapshot_state] ?? 0) + 1;
    return counts;
  }, {});
  const activatedAtValues = [...new Set(activeManifests.map((row) => row.activated_at_utc ?? "null"))].sort();
  const featureBundleValues = [...new Set(activeManifests.map((row) => row.feature_bundle_manifest_id ?? "null"))].sort();
  const activationScopeValues = [...new Set(activeManifests.map((row) => row.activation_scope ?? "null"))].sort();
  const approvedRootIdValues = [...new Set(activeManifests.map((row) => row.approved_root_promotion_manifest_id ?? "null"))].sort();
  const approvedRootHashValues = [...new Set(activeManifests.map((row) => row.approved_root_promotion_manifest_hash ?? "null"))].sort();
  const parentProofReceiptHashValues = [...new Set(activeManifests.map((row) => row.parent_promotion_proof_receipt_hash ?? "null"))].sort();
  const promotionManifestValues = [...new Set(activeManifests.map((row) => row.promotion_manifest_id))].sort();
  const legacySnapshotHashById = new Map(revokedLegacyManifests.map((row) => [row.snapshot_id, row.snapshot_hash]));
  const effectiveFromMismatches = activeManifests.filter((row) =>
    !row.effective_from_utc
    || normalizeDbTimestamp(row.effective_from_utc) !== exactEffectiveFromUtc(row.macro_week_id, effectiveTimeMap));
  const snapshotHashChangedRows = activeManifests.filter((row) =>
    !row.supersedes_snapshot_id
    || legacySnapshotHashById.get(row.supersedes_snapshot_id) !== row.snapshot_hash);

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
        && repairedActiveManifests.length === 372
        && (manifestStateCounts.ACTIVE ?? 0) === 372,
      expectation: "Historical activation produces exactly 372 legally-transitioned replacement ACTIVE aggregate weekly manifests.",
      actual: JSON.stringify({ total: manifests.length, states: manifestStateCounts }),
      blocker: "active_manifest_count_mismatch",
    }),
    assertion({
      id: "legacy_active_manifests_superseded",
      category: "activation",
      passed: revokedLegacyManifests.length >= 372
        && repairedActiveManifests.every((row) => row.supersedes_snapshot_id !== null),
      expectation: "Legacy direct-ACTIVE manifests are preserved as revoked superseded control evidence and replacements reference superseded identities.",
      actual: JSON.stringify({
        revokedLegacyManifests: revokedLegacyManifests.length,
        repairedActiveManifests: repairedActiveManifests.length,
      }),
      blocker: "legacy_active_manifest_not_superseded",
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
      passed: approvedRootIdValues.length === 1
        && approvedRootIdValues[0] === PARENT_APPROVED_ROOT.rootRrpPromotionManifestId
        && approvedRootHashValues.length === 1
        && approvedRootHashValues[0] === PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash
        && parentProofReceiptHashValues.length === 1
        && parentProofReceiptHashValues[0] === PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash
        && String(lifecycleSummary.resolvedContentJoinMapHash ?? "") === EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
      expectation: "Historical activation is bound to the already-approved parent root manifest evidence without changing the source content identity.",
      actual: JSON.stringify({ PARENT_APPROVED_ROOT, approvedRootIdValues, approvedRootHashValues, parentProofReceiptHashValues }),
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
      passed: contentBefore.weekly.hash === contentAfter.weekly.hash,
      expectation: "Activation changes lifecycle/control metadata only; weekly source rows are unchanged.",
      actual: JSON.stringify({ before: contentBefore, after: contentAfter }),
      blocker: "activation_changed_source_content_hash",
    }),
    assertion({
      id: "historical_effective_time_and_current_admin_time",
      category: "activation_time",
      passed: effectiveFromMismatches.length === 0
        && activatedAtValues.length >= 1
        && !activatedAtValues.includes("null")
        && activatedAtValues.every((value) => DateTime.fromISO(value.replace(" ", "T").replace("+00", "Z"), { zone: "utc" }).year === 2026),
      expectation: "effective_from_utc equals the exact historical matrix week-open while activated_at_utc is an honest current administrative activation time.",
      actual: JSON.stringify({ activatedAtValues, effectiveFromMismatchSamples: effectiveFromMismatches.slice(0, 5) }),
      blocker: "activation_time_contract_failed",
    }),
    assertion({
      id: "post_activation_duplicate_probe_rejected",
      category: "database_uniqueness",
      passed: postActivationDirectActiveInsertProbe?.bothRejectedByInsertGuard === true,
      expectation: "Direct ACTIVE inserts are rejected by the database insert guard and cannot bypass the transition service.",
      actual: JSON.stringify(postActivationDirectActiveInsertProbe),
      blocker: "direct_active_insert_probe_not_rejected",
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
      repairedActiveManifests: repairedActiveManifests.length,
      revokedLegacyManifests: revokedLegacyManifests.length,
      totalAggregateManifests: manifests.length,
      exactEffectiveTimeMapRows: effectiveTimeMap.size,
      duplicateActiveKeys: duplicateActiveKeys.length,
      promotionManifestId: RRP_DATASET.promotionManifestId,
      approvedRootPromotionManifestId: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
      approvedRootPromotionManifestHash: PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
      parentPromotionProofReceiptHash: PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
      featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
      activationScope: ACTIVATION_SCOPE,
      administrativeActivatedAtUtc: activatedAtValues[0] ?? null,
      historicalActivationClaim: false,
      historicalEffectiveFromUtc: {
        first: activeManifests[0]?.effective_from_utc ?? null,
        last: activeManifests.at(-1)?.effective_from_utc ?? null,
      },
      postActivationDirectActiveInsertProbe,
      contentHashInvariantProof: contentBefore.weekly.hash === contentAfter.weekly.hash
        ? "PASS" : "FAIL",
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
      repairedActiveManifests: repairedActiveManifests.length,
      revokedLegacyManifests: revokedLegacyManifests.length,
      activatedAtValues,
      featureBundleValues,
      activationScopeValues,
      approvedRootIdValues,
      approvedRootHashValues,
      parentProofReceiptHashValues,
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
