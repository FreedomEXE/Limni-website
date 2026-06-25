import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { getPool, query } from "../../src/lib/db";

loadEnvConfig(process.cwd());

const GATE = "Gate 51A: rrp-regime-filter-research-suite diagnostic attribution";
const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const DEFAULT_BOUNDARY_MANIFEST =
  "app/reports/data-verification/macro-regime/gate51-evidence-boundary-manifest-20260623.json";
const GATE50_ACTIVE_JOIN_RECEIPT =
  "app/reports/data-verification/macro-regime/gate50-rrp-active-join-control-repaired-20260623.json";

const MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const MATRIX_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
const RRP_DATASET_ID = "220fd5fd-d017-4db2-bdde-524a3c664c72";
const RRP_DATASET_HASH = "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742";
const FEATURE_BUNDLE_ID = "real_rate_pressure_attribution_v1";
const SOURCE_CONTENT_INVARIANT_HASH = "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";
const RESOLVED_CONTENT_JOIN_MAP_HASH = "08723c62e089eddab7cde243a64283c9dd6bc0ebee01a070cfb32e4cb27fdbc7";
const DEFAULT_CANDIDATE_VARIANT_ID = "dealer_commercial_agreement_open_friday_strength_agree";
const DEFAULT_CANDIDATE_THRESHOLD = 1;
const ZERO_FILL_WORST_CASE_ADR_PER_ROW = -1;

const SMOKE_VARIANT_IDS = [
  "cot_faces_v1_forced_selected",
  "dealer_commercial_agreement_selected",
  "strength_open_canonical_fade",
];

type JsonRecord = Record<string, unknown>;
type Direction = "LONG" | "SHORT";
type RrpBucket = "confirm" | "fade" | "weak";
type ModeId =
  | "selected_all"
  | "rrp_confirm_only"
  | "rrp_fade_only"
  | "rrp_weak_only"
  | "rrp_block_fade"
  | "rrp_block_fade_and_weak"
  | "rrp_block_confirm";

type CliOptions = {
  mode: "smoke" | "full";
  outDir: string;
  jsonOut: string | null;
  mdOut: string | null;
  boundaryManifestPath: string;
  thresholds: number[];
  variantIds: string[];
  top: number;
  validationAddendum: boolean;
  candidateVariantId: string;
  candidateThreshold: number;
};

type MatrixDatasetRow = {
  dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  status: string;
  asset_class: string;
  from_utc: Date | string;
  to_utc: Date | string;
  coverage: JsonRecord;
};

type MacroDatasetRow = {
  regime_dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  status: string;
  snapshot_state: string;
  promotion_manifest_id: string | null;
  contract_manifest_hash: string | null;
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
  selected_pair_sides: number;
  fills: number;
  final_adr: number;
  max_drawdown_adr: number;
  week_close_adr: number;
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

type PairAttributionRow = {
  variantRunId: string;
  variantId: string;
  variantLabel: string;
  weekOpenUtc: string;
  year: number;
  symbol: string;
  base: string;
  quote: string;
  selectedSide: Direction;
  pairContributionAdr: number;
  zeroFilledPairContribution: boolean;
  baseRrpPercent: number;
  quoteRrpPercent: number;
  pairRrpDifferentialPercent: number;
  selectedSideRrpAlignmentPercent: number;
};

type ModeMetric = {
  thresholdPercent: number;
  mode: ModeId;
  variantId: string;
  variantLabel: string;
  selectedRows: number;
  activeWeeks: number;
  totalAdr: number;
  weeklyWinRateActive: number | null;
  weeklyWinRateAll: number;
  meanWeeklyAdr: number | null;
  weeklyStdDevAdr: number | null;
  pathSharpeAdr: number | null;
  profitFactorAdr: number | null;
  profitFactorDenominatorZero: boolean;
  positiveWeeklyAdr: number;
  negativeWeeklyAdr: number;
  positiveWeeks: number;
  negativeWeeks: number;
  flatWeeks: number;
  maxDrawdownAdr: number;
  returnToDrawdown: number | null;
  avgAdrPerSelectedPair: number | null;
  topPair: string | null;
  topPairAbsShare: number | null;
  topCurrency: string | null;
  topCurrencyAbsShare: number | null;
  positiveYears: number;
  yearCount: number;
  positiveYearRate: number | null;
  worstYear: string | null;
  worstYearAdr: number | null;
  bestYear: string | null;
  bestYearAdr: number | null;
  yearAdr: Record<string, number>;
  baselineTotalAdr: number;
  deltaVsBaselineAdr: number;
};

type ThresholdSeparation = {
  thresholdPercent: number;
  variantId: string;
  variantLabel: string;
  confirmRows: number;
  fadeRows: number;
  confirmTotalAdr: number;
  fadeTotalAdr: number;
  confirmAvgAdrPerPair: number | null;
  fadeAvgAdrPerPair: number | null;
  confirmMinusFadeAvgAdrPerPair: number | null;
  blockFadeDeltaVsBaselineAdr: number;
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function parseList(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseThresholds(value: string | null) {
  const parsed = parseList(value).map(Number).filter((item) => Number.isFinite(item) && item >= 0);
  return parsed.length > 0 ? [...new Set(parsed)].sort((left, right) => left - right) : [0, 0.25, 0.5, 1];
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseNonNegativeNumber(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseCli(): CliOptions {
  const mode = argValue("mode") === "full" ? "full" : "smoke";
  const variantIds = parseList(argValue("variant-ids"));
  const outDir = argValue("out-dir") ?? DEFAULT_OUT_DIR;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").slice(0, 15);
  const suffix = `${mode}-${stamp}`;
  return {
    mode,
    outDir,
    jsonOut: argValue("json-out"),
    mdOut: argValue("md-out"),
    boundaryManifestPath: argValue("boundary-manifest") ?? DEFAULT_BOUNDARY_MANIFEST,
    thresholds: parseThresholds(argValue("thresholds")),
    variantIds: variantIds.length > 0 ? variantIds : mode === "smoke" ? SMOKE_VARIANT_IDS : [],
    top: parsePositiveInt(argValue("top"), 15),
    validationAddendum: hasFlag("validation-addendum"),
    candidateVariantId: argValue("candidate-variant-id") ?? DEFAULT_CANDIDATE_VARIANT_ID,
    candidateThreshold: parseNonNegativeNumber(argValue("candidate-threshold"), DEFAULT_CANDIDATE_THRESHOLD),
  };
}

function isoUtc(value: Date | string | null | undefined) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return null;
}

function yearFromIso(iso: string) {
  return String(new Date(iso).getUTCFullYear());
}

function round(value: number | null | undefined, digits = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePair(symbol: string) {
  const normalized = symbol.toUpperCase();
  if (!/^[A-Z]{6}$/.test(normalized)) {
    throw new Error(`Unsupported FX pair symbol: ${symbol}`);
  }
  return {
    base: normalized.slice(0, 3),
    quote: normalized.slice(3, 6),
  };
}

function bucketForAlignment(alignment: number, threshold: number): RrpBucket {
  if (alignment > threshold) return "confirm";
  if (alignment < -threshold) return "fade";
  return "weak";
}

function modeIncludes(mode: ModeId, bucket: RrpBucket) {
  switch (mode) {
    case "selected_all":
      return true;
    case "rrp_confirm_only":
      return bucket === "confirm";
    case "rrp_fade_only":
      return bucket === "fade";
    case "rrp_weak_only":
      return bucket === "weak";
    case "rrp_block_fade":
      return bucket !== "fade";
    case "rrp_block_fade_and_weak":
      return bucket === "confirm";
    case "rrp_block_confirm":
      return bucket !== "confirm";
  }
}

const MODE_LABELS: Record<ModeId, string> = {
  selected_all: "No RRP filter",
  rrp_confirm_only: "RRP confirm only",
  rrp_fade_only: "RRP fade only",
  rrp_weak_only: "RRP weak only",
  rrp_block_fade: "Block RRP fades",
  rrp_block_fade_and_weak: "Block fades and weak",
  rrp_block_confirm: "Block RRP confirms",
};

function weeklySeries(valuesByWeek: Map<string, number>, allWeeks: string[]) {
  return allWeeks.map((week) => valuesByWeek.get(week) ?? 0);
}

function pathStats(values: number[]) {
  if (values.length === 0) {
    return {
      meanWeeklyAdr: null,
      weeklyStdDevAdr: null,
      pathSharpeAdr: null,
      profitFactorAdr: null,
      profitFactorDenominatorZero: true,
      positiveWeeklyAdr: 0,
      negativeWeeklyAdr: 0,
      positiveWeeks: 0,
      negativeWeeks: 0,
      flatWeeks: 0,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  const mean = total / values.length;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const positiveWeeklyAdr = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeWeeklyAdr = values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const negativeAbs = Math.abs(negativeWeeklyAdr);

  return {
    meanWeeklyAdr: round(mean, 6),
    weeklyStdDevAdr: round(stdDev, 6),
    pathSharpeAdr: stdDev > 0 ? round((mean / stdDev) * Math.sqrt(52), 4) : null,
    profitFactorAdr: negativeAbs > 0 ? round(positiveWeeklyAdr / negativeAbs, 4) : null,
    profitFactorDenominatorZero: negativeAbs === 0,
    positiveWeeklyAdr: round(positiveWeeklyAdr, 4) ?? 0,
    negativeWeeklyAdr: round(negativeWeeklyAdr, 4) ?? 0,
    positiveWeeks: values.filter((value) => value > 0).length,
    negativeWeeks: values.filter((value) => value < 0).length,
    flatWeeks: values.filter((value) => value === 0).length,
  };
}

function maxDrawdown(valuesByWeek: Map<string, number>, allWeeks: string[]) {
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const week of allWeeks) {
    equity += valuesByWeek.get(week) ?? 0;
    if (equity > peak) peak = equity;
    const drawdown = equity - peak;
    if (drawdown < worst) worst = drawdown;
  }
  return worst;
}

function concentration(rows: PairAttributionRow[]) {
  const pairTotals = new Map<string, number>();
  const currencyTotals = new Map<string, number>();
  let absTotal = 0;

  for (const row of rows) {
    const abs = Math.abs(row.pairContributionAdr);
    absTotal += abs;
    pairTotals.set(row.symbol, (pairTotals.get(row.symbol) ?? 0) + abs);
    currencyTotals.set(row.base, (currencyTotals.get(row.base) ?? 0) + abs / 2);
    currencyTotals.set(row.quote, (currencyTotals.get(row.quote) ?? 0) + abs / 2);
  }

  const top = (values: Map<string, number>): [string | null, number | null] => {
    if (absTotal <= 0) return [null, null];
    const [key, value] = [...values.entries()].sort((left, right) => right[1] - left[1])[0] ?? [null, null];
    return [key, typeof value === "number" ? value / absTotal : null];
  };

  const [topPair, topPairAbsShare] = top(pairTotals);
  const [topCurrency, topCurrencyAbsShare] = top(currencyTotals);
  return { topPair, topPairAbsShare, topCurrency, topCurrencyAbsShare };
}

function metricForMode(options: {
  threshold: number;
  mode: ModeId;
  variantId: string;
  variantLabel: string;
  rows: PairAttributionRow[];
  allWeeks: string[];
  baselineTotalAdr: number;
}) {
  const weeklyTotals = new Map<string, number>();
  const yearTotals: Record<string, number> = {};
  for (const row of options.rows) {
    weeklyTotals.set(row.weekOpenUtc, (weeklyTotals.get(row.weekOpenUtc) ?? 0) + row.pairContributionAdr);
  }
  for (const week of options.allWeeks) {
    const year = yearFromIso(week);
    yearTotals[year] = (yearTotals[year] ?? 0) + (weeklyTotals.get(week) ?? 0);
  }
  const activeWeeks = [...weeklyTotals.values()].filter((value) => value !== 0).length;
  const winWeeksActive = [...weeklyTotals.values()].filter((value) => value > 0).length;
  const winWeeksAll = options.allWeeks.filter((week) => (weeklyTotals.get(week) ?? 0) > 0).length;
  const totalAdr = [...weeklyTotals.values()].reduce((sum, value) => sum + value, 0);
  const weeklyPathStats = pathStats(weeklySeries(weeklyTotals, options.allWeeks));
  const drawdown = maxDrawdown(weeklyTotals, options.allWeeks);
  const yearEntries = Object.entries(yearTotals);
  const positiveYears = yearEntries.filter(([, value]) => value > 0).length;
  const sortedYears = [...yearEntries].sort((left, right) => left[1] - right[1]);
  const conc = concentration(options.rows);

  const metric: ModeMetric = {
    thresholdPercent: options.threshold,
    mode: options.mode,
    variantId: options.variantId,
    variantLabel: options.variantLabel,
    selectedRows: options.rows.length,
    activeWeeks,
    totalAdr: round(totalAdr, 4) ?? 0,
    weeklyWinRateActive: activeWeeks > 0 ? round(winWeeksActive / activeWeeks, 4) : null,
    weeklyWinRateAll: round(winWeeksAll / options.allWeeks.length, 4) ?? 0,
    meanWeeklyAdr: weeklyPathStats.meanWeeklyAdr,
    weeklyStdDevAdr: weeklyPathStats.weeklyStdDevAdr,
    pathSharpeAdr: weeklyPathStats.pathSharpeAdr,
    profitFactorAdr: weeklyPathStats.profitFactorAdr,
    profitFactorDenominatorZero: weeklyPathStats.profitFactorDenominatorZero,
    positiveWeeklyAdr: weeklyPathStats.positiveWeeklyAdr,
    negativeWeeklyAdr: weeklyPathStats.negativeWeeklyAdr,
    positiveWeeks: weeklyPathStats.positiveWeeks,
    negativeWeeks: weeklyPathStats.negativeWeeks,
    flatWeeks: weeklyPathStats.flatWeeks,
    maxDrawdownAdr: round(drawdown, 4) ?? 0,
    returnToDrawdown: drawdown < 0 ? round(totalAdr / Math.abs(drawdown), 4) : null,
    avgAdrPerSelectedPair: options.rows.length > 0 ? round(totalAdr / options.rows.length, 6) : null,
    topPair: conc.topPair,
    topPairAbsShare: round(conc.topPairAbsShare, 4),
    topCurrency: conc.topCurrency,
    topCurrencyAbsShare: round(conc.topCurrencyAbsShare, 4),
    positiveYears,
    yearCount: yearEntries.length,
    positiveYearRate: yearEntries.length > 0 ? round(positiveYears / yearEntries.length, 4) : null,
    worstYear: sortedYears[0]?.[0] ?? null,
    worstYearAdr: round(sortedYears[0]?.[1] ?? null),
    bestYear: sortedYears[sortedYears.length - 1]?.[0] ?? null,
    bestYearAdr: round(sortedYears[sortedYears.length - 1]?.[1] ?? null),
    yearAdr: Object.fromEntries(yearEntries.map(([year, value]) => [year, round(value, 4) ?? 0])),
    baselineTotalAdr: round(options.baselineTotalAdr, 4) ?? 0,
    deltaVsBaselineAdr: round(totalAdr - options.baselineTotalAdr, 4) ?? 0,
  };
  return metric;
}

async function readBoundaryManifest(boundaryManifestPath: string) {
  const raw = await readFile(boundaryManifestPath, "utf8");
  const parsed = JSON.parse(raw) as JsonRecord;
  const claimBoundary = parsed.claimBoundary as JsonRecord | undefined;
  const blockers = [
    parsed.status !== "PASS_EVIDENCE_BOUNDARY_MANIFEST" ? "boundary_manifest_not_passed" : null,
    claimBoundary?.diagnosticAgainstLegacyBaseline !== true ? "boundary_not_diagnostic_against_legacy_baseline" : null,
    claimBoundary?.fullStackSourcePromotionClaim !== false ? "boundary_allows_full_stack_source_promotion_claim" : null,
    claimBoundary?.productionClaim !== false ? "boundary_allows_production_claim" : null,
  ].filter((item): item is string => Boolean(item));
  if (blockers.length > 0) {
    throw new Error(`Gate 51 boundary manifest failed: ${blockers.join(", ")}`);
  }
  return parsed;
}

async function readGate50JoinReceipt() {
  const raw = await readFile(GATE50_ACTIVE_JOIN_RECEIPT, "utf8");
  const parsed = JSON.parse(raw) as JsonRecord;
  const summary = parsed.summary as JsonRecord | undefined;
  const blockers = [
    summary?.joinReceiptStatus !== "PASS" ? "gate50_join_not_pass" : null,
    summary?.diagnosticOnly !== false ? "gate50_join_diagnostic_only" : null,
    summary?.promotionEligible !== true ? "gate50_join_not_promotion_eligible" : null,
    summary?.featureBundleManifestId !== FEATURE_BUNDLE_ID ? "gate50_feature_bundle_mismatch" : null,
    summary?.sourceContentInvariantHash !== SOURCE_CONTENT_INVARIANT_HASH ? "gate50_source_content_hash_mismatch" : null,
    summary?.resolvedContentJoinMapHash !== RESOLVED_CONTENT_JOIN_MAP_HASH ? "gate50_resolved_content_join_hash_mismatch" : null,
  ].filter((item): item is string => Boolean(item));
  if (blockers.length > 0) {
    throw new Error(`Gate 50 ACTIVE join receipt failed: ${blockers.join(", ")}`);
  }
  return parsed;
}

async function readMatrixDataset() {
  const rows = await query<MatrixDatasetRow>(
    `
      SELECT dataset_id, dataset_hash, dataset_version, status, asset_class, from_utc, to_utc, coverage
      FROM research_matrix_datasets
      WHERE dataset_id = $1::uuid
    `,
    [MATRIX_DATASET_ID],
  );
  const row = rows[0];
  if (!row) throw new Error(`Missing matrix dataset ${MATRIX_DATASET_ID}`);
  if (row.dataset_hash !== MATRIX_DATASET_HASH) {
    throw new Error(`Matrix dataset hash mismatch: ${row.dataset_hash}`);
  }
  if (row.status !== "complete") {
    throw new Error(`Matrix dataset is not complete: ${row.status}`);
  }
  return row;
}

async function readMacroDataset() {
  const rows = await query<MacroDatasetRow>(
    `
      SELECT
        regime_dataset_id,
        dataset_hash,
        dataset_version,
        status,
        snapshot_state,
        promotion_manifest_id,
        contract_manifest_hash
      FROM research_macro_regime_datasets
      WHERE regime_dataset_id = $1::uuid
    `,
    [RRP_DATASET_ID],
  );
  const row = rows[0];
  if (!row) throw new Error(`Missing RRP macro dataset ${RRP_DATASET_ID}`);
  if (row.dataset_hash !== RRP_DATASET_HASH) {
    throw new Error(`RRP dataset hash mismatch: ${row.dataset_hash}`);
  }
  if (row.status !== "complete") {
    throw new Error(`RRP dataset is not complete: ${row.status}`);
  }
  return row;
}

async function readVariantRuns(variantIds: string[]) {
  const params: unknown[] = [MATRIX_DATASET_ID];
  const variantFilter = variantIds.length > 0
    ? `AND variant_id = ANY($${params.push(variantIds)}::text[])`
    : "";
  const rows = await query<VariantRunRow>(
    `
      SELECT variant_run_id, variant_id, variant_label
      FROM research_matrix_variant_runs
      WHERE dataset_id = $1::uuid
      ${variantFilter}
      ORDER BY variant_id
    `,
    params,
  );
  if (rows.length === 0) {
    throw new Error(`No variant runs found for requested variant ids: ${variantIds.join(", ") || "all"}`);
  }
  return rows;
}

async function readWeekResults(variantRunIds: string[]) {
  const rows = await query<WeekResultRow>(
    `
      SELECT
        r.variant_run_id,
        r.variant_id,
        r.variant_label,
        w.week_open_utc,
        w.selected_pair_sides,
        w.fills,
        w.final_adr,
        w.max_drawdown_adr,
        w.week_close_adr,
        w.pair_contributions
      FROM research_matrix_variant_week_results w
      JOIN research_matrix_variant_runs r
        ON r.variant_run_id = w.variant_run_id
      WHERE r.variant_run_id = ANY($1::uuid[])
      ORDER BY r.variant_id, w.week_open_utc
    `,
    [variantRunIds],
  );
  return rows;
}

async function readPairDecisions(variantRunIds: string[]) {
  const rows = await query<PairDecisionRow>(
    `
      SELECT
        r.variant_run_id,
        r.variant_id,
        d.week_open_utc,
        d.symbol,
        d.selected_side
      FROM research_matrix_pair_decisions d
      JOIN research_matrix_variant_runs r
        ON r.variant_run_id = d.variant_run_id
      WHERE r.variant_run_id = ANY($1::uuid[])
        AND d.selected_side IN ('LONG', 'SHORT')
      ORDER BY r.variant_id, d.week_open_utc, d.symbol
    `,
    [variantRunIds],
  );
  return rows;
}

async function readRrpSnapshots() {
  const rows = await query<RrpSnapshotRow>(
    `
      SELECT
        week_open_utc,
        currency,
        normalized_value_json->>'realRatePercent' AS real_rate_percent
      FROM research_macro_weekly_currency_snapshots
      WHERE regime_dataset_id = $1::uuid
        AND source_family = 'real_rate_pressure'
        AND source_id = 'derived_real_rate_pressure_3m_interbank_v1'
      ORDER BY week_open_utc, currency
    `,
    [RRP_DATASET_ID],
  );
  return rows;
}

function buildAttributionRows(options: {
  decisions: PairDecisionRow[];
  weekResults: WeekResultRow[];
  variants: VariantRunRow[];
  rrpRows: RrpSnapshotRow[];
}) {
  const variantByRun = new Map(options.variants.map((row) => [row.variant_run_id, row]));
  const weekResultByVariantWeek = new Map<string, WeekResultRow>();
  const allWeeks = [...new Set(options.weekResults.map((row) => isoUtc(row.week_open_utc)).filter(Boolean) as string[])]
    .sort();
  const rrpByWeekCurrency = new Map<string, number>();

  for (const row of options.weekResults) {
    const week = isoUtc(row.week_open_utc);
    if (week) weekResultByVariantWeek.set(`${row.variant_run_id}|${week}`, row);
  }
  for (const row of options.rrpRows) {
    const week = isoUtc(row.week_open_utc);
    if (!week) continue;
    rrpByWeekCurrency.set(`${week}|${row.currency.toUpperCase()}`, asNumber(row.real_rate_percent, Number.NaN));
  }

  let missingWeekResultRows = 0;
  let zeroFilledMissingPairContributionRows = 0;
  let missingRrpRows = 0;
  const rows: PairAttributionRow[] = [];

  for (const decision of options.decisions) {
    const week = isoUtc(decision.week_open_utc);
    if (!week) continue;
    const weekResult = weekResultByVariantWeek.get(`${decision.variant_run_id}|${week}`);
    if (!weekResult) {
      missingWeekResultRows += 1;
      continue;
    }
    let contribution = asNumber(weekResult.pair_contributions?.[decision.symbol], Number.NaN);
    let zeroFilledPairContribution = false;
    if (!Number.isFinite(contribution)) {
      zeroFilledMissingPairContributionRows += 1;
      contribution = 0;
      zeroFilledPairContribution = true;
    }
    const { base, quote } = parsePair(decision.symbol);
    const baseRrp = rrpByWeekCurrency.get(`${week}|${base}`);
    const quoteRrp = rrpByWeekCurrency.get(`${week}|${quote}`);
    if (!Number.isFinite(baseRrp) || !Number.isFinite(quoteRrp)) {
      missingRrpRows += 1;
      continue;
    }
    const variant = variantByRun.get(decision.variant_run_id);
    const differential = baseRrp! - quoteRrp!;
    const alignment = decision.selected_side === "LONG" ? differential : -differential;
    rows.push({
      variantRunId: decision.variant_run_id,
      variantId: decision.variant_id,
      variantLabel: variant?.variant_label ?? decision.variant_id,
      weekOpenUtc: week,
      year: new Date(week).getUTCFullYear(),
      symbol: decision.symbol.toUpperCase(),
      base,
      quote,
      selectedSide: decision.selected_side,
      pairContributionAdr: contribution,
      zeroFilledPairContribution,
      baseRrpPercent: baseRrp!,
      quoteRrpPercent: quoteRrp!,
      pairRrpDifferentialPercent: differential,
      selectedSideRrpAlignmentPercent: alignment,
    });
  }

  return {
    rows,
    allWeeks,
    blockers: {
      missingWeekResultRows,
      missingRrpRows,
    },
    warnings: {
      zeroFilledMissingPairContributionRows,
    },
  };
}

function computeMetrics(options: {
  rows: PairAttributionRow[];
  variants: VariantRunRow[];
  weekResults: WeekResultRow[];
  allWeeks: string[];
  thresholds: number[];
}) {
  const rowsByVariant = new Map<string, PairAttributionRow[]>();
  const baselineByVariant = new Map<string, number>();
  const labelByVariant = new Map(options.variants.map((variant) => [variant.variant_id, variant.variant_label]));

  for (const row of options.rows) {
    const current = rowsByVariant.get(row.variantId) ?? [];
    current.push(row);
    rowsByVariant.set(row.variantId, current);
  }
  for (const row of options.weekResults) {
    baselineByVariant.set(row.variant_id, (baselineByVariant.get(row.variant_id) ?? 0) + asNumber(row.final_adr));
  }

  const modes: ModeId[] = [
    "selected_all",
    "rrp_confirm_only",
    "rrp_fade_only",
    "rrp_weak_only",
    "rrp_block_fade",
    "rrp_block_fade_and_weak",
    "rrp_block_confirm",
  ];
  const modeMetrics: ModeMetric[] = [];
  const separations: ThresholdSeparation[] = [];

  for (const variant of options.variants) {
    const variantRows = rowsByVariant.get(variant.variant_id) ?? [];
    const baselineTotalAdr = baselineByVariant.get(variant.variant_id) ?? 0;
    for (const threshold of options.thresholds) {
      const rowsByBucket = new Map<RrpBucket, PairAttributionRow[]>([
        ["confirm", []],
        ["fade", []],
        ["weak", []],
      ]);
      for (const row of variantRows) {
        rowsByBucket.get(bucketForAlignment(row.selectedSideRrpAlignmentPercent, threshold))!.push(row);
      }

      const metricByMode = new Map<ModeId, ModeMetric>();
      for (const mode of modes) {
        const filteredRows = variantRows.filter((row) => modeIncludes(
          mode,
          bucketForAlignment(row.selectedSideRrpAlignmentPercent, threshold),
        ));
        const metric = metricForMode({
          threshold,
          mode,
          variantId: variant.variant_id,
          variantLabel: labelByVariant.get(variant.variant_id) ?? variant.variant_id,
          rows: filteredRows,
          allWeeks: options.allWeeks,
          baselineTotalAdr,
        });
        metricByMode.set(mode, metric);
        modeMetrics.push(metric);
      }

      const confirm = metricByMode.get("rrp_confirm_only")!;
      const fade = metricByMode.get("rrp_fade_only")!;
      const blockFade = metricByMode.get("rrp_block_fade")!;
      separations.push({
        thresholdPercent: threshold,
        variantId: variant.variant_id,
        variantLabel: variant.variant_label,
        confirmRows: confirm.selectedRows,
        fadeRows: fade.selectedRows,
        confirmTotalAdr: confirm.totalAdr,
        fadeTotalAdr: fade.totalAdr,
        confirmAvgAdrPerPair: confirm.avgAdrPerSelectedPair,
        fadeAvgAdrPerPair: fade.avgAdrPerSelectedPair,
        confirmMinusFadeAvgAdrPerPair:
          confirm.avgAdrPerSelectedPair !== null && fade.avgAdrPerSelectedPair !== null
            ? round(confirm.avgAdrPerSelectedPair - fade.avgAdrPerSelectedPair, 6)
            : null,
        blockFadeDeltaVsBaselineAdr: blockFade.deltaVsBaselineAdr,
      });
    }
  }

  return { modeMetrics, separations };
}

function filteredRowsForMode(rows: PairAttributionRow[], threshold: number, mode: ModeId) {
  return rows.filter((row) => modeIncludes(
    mode,
    bucketForAlignment(row.selectedSideRrpAlignmentPercent, threshold),
  ));
}

function sumAdr(rows: PairAttributionRow[]) {
  return rows.reduce((sum, row) => sum + row.pairContributionAdr, 0);
}

function zeroFillAdjustedRows(rows: PairAttributionRow[], penaltyAdrPerRow: number) {
  return rows.map((row) => row.zeroFilledPairContribution
    ? { ...row, pairContributionAdr: penaltyAdrPerRow }
    : row);
}

function topAbsYearShare(yearAdr: Record<string, number>, topN: number) {
  const entries = Object.entries(yearAdr);
  const totalAbs = entries.reduce((sum, [, value]) => sum + Math.abs(value), 0);
  if (totalAbs <= 0) return null;
  const topAbs = entries
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, topN)
    .reduce((sum, [, value]) => sum + Math.abs(value), 0);
  return round(topAbs / totalAbs, 4);
}

function aggregateByPair(modeRows: Record<ModeId, PairAttributionRow[]>, top: number) {
  const symbols = new Set<string>();
  for (const rows of Object.values(modeRows)) {
    for (const row of rows) symbols.add(row.symbol);
  }

  return [...symbols].map((symbol) => {
    const selectedRows = modeRows.selected_all.filter((row) => row.symbol === symbol);
    const blockFadeRows = modeRows.rrp_block_fade.filter((row) => row.symbol === symbol);
    const confirmRows = modeRows.rrp_confirm_only.filter((row) => row.symbol === symbol);
    const fadeRows = modeRows.rrp_fade_only.filter((row) => row.symbol === symbol);
    const weakRows = modeRows.rrp_weak_only.filter((row) => row.symbol === symbol);
    const blockConfirmRows = modeRows.rrp_block_confirm.filter((row) => row.symbol === symbol);
    const selectedAllAdr = sumAdr(selectedRows);
    const blockFadeAdr = sumAdr(blockFadeRows);
    return {
      symbol,
      selectedRows: selectedRows.length,
      blockFadeRows: blockFadeRows.length,
      confirmRows: confirmRows.length,
      fadeRows: fadeRows.length,
      weakRows: weakRows.length,
      zeroFilledRows: selectedRows.filter((row) => row.zeroFilledPairContribution).length,
      selectedAllAdr: round(selectedAllAdr, 4) ?? 0,
      blockFadeAdr: round(blockFadeAdr, 4) ?? 0,
      blockFadeDeltaVsSelectedAllAdr: round(blockFadeAdr - selectedAllAdr, 4) ?? 0,
      confirmAdr: round(sumAdr(confirmRows), 4) ?? 0,
      fadeAdr: round(sumAdr(fadeRows), 4) ?? 0,
      weakAdr: round(sumAdr(weakRows), 4) ?? 0,
      blockConfirmAdr: round(sumAdr(blockConfirmRows), 4) ?? 0,
    };
  })
    .sort((left, right) =>
      Math.abs(right.blockFadeDeltaVsSelectedAllAdr) - Math.abs(left.blockFadeDeltaVsSelectedAllAdr))
    .slice(0, top);
}

function currencyTotals(rows: PairAttributionRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const split = row.pairContributionAdr / 2;
    totals.set(row.base, (totals.get(row.base) ?? 0) + split);
    totals.set(row.quote, (totals.get(row.quote) ?? 0) + split);
  }
  return totals;
}

function aggregateByCurrency(modeRows: Record<ModeId, PairAttributionRow[]>, top: number) {
  const totalsByMode = Object.fromEntries(
    Object.entries(modeRows).map(([mode, rows]) => [mode, currencyTotals(rows)]),
  ) as Record<ModeId, Map<string, number>>;
  const currencies = new Set<string>();
  for (const totals of Object.values(totalsByMode)) {
    for (const currency of totals.keys()) currencies.add(currency);
  }

  return [...currencies].map((currency) => {
    const selectedAllAdr = totalsByMode.selected_all.get(currency) ?? 0;
    const blockFadeAdr = totalsByMode.rrp_block_fade.get(currency) ?? 0;
    return {
      currency,
      selectedAllAdr: round(selectedAllAdr, 4) ?? 0,
      blockFadeAdr: round(blockFadeAdr, 4) ?? 0,
      blockFadeDeltaVsSelectedAllAdr: round(blockFadeAdr - selectedAllAdr, 4) ?? 0,
      confirmAdr: round(totalsByMode.rrp_confirm_only.get(currency) ?? 0, 4) ?? 0,
      fadeAdr: round(totalsByMode.rrp_fade_only.get(currency) ?? 0, 4) ?? 0,
      weakAdr: round(totalsByMode.rrp_weak_only.get(currency) ?? 0, 4) ?? 0,
      blockConfirmAdr: round(totalsByMode.rrp_block_confirm.get(currency) ?? 0, 4) ?? 0,
    };
  })
    .sort((left, right) =>
      Math.abs(right.blockFadeDeltaVsSelectedAllAdr) - Math.abs(left.blockFadeDeltaVsSelectedAllAdr))
    .slice(0, top);
}

function buildCandidateValidation(options: {
  candidateVariantId: string;
  candidateThreshold: number;
  top: number;
  rows: PairAttributionRow[];
  variants: VariantRunRow[];
  weekResults: WeekResultRow[];
  allWeeks: string[];
}) {
  const variant = options.variants.find((row) => row.variant_id === options.candidateVariantId);
  if (!variant) {
    throw new Error(`Candidate variant not loaded: ${options.candidateVariantId}`);
  }

  const variantRows = options.rows.filter((row) => row.variantId === options.candidateVariantId);
  const baselineTotalAdr = options.weekResults
    .filter((row) => row.variant_id === options.candidateVariantId)
    .reduce((sum, row) => sum + asNumber(row.final_adr), 0);
  const modes: ModeId[] = [
    "selected_all",
    "rrp_block_fade",
    "rrp_confirm_only",
    "rrp_fade_only",
    "rrp_weak_only",
    "rrp_block_fade_and_weak",
    "rrp_block_confirm",
  ];
  const modeRows = Object.fromEntries(modes.map((mode) => [
    mode,
    filteredRowsForMode(variantRows, options.candidateThreshold, mode),
  ])) as Record<ModeId, PairAttributionRow[]>;

  const modeComparison = modes.map((mode) => ({
    mode,
    modeLabel: MODE_LABELS[mode],
    ...metricForMode({
      threshold: options.candidateThreshold,
      mode,
      variantId: variant.variant_id,
      variantLabel: variant.variant_label,
      rows: modeRows[mode],
      allWeeks: options.allWeeks,
      baselineTotalAdr,
    }),
  }));
  const metricByMode = new Map(modeComparison.map((metric) => [metric.mode, metric]));

  const bucketCounts = (["confirm", "fade", "weak"] as RrpBucket[]).map((bucket) => {
    const rows = variantRows.filter((row) =>
      bucketForAlignment(row.selectedSideRrpAlignmentPercent, options.candidateThreshold) === bucket);
    return {
      bucket,
      rows: rows.length,
      totalAdr: round(sumAdr(rows), 4) ?? 0,
      avgAdrPerPair: rows.length > 0 ? round(sumAdr(rows) / rows.length, 6) : null,
      zeroFilledRows: rows.filter((row) => row.zeroFilledPairContribution).length,
    };
  });

  const years = [...new Set(options.allWeeks.map(yearFromIso))].sort();
  const yearByYear = years.map((year) => {
    const selectedAllAdr = metricByMode.get("selected_all")?.yearAdr[year] ?? 0;
    const blockFadeAdr = metricByMode.get("rrp_block_fade")?.yearAdr[year] ?? 0;
    const confirmAdr = metricByMode.get("rrp_confirm_only")?.yearAdr[year] ?? 0;
    const fadeAdr = metricByMode.get("rrp_fade_only")?.yearAdr[year] ?? 0;
    const weakAdr = metricByMode.get("rrp_weak_only")?.yearAdr[year] ?? 0;
    const blockConfirmAdr = metricByMode.get("rrp_block_confirm")?.yearAdr[year] ?? 0;
    return {
      year,
      selectedAllAdr: round(selectedAllAdr, 4) ?? 0,
      blockFadeAdr: round(blockFadeAdr, 4) ?? 0,
      blockFadeDeltaVsSelectedAllAdr: round(blockFadeAdr - selectedAllAdr, 4) ?? 0,
      confirmAdr: round(confirmAdr, 4) ?? 0,
      fadeAdr: round(fadeAdr, 4) ?? 0,
      weakAdr: round(weakAdr, 4) ?? 0,
      blockConfirmAdr: round(blockConfirmAdr, 4) ?? 0,
    };
  });

  const zeroFillSensitivity = modes.map((mode) => {
    const rows = modeRows[mode];
    const zeroFilledRows = rows.filter((row) => row.zeroFilledPairContribution).length;
    const excludedRows = rows.filter((row) => !row.zeroFilledPairContribution);
    const worstCaseRows = zeroFillAdjustedRows(rows, ZERO_FILL_WORST_CASE_ADR_PER_ROW);
    return {
      mode,
      modeLabel: MODE_LABELS[mode],
      zeroFilledRows,
      zeroFilledContributionAdr: round(sumAdr(rows.filter((row) => row.zeroFilledPairContribution)), 4) ?? 0,
      baseTotalAdr: metricByMode.get(mode)?.totalAdr ?? null,
      excludeZeroFilledRows: metricForMode({
        threshold: options.candidateThreshold,
        mode,
        variantId: variant.variant_id,
        variantLabel: variant.variant_label,
        rows: excludedRows,
        allWeeks: options.allWeeks,
        baselineTotalAdr,
      }),
      worstCaseMinusOneAdrPerZeroFilledRow: metricForMode({
        threshold: options.candidateThreshold,
        mode,
        variantId: variant.variant_id,
        variantLabel: variant.variant_label,
        rows: worstCaseRows,
        allWeeks: options.allWeeks,
        baselineTotalAdr,
      }),
    };
  });

  const concentrationAddendum = modes.map((mode) => {
    const metric = metricByMode.get(mode)!;
    return {
      mode,
      modeLabel: MODE_LABELS[mode],
      topPair: metric.topPair,
      topPairAbsShare: metric.topPairAbsShare,
      topCurrency: metric.topCurrency,
      topCurrencyAbsShare: metric.topCurrencyAbsShare,
      topTwoYearAbsShare: topAbsYearShare(metric.yearAdr, 2),
    };
  });

  return {
    candidateVariantId: variant.variant_id,
    candidateVariantLabel: variant.variant_label,
    candidateThreshold: options.candidateThreshold,
    candidateThresholdLockedForValidation: true,
    adrNormalized: true,
    rawReturnsReported: false,
    pathSharpeDefinition: "annualized weekly ADR path Sharpe, using all matrix weeks with blocked/no-trade weeks carried as 0 ADR",
    profitFactorDefinition: "positive weekly ADR divided by absolute negative weekly ADR, using all matrix weeks",
    zeroFillWorstCaseAdrPerRow: ZERO_FILL_WORST_CASE_ADR_PER_ROW,
    baselineTotalAdrFromStoredWeekResults: round(baselineTotalAdr, 4) ?? 0,
    attributedSelectedAllAdr: metricByMode.get("selected_all")?.totalAdr ?? null,
    attributionMinusStoredBaselineAdr: round((metricByMode.get("selected_all")?.totalAdr ?? 0) - baselineTotalAdr, 4),
    modeComparison,
    bucketCounts,
    yearByYear,
    pairContributionTop: aggregateByPair(modeRows, options.top),
    currencyContributionTop: aggregateByCurrency(modeRows, options.top),
    concentrationAddendum,
    zeroFillSensitivity,
  };
}

function tableRows(rows: string[][]) {
  return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function fmt(value: unknown, digits = 2) {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(digits);
  return value === null || value === undefined ? "-" : String(value);
}

function renderMarkdown(receipt: JsonRecord) {
  const summary = receipt.summary as JsonRecord;
  const topBlockFade = receipt.topBlockFadeByReturnToDrawdown as ModeMetric[];
  const topSeparation = receipt.topConfirmVsFadeSeparation as ThresholdSeparation[];
  const lines: string[] = [];
  lines.push("# Gate 51A RRP Regime Filter Diagnostic");
  lines.push("");
  lines.push(`Generated: ${receipt.generatedAtUtc}`);
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push(`- Status: ${receipt.status}`);
  lines.push(`- Gate: ${GATE}`);
  lines.push(`- Mode: ${summary.mode}`);
  lines.push(`- Variants tested: ${summary.variantCount}`);
  lines.push(`- Thresholds: ${(summary.thresholds as number[]).join(", ")} RRP percentage points`);
  lines.push(`- Pair attribution rows: ${summary.pairAttributionRows}`);
  lines.push(`- ADR-normalized reporting: ${summary.adrNormalized}`);
  lines.push(`- Raw returns reported: ${summary.rawReturnsReported}`);
  lines.push(`- Diagnostic against legacy baseline: ${summary.diagnosticAgainstLegacyBaseline}`);
  lines.push(`- Full-stack source-promotion claim: ${summary.fullStackSourcePromotionClaim}`);
  lines.push(`- Production claim: ${summary.productionClaim}`);
  lines.push(`- Source refetch/rebuild: ${summary.sourceRefetchPerformed}/${summary.sourceRebuildPerformed}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- RRP is PROMOTED_SOURCE.");
  lines.push("- Gate 44 matrix, COT, COT Faces, Dealer/Commercial, Strength, and ADR Grid are FROZEN_LEGACY_DATASET for this diagnostic.");
  lines.push("- BPR, PPP, NEER, REER, valuation, and combined macro regime are OUT_OF_SCOPE.");
  lines.push("- This receipt uses existing warehouse outcomes and pair contributions; it does not rerun execution, refetch sources, or promote a live decision.");
  lines.push("");
  lines.push("## Top Block-Fade Filters");
  lines.push("");
  lines.push(tableRows([
    ["Variant", "Thr", "Rows", "Total ADR", "Delta vs Base", "Max DD", "R/DD", "Path Sharpe", "Profit Factor", "Win Active", "Worst Year"],
    ...topBlockFade.map((row) => [
      row.variantId,
      fmt(row.thresholdPercent),
      fmt(row.selectedRows, 0),
      fmt(row.totalAdr),
      fmt(row.deltaVsBaselineAdr),
      fmt(row.maxDrawdownAdr),
      fmt(row.returnToDrawdown),
      fmt(row.pathSharpeAdr),
      fmt(row.profitFactorAdr),
      fmt(row.weeklyWinRateActive),
      `${row.worstYear ?? "-"} ${fmt(row.worstYearAdr)}`,
    ]),
  ]));
  lines.push("");
  lines.push("## Top Confirm vs Fade Separation");
  lines.push("");
  lines.push(tableRows([
    ["Variant", "Thr", "Confirm Rows", "Fade Rows", "Confirm ADR/Pair", "Fade ADR/Pair", "Spread", "Block-Fade Delta"],
    ...topSeparation.map((row) => [
      row.variantId,
      fmt(row.thresholdPercent),
      fmt(row.confirmRows, 0),
      fmt(row.fadeRows, 0),
      fmt(row.confirmAvgAdrPerPair, 4),
      fmt(row.fadeAvgAdrPerPair, 4),
      fmt(row.confirmMinusFadeAvgAdrPerPair, 4),
      fmt(row.blockFadeDeltaVsBaselineAdr),
    ]),
  ]));
  lines.push("");

  const candidateValidation = receipt.candidateValidation as JsonRecord | undefined;
  if (candidateValidation) {
    const modeComparison = candidateValidation.modeComparison as JsonRecord[];
    const bucketCounts = candidateValidation.bucketCounts as JsonRecord[];
    const yearByYear = candidateValidation.yearByYear as JsonRecord[];
    const pairContributionTop = candidateValidation.pairContributionTop as JsonRecord[];
    const currencyContributionTop = candidateValidation.currencyContributionTop as JsonRecord[];
    const zeroFillSensitivity = candidateValidation.zeroFillSensitivity as JsonRecord[];

    lines.push("## Fixed Candidate Validation Addendum");
    lines.push("");
    lines.push(`- Candidate: ${candidateValidation.candidateVariantId}`);
    lines.push(`- Threshold: ${candidateValidation.candidateThreshold} RRP percentage points`);
    lines.push(`- Threshold locked for validation: ${candidateValidation.candidateThresholdLockedForValidation}`);
    lines.push(`- ADR-normalized: ${candidateValidation.adrNormalized}`);
    lines.push(`- Path Sharpe: ${candidateValidation.pathSharpeDefinition}`);
    lines.push(`- Profit factor: ${candidateValidation.profitFactorDefinition}`);
    lines.push(`- Zero-fill worst-case assumption: ${candidateValidation.zeroFillWorstCaseAdrPerRow} ADR per zero-filled row`);
    lines.push("");
    lines.push("### Mode Comparison");
    lines.push("");
    lines.push(tableRows([
      ["Mode", "Rows", "Total ADR", "Delta vs Base", "Max DD", "R/DD", "Path Sharpe", "Profit Factor", "Win Active", "Worst Year"],
      ...modeComparison.map((row) => [
        String(row.modeLabel),
        fmt(row.selectedRows, 0),
        fmt(row.totalAdr),
        fmt(row.deltaVsBaselineAdr),
        fmt(row.maxDrawdownAdr),
        fmt(row.returnToDrawdown),
        fmt(row.pathSharpeAdr),
        fmt(row.profitFactorAdr),
        fmt(row.weeklyWinRateActive),
        `${row.worstYear ?? "-"} ${fmt(row.worstYearAdr)}`,
      ]),
    ]));
    lines.push("");
    lines.push("### RRP Buckets");
    lines.push("");
    lines.push(tableRows([
      ["Bucket", "Rows", "Total ADR", "Avg ADR/Pair", "Zero-filled Rows"],
      ...bucketCounts.map((row) => [
        String(row.bucket),
        fmt(row.rows, 0),
        fmt(row.totalAdr),
        fmt(row.avgAdrPerPair, 4),
        fmt(row.zeroFilledRows, 0),
      ]),
    ]));
    lines.push("");
    lines.push("### Year By Year");
    lines.push("");
    lines.push(tableRows([
      ["Year", "No RRP", "Block Fade", "Delta", "Confirm", "Fade", "Weak", "Block Confirm"],
      ...yearByYear.map((row) => [
        String(row.year),
        fmt(row.selectedAllAdr),
        fmt(row.blockFadeAdr),
        fmt(row.blockFadeDeltaVsSelectedAllAdr),
        fmt(row.confirmAdr),
        fmt(row.fadeAdr),
        fmt(row.weakAdr),
        fmt(row.blockConfirmAdr),
      ]),
    ]));
    lines.push("");
    lines.push("### Pair Contribution Top");
    lines.push("");
    lines.push(tableRows([
      ["Pair", "No RRP", "Block Fade", "Delta", "Confirm", "Fade", "Weak", "Zero Rows"],
      ...pairContributionTop.slice(0, 12).map((row) => [
        String(row.symbol),
        fmt(row.selectedAllAdr),
        fmt(row.blockFadeAdr),
        fmt(row.blockFadeDeltaVsSelectedAllAdr),
        fmt(row.confirmAdr),
        fmt(row.fadeAdr),
        fmt(row.weakAdr),
        fmt(row.zeroFilledRows, 0),
      ]),
    ]));
    lines.push("");
    lines.push("### Currency Contribution Top");
    lines.push("");
    lines.push(tableRows([
      ["Currency", "No RRP", "Block Fade", "Delta", "Confirm", "Fade", "Weak"],
      ...currencyContributionTop.slice(0, 12).map((row) => [
        String(row.currency),
        fmt(row.selectedAllAdr),
        fmt(row.blockFadeAdr),
        fmt(row.blockFadeDeltaVsSelectedAllAdr),
        fmt(row.confirmAdr),
        fmt(row.fadeAdr),
        fmt(row.weakAdr),
      ]),
    ]));
    lines.push("");
    lines.push("### Zero-Fill Sensitivity");
    lines.push("");
    lines.push(tableRows([
      ["Mode", "Zero Rows", "Base ADR", "Ex-Zero ADR", "Worst ADR", "Worst R/DD", "Worst Sharpe", "Worst PF"],
      ...zeroFillSensitivity.map((row) => {
        const exclude = row.excludeZeroFilledRows as JsonRecord;
        const worst = row.worstCaseMinusOneAdrPerZeroFilledRow as JsonRecord;
        return [
          String(row.modeLabel),
          fmt(row.zeroFilledRows, 0),
          fmt(row.baseTotalAdr),
          fmt(exclude.totalAdr),
          fmt(worst.totalAdr),
          fmt(worst.returnToDrawdown),
          fmt(worst.pathSharpeAdr),
          fmt(worst.profitFactorAdr),
        ];
      }),
    ]));
    lines.push("");
  }

  lines.push("## Files");
  lines.push("");
  const files = receipt.files as JsonRecord;
  lines.push(`- JSON: ${files.jsonPath}`);
  lines.push(`- Markdown: ${files.mdPath}`);
  lines.push("");
  lines.push("No live, ACTIVE, production-ready, portfolio-ready, BPR, PPP, NEER, REER, valuation, or combined-regime claim is made by this receipt.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const cli = parseCli();
  await mkdir(cli.outDir, { recursive: true });

  const boundaryManifest = await readBoundaryManifest(cli.boundaryManifestPath);
  const gate50JoinReceipt = await readGate50JoinReceipt();
  const matrixDataset = await readMatrixDataset();
  const macroDataset = await readMacroDataset();
  const variants = await readVariantRuns(cli.variantIds);
  const variantRunIds = variants.map((row) => row.variant_run_id);
  const [weekResults, pairDecisions, rrpRows] = await Promise.all([
    readWeekResults(variantRunIds),
    readPairDecisions(variantRunIds),
    readRrpSnapshots(),
  ]);

  const attribution = buildAttributionRows({
    decisions: pairDecisions,
    weekResults,
    variants,
    rrpRows,
  });
  const metrics = computeMetrics({
    rows: attribution.rows,
    variants,
    weekResults,
    allWeeks: attribution.allWeeks,
    thresholds: cli.thresholds,
  });

  const top = cli.top;
  const topBlockFadeByReturnToDrawdown = metrics.modeMetrics
    .filter((row) => row.mode === "rrp_block_fade" && row.returnToDrawdown !== null)
    .sort((left, right) => (right.returnToDrawdown ?? -Infinity) - (left.returnToDrawdown ?? -Infinity))
    .slice(0, top);
  const topConfirmVsFadeSeparation = metrics.separations
    .filter((row) => row.confirmMinusFadeAvgAdrPerPair !== null && row.confirmRows > 0 && row.fadeRows > 0)
    .sort((left, right) => (right.confirmMinusFadeAvgAdrPerPair ?? -Infinity) - (left.confirmMinusFadeAvgAdrPerPair ?? -Infinity))
    .slice(0, top);
  const candidateValidation = cli.validationAddendum
    ? buildCandidateValidation({
      candidateVariantId: cli.candidateVariantId,
      candidateThreshold: cli.candidateThreshold,
      top,
      rows: attribution.rows,
      variants,
      weekResults,
      allWeeks: attribution.allWeeks,
    })
    : null;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").slice(0, 15);
  const reportStem = cli.validationAddendum
    ? `gate51-rrp-candidate-validation-addendum-${cli.mode}-${stamp}`
    : `gate51-rrp-regime-filter-diagnostic-${cli.mode}-${stamp}`;
  const jsonPath = cli.jsonOut ?? path.join(cli.outDir, `${reportStem}.json`);
  const mdPath = cli.mdOut ?? path.join(cli.outDir, `${reportStem}.md`);

  const receiptWithoutHash = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    gate: GATE,
    status: "PASS_RRP_DIAGNOSTIC_ATTRIBUTION",
    summary: {
      mode: cli.mode,
      variantCount: variants.length,
      thresholds: cli.thresholds,
      weekCount: attribution.allWeeks.length,
      pairDecisionRowsRead: pairDecisions.length,
      pairAttributionRows: attribution.rows.length,
      rrpCurrencyRowsRead: rrpRows.length,
      weekResultRowsRead: weekResults.length,
      adrNormalized: true,
      rawReturnsReported: false,
      validationAddendum: cli.validationAddendum,
      candidateVariantId: cli.validationAddendum ? cli.candidateVariantId : null,
      candidateThreshold: cli.validationAddendum ? cli.candidateThreshold : null,
      pathSharpeMetric: "annualized_weekly_adr_path_sharpe",
      profitFactorMetric: "positive_weekly_adr_over_absolute_negative_weekly_adr",
      diagnosticAgainstLegacyBaseline: true,
      fullStackSourcePromotionClaim: false,
      productionClaim: false,
      liveClaim: false,
      activePromotionClaim: false,
      sourceRefetchPerformed: false,
      sourceRebuildPerformed: false,
      lifecyclePromotionTouched: false,
      executionRerunPerformed: false,
      bprTested: false,
      pppNeerReerTested: false,
      combinedMacroRegimeTested: false,
    },
    identity: {
      matrixDataset: {
        datasetId: matrixDataset.dataset_id,
        datasetHash: matrixDataset.dataset_hash,
        datasetVersion: matrixDataset.dataset_version,
        status: matrixDataset.status,
        fromUtc: isoUtc(matrixDataset.from_utc),
        toUtc: isoUtc(matrixDataset.to_utc),
      },
      rrpDataset: {
        regimeDatasetId: macroDataset.regime_dataset_id,
        datasetHash: macroDataset.dataset_hash,
        datasetVersion: macroDataset.dataset_version,
        status: macroDataset.status,
        snapshotState: macroDataset.snapshot_state,
        featureBundleManifestId: FEATURE_BUNDLE_ID,
        sourceContentInvariantHash: SOURCE_CONTENT_INVARIANT_HASH,
        resolvedContentJoinMapHash: RESOLVED_CONTENT_JOIN_MAP_HASH,
      },
      boundaryManifestPath: cli.boundaryManifestPath,
      gate50ActiveJoinReceiptPath: GATE50_ACTIVE_JOIN_RECEIPT,
      gate50ActiveJoinStatus: ((gate50JoinReceipt.summary as JsonRecord).joinReceiptStatus as string) ?? null,
    },
    controls: {
      boundaryManifestStatus: boundaryManifest.status,
      inputClassifications: (boundaryManifest.inputClassifications as unknown[]) ?? [],
      allowedClaims: (boundaryManifest.allowedClaims as string[]) ?? [],
      forbiddenClaims: (boundaryManifest.forbiddenClaims as string[]) ?? [],
      rrpAlignmentRule: "LONG confirms when base RRP minus quote RRP is greater than threshold; SHORT confirms when quote RRP minus base RRP is greater than threshold.",
      thresholdUnit: "RRP percentage points",
      contributionSource: "research_matrix_variant_week_results.pair_contributions",
      reportingUnit: "ADR-normalized outcomes only; raw currency returns are not reported",
      noExecutionRerun: true,
    },
    blockers: attribution.blockers,
    warnings: attribution.warnings,
    variants: variants.map((row) => ({
      variantRunId: row.variant_run_id,
      variantId: row.variant_id,
      variantLabel: row.variant_label,
    })),
    modeResults: metrics.modeMetrics,
    confirmVsFadeSeparation: metrics.separations,
    topBlockFadeByReturnToDrawdown,
    topConfirmVsFadeSeparation,
    candidateValidation,
    files: {
      jsonPath,
      mdPath,
    },
  };
  const receipt = {
    ...receiptWithoutHash,
    receiptHash: sha256Stable(receiptWithoutHash),
  };
  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderMarkdown(receipt as JsonRecord), "utf8");

  console.log(JSON.stringify({
    status: receipt.status,
    mode: cli.mode,
    variants: variants.length,
    thresholds: cli.thresholds,
    pairAttributionRows: attribution.rows.length,
    topBlockFade: topBlockFadeByReturnToDrawdown.slice(0, 3).map((row) => ({
      variantId: row.variantId,
      thresholdPercent: row.thresholdPercent,
      totalAdr: row.totalAdr,
      deltaVsBaselineAdr: row.deltaVsBaselineAdr,
      returnToDrawdown: row.returnToDrawdown,
      pathSharpeAdr: row.pathSharpeAdr,
      profitFactorAdr: row.profitFactorAdr,
    })),
    candidateValidation: candidateValidation
      ? {
        candidateVariantId: candidateValidation.candidateVariantId,
        candidateThreshold: candidateValidation.candidateThreshold,
        modeComparison: candidateValidation.modeComparison.map((row) => ({
          mode: row.mode,
          totalAdr: row.totalAdr,
          returnToDrawdown: row.returnToDrawdown,
          pathSharpeAdr: row.pathSharpeAdr,
          profitFactorAdr: row.profitFactorAdr,
          maxDrawdownAdr: row.maxDrawdownAdr,
        })),
      }
      : null,
    jsonPath,
    mdPath,
    receiptHash: receipt.receiptHash,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
