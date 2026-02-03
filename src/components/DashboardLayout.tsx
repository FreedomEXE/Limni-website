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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const showBack =
    (pathname.startsWith("/accounts/") && pathname !== "/accounts") ||
    (pathname.startsWith("/automation/") && pathname !== "/automation");

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {isCollapsed ? (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="fixed left-4 top-6 z-50 rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/90 px-3 py-1 text-xs font-semibold text-[var(--muted)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
          aria-label="Expand navigation"
          title="Expand navigation"
        >
          &gt;&gt;
        </button>
      ) : null}

      <aside
        className={`bg-[var(--panel)]/90 backdrop-blur-sm transition-all duration-200 ${
          isCollapsed ? "w-0 overflow-hidden border-0" : "w-72 border-r border-[var(--panel-border)]"
        }`}
      >
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-[var(--panel-border)]/80 p-4">
            <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
              <div className={`flex items-center ${isCollapsed ? "flex-col gap-2" : "gap-3"}`}>
                <div className="flex size-12 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 text-[var(--foreground)] shadow-sm">
                  <img
                    src="/limni-icon.svg"
                    alt="Limni"
                    className="size-10 scale-125"
                  />
                </div>
                {!isCollapsed ? (
                  <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
                    LIMNI LABS
                  </div>
                ) : null}
              </div>
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsCollapsed((prev) => !prev)}
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-2 py-1 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                  aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                  title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                >
                  {isCollapsed ? ">>" : "<<"}
                </button>
              ) : null}
            </div>
            {isCollapsed ? (
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="mt-3 w-full rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-2 py-1 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                aria-label="Expand navigation"
                title="Expand navigation"
              >
                &gt;&gt;
              </button>
            ) : null}
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-4"} rounded-2xl py-3 text-sm font-semibold transition ${
                    isActive
                      ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                      : "border border-transparent text-[var(--foreground)] hover:border-[var(--panel-border)] hover:bg-[var(--panel)]/70"
                  }`}
                >
                  <span className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 text-base font-bold text-[var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                    {item.letter}
                  </span>
                  {!isCollapsed ? (
                    <span className="tracking-tight">{item.label}</span>
                  ) : null}
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
              {isCollapsed ? "Out" : "Sign Out"}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-6 py-8">
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
    </div>
  );
}
