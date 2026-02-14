import { describe, expect, it } from "vitest";
import { buildAllTimePerformance, buildAllTimeStats } from "@/lib/performance/allTime";
import type { PerformanceModel } from "@/lib/performanceLab";

const MODELS: PerformanceModel[] = [
  "antikythera",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
];

describe("performance/allTime", () => {
  it("aggregates only closed historical weeks", () => {
    const rows = [
      { week_open_utc: "2026-01-19T00:00:00.000Z", model: "sentiment" as const, percent: 2 },
      { week_open_utc: "2026-01-19T00:00:00.000Z", model: "sentiment" as const, percent: 1 },
      { week_open_utc: "2026-01-26T00:00:00.000Z", model: "sentiment" as const, percent: -3 },
      { week_open_utc: "2026-02-09T00:00:00.000Z", model: "sentiment" as const, percent: 10 }, // current week, ignored
    ];

    const currentWeekMillis = Date.parse("2026-02-09T00:00:00.000Z");
    const nowUtcMillis = Date.parse("2026-02-12T00:00:00.000Z");
    const stats = buildAllTimeStats(rows, MODELS, currentWeekMillis, nowUtcMillis);
    const sentiment = stats.find((entry) => entry.model === "sentiment");

    expect(sentiment).toBeDefined();
    expect(sentiment?.totalPercent).toBe(0);
    expect(sentiment?.weeks).toBe(2);
    expect(sentiment?.winRate).toBe(50);
    expect(sentiment?.avgWeekly).toBe(0);
  });

  it("builds all-time performance rows with week labels", () => {
    const rows = [
      { week_open_utc: "2026-01-19T00:00:00.000Z", model: "dealer" as const, percent: 1.25 },
      { week_open_utc: "2026-01-26T00:00:00.000Z", model: "dealer" as const, percent: -0.25 },
    ];
    const currentWeekMillis = Date.parse("2026-02-09T00:00:00.000Z");
    const nowUtcMillis = Date.parse("2026-02-12T00:00:00.000Z");
    const performance = buildAllTimePerformance(rows, MODELS, currentWeekMillis, nowUtcMillis);
    const dealer = performance.find((entry) => entry.model === "dealer");

    expect(dealer).toBeDefined();
    expect(dealer?.percent).toBe(1);
    expect(dealer?.priced).toBe(2);
    expect(dealer?.total).toBe(2);
    expect(dealer?.returns).toHaveLength(2);
    expect(dealer?.note).toBe("All-time aggregation");
  });

  it("merges legacy and canonical rows into one logical week", () => {
    const rows = [
      { week_open_utc: "2026-02-09T00:00:00.000Z", model: "blended" as const, percent: 1.0 }, // canonical
      { week_open_utc: "2026-02-09T05:00:00.000Z", model: "blended" as const, percent: 2.0 }, // legacy
      { week_open_utc: "2026-01-26T00:00:00.000Z", model: "blended" as const, percent: -0.5 },
    ];
    const currentWeekMillis = Date.parse("2026-02-16T00:00:00.000Z");
    const nowUtcMillis = Date.parse("2026-02-18T00:00:00.000Z");
    const performance = buildAllTimePerformance(rows, MODELS, currentWeekMillis, nowUtcMillis);
    const blended = performance.find((entry) => entry.model === "blended");

    expect(blended).toBeDefined();
    expect(blended?.returns).toHaveLength(2);
    expect(blended?.returns.map((item) => item.pair)).toEqual([
      "Week of Feb 09, 2026",
      "Week of Jan 26, 2026",
    ]);
    expect(blended?.percent).toBe(2.5);
  });
});
