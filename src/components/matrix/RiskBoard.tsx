/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: RiskBoard.tsx
 *
 * Description:
 * Simplified Risk tab for Matrix. Centralizes account sizing, base/add lot
 * planning, and copyable execution output for the selected weekly basket.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import InstrumentConfigModal from "@/components/flagship/InstrumentConfigModal";
import SizingAccountBar from "@/components/flagship/SizingAccountBar";
import { useSizingAccounts } from "@/hooks/useSizingAccounts";
import { getInstrumentSpec, type InstrumentSpec } from "@/lib/flagship/instrumentDefaults";
import { calculateLotSize, type SizingResult } from "@/lib/flagship/positionSizer";
import type { CryptoMatrixPayload } from "@/lib/flagship/cryptoMatrix";
import { getStrategy } from "@/lib/performance/strategyConfig";
import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type { CanonicalSignal, WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";

type WeeklyReturnRow = {
  symbol: string;
  assetClass: string;
  returnPct: number;
  openPrice: number;
  closePrice: number;
};

type RiskBoardProps = {
  weekOpenUtc: string | null;
  currentWeekOpenUtc: string;
  selection: RuntimeStrategySelection;
  engineWeekResults: Record<string, WeeklyHoldResult> | null;
  canonicalSignals: CanonicalSignal[];
  weeklyReturns: WeeklyReturnRow[];
};

type IntradayLevelRow = {
  pair: string;
  adrPct: number | null;
  currentPrice: number | null;
};

type IntradayLevelsPayload = {
  rows: IntradayLevelRow[];
};

type RiskRow = {
  pair: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  adrPct: number | null;
  currentPrice: number | null;
  sizing: SizingResult | null;
  spec: InstrumentSpec | null;
  baseLots: number | null;
  addLots: number | null;
  maxLots: number | null;
  baseMarginUsd: number | null;
  maxMarginUsd: number | null;
  currentReturnPct: number | null;
};

function normalizeSymbol(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeAssetClass(value: string) {
  return value.trim().toLowerCase();
}

function assetClassLabel(value: string) {
  const normalized = normalizeAssetClass(value);
  if (normalized === "fx") return "FX";
  if (normalized === "indices") return "Indices";
  if (normalized === "commodities") return "Commodities";
  if (normalized === "crypto") return "Crypto";
  return value;
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return value.toFixed(2);
  if (Math.abs(value) >= 100) return value.toFixed(3);
  if (Math.abs(value) >= 10) return value.toFixed(4);
  return value.toFixed(5);
}

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatScaleFactor(value: number) {
  if (!(value > 0)) return "0";
  const inverse = 1 / value;
  const rounded = Math.round(inverse);
  if (Math.abs(inverse - rounded) < 1e-6) return `1/${rounded}`;
  return value.toFixed(2);
}

function lotPrecision(step: number) {
  const [, decimal = ""] = `${step}`.split(".");
  return decimal.length;
}

function roundScaledLot(value: number, spec: InstrumentSpec) {
  if (!(value > 0) || !(spec.lotStep > 0)) return 0;
  const rounded = Math.round(value / spec.lotStep) * spec.lotStep;
  const clamped = Math.min(spec.maxLot, Math.max(spec.minLot, rounded));
  return Number(clamped.toFixed(lotPrecision(spec.lotStep)));
}

function formatLot(value: number | null, spec: InstrumentSpec | null) {
  if (value === null || !spec) return "—";
  return value.toFixed(lotPrecision(spec.lotStep));
}

function directionTone(direction: "LONG" | "SHORT") {
  return direction === "LONG"
    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

function rowTone(returnPct: number | null) {
  if (returnPct === null) return "";
  if (returnPct > 0) return "bg-emerald-500/6";
  if (returnPct < 0) return "bg-rose-500/6";
  return "";
}

function compareRows(left: RiskRow, right: RiskRow) {
  const order: Record<string, number> = {
    FX: 0,
    Indices: 1,
    Commodities: 2,
    Crypto: 3,
  };
  const leftClass = assetClassLabel(left.assetClass);
  const rightClass = assetClassLabel(right.assetClass);
  const leftOrder = order[leftClass] ?? 99;
  const rightOrder = order[rightClass] ?? 99;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return left.pair.localeCompare(right.pair);
}

function weekLabel(weekOpenUtc: string | null) {
  if (!weekOpenUtc) return "Unknown";
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd yyyy");
}

export default function RiskBoard(props: RiskBoardProps) {
  const { weekOpenUtc, selection, engineWeekResults, weeklyReturns } = props;
  const {
    accounts,
    activeAccount,
    setActiveAccountId,
    addAccount,
    updateAccount,
    deleteAccount,
    updateInstrumentOverride,
  } = useSizingAccounts();
  const [intradayLevels, setIntradayLevels] = useState<IntradayLevelsPayload | null>(null);
  const [cryptoMatrix, setCryptoMatrix] = useState<CryptoMatrixPayload | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedPlan, setCopiedPlan] = useState(false);
  const [sizingModalPair, setSizingModalPair] = useState<{ pair: string; assetClass: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSizingContext() {
      try {
        const weekQs = weekOpenUtc ? `?week=${encodeURIComponent(weekOpenUtc)}` : "";
        const [intradayResponse, cryptoResponse] = await Promise.allSettled([
          fetch(`/api/flagship/intraday-levels${weekQs}`, { cache: "no-store" }),
          fetch(`/api/flagship/crypto-matrix${weekQs}`, { cache: "no-store" }),
        ]);

        const readJson = async <T,>(response: PromiseSettledResult<Response>) => {
          if (response.status === "fulfilled" && response.value.ok) return (await response.value.json()) as T;
          return null;
        };

        const [intradayJson, cryptoJson] = await Promise.all([
          readJson<IntradayLevelsPayload>(intradayResponse),
          readJson<CryptoMatrixPayload>(cryptoResponse),
        ]);

        if (!cancelled) {
          setIntradayLevels(intradayJson);
          setCryptoMatrix(cryptoJson);
        }
      } catch {
        /* silently fall back to engine data */
      }
    }

    void loadSizingContext();
    return () => {
      cancelled = true;
    };
  }, [weekOpenUtc]);

  useEffect(() => {
    if (!copiedKey) return;
    const timeout = window.setTimeout(() => setCopiedKey(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  useEffect(() => {
    if (!copiedPlan) return;
    const timeout = window.setTimeout(() => setCopiedPlan(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copiedPlan]);

  const selectedWeekResult = useMemo(
    () => (weekOpenUtc ? engineWeekResults?.[weekOpenUtc] ?? null : null),
    [engineWeekResults, weekOpenUtc],
  );

  const weeklyReturnsByPair = useMemo(() => {
    const map = new Map<string, WeeklyReturnRow>();
    for (const row of weeklyReturns) map.set(normalizeSymbol(row.symbol), row);
    return map;
  }, [weeklyReturns]);

  const intradayByPair = useMemo(() => {
    const map = new Map<string, IntradayLevelRow>();
    for (const row of intradayLevels?.rows ?? []) map.set(normalizeSymbol(row.pair), row);
    return map;
  }, [intradayLevels]);

  const cryptoByPair = useMemo(() => {
    const map = new Map<string, CryptoMatrixPayload["rows"][number]>();
    for (const row of cryptoMatrix?.rows ?? []) {
      map.set(normalizeSymbol(`${row.symbol}USD`), row);
    }
    return map;
  }, [cryptoMatrix]);

  const riskRows = useMemo(() => {
    if (!selectedWeekResult || !activeAccount) return [] satisfies RiskRow[];

    return selectedWeekResult.trades
      .map((trade) => {
        const pairKey = normalizeSymbol(trade.symbol);
        const normalizedClass = normalizeAssetClass(trade.assetClass);
        const currentWeekRow = weeklyReturnsByPair.get(pairKey) ?? null;
        const intradayRow = intradayByPair.get(pairKey) ?? null;
        const cryptoRow = cryptoByPair.get(pairKey) ?? null;
        const adrPct = cryptoRow?.adrPct ?? intradayRow?.adrPct ?? null;
        const currentPrice =
          cryptoRow?.currentPrice
          ?? intradayRow?.currentPrice
          ?? currentWeekRow?.closePrice
          ?? trade.closePrice
          ?? null;
        const spec = currentPrice && adrPct !== null
          ? getInstrumentSpec(pairKey, activeAccount.instrumentOverrides[pairKey])
          : getInstrumentSpec(pairKey, activeAccount.instrumentOverrides[pairKey]);
        const sizing =
          adrPct !== null && currentPrice !== null
            ? calculateLotSize(activeAccount, spec, adrPct, currentPrice)
            : null;
        const baseLots = sizing ? roundScaledLot(sizing.lotSize * activeAccount.scaleFactor, spec) : null;
        const addLots = sizing ? roundScaledLot(sizing.lotSize * activeAccount.scaleFactor * 0.5, spec) : null;
        const maxLots =
          baseLots !== null && addLots !== null
            ? Number((baseLots + addLots + addLots).toFixed(lotPrecision(spec.lotStep)))
            : null;

        return {
          pair: pairKey,
          assetClass: normalizedClass,
          direction: trade.direction,
          adrPct,
          currentPrice,
          sizing,
          spec,
          baseLots,
          addLots,
          maxLots,
          baseMarginUsd: sizing && baseLots !== null && sizing.lotSize > 0 ? (sizing.marginRequired * baseLots) / sizing.lotSize : null,
          maxMarginUsd: sizing && maxLots !== null && sizing.lotSize > 0 ? (sizing.marginRequired * maxLots) / sizing.lotSize : null,
          currentReturnPct: currentWeekRow?.returnPct ?? trade.returnPct ?? null,
        } satisfies RiskRow;
      })
      .sort(compareRows);
  }, [activeAccount, cryptoByPair, intradayByPair, selectedWeekResult, weeklyReturnsByPair]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, RiskRow[]>();
    for (const row of riskRows) {
      const key = assetClassLabel(row.assetClass);
      const existing = groups.get(key);
      if (existing) existing.push(row);
      else groups.set(key, [row]);
    }
    return Array.from(groups.entries());
  }, [riskRows]);

  const summary = useMemo(() => {
    const totals = riskRows.reduce(
      (acc, row) => {
        acc.baseLots += row.baseLots ?? 0;
        acc.addLots += row.addLots ?? 0;
        acc.maxLots += row.maxLots ?? 0;
        acc.baseMarginUsd += row.baseMarginUsd ?? 0;
        acc.maxMarginUsd += row.maxMarginUsd ?? 0;
        return acc;
      },
      { baseLots: 0, addLots: 0, maxLots: 0, baseMarginUsd: 0, maxMarginUsd: 0 },
    );
    return totals;
  }, [riskRows]);

  const strategyLabel = getStrategy(selection.strategy)?.label ?? selection.strategy;

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch {
      setCopiedKey(null);
    }
  }

  async function copyExecutionPlan() {
    if (!activeAccount || riskRows.length === 0) return;
    const text = [
      `=== WEEK OF ${weekLabel(weekOpenUtc).toUpperCase()} — ${strategyLabel} ===`,
      `Account: ${activeAccount.name} (${formatUsd(activeAccount.balance)}) | Scale: ${formatScaleFactor(activeAccount.scaleFactor)}`,
      "",
      "BASE ENTRY (1/5):",
      groupedRows
        .map(([, rows]) => rows
          .map((row) => `  ${row.pair.padEnd(8)} ${row.direction.padEnd(5)} ${formatLot(row.baseLots, row.spec)} lots`)
          .join("\n"))
        .join("\n"),
      "",
      "ADD ENTRY (1/10) — same size for Tuesday / Wednesday:",
      groupedRows
        .map(([, rows]) => rows
          .map((row) => `  ${row.pair.padEnd(8)} ${row.direction.padEnd(5)} ${formatLot(row.addLots, row.spec)} lots`)
          .join("\n"))
        .join("\n"),
      "",
      "TRAIL: activate at +1.25% basket P&L, trail 0.5%",
      "SAFETY: S1 — skip adds if basket P&L < -1%",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedPlan(true);
    } catch {
      setCopiedPlan(false);
    }
  }

  if (!weekOpenUtc) {
    return (
      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-sm text-[color:var(--muted)]">
        Select a week to see the execution plan.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Matrix</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)] md:text-2xl">Risk</h1>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
              {strategyLabel} · week of {weekLabel(weekOpenUtc)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
            <div>Base layer {activeAccount ? formatScaleFactor(activeAccount.scaleFactor) : "1/5"}</div>
            <div>Add layer {activeAccount ? formatScaleFactor(activeAccount.scaleFactor * 0.5) : "1/10"}</div>
            <div>Trail 1.25 / 0.5 · Safety S1</div>
          </div>
        </div>

        <SizingAccountBar
          accounts={accounts}
          activeAccount={activeAccount}
          onSelectAccount={setActiveAccountId}
          onAddAccount={addAccount}
          onUpdateAccount={updateAccount}
          onDeleteAccount={deleteAccount}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Pairs</div>
            <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{riskRows.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Base Margin</div>
            <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{formatUsd(summary.baseMarginUsd)}</div>
          </div>
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Max Margin</div>
            <div className="mt-1 text-xl font-semibold text-[var(--foreground)]">{formatUsd(summary.maxMarginUsd)}</div>
          </div>
        </div>
      </header>

      {!activeAccount ? (
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-sm text-[color:var(--muted)]">
          Create or select a sizing account to generate the execution plan.
        </div>
      ) : null}

      {activeAccount && !selectedWeekResult ? (
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-sm text-[color:var(--muted)]">
          No strategy result is loaded for this week yet.
        </div>
      ) : null}

      {activeAccount && selectedWeekResult ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--panel)] text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Pair</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Dir</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Base Lots</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Add Lots</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Max Lots</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">ADR %</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/25">
                {groupedRows.map(([assetLabel, rows]) => (
                  <Fragment key={assetLabel}>
                    <tr className="bg-[var(--panel)]/70">
                      <td colSpan={7} className="border-b border-[var(--panel-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {assetLabel}
                      </td>
                    </tr>
                    {rows.map((row) => (
                      <tr key={row.pair} className={`transition-colors ${rowTone(row.currentReturnPct)}`}>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[var(--foreground)]">{row.pair}</span>
                            <button
                              type="button"
                              onClick={() => setSizingModalPair({ pair: row.pair, assetClass: row.assetClass })}
                              className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                            >
                              Spec
                            </button>
                          </div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                            {row.currentReturnPct === null ? "No weekly P/L" : `Weekly ${formatPct(row.currentReturnPct)}`}
                          </div>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <span className={`inline-flex min-w-[5rem] justify-center rounded border px-2 py-0.5 font-semibold ${directionTone(row.direction)}`}>
                            {row.direction}
                          </span>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void copyText(`${row.pair}:base`, formatLot(row.baseLots, row.spec))}
                            className="font-mono text-sm font-semibold text-[var(--foreground)] transition hover:text-[var(--accent-strong)]"
                          >
                            {formatLot(row.baseLots, row.spec)}
                          </button>
                          {copiedKey === `${row.pair}:base` ? (
                            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--accent-strong)]">Copied</div>
                          ) : null}
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void copyText(`${row.pair}:add`, formatLot(row.addLots, row.spec))}
                            className="font-mono text-sm font-semibold text-[var(--foreground)] transition hover:text-[var(--accent-strong)]"
                          >
                            {formatLot(row.addLots, row.spec)}
                          </button>
                          {copiedKey === `${row.pair}:add` ? (
                            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--accent-strong)]">Copied</div>
                          ) : null}
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2 font-mono text-sm font-semibold text-[var(--foreground)]">
                          {formatLot(row.maxLots, row.spec)}
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2 text-[var(--foreground)]">
                          {row.adrPct === null ? "—" : row.adrPct.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-[var(--foreground)]">{formatPrice(row.currentPrice)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Execution Plan</div>
              <div className="text-sm text-[color:var(--muted)]">
                Base size is {formatScaleFactor(activeAccount.scaleFactor)}. Add size is {formatScaleFactor(activeAccount.scaleFactor * 0.5)}. Tuesday and Wednesday use the same add lots.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void copyExecutionPlan()}
              className="rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/20"
            >
              {copiedPlan ? "Copied Plan" : "Copy Execution Plan"}
            </button>
          </div>
        </>
      ) : null}

      {sizingModalPair && activeAccount ? (
        <InstrumentConfigModal
          pair={sizingModalPair.pair}
          assetClass={sizingModalPair.assetClass}
          spec={getInstrumentSpec(
            sizingModalPair.pair,
            activeAccount.instrumentOverrides[sizingModalPair.pair],
          )}
          accountOverrides={activeAccount.instrumentOverrides[sizingModalPair.pair]}
          onSave={(overrides) => {
            updateInstrumentOverride(activeAccount.id, sizingModalPair.pair, overrides);
            setSizingModalPair(null);
          }}
          onClose={() => setSizingModalPair(null)}
        />
      ) : null}
    </section>
  );
}
