import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { getCanonicalWeekOpenUtc, getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

describe("weekAnchor", () => {
  test("anchors to Sunday 19:00 ET", () => {
    const now = DateTime.fromISO("2026-02-12T12:00:00Z");
    const weekOpen = getCanonicalWeekOpenUtc(now);
    expect(weekOpen).toBe("2026-02-09T00:00:00.000Z");
  });

  test("before Sunday open rolls back one week", () => {
    const now = DateTime.fromISO("2026-02-08T22:30:00Z");
    const weekOpen = getCanonicalWeekOpenUtc(now);
    expect(weekOpen).toBe("2026-02-02T00:00:00.000Z");
  });

  test("display week advances after Friday 15:30 ET release", () => {
    const now = DateTime.fromISO("2026-02-13T21:00:00Z"); // Fri 16:00 ET
    const weekOpen = getDisplayWeekOpenUtc(now);
    expect(weekOpen).toBe("2026-02-16T00:00:00.000Z");
  });

  test("display week stays advanced on Sunday before market open", () => {
    const now = DateTime.fromISO("2026-02-15T22:30:00Z"); // Sun 17:30 ET (pre-open)
    const weekOpen = getDisplayWeekOpenUtc(now);
    expect(weekOpen).toBe("2026-02-16T00:00:00.000Z");
  });
});
