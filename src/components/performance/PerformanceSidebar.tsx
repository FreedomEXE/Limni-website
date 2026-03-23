/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceSidebar.tsx
 *
 * Description:
 * Performance sidebar shell with the top-level Flagship or Legacy
 * toggle. Legacy mode reuses the detailed comparison panel.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PerformanceComparisonPanel from "@/components/performance/PerformanceComparisonPanel";

function parseMode(value: string | null) {
  return value === "legacy" ? "legacy" : "flagship";
}

export default function PerformanceSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setModeState] = useState<"flagship" | "legacy">(parseMode(searchParams.get("mode")));

  useEffect(() => {
    setModeState(parseMode(searchParams.get("mode")));
  }, [searchParams]);

  const updateMode = (next: "flagship" | "legacy") => {
    setModeState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    if (next === "flagship") {
      url.searchParams.set("style", "tiered");
      url.searchParams.set("system", "v3");
    }
    router.replace(`${pathname}?${url.searchParams.toString()}`, { scroll: false });
    window.dispatchEvent(new CustomEvent("performance-mode-change", { detail: next }));
  };

  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2">
        {(["flagship", "legacy"] as const).map((entry) => {
          const active = mode === entry;
          return (
            <button
              key={entry}
              type="button"
              onClick={() => updateMode(entry)}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.16em] transition ${
                active
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80"
              }`}
            >
              {entry}
            </button>
          );
        })}
      </div>

      {mode === "flagship" ? (
        <div className="space-y-4">
          <PerformanceComparisonPanel
            forcedFamily="tiered"
            forcedSystemVersion="v3"
            hideSelectors
            title="Flagship Breakdown"
            flagshipOnly
            sidebarSurface
          />
        </div>
      ) : (
        <PerformanceComparisonPanel />
      )}
    </div>
  );
}
