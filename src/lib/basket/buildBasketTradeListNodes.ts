/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: buildBasketTradeListNodes.ts
 *
 * Description:
 * Converts canon basket rows into shared TradeList nodes.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import { hierarchyWithoutWeek, resolveBasketHierarchy } from "@/lib/basket/basketHierarchy";
import type { StrategyConfig } from "@/lib/performance/strategyConfig";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";
import {
  resolveDisplayDrawdown,
  resolveDisplayReturn,
  type ReturnMatrix,
} from "@/lib/viewMode/resolveDisplayValue";
import type { TradeListNode, SortState } from "@/components/common/trade-list/types";

type BuildBasketTradeListNodesOptions = {
  rows: ClosedHistoryRow[];
  strategy: StrategyConfig;
  strategyVariant: string;
  selectedWeek: string;
  viewMode: ViewMode;
  sourceLabels?: Record<string, string>;
  sort?: SortState;
};

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

function uniqueCount<T>(values: T[]) {
  return new Set(values).size;
}

function aggregateRows(rows: ClosedHistoryRow[]) {
  return rows.filter((row) => row.rowKind !== "fill");
}

function returnValue(rows: ClosedHistoryRow[], viewMode: ViewMode) {
  const values = rows
    .map((row): ReturnMatrix => ({
      canonical: row.returnMatrix.canonical,
      execution: row.returnMatrix.execution,
      adrPct: row.returnMatrix.adrPct,
    }))
    .map((matrix) => resolveDisplayReturn(matrix, viewMode))
    .filter((value): value is number => value !== null);
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}

function formatLevelPrice(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1000) return value.toFixed(2);
  if (Math.abs(value) >= 100) return value.toFixed(3);
  if (Math.abs(value) >= 10) return value.toFixed(4);
  return value.toFixed(5);
}

function maxRiskValue(rows: ClosedHistoryRow[], viewMode: ViewMode, field: "mae" | "pathDrawdown") {
  const values = rows
    .map((row) => resolveDisplayDrawdown(row.riskMatrix, viewMode, field))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length === 0 ? null : Math.max(...values);
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

function sourceDisplay(sourceModel: string | null, sourceLabels: Record<string, string>) {
  if (!sourceModel) return "Unknown";
  return sourceLabels[sourceModel] ?? sourceModel.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tierDisplay(tier: string) {
  if (tier === "1") return "Tier 1 — High Confidence";
  if (tier === "2") return "Tier 2 — Medium Confidence";
  if (tier === "3") return "Tier 3 — Low Confidence";
  return `Tier ${tier}`;
}

function parentNaturalRef(row: ClosedHistoryRow) {
  return [
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
}

function countPreview(rows: ClosedHistoryRow[], hasGrid: boolean) {
  if (hasGrid) {
    const grids = rows.filter((row) => row.rowKind === "grid").length;
    const fills = rows.filter((row) => row.rowKind === "fill").length;
    return `${grids}G · ${fills}F`;
  }
  const trades = rows.filter((row) => row.rowKind === "trade").length;
  return `${trades}T`;
}

function weekPreview(rows: ClosedHistoryRow[], levels: string[]) {
  const hasPortfolio = levels.includes("portfolio");
  const hasTier = levels.includes("tier");
  const hasGrid = levels.includes("grid");
  const pieces: string[] = [];
  if (hasPortfolio) pieces.push(`${uniqueCount(rows.map((row) => row.sourceModel ?? "unknown"))}P`);
  if (hasTier) pieces.push(`${uniqueCount(rows.map((row) => row.tier ?? -1))}Tiers`);
  pieces.push(countPreview(rows, hasGrid));
  return pieces.join(" · ");
}

function sortEntries(
  entries: Array<[string, ClosedHistoryRow[]]>,
  sort: SortState | undefined,
  viewMode: ViewMode,
  defaultCompare: (left: [string, ClosedHistoryRow[]], right: [string, ClosedHistoryRow[]]) => number,
) {
  if (sort?.key === "returnPct") {
    return entries.sort((left, right) => {
      const leftValue = returnValue(aggregateRows(left[1]), viewMode) ?? 0;
      const rightValue = returnValue(aggregateRows(right[1]), viewMode) ?? 0;
      return sort.direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
    });
  }
  return entries.sort(defaultCompare);
}

function tradeTime(value: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function compareTradeOrder(left: ClosedHistoryRow, right: ClosedHistoryRow) {
  const entryDiff = tradeTime(left.entryUtc) - tradeTime(right.entryUtc);
  if (entryDiff !== 0) return entryDiff;
  const fillDiff = (left.fillSeq ?? Number.MAX_SAFE_INTEGER) - (right.fillSeq ?? Number.MAX_SAFE_INTEGER);
  if (fillDiff !== 0) return fillDiff;
  const exitDiff = tradeTime(left.exitUtc) - tradeTime(right.exitUtc);
  if (exitDiff !== 0) return exitDiff;
  return (left.executionTradeId ?? left.canonicalTradeId ?? "").localeCompare(
    right.executionTradeId ?? right.canonicalTradeId ?? "",
  );
}

function node(
  id: string,
  level: string,
  label: string,
  rows: ClosedHistoryRow[],
  viewMode: ViewMode,
  values: Record<string, unknown>,
  children?: TradeListNode[],
): TradeListNode {
  return {
    id,
    level,
    label,
    values: {
      ...values,
      returnPct: returnValue(level === "fill" || level === "trade" || level === "level" ? rows : aggregateRows(rows), viewMode),
      maxMaePct: maxRiskValue(rows, viewMode, "mae"),
      maxPathDrawdownPct: maxRiskValue(rows, viewMode, "pathDrawdown"),
      rows,
    },
    assetClass: level === "symbol" ? rows[0]?.assetClass : undefined,
    direction: level === "fill" || level === "trade" ? rows[0]?.direction ?? null : undefined,
    children,
    expandable: Boolean(children?.length),
  };
}

export function buildBasketTradeListNodes({
  rows,
  strategy,
  strategyVariant,
  selectedWeek,
  viewMode,
  sourceLabels = {},
  sort,
}: BuildBasketTradeListNodesOptions): TradeListNode[] {
  const levels = resolveBasketHierarchy(strategy, strategyVariant);
  const visibleLevels = selectedWeek === "all" ? levels : hierarchyWithoutWeek(levels);
  const selectedRows = selectedWeek === "all"
    ? rows
    : rows.filter((row) => row.weekOpenUtc === selectedWeek);
  const hasGrid = levels.includes("grid");
  const parentRowsByRef = new Map(
    selectedRows
      .filter((row) => row.rowKind === "grid")
      .map((row) => [parentNaturalRef(row), row]),
  );

  const buildLeaves = (leafRows: ClosedHistoryRow[], parentId: string) =>
    [...leafRows]
      .sort(compareTradeOrder)
      .map((row, index) => node(
        `${parentId}|${row.rowKind}|${row.canonicalTradeId ?? row.executionTradeId ?? row.fillSeq ?? "row"}`,
        row.rowKind,
        row.rowKind === "fill" ? `Fill ${index + 1}` : row.symbol,
        [row],
        viewMode,
        {
          date: row.entryUtc,
          count: row.rowKind === "fill" ? row.exitReason ?? "Fill" : "Trade",
          displayFillSeq: row.rowKind === "fill" ? index + 1 : null,
          sourceFillSeq: row.fillSeq,
          row,
          parentRow: row.rowKind === "fill" && row.parentNaturalRef
            ? parentRowsByRef.get(row.parentNaturalRef)
            : row,
        },
      ));

  const buildLevels = (fillRows: ClosedHistoryRow[], parentId: string) =>
    [...groupBy(
      fillRows,
      (row) => [
        formatLevelPrice(row.entryPrice),
        formatLevelPrice(row.exitPrice),
        row.exitReason ?? "",
      ].join("|"),
    ).entries()]
      .sort((left, right) => {
        const leftEntry = left[1][0]?.entryPrice ?? Number.POSITIVE_INFINITY;
        const rightEntry = right[1][0]?.entryPrice ?? Number.POSITIVE_INFINITY;
        if (leftEntry !== rightEntry) return rightEntry - leftEntry;
        return compareTradeOrder(left[1][0]!, right[1][0]!);
      })
      .map(([levelKey, rowsForLevel], index) => {
        const first = rowsForLevel[0] ?? null;
        const label = first
          ? `${formatLevelPrice(first.entryPrice)} -> ${formatLevelPrice(first.exitPrice)}`
          : `Level ${index + 1}`;
        return node(
          `${parentId}|level|${levelKey}`,
          "level",
          label,
          rowsForLevel,
          viewMode,
          {
            date: first?.entryUtc ?? null,
            count: `${rowsForLevel.length}F`,
            row: first,
            parentRow: first,
          },
          buildLeaves(rowsForLevel, `${parentId}|level|${levelKey}`),
        );
      });

  const buildGrids = (gridRows: ClosedHistoryRow[], parentId: string) => {
    const fillsByParentRef = groupBy(
      gridRows.filter((row) => row.rowKind === "fill" && row.parentNaturalRef),
      (row) => row.parentNaturalRef ?? "",
    );

    return gridRows
      .filter((row) => row.rowKind === "grid")
      .sort(compareTradeOrder)
      .map((grid, index) => {
        const ref = parentNaturalRef(grid);
        const fills = fillsByParentRef.get(ref) ?? [];
        return node(
          `${parentId}|grid|${grid.canonicalTradeId ?? grid.executionTradeId ?? index}`,
          "grid",
          "Grid",
          [grid],
          viewMode,
          {
            date: grid.entryUtc,
            count: `${fills.length}F`,
            row: grid,
            parentRow: grid,
          },
          buildLevels(fills, `${parentId}|grid|${grid.canonicalTradeId ?? grid.executionTradeId ?? index}`),
        );
      });
  };

  const buildSymbols = (symbolRows: ClosedHistoryRow[], parentId: string) =>
    sortEntries(
      [...groupBy(symbolRows, (row) => row.symbol).entries()],
      sort,
      viewMode,
      ([left], [right]) => left.localeCompare(right),
    ).map(([symbol, rowsForSymbol]) => node(
      `${parentId}|symbol|${symbol}`,
      "symbol",
      symbol,
      rowsForSymbol,
      viewMode,
      {
        date: rowsForSymbol[0]?.weekOpenUtc ?? null,
        count: countPreview(rowsForSymbol, hasGrid),
      },
      hasGrid
        ? buildGrids(rowsForSymbol, `${parentId}|symbol|${symbol}`)
        : buildLeaves(rowsForSymbol.filter((row) => row.rowKind === "trade"), `${parentId}|symbol|${symbol}`),
    ));

  const buildTiers = (tierRows: ClosedHistoryRow[], parentId: string) =>
    [...groupBy(tierRows, (row) => String(row.tier ?? 0)).entries()]
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([tier, rowsForTier]) => node(
        `${parentId}|tier|${tier}`,
        "tier",
        tierDisplay(tier),
        rowsForTier,
        viewMode,
        {
          date: rowsForTier[0]?.weekOpenUtc ?? null,
          count: countPreview(rowsForTier, hasGrid),
        },
        buildSymbols(rowsForTier, `${parentId}|tier|${tier}`),
      ));

  const buildPortfolios = (portfolioRows: ClosedHistoryRow[], parentId: string) =>
    sortEntries(
      [...groupBy(portfolioRows, (row) => row.sourceModel ?? "unknown").entries()],
      sort,
      viewMode,
      ([left], [right]) => sourceDisplay(left, sourceLabels).localeCompare(sourceDisplay(right, sourceLabels)),
    ).map(([source, rowsForSource]) => node(
      `${parentId}|portfolio|${source}`,
      "portfolio",
      sourceDisplay(source, sourceLabels),
      rowsForSource,
      viewMode,
      {
        date: rowsForSource[0]?.weekOpenUtc ?? null,
        count: countPreview(rowsForSource, hasGrid),
      },
      buildSymbols(rowsForSource, `${parentId}|portfolio|${source}`),
    ));

  const buildNext = (nextRows: ClosedHistoryRow[], parentId: string) => {
    if (visibleLevels.includes("portfolio")) return buildPortfolios(nextRows, parentId);
    if (visibleLevels.includes("tier")) return buildTiers(nextRows, parentId);
    return buildSymbols(nextRows, parentId);
  };

  if (selectedWeek !== "all") return buildNext(selectedRows, `selected-week|${selectedWeek}`);

  const weekEntries = [...groupBy(selectedRows, (row) => row.weekOpenUtc).entries()];
  const sortedWeeks = sort?.key === "returnPct"
    ? sortEntries(weekEntries, sort, viewMode, ([left], [right]) => right.localeCompare(left))
    : weekEntries.sort(([left], [right]) => {
      const direction = sort?.key === "date" ? sort.direction : "desc";
      return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
    });

  return sortedWeeks.map(([week, weekRows]) => node(
    `week|${week}`,
    "week",
    formatWeekLabel(week),
    weekRows,
    viewMode,
    {
      date: week,
      count: weekPreview(weekRows, levels),
    },
    buildNext(weekRows, `week|${week}`),
  ));
}
