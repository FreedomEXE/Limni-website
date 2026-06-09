/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: returnsCalendarMetrics.ts
 *
 * Description:
 * Pure aggregation helpers for calendar P/L and drawdown cells.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { DailySimulationReturn } from "@/components/performance/dailySimulationReturns";
import { computeMaxDrawdownSimple } from "@/lib/performance/drawdown";

export type WeekReturn = {
  weekOpenUtc: string;
  returnPct: number;
  maxDrawdownPct?: number | null;
  trades?: number | null;
};

export type CalendarDrawdownSource = "path" | "week" | "close" | "none";

export type CalendarPeriodMetric = {
  returnPct: number;
  maxDrawdownPct: number | null;
  itemCount: number;
  drawdownSource: CalendarDrawdownSource;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function finiteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function monthKeyFromUtc(value: string): string | null {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

function emptyMetric(): CalendarPeriodMetric {
  return {
    returnPct: 0,
    maxDrawdownPct: null,
    itemCount: 0,
    drawdownSource: "none",
  };
}

function resolveFallbackDrawdown(
  returns: number[],
  periodDrawdowns: Array<number | null | undefined>,
): Pick<CalendarPeriodMetric, "maxDrawdownPct" | "drawdownSource"> {
  const closeDrawdown = computeMaxDrawdownSimple(returns);
  const intraPeriodDrawdown = Math.max(...periodDrawdowns.filter(finiteNumber), 0);
  const maxDrawdownPct = Math.max(closeDrawdown, intraPeriodDrawdown);
  if (maxDrawdownPct <= 0) {
    return { maxDrawdownPct: null, drawdownSource: "none" };
  }
  return {
    maxDrawdownPct,
    drawdownSource: intraPeriodDrawdown >= closeDrawdown && intraPeriodDrawdown > 0 ? "week" : "close",
  };
}

export function aggregateWeekReturnsToMonthMetrics(weeks: WeekReturn[]): Map<string, CalendarPeriodMetric> {
  const groups = new Map<string, WeekReturn[]>();
  for (const week of weeks) {
    if (!Number.isFinite(week.returnPct)) continue;
    const key = monthKeyFromUtc(week.weekOpenUtc);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(week);
  }

  const metrics = new Map<string, CalendarPeriodMetric>();
  for (const [key, group] of groups.entries()) {
    const returns = group.map((week) => week.returnPct);
    const dd = resolveFallbackDrawdown(returns, group.map((week) => week.maxDrawdownPct));
    metrics.set(key, {
      returnPct: returns.reduce((sum, value) => sum + value, 0),
      maxDrawdownPct: dd.maxDrawdownPct,
      itemCount: group.length,
      drawdownSource: dd.drawdownSource,
    });
  }
  return metrics;
}

export function aggregateDailyReturnsToMonthMetrics(days: DailySimulationReturn[]): Map<string, CalendarPeriodMetric> {
  const metrics = new Map<string, CalendarPeriodMetric>();
  for (const day of days) {
    if (!Number.isFinite(day.returnPct)) continue;
    const key = monthKeyFromUtc(`${day.dateKey}T00:00:00.000Z`);
    if (!key) continue;
    const existing = metrics.get(key) ?? emptyMetric();
    const maxDrawdownPct = Math.max(existing.maxDrawdownPct ?? 0, finiteNumber(day.maxDrawdownPct) ? day.maxDrawdownPct : 0);
    metrics.set(key, {
      returnPct: existing.returnPct + day.returnPct,
      maxDrawdownPct: maxDrawdownPct > 0 ? maxDrawdownPct : null,
      itemCount: existing.itemCount + 1,
      drawdownSource: maxDrawdownPct > 0 ? "path" : "none",
    });
  }
  return metrics;
}

export function aggregateWeekReturnsToWeekMetrics(weeks: WeekReturn[]): Map<string, CalendarPeriodMetric> {
  const metrics = new Map<string, CalendarPeriodMetric>();
  for (const week of weeks) {
    if (!Number.isFinite(week.returnPct)) continue;
    const dd = resolveFallbackDrawdown([week.returnPct], [week.maxDrawdownPct]);
    metrics.set(week.weekOpenUtc, {
      returnPct: week.returnPct,
      maxDrawdownPct: dd.maxDrawdownPct,
      itemCount: 1,
      drawdownSource: dd.drawdownSource,
    });
  }
  return metrics;
}

export function aggregateDailyReturnsToWeekMetrics(
  weeks: WeekReturn[],
  days: DailySimulationReturn[],
): Map<string, CalendarPeriodMetric> {
  const fallback = aggregateWeekReturnsToWeekMetrics(weeks);
  const dayRows = days
    .map((day) => ({
      day,
      startMs: Date.parse(`${day.dateKey}T00:00:00.000Z`),
    }))
    .filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.day.returnPct));

  const metrics = new Map<string, CalendarPeriodMetric>();
  for (const week of weeks) {
    const startMs = Date.parse(week.weekOpenUtc);
    if (!Number.isFinite(startMs)) {
      const fallbackMetric = fallback.get(week.weekOpenUtc);
      if (fallbackMetric) metrics.set(week.weekOpenUtc, fallbackMetric);
      continue;
    }

    const endMs = startMs + WEEK_MS;
    const weekDays = dayRows.filter(({ startMs: dayStart }) => (
      dayStart < endMs && dayStart + DAY_MS > startMs
    ));
    if (weekDays.length === 0) {
      const fallbackMetric = fallback.get(week.weekOpenUtc);
      if (fallbackMetric) metrics.set(week.weekOpenUtc, fallbackMetric);
      continue;
    }

    const returnPct = weekDays.reduce((sum, row) => sum + row.day.returnPct, 0);
    const maxDrawdownPct = Math.max(...weekDays.map((row) => row.day.maxDrawdownPct).filter(finiteNumber), 0);
    metrics.set(week.weekOpenUtc, {
      returnPct,
      maxDrawdownPct: maxDrawdownPct > 0 ? maxDrawdownPct : null,
      itemCount: weekDays.length,
      drawdownSource: maxDrawdownPct > 0 ? "path" : "none",
    });
  }
  return metrics;
}
