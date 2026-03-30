/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: StrategySelector.tsx
 *
 * Description:
 * Shared 3-level strategy selector used in both Performance sidebar and
 * Matrix sidebar. Reads/writes URL params: ?strategy=...&f1=...&f2=...
 * Uses a "Run" button to apply changes (no auto-reload on dropdown change).
 * Config-driven — adding options requires only updating strategyConfig.ts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  STRATEGIES,
  ENTRY_STYLE_FILTERS,
  STRENGTH_GATES,
  getEntryStyle,
  getStrengthGate,
  normalizeFilterSelection,
  resolveStrategyId,
  getStrategy,
} from "@/lib/performance/strategyConfig";
import {
  STRATEGY_SELECTION_COMMIT_EVENT,
  type StrategySelectionCommitDetail,
} from "@/lib/performance/strategySelection";

export type StrategySelection = {
  strategy: string;
  f1: string;
  f2: string;
};

/** Read current selection from URL params (handles both old and new param names) */
export function readSelectionFromParams(searchParams: URLSearchParams): StrategySelection {
  const normalizedFilters = normalizeFilterSelection({
    f1: searchParams.get("f1") ?? searchParams.get("filter"),
    f2: searchParams.get("f2"),
  });
  return {
    strategy: resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias")),
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };
}

/** Build a display label from a selection, e.g. "Tiered V3 · ADR Pullback · Strength Gate" */
export function selectionLabel(sel: StrategySelection): string {
  const s = getStrategy(sel.strategy);
  const f1 = getEntryStyle(sel.f1);
  const f2 = getStrengthGate(sel.f2);
  const parts = [s?.label ?? sel.strategy, f1?.label ?? sel.f1];
  if (f2 && f2.id !== "none") parts.push(f2.label);
  return parts.join(" · ");
}

export default function StrategySelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialCommitted = readSelectionFromParams(searchParams);
  const [committed, setCommitted] = useState<StrategySelection>(initialCommitted);
  const [draft, setDraft] = useState<StrategySelection>(initialCommitted);

  useEffect(() => {
    const onSelectionCommit = (event: Event) => {
      const custom = event as CustomEvent<StrategySelectionCommitDetail>;
      setCommitted(custom.detail.selection);
      setDraft(custom.detail.selection);
    };
    window.addEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
    return () => window.removeEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
  }, []);

  // Check if draft differs from committed
  const isDirty =
    draft.strategy !== committed.strategy ||
    draft.f1 !== committed.f1 ||
    draft.f2 !== committed.f2;

  const apply = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("strategy", draft.strategy);
    params.set("f1", draft.f1);
    params.set("f2", draft.f2);
    // Clean up old param names
    params.delete("bias");
    params.delete("filter");
    params.delete("style");
    params.delete("system");
    params.delete("mode");
    const nextSelection = { ...draft };
    const nextUrl = `${pathname}?${params.toString()}`;

    if (pathname.startsWith("/performance") || pathname.startsWith("/matrix")) {
      // Performance and Matrix are bootstrapped pages: strategy changes should
      // switch preloaded client state, not rerun the server page tree.
      window.history.replaceState(window.history.state, "", nextUrl);
      setCommitted(nextSelection);
      setDraft(nextSelection);
      window.dispatchEvent(new CustomEvent(STRATEGY_SELECTION_COMMIT_EVENT, {
        detail: { selection: nextSelection },
      }));
      return;
    }

    router.replace(nextUrl, { scroll: false });
  };

  const selectClasses =
    "w-full cursor-pointer rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none transition hover:border-[var(--accent)]/40 focus:border-[var(--accent)]/60";

  const labelClasses =
    "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]";

  const strategyConfig = STRATEGIES.find((s) => s.id === draft.strategy);

  return (
    <div className="space-y-3">
      {/* Strategy */}
      <div>
        <label htmlFor="strategy-select" className={labelClasses}>
          Strategy
        </label>
        <select
          id="strategy-select"
          value={draft.strategy}
          onChange={(e) => setDraft((prev) => ({ ...prev, strategy: e.target.value }))}
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

      {/* Filter 1 (entry style) */}
      <div>
        <label htmlFor="basket-filter" className={labelClasses}>
          Filter 1
        </label>
        <select
          id="basket-filter"
          value={draft.f1}
          onChange={(e) => setDraft((prev) => ({ ...prev, f1: e.target.value }))}
          className={selectClasses}
        >
          {ENTRY_STYLE_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Filter 2 (strength gate) */}
      <div>
        <label htmlFor="intraday-filter" className={labelClasses}>
          Filter 2
        </label>
        <select
          id="intraday-filter"
          value={draft.f2}
          onChange={(e) => setDraft((prev) => ({ ...prev, f2: e.target.value }))}
          className={selectClasses}
        >
          {STRENGTH_GATES.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={apply}
        disabled={!isDirty}
        className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
          isDirty
            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
            : "cursor-not-allowed border-[var(--panel-border)] bg-[var(--panel)]/50 text-[color:var(--muted)]"
        }`}
      >
        {isDirty ? "Run" : "Applied"}
      </button>
    </div>
  );
}
