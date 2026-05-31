/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BasketHierarchy.tsx
 *
 * Description:
 * Canon-backed Basket browser rendered with the established Performance
 * basket row language.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useMemo, useState } from "react";
import MissingReturnCell from "@/components/common/MissingReturnCell";
import { formatDateLabel, formatSignedPercent } from "@/components/common/trade-list/formatters";
import type { TradeListNode } from "@/components/common/trade-list/types";
import { buildBasketTradeListNodes } from "@/lib/basket/buildBasketTradeListNodes";
import { basketDataSource } from "@/lib/basket/basketDataSource";
import { resolveBasketHierarchy } from "@/lib/basket/basketHierarchy";
import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { PerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import { getStrategy, resolveStrategyId } from "@/lib/performance/strategyConfig";
import type { TradeStrategyFamily } from "@/lib/trades/tradeTypes";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

type BasketHierarchyProps = {
  strategyVariant: string;
  strategyFamily: TradeStrategyFamily;
  selectedWeek: string;
  currentWeek?: string;
  scope: PerformanceAssetSelection;
  viewMode: ViewMode;
};

function sourceLabelMap(strategyId: string) {
  const strategy = getStrategy(strategyId);
  const labels: Record<string, string> = {};
  for (const [model, label] of Object.entries(strategy?.modelLabels ?? {})) {
    if (label) labels[model] = label;
  }
  return labels;
}

function rowsForNode(node: TradeListNode): ClosedHistoryRow[] {
  const rows = node.values.rows;
  return Array.isArray(rows) ? rows as ClosedHistoryRow[] : [];
}

function primaryRow(node: TradeListNode) {
  const row = node.values.row;
  if (row && typeof row === "object") return row as ClosedHistoryRow;
  return rowsForNode(node)[0] ?? null;
}

function rowWarnings(node: TradeListNode) {
  const rows = rowsForNode(node);
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => row.warnings ?? []);
}

function pctTone(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) < 0.005) {
    return "text-[color:var(--muted)]";
  }
  return value > 0 ? "text-lime-500" : "text-rose-500";
}

function directionTone(direction: ClosedHistoryRow["direction"]) {
  if (direction === "LONG") return "text-emerald-600";
  if (direction === "SHORT") return "text-rose-500";
  return "text-[color:var(--muted)]";
}

function titleForLevel(node: TradeListNode) {
  if (node.level === "fill") return `Fill ${primaryRow(node)?.fillSeq ?? "--"}`;
  if (node.level === "trade") return primaryRow(node)?.symbol ?? node.label;
  return node.label;
}

function childSummary(node: TradeListNode) {
  const rows = rowsForNode(node);
  if (node.level === "week") {
    const count = node.children?.length ?? 0;
    if (count === 0) return "";
    if (node.children?.[0]?.level === "portfolio") return `${count} ${count === 1 ? "portfolio" : "portfolios"}`;
    if (node.children?.[0]?.level === "tier") return `${count} ${count === 1 ? "tier" : "tiers"}`;
    return `${count} ${count === 1 ? "pair" : "pairs"}`;
  }
  if (node.level === "portfolio" || node.level === "tier") {
    const grids = rows.filter((row) => row.rowKind === "grid").length;
    const trades = rows.filter((row) => row.rowKind === "trade").length;
    if (grids > 0) return `${grids} ${grids === 1 ? "grid" : "grids"}`;
    if (trades > 0) return `${trades} ${trades === 1 ? "trade" : "trades"}`;
  }
  if (node.level === "symbol") {
    const grids = rows.filter((row) => row.rowKind === "grid").length;
    const trades = rows.filter((row) => row.rowKind === "trade").length;
    if (grids > 0) return `${grids} ${grids === 1 ? "grid" : "grids"}`;
    if (trades > 0) return `${trades} ${trades === 1 ? "trade" : "trades"}`;
  }
  if (node.level === "grid") {
    const fills = node.children?.length ?? rows.filter((row) => row.rowKind === "fill").length;
    return `${fills} ${fills === 1 ? "fill" : "fills"}`;
  }
  return "";
}

type BasketVisibleStats = {
  weekCount: number;
  portfolioCount: number;
  tierCount: number;
  symbolCount: number;
  gridCount: number;
  fillCount: number;
  tradeCount: number;
  wins: number;
  losses: number;
};

function emptyStats(): BasketVisibleStats {
  return {
    weekCount: 0,
    portfolioCount: 0,
    tierCount: 0,
    symbolCount: 0,
    gridCount: 0,
    fillCount: 0,
    tradeCount: 0,
    wins: 0,
    losses: 0,
  };
}

function mergeStats(left: BasketVisibleStats, right: BasketVisibleStats) {
  left.weekCount += right.weekCount;
  left.portfolioCount += right.portfolioCount;
  left.tierCount += right.tierCount;
  left.symbolCount += right.symbolCount;
  left.gridCount += right.gridCount;
  left.fillCount += right.fillCount;
  left.tradeCount += right.tradeCount;
  left.wins += right.wins;
  left.losses += right.losses;
  return left;
}

function visibleStats(nodes: TradeListNode[]): BasketVisibleStats {
  const stats = emptyStats();
  for (const node of nodes) {
    if (node.level === "week") stats.weekCount += 1;
    if (node.level === "portfolio") stats.portfolioCount += 1;
    if (node.level === "tier") stats.tierCount += 1;
    if (node.level === "symbol") stats.symbolCount += 1;
    if (node.level === "grid") stats.gridCount += 1;
    if (node.level === "fill") stats.fillCount += 1;
    if (node.level === "trade") stats.tradeCount += 1;

    if (node.level === "fill" || node.level === "trade") {
      const value = node.values.returnPct;
      if (typeof value === "number" && Number.isFinite(value)) {
        if (value > 0) stats.wins += 1;
        else stats.losses += 1;
      }
    }

    if (node.children?.length) mergeStats(stats, visibleStats(node.children));
  }
  return stats;
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function headerSegments(stats: BasketVisibleStats, selectedWeek: string, levels: string[]) {
  const segments: string[] = [];
  if (selectedWeek === "all" && stats.weekCount > 0) segments.push(plural(stats.weekCount, "week"));
  if (levels.includes("portfolio") && stats.portfolioCount > 0) segments.push(plural(stats.portfolioCount, "portfolio", "portfolios"));
  if (levels.includes("tier") && stats.tierCount > 0) segments.push(plural(stats.tierCount, "tier"));
  if (stats.gridCount > 0) segments.push(plural(stats.gridCount, "grid"));
  const leafLabel = stats.fillCount > 0 ? plural(stats.fillCount, "fill") : plural(stats.tradeCount, "trade");
  segments.push(leafLabel);
  return segments;
}

function InlineTradeDetail({ node }: { node: TradeListNode }) {
  const row = primaryRow(node);
  if (!row) return null;
  const tradeId = row.executionTradeId ?? row.canonicalTradeId ?? "--";
  return (
    <div className="ml-7 mt-1 grid gap-2 rounded-lg border border-[var(--panel-border)]/60 bg-[var(--panel)]/55 px-4 py-3 text-[11px] text-[color:var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <span className="block uppercase tracking-[0.16em]">Entry</span>
        <span className="font-semibold text-[var(--foreground)]">{row.entryUtc ? formatDateLabel(row.entryUtc) : "--"}</span>
      </div>
      <div>
        <span className="block uppercase tracking-[0.16em]">Exit</span>
        <span className="font-semibold text-[var(--foreground)]">{row.exitUtc ? formatDateLabel(row.exitUtc) : "--"}</span>
      </div>
      <div>
        <span className="block uppercase tracking-[0.16em]">Reason</span>
        <span className="font-semibold text-[var(--foreground)]">{row.exitReason ?? "--"}</span>
      </div>
      <div className="min-w-0">
        <span className="block uppercase tracking-[0.16em]">Trade ID</span>
        <span className="block truncate font-mono text-[10px] text-[var(--foreground)]" title={tradeId}>
          {tradeId}
        </span>
      </div>
    </div>
  );
}

function BasketNodeRow({
  node,
  depth = 0,
}: {
  node: TradeListNode;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = Boolean(node.children?.length);
  const row = primaryRow(node);
  const value = node.values.returnPct;
  const warnings = rowWarnings(node);
  const summary = childSummary(node);
  const isLeaf = node.level === "fill" || node.level === "trade";
  const canExpand = hasChildren || isLeaf;

  return (
    <div>
      <button
        type="button"
        onClick={() => canExpand ? setExpanded((current) => !current) : undefined}
        className="flex w-full items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-2.5 text-left transition hover:border-[var(--accent)]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        style={{ paddingLeft: `${16 + depth * 22}px` }}
        aria-expanded={canExpand ? expanded : undefined}
        data-testid="basket-canon-row"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="w-4 shrink-0 text-[10px] text-[color:var(--muted)]">
            {canExpand ? expanded ? "▾" : "▸" : ""}
          </span>
          <span className={`${node.level === "symbol" || isLeaf ? "font-mono" : ""} min-w-[9rem] max-w-[20rem] truncate text-sm font-semibold text-[var(--foreground)]`}>
            {titleForLevel(node)}
          </span>
          {row?.direction && isLeaf ? (
            <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${directionTone(row.direction)}`}>
              {row.direction}
            </span>
          ) : null}
          {node.assetClass ? (
            <span className="rounded-full border border-[var(--panel-border)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
              {node.assetClass}
            </span>
          ) : null}
          {summary ? (
            <span className="text-[10px] text-[color:var(--muted)]">
              {summary}
            </span>
          ) : null}
          {row?.sourceModel && isLeaf ? (
            <span className="text-[10px] text-[color:var(--muted)]">
              {row.sourceModel}
            </span>
          ) : null}
        </div>
        <span className={`ml-4 shrink-0 text-sm font-semibold ${pctTone(value)}`}>
          {typeof value === "number" && Number.isFinite(value)
            ? formatSignedPercent(value, 2)
            : warnings.length > 0
              ? <MissingReturnCell reason={warnings[0] ?? "Missing return"} />
              : "--"}
        </span>
      </button>

      {expanded && hasChildren ? (
        <div className="mt-1 space-y-1">
          {node.children?.map((child) => (
            <BasketNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
      {expanded && !hasChildren && isLeaf ? <InlineTradeDetail node={node} /> : null}
    </div>
  );
}

export default function BasketHierarchy({
  strategyVariant,
  selectedWeek,
  scope,
  viewMode,
}: BasketHierarchyProps) {
  const strategyId = resolveStrategyId(strategyVariant.split("-")[0] ?? strategyVariant);
  const strategy = getStrategy(strategyId);
  if (!strategy) {
    throw new Error(`Unknown strategy config for basket hierarchy: ${strategyId}`);
  }
  const levels = resolveBasketHierarchy(strategy, strategyVariant);
  const bundle = basketDataSource.getClosedHistorySnapshot?.({ strategyVariant, scope }) ?? null;

  // The canon tree can be large; keep this memoized even though strategy config
  // is an imported object that the React compiler cannot prove immutable.
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const nodes = useMemo(() => {
    if (!bundle) return [];
    const labels = sourceLabelMap(strategyId);
    return buildBasketTradeListNodes({
      rows: bundle.rows,
      strategy,
      strategyVariant,
      selectedWeek,
      viewMode,
      sourceLabels: labels,
    });
  }, [bundle, selectedWeek, strategy, strategyId, strategyVariant, viewMode]);
  /* eslint-enable react-hooks/preserve-manual-memoization */

  const stats = useMemo(() => visibleStats(nodes), [nodes]);
  const totalReturn = nodes.reduce((sum, node) => {
    const value = node.values.returnPct;
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
  const periodLabel = selectedWeek === "all" ? "All closed weeks" : formatDateLabel(selectedWeek);
  const segments = headerSegments(stats, selectedWeek, levels);

  return (
    <section
      data-testid="basket-hierarchy"
      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
            {strategyVariant.replace(/-/g, " · ")} · {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4 text-xs">
          {segments.map((segment) => (
            <span key={segment} className="text-[color:var(--muted)]">{segment}</span>
          ))}
          <span className="font-semibold text-lime-500">{stats.wins}W</span>
          <span className="font-semibold text-rose-500">{stats.losses}L</span>
          <span className={`font-bold ${pctTone(totalReturn)}`}>{formatSignedPercent(totalReturn, 2)}</span>
        </div>
      </div>

      <div className="max-h-[65vh] space-y-1.5 overflow-y-auto">
        {!bundle ? (
          <div className="rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-3 text-xs text-[color:var(--muted)]">
            Canon bundle is not loaded. Refresh the app to rerun the v2 preload.
          </div>
        ) : nodes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-3 text-xs text-[color:var(--muted)]">
            No basket rows matched this week, strategy, and scope.
          </div>
        ) : (
          nodes.map((node) => <BasketNodeRow key={node.id} node={node} />)
        )}
      </div>
    </section>
  );
}
