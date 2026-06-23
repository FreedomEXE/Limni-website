import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getClient, getPool, query } from "../../src/lib/db";
import {
  ensureMacroRegimeWarehouseSchema,
  isMacroSnapshotStateTransitionAllowed,
  macroActiveUniquenessKey,
  macroSnapshotStateOutcomeEligible,
  validatePinnedMacroExecutionReadRequest,
  type MacroActivationScope,
  type MacroSnapshotState,
} from "../../src/lib/research/macroRegimeDataset";

loadEnvConfig(process.cwd());

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const FEATURE_BUNDLE_MANIFEST_ID = "real_rate_pressure_attribution_v1";
const ACTIVATION_SCOPE: MacroActivationScope = "historical_backtest";
const EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH =
  "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";
const RRP_DATASET = {
  datasetId: "220fd5fd-d017-4db2-bdde-524a3c664c72",
  datasetHash: "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742",
  promotionManifestId: "5f0049dc6dac1470c55309caf922996171b2250f3ee35df2be21cd84b1599def",
  contractManifestHash: "8b168a89bf2f1e812ab4f4b1d60ab9cc06af93802d37d7ed191829bee7d4ace4",
};
const SUPPORTING_RECEIPTS = {
  rawReplay:
    "app/reports/data-verification/macro-regime/gate50-raw-artifact-parser-replay-full-20260623.json",
  parentPromotion:
    "app/reports/data-verification/macro-regime/gate50-parent-promotion-proof-boundary-repaired-20260623.json",
};

type JsonRecord = Record<string, unknown>;
type AssertionStatus = "PASS" | "FAIL";
type Assertion = {
  id: string;
  category: string;
  status: AssertionStatus;
  expectation: string;
  actual: string;
  blocker: string | null;
  evidence?: unknown;
};

type DatasetRow = {
  regime_dataset_id: string;
  dataset_hash: string;
  status: string;
  snapshot_state: string;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  revoked_at_utc: string | null;
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
  settlement_deadline_utc: string | null;
  settlement_completed_at_utc: string | null;
  verified_at_utc: string | null;
  activated_at_utc: string | null;
  effective_from_utc: string | null;
  effective_to_utc: string | null;
  revoked_at_utc: string | null;
  revocation_reason: string | null;
  supersedes_snapshot_id: string | null;
  superseded_by_snapshot_id: string | null;
  row_snapshot_count: number;
  coverage: unknown;
  flags: unknown;
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
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

async function readDataset() {
  const rows = await query<DatasetRow>(
    `
      SELECT
        regime_dataset_id::text,
        dataset_hash,
        status,
        snapshot_state,
        promotion_manifest_id,
        contract_manifest_hash,
        revoked_at_utc::text
      FROM research_macro_regime_datasets
      WHERE regime_dataset_id = $1::uuid
        AND dataset_hash = $2
      LIMIT 1
    `,
    [RRP_DATASET.datasetId, RRP_DATASET.datasetHash],
  );
  return rows[0] ?? null;
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
        settlement_deadline_utc::text,
        settlement_completed_at_utc::text,
        verified_at_utc::text,
        activated_at_utc::text,
        effective_from_utc::text,
        effective_to_utc::text,
        revoked_at_utc::text,
        revocation_reason,
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

async function readActiveIndexDefinition() {
  const rows = await query<{ indexdef: string }>(
    `
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = 'idx_research_macro_weekly_snapshot_manifests_one_active'
      LIMIT 1
    `,
  );
  return rows[0]?.indexdef ?? null;
}

function stateTransitionAssertions() {
  const positive: Array<[MacroSnapshotState | null, MacroSnapshotState]> = [
    [null, "BUILDING"],
    ["BUILDING", "VALIDATED"],
    ["VALIDATED", "SEALED"],
    ["SEALED", "VERIFIED"],
    ["VERIFIED", "ACTIVE"],
    ["ACTIVE", "REVOKED"],
    ["ACTIVE", "QUARANTINED"],
  ];
  const negative: Array<[MacroSnapshotState, MacroSnapshotState]> = [
    ["SEALED", "ACTIVE"],
    ["VERIFIED", "SEALED"],
    ["REVOKED", "ACTIVE"],
    ["QUARANTINED", "ACTIVE"],
  ];

  return [
    ...positive.map(([fromState, toState]) => assertion({
      id: `transition_${fromState ?? "null"}_to_${toState}_allowed`,
      category: "state_transition",
      passed: isMacroSnapshotStateTransitionAllowed(fromState, toState),
      expectation: `${fromState ?? "null"} -> ${toState} is allowed by the lifecycle contract.`,
      actual: String(isMacroSnapshotStateTransitionAllowed(fromState, toState)),
      blocker: "valid_lifecycle_transition_rejected",
    })),
    ...negative.map(([fromState, toState]) => assertion({
      id: `transition_${fromState}_to_${toState}_rejected`,
      category: "state_transition",
      passed: !isMacroSnapshotStateTransitionAllowed(fromState, toState),
      expectation: `${fromState} -> ${toState} is rejected by the lifecycle contract.`,
      actual: String(isMacroSnapshotStateTransitionAllowed(fromState, toState)),
      blocker: "invalid_lifecycle_transition_allowed",
    })),
  ];
}

function outcomeEligibilityAssertions() {
  const states: MacroSnapshotState[] = ["SEALED", "VERIFIED", "ACTIVE", "REVOKED", "QUARANTINED"];
  return states.map((state) => assertion({
    id: `outcome_eligibility_${state.toLowerCase()}`,
    category: "outcome_eligibility",
    passed: state === "ACTIVE"
      ? macroSnapshotStateOutcomeEligible(state)
      : !macroSnapshotStateOutcomeEligible(state),
    expectation: state === "ACTIVE"
      ? "ACTIVE manifests are the only outcome-eligible lifecycle state."
      : `${state} manifests remain outcome-ineligible.`,
    actual: String(macroSnapshotStateOutcomeEligible(state)),
    blocker: state === "ACTIVE" ? "active_manifest_not_outcome_eligible" : "non_active_manifest_outcome_eligible",
  }));
}

function pinnedReadAssertions(source: ManifestRow) {
  const exact = validatePinnedMacroExecutionReadRequest({
    regimeDatasetId: RRP_DATASET.datasetId,
    promotionManifestId: source.promotion_manifest_id,
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    macroWeekId: source.macro_week_id,
    freezeVersion: source.freeze_version,
    activationScope: ACTIVATION_SCOPE,
    snapshotId: source.snapshot_id,
    snapshotHash: source.snapshot_hash,
    resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
  });
  const alias = validatePinnedMacroExecutionReadRequest({
    regimeDatasetId: RRP_DATASET.datasetId,
    promotionManifestId: source.promotion_manifest_id,
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    macroWeekId: source.macro_week_id,
    freezeVersion: source.freeze_version,
    activationScope: ACTIVATION_SCOPE,
    snapshotId: source.snapshot_id,
    snapshotHash: source.snapshot_hash,
    resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
    requestAlias: "latest active",
  });
  const latestSnapshot = validatePinnedMacroExecutionReadRequest({
    regimeDatasetId: RRP_DATASET.datasetId,
    promotionManifestId: source.promotion_manifest_id,
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    macroWeekId: source.macro_week_id,
    freezeVersion: source.freeze_version,
    activationScope: ACTIVATION_SCOPE,
    snapshotId: "latest",
    snapshotHash: source.snapshot_hash,
    resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
  });
  const missingHash = validatePinnedMacroExecutionReadRequest({
    regimeDatasetId: RRP_DATASET.datasetId,
    promotionManifestId: source.promotion_manifest_id,
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    macroWeekId: source.macro_week_id,
    freezeVersion: source.freeze_version,
    activationScope: ACTIVATION_SCOPE,
    snapshotId: source.snapshot_id,
    snapshotHash: null,
    resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
  });

  return [
    assertion({
      id: "exact_pinned_execution_read_request_accepted",
      category: "pinned_read",
      passed: exact.ok,
      expectation: "Consumers must provide exact dataset, manifest, week, freeze, scope, snapshot id/hash, and content join-map hash.",
      actual: JSON.stringify(exact),
      blocker: "exact_pinned_read_request_rejected",
    }),
    assertion({
      id: "latest_active_alias_rejected",
      category: "pinned_read",
      passed: !alias.ok && alias.blockers.includes("alias_read_request_forbidden"),
      expectation: "Alias reads such as latest active are rejected.",
      actual: JSON.stringify(alias),
      blocker: "latest_active_alias_allowed",
    }),
    assertion({
      id: "latest_snapshot_id_rejected",
      category: "pinned_read",
      passed: !latestSnapshot.ok && latestSnapshot.blockers.includes("alias_snapshot_id_forbidden"),
      expectation: "Snapshot id must be exact and cannot be latest.",
      actual: JSON.stringify(latestSnapshot),
      blocker: "latest_snapshot_alias_allowed",
    }),
    assertion({
      id: "missing_snapshot_hash_rejected",
      category: "pinned_read",
      passed: !missingHash.ok && missingHash.blockers.includes("missing_snapshot_hash"),
      expectation: "Snapshot hash is mandatory for execution reads.",
      actual: JSON.stringify(missingHash),
      blocker: "missing_snapshot_hash_allowed",
    }),
  ];
}

function candidateFromSource(source: ManifestRow, attempt: "a" | "b") {
  const activatedAtUtc = "2026-06-23T00:00:00.000Z";
  const effectiveFromUtc = `${source.macro_week_id.replace("macro_week_", "")}T00:00:00.000Z`;
  return {
    ...source,
    feature_bundle_manifest_id: FEATURE_BUNDLE_MANIFEST_ID,
    activation_scope: ACTIVATION_SCOPE,
    snapshot_id: hashPayload({
      type: "gate50_lifecycle_active_candidate_v1",
      attempt,
      sourceSnapshotId: source.snapshot_id,
      activationScope: ACTIVATION_SCOPE,
      featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    }),
    snapshot_state: "ACTIVE",
    activated_at_utc: activatedAtUtc,
    effective_from_utc: effectiveFromUtc,
    verified_at_utc: activatedAtUtc,
    revoked_at_utc: null,
    revocation_reason: null,
  };
}

async function insertActiveCandidate(client: Awaited<ReturnType<typeof getClient>>, candidate: ManifestRow) {
  await client.query(
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
        settlement_deadline_utc,
        settlement_completed_at_utc,
        verified_at_utc,
        activated_at_utc,
        effective_from_utc,
        effective_to_utc,
        revoked_at_utc,
        revocation_reason,
        supersedes_snapshot_id,
        superseded_by_snapshot_id,
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
        $11::timestamptz,
        $12::timestamptz,
        $13::timestamptz,
        $14::timestamptz,
        $15::timestamptz,
        $16::timestamptz,
        $17::timestamptz,
        $18::timestamptz,
        $19,
        $20,
        $21,
        $22,
        $23::jsonb,
        $24::jsonb
      )
    `,
    [
      RRP_DATASET.datasetId,
      candidate.promotion_manifest_id,
      candidate.feature_bundle_manifest_id,
      candidate.activation_scope,
      candidate.contract_manifest_hash,
      candidate.macro_week_id,
      candidate.freeze_version,
      candidate.snapshot_id,
      candidate.snapshot_hash,
      candidate.snapshot_state,
      candidate.sealed_at_utc,
      candidate.settlement_deadline_utc,
      candidate.settlement_completed_at_utc,
      candidate.verified_at_utc,
      candidate.activated_at_utc,
      candidate.effective_from_utc,
      candidate.effective_to_utc,
      candidate.revoked_at_utc,
      candidate.revocation_reason,
      candidate.supersedes_snapshot_id,
      candidate.superseded_by_snapshot_id,
      candidate.row_snapshot_count,
      JSON.stringify(candidate.coverage ?? {}),
      JSON.stringify(candidate.flags ?? {}),
    ],
  );
}

async function activeCountForKey(source: ManifestRow) {
  const rows = await query<{ rows: string | number }>(
    `
      SELECT COUNT(*) AS rows
      FROM research_macro_weekly_snapshot_manifests
      WHERE promotion_manifest_id = $1
        AND feature_bundle_manifest_id = $2
        AND macro_week_id = $3
        AND freeze_version = $4
        AND activation_scope = $5
        AND snapshot_state = 'ACTIVE'
    `,
    [
      source.promotion_manifest_id,
      FEATURE_BUNDLE_MANIFEST_ID,
      source.macro_week_id,
      source.freeze_version,
      ACTIVATION_SCOPE,
    ],
  );
  return Number(rows[0]?.rows ?? 0);
}

async function candidatePersistedCount(candidates: ManifestRow[]) {
  const rows = await query<{ rows: string | number }>(
    `
      SELECT COUNT(*) AS rows
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
        AND snapshot_id = ANY($2::text[])
    `,
    [RRP_DATASET.datasetId, candidates.map((candidate) => candidate.snapshot_id)],
  );
  return Number(rows[0]?.rows ?? 0);
}

async function deleteCandidateRows(candidates: ManifestRow[]) {
  const rows = await query<{ snapshot_id: string }>(
    `
      DELETE FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
        AND snapshot_id = ANY($2::text[])
      RETURNING snapshot_id
    `,
    [RRP_DATASET.datasetId, candidates.map((candidate) => candidate.snapshot_id)],
  );
  return rows.length;
}

async function runDuplicateActivationAttempt(source: ManifestRow) {
  const first = candidateFromSource(source, "a");
  const second = candidateFromSource(source, "b");
  const key = macroActiveUniquenessKey({
    promotionManifestId: source.promotion_manifest_id,
    featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
    macroWeekId: source.macro_week_id,
    freezeVersion: source.freeze_version,
    activationScope: ACTIVATION_SCOPE,
  });
  const beforeCount = await activeCountForKey(source);
  const contentInvariant = {
    sourceSnapshotHash: source.snapshot_hash,
    firstSnapshotHash: first.snapshot_hash,
    secondSnapshotHash: second.snapshot_hash,
    rowSnapshotCount: source.row_snapshot_count,
  };

  const clientOne = await getClient();
  const clientTwo = await getClient();
  let firstInsert = false;
  let firstCommitted = false;
  let secondInsert = false;
  let secondCommitted = false;
  let secondErrorCode: string | null = null;
  let afterFirstCommitCount = 0;
  let clientOneFinished = false;
  let clientTwoFinished = false;
  try {
    await clientOne.query("BEGIN");
    await clientTwo.query("BEGIN");
    await clientTwo.query("SET LOCAL statement_timeout = '10000ms'");

    await insertActiveCandidate(clientOne, first);
    firstInsert = true;

    const secondAttempt = insertActiveCandidate(clientTwo, second)
      .then(() => ({ inserted: true, errorCode: null as string | null }))
      .catch((error) => ({
        inserted: false,
        errorCode: (asRecord(error).code as string | undefined) ?? null,
      }));

    await sleep(150);
    await clientOne.query("COMMIT");
    clientOneFinished = true;
    firstCommitted = true;

    const secondResult = await secondAttempt;
    secondInsert = secondResult.inserted;
    secondErrorCode = secondResult.errorCode;
    if (secondInsert) {
      await clientTwo.query("ROLLBACK");
      clientTwoFinished = true;
    } else {
      await clientTwo.query("ROLLBACK");
      clientTwoFinished = true;
    }
    secondCommitted = false;
    afterFirstCommitCount = await activeCountForKey(source);
  } finally {
    if (!clientTwoFinished) {
      await clientTwo.query("ROLLBACK").catch(() => undefined);
    }
    if (!clientOneFinished) {
      await clientOne.query("ROLLBACK").catch(() => undefined);
    }
    clientTwo.release();
    clientOne.release();
  }

  const cleanupDeletedRows = await deleteCandidateRows([first, second]);
  const afterCount = await activeCountForKey(source);
  const candidateRowsPersisted = await candidatePersistedCount([first, second]);
  return {
    key,
    firstCandidateSnapshotId: first.snapshot_id,
    secondCandidateSnapshotId: second.snapshot_id,
    beforeCount,
    firstInsert,
    firstCommitted,
    secondInsert,
    secondCommitted,
    secondErrorCode,
    secondAttemptRejected: !secondInsert && secondErrorCode === "23505",
    afterFirstCommitCount,
    cleanupDeletedRows,
    afterCount,
    candidateRowsPersisted,
    contentInvariant,
  };
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const blockers = Object.entries(asRecord(report.blockers))
    .map(([key, value]) => `| ${key} | ${value} |`);
  return [
    "# Gate 50 Lifecycle Uniqueness Proof Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Valid transition proof: ${summary.validTransitionProof}`,
    `- DB ACTIVE uniqueness proof: ${summary.databaseActiveUniquenessProof}`,
    `- App guard proof: ${summary.applicationGuardProof}`,
    `- Duplicate activation attempts: ${summary.concurrentDuplicateActivationProof}`,
    `- Transient disposable ACTIVE committed: ${summary.transientDisposableActiveCommitted}`,
    `- Duplicate rejected by DB code: ${summary.duplicateRejectedByDatabaseCode}`,
    `- Disposable ACTIVE rows cleaned up: ${summary.disposableActiveRowsCleanedUp}`,
    `- Activation persisted: ${summary.activationPersisted}`,
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
    "This proof validates lifecycle controls only. It does not perform historical activation, compute P&L, make a strategy decision, or open outcome consumption.",
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for lifecycle uniqueness proof.");
  }
  const generatedAtUtc = DateTime.utc().toISO({ suppressMilliseconds: false }) ?? new Date().toISOString();
  await ensureMacroRegimeWarehouseSchema();

  const [rawReplayReceipt, parentPromotionReceipt] = await Promise.all([
    readJsonReceipt(SUPPORTING_RECEIPTS.rawReplay),
    readJsonReceipt(SUPPORTING_RECEIPTS.parentPromotion),
  ]);
  const dataset = await readDataset();
  const manifests = await readManifestInventory();
  const sourceManifest = manifests.find((row) =>
    row.promotion_manifest_id === RRP_DATASET.promotionManifestId
    && row.contract_manifest_hash === RRP_DATASET.contractManifestHash
    && row.snapshot_state === "SEALED"
    && row.revoked_at_utc === null) ?? null;
  if (!sourceManifest) {
    throw new Error("No SEALED RRP source manifest found for lifecycle uniqueness proof.");
  }

  const weeklyContentBefore = await readWeeklyContentHash();
  const aggregateContentBefore = await readAggregateContentHash();
  const activeIndexDefinition = await readActiveIndexDefinition();
  const duplicateAttempt = await runDuplicateActivationAttempt(sourceManifest);
  const weeklyContentAfter = await readWeeklyContentHash();
  const aggregateContentAfter = await readAggregateContentHash();

  const transitionAssertions = stateTransitionAssertions();
  const eligibilityAssertions = outcomeEligibilityAssertions();
  const readAssertions = pinnedReadAssertions(sourceManifest);
  const manifestCounts = {
    total: manifests.length,
    sealed: manifests.filter((row) => row.snapshot_state === "SEALED").length,
    verified: manifests.filter((row) => row.snapshot_state === "VERIFIED").length,
    active: manifests.filter((row) => row.snapshot_state === "ACTIVE").length,
    revoked: manifests.filter((row) => row.revoked_at_utc !== null || row.snapshot_state === "REVOKED").length,
  };
  const rawReplaySummary = asRecord(rawReplayReceipt.json.summary);
  const parentPromotionSummary = asRecord(parentPromotionReceipt.json.summary);
  const schemaAssertions = [
    assertion({
      id: "active_unique_index_exists",
      category: "database_uniqueness",
      passed: typeof activeIndexDefinition === "string" && activeIndexDefinition.includes("snapshot_state = 'ACTIVE'"),
      expectation: "The warehouse has a partial unique index for ACTIVE weekly manifests.",
      actual: activeIndexDefinition ?? "null",
      blocker: "active_unique_index_missing",
    }),
    assertion({
      id: "active_unique_index_includes_feature_bundle",
      category: "database_uniqueness",
      passed: typeof activeIndexDefinition === "string" && activeIndexDefinition.includes("feature_bundle_manifest_id"),
      expectation: "The ACTIVE unique index scopes by feature_bundle_manifest_id.",
      actual: activeIndexDefinition ?? "null",
      blocker: "active_unique_index_missing_feature_bundle_scope",
    }),
    assertion({
      id: "active_unique_index_includes_activation_scope",
      category: "database_uniqueness",
      passed: typeof activeIndexDefinition === "string" && activeIndexDefinition.includes("activation_scope"),
      expectation: "The ACTIVE unique index scopes by activation_scope.",
      actual: activeIndexDefinition ?? "null",
      blocker: "active_unique_index_missing_activation_scope",
    }),
  ];
  const duplicateAssertions = [
    assertion({
      id: "duplicate_active_attempt_exactly_one_success",
      category: "database_uniqueness",
      passed: duplicateAttempt.firstInsert
        && duplicateAttempt.firstCommitted
        && !duplicateAttempt.secondInsert
        && !duplicateAttempt.secondCommitted
        && duplicateAttempt.secondAttemptRejected
        && duplicateAttempt.secondErrorCode === "23505"
        && duplicateAttempt.afterFirstCommitCount === duplicateAttempt.beforeCount + 1,
      expectation: "Two duplicate ACTIVE attempts for the same lifecycle key produce one committed ACTIVE row and one database unique-constraint rejection.",
      actual: JSON.stringify(duplicateAttempt),
      blocker: "duplicate_active_attempt_not_rejected",
    }),
    assertion({
      id: "duplicate_active_attempt_disposable_candidate_cleaned_up",
      category: "append_only",
      passed: duplicateAttempt.afterCount === duplicateAttempt.beforeCount
        && duplicateAttempt.cleanupDeletedRows === 1
        && duplicateAttempt.candidateRowsPersisted === 0,
      expectation: "The committed disposable ACTIVE candidate is deleted after proof and leaves no ACTIVE candidate rows persisted.",
      actual: JSON.stringify({
        beforeCount: duplicateAttempt.beforeCount,
        afterFirstCommitCount: duplicateAttempt.afterFirstCommitCount,
        cleanupDeletedRows: duplicateAttempt.cleanupDeletedRows,
        afterCount: duplicateAttempt.afterCount,
        candidateRowsPersisted: duplicateAttempt.candidateRowsPersisted,
      }),
      blocker: "lifecycle_proof_persisted_active_candidate",
    }),
    assertion({
      id: "activation_candidate_preserves_snapshot_content_hash",
      category: "content_invariant",
      passed: duplicateAttempt.contentInvariant.sourceSnapshotHash === duplicateAttempt.contentInvariant.firstSnapshotHash
        && duplicateAttempt.contentInvariant.sourceSnapshotHash === duplicateAttempt.contentInvariant.secondSnapshotHash,
      expectation: "Activation candidates reuse the existing aggregate snapshot content hash.",
      actual: JSON.stringify(duplicateAttempt.contentInvariant),
      blocker: "activation_changed_snapshot_content_hash",
    }),
  ];
  const contentAssertions = [
    assertion({
      id: "weekly_currency_content_hash_unchanged_after_lifecycle_proof",
      category: "content_invariant",
      passed: weeklyContentBefore.hash === weeklyContentAfter.hash
        && weeklyContentBefore.rows === weeklyContentAfter.rows,
      expectation: "The disposable committed-write lifecycle proof does not alter weekly currency source content.",
      actual: JSON.stringify({ before: weeklyContentBefore, after: weeklyContentAfter }),
      blocker: "weekly_currency_content_changed",
    }),
    assertion({
      id: "aggregate_manifest_content_hash_unchanged_after_lifecycle_proof",
      category: "content_invariant",
      passed: aggregateContentBefore.hash === aggregateContentAfter.hash
        && aggregateContentBefore.rows === aggregateContentAfter.rows,
      expectation: "The disposable committed-write lifecycle proof does not alter aggregate manifest content.",
      actual: JSON.stringify({ before: aggregateContentBefore, after: aggregateContentAfter }),
      blocker: "aggregate_manifest_content_changed",
    }),
    assertion({
      id: "resolved_content_join_map_hash_retained",
      category: "content_invariant",
      passed: rawReplaySummary.resolvedContentJoinMapHash === EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
      expectation: "Lifecycle proof preserves the repaired source content join-map identity.",
      actual: String(rawReplaySummary.resolvedContentJoinMapHash ?? "null"),
      blocker: "resolved_content_join_map_hash_mismatch",
    }),
  ];
  const prerequisiteAssertions = [
    assertion({
      id: "rrp_dataset_found_and_sealed",
      category: "prerequisite",
      passed: dataset?.status === "complete"
        && dataset.snapshot_state === "SEALED"
        && dataset.revoked_at_utc === null,
      expectation: "Lifecycle proof starts from the current complete SEALED RRP dataset.",
      actual: JSON.stringify(dataset),
      blocker: "rrp_dataset_not_current_sealed",
    }),
    assertion({
      id: "no_preexisting_active_manifests",
      category: "prerequisite",
      passed: manifestCounts.active === 0,
      expectation: "Historical activation has not started before lifecycle uniqueness proof.",
      actual: JSON.stringify(manifestCounts),
      blocker: "preexisting_active_manifest_found",
    }),
    assertion({
      id: "raw_parser_replay_passed",
      category: "prerequisite",
      passed: rawReplaySummary.status === "PASS_RAW_ARTIFACT_PARSER_REPLAY",
      expectation: "Raw-artifact parser replay must pass before lifecycle activation controls.",
      actual: JSON.stringify(rawReplaySummary),
      blocker: "raw_parser_replay_not_passed",
    }),
    assertion({
      id: "parent_promotion_proof_passed_not_active",
      category: "prerequisite",
      passed: parentPromotionSummary.status === "PASS_PARENT_APPROVED_NOT_ACTIVE",
      expectation: "Parent promotion proof must pass without opening ACTIVE lifecycle state.",
      actual: JSON.stringify(parentPromotionSummary),
      blocker: "parent_promotion_proof_not_passed",
    }),
  ];

  const assertions = [
    ...prerequisiteAssertions,
    ...schemaAssertions,
    ...transitionAssertions,
    ...eligibilityAssertions,
    ...readAssertions,
    ...duplicateAssertions,
    ...contentAssertions,
  ];
  const blockers = blockerCounts(assertions);
  const pass = Object.keys(blockers).length === 0;
  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose:
      "Lifecycle uniqueness proof for current repaired RRP source bundle. Uses disposable committed ACTIVE duplicate attempts with cleanup; does not persist activation or open outcomes.",
    summary: {
      status: pass ? "PASS_LIFECYCLE_UNIQUENESS" : "FAIL_LIFECYCLE_UNIQUENESS",
      validTransitionProof: transitionAssertions.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
      databaseActiveUniquenessProof: schemaAssertions.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
      applicationGuardProof: [...eligibilityAssertions, ...readAssertions].every((item) => item.status === "PASS")
        ? "PASS"
        : "FAIL",
      concurrentDuplicateActivationProof: duplicateAssertions.every((item) => item.status === "PASS")
        ? "PASS"
        : "FAIL",
      appendOnlyProof: duplicateAssertions.concat(contentAssertions).every((item) => item.status === "PASS")
        ? "PASS"
        : "FAIL",
      transientDisposableActiveCommitted: duplicateAttempt.firstCommitted,
      duplicateRejectedByDatabaseCode: duplicateAttempt.secondErrorCode,
      disposableActiveRowsCleanedUp: duplicateAttempt.cleanupDeletedRows === 1
        && duplicateAttempt.candidateRowsPersisted === 0,
      activationPersisted: duplicateAttempt.candidateRowsPersisted > 0,
      historicalActivationCreated: false,
      diagnosticOnly: true,
      promotionEligible: false,
      outcomeConsumable: false,
      featureBundleManifestId: FEATURE_BUNDLE_MANIFEST_ID,
      activationScope: ACTIVATION_SCOPE,
      rrpDatasetId: RRP_DATASET.datasetId,
      rrpDatasetHash: RRP_DATASET.datasetHash,
      promotionManifestId: RRP_DATASET.promotionManifestId,
      contractManifestHash: RRP_DATASET.contractManifestHash,
      resolvedContentJoinMapHash: EXPECTED_RESOLVED_CONTENT_JOIN_MAP_HASH,
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
    },
    dataset,
    manifestCounts,
    activeUniquenessKey: duplicateAttempt.key,
    database: {
      activeUniqueIndexDefinition: activeIndexDefinition,
      duplicateAttempt,
    },
    contentInvariants: {
      weeklyContentBefore,
      weeklyContentAfter,
      aggregateContentBefore,
      aggregateContentAfter,
    },
    supportingReceipts: {
      rawReplay: rawReplayReceipt,
      parentPromotion: parentPromotionReceipt,
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
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-lifecycle-uniqueness-${stamp}.json`),
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

  console.log(`Gate 50 lifecycle uniqueness: ${reportBase.summary.status}`);
  console.log(`Duplicate ACTIVE proof: ${reportBase.summary.concurrentDuplicateActivationProof}`);
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
    console.error("[macro-lifecycle-uniqueness] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
