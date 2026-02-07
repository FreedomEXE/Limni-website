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
  drawerConfigs: Partial<Record<Exclude<DrawerMode, null>, DrawerConfig>>;
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
  drawerConfigs,
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
