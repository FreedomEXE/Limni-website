"use client";

import { useMemo } from "react";

type FilterBarProps = {
  status?: string;
  onStatusChange?: (value: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  sort?: string;
  onSortChange?: (value: string) => void;
  statusOptions?: string[];
  sortOptions?: { label: string; value: string }[];
};

export default function FilterBar({
  status = "all",
  onStatusChange,
  search = "",
  onSearchChange,
  sort = "recent",
  onSortChange,
  statusOptions,
  sortOptions,
}: FilterBarProps) {
  const statusItems = useMemo(
    () => statusOptions ?? ["all", "pending", "open", "closed"],
    [statusOptions]
  );
  const sortItems = useMemo(
    () =>
      sortOptions ?? [
        { label: "Most recent", value: "recent" },
        { label: "Oldest", value: "oldest" },
        { label: "Best PnL", value: "best" },
        { label: "Worst PnL", value: "worst" },
      ],
    [sortOptions]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">
        {statusItems.map((item) => {
          const isActive = status === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onStatusChange?.(item)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                isActive
                  ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Search"
          className="h-9 flex-1 rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 text-sm text-[var(--foreground)] placeholder:text-[color:var(--muted)]"
        />
        <select
          value={sort}
          onChange={(event) => onSortChange?.(event.target.value)}
          className="h-9 rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
        >
          {sortItems.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
