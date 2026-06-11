/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: WeekDetailExpanded.tsx
 *
 * Description:
 * Expanded all-time Basket week detail with alphabetized pair rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import BasketEmptyState from "@/components/common/basket/BasketEmptyState";
import PairRow from "@/components/common/basket/PairRow";
import type { BasketPairSummary } from "@/lib/basket/basketSummaryTypes";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

type WeekDetailExpandedProps = {
  pairs: BasketPairSummary[] | null;
  loading: boolean;
  error: string | null;
  viewMode: ViewMode;
  onOpenPair: (pair: BasketPairSummary) => void;
};

export default function WeekDetailExpanded({
  pairs,
  loading,
  error,
  viewMode,
  onOpenPair,
}: WeekDetailExpandedProps) {
  const sortedPairs = [...(pairs ?? [])].sort((left, right) => left.symbol.localeCompare(right.symbol));

  return (
    <div data-testid="basket-week-detail" className="ml-6 space-y-2 border-l border-(--panel-border) pl-4">
      <div className="grid grid-cols-[minmax(7rem,1fr)_5rem_5rem_7rem] gap-3 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--muted)">
        <span>Pair</span>
        <span>Strategies</span>
        <span>Trades</span>
        <span className="text-right">Return</span>
      </div>
      {loading ? (
        <div className="rounded-lg border border-(--panel-border) bg-(--panel)/45 px-4 py-3 text-sm text-(--muted)">
          Loading pairs...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
      {!loading && !error && sortedPairs.length === 0 ? (
        <BasketEmptyState message="No pairs traded during this week." />
      ) : null}
      {!loading && !error ? (
        sortedPairs.map((pair) => (
          <PairRow
            key={pair.symbol}
            pair={pair}
            viewMode={viewMode}
            onOpen={() => onOpenPair(pair)}
          />
        ))
      ) : null}
    </div>
  );
}
