"use client";

import { useMemo, useState } from "react";
import WeekSelector from "@/components/accounts/WeekSelector";
import PageShell from "@/components/shell/PageShell";
import AccountKpiRow from "@/components/accounts/AccountKpiRow";
import MiniSparkline from "@/components/visuals/MiniSparkline";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import DebugReadout from "@/components/DebugReadout";
import SummaryCard from "@/components/accounts/SummaryCard";
import FilterBar from "@/components/common/FilterBar";
import VirtualizedListTable from "@/components/common/VirtualizedListTable";
import type { WeekOption } from "@/lib/weekState";
import type { ReactNode } from "react";

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
  activeView: "overview" | "equity" | "positions" | "planned" | "history" | "journal" | "settings";
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
  settingsExtras?: ReactNode;
};

export default function AccountClientView({
  activeView,
  header,
  kpi,
  overview,
  equity,
  debug,
  drawerData,
  settingsExtras,
}: AccountClientViewProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");

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

  const searchLower = search.toLowerCase();
  const filterRows = <T extends { status?: string; searchText?: string; sortValue?: number }>(
    rows: T[],
  ) => {
    const filtered = rows.filter((row) => {
      if (statusFilter !== "all" && row.status && row.status !== statusFilter) {
        return false;
      }
      if (searchLower && row.searchText && !row.searchText.toLowerCase().includes(searchLower)) {
        return false;
      }
      return true;
    });
    if (sort === "best") {
      return [...filtered].sort((a, b) => (b.sortValue ?? 0) - (a.sortValue ?? 0));
    }
    if (sort === "worst") {
      return [...filtered].sort((a, b) => (a.sortValue ?? 0) - (b.sortValue ?? 0));
    }
    if (sort === "oldest") {
      return [...filtered].reverse();
    }
    return filtered;
  };

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
        />
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

      {activeView === "overview" ? (
        <div className="space-y-4">
          <MiniSparkline points={equity.points} />
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Open Positions"
              value={overview.openPositions}
              hint="Live positions right now"
            />
            <SummaryCard
              label="Planned Trades"
              value={overview.plannedCount}
              hint={overview.plannedNote ?? "Upcoming basket trades"}
            />
            <SummaryCard
              label="Mappings"
              value={overview.mappingCount}
              hint="Instrument availability"
            />
          </div>
        </div>
      ) : null}

      {activeView === "equity" ? (
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

      {activeView === "positions" ? (
        <div className="space-y-4">
          <FilterBar
            status={statusFilter}
            onStatusChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
          <VirtualizedListTable
            columns={[
              { key: "symbol", label: "Symbol" },
              { key: "side", label: "Side" },
              { key: "lots", label: "Size" },
              { key: "pnl", label: "P&L" },
            ]}
            rows={filterRows(
              drawerData.openPositions.map((row) => ({
                ...row,
                status: "open",
                searchText: `${row.symbol} ${row.side}`,
                sortValue: row.pnl,
              }))
            )}
            emptyState="No open positions in this week."
            renderRow={(row) => (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <span className="font-semibold">{row.symbol}</span>
                <span className={row.side === "BUY" ? "text-emerald-700" : "text-rose-700"}>
                  {row.side}
                </span>
                <span className="text-xs text-[color:var(--muted)]">{row.lots.toFixed(2)} lots</span>
                <span className={row.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>
                  {row.pnl.toFixed(2)}
                </span>
              </div>
            )}
          />
        </div>
      ) : null}

      {activeView === "planned" ? (
        <div className="space-y-4">
          <FilterBar
            status={statusFilter}
            onStatusChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
          <VirtualizedListTable
            columns={[
              { key: "symbol", label: "Symbol" },
              { key: "asset", label: "Asset" },
              { key: "net", label: "Net" },
              { key: "legs", label: "Legs" },
            ]}
            rows={filterRows(
              drawerData.plannedPairs.map((pair) => ({
                ...pair,
                status: "pending",
                searchText: `${pair.symbol} ${pair.assetClass}`,
                sortValue: pair.net,
              }))
            )}
            emptyState="No planned trades for this week."
            renderRow={(row) => (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <span className="font-semibold">{row.symbol}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {row.assetClass}
                </span>
                <span className={row.net >= 0 ? "text-emerald-700" : "text-rose-700"}>
                  Net {row.net}
                </span>
                <span className="text-xs text-[color:var(--muted)]">{row.legsCount} legs</span>
              </div>
            )}
          />
        </div>
      ) : null}

      {activeView === "history" ? (
        <div className="space-y-4">
          <FilterBar
            status={statusFilter}
            onStatusChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
          <VirtualizedListTable
            columns={[
              { key: "symbol", label: "Symbol" },
              { key: "side", label: "Side" },
              { key: "net", label: "Net PnL" },
              { key: "lots", label: "Lots" },
            ]}
            rows={filterRows(
              drawerData.closedGroups.map((group) => ({
                ...group,
                status: "closed",
                searchText: `${group.symbol} ${group.side}`,
                sortValue: group.net,
              }))
            )}
            emptyState="No closed trades recorded for this week."
            renderRow={(row) => (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <span className="font-semibold">{row.symbol}</span>
                <span className={row.side === "BUY" ? "text-emerald-700" : "text-rose-700"}>
                  {row.side}
                </span>
                <span className={row.net >= 0 ? "text-emerald-700" : "text-rose-700"}>
                  {row.net.toFixed(2)}
                </span>
                <span className="text-xs text-[color:var(--muted)]">{row.lots.toFixed(2)} lots</span>
              </div>
            )}
          />
        </div>
      ) : null}

      {activeView === "journal" ? (
        <div className="space-y-4">
          <VirtualizedListTable
            columns={[
              { key: "label", label: "Type" },
              { key: "value", label: "Entry" },
            ]}
            rows={drawerData.journalRows}
            emptyState="No journal entries yet."
            renderRow={(row) => (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {row.label}
                </span>
                <span className="text-xs text-[var(--foreground)]">{row.value}</span>
              </div>
            )}
          />
        </div>
      ) : null}

      {activeView === "settings" ? (
        <div className="space-y-4">
          <FilterBar
            status={statusFilter}
            onStatusChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
          <VirtualizedListTable
            columns={[
              { key: "symbol", label: "Symbol" },
              { key: "instrument", label: "Instrument" },
              { key: "status", label: "Status" },
            ]}
            rows={filterRows(
              drawerData.mappingRows.map((row) => ({
                ...row,
                status: row.available ? "open" : "closed",
                searchText: `${row.symbol} ${row.instrument}`,
              }))
            )}
            emptyState="No mapping data available."
            renderRow={(row) => (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <span className="font-semibold">{row.symbol}</span>
                <span className="text-xs text-[color:var(--muted)]">{row.instrument}</span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    row.available ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {row.available ? "Available" : "Missing"}
                </span>
              </div>
            )}
          />
          {settingsExtras ? <div>{settingsExtras}</div> : null}
        </div>
      ) : null}
    </PageShell>
  );
}
