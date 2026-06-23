import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { getPool, query } from "@/lib/db";

loadEnvConfig(process.cwd());

const GATE = "Gate 51B: cot-lifecycle-rrp-interaction-diagnostic";
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

const GATE46_EXPECTED_NONCOMM_POLARITY_COUNTS: Record<LifecyclePolarityBucket, number> = {
  fade_extreme: 11337,
  fade_lean: 10799,
  neutral_mixed: 58142,
  with_lean: 14943,
  with_extreme: 15863,
};

const GATE46_EXPECTED_NONCOMM_SCORE_COUNTS: Record<LifecycleScoreBucket, number> = {
  low_continuation: 19018,
  neutral: 65717,
  high_exhaustion: 26349,
};

type JsonRecord = Record<string, unknown>;
type Direction = "LONG" | "SHORT";
type RrpBucket = "confirm" | "fade" | "weak";
type LifecyclePolarityBucket = "fade_extreme" | "fade_lean" | "neutral_mixed" | "with_lean" | "with_extreme";
type LifecycleScoreBucket = "low_continuation" | "neutral" | "high_exhaustion";
type CrowdLeg = "noncomm_net" | "lev_money_net";

type CliOptions = {
  outDir: string;
  jsonOut: string | null;
  mdOut: string | null;
  boundaryManifestPath: string;
  rrpThreshold: number;
  lifecycleLookback: number;
  polarityLeanThreshold: number;
  polarityExtremeThreshold: number;
  scoreLowThreshold: number;
  scoreHighThreshold: number;
  crowdLeg: CrowdLeg;
  variantIds: string[];
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
  final_adr: number;
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
  crowdLeg: CrowdLeg;
  crowdPercentile: number;
  commercialPercentile: number;
  dealerPercentile: number;
  tei: number;
  signedTei: number;
  score: number;
};

type InteractionRow = {
  variantRunId: string;
  variantId: string;
  variantLabel: string;
  weekOpenUtc: string;
  reportDate: string;
  year: string;
  symbol: string;
  base: string;
  quote: string;
  selectedSide: Direction;
  longCurrency: string;
  shortCurrency: string;
  pairContributionAdr: number;
  zeroFilledPairContribution: boolean;
  baseTei: number;
  quoteTei: number;
  longCurrencyTei: number;
  shortCurrencyTei: number;
  lifecycleSignedSpread: number;
  lifecyclePolarityBucket: LifecyclePolarityBucket;
  longCurrencyScore: number;
  shortCurrencyScore: number;
  pairLifecycleScore: number;
  lifecycleScoreBucket: LifecycleScoreBucket;
  baseRrpPercent: number;
  quoteRrpPercent: number;
  pairRrpDifferentialPercent: number;
  selectedSideRrpAlignmentPercent: number;
  rrpBucket: RrpBucket;
};

type MetricRow = {
  variantId: string;
  variantLabel: string;
  groupType: string;
  lifecycleBucket: string;
  rrpBucket: RrpBucket | "all";
  selectedRows: number;
  activeWeeks: number;
  totalAdr: number;
  avgAdrPerPair: number | null;
  maxDrawdownAdr: number;
  returnToDrawdown: number | null;
  pathSharpeAdr: number | null;
  profitFactorAdr: number | null;
  weeklyWinRateActive: number | null;
  zeroFilledRows: number;
  topPair: string | null;
  topPairAbsShare: number | null;
  topCurrency: string | null;
  topCurrencyAbsShare: number | null;
  yearAdr: Record<string, number>;
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function parseList(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function parseCrowdLeg(value: string | null): CrowdLeg {
  return value === "lev_money_net" ? "lev_money_net" : "noncomm_net";
}

function parseCli(): CliOptions {
  const outDir = argValue("out-dir") ?? DEFAULT_OUT_DIR;
  return {
    outDir,
    jsonOut: argValue("json-out"),
    mdOut: argValue("md-out"),
    boundaryManifestPath: argValue("boundary-manifest") ?? DEFAULT_BOUNDARY_MANIFEST,
    rrpThreshold: parseNonNegativeNumber(argValue("rrp-threshold"), 1),
    lifecycleLookback: parsePositiveInt(argValue("lifecycle-lookback"), 156),
    polarityLeanThreshold: parseNonNegativeNumber(argValue("polarity-lean-threshold"), 10),
    polarityExtremeThreshold: parseNonNegativeNumber(argValue("polarity-extreme-threshold"), 30),
    scoreLowThreshold: parseNonNegativeNumber(argValue("score-low-threshold"), 30),
    scoreHighThreshold: parseNonNegativeNumber(argValue("score-high-threshold"), 70),
    crowdLeg: parseCrowdLeg(argValue("crowd-leg")),
    variantIds: parseList(argValue("variant-ids")),
    top: parsePositiveInt(argValue("top"), 25),
  };
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

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePair(symbol: string) {
  const normalized = symbol.toUpperCase();
  if (!/^[A-Z]{6}$/.test(normalized)) throw new Error(`Unsupported FX pair symbol: ${symbol}`);
  return { base: normalized.slice(0, 3), quote: normalized.slice(3, 6) };
}

function bucketForAlignment(alignment: number, threshold: number): RrpBucket {
  if (alignment > threshold) return "confirm";
  if (alignment < -threshold) return "fade";
  return "weak";
}

function lifecyclePolarityBucket(value: number, leanThreshold: number, extremeThreshold: number): LifecyclePolarityBucket {
  if (value <= -extremeThreshold) return "fade_extreme";
  if (value <= -leanThreshold) return "fade_lean";
  if (value >= extremeThreshold) return "with_extreme";
  if (value >= leanThreshold) return "with_lean";
  return "neutral_mixed";
}

function lifecycleScoreBucket(value: number, lowThreshold: number, highThreshold: number): LifecycleScoreBucket {
  if (value < lowThreshold) return "low_continuation";
  if (value > highThreshold) return "high_exhaustion";
  return "neutral";
}

function empiricalPercentile(values: number[], current: number) {
  return (values.filter((value) => value < current).length / values.length) * 100;
}

function weeklySeries(rows: InteractionRow[], allWeeks: string[]) {
  const weeklyTotals = new Map<string, number>();
  for (const row of rows) {
    weeklyTotals.set(row.weekOpenUtc, (weeklyTotals.get(row.weekOpenUtc) ?? 0) + row.pairContributionAdr);
  }
  return allWeeks.map((week) => weeklyTotals.get(week) ?? 0);
}

function maxDrawdown(values: number[]) {
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const value of values) {
    equity += value;
    if (equity > peak) peak = equity;
    const drawdown = equity - peak;
    if (drawdown < worst) worst = drawdown;
  }
  return worst;
}

function pathStats(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  const mean = values.length > 0 ? total / values.length : 0;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const positiveAdr = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeAdr = values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const drawdown = maxDrawdown(values);
  return {
    totalAdr: round(total, 4) ?? 0,
    maxDrawdownAdr: round(drawdown, 4) ?? 0,
    returnToDrawdown: drawdown < 0 ? round(total / Math.abs(drawdown), 4) : null,
    pathSharpeAdr: stdDev > 0 ? round((mean / stdDev) * Math.sqrt(52), 4) : null,
    profitFactorAdr: negativeAdr < 0 ? round(positiveAdr / Math.abs(negativeAdr), 4) : null,
    activeWeeks: values.filter((value) => value !== 0).length,
    weeklyWinRateActive: values.filter((value) => value !== 0).length > 0
      ? round(values.filter((value) => value > 0).length / values.filter((value) => value !== 0).length, 4)
      : null,
  };
}

function concentration(rows: InteractionRow[]) {
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

function metricForGroup(options: {
  variantId: string;
  variantLabel: string;
  groupType: string;
  lifecycleBucket: string;
  rrpBucket: RrpBucket | "all";
  rows: InteractionRow[];
  allWeeks: string[];
}): MetricRow {
  const path = pathStats(weeklySeries(options.rows, options.allWeeks));
  const totalAdr = options.rows.reduce((sum, row) => sum + row.pairContributionAdr, 0);
  const conc = concentration(options.rows);
  const yearAdr: Record<string, number> = {};
  for (const row of options.rows) {
    yearAdr[row.year] = (yearAdr[row.year] ?? 0) + row.pairContributionAdr;
  }
  return {
    variantId: options.variantId,
    variantLabel: options.variantLabel,
    groupType: options.groupType,
    lifecycleBucket: options.lifecycleBucket,
    rrpBucket: options.rrpBucket,
    selectedRows: options.rows.length,
    activeWeeks: path.activeWeeks,
    totalAdr: path.totalAdr,
    avgAdrPerPair: options.rows.length > 0 ? round(totalAdr / options.rows.length, 6) : null,
    maxDrawdownAdr: path.maxDrawdownAdr,
    returnToDrawdown: path.returnToDrawdown,
    pathSharpeAdr: path.pathSharpeAdr,
    profitFactorAdr: path.profitFactorAdr,
    weeklyWinRateActive: path.weeklyWinRateActive,
    zeroFilledRows: options.rows.filter((row) => row.zeroFilledPairContribution).length,
    topPair: conc.topPair,
    topPairAbsShare: round(conc.topPairAbsShare, 4),
    topCurrency: conc.topCurrency,
    topCurrencyAbsShare: round(conc.topCurrencyAbsShare, 4),
    yearAdr: Object.fromEntries(Object.entries(yearAdr).map(([year, value]) => [year, round(value, 4) ?? 0])),
  };
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
  if (blockers.length > 0) throw new Error(`Gate 51 boundary manifest failed: ${blockers.join(", ")}`);
  return parsed;
}

async function readGate50JoinReceipt() {
  const raw = await readFile(GATE50_ACTIVE_JOIN_RECEIPT, "utf8");
  const parsed = JSON.parse(raw) as JsonRecord;
  const summary = parsed.summary as JsonRecord | undefined;
  const blockers = [
    summary?.joinReceiptStatus !== "PASS" ? "gate50_join_not_pass" : null,
    summary?.featureBundleManifestId !== FEATURE_BUNDLE_ID ? "gate50_feature_bundle_mismatch" : null,
    summary?.sourceContentInvariantHash !== SOURCE_CONTENT_INVARIANT_HASH ? "gate50_source_content_hash_mismatch" : null,
    summary?.resolvedContentJoinMapHash !== RESOLVED_CONTENT_JOIN_MAP_HASH ? "gate50_resolved_content_join_hash_mismatch" : null,
  ].filter((item): item is string => Boolean(item));
  if (blockers.length > 0) throw new Error(`Gate 50 ACTIVE join receipt failed: ${blockers.join(", ")}`);
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
  if (rows.length === 0) throw new Error(`No variant runs found for requested variant ids: ${variantIds.join(", ") || "all"}`);
  return rows;
}

async function readWeekResults(variantRunIds: string[]) {
  return query<WeekResultRow>(
    `
      SELECT r.variant_run_id, r.variant_id, r.variant_label, w.week_open_utc, w.final_adr, w.pair_contributions
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

function buildLifecycleMap(options: {
  cotSnapshots: CotSnapshotRow[];
  crowdLeg: CrowdLeg;
  lookback: number;
}) {
  const snapshots = options.cotSnapshots
    .map((row) => ({ ...row, reportDate: dateKey(row.report_date) }))
    .filter((row): row is CotSnapshotRow & { reportDate: string } => Boolean(row.reportDate));
  const currencies = [...new Set(snapshots.flatMap((row) => Object.keys(row.currencies ?? {})))].sort();
  const stateByReportCurrency = new Map<string, CurrencyLifecycleState>();
  let missingMetricWindows = 0;

  for (let index = options.lookback - 1; index < snapshots.length; index += 1) {
    const window = snapshots.slice(index + 1 - options.lookback, index + 1);
    const current = snapshots[index];
    for (const currency of currencies) {
      const metricWindow = (field: string) => window
        .map((row) => numeric(row.currencies?.[currency]?.[field]))
        .filter((value): value is number => value !== null);
      const crowdWindow = metricWindow(options.crowdLeg);
      const commercialWindow = metricWindow("commercial_net");
      const dealerWindow = metricWindow("dealer_net");
      const currentCrowd = numeric(current.currencies?.[currency]?.[options.crowdLeg]);
      const currentCommercial = numeric(current.currencies?.[currency]?.commercial_net);
      const currentDealer = numeric(current.currencies?.[currency]?.dealer_net);
      if (
        crowdWindow.length !== options.lookback ||
        commercialWindow.length !== options.lookback ||
        dealerWindow.length !== options.lookback ||
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
      const signedTei = tei - 50;
      const score = Math.abs(signedTei) * 2;
      stateByReportCurrency.set(`${current.reportDate}|${currency}`, {
        reportDate: current.reportDate,
        currency,
        crowdLeg: options.crowdLeg,
        crowdPercentile,
        commercialPercentile,
        dealerPercentile,
        tei,
        signedTei,
        score,
      });
    }
  }

  return {
    stateByReportCurrency,
    lifecycleFirstReportDate: snapshots[options.lookback - 1]?.reportDate ?? null,
    lifecycleReportCount: snapshots.length >= options.lookback ? snapshots.length - options.lookback + 1 : 0,
    lifecycleCurrencyStateRows: stateByReportCurrency.size,
    missingMetricWindows,
  };
}

function buildInteractionRows(options: {
  decisions: PairDecisionRow[];
  weekResults: WeekResultRow[];
  variants: VariantRunRow[];
  rrpRows: RrpSnapshotRow[];
  lifecycle: ReturnType<typeof buildLifecycleMap>;
  cli: CliOptions;
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
  let missingRrpRows = 0;
  let missingLifecycleRows = 0;
  let zeroFilledMissingPairContributionRows = 0;
  const rows: InteractionRow[] = [];

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
    const reportDate = deriveCotReportDate(week);
    const baseLifecycle = options.lifecycle.stateByReportCurrency.get(`${reportDate}|${base}`);
    const quoteLifecycle = options.lifecycle.stateByReportCurrency.get(`${reportDate}|${quote}`);
    if (!baseLifecycle || !quoteLifecycle) {
      missingLifecycleRows += 1;
      continue;
    }
    const longCurrency = decision.selected_side === "LONG" ? base : quote;
    const shortCurrency = decision.selected_side === "LONG" ? quote : base;
    const longLifecycle = decision.selected_side === "LONG" ? baseLifecycle : quoteLifecycle;
    const shortLifecycle = decision.selected_side === "LONG" ? quoteLifecycle : baseLifecycle;
    const lifecycleSignedSpread = longLifecycle.tei - shortLifecycle.tei;
    const pairLifecycleScore = (longLifecycle.score + shortLifecycle.score) / 2;
    const differential = baseRrp! - quoteRrp!;
    const alignment = decision.selected_side === "LONG" ? differential : -differential;
    const variant = variantByRun.get(decision.variant_run_id);

    rows.push({
      variantRunId: decision.variant_run_id,
      variantId: decision.variant_id,
      variantLabel: variant?.variant_label ?? decision.variant_id,
      weekOpenUtc: week,
      reportDate,
      year: week.slice(0, 4),
      symbol: decision.symbol.toUpperCase(),
      base,
      quote,
      selectedSide: decision.selected_side,
      longCurrency,
      shortCurrency,
      pairContributionAdr: contribution,
      zeroFilledPairContribution,
      baseTei: baseLifecycle.tei,
      quoteTei: quoteLifecycle.tei,
      longCurrencyTei: longLifecycle.tei,
      shortCurrencyTei: shortLifecycle.tei,
      lifecycleSignedSpread,
      lifecyclePolarityBucket: lifecyclePolarityBucket(
        lifecycleSignedSpread,
        options.cli.polarityLeanThreshold,
        options.cli.polarityExtremeThreshold,
      ),
      longCurrencyScore: longLifecycle.score,
      shortCurrencyScore: shortLifecycle.score,
      pairLifecycleScore,
      lifecycleScoreBucket: lifecycleScoreBucket(
        pairLifecycleScore,
        options.cli.scoreLowThreshold,
        options.cli.scoreHighThreshold,
      ),
      baseRrpPercent: baseRrp!,
      quoteRrpPercent: quoteRrp!,
      pairRrpDifferentialPercent: differential,
      selectedSideRrpAlignmentPercent: alignment,
      rrpBucket: bucketForAlignment(alignment, options.cli.rrpThreshold),
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
      missingLifecycleRows,
      zeroFilledMissingPairContributionRows,
    },
  };
}

function metricsFor(options: {
  rows: InteractionRow[];
  variants: VariantRunRow[];
  allWeeks: string[];
}) {
  const rowsByVariant = new Map<string, InteractionRow[]>();
  for (const row of options.rows) {
    const current = rowsByVariant.get(row.variantId) ?? [];
    current.push(row);
    rowsByVariant.set(row.variantId, current);
  }

  const metrics: MetricRow[] = [];
  const polarityBuckets: LifecyclePolarityBucket[] = ["fade_extreme", "fade_lean", "neutral_mixed", "with_lean", "with_extreme"];
  const scoreBuckets: LifecycleScoreBucket[] = ["low_continuation", "neutral", "high_exhaustion"];
  const rrpBuckets: Array<RrpBucket | "all"> = ["all", "confirm", "fade", "weak"];

  for (const variant of options.variants) {
    const variantRows = rowsByVariant.get(variant.variant_id) ?? [];
    metrics.push(metricForGroup({
      variantId: variant.variant_id,
      variantLabel: variant.variant_label,
      groupType: "variant_total",
      lifecycleBucket: "all",
      rrpBucket: "all",
      rows: variantRows,
      allWeeks: options.allWeeks,
    }));

    for (const lifecycleBucket of polarityBuckets) {
      for (const rrpBucket of rrpBuckets) {
        const filteredRows = variantRows.filter((row) =>
          row.lifecyclePolarityBucket === lifecycleBucket &&
          (rrpBucket === "all" || row.rrpBucket === rrpBucket));
        metrics.push(metricForGroup({
          variantId: variant.variant_id,
          variantLabel: variant.variant_label,
          groupType: "lifecycle_polarity_x_rrp",
          lifecycleBucket,
          rrpBucket,
          rows: filteredRows,
          allWeeks: options.allWeeks,
        }));
      }
    }

    for (const lifecycleBucket of scoreBuckets) {
      for (const rrpBucket of rrpBuckets) {
        const filteredRows = variantRows.filter((row) =>
          row.lifecycleScoreBucket === lifecycleBucket &&
          (rrpBucket === "all" || row.rrpBucket === rrpBucket));
        metrics.push(metricForGroup({
          variantId: variant.variant_id,
          variantLabel: variant.variant_label,
          groupType: "lifecycle_score_x_rrp",
          lifecycleBucket,
          rrpBucket,
          rows: filteredRows,
          allWeeks: options.allWeeks,
        }));
      }
    }
  }

  return metrics;
}

function aggregateCounts(rows: InteractionRow[], field: "lifecyclePolarityBucket" | "lifecycleScoreBucket") {
  const counts = new Map<string, { rows: number; totalAdr: number }>();
  for (const row of rows) {
    const key = row[field];
    const current = counts.get(key) ?? { rows: 0, totalAdr: 0 };
    current.rows += 1;
    current.totalAdr += row.pairContributionAdr;
    counts.set(key, current);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [
    key,
    {
      rows: value.rows,
      totalAdr: round(value.totalAdr, 4) ?? 0,
      avgAdrPerPair: value.rows > 0 ? round(value.totalAdr / value.rows, 6) : null,
    },
  ]));
}

function gate46CountComparison<T extends string>(
  actual: Record<string, { rows: number }>,
  expected: Record<T, number>,
) {
  return Object.fromEntries(Object.entries(expected).map(([bucket, expectedRows]) => {
    const actualRows = actual[bucket]?.rows ?? 0;
    return [bucket, { expectedRows, actualRows, deltaRows: actualRows - expectedRows }];
  }));
}

function topRows(metrics: MetricRow[], options: { groupType: string; rrpBucket?: RrpBucket | "all"; minRows?: number; top: number }) {
  return metrics
    .filter((row) => row.groupType === options.groupType)
    .filter((row) => options.rrpBucket === undefined || row.rrpBucket === options.rrpBucket)
    .filter((row) => row.selectedRows >= (options.minRows ?? 1))
    .sort((left, right) => right.avgAdrPerPair! - left.avgAdrPerPair!)
    .slice(0, options.top);
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
  const topPolarity = receipt.topPolarityRrpByAvgAdr as MetricRow[];
  const topScore = receipt.topScoreRrpByAvgAdr as MetricRow[];
  const lines: string[] = [];
  lines.push("# Gate 51B COT Lifecycle x RRP Interaction Diagnostic");
  lines.push("");
  lines.push(`Generated: ${receipt.generatedAtUtc}`);
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push(`- Status: ${receipt.status}`);
  lines.push(`- Gate: ${GATE}`);
  lines.push(`- Variants tested: ${summary.variantCount}`);
  lines.push(`- Pair rows with lifecycle and RRP: ${summary.interactionRows}`);
  lines.push(`- Crowd leg: ${summary.crowdLeg}`);
  lines.push(`- Lifecycle lookback: ${summary.lifecycleLookback}`);
  lines.push(`- RRP threshold: ${summary.rrpThreshold}`);
  lines.push(`- ADR-normalized reporting: ${summary.adrNormalized}`);
  lines.push(`- Raw returns reported: ${summary.rawReturnsReported}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- This is a read-only diagnostic against the frozen Gate 44 matrix and promoted Gate 50 RRP dataset.");
  lines.push("- It does not rerun ADR Grid execution, refetch COT/RRP sources, change lifecycle controls, or make a live/production/promotion claim.");
  lines.push("- COT lifecycle is a research baseline candidate only unless later promotion gates audit and lock it.");
  lines.push("");
  lines.push("## Gate 46 Reproduction Check");
  lines.push("");
  const polarityComparison = receipt.gate46ReproductionCheck as JsonRecord;
  lines.push(`- Exact match to prior Gate 46 published counts: ${polarityComparison.exactCountMatch}`);
  lines.push("");
  lines.push("## Top Lifecycle Polarity x RRP Buckets");
  lines.push("");
  lines.push(tableRows([
    ["Variant", "Lifecycle", "RRP", "Rows", "Total ADR", "Avg ADR/Pair", "R/DD", "Sharpe", "PF"],
    ...topPolarity.map((row) => [
      row.variantId,
      row.lifecycleBucket,
      row.rrpBucket,
      fmt(row.selectedRows, 0),
      fmt(row.totalAdr),
      fmt(row.avgAdrPerPair, 4),
      fmt(row.returnToDrawdown),
      fmt(row.pathSharpeAdr),
      fmt(row.profitFactorAdr),
    ]),
  ]));
  lines.push("");
  lines.push("## Top Lifecycle Score x RRP Buckets");
  lines.push("");
  lines.push(tableRows([
    ["Variant", "Lifecycle", "RRP", "Rows", "Total ADR", "Avg ADR/Pair", "R/DD", "Sharpe", "PF"],
    ...topScore.map((row) => [
      row.variantId,
      row.lifecycleBucket,
      row.rrpBucket,
      fmt(row.selectedRows, 0),
      fmt(row.totalAdr),
      fmt(row.avgAdrPerPair, 4),
      fmt(row.returnToDrawdown),
      fmt(row.pathSharpeAdr),
      fmt(row.profitFactorAdr),
    ]),
  ]));
  lines.push("");
  lines.push("## Files");
  lines.push("");
  const files = receipt.files as JsonRecord;
  lines.push(`- JSON: ${files.jsonPath}`);
  lines.push(`- Markdown: ${files.mdPath}`);
  lines.push("");
  lines.push("No live, ACTIVE, production-ready, portfolio-ready, or full-stack source-promotion claim is made by this receipt.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const cli = parseCli();
  await mkdir(cli.outDir, { recursive: true });

  const [boundaryManifest, gate50JoinReceipt, matrixDataset, macroDataset] = await Promise.all([
    readBoundaryManifest(cli.boundaryManifestPath),
    readGate50JoinReceipt(),
    readMatrixDataset(),
    readMacroDataset(),
  ]);
  const variants = await readVariantRuns(cli.variantIds);
  const variantRunIds = variants.map((row) => row.variant_run_id);
  const [weekResults, pairDecisions, rrpRows, cotSnapshots] = await Promise.all([
    readWeekResults(variantRunIds),
    readPairDecisions(variantRunIds),
    readRrpSnapshots(),
    readCotSnapshots(),
  ]);
  const lifecycle = buildLifecycleMap({
    cotSnapshots,
    crowdLeg: cli.crowdLeg,
    lookback: cli.lifecycleLookback,
  });
  const interaction = buildInteractionRows({
    decisions: pairDecisions,
    weekResults,
    variants,
    rrpRows,
    lifecycle,
    cli,
  });
  const metrics = metricsFor({
    rows: interaction.rows,
    variants,
    allWeeks: interaction.allWeeks,
  });
  const aggregatePolarity = aggregateCounts(interaction.rows, "lifecyclePolarityBucket");
  const aggregateScore = aggregateCounts(interaction.rows, "lifecycleScoreBucket");
  const polarityCountComparison = gate46CountComparison(
    aggregatePolarity,
    GATE46_EXPECTED_NONCOMM_POLARITY_COUNTS,
  );
  const scoreCountComparison = gate46CountComparison(
    aggregateScore,
    GATE46_EXPECTED_NONCOMM_SCORE_COUNTS,
  );
  const exactCountMatch = [
    ...Object.values(polarityCountComparison),
    ...Object.values(scoreCountComparison),
  ].every((row) => row.deltaRows === 0);
  const top = cli.top;
  const topPolarityRrpByAvgAdr = topRows(metrics, {
    groupType: "lifecycle_polarity_x_rrp",
    rrpBucket: undefined,
    minRows: 50,
    top,
  });
  const topScoreRrpByAvgAdr = topRows(metrics, {
    groupType: "lifecycle_score_x_rrp",
    rrpBucket: undefined,
    minRows: 50,
    top,
  });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").slice(0, 15);
  const jsonPath = cli.jsonOut ?? path.join(cli.outDir, `gate51-cot-lifecycle-rrp-interaction-${cli.crowdLeg}-${stamp}.json`);
  const mdPath = cli.mdOut ?? path.join(cli.outDir, `gate51-cot-lifecycle-rrp-interaction-${cli.crowdLeg}-${stamp}.md`);

  const receiptWithoutHash = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    gate: GATE,
    status: "PASS_COT_LIFECYCLE_RRP_INTERACTION_DIAGNOSTIC",
    summary: {
      variantCount: variants.length,
      matrixWeekCount: interaction.allWeeks.length,
      pairDecisionRowsRead: pairDecisions.length,
      interactionRows: interaction.rows.length,
      rrpCurrencyRowsRead: rrpRows.length,
      cotSnapshotRowsRead: cotSnapshots.length,
      lifecycleFirstReportDate: lifecycle.lifecycleFirstReportDate,
      lifecycleReportCount: lifecycle.lifecycleReportCount,
      lifecycleCurrencyStateRows: lifecycle.lifecycleCurrencyStateRows,
      lifecycleLookback: cli.lifecycleLookback,
      crowdLeg: cli.crowdLeg,
      rrpThreshold: cli.rrpThreshold,
      polarityLeanThreshold: cli.polarityLeanThreshold,
      polarityExtremeThreshold: cli.polarityExtremeThreshold,
      scoreLowThreshold: cli.scoreLowThreshold,
      scoreHighThreshold: cli.scoreHighThreshold,
      adrNormalized: true,
      rawReturnsReported: false,
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
      gate46SourceAuditDoc: "docs/research/GATE46_COT_LIFECYCLE_SOURCE_SCORE_AUDIT_2026-06-19.md",
    },
    controls: {
      boundaryManifestStatus: boundaryManifest.status,
      contributionSource: "research_matrix_variant_week_results.pair_contributions",
      lifecycleFormula: "TEI = (crowd_percentile + (100 - commercial_percentile) + (100 - dealer_percentile)) / 3; score = abs(TEI - 50) * 2",
      selectedSidePolarity: "long_currency_TEI - short_currency_TEI; negative means selected side fades crowded/exhausted spread, positive means selected side goes with it",
      rrpAlignmentRule: "LONG confirms when base RRP minus quote RRP is greater than threshold; SHORT confirms when quote RRP minus base RRP is greater than threshold.",
      reportingUnit: "ADR-normalized outcomes only; raw currency returns are not reported",
      noExecutionRerun: true,
    },
    blockers: interaction.blockers,
    warnings: {
      ...interaction.warnings,
      missingMetricWindows: lifecycle.missingMetricWindows,
    },
    variants: variants.map((row) => ({
      variantRunId: row.variant_run_id,
      variantId: row.variant_id,
      variantLabel: row.variant_label,
    })),
    gate46ReproductionCheck: {
      exactCountMatch,
      note: exactCountMatch
        ? "Lifecycle bucket counts match the prior Gate 46 published noncomm exact-156 counts for the loaded selected decision rows."
        : "Lifecycle bucket counts differ from the prior Gate 46 published counts; inspect thresholds/score regime before treating this as a strict reproduction.",
      polarityCountComparison,
      scoreCountComparison,
      aggregatePolarity,
      aggregateScore,
    },
    metricResults: metrics,
    topPolarityRrpByAvgAdr,
    topScoreRrpByAvgAdr,
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
    variants: variants.length,
    interactionRows: interaction.rows.length,
    crowdLeg: cli.crowdLeg,
    rrpThreshold: cli.rrpThreshold,
    gate46ExactCountMatch: exactCountMatch,
    topPolarityRrpByAvgAdr: topPolarityRrpByAvgAdr.slice(0, 5).map((row) => ({
      variantId: row.variantId,
      lifecycleBucket: row.lifecycleBucket,
      rrpBucket: row.rrpBucket,
      selectedRows: row.selectedRows,
      totalAdr: row.totalAdr,
      avgAdrPerPair: row.avgAdrPerPair,
      returnToDrawdown: row.returnToDrawdown,
      pathSharpeAdr: row.pathSharpeAdr,
      profitFactorAdr: row.profitFactorAdr,
    })),
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
