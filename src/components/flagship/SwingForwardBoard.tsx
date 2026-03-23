/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: SwingForwardBoard.tsx
 *
 * Description:
 * Live current-week swing board for the locked weekly flagship using
 * the gated setups feed plus live market drift.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeET } from "@/lib/time";

type GateDecision = "PASS" | "SKIP" | "NO_DATA";
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";

type GatedSetupSignal = {
  assetClass: string;
  pair: string;
  direction: SignalDirection;
  tier: SignalTier;
  gateDecision: GateDecision;
  gateReasons: string[];
};

type GatedSetupsPayload = {
  generatedUtc: string | null;
  currentWeekOpenUtc: string | null;
  signals: GatedSetupSignal[];
};

type PriceMoveRow = {
  pair: string;
  change24hPct: number | null;
};

type PriceMovesPayload = {
  generatedUtc: string | null;
  rows: PriceMoveRow[];
};

type SwingForwardBoardProps = {
  strategyName: string;
  sourceLabel: string;
};

function formatSignedPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function directionTone(direction: SignalDirection) {
  if (direction === "LONG") return "text-emerald-700 dark:text-emerald-300";
  if (direction === "SHORT") return "text-rose-700 dark:text-rose-300";
  return "text-[color:var(--muted)]";
}

function tierTone(tier: SignalTier) {
  if (tier === "HIGH") return "text-emerald-700 dark:text-emerald-300";
  if (tier === "MEDIUM") return "text-amber-700 dark:text-amber-300";
  return "text-[color:var(--muted)]";
}

export default function SwingForwardBoard({
  strategyName,
  sourceLabel,
}: SwingForwardBoardProps) {
  const [signals, setSignals] = useState<GatedSetupSignal[]>([]);
  const [currentWeekOpenUtc, setCurrentWeekOpenUtc] = useState<string | null>(null);
  const [lastRefreshUtc, setLastRefreshUtc] = useState<string | null>(null);
  const [driftByPair, setDriftByPair] = useState<Map<string, number | null>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [gatedResponse, priceMovesResponse] = await Promise.all([
          fetch("/api/performance/gated-setups", { cache: "no-store" }),
          fetch("/api/flagship/price-moves", { cache: "no-store" }),
        ]);

        if (!gatedResponse.ok) {
          throw new Error(`Gated setups request failed (${gatedResponse.status})`);
        }

        const gatedJson = (await gatedResponse.json()) as GatedSetupsPayload & {
          error?: string;
        };
        if (gatedJson.error) {
          throw new Error(gatedJson.error);
        }

        const priceMovesJson = priceMovesResponse.ok
          ? ((await priceMovesResponse.json()) as PriceMovesPayload & { error?: string })
          : null;

        const actionableSignals = (gatedJson.signals ?? [])
          .filter((signal) => signal.gateDecision === "PASS" && signal.direction !== "NEUTRAL")
          .sort((left, right) => {
            const tierWeight = (tier: SignalTier) => (tier === "HIGH" ? 2 : tier === "MEDIUM" ? 1 : 0);
            return tierWeight(right.tier) - tierWeight(left.tier) || left.pair.localeCompare(right.pair);
          });

        const nextDriftByPair = new Map<string, number | null>();
        for (const row of priceMovesJson?.rows ?? []) {
          nextDriftByPair.set(String(row.pair).toUpperCase(), row.change24hPct);
        }

        if (!cancelled) {
          setSignals(actionableSignals);
          setCurrentWeekOpenUtc(gatedJson.currentWeekOpenUtc ?? null);
          setLastRefreshUtc(gatedJson.generatedUtc ?? priceMovesJson?.generatedUtc ?? null);
          setDriftByPair(nextDriftByPair);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () =>
      signals.map((signal) => {
        const drift = driftByPair.get(signal.pair.toUpperCase()) ?? null;
        const directionalDrift =
          drift === null ? null : signal.direction === "SHORT" ? -drift : drift;
        return {
          ...signal,
          liveDriftPct: directionalDrift,
        };
      }),
    [driftByPair, signals],
  );

  const highTierCount = rows.filter((row) => row.tier === "HIGH").length;
  const mediumTierCount = rows.filter((row) => row.tier === "MEDIUM").length;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Current Week
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
              Swing Forward Test
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/88">
              {strategyName}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
              {sourceLabel}
              {lastRefreshUtc ? ` · refreshed ${formatDateTimeET(lastRefreshUtc)}` : ""}
            </p>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 dark:bg-emerald-900/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
            Weekly flagship live board
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Trading Week
          </div>
          <div className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            {currentWeekOpenUtc ? currentWeekOpenUtc.slice(0, 10) : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Opened
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-[var(--foreground)]">
            {rows.length}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            High / Medium
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-[var(--foreground)]">
            {highTierCount} / {mediumTierCount}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-5 py-4 text-sm text-[color:var(--muted)]">
          Loading current flagship trades...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-5 py-4 text-sm text-[color:var(--muted)]">
          Current swing board is temporarily unavailable: {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-5">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                <tr>
                  {["Symbol", "Direction", "Tier", "Entry", "Current Drift", "Status"].map((column) => (
                    <th key={column} className="border-b border-[var(--panel-border)]/30 px-3 py-2">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center">
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        No active flagship trades right now
                      </div>
                      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                        The weekly flagship board is live, but there are currently no PASS-qualified swing trades in the gated weekly setup feed.
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.pair}-${row.direction}`} className="border-b border-[var(--panel-border)]/20 last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-[var(--foreground)]">{row.pair}</td>
                      <td className={`px-3 py-3 font-semibold ${directionTone(row.direction)}`}>{row.direction}</td>
                      <td className={`px-3 py-3 font-semibold ${tierTone(row.tier)}`}>{row.tier}</td>
                      <td className="px-3 py-3 text-[var(--foreground)]/80">Week Open</td>
                      <td className={`px-3 py-3 font-semibold ${row.liveDriftPct !== null && row.liveDriftPct < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                        {formatSignedPct(row.liveDriftPct)}
                      </td>
                      <td className="px-3 py-3 text-[var(--foreground)]/80">
                        {row.gateReasons[0] ?? "OPEN"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
