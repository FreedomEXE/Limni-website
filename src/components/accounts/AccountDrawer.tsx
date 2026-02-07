"use client";

import { ReactNode, useMemo, useState } from "react";
import DrawerPanel from "@/components/drawers/DrawerPanel";
import FilterBar from "@/components/common/FilterBar";
import VirtualizedListTable from "@/components/common/VirtualizedListTable";
import ErrorBoundary from "@/components/common/ErrorBoundary";

export type DrawerMode =
  | "positions"
  | "planned"
  | "closed"
  | "journal"
  | "kpi"
  | "mapping"
  | null;

export type DrawerRow = {
  id: string;
  status?: string;
  searchText?: string;
  sortValue?: number;
  cells: ReactNode[];
};

export type DrawerColumn = {
  key: string;
  label: string;
  className?: string;
};

export type DrawerConfig = {
  title: string;
  subtitle?: string;
  columns?: DrawerColumn[];
  rows?: DrawerRow[];
  emptyState?: ReactNode;
  height?: number;
  showFilters?: boolean;
  content?: ReactNode;
};

type AccountDrawerProps = {
  mode: DrawerMode;
  configs: Partial<Record<Exclude<DrawerMode, null>, DrawerConfig>>;
  onClose?: () => void;
};

export default function AccountDrawer({ mode, configs, onClose }: AccountDrawerProps) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");

  if (!mode || !configs[mode]) {
    return null;
  }

  const config = configs[mode]!;

  const rows = config.rows ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    if (config.showFilters) {
      if (status !== "all") {
        next = next.filter((row) => row.status === status);
      }
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        next = next.filter((row) => (row.searchText ?? "").toLowerCase().includes(needle));
      }
      if (sort === "best") {
        next = [...next].sort((a, b) => (b.sortValue ?? 0) - (a.sortValue ?? 0));
      } else if (sort === "worst") {
        next = [...next].sort((a, b) => (a.sortValue ?? 0) - (b.sortValue ?? 0));
      } else if (sort === "oldest") {
        next = [...next].reverse();
      }
    }
    return next;
  }, [rows, status, search, sort, config.showFilters]);

  return (
    <DrawerPanel title={config.title} subtitle={config.subtitle} open={true} onClose={onClose}>
      <ErrorBoundary
        fallback={
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
            Drawer content failed to render. Please reload the page.
          </div>
        }
      >
        {config.showFilters ? (
          <div className="mb-4">
            <FilterBar
              status={status}
              onStatusChange={setStatus}
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
            />
          </div>
        ) : null}

        {config.content ? (
          config.content
        ) : (
          <VirtualizedListTable
            columns={config.columns ?? []}
            rows={filtered}
            height={config.height}
            emptyState={config.emptyState}
            renderRow={(row: DrawerRow) => (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                {row.cells.map((cell, index) => (
                  <div key={`${row.id}-${index}`}>{cell}</div>
                ))}
              </div>
            )}
          />
        )}
      </ErrorBoundary>
    </DrawerPanel>
  );
}
