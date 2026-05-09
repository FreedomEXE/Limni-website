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
  requestVisibleStrategyArtifactsWarm,
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

        const pending = artifacts.filter((artifact) => !artifact.ready);
        const currentPending = currentArtifact && !currentArtifact.ready ? currentArtifact : null;
        setLabel(
          currentPending
            ? `Building ${currentPending.label}...`
            : `Building strategy artifacts ${status.readyCount}/${status.totalCount}...`,
        );

        const warmResult = await requestVisibleStrategyArtifactsWarm();
        if (!active) return;

        if (warmResult?.failed?.length) {
          const failed = warmResult.failed[0];
          setLabel(
            failed
              ? `Artifact build failed: ${failed.label}`
              : "Artifact build failed...",
          );
          await wait(10000);
          continue;
        }

        setLabel(
          warmResult
            ? `Verifying strategy artifacts ${warmResult.after.ready}/${warmResult.after.total}...`
            : `Verifying strategy artifacts ${status.readyCount}/${status.totalCount}...`,
        );
        await wait(warmResult?.timedOut || pending.length > 0 ? 2000 : 5000);
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
