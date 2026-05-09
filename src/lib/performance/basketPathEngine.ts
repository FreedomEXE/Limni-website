/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketPathEngine.ts
 *
 * Description:
 * Pure basket path engine. Takes a weekly position ledger plus
 * canonical path bars and produces a timestamped basket equity path
 * with peak and drawdown tracking at each step.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import type { PathBarMap } from "@/lib/performance/pathBarLoader";
import type { PositionLeg, WeekPositionLedger } from "@/lib/performance/positionLedger";

export type BasketPathPoint = {
  tsUtc: string;
  equityPct: number;
  peakPct: number;
  drawdownPct: number;
  activePositions: number;
};

export type BasketPathSummary = {
  totalReturnPct: number;
  peakPct: number;
  troughPct: number;
  maxDrawdownPct: number;
  peakToCloseGivebackPct: number;
  troughToCloseRecoveryPct: number;
  maxActivePositions: number;
};

export type BasketPathResult = {
  weekOpenUtc: string;
  strategyId: string;
  entryStyleId: string;
  resolution: string;
  points: BasketPathPoint[];
  summary: BasketPathSummary;
};

type PricePoint = {
  tsUtc: string;
  tsMs: number;
  closePrice: number;
  qualityStatus: string;
};

function buildCanonicalHourlyGrid(weekOpenUtc: string, weekCloseUtc: string) {
  const start = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const end = DateTime.fromISO(weekCloseUtc, { zone: "utc" });
  if (!start.isValid || !end.isValid || end < start) {
    return [weekOpenUtc];
  }

  const timestamps: string[] = [];
  let cursor = start.startOf("hour");
  const final = end.startOf("hour");
  while (cursor <= final) {
    timestamps.push(cursor.toUTC().toISO() ?? weekOpenUtc);
    cursor = cursor.plus({ hours: 1 });
  }
  return timestamps;
}

function buildPriceSeries(bars: CanonicalPriceBar[]) {
  return bars
    .map<PricePoint>((bar) => ({
      tsUtc: bar.barCloseUtc,
      tsMs: DateTime.fromISO(bar.barCloseUtc, { zone: "utc" }).toMillis(),
      closePrice: bar.closePrice,
      qualityStatus: bar.qualityStatus,
    }))
    .filter((point) => Number.isFinite(point.tsMs))
    .sort((left, right) => left.tsMs - right.tsMs);
}

function buildCarriedPriceSeries(series: PricePoint[], gridMs: number[]) {
  const prices = new Array<number>(gridMs.length).fill(Number.NaN);
  let cursor = 0;
  let lastPrice = Number.NaN;

  for (let gridIndex = 0; gridIndex < gridMs.length; gridIndex += 1) {
    const tsMs = gridMs[gridIndex] ?? Number.NaN;
    while (cursor < series.length && (series[cursor]?.tsMs ?? Number.POSITIVE_INFINITY) <= tsMs) {
      const nextPrice = series[cursor]?.closePrice ?? Number.NaN;
      if (Number.isFinite(nextPrice) && nextPrice > 0) {
        lastPrice = nextPrice;
      }
      cursor += 1;
    }
    prices[gridIndex] = lastPrice;
  }

  return prices;
}

function lowerBound(values: number[], target: number) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if ((values[mid] ?? Number.POSITIVE_INFINITY) < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

function upperBound(values: number[], target: number) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if ((values[mid] ?? Number.POSITIVE_INFINITY) <= target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

function summarizePoints(points: BasketPathPoint[]): BasketPathSummary {
  if (points.length === 0) {
    return {
      totalReturnPct: 0,
      peakPct: 0,
      troughPct: 0,
      maxDrawdownPct: 0,
      peakToCloseGivebackPct: 0,
      troughToCloseRecoveryPct: 0,
      maxActivePositions: 0,
    };
  }

  const totalReturnPct = points[points.length - 1]?.equityPct ?? 0;
  const peakPct = Math.max(...points.map((point) => point.equityPct));
  const troughPct = Math.min(...points.map((point) => point.equityPct));
  const maxActivePositions = Math.max(...points.map((point) => point.activePositions));
  const mostNegativeDrawdown = Math.min(...points.map((point) => point.drawdownPct));
  const maxDrawdownPct = Math.abs(mostNegativeDrawdown);

  return {
    totalReturnPct,
    peakPct,
    troughPct,
    maxDrawdownPct,
    peakToCloseGivebackPct: peakPct - totalReturnPct,
    troughToCloseRecoveryPct: totalReturnPct - troughPct,
    maxActivePositions,
  };
}

function buildPathResultFromArrays(
  ledger: WeekPositionLedger,
  grid: string[],
  equityByIndex: number[],
  activeByIndex: number[],
): BasketPathResult {
  const points: BasketPathPoint[] = [];
  let runningPeakPct = 0;

  for (let index = 0; index < grid.length; index += 1) {
    const tsUtc = grid[index] ?? ledger.weekOpenUtc;
    const basketEquityPct = equityByIndex[index] ?? 0;
    const activePositions = activeByIndex[index] ?? 0;
    runningPeakPct = Math.max(runningPeakPct, basketEquityPct);
    points.push({
      tsUtc,
      equityPct: basketEquityPct,
      peakPct: runningPeakPct,
      drawdownPct: basketEquityPct - runningPeakPct,
      activePositions,
    });
  }

  return {
    weekOpenUtc: ledger.weekOpenUtc,
    strategyId: ledger.strategyId,
    entryStyleId: ledger.entryStyleId,
    resolution: "1h",
    points,
    summary: summarizePoints(points),
  };
}

function emptyPathResult(ledger: WeekPositionLedger, grid: string[]): BasketPathResult {
  const points = grid.slice(0, 1).map((tsUtc) => ({
    tsUtc,
    equityPct: 0,
    peakPct: 0,
    drawdownPct: 0,
    activePositions: 0,
  }));
  return {
    weekOpenUtc: ledger.weekOpenUtc,
    strategyId: ledger.strategyId,
    entryStyleId: ledger.entryStyleId,
    resolution: "1h",
    points,
    summary: summarizePoints(points),
  };
}

function computeBasketPathArrays(
  ledger: WeekPositionLedger,
  bars: PathBarMap,
  slotFn?: (leg: PositionLeg) => number,
  slotCount = 0,
) {
  const grid = buildCanonicalHourlyGrid(ledger.weekOpenUtc, ledger.weekCloseUtc);
  if (ledger.legs.length === 0) {
    return {
      grid,
      equityByIndex: new Array<number>(grid.length).fill(0),
      activeByIndex: new Array<number>(grid.length).fill(0),
      slotEquityByIndex: Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0)),
      slotActiveByIndex: Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0)),
    };
  }

  const gridMs = grid.map((tsUtc) => DateTime.fromISO(tsUtc, { zone: "utc" }).toMillis());
  const priceSeriesBySymbol = new Map<string, number[]>();
  for (const leg of ledger.legs) {
    if (priceSeriesBySymbol.has(leg.symbol)) continue;
    priceSeriesBySymbol.set(
      leg.symbol,
      buildCarriedPriceSeries(buildPriceSeries(bars.get(leg.symbol) ?? []), gridMs),
    );
  }

  const equityByIndex = new Array<number>(grid.length).fill(0);
  const activeByIndex = new Array<number>(grid.length).fill(0);
  const slotEquityByIndex = Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0));
  const slotActiveByIndex = Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0));

  for (const leg of ledger.legs) {
    const entryMs = DateTime.fromISO(leg.entryTimeUtc, { zone: "utc" }).toMillis();
    const exitMs = DateTime.fromISO(leg.exitTimeUtc, { zone: "utc" }).toMillis();
    if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) continue;
    if (leg.entryPrice <= 0 || !Number.isFinite(leg.entryPrice)) continue;

    const startIndex = lowerBound(gridMs, entryMs);
    const endIndex = upperBound(gridMs, exitMs) - 1;
    if (startIndex >= grid.length || endIndex < startIndex) continue;

    const prices = priceSeriesBySymbol.get(leg.symbol) ?? [];
    const slotIndex = slotFn ? slotFn(leg) : -1;
    const slotEquity = slotIndex >= 0 && slotIndex < slotCount ? slotEquityByIndex[slotIndex] : null;
    const slotActive = slotIndex >= 0 && slotIndex < slotCount ? slotActiveByIndex[slotIndex] : null;

    for (let index = startIndex; index <= endIndex; index += 1) {
      const tsMs = gridMs[index] ?? Number.NaN;
      let markPrice = prices[index] ?? Number.NaN;
      if (tsMs === entryMs) {
        markPrice = leg.entryPrice;
      } else if (tsMs === exitMs) {
        markPrice = leg.exitPrice;
      } else if (!Number.isFinite(markPrice) || markPrice <= 0) {
        markPrice = leg.entryPrice;
      }

      if (!Number.isFinite(markPrice) || markPrice <= 0) continue;

      activeByIndex[index] = (activeByIndex[index] ?? 0) + 1;
      const rawReturnPct = ((markPrice - leg.entryPrice) / leg.entryPrice) * 100;
      const directedReturnPct = leg.direction === "SHORT" ? -rawReturnPct : rawReturnPct;
      const legPnlPct = leg.weight * leg.adrMultiplier * directedReturnPct;
      equityByIndex[index] = (equityByIndex[index] ?? 0) + legPnlPct;
      if (slotEquity && slotActive) {
        slotEquity[index] = (slotEquity[index] ?? 0) + legPnlPct;
        slotActive[index] = (slotActive[index] ?? 0) + 1;
      }
    }
  }

  return {
    grid,
    equityByIndex,
    activeByIndex,
    slotEquityByIndex,
    slotActiveByIndex,
  };
}

export function computeBasketPath(
  ledger: WeekPositionLedger,
  bars: PathBarMap,
): BasketPathResult {
  const arrays = computeBasketPathArrays(ledger, bars);
  if (ledger.legs.length === 0) {
    return emptyPathResult(ledger, arrays.grid);
  }
  return buildPathResultFromArrays(ledger, arrays.grid, arrays.equityByIndex, arrays.activeByIndex);
}

export function computeBasketPathWithSlots(
  ledger: WeekPositionLedger,
  bars: PathBarMap,
  slotFn: (leg: PositionLeg) => number,
  slotCount: number,
): { path: BasketPathResult; slotPaths: BasketPathResult[] } {
  const arrays = computeBasketPathArrays(ledger, bars, slotFn, slotCount);
  const path = ledger.legs.length === 0
    ? emptyPathResult(ledger, arrays.grid)
    : buildPathResultFromArrays(ledger, arrays.grid, arrays.equityByIndex, arrays.activeByIndex);
  const slotPaths = arrays.slotEquityByIndex.map((slotEquity, slotIndex) =>
    buildPathResultFromArrays(
      ledger,
      arrays.grid,
      slotEquity,
      arrays.slotActiveByIndex[slotIndex] ?? new Array<number>(arrays.grid.length).fill(0),
    ),
  );
  return { path, slotPaths };
}

export function computeMultiWeekBasketPath(
  weekResults: BasketPathResult[],
): {
  points: BasketPathPoint[];
  summary: BasketPathSummary;
} {
  const sorted = [...weekResults].sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
  const points: BasketPathPoint[] = [];
  let carryoverEquityPct = 0;
  let runningPeakPct = 0;

  for (let weekIndex = 0; weekIndex < sorted.length; weekIndex += 1) {
    const week = sorted[weekIndex];
    if (!week) continue;

    for (let pointIndex = 0; pointIndex < week.points.length; pointIndex += 1) {
      if (weekIndex > 0 && pointIndex === 0) continue;
      const point = week.points[pointIndex];
      if (!point) continue;
      const shiftedEquityPct = carryoverEquityPct + point.equityPct;
      runningPeakPct = Math.max(runningPeakPct, shiftedEquityPct);
      points.push({
        tsUtc: point.tsUtc,
        equityPct: shiftedEquityPct,
        peakPct: runningPeakPct,
        drawdownPct: shiftedEquityPct - runningPeakPct,
        activePositions: point.activePositions,
      });
    }

    carryoverEquityPct += week.summary.totalReturnPct;
  }

  return {
    points,
    summary: summarizePoints(points),
  };
}
