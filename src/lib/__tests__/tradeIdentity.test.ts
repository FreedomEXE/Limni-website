import { describe, expect, it } from "vitest";
import { deriveLiveTradeId, deriveTradeId } from "@/lib/trades/tradeIdentity";
import type { TradeNaturalKey } from "@/lib/trades/tradeTypes";

function baseKey(overrides: Partial<TradeNaturalKey> = {}): TradeNaturalKey {
  return {
    origin: "backtest",
    strategyFamily: "weekly_hold",
    strategyVariant: "agreement-weekly_hold-none",
    engineVersion: "strategy-artifact-v27",
    anchorType: "execution",
    anchorVersion: "execution_monday_utc_v1",
    symbol: "AUDCAD",
    direction: "LONG",
    weekOpenUtc: "2026-05-10T23:00:00.000Z",
    sourceModel: "agreement",
    tier: 1,
    parentTradeId: null,
    fillSeq: null,
    ...overrides,
  };
}

describe("trade identity", () => {
  it("is deterministic across repeated natural-key invocations", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 10_000; index += 1) {
      const key = baseKey({
        symbol: `SYM${index}`,
        weekOpenUtc: new Date(Date.UTC(2026, 0, 5 + index)).toISOString(),
        fillSeq: index % 7,
      });
      const first = deriveTradeId(key);
      const second = deriveTradeId(key);
      expect(second).toBe(first);
      expect(seen.has(first)).toBe(false);
      seen.add(first);
    }
    expect(seen.size).toBe(10_000);
  }, 20_000);

  it("separates anchors and engine versions", () => {
    expect(deriveTradeId(baseKey({ anchorType: "canonical", anchorVersion: "canonical_weekly_v2" })))
      .not.toBe(deriveTradeId(baseKey()));
    expect(deriveTradeId(baseKey({ engineVersion: "strategy-artifact-v28" })))
      .not.toBe(deriveTradeId(baseKey()));
  });

  it("separates otherwise identical trades by direction", () => {
    expect(deriveTradeId(baseKey({ direction: "LONG" })))
      .not.toBe(deriveTradeId(baseKey({ direction: "SHORT" })));
  });

  it("separates fills by parent and sequence", () => {
    const parentTradeId = deriveTradeId(baseKey({ strategyFamily: "adr_grid", strategyVariant: "agreement-adr_grid-pair_fill_cap" }));
    expect(deriveTradeId(baseKey({ parentTradeId, fillSeq: 1 })))
      .not.toBe(deriveTradeId(baseKey({ parentTradeId, fillSeq: 2 })));
  });

  it("derives deterministic live identities from broker truth", () => {
    const first = deriveLiveTradeId({ brokerId: "oanda", brokerTradeId: "12345" });
    const second = deriveLiveTradeId({ brokerId: "OANDA", brokerTradeId: "12345" });
    expect(second).toBe(first);
  });
});
