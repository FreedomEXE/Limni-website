import type { ProviderSentiment, SentimentProvider } from "../types";

export interface SentimentProviderInterface {
  name: SentimentProvider;
  fetchSentiment(symbols?: string[]): Promise<ProviderSentiment[]>;
  isAvailable(): Promise<boolean>;
}

export function calculateRatio(longPct: number, shortPct: number): number {
  if (shortPct === 0) {
    return longPct > 0 ? 999 : 0;
  }
  return Number((longPct / shortPct).toFixed(2));
}

export function normalizeSentiment(
  longPct: number,
  shortPct: number,
): { long_pct: number; short_pct: number; net: number; ratio: number } {
  const total = longPct + shortPct;
  if (total === 0) {
    return { long_pct: 50, short_pct: 50, net: 0, ratio: 1 };
  }

  const normalizedLong = (longPct / total) * 100;
  const normalizedShort = (shortPct / total) * 100;

  return {
    long_pct: Number(normalizedLong.toFixed(2)),
    short_pct: Number(normalizedShort.toFixed(2)),
    net: Number((normalizedLong - normalizedShort).toFixed(2)),
    ratio: calculateRatio(normalizedLong, normalizedShort),
  };
}
