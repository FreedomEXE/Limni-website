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

import SegmentedToggle from "@/components/common/SegmentedToggle";
import ViewModeControls from "@/components/common/ViewModeControls";
import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";

export type MatrixTab = "cfd" | "crypto" | "risk";

type MatrixControlsProps = {
  weeks: string[];
  selectedWeek: string | null;
  currentWeekOpen: string;
  selectedTab: MatrixTab;
  onWeekChange: (week: string) => void;
  onTabChange: (tab: MatrixTab) => void;
};

const MATRIX_TAB_OPTIONS = [
  { value: "cfd", label: "CFD" },
  { value: "crypto", label: "Crypto" },
  { value: "risk", label: "Risk" },
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
        <SegmentedToggle
          value={selectedTab}
          items={MATRIX_TAB_OPTIONS}
          onChange={onTabChange}
          ariaLabel="Matrix view tab"
        />
        <ViewModeControls surface="matrix" size="sm" />
      </div>
    </div>
  );
}
