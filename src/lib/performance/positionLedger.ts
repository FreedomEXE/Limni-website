/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: positionLedger.ts
 *
 * Description:
 * Build a normalized weekly position ledger from the existing
 * WeeklyHoldResult so the basket path engine can mark positions
 * to market on a canonical hourly grid.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";

export type PositionLeg = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  entryTimeUtc: string;
  exitTimeUtc: string;
  weight: number;
  adrPct: number;
  adrMultiplier: number;
  rawReturnPct: number;
  normalizedReturnPct: number;
  displayReturnPct: number;
  returnPct: number;
  entryPrice: number;
  exitPrice: number;
  strategyId: string;
  entryStyleId: string;
  source: string;
  tier: number | null;
};

export type WeekPositionLedger = {
  logicalWeekOpenUtc: string;
  weekOpenUtc: string;
  weekCloseUtc: string;
  strategyId: string;
  entryStyleId: string;
  legs: PositionLeg[];
};

function isValidTrade(trade: WeeklyHoldTrade) {
  return (
    Number.isFinite(trade.openPrice) &&
    trade.openPrice > 0 &&
    Number.isFinite(trade.closePrice) &&
    trade.closePrice > 0
  );
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finiteOrUndefined(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function buildWeeklyHoldLedger(
  result: WeeklyHoldResult,
  options?: { entryStyleId?: string },
): Promise<WeekPositionLedger> {
  const entryStyleId = options?.entryStyleId ?? "weekly_hold";
  const ledgerOpenUtc = result.executionWindowOpenUtc ?? result.weekOpenUtc;
  const ledgerCloseUtc = result.executionWindowCloseUtc ?? ledgerOpenUtc;

  const validTrades = result.trades.filter((trade) => {
    if (isValidTrade(trade)) return true;
    console.warn(
      `[positionLedger] Skipping invalid trade open price for ${result.biasSourceId} ${result.weekOpenUtc} ${trade.symbol}`,
    );
    return false;
  });

  const targetAdrPct = getTargetAdrPct();
  const needsAdrLookup = validTrades.some((trade) => {
    return !isPositiveFinite(trade.adrPct) && !isPositiveFinite(trade.detail?.adrPct);
  });
  const adrMap = needsAdrLookup ? await loadWeeklyAdrMap(result.weekOpenUtc) : new Map();
  const legs: PositionLeg[] = validTrades.map((trade) => {
    const detailAdrPct = trade.detail?.adrPct;
    const pairAdrPct = isPositiveFinite(trade.adrPct)
      ? trade.adrPct
      : isPositiveFinite(detailAdrPct)
        ? detailAdrPct
        : getAdrPct(adrMap, trade.symbol, trade.assetClass);
    const tradeAdrMultiplier = trade.adrMultiplier;
    const adrMultiplier = isPositiveFinite(tradeAdrMultiplier)
      ? tradeAdrMultiplier
      : targetAdrPct / pairAdrPct;
    const rawReturnPct = finiteOrUndefined(trade.rawReturnPct)
      ?? (
        adrMultiplier !== 0
          ? trade.returnPct / adrMultiplier
          : trade.returnPct
      );
    const normalizedReturnPct = finiteOrUndefined(trade.normalizedReturnPct)
      ?? rawReturnPct * adrMultiplier;
    const displayReturnPct = finiteOrUndefined(trade.displayReturnPct) ?? trade.returnPct;

    return {
      symbol: trade.symbol.toUpperCase(),
      assetClass: trade.assetClass,
      direction: trade.direction,
      entryTimeUtc: trade.detail?.entryTimeUtc ?? ledgerOpenUtc,
      exitTimeUtc: trade.detail?.exitTimeUtc ?? ledgerCloseUtc,
      weight: trade.weight ?? 1,
      adrPct: pairAdrPct,
      adrMultiplier,
      rawReturnPct,
      normalizedReturnPct,
      displayReturnPct,
      returnPct: displayReturnPct,
      entryPrice: trade.openPrice,
      exitPrice: trade.closePrice,
      strategyId: result.biasSourceId,
      entryStyleId,
      source: trade.source,
      tier: trade.tier,
    };
  });

  return {
    logicalWeekOpenUtc: result.weekOpenUtc,
    weekOpenUtc: ledgerOpenUtc,
    weekCloseUtc: ledgerCloseUtc,
    strategyId: result.biasSourceId,
    entryStyleId,
    legs,
  };
}

export function splitLedgerBySlot(
  ledger: WeekPositionLedger,
  slotFn: (leg: PositionLeg) => number,
  slotCount: number,
): WeekPositionLedger[] {
  return Array.from({ length: slotCount }, (_, slotIndex) => ({
    logicalWeekOpenUtc: ledger.logicalWeekOpenUtc,
    weekOpenUtc: ledger.weekOpenUtc,
    weekCloseUtc: ledger.weekCloseUtc,
    strategyId: ledger.strategyId,
    entryStyleId: ledger.entryStyleId,
    legs: ledger.legs.filter((leg) => slotFn(leg) === slotIndex),
  }));
}
