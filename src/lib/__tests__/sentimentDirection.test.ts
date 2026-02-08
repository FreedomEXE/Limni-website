import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { buildSentimentPairsWithHistory } from "../performanceLab";
import type { SentimentAggregate } from "../sentiment/types";

function agg(partial: Partial<SentimentAggregate> & Pick<SentimentAggregate, "symbol">): SentimentAggregate {
  return {
    symbol: partial.symbol,
    timestamp_utc: partial.timestamp_utc ?? DateTime.utc().toISO() ?? new Date().toISOString(),
    agg_long_pct: partial.agg_long_pct ?? 50,
    agg_short_pct: partial.agg_short_pct ?? 50,
    agg_net: partial.agg_net ?? 10,
    sources_used: partial.sources_used ?? ["MYFXBOOK"],
    confidence_score: partial.confidence_score ?? 1,
    crowding_state: partial.crowding_state ?? "NEUTRAL",
    flip_state: partial.flip_state ?? "NONE",
  };
}

describe("Sentiment trade inclusion", () => {
  it("does not create a sentiment trade when crowding_state is NEUTRAL (even if agg_net is directional)", () => {
    const weekOpenUtc = DateTime.fromISO("2026-02-02T05:00:00.000Z", { zone: "utc" });
    const weekCloseUtc = weekOpenUtc.plus({ days: 5 });
    const history: SentimentAggregate[] = [
      agg({
        symbol: "EURUSD",
        timestamp_utc: weekOpenUtc.minus({ hours: 1 }).toISO()!,
        crowding_state: "NEUTRAL",
        flip_state: "NONE",
        agg_net: 25,
      }),
    ];

    const result = buildSentimentPairsWithHistory({
      assetClass: "fx",
      sentimentHistory: history,
      weekOpenUtc,
      weekCloseUtc,
    });

    expect(result.pairs.EURUSD).toBeUndefined();
  });

  it("creates a sentiment trade when crowding_state is CROWDED_LONG (fade = SHORT)", () => {
    const weekOpenUtc = DateTime.fromISO("2026-02-02T05:00:00.000Z", { zone: "utc" });
    const weekCloseUtc = weekOpenUtc.plus({ days: 5 });
    const history: SentimentAggregate[] = [
      agg({
        symbol: "EURUSD",
        timestamp_utc: weekOpenUtc.minus({ hours: 1 }).toISO()!,
        crowding_state: "CROWDED_LONG",
        flip_state: "NONE",
        agg_net: 25,
      }),
    ];

    const result = buildSentimentPairsWithHistory({
      assetClass: "fx",
      sentimentHistory: history,
      weekOpenUtc,
      weekCloseUtc,
    });

    expect(result.pairs.EURUSD?.direction).toBe("SHORT");
  });

  it("creates a sentiment trade when flip_state is FLIPPED_UP (LONG)", () => {
    const weekOpenUtc = DateTime.fromISO("2026-02-02T05:00:00.000Z", { zone: "utc" });
    const weekCloseUtc = weekOpenUtc.plus({ days: 5 });
    const history: SentimentAggregate[] = [
      agg({
        symbol: "EURUSD",
        timestamp_utc: weekOpenUtc.minus({ hours: 1 }).toISO()!,
        crowding_state: "NEUTRAL",
        flip_state: "FLIPPED_UP",
        agg_net: -25,
      }),
    ];

    const result = buildSentimentPairsWithHistory({
      assetClass: "fx",
      sentimentHistory: history,
      weekOpenUtc,
      weekCloseUtc,
    });

    expect(result.pairs.EURUSD?.direction).toBe("LONG");
  });
});
