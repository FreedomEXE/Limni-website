/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: selectedLedgerStats.ts
 *
 * Description:
 * Canonical selected-ledger stat adapter. It projects app-wide metrics from
 * the selected trade-row ledger so pages do not rebuild metric math locally.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { AssetClass } from "@/lib/cotMarkets";
import { computeMaxDrawdownSimple } from "@/lib/performance/drawdown";
import {
  computeMaxConsecutivePeriodStreaks,
  computeProfitFactorFromTradeReturns,
  computeReturnSharpe,
  computeReturnSortino,
  computeTradeExpectancy,
} from "@/lib/performance/performanceMetricBasis";
import { resolveDisplayDrawdown } from "@/lib/viewMode/resolveDisplayValue";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

export const SELECTED_LEDGER_STAT_VERSION = "selected-ledger-stat-v1";

const ASSET_CLASS_ORDER: AssetClass[] = ["fx", "indices", "commodities", "crypto"];

export type SelectedLedgerPathPoint = {
  ts_utc: string;
  balance_pct: number;
  equity_pct: number;
  adverse_equity_pct: number;
  lock_pct: null;
  peak_pct: number;
  drawdown_pct: number;
  active_positions: number;
};

export type SelectedLedgerWeekStat = {
  weekOpenUtc: string;
  returnPct: number;
  maxDrawdownPct: number | null;
  trades: number;
  wins: number;
  losses: number;
};

export type SelectedLedgerSummaryStat = {
  returnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  weeklyWinRate: number;
  avgWeeklyReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  profitFactor: number | null;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
};

export type SelectedLedgerStats = {
  status: "available" | "missing";
  reason: string | null;
  selectedExecutionLedgerId: string | null;
  selectedTradeRowLedgerId: string | null;
  selectedWeek: string;
  scope: AssetClass[];
  sourceRowCount: number;
  selectedRowCount: number;
  metricRowCount: number;
  leafRowCount: number;
  metricRows: ClosedHistoryRow[];
  leafRows: ClosedHistoryRow[];
  summary: SelectedLedgerSummaryStat | null;
  weeklyReturns: SelectedLedgerWeekStat[];
  pathPoints: SelectedLedgerPathPoint[];
  assetReturns: Array<{ assetClass: AssetClass; returnPct: number }>;
  maeTrades: Array<{ pair: string; returnPct: number; maePct: number }>;
};

type BuildSelectedLedgerStatsInput = {
  bundle: ClosedHistoryBundle | null | undefined;
  selectedWeek: string;
  scope: readonly AssetClass[];
  viewMode: ViewMode;
};

function normalizeScope(scope: readonly AssetClass[]) {
  const selected = new Set(scope.filter((item): item is AssetClass => ASSET_CLASS_ORDER.includes(item)));
  if (selected.size === 0) return [...ASSET_CLASS_ORDER];
  return ASSET_CLASS_ORDER.filter((item) => selected.has(item));
}

function missingStats(reason: string, selectedWeek: string, scope: readonly AssetClass[]): SelectedLedgerStats {
  return {
    status: "missing",
    reason,
    selectedExecutionLedgerId: null,
    selectedTradeRowLedgerId: null,
    selectedWeek,
    scope: normalizeScope(scope),
    sourceRowCount: 0,
    selectedRowCount: 0,
    metricRowCount: 0,
    leafRowCount: 0,
    metricRows: [],
    leafRows: [],
    summary: null,
    weeklyReturns: [],
    pathPoints: [],
    assetReturns: [],
    maeTrades: [],
  };
}

function rowMatchesSelection(row: ClosedHistoryRow, selectedWeek: string, scope: Set<AssetClass>) {
  if (selectedWeek !== "all" && row.weekOpenUtc !== selectedWeek) return false;
  return scope.has(row.assetClass);
}

function metricRowsFor(rows: ClosedHistoryRow[]) {
  const hasGridRows = rows.some((row) => row.rowKind === "grid");
  if (hasGridRows) {
    return rows.filter((row) => row.rowKind === "grid" || row.rowKind === "trade");
  }
  return rows.filter((row) => row.rowKind === "fill" || row.rowKind === "trade");
}

function leafRowsFor(rows: ClosedHistoryRow[]) {
  return rows.filter((row) => row.rowKind === "fill" || row.rowKind === "trade");
}

export function resolveSelectedLedgerReturn(row: ClosedHistoryRow, viewMode: ViewMode) {
  const raw = viewMode.anchor === "canonical"
    ? row.returnMatrix.canonical?.rawPct
    : row.returnMatrix.execution?.rawPct;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (viewMode.normalization === "adr_normalized") {
    const adrPct = row.returnMatrix.adrPct;
    return typeof adrPct === "number" && Number.isFinite(adrPct) && adrPct > 0
      ? raw / adrPct
      : null;
  }
  return raw;
}

function resolveSelectedLedgerDrawdown(row: ClosedHistoryRow, viewMode: ViewMode) {
  return resolveDisplayDrawdown(row.riskMatrix, viewMode, "pathDrawdown")
    ?? resolveDisplayDrawdown(row.riskMatrix, viewMode, "mae")
    ?? null;
}

function finiteNumbers(values: Array<number | null | undefined>) {
  return values.filter((value): value is number => (
    typeof value === "number" && Number.isFinite(value)
  ));
}

function groupRowsByWeek(rows: ClosedHistoryRow[]) {
  const groups = new Map<string, ClosedHistoryRow[]>();
  for (const row of rows) {
    groups.set(row.weekOpenUtc, [...(groups.get(row.weekOpenUtc) ?? []), row]);
  }
  return groups;
}

function buildWeeklyReturns(
  metricRows: ClosedHistoryRow[],
  leafRows: ClosedHistoryRow[],
  viewMode: ViewMode,
): SelectedLedgerWeekStat[] {
  const leavesByWeek = groupRowsByWeek(leafRows);
  return Array.from(groupRowsByWeek(metricRows).entries())
    .map(([weekOpenUtc, rows]) => {
      const returns = finiteNumbers(rows.map((row) => resolveSelectedLedgerReturn(row, viewMode)));
      const leaves = leavesByWeek.get(weekOpenUtc) ?? [];
      const leafReturns = finiteNumbers(leaves.map((row) => resolveSelectedLedgerReturn(row, viewMode)));
      const closeDrawdown = computeMaxDrawdownSimple([returns.reduce((sum, value) => sum + value, 0)]);
      const rowDrawdown = Math.max(...finiteNumbers(rows.map((row) => resolveSelectedLedgerDrawdown(row, viewMode))), 0);
      return {
        weekOpenUtc,
        returnPct: returns.reduce((sum, value) => sum + value, 0),
        maxDrawdownPct: Math.max(closeDrawdown, rowDrawdown) || null,
        trades: leaves.length,
        wins: leafReturns.filter((value) => value > 0).length,
        losses: leafReturns.filter((value) => value < 0).length,
      };
    })
    .filter((week) => Number.isFinite(week.returnPct))
    .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
}

function rowTimestamp(row: ClosedHistoryRow) {
  return row.exitUtc ?? row.entryUtc ?? row.weekOpenUtc;
}

function buildPathPoints(
  metricRows: ClosedHistoryRow[],
  viewMode: ViewMode,
): SelectedLedgerPathPoint[] {
  let equityPct = 0;
  let peakPct = 0;
  return [...metricRows]
    .sort((left, right) => rowTimestamp(left).localeCompare(rowTimestamp(right)))
    .map((row) => {
      const returnPct = resolveSelectedLedgerReturn(row, viewMode) ?? 0;
      const rowDrawdownPct = Math.max(resolveSelectedLedgerDrawdown(row, viewMode) ?? 0, 0);
      equityPct += returnPct;
      peakPct = Math.max(peakPct, equityPct);
      const adverseEquityPct = equityPct - rowDrawdownPct;
      const drawdownPct = (100 + peakPct) <= 0
        ? -100
        : (((100 + adverseEquityPct) / (100 + peakPct)) - 1) * 100;
      return {
        ts_utc: rowTimestamp(row),
        balance_pct: equityPct,
        equity_pct: equityPct,
        adverse_equity_pct: adverseEquityPct,
        lock_pct: null,
        peak_pct: peakPct,
        drawdown_pct: drawdownPct,
        active_positions: 1,
      };
    });
}

function buildSummary(
  metricRows: ClosedHistoryRow[],
  leafRows: ClosedHistoryRow[],
  weeklyReturns: SelectedLedgerWeekStat[],
  pathPoints: SelectedLedgerPathPoint[],
  viewMode: ViewMode,
): SelectedLedgerSummaryStat | null {
  if (metricRows.length === 0) return null;
  const metricReturns = finiteNumbers(metricRows.map((row) => resolveSelectedLedgerReturn(row, viewMode)));
  const leafReturns = finiteNumbers(leafRows.map((row) => resolveSelectedLedgerReturn(row, viewMode)));
  const weeklyReturnValues = weeklyReturns.map((week) => week.returnPct);
  const pathDrawdowns = finiteNumbers(pathPoints.map((point) => point.drawdown_pct)).map(Math.abs);
  const closeDrawdown = computeMaxDrawdownSimple(weeklyReturnValues);
  const rowDrawdown = Math.max(...finiteNumbers(metricRows.map((row) => resolveSelectedLedgerDrawdown(row, viewMode))), 0);
  const maxDrawdownPct = Math.max(closeDrawdown, rowDrawdown, ...pathDrawdowns, 0);
  const returnPct = metricReturns.reduce((sum, value) => sum + value, 0);
  const winCount = leafReturns.filter((value) => value > 0).length;
  const lossCount = leafReturns.filter((value) => value < 0).length;
  const weeklyWins = weeklyReturnValues.filter((value) => value > 0).length;
  const tradeExpectancy = computeTradeExpectancy(leafReturns);
  const streaks = computeMaxConsecutivePeriodStreaks(weeklyReturnValues);

  return {
    returnPct,
    maxDrawdownPct,
    tradeCount: leafRows.length,
    winCount,
    lossCount,
    winRate: leafRows.length > 0 ? (winCount / leafRows.length) * 100 : 0,
    weeklyWinRate: weeklyReturns.length > 0 ? (weeklyWins / weeklyReturns.length) * 100 : 0,
    avgWeeklyReturn: weeklyReturns.length > 0 ? returnPct / weeklyReturns.length : 0,
    sharpe: computeReturnSharpe(weeklyReturnValues),
    sortino: computeReturnSortino(weeklyReturnValues),
    calmar:
      maxDrawdownPct > 0 && weeklyReturns.length > 0
        ? ((returnPct / weeklyReturns.length) * 52) / maxDrawdownPct
        : 0,
    profitFactor: computeProfitFactorFromTradeReturns(leafReturns),
    expectancy: tradeExpectancy.expectancy,
    avgWin: tradeExpectancy.avgWin,
    avgLoss: tradeExpectancy.avgLoss,
    maxConsecutiveWins: streaks.wins,
    maxConsecutiveLosses: streaks.losses,
  };
}

function buildAssetReturns(metricRows: ClosedHistoryRow[], viewMode: ViewMode) {
  const byAsset = new Map<AssetClass, number>();
  for (const row of metricRows) {
    byAsset.set(
      row.assetClass,
      (byAsset.get(row.assetClass) ?? 0) + (resolveSelectedLedgerReturn(row, viewMode) ?? 0),
    );
  }
  return ASSET_CLASS_ORDER
    .filter((assetClass) => byAsset.has(assetClass))
    .map((assetClass) => ({ assetClass, returnPct: byAsset.get(assetClass) ?? 0 }));
}

function buildMaeTrades(leafRows: ClosedHistoryRow[], viewMode: ViewMode) {
  return leafRows
    .map((row) => {
      const maePct = resolveDisplayDrawdown(row.riskMatrix, viewMode, "mae");
      const returnPct = resolveSelectedLedgerReturn(row, viewMode);
      if (maePct === null || returnPct === null) return null;
      return {
        pair: row.symbol,
        returnPct,
        maePct,
      };
    })
    .filter((row): row is { pair: string; returnPct: number; maePct: number } => row !== null);
}

export function buildSelectedLedgerStats({
  bundle,
  selectedWeek,
  scope,
  viewMode,
}: BuildSelectedLedgerStatsInput): SelectedLedgerStats {
  if (!bundle) return missingStats("selected-ledger-missing", selectedWeek, scope);
  if (!bundle.ledgerIdentity) return missingStats("selected-ledger-identity-missing", selectedWeek, scope);
  const normalizedScope = normalizeScope(scope);
  const selectedScope = new Set(normalizedScope);
  const selectedRows = bundle.rows.filter((row) => rowMatchesSelection(row, selectedWeek, selectedScope));
  const metricRows = metricRowsFor(selectedRows);
  const leafRows = leafRowsFor(selectedRows);
  if (selectedRows.length === 0 || metricRows.length === 0) {
    return missingStats("selected-ledger-rows-missing", selectedWeek, scope);
  }

  const weeklyReturns = buildWeeklyReturns(metricRows, leafRows, viewMode);
  const pathPoints = buildPathPoints(metricRows, viewMode);
  return {
    status: "available",
    reason: null,
    selectedExecutionLedgerId: bundle.ledgerIdentity.executionLedgerId,
    selectedTradeRowLedgerId: bundle.ledgerIdentity.tradeRowLedgerId,
    selectedWeek,
    scope: normalizedScope,
    sourceRowCount: bundle.ledgerIdentity.rowCount,
    selectedRowCount: selectedRows.length,
    metricRowCount: metricRows.length,
    leafRowCount: leafRows.length,
    metricRows,
    leafRows,
    summary: buildSummary(metricRows, leafRows, weeklyReturns, pathPoints, viewMode),
    weeklyReturns,
    pathPoints,
    assetReturns: buildAssetReturns(metricRows, viewMode),
    maeTrades: buildMaeTrades(leafRows, viewMode),
  };
}
