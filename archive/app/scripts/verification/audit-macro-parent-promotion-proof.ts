import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getPool, query } from "../../src/lib/db";

loadEnvConfig(process.cwd());

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";

const RATE_PARENT = {
  role: "rate",
  datasetId: "dcdc850a-80a2-4178-8d08-dd759be6afb8",
  datasetHash: "3db4b84238dbf5c656a9ebaf2ff73219cc1efd2a6e1ff70842983945c4d23612",
  familyManifestId: "rate_3m_market_family_v1",
  familyManifestHash: "5e75faaadd2d7e19bdf6591df782b772fe10c7b8268713c0f892984867c421b2",
  promotionManifestId: "12f04bd4bec599e37fdfdf926d0d39bd73902319654993baa71ce879bb8eecb5",
  contractManifestHash: "92f93545c05b067bc204678e17283607207d59d212783eb913292ac5eef52556",
  expectedSourceFamily: "rate",
  expectedInstrument: "oecd_3m_interbank_rate",
  expectedWeeklyRows: 2_976,
};

const CPI_PARENT = {
  role: "cpi",
  datasetId: "37b4081b-880e-4ae6-8d53-20ba900dff07",
  datasetHash: "0817b0ec5b4c03c2d01ddc5c014601a2b7028c78203d07f95b3393235c70cc17",
  familyManifestId: "cpi_all_items_family_v1",
  familyManifestHash: "b0e7f90e8abd7295e9886dec1c384b4ecc048c40eb3fce2feb52cebb58332beb",
  promotionManifestId: "b0b4f8e1c42139791447e4c7413e48f20de1e738fcd5d051ed06acf57f4c286c",
  contractManifestHash: "1a0e94ec8229b4ce169a95b8c4e3a4c0a401f87cb3502f269b312376bc0bf440",
  expectedSourceFamily: "inflation",
  expectedInstrument: "cpi_all_items_yoy",
  expectedWeeklyRows: 2_976,
};

const RRP_DATASET = {
  datasetId: "220fd5fd-d017-4db2-bdde-524a3c664c72",
  datasetHash: "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742",
  promotionManifestId: "5f0049dc6dac1470c55309caf922996171b2250f3ee35df2be21cd84b1599def",
  contractManifestHash: "8b168a89bf2f1e812ab4f4b1d60ab9cc06af93802d37d7ed191829bee7d4ace4",
  resolvedContentJoinMapHash: "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391",
};

const SUPPORTING_RECEIPTS = {
  rateReconciliation:
    "app/reports/data-verification/macro-regime/gate50-rate-alfred-differential-reconstruction-20260622.json",
  rateWrite:
    "app/reports/data-verification/macro-regime/gate50-rate-date-only-strict-write-20260623.json",
  rateJoin:
    "app/reports/data-verification/macro-regime/gate50-rate-date-only-strict-join-coverage-20260623.json",
  cpiEndpoint:
    "app/reports/data-verification/macro-regime/gate50-official-cpi-endpoint-feasibility-20260622.json",
  cpiWrite:
    "app/reports/data-verification/macro-regime/gate50-official-cpi-aud-monthly-transition-write-20260623.json",
  cpiJoin:
    "app/reports/data-verification/macro-regime/gate50-official-cpi-aud-monthly-transition-join-coverage-20260623.json",
  rrpWrite:
    "app/reports/data-verification/macro-regime/gate50-rrp-boundary-repaired-write-20260623.json",
  rrpJoin:
    "app/reports/data-verification/macro-regime/gate50-rrp-boundary-repaired-sealed-join-20260623.json",
  boundaryRepair:
    "app/reports/data-verification/macro-regime/gate50-boundary-proof-boundary-repaired-20260623.json",
  warehouseRebuild:
    "app/reports/data-verification/macro-regime/gate50-warehouse-canonical-rebuild-proof-boundary-repaired-20260623.json",
};

type JsonRecord = Record<string, unknown>;

type DatasetRow = {
  regime_dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  status: string;
  snapshot_state: string;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  calendar_version: string | null;
  selector_version: string | null;
  validation_contract_version: string | null;
  build_version: string | null;
  revoked_at_utc: string | null;
};

type CountRow = {
  rows: string | number;
  available_rows: string | number;
  missing_rows: string | number;
  stale_rows: string | number;
  currencies: string | number;
  source_families: unknown;
  instruments: unknown;
};

type ManifestCountRow = {
  manifests: string | number;
  sealed_manifests: string | number;
  active_manifests: string | number;
  revoked_manifests: string | number;
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

function stableReceiptContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableReceiptContent);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .filter(([key]) => key !== "generatedAtUtc" && key !== "files")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, inner]) => [key, stableReceiptContent(inner)]),
    );
  }
  return value;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

async function readJsonReceipt(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const text = await readFile(absolutePath, "utf8");
  const json = JSON.parse(text) as JsonRecord;
  const summary = asRecord(json.summary);
  const stableReceiptHash =
    typeof json.stableReceiptHash === "string" ? json.stableReceiptHash :
    typeof summary.stableReceiptHash === "string" ? summary.stableReceiptHash :
    typeof json.receiptHash === "string" ? json.receiptHash :
    typeof summary.receiptHash === "string" ? summary.receiptHash :
    hashPayload(stableReceiptContent(json));
  return {
    path: relativePath.replaceAll("\\", "/"),
    sha256: sha256Text(text),
    stableReceiptHash,
    canonicalContentHash: hashPayload(stableReceiptContent(json)),
    json,
  };
}

async function readDataset(datasetId: string, datasetHash: string) {
  const rows = await query<DatasetRow>(
    `
      SELECT
        regime_dataset_id::text,
        dataset_hash,
        dataset_version,
        status,
        snapshot_state,
        promotion_manifest_id,
        contract_manifest_hash,
        calendar_version,
        selector_version,
        validation_contract_version,
        build_version,
        revoked_at_utc::text
      FROM research_macro_regime_datasets
      WHERE regime_dataset_id = $1::uuid
        AND dataset_hash = $2
      LIMIT 1
    `,
    [datasetId, datasetHash],
  );
  return rows[0] ?? null;
}

async function readWeeklyCounts(datasetId: string) {
  const rows = await query<CountRow>(
    `
      SELECT
        COUNT(*) AS rows,
        COUNT(*) FILTER (WHERE coverage->>'valueAvailable' = 'true') AS available_rows,
        COUNT(*) FILTER (WHERE coverage->>'valueAvailable' IS DISTINCT FROM 'true') AS missing_rows,
        COUNT(*) FILTER (WHERE coverage->>'isStale' = 'true') AS stale_rows,
        COUNT(DISTINCT currency) AS currencies,
        jsonb_agg(DISTINCT source_family) AS source_families,
        jsonb_agg(DISTINCT instrument) AS instruments
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
    `,
    [datasetId],
  );
  const row = rows[0];
  return {
    rows: numberValue(row?.rows),
    availableRows: numberValue(row?.available_rows),
    missingRows: numberValue(row?.missing_rows),
    staleRows: numberValue(row?.stale_rows),
    currencies: numberValue(row?.currencies),
    sourceFamilies: asStringArray(row?.source_families).sort(),
    instruments: asStringArray(row?.instruments).sort(),
  };
}

async function readManifestCounts(datasetId: string) {
  const rows = await query<ManifestCountRow>(
    `
      SELECT
        COUNT(*) AS manifests,
        COUNT(*) FILTER (WHERE snapshot_state = 'SEALED') AS sealed_manifests,
        COUNT(*) FILTER (WHERE snapshot_state = 'ACTIVE') AS active_manifests,
        COUNT(*) FILTER (WHERE revoked_at_utc IS NOT NULL OR snapshot_state IN ('REVOKED', 'QUARANTINED')) AS revoked_manifests
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
    `,
    [datasetId],
  );
  const row = rows[0];
  return {
    manifests: numberValue(row?.manifests),
    sealedManifests: numberValue(row?.sealed_manifests),
    activeManifests: numberValue(row?.active_manifests),
    revokedManifests: numberValue(row?.revoked_manifests),
  };
}

async function readContentHash(datasetId: string, table: "observations" | "weeklySnapshots" | "weeklyManifests") {
  if (table === "observations") {
    const rows = await query(
      `
        SELECT
          source_family,
          source_id,
          currency,
          instrument,
          source_observation_id,
          observation_date::text,
          effective_at_utc::text,
          available_at_utc::text,
          source_hash,
          raw_value_json,
          normalized_value_json,
          coverage,
          flags
        FROM research_macro_source_observations
        WHERE regime_dataset_id = $1::uuid
        ORDER BY source_family, source_id, currency, instrument, observation_date, source_observation_id
      `,
      [datasetId],
    );
    return hashPayload(rows);
  }
  if (table === "weeklySnapshots") {
    const rows = await query(
      `
        SELECT
          week_open_utc::text,
          source_family,
          source_id,
          currency,
          instrument,
          source_observation_date::text,
          effective_at_utc::text,
          available_at_utc::text,
          snapshot_hash,
          raw_value_json,
          normalized_value_json,
          coverage,
          flags
        FROM research_macro_weekly_currency_snapshots
        WHERE regime_dataset_id = $1::uuid
        ORDER BY week_open_utc, source_family, source_id, currency, instrument
      `,
      [datasetId],
    );
    return hashPayload(rows);
  }
  const rows = await query(
    `
      SELECT
        macro_week_id,
        freeze_version,
        snapshot_hash,
        row_snapshot_count,
        coverage,
        flags
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
      ORDER BY macro_week_id, freeze_version, snapshot_hash
    `,
    [datasetId],
  );
  return hashPayload(rows);
}

function joinReceiptPass(receipt: JsonRecord, expectedFeatureBundleId: string) {
  const summary = asRecord(receipt.summary);
  return summary.joinReceiptStatus === "PASS_DIAGNOSTIC" &&
    summary.diagnosticOnly === true &&
    summary.promotionEligible === false &&
    summary.featureBundleManifestId === expectedFeatureBundleId &&
    summary.joinablePairWeeks === 10_416 &&
    summary.blockedPairWeeks === 0;
}

function buildSupportingReceiptHashes(receipts: Record<string, Awaited<ReturnType<typeof readJsonReceipt>>>) {
  return Object.fromEntries(
    Object.entries(receipts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, receipt]) => [key, {
        path: receipt.path,
        stableReceiptHash: receipt.stableReceiptHash,
        canonicalContentHash: receipt.canonicalContentHash,
      }]),
  );
}

function buildSupportingReceiptFileHashes(receipts: Record<string, Awaited<ReturnType<typeof readJsonReceipt>>>) {
  return Object.fromEntries(
    Object.entries(receipts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, receipt]) => [key, {
        path: receipt.path,
        rawFileSha256: receipt.sha256,
      }]),
  );
}

function receiptProofHash(receipt: Awaited<ReturnType<typeof readJsonReceipt>>) {
  return receipt.stableReceiptHash;
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const manifest = asRecord(report.rootRrpPromotionManifest);
  const blockers = Object.entries(asRecord(report.blockers))
    .map(([key, value]) => `| ${key} | ${value} |`);
  return [
    "# Gate 50 Parent Promotion Proof Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Parent approved: ${summary.parentPromotionApproved === true}`,
    `- Activation eligible: ${summary.activationEligible === true}`,
    `- Outcome consumable: ${summary.outcomeConsumable === true}`,
    `- Root RRP promotion manifest id: ${manifest.rootRrpPromotionManifestId}`,
    `- Root RRP promotion manifest hash: ${manifest.rootRrpPromotionManifestHash}`,
    `- Resolved content join-map hash: ${summary.resolvedContentJoinMapHash}`,
    "",
    "## Blockers",
    "",
    "| Blocker | Count |",
    "|---|---:|",
    ...(blockers.length > 0 ? blockers : ["| - | 0 |"]),
    "",
    "This receipt approves immutable rate and CPI parents for RRP control proof only. It does not mutate diagnostic manifests, activate snapshots, compute P&L, or make macro outcome decisions.",
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for parent promotion proof.");
  }

  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const receiptEntries = await Promise.all(
    Object.entries(SUPPORTING_RECEIPTS).map(async ([key, relativePath]) => [key, await readJsonReceipt(relativePath)] as const),
  );
  const receipts = Object.fromEntries(receiptEntries);
  const rateDataset = await readDataset(RATE_PARENT.datasetId, RATE_PARENT.datasetHash);
  const cpiDataset = await readDataset(CPI_PARENT.datasetId, CPI_PARENT.datasetHash);
  const rrpDataset = await readDataset(RRP_DATASET.datasetId, RRP_DATASET.datasetHash);

  const rateWeekly = await readWeeklyCounts(RATE_PARENT.datasetId);
  const cpiWeekly = await readWeeklyCounts(CPI_PARENT.datasetId);
  const rrpWeekly = await readWeeklyCounts(RRP_DATASET.datasetId);
  const rateManifests = await readManifestCounts(RATE_PARENT.datasetId);
  const cpiManifests = await readManifestCounts(CPI_PARENT.datasetId);
  const rrpManifests = await readManifestCounts(RRP_DATASET.datasetId);
  const rateObservationContentHash = await readContentHash(RATE_PARENT.datasetId, "observations");
  const cpiObservationContentHash = await readContentHash(CPI_PARENT.datasetId, "observations");
  const rateWeeklySnapshotContentHash = await readContentHash(RATE_PARENT.datasetId, "weeklySnapshots");
  const cpiWeeklySnapshotContentHash = await readContentHash(CPI_PARENT.datasetId, "weeklySnapshots");
  const rrpWeeklySnapshotContentHash = await readContentHash(RRP_DATASET.datasetId, "weeklySnapshots");
  const rrpWeeklyManifestContentHash = await readContentHash(RRP_DATASET.datasetId, "weeklyManifests");

  const rateReconciliationSummary = asRecord(receipts.rateReconciliation.json.summary);
  const rateClassificationCounts = asRecord(rateReconciliationSummary.classificationCounts);
  const cpiEndpointSummary = asRecord(receipts.cpiEndpoint.json.summary);
  const rrpJoinSummary = asRecord(receipts.rrpJoin.json.summary);
  const boundaryRepairSummary = asRecord(receipts.boundaryRepair.json.summary);
  const repairReceipts = asRecord(receipts.boundaryRepair.json.repairReceipts);
  const alfredDateOnlyRepairSummary = asRecord(asRecord(repairReceipts.alfredDateOnlyRepair).summary);
  const audMonthlyTransitionRepairSummary = asRecord(asRecord(repairReceipts.audMonthlyTransitionRepair).summary);
  const rebuiltRrpReceiptSummary = asRecord(asRecord(repairReceipts.rebuiltRrpReceipt).summary);
  const warehouseRebuildSummary = asRecord(receipts.warehouseRebuild.json.summary);

  const rateBlockers = [
    !rateDataset ? "rate_dataset_not_found" : null,
    rateDataset && rateDataset.status !== "complete" ? "rate_dataset_not_complete" : null,
    rateDataset && rateDataset.snapshot_state !== "SEALED" ? "rate_dataset_not_sealed" : null,
    rateDataset && rateDataset.revoked_at_utc !== null ? "rate_dataset_revoked" : null,
    rateDataset && rateDataset.promotion_manifest_id !== RATE_PARENT.promotionManifestId ? "rate_promotion_manifest_mismatch" : null,
    rateDataset && rateDataset.contract_manifest_hash !== RATE_PARENT.contractManifestHash ? "rate_contract_manifest_mismatch" : null,
    rateWeekly.rows !== RATE_PARENT.expectedWeeklyRows ? "rate_weekly_row_count_mismatch" : null,
    rateWeekly.missingRows !== 0 ? "rate_weekly_missing_rows" : null,
    rateWeekly.staleRows !== 0 ? "rate_weekly_stale_rows" : null,
    rateWeekly.currencies !== 8 ? "rate_currency_count_mismatch" : null,
    !rateWeekly.sourceFamilies.includes(RATE_PARENT.expectedSourceFamily) ? "rate_source_family_missing" : null,
    !rateWeekly.instruments.includes(RATE_PARENT.expectedInstrument) ? "rate_instrument_missing" : null,
    rateManifests.manifests !== 372 ? "rate_manifest_count_mismatch" : null,
    rateManifests.revokedManifests !== 0 ? "rate_manifest_revoked" : null,
    !joinReceiptPass(receipts.rateJoin.json, "rate_attribution_v1") ? "rate_join_receipt_not_pass_diagnostic" : null,
    boundaryRepairSummary.status !== "PASS_BOUNDARY_PROOF" ? "boundary_repair_receipt_not_pass" : null,
    alfredDateOnlyRepairSummary.status !== "PASS" ? "alfred_date_only_repair_not_pass" : null,
    alfredDateOnlyRepairSummary.originalAnomalyRows !== 31 ? "alfred_date_only_original_row_count_mismatch" : null,
    alfredDateOnlyRepairSummary.sameFreezeDateOnlySelectionsAfterRepair !== 0 ? "alfred_same_freeze_date_only_selection_remaining" : null,
    alfredDateOnlyRepairSummary.firstLaterFreezeAdmissions !== 31 ? "alfred_first_later_freeze_admission_count_mismatch" : null,
    alfredDateOnlyRepairSummary.unresolvedMissing !== 0 ? "alfred_repair_unresolved_missing" : null,
    alfredDateOnlyRepairSummary.unjustifiedStale !== 0 ? "alfred_repair_unjustified_stale" : null,
    warehouseRebuildSummary.warehouseCanonicalRebuildStatus !== "PASS" ? "warehouse_canonical_rebuild_not_pass" : null,
    rateClassificationCounts.wrong_vintage !== 0 ? "rate_wrong_vintage_rows" : null,
    rateClassificationCounts.reconstruction_defect !== 0 ? "rate_reconstruction_defects" : null,
    rateClassificationCounts.genuine_missing_observation !== 0 ? "rate_genuine_missing_observations" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  const cpiBlockers = [
    !cpiDataset ? "cpi_dataset_not_found" : null,
    cpiDataset && cpiDataset.status !== "complete" ? "cpi_dataset_not_complete" : null,
    cpiDataset && cpiDataset.snapshot_state !== "SEALED" ? "cpi_dataset_not_sealed" : null,
    cpiDataset && cpiDataset.revoked_at_utc !== null ? "cpi_dataset_revoked" : null,
    cpiDataset && cpiDataset.promotion_manifest_id !== CPI_PARENT.promotionManifestId ? "cpi_promotion_manifest_mismatch" : null,
    cpiDataset && cpiDataset.contract_manifest_hash !== CPI_PARENT.contractManifestHash ? "cpi_contract_manifest_mismatch" : null,
    cpiWeekly.rows !== CPI_PARENT.expectedWeeklyRows ? "cpi_weekly_row_count_mismatch" : null,
    cpiWeekly.missingRows !== 0 ? "cpi_weekly_missing_rows" : null,
    cpiWeekly.staleRows !== 0 ? "cpi_weekly_stale_rows" : null,
    cpiWeekly.currencies !== 8 ? "cpi_currency_count_mismatch" : null,
    !cpiWeekly.sourceFamilies.includes(CPI_PARENT.expectedSourceFamily) ? "cpi_source_family_missing" : null,
    !cpiWeekly.instruments.includes(CPI_PARENT.expectedInstrument) ? "cpi_instrument_missing" : null,
    cpiManifests.manifests !== 372 ? "cpi_manifest_count_mismatch" : null,
    cpiManifests.revokedManifests !== 0 ? "cpi_manifest_revoked" : null,
    cpiEndpointSummary.atomicSourceValidationStatus !== "PASS" ? "cpi_endpoint_contract_not_pass" : null,
    cpiEndpointSummary.releaseCalendarProofBranches !== 8 ? "cpi_release_calendar_branches_incomplete" : null,
    cpiEndpointSummary.revisionRebasingProofBranches !== 8 ? "cpi_revision_rebasing_branches_incomplete" : null,
    cpiEndpointSummary.continuityLockedBranches !== 8 ? "cpi_continuity_branches_incomplete" : null,
    cpiEndpointSummary.parserContractBranches !== 8 ? "cpi_parser_branches_incomplete" : null,
    cpiEndpointSummary.sourceFamilyValidationPassBranches !== 8 ? "cpi_family_validation_incomplete" : null,
    !joinReceiptPass(receipts.cpiJoin.json, "inflation_attribution_v1") ? "cpi_join_receipt_not_pass_diagnostic" : null,
    boundaryRepairSummary.status !== "PASS_BOUNDARY_PROOF" ? "boundary_repair_receipt_not_pass" : null,
    audMonthlyTransitionRepairSummary.status !== "PASS" ? "aud_monthly_transition_repair_not_pass" : null,
    audMonthlyTransitionRepairSummary.weekly_monthly_before_first_eligible_freeze !== 0 ? "aud_monthly_used_before_first_eligible_freeze" : null,
    audMonthlyTransitionRepairSummary.quarterly_selected_after_monthly_eligible !== 0 ? "aud_quarterly_selected_after_monthly_eligible" : null,
    audMonthlyTransitionRepairSummary.interpolated_rows !== 0 ? "aud_interpolated_rows" : null,
    audMonthlyTransitionRepairSummary.overlap_or_mixed_frequency_rows !== 0 ? "aud_overlap_or_mixed_frequency_rows" : null,
    audMonthlyTransitionRepairSummary.monthly_backfill_observations_eligible_before_release !== 0 ? "aud_backfill_eligible_before_release" : null,
    warehouseRebuildSummary.warehouseCanonicalRebuildStatus !== "PASS" ? "warehouse_canonical_rebuild_not_pass" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  const rrpBlockers = [
    !rrpDataset ? "rrp_dataset_not_found" : null,
    rrpDataset && rrpDataset.status !== "complete" ? "rrp_dataset_not_complete" : null,
    rrpDataset && rrpDataset.snapshot_state !== "SEALED" ? "rrp_dataset_not_sealed" : null,
    rrpDataset && rrpDataset.revoked_at_utc !== null ? "rrp_dataset_revoked" : null,
    rrpWeekly.rows !== 2_976 ? "rrp_weekly_row_count_mismatch" : null,
    rrpWeekly.missingRows !== 0 ? "rrp_weekly_missing_rows" : null,
    rrpWeekly.staleRows !== 0 ? "rrp_weekly_stale_rows" : null,
    rrpManifests.manifests !== 372 ? "rrp_manifest_count_mismatch" : null,
    rrpManifests.activeManifests !== 0 ? "rrp_unexpected_active_manifests" : null,
    rrpManifests.revokedManifests !== 0 ? "rrp_manifest_revoked" : null,
    !joinReceiptPass(receipts.rrpJoin.json, "real_rate_pressure_attribution_v1") ? "rrp_join_receipt_not_pass_diagnostic" : null,
    rrpJoinSummary.resolvedContentJoinMapHash !== RRP_DATASET.resolvedContentJoinMapHash
      ? "rrp_resolved_content_join_map_hash_mismatch"
      : null,
    boundaryRepairSummary.status !== "PASS_BOUNDARY_PROOF" ? "boundary_repair_receipt_not_pass" : null,
    rebuiltRrpReceiptSummary.status !== "PASS" ? "rebuilt_rrp_receipt_not_pass" : null,
    rebuiltRrpReceiptSummary.weekly_snapshots !== 2_976 ? "rebuilt_rrp_weekly_count_mismatch" : null,
    rebuiltRrpReceiptSummary.currency_bundles !== 8 ? "rebuilt_rrp_currency_bundle_count_mismatch" : null,
    rebuiltRrpReceiptSummary.stale_rows !== 0 ? "rebuilt_rrp_stale_rows" : null,
    rebuiltRrpReceiptSummary.missing_rows !== 0 ? "rebuilt_rrp_missing_rows" : null,
    warehouseRebuildSummary.warehouseCanonicalRebuildStatus !== "PASS" ? "warehouse_canonical_rebuild_not_pass" : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  const rateParentPromotionProof = {
    role: "rate",
    status: rateBlockers.length === 0 ? "PARENT_APPROVED" : "FAIL",
    parent: RATE_PARENT,
    dataset: rateDataset,
    weeklyCounts: rateWeekly,
    manifestCounts: rateManifests,
    contentHashes: {
      observationContentHash: rateObservationContentHash,
      weeklySnapshotContentHash: rateWeeklySnapshotContentHash,
    },
    supportingReceiptHashes: {
      reconciliation: receiptProofHash(receipts.rateReconciliation),
      write: receiptProofHash(receipts.rateWrite),
      boundaryRepair: receiptProofHash(receipts.boundaryRepair),
      warehouseRebuild: receiptProofHash(receipts.warehouseRebuild),
      join: receiptProofHash(receipts.rateJoin),
    },
    blockers: rateBlockers,
  };
  const cpiParentPromotionProof = {
    role: "cpi",
    status: cpiBlockers.length === 0 ? "PARENT_APPROVED" : "FAIL",
    parent: CPI_PARENT,
    dataset: cpiDataset,
    weeklyCounts: cpiWeekly,
    manifestCounts: cpiManifests,
    contentHashes: {
      observationContentHash: cpiObservationContentHash,
      weeklySnapshotContentHash: cpiWeeklySnapshotContentHash,
    },
    supportingReceiptHashes: {
      endpoint: receiptProofHash(receipts.cpiEndpoint),
      write: receiptProofHash(receipts.cpiWrite),
      boundaryRepair: receiptProofHash(receipts.boundaryRepair),
      warehouseRebuild: receiptProofHash(receipts.warehouseRebuild),
      join: receiptProofHash(receipts.cpiJoin),
    },
    blockers: cpiBlockers,
  };
  const rateParentPromotionProofHash = hashPayload(rateParentPromotionProof);
  const cpiParentPromotionProofHash = hashPayload(cpiParentPromotionProof);

  const parentPromotionApproved =
    rateBlockers.length === 0 &&
    cpiBlockers.length === 0 &&
    rrpBlockers.length === 0;
  const rootRrpPromotionManifestBase = {
    version: "root_rrp_parent_approved_promotion_manifest_v1",
    status: parentPromotionApproved ? "PARENT_APPROVED_PENDING_ACTIVATION_PROOFS" : "FAIL",
    lifecycleState: "SEALED_PARENT_APPROVED_NOT_ACTIVE",
    parentPromotionApproved,
    activationEligible: false,
    outcomeConsumable: false,
    mutatesDiagnosticManifest: false,
    rateParent: RATE_PARENT,
    cpiParent: CPI_PARENT,
    parentPromotionProofHashes: {
      rate: rateParentPromotionProofHash,
      cpi: cpiParentPromotionProofHash,
    },
    rrpDataset: RRP_DATASET,
    rrpContentHashes: {
      weeklySnapshotContentHash: rrpWeeklySnapshotContentHash,
      aggregateSnapshotContentHash: rrpWeeklyManifestContentHash,
      resolvedContentJoinMapHash: RRP_DATASET.resolvedContentJoinMapHash,
    },
    supportingReceiptHashes: buildSupportingReceiptHashes(receipts),
    controls: {
      noPnlComputed: true,
      noStrategyFilterComputed: true,
      diagnosticManifestPreserved: true,
      currentSealedCheckpointOnly: true,
      activeStateNotCreated: true,
    },
  };
  const rootRrpPromotionManifestHash = hashPayload(rootRrpPromotionManifestBase);
  const rootRrpPromotionManifestId = hashPayload({
    type: "root_rrp_parent_approved_promotion_manifest_v1",
    rootRrpPromotionManifestHash,
  });
  const rootRrpPromotionManifest = {
    ...rootRrpPromotionManifestBase,
    rootRrpPromotionManifestId,
    rootRrpPromotionManifestHash,
  };
  const blockers = [...rateBlockers, ...cpiBlockers, ...rrpBlockers].reduce<Record<string, number>>((counts, blocker) => {
    counts[blocker] = (counts[blocker] ?? 0) + 1;
    return counts;
  }, {});

  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose: "Immutable parent-promotion proof for current SEALED RRP checkpoint; no ACTIVE lifecycle transition or outcome logic.",
    summary: {
      status: parentPromotionApproved ? "PASS_PARENT_APPROVED_NOT_ACTIVE" : "FAIL",
      parentPromotionApproved,
      activationEligible: false,
      outcomeConsumable: false,
      diagnosticOnly: true,
      promotionEligible: false,
      rateParentPromotionProofHash,
      cpiParentPromotionProofHash,
      rootRrpPromotionManifestId,
      rootRrpPromotionManifestHash,
      rrpDatasetId: RRP_DATASET.datasetId,
      rrpDatasetHash: RRP_DATASET.datasetHash,
      resolvedContentJoinMapHash: RRP_DATASET.resolvedContentJoinMapHash,
      noPnlComputed: true,
      noStrategyFilterComputed: true,
    },
    parentProofs: {
      rate: {
        ...rateParentPromotionProof,
        parentPromotionProofHash: rateParentPromotionProofHash,
      },
      cpi: {
        ...cpiParentPromotionProof,
        parentPromotionProofHash: cpiParentPromotionProofHash,
      },
    },
    rrpProof: {
      dataset: rrpDataset,
      weeklyCounts: rrpWeekly,
      manifestCounts: rrpManifests,
      contentHashes: {
        weeklySnapshotContentHash: rrpWeeklySnapshotContentHash,
        aggregateSnapshotContentHash: rrpWeeklyManifestContentHash,
        resolvedContentJoinMapHash: RRP_DATASET.resolvedContentJoinMapHash,
      },
      supportingReceiptHashes: {
      write: receiptProofHash(receipts.rrpWrite),
      join: receiptProofHash(receipts.rrpJoin),
      boundaryRepair: receiptProofHash(receipts.boundaryRepair),
      warehouseRebuild: receiptProofHash(receipts.warehouseRebuild),
      },
      blockers: rrpBlockers,
    },
    rootRrpPromotionManifest,
    supportingReceiptFileHashes: buildSupportingReceiptFileHashes(receipts),
    blockers,
  };
  const receiptHash = hashPayload(reportBase);
  const report = {
    ...reportBase,
    receiptHash,
  };

  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const jsonPath = path.resolve(
    process.cwd(),
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-parent-promotion-proof-${stamp}.json`),
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

  console.log(`Gate 50 parent promotion proof: ${parentPromotionApproved ? "PASS_PARENT_APPROVED_NOT_ACTIVE" : "FAIL"}`);
  console.log(`Root RRP promotion manifest: ${rootRrpPromotionManifestId}`);
  console.log(`Resolved content join-map hash: ${RRP_DATASET.resolvedContentJoinMapHash}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (!parentPromotionApproved) {
    console.log(`Blockers: ${Object.entries(blockers).map(([key, count]) => `${key}:${count}`).join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[macro-parent-promotion-proof] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Pool may be unopened if validation fails before the first query.
    }
  });
