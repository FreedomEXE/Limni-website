/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/lib/performance/simulationReturnModes.ts
 *
 * Description:
 * Helpers for attaching and resolving alternate raw/normalized hourly
 * simulation paths without changing the base payload shape.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { EngineSimulationGroup } from "@/lib/performance/engineAdapter";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

export function attachSimulationReturnModes(
  base: EngineSimulationGroup,
  modes: Partial<Record<"raw" | "normalized", EngineSimulationGroup>>,
): EngineSimulationGroup {
  return {
    ...base,
    returnModes: {
      normalized: {
        metrics: base.metrics,
        series: base.series,
      },
      ...Object.fromEntries(
        Object.entries(modes).map(([mode, group]) => [
          mode,
          group
            ? {
                metrics: group.metrics,
                series: group.series,
              }
            : undefined,
        ]),
      ),
    },
  };
}

export function resolveSimulationGroupForViewMode(
  group: EngineSimulationGroup | null,
  viewMode: Pick<ViewMode, "normalization">,
): EngineSimulationGroup | null {
  if (!group) return null;
  const mode = viewMode.normalization === "raw" ? "raw" : "normalized";
  const alternate = group.returnModes?.[mode];
  if (!alternate) return group;
  return {
    ...group,
    metrics: alternate.metrics,
    series: alternate.series,
  };
}
