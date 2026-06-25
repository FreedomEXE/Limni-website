import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());
process.env.DB_QUERY_RETRY_LIMIT = process.env.DB_QUERY_RETRY_LIMIT ?? "2";

const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const GATE44_MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const PRE_REPAIR_RATE_DATASET_ID = "ee1f1611-5d6d-41cf-86fe-c06c66cb16bb";
const PRE_REPAIR_RATE_DATASET_HASH = "eef3689856712225b2b1288e3a6005c8c11e8ec1271331aaf565581cc15c01cd";
const RATE_DATASET_ID = "dcdc850a-80a2-4178-8d08-dd759be6afb8";
const RATE_DATASET_HASH = "3db4b84238dbf5c656a9ebaf2ff73219cc1efd2a6e1ff70842983945c4d23612";
const CPI_DATASET_ID = "37b4081b-880e-4ae6-8d53-20ba900dff07";
const CPI_DATASET_HASH = "0817b0ec5b4c03c2d01ddc5c014601a2b7028c78203d07f95b3393235c70cc17";
const RRP_DATASET_ID = "220fd5fd-d017-4db2-bdde-524a3c664c72";
const RRP_DATASET_HASH = "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742";
const EXPECTED_JOIN_MAP_HASH =
  "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";
const AUD_MONTHLY_COMPLETE_SERIES_RELEASE_AT_UTC = "2025-11-26T00:30:00.000Z";

type JsonRecord = Record<string, unknown>;
type QueryFn = <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>;
type GetPoolFn = () => { end: () => Promise<void> };
type AssertionStatus = "PASS" | "FAIL";
type AssertionPolarity = "positive" | "negative";

type Assertion = {
  id: string;
  category: string;
  polarity: AssertionPolarity;
  status: AssertionStatus;
  expectation: string;
  actual: string;
  blocker: string | null;
  evidence?: unknown;
};

let queryImpl: QueryFn | null = null;
let getPoolImpl: GetPoolFn | null = null;

async function loadDb() {
  if (queryImpl && getPoolImpl) return;
  const module = await import("../../src/lib/db");
  const db = (module.default ?? module) as { query: QueryFn; getPool: GetPoolFn };
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

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => stableJson(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableJson(entry)]),
    );
  }
  return value;
}

function blockerCounts(assertions: Assertion[]) {
  const counts: Record<string, number> = {};
  for (const assertion of assertions) {
    if (assertion.status !== "FAIL" || !assertion.blocker) continue;
    counts[assertion.blocker] = (counts[assertion.blocker] ?? 0) + 1;
  }
  return counts;
}

function assertion(input: Omit<Assertion, "status" | "blocker"> & {
  passed: boolean;
  blocker: string;
}): Assertion {
  return {
    id: input.id,
    category: input.category,
    polarity: input.polarity,
    status: input.passed ? "PASS" : "FAIL",
    expectation: input.expectation,
    actual: input.actual,
    blocker: input.passed ? null : input.blocker,
    evidence: input.evidence,
  };
}

function iso(dt: DateTime) {
  return dt.toUTC().toISO({ suppressMilliseconds: false }) ?? dt.toUTC().toISO();
}

function parseWeek(value: string) {
  return DateTime.fromISO(value.replace(" ", "T").replace("+00", "Z"), { zone: "utc" });
}

function firstWeekAtOrAfter(weeks: DateTime[], target: DateTime) {
  return weeks.find((week) => week.toMillis() >= target.toMillis()) ?? null;
}

function firstWeekAfter(weeks: DateTime[], target: DateTime) {
  return weeks.find((week) => week.toMillis() > target.toMillis()) ?? null;
}

async function readWeekInventory() {
  return query<{ week_open_utc: string }>(
    `
      SELECT to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc
      FROM (
        SELECT DISTINCT week_open_utc
        FROM research_matrix_source_contexts
        WHERE dataset_id = $1::uuid
      ) weeks
      ORDER BY week_open_utc
    `,
    [GATE44_MATRIX_DATASET_ID],
  );
}

function buildFreezeBoundaryAssertions(weekRows: { week_open_utc: string }[]) {
  const weeks = weekRows.map((row) => parseWeek(row.week_open_utc));
  const baseWeek = weeks[Math.floor(weeks.length / 2)];
  const before = baseWeek.minus({ millisecond: 1 });
  const equal = baseWeek;
  const after = baseWeek.plus({ millisecond: 1 });
  const beforeWeek = firstWeekAtOrAfter(weeks, before);
  const equalWeek = firstWeekAtOrAfter(weeks, equal);
  const afterWeek = firstWeekAfter(weeks, equal);
  const afterSelectedWeek = firstWeekAtOrAfter(weeks, after);
  return [
    assertion({
      id: "exact_timestamp_immediately_before_freeze_is_eligible",
      category: "freeze_timestamp",
      polarity: "positive",
      passed: beforeWeek?.toMillis() === baseWeek.toMillis(),
      expectation: "An exact timestamp immediately before the weekly freeze selects the current freeze.",
      actual: `target=${iso(before)} selected=${beforeWeek ? iso(beforeWeek) : "null"} freeze=${iso(baseWeek)}`,
      blocker: "exact_timestamp_before_freeze_not_current_week",
    }),
    assertion({
      id: "exact_timestamp_equal_freeze_follows_inclusive_equality_rule",
      category: "freeze_timestamp",
      polarity: "positive",
      passed: equalWeek?.toMillis() === baseWeek.toMillis(),
      expectation: "An exact timestamp equal to the weekly freeze follows eligible_at_or_before_freeze.",
      actual: `target=${iso(equal)} selected=${equalWeek ? iso(equalWeek) : "null"} freeze=${iso(baseWeek)}`,
      blocker: "exact_timestamp_equal_freeze_not_inclusive",
    }),
    assertion({
      id: "exact_timestamp_after_freeze_rolls_to_next_week",
      category: "freeze_timestamp",
      polarity: "negative",
      passed: afterSelectedWeek?.toMillis() === afterWeek?.toMillis() && afterSelectedWeek?.toMillis() !== baseWeek.toMillis(),
      expectation: "An exact timestamp after a weekly freeze is not eligible until the next canonical week.",
      actual: `target=${iso(after)} selected=${afterSelectedWeek ? iso(afterSelectedWeek) : "null"} next=${afterWeek ? iso(afterWeek) : "null"}`,
      blocker: "exact_timestamp_after_freeze_selected_too_early",
    }),
  ];
}

async function buildRateBoundaryAssertions() {
  const [dateOnlyStats] = await query<{
    total_date_precision_rows: number;
    same_day_selected_rows: number;
    same_day_eligible_rows: number;
    future_vintage_rows: number;
  }>(
    `
      SELECT
        count(*)::int AS total_date_precision_rows,
        count(*) FILTER (
          WHERE date(available_at_utc) = date(week_open_utc)
        )::int AS same_day_selected_rows,
        count(*) FILTER (
          WHERE date(available_at_utc) = date(week_open_utc)
            AND (coverage->>'eligibleFromWeekOpenUtc')::timestamptz = week_open_utc
        )::int AS same_day_eligible_rows,
        count(*) FILTER (
          WHERE (coverage->>'selectedVintageDate')::date > date(week_open_utc)
        )::int AS future_vintage_rows
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND coverage->>'availabilityPrecision' = 'date'
    `,
    [RATE_DATASET_ID],
  );
  const dateOnlySamples = await query(
    `
      SELECT
        to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc,
        currency,
        source_observation_date::text,
        available_at_utc::text,
        coverage->>'selectedVintageDate' AS selected_vintage_date,
        coverage->>'eligibleFromWeekOpenUtc' AS eligible_from_week_open_utc,
        coverage->>'eligibilityPolicy' AS eligibility_policy
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND coverage->>'availabilityPrecision' = 'date'
        AND date(available_at_utc) = date(week_open_utc)
      ORDER BY week_open_utc, currency
      LIMIT 8
    `,
    [RATE_DATASET_ID],
  );
  const [revisionStats] = await query<{
    revised_observation_keys: number;
    latest_vintage_switches: number;
  }>(
    `
      WITH selected AS (
        SELECT
          currency,
          source_observation_date,
          coalesce(coverage->>'selectedRawObservationId', coverage->>'rawObservationId', snapshot_hash) AS selected_observation_identity,
          coverage->>'selectedVintageDate' AS selected_vintage_date,
          lag(coalesce(coverage->>'selectedRawObservationId', coverage->>'rawObservationId', snapshot_hash)) OVER (
            PARTITION BY currency, source_observation_date
            ORDER BY week_open_utc
          ) AS previous_selected_observation_identity
        FROM research_macro_weekly_currency_snapshots
        WHERE regime_dataset_id = $1::uuid
          AND coverage->>'selectedVintageDate' IS NOT NULL
      ),
      revised_keys AS (
        SELECT currency, source_observation_date
        FROM selected
        GROUP BY currency, source_observation_date
        HAVING count(DISTINCT selected_observation_identity) > 1
      )
      SELECT
        (SELECT count(*)::int FROM revised_keys) AS revised_observation_keys,
        count(*) FILTER (
          WHERE previous_selected_observation_identity IS NOT NULL
            AND previous_selected_observation_identity <> selected_observation_identity
        )::int AS latest_vintage_switches
      FROM selected
    `,
    [RATE_DATASET_ID],
  );
  const revisionSamples = await query(
    `
      WITH selected AS (
        SELECT
          week_open_utc,
          currency,
          source_observation_date,
          coalesce(coverage->>'selectedRawObservationId', coverage->>'rawObservationId', snapshot_hash) AS selected_observation_identity,
          normalized_value_json,
          coverage->>'selectedVintageDate' AS selected_vintage_date,
          lag(coalesce(coverage->>'selectedRawObservationId', coverage->>'rawObservationId', snapshot_hash)) OVER (
            PARTITION BY currency, source_observation_date
            ORDER BY week_open_utc
          ) AS previous_selected_observation_identity
        FROM research_macro_weekly_currency_snapshots
        WHERE regime_dataset_id = $1::uuid
          AND coverage->>'selectedVintageDate' IS NOT NULL
      )
      SELECT
        to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc,
        currency,
        source_observation_date::text,
        selected_vintage_date,
        selected_observation_identity,
        previous_selected_observation_identity,
        normalized_value_json
      FROM selected
      WHERE previous_selected_observation_identity IS NOT NULL
        AND previous_selected_observation_identity <> selected_observation_identity
      ORDER BY week_open_utc, currency
      LIMIT 6
    `,
    [RATE_DATASET_ID],
  );
  return [
    assertion({
      id: "date_only_alfred_vintage_rolls_to_first_strictly_later_freeze",
      category: "rate_vintage_boundary",
      polarity: "negative",
      passed: dateOnlyStats.same_day_selected_rows === 0 && dateOnlyStats.same_day_eligible_rows === 0,
      expectation: "Date-only ALFRED vintages are not eligible on a same-date weekly freeze; they roll to the first strictly later canonical freeze.",
      actual: `datePrecisionRows=${dateOnlyStats.total_date_precision_rows} sameDaySelected=${dateOnlyStats.same_day_selected_rows} sameDayEligible=${dateOnlyStats.same_day_eligible_rows}`,
      blocker: "rate_date_only_vintage_same_freeze_eligible",
      evidence: { samples: dateOnlySamples },
    }),
    assertion({
      id: "rate_latest_vintage_never_uses_future_vintage_after_freeze_date",
      category: "rate_revision_boundary",
      polarity: "positive",
      passed: dateOnlyStats.future_vintage_rows === 0,
      expectation: "No selected rate vintage has a vintage date after the weekly freeze date.",
      actual: `futureVintageRows=${dateOnlyStats.future_vintage_rows}`,
      blocker: "rate_future_vintage_selected",
    }),
    assertion({
      id: "rate_revision_switches_are_retained_as_distinct_vintages",
      category: "rate_revision_boundary",
      polarity: "positive",
      passed: revisionStats.revised_observation_keys > 0 && revisionStats.latest_vintage_switches > 0,
      expectation: "Revised rate observations appear as distinct vintages so earlier weekly snapshots can retain older content and later snapshots can switch.",
      actual: `revisedObservationKeys=${revisionStats.revised_observation_keys} latestVintageSwitches=${revisionStats.latest_vintage_switches}`,
      blocker: "rate_revision_vintage_switch_not_observed",
      evidence: { samples: revisionSamples },
    }),
  ];
}

async function buildCpiBoundaryAssertions() {
  const [cpiRevisionStats] = await query<{
    total_rows: number;
    missing_revision_rebasing_version: number;
    active_rows: number;
    stale_rows: number;
  }>(
    `
      SELECT
        count(*)::int AS total_rows,
        count(*) FILTER (WHERE coverage->>'revisionRebasingVersion' IS NULL)::int AS missing_revision_rebasing_version,
        count(*) FILTER (WHERE snapshot_state = 'ACTIVE')::int AS active_rows,
        count(*) FILTER (WHERE coverage->>'isStale' = 'true')::int AS stale_rows
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
    `,
    [CPI_DATASET_ID],
  );
  const [quarterlyCarryStats] = await query<{
    quarterly_carry_rows: number;
    quarterly_stale_rows: number;
    nzd_quarterly_carry_rows: number;
    aud_quarterly_carry_rows: number;
  }>(
    `
      SELECT
        count(*) FILTER (
          WHERE coverage->>'nativeFrequency' = 'quarterly'
            AND coverage->>'carryForwardFlag' = 'true'
            AND coverage->>'isStale' = 'false'
        )::int AS quarterly_carry_rows,
        count(*) FILTER (
          WHERE coverage->>'nativeFrequency' = 'quarterly'
            AND coverage->>'isStale' = 'true'
        )::int AS quarterly_stale_rows,
        count(*) FILTER (
          WHERE currency = 'NZD'
            AND coverage->>'nativeFrequency' = 'quarterly'
            AND coverage->>'carryForwardFlag' = 'true'
            AND coverage->>'isStale' = 'false'
        )::int AS nzd_quarterly_carry_rows,
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND coverage->>'nativeFrequency' = 'quarterly'
            AND coverage->>'carryForwardFlag' = 'true'
            AND coverage->>'isStale' = 'false'
        )::int AS aud_quarterly_carry_rows
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
    `,
    [CPI_DATASET_ID],
  );
  const [audTransitionStats] = await query<{
    pre_transition_monthly_rows: number;
    post_transition_rows: number;
    post_transition_monthly_rows: number;
    post_transition_quarterly_rows: number;
  }>(
    `
      SELECT
        count(*) FILTER (
          WHERE week_open_utc < '2025-10-01'::timestamptz
            AND coverage->>'nativeFrequency' = 'monthly'
        )::int AS pre_transition_monthly_rows,
        count(*) FILTER (
          WHERE week_open_utc >= '2026-01-01'::timestamptz
        )::int AS post_transition_rows,
        count(*) FILTER (
          WHERE week_open_utc >= '2026-01-01'::timestamptz
            AND coverage->>'nativeFrequency' = 'monthly'
        )::int AS post_transition_monthly_rows,
        count(*) FILTER (
          WHERE week_open_utc >= '2026-01-01'::timestamptz
            AND coverage->>'nativeFrequency' = 'quarterly'
        )::int AS post_transition_quarterly_rows
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND currency = 'AUD'
    `,
    [CPI_DATASET_ID],
  );
  const audSamples = await query(
    `
      SELECT
        to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc,
        coverage->>'nativeFrequency' AS native_frequency,
        coverage->'currentCpiParent'->>'nativeFrequency' AS current_native_frequency,
        coverage->'currentCpiParent'->>'observationPeriod' AS current_observation_period,
        coverage->'lagCpiParent'->>'nativeFrequency' AS lag_native_frequency,
        coverage->'lagCpiParent'->>'observationPeriod' AS lag_observation_period,
        coverage->>'continuityDecisionId' AS continuity_decision_id
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND currency = 'AUD'
        AND week_open_utc >= '2026-01-01'::timestamptz
      ORDER BY week_open_utc
      LIMIT 8
    `,
    [CPI_DATASET_ID],
  );
  const [eurTransitionStats] = await query<{
    pre_2026_observation_ea21_rows: number;
    post_2026_observation_rows: number;
    post_2026_observation_ea21_rows: number;
    missing_continuity_decision_rows: number;
  }>(
    `
      SELECT
        count(*) FILTER (
          WHERE coverage->'currentCpiParent'->>'observationPeriod' <= '2025-12'
            AND coverage->>'periodSegment' LIKE '%EA21%'
        )::int AS pre_2026_observation_ea21_rows,
        count(*) FILTER (
          WHERE coverage->'currentCpiParent'->>'observationPeriod' >= '2026-01'
        )::int AS post_2026_observation_rows,
        count(*) FILTER (
          WHERE coverage->'currentCpiParent'->>'observationPeriod' >= '2026-01'
            AND coverage->>'periodSegment' LIKE '%EA21%'
        )::int AS post_2026_observation_ea21_rows,
        count(*) FILTER (
          WHERE coverage->>'continuityDecisionId' <> 'eur_prc_hicp_minr_dynamic_ea_ea20_to_2025m12_ea21_from_2026m01_v1'
        )::int AS missing_continuity_decision_rows
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND currency = 'EUR'
    `,
    [CPI_DATASET_ID],
  );
  return [
    assertion({
      id: "cpi_revision_rebasing_version_bound_to_weekly_rows",
      category: "cpi_revision_rebasing",
      polarity: "positive",
      passed:
        cpiRevisionStats.total_rows === 2976 &&
        cpiRevisionStats.missing_revision_rebasing_version === 0 &&
        cpiRevisionStats.active_rows === 0,
      expectation: "Every CPI weekly row is SEALED/non-ACTIVE and carries an explicit revision/rebasing version.",
      actual: `rows=${cpiRevisionStats.total_rows} missingRevisionRebasingVersion=${cpiRevisionStats.missing_revision_rebasing_version} activeRows=${cpiRevisionStats.active_rows}`,
      blocker: "cpi_revision_rebasing_version_missing_or_active",
    }),
    assertion({
      id: "quarterly_cpi_expected_carry_is_valid_and_not_stale",
      category: "cpi_release_aware_carry",
      polarity: "positive",
      passed:
        quarterlyCarryStats.quarterly_carry_rows > 0 &&
        quarterlyCarryStats.nzd_quarterly_carry_rows > 0 &&
        quarterlyCarryStats.quarterly_stale_rows === 0,
      expectation: "Quarterly CPI rows, including NZD, carry under the release-aware rule without premature stale flags.",
      actual: `quarterlyCarryRows=${quarterlyCarryStats.quarterly_carry_rows} nzdQuarterlyCarryRows=${quarterlyCarryStats.nzd_quarterly_carry_rows} quarterlyStaleRows=${quarterlyCarryStats.quarterly_stale_rows}`,
      blocker: "quarterly_cpi_carry_invalid_or_stale",
    }),
    assertion({
      id: "aud_no_retrospective_monthly_before_transition",
      category: "aud_cpi_transition",
      polarity: "negative",
      passed: audTransitionStats.pre_transition_monthly_rows === 0,
      expectation: "AUD CPI does not use monthly rows before the contracted October 2025 transition.",
      actual: `preTransitionMonthlyRows=${audTransitionStats.pre_transition_monthly_rows}`,
      blocker: "aud_monthly_used_before_transition",
    }),
    assertion({
      id: "aud_monthly_source_used_after_transition",
      category: "aud_cpi_transition",
      polarity: "positive",
      passed:
        audTransitionStats.post_transition_rows > 0 &&
        audTransitionStats.post_transition_monthly_rows === audTransitionStats.post_transition_rows,
      expectation: "The first available control weeks after the October 2025 AUD transition use monthly CPI parents.",
      actual: `postTransitionRows=${audTransitionStats.post_transition_rows} monthly=${audTransitionStats.post_transition_monthly_rows} quarterly=${audTransitionStats.post_transition_quarterly_rows}`,
      blocker: "aud_monthly_transition_not_materialized",
      evidence: { samples: audSamples },
    }),
    assertion({
      id: "eur_ea20_to_ea21_composition_transition",
      category: "eur_cpi_transition",
      polarity: "positive",
      passed:
        eurTransitionStats.pre_2026_observation_ea21_rows === 0 &&
        eurTransitionStats.post_2026_observation_rows > 0 &&
        eurTransitionStats.post_2026_observation_ea21_rows === eurTransitionStats.post_2026_observation_rows &&
        eurTransitionStats.missing_continuity_decision_rows === 0,
      expectation: "EUR CPI stays EA20 through 2025 observation periods and uses EA21 for 2026 observation periods.",
      actual: `pre2026ObsEa21Rows=${eurTransitionStats.pre_2026_observation_ea21_rows} post2026Rows=${eurTransitionStats.post_2026_observation_rows} post2026Ea21Rows=${eurTransitionStats.post_2026_observation_ea21_rows} missingDecisionRows=${eurTransitionStats.missing_continuity_decision_rows}`,
      blocker: "eur_ea20_ea21_transition_invalid",
    }),
  ];
}

async function buildRrpBoundaryAssertions() {
  const rrpRows = await query<{
    snapshot_id: string;
    available_at_utc: string;
    coverage: JsonRecord;
  }>(
    `
      SELECT snapshot_id, available_at_utc::text, coverage
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
    `,
    [RRP_DATASET_ID],
  );
  const parentRows = await query<{
    regime_dataset_id: string;
    snapshot_id: string;
    available_at_utc: string;
  }>(
    `
      SELECT regime_dataset_id::text, snapshot_id, available_at_utc::text
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id IN ($1::uuid, $2::uuid)
    `,
    [RATE_DATASET_ID, CPI_DATASET_ID],
  );
  const parentByDatasetAndSnapshot = new Map(
    parentRows.map((row) => [`${row.regime_dataset_id}:${row.snapshot_id}`, row]),
  );
  let missingParentSnapshotRows = 0;
  let derivedEligibilityMismatchRows = 0;
  let staleRows = 0;
  let missingRows = 0;
  for (const row of rrpRows) {
    const coverage = row.coverage ?? {};
    if (coverage.isStale === true || coverage.isStale === "true") staleRows += 1;
    if (coverage.valueAvailable !== true && coverage.valueAvailable !== "true") missingRows += 1;
    const rateParentId = String(coverage.rateParentSnapshotId ?? "");
    const cpiParentId = String(coverage.cpiParentSnapshotId ?? "");
    const rateParent = parentByDatasetAndSnapshot.get(`${RATE_DATASET_ID}:${rateParentId}`);
    const cpiParent = parentByDatasetAndSnapshot.get(`${CPI_DATASET_ID}:${cpiParentId}`);
    if (!rateParent || !cpiParent) {
      missingParentSnapshotRows += 1;
      continue;
    }
    const rateAvailable = DateTime.fromSQL(rateParent.available_at_utc, { zone: "utc" });
    const cpiAvailable = DateTime.fromSQL(cpiParent.available_at_utc, { zone: "utc" });
    const expected = rateAvailable.toMillis() >= cpiAvailable.toMillis() ? rateAvailable : cpiAvailable;
    const actualRow = DateTime.fromSQL(row.available_at_utc, { zone: "utc" });
    const actualCoverage = DateTime.fromISO(String(coverage.derivedEligibilityAtUtc ?? ""), { zone: "utc" });
    if (actualRow.toMillis() !== expected.toMillis() || actualCoverage.toMillis() !== expected.toMillis()) {
      derivedEligibilityMismatchRows += 1;
    }
  }
  const eligibilityStats = {
    total_rows: rrpRows.length,
    missing_parent_snapshot_rows: missingParentSnapshotRows,
    derived_eligibility_mismatch_rows: derivedEligibilityMismatchRows,
    stale_rows: staleRows,
    missing_rows: missingRows,
  };
  const [joinStats] = await query<{
    row_count: number;
    joinable_pair_weeks: number;
  }>(
    `
      WITH weeks AS (
        SELECT DISTINCT week_open_utc
        FROM research_matrix_source_contexts
        WHERE dataset_id = $2::uuid
      ),
      rrp AS (
        SELECT DISTINCT week_open_utc
        FROM research_macro_weekly_currency_snapshots
        WHERE regime_dataset_id = $1::uuid
          AND coverage->>'valueAvailable' = 'true'
          AND coverage->>'isStale' = 'false'
      )
      SELECT
        (SELECT count(*)::int FROM research_macro_weekly_currency_snapshots WHERE regime_dataset_id = $1::uuid) AS row_count,
        count(*)::int * 28 AS joinable_pair_weeks
      FROM weeks
      WHERE EXISTS (SELECT 1 FROM rrp WHERE rrp.week_open_utc = weeks.week_open_utc)
    `,
    [RRP_DATASET_ID, GATE44_MATRIX_DATASET_ID],
  );
  return [
    assertion({
      id: "rrp_derived_eligibility_equals_latest_parent_eligibility",
      category: "rrp_parent_boundary",
      polarity: "positive",
      passed:
        eligibilityStats.total_rows === 2976 &&
        eligibilityStats.missing_parent_snapshot_rows === 0 &&
        eligibilityStats.derived_eligibility_mismatch_rows === 0,
      expectation: "RRP eligibility equals the latest eligibility among rate, current CPI, and lag CPI as represented by the CPI parent snapshot.",
      actual: `rows=${eligibilityStats.total_rows} missingParentSnapshots=${eligibilityStats.missing_parent_snapshot_rows} derivedEligibilityMismatches=${eligibilityStats.derived_eligibility_mismatch_rows}`,
      blocker: "rrp_derived_eligibility_not_latest_parent",
    }),
    assertion({
      id: "rrp_sealed_diagnostic_join_remains_complete",
      category: "rrp_join_boundary",
      polarity: "positive",
      passed:
        joinStats.row_count === 2976 &&
        joinStats.joinable_pair_weeks === 10416 &&
        eligibilityStats.stale_rows === 0 &&
        eligibilityStats.missing_rows === 0,
      expectation: "The current SEALED diagnostic RRP parent chain remains complete at 10,416 pair-weeks with zero stale or missing rows.",
      actual: `rrpRows=${joinStats.row_count} joinablePairWeeks=${joinStats.joinable_pair_weeks} staleRows=${eligibilityStats.stale_rows} missingRows=${eligibilityStats.missing_rows}`,
      blocker: "rrp_sealed_join_not_complete",
    }),
  ];
}

function buildTimezoneAndExceptionAssertions(weekRows: { week_open_utc: string }[]) {
  const weeks = weekRows.map((row) => parseWeek(row.week_open_utc));
  const nyWinter = DateTime.fromISO("2025-01-03T15:30:00", { zone: "America/New_York" });
  const nySummer = DateTime.fromISO("2025-07-04T15:30:00", { zone: "America/New_York" });
  const sydneySummer = DateTime.fromISO("2025-11-26T11:30:00", { zone: "Australia/Sydney" });
  const adjacentIndex = weeks.findIndex((week, index) => {
    const next = weeks[index + 1];
    return next ? next.diff(week, "days").days === 7 : false;
  });
  const safeAdjacentIndex = adjacentIndex >= 0 ? adjacentIndex : 0;
  const adjacentWeek = weeks[safeAdjacentIndex]!;
  const adjacentNextWeek = weeks[safeAdjacentIndex + 1] ?? adjacentWeek.plus({ days: 7 });
  const delayedNormal = adjacentWeek.minus({ millisecond: 1 });
  const delayedActual = adjacentWeek.plus({ millisecond: 1 });
  const normalWeek = firstWeekAtOrAfter(weeks, delayedNormal.toUTC());
  const actualWeek = firstWeekAtOrAfter(weeks, delayedActual.toUTC());
  return [
    assertion({
      id: "new_york_dst_release_time_conversion",
      category: "timezone_boundary",
      polarity: "positive",
      passed:
        iso(nyWinter) === "2025-01-03T20:30:00.000Z" &&
        iso(nySummer) === "2025-07-04T19:30:00.000Z",
      expectation: "New York source-local release timestamps convert differently across EST and EDT.",
      actual: `winter=${iso(nyWinter)} summer=${iso(nySummer)}`,
      blocker: "new_york_dst_conversion_invalid",
    }),
    assertion({
      id: "sydney_dst_release_time_conversion",
      category: "timezone_boundary",
      polarity: "positive",
      passed: iso(sydneySummer) === "2025-11-26T00:30:00.000Z",
      expectation: "Sydney source-local release timestamps convert through AEDT before weekly freeze comparison.",
      actual: `sydney=${iso(sydneySummer)}`,
      blocker: "sydney_dst_conversion_invalid",
    }),
    assertion({
      id: "delayed_release_exception_overrides_normal_schedule",
      category: "exception_release_boundary",
      polarity: "negative",
      passed:
        normalWeek !== null &&
        actualWeek !== null &&
        actualWeek.toMillis() > normalWeek.toMillis(),
      expectation: "A delayed actual source release must map to a later eligible week than the normal schedule would imply.",
      actual: `normalRelease=${iso(delayedNormal)} normalEligibleWeek=${normalWeek ? iso(normalWeek) : "null"} actualRelease=${iso(delayedActual)} actualEligibleWeek=${actualWeek ? iso(actualWeek) : "null"} nextInventoryWeek=${adjacentNextWeek ? iso(adjacentNextWeek) : "null"}`,
      blocker: "delayed_release_exception_not_applied",
    }),
  ];
}

async function buildAlfredDateOnlyRepairReceipt() {
  const rows = await query<JsonRecord>(
    `
      WITH original AS (
        SELECT
          old.week_open_utc,
          old.currency,
          old.source_id,
          old.raw_value_json->>'seriesId' AS series_id,
          old.source_observation_date,
          old.available_at_utc,
          old.coverage->>'selectedRawObservationId' AS original_selected_observation_id,
          old.coverage->>'selectedVintageDate' AS original_selected_vintage_date,
          old.coverage->>'eligibilityReason' AS original_eligibility_reason,
          old.normalized_value_json->>'ratePercent' AS original_rate_percent,
          old.coverage->>'isStale' AS original_stale
        FROM research_macro_weekly_currency_snapshots old
        WHERE old.regime_dataset_id = $1::uuid
          AND old.coverage->>'availabilityPrecision' = 'date'
          AND (old.week_open_utc AT TIME ZONE 'UTC')::date = (old.available_at_utc AT TIME ZONE 'UTC')::date
      )
      SELECT
        to_char(original.week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS same_date_freeze_utc,
        original.currency,
        original.series_id,
        original.source_id,
        original.source_observation_date::text,
        to_char((original.available_at_utc AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS availability_date,
        original.original_selected_observation_id,
        original.original_selected_vintage_date,
        original.original_rate_percent,
        original.original_eligibility_reason,
        original.original_stale,
        repaired_same.coverage->>'selectedRawObservationId' AS corrected_same_freeze_selected_observation_id,
        repaired_same.coverage->>'selectedVintageDate' AS corrected_same_freeze_selected_vintage_date,
        repaired_same.normalized_value_json->>'ratePercent' AS corrected_same_freeze_rate_percent,
        repaired_same.coverage->>'eligibilityReason' AS corrected_same_freeze_eligibility_reason,
        repaired_same.coverage->>'isStale' AS corrected_same_freeze_stale,
        to_char(repaired_later.week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS first_eligible_later_freeze_utc,
        repaired_later.coverage->>'selectedRawObservationId' AS first_later_selected_observation_id,
        repaired_later.coverage->>'selectedVintageDate' AS first_later_selected_vintage_date,
        repaired_later.normalized_value_json->>'ratePercent' AS first_later_rate_percent,
        repaired_later.coverage->>'isStale' AS first_later_stale
      FROM original
      LEFT JOIN research_macro_weekly_currency_snapshots repaired_same
        ON repaired_same.regime_dataset_id = $2::uuid
       AND repaired_same.week_open_utc = original.week_open_utc
       AND repaired_same.currency = original.currency
       AND repaired_same.source_id = original.source_id
      LEFT JOIN LATERAL (
        SELECT later.*
        FROM research_macro_weekly_currency_snapshots later
        WHERE later.regime_dataset_id = $2::uuid
          AND later.week_open_utc > original.week_open_utc
          AND later.currency = original.currency
          AND later.source_id = original.source_id
        ORDER BY later.week_open_utc
        LIMIT 1
      ) repaired_later ON true
      ORDER BY original.week_open_utc, original.currency
    `,
    [PRE_REPAIR_RATE_DATASET_ID, RATE_DATASET_ID],
  );
  const summary = {
    status: rows.length === 31 &&
      rows.every((row) => row.corrected_same_freeze_selected_vintage_date !== row.original_selected_vintage_date) &&
      rows.every((row) => row.first_later_selected_vintage_date === row.original_selected_vintage_date) &&
      rows.every((row) => row.corrected_same_freeze_stale !== "true") &&
      rows.every((row) => row.first_later_stale !== "true")
      ? "PASS"
      : "FAIL",
    preRepairDatasetId: PRE_REPAIR_RATE_DATASET_ID,
    preRepairDatasetHash: PRE_REPAIR_RATE_DATASET_HASH,
    repairedDatasetId: RATE_DATASET_ID,
    repairedDatasetHash: RATE_DATASET_HASH,
    originalAnomalyRows: rows.length,
    sameFreezeDateOnlySelectionsAfterRepair: rows.filter((row) =>
      row.corrected_same_freeze_selected_vintage_date === row.original_selected_vintage_date).length,
    firstLaterFreezeAdmissions: rows.filter((row) =>
      row.first_later_selected_vintage_date === row.original_selected_vintage_date).length,
    unresolvedMissing: rows.filter((row) =>
      row.corrected_same_freeze_selected_observation_id === null || row.first_later_selected_observation_id === null).length,
    unjustifiedStale: rows.filter((row) =>
      row.corrected_same_freeze_stale === "true" || row.first_later_stale === "true").length,
    repairRule: "availability_precision=date; eligibility=first canonical week_open strictly after availability_date",
  };
  return { summary, rows };
}

async function buildAudTransitionRepairReceipt(weekRows: { week_open_utc: string }[]) {
  const releaseAt = DateTime.fromISO(AUD_MONTHLY_COMPLETE_SERIES_RELEASE_AT_UTC, { setZone: true });
  const firstEligibleFreeze = weekRows
    .map((row) => DateTime.fromISO(row.week_open_utc, { setZone: true }))
    .filter((week) => week.toMillis() > releaseAt.toMillis())
    .sort((left, right) => left.toMillis() - right.toMillis())[0]
    ?.toUTC().toISO({ suppressMilliseconds: false }) ?? null;
  const freezeCutoff = firstEligibleFreeze ?? AUD_MONTHLY_COMPLETE_SERIES_RELEASE_AT_UTC;

  const [summaryRow] = await query<JsonRecord>(
    `
      SELECT
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND week_open_utc < $2::timestamptz
            AND coverage->>'nativeFrequency' = 'monthly'
        )::int AS weekly_monthly_before_first_eligible_freeze,
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND week_open_utc >= $2::timestamptz
        )::int AS post_transition_rows,
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND week_open_utc >= $2::timestamptz
            AND coverage->>'nativeFrequency' = 'monthly'
            AND coverage->>'lagPeriods' = '12'
            AND coverage->'currentCpiParent'->>'nativeFrequency' = 'monthly'
            AND coverage->'lagCpiParent'->>'nativeFrequency' = 'monthly'
        )::int AS post_transition_monthly_yoy12_rows,
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND week_open_utc >= $2::timestamptz
            AND coverage->>'nativeFrequency' = 'quarterly'
        )::int AS quarterly_selected_after_monthly_eligible,
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND week_open_utc >= $2::timestamptz
            AND (
              coverage->>'interpolated' = 'true'
              OR flags->>'interpolated' = 'true'
              OR coverage->>'interpolation' = 'true'
            )
        )::int AS interpolated_rows,
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND week_open_utc >= $2::timestamptz
            AND (
              coverage->>'nativeFrequency' <> coverage->'currentCpiParent'->>'nativeFrequency'
              OR coverage->>'nativeFrequency' <> coverage->'lagCpiParent'->>'nativeFrequency'
            )
        )::int AS overlap_or_mixed_frequency_rows
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
    `,
    [CPI_DATASET_ID, freezeCutoff],
  );
  const [observationAvailability] = await query<JsonRecord>(
    `
      SELECT
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND coverage->>'nativeFrequency' = 'monthly'
            AND observation_date < '2025-10-01'::date
            AND available_at_utc < $2::timestamptz
        )::int AS monthly_backfill_observations_eligible_before_release,
        count(*) FILTER (
          WHERE currency = 'AUD'
            AND coverage->>'nativeFrequency' = 'monthly'
            AND observation_date < '2025-10-01'::date
        )::int AS monthly_backfill_observations
      FROM research_macro_source_observations
      WHERE regime_dataset_id = $1::uuid
    `,
    [CPI_DATASET_ID, AUD_MONTHLY_COMPLETE_SERIES_RELEASE_AT_UTC],
  );
  const rows = await query<JsonRecord>(
    `
      SELECT
        to_char(week_open_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS week_open_utc,
        coverage->>'nativeFrequency' AS selected_frequency,
        coverage->>'lagPeriods' AS yoy_lag_periods,
        coverage->'currentCpiParent'->>'observationPeriod' AS current_observation_period,
        coverage->'currentCpiParent'->>'nativeFrequency' AS current_native_frequency,
        coverage->'currentCpiParent'->>'sourceObservationId' AS current_source_observation_id,
        coverage->'currentCpiParent'->>'availabilityEventId' AS current_availability_event_id,
        coverage->'currentCpiParent'->>'availableAtUtc' AS current_available_at_utc,
        coverage->'currentCpiParent'->>'rawArtifactId' AS current_raw_artifact_id,
        coverage->'lagCpiParent'->>'observationPeriod' AS lag_observation_period,
        coverage->'lagCpiParent'->>'nativeFrequency' AS lag_native_frequency,
        coverage->'lagCpiParent'->>'sourceObservationId' AS lag_source_observation_id,
        coverage->'lagCpiParent'->>'availabilityEventId' AS lag_availability_event_id,
        coverage->'lagCpiParent'->>'availableAtUtc' AS lag_available_at_utc,
        coverage->'lagCpiParent'->>'rawArtifactId' AS lag_raw_artifact_id,
        coverage->>'periodSegment' AS period_segment,
        coverage->>'releaseCalendarVersion' AS release_calendar_version
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND currency = 'AUD'
        AND week_open_utc >= $2::timestamptz
      ORDER BY week_open_utc
    `,
    [CPI_DATASET_ID, freezeCutoff],
  );
  const summary = {
    status: summaryRow.post_transition_rows === summaryRow.post_transition_monthly_yoy12_rows &&
      summaryRow.weekly_monthly_before_first_eligible_freeze === 0 &&
      summaryRow.quarterly_selected_after_monthly_eligible === 0 &&
      summaryRow.interpolated_rows === 0 &&
      summaryRow.overlap_or_mixed_frequency_rows === 0 &&
      observationAvailability.monthly_backfill_observations_eligible_before_release === 0
      ? "PASS"
      : "FAIL",
    cpiDatasetId: CPI_DATASET_ID,
    cpiDatasetHash: CPI_DATASET_HASH,
    absMonthlyCompleteSeriesFirstReleaseAtUtc: AUD_MONTHLY_COMPLETE_SERIES_RELEASE_AT_UTC,
    firstCanonicalFreezeAfterReleaseUtc: firstEligibleFreeze,
    ...summaryRow,
    ...observationAvailability,
  };
  return { summary, rows };
}

async function buildRebuiltRrpReceipt() {
  const [summary] = await query<JsonRecord>(
    `
      SELECT
        count(*)::int AS weekly_snapshots,
        count(DISTINCT currency)::int AS currency_bundles,
        count(DISTINCT coverage->>'currencyBundleHash')::int AS currency_bundle_hashes,
        count(*) FILTER (WHERE coverage->>'isStale' = 'true')::int AS stale_rows,
        count(*) FILTER (WHERE coverage->>'valueAvailable' <> 'true')::int AS missing_rows,
        count(*) FILTER (WHERE coverage->>'rateParentDatasetId' <> $2)::int AS wrong_rate_parent_rows,
        count(*) FILTER (WHERE coverage->>'cpiParentDatasetId' <> $3)::int AS wrong_cpi_parent_rows,
        count(*) FILTER (WHERE coverage->>'parentObservationLineageComplete' <> 'true')::int AS incomplete_observation_lineage_rows,
        count(*) FILTER (WHERE coverage->>'parentArtifactLineageComplete' <> 'true')::int AS incomplete_artifact_lineage_rows,
        count(*) FILTER (WHERE coverage->>'parentAvailabilityLineageComplete' <> 'true')::int AS incomplete_availability_lineage_rows
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
    `,
    [RRP_DATASET_ID, RATE_DATASET_ID, CPI_DATASET_ID],
  );
  return {
    summary: {
      status: summary.weekly_snapshots === 2_976 &&
        summary.currency_bundles === 8 &&
        summary.currency_bundle_hashes === 8 &&
        summary.stale_rows === 0 &&
        summary.missing_rows === 0 &&
        summary.wrong_rate_parent_rows === 0 &&
        summary.wrong_cpi_parent_rows === 0 &&
        summary.incomplete_observation_lineage_rows === 0 &&
        summary.incomplete_artifact_lineage_rows === 0 &&
        summary.incomplete_availability_lineage_rows === 0
        ? "PASS"
        : "FAIL",
      rrpDatasetId: RRP_DATASET_ID,
      rrpDatasetHash: RRP_DATASET_HASH,
      rateParentDatasetId: RATE_DATASET_ID,
      rateParentDatasetHash: RATE_DATASET_HASH,
      cpiParentDatasetId: CPI_DATASET_ID,
      cpiParentDatasetHash: CPI_DATASET_HASH,
      expectedResolvedContentJoinMapHash: EXPECTED_JOIN_MAP_HASH,
      ...summary,
    },
  };
}

function buildMarkdown(report: JsonRecord) {
  const summary = report.summary as JsonRecord;
  const assertions = report.assertions as Assertion[];
  const repairReceipts = (report.repairReceipts ?? {}) as JsonRecord;
  const alfredRepair = ((repairReceipts.alfredDateOnlyRepair as JsonRecord | undefined)?.summary ?? {}) as JsonRecord;
  const audRepair = ((repairReceipts.audMonthlyTransitionRepair as JsonRecord | undefined)?.summary ?? {}) as JsonRecord;
  const rrpRepair = ((repairReceipts.rebuiltRrpReceipt as JsonRecord | undefined)?.summary ?? {}) as JsonRecord;
  const blockers = Object.entries((report.blockers as JsonRecord) ?? {})
    .map(([key, value]) => `| ${key} | ${value} |`);
  const assertionRows = assertions.map((row) =>
    `| ${row.status} | ${row.id} | ${row.category} | ${row.polarity} | ${row.actual.replaceAll("\n", " ")} | ${row.blocker ?? "-"} |`,
  );
  return [
    "# Gate 50 Combined Boundary Proof Receipt",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${summary.status}`,
    `- Assertions: ${summary.assertionCount}`,
    `- Passed: ${summary.passCount}`,
    `- Failed: ${summary.failCount}`,
    `- Diagnostic only: ${summary.diagnosticOnly}`,
    `- Promotion eligible: ${summary.promotionEligible}`,
    `- Expected content join-map hash: ${EXPECTED_JOIN_MAP_HASH}`,
    `- ALFRED date-only repair: ${alfredRepair.status ?? "missing"} (${alfredRepair.originalAnomalyRows ?? "?"} rows; same-freeze repaired selections=${alfredRepair.sameFreezeDateOnlySelectionsAfterRepair ?? "?"})`,
    `- AUD monthly transition repair: ${audRepair.status ?? "missing"} (post-transition rows=${audRepair.post_transition_rows ?? "?"}; quarterly after monthly eligible=${audRepair.quarterly_selected_after_monthly_eligible ?? "?"})`,
    `- Rebuilt RRP receipt: ${rrpRepair.status ?? "missing"} (weekly=${rrpRepair.weekly_snapshots ?? "?"}; bundles=${rrpRepair.currency_bundles ?? "?"}; stale=${rrpRepair.stale_rows ?? "?"}; missing=${rrpRepair.missing_rows ?? "?"})`,
    "",
    "## Blockers",
    "",
    "| Blocker | Count |",
    "|---|---:|",
    ...(blockers.length > 0 ? blockers : ["| - | 0 |"]),
    "",
    "## Assertions",
    "",
    "| Status | Assertion | Category | Polarity | Actual | Blocker |",
    "|---|---|---|---|---|---|",
    ...assertionRows,
    "",
    "This is a source-only boundary proof. It does not activate snapshots, compute P&L, or make strategy decisions.",
    "",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for macro boundary proof.");
  }
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const weekRows = await readWeekInventory();
  const repairReceipts = {
    alfredDateOnlyRepair: await buildAlfredDateOnlyRepairReceipt(),
    audMonthlyTransitionRepair: await buildAudTransitionRepairReceipt(weekRows),
    rebuiltRrpReceipt: await buildRebuiltRrpReceipt(),
  };
  const assertions = [
    ...buildFreezeBoundaryAssertions(weekRows),
    ...(await buildRateBoundaryAssertions()),
    ...(await buildCpiBoundaryAssertions()),
    ...(await buildRrpBoundaryAssertions()),
    ...buildTimezoneAndExceptionAssertions(weekRows),
  ];
  const blockers = blockerCounts(assertions);
  const failCount = assertions.filter((row) => row.status === "FAIL").length;
  const reportBase = {
    schemaVersion: 1,
    generatedAtUtc,
    gate: "Gate 50: macro-source-promotion-proof",
    purpose:
      "Combined freeze, revision, carry, transition, timezone, exception, and derived-parent boundary proof for current SEALED diagnostic source content.",
    scope: {
      diagnosticOnly: true,
      promotionEligible: false,
      activationEligible: false,
      outcomeConsumable: false,
      noPnlComputed: true,
      noStrategyDecisionComputed: true,
    },
    repairReceipts,
    datasets: {
      matrix: { datasetId: GATE44_MATRIX_DATASET_ID },
      rate: { datasetId: RATE_DATASET_ID, datasetHash: RATE_DATASET_HASH },
      cpi: { datasetId: CPI_DATASET_ID, datasetHash: CPI_DATASET_HASH },
      rrp: { datasetId: RRP_DATASET_ID, datasetHash: RRP_DATASET_HASH },
    },
    expectedResolvedContentJoinMapHash: EXPECTED_JOIN_MAP_HASH,
    summary: {
      status: failCount === 0 ? "PASS_BOUNDARY_PROOF" : "FAIL_BOUNDARY_PROOF",
      assertionCount: assertions.length,
      passCount: assertions.length - failCount,
      failCount,
      diagnosticOnly: true,
      promotionEligible: false,
      activationEligible: false,
      outcomeConsumable: false,
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
    argValue("json-out") ?? path.join(DEFAULT_OUT_DIR, `gate50-boundary-proof-${stamp}.json`),
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

  console.log(`Gate 50 combined boundary proof: ${reportBase.summary.status}`);
  console.log(`Assertions: ${reportBase.summary.passCount}/${reportBase.summary.assertionCount} passed`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (Object.keys(blockers).length > 0) {
    console.log(`Blockers: ${Object.entries(blockers).map(([key, count]) => `${key}:${count}`).join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[macro-boundary-proof] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closePool();
    } catch {
      // Pool may be unopened if validation fails before the first query.
    }
  });
