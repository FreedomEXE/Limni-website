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
import {
  biasChipClass,
  contextClass,
  formatPct,
  gateClass,
  rowHighlightClass,
  stateClass,
  stateLabel,
  type MatrixContextView,
  type MatrixGateDecision,
  type MatrixTrendState,
} from "@/lib/flagship/matrixStyles";
import { formatDateTimeET } from "@/lib/time";

type TrendState = MatrixTrendState;
type GateDecision = MatrixGateDecision;
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type MenthorqOverlayCondition = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";
type TriggerState = "HIT" | "CLOSE" | "WATCHING" | "NO_DATA" | "INACTIVE";

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
  noTargetRatePct: number;
};

type LiveSizingPayload = {
  generatedUtc: string | null;
  positionSizingResearch: {
    pairRiskProfiles: LiveSizingPairRiskProfile[];
  } | null;
};

type PriceMoveRow = {
  pair: string;
  change24hPct: number | null;
};

type PriceMovesPayload = {
  generatedUtc: string | null;
  rows: PriceMoveRow[];
};

type IntradayLevelRow = {
  pair: string;
  assetClass: AssetClass;
  adrPct: number | null;
  adrBarsUsed: number;
  adrMultiplier: number;
  weekOpenUtc: string;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  oneAdrLongTriggerPrice: number | null;
  oneAdrShortTriggerPrice: number | null;
  longTouched: boolean;
  shortTouched: boolean;
  oneAdrLongTouched: boolean;
  oneAdrShortTouched: boolean;
};

type IntradayLevelsPayload = {
  generatedUtc: string | null;
  rows: IntradayLevelRow[];
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
  dealer: TrendState;
  commercial: TrendState;
  sentimentDaily: TrendState;
  overlay: TrendState;
  strength1h: TrendState;
  strengthDelta1h: number | null;
  coreBias: SignalDirection;
  coreBiasState: TrendState;
  gammaState: MatrixContextView;
  gate: GateDecision;
  tier: SignalTier;
  sessionEligible: SessionName[];
  gateReasons: string[];
  cotGateAgree: boolean;
  menthorqAgree: boolean;
  strengthAgree: boolean;
  tradeCount: number | null;
  avgReturnPct: number | null;
  noTargetRatePct: number | null;
  move24hPct: number | null;
  adrPct: number | null;
  adrBarsUsed: number;
  adrMultiplier: number | null;
  weekOpenUtc: string | null;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  oneAdrLongTriggerPrice: number | null;
  oneAdrShortTriggerPrice: number | null;
  touched: boolean;
  oneAdrTouched: boolean;
  triggerState: TriggerState;
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

function directionLabel(direction: SignalDirection) {
  if (direction === "LONG") return "Long";
  if (direction === "SHORT") return "Short";
  return "Neutral";
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

function deriveOverlayState(
  pairRow: PairUniverseRow,
  signal: GatedSetupSignal | null,
  menthorqBySymbol: Map<string, MenthorqOverlayCondition>,
): TrendState {
  if (pairRow.assetClass === "crypto") {
    if (!signal) return "NEUTRAL";
    const source = String(signal.gateDecisionSource ?? "").toUpperCase();
    if (source.includes("CRYPTO_LIQUIDATION_LIVE")) return directionToState(signal.direction);
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

function decodeReason(reason: string) {
  return String(reason ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function formatMove(change24hPct: number | null) {
  if (change24hPct === null || !Number.isFinite(change24hPct)) return "—";
  return `${change24hPct > 0 ? "+" : ""}${change24hPct.toFixed(1)}%`;
}

function moveClass(change24hPct: number | null) {
  if (change24hPct === null || !Number.isFinite(change24hPct)) return "text-[color:var(--muted)]";
  if (change24hPct > 0) return "text-emerald-700 dark:text-emerald-300";
  if (change24hPct < 0) return "text-rose-700 dark:text-rose-300";
  return "text-[color:var(--muted)]";
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return value.toFixed(2);
  if (Math.abs(value) >= 100) return value.toFixed(3);
  if (Math.abs(value) >= 1) return value.toFixed(4);
  return value.toFixed(5);
}

function triggerClass(state: TriggerState, flashing: boolean) {
  const base = "inline-flex min-w-[5.25rem] justify-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]";
  if (state === "HIT") return `${base} border-amber-400/40 bg-amber-500/15 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300 ${flashing ? "intraday-adr-pulse" : ""}`;
  if (state === "CLOSE") return `${base} border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300`;
  if (state === "WATCHING") return `${base} border-sky-400/30 bg-sky-500/10 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300`;
  return `${base} border-[var(--panel-border)] bg-[var(--panel)]/60 text-[color:var(--muted)]`;
}

function sortBucket(row: MatrixRow) {
  if (row.coreBias === "NEUTRAL") return 2;
  if (row.oneAdrTouched) return 0;
  return 1;
}

export default function FlagshipBoard({ strategy }: { strategy: string }) {
  const [gatedData, setGatedData] = useState<GatedSetupsPayload | null>(null);
  const [cotMatrix, setCotMatrix] = useState<CotMatrixPayload | null>(null);
  const [dailySentiment, setDailySentiment] = useState<DailySentimentPayload | null>(null);
  const [currencyStrength, setCurrencyStrength] = useState<CurrencyStrengthPayload | null>(null);
  const [assetStrength, setAssetStrength] = useState<AssetStrengthPayload | null>(null);
  const [menthorqOverlay, setMenthorqOverlay] = useState<MenthorqOverlayPayload | null>(null);
  const [liveSizing, setLiveSizing] = useState<LiveSizingPayload | null>(null);
  const [priceMoves, setPriceMoves] = useState<PriceMovesPayload | null>(null);
  const [intradayLevels, setIntradayLevels] = useState<IntradayLevelsPayload | null>(null);
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
        const responses = await Promise.allSettled([
          fetch("/api/performance/gated-setups", { cache: "no-store" }),
          fetch("/api/flagship/cot-matrix", { cache: "no-store" }),
          fetch("/api/flagship/sentiment-daily", { cache: "no-store" }),
          fetch("/api/flagship/currency-strength", { cache: "no-store" }),
          fetch("/api/flagship/asset-strength", { cache: "no-store" }),
          fetch("/api/flagship/menthorq-overlay", { cache: "no-store" }),
          fetch("/api/flagship/live-sizing", { cache: "no-store" }),
          fetch("/api/flagship/price-moves", { cache: "no-store" }),
          fetch("/api/flagship/intraday-levels", { cache: "no-store" }),
        ]);

        const readJson = async <T,>(response: PromiseSettledResult<Response>, label: string) => {
          if (response.status === "fulfilled" && response.value.ok) return (await response.value.json()) as T;
          nextWarnings.push(`${label} unavailable`);
          return null;
        };

        const [gatedJson, cotJson, sentimentJson, currencyJson, assetJson, overlayJson, sizingJson, movesJson, intradayJson] = await Promise.all([
          readJson<GatedSetupsPayload>(responses[0], "gated-setups"),
          readJson<CotMatrixPayload>(responses[1], "cot-matrix"),
          readJson<DailySentimentPayload>(responses[2], "sentiment-daily"),
          readJson<CurrencyStrengthPayload>(responses[3], "currency-strength"),
          readJson<AssetStrengthPayload>(responses[4], "asset-strength"),
          readJson<MenthorqOverlayPayload>(responses[5], "menthorq-overlay"),
          readJson<LiveSizingPayload>(responses[6], "live-sizing"),
          readJson<PriceMovesPayload>(responses[7], "price-moves"),
          readJson<IntradayLevelsPayload>(responses[8], "intraday-levels"),
        ]);

        if (!cancelled) {
          if (!gatedJson && !cotJson && !sentimentJson) setError("Failed to load matrix sources.");
          setGatedData(gatedJson);
          setCotMatrix(cotJson);
          setDailySentiment(sentimentJson);
          setCurrencyStrength(currencyJson);
          setAssetStrength(assetJson);
          setMenthorqOverlay(overlayJson);
          setLiveSizing(sizingJson);
          setPriceMoves(movesJson);
          setIntradayLevels(intradayJson);
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

    const moveByPair = new Map<string, number | null>();
    for (const row of priceMoves?.rows ?? []) moveByPair.set(normalizeKey(row.pair), row.change24hPct);

    const levelsByPair = new Map<string, IntradayLevelRow>();
    for (const row of intradayLevels?.rows ?? []) levelsByPair.set(normalizeKey(row.pair), row);

    return UNIVERSE
      .map((pairRow) => {
        const key = normalizeKey(pairRow.pair);
        const signal = gatedByPair.get(key) ?? null;
        const level = levelsByPair.get(key) ?? null;
        const cot = cotByPair.get(key) ?? null;
        const dealer = directionToState(cot?.dealerDirection ?? "NEUTRAL");
        const commercial = directionToState(cot?.commercialDirection ?? "NEUTRAL");
        const sentimentDaily = directionToState(sentimentByPair.get(key) ?? "NEUTRAL");
        const coreBias = signal?.direction ?? "NEUTRAL";
        const coreBiasState = directionToState(coreBias);
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
        const cotGateAgree = coreBias !== "NEUTRAL" && normalizeGate(signal?.gateDecision) === "PASS";
        const menthorqAgree = coreBias !== "NEUTRAL" && overlay === coreBiasState;
        const strengthAgree = coreBias !== "NEUTRAL" && strength1h === coreBiasState;
        const agreeCount = [cotGateAgree, menthorqAgree, strengthAgree].filter(Boolean).length;
        const gammaState: MatrixContextView =
          coreBias === "NEUTRAL"
            ? "N/A"
            : agreeCount >= 2
              ? "CONFIRM"
              : agreeCount === 1
                ? "MIXED"
                : "CONFLICT";

        const touched = coreBias === "LONG" ? (level?.longTouched ?? false) : coreBias === "SHORT" ? (level?.shortTouched ?? false) : false;
        const oneAdrTouched = coreBias === "LONG" ? (level?.oneAdrLongTouched ?? false) : coreBias === "SHORT" ? (level?.oneAdrShortTouched ?? false) : false;

        let triggerState: TriggerState = "INACTIVE";
        if (coreBias !== "NEUTRAL") {
          if (!level || level.adrPct === null) triggerState = "NO_DATA";
          else if (oneAdrTouched) triggerState = "HIT";
          else if (touched) triggerState = "CLOSE";
          else triggerState = "WATCHING";
        }

        return {
          pair: pairRow.pair,
          assetClass: pairRow.assetClass,
          dealer,
          commercial,
          sentimentDaily,
          overlay,
          strength1h,
          strengthDelta1h,
          coreBias,
          coreBiasState,
          gammaState,
          gate: signal ? normalizeGate(signal.gateDecision) : "NO_DATA",
          tier: normalizeTier(signal?.tier),
          sessionEligible: SESSION_ELIGIBILITY.get(pairRow.pair) ?? ["ASIA", "LONDON", "NY"],
          gateReasons: signal?.gateReasons?.length ? signal.gateReasons : ["NO_WEEKLY_SIGNAL_FOR_PAIR"],
          cotGateAgree,
          menthorqAgree,
          strengthAgree,
          tradeCount: sizing?.trades ?? null,
          avgReturnPct: sizing?.avgReturnPct ?? null,
          noTargetRatePct: sizing?.noTargetRatePct ?? null,
          move24hPct: moveByPair.get(key) ?? null,
          adrPct: level?.adrPct ?? null,
          adrBarsUsed: level?.adrBarsUsed ?? 0,
          adrMultiplier: level?.adrMultiplier ?? null,
          weekOpenUtc: level?.weekOpenUtc ?? null,
          weekOpenPrice: level?.weekOpenPrice ?? null,
          weekHighPrice: level?.weekHighPrice ?? null,
          weekLowPrice: level?.weekLowPrice ?? null,
          currentPrice: level?.currentPrice ?? null,
          longTriggerPrice: level?.longTriggerPrice ?? null,
          shortTriggerPrice: level?.shortTriggerPrice ?? null,
          oneAdrLongTriggerPrice: level?.oneAdrLongTriggerPrice ?? null,
          oneAdrShortTriggerPrice: level?.oneAdrShortTriggerPrice ?? null,
          touched,
          oneAdrTouched,
          triggerState,
        } satisfies MatrixRow;
      })
      .filter((row) => row.sessionEligible.includes(selectedSession))
      .sort((left, right) => {
        const bucketDiff = sortBucket(left) - sortBucket(right);
        if (bucketDiff !== 0) return bucketDiff;
        return left.pair.localeCompare(right.pair);
      });
  }, [assetStrength, cotMatrix, currencyStrength, dailySentiment, gatedData, intradayLevels, liveSizing, menthorqOverlay, priceMoves, selectedSession]);

  const qualifiedCount = matrixRows.filter((row) => row.coreBias !== "NEUTRAL").length;
  const adrHitCount = matrixRows.filter((row) => row.triggerState === "HIT").length;
  const closeCount = matrixRows.filter((row) => row.triggerState === "CLOSE").length;
  const neutralCount = matrixRows.filter((row) => row.coreBias === "NEUTRAL").length;
  const activeSession = sessionForUtcHour(nowUtc.getUTCHours());

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Matrix</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)] md:text-2xl">CFD Matrix</h1>
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

        {!loading && !error ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/55 px-3 py-2 text-[11px] text-[color:var(--muted)]">
            <span className="font-semibold uppercase tracking-[0.12em]">{selectedSession}</span>
            <span>Qualified {qualifiedCount}</span>
            <span>ADR Hit {adrHitCount}</span>
            <span>Close {closeCount}</span>
            <span>Neutral {neutralCount}</span>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
            Partial data: {warnings.join(" · ")}
          </div>
        ) : null}
      </header>

      {loading ? <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-sm text-[color:var(--muted)]">Loading matrix...</div> : null}
      {error ? <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
            <table className="min-w-full border-separate border-spacing-0 text-xs">
              <colgroup>
                <col className="w-[25rem]" />
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
                {matrixRows.map((row) => {
                  const isExpanded = expandedPairs.includes(row.pair);
                  return (
                    <Fragment key={row.pair}>
                      <tr className={`transition-colors ${rowHighlightClass(row.coreBiasState)}`}>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2 font-semibold text-[var(--foreground)]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPairs((previous) =>
                                previous.includes(row.pair)
                                  ? previous.filter((item) => item !== row.pair)
                                  : [...previous, row.pair],
                              )
                            }
                            className="group flex w-full items-start gap-2 text-left"
                          >
                            <span className="mt-0.5 inline-flex w-3 justify-center text-[11px] text-[color:var(--muted)]">{isExpanded ? "▾" : "▸"}</span>
                            <span className="space-y-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span>{row.pair}</span>
                                <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">{row.assetClass}</span>
                                <span className={`text-[10px] font-medium uppercase tracking-[0.08em] ${moveClass(row.move24hPct)}`}>{formatMove(row.move24hPct)}</span>
                              </span>
                              {row.coreBias !== "NEUTRAL" && row.tier !== "NEUTRAL" ? (
                                <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">{row.tier} tier</span>
                              ) : null}
                            </span>
                          </button>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="space-y-1">
                            <span className={`inline-flex min-w-[5rem] justify-center rounded border px-2 py-0.5 font-semibold ${biasChipClass(row.coreBiasState)}`}>
                              {directionLabel(row.coreBias)}
                            </span>
                            {row.coreBias !== "NEUTRAL" ? (
                              <div className={`text-[10px] font-medium uppercase tracking-[0.08em] ${gateClass(row.gate)}`}>
                                {row.gate === "NO_DATA" ? "No Data" : row.gate}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="space-y-1">
                            <span className={`inline-flex min-w-[5.5rem] justify-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${contextClass(row.gammaState)}`}>
                              {row.gammaState}
                            </span>
                            {row.coreBias !== "NEUTRAL" ? (
                              <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                                {[row.cotGateAgree, row.menthorqAgree, row.strengthAgree].filter(Boolean).length}/3 agree
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="space-y-1">
                            <span className={triggerClass(row.triggerState, row.oneAdrTouched)}>
                              {row.triggerState === "INACTIVE" ? "—" : row.triggerState === "NO_DATA" ? "No Data" : row.triggerState}
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
                      {isExpanded ? (
                        <tr className="bg-[var(--panel)]/75">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid gap-2 lg:grid-cols-4">
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Core Bias Detail</div>
                                <div className="mt-1">Dealer {row.dealer} · Commercial {row.commercial} · Sentiment {row.sentimentDaily}</div>
                                <div>Weekly call: {directionLabel(row.coreBias)} {row.tier !== "NEUTRAL" ? `· ${row.tier}` : ""}</div>
                                <div>Gate: <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${gateClass(row.gate)}`}>{row.gate}</span></div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Gamma Detail</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${row.cotGateAgree ? gateClass("PASS") : gateClass("SKIP")}`}>{row.cotGateAgree ? "COT Agree" : "COT Miss"}</span>
                                  <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${row.menthorqAgree ? gateClass("PASS") : gateClass("SKIP")}`}>{row.menthorqAgree ? "MenthorQ Agree" : "MenthorQ Miss"}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${row.strengthAgree ? gateClass("PASS") : gateClass("SKIP")}`}>{row.strengthAgree ? "Strength Agree" : "Strength Miss"}</span>
                                  <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${stateClass(row.overlay)}`}>Overlay {stateLabel(row.overlay)}</span>
                                  <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${stateClass(row.strength1h)}`}>Str {row.strengthDelta1h === null ? "—" : row.strengthDelta1h.toFixed(0)}</span>
                                </div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">ADR Trigger</div>
                                <div className="mt-1">ADR {formatPct(row.adrPct, 2)} · Bars {row.adrBarsUsed || "—"} · Mult {row.adrMultiplier ?? "—"}</div>
                                <div>Week open {formatDateTimeET(row.weekOpenUtc, "Unknown")} @ {formatPrice(row.weekOpenPrice)}</div>
                                <div>Long trigger {formatPrice(row.longTriggerPrice)} · 1.0 ADR {formatPrice(row.oneAdrLongTriggerPrice)}</div>
                                <div>Short trigger {formatPrice(row.shortTriggerPrice)} · 1.0 ADR {formatPrice(row.oneAdrShortTriggerPrice)}</div>
                                <div>Week range {formatPrice(row.weekLowPrice)} - {formatPrice(row.weekHighPrice)} · Current {formatPrice(row.currentPrice)}</div>
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Trade Profile</div>
                                <div className="mt-1">Trades {row.tradeCount ?? "—"}</div>
                                <div>Avg return {formatPct(row.avgReturnPct, 2)}</div>
                                <div>No-target rate {formatPct(row.noTargetRatePct, 2)}</div>
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
