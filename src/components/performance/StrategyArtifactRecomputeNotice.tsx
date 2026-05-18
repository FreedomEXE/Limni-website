/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: StrategyArtifactRecomputeNotice.tsx
 *
 * Description:
 * User-facing stale artifact state while weekly strategy artifacts rebuild.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { StrategyPageData } from "@/lib/performance/strategyPageData";

type StrategyArtifactRecomputeNoticeProps = {
  artifactMeta: StrategyPageData["artifactMeta"] | undefined;
};

function reasonCopy(reason: string | null | undefined) {
  switch (reason) {
    case "stale_week":
      return "A new trading week has opened and strategy history is being reassembled.";
    case "stale":
      return "The strategy engine version changed and cached artifacts are being refreshed.";
    case "stale_options":
      return "The available week set changed and cached artifacts are being refreshed.";
    case "missing":
      return "Historical week shards are still being built.";
    default:
      return "Strategy artifacts are being refreshed.";
  }
}

export default function StrategyArtifactRecomputeNotice({
  artifactMeta,
}: StrategyArtifactRecomputeNoticeProps) {
  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-900 shadow-sm dark:text-amber-100">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
        Recomputing Strategy Data
      </div>
      <p className="mt-2 leading-6">
        {reasonCopy(artifactMeta?.staleReason)} The page will show fresh charts and week metrics once the rebuild completes.
      </p>
      {artifactMeta?.cachedAtUtc ? (
        <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
          Last cached artifact: {new Date(artifactMeta.cachedAtUtc).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
