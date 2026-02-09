import { describe, expect, test } from "vitest";
import {
  buildAccountCardHref,
  formatMaybeCurrency,
  formatMaybePercent,
  pillTone,
} from "@/lib/accounts/accountsDirectoryView";

describe("accounts directory view helpers", () => {
  test("builds account href with optional query params", () => {
    expect(buildAccountCardHref("/accounts/1", null, null)).toBe("/accounts/1");
    expect(buildAccountCardHref("/accounts/1", "2026-02-09", null)).toBe(
      "/accounts/1?week=2026-02-09",
    );
    expect(buildAccountCardHref("/accounts/1", "2026-02-09", "trades")).toBe(
      "/accounts/1?week=2026-02-09&view=trades",
    );
  });

  test("formats optional currency and percent values", () => {
    expect(formatMaybeCurrency(100, "USD")).toContain("$100.00");
    expect(formatMaybeCurrency(null, "USD")).toBe("--");
    expect(formatMaybePercent(1.234)).toBe("+1.23%");
    expect(formatMaybePercent(-0.5)).toBe("-0.50%");
    expect(formatMaybePercent(null)).toBe("--");
  });

  test("returns consistent pill tones", () => {
    expect(pillTone(1, true)).toContain("emerald");
    expect(pillTone(-1, true)).toContain("rose");
    expect(pillTone(-1, false)).toContain("emerald");
    expect(pillTone(1, false)).toContain("rose");
  });
});
