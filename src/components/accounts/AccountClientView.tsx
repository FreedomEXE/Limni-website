"use client";

import { useMemo, useState } from "react";
import WeekSelector from "@/components/accounts/WeekSelector";
import PageShell from "@/components/shell/PageShell";
import AccountKpiRow from "@/components/accounts/AccountKpiRow";
import MiniSparkline from "@/components/visuals/MiniSparkline";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import DebugReadout from "@/components/DebugReadout";
import SummaryCard from "@/components/accounts/SummaryCard";
import AccountDrawer, { type DrawerConfig, type DrawerMode } from "@/components/accounts/AccountDrawer";
import type { PlannedPair } from "@/lib/plannedTrades";
import type { WeekOption } from "@/lib/weekState";

type HeaderConfig = {
  title: string;
  providerLabel: string;
  statusLabel?: string;
  statusToneClass?: string;
  lastSync?: string;
  weekOptions: WeekOption[];
  currentWeek: string;
  selectedWeek: WeekOption;
  onBackHref: string;
};

type DrawerData = {
  plannedPairs: Array<{
    symbol: string;
    assetClass: string;
    net: number;
    legsCount: number;
  }>;
  mappingRows: Array<{
    symbol: string;
    instrument: string;
    available: boolean;
  }>;
  openPositions: Array<{
    symbol: string;
    side: string;
    lots: number;
    pnl: number;
  }>;
  closedGroups: Array<{
    symbol: string;
    side: string;
    net: number;
    lots: number;
  }>;
  journalRows: Array<{
    label: string;
    value: string;
  }>;
  kpiRows: Array<{
    label: string;
    value: string;
  }>;
};

type AccountClientViewProps = {
  header: HeaderConfig;
  kpi: {
    weeklyPnlPct: number;
    maxDrawdownPct: number;
    tradesThisWeek: number;
    equity: number;
    balance: number;
    currency: string;
    scopeLabel: string;
  };
  overview: {
    openPositions: number;
    plannedCount: number;
    mappingCount: number;
    plannedNote?: string | null;
    journalCount?: number;
  };
  equity: {
    title: string;
    points: { ts_utc: string; equity_pct: number; lock_pct: number | null }[];
  };
  debug: {
    selectedWeekKey: string;
    kpiWeekKey: string;
    equityWeekKey: string;
  };
  drawerData: DrawerData;
};

const TABS = [
  "overview",
  "equity",
  "positions",
  "planned",
  "history",
  "journal",
  "settings",
] as const;

export default function AccountClientView({
  header,
  kpi,
  overview,
  equity,
  debug,
  drawerData,
}: AccountClientViewProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("overview");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);

  const statusBadge = useMemo(() => {
    if (!header.statusLabel) return null;
    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          header.statusToneClass ?? "bg-[var(--panel-border)]/50 text-[var(--foreground)]/70"
        }`}
      >
        {header.statusLabel}
      </span>
    );
  }, [header.statusLabel, header.statusToneClass]);

  const drawerConfigs: Partial<Record<Exclude<DrawerMode, null>, DrawerConfig>> = useMemo(() => {
    return {
      positions: {
        title: "Open Positions",
        subtitle: "Live positions for this account",
        columns: [
          { key: "symbol", label: "Symbol" },
          { key: "side", label: "Side" },
          { key: "lots", label: "Size" },
          { key: "pnl", label: "P&L" },
        ],
        rows: drawerData.openPositions.map((row, index) => ({
          id: `${row.symbol}-${index}`,
          status: "open",
          searchText: `${row.symbol} ${row.side}`,
          sortValue: row.pnl,
          cells: [
            <span key="symbol" className="font-semibold">
              {row.symbol}
            </span>,
            <span key="side" className={row.side === "BUY" ? "text-emerald-700" : "text-rose-700"}>
              {row.side}
            </span>,
            <span key="lots" className="text-xs text-[color:var(--muted)]">
              {row.lots.toFixed(2)} lots
            </span>,
            <span key="pnl" className={row.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>
              {row.pnl.toFixed(2)}
            </span>,
          ],
        })),
        showFilters: true,
        emptyState: "No open positions in this week.",
      },
      planned: {
        title: "Planned Trades",
        subtitle: "Upcoming basket signals",
        columns: [
          { key: "symbol", label: "Symbol" },
          { key: "asset", label: "Asset" },
          { key: "net", label: "Net" },
          { key: "legs", label: "Legs" },
        ],
        rows: drawerData.plannedPairs.map((pair, index) => ({
          id: `${pair.symbol}-${index}`,
          status: "pending",
          searchText: `${pair.symbol} ${pair.assetClass}`,
          sortValue: pair.net,
          cells: [
            <span key="symbol" className="font-semibold">
              {pair.symbol}
            </span>,
            <span key="asset" className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {pair.assetClass}
            </span>,
            <span key="net" className={pair.net >= 0 ? "text-emerald-700" : "text-rose-700"}>
              Net {pair.net}
            </span>,
            <span key="legs" className="text-xs text-[color:var(--muted)]">
              {pair.legsCount} legs
            </span>,
          ],
        })),
        showFilters: true,
        emptyState: "No planned trades for this week.",
      },
      closed: {
        title: "Closed Trades",
        subtitle: "Grouped closed positions",
        columns: [
          { key: "symbol", label: "Symbol" },
          { key: "side", label: "Side" },
          { key: "net", label: "Net PnL" },
          { key: "lots", label: "Lots" },
        ],
        rows: drawerData.closedGroups.map((group, index) => ({
          id: `${group.symbol}-${index}`,
          status: "closed",
          searchText: `${group.symbol} ${group.side}`,
          sortValue: group.net,
          cells: [
            <span key="symbol" className="font-semibold">
              {group.symbol}
            </span>,
            <span key="side" className={group.side === "BUY" ? "text-emerald-700" : "text-rose-700"}>
              {group.side}
            </span>,
            <span key="net" className={group.net >= 0 ? "text-emerald-700" : "text-rose-700"}>
              {group.net.toFixed(2)}
            </span>,
            <span key="lots" className="text-xs text-[color:var(--muted)]">
              {group.lots.toFixed(2)} lots
            </span>,
          ],
        })),
        showFilters: true,
        emptyState: "No closed trades recorded for this week.",
      },
      journal: {
        title: "Journal",
        subtitle: "Automation logs and weekly notes",
        columns: [
          { key: "label", label: "Type" },
          { key: "value", label: "Entry" },
        ],
        rows: drawerData.journalRows.map((row, index) => ({
          id: `${row.label}-${index}`,
          cells: [
            <span key="label" className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {row.label}
            </span>,
            <span key="value" className="text-xs text-[var(--foreground)]">
              {row.value}
            </span>,
          ],
        })),
        showFilters: false,
        emptyState: "No journal entries yet.",
      },
      mapping: {
        title: "Mapping & Settings",
        subtitle: "Instrument mapping and tools",
        columns: [
          { key: "symbol", label: "Symbol" },
          { key: "instrument", label: "Instrument" },
          { key: "status", label: "Status" },
        ],
        rows: drawerData.mappingRows.map((row, index) => ({
          id: `${row.symbol}-${index}`,
          status: row.available ? "open" : "closed",
          searchText: `${row.symbol} ${row.instrument}`,
          cells: [
            <span key="symbol" className="font-semibold">
              {row.symbol}
            </span>,
            <span key="instrument" className="text-xs text-[color:var(--muted)]">
              {row.instrument}
            </span>,
            <span
              key="status"
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                row.available
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-rose-500/10 text-rose-600"
              }`}
            >
              {row.available ? "Available" : "Missing"}
            </span>,
          ],
        })),
        showFilters: true,
        emptyState: "No mapping data available.",
      },
      kpi: {
        title: "KPI Details",
        subtitle: "Expanded performance and risk metrics",
        columns: [
          { key: "label", label: "Metric" },
          { key: "value", label: "Value" },
        ],
        rows: drawerData.kpiRows.map((row, index) => ({
          id: `${row.label}-${index}`,
          cells: [
            <span key="label" className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {row.label}
            </span>,
            <span key="value" className="font-semibold">
              {row.value}
            </span>,
          ],
        })),
        showFilters: false,
      },
    };
  }, [drawerData]);

  return (
    <PageShell
      header={
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={header.onBackHref}
              className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              Back
            </a>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Account
              </p>
              <h1 className="text-xl font-semibold text-[var(--foreground)]">{header.title}</h1>
            </div>
            <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {header.providerLabel}
            </span>
            {statusBadge}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <WeekSelector
              weekOptions={header.weekOptions}
              currentWeek={header.currentWeek}
              selectedWeek={header.selectedWeek}
            />
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh {header.lastSync ?? "—"}
            </span>
          </div>
        </header>
      }
      kpis={
        <AccountKpiRow
          key={debug.selectedWeekKey}
          weeklyPnlPct={kpi.weeklyPnlPct}
          maxDrawdownPct={kpi.maxDrawdownPct}
          tradesThisWeek={kpi.tradesThisWeek}
          equity={kpi.equity}
          balance={kpi.balance}
          currency={kpi.currency}
          scopeLabel={kpi.scopeLabel}
          onOpenDetails={() => setDrawerMode("kpi")}
        />
      }
      tabs={
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                  isActive
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      }
    >
      <div className="mb-3">
        <DebugReadout
          title="KPI Debug"
          items={[
            { label: "Selected", value: debug.selectedWeekKey },
            { label: "KPI", value: debug.kpiWeekKey },
            { label: "Equity", value: debug.equityWeekKey },
          ]}
        />
      </div>
      {activeTab === "overview" ? (
        <div className="space-y-4">
          <MiniSparkline points={equity.points} />
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Open Positions"
              value={overview.openPositions}
              hint="Live positions right now"
              action={
                <button
                  type="button"
                  onClick={() => setDrawerMode("positions")}
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
                >
                  View drawer
                </button>
              }
            />
            <SummaryCard
              label="Planned Trades"
              value={overview.plannedCount}
              hint={overview.plannedNote ?? "Upcoming basket trades"}
              action={
                <button
                  type="button"
                  onClick={() => setDrawerMode("planned")}
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
                >
                  View drawer
                </button>
              }
            />
            <SummaryCard
              label="Mappings"
              value={overview.mappingCount}
              hint="Instrument availability"
              action={
                <button
                  type="button"
                  onClick={() => setDrawerMode("mapping")}
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
                >
                  View drawer
                </button>
              }
            />
          </div>
        </div>
      ) : null}

      {activeTab === "equity" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Query summary
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Week {debug.selectedWeekKey} · Account {header.providerLabel}
            </p>
          </div>
          <EquityCurveChart points={equity.points} title={equity.title} interactive={false} />
          <DebugReadout
            title="Week Debug"
            items={[
              { label: "Selected", value: debug.selectedWeekKey },
              { label: "KPI", value: debug.kpiWeekKey },
              { label: "Equity", value: debug.equityWeekKey },
            ]}
          />
        </div>
      ) : null}

      {activeTab === "positions" ? (
        <SummaryCard
          label="Open Positions"
          value={overview.openPositions}
          hint="Live positions right now"
          action={
            <button
              type="button"
              onClick={() => setDrawerMode("positions")}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
            >
              Open drawer
            </button>
          }
        />
      ) : null}

      {activeTab === "planned" ? (
        <SummaryCard
          label="Planned Trades"
          value={overview.plannedCount}
          hint={overview.plannedNote ?? "Upcoming basket trades"}
          action={
            <button
              type="button"
              onClick={() => setDrawerMode("planned")}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
            >
              Open drawer
            </button>
          }
        />
      ) : null}

      {activeTab === "history" ? (
        <SummaryCard
          label="Closed Trades"
          value="—"
          hint="Historical trade groups"
          action={
            <button
              type="button"
              onClick={() => setDrawerMode("closed")}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
            >
              Open drawer
            </button>
          }
        />
      ) : null}

      {activeTab === "journal" ? (
        <SummaryCard
          label="Journal"
          value={overview.journalCount ?? "—"}
          hint="Automation notes and logs"
          action={
            <button
              type="button"
              onClick={() => setDrawerMode("journal")}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
            >
              Open drawer
            </button>
          }
        />
      ) : null}

      {activeTab === "settings" ? (
        <SummaryCard
          label="Mapping & Settings"
          value={overview.mappingCount}
          hint="Instrument mapping and tools"
          action={
            <button
              type="button"
              onClick={() => setDrawerMode("mapping")}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
            >
              Open drawer
            </button>
          }
        />
      ) : null}

      <AccountDrawer mode={drawerMode} configs={drawerConfigs} onClose={() => setDrawerMode(null)} />
    </PageShell>
  );
}
