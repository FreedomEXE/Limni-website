import { describe, expect, it } from "vitest";

import {
  ACTIVE_BASELINE_ID,
  ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
  ACTIVE_BASELINE_SEED_HISTORY_WINDOW,
  buildActiveBaselineManifest,
  getActiveBaselineSeedWeeks,
  getActiveBaselineSelectableWeeks,
  getActiveBaselineWeeks,
} from "@/lib/appTruth/activeBaseline";
import { releaseManifest } from "@/lib/version/releaseManifest";

describe("app truth active baseline", () => {
  it("keeps the verified seed window immutable but separate from active history", () => {
    const seedWeeks = getActiveBaselineSeedWeeks();

    expect(seedWeeks).toHaveLength(14);
    expect(seedWeeks[0]).toBe("2026-02-23T00:00:00.000Z");
    expect(seedWeeks.at(-1)).toBe("2026-05-24T23:00:00.000Z");
    expect(ACTIVE_BASELINE_SEED_HISTORY_WINDOW).toBe("seed-window");
  });

  it("promotes the previous closed week into active expected history and excludes the live week", () => {
    const weeks = getActiveBaselineWeeks("2026-06-07T23:00:00.000Z");

    expect(weeks).toHaveLength(15);
    expect(weeks.at(-1)).toBe("2026-05-31T23:00:00.000Z");
    expect(weeks).toContain("2026-05-31T23:00:00.000Z");
    expect(weeks).not.toContain("2026-06-07T23:00:00.000Z");
  });

  it("keeps the current live week selectable without making it closed-certified history", () => {
    const selectableWeeks = getActiveBaselineSelectableWeeks("2026-06-07T23:00:00.000Z");
    const closedWeeks = getActiveBaselineWeeks("2026-06-07T23:00:00.000Z");

    expect(selectableWeeks[0]).toBe("2026-06-07T23:00:00.000Z");
    expect(selectableWeeks).toContain("2026-05-31T23:00:00.000Z");
    expect(selectableWeeks).toHaveLength(16);
    expect(closedWeeks).not.toContain("2026-06-07T23:00:00.000Z");
  });

  it("continues rolling forward after the next week starts", () => {
    const weeks = getActiveBaselineWeeks("2026-06-14T23:00:00.000Z");

    expect(weeks).toHaveLength(16);
    expect(weeks.at(-1)).toBe("2026-06-07T23:00:00.000Z");
    expect(weeks).not.toContain("2026-06-14T23:00:00.000Z");
  });

  it("labels the active manifest as institutional seed history, not the legacy seed window", () => {
    const manifest = buildActiveBaselineManifest({
      manifest: releaseManifest,
      generatedAtUtc: "2026-06-09T00:00:00.000Z",
      currentWeekOpenUtc: "2026-06-07T23:00:00.000Z",
    });

    expect(manifest.baselineId).toBe(ACTIVE_BASELINE_ID);
    expect(manifest.baselineId).toBe("v2.0.3-institutional-seed");
    expect(manifest.performanceHistoryWindow).toBe(ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW);
    expect(manifest.activeWeeks).toHaveLength(15);
  });
});
