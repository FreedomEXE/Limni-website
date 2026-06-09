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
  balancePct: number;
  equityPct: number;
  adverseEquityPct: number;
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
  returnMode: BasketPathReturnMode;
  resolution: string;
  points: BasketPathPoint[];
  summary: BasketPathSummary;
};

export type BasketPathReturnMode = "normalized" | "raw" | "display";

type PricePoint = {
  tsUtc: string;
  tsMs: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  qualityStatus: string;
};

type CarriedPricePoint = {
  closePrice: number;
  highPrice: number;
  lowPrice: number;
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
      highPrice: bar.highPrice,
      lowPrice: bar.lowPrice,
      closePrice: bar.closePrice,
      qualityStatus: bar.qualityStatus,
    }))
    .filter((point) => Number.isFinite(point.tsMs))
    .sort((left, right) => left.tsMs - right.tsMs);
}

function buildCarriedPriceSeries(series: PricePoint[], gridMs: number[]) {
  const prices = new Array<CarriedPricePoint>(gridMs.length);
  let cursor = 0;
  let lastPrice = Number.NaN;

  for (let gridIndex = 0; gridIndex < gridMs.length; gridIndex += 1) {
    const tsMs = gridMs[gridIndex] ?? Number.NaN;
    let barForGrid: PricePoint | null = null;
    while (cursor < series.length && (series[cursor]?.tsMs ?? Number.POSITIVE_INFINITY) <= tsMs) {
      const point = series[cursor] ?? null;
      const nextPrice = point?.closePrice ?? Number.NaN;
      if (Number.isFinite(nextPrice) && nextPrice > 0) {
        lastPrice = nextPrice;
        barForGrid = point;
      }
      cursor += 1;
    }
    prices[gridIndex] = {
      closePrice: lastPrice,
      highPrice: Number.isFinite(barForGrid?.highPrice) && (barForGrid?.highPrice ?? 0) > 0
        ? Number(barForGrid?.highPrice)
        : lastPrice,
      lowPrice: Number.isFinite(barForGrid?.lowPrice) && (barForGrid?.lowPrice ?? 0) > 0
        ? Number(barForGrid?.lowPrice)
        : lastPrice,
    };
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
  balanceByIndex: number[],
  equityByIndex: number[],
  adverseEquityByIndex: number[],
  activeByIndex: number[],
  returnMode: BasketPathReturnMode,
): BasketPathResult {
  const points: BasketPathPoint[] = [];
  let runningPeakPct = 0;

  for (let index = 0; index < grid.length; index += 1) {
    const tsUtc = grid[index] ?? ledger.weekOpenUtc;
    const basketBalancePct = balanceByIndex[index] ?? 0;
    const basketEquityPct = equityByIndex[index] ?? 0;
    const basketAdverseEquityPct = adverseEquityByIndex[index] ?? basketEquityPct;
    const activePositions = activeByIndex[index] ?? 0;
    runningPeakPct = Math.max(runningPeakPct, basketEquityPct);
    points.push({
      tsUtc,
      balancePct: basketBalancePct,
      equityPct: basketEquityPct,
      adverseEquityPct: basketAdverseEquityPct,
      peakPct: runningPeakPct,
      drawdownPct: (100 + runningPeakPct) <= 0
        ? -100
        : (((100 + basketAdverseEquityPct) / (100 + runningPeakPct)) - 1) * 100,
      activePositions,
    });
  }

  return {
    weekOpenUtc: ledger.logicalWeekOpenUtc,
    strategyId: ledger.strategyId,
    entryStyleId: ledger.entryStyleId,
    returnMode,
    resolution: "1h",
    points,
    summary: summarizePoints(points),
  };
}

function emptyPathResult(
  ledger: WeekPositionLedger,
  grid: string[],
  returnMode: BasketPathReturnMode,
): BasketPathResult {
  const points = grid.slice(0, 1).map((tsUtc) => ({
    tsUtc,
    balancePct: 0,
    equityPct: 0,
    adverseEquityPct: 0,
    peakPct: 0,
    drawdownPct: 0,
    activePositions: 0,
  }));
  return {
    weekOpenUtc: ledger.logicalWeekOpenUtc,
    strategyId: ledger.strategyId,
    entryStyleId: ledger.entryStyleId,
    returnMode,
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
  returnMode: BasketPathReturnMode = "normalized",
) {
  const grid = buildCanonicalHourlyGrid(ledger.weekOpenUtc, ledger.weekCloseUtc);
  if (ledger.legs.length === 0) {
    return {
      grid,
      balanceByIndex: new Array<number>(grid.length).fill(0),
      equityByIndex: new Array<number>(grid.length).fill(0),
      adverseEquityByIndex: new Array<number>(grid.length).fill(0),
      activeByIndex: new Array<number>(grid.length).fill(0),
      slotBalanceByIndex: Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0)),
      slotEquityByIndex: Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0)),
      slotAdverseEquityByIndex: Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0)),
      slotActiveByIndex: Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0)),
    };
  }

  const gridMs = grid.map((tsUtc) => DateTime.fromISO(tsUtc, { zone: "utc" }).toMillis());
  const priceSeriesBySymbol = new Map<string, CarriedPricePoint[]>();
  for (const leg of ledger.legs) {
    if (priceSeriesBySymbol.has(leg.symbol)) continue;
    priceSeriesBySymbol.set(
      leg.symbol,
      buildCarriedPriceSeries(buildPriceSeries(bars.get(leg.symbol) ?? []), gridMs),
    );
  }

  const balanceByIndex = new Array<number>(grid.length).fill(0);
  const equityByIndex = new Array<number>(grid.length).fill(0);
  const adverseEquityByIndex = new Array<number>(grid.length).fill(0);
  const activeByIndex = new Array<number>(grid.length).fill(0);
  const slotBalanceByIndex = Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0));
  const slotEquityByIndex = Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0));
  const slotAdverseEquityByIndex = Array.from({ length: slotCount }, () => new Array<number>(grid.length).fill(0));
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
    const slotBalance = slotIndex >= 0 && slotIndex < slotCount ? slotBalanceByIndex[slotIndex] : null;
    const slotEquity = slotIndex >= 0 && slotIndex < slotCount ? slotEquityByIndex[slotIndex] : null;
    const slotAdverseEquity = slotIndex >= 0 && slotIndex < slotCount ? slotAdverseEquityByIndex[slotIndex] : null;
    const slotActive = slotIndex >= 0 && slotIndex < slotCount ? slotActiveByIndex[slotIndex] : null;
    const exitRawReturnPct = ((leg.exitPrice - leg.entryPrice) / leg.entryPrice) * 100;
    const exitDirectedReturnPct = leg.direction === "SHORT" ? -exitRawReturnPct : exitRawReturnPct;
    const targetReturnPct = returnMode === "raw"
      ? leg.rawReturnPct
      : returnMode === "normalized"
        ? leg.normalizedReturnPct
        : leg.returnPct;
    const fallbackScale = returnMode === "raw"
      ? leg.weight
      : returnMode === "normalized"
        ? leg.weight * leg.adrMultiplier
        : leg.weight * leg.adrMultiplier;
    const pnlScale = Math.abs(exitDirectedReturnPct) > 1e-9
      ? targetReturnPct / exitDirectedReturnPct
      : fallbackScale;
    const realizedLegPnlPct = targetReturnPct;

    for (let index = startIndex; index <= endIndex; index += 1) {
      const tsMs = gridMs[index] ?? Number.NaN;
      const barPrices = prices[index] ?? null;
      let markPrice = barPrices?.closePrice ?? Number.NaN;
      if (tsMs === exitMs) {
        markPrice = leg.exitPrice;
      } else if (tsMs === entryMs) {
        markPrice = leg.entryPrice;
      } else if (!Number.isFinite(markPrice) || markPrice <= 0) {
        markPrice = leg.entryPrice;
      }

      if (!Number.isFinite(markPrice) || markPrice <= 0) continue;

      activeByIndex[index] = (activeByIndex[index] ?? 0) + 1;
      const rawReturnPct = ((markPrice - leg.entryPrice) / leg.entryPrice) * 100;
      const directedReturnPct = leg.direction === "SHORT" ? -rawReturnPct : rawReturnPct;
      const legPnlPct = pnlScale * directedReturnPct;
      const adversePrice = leg.direction === "SHORT"
        ? (Number.isFinite(barPrices?.highPrice) && (barPrices?.highPrice ?? 0) > 0 ? Number(barPrices?.highPrice) : markPrice)
        : (Number.isFinite(barPrices?.lowPrice) && (barPrices?.lowPrice ?? 0) > 0 ? Number(barPrices?.lowPrice) : markPrice);
      const adverseRawReturnPct = ((adversePrice - leg.entryPrice) / leg.entryPrice) * 100;
      const adverseDirectedReturnPct = leg.direction === "SHORT" ? -adverseRawReturnPct : adverseRawReturnPct;
      const adverseLegPnlPct = pnlScale * adverseDirectedReturnPct;
      equityByIndex[index] = (equityByIndex[index] ?? 0) + legPnlPct;
      adverseEquityByIndex[index] = (adverseEquityByIndex[index] ?? 0) + adverseLegPnlPct;
      if (slotEquity && slotAdverseEquity && slotActive) {
        slotEquity[index] = (slotEquity[index] ?? 0) + legPnlPct;
        slotAdverseEquity[index] = (slotAdverseEquity[index] ?? 0) + adverseLegPnlPct;
        slotActive[index] = (slotActive[index] ?? 0) + 1;
      }
    }

    // Closed trades remain part of portfolio balance/equity after their exit. Without
    // this carry-forward, fast close/rearm systems drop realized P/L from the
    // curve as soon as the fill closes.
    for (let index = endIndex; index < grid.length; index += 1) {
      balanceByIndex[index] = (balanceByIndex[index] ?? 0) + realizedLegPnlPct;
      if (slotBalance) {
        slotBalance[index] = (slotBalance[index] ?? 0) + realizedLegPnlPct;
      }
      if (index > endIndex) {
        equityByIndex[index] = (equityByIndex[index] ?? 0) + realizedLegPnlPct;
        adverseEquityByIndex[index] = (adverseEquityByIndex[index] ?? 0) + realizedLegPnlPct;
      }
      if (slotEquity && slotAdverseEquity && index > endIndex) {
        slotEquity[index] = (slotEquity[index] ?? 0) + realizedLegPnlPct;
        slotAdverseEquity[index] = (slotAdverseEquity[index] ?? 0) + realizedLegPnlPct;
      }
    }
  }

  return {
    grid,
    balanceByIndex,
    equityByIndex,
    adverseEquityByIndex,
    activeByIndex,
    slotBalanceByIndex,
    slotEquityByIndex,
    slotAdverseEquityByIndex,
    slotActiveByIndex,
  };
}

export function computeBasketPath(
  ledger: WeekPositionLedger,
  bars: PathBarMap,
  options: { returnMode?: BasketPathReturnMode } = {},
): BasketPathResult {
  const returnMode = options.returnMode ?? "normalized";
  const arrays = computeBasketPathArrays(ledger, bars, undefined, 0, returnMode);
  if (ledger.legs.length === 0) {
    return emptyPathResult(ledger, arrays.grid, returnMode);
  }
  return buildPathResultFromArrays(
    ledger,
    arrays.grid,
    arrays.balanceByIndex,
    arrays.equityByIndex,
    arrays.adverseEquityByIndex,
    arrays.activeByIndex,
    returnMode,
  );
}

export function computeBasketPathWithSlots(
  ledger: WeekPositionLedger,
  bars: PathBarMap,
  slotFn: (leg: PositionLeg) => number,
  slotCount: number,
  options: { returnMode?: BasketPathReturnMode } = {},
): { path: BasketPathResult; slotPaths: BasketPathResult[] } {
  const returnMode = options.returnMode ?? "normalized";
  const arrays = computeBasketPathArrays(ledger, bars, slotFn, slotCount, returnMode);
  const path = ledger.legs.length === 0
    ? emptyPathResult(ledger, arrays.grid, returnMode)
    : buildPathResultFromArrays(
      ledger,
      arrays.grid,
      arrays.balanceByIndex,
      arrays.equityByIndex,
      arrays.adverseEquityByIndex,
      arrays.activeByIndex,
      returnMode,
    );
  const slotPaths = arrays.slotEquityByIndex.map((slotEquity, slotIndex) =>
    buildPathResultFromArrays(
      ledger,
      arrays.grid,
      arrays.slotBalanceByIndex[slotIndex] ?? new Array<number>(arrays.grid.length).fill(0),
      slotEquity,
      arrays.slotAdverseEquityByIndex[slotIndex] ?? slotEquity,
      arrays.slotActiveByIndex[slotIndex] ?? new Array<number>(arrays.grid.length).fill(0),
      returnMode,
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
  let carryoverBalancePct = 0;
  let runningPeakPct = 0;

  for (let weekIndex = 0; weekIndex < sorted.length; weekIndex += 1) {
    const week = sorted[weekIndex];
    if (!week) continue;

    for (let pointIndex = 0; pointIndex < week.points.length; pointIndex += 1) {
      if (weekIndex > 0 && pointIndex === 0) continue;
      const point = week.points[pointIndex];
      if (!point) continue;
      const shiftedBalancePct = carryoverBalancePct + point.balancePct;
      const shiftedEquityPct = carryoverEquityPct + point.equityPct;
      const shiftedAdverseEquityPct = carryoverEquityPct + point.adverseEquityPct;
      runningPeakPct = Math.max(runningPeakPct, shiftedEquityPct);
      points.push({
        tsUtc: point.tsUtc,
        balancePct: shiftedBalancePct,
        equityPct: shiftedEquityPct,
        adverseEquityPct: shiftedAdverseEquityPct,
        peakPct: runningPeakPct,
        drawdownPct: (100 + runningPeakPct) <= 0
          ? -100
          : (((100 + shiftedAdverseEquityPct) / (100 + runningPeakPct)) - 1) * 100,
        activePositions: point.activePositions,
      });
    }

    carryoverEquityPct += week.summary.totalReturnPct;
    carryoverBalancePct += week.summary.totalReturnPct;
  }

  return {
    points,
    summary: summarizePoints(points),
  };
}
