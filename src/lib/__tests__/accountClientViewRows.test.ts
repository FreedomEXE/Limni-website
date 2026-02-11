import { describe, expect, test } from "vitest";
import { buildClosedRows, buildSymbolRows } from "@/lib/accounts/accountClientViewRows";

describe("account client view row helpers", () => {
  test("builds symbol rows with planned/open aggregation", () => {
    const rows = buildSymbolRows(
      [
        {
          symbol: "AUDUSD",
          units: 10,
          legs: [
            { model: "sentiment", direction: "LONG", units: 10 },
            { model: "dealer", direction: "SHORT", units: 10 },
          ],
        },
      ],
      [
        {
          symbol: "AUDUSD",
          side: "BUY",
          lots: 6,
          pnl: 1.5,
          legs: [{ id: "1", basket: "uni-AUDUSD-sentiment-1", side: "BUY", lots: 6, pnl: 1.5 }],
        },
        {
          symbol: "AUDUSD",
          side: "SELL",
          lots: 2,
          pnl: -0.5,
          legs: [{ id: "2", basket: "manual", side: "SELL", lots: 2, pnl: -0.5 }],
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.symbol).toBe("AUDUSD");
    expect(rows[0]?.plannedLong).toBe(10);
    expect(rows[0]?.plannedShort).toBe(10);
    expect(rows[0]?.openLong).toBe(6);
    expect(rows[0]?.openShort).toBe(2);
    expect(rows[0]?.openPnl).toBe(1.0);
  });

  test("builds closed rows with stable ids and metadata", () => {
    const rows = buildClosedRows([
      {
        symbol: "EURUSD",
        side: "BUY",
        net: 2.5,
        lots: 1,
        legs: [],
      },
    ]);
    expect(rows[0]).toMatchObject({
      id: "closed-EURUSD-BUY-1",
      status: "closed",
      searchText: "EURUSD BUY",
      sortValue: 2.5,
      rowType: "closed",
    });
  });

  test("normalizes broker symbol suffixes when combining planned and live rows", () => {
    const rows = buildSymbolRows(
      [
        {
          symbol: "AUDCAD",
          units: 5,
          legs: [{ model: "sentiment", direction: "LONG", units: 5 }],
        },
      ],
      [
        {
          symbol: "AUDCAD.i",
          side: "BUY",
          lots: 1.91,
          pnl: 183.47,
          legs: [{ id: "42", basket: "uni-AUDCAD-sentiment-1", side: "BUY", lots: 1.91, pnl: 183.47 }],
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.canonicalSymbol).toBe("AUDCAD");
    expect(rows[0]?.symbol).toBe("AUDCAD.I");
    expect(rows[0]?.openLong).toBeCloseTo(1.91, 6);
    expect(rows[0]?.plannedLong).toBeCloseTo(5, 6);
    expect(rows[0]?.hasOpenExposure).toBe(true);
  });
});
