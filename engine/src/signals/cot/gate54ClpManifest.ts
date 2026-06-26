import { DateTime } from "luxon";

import { query } from "@database/db/client";
import { PAIRS_BY_ASSET_CLASS } from "@engine/contracts/cotPairs";
import {
  attachResearchDecisionManifestHash,
  RESEARCH_DECISION_MANIFEST_VERSION,
  type ResearchDecisionManifest,
  type ResearchDecisionRow,
  type ResearchDecisionSide,
} from "@engine/research/decisionManifest";
import { sha256Stable } from "@engine/research/hash";

export const GATE56F_GATE_ID = "Gate 56F: gate54-cot-restatement-through-engine";
export const GATE56F_HYPOTHESIS_ID = "locked_gate54_clp_cot_restatement_gate55e_price_bundle";
export const GATE56F_SIGNAL_ID = "locked_gate54_clp_cot";
export const GATE56F_SIGNAL_VERSION = "CLP carry-forward + carry-previous tie fill";
export const GATE55E_PRICE_BUNDLE_ID = "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953";
export const GATE54_MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
export const GATE54_MATRIX_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
export const GATE54_COT_LAPSE_FROM = "2025-09-30";
export const GATE54_COT_LAPSE_TO = "2025-12-23";
export const GATE54_CLP_LOOKBACK_REPORTS = 156;

const FX_PAIRS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase());

type JsonRecord = Record<string, unknown>;

type DatasetRow = {
  dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  status: string;
  from_utc: Date | string;
  to_utc: Date | string;
};

type CotSnapshotRow = {
  report_date: Date | string;
  currencies: Record<string, JsonRecord>;
};

export type Gate54ClpLifecycleState = {
  reportDate: string;
  currency: string;
  tei: number;
  noncommNet: number;
  commercialNet: number;
  dealerNet: number;
  rawCompositeScore: number;
  rawNormalizedCompositeScore: number | null;
};

export type Gate54ClpDecision = {
  weekOpenUtc: string;
  symbol: string;
  selectedSide: ResearchDecisionSide;
  selectedReportDate: string;
  source: "clp" | "carry_previous_clp_side";
  baseCurrency: string;
  quoteCurrency: string;
  baseTei: number;
  quoteTei: number;
};

export type Gate54ClpPolicyRow = {
  weekOpenUtc: string;
  expectedReportDate: string;
  selectedReportDate: string | null;
  reportAgeDays: number | null;
  classification: string;
  decisions: number;
  carryPreviousDecisions: number;
  ties: number;
  missingLifecyclePairs: number;
};

export type Gate54ClpTieCase = {
  weekOpenUtc: string;
  symbol: string;
  selectedReportDate: string;
  carryPreviousSide: ResearchDecisionSide | null;
  baseTei: number;
  quoteTei: number;
};

export type Gate54ClpShapeValidation = {
  passed: boolean;
  rows: number;
  expectedRows: number;
  weeks: number;
  expectedWeeks: number;
  firstWeek: string | null;
  lastWeek: string | null;
  longRows: number;
  shortRows: number;
  duplicateRows: string[];
  missingSymbolsByWeek: Record<string, string[]>;
  extraSymbolsByWeek: Record<string, string[]>;
  nonFullWeeks: string[];
};

export type Gate54ClpManifestBuild = {
  manifest: ResearchDecisionManifest;
  shape: Gate54ClpShapeValidation;
  source: {
    dataset: DatasetRow;
    weeks: string[];
    decisions: Gate54ClpDecision[];
    policyRows: Gate54ClpPolicyRow[];
    tieCases: Gate54ClpTieCase[];
    lifecycle: {
      snapshotCount: number;
      firstStoredReportDate: string | null;
      lastStoredReportDate: string | null;
      lifecycleLookback: number;
      lifecycleFirstReportDate: string | null;
      lifecycleReportCount: number;
      lifecycleCurrencyStateRows: number;
      missingMetricWindows: number;
    };
  };
};

function isoUtc(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function dateKey(value: Date | string | null | undefined) {
  const iso = isoUtc(value);
  return iso ? iso.slice(0, 10) : null;
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLean(net: number | null, long: number | null, short: number | null) {
  if (net === null || long === null || short === null) return null;
  const total = long + short;
  return total > 0 ? net / total : null;
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

function round(value: number | null | undefined, decimals = 8) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parsePair(symbol: string) {
  const clean = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  return { base: clean.slice(0, 3), quote: clean.slice(3, 6) };
}

function deriveCotReportDate(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!weekOpen.isValid) {
    return weekOpenUtc.slice(0, 10);
  }
  return weekOpen.setZone("America/New_York").minus({ days: 5 }).toISODate() ?? weekOpenUtc.slice(0, 10);
}

function shiftedDateKey(value: string, days: number) {
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.plus({ days }).toISODate() : null;
}

function daysBetween(left: string, right: string) {
  const leftDate = DateTime.fromISO(left, { zone: "utc" });
  const rightDate = DateTime.fromISO(right, { zone: "utc" });
  if (!leftDate.isValid || !rightDate.isValid) return null;
  return Math.round(leftDate.diff(rightDate, "days").days);
}

function latestBeforeOrEqual(sortedDates: string[], maxDate: string) {
  let selected: string | null = null;
  for (const date of sortedDates) {
    if (date <= maxDate) selected = date;
    else break;
  }
  return selected;
}

function selectCotReportForWeek(weekOpenUtc: string, sortedReportDates: string[], reportDateSet: Set<string>) {
  const expectedReportDate = deriveCotReportDate(weekOpenUtc);
  if (expectedReportDate >= GATE54_COT_LAPSE_FROM && expectedReportDate <= GATE54_COT_LAPSE_TO) {
    const selected = latestBeforeOrEqual(
      sortedReportDates,
      shiftedDateKey(GATE54_COT_LAPSE_FROM, -1) ?? GATE54_COT_LAPSE_FROM,
    );
    return {
      expectedReportDate,
      selectedReportDate: selected,
      classification: selected
        ? "carry_forward_2025_lapse_source_ambiguous_no_lookahead"
        : "no_prior_cot_available",
    };
  }
  if (reportDateSet.has(expectedReportDate)) {
    return { expectedReportDate, selectedReportDate: expectedReportDate, classification: "exact_report_date_available" };
  }
  const holidayCandidates = [shiftedDateKey(expectedReportDate, -1), shiftedDateKey(expectedReportDate, 1)]
    .filter((date): date is string => Boolean(date))
    .filter((date) => reportDateSet.has(date));
  if (holidayCandidates.length > 0) {
    const selected = holidayCandidates.sort((left, right) =>
      Math.abs(daysBetween(expectedReportDate, left) ?? 99) -
      Math.abs(daysBetween(expectedReportDate, right) ?? 99))[0]!;
    return { expectedReportDate, selectedReportDate: selected, classification: "holiday_adjusted_report_date_available" };
  }
  const selected = latestBeforeOrEqual(sortedReportDates, expectedReportDate);
  return {
    expectedReportDate,
    selectedReportDate: selected,
    classification: selected ? "carry_forward_missing_report_no_lookahead" : "no_prior_cot_available",
  };
}

function buildLifecycleMap(cotSnapshots: CotSnapshotRow[]) {
  const snapshots = cotSnapshots
    .map((row) => ({ ...row, reportDate: dateKey(row.report_date) }))
    .filter((row): row is CotSnapshotRow & { reportDate: string } => Boolean(row.reportDate));
  const currencies = [...new Set(snapshots.flatMap((row) => Object.keys(row.currencies ?? {})))].sort();
  const stateByReportCurrency = new Map<string, Gate54ClpLifecycleState>();
  let missingMetricWindows = 0;

  for (let index = GATE54_CLP_LOOKBACK_REPORTS - 1; index < snapshots.length; index += 1) {
    const window = snapshots.slice(index + 1 - GATE54_CLP_LOOKBACK_REPORTS, index + 1);
    const current = snapshots[index]!;
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
      const currentCrowdLong = numeric(current.currencies?.[currency]?.noncomm_long);
      const currentCrowdShort = numeric(current.currencies?.[currency]?.noncomm_short);
      const currentCommercialLong = numeric(current.currencies?.[currency]?.commercial_long);
      const currentCommercialShort = numeric(current.currencies?.[currency]?.commercial_short);
      const currentDealerLong = numeric(current.currencies?.[currency]?.dealer_long);
      const currentDealerShort = numeric(current.currencies?.[currency]?.dealer_short);
      if (
        crowdWindow.length !== GATE54_CLP_LOOKBACK_REPORTS ||
        commercialWindow.length !== GATE54_CLP_LOOKBACK_REPORTS ||
        dealerWindow.length !== GATE54_CLP_LOOKBACK_REPORTS ||
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
      const crowdLean = normalizeLean(currentCrowd, currentCrowdLong, currentCrowdShort);
      const commercialLean = normalizeLean(currentCommercial, currentCommercialLong, currentCommercialShort);
      const dealerLean = normalizeLean(currentDealer, currentDealerLong, currentDealerShort);
      stateByReportCurrency.set(`${current.reportDate}|${currency}`, {
        reportDate: current.reportDate,
        currency,
        tei: (crowdPercentile + (100 - commercialPercentile) + (100 - dealerPercentile)) / 3,
        noncommNet: currentCrowd,
        commercialNet: currentCommercial,
        dealerNet: currentDealer,
        rawCompositeScore: currentCrowd - currentCommercial - currentDealer,
        rawNormalizedCompositeScore: crowdLean === null || commercialLean === null || dealerLean === null
          ? null
          : crowdLean - commercialLean - dealerLean,
      });
    }
  }

  return {
    stateByReportCurrency,
    lifecycleLookback: GATE54_CLP_LOOKBACK_REPORTS,
    lifecycleFirstReportDate: snapshots[GATE54_CLP_LOOKBACK_REPORTS - 1]?.reportDate ?? null,
    lifecycleReportCount: snapshots.length >= GATE54_CLP_LOOKBACK_REPORTS
      ? snapshots.length - GATE54_CLP_LOOKBACK_REPORTS + 1
      : 0,
    lifecycleCurrencyStateRows: stateByReportCurrency.size,
    missingMetricWindows,
  };
}

function generateExpectedWeeks(matrixWeeks: string[]) {
  if (matrixWeeks.length === 0) return [];
  const first = DateTime.fromISO(matrixWeeks[0]!, { zone: "utc" }).setZone("America/New_York");
  const last = DateTime.fromISO(matrixWeeks[matrixWeeks.length - 1]!, { zone: "utc" });
  if (!first.isValid || !last.isValid) return [];

  const weeks: string[] = [];
  for (let cursor = first; cursor.toUTC().toMillis() <= last.toMillis(); cursor = cursor.plus({ weeks: 1 })) {
    weeks.push(cursor.toUTC().toISO() ?? cursor.toJSDate().toISOString());
  }
  return weeks;
}

function buildCarryPreviousDecisions(options: {
  expectedWeeks: string[];
  sortedReportDates: string[];
  lifecycle: ReturnType<typeof buildLifecycleMap>;
}) {
  const reportDateSet = new Set(options.sortedReportDates);
  const decisions: Gate54ClpDecision[] = [];
  const policyRows: Gate54ClpPolicyRow[] = [];
  const tieCases: Gate54ClpTieCase[] = [];
  const previousClpSideBySymbol = new Map<string, ResearchDecisionSide>();

  for (const week of options.expectedWeeks) {
    const selection = selectCotReportForWeek(week, options.sortedReportDates, reportDateSet);
    let weekDecisions = 0;
    let carryPreviousDecisions = 0;
    let ties = 0;
    let missingLifecyclePairs = 0;

    if (selection.selectedReportDate) {
      for (const symbol of FX_PAIRS) {
        const { base, quote } = parsePair(symbol);
        const baseLifecycle = options.lifecycle.stateByReportCurrency.get(`${selection.selectedReportDate}|${base}`);
        const quoteLifecycle = options.lifecycle.stateByReportCurrency.get(`${selection.selectedReportDate}|${quote}`);
        if (!baseLifecycle || !quoteLifecycle) {
          missingLifecyclePairs += 1;
          continue;
        }

        if (Math.abs(baseLifecycle.tei - quoteLifecycle.tei) < 1e-9) {
          ties += 1;
          const carryPreviousSide = previousClpSideBySymbol.get(symbol) ?? null;
          tieCases.push({
            weekOpenUtc: week,
            symbol,
            selectedReportDate: selection.selectedReportDate,
            carryPreviousSide,
            baseTei: round(baseLifecycle.tei) ?? baseLifecycle.tei,
            quoteTei: round(quoteLifecycle.tei) ?? quoteLifecycle.tei,
          });
          if (carryPreviousSide) {
            decisions.push({
              weekOpenUtc: week,
              symbol,
              selectedSide: carryPreviousSide,
              selectedReportDate: selection.selectedReportDate,
              source: "carry_previous_clp_side",
              baseCurrency: base,
              quoteCurrency: quote,
              baseTei: baseLifecycle.tei,
              quoteTei: quoteLifecycle.tei,
            });
            carryPreviousDecisions += 1;
          }
          continue;
        }

        const selectedSide = baseLifecycle.tei < quoteLifecycle.tei ? "LONG" : "SHORT";
        decisions.push({
          weekOpenUtc: week,
          symbol,
          selectedSide,
          selectedReportDate: selection.selectedReportDate,
          source: "clp",
          baseCurrency: base,
          quoteCurrency: quote,
          baseTei: baseLifecycle.tei,
          quoteTei: quoteLifecycle.tei,
        });
        previousClpSideBySymbol.set(symbol, selectedSide);
        weekDecisions += 1;
        carryPreviousDecisions += 1;
      }
    }

    policyRows.push({
      weekOpenUtc: week,
      expectedReportDate: selection.expectedReportDate,
      selectedReportDate: selection.selectedReportDate,
      reportAgeDays: selection.selectedReportDate
        ? daysBetween(selection.expectedReportDate, selection.selectedReportDate)
        : null,
      classification: selection.classification,
      decisions: weekDecisions,
      carryPreviousDecisions,
      ties,
      missingLifecyclePairs,
    });
  }

  return { decisions, policyRows, tieCases };
}

async function readDataset() {
  const rows = await query<DatasetRow>(
    `SELECT dataset_id, dataset_hash, dataset_version, status, from_utc, to_utc
       FROM research_matrix_datasets
      WHERE dataset_id = $1::uuid`,
    [GATE54_MATRIX_DATASET_ID],
  );
  const dataset = rows[0];
  if (!dataset) throw new Error(`Missing matrix dataset ${GATE54_MATRIX_DATASET_ID}`);
  if (dataset.dataset_hash !== GATE54_MATRIX_DATASET_HASH) {
    throw new Error(`Matrix dataset hash mismatch: ${dataset.dataset_hash}`);
  }
  return dataset;
}

async function readMatrixWeeks() {
  const rows = await query<{ week_open_utc: Date | string }>(
    `SELECT DISTINCT week_open_utc
       FROM research_matrix_source_contexts
      WHERE dataset_id = $1::uuid
      ORDER BY week_open_utc ASC`,
    [GATE54_MATRIX_DATASET_ID],
  );
  return rows.map((row) => isoUtc(row.week_open_utc)).filter((value): value is string => Boolean(value));
}

async function readCotSnapshots() {
  return query<CotSnapshotRow>(
    `SELECT report_date, currencies
       FROM cot_snapshots
      WHERE asset_class = 'fx'
      ORDER BY report_date ASC`,
    [],
  );
}

function buildConfigHash() {
  return sha256Stable({
    signal_id: GATE56F_SIGNAL_ID,
    signal_version: GATE56F_SIGNAL_VERSION,
    matrix_dataset_id: GATE54_MATRIX_DATASET_ID,
    matrix_dataset_hash: GATE54_MATRIX_DATASET_HASH,
    lookback_reports: GATE54_CLP_LOOKBACK_REPORTS,
    cot_lapse_from: GATE54_COT_LAPSE_FROM,
    cot_lapse_to: GATE54_COT_LAPSE_TO,
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    policy: "lower_clp_tei_currency_with_carry_previous_clp_side_for_ties",
  });
}

function buildRows(decisions: Gate54ClpDecision[]): ResearchDecisionRow[] {
  return decisions.map((decision) => ({
    row_id: `${decision.weekOpenUtc.slice(0, 10)}:${decision.symbol}`,
    week_open_utc: decision.weekOpenUtc,
    symbol: decision.symbol,
    side: decision.selectedSide,
    decision_timestamp_utc: `${decision.selectedReportDate}T00:00:00.000Z`,
    source_metadata: {
      selected_report_date: decision.selectedReportDate,
      source: decision.source,
      base_currency: decision.baseCurrency,
      quote_currency: decision.quoteCurrency,
    },
    signal_scores: {
      base_tei: round(decision.baseTei),
      quote_tei: round(decision.quoteTei),
      tei_spread_base_minus_quote: round(decision.baseTei - decision.quoteTei),
    },
    bucket_id: null,
    regime_id: null,
  }));
}

export function validateGate54ClpManifestShape(
  manifest: ResearchDecisionManifest,
  expectedWeeks = 388,
  expectedRows = 10864,
): Gate54ClpShapeValidation {
  const weeks = [...new Set(manifest.decisions.map((row) => row.week_open_utc))].sort();
  const symbols = [...FX_PAIRS].sort();
  const duplicateRows: string[] = [];
  const seen = new Set<string>();
  const rowsByWeek = new Map<string, Set<string>>();

  for (const row of manifest.decisions) {
    const key = `${row.week_open_utc}|${row.symbol}`;
    if (seen.has(key)) duplicateRows.push(key);
    seen.add(key);
    const rowSymbols = rowsByWeek.get(row.week_open_utc) ?? new Set<string>();
    rowSymbols.add(row.symbol);
    rowsByWeek.set(row.week_open_utc, rowSymbols);
  }

  const missingSymbolsByWeek: Record<string, string[]> = {};
  const extraSymbolsByWeek: Record<string, string[]> = {};
  const nonFullWeeks: string[] = [];

  for (const week of weeks) {
    const rowSymbols = rowsByWeek.get(week) ?? new Set<string>();
    const missing = symbols.filter((symbol) => !rowSymbols.has(symbol));
    const extra = [...rowSymbols].filter((symbol) => !symbols.includes(symbol)).sort();
    if (missing.length > 0) missingSymbolsByWeek[week] = missing;
    if (extra.length > 0) extraSymbolsByWeek[week] = extra;
    if (missing.length > 0 || extra.length > 0 || rowSymbols.size !== symbols.length) {
      nonFullWeeks.push(week);
    }
  }

  const shape = {
    rows: manifest.decisions.length,
    expectedRows,
    weeks: weeks.length,
    expectedWeeks,
    firstWeek: weeks[0] ?? null,
    lastWeek: weeks.at(-1) ?? null,
    longRows: manifest.decisions.filter((row) => row.side === "LONG").length,
    shortRows: manifest.decisions.filter((row) => row.side === "SHORT").length,
    duplicateRows,
    missingSymbolsByWeek,
    extraSymbolsByWeek,
    nonFullWeeks,
  };

  return {
    passed:
      shape.rows === expectedRows &&
      shape.weeks === expectedWeeks &&
      shape.longRows + shape.shortRows === shape.rows &&
      shape.duplicateRows.length === 0 &&
      shape.nonFullWeeks.length === 0,
    ...shape,
  };
}

function buildManifest(options: {
  dataset: DatasetRow;
  weeks: string[];
  decisions: Gate54ClpDecision[];
  policyRows: Gate54ClpPolicyRow[];
  tieCases: Gate54ClpTieCase[];
  lifecycle: ReturnType<typeof buildLifecycleMap>;
  sortedReportDates: string[];
}) {
  const manifest: ResearchDecisionManifest = {
    manifest_id: "gate56f_locked_gate54_clp_cot_restatement_manifest_v1",
    manifest_version: RESEARCH_DECISION_MANIFEST_VERSION,
    gate_id: GATE56F_GATE_ID,
    hypothesis_id: GATE56F_HYPOTHESIS_ID,
    signal_id: GATE56F_SIGNAL_ID,
    signal_version: GATE56F_SIGNAL_VERSION,
    decision_scope: "fx_28pair_weekly_locked_gate54_clp_cot",
    price_bundle_id: GATE55E_PRICE_BUNDLE_ID,
    feature_bundle_id: "gate54_clp_cot_lifecycle_carry_forward_tie_fill_v1",
    source_context_ids: [
      "docs/research/GATE54G_COT_WARMUP_CARRY_FORWARD_PROOF_2026-06-23.md",
      "docs/research/GATE54H_CLP_TIE_BREAK_COMPARISON_2026-06-23.md",
      "docs/research/GATE54I_RAW_SIGNAL_REVIEW_PACKET_2026-06-23.md",
      "docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md",
    ],
    universe: {
      asset_class: "fx",
      symbols: FX_PAIRS,
    },
    week_range: {
      from_week_open_utc: options.weeks[0] ?? "",
      to_week_open_utc: options.weeks.at(-1) ?? "",
    },
    source_metadata: {
      source_gate: "Gate 54G/H/I",
      source_script: "archive/app/scripts/verification/audit-gate54h-clp-tie-break-comparison.ts",
      matrix_dataset_id: options.dataset.dataset_id,
      matrix_dataset_hash: options.dataset.dataset_hash,
      matrix_dataset_version: options.dataset.dataset_version,
      matrix_dataset_status: options.dataset.status,
      matrix_from_utc: isoUtc(options.dataset.from_utc),
      matrix_to_utc: isoUtc(options.dataset.to_utc),
      cot_report_dates: options.sortedReportDates.length,
      first_cot_report_date: options.sortedReportDates[0] ?? null,
      last_cot_report_date: options.sortedReportDates.at(-1) ?? null,
      lifecycle_lookback_reports: options.lifecycle.lifecycleLookback,
      lifecycle_first_report_date: options.lifecycle.lifecycleFirstReportDate,
      missing_metric_windows: options.lifecycle.missingMetricWindows,
      tie_rows: options.tieCases.length,
      carry_previous_tie_rows: options.tieCases.filter((row) => row.carryPreviousSide).length,
      policy: "lower CLP TEI currency wins; equal-TEI ties carry previous non-tied CLP side for that pair",
      old_gate54_metrics: {
        rows: 10864,
        full_weeks: "388/388",
        adr_grid_total_adr: 1176.4520,
        adr_grid_max_drawdown_adr: -358.9404,
        adr_grid_return_to_drawdown: 3.2776,
        adr_grid_profit_factor: 1.2604,
        weekly_hold_total_adr: 339.4126,
        weekly_hold_max_drawdown_adr: -151.9313,
        weekly_hold_return_to_drawdown: 2.2340,
        weekly_hold_profit_factor: 1.1844,
      },
    },
    config_hash: buildConfigHash(),
    decisions: buildRows(options.decisions),
  };
  return attachResearchDecisionManifestHash(manifest);
}

export async function buildGate54ClpCotRestatementManifest(): Promise<Gate54ClpManifestBuild> {
  const [dataset, matrixWeeks, cotSnapshots] = await Promise.all([
    readDataset(),
    readMatrixWeeks(),
    readCotSnapshots(),
  ]);
  const weeks = generateExpectedWeeks(matrixWeeks);
  const sortedReportDates = cotSnapshots.map((row) => dateKey(row.report_date)).filter((value): value is string => Boolean(value));
  const lifecycle = buildLifecycleMap(cotSnapshots);
  const { decisions, policyRows, tieCases } = buildCarryPreviousDecisions({
    expectedWeeks: weeks,
    sortedReportDates,
    lifecycle,
  });
  const manifest = buildManifest({
    dataset,
    weeks,
    decisions,
    policyRows,
    tieCases,
    lifecycle,
    sortedReportDates,
  });
  const shape = validateGate54ClpManifestShape(manifest);

  return {
    manifest,
    shape,
    source: {
      dataset,
      weeks,
      decisions,
      policyRows,
      tieCases,
      lifecycle: {
        snapshotCount: sortedReportDates.length,
        firstStoredReportDate: sortedReportDates[0] ?? null,
        lastStoredReportDate: sortedReportDates.at(-1) ?? null,
        lifecycleLookback: lifecycle.lifecycleLookback,
        lifecycleFirstReportDate: lifecycle.lifecycleFirstReportDate,
        lifecycleReportCount: lifecycle.lifecycleReportCount,
        lifecycleCurrencyStateRows: lifecycle.lifecycleCurrencyStateRows,
        missingMetricWindows: lifecycle.missingMetricWindows,
      },
    },
  };
}
