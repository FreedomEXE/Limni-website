/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitgetBotRisk.ts
 *
 * Description:
 * Risk and scaling helpers for Bitget Bot v2. Contains the production
 * DRY_RUN phase ladder logic, breakeven/trailing stop calculations, and
 * deterministic stop-trigger checks.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type Direction = "LONG" | "SHORT";

export type ScalingEvaluation = {
  newLeverage: number;
  newStop: number | null;
  milestone: number;
  shouldAdjust: boolean;
  trailOffsetPct: number | null;
  breakevenReached: boolean;
};

const INITIAL_LEVERAGE = 5;
const MAX_LEVERAGE = 50;
const MILESTONE_LEVELS = [1, 2, 3, 4] as const;
const LEVERAGE_BY_MILESTONE: Record<(typeof MILESTONE_LEVELS)[number], number> = {
  1: 10,
  2: 25,
  3: 50,
  4: 50,
};

// TODO: evaluate 75x cap after Phase 1 paper trading validation.

function clampLeverage(value: number) {
  if (!Number.isFinite(value)) return INITIAL_LEVERAGE;
  return Math.max(1, Math.min(MAX_LEVERAGE, Math.floor(value)));
}

function unleveredMovePct(
  entryPrice: number,
  currentPrice: number,
  direction: Direction,
) {
  if (!(entryPrice > 0) || !(currentPrice > 0)) return 0;
  if (direction === "LONG") {
    return ((currentPrice - entryPrice) / entryPrice) * 100;
  }
  return ((entryPrice - currentPrice) / entryPrice) * 100;
}

function resolveMilestone(movePct: number) {
  if (movePct >= 4) return 4;
  if (movePct >= 3) return 3;
  if (movePct >= 2) return 2;
  if (movePct >= 1) return 1;
  return 0;
}

function resolveTrailOffsetPct(milestone: number): number | null {
  if (milestone >= 4) return 1.0;
  if (milestone >= 3) return 1.5;
  return null;
}

export function computeBreakevenStop(
  entryPrice: number,
  _direction: Direction,
) {
  return entryPrice;
}

export function computeTrailingStop(
  peakPrice: number,
  direction: Direction,
  milestone: number,
) {
  const offsetPct = resolveTrailOffsetPct(milestone);
  if (offsetPct === null || !(peakPrice > 0)) return null;
  if (direction === "LONG") {
    return peakPrice * (1 - offsetPct / 100);
  }
  return peakPrice * (1 + offsetPct / 100);
}

export function shouldClosePosition(
  currentPrice: number,
  stopPrice: number,
  direction: Direction,
) {
  if (!(currentPrice > 0) || !(stopPrice > 0)) return false;
  if (direction === "LONG") {
    return currentPrice <= stopPrice;
  }
  return currentPrice >= stopPrice;
}

export function computeScalingState(
  entryPrice: number,
  currentPrice: number,
  direction: Direction,
  currentMilestone: number,
): ScalingEvaluation {
  const movePct = unleveredMovePct(entryPrice, currentPrice, direction);
  const nextMilestone = resolveMilestone(movePct);
  const shouldAdjust = nextMilestone > currentMilestone;
  const activeMilestone = shouldAdjust ? nextMilestone : currentMilestone;

  const nextLeverage = activeMilestone === 0
    ? INITIAL_LEVERAGE
    : LEVERAGE_BY_MILESTONE[Math.min(4, activeMilestone) as 1 | 2 | 3 | 4];

  const newStop = activeMilestone >= 2
    ? computeBreakevenStop(entryPrice, direction)
    : null;

  return {
    newLeverage: clampLeverage(nextLeverage),
    newStop,
    milestone: activeMilestone,
    shouldAdjust,
    trailOffsetPct: resolveTrailOffsetPct(activeMilestone),
    breakevenReached: activeMilestone >= 2,
  };
}
