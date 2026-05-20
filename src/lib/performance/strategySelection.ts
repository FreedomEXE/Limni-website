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
import {
  AGREE_3OF4_STRATEGY_ID,
  ENTRY_STYLE_FILTERS,
  SELECTOR_STRATEGY_ID,
  STRATEGIES,
  STRENGTH_GATES,
  TIERED_4W_STRATEGY_ID,
} from "@/lib/performance/strategyConfig";

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

export const VISIBLE_STRATEGY_IDS = [
  "tandem",
  TIERED_4W_STRATEGY_ID,
  AGREE_3OF4_STRATEGY_ID,
  SELECTOR_STRATEGY_ID,
] as const;

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
  const filter2Options = STRENGTH_GATES.length > 0
    ? STRENGTH_GATES
    : [{ id: "none" }];
  return STRATEGIES.flatMap((strategy) =>
    ENTRY_STYLE_FILTERS.flatMap((entryStyle) =>
      filter2Options.map((strengthGate) => ({
        strategyId: strategy.id,
        f1: entryStyle.id,
        f2: strengthGate.id,
      })),
    ),
  );
}

export function listVisibleStrategyBootstrapSelections(): StrategyBootstrapSelection[] {
  const visibleStrategies = VISIBLE_STRATEGY_IDS
    .map((id) => STRATEGIES.find((strategy) => strategy.id === id))
    .filter((strategy): strategy is NonNullable<typeof strategy> => Boolean(strategy));
  const filter2Options = STRENGTH_GATES.length > 0
    ? STRENGTH_GATES
    : [{ id: "none" }];
  return visibleStrategies.flatMap((strategy) =>
    ENTRY_STYLE_FILTERS.flatMap((entryStyle) =>
      filter2Options.map((strengthGate) => ({
        strategyId: strategy.id,
        f1: entryStyle.id,
        f2: strengthGate.id,
      })),
    ),
  );
}
