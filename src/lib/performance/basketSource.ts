/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketSource.ts
 *
 * Description:
 * Canonical historical basket source — the single source of truth for
 * dealer, commercial, and sentiment pair directions per week.
 *
 * This module sits BELOW the strategy engine and ABOVE raw data stores.
 * It wraps the same reads the Data section uses (readSnapshot, sentiment
 * aggregates) so that every section — Data, Performance, Matrix, Research,
 * Automation — gets the same historical basket truth.
 *
 * The engine consumes this module's output to compose derived strategies
 * (tiered_v3, agree_2of3, tandem). It must NOT independently rebuild
 * base-model directions from raw snapshot reads.
 *
 * If COT or sentiment interpretation changes, fix it HERE. Every
 * downstream section inherits the update automatically.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readSnapshot } from "@/lib/cotStore";
import { derivePairDirectionsWithNeutral, derivePairDirectionsByBaseWithNeutral } from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "@/lib/sentiment/daily";
import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { DateTime } from "luxon";
import type { AssetClass } from "@/lib/cotMarkets";

// ─── Public types ───────────────────────────────────────────────

export type BaseBasketModel = "dealer" | "commercial" | "sentiment";

export type BasketDirection = "LONG" | "SHORT" | "NEUTRAL";

export type CanonicalBasketSignal = {
  weekOpenUtc: string;
  model: BaseBasketModel;
  symbol: string;
  assetClass: string;
  direction: BasketDirection;
  sourceReportDate?: string | null;
  metadata?: Record<string, unknown>;
};

export type CanonicalBasketWeek = {
  weekOpenUtc: string;
  signals: CanonicalBasketSignal[];
};

// ─── Internal: COT-based resolution (dealer/commercial) ────────

const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "commodities", "crypto"];

async function resolveCotBasket(
  model: "dealer" | "commercial",
  weekOpenUtc: string,
): Promise<CanonicalBasketSignal[]> {
  const reportDate = deriveCotReportDate(weekOpenUtc);
  const signals: CanonicalBasketSignal[] = [];

  for (const ac of ASSET_CLASSES) {
    try {
      const snapshot = await readSnapshot({ assetClass: ac, reportDate });
      if (!snapshot) continue;

      const pairDefs = PAIRS_BY_ASSET_CLASS[ac] ?? [];
      // Use the same derivation functions as the Data section:
      // FX uses cross-currency (base vs quote), non-FX uses base-only
      const derivedPairs = ac === "fx"
        ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, model)
        : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, model);

      for (const [symbol, pairSnapshot] of Object.entries(derivedPairs)) {
        signals.push({
          weekOpenUtc,
          model,
          symbol,
          assetClass: ac,
          direction: pairSnapshot.direction as BasketDirection,
          sourceReportDate: reportDate,
        });
      }
    } catch {
      // Missing snapshot for this asset class/week — skip gracefully
    }
  }

  return signals;
}

// ─── Internal: Sentiment-based resolution ───────────────────────

async function resolveSentimentBasket(
  weekOpenUtc: string,
): Promise<CanonicalBasketSignal[]> {
  const signals: CanonicalBasketSignal[] = [];

  try {
    const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const close = open.plus({ days: 7 });
    const aggregates = await getAggregatesForWeekStartWithBackfill(
      open.toUTC().toISO()!,
      close.toUTC().toISO()!,
    );

    for (const agg of aggregates) {
      const dir = sentimentDirectionFromAggregate(agg);
      const direction: BasketDirection =
        dir === "LONG" ? "LONG" : dir === "SHORT" ? "SHORT" : "NEUTRAL";

      signals.push({
        weekOpenUtc,
        model: "sentiment",
        symbol: agg.symbol,
        assetClass: inferAssetClass(agg.symbol),
        direction,
        sourceReportDate: null,
        metadata: {
          crowdingState: agg.crowding_state,
          flipState: agg.flip_state,
          confidence: agg.confidence_score,
        },
      });
    }
  } catch {
    // Missing sentiment data for this week — return empty
  }

  return signals;
}

// ─── Asset class inference (shared with engine) ─────────────────

const CRYPTO_SYMBOLS = new Set(["BTCUSD", "ETHUSD", "BTCUSDT", "ETHUSDT", "SOLUSD", "SOLUSDT", "XRPUSD", "XRPUSDT", "DOGUSD", "DOGUSDT", "ADAUSD", "ADAUSDT", "AVAUSD", "AVAUSDT", "LINKUSD", "DOTUSDT"]);
const INDEX_SYMBOLS = new Set(["SPXUSD", "SPX500", "SPX500USD", "NDXUSD", "NDX100", "NAS100USD", "NIKKEIUSD", "JPN225", "JPN225USD", "UKXUSD", "UK100", "DEUUSD", "DE30", "DE40"]);
const COMMODITY_SYMBOLS = new Set(["XAUUSD", "XAGUSD", "WTIUSD", "BCOUSD", "NGUSD"]);

function inferAssetClass(symbol: string): string {
  const upper = symbol.toUpperCase().replace(/[/.]/g, "");
  if (CRYPTO_SYMBOLS.has(upper)) return "crypto";
  if (INDEX_SYMBOLS.has(upper)) return "indices";
  if (COMMODITY_SYMBOLS.has(upper)) return "commodities";
  return "fx";
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Get canonical basket signals for all three base models for a single week.
 * This is the ONLY function that should be called for historical basket truth.
 */
export async function getCanonicalBasketWeek(
  weekOpenUtc: string,
): Promise<CanonicalBasketWeek> {
  const [dealer, commercial, sentiment] = await Promise.all([
    resolveCotBasket("dealer", weekOpenUtc),
    resolveCotBasket("commercial", weekOpenUtc),
    resolveSentimentBasket(weekOpenUtc),
  ]);

  return {
    weekOpenUtc,
    signals: [...dealer, ...commercial, ...sentiment],
  };
}

/**
 * Get canonical basket signals for multiple weeks.
 * Returns a map keyed by weekOpenUtc for fast lookup.
 */
export async function getCanonicalBasketWeeks(
  weekOpenUtcs: string[],
): Promise<Record<string, CanonicalBasketWeek>> {
  const result: Record<string, CanonicalBasketWeek> = {};
  // Process sequentially to avoid overwhelming DB connections
  for (const weekOpenUtc of weekOpenUtcs) {
    result[weekOpenUtc] = await getCanonicalBasketWeek(weekOpenUtc);
  }
  return result;
}

// ─── Convenience: filter signals by model ───────────────────────

export function filterByModel(
  week: CanonicalBasketWeek,
  model: BaseBasketModel,
): CanonicalBasketSignal[] {
  return week.signals.filter((s) => s.model === model);
}

export function nonNeutralSignals(
  signals: CanonicalBasketSignal[],
): CanonicalBasketSignal[] {
  return signals.filter((s) => s.direction !== "NEUTRAL");
}
