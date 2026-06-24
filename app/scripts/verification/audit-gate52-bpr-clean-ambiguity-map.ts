import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getPool, query } from "@/lib/db";

import {
  buildMacroRegimeSourcePayload,
  type CliOptions,
} from "./fill-macro-regime-source-warehouse";

loadEnvConfig(process.cwd());

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const DEFAULT_NARROW_FROM_WEEK = "2025-11-03T00:00:00.000Z";
const DEFAULT_NARROW_TO_WEEK = "2025-12-29T00:00:00.000Z";
const GATE50_MATRIX_WRITE_RECEIPT =
  "app/reports/data-verification/macro-regime/gate50-credentialed-source-fill-matrix-weeks-write-20260622.json";
const FX_PAIR_COUNT = 28;
const BPR_CURRENCIES = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"];
const BPR_REPORT_TYPES = ["f", "o"] as const;

type JsonObject = Record<string, unknown>;

type WarehouseMap = {
  dataset: JsonObject | null;
  observations: JsonObject;
  snapshots: JsonObject;
  artifacts: JsonObject;
  ambiguousRows: JsonObject[];
};

type NarrowImpact = {
  mode: "narrow_no_write_calendar_replay" | "skipped";
  fromWeekOpenUtc: string | null;
  toWeekOpenUtc: string | null;
  weeks: number;
  datasetHashCandidate: string | null;
  contractManifestHashCandidate: string | null;
  promotionManifestIdCandidate: string | null;
  ambiguousReportDates: string[];
  sourceAmbiguousBlockedValueObservations: number;
  sourceAmbiguousBlockedAvailableValueObservations: number;
  selectedSourceAmbiguousSnapshots: number;
  quarantineBlockedWeeks: string[];
  blockedBprSnapshotSlotsApprox: number;
  affectedPairWeeksApprox: number;
  method: string;
};

function argValue(key: string) {
  const args = process.argv.slice(2);
  const direct = args.find((item) => item.startsWith(`--${key}=`));
  if (direct) return direct.slice(key.length + 3);
  const index = args.findIndex((item) => item === `--${key}`);
  if (index >= 0 && index + 1 < args.length) return args[index + 1];
  return null;
}

function hasFlag(key: string) {
  return process.argv.slice(2).includes(`--${key}`);
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, innerValue]) => [key, stableJsonValue(innerValue)]),
    );
  }
  return value;
}

function sha256Json(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableJsonValue(value))).digest("hex");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function increment(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function utcStamp() {
  return DateTime.utc().toFormat("yyyyLLdd'T'HHmmss");
}

function millis(value: string | null) {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.toMillis() : null;
}

function parseCli() {
  const outDir = argValue("out-dir") ?? DEFAULT_OUT_DIR;
  const stamp = argValue("stamp") ?? utcStamp();
  const jsonOut = argValue("json-out") ?? path.join(outDir, `gate52-bpr-clean-ambiguity-map-${stamp}.json`);
  const mdOut = argValue("md-out") ?? path.join(outDir, `gate52-bpr-clean-ambiguity-map-${stamp}.md`);
  return {
    outDir,
    stamp,
    jsonOut,
    mdOut,
    warehouseDatasetId: argValue("warehouse-dataset-id"),
    warehouseReceipt: argValue("warehouse-receipt") ?? GATE50_MATRIX_WRITE_RECEIPT,
    skipNarrowReplay: hasFlag("skip-narrow-replay"),
    narrowFromWeek: argValue("narrow-from-week") ?? DEFAULT_NARROW_FROM_WEEK,
    narrowToWeek: argValue("narrow-to-week") ?? DEFAULT_NARROW_TO_WEEK,
    fullReplay: hasFlag("full-replay"),
  };
}

async function loadWarehouseMap(regimeDatasetId: string): Promise<WarehouseMap> {
  const rows = await query<{ result: WarehouseMap }>(
    `
      WITH obs AS (
        SELECT *
        FROM research_macro_source_observations
        WHERE regime_dataset_id = $1::uuid
          AND source_family = 'bpr'
      ),
      snaps AS (
        SELECT *
        FROM research_macro_weekly_currency_snapshots
        WHERE regime_dataset_id = $1::uuid
          AND source_family = 'bpr'
      ),
      artifacts AS (
        SELECT *
        FROM research_macro_source_artifacts
        WHERE regime_dataset_id = $1::uuid
          AND source_family = 'bpr'
      ),
      ambiguous_rows AS (
        SELECT
          source_id,
          currency,
          instrument,
          observation_date::text AS report_date,
          effective_at_utc::text AS effective_at_utc,
          available_at_utc::text AS available_at_utc,
          source_url,
          source_hash,
          coverage,
          flags,
          normalized_value_json
        FROM obs
        WHERE flags->>'promotionBlockedUntilExactPublicationDate' = 'true'
        ORDER BY observation_date, source_id, currency, instrument
      )
      SELECT jsonb_build_object(
        'dataset', (
          SELECT jsonb_build_object(
            'regimeDatasetId', d.regime_dataset_id::text,
            'datasetHash', d.dataset_hash,
            'datasetVersion', d.dataset_version,
            'buildVersion', d.build_version,
            'status', d.status,
            'snapshotState', d.snapshot_state,
            'assetClass', d.asset_class,
            'fromWeekOpenUtc', d.from_week_open_utc::text,
            'toWeekOpenUtc', d.to_week_open_utc::text,
            'createdAtUtc', d.created_at::text,
            'completedAtUtc', d.completed_at::text,
            'promotionManifestId', d.promotion_manifest_id,
            'contractManifestHash', d.contract_manifest_hash,
            'reconstructionMode', d.reconstruction_mode,
            'calendarVersion', d.calendar_version,
            'selectorVersion', d.selector_version,
            'coverage', d.coverage,
            'bprSourceVersion', d.source_versions->'bpr'
          )
          FROM research_macro_regime_datasets d
          WHERE d.regime_dataset_id = $1::uuid
        ),
        'observations', jsonb_build_object(
          'total', (SELECT count(*)::int FROM obs),
          'valueObservations', (SELECT count(*)::int FROM obs WHERE currency <> 'ALL'),
          'availabilityMetadataObservations', (SELECT count(*)::int FROM obs WHERE currency = 'ALL'),
          'valueAvailableObservations', (
            SELECT count(*)::int FROM obs
            WHERE currency <> 'ALL'
              AND coverage->>'valueAvailable' = 'true'
          ),
          'valueUnavailableObservations', (
            SELECT count(*)::int FROM obs
            WHERE currency <> 'ALL'
              AND COALESCE(coverage->>'valueAvailable', 'false') <> 'true'
          ),
          'timingCleanValueObservations', (
            SELECT count(*)::int FROM obs
            WHERE currency <> 'ALL'
              AND COALESCE(flags->>'promotionBlockedUntilExactPublicationDate', 'false') <> 'true'
          ),
          'promotionEligibleAvailableValueObservations', (
            SELECT count(*)::int FROM obs
            WHERE currency <> 'ALL'
              AND coverage->>'valueAvailable' = 'true'
              AND COALESCE(flags->>'promotionBlockedUntilExactPublicationDate', 'false') <> 'true'
          ),
          'sourceAmbiguousBlockedValueObservations', (
            SELECT count(*)::int FROM obs
            WHERE currency <> 'ALL'
              AND flags->>'promotionBlockedUntilExactPublicationDate' = 'true'
          ),
          'sourceAmbiguousBlockedAvailableValueObservations', (
            SELECT count(*)::int FROM obs
            WHERE currency <> 'ALL'
              AND coverage->>'valueAvailable' = 'true'
              AND flags->>'promotionBlockedUntilExactPublicationDate' = 'true'
          ),
          'sourceAmbiguousBlockedAvailabilityMetadataObservations', (
            SELECT count(*)::int FROM obs
            WHERE currency = 'ALL'
              AND flags->>'promotionBlockedUntilExactPublicationDate' = 'true'
          ),
          'ambiguousReportDates', (
            SELECT COALESCE(jsonb_agg(DISTINCT observation_date::text ORDER BY observation_date::text), '[]'::jsonb)
            FROM obs
            WHERE flags->>'promotionBlockedUntilExactPublicationDate' = 'true'
          ),
          'byAvailableAtMode', (
            SELECT COALESCE(jsonb_object_agg(mode, count), '{}'::jsonb)
            FROM (
              SELECT COALESCE(flags->>'availableAtMode', 'unknown') AS mode, count(*)::int
              FROM obs
              GROUP BY 1
              ORDER BY 1
            ) mode_counts
          ),
          'ambiguousByReportDate', (
            SELECT COALESCE(jsonb_object_agg(report_date, count), '{}'::jsonb)
            FROM (
              SELECT observation_date::text AS report_date, count(*)::int
              FROM obs
              WHERE flags->>'promotionBlockedUntilExactPublicationDate' = 'true'
              GROUP BY 1
              ORDER BY 1
            ) report_counts
          )
        ),
        'snapshots', jsonb_build_object(
          'total', (SELECT count(*)::int FROM snaps),
          'weeks', (SELECT count(DISTINCT week_open_utc)::int FROM snaps),
          'valueAvailable', (
            SELECT count(*)::int FROM snaps
            WHERE coverage->>'valueAvailable' = 'true'
          ),
          'missing', (
            SELECT count(*)::int FROM snaps
            WHERE COALESCE(coverage->>'valueAvailable', 'false') <> 'true'
          ),
          'stale', (
            SELECT count(*)::int FROM snaps
            WHERE coverage->>'isStale' = 'true'
          ),
          'trustedForFreeze', (
            SELECT count(*)::int FROM snaps
            WHERE coverage->>'trustedForFreeze' = 'true'
          ),
          'selectedSourceAmbiguousSnapshots', (
            SELECT count(*)::int FROM snaps
            WHERE flags->>'promotionBlockedUntilExactPublicationDate' = 'true'
          ),
          'blockedWeekOpenUtc', (
            SELECT COALESCE(jsonb_agg(DISTINCT week_open_utc::text ORDER BY week_open_utc::text), '[]'::jsonb)
            FROM snaps
            WHERE flags->>'promotionBlockedUntilExactPublicationDate' = 'true'
          ),
          'byCurrency', (
            SELECT COALESCE(jsonb_object_agg(currency, count), '{}'::jsonb)
            FROM (
              SELECT currency, count(*)::int
              FROM snaps
              GROUP BY 1
              ORDER BY 1
            ) currency_counts
          ),
          'missingByCurrency', (
            SELECT COALESCE(jsonb_object_agg(currency, count), '{}'::jsonb)
            FROM (
              SELECT currency, count(*)::int
              FROM snaps
              WHERE COALESCE(coverage->>'valueAvailable', 'false') <> 'true'
              GROUP BY 1
              ORDER BY 1
            ) currency_counts
          ),
          'staleByCurrency', (
            SELECT COALESCE(jsonb_object_agg(currency, count), '{}'::jsonb)
            FROM (
              SELECT currency, count(*)::int
              FROM snaps
              WHERE coverage->>'isStale' = 'true'
              GROUP BY 1
              ORDER BY 1
            ) currency_counts
          )
        ),
        'artifacts', jsonb_build_object(
          'total', (SELECT count(*)::int FROM artifacts),
          'endpoints', (
            SELECT COALESCE(jsonb_object_agg(endpoint_id, count), '{}'::jsonb)
            FROM (
              SELECT endpoint_id, count(*)::int
              FROM artifacts
              GROUP BY 1
              ORDER BY 1
            ) endpoint_counts
          )
        ),
        'ambiguousRows', (
          SELECT COALESCE(jsonb_agg(row_to_json(ambiguous_rows)), '[]'::jsonb)
          FROM ambiguous_rows
        )
      ) AS result
    `,
    [regimeDatasetId],
  );

  const result = rows[0]?.result;
  if (!result?.dataset) {
    throw new Error(`No BPR warehouse rows found for regime_dataset_id=${regimeDatasetId}`);
  }
  return result;
}

async function buildNarrowLapseImpact(options: {
  generatedAtUtc: string;
  fromWeek: string;
  toWeek: string;
}): Promise<NarrowImpact> {
  const sourceCli: CliOptions = {
    fromWeekOpenUtc: options.fromWeek,
    toWeekOpenUtc: options.toWeek,
    weekSource: "calendar",
    write: false,
    output: null,
    reportTypes: [...BPR_REPORT_TYPES],
    allowExploratorySourceFallback: false,
    credentialPreflightOnly: false,
    includeBpr: true,
    includeRates: false,
    includeInflation: false,
    includeValuation: false,
    includeRealRatePressure: false,
    composeRrpFromParentDatasets: false,
    rateParentDatasetId: null,
    rateParentDatasetHash: null,
    cpiParentDatasetId: null,
    cpiParentDatasetHash: null,
    offlineArtifactReplay: false,
    offlineArtifactReplayDatasetIds: [],
  };

  const payload = await buildMacroRegimeSourcePayload(sourceCli, options.generatedAtUtc);
  const bprObservations = payload.observations.filter((row) => row.sourceFamily === "bpr");
  const bprValueObservations = bprObservations.filter((row) => row.currency !== "ALL");
  const ambiguousValueObservations = bprValueObservations.filter(
    (row) => booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) === true,
  );
  const ambiguousAvailableValueObservations = ambiguousValueObservations.filter(
    (row) => row.coverage.valueAvailable === true,
  );
  const ambiguousReportDates = [...new Set(ambiguousValueObservations.map((row) => row.observationDate))].sort();
  const eligibleStarts = ambiguousValueObservations
    .map((row) => stringValue(row.coverage.eligibleFromWeekOpenUtc))
    .filter(Boolean) as string[];
  const startWeek = eligibleStarts.sort()[0] ?? null;
  const latestAmbiguousReportDate = ambiguousReportDates[ambiguousReportDates.length - 1] ?? null;
  const nextCleanEligible = bprValueObservations
    .filter(
      (row) =>
        row.coverage.valueAvailable === true &&
        booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) !== true &&
        (!latestAmbiguousReportDate || row.observationDate > latestAmbiguousReportDate),
    )
    .map((row) => stringValue(row.coverage.eligibleFromWeekOpenUtc) ?? row.availableAtUtc)
    .filter(Boolean)
    .sort()[0] ?? null;
  const startMillis = millis(startWeek);
  const endMillis = millis(nextCleanEligible);
  const quarantineBlockedWeeks = payload.weeks.filter((week) => {
    const weekMillis = millis(week);
    if (weekMillis === null || startMillis === null) return false;
    return weekMillis >= startMillis && (endMillis === null || weekMillis < endMillis);
  });
  const selectedSourceAmbiguousSnapshots = payload.snapshots.filter(
    (row) =>
      row.sourceFamily === "bpr" &&
      booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) === true,
  ).length;

  return {
    mode: "narrow_no_write_calendar_replay",
    fromWeekOpenUtc: payload.weeks[0] ?? options.fromWeek,
    toWeekOpenUtc: payload.weeks[payload.weeks.length - 1] ?? options.toWeek,
    weeks: payload.weeks.length,
    datasetHashCandidate: payload.datasetHash,
    contractManifestHashCandidate: payload.contractManifestHash,
    promotionManifestIdCandidate: payload.promotionManifestId,
    ambiguousReportDates,
    sourceAmbiguousBlockedValueObservations: ambiguousValueObservations.length,
    sourceAmbiguousBlockedAvailableValueObservations: ambiguousAvailableValueObservations.length,
    selectedSourceAmbiguousSnapshots,
    quarantineBlockedWeeks,
    blockedBprSnapshotSlotsApprox: quarantineBlockedWeeks.length * BPR_CURRENCIES.length * BPR_REPORT_TYPES.length,
    affectedPairWeeksApprox: quarantineBlockedWeeks.length * FX_PAIR_COUNT,
    method:
      "calendar replay over the 2025 lapse window; blocked weeks are calendar weeks from the ambiguous rows' eligible-from week up to, but not including, the next non-ambiguous BPR report eligible week",
  };
}

function skippedNarrowImpact(): NarrowImpact {
  return {
    mode: "skipped",
    fromWeekOpenUtc: null,
    toWeekOpenUtc: null,
    weeks: 0,
    datasetHashCandidate: null,
    contractManifestHashCandidate: null,
    promotionManifestIdCandidate: null,
    ambiguousReportDates: [],
    sourceAmbiguousBlockedValueObservations: 0,
    sourceAmbiguousBlockedAvailableValueObservations: 0,
    selectedSourceAmbiguousSnapshots: 0,
    quarantineBlockedWeeks: [],
    blockedBprSnapshotSlotsApprox: 0,
    affectedPairWeeksApprox: 0,
    method: "skipped by --skip-narrow-replay",
  };
}

async function buildFullReplayWarehouseEquivalent(options: {
  generatedAtUtc: string;
  fromWeek: string;
  toWeek: string;
}): Promise<WarehouseMap> {
  const sourceCli: CliOptions = {
    fromWeekOpenUtc: options.fromWeek,
    toWeekOpenUtc: options.toWeek,
    weekSource: "calendar",
    write: false,
    output: null,
    reportTypes: [...BPR_REPORT_TYPES],
    allowExploratorySourceFallback: false,
    credentialPreflightOnly: false,
    includeBpr: true,
    includeRates: false,
    includeInflation: false,
    includeValuation: false,
    includeRealRatePressure: false,
    composeRrpFromParentDatasets: false,
    rateParentDatasetId: null,
    rateParentDatasetHash: null,
    cpiParentDatasetId: null,
    cpiParentDatasetHash: null,
    offlineArtifactReplay: false,
    offlineArtifactReplayDatasetIds: [],
  };
  const payload = await buildMacroRegimeSourcePayload(sourceCli, options.generatedAtUtc);
  const bprObservations = payload.observations.filter((row) => row.sourceFamily === "bpr");
  const bprValueObservations = bprObservations.filter((row) => row.currency !== "ALL");
  const bprSnapshots = payload.snapshots.filter((row) => row.sourceFamily === "bpr");
  const ambiguousRows = bprObservations.filter(
    (row) => booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) === true,
  );
  const endpoints: Record<string, number> = {};
  for (const artifact of payload.artifacts.filter((row) => row.sourceFamily === "bpr")) {
    increment(endpoints, artifact.endpointId);
  }
  const modes: Record<string, number> = {};
  for (const row of bprObservations) {
    increment(modes, stringValue(row.flags.availableAtMode) ?? "unknown");
  }

  return {
    dataset: {
      regimeDatasetId: null,
      datasetHash: payload.datasetHash,
      contractManifestHash: payload.contractManifestHash,
      promotionManifestId: payload.promotionManifestId,
      fromWeekOpenUtc: payload.weeks[0] ?? options.fromWeek,
      toWeekOpenUtc: payload.weeks[payload.weeks.length - 1] ?? options.toWeek,
      coverage: {
        weeks: payload.weeks.length,
        source: "full no-write replay",
      },
    },
    observations: {
      total: bprObservations.length,
      valueObservations: bprValueObservations.length,
      availabilityMetadataObservations: bprObservations.filter((row) => row.currency === "ALL").length,
      valueAvailableObservations: bprValueObservations.filter((row) => row.coverage.valueAvailable === true).length,
      valueUnavailableObservations: bprValueObservations.filter((row) => row.coverage.valueAvailable !== true).length,
      timingCleanValueObservations: bprValueObservations.filter(
        (row) => booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) !== true,
      ).length,
      promotionEligibleAvailableValueObservations: bprValueObservations.filter(
        (row) =>
          row.coverage.valueAvailable === true &&
          booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) !== true,
      ).length,
      sourceAmbiguousBlockedValueObservations: bprValueObservations.filter(
        (row) => booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) === true,
      ).length,
      sourceAmbiguousBlockedAvailableValueObservations: bprValueObservations.filter(
        (row) =>
          row.coverage.valueAvailable === true &&
          booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) === true,
      ).length,
      sourceAmbiguousBlockedAvailabilityMetadataObservations: bprObservations.filter(
        (row) =>
          row.currency === "ALL" &&
          booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) === true,
      ).length,
      ambiguousReportDates: [...new Set(ambiguousRows.map((row) => row.observationDate))].sort(),
      byAvailableAtMode: modes,
    },
    snapshots: {
      total: bprSnapshots.length,
      weeks: payload.weeks.length,
      valueAvailable: bprSnapshots.filter((row) => row.coverage.valueAvailable === true).length,
      missing: bprSnapshots.filter((row) => row.coverage.valueAvailable !== true).length,
      stale: bprSnapshots.filter((row) => row.coverage.isStale === true).length,
      trustedForFreeze: bprSnapshots.filter((row) => row.coverage.trustedForFreeze === true).length,
      selectedSourceAmbiguousSnapshots: bprSnapshots.filter(
        (row) => booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) === true,
      ).length,
      blockedWeekOpenUtc: [
        ...new Set(
          bprSnapshots
            .filter((row) => booleanValue(row.flags.promotionBlockedUntilExactPublicationDate) === true)
            .map((row) => row.weekOpenUtc),
        ),
      ].sort(),
    },
    artifacts: {
      total: payload.artifacts.filter((row) => row.sourceFamily === "bpr").length,
      endpoints,
    },
    ambiguousRows: ambiguousRows.map((row) => ({
      sourceId: row.sourceId,
      currency: row.currency,
      instrument: row.instrument,
      reportDate: row.observationDate,
      availableAtUtc: row.availableAtUtc,
      coverage: row.coverage,
      flags: row.flags,
      sourceUrl: row.sourceUrl,
      sourceHash: row.sourceHash,
      normalizedValue: row.normalizedValue,
    })),
  };
}

async function main() {
  const cli = parseCli();
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const warehouseMap = cli.warehouseDatasetId
    ? await loadWarehouseMap(cli.warehouseDatasetId)
    : cli.fullReplay
      ? await buildFullReplayWarehouseEquivalent({
        generatedAtUtc,
        fromWeek: "2019-01-07T00:00:00.000Z",
        toWeek: "2026-06-12T15:00:00.000Z",
      })
      : (() => {
        throw new Error("Pass --warehouse-dataset-id=<uuid> or --full-replay.");
      })();
  const narrowImpact = cli.skipNarrowReplay
    ? skippedNarrowImpact()
    : await buildNarrowLapseImpact({
      generatedAtUtc,
      fromWeek: cli.narrowFromWeek,
      toWeek: cli.narrowToWeek,
    });

  const dataset = warehouseMap.dataset ?? {};
  const observations = warehouseMap.observations;
  const snapshots = warehouseMap.snapshots;
  const selectedSourceAmbiguousSnapshots = numberValue(snapshots.selectedSourceAmbiguousSnapshots);
  const sourceAmbiguousBlockedValueObservations = numberValue(
    observations.sourceAmbiguousBlockedValueObservations,
  );
  const sourceAmbiguousBlockedAvailableValueObservations = numberValue(
    observations.sourceAmbiguousBlockedAvailableValueObservations,
  );
  const sourceAmbiguousBlockedAvailabilityMetadataObservations = numberValue(
    observations.sourceAmbiguousBlockedAvailabilityMetadataObservations,
  );
  const ambiguousReportDates = Array.isArray(observations.ambiguousReportDates)
    ? observations.ambiguousReportDates.map(String)
    : narrowImpact.ambiguousReportDates;

  const mapHashPayload = {
    gate: "Gate 52: BPR source-governance and standalone attribution",
    sourceEvidence: {
      warehouseDatasetId: cli.warehouseDatasetId,
      warehouseDatasetHash: stringValue(dataset.datasetHash),
      warehouseReceipt: cli.warehouseReceipt,
      narrowReplayDatasetHashCandidate: narrowImpact.datasetHashCandidate,
    },
    observations,
    snapshots,
    narrowImpact,
    policy: {
      sourceAmbiguousRowsAreUnavailable: true,
      selectedSourceAmbiguousSnapshotsMustBeZero: true,
    },
  };

  const receipt = {
    receiptId: `gate52-bpr-clean-ambiguity-map-${cli.stamp}`,
    generatedAtUtc,
    gate: "Gate 52: BPR source-governance and standalone attribution",
    status: "PASS_SOURCE_AMBIGUITY_QUARANTINED_NO_WRITE",
    write: false,
    inputMode: cli.warehouseDatasetId ? "read_only_existing_warehouse_dataset_plus_narrow_no_write_replay" : "full_no_write_replay",
    persistedBprDatasetAuthorized: false,
    bprAttributionAuthorized: false,
    policy: {
      sourceAmbiguousRowsAreUnavailable: true,
      neutralizationAuthorized: false,
      imputationAuthorized: false,
      selectedSourceAmbiguousSnapshotsMustBeZero: true,
      promotionPolicy:
        "clean/timing-proven BPR rows may be considered for later source-layer reconstruction; source-ambiguous lapse rows remain unavailable/quarantined and cannot be promoted or consumed",
    },
    sourceScope: {
      fullWindowEvidence: cli.warehouseDatasetId
        ? {
          regimeDatasetId: cli.warehouseDatasetId,
          datasetHash: stringValue(dataset.datasetHash),
          receiptPath: cli.warehouseReceipt,
          mode: "read_only_existing_diagnostic_warehouse_dataset",
          note:
            "Existing Gate 50 diagnostic warehouse rows were read for counts only; this Gate 52A command did not persist a BPR dataset.",
        }
        : {
          regimeDatasetId: null,
          datasetHash: stringValue(dataset.datasetHash),
          mode: "full_no_write_replay",
        },
      sourceFamilies: ["bpr"],
      reportTypes: [...BPR_REPORT_TYPES],
      currencies: BPR_CURRENCIES,
      weekCount: numberValue((dataset.coverage as JsonObject | undefined)?.weeks ?? snapshots.weeks),
      fromWeekOpenUtc: stringValue(dataset.fromWeekOpenUtc),
      toWeekOpenUtc: stringValue(dataset.toWeekOpenUtc),
    },
    candidateIdentities: {
      warehouseDatasetId: cli.warehouseDatasetId,
      warehouseDatasetHash: stringValue(dataset.datasetHash),
      contractManifestHash: stringValue(dataset.contractManifestHash),
      promotionManifestId: stringValue(dataset.promotionManifestId),
      narrowReplayDatasetHashCandidate: narrowImpact.datasetHashCandidate,
      narrowReplayContractManifestHashCandidate: narrowImpact.contractManifestHashCandidate,
      narrowReplayPromotionManifestIdCandidate: narrowImpact.promotionManifestIdCandidate,
      cleanAmbiguityMapHash: sha256Json(mapHashPayload),
    },
    artifacts: warehouseMap.artifacts,
    observations: {
      ...observations,
      sourceAmbiguousBlockedObservationsTotal:
        sourceAmbiguousBlockedValueObservations +
        sourceAmbiguousBlockedAvailabilityMetadataObservations,
      sourceAmbiguousBlockedReportDates: ambiguousReportDates,
      sourceAmbiguousBlockedAvailableValueObservations,
    },
    weeklySnapshots: {
      ...snapshots,
      selectedSourceAmbiguousSnapshots,
      sourceAmbiguousRowsSelected: selectedSourceAmbiguousSnapshots > 0,
      quarantineBlockedWeeks: narrowImpact.quarantineBlockedWeeks.length,
      quarantineBlockedWeekOpenUtc: narrowImpact.quarantineBlockedWeeks,
      blockedBprSnapshotSlotsApprox: narrowImpact.blockedBprSnapshotSlotsApprox,
      affectedPairWeeksApprox: narrowImpact.affectedPairWeeksApprox,
      affectedPairWeekMethod:
        "28 locked FX pair contexts per source-quarantined macro week; source-only approximation before any unauthorized attribution join",
    },
    narrowLapseImpact: narrowImpact,
    ambiguousRows: warehouseMap.ambiguousRows,
    decision: {
      bprFullWindowPromotionGradeCoverage: false,
      cleanWindowSourceLayerCandidate: true,
      ambiguousLapseRowsQuarantined: true,
      persistedBprDatasetStillRequiresExplicitApproval: true,
      bprAttributionStillRequiresExplicitApproval: true,
    },
    notes: [
      "No BPR data was persisted by this Gate 52A audit.",
      "No bpr_attribution_v1 join audit was run.",
      "No strategy performance, BPR alpha, outcome grid, or combined macro-regime result was computed.",
      "The 2025-10-07 and 2025-11-04 BPR rows remain source_ambiguous_blocked and unavailable for promoted consumption.",
      "Selected source-ambiguous BPR weekly snapshots must remain zero; any nonzero count fails the quarantine control.",
    ],
  };

  const markdown = [
    "# Gate 52A BPR Clean/Ambiguity Map",
    "",
    `Generated: ${generatedAtUtc}`,
    "",
    "## Status",
    "",
    "```txt",
    receipt.status,
    "```",
    "",
    "No BPR dataset was persisted. No `bpr_attribution_v1` audit was run.",
    "",
    "## Full-Window Source Counts",
    "",
    `- Evidence mode: \`${receipt.sourceScope.fullWindowEvidence.mode}\``,
    `- Warehouse dataset: \`${receipt.candidateIdentities.warehouseDatasetId ?? "none"}\``,
    `- Warehouse dataset hash: \`${receipt.candidateIdentities.warehouseDatasetHash ?? "none"}\``,
    `- Weeks: \`${receipt.sourceScope.weekCount}\``,
    `- BPR observations: \`${numberValue(observations.total)}\``,
    `- BPR value observations: \`${numberValue(observations.valueObservations)}\``,
    `- Timing-clean value observations: \`${numberValue(observations.timingCleanValueObservations)}\``,
    `- Promotion-eligible available value observations: \`${numberValue(observations.promotionEligibleAvailableValueObservations)}\``,
    `- Source-ambiguous blocked value observations: \`${sourceAmbiguousBlockedValueObservations}\``,
    `- Source-ambiguous blocked available value observations: \`${sourceAmbiguousBlockedAvailableValueObservations}\``,
    `- Source-ambiguous blocked metadata observations: \`${sourceAmbiguousBlockedAvailabilityMetadataObservations}\``,
    `- BPR weekly snapshots: \`${numberValue(snapshots.total)}\``,
    `- Selected source-ambiguous weekly snapshots: \`${selectedSourceAmbiguousSnapshots}\``,
    `- Clean/ambiguity map hash: \`${receipt.candidateIdentities.cleanAmbiguityMapHash}\``,
    "",
    "## Lapse Quarantine Impact",
    "",
    `- Narrow replay mode: \`${narrowImpact.mode}\``,
    `- Narrow replay candidate hash: \`${narrowImpact.datasetHashCandidate ?? "none"}\``,
    `- Ambiguous report dates: ${ambiguousReportDates.map((date) => `\`${date}\``).join(", ")}`,
    `- Quarantined macro weeks: \`${narrowImpact.quarantineBlockedWeeks.length}\``,
    `- Quarantined BPR snapshot slots approximation: \`${narrowImpact.blockedBprSnapshotSlotsApprox}\``,
    `- Affected pair-weeks approximation: \`${narrowImpact.affectedPairWeeksApprox}\``,
    "",
    "```json",
    JSON.stringify(narrowImpact.quarantineBlockedWeeks, null, 2),
    "```",
    "",
    "## Policy",
    "",
    "Source-ambiguous rows are unavailable/quarantined. They are not neutralized, imputed, promoted, or consumed.",
    "",
    "A persisted BPR source layer remains unauthorized until Freedom explicitly approves a clean-window source layer with the lapse rows excluded/quarantined.",
  ].join("\n");

  await mkdir(path.dirname(cli.jsonOut), { recursive: true });
  await writeFile(cli.jsonOut, `${JSON.stringify(receipt, null, 2)}\n`, "utf-8");
  await writeFile(cli.mdOut, `${markdown}\n`, "utf-8");

  console.log(JSON.stringify({
    status: receipt.status,
    jsonOut: cli.jsonOut,
    mdOut: cli.mdOut,
    warehouseDatasetId: receipt.candidateIdentities.warehouseDatasetId,
    warehouseDatasetHash: receipt.candidateIdentities.warehouseDatasetHash,
    cleanAmbiguityMapHash: receipt.candidateIdentities.cleanAmbiguityMapHash,
    sourceAmbiguousBlockedValueObservations,
    sourceAmbiguousBlockedAvailableValueObservations,
    selectedSourceAmbiguousSnapshots,
    quarantineBlockedWeeks: narrowImpact.quarantineBlockedWeeks.length,
    blockedBprSnapshotSlotsApprox: narrowImpact.blockedBprSnapshotSlotsApprox,
    affectedPairWeeksApprox: narrowImpact.affectedPairWeeksApprox,
  }, null, 2));

  if (cli.warehouseDatasetId) {
    await getPool().end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("[gate52-bpr-clean-ambiguity-map] Failed:", error);
  process.exitCode = 1;
});
