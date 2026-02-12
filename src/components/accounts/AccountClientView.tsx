"use client";

import { useMemo, useState } from "react";
import PageShell from "@/components/shell/PageShell";
import AccountKpiRow from "@/components/accounts/AccountKpiRow";
import AccountTradesSection from "@/components/accounts/AccountTradesSection";
import AccountAnalyticsSection from "@/components/accounts/AccountAnalyticsSection";
import AccountPageHeader from "@/components/accounts/AccountPageHeader";
import AccountOverviewSection from "@/components/accounts/AccountOverviewSection";
import {
  buildStopLossLines,
  computeNetExposure,
  computePlannedLegCounts,
  computePlannedLegTotal,
} from "@/lib/accounts/accountClientViewStats";
import { filterAccountRows } from "@/lib/accounts/accountClientViewFilters";
import {
  buildClosedRows,
  buildSymbolRows,
} from "@/lib/accounts/accountClientViewRows";
import type { AccountClientViewProps } from "@/lib/accounts/accountClientViewTypes";
import {
  formatStopLossValue,
  getAccountClientViewLayout,
} from "@/lib/accounts/accountClientViewLayout";

export default function AccountClientView({
  activeView,
  header,
  kpi,
  overview,
  plannedSummary,
  equity,
  debug,
  planningDiagnostics,
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

  const sourceBadge = useMemo(() => {
    const source = String(header.dataSourceLabel ?? "").toLowerCase();
    const status = String(header.reconstructionStatus ?? "partial").toUpperCase();
    const note = header.reconstructionNote ? ` (${header.reconstructionNote})` : "";
    if (source === "reconstructed") {
      return (
        <span
          title={`Metrics reconstructed after reconnect${note}`}
          className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200"
        >
          Reconstructed {status}
        </span>
      );
    }
    if (source === "estimated") {
      return (
        <span
          title={header.reconstructionNote ?? "Historical metrics are estimated from latest snapshot"}
          className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200"
        >
          Estimated Week
        </span>
      );
    }
    return null;
  }, [header.dataSourceLabel, header.reconstructionStatus, header.reconstructionNote]);

  const showKpis = activeView === "overview";
  const providerKey = header.providerLabel.toLowerCase();
  const isOanda = providerKey === "oanda";
  const isManualMode = String(header.tradeModeLabel ?? "").toUpperCase() === "MANUAL";
  const symbolRows = useMemo(
    () => buildSymbolRows(drawerData.plannedPairs, drawerData.openPositions),
    [drawerData.openPositions, drawerData.plannedPairs],
  );
  const liveSymbolRows = useMemo(
    () => symbolRows.filter((row) => row.hasOpenExposure),
    [symbolRows],
  );
  const closedRows = useMemo(
    () => buildClosedRows(drawerData.closedGroups),
    [drawerData.closedGroups],
  );
  const filteredReconcileRows = filterAccountRows({
    rows: symbolRows,
    statusFilter,
    search,
    sort,
  });
  const filteredLiveRows = filterAccountRows({
    rows: liveSymbolRows,
    statusFilter,
    search,
    sort,
  });
  const filteredClosedRows = filterAccountRows({
    rows: closedRows,
    statusFilter,
    search,
    sort,
  });
  const openLegCount = liveSymbolRows.reduce((sum, row) => sum + Number(row.legsOpenCount ?? 0), 0);
  const closedCount = closedRows.length;

  const plannedLegCounts = useMemo(
    () => computePlannedLegCounts(drawerData.plannedPairs, isOanda),
    [drawerData.plannedPairs, isOanda],
  );
  const plannedModelChips = useMemo(
    () =>
      Array.from(plannedLegCounts.entries())
        .filter(([, count]) => count > 0)
        .sort((a, b) => a[0].localeCompare(b[0])),
    [plannedLegCounts],
  );
  const netExposure = useMemo(
    () => computeNetExposure(drawerData.plannedPairs, isOanda),
    [drawerData.plannedPairs, isOanda],
  );
  const plannedLegTotal = useMemo(
    () => computePlannedLegTotal(drawerData.plannedPairs, isOanda),
    [drawerData.plannedPairs, isOanda],
  );

  const { metricLabel, sizeUnitLabel, rowGridCols, openGridCols } = getAccountClientViewLayout(
    header.providerLabel,
    isOanda,
  );

  const stopLossLines = useMemo(
    () => buildStopLossLines(drawerData.plannedPairs, header.showStopLoss1pct, formatStopLossValue),
    [header.showStopLoss1pct, drawerData.plannedPairs],
  );
  const manualSizingBaseline =
    Number(kpi.baselineEquity ?? 0) > 0 ? Number(kpi.baselineEquity ?? 0) : Number(kpi.equity ?? 0);

  return (
    <PageShell
      header={
        <AccountPageHeader
          title={header.title}
          providerLabel={header.providerLabel}
          tradeModeBadge={tradeModeBadge}
          statusBadge={statusBadge}
          sourceBadge={sourceBadge}
          weekOptions={header.weekOptions}
          currentWeek={header.currentWeek}
          selectedWeek={header.selectedWeek}
          weekLabelMode={header.weekLabelMode}
          lastSync={header.lastSync}
          onBackHref={header.onBackHref}
        />
      }
      kpis={
        showKpis ? (
          <AccountKpiRow
            key={debug.selectedWeekKey}
            weeklyPnlPct={kpi.weeklyPnlPct}
            maxDrawdownPct={kpi.maxDrawdownPct}
            tradesThisWeek={kpi.tradesThisWeek}
            openPositions={kpi.openPositions}
            equity={kpi.equity}
            balance={kpi.balance}
            currency={kpi.currency}
            scopeLabel={kpi.scopeLabel}
          />
        ) : null
      }
    >
      {activeView === "overview" ? <AccountOverviewSection equity={equity} overview={overview} /> : null}

      {activeView === "trades" ? (
        <AccountTradesSection
          isOanda={isOanda}
          openLegCount={openLegCount}
          closedCount={closedCount}
          netExposure={netExposure}
          plannedPairsCount={drawerData.plannedPairs.length}
          plannedLegTotal={plannedLegTotal}
          plannedModelChips={plannedModelChips}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          showStopLoss1pct={Boolean(header.showStopLoss1pct)}
          stopLossLines={stopLossLines}
          copied={copied}
          onCopyStopLoss={async () => {
            try {
              await navigator.clipboard.writeText(stopLossLines.join("\n"));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            } catch {
              // ignore clipboard failures
            }
          }}
          plannedSummary={plannedSummary}
          liveSymbolRows={filteredLiveRows}
          reconcileSymbolRows={filteredReconcileRows}
          closedRows={filteredClosedRows}
          metricLabel={metricLabel}
          sizeUnitLabel={sizeUnitLabel}
          openGridCols={openGridCols}
          rowGridCols={rowGridCols}
          manualExecution={{
            enabled: isManualMode && drawerData.plannedPairs.length > 0,
            accountLabel: header.title,
            weekLabel: String(header.selectedWeek ?? ""),
            currency: kpi.currency,
            equity: manualSizingBaseline,
            defaultRiskMode: header.riskModeLabel ?? null,
            plannedPairs: drawerData.plannedPairs.map((pair) => ({
              symbol: pair.symbol,
              net: Number(pair.net ?? 0),
              entryPrice: pair.entryPrice ?? null,
              legs: (pair.legs ?? []).map((leg) => ({
                model: leg.model,
                direction: leg.direction,
              })),
            })),
          }}
        />
      ) : null}

      {activeView === "analytics" ? (
        <AccountAnalyticsSection
          debug={debug}
          planningDiagnostics={planningDiagnostics}
          journalRows={drawerData.journalRows}
          kpiRows={drawerData.kpiRows}
          mappingRows={drawerData.mappingRows}
          mappingSearch={mappingSearch}
          onMappingSearchChange={setMappingSearch}
          settingsExtras={settingsExtras}
        />
      ) : null}
    </PageShell>
  );
}
