/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: StrategySelector.tsx
 *
 * Description:
 * Shared 3-level strategy selector used in both Performance sidebar and
 * Matrix header. Reads/writes URL params: ?strategy=...&f1=...&f2=...
 * Config-driven — adding options requires only updating strategyConfig.ts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  STRATEGIES,
  BASKET_FILTERS,
  INTRADAY_FILTERS,
  resolveStrategyId,
  resolveBasketFilterId,
  resolveIntradayFilterId,
} from "@/lib/performance/strategyConfig";

type StrategySelectorProps = {
  /** Compact mode for inline use (Matrix header). Full mode for sidebar (Performance). */
  layout?: "sidebar" | "inline";
};

export default function StrategySelector({ layout = "sidebar" }: StrategySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeStrategy = resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias"));
  const activeF1 = resolveBasketFilterId(searchParams.get("f1") ?? searchParams.get("filter"));
  const activeF2 = resolveIntradayFilterId(searchParams.get("f2"));

  const navigate = (strategy: string, f1: string, f2: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("strategy", strategy);
    params.set("f1", f1);
    params.set("f2", f2);
    // Clean up old param names
    params.delete("bias");
    params.delete("filter");
    params.delete("style");
    params.delete("system");
    params.delete("mode");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const strategyConfig = STRATEGIES.find((s) => s.id === activeStrategy);

  const selectClasses =
    "w-full cursor-pointer rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none transition hover:border-[var(--accent)]/40 focus:border-[var(--accent)]/60";

  const labelClasses =
    "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]";

  if (layout === "inline") {
    return (
      <div className="flex items-center gap-3">
        <select
          value={activeStrategy}
          onChange={(e) => navigate(e.target.value, activeF1, activeF2)}
          className={selectClasses}
          style={{ width: "auto" }}
        >
          {STRATEGIES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select
          value={activeF1}
          onChange={(e) => navigate(activeStrategy, e.target.value, activeF2)}
          className={selectClasses}
          style={{ width: "auto" }}
        >
          {BASKET_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <select
          value={activeF2}
          onChange={(e) => navigate(activeStrategy, activeF1, e.target.value)}
          className={selectClasses}
          style={{ width: "auto" }}
        >
          {INTRADAY_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>
    );
  }

  // Sidebar layout (stacked dropdowns with labels)
  return (
    <div className="space-y-3">
      {/* Strategy */}
      <div>
        <label htmlFor="strategy-select" className={labelClasses}>
          Strategy
        </label>
        <select
          id="strategy-select"
          value={activeStrategy}
          onChange={(e) => navigate(e.target.value, activeF1, activeF2)}
          className={selectClasses}
        >
          {STRATEGIES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {strategyConfig && (
          <p className="mt-1 text-[10px] text-[color:var(--muted)]">
            {strategyConfig.description}
          </p>
        )}
      </div>

      {/* Filter 1 (basket) */}
      <div>
        <label htmlFor="basket-filter" className={labelClasses}>
          Filter 1
        </label>
        <select
          id="basket-filter"
          value={activeF1}
          onChange={(e) => navigate(activeStrategy, e.target.value, activeF2)}
          className={selectClasses}
        >
          {BASKET_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Filter 2 (intraday) */}
      <div>
        <label htmlFor="intraday-filter" className={labelClasses}>
          Filter 2
        </label>
        <select
          id="intraday-filter"
          value={activeF2}
          onChange={(e) => navigate(activeStrategy, activeF1, e.target.value)}
          className={selectClasses}
        >
          {INTRADAY_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
