/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: IntradayForwardBoard.tsx
 *
 * Description:
 * Live intraday execution board for weekly flagship trades using provisional ADR levels.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useMemo, useState } from "react";

import { getAssetClassDefinition, type AssetClass } from "@/lib/cotMarkets";
import { rowHighlightClass, type MatrixTrendState } from "@/lib/flagship/matrixStyles";
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

type IntradayLevelRow = {
  pair: string;
  assetClass: AssetClass;
  adrPct: number | null;
  adrBarsUsed: number;
  weekOpenUtc: string;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  longTouched: boolean;
  shortTouched: boolean;
  longTpPrice: number | null;
  shortTpPrice: number | null;
};

type IntradayLevelsPayload = {
  generatedUtc: string | null;
  currentWeekOpenUtc: string | null;
  rows: IntradayLevelRow[];
};

type IntradayBoardRow = GatedSetupSignal & {
  assetClass: AssetClass;
  adrPct: number | null;
  touched: boolean;
  oneAdrTouched: boolean;
};

type IntradayForwardBoardProps = {
  strategyName: string;
  sourceLabel: string;
};

function formatPct(value: number | null, places = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(places)}%`;
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

function directionToBias(direction: SignalDirection): MatrixTrendState {
  if (direction === "LONG") return "BULLISH";
  if (direction === "SHORT") return "BEARISH";
  return "NEUTRAL";
}

function sortRows(left: IntradayBoardRow, right: IntradayBoardRow) {
  if (left.oneAdrTouched !== right.oneAdrTouched) {
    return left.oneAdrTouched ? -1 : 1;
  }
  if (left.touched !== right.touched) {
    return left.touched ? -1 : 1;
  }
  const assetOrder: Record<AssetClass, number> = {
    fx: 0,
    indices: 1,
    crypto: 2,
    commodities: 3,
  };
  const tierOrder: Record<SignalTier, number> = {
    HIGH: 0,
    MEDIUM: 1,
    NEUTRAL: 2,
  };
  if (assetOrder[left.assetClass] !== assetOrder[right.assetClass]) {
    return assetOrder[left.assetClass] - assetOrder[right.assetClass];
  }
  if (tierOrder[left.tier] !== tierOrder[right.tier]) {
    return tierOrder[left.tier] - tierOrder[right.tier];
  }
  return left.pair.localeCompare(right.pair);
}

export default function IntradayForwardBoard({
  strategyName,
  sourceLabel,
}: IntradayForwardBoardProps) {
  const [signals, setSignals] = useState<GatedSetupSignal[]>([]);
  const [levelsByPair, setLevelsByPair] = useState<Map<string, IntradayLevelRow>>(new Map());
  const [lastRefreshUtc, setLastRefreshUtc] = useState<string | null>(null);
  const [weekOpenUtc, setWeekOpenUtc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [setupsResponse, levelsResponse] = await Promise.all([
          fetch("/api/performance/gated-setups", { cache: "no-store" }),
          fetch("/api/flagship/intraday-levels", { cache: "no-store" }),
        ]);

        if (!setupsResponse.ok) {
          throw new Error(`Gated setups request failed (${setupsResponse.status})`);
        }
        if (!levelsResponse.ok) {
          throw new Error(`Intraday levels request failed (${levelsResponse.status})`);
        }

        const setupsJson = (await setupsResponse.json()) as GatedSetupsPayload & { error?: string };
        const levelsJson = (await levelsResponse.json()) as IntradayLevelsPayload & { error?: string };

        if (setupsJson.error) throw new Error(setupsJson.error);
        if (levelsJson.error) throw new Error(levelsJson.error);

        const nextLevels = new Map<string, IntradayLevelRow>();
        for (const row of levelsJson.rows ?? []) {
          nextLevels.set(row.pair.toUpperCase(), row);
        }

        if (!cancelled) {
          setSignals(setupsJson.signals ?? []);
          setLevelsByPair(nextLevels);
          setWeekOpenUtc(setupsJson.currentWeekOpenUtc ?? levelsJson.currentWeekOpenUtc ?? null);
          setLastRefreshUtc(setupsJson.generatedUtc ?? levelsJson.generatedUtc ?? null);
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

  const rows = useMemo(() => {
    const actionableSignals = signals.filter((signal) => signal.direction !== "NEUTRAL");

    return actionableSignals
      .map((signal) => {
        const level = levelsByPair.get(signal.pair.toUpperCase());
        const assetClass = (level?.assetClass ?? signal.assetClass ?? "fx") as AssetClass;
        const touched =
          signal.direction === "LONG"
            ? (level?.longTouched ?? false)
            : (level?.shortTouched ?? false);
        return {
          ...signal,
          assetClass,
          adrPct: level?.adrPct ?? null,
          touched,
          oneAdrTouched: touched,
        } satisfies IntradayBoardRow;
      })
      .sort(sortRows);
  }, [levelsByPair, signals]);

  const zoneTouchedCount = rows.filter((row) => row.touched).length;
  const fxCount = rows.filter((row) => row.assetClass === "fx").length;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Current Week
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
              Intraday Forward Test
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/88">
              Weekly bias {strategyName}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
              {lastRefreshUtc ? `Refreshed ${formatDateTimeET(lastRefreshUtc)}` : sourceLabel}
            </p>
          </div>
          <div className="rounded-full border border-amber-400/30 bg-amber-500/10 dark:bg-amber-900/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
            Research board
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Trading Week
          </div>
          <div className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            {weekOpenUtc ? weekOpenUtc.slice(0, 10) : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Candidates
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-[var(--foreground)]">
            {rows.length}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            FX / Non-FX
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-[var(--foreground)]">
            {fxCount} / {Math.max(0, rows.length - fxCount)}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            ADR Hits
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-[var(--foreground)]">
            {rows.filter((row) => row.oneAdrTouched).length}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-5 py-4 text-sm text-[color:var(--muted)]">
          Loading intraday ADR board...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-5 py-4 text-sm text-[color:var(--muted)]">
          Intraday board is temporarily unavailable: {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-5">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                <tr>
                  {["Symbol", "Asset", "Direction", "Tier", "ADR", "1.0 ADR"].map((column) => (
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
                        No current-week intraday candidates
                      </div>
                      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                        This board watches the full current-week trade list and surfaces pairs once the 1.0 ADR pullback level is reached.
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const assetLabel = getAssetClassDefinition(row.assetClass).label;
                    return (
                      <tr
                        key={`${row.pair}-${row.direction}`}
                        className={`${rowHighlightClass(directionToBias(row.direction))} ${row.oneAdrTouched ? "intraday-adr-pulse" : ""} border-b border-[var(--panel-border)]/20 last:border-b-0 transition-colors`}
                      >
                        <td className="px-3 py-3 font-semibold text-[var(--foreground)]">{row.pair}</td>
                        <td className="px-3 py-3 text-[var(--foreground)]/80">{assetLabel}</td>
                        <td className={`px-3 py-3 font-semibold ${directionTone(row.direction)}`}>{row.direction}</td>
                        <td className={`px-3 py-3 font-semibold ${tierTone(row.tier)}`}>{row.tier}</td>
                        <td className="px-3 py-3 text-[var(--foreground)]/80">{formatPct(row.adrPct)}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              row.oneAdrTouched
                                ? "border-amber-400/40 bg-amber-500/15 dark:bg-amber-900/35 text-amber-700 dark:text-amber-300"
                                : row.touched
                                  ? "border-emerald-400/30 bg-emerald-500/10 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                  : "border-[var(--panel-border)] bg-[var(--panel)]/60 text-[color:var(--muted)]"
                            }`}
                          >
                            {row.oneAdrTouched ? "Hit" : row.touched ? "Close" : "Watching"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
