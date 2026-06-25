import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { query } from "@/lib/db";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { getAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import { loadPathBars } from "@/lib/performance/pathBarLoader";

loadEnvConfig(process.cwd());

const GATE = "Gate 54H: clp-tie-break-comparison";
const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const DOC_OUT = "docs/research/GATE54H_CLP_TIE_BREAK_COMPARISON_2026-06-23.md";

const MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const MATRIX_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
const COT_2025_LAPSE_FROM = "2025-09-30";
const COT_2025_LAPSE_TO = "2025-12-23";
const FX_PAIRS = [
  "EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDJPY", "USDCHF", "USDCAD",
  "EURGBP", "EURJPY", "EURCHF", "EURCAD", "EURAUD", "EURNZD",
  "GBPJPY", "GBPCHF", "GBPCAD", "GBPAUD", "GBPNZD",
  "AUDJPY", "AUDCHF", "AUDCAD", "AUDNZD",
  "NZDJPY", "NZDCHF", "NZDCAD",
  "CADJPY", "CADCHF", "CHFJPY",
];

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

type CotSnapshotRow = {
  report_date: Date | string;
  currencies: Record<string, JsonRecord>;
};

type CurrencyLifecycleState = {
  reportDate: string;
  currency: string;
  tei: number;
  noncommNet: number;
  commercialNet: number;
  dealerNet: number;
  rawCompositeScore: number;
  rawNormalizedCompositeScore: number | null;
};

type SignalDecision = {
  weekOpenUtc: string;
  symbol: string;
  selectedSide: Direction;
  selectedReportDate: string;
  source: "clp" | "carry_previous_clp_side" | "raw_underlying_cot_spread";
};

type WeekPolicyRow = {
  weekOpenUtc: string;
  expectedReportDate: string;
  selectedReportDate: string | null;
  reportAgeDays: number | null;
  classification: string;
  decisions: number;
  carryPreviousDecisions: number;
  rawCotSpreadDecisions: number;
  ties: number;
  missingLifecyclePairs: number;
};

type TieCase = {
  weekOpenUtc: string;
  symbol: string;
  selectedReportDate: string;
  baseCurrency: string;
  quoteCurrency: string;
  baseTei: number;
  quoteTei: number;
  carryPreviousSide: Direction | null;
  rawCotSpreadSide: Direction | null;
  rawCotSpread: number | null;
  rawCompositeSpread: number;
  policiesAgree: boolean | null;
};

type GridOpportunityRow = {
  week_open_utc: Date | string;
  symbol: string;
  direction: Direction;
  fills: string | number;
  adr_return: string | number | null;
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

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number | null | undefined, decimals = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function parsePair(symbol: string) {
  const clean = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  return { base: clean.slice(0, 3), quote: clean.slice(3, 6) };
}

function directionSign(direction: Direction) {
  return direction === "LONG" ? 1 : -1;
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
      const currentCrowdLong = numeric(current.currencies?.[currency]?.noncomm_long);
      const currentCrowdShort = numeric(current.currencies?.[currency]?.noncomm_short);
      const currentCommercialLong = numeric(current.currencies?.[currency]?.commercial_long);
      const currentCommercialShort = numeric(current.currencies?.[currency]?.commercial_short);
      const currentDealerLong = numeric(current.currencies?.[currency]?.dealer_long);
      const currentDealerShort = numeric(current.currencies?.[currency]?.dealer_short);
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
      const crowdLean = normalizeLean(currentCrowd, currentCrowdLong, currentCrowdShort);
      const commercialLean = normalizeLean(currentCommercial, currentCommercialLong, currentCommercialShort);
      const dealerLean = normalizeLean(currentDealer, currentDealerLong, currentDealerShort);
      stateByReportCurrency.set(`${current.reportDate}|${currency}`, {
        reportDate: current.reportDate,
        currency,
        tei,
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
    lifecycleLookback: lookback,
    lifecycleFirstReportDate: snapshots[lookback - 1]?.reportDate ?? null,
    lifecycleReportCount: snapshots.length >= lookback ? snapshots.length - lookback + 1 : 0,
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
  if (expectedReportDate >= COT_2025_LAPSE_FROM && expectedReportDate <= COT_2025_LAPSE_TO) {
    const selected = latestBeforeOrEqual(sortedReportDates, shiftedDateKey(COT_2025_LAPSE_FROM, -1) ?? COT_2025_LAPSE_FROM);
    return {
      expectedReportDate,
      selectedReportDate: selected,
      classification: selected
        ? "carry_forward_2025_lapse_source_ambiguous_no_lookahead"
        : "no_prior_cot_available",
    };
  }
  if (reportDateSet.has(expectedReportDate)) {
    return {
      expectedReportDate,
      selectedReportDate: expectedReportDate,
      classification: "exact_report_date_available",
    };
  }
  const holidayCandidates = [shiftedDateKey(expectedReportDate, -1), shiftedDateKey(expectedReportDate, 1)]
    .filter((date): date is string => Boolean(date) && reportDateSet.has(date));
  if (holidayCandidates.length > 0) {
    const selected = holidayCandidates.sort((left, right) =>
      Math.abs(daysBetween(expectedReportDate, left) ?? 99) -
      Math.abs(daysBetween(expectedReportDate, right) ?? 99))[0]!;
    return {
      expectedReportDate,
      selectedReportDate: selected,
      classification: "holiday_adjusted_report_date_available",
    };
  }
  const selected = latestBeforeOrEqual(sortedReportDates, expectedReportDate);
  return {
    expectedReportDate,
    selectedReportDate: selected,
    classification: selected ? "carry_forward_missing_report_no_lookahead" : "no_prior_cot_available",
  };
}

function decisionForRawCotSpread(baseLifecycle: CurrencyLifecycleState, quoteLifecycle: CurrencyLifecycleState) {
  const baseScore = baseLifecycle.rawNormalizedCompositeScore;
  const quoteScore = quoteLifecycle.rawNormalizedCompositeScore;
  if (baseScore !== null && quoteScore !== null && Math.abs(baseScore - quoteScore) >= 1e-12) {
    return {
      selectedSide: baseScore < quoteScore ? "LONG" as Direction : "SHORT" as Direction,
      rawCotSpread: baseScore - quoteScore,
      rawCompositeSpread: baseLifecycle.rawCompositeScore - quoteLifecycle.rawCompositeScore,
    };
  }

  const rawCompositeSpread = baseLifecycle.rawCompositeScore - quoteLifecycle.rawCompositeScore;
  if (Math.abs(rawCompositeSpread) < 1e-12) {
    return {
      selectedSide: null,
      rawCotSpread: null,
      rawCompositeSpread,
    };
  }

  return {
    selectedSide: rawCompositeSpread < 0 ? "LONG" as Direction : "SHORT" as Direction,
    rawCotSpread: null,
    rawCompositeSpread,
  };
}

function makeDecision(
  weekOpenUtc: string,
  symbol: string,
  selectedSide: Direction,
  selectedReportDate: string,
  source: SignalDecision["source"],
): SignalDecision {
  return {
    weekOpenUtc,
    symbol,
    selectedSide,
    selectedReportDate,
    source,
  };
}

function buildTieBreakComparison(options: {
  expectedWeeks: string[];
  sortedReportDates: string[];
  lifecycle: ReturnType<typeof buildLifecycleMap>;
}) {
  const reportDateSet = new Set(options.sortedReportDates);
  const baselineDecisions: SignalDecision[] = [];
  const carryPreviousDecisions: SignalDecision[] = [];
  const rawCotSpreadDecisions: SignalDecision[] = [];
  const carryPreviousTieDecisions: SignalDecision[] = [];
  const rawCotSpreadTieDecisions: SignalDecision[] = [];
  const policyRows: WeekPolicyRow[] = [];
  const tieCases: TieCase[] = [];
  const previousClpSideBySymbol = new Map<string, Direction>();

  for (const week of options.expectedWeeks) {
    const selection = selectCotReportForWeek(week, options.sortedReportDates, reportDateSet);
    let weekDecisions = 0;
    let weekCarryPreviousDecisions = 0;
    let weekRawCotSpreadDecisions = 0;
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
          const rawCotSpread = decisionForRawCotSpread(baseLifecycle, quoteLifecycle);
          const tieCase: TieCase = {
            weekOpenUtc: week,
            symbol,
            selectedReportDate: selection.selectedReportDate,
            baseCurrency: base,
            quoteCurrency: quote,
            baseTei: round(baseLifecycle.tei, 8) ?? baseLifecycle.tei,
            quoteTei: round(quoteLifecycle.tei, 8) ?? quoteLifecycle.tei,
            carryPreviousSide,
            rawCotSpreadSide: rawCotSpread.selectedSide,
            rawCotSpread: round(rawCotSpread.rawCotSpread, 8),
            rawCompositeSpread: round(rawCotSpread.rawCompositeSpread, 4) ?? rawCotSpread.rawCompositeSpread,
            policiesAgree: carryPreviousSide && rawCotSpread.selectedSide
              ? carryPreviousSide === rawCotSpread.selectedSide
              : null,
          };
          tieCases.push(tieCase);
          if (carryPreviousSide) {
            const decision = makeDecision(
              week,
              symbol,
              carryPreviousSide,
              selection.selectedReportDate,
              "carry_previous_clp_side",
            );
            carryPreviousDecisions.push(decision);
            carryPreviousTieDecisions.push(decision);
            weekCarryPreviousDecisions += 1;
          }
          if (rawCotSpread.selectedSide) {
            const decision = makeDecision(
              week,
              symbol,
              rawCotSpread.selectedSide,
              selection.selectedReportDate,
              "raw_underlying_cot_spread",
            );
            rawCotSpreadDecisions.push(decision);
            rawCotSpreadTieDecisions.push(decision);
            weekRawCotSpreadDecisions += 1;
          }
          continue;
        }
        const selectedSide = baseLifecycle.tei < quoteLifecycle.tei ? "LONG" : "SHORT";
        const decision = makeDecision(
          week,
          symbol,
          selectedSide,
          selection.selectedReportDate,
          "clp",
        );
        baselineDecisions.push(decision);
        carryPreviousDecisions.push(decision);
        rawCotSpreadDecisions.push(decision);
        previousClpSideBySymbol.set(symbol, selectedSide);
        weekDecisions += 1;
        weekCarryPreviousDecisions += 1;
        weekRawCotSpreadDecisions += 1;
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
      carryPreviousDecisions: weekCarryPreviousDecisions,
      rawCotSpreadDecisions: weekRawCotSpreadDecisions,
      ties,
      missingLifecyclePairs,
    });
  }

  return {
    baselineDecisions,
    carryPreviousDecisions,
    rawCotSpreadDecisions,
    carryPreviousTieDecisions,
    rawCotSpreadTieDecisions,
    policyRows,
    tieCases,
  };
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

function summarizeWeeklyValues(weeks: string[], weekValues: Map<string, number>, decisions: SignalDecision[]) {
  const decisionWeeks = new Map<string, number>();
  for (const decision of decisions) {
    decisionWeeks.set(decision.weekOpenUtc, (decisionWeeks.get(decision.weekOpenUtc) ?? 0) + 1);
  }
  const values = weeks.map((week) => round(weekValues.get(week) ?? 0) ?? 0);
  const totalAdr = values.reduce((sum, value) => sum + value, 0);
  const positiveAdr = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeAdr = values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const drawdown = maxDrawdown(values);
  return {
    selectedRows: decisions.length,
    activeWeeks: values.filter((value) => value !== 0).length,
    fullSignalWeeks: [...decisionWeeks.values()].filter((count) => count === FX_PAIRS.length).length,
    partialSignalWeeks: [...decisionWeeks.values()].filter((count) => count > 0 && count < FX_PAIRS.length).length,
    unavailableWeeks: weeks.length - decisionWeeks.size,
    totalAdr: round(totalAdr) ?? 0,
    maxDrawdownAdr: round(drawdown) ?? 0,
    returnToDrawdown: drawdown < 0 ? round(totalAdr / Math.abs(drawdown)) : null,
    profitFactorAdr: negativeAdr < 0 ? round(positiveAdr / Math.abs(negativeAdr)) : null,
  };
}

async function summarizeSimpleWeeklyHold(weeks: string[], decisions: SignalDecision[]) {
  const decisionsByWeek = new Map<string, SignalDecision[]>();
  for (const decision of decisions) {
    const rows = decisionsByWeek.get(decision.weekOpenUtc) ?? [];
    rows.push(decision);
    decisionsByWeek.set(decision.weekOpenUtc, rows);
  }

  const weekly = new Map<string, number>();
  let missingPriceRows = 0;

  for (const [week, weekDecisions] of decisionsByWeek) {
    const executionWindow = getExecutionWeekWindow(week, "fx");
    const fromUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? week;
    const toUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? week;
    const [barsBySymbol, adrMap] = await Promise.all([
      loadPathBars([...new Set(weekDecisions.map((decision) => decision.symbol))], fromUtc, toUtc, "1h"),
      loadWeeklyAdrMap(week),
    ]);
    for (const decision of weekDecisions) {
      const bars = barsBySymbol.get(decision.symbol) ?? [];
      const first = bars[0];
      const last = bars[bars.length - 1];
      const pairAdrPct = getAdrPct(adrMap, decision.symbol, "fx");
      if (!first || !last || !Number.isFinite(pairAdrPct) || pairAdrPct <= 0) {
        missingPriceRows += 1;
        continue;
      }
      const raw = ((last.closePrice - first.openPrice) / first.openPrice) * 100 * directionSign(decision.selectedSide);
      weekly.set(week, (weekly.get(week) ?? 0) + raw / pairAdrPct);
    }
  }

  return {
    ...summarizeWeeklyValues(weeks, weekly, decisions),
    missingPriceRows,
  };
}

function summarizeAdrGrid(weeks: string[], decisions: SignalDecision[], gridByKey: Map<string, { adrReturn: number; fills: number }>) {
  const weekly = new Map<string, number>();
  let missingGridRows = 0;
  let gridFills = 0;

  for (const decision of decisions) {
    const key = `${decision.weekOpenUtc}|${decision.symbol}|${decision.selectedSide}`;
    const grid = gridByKey.get(key);
    if (!grid) {
      missingGridRows += 1;
      continue;
    }
    weekly.set(decision.weekOpenUtc, (weekly.get(decision.weekOpenUtc) ?? 0) + grid.adrReturn);
    gridFills += grid.fills;
  }

  return {
    ...summarizeWeeklyValues(weeks, weekly, decisions),
    gridFills,
    missingGridRows,
  };
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = key(row);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
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
  if (dataset.dataset_hash !== MATRIX_DATASET_HASH) throw new Error(`Matrix dataset hash mismatch: ${dataset.dataset_hash}`);
  return dataset;
}

async function readMatrixWeeks() {
  const rows = await query<{ week_open_utc: Date | string }>(
    `SELECT DISTINCT week_open_utc
       FROM research_matrix_source_contexts
      WHERE dataset_id = $1::uuid
      ORDER BY week_open_utc ASC`,
    [MATRIX_DATASET_ID],
  );
  return rows.map((row) => isoUtc(row.week_open_utc)).filter(Boolean) as string[];
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

function renderMarkdown(receipt: JsonRecord) {
  const lifecycle = receipt.clpLifecycle as JsonRecord;
  const availability = receipt.availability as JsonRecord;
  const comparison = receipt.tieBreakComparison as JsonRecord;
  const metrics = receipt.metrics as Record<string, JsonRecord>;
  const files = receipt.files as { json: string; markdown: string; docsCopy: string | null };
  const tieCases = receipt.tieCases as TieCase[];
  const policyRows = availability.policyRows as WeekPolicyRow[];
  const partialRows = policyRows.filter((row) => row.ties > 0);
  const metricRows = [
    ["baseline_no_tie_fill", "Baseline CLP, ties skipped", metrics.baselineNoTieFill],
    ["carry_previous_clp_side", "Carry previous CLP side", metrics.carryPreviousClpSide],
    ["raw_underlying_cot_spread", "Raw underlying COT spread", metrics.rawUnderlyingCotSpread],
  ] as const;
  const tieMetricRows = [
    ["carry_previous_clp_side", "Carry previous CLP side", metrics.tieOnlyCarryPreviousClpSide],
    ["raw_underlying_cot_spread", "Raw underlying COT spread", metrics.tieOnlyRawUnderlyingCotSpread],
  ] as const;
  const lines = [
    "# Gate 54H CLP Tie-Break Comparison",
    "",
    `Generated: ${receipt.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${receipt.status}`,
    `- Gate: ${receipt.gate}`,
    `- Matrix dataset: ${MATRIX_DATASET_ID} / ${MATRIX_DATASET_HASH}`,
    `- Source mutation by this script: ${receipt.sourceMutationByThisScript}`,
    `- No final system selection: ${receipt.noSystemSelection}`,
    `- Winner by tie-only weekly hold ADR: ${comparison.winnerByTieOnlyWeeklyHoldAdr}`,
    `- Winner by tie-only ADR Grid ADR: ${comparison.winnerByTieOnlyAdrGridAdr}`,
    "",
    "## Policy",
    "",
    "This proof compares only CLP tie-break handling for pair-weeks where base and quote CLP TEI are equal. Normal non-tied CLP decisions are unchanged.",
    "",
    "Policy A carries the previous non-tied CLP side for that pair. Policy B uses the raw underlying COT spread behind CLP: normalized non-commercial net lean minus normalized commercial net lean minus normalized dealer net lean, with the same lower-exhaustion polarity used by CLP. If normalized components are unavailable, it falls back to the unnormalized raw composite spread.",
    "",
    "The COT report selection policy is inherited from Gate 54G: exact report date when available, holiday-adjusted report date when needed, and no-lookahead carry-forward through known source-ambiguous lapse windows.",
    "",
    "## CLP Lifecycle",
    "",
    `- Stored FX COT report dates: ${lifecycle.snapshotCount}`,
    `- Stored COT date range: ${lifecycle.firstStoredReportDate} -> ${lifecycle.lastStoredReportDate}`,
    `- Lookback reports: ${lifecycle.lifecycleLookback}`,
    `- First lifecycle report date: ${lifecycle.lifecycleFirstReportDate}`,
    `- Missing metric windows: ${lifecycle.missingMetricWindows}`,
    "",
    "## Tie Coverage",
    "",
    `- Expected weeks: ${availability.expectedWeeks}`,
    `- Baseline selected rows: ${availability.baselineSelectedRows}`,
    `- Baseline partial weeks: ${availability.baselinePartialWeeks}`,
    `- Tie rows: ${comparison.tieRows}`,
    `- Tie weeks: ${comparison.tieWeeks}`,
    `- Carry previous resolved tie rows: ${comparison.carryPreviousResolvedTieRows}`,
    `- Raw COT spread resolved tie rows: ${comparison.rawCotSpreadResolvedTieRows}`,
    `- Policy agreement rows: ${comparison.policyAgreementRows}`,
    `- Policy disagreement rows: ${comparison.policyDisagreementRows}`,
    `- Missing lifecycle pair rows: ${availability.missingLifecyclePairRows}`,
    "",
    "## Full-System Context",
    "",
    "| Policy | Rows | Full weeks | Partial weeks | Weekly Hold ADR | Weekly Hold DD | Weekly Hold PF | ADR Grid ADR | ADR Grid DD | ADR Grid PF |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...metricRows.map(([, label, row]) =>
      `| ${label} | ${row.selectedRows} | ${row.simpleWeeklyHoldFullSignalWeeks} | ${row.simpleWeeklyHoldPartialSignalWeeks} | ${row.simpleWeeklyHoldTotalAdr} | ${row.simpleWeeklyHoldMaxDrawdownAdr} | ${row.simpleWeeklyHoldProfitFactorAdr} | ${row.adrGridTotalAdr} | ${row.adrGridMaxDrawdownAdr} | ${row.adrGridProfitFactorAdr} |`),
    "",
    "## Tie-Only Contribution",
    "",
    "| Policy | Tie rows | Tie weeks | Weekly Hold ADR | Weekly Hold missing price rows | ADR Grid ADR | ADR Grid missing rows | ADR Grid fills |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...tieMetricRows.map(([, label, row]) =>
      `| ${label} | ${row.selectedRows} | ${row.simpleWeeklyHoldActiveWeeks} | ${row.simpleWeeklyHoldTotalAdr} | ${row.simpleWeeklyHoldMissingPriceRows} | ${row.adrGridTotalAdr} | ${row.adrGridMissingGridRows} | ${row.adrGridFills} |`),
    "",
    "## Partial Weeks Before Tie Fill",
    "",
    "| Week | Selected COT date | Baseline decisions | Ties | Carry decisions | Raw spread decisions |",
    "|---|---|---:|---:|---:|---:|",
    ...partialRows.map((row) =>
      `| ${row.weekOpenUtc.slice(0, 10)} | ${row.selectedReportDate ?? "-"} | ${row.decisions} | ${row.ties} | ${row.carryPreviousDecisions} | ${row.rawCotSpreadDecisions} |`),
    "",
    "## Tie Cases",
    "",
    "| Week | Pair | Report date | Carry previous | Raw COT spread | Agree | Raw normalized spread | Raw composite spread |",
    "|---|---|---|---|---|---|---:|---:|",
    ...tieCases.map((row) =>
      `| ${row.weekOpenUtc.slice(0, 10)} | ${row.symbol} | ${row.selectedReportDate} | ${row.carryPreviousSide ?? "-"} | ${row.rawCotSpreadSide ?? "-"} | ${row.policiesAgree ?? "-"} | ${row.rawCotSpread ?? "-"} | ${row.rawCompositeSpread} |`),
    "",
    "## Decision Boundary",
    "",
    "Gate 54H compares CLP tie-break policies only. It does not authorize final Signal Model selection, broad optimization, BPR/RRP retests, execution/risk-overlay changes, MT5/live work, production, or promotion claims.",
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

  const [dataset, matrixWeeks, cotSnapshots, gridRows] = await Promise.all([
    readDataset(),
    readMatrixWeeks(),
    readCotSnapshots(),
    readGridOpportunityAgg(),
  ]);
  const expectedWeeks = generateExpectedWeeks(matrixWeeks);
  const sortedReportDates = cotSnapshots.map((row) => dateKey(row.report_date)).filter(Boolean) as string[];
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
  const {
    baselineDecisions,
    carryPreviousDecisions,
    rawCotSpreadDecisions,
    carryPreviousTieDecisions,
    rawCotSpreadTieDecisions,
    policyRows,
    tieCases,
  } = buildTieBreakComparison({
    expectedWeeks,
    sortedReportDates,
    lifecycle,
  });

  const [
    baselineWeeklyHold,
    carryPreviousWeeklyHold,
    rawCotSpreadWeeklyHold,
    carryPreviousTieWeeklyHold,
    rawCotSpreadTieWeeklyHold,
  ] = await Promise.all([
    summarizeSimpleWeeklyHold(expectedWeeks, baselineDecisions),
    summarizeSimpleWeeklyHold(expectedWeeks, carryPreviousDecisions),
    summarizeSimpleWeeklyHold(expectedWeeks, rawCotSpreadDecisions),
    summarizeSimpleWeeklyHold(expectedWeeks, carryPreviousTieDecisions),
    summarizeSimpleWeeklyHold(expectedWeeks, rawCotSpreadTieDecisions),
  ]);

  const baselineAdrGrid = summarizeAdrGrid(expectedWeeks, baselineDecisions, gridByKey);
  const carryPreviousAdrGrid = summarizeAdrGrid(expectedWeeks, carryPreviousDecisions, gridByKey);
  const rawCotSpreadAdrGrid = summarizeAdrGrid(expectedWeeks, rawCotSpreadDecisions, gridByKey);
  const carryPreviousTieAdrGrid = summarizeAdrGrid(expectedWeeks, carryPreviousTieDecisions, gridByKey);
  const rawCotSpreadTieAdrGrid = summarizeAdrGrid(expectedWeeks, rawCotSpreadTieDecisions, gridByKey);

  function mergedMetrics(
    simpleWeeklyHold: ReturnType<typeof summarizeWeeklyValues> & { missingPriceRows?: number },
    adrGrid: ReturnType<typeof summarizeAdrGrid>,
  ) {
    return {
      selectedRows: simpleWeeklyHold.selectedRows,
      simpleWeeklyHoldTotalAdr: simpleWeeklyHold.totalAdr,
      simpleWeeklyHoldMaxDrawdownAdr: simpleWeeklyHold.maxDrawdownAdr,
      simpleWeeklyHoldReturnToDrawdown: simpleWeeklyHold.returnToDrawdown,
      simpleWeeklyHoldProfitFactorAdr: simpleWeeklyHold.profitFactorAdr,
      simpleWeeklyHoldFullSignalWeeks: simpleWeeklyHold.fullSignalWeeks,
      simpleWeeklyHoldPartialSignalWeeks: simpleWeeklyHold.partialSignalWeeks,
      simpleWeeklyHoldActiveWeeks: simpleWeeklyHold.activeWeeks,
      simpleWeeklyHoldMissingPriceRows: simpleWeeklyHold.missingPriceRows ?? null,
      adrGridTotalAdr: adrGrid.totalAdr,
      adrGridMaxDrawdownAdr: adrGrid.maxDrawdownAdr,
      adrGridReturnToDrawdown: adrGrid.returnToDrawdown,
      adrGridProfitFactorAdr: adrGrid.profitFactorAdr,
      adrGridFullSignalWeeks: adrGrid.fullSignalWeeks,
      adrGridPartialSignalWeeks: adrGrid.partialSignalWeeks,
      adrGridActiveWeeks: adrGrid.activeWeeks,
      adrGridFills: adrGrid.gridFills,
      adrGridMissingGridRows: adrGrid.missingGridRows,
    };
  }

  const carryTieTotal = carryPreviousTieWeeklyHold.totalAdr;
  const rawTieTotal = rawCotSpreadTieWeeklyHold.totalAdr;
  const carryTieGridTotal = carryPreviousTieAdrGrid.totalAdr;
  const rawTieGridTotal = rawCotSpreadTieAdrGrid.totalAdr;
  const policyAgreementRows = tieCases.filter((row) => row.policiesAgree === true).length;
  const policyDisagreementRows = tieCases.filter((row) => row.policiesAgree === false).length;
  const tieRows = tieCases.length;
  const tieWeeks = new Set(tieCases.map((row) => row.weekOpenUtc)).size;

  const receiptBase = {
    status: "PASS_CLP_TIE_BREAK_COMPARISON_READY_FOR_REVIEW",
    gate: GATE,
    generatedAtUtc: new Date().toISOString(),
    sourceMutationByThisScript: false,
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
      snapshotCount: sortedReportDates.length,
      firstStoredReportDate: sortedReportDates[0] ?? null,
      lastStoredReportDate: sortedReportDates.at(-1) ?? null,
      lifecycleLookback: lifecycle.lifecycleLookback,
      lifecycleFirstReportDate: lifecycle.lifecycleFirstReportDate,
      lifecycleReportCount: lifecycle.lifecycleReportCount,
      lifecycleCurrencyStateRows: lifecycle.lifecycleCurrencyStateRows,
      missingMetricWindows: lifecycle.missingMetricWindows,
    },
    availability: {
      expectedWeeks: expectedWeeks.length,
      baselineSelectedRows: baselineDecisions.length,
      carryPreviousSelectedRows: carryPreviousDecisions.length,
      rawCotSpreadSelectedRows: rawCotSpreadDecisions.length,
      baselineFullWeeks: baselineWeeklyHold.fullSignalWeeks,
      baselinePartialWeeks: baselineWeeklyHold.partialSignalWeeks,
      carryPreviousFullWeeks: carryPreviousWeeklyHold.fullSignalWeeks,
      carryPreviousPartialWeeks: carryPreviousWeeklyHold.partialSignalWeeks,
      rawCotSpreadFullWeeks: rawCotSpreadWeeklyHold.fullSignalWeeks,
      rawCotSpreadPartialWeeks: rawCotSpreadWeeklyHold.partialSignalWeeks,
      tieRows: policyRows.reduce((sum, row) => sum + row.ties, 0),
      missingLifecyclePairRows: policyRows.reduce((sum, row) => sum + row.missingLifecyclePairs, 0),
      classificationCounts: countBy(policyRows, (row) => row.classification),
      policyRows,
    },
    tieBreakComparison: {
      tieRows,
      tieWeeks,
      carryPreviousResolvedTieRows: carryPreviousTieDecisions.length,
      rawCotSpreadResolvedTieRows: rawCotSpreadTieDecisions.length,
      carryPreviousUnresolvedTieRows: tieRows - carryPreviousTieDecisions.length,
      rawCotSpreadUnresolvedTieRows: tieRows - rawCotSpreadTieDecisions.length,
      policyAgreementRows,
      policyDisagreementRows,
      policyComparisonUnknownRows: tieRows - policyAgreementRows - policyDisagreementRows,
      winnerByTieOnlyWeeklyHoldAdr: carryTieTotal > rawTieTotal
        ? "carry_previous_clp_side"
        : rawTieTotal > carryTieTotal
          ? "raw_underlying_cot_spread"
          : "tie",
      winnerByTieOnlyAdrGridAdr: carryTieGridTotal > rawTieGridTotal
        ? "carry_previous_clp_side"
        : rawTieGridTotal > carryTieGridTotal
          ? "raw_underlying_cot_spread"
          : "tie",
      weeklyHoldTieOnlyDeltaCarryMinusRaw: round(carryTieTotal - rawTieTotal),
      adrGridTieOnlyDeltaCarryMinusRaw: round(carryTieGridTotal - rawTieGridTotal),
      rawCotSpreadDefinition: "raw normalized composite = noncomm_net/(noncomm_long+noncomm_short) - commercial_net/(commercial_long+commercial_short) - dealer_net/(dealer_long+dealer_short); lower score selected with CLP polarity; unnormalized composite is fallback only when normalized components are missing",
    },
    metrics: {
      baselineNoTieFill: mergedMetrics(baselineWeeklyHold, baselineAdrGrid),
      carryPreviousClpSide: mergedMetrics(carryPreviousWeeklyHold, carryPreviousAdrGrid),
      rawUnderlyingCotSpread: mergedMetrics(rawCotSpreadWeeklyHold, rawCotSpreadAdrGrid),
      tieOnlyCarryPreviousClpSide: mergedMetrics(carryPreviousTieWeeklyHold, carryPreviousTieAdrGrid),
      tieOnlyRawUnderlyingCotSpread: mergedMetrics(rawCotSpreadTieWeeklyHold, rawCotSpreadTieAdrGrid),
    },
    tieCases,
  };

  const receiptHash = sha256(JSON.stringify(receiptBase));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const jsonPath = path.join(outDir, `gate54h-clp-tie-break-comparison-${stamp}.json`);
  const mdPath = path.join(outDir, `gate54h-clp-tie-break-comparison-${stamp}.md`);
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
    await writeFile(DOC_OUT, markdown, "utf8");
  }

  console.log(`Gate 54H status: ${receipt.status}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  if (persistDocs) console.log(`Docs: ${DOC_OUT}`);
  console.log(`Receipt hash: ${receipt.receiptHash}`);
  console.log(`Tie-only weekly hold winner: ${receipt.tieBreakComparison.winnerByTieOnlyWeeklyHoldAdr}`);
  console.log(`Tie-only ADR Grid winner: ${receipt.tieBreakComparison.winnerByTieOnlyAdrGridAdr}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
