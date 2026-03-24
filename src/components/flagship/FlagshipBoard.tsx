"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import InstrumentConfigModal from "@/components/flagship/InstrumentConfigModal";
import SizingAccountBar from "@/components/flagship/SizingAccountBar";
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
import { getInstrumentSpec } from "@/lib/flagship/instrumentDefaults";
import { calculateLotSize } from "@/lib/flagship/positionSizer";
import { formatDateTimeET } from "@/lib/time";
import { useSizingAccounts } from "@/hooks/useSizingAccounts";

type TrendState = MatrixTrendState;
type GateDecision = MatrixGateDecision;
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type SignalTier = "HIGH" | "MEDIUM" | "LOW" | "NEUTRAL";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type MenthorqOverlayCondition = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";
type TriggerState = "HIT" | "CLOSE" | "WATCHING" | "NO_DATA" | "INACTIVE";
type AgreementSignal = boolean | null;

type SignalMode = "FLAGSHIP" | "ADR_DIP" | "NEUTRAL";

type CanonicalWeeklySignal = {
  assetClass: string;
  pair: string;
  direction: SignalDirection;
  tier: "HIGH" | "MEDIUM" | "LOW";
  model: string;
  gateDecision: GateDecision;
  gateReasons: string[];
  signalMode?: "FLAGSHIP" | "ADR_DIP";
};

type CanonicalWeeklyBasketPayload = {
  generatedUtc: string;
  currentWeekOpenUtc: string;
  strategyId: string;
  strategyName: string;
  sourceLabel: string;
  sourceType: "frozen_weekly_snapshot";
  signals: CanonicalWeeklySignal[];
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
  cotGateAgree: AgreementSignal;
  menthorqAgree: AgreementSignal;
  strengthAgree: AgreementSignal;
  gammaAgreeCount: number;
  gammaAvailableCount: number;
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
  signalMode: SignalMode;
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
  if (normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") return normalized;
  return "NEUTRAL";
}

function normalizeGate(value: string | null | undefined): GateDecision {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "PASS" || normalized === "SKIP" || normalized === "REDUCE" || normalized === "NO_DATA") return normalized;
  return "NO_DATA";
}

function deriveOverlaySignal(
  pairRow: PairUniverseRow,
  signal: CanonicalWeeklySignal | null,
  menthorqBySymbol: Map<string, MenthorqOverlayCondition>,
): { state: TrendState; available: boolean } {
  if (pairRow.assetClass === "crypto") {
    return { state: "NEUTRAL", available: false };
  }

  if (pairRow.assetClass === "indices" && pairRow.base === "NIKKEI") {
    const available = menthorqBySymbol.has("6J");
    return { state: invertState(conditionToState(menthorqBySymbol.get("6J"))), available };
  }
  if (pairRow.assetClass === "indices" || pairRow.assetClass === "commodities") {
    const symbol = ASSET_MENTHORQ_SYMBOL[pairRow.base];
    const available = Boolean(symbol) && menthorqBySymbol.has(symbol);
    return { state: conditionToState(symbol ? menthorqBySymbol.get(symbol) : "UNKNOWN"), available };
  }

  const baseSymbol = CURRENCY_MENTHORQ_SYMBOL[pairRow.base];
  const quoteSymbol = CURRENCY_MENTHORQ_SYMBOL[pairRow.quote];
  const baseAvailable = Boolean(baseSymbol) && menthorqBySymbol.has(baseSymbol);
  const quoteAvailable = Boolean(quoteSymbol) && menthorqBySymbol.has(quoteSymbol);
  const baseState = conditionToState(baseSymbol ? menthorqBySymbol.get(baseSymbol) : "UNKNOWN");
  const quoteState = conditionToState(quoteSymbol ? menthorqBySymbol.get(quoteSymbol) : "UNKNOWN");

  if (baseState === "NEUTRAL" && quoteState === "NEUTRAL") {
    return { state: "NEUTRAL", available: baseAvailable || quoteAvailable };
  }
  if (baseState !== "NEUTRAL" && quoteState === "NEUTRAL") {
    return { state: baseState, available: baseAvailable || quoteAvailable };
  }
  if (baseState === "NEUTRAL" && quoteState !== "NEUTRAL") {
    return {
      state: quoteState === "BULLISH" ? "BEARISH" : "BULLISH",
      available: baseAvailable || quoteAvailable,
    };
  }
  if (baseState === quoteState) return { state: "NEUTRAL", available: baseAvailable || quoteAvailable };
  if (baseState === "BULLISH" && quoteState === "BEARISH") {
    return { state: "BULLISH", available: baseAvailable || quoteAvailable };
  }
  if (baseState === "BEARISH" && quoteState === "BULLISH") {
    return { state: "BEARISH", available: baseAvailable || quoteAvailable };
  }
  return { state: "NEUTRAL", available: baseAvailable || quoteAvailable };
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

function summarizeAgreement(inputs: AgreementSignal[]) {
  const availableCount = inputs.filter((value) => value !== null).length;
  const agreeCount = inputs.filter((value) => value === true).length;
  const gammaState: MatrixContextView =
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

function agreementChip(value: AgreementSignal, label: string) {
  if (value === null) {
    return (
      <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${gateClass("NO_DATA")}`}>
        {label} Unavailable
      </span>
    );
  }
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${value ? gateClass("PASS") : gateClass("SKIP")}`}>
      {label} {value ? "Agree" : "Miss"}
    </span>
  );
}

function sortBucket(row: MatrixRow) {
  if (row.signalMode === "NEUTRAL") return 4;
  if (row.signalMode === "FLAGSHIP" && row.oneAdrTouched) return 0;
  if (row.signalMode === "FLAGSHIP") return 1;
  if (row.signalMode === "ADR_DIP" && row.oneAdrTouched) return 2;
  return 3; // ADR_DIP watching
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function lotPrecision(step: number) {
  const [, decimal = ""] = `${step}`.split(".");
  return decimal.length;
}

function formatLotSize(value: number, step: number) {
  return value.toFixed(lotPrecision(step));
}

function sizingToneClass(warning: string | null) {
  if (warning?.includes("MARGIN_EXCEEDED")) return "text-rose-700 dark:text-rose-300";
  if (warning?.includes("MIN_LOT") || warning?.includes("MAX_LOT")) return "text-amber-700 dark:text-amber-300";
  return "text-emerald-700 dark:text-emerald-300";
}

export default function FlagshipBoard({ strategy }: { strategy: string }) {
  const [weeklyBasket, setWeeklyBasket] = useState<CanonicalWeeklyBasketPayload | null>(null);
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
  const {
    accounts,
    activeAccount,
    activeAccountId,
    setActiveAccountId,
    addAccount,
    updateAccount,
    deleteAccount,
    updateInstrumentOverride,
  } = useSizingAccounts();
  const [sizingModalPair, setSizingModalPair] = useState<{ pair: string; assetClass: string } | null>(null);

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
          fetch("/api/flagship/canonical-weekly-basket", { cache: "no-store" }),
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

        const [basketJson, cotJson, sentimentJson, currencyJson, assetJson, overlayJson, sizingJson, movesJson, intradayJson] = await Promise.all([
          readJson<CanonicalWeeklyBasketPayload>(responses[0], "canonical-weekly-basket"),
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
          if (!basketJson && !cotJson && !sentimentJson) setError("Failed to load matrix sources.");
          setWeeklyBasket(basketJson);
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
    const gatedByPair = new Map<string, CanonicalWeeklySignal>();
    for (const signal of weeklyBasket?.signals ?? []) gatedByPair.set(normalizeKey(signal.pair), signal);

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

        const overlaySignal = deriveOverlaySignal(pairRow, signal, menthorqBySymbol);
        const overlay = overlaySignal.state;
        const signalGate = normalizeGate(signal?.gateDecision);
        const cotGateAgree: AgreementSignal =
          coreBias === "NEUTRAL" ? null : signalGate === "NO_DATA" ? null : signalGate === "PASS";
        const menthorqAgree: AgreementSignal =
          coreBias === "NEUTRAL" || !overlaySignal.available ? null : overlay === coreBiasState;
        const strengthAgree: AgreementSignal =
          coreBias === "NEUTRAL" || strengthDelta1h === null ? null : strength1h === coreBiasState;
        const { agreeCount, availableCount, gammaState } = summarizeAgreement([
          cotGateAgree,
          menthorqAgree,
          strengthAgree,
        ]);

        const signalMode: SignalMode = signal?.signalMode === "FLAGSHIP" || signal?.signalMode === "ADR_DIP"
          ? (signal.signalMode === "FLAGSHIP" && signalGate !== "PASS" ? "ADR_DIP" : signal.signalMode)
          : coreBias !== "NEUTRAL"
            ? (signalGate === "PASS" ? "FLAGSHIP" : "ADR_DIP")
            : "NEUTRAL";

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
          gammaAgreeCount: agreeCount,
          gammaAvailableCount: availableCount,
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
          signalMode,
        } satisfies MatrixRow;
      })
      .filter((row) => row.sessionEligible.includes(selectedSession))
      .sort((left, right) => {
        const bucketDiff = sortBucket(left) - sortBucket(right);
        if (bucketDiff !== 0) return bucketDiff;
        return left.pair.localeCompare(right.pair);
      });
  }, [assetStrength, cotMatrix, currencyStrength, dailySentiment, intradayLevels, liveSizing, menthorqOverlay, priceMoves, selectedSession, weeklyBasket]);

  const flagshipCount = matrixRows.filter((row) => row.signalMode === "FLAGSHIP").length;
  const adrDipCount = matrixRows.filter((row) => row.signalMode === "ADR_DIP").length;
  const qualifiedCount = flagshipCount + adrDipCount;
  const adrHitCount = matrixRows.filter((row) => row.triggerState === "HIT").length;
  const closeCount = matrixRows.filter((row) => row.triggerState === "CLOSE").length;
  const neutralCount = matrixRows.filter((row) => row.signalMode === "NEUTRAL").length;
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
              <div>Data {formatDateTimeET(lastRefreshedUtc ?? weeklyBasket?.generatedUtc ?? null, "Unknown")}</div>
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
            <span>Flagship {flagshipCount}</span>
            <span>ADR Dip {adrDipCount}</span>
            <span>ADR Hit {adrHitCount}</span>
            <span>Close {closeCount}</span>
            <span>Neutral {neutralCount}</span>
          </div>
        ) : null}

        <SizingAccountBar
          accounts={accounts}
          activeAccount={activeAccount}
          onSelectAccount={setActiveAccountId}
          onAddAccount={addAccount}
          onUpdateAccount={updateAccount}
          onDeleteAccount={deleteAccount}
        />

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
                  const pairKey = row.pair.toUpperCase();
                  const pairSpec = activeAccount
                    ? getInstrumentSpec(pairKey, activeAccount.instrumentOverrides[pairKey])
                    : null;
                  const sizingResult =
                    activeAccount && pairSpec && row.adrPct !== null && row.currentPrice !== null
                      ? calculateLotSize(activeAccount, pairSpec, row.adrPct, row.currentPrice)
                      : null;
                  const sizingTone = sizingToneClass(sizingResult?.warning ?? null);
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
                                {row.signalMode === "FLAGSHIP" ? (
                                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/14 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">Flagship</span>
                                ) : row.signalMode === "ADR_DIP" ? (
                                  <span className="rounded-full border border-amber-500/40 bg-amber-500/14 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">ADR Dip</span>
                                ) : null}
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
                                {agreementText(row.gammaAgreeCount, row.gammaAvailableCount)}
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
                        <td className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              activeAccount
                                ? setSizingModalPair({ pair: pairKey, assetClass: row.assetClass })
                                : undefined
                            }
                            disabled={!activeAccount}
                            className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left font-mono transition ${
                              activeAccount ? "hover:bg-[var(--panel)]/70" : "cursor-default"
                            } ${sizingResult ? sizingTone : "text-[var(--foreground)]"}`}
                            title={sizingResult?.warning ?? (activeAccount ? "Configure instrument" : "No active account")}
                          >
                            <span className="text-sm font-semibold">
                              {sizingResult && pairSpec ? formatLotSize(sizingResult.lotSize, pairSpec.lotStep) : "—"}
                            </span>
                            {sizingResult ? (
                              <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                                {formatUsd(sizingResult.riskAmountUsd)}
                              </span>
                            ) : null}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-[var(--panel)]/75">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid gap-2 lg:grid-cols-4">
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Core Bias Detail</div>
                                {row.assetClass === "crypto" ? (
                                  <>
                                    <div className="mt-1">Bias source: Crypto Matrix (liquidation + OI + funding)</div>
                                    <div>Weekly call: {directionLabel(row.coreBias)} {row.tier !== "NEUTRAL" ? `· ${row.tier}` : ""}</div>
                                    <div>Gate: <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${gateClass(row.gate)}`}>{row.gate}</span></div>
                                  </>
                                ) : (
                                  <>
                                    <div className="mt-1">Dealer {row.dealer} · Commercial {row.commercial} · Sentiment {row.sentimentDaily}</div>
                                    <div>Weekly call: {directionLabel(row.coreBias)} {row.tier !== "NEUTRAL" ? `· ${row.tier}` : ""}</div>
                                    <div>Gate: <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${gateClass(row.gate)}`}>{row.gate}</span></div>
                                  </>
                                )}
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Gamma Detail</div>
                                {row.assetClass === "crypto" ? (
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {agreementChip(row.strengthAgree, "Strength")}
                                    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${stateClass(row.strength1h)}`}>Str {row.strengthDelta1h === null ? "—" : row.strengthDelta1h.toFixed(0)}</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="mt-1 flex items-center gap-2">
                                      {agreementChip(row.cotGateAgree, "COT")}
                                      {agreementChip(row.menthorqAgree, "MenthorQ")}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                      {agreementChip(row.strengthAgree, "Strength")}
                                      <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${stateClass(row.overlay)}`}>Overlay {stateLabel(row.overlay)}</span>
                                      <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${stateClass(row.strength1h)}`}>Str {row.strengthDelta1h === null ? "—" : row.strengthDelta1h.toFixed(0)}</span>
                                    </div>
                                  </>
                                )}
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
