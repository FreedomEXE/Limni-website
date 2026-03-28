/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceStrategySelector.tsx
 *
 * Description:
 * Config-driven bias source and strategy filter selectors for the
 * Performance sidebar. Dropdowns for both bias source and filter.
 * Adding new entries requires only updating strategyConfig.ts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BIAS_SOURCES,
  STRATEGY_FILTERS,
  resolveBiasSourceId,
  resolveStrategyFilterId,
} from "@/lib/performance/strategyConfig";

type PerformanceStrategySelectorProps = {
  initialBiasSource: string;
  initialFilter: string;
};

export default function PerformanceStrategySelector({
  initialBiasSource,
  initialFilter,
}: PerformanceStrategySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeBias = resolveBiasSourceId(searchParams.get("bias") ?? initialBiasSource);
  const activeFilter = resolveStrategyFilterId(searchParams.get("filter") ?? initialFilter);

  const navigate = (bias: string, filter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("bias", bias);
    params.set("filter", filter);
    params.delete("style");
    params.delete("system");
    params.delete("mode");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const activeBiasConfig = BIAS_SOURCES.find((s) => s.id === activeBias);

  return (
    <div className="space-y-3">
      {/* Bias Source Dropdown */}
      <div>
        <label
          htmlFor="bias-source"
          className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]"
        >
          Bias Source
        </label>
        <select
          id="bias-source"
          value={activeBias}
          onChange={(e) => navigate(e.target.value, activeFilter)}
          className="w-full cursor-pointer rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none transition hover:border-[var(--accent)]/40 focus:border-[var(--accent)]/60"
        >
          {BIAS_SOURCES.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
        {activeBiasConfig && (
          <p className="mt-1 text-[10px] text-[color:var(--muted)]">
            {activeBiasConfig.description}
          </p>
        )}
      </div>

      {/* Strategy Filter Dropdown */}
      <div>
        <label
          htmlFor="strategy-filter"
          className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]"
        >
          Filter
        </label>
        <select
          id="strategy-filter"
          value={activeFilter}
          onChange={(e) => navigate(activeBias, e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none transition hover:border-[var(--accent)]/40 focus:border-[var(--accent)]/60"
        >
          {STRATEGY_FILTERS.map((filter) => (
            <option key={filter.id} value={filter.id}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
