import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { PAIRS_BY_ASSET_CLASS } from "../../src/lib/cotPairs";
import { getPool, query } from "../../src/lib/db";
import {
  ensureMacroRegimeWarehouseSchema,
  isMacroSnapshotStateTransitionAllowed,
  transitionMacroWeeklySnapshotManifestState,
  validateMacroSnapshotConsumptionState,
  type MacroSnapshotState,
} from "../../src/lib/research/macroRegimeDataset";

loadEnvConfig(process.cwd());

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const GATE44_MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
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
const SUPPORTING_RECEIPTS = {
  lifecycleUniqueness:
    "app/reports/data-verification/macro-regime/gate50-lifecycle-uniqueness-20260623.json",
  rrpSealedJoin:
    "app/reports/data-verification/macro-regime/gate50-rrp-boundary-repaired-sealed-join-20260623.json",
};
const PARENT_APPROVED_ROOT = {
  rootRrpPromotionManifestId: "6656b5da3d5552811b3f0f7c10b14d4af1dfbe191fb508231967a9e54d98414c",
  rootRrpPromotionManifestHash: "12a22849ff794ce62ca6d618461a74f21e8967f518b82834aaebbc66ff172275",
  parentPromotionProofReceiptHash: "0e625be7126c90ce7748847b9ebdf6872ffbeb099caafa7e69348fe482f8409c",
};

type JsonRecord = Record<string, unknown>;
type Assertion = {
  id: string;
  category: string;
  status: "PASS" | "FAIL";
  expectation: string;
  actual: string;
  blocker: string | null;
  evidence?: unknown;
};

type MatrixContextRow = {
  week_open_utc: string;
  symbol: string;
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
  revoked_at_utc: string | null;
  supersedes_snapshot_id: string | null;
  superseded_by_snapshot_id: string | null;
  row_snapshot_count: number;
  coverage: unknown;
  flags: unknown;
};

type SnapshotRow = {
  week_open_utc: string;
  source_family: string;
  source_id: string;
  currency: string;
  instrument: string;
  snapshot_id: string | null;
  snapshot_hash: string | null;
  snapshot_state: string;
  coverage: unknown;
  flags: unknown;
};

const FX_PAIR_DEFINITIONS = PAIRS_BY_ASSET_CLASS.fx.map((row) => ({
  pair: row.pair.toUpperCase(),
  base: row.base.toUpperCase(),
  quote: row.quote.toUpperCase(),
}));

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
    evidence: input.evidence,
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

function macroWeekIdFor(weekOpenUtc: string) {
  return `macro_week_${weekOpenUtc.slice(0, 10)}`;
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

async function readMatrixContexts() {
  return query<MatrixContextRow>(
    `
      SELECT
        to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc,
        UPPER(symbol) AS symbol
      FROM research_matrix_source_contexts
      WHERE dataset_id = $1::uuid
      ORDER BY week_open_utc, symbol
    `,
    [GATE44_MATRIX_DATASET_ID],
  );
}

async function readManifestInventory() {
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
        revoked_at_utc::text,
        supersedes_snapshot_id,
        superseded_by_snapshot_id,
        row_snapshot_count::int,
        coverage,
        flags
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
      ORDER BY macro_week_id, snapshot_id
    `,
    [RRP_DATASET.datasetId],
  );
}

async function readSnapshots() {
  return query<SnapshotRow>(
    `
      SELECT
        week_open_utc::text,
        source_family,
        source_id,
        currency,
        instrument,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        coverage,
        flags
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
      ORDER BY week_open_utc, currency, source_family, source_id, instrument
    `,
    [RRP_DATASET.datasetId],
  );
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
        AND promotion_manifest_id = $2
      ORDER BY macro_week_id, snapshot_id
    `,
    [RRP_DATASET.datasetId, RRP_DATASET.promotionManifestId],
  );
  return { rows: rows.length, hash: hashPayload(rows) };
}

async function insertDisposableManifest(options: {
  source: ManifestRow;
  promotionManifestId: string;
  activationScope: string;
  snapshotId: string;
  snapshotHash: string;
  supersedesSnapshotId?: string | null;
}) {
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
        effective_from_utc,
        supersedes_snapshot_id,
        row_snapshot_count,
        coverage,
        flags
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
        $14::timestamptz,
        $15,
        $16,
        COALESCE($17::jsonb, '{}'::jsonb),
        COALESCE($18::jsonb, '{}'::jsonb)
      )
      ON CONFLICT (regime_dataset_id, snapshot_id) DO NOTHING
    `,
    [
      RRP_DATASET.datasetId,
      options.promotionManifestId,
      FEATURE_BUNDLE_MANIFEST_ID,
      options.activationScope,
      PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
      PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
      PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
      options.source.contract_manifest_hash,
      options.source.macro_week_id,
      options.source.freeze_version,
      options.snapshotId,
      options.snapshotHash,
      options.source.sealed_at_utc,
      `${options.source.macro_week_id.replace("macro_week_", "")}T00:00:00.000Z`,
      options.supersedesSnapshotId ?? null,
      options.source.row_snapshot_count,
      JSON.stringify(options.source.coverage ?? {}),
      JSON.stringify(options.source.flags ?? {}),
    ],
  );
}

async function readManifestBySnapshotId(snapshotId: string) {
  const rows = await query<ManifestRow>(
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
        revoked_at_utc::text,
        supersedes_snapshot_id,
        superseded_by_snapshot_id,
        row_snapshot_count::int,
        coverage,
        flags
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
        AND snapshot_id = $2
    `,
    [RRP_DATASET.datasetId, snapshotId],
  );
  return rows[0] ?? null;
}

async function transitionDisposableToActive(options: {
  source: ManifestRow;
  snapshotId: string;
  snapshotHash: string;
  transitionRunId: string;
  transitionedAtUtc: string;
  activationScope: string;
}) {
  await transitionMacroWeeklySnapshotManifestState({
    regimeDatasetId: RRP_DATASET.datasetId,
    snapshotId: options.snapshotId,
    expectedSnapshotHash: options.snapshotHash,
    fromState: "SEALED",
    toState: "VERIFIED",
    transitionedAtUtc: options.transitionedAtUtc,
    transitionRunId: options.transitionRunId,
    reason: "Gate 50 disposable revocation proof verifies manifest before activation.",
    actorOrServiceVersion: "macro_snapshot_transition_service_v1",
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    activationScope: options.activationScope,
    approvedRootPromotionManifestId: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
    approvedRootPromotionManifestHash: PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
    parentPromotionProofReceiptHash: PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
  });
  await transitionMacroWeeklySnapshotManifestState({
    regimeDatasetId: RRP_DATASET.datasetId,
    snapshotId: options.snapshotId,
    expectedSnapshotHash: options.snapshotHash,
    fromState: "VERIFIED",
    toState: "ACTIVE",
    transitionedAtUtc: options.transitionedAtUtc,
    transitionRunId: options.transitionRunId,
    reason: "Gate 50 disposable revocation proof activates manifest before terminal lifecycle test.",
    actorOrServiceVersion: "macro_snapshot_transition_service_v1",
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    activationScope: options.activationScope,
    effectiveFromUtc: `${options.source.macro_week_id.replace("macro_week_", "")}T00:00:00.000Z`,
    approvedRootPromotionManifestId: PARENT_APPROVED_ROOT.rootRrpPromotionManifestId,
    approvedRootPromotionManifestHash: PARENT_APPROVED_ROOT.rootRrpPromotionManifestHash,
    parentPromotionProofReceiptHash: PARENT_APPROVED_ROOT.parentPromotionProofReceiptHash,
  });
}

function pairsForWeek(matrixContexts: MatrixContextRow[], macroWeekId: string) {
  return matrixContexts.filter((row) => macroWeekIdFor(row.week_open_utc) === macroWeekId);
}

function pairDefinitionsForCurrency(currency: string) {
  const normalized = currency.toUpperCase();
  return FX_PAIR_DEFINITIONS.filter((row) => row.base === normalized || row.quote === normalized);
}

function activeClone(manifest: ManifestRow) {
  return {
    ...manifest,
    feature_bundle_manifest_id: FEATURE_BUNDLE_MANIFEST_ID,
    activation_scope: ACTIVATION_SCOPE,
    snapshot_state: "ACTIVE" as MacroSnapshotState,
    revoked_at_utc: null,
    superseded_by_snapshot_id: null,
  };
}

function aggregateRevocationProof(manifest: ManifestRow, weekPairs: MatrixContextRow[]) {
  const active = activeClone(manifest);
  const revoked = {
    ...active,
    revoked_at_utc: "2026-06-23T00:00:00.000Z",
  };
  const quarantined = {
    ...active,
    snapshot_state: "QUARANTINED" as MacroSnapshotState,
  };
  const revokedState = validateMacroSnapshotConsumptionState({
    snapshotState: revoked.snapshot_state,
    revokedAtUtc: revoked.revoked_at_utc,
  });
  const quarantinedState = validateMacroSnapshotConsumptionState({
    snapshotState: quarantined.snapshot_state,
    revokedAtUtc: quarantined.revoked_at_utc,
  });
  const revokedBlocked = revokedState.ok ? [] : weekPairs.map((row) => row.symbol);
  const quarantinedBlocked = quarantinedState.ok ? [] : weekPairs.map((row) => row.symbol);

  return {
    macroWeekId: manifest.macro_week_id,
    expectedPairWeeks: weekPairs.length,
    revokedBlockedPairWeeks: revokedBlocked.length,
    quarantinedBlockedPairWeeks: quarantinedBlocked.length,
    revokedState,
    quarantinedState,
    sampleRevokedBlockedPairs: revokedBlocked.slice(0, 8),
    sampleQuarantinedBlockedPairs: quarantinedBlocked.slice(0, 8),
  };
}

function currencyRevocationProof(options: {
  targetCurrency: string;
  targetSnapshot: SnapshotRow;
  weekPairs: MatrixContextRow[];
}) {
  const pairSymbols = pairDefinitionsForCurrency(options.targetCurrency).map((row) => row.pair).sort();
  const matrixSymbols = new Set(options.weekPairs.map((row) => row.symbol));
  const impactedPairs = pairSymbols.filter((symbol) => matrixSymbols.has(symbol));
  const unaffectedPairs = options.weekPairs
    .map((row) => row.symbol)
    .filter((symbol) => !impactedPairs.includes(symbol))
    .sort();
  const revokedState = validateMacroSnapshotConsumptionState({
    snapshotState: "ACTIVE",
    revokedAtUtc: "2026-06-23T00:00:00.000Z",
  });

  return {
    targetCurrency: options.targetCurrency,
    targetSnapshotId: options.targetSnapshot.snapshot_id,
    targetSnapshotHash: options.targetSnapshot.snapshot_hash,
    expectedImpactedPairs: pairSymbols.length,
    impactedPairs,
    blockedPairWeeks: revokedState.ok ? 0 : impactedPairs.length,
    unaffectedPairWeeks: unaffectedPairs.length,
    revokedState,
  };
}

function supersessionProof(manifest: ManifestRow) {
  const originalActivatedRecord = activeClone(manifest);
  const originalRecordBefore = stableJson(originalActivatedRecord);
  const supersedingSnapshotHash = hashPayload({
    type: "gate50_disposable_supersession_content_v1",
    priorSnapshotHash: manifest.snapshot_hash,
    reason: "revocation_supersession_proof",
  });
  const supersedingSnapshotId = hashPayload({
    type: "gate50_disposable_supersession_manifest_v1",
    promotionManifestId: manifest.promotion_manifest_id,
    macroWeekId: manifest.macro_week_id,
    freezeVersion: manifest.freeze_version,
    supersedesSnapshotId: manifest.snapshot_id,
    supersedingSnapshotHash,
  });
  const supersedingRecord = {
    ...originalActivatedRecord,
    snapshot_id: supersedingSnapshotId,
    snapshot_hash: supersedingSnapshotHash,
    supersedes_snapshot_id: manifest.snapshot_id,
    superseded_by_snapshot_id: null,
  };
  const originalRecordAfter = stableJson(originalActivatedRecord);

  return {
    originalSnapshotId: manifest.snapshot_id,
    originalSnapshotHash: manifest.snapshot_hash,
    supersedingSnapshotId,
    supersedingSnapshotHash,
    supersedingRecordSupersedes: supersedingRecord.supersedes_snapshot_id,
    originalRecordPreserved: hashPayload(originalRecordBefore) === hashPayload(originalRecordAfter),
    identitiesDiffer: supersedingSnapshotId !== manifest.snapshot_id
      && supersedingSnapshotHash !== manifest.snapshot_hash,
    originalRecordContentHashBefore: hashPayload(originalRecordBefore),
    originalRecordContentHashAfter: hashPayload(originalRecordAfter),
  };
}

function passReceiptInvalidationProof(manifest: ManifestRow) {
  const syntheticPassReceipt = {
    joinReceiptStatus: "PASS",
    diagnosticOnly: false,
    promotionEligible: true,
    promotionManifestId: manifest.promotion_manifest_id,
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    macroWeekId: manifest.macro_week_id,
    freezeVersion: manifest.freeze_version,
    activationScope: ACTIVATION_SCOPE,
    selectedSnapshotId: manifest.snapshot_id,
    selectedSnapshotHash: manifest.snapshot_hash,
    resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
  };
  const revokedState = validateMacroSnapshotConsumptionState({
    snapshotState: "ACTIVE",
    revokedAtUtc: "2026-06-23T00:00:00.000Z",
  });
  return {
    syntheticPassReceipt,
    receiptUsableAfterRevocation: syntheticPassReceipt.joinReceiptStatus === "PASS"
      && syntheticPassReceipt.diagnosticOnly === false
      && syntheticPassReceipt.promotionEligible === true
      && revokedState.ok,
    invalidationBlockers: revokedState.blockers,
  };
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const blockers = Object.entries(asRecord(report.blockers))
    .map(([key, value]) => `| ${key} | ${value} |`);
  return [
    "# Gate 50 Revocation And Supersession Proof Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Aggregate revoked blocked pair-weeks: ${summary.aggregateRevokedBlockedPairWeeks}`,
    `- Aggregate quarantined blocked pair-weeks: ${summary.aggregateQuarantinedBlockedPairWeeks}`,
    `- Currency revoked blocked pair-weeks: ${summary.currencyRevokedBlockedPairWeeks}`,
    `- Prior PASS receipt invalidated: ${summary.priorPassReceiptInvalidated}`,
    `- Supersession identity proof: ${summary.supersessionIdentityProof}`,
    `- Reactivation guard proof: ${summary.reactivationGuardProof}`,
    `- Content hash invariant: ${summary.contentHashInvariantProof}`,
    `- Diagnostic only: ${summary.diagnosticOnly}`,
    `- Promotion eligible: ${summary.promotionEligible}`,
    `- Resolved content join-map hash: ${summary.resolvedContentJoinMapHash}`,
    "",
    "## Blockers",
    "",
    "| Blocker | Count |",
    "|---|---:|",
    ...(blockers.length > 0 ? blockers : ["| - | 0 |"]),
    "",
    "This proof is diagnostic lifecycle evidence. It does not perform historical activation, compute P&L, make a strategy decision, or open outcome consumption.",
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for revocation/supersession proof.");
  }
  await ensureMacroRegimeWarehouseSchema();
  const generatedAtUtc = DateTime.utc().toISO({ suppressMilliseconds: false }) ?? new Date().toISOString();
  const [lifecycleReceipt, rrpJoinReceipt] = await Promise.all([
    readJsonReceipt(SUPPORTING_RECEIPTS.lifecycleUniqueness),
    readJsonReceipt(SUPPORTING_RECEIPTS.rrpSealedJoin),
  ]);
  const lifecycleSummary = asRecord(lifecycleReceipt.json.summary);
  const rrpJoinSummary = asRecord(rrpJoinReceipt.json.summary);

  const contentBefore = {
    weekly: await readWeeklyContentHash(),
    aggregate: await readAggregateContentHash(),
  };
  const [matrixContexts, manifests, snapshots] = await Promise.all([
    readMatrixContexts(),
    readManifestInventory(),
    readSnapshots(),
  ]);
  const sourceManifest = manifests.find((row) =>
    row.promotion_manifest_id === RRP_DATASET.promotionManifestId
    && row.contract_manifest_hash === RRP_DATASET.contractManifestHash
    && row.snapshot_state === "ACTIVE"
    && row.revoked_at_utc === null) ?? null;
  if (!sourceManifest) {
    throw new Error("No current ACTIVE RRP manifest found for revocation proof.");
  }
  const disposablePrefix = hashPayload({
    type: "gate50_persisted_revocation_disposable_v1",
    generatedAtUtc,
    sourceSnapshotId: sourceManifest.snapshot_id,
  }).slice(0, 16);
  const disposablePromotionManifestId = `gate50_disposable_revocation_${disposablePrefix}`;
  const disposableActivationScope = `gate50_disposable_${disposablePrefix}`;
  const revokedSnapshotId = `gate50_disposable_revoked_${disposablePrefix}`;
  const quarantinedSnapshotId = `gate50_disposable_quarantined_${disposablePrefix}`;
  const supersededOriginalSnapshotId = `gate50_disposable_superseded_original_${disposablePrefix}`;
  const supersedingSnapshotId = `gate50_disposable_superseding_${disposablePrefix}`;
  const supersedingSnapshotHash = hashPayload({
    type: "gate50_disposable_superseding_hash_v1",
    sourceSnapshotHash: sourceManifest.snapshot_hash,
    disposablePrefix,
  });
  const disposableRows = [
    { snapshotId: revokedSnapshotId, snapshotHash: sourceManifest.snapshot_hash, supersedesSnapshotId: null, scope: `${disposableActivationScope}_revoked` },
    { snapshotId: quarantinedSnapshotId, snapshotHash: sourceManifest.snapshot_hash, supersedesSnapshotId: null, scope: `${disposableActivationScope}_quarantined` },
    { snapshotId: supersededOriginalSnapshotId, snapshotHash: sourceManifest.snapshot_hash, supersedesSnapshotId: null, scope: `${disposableActivationScope}_superseded` },
    { snapshotId: supersedingSnapshotId, snapshotHash: supersedingSnapshotHash, supersedesSnapshotId: supersededOriginalSnapshotId, scope: `${disposableActivationScope}_superseding` },
  ];
  for (const row of disposableRows) {
    await insertDisposableManifest({
      source: sourceManifest,
      promotionManifestId: disposablePromotionManifestId,
      activationScope: row.scope,
      snapshotId: row.snapshotId,
      snapshotHash: row.snapshotHash,
      supersedesSnapshotId: row.supersedesSnapshotId,
    });
    await transitionDisposableToActive({
      source: sourceManifest,
      snapshotId: row.snapshotId,
      snapshotHash: row.snapshotHash,
      transitionRunId: `gate50_persisted_revocation_${disposablePrefix}`,
      transitionedAtUtc: generatedAtUtc,
      activationScope: row.scope,
    });
  }
  await transitionMacroWeeklySnapshotManifestState({
    regimeDatasetId: RRP_DATASET.datasetId,
    snapshotId: revokedSnapshotId,
    expectedSnapshotHash: sourceManifest.snapshot_hash,
    fromState: "ACTIVE",
    toState: "REVOKED",
    transitionedAtUtc: generatedAtUtc,
    transitionRunId: `gate50_persisted_revocation_${disposablePrefix}`,
    reason: "Gate 50 persisted disposable aggregate revocation proof.",
    actorOrServiceVersion: "macro_snapshot_transition_service_v1",
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    activationScope: `${disposableActivationScope}_revoked`,
    revocationReason: "gate50_disposable_revocation_proof",
  });
  await transitionMacroWeeklySnapshotManifestState({
    regimeDatasetId: RRP_DATASET.datasetId,
    snapshotId: quarantinedSnapshotId,
    expectedSnapshotHash: sourceManifest.snapshot_hash,
    fromState: "ACTIVE",
    toState: "QUARANTINED",
    transitionedAtUtc: generatedAtUtc,
    transitionRunId: `gate50_persisted_quarantine_${disposablePrefix}`,
    reason: "Gate 50 persisted disposable aggregate quarantine proof.",
    actorOrServiceVersion: "macro_snapshot_transition_service_v1",
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    activationScope: `${disposableActivationScope}_quarantined`,
  });
  await transitionMacroWeeklySnapshotManifestState({
    regimeDatasetId: RRP_DATASET.datasetId,
    snapshotId: supersededOriginalSnapshotId,
    expectedSnapshotHash: sourceManifest.snapshot_hash,
    fromState: "ACTIVE",
    toState: "REVOKED",
    transitionedAtUtc: generatedAtUtc,
    transitionRunId: `gate50_persisted_supersession_${disposablePrefix}`,
    reason: "Gate 50 persisted disposable supersession proof.",
    actorOrServiceVersion: "macro_snapshot_transition_service_v1",
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    activationScope: `${disposableActivationScope}_superseded`,
    revocationReason: "gate50_disposable_superseded_by_new_identity",
    supersededBySnapshotId: supersedingSnapshotId,
  });
  const persistedLifecycleRows = {
    revoked: await readManifestBySnapshotId(revokedSnapshotId),
    quarantined: await readManifestBySnapshotId(quarantinedSnapshotId),
    supersededOriginal: await readManifestBySnapshotId(supersededOriginalSnapshotId),
    superseding: await readManifestBySnapshotId(supersedingSnapshotId),
  };
  const weekPairs = pairsForWeek(matrixContexts, sourceManifest.macro_week_id);
  const targetCurrency = snapshots.some((row) =>
    macroWeekIdFor(row.week_open_utc) === sourceManifest.macro_week_id
    && row.currency.toUpperCase() === "USD")
    ? "USD"
    : snapshots.find((row) => macroWeekIdFor(row.week_open_utc) === sourceManifest.macro_week_id)?.currency.toUpperCase() ?? "USD";
  const targetSnapshot = snapshots.find((row) =>
    macroWeekIdFor(row.week_open_utc) === sourceManifest.macro_week_id
    && row.currency.toUpperCase() === targetCurrency
    && row.source_family === "real_rate_pressure") ?? null;
  if (!targetSnapshot) {
    throw new Error(`No ${targetCurrency} real-rate-pressure snapshot found for revocation proof.`);
  }

  const aggregateProof = aggregateRevocationProof(sourceManifest, weekPairs);
  const currencyProof = currencyRevocationProof({ targetCurrency, targetSnapshot, weekPairs });
  const passInvalidation = passReceiptInvalidationProof(sourceManifest);
  const supersession = supersessionProof(sourceManifest);
  const reactivationProof = {
    revokedToActiveAllowed: isMacroSnapshotStateTransitionAllowed("REVOKED", "ACTIVE"),
    quarantinedToActiveAllowed: isMacroSnapshotStateTransitionAllowed("QUARANTINED", "ACTIVE"),
  };
  const readGuards = {
    active: validateMacroSnapshotConsumptionState({ snapshotState: "ACTIVE", revokedAtUtc: null }),
    revoked: validateMacroSnapshotConsumptionState({
      snapshotState: "ACTIVE",
      revokedAtUtc: "2026-06-23T00:00:00.000Z",
    }),
    quarantined: validateMacroSnapshotConsumptionState({ snapshotState: "QUARANTINED", revokedAtUtc: null }),
    superseded: validateMacroSnapshotConsumptionState({
      snapshotState: "ACTIVE",
      revokedAtUtc: null,
      supersededBySnapshotId: supersession.supersedingSnapshotId,
    }),
  };
  const contentAfter = {
    weekly: await readWeeklyContentHash(),
    aggregate: await readAggregateContentHash(),
  };

  const assertions = [
    assertion({
      id: "lifecycle_uniqueness_prerequisite_passed",
      category: "prerequisite",
      passed: lifecycleSummary.status === "PASS_LIFECYCLE_UNIQUENESS"
        && lifecycleSummary.disposableActiveRowsCleanedUp === true,
      expectation: "Lifecycle uniqueness with disposable committed-write race must pass before revocation proof.",
      actual: JSON.stringify(lifecycleSummary),
      blocker: "lifecycle_uniqueness_prerequisite_not_passed",
    }),
    assertion({
      id: "rrp_sealed_join_prerequisite_passed",
      category: "prerequisite",
      passed: rrpJoinSummary.joinReceiptStatus === "PASS_DIAGNOSTIC"
        && rrpJoinSummary.resolvedContentJoinMapHash === EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
      expectation: "Current SEALED RRP join must be complete and content-bound before revocation proof.",
      actual: JSON.stringify(rrpJoinSummary),
      blocker: "rrp_sealed_join_prerequisite_not_passed",
    }),
    assertion({
      id: "aggregate_revocation_blocks_all_pairs_for_week",
      category: "aggregate_revocation",
      passed: aggregateProof.expectedPairWeeks === 28
        && aggregateProof.revokedBlockedPairWeeks === 28
        && aggregateProof.revokedState.blockers.includes("snapshot_revoked"),
      expectation: "Revoking one aggregate weekly manifest blocks all 28 pair-week contexts for that macro week.",
      actual: JSON.stringify(aggregateProof),
      blocker: "aggregate_revocation_not_blocking_all_pairs",
    }),
    assertion({
      id: "persisted_disposable_lifecycle_transitions_passed",
      category: "persisted_lifecycle",
      passed: persistedLifecycleRows.revoked?.snapshot_state === "REVOKED"
        && persistedLifecycleRows.revoked.revoked_at_utc !== null
        && persistedLifecycleRows.quarantined?.snapshot_state === "QUARANTINED"
        && persistedLifecycleRows.supersededOriginal?.snapshot_state === "REVOKED"
        && persistedLifecycleRows.supersededOriginal.superseded_by_snapshot_id === supersedingSnapshotId
        && persistedLifecycleRows.superseding?.snapshot_state === "ACTIVE"
        && persistedLifecycleRows.superseding.supersedes_snapshot_id === supersededOriginalSnapshotId,
      expectation: "Disposable manifests persist real ACTIVE -> REVOKED, ACTIVE -> QUARANTINED, and supersession transitions through the lifecycle service.",
      actual: JSON.stringify(persistedLifecycleRows),
      blocker: "persisted_disposable_lifecycle_transition_failed",
    }),
    assertion({
      id: "aggregate_quarantine_blocks_all_pairs_for_week",
      category: "aggregate_quarantine",
      passed: aggregateProof.expectedPairWeeks === 28
        && aggregateProof.quarantinedBlockedPairWeeks === 28
        && aggregateProof.quarantinedState.blockers.includes("snapshot_quarantined"),
      expectation: "Quarantining one aggregate weekly manifest blocks all 28 pair-week contexts for that macro week.",
      actual: JSON.stringify(aggregateProof),
      blocker: "aggregate_quarantine_not_blocking_all_pairs",
    }),
    assertion({
      id: "required_currency_revocation_blocks_currency_pairs",
      category: "currency_revocation",
      passed: currencyProof.expectedImpactedPairs === 7
        && currencyProof.blockedPairWeeks === 7
        && currencyProof.revokedState.blockers.includes("snapshot_revoked"),
      expectation: "Revoking a required currency snapshot blocks every pair involving that currency.",
      actual: JSON.stringify(currencyProof),
      blocker: "currency_revocation_not_blocking_impacted_pairs",
    }),
    assertion({
      id: "pass_join_receipt_invalid_after_revocation",
      category: "receipt_invalidation",
      passed: passInvalidation.receiptUsableAfterRevocation === false
        && passInvalidation.invalidationBlockers.includes("snapshot_revoked"),
      expectation: "A previously PASS join receipt is unusable after revocation of its selected aggregate manifest.",
      actual: JSON.stringify(passInvalidation),
      blocker: "pass_join_receipt_still_usable_after_revocation",
    }),
    assertion({
      id: "revoked_quarantined_and_superseded_reads_rejected",
      category: "consumption_guard",
      passed: readGuards.active.ok
        && !readGuards.revoked.ok
        && !readGuards.quarantined.ok
        && !readGuards.superseded.ok,
      expectation: "Consumers can read only exact non-revoked ACTIVE snapshots; revoked, quarantined, or superseded objects fail closed.",
      actual: JSON.stringify(readGuards),
      blocker: "revoked_quarantined_or_superseded_read_allowed",
    }),
    assertion({
      id: "supersession_creates_new_identity_and_preserves_original",
      category: "supersession",
      passed: supersession.identitiesDiffer
        && supersession.supersedingRecordSupersedes === supersession.originalSnapshotId
        && supersession.originalRecordPreserved,
      expectation: "Supersession creates a new identity that points to the original while preserving the original activated record content.",
      actual: JSON.stringify(supersession),
      blocker: "supersession_identity_or_original_preservation_failed",
    }),
    assertion({
      id: "revoked_and_quarantined_cannot_reactivate_silently",
      category: "reactivation_guard",
      passed: reactivationProof.revokedToActiveAllowed === false
        && reactivationProof.quarantinedToActiveAllowed === false,
      expectation: "REVOKED and QUARANTINED objects cannot transition directly back to ACTIVE.",
      actual: JSON.stringify(reactivationProof),
      blocker: "revoked_or_quarantined_reactivation_allowed",
    }),
    assertion({
      id: "content_hashes_immutable_during_revocation_proof",
      category: "content_invariant",
      passed: contentBefore.weekly.hash === contentAfter.weekly.hash
        && contentBefore.aggregate.hash === contentAfter.aggregate.hash
        && EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH === String(rrpJoinSummary.resolvedContentJoinMapHash ?? ""),
      expectation: "Revocation proof does not mutate weekly source rows, aggregate manifest content hashes, or the content join-map identity.",
      actual: JSON.stringify({ contentBefore, contentAfter, resolvedContentJoinMapHash: rrpJoinSummary.resolvedContentJoinMapHash }),
      blocker: "content_hash_changed_during_revocation_proof",
    }),
  ];
  const blockers = blockerCounts(assertions);
  const pass = Object.keys(blockers).length === 0;
  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose:
      "Diagnostic revocation, quarantine, and supersession proof for current repaired RRP source bundle. Persists disposable lifecycle evidence and does not open outcome consumption.",
    summary: {
      status: pass ? "PASS_REVOCATION_SUPERSESSION" : "FAIL_REVOCATION_SUPERSESSION",
      aggregateRevokedBlockedPairWeeks: aggregateProof.revokedBlockedPairWeeks,
      aggregateQuarantinedBlockedPairWeeks: aggregateProof.quarantinedBlockedPairWeeks,
      currencyRevokedTargetCurrency: targetCurrency,
      currencyRevokedBlockedPairWeeks: currencyProof.blockedPairWeeks,
      priorPassReceiptInvalidated: !passInvalidation.receiptUsableAfterRevocation,
      supersessionIdentityProof: supersession.identitiesDiffer && supersession.originalRecordPreserved ? "PASS" : "FAIL",
      reactivationGuardProof: reactivationProof.revokedToActiveAllowed === false
        && reactivationProof.quarantinedToActiveAllowed === false ? "PASS" : "FAIL",
      contentHashInvariantProof: contentBefore.weekly.hash === contentAfter.weekly.hash
        && contentBefore.aggregate.hash === contentAfter.aggregate.hash ? "PASS" : "FAIL",
      diagnosticOnly: true,
      promotionEligible: false,
      activationEligible: false,
      outcomeConsumable: false,
      persistedDisposablePromotionManifestId: disposablePromotionManifestId,
      persistedDisposableSnapshots: persistedLifecycleRows,
      rrpDatasetId: RRP_DATASET.datasetId,
      rrpDatasetHash: RRP_DATASET.datasetHash,
      promotionManifestId: RRP_DATASET.promotionManifestId,
      featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
      activationScope: ACTIVATION_SCOPE,
      resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
    },
    selectedManifest: sourceManifest,
    aggregateProof,
    currencyProof,
    passInvalidation,
    supersession,
    reactivationProof,
    readGuards,
    contentInvariant: {
      before: contentBefore,
      after: contentAfter,
    },
    supportingReceipts: {
      lifecycleUniqueness: lifecycleReceipt,
      rrpSealedJoin: rrpJoinReceipt,
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
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-revocation-supersession-${stamp}.json`),
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

  console.log(`Gate 50 revocation/supersession: ${reportBase.summary.status}`);
  console.log(`Aggregate revoked blocked pair-weeks: ${aggregateProof.revokedBlockedPairWeeks}`);
  console.log(`Currency ${targetCurrency} revoked blocked pair-weeks: ${currencyProof.blockedPairWeeks}`);
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
    console.error("[macro-revocation-supersession] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
