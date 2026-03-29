/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MatrixControls.tsx
 *
 * Description:
 * Client-side controls for the Matrix page — week strip + tab pills.
 * Uses the same ScrollableWeekStrip as Sentiment/Antikythera sections.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";

export type MatrixTab = "cfd" | "crypto";

type MatrixControlsProps = {
  weeks: string[];
  selectedWeek: string | null;
  currentWeekOpen: string;
  selectedTab: MatrixTab;
  onWeekChange: (week: string) => void;
  onTabChange: (tab: MatrixTab) => void;
};

const TABS = [
  { key: "cfd", label: "CFD" },
  { key: "crypto", label: "Crypto" },
] as const;

export default function MatrixControls({
  weeks,
  selectedWeek,
  currentWeekOpen,
  selectedTab,
  onWeekChange,
  onTabChange,
}: MatrixControlsProps) {
  return (
    <div className="space-y-3">
      {weeks.length > 0 && (
        <ScrollableWeekStrip
          options={weeks}
          selected={selectedWeek ?? weeks[0]}
          currentWeek={currentWeekOpen}
          label="Week"
          onChange={(week) => {
            if (week !== "all") onWeekChange(week);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              selectedTab === tab.key
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
