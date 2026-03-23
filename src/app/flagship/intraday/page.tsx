/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: intraday/page.tsx
 *
 * Description:
 * Forward-test placeholder page for the current audited intraday flagship.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import IntradayForwardBoard from "@/components/flagship/IntradayForwardBoard";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";

export const dynamic = "force-dynamic";

export default async function IntradayForwardTestPage() {
  let strategyName = "Tiered V3 Net Hold Gated";
  let sourceLabel = "Weekly flagship bias with provisional ADR pullback levels";
  try {
    const flagships = await resolveCanonicalFlagships();
    strategyName = flagships.weekly.strategyName || strategyName;
    sourceLabel =
      flagships.weekly.status === "locked"
        ? `${flagships.weekly.sourceLabel} · intraday execution research`
        : sourceLabel;
  } catch {
    sourceLabel = "Weekly flagship metadata unavailable · using provisional intraday board";
  }

  return (
    <DashboardLayout>
      <IntradayForwardBoard
        strategyName={strategyName}
        sourceLabel={sourceLabel}
      />
    </DashboardLayout>
  );
}
