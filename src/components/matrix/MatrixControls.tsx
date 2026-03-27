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

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";

type MatrixControlsProps = {
  weeks: string[];
  selectedWeek: string | null;
  currentWeekOpen: string;
  selectedTab: "cfd" | "crypto" | "flagship";
};

const TABS = [
  { key: "cfd", label: "CFD" },
  { key: "crypto", label: "Crypto" },
  { key: "flagship", label: "Flagship" },
] as const;

function buildTabHref(tabKey: string, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());
  if (tabKey === "cfd") {
    params.delete("tab");
  } else {
    params.set("tab", tabKey);
  }
  const qs = params.toString();
  return qs ? `/matrix?${qs}` : "/matrix";
}

export default function MatrixControls({
  weeks,
  selectedWeek,
  currentWeekOpen,
  selectedTab,
}: MatrixControlsProps) {
  const searchParams = useSearchParams();

  return (
    <div className="space-y-3">
      {weeks.length > 0 && (
        <ScrollableWeekStrip
          options={weeks}
          selected={selectedWeek ?? weeks[0]}
          currentWeek={currentWeekOpen}
          label="Week"
          preserveParams={["tab"]}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={buildTabHref(tab.key, searchParams)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              selectedTab === tab.key
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
