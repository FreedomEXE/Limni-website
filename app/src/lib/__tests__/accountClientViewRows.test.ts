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

  test("normalizes index aliases when combining planned and live rows", () => {
    const rows = buildSymbolRows(
      [
        {
          symbol: "NIKKEIUSD",
          units: 10,
          legs: [{ model: "blended", direction: "SHORT", units: 10 }],
        },
      ],
      [
        {
          symbol: "JPN225",
          side: "SELL",
          lots: 1,
          pnl: -10.71,
          legs: [{ id: "88", basket: "LimniBasket blended signal 2026-02-10", side: "SELL", lots: 1, pnl: -10.71 }],
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.canonicalSymbol).toBe("NIKKEIUSD");
    expect(rows[0]?.symbol).toBe("JPN225");
    expect(rows[0]?.plannedShort).toBe(10);
    expect(rows[0]?.openShort).toBe(1);
  });

  test("normalizes broad index/oil aliases when combining planned and live rows", () => {
    const rows = buildSymbolRows(
      [
        { symbol: "SPXUSD", units: 1, legs: [{ model: "blended", direction: "LONG", units: 1 }] },
        { symbol: "NDXUSD", units: 1, legs: [{ model: "blended", direction: "LONG", units: 1 }] },
        { symbol: "NIKKEIUSD", units: 1, legs: [{ model: "blended", direction: "SHORT", units: 1 }] },
        { symbol: "WTIUSD", units: 1, legs: [{ model: "blended", direction: "LONG", units: 1 }] },
      ],
      [
        {
          symbol: "US500USD",
          side: "BUY",
          lots: 0.4,
          pnl: 1.1,
          legs: [{ id: "1", basket: "LimniBasket blended signal", side: "BUY", lots: 0.4, pnl: 1.1 }],
        },
        {
          symbol: "NDX",
          side: "BUY",
          lots: 0.4,
          pnl: -0.2,
          legs: [{ id: "2", basket: "LimniBasket blended signal", side: "BUY", lots: 0.4, pnl: -0.2 }],
        },
        {
          symbol: "NIKKEI",
          side: "SELL",
          lots: 0.4,
          pnl: 0.9,
          legs: [{ id: "3", basket: "LimniBasket blended signal", side: "SELL", lots: 0.4, pnl: 0.9 }],
        },
        {
          symbol: "USOIL.cash",
          side: "BUY",
          lots: 0.4,
          pnl: 0.3,
          legs: [{ id: "4", basket: "LimniBasket blended signal", side: "BUY", lots: 0.4, pnl: 0.3 }],
        },
      ],
    );

    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.canonicalSymbol === "SPXUSD")?.symbol).toBe("US500USD");
    expect(rows.find((row) => row.canonicalSymbol === "NDXUSD")?.symbol).toBe("NDX");
    expect(rows.find((row) => row.canonicalSymbol === "NIKKEIUSD")?.symbol).toBe("NIKKEI");
    expect(rows.find((row) => row.canonicalSymbol === "WTIUSD")?.symbol).toBe("USOIL.CASH");
  });
});
