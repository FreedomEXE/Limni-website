import { describe, expect, test } from "vitest";
import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";
import {
  hasHistoricalStrategyPayload,
  mergeStrategyWeekOptions,
} from "@/lib/performance/strategyPayloadCompleteness";

function payload(partial: Partial<StrategyClientPayload>): StrategyClientPayload {
  return {
    engineWeekMap: null,
    engineSimMap: null,
    engineWeekResults: null,
    sidebarStats: null,
    ...partial,
  } as StrategyClientPayload;
}

describe("strategyPayloadCompleteness", () => {
  test("does not treat a current-week-only slice as historical payload", () => {
    const currentWeek = "2026-05-31T23:00:00.000Z";
    const currentOnly = payload({
      currentWeekOpenUtc: currentWeek,
      weekOptions: ["all", currentWeek, "2026-05-24T23:00:00.000Z"],
      engineWeekMap: { [currentWeek]: {} as never },
      engineSimMap: { [currentWeek]: {} as never },
      engineWeekResults: { [currentWeek]: {} as never },
    });

    expect(hasHistoricalStrategyPayload(currentOnly)).toBe(false);
  });

  test("accepts all-time or closed-week records as historical payload", () => {
    const currentWeek = "2026-05-31T23:00:00.000Z";
    const closedWeek = "2026-05-24T23:00:00.000Z";

    expect(hasHistoricalStrategyPayload(payload({
      currentWeekOpenUtc: currentWeek,
      engineWeekMap: { all: {} as never },
      engineWeekResults: { [closedWeek]: {} as never },
    }))).toBe(true);

    expect(hasHistoricalStrategyPayload(payload({
      currentWeekOpenUtc: currentWeek,
      engineWeekMap: { [closedWeek]: {} as never },
      engineWeekResults: { [closedWeek]: {} as never },
    }))).toBe(true);
  });

  test("keeps all first, current week second, and preserves historical options when merging", () => {
    const currentWeek = "2026-05-31T23:00:00.000Z";
    const merged = mergeStrategyWeekOptions(
      ["all", "2026-05-24T23:00:00.000Z", "2026-05-17T23:00:00.000Z"],
      ["all", currentWeek, "2026-05-24T23:00:00.000Z"],
      currentWeek,
    );

    expect(merged).toEqual([
      "all",
      currentWeek,
      "2026-05-24T23:00:00.000Z",
      "2026-05-17T23:00:00.000Z",
    ]);
  });
});
