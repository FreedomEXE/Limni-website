/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: StrategyArtifactLoadingGate.tsx
 *
 * Description:
 * Full-page artifact loading gate for strategy-backed pages. It releases
 * immediately when the current selection has data and only warms the
 * active selection when that data is truly missing.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import type { ReactNode } from "react";
import LimniLoading from "@/components/LimniLoading";

type StrategyArtifactLoadingGateProps = {
  currentReady: boolean;
  pageLabel: string;
  children: ReactNode;
};

export default function StrategyArtifactLoadingGate({
  currentReady,
  pageLabel,
  children,
}: StrategyArtifactLoadingGateProps) {
  if (!currentReady) {
    return (
      <div className="fixed inset-0 z-[100]">
        <LimniLoading label={`Loading ${pageLabel}...`} compact />
      </div>
    );
  }

  return <>{children}</>;
}
