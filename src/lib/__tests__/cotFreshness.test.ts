import { describe, expect, it } from "vitest";
import { evaluateFreshness } from "../cotFreshness";

describe("evaluateFreshness", () => {
  it("rejects stale report dates", () => {
    const now = new Date("2026-01-20T00:00:00.000Z");
    const result = evaluateFreshness(
      "2026-01-01",
      "2026-01-02T00:00:00.000Z",
      now,
    );
    expect(result.trading_allowed).toBe(false);
  });

  it("accepts fresh report dates with recent refresh", () => {
    const now = new Date("2026-01-08T00:00:00.000Z");
    const result = evaluateFreshness(
      "2026-01-06",
      "2026-01-07T12:00:00.000Z",
      now,
    );
    expect(result.trading_allowed).toBe(true);
  });

  it("accepts refresh after report date even if older than 24h", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const result = evaluateFreshness(
      "2026-01-06",
      "2026-01-07T00:00:00.000Z",
      now,
    );
    expect(result.trading_allowed).toBe(true);
  });
});
