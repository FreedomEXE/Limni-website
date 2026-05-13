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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import LimniLoading from "@/components/LimniLoading";
import {
  buildStrategySelectionKey,
  type RuntimeStrategySelection,
} from "@/lib/performance/strategySelection";
import {
  fetchStrategyArtifactStatus,
  requestStrategyArtifactWarmPayload,
} from "@/lib/performance/strategyClientCache";

type StrategyArtifactLoadingGateProps = {
  currentReady: boolean;
  currentSelection: RuntimeStrategySelection;
  pageLabel: string;
  children: ReactNode;
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function StrategyArtifactLoadingGate({
  currentReady,
  currentSelection,
  pageLabel,
  children,
}: StrategyArtifactLoadingGateProps) {
  const currentKey = useMemo(
    () => buildStrategySelectionKey(currentSelection),
    [currentSelection],
  );
  const [label, setLabel] = useState(`Loading ${pageLabel}...`);

  useEffect(() => {
    if (currentReady) {
      return undefined;
    }

    let active = true;

    const warmCurrentArtifact = async () => {
      setLabel(`Loading ${pageLabel}...`);

      while (active) {
        const warmResult = await requestStrategyArtifactWarmPayload(currentSelection);
        if (!active) return;
        if (warmResult?.after?.label) {
          setLabel(`Building ${warmResult.after.label}...`);
        }

        const status = await fetchStrategyArtifactStatus(currentKey);
        if (!active) return;

        if (!status) {
          setLabel("Checking updates...");
          await wait(5000);
          continue;
        }

        const artifacts = status.artifacts ?? [];
        const currentArtifact = artifacts.find((artifact) => artifact.key === currentKey);
        if (currentArtifact?.ready) {
          setLabel(`Loading ${pageLabel}...`);
          return;
        }

        if (currentArtifact?.shardProgress && currentArtifact.shardProgress.total > 0) {
          setLabel(
            `Building ${currentArtifact.label}: ${currentArtifact.shardProgress.ready}/${currentArtifact.shardProgress.total} weeks...`,
          );
        } else if (currentArtifact?.label) {
          setLabel(`Building ${currentArtifact.label}...`);
        }

        await wait(5000);
      }
    };

    void warmCurrentArtifact();

    return () => {
      active = false;
    };
  }, [currentKey, currentReady, currentSelection, pageLabel]);

  if (!currentReady) {
    return (
      <div className="fixed inset-0 z-[100]">
        <LimniLoading label={label} compact />
      </div>
    );
  }

  return <>{children}</>;
}
