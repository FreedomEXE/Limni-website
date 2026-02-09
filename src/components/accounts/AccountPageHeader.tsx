"use client";

import WeekSelector from "@/components/accounts/WeekSelector";
import type { WeekOption } from "@/lib/weekState";
import type { ReactNode } from "react";

type AccountPageHeaderProps = {
  title: string;
  providerLabel: string;
  tradeModeBadge: ReactNode;
  statusBadge: ReactNode;
  weekOptions: WeekOption[];
  currentWeek: string;
  selectedWeek: WeekOption;
  weekLabelMode?: "week_open_utc" | "monday_et";
  lastSync?: string;
  onBackHref: string;
};

export default function AccountPageHeader(props: AccountPageHeaderProps) {
  const {
    title,
    providerLabel,
    tradeModeBadge,
    statusBadge,
    weekOptions,
    currentWeek,
    selectedWeek,
    weekLabelMode,
    lastSync,
    onBackHref,
  } = props;
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={onBackHref}
          className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          Back
        </a>
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Account
          </p>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1>
        </div>
        <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {providerLabel}
        </span>
        {tradeModeBadge}
        {statusBadge}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <WeekSelector
          weekOptions={weekOptions}
          currentWeek={currentWeek}
          selectedWeek={selectedWeek}
          labelMode={weekLabelMode}
        />
        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Last refresh {lastSync ?? "—"}
        </span>
      </div>
    </header>
  );
}
