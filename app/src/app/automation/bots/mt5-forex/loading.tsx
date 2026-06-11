/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: loading.tsx
 *
 * Description:
 * Skeleton loader for the MT5 Forex / Katarakti bot dashboard page.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";

export default function Mt5ForexBotLoading() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)]" />
        <div className="h-10 animate-pulse rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]" />
        <div className="h-96 animate-pulse rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]" />
      </div>
    </DashboardLayout>
  );
}
