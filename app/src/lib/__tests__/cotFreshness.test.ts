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

  it("blocks after Friday 3:30 PM ET when weekly report is still old", () => {
    const now = new Date("2026-02-13T20:31:00.000Z"); // Friday 15:31 ET
    const result = evaluateFreshness(
      "2026-02-03",
      "2026-02-13T20:29:00.000Z",
      now,
    );
    expect(result.trading_allowed).toBe(false);
    expect(result.reason).toBe("awaiting weekly CFTC update");
    expect(result.expected_report_date).toBe("2026-02-10");
  });

  it("allows right before Friday 3:30 PM ET with prior weekly report", () => {
    const now = new Date("2026-02-13T20:29:00.000Z"); // Friday 15:29 ET
    const result = evaluateFreshness(
      "2026-02-03",
      "2026-02-13T20:20:00.000Z",
      now,
    );
    expect(result.trading_allowed).toBe(true);
  });
});
