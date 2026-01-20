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
  { href: "/antikythera", label: "Antikythera", icon: "??" },
  { href: "/automation", label: "Automation", icon: "??" },
  { href: "/performance", label: "Performance Lab", icon: "??" },
  { href: "/accounts", label: "Accounts", icon: "??" },
  { href: "/status", label: "Status", icon: "??" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <aside
        className={`border-r border-slate-200/80 bg-white/50 backdrop-blur-sm transition-all duration-200 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-slate-200/80 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
                <span className="text-lg font-bold">L</span>
              </div>
              {!isCollapsed ? (
                <div>
                  <h1 className="text-sm font-semibold text-slate-900">
                    Limni Labs
                  </h1>
                  <p className="text-xs text-slate-500">Trading Intelligence</p>
                </div>
              ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="rounded-md border border-slate-200/80 bg-white/80 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
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
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {!isCollapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-200/80 p-4">
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="w-full rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
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
