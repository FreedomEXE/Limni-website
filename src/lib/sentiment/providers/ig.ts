import type { ProviderSentiment } from "../types";
import {
  normalizeSentiment,
  type SentimentProviderInterface,
} from "./base";

type IgSentimentResponse = {
  sentimentData?: {
    market: string;
    longPercentage: number;
    shortPercentage: number;
  }[];
};

export class IgProvider implements SentimentProviderInterface {
  name = "IG" as const;
  private apiKey: string;
  private username: string;
  private password: string;
  private sessionToken?: string;

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
      },
    );

    if (!response.ok) {
      throw new Error(`IG authentication failed: ${response.statusText}`);
    }

    const cstToken = response.headers.get("CST");
    const securityToken = response.headers.get("X-SECURITY-TOKEN");

    if (!cstToken || !securityToken) {
      throw new Error("IG authentication tokens missing");
    }

    this.sessionToken = `${cstToken}:${securityToken}`;
  }

  async fetchSentiment(symbols?: string[]): Promise<ProviderSentiment[]> {
    const startTime = Date.now();

    if (!this.sessionToken) {
      await this.authenticate();
    }

    const response = await fetch(
      "https://api.ig.com/gateway/deal/clientsentiment",
      {
        method: "GET",
        headers: {
          "X-IG-API-KEY": this.apiKey,
          "X-SECURITY-TOKEN": this.sessionToken!.split(":")[1] || "",
          CST: this.sessionToken!.split(":")[0] || "",
          Version: "1",
        },
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        this.sessionToken = undefined;
        throw new Error("IG session expired");
      }
      throw new Error(`IG fetch failed: ${response.statusText}`);
    }

    const data = (await response.json()) as IgSentimentResponse;
    const latency = Date.now() - startTime;

    if (!data.sentimentData || data.sentimentData.length === 0) {
      return [];
    }

    const timestamp = new Date().toISOString();
    const results: ProviderSentiment[] = [];

    for (const item of data.sentimentData) {
      const symbol = item.market.replace("/", "");
      if (symbols && !symbols.includes(symbol)) {
        continue;
      }

      const normalized = normalizeSentiment(
        item.longPercentage,
        item.shortPercentage,
      );

      results.push({
        symbol,
        long_pct: normalized.long_pct,
        short_pct: normalized.short_pct,
        net: normalized.net,
        ratio: normalized.ratio,
        timestamp_utc: timestamp,
        provider: this.name,
        raw_payload: item,
        fetch_latency_ms: latency,
      });
    }

    return results;
  }
}
