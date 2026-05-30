/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketDataSource.ts
 *
 * Description:
 * CLOSED HISTORY DATA SOURCE
 * Currently API-backed (apiBasketDataSource -> /api/basket/closed-history).
 * After v2.0.0 versioning ships, swap to canonBasketDataSource reading from
 * the local versioned canon bundle. UI components consuming this abstraction
 * remain unchanged across that swap.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import type { PerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import { formatPerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import type { ClosedHistoryBundle, ClosedHistoryResponse, CurrentWeekSlice } from "@/lib/basket/basketSummaryTypes";

export interface BasketDataSource {
  loadClosedHistory(opts: {
    strategyVariant: string;
    scope: PerformanceAssetSelection;
  }): Promise<ClosedHistoryBundle>;

  loadCurrentWeekSlice(opts: {
    strategyVariant: string;
    scope: PerformanceAssetSelection;
  }): Promise<CurrentWeekSlice>;
}

const closedHistoryCache = new Map<string, Promise<ClosedHistoryBundle>>();

function closedHistoryKey(strategyVariant: string, scope: PerformanceAssetSelection) {
  return `${strategyVariant}|${formatPerformanceAssetSelection(scope)}`;
}

export const apiBasketDataSource: BasketDataSource = {
  loadClosedHistory(opts) {
    const key = closedHistoryKey(opts.strategyVariant, opts.scope);
    const existing = closedHistoryCache.get(key);
    if (existing) return existing;

    const params = new URLSearchParams({
      strategyVariant: opts.strategyVariant,
      scope: formatPerformanceAssetSelection(opts.scope),
    });
    const promise = fetch(`/api/basket/closed-history?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json()) as ClosedHistoryResponse & { error?: string };
        if (!response.ok) throw new Error(json.error ?? `Basket closed-history request failed (${response.status})`);
        return json.bundle;
      })
      .catch((error) => {
        closedHistoryCache.delete(key);
        throw error;
      });
    closedHistoryCache.set(key, promise);
    return promise;
  },

  async loadCurrentWeekSlice(opts) {
    const bundle = await this.loadClosedHistory(opts);
    return {
      rows: [],
      strategyVariant: bundle.strategyVariant,
      scope: bundle.scope,
      generatedAt: new Date().toISOString(),
    };
  },
};

// Future v2.0.0: export const canonBasketDataSource: BasketDataSource = { ... };
export const basketDataSource = apiBasketDataSource;
