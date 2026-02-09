import { describe, expect, test } from "vitest";
import {
  buildMt5ClosedGroups,
  buildMt5DrawerClosedGroups,
  buildMt5DrawerKpiRows,
  buildMt5DrawerOpenPositions,
  buildMt5DrawerPlannedPairs,
  buildMt5JournalRows,
} from "@/lib/accounts/mt5PageViewModel";

describe("mt5 page view model", () => {
  test("groups closed trades by basket/symbol/type/open date", () => {
    const groups = buildMt5ClosedGroups([
      {
        ticket: 1,
        symbol: "AUDUSD",
        type: "BUY",
        lots: 1,
        profit: 2,
        swap: 0,
        commission: -1,
        comment: "LimniBasket sentiment",
        open_time: "2026-02-09T00:00:00Z",
        close_time: "2026-02-09T01:00:00Z",
      },
      {
        ticket: 2,
        symbol: "AUDUSD",
        type: "BUY",
        lots: 2,
        profit: 1,
        swap: 0,
        commission: -1,
        comment: "LimniBasket sentiment",
        open_time: "2026-02-09T00:10:00Z",
        close_time: "2026-02-09T01:10:00Z",
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.lots).toBe(3);
    expect(groups[0]?.net).toBe(1);
  });

  test("builds drawer rows for planned/open/closed and kpis", () => {
    const planned = buildMt5DrawerPlannedPairs([
      { symbol: "AUDUSD", assetClass: "fx", net: 1, legs: [] },
    ]);
    expect(planned[0]?.symbol).toBe("AUDUSD");

    const open = buildMt5DrawerOpenPositions([
      {
        ticket: 1,
        symbol: "AUDUSD",
        type: "BUY",
        lots: 1,
        profit: 1,
        swap: 0,
        commission: -0.5,
        comment: "LimniBasket sentiment",
      },
    ]);
    expect(open[0]?.pnl).toBe(0.5);

    const closed = buildMt5DrawerClosedGroups(
      buildMt5ClosedGroups([
        {
          ticket: 1,
          symbol: "AUDUSD",
          type: "BUY",
          lots: 1,
          profit: 1,
          swap: 0,
          commission: 0,
          comment: "LimniBasket sentiment",
          open_time: "2026-02-09T00:00:00Z",
          close_time: "2026-02-09T01:00:00Z",
        },
      ]),
    );
    expect(closed[0]?.legs.length).toBe(1);

    const kpis = buildMt5DrawerKpiRows(
      {
        equity: 100,
        balance: 90,
        currency: "USD",
        risk_used_pct: 2,
        max_drawdown_pct: 5,
        margin: 10,
        free_margin: 80,
      },
      3,
    );
    expect(kpis.some((row) => row.label === "Basket PnL")).toBe(true);
  });

  test("builds journal rows from logs + change log", () => {
    const rows = buildMt5JournalRows(["bot started"], [{ title: "Changed model", strategy: "sys" }]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.label).toBe("Runtime");
    expect(rows[1]?.label).toBe("sys");
  });
});
