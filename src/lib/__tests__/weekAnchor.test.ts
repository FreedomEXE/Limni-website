import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";

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
});

