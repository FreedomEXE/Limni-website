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
import { resolveBasketHierarchy } from "@/lib/basket/basketHierarchy";
import type { ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import { useCanonKernelStatus } from "@/lib/canon/canonKernelStore";
import { useCanonPreloadStatus } from "@/lib/canon/canonStore";
import type { AssetClass } from "@/lib/cotMarkets";
import {
  normalizePerformanceAssetSelection,
  type PerformanceAssetSelection,
} from "@/lib/performance/performanceAssetScope";
import { getStrategy, resolveStrategyId } from "@/lib/performance/strategyConfig";
import type { TradeStrategyFamily } from "@/lib/trades/tradeTypes";
import { resolveDisplayDrawdown } from "@/lib/viewMode/resolveDisplayValue";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

type BasketHierarchyProps = {
  strategyVariant: string;
  strategyFamily: TradeStrategyFamily;
  selectedWeek: string;
  currentWeek?: string;
  scope: PerformanceAssetSelection;
  viewMode: ViewMode;
  authoritativeMetrics?: BasketAuthoritativeMetrics | null;
  selectedTradeRowsBundle?: ClosedHistoryBundle | null;
};

export type BasketAuthoritativeMetrics = {
  returnPct?: number | null;
  maxDrawdownPct?: number | null;
  tradeCount?: number | null;
  hasActivity?: boolean;
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

function scopeBundle(bundle: ClosedHistoryBundle | null | undefined, scope: PerformanceAssetSelection) {
  if (!bundle) return null;
  const normalizedScope = normalizePerformanceAssetSelection(scope);
  const selected = new Set(normalizedScope);
  return {
    ...bundle,
    scope: normalizedScope,
    rows: bundle.rows.filter((row) => selected.has(row.assetClass)),
  };
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

function finiteMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function materiallyDifferent(left: number | null, right: number | null, tolerance = 0.05) {
  return left !== null && right !== null && Math.abs(left - right) > tolerance;
}

function riskTone(value: number | null) {
  return value !== null && value > 0.005 ? "text-rose-500" : "text-[color:var(--muted)]";
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
  if (node.level === "level") return node.label;
  if (node.level === "fill") {
    const displayFillSeq = node.values.displayFillSeq;
    return `Fill ${typeof displayFillSeq === "number" ? displayFillSeq : "--"}`;
  }
  if (node.level === "trade") return primaryRow(node)?.symbol ?? node.label;
  return node.label;
}

function childCountSummary(node: TradeListNode) {
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
    const fills = rows.filter((row) => row.rowKind === "fill").length;
    return `${fills} ${fills === 1 ? "fill" : "fills"}`;
  }
  if (node.level === "level") {
    const fills = rows.filter((row) => row.rowKind === "fill").length;
    return `${fills} ${fills === 1 ? "fill" : "fills"}`;
  }
  return "";
}

function nodeLeafRows(node: TradeListNode) {
  return rowsForNode(node).filter((row) => row.rowKind === "fill" || row.rowKind === "trade");
}

function nodeWinLoss(node: TradeListNode, viewMode: ViewMode, suppressReturnValues = false) {
  if (suppressReturnValues) {
    return { total: 0, wins: 0, losses: 0 };
  }
  const unitRows = nodeLeafRows(node);
  const values = unitRows
    .map((row) => resolvedRowReturn(row, viewMode))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const wins = values.filter((value) => value > 0).length;
  return {
    total: values.length,
    wins,
    losses: values.length - wins,
  };
}

function rowSummarySegments(node: TradeListNode, viewMode: ViewMode, suppressReturnValues = false) {
  const segments: ReactNode[] = [];
  const countSummary = childCountSummary(node);
  if (countSummary) segments.push(countSummary);

  const winLoss = nodeWinLoss(node, viewMode, suppressReturnValues);
  if (winLoss.total > 0) {
    segments.push(
      <span key="wins" className="font-semibold text-lime-500">{winLoss.wins}W</span>,
      <span key="losses" className="font-semibold text-rose-500">{winLoss.losses}L</span>,
    );
  }

  const displayFillSeq = node.values.displayFillSeq;
  const sourceFillSeq = node.values.sourceFillSeq;
  if (
    node.level === "fill" &&
    typeof displayFillSeq === "number" &&
    typeof sourceFillSeq === "number" &&
    displayFillSeq !== sourceFillSeq
  ) {
    segments.push(<span key="source-seq">source #{sourceFillSeq}</span>);
  }

  return segments;
}

function HeaderMetric({
  label,
  value,
  tone,
  dash = false,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  dash?: boolean;
}) {
  return (
    <span className={`inline-flex items-baseline gap-1 ${tone ?? "text-[color:var(--muted)]"}`}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">{label}</span>
      <span className={`${dash ? "font-semibold" : "font-bold"}`}>{value}</span>
    </span>
  );
}

function NodeHeaderMetrics({
  node,
  warnings,
  suppressReturnValues = false,
}: {
  node: TradeListNode;
  warnings: string[];
  suppressReturnValues?: boolean;
}) {
  const returnPct = suppressReturnValues ? null : finiteMetric(node.values.returnPct);
  const maxPathDrawdownPct = finiteMetric(node.values.maxPathDrawdownPct);
  const maxMaePct = finiteMetric(node.values.maxMaePct);
  const isGrid = node.level === "grid";
  const isLeaf = node.level === "fill" || node.level === "trade";

  return (
    <div className="ml-3 flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
      <HeaderMetric
        label="P/L"
        value={returnPct !== null
          ? formatSignedPercent(returnPct, 2)
          : warnings.length > 0
            ? <MissingReturnCell reason={warnings[0] ?? "Missing return"} />
            : "--"}
        tone={pctTone(returnPct)}
        dash={returnPct === null}
      />
      {maxPathDrawdownPct !== null ? (
        <HeaderMetric
          label={isGrid ? "Grid DD" : "Max DD"}
          value={formatSignedPercent(-maxPathDrawdownPct, 2)}
          tone={riskTone(maxPathDrawdownPct)}
        />
      ) : isGrid ? (
        <HeaderMetric label="Grid DD" value="--" dash />
      ) : null}
      {maxMaePct !== null ? (
        <HeaderMetric
          label={isLeaf ? "MAE" : "Max MAE"}
          value={formatSignedPercent(-maxMaePct, 2)}
          tone={riskTone(maxMaePct)}
        />
      ) : null}
    </div>
  );
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
    <div className="mt-1.5 space-y-1 rounded-xl bg-[var(--accent)]/[0.035] p-2 shadow-inner shadow-black/10">
      {children}
    </div>
  );
}

function InlineGridDetail({ node, viewMode }: { node: TradeListNode; viewMode: ViewMode }) {
  const row = primaryRow(node);
  const fills = node.children ?? [];
  if (!row) return null;
  const fillRows = fills
    .flatMap((fillNode) => {
      if (fillNode.level === "level") {
        return rowsForNode(fillNode).filter((fillRow) => fillRow.rowKind === "fill");
      }
      return [primaryRow(fillNode)].filter(Boolean) as ClosedHistoryRow[];
    })
    .filter((fillRow): fillRow is ClosedHistoryRow => Boolean(fillRow));
  const gridPathDrawdown = resolveDisplayDrawdown(row.riskMatrix, viewMode, "pathDrawdown");
  const maxFillMae = fillRows.reduce<number | null>((max, fillRow) => {
    const mae = resolveDisplayDrawdown(fillRow.riskMatrix, viewMode, "mae");
    if (mae === null) return max;
    return max === null ? mae : Math.max(max, mae);
  }, resolveDisplayDrawdown(row.riskMatrix, viewMode, "mae"));
  const violations = fillRows.filter((fillRow) => fillRow.capViolated).length;
  const maxActiveFills = Math.max(0, ...fillRows.map((fillRow) => fillRow.capActiveFillsAtEntry ?? 0));
  const capThreshold = row.capThresholdAtEntry
    ?? fillRows.find((fillRow) => fillRow.capThresholdAtEntry !== null)?.capThresholdAtEntry
    ?? "--";

  return (
    <div className="grid gap-3 rounded-lg border border-[var(--panel-border)]/60 bg-[var(--panel)]/60 px-4 py-3 text-[11px] sm:grid-cols-2 lg:grid-cols-7">
      <DetailMetric label="Window" value={`${formatDateTimeLabel(row.entryUtc)} -> ${formatDateTimeLabel(row.exitUtc)}`} />
      <DetailMetric label="Duration" value={formatDuration(row.entryUtc, row.exitUtc)} />
      <DetailMetric label="Entry / Exit" value={`${formatPrice(row.entryPrice)} -> ${formatPrice(row.exitPrice)}`} />
      <DetailMetric label="Grid DD" value={gridPathDrawdown === null ? "--" : formatSignedPercent(-gridPathDrawdown, 2)} tone="text-rose-500" />
      <DetailMetric label="Max fill MAE" value={maxFillMae === null ? "--" : formatSignedPercent(-maxFillMae, 2)} tone="text-rose-500" />
      <DetailMetric label="Cap" value={`${maxActiveFills}/${capThreshold} max active`} />
      <DetailMetric label="Violations" value={violations} tone={violations > 0 ? "text-rose-500" : "text-lime-500"} />
    </div>
  );
}

function InlineTradeDetail({
  node,
  viewMode,
  suppressReturnValues = false,
}: {
  node: TradeListNode;
  viewMode: ViewMode;
  suppressReturnValues?: boolean;
}) {
  const row = primaryRow(node);
  if (!row) return null;
  const tradeId = row.executionTradeId ?? row.canonicalTradeId ?? "--";
  const activeRaw = viewMode.anchor === "canonical"
    ? row.returnMatrix.canonical?.rawPct
    : row.returnMatrix.execution?.rawPct;
  const displayReturn = suppressReturnValues ? null : resolvedRowReturn(row, viewMode);
  const activeRawLabel = viewMode.anchor === "canonical" ? "Canonical Raw" : "Execution Raw";
  const displayLabel = viewMode.normalization === "adr_normalized" ? "Displayed ADR-norm" : "Displayed Raw";
  const showNormalizationContext = viewMode.normalization === "adr_normalized";
  const displayMae = resolveDisplayDrawdown(row.riskMatrix, viewMode, "mae");

  return (
    <div className="rounded-lg border border-[var(--panel-border)]/60 bg-[var(--panel)]/60 px-4 py-3 text-[11px]">
      <div className="mb-3 grid gap-3 rounded-md border border-[var(--panel-border)]/50 bg-black/[0.04] px-3 py-2 sm:grid-cols-3">
        <DetailMetric
          label={displayLabel}
          value={suppressReturnValues ? "Ledger projection pending" : displayReturn === null ? "--" : formatSignedPercent(displayReturn, 4)}
          tone={suppressReturnValues ? "text-[color:var(--muted)]" : pctTone(displayReturn)}
        />
        {showNormalizationContext && !suppressReturnValues ? (
          <DetailMetric label={activeRawLabel} value={typeof activeRaw === "number" ? formatSignedPercent(activeRaw, 4) : "--"} tone={pctTone(activeRaw)} />
        ) : null}
        {showNormalizationContext && !suppressReturnValues ? (
          <DetailMetric label="ADR Used" value={row.returnMatrix.adrPct === null ? "--" : `${row.returnMatrix.adrPct.toFixed(4)}%`} />
        ) : null}
        <DetailMetric label="MAE" value={displayMae === null ? "--" : formatSignedPercent(-displayMae, 4)} tone="text-rose-500" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <DetailMetric label="Entry" value={formatDateTimeLabel(row.entryUtc)} />
        <DetailMetric label="Exit" value={formatDateTimeLabel(row.exitUtc)} />
        <DetailMetric label="Duration" value={formatDuration(row.entryUtc, row.exitUtc)} />
        <DetailMetric label="Entry Price" value={formatPrice(row.entryPrice)} />
        <DetailMetric label="Exit Price" value={formatPrice(row.exitPrice)} />
        <DetailMetric label="Exit Reason" value={row.exitReason ?? "--"} />
        <DetailMetric label="Cap At Entry" value={`${row.capActiveFillsAtEntry ?? "--"} / ${row.capThresholdAtEntry ?? "--"}`} tone={row.capViolated ? "text-rose-500" : undefined} />
        <div className="min-w-0 lg:col-span-3">
          <span className="block uppercase tracking-[0.16em] text-[color:var(--muted)]">Trade ID</span>
          <span className="block truncate font-mono text-[10px] font-semibold text-[var(--foreground)]" title={tradeId}>
            {tradeId}
          </span>
        </div>
      </div>
    </div>
  );
}

function BasketNodeRow({
  node,
  depth = 0,
  viewMode,
  dimmed = false,
  suppressReturnValues = false,
  onFocusChange,
}: {
  node: TradeListNode;
  depth?: number;
  viewMode: ViewMode;
  dimmed?: boolean;
  suppressReturnValues?: boolean;
  onFocusChange?: (nodeId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [focusedChildId, setFocusedChildId] = useState<string | null>(null);
  const hasChildren = Boolean(node.children?.length);
  const row = primaryRow(node);
  const warnings = rowWarnings(node);
  const summarySegments = rowSummarySegments(node, viewMode, suppressReturnValues);
  const isLeaf = node.level === "fill" || node.level === "trade";
  const isGrid = node.level === "grid";
  const flattenedGrid = node.level === "symbol" && node.children?.length === 1 && node.children[0]?.level === "grid"
    ? node.children[0]
    : null;
  const branchChildren = flattenedGrid?.children ?? node.children;
  const canExpand = hasChildren || isLeaf;
  const handleToggle = () => {
    if (!canExpand) return;
    const next = !expanded;
    setExpanded(next);
    onFocusChange?.(next ? node.id : null);
    if (!next) setFocusedChildId(null);
  };

  return (
    <div className={`transition duration-150 ${dimmed ? "opacity-[0.16] blur-[1px] grayscale contrast-50" : "opacity-100 blur-0"}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          expanded
            ? "border-[var(--accent)]/35 bg-[var(--accent)]/[0.06]"
            : "border-[var(--panel-border)] bg-[var(--panel)]/70 hover:border-[var(--accent)]/30"
        }`}
        style={{ paddingLeft: `${16 + depth * 22}px` }}
        aria-expanded={canExpand ? expanded : undefined}
        data-testid="basket-canon-row"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
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
          {summarySegments.map((segment, index) => (
            <span key={index} className="text-[10px] text-[color:var(--muted)]">
              {segment}
            </span>
          ))}
          {row?.sourceModel && isLeaf ? (
            <span className="text-[10px] text-[color:var(--muted)]">
              {row.sourceModel}
            </span>
          ) : null}
        </div>
        <NodeHeaderMetrics node={node} warnings={warnings} suppressReturnValues={suppressReturnValues} />
      </button>

      {expanded && hasChildren ? (
        <ExpandedBranchPanel>
          {isGrid ? <InlineGridDetail node={node} viewMode={viewMode} /> : null}
          {flattenedGrid ? <InlineGridDetail node={flattenedGrid} viewMode={viewMode} /> : null}
          {branchChildren?.map((child) => (
            <BasketNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              viewMode={viewMode}
              dimmed={focusedChildId !== null && focusedChildId !== child.id}
              suppressReturnValues={suppressReturnValues}
              onFocusChange={setFocusedChildId}
            />
          ))}
        </ExpandedBranchPanel>
      ) : null}
      {expanded && !hasChildren && isLeaf ? (
        <ExpandedBranchPanel>
          <InlineTradeDetail node={node} viewMode={viewMode} suppressReturnValues={suppressReturnValues} />
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
  authoritativeMetrics = null,
  selectedTradeRowsBundle = null,
}: BasketHierarchyProps) {
  const canonKernel = useCanonKernelStatus();
  const canonPreload = useCanonPreloadStatus();
  const strategyId = resolveStrategyId(strategyVariant.split("-")[0] ?? strategyVariant);
  const strategy = getStrategy(strategyId);
  if (!strategy) {
    throw new Error(`Unknown strategy config for basket hierarchy: ${strategyId}`);
  }
  const levels = resolveBasketHierarchy(strategy, strategyVariant);
  const selectedRuntimeBundle = scopeBundle(selectedTradeRowsBundle, scope);
  const bundle = selectedRuntimeBundle;
  const ledgerIdentity = bundle?.ledgerIdentity ?? null;

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
  const totalMaxPathDrawdown = nodes.reduce<number | null>((max, node) => {
    const value = finiteMetric(node.values.maxPathDrawdownPct);
    if (value === null) return max;
    return max === null ? value : Math.max(max, value);
  }, null);
  const authoritativeReturn = finiteMetric(authoritativeMetrics?.returnPct);
  const authoritativeMaxDrawdown = finiteMetric(authoritativeMetrics?.maxDrawdownPct);
  const authoritativeTradeCount = finiteMetric(authoritativeMetrics?.tradeCount);
  const headerReturn = authoritativeReturn ?? totalReturn;
  const headerMaxPathDrawdown = authoritativeMaxDrawdown ?? totalMaxPathDrawdown;
  const totalMaxMae = nodes.reduce<number | null>((max, node) => {
    const value = finiteMetric(node.values.maxMaePct);
    if (value === null) return max;
    return max === null ? value : Math.max(max, value);
  }, null);
  const periodLabel = selectedWeek === "all" ? "All closed weeks" : formatDateLabel(selectedWeek);
  const segments = headerSegments(stats, selectedWeek, levels);
  const [focusedRootId, setFocusedRootId] = useState<string | null>(null);
  const expectsActivity = Boolean(authoritativeMetrics?.hasActivity)
    || (authoritativeTradeCount !== null && authoritativeTradeCount > 0)
    || authoritativeReturn !== null;
  const basketHasRows = nodes.length > 0;
  const basketLooksIncomplete = Boolean(bundle)
    && expectsActivity
    && (
      !basketHasRows
      || (selectedWeek === "all" && stats.weekCount === 0)
      || (stats.fillCount === 0 && stats.tradeCount === 0)
    );
  const kernelStatusText = canonKernel.status === "ready"
    ? `ready ${canonKernel.readyWeeks}/${canonKernel.totalWeeks}`
    : canonKernel.status;
  const preloadStatusText = canonPreload.status;
  const returnMismatch = materiallyDifferent(authoritativeReturn, totalReturn);

  return (
    <section
      data-testid="basket-hierarchy"
      data-basket-source={bundle ? "selected-trade-rows" : "missing-selected-trade-rows"}
      data-selected-execution-ledger-id={ledgerIdentity?.executionLedgerId ?? "missing"}
      data-selected-trade-row-ledger-id={ledgerIdentity?.tradeRowLedgerId ?? "missing"}
      data-selected-trade-row-count={ledgerIdentity?.rowCount ?? 0}
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
          {!returnMismatch ? (
            <>
              <span className="font-semibold text-lime-500">{stats.wins}W</span>
              <span className="font-semibold text-rose-500">{stats.losses}L</span>
            </>
          ) : null}
          {authoritativeTradeCount !== null ? (
            <HeaderMetric label="Engine trades" value={authoritativeTradeCount.toFixed(0)} />
          ) : null}
          <HeaderMetric label="P/L" value={formatSignedPercent(headerReturn, 2)} tone={pctTone(headerReturn)} />
          {headerMaxPathDrawdown !== null ? (
            <HeaderMetric label="Max DD" value={formatSignedPercent(-headerMaxPathDrawdown, 2)} tone={riskTone(headerMaxPathDrawdown)} />
          ) : null}
          {totalMaxMae !== null ? (
            <HeaderMetric label="Max MAE" value={formatSignedPercent(-totalMaxMae, 2)} tone={riskTone(totalMaxMae)} />
          ) : null}
        </div>
      </div>

      {returnMismatch ? (
        <div
          data-testid="basket-ledger-mismatch"
          className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-200"
        >
          Basket header is using the engine ledger P/L. Drilldown row totals currently sum to {formatSignedPercent(totalReturn, 2)}.
        </div>
      ) : null}

      <div className="max-h-[65vh] space-y-1.5 overflow-y-auto">
        {!bundle ? (
          <div className="rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-3 text-xs text-[color:var(--muted)]">
            Basket selected trade-row ledger is syncing. Kernel: {kernelStatusText}. Preload: {preloadStatusText}.
          </div>
        ) : basketLooksIncomplete ? (
          <div
            data-testid="basket-syncing"
            className="rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-3 text-xs text-[color:var(--muted)]"
          >
            Basket drilldown is still syncing for this strategy, week, and scope. Engine totals above are loaded.
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
              suppressReturnValues={returnMismatch}
              onFocusChange={setFocusedRootId}
            />
          ))
        )}
      </div>
    </section>
  );
}
