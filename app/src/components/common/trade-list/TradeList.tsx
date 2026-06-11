/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: TradeList.tsx
 *
 * Description:
 * Canonical domain-agnostic trade-list renderer.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import TradeListHeader from "./TradeListHeader";
import TradeListRow from "./TradeListRow";
import type { TradeListProps } from "./types";

function getGridTemplateColumns(columns: TradeListProps["columns"]) {
  return columns
    .map((column) => {
      if (column.width) return column.width;
      if (column.key === "label") return "minmax(220px, 2fr)";
      return column.align === "right" ? "minmax(88px, 0.7fr)" : "minmax(110px, 1fr)";
    })
    .join(" ");
}

export default function TradeList({
  nodes,
  columns,
  sort,
  onSortChange,
  onNodeClick,
  density = "compact",
  emptyState,
}: TradeListProps) {
  const gridTemplateColumns = getGridTemplateColumns(columns);

  return (
    <div
      className="overflow-hidden rounded-lg border border-(--panel-border) bg-(--panel)/90 shadow-[0_14px_34px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.025]"
      data-testid="trade-list"
    >
      <TradeListHeader
        columns={columns}
        gridTemplateColumns={gridTemplateColumns}
        sort={sort}
        onSortChange={onSortChange}
      />

      {nodes.length === 0 ? (
        <div className="px-4 py-8 text-sm text-(--muted)">
          {emptyState ?? "No trades to display."}
        </div>
      ) : (
        <div role="treegrid" aria-label="Trade list" className="bg-(--background)/10">
          {nodes.map((node) => (
            <TradeListRow
              key={node.id}
              node={node}
              columns={columns}
              gridTemplateColumns={gridTemplateColumns}
              density={density}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
