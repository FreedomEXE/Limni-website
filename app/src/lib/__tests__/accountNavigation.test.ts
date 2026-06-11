import { describe, expect, it } from "vitest";
import {
  pickQueryParam,
  resolveAccountView,
  resolveCommonAccountSearchParams,
  resolveMt5TradeFilters,
} from "@/lib/accounts/navigation";

describe("accounts/navigation", () => {
  it("normalizes query params", () => {
    expect(pickQueryParam(undefined)).toBeUndefined();
    expect(pickQueryParam("abc")).toBe("abc");
    expect(pickQueryParam(["abc", "def"])).toBe("abc");
  });

  it("maps legacy view names", () => {
    expect(resolveAccountView("equity")).toBe("overview");
    expect(resolveAccountView("positions")).toBe("trades");
    expect(resolveAccountView("settings")).toBe("analytics");
    expect(resolveAccountView("trades")).toBe("trades");
    expect(resolveAccountView("bad")).toBe("overview");
  });

  it("resolves common account search params", () => {
    const resolved = resolveCommonAccountSearchParams({
      week: ["2026-02-09T05:00:00.000Z"],
      view: "positions",
    });
    expect(resolved).toEqual({
      week: "2026-02-09T05:00:00.000Z",
      view: "trades",
    });
  });

  it("resolves MT5 filters", () => {
    const filters = resolveMt5TradeFilters({
      basket: "SeNtiMent",
      symbol: "eurusd",
    });
    expect(filters).toEqual({
      basketFilter: "sentiment",
      symbolFilter: "EURUSD",
    });
  });
});
