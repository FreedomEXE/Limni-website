/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BasketLoadMore.tsx
 *
 * Description:
 * Pagination trigger for the all-time Basket browser.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { forwardRef } from "react";

type BasketLoadMoreProps = {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
};

const BasketLoadMore = forwardRef<HTMLDivElement, BasketLoadMoreProps>(function BasketLoadMore(
  { hasMore, loading, onLoadMore },
  ref,
) {
  if (!hasMore) {
    return (
      <div ref={ref} className="px-3 py-2 text-center text-xs uppercase tracking-[0.16em] text-(--muted)">
        End of basket history
      </div>
    );
  }

  return (
    <div ref={ref} className="flex justify-center pt-2" data-testid="basket-load-more">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className="rounded-full border border-(--panel-border) px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong) disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Loading..." : "Load More"}
      </button>
    </div>
  );
});

export default BasketLoadMore;
