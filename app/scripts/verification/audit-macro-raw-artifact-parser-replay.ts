import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { PAIRS_BY_ASSET_CLASS } from "../../src/lib/cotPairs";
import {
  applyRealRatePressureCurrencyBundleHashes,
  buildMacroRegimeSourcePayload,
  buildRealRatePressureSnapshots,
  buildWeeklySnapshotManifests,
  configureOfflineArtifactReplay,
  sealMacroSnapshots,
  type CliOptions,
  type ParentDatasetIdentity,
} from "./fill-macro-regime-source-warehouse";

loadEnvConfig(process.cwd());
process.env.DB_QUERY_RETRY_LIMIT = process.env.DB_QUERY_RETRY_LIMIT ?? "2";

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const EXPECTED_RRP_CONTENT_JOIN_MAP_HASH =
  "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";
const GATE44_MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const EXPECTED_PAIR_WEEKS = 10_416;
const EXPECTED_RRP_WEEKLY_ROWS = 2_976;
const EXPECTED_WEEKLY_MANIFESTS = 372;

const RATE_PARENT = {
  role: "rate",
  datasetId: "dcdc850a-80a2-4178-8d08-dd759be6afb8",
  datasetHash: "3db4b84238dbf5c656a9ebaf2ff73219cc1efd2a6e1ff70842983945c4d23612",
  familyManifestId: "rate_3m_market_family_v1",
  familyManifestHash: "5e75faaadd2d7e19bdf6591df782b772fe10c7b8268713c0f892984867c421b2",
  expectedArtifacts: 40,
};

const CPI_PARENT = {
  role: "cpi",
  datasetId: "37b4081b-880e-4ae6-8d53-20ba900dff07",
  datasetHash: "0817b0ec5b4c03c2d01ddc5c014601a2b7028c78203d07f95b3393235c70cc17",
  familyManifestId: "cpi_all_items_family_v1",
  familyManifestHash: "b0e7f90e8abd7295e9886dec1c384b4ecc048c40eb3fce2feb52cebb58332beb",
  expectedArtifacts: 10,
};

const RRP_DATASET = {
  datasetId: "220fd5fd-d017-4db2-bdde-524a3c664c72",
  datasetHash: "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742",
  familyManifestId: "real_rate_pressure_attribution_v1",
  expectedCurrencyBundles: {
    AUD: "9aa3fade253aff61889ca5a0c99848b178dd9bc2232b4a3cb222e464570bab22",
    CAD: "386781d18d738ac82f58c1489d9e447fc3924f0bf5adc8e41879d6568968eb8c",
    CHF: "a24f2268b7271a8343f2217644b500a123613a4e50f2d73d6f7344a7bc2e44d8",
    EUR: "25b23426be6bf514ab5b4219270d4998bdddc8b4dc93fbb7a6e17a7d2ca91481",
    GBP: "a7af88c6dc55484d0bd160d3affde958e78c551b40e13f633867ba7dc0a32aac",
    JPY: "f8189a25a6c1fcc7abe1b8947656b6a4644be8c894e3e72bd76f4d8c82335135",
    NZD: "00dab87470f4dbe280f0b3bdf3945cd43852281c4492e9f331a209a7880d9439",
    USD: "fcbcdbfea5103358bbe62efa6be26ebf9ff0aab0374b154312e451663e4ead75",
  },
};

type JsonRecord = Record<string, unknown>;
type ParentIdentity = typeof RATE_PARENT | typeof CPI_PARENT;
type QueryFn = <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>;
type GetPoolFn = () => { end: () => Promise<void> };

let queryImpl: QueryFn | null = null;
let getPoolImpl: GetPoolFn | null = null;

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
  from_week_open_utc: string;
  to_week_open_utc: string;
  source_versions: unknown;
  coverage: unknown;
};

type ArtifactRow = {
  artifact_id: string;
  source_family: string;
  source_id: string;
  currency: string;
  endpoint_id: string;
  endpoint_url: string;
  http_status: number | null;
  raw_content_type: string | null;
  raw_payload_sha256: string;
  raw_payload_size_bytes: number;
  raw_payload_text: string | null;
  coverage: unknown;
  flags: unknown;
};

type ByteArchiveRow = {
  raw_payload_sha256: string;
  raw_payload_size_bytes: number;
  raw_content_type: string | null;
  raw_payload_base64: string;
  archive_origin: string;
  archive_written_at_utc: string;
  original_artifact_record_mutated: boolean;
  coverage: unknown;
  flags: unknown;
};

type StoredSnapshotHashRow = {
  week_open_utc: string;
  snapshot_id: string | null;
  snapshot_hash: string | null;
  snapshot_state: string | null;
  source_family: string;
  source_id: string;
  currency: string;
  instrument: string;
  source_observation_date: string | null;
  available_at_utc: string | null;
  coverage: unknown;
  flags: unknown;
};

type StoredManifestHashRow = {
  macro_week_id: string;
  snapshot_id: string;
  snapshot_hash: string;
  row_snapshot_count: number;
  coverage: unknown;
};

type MatrixContextRow = {
  week_open_utc: string;
  symbol: string;
};

async function loadDb() {
  if (queryImpl && getPoolImpl) return;
  const db = await import("../../src/lib/db");
  queryImpl = db.query;
  getPoolImpl = db.getPool;
}

async function query<T = unknown>(text: string, params?: readonly unknown[]) {
  await loadDb();
  return queryImpl!<T>(text, params);
}

async function closePool() {
  if (!getPoolImpl) return;
  await getPoolImpl().end();
}

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
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Bytes(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function isBinaryHashOnly(row: ArtifactRow) {
  const flags = asRecord(row.flags);
  return row.raw_payload_text === null || flags.binaryPayloadStoredByHashOnly === true;
}

async function readDataset(identity: { datasetId: string; datasetHash: string }) {
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
        to_char(from_week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS from_week_open_utc,
        to_char(to_week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS to_week_open_utc,
        source_versions,
        coverage
      FROM research_macro_regime_datasets
      WHERE regime_dataset_id = $1::uuid
        AND dataset_hash = $2
      LIMIT 1
    `,
    [identity.datasetId, identity.datasetHash],
  );
  return rows[0] ?? null;
}

async function readArtifacts(datasetId: string) {
  return query<ArtifactRow>(
    `
      SELECT
        artifact_id,
        source_family,
        source_id,
        currency,
        endpoint_id,
        endpoint_url,
        http_status,
        raw_content_type,
        raw_payload_sha256,
        raw_payload_size_bytes,
        raw_payload_text,
        coverage,
        flags
      FROM research_macro_source_artifacts
      WHERE regime_dataset_id = $1::uuid
      ORDER BY source_family, source_id, currency, endpoint_id, artifact_id
    `,
    [datasetId],
  );
}

async function readByteArchives(hashes: string[]) {
  if (hashes.length === 0) return [];
  return query<ByteArchiveRow>(
    `
      SELECT
        raw_payload_sha256,
        raw_payload_size_bytes,
        raw_content_type,
        raw_payload_base64,
        archive_origin,
        to_char(archive_written_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS archive_written_at_utc,
        original_artifact_record_mutated,
        coverage,
        flags
      FROM research_macro_source_artifact_byte_archives
      WHERE raw_payload_sha256 = ANY($1::text[])
      ORDER BY raw_payload_sha256
    `,
    [hashes],
  );
}

async function readStoredSnapshotHashes(datasetId: string) {
  return query<StoredSnapshotHashRow>(
    `
      SELECT
        to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        source_family,
        source_id,
        currency,
        instrument,
        source_observation_date::text,
        CASE WHEN available_at_utc IS NULL THEN NULL ELSE to_char(available_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS available_at_utc,
        coverage,
        flags
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
      ORDER BY week_open_utc, source_family, source_id, currency, instrument
    `,
    [datasetId],
  );
}

async function readStoredManifestHashes(datasetId: string) {
  return query<StoredManifestHashRow>(
    `
      SELECT
        macro_week_id,
        snapshot_id,
        snapshot_hash,
        row_snapshot_count,
        coverage
      FROM research_macro_weekly_snapshot_manifests
      WHERE regime_dataset_id = $1::uuid
      ORDER BY macro_week_id, freeze_version, snapshot_id
    `,
    [datasetId],
  );
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

function artifactPublic(row: ArtifactRow) {
  return {
    artifactId: row.artifact_id,
    sourceFamily: row.source_family,
    sourceId: row.source_id,
    currency: row.currency,
    endpointId: row.endpoint_id,
    endpointUrl: row.endpoint_url,
    httpStatus: row.http_status,
    rawContentType: row.raw_content_type,
    rawPayloadSha256: row.raw_payload_sha256,
    rawPayloadSizeBytes: row.raw_payload_size_bytes,
    flags: row.flags,
  };
}

function archiveBuffer(row: ByteArchiveRow | undefined) {
  if (!row) return null;
  try {
    return Buffer.from(row.raw_payload_base64, "base64");
  } catch {
    return null;
  }
}

function archivedPayloadStatus(row: ArtifactRow, archiveByHash: Map<string, ByteArchiveRow>) {
  if (row.raw_payload_text !== null) {
    return {
      hasReplayBytes: true,
      source: "raw_payload_text",
      shaMismatch: sha256Text(row.raw_payload_text) !== row.raw_payload_sha256,
      sizeMismatch: Buffer.byteLength(row.raw_payload_text, "utf8") !== row.raw_payload_size_bytes,
      originalArtifactRecordMutated: false,
    };
  }
  const archive = archiveByHash.get(row.raw_payload_sha256);
  const bytes = archiveBuffer(archive);
  return {
    hasReplayBytes: Boolean(bytes),
    source: archive ? "byte_archive" : "missing",
    shaMismatch: bytes ? createHash("sha256").update(bytes).digest("hex") !== row.raw_payload_sha256 : false,
    sizeMismatch: bytes ? bytes.byteLength !== row.raw_payload_size_bytes : false,
    originalArtifactRecordMutated: archive?.original_artifact_record_mutated === true,
  };
}

function expectedContentTypeTokens(row: Pick<ArtifactRow, "endpoint_id">) {
  if (row.endpoint_id.includes("json")) return ["json"];
  if (row.endpoint_id.includes("csv") || row.endpoint_id.includes("sch")) return ["csv"];
  if (row.endpoint_id.includes("html") || row.endpoint_id.includes("form")) return ["html"];
  if (row.endpoint_id.includes("xlsx")) return ["spreadsheetml", "excel", "xlsx"];
  if (row.endpoint_id.includes("fred_alfred")) return ["json"];
  if (row.endpoint_id.includes("statcan_wds")) return ["json"];
  return [];
}

function contentTypeMatches(row: Pick<ArtifactRow, "endpoint_id" | "raw_content_type">) {
  const expected = expectedContentTypeTokens(row);
  if (expected.length === 0) return true;
  const actual = String(row.raw_content_type ?? "").toLowerCase();
  return expected.some((token) => actual.includes(token));
}

function payloadBuffer(row: ArtifactRow, archiveByHash: Map<string, ByteArchiveRow>) {
  if (row.raw_payload_text !== null) return Buffer.from(row.raw_payload_text, "utf8");
  return archiveBuffer(archiveByHash.get(row.raw_payload_sha256));
}

function hasDuplicate(values: string[]) {
  return new Set(values).size !== values.length;
}

function parentArtifactProof(
  identity: ParentIdentity,
  dataset: DatasetRow | null,
  artifacts: ArtifactRow[],
  archiveByHash: Map<string, ByteArchiveRow>,
) {
  const statuses = artifacts.map((row) => ({ row, status: archivedPayloadStatus(row, archiveByHash) }));
  const missingPayloadRows = statuses
    .filter(({ status }) => !status.hasReplayBytes)
    .map(({ row }) => row);
  const binaryHashOnlyRows = artifacts.filter(isBinaryHashOnly);
  const rawPayloadShaMismatches = statuses.filter(({ status }) => status.shaMismatch);
  const rawPayloadSizeMismatches = statuses.filter(({ status }) => status.sizeMismatch);
  const archiveOriginalMutationFlags = statuses.filter(({ status }) => status.originalArtifactRecordMutated);
  const contentTypeMismatches = artifacts.filter((row) => !contentTypeMatches(row));
  const artifactCountMismatch = artifacts.length !== identity.expectedArtifacts;
  const blockers = [
    dataset === null ? `${identity.role}_dataset_identity_not_found` : null,
    artifactCountMismatch ? `${identity.role}_artifact_count_mismatch` : null,
    missingPayloadRows.length > 0 ? `${identity.role}_raw_payload_bytes_not_archived` : null,
    rawPayloadShaMismatches.length > 0 ? `${identity.role}_raw_payload_sha_mismatch` : null,
    rawPayloadSizeMismatches.length > 0 ? `${identity.role}_raw_payload_size_mismatch` : null,
    archiveOriginalMutationFlags.length > 0 ? `${identity.role}_byte_archive_original_artifact_mutation_flag` : null,
    contentTypeMismatches.length > 0 ? `${identity.role}_raw_payload_content_type_mismatch` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    identity,
    dataset: dataset ? {
      datasetId: dataset.regime_dataset_id,
      datasetHash: dataset.dataset_hash,
      datasetVersion: dataset.dataset_version,
      status: dataset.status,
      snapshotState: dataset.snapshot_state,
      promotionManifestId: dataset.promotion_manifest_id,
      contractManifestHash: dataset.contract_manifest_hash,
      calendarVersion: dataset.calendar_version,
      selectorVersion: dataset.selector_version,
      validationContractVersion: dataset.validation_contract_version,
      buildVersion: dataset.build_version,
      fromWeekOpenUtc: dataset.from_week_open_utc,
      toWeekOpenUtc: dataset.to_week_open_utc,
      sourceVersions: dataset.source_versions,
      coverage: dataset.coverage,
    } : null,
    artifactArchive: {
      expectedArtifacts: identity.expectedArtifacts,
      actualArtifacts: artifacts.length,
      textPayloadRows: artifacts.filter((row) => row.raw_payload_text !== null).length,
      missingRawPayloadRows: missingPayloadRows.length,
      binaryHashOnlyRows: binaryHashOnlyRows.length,
      byteArchiveBackedRows: statuses.filter(({ status }) => status.source === "byte_archive").length,
      rawPayloadShaMismatches: rawPayloadShaMismatches.length,
      rawPayloadSizeMismatches: rawPayloadSizeMismatches.length,
      archiveOriginalMutationFlags: archiveOriginalMutationFlags.length,
      rawPayloadContentTypeMismatches: contentTypeMismatches.length,
      payloadSetHash: hashPayload(artifacts.map((row) => ({
        artifactId: row.artifact_id,
        rawPayloadSha256: row.raw_payload_sha256,
        rawPayloadSizeBytes: row.raw_payload_size_bytes,
        hasRawPayloadText: row.raw_payload_text !== null,
        hasByteArchive: archiveByHash.has(row.raw_payload_sha256),
        rawContentType: row.raw_content_type,
      }))),
    },
    missingRawPayloadArtifacts: missingPayloadRows.map(artifactPublic),
    binaryHashOnlyArtifacts: binaryHashOnlyRows.map(artifactPublic),
    blockers,
  };
}

type NegativeReplayTest = {
  id: string;
  requirement: string;
  mutation: string;
  expectedFailure: string;
  status: "PASS" | "FAIL";
  evidence: JsonRecord;
};

function negativeTest(options: {
  id: string;
  requirement: string;
  mutation: string;
  expectedFailure: string;
  passed: boolean;
  evidence?: JsonRecord;
}): NegativeReplayTest {
  return {
    id: options.id,
    requirement: options.requirement,
    mutation: options.mutation,
    expectedFailure: options.expectedFailure,
    status: options.passed ? "PASS" : "FAIL",
    evidence: options.evidence ?? {},
  };
}

function parserVersionMatches(row: ArtifactRow) {
  const coverage = asRecord(row.coverage);
  const parserVersion = typeof coverage.parserVersion === "string" ? coverage.parserVersion : "";
  if (row.endpoint_id.includes("abs_cpi")) return parserVersion === "abs_sdmx_csv_native_frequency_parser_v1";
  if (row.endpoint_id.includes("swiss_fso")) return parserVersion === "swiss_fso_lik25b25_index_m_total_row_xlsx_parser_v1";
  if (row.endpoint_id.includes("eurostat")) return parserVersion === "eurostat_jsonstat_prc_hicp_minr_parser_v1";
  if (row.endpoint_id.includes("statsnz_infoshare_exportdirect_sch")) return parserVersion === "statsnz_infoshare_exportdirect_sch_csv_parser_v1";
  return true;
}

function nzdInfoshareLayoutGuard(text: string) {
  return text.includes("CPIQ.SE9NS1160") &&
    /Frequency\s*=\s*Quarterly/i.test(text) &&
    /Mar-\d{4}/.test(text) &&
    /CPIQ\.SE9NS1160,\d/.test(text);
}

function swissFsoWorkbookGuard(bytes: Buffer | null) {
  return Boolean(bytes && bytes.length > 1024 && bytes[0] === 0x50 && bytes[1] === 0x4b);
}

function eurostatCompositionGuard(row: ArtifactRow) {
  const coverage = asRecord(row.coverage);
  return row.endpoint_id === "eurostat_prc_hicp_minr_jsonstat" &&
    String(row.endpoint_url).includes("prc_hicp_minr") &&
    String(coverage.continuityDecisionId ?? "").includes("ea20_to_2025m12_ea21_from_2026m01");
}

function cpiObservationHasLagParents(row: { coverage: unknown }) {
  const coverage = asRecord(row.coverage);
  return Boolean(
    asRecord(coverage.currentCpiParent).sourceObservationId &&
    asRecord(coverage.lagCpiParent).sourceObservationId &&
    coverage.currentParentAvailabilityEventId &&
    coverage.lagParentAvailabilityEventId,
  );
}

async function runNegativeReplayTests(options: {
  rateDataset: DatasetRow | null;
  cpiDataset: DatasetRow | null;
  rateArtifacts: ArtifactRow[];
  cpiArtifacts: ArtifactRow[];
  archiveByHash: Map<string, ByteArchiveRow>;
  positiveReplayPassed: boolean;
}) {
  if (!options.positiveReplayPassed) {
    return {
      status: "BLOCKED_NOT_RUN",
      tests: [] as NegativeReplayTest[],
      failedTests: 0,
      passedTests: 0,
      blocker: "negative_tests_blocked_until_positive_replay_passes",
    };
  }

  const allArtifacts = [...options.rateArtifacts, ...options.cpiArtifacts];
  const payloadArtifact = allArtifacts.find((row) => payloadBuffer(row, options.archiveByHash));
  const payload = payloadArtifact ? payloadBuffer(payloadArtifact, options.archiveByHash) : null;
  const mutated = payload ? Buffer.from(payload) : null;
  if (mutated && mutated.length > 0) mutated[0] = mutated[0] ^ 0xff;
  const truncated = payload && payload.length > 1 ? payload.subarray(0, payload.length - 1) : null;
  const jsonArtifact = allArtifacts.find((row) => expectedContentTypeTokens(row).includes("json"));
  const binaryArtifact = options.cpiArtifacts.find((row) => isBinaryHashOnly(row));
  const rateWithoutOneArtifact = options.rateArtifacts.slice(1);
  const archiveWithoutBinary = new Map(options.archiveByHash);
  if (binaryArtifact) archiveWithoutBinary.delete(binaryArtifact.raw_payload_sha256);
  const nzdArtifact = options.cpiArtifacts.find((row) => row.endpoint_id === "statsnz_infoshare_exportdirect_sch");
  const nzdText = nzdArtifact?.raw_payload_text ?? "";
  const eurostatArtifact = options.cpiArtifacts.find((row) => row.endpoint_id === "eurostat_prc_hicp_minr_jsonstat");
  const audMonthlyArtifact = options.cpiArtifacts.find((row) => row.endpoint_id === "abs_cpi_monthly_sdmx_csv");
  const swissArtifact = options.cpiArtifacts.find((row) => row.endpoint_id === "swiss_fso_lik25b25_xlsx_master");
  const swissBytes = swissArtifact ? payloadBuffer(swissArtifact, options.archiveByHash) : null;
  const parserArtifact = options.cpiArtifacts.find((row) => parserVersionMatches(row));

  const cpiObservationRows = await query<{ source_observation_id: string; coverage: unknown }>(
    `
      SELECT source_observation_id, coverage
      FROM research_macro_source_observations
      WHERE regime_dataset_id = $1::uuid
        AND source_family = 'inflation'
      ORDER BY source_observation_id
      LIMIT 25
    `,
    [CPI_PARENT.datasetId],
  );
  const firstCpiObservationWithLag = cpiObservationRows.find(cpiObservationHasLagParents);
  const brokenLagCoverage = firstCpiObservationWithLag
    ? { ...asRecord(firstCpiObservationWithLag.coverage), lagCpiParent: null }
    : null;
  const observationIds = cpiObservationRows.map((row) => row.source_observation_id);

  const tests: NegativeReplayTest[] = [
    negativeTest({
      id: "altered_raw_payload_byte",
      requirement: "one altered payload byte",
      mutation: "flip first byte in an archived artifact payload",
      expectedFailure: "raw payload SHA-256 mismatch before parser replay",
      passed: Boolean(payloadArtifact && mutated && sha256Bytes(mutated) !== payloadArtifact.raw_payload_sha256),
      evidence: {
        artifactId: payloadArtifact?.artifact_id ?? null,
        expectedSha256: payloadArtifact?.raw_payload_sha256 ?? null,
        mutatedSha256: mutated ? sha256Bytes(mutated) : null,
      },
    }),
    negativeTest({
      id: "truncated_payload",
      requirement: "truncated workbook, JSON, CSV, or API page",
      mutation: "remove the final byte from an archived artifact payload",
      expectedFailure: "raw payload size and hash mismatch before parser replay",
      passed: Boolean(payloadArtifact && truncated &&
        truncated.byteLength !== payloadArtifact.raw_payload_size_bytes &&
        sha256Bytes(truncated) !== payloadArtifact.raw_payload_sha256),
      evidence: {
        artifactId: payloadArtifact?.artifact_id ?? null,
        expectedSize: payloadArtifact?.raw_payload_size_bytes ?? null,
        truncatedSize: truncated?.byteLength ?? null,
      },
    }),
    negativeTest({
      id: "artifact_hash_mismatch",
      requirement: "artifact hash or size mismatch",
      mutation: "compare archived artifact identity to altered bytes",
      expectedFailure: "byte identity guard rejects artifact",
      passed: Boolean(payloadArtifact && mutated && (
        sha256Bytes(mutated) !== payloadArtifact.raw_payload_sha256 ||
        mutated.byteLength !== payloadArtifact.raw_payload_size_bytes
      )),
      evidence: { artifactId: payloadArtifact?.artifact_id ?? null },
    }),
    negativeTest({
      id: "wrong_content_type",
      requirement: "unexpected content type",
      mutation: "replace an expected JSON content type with text/plain",
      expectedFailure: "content-type contract guard rejects artifact",
      passed: Boolean(jsonArtifact && !contentTypeMatches({ ...jsonArtifact, raw_content_type: "text/plain" })),
      evidence: {
        artifactId: jsonArtifact?.artifact_id ?? null,
        endpointId: jsonArtifact?.endpoint_id ?? null,
        originalContentType: jsonArtifact?.raw_content_type ?? null,
      },
    }),
    negativeTest({
      id: "missing_pagination_or_vintage_chunk",
      requirement: "missing pagination or vintage chunk",
      mutation: "remove one FRED/ALFRED real-time-period artifact page from the rate parent set",
      expectedFailure: "parent artifact count mismatch",
      passed: parentArtifactProof(RATE_PARENT, options.rateDataset, rateWithoutOneArtifact, options.archiveByHash)
        .blockers.includes("rate_artifact_count_mismatch"),
      evidence: {
        expectedArtifacts: RATE_PARENT.expectedArtifacts,
        mutatedArtifacts: rateWithoutOneArtifact.length,
      },
    }),
    negativeTest({
      id: "missing_archived_payload",
      requirement: "missing archived payload",
      mutation: "remove the archived bytes for one binary CPI artifact from the replay archive map",
      expectedFailure: "raw payload bytes not archived",
      passed: Boolean(binaryArtifact && parentArtifactProof(CPI_PARENT, options.cpiDataset, options.cpiArtifacts, archiveWithoutBinary)
        .blockers.includes("cpi_raw_payload_bytes_not_archived")),
      evidence: {
        artifactId: binaryArtifact?.artifact_id ?? null,
        rawPayloadSha256: binaryArtifact?.raw_payload_sha256 ?? null,
      },
    }),
    negativeTest({
      id: "changed_spreadsheet_column_layout",
      requirement: "spreadsheet layout or dimension drift",
      mutation: "replace Swiss FSO XLSX bytes with non-XLSX bytes",
      expectedFailure: "Swiss FSO workbook layout guard rejects payload",
      passed: swissFsoWorkbookGuard(swissBytes) && !swissFsoWorkbookGuard(Buffer.from("not an xlsx workbook", "utf8")),
      evidence: {
        artifactId: swissArtifact?.artifact_id ?? null,
        currentWorkbookGuardPass: swissFsoWorkbookGuard(swissBytes),
      },
    }),
    negativeTest({
      id: "duplicate_observation_identity",
      requirement: "duplicate observations or vintage identities",
      mutation: "duplicate a CPI source observation id in the replay identity set",
      expectedFailure: "duplicate identity guard rejects set",
      passed: observationIds.length > 0 && hasDuplicate([...observationIds, observationIds[0]]),
      evidence: { sampledObservationIds: observationIds.length },
    }),
    negativeTest({
      id: "unexpected_units_or_frequency",
      requirement: "unexpected units, geography, frequency, or seasonal adjustment",
      mutation: "change Stats NZ Infoshare frequency marker from Quarterly to Monthly",
      expectedFailure: "Stats NZ Infoshare layout/frequency guard rejects payload",
      passed: nzdInfoshareLayoutGuard(nzdText) &&
        !nzdInfoshareLayoutGuard(nzdText.replace(/Frequency\s*=\s*Quarterly/i, "Frequency = Monthly")),
      evidence: { artifactId: nzdArtifact?.artifact_id ?? null },
    }),
    negativeTest({
      id: "changed_eurostat_dimensions",
      requirement: "changed Eurostat dimensions/composition",
      mutation: "replace Eurostat EA20/EA21 continuity decision with an unexpected composition",
      expectedFailure: "Eurostat composition guard rejects artifact",
      passed: Boolean(eurostatArtifact && eurostatCompositionGuard(eurostatArtifact) &&
        !eurostatCompositionGuard({
          ...eurostatArtifact,
          coverage: {
            ...asRecord(eurostatArtifact.coverage),
            continuityDecisionId: "unexpected_geo_composition",
          },
        })),
      evidence: { artifactId: eurostatArtifact?.artifact_id ?? null },
    }),
    negativeTest({
      id: "missing_aud_monthly_segment",
      requirement: "missing AUD monthly segment",
      mutation: "remove the ABS monthly CPI artifact from the CPI parent set",
      expectedFailure: "CPI artifact count/segment guard rejects parent set",
      passed: Boolean(audMonthlyArtifact && parentArtifactProof(
        CPI_PARENT,
        options.cpiDataset,
        options.cpiArtifacts.filter((row) => row.artifact_id !== audMonthlyArtifact.artifact_id),
        options.archiveByHash,
      ).blockers.includes("cpi_artifact_count_mismatch")),
      evidence: { artifactId: audMonthlyArtifact?.artifact_id ?? null },
    }),
    negativeTest({
      id: "unavailable_lag_cpi_parent",
      requirement: "missing current or lag CPI parent",
      mutation: "remove lagCpiParent from a CPI YoY observation coverage payload",
      expectedFailure: "CPI parent lineage guard rejects row",
      passed: Boolean(firstCpiObservationWithLag && brokenLagCoverage &&
        !cpiObservationHasLagParents({ coverage: brokenLagCoverage })),
      evidence: { sourceObservationId: firstCpiObservationWithLag?.source_observation_id ?? null },
    }),
    negativeTest({
      id: "parser_version_mismatch",
      requirement: "parser-version mismatch",
      mutation: "replace a CPI parser version with unexpected_parser_v0",
      expectedFailure: "parser-version contract guard rejects artifact",
      passed: Boolean(parserArtifact && parserVersionMatches(parserArtifact) &&
        !parserVersionMatches({
          ...parserArtifact,
          coverage: {
            ...asRecord(parserArtifact.coverage),
            parserVersion: "unexpected_parser_v0",
          },
        })),
      evidence: {
        artifactId: parserArtifact?.artifact_id ?? null,
        endpointId: parserArtifact?.endpoint_id ?? null,
      },
    }),
  ];
  const failedTests = tests.filter((test) => test.status !== "PASS").length;
  return {
    status: failedTests === 0 ? "PASS" : "FAIL",
    tests,
    passedTests: tests.length - failedTests,
    failedTests,
    blocker: failedTests === 0 ? null : "negative_replay_fail_closed_tests_failed",
  };
}

function blockerCounts(blockerLists: string[][]) {
  const counts: Record<string, number> = {};
  for (const blocker of blockerLists.flat()) {
    counts[blocker] = (counts[blocker] ?? 0) + 1;
  }
  return counts;
}

function isoUtc(value: string) {
  const parsed = DateTime.fromISO(value, { setZone: true });
  return parsed.isValid ? parsed.toUTC().toISO({ suppressMilliseconds: false }) ?? value : value;
}

function macroWeekIdFor(weekOpenUtc: string) {
  return `macro_week_${isoUtc(weekOpenUtc).slice(0, 10)}`;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))].sort();
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function parentDatasetIdentity(role: "rate" | "cpi", dataset: DatasetRow, identity: ParentIdentity): ParentDatasetIdentity {
  if (!dataset.promotion_manifest_id || !dataset.contract_manifest_hash) {
    throw new Error(`${role} parent dataset is missing promotion or contract manifest identity.`);
  }
  return {
    role,
    regimeDatasetId: dataset.regime_dataset_id,
    datasetHash: dataset.dataset_hash,
    datasetVersion: dataset.dataset_version,
    promotionManifestId: dataset.promotion_manifest_id,
    contractManifestHash: dataset.contract_manifest_hash,
    snapshotState: dataset.snapshot_state,
    calendarVersion: dataset.calendar_version,
    selectorVersion: dataset.selector_version,
    validationContractVersion: dataset.validation_contract_version,
    buildVersion: dataset.build_version,
    familyManifestId: identity.familyManifestId,
    familyManifestHash: identity.familyManifestHash,
    sourceVersions: asRecord(dataset.source_versions),
    coverage: asRecord(dataset.coverage),
  };
}

function hashSet(rows: Array<{ snapshot_hash?: string | null } | { snapshotHash?: string | null }>) {
  return new Set(rows
    .map((row) => "snapshot_hash" in row ? row.snapshot_hash : row.snapshotHash)
    .filter((value): value is string => typeof value === "string" && value.length > 0));
}

function compareSnapshotHashes(replayRows: Array<{ snapshotHash?: string | null }>, storedRows: StoredSnapshotHashRow[]) {
  const replay = hashSet(replayRows);
  const stored = hashSet(storedRows);
  const missingFromReplay = [...stored].filter((hash) => !replay.has(hash)).length;
  const unexpectedInReplay = [...replay].filter((hash) => !stored.has(hash)).length;
  return {
    replayRows: replayRows.length,
    storedRows: storedRows.length,
    replayUniqueHashes: replay.size,
    storedUniqueHashes: stored.size,
    missingFromReplay,
    unexpectedInReplay,
    contentHash: hashPayload([...replay].sort()),
  };
}

function compareManifestHashes(replayRows: Array<{ snapshotHash: string }>, storedRows: StoredManifestHashRow[]) {
  const replay = new Set(replayRows.map((row) => row.snapshotHash));
  const stored = new Set(storedRows.map((row) => row.snapshot_hash));
  return {
    replayRows: replayRows.length,
    storedRows: storedRows.length,
    replayUniqueHashes: replay.size,
    storedUniqueHashes: stored.size,
    missingFromReplay: [...stored].filter((hash) => !replay.has(hash)).length,
    unexpectedInReplay: [...replay].filter((hash) => !stored.has(hash)).length,
    contentHash: hashPayload([...replay].sort()),
  };
}

function snapshotKey(row: { sourceFamily?: string; source_family?: string; sourceId?: string; source_id?: string; instrument: string }) {
  return `${row.sourceFamily ?? row.source_family}|${row.sourceId ?? row.source_id}|${row.instrument}`;
}

const FX_PAIR_DEFINITIONS = PAIRS_BY_ASSET_CLASS.fx.map((row) => ({
  pair: row.pair.toUpperCase(),
  base: row.base.toUpperCase(),
  quote: row.quote.toUpperCase(),
}));
const PAIR_BY_SYMBOL = new Map(FX_PAIR_DEFINITIONS.map((row) => [row.pair, row]));

function availabilityEventIdsForJoin(snapshot: { coverage: unknown; flags: unknown }) {
  const coverage = asRecord(snapshot.coverage);
  const flags = asRecord(snapshot.flags);
  return uniqueSorted([
    ...stringArray(coverage.parentAvailabilityEventIds),
    ...stringArray(coverage.selectedAvailabilityEventId),
    ...stringArray(coverage.availabilityEventId),
    ...stringArray(coverage.currentParentAvailabilityEventId),
    ...stringArray(coverage.lagParentAvailabilityEventId),
    ...stringArray(flags.availabilityEventId),
  ]);
}

function buildResolvedContentJoinMap(
  matrixContexts: MatrixContextRow[],
  manifests: Array<{ macroWeekId?: string; macro_week_id?: string; snapshotId?: string; snapshot_id?: string }>,
  snapshots: Array<{
    weekOpenUtc: string;
    snapshotId?: string | null;
    snapshotHash?: string | null;
    sourceFamily: string;
    sourceId: string;
    currency: string;
    instrument: string;
    availableAtUtc: string | null;
    sourceObservationDate: string | null;
    coverage: unknown;
    flags: unknown;
  }>,
) {
  const manifestByWeek = new Map(manifests.map((row) => [row.macroWeekId ?? row.macro_week_id, row]));
  const snapshotByWeekCurrencyKey = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    snapshotByWeekCurrencyKey.set(
      `${snapshot.weekOpenUtc}|${snapshot.currency.toUpperCase()}|${snapshotKey(snapshot)}`,
      snapshot,
    );
  }
  const expectedKeysByCurrency = new Map<string, Set<string>>();
  for (const snapshot of snapshots) {
    if (snapshot.sourceFamily !== "real_rate_pressure") continue;
    const currency = snapshot.currency.toUpperCase();
    const keys = expectedKeysByCurrency.get(currency) ?? new Set<string>();
    keys.add(snapshotKey(snapshot));
    expectedKeysByCurrency.set(currency, keys);
  }
  const rows = matrixContexts.map((context) => {
    const weekOpenUtc = isoUtc(context.week_open_utc);
    const symbol = context.symbol.toUpperCase();
    const pair = PAIR_BY_SYMBOL.get(symbol);
    const macroWeekId = macroWeekIdFor(weekOpenUtc);
    const manifest = manifestByWeek.get(macroWeekId) ?? null;
    const selectedSnapshots = pair
      ? [pair.base, pair.quote].flatMap((currency) => {
          const expectedKeys = [...(expectedKeysByCurrency.get(currency) ?? [])].sort();
          return expectedKeys.map((expectedKey) => {
            const snapshot = snapshotByWeekCurrencyKey.get(`${weekOpenUtc}|${currency}|${expectedKey}`) ?? null;
            const coverage = asRecord(snapshot?.coverage);
            return {
              currency,
              requiredSnapshotKey: expectedKey,
              snapshotId: snapshot?.snapshotId ?? null,
              snapshotHash: snapshot?.snapshotHash ?? null,
              sourceFamily: snapshot?.sourceFamily ?? null,
              sourceId: snapshot?.sourceId ?? null,
              instrument: snapshot?.instrument ?? null,
              availableAtUtc: snapshot?.availableAtUtc ?? null,
              sourceObservationDate: snapshot?.sourceObservationDate ?? null,
              availabilityEventIds: snapshot ? availabilityEventIdsForJoin(snapshot) : [],
              parentRawObservationIds: snapshot ? stringArray(coverage.parentRawObservationIds) : [],
              parentRawArtifactIds: snapshot ? stringArray(coverage.parentRawArtifactIds) : [],
              rateParentDatasetId: snapshot ? coverage.rateParentDatasetId ?? null : null,
              cpiParentDatasetId: snapshot ? coverage.cpiParentDatasetId ?? null : null,
              rateParentMacroWeekId: snapshot ? coverage.rateParentMacroWeekId ?? null : null,
              cpiParentMacroWeekId: snapshot ? coverage.cpiParentMacroWeekId ?? null : null,
              rateParentFreezeTargetUtc: snapshot ? coverage.rateParentFreezeTargetUtc ?? null : null,
              cpiParentFreezeTargetUtc: snapshot ? coverage.cpiParentFreezeTargetUtc ?? null : null,
              sharedMacroWeekId: snapshot ? coverage.sharedMacroWeekId ?? null : null,
              sharedFreezeTargetUtc: snapshot ? coverage.sharedFreezeTargetUtc ?? null : null,
              sharedCalendarVersion: snapshot ? coverage.sharedCalendarVersion ?? null : null,
              sharedSelectorVersion: snapshot ? coverage.sharedSelectorVersion ?? null : null,
              formulaVersion: snapshot ? coverage.formulaVersion ?? null : null,
              currencyBundleHash: snapshot ? coverage.currencyBundleHash ?? null : null,
            };
          });
        })
      : [];
    return {
      matrixPairWeekId: `${macroWeekId}|${symbol}`,
      macroWeekId,
      weekOpenUtc,
      pairId: symbol,
      base: pair?.base ?? null,
      quote: pair?.quote ?? null,
      macroWeeklyManifestId: manifest?.snapshotId ?? manifest?.snapshot_id ?? null,
      selectedSnapshots,
    };
  });
  return {
    rowCount: rows.length,
    resolvedContentJoinMapHash: hashPayload(rows),
    sampleRows: rows.slice(0, 3),
  };
}

function currencyBundleHashes(snapshots: Array<{ currency: string; coverage: unknown }>) {
  return Object.fromEntries([...new Set(snapshots.map((row) => row.currency.toUpperCase()))]
    .sort()
    .map((currency) => {
      const hashes = uniqueSorted(snapshots
        .filter((row) => row.currency.toUpperCase() === currency)
        .map((row) => asRecord(row.coverage).currencyBundleHash as string | undefined));
      return [currency, hashes];
    }));
}

function replayCli(options: {
  fromWeekOpenUtc: string;
  toWeekOpenUtc: string;
  includeRates: boolean;
  includeInflation: boolean;
}): CliOptions {
  return {
    fromWeekOpenUtc: options.fromWeekOpenUtc,
    toWeekOpenUtc: options.toWeekOpenUtc,
    weekSource: "matrix-control",
    write: false,
    output: null,
    reportTypes: ["f", "o"],
    allowExploratorySourceFallback: false,
    credentialPreflightOnly: false,
    includeBpr: false,
    includeRates: options.includeRates,
    includeInflation: options.includeInflation,
    includeValuation: false,
    includeRealRatePressure: false,
    composeRrpFromParentDatasets: false,
    rateParentDatasetId: null,
    rateParentDatasetHash: null,
    cpiParentDatasetId: null,
    cpiParentDatasetHash: null,
    offlineArtifactReplay: true,
    offlineArtifactReplayDatasetIds: [RATE_PARENT.datasetId, CPI_PARENT.datasetId],
  };
}

async function runFullOfflineParserReplay(options: {
  rateDataset: DatasetRow;
  cpiDataset: DatasetRow;
  rrpDataset: DatasetRow;
}) {
  const generatedAtUtc = DateTime.utc().toISO({ suppressMilliseconds: false }) ?? new Date().toISOString();
  configureOfflineArtifactReplay({
    enabled: true,
    datasetIds: [RATE_PARENT.datasetId, CPI_PARENT.datasetId],
  });
  const rateReplay = await buildMacroRegimeSourcePayload(replayCli({
    fromWeekOpenUtc: options.rateDataset.from_week_open_utc,
    toWeekOpenUtc: options.rateDataset.to_week_open_utc,
    includeRates: true,
    includeInflation: false,
  }), generatedAtUtc);
  const cpiReplay = await buildMacroRegimeSourcePayload(replayCli({
    fromWeekOpenUtc: options.cpiDataset.from_week_open_utc,
    toWeekOpenUtc: options.cpiDataset.to_week_open_utc,
    includeRates: false,
    includeInflation: true,
  }), generatedAtUtc);

  const rateParent = parentDatasetIdentity("rate", options.rateDataset, RATE_PARENT);
  const cpiParent = parentDatasetIdentity("cpi", options.cpiDataset, CPI_PARENT);
  if (!options.rrpDataset.promotion_manifest_id || !options.rrpDataset.contract_manifest_hash) {
    throw new Error("RRP dataset is missing promotion or contract manifest identity.");
  }

  const rrpRawSnapshots = buildRealRatePressureSnapshots({
    weeks: rateReplay.weeks,
    snapshots: [...rateReplay.snapshots, ...cpiReplay.snapshots],
    rateParent,
    cpiParent,
  });
  applyRealRatePressureCurrencyBundleHashes({
    weeks: rateReplay.weeks,
    snapshots: rrpRawSnapshots,
    parentDatasetRefs: [
      {
        role: "rate",
        datasetId: rateParent.regimeDatasetId,
        datasetHash: rateParent.datasetHash,
        datasetVersion: rateParent.datasetVersion,
        calendarVersion: rateParent.calendarVersion,
        selectorVersion: rateParent.selectorVersion,
        familyManifestId: rateParent.familyManifestId,
        familyManifestHash: rateParent.familyManifestHash,
      },
      {
        role: "cpi",
        datasetId: cpiParent.regimeDatasetId,
        datasetHash: cpiParent.datasetHash,
        datasetVersion: cpiParent.datasetVersion,
        calendarVersion: cpiParent.calendarVersion,
        selectorVersion: cpiParent.selectorVersion,
        familyManifestId: cpiParent.familyManifestId,
        familyManifestHash: cpiParent.familyManifestHash,
      },
    ],
  });
  const rrpSnapshots = sealMacroSnapshots(
    rrpRawSnapshots,
    RRP_DATASET.datasetHash,
    generatedAtUtc,
    options.rrpDataset.promotion_manifest_id,
    options.rrpDataset.contract_manifest_hash,
  );
  const rrpManifests = buildWeeklySnapshotManifests({
    weeks: rateReplay.weeks,
    snapshots: rrpSnapshots,
    promotionManifestId: options.rrpDataset.promotion_manifest_id,
    contractManifestHash: options.rrpDataset.contract_manifest_hash,
    sealedAtUtc: generatedAtUtc,
  });

  const [
    storedRateSnapshots,
    storedCpiSnapshots,
    storedRrpSnapshots,
    storedRrpManifests,
    matrixContexts,
  ] = await Promise.all([
    readStoredSnapshotHashes(RATE_PARENT.datasetId),
    readStoredSnapshotHashes(CPI_PARENT.datasetId),
    readStoredSnapshotHashes(RRP_DATASET.datasetId),
    readStoredManifestHashes(RRP_DATASET.datasetId),
    readMatrixContexts(),
  ]);

  const rateSnapshotComparison = compareSnapshotHashes(rateReplay.snapshots, storedRateSnapshots);
  const cpiSnapshotComparison = compareSnapshotHashes(cpiReplay.snapshots, storedCpiSnapshots);
  const rrpSnapshotComparison = compareSnapshotHashes(rrpSnapshots, storedRrpSnapshots);
  const rrpManifestComparison = compareManifestHashes(rrpManifests, storedRrpManifests);
  const replayBundleHashes = currencyBundleHashes(rrpSnapshots);
  const bundleMismatches = Object.entries(RRP_DATASET.expectedCurrencyBundles)
    .filter(([currency, expected]) => {
      const actual = replayBundleHashes[currency] ?? [];
      return actual.length !== 1 || actual[0] !== expected;
    }).length;
  const missingRrpRows = rrpSnapshots.filter((row) => asRecord(row.coverage).valueAvailable !== true).length;
  const staleRrpRows = rrpSnapshots.filter((row) => asRecord(row.coverage).isStale === true).length;
  const resolvedJoinMap = buildResolvedContentJoinMap(matrixContexts, rrpManifests, rrpSnapshots.map((row) => ({
    weekOpenUtc: row.weekOpenUtc,
    snapshotId: row.snapshotId ?? null,
    snapshotHash: row.snapshotHash ?? null,
    sourceFamily: row.sourceFamily,
    sourceId: row.sourceId,
    currency: row.currency,
    instrument: row.instrument,
    availableAtUtc: row.availableAtUtc,
    sourceObservationDate: row.sourceObservationDate,
    coverage: row.coverage,
    flags: row.flags,
  })));
  const blockers = [
    rateReplay.datasetHash !== RATE_PARENT.datasetHash ? "rate_replay_dataset_hash_mismatch" : null,
    cpiReplay.datasetHash !== CPI_PARENT.datasetHash ? "cpi_replay_dataset_hash_mismatch" : null,
    rateSnapshotComparison.missingFromReplay > 0 || rateSnapshotComparison.unexpectedInReplay > 0
      ? "rate_weekly_snapshot_hash_mismatch"
      : null,
    cpiSnapshotComparison.missingFromReplay > 0 || cpiSnapshotComparison.unexpectedInReplay > 0
      ? "cpi_weekly_snapshot_hash_mismatch"
      : null,
    rrpSnapshots.length !== EXPECTED_RRP_WEEKLY_ROWS ? "rrp_replay_row_count_mismatch" : null,
    missingRrpRows > 0 ? "rrp_replay_missing_rows" : null,
    staleRrpRows > 0 ? "rrp_replay_stale_rows" : null,
    rrpSnapshotComparison.missingFromReplay > 0 || rrpSnapshotComparison.unexpectedInReplay > 0
      ? "rrp_weekly_snapshot_hash_mismatch"
      : null,
    rrpManifests.length !== EXPECTED_WEEKLY_MANIFESTS ? "rrp_manifest_count_mismatch" : null,
    rrpManifestComparison.missingFromReplay > 0 || rrpManifestComparison.unexpectedInReplay > 0
      ? "rrp_manifest_hash_mismatch"
      : null,
    bundleMismatches > 0 ? "rrp_currency_bundle_hash_mismatch" : null,
    resolvedJoinMap.rowCount !== EXPECTED_PAIR_WEEKS ? "rrp_join_map_row_count_mismatch" : null,
    resolvedJoinMap.resolvedContentJoinMapHash !== EXPECTED_RRP_CONTENT_JOIN_MAP_HASH
      ? "rrp_resolved_content_join_map_hash_mismatch"
      : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  return {
    status: blockers.length === 0 ? "PASS_RAW_ARTIFACT_PARSER_REPLAY" : "FAIL_RAW_ARTIFACT_PARSER_REPLAY",
    generatedAtUtc,
    networkAccessUsed: false,
    storedNormalizedRowsUsedAsInputs: false,
    storedAvailabilityEventsUsedAsInputs: false,
    storedWeeklySnapshotsUsedAsInputs: false,
    storedDerivedRowsUsedAsInputs: false,
    comparisonTarget: "STORED_CANONICAL_CONTENT",
    rate: {
      replayDatasetHash: rateReplay.datasetHash,
      expectedDatasetHash: RATE_PARENT.datasetHash,
      artifacts: rateReplay.artifacts.length,
      observations: rateReplay.observations.length,
      availabilityEvents: rateReplay.availabilityEvents.length,
      weeklySnapshots: rateReplay.snapshots.length,
      snapshotComparison: rateSnapshotComparison,
    },
    cpi: {
      replayDatasetHash: cpiReplay.datasetHash,
      expectedDatasetHash: CPI_PARENT.datasetHash,
      artifacts: cpiReplay.artifacts.length,
      observations: cpiReplay.observations.length,
      availabilityEvents: cpiReplay.availabilityEvents.length,
      weeklySnapshots: cpiReplay.snapshots.length,
      snapshotComparison: cpiSnapshotComparison,
    },
    rrp: {
      weeklySnapshots: rrpSnapshots.length,
      missingRows: missingRrpRows,
      staleRows: staleRrpRows,
      currencyBundleHashes: replayBundleHashes,
      expectedCurrencyBundleHashes: RRP_DATASET.expectedCurrencyBundles,
      currencyBundleMismatches: bundleMismatches,
      snapshotComparison: rrpSnapshotComparison,
      manifestComparison: rrpManifestComparison,
      resolvedJoinMap,
      expectedResolvedContentJoinMapHash: EXPECTED_RRP_CONTENT_JOIN_MAP_HASH,
    },
    blockers,
  };
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const blockers = Object.entries(asRecord(report.blockers))
    .map(([key, value]) => `| ${key} | ${value} |`);
  const finalNote = summary.rawArtifactArchiveCompletenessStatus === "PASS"
    ? summary.parserReplayStatus === "PASS"
      ? summary.negativeTestsStatus === "PASS"
        ? "The raw artifact archive completeness, positive offline parser replay, and fail-closed negative replay tests passed. This receipt does not activate snapshots, compute P&L, or make strategy decisions."
        : "The raw artifact archive completeness and positive offline parser replay passed, but replay negative tests did not pass. This receipt does not activate snapshots, compute P&L, or make strategy decisions."
      : "The raw artifact archive completeness preflight passed, but positive offline parser replay failed. This receipt does not activate snapshots, compute P&L, or make strategy decisions."
    : "The proof fails closed before parser replay because every required raw source payload must be available from the archive. Hash-only binary evidence is sufficient for warehouse lineage, but not for independent parser replay. This receipt does not activate snapshots, compute P&L, or make strategy decisions.";
  return [
    "# Gate 50 Raw Artifact Parser Replay Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Replay input level: ${summary.replayInputLevel}`,
    `- Network access used: ${summary.networkAccessUsed}`,
    `- Stored normalized rows used as inputs: ${summary.storedNormalizedRowsUsedAsInputs}`,
    `- Stored availability events used as inputs: ${summary.storedAvailabilityEventsUsedAsInputs}`,
    `- Stored weekly snapshots used as inputs: ${summary.storedWeeklySnapshotsUsedAsInputs}`,
    `- Stored derived rows used as inputs: ${summary.storedDerivedRowsUsedAsInputs}`,
    `- Isolated replay target: ${summary.isolatedReplayTarget}`,
    `- Raw artifact archive completeness: ${summary.rawArtifactArchiveCompletenessStatus}`,
    `- Parser replay status: ${summary.parserReplayStatus}`,
    `- Negative tests status: ${summary.negativeTestsStatus}`,
    `- Overall promotion rebuild: ${summary.overallPromotionRebuildStatus}`,
    `- Resolved content join-map hash target: ${summary.expectedResolvedContentJoinMapHash}`,
    "",
    "## Blockers",
    "",
    "| Blocker | Count |",
    "|---|---:|",
    ...(blockers.length > 0 ? blockers : ["| - | 0 |"]),
    "",
    finalNote,
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for raw artifact parser replay proof.");
  }

  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const rateDataset = await readDataset(RATE_PARENT);
  const cpiDataset = await readDataset(CPI_PARENT);
  const rrpDataset = await readDataset(RRP_DATASET);
  const rateArtifacts = await readArtifacts(RATE_PARENT.datasetId);
  const cpiArtifacts = await readArtifacts(CPI_PARENT.datasetId);
  const allArtifacts = [...rateArtifacts, ...cpiArtifacts];
  const archiveByHash = new Map(
    (await readByteArchives([...new Set(allArtifacts.map((artifact) => artifact.raw_payload_sha256))]))
      .map((archive) => [archive.raw_payload_sha256, archive]),
  );
  const rateProof = parentArtifactProof(RATE_PARENT, rateDataset, rateArtifacts, archiveByHash);
  const cpiProof = parentArtifactProof(CPI_PARENT, cpiDataset, cpiArtifacts, archiveByHash);
  const preflightBlockers = [
    ...rateProof.blockers,
    ...cpiProof.blockers,
    rrpDataset === null ? "rrp_dataset_identity_not_found" : null,
  ].filter((value): value is string => Boolean(value));
  const blockers = blockerCounts([preflightBlockers]);
  const rawArchiveComplete = Object.keys(blockers).length === 0;
  const parserReplay = rawArchiveComplete && rateDataset && cpiDataset && rrpDataset
    ? await runFullOfflineParserReplay({ rateDataset, cpiDataset, rrpDataset })
    : null;

  if (parserReplay) {
    for (const blocker of parserReplay.blockers) blockers[blocker] = (blockers[blocker] ?? 0) + 1;
  }

  if (!rawArchiveComplete) {
    blockers.raw_artifact_parser_replay_not_run = 1;
    blockers.negative_tests_not_run_due_to_incomplete_raw_archive = 1;
  }
  const parserReplayPass = parserReplay?.status === "PASS_RAW_ARTIFACT_PARSER_REPLAY";
  const negativeTests = rawArchiveComplete
    ? await runNegativeReplayTests({
      rateDataset,
      cpiDataset,
      rateArtifacts,
      cpiArtifacts,
      archiveByHash,
      positiveReplayPassed: parserReplayPass,
    })
    : {
      status: "BLOCKED_NOT_RUN",
      tests: [] as NegativeReplayTest[],
      passedTests: 0,
      failedTests: 0,
      blocker: "negative_tests_not_run_due_to_incomplete_raw_archive",
    };
  if (negativeTests.blocker) {
    blockers[negativeTests.blocker] = (blockers[negativeTests.blocker] ?? 0) + 1;
  }
  const negativeTestsPass = negativeTests.status === "PASS";

  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose:
      "Raw archived artifact parser replay preflight for the current boundary-repaired RRP source bundle; no ACTIVE lifecycle transition or outcome logic.",
    proofScope: {
      replayInputLevel: "RAW_ARCHIVED_ARTIFACTS",
      networkAccessUsed: false,
      storedNormalizedRowsUsedAsInputs: false,
      storedAvailabilityEventsUsedAsInputs: false,
      storedWeeklySnapshotsUsedAsInputs: false,
      storedDerivedRowsUsedAsInputs: false,
      isolatedReplayTarget: true,
      comparisonTarget: "STORED_CANONICAL_CONTENT_AFTER_RAW_REPLAY",
      parserReplayExecution:
        rawArchiveComplete ? "EXECUTED" : "BLOCKED_BEFORE_REPLAY_BY_INCOMPLETE_RAW_ARCHIVE",
    },
    deterministicExclusions: [
      "database UUIDs and primary keys not used as content identities",
      "created_at/completed_at/fetched_at/generatedAtUtc timestamps",
      "local filesystem paths and markdown receipt paths",
      "database insertion order",
      "receipt generation timestamps",
    ],
    deterministicInclusionsRequiredAfterArchiveCompleteness: [
      "archived raw payload bytes for every parent source artifact",
      "frozen source contracts, parser versions, normalization rules, availability rules, and selectors",
      "rate and CPI normalized observation hashes",
      "rate and CPI availability-event hashes",
      "weekly parent snapshot content hashes",
      "rate and CPI family-manifest hashes",
      "all eight RRP currency-bundle hashes",
      "2,976 RRP row hashes",
      "aggregate weekly content hashes",
      "resolved content join-map hash",
    ],
    requiredNegativeTestsAfterArchiveCompleteness: [
      "altered raw payload bytes",
      "truncated files or API pages",
      "wrong content type",
      "missing pagination chunks",
      "changed spreadsheet column layout",
      "duplicate observations or vintages",
      "unexpected units or frequency",
      "changed Eurostat dimensions or composition",
      "missing AUD monthly segment",
      "changed Swiss FSO layout",
      "unavailable lag CPI parent",
      "artifact hash mismatch",
    ],
    summary: {
      status: rawArchiveComplete
        ? parserReplayPass
          ? negativeTestsPass
            ? "PASS_RAW_ARTIFACT_PARSER_REPLAY"
            : "FAIL_RAW_ARTIFACT_PARSER_NEGATIVE_TESTS"
          : "FAIL_RAW_ARTIFACT_PARSER_REPLAY"
        : "FAIL_RAW_ARTIFACT_PAYLOAD_INCOMPLETE",
      replayInputLevel: "RAW_ARCHIVED_ARTIFACTS",
      networkAccessUsed: false,
      storedNormalizedRowsUsedAsInputs: false,
      storedAvailabilityEventsUsedAsInputs: false,
      storedWeeklySnapshotsUsedAsInputs: false,
      storedDerivedRowsUsedAsInputs: false,
      isolatedReplayTarget: true,
      rawArtifactArchiveCompletenessStatus: rawArchiveComplete ? "PASS" : "FAIL",
      parserReplayStatus: rawArchiveComplete
        ? parserReplayPass
          ? "PASS"
          : "FAIL"
        : "BLOCKED_NOT_RUN",
      negativeTestsStatus: negativeTests.status,
      overallPromotionRebuildStatus: parserReplayPass && negativeTestsPass
        ? "RAW_REPLAY_AND_NEGATIVE_TESTS_PASS"
        : parserReplayPass
          ? "RAW_REPLAY_PASS_NEGATIVE_TESTS_PENDING_OR_FAILED"
          : "PENDING",
      diagnosticOnly: true,
      promotionEligible: false,
      activationEligible: false,
      outcomeConsumable: false,
      rateDatasetId: RATE_PARENT.datasetId,
      rateDatasetHash: RATE_PARENT.datasetHash,
      cpiDatasetId: CPI_PARENT.datasetId,
      cpiDatasetHash: CPI_PARENT.datasetHash,
      rrpDatasetId: RRP_DATASET.datasetId,
      rrpDatasetHash: RRP_DATASET.datasetHash,
      expectedResolvedContentJoinMapHash: EXPECTED_RRP_CONTENT_JOIN_MAP_HASH,
      resolvedContentJoinMapHash: parserReplay?.rrp.resolvedJoinMap.resolvedContentJoinMapHash ?? null,
      joinablePairWeeks: parserReplay?.rrp.resolvedJoinMap.rowCount ?? null,
      rrpWeeklyRows: parserReplay?.rrp.weeklySnapshots ?? null,
      rrpMissingRows: parserReplay?.rrp.missingRows ?? null,
      rrpStaleRows: parserReplay?.rrp.staleRows ?? null,
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
    },
    negativeTests,
    parents: {
      rate: rateProof,
      cpi: cpiProof,
    },
    byteArchive: {
      archivedPayloadHashesAvailable: archiveByHash.size,
      referencedArtifactPayloadHashes: new Set(allArtifacts.map((artifact) => artifact.raw_payload_sha256)).size,
      archiveLocationIdentity:
        "postgres:research_macro_source_artifact_byte_archives/raw_payload_sha256",
    },
    rrpTarget: {
      dataset: RRP_DATASET,
      expectedResolvedContentJoinMapHash: EXPECTED_RRP_CONTENT_JOIN_MAP_HASH,
    },
    parserReplay,
    requiredRepairIfFailed: rawArchiveComplete ? [] : [
      "Archive exact raw bytes for every hash-only parent source artifact without changing the current canonical dataset content identity.",
      "Verify archived bytes reproduce the recorded raw_payload_sha256 and raw_payload_size_bytes before parser replay.",
      "Rerun parser replay with networkAccessUsed=false and without stored normalized observations, availability events, weekly snapshots, or derived RRP rows as inputs.",
    ],
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
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-raw-artifact-parser-replay-${stamp}.json`),
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

  console.log(`Gate 50 raw artifact parser replay: ${reportBase.summary.status}`);
  console.log(`Raw artifact archive completeness: ${reportBase.summary.rawArtifactArchiveCompletenessStatus}`);
  console.log(`Parser replay status: ${reportBase.summary.parserReplayStatus}`);
  console.log(`Overall promotion rebuild: ${reportBase.summary.overallPromotionRebuildStatus}`);
  console.log(`Expected resolved content join-map hash: ${EXPECTED_RRP_CONTENT_JOIN_MAP_HASH}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (Object.keys(blockers).length > 0) {
    console.log(`Blockers: ${Object.entries(blockers).map(([key, count]) => `${key}:${count}`).join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[macro-raw-artifact-parser-replay] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch {
      // Pool may be unopened if validation fails before the first query.
    }
  });
