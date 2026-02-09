import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  decodeAccountKeyCandidates,
  findConnectedAccountByCandidates,
} from "@/lib/accounts/connectedLookup";
import {
  normalizeMappedRows,
  roundPlannedUnits,
} from "@/lib/accounts/connectedPlanning";
import {
  buildConnectedOpenPositions,
  extractConnectedMappedRows,
  parseSelectedModels,
} from "@/lib/accounts/connectedViewHelpers";

vi.mock("@/lib/connectedAccounts", () => ({
  getConnectedAccount: vi.fn(),
  listConnectedAccounts: vi.fn(),
}));

import {
  getConnectedAccount,
  listConnectedAccounts,
} from "@/lib/connectedAccounts";

describe("connected lookup helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("builds safe decoded key candidates", () => {
    const keys = decodeAccountKeyCandidates("oanda%3A001-abc");
    expect(keys).toContain("oanda%3A001-abc");
    expect(keys).toContain("oanda:001-abc");
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("finds account by fallback id matching when direct lookup misses", async () => {
    vi.mocked(getConnectedAccount).mockResolvedValue(null);
    vi.mocked(listConnectedAccounts).mockResolvedValue([
      {
        account_key: "oanda:001-002-3529324-003",
        provider: "oanda",
        account_id: "001-002-3529324-003",
      },
    ] as never);

    const found = await findConnectedAccountByCandidates(
      decodeAccountKeyCandidates("oanda%3A001-002-3529324-003"),
    );
    expect(found?.account_key).toBe("oanda:001-002-3529324-003");
  });
});

describe("connected planning helpers", () => {
  test("normalizes OANDA mappings to FX-only", () => {
    const rows = normalizeMappedRows({
      provider: "oanda",
      mapped: [
        { symbol: "EURUSD", instrument: "EUR_USD", available: true },
        { symbol: "BTCUSD", instrument: "BTC_USD", available: true },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.symbol).toBe("EURUSD");
  });

  test("uses bitget fallback mappings when empty", () => {
    const rows = normalizeMappedRows({ provider: "bitget", mapped: [] });
    expect(rows.map((r) => r.symbol)).toEqual(["BTCUSD", "ETHUSD"]);
  });

  test("rounds units safely with precision and min threshold", () => {
    expect(roundPlannedUnits(12.987, 2)).toBe(12.98);
    expect(roundPlannedUnits(0.9, 0, 1)).toBe(0);
    expect(roundPlannedUnits(Number.NaN, 0)).toBe(0);
  });
});

describe("connected view helpers", () => {
  test("parses and filters selected models", () => {
    expect(parseSelectedModels("sentiment,unknown,dealer")).toEqual([
      "sentiment",
      "dealer",
    ]);
  });

  test("builds grouped open positions with FX filter for OANDA", () => {
    const positions = buildConnectedOpenPositions({
      provider: "oanda",
      analysis: {
        positions: [
          { symbol: "AUDUSD", type: "BUY", lots: 10, profit: 2.5, comment: "sentiment" },
          { symbol: "AUDUSD", type: "buy", lots: 5, profit: -0.5, comment: "dealer" },
          { symbol: "BTCUSD", type: "BUY", lots: 1, profit: 10 }, // dropped (non-FX)
          { symbol: "AUDUSD", type: "SELL", lots: 3, profit: 0.3 },
        ],
      },
    });

    expect(positions).toHaveLength(2);
    expect(positions.find((p) => p.side === "BUY")?.lots).toBe(15);
    expect(positions.find((p) => p.side === "SELL")?.lots).toBe(3);
  });

  test("extracts normalized mapped rows from analysis payload", () => {
    expect(
      extractConnectedMappedRows({
        mapped: [
          { symbol: "eurusd", instrument: "eur_usd", available: true },
          { symbol: "", instrument: "GBP_USD", available: true },
          null,
        ],
      }),
    ).toEqual([{ symbol: "EURUSD", instrument: "EUR_USD", available: true }]);
  });
});
