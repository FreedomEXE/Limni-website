/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: TradeListHeader.tsx
 *
 * Description:
 * Click-to-sort header row for the shared TradeList component.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import type { TradeListColumn, SortState } from "./types";

type TradeListHeaderProps = {
  columns: TradeListColumn[];
  gridTemplateColumns: string;
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
};

function SortIcon({ active, direction }: { active: boolean; direction?: SortState["direction"] }) {
  if (!active) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M5 2L7.5 4.5H2.5L5 2Z" fill="currentColor" opacity="0.35" />
        <path d="M5 8L2.5 5.5H7.5L5 8Z" fill="currentColor" opacity="0.35" />
      </svg>
    );
  }

  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      {direction === "desc" ? (
        <path d="M5 8L2.5 5.5H7.5L5 8Z" fill="currentColor" />
      ) : (
        <path d="M5 2L7.5 4.5H2.5L5 2Z" fill="currentColor" />
      )}
    </svg>
  );
}

function alignmentClass(align: TradeListColumn["align"]) {
  if (align === "right") return "justify-end text-right";
  if (align === "center") return "justify-center text-center";
  return "justify-start text-left";
}

export default function TradeListHeader({
  columns,
  gridTemplateColumns,
  sort,
  onSortChange,
}: TradeListHeaderProps) {
  return (
    <div
      className="grid border-b border-(--panel-border) bg-(--panel)/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--muted)"
      style={{ gridTemplateColumns }}
      role="row"
    >
      {columns.map((column) => {
        const active = sort?.key === column.key;
        const sortable = Boolean(column.sortable && onSortChange);

        const handleSort = () => {
          if (!sortable) return;
          const nextDirection = active
            ? sort.direction === "asc"
              ? "desc"
              : "asc"
            : column.defaultDirection ?? "asc";
          onSortChange?.({ key: column.key, direction: nextDirection });
        };

        if (!sortable) {
          return (
            <div
              key={column.key}
              role="columnheader"
              className={`flex items-center ${alignmentClass(column.align)}`}
            >
              {column.label}
            </div>
          );
        }

        return (
          <div
            key={column.key}
            role="columnheader"
            className={`flex ${alignmentClass(column.align)}`}
            aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
          >
            <button
              type="button"
              onClick={handleSort}
              className={`flex items-center gap-1.5 transition hover:text-(--accent-strong) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) ${alignmentClass(column.align)}`}
            >
              <span>{column.label}</span>
              <SortIcon active={active} direction={sort?.direction} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
