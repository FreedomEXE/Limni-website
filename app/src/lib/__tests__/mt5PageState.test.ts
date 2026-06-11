import { describe, expect, test } from "vitest";
import {
  buildMt5FilteredPositions,
  deriveMt5PnlDisplay,
  shouldForceFxOnlyPlanned,
} from "@/lib/accounts/mt5PageState";

describe("mt5 page state helpers", () => {
  test("detects force-fx-only mode for manual 5ers accounts", () => {
    expect(
      shouldForceFxOnlyPlanned({
        label: "My Account",
        broker: "The5ers",
        server: "x",
        trade_mode: "manual",
        balance: 100,
        equity: 100,
      }),
    ).toBe(true);
    expect(
      shouldForceFxOnlyPlanned({
        label: "My Account",
        broker: "Other",
        server: "x",
        trade_mode: "manual",
        balance: 100,
        equity: 100,
      }),
    ).toBe(false);
  });

  test("derives pnl display values with fallback logic", () => {
    const result = deriveMt5PnlDisplay(
      {
        balance: 100,
        equity: 102,
        baseline_equity: 0,
        weekly_pnl_pct: 0,
        basket_pnl_pct: 0,
        positions: [{
          ticket: "1",
          symbol: "AUDUSD",
          type: "BUY",
          lots: 0.1,
          profit: 1,
          swap: 0,
          commission: -0.5,
          comment: "LimniBasket sentiment",
        }],
      },
      { net: 2, trades: 1 },
    );
    expect(Number.isFinite(result.weeklyPnlToShow)).toBe(true);
    expect(Number.isFinite(result.basketPnlToShow)).toBe(true);
  });

  test("filters positions by fx + basket/symbol filters", () => {
    const result = buildMt5FilteredPositions({
      openPositions: [
        {
          ticket: "1",
          symbol: "AUDUSD",
          type: "BUY",
          lots: 0.1,
          profit: 0,
          swap: 0,
          commission: 0,
          comment: "LimniBasket sentiment",
        },
        {
          ticket: "2",
          symbol: "BTCUSD",
          type: "BUY",
          lots: 0.1,
          profit: 0,
          swap: 0,
          commission: 0,
          comment: "LimniBasket sentiment",
        },
      ],
      closedPositions: [{
        ticket: "3",
        symbol: "EURUSD",
        type: "SELL",
        lots: 0.1,
        profit: 0,
        swap: 0,
        commission: 0,
        comment: "LimniBasket dealer",
        open_time: "2026-01-01T00:00:00.000Z",
        close_time: "2026-01-01T01:00:00.000Z",
      }],
      forceFxOnlyPlanned: true,
      basketFilter: "sentiment",
      symbolFilter: "AUDUSD",
    });

    expect(result.filteredOpenPositions).toHaveLength(1);
    expect(result.filteredOpenPositions[0]?.symbol).toBe("AUDUSD");
  });
});
