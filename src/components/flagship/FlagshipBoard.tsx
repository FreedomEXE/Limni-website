"use client";

import { useEffect, useMemo, useState } from "react";

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { SESSION_ELIGIBILITY, SESSION_WINDOWS_UTC, defaultSessionFromUtcDate, sessionForUtcHour, type SessionName } from "@/lib/flagship/sessionConfig";
import { formatDateTimeET } from "@/lib/time";

type TrendState = "BULLISH" | "BEARISH" | "NEUTRAL";
type GateDecision = "PASS" | "SKIP" | "NO_DATA";
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";

type GatedSetupSignal = {
  assetClass: string;
  pair: string;
  dealer: string;
  commercial: string;
  direction: SignalDirection;
  tier: SignalTier;
  gateDecision: GateDecision;
  gateReasons: string[];
  gateDecisionSource?: string;
};

type GatedSetupsPayload = {
  generatedUtc: string | null;
  signals: GatedSetupSignal[];
};

type DailySentimentRow = {
  symbol: string;
  sentimentDirection: SignalDirection;
};

type DailySentimentPayload = {
  snapshotDateUtc: string | null;
  rows: DailySentimentRow[];
};

type CurrencyStrengthWindowResult = {
  snapshotTimeUtc: string;
  window: "1h" | "4h" | "24h";
  strengths: Array<{
    currency: string;
    raw: number;
    normalized: number;
  }>;
};

type CurrencyStrengthPayload = {
  strengths: CurrencyStrengthWindowResult[];
};

type AssetStrengthWindowResult = {
  snapshotTimeUtc: string;
  assetClass: "crypto" | "commodities";
  window: "1h" | "4h" | "24h";
  strengths: Array<{
    asset: string;
    raw: number;
    normalized: number;
  }>;
};

type AssetStrengthPayload = {
  strengths: AssetStrengthWindowResult[];
};

type PairUniverseRow = {
  pair: string;
  assetClass: AssetClass;
  base: string;
  quote: string;
};

type MatrixRow = {
  pair: string;
  assetClass: AssetClass;
  tier: SignalTier;
  gate: GateDecision;
  dealer: TrendState;
  commercial: TrendState;
  sentimentDaily: TrendState;
  overlay: TrendState;
  strength1h: TrendState;
  sessionEligible: SessionName[];
};

const UNIVERSE: PairUniverseRow[] = [
  ...PAIRS_BY_ASSET_CLASS.fx.map((pairDef) => ({
    pair: pairDef.pair.toUpperCase(),
    assetClass: "fx" as const,
    base: pairDef.base.toUpperCase(),
    quote: pairDef.quote.toUpperCase(),
  })),
  ...PAIRS_BY_ASSET_CLASS.indices.map((pairDef) => ({
    pair: pairDef.pair.toUpperCase(),
    assetClass: "indices" as const,
    base: pairDef.base.toUpperCase(),
    quote: pairDef.quote.toUpperCase(),
  })),
  ...PAIRS_BY_ASSET_CLASS.crypto.map((pairDef) => ({
    pair: pairDef.pair.toUpperCase(),
    assetClass: "crypto" as const,
    base: pairDef.base.toUpperCase(),
    quote: pairDef.quote.toUpperCase(),
  })),
  ...PAIRS_BY_ASSET_CLASS.commodities.map((pairDef) => ({
    pair: pairDef.pair.toUpperCase(),
    assetClass: "commodities" as const,
    base: pairDef.base.toUpperCase(),
    quote: pairDef.quote.toUpperCase(),
  })),
];

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function directionToState(direction: SignalDirection): TrendState {
  if (direction === "LONG") return "BULLISH";
  if (direction === "SHORT") return "BEARISH";
  return "NEUTRAL";
}

function oppositeState(direction: SignalDirection): TrendState {
  if (direction === "LONG") return "BEARISH";
  if (direction === "SHORT") return "BULLISH";
  return "NEUTRAL";
}

function normalizeTier(value: string | null | undefined): SignalTier {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "HIGH" || normalized === "MEDIUM") return normalized;
  return "NEUTRAL";
}

function normalizeGate(value: string | null | undefined): GateDecision {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "PASS" || normalized === "SKIP" || normalized === "NO_DATA") return normalized;
  return "NO_DATA";
}

function stateClass(state: TrendState) {
  if (state === "BULLISH") return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (state === "BEARISH") return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

function stateLabel(state: TrendState) {
  if (state === "BULLISH") return "B";
  if (state === "BEARISH") return "S";
  return "N";
}

function gateClass(gate: GateDecision) {
  if (gate === "PASS") return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (gate === "SKIP") return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

function deriveOverlayState(signal: GatedSetupSignal | null): TrendState {
  if (!signal) return "NEUTRAL";
  const reasons = (signal.gateReasons ?? []).map((reason) => String(reason).toUpperCase());
  const source = String(signal.gateDecisionSource ?? "").toUpperCase();

  if (signal.assetClass === "crypto") {
    if (source.includes("CRYPTO_LIQUIDATION_LIVE")) {
      if (signal.gateDecision === "PASS") return directionToState(signal.direction);
      if (signal.gateDecision === "SKIP") return oppositeState(signal.direction);
    }
    return "NEUTRAL";
  }

  if (reasons.some((reason) => reason.includes("MENTHORQ_GAMMA_PASS_ALIGNED"))) {
    return directionToState(signal.direction);
  }
  if (reasons.some((reason) => reason.includes("MENTHORQ_GAMMA_SKIP_CONFLICT"))) {
    return oppositeState(signal.direction);
  }
  if (reasons.some((reason) => reason.includes("MENTHORQ_GAMMA_NEUTRAL"))) {
    return "NEUTRAL";
  }
  if (source.includes("MENTHORQ") && signal.gateDecision === "PASS") {
    return directionToState(signal.direction);
  }
  return "NEUTRAL";
}

function getAlignmentCount(row: MatrixRow) {
  const values = [row.dealer, row.commercial, row.sentimentDaily, row.overlay, row.strength1h];
  const bulls = values.filter((state) => state === "BULLISH").length;
  const bears = values.filter((state) => state === "BEARISH").length;
  return Math.max(bulls, bears);
}

function tierRank(tier: SignalTier) {
  if (tier === "HIGH") return 0;
  if (tier === "MEDIUM") return 1;
  return 2;
}

function gateRank(gate: GateDecision) {
  if (gate === "PASS") return 0;
  if (gate === "SKIP") return 1;
  return 2;
}

export default function FlagshipBoard({ strategy }: { strategy: string }) {
  const [gatedData, setGatedData] = useState<GatedSetupsPayload | null>(null);
  const [dailySentiment, setDailySentiment] = useState<DailySentimentPayload | null>(null);
  const [currencyStrength, setCurrencyStrength] = useState<CurrencyStrengthPayload | null>(null);
  const [assetStrength, setAssetStrength] = useState<AssetStrengthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowUtc, setNowUtc] = useState<Date>(() => new Date());
  const [selectedSession, setSelectedSession] = useState<SessionName>(() => defaultSessionFromUtcDate(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setNowUtc(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const current = sessionForUtcHour(nowUtc.getUTCHours());
    if (current) {
      setSelectedSession(current);
    }
  }, [nowUtc]);

  useEffect(() => {
    let cancelled = false;
    async function fetchBoardData() {
      try {
        setLoading(true);
        setError(null);
        const [gatedRes, sentimentRes, currencyRes, assetRes] = await Promise.all([
          fetch("/api/performance/gated-setups", { cache: "no-store" }),
          fetch("/api/flagship/sentiment-daily", { cache: "no-store" }),
          fetch("/api/flagship/currency-strength", { cache: "no-store" }),
          fetch("/api/flagship/asset-strength", { cache: "no-store" }),
        ]);

        if (!gatedRes.ok) throw new Error(`gated-setups HTTP ${gatedRes.status}`);
        if (!sentimentRes.ok) throw new Error(`sentiment-daily HTTP ${sentimentRes.status}`);
        if (!currencyRes.ok) throw new Error(`currency-strength HTTP ${currencyRes.status}`);
        if (!assetRes.ok) throw new Error(`asset-strength HTTP ${assetRes.status}`);

        const [gatedJson, sentimentJson, currencyJson, assetJson] = await Promise.all([
          gatedRes.json() as Promise<GatedSetupsPayload>,
          sentimentRes.json() as Promise<DailySentimentPayload>,
          currencyRes.json() as Promise<CurrencyStrengthPayload>,
          assetRes.json() as Promise<AssetStrengthPayload>,
        ]);

        if (!cancelled) {
          setGatedData(gatedJson);
          setDailySentiment(sentimentJson);
          setCurrencyStrength(currencyJson);
          setAssetStrength(assetJson);
          setLoading(false);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
          setLoading(false);
        }
      }
    }

    fetchBoardData();
    const interval = window.setInterval(fetchBoardData, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const matrixRows = useMemo(() => {
    const gatedByPair = new Map<string, GatedSetupSignal>();
    for (const signal of gatedData?.signals ?? []) {
      gatedByPair.set(normalizeKey(signal.pair), signal);
    }

    const dailySentimentBySymbol = new Map<string, SignalDirection>();
    for (const row of dailySentiment?.rows ?? []) {
      dailySentimentBySymbol.set(normalizeKey(row.symbol), row.sentimentDirection);
    }

    const currency1h = (currencyStrength?.strengths ?? []).find((row) => row.window === "1h");
    const currencyStrengthMap = new Map<string, number>();
    for (const row of currency1h?.strengths ?? []) {
      currencyStrengthMap.set(normalizeKey(row.currency), Number(row.normalized));
    }

    const asset1hMap = new Map<string, number>();
    for (const row of assetStrength?.strengths ?? []) {
      if (row.window !== "1h") continue;
      for (const strengthRow of row.strengths) {
        asset1hMap.set(`${row.assetClass}:${normalizeKey(strengthRow.asset)}`, Number(strengthRow.raw));
      }
    }

    const rows: MatrixRow[] = UNIVERSE.map((pairRow) => {
      const key = normalizeKey(pairRow.pair);
      const signal = gatedByPair.get(key) ?? null;
      const sentimentDirection = dailySentimentBySymbol.get(key) ?? "NEUTRAL";

      let strength1h: TrendState = "NEUTRAL";
      if (pairRow.assetClass === "fx") {
        const base = currencyStrengthMap.get(normalizeKey(pairRow.base));
        const quote = currencyStrengthMap.get(normalizeKey(pairRow.quote));
        if (Number.isFinite(base) && Number.isFinite(quote)) {
          const delta = (base ?? 0) - (quote ?? 0);
          if (delta >= 5) strength1h = "BULLISH";
          else if (delta <= -5) strength1h = "BEARISH";
        }
      } else if (pairRow.assetClass === "crypto") {
        const raw = asset1hMap.get(`crypto:${normalizeKey(pairRow.base)}`);
        if (Number.isFinite(raw) && raw !== undefined) {
          strength1h = raw > 0 ? "BULLISH" : raw < 0 ? "BEARISH" : "NEUTRAL";
        }
      } else if (pairRow.assetClass === "commodities") {
        const raw = asset1hMap.get(`commodities:${normalizeKey(pairRow.base)}`);
        if (Number.isFinite(raw) && raw !== undefined) {
          strength1h = raw > 0 ? "BULLISH" : raw < 0 ? "BEARISH" : "NEUTRAL";
        }
      }

      return {
        pair: pairRow.pair,
        assetClass: pairRow.assetClass,
        tier: normalizeTier(signal?.tier),
        gate: normalizeGate(signal?.gateDecision),
        dealer: directionToState(signal?.dealer as SignalDirection),
        commercial: directionToState(signal?.commercial as SignalDirection),
        sentimentDaily: directionToState(sentimentDirection),
        overlay: deriveOverlayState(signal),
        strength1h,
        sessionEligible: SESSION_ELIGIBILITY.get(pairRow.pair) ?? ["ASIA", "LONDON", "NY"],
      };
    });

    return rows
      .filter((row) => row.sessionEligible.includes(selectedSession))
      .sort((a, b) => {
        const gateDiff = gateRank(a.gate) - gateRank(b.gate);
        if (gateDiff !== 0) return gateDiff;
        const alignDiff = getAlignmentCount(b) - getAlignmentCount(a);
        if (alignDiff !== 0) return alignDiff;
        const tierDiff = tierRank(a.tier) - tierRank(b.tier);
        if (tierDiff !== 0) return tierDiff;
        return a.pair.localeCompare(b.pair);
      });
  }, [assetStrength, currencyStrength, dailySentiment, gatedData, selectedSession]);

  const activeSession = sessionForUtcHour(nowUtc.getUTCHours());
  const passCount = matrixRows.filter((row) => row.gate === "PASS").length;
  const skipCount = matrixRows.filter((row) => row.gate === "SKIP").length;
  const noDataCount = matrixRows.filter((row) => row.gate === "NO_DATA").length;

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Flagship</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)] md:text-2xl">Session Matrix</h1>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Strategy {strategy}</p>
          </div>
          <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-right text-xs text-[color:var(--muted)]">
            <div>Updated {formatDateTimeET(gatedData?.generatedUtc ?? null, "Unknown")}</div>
            <div className="font-semibold">{activeSession ? `Active ${activeSession}` : "Off-hours 21:00-00:00 UTC"}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["ASIA", "LONDON", "NY"] as SessionName[]).map((session) => {
            const isSelected = selectedSession === session;
            return (
              <button
                key={session}
                type="button"
                onClick={() => setSelectedSession(session)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)] hover:bg-[var(--panel)]/80 hover:text-[var(--foreground)]"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em]">{session}</div>
                <div className="text-[11px]">{SESSION_WINDOWS_UTC[session].label}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/55 px-3 py-2 text-[11px] text-[color:var(--muted)]">
          <span className="font-semibold uppercase tracking-[0.12em]">Legend</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">B = Bullish</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/35 bg-rose-500/12 px-2 py-0.5 text-rose-700 dark:text-rose-300">S = Bearish</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/25 bg-slate-500/10 px-2 py-0.5 text-slate-600 dark:text-slate-300">N = Neutral</span>
        </div>
      </header>

      {loading ? (
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-sm text-[color:var(--muted)]">
          Loading matrix...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)]">Visible Pairs</div>
              <div className="text-lg font-semibold text-[var(--foreground)]">{matrixRows.length}</div>
            </div>
            <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Pass</div>
              <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{passCount}</div>
            </div>
            <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-rose-700 dark:text-rose-300">Skip</div>
              <div className="text-lg font-semibold text-rose-700 dark:text-rose-300">{skipCount}</div>
            </div>
            <div className="rounded-lg border border-slate-500/25 bg-slate-500/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">No Data</div>
              <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">{noDataCount}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--panel)] text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
              <tr>
                <th className="px-3 py-2">Pair</th>
                <th className="px-3 py-2">Dealer</th>
                <th className="px-3 py-2">Commercial</th>
                <th className="px-3 py-2">Sent D</th>
                <th className="px-3 py-2">Overlay</th>
                <th className="px-3 py-2">Strength 1h</th>
                <th className="px-3 py-2">Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/25">
              {matrixRows.map((row) => (
                <tr key={row.pair} className="transition-colors hover:bg-[var(--panel)]/70">
                  <td className="px-3 py-2 font-semibold text-[var(--foreground)]">
                    {row.pair}
                    <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
                      {row.assetClass}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.dealer} className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.dealer)}`}>
                      {stateLabel(row.dealer)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.commercial} className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.commercial)}`}>
                      {stateLabel(row.commercial)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.sentimentDaily} className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.sentimentDaily)}`}>
                      {stateLabel(row.sentimentDaily)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.overlay} className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.overlay)}`}>
                      {stateLabel(row.overlay)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.strength1h} className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.strength1h)}`}>
                      {stateLabel(row.strength1h)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${gateClass(row.gate)}`}>
                      {row.gate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      ) : null}
    </section>
  );
}
