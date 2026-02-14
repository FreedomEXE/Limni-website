import { describe, expect, test } from "vitest";
import { buildDataWeekOptions, resolveWeekSelection } from "@/lib/weekOptions";

describe("weekOptions", () => {
  test("collapses legacy and canonical timestamps to one logical week", () => {
    const options = buildDataWeekOptions({
      historicalWeeks: [
        "2026-02-09T05:00:00.000Z", // legacy Monday 00:00 ET
        "2026-02-09T00:00:00.000Z", // canonical Sunday 19:00 ET
        "2026-02-02T00:00:00.000Z",
      ],
      currentWeekOpenUtc: "2026-02-16T00:00:00.000Z",
      includeAll: false,
      limit: 4,
    });

    expect(options).toEqual([
      "2026-02-16T00:00:00.000Z",
      "2026-02-09T00:00:00.000Z",
      "2026-02-02T00:00:00.000Z",
    ]);
  });

  test("resolves legacy requested week to canonical option", () => {
    const selected = resolveWeekSelection({
      requestedWeek: "2026-02-09T05:00:00.000Z",
      weekOptions: ["2026-02-16T00:00:00.000Z", "2026-02-09T00:00:00.000Z"],
      currentWeekOpenUtc: "2026-02-16T00:00:00.000Z",
      allowAll: false,
    });

    expect(selected).toBe("2026-02-09T00:00:00.000Z");
  });
});
