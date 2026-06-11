import { describe, expect, test } from "vitest";
import {
  EXECUTION_ANCHOR_VERSION,
  getExecutionWeekWindow,
} from "@/lib/executionPriceWindows";

describe("execution price windows", () => {
  test("uses Sunday 8pm New York, Friday 9am entry cutoff, and Friday 11am close for non-crypto in EDT", () => {
    const window = getExecutionWeekWindow("2026-05-17T23:00:00.000Z", "fx");

    expect(window.logicalWeekOpenUtc).toBe("2026-05-17T23:00:00.000Z");
    expect(window.windowOpenUtc.toISO()).toBe("2026-05-18T00:00:00.000Z");
    expect(window.entryCutoffUtc.toISO()).toBe("2026-05-22T13:00:00.000Z");
    expect(window.windowCloseUtc.toISO()).toBe("2026-05-22T15:00:00.000Z");
    expect(window.anchorVersion).toBe(EXECUTION_ANCHOR_VERSION);
  });

  test("uses Sunday 8pm New York, Friday 9am entry cutoff, and Friday 11am close for non-crypto in EST", () => {
    const window = getExecutionWeekWindow("2026-01-19T00:00:00.000Z", "indices");

    expect(window.logicalWeekOpenUtc).toBe("2026-01-19T00:00:00.000Z");
    expect(window.windowOpenUtc.toISO()).toBe("2026-01-19T01:00:00.000Z");
    expect(window.entryCutoffUtc.toISO()).toBe("2026-01-23T14:00:00.000Z");
    expect(window.windowCloseUtc.toISO()).toBe("2026-01-23T16:00:00.000Z");
    expect(window.anchorVersion).toBe(EXECUTION_ANCHOR_VERSION);
  });

  test("uses the Friday entry cutoff and close for crypto during the clean14 recovery runtime", () => {
    const window = getExecutionWeekWindow("2026-05-31T23:00:00.000Z", "crypto");

    expect(window.logicalWeekOpenUtc).toBe("2026-05-31T23:00:00.000Z");
    expect(window.windowOpenUtc.toISO()).toBe("2026-06-01T00:00:00.000Z");
    expect(window.entryCutoffUtc.toISO()).toBe("2026-06-05T13:00:00.000Z");
    expect(window.windowCloseUtc.toISO()).toBe("2026-06-05T15:00:00.000Z");
    expect(window.anchorVersion).toBe(EXECUTION_ANCHOR_VERSION);
  });
});
