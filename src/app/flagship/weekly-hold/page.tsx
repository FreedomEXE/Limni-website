/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: weekly-hold/page.tsx
 *
 * Description:
 * Forward-test placeholder page for the current audited weekly-hold flagship.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import ForwardTestPlaceholder from "@/components/flagship/ForwardTestPlaceholder";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";

export const dynamic = "force-dynamic";

export default async function WeeklyHoldForwardTestPage() {
  let winner: Awaited<ReturnType<typeof resolveCanonicalFlagships>>["weekly"];
  try {
    const flagships = await resolveCanonicalFlagships();
    winner = flagships.weekly;
  } catch {
    winner = {
      surface: "weekly",
      status: "provisional",
      systemId: null,
      strategyName: "Awaiting canonical data",
      family: null,
      isGated: null,
      sampleWeeks: null,
      sourceLabel: "Canonical report unavailable",
      reason: "Canonical weekly flagship metadata is unavailable in this environment.",
      metrics: {
        simpleReturnPct: null,
        compoundedReturnPct: null,
        maxDrawdownSimplePct: null,
        maxDrawdownPct: null,
        trades: null,
        winRatePct: null,
      },
    };
  }

  return (
    <DashboardLayout>
      <ForwardTestPlaceholder
        title="Swing Forward Test"
        subtitle="Current Week"
        strategyName={winner.strategyName}
        sourceLabel={
          winner.status === "locked"
            ? winner.sourceLabel
            : "Awaiting canonical flagship selection"
        }
        summaryMetrics={[
          { label: "Week-To-Date", value: "—" },
          { label: "Opened", value: "0" },
          { label: "Closed", value: "0" },
        ]}
        columns={["Symbol", "Direction", "Entry", "Current P&L", "Handshake"]}
        emptyTitle="No live weekly-hold forward-test pipeline yet"
        emptyBody="This page is reserved for the canonical weekly flagship. The layout is in place so the live forward-test feed can be added without touching the existing CFD and Crypto matrix boards."
      />
    </DashboardLayout>
  );
}
