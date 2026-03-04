/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: StrategiesExplorerClient.tsx
 *
 * Description:
 * Client-side Strategies Explorer for Research. Reads strategy
 * backtest coverage and metrics from /api/research/strategies.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";

type StrategyExplorerEntry = {
  entryId: string;
  label: string;
  badge: string;
  family: string;
  dataMode: string;
  pending: boolean;
  pendingLabel: string | null;
  hasDbRun: boolean;
  runId: number | null;
  generatedUtc: string | null;
  weeklyCount: number;
  tradeCount: number;
  latestWeekOpenUtc: string | null;
  totalReturn: number | null;
  maxDrawdown: number | null;
  weeklyWinRate: number | null;
  sharpe: number | null;
  avgWeekly: number | null;
  trades: number | null;
  tradeWinRate: number | null;
};

type StrategiesResponse = {
  ok: boolean;
  entries?: StrategyExplorerEntry[];
  error?: string;
};

const FAMILY_ORDER = ["universal", "tiered", "katarakti"] as const;

function familyLabel(family: string) {
  if (family === "universal") return "Universal";
  if (family === "tiered") return "Tiered";
  if (family === "katarakti") return "Katarakti";
  return family;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function formatSharpe(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const iso = new Date(value);
  if (!Number.isFinite(iso.getTime())) return value;
  return iso.toISOString().slice(0, 10);
}

function statusConfig(entry: StrategyExplorerEntry) {
  if (entry.hasDbRun) {
    return {
      dotClass: "bg-emerald-500",
      label: "DB Connected",
    };
  }
  if (entry.pending) {
    return {
      dotClass: "bg-amber-500",
      label: entry.pendingLabel ?? "Pending",
    };
  }
  return {
    dotClass: "bg-rose-500",
    label: "No DB run",
  };
}

export default function StrategiesExplorerClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<StrategyExplorerEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/research/strategies", {
          cache: "no-store",
        });
        const payload = (await response.json()) as StrategiesResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Failed to load strategies.");
        }
        if (!cancelled) {
          setEntries(Array.isArray(payload.entries) ? payload.entries : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setEntries([]);
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

  const grouped = useMemo(() => {
    const map = new Map<string, StrategyExplorerEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.family) ?? [];
      list.push(entry);
      map.set(entry.family, list);
    }
    return map;
  }, [entries]);

  if (loading) {
    return (
      <div className="space-y-6">
        {FAMILY_ORDER.map((family) => (
          <section key={family} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {familyLabel(family)}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((idx) => (
                <div
                  key={`${family}-${idx}`}
                  className="animate-pulse rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4"
                >
                  <div className="h-4 w-2/3 rounded bg-[var(--panel-border)]/70" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-[var(--panel-border)]/60" />
                  <div className="mt-4 h-20 rounded bg-[var(--panel-border)]/50" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-3 text-sm text-[color:var(--muted)]">
        No strategy entries found.
      </div>
    );
  }

  const families = [
    ...FAMILY_ORDER.filter((family) => grouped.has(family)),
    ...[...grouped.keys()].filter((family) => !FAMILY_ORDER.includes(family as (typeof FAMILY_ORDER)[number])),
  ];

  return (
    <div className="space-y-6">
      {families.map((family) => {
        const familyEntries = grouped.get(family) ?? [];
        return (
          <section key={family} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {familyLabel(family)}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {familyEntries.map((entry) => {
                const status = statusConfig(entry);
                return (
                  <article
                    key={entry.entryId}
                    className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">{entry.label}</h3>
                      <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]">
                        {entry.badge}
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl border border-[var(--panel-border)]/70 bg-[var(--panel)]/50 p-3">
                      <div className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${status.dotClass}`} />
                        <span>{status.label}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[color:var(--muted)]">
                        <span>Weeks: {entry.weeklyCount}</span>
                        <span>Trades: {entry.tradeCount}</span>
                        <span>Run: {entry.runId ?? "—"}</span>
                        <span>Generated: {formatDate(entry.generatedUtc)}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                      <Metric label="Total Return" value={formatPercent(entry.totalReturn)} />
                      <Metric label="Max DD" value={formatPercent(entry.maxDrawdown)} />
                      <Metric label="Weekly Win%" value={formatPercent(entry.weeklyWinRate)} />
                      <Metric label="Sharpe" value={formatSharpe(entry.sharpe)} />
                      <Metric label="Avg Weekly" value={formatPercent(entry.avgWeekly)} />
                      <Metric label="Trade Win%" value={formatPercent(entry.tradeWinRate)} />
                    </div>

                    <p className="mt-3 text-xs text-[color:var(--muted)]">
                      {entry.latestWeekOpenUtc
                        ? `Latest data: ${formatDate(entry.latestWeekOpenUtc)}`
                        : "No data"}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--panel-border)]/60 bg-[var(--panel)]/40 p-2">
      <p className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
