"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import type { ResearchConfig, ResearchRunResult } from "@/lib/research/types";
import {
  defaultResearchConfig,
  parseResearchConfigFromParams,
  serializeResearchConfigToParams,
  validateResearchConfig,
} from "@/lib/research/labConfigQuery";

const ALL_MODELS: Array<ResearchConfig["models"][number]> = ["antikythera", "blended", "dealer", "commercial", "sentiment"];
const ALL_ASSET_CLASSES: Array<ResearchConfig["universe"]["assetClasses"][number]> = ["fx", "indices", "commodities", "crypto"];

export default function ResearchLabClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<ResearchConfig>(() => defaultResearchConfig());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [result, setResult] = useState<ResearchRunResult | null>(null);
  const [queryReady, setQueryReady] = useState(false);

  useEffect(() => {
    const parsed = parseResearchConfigFromParams(new URLSearchParams(searchParams.toString()));
    setConfig(parsed);
    setQueryReady(true);
  }, [searchParams]);

  useEffect(() => {
    if (!queryReady) return;
    const params = serializeResearchConfigToParams(config);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [config, pathname, queryReady, router]);

  const chartSeries = useMemo(() => {
    if (!result) return [];
    return [{ id: "equity", label: "Equity", points: result.equityCurve }];
  }, [result]);
  const configErrors = useMemo(() => validateResearchConfig(config), [config]);

  async function submit() {
    if (configErrors.length > 0) return;
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

  function updateConfig(updater: (prev: ResearchConfig) => ResearchConfig) {
    setConfig((prev) => updater(prev));
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

  function toggleAssetClass(assetClass: ResearchConfig["universe"]["assetClasses"][number]) {
    updateConfig((prev) => {
      const exists = prev.universe.assetClasses.includes(assetClass);
      const nextAssetClasses = exists
        ? prev.universe.assetClasses.filter((item) => item !== assetClass)
        : [...prev.universe.assetClasses, assetClass];
      return {
        ...prev,
        universe: {
          ...prev.universe,
          assetClasses: nextAssetClasses.length > 0 ? nextAssetClasses : [assetClass],
        },
      };
    });
  }

  const runDisabled = loading || configErrors.length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Config Builder (Phase 1B)
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Mode</span>
            <select
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.mode}
              onChange={(event) =>
                updateConfig((prev) => ({ ...prev, mode: event.target.value as ResearchConfig["mode"] }))
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
                updateConfig((prev) => ({ ...prev, provider: event.target.value as ResearchConfig["provider"] }))
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
              type="datetime-local"
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={toLocalDateTime(config.dateRange.from)}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, from: fromLocalDateTime(event.target.value) },
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">To (ISO)</span>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={toLocalDateTime(config.dateRange.to)}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  dateRange: { ...prev.dateRange, to: fromLocalDateTime(event.target.value) },
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Account Key (optional)</span>
            <input
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.accountKey ?? ""}
              onChange={(event) =>
                updateConfig((prev) => ({ ...prev, accountKey: event.target.value || undefined }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Leg Mode</span>
            <select
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.execution.legMode}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  execution: { ...prev.execution, legMode: event.target.value as ResearchConfig["execution"]["legMode"] },
                }))
              }
            >
              <option value="net_only">Net Only</option>
              <option value="full_legs">Full Legs</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Execution Order</span>
            <select
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.execution.order}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  execution: { ...prev.execution, order: event.target.value as ResearchConfig["execution"]["order"] },
                }))
              }
            >
              <option value="grouped_by_symbol">Grouped by Symbol</option>
              <option value="leg_sequence">Leg Sequence</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Sizing</span>
            <select
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.risk.sizing}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  risk: { ...prev.risk, sizing: event.target.value as ResearchConfig["risk"]["sizing"] },
                }))
              }
            >
              <option value="broker_native">Broker Native</option>
              <option value="fixed_risk">Fixed Risk</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Leverage</span>
            <input
              type="number"
              min={1}
              step={1}
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.risk.leverage ?? 50}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  risk: { ...prev.risk, leverage: Number(event.target.value) || 1 },
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Margin Buffer</span>
            <input
              type="number"
              min={0}
              max={0.95}
              step={0.01}
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.risk.marginBuffer}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  risk: { ...prev.risk, marginBuffer: Number(event.target.value) || 0 },
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Slippage (bps)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.realism.slippageBps ?? 0}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  realism: { ...prev.realism, slippageBps: Number(event.target.value) || 0 },
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Commission (bps)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={config.realism.commissionBps ?? 0}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  realism: { ...prev.realism, commissionBps: Number(event.target.value) || 0 },
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">Universe Symbols (CSV, optional)</span>
            <input
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
              value={(config.universe.symbols ?? []).join(",")}
              onChange={(event) =>
                updateConfig((prev) => ({
                  ...prev,
                  universe: {
                    ...prev.universe,
                    symbols: event.target.value
                      .split(",")
                      .map((item) => item.trim().toUpperCase())
                      .filter(Boolean),
                  },
                }))
              }
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_ASSET_CLASSES.map((assetClass) => {
            const active = config.universe.assetClasses.includes(assetClass);
            return (
              <button
                key={assetClass}
                type="button"
                onClick={() => toggleAssetClass(assetClass)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] text-[color:var(--muted)]"
                }`}
              >
                {assetClass}
              </button>
            );
          })}
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
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ToggleField
            label="Include Neutral Legs"
            checked={config.execution.includeNeutral}
            onChange={(next) =>
              updateConfig((prev) => ({ ...prev, execution: { ...prev.execution, includeNeutral: next } }))
            }
          />
          <ToggleField
            label="Allow Partial Fills"
            checked={config.realism.allowPartialFills}
            onChange={(next) =>
              updateConfig((prev) => ({ ...prev, realism: { ...prev.realism, allowPartialFills: next } }))
            }
          />
          <ToggleField
            label="Use Stop Loss"
            checked={Boolean(config.risk.stopLoss)}
            onChange={(next) =>
              updateConfig((prev) => ({
                ...prev,
                risk: { ...prev.risk, stopLoss: next ? { type: "pct", value: prev.risk.stopLoss?.value ?? 0.01 } : undefined },
              }))
            }
          />
          {config.risk.stopLoss ? (
            <label className="space-y-1 text-sm">
              <span className="text-[color:var(--muted)]">Stop Loss %</span>
              <input
                type="number"
                min={0.001}
                max={0.95}
                step={0.001}
                className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
                value={config.risk.stopLoss.value}
                onChange={(event) =>
                  updateConfig((prev) => ({
                    ...prev,
                    risk: {
                      ...prev.risk,
                      stopLoss: { type: "pct", value: Number(event.target.value) || 0.01 },
                    },
                  }))
                }
              />
            </label>
          ) : null}
          <ToggleField
            label="Use Trailing Stop"
            checked={Boolean(config.risk.trailing)}
            onChange={(next) =>
              updateConfig((prev) => ({
                ...prev,
                risk: {
                  ...prev.risk,
                  trailing: next
                    ? {
                        startPct: prev.risk.trailing?.startPct ?? 0.2,
                        offsetPct: prev.risk.trailing?.offsetPct ?? 0.1,
                      }
                    : undefined,
                },
              }))
            }
          />
          {config.risk.trailing ? (
            <>
              <label className="space-y-1 text-sm">
                <span className="text-[color:var(--muted)]">Trailing Start %</span>
                <input
                  type="number"
                  min={0.001}
                  max={0.95}
                  step={0.001}
                  className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
                  value={config.risk.trailing.startPct}
                  onChange={(event) =>
                    updateConfig((prev) => ({
                      ...prev,
                      risk: {
                        ...prev.risk,
                        trailing: {
                          startPct: Number(event.target.value) || 0.2,
                          offsetPct: prev.risk.trailing?.offsetPct ?? 0.1,
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[color:var(--muted)]">Trailing Offset %</span>
                <input
                  type="number"
                  min={0.001}
                  max={0.95}
                  step={0.001}
                  className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
                  value={config.risk.trailing.offsetPct}
                  onChange={(event) =>
                    updateConfig((prev) => ({
                      ...prev,
                      risk: {
                        ...prev.risk,
                        trailing: {
                          startPct: prev.risk.trailing?.startPct ?? 0.2,
                          offsetPct: Number(event.target.value) || 0.1,
                        },
                      },
                    }))
                  }
                />
              </label>
            </>
          ) : null}
        </div>
        {configErrors.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Validation</p>
            <ul className="mt-2 list-disc pl-5">
              {configErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-4">
          <button
            type="button"
            onClick={submit}
            disabled={runDisabled}
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
          <div className="grid gap-4 lg:grid-cols-3">
            <DataTable
              title="By Model"
              columns={["Model", "Return", "DD", "Trades"]}
              rows={result.byModel.map((row) => [
                row.model,
                pct(row.return_pct),
                pct(row.drawdown_pct),
                String(row.trades),
              ])}
            />
            <DataTable
              title="By Symbol"
              columns={["Symbol", "Return", "Win", "Trades"]}
              rows={result.bySymbol.map((row) => [
                row.symbol,
                pct(row.return_pct),
                pct(row.win_rate_pct),
                String(row.trades),
              ])}
            />
            <DataTable
              title="By Weekday"
              columns={["Weekday", "Return", "Trades"]}
              rows={(result.byWeekday ?? []).map((row) => [
                weekdayName(row.weekday),
                pct(row.return_pct),
                String(row.trades),
              ])}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function pct(value: number) {
  return `${value.toFixed(2)}%`;
}

function weekdayName(weekday: number) {
  const map = ["-", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return map[weekday] ?? `Day ${weekday}`;
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDateTime(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm">
      <span className="text-[color:var(--muted)]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function DataTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{title}</h4>
      <div className="mt-2 overflow-auto">
        <table className="w-full min-w-[260px] text-left text-xs">
          <thead>
            <tr className="text-[color:var(--muted)]">
              {columns.map((col) => (
                <th key={col} className="px-2 py-1 font-medium uppercase tracking-[0.14em]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row, idx) => (
              <tr key={`${title}-${idx}`} className="border-t border-[var(--panel-border)]/60">
                {row.map((cell, cellIdx) => (
                  <td key={`${title}-${idx}-${cellIdx}`} className="px-2 py-1.5 text-[var(--foreground)]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
