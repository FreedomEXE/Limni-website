import { describe, expect, it } from "vitest";

import { toStrategyClientPayload } from "@/lib/performance/strategyClientPayload";
import type { StrategyPageData } from "@/lib/performance/strategyPageData";

describe("strategy client payload", () => {
  it("keeps the current live week selectable in closed-history kernel payloads", () => {
    const currentWeekOpenUtc = "2026-06-07T23:00:00.000Z";
    const closedWeekOpenUtc = "2026-05-31T23:00:00.000Z";
    const payload = toStrategyClientPayload({
      weekMap: {},
      simMap: {},
      pathSummaryMap: {},
      multiWeekResult: {} as StrategyPageData["multiWeekResult"],
      weekResults: {},
      sidebarStats: null as unknown as StrategyPageData["sidebarStats"],
      biasSource: { id: "tandem" } as StrategyPageData["biasSource"],
      entryStyle: undefined,
      riskOverlay: undefined,
      weekOptions: [closedWeekOpenUtc],
      currentWeekOpenUtc,
      artifactMeta: {
        status: "hit",
        selectionKey: "tandem:adr_grid:pair_fill_cap",
        cachedAtUtc: "2026-06-09T00:00:00.000Z",
        refreshedWeeks: [],
        removedWeeks: [],
        missingWeeks: [],
        historyWindow: "active-baseline",
        expectedWeeks: 15,
      },
    });

    expect(payload.weekOptions).toEqual(["all", currentWeekOpenUtc, closedWeekOpenUtc]);
    expect(payload.artifactMeta?.historyWindow).toBe("active-baseline");
  });
});
