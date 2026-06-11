/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: Mt5ForexTabs.tsx
 *
 * Description:
 * URL-driven tab switcher for the MT5 Forex / Katarakti dashboard.
 * Uses `?tab=` search params for deep-linkable monitoring views.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MT5_FOREX_TAB_DEFS, type Mt5ForexTabKey } from "@/components/mt5-forex-lite/types";

type Mt5ForexTabsProps = {
  activeTab: Mt5ForexTabKey;
};

export default function Mt5ForexTabs({ activeTab }: Mt5ForexTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTab(nextTab: Mt5ForexTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <nav className="border-b border-[var(--panel-border)]">
      <div className="flex flex-wrap items-center gap-4">
        {MT5_FOREX_TAB_DEFS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchTab(tab.key)}
              className={`border-b-2 pb-3 pt-1 text-xs font-semibold uppercase tracking-[0.24em] transition ${
                isActive
                  ? "border-[var(--accent)] text-[var(--accent-strong)]"
                  : "border-transparent text-[color:var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

