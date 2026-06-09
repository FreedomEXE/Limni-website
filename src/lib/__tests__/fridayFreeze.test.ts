import { describe, expect, it } from "vitest";

import { DateTime } from "luxon";

import {
  getFridayFreezeDisplayWeekOpenUtc,
  getFridayFreezeTargetUtc,
} from "@/lib/sourceFreeze/fridayFreeze";

describe("Friday source freeze", () => {
  it("uses 17:00 America/New_York in EST", () => {
    expect(getFridayFreezeTargetUtc("2026-01-19T00:00:00.000Z")).toBe("2026-01-16T22:00:00.000Z");
  });

  it("uses 17:00 America/New_York in EDT", () => {
    expect(getFridayFreezeTargetUtc("2026-05-24T23:00:00.000Z")).toBe("2026-05-22T21:00:00.000Z");
  });

  it("handles the DST-shifted March canonical week open", () => {
    expect(getFridayFreezeTargetUtc("2026-03-08T23:00:00.000Z")).toBe("2026-03-06T22:00:00.000Z");
  });

  it("keeps the active trading week before Friday 17:00 New York", () => {
    const now = DateTime.fromISO("2026-06-05T16:59:00", { zone: "America/New_York" });
    if (!now.isValid) throw new Error("Invalid test timestamp");
    expect(getFridayFreezeDisplayWeekOpenUtc(now)).toBe("2026-05-31T23:00:00.000Z");
  });

  it("advances Data/source planning to the next trading week after Friday 17:00 New York", () => {
    const now = DateTime.fromISO("2026-06-05T18:00:00", { zone: "America/New_York" });
    if (!now.isValid) throw new Error("Invalid test timestamp");
    expect(getFridayFreezeDisplayWeekOpenUtc(now)).toBe("2026-06-07T23:00:00.000Z");
  });
});
