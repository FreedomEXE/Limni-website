"use client";

import DebugReadout from "@/components/DebugReadout";
import SimpleListTable from "@/components/accounts/SimpleListTable";
import type { ReactNode } from "react";
import type { Mt5PlanningDiagnostics } from "@/lib/accounts/mt5Planning";

type AccountAnalyticsSectionProps = {
  debug: {
    selectedWeekKey: string;
    kpiWeekKey: string;
    equityWeekKey: string;
  };
  planningDiagnostics?: Mt5PlanningDiagnostics & {
    sizingBaselineSource?: "week_start_baseline" | "current_equity";
    sizingBaselineValue?: number;
  };
  journalRows: Array<{ label: string; value: string }>;
  kpiRows: Array<{ label: string; value: string }>;
  mappingRows: Array<{ symbol: string; instrument: string; available: boolean }>;
  mappingSearch: string;
  onMappingSearchChange: (value: string) => void;
  settingsExtras?: ReactNode;
};

export default function AccountAnalyticsSection(props: AccountAnalyticsSectionProps) {
  const {
    debug,
    planningDiagnostics,
    journalRows,
    kpiRows,
    mappingRows,
    mappingSearch,
    onMappingSearchChange,
    settingsExtras,
  } = props;

  return (
    <div className="space-y-4">
      <DebugReadout
        title="Week Scope Debug"
        items={[
          { label: "Selected", value: debug.selectedWeekKey },
          { label: "KPI", value: debug.kpiWeekKey },
          { label: "Equity", value: debug.equityWeekKey },
        ]}
      />
      {planningDiagnostics ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]/80">
            Planning Diagnostics
          </p>
          <pre className="mt-2 overflow-x-auto text-xs text-[color:var(--muted)]">
            {JSON.stringify(
              {
                raw_api_leg_count: planningDiagnostics.rawApiLegCount,
                ea_filtered_leg_count: planningDiagnostics.eaFilteredLegCount,
                displayed_leg_count: planningDiagnostics.displayedLegCount,
                model_leg_counts: planningDiagnostics.modelLegCounts,
                filters_applied: {
                  drop_netted: planningDiagnostics.filtersApplied.dropNetted,
                  force_fx_only: planningDiagnostics.filtersApplied.forceFxOnly,
                  drop_neutral: planningDiagnostics.filtersApplied.dropNeutral,
                  resolve_symbol: planningDiagnostics.filtersApplied.resolveSymbol,
                },
                sizing_baseline_source:
                  planningDiagnostics.sizingBaselineSource ?? "current_equity",
                sizing_baseline_value: planningDiagnostics.sizingBaselineValue ?? null,
              },
              null,
              2,
            )}
          </pre>
        </div>
      ) : null}
      <SimpleListTable
        columns={[
          { key: "label", label: "Type" },
          { key: "value", label: "Entry" },
        ]}
        rows={journalRows.map((row, index) => ({ id: `journal-${index}`, ...row }))}
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
        rows={kpiRows.map((row, index) => ({ id: `kpi-${index}`, ...row }))}
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
          onChange={(event) => onMappingSearchChange(event.target.value)}
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
        rows={mappingRows
          .map((row) => ({
            id: row.symbol,
            ...row,
            searchText: `${row.symbol} ${row.instrument}`,
          }))
          .filter((row) =>
            mappingSearch ? row.searchText.toLowerCase().includes(mappingSearch.toLowerCase()) : true,
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
  );
}
