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
    legs?: Array<{
      model: string;
      direction: string;
      units?: number | null;
      move1pctUsd?: number | null;
    }>;
    units?: number | null;
    netUnits?: number | null;
    move1pctUsd?: number | null;
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
    legs?: Array<{
      id: string | number;
      basket: string;
      side: string;
      lots: number;
      pnl: number;
    }>;
  }>;
  closedGroups: Array<{
    symbol: string;
    side: string;
    net: number;
    lots: number;
    legs?: Array<{
      id: string | number;
      basket: string;
      side: string;
      lots: number;
      pnl: number;
      openTime?: string;
      closeTime?: string;
    }>;
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
  activeView: "overview" | "equity" | "positions" | "settings";
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
  plannedSummary?: {
    marginUsed?: number | null;
    marginAvailable?: number | null;
    scale?: number | null;
    currency?: string | null;
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

function SimpleListTable({
  columns,
  rows,
  emptyState,
  renderRow,
  maxHeight = 520,
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<{ id: string }>;
  emptyState?: ReactNode;
  renderRow: (row: any) => ReactNode;
  maxHeight?: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 border-b border-[var(--panel-border)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {columns.map((col) => (
          <div key={col.key}>{col.label}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-[color:var(--muted)]">
          {emptyState ?? "No rows to display."}
        </div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight }}>
          {rows.map((row) => (
            <div key={row.id} className="border-b border-[var(--panel-border)]/40 px-4 py-3 text-sm text-[var(--foreground)]">
              {renderRow(row)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountClientView({
  activeView,
  header,
  kpi,
  overview,
  plannedSummary,
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

  const showKpis = activeView === "overview" || activeView === "equity";
  const isOanda = header.providerLabel.toLowerCase() === "oanda";
  const plannedRows = drawerData.plannedPairs.map((pair) => ({
    id: `planned-${pair.symbol}`,
    status: "pending",
    searchText: `${pair.symbol} ${pair.assetClass}`,
    sortValue: pair.net,
    rowType: "planned",
    ...pair,
  }));
  const openRows = drawerData.openPositions.map((row) => ({
    id: `open-${row.symbol}-${row.side}-${row.lots}`,
    status: "open",
    searchText: `${row.symbol} ${row.side}`,
    sortValue: row.pnl,
    rowType: "open",
    ...row,
  }));
  const closedRows = drawerData.closedGroups.map((group) => ({
    id: `closed-${group.symbol}-${group.side}-${group.lots}`,
    status: "closed",
    searchText: `${group.symbol} ${group.side}`,
    sortValue: group.net,
    rowType: "closed",
    ...group,
  }));
  const pendingCount = plannedRows.length;
  const openCount = openRows.length;
  const closedCount = closedRows.length;
  const netExposure = plannedRows.reduce((sum, row) => {
    if (isOanda && Number.isFinite(row.netUnits as number)) {
      return sum + (row.netUnits as number);
    }
    if (!isOanda && Number.isFinite(row.net as number)) {
      return sum + (row.net as number);
    }
    return sum;
  }, 0);

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
        showKpis ? (
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
        ) : null
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
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Pending" value={pendingCount} hint="Planned trades" />
            <SummaryCard label="Open" value={openCount} hint="Active positions" />
            <SummaryCard label="Closed" value={closedCount} hint="Closed this week" />
            <SummaryCard
              label="Net Exposure"
              value={
                isOanda
                  ? `${netExposure.toFixed(0)} units`
                  : `${netExposure.toFixed(0)} legs`
              }
              hint="Planned net exposure"
            />
          </div>
          <FilterBar
            status={statusFilter}
            onStatusChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
          {plannedSummary ? (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-3 text-xs text-[color:var(--muted)]">
              Estimated margin used this week:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {plannedSummary.currency ?? "$"}
                {(plannedSummary.marginUsed ?? 0).toFixed(2)}
              </span>
              {plannedSummary.marginAvailable ? (
                <>
                  {" "}
                  • Available{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {plannedSummary.currency ?? "$"}
                    {plannedSummary.marginAvailable.toFixed(2)}
                  </span>
                </>
              ) : null}
              {plannedSummary.scale ? (
                <>
                  {" "}
                  • Scale {plannedSummary.scale.toFixed(2)}x
                </>
              ) : null}
            </div>
          ) : null}
          <SimpleListTable
            columns={[
              { key: "symbol", label: "Symbol" },
              { key: "status", label: "Status" },
              { key: "size", label: isOanda ? "Units" : "Lots / Legs" },
              { key: "metric", label: "Metric" },
              { key: "legs", label: "Legs" },
            ]}
            rows={filterRows([...plannedRows, ...openRows, ...closedRows])}
            emptyState="No positions for this week."
            maxHeight={520}
            renderRow={(row) => (
              <details className="group">
                <summary className="grid cursor-pointer list-none grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                  <span className="font-semibold">{row.symbol}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {row.status}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {row.rowType === "planned"
                      ? isOanda
                        ? Number.isFinite(row.netUnits as number)
                          ? `${(row.netUnits as number).toFixed(0)} units`
                          : "—"
                        : Number.isFinite(row.netUnits as number)
                          ? `${(row.netUnits as number).toFixed(2)} lots`
                          : Number.isFinite(row.net as number)
                            ? `Net ${row.net} legs`
                            : "—"
                      : isOanda
                        ? "—"
                        : "lots" in row
                          ? `${(row.lots as number).toFixed(2)} lots`
                          : "—"}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {row.rowType === "planned"
                      ? Number.isFinite(row.move1pctUsd as number)
                        ? `$${(row.move1pctUsd as number).toFixed(2)}`
                        : "—"
                      : "pnl" in row
                        ? `${(row.pnl as number).toFixed(2)}`
                        : "net" in row
                          ? `${(row.net as number).toFixed(2)}`
                          : "—"}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {"legsCount" in row ? `${row.legsCount} legs` : row.legs ? `${row.legs.length} legs` : "—"}
                  </span>
                </summary>
                {row.legs && row.legs.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-3 text-xs text-[color:var(--muted)]">
                    {"model" in row.legs[0] ? (
                      (row.legs as Array<{ model: string; direction: string; units?: number | null; move1pctUsd?: number | null }>).map((leg, index) => (
                        <div key={`${row.symbol}-${index}`} className="grid grid-cols-4 gap-3">
                          <span className="font-semibold text-[var(--foreground)]">{leg.model}</span>
                          <span className={leg.direction === "LONG" ? "text-emerald-700" : "text-rose-700"}>
                            {leg.direction}
                          </span>
                          <span>
                            {Number.isFinite(leg.units ?? NaN)
                              ? isOanda
                                ? `${leg.units?.toFixed(0)} units`
                                : `${leg.units?.toFixed(2)} lots`
                              : "—"}
                          </span>
                          <span>
                            {isOanda && Number.isFinite(leg.move1pctUsd ?? NaN)
                              ? `$${leg.move1pctUsd?.toFixed(2)}`
                              : "—"}
                          </span>
                        </div>
                      ))
                    ) : (
                      (row.legs as Array<{
                        id: string | number;
                        basket: string;
                        side: string;
                        lots: number;
                        pnl: number;
                        openTime?: string;
                        closeTime?: string;
                      }>).map((leg) => (
                        <div key={leg.id} className="grid grid-cols-5 gap-3">
                          <span className="font-semibold text-[var(--foreground)]">{leg.basket}</span>
                          <span className={leg.side === "BUY" ? "text-emerald-700" : "text-rose-700"}>{leg.side}</span>
                          <span>{leg.lots.toFixed(2)} lots</span>
                          <span className={leg.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>{leg.pnl.toFixed(2)}</span>
                          <span className="text-[10px] text-[color:var(--muted)]">{leg.openTime?.slice(5, 16) ?? "—"} → {leg.closeTime?.slice(5, 16) ?? "—"}</span>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </details>
            )}
          />
        </div>
      ) : null}

      {activeView === "settings" ? (
        <div className="space-y-4">
          <SimpleListTable
            columns={[
              { key: "label", label: "Type" },
              { key: "value", label: "Entry" },
            ]}
            rows={drawerData.journalRows.map((row, index) => ({ id: `journal-${index}`, ...row }))}
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
          <FilterBar
            status={statusFilter}
            onStatusChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />
          <SimpleListTable
            columns={[
              { key: "symbol", label: "Symbol" },
              { key: "instrument", label: "Instrument" },
              { key: "status", label: "Status" },
            ]}
            rows={filterRows(
              drawerData.mappingRows.map((row) => ({
                id: row.symbol,
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
