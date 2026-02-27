#!/usr/bin/env tsx

import fs from "node:fs/promises";
import path from "node:path";
import { getAllProviders } from "@/lib/sentiment/providers";
import { ALL_SENTIMENT_SYMBOLS } from "@/lib/sentiment/symbols";
import type { SentimentProvider } from "@/lib/sentiment/types";

type CoverageStatus =
  | "ok"
  | "partial"
  | "down"
  | "unavailable"
  | "unsupported";

type ProviderCoverage = {
  provider: string;
  endpoint: string;
  status: CoverageStatus;
  message: string;
  supported_pairs: string[];
  fetched_pairs: string[];
};

type CoverageReport = {
  generated_at_utc: string;
  universe_size: number;
  provider_rows: ProviderCoverage[];
  source_count_by_pair: Record<string, { count: number; sources: string[] }>;
};

function getScraperUrl() {
  return process.env.SCRAPER_URL || "http://localhost:3002";
}

const PROVIDER_ENDPOINTS: Record<SentimentProvider, string> = {
  MYFXBOOK: "https://www.myfxbook.com/api/get-community-outlook.json",
  IG: "https://api.ig.com/gateway/deal/clientsentiment/{marketId}",
  OANDA: "https://api-fxtrade.oanda.com/labs/v1/orderbook_data",
  FOREXCLIENTSENTIMENT: "",
};

const SUPPORTED_PAIRS_HINTS: Record<SentimentProvider, string[]> = {
  MYFXBOOK: [],
  IG: [
    "SPXUSD",
    "NDXUSD",
    "NIKKEIUSD",
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "USDCHF",
    "AUDUSD",
    "USDCAD",
    "NZDUSD",
    "BTCUSD",
    "ETHUSD",
    "XAUUSD",
    "XAGUSD",
    "WTIUSD",
  ],
  OANDA: [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "USDCHF",
    "AUDUSD",
    "NZDUSD",
    "USDCAD",
    "EURGBP",
    "EURJPY",
    "GBPJPY",
  ],
  FOREXCLIENTSENTIMENT: [],
};

function normalizePair(symbol: string): string {
  return symbol.replace(/[\/_\s-]+/g, "").toUpperCase();
}

async function loadLocalEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    try {
      const text = await fs.readFile(fullPath, "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        if (!key || process.env[key] !== undefined) continue;
        const value = line.slice(eq + 1).trim();
        process.env[key] = value;
      }
    } catch {
      // Ignore missing local env files.
    }
  }
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function normalizeToUniverse(symbols: Iterable<string>): string[] {
  const universe = new Set(ALL_SENTIMENT_SYMBOLS.map((symbol) => normalizePair(symbol)));
  return uniqueSorted(
    Array.from(symbols)
      .map((symbol) => normalizePair(symbol))
      .filter((symbol) => universe.has(symbol)),
  );
}

async function probeBuiltInProviders(): Promise<ProviderCoverage[]> {
  const providerRows: ProviderCoverage[] = [];
  const endpointMap = {
    ...PROVIDER_ENDPOINTS,
    FOREXCLIENTSENTIMENT: `${getScraperUrl()}/scrape/forexclientsentiment`,
  } as Record<SentimentProvider, string>;

  for (const provider of getAllProviders()) {
    const endpoint = endpointMap[provider.name];
    const supportedPairs = normalizeToUniverse(SUPPORTED_PAIRS_HINTS[provider.name] ?? []);

    let available = false;
    try {
      available = await provider.isAvailable();
    } catch (error) {
      providerRows.push({
        provider: provider.name,
        endpoint,
        status: "down",
        message: `isAvailable failed: ${error instanceof Error ? error.message : String(error)}`,
        supported_pairs: supportedPairs,
        fetched_pairs: [],
      });
      continue;
    }

    if (!available) {
      providerRows.push({
        provider: provider.name,
        endpoint,
        status: "unavailable",
        message: "Provider not available in current env (credentials/path disabled).",
        supported_pairs: supportedPairs,
        fetched_pairs: [],
      });
      continue;
    }

    try {
      const snapshots = await provider.fetchSentiment(Array.from(ALL_SENTIMENT_SYMBOLS));
      const fetchedPairs = normalizeToUniverse(snapshots.map((snapshot) => snapshot.symbol));
      providerRows.push({
        provider: provider.name,
        endpoint,
        status: fetchedPairs.length > 0 ? "ok" : "partial",
        message:
          fetchedPairs.length > 0
            ? `Fetched ${fetchedPairs.length} mapped pairs.`
            : "Fetch succeeded but no mapped pairs returned.",
        supported_pairs: supportedPairs,
        fetched_pairs: fetchedPairs,
      });
    } catch (error) {
      providerRows.push({
        provider: provider.name,
        endpoint,
        status: "down",
        message: error instanceof Error ? error.message : String(error),
        supported_pairs: supportedPairs,
        fetched_pairs: [],
      });
    }
  }

  return providerRows;
}

function extractDukascopyInstrumentPairs(customInitCode: string): string[] {
  const appletMatch = customInitCode.match(/DukascopyApplet\s*=\s*(\{[\s\S]*\})\s*;<\/script>/);
  if (!appletMatch || !appletMatch[1]) {
    return [];
  }
  const parsed = JSON.parse(appletMatch[1]) as {
    params?: {
      availableInstruments?: string | string[];
    };
  };
  const instrumentsRaw = parsed.params?.availableInstruments;
  const list = Array.isArray(instrumentsRaw)
    ? instrumentsRaw
    : typeof instrumentsRaw === "string"
      ? instrumentsRaw.split(",")
      : [];

  return normalizeToUniverse(
    list
      .map((value) => value.trim())
      .map((value) => (value.startsWith("l:") ? value.slice(2) : value))
      .filter((value) => value.includes("/")),
  );
}

async function probeDukascopy(): Promise<ProviderCoverage> {
  const realtimeUrl = "https://www.dukascopy.com/trading-tools/api/widget/realtime_sentiment_index";
  const historicalUrl = "https://www.dukascopy.com/trading-tools/api/widget/historical_sentiment_index";
  const endpoint = `${realtimeUrl} | ${historicalUrl}`;

  try {
    const [realtimeResponse, historicalResponse] = await Promise.all([
      fetch(realtimeUrl),
      fetch(historicalUrl),
    ]);
    if (!realtimeResponse.ok || !historicalResponse.ok) {
      return {
        provider: "DUKASCOPY_WIDGET",
        endpoint,
        status: "down",
        message: `HTTP status realtime=${realtimeResponse.status}, historical=${historicalResponse.status}`,
        supported_pairs: [],
        fetched_pairs: [],
      };
    }

    const [realtimeJson, historicalJson] = await Promise.all([
      realtimeResponse.json() as Promise<{ custom_init_code?: string }>,
      historicalResponse.json() as Promise<{ custom_init_code?: string }>,
    ]);

    const pairs = uniqueSorted([
      ...extractDukascopyInstrumentPairs(realtimeJson.custom_init_code ?? ""),
      ...extractDukascopyInstrumentPairs(historicalJson.custom_init_code ?? ""),
    ]);

    return {
      provider: "DUKASCOPY_WIDGET",
      endpoint,
      status: pairs.length > 0 ? "ok" : "partial",
      message:
        pairs.length > 0
          ? `Parsed ${pairs.length} mapped pairs from widget config.`
          : "Widget endpoints reachable but no mapped pairs parsed.",
      supported_pairs: pairs,
      fetched_pairs: pairs,
    };
  } catch (error) {
    return {
      provider: "DUKASCOPY_WIDGET",
      endpoint,
      status: "down",
      message: error instanceof Error ? error.message : String(error),
      supported_pairs: [],
      fetched_pairs: [],
    };
  }
}

function buildSourceCountByPair(rows: ProviderCoverage[]) {
  const map: Record<string, { count: number; sources: string[] }> = {};
  const universe = ALL_SENTIMENT_SYMBOLS.map((symbol) => normalizePair(symbol));

  for (const pair of universe) {
    const sources = rows
      .filter((row) => row.fetched_pairs.includes(pair))
      .map((row) => row.provider)
      .sort((a, b) => a.localeCompare(b));
    map[pair] = {
      count: sources.length,
      sources,
    };
  }

  return map;
}

async function main() {
  await loadLocalEnv();

  const providerRows = await probeBuiltInProviders();
  providerRows.push(await probeDukascopy());
  providerRows.push({
    provider: "FXSTREET",
    endpoint: "https://developers.fxstreet.com/api-docs/market-sentiment",
    status: "unsupported",
    message: "No integrated provider in this repo yet (typically API-key based).",
    supported_pairs: [],
    fetched_pairs: [],
  });
  providerRows.push({
    provider: "FOREXFACTORY",
    endpoint: "https://nfs.faireconomy.media/ff_calendar_thisweek.xml",
    status: "unsupported",
    message: "Calendar feed available, but no pair-level retail sentiment endpoint integrated.",
    supported_pairs: [],
    fetched_pairs: [],
  });

  const sourceCountByPair = buildSourceCountByPair(providerRows);
  const report: CoverageReport = {
    generated_at_utc: new Date().toISOString(),
    universe_size: ALL_SENTIMENT_SYMBOLS.length,
    provider_rows: providerRows,
    source_count_by_pair: sourceCountByPair,
  };

  const outputPath = path.resolve(process.cwd(), "reports", "sentiment_provider_coverage.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  const rowsToPrint = providerRows.map((row) => ({
    provider: row.provider,
    status: row.status,
    pairs: row.fetched_pairs.length,
    endpoint: row.endpoint,
  }));
  console.table(rowsToPrint);

  const topPairs = Object.entries(sourceCountByPair)
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([pair, row]) => ({
      pair,
      sources: row.count,
      providers: row.sources.join(", ") || "—",
    }));
  console.table(topPairs);
  console.log(`Saved coverage report: ${outputPath}`);
}

main().catch((error) => {
  console.error("Sentiment coverage mapping failed:", error);
  process.exit(1);
});
