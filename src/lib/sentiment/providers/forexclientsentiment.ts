import type { ProviderSentiment, SentimentProvider } from "../types";
import {
  normalizeSentiment,
  type SentimentProviderInterface,
} from "./base";

export class ForexClientSentimentProvider implements SentimentProviderInterface {
  name: SentimentProvider = "FOREXCLIENTSENTIMENT";

  async isAvailable(): Promise<boolean> {
    // Scraper failing - website structure may have changed
    return false;
  }

  async fetchSentiment(symbols?: string[]): Promise<ProviderSentiment[]> {
    const startTime = Date.now();
    const scraperUrl = process.env.SCRAPER_URL || "http://localhost:3002";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${scraperUrl}/scrape/forexclientsentiment`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ForexClientSentiment scraper failed: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        provider: string;
        data: Array<{ pair: string; long: number; short: number }>;
        timestamp: string;
      };

      const latency = Date.now() - startTime;
      const results: ProviderSentiment[] = [];

      for (const item of data.data) {
        const symbol = item.pair.replace("/", "");
        if (symbols && !symbols.includes(symbol)) {
          continue;
        }

        const normalized = normalizeSentiment(item.long, item.short);

        results.push({
          symbol,
          long_pct: normalized.long_pct,
          short_pct: normalized.short_pct,
          net: normalized.net,
          ratio: normalized.ratio,
          timestamp_utc: data.timestamp,
          provider: this.name,
          raw_payload: item,
          fetch_latency_ms: latency,
        });
      }

      return results;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("ForexClientSentiment scraper timed out after 30s");
      }
      throw error;
    }
  }
}
