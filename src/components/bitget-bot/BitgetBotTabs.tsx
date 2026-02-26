/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BitgetBotTabs.tsx
 *
 * Description:
 * URL-driven tab switcher for the Bitget Bot v2 dashboard.
 * Uses `?tab=` search params for deep-linkable monitoring views.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BITGET_TAB_DEFS, type BitgetTabKey } from "@/components/bitget-bot/types";

type BitgetBotTabsProps = {
  activeTab: BitgetTabKey;
};

export default function BitgetBotTabs({ activeTab }: BitgetBotTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTab(nextTab: BitgetTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <nav className="border-b border-[var(--panel-border)]">
      <div className="flex flex-wrap items-center gap-4">
        {BITGET_TAB_DEFS.map((tab) => {
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
