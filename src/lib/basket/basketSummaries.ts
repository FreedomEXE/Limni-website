/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketSummaries.ts
 *
 * Description:
 * Read-only closed-history basket bundle helpers backed by tradeReaders.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";
import { inferPerformanceAssetClass, normalizePerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import { getTradesForSurface } from "@/lib/trades/tradeReaders";
import type { AnchorType, Trade, TradeStrategyFamily } from "@/lib/trades/tradeTypes";
import type { BasketRowKind, ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";

type BuildClosedHistoryBundleOptions = {
  strategyVariant: string;
  scope: readonly AssetClass[];
};

type MergeDraft = Omit<ClosedHistoryRow, "canonicalTradeId" | "executionTradeId" | "returnMatrix" | "warnings"> & {
  canonicalTradeId: string | null;
  executionTradeId: string | null;
  returnMatrix: ClosedHistoryRow["returnMatrix"];
  riskMatrix: NonNullable<ClosedHistoryRow["riskMatrix"]>;
  warnings: Set<string>;
};

export function inferStrategyFamilyFromVariant(strategyVariant: string): TradeStrategyFamily {
  const parts = strategyVariant.split("-").filter(Boolean);
  return parts.includes("adr_grid") ? "adr_grid" : "weekly_hold";
}

function rowKindForTrade(strategyFamily: TradeStrategyFamily, trade: Trade): BasketRowKind {
  if (trade.parentTradeId) return "fill";
  return strategyFamily === "adr_grid" ? "grid" : "trade";
}

function normalizeWeekOpenUtc(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function safePart(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function parentNaturalIdentity(strategyFamily: TradeStrategyFamily, trade: Trade) {
  return [
    "parent",
    trade.origin,
    strategyFamily,
    trade.strategyVariant,
    trade.symbol,
    normalizeWeekOpenUtc(trade.weekOpenUtc),
    trade.sourceModel ?? "",
    trade.tier ?? -1,
    trade.direction ?? "",
  ].map(safePart).join("|");
}

function rowNaturalIdentity(rowKind: BasketRowKind, trade: Trade, parentNaturalRef: string | null) {
  return [
    rowKind,
    trade.origin,
    trade.strategyFamily,
    trade.strategyVariant,
    trade.symbol,
    normalizeWeekOpenUtc(trade.weekOpenUtc),
    trade.sourceModel ?? "",
    trade.tier ?? -1,
    trade.direction ?? "",
    trade.fillSeq ?? -1,
    parentNaturalRef ?? "",
  ].map(safePart).join("|");
}

function parentRefForTrade(trade: Trade, parentByTradeId: Map<string, Trade>) {
  if (!trade.parentTradeId) return null;
  const parent = parentByTradeId.get(trade.parentTradeId);
  return parent ? parentNaturalIdentity(parent.strategyFamily, parent) : null;
}

function baseDraft(trade: Trade, rowKind: BasketRowKind, parentNaturalRef: string | null): MergeDraft {
  return {
    rowKind,
    origin: trade.origin,
    strategyFamily: trade.strategyFamily,
    strategyVariant: trade.strategyVariant,
    symbol: trade.symbol,
    assetClass: inferPerformanceAssetClass(trade.symbol),
    weekOpenUtc: normalizeWeekOpenUtc(trade.weekOpenUtc),
    sourceModel: trade.sourceModel,
    tier: trade.tier,
    direction: trade.direction,
    fillSeq: trade.fillSeq,
    parentNaturalRef,
    canonicalTradeId: null,
    executionTradeId: null,
    entryUtc: trade.entryUtc,
    exitUtc: trade.exitUtc,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    returnMatrix: {
      canonical: null,
      execution: null,
      adrPct: trade.adrPct,
    },
    riskMatrix: {
      canonical: null,
      execution: null,
      adrPct: trade.adrPct,
    },
    exitReason: trade.exitReason,
    capActiveFillsAtEntry: trade.activeFillsAtEntry,
    capThresholdAtEntry: trade.capThresholdAtEntry,
    capViolated: trade.capViolated,
    warnings: new Set(trade.warnings),
  };
}

function mergeAnchorTrade(draft: MergeDraft, trade: Trade, anchorType: AnchorType) {
  if (anchorType === "canonical") {
    draft.canonicalTradeId = trade.tradeId;
    draft.returnMatrix.canonical = trade.rawPct === null ? null : { rawPct: trade.rawPct };
    draft.riskMatrix.canonical = {
      maeRawPct: null,
      pathDrawdownRawPct: null,
    };
  } else {
    draft.executionTradeId = trade.tradeId;
    draft.returnMatrix.execution = trade.rawPct === null ? null : { rawPct: trade.rawPct };
    draft.riskMatrix.execution = {
      maeRawPct: null,
      pathDrawdownRawPct: null,
    };
  }
  draft.returnMatrix.adrPct = draft.returnMatrix.adrPct ?? trade.adrPct;
  draft.riskMatrix.adrPct = draft.riskMatrix.adrPct ?? trade.adrPct;
  draft.entryUtc = draft.entryUtc ?? trade.entryUtc;
  draft.exitUtc = draft.exitUtc ?? trade.exitUtc;
  draft.entryPrice = draft.entryPrice ?? trade.entryPrice;
  draft.exitPrice = draft.exitPrice ?? trade.exitPrice;
  draft.exitReason = draft.exitReason ?? trade.exitReason;
  draft.capActiveFillsAtEntry = draft.capActiveFillsAtEntry ?? trade.activeFillsAtEntry;
  draft.capThresholdAtEntry = draft.capThresholdAtEntry ?? trade.capThresholdAtEntry;
  draft.capViolated = draft.capViolated || trade.capViolated;
  for (const warning of trade.warnings) draft.warnings.add(warning);
}

async function getAnchorRows(strategyVariant: string, anchorType: AnchorType) {
  const strategyFamily = inferStrategyFamilyFromVariant(strategyVariant);
  const rows = await getTradesForSurface({
    surface: "performance",
    strategyFamily,
    strategyVariant,
    anchorType,
  });
  return rows.filter((trade) => trade.origin === "backtest");
}

export async function buildClosedHistoryBundle({
  strategyVariant,
  scope,
}: BuildClosedHistoryBundleOptions): Promise<ClosedHistoryBundle> {
  const normalizedScope = normalizePerformanceAssetSelection(scope);
  const [canonicalRows, executionRows] = await Promise.all([
    getAnchorRows(strategyVariant, "canonical"),
    getAnchorRows(strategyVariant, "execution"),
  ]);
  const currentWeekOpenUtc = normalizeWeekOpenUtc(getCanonicalWeekOpenUtc());
  const allRows = [
    ...canonicalRows.map((trade) => ({ trade, anchorType: "canonical" as const })),
    ...executionRows.map((trade) => ({ trade, anchorType: "execution" as const })),
  ].filter(({ trade }) => normalizeWeekOpenUtc(trade.weekOpenUtc) < currentWeekOpenUtc);
  const parentByTradeId = new Map<string, Trade>();
  for (const { trade } of allRows) {
    if (!trade.parentTradeId) parentByTradeId.set(trade.tradeId, trade);
  }

  const drafts = new Map<string, MergeDraft>();
  for (const { trade, anchorType } of allRows) {
    const assetClass = inferPerformanceAssetClass(trade.symbol);
    if (!normalizedScope.includes(assetClass)) continue;
    const rowKind = rowKindForTrade(trade.strategyFamily, trade);
    const parentNaturalRef = parentRefForTrade(trade, parentByTradeId);
    const key = rowNaturalIdentity(rowKind, trade, parentNaturalRef);
    const draft = drafts.get(key) ?? baseDraft(trade, rowKind, parentNaturalRef);
    mergeAnchorTrade(draft, trade, anchorType);
    drafts.set(key, draft);
  }

  const rows: ClosedHistoryRow[] = [...drafts.values()]
    .map((draft) => ({
      ...draft,
      warnings: [...draft.warnings].sort((left, right) => left.localeCompare(right)),
    }))
    .filter((row) =>
      row.returnMatrix.canonical !== null
      || row.returnMatrix.execution !== null
      || row.warnings.length > 0,
    )
    .sort((left, right) => {
      const weekDiff = right.weekOpenUtc.localeCompare(left.weekOpenUtc);
      if (weekDiff !== 0) return weekDiff;
      const symbolDiff = left.symbol.localeCompare(right.symbol);
      if (symbolDiff !== 0) return symbolDiff;
      const sourceDiff = (left.sourceModel ?? "").localeCompare(right.sourceModel ?? "");
      if (sourceDiff !== 0) return sourceDiff;
      const tierDiff = (left.tier ?? -1) - (right.tier ?? -1);
      if (tierDiff !== 0) return tierDiff;
      return (left.fillSeq ?? -1) - (right.fillSeq ?? -1);
    });

  return {
    rows,
    strategyVariant,
    scope: normalizedScope,
    generatedAt: new Date().toISOString(),
  };
}
