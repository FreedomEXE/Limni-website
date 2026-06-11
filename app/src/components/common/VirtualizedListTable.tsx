"use client";

import { ReactNode, useMemo, useRef, useState } from "react";

type ColumnDef = {
  key: string;
  label: string;
  className?: string;
};

type VirtualizedListTableProps<T> = {
  columns: ColumnDef[];
  rows: T[];
  rowHeight?: number;
  height?: number;
  renderRow: (row: T) => ReactNode;
  emptyState?: ReactNode;
};

export default function VirtualizedListTable<T>({
  columns,
  rows,
  rowHeight = 52,
  height = 420,
  renderRow,
  emptyState,
}: VirtualizedListTableProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = rows.length * rowHeight;

  const { startIndex, endIndex, offsetTop } = useMemo(() => {
    const visibleCount = Math.ceil(height / rowHeight);
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
    const end = Math.min(rows.length, start + visibleCount + 6);
    return {
      startIndex: start,
      endIndex: end,
      offsetTop: start * rowHeight,
    };
  }, [scrollTop, height, rowHeight, rows.length]);

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 border-b border-[var(--panel-border)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {columns.map((col) => (
          <div key={col.key} className={col.className}>
            {col.label}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
          {emptyState ?? "No rows to display."}
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{ height }}
          className="overflow-y-auto"
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${offsetTop}px)` }}>
              {rows.slice(startIndex, endIndex).map((row, index) => (
                <div
                  key={startIndex + index}
                  className="border-b border-[var(--panel-border)]/40 px-4 py-3 text-sm text-[var(--foreground)]"
                  style={{ height: rowHeight }}
                >
                  {renderRow(row)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
