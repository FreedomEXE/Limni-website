import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { ensureMacroRegimeWarehouseSchema } from "../../src/lib/research/macroRegimeDataset";

loadEnvConfig(process.cwd());
process.env.DB_QUERY_RETRY_LIMIT = process.env.DB_QUERY_RETRY_LIMIT ?? "2";

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const TARGET = {
  artifactId: "488367a846761e11e31779cbe93817a52f0749ae69b2fd721fbb06b67340d345",
  sourceContractId: "cpi_chf_fso_lik25b25_total_dec2025_100_v1",
  sourceFamily: "inflation",
  currency: "CHF",
  endpointId: "swiss_fso_lik25b25_xlsx_master",
  datasetId: "37b4081b-880e-4ae6-8d53-20ba900dff07",
  datasetHash: "0817b0ec5b4c03c2d01ddc5c014601a2b7028c78203d07f95b3393235c70cc17",
  expectedSha256: "4e6ee83f40ab85db7f3e44ff7ab0c2f136945df1242daecf898afa4cc6949cda",
  expectedSize: 5_561_298,
  expectedContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

type JsonRecord = Record<string, unknown>;
type QueryFn = <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>;
type GetPoolFn = () => { end: () => Promise<void> };

let queryImpl: QueryFn | null = null;
let getPoolImpl: GetPoolFn | null = null;

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
  raw_payload_text_is_null: boolean;
  coverage: unknown;
  flags: unknown;
};

type ArchiveRow = {
  raw_payload_sha256: string;
  raw_payload_size_bytes: number;
  raw_content_type: string | null;
  archive_origin: string;
  archive_written_at_utc: string;
  original_artifact_record_mutated: boolean;
  coverage: unknown;
  flags: unknown;
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

function sha256Bytes(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function readTargetArtifact() {
  const rows = await query<ArtifactRow>(
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
        raw_payload_text IS NULL AS raw_payload_text_is_null,
        coverage,
        flags
      FROM research_macro_source_artifacts
      WHERE regime_dataset_id = $1::uuid
        AND artifact_id = $2
      LIMIT 1
    `,
    [TARGET.datasetId, TARGET.artifactId],
  );
  return rows[0] ?? null;
}

async function writeByteArchive(options: {
  bytes: Buffer;
  recoveryMethod: string;
  recoveredFrom: string;
  networkUsedForRecovery: boolean;
}) {
  await query(
    `
      INSERT INTO research_macro_source_artifact_byte_archives (
        raw_payload_sha256,
        raw_payload_size_bytes,
        raw_content_type,
        raw_payload_base64,
        archive_origin,
        original_artifact_record_mutated,
        coverage,
        flags
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'manual_recovered_exact_payload_v1',
        FALSE,
        $5::jsonb,
        $6::jsonb
      )
      ON CONFLICT (raw_payload_sha256) DO NOTHING
    `,
    [
      TARGET.expectedSha256,
      TARGET.expectedSize,
      TARGET.expectedContentType,
      options.bytes.toString("base64"),
      JSON.stringify({
        artifactId: TARGET.artifactId,
        sourceContractId: TARGET.sourceContractId,
        datasetId: TARGET.datasetId,
        recoveryMethod: options.recoveryMethod,
        recoveredFrom: options.recoveredFrom,
        networkUsedForRecovery: options.networkUsedForRecovery,
      }),
      JSON.stringify({
        diagnosticOnly: true,
        originalArtifactRecordMutated: false,
        exactPreExistingHashRecovered: true,
      }),
    ],
  );
  const rows = await query<ArchiveRow>(
    `
      SELECT
        raw_payload_sha256,
        raw_payload_size_bytes,
        raw_content_type,
        archive_origin,
        to_char(archive_written_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS archive_written_at_utc,
        original_artifact_record_mutated,
        coverage,
        flags
      FROM research_macro_source_artifact_byte_archives
      WHERE raw_payload_sha256 = $1
      LIMIT 1
    `,
    [TARGET.expectedSha256],
  );
  return rows[0] ?? null;
}

function buildMarkdown(report: JsonRecord) {
  const summary = report.summary as JsonRecord;
  return [
    "# Gate 50 Artifact Byte Archive Repair Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Artifact ID: ${summary.artifactId}`,
    `- Source contract ID: ${summary.sourceContractId}`,
    `- Recovery method: ${summary.recoveryMethod}`,
    `- Expected SHA-256: ${summary.expectedSha256}`,
    `- Actual SHA-256: ${summary.actualSha256}`,
    `- Expected size: ${summary.expectedSize}`,
    `- Actual size: ${summary.actualSize}`,
    `- Byte identity pass: ${summary.byteIdentityPass}`,
    `- Original artifact record mutated: ${summary.originalArtifactRecordMutated}`,
    `- Network used for recovery: ${summary.networkUsedForRecovery}`,
    `- Archive location identity: ${summary.archiveLocationIdentity}`,
    "",
    "This repair archives exact recovered bytes for a pre-existing artifact hash. It does not rewrite the original artifact record, activate snapshots, compute P&L, or make strategy decisions.",
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for artifact byte archive repair.");
  }
  const input = argValue("input");
  if (!input) {
    throw new Error("Provide --input=<path-to-recovered-payload>.");
  }

  await ensureMacroRegimeWarehouseSchema();
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const inputPath = path.resolve(process.cwd(), input);
  const recoveryMethod = argValue("recovery-method") ?? "existing_local_download_or_temp_cache";
  const networkUsedForRecovery = argValue("network-used") === "true";
  const bytes = await readFile(inputPath);
  const actualSha256 = sha256Bytes(bytes);
  const actualSize = bytes.byteLength;
  const byteIdentityPass = actualSha256 === TARGET.expectedSha256 && actualSize === TARGET.expectedSize;
  const artifactBefore = await readTargetArtifact();

  if (!artifactBefore) {
    throw new Error(`Target artifact was not found: ${TARGET.artifactId}`);
  }
  if (!byteIdentityPass) {
    throw new Error(
      `Recovered payload identity mismatch: expected ${TARGET.expectedSha256}/${TARGET.expectedSize}, got ${actualSha256}/${actualSize}`,
    );
  }
  if (artifactBefore.raw_payload_sha256 !== TARGET.expectedSha256) {
    throw new Error("Target artifact hash does not match expected recovered hash.");
  }
  if (artifactBefore.raw_payload_size_bytes !== TARGET.expectedSize) {
    throw new Error("Target artifact size does not match expected recovered size.");
  }

  const archive = await writeByteArchive({
    bytes,
    recoveryMethod,
    recoveredFrom: inputPath,
    networkUsedForRecovery,
  });
  if (!archive) {
    throw new Error("Artifact byte archive write did not produce a readable archive row.");
  }
  const artifactAfter = await readTargetArtifact();
  const originalArtifactRecordMutated = hashPayload(artifactBefore) !== hashPayload(artifactAfter);
  const archiveLocationIdentity =
    `postgres:research_macro_source_artifact_byte_archives/raw_payload_sha256=${TARGET.expectedSha256}`;

  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose:
      "Exact raw-byte recovery and immutable archive binding for the current CHF Swiss FSO CPI source artifact.",
    summary: {
      status: !originalArtifactRecordMutated ? "PASS_ARTIFACT_BYTE_ARCHIVE_REPAIR" : "FAIL_ORIGINAL_ARTIFACT_RECORD_MUTATED",
      artifactId: TARGET.artifactId,
      sourceContractId: TARGET.sourceContractId,
      recoveryMethod,
      recoveredFrom: inputPath,
      expectedSha256: TARGET.expectedSha256,
      actualSha256,
      expectedSize: TARGET.expectedSize,
      actualSize,
      byteIdentityPass,
      archiveWrittenAtUtc: archive.archive_written_at_utc,
      archiveLocationIdentity,
      originalArtifactRecordMutated,
      originalArtifactRawPayloadTextStillNull: artifactAfter?.raw_payload_text_is_null === true,
      networkUsedForRecovery,
      diagnosticOnly: true,
      promotionEligible: false,
      activationEligible: false,
      outcomeConsumable: false,
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
    },
    target: TARGET,
    artifactBefore,
    artifactAfter,
    archive: {
      ...archive,
      archiveLocationIdentity,
    },
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
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-artifact-byte-archive-repair-${stamp}.json`),
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

  console.log(`Gate 50 artifact byte archive repair: ${reportBase.summary.status}`);
  console.log(`Byte identity pass: ${byteIdentityPass}`);
  console.log(`Original artifact record mutated: ${originalArtifactRecordMutated}`);
  console.log(`Network used for recovery: ${networkUsedForRecovery}`);
  console.log(`Archive location identity: ${archiveLocationIdentity}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (originalArtifactRecordMutated) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[macro-artifact-byte-archive-repair] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch {
      // Pool may be unopened if validation fails before the first query.
    }
  });
