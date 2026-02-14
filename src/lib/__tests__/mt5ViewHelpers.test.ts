import { describe, expect, test } from "vitest";
import {
  applyPositionFilters,
  collectPositionFilterOptions,
  filterFxPositions,
  findLotMapEntry,
  isFxSymbol,
  normalizeSymbol,
  parseBasketFromComment,
} from "@/lib/accounts/mt5ViewHelpers";

describe("mt5 view helpers", () => {
  test("parses basket tag from comment", () => {
    expect(parseBasketFromComment("LimniBasket Sentiment entry")).toBe("sentiment");
    expect(parseBasketFromComment("")).toBeNull();
  });

  test("normalizes symbols and detects FX", () => {
    expect(normalizeSymbol("eur_usd")).toBe("EURUSD");
    expect(normalizeSymbol("audcad.m")).toBe("AUDCAD");
    expect(isFxSymbol("BTCUSD")).toBe(false);
    expect(isFxSymbol("usd_jpy")).toBe(true);
  });

  test("collects and applies basket/symbol filters", () => {
    const rows = [
      { symbol: "AUDUSD", comment: "LimniBasket sentiment" },
      { symbol: "EURUSD", comment: "LimniBasket dealer" },
      { symbol: "EURUSD", comment: "" },
    ];
    const options = collectPositionFilterOptions(rows);
    expect(options.basketOptions).toEqual(["dealer", "sentiment"]);
    expect(options.symbolOptions).toEqual(["AUDUSD", "EURUSD"]);

    const filtered = applyPositionFilters({
      positions: rows,
      basketFilter: "sentiment",
      symbolFilter: "AUDUSD",
    });
    expect(filtered).toHaveLength(1);
  });

  test("filters FX-only position rows", () => {
    const rows = [
      { symbol: "AUDUSD" },
      { symbol: "BTCUSD" },
      { symbol: "USD_JPY" },
    ];
    expect(filterFxPositions(rows).map((r) => r.symbol)).toEqual(["AUDUSD", "USD_JPY"]);
  });

  test("matches lot-map rows with aliases/suffixes", () => {
    const rows = [
      { symbol: "SPX500" },
      { symbol: "US500" },
      { symbol: "USOIL.i" },
      { symbol: "XTIUSD" },
      { symbol: "EURUSD-ECN" },
      { symbol: "AUDCAD.m" },
    ];
    expect(findLotMapEntry(rows, "SPXUSD")?.symbol).toBe("SPX500");
    expect(findLotMapEntry([{ symbol: "US500" }], "SPXUSD")?.symbol).toBe("US500");
    expect(findLotMapEntry([{ symbol: "USOIL.i" }], "WTIUSD")?.symbol).toBe("USOIL.i");
    expect(findLotMapEntry([{ symbol: "XTIUSD" }], "WTIUSD")?.symbol).toBe("XTIUSD");
    expect(findLotMapEntry(rows, "EURUSD")?.symbol).toBe("EURUSD-ECN");
    expect(findLotMapEntry(rows, "AUDCAD")?.symbol).toBe("AUDCAD.m");
  });
});
