import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { query } from "../../src/lib/db";

loadEnvConfig(process.cwd());

const DEFAULT_MACRO_DATASET_ID = "01a3b789-2928-4886-a627-eaf5ae689790";
const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const DEFAULT_JSON = "gate50-rate-alfred-differential-reconstruction-20260622.json";
const FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations";
const FRED_VINTAGE_DATES_URL = "https://api.stlouisfed.org/fred/series/vintagedates";
const DEFAULT_FRED_REQUEST_DELAY_MS = 800;
const DEFAULT_FRED_MAX_RETRIES = 5;
const FRED_REALTIME_START_MIN_DATE = "1776-07-04";

type JsonRecord = Record<string, unknown>;

type RateSnapshotRow = {
  week_open_utc: string;
  currency: string;
  source_id: string;
  source_observation_date: string | null;
  available_at_utc: string | null;
  normalized_value_json: unknown;
  coverage: unknown;
  flags: unknown;
};

type FredObservation = {
  realtime_start?: string;
  realtime_end?: string;
  date: string;
  value?: string;
};

type RequestError = {
  request: string;
  message: string;
};

type RateVintageClassification =
  | "legitimate_revision"
  | "wrong_vintage"
  | "reconstruction_defect"
  | "valid_carry_incorrectly_marked_stale"
  | "genuine_missing_observation";

type AuditedRateRow = Awaited<ReturnType<typeof auditRow>>;

type OriginalRateReconstructionAnomaly = {
  anomalyId: string;
  currency: string;
  sourceId: string;
  seriesId: string;
  freezeDate: string;
  weekOpenUtc: string;
  selectedObservationDate: string;
  originalAnomaly: "no_as_of_observation";
  rootCause: string;
  repairVersion: string;
};

type RateFamilyManifest = {
  manifestType: "rate_family_manifest";
  familyManifestId: "rate_3m_market_family_v1";
  familyManifestHash: string;
  familyManifestStatus: "BUILT_DIAGNOSTIC_REBUILD_REQUIRED";
  manifestState: "SEALED";
  diagnosticOnly: true;
  promotionEligible: false;
  outcomeConsumable: false;
  instrument: "oecd_3m_interbank_rate";
  selectionRule: "latest_eligible_vintage_as_of_weekly_freeze";
  stalenessRuleVersion: "rate_3m_market_release_aware_carry_v1";
  releaseAwareCarryRule: string;
  missingRule: string;
  revisionRule: string;
  requiredCurrencySet: string[];
  requiredCurrencySetHash: string;
  branchContractHashes: Record<string, string>;
  sourceIds: Record<string, string>;
  seriesIds: Record<string, string>;
  classificationCounts: Record<string, number>;
  caveats: string[];
};

type RateCurrencyBundleManifest = {
  manifestType: "currency_macro_bundle_manifest";
  currencyMacroBundleId: string;
  currencyMacroBundleHash: string;
  bundleScope: "RATE_DIAGNOSTIC";
  bundleState: "PARTIAL_SEALED";
  manifestState: "SEALED";
  diagnosticOnly: true;
  promotionEligible: false;
  outcomeConsumable: false;
  currency: string;
  rateFamilyManifestId: "rate_3m_market_family_v1";
  rateFamilyManifestHash: string;
  rateSourceId: string;
  rateSeriesId: string;
  branchContractHash: string;
  rowsAudited: number;
  classificationCounts: Record<string, number>;
  rebuildRequired: boolean;
  missingForRrpPromotion: string[];
};

const REQUIRED_RATE_CURRENCY_SET = ["AUD", "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "USD"] as const;
const RATE_SELECTION_RULE = "latest_eligible_vintage_as_of_weekly_freeze";
const RATE_STALENESS_RULE_VERSION = "rate_3m_market_release_aware_carry_v1";
const RATE_FAMILY_MANIFEST_ID = "rate_3m_market_family_v1";
const RATE_INSTRUMENT = "oecd_3m_interbank_rate";
const RATE_RECONCILIATION_REPAIR_VERSION = "rate_vintage_reconciliation_query_window_repair_v1";
const ORIGINAL_RATE_RECONSTRUCTION_ANOMALIES: OriginalRateReconstructionAnomaly[] = [
  {
    anomalyId: "chf_2024_01_08_no_as_of_observation_query_window_v1",
    currency: "CHF",
    sourceId: "fred_IR3TIB01CHM156N",
    seriesId: "IR3TIB01CHM156N",
    freezeDate: "2024-01-08",
    weekOpenUtc: "2024-01-08T00:00:00.000Z",
    selectedObservationDate: "2021-12-01",
    originalAnomaly: "no_as_of_observation",
    rootCause: "query-window defect: prior as-of request observation_start excluded the selected 2021-12-01 observation",
    repairVersion: RATE_RECONCILIATION_REPAIR_VERSION,
  },
];

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function parseIntArg(name: string, fallback: number) {
  const raw = argValue(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`Invalid --${name}: ${raw}`);
  return parsed;
}

const FRED_REQUEST_DELAY_MS = parseIntArg("fred-request-delay-ms", DEFAULT_FRED_REQUEST_DELAY_MS);
const FRED_MAX_RETRIES = parseIntArg("fred-max-retries", DEFAULT_FRED_MAX_RETRIES);
let lastFredRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleFredRequest() {
  if (FRED_REQUEST_DELAY_MS <= 0) return;
  const now = Date.now();
  const waitMs = Math.max(0, lastFredRequestAt + FRED_REQUEST_DELAY_MS - now);
  if (waitMs > 0) await sleep(waitMs);
  lastFredRequestAt = Date.now();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function isoUtc(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (parsed.isValid) return parsed.toUTC().toISO({ suppressMilliseconds: false }) ?? value;
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? value : fallback.toISOString();
}

function isoDate(value: string | Date) {
  return isoUtc(value).slice(0, 10);
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

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

function fredKey() {
  return process.env.FRED_API_KEY?.trim() || process.env.ALFRED_API_KEY?.trim() || "";
}

function seriesIdFromSourceId(sourceId: string) {
  return sourceId.replace(/^fred_/, "");
}

function numberFromUnknown(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function ratePercentFromSnapshot(row: RateSnapshotRow) {
  return numberFromUnknown(asRecord(row.normalized_value_json).ratePercent);
}

function ratePercentFromFred(value: string | undefined) {
  if (!value || value === ".") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareDate(left: string | null, right: string | null) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right);
}

function isFredNoVintageDatesError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("No vintage dates exist for the specified real-time period");
}

async function fredJson(endpoint: string, params: Record<string, string>) {
  const key = fredKey();
  if (!key) throw new Error("FRED_API_KEY or ALFRED_API_KEY is required for rate differential reconstruction.");
  const url = new URL(endpoint);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  for (let attempt = 0; attempt <= FRED_MAX_RETRIES; attempt += 1) {
    await throttleFredRequest();
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "LimniGate50RateDifferential/1.0",
      },
    });
    const text = await response.text();
    let body: unknown = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
    if (response.ok) return body;

    const error = asRecord(body).error_message ?? asRecord(body).error_code ?? response.status;
    const transient = response.status === 429 || (response.status >= 500 && response.status <= 599);
    if (transient && attempt < FRED_MAX_RETRIES) {
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const retryDelayMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(1000, retryAfterSeconds * 1000)
        : Math.min(60000, 5000 * 2 ** attempt);
      console.warn(
        `FRED transient HTTP ${response.status} for ${params.series_id}; retrying in ${retryDelayMs}ms (${attempt + 1}/${FRED_MAX_RETRIES})`,
      );
      await sleep(retryDelayMs);
      continue;
    }

    throw new Error(`FRED request failed for ${params.series_id}: HTTP ${response.status}; ${String(error)}`);
  }

  throw new Error(`FRED request failed for ${params.series_id}: exhausted retries`);
}

async function fredObservations(params: Record<string, string>) {
  let body: unknown;
  try {
    body = await fredJson(FRED_OBSERVATIONS_URL, params);
  } catch (error) {
    if (isFredNoVintageDatesError(error)) return [];
    throw error;
  }
  const observations = asRecord(body).observations;
  return Array.isArray(observations)
    ? observations.filter((row): row is FredObservation => asRecord(row).date !== undefined) as FredObservation[]
    : [];
}

async function fredVintageDates(seriesId: string, realtimeStart: string, realtimeEnd: string) {
  let body: unknown;
  try {
    body = await fredJson(FRED_VINTAGE_DATES_URL, {
      series_id: seriesId,
      realtime_start: realtimeStart,
      realtime_end: realtimeEnd,
    });
  } catch (error) {
    if (isFredNoVintageDatesError(error)) return [];
    throw error;
  }
  const values = asRecord(body).vintage_dates;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : [];
}

function latestValuedObservation(observations: FredObservation[], observationEnd: string) {
  return observations
    .filter((row) => row.value !== undefined && row.value !== "." && row.date <= observationEnd)
    .sort((left, right) => left.date.localeCompare(right.date))
    .at(-1) ?? null;
}

async function readStaleRateSnapshots(options: { macroDatasetId: string; limit: number }) {
  const rows = await query<RateSnapshotRow>(
    `
      SELECT
        week_open_utc::text,
        currency,
        source_id,
        source_observation_date::text,
        available_at_utc::text,
        normalized_value_json,
        coverage,
        flags
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND source_family = 'rate'
        AND instrument = 'oecd_3m_interbank_rate'
        AND coverage->>'isStale' = 'true'
      ORDER BY currency, source_id, week_open_utc
      ${options.limit > 0 ? "LIMIT $2" : ""}
    `,
    options.limit > 0 ? [options.macroDatasetId, options.limit] : [options.macroDatasetId],
  );
  return rows;
}

function classifyRateVintage(
  row: RateSnapshotRow,
  asOfLatest: FredObservation | null,
  initialLatest: FredObservation | null,
  requestErrors: RequestError[],
  vintageDates: string[],
): RateVintageClassification {
  if (requestErrors.some((error) => error.request === "fred_observations_output_type_1")) {
    return "reconstruction_defect";
  }

  const selectedObservationDate = row.source_observation_date;
  const asOfObservationDate = asOfLatest?.date ?? null;
  if (!selectedObservationDate) return "reconstruction_defect";
  if (!asOfLatest) {
    return initialLatest || vintageDates.length > 0
      ? "reconstruction_defect"
      : "genuine_missing_observation";
  }

  const dateCompare = compareDate(asOfObservationDate, selectedObservationDate);
  const selectedRatePercent = ratePercentFromSnapshot(row);
  const asOfRatePercent = ratePercentFromFred(asOfLatest?.value);
  const initialRatePercent = ratePercentFromFred(initialLatest?.value);
  const rateDiff = selectedRatePercent !== null && asOfRatePercent !== null
    ? Math.abs(selectedRatePercent - asOfRatePercent)
    : null;
  const initialDiff = selectedRatePercent !== null && initialRatePercent !== null
    ? Math.abs(selectedRatePercent - initialRatePercent)
    : null;

  if (dateCompare !== 0) return "wrong_vintage";
  if (rateDiff !== null && rateDiff > 1e-9) {
    return initialLatest?.date === selectedObservationDate &&
      initialDiff !== null &&
      initialDiff <= 1e-9
      ? "legitimate_revision"
      : "wrong_vintage";
  }
  return "valid_carry_incorrectly_marked_stale";
}

async function captureFredRequest<T>(
  request: string,
  errors: RequestError[],
  action: () => Promise<T>,
  fallback: T,
) {
  try {
    return await action();
  } catch (error) {
    errors.push({
      request,
      message: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

async function auditRow(row: RateSnapshotRow) {
  const weekOpenUtc = isoUtc(row.week_open_utc);
  const freezeDate = isoDate(asRecord(row.coverage).freezeTargetUtc as string | undefined ?? weekOpenUtc);
  const seriesId = seriesIdFromSourceId(row.source_id);
  const defaultObservationStart = DateTime.fromISO(freezeDate, { zone: "utc" }).minus({ months: 24 }).toISODate() ?? freezeDate;
  const selectedObservationDate = row.source_observation_date ?? defaultObservationStart;
  const selectedObservationWindowStart = DateTime.fromISO(selectedObservationDate, { zone: "utc" })
    .minus({ months: 6 })
    .toISODate() ?? FRED_REALTIME_START_MIN_DATE;
  const observationStart = selectedObservationWindowStart < defaultObservationStart
    ? selectedObservationWindowStart
    : defaultObservationStart;
  const vintageStart = selectedObservationWindowStart < FRED_REALTIME_START_MIN_DATE
    ? FRED_REALTIME_START_MIN_DATE
    : selectedObservationWindowStart;
  const requestErrors: RequestError[] = [];

  const asOfObservations = await captureFredRequest(
    "fred_observations_output_type_1",
    requestErrors,
    () => fredObservations({
      series_id: seriesId,
      output_type: "1",
      realtime_start: freezeDate,
      realtime_end: freezeDate,
      observation_start: observationStart,
      observation_end: freezeDate,
    }),
    [],
  );
  const initialReleaseObservations = await captureFredRequest(
    "fred_observations_output_type_4",
    requestErrors,
    () => fredObservations({
      series_id: seriesId,
      output_type: "4",
      realtime_start: vintageStart,
      realtime_end: freezeDate,
      observation_start: observationStart,
      observation_end: freezeDate,
    }),
    [],
  );
  const vintageDates = await captureFredRequest(
    "fred_series_vintagedates",
    requestErrors,
    () => fredVintageDates(seriesId, vintageStart, freezeDate),
    [],
  );

  const asOfLatest = latestValuedObservation(asOfObservations, freezeDate);
  const initialLatest = latestValuedObservation(initialReleaseObservations, freezeDate);
  const classification = classifyRateVintage(row, asOfLatest, initialLatest, requestErrors, vintageDates);
  const selectedRatePercent = ratePercentFromSnapshot(row);
  const asOfRatePercent = ratePercentFromFred(asOfLatest?.value);
  const initialRatePercent = ratePercentFromFred(initialLatest?.value);

  return {
    weekOpenUtc,
    freezeDate,
    currency: row.currency,
    sourceId: row.source_id,
    seriesId,
    selected: {
      observationDate: row.source_observation_date,
      availableAtUtc: row.available_at_utc ? isoUtc(row.available_at_utc) : null,
      ratePercent: selectedRatePercent,
      stalenessDays: numberFromUnknown(asRecord(row.coverage).stalenessDays),
      maxStaleDays: numberFromUnknown(asRecord(row.coverage).maxStaleDays),
      staleReason: asRecord(row.coverage).staleReason ?? null,
      selectedVintageDate: asRecord(row.coverage).selectedVintageDate ?? null,
    },
    canonicalSelectionRule: RATE_SELECTION_RULE,
    releaseAwareStalenessRule: RATE_STALENESS_RULE_VERSION,
    releaseAwareDisposition: classification === "valid_carry_incorrectly_marked_stale"
      ? "valid_carry_until_newer_eligible_vintage_exists"
      : classification === "legitimate_revision"
        ? "rebuild_snapshot_with_latest_eligible_revised_vintage"
        : classification === "wrong_vintage"
          ? "rebuild_snapshot_with_correct_latest_eligible_vintage"
          : classification === "genuine_missing_observation"
            ? "promotion_blocked_missing_source_observation"
            : "audit_reconstruction_defect_requires_fix",
    fredAsOfFreeze: {
      outputType: 1,
      observationCount: asOfObservations.filter((item) => item.value !== ".").length,
      latestObservationDate: asOfLatest?.date ?? null,
      latestRatePercent: asOfRatePercent,
      latestRealtimeStart: asOfLatest?.realtime_start ?? null,
      latestRealtimeEnd: asOfLatest?.realtime_end ?? null,
    },
    fredInitialRelease: {
      outputType: 4,
      observationCount: initialReleaseObservations.filter((item) => item.value !== ".").length,
      latestObservationDate: initialLatest?.date ?? null,
      latestRatePercent: initialRatePercent,
      latestRealtimeStart: initialLatest?.realtime_start ?? null,
      latestRealtimeEnd: initialLatest?.realtime_end ?? null,
    },
    vintageWindow: {
      realtimeStart: vintageStart,
      realtimeEnd: freezeDate,
      vintageDateCount: vintageDates.length,
      latestVintageDates: vintageDates.slice(-8),
    },
    requestErrors,
    classification,
  };
}

function countBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function completeClassificationCounts(rows: AuditedRateRow[]) {
  const counts = countBy(rows, (row) => row.classification);
  const ordered: Record<RateVintageClassification, number> = {
    legitimate_revision: 0,
    wrong_vintage: 0,
    reconstruction_defect: 0,
    valid_carry_incorrectly_marked_stale: 0,
    genuine_missing_observation: 0,
  };
  for (const key of Object.keys(ordered) as RateVintageClassification[]) {
    ordered[key] = counts[key] ?? 0;
  }
  return ordered;
}

function buildRateReconciliationRepairHistory(rows: AuditedRateRow[]) {
  return ORIGINAL_RATE_RECONSTRUCTION_ANOMALIES.map((anomaly) => {
    const postRepairRow = rows.find((row) =>
      row.currency === anomaly.currency &&
      row.sourceId === anomaly.sourceId &&
      row.freezeDate === anomaly.freezeDate &&
      row.selected.observationDate === anomaly.selectedObservationDate
    );
    return {
      ...anomaly,
      postRepairClassification: postRepairRow?.classification ?? null,
      postRepairDisposition: postRepairRow?.releaseAwareDisposition ?? "not_audited_in_current_limit",
      postRepairSelected: postRepairRow ? {
        observationDate: postRepairRow.selected.observationDate,
        ratePercent: postRepairRow.selected.ratePercent,
        selectedVintageDate: postRepairRow.selected.selectedVintageDate,
      } : null,
      postRepairAsOfFreeze: postRepairRow ? {
        latestObservationDate: postRepairRow.fredAsOfFreeze.latestObservationDate,
        latestRatePercent: postRepairRow.fredAsOfFreeze.latestRatePercent,
        latestRealtimeStart: postRepairRow.fredAsOfFreeze.latestRealtimeStart,
        latestRealtimeEnd: postRepairRow.fredAsOfFreeze.latestRealtimeEnd,
      } : null,
    };
  });
}

function sourceRowsByCurrency(rows: AuditedRateRow[]) {
  const byCurrency = new Map<string, AuditedRateRow[]>();
  for (const row of rows) {
    const sourceRows = byCurrency.get(row.currency) ?? [];
    sourceRows.push(row);
    byCurrency.set(row.currency, sourceRows);
  }
  return byCurrency;
}

function branchContractHash(currency: string, rows: AuditedRateRow[]) {
  const first = rows[0];
  return sha256({
    currency,
    sourceId: first?.sourceId ?? null,
    seriesId: first?.seriesId ?? null,
    instrument: RATE_INSTRUMENT,
    selectionRule: RATE_SELECTION_RULE,
    stalenessRuleVersion: RATE_STALENESS_RULE_VERSION,
    retrievalCapability: "as_of_queryable",
    availabilityPrecision: "date",
    eligibilityPolicy: "latest_eligible_vintage_at_or_before_freeze_date",
    units: "percent",
  });
}

function buildRateFamilyManifest(rows: AuditedRateRow[]): RateFamilyManifest {
  const byCurrency = sourceRowsByCurrency(rows);
  const sourceIds: Record<string, string> = {};
  const seriesIds: Record<string, string> = {};
  const branchContractHashes: Record<string, string> = {};
  for (const currency of REQUIRED_RATE_CURRENCY_SET) {
    const sourceRows = byCurrency.get(currency) ?? [];
    sourceIds[currency] = sourceRows[0]?.sourceId ?? "";
    seriesIds[currency] = sourceRows[0]?.seriesId ?? "";
    branchContractHashes[currency] = branchContractHash(currency, sourceRows);
  }
  const manifestBody: Omit<RateFamilyManifest, "familyManifestHash"> = {
    manifestType: "rate_family_manifest",
    familyManifestId: RATE_FAMILY_MANIFEST_ID,
    familyManifestStatus: "BUILT_DIAGNOSTIC_REBUILD_REQUIRED",
    manifestState: "SEALED",
    diagnosticOnly: true,
    promotionEligible: false,
    outcomeConsumable: false,
    instrument: RATE_INSTRUMENT,
    selectionRule: RATE_SELECTION_RULE,
    stalenessRuleVersion: RATE_STALENESS_RULE_VERSION,
    releaseAwareCarryRule: "Carry the latest eligible vintage known at the weekly freeze until FRED/ALFRED exposes a newer eligible observation vintage at or before that freeze; do not stale solely because a fixed age threshold is exceeded.",
    missingRule: "Missing means no valued observation exists from the contracted endpoint after a query window that includes the selected observation and all eligible vintages through the freeze.",
    revisionRule: "If FRED/ALFRED revises an observation before a later freeze, the later weekly snapshot must use that latest eligible vintage; prior frozen snapshots are not rewritten.",
    requiredCurrencySet: [...REQUIRED_RATE_CURRENCY_SET],
    requiredCurrencySetHash: sha256([...REQUIRED_RATE_CURRENCY_SET]),
    branchContractHashes,
    sourceIds,
    seriesIds,
    classificationCounts: completeClassificationCounts(rows),
    caveats: [
      "This manifest is diagnostic and non-ACTIVE.",
      "Current sealed dataset uses the older fixed-age stale flag and must be rebuilt before RRP promotion.",
      "Currency branches with legitimate revisions require snapshot rebuild under latest eligible vintage as of freeze.",
    ],
  };
  return {
    ...manifestBody,
    familyManifestHash: sha256(manifestBody),
  };
}

function buildRateCurrencyBundleManifests(
  rows: AuditedRateRow[],
  familyManifest: RateFamilyManifest,
): RateCurrencyBundleManifest[] {
  const byCurrency = sourceRowsByCurrency(rows);
  return [...REQUIRED_RATE_CURRENCY_SET].map((currency) => {
    const sourceRows = byCurrency.get(currency) ?? [];
    const classificationCounts = completeClassificationCounts(sourceRows);
    const rebuildRequired = classificationCounts.legitimate_revision > 0 ||
      classificationCounts.wrong_vintage > 0 ||
      classificationCounts.reconstruction_defect > 0 ||
      classificationCounts.genuine_missing_observation > 0;
    const body: Omit<RateCurrencyBundleManifest, "currencyMacroBundleHash"> = {
      manifestType: "currency_macro_bundle_manifest",
      currencyMacroBundleId: `currency_macro_bundle_${currency.toLowerCase()}_rate_diagnostic_v1`,
      bundleScope: "RATE_DIAGNOSTIC",
      bundleState: "PARTIAL_SEALED",
      manifestState: "SEALED",
      diagnosticOnly: true,
      promotionEligible: false,
      outcomeConsumable: false,
      currency,
      rateFamilyManifestId: familyManifest.familyManifestId,
      rateFamilyManifestHash: familyManifest.familyManifestHash,
      rateSourceId: familyManifest.sourceIds[currency] ?? "",
      rateSeriesId: familyManifest.seriesIds[currency] ?? "",
      branchContractHash: familyManifest.branchContractHashes[currency] ?? "",
      rowsAudited: sourceRows.length,
      classificationCounts,
      rebuildRequired,
      missingForRrpPromotion: [
        "rebuilt_rate_weekly_snapshots",
        "real_rate_pressure_attribution_v1",
      ],
    };
    return {
      ...body,
      currencyMacroBundleHash: sha256(body),
    };
  });
}

function markdownCell(value: unknown) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function buildMarkdown(report: JsonRecord) {
  const summary = asRecord(report.summary);
  const files = asRecord(report.files);
  const classificationCounts = asRecord(summary.classificationCounts);
  const sourceCounts = asRecord(summary.sourceCounts);
  const repairHistory = (report.rateReconciliationRepairHistory as unknown[] | undefined ?? [])
    .map((entry) => asRecord(entry));
  const rateFamilyManifest = asRecord(asRecord(report.diagnosticRateManifests).familyManifest);
  const rateCurrencyBundles = (asRecord(report.diagnosticRateManifests).currencyBundleManifests as unknown[] | undefined ?? [])
    .map((manifest) => asRecord(manifest));
  return [
    "# Gate 50 Rate ALFRED Differential Reconstruction Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Macro dataset: ${summary.macroRegimeDatasetId}`,
    `- Stale 3m-rate rows audited: ${summary.rowsAudited}`,
    `- Distinct sources: ${summary.distinctSources}`,
    `- Selection rule: ${summary.selectionRule}`,
    `- Staleness rule version: ${summary.stalenessRuleVersion}`,
    `- Rate family manifest status: ${summary.rateFamilyManifestStatus}`,
    `- Rate family manifest hash: ${summary.rateFamilyManifestHash}`,
    `- Promotion eligible: ${summary.promotionEligible}`,
    `- Outcome consumable: ${summary.outcomeConsumable}`,
    `- Receipt hash: ${summary.receiptHash}`,
    "",
    "## Classification Counts",
    "",
    "| Classification | Count |",
    "|---|---:|",
    ...Object.entries(classificationCounts).map(([key, count]) => `| ${key} | ${count} |`),
    "",
    "## Repair History",
    "",
    "| Anomaly id | Original anomaly | Root cause | Repair version | Post-repair classification |",
    "|---|---|---|---|---|",
    ...repairHistory.map((entry) => [
      entry.anomalyId,
      entry.originalAnomaly,
      entry.rootCause,
      entry.repairVersion,
      entry.postRepairClassification,
    ].map(markdownCell).join(" | ")).map((row) => `| ${row} |`),
    "",
    "## Source Counts",
    "",
    "| Source | Count |",
    "|---|---:|",
    ...Object.entries(sourceCounts).map(([key, count]) => `| ${markdownCell(key)} | ${count} |`),
    "",
    "## Diagnostic Rate Manifests",
    "",
    `- Family manifest: ${rateFamilyManifest.familyManifestId ?? ""}`,
    `- Family manifest hash: ${rateFamilyManifest.familyManifestHash ?? ""}`,
    `- Manifest state: ${rateFamilyManifest.manifestState ?? ""}`,
    `- Diagnostic only: ${rateFamilyManifest.diagnosticOnly ?? ""}`,
    `- Promotion eligible: ${rateFamilyManifest.promotionEligible ?? ""}`,
    `- Outcome consumable: ${rateFamilyManifest.outcomeConsumable ?? ""}`,
    "",
    "| Currency | Bundle id | Rows audited | Rebuild required | Bundle hash |",
    "|---|---|---:|---|---|",
    ...rateCurrencyBundles.map((manifest) => [
      manifest.currency,
      manifest.currencyMacroBundleId,
      manifest.rowsAudited,
      manifest.rebuildRequired,
      manifest.currencyMacroBundleHash,
    ].map(markdownCell).join(" | ")).map((row) => `| ${row} |`),
    "",
    "## Files",
    "",
    `- JSON: ${files.jsonPath}`,
    `- Markdown: ${files.mdPath}`,
    "",
    "This receipt does not compute P&L, strategy filters, macro signals, or promotion activation.",
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!fredKey()) throw new Error("FRED_API_KEY or ALFRED_API_KEY is required.");

  const macroRegimeDatasetId = argValue("macro-regime-dataset-id") ?? DEFAULT_MACRO_DATASET_ID;
  const outDir = argValue("out-dir") ?? DEFAULT_OUT_DIR;
  const jsonOut = argValue("json-out") ?? path.join(outDir, DEFAULT_JSON);
  const mdOut = argValue("md-out") ?? jsonOut.replace(/\.json$/i, ".md");
  const limit = parseIntArg("limit", 0);
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();

  const staleRows = await readStaleRateSnapshots({ macroDatasetId: macroRegimeDatasetId, limit });
  const auditedRows = [];
  for (const [index, row] of staleRows.entries()) {
    auditedRows.push(await auditRow(row));
    if ((index + 1) % 10 === 0 || index + 1 === staleRows.length) {
      console.log(`Audited stale rate rows: ${index + 1}/${staleRows.length}`);
    }
  }

  const rateFamilyManifest = buildRateFamilyManifest(auditedRows);
  const rateCurrencyBundleManifests = buildRateCurrencyBundleManifests(auditedRows, rateFamilyManifest);
  const rateReconciliationRepairHistory = buildRateReconciliationRepairHistory(auditedRows);
  const receiptBody = {
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose: "Differential FRED/ALFRED reconstruction diagnosis for stale canonical 3m-rate rows and diagnostic rate-family manifest proof.",
    controls: {
      noPnlComputed: true,
      noStrategyFilterComputed: true,
      noMacroSignalComputed: true,
      noWarehouseWrites: true,
      noActiveManifestBuilt: true,
      diagnosticNonActiveManifestsBuilt: true,
      outcomeConsumable: false,
      credentialsRedacted: true,
      fredApiKeyAcceptedFrom: process.env.FRED_API_KEY?.trim() ? "FRED_API_KEY" : "ALFRED_API_KEY",
      fredRequestDelayMs: FRED_REQUEST_DELAY_MS,
      fredMaxRetries: FRED_MAX_RETRIES,
    },
    cli: {
      macroRegimeDatasetId,
      limit,
    },
    rateSelectionContract: {
      selectionRule: RATE_SELECTION_RULE,
      selectedWeeklyValue: "latest eligible FRED/ALFRED vintage known at the weekly freeze",
      fredAsOfQuery: "fred/series/observations output_type=1 with realtime_start=realtime_end=freeze date",
      releaseAwareCarryRule: rateFamilyManifest.releaseAwareCarryRule,
      stalenessRuleVersion: RATE_STALENESS_RULE_VERSION,
      fixedAgeRuleDisposition: "superseded_for_rate_3m_market_family_v1",
    },
    rateReconciliationRepairHistory,
    diagnosticRateManifests: {
      status: "SEALED_DIAGNOSTIC_NON_ACTIVE_REBUILD_REQUIRED",
      familyManifest: rateFamilyManifest,
      currencyBundleManifests: rateCurrencyBundleManifests,
      promotionDecision: {
        promotionEligible: false,
        outcomeConsumable: false,
        blockingReason: "RATE_WEEKLY_SNAPSHOTS_NOT_REBUILT_UNDER_LATEST_ELIGIBLE_VINTAGE_RULE",
      },
    },
    rows: auditedRows,
  };
  const receiptHash = sha256({
    ...receiptBody,
    generatedAtUtc: "STABLE_GENERATED_AT_UTC",
  });
  const report = {
    ...receiptBody,
    summary: {
      macroRegimeDatasetId,
      rowsAudited: auditedRows.length,
      distinctSources: new Set(auditedRows.map((row) => row.sourceId)).size,
      classificationCounts: completeClassificationCounts(auditedRows),
      sourceCounts: countBy(auditedRows, (row) => `${row.currency}|${row.sourceId}`),
      selectionRule: RATE_SELECTION_RULE,
      stalenessRuleVersion: RATE_STALENESS_RULE_VERSION,
      rateFamilyManifestStatus: rateFamilyManifest.familyManifestStatus,
      rateFamilyManifestHash: rateFamilyManifest.familyManifestHash,
      currencyBundleManifestBranches: rateCurrencyBundleManifests.length,
      originalRateReconstructionAnomalyCount: rateReconciliationRepairHistory.length,
      unresolvedReconstructionDefectCount: completeClassificationCounts(auditedRows).reconstruction_defect,
      repairVersion: RATE_RECONCILIATION_REPAIR_VERSION,
      overallPromotionStatus: "FAIL_CLOSED",
      promotionEligible: false,
      outcomeConsumable: false,
      nextRequiredBuild: "rebuild_rate_weekly_snapshots_under_latest_eligible_vintage_rule",
      receiptHash,
    },
    files: {
      jsonPath: jsonOut,
      mdPath: mdOut,
    },
  };

  await mkdir(path.dirname(jsonOut), { recursive: true });
  await writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(mdOut, buildMarkdown(report), "utf8");

  console.log(`Gate 50 rate differential receipt wrote ${auditedRows.length} rows`);
  console.log(`JSON: ${path.resolve(jsonOut)}`);
  console.log(`Markdown: ${path.resolve(mdOut)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
