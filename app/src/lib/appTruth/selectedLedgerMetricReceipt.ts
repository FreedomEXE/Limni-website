/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: selectedLedgerMetricReceipt.ts
 *
 * Description:
 * Non-UI parity receipt for selected-ledger metrics. This is the artifact
 * baseline promotion can inspect without adding visible provenance to pages.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";
import type { StrategyConfig } from "@/lib/performance/strategyConfig";
import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";
import {
  SELECTED_LEDGER_STAT_VERSION,
  type SelectedLedgerStats,
} from "@/lib/appTruth/selectedLedgerStats";
import {
  buildSelectedLedgerBasketMetrics,
  buildSelectedLedgerModelReceipts,
} from "@/lib/appTruth/selectedLedgerMetricViews";

const DEFAULT_TOLERANCE_PCT = 0.000001;

export type SelectedLedgerMetricReceipt = {
  schemaVersion: 1;
  kind: "selected-ledger-metric-receipt";
  generatedAtUtc: string;
  statVersion: typeof SELECTED_LEDGER_STAT_VERSION;
  selection: RuntimeStrategySelection | null;
  strategyLabel: string | null;
  historyWindow: string | null;
  selectedWeek: string;
  scope: AssetClass[];
  viewMode: ViewMode;
  status: SelectedLedgerStats["status"];
  reason: string | null;
  ledger: {
    selectedExecutionLedgerId: string | null;
    selectedTradeRowLedgerId: string | null;
    sourceRowCount: number;
    selectedRowCount: number;
    metricRowCount: number;
    leafRowCount: number;
  };
  summary: {
    returnPct: number | null;
    maxDrawdownPct: number | null;
    tradeCount: number | null;
    winCount: number | null;
    lossCount: number | null;
    winRate: number | null;
  };
  weekly: {
    count: number;
    returnPctSum: number;
    tradeCount: number;
    rows: Array<{
      weekOpenUtc: string;
      returnPct: number;
      maxDrawdownPct: number | null;
      trades: number;
    }>;
  };
  summaryCards: Array<{
    model: string;
    returnPct: number;
    metricRowCount: number;
    leafRowCount: number;
  }>;
  simulation: {
    returnPct: number | null;
    maxDrawdownPct: number | null;
    tradeCount: number | null;
    pathPointCount: number;
  };
  basket: {
    returnPct: number | null;
    maxDrawdownPct: number | null;
    tradeCount: number | null;
    hasActivity: boolean;
  };
  exportContract: {
    rowExportsRemainRowOnly: true;
    metricReceiptSource: typeof SELECTED_LEDGER_STAT_VERSION;
  };
  parity: {
    tolerancePct: number;
    summaryMatchesWeeklySum: boolean;
    summaryCardsMatchSummary: boolean;
    simulationMatchesSummary: boolean;
    basketMatchesSummary: boolean;
    tradeCountsMatch: boolean;
    passed: boolean;
  };
};

function nearlyEqual(left: number | null, right: number | null, tolerancePct: number) {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) <= tolerancePct;
}

function nullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildSelectedLedgerMetricReceipt(options: {
  stats: SelectedLedgerStats;
  strategy: StrategyConfig | null;
  selection?: RuntimeStrategySelection | null;
  historyWindow?: string | null;
  viewMode: ViewMode;
  generatedAtUtc?: string;
  tolerancePct?: number;
}): SelectedLedgerMetricReceipt {
  const tolerancePct = options.tolerancePct ?? DEFAULT_TOLERANCE_PCT;
  const summary = options.stats.summary;
  const weeklyReturnPctSum = options.stats.weeklyReturns.reduce((sum, week) => sum + week.returnPct, 0);
  const weeklyTradeCount = options.stats.weeklyReturns.reduce((sum, week) => sum + week.trades, 0);
  const summaryCards = options.strategy && options.stats.status === "available"
    ? buildSelectedLedgerModelReceipts(options.stats, options.strategy, options.viewMode)
    : [];
  const summaryCardsReturnPct = summaryCards.reduce((sum, card) => sum + card.returnPct, 0);
  const summaryCardsLeafRows = summaryCards.reduce((sum, card) => sum + card.leafRowCount, 0);
  const basket = buildSelectedLedgerBasketMetrics(options.stats);
  const summaryReturnPct = nullableNumber(summary?.returnPct);
  const summaryTradeCount = nullableNumber(summary?.tradeCount);
  const summaryMaxDrawdownPct = nullableNumber(summary?.maxDrawdownPct);
  const simulation = {
    returnPct: summaryReturnPct,
    maxDrawdownPct: summaryMaxDrawdownPct,
    tradeCount: summaryTradeCount,
    pathPointCount: options.stats.pathPoints.length,
  };

  const summaryMatchesWeeklySum = nearlyEqual(summaryReturnPct, weeklyReturnPctSum, tolerancePct);
  const summaryCardsMatchSummary = summaryCards.length === 0
    ? options.stats.status !== "available"
    : nearlyEqual(summaryCardsReturnPct, summaryReturnPct, tolerancePct);
  const simulationMatchesSummary =
    nearlyEqual(simulation.returnPct, summaryReturnPct, tolerancePct) &&
    nearlyEqual(simulation.maxDrawdownPct, summaryMaxDrawdownPct, tolerancePct) &&
    simulation.tradeCount === summaryTradeCount;
  const basketMatchesSummary =
    nearlyEqual(basket.returnPct, summaryReturnPct, tolerancePct) &&
    nearlyEqual(basket.maxDrawdownPct, summaryMaxDrawdownPct, tolerancePct) &&
    basket.tradeCount === summaryTradeCount;
  const tradeCountsMatch =
    summaryTradeCount === null
      ? options.stats.status !== "available"
      : summaryTradeCount === options.stats.leafRowCount &&
        summaryTradeCount === weeklyTradeCount &&
        (summaryCards.length === 0 || summaryTradeCount === summaryCardsLeafRows);

  const parity = {
    tolerancePct,
    summaryMatchesWeeklySum,
    summaryCardsMatchSummary,
    simulationMatchesSummary,
    basketMatchesSummary,
    tradeCountsMatch,
    passed:
      options.stats.status === "available" &&
      summaryMatchesWeeklySum &&
      summaryCardsMatchSummary &&
      simulationMatchesSummary &&
      basketMatchesSummary &&
      tradeCountsMatch,
  };

  return {
    schemaVersion: 1,
    kind: "selected-ledger-metric-receipt",
    generatedAtUtc: options.generatedAtUtc ?? new Date().toISOString(),
    statVersion: SELECTED_LEDGER_STAT_VERSION,
    selection: options.selection ?? null,
    strategyLabel: options.strategy?.label ?? null,
    historyWindow: options.historyWindow ?? null,
    selectedWeek: options.stats.selectedWeek,
    scope: options.stats.scope,
    viewMode: options.viewMode,
    status: options.stats.status,
    reason: options.stats.reason,
    ledger: {
      selectedExecutionLedgerId: options.stats.selectedExecutionLedgerId,
      selectedTradeRowLedgerId: options.stats.selectedTradeRowLedgerId,
      sourceRowCount: options.stats.sourceRowCount,
      selectedRowCount: options.stats.selectedRowCount,
      metricRowCount: options.stats.metricRowCount,
      leafRowCount: options.stats.leafRowCount,
    },
    summary: {
      returnPct: summaryReturnPct,
      maxDrawdownPct: summaryMaxDrawdownPct,
      tradeCount: summaryTradeCount,
      winCount: nullableNumber(summary?.winCount),
      lossCount: nullableNumber(summary?.lossCount),
      winRate: nullableNumber(summary?.winRate),
    },
    weekly: {
      count: options.stats.weeklyReturns.length,
      returnPctSum: weeklyReturnPctSum,
      tradeCount: weeklyTradeCount,
      rows: options.stats.weeklyReturns.map((week) => ({
        weekOpenUtc: week.weekOpenUtc,
        returnPct: week.returnPct,
        maxDrawdownPct: week.maxDrawdownPct,
        trades: week.trades,
      })),
    },
    summaryCards,
    simulation,
    basket,
    exportContract: {
      rowExportsRemainRowOnly: true,
      metricReceiptSource: SELECTED_LEDGER_STAT_VERSION,
    },
    parity,
  };
}
