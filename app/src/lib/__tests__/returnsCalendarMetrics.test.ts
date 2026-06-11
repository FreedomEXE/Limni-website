import { describe, expect, it } from "vitest";
import {
  aggregateDailyReturnsToMonthMetrics,
  aggregateDailyReturnsToWeekMetrics,
  aggregateWeekReturnsToMonthMetrics,
  aggregateWeekReturnsToWeekMetrics,
  type WeekReturn,
} from "@/components/performance/returnsCalendarMetrics";
import type { DailySimulationReturn } from "@/components/performance/dailySimulationReturns";

describe("returnsCalendarMetrics", () => {
  const weeks: WeekReturn[] = [
    { weekOpenUtc: "2026-01-05T00:00:00.000Z", returnPct: 2, maxDrawdownPct: 0.4, trades: 3 },
    { weekOpenUtc: "2026-01-12T00:00:00.000Z", returnPct: -1, maxDrawdownPct: 1.25, trades: 2 },
    { weekOpenUtc: "2026-01-19T00:00:00.000Z", returnPct: 3, maxDrawdownPct: null, trades: 1 },
  ];

  it("aggregates monthly fallback P/L additively and uses the worst weekly/path drawdown available", () => {
    const result = aggregateWeekReturnsToMonthMetrics(weeks).get("2026-0");

    expect(result?.returnPct).toBe(4);
    expect(result?.maxDrawdownPct).toBeCloseTo(1.25, 6);
    expect(result?.drawdownSource).toBe("week");
    expect(result?.itemCount).toBe(3);
  });

  it("keeps week fallback DD honest when only close-to-close movement exists", () => {
    const result = aggregateWeekReturnsToWeekMetrics([
      { weekOpenUtc: "2026-02-02T00:00:00.000Z", returnPct: -2, maxDrawdownPct: null },
    ]).get("2026-02-02T00:00:00.000Z");

    expect(result?.returnPct).toBe(-2);
    expect(result?.maxDrawdownPct).toBe(2);
    expect(result?.drawdownSource).toBe("close");
  });

  it("aggregates path-derived daily metrics for monthly calendar cells", () => {
    const days: DailySimulationReturn[] = [
      { dateKey: "2026-03-02", dayLabel: "Mon", returnPct: 0.6, maxDrawdownPct: 0.2, activePositions: 1 },
      { dateKey: "2026-03-03", dayLabel: "Tue", returnPct: -0.4, maxDrawdownPct: 0.9, activePositions: 2 },
      { dateKey: "2026-03-31", dayLabel: "Tue", returnPct: 1.1, maxDrawdownPct: 0.3, activePositions: 0 },
    ];

    const result = aggregateDailyReturnsToMonthMetrics(days).get("2026-2");

    expect(result?.returnPct).toBeCloseTo(1.3, 6);
    expect(result?.maxDrawdownPct).toBe(0.9);
    expect(result?.drawdownSource).toBe("path");
    expect(result?.itemCount).toBe(3);
  });

  it("uses path-derived daily metrics for weekly calendar cells when available", () => {
    const days: DailySimulationReturn[] = [
      { dateKey: "2026-04-06", dayLabel: "Mon", returnPct: 0.8, maxDrawdownPct: 0.1, activePositions: 1 },
      { dateKey: "2026-04-07", dayLabel: "Tue", returnPct: -0.3, maxDrawdownPct: 0.7, activePositions: 2 },
    ];
    const result = aggregateDailyReturnsToWeekMetrics([
      { weekOpenUtc: "2026-04-06T00:00:00.000Z", returnPct: 5, maxDrawdownPct: 3 },
    ], days).get("2026-04-06T00:00:00.000Z");

    expect(result?.returnPct).toBeCloseTo(0.5, 6);
    expect(result?.maxDrawdownPct).toBe(0.7);
    expect(result?.drawdownSource).toBe("path");
  });
});
