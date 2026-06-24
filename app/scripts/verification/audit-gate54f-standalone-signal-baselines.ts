import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { getPool, query } from "@/lib/db";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { getAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import { loadPathBars } from "@/lib/performance/pathBarLoader";

loadEnvConfig(process.cwd());

const GATE = "Gate 54F: standalone-signal-baselines";
const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const DOC_OUT = "docs/research/GATE54F_STANDALONE_SIGNAL_BASELINES_AND_SOURCE_AVAILABILITY_2026-06-23.md";

const MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const MATRIX_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
const FSA_VARIANT_ID = "strength_friday_snapshot_selected";
const CLP_SELECTOR_ID = "cot_lifecycle_polarity_v0_noncomm_primary";
const FX_PAIRS = [
  "EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDJPY", "USDCHF", "USDCAD",
  "EURGBP", "EURJPY", "EURCHF", "EURCAD", "EURAUD", "EURNZD",
  "GBPJPY", "GBPCHF", "GBPCAD", "GBPAUD", "GBPNZD",
  "AUDJPY", "AUDCHF", "AUDCAD", "AUDNZD",
  "NZDJPY", "NZDCHF", "NZDCAD",
  "CADJPY", "CADCHF", "CHFJPY",
];
const DIRECTIONAL = new Set(["LONG", "SHORT"]);
const COT_2025_SHUTDOWN_FROM = "2025-09-30";
const COT_2025_SHUTDOWN_TO = "2025-12-23";

type Direction = "LONG" | "SHORT";
type JsonRecord = Record<string, unknown>;

type DatasetRow = {
  dataset_id: string;
  dataset_hash: string;
  dataset_version: string;
  status: string;
  from_utc: Date | string;
  to_utc: Date | string;
};

type SourceContextRow = {
  week_open_utc: Date | string;
  symbol: string;
  dealer_direction: string;
  commercial_direction: string;
  cot_faces_direction: string;
  commercial_delta_cot_direction: string;
  friday_strength_direction: string;
  market_open_strength_direction: string;
};

type VariantRunRow = {
  variant_run_id: string;
  variant_id: string;
  variant_label: string;
};

type PairDecisionRow = {
  week_open_utc: Date | string;
  symbol: string;
  selected_side: Direction;
};

type GridOpportunityRow = {
  week_open_utc: Date | string;
  symbol: string;
  direction: Direction;
  fills: string | number;
  adr_return: string | number | null;
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

type SignalDecision = {
  weekOpenUtc: string;
  symbol: string;
  selectedSide: Direction;
};

type AvailabilityRow = {
  weekOpenUtc: string;
  cotReportDate: string;
  storedCotReportDate: string | null;
  cotSourceTimingBasis: string;
  inMatrix: boolean;
  cotDirectionalRows: number;
  fridayStrengthDirectionalRows: number;
  clpDirectionalRows: number;
  fridayStrengthSelectedRows: number;
  cotAvailabilityClass: string;
  clpAvailabilityClass: string;
  fridayStrengthAvailabilityClass: string;
  futureNoCotFallbackCandidate: boolean;
};

type MetricSummary = {
  selectedRows: number;
  activeWeeks: number;
  fullSignalWeeks: number;
  partialSignalWeeks: number;
  unavailableWeeks: number;
  totalAdr: number;
  maxDrawdownAdr: number;
  returnToDrawdown: number | null;
  profitFactorAdr: number | null;
  weeklyWinRateActive: number | null;
  worstYear: string | null;
  worstYearAdr: number | null;
};

type SignalSummary = {
  signalId: string;
  label: string;
  directionRule: string;
  sourceRows: number;
  adrGrid: MetricSummary & { gridFills: number; missingGridRows: number };
  simpleWeeklyHold: MetricSummary & { missingPriceRows: number };
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function isoUtc(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function dateKey(value: Date | string | null | undefined) {
  const iso = isoUtc(value);
  return iso ? iso.slice(0, 10) : null;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number | null | undefined, decimals = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function directionSign(direction: Direction) {
  return direction === "LONG" ? 1 : -1;
}

function parsePair(symbol: string) {
  const clean = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  return { base: clean.slice(0, 3), quote: clean.slice(3, 6) };
}

function isDirectional(value: string | null | undefined): value is Direction {
  return value === "LONG" || value === "SHORT";
}

function yearOf(weekOpenUtc: string) {
  return weekOpenUtc.slice(0, 4);
}

function maxDrawdown(values: number[]) {
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;
  for (const value of values) {
    cumulative += value;
    peak = Math.max(peak, cumulative);
    drawdown = Math.min(drawdown, cumulative - peak);
  }
  return drawdown;
}

function pathStats(weeklyValues: number[]) {
  const totalAdr = weeklyValues.reduce((sum, value) => sum + value, 0);
  const positiveAdr = weeklyValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeAdr = weeklyValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const drawdown = maxDrawdown(weeklyValues);
  const activeValues = weeklyValues.filter((value) => value !== 0);
  return {
    totalAdr: round(totalAdr) ?? 0,
    maxDrawdownAdr: round(drawdown) ?? 0,
    returnToDrawdown: drawdown < 0 ? round(totalAdr / Math.abs(drawdown)) : null,
    profitFactorAdr: negativeAdr < 0 ? round(positiveAdr / Math.abs(negativeAdr)) : null,
    weeklyWinRateActive: activeValues.length > 0
      ? round(activeValues.filter((value) => value > 0).length / activeValues.length)
      : null,
  };
}

function summarizeWeeklyValues(options: {
  decisions: SignalDecision[];
  weekValues: Map<string, number>;
  matrixWeeks: string[];
  missingRows: number;
  extra?: Record<string, number>;
}): MetricSummary & Record<string, number | string | null> {
  const decisionWeeks = new Map<string, number>();
  for (const decision of options.decisions) {
    decisionWeeks.set(decision.weekOpenUtc, (decisionWeeks.get(decision.weekOpenUtc) ?? 0) + 1);
  }
  const weeklyValues = options.matrixWeeks.map((week) => round(options.weekValues.get(week) ?? 0) ?? 0);
  const fullSignalWeeks = [...decisionWeeks.values()].filter((count) => count === FX_PAIRS.length).length;
  const partialSignalWeeks = [...decisionWeeks.values()].filter((count) => count > 0 && count < FX_PAIRS.length).length;
  const unavailableWeeks = options.matrixWeeks.length - fullSignalWeeks - partialSignalWeeks;
  const yearAdr = new Map<string, number>();
  for (let index = 0; index < options.matrixWeeks.length; index += 1) {
    const week = options.matrixWeeks[index]!;
    yearAdr.set(yearOf(week), (yearAdr.get(yearOf(week)) ?? 0) + (weeklyValues[index] ?? 0));
  }
  const worstYear = [...yearAdr.entries()].sort((left, right) => left[1] - right[1])[0] ?? null;
  return {
    selectedRows: options.decisions.length,
    activeWeeks: weeklyValues.filter((value) => value !== 0).length,
    fullSignalWeeks,
    partialSignalWeeks,
    unavailableWeeks,
    ...pathStats(weeklyValues),
    worstYear: worstYear?.[0] ?? null,
    worstYearAdr: worstYear ? round(worstYear[1]) : null,
    ...options.extra,
  };
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

async function readDataset() {
  const rows = await query<DatasetRow>(
    `SELECT dataset_id, dataset_hash, dataset_version, status, from_utc, to_utc
       FROM research_matrix_datasets
      WHERE dataset_id = $1::uuid`,
    [MATRIX_DATASET_ID],
  );
  const dataset = rows[0];
  if (!dataset) throw new Error(`Missing matrix dataset ${MATRIX_DATASET_ID}`);
  if (dataset.dataset_hash !== MATRIX_DATASET_HASH) {
    throw new Error(`Matrix dataset hash mismatch: ${dataset.dataset_hash}`);
  }
  if (dataset.status !== "complete") {
    throw new Error(`Matrix dataset not complete: ${dataset.status}`);
  }
  return dataset;
}

async function readSourceContexts() {
  return query<SourceContextRow>(
    `SELECT week_open_utc, symbol, dealer_direction, commercial_direction,
            cot_faces_direction, commercial_delta_cot_direction,
            friday_strength_direction, market_open_strength_direction
       FROM research_matrix_source_contexts
      WHERE dataset_id = $1::uuid
      ORDER BY week_open_utc, symbol`,
    [MATRIX_DATASET_ID],
  );
}

async function readFsaDecisions() {
  const runs = await query<VariantRunRow>(
    `SELECT variant_run_id, variant_id, variant_label
       FROM research_matrix_variant_runs
      WHERE dataset_id = $1::uuid
        AND variant_id = $2`,
    [MATRIX_DATASET_ID, FSA_VARIANT_ID],
  );
  const run = runs[0];
  if (!run) throw new Error(`Missing variant run ${FSA_VARIANT_ID}`);
  return query<PairDecisionRow>(
    `SELECT week_open_utc, symbol, selected_side
       FROM research_matrix_pair_decisions
      WHERE variant_run_id = $1::uuid
        AND selected_side IN ('LONG', 'SHORT')
      ORDER BY week_open_utc, symbol`,
    [run.variant_run_id],
  );
}

async function readGridOpportunityAgg() {
  return query<GridOpportunityRow>(
    `SELECT week_open_utc, symbol, direction,
            COUNT(*) AS fills,
            SUM(COALESCE(adr_return, 0)) AS adr_return
       FROM research_matrix_trade_opportunities
      WHERE dataset_id = $1::uuid
      GROUP BY week_open_utc, symbol, direction
      ORDER BY week_open_utc, symbol, direction`,
    [MATRIX_DATASET_ID],
  );
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

function generateExpectedWeeks(matrixWeeks: string[]) {
  if (matrixWeeks.length === 0) return [];
  const first = DateTime.fromISO(matrixWeeks[0]!, { zone: "utc" }).setZone("America/New_York");
  const last = DateTime.fromISO(matrixWeeks[matrixWeeks.length - 1]!, { zone: "utc" });
  if (!first.isValid || !last.isValid) return [];

  const weeks: string[] = [];
  for (
    let cursor = first;
    cursor.toUTC().toMillis() <= last.toMillis();
    cursor = cursor.plus({ weeks: 1 })
  ) {
    weeks.push(cursor.toUTC().toISO() ?? cursor.toJSDate().toISOString());
  }
  return weeks;
}

function shiftedDateKey(value: string, days: number) {
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) return null;
  return parsed.plus({ days }).toISODate();
}

function resolveStoredCotReportDate(reportDate: string, cotReportDates: Set<string>) {
  if (cotReportDates.has(reportDate)) {
    return {
      storedCotReportDate: reportDate,
      cotSourceTimingBasis: "stored_exact_report_date",
    };
  }
  for (const days of [-1, 1]) {
    const candidate = shiftedDateKey(reportDate, days);
    if (candidate && cotReportDates.has(candidate)) {
      return {
        storedCotReportDate: candidate,
        cotSourceTimingBasis: "stored_holiday_adjusted_report_date",
      };
    }
  }
  return {
    storedCotReportDate: null,
    cotSourceTimingBasis: "not_proven_available",
  };
}

function cotRowsDirectional(rows: SourceContextRow[]) {
  return rows.filter((row) =>
    isDirectional(row.cot_faces_direction) &&
    isDirectional(row.commercial_delta_cot_direction) &&
    isDirectional(row.dealer_direction) &&
    isDirectional(row.commercial_direction)).length;
}

function fridayRowsDirectional(rows: SourceContextRow[]) {
  return rows.filter((row) => isDirectional(row.friday_strength_direction)).length;
}

function buildClpDecisions(options: {
  sourceContexts: SourceContextRow[];
  lifecycle: ReturnType<typeof buildLifecycleMap>;
}) {
  const decisions: SignalDecision[] = [];
  let warmupRows = 0;
  let trueMissingRows = 0;
  let cotUnavailableRows = 0;
  let tieRows = 0;

  for (const context of options.sourceContexts) {
    const week = isoUtc(context.week_open_utc);
    if (!week) continue;
    const reportDate = deriveCotReportDate(week);
    if (!isDirectional(context.cot_faces_direction) || !isDirectional(context.commercial_delta_cot_direction)) {
      cotUnavailableRows += 1;
      continue;
    }
    if (options.lifecycle.lifecycleFirstReportDate && reportDate < options.lifecycle.lifecycleFirstReportDate) {
      warmupRows += 1;
      continue;
    }
    const { base, quote } = parsePair(context.symbol);
    const baseLifecycle = options.lifecycle.stateByReportCurrency.get(`${reportDate}|${base}`);
    const quoteLifecycle = options.lifecycle.stateByReportCurrency.get(`${reportDate}|${quote}`);
    if (!baseLifecycle || !quoteLifecycle) {
      trueMissingRows += 1;
      continue;
    }
    if (Math.abs(baseLifecycle.tei - quoteLifecycle.tei) < 1e-9) {
      tieRows += 1;
      continue;
    }
    decisions.push({
      weekOpenUtc: week,
      symbol: context.symbol.toUpperCase(),
      selectedSide: baseLifecycle.tei < quoteLifecycle.tei ? "LONG" : "SHORT",
    });
  }

  return {
    decisions,
    warmupRows,
    trueMissingRows,
    cotUnavailableRows,
    tieRows,
  };
}

function normalizeDecisionRows(rows: PairDecisionRow[]): SignalDecision[] {
  return rows.map((row) => ({
    weekOpenUtc: isoUtc(row.week_open_utc)!,
    symbol: row.symbol.toUpperCase(),
    selectedSide: row.selected_side,
  }));
}

function summarizeAdrGrid(options: {
  decisions: SignalDecision[];
  matrixWeeks: string[];
  gridByKey: Map<string, { adrReturn: number; fills: number }>;
}) {
  const weekly = new Map<string, number>();
  let missingGridRows = 0;
  let gridFills = 0;
  for (const decision of options.decisions) {
    const key = `${decision.weekOpenUtc}|${decision.symbol}|${decision.selectedSide}`;
    const grid = options.gridByKey.get(key);
    if (!grid) {
      missingGridRows += 1;
      continue;
    }
    weekly.set(decision.weekOpenUtc, (weekly.get(decision.weekOpenUtc) ?? 0) + grid.adrReturn);
    gridFills += grid.fills;
  }
  return summarizeWeeklyValues({
    decisions: options.decisions,
    weekValues: weekly,
    matrixWeeks: options.matrixWeeks,
    missingRows: missingGridRows,
    extra: { gridFills, missingGridRows },
  }) as MetricSummary & { gridFills: number; missingGridRows: number };
}

async function summarizeSimpleWeeklyHold(options: {
  decisions: SignalDecision[];
  matrixWeeks: string[];
}) {
  const decisionsByWeek = new Map<string, SignalDecision[]>();
  for (const decision of options.decisions) {
    const rows = decisionsByWeek.get(decision.weekOpenUtc) ?? [];
    rows.push(decision);
    decisionsByWeek.set(decision.weekOpenUtc, rows);
  }

  const weekly = new Map<string, number>();
  let missingPriceRows = 0;

  for (const [week, decisions] of decisionsByWeek) {
    const executionWindow = getExecutionWeekWindow(week, "fx");
    const fromUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? week;
    const toUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? week;
    const [barsBySymbol, adrMap] = await Promise.all([
      loadPathBars([...new Set(decisions.map((decision) => decision.symbol))], fromUtc, toUtc, "1h"),
      loadWeeklyAdrMap(week),
    ]);
    for (const decision of decisions) {
      const bars = barsBySymbol.get(decision.symbol) ?? [];
      const first = bars[0];
      const last = bars[bars.length - 1];
      const pairAdrPct = getAdrPct(adrMap, decision.symbol, "fx");
      if (!first || !last || !Number.isFinite(pairAdrPct) || pairAdrPct <= 0) {
        missingPriceRows += 1;
        continue;
      }
      const raw = ((last.closePrice - first.openPrice) / first.openPrice) * 100 * directionSign(decision.selectedSide);
      const adr = raw / pairAdrPct;
      weekly.set(week, (weekly.get(week) ?? 0) + adr);
    }
  }

  return summarizeWeeklyValues({
    decisions: options.decisions,
    weekValues: weekly,
    matrixWeeks: options.matrixWeeks,
    missingRows: missingPriceRows,
    extra: { missingPriceRows },
  }) as MetricSummary & { missingPriceRows: number };
}

function buildAvailabilityLedger(options: {
  expectedWeeks: string[];
  sourceByWeek: Map<string, SourceContextRow[]>;
  clpDecisions: SignalDecision[];
  fsaDecisions: SignalDecision[];
  cotReportDates: Set<string>;
}) {
  const clpByWeek = new Map<string, number>();
  for (const decision of options.clpDecisions) {
    clpByWeek.set(decision.weekOpenUtc, (clpByWeek.get(decision.weekOpenUtc) ?? 0) + 1);
  }
  const fsaByWeek = new Map<string, number>();
  for (const decision of options.fsaDecisions) {
    fsaByWeek.set(decision.weekOpenUtc, (fsaByWeek.get(decision.weekOpenUtc) ?? 0) + 1);
  }

  return options.expectedWeeks.map((week): AvailabilityRow => {
    const rows = options.sourceByWeek.get(week) ?? [];
    const cotReportDate = deriveCotReportDate(week);
    const storedCot = resolveStoredCotReportDate(cotReportDate, options.cotReportDates);
    const inMatrix = rows.length > 0;
    const cotDirectional = cotRowsDirectional(rows);
    const fridayDirectional = fridayRowsDirectional(rows);
    const clpDirectional = clpByWeek.get(week) ?? 0;
    const fsaDirectional = fsaByWeek.get(week) ?? 0;
    const shutdownExcluded = !inMatrix &&
      cotReportDate >= COT_2025_SHUTDOWN_FROM &&
      cotReportDate <= COT_2025_SHUTDOWN_TO;
    const cotSourceProvenAvailable = Boolean(storedCot.storedCotReportDate) && !shutdownExcluded;
    const futureNoCotFallbackCandidate = cotDirectional < FX_PAIRS.length &&
      fridayDirectional === FX_PAIRS.length &&
      !cotSourceProvenAvailable;

    let cotAvailabilityClass = "tradable_normal_publication_or_matrix_available";
    if (shutdownExcluded) {
      cotAvailabilityClass = "not_traded_cftc_unavailable_2025_shutdown_excluded_from_matrix";
    } else if (!inMatrix && cotSourceProvenAvailable && storedCot.cotSourceTimingBasis === "stored_holiday_adjusted_report_date") {
      cotAvailabilityClass = "not_traded_internal_matrix_holiday_gap_source_available";
    } else if (!inMatrix && cotSourceProvenAvailable) {
      cotAvailabilityClass = "not_traded_internal_matrix_gap_source_available";
    } else if (!inMatrix) {
      cotAvailabilityClass = "not_in_matrix_unclassified";
    } else if (cotDirectional === 0 && week.startsWith("2019-01-07")) {
      cotAvailabilityClass = "not_traded_cftc_unavailable_early_2019_shutdown_lapse";
    } else if (cotDirectional === 0 && cotSourceProvenAvailable && storedCot.cotSourceTimingBasis === "stored_holiday_adjusted_report_date") {
      cotAvailabilityClass = "not_traded_internal_cot_holiday_join_gap_source_available";
    } else if (cotDirectional === 0 && cotSourceProvenAvailable) {
      cotAvailabilityClass = "not_traded_internal_cot_matrix_gap_source_available";
    } else if (cotDirectional < FX_PAIRS.length) {
      cotAvailabilityClass = "not_traded_internal_cot_matrix_gap";
    }

    let clpAvailabilityClass = "available_28_28";
    if (clpDirectional === 0 && cotDirectional === 0) {
      clpAvailabilityClass = "cot_unavailable";
    } else if (clpDirectional === 0) {
      clpAvailabilityClass = "clp_warmup_or_lifecycle_unavailable";
    } else if (clpDirectional < FX_PAIRS.length) {
      clpAvailabilityClass = "partial_clp_lifecycle_available";
    }

    let fridayStrengthAvailabilityClass = "available_28_28";
    if (fridayDirectional === 0 && !inMatrix) {
      fridayStrengthAvailabilityClass = "not_in_matrix";
    } else if (fridayDirectional === 0) {
      fridayStrengthAvailabilityClass = "not_traded_internal_friday_strength_gap";
    } else if (fridayDirectional < FX_PAIRS.length) {
      fridayStrengthAvailabilityClass = "partial_internal_friday_strength_gap";
    }

    return {
      weekOpenUtc: week,
      cotReportDate,
      storedCotReportDate: shutdownExcluded ? null : storedCot.storedCotReportDate,
      cotSourceTimingBasis: shutdownExcluded ? "2025_lapse_catch_up_source_ambiguous" : storedCot.cotSourceTimingBasis,
      inMatrix,
      cotDirectionalRows: cotDirectional,
      fridayStrengthDirectionalRows: fridayDirectional,
      clpDirectionalRows: clpDirectional,
      fridayStrengthSelectedRows: fsaDirectional,
      cotAvailabilityClass,
      clpAvailabilityClass,
      fridayStrengthAvailabilityClass,
      futureNoCotFallbackCandidate,
    };
  });
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = key(row);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function metricTable(signals: SignalSummary[]) {
  const lines = [
    "| Signal | Rows | Full weeks | ADR Grid ADR | ADR Grid DD | ADR Grid R/DD | Weekly Hold ADR | Weekly Hold DD | Weekly Hold R/DD | Missing hold rows |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const signal of signals) {
    lines.push(`| ${signal.signalId} | ${signal.sourceRows} | ${signal.adrGrid.fullSignalWeeks} | ${signal.adrGrid.totalAdr.toFixed(4)} | ${signal.adrGrid.maxDrawdownAdr.toFixed(4)} | ${signal.adrGrid.returnToDrawdown ?? "-"} | ${signal.simpleWeeklyHold.totalAdr.toFixed(4)} | ${signal.simpleWeeklyHold.maxDrawdownAdr.toFixed(4)} | ${signal.simpleWeeklyHold.returnToDrawdown ?? "-"} | ${signal.simpleWeeklyHold.missingPriceRows} |`);
  }
  return lines.join("\n");
}

function classificationTable(title: string, counts: Record<string, number>) {
  const lines = [
    `### ${title}`,
    "",
    "| Classification | Weeks |",
    "|---|---:|",
  ];
  for (const [classification, count] of Object.entries(counts).sort((left, right) => right[1] - left[1])) {
    lines.push(`| \`${classification}\` | ${count} |`);
  }
  return lines.join("\n");
}

function renderMarkdown(receipt: JsonRecord) {
  const signals = receipt.signals as SignalSummary[];
  const availability = receipt.availability as JsonRecord;
  const identity = receipt.identity as JsonRecord;
  const lifecycle = receipt.clpLifecycle as JsonRecord;
  const files = receipt.files as { json: string; markdown: string; docsCopy: string | null };
  const lines = [
    "# Gate 54F Standalone Signal Baselines And Source Availability",
    "",
    `Generated: ${receipt.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${receipt.status}`,
    `- Gate: ${receipt.gate}`,
    `- Matrix dataset: ${identity.matrixDatasetId} / ${identity.matrixDatasetHash}`,
    `- No source rebuild/refetch: ${receipt.noSourceRebuild}`,
    `- No optimization/system selection: ${receipt.noOptimization}`,
    "",
    "## Interpretation",
    "",
    "This receipt keeps the existing ADR Grid score and adds a separate one-entry weekly-hold context number. The weekly-hold context uses the execution weekly window and one selected side per pair, not the ADR Grid fill ledger.",
    "",
    "CLP is evaluated here as a pure diagnostic lifecycle rule: fade the currency with the higher TEI crowding/exhaustion score. This is a baseline source/evaluation proof, not final system selection.",
    "",
    "## Metrics",
    "",
    metricTable(signals),
    "",
    "## Source Availability",
    "",
    `- Expected calendar weeks from matrix span: ${availability.expectedWeeks}`,
    `- Weeks present in Gate 44 matrix: ${availability.matrixWeeks}`,
    `- Weeks absent from matrix: ${availability.absentWeeks}`,
    `- COT full-week unavailable/pending weeks in matrix: ${(availability.cotProblemWeeks as unknown[]).length}`,
    `- Future no-COT fallback candidate weeks with Friday Strength 28/28: ${availability.futureNoCotFallbackCandidateWeeks}`,
    "",
    classificationTable("COT Availability Classes", availability.cotAvailabilityCounts as Record<string, number>),
    "",
    classificationTable("COT Source Timing Basis", availability.cotSourceTimingCounts as Record<string, number>),
    "",
    classificationTable("CLP Availability Classes", availability.clpAvailabilityCounts as Record<string, number>),
    "",
    classificationTable("Friday Strength Availability Classes", availability.fridayStrengthAvailabilityCounts as Record<string, number>),
    "",
    "### COT Problem Weeks In Matrix",
    "",
    "| Week | Derived COT date | Stored COT date | COT rows | Friday Strength rows | Classification | Future no-COT fallback candidate |",
    "|---|---|---|---:|---:|---|---|",
    ...((availability.cotProblemWeeks as AvailabilityRow[]).map((row) =>
      `| ${row.weekOpenUtc.slice(0, 10)} | ${row.cotReportDate} | ${row.storedCotReportDate ?? "-"} | ${row.cotDirectionalRows} | ${row.fridayStrengthDirectionalRows} | \`${row.cotAvailabilityClass}\` | ${row.futureNoCotFallbackCandidate ? "yes" : "no"} |`)),
    "",
    "### Matrix-Absent Weeks",
    "",
    "| Week | Derived COT date | Stored COT date | COT source timing | Classification |",
    "|---|---|---|---|---|",
    ...((availability.absentWeekRows as AvailabilityRow[]).map((row) =>
      `| ${row.weekOpenUtc.slice(0, 10)} | ${row.cotReportDate} | ${row.storedCotReportDate ?? "-"} | \`${row.cotSourceTimingBasis}\` | \`${row.cotAvailabilityClass}\` |`)),
    "",
    "## CLP Lifecycle",
    "",
    `- Lookback reports: ${lifecycle.lifecycleLookback}`,
    `- First lifecycle report date: ${lifecycle.lifecycleFirstReportDate}`,
    `- Lifecycle state rows: ${lifecycle.lifecycleCurrencyStateRows}`,
    `- Warmup rows excluded: ${lifecycle.warmupRows}`,
    `- True missing lifecycle rows: ${lifecycle.trueMissingRows}`,
    `- COT unavailable rows: ${lifecycle.cotUnavailableRows}`,
    `- Tie rows: ${lifecycle.tieRows}`,
    "",
    "## Decision Boundary",
    "",
    "Gate 54F is ready for outside review of the raw baseline numbers. It does not authorize final Signal Model selection, optimization, regime fallback tests, BPR/RRP retests, or live/MT5 work.",
    "",
    "## Files",
    "",
    `- JSON: ${files.json}`,
    `- Markdown: ${files.markdown}`,
    `- Docs copy: ${files.docsCopy}`,
    "",
    `Receipt hash: \`${receipt.receiptHash}\``,
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const outDir = argValue("out-dir") ?? DEFAULT_OUT_DIR;
  const persistDocs = !hasFlag("no-doc-copy");
  await mkdir(outDir, { recursive: true });

  const [dataset, sourceContexts, fsaRows, gridRows, cotSnapshots] = await Promise.all([
    readDataset(),
    readSourceContexts(),
    readFsaDecisions(),
    readGridOpportunityAgg(),
    readCotSnapshots(),
  ]);

  const matrixWeeks = [...new Set(sourceContexts.map((row) => isoUtc(row.week_open_utc)).filter(Boolean) as string[])].sort();
  const expectedWeeks = generateExpectedWeeks(matrixWeeks);
  const sourceByWeek = new Map<string, SourceContextRow[]>();
  for (const row of sourceContexts) {
    const week = isoUtc(row.week_open_utc);
    if (!week) continue;
    const rows = sourceByWeek.get(week) ?? [];
    rows.push(row);
    sourceByWeek.set(week, rows);
  }

  const gridByKey = new Map<string, { adrReturn: number; fills: number }>();
  for (const row of gridRows) {
    const week = isoUtc(row.week_open_utc);
    if (!week) continue;
    gridByKey.set(`${week}|${row.symbol.toUpperCase()}|${row.direction}`, {
      adrReturn: asNumber(row.adr_return),
      fills: asNumber(row.fills),
    });
  }

  const lifecycle = buildLifecycleMap(cotSnapshots);
  const cotReportDates = new Set(cotSnapshots.map((snapshot) => dateKey(snapshot.report_date)).filter(Boolean) as string[]);
  const clp = buildClpDecisions({ sourceContexts, lifecycle });
  const fsaDecisions = normalizeDecisionRows(fsaRows);
  const signalInputs = [
    {
      signalId: CLP_SELECTOR_ID,
      label: "COT Lifecycle Polarity standalone",
      directionRule: "Fade higher TEI crowding/exhaustion: LONG when base TEI < quote TEI, SHORT when base TEI > quote TEI.",
      decisions: clp.decisions,
    },
    {
      signalId: FSA_VARIANT_ID,
      label: "Friday Strength standalone",
      directionRule: "Use frozen Friday Strength direction only.",
      decisions: fsaDecisions,
    },
  ];

  const signals: SignalSummary[] = [];
  for (const signal of signalInputs) {
    const [simpleWeeklyHold, adrGrid] = await Promise.all([
      summarizeSimpleWeeklyHold({ decisions: signal.decisions, matrixWeeks }),
      Promise.resolve(summarizeAdrGrid({ decisions: signal.decisions, matrixWeeks, gridByKey })),
    ]);
    signals.push({
      signalId: signal.signalId,
      label: signal.label,
      directionRule: signal.directionRule,
      sourceRows: signal.decisions.length,
      adrGrid,
      simpleWeeklyHold,
    });
  }

  const availabilityRows = buildAvailabilityLedger({
    expectedWeeks,
    sourceByWeek,
    clpDecisions: clp.decisions,
    fsaDecisions,
    cotReportDates,
  });
  const absentWeekRows = availabilityRows.filter((row) => !row.inMatrix);
  const cotProblemWeeks = availabilityRows.filter((row) =>
    row.inMatrix && row.cotDirectionalRows < FX_PAIRS.length);

  const receiptBase = {
    status: "PASS_BASELINE_CONTEXT_READY_FOR_REVIEW",
    gate: GATE,
    generatedAtUtc: new Date().toISOString(),
    noSourceRebuild: true,
    noOptimization: true,
    noSystemSelection: true,
    identity: {
      matrixDatasetId: dataset.dataset_id,
      matrixDatasetHash: dataset.dataset_hash,
      matrixDatasetVersion: dataset.dataset_version,
      matrixDatasetStatus: dataset.status,
      matrixFromUtc: isoUtc(dataset.from_utc),
      matrixToUtc: isoUtc(dataset.to_utc),
    },
    clpLifecycle: {
      lifecycleLookback: lifecycle.lifecycleLookback,
      lifecycleFirstReportDate: lifecycle.lifecycleFirstReportDate,
      lifecycleReportCount: lifecycle.lifecycleReportCount,
      lifecycleCurrencyStateRows: lifecycle.lifecycleCurrencyStateRows,
      missingMetricWindows: lifecycle.missingMetricWindows,
      warmupRows: clp.warmupRows,
      trueMissingRows: clp.trueMissingRows,
      cotUnavailableRows: clp.cotUnavailableRows,
      tieRows: clp.tieRows,
    },
    signals,
    availability: {
      expectedWeeks: expectedWeeks.length,
      matrixWeeks: matrixWeeks.length,
      absentWeeks: absentWeekRows.length,
      absentWeekRows,
      cotProblemWeeks,
      futureNoCotFallbackCandidateWeeks: availabilityRows.filter((row) => row.futureNoCotFallbackCandidate).length,
      cotAvailabilityCounts: countBy(availabilityRows, (row) => row.cotAvailabilityClass),
      cotSourceTimingCounts: countBy(availabilityRows, (row) => row.cotSourceTimingBasis),
      clpAvailabilityCounts: countBy(availabilityRows, (row) => row.clpAvailabilityClass),
      fridayStrengthAvailabilityCounts: countBy(availabilityRows, (row) => row.fridayStrengthAvailabilityClass),
    },
  };
  const receiptHash = sha256(JSON.stringify(receiptBase));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const jsonPath = path.join(outDir, `gate54f-standalone-signal-baselines-${stamp}.json`);
  const mdPath = path.join(outDir, `gate54f-standalone-signal-baselines-${stamp}.md`);
  const receipt = {
    ...receiptBase,
    receiptHash,
    files: {
      json: jsonPath,
      markdown: mdPath,
      docsCopy: persistDocs ? DOC_OUT : null,
    },
  };
  const markdown = renderMarkdown(receipt);

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(mdPath, markdown, "utf8");
  if (persistDocs) {
    await mkdir(path.dirname(DOC_OUT), { recursive: true });
    await writeFile(DOC_OUT, markdown, "utf8");
  }

  console.log(`Gate 54F status: ${receipt.status}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (persistDocs) console.log(`Docs: ${DOC_OUT}`);
  console.log(`Receipt hash: ${receiptHash}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
