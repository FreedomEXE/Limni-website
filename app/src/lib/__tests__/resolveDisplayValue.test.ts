import { describe, expect, test } from "vitest";
import { resolveDisplayDrawdown, resolveDisplayReturn } from "@/lib/viewMode/resolveDisplayValue";

describe("resolveDisplayReturn", () => {
  test("does not fall back to raw return when ADR-normalized mode lacks ADR context", () => {
    expect(resolveDisplayReturn({
      canonical: { rawPct: 0.04 },
      execution: { rawPct: 0.04 },
      adrPct: null,
    }, {
      anchor: "execution",
      normalization: "adr_normalized",
    })).toBeNull();

    expect(resolveDisplayReturn({
      canonical: { rawPct: 0.04 },
      execution: { rawPct: 0.04 },
      adrPct: null,
    }, {
      anchor: "execution",
      normalization: "raw",
    })).toBe(0.04);
  });
});

describe("resolveDisplayDrawdown", () => {
  test("resolves MAE in raw and ADR-normalized modes", () => {
    const riskMatrix = {
      canonical: {
        maeRawPct: 0.125,
        pathDrawdownRawPct: null,
      },
      execution: {
        maeRawPct: 0.25,
        pathDrawdownRawPct: 0.4,
      },
      adrPct: 0.5,
    };

    expect(resolveDisplayDrawdown(riskMatrix, {
      anchor: "execution",
      normalization: "raw",
    }, "mae")).toBe(0.25);

    expect(resolveDisplayDrawdown(riskMatrix, {
      anchor: "execution",
      normalization: "adr_normalized",
    }, "mae")).toBe(0.5);

    expect(resolveDisplayDrawdown(riskMatrix, {
      anchor: "execution",
      normalization: "adr_normalized",
    }, "pathDrawdown")).toBe(0.8);
  });
});
