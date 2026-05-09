/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: StrategyArtifactLoadingGate.tsx
 *
 * Description:
 * Full-page artifact loading gate for strategy-backed pages. It checks
 * readiness, warms missing artifacts, and only releases the page once the
 * visible strategy set is ready.
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
  requestStrategyArtifactWarm,
  type StrategyArtifactStatusRow,
} from "@/lib/performance/strategyClientCache";

type StrategyArtifactLoadingGateProps = {
  currentReady: boolean;
  currentSelection: RuntimeStrategySelection;
  pageLabel: string;
  children: ReactNode;
};

function toRuntimeSelection(row: StrategyArtifactStatusRow): RuntimeStrategySelection {
  return {
    strategy: row.strategy,
    f1: row.f1,
    f2: row.f2,
  };
}

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
  const [visibleArtifactsReady, setVisibleArtifactsReady] = useState(currentReady);
  const [label, setLabel] = useState(`Loading ${pageLabel}...`);

  useEffect(() => {
    let active = true;

    const warmVisibleArtifacts = async () => {
      setVisibleArtifactsReady(false);
      setLabel("Checking updates...");

      while (active) {
        const status = await fetchStrategyArtifactStatus();
        if (!active) return;

        if (!status) {
          setLabel("Checking updates...");
          await wait(5000);
          continue;
        }

        const artifacts = status.artifacts ?? [];
        const currentArtifact = artifacts.find((artifact) => artifact.key === currentKey);
        if (status.totalCount > 0 && status.readyCount >= status.totalCount) {
          setLabel(`Loading ${pageLabel}...`);
          setVisibleArtifactsReady(true);
          return;
        }

        if (currentArtifact && !currentArtifact.ready) {
          setLabel(`Building ${currentArtifact.label}...`);
          await requestStrategyArtifactWarm(toRuntimeSelection(currentArtifact));
          if (!active) return;
        }

        const pending = artifacts.filter((artifact) => !artifact.ready && artifact.key !== currentKey);
        for (let index = 0; index < pending.length; index += 1) {
          const artifact = pending[index];
          if (!active || !artifact) return;
          setLabel(`Building strategy artifacts ${index + 1}/${pending.length}...`);
          await requestStrategyArtifactWarm(toRuntimeSelection(artifact));
        }

        setLabel(`Loading ${pageLabel}...`);
        await wait(5000);
      }
    };

    void warmVisibleArtifacts();

    return () => {
      active = false;
    };
  }, [currentKey, pageLabel]);

  if (!visibleArtifactsReady || !currentReady) {
    return (
      <div className="fixed inset-0 z-[100]">
        <LimniLoading label={label} compact />
      </div>
    );
  }

  return <>{children}</>;
}
