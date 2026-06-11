"use client";

import type { PerformanceView } from "@/lib/performance/pageState";

export type ViewCardDefinition<T extends string> = {
  id: T;
  label: string;
  description: string;
};

export const PERFORMANCE_VIEW_CARDS: Array<ViewCardDefinition<PerformanceView>> = [
  { id: "summary", label: "Summary", description: "Key metrics and model ranking." },
  { id: "simulation", label: "Simulation", description: "Trailing-stop and sizing perspective." },
  { id: "basket", label: "Basket", description: "See every pair, direction, and return." },
  { id: "research", label: "Research", description: "Diagnostics and pair-level distribution." },
  { id: "notes", label: "Notes", description: "Weekly observations and takeaways." },
];

type PerformanceViewCardsProps<T extends string> = {
  activeView: T;
  onViewChange: (next: T) => void;
  views: ReadonlyArray<ViewCardDefinition<T>>;
};

export default function PerformanceViewCards<T extends string>({
  activeView,
  onViewChange,
  views,
}: PerformanceViewCardsProps<T>) {
  const mdColsClass =
    views.length >= 5
      ? "md:grid-cols-5"
      : views.length === 4
        ? "md:grid-cols-4"
        : views.length === 3
          ? "md:grid-cols-3"
          : "md:grid-cols-2";

  return (
    <div className={`grid gap-3 ${mdColsClass}`}>
      {views.map((view) => {
        const selected = view.id === activeView;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onViewChange(view.id)}
            className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
              selected
                ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                : "border-[var(--panel-border)] bg-[var(--panel)]/70 hover:border-[var(--accent)]/30 hover:bg-[var(--panel)]"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]/80">
              {view.label}
            </div>
            <div className="mt-2 text-[11px] leading-snug text-[color:var(--muted)]">
              {view.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
