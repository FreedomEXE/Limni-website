/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-session-top-pick.ts
 *
 * Description:
 * Session-level trade selection backtest for the Flagship manual trading system.
 * Evaluates top-1 and top-2 daily picks by trading session (Asia/London/NY)
 * against the gated weekly universe with Bitget MT5 profile constraints.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { getPool } from "../src/lib/db";
import {
  listPerformanceWeeks,
  readPerformanceSnapshotsByWeek,
  type PerformanceSnapshot,
} from "../src/lib/performanceSnapshots";
import { classifyWeeklyBias, type ConfidenceTier, type Direction } from "../src/lib/bitgetBotSignals";
import { normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { CotSnapshot } from "../src/lib/cotTypes";
import { readLiquidationHistory, type LiquidationSnapshotRow } from "../src/lib/marketSnapshots";
import { fetchOandaCandleSeries, type OandaHourlyCandle } from "../src/lib/oandaPrices";

type GateDecision = "PASS" | "REDUCE" | "SKIP" | "NO_DATA";
type TradeDirection = "LONG" | "SHORT";
type AssetClassId = "fx" | "indices" | "crypto" | "commodities";
type ProfileId = "bitget_mt5" | "all_assets";
type BacktestMode = "weekly-attr" | "session-pnl";
type BacktestVariant = "session" | "daily-7pm";
type SessionName = "ASIA" | "LONDON" | "NY" | "DAILY_7PM";
type SessionWindowName = "ASIA" | "LONDON" | "NY";
type PnlSource = "WEEKLY_ATTR" | "BITGET_SESSION" | "OANDA_SESSION" | "WEEKLY_ESTIMATE";

type CliConfig = {
  weeks: number;
  topN: number;
  mode: BacktestMode;
  variant: BacktestVariant;
  profile: ProfileId;
  reduceAsSkip: boolean;
  strict: boolean;
  outPath: string;
};

type PairWeekSignal = {
  weekOpenUtc: string;
  assetClass: AssetClassId;
  pair: string;
  direction: Direction;
  tier: ConfidenceTier;
  tradePnlPct: number | null;
  actionable8w: number;
  flips8w: number;
  consistency8w: number;
};

type CotWeekSnapshot = { weekOpenCanonical: string; weekOpenMs: number; snapshot: CotSnapshot };
type CotAssetHistory = { assetClass: AssetClassId; weeks: CotWeekSnapshot[] };
type CotPairMeta = { assetClass: AssetClassId; base: string; quote: string };
type CotGateContext = {
  byAssetClass: Map<AssetClassId, CotAssetHistory>;
  pairMeta: Map<string, CotPairMeta>;
  minHistoryWeeks: number;
  skipPercentile: number;
  reducePercentile: number;
};

type PairSummary = {
  winRatePct: number;
  cumulativePnlPct: number;
  maxDrawdownPct: number;
  pricedTrades: number;
};

type DailyOverlay = {
  decision: GateDecision;
  reasons: string[];
  gateSource: "CRYPTO_LIQUIDATION_DAILY" | "COT_WEEKLY_FALLBACK" | "COT_WEEKLY" | "COT_WEEKLY_NO_OVERLAY";
  gateAsOfUtc: string | null;
};

type ScoredCandidate = {
  signal: PairWeekSignal;
  weekGateDecision: GateDecision;
  weekGateReasons: string[];
  overlay: DailyOverlay;
  score: number;
  notes: string[];
  pnlPct: number | null;
  pnlSource: PnlSource;
};

type SelectedPick = {
  pair: string;
  assetClass: AssetClassId;
  direction: TradeDirection;
  tier: ConfidenceTier;
  score: number;
  weekGateDecision: GateDecision;
  dailyGateDecision: GateDecision;
  gateSource: DailyOverlay["gateSource"];
  weekGateReasons: string[];
  dailyGateReasons: string[];
  gateAsOfUtc: string | null;
  sessionPnlPct: number | null;
  pnlSource: PnlSource;
  contributionPnlPct: number;
};

type SessionRow = {
  weekOpenUtc: string;
  dayIso: string;
  session: SessionName;
  sessionStartUtc: string;
  sessionEndUtc: string;
  candidatesConsidered: number;
  passCandidates: number;
  selected: SelectedPick[];
  sessionPnlPct: number;
  outcome: "WIN" | "LOSS" | "FLAT" | "NO_TRADE";
  diagnostics: string[];
};

type SessionStats = {
  totalSessions: number;
  tradedSessions: number;
  noTradeSessions: number;
  winRate: number;
  avgPnl: number;
  cumPnl: number;
  maxDD: number;
};

type Summary = {
  mode: BacktestMode;
  variant: BacktestVariant;
  profile: string;
  topN: number;
  weeksAnalyzed: number;
  totalTradingSessions: number;
  tradedSessions: number;
  noTradeSessions: number;
  winSessions: number;
  lossSessions: number;
  flatSessions: number;
  winRatePct: number;
  avgPnlPerSessionPct: number;
  cumulativePnlPct: number;
  maxDrawdownPct: number;
  maxConcurrentOpenTrades: number;
  bySession: Record<string, SessionStats>;
  byAssetClass: Record<string, { trades: number; winRate: number; cumPnl: number }>;
  pairFrequency: Array<{ pair: string; timesSelected: number; cumPnl: number }>;
};

const SESSION_DEFS = [
  { name: "ASIA" as const satisfies SessionWindowName, startHourUtc: 0, endHourUtc: 8 },
  { name: "LONDON" as const satisfies SessionWindowName, startHourUtc: 8, endHourUtc: 13 },
  { name: "NY" as const satisfies SessionWindowName, startHourUtc: 13, endHourUtc: 21 },
];

const ALLOWED_INDICES = new Set(["SPXUSD", "NDXUSD", "NIKKEIUSD"]);
const ALLOWED_COMMODITIES = new Set(["XAUUSD", "XAGUSD"]);
const ALLOWED_CRYPTO = new Set(["BTCUSD", "ETHUSD"]);

const COT_PAIR_ALIASES = new Map<string, string>([
  ["US500", "SPXUSD"],
  ["SP500", "SPXUSD"],
  ["US100", "NDXUSD"],
  ["NAS100", "NDXUSD"],
  ["JP225", "NIKKEIUSD"],
  ["NIK225", "NIKKEIUSD"],
  ["GOLD", "XAUUSD"],
  ["SILVER", "XAGUSD"],
  ["USOIL", "WTIUSD"],
  ["UKOIL", "WTIUSD"],
]);

const COT_MARKET_ALIASES = new Map<string, string>([
  ["NAS100", "NDX"],
  ["US100", "NDX"],
  ["SP500", "SPX"],
  ["US500", "SPX"],
  ["JP225", "NIKKEI"],
  ["NIK225", "NIKKEI"],
  ["GOLD", "XAU"],
  ["SILVER", "XAG"],
  ["USOIL", "WTI"],
  ["UKOIL", "WTI"],
]);

function round(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toFinite(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgs(): CliConfig {
  const byKey = new Map<string, string>();
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    byKey.set(key.trim().toLowerCase(), rest.join("="));
  }
  const weeksRaw = Number(byKey.get("weeks"));
  const topRaw = Number(byKey.get("top-n"));
  const modeRaw = String(byKey.get("mode") ?? "weekly-attr").trim().toLowerCase();
  const variantRaw = String(byKey.get("variant") ?? "session").trim().toLowerCase();
  const profileRaw = String(byKey.get("profile") ?? "bitget_mt5").trim().toLowerCase();
  const reduceRaw = String(byKey.get("reduce-as-skip") ?? "true").trim().toLowerCase();
  const strictRaw = String(byKey.get("strict") ?? "false").trim().toLowerCase();
  return {
    weeks: Number.isFinite(weeksRaw) ? Math.max(2, Math.floor(weeksRaw)) : 8,
    topN: Number.isFinite(topRaw) ? Math.min(3, Math.max(1, Math.floor(topRaw))) : 1,
    mode: modeRaw === "session-pnl" ? "session-pnl" : "weekly-attr",
    variant: variantRaw === "daily-7pm" ? "daily-7pm" : "session",
    profile: profileRaw === "all_assets" ? "all_assets" : "bitget_mt5",
    reduceAsSkip: ["1", "true", "yes", "on"].includes(reduceRaw),
    strict: ["1", "true", "yes", "on"].includes(strictRaw),
    outPath: byKey.get("out")?.trim() || "reports/bias-gate/session-backtest-latest.json",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeDirection(value: unknown): Direction {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "LONG" || raw === "BULLISH") return "LONG";
  if (raw === "SHORT" || raw === "BEARISH") return "SHORT";
  return "NEUTRAL";
}

function inferBaseReturnFromPairDetail(detailRaw: unknown): number | null {
  const detail = asRecord(detailRaw);
  const percent = Number(detail.percent);
  if (!Number.isFinite(percent)) return null;
  const direction = normalizeDirection(detail.direction);
  if (direction === "LONG") return percent;
  if (direction === "SHORT") return -percent;
  return null;
}

function tradeReturnFromBase(baseReturnPct: number | null, direction: Direction): number | null {
  if (baseReturnPct === null) return null;
  if (direction === "LONG") return baseReturnPct;
  if (direction === "SHORT") return -baseReturnPct;
  return null;
}

function computeMaxDrawdown(returns: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const ret of returns) {
    equity += ret;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function weekOpenFromCotReportDate(reportDate: string): string | null {
  const report = DateTime.fromISO(reportDate, { zone: "utc" }).startOf("day");
  if (!report.isValid) return null;
  return report.startOf("week").plus({ weeks: 1 }).toUTC().toISO();
}

function resolveCotMarketId(assetClass: AssetClassId, marketId: string): string | null {
  const raw = String(marketId ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (assetClass !== "fx" && raw === "USD") return null;
  return COT_MARKET_ALIASES.get(raw) ?? raw;
}

function resolveCotMarketNet(snapshot: CotSnapshot, assetClass: AssetClassId, marketId: string): number | null {
  const resolvedMarketId = resolveCotMarketId(assetClass, marketId);
  if (!resolvedMarketId) return null;
  const market = snapshot.currencies[resolvedMarketId] as Record<string, unknown> | undefined;
  if (!market) return null;
  if (assetClass === "commodities") {
    const commercialLong = Number(market.commercial_long);
    const commercialShort = Number(market.commercial_short);
    if (Number.isFinite(commercialLong) && Number.isFinite(commercialShort)) return commercialLong - commercialShort;
  }
  const dealerLong = Number(market.dealer_long);
  const dealerShort = Number(market.dealer_short);
  if (!Number.isFinite(dealerLong) || !Number.isFinite(dealerShort)) return null;
  return dealerShort - dealerLong;
}

function directionalPercentile(values: number[], current: number, direction: TradeDirection): number {
  if (values.length === 0) return 0;
  if (direction === "LONG") return (values.filter((value) => value <= current).length / values.length) * 100;
  return (values.filter((value) => value >= current).length / values.length) * 100;
}

function normalizeCotPairAlias(pair: string): { canonicalPair: string; aliasApplied: boolean } {
  const normalized = pair.trim().toUpperCase();
  const aliased = COT_PAIR_ALIASES.get(normalized);
  if (!aliased) return { canonicalPair: normalized, aliasApplied: false };
  return { canonicalPair: aliased, aliasApplied: aliased !== normalized };
}

async function buildCotGateContext(): Promise<CotGateContext> {
  const byAssetClass = new Map<AssetClassId, CotAssetHistory>();
  const pairMeta = new Map<string, CotPairMeta>();

  (["fx", "indices", "commodities", "crypto"] as AssetClassId[]).forEach((assetClass) => {
    for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
      const canonicalPair = pairDef.pair.trim().toUpperCase();
      const meta = { assetClass, base: pairDef.base, quote: pairDef.quote };
      pairMeta.set(canonicalPair, meta);
      for (const [alias, target] of COT_PAIR_ALIASES.entries()) {
        if (target.trim().toUpperCase() === canonicalPair) pairMeta.set(alias, meta);
      }
    }
  });

  for (const assetClass of ["fx", "indices", "commodities", "crypto"] as AssetClassId[]) {
    const history = await readSnapshotHistory(assetClass, 260);
    const weeks = history
      .map((snapshot) => {
        const weekOpen = weekOpenFromCotReportDate(snapshot.report_date);
        if (!weekOpen) return null;
        const canonical = normalizeWeekOpenUtc(weekOpen) ?? weekOpen;
        const weekOpenMs = DateTime.fromISO(canonical, { zone: "utc" }).toMillis();
        if (!Number.isFinite(weekOpenMs)) return null;
        return { weekOpenCanonical: canonical, weekOpenMs, snapshot };
      })
      .filter((entry): entry is CotWeekSnapshot => entry !== null)
      .sort((a, b) => a.weekOpenMs - b.weekOpenMs);
    byAssetClass.set(assetClass, { assetClass, weeks });
  }

  return { byAssetClass, pairMeta, minHistoryWeeks: 10, skipPercentile: 90, reducePercentile: 75 };
}

function evaluateCotPercentileGate(options: {
  pair: string;
  weekOpenUtc: string;
  direction: TradeDirection;
  assetClass: AssetClassId;
  context: CotGateContext;
}): { decision: GateDecision; reasons: string[] } {
  const { canonicalPair, aliasApplied } = normalizeCotPairAlias(options.pair);
  const meta = options.context.pairMeta.get(canonicalPair);
  if (!meta) return { decision: "NO_DATA", reasons: ["COT_PAIR_META_MISSING"] };

  const assetHistory = options.context.byAssetClass.get(meta.assetClass);
  if (!assetHistory || assetHistory.weeks.length === 0) return { decision: "NO_DATA", reasons: ["COT_HISTORY_MISSING"] };

  const targetWeek = normalizeWeekOpenUtc(options.weekOpenUtc) ?? options.weekOpenUtc;
  const targetMs = DateTime.fromISO(targetWeek, { zone: "utc" }).toMillis();
  if (!Number.isFinite(targetMs)) return { decision: "NO_DATA", reasons: ["COT_INVALID_WEEK"] };

  let snapshotIndex = -1;
  for (let i = 0; i < assetHistory.weeks.length; i += 1) {
    if (assetHistory.weeks[i].weekOpenMs <= targetMs) snapshotIndex = i;
    else break;
  }
  if (snapshotIndex < 0) return { decision: "NO_DATA", reasons: ["COT_NO_PRIOR_SNAPSHOT"] };
  if (snapshotIndex + 1 < options.context.minHistoryWeeks) return { decision: "NO_DATA", reasons: ["COT_INSUFFICIENT_HISTORY"] };

  const baseTradeDirection: TradeDirection = options.direction;
  const quoteTradeDirection: TradeDirection = options.direction === "LONG" ? "SHORT" : "LONG";
  const weeksSlice = assetHistory.weeks.slice(0, snapshotIndex + 1);

  const baseMarketId = resolveCotMarketId(meta.assetClass, meta.base);
  const quoteMarketId = resolveCotMarketId(meta.assetClass, meta.quote);
  if (!baseMarketId) return { decision: "NO_DATA", reasons: ["COT_BASE_MARKET_UNRESOLVED"] };

  const baseSeries = weeksSlice.map((row) => resolveCotMarketNet(row.snapshot, meta.assetClass, baseMarketId)).filter((v): v is number => v !== null);
  const quoteSeries = quoteMarketId
    ? weeksSlice.map((row) => resolveCotMarketNet(row.snapshot, meta.assetClass, quoteMarketId)).filter((v): v is number => v !== null)
    : [];

  if (baseSeries.length < options.context.minHistoryWeeks) return { decision: "NO_DATA", reasons: ["COT_BASE_HISTORY_GAPS"] };
  if (quoteMarketId && quoteSeries.length < options.context.minHistoryWeeks) return { decision: "NO_DATA", reasons: ["COT_QUOTE_HISTORY_GAPS"] };

  const baseCurrent = baseSeries[baseSeries.length - 1];
  const basePct = directionalPercentile(baseSeries, baseCurrent, baseTradeDirection);
  const quoteCurrent = quoteSeries.length > 0 ? quoteSeries[quoteSeries.length - 1] : null;
  const quotePct = quoteCurrent === null ? null : directionalPercentile(quoteSeries, quoteCurrent, quoteTradeDirection);

  const reasons: string[] = [];
  if (aliasApplied) reasons.push("COT_PAIR_ALIAS_APPLIED");
  if (!quoteMarketId) reasons.push("COT_SINGLE_MARKET_MODE_BASE_ONLY");

  if (basePct > options.context.skipPercentile || (quotePct !== null && quotePct > options.context.skipPercentile)) {
    if (basePct > options.context.skipPercentile) reasons.push("COT_SKIP_BASE_EXTREME");
    if (quotePct !== null && quotePct > options.context.skipPercentile) reasons.push("COT_SKIP_QUOTE_EXTREME");
    return { decision: "SKIP", reasons };
  }
  if (basePct > options.context.reducePercentile || (quotePct !== null && quotePct > options.context.reducePercentile)) {
    if (basePct > options.context.reducePercentile) reasons.push("COT_REDUCE_BASE_CROWDED");
    if (quotePct !== null && quotePct > options.context.reducePercentile) reasons.push("COT_REDUCE_QUOTE_CROWDED");
    return { decision: "REDUCE", reasons };
  }
  return { decision: "PASS", reasons: ["COT_PASS"] };
}

function buildPairWeekSignals(weekOpenUtc: string, snapshots: PerformanceSnapshot[]): PairWeekSignal[] {
  const byPair = new Map<string, {
    assetClass: AssetClassId;
    pair: string;
    dealer: Direction;
    commercial: Direction;
    sentiment: Direction;
    baseByModel: Record<"dealer" | "commercial" | "sentiment", number | null>;
  }>();

  for (const row of snapshots) {
    if (row.model !== "dealer" && row.model !== "commercial" && row.model !== "sentiment") continue;
    const details = Array.isArray(row.pair_details) ? row.pair_details : [];
    for (const rawDetail of details) {
      const detail = asRecord(rawDetail);
      const pair = String(detail.pair ?? "").trim().toUpperCase();
      if (!pair) continue;
      const assetClass = row.asset_class as AssetClassId;
      const key = `${assetClass}|${pair}`;
      const existing = byPair.get(key) ?? {
        assetClass,
        pair,
        dealer: "NEUTRAL" as Direction,
        commercial: "NEUTRAL" as Direction,
        sentiment: "NEUTRAL" as Direction,
        baseByModel: { dealer: null, commercial: null, sentiment: null },
      };
      const direction = normalizeDirection(detail.direction);
      if (row.model === "dealer") existing.dealer = direction;
      if (row.model === "commercial") existing.commercial = direction;
      if (row.model === "sentiment") existing.sentiment = direction;
      existing.baseByModel[row.model] = inferBaseReturnFromPairDetail(detail);
      byPair.set(key, existing);
    }
  }

  const out: PairWeekSignal[] = [];
  for (const value of byPair.values()) {
    const classified = classifyWeeklyBias(value.dealer, value.commercial, value.sentiment);
    let baseReturn: number | null = null;
    for (const source of ["dealer", "commercial", "sentiment"] as const) {
      const inferred = value.baseByModel[source];
      if (inferred !== null) {
        baseReturn = inferred;
        break;
      }
    }
    out.push({
      weekOpenUtc,
      assetClass: value.assetClass,
      pair: value.pair,
      direction: classified.direction,
      tier: classified.tier,
      tradePnlPct: tradeReturnFromBase(baseReturn, classified.direction),
      actionable8w: 0,
      flips8w: 0,
      consistency8w: 0.5,
    });
  }
  return out;
}

function isTradableByProfile(profile: ProfileId, signal: PairWeekSignal): boolean {
  if (signal.direction !== "LONG" && signal.direction !== "SHORT") return false;
  if (profile === "all_assets") return true;
  const pair = signal.pair.toUpperCase();
  if (signal.assetClass === "fx") return true;
  if (signal.assetClass === "commodities") return ALLOWED_COMMODITIES.has(pair);
  if (signal.assetClass === "crypto") return ALLOWED_CRYPTO.has(pair);
  if (signal.assetClass === "indices") return ALLOWED_INDICES.has(pair);
  return false;
}

function isSessionEligible(signal: PairWeekSignal, session: SessionWindowName) {
  if (signal.assetClass === "fx") return true;
  if (signal.assetClass === "crypto") return true;
  if (signal.assetClass === "commodities") return session === "LONDON" || session === "NY";
  if (signal.assetClass === "indices") {
    if (signal.pair === "NIKKEIUSD") return session === "ASIA" || session === "LONDON";
    return session === "NY";
  }
  return false;
}

function buildTradingDays(weekOpenUtc: string): DateTime[] {
  const weekStart = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).startOf("day");
  if (!weekStart.isValid) return [];
  const monday = weekStart.weekday === 7 ? weekStart.plus({ days: 1 }) : weekStart.startOf("week");
  return [0, 1, 2, 3, 4].map((i) => monday.plus({ days: i }));
}

function riskCluster(pair: string) {
  return pair.includes("USD") ? "USD" : `CROSS:${pair}`;
}

function readPairSummary(pair: string): PairSummary | null {
  const lower = pair.toLowerCase();
  const candidates = [
    path.resolve(process.cwd(), "reports", "bias-gate", `${lower}-bias-backtest-latest.json`),
    path.resolve(process.cwd(), "reports", "bias-gate", `pair-backtest-${lower}-latest.json`),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(readFileSync(candidate, "utf8")) as { summary?: Record<string, unknown> };
      const summary = parsed.summary ?? {};
      return {
        winRatePct: toFinite(summary.winRatePct),
        cumulativePnlPct: toFinite(summary.cumulativePnlPct),
        maxDrawdownPct: toFinite(summary.maxDrawdownPct),
        pricedTrades: Math.max(0, Math.trunc(toFinite(summary.pricedTrades))),
      };
    } catch {
      return null;
    }
  }
  return null;
}

function scoreSignal(signal: PairWeekSignal, pairSummary: PairSummary | null): { score: number; notes: string[] } {
  const notes: string[] = [];
  const tierWeight = signal.tier === "HIGH" ? 100 : signal.tier === "MEDIUM" ? 60 : 20;
  let score = tierWeight;
  score += signal.consistency8w * 30;
  score += Math.min(signal.actionable8w, 8) * 2;
  score -= Math.min(signal.flips8w, 8) * 3;

  if (pairSummary) {
    score += pairSummary.winRatePct * 0.2;
    score += pairSummary.cumulativePnlPct * 4;
    score -= pairSummary.maxDrawdownPct * 2;
    score += Math.min(pairSummary.pricedTrades, 12) * 0.5;
    if (pairSummary.pricedTrades < 4) {
      score -= 20;
      notes.push("small_sample_penalty");
    }
  } else {
    score -= 12;
    notes.push("no_pair_backtest_penalty");
  }

  return { score, notes };
}

function pickTopWithCorrelationCap(candidates: ScoredCandidate[], topN: number): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];
  const clusters = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= topN) break;
    const cluster = riskCluster(candidate.signal.pair);
    if (topN > 1 && selected.length >= 1 && clusters.has(cluster)) continue;
    clusters.add(cluster);
    selected.push(candidate);
  }
  return selected;
}

function findLatestLiqSnapshotForSession(rows: LiquidationSnapshotRow[], sessionStart: DateTime): LiquidationSnapshotRow | null {
  const startMs = sessionStart.toMillis();
  const minMs = startMs - 24 * 60 * 60 * 1000;
  let best: LiquidationSnapshotRow | null = null;
  let bestMs = -Infinity;
  for (const row of rows) {
    const ms = Date.parse(row.snapshot_time_utc);
    if (!Number.isFinite(ms) || ms > startMs || ms < minMs) continue;
    if (ms > bestMs) {
      best = row;
      bestMs = ms;
    }
  }
  return best;
}

function evaluateDailyCryptoOverlay(signal: PairWeekSignal, weeklyDecision: GateDecision, weeklyReasons: string[], sessionStart: DateTime, liqRows: LiquidationSnapshotRow[]): DailyOverlay {
  const snapshot = findLatestLiqSnapshotForSession(liqRows, sessionStart);
  if (!snapshot) {
    return {
      decision: weeklyDecision,
      reasons: [...weeklyReasons, "CRYPTO_DAILY_NO_SNAPSHOT_FALLBACK"],
      gateSource: "COT_WEEKLY_FALLBACK",
      gateAsOfUtc: null,
    };
  }

  const total = snapshot.total_long_usd + snapshot.total_short_usd;
  if (!(total > 0)) {
    return {
      decision: weeklyDecision,
      reasons: [...weeklyReasons, "CRYPTO_DAILY_INVALID_TOTAL_FALLBACK"],
      gateSource: "COT_WEEKLY_FALLBACK",
      gateAsOfUtc: snapshot.snapshot_time_utc,
    };
  }

  const ratio = snapshot.total_long_usd / total;
  const direction = signal.direction as TradeDirection;
  const pass = direction === "LONG" ? ratio > 0.6 : ratio < 0.4;
  return {
    decision: pass ? "PASS" : "SKIP",
    reasons: pass ? ["liquidation_ratio_aligned"] : ["liquidation_imbalance"],
    gateSource: "CRYPTO_LIQUIDATION_DAILY",
    gateAsOfUtc: snapshot.snapshot_time_utc,
  };
}

function evaluateNonCryptoOverlay(weeklyDecision: GateDecision, weeklyReasons: string[], strict: boolean): DailyOverlay {
  if (strict) {
    return {
      decision: weeklyDecision,
      reasons: [...weeklyReasons, "no_daily_overlay_available"],
      gateSource: "COT_WEEKLY_NO_OVERLAY",
      gateAsOfUtc: null,
    };
  }
  return {
    decision: weeklyDecision,
    reasons: [...weeklyReasons],
    gateSource: "COT_WEEKLY",
    gateAsOfUtc: null,
  };
}

function shouldPassOverlay(signal: PairWeekSignal, overlay: DailyOverlay, strict: boolean): boolean {
  if (signal.assetClass !== "crypto" && strict && overlay.gateSource === "COT_WEEKLY_NO_OVERLAY") {
    return overlay.decision !== "SKIP";
  }
  return overlay.decision === "PASS" || (!strict && overlay.decision === "NO_DATA");
}

async function fetchCryptoSessionPnlPct(pair: string, direction: TradeDirection, sessionStart: DateTime, sessionEnd: DateTime): Promise<number | null> {
  const symbol = pair === "BTCUSD" ? "BTCUSDT" : pair === "ETHUSD" ? "ETHUSDT" : null;
  if (!symbol) return null;
  const url = new URL("https://api.bitget.com/api/v2/mix/market/history-candles");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("productType", "USDT-FUTURES");
  url.searchParams.set("granularity", "1H");
  url.searchParams.set("startTime", String(sessionStart.toMillis()));
  url.searchParams.set("endTime", String(sessionEnd.toMillis()));
  url.searchParams.set("limit", "200");
  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const json = (await response.json()) as { code?: string; data?: Array<Array<string | number>> };
    if (json.code && json.code !== "00000") return null;
    const rows = Array.isArray(json.data) ? json.data : [];
    if (rows.length < 1) return null;
    const normalized = rows
      .map((row) => ({ ts: Number(row[0]), open: Number(row[1]), close: Number(row[4]) }))
      .filter((row) => Number.isFinite(row.ts) && Number.isFinite(row.open) && Number.isFinite(row.close))
      .sort((a, b) => a.ts - b.ts);
    if (normalized.length < 1 || !(normalized[0].open > 0)) return null;
    const basePct = ((normalized[normalized.length - 1].close - normalized[0].open) / normalized[0].open) * 100;
    return direction === "LONG" ? basePct : -basePct;
  } catch {
    return null;
  }
}

async function fetchOandaSessionPnlPct(
  pair: string,
  direction: TradeDirection,
  sessionStart: DateTime,
  sessionEnd: DateTime,
): Promise<number | null> {
  try {
    // Rate limit: 100ms between OANDA candle requests.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const candles: OandaHourlyCandle[] = await fetchOandaCandleSeries(pair, sessionStart, sessionEnd);
    if (candles.length < 1) return null;
    const sorted = [...candles].sort((a, b) => a.ts - b.ts);
    const openPrice = sorted[0].open;
    const closePrice = sorted[sorted.length - 1].close;
    if (!(openPrice > 0)) return null;
    const basePct = ((closePrice - openPrice) / openPrice) * 100;
    return direction === "LONG" ? basePct : -basePct;
  } catch {
    return null;
  }
}

async function computePickPnl(mode: BacktestMode, signal: PairWeekSignal, sessionStart: DateTime, sessionEnd: DateTime, sessionPnlCache: Map<string, { pnlPct: number | null; pnlSource: PnlSource }>): Promise<{ pnlPct: number | null; pnlSource: PnlSource }> {
  if (mode === "weekly-attr") return { pnlPct: signal.tradePnlPct, pnlSource: "WEEKLY_ATTR" };

  const cacheKey = `${signal.pair}|${signal.direction}|${sessionStart.toISO()}`;
  const cached = sessionPnlCache.get(cacheKey);
  if (cached) return cached;

  if (signal.assetClass === "crypto") {
    const sessionPnl = await fetchCryptoSessionPnlPct(signal.pair, signal.direction as TradeDirection, sessionStart, sessionEnd);
    if (sessionPnl !== null) {
      const result = { pnlPct: sessionPnl, pnlSource: "BITGET_SESSION" as PnlSource };
      sessionPnlCache.set(cacheKey, result);
      return result;
    }

    // Bitget failed — try OANDA as secondary source for crypto.
    const oandaFallback = await fetchOandaSessionPnlPct(signal.pair, signal.direction as TradeDirection, sessionStart, sessionEnd);
    if (oandaFallback !== null) {
      const result = { pnlPct: oandaFallback, pnlSource: "OANDA_SESSION" as PnlSource };
      sessionPnlCache.set(cacheKey, result);
      return result;
    }

    const fallback = { pnlPct: signal.tradePnlPct === null ? null : signal.tradePnlPct / 5, pnlSource: "WEEKLY_ESTIMATE" as PnlSource };
    sessionPnlCache.set(cacheKey, fallback);
    return fallback;
  }

  const oandaPnl = await fetchOandaSessionPnlPct(signal.pair, signal.direction as TradeDirection, sessionStart, sessionEnd);
  if (oandaPnl !== null) {
    const result = { pnlPct: oandaPnl, pnlSource: "OANDA_SESSION" as PnlSource };
    sessionPnlCache.set(cacheKey, result);
    return result;
  }
  const fallback = { pnlPct: signal.tradePnlPct === null ? null : signal.tradePnlPct / 5, pnlSource: "WEEKLY_ESTIMATE" as PnlSource };
  sessionPnlCache.set(cacheKey, fallback);
  return fallback;
}

function writeArtifacts(output: Record<string, unknown>, outPath: string) {
  const stamp = DateTime.utc().toFormat("yyyy-LL-dd_HHmmss");
  const reportsDir = path.resolve(process.cwd(), "reports", "bias-gate");
  mkdirSync(reportsDir, { recursive: true });
  const latestPath = path.join(reportsDir, "session-backtest-latest.json");
  const datedPath = path.join(reportsDir, `session-backtest-${stamp}.json`);
  const customPath = path.resolve(process.cwd(), outPath);
  writeFileSync(latestPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(datedPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(customPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`\nReport written (latest): ${latestPath}`);
  console.log(`Report written (dated): ${datedPath}`);
  console.log(`Report written (custom): ${customPath}`);
}

async function main() {
  loadEnvConfig(process.cwd());
  const config = parseArgs();
  const weeksDesc = await listPerformanceWeeks(config.weeks);
  if (weeksDesc.length === 0) throw new Error("No performance snapshot weeks available.");
  const selectedWeeks = [...weeksDesc.slice(0, config.weeks)].sort((a, b) => a.localeCompare(b));

  const cotContext = await buildCotGateContext();
  const pairSummaryCache = new Map<string, PairSummary | null>();
  const sessionPnlCache = new Map<string, { pnlPct: number | null; pnlSource: PnlSource }>();
  const sessionKeys: SessionName[] =
    config.variant === "daily-7pm" ? ["DAILY_7PM"] : SESSION_DEFS.map((session) => session.name);

  const sessionRows: SessionRow[] = [];
  const allSessionReturns: number[] = [];
  const perSessionReturns = new Map<SessionName, number[]>(sessionKeys.map((name) => [name, []]));
  const perSessionCounts = new Map<SessionName, { total: number; traded: number; wins: number; losses: number; flats: number }>(
    sessionKeys.map((name) => [name, { total: 0, traded: 0, wins: 0, losses: 0, flats: 0 }]),
  );
  const assetReturns = new Map<string, number[]>();
  const pairFrequency = new Map<string, { timesSelected: number; cumPnl: number }>();
  const openedTradesByWeek = new Set<string>();
  const tradeEvents: Array<{ startMs: number; endMs: number }> = [];
  const diagnostics: string[] = [];

  for (const weekOpenRaw of selectedWeeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(weekOpenRaw) ?? weekOpenRaw;
    const snapshots = await readPerformanceSnapshotsByWeek(weekOpenUtc);
    const signals = buildPairWeekSignals(weekOpenUtc, snapshots)
      .filter((signal) => isTradableByProfile(config.profile, signal))
      .filter((signal) => signal.direction === "LONG" || signal.direction === "SHORT");

    const weeklyCandidates = signals
      .map((signal) => {
        const weeklyGate = evaluateCotPercentileGate({
          pair: signal.pair,
          weekOpenUtc,
          direction: signal.direction as TradeDirection,
          assetClass: signal.assetClass,
          context: cotContext,
        });
        let weekDecision = weeklyGate.decision;
        let weekReasons = weeklyGate.reasons;
        if (config.reduceAsSkip && weekDecision === "REDUCE") {
          weekDecision = "SKIP";
          weekReasons = [...weekReasons, "REDUCE_ESCALATED_TO_SKIP"];
        }
        return { signal, weekDecision, weekReasons };
      })
      .filter((entry) => entry.weekDecision === "PASS" || (!config.strict && entry.weekDecision === "NO_DATA"));

    const weekStart = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).startOf("day");
    const weekEnd = weekStart.plus({ days: 7 }).endOf("day");
    const btcRows = await readLiquidationHistory("BTC", weekStart.toISO() ?? "", weekEnd.toISO() ?? "");
    const ethRows = await readLiquidationHistory("ETH", weekStart.toISO() ?? "", weekEnd.toISO() ?? "");
    const liqByPair = new Map<string, LiquidationSnapshotRow[]>([["BTCUSD", btcRows], ["ETHUSD", ethRows]]);

    // Placeholder: when menthorq_gamma_snapshots table exists, add historical daily
    // non-crypto overlay re-evaluation here.
    if (config.strict) diagnostics.push(`STRICT_MODE_WEEK_${weekOpenUtc.slice(0, 10)}: non-crypto has no daily overlay table yet`);

    for (const day of buildTradingDays(weekOpenUtc)) {
      if (config.variant === "daily-7pm") {
        const sessionName: SessionName = "DAILY_7PM";
        const sessionStart = day.set({ hour: 23, minute: 0, second: 0, millisecond: 0 });
        const sessionEnd = config.mode === "session-pnl"
          ? day.plus({ days: 1 }).set({ hour: 21, minute: 0, second: 0, millisecond: 0 })
          : day.plus({ days: 1 }).startOf("day");
        const candidates: ScoredCandidate[] = [];
        const unlockedCandidatesCount = weeklyCandidates.filter(
          (entry) => !openedTradesByWeek.has(`${weekOpenUtc}|${entry.signal.pair}`),
        ).length;

        for (const entry of weeklyCandidates) {
          const signal = entry.signal;
          const pairWeekKey = `${weekOpenUtc}|${signal.pair}`;
          if (openedTradesByWeek.has(pairWeekKey)) continue;

          const overlay = signal.assetClass === "crypto"
            ? evaluateDailyCryptoOverlay(signal, entry.weekDecision, entry.weekReasons, sessionStart, liqByPair.get(signal.pair) ?? [])
            : evaluateNonCryptoOverlay(entry.weekDecision, entry.weekReasons, config.strict);

          if (!shouldPassOverlay(signal, overlay, config.strict)) continue;

          const summary = pairSummaryCache.has(signal.pair)
            ? pairSummaryCache.get(signal.pair) ?? null
            : readPairSummary(signal.pair);
          if (!pairSummaryCache.has(signal.pair)) pairSummaryCache.set(signal.pair, summary);

          signal.actionable8w = summary?.pricedTrades ?? 0;
          signal.flips8w = 0;
          signal.consistency8w = summary ? Math.max(0, Math.min(1, summary.winRatePct / 100)) : 0.5;
          const scored = scoreSignal(signal, summary);
          const pnl = await computePickPnl(config.mode, signal, sessionStart, sessionEnd, sessionPnlCache);

          candidates.push({
            signal,
            weekGateDecision: entry.weekDecision,
            weekGateReasons: entry.weekReasons,
            overlay,
            score: scored.score,
            notes: scored.notes,
            pnlPct: pnl.pnlPct,
            pnlSource: pnl.pnlSource,
          });
        }

        candidates.sort((a, b) => b.score - a.score || a.signal.pair.localeCompare(b.signal.pair));
        const selected = pickTopWithCorrelationCap(candidates, config.topN);

        let contribution = 0;
        const selectedRows: SelectedPick[] = [];
        for (const pick of selected) {
          const pairWeekKey = `${weekOpenUtc}|${pick.signal.pair}`;
          openedTradesByWeek.add(pairWeekKey);
          const contributionPnl = pick.pnlPct ?? 0;
          if (pick.pnlPct !== null) {
            const list = assetReturns.get(pick.signal.assetClass) ?? [];
            list.push(pick.pnlPct);
            assetReturns.set(pick.signal.assetClass, list);
            tradeEvents.push({ startMs: sessionStart.toMillis(), endMs: sessionEnd.toMillis() });
          }
          contribution += contributionPnl;

          const freq = pairFrequency.get(pick.signal.pair) ?? { timesSelected: 0, cumPnl: 0 };
          freq.timesSelected += 1;
          freq.cumPnl += contributionPnl;
          pairFrequency.set(pick.signal.pair, freq);

          selectedRows.push({
            pair: pick.signal.pair,
            assetClass: pick.signal.assetClass,
            direction: pick.signal.direction as TradeDirection,
            tier: pick.signal.tier,
            score: round(pick.score, 4),
            weekGateDecision: pick.weekGateDecision,
            dailyGateDecision: pick.overlay.decision,
            gateSource: pick.overlay.gateSource,
            weekGateReasons: pick.weekGateReasons,
            dailyGateReasons: pick.overlay.reasons,
            gateAsOfUtc: pick.overlay.gateAsOfUtc,
            sessionPnlPct: pick.pnlPct === null ? null : round(pick.pnlPct, 6),
            pnlSource: pick.pnlSource,
            contributionPnlPct: round(contributionPnl, 6),
          });
        }

        const count = perSessionCounts.get(sessionName);
        if (count) {
          count.total += 1;
          if (selectedRows.length > 0) count.traded += 1;
        }

        let outcome: SessionRow["outcome"] = "NO_TRADE";
        if (selectedRows.length > 0) {
          if (contribution > 0) {
            outcome = "WIN";
            if (count) count.wins += 1;
          } else if (contribution < 0) {
            outcome = "LOSS";
            if (count) count.losses += 1;
          } else {
            outcome = "FLAT";
            if (count) count.flats += 1;
          }
        }

        const sessionReturn = selectedRows.length > 0 ? contribution : 0;
        allSessionReturns.push(sessionReturn);
        perSessionReturns.get(sessionName)?.push(sessionReturn);
        sessionRows.push({
          weekOpenUtc,
          dayIso: day.toISODate() ?? "",
          session: sessionName,
          sessionStartUtc: sessionStart.toISO() ?? "",
          sessionEndUtc: sessionEnd.toISO() ?? "",
          candidatesConsidered: unlockedCandidatesCount,
          passCandidates: candidates.length,
          selected: selectedRows,
          sessionPnlPct: round(sessionReturn, 6),
          outcome,
          diagnostics: config.mode === "session-pnl"
            ? selectedRows.filter((row) => row.pnlSource === "WEEKLY_ESTIMATE").map((row) => `${row.pair}:WEEKLY_ESTIMATE`)
            : [],
        });
        continue;
      }

      for (const session of SESSION_DEFS) {
        const sessionStart = day.plus({ hours: session.startHourUtc });
        const sessionEnd = day.plus({ hours: session.endHourUtc });
        const candidates: ScoredCandidate[] = [];
        const eligibleUnlockedCount = weeklyCandidates.filter(
          (entry) => isSessionEligible(entry.signal, session.name) && !openedTradesByWeek.has(`${weekOpenUtc}|${entry.signal.pair}`),
        ).length;

        for (const entry of weeklyCandidates) {
          const signal = entry.signal;
          if (!isSessionEligible(signal, session.name)) continue;
          const pairWeekKey = `${weekOpenUtc}|${signal.pair}`;
          if (openedTradesByWeek.has(pairWeekKey)) continue;

          const overlay = signal.assetClass === "crypto"
            ? evaluateDailyCryptoOverlay(signal, entry.weekDecision, entry.weekReasons, sessionStart, liqByPair.get(signal.pair) ?? [])
            : evaluateNonCryptoOverlay(entry.weekDecision, entry.weekReasons, config.strict);

          if (!shouldPassOverlay(signal, overlay, config.strict)) continue;

          const summary = pairSummaryCache.has(signal.pair)
            ? pairSummaryCache.get(signal.pair) ?? null
            : readPairSummary(signal.pair);
          if (!pairSummaryCache.has(signal.pair)) pairSummaryCache.set(signal.pair, summary);

          signal.actionable8w = summary?.pricedTrades ?? 0;
          signal.flips8w = 0;
          signal.consistency8w = summary ? Math.max(0, Math.min(1, summary.winRatePct / 100)) : 0.5;
          const scored = scoreSignal(signal, summary);
          const pnl = await computePickPnl(config.mode, signal, sessionStart, sessionEnd, sessionPnlCache);

          candidates.push({
            signal,
            weekGateDecision: entry.weekDecision,
            weekGateReasons: entry.weekReasons,
            overlay,
            score: scored.score,
            notes: scored.notes,
            pnlPct: pnl.pnlPct,
            pnlSource: pnl.pnlSource,
          });
        }

        candidates.sort((a, b) => b.score - a.score || a.signal.pair.localeCompare(b.signal.pair));
        const selected = pickTopWithCorrelationCap(candidates, config.topN);

        let contribution = 0;
        const selectedRows: SelectedPick[] = [];
        for (const pick of selected) {
          const pairWeekKey = `${weekOpenUtc}|${pick.signal.pair}`;
          openedTradesByWeek.add(pairWeekKey);
          const contributionPnl = pick.pnlPct ?? 0;
          if (pick.pnlPct !== null) {
            const list = assetReturns.get(pick.signal.assetClass) ?? [];
            list.push(pick.pnlPct);
            assetReturns.set(pick.signal.assetClass, list);
            tradeEvents.push({ startMs: sessionStart.toMillis(), endMs: sessionEnd.toMillis() });
          }
          contribution += contributionPnl;

          const freq = pairFrequency.get(pick.signal.pair) ?? { timesSelected: 0, cumPnl: 0 };
          freq.timesSelected += 1;
          freq.cumPnl += contributionPnl;
          pairFrequency.set(pick.signal.pair, freq);

          selectedRows.push({
            pair: pick.signal.pair,
            assetClass: pick.signal.assetClass,
            direction: pick.signal.direction as TradeDirection,
            tier: pick.signal.tier,
            score: round(pick.score, 4),
            weekGateDecision: pick.weekGateDecision,
            dailyGateDecision: pick.overlay.decision,
            gateSource: pick.overlay.gateSource,
            weekGateReasons: pick.weekGateReasons,
            dailyGateReasons: pick.overlay.reasons,
            gateAsOfUtc: pick.overlay.gateAsOfUtc,
            sessionPnlPct: pick.pnlPct === null ? null : round(pick.pnlPct, 6),
            pnlSource: pick.pnlSource,
            contributionPnlPct: round(contributionPnl, 6),
          });
        }

        const count = perSessionCounts.get(session.name);
        if (count) {
          count.total += 1;
          if (selectedRows.length > 0) count.traded += 1;
        }

        let outcome: SessionRow["outcome"] = "NO_TRADE";
        if (selectedRows.length > 0) {
          if (contribution > 0) {
            outcome = "WIN";
            if (count) count.wins += 1;
          } else if (contribution < 0) {
            outcome = "LOSS";
            if (count) count.losses += 1;
          } else {
            outcome = "FLAT";
            if (count) count.flats += 1;
          }
        }

        const sessionReturn = selectedRows.length > 0 ? contribution : 0;
        allSessionReturns.push(sessionReturn);
        perSessionReturns.get(session.name)?.push(sessionReturn);
        sessionRows.push({
          weekOpenUtc,
          dayIso: day.toISODate() ?? "",
          session: session.name,
          sessionStartUtc: sessionStart.toISO() ?? "",
          sessionEndUtc: sessionEnd.toISO() ?? "",
          candidatesConsidered: eligibleUnlockedCount,
          passCandidates: candidates.length,
          selected: selectedRows,
          sessionPnlPct: round(sessionReturn, 6),
          outcome,
          diagnostics: config.mode === "session-pnl"
            ? selectedRows.filter((row) => row.pnlSource === "WEEKLY_ESTIMATE").map((row) => `${row.pair}:WEEKLY_ESTIMATE`)
            : [],
        });
      }
    }
  }

  const tradedSessions = sessionRows.filter((row) => row.selected.length > 0);
  const winSessions = tradedSessions.filter((row) => row.outcome === "WIN").length;
  const lossSessions = tradedSessions.filter((row) => row.outcome === "LOSS").length;
  const flatSessions = tradedSessions.filter((row) => row.outcome === "FLAT").length;

  const bySession: Summary["bySession"] = {};
  for (const sessionName of sessionKeys) {
    const counts = perSessionCounts.get(sessionName) ?? { total: 0, traded: 0, wins: 0, losses: 0, flats: 0 };
    const returns = perSessionReturns.get(sessionName) ?? [];
    const cum = returns.reduce((sum, value) => sum + value, 0);
    bySession[sessionName] = {
      totalSessions: counts.total,
      tradedSessions: counts.traded,
      noTradeSessions: Math.max(0, counts.total - counts.traded),
      winRate: counts.traded > 0 ? (counts.wins / counts.traded) * 100 : 0,
      avgPnl: counts.total > 0 ? cum / counts.total : 0,
      cumPnl: cum,
      maxDD: computeMaxDrawdown(returns),
    };
  }

  const byAssetClass: Summary["byAssetClass"] = {};
  for (const [asset, returns] of assetReturns.entries()) {
    const wins = returns.filter((value) => value > 0).length;
    const cum = returns.reduce((sum, value) => sum + value, 0);
    byAssetClass[asset] = { trades: returns.length, winRate: returns.length > 0 ? (wins / returns.length) * 100 : 0, cumPnl: cum };
  }

  const pairFrequencyRows = Array.from(pairFrequency.entries())
    .map(([pair, row]) => ({ pair, timesSelected: row.timesSelected, cumPnl: row.cumPnl }))
    .sort((a, b) => b.timesSelected - a.timesSelected || b.cumPnl - a.cumPnl);

  const events = tradeEvents.flatMap((event) => [{ t: event.startMs, d: 1 }, { t: event.endMs, d: -1 }]).sort((a, b) => (a.t === b.t ? a.d - b.d : a.t - b.t));
  let openCount = 0;
  let maxConcurrent = 0;
  for (const event of events) {
    openCount += event.d;
    if (openCount > maxConcurrent) maxConcurrent = openCount;
  }

  const totalTradingSessions = selectedWeeks.length * 5 * (config.variant === "daily-7pm" ? 1 : 3);
  const cumulativePnl = allSessionReturns.reduce((sum, value) => sum + value, 0);
  const summary: Summary = {
    mode: config.mode,
    variant: config.variant,
    profile: config.profile,
    topN: config.topN,
    weeksAnalyzed: selectedWeeks.length,
    totalTradingSessions,
    tradedSessions: tradedSessions.length,
    noTradeSessions: totalTradingSessions - tradedSessions.length,
    winSessions,
    lossSessions,
    flatSessions,
    winRatePct: tradedSessions.length > 0 ? (winSessions / tradedSessions.length) * 100 : 0,
    avgPnlPerSessionPct: allSessionReturns.length > 0 ? cumulativePnl / allSessionReturns.length : 0,
    cumulativePnlPct: cumulativePnl,
    maxDrawdownPct: computeMaxDrawdown(allSessionReturns),
    maxConcurrentOpenTrades: maxConcurrent,
    bySession,
    byAssetClass,
    pairFrequency: pairFrequencyRows,
  };

  console.log("=== Session-Level Top Pick Backtest ===");
  console.log(`Profile: ${config.profile}`);
  console.log(`Mode: ${config.mode}`);
  console.log(`Variant: ${config.variant === "session" ? "session (pair lockout)" : "daily-7pm (23:00 UTC)"}`);
  console.log(`Top N: ${config.topN}`);
  console.log(`Weeks: ${selectedWeeks.length}`);
  console.log("\n--- Aggregate ---");
  console.log(`Sessions tested: ${summary.totalTradingSessions}`);
  console.log(`Traded: ${summary.tradedSessions} | No-trade: ${summary.noTradeSessions}`);
  console.log(`Win: ${summary.winSessions} | Loss: ${summary.lossSessions} | Flat: ${summary.flatSessions}`);
  console.log(`Win rate: ${round(summary.winRatePct, 2)}%`);
  console.log(`Avg PnL/session: ${round(summary.avgPnlPerSessionPct, 6)}%`);
  console.log(`Cumulative: ${round(summary.cumulativePnlPct, 6)}%`);
  console.log(`Max DD: ${round(summary.maxDrawdownPct, 6)}%`);
  console.log(`Peak concurrent: ${summary.maxConcurrentOpenTrades}`);

  console.log("\n--- By Session ---");
  console.table(sessionKeys.map((sessionName) => ({
    session: sessionName,
    total: summary.bySession[sessionName].totalSessions,
    traded: summary.bySession[sessionName].tradedSessions,
    no_trade: summary.bySession[sessionName].noTradeSessions,
    win_rate: round(summary.bySession[sessionName].winRate, 2),
    avg_pnl: round(summary.bySession[sessionName].avgPnl, 6),
    cum_pnl: round(summary.bySession[sessionName].cumPnl, 6),
    max_dd: round(summary.bySession[sessionName].maxDD, 6),
  })));

  console.log("\n--- By Asset Class ---");
  console.table(Object.entries(summary.byAssetClass).map(([asset, row]) => ({
    asset,
    trades: row.trades,
    win_rate: round(row.winRate, 2),
    cum_pnl: round(row.cumPnl, 6),
  })));

  if (config.mode === "session-pnl") {
    const sourceCounts = new Map<string, number>();
    for (const row of sessionRows) {
      for (const pick of row.selected) {
        const count = sourceCounts.get(pick.pnlSource) ?? 0;
        sourceCounts.set(pick.pnlSource, count + 1);
      }
    }
    console.log("\n--- PnL Source Breakdown ---");
    console.table(Array.from(sourceCounts.entries()).map(([source, count]) => ({ source, count })));
  }

  console.log("\n--- Top 10 Most Selected Pairs ---");
  console.table(summary.pairFrequency.slice(0, 10).map((row) => ({
    pair: row.pair,
    selected: row.timesSelected,
    cum_pnl: round(row.cumPnl, 6),
  })));

  const output = {
    generated_utc: new Date().toISOString(),
    git_commit: (() => {
      try {
        return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim() || null;
      } catch {
        return null;
      }
    })(),
    config,
    weeks: selectedWeeks,
    summary,
    session_rows: sessionRows,
    diagnostics,
    notes: [
      "Mode weekly-attr attributes full-week pair return to first selected session trade in the week.",
      "Mode session-pnl computes session return from Bitget (crypto) or OANDA (FX/metals/indices) H1 candles.",
      "OANDA candles require OANDA_API_KEY and OANDA_ACCOUNT_ID env vars.",
      "If OANDA fetch fails, falls back to WEEKLY_ESTIMATE (weekly return / 5).",
      "daily-7pm in session-pnl mode: entry 23:00 UTC, exit next day 21:00 UTC (~22h hold).",
      "Pair lockout: once a pair is selected in any session, it is excluded from all subsequent sessions that week.",
      "daily-7pm variant: single pick per day at 23:00 UTC (7pm ET), no session eligibility filter.",
    ],
  };
  writeArtifacts(output, config.outPath);
}

main()
  .catch((error) => {
    console.error("backtest-session-top-pick failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
