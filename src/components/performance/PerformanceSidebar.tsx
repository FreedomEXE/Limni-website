/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceSidebar.tsx
 *
 * Description:
 * Performance sidebar shell with Flagship, Matrix, and Legacy tabs.
 * Matrix shows ADR forward test stats. Legacy is tucked behind
 * a toggle inside the Flagship view.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PerformanceComparisonPanel from "@/components/performance/PerformanceComparisonPanel";

type PerformanceMode = "flagship" | "matrix" | "legacy";

function parseMode(value: string | null): PerformanceMode {
  if (value === "legacy") return "legacy";
  if (value === "matrix") return "matrix";
  return "flagship";
}

type AdrTradesPayload = {
  weekOpenUtc: string;
  generatedUtc: string;
  totalTrades: number;
  totalTpHits: number;
  totalActive: number;
  weekReturnPct: number;
  trades: Array<{
    symbol: string;
    direction: string;
    pnlPct: number | null;
    exitReason: string | null;
    tradeNumber: number | null;
  }>;
};

function MatrixSidebarContent() {
  const [data, setData] = useState<AdrTradesPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/flagship/adr-trades")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-xs text-[color:var(--muted)]">Loading ADR trades...</div>;
  if (!data) return <div className="text-xs text-[color:var(--muted)]">No trade data available.</div>;

  const winRate = data.totalTrades > 0 ? ((data.totalTpHits / data.totalTrades) * 100).toFixed(1) : "0";
  const pairsWithTrades = new Set(data.trades.map((t) => t.symbol)).size;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
          ADR Forward Test
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
          Fresh Start · 1x ADR Entry · 0.25x TP
        </div>

        <div className="mt-4 text-3xl font-bold text-lime-400">
          +{data.weekReturnPct.toFixed(2)}%
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
          Week Return
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Weekly Win</div>
            <div className="font-bold">{winRate}%</div>
          </div>
          <div>
            <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Active</div>
            <div className="font-bold">{data.totalActive}</div>
          </div>
          <div>
            <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Trades</div>
            <div className="font-bold">{data.totalTrades}</div>
          </div>
          <div>
            <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">TP Hits</div>
            <div className="font-bold text-lime-400">{data.totalTpHits}</div>
          </div>
        </div>

        <div className="mt-3 border-t border-[var(--panel-border)] pt-3">
          <div className="text-[color:var(--muted)] text-[10px] uppercase tracking-[0.08em]">Pairs Active</div>
          <div className="font-bold">{pairsWithTrades}</div>
        </div>
      </div>

      <div className="text-[10px] text-[color:var(--muted)]">
        Weeks <span className="text-[var(--foreground)]">1</span>
      </div>
    </div>
  );
}

export default function PerformanceSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setModeState] = useState<PerformanceMode>(parseMode(searchParams.get("mode")));

  useEffect(() => {
    setModeState(parseMode(searchParams.get("mode")));
  }, [searchParams]);

  const updateMode = (next: PerformanceMode) => {
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
      <div className="grid grid-cols-3 gap-2">
        {(["flagship", "matrix", "legacy"] as const).map((entry) => {
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
      ) : mode === "matrix" ? (
        <MatrixSidebarContent />
      ) : (
        <PerformanceComparisonPanel />
      )}
    </div>
  );
}
