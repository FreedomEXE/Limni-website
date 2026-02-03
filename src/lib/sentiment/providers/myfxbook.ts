import type { ProviderSentiment } from "../types";
import {
  normalizeSentiment,
  type SentimentProviderInterface,
} from "./base";

type MyfxbookSessionCache = {
  session: string;
  expiresAt: number;
};

export type MyfxbookOutlookResponse = {
  error: boolean;
  message?: string;
  symbols?: Array<{
    name: string;
    shortPercentage: number;
    longPercentage: number;
  }>;
};

const MYFXBOOK_SYMBOL_MAP: Record<string, string> = {
  // Indices -> internal symbols
  US500: "SPXUSD",
  SP500: "SPXUSD",
  SPX: "SPXUSD",
  SPX500: "SPXUSD",
  NAS100: "NDXUSD",
  NDX: "NDXUSD",
  NDX100: "NDXUSD",
  US100: "NDXUSD",
  JPN225: "NIKKEIUSD",
  JP225: "NIKKEIUSD",
  N225: "NIKKEIUSD",
  NI225: "NIKKEIUSD",
  NKY: "NIKKEIUSD",
  NIKKEI: "NIKKEIUSD",
  NIKKEI225: "NIKKEIUSD",
  NIK225: "NIKKEIUSD",
  // WTI crude oil -> internal symbol
  USOIL: "WTIUSD",
  WTI: "WTIUSD",
  WTIUSD: "WTIUSD",
  XTIUSD: "WTIUSD",
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

  async fetchOutlookRaw(): Promise<{
    http_status: number;
    status_text: string;
    latency_ms: number;
    headers: Record<string, string>;
    parsed: MyfxbookOutlookResponse | null;
    parse_error: string | null;
    body_excerpt: string;
  }> {
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

      const bodyText = await response.text();
      let parsed: MyfxbookOutlookResponse | null = null;
      let parseError: string | null = null;

      try {
        parsed = JSON.parse(bodyText) as MyfxbookOutlookResponse;
      } catch (error) {
        parseError = error instanceof Error ? error.message : "Failed to parse JSON";
      }

      const headers: Record<string, string> = {};
      const headerKeys = ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"];
      for (const key of headerKeys) {
        const value = response.headers.get(key);
        if (value) {
          headers[key] = value;
        }
      }

      const latency = Date.now() - startTime;

      return {
        http_status: response.status,
        status_text: response.statusText,
        latency_ms: latency,
        headers,
        parsed,
        parse_error: parseError,
        body_excerpt: bodyText.slice(0, 2000),
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Myfxbook outlook API timed out");
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
        const rawSymbol = item.name.replace("/", "").toUpperCase();
        const mappedSymbol = MYFXBOOK_SYMBOL_MAP[rawSymbol] ?? rawSymbol;
        if (symbols && !symbols.includes(mappedSymbol)) {
          continue;
        }

        const normalized = normalizeSentiment(item.longPercentage, item.shortPercentage);

        results.push({
          symbol: mappedSymbol,
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
