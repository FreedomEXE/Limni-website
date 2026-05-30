/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BasketHierarchy.tsx
 *
 * Description:
 * Bundle-backed Basket hierarchy. Week selector determines entry point.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";
import BasketEmptyState from "@/components/common/basket/BasketEmptyState";
import BasketHierarchyLevel from "@/components/common/basket/BasketHierarchyLevel";
import HierarchySortControl, { type HierarchySortMode } from "@/components/common/basket/HierarchySortControl";
import TradeDrilldownModal from "@/components/common/trades/TradeDrilldownModal";
import { basketDataSource } from "@/lib/basket/basketDataSource";
import { hierarchyWithoutWeek, resolveBasketHierarchy, type BasketLevel } from "@/lib/basket/basketHierarchy";
import type { ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { AssetClass } from "@/lib/cotMarkets";
import { getStrategy, resolveStrategyId } from "@/lib/performance/strategyConfig";
import { formatPerformanceAssetSelection, type PerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import type { AnchorType, TradeStrategyFamily } from "@/lib/trades/tradeTypes";
import { resolveDisplayReturn, type ReturnMatrix } from "@/lib/viewMode/resolveDisplayValue";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

type BasketHierarchyProps = {
  strategyVariant: string;
  strategyFamily: TradeStrategyFamily;
  selectedWeek: string;
  currentWeek?: string;
  scope: PerformanceAssetSelection;
  viewMode: ViewMode;
};

type BundleState = {
  key: string;
  bundle: ClosedHistoryBundle | null;
  loading: boolean;
  error: string | null;
};

type DrilldownTarget = {
  symbol: string;
  weekOpenUtc: string;
  sourceModel?: string | null;
  tier?: number | null;
  direction?: ClosedHistoryRow["direction"];
  parentTradeId?: string | null;
};

const EMPTY_ROWS: ClosedHistoryRow[] = [];

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function pctTone(value: number | null) {
  if (value === null) return "text-(--muted)";
  if (value > 0) return "text-lime-400";
  if (value < 0) return "text-red-400";
  return "text-(--muted)";
}

function formatWeekLabel(weekOpenUtc: string) {
  const parsed = new Date(weekOpenUtc);
  if (Number.isNaN(parsed.getTime())) return weekOpenUtc;
  return `Week of ${parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().replace(".000Z", "Z");
}

function returnValue(rows: ClosedHistoryRow[], viewMode: ViewMode) {
  const matrices: ReturnMatrix[] = rows.map((row) => ({
    canonical: row.returnMatrix.canonical,
    execution: row.returnMatrix.execution,
    adrPct: row.returnMatrix.adrPct ?? 0,
  }));
  const values = matrices
    .map((row) => resolveDisplayReturn(row, viewMode))
    .filter((value): value is number => value !== null);
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}

function aggregateRows(rows: ClosedHistoryRow[]) {
  return rows.filter((row) => row.rowKind !== "fill");
}

function selectedAnchorTradeId(row: ClosedHistoryRow, anchorType: AnchorType) {
  return anchorType === "canonical" ? row.canonicalTradeId : row.executionTradeId;
}

function uniqueCount<T>(values: T[]) {
  return new Set(values).size;
}

function preview(rows: ClosedHistoryRow[], levels: BasketLevel[]) {
  const includePortfolio = levels.includes("portfolio");
  const includeTier = levels.includes("tier");
  const includeGrid = levels.includes("grid");
  const pieces: string[] = [];
  if (includePortfolio) pieces.push(`${uniqueCount(rows.map((row) => row.sourceModel ?? "unknown"))} Portfolios`);
  if (includeTier) pieces.push(`${uniqueCount(rows.map((row) => row.tier ?? -1))} Tiers`);
  if (includeGrid) {
    pieces.push(`${rows.filter((row) => row.rowKind === "grid").length} Grids`);
    pieces.push(`${rows.filter((row) => row.rowKind === "fill").length} Fills`);
  } else {
    pieces.push(`${rows.filter((row) => row.rowKind === "trade").length} Trades`);
  }
  return pieces.join(" · ");
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return map;
}

function displaySource(sourceModel: string | null, labels: Record<string, string>) {
  if (!sourceModel) return "Unknown";
  return labels[sourceModel] ?? sourceModel.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function sourceLabelMap(strategyId: string) {
  const strategy = getStrategy(strategyId);
  const labels: Record<string, string> = {};
  for (const [model, label] of Object.entries(strategy?.modelLabels ?? {})) {
    if (label) labels[model] = label;
  }
  return labels;
}

function sortGroups(
  entries: Array<[string, ClosedHistoryRow[]]>,
  mode: HierarchySortMode,
  viewMode: ViewMode,
  defaultCompare: (left: [string, ClosedHistoryRow[]], right: [string, ClosedHistoryRow[]]) => number,
) {
  if (mode === "return") {
    return entries.sort((left, right) =>
      (returnValue(aggregateRows(right[1]), viewMode) ?? 0) - (returnValue(aggregateRows(left[1]), viewMode) ?? 0),
    );
  }
  return entries.sort(defaultCompare);
}

export default function BasketHierarchy({
  strategyVariant,
  strategyFamily,
  selectedWeek,
  currentWeek,
  scope,
  viewMode,
}: BasketHierarchyProps) {
  const strategyId = resolveStrategyId(strategyVariant.split("-")[0] ?? strategyVariant);
  const strategy = getStrategy(strategyId);
  if (!strategy) {
    throw new Error(`Unknown strategy config for basket hierarchy: ${strategyId}`);
  }
  const levels = resolveBasketHierarchy(strategy, strategyVariant);
  const visibleLevels = selectedWeek === "all" ? levels : hierarchyWithoutWeek(levels);
  const sourceLabels = sourceLabelMap(strategyId);
  const requestKey = `${strategyVariant}|${formatPerformanceAssetSelection(scope)}`;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<Record<string, HierarchySortMode>>({});
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null);
  const [state, setState] = useState<BundleState>({
    key: requestKey,
    bundle: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    basketDataSource.loadClosedHistory({ strategyVariant, scope })
      .then((bundle) => {
        if (!cancelled) setState({ key: requestKey, bundle, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            key: requestKey,
            bundle: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, scope, strategyVariant]);

  const loading = state.key !== requestKey || state.loading;
  const error = state.key === requestKey ? state.error : null;
  const rows = state.key === requestKey ? state.bundle?.rows ?? EMPTY_ROWS : EMPTY_ROWS;
  const selectedRows = selectedWeek === "all"
    ? rows
    : rows.filter((row) => row.weekOpenUtc === selectedWeek);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setLevelSort = (key: string, next: HierarchySortMode) => {
    setSortMode((prev) => ({ ...prev, [key]: next }));
  };

  const renderReturn = (groupRows: ClosedHistoryRow[]) => {
    const value = returnValue(aggregateRows(groupRows), viewMode);
    return { value, text: formatPct(value), tone: pctTone(value) };
  };

  const openModal = (row: ClosedHistoryRow, parentRow?: ClosedHistoryRow | null) => {
    const activeParentId = parentRow ? selectedAnchorTradeId(parentRow, viewMode.anchor) : null;
    setDrilldown({
      symbol: row.symbol,
      weekOpenUtc: row.weekOpenUtc,
      sourceModel: levels.includes("portfolio") ? row.sourceModel : undefined,
      tier: levels.includes("tier") ? row.tier : undefined,
      direction: row.direction,
      parentTradeId: activeParentId,
    });
  };

  const parentByNaturalRef = useMemo(() => {
    const map = new Map<string, ClosedHistoryRow>();
    for (const row of rows) {
      if (row.rowKind !== "grid") continue;
      const ref = [
        "parent",
        row.origin,
        row.strategyFamily,
        row.strategyVariant,
        row.symbol,
        row.weekOpenUtc,
        row.sourceModel ?? "",
        row.tier ?? -1,
        row.direction ?? "",
      ].join("|");
      map.set(ref, row);
    }
    return map;
  }, [rows]);

  const renderLeaves = (leafRows: ClosedHistoryRow[], parentId: string, depth: number) => {
    const sorted = [...leafRows].sort((left, right) => (left.fillSeq ?? 0) - (right.fillSeq ?? 0));
    return (
      <div className="space-y-2" style={{ marginLeft: depth * 18 }}>
        {sorted.map((row) => {
          const activeParent = row.rowKind === "fill" && row.parentNaturalRef
            ? parentByNaturalRef.get(row.parentNaturalRef) ?? null
            : row;
          const value = returnValue([row], viewMode);
          const label = row.rowKind === "fill"
            ? `Fill ${row.fillSeq ?? "--"} · ${row.symbol} ${row.direction ?? "--"}`
            : `${row.symbol} ${row.direction ?? "--"}`;
          const nodeId = `${parentId}|${row.rowKind}|${row.canonicalTradeId ?? row.executionTradeId ?? row.fillSeq ?? "row"}`;
          return (
            <BasketHierarchyLevel
              key={nodeId}
              node={{
                id: nodeId,
                level: row.rowKind === "fill" ? "fill" : "trade",
                label,
                preview: `${formatDateTime(row.entryUtc)} -> ${formatDateTime(row.exitUtc)}`,
                returnText: formatPct(value),
                returnTone: pctTone(value),
                expandable: false,
                testId: row.rowKind === "fill" ? "basket-fill-row" : "basket-trade-row",
                onClick: () => openModal(row, activeParent),
              }}
            />
          );
        })}
      </div>
    );
  };

  const renderGridLevel = (groupRows: ClosedHistoryRow[], parentId: string, depth: number) => {
    const grids = [...groupRows.filter((row) => row.rowKind === "grid")]
      .sort((left, right) => left.symbol.localeCompare(right.symbol));
    return (
      <div className="space-y-2" style={{ marginLeft: depth * 18 }}>
        {grids.map((grid, index) => {
          const id = `${parentId}|grid|${grid.parentNaturalRef ?? grid.symbol}|${index}`;
          const isOpen = expanded.has(id);
          const fillRows = groupRows
            .filter((row) => row.rowKind === "fill" && row.parentNaturalRef)
            .filter((row) => row.parentNaturalRef === [
              "parent",
              grid.origin,
              grid.strategyFamily,
              grid.strategyVariant,
              grid.symbol,
              grid.weekOpenUtc,
              grid.sourceModel ?? "",
              grid.tier ?? -1,
              grid.direction ?? "",
            ].join("|"));
          const value = returnValue([grid], viewMode);
          return (
            <div key={id} className="space-y-2">
              <BasketHierarchyLevel
                node={{
                  id,
                  level: "grid",
                  label: "Grid",
                  preview: `${fillRows.length} Fills`,
                  returnText: formatPct(value),
                  returnTone: pctTone(value),
                  expandable: true,
                  expanded: isOpen,
                  testId: "basket-grid-row",
                  onClick: () => openModal(grid, grid),
                  onToggle: () => toggle(id),
                }}
              />
              {isOpen ? renderLeaves(fillRows, id, depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSymbols = (groupRows: ClosedHistoryRow[], parentId: string, depth: number) => {
    const sortKey = `${parentId}|symbols`;
    const mode = sortMode[sortKey] ?? "default";
    const symbolGroups = sortGroups(
      [...groupBy(groupRows, (row) => row.symbol).entries()],
      mode,
      viewMode,
      ([left], [right]) => left.localeCompare(right),
    );
    const hasGrid = levels.includes("grid");
    return (
      <div className="space-y-2" style={{ marginLeft: depth * 18 }}>
        <div className="flex justify-end">
          <HierarchySortControl value={mode} onChange={(next) => setLevelSort(sortKey, next)} />
        </div>
        {symbolGroups.map(([symbol, rowsForSymbol]) => {
          const id = `${parentId}|symbol|${symbol}`;
          const isOpen = expanded.has(id);
          const { text, tone } = renderReturn(rowsForSymbol);
          const assetClass = rowsForSymbol[0]?.assetClass as AssetClass | undefined;
          const gridCount = rowsForSymbol.filter((row) => row.rowKind === "grid").length;
          const tradeCount = rowsForSymbol.filter((row) => row.rowKind === "trade").length;
          const fillCount = rowsForSymbol.filter((row) => row.rowKind === "fill").length;
          return (
            <div key={id} className="space-y-2">
              <BasketHierarchyLevel
                node={{
                  id,
                  level: "symbol",
                  label: symbol,
                  preview: hasGrid ? `${gridCount} Grids · ${fillCount} Fills` : `${tradeCount} Trade${tradeCount === 1 ? "" : "s"}`,
                  returnText: text,
                  returnTone: tone,
                  assetClass,
                  expandable: true,
                  expanded: isOpen,
                  testId: "basket-symbol-row",
                  onClick: () => toggle(id),
                }}
              />
              {isOpen
                ? hasGrid
                  ? renderGridLevel(rowsForSymbol, id, depth + 1)
                  : renderLeaves(rowsForSymbol.filter((row) => row.rowKind === "trade"), id, depth + 1)
                : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTierLevel = (groupRows: ClosedHistoryRow[], parentId: string, depth: number) => {
    const tierGroups = [...groupBy(groupRows, (row) => String(row.tier ?? 0)).entries()]
      .sort(([left], [right]) => Number(left) - Number(right));
    return (
      <div className="space-y-2" style={{ marginLeft: depth * 18 }}>
        {tierGroups.map(([tier, tierRows]) => {
          const id = `${parentId}|tier|${tier}`;
          const isOpen = expanded.has(id);
          const { text, tone } = renderReturn(tierRows);
          const gridCount = tierRows.filter((row) => row.rowKind === "grid").length;
          const tradeCount = tierRows.filter((row) => row.rowKind === "trade").length;
          return (
            <div key={id} className="space-y-2">
              <BasketHierarchyLevel
                node={{
                  id,
                  level: "tier",
                  label: `Tier ${tier}`,
                  preview: levels.includes("grid") ? `${gridCount} Grids` : `${tradeCount} Trades`,
                  returnText: text,
                  returnTone: tone,
                  expandable: true,
                  expanded: isOpen,
                  testId: "basket-tier-row",
                  onClick: () => toggle(id),
                }}
              />
              {isOpen ? renderSymbols(tierRows, id, depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderPortfolioLevel = (groupRows: ClosedHistoryRow[], parentId: string, depth: number) => {
    const sortKey = `${parentId}|portfolios`;
    const mode = sortMode[sortKey] ?? "default";
    const portfolioGroups = sortGroups(
      [...groupBy(groupRows, (row) => row.sourceModel ?? "unknown").entries()],
      mode,
      viewMode,
      ([left], [right]) => displaySource(left, sourceLabels).localeCompare(displaySource(right, sourceLabels)),
    );
    return (
      <div className="space-y-2" style={{ marginLeft: depth * 18 }}>
        <div className="flex justify-end">
          <HierarchySortControl value={mode} onChange={(next) => setLevelSort(sortKey, next)} />
        </div>
        {portfolioGroups.map(([source, portfolioRows]) => {
          const id = `${parentId}|portfolio|${source}`;
          const isOpen = expanded.has(id);
          const { text, tone } = renderReturn(portfolioRows);
          const gridCount = portfolioRows.filter((row) => row.rowKind === "grid").length;
          const tradeCount = portfolioRows.filter((row) => row.rowKind === "trade").length;
          return (
            <div key={id} className="space-y-2">
              <BasketHierarchyLevel
                node={{
                  id,
                  level: "portfolio",
                  label: displaySource(source, sourceLabels),
                  preview: levels.includes("grid") ? `${gridCount} Grids` : `${tradeCount} Trades`,
                  returnText: text,
                  returnTone: tone,
                  expandable: true,
                  expanded: isOpen,
                  testId: "basket-portfolio-row",
                  onClick: () => toggle(id),
                }}
              />
              {isOpen ? renderSymbols(portfolioRows, id, depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderNext = (groupRows: ClosedHistoryRow[], parentId: string, depth: number) => {
    if (visibleLevels.includes("portfolio")) return renderPortfolioLevel(groupRows, parentId, depth);
    if (visibleLevels.includes("tier")) return renderTierLevel(groupRows, parentId, depth);
    return renderSymbols(groupRows, parentId, depth);
  };

  const renderWeeks = () => {
    const sortKey = "weeks";
    const mode = sortMode[sortKey] ?? "default";
    const weekGroups = [...groupBy(selectedRows, (row) => row.weekOpenUtc).entries()];
    const sortedWeeks = mode === "return"
      ? sortGroups(weekGroups, mode, viewMode, ([left], [right]) => right.localeCompare(left))
      : weekGroups.sort(([left], [right]) => (mode === "oldest" ? left.localeCompare(right) : right.localeCompare(left)));

    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <HierarchySortControl
            value={mode}
            onChange={(next) => setLevelSort(sortKey, next)}
            includeOldest
          />
        </div>
        {sortedWeeks.map(([week, weekRows]) => {
          const id = `week|${week}`;
          const isOpen = expanded.has(id);
          const { text, tone } = renderReturn(weekRows);
          return (
            <div key={id} className="space-y-2">
              <BasketHierarchyLevel
                node={{
                  id,
                  level: "week",
                  label: formatWeekLabel(week),
                  preview: preview(weekRows, levels),
                  returnText: text,
                  returnTone: tone,
                  expandable: true,
                  expanded: isOpen,
                  testId: "basket-week-row",
                  onClick: () => toggle(id),
                }}
              />
              {isOpen ? renderNext(weekRows, id, 1) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section data-testid="basket-hierarchy" className="rounded-2xl border border-(--panel-border) bg-(--panel) p-6 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--foreground)">Basket Hierarchy</p>
        <p className="mt-1 text-xs text-(--muted)">
          {selectedWeek === "all" ? "All closed weeks" : formatWeekLabel(selectedWeek)}
          {currentWeek && selectedWeek === currentWeek ? " · current week uses live slice when available" : ""}
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-(--panel-border) bg-(--panel)/45 px-4 py-3 text-sm text-(--muted)">
          Loading basket history...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
      {!loading && !error && selectedRows.length === 0 ? (
        <BasketEmptyState message="No basket rows matched this week, strategy, and scope." />
      ) : null}
      {!loading && !error && selectedRows.length > 0 ? (
        selectedWeek === "all" ? renderWeeks() : renderNext(selectedRows, `selected-week|${selectedWeek}`, 0)
      ) : null}

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
