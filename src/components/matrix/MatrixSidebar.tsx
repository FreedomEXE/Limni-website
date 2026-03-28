/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MatrixSidebar.tsx
 *
 * Description:
 * Matrix sidebar with the shared StrategySelector.
 * Same pattern as PerformanceSidebar — selector controls
 * both CFD and Crypto boards via URL params.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import StrategySelector from "@/components/shared/StrategySelector";

export default function MatrixSidebar() {
  return (
    <div className="space-y-4">
      <StrategySelector />
    </div>
  );
}
