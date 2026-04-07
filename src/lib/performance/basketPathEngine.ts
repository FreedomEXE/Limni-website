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
import type { WeekPositionLedger } from "@/lib/performance/positionLedger";

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
  return bars.map<PricePoint>((bar) => ({
    tsUtc: bar.barCloseUtc,
    closePrice: bar.closePrice,
    qualityStatus: bar.qualityStatus,
  }));
}

function getMarkedPriceAtTimestamp(
  series: PricePoint[],
  tsUtc: string,
  fallbackPrice: number,
): { price: number; status: "real" | "carried" | "missing" } {
  if (series.length === 0) {
    return Number.isFinite(fallbackPrice) && fallbackPrice > 0
      ? { price: fallbackPrice, status: "carried" }
      : { price: Number.NaN, status: "missing" };
  }

  const tsMs = DateTime.fromISO(tsUtc, { zone: "utc" }).toMillis();
  let lastReal: PricePoint | null = null;
  for (const point of series) {
    const pointMs = DateTime.fromISO(point.tsUtc, { zone: "utc" }).toMillis();
    if (!Number.isFinite(pointMs) || pointMs > tsMs) break;
    lastReal = point;
  }

  if (lastReal) {
    const isExact = lastReal.tsUtc === tsUtc;
    return {
      price: lastReal.closePrice,
      status: isExact ? "real" : "carried",
    };
  }

  return Number.isFinite(fallbackPrice) && fallbackPrice > 0
    ? { price: fallbackPrice, status: "carried" }
    : { price: Number.NaN, status: "missing" };
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

export function computeBasketPath(
  ledger: WeekPositionLedger,
  bars: PathBarMap,
): BasketPathResult {
  const grid = buildCanonicalHourlyGrid(ledger.weekOpenUtc, ledger.weekCloseUtc);
  if (ledger.legs.length === 0) {
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

  const barSeriesBySymbol = new Map<string, PricePoint[]>();
  for (const leg of ledger.legs) {
    if (barSeriesBySymbol.has(leg.symbol)) continue;
    barSeriesBySymbol.set(leg.symbol, buildPriceSeries(bars.get(leg.symbol) ?? []));
  }

  const points: BasketPathPoint[] = [];
  let runningPeakPct = 0;

  for (const tsUtc of grid) {
    const tsMs = DateTime.fromISO(tsUtc, { zone: "utc" }).toMillis();
    let basketEquityPct = 0;
    let activePositions = 0;

    for (const leg of ledger.legs) {
      const entryMs = DateTime.fromISO(leg.entryTimeUtc, { zone: "utc" }).toMillis();
      const exitMs = DateTime.fromISO(leg.exitTimeUtc, { zone: "utc" }).toMillis();
      if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) continue;
      if (tsMs < entryMs || tsMs > exitMs) continue;

      const priceSeries = barSeriesBySymbol.get(leg.symbol) ?? [];
      const marked = getMarkedPriceAtTimestamp(priceSeries, tsUtc, leg.entryPrice);
      let markPrice = marked.price;
      if (tsMs === entryMs) {
        markPrice = leg.entryPrice;
      } else if (tsMs === exitMs) {
        markPrice = leg.exitPrice;
      }

      if (!Number.isFinite(markPrice) || markPrice <= 0 || leg.entryPrice <= 0) {
        continue;
      }

      activePositions += 1;
      const rawReturnPct = ((markPrice - leg.entryPrice) / leg.entryPrice) * 100;
      const directedReturnPct = leg.direction === "SHORT" ? -rawReturnPct : rawReturnPct;
      const legPnlPct = leg.weight * leg.adrMultiplier * directedReturnPct;
      basketEquityPct += legPnlPct;
    }

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
