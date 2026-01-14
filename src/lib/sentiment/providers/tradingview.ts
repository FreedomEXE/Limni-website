import type { ProviderSentiment } from "../types";
import {
  normalizeSentiment,
  type SentimentProviderInterface,
} from "./base";

export class TradingViewProvider implements SentimentProviderInterface {
  name = "MYFXBOOK" as const; // Using Myfxbook slot for TradingView data

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async fetchSentiment(symbols?: string[]): Promise<ProviderSentiment[]> {
    const startTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      // TradingView has technical analysis data that can serve as sentiment proxy
      // For now, returning empty to avoid CORS issues
      // Real implementation would need a backend proxy or their official API

      clearTimeout(timeout);
      return [];
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("TradingView request timed out after 10s");
      }
      throw error;
    }
  }
}
