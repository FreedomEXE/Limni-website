import { describe, expect, test } from "vitest";
import {
  buildWeekOptionsWithCurrentAndNext,
  resolveRequestedWeek,
} from "@/lib/accounts/weekOptions";
import { pickQueryParam, resolveAccountView } from "@/lib/accounts/navigation";
import { computeMaxDrawdown, formatPercent } from "@/lib/accounts/viewUtils";

describe("accounts week options", () => {
  test("builds unique ordered list with current and next first", () => {
    const result = buildWeekOptionsWithCurrentAndNext(
      ["2026-02-02", "2026-02-09", "2026-02-16"],
      "2026-02-09",
      "2026-02-16",
      4,
    );
    expect(result).toEqual(["2026-02-09", "2026-02-16", "2026-02-02"]);
  });

  test("resolves requested week with fallback", () => {
    const options = ["2026-02-09", "2026-02-16"] as const;
    expect(resolveRequestedWeek("2026-02-16", [...options], "2026-02-09")).toBe("2026-02-16");
    expect(resolveRequestedWeek("2026-03-01", [...options], "2026-02-09")).toBe("2026-02-09");
  });
});

describe("accounts navigation", () => {
  test("normalizes query params and views", () => {
    expect(pickQueryParam(["a", "b"])).toBe("a");
    expect(resolveAccountView("positions")).toBe("trades");
    expect(resolveAccountView("equity")).toBe("overview");
    expect(resolveAccountView("analytics")).toBe("analytics");
    expect(resolveAccountView("unknown")).toBe("overview");
  });
});

describe("accounts view utils", () => {
  test("formats percent and computes drawdown", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-1.234)).toBe("-1.23%");
    const dd = computeMaxDrawdown([
      { equity_pct: 0 },
      { equity_pct: 3 },
      { equity_pct: 1 },
      { equity_pct: 5 },
      { equity_pct: 2 },
    ]);
    expect(dd).toBe(3);
  });
});
