/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Katarakti sweep-entry system monitoring dashboard with tabbed views
 * for live state, trade history, signal log, correlation, and performance.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import AutomationBotsCards from "@/components/automation/AutomationBotsCards";
import Mt5ForexTabs from "@/components/mt5-forex/Mt5ForexTabs";
import LiveStateTab from "@/components/mt5-forex/LiveStateTab";
import TradeHistoryTab from "@/components/mt5-forex/TradeHistoryTab";
import SignalLogTab from "@/components/mt5-forex/SignalLogTab";
import CorrelationTab from "@/components/mt5-forex/CorrelationTab";
import PerformanceTab from "@/components/mt5-forex/PerformanceTab";
import {
  isMt5ForexTabKey,
  resolveKataraktiLifecycleTone,
  type Mt5ForexTabKey,
  type KataraktiLifecycleState,
} from "@/components/mt5-forex/types";
import { readKataraktiStatusData } from "@/lib/kataraktiDashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

function getLastTickLabel(
  botState: Record<string, unknown> | null,
  nowIso: string,
) {
  const lastTickUtc =
    (botState as Record<string, unknown> | null)?.last_tick_utc;
  if (!lastTickUtc || typeof lastTickUtc !== "string") return "Last tick: —";
  const lastMs = Date.parse(lastTickUtc);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(lastMs) || !Number.isFinite(nowMs))
    return `Last tick: ${lastTickUtc}`;
  const deltaSec = Math.max(0, Math.floor((nowMs - lastMs) / 1000));
  return `Last tick: ${deltaSec}s ago`;
}

export default async function Mt5ForexBotPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params?.tab;
  const activeTab: Mt5ForexTabKey = isMt5ForexTabKey(tabParam)
    ? tabParam
    : "live";

  const data = await readKataraktiStatusData();
  const nowIso = new Date().toISOString();
  const lifecycle = String(
    (data.botState as Record<string, unknown> | null)?.lifecycle ?? "IDLE",
  ) as KataraktiLifecycleState;
  const lifecycleBadge = resolveKataraktiLifecycleTone(lifecycle);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
            Automation / Bots / MT5 Forex
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
            Katarakti — Sweep Entry System
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Individual pair sweep entries on FX, indices, and commodities with
            tiered bias sizing and stepped stop management.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${lifecycleBadge.toneClass}`}
            >
              {lifecycleBadge.label}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {getLastTickLabel(data.botState, nowIso)}
            </span>
            <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              36 pairs
            </span>
          </div>
        </header>

        <AutomationBotsCards active="katarakti" />

        <Mt5ForexTabs activeTab={activeTab} />

        {activeTab === "live" ? (
          <LiveStateTab
            botState={data.botState}
            trades={data.trades}
            weeklyBias={data.weeklyBias}
          />
        ) : null}
        {activeTab === "trades" ? (
          <TradeHistoryTab trades={data.trades} />
        ) : null}
        {activeTab === "signals" ? (
          <SignalLogTab signals={data.signals} />
        ) : null}
        {activeTab === "correlation" ? (
          <CorrelationTab correlationMatrix={data.correlationMatrix} />
        ) : null}
        {activeTab === "performance" ? (
          <PerformanceTab trades={data.trades} />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
