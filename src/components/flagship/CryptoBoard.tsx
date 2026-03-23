"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import type {
  CryptoAnchorRegime,
  CryptoBiasDirection,
  CryptoMatrixPayload,
  CryptoMatrixRow,
} from "@/lib/flagship/cryptoMatrix";
import {
  biasChipClass,
  contextClass,
  formatPct,
  rowHighlightClass,
  stateClass,
  stateLabel,
  type MatrixTrendState,
} from "@/lib/flagship/matrixStyles";
import { formatDateTimeET } from "@/lib/time";

type TriggerState = "HIT" | "CLOSE" | "WATCHING" | "NO_DATA";
type AgreementSignal = boolean | null;

function toTrendState(direction: CryptoBiasDirection): MatrixTrendState {
  if (direction === "LONG") return "BULLISH";
  if (direction === "SHORT") return "BEARISH";
  return "NEUTRAL";
}

function arrowForState(state: MatrixTrendState) {
  if (state === "BULLISH") return "↑";
  if (state === "BEARISH") return "↓";
  return "—";
}

function regimeBannerClass(regime: CryptoAnchorRegime) {
  const state = toTrendState(regime.weeklyBias);
  if (state === "BULLISH") return "border-emerald-500/35 bg-emerald-500/10";
  if (state === "BEARISH") return "border-rose-500/35 bg-rose-500/10";
  return "border-slate-500/25 bg-slate-500/10";
}

function formatFunding(rate: number | null) {
  if (rate === null || !Number.isFinite(rate)) return "—";
  const bps = rate * 10000;
  return `${bps > 0 ? "+" : ""}${bps.toFixed(1)}bp`;
}

function formatCompactUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatMove(change24hPct: number | null) {
  if (change24hPct === null || !Number.isFinite(change24hPct)) return "—";
  return `${change24hPct > 0 ? "+" : ""}${change24hPct.toFixed(1)}%`;
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return value.toFixed(2);
  if (Math.abs(value) >= 100) return value.toFixed(3);
  if (Math.abs(value) >= 1) return value.toFixed(4);
  return value.toFixed(5);
}

function triggerState(row: CryptoMatrixRow): TriggerState {
  if (row.adrPct === null) return "NO_DATA";
  if (row.oneAdrTouched) return "HIT";
  if (row.touched) return "CLOSE";
  return "WATCHING";
}

function triggerClass(state: TriggerState, flashing: boolean) {
  const base = "inline-flex min-w-[5.25rem] justify-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]";
  if (state === "HIT") return `${base} border-amber-400/40 bg-amber-500/15 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300 ${flashing ? "intraday-adr-pulse" : ""}`;
  if (state === "CLOSE") return `${base} border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300`;
  if (state === "WATCHING") return `${base} border-sky-400/30 bg-sky-500/10 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300`;
  return `${base} border-[var(--panel-border)] bg-[var(--panel)]/60 text-[color:var(--muted)]`;
}

function summarizeAgreement(inputs: AgreementSignal[]) {
  const availableCount = inputs.filter((value) => value !== null).length;
  const agreeCount = inputs.filter((value) => value === true).length;
  const gammaState =
    availableCount === 0
      ? "N/A"
      : agreeCount >= 2 && agreeCount / availableCount >= 2 / 3
        ? "CONFIRM"
        : agreeCount >= 1
          ? "MIXED"
          : "CONFLICT";
  return { agreeCount, availableCount, gammaState };
}

function agreementText(agreeCount: number, availableCount: number) {
  if (availableCount === 0) return "No inputs";
  return `${agreeCount}/${availableCount} agree`;
}

function agreementLabel(value: AgreementSignal) {
  if (value === null) return "unavailable";
  return value ? "agree" : "miss";
}

export default function CryptoBoard() {
  const [data, setData] = useState<CryptoMatrixPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshedUtc, setLastRefreshedUtc] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      try {
        setRefreshing(true);
        setError(null);
        const response = await fetch("/api/flagship/crypto-matrix", { cache: "no-store" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error ?? "Failed to load crypto matrix");
        }
        const payload = (await response.json()) as CryptoMatrixPayload;
        if (!cancelled) {
          setData(payload);
          setLastRefreshedUtc(new Date().toISOString());
          setLoading(false);
          setRefreshing(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadBoard();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const anchorRows = useMemo(
    () =>
      new Map(
        (data?.rows ?? [])
          .filter((row) => row.symbol === "BTC" || row.symbol === "ETH")
          .map((row) => [row.symbol, row] as const),
      ),
    [data],
  );
  const rows = useMemo(
    () => (data?.rows ?? []).filter((row) => row.symbol !== "BTC" && row.symbol !== "ETH"),
    [data],
  );

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Matrix</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)] md:text-2xl">Crypto Matrix</h1>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Manual board</p>
            {data ? (
              <p className="text-[11px] text-[color:var(--muted)]">
                Showing {rows.length} ranked crypto candidates. BTC and ETH remain pinned above.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-right text-xs text-[color:var(--muted)]">
              <div>Data {formatDateTimeET(lastRefreshedUtc ?? data?.generatedUtc ?? null, "Unknown")}</div>
              <div className="font-semibold">Crypto 24/7</div>
            </div>
            <button
              type="button"
              onClick={() => setRefreshTick((value) => value + 1)}
              disabled={refreshing}
              className={`w-full rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                refreshing
                  ? "cursor-not-allowed border-[var(--panel-border)] bg-[var(--panel)]/50 text-[color:var(--muted)]"
                  : "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
              }`}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {data ? (
          <div className="grid gap-2 md:grid-cols-2">
            {[data.regimes.btc, data.regimes.eth].map((regime) => {
              const row = anchorRows.get(regime.symbol) ?? null;
              return (
                <div key={regime.symbol} className={`rounded-xl border px-3 py-3 ${regimeBannerClass(regime)}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{regime.symbol}</span>
                    <span className={`inline-flex min-w-[4.5rem] justify-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${biasChipClass(toTrendState(regime.weeklyBias))}`}>
                      {regime.weeklyBias}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">Weekly Bias</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--muted)]">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${stateClass(regime.dealerBias)}`}>Dealer {stateLabel(regime.dealerBias)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${stateClass(regime.commercialBias)}`}>Comm {stateLabel(regime.commercialBias)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${stateClass(regime.sentimentBias)}`}>Sent {stateLabel(regime.sentimentBias)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--muted)]">
                    {(["H4", "H1", "M15"] as const).map((timeframe) => (
                      <span key={`${regime.symbol}-${timeframe}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${stateClass(regime.votes[timeframe])}`}>
                        <span>{timeframe}</span>
                        <span>{arrowForState(regime.votes[timeframe])}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-[color:var(--muted)]">
                    Live 24h: {formatMove(row?.change24hPct ?? null)} · OI {formatCompactUsd(row?.openInterest ?? null)} · Fund {formatFunding(row?.fundingRate ?? null)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </header>

      {loading ? <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-sm text-[color:var(--muted)]">Loading crypto matrix...</div> : null}
      {error ? <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <colgroup>
                <col className="w-[24rem]" />
                <col className="w-[8rem]" />
                <col className="w-[8rem]" />
                <col className="w-[9rem]" />
                <col className="w-[6rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--panel)] text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Pair</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Core Bias</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Gamma</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Trigger</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Sizing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/25">
                {rows.map((row) => {
                  const expanded = expandedRows.includes(row.symbol);
                  const state = triggerState(row);
                  const { agreeCount, availableCount } = summarizeAgreement([
                    row.liquidationAgree,
                    row.oiAgree,
                    row.fundingAgree,
                  ]);
                  return (
                    <Fragment key={row.symbol}>
                      <tr className={`transition-colors ${rowHighlightClass(toTrendState(row.bias))}`}>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2 font-semibold text-[var(--foreground)]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRows((previous) =>
                                previous.includes(row.symbol)
                                  ? previous.filter((item) => item !== row.symbol)
                                  : [...previous, row.symbol],
                              )
                            }
                            className="group flex w-full items-start gap-2 text-left"
                          >
                            <span className="mt-0.5 inline-flex w-3 justify-center text-[11px] text-[color:var(--muted)]">{expanded ? "▾" : "▸"}</span>
                            <span className="space-y-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span>#{row.rank} {row.symbol}</span>
                                <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">{formatMove(row.change24hPct)}</span>
                                <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">{formatCompactUsd(row.volume24hUsd)}</span>
                              </span>
                              <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                                Tier {row.tier} · Score {row.opportunityScore.toFixed(1)}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="space-y-1">
                            <span className={`inline-flex min-w-[5rem] justify-center rounded border px-2 py-0.5 font-semibold ${biasChipClass(toTrendState(row.bias))}`}>
                              {row.bias}
                            </span>
                            <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                              {row.tier}
                            </div>
                          </div>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="space-y-1">
                            <span className={`inline-flex min-w-[5.5rem] justify-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${contextClass(row.gammaState)}`}>
                              {row.gammaState}
                            </span>
                            <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">{agreementText(agreeCount, availableCount)}</div>
                          </div>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="space-y-1">
                            <span className={triggerClass(state, row.oneAdrTouched)}>
                              {state === "NO_DATA" ? "No Data" : state}
                            </span>
                            {row.adrPct !== null ? (
                              <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                                ADR {row.adrPct.toFixed(2)}%
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[var(--foreground)]">TBD</td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-[var(--panel)]/75">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid gap-2 lg:grid-cols-4">
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Bias Detail</div>
                                <div className="mt-1">Bias {row.bias} · Source {row.biasSource}</div>
                                <div>BTC {stateLabel(row.btcVote)} · ETH {stateLabel(row.ethVote)} · Alt {stateLabel(row.altTrend)}</div>
                                <div>Move 24h {formatMove(row.change24hPct)} · Corr {row.btcCorrelation7d.toFixed(3)}</div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Gamma Detail</div>
                                <div className="mt-1">Liquidation {row.liquidationTilt ?? "—"} · {agreementLabel(row.liquidationAgree)}</div>
                                <div>OI {formatCompactUsd(row.openInterest)} · {agreementLabel(row.oiAgree)}</div>
                                <div>Funding {formatFunding(row.fundingRate)} · {agreementLabel(row.fundingAgree)}</div>
                                <div>Strength 1h / 4h / 24h: {formatPct(row.strength1h, 1)} / {formatPct(row.strength4h, 1)} / {formatPct(row.strength24h, 1)}</div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">ADR Trigger</div>
                                <div className="mt-1">ADR {formatPct(row.adrPct, 2)} · Bars {row.adrBarsUsed || "—"} · Mult {row.adrMultiplier ?? "—"}</div>
                                <div>Day open {formatDateTimeET(row.weekOpenUtc, "Unknown")} @ {formatPrice(row.weekOpenPrice)}</div>
                                <div>Long trigger {formatPrice(row.longTriggerPrice)} · 1.0 ADR {formatPrice(row.oneAdrLongTriggerPrice)}</div>
                                <div>Short trigger {formatPrice(row.shortTriggerPrice)} · 1.0 ADR {formatPrice(row.oneAdrShortTriggerPrice)}</div>
                                <div>Day range {formatPrice(row.weekLowPrice)} - {formatPrice(row.weekHighPrice)} · Current {formatPrice(row.currentPrice)}</div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Market Detail</div>
                                <div className="mt-1">Volume {formatCompactUsd(row.volume24hUsd)}</div>
                                <div>Above liq {formatCompactUsd(row.largestAboveNotional)}</div>
                                <div>Below liq {formatCompactUsd(row.largestBelowNotional)}</div>
                                <div>Funding raw {row.fundingRate === null ? "—" : row.fundingRate.toFixed(6)}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/55 px-3 py-2 text-[11px] text-[color:var(--muted)]">
            <span className="font-semibold uppercase tracking-[0.12em]">Legend</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">B = Bullish</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/35 bg-rose-500/12 px-2 py-0.5 text-rose-700 dark:text-rose-300">S = Bearish</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/25 bg-slate-500/10 px-2 py-0.5 text-slate-600 dark:text-slate-300">N = Neutral</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
