/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PairRow.tsx
 *
 * Description:
 * Pair aggregate row for the all-time Basket browser.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import MissingReturnCell from "@/components/common/MissingReturnCell";
import type { BasketPairSummary } from "@/lib/basket/basketSummaryTypes";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";
import { formatBasketPct, pctTone, resolveBasketRows } from "./basketDisplay";

type PairRowProps = {
  pair: BasketPairSummary;
  viewMode: ViewMode;
  onOpen: () => void;
};

export default function PairRow({ pair, viewMode, onOpen }: PairRowProps) {
  const resolved = resolveBasketRows(pair.returnRows, viewMode);
  const formatted = formatBasketPct(resolved);

  return (
    <button
      type="button"
      data-testid="basket-pair-row"
      data-symbol={pair.symbol}
      onClick={onOpen}
      className="grid w-full grid-cols-[minmax(7rem,1fr)_5rem_5rem_7rem] items-center gap-3 rounded-lg border border-(--panel-border)/70 bg-(--panel)/45 px-4 py-2.5 text-left transition hover:border-(--accent)/40"
    >
      <span className="text-sm font-semibold text-(--foreground)">{pair.symbol}</span>
      <span className="text-xs text-(--muted)">{pair.strategyCount}</span>
      <span className="text-xs text-(--muted)">{pair.tradeCount}</span>
      <span className={`text-right text-sm font-semibold ${pctTone(resolved)}`}>
        {formatted ?? <MissingReturnCell reason={pair.warnings[0] ?? "Return unavailable"} />}
      </span>
    </button>
  );
}
