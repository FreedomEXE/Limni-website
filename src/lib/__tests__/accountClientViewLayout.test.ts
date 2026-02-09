import { describe, expect, it } from "vitest";
import {
  formatStopLossValue,
  getAccountClientViewLayout,
} from "@/lib/accounts/accountClientViewLayout";

describe("accountClientViewLayout", () => {
  it("returns provider-aware size labels", () => {
    expect(getAccountClientViewLayout("OANDA", true).sizeUnitLabel).toBe("units");
    expect(getAccountClientViewLayout("Bitget", false).sizeUnitLabel).toBe("qty");
    expect(getAccountClientViewLayout("MT5", false).sizeUnitLabel).toBe("lots");
  });

  it("formats stop loss precision by symbol", () => {
    expect(formatStopLossValue("USDJPY", 156.12345)).toBe("156.123");
    expect(formatStopLossValue("EURUSD", 1.123456)).toBe("1.12346");
  });
});
