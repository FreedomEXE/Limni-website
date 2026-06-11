"use client";

/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceFlagshipSidebar.tsx
 *
 * Description:
 * Compact sidebar panel for the simplified Performance page. Replaces
 * the old multi-family comparison sidebar with anchor navigation into
 * the audited flagship view.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Link from "next/link";

const LINKS = [
  { href: "/performance#weekly-hold", label: "Weekly Hold" },
  { href: "/performance#intraday", label: "Intraday" },
  { href: "/performance#all-systems", label: "All Systems" },
  { href: "/performance#component-models", label: "Component Models" },
];

export default function PerformanceFlagshipSidebar() {
  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Canonical Report
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/88">
          Weekly flagship uses the canonical reconstruction payload. Baseline and gated variants stay visible together.
        </p>
      </div>
      <nav className="space-y-2">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-3 text-sm font-semibold text-[var(--foreground)]/80 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="rounded-2xl border border-[var(--panel-border)]/80 bg-[var(--panel)]/65 p-4 text-xs leading-5 text-[color:var(--muted)]">
        Component models remain available for inspection, but the page promotes the weekly flagship first and keeps intraday in research until it is relocked.
      </div>
    </div>
  );
}
