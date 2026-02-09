"use client";

import { useMemo, useState } from "react";
import WeekSelector from "@/components/accounts/WeekSelector";
import PageShell from "@/components/shell/PageShell";
import AccountKpiRow from "@/components/accounts/AccountKpiRow";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import DebugReadout from "@/components/DebugReadout";
import SummaryCard from "@/components/accounts/SummaryCard";
import FilterBar from "@/components/common/FilterBar";
import type { WeekOption } from "@/lib/weekState";
import type { ReactNode } from "react";

type HeaderConfig = {
  title: string;
  providerLabel: string;
  tradeModeLabel?: string;
  statusLabel?: string;
  statusToneClass?: string;
  lastSync?: string;
  weekOptions: WeekOption[];
  currentWeek: string;
  selectedWeek: WeekOption;
  weekLabelMode?: "week_open_utc" | "monday_et";
  showStopLoss1pct?: boolean;
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
      sizeDisplay?: string | null;
      riskDisplay?: string | null;
    }>;
    units?: number | null;
    netUnits?: number | null;
    move1pctUsd?: number | null;
    sizeDisplay?: string | null;
    riskDisplay?: string | null;
    entryPrice?: number | null;
    stopLoss1pct?: number | null;
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
  activeView: "overview" | "trades" | "analytics";
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
    marginUsedBestCase?: number | null;
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
  gridClassName,
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<{ id: string }>;
  emptyState?: ReactNode;
  renderRow: (row: any) => ReactNode;
  maxHeight?: number;
  gridClassName?: string;
}) {
  const headerGrid =
    gridClassName ??
    "grid-cols-[repeat(auto-fit,minmax(120px,1fr))]";
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70">
      <div className={`grid ${headerGrid} gap-3 border-b border-[var(--panel-border)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]`}>
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
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [mappingSearch, setMappingSearch] = useState("");
  const [copied, setCopied] = useState(false);

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

  const tradeModeBadge = useMemo(() => {
    if (!header.tradeModeLabel) return null;
    const isManual = header.tradeModeLabel.toUpperCase() === "MANUAL";
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
          isManual
            ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
            : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]"
        }`}
      >
        {header.tradeModeLabel}
      </span>
    );
  }, [header.tradeModeLabel]);

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

  const showKpis = activeView === "overview";
  const providerKey = header.providerLabel.toLowerCase();
  const isOanda = providerKey === "oanda";
  const parseManagedModel = (tag: string) => {
    // Expected: uni-SYMBOL-model-xxxx. Only used for display.
    const raw = String(tag ?? "").trim();
    const parts = raw.split("-");
    const model = (parts[2] ?? "").toLowerCase();
    return model || null;
  };

  const symbolRows = useMemo(() => {
    type PlannedLegRow = {
      model: string;
      direction: "LONG" | "SHORT";
      units: number | null;
      riskDisplay?: string | null;
    };
    type OpenLegRow = {
      id: string | number;
      basket: string;
      side: "BUY" | "SELL";
      lots: number;
      pnl: number;
      model: string | null;
    };
    type SymbolRow = {
      id: string;
      status: "open";
      searchText: string;
      sortValue: number;
      symbol: string;
      plannedLong: number;
      plannedShort: number;
      plannedLegs: PlannedLegRow[];
      openLong: number;
      openShort: number;
      openPnl: number;
      openLegs: OpenLegRow[];
      legsPlannedCount: number;
      legsOpenCount: number;
    };

    const plannedMap = new Map<
      string,
      { plannedLong: number; plannedShort: number; plannedLegs: PlannedLegRow[] }
    >();
    for (const pair of drawerData.plannedPairs) {
      const symbol = String(pair.symbol ?? "").trim().toUpperCase();
      if (!symbol) continue;
      if (!plannedMap.has(symbol)) {
        plannedMap.set(symbol, { plannedLong: 0, plannedShort: 0, plannedLegs: [] });
      }
      const entry = plannedMap.get(symbol)!;
      const legs = Array.isArray(pair.legs) ? pair.legs : [];
      for (const leg of legs) {
        const direction = String(leg.direction ?? "").toUpperCase();
        if (direction !== "LONG" && direction !== "SHORT") continue;
        const unitsRaw =
          typeof leg.units === "number" && Number.isFinite(leg.units)
            ? leg.units
            : typeof pair.units === "number" && Number.isFinite(pair.units)
              ? pair.units
              : null;
        const units =
          typeof unitsRaw === "number" && Number.isFinite(unitsRaw) ? Math.abs(unitsRaw) : null;
        if (direction === "LONG") entry.plannedLong += units ?? 0;
        if (direction === "SHORT") entry.plannedShort += units ?? 0;
        entry.plannedLegs.push({
          model: String(leg.model ?? "").toLowerCase() || "unknown",
          direction,
          units,
          riskDisplay: leg.riskDisplay ?? pair.riskDisplay ?? null,
        });
      }
    }

    const openMap = new Map<
      string,
      { openLong: number; openShort: number; openPnl: number; openLegs: OpenLegRow[] }
    >();
    for (const pos of drawerData.openPositions) {
      const symbol = String(pos.symbol ?? "").trim().toUpperCase();
      if (!symbol) continue;
      if (!openMap.has(symbol)) {
        openMap.set(symbol, { openLong: 0, openShort: 0, openPnl: 0, openLegs: [] });
      }
      const entry = openMap.get(symbol)!;
      const side = String(pos.side ?? "").trim().toUpperCase() === "SELL" ? "SELL" : "BUY";
      const lots = Number(pos.lots ?? 0);
      const pnl = Number(pos.pnl ?? 0);
      if (Number.isFinite(lots) && lots !== 0) {
        if (side === "BUY") entry.openLong += Math.abs(lots);
        if (side === "SELL") entry.openShort += Math.abs(lots);
      }
      entry.openPnl += Number.isFinite(pnl) ? pnl : 0;

      const legs = Array.isArray(pos.legs) ? pos.legs : [];
      for (const leg of legs) {
        const legSide = String(leg.side ?? "").trim().toUpperCase() === "SELL" ? "SELL" : "BUY";
        const legLots = Number(leg.lots ?? 0);
        const legPnl = Number(leg.pnl ?? 0);
        const basket = String(leg.basket ?? "").trim();
        entry.openLegs.push({
          id: leg.id,
          basket,
          side: legSide,
          lots: Number.isFinite(legLots) ? Math.abs(legLots) : 0,
          pnl: Number.isFinite(legPnl) ? legPnl : 0,
          model: parseManagedModel(basket),
        });
      }
    }

    const symbols = Array.from(new Set([...plannedMap.keys(), ...openMap.keys()])).sort((a, b) =>
      a.localeCompare(b),
    );

    return symbols.map((symbol) => {
      const planned = plannedMap.get(symbol) ?? { plannedLong: 0, plannedShort: 0, plannedLegs: [] };
      const open = openMap.get(symbol) ?? { openLong: 0, openShort: 0, openPnl: 0, openLegs: [] };
      return {
        id: `sym-${symbol}`,
        status: "open" as const,
        searchText: symbol,
        sortValue: open.openPnl,
        symbol,
        plannedLong: planned.plannedLong,
        plannedShort: planned.plannedShort,
        plannedLegs: planned.plannedLegs,
        openLong: open.openLong,
        openShort: open.openShort,
        openPnl: open.openPnl,
        openLegs: open.openLegs,
        legsPlannedCount: planned.plannedLegs.length,
        legsOpenCount: open.openLegs.length,
      };
    });
  }, [drawerData.openPositions, drawerData.plannedPairs]);
  const closedRows = drawerData.closedGroups.map((group) => ({
    id: `closed-${group.symbol}-${group.side}-${group.lots}`,
    status: "closed",
    searchText: `${group.symbol} ${group.side}`,
    sortValue: group.net,
    rowType: "closed",
    direction: group.side,
    ...group,
  }));
  const openSymbolCount = symbolRows.filter((row) => row.openLong + row.openShort > 0).length;
  const openLegCount = symbolRows.reduce((sum, row) => sum + Number(row.legsOpenCount ?? 0), 0);
  const closedCount = closedRows.length;

  const plannedLegCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pair of drawerData.plannedPairs) {
      if (isOanda && String(pair.assetClass ?? "").toLowerCase() !== "fx") continue;
      for (const leg of pair.legs ?? []) {
        const model = String(leg.model ?? "").toLowerCase();
        if (!model) continue;
        counts.set(model, (counts.get(model) ?? 0) + 1);
      }
    }
    return counts;
  }, [drawerData.plannedPairs, isOanda]);
  const plannedModelChips = useMemo(
    () =>
      Array.from(plannedLegCounts.entries())
        .filter(([, count]) => count > 0)
        .sort((a, b) => a[0].localeCompare(b[0])),
    [plannedLegCounts],
  );
  const netExposure = useMemo(() => {
    let sum = 0;
    for (const pair of drawerData.plannedPairs) {
      if (isOanda && String(pair.assetClass ?? "").toLowerCase() !== "fx") continue;
      const legs = Array.isArray(pair.legs) ? pair.legs : [];
      if (legs.length === 0) {
        sum += Number.isFinite(pair.net as number) ? (pair.net as number) : 0;
        continue;
      }
      for (const leg of legs) {
        const dir = String(leg.direction ?? "").toUpperCase();
        const unitsRaw =
          typeof leg.units === "number" && Number.isFinite(leg.units)
            ? leg.units
            : typeof pair.units === "number" && Number.isFinite(pair.units)
              ? pair.units
              : null;
        if (typeof unitsRaw !== "number" || !Number.isFinite(unitsRaw)) continue;
        sum += dir === "LONG" ? Math.abs(unitsRaw) : dir === "SHORT" ? -Math.abs(unitsRaw) : 0;
      }
    }
    return sum;
  }, [drawerData.plannedPairs, isOanda]);

  const metricLabel =
    "P/L";
  const sizeUnitLabel = isOanda ? "units" : providerKey === "bitget" ? "qty" : "lots";
  const rowGridCols =
    "grid-cols-[minmax(160px,1.2fr)_minmax(110px,0.7fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)_minmax(110px,0.5fr)]";
  const openGridCols =
    "grid-cols-[minmax(160px,1.2fr)_minmax(110px,0.6fr)_minmax(170px,0.9fr)_minmax(150px,0.8fr)_minmax(120px,0.6fr)_minmax(110px,0.5fr)]";

  const formatStopLoss = (symbol: string, value: number) => {
    const upper = symbol.toUpperCase();
    const decimals = upper.includes("JPY") ? 3 : 5;
    return value.toFixed(decimals);
  };

  const stopLossLines = useMemo(() => {
    if (!header.showStopLoss1pct) {
      return [];
    }
    return drawerData.plannedPairs
      .filter((row) => Number.isFinite(row.stopLoss1pct as number))
      .map((row) => {
        const dir = row.net > 0 ? "LONG" : row.net < 0 ? "SHORT" : "NEUTRAL";
        if (dir !== "LONG" && dir !== "SHORT") return null;
        return `${row.symbol}\t${dir}\tSL ${formatStopLoss(row.symbol, row.stopLoss1pct as number)}`;
      })
      .filter((line): line is string => Boolean(line));
  }, [header.showStopLoss1pct, drawerData.plannedPairs]);

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
            {tradeModeBadge}
            {statusBadge}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <WeekSelector
              weekOptions={header.weekOptions}
              currentWeek={header.currentWeek}
              selectedWeek={header.selectedWeek}
              labelMode={header.weekLabelMode}
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
      {activeView === "overview" ? (
        <div className="space-y-4">
          <EquityCurveChart points={equity.points} title={equity.title} interactive={false} />
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

      {activeView === "trades" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Open"
              value={openLegCount}
              hint="Open legs right now"
              onClick={() => setStatusFilter("open")}
              selected={statusFilter === "open"}
            />
            <SummaryCard
              label="Closed"
              value={closedCount}
              hint="Closed this week"
              onClick={() => setStatusFilter("closed")}
              selected={statusFilter === "closed"}
            />
            <SummaryCard
              label="Net Exposure"
              value={
                isOanda
                  ? `${netExposure.toFixed(0)} units`
                  : `${netExposure.toFixed(2)}`
              }
              hint="Planned net exposure"
            />
          </div>
          {drawerData.plannedPairs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 px-4 py-3 text-xs text-[color:var(--muted)]">
              <span className="uppercase tracking-[0.2em]">
                Legs (open {openLegCount} / planned{" "}
                {drawerData.plannedPairs.reduce((sum, pair) => {
                  if (isOanda && String(pair.assetClass ?? "").toLowerCase() !== "fx") return sum;
                  return sum + (Array.isArray(pair.legs) ? pair.legs.length : 0);
                }, 0)})
              </span>
              {plannedModelChips.map(([key, count]) => (
                <span
                  key={key}
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]/80"
                >
                  {key}: {count}
                </span>
              ))}
            </div>
          ) : null}
          <FilterBar
            status={statusFilter}
            onStatusChange={setStatusFilter}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            statusOptions={["open", "closed"]}
          />
          {header.showStopLoss1pct &&
          statusFilter === "open" &&
          stopLossLines.length > 0 ? (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]/80">
                    Recommended Stop Losses (1%)
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    Format: SYMBOL [tab] DIRECTION [tab] SL PRICE
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(stopLossLines.join("\n"));
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1200);
                    } catch {
                      // ignore clipboard failures
                    }
                  }}
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={stopLossLines.join("\n")}
                className="mt-3 h-32 w-full resize-none rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 font-mono text-xs text-[var(--foreground)]"
              />
            </div>
          ) : null}
          {plannedSummary ? (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-3 text-xs text-[color:var(--muted)]">
              Estimated margin used this week:{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {plannedSummary.currency ?? "$"}
                {(plannedSummary.marginUsed ?? 0).toFixed(2)}
              </span>
              {plannedSummary.marginUsedBestCase !== null &&
              plannedSummary.marginUsedBestCase !== undefined ? (
                <>
                  {" "}
                  • Best case (net hedged){" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {plannedSummary.currency ?? "$"}
                    {plannedSummary.marginUsedBestCase.toFixed(2)}
                  </span>
                </>
              ) : null}
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
          {statusFilter === "open" ? (
            <SimpleListTable
              columns={[
                { key: "symbol", label: "Symbol" },
                { key: "direction", label: "Direction" },
                { key: "filled", label: "Filled" },
                { key: "net", label: "Net" },
                { key: "metric", label: metricLabel },
                { key: "legs", label: "Legs" },
              ]}
              rows={filterRows(symbolRows as any[])}
              emptyState="No positions for this week."
              maxHeight={520}
              gridClassName={openGridCols}
              renderRow={(row: any) => {
                const plannedLong = Number(row.plannedLong ?? 0);
                const plannedShort = Number(row.plannedShort ?? 0);
                const openLong = Number(row.openLong ?? 0);
                const openShort = Number(row.openShort ?? 0);
                const openPnl = Number(row.openPnl ?? 0);
                const grossPlanned = plannedLong + plannedShort;
                const grossOpen = openLong + openShort;
                const netPlanned = plannedLong - plannedShort;
                const netOpen = openLong - openShort;

                const fmt = (val: number) => val.toFixed(isOanda ? 0 : 2);
                const filledText =
                  grossPlanned > 0 ? `${fmt(grossOpen)}/${fmt(grossPlanned)}` : `${fmt(grossOpen)}/—`;
                const netText =
                  typeof netPlanned === "number"
                    ? netPlanned !== 0
                      ? `${fmt(netOpen)}/${fmt(netPlanned)}`
                      : `${fmt(netOpen)}`
                    : `${fmt(netOpen)}`;

                const directionSource = Math.abs(netOpen) > 0 ? netOpen : netPlanned;
                const direction =
                  directionSource > 0 ? "LONG" : directionSource < 0 ? "SHORT" : "NEUTRAL";

                const expanded =
                  (Array.isArray(row.plannedLegs) && row.plannedLegs.length > 0) ||
                  (Array.isArray(row.openLegs) && row.openLegs.length > 0);

                return (
                  <details className={expanded ? "group" : ""}>
                    <summary
                      className={`grid cursor-pointer list-none ${openGridCols} gap-3 [&::-webkit-details-marker]:hidden`}
                    >
                      <span className="font-semibold">{row.symbol}</span>
                      <span
                        className={
                          direction === "LONG"
                            ? "text-emerald-700"
                            : direction === "SHORT"
                              ? "text-rose-700"
                              : "text-[color:var(--muted)]"
                        }
                      >
                        {direction}
                      </span>
                      <span className="text-xs text-[color:var(--muted)]">{filledText}</span>
                      <span className={netOpen >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        {netOpen >= 0 ? "+" : ""}
                        {netText}
                      </span>
                      <span className={openPnl >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        {Number.isFinite(openPnl) ? openPnl.toFixed(2) : "—"}
                      </span>
                      <span className="text-xs text-[color:var(--muted)]">
                        {Number(row.legsOpenCount ?? 0)}/{Number(row.legsPlannedCount ?? 0)}
                      </span>
                    </summary>

                    {expanded ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-3">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            Planned Legs
                          </div>
                          <div className="mt-2 space-y-2">
                            {(row.plannedLegs ?? []).length === 0 ? (
                              <div className="text-xs text-[color:var(--muted)]">No planned legs.</div>
                            ) : (
                              (row.plannedLegs ?? []).map((leg: any, idx: number) => (
                                <div
                                  key={`${row.symbol}-planned-${idx}`}
                                  className="grid grid-cols-[1fr_0.7fr_0.9fr] gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs"
                                >
                                  <div className="truncate text-[var(--foreground)]/90">
                                    {String(leg.model ?? "unknown")}
                                  </div>
                                  <div
                                    className={
                                      String(leg.direction).toUpperCase() === "LONG"
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }
                                  >
                                    {String(leg.direction).toUpperCase()}
                                  </div>
                                  <div className="text-right">
                                    {Number.isFinite(Number(leg.units)) ? fmt(Number(leg.units)) : "—"}{" "}
                                    {sizeUnitLabel}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-3">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            Open Legs
                          </div>
                          <div className="mt-2 space-y-2">
                            {(row.openLegs ?? []).length === 0 ? (
                              <div className="text-xs text-[color:var(--muted)]">No open legs.</div>
                            ) : (
                              (row.openLegs ?? []).map((leg: any) => (
                                <div
                                  key={leg.id}
                                  className="grid grid-cols-[1fr_0.7fr_0.9fr_0.9fr] gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs"
                                >
                                  <div className="truncate text-[var(--foreground)]/90">
                                    {leg.model ? `${leg.model} • ` : ""}
                                    {String(leg.basket ?? "live")}
                                  </div>
                                  <div
                                    className={
                                      String(leg.side).toUpperCase() === "BUY"
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }
                                  >
                                    {String(leg.side).toUpperCase()}
                                  </div>
                                  <div className="text-right">
                                    {fmt(Number(leg.lots ?? 0))} {sizeUnitLabel}
                                  </div>
                                  <div
                                    className={`text-right ${
                                      Number(leg.pnl ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                                    }`}
                                  >
                                    {Number(leg.pnl ?? 0).toFixed(2)}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </details>
                );
              }}
            />
          ) : (
            <SimpleListTable
              columns={[
                { key: "symbol", label: "Symbol" },
                { key: "direction", label: "Direction" },
                { key: "size", label: "Size" },
                { key: "metric", label: metricLabel },
                { key: "legs", label: "Legs" },
              ]}
              rows={filterRows(closedRows as any[])}
              emptyState="No closed positions for this week."
              maxHeight={520}
              gridClassName={rowGridCols}
              renderRow={(row) => (
                <div className={`grid ${rowGridCols} gap-3`}>
                  <span className="font-semibold">{row.symbol}</span>
                  <span className={String(row.direction).toUpperCase() === "BUY" ? "text-emerald-700" : "text-rose-700"}>
                    {String(row.direction).toUpperCase()}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {Number(row.lots ?? 0).toFixed(isOanda ? 0 : 2)} {sizeUnitLabel}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">—</span>
                  <span className="text-xs text-[color:var(--muted)]">{row.legs?.length ?? 0} legs</span>
                </div>
              )}
            />
          )}
        </div>
      ) : null}

      {activeView === "analytics" ? (
        <div className="space-y-4">
          <DebugReadout
            title="Week Scope Debug"
            items={[
              { label: "Selected", value: debug.selectedWeekKey },
              { label: "KPI", value: debug.kpiWeekKey },
              { label: "Equity", value: debug.equityWeekKey },
            ]}
          />
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
          <SimpleListTable
            columns={[
              { key: "label", label: "Key" },
              { key: "value", label: "Value" },
            ]}
            rows={drawerData.kpiRows.map((row, index) => ({ id: `kpi-${index}`, ...row }))}
            emptyState="No KPI debug rows."
            renderRow={(row) => (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {row.label}
                </span>
                <span className="text-xs text-[var(--foreground)]">{row.value}</span>
              </div>
            )}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={mappingSearch}
              onChange={(event) => setMappingSearch(event.target.value)}
              placeholder="Search mapping"
              className="h-9 flex-1 rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 text-sm text-[var(--foreground)] placeholder:text-[color:var(--muted)]"
            />
          </div>
          <SimpleListTable
            columns={[
              { key: "symbol", label: "Symbol" },
              { key: "instrument", label: "Instrument" },
              { key: "status", label: "Status" },
            ]}
            rows={drawerData.mappingRows
              .map((row) => ({
                id: row.symbol,
                ...row,
                searchText: `${row.symbol} ${row.instrument}`,
              }))
              .filter((row) =>
                mappingSearch
                  ? row.searchText.toLowerCase().includes(mappingSearch.toLowerCase())
                  : true
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
