"use client";

import type { ReactNode } from "react";

export type TableRowLike = {
  id: string;
};

type SimpleListTableProps<TRow extends TableRowLike> = {
  columns: Array<{ key: string; label: string }>;
  rows: TRow[];
  emptyState?: ReactNode;
  renderRow: (row: TRow) => ReactNode;
  maxHeight?: number;
  gridClassName?: string;
};

export default function SimpleListTable<TRow extends TableRowLike>({
  columns,
  rows,
  emptyState,
  renderRow,
  maxHeight = 520,
  gridClassName,
}: SimpleListTableProps<TRow>) {
  const headerGrid =
    gridClassName ??
    "grid-cols-[repeat(auto-fit,minmax(120px,1fr))]";
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70">
      <div className={`grid ${headerGrid} gap-3 border-b border-[var(--panel-border)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]`}>
        {columns.map((col) => (
          <div key={col.key}>{col.label}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
          {emptyState ?? "No rows to display."}
        </div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight }}>
          {rows.map((row) => (
            <div key={row.id} className="border-b border-[var(--panel-border)]/40 px-4 py-3 text-sm text-[var(--foreground)]">
              {renderRow(row)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
