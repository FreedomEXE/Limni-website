/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: WeekRow.tsx
 *
 * Description:
 * Collapsed week row for the all-time Basket browser.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import MissingReturnCell from "@/components/common/MissingReturnCell";
import type { BasketWeekSummary } from "@/lib/basket/basketSummaryTypes";
import { formatBasketDate, formatBasketPct, pctTone, resolveBasketRows } from "./basketDisplay";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

type WeekRowProps = {
  week: BasketWeekSummary;
  viewMode: ViewMode;
  expanded: boolean;
  onToggle: () => void;
};

function extremeLabel(label: string, symbol: string, value: number | null) {
  const formatted = formatBasketPct(value) ?? "missing";
  return `${label}: ${symbol} ${formatted}`;
}

export default function WeekRow({ week, viewMode, expanded, onToggle }: WeekRowProps) {
  const resolved = resolveBasketRows(week.returnRows, viewMode);
  const formatted = formatBasketPct(resolved);
  const bestWorst = [
    week.bestPair ? extremeLabel("Best", week.bestPair.symbol, week.bestPair.adrNormalizedPct ?? week.bestPair.rawPct) : null,
    week.worstPair ? extremeLabel("Worst", week.worstPair.symbol, week.worstPair.adrNormalizedPct ?? week.worstPair.rawPct) : null,
  ].filter(Boolean).join(" | ");

  return (
    <button
      type="button"
      data-testid="basket-week-row"
      data-week-open-utc={week.weekOpenUtc}
      onClick={onToggle}
      title={bestWorst || undefined}
      className="grid w-full grid-cols-[minmax(11rem,1fr)_5rem_5rem_7rem] items-center gap-3 rounded-lg border border-(--panel-border) bg-(--panel)/70 px-4 py-3 text-left transition hover:border-(--accent)/40"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="w-4 text-[11px] text-(--muted)">{expanded ? "v" : ">"}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-(--foreground)">
            Week of {formatBasketDate(week.weekOpenUtc)}
          </span>
          <span className="block text-[10px] uppercase tracking-[0.14em] text-(--muted)">
            {week.anchorType} anchor
          </span>
        </span>
      </span>
      <span className="text-xs font-semibold text-(--foreground)">{week.tradeCount}</span>
      <span className="text-xs font-semibold text-(--foreground)">{week.pairCount}</span>
      <span className={`text-right text-sm font-semibold ${pctTone(resolved)}`}>
        {formatted ?? <MissingReturnCell reason={week.warnings[0] ?? "Return unavailable"} />}
      </span>
    </button>
  );
}
