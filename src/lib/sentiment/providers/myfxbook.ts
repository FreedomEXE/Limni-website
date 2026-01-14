import type { ProviderSentiment } from "../types";
import {
  normalizeSentiment,
  type SentimentProviderInterface,
} from "./base";

type MyfxbookSessionCache = {
  session: string;
  expiresAt: number;
};

type MyfxbookOutlookResponse = {
  error: boolean;
  message?: string;
  symbols?: Array<{
    name: string;
    shortPercentage: number;
    longPercentage: number;
  }>;
};

let sessionCache: MyfxbookSessionCache | null = null;

export class MyfxbookProvider implements SentimentProviderInterface {
  name = "MYFXBOOK" as const;
  private readonly email = process.env.MYFXBOOK_EMAIL || "";
  private readonly password = process.env.MYFXBOOK_PASSWORD || "";

  async isAvailable(): Promise<boolean> {
    return !!(this.email && this.password);
  }

  private async getSession(): Promise<string> {
    // Return cached session if valid
    if (sessionCache && sessionCache.expiresAt > Date.now()) {
      return sessionCache.session;
    }

    // Login to get new session
    const loginUrl = new URL("https://www.myfxbook.com/api/login.json");
    loginUrl.searchParams.set("email", this.email);
    loginUrl.searchParams.set("password", this.password);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(loginUrl.toString(), {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Myfxbook login failed: ${response.statusText}`);
      }

      const data = await response.json() as { error: boolean; message?: string; session?: string };

      if (data.error || !data.session) {
        throw new Error(`Myfxbook login error: ${data.message || "No session returned"}`);
      }

      // Session is URL-encoded, decode it
      const decodedSession = decodeURIComponent(data.session);

      // Cache session for 23 hours (API sessions typically last 24h)
      sessionCache = {
        session: decodedSession,
        expiresAt: Date.now() + 23 * 60 * 60 * 1000,
      };

      return decodedSession;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Myfxbook login timed out");
      }
      throw error;
    }
  }

  async fetchSentiment(symbols?: string[]): Promise<ProviderSentiment[]> {
    const startTime = Date.now();

    if (!this.email || !this.password) {
      throw new Error("Myfxbook credentials not configured (MYFXBOOK_EMAIL, MYFXBOOK_PASSWORD)");
    }

    const session = await this.getSession();

    const outlookUrl = new URL("https://www.myfxbook.com/api/get-community-outlook.json");
    outlookUrl.searchParams.set("session", session);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(outlookUrl.toString(), {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Myfxbook outlook API failed: ${response.statusText}`);
      }

      const data = await response.json() as MyfxbookOutlookResponse;

      if (data.error || !data.symbols) {
        throw new Error(`Myfxbook outlook error: ${data.message || "No symbols returned"}`);
      }

      const latency = Date.now() - startTime;
      const results: ProviderSentiment[] = [];

      for (const item of data.symbols) {
        const symbol = item.name.replace("/", "");
        if (symbols && !symbols.includes(symbol)) {
          continue;
        }

        const normalized = normalizeSentiment(item.longPercentage, item.shortPercentage);

        results.push({
          symbol,
          long_pct: normalized.long_pct,
          short_pct: normalized.short_pct,
          net: normalized.net,
          ratio: normalized.ratio,
          timestamp_utc: new Date().toISOString(),
          provider: this.name,
          raw_payload: item,
          fetch_latency_ms: latency,
        });
      }

      return results;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Myfxbook outlook API timed out");
      }
      throw error;
    }
  }
}
