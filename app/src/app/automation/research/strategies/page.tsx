/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Research Strategies Explorer page. Shows DB-backed strategy
 * backtest coverage and summary metrics.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import AutomationResearchCards from "@/components/automation/AutomationResearchCards";
import StrategiesExplorerClient from "@/components/research/StrategiesExplorerClient";

export const dynamic = "force-dynamic";

export default function StrategiesExplorerPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Strategies Explorer
          </h1>
          <p className="text-sm text-[color:var(--muted)]">
            Overview of all registered strategy backtest runs, DB coverage, and key performance metrics.
          </p>
        </header>
        <AutomationResearchCards active="strategies" />
        <StrategiesExplorerClient />
      </div>
    </DashboardLayout>
  );
}
