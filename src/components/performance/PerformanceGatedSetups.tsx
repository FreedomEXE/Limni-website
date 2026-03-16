"use client";

import { useEffect, useMemo, useState } from "react";

type GateDecision = "PASS" | "SKIP" | "NO_DATA";

type GatedSetupSignal = {
  assetClass: string;
  pair: string;
  dealer: string;
  commercial: string;
  sentiment: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  tier: "HIGH" | "MEDIUM" | "NEUTRAL";
  gateDecision: GateDecision;
  gateReasons: string[];
  basePct: number | null;
  quotePct: number | null;
  actionable8w: number;
  flips8w: number;
  consistency8w: number;
};

type GatedSetupsPayload = {
  sourcePath: string;
  generatedUtc: string | null;
  currentWeekOpenUtc: string | null;
  weeksUsedForStability: string[];
  summary: {
    total: number;
    pass: number;
    skip: number;
    noData: number;
    actionable: number;
    highTier: number;
    mediumTier: number;
    neutralTier: number;
  };
  signals: GatedSetupSignal[];
  skipOnlyMode: boolean;
};

function decisionClass(decision: GateDecision) {
  if (decision === "PASS") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (decision === "SKIP") return "border-rose-300 bg-rose-50 text-rose-700";
  return "border-slate-300 bg-slate-100 text-slate-600";
}

function tierClass(tier: GatedSetupSignal["tier"]) {
  if (tier === "HIGH") return "text-emerald-700";
  if (tier === "MEDIUM") return "text-amber-700";
  return "text-[color:var(--muted)]";
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export default function PerformanceGatedSetups() {
  const [data, setData] = useState<GatedSetupsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<"ALL" | GateDecision>("ALL");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/performance/gated-setups");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        if (!cancelled) {
          if (json.error) {
            throw new Error(String(json.error));
          }
          setData(json as GatedSetupsPayload);
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

  const filteredSignals = useMemo(() => {
    const rows = data?.signals ?? [];
    if (decisionFilter === "ALL") return rows;
    return rows.filter((row) => row.gateDecision === decisionFilter);
  }, [data, decisionFilter]);

  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Current Gated Setups</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Weekly board with binary gate decision per setup (PASS/SKIP).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["ALL", "PASS", "SKIP", "NO_DATA"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDecisionFilter(item)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                decisionFilter === item
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--panel-border)]/60 bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
          Loading gated setups...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load gated setups: {error}
        </div>
      ) : null}

      {!loading && !error && data ? (
        <>
          <div className="mb-3 grid gap-2 md:grid-cols-5">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
              <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">Week</div>
              <div className="text-sm font-semibold text-[var(--foreground)]">{data.currentWeekOpenUtc?.slice(0, 10) ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
              <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">Setups</div>
              <div className="text-sm font-semibold text-[var(--foreground)]">{data.summary.total}</div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
              <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">Actionable</div>
              <div className="text-sm font-semibold text-emerald-700">{data.summary.actionable}</div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
              <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">Skip</div>
              <div className="text-sm font-semibold text-rose-700">{data.summary.skip}</div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
              <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--muted)]">Source</div>
              <div className="truncate text-xs font-semibold text-[var(--foreground)]">{data.sourcePath}</div>
            </div>
          </div>
          {data.skipOnlyMode ? (
            <div className="mb-2 text-xs text-[color:var(--muted)]">
              Skip-only mode is active. Any REDUCE signal is treated as SKIP.
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
            <table className="min-w-full divide-y divide-[var(--panel-border)] text-xs">
              <thead className="bg-[var(--panel)]/70">
                <tr className="text-left uppercase tracking-[0.12em] text-[color:var(--muted)]">
                  <th className="px-3 py-2">Pair</th>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Dir</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Gate</th>
                  <th className="px-3 py-2">Reasons</th>
                  <th className="px-3 py-2">Consistency</th>
                  <th className="px-3 py-2">8W Active</th>
                  <th className="px-3 py-2">COT Base/Quote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/40">
                {filteredSignals.map((row) => (
                  <tr key={`${row.pair}-${row.direction}`}>
                    <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.pair}</td>
                    <td className="px-3 py-2 text-[var(--foreground)]/80">{row.assetClass.toUpperCase()}</td>
                    <td className={`px-3 py-2 font-semibold ${row.direction === "LONG" ? "text-emerald-700" : row.direction === "SHORT" ? "text-rose-700" : "text-[color:var(--muted)]"}`}>
                      {row.direction}
                    </td>
                    <td className={`px-3 py-2 font-semibold ${tierClass(row.tier)}`}>{row.tier}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${decisionClass(row.gateDecision)}`}>
                        {row.gateDecision}
                      </span>
                    </td>
                    <td className="max-w-[360px] truncate px-3 py-2 text-[var(--foreground)]/80" title={row.gateReasons.join(", ")}>
                      {row.gateReasons.length > 0 ? row.gateReasons.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]/80">{(row.consistency8w * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2 text-[var(--foreground)]/80">{row.actionable8w}</td>
                    <td className="px-3 py-2 text-[var(--foreground)]/80">
                      {formatPct(row.basePct)} / {formatPct(row.quotePct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
