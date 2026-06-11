/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceScopeControl.tsx
 *
 * Description:
 * Page-level asset scope control for the Performance workspace. Scope is
 * global state: Summary, Simulation, Basket, Research, and sidebar stats all
 * read the same selected asset universe.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import {
  ALL_PERFORMANCE_ASSET_SELECTION,
  PERFORMANCE_ASSET_CLASSES,
  PERFORMANCE_ASSET_SCOPE_LABELS,
  isAllPerformanceAssetSelection,
  togglePerformanceAssetSelection,
  type PerformanceAssetSelection,
} from "@/lib/performance/performanceAssetScope";

type PerformanceScopeControlProps = {
  value: PerformanceAssetSelection;
  onChange: (next: PerformanceAssetSelection) => void;
};

export default function PerformanceScopeControl({ value, onChange }: PerformanceScopeControlProps) {
  const allSelected = isAllPerformanceAssetSelection(value);

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="min-w-[4.5rem] text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Scope
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([...ALL_PERFORMANCE_ASSET_SELECTION])}
          className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
            allSelected
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
              : "border-[var(--panel-border)] text-[color:var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
          }`}
        >
          All
        </button>
        {PERFORMANCE_ASSET_CLASSES.map((assetClass) => {
          const active = value.includes(assetClass);
          return (
            <button
              key={assetClass}
              type="button"
              onClick={() => onChange(togglePerformanceAssetSelection(value, assetClass))}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                active && !allSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : active
                    ? "border-[var(--accent)]/60 bg-[var(--accent)]/5 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] text-[color:var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
              }`}
            >
              {PERFORMANCE_ASSET_SCOPE_LABELS[assetClass]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
