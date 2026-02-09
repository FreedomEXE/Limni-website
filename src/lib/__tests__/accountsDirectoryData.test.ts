import { describe, expect, test } from "vitest";
import {
  buildConnectedAccountCards,
  buildMt5AccountCards,
  computeAccountsOverview,
  getConnectedAnalysisFetchedAt,
} from "@/lib/accounts/accountsDirectoryData";

describe("accounts directory data", () => {
  test("builds mt5 cards and overview", () => {
    const mt5 = buildMt5AccountCards([
      {
        account_id: "1",
        label: "A",
        broker: "B",
        server: "S",
        status: "LIVE",
        currency: "USD",
        equity: 100,
        weekly_pnl_pct: 1,
        basket_state: "ACTIVE",
        open_positions: 2,
        open_pairs: 1,
        win_rate_pct: 50,
        max_drawdown_pct: 2,
      },
    ]);
    expect(mt5).toHaveLength(1);
    const overview = computeAccountsOverview(mt5);
    expect(overview.totalEquity).toBe(100);
    expect(overview.activeBaskets).toBe(1);
  });

  test("builds connected cards from analysis and bot state fallback", () => {
    const cards = buildConnectedAccountCards(
      [
        {
          account_key: "oanda:1",
          provider: "oanda",
          label: null,
          status: null,
          analysis: { currency: "USD", open_positions: 3, weekly_pnl_pct: 2 },
        },
      ],
      {
        bitgetState: null,
        oandaState: {
          state: { entered: true, entry_equity: 100, current_equity: 101 },
        },
      },
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]?.basket_state).toBe("ACTIVE");
    expect(cards[0]?.open_positions).toBe(3);
  });

  test("falls back to bot equity/pnl when analysis does not provide it", () => {
    const cards = buildConnectedAccountCards(
      [
        {
          account_key: "bitget:1",
          provider: "bitget",
          label: "Bitget",
          status: "LIVE",
          analysis: { currency: "USD", positions: [{}, {}] },
        },
      ],
      {
        bitgetState: {
          state: { entered: true, entry_equity: 100, current_equity: 110 },
        },
        oandaState: null,
      },
    );
    expect(cards[0]?.equity).toBe(110);
    expect(cards[0]?.weekly_pnl_pct).toBe(10);
    expect(cards[0]?.open_positions).toBe(2);
  });

  test("extracts fetched_at from connected analysis", () => {
    expect(getConnectedAnalysisFetchedAt({ fetched_at: "2026-02-09T00:00:00Z" })).toBe(
      "2026-02-09T00:00:00Z",
    );
    expect(getConnectedAnalysisFetchedAt({ fetched_at: 123 })).toBeNull();
    expect(getConnectedAnalysisFetchedAt(null)).toBeNull();
  });
});
