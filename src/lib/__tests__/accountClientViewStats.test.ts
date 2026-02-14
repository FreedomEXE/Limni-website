import { describe, expect, test } from "vitest";
import {
  buildStopLossLines,
  computeNetExposure,
  computePlannedLegCounts,
  computePlannedNetLegTotal,
  computePlannedLegTotal,
} from "@/lib/accounts/accountClientViewStats";

const pairs = [
  {
    symbol: "AUDUSD",
    assetClass: "fx",
    net: 1,
    units: 10,
    stopLoss1pct: 0.12345,
    legs: [
      { model: "sentiment", direction: "LONG", units: 10 },
      { model: "dealer", direction: "SHORT", units: 10 },
    ],
  },
  {
    symbol: "BTCUSD",
    assetClass: "crypto",
    net: -1,
    units: 2,
    stopLoss1pct: 42000,
    legs: [{ model: "sentiment", direction: "SHORT", units: 2 }],
  },
];

describe("account client view stats helpers", () => {
  test("computes planned leg counts and totals with oanda fx-only filter", () => {
    const counts = computePlannedLegCounts(pairs, true);
    expect(counts.get("sentiment")).toBe(1);
    expect(counts.get("dealer")).toBe(1);
    expect(computePlannedLegTotal(pairs, true)).toBe(2);
    expect(computePlannedLegTotal(pairs, false)).toBe(3);
    expect(computePlannedNetLegTotal(pairs, true)).toBe(1);
    expect(computePlannedNetLegTotal(pairs, false)).toBe(2);
  });

  test("computes net exposure from legs", () => {
    expect(computeNetExposure(pairs, true)).toBe(0);
    expect(computeNetExposure(pairs, false)).toBe(-2);
  });

  test("builds stop loss copy lines", () => {
    const lines = buildStopLossLines(pairs, true, (symbol, value) => `${symbol}:${value}`);
    expect(lines).toEqual(["AUDUSD\tLONG\tSL AUDUSD:0.12345", "BTCUSD\tSHORT\tSL BTCUSD:42000"]);
    expect(buildStopLossLines(pairs, false, () => "x")).toEqual([]);
  });
});
