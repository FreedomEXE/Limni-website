"use client";

import { useMemo, useState } from "react";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import type { ResearchConfig, ResearchRunResult } from "@/lib/research/types";

const ALL_MODELS: Array<ResearchConfig["models"][number]> = [
  "antikythera",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
];

function defaultConfig(): ResearchConfig {
  return {
    mode: "hypothetical_sim",
    provider: "oanda",
    dateRange: { from: "2025-01-06T00:00:00.000Z", to: "2026-02-09T05:00:00.000Z" },
    universe: { assetClasses: ["fx"], symbols: [] },
    models: ["sentiment"],
    execution: { legMode: "net_only", includeNeutral: false, order: "grouped_by_symbol" },
    risk: { marginBuffer: 0.1, leverage: 50, sizing: "broker_native" },
    realism: { slippageBps: 2, commissionBps: 1, allowPartialFills: true },
  };
}

export default function ResearchLabClient() {
  const [config, setConfig] = useState<ResearchConfig>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [result, setResult] = useState<ResearchRunResult | null>(null);

  const chartSeries = useMemo(() => {
    if (!result) return [];
    return [{ id: "equity", label: "Equity", points: result.equityCurve }];
  }, [result]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/research/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        cached?: boolean;
        runId?: string;
        result?: ResearchRunResult;
      };
      if (!response.ok || !payload.ok || !payload.result) {
        throw new Error(payload.error ?? "Backtest run failed.");
      }
      setCached(Boolean(payload.cached));
      setRunId(payload.runId ?? null);
      setResult(payload.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleModel(model: ResearchConfig["models"][number]) {
    setConfig((prev) => {
      const exists = prev.models.includes(model);
      const nextModels = exists
        ? prev.models.filter((item) => item !== model)
        : [...prev.models, model];
      return { ...prev, models: nextModels.length > 0 ? nextModels : [model] };
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Config Builder (Phase 1A)
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Mode</span>
            <select
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.mode}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, mode: event.target.value as ResearchConfig["mode"] }))
              }
            >
              <option value="hypothetical_sim">Hypothetical</option>
              <option value="as_traded_replay">As-Traded Replay</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Provider</span>
            <select
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.provider}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, provider: event.target.value as ResearchConfig["provider"] }))
              }
            >
              <option value="oanda">OANDA</option>
              <option value="mt5">MT5</option>
              <option value="bitget">Bitget</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">From (ISO)</span>
            <input
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.dateRange.from}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, dateRange: { ...prev.dateRange, from: event.target.value } }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">To (ISO)</span>
            <input
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.dateRange.to}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, dateRange: { ...prev.dateRange, to: event.target.value } }))
              }
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_MODELS.map((model) => {
            const active = config.models.includes(model);
            return (
              <button
                key={model}
                type="button"
                onClick={() => toggleModel(model)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] text-[color:var(--muted)]"
                }`}
              >
                {model}
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="rounded-lg border border-[var(--accent)] bg-[var(--accent)]/20 px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] disabled:opacity-60"
          >
            {loading ? "Running..." : "Run Backtest"}
          </button>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </section>
      ) : null}

      {result ? (
        <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            <span>Run {runId ?? result.runId}</span>
            <span>{cached ? "Cached" : "Fresh"}</span>
            <span>Hash {result.configHash.slice(0, 12)}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Return" value={`${result.headline.totalReturnPct.toFixed(2)}%`} />
            <Kpi label="Max DD" value={`${result.headline.maxDrawdownPct.toFixed(2)}%`} />
            <Kpi label="Win Rate" value={`${result.headline.winRatePct.toFixed(2)}%`} />
            <Kpi label="Trades" value={`${result.headline.pricedTrades}/${result.headline.trades}`} />
            <Kpi label="Fill Rate" value={`${result.risk.fillRatePct.toFixed(2)}%`} />
          </div>
          <EquityCurveChart
            title="Research Lab Equity Curve"
            series={chartSeries}
            interactive
          />
        </section>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
