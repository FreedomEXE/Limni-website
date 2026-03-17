"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type CotMatrixRow = {
  pair: string;
  dealerDirection: SignalDirection;
  commercialDirection: SignalDirection;
};

type CotMatrixPayload = {
  generatedUtc: string | null;
  rows: CotMatrixRow[];
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

type MenthorqOverlayCondition = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";

type MenthorqOverlayRow = {
  symbol: string;
  gammaCondition: MenthorqOverlayCondition;
};

type MenthorqOverlayPayload = {
  rows: MenthorqOverlayRow[];
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
  gateReasons: string[];
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

const CURRENCY_MENTHORQ_SYMBOL: Record<string, string> = {
  EUR: "6E",
  GBP: "6B",
  JPY: "6J",
  AUD: "6A",
  CHF: "6S",
  CAD: "6C",
  // MenthorQ trial coverage fallback: proxy NZD with AUD futures.
  NZD: "6A",
};

const ASSET_MENTHORQ_SYMBOL: Record<string, string> = {
  SPX: "ES",
  NDX: "NQ",
  XAU: "GC",
  XAG: "SI",
  WTI: "CL",
};

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function directionToState(direction: SignalDirection): TrendState {
  if (direction === "LONG") return "BULLISH";
  if (direction === "SHORT") return "BEARISH";
  return "NEUTRAL";
}

function conditionToState(condition: MenthorqOverlayCondition | null | undefined): TrendState {
  if (condition === "POSITIVE") return "BULLISH";
  if (condition === "NEGATIVE") return "BEARISH";
  return "NEUTRAL";
}

function invertState(state: TrendState): TrendState {
  if (state === "BULLISH") return "BEARISH";
  if (state === "BEARISH") return "BULLISH";
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

function formatGateTooltip(gate: GateDecision, reasons: string[]) {
  const prettyReasons = reasons
    .map((reason) =>
      String(reason)
        .trim()
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .toUpperCase(),
    )
    .filter(Boolean);
  if (prettyReasons.length === 0) return gate;
  return `${gate}: ${prettyReasons.join(" | ")}`;
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

function deriveMenthorqOverlayForPair(
  pairRow: PairUniverseRow,
  menthorqBySymbol: Map<string, MenthorqOverlayCondition>,
): TrendState {
  if (pairRow.assetClass === "crypto") return "NEUTRAL";

  if (pairRow.assetClass === "indices" && pairRow.base === "NIKKEI") {
    // Nikkei proxy: invert JPY futures condition.
    return invertState(conditionToState(menthorqBySymbol.get("6J")));
  }

  if (pairRow.assetClass === "indices" || pairRow.assetClass === "commodities") {
    const symbol = ASSET_MENTHORQ_SYMBOL[pairRow.base];
    return conditionToState(symbol ? menthorqBySymbol.get(symbol) : "UNKNOWN");
  }

  const baseSymbol = CURRENCY_MENTHORQ_SYMBOL[pairRow.base];
  const quoteSymbol = CURRENCY_MENTHORQ_SYMBOL[pairRow.quote];
  const baseState = conditionToState(baseSymbol ? menthorqBySymbol.get(baseSymbol) : "UNKNOWN");
  const quoteState = conditionToState(quoteSymbol ? menthorqBySymbol.get(quoteSymbol) : "UNKNOWN");

  if (baseState === "NEUTRAL" && quoteState === "NEUTRAL") return "NEUTRAL";
  if (baseState !== "NEUTRAL" && quoteState === "NEUTRAL") return baseState;
  if (baseState === "NEUTRAL" && quoteState !== "NEUTRAL") {
    return quoteState === "BULLISH" ? "BEARISH" : "BULLISH";
  }
  if (baseState === quoteState) return "NEUTRAL";
  if (baseState === "BULLISH" && quoteState === "BEARISH") return "BULLISH";
  if (baseState === "BEARISH" && quoteState === "BULLISH") return "BEARISH";
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

function rowDirectionalScore(row: MatrixRow) {
  const values = [row.dealer, row.commercial, row.sentimentDaily, row.overlay];
  return values.reduce((acc, state) => {
    if (state === "BULLISH") return acc + 1;
    if (state === "BEARISH") return acc - 1;
    return acc;
  }, 0);
}

function rowHighlightClass(row: MatrixRow) {
  const score = rowDirectionalScore(row);
  if (score > 0) return "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.11]";
  if (score < 0) return "bg-rose-500/[0.06] hover:bg-rose-500/[0.11]";
  return "bg-slate-500/[0.04] hover:bg-slate-500/[0.1]";
}

export default function FlagshipBoard({ strategy }: { strategy: string }) {
  const [gatedData, setGatedData] = useState<GatedSetupsPayload | null>(null);
  const [cotMatrix, setCotMatrix] = useState<CotMatrixPayload | null>(null);
  const [dailySentiment, setDailySentiment] = useState<DailySentimentPayload | null>(null);
  const [currencyStrength, setCurrencyStrength] = useState<CurrencyStrengthPayload | null>(null);
  const [assetStrength, setAssetStrength] = useState<AssetStrengthPayload | null>(null);
  const [menthorqOverlay, setMenthorqOverlay] = useState<MenthorqOverlayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const hasGatedDataRef = useRef(false);
  const [lastRefreshedUtc, setLastRefreshedUtc] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [nowUtc, setNowUtc] = useState<Date>(() => new Date());
  const [selectedSession, setSelectedSession] = useState<SessionName>(() => defaultSessionFromUtcDate(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setNowUtc(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchBoardData() {
      try {
        setRefreshing(true);
        const nextWarnings: string[] = [];
        setError(null);

        const [gatedRes, cotRes, sentimentRes, currencyRes, assetRes, menthorqRes] = await Promise.allSettled([
          fetch("/api/performance/gated-setups", { cache: "no-store" }),
          fetch("/api/flagship/cot-matrix", { cache: "no-store" }),
          fetch("/api/flagship/sentiment-daily", { cache: "no-store" }),
          fetch("/api/flagship/currency-strength", { cache: "no-store" }),
          fetch("/api/flagship/asset-strength", { cache: "no-store" }),
          fetch("/api/flagship/menthorq-overlay", { cache: "no-store" }),
        ]);

        let gatedJson: GatedSetupsPayload | null = null;
        let cotJson: CotMatrixPayload | null = null;
        let sentimentJson: DailySentimentPayload | null = null;
        let currencyJson: CurrencyStrengthPayload | null = null;
        let assetJson: AssetStrengthPayload | null = null;
        let menthorqJson: MenthorqOverlayPayload | null = null;

        if (gatedRes.status === "fulfilled") {
          if (gatedRes.value.ok) {
            gatedJson = (await gatedRes.value.json()) as GatedSetupsPayload;
          } else {
            nextWarnings.push(`gated-setups HTTP ${gatedRes.value.status}`);
          }
        } else {
          nextWarnings.push("gated-setups request failed");
        }

        if (cotRes.status === "fulfilled") {
          if (cotRes.value.ok) {
            cotJson = (await cotRes.value.json()) as CotMatrixPayload;
          } else {
            nextWarnings.push(`cot-matrix HTTP ${cotRes.value.status}`);
          }
        } else {
          nextWarnings.push("cot-matrix request failed");
        }

        if (sentimentRes.status === "fulfilled") {
          if (sentimentRes.value.ok) {
            sentimentJson = (await sentimentRes.value.json()) as DailySentimentPayload;
          } else {
            nextWarnings.push(`sentiment-daily HTTP ${sentimentRes.value.status}`);
          }
        } else {
          nextWarnings.push("sentiment-daily request failed");
        }

        if (currencyRes.status === "fulfilled") {
          if (currencyRes.value.ok) {
            currencyJson = (await currencyRes.value.json()) as CurrencyStrengthPayload;
          } else {
            nextWarnings.push(`currency-strength HTTP ${currencyRes.value.status}`);
          }
        } else {
          nextWarnings.push("currency-strength request failed");
        }

        if (assetRes.status === "fulfilled") {
          if (assetRes.value.ok) {
            assetJson = (await assetRes.value.json()) as AssetStrengthPayload;
          } else {
            nextWarnings.push(`asset-strength HTTP ${assetRes.value.status}`);
          }
        } else {
          nextWarnings.push("asset-strength request failed");
        }

        if (menthorqRes.status === "fulfilled") {
          if (menthorqRes.value.ok) {
            menthorqJson = (await menthorqRes.value.json()) as MenthorqOverlayPayload;
          } else {
            nextWarnings.push(`menthorq-overlay HTTP ${menthorqRes.value.status}`);
          }
        } else {
          nextWarnings.push("menthorq-overlay request failed");
        }

        if (!cancelled) {
          if (gatedJson) {
            setGatedData(gatedJson);
            hasGatedDataRef.current = true;
          } else if (!hasGatedDataRef.current) {
            setError("Failed to load gated setups.");
          }
          if (cotJson) setCotMatrix(cotJson);
          if (sentimentJson) setDailySentiment(sentimentJson);
          if (currencyJson) setCurrencyStrength(currencyJson);
          if (assetJson) setAssetStrength(assetJson);
          if (menthorqJson) setMenthorqOverlay(menthorqJson);
          setWarnings(nextWarnings);
          setLoading(false);
          setRefreshing(false);
          setLastRefreshedUtc(new Date().toISOString());
        }
      } catch (fetchError) {
        if (!cancelled) {
          if (!hasGatedDataRef.current) {
            setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
          } else {
            setWarnings((prev) => [...prev, fetchError instanceof Error ? fetchError.message : String(fetchError)]);
          }
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    fetchBoardData();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const matrixRows = useMemo(() => {
    const gatedByPair = new Map<string, GatedSetupSignal>();
    for (const signal of gatedData?.signals ?? []) {
      gatedByPair.set(normalizeKey(signal.pair), signal);
    }
    const cotByPair = new Map<string, CotMatrixRow>();
    for (const row of cotMatrix?.rows ?? []) {
      cotByPair.set(normalizeKey(row.pair), row);
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

    const menthorqBySymbol = new Map<string, MenthorqOverlayCondition>();
    for (const row of menthorqOverlay?.rows ?? []) {
      menthorqBySymbol.set(normalizeKey(row.symbol), row.gammaCondition);
    }

    const rows: MatrixRow[] = UNIVERSE.map((pairRow) => {
      const key = normalizeKey(pairRow.pair);
      const signal = gatedByPair.get(key) ?? null;
      const cotSignal = cotByPair.get(key) ?? null;
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

      const menthorqOverlayState = deriveMenthorqOverlayForPair(pairRow, menthorqBySymbol);

      return {
        pair: pairRow.pair,
        assetClass: pairRow.assetClass,
        tier: normalizeTier(signal?.tier),
        gate: signal ? normalizeGate(signal.gateDecision) : "NO_DATA",
        dealer: directionToState(cotSignal?.dealerDirection ?? "NEUTRAL"),
        commercial: directionToState(cotSignal?.commercialDirection ?? "NEUTRAL"),
        sentimentDaily: directionToState(sentimentDirection),
        overlay: menthorqOverlayState !== "NEUTRAL" ? menthorqOverlayState : deriveOverlayState(signal),
        strength1h,
        sessionEligible: SESSION_ELIGIBILITY.get(pairRow.pair) ?? ["ASIA", "LONDON", "NY"],
        gateReasons: signal?.gateReasons?.length ? signal.gateReasons : ["NO_WEEKLY_SIGNAL_FOR_PAIR"],
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
  }, [assetStrength, cotMatrix, currencyStrength, dailySentiment, gatedData, menthorqOverlay, selectedSession]);

  const activeSession = sessionForUtcHour(nowUtc.getUTCHours());
  const passCount = matrixRows.filter((row) => row.gate === "PASS").length;
  const skipCount = matrixRows.filter((row) => row.gate === "SKIP").length;
  const noDataCount = matrixRows.filter((row) => row.gate === "NO_DATA").length;

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Matrix</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)] md:text-2xl">Session Matrix</h1>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Strategy {strategy}</p>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-right text-xs text-[color:var(--muted)]">
              <div>Data {formatDateTimeET(lastRefreshedUtc ?? gatedData?.generatedUtc ?? null, "Unknown")}</div>
              <div className="font-semibold">{activeSession ? `Active ${activeSession}` : "Off-hours 21:00-00:00 UTC"}</div>
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

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          Data warnings: {warnings.join(" | ")}
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
                <th className="px-3 py-2">Sentiment</th>
                <th className="px-3 py-2">Overlay</th>
                <th className="px-3 py-2">Strength 1h</th>
                <th className="px-3 py-2">Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/25">
              {matrixRows.map((row) => (
                <tr key={row.pair} className={`transition-colors ${rowHighlightClass(row)}`}>
                  <td className="px-3 py-2 font-semibold text-[var(--foreground)]">
                    {row.pair}
                    <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
                      {row.assetClass}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.dealer} className={`inline-flex w-7 cursor-help justify-center rounded border px-2 py-0.5 font-semibold transition-colors hover:brightness-110 ${stateClass(row.dealer)}`}>
                      {stateLabel(row.dealer)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.commercial} className={`inline-flex w-7 cursor-help justify-center rounded border px-2 py-0.5 font-semibold transition-colors hover:brightness-110 ${stateClass(row.commercial)}`}>
                      {stateLabel(row.commercial)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.sentimentDaily} className={`inline-flex w-7 cursor-help justify-center rounded border px-2 py-0.5 font-semibold transition-colors hover:brightness-110 ${stateClass(row.sentimentDaily)}`}>
                      {stateLabel(row.sentimentDaily)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.overlay} className={`inline-flex w-7 cursor-help justify-center rounded border px-2 py-0.5 font-semibold transition-colors hover:brightness-110 ${stateClass(row.overlay)}`}>
                      {stateLabel(row.overlay)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span title={row.strength1h} className={`inline-flex w-7 cursor-help justify-center rounded border px-2 py-0.5 font-semibold transition-colors hover:brightness-110 ${stateClass(row.strength1h)}`}>
                      {stateLabel(row.strength1h)}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span
                      title={formatGateTooltip(row.gate, row.gateReasons)}
                      className={`inline-flex cursor-help rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors hover:brightness-110 ${gateClass(row.gate)}`}
                    >
                      {row.gate}
                    </span>
                  </td>
                </tr>
              ))}
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
