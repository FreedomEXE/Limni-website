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

import { useMemo, useState, type ReactNode } from "react";
import MissingReturnCell from "@/components/common/MissingReturnCell";
import { formatDateLabel, formatSignedPercent } from "@/components/common/trade-list/formatters";
import type { TradeListNode } from "@/components/common/trade-list/types";
import { buildBasketTradeListNodes } from "@/lib/basket/buildBasketTradeListNodes";
import { basketDataSource } from "@/lib/basket/basketDataSource";
import { resolveBasketHierarchy } from "@/lib/basket/basketHierarchy";
import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { AssetClass } from "@/lib/cotMarkets";
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

function assetClassTone(assetClass: AssetClass | "all") {
  if (assetClass === "all") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-500";
  if (assetClass === "fx") return "border-sky-500/45 bg-sky-500/15 text-sky-400";
  if (assetClass === "crypto") return "border-orange-500/45 bg-orange-500/15 text-orange-400";
  if (assetClass === "commodities") return "border-yellow-500/45 bg-yellow-500/15 text-yellow-400";
  if (assetClass === "indices") return "border-purple-500/45 bg-purple-500/15 text-purple-400";
  return "border-[var(--panel-border)] text-[color:var(--muted)]";
}

function AssetClassBadge({ assetClass }: { assetClass: AssetClass }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${assetClassTone(assetClass)}`}>
      {assetClass}
    </span>
  );
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

function formatPrice(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1000) return value.toFixed(2);
  if (Math.abs(value) >= 100) return value.toFixed(3);
  if (Math.abs(value) >= 10) return value.toFixed(4);
  return value.toFixed(5);
}

function formatDateTimeLabel(value: string | null) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function formatDuration(entryUtc: string | null, exitUtc: string | null) {
  if (!entryUtc || !exitUtc) return "--";
  const entry = new Date(entryUtc).getTime();
  const exit = new Date(exitUtc).getTime();
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || exit < entry) return "--";
  const totalMinutes = Math.round((exit - entry) / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function resolvedRowReturn(row: ClosedHistoryRow, viewMode: ViewMode) {
  const raw = viewMode.anchor === "canonical"
    ? row.returnMatrix.canonical?.rawPct
    : row.returnMatrix.execution?.rawPct;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (viewMode.normalization === "adr_normalized") {
    return typeof row.returnMatrix.adrPct === "number" && row.returnMatrix.adrPct > 0
      ? raw / row.returnMatrix.adrPct
      : null;
  }
  return raw;
}

function simplePathDrawdown(values: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of values) {
    cumulative += value;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
  }
  return maxDrawdown;
}

function DetailMetric({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div>
      <span className="block uppercase tracking-[0.16em] text-[color:var(--muted)]">{label}</span>
      <span className={`font-semibold ${tone ?? "text-[var(--foreground)]"}`}>{value}</span>
    </div>
  );
}

function ExpandedBranchPanel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 space-y-1 rounded-xl border border-[var(--accent)]/15 bg-[var(--accent)]/[0.025] p-2 shadow-inner shadow-black/5">
      {children}
    </div>
  );
}

function InlineGridDetail({ node, viewMode }: { node: TradeListNode; viewMode: ViewMode }) {
  const row = primaryRow(node);
  const fills = node.children ?? [];
  if (!row) return null;
  const fillRows = fills
    .map((fillNode) => primaryRow(fillNode))
    .filter((fillRow): fillRow is ClosedHistoryRow => Boolean(fillRow));
  const returns = fillRows
    .map((fillRow) => resolvedRowReturn(fillRow, viewMode))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const pathDrawdown = returns.length > 0 ? simplePathDrawdown(returns) : null;
  const violations = fillRows.filter((fillRow) => fillRow.capViolated).length;
  const maxActiveFills = Math.max(0, ...fillRows.map((fillRow) => fillRow.capActiveFillsAtEntry ?? 0));
  const capThreshold = row.capThresholdAtEntry
    ?? fillRows.find((fillRow) => fillRow.capThresholdAtEntry !== null)?.capThresholdAtEntry
    ?? "--";

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--panel-border)]/60 bg-[var(--panel)]/60 px-4 py-3 text-[11px] sm:grid-cols-2 lg:grid-cols-6">
      <DetailMetric label="Window" value={`${formatDateTimeLabel(row.entryUtc)} -> ${formatDateTimeLabel(row.exitUtc)}`} />
      <DetailMetric label="Duration" value={formatDuration(row.entryUtc, row.exitUtc)} />
      <DetailMetric label="Entry / Exit" value={`${formatPrice(row.entryPrice)} -> ${formatPrice(row.exitPrice)}`} />
      <DetailMetric label="Fill Path DD" value={pathDrawdown === null ? "--" : formatSignedPercent(-pathDrawdown, 2)} tone="text-rose-500" />
      <DetailMetric label="Cap" value={`${maxActiveFills}/${capThreshold} max active`} />
      <DetailMetric label="Violations" value={violations} tone={violations > 0 ? "text-rose-500" : "text-lime-500"} />
    </div>
  );
}

function InlineTradeDetail({ node, viewMode }: { node: TradeListNode; viewMode: ViewMode }) {
  const row = primaryRow(node);
  if (!row) return null;
  const tradeId = row.executionTradeId ?? row.canonicalTradeId ?? "--";
  const activeRaw = viewMode.anchor === "canonical"
    ? row.returnMatrix.canonical?.rawPct
    : row.returnMatrix.execution?.rawPct;
  const displayReturn = resolvedRowReturn(row, viewMode);
  const activeRawLabel = viewMode.anchor === "canonical" ? "Canonical Raw" : "Execution Raw";
  const displayLabel = viewMode.normalization === "adr_normalized" ? "Displayed ADR-norm" : "Displayed Raw";

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--panel-border)]/60 bg-[var(--panel)]/60 px-4 py-3 text-[11px] sm:grid-cols-2 lg:grid-cols-6">
      <DetailMetric label="Entry" value={formatDateTimeLabel(row.entryUtc)} />
      <DetailMetric label="Exit" value={formatDateTimeLabel(row.exitUtc)} />
      <DetailMetric label="Duration" value={formatDuration(row.entryUtc, row.exitUtc)} />
      <DetailMetric label="Entry Price" value={formatPrice(row.entryPrice)} />
      <DetailMetric label="Exit Price" value={formatPrice(row.exitPrice)} />
      <DetailMetric label="Exit Reason" value={row.exitReason ?? "--"} />
      <DetailMetric label={activeRawLabel} value={typeof activeRaw === "number" ? formatSignedPercent(activeRaw, 4) : "--"} tone={pctTone(activeRaw)} />
      <DetailMetric label={displayLabel} value={displayReturn === null ? "--" : formatSignedPercent(displayReturn, 4)} tone={pctTone(displayReturn)} />
      <DetailMetric label="ADR Basis" value={row.returnMatrix.adrPct === null ? "--" : `${row.returnMatrix.adrPct.toFixed(4)}%`} />
      <DetailMetric label="Cap At Entry" value={`${row.capActiveFillsAtEntry ?? "--"} / ${row.capThresholdAtEntry ?? "--"}`} tone={row.capViolated ? "text-rose-500" : undefined} />
      <DetailMetric label="Max DD" value="Not captured in v2 canon" />
      <div className="min-w-0 lg:col-span-2">
        <span className="block uppercase tracking-[0.16em] text-[color:var(--muted)]">Trade ID</span>
        <span className="block truncate font-mono text-[10px] font-semibold text-[var(--foreground)]" title={tradeId}>
          {tradeId}
        </span>
      </div>
    </div>
  );
}

function BasketNodeRow({
  node,
  depth = 0,
  viewMode,
  dimmed = false,
  onFocusChange,
}: {
  node: TradeListNode;
  depth?: number;
  viewMode: ViewMode;
  dimmed?: boolean;
  onFocusChange?: (nodeId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [focusedChildId, setFocusedChildId] = useState<string | null>(null);
  const hasChildren = Boolean(node.children?.length);
  const row = primaryRow(node);
  const value = node.values.returnPct;
  const warnings = rowWarnings(node);
  const summary = childSummary(node);
  const isLeaf = node.level === "fill" || node.level === "trade";
  const isGrid = node.level === "grid";
  const canExpand = hasChildren || isLeaf;
  const handleToggle = () => {
    if (!canExpand) return;
    setExpanded((current) => {
      const next = !current;
      onFocusChange?.(next ? node.id : null);
      if (!next) setFocusedChildId(null);
      return next;
    });
  };

  return (
    <div className={`transition duration-150 ${dimmed ? "opacity-35 saturate-50" : "opacity-100"}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          expanded
            ? "border-[var(--accent)]/35 bg-[var(--accent)]/[0.06]"
            : "border-[var(--panel-border)] bg-[var(--panel)]/70 hover:border-[var(--accent)]/30"
        }`}
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
            <AssetClassBadge assetClass={node.assetClass} />
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
        <ExpandedBranchPanel>
          {isGrid ? <InlineGridDetail node={node} viewMode={viewMode} /> : null}
          {node.children?.map((child) => (
            <BasketNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              viewMode={viewMode}
              dimmed={focusedChildId !== null && focusedChildId !== child.id}
              onFocusChange={setFocusedChildId}
            />
          ))}
        </ExpandedBranchPanel>
      ) : null}
      {expanded && !hasChildren && isLeaf ? (
        <ExpandedBranchPanel>
          <InlineTradeDetail node={node} viewMode={viewMode} />
        </ExpandedBranchPanel>
      ) : null}
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
  const [focusedRootId, setFocusedRootId] = useState<string | null>(null);

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
          nodes.map((node) => (
            <BasketNodeRow
              key={node.id}
              node={node}
              viewMode={viewMode}
              dimmed={focusedRootId !== null && focusedRootId !== node.id}
              onFocusChange={setFocusedRootId}
            />
          ))
        )}
      </div>
    </section>
  );
}
