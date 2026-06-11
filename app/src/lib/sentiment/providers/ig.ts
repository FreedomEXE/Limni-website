import type { ProviderSentiment } from "../types";
import {
  normalizeSentiment,
  type SentimentProviderInterface,
} from "./base";

type IgClientSentimentResponse = {
  longPositionPercentage: number;
  shortPositionPercentage: number;
};

// Map our symbol format to IG market identifiers
const SYMBOL_TO_MARKET_ID: Record<string, string> = {
  // Indices
  SPXUSD: "US500",
  NDXUSD: "US-TECH-100",
  NIKKEIUSD: "JPN225",
  // FX Majors
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  USDJPY: "USDJPY",
  USDCHF: "USDCHF",
  AUDUSD: "AUDUSD",
  USDCAD: "USDCAD",
  NZDUSD: "NZDUSD",
  // Crypto
  BTCUSD: "BITCOIN",
  ETHUSD: "ETHEREUM",
  // Commodities
  XAUUSD: "GOLD",
  XAGUSD: "SILVER",
  WTIUSD: "CRUDE",
};

export class IgProvider implements SentimentProviderInterface {
  name = "IG" as const;
  private apiKey: string;
  private username: string;
  private password: string;
  private cstToken?: string;
  private securityToken?: string;

  constructor() {
    this.apiKey = process.env.IG_API_KEY || "";
    this.username = process.env.IG_USERNAME || "";
    this.password = process.env.IG_PASSWORD || "";
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.username && this.password);
  }

  private async authenticate(): Promise<void> {
    if (!this.apiKey || !this.username || !this.password) {
      throw new Error("IG credentials not configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        "https://api.ig.com/gateway/deal/session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-IG-API-KEY": this.apiKey,
            Version: "2",
          },
          body: JSON.stringify({
            identifier: this.username,
            password: this.password,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`IG authentication failed: ${response.statusText}`);
      }

      this.cstToken = response.headers.get("CST") ?? undefined;
      this.securityToken = response.headers.get("X-SECURITY-TOKEN") ?? undefined;

      if (!this.cstToken || !this.securityToken) {
        throw new Error("IG authentication tokens missing");
      }
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("IG authentication timed out");
      }
      throw error;
    }
  }

  private async fetchMarketSentiment(marketId: string): Promise<{
    long_pct: number;
    short_pct: number;
    net: number;
    ratio: number;
  } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `https://api.ig.com/gateway/deal/clientsentiment/${marketId}`,
        {
          method: "GET",
          headers: {
            "X-IG-API-KEY": this.apiKey,
            "X-SECURITY-TOKEN": this.securityToken ?? "",
            CST: this.cstToken ?? "",
            Version: "1",
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 401) {
          this.cstToken = undefined;
          this.securityToken = undefined;
          throw new Error("IG session expired");
        }
        // Market may not have sentiment data available
        return null;
      }

      const data = (await response.json()) as IgClientSentimentResponse;

      return normalizeSentiment(
        data.longPositionPercentage,
        data.shortPositionPercentage,
      );
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        console.warn(`IG sentiment request timed out for ${marketId}`);
        return null;
      }
      throw error;
    }
  }

  async fetchSentiment(symbols?: string[]): Promise<ProviderSentiment[]> {
    if (!this.cstToken || !this.securityToken) {
      await this.authenticate();
    }

    const results: ProviderSentiment[] = [];
    const symbolsToFetch = symbols ?? Object.keys(SYMBOL_TO_MARKET_ID);

    for (const symbol of symbolsToFetch) {
      const marketId = SYMBOL_TO_MARKET_ID[symbol];
      if (!marketId) {
        continue;
      }

      try {
        const startTime = Date.now();
        const sentiment = await this.fetchMarketSentiment(marketId);
        const latency = Date.now() - startTime;

        if (!sentiment) {
          continue;
        }

        results.push({
          symbol,
          long_pct: sentiment.long_pct,
          short_pct: sentiment.short_pct,
          net: sentiment.net,
          ratio: sentiment.ratio,
          timestamp_utc: new Date().toISOString(),
          provider: this.name,
          raw_payload: { marketId, ...sentiment },
          fetch_latency_ms: latency,
        });
      } catch (error) {
        console.error(`Failed to fetch IG sentiment for ${symbol}:`, error);
        // Continue with other symbols
      }
    }

    if (results.length === 0) {
      throw new Error("No IG sentiment data retrieved");
    }

    return results;
  }
}
