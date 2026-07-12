import type { ProviderSentiment } from "../types";
import {
  normalizeSentiment,
  type SentimentProviderInterface,
} from "./base";

export class MockProvider implements SentimentProviderInterface {
  name = "MYFXBOOK" as const;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async fetchSentiment(symbols?: string[]): Promise<ProviderSentiment[]> {
    const pairs = symbols || [
      "AUDCAD",
      "AUDCHF",
      "AUDNZD",
      "AUDUSD",
      "CADJPY",
      "CHFJPY",
      "EURCAD",
      "EURCHF",
      "EURGBP",
      "EURNZD",
      "EURUSD",
      "GBPAUD",
      "GBPJPY",
      "NZDJPY",
      "USDJPY",
    ];

    const results: ProviderSentiment[] = [];
    const timestamp = new Date().toISOString();

    for (const symbol of pairs) {
      const longPct = 40 + Math.random() * 20;
      const shortPct = 100 - longPct;

      const normalized = normalizeSentiment(longPct, shortPct);

      results.push({
        symbol,
        long_pct: normalized.long_pct,
        short_pct: normalized.short_pct,
        net: normalized.net,
        ratio: normalized.ratio,
        timestamp_utc: timestamp,
        provider: this.name,
        raw_payload: { longPct, shortPct },
        fetch_latency_ms: 50,
      });
    }

    return results;
  }
}
