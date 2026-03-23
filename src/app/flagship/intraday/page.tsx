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
import ForwardTestPlaceholder from "@/components/flagship/ForwardTestPlaceholder";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";

export const dynamic = "force-dynamic";

export default async function IntradayForwardTestPage() {
  const flagships = await resolveCanonicalFlagships();
  const winner = flagships.intraday;

  return (
    <DashboardLayout>
      <ForwardTestPlaceholder
        title="Intraday Forward Test"
        subtitle="Current Week"
        strategyName={winner.strategyName}
        sourceLabel={
          winner.status === "research"
            ? "Research in progress"
            : winner.sourceLabel
        }
        summaryMetrics={[
          { label: "Week-To-Date", value: "—" },
          { label: "Signals", value: "0" },
          { label: "Trades", value: "0" },
        ]}
        columns={["Symbol", "Session", "Sweep", "Entry Status", "Session P&L"]}
        emptyTitle="No live intraday forward-test feed yet"
        emptyBody="This page is reserved for the intraday flagship once that workstream is relocked. The structure is in place for live signal status and trade-state tracking once the forward-test pipeline is wired."
      />
    </DashboardLayout>
  );
}
