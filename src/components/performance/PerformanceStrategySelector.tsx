/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceStrategySelector.tsx
 *
 * Description:
 * Thin wrapper around the shared StrategySelector for the Performance sidebar.
 * Preserves the same component interface for backward compatibility.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import StrategySelector from "@/components/shared/StrategySelector";

type PerformanceStrategySelectorProps = {
  initialBiasSource: string;
  initialFilter: string;
};

export default function PerformanceStrategySelector(_props: PerformanceStrategySelectorProps) {
  return <StrategySelector layout="sidebar" />;
}
