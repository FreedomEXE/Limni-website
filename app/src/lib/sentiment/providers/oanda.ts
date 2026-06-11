import type { ProviderSentiment } from "../types";
import {
  normalizeSentiment,
  type SentimentProviderInterface,
} from "./base";

type OandaOrderBookResponse = {
  [timestamp: string]: {
    price_points: Array<{
      price: string;
      os: string; // order short
      ol: string; // order long
      ps: string; // price short (position book)
      pl: string; // price long (position book)
    }>;
  };
};

const OANDA_PAIRS = [
  "EUR_USD", "GBP_USD", "USD_JPY", "USD_CHF", "AUD_USD", "NZD_USD",
  "USD_CAD", "EUR_GBP", "EUR_JPY", "GBP_JPY"
];

export class OandaProvider implements SentimentProviderInterface {
  name = "OANDA" as const;
  private readonly apiKey = process.env.OANDA_API_KEY || "";
  private readonly baseUrl = "https://api-fxtrade.oanda.com"; // Use fxpractice for demo

  async isAvailable(): Promise<boolean> {
    // OANDA Labs API is blocked by Cloudflare - needs investigation
    return false;
  }

  async fetchSentiment(symbols?: string[]): Promise<ProviderSentiment[]> {
    if (!this.apiKey) {
      throw new Error("OANDA API key not configured (OANDA_API_KEY)");
    }

    const results: ProviderSentiment[] = [];

    // Fetch order book data for each pair
    for (const instrument of OANDA_PAIRS) {
      const symbol = instrument.replace("_", "");

      // Skip if filtering by symbols and this one isn't requested
      if (symbols && !symbols.includes(symbol)) {
        continue;
      }

      try {
        const startTime = Date.now();
        const sentiment = await this.fetchPairSentiment(instrument);
        const latency = Date.now() - startTime;

        if (sentiment) {
          results.push({
            symbol,
            long_pct: sentiment.long_pct,
            short_pct: sentiment.short_pct,
            net: sentiment.net,
            ratio: sentiment.ratio,
            timestamp_utc: new Date().toISOString(),
            provider: this.name,
            raw_payload: sentiment.raw,
            fetch_latency_ms: latency,
          });
        }
      } catch (error) {
        console.error(`Failed to fetch OANDA sentiment for ${instrument}:`, error);
        // Continue with other pairs
      }
    }

    if (results.length === 0) {
      throw new Error("No OANDA sentiment data retrieved");
    }

    return results;
  }

  private async fetchPairSentiment(instrument: string): Promise<{
    long_pct: number;
    short_pct: number;
    net: number;
    ratio: number;
    raw: unknown;
  } | null> {
    const url = `${this.baseUrl}/labs/v1/orderbook_data?instrument=${instrument}&period=3600`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`OANDA API failed for ${instrument}: ${response.statusText}`);
      }

      const data = await response.json() as OandaOrderBookResponse;

      // Extract position book data (pl/ps) from most recent timestamp
      const timestamps = Object.keys(data);
      if (timestamps.length === 0) {
        return null;
      }

      const latestTimestamp = timestamps[timestamps.length - 1];
      const latestData = data[latestTimestamp];

      if (!latestData || !latestData.price_points || latestData.price_points.length === 0) {
        return null;
      }

      // Calculate weighted average of position book long/short percentages
      let totalLong = 0;
      let totalShort = 0;

      for (const point of latestData.price_points) {
        const pl = Number.parseFloat(point.pl);
        const ps = Number.parseFloat(point.ps);

        if (!Number.isNaN(pl) && !Number.isNaN(ps)) {
          totalLong += pl;
          totalShort += ps;
        }
      }

      const total = totalLong + totalShort;
      if (total === 0) {
        return null;
      }

      const long_pct = (totalLong / total) * 100;
      const short_pct = (totalShort / total) * 100;

      const normalized = normalizeSentiment(long_pct, short_pct);

      return {
        ...normalized,
        raw: { instrument, timestamp: latestTimestamp, data: latestData },
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`OANDA API timed out for ${instrument}`);
      }
      throw error;
    }
  }
}
