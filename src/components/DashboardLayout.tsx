"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/antikythera", label: "Antikythera", icon: "A" },
  { href: "/automation", label: "Automation", icon: "R" },
  { href: "/performance", label: "Performance Lab", icon: "P" },
  { href: "/accounts", label: "Accounts", icon: "C" },
  { href: "/status", label: "Status", icon: "S" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <aside
        className={`border-r border-[var(--panel-border)] bg-[var(--panel)]/90 backdrop-blur-sm transition-all duration-200 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-[var(--panel-border)]/80 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full border border-[var(--panel-border)] bg-white/80 text-[var(--foreground)] shadow-sm">
                  <img
                    src="/limni-icon.svg"
                    alt="Limni"
                    className="size-7 text-[var(--foreground)]"
                  />
                </div>
                {!isCollapsed ? (
                  <div>
                    <img
                      src="/limni-wordmark.svg"
                      alt="Limni wordmark"
                      className="h-6 text-[var(--foreground)]"
                    />
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                      Navigating Markets with Intelligence
                    </p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="rounded-full border border-[var(--panel-border)] bg-white/80 px-2 py-1 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
              >
                {isCollapsed ? ">>" : "<<"}
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                      : "border border-transparent text-[var(--foreground)] hover:border-[var(--panel-border)] hover:bg-white/70"
                  }`}
                >
                  <span className="flex size-9 items-center justify-center rounded-xl border border-[var(--panel-border)] text-[11px] font-semibold tracking-[0.2em] text-[var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                    {item.icon}
                  </span>
                  {!isCollapsed ? (
                    <span className="tracking-tight">{item.label}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[var(--panel-border)] p-4">
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="w-full rounded-2xl border border-[var(--panel-border)] bg-white/80 px-4 py-3 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
