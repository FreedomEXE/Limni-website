/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: CryptoBoard.tsx
 *
 * Description:
 * Phase 1 crypto matrix board for manual trading. Presents BTC/ETH
 * anchor regimes and a ranked alt board using the flagship matrix style.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import type { SessionName } from "@/lib/flagship/sessionConfig";
import {
  defaultSessionFromUtcDate,
  sessionForUtcHour,
  sessionWindowLabelEt,
} from "@/lib/flagship/sessionConfig";
import type {
  CryptoAnchorRegime,
  CryptoBiasDirection,
  CryptoMatrixPayload,
  CryptoMatrixRow,
} from "@/lib/flagship/cryptoMatrix";
import {
  biasChipClass,
  formatPct,
  rowHighlightClass,
  stateClass,
  stateLabel,
  type MatrixTrendState,
} from "@/lib/flagship/matrixStyles";
import { formatDateTimeET } from "@/lib/time";

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
  const state = toTrendState(regime.direction);
  if (state === "BULLISH") return "border-emerald-500/35 bg-emerald-500/10";
  if (state === "BEARISH") return "border-rose-500/35 bg-rose-500/10";
  return "border-slate-500/25 bg-slate-500/10";
}

function tierBadgeClass(tier: CryptoMatrixRow["tier"]) {
  if (tier === "ANCHOR") return "border-sky-500/35 bg-sky-500/12 text-sky-700 dark:text-sky-300";
  if (tier === "A") return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  return "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

function formatFundingGlyph(rate: number | null) {
  if (rate === null || !Number.isFinite(rate)) return "—";
  if (rate > 0.0001) return "+";
  if (rate < -0.0001) return "−";
  return "~";
}

function fundingClass(rate: number | null) {
  if (rate === null || !Number.isFinite(rate)) return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
  if (rate > 0.0001) return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
  if (rate < -0.0001) return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

function formatOiGlyph(deltaPct: number | null) {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return "—";
  if (deltaPct > 5) return "↑";
  if (deltaPct < -5) return "↓";
  return "—";
}

function oiClass(deltaPct: number | null) {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
  if (deltaPct > 5) return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (deltaPct < -5) return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

function formatStrengthChip(row: CryptoMatrixRow) {
  if (row.strengthState === null) return "—";
  return stateLabel(row.strengthState);
}

export default function CryptoBoard() {
  const [data, setData] = useState<CryptoMatrixPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshedUtc, setLastRefreshedUtc] = useState<string | null>(null);
  const [nowUtc, setNowUtc] = useState<Date>(() => new Date());
  const [selectedSession, setSelectedSession] = useState<SessionName>(() => defaultSessionFromUtcDate(new Date()));
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowUtc(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const activeSession = sessionForUtcHour(nowUtc.getUTCHours());

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Matrix</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)] md:text-2xl">Crypto Matrix</h1>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Phase 1 - Manual</p>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-right text-xs text-[color:var(--muted)]">
              <div>Data {formatDateTimeET(lastRefreshedUtc ?? data?.generatedUtc ?? null, "Unknown")}</div>
              <div className="font-semibold">{activeSession ? `Active ${activeSession}` : "Off-hours 17:00-20:00 ET"}</div>
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
            {[data.regimes.btc, data.regimes.eth].map((regime) => (
              <div
                key={regime.symbol}
                className={`rounded-xl border px-3 py-3 ${regimeBannerClass(regime)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{regime.symbol}</span>
                    <span className={`inline-flex min-w-[4.5rem] justify-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${biasChipClass(toTrendState(regime.direction))}`}>
                      {regime.direction}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">{regime.tier}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--muted)]">
                  {(["H4", "H1", "M15"] as const).map((timeframe) => (
                    <span
                      key={`${regime.symbol}-${timeframe}`}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${stateClass(regime.votes[timeframe])}`}
                    >
                      <span>{timeframe}</span>
                      <span>{arrowForState(regime.votes[timeframe])}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {(["ASIA", "LONDON", "NY"] as SessionName[]).map((session) => (
            <button
              key={session}
              type="button"
              onClick={() => setSelectedSession(session)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                selectedSession === session
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)] hover:bg-[var(--panel)]/80 hover:text-[var(--foreground)]"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.14em]">{session}</div>
              <div className="text-[11px]">{sessionWindowLabelEt(session, nowUtc)}</div>
            </button>
          ))}
        </div>
      </header>

      {loading ? <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-sm text-[color:var(--muted)]">Loading crypto matrix...</div> : null}
      {error ? <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <colgroup>
                <col className="w-[18rem]" />
                <col className="w-[7rem]" />
                <col className="w-[5rem]" />
                <col className="w-[5rem]" />
                <col className="w-[5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[4.5rem]" />
                <col className="w-[6rem]" />
                <col className="w-[6rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--panel)] text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
                <tr>
                  <th className="border-b border-r border-[var(--panel-border)] px-3 py-3" rowSpan={2}>Coin</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-slate-500/[0.06] px-3 py-3 text-center" colSpan={4}>Direction</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-amber-500/[0.07] px-3 py-3 text-center" colSpan={3}>Context</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-sky-500/[0.07] px-3 py-3 text-center">Trigger</th>
                  <th className="border-b border-[var(--panel-border)] bg-emerald-500/[0.07] px-3 py-3 text-center">Sizing</th>
                </tr>
                <tr>
                  <th className="border-b border-[var(--panel-border)] bg-slate-500/[0.04] px-3 py-2">Bias</th>
                  <th className="border-b border-[var(--panel-border)] bg-slate-500/[0.04] px-3 py-2">BTC</th>
                  <th className="border-b border-[var(--panel-border)] bg-slate-500/[0.04] px-3 py-2">ETH</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-slate-500/[0.04] px-3 py-2">Alt</th>
                  <th className="border-b border-[var(--panel-border)] bg-amber-500/[0.05] px-3 py-2">OI</th>
                  <th className="border-b border-[var(--panel-border)] bg-amber-500/[0.05] px-3 py-2">Fund</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-amber-500/[0.05] px-3 py-2">Str</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-sky-500/[0.05] px-3 py-2">Trigger</th>
                  <th className="border-b border-[var(--panel-border)] bg-emerald-500/[0.05] px-3 py-2">Sizing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/25">
                {rows.map((row) => {
                  const expanded = expandedRows.includes(row.symbol);
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
                            className="group flex items-center gap-2 text-left"
                          >
                            <span className="inline-flex w-3 justify-center text-[11px] text-[color:var(--muted)]">{expanded ? "▾" : "▸"}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{row.rank > 0 ? `#${row.rank} ${row.symbol}` : row.symbol}</span>
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tierBadgeClass(row.tier)}`}>{row.tier}</span>
                              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted)]">Corr {row.btcCorrelation7d.toFixed(2)}</span>
                            </div>
                          </button>
                        </td>
                        <td className="bg-slate-500/[0.03] px-3 py-2">
                          <span className={`inline-flex min-w-[4.5rem] justify-center rounded border px-2 py-0.5 font-semibold ${biasChipClass(toTrendState(row.bias))}`}>
                            {row.bias}
                          </span>
                        </td>
                        <td className="bg-slate-500/[0.03] px-3 py-2"><span className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.btcVote)}`}>{stateLabel(row.btcVote)}</span></td>
                        <td className="bg-slate-500/[0.03] px-3 py-2"><span className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.ethVote)}`}>{stateLabel(row.ethVote)}</span></td>
                        <td className="border-r border-[var(--panel-border)] bg-slate-500/[0.03] px-3 py-2"><span className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.altTrend)}`}>{stateLabel(row.altTrend)}</span></td>
                        <td className="bg-amber-500/[0.04] px-3 py-2"><span className={`inline-flex min-w-[2.75rem] justify-center rounded border px-2 py-0.5 font-semibold ${oiClass(row.oiDelta24hPct)}`}>{formatOiGlyph(row.oiDelta24hPct)}</span></td>
                        <td className="bg-amber-500/[0.04] px-3 py-2"><span className={`inline-flex min-w-[2.75rem] justify-center rounded border px-2 py-0.5 font-semibold ${fundingClass(row.fundingRate)}`}>{formatFundingGlyph(row.fundingRate)}</span></td>
                        <td className="border-r border-[var(--panel-border)] bg-amber-500/[0.04] px-3 py-2">
                          {row.strengthState === null ? (
                            <span className="inline-flex min-w-[2.75rem] justify-center rounded border border-slate-500/25 bg-slate-500/10 px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-300">—</span>
                          ) : (
                            <span className={`inline-flex min-w-[2.75rem] justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.strengthState)}`}>{formatStrengthChip(row)}</span>
                          )}
                        </td>
                        <td className="border-r border-[var(--panel-border)] bg-sky-500/[0.04] px-3 py-2"><span className="inline-flex min-w-[3.75rem] justify-center rounded border border-slate-500/25 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">{row.trigger}</span></td>
                        <td className="bg-emerald-500/[0.04] px-3 py-2 font-mono text-[var(--foreground)]">{row.sizing}</td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-[var(--panel)]/75">
                          <td colSpan={10} className="px-4 py-3">
                            <div className="grid gap-2 md:grid-cols-3">
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Direction Stack</div>
                                <div className="mt-1">BTC vote {stateLabel(row.btcVote)} | ETH vote {stateLabel(row.ethVote)} | Alt trend {stateLabel(row.altTrend)}</div>
                                <div>Corr to BTC: {row.btcCorrelation7d.toFixed(3)} | Score: {row.compositeScore.toFixed(2)}</div>
                                <div className="mt-1">BTC regime: {data?.regimes.btc.votes.H4 ?? "—"} / {data?.regimes.btc.votes.H1 ?? "—"} / {data?.regimes.btc.votes.M15 ?? "—"}</div>
                                <div>ETH regime: {data?.regimes.eth.votes.H4 ?? "—"} / {data?.regimes.eth.votes.H1 ?? "—"} / {data?.regimes.eth.votes.M15 ?? "—"}</div>
                                {row.altTrendCandle ? (
                                  <div className="mt-1">Alt 4H OHLC: O {row.altTrendCandle.open.toFixed(4)} | H {row.altTrendCandle.high.toFixed(4)} | L {row.altTrendCandle.low.toFixed(4)} | C {row.altTrendCandle.close.toFixed(4)}</div>
                                ) : (
                                  <div className="mt-1">Alt 4H OHLC: unavailable</div>
                                )}
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Context Detail</div>
                                <div className="mt-1">Open interest: {row.openInterest === null ? "—" : row.openInterest.toLocaleString()}</div>
                                <div>OI delta 24h: {formatPct(row.oiDelta24hPct, 2)}</div>
                                <div>Funding: {row.fundingRate === null ? "—" : row.fundingRate.toFixed(6)}</div>
                                <div>Strength 1h / 4h / 24h: {row.strength1h === null ? "—" : row.strength1h.toFixed(1)} / {row.strength4h === null ? "—" : row.strength4h.toFixed(1)} / {row.strength24h === null ? "—" : row.strength24h.toFixed(1)}</div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Trigger</div>
                                <div className="mt-1">Awaiting validation - Stoch+RSI not yet validated on crypto timeframes.</div>
                                <div className="mt-1">Session tabs are workflow buckets only in Phase 1. All rows remain visible across ASIA / LONDON / NY.</div>
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
