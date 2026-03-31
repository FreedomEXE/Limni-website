/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategySelection.ts
 *
 * Description:
 * Shared strategy selection helpers for bootstrap maps and client-side
 * strategy switching events across Performance and Matrix.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { EngineSidebarStats } from "@/lib/performance/engineAdapter";
import { ENTRY_STYLE_FILTERS, STRATEGIES, STRENGTH_GATES } from "@/lib/performance/strategyConfig";
import { loadStrategyPageData, type StrategyPageData } from "@/lib/performance/strategyPageData";

export const STRATEGY_SELECTION_COMMIT_EVENT = "limni:strategy-selection-commit";
export const STRATEGY_SIDEBAR_STATS_EVENT = "limni:strategy-sidebar-stats";

export type RuntimeStrategySelection = {
  strategy: string;
  f1: string;
  f2: string;
};

export type StrategyBootstrapSelection = {
  strategyId: string;
  f1: string;
  f2: string;
};

export type StrategySelectionCommitDetail = {
  selection: RuntimeStrategySelection;
};

export type StrategySidebarStatsDetail = {
  selection: RuntimeStrategySelection;
  stats: EngineSidebarStats | null;
};

export function buildStrategySelectionKey(selection: {
  strategyId?: string;
  strategy?: string;
  f1: string;
  f2: string;
}) {
  const strategyId = selection.strategyId ?? selection.strategy ?? "";
  return `${strategyId}:${selection.f1}:${selection.f2}`;
}

export function toRuntimeStrategySelection(selection: StrategyBootstrapSelection): RuntimeStrategySelection {
  return {
    strategy: selection.strategyId,
    f1: selection.f1,
    f2: selection.f2,
  };
}

export function listStrategyBootstrapSelections(): StrategyBootstrapSelection[] {
  // Guardrail: this registry defines the client-side fast path. New strategies
  // or filters must appear here or they will silently fall back to slower
  // route-driven behavior in sections that expect the full bootstrapped map.
  return STRATEGIES.flatMap((strategy) =>
    ENTRY_STYLE_FILTERS.flatMap((entryStyle) =>
      STRENGTH_GATES.map((strengthGate) => ({
        strategyId: strategy.id,
        f1: entryStyle.id,
        f2: strengthGate.id,
      })),
    ),
  );
}

const BOOTSTRAP_CONCURRENCY = 4;

export async function loadStrategyBootstrapMap(): Promise<
  [string, StrategyPageData | null][]
> {
  const selections = listStrategyBootstrapSelections();
  const results: [string, StrategyPageData | null][] = [];

  for (let i = 0; i < selections.length; i += BOOTSTRAP_CONCURRENCY) {
    const batch = selections.slice(i, i + BOOTSTRAP_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (selection): Promise<[string, StrategyPageData | null]> => [
        buildStrategySelectionKey(selection),
        await loadStrategyPageData(selection),
      ]),
    );
    results.push(...batchResults);
  }

  return results;
}
