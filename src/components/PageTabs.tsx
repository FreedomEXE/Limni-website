"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/antikythera", label: "Data" },
  { href: "/dashboard", label: "Bias" },
  { href: "/sentiment", label: "Sentiment" },
];

export default function PageTabs() {
  const pathname = usePathname();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              isActive
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              View
            </span>
          </Link>
        );
      })}
    </div>
  );
}
