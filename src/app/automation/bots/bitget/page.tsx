/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Bitget Bot v2 monitoring dashboard page with tabbed read-only views
 * for live state, trades, signals, market snapshots, and alt screener.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import BitgetBotTabs from "@/components/bitget-bot/BitgetBotTabs";
import LiveStateTab from "@/components/bitget-bot/LiveStateTab";
import TradeHistoryTab from "@/components/bitget-bot/TradeHistoryTab";
import SignalLogTab from "@/components/bitget-bot/SignalLogTab";
import MarketDataTab from "@/components/bitget-bot/MarketDataTab";
import AltScreenerTab from "@/components/bitget-bot/AltScreenerTab";
import {
  isBitgetTabKey,
  resolveLifecycleTone,
  type BitgetTabKey,
  type BitgetLifecycleState,
} from "@/components/bitget-bot/types";
import { readBitgetBotStatusData } from "@/lib/bitgetBotDashboard";
import { getBitgetEnv } from "@/lib/bitgetTrade";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

function getLastTickLabel(lastTickUtc: string | null | undefined, nowIso: string) {
  if (!lastTickUtc) return "Last tick: —";
  const lastMs = Date.parse(lastTickUtc);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(lastMs) || !Number.isFinite(nowMs)) return `Last tick: ${lastTickUtc}`;
  const deltaSec = Math.max(0, Math.floor((nowMs - lastMs) / 1000));
  return `Last tick: ${deltaSec}s ago`;
}

export default async function BitgetBotPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params?.tab;
  const activeTab: BitgetTabKey = isBitgetTabKey(tabParam) ? tabParam : "live";

  const data = await readBitgetBotStatusData();
  const nowIso = new Date().toISOString();
  const lifecycle = (data.botState?.lifecycle ?? "IDLE") as BitgetLifecycleState;
  const lifecycleBadge = resolveLifecycleTone(lifecycle);
  const env = getBitgetEnv();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
            Automation / Bots / Bitget
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
            Crypto Perp Bot (Bitget)
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            BTC/ETH perp automation with COT bias, session sweeps, and handshake confirmation.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${lifecycleBadge.toneClass}`}>
              {lifecycleBadge.label}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {getLastTickLabel(data.botState?.lastTickUtc ?? null, nowIso)}
            </span>
            <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              env: {env}
            </span>
          </div>
        </header>

        <BitgetBotTabs activeTab={activeTab} />

        {activeTab === "live" ? (
          <LiveStateTab botState={data.botState} ranges={data.ranges} nowIso={nowIso} />
        ) : null}
        {activeTab === "trades" ? (
          <TradeHistoryTab trades={data.trades} />
        ) : null}
        {activeTab === "signals" ? (
          <SignalLogTab signals={data.signals} />
        ) : null}
        {activeTab === "market" ? (
          <MarketDataTab
            oi={data.marketData.oi}
            funding={data.marketData.funding}
            liquidation={data.marketData.liquidation}
            trades={data.trades}
          />
        ) : null}
        {activeTab === "alts" ? <AltScreenerTab /> : null}
      </div>
    </DashboardLayout>
  );
}
