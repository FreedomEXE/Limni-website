"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";

type NavItem = {
  href: string;
  label: string;
  letter: string;
};


const NAV_ITEMS: NavItem[] = [
  { href: "/antikythera", label: "Data", letter: "L" },
  { href: "/performance", label: "Performance", letter: "I" },
  { href: "/automation", label: "Automation", letter: "M" },
  { href: "/accounts", label: "Accounts", letter: "N" },
  { href: "/status", label: "Status", letter: "I" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const isPreviewing = isCollapsed && isHoverExpanded;
  const isSidebarOpen = !isCollapsed || isHoverExpanded;
  const showBack =
    (pathname.startsWith("/accounts/") && pathname !== "/accounts") ||
    (pathname.startsWith("/automation/") && pathname !== "/automation");
  const isActiveRoute = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="relative flex min-h-screen bg-[var(--background)]">
      {isCollapsed && !isHoverExpanded ? (
        <div
          className="fixed left-[246px] top-6 z-50 hidden md:block"
          onMouseEnter={() => setIsHoverExpanded(true)}
          onMouseLeave={() => setIsHoverExpanded(false)}
        >
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              setIsHoverExpanded(false);
            }}
            className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/90 px-3 py-1 text-xs font-semibold text-[var(--muted)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="Expand navigation"
            title="Hover to preview navigation"
          >
            &gt;&gt;
          </button>
        </div>
      ) : null}

      <aside
        onMouseEnter={() => {
          if (isCollapsed) {
            setIsHoverExpanded(true);
          }
        }}
        onMouseLeave={() => {
          if (isCollapsed) {
            setIsHoverExpanded(false);
          }
        }}
        className={`fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-[var(--panel-border)] bg-[var(--panel)]/90 backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:block ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-[var(--panel-border)]/80 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 text-[var(--foreground)] shadow-sm">
                  <img
                    src="/limni-icon.svg"
                    alt="Limni"
                    className="size-10 scale-125 logo-theme-aware"
                  />
                </div>
                <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
                  LIMNI LABS
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCollapsed((prev) => !prev);
                  setIsHoverExpanded(false);
                }}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-2 py-1 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
              >
                {isCollapsed ? ">>" : "<<"}
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {NAV_ITEMS.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                      : "border border-transparent text-[var(--foreground)] hover:border-[var(--panel-border)] hover:bg-[var(--panel)]/70"
                  }`}
                >
                  <span className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 text-base font-bold text-[var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                    {item.letter}
                  </span>
                  <span className="tracking-tight">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[var(--panel-border)] p-4">
            <div className="space-y-3">
              <ThemeToggle compact={isCollapsed} />
            </div>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="mt-3 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-3 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden pb-24 md:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
          <div className="mb-4 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
              <img src="/limni-icon.svg" alt="Limni" className="size-8 logo-theme-aware" />
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--foreground)]">
                Limni Labs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24">
                <ThemeToggle compact />
              </div>
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              >
                Out
              </button>
            </div>
          </div>
          {showBack ? (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)] transition hover:text-[color:var(--accent-strong)]"
              >
                Back
              </button>
            </div>
          ) : null}
          {children}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--panel-border)] bg-[var(--panel)]/95 backdrop-blur-sm md:hidden">
        <nav className="mx-auto grid max-w-xl grid-cols-5 gap-1 p-2">
          {NAV_ITEMS.map((item) => {
            const isActive = isActiveRoute(item.href);
            return (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                className={`flex flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                  isActive
                    ? "bg-[var(--accent)]/15 text-[var(--accent-strong)]"
                    : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--foreground)]"
                }`}
              >
                <span
                  className={`mb-1 flex size-7 items-center justify-center rounded-full border text-[11px] ${
                    isActive
                      ? "border-[var(--accent)]/40 bg-[var(--accent)]/15"
                      : "border-[var(--panel-border)] bg-[var(--panel)]/80"
                  }`}
                >
                  {item.letter}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
