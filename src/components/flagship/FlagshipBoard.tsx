"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WeeklyHoldResult, CanonicalSignal } from "@/lib/performance/weeklyHoldEngine";

import AdrStatsBar from "@/components/flagship/AdrStatsBar";
import InstrumentConfigModal from "@/components/flagship/InstrumentConfigModal";
import SizingAccountBar from "@/components/flagship/SizingAccountBar";
import { readSelectionFromParams, selectionLabel } from "@/components/shared/StrategySelector";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getEntryStyle, resolveEntryStyleId } from "@/lib/performance/strategyConfig";
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
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL" | "MIXED";
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
  tier: "HIGH" | "MEDIUM" | "LOW" | null;
  model: string;
  gateDecision: GateDecision;
  gateReasons: string[];
  signalMode?: "FLAGSHIP" | "ADR_DIP";
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
  weekOpenUtc: string;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  longTouched: boolean;
  shortTouched: boolean;
  longTpPrice: number | null;
  shortTpPrice: number | null;
};

type IntradayLevelsPayload = {
  generatedUtc: string | null;
  rows: IntradayLevelRow[];
};

type AdrTradeRow = {
  symbol: string;
  direction: string;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  pnlPct: number | null;
  exitReason: string | null;
  tradeNumber: number | null;
  anchorPrice: number | null;
  adrPct: number | null;
  tpPrice: number | null;
  maePct: number | null;
  tier: string | null;
  gateDecision: string | null;
};

type AdrTradesPayload = {
  weekOpenUtc: string;
  generatedUtc: string;
  totalTrades: number;
  totalTpHits: number;
  totalActive: number;
  totalLosses: number;
  weekReturnPct: number;
  trades: AdrTradeRow[];
};

function makeTradeId(trade: AdrTradeRow, assetClass: string): string {
  const assetCode = assetClass === "crypto" ? "CR" : assetClass === "fx" ? "FX" : assetClass === "commodities" ? "CM" : "IX";
  const dir = trade.direction === "LONG" ? "L" : "S";
  const date = trade.entryTimeUtc ? trade.entryTimeUtc.slice(2, 10).replace(/-/g, "") : "000000";
  const seq = String(trade.tradeNumber ?? 1).padStart(3, "0");
  return `SADR-${assetCode}-${dir}-${trade.symbol}-${date}-${seq}`;
}

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
  pairReturnPct: number | null;
  weeklyMovePct: number | null;
  weeklyOpenPrice: number | null;
  weeklyClosePrice: number | null;
  move24hPct: number | null;
  adrPct: number | null;
  adrBarsUsed: number;
  weekOpenUtc: string | null;
  weekOpenPrice: number | null;
  weekHighPrice: number | null;
  weekLowPrice: number | null;
  currentPrice: number | null;
  longTriggerPrice: number | null;
  shortTriggerPrice: number | null;
  longTpPrice: number | null;
  shortTpPrice: number | null;
  touched: boolean;
  triggerState: TriggerState;
  signalMode: SignalMode;
  adrTradeCount: number;
  adrTrades: AdrTradeRow[];
  /** Per-model canonical signals for this pair (tandem: 2-3, others: 0-1) */
  modelSignals: CanonicalWeeklySignal[];
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
  if (direction === "MIXED") return "Mixed";
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
  if (change24hPct === null || !Number.isFinite(change24hPct)) return "No data";
  return `${change24hPct > 0 ? "+" : ""}${change24hPct.toFixed(1)}%`;
}

function moveClass(change24hPct: number | null) {
  if (change24hPct === null || !Number.isFinite(change24hPct)) return "text-[color:var(--muted)]";
  if (change24hPct > 0) return "text-emerald-700 dark:text-emerald-300";
  if (change24hPct < 0) return "text-rose-700 dark:text-rose-300";
  return "text-[color:var(--muted)]";
}

function weeklyMoveClass(changePct: number | null) {
  if (changePct === null || !Number.isFinite(changePct)) return "text-[color:var(--muted)]";
  if (changePct > 0) return "text-emerald-700 dark:text-emerald-300";
  if (changePct < 0) return "text-rose-700 dark:text-rose-300";
  return "text-[color:var(--muted)]";
}

function formatWeeklyMoveCompact(changePct: number | null) {
  if (changePct === null || !Number.isFinite(changePct)) return null;
  return `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 1000) return value.toFixed(2);
  if (Math.abs(value) >= 100) return value.toFixed(3);
  if (Math.abs(value) >= 1) return value.toFixed(4);
  return value.toFixed(5);
}

function formatExitStatus(exitReason: string | null) {
  if (exitReason === "tp") return "+0.25%";
  if (exitReason === "active") return "ACTIVE";
  if (exitReason === "week_close") return "Week close";
  if (!exitReason) return "Open";
  return decodeReason(exitReason);
}

function triggerClass(state: TriggerState, flashing: boolean) {
  const base = "inline-flex min-w-[3.75rem] justify-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]";
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
  // Group 1: ADR Hits — directional pairs that have touched their trigger
  if (row.signalMode !== "NEUTRAL" && row.touched) return 0;
  // Group 2: Watching — directional pairs not yet hit
  if (row.signalMode !== "NEUTRAL") return 1;
  // Group 3: Neutral
  return 2;
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

type FlagshipBoardProps = {
  weekOpenUtc?: string | null;
  currentWeekOpenUtc?: string;
  selection?: {
    strategy: string;
    f1: string;
    f2: string;
  };
  /** Pre-computed engine results per week — canonical source. When provided,
   *  the board uses this instead of client-side fetching for trade data. */
  engineWeekResults?: Record<string, WeeklyHoldResult> | null;
  /** Canonical pair-level signals from the engine for the selected week.
   *  Replaces the client-side canonical-weekly-basket fetch for coreBias,
   *  tier display, and LONG/SHORT copy buttons. */
  canonicalSignals?: CanonicalSignal[];
  weeklyReturns?: Array<{
    symbol: string;
    assetClass: AssetClass;
    returnPct: number;
    openPrice: number;
    closePrice: number;
  }>;
};

export default function FlagshipBoard({
  weekOpenUtc,
  currentWeekOpenUtc,
  selection,
  engineWeekResults,
  canonicalSignals,
  weeklyReturns,
}: FlagshipBoardProps) {
  const matrixSearchParams = useSearchParams();
  const activeSelection = selection ?? readSelectionFromParams(matrixSearchParams);
  const activeLabel = selectionLabel(activeSelection);
  const activeFilter = getEntryStyle(resolveEntryStyleId(activeSelection.f1));
  const matrixUi = activeFilter?.matrixUi ?? {
    showStatsBar: false,
    showTriggerState: false,
    showIntradayDetail: false,
    currentColumnLabel: "Trades",
    historicalColumnLabel: "Trades",
    detailTitle: null,
  };
  const isPastWeek = Boolean(weekOpenUtc && currentWeekOpenUtc && weekOpenUtc !== currentWeekOpenUtc);
  const [cotMatrix, setCotMatrix] = useState<CotMatrixPayload | null>(null);
  const [dailySentiment, setDailySentiment] = useState<DailySentimentPayload | null>(null);
  const [currencyStrength, setCurrencyStrength] = useState<CurrencyStrengthPayload | null>(null);
  const [assetStrength, setAssetStrength] = useState<AssetStrengthPayload | null>(null);
  const [menthorqOverlay, setMenthorqOverlay] = useState<MenthorqOverlayPayload | null>(null);
  const [liveSizing, setLiveSizing] = useState<LiveSizingPayload | null>(null);
  const [priceMoves, setPriceMoves] = useState<PriceMovesPayload | null>(null);
  const [intradayLevels, setIntradayLevels] = useState<IntradayLevelsPayload | null>(null);
  const [fetchedAdrTrades, setFetchedAdrTrades] = useState<AdrTradesPayload | null>(null);
  const [staticLoading, setStaticLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(true);
  const [staticRefreshing, setStaticRefreshing] = useState(false);
  const [weekRefreshing, setWeekRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staticWarnings, setStaticWarnings] = useState<string[]>([]);
  const [weekWarnings, setWeekWarnings] = useState<string[]>([]);
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

    async function fetchStaticOverlayData() {
      try {
        setStaticRefreshing(true);
        const nextWarnings: string[] = [];
        const responses = await Promise.allSettled([
          fetch("/api/flagship/currency-strength", { cache: "no-store" }),
          fetch("/api/flagship/asset-strength", { cache: "no-store" }),
          fetch("/api/flagship/menthorq-overlay", { cache: "no-store" }),
          fetch("/api/flagship/live-sizing", { cache: "no-store" }),
          fetch("/api/flagship/price-moves", { cache: "no-store" }),
        ]);

        const readJson = async <T,>(response: PromiseSettledResult<Response>, label: string) => {
          if (response.status === "fulfilled" && response.value.ok) return (await response.value.json()) as T;
          nextWarnings.push(`${label} unavailable`);
          return null;
        };

        const [currencyJson, assetJson, overlayJson, sizingJson, movesJson] = await Promise.all([
          readJson<CurrencyStrengthPayload>(responses[0], "currency-strength"),
          readJson<AssetStrengthPayload>(responses[1], "asset-strength"),
          readJson<MenthorqOverlayPayload>(responses[2], "menthorq-overlay"),
          readJson<LiveSizingPayload>(responses[3], "live-sizing"),
          readJson<PriceMovesPayload>(responses[4], "price-moves"),
        ]);

        if (!cancelled) {
          setCurrencyStrength(currencyJson);
          setAssetStrength(assetJson);
          setMenthorqOverlay(overlayJson);
          setLiveSizing(sizingJson);
          setPriceMoves(movesJson);
          setStaticWarnings(nextWarnings);
          setLastRefreshedUtc(new Date().toISOString());
          setStaticLoading(false);
          setStaticRefreshing(false);
        }
      } catch {
        if (!cancelled) {
          setStaticWarnings(["live overlays unavailable"]);
          setStaticLoading(false);
          setStaticRefreshing(false);
        }
      }
    }

    fetchStaticOverlayData();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeekOverlayData() {
      try {
        setWeekRefreshing(true);
        setError(null);
        const nextWarnings: string[] = [];
        const weekQs = weekOpenUtc ? `?week=${encodeURIComponent(weekOpenUtc)}` : "";
        const sentimentUrl = weekOpenUtc
          ? `/api/flagship/sentiment-daily?asOf=${encodeURIComponent(weekOpenUtc)}`
          : "/api/flagship/sentiment-daily";
        const responses = await Promise.allSettled([
          fetch(`/api/flagship/cot-matrix${weekQs}`, { cache: "no-store" }),
          fetch(sentimentUrl, { cache: "no-store" }),
          fetch(`/api/flagship/intraday-levels${weekQs}`, { cache: "no-store" }),
        ]);

        const readJson = async <T,>(response: PromiseSettledResult<Response>, label: string) => {
          if (response.status === "fulfilled" && response.value.ok) return (await response.value.json()) as T;
          nextWarnings.push(`${label} unavailable`);
          return null;
        };

        const [cotJson, sentimentJson, intradayJson] = await Promise.all([
          readJson<CotMatrixPayload>(responses[0], "cot-matrix"),
          readJson<DailySentimentPayload>(responses[1], "sentiment-daily"),
          readJson<IntradayLevelsPayload>(responses[2], "intraday-levels"),
        ]);

        if (!cancelled) {
          if (!cotJson && !sentimentJson) setError("Failed to load overlay sources.");
          setCotMatrix(cotJson);
          setDailySentiment(sentimentJson);
          setIntradayLevels(intradayJson);
          setWeekWarnings(nextWarnings);
          setLastRefreshedUtc(new Date().toISOString());
          setWeekLoading(false);
          setWeekRefreshing(false);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
          setWeekLoading(false);
          setWeekRefreshing(false);
        }
      }
    }

    fetchWeekOverlayData();
    if (activeFilter?.hasTradeLog && !engineWeekResults) {
      const adrWeekQs = weekOpenUtc ? `?week=${encodeURIComponent(weekOpenUtc)}` : "";
      fetch(`/api/flagship/adr-trades${adrWeekQs}`)
        .then((response) => response.json())
        .then(setFetchedAdrTrades)
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [activeFilter?.hasTradeLog, engineWeekResults, refreshTick, weekOpenUtc]);

  const loading = staticLoading || weekLoading;
  const refreshing = staticRefreshing || weekRefreshing;
  const warnings = useMemo(
    () => Array.from(new Set([...staticWarnings, ...weekWarnings])),
    [staticWarnings, weekWarnings],
  );
  const adrTrades = useMemo(() => {
    if (!activeFilter?.hasTradeLog) return null;
    const weekKey = weekOpenUtc ?? "";
    const engineResult = engineWeekResults?.[weekKey];
    if (engineResult) {
      const trades: AdrTradeRow[] = engineResult.trades.map((trade) => ({
        symbol: trade.symbol,
        direction: trade.direction,
        entryTimeUtc: trade.detail?.entryTimeUtc ?? null,
        exitTimeUtc: trade.detail?.exitTimeUtc ?? null,
        entryPrice: trade.openPrice,
        exitPrice: trade.closePrice || null,
        pnlPct: trade.returnPct,
        exitReason: trade.detail?.exitReason ?? null,
        tradeNumber: trade.detail?.tradeNumber ?? null,
        anchorPrice: trade.detail?.anchorPrice ?? null,
        adrPct: trade.detail?.adrPct ?? null,
        tpPrice: trade.detail?.tpPrice ?? null,
        maePct: trade.detail?.maePct ?? null,
        assetClass: trade.assetClass,
        tier: String(trade.tier ?? ""),
        gateDecision: null,
      }));
      const totalTpHits = trades.filter((trade) => trade.exitReason === "tp").length;
      const totalActive = trades.filter((trade) => trade.exitReason === "active").length;
      return {
        weekOpenUtc: engineResult.weekOpenUtc,
        generatedUtc: new Date().toISOString(),
        totalTrades: trades.length,
        totalTpHits,
        totalActive,
        totalLosses: trades.length - totalTpHits - totalActive,
        weekReturnPct: engineResult.totalReturnPct,
        trades,
      } satisfies AdrTradesPayload;
    }
    if (!engineWeekResults) return fetchedAdrTrades;
    if (weekKey in engineWeekResults) {
      return {
        weekOpenUtc: weekKey,
        generatedUtc: new Date().toISOString(),
        totalTrades: 0,
        totalTpHits: 0,
        totalActive: 0,
        totalLosses: 0,
        weekReturnPct: 0,
        trades: [],
      } satisfies AdrTradesPayload;
    }
    return null;
  }, [activeFilter?.hasTradeLog, engineWeekResults, fetchedAdrTrades, weekOpenUtc]);

  const matrixRows = useMemo(() => {
    // Build per-pair signal arrays from canonical engine signals (prop).
    // For single-model strategies: one signal per pair.
    // For tandem: multiple signals per pair (one per approving model).
    // The board derives coreBias from the signal array, not a pre-collapsed value.
    const signalsByPair = new Map<string, CanonicalWeeklySignal[]>();
    for (const s of canonicalSignals ?? []) {
      const key = normalizeKey(s.symbol);
      const sig: CanonicalWeeklySignal = {
        assetClass: s.assetClass,
        pair: s.symbol,
        direction: s.direction,
        tier: s.tier === 1 ? "HIGH" : s.tier === 2 ? "MEDIUM" : s.tier === 3 ? "LOW" : null,
        model: s.source,
        gateDecision: "PASS",
        gateReasons: [],
      };
      const existing = signalsByPair.get(key);
      if (existing) existing.push(sig);
      else signalsByPair.set(key, [sig]);
    }

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

    const weeklyReturnsByPair = new Map<
      string,
      { returnPct: number; openPrice: number; closePrice: number }
    >();
    for (const row of weeklyReturns ?? []) {
      weeklyReturnsByPair.set(normalizeKey(row.symbol), {
        returnPct: row.returnPct,
        openPrice: row.openPrice,
        closePrice: row.closePrice,
      });
    }

    const moveByPair = new Map<string, number | null>();
    for (const row of priceMoves?.rows ?? []) moveByPair.set(normalizeKey(row.pair), row.change24hPct);

    const levelsByPair = new Map<string, IntradayLevelRow>();
    for (const row of intradayLevels?.rows ?? []) levelsByPair.set(normalizeKey(row.pair), row);

    const adrTradesByPair = new Map<string, AdrTradeRow[]>();
    for (const trade of adrTrades?.trades ?? []) {
      const key = normalizeKey(trade.symbol);
      const existing = adrTradesByPair.get(key) ?? [];
      existing.push(trade);
      adrTradesByPair.set(key, existing);
    }

    const selectedWeekTrades = weekOpenUtc ? (engineWeekResults?.[weekOpenUtc]?.trades ?? []) : [];
    const engineTradesByPair = new Map<string, WeeklyHoldResult["trades"]>();
    for (const trade of selectedWeekTrades) {
      const key = normalizeKey(trade.symbol);
      const existing = engineTradesByPair.get(key) ?? [];
      existing.push(trade);
      engineTradesByPair.set(key, existing);
    }

    return UNIVERSE
      .map((pairRow) => {
        const key = normalizeKey(pairRow.pair);
        const pairSignals = signalsByPair.get(key) ?? [];
        // Primary signal for gate/tier compat (first signal, deterministic)
        const signal = pairSignals.length > 0 ? pairSignals[0]! : null;
        // Derive coreBias from all signals for this pair:
        //   all agree → that direction | conflicting → MIXED | none → NEUTRAL
        let coreBias: SignalDirection = "NEUTRAL";
        if (pairSignals.length > 0) {
          const dirs = new Set(pairSignals.map((s) => s.direction));
          if (dirs.size === 1) coreBias = pairSignals[0]!.direction;
          else coreBias = "MIXED";
        }
        const level = levelsByPair.get(key) ?? null;
        const cot = cotByPair.get(key) ?? null;
        const dealer = directionToState(cot?.dealerDirection ?? "NEUTRAL");
        const commercial = directionToState(cot?.commercialDirection ?? "NEUTRAL");
        const sentimentDaily = directionToState(sentimentByPair.get(key) ?? "NEUTRAL");
        const coreBiasState = directionToState(coreBias);
        const sizing = sizingByPair.get(key) ?? null;
        const weeklyMove = weeklyReturnsByPair.get(key) ?? null;

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
        // MIXED = conflicting model signals — no single directional comparator,
        // so agreement fields are null (same as NEUTRAL: nothing to compare against).
        const hasDirectionalBias = coreBias === "LONG" || coreBias === "SHORT";
        const cotGateAgree: AgreementSignal =
          !hasDirectionalBias ? null : signalGate === "NO_DATA" ? null : signalGate === "PASS";
        const menthorqAgree: AgreementSignal =
          !hasDirectionalBias || !overlaySignal.available ? null : overlay === coreBiasState;
        const strengthAgree: AgreementSignal =
          !hasDirectionalBias || strengthDelta1h === null ? null : strength1h === coreBiasState;
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

        const pairTrades = adrTradesByPair.get(key) ?? [];
        const pairEngineTrades = engineTradesByPair.get(key) ?? [];
        const pairReturnPct = pairEngineTrades.length > 0
          ? pairEngineTrades.reduce((sum, trade) => sum + trade.returnPct, 0)
          : null;
        const hasActiveTrade = pairTrades.some(t => t.exitReason === "active");
        let triggerState: TriggerState = "INACTIVE";
        let touched = false;
        if (coreBias !== "NEUTRAL") {
          if (hasActiveTrade) { triggerState = "HIT"; touched = true; }
          else if (level?.adrPct) triggerState = "WATCHING";
          else triggerState = "NO_DATA";
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
          pairReturnPct,
          weeklyMovePct: weeklyMove?.returnPct ?? null,
          weeklyOpenPrice: weeklyMove?.openPrice ?? null,
          weeklyClosePrice: weeklyMove?.closePrice ?? null,
          move24hPct: moveByPair.get(key) ?? null,
          adrPct: level?.adrPct ?? null,
          adrBarsUsed: level?.adrBarsUsed ?? 0,
          weekOpenUtc: level?.weekOpenUtc ?? null,
          weekOpenPrice: level?.weekOpenPrice ?? null,
          weekHighPrice: level?.weekHighPrice ?? null,
          weekLowPrice: level?.weekLowPrice ?? null,
          currentPrice: level?.currentPrice ?? null,
          longTriggerPrice: level?.longTriggerPrice ?? null,
          shortTriggerPrice: level?.shortTriggerPrice ?? null,
          longTpPrice: level?.longTpPrice ?? null,
          shortTpPrice: level?.shortTpPrice ?? null,
          touched,
          triggerState,
          signalMode,
          adrTradeCount: pairTrades.length,
          adrTrades: pairTrades,
          modelSignals: pairSignals,
        } satisfies MatrixRow;
      })
      .sort((left, right) => {
        const bucketDiff = sortBucket(left) - sortBucket(right);
        if (bucketDiff !== 0) return bucketDiff;
        return left.pair.localeCompare(right.pair);
      });
  }, [adrTrades, assetStrength, canonicalSignals, cotMatrix, currencyStrength, dailySentiment, engineWeekResults, intradayLevels, liveSizing, menthorqOverlay, priceMoves, weekOpenUtc, weeklyReturns]);

  const flagshipCount = matrixRows.filter((row) => row.signalMode === "FLAGSHIP").length;
  const adrDipCount = matrixRows.filter((row) => row.signalMode === "ADR_DIP").length;
  const qualifiedCount = flagshipCount + adrDipCount;
  const adrHitCount = matrixRows.filter((row) => row.triggerState === "HIT").length;
  const directionalCount = matrixRows.filter((row) => row.coreBias === "LONG" || row.coreBias === "SHORT").length;
  const mixedCount = matrixRows.filter((row) => row.coreBias === "MIXED").length;
  const neutralCount = matrixRows.filter((row) => row.signalMode === "NEUTRAL").length;
  const activeSession = sessionForUtcHour(nowUtc.getUTCHours());
  const selectedEngineResult = weekOpenUtc ? (engineWeekResults?.[weekOpenUtc] ?? null) : null;
  const statsTrades = matrixUi.showIntradayDetail
    ? (adrTrades?.totalTrades ?? selectedEngineResult?.tradeCount ?? 0)
    : (selectedEngineResult?.tradeCount ?? 0);
  const statsWins = matrixUi.showIntradayDetail
    ? (adrTrades?.totalTpHits ?? selectedEngineResult?.winCount ?? 0)
    : (selectedEngineResult?.winCount ?? 0);
  const statsLosses = matrixUi.showIntradayDetail
    ? (adrTrades?.totalLosses ?? selectedEngineResult?.lossCount ?? 0)
    : (selectedEngineResult?.lossCount ?? 0);
  const statsActive = matrixUi.showIntradayDetail ? (adrTrades?.totalActive ?? 0) : 0;
  const statsReturn = matrixUi.showIntradayDetail
    ? (adrTrades?.weekReturnPct ?? selectedEngineResult?.totalReturnPct ?? 0)
    : (selectedEngineResult?.totalReturnPct ?? 0);

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm md:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Matrix</p>
            <h1 className="text-xl font-semibold text-[var(--foreground)] md:text-2xl">CFD Matrix</h1>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]">{activeLabel}</p>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-right text-xs text-[color:var(--muted)]">
              <div>Data {formatDateTimeET(lastRefreshedUtc ?? null, "Unknown")}</div>
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

        {!loading && !error ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/55 px-3 py-2 text-[11px] text-[color:var(--muted)]">
            {matrixUi.showTriggerState ? (
              <>
                <span>Hit {adrHitCount}</span>
                <span>Watching {qualifiedCount - adrHitCount}</span>
              </>
            ) : (
              <>
                <span>Directional {directionalCount}</span>
                <span>Mixed {mixedCount}</span>
              </>
            )}
            <span>Neutral {neutralCount}</span>
            <span className="ml-auto">Total {matrixRows.length}</span>
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

        {canonicalSignals && (
          <AdrStatsBar
            totalTrades={statsTrades}
            totalTpHits={statsWins}
            totalActive={statsActive}
            totalLosses={statsLosses}
            weekReturnPct={statsReturn}
            longPairs={matrixRows.filter((r) => r.coreBias === "LONG").map((r) => r.pair)}
            shortPairs={matrixRows.filter((r) => r.coreBias === "SHORT").map((r) => r.pair)}
            isPastWeek={isPastWeek}
            winsLabel={matrixUi.showIntradayDetail ? "TP Hits" : "Wins"}
            showActive={matrixUi.showIntradayDetail && !isPastWeek}
          />
        )}

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
                <col className="w-[14rem]" />
                <col className="w-[8rem]" />
                <col className="w-[7rem]" />
                <col className="w-[13rem]" />
                <col className="w-[6rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--panel)] text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Pair</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Core Bias</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">Weekly %</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-3">
                    {isPastWeek ? matrixUi.historicalColumnLabel : matrixUi.currentColumnLabel}
                  </th>
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
                                {formatWeeklyMoveCompact(row.pairReturnPct) ? (
                                  <span className={`text-[10px] font-medium uppercase tracking-[0.08em] ${weeklyMoveClass(row.pairReturnPct)}`}>
                                    {formatWeeklyMoveCompact(row.pairReturnPct)}
                                  </span>
                                ) : null}
                              </span>
                              {row.coreBias !== "NEUTRAL" && row.tier !== "NEUTRAL" ? (
                                <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">{row.tier} tier</span>
                              ) : null}
                            </span>
                          </button>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="space-y-1">
                            <span className={`inline-flex min-w-[5rem] justify-center rounded border px-2 py-0.5 font-semibold ${
                              row.coreBias === "MIXED"
                                ? "border-amber-500/40 bg-amber-500/14 text-amber-700 dark:text-amber-300"
                                : biasChipClass(row.coreBiasState)
                            }`}>
                              {directionLabel(row.coreBias)}
                            </span>
                            {row.coreBias !== "NEUTRAL" && row.tier !== "NEUTRAL" ? (
                              <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                                {row.tier} tier
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          <div className="space-y-1">
                            <div className={`text-sm font-semibold ${weeklyMoveClass(row.pairReturnPct)}`}>
                              {row.pairReturnPct === null ? "0.00%" : `${row.pairReturnPct >= 0 ? "+" : ""}${row.pairReturnPct.toFixed(2)}%`}
                            </div>
                            {row.weeklyOpenPrice !== null && row.weeklyClosePrice !== null ? (
                              <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                                {formatPrice(row.weeklyOpenPrice)} → {formatPrice(row.weeklyClosePrice)}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-r border-[var(--panel-border)] px-3 py-2">
                          {!matrixUi.showIntradayDetail ? (
                            <div className="space-y-1">
                              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--foreground)]">
                                {row.modelSignals.length} trade{row.modelSignals.length !== 1 ? "s" : ""} qualified
                              </div>
                              <div className={`text-xs font-semibold ${row.pairReturnPct !== null && row.pairReturnPct >= 0 ? "text-lime-400" : row.pairReturnPct !== null ? "text-red-400" : "text-[color:var(--muted)]"}`}>
                                {row.pairReturnPct === null ? "P/L 0.00%" : `P/L ${row.pairReturnPct >= 0 ? "+" : ""}${row.pairReturnPct.toFixed(2)}%`}
                              </div>
                            </div>
                          ) : isPastWeek ? (
                            <div className="space-y-1">
                              {row.adrTradeCount > 0 ? (
                                (() => {
                                  const tpCount = row.adrTrades.filter(t => t.exitReason === "tp").length;
                                  const lossCount = row.adrTrades.filter(t => t.exitReason === "week_close").length;
                                  const activeCount = row.adrTrades.filter(t => t.exitReason === "active" || !t.exitReason).length;
                                  const pnl = row.adrTrades.reduce((s, t) => s + (t.pnlPct ?? 0), 0);
                                  return (
                                    <>
                                      <div className="text-[10px] uppercase tracking-[0.08em] text-lime-400">
                                        {tpCount} TP
                                      </div>
                                      {lossCount > 0 && (
                                        <div className="text-[10px] uppercase tracking-[0.08em] text-red-400">
                                          {lossCount} Loss
                                        </div>
                                      )}
                                      {activeCount > 0 && (
                                        <div className="text-[10px] uppercase tracking-[0.08em] text-yellow-400">
                                          {activeCount} Open
                                        </div>
                                      )}
                                      <div className={`text-xs font-semibold ${pnl >= 0 ? "text-lime-400" : "text-red-400"}`}>
                                        {`${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`}
                                      </div>
                                    </>
                                  );
                                })()
                              ) : (
                                <>
                                  <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                                    0 trades taken
                                  </div>
                                  <div className="text-xs font-semibold text-[color:var(--muted)]">
                                    P/L 0.00%
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className={triggerClass(row.triggerState, row.touched)} title="ADR trigger">
                                {row.triggerState === "INACTIVE" ? "No setup" : row.triggerState === "NO_DATA" ? "No data" : row.triggerState}
                              </span>
                              <div className={`text-[10px] uppercase tracking-[0.08em] ${row.adrTradeCount > 0 ? "text-lime-400" : "text-[color:var(--muted)]"}`}>
                                {row.adrTradeCount} trade{row.adrTradeCount !== 1 ? "s" : ""}
                              </div>
                              {matrixUi.showTriggerState && row.adrPct !== null ? (
                                <div className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
                                  Range {row.adrPct.toFixed(2)}%
                                </div>
                              ) : null}
                            </div>
                          )}
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
                              {sizingResult && pairSpec ? formatLotSize(sizingResult.lotSize, pairSpec.lotStep) : "n/a"}
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
                            <div className={`grid gap-2 ${matrixUi.showIntradayDetail ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Core Bias Detail</div>
                                <div className="mt-1">Dealer {row.dealer} · Commercial {row.commercial} · Sentiment {row.sentimentDaily}</div>
                                <div>Weekly call: {directionLabel(row.coreBias)} {row.tier !== "NEUTRAL" ? `· ${row.tier}` : ""}</div>
                                {row.modelSignals.length > 1 ? (
                                  <div className="mt-1">{row.modelSignals.map((ms) => `${ms.model} ${directionLabel(ms.direction)}`).join(" · ")}</div>
                                ) : null}
                              </div>
                              <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                <div className="font-semibold text-[var(--foreground)]">Weekly Move</div>
                                <div className="mt-1">
                                  Result{" "}
                                  <span className={weeklyMoveClass(row.pairReturnPct)}>
                                    {row.pairReturnPct === null ? "0.00%" : `${row.pairReturnPct >= 0 ? "+" : ""}${row.pairReturnPct.toFixed(2)}%`}
                                  </span>
                                </div>
                                <div>Move {row.weeklyMovePct === null ? "0.00%" : `${row.weeklyMovePct >= 0 ? "+" : ""}${row.weeklyMovePct.toFixed(2)}%`}</div>
                                <div>Open {formatPrice(row.weeklyOpenPrice)} · Close {formatPrice(row.weeklyClosePrice)}</div>
                                <div className="mt-1">24h move {formatMove(row.move24hPct)}</div>
                              </div>
                              {matrixUi.showIntradayDetail ? (
                                <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                  <div className="font-semibold text-[var(--foreground)]">{matrixUi.detailTitle ?? "Entry Detail"}</div>
                                  <div className="mt-1">Range {formatPct(row.adrPct, 2)} · Bars {row.adrBarsUsed || 0}</div>
                                  <div className="mt-1">Long trigger {formatPrice(row.longTriggerPrice)} · Short trigger {formatPrice(row.shortTriggerPrice)}</div>
                                  <div>Long TP {formatPrice(row.longTpPrice)} · Short TP {formatPrice(row.shortTpPrice)}</div>
                                  <div className="mt-1">Week range {formatPrice(row.weekLowPrice)} - {formatPrice(row.weekHighPrice)} · Current {formatPrice(row.currentPrice)}</div>
                                </div>
                              ) : null}
                              {matrixUi.showIntradayDetail ? (
                                <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs text-[color:var(--muted)]">
                                  <div className="font-semibold text-[var(--foreground)]">Trade Profile</div>
                                  <div className="mt-1">Trades {row.adrTradeCount} · TP {row.adrTrades.filter(t => t.exitReason === "tp").length} · Active {row.adrTrades.filter(t => t.exitReason === "active").length}</div>
                                  <div>P/L {`${row.adrTrades.reduce((sum, trade) => sum + (trade.pnlPct ?? 0), 0) >= 0 ? "+" : ""}${row.adrTrades.reduce((sum, trade) => sum + (trade.pnlPct ?? 0), 0).toFixed(2)}%`}</div>
                                </div>
                              ) : null}
                              {matrixUi.showIntradayDetail && row.adrTrades.length > 0 ? (
                                <details className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 text-xs lg:col-span-3">
                                  <summary className="cursor-pointer px-3 py-2 font-semibold text-[var(--foreground)] select-none">Trade Breakdown ({row.adrTrades.length})</summary>
                                  <div className="space-y-1 px-3 pb-2">
                                    {row.adrTrades.map((trade) => {
                                      const tid = makeTradeId(trade, row.assetClass);
                                      const status = formatExitStatus(trade.exitReason);
                                      return (
                                        <div key={tid} className="flex items-start gap-2 rounded border border-[var(--panel-border)] bg-[var(--panel)]/50 px-2 py-1">
                                          <span className="shrink-0 font-mono text-[10px] text-[color:var(--muted)]">{tid}</span>
                                          <span className="text-[11px] text-[var(--foreground)]">
                                            {formatPrice(trade.entryPrice)} → {formatPrice(trade.tpPrice)}{" "}
                                            <span className={trade.exitReason === "tp" ? "text-emerald-400" : trade.exitReason === "active" ? "text-yellow-400" : ""}>{status}</span>
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              ) : null}
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
