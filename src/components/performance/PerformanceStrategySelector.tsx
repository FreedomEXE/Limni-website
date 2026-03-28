/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceStrategySelector.tsx
 *
 * Description:
 * Config-driven bias source and strategy filter selectors for the
 * Performance sidebar. Adding new bias sources or filters requires
 * only updating the config arrays in strategyConfig.ts.
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
  type BiasSourceConfig,
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
    // Clear legacy params that conflict
    params.delete("style");
    params.delete("system");
    params.delete("mode");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      {/* Bias Source */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          Bias Source
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {BIAS_SOURCES.map((source) => (
            <BiasSourceButton
              key={source.id}
              source={source}
              active={activeBias === source.id}
              onClick={() => navigate(source.id, activeFilter)}
            />
          ))}
        </div>
      </div>

      {/* Strategy Filter */}
      {STRATEGY_FILTERS.length > 1 ? (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Filter
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {STRATEGY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => navigate(activeBias, filter.id)}
                className={`rounded-lg border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                  activeFilter === filter.id
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/70 hover:border-[var(--accent)]/30"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--muted)]">
          {STRATEGY_FILTERS[0]?.label ?? "Weekly Hold"}
        </div>
      )}
    </div>
  );
}

function BiasSourceButton({
  source,
  active,
  onClick,
}: {
  source: BiasSourceConfig;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={source.description}
      className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
        active
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
          : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/70 hover:border-[var(--accent)]/30"
      }`}
    >
      {source.label}
    </button>
  );
}
