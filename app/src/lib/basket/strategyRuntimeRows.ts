/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyRuntimeRows.ts
 *
 * Description:
 * Converts selected strategy runtime results into Basket closed-history rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { AssetClass } from "@/lib/cotMarkets";
import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";

function normalizeAssetClass(value: string): AssetClass {
  return value === "indices" || value === "commodities" || value === "crypto" || value === "fx"
    ? value
    : "fx";
}

function parentNaturalRefForRuntimeTrade(options: {
  strategyVariant: string;
  weekOpenUtc: string;
  trade: WeeklyHoldTrade;
}) {
  return [
    "parent",
    "backtest",
    "adr_grid",
    options.strategyVariant,
    options.trade.symbol,
    options.weekOpenUtc,
    options.trade.source,
    options.trade.tier ?? -1,
    options.trade.direction,
  ].join("|");
}

function runtimeTradeKey(weekOpenUtc: string, trade: WeeklyHoldTrade) {
  return [
    weekOpenUtc,
    trade.symbol,
    trade.source,
    trade.tier ?? -1,
    trade.direction,
    trade.detail?.tradeNumber ?? 0,
  ].join("|");
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function riskMatrixFromRisk(
  maeRawPct: number | null,
  pathDrawdownRawPct: number | null,
  adrPct: number | null,
): ClosedHistoryRow["riskMatrix"] {
  return {
    canonical: {
      maeRawPct,
      pathDrawdownRawPct,
    },
    execution: {
      maeRawPct,
      pathDrawdownRawPct,
    },
    adrPct,
  };
}

function rowKindOrder(rowKind: ClosedHistoryRow["rowKind"]) {
  if (rowKind === "grid") return 0;
  if (rowKind === "trade") return 1;
  return 2;
}

function sortRows(rows: ClosedHistoryRow[]) {
  return [...rows].sort((left, right) => {
    const weekDiff = left.weekOpenUtc.localeCompare(right.weekOpenUtc);
    if (weekDiff !== 0) return weekDiff;
    const symbolDiff = left.symbol.localeCompare(right.symbol);
    if (symbolDiff !== 0) return symbolDiff;
    const sourceDiff = (left.sourceModel ?? "").localeCompare(right.sourceModel ?? "");
    if (sourceDiff !== 0) return sourceDiff;
    const tierDiff = (left.tier ?? -1) - (right.tier ?? -1);
    if (tierDiff !== 0) return tierDiff;
    const directionDiff = (left.direction ?? "").localeCompare(right.direction ?? "");
    if (directionDiff !== 0) return directionDiff;
    const rowKindDiff = rowKindOrder(left.rowKind) - rowKindOrder(right.rowKind);
    if (rowKindDiff !== 0) return rowKindDiff;
    const entryDiff = (left.entryUtc ?? "").localeCompare(right.entryUtc ?? "");
    if (entryDiff !== 0) return entryDiff;
    const fillDiff = (left.fillSeq ?? Number.MAX_SAFE_INTEGER) - (right.fillSeq ?? Number.MAX_SAFE_INTEGER);
    if (fillDiff !== 0) return fillDiff;
    return (left.executionTradeId ?? left.canonicalTradeId ?? "").localeCompare(
      right.executionTradeId ?? right.canonicalTradeId ?? "",
    );
  });
}

function buildLedgerIdentity(strategyVariant: string, rows: ClosedHistoryRow[]) {
  const firstRow = rows[0] ?? null;
  const lastRow = rows.at(-1) ?? null;
  const firstRef = firstRow?.executionTradeId ?? firstRow?.canonicalTradeId ?? "empty";
  const lastRef = lastRow?.executionTradeId ?? lastRow?.canonicalTradeId ?? "empty";
  const weekSpan = [
    firstRow?.weekOpenUtc ?? "none",
    lastRow?.weekOpenUtc ?? "none",
  ].join("..");
  const identitySeed = [
    "strategy-runtime",
    strategyVariant,
    rows.length,
    weekSpan,
    firstRef,
    lastRef,
  ].join("|");
  const identityHash = stableHash(identitySeed);

  return {
    executionLedgerId: `execution-ledger:strategy-runtime:${strategyVariant}:${rows.length}:${identityHash}`,
    tradeRowLedgerId: `trade-row-ledger:strategy-runtime:${strategyVariant}:${rows.length}:${identityHash}`,
    rowCount: rows.length,
    generatedFrom: "strategy-runtime" as const,
  };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function closedRowsFromStrategyTrades(options: {
  strategyVariant: string;
  weekOpenUtc: string;
  trades: WeeklyHoldTrade[];
}): ClosedHistoryRow[] {
  const strategyFamily = options.strategyVariant.includes("-adr_grid-") ? "adr_grid" : "weekly_hold";
  const rows: ClosedHistoryRow[] = [];
  const gridGroups = new Map<string, WeeklyHoldTrade[]>();

  for (const trade of options.trades) {
    const assetClass = normalizeAssetClass(trade.assetClass);
    const rawPct = typeof trade.rawReturnPct === "number" && Number.isFinite(trade.rawReturnPct)
      ? trade.rawReturnPct
      : trade.returnPct;
    const adrPct = finiteOrNull(trade.adrPct);
    const maeRawPct = finiteOrNull(trade.detail?.maePct);
    const rowKind = strategyFamily === "adr_grid" ? "fill" : "trade";
    const parentNaturalRef = strategyFamily === "adr_grid"
      ? parentNaturalRefForRuntimeTrade({
          strategyVariant: options.strategyVariant,
          weekOpenUtc: options.weekOpenUtc,
          trade,
        })
      : null;
    const stableTradeId = [
      "strategy-runtime",
      options.strategyVariant,
      runtimeTradeKey(options.weekOpenUtc, trade),
    ].join("|");

    rows.push({
      rowKind,
      origin: "backtest",
      strategyFamily,
      strategyVariant: options.strategyVariant,
      symbol: trade.symbol,
      assetClass,
      weekOpenUtc: options.weekOpenUtc,
      sourceModel: trade.source,
      tier: trade.tier,
      direction: trade.direction,
      fillSeq: strategyFamily === "adr_grid" ? trade.detail?.tradeNumber ?? null : null,
      parentNaturalRef,
      canonicalTradeId: `${stableTradeId}|canonical`,
      executionTradeId: `${stableTradeId}|execution`,
      entryUtc: trade.detail?.entryTimeUtc ?? null,
      exitUtc: trade.detail?.exitTimeUtc ?? null,
      entryPrice: trade.openPrice,
      exitPrice: trade.closePrice,
      returnMatrix: {
        canonical: { rawPct },
        execution: { rawPct },
        adrPct,
      },
      riskMatrix: riskMatrixFromRisk(maeRawPct, null, adrPct),
      exitReason: trade.detail?.exitReason ?? null,
      capActiveFillsAtEntry: trade.detail?.capActiveFillsAtEntry ?? null,
      capThresholdAtEntry: trade.detail?.capThresholdAtEntry ?? null,
      capViolated: trade.detail?.capViolated ?? false,
      warnings: [],
    });

    if (strategyFamily === "adr_grid") {
      const groupKey = parentNaturalRef ?? runtimeTradeKey(options.weekOpenUtc, trade);
      const group = gridGroups.get(groupKey) ?? [];
      group.push(trade);
      gridGroups.set(groupKey, group);
    }
  }

  for (const trades of gridGroups.values()) {
    const first = trades[0];
    if (!first) continue;
    const rawPct = trades.reduce((sum, trade) => {
      const value = typeof trade.rawReturnPct === "number" && Number.isFinite(trade.rawReturnPct)
        ? trade.rawReturnPct
        : trade.returnPct;
      return sum + value;
    }, 0);
    const adrPct = finiteOrNull(first.adrPct);
    const maxFillMaeRawPct = trades.reduce<number | null>((max, trade) => {
      const mae = finiteOrNull(trade.detail?.maePct);
      if (mae === null) return max;
      return max === null ? mae : Math.max(max, mae);
    }, null);
    const maxPathDrawdownRawPct = trades.reduce<number | null>((max, trade) => {
      const drawdown = finiteOrNull(trade.detail?.gridPathDrawdownRawPct);
      if (drawdown === null) return max;
      return max === null ? drawdown : Math.max(max, drawdown);
    }, null);
    const maxActiveFillsAtEntry = trades.reduce<number | null>((max, trade) => {
      const active = finiteOrNull(trade.detail?.capActiveFillsAtEntry);
      if (active === null) return max;
      return max === null ? active : Math.max(max, active);
    }, null);
    const capThresholdAtEntry = trades.find((trade) => trade.detail?.capThresholdAtEntry != null)
      ?.detail?.capThresholdAtEntry ?? null;
    const stableTradeId = [
      "strategy-runtime",
      options.strategyVariant,
      options.weekOpenUtc,
      first.symbol,
      first.source,
      first.tier ?? -1,
      first.direction,
      "grid",
    ].join("|");

    rows.push({
      rowKind: "grid",
      origin: "backtest",
      strategyFamily: "adr_grid",
      strategyVariant: options.strategyVariant,
      symbol: first.symbol,
      assetClass: normalizeAssetClass(first.assetClass),
      weekOpenUtc: options.weekOpenUtc,
      sourceModel: first.source,
      tier: first.tier,
      direction: first.direction,
      fillSeq: null,
      parentNaturalRef: null,
      canonicalTradeId: `${stableTradeId}|canonical`,
      executionTradeId: `${stableTradeId}|execution`,
      entryUtc: trades.map((trade) => trade.detail?.entryTimeUtc).filter(Boolean).sort()[0] ?? null,
      exitUtc: trades.map((trade) => trade.detail?.exitTimeUtc).filter(Boolean).sort().at(-1) ?? null,
      entryPrice: first.openPrice,
      exitPrice: trades.at(-1)?.closePrice ?? first.closePrice,
      returnMatrix: {
        canonical: { rawPct },
        execution: { rawPct },
        adrPct,
      },
      riskMatrix: riskMatrixFromRisk(maxFillMaeRawPct, maxPathDrawdownRawPct, adrPct),
      exitReason: null,
      capActiveFillsAtEntry: maxActiveFillsAtEntry,
      capThresholdAtEntry,
      capViolated: trades.some((trade) => trade.detail?.capViolated),
      warnings: [],
    });
  }

  return sortRows(rows);
}

export function buildClosedHistoryBundleFromStrategyResults(options: {
  strategyVariant: string;
  weekResults: Record<string, WeeklyHoldResult>;
  generatedAt?: string;
}): ClosedHistoryBundle {
  const rows = sortRows(
    Object.values(options.weekResults)
      .filter((result) => result.isRealized && result.trades.length > 0)
      .flatMap((result) => closedRowsFromStrategyTrades({
        strategyVariant: options.strategyVariant,
        weekOpenUtc: result.weekOpenUtc,
        trades: result.trades,
      })),
  );

  return {
    rows,
    strategyVariant: options.strategyVariant,
    scope: ["fx", "indices", "commodities", "crypto"],
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    ledgerIdentity: buildLedgerIdentity(options.strategyVariant, rows),
  };
}
