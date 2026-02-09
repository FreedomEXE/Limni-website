import { describe, expect, test } from "vitest";
import { combinePerformanceModelTotals } from "@/lib/performance/pageTotals";
import type { PerformanceModel } from "@/lib/performanceLab";

describe("performance page totals helpers", () => {
  const models: PerformanceModel[] = ["sentiment", "dealer"];

  test("combines per-asset model totals without labels", () => {
    const totals = combinePerformanceModelTotals({
      models,
      perAsset: [
        {
          assetLabel: "FX",
          results: [
            {
              model: "sentiment",
              percent: 1,
              priced: 2,
              total: 2,
              note: "ok",
              returns: [{ pair: "AUDUSD", percent: 0.5 }],
              pair_details: [{ pair: "AUDUSD", direction: "LONG", reason: [], percent: 0.5 }],
            },
          ],
        },
        {
          assetLabel: "Metals",
          results: [
            {
              model: "sentiment",
              percent: -0.2,
              priced: 1,
              total: 1,
              note: "ok",
              returns: [{ pair: "XAUUSD", percent: -0.2 }],
              pair_details: [{ pair: "XAUUSD", direction: "SHORT", reason: [], percent: -0.2 }],
            },
          ],
        },
      ],
    });
    expect(totals[0]?.percent).toBeCloseTo(0.8);
    expect(totals[0]?.priced).toBe(3);
    expect(totals[0]?.returns.map((r) => r.pair)).toEqual(["AUDUSD", "XAUUSD"]);
  });

  test("adds asset labels and optional trailing payloads", () => {
    const totals = combinePerformanceModelTotals({
      models,
      perAsset: [
        {
          assetLabel: "FX",
          results: [
            {
              model: "sentiment",
              percent: 1,
              priced: 1,
              total: 1,
              returns: [{ pair: "EURUSD", percent: 1 }],
              pair_details: [{ pair: "EURUSD", direction: "LONG", reason: [], percent: 1 }],
            },
          ],
        },
      ],
      labelWithAsset: true,
      trailingByCombinedModel: { "combined:sentiment": { trailLockPct: 1 } },
    });
    expect(totals[0]?.returns[0]?.pair).toBe("EURUSD (FX)");
    expect(totals[0]?.trailing).toEqual({ trailLockPct: 1 });
  });
});
