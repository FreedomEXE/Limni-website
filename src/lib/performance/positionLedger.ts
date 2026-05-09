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

import { DateTime } from "luxon";
import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";

export type PositionLeg = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  entryTimeUtc: string;
  exitTimeUtc: string;
  weight: number;
  adrMultiplier: number;
  entryPrice: number;
  exitPrice: number;
  strategyId: string;
  entryStyleId: string;
  source: string;
  tier: number | null;
};

export type WeekPositionLedger = {
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

export async function buildWeeklyHoldLedger(
  result: WeeklyHoldResult,
  options?: { entryStyleId?: string },
): Promise<WeekPositionLedger> {
  const entryStyleId = options?.entryStyleId ?? "weekly_hold";
  const weekOpen = DateTime.fromISO(result.weekOpenUtc, { zone: "utc" });
  const weekCloseUtc = (weekOpen.isValid
    ? weekOpen.plus({ weeks: 1 }).toUTC().toISO()
    : null) ?? result.weekOpenUtc;

  const validTrades = result.trades.filter((trade) => {
    if (isValidTrade(trade)) return true;
    console.warn(
      `[positionLedger] Skipping invalid trade open price for ${result.biasSourceId} ${result.weekOpenUtc} ${trade.symbol}`,
    );
    return false;
  });

  const targetAdrPct = getTargetAdrPct();
  const needsAdrLookup = validTrades.some((trade) => !(trade.detail?.adrPct && trade.detail.adrPct > 0));
  const adrMap = needsAdrLookup ? await loadWeeklyAdrMap(result.weekOpenUtc) : new Map();
  const legs: PositionLeg[] = validTrades.map((trade) => {
    const pairAdrPct = trade.detail?.adrPct && trade.detail.adrPct > 0
      ? trade.detail.adrPct
      : getAdrPct(adrMap, trade.symbol, trade.assetClass);
    const adrMultiplier = targetAdrPct / pairAdrPct;

    return {
      symbol: trade.symbol.toUpperCase(),
      assetClass: trade.assetClass,
      direction: trade.direction,
      entryTimeUtc: trade.detail?.entryTimeUtc ?? result.weekOpenUtc,
      exitTimeUtc: trade.detail?.exitTimeUtc ?? weekCloseUtc,
      weight: trade.weight ?? 1,
      adrMultiplier,
      entryPrice: trade.openPrice,
      exitPrice: trade.closePrice,
      strategyId: result.biasSourceId,
      entryStyleId,
      source: trade.source,
      tier: trade.tier,
    };
  });

  return {
    weekOpenUtc: result.weekOpenUtc,
    weekCloseUtc,
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
    weekOpenUtc: ledger.weekOpenUtc,
    weekCloseUtc: ledger.weekCloseUtc,
    strategyId: ledger.strategyId,
    entryStyleId: ledger.entryStyleId,
    legs: ledger.legs.filter((leg) => slotFn(leg) === slotIndex),
  }));
}
