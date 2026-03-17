import { describe, expect, test } from "vitest";
import {
  buildPerformanceWeekFlags,
  resolvePerformanceView,
  resolveSelectedPerformanceWeek,
} from "@/lib/performance/pageState";

describe("performance page state helpers", () => {
  test("resolves performance view safely", () => {
    expect(resolvePerformanceView("summary")).toBe("summary");
    expect(resolvePerformanceView("simulation")).toBe("simulation");
    expect(resolvePerformanceView("unknown")).toBe("summary");
    expect(resolvePerformanceView(null)).toBe("summary");
  });

  test("resolves selected week using params and fallbacks", () => {
    expect(
      resolveSelectedPerformanceWeek({
        weekParamValue: "all",
        weekOptions: ["2026-02-09T05:00:00.000Z"],
        currentWeekOpenUtc: "2026-02-09T05:00:00.000Z",
      }),
    ).toBe("all");

    expect(
      resolveSelectedPerformanceWeek({
        weekParamValue: "2026-02-02T05:00:00.000Z",
        weekOptions: ["2026-02-09T05:00:00.000Z", "2026-02-02T05:00:00.000Z"],
        currentWeekOpenUtc: "2026-02-09T05:00:00.000Z",
      }),
    ).toBe("2026-02-02T05:00:00.000Z");

    expect(
      resolveSelectedPerformanceWeek({
        weekParamValue: null,
        weekOptions: ["2026-02-02T05:00:00.000Z"],
        currentWeekOpenUtc: "2026-02-09T05:00:00.000Z",
      }),
    ).toBe("2026-02-02T05:00:00.000Z");
  });

  test("builds waiting/future/historical week flags", () => {
    const current = "2026-02-09T05:00:00.000Z";
    expect(
      buildPerformanceWeekFlags({
        selectedWeek: current,
        currentWeekOpenUtc: current,
        hasSnapshots: false,
      }),
    ).toMatchObject({
      isAllTimeSelected: false,
      isCurrentWeekSelected: true,
      isFutureWeekSelected: false,
      isHistoricalWeekSelected: false,
      isWaitingWeek: true,
    });

    expect(
      buildPerformanceWeekFlags({
        selectedWeek: "2026-02-16T05:00:00.000Z",
        currentWeekOpenUtc: current,
        hasSnapshots: false,
      }).isFutureWeekSelected,
    ).toBe(true);

    expect(
      buildPerformanceWeekFlags({
        selectedWeek: "2026-02-02T05:00:00.000Z",
        currentWeekOpenUtc: current,
        hasSnapshots: true,
      }).isHistoricalWeekSelected,
    ).toBe(true);
  });

  test("treats display-week selection as future until canonical trading week opens", () => {
    const tradingWeek = "2026-02-09T05:00:00.000Z";
    const displayWeek = "2026-02-16T05:00:00.000Z";
    const flags = buildPerformanceWeekFlags({
      selectedWeek: displayWeek,
      currentWeekOpenUtc: displayWeek,
      tradingWeekOpenUtc: tradingWeek,
      hasSnapshots: false,
    });

    expect(flags.isCurrentWeekSelected).toBe(false);
    expect(flags.isFutureWeekSelected).toBe(true);
    expect(flags.isWaitingWeek).toBe(true);
  });
});
