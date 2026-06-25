import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { PAIRS_BY_ASSET_CLASS } from "../../src/lib/cotPairs";

loadEnvConfig(process.cwd());
process.env.DB_QUERY_RETRY_LIMIT = process.env.DB_QUERY_RETRY_LIMIT ?? "2";

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const GATE44_MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const GATE44_MATRIX_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
const EXPECTED_RRP_CONTENT_JOIN_MAP_HASH =
  "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";

const RATE_PARENT = {
  role: "rate",
  datasetId: "dcdc850a-80a2-4178-8d08-dd759be6afb8",
  datasetHash: "3db4b84238dbf5c656a9ebaf2ff73219cc1efd2a6e1ff70842983945c4d23612",
  familyManifestId: "rate_3m_market_family_v1",
  familyManifestHash: "5e75faaadd2d7e19bdf6591df782b772fe10c7b8268713c0f892984867c421b2",
  expectedArtifacts: 40,
  expectedObservations: 2_886,
  expectedAvailabilityEvents: 2_886,
  expectedWeeklyRows: 2_976,
  expectedWeeklyManifests: 372,
};

const CPI_PARENT = {
  role: "cpi",
  datasetId: "37b4081b-880e-4ae6-8d53-20ba900dff07",
  datasetHash: "0817b0ec5b4c03c2d01ddc5c014601a2b7028c78203d07f95b3393235c70cc17",
  familyManifestId: "cpi_all_items_family_v1",
  familyManifestHash: "b0e7f90e8abd7295e9886dec1c384b4ecc048c40eb3fce2feb52cebb58332beb",
  expectedArtifacts: 10,
  expectedObservations: 2_268,
  expectedAvailabilityEvents: 2_268,
  expectedWeeklyRows: 2_976,
  expectedWeeklyManifests: 372,
};

const RRP_DATASET = {
  datasetId: "220fd5fd-d017-4db2-bdde-524a3c664c72",
  datasetHash: "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742",
  familyManifestId: "real_rate_pressure_attribution_v1",
  expectedWeeklyRows: 2_976,
  expectedWeeklyManifests: 372,
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
type QueryFn = <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>;
type GetPoolFn = () => { end: () => Promise<void> };

let queryImpl: QueryFn | null = null;
let getPoolImpl: GetPoolFn | null = null;

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

type DatasetIdentity = typeof RATE_PARENT | typeof CPI_PARENT;

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
  reconstruction_mode: string | null;
  revoked_at_utc: string | null;
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
  raw_payload_sha256: string;
  raw_payload_size_bytes: number;
  raw_payload_text: string | null;
  coverage: unknown;
  flags: unknown;
};

type ObservationRow = {
  source_family: string;
  source_id: string;
  currency: string;
  instrument: string;
  source_observation_id: string;
  observation_date: string;
  effective_at_utc: string;
  available_at_utc: string;
  source_url: string;
  source_hash: string | null;
  raw_value_json: unknown;
  normalized_value_json: unknown;
  coverage: unknown;
  flags: unknown;
};

type AvailabilityEventRow = {
  availability_event_id: string;
  source_family: string;
  source_id: string;
  currency: string;
  instrument: string;
  observation_date: string;
  release_or_vintage_id: string | null;
  public_release_at_utc: string | null;
  endpoint_available_at_utc: string;
  availability_date: string | null;
  availability_basis: string;
  retrieval_capability: string;
  availability_precision: string;
  eligibility_policy: string;
  availability_timezone: string;
  availability_evidence_artifact_id: string | null;
  availability_rule_version: string;
  availability_confidence: string;
  promotion_eligible_availability_bases: unknown;
  minimum_availability_confidence: string | null;
  exception_calendar_version: string | null;
  eligibility_calendar_version: string | null;
  eligible_from_week_open_utc: string | null;
  exception_or_delay_flag: boolean;
  coverage: unknown;
  flags: unknown;
};

type WeeklySnapshotRow = {
  week_open_utc: string;
  snapshot_id: string | null;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
  macro_week_id: string | null;
  freeze_version: string | null;
  snapshot_hash: string | null;
  snapshot_state: string;
  source_family: string;
  source_id: string;
  currency: string;
  instrument: string;
  as_of_utc: string;
  source_observation_date: string | null;
  effective_at_utc: string | null;
  available_at_utc: string | null;
  raw_value_json: unknown;
  normalized_value_json: unknown;
  coverage: unknown;
  flags: unknown;
};

type WeeklyManifestRow = {
  promotion_manifest_id: string;
  contract_manifest_hash: string;
  macro_week_id: string;
  freeze_version: string;
  snapshot_id: string;
  snapshot_hash: string;
  snapshot_state: string;
  row_snapshot_count: number;
  coverage: unknown;
  flags: unknown;
};

type MatrixContextRow = {
  week_open_utc: string;
  symbol: string;
};

const FX_PAIR_DEFINITIONS = PAIRS_BY_ASSET_CLASS.fx.map((row) => ({
  pair: row.pair.toUpperCase(),
  base: row.base.toUpperCase(),
  quote: row.quote.toUpperCase(),
}));
const PAIR_BY_SYMBOL = new Map(FX_PAIR_DEFINITIONS.map((row) => [row.pair, row]));

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

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))].sort();
}

function isoUtc(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return "";
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (parsed.isValid) return parsed.toUTC().toISO({ suppressMilliseconds: false }) ?? value;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? value : fallback.toISOString();
}

function macroWeekIdFor(weekOpenUtc: string) {
  return `macro_week_${isoUtc(weekOpenUtc).slice(0, 10)}`;
}

function snapshotKey(row: Pick<WeeklySnapshotRow, "source_family" | "source_id" | "instrument">) {
  return `${row.source_family}|${row.source_id}|${row.instrument}`;
}

function collectStringsByKey(value: unknown, predicate: (key: string) => boolean): string[] {
  const result: string[] = [];
  function visit(inner: unknown, keyHint: string) {
    if (typeof inner === "string") {
      if (predicate(keyHint)) result.push(inner);
      return;
    }
    if (Array.isArray(inner)) {
      for (const item of inner) visit(item, keyHint);
      return;
    }
    if (!inner || typeof inner !== "object") return;
    for (const [key, nested] of Object.entries(inner as JsonRecord)) {
      visit(nested, key);
    }
  }
  visit(value, "");
  return uniqueSorted(result);
}

function artifactRefsFrom(...values: unknown[]) {
  return uniqueSorted(values.flatMap((value) =>
    collectStringsByKey(value, (key) => key.toLowerCase().includes("artifactid")),
  ));
}

function availabilityEventRefsFrom(...values: unknown[]) {
  return uniqueSorted(values.flatMap((value) =>
    collectStringsByKey(value, (key) => key.toLowerCase().includes("availabilityeventid")),
  ));
}

function selectedAvailabilityEventRefs(row: WeeklySnapshotRow) {
  const coverage = asRecord(row.coverage);
  const flags = asRecord(row.flags);
  return uniqueSorted([
    ...stringArray(coverage.selectedAvailabilityEventId),
    ...stringArray(coverage.availabilityEventId),
    ...stringArray(flags.selectedAvailabilityEventId),
    ...stringArray(flags.availabilityEventId),
  ]);
}

function availabilityEventIdsForJoin(row: WeeklySnapshotRow) {
  const coverage = asRecord(row.coverage);
  const flags = asRecord(row.flags);
  return [
    ...stringArray(coverage.availabilityEventId),
    ...stringArray(coverage.availabilityEventIds),
    ...stringArray(coverage.selectedAvailabilityEventId),
    ...stringArray(coverage.selectedAvailabilityEventIds),
    ...stringArray(coverage.parentAvailabilityEventIds),
    ...stringArray(flags.availabilityEventId),
    ...stringArray(flags.availabilityEventIds),
  ].sort();
}

function blockerCounts(blockers: string[]) {
  return blockers.reduce<Record<string, number>>((counts, blocker) => {
    counts[blocker] = (counts[blocker] ?? 0) + 1;
    return counts;
  }, {});
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
        reconstruction_mode,
        revoked_at_utc::text,
        source_versions,
        coverage
      FROM research_macro_regime_datasets
      WHERE regime_dataset_id = $1::uuid
        AND dataset_hash = $2
      LIMIT 1
    `,
    [datasetId, datasetHash],
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

async function readObservations(datasetId: string) {
  return query<ObservationRow>(
    `
      SELECT
        source_family,
        source_id,
        currency,
        instrument,
        source_observation_id,
        observation_date::text,
        to_char(effective_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS effective_at_utc,
        to_char(available_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS available_at_utc,
        source_url,
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
}

async function readAvailabilityEvents(datasetId: string) {
  return query<AvailabilityEventRow>(
    `
      SELECT
        availability_event_id,
        source_family,
        source_id,
        currency,
        instrument,
        observation_date::text,
        release_or_vintage_id,
        CASE WHEN public_release_at_utc IS NULL THEN NULL ELSE to_char(public_release_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS public_release_at_utc,
        to_char(endpoint_available_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS endpoint_available_at_utc,
        availability_date::text,
        availability_basis,
        retrieval_capability,
        availability_precision,
        eligibility_policy,
        availability_timezone,
        availability_evidence_artifact_id,
        availability_rule_version,
        availability_confidence,
        promotion_eligible_availability_bases,
        minimum_availability_confidence,
        exception_calendar_version,
        eligibility_calendar_version,
        CASE WHEN eligible_from_week_open_utc IS NULL THEN NULL ELSE to_char(eligible_from_week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS eligible_from_week_open_utc,
        exception_or_delay_flag,
        coverage,
        flags
      FROM research_macro_availability_events
      WHERE regime_dataset_id = $1::uuid
      ORDER BY source_family, source_id, currency, instrument, observation_date, availability_event_id
    `,
    [datasetId],
  );
}

async function readWeeklySnapshots(datasetId: string) {
  return query<WeeklySnapshotRow>(
    `
      SELECT
        to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc,
        snapshot_id,
        promotion_manifest_id,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        snapshot_hash,
        snapshot_state,
        source_family,
        source_id,
        currency,
        instrument,
        to_char(as_of_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS as_of_utc,
        source_observation_date::text,
        CASE WHEN effective_at_utc IS NULL THEN NULL ELSE to_char(effective_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS effective_at_utc,
        CASE WHEN available_at_utc IS NULL THEN NULL ELSE to_char(available_at_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS available_at_utc,
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
}

async function readWeeklyManifests(datasetId: string) {
  return query<WeeklyManifestRow>(
    `
      SELECT
        promotion_manifest_id,
        contract_manifest_hash,
        macro_week_id,
        freeze_version,
        snapshot_id,
        snapshot_hash,
        snapshot_state,
        row_snapshot_count,
        coverage,
        flags
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

function artifactProof(rows: ArtifactRow[]) {
  const rawPayloadShaMismatches = rows.filter((row) =>
    row.raw_payload_text !== null && sha256Text(row.raw_payload_text) !== row.raw_payload_sha256,
  ).length;
  const rawPayloadSizeMismatches = rows.filter((row) =>
    row.raw_payload_text !== null && Buffer.byteLength(row.raw_payload_text, "utf8") !== row.raw_payload_size_bytes,
  ).length;
  const artifactIdMismatches = rows.filter((row) =>
    hashJson({
      endpointId: row.endpoint_id,
      endpointUrl: row.endpoint_url,
      httpStatus: row.http_status,
      rawPayloadSha256: row.raw_payload_sha256,
    }) !== row.artifact_id,
  ).length;
  return {
    count: rows.length,
    textPayloadRows: rows.filter((row) => row.raw_payload_text !== null).length,
    binaryHashOnlyRows: rows.filter((row) => row.raw_payload_text === null).length,
    rawPayloadShaMismatches,
    rawPayloadSizeMismatches,
    artifactIdMismatches,
    payloadSetHash: hashPayload(rows.map((row) => ({
      artifactId: row.artifact_id,
      rawPayloadSha256: row.raw_payload_sha256,
      rawPayloadSizeBytes: row.raw_payload_size_bytes,
    }))),
    artifactContentHash: hashPayload(rows.map((row) => ({
      artifactId: row.artifact_id,
      sourceFamily: row.source_family,
      sourceId: row.source_id,
      currency: row.currency,
      endpointId: row.endpoint_id,
      endpointUrl: row.endpoint_url,
      httpStatus: row.http_status,
      rawPayloadSha256: row.raw_payload_sha256,
      rawPayloadSizeBytes: row.raw_payload_size_bytes,
      coverage: row.coverage,
      flags: row.flags,
    }))),
  };
}

function observationProof(rows: ObservationRow[], artifactIds: Set<string>, eventIds: Set<string>) {
  const missingArtifactLineage = rows.filter((row) =>
    artifactRefsFrom(row.coverage, row.flags, row.raw_value_json).length === 0,
  ).length;
  const unknownArtifactRefs = rows.flatMap((row) =>
    artifactRefsFrom(row.coverage, row.flags, row.raw_value_json).filter((artifactId) => !artifactIds.has(artifactId)),
  );
  const selectedEventRefs = rows.flatMap((row) => uniqueSorted([
    ...stringArray(asRecord(row.coverage).availabilityEventId),
    ...stringArray(asRecord(row.flags).availabilityEventId),
  ]));
  const unknownSelectedEventRefs = selectedEventRefs.filter((eventId) => !eventIds.has(eventId));
  return {
    count: rows.length,
    missingArtifactLineage,
    unknownArtifactRefs: unknownArtifactRefs.length,
    selectedAvailabilityEventRefs: selectedEventRefs.length,
    unknownSelectedAvailabilityEventRefs: unknownSelectedEventRefs.length,
    normalizedObservationContentHash: hashPayload(rows.map((row) => ({
      sourceFamily: row.source_family,
      sourceId: row.source_id,
      currency: row.currency,
      instrument: row.instrument,
      sourceObservationId: row.source_observation_id,
      observationDate: row.observation_date,
      normalizedValue: row.normalized_value_json,
      artifactRefs: artifactRefsFrom(row.coverage, row.flags, row.raw_value_json),
      selectedAvailabilityEventRefs: uniqueSorted([
        ...stringArray(asRecord(row.coverage).availabilityEventId),
        ...stringArray(asRecord(row.flags).availabilityEventId),
      ]),
    }))),
    observationContentHash: hashPayload(rows.map((row) => ({
      sourceFamily: row.source_family,
      sourceId: row.source_id,
      currency: row.currency,
      instrument: row.instrument,
      sourceObservationId: row.source_observation_id,
      observationDate: row.observation_date,
      effectiveAtUtc: row.effective_at_utc,
      availableAtUtc: row.available_at_utc,
      sourceUrl: row.source_url,
      sourceHash: row.source_hash,
      rawValue: row.raw_value_json,
      normalizedValue: row.normalized_value_json,
      coverage: row.coverage,
      flags: row.flags,
    }))),
  };
}

function availabilityProof(rows: AvailabilityEventRow[], artifactIds: Set<string>) {
  const missingEvidenceArtifact = rows.filter((row) => !row.availability_evidence_artifact_id).length;
  const unknownEvidenceArtifact = rows.filter((row) =>
    row.availability_evidence_artifact_id && !artifactIds.has(row.availability_evidence_artifact_id),
  ).length;
  return {
    count: rows.length,
    missingEvidenceArtifact,
    unknownEvidenceArtifact,
    availabilityEventContentHash: hashPayload(rows.map((row) => ({
      availabilityEventId: row.availability_event_id,
      sourceFamily: row.source_family,
      sourceId: row.source_id,
      currency: row.currency,
      instrument: row.instrument,
      observationDate: row.observation_date,
      releaseOrVintageId: row.release_or_vintage_id,
      publicReleaseAtUtc: row.public_release_at_utc,
      endpointAvailableAtUtc: row.endpoint_available_at_utc,
      availabilityDate: row.availability_date,
      availabilityBasis: row.availability_basis,
      retrievalCapability: row.retrieval_capability,
      availabilityPrecision: row.availability_precision,
      eligibilityPolicy: row.eligibility_policy,
      availabilityTimezone: row.availability_timezone,
      availabilityEvidenceArtifactId: row.availability_evidence_artifact_id,
      availabilityRuleVersion: row.availability_rule_version,
      availabilityConfidence: row.availability_confidence,
      promotionEligibleAvailabilityBases: row.promotion_eligible_availability_bases,
      minimumAvailabilityConfidence: row.minimum_availability_confidence,
      exceptionCalendarVersion: row.exception_calendar_version,
      eligibilityCalendarVersion: row.eligibility_calendar_version,
      eligibleFromWeekOpenUtc: row.eligible_from_week_open_utc,
      exceptionOrDelayFlag: row.exception_or_delay_flag,
      coverage: row.coverage,
      flags: row.flags,
    }))),
  };
}

function weeklySnapshotProof(rows: WeeklySnapshotRow[], artifactIds: Set<string>, eventIds: Set<string>) {
  const missingRows = rows.filter((row) => asRecord(row.coverage).valueAvailable !== true).length;
  const staleRows = rows.filter((row) => asRecord(row.coverage).isStale === true).length;
  const missingSnapshotHash = rows.filter((row) => !row.snapshot_hash).length;
  const missingSnapshotId = rows.filter((row) => !row.snapshot_id).length;
  const missingSelectedAvailabilityEvent = rows.filter((row) => selectedAvailabilityEventRefs(row).length === 0).length;
  const unknownSelectedAvailabilityEventRefs = rows.flatMap((row) =>
    selectedAvailabilityEventRefs(row).filter((eventId) => !eventIds.has(eventId)),
  ).length;
  const missingArtifactLineage = rows.filter((row) =>
    artifactRefsFrom(row.coverage, row.flags, row.raw_value_json).length === 0,
  ).length;
  const unknownArtifactRefs = rows.flatMap((row) =>
    artifactRefsFrom(row.coverage, row.flags, row.raw_value_json).filter((artifactId) => !artifactIds.has(artifactId)),
  ).length;
  const currencyBundleHashes = [...new Set(rows
    .map((row) => asRecord(row.coverage).currencyBundleHash)
    .filter((value): value is string => typeof value === "string"))]
    .sort();
  return {
    count: rows.length,
    availableRows: rows.length - missingRows,
    missingRows,
    staleRows,
    missingSnapshotHash,
    missingSnapshotId,
    missingSelectedAvailabilityEvent,
    unknownSelectedAvailabilityEventRefs,
    missingArtifactLineage,
    unknownArtifactRefs,
    weeklySnapshotHashSetHash: hashPayload(rows.map((row) => row.snapshot_hash)),
    weeklySnapshotContentHash: hashPayload(rows.map((row) => ({
      weekOpenUtc: row.week_open_utc,
      snapshotId: row.snapshot_id,
      promotionManifestId: row.promotion_manifest_id,
      contractManifestHash: row.contract_manifest_hash,
      macroWeekId: row.macro_week_id,
      freezeVersion: row.freeze_version,
      snapshotHash: row.snapshot_hash,
      snapshotState: row.snapshot_state,
      sourceFamily: row.source_family,
      sourceId: row.source_id,
      currency: row.currency,
      instrument: row.instrument,
      asOfUtc: row.as_of_utc,
      sourceObservationDate: row.source_observation_date,
      effectiveAtUtc: row.effective_at_utc,
      availableAtUtc: row.available_at_utc,
      rawValue: row.raw_value_json,
      normalizedValue: row.normalized_value_json,
      coverage: row.coverage,
      flags: row.flags,
    }))),
    currencyBundleHashes,
  };
}

function weeklyManifestProof(rows: WeeklyManifestRow[]) {
  const missingSnapshotHash = rows.filter((row) => !row.snapshot_hash).length;
  const rowSnapshotCountMismatches = rows.filter((row) => {
    const rowHashes = asRecord(row.coverage).rowSnapshotHashes;
    return Array.isArray(rowHashes) && rowHashes.length !== row.row_snapshot_count;
  }).length;
  return {
    count: rows.length,
    activeRows: rows.filter((row) => row.snapshot_state === "ACTIVE").length,
    sealedRows: rows.filter((row) => row.snapshot_state === "SEALED").length,
    revokedOrQuarantinedRows: rows.filter((row) => row.snapshot_state === "REVOKED" || row.snapshot_state === "QUARANTINED").length,
    missingSnapshotHash,
    rowSnapshotCountMismatches,
    weeklyManifestHashSetHash: hashPayload(rows.map((row) => row.snapshot_hash)),
    weeklyManifestContentHash: hashPayload(rows.map((row) => ({
      promotionManifestId: row.promotion_manifest_id,
      contractManifestHash: row.contract_manifest_hash,
      macroWeekId: row.macro_week_id,
      freezeVersion: row.freeze_version,
      snapshotId: row.snapshot_id,
      snapshotHash: row.snapshot_hash,
      snapshotState: row.snapshot_state,
      rowSnapshotCount: row.row_snapshot_count,
      coverage: row.coverage,
      flags: row.flags,
    }))),
  };
}

function datasetContractHashes(dataset: DatasetRow | null) {
  const sourceVersions = asRecord(dataset?.source_versions);
  const sourceRegistry = asRecord(sourceVersions.sourceRegistry);
  return {
    sourceVersionsHash: hashPayload(sourceVersions),
    sourceRegistryHash: hashPayload(sourceRegistry),
    sourceMapHash: hashPayload(sourceRegistry.entries ?? null),
    availabilityRulesHash: hashPayload({
      fourClockModel: sourceVersions.fourClockModel ?? null,
      endpointAvailabilityDimensions: sourceVersions.endpointAvailabilityDimensions ?? null,
    }),
    stalenessRulesHash: hashPayload({
      sourceHardening: sourceVersions.sourceHardening ?? null,
      realRatePressure: sourceVersions.realRatePressure ?? null,
    }),
    promotionManifestSourceVersionHash: hashPayload(sourceVersions.promotionManifest ?? null),
  };
}

async function buildParentProof(identity: DatasetIdentity) {
  const dataset = await readDataset(identity.datasetId, identity.datasetHash);
  const artifacts = await readArtifacts(identity.datasetId);
  const artifactIds = new Set(artifacts.map((row) => row.artifact_id));
  const observations = await readObservations(identity.datasetId);
  const events = await readAvailabilityEvents(identity.datasetId);
  const eventIds = new Set(events.map((row) => row.availability_event_id));
  const snapshots = await readWeeklySnapshots(identity.datasetId);
  const manifests = await readWeeklyManifests(identity.datasetId);

  const artifact = artifactProof(artifacts);
  const observation = observationProof(observations, artifactIds, eventIds);
  const availability = availabilityProof(events, artifactIds);
  const weeklySnapshot = weeklySnapshotProof(snapshots, artifactIds, eventIds);
  const weeklyManifest = weeklyManifestProof(manifests);
  const blockers = [
    !dataset ? `${identity.role}_dataset_missing` : null,
    dataset && dataset.status !== "complete" ? `${identity.role}_dataset_not_complete` : null,
    dataset && dataset.snapshot_state !== "SEALED" ? `${identity.role}_dataset_not_sealed` : null,
    dataset && dataset.revoked_at_utc !== null ? `${identity.role}_dataset_revoked` : null,
    artifacts.length !== identity.expectedArtifacts ? `${identity.role}_artifact_count_mismatch` : null,
    artifact.rawPayloadShaMismatches > 0 ? `${identity.role}_raw_payload_sha_mismatch` : null,
    artifact.rawPayloadSizeMismatches > 0 ? `${identity.role}_raw_payload_size_mismatch` : null,
    artifact.artifactIdMismatches > 0 ? `${identity.role}_artifact_id_mismatch` : null,
    observations.length !== identity.expectedObservations ? `${identity.role}_observation_count_mismatch` : null,
    observation.missingArtifactLineage > 0 ? `${identity.role}_observation_missing_artifact_lineage` : null,
    observation.unknownArtifactRefs > 0 ? `${identity.role}_observation_unknown_artifact_ref` : null,
    observation.unknownSelectedAvailabilityEventRefs > 0 ? `${identity.role}_observation_unknown_selected_availability_event` : null,
    events.length !== identity.expectedAvailabilityEvents ? `${identity.role}_availability_event_count_mismatch` : null,
    availability.missingEvidenceArtifact > 0 ? `${identity.role}_availability_missing_evidence_artifact` : null,
    availability.unknownEvidenceArtifact > 0 ? `${identity.role}_availability_unknown_evidence_artifact` : null,
    snapshots.length !== identity.expectedWeeklyRows ? `${identity.role}_weekly_snapshot_count_mismatch` : null,
    weeklySnapshot.missingRows > 0 ? `${identity.role}_weekly_missing_rows` : null,
    weeklySnapshot.staleRows > 0 ? `${identity.role}_weekly_stale_rows` : null,
    weeklySnapshot.missingSnapshotHash > 0 ? `${identity.role}_weekly_missing_snapshot_hash` : null,
    weeklySnapshot.missingSnapshotId > 0 ? `${identity.role}_weekly_missing_snapshot_id` : null,
    weeklySnapshot.missingSelectedAvailabilityEvent > 0 ? `${identity.role}_weekly_missing_selected_availability_event` : null,
    weeklySnapshot.unknownSelectedAvailabilityEventRefs > 0 ? `${identity.role}_weekly_unknown_selected_availability_event` : null,
    weeklySnapshot.missingArtifactLineage > 0 ? `${identity.role}_weekly_missing_artifact_lineage` : null,
    weeklySnapshot.unknownArtifactRefs > 0 ? `${identity.role}_weekly_unknown_artifact_ref` : null,
    manifests.length !== identity.expectedWeeklyManifests ? `${identity.role}_manifest_count_mismatch` : null,
    weeklyManifest.activeRows > 0 ? `${identity.role}_unexpected_active_manifest` : null,
    weeklyManifest.revokedOrQuarantinedRows > 0 ? `${identity.role}_revoked_or_quarantined_manifest` : null,
    weeklyManifest.missingSnapshotHash > 0 ? `${identity.role}_manifest_missing_snapshot_hash` : null,
    weeklyManifest.rowSnapshotCountMismatches > 0 ? `${identity.role}_manifest_row_count_mismatch` : null,
  ].filter((blocker): blocker is string => Boolean(blocker));

  return {
    role: identity.role,
    status: blockers.length === 0 ? "PASS_DETERMINISTIC_PARENT_CONTENT" : "FAIL",
    identity,
    dataset,
    contractHashes: datasetContractHashes(dataset),
    familyManifest: {
      familyManifestId: identity.familyManifestId,
      familyManifestHash: identity.familyManifestHash,
    },
    artifact,
    observation,
    availability,
    weeklySnapshot,
    weeklyManifest,
    blockers,
    _sets: {
      artifactIds,
      eventIds,
      snapshots,
    },
  };
}

function rrpLineageProof(
  rrpSnapshots: WeeklySnapshotRow[],
  rateSnapshots: WeeklySnapshotRow[],
  cpiSnapshots: WeeklySnapshotRow[],
  rateArtifactIds: Set<string>,
  cpiArtifactIds: Set<string>,
) {
  const rateSnapshotById = new Map(rateSnapshots.map((row) => [row.snapshot_id, row]));
  const cpiSnapshotById = new Map(cpiSnapshots.map((row) => [row.snapshot_id, row]));
  const parentArtifactIds = new Set([...rateArtifactIds, ...cpiArtifactIds]);
  let missingParentDatasetIdentity = 0;
  let parentSnapshotIdMissing = 0;
  let parentSnapshotMissing = 0;
  let parentSnapshotHashMismatch = 0;
  let parentArtifactMissing = 0;
  let parentArtifactUnknown = 0;
  let parentEligibilityMismatch = 0;
  let formulaMismatch = 0;
  for (const row of rrpSnapshots) {
    const coverage = asRecord(row.coverage);
    if (
      coverage.rateParentDatasetId !== RATE_PARENT.datasetId ||
      coverage.rateParentDatasetHash !== RATE_PARENT.datasetHash ||
      coverage.cpiParentDatasetId !== CPI_PARENT.datasetId ||
      coverage.cpiParentDatasetHash !== CPI_PARENT.datasetHash
    ) {
      missingParentDatasetIdentity += 1;
    }
    const rateParentSnapshotId = typeof coverage.rateParentSnapshotId === "string" ? coverage.rateParentSnapshotId : null;
    const cpiParentSnapshotId = typeof coverage.cpiParentSnapshotId === "string" ? coverage.cpiParentSnapshotId : null;
    if (!rateParentSnapshotId || !cpiParentSnapshotId) parentSnapshotIdMissing += 1;
    const rateParent = rateParentSnapshotId ? rateSnapshotById.get(rateParentSnapshotId) : null;
    const cpiParent = cpiParentSnapshotId ? cpiSnapshotById.get(cpiParentSnapshotId) : null;
    if (!rateParent || !cpiParent) parentSnapshotMissing += 1;
    if (rateParent && coverage.rateParentSnapshotHash !== rateParent.snapshot_hash) parentSnapshotHashMismatch += 1;
    if (cpiParent && coverage.cpiParentSnapshotHash !== cpiParent.snapshot_hash) parentSnapshotHashMismatch += 1;
    const refs = artifactRefsFrom(row.coverage, row.flags, row.raw_value_json);
    if (refs.length === 0) parentArtifactMissing += 1;
    parentArtifactUnknown += refs.filter((artifactId) => !parentArtifactIds.has(artifactId)).length;
    const parentAvailableAt = uniqueSorted([
      rateParent?.available_at_utc,
      cpiParent?.available_at_utc,
    ]).at(-1) ?? null;
    if (parentAvailableAt && row.available_at_utc !== parentAvailableAt) parentEligibilityMismatch += 1;
    if (coverage.formulaVersion !== "real_rate_pressure_3m_rate_minus_cpi_yoy_v1") formulaMismatch += 1;
  }
  return {
    missingParentDatasetIdentity,
    parentSnapshotIdMissing,
    parentSnapshotMissing,
    parentSnapshotHashMismatch,
    parentArtifactMissing,
    parentArtifactUnknown,
    parentEligibilityMismatch,
    formulaMismatch,
  };
}

function buildResolvedContentJoinMap(matrixContexts: MatrixContextRow[], manifests: WeeklyManifestRow[], snapshots: WeeklySnapshotRow[]) {
  const manifestByWeek = new Map(manifests.map((row) => [row.macro_week_id, row]));
  const snapshotByWeekCurrencyKey = new Map<string, WeeklySnapshotRow>();
  for (const snapshot of snapshots) {
    snapshotByWeekCurrencyKey.set(
      `${snapshot.week_open_utc}|${snapshot.currency.toUpperCase()}|${snapshotKey(snapshot)}`,
      snapshot,
    );
  }
  const expectedKeysByCurrency = new Map<string, Set<string>>();
  for (const snapshot of snapshots) {
    if (snapshot.source_family !== "real_rate_pressure") continue;
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
              snapshotId: snapshot?.snapshot_id ?? null,
              snapshotHash: snapshot?.snapshot_hash ?? null,
              sourceFamily: snapshot?.source_family ?? null,
              sourceId: snapshot?.source_id ?? null,
              instrument: snapshot?.instrument ?? null,
              availableAtUtc: snapshot?.available_at_utc ?? null,
              sourceObservationDate: snapshot?.source_observation_date ?? null,
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
      macroWeeklyManifestId: manifest?.snapshot_id ?? null,
      selectedSnapshots,
    };
  });
  return {
    rowCount: rows.length,
    resolvedContentJoinMapHash: hashPayload(rows),
    sampleRows: rows.slice(0, 3),
  };
}

async function buildRrpProof(
  rateProof: Awaited<ReturnType<typeof buildParentProof>>,
  cpiProof: Awaited<ReturnType<typeof buildParentProof>>,
) {
  const dataset = await readDataset(RRP_DATASET.datasetId, RRP_DATASET.datasetHash);
  const snapshots = await readWeeklySnapshots(RRP_DATASET.datasetId);
  const manifests = await readWeeklyManifests(RRP_DATASET.datasetId);
  const matrixContexts = await readMatrixContexts();
  const weeklySnapshot = weeklySnapshotProof(snapshots, new Set(), new Set());
  const weeklyManifest = weeklyManifestProof(manifests);
  const lineage = rrpLineageProof(
    snapshots,
    rateProof._sets.snapshots,
    cpiProof._sets.snapshots,
    rateProof._sets.artifactIds,
    cpiProof._sets.artifactIds,
  );
  const currencyBundleHashes = Object.fromEntries([...new Set(snapshots.map((row) => row.currency.toUpperCase()))]
    .sort()
    .map((currency) => {
      const hashes = uniqueSorted(snapshots
        .filter((row) => row.currency.toUpperCase() === currency)
        .map((row) => asRecord(row.coverage).currencyBundleHash as string | undefined));
      return [currency, hashes];
    }));
  const currencyBundleMismatches = Object.entries(RRP_DATASET.expectedCurrencyBundles)
    .filter(([currency, expectedHash]) => {
      const hashes = currencyBundleHashes[currency] ?? [];
      return hashes.length !== 1 || hashes[0] !== expectedHash;
    }).length;
  const resolvedJoinMap = buildResolvedContentJoinMap(matrixContexts, manifests, snapshots);
  const missingRows = snapshots.filter((row) => asRecord(row.coverage).valueAvailable !== true).length;
  const staleRows = snapshots.filter((row) => asRecord(row.coverage).isStale === true).length;
  const blockers = [
    !dataset ? "rrp_dataset_missing" : null,
    dataset && dataset.status !== "complete" ? "rrp_dataset_not_complete" : null,
    dataset && dataset.snapshot_state !== "SEALED" ? "rrp_dataset_not_sealed" : null,
    dataset && dataset.revoked_at_utc !== null ? "rrp_dataset_revoked" : null,
    snapshots.length !== RRP_DATASET.expectedWeeklyRows ? "rrp_weekly_snapshot_count_mismatch" : null,
    missingRows > 0 ? "rrp_missing_rows" : null,
    staleRows > 0 ? "rrp_stale_rows" : null,
    manifests.length !== RRP_DATASET.expectedWeeklyManifests ? "rrp_manifest_count_mismatch" : null,
    weeklyManifest.activeRows > 0 ? "rrp_unexpected_active_manifest" : null,
    weeklyManifest.revokedOrQuarantinedRows > 0 ? "rrp_revoked_or_quarantined_manifest" : null,
    lineage.missingParentDatasetIdentity > 0 ? "rrp_parent_dataset_identity_missing_or_mismatch" : null,
    lineage.parentSnapshotIdMissing > 0 ? "rrp_parent_snapshot_id_missing" : null,
    lineage.parentSnapshotMissing > 0 ? "rrp_parent_snapshot_missing" : null,
    lineage.parentSnapshotHashMismatch > 0 ? "rrp_parent_snapshot_hash_mismatch" : null,
    lineage.parentArtifactMissing > 0 ? "rrp_parent_artifact_missing" : null,
    lineage.parentArtifactUnknown > 0 ? "rrp_parent_artifact_unknown" : null,
    lineage.parentEligibilityMismatch > 0 ? "rrp_parent_eligibility_mismatch" : null,
    lineage.formulaMismatch > 0 ? "rrp_formula_mismatch" : null,
    currencyBundleMismatches > 0 ? "rrp_currency_bundle_hash_mismatch" : null,
    resolvedJoinMap.rowCount !== 10_416 ? "rrp_join_map_row_count_mismatch" : null,
    resolvedJoinMap.resolvedContentJoinMapHash !== EXPECTED_RRP_CONTENT_JOIN_MAP_HASH
      ? "rrp_resolved_content_join_map_hash_mismatch"
      : null,
  ].filter((blocker): blocker is string => Boolean(blocker));
  return {
    status: blockers.length === 0 ? "PASS_DETERMINISTIC_RRP_CONTENT" : "FAIL",
    dataset,
    expectedResolvedContentJoinMapHash: EXPECTED_RRP_CONTENT_JOIN_MAP_HASH,
    resolvedJoinMap,
    weeklySnapshot,
    weeklyManifest,
    lineage,
    currencyBundleHashes,
    expectedCurrencyBundleHashes: RRP_DATASET.expectedCurrencyBundles,
    currencyBundleMismatches,
    blockers,
  };
}

function publicParentProof(proof: Awaited<ReturnType<typeof buildParentProof>>) {
  const { _sets, ...rest } = proof;
  return rest;
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const blockers = Object.entries(asRecord(report.blockers))
    .map(([key, value]) => `| ${key} | ${value} |`);
  return [
    "# Gate 50 Deterministic Rebuild Proof Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Rebuild input level: ${summary.rebuildInputLevel}`,
    `- Stored normalized rows used as inputs: ${summary.storedNormalizedRowsUsedAsInputs}`,
    `- Stored weekly snapshots used as inputs: ${summary.storedWeeklySnapshotsUsedAsInputs}`,
    `- Raw archived artifacts reparsed: ${summary.rawArchivedArtifactsReparsed}`,
    `- Comparison target: ${summary.comparisonTarget}`,
    `- Warehouse canonical rebuild status: ${summary.warehouseCanonicalRebuildStatus}`,
    `- Raw artifact parser replay status: ${summary.rawArtifactParserReplayStatus}`,
    `- Overall promotion rebuild status: ${summary.overallPromotionRebuildStatus}`,
    `- Source-artifact-to-parent content proof: ${summary.sourceArtifactToParentRebuildStatus}`,
    `- Parent-to-RRP rebuild: ${summary.parentToRrpRebuildStatus}`,
    `- RRP rows: ${summary.rrpWeeklyRows}`,
    `- RRP stale: ${summary.rrpStaleRows}`,
    `- RRP missing: ${summary.rrpMissingRows}`,
    `- Resolved content join-map hash: ${summary.resolvedContentJoinMapHash}`,
    "",
    "## Blockers",
    "",
    "| Blocker | Count |",
    "|---|---:|",
    ...(blockers.length > 0 ? blockers : ["| - | 0 |"]),
    "",
    "This receipt validates canonical warehouse content and archived artifact payload hashes. It does not independently replay every raw archived artifact through the frozen parsers, so the raw artifact parser replay remains a separate pending proof. It excludes database UUIDs, build timestamps, generated-at timestamps, local paths, and raw receipt file timestamps from canonical rebuild identities. It does not activate snapshots, compute P&L, or make strategy decisions.",
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for deterministic rebuild proof.");
  }
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const rateProof = await buildParentProof(RATE_PARENT);
  const cpiProof = await buildParentProof(CPI_PARENT);
  const rrpProof = await buildRrpProof(rateProof, cpiProof);
  const blockers = blockerCounts([
    ...rateProof.blockers,
    ...cpiProof.blockers,
    ...rrpProof.blockers,
  ]);
  const sourceArtifactToParentPass = rateProof.blockers.length === 0 && cpiProof.blockers.length === 0;
  const parentToRrpPass = rrpProof.blockers.length === 0;
  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose: "Deterministic canonical warehouse-content rebuild proof with archived artifact hash validation; no ACTIVE lifecycle transition or outcome logic.",
    proofScope: {
      rebuildInputLevel: "STORED_CANONICAL_WAREHOUSE_CONTENT_WITH_ARCHIVED_ARTIFACT_HASH_VALIDATION",
      storedNormalizedRowsUsedAsInputs: true,
      storedWeeklySnapshotsUsedAsInputs: true,
      rawArchivedArtifactsReparsed: false,
      comparisonTarget: "STORED_CANONICAL_CONTENT",
      rawArtifactParserReplayStatus: "PENDING",
      interpretation:
        "This proves deterministic canonical content identity and lineage consistency, not full parser replay from raw archived artifacts.",
    },
    deterministicExclusions: [
      "database UUIDs and primary keys not used as content identities",
      "created_at/completed_at/fetched_at/generatedAtUtc timestamps",
      "local filesystem paths and markdown receipt paths",
      "stored raw HTTP response headers that do not affect canonical content identity",
      "binary payload bytes when the warehouse stores hash/size only",
    ],
    deterministicInclusions: [
      "exact parent dataset ids and dataset hashes",
      "rate and CPI family manifest hashes",
      "source registry, source map, availability, staleness, and promotion source-version hashes",
      "selector, availability, validation, reconstruction, build, formula, and composition versions",
      "source artifact ids, endpoint ids, endpoint URLs, payload hashes, payload sizes, coverage, and flags",
      "normalized observation content hashes",
      "availability-event content hashes",
      "weekly parent and RRP snapshot content hashes",
      "aggregate weekly manifest content hashes",
      "RRP currency bundle hashes",
      "resolved content join-map hash",
    ],
    summary: {
      status: sourceArtifactToParentPass && parentToRrpPass
        ? "WAREHOUSE_CANONICAL_REBUILD_PASS_RAW_ARTIFACT_PARSER_REPLAY_PENDING"
        : "FAIL_WAREHOUSE_CANONICAL_REBUILD",
      rebuildInputLevel: "STORED_CANONICAL_WAREHOUSE_CONTENT_WITH_ARCHIVED_ARTIFACT_HASH_VALIDATION",
      storedNormalizedRowsUsedAsInputs: true,
      storedWeeklySnapshotsUsedAsInputs: true,
      rawArchivedArtifactsReparsed: false,
      comparisonTarget: "STORED_CANONICAL_CONTENT",
      warehouseCanonicalRebuildStatus: sourceArtifactToParentPass && parentToRrpPass ? "PASS" : "FAIL",
      rawArtifactParserReplayStatus: "PENDING",
      overallPromotionRebuildStatus: "PENDING",
      sourceArtifactToParentRebuildStatus: sourceArtifactToParentPass ? "PASS" : "FAIL",
      parentToRrpRebuildStatus: parentToRrpPass ? "PASS" : "FAIL",
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
      rrpWeeklyRows: rrpProof.weeklySnapshot.count,
      rrpStaleRows: rrpProof.weeklySnapshot.staleRows,
      rrpMissingRows: rrpProof.weeklySnapshot.missingRows,
      resolvedContentJoinMapHash: rrpProof.resolvedJoinMap.resolvedContentJoinMapHash,
      expectedResolvedContentJoinMapHash: EXPECTED_RRP_CONTENT_JOIN_MAP_HASH,
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
    },
    parents: {
      rate: publicParentProof(rateProof),
      cpi: publicParentProof(cpiProof),
    },
    rrp: rrpProof,
    matrixControl: {
      datasetId: GATE44_MATRIX_DATASET_ID,
      datasetHash: GATE44_MATRIX_DATASET_HASH,
      expectedPairWeeks: 10_416,
    },
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
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-deterministic-rebuild-proof-${stamp}.json`),
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

  console.log(`Gate 50 warehouse canonical rebuild proof: ${reportBase.summary.status}`);
  console.log(`Warehouse canonical rebuild: ${reportBase.summary.warehouseCanonicalRebuildStatus}`);
  console.log(`Raw artifact parser replay: ${reportBase.summary.rawArtifactParserReplayStatus}`);
  console.log(`Overall promotion rebuild: ${reportBase.summary.overallPromotionRebuildStatus}`);
  console.log(`Source-artifact-to-parent rebuild: ${reportBase.summary.sourceArtifactToParentRebuildStatus}`);
  console.log(`Parent-to-RRP rebuild: ${reportBase.summary.parentToRrpRebuildStatus}`);
  console.log(`Resolved content join-map hash: ${rrpProof.resolvedJoinMap.resolvedContentJoinMapHash}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (Object.keys(blockers).length > 0) {
    console.log(`Blockers: ${Object.entries(blockers).map(([key, count]) => `${key}:${count}`).join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[macro-deterministic-rebuild-proof] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch {
      // Pool may be unopened if validation fails before the first query.
    }
  });
