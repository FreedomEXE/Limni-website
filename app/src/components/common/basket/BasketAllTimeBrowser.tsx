/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BasketAllTimeBrowser.tsx
 *
 * Description:
 * Lazy-loaded hierarchical all-time Basket browser.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BasketEmptyState from "@/components/common/basket/BasketEmptyState";
import BasketLoadMore from "@/components/common/basket/BasketLoadMore";
import WeekDetailExpanded from "@/components/common/basket/WeekDetailExpanded";
import WeekRow from "@/components/common/basket/WeekRow";
import TradeDrilldownModal from "@/components/common/trades/TradeDrilldownModal";
import SegmentedToggle from "@/components/common/SegmentedToggle";
import type {
  BasketPairSummary,
  BasketWeekPairsResponse,
  BasketWeeksResponse,
  BasketWeekSummary,
} from "@/lib/basket/basketSummaryTypes";
import type { AnchorType, TradeStrategyFamily } from "@/lib/trades/tradeTypes";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

const INITIAL_LIMIT = 8;
const PAGE_LIMIT = 4;
const EMPTY_WEEKS: BasketWeekSummary[] = [];

type WeekSort = "newest" | "oldest";

type PairCacheEntry = {
  pairs: BasketPairSummary[] | null;
  loading: boolean;
  error: string | null;
};

type WeeksState = {
  requestKey: string;
  weeks: BasketWeekSummary[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

type BasketAllTimeBrowserProps = {
  strategyVariant: string;
  strategyFamily: TradeStrategyFamily;
  viewMode: ViewMode;
};

function buildWeeksUrl(strategyVariant: string, anchorType: AnchorType, limit: number, offset: number) {
  const params = new URLSearchParams({
    strategyVariant,
    anchorType,
    limit: String(limit),
    offset: String(offset),
  });
  return `/api/basket/weeks?${params.toString()}`;
}

function buildPairsUrl(weekOpenUtc: string, strategyVariant: string, anchorType: AnchorType) {
  const params = new URLSearchParams({
    weekOpenUtc,
    strategyVariant,
    anchorType,
  });
  return `/api/basket/week-pairs?${params.toString()}`;
}

export default function BasketAllTimeBrowser({
  strategyVariant,
  strategyFamily,
  viewMode,
}: BasketAllTimeBrowserProps) {
  const anchorType = viewMode.anchor;
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [pairCache, setPairCache] = useState<Record<string, PairCacheEntry>>({});
  const [weekSort, setWeekSort] = useState<WeekSort>("newest");
  const [drilldown, setDrilldown] = useState<{ symbol: string; weekOpenUtc: string } | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const requestKey = `${strategyVariant}|${anchorType}`;
  const [weeksState, setWeeksState] = useState<WeeksState>({
    requestKey,
    weeks: [],
    hasMore: false,
    loading: true,
    error: null,
  });
  const weeks = weeksState.requestKey === requestKey ? weeksState.weeks : EMPTY_WEEKS;
  const hasMore = weeksState.requestKey === requestKey ? weeksState.hasMore : false;
  const loadingWeeks = weeksState.requestKey !== requestKey || weeksState.loading;
  const weekError = weeksState.requestKey === requestKey ? weeksState.error : null;

  useEffect(() => {
    let cancelled = false;

    fetch(buildWeeksUrl(strategyVariant, anchorType, INITIAL_LIMIT, 0), { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json()) as BasketWeeksResponse & { error?: string };
        if (!response.ok) throw new Error(json.error ?? `Basket weeks request failed (${response.status})`);
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setWeeksState({
          requestKey,
          weeks: json.weeks,
          hasMore: json.hasMore,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setWeeksState({
          requestKey,
          weeks: [],
          hasMore: false,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [anchorType, requestKey, strategyVariant]);

  const loadMore = useCallback(() => {
    if (loadingWeeks || !hasMore) return;
    setWeeksState((prev) => (
      prev.requestKey === requestKey
        ? { ...prev, loading: true, error: null }
        : prev
    ));
    fetch(buildWeeksUrl(strategyVariant, anchorType, PAGE_LIMIT, weeks.length), { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json()) as BasketWeeksResponse & { error?: string };
        if (!response.ok) throw new Error(json.error ?? `Basket weeks request failed (${response.status})`);
        return json;
      })
      .then((json) => {
        setWeeksState((prev) => (
          prev.requestKey === requestKey
            ? {
                requestKey,
                weeks: [...prev.weeks, ...json.weeks],
                hasMore: json.hasMore,
                loading: false,
                error: null,
              }
            : prev
        ));
      })
      .catch((error) => {
        setWeeksState((prev) => (
          prev.requestKey === requestKey
            ? {
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : String(error),
              }
            : prev
        ));
      });
  }, [anchorType, hasMore, loadingWeeks, requestKey, strategyVariant, weeks.length]);

  useEffect(() => {
    if (!hasMore) return undefined;
    const onScroll = () => {
      const node = loadMoreRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 120) loadMore();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, loadMore]);

  const fetchPairs = useCallback((weekOpenUtc: string) => {
    const cacheKey = `${requestKey}|${weekOpenUtc}`;
    const current = pairCache[cacheKey];
    if (current?.loading || current?.pairs) return;

    setPairCache((prev) => ({
      ...prev,
      [cacheKey]: { pairs: null, loading: true, error: null },
    }));

    fetch(buildPairsUrl(weekOpenUtc, strategyVariant, anchorType), { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json()) as BasketWeekPairsResponse & { error?: string };
        if (!response.ok) throw new Error(json.error ?? `Basket week pairs request failed (${response.status})`);
        return json;
      })
      .then((json) => {
        setPairCache((prev) => ({
          ...prev,
          [cacheKey]: { pairs: json.pairs, loading: false, error: null },
        }));
      })
      .catch((error) => {
        setPairCache((prev) => ({
          ...prev,
          [cacheKey]: {
            pairs: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          },
        }));
      });
  }, [anchorType, pairCache, requestKey, strategyVariant]);

  const toggleWeek = (weekOpenUtc: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekOpenUtc)) next.delete(weekOpenUtc);
      else {
        next.add(weekOpenUtc);
        fetchPairs(weekOpenUtc);
      }
      return next;
    });
  };

  const sortedWeeks = useMemo(() => {
    return [...weeks].sort((left, right) => (
      weekSort === "newest"
        ? right.weekOpenUtc.localeCompare(left.weekOpenUtc)
        : left.weekOpenUtc.localeCompare(right.weekOpenUtc)
    ));
  }, [weekSort, weeks]);

  return (
    <section
      data-testid="basket-all-time-browser"
      className="rounded-2xl border border-(--panel-border) bg-(--panel) p-6 shadow-sm"
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--foreground)">
            Basket All Time
          </p>
          <p className="mt-1 text-xs text-(--muted)">
            Weeks expand to alphabetized pair rows; pair rows open the trade ledger modal.
          </p>
        </div>
        <SegmentedToggle
          value={weekSort}
          onChange={setWeekSort}
          ariaLabel="Sort weeks"
          size="sm"
          items={[
            { value: "newest", label: "Newest" },
            { value: "oldest", label: "Oldest" },
          ]}
        />
      </div>

      <div className="mb-2 grid grid-cols-[minmax(11rem,1fr)_5rem_5rem_7rem] gap-3 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--muted)">
        <span>Week</span>
        <span>Trades</span>
        <span>Pairs</span>
        <span className="text-right">Return</span>
      </div>

      {weekError ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {weekError}
        </div>
      ) : null}

      {!loadingWeeks && !weekError && sortedWeeks.length === 0 ? (
        <BasketEmptyState />
      ) : null}

      <div className="space-y-2">
        {sortedWeeks.map((week) => {
          const cacheKey = `${requestKey}|${week.weekOpenUtc}`;
          const cache = pairCache[cacheKey] ?? { pairs: null, loading: false, error: null };
          const expanded = expandedWeeks.has(week.weekOpenUtc);
          return (
            <div key={week.weekOpenUtc} className="space-y-2">
              <WeekRow
                week={week}
                viewMode={viewMode}
                expanded={expanded}
                onToggle={() => toggleWeek(week.weekOpenUtc)}
              />
              {expanded ? (
                <WeekDetailExpanded
                  pairs={cache.pairs}
                  loading={cache.loading}
                  error={cache.error}
                  viewMode={viewMode}
                  onOpenPair={(pair) => setDrilldown({ symbol: pair.symbol, weekOpenUtc: week.weekOpenUtc })}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {loadingWeeks && weeks.length === 0 ? (
        <div className="rounded-lg border border-(--panel-border) bg-(--panel)/45 px-4 py-3 text-sm text-(--muted)">
          Loading basket history...
        </div>
      ) : null}

      <BasketLoadMore
        ref={loadMoreRef}
        hasMore={hasMore}
        loading={loadingWeeks}
        onLoadMore={loadMore}
      />

      {drilldown ? (
        <TradeDrilldownModal
          symbol={drilldown.symbol}
          weekOpenUtc={drilldown.weekOpenUtc}
          strategyFamily={strategyFamily}
          strategyVariant={strategyVariant}
          anchorType={anchorType}
          onClose={() => setDrilldown(null)}
        />
      ) : null}
    </section>
  );
}
