"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import CotModeBanner from "@/components/CotModeBanner";
import PerformanceSidebar from "@/components/performance/PerformanceSidebar";
import { resolveAccountView, type AccountPageView } from "@/lib/accounts/navigation";

type NavItem = {
  key: string;
  href: string;
  label: string;
  letter: string;
};

type SubNavItem = {
  href: string;
  label: string;
  matchPrefixes?: string[];
};

const TOP_LEVEL: NavItem[] = [
  { key: "data", href: "/dashboard?bias=dealer", label: "Data", letter: "L" },
  { key: "performance", href: "/performance", label: "Performance", letter: "I" },
  { key: "flagship", href: "/matrix", label: "Matrix", letter: "M" },
  { key: "accounts", href: "/accounts", label: "Accounts", letter: "A" },
  { key: "automation", href: "/automation", label: "Automation", letter: "U" },
  { key: "news", href: "/news", label: "News", letter: "N" },
  { key: "status", href: "/status", label: "Status", letter: "S" },
];

const SECTION_LABELS: Record<string, string> = {
  data: "Data",
  performance: "Performance",
  automation: "Automation",
  accounts: "Accounts",
  flagship: "Matrix",
  news: "News",
  status: "Status",
};

function resolveSection(pathname: string) {
  if (pathname.startsWith("/dashboard")) {
    return "data";
  }
  if (pathname.startsWith("/performance")) return "performance";
  if (pathname.startsWith("/automation")) return "automation";
  if (pathname.startsWith("/accounts")) return "accounts";
  if (pathname.startsWith("/matrix") || pathname.startsWith("/flagship")) return "flagship";
  if (pathname.startsWith("/status")) return "status";
  if (pathname.startsWith("/news")) return "news";
  return null;
}

function parseHref(href: string) {
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query ?? "");
  return { path, params };
}

function isActiveHref(
  href: string,
  pathname: string,
  viewParam: string | null,
  defaultView?: string | null,
  currentSearchParams?: URLSearchParams | null,
) {
  const { path, params } = parseHref(href);
  if (path !== pathname) {
    return false;
  }
  const expectedView = params.get("view");
  if (expectedView) {
    const resolvedView = viewParam ?? defaultView ?? null;
    if (resolvedView !== expectedView) return false;
  }
  // Check any other query params in the href (e.g. bias=dealer)
  for (const [key, value] of params.entries()) {
    if (key === "view") continue; // already handled above
    if (currentSearchParams && currentSearchParams.get(key) !== value) return false;
  }
  return true;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = resolveSection(pathname);
  const viewParamRaw = searchParams.get("view");
  const accountViewFromUrl = resolveAccountView(viewParamRaw);
  const viewParam = activeSection === "accounts" ? accountViewFromUrl : viewParamRaw;
  const [rootLockSection, setRootLockSection] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supportsSectionNav = activeSection !== "flagship";
  const navMode: "root" | "section" =
    activeSection && rootLockSection === activeSection
      ? "root"
      : activeSection && supportsSectionNav
        ? "section"
        : "root";
  const effectiveAccountView = accountViewFromUrl;

  const accountBasePath = useMemo(() => {
    if (pathname.startsWith("/accounts/connected/")) {
      return pathname;
    }
    if (pathname.startsWith("/accounts/") && pathname !== "/accounts") {
      return pathname;
    }
    return "/accounts";
  }, [pathname]);

  const subNavItems: SubNavItem[] = (() => {
    if (!activeSection) return [];
    if (activeSection === "data") {
      return [
        { href: "/dashboard?bias=dealer", label: "Dealer" },
        { href: "/dashboard?bias=commercial", label: "Commercial" },
        { href: "/dashboard?bias=sentiment", label: "Sentiment" },
      ];
    }
    if (activeSection === "performance") {
      // Performance uses a dedicated sidebar component instead of query-param subnav.
      return [];
    }
    if (activeSection === "automation") {
      return [
        {
          href: "/automation/bots",
          label: "Bots",
          matchPrefixes: ["/automation/bots", "/automation/solana-meme-bot"],
        },
        {
          href: "/automation/research",
          label: "Research",
          matchPrefixes: ["/automation/research"],
        },
      ];
    }
    if (activeSection === "accounts") {
      if (accountBasePath === "/accounts") {
        return [{ href: "/accounts", label: "All Accounts" }];
      }
      return [
        { href: `${accountBasePath}?view=overview`, label: "Overview" },
        { href: `${accountBasePath}?view=trades`, label: "Trades" },
        { href: `${accountBasePath}?view=analytics`, label: "Analytics" },
      ];
    }
    if (activeSection === "news") {
      return [{ href: "/news", label: "News" }];
    }
    return [];
  })();

  const handleOpenSection = (sectionKey: string) => {
    setRootLockSection(null);
    setMobileOpen(false);
    const target = TOP_LEVEL.find((item) => item.key === sectionKey);
    if (target) {
      router.push(target.href);
    }
  };

  const handleRootToggle = () => {
    if (!activeSection) {
      setRootLockSection(null);
      return;
    }
    setRootLockSection((previous) => {
      if (previous === activeSection) {
        return null;
      }
      return activeSection;
    });
  };

  const handleAccountViewChange = (nextView: AccountPageView) => {
    setMobileOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    window.dispatchEvent(new CustomEvent("accounts-view-change", { detail: nextView }));
  };

  const sectionLabel = activeSection ? SECTION_LABELS[activeSection] : "Navigation";

  const sidebarHeader = (
    <div className="border-b border-[var(--panel-border)]/80 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleRootToggle}
          className="flex items-center gap-3"
        >
          <div className="flex size-12 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 text-[var(--foreground)] shadow-sm">
            <Image
              src="/limni-icon.svg"
              alt="Limni"
              width={40}
              height={40}
              className="size-10 scale-125 logo-theme-aware"
            />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--foreground)]">
              LIMNI LABS
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {navMode === "section" ? sectionLabel : "Navigation"}
            </div>
          </div>
        </button>
        {navMode === "section" ? (
          <button
            type="button"
            onClick={handleRootToggle}
            className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
          >
            Back
          </button>
        ) : null}
      </div>
    </div>
  );

  const renderNavContent = () => {
    if (navMode === "root") {
      return (
        <nav className="flex-1 space-y-1 p-4">
          {TOP_LEVEL.map((item) => {
            const isActive = activeSection === item.key;
            const isNews = item.key === "news";
            const isStatus = item.key === "status";
            const isSpecial = isNews || isStatus;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleOpenSection(item.key)}
                className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : isNews
                      ? "border border-amber-400/40 bg-amber-500/10 dark:bg-amber-900/30 text-amber-700 hover:border-amber-300/70 hover:bg-amber-500/15 dark:hover:bg-amber-900/40 dark:text-amber-200"
                      : isStatus
                        ? "border border-emerald-400/40 bg-emerald-500/10 dark:bg-emerald-900/30 text-emerald-700 hover:border-emerald-300/70 hover:bg-emerald-500/15 dark:hover:bg-emerald-900/40 dark:text-emerald-200"
                        : "border border-transparent text-[var(--foreground)] hover:border-[var(--panel-border)] hover:bg-[var(--panel)]/70"
                }`}
              >
                {isNews ? (
                  <span className="rounded-full border border-amber-400/50 bg-amber-500/15 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-current">
                    News
                  </span>
                ) : isStatus ? (
                  <span className="rounded-full border border-emerald-400/50 bg-emerald-500/15 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-current">
                    Status
                  </span>
                ) : (
                  <span className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 text-base font-bold text-[var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                    {item.letter}
                  </span>
                )}
                {!isSpecial ? <span className="tracking-tight">{item.label}</span> : null}
              </button>
            );
          })}
        </nav>
      );
    }

    if (activeSection === "performance") {
      return <PerformanceSidebar />;
    }

    return (
      <nav className="flex-1 space-y-2 p-4">
        {subNavItems.map((item) => {
          const defaultView =
            activeSection === "accounts"
                ? "overview"
                : null;
          const resolvedViewParam =
            activeSection === "accounts" ? effectiveAccountView : viewParam;
          const isActive =
            item.matchPrefixes && item.matchPrefixes.length > 0
              ? item.matchPrefixes.some((prefix) => pathname.startsWith(prefix))
              : isActiveHref(item.href, pathname, resolvedViewParam, defaultView, searchParams);
          const { path: itemPath, params: itemParams } = parseHref(item.href);
          const accountItemView = itemParams.get("view");
          const isLocalAccountToggle =
            activeSection === "accounts" &&
            itemPath === pathname &&
            accountItemView !== null;
          if (isLocalAccountToggle) {
            const nextAccountView = resolveAccountView(accountItemView);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => handleAccountViewChange(nextAccountView)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] bg-[var(--panel)]/80 text-[var(--foreground)]/80 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                }`}
              >
                <span className="tracking-tight">{item.label}</span>
                {isActive ? (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                    Active
                  </span>
                ) : null}
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                isActive
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)]/80 text-[var(--foreground)]/80 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              }`}
            >
              <span className="tracking-tight">{item.label}</span>
              {isActive ? (
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                  Active
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="relative flex min-h-screen bg-[var(--background)]">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-80 border-r border-[var(--panel-border)] bg-[var(--panel)]/90 backdrop-blur-sm md:flex md:flex-col">
        {sidebarHeader}
        {renderNavContent()}
        <div className="border-t border-[var(--panel-border)] p-4">
          <div className="space-y-3">
            <ThemeToggle compact={false} />
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
      </aside>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed left-4 top-4 z-50 rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
        >
          Menu
        </button>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 flex">
            <div className="h-full w-80 border-r border-[var(--panel-border)] bg-[var(--panel)]/95 backdrop-blur-sm">
              {sidebarHeader}
              {renderNavContent()}
              <div className="border-t border-[var(--panel-border)] p-4">
                <ThemeToggle compact={false} />
                <button
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/login";
                  }}
                  className="mt-3 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-3 text-sm font-semibold text-[var(--muted)]"
                >
                  Sign Out
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex-1 bg-black/40"
              aria-label="Close navigation"
            />
          </div>
        ) : null}
      </div>

      <main className="flex-1 overflow-x-hidden pb-24 md:pb-0 md:pl-80">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-8">
          <CotModeBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
