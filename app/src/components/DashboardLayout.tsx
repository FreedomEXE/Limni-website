"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import CotModeBanner from "@/components/CotModeBanner";
import StrategySidebar from "@/components/shared/StrategySidebar";

type NavItem = {
  key: string;
  href: string;
  label: string;
  letter: string;
  matchPrefixes: string[];
};

export const TOP_LEVEL: NavItem[] = [
  { key: "performance", href: "/performance", label: "Performance", letter: "L", matchPrefixes: ["/performance"] },
  { key: "data", href: "/dashboard?bias=dealer", label: "Data", letter: "I", matchPrefixes: ["/dashboard"] },
  { key: "accounts", href: "/accounts", label: "Accounts", letter: "M", matchPrefixes: ["/accounts"] },
  { key: "automation", href: "/automation", label: "Automation", letter: "N", matchPrefixes: ["/automation"] },
  { key: "research", href: "/research", label: "Research Lab", letter: "I", matchPrefixes: ["/research"] },
  { key: "documents", href: "/documents", label: "Documents", letter: "L", matchPrefixes: ["/documents"] },
  { key: "agents", href: "/agents", label: "Agents", letter: "A", matchPrefixes: ["/agents"] },
  { key: "news", href: "/news", label: "News", letter: "B", matchPrefixes: ["/news"] },
  { key: "status", href: "/status", label: "Status", letter: "S", matchPrefixes: ["/status"] },
];

export const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  TOP_LEVEL.map((item) => [item.key, item.label]),
);

export function resolveSection(pathname: string) {
  return TOP_LEVEL.find((item) => item.matchPrefixes.some((prefix) => pathname.startsWith(prefix)))?.key ?? null;
}

function labelFromPathname(pathname: string) {
  const [firstSegment] = pathname.replace(/^\/+/, "").split("/");
  if (!firstSegment) return "Limni";
  return firstSegment
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function appSectionLabelForPathname(pathname: string | null) {
  if (!pathname || pathname === "/") return "Limni";
  const section = resolveSection(pathname);
  return section ? SECTION_LABELS[section] : labelFromPathname(pathname);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = resolveSection(pathname);
  const [rootLockSection, setRootLockSection] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supportsSectionNav = activeSection === "performance";
  const navMode: "root" | "section" =
    activeSection && rootLockSection === activeSection
      ? "root"
      : activeSection && supportsSectionNav
        ? "section"
        : "root";

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
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleOpenSection(item.key)}
                className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border border-transparent text-[var(--foreground)] hover:border-[var(--panel-border)] hover:bg-[var(--panel)]/70"
                }`}
              >
                <span className="flex size-12 items-center justify-center overflow-hidden rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 text-base font-bold text-[var(--muted)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                  {item.letter}
                </span>
                <span className="tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      );
    }

    if (activeSection === "performance") {
      return <StrategySidebar />;
    }

    return (
      <div className="flex-1 p-4">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
            Active Surface
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            {sectionLabel}
          </p>
          <p className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
            Section controls now live in the main workspace. Use Back to return to LIMNI LABS.
          </p>
        </div>
      </div>
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
