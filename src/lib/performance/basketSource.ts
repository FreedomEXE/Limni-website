/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketSource.ts
 *
 * Description:
 * Canonical historical basket source — the single source of truth for
 * dealer, commercial, sentiment, and strength pair directions per week.
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
 * If COT, sentiment, or strength interpretation changes, fix it HERE. Every
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
import { readCanonicalStrengthDirections } from "@/lib/strength/canonicalDirection";
import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { DateTime } from "luxon";
import type { AssetClass } from "@/lib/cotMarkets";

// ─── Public types ───────────────────────────────────────────────

export type BaseBasketModel = "dealer" | "commercial" | "sentiment" | "strength";

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
    const pairDefs = PAIRS_BY_ASSET_CLASS[ac] ?? [];

    try {
      const snapshot = await readSnapshot({ assetClass: ac, reportDate });
      if (!snapshot) {
        // Missing snapshot — emit explicit NEUTRAL for every known pair (Rule 3+4)
        for (const pd of pairDefs) {
          signals.push({
            weekOpenUtc, model, symbol: pd.pair, assetClass: ac,
            direction: "NEUTRAL", sourceReportDate: reportDate,
            metadata: { reason: "missing_snapshot" },
          });
        }
        continue;
      }

      // Use the same derivation functions as the Data section:
      // FX uses cross-currency (base vs quote), non-FX uses base-only
      const derivedPairs = ac === "fx"
        ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, model)
        : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, model);

      // Emit signals for all known pairs — if derivation skipped a pair, emit NEUTRAL
      for (const pd of pairDefs) {
        const derived = derivedPairs[pd.pair];
        signals.push({
          weekOpenUtc, model, symbol: pd.pair, assetClass: ac,
          direction: (derived?.direction as BasketDirection) ?? "NEUTRAL",
          sourceReportDate: reportDate,
          metadata: derived ? undefined : { reason: "no_derivation" },
        });
      }
    } catch {
      // Error reading snapshot — emit explicit NEUTRAL for every known pair (Rule 4)
      for (const pd of pairDefs) {
        signals.push({
          weekOpenUtc, model, symbol: pd.pair, assetClass: ac,
          direction: "NEUTRAL", sourceReportDate: reportDate,
          metadata: { reason: "snapshot_error" },
        });
      }
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

    if (aggregates.length === 0) {
      // No sentiment data — emit explicit NEUTRAL for all known pairs (Rule 3+4)
      for (const ac of ASSET_CLASSES) {
        for (const pd of (PAIRS_BY_ASSET_CLASS[ac] ?? [])) {
          signals.push({
            weekOpenUtc, model: "sentiment", symbol: pd.pair,
            assetClass: ac, direction: "NEUTRAL", sourceReportDate: null,
            metadata: { reason: "no_sentiment_data" },
          });
        }
      }
      return signals;
    }

    // Build set of symbols with sentiment data for gap detection
    const coveredSymbols = new Set<string>();
    for (const agg of aggregates) {
      coveredSymbols.add(agg.symbol);
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

    // Emit explicit NEUTRAL for known pairs not covered by sentiment (Rule 3)
    for (const ac of ASSET_CLASSES) {
      for (const pd of (PAIRS_BY_ASSET_CLASS[ac] ?? [])) {
        if (!coveredSymbols.has(pd.pair)) {
          signals.push({
            weekOpenUtc, model: "sentiment", symbol: pd.pair,
            assetClass: ac, direction: "NEUTRAL", sourceReportDate: null,
            metadata: { reason: "no_sentiment_coverage" },
          });
        }
      }
    }
  } catch {
    // Error fetching sentiment — emit explicit NEUTRAL for all known pairs (Rule 4)
    for (const ac of ASSET_CLASSES) {
      for (const pd of (PAIRS_BY_ASSET_CLASS[ac] ?? [])) {
        signals.push({
          weekOpenUtc, model: "sentiment", symbol: pd.pair,
          assetClass: ac, direction: "NEUTRAL", sourceReportDate: null,
          metadata: { reason: "sentiment_error" },
        });
      }
    }
  }

  return signals;
}

// ─── Internal: Strength-based resolution ────────────────────────

async function resolveStrengthBasket(
  weekOpenUtc: string,
): Promise<CanonicalBasketSignal[]> {
  try {
    const rows = await readCanonicalStrengthDirections(weekOpenUtc);
    return rows.map((row) => ({
      weekOpenUtc,
      model: "strength",
      symbol: row.pair,
      assetClass: row.assetClass,
      direction: row.direction,
      sourceReportDate: null,
      metadata: {
        availableWindows: row.availableWindows,
        compositeScore: row.compositeScore,
        latestSnapshotUtc: row.latestSnapshotUtc,
        raw1w: row.raw1w,
        raw1m: row.raw1m,
      },
    }));
  } catch {
    const signals: CanonicalBasketSignal[] = [];
    for (const ac of ASSET_CLASSES) {
      for (const pd of (PAIRS_BY_ASSET_CLASS[ac] ?? [])) {
        signals.push({
          weekOpenUtc,
          model: "strength",
          symbol: pd.pair,
          assetClass: ac,
          direction: "NEUTRAL",
          sourceReportDate: null,
          metadata: { reason: "strength_error" },
        });
      }
    }
    return signals;
  }
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
 * Get canonical basket signals for all base models for a single week.
 * This is the ONLY function that should be called for historical basket truth.
 */
export async function getCanonicalBasketWeek(
  weekOpenUtc: string,
): Promise<CanonicalBasketWeek> {
  const [dealer, commercial, sentiment, strength] = await Promise.all([
    resolveCotBasket("dealer", weekOpenUtc),
    resolveCotBasket("commercial", weekOpenUtc),
    resolveSentimentBasket(weekOpenUtc),
    resolveStrengthBasket(weekOpenUtc),
  ]);

  return {
    weekOpenUtc,
    signals: [...dealer, ...commercial, ...sentiment, ...strength],
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
