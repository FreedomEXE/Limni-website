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
  requestStrategyArtifactWarmPayload,
} from "@/lib/performance/strategyClientCache";
import type { StrategyArtifactStatusRow } from "@/lib/performance/strategyClientCache";

type StrategyArtifactLoadingGateProps = {
  currentReady: boolean;
  currentSelection: RuntimeStrategySelection;
  pageLabel: string;
  children: ReactNode;
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const WARM_CONCURRENCY = 2;

async function warmPendingArtifacts(
  pending: StrategyArtifactStatusRow[],
  currentKey: string,
  onLabel: (label: string) => void,
) {
  const ordered = [...pending].sort((left, right) => {
    if (left.key === currentKey) return -1;
    if (right.key === currentKey) return 1;
    return left.label.localeCompare(right.label);
  });
  const results: Array<Awaited<ReturnType<typeof requestStrategyArtifactWarmPayload>>> = [];

  for (let index = 0; index < ordered.length; index += WARM_CONCURRENCY) {
    const batch = ordered.slice(index, index + WARM_CONCURRENCY);
    const batchLabel = batch.map((artifact) => artifact.label).join(" + ");
    onLabel(`Building ${batchLabel}...`);
    const settled = await Promise.allSettled(
      batch.map((artifact) =>
        requestStrategyArtifactWarmPayload({
          strategy: artifact.strategy,
          f1: artifact.f1,
          f2: artifact.f2,
        }),
      ),
    );
    for (const result of settled) {
      results.push(result.status === "fulfilled" ? result.value : null);
    }
  }

  return results;
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

        const warmResults = await warmPendingArtifacts(pending, currentKey, (nextLabel) => {
          if (active) setLabel(nextLabel);
        });
        if (!active) return;

        const failed = warmResults.find((result) => result && !result.ok && !result.after?.ready);
        if (failed) {
          setLabel(
            failed.after?.label
              ? `Retrying ${failed.after.label}...`
              : "Retrying strategy artifact build...",
          );
          await wait(10000);
          continue;
        }

        setLabel(`Verifying strategy artifacts ${status.readyCount}/${status.totalCount}...`);
        await wait(2000);
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
