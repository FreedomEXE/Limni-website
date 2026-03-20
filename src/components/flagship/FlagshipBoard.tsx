"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import {
  SESSION_ELIGIBILITY,
  defaultSessionFromUtcDate,
  sessionForUtcHour,
  sessionWindowLabelEt,
  type SessionName,
} from "@/lib/flagship/sessionConfig";
import { formatDateTimeET } from "@/lib/time";

type TrendState = "BULLISH" | "BEARISH" | "NEUTRAL";
type GateDecision = "PASS" | "SKIP" | "NO_DATA";
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type MenthorqOverlayCondition = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";

type GatedSetupSignal = {
  assetClass: string;
  pair: string;
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

type MenthorqOverlayRow = {
  symbol: string;
  gammaCondition: MenthorqOverlayCondition;
};

type MenthorqOverlayPayload = {
  rows: MenthorqOverlayRow[];
};

type LiveSizingPairRiskProfile = {
  pair: string;
  trades: number;
  avgReturnPct: number;
  p95MaePct: number;
  noTargetRatePct: number;
  recommendedLotsPer100k: Array<{
    riskBudgetPct: number;
    atrOnly: number;
    conservative: number;
  }>;
};

type LiveSizingPayload = {
  generatedUtc: string | null;
  positionSizingResearch: {
    recommendation: {
      bestModelUnder5PctDrawdown: string | null;
      bestModelUnder10PctDrawdown: string | null;
    };
    pairRiskProfiles: LiveSizingPairRiskProfile[];
  } | null;
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
  base: string;
  quote: string;
  dealer: TrendState;
  commercial: TrendState;
  sentimentDaily: TrendState;
  overlay: TrendState;
  strength1h: TrendState;
  strengthDelta1h: number | null;
  contextView: "CONFIRM" | "MIXED" | "CONFLICT" | "N/A";
  bias: TrendState;
  gate: GateDecision;
  tier: SignalTier;
  sessionEligible: SessionName[];
  gateReasons: string[];
  sizing: number | null;
  triggerLabel: string;
  noTargetRatePct: number | null;
  avgReturnPct: number | null;
  tradeCount: number | null;
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

function biasChipClass(bias: TrendState) {
  if (bias === "BULLISH") return "border-emerald-500/40 bg-emerald-500/14 text-emerald-700 dark:text-emerald-300";
  if (bias === "BEARISH") return "border-rose-500/40 bg-rose-500/14 text-rose-700 dark:text-rose-300";
  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

function rowHighlightClass(bias: TrendState) {
  if (bias === "BULLISH") return "bg-emerald-500/[0.07] hover:bg-emerald-500/[0.13]";
  if (bias === "BEARISH") return "bg-rose-500/[0.07] hover:bg-rose-500/[0.13]";
  return "bg-slate-500/[0.04] hover:bg-slate-500/[0.08]";
}

function deriveOverlayState(
  pairRow: PairUniverseRow,
  signal: GatedSetupSignal | null,
  menthorqBySymbol: Map<string, MenthorqOverlayCondition>,
): TrendState {
  if (pairRow.assetClass === "crypto") {
    if (!signal) return "NEUTRAL";
    const source = String(signal.gateDecisionSource ?? "").toUpperCase();
    if (source.includes("CRYPTO_LIQUIDATION_LIVE")) {
      return directionToState(signal.direction);
    }
    return "NEUTRAL";
  }

  if (pairRow.assetClass === "indices" && pairRow.base === "NIKKEI") {
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

function deriveBias(dealer: TrendState, commercial: TrendState, sentimentDaily: TrendState): TrendState {
  const votes = [dealer, commercial, sentimentDaily];
  const bulls = votes.filter((state) => state === "BULLISH").length;
  const bears = votes.filter((state) => state === "BEARISH").length;
  if (bulls >= 2) return "BULLISH";
  if (bears >= 2) return "BEARISH";
  return "NEUTRAL";
}

function formatLot(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function formatPct(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function decodeReason(reason: string) {
  return String(reason ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function tierRank(tier: SignalTier) {
  if (tier === "HIGH") return 0;
  if (tier === "MEDIUM") return 1;
  return 2;
}

function assetClassRank(assetClass: AssetClass) {
  if (assetClass === "fx") return 0;
  if (assetClass === "commodities") return 1;
  if (assetClass === "indices") return 2;
  return 3;
}

function gateRank(gate: GateDecision) {
  if (gate === "PASS") return 0;
  if (gate === "SKIP") return 1;
  return 2;
}

function deriveContextView(bias: TrendState, overlay: TrendState, strength: TrendState): MatrixRow["contextView"] {
  if (bias === "NEUTRAL") return "N/A";
  const active = [overlay, strength].filter((state) => state !== "NEUTRAL");
  if (active.length === 0) return "MIXED";
  const aligned = active.filter((state) => state === bias).length;
  const opposed = active.filter((state) => state !== bias).length;
  if (aligned > 0 && opposed === 0) return "CONFIRM";
  if (opposed > 0 && aligned === 0) return "CONFLICT";
  return "MIXED";
}

function contextClass(view: MatrixRow["contextView"]) {
  if (view === "CONFIRM") return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (view === "CONFLICT") return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
  if (view === "MIXED") return "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

export default function FlagshipBoard({ strategy }: { strategy: string }) {
  const [gatedData, setGatedData] = useState<GatedSetupsPayload | null>(null);
  const [cotMatrix, setCotMatrix] = useState<CotMatrixPayload | null>(null);
  const [dailySentiment, setDailySentiment] = useState<DailySentimentPayload | null>(null);
  const [currencyStrength, setCurrencyStrength] = useState<CurrencyStrengthPayload | null>(null);
  const [assetStrength, setAssetStrength] = useState<AssetStrengthPayload | null>(null);
  const [menthorqOverlay, setMenthorqOverlay] = useState<MenthorqOverlayPayload | null>(null);
  const [liveSizing, setLiveSizing] = useState<LiveSizingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastRefreshedUtc, setLastRefreshedUtc] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [nowUtc, setNowUtc] = useState<Date>(() => new Date());
  const [selectedSession, setSelectedSession] = useState<SessionName>(() => defaultSessionFromUtcDate(new Date()));
  const [expandedPairs, setExpandedPairs] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowUtc(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchBoardData() {
      try {
        setRefreshing(true);
        setError(null);
        const nextWarnings: string[] = [];

        const [gatedRes, cotRes, sentimentRes, currencyRes, assetRes, overlayRes, sizingRes] = await Promise.allSettled([
          fetch("/api/performance/gated-setups", { cache: "no-store" }),
          fetch("/api/flagship/cot-matrix", { cache: "no-store" }),
          fetch("/api/flagship/sentiment-daily", { cache: "no-store" }),
          fetch("/api/flagship/currency-strength", { cache: "no-store" }),
          fetch("/api/flagship/asset-strength", { cache: "no-store" }),
          fetch("/api/flagship/menthorq-overlay", { cache: "no-store" }),
          fetch("/api/flagship/live-sizing", { cache: "no-store" }),
        ]);

        const readJson = async <T,>(response: PromiseSettledResult<Response>, label: string) => {
          if (response.status === "fulfilled" && response.value.ok) {
            return (await response.value.json()) as T;
          }
          nextWarnings.push(`${label} unavailable`);
          return null;
        };

        const [gatedJson, cotJson, sentimentJson, currencyJson, assetJson, overlayJson, sizingJson] = await Promise.all([
          readJson<GatedSetupsPayload>(gatedRes, "gated-setups"),
          readJson<CotMatrixPayload>(cotRes, "cot-matrix"),
          readJson<DailySentimentPayload>(sentimentRes, "sentiment-daily"),
          readJson<CurrencyStrengthPayload>(currencyRes, "currency-strength"),
          readJson<AssetStrengthPayload>(assetRes, "asset-strength"),
          readJson<MenthorqOverlayPayload>(overlayRes, "menthorq-overlay"),
          readJson<LiveSizingPayload>(sizingRes, "live-sizing"),
        ]);

        if (!cancelled) {
          if (!gatedJson && !cotJson && !sentimentJson) {
            setError("Failed to load matrix sources.");
          }
          setGatedData(gatedJson);
          setCotMatrix(cotJson);
          setDailySentiment(sentimentJson);
          setCurrencyStrength(currencyJson);
          setAssetStrength(assetJson);
          setMenthorqOverlay(overlayJson);
          setLiveSizing(sizingJson);
          setWarnings(nextWarnings);
          setLastRefreshedUtc(new Date().toISOString());
          setLoading(false);
          setRefreshing(false);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
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
    for (const signal of gatedData?.signals ?? []) gatedByPair.set(normalizeKey(signal.pair), signal);

    const cotByPair = new Map<string, CotMatrixRow>();
    for (const row of cotMatrix?.rows ?? []) cotByPair.set(normalizeKey(row.pair), row);

    const sentimentByPair = new Map<string, SignalDirection>();
    for (const row of dailySentiment?.rows ?? []) sentimentByPair.set(normalizeKey(row.symbol), row.sentimentDirection);

    const currencyStrengthMap = new Map<string, number>();
    const currency1h = (currencyStrength?.strengths ?? []).find((row) => row.window === "1h");
    for (const row of currency1h?.strengths ?? []) currencyStrengthMap.set(normalizeKey(row.currency), Number(row.normalized));

    const assetStrengthMap = new Map<string, number>();
    for (const bucket of assetStrength?.strengths ?? []) {
      if (bucket.window !== "1h") continue;
      for (const row of bucket.strengths) {
        assetStrengthMap.set(`${bucket.assetClass}:${normalizeKey(row.asset)}`, Number(row.normalized));
      }
    }

    const menthorqBySymbol = new Map<string, MenthorqOverlayCondition>();
    for (const row of menthorqOverlay?.rows ?? []) menthorqBySymbol.set(normalizeKey(row.symbol), row.gammaCondition);

    const sizingByPair = new Map<string, LiveSizingPairRiskProfile>();
    for (const row of liveSizing?.positionSizingResearch?.pairRiskProfiles ?? []) sizingByPair.set(normalizeKey(row.pair), row);

    return UNIVERSE
      .map((pairRow) => {
        const key = normalizeKey(pairRow.pair);
        const signal = gatedByPair.get(key) ?? null;
        const cot = cotByPair.get(key) ?? null;
        const dealer = directionToState(cot?.dealerDirection ?? "NEUTRAL");
        const commercial = directionToState(cot?.commercialDirection ?? "NEUTRAL");
        const sentimentDaily = directionToState(sentimentByPair.get(key) ?? "NEUTRAL");
        const bias = deriveBias(dealer, commercial, sentimentDaily);
        const sizing = sizingByPair.get(key) ?? null;

        let strengthDelta1h: number | null = null;
        let strength1h: TrendState = "NEUTRAL";
        if (pairRow.assetClass === "fx") {
          const base = currencyStrengthMap.get(normalizeKey(pairRow.base));
          const quote = currencyStrengthMap.get(normalizeKey(pairRow.quote));
          if (base !== undefined && quote !== undefined) {
            strengthDelta1h = Number((base - quote).toFixed(2));
            if (strengthDelta1h >= 5) strength1h = "BULLISH";
            else if (strengthDelta1h <= -5) strength1h = "BEARISH";
          }
        } else if (pairRow.assetClass === "crypto") {
          const score = assetStrengthMap.get(`crypto:${normalizeKey(pairRow.base)}`);
          if (score !== undefined) {
            strengthDelta1h = Number((score - 50).toFixed(2));
            if (score >= 55) strength1h = "BULLISH";
            else if (score <= 45) strength1h = "BEARISH";
          }
        } else if (pairRow.assetClass === "commodities") {
          const score = assetStrengthMap.get(`commodities:${normalizeKey(pairRow.base)}`);
          if (score !== undefined) {
            strengthDelta1h = Number((score - 50).toFixed(2));
            if (score >= 55) strength1h = "BULLISH";
            else if (score <= 45) strength1h = "BEARISH";
          }
        }

        const overlay = deriveOverlayState(pairRow, signal, menthorqBySymbol);
        const contextView = deriveContextView(bias, overlay, strength1h);

        return {
          pair: pairRow.pair,
          assetClass: pairRow.assetClass,
          base: pairRow.base,
          quote: pairRow.quote,
          dealer,
          commercial,
          sentimentDaily,
          overlay,
          strength1h,
          strengthDelta1h,
          contextView,
          bias,
          gate: signal ? normalizeGate(signal.gateDecision) : "NO_DATA",
          tier: normalizeTier(signal?.tier),
          sessionEligible: SESSION_ELIGIBILITY.get(pairRow.pair) ?? ["ASIA", "LONDON", "NY"],
          gateReasons: signal?.gateReasons?.length ? signal.gateReasons : ["NO_WEEKLY_SIGNAL_FOR_PAIR"],
          sizing: null,
          triggerLabel: "TBD",
          noTargetRatePct: sizing?.noTargetRatePct ?? null,
          avgReturnPct: sizing?.avgReturnPct ?? null,
          tradeCount: sizing?.trades ?? null,
        } satisfies MatrixRow;
      })
      .filter((row) => row.sessionEligible.includes(selectedSession))
      .sort((a, b) => {
        const neutralDiff = Number(a.bias === "NEUTRAL") - Number(b.bias === "NEUTRAL");
        if (neutralDiff !== 0) return neutralDiff;
        const assetDiff = assetClassRank(a.assetClass) - assetClassRank(b.assetClass);
        if (assetDiff !== 0) return assetDiff;
        return a.pair.localeCompare(b.pair);
      });
  }, [assetStrength, cotMatrix, currencyStrength, dailySentiment, gatedData, liveSizing, menthorqOverlay, selectedSession]);

  const activeSession = sessionForUtcHour(nowUtc.getUTCHours());
  const directionalCount = matrixRows.filter((row) => row.bias !== "NEUTRAL").length;
  const passCount = matrixRows.filter((row) => row.gate === "PASS").length;
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Matrix</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)] md:text-2xl">Live Session Matrix</h1>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Strategy {strategy}</p>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-right text-xs text-[color:var(--muted)]">
              <div>Data {formatDateTimeET(lastRefreshedUtc ?? gatedData?.generatedUtc ?? null, "Unknown")}</div>
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

      {loading ? <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-sm text-[color:var(--muted)]">Loading matrix...</div> : null}
      {error ? <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</div> : null}
      {!loading && !error ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"><div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)]">Visible Pairs</div><div className="text-lg font-semibold text-[var(--foreground)]">{matrixRows.length}</div></div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"><div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)]">Directional Bias</div><div className="text-lg font-semibold text-[var(--foreground)]">{directionalCount}</div></div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"><div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)]">Gate Pass</div><div className="text-lg font-semibold text-[var(--foreground)]">{passCount}</div></div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"><div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)]">Sizing</div><div className="text-lg font-semibold text-[var(--foreground)]">TBD</div></div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <colgroup>
                <col className="w-[18rem]" />
                <col className="w-[7rem]" />
                <col className="w-[5rem]" />
                <col className="w-[5rem]" />
                <col className="w-[6rem]" />
                <col className="w-[7rem]" />
                <col className="w-[5rem]" />
                <col className="w-[6rem]" />
                <col className="w-[6rem]" />
                <col className="w-[6rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--panel)] text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
                <tr>
                  <th className="border-b border-r border-[var(--panel-border)] px-3 py-3" rowSpan={2}>Pair</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-slate-500/[0.06] px-3 py-3 text-center" colSpan={4}>Core Bias</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-amber-500/[0.07] px-3 py-3 text-center" colSpan={3}>Context</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-sky-500/[0.07] px-3 py-3 text-center" colSpan={1}>Trigger</th>
                  <th className="border-b border-[var(--panel-border)] bg-emerald-500/[0.07] px-3 py-3 text-center" colSpan={1}>Sizing</th>
                </tr>
                <tr>
                  <th className="border-b border-[var(--panel-border)] bg-slate-500/[0.04] px-3 py-2">Bias</th>
                  <th className="border-b border-[var(--panel-border)] bg-slate-500/[0.04] px-3 py-2">Dealer</th>
                  <th className="border-b border-[var(--panel-border)] bg-slate-500/[0.04] px-3 py-2">Commercial</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-slate-500/[0.04] px-3 py-2">Sentiment</th>
                  <th className="border-b border-[var(--panel-border)] bg-amber-500/[0.05] px-3 py-2">Context</th>
                  <th className="border-b border-[var(--panel-border)] bg-amber-500/[0.05] px-3 py-2">Overlay</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-amber-500/[0.05] px-3 py-2">Strength</th>
                  <th className="border-b border-r border-[var(--panel-border)] bg-sky-500/[0.05] px-3 py-2">Trigger</th>
                  <th className="border-b border-[var(--panel-border)] bg-emerald-500/[0.05] px-3 py-2">Sizing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/25">
                {matrixRows.map((row) => {
                  const isExpanded = expandedPairs.includes(row.pair);
                  return (
                    <Fragment key={row.pair}>
                      <tr className={`transition-colors ${rowHighlightClass(row.bias)}`}>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2 font-semibold text-[var(--foreground)]">
                          <button
                            type="button"
                            onClick={() => setExpandedPairs((previous) => previous.includes(row.pair) ? previous.filter((item) => item !== row.pair) : [...previous, row.pair])}
                            className="group flex items-center gap-2 text-left"
                          >
                            <span className="inline-flex w-3 justify-center text-[11px] text-[color:var(--muted)]">{isExpanded ? "▾" : "▸"}</span>
                            <span>{row.pair}</span>
                            <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">{row.assetClass}</span>
                          </button>
                        </td>
                        <td className="bg-slate-500/[0.03] px-3 py-2"><span className={`inline-flex min-w-[4.5rem] justify-center rounded border px-2 py-0.5 font-semibold ${biasChipClass(row.bias)}`}>{row.bias === "BULLISH" ? "LONG" : row.bias === "BEARISH" ? "SHORT" : "NEUTRAL"}</span></td>
                        <td className="bg-slate-500/[0.03] px-3 py-2"><span className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.dealer)}`}>{stateLabel(row.dealer)}</span></td>
                        <td className="bg-slate-500/[0.03] px-3 py-2"><span className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.commercial)}`}>{stateLabel(row.commercial)}</span></td>
                        <td className="border-r border-[var(--panel-border)] bg-slate-500/[0.03] px-3 py-2"><span className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.sentimentDaily)}`}>{stateLabel(row.sentimentDaily)}</span></td>
                        <td className="bg-amber-500/[0.04] px-3 py-2"><span className={`inline-flex min-w-[4.5rem] justify-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${contextClass(row.contextView)}`}>{row.contextView}</span></td>
                        <td className="bg-amber-500/[0.04] px-3 py-2"><span className={`inline-flex w-7 justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.overlay)}`}>{stateLabel(row.overlay)}</span></td>
                        <td className="border-r border-[var(--panel-border)] bg-amber-500/[0.04] px-3 py-2"><span title={row.strengthDelta1h === null ? "No strength data" : `${row.strengthDelta1h > 0 ? "+" : ""}${row.strengthDelta1h}`} className={`inline-flex min-w-[3.5rem] justify-center rounded border px-2 py-0.5 font-semibold ${stateClass(row.strength1h)}`}>{row.strengthDelta1h === null ? "—" : `${row.strengthDelta1h > 0 ? "+" : ""}${row.strengthDelta1h.toFixed(0)}`}</span></td>
                        <td className="border-r border-[var(--panel-border)] bg-sky-500/[0.04] px-3 py-2"><span className="inline-flex min-w-[3.75rem] justify-center rounded border border-slate-500/25 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300">{row.triggerLabel}</span></td>
                        <td className="bg-emerald-500/[0.04] px-3 py-2 font-mono text-[var(--foreground)]">TBD</td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-[var(--panel)]/75">
                          <td colSpan={10} className="px-4 py-3">
                            <div className="grid gap-2 md:grid-cols-3">
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Bias Stack</div>
                                <div className="mt-1">Dealer {row.dealer}, Commercial {row.commercial}, Sentiment {row.sentimentDaily}</div>
                                <div>Overlay {row.overlay}, Strength {row.strength1h}, Context {row.contextView}</div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Sizing</div>
                                <div>Live sizing: TBD</div>
                                <div>Model: TBD</div>
                                <div>Trigger scaffold: {row.triggerLabel}</div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Trade Profile</div>
                                <div>Trades in sample: {row.tradeCount ?? "—"}</div>
                                <div>Avg return: {formatPct(row.avgReturnPct, 2)}</div>
                                <div>No-target rate: {formatPct(row.noTargetRatePct, 2)}</div>
                                <div>Gate: <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${gateClass(row.gate)}`}>{row.gate}</span></div>
                              </div>
                            </div>
                            <div className="mt-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs text-[var(--foreground)]">
                              <div className="font-semibold">Gate Reasons</div>
                              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[color:var(--muted)]">
                                {row.gateReasons.map((reason) => (
                                  <span key={`${row.pair}-${reason}`} className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-2 py-0.5">
                                    {decodeReason(reason)}
                                  </span>
                                ))}
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
