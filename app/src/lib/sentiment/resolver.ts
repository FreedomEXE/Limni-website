/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: resolver.ts
 *
 * Description:
 * Canonical sentiment resolver — the single source of truth for weekly
 * sentiment directions. Preserves the existing S1 baseline first, then
 * resolves neutral rows through the researched A -> R -> F cascade.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";

import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { sentimentDirectionFromAggregate } from "@/lib/sentiment/daily";
import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

const SENTIMENT_RESOLVER_CACHE_TTL_MS = 5 * 60 * 1000;

export type CanonicalSentimentDirection = {
  symbol: string;
  assetClass: AssetClass;
  direction: "LONG" | "SHORT";
  tier: "S1" | "A" | "R" | "F";
  tierFSubStep?: "prior_s1" | "prior_lean" | "two_week_lean" | "hardcoded" | null;
  aggLongPct: number | null;
  crowdingState: string | null;
  flipState: string | null;
};

type SentimentWeekBundle = {
  current: Map<string, SentimentAggregate>;
  prior1: Map<string, SentimentAggregate>;
  prior2: Map<string, SentimentAggregate>;
};

function toAggMap(aggregates: SentimentAggregate[]) {
  return new Map(aggregates.map((agg) => [agg.symbol.toUpperCase(), agg] as const));
}

async function loadWeekAggregates(weekOpenUtc: string) {
  const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!open.isValid) {
    return [];
  }
  const close = open.plus({ days: 7 });
  return getAggregatesForWeekStartWithBackfill(
    open.toUTC().toISO() ?? weekOpenUtc,
    close.toUTC().toISO() ?? weekOpenUtc,
  );
}

async function loadResolverBundle(weekOpenUtc: string): Promise<SentimentWeekBundle> {
  const normalizedWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const open = DateTime.fromISO(normalizedWeekOpenUtc, { zone: "utc" });
  if (!open.isValid) {
    throw new Error(`Invalid sentiment resolver weekOpenUtc: ${weekOpenUtc}`);
  }

  const [current, prior1, prior2] = await Promise.all([
    loadWeekAggregates(normalizedWeekOpenUtc),
    loadWeekAggregates(open.minus({ weeks: 1 }).toUTC().toISO() ?? normalizedWeekOpenUtc),
    loadWeekAggregates(open.minus({ weeks: 2 }).toUTC().toISO() ?? normalizedWeekOpenUtc),
  ]);

  return {
    current: toAggMap(current),
    prior1: toAggMap(prior1),
    prior2: toAggMap(prior2),
  };
}

export function resolveSentimentDirectionFromRows(options: {
  symbol: string;
  assetClass: AssetClass;
  currentAgg: SentimentAggregate | null;
  prior1Agg: SentimentAggregate | null;
  prior2Agg: SentimentAggregate | null;
}): CanonicalSentimentDirection {
  const { symbol, assetClass, currentAgg, prior1Agg, prior2Agg } = options;

  const base = {
    symbol,
    assetClass,
    aggLongPct: currentAgg?.agg_long_pct ?? null,
    crowdingState: currentAgg?.crowding_state ?? null,
    flipState: currentAgg?.flip_state ?? null,
  };

  const s1 = currentAgg ? sentimentDirectionFromAggregate(currentAgg) : "NEUTRAL";
  if (s1 === "LONG" || s1 === "SHORT") {
    return { ...base, direction: s1, tier: "S1", tierFSubStep: null };
  }

  const priorS1 = prior1Agg ? sentimentDirectionFromAggregate(prior1Agg) : "NEUTRAL";
  if (priorS1 === "LONG" || priorS1 === "SHORT") {
    return { ...base, direction: priorS1, tier: "A", tierFSubStep: null };
  }

  const currentLongPct = currentAgg?.agg_long_pct ?? null;
  if (currentLongPct !== null) {
    if (currentLongPct > 50) {
      return { ...base, direction: "SHORT", tier: "R", tierFSubStep: null };
    }
    if (currentLongPct < 50) {
      return { ...base, direction: "LONG", tier: "R", tierFSubStep: null };
    }
  }

  const priorS1ForFallback = prior1Agg ? sentimentDirectionFromAggregate(prior1Agg) : "NEUTRAL";
  if (priorS1ForFallback === "LONG" || priorS1ForFallback === "SHORT") {
    return { ...base, direction: priorS1ForFallback, tier: "F", tierFSubStep: "prior_s1" };
  }

  const priorLongPct = prior1Agg?.agg_long_pct ?? null;
  if (priorLongPct !== null) {
    if (priorLongPct > 50) {
      return { ...base, direction: "SHORT", tier: "F", tierFSubStep: "prior_lean" };
    }
    if (priorLongPct < 50) {
      return { ...base, direction: "LONG", tier: "F", tierFSubStep: "prior_lean" };
    }
  }

  const twoWeekValues = [prior1Agg?.agg_long_pct ?? null, prior2Agg?.agg_long_pct ?? null]
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (twoWeekValues.length > 0) {
    const avg = twoWeekValues.reduce((sum, value) => sum + value, 0) / twoWeekValues.length;
    if (avg > 50) {
      return { ...base, direction: "SHORT", tier: "F", tierFSubStep: "two_week_lean" };
    }
    if (avg < 50) {
      return { ...base, direction: "LONG", tier: "F", tierFSubStep: "two_week_lean" };
    }
  }

  return { ...base, direction: "SHORT", tier: "F", tierFSubStep: "hardcoded" };
}

export async function resolveSentimentDirections(
  weekOpenUtc: string,
): Promise<CanonicalSentimentDirection[]> {
  const normalizedWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  return getOrSetRuntimeCache(
    `sentimentResolver:${normalizedWeekOpenUtc}`,
    SENTIMENT_RESOLVER_CACHE_TTL_MS,
    async () => {
      const bundle = await loadResolverBundle(normalizedWeekOpenUtc);
      const resolved: CanonicalSentimentDirection[] = [];

      for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
        for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
          const symbol = pairDef.pair.toUpperCase();
          resolved.push(
            resolveSentimentDirectionFromRows({
              symbol,
              assetClass,
              currentAgg: bundle.current.get(symbol) ?? null,
              prior1Agg: bundle.prior1.get(symbol) ?? null,
              prior2Agg: bundle.prior2.get(symbol) ?? null,
            }),
          );
        }
      }

      return resolved;
    },
  );
}
