/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketSummaries.ts
 *
 * Description:
 * Read-only all-time Basket summary helpers backed by tradeReaders.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { getTradesForSurface } from "@/lib/trades/tradeReaders";
import type { AnchorType, Trade, TradeStrategyFamily } from "@/lib/trades/tradeTypes";
import type {
  BasketPairExtreme,
  BasketPairSummary,
  BasketReturnMatrixRow,
  BasketWeekSummary,
} from "@/lib/basket/basketSummaryTypes";

type BasketSummaryOptions = {
  strategyVariant: string;
  anchorType: AnchorType;
};

type BasketWeekOptions = BasketSummaryOptions & {
  limit: number;
  offset: number;
};

type BasketPairOptions = BasketSummaryOptions & {
  weekOpenUtc: string;
};

function normalizeWeekOpenUtc(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function inferStrategyFamilyFromVariant(strategyVariant: string): TradeStrategyFamily {
  const parts = strategyVariant.split("-").filter(Boolean);
  return parts.includes("adr_grid") ? "adr_grid" : "weekly_hold";
}

function parentBacktestRows(trades: Trade[]) {
  return trades.filter((trade) => trade.origin === "backtest" && trade.parentTradeId === null);
}

function sumNullable(values: Array<number | null>) {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length === 0 ? null : finite.reduce((sum, value) => sum + value, 0);
}

function adrNormalizedPct(trade: Trade) {
  if (trade.adrNormalizedPct !== null && Number.isFinite(trade.adrNormalizedPct)) return trade.adrNormalizedPct;
  if (
    trade.rawPct !== null
    && Number.isFinite(trade.rawPct)
    && trade.adrPct !== null
    && Number.isFinite(trade.adrPct)
    && trade.adrPct > 0
  ) {
    return trade.rawPct / trade.adrPct;
  }
  return null;
}

function matrixRow(trade: Trade): BasketReturnMatrixRow {
  const anchorValue = trade.rawPct === null ? null : { rawPct: trade.rawPct };
  return {
    canonical: trade.anchorType === "canonical" ? anchorValue : null,
    execution: trade.anchorType === "execution" ? anchorValue : null,
    adrPct: trade.adrPct,
  };
}

function warningsForRows(rows: Trade[]) {
  return [...new Set(rows.flatMap((trade) => trade.warnings))].sort((left, right) => left.localeCompare(right));
}

function aggregatePairExtreme(symbol: string, rows: Trade[]): BasketPairExtreme {
  return {
    symbol,
    rawPct: sumNullable(rows.map((trade) => trade.rawPct)),
    adrNormalizedPct: sumNullable(rows.map(adrNormalizedPct)),
  };
}

function pairExtremeSortValue(pair: BasketPairExtreme) {
  return pair.adrNormalizedPct ?? pair.rawPct ?? 0;
}

function bestWorstPairs(rows: Trade[]) {
  const bySymbol = new Map<string, Trade[]>();
  for (const row of rows) {
    const bucket = bySymbol.get(row.symbol) ?? [];
    bucket.push(row);
    bySymbol.set(row.symbol, bucket);
  }
  const pairs = [...bySymbol.entries()].map(([symbol, pairRows]) => aggregatePairExtreme(symbol, pairRows));
  if (pairs.length === 0) return { bestPair: null, worstPair: null };
  const sorted = [...pairs].sort((left, right) => pairExtremeSortValue(right) - pairExtremeSortValue(left));
  return {
    bestPair: sorted[0] ?? null,
    worstPair: sorted[sorted.length - 1] ?? null,
  };
}

function summarizeWeek(weekOpenUtc: string, anchorType: AnchorType, rows: Trade[]): BasketWeekSummary {
  const pairSet = new Set(rows.map((trade) => trade.symbol));
  const { bestPair, worstPair } = bestWorstPairs(rows);
  return {
    weekOpenUtc,
    anchorType,
    totalRawPct: sumNullable(rows.map((trade) => trade.rawPct)),
    totalAdrPct: sumNullable(rows.map(adrNormalizedPct)),
    tradeCount: rows.length,
    pairCount: pairSet.size,
    bestPair,
    worstPair,
    returnRows: rows.map(matrixRow),
    warnings: warningsForRows(rows),
  };
}

function summarizePair(symbol: string, anchorType: AnchorType, rows: Trade[]): BasketPairSummary {
  return {
    symbol,
    anchorType,
    totalRawPct: sumNullable(rows.map((trade) => trade.rawPct)),
    totalAdrPct: sumNullable(rows.map(adrNormalizedPct)),
    strategyCount: new Set(rows.map((trade) => trade.strategyVariant)).size,
    tradeCount: rows.length,
    returnRows: rows.map(matrixRow),
    warnings: warningsForRows(rows),
  };
}

export async function getBasketWeekSummaries({
  strategyVariant,
  anchorType,
  limit,
  offset,
}: BasketWeekOptions): Promise<{ weeks: BasketWeekSummary[]; hasMore: boolean }> {
  const strategyFamily = inferStrategyFamilyFromVariant(strategyVariant);
  const trades = parentBacktestRows(await getTradesForSurface({
    surface: "performance",
    strategyFamily,
    strategyVariant,
    anchorType,
  }));

  const byWeek = new Map<string, Trade[]>();
  for (const trade of trades) {
    const weekOpenUtc = normalizeWeekOpenUtc(trade.weekOpenUtc);
    if (!weekOpenUtc) continue;
    const bucket = byWeek.get(weekOpenUtc) ?? [];
    bucket.push(trade);
    byWeek.set(weekOpenUtc, bucket);
  }

  const allWeeks = [...byWeek.entries()]
    .filter(([, rows]) => rows.length > 0)
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([weekOpenUtc, rows]) => summarizeWeek(weekOpenUtc, anchorType, rows));
  const page = allWeeks.slice(offset, offset + limit);
  return {
    weeks: page,
    hasMore: offset + limit < allWeeks.length,
  };
}

export async function getBasketWeekPairs({
  weekOpenUtc,
  strategyVariant,
  anchorType,
}: BasketPairOptions): Promise<BasketPairSummary[]> {
  const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc);
  if (!normalizedWeek) return [];
  const strategyFamily = inferStrategyFamilyFromVariant(strategyVariant);
  const trades = parentBacktestRows(await getTradesForSurface({
    surface: "performance",
    strategyFamily,
    strategyVariant,
    anchorType,
    weekOpenUtc: normalizedWeek,
  }));

  const bySymbol = new Map<string, Trade[]>();
  for (const trade of trades) {
    const bucket = bySymbol.get(trade.symbol) ?? [];
    bucket.push(trade);
    bySymbol.set(trade.symbol, bucket);
  }

  return [...bySymbol.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([symbol, rows]) => summarizePair(symbol, anchorType, rows));
}
