import { describe, expect, test } from "vitest";
import {
  buildManualExecutionRows,
  manualRiskMultiplier,
  resolveManualRiskProfile,
} from "@/lib/accounts/manualExecutionSheet";

describe("manual execution sheet", () => {
  test("maps risk modes to expected multipliers", () => {
    expect(manualRiskMultiplier("god")).toBe(1);
    expect(manualRiskMultiplier("normal")).toBe(0.25);
    expect(manualRiskMultiplier("low")).toBe(0.1);
  });

  test("normalizes legacy risk strings", () => {
    expect(resolveManualRiskProfile("1:1")).toBe("god");
    expect(resolveManualRiskProfile("HIGH")).toBe("god");
    expect(resolveManualRiskProfile("low")).toBe("low");
    expect(resolveManualRiskProfile("normal")).toBe("normal");
  });

  test("builds rows from planned pairs with agreement scaling", () => {
    const rows = buildManualExecutionRows({
      equity: 10000,
      riskProfile: "normal",
      plannedPairs: [
        {
          symbol: "EURUSD",
          net: -3,
          entryPrice: 1.08,
          legs: [
            { model: "sentiment", direction: "SHORT" },
            { model: "commercial", direction: "SHORT" },
            { model: "dealer", direction: "SHORT" },
          ],
        },
        {
          symbol: "AUDUSD",
          net: 0,
          entryPrice: 0.66,
          legs: [{ model: "sentiment", direction: "LONG" }],
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.symbol).toBe("EURUSD");
    expect(rows[0]?.side).toBe("SELL");
    expect(rows[0]?.agreementCount).toBe(3);
    expect(rows[0]?.lots).toBeGreaterThan(0);
  });
});

