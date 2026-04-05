import { DateTime } from "luxon";

import type { AssetClass } from "@/lib/cotMarkets";
import type { Direction } from "@/lib/cotTypes";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getPairReturn } from "@/lib/pairReturns";
import { getCanonicalInstrument } from "@/lib/canonicalInstruments";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { fetchOandaCandleSeries } from "@/lib/oandaPrices";
import { fetchBitgetSpotCandleSeries } from "@/lib/bitget";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { readWeeklyPairStrengths, type WeeklyPairStrength } from "@/lib/strength/weeklyStrength";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

type StrengthLookback = {
  raw1w: number | null;
  raw1m: number | null;
};

export type CanonicalStrengthDirection = {
  pair: string;
  assetClass: AssetClass;
  direction: Exclude<Direction, "NEUTRAL">;
  availableWindows: number;
  compositeScore: number;
  latestSnapshotUtc: string | null;
  raw1w: number | null;
  raw1m: number | null;
};

const CANONICAL_STRENGTH_CACHE_TTL_MS = 5 * 60 * 1000;
const strengthLookbackCache = new Map<string, Promise<StrengthLookback>>();

function signDirection(value: number | null): Exclude<Direction, "NEUTRAL"> | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value > 0) return "LONG";
  if (value < 0) return "SHORT";
  return null;
}

async function fetchWeeklyReturnFallback(
  symbol: string,
  assetClass: AssetClass,
  weekOpenUtc: string,
): Promise<number | null> {
  const instrument = getCanonicalInstrument(symbol);
  if (!instrument?.isActive) {
    return null;
  }

  const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);

  try {
    if (instrument.primaryProvider === "oanda" && instrument.oandaInstrument) {
      const candles = await fetchOandaCandleSeries(symbol, window.openUtc, window.closeUtc);
      if (candles.length === 0) return null;
      const open = candles[0]?.open ?? NaN;
      const close = candles.at(-1)?.close ?? NaN;
      if (!Number.isFinite(open) || !Number.isFinite(close) || open <= 0) return null;
      return ((close - open) / open) * 100;
    }

    if (instrument.primaryProvider === "bitget" && instrument.bitgetBaseCoin) {
      const candles = await fetchBitgetSpotCandleSeries(instrument.bitgetBaseCoin, {
        openUtc: window.openUtc,
        closeUtc: window.closeUtc,
      });
      if (candles.length === 0) return null;
      const open = candles[0]?.open ?? NaN;
      const close = candles.at(-1)?.close ?? NaN;
      if (!Number.isFinite(open) || !Number.isFinite(close) || open <= 0) return null;
      return ((close - open) / open) * 100;
    }
  } catch {
    return null;
  }

  return null;
}

async function readStoredExactPriorWeeklyReturn(
  symbol: string,
  weekOpenUtc: string,
): Promise<number | null> {
  const stored = await getPairReturn(symbol, "weekly", weekOpenUtc);
  return stored?.returnPct ?? null;
}

async function loadStrengthLookback(
  symbol: string,
  assetClass: AssetClass,
  weekOpenUtc: string,
  mode: "stored_only" | "fill_missing_with_provider",
): Promise<StrengthLookback> {
  const cacheKey = `${mode}:${symbol}:${assetClass}:${weekOpenUtc}`;
  const cached = strengthLookbackCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const baseTime = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    if (!baseTime.isValid) {
      return { raw1w: null, raw1m: null };
    }

    const exactPriorWeeks = await Promise.all(
      [1, 2, 3, 4].map(async (weeksBack) => {
        const priorWeekOpenUtc = baseTime.minus({ weeks: weeksBack }).toUTC().toISO();
        if (!priorWeekOpenUtc) {
          return null;
        }
        const stored = await readStoredExactPriorWeeklyReturn(symbol, priorWeekOpenUtc);
        if (stored !== null || mode === "stored_only") {
          return stored;
        }
        return fetchWeeklyReturnFallback(symbol, assetClass, priorWeekOpenUtc);
      }),
    );

    const raw1w = exactPriorWeeks[0] ?? null;
    const monthlyComponents = exactPriorWeeks.filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );

    return {
      raw1w,
      raw1m: monthlyComponents.length > 0
        ? monthlyComponents.reduce((sum, value) => sum + value, 0)
        : null,
    };
  })();

  strengthLookbackCache.set(cacheKey, promise);
  return promise;
}

function resolveStrengthHybrid(
  ps: WeeklyPairStrength | null,
  lookback: StrengthLookback,
): Exclude<Direction, "NEUTRAL"> | null {
  let score = 0;
  let windows = 0;

  for (const w of ps?.windows ?? []) {
    if (w.direction === "LONG") {
      score += 1;
      windows += 1;
    } else if (w.direction === "SHORT") {
      score -= 1;
      windows += 1;
    } else if (w.available) {
      windows += 1;
    }
  }

  const weeklyDir = signDirection(lookback.raw1w);
  if (weeklyDir === "LONG") {
    score += 1;
    windows += 1;
  } else if (weeklyDir === "SHORT") {
    score -= 1;
    windows += 1;
  }

  const monthlyDir = signDirection(lookback.raw1m);
  if (monthlyDir === "LONG") {
    score += 1;
    windows += 1;
  } else if (monthlyDir === "SHORT") {
    score -= 1;
    windows += 1;
  }

  if (windows === 0) {
    return null;
  }

  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
}

function resolveStrengthHybridFallback(
  ps: WeeklyPairStrength | null,
  lookback: StrengthLookback,
): Exclude<Direction, "NEUTRAL"> {
  const base = resolveStrengthHybrid(ps, lookback);
  if (base) {
    return base;
  }

  let sum = 0;
  let hasData = false;
  for (const value of [
    ...(ps?.windows.map((w) =>
      w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)
        ? w.signedSpread
        : null,
    ) ?? []),
    lookback.raw1w,
    lookback.raw1m,
  ]) {
    if (value === null || !Number.isFinite(value)) continue;
    sum += value;
    hasData = true;
  }

  if (hasData && sum !== 0) {
    return sum > 0 ? "LONG" : "SHORT";
  }

  return (
    signDirection(lookback.raw1m) ??
    signDirection(lookback.raw1w) ??
    signDirection(ps?.windows.find((w) => w.window === "24h")?.signedSpread ?? null) ??
    signDirection(ps?.windows.find((w) => w.window === "4h")?.signedSpread ?? null) ??
    signDirection(ps?.windows.find((w) => w.window === "1h")?.signedSpread ?? null) ??
    "LONG"
  );
}

export async function readCanonicalStrengthDirections(
  weekOpenUtc: string,
): Promise<CanonicalStrengthDirection[]> {
  const normalizedWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  return getOrSetRuntimeCache(
    `canonicalStrength:${normalizedWeekOpenUtc}`,
    CANONICAL_STRENGTH_CACHE_TTL_MS,
    async () => {
      const rows = await readWeeklyPairStrengths(normalizedWeekOpenUtc);
      const rowMap = new Map(rows.map((row) => [row.pair.toUpperCase(), row] as const));
      const resolved: CanonicalStrengthDirection[] = [];

      for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
        for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
          const pair = pairDef.pair.toUpperCase();
          const ps = rowMap.get(pair) ?? null;
          let lookback = await loadStrengthLookback(pair, assetClass, normalizedWeekOpenUtc, "stored_only");
          let direction = resolveStrengthHybrid(ps, lookback);
          if (!direction) {
            lookback = await loadStrengthLookback(
              pair,
              assetClass,
              normalizedWeekOpenUtc,
              "fill_missing_with_provider",
            );
            direction = resolveStrengthHybridFallback(ps, lookback);
          }
          resolved.push({
            pair,
            assetClass,
            direction,
            availableWindows: ps?.availableWindows ?? 0,
            compositeScore: ps?.compositeScore ?? 0,
            latestSnapshotUtc: ps?.latestSnapshotUtc ?? null,
            raw1w: lookback.raw1w,
            raw1m: lookback.raw1m,
          });
        }
      }

      return resolved;
    },
  );
}
