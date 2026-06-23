import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { getPool, query } from "@/lib/db";

loadEnvConfig(process.cwd());

const GATE = "Gate 51D: rrp-decomposition-against-locked-selectors";
const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const SELECTOR_LOCKDOWN_RECEIPT =
  "app/reports/data-verification/macro-regime/gate51-selector-candidate-lockdown-20260623T182917.json";
const GATE50_ACTIVE_JOIN_RECEIPT =
  "app/reports/data-verification/macro-regime/gate50-rrp-active-join-control-repaired-20260623.json";

const MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const MATRIX_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
const RRP_DATASET_ID = "220fd5fd-d017-4db2-bdde-524a3c664c72";
const RRP_DATASET_HASH = "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742";
const SOURCE_CONTENT_INVARIANT_HASH = "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";
const FINAL_ACTIVE_RESOLVED_CONTENT_JOIN_MAP_HASH =
  "08723c62e089eddab7cde243a64283c9dd6bc0ebee01a070cfb32e4cb27fdbc7";
const SELECTOR_LOCKDOWN_RECEIPT_HASH = "bd438c8d003ca01193943d4c05dc68b1dc8c44c553e96be04e0a9d43d4ec9418";
const FEATURE_BUNDLE_ID = "real_rate_pressure_attribution_v1";
const DECOMPOSITION_AXIS_MANIFEST_VERSION = "gate51d_rrp_decomposition_axes_v1_warning_governed";
const RRP_CONFIRM_THRESHOLD_PERCENT = 1;
const MIN_CELL_ROWS = 50;
const MIN_CELL_ACTIVE_WEEKS = 20;

const CLP_SELECTOR_ID = "cot_lifecycle_polarity_v0_noncomm_primary";
const CLP_EXECUTION_HARNESS_VARIANT_ID = "cot_faces_v1_commercial_delta_contrarian_selected";
const SFA_SELECTOR_ID = "strength_friday_snapshot_open_canonical_fade_agree";
const FSA_SELECTOR_ID = "strength_friday_snapshot_selected";

type JsonRecord = Record<string, unknown>;
type Direction = "LONG" | "SHORT";
type SelectorRole = "locked_cot_research_candidate" | "locked_strength_research_candidate" | "simple_strength_benchmark";
type RrpMask = "supportive" | "adverse" | "neutral";
type RrpBucket = "confirm" | "fade" | "weak";
type LifecyclePolarityBucket = "fade_extreme" | "fade_lean" | "neutral_mixed" | "with_lean" | "with_extreme";
type SampleSupport = "passes_minimum_sample" | "exploratory_low_support";

type CliOptions = {
  mode: "smoke" | "full";
  outDir: string;
  jsonOut: string | null;
  mdOut: string | null;
  top: number;
};

type MatrixDatasetRow = {
  dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  status: string;
  from_utc: Date | string;
  to_utc: Date | string;
};

type MacroDatasetRow = {
  regime_dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  status: string;
  snapshot_state: string;
};

type VariantRunRow = {
  variant_run_id: string;
  variant_id: string;
  variant_label: string;
};

type WeekResultRow = {
  variant_run_id: string;
  variant_id: string;
  variant_label: string;
  week_open_utc: Date | string;
  pair_contributions: JsonRecord;
};

type PairDecisionRow = {
  variant_run_id: string;
  variant_id: string;
  week_open_utc: Date | string;
  symbol: string;
  selected_side: Direction;
};

type RrpSnapshotRow = {
  week_open_utc: Date | string;
  currency: string;
  real_rate_percent: string | number | null;
};

type CotSnapshotRow = {
  report_date: Date | string;
  currencies: Record<string, JsonRecord>;
};

type CurrencyLifecycleState = {
  reportDate: string;
  currency: string;
  tei: number;
};

type RrpFeature = {
  weekOpenUtc: string;
  currency: string;
  levelPercent: number;
  rank: number;
  percentile: number;
  changePercent: number | null;
};

type SelectorDefinition = {
  selectorId: string;
  label: string;
  role: SelectorRole;
  benchmarkOnly: boolean;
  matrixVariantId: string;
  executionHarnessVariantId: string;
};

type DecompositionRow = {
  selectorId: string;
  selectorLabel: string;
  selectorRole: SelectorRole;
  benchmarkOnly: boolean;
  matrixVariantId: string;
  executionHarnessVariantId: string;
  weekOpenUtc: string;
  year: string;
  symbol: string;
  base: string;
  quote: string;
  selectedSide: Direction;
  pairContributionAdr: number;
  zeroFilledPairContribution: boolean;
  selectedCurrency: string;
  oppositeCurrency: string;
  baseRrpLevelPercent: number;
  quoteRrpLevelPercent: number;
  selectedRrpLevelPercent: number;
  oppositeRrpLevelPercent: number;
  selectedRrpRank: number;
  oppositeRrpRank: number;
  selectedRrpPercentile: number;
  oppositeRrpPercentile: number;
  pairRrpDifferentialPercent: number;
  selectedSideRrpAlignmentPercent: number;
  absoluteRrpSpreadPercent: number;
  baseRankMinusQuoteRank: number;
  selectedRankAdvantage: number;
  selectedRrpChangePercent: number | null;
  oppositeRrpChangePercent: number | null;
  selectedMomentumAdvantagePercent: number | null;
  rrpMask: RrpMask;
  confirmFadeWeak: RrpBucket;
  clpReportDate: string | null;
  clpSignedSpread: number | null;
  clpLifecyclePolarityBucket: LifecyclePolarityBucket | null;
};

type MetricRow = {
  selectorId: string;
  selectorRole: SelectorRole;
  benchmarkOnly: boolean;
  axisId: string;
  bucket: string;
  selectedRows: number;
  activeWeeks: number;
  minimumRowsRequired: number;
  minimumActiveWeeksRequired: number;
  passesMinimumRows: boolean;
  passesMinimumActiveWeeks: boolean;
  sampleSupport: SampleSupport;
  totalAdr: number;
  maxDrawdownAdr: number;
  returnToDrawdown: number | null;
  pathSharpeAdr: number | null;
  profitFactorAdr: number | null;
  weeklyWinRateActive: number | null;
  avgAdrPerPair: number | null;
  zeroFilledRows: number;
  positiveYears: number;
  yearCount: number;
  positiveYearRate: number | null;
  worstYear: string | null;
  worstYearAdr: number | null;
  topPair: string | null;
  topPairAbsShare: number | null;
  topCurrency: string | null;
  topCurrencyAbsShare: number | null;
  yearAdr: Record<string, number>;
};

type CoverageRow = {
  selectorId: string;
  selectorRole: SelectorRole;
  benchmarkOnly: boolean;
  selectedDecisionRows: number;
  computedRows: number;
  expectedWarmupRows: number;
  trueMissingLifecycleRows: number;
  missingRrpRows: number;
  missingWeekResultRows: number;
  zeroFilledRows: number;
  denominatorPolicy: "valid_required_state_rows_only";
  lifecycleHandlingPolicy: "exclude_expected_warmup_and_true_missing_as_unavailable";
  missingRowsIncludedAsNeutral: false;
  missingRowsIncludedAsUnavailable: true;
  validLifecycleRowsRequired: boolean;
  denominatorImpactPct: number | null;
};

const SELECTORS: SelectorDefinition[] = [
  {
    selectorId: CLP_SELECTOR_ID,
    label: "COT Lifecycle Polarity",
    role: "locked_cot_research_candidate",
    benchmarkOnly: false,
    matrixVariantId: CLP_SELECTOR_ID,
    executionHarnessVariantId: CLP_EXECUTION_HARNESS_VARIANT_ID,
  },
  {
    selectorId: SFA_SELECTOR_ID,
    label: "Strength Fade Accord",
    role: "locked_strength_research_candidate",
    benchmarkOnly: false,
    matrixVariantId: SFA_SELECTOR_ID,
    executionHarnessVariantId: SFA_SELECTOR_ID,
  },
  {
    selectorId: FSA_SELECTOR_ID,
    label: "Friday Strength Anchor",
    role: "simple_strength_benchmark",
    benchmarkOnly: true,
    matrixVariantId: FSA_SELECTOR_ID,
    executionHarnessVariantId: FSA_SELECTOR_ID,
  },
];

const DECOMPOSITION_AXES = [
  {
    axisId: "rrp_level",
    label: "RRP level",
    inputFields: ["selectedRrpLevelPercent"],
    smokeBuckets: ["negative", "zero_to_one", "one_to_two", "two_plus"],
  },
  {
    axisId: "rrp_rank_percentile",
    label: "RRP rank / percentile",
    inputFields: ["selectedRrpRank", "selectedRrpPercentile"],
    smokeBuckets: ["bottom_quartile", "middle_half", "top_quartile"],
  },
  {
    axisId: "pair_rrp_differential",
    label: "Pair RRP differential",
    inputFields: ["pairRrpDifferentialPercent", "selectedSideRrpAlignmentPercent"],
    smokeBuckets: ["supportive", "adverse", "neutral"],
  },
  {
    axisId: "spread_rank_spread",
    label: "RRP spread / rank spread",
    inputFields: ["absoluteRrpSpreadPercent", "baseRankMinusQuoteRank", "selectedRankAdvantage"],
    smokeBuckets: ["selected_rank_advantage", "selected_rank_disadvantage", "same_rank"],
  },
  {
    axisId: "momentum_change",
    label: "RRP momentum / change",
    inputFields: ["selectedRrpChangePercent", "oppositeRrpChangePercent", "selectedMomentumAdvantagePercent"],
    smokeBuckets: ["positive_momentum_advantage", "negative_momentum_advantage", "flat_or_unknown"],
  },
  {
    axisId: "supportive_adverse_neutral_masks",
    label: "Supportive / adverse / neutral masks",
    inputFields: ["rrpMask"],
    smokeBuckets: ["supportive", "adverse", "neutral"],
  },
  {
    axisId: "confirm_fade_weak",
    label: "Confirm / fade / weak against locked selector side",
    inputFields: ["confirmFadeWeak"],
    smokeBuckets: ["confirm", "fade", "weak"],
  },
] as const;

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseCli(): CliOptions {
  const mode = argValue("mode") === "full" ? "full" : "smoke";
  return {
    mode,
    outDir: argValue("out-dir") ?? DEFAULT_OUT_DIR,
    jsonOut: argValue("json-out"),
    mdOut: argValue("md-out"),
    top: parsePositiveInt(argValue("top"), 10),
  };
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

function sha256Stable(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableJson(value))).digest("hex");
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isoUtc(value: Date | string | null | undefined) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return null;
}

function dateKey(value: Date | string | null | undefined) {
  const iso = isoUtc(value);
  return iso ? iso.slice(0, 10) : null;
}

function round(value: number | null | undefined, digits = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePair(symbol: string) {
  const clean = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  return { base: clean.slice(0, 3), quote: clean.slice(3, 6) };
}

function rrpMaskFor(alignmentPercent: number): RrpMask {
  if (alignmentPercent >= RRP_CONFIRM_THRESHOLD_PERCENT) return "supportive";
  if (alignmentPercent <= -RRP_CONFIRM_THRESHOLD_PERCENT) return "adverse";
  return "neutral";
}

function rrpBucketFor(mask: RrpMask): RrpBucket {
  if (mask === "supportive") return "confirm";
  if (mask === "adverse") return "fade";
  return "weak";
}

function lifecyclePolarityBucket(value: number): LifecyclePolarityBucket {
  if (value <= -30) return "fade_extreme";
  if (value <= -10) return "fade_lean";
  if (value >= 30) return "with_extreme";
  if (value >= 10) return "with_lean";
  return "neutral_mixed";
}

function levelBucket(value: number) {
  if (value < 0) return "negative";
  if (value < 1) return "zero_to_one";
  if (value < 2) return "one_to_two";
  return "two_plus";
}

function percentileBucket(value: number) {
  if (value >= 0.75) return "top_quartile";
  if (value <= 0.25) return "bottom_quartile";
  return "middle_half";
}

function rankSpreadBucket(value: number) {
  if (value > 0) return "selected_rank_advantage";
  if (value < 0) return "selected_rank_disadvantage";
  return "same_rank";
}

function momentumBucket(value: number | null) {
  if (value === null || Math.abs(value) < 1e-9) return "flat_or_unknown";
  return value > 0 ? "positive_momentum_advantage" : "negative_momentum_advantage";
}

function bucketForAxis(row: DecompositionRow, axisId: string) {
  switch (axisId) {
    case "rrp_level":
      return levelBucket(row.selectedRrpLevelPercent);
    case "rrp_rank_percentile":
      return percentileBucket(row.selectedRrpPercentile);
    case "pair_rrp_differential":
    case "supportive_adverse_neutral_masks":
      return row.rrpMask;
    case "spread_rank_spread":
      return rankSpreadBucket(row.selectedRankAdvantage);
    case "momentum_change":
      return momentumBucket(row.selectedMomentumAdvantagePercent);
    case "confirm_fade_weak":
      return row.confirmFadeWeak;
    default:
      return "unknown";
  }
}

async function readJson(pathname: string) {
  const raw = await readFile(pathname, "utf8");
  return { parsed: JSON.parse(raw) as JsonRecord, raw };
}

async function readSelectorLockdownReceipt() {
  const { parsed, raw } = await readJson(SELECTOR_LOCKDOWN_RECEIPT);
  const decision = parsed.decision as JsonRecord | undefined;
  const identity = parsed.identity as JsonRecord | undefined;
  const blockers = [
    parsed.status !== "PASS_SELECTOR_CANDIDATE_LOCKDOWN_DIAGNOSTIC" ? "selector_lockdown_not_pass" : null,
    parsed.receiptHash !== SELECTOR_LOCKDOWN_RECEIPT_HASH ? "selector_lockdown_receipt_hash_mismatch" : null,
    identity?.matrixDatasetId !== MATRIX_DATASET_ID ? "selector_lockdown_matrix_dataset_mismatch" : null,
    identity?.matrixDatasetHash !== MATRIX_DATASET_HASH ? "selector_lockdown_matrix_hash_mismatch" : null,
    identity?.rrpDatasetId !== RRP_DATASET_ID ? "selector_lockdown_rrp_dataset_mismatch" : null,
    identity?.rrpDatasetHash !== RRP_DATASET_HASH ? "selector_lockdown_rrp_hash_mismatch" : null,
    identity?.sourceContentInvariantHash !== SOURCE_CONTENT_INVARIANT_HASH ? "selector_lockdown_source_hash_mismatch" : null,
    identity?.finalActiveResolvedContentJoinMapHash !== FINAL_ACTIVE_RESOLVED_CONTENT_JOIN_MAP_HASH
      ? "selector_lockdown_join_hash_mismatch"
      : null,
    decision?.lockedCotResearchCandidate !== CLP_SELECTOR_ID ? "clp_not_locked" : null,
    decision?.lockedStrengthResearchCandidate !== SFA_SELECTOR_ID ? "sfa_not_locked" : null,
    decision?.retainedSimpleStrengthAnchor !== FSA_SELECTOR_ID ? "fsa_not_retained" : null,
  ].filter((item): item is string => Boolean(item));
  if (blockers.length > 0) {
    throw new Error(`Gate 51C selector lockdown receipt failed: ${blockers.join(", ")}`);
  }
  return { parsed, fileSha256: sha256Text(raw) };
}

async function readGate50JoinReceipt() {
  const { parsed } = await readJson(GATE50_ACTIVE_JOIN_RECEIPT);
  const summary = parsed.summary as JsonRecord | undefined;
  const blockers = [
    summary?.joinReceiptStatus !== "PASS" ? "gate50_join_not_pass" : null,
    summary?.diagnosticOnly !== false ? "gate50_join_diagnostic_only" : null,
    summary?.promotionEligible !== true ? "gate50_join_not_promotion_eligible" : null,
    summary?.featureBundleManifestId !== FEATURE_BUNDLE_ID ? "gate50_feature_bundle_mismatch" : null,
    summary?.sourceContentInvariantHash !== SOURCE_CONTENT_INVARIANT_HASH ? "gate50_source_hash_mismatch" : null,
    summary?.resolvedContentJoinMapHash !== FINAL_ACTIVE_RESOLVED_CONTENT_JOIN_MAP_HASH
      ? "gate50_join_hash_mismatch"
      : null,
  ].filter((item): item is string => Boolean(item));
  if (blockers.length > 0) {
    throw new Error(`Gate 50 ACTIVE join receipt failed: ${blockers.join(", ")}`);
  }
  return parsed;
}

async function readMatrixDataset() {
  const rows = await query<MatrixDatasetRow>(
    `
      SELECT dataset_id, dataset_hash, dataset_version, status, from_utc, to_utc
      FROM research_matrix_datasets
      WHERE dataset_id = $1::uuid
    `,
    [MATRIX_DATASET_ID],
  );
  const row = rows[0];
  if (!row) throw new Error(`Missing matrix dataset ${MATRIX_DATASET_ID}`);
  if (row.dataset_hash !== MATRIX_DATASET_HASH) throw new Error(`Matrix dataset hash mismatch: ${row.dataset_hash}`);
  if (row.status !== "complete") throw new Error(`Matrix dataset is not complete: ${row.status}`);
  return row;
}

async function readMacroDataset() {
  const rows = await query<MacroDatasetRow>(
    `
      SELECT regime_dataset_id, dataset_hash, dataset_version, status, snapshot_state
      FROM research_macro_regime_datasets
      WHERE regime_dataset_id = $1::uuid
    `,
    [RRP_DATASET_ID],
  );
  const row = rows[0];
  if (!row) throw new Error(`Missing RRP macro dataset ${RRP_DATASET_ID}`);
  if (row.dataset_hash !== RRP_DATASET_HASH) throw new Error(`RRP dataset hash mismatch: ${row.dataset_hash}`);
  if (row.status !== "complete") throw new Error(`RRP dataset is not complete: ${row.status}`);
  return row;
}

async function readVariantRuns(variantIds: string[]) {
  const rows = await query<VariantRunRow>(
    `
      SELECT variant_run_id, variant_id, variant_label
      FROM research_matrix_variant_runs
      WHERE dataset_id = $1::uuid
        AND variant_id = ANY($2::text[])
      ORDER BY variant_id
    `,
    [MATRIX_DATASET_ID, variantIds],
  );
  const found = new Set(rows.map((row) => row.variant_id));
  const missing = variantIds.filter((variantId) => !found.has(variantId));
  if (missing.length > 0) throw new Error(`Missing variant runs: ${missing.join(", ")}`);
  return rows;
}

async function readWeekResults(variantRunIds: string[]) {
  return query<WeekResultRow>(
    `
      SELECT r.variant_run_id, r.variant_id, r.variant_label, w.week_open_utc, w.pair_contributions
      FROM research_matrix_variant_week_results w
      JOIN research_matrix_variant_runs r ON r.variant_run_id = w.variant_run_id
      WHERE r.variant_run_id = ANY($1::uuid[])
      ORDER BY r.variant_id, w.week_open_utc
    `,
    [variantRunIds],
  );
}

async function readPairDecisions(variantRunIds: string[]) {
  return query<PairDecisionRow>(
    `
      SELECT r.variant_run_id, r.variant_id, d.week_open_utc, d.symbol, d.selected_side
      FROM research_matrix_pair_decisions d
      JOIN research_matrix_variant_runs r ON r.variant_run_id = d.variant_run_id
      WHERE r.variant_run_id = ANY($1::uuid[])
        AND d.selected_side IN ('LONG', 'SHORT')
      ORDER BY r.variant_id, d.week_open_utc, d.symbol
    `,
    [variantRunIds],
  );
}

async function readRrpSnapshots() {
  return query<RrpSnapshotRow>(
    `
      SELECT week_open_utc, currency, normalized_value_json->>'realRatePercent' AS real_rate_percent
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND source_family = 'real_rate_pressure'
        AND source_id = 'derived_real_rate_pressure_3m_interbank_v1'
      ORDER BY week_open_utc, currency
    `,
    [RRP_DATASET_ID],
  );
}

async function readCotSnapshots() {
  return query<CotSnapshotRow>(
    `
      SELECT report_date, currencies
      FROM cot_snapshots
      WHERE asset_class = 'fx'
      ORDER BY report_date ASC
    `,
    [],
  );
}

function empiricalPercentile(values: number[], current: number) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length <= 1) return 50;
  let below = 0;
  let equal = 0;
  for (const value of sorted) {
    if (value < current) below += 1;
    else if (value === current) equal += 1;
  }
  return ((below + 0.5 * equal) / sorted.length) * 100;
}

function buildLifecycleMap(cotSnapshots: CotSnapshotRow[]) {
  const lookback = 156;
  const snapshots = cotSnapshots
    .map((row) => ({ ...row, reportDate: dateKey(row.report_date) }))
    .filter((row): row is CotSnapshotRow & { reportDate: string } => Boolean(row.reportDate));
  const currencies = [...new Set(snapshots.flatMap((row) => Object.keys(row.currencies ?? {})))].sort();
  const stateByReportCurrency = new Map<string, CurrencyLifecycleState>();
  let missingMetricWindows = 0;

  for (let index = lookback - 1; index < snapshots.length; index += 1) {
    const window = snapshots.slice(index + 1 - lookback, index + 1);
    const current = snapshots[index];
    for (const currency of currencies) {
      const metricWindow = (field: string) => window
        .map((row) => numeric(row.currencies?.[currency]?.[field]))
        .filter((value): value is number => value !== null);
      const crowdWindow = metricWindow("noncomm_net");
      const commercialWindow = metricWindow("commercial_net");
      const dealerWindow = metricWindow("dealer_net");
      const currentCrowd = numeric(current.currencies?.[currency]?.noncomm_net);
      const currentCommercial = numeric(current.currencies?.[currency]?.commercial_net);
      const currentDealer = numeric(current.currencies?.[currency]?.dealer_net);
      if (
        crowdWindow.length !== lookback ||
        commercialWindow.length !== lookback ||
        dealerWindow.length !== lookback ||
        currentCrowd === null ||
        currentCommercial === null ||
        currentDealer === null
      ) {
        missingMetricWindows += 1;
        continue;
      }
      const crowdPercentile = empiricalPercentile(crowdWindow, currentCrowd);
      const commercialPercentile = empiricalPercentile(commercialWindow, currentCommercial);
      const dealerPercentile = empiricalPercentile(dealerWindow, currentDealer);
      const tei = (crowdPercentile + (100 - commercialPercentile) + (100 - dealerPercentile)) / 3;
      stateByReportCurrency.set(`${current.reportDate}|${currency}`, {
        reportDate: current.reportDate,
        currency,
        tei,
      });
    }
  }

  return {
    stateByReportCurrency,
    lifecycleLookback: lookback,
    lifecycleFirstReportDate: snapshots[lookback - 1]?.reportDate ?? null,
    lifecycleReportCount: snapshots.length >= lookback ? snapshots.length - lookback + 1 : 0,
    lifecycleCurrencyStateRows: stateByReportCurrency.size,
    missingMetricWindows,
  };
}

function buildRrpFeatureMap(rows: RrpSnapshotRow[]) {
  const rowsByWeek = new Map<string, Array<{ currency: string; value: number }>>();
  for (const row of rows) {
    const week = isoUtc(row.week_open_utc);
    const value = asNumber(row.real_rate_percent, Number.NaN);
    if (!week || !Number.isFinite(value)) continue;
    const currencyRows = rowsByWeek.get(week) ?? [];
    currencyRows.push({ currency: row.currency.toUpperCase(), value });
    rowsByWeek.set(week, currencyRows);
  }

  const previousByCurrency = new Map<string, number>();
  const features = new Map<string, RrpFeature>();
  for (const week of [...rowsByWeek.keys()].sort()) {
    const currencyRows = rowsByWeek.get(week)!.sort((left, right) => right.value - left.value);
    const denominator = Math.max(1, currencyRows.length - 1);
    currencyRows.forEach((row, index) => {
      const rank = index + 1;
      const previous = previousByCurrency.get(row.currency);
      const change = previous === undefined ? null : row.value - previous;
      features.set(`${week}|${row.currency}`, {
        weekOpenUtc: week,
        currency: row.currency,
        levelPercent: row.value,
        rank,
        percentile: currencyRows.length <= 1 ? 1 : (currencyRows.length - rank) / denominator,
        changePercent: change,
      });
      previousByCurrency.set(row.currency, row.value);
    });
  }
  return features;
}

function buildDecompositionRows(options: {
  selectors: SelectorDefinition[];
  variants: VariantRunRow[];
  weekResults: WeekResultRow[];
  pairDecisions: PairDecisionRow[];
  rrpFeatures: Map<string, RrpFeature>;
  lifecycle: ReturnType<typeof buildLifecycleMap>;
}) {
  const variantById = new Map(options.variants.map((row) => [row.variant_id, row]));
  const weekResultByVariantWeek = new Map<string, WeekResultRow>();
  const decisionsByVariant = new Map<string, PairDecisionRow[]>();
  const rows: DecompositionRow[] = [];
  const blockers: string[] = [];
  const coverageBySelector = new Map<string, CoverageRow>();

  for (const row of options.weekResults) {
    const week = isoUtc(row.week_open_utc);
    if (week) weekResultByVariantWeek.set(`${row.variant_run_id}|${week}`, row);
  }

  for (const row of options.pairDecisions) {
    const current = decisionsByVariant.get(row.variant_id) ?? [];
    current.push(row);
    decisionsByVariant.set(row.variant_id, current);
  }

  for (const selector of options.selectors) {
    const coverage: CoverageRow = {
      selectorId: selector.selectorId,
      selectorRole: selector.role,
      benchmarkOnly: selector.benchmarkOnly,
      selectedDecisionRows: 0,
      computedRows: 0,
      expectedWarmupRows: 0,
      trueMissingLifecycleRows: 0,
      missingRrpRows: 0,
      missingWeekResultRows: 0,
      zeroFilledRows: 0,
      denominatorPolicy: "valid_required_state_rows_only",
      lifecycleHandlingPolicy: "exclude_expected_warmup_and_true_missing_as_unavailable",
      missingRowsIncludedAsNeutral: false,
      missingRowsIncludedAsUnavailable: true,
      validLifecycleRowsRequired: selector.selectorId === CLP_SELECTOR_ID,
      denominatorImpactPct: null,
    };
    coverageBySelector.set(selector.selectorId, coverage);

    const variant = variantById.get(selector.executionHarnessVariantId);
    if (!variant) {
      blockers.push(`missing_execution_harness_${selector.executionHarnessVariantId}`);
      continue;
    }
    const decisions = decisionsByVariant.get(selector.executionHarnessVariantId) ?? [];
    for (const decision of decisions) {
      coverage.selectedDecisionRows += 1;
      const week = isoUtc(decision.week_open_utc);
      if (!week) continue;
      const weekResult = weekResultByVariantWeek.get(`${decision.variant_run_id}|${week}`);
      if (!weekResult) {
        coverage.missingWeekResultRows += 1;
        continue;
      }

      let contribution = asNumber(weekResult.pair_contributions?.[decision.symbol], Number.NaN);
      let zeroFilledPairContribution = false;
      if (!Number.isFinite(contribution)) {
        contribution = 0;
        zeroFilledPairContribution = true;
      }

      const { base, quote } = parsePair(decision.symbol);
      const baseRrp = options.rrpFeatures.get(`${week}|${base}`);
      const quoteRrp = options.rrpFeatures.get(`${week}|${quote}`);
      if (!baseRrp || !quoteRrp) {
        coverage.missingRrpRows += 1;
        continue;
      }

      let clpReportDate: string | null = null;
      let clpSignedSpread: number | null = null;
      let clpLifecyclePolarityBucket: LifecyclePolarityBucket | null = null;
      if (selector.selectorId === CLP_SELECTOR_ID) {
        clpReportDate = deriveCotReportDate(week);
        const baseLifecycle = options.lifecycle.stateByReportCurrency.get(`${clpReportDate}|${base}`);
        const quoteLifecycle = options.lifecycle.stateByReportCurrency.get(`${clpReportDate}|${quote}`);
        if (!baseLifecycle || !quoteLifecycle) {
          if (
            options.lifecycle.lifecycleFirstReportDate &&
            clpReportDate < options.lifecycle.lifecycleFirstReportDate
          ) {
            coverage.expectedWarmupRows += 1;
          } else {
            coverage.trueMissingLifecycleRows += 1;
          }
          continue;
        }
        const longLifecycle = decision.selected_side === "LONG" ? baseLifecycle : quoteLifecycle;
        const shortLifecycle = decision.selected_side === "LONG" ? quoteLifecycle : baseLifecycle;
        clpSignedSpread = longLifecycle.tei - shortLifecycle.tei;
        clpLifecyclePolarityBucket = lifecyclePolarityBucket(clpSignedSpread);
      }

      const selectedRrp = decision.selected_side === "LONG" ? baseRrp : quoteRrp;
      const oppositeRrp = decision.selected_side === "LONG" ? quoteRrp : baseRrp;
      const selectedCurrency = decision.selected_side === "LONG" ? base : quote;
      const oppositeCurrency = decision.selected_side === "LONG" ? quote : base;
      const pairDifferential = baseRrp.levelPercent - quoteRrp.levelPercent;
      const selectedAlignment = decision.selected_side === "LONG" ? pairDifferential : -pairDifferential;
      const mask = rrpMaskFor(selectedAlignment);
      const selectedRankAdvantage = oppositeRrp.rank - selectedRrp.rank;
      const selectedMomentumAdvantage =
        selectedRrp.changePercent === null || oppositeRrp.changePercent === null
          ? null
          : selectedRrp.changePercent - oppositeRrp.changePercent;

      rows.push({
        selectorId: selector.selectorId,
        selectorLabel: selector.label,
        selectorRole: selector.role,
        benchmarkOnly: selector.benchmarkOnly,
        matrixVariantId: selector.matrixVariantId,
        executionHarnessVariantId: selector.executionHarnessVariantId,
        weekOpenUtc: week,
        year: week.slice(0, 4),
        symbol: decision.symbol.toUpperCase(),
        base,
        quote,
        selectedSide: decision.selected_side,
        pairContributionAdr: contribution,
        zeroFilledPairContribution,
        selectedCurrency,
        oppositeCurrency,
        baseRrpLevelPercent: baseRrp.levelPercent,
        quoteRrpLevelPercent: quoteRrp.levelPercent,
        selectedRrpLevelPercent: selectedRrp.levelPercent,
        oppositeRrpLevelPercent: oppositeRrp.levelPercent,
        selectedRrpRank: selectedRrp.rank,
        oppositeRrpRank: oppositeRrp.rank,
        selectedRrpPercentile: selectedRrp.percentile,
        oppositeRrpPercentile: oppositeRrp.percentile,
        pairRrpDifferentialPercent: pairDifferential,
        selectedSideRrpAlignmentPercent: selectedAlignment,
        absoluteRrpSpreadPercent: Math.abs(pairDifferential),
        baseRankMinusQuoteRank: baseRrp.rank - quoteRrp.rank,
        selectedRankAdvantage,
        selectedRrpChangePercent: selectedRrp.changePercent,
        oppositeRrpChangePercent: oppositeRrp.changePercent,
        selectedMomentumAdvantagePercent: selectedMomentumAdvantage,
        rrpMask: mask,
        confirmFadeWeak: rrpBucketFor(mask),
        clpReportDate,
        clpSignedSpread,
        clpLifecyclePolarityBucket,
      });
      coverage.computedRows += 1;
      if (zeroFilledPairContribution) coverage.zeroFilledRows += 1;
    }
  }

  const coverage = [...coverageBySelector.values()].map((row) => {
    const excluded = row.selectedDecisionRows - row.computedRows;
    return {
      ...row,
      denominatorImpactPct: row.selectedDecisionRows > 0 ? round((excluded / row.selectedDecisionRows) * 100, 4) : null,
    };
  });
  const warnings = {
    missingWeekResultRows: coverage.reduce((sum, row) => sum + row.missingWeekResultRows, 0),
    missingRrpRows: coverage.reduce((sum, row) => sum + row.missingRrpRows, 0),
    expectedWarmupRows: coverage.reduce((sum, row) => sum + row.expectedWarmupRows, 0),
    trueMissingLifecycleRows: coverage.reduce((sum, row) => sum + row.trueMissingLifecycleRows, 0),
    zeroFilledPairContributionRows: coverage.reduce((sum, row) => sum + row.zeroFilledRows, 0),
  };

  return { rows, blockers, warnings, coverage };
}

function calculateMetric(options: {
  rows: DecompositionRow[];
  allWeeks: string[];
  selector: SelectorDefinition;
  axisId: string;
  bucket: string;
}): MetricRow {
  const weeklyTotals = new Map(options.allWeeks.map((week) => [week, 0]));
  const activeWeeks = new Set<string>();
  const pairTotals = new Map<string, number>();
  const currencyTotals = new Map<string, number>();
  const yearTotals = new Map<string, number>();
  let zeroFilledRows = 0;

  for (const row of options.rows) {
    weeklyTotals.set(row.weekOpenUtc, (weeklyTotals.get(row.weekOpenUtc) ?? 0) + row.pairContributionAdr);
    activeWeeks.add(row.weekOpenUtc);
    pairTotals.set(row.symbol, (pairTotals.get(row.symbol) ?? 0) + row.pairContributionAdr);
    currencyTotals.set(row.selectedCurrency, (currencyTotals.get(row.selectedCurrency) ?? 0) + row.pairContributionAdr);
    yearTotals.set(row.year, (yearTotals.get(row.year) ?? 0) + row.pairContributionAdr);
    if (row.zeroFilledPairContribution) zeroFilledRows += 1;
  }

  const pathValues = [...weeklyTotals.values()];
  const activeValues = [...activeWeeks].sort().map((week) => weeklyTotals.get(week) ?? 0);
  const totalAdr = pathValues.reduce((sum, value) => sum + value, 0);
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of pathValues) {
    cumulative += value;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
  }
  const mean = activeValues.length > 0
    ? activeValues.reduce((sum, value) => sum + value, 0) / activeValues.length
    : null;
  const variance = mean === null || activeValues.length <= 1
    ? null
    : activeValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (activeValues.length - 1);
  const stdDev = variance === null ? null : Math.sqrt(variance);
  const positive = pathValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negative = pathValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const yearAdr = Object.fromEntries([...yearTotals.entries()].sort(([left], [right]) => left.localeCompare(right)));
  const yearRows = Object.entries(yearAdr);
  const worstYear = yearRows.sort((left, right) => left[1] - right[1])[0] ?? null;
  const topPair = topAbsShare(pairTotals, totalAdr);
  const topCurrency = topAbsShare(currencyTotals, totalAdr);

  return {
    selectorId: options.selector.selectorId,
    selectorRole: options.selector.role,
    benchmarkOnly: options.selector.benchmarkOnly,
    axisId: options.axisId,
    bucket: options.bucket,
    selectedRows: options.rows.length,
    activeWeeks: activeWeeks.size,
    minimumRowsRequired: MIN_CELL_ROWS,
    minimumActiveWeeksRequired: MIN_CELL_ACTIVE_WEEKS,
    passesMinimumRows: options.rows.length >= MIN_CELL_ROWS,
    passesMinimumActiveWeeks: activeWeeks.size >= MIN_CELL_ACTIVE_WEEKS,
    sampleSupport: options.rows.length >= MIN_CELL_ROWS && activeWeeks.size >= MIN_CELL_ACTIVE_WEEKS
      ? "passes_minimum_sample"
      : "exploratory_low_support",
    totalAdr: round(totalAdr, 4) ?? 0,
    maxDrawdownAdr: round(maxDrawdown, 4) ?? 0,
    returnToDrawdown: maxDrawdown < 0 ? round(totalAdr / Math.abs(maxDrawdown), 4) : null,
    pathSharpeAdr: mean !== null && stdDev !== null && stdDev > 0 ? round((mean / stdDev) * Math.sqrt(52), 4) : null,
    profitFactorAdr: negative < 0 ? round(positive / Math.abs(negative), 4) : null,
    weeklyWinRateActive: activeValues.length > 0
      ? round(activeValues.filter((value) => value > 0).length / activeValues.length, 4)
      : null,
    avgAdrPerPair: options.rows.length > 0 ? round(totalAdr / options.rows.length, 6) : null,
    zeroFilledRows,
    positiveYears: yearRows.filter(([, value]) => value > 0).length,
    yearCount: yearRows.length,
    positiveYearRate: yearRows.length > 0
      ? round(yearRows.filter(([, value]) => value > 0).length / yearRows.length, 4)
      : null,
    worstYear: worstYear?.[0] ?? null,
    worstYearAdr: worstYear ? round(worstYear[1], 4) : null,
    topPair: topPair.id,
    topPairAbsShare: topPair.share,
    topCurrency: topCurrency.id,
    topCurrencyAbsShare: topCurrency.share,
    yearAdr: Object.fromEntries(Object.entries(yearAdr).map(([year, value]) => [year, round(value, 4) ?? 0])),
  };
}

function topAbsShare(values: Map<string, number>, totalAdr: number) {
  const top = [...values.entries()].sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))[0];
  return {
    id: top?.[0] ?? null,
    share: top && totalAdr !== 0 ? round(Math.abs(top[1]) / Math.abs(totalAdr), 4) : null,
  };
}

function buildMetrics(rows: DecompositionRow[]) {
  const allWeeks = [...new Set(rows.map((row) => row.weekOpenUtc))].sort();
  const metrics: MetricRow[] = [];
  for (const selector of SELECTORS) {
    const selectorRows = rows.filter((row) => row.selectorId === selector.selectorId);
    metrics.push(calculateMetric({
      rows: selectorRows,
      allWeeks,
      selector,
      axisId: "selector_all",
      bucket: "all",
    }));
    for (const axis of DECOMPOSITION_AXES) {
      for (const bucket of axis.smokeBuckets) {
        const bucketRows = selectorRows.filter((row) => bucketForAxis(row, axis.axisId) === bucket);
        metrics.push(calculateMetric({
          rows: bucketRows,
          allWeeks,
          selector,
          axisId: axis.axisId,
          bucket,
        }));
      }
    }
  }
  return metrics;
}

function metricKey(row: MetricRow) {
  return `${row.selectorId}|${row.axisId}|${row.bucket}`;
}

function displayRows(metrics: MetricRow[], top: number) {
  return metrics
    .filter((row) => row.axisId !== "selector_all" && row.selectedRows > 0)
    .sort((left, right) => Math.abs(right.totalAdr) - Math.abs(left.totalAdr))
    .slice(0, top);
}

function countBy(rows: DecompositionRow[], keyFor: (row: DecompositionRow) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function buildZeroFillAudit(rows: DecompositionRow[], metrics: MetricRow[], top: number) {
  const zeroFilledRows = rows.filter((row) => row.zeroFilledPairContribution);
  const metricsWithoutZeroFilled = buildMetrics(rows.filter((row) => !row.zeroFilledPairContribution));
  const withoutByKey = new Map(metricsWithoutZeroFilled.map((row) => [metricKey(row), row]));
  const adrImpactByCell = metrics
    .map((row) => {
      const without = withoutByKey.get(metricKey(row));
      return {
        selectorId: row.selectorId,
        axisId: row.axisId,
        bucket: row.bucket,
        zeroFilledRows: row.zeroFilledRows,
        totalAdrWithZeroFill: row.totalAdr,
        totalAdrExcludingZeroFill: without?.totalAdr ?? 0,
        adrDeltaFromExcludingZeroFill: round(row.totalAdr - (without?.totalAdr ?? 0), 6) ?? 0,
        selectedRowsWithZeroFill: row.selectedRows,
        selectedRowsExcludingZeroFill: without?.selectedRows ?? 0,
      };
    })
    .filter((row) => row.zeroFilledRows > 0);
  const withTop = displayRows(metrics, top);
  const withoutTop = displayRows(metricsWithoutZeroFilled, top);
  const withKeys = withTop.map(metricKey);
  const withoutKeys = withoutTop.map(metricKey);
  const topDisplayRowsContainZeroFill = withTop.some((row) => row.zeroFilledRows > 0);
  const topDisplayChangesWhenZeroFilledExcluded =
    withKeys.length !== withoutKeys.length || withKeys.some((key, index) => key !== withoutKeys[index]);

  return {
    policy: {
      primaryCellMetrics: "include_zero_filled_pair_contribution_rows_as_zero_to_match_cached_gate44_pair_contribution_semantics",
      sensitivity: "also_report_cell_adr_and_row_counts_with_zero_filled_rows_excluded",
      zeroFillSilent: false,
    },
    count: zeroFilledRows.length,
    bySelector: countBy(zeroFilledRows, (row) => row.selectorId),
    byYear: countBy(zeroFilledRows, (row) => row.year),
    byPair: countBy(zeroFilledRows, (row) => row.symbol),
    adrImpactByCell,
    topDisplayRowsContainZeroFill,
    topDisplayChangesWhenZeroFilledExcluded,
    topResultDependsOnZeroFilledRows: topDisplayRowsContainZeroFill || topDisplayChangesWhenZeroFilledExcluded,
  };
}

function buildReviewArtifactMarkdown(receipt: JsonRecord) {
  const summary = receipt.summary as JsonRecord;
  const identity = receipt.identity as JsonRecord;
  const files = receipt.files as JsonRecord;
  return [
    "# Gate 51D Full Decomposition Review Artifact",
    "",
    `Generated: ${receipt.generatedAtUtc}`,
    "",
    `- Status: ${receipt.status}`,
    `- Receipt hash: ${receipt.receiptHash}`,
    `- Variant/decomposition grid hash: ${receipt.variantDecompositionGridHash}`,
    `- Full JSON receipt: ${files.jsonPath}`,
    `- Full Markdown receipt: ${files.mdPath}`,
    `- Matrix dataset: ${identity.matrixDatasetId} / ${identity.matrixDatasetHash}`,
    `- RRP dataset: ${identity.rrpDatasetId} / ${identity.rrpDatasetHash}`,
    `- Gate 50 source-content invariant: ${identity.sourceContentInvariantHash}`,
    `- Gate 50 final ACTIVE join hash: ${identity.finalActiveResolvedContentJoinMapHash}`,
    `- Gate 51C selector lockdown receipt hash: ${identity.selectorLockdownReceiptHash}`,
    `- Decomposition rows: ${summary.decompositionRows}`,
    `- Metric rows: ${summary.metricRows}`,
    "",
    "This artifact preserves the full Gate 51D receipt path and immutable hashes outside the locally ignored `app/reports/data-verification/` tree. It is a review artifact only, not a production or promotion claim.",
    "",
  ].join("\n");
}


function renderMarkdown(receipt: JsonRecord) {
  const summary = receipt.summary as JsonRecord;
  const identity = receipt.identity as JsonRecord;
  const coverage = receipt.coverage as CoverageRow[];
  const zeroFillAudit = receipt.zeroFillAudit as JsonRecord;
  const policies = receipt.warningHandlingPolicies as JsonRecord;
  const files = receipt.files as JsonRecord;
  const rows = receipt.displayRows as MetricRow[];
  const lines: string[] = [];
  lines.push(`# Gate 51D RRP Decomposition ${summary.mode === "full" ? "Full Diagnostic" : "Smoke"}`);
  lines.push("");
  lines.push(`Generated: ${receipt.generatedAtUtc}`);
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push(`- Status: ${receipt.status}`);
  lines.push(`- Gate: ${receipt.gate}`);
  lines.push(`- Mode: ${summary.mode}`);
  lines.push(`- Decomposition rows: ${summary.decompositionRows}`);
  lines.push(`- Display top: ${summary.displayTop}`);
  lines.push(`- Top is display-only: ${summary.displayTopIsSelectionAuthority === false}`);
  lines.push(`- Diagnostic against legacy baseline: ${receipt.diagnosticAgainstLegacyBaseline}`);
  lines.push(`- Legacy selectors not source promoted: ${receipt.legacySelectorsNotSourcePromoted}`);
  lines.push(`- No source mutation: ${receipt.noSourceMutation}`);
  lines.push(`- No Gate 50 reopening: ${receipt.noGate50Reopening}`);
  lines.push(`- No production claim: ${receipt.noProductionClaim}`);
  lines.push(`- No promotion claim: ${receipt.noPromotionClaim}`);
  lines.push("");
  lines.push("## Identity");
  lines.push("");
  lines.push(`- Matrix dataset: ${identity.matrixDatasetId} / ${identity.matrixDatasetHash}`);
  lines.push(`- RRP dataset: ${identity.rrpDatasetId} / ${identity.rrpDatasetHash}`);
  lines.push(`- Gate 50 source-content invariant: ${identity.sourceContentInvariantHash}`);
  lines.push(`- Gate 50 final ACTIVE join hash: ${identity.finalActiveResolvedContentJoinMapHash}`);
  lines.push(`- Gate 51C selector lockdown receipt hash: ${identity.selectorLockdownReceiptHash}`);
  lines.push("");
  lines.push("## Warning Policies");
  lines.push("");
  lines.push(`- CLP lifecycle handling: ${(policies.clpLifecycleWarmupMissing as JsonRecord).handlingPolicy}`);
  lines.push(`- Coverage denominator: ${(policies.coverageDenominator as JsonRecord).policy}`);
  lines.push(`- Minimum cell rows/weeks: ${(policies.minimumCellCount as JsonRecord).minimumRows} / ${(policies.minimumCellCount as JsonRecord).minimumActiveWeeks}`);
  lines.push(`- Zero-fill sensitivity reported: ${(policies.zeroFilledPairContributions as JsonRecord).sensitivityReported}`);
  lines.push(`- Receipt persistence: ${(policies.receiptPersistence as JsonRecord).fullReceiptPersistencePlan}`);
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push("| Selector | Decisions | Computed | Warmup | True missing lifecycle | Missing RRP | Zero-filled | Denominator impact |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of coverage) {
    lines.push(`| ${[
      row.selectorId,
      row.selectedDecisionRows,
      row.computedRows,
      row.expectedWarmupRows,
      row.trueMissingLifecycleRows,
      row.missingRrpRows,
      row.zeroFilledRows,
      row.denominatorImpactPct ?? "",
    ].join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Zero Fill");
  lines.push("");
  lines.push(`- Zero-filled rows: ${zeroFillAudit.count}`);
  lines.push(`- Top display rows contain zero-fill: ${zeroFillAudit.topDisplayRowsContainZeroFill}`);
  lines.push(`- Top display changes when zero-filled rows are excluded: ${zeroFillAudit.topDisplayChangesWhenZeroFilledExcluded}`);
  lines.push(`- Top result depends on zero-filled rows: ${zeroFillAudit.topResultDependsOnZeroFilledRows}`);
  lines.push("");
  lines.push("## Display Rows");
  lines.push("");
  lines.push("| Selector | Axis | Bucket | Support | Rows | Weeks | ADR | DD | R/DD | Sharpe | PF | Worst year |");
  lines.push("|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const row of rows) {
    lines.push(`| ${[
      row.selectorId,
      row.axisId,
      row.bucket,
      row.sampleSupport,
      row.selectedRows,
      row.activeWeeks,
      row.totalAdr,
      row.maxDrawdownAdr,
      row.returnToDrawdown ?? "",
      row.pathSharpeAdr ?? "",
      row.profitFactorAdr ?? "",
      row.worstYear ? `${row.worstYear} ${row.worstYearAdr}` : "",
    ].join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push(`- JSON: ${files.jsonPath}`);
  lines.push(`- Markdown: ${files.mdPath}`);
  lines.push("");
  lines.push("No live, production, promotion, source-rebuild, source-refetch, BPR, PPP, NEER, REER, valuation, or combined macro-regime claim is made by this receipt.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const cli = parseCli();
  await mkdir(cli.outDir, { recursive: true });

  const requiredVariantIds = [...new Set(SELECTORS.map((selector) => selector.executionHarnessVariantId))];
  const [
    selectorLockdown,
    gate50JoinReceipt,
    matrixDataset,
    macroDataset,
    variants,
    rrpRows,
    cotSnapshots,
  ] = await Promise.all([
    readSelectorLockdownReceipt(),
    readGate50JoinReceipt(),
    readMatrixDataset(),
    readMacroDataset(),
    readVariantRuns(requiredVariantIds),
    readRrpSnapshots(),
    readCotSnapshots(),
  ]);

  const variantRunIds = variants.map((row) => row.variant_run_id);
  const [weekResults, pairDecisions] = await Promise.all([
    readWeekResults(variantRunIds),
    readPairDecisions(variantRunIds),
  ]);

  const lifecycle = buildLifecycleMap(cotSnapshots);
  const rrpFeatures = buildRrpFeatureMap(rrpRows);
  const decomposition = buildDecompositionRows({
    selectors: SELECTORS,
    variants,
    weekResults,
    pairDecisions,
    rrpFeatures,
    lifecycle,
  });
  const metrics = buildMetrics(decomposition.rows);
  const zeroFillAudit = buildZeroFillAudit(decomposition.rows, metrics, cli.top);
  const grid = {
    selectors: SELECTORS,
    decompositionAxisManifestVersion: DECOMPOSITION_AXIS_MANIFEST_VERSION,
    axes: DECOMPOSITION_AXES,
    rrpConfirmThresholdPercent: RRP_CONFIRM_THRESHOLD_PERCENT,
    mode: cli.mode,
  };
  const variantDecompositionGridHash = sha256Stable(grid);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").slice(0, 15);
  const jsonPath = cli.jsonOut ?? path.join(cli.outDir, `gate51-rrp-decomposition-${cli.mode}-${stamp}.json`);
  const mdPath = cli.mdOut ?? path.join(cli.outDir, `gate51-rrp-decomposition-${cli.mode}-${stamp}.md`);
  const reviewArtifactPath = cli.mode === "full"
    ? path.join("docs/research", `GATE51D_RRP_DECOMPOSITION_FULL_REVIEW_ARTIFACT_${stamp}.md`)
    : null;

  const receiptWithoutHash = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    gate: GATE,
    status: decomposition.blockers.length === 0
      ? cli.mode === "full"
        ? "PASS_RRP_DECOMPOSITION_FULL_DIAGNOSTIC"
        : "PASS_RRP_DECOMPOSITION_SMOKE"
      : cli.mode === "full"
        ? "FAIL_RRP_DECOMPOSITION_FULL_DIAGNOSTIC"
        : "FAIL_RRP_DECOMPOSITION_SMOKE",
    diagnosticAgainstLegacyBaseline: true,
    legacySelectorsNotSourcePromoted: true,
    noSourceMutation: true,
    noGate50Reopening: true,
    noProductionClaim: true,
    noPromotionClaim: true,
    noLiveClaim: true,
    noBprPppNeerReerValuationOrCombinedMacroRegime: true,
    summary: {
      mode: cli.mode,
      displayTop: cli.top,
      displayTopIsSelectionAuthority: false,
      displayTopSort: "absolute_total_adr_for_human_scan_only",
      selectorCount: SELECTORS.length,
      decompositionRows: decomposition.rows.length,
      metricRows: metrics.length,
      rrpCurrencyRowsRead: rrpRows.length,
      matrixWeekResultRowsRead: weekResults.length,
      matrixPairDecisionRowsRead: pairDecisions.length,
      cotSnapshotRowsRead: cotSnapshots.length,
      lifecycleLookback: lifecycle.lifecycleLookback,
      lifecycleFirstReportDate: lifecycle.lifecycleFirstReportDate,
      lifecycleCurrencyStateRows: lifecycle.lifecycleCurrencyStateRows,
      rrpFeatureRows: rrpFeatures.size,
      adrNormalized: true,
      rawReturnsReported: false,
      sourceRefetchPerformed: false,
      sourceRebuildPerformed: false,
      sourceMutationPerformed: false,
      gate50Reopened: false,
      executionRerunPerformed: false,
      researchConclusionsReported: false,
      productionClaim: false,
      promotionClaim: false,
    },
    identity: {
      matrixDatasetId: MATRIX_DATASET_ID,
      matrixDatasetHash: MATRIX_DATASET_HASH,
      matrixDatasetVersion: matrixDataset.dataset_version,
      matrixDatasetStatus: matrixDataset.status,
      matrixDatasetFromUtc: isoUtc(matrixDataset.from_utc),
      matrixDatasetToUtc: isoUtc(matrixDataset.to_utc),
      rrpDatasetId: RRP_DATASET_ID,
      rrpDatasetHash: RRP_DATASET_HASH,
      rrpDatasetVersion: macroDataset.dataset_version,
      rrpDatasetStatus: macroDataset.status,
      rrpSnapshotState: macroDataset.snapshot_state,
      sourceContentInvariantHash: SOURCE_CONTENT_INVARIANT_HASH,
      finalActiveResolvedContentJoinMapHash: FINAL_ACTIVE_RESOLVED_CONTENT_JOIN_MAP_HASH,
      gate50ActiveJoinReceiptPath: GATE50_ACTIVE_JOIN_RECEIPT,
      gate50ActiveJoinStatus: ((gate50JoinReceipt.summary as JsonRecord).joinReceiptStatus as string) ?? null,
      selectorLockdownReceiptPath: SELECTOR_LOCKDOWN_RECEIPT,
      selectorLockdownReceiptHash: SELECTOR_LOCKDOWN_RECEIPT_HASH,
      selectorLockdownFileSha256: selectorLockdown.fileSha256,
    },
    selectorRoles: SELECTORS.map((selector) => ({
      selectorId: selector.selectorId,
      label: selector.label,
      role: selector.role,
      benchmarkOnly: selector.benchmarkOnly,
      matrixVariantId: selector.matrixVariantId,
      executionHarnessVariantId: selector.executionHarnessVariantId,
    })),
    decompositionAxisManifest: {
      version: DECOMPOSITION_AXIS_MANIFEST_VERSION,
      rrpConfirmThresholdPercent: RRP_CONFIRM_THRESHOLD_PERCENT,
      axes: DECOMPOSITION_AXES,
      masks: ["supportive", "adverse", "neutral"],
      confirmFadeWeakBuckets: ["confirm", "fade", "weak"],
      fsaBenchmarkOnly: true,
      topDisplayOnly: true,
    },
    variantDecompositionGridHash,
    warningHandlingPolicies: {
      clpLifecycleWarmupMissing: {
        expectedWarmupDefinition: "CLP report date before first available 156-report lifecycle state",
        trueMissingDefinition: "CLP report date on or after first lifecycle state but required currency lifecycle state unavailable",
        handlingPolicy: "exclude_from_clp_denominator_as_unavailable",
        includedAsNeutral: false,
        includedAsUnavailable: true,
        clpResultsComputedOnlyOnRowsWithValidLifecycleState: true,
      },
      zeroFilledPairContributions: {
        primaryPolicy: "include_zero_filled_pair_contribution_rows_as_zero_for_cached_gate44_parity",
        sensitivityReported: true,
        dependencyFlag: "topResultDependsOnZeroFilledRows",
      },
      minimumCellCount: {
        minimumRows: MIN_CELL_ROWS,
        minimumActiveWeeks: MIN_CELL_ACTIVE_WEEKS,
        lowSupportPolicy: "show_cell_but_mark_exploratory_low_support",
      },
      coverageDenominator: {
        policy: "valid_required_state_rows_only",
        excludedRowsAreNotNeutralized: true,
        perSelectorDenominatorImpactReported: true,
      },
      receiptPersistence: {
        smokeReceiptPersistence: "local_ignored_iteration_receipt",
        fullReceiptPersistencePlan: "write_docs_research_review_artifact_with_full_receipt_path_and_hash",
        fullReviewArtifactPath: reviewArtifactPath,
      },
    },
    controls: {
      clpUsesFrozenGate44DirectionalHarnessUntilPureLifecycleRunnerExists: true,
      noCotFacesExpansion: true,
      noDealerCommercialExpansion: true,
      noStrengthOpenOnlyExpansion: true,
      noNewStrengthComposites: true,
      noBpr: true,
      noPpp: true,
      noNeer: true,
      noReer: true,
      noValuation: true,
      noCombinedMacroRegime: true,
      receiptPurpose: cli.mode === "full"
        ? "full_decomposition_diagnostic_with_warning_governance_no_interpretation"
        : "smoke_plumbing_and_evidence_boundaries_only",
      displayTopIsSelectionAuthority: false,
      contributionSource: "research_matrix_variant_week_results.pair_contributions",
      rrpSource: "research_macro_weekly_currency_snapshots real_rate_pressure ACTIVE Gate 50 dataset",
      clpFormula: "TEI = (noncomm_percentile + (100 - commercial_percentile) + (100 - dealer_percentile)) / 3; selected-side CLP spread is long_currency_TEI - short_currency_TEI on the frozen harness side.",
    },
    blockers: decomposition.blockers,
    warnings: decomposition.warnings,
    coverage: decomposition.coverage,
    zeroFillAudit,
    selectorOverview: SELECTORS.map((selector) => metrics.find((row) => row.selectorId === selector.selectorId && row.axisId === "selector_all")),
    metricResults: metrics,
    displayRows: displayRows(metrics, cli.top),
    files: {
      jsonPath,
      mdPath,
      reviewArtifactPath,
    },
  };
  const receipt = {
    ...receiptWithoutHash,
    receiptHash: sha256Stable(receiptWithoutHash),
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderMarkdown(receipt as JsonRecord), "utf8");
  if (reviewArtifactPath) {
    await writeFile(reviewArtifactPath, `${buildReviewArtifactMarkdown(receipt as JsonRecord)}\n`, "utf8");
  }

  console.log(JSON.stringify({
    status: receipt.status,
    mode: cli.mode,
    selectorCount: SELECTORS.length,
    decompositionRows: decomposition.rows.length,
    metricRows: metrics.length,
    displayTop: cli.top,
    displayTopIsSelectionAuthority: false,
    variantDecompositionGridHash,
    jsonPath,
    mdPath,
    reviewArtifactPath,
    receiptHash: receipt.receiptHash,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
