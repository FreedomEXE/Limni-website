/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: SwingForwardBoard.tsx
 *
 * Description:
 * Live current-week swing board for the locked weekly flagship using
 * the gated setups feed plus live week-to-date basket drift.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { DateTime } from "luxon";
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

type WeeklyForwardSummaryRow = {
  pair: string;
  direction: SignalDirection;
  tier: SignalTier;
  gateReasons: string[];
  liveDriftPct: number | null;
};

type WeeklyForwardSummaryPayload = {
  generatedUtc: string | null;
  currentWeekOpenUtc: string | null;
  basketPnlPct: number | null;
  basketMaxDrawdownPct: number | null;
  rows: WeeklyForwardSummaryRow[];
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

function cardTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-[var(--foreground)]";
  if (value > 0) return "text-emerald-700 dark:text-emerald-300";
  if (value < 0) return "text-rose-700 dark:text-rose-300";
  return "text-[var(--foreground)]";
}

function formatTradingWeek(weekOpenUtc: string | null) {
  if (!weekOpenUtc) return "—";
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  if (!weekOpen.isValid) return "—";
  const monday = weekOpen.plus({ days: 1 }).startOf("day");
  const friday = monday.plus({ days: 4 });
  return `${monday.toFormat("MMM dd")} - ${friday.toFormat("MMM dd, yyyy")}`;
}

export default function SwingForwardBoard({
  strategyName,
  sourceLabel,
}: SwingForwardBoardProps) {
  const [rows, setRows] = useState<WeeklyForwardSummaryRow[]>([]);
  const [currentWeekOpenUtc, setCurrentWeekOpenUtc] = useState<string | null>(null);
  const [lastRefreshUtc, setLastRefreshUtc] = useState<string | null>(null);
  const [basketPnlPct, setBasketPnlPct] = useState<number | null>(null);
  const [basketMaxDrawdownPct, setBasketMaxDrawdownPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const gatedResponse = await fetch("/api/performance/gated-setups", { cache: "no-store" });
        if (!gatedResponse.ok) {
          throw new Error(`Gated setups request failed (${gatedResponse.status})`);
        }

        const gatedJson = (await gatedResponse.json()) as GatedSetupsPayload & {
          error?: string;
        };
        if (gatedJson.error) {
          throw new Error(gatedJson.error);
        }

        const actionableSignals = (gatedJson.signals ?? [])
          .filter((signal) => signal.gateDecision === "PASS" && signal.direction !== "NEUTRAL")
          .sort((left, right) => {
            const tierWeight = (tier: SignalTier) => (tier === "HIGH" ? 2 : tier === "MEDIUM" ? 1 : 0);
            return tierWeight(right.tier) - tierWeight(left.tier) || left.pair.localeCompare(right.pair);
          });

        let summaryJson: WeeklyForwardSummaryPayload | null = null;
        if (gatedJson.currentWeekOpenUtc && actionableSignals.length > 0) {
          const summaryResponse = await fetch("/api/flagship/weekly-forward-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              currentWeekOpenUtc: gatedJson.currentWeekOpenUtc,
              signals: actionableSignals.map((signal) => ({
                pair: signal.pair,
                direction: signal.direction,
                tier: signal.tier,
                gateReasons: signal.gateReasons,
              })),
            }),
          });

          if (summaryResponse.ok) {
            summaryJson = (await summaryResponse.json()) as WeeklyForwardSummaryPayload;
          }
        }

        if (!cancelled) {
          setRows(
            summaryJson?.rows ??
              actionableSignals.map((signal) => ({
                pair: signal.pair,
                direction: signal.direction,
                tier: signal.tier,
                gateReasons: signal.gateReasons,
                liveDriftPct: null,
              })),
          );
          setCurrentWeekOpenUtc(summaryJson?.currentWeekOpenUtc ?? gatedJson.currentWeekOpenUtc ?? null);
          setLastRefreshUtc(summaryJson?.generatedUtc ?? gatedJson.generatedUtc ?? null);
          setBasketPnlPct(summaryJson?.basketPnlPct ?? null);
          setBasketMaxDrawdownPct(summaryJson?.basketMaxDrawdownPct ?? null);
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

  const tradingWeekLabel = useMemo(
    () => formatTradingWeek(currentWeekOpenUtc),
    [currentWeekOpenUtc],
  );

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
            {tradingWeekLabel}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Basket WTD
          </div>
          <div className={`mt-2 text-2xl font-semibold font-mono ${cardTone(basketPnlPct)}`}>
            {formatSignedPct(basketPnlPct)}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Max Drawdown
          </div>
          <div className={`mt-2 text-2xl font-semibold font-mono ${cardTone(basketMaxDrawdownPct === null ? null : -basketMaxDrawdownPct)}`}>
            {basketMaxDrawdownPct === null ? "—" : `-${basketMaxDrawdownPct.toFixed(2)}%`}
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
                      <td className={`px-3 py-3 font-semibold ${cardTone(row.liveDriftPct)}`}>
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
