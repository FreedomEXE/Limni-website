/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BasketHierarchy.tsx
 *
 * Description:
 * Canon-backed Basket browser rendered through the shared TradeList.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useMemo, useState } from "react";
import MissingReturnCell from "@/components/common/MissingReturnCell";
import TradeList from "@/components/common/trade-list/TradeList";
import { formatDateLabel, formatSignedPercent } from "@/components/common/trade-list/formatters";
import type { SortState, TradeListColumn, TradeListNode } from "@/components/common/trade-list/types";
import TradeDrilldownModal from "@/components/common/trades/TradeDrilldownModal";
import { buildBasketTradeListNodes } from "@/lib/basket/buildBasketTradeListNodes";
import { basketDataSource } from "@/lib/basket/basketDataSource";
import { resolveBasketHierarchy } from "@/lib/basket/basketHierarchy";
import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { PerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import { getStrategy, resolveStrategyId } from "@/lib/performance/strategyConfig";
import type { AnchorType, TradeStrategyFamily } from "@/lib/trades/tradeTypes";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

type BasketHierarchyProps = {
  strategyVariant: string;
  strategyFamily: TradeStrategyFamily;
  selectedWeek: string;
  currentWeek?: string;
  scope: PerformanceAssetSelection;
  viewMode: ViewMode;
};

type DrilldownTarget = {
  symbol: string;
  weekOpenUtc: string;
  sourceModel?: string | null;
  tier?: number | null;
  direction?: ClosedHistoryRow["direction"];
  parentTradeId?: string | null;
};

function selectedAnchorTradeId(row: ClosedHistoryRow | null | undefined, anchorType: AnchorType) {
  if (!row) return null;
  return anchorType === "canonical" ? row.canonicalTradeId : row.executionTradeId;
}

function sourceLabelMap(strategyId: string) {
  const strategy = getStrategy(strategyId);
  const labels: Record<string, string> = {};
  for (const [model, label] of Object.entries(strategy?.modelLabels ?? {})) {
    if (label) labels[model] = label;
  }
  return labels;
}

function rowWarnings(node: TradeListNode) {
  const rows = node.values.rows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => (row as ClosedHistoryRow).warnings ?? []);
}

const COLUMNS: TradeListColumn[] = [
  {
    key: "label",
    label: "Pair",
    width: "minmax(260px, 2fr)",
  },
  {
    key: "count",
    label: "Structure",
    width: "minmax(110px, 0.8fr)",
  },
  {
    key: "date",
    label: "Date",
    sortable: true,
    defaultDirection: "desc",
    width: "minmax(140px, 0.9fr)",
    format: (value) => formatDateLabel(value),
  },
  {
    key: "returnPct",
    label: "Return",
    align: "right",
    sortable: true,
    defaultDirection: "desc",
    width: "minmax(96px, 0.6fr)",
    format: (value, node) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return formatSignedPercent(value, 2);
      }
      const warnings = rowWarnings(node);
      return warnings.length > 0
        ? <MissingReturnCell reason={warnings[0] ?? "Missing return"} />
        : "--";
    },
  },
];

export default function BasketHierarchy({
  strategyVariant,
  strategyFamily,
  selectedWeek,
  scope,
  viewMode,
}: BasketHierarchyProps) {
  const [sort, setSort] = useState<SortState>({ key: "date", direction: "desc" });
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null);
  const strategyId = resolveStrategyId(strategyVariant.split("-")[0] ?? strategyVariant);
  const strategy = getStrategy(strategyId);
  if (!strategy) {
    throw new Error(`Unknown strategy config for basket hierarchy: ${strategyId}`);
  }
  const levels = resolveBasketHierarchy(strategy, strategyVariant);
  const bundle = basketDataSource.getClosedHistorySnapshot?.({ strategyVariant, scope }) ?? null;
  const sourceLabels = sourceLabelMap(strategyId);

  const nodes = useMemo(() => {
    if (!bundle) return [];
    return buildBasketTradeListNodes({
      rows: bundle.rows,
      strategy,
      strategyVariant,
      selectedWeek,
      viewMode,
      sourceLabels,
      sort,
    });
  }, [bundle, selectedWeek, sort, sourceLabels, strategy, strategyVariant, viewMode]);

  const handleNodeClick = (node: TradeListNode) => {
    const row = node.values.row as ClosedHistoryRow | undefined;
    const parentRow = node.values.parentRow as ClosedHistoryRow | undefined;
    if (!row) return;
    const parentTradeId = row.rowKind === "grid" || row.rowKind === "fill"
      ? selectedAnchorTradeId(parentRow ?? row, viewMode.anchor)
      : null;
    setDrilldown({
      symbol: row.symbol,
      weekOpenUtc: row.weekOpenUtc,
      sourceModel: levels.includes("portfolio") ? row.sourceModel : undefined,
      tier: levels.includes("tier") ? row.tier : undefined,
      direction: row.direction,
      parentTradeId,
    });
  };

  return (
    <section data-testid="basket-hierarchy" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--foreground)">Basket</p>
          <p className="mt-1 text-xs text-(--muted)">
            {selectedWeek === "all" ? "All closed weeks" : formatDateLabel(selectedWeek)}
          </p>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--muted)">
          Canon {bundle ? "ready" : "unavailable"}
        </p>
      </div>

      <TradeList
        nodes={nodes}
        columns={COLUMNS}
        sort={sort}
        onSortChange={setSort}
        onNodeClick={handleNodeClick}
        density="compact"
        emptyState={
          bundle
            ? "No basket rows matched this week, strategy, and scope."
            : "Canon bundle is not loaded. Refresh the app to rerun the v2 preload."
        }
      />

      {drilldown ? (
        <TradeDrilldownModal
          symbol={drilldown.symbol}
          weekOpenUtc={drilldown.weekOpenUtc}
          strategyFamily={strategyFamily}
          strategyVariant={strategyVariant}
          anchorType={viewMode.anchor}
          sourceModel={drilldown.sourceModel ?? undefined}
          tier={drilldown.tier ?? undefined}
          direction={drilldown.direction ?? undefined}
          parentTradeId={drilldown.parentTradeId ?? undefined}
          onClose={() => setDrilldown(null)}
        />
      ) : null}
    </section>
  );
}
