/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-daily-top-pick.ts
 *
 * Decision-day backtest:
 * - Uses weekly decision anchors (current system cadence)
 * - Builds pair votes (dealer/commercial/sentiment) per week
 * - Applies gate filter (crypto gate map + COT percentile gate)
 * - Picks top-N candidates and tracks decision-day PnL
 *
 * NOTE:
 * This is "daily" in the execution sense (pick the best setup at decision time),
 * but historical decisions are evaluated at weekly anchors because gate snapshots
 * are currently stored on weekly cadence for this dataset.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { loadEnvConfig } from "@next/env";
import { getPool } from "../src/lib/db";
import {
  listPerformanceWeeks,
  readPerformanceSnapshotsByWeek,
  type PerformanceSnapshot,
} from "../src/lib/performanceSnapshots";
import { classifyWeeklyBias, type Direction, type ConfidenceTier } from "../src/lib/bitgetBotSignals";
import { normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { CotSnapshot } from "../src/lib/cotTypes";

type GateDecision = "PASS" | "REDUCE" | "SKIP" | "NO_DATA";
type TradeDirection = "LONG" | "SHORT";
type AssetClassId = "fx" | "indices" | "crypto" | "commodities";
type ProfileId = "bitget_mt5" | "all_assets";

type CliConfig = {
  weeks: number;
  topN: number;
  strict: boolean;
  reduceAsSkip: boolean;
  profile: ProfileId;
  outPath: string;
};

type PairWeekSignal = {
  weekOpenUtc: string;
  assetClass: AssetClassId;
  pair: string;
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
  direction: Direction;
  tier: ConfidenceTier;
  baseReturnPct: number | null;
  tradePnlPct: number | null;
  baseSource: "dealer" | "commercial" | "sentiment" | null;
};

type CryptoGateMap = Map<string, { decision: GateDecision; reasons: string[] }>;

type CotWeekSnapshot = {
  weekOpenCanonical: string;
  weekOpenMs: number;
  snapshot: CotSnapshot;
};

type CotAssetHistory = {
  assetClass: AssetClassId;
  weeks: CotWeekSnapshot[];
};

type CotPairMeta = {
  assetClass: AssetClassId;
  base: string;
  quote: string;
};

type CotGateContext = {
  byAssetClass: Map<AssetClassId, CotAssetHistory>;
  pairMeta: Map<string, CotPairMeta>;
  minHistoryWeeks: number;
  skipPercentile: number;
  reducePercentile: number;
};

type PairHistory = {
  signals: Direction[];
  returns: number[];
};

type RankedCandidate = {
  signal: PairWeekSignal;
  gateDecision: GateDecision;
  gateReasons: string[];
  score: number;
  history: {
    actionableSignals: number;
    consistency: number;
    flips: number;
    winRatePct: number | null;
    cumulativePnlPct: number | null;
    maxDrawdownPct: number | null;
  };
};

type DecisionDayRow = {
  weekOpenUtc: string;
  selectedCount: number;
  selectedPairs: Array<{
    pair: string;
    assetClass: AssetClassId;
    direction: TradeDirection;
    tier: ConfidenceTier;
    tradePnlPct: number;
    score: number;
    gateDecision: GateDecision;
    gateReasons: string[];
  }>;
  pnlPct: number | null;
  outcome: "WIN" | "LOSS" | "FLAT" | "NO_TRADE";
  candidatesConsidered: number;
  candidatesPassedGate: number;
};

type BacktestSummary = {
  decisionDaysTotal: number;
  tradedDays: number;
  noTradeDays: number;
  winDays: number;
  lossDays: number;
  flatDays: number;
  winRatePct: number;
  avgPnlPct: number;
  cumulativePnlPct: number;
  maxDrawdownPct: number;
};

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

function parseArgs(): CliConfig {
  const byKey = new Map<string, string>();
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    byKey.set(key.trim(), rest.join("="));
  }

  const weeksRaw = Number(byKey.get("weeks"));
  const topRaw = Number(byKey.get("top"));
  const strictRaw = String(byKey.get("strict") ?? "true").trim().toLowerCase();
  const reduceAsSkipRaw = String(byKey.get("reduce-as-skip") ?? "true").trim().toLowerCase();
  const profileRaw = String(byKey.get("profile") ?? "bitget_mt5").trim().toLowerCase();
  const outPath =
    byKey.get("out")?.trim() || "app/reports/bias-gate/daily-top-pick-backtest-latest.json";

  return {
    weeks: Number.isFinite(weeksRaw) ? Math.max(2, Math.floor(weeksRaw)) : 8,
    topN: Number.isFinite(topRaw) ? Math.max(1, Math.floor(topRaw)) : 1,
    strict: !(strictRaw === "0" || strictRaw === "false" || strictRaw === "no"),
    reduceAsSkip:
      reduceAsSkipRaw === "1" || reduceAsSkipRaw === "true" || reduceAsSkipRaw === "yes" || reduceAsSkipRaw === "on",
    profile: profileRaw === "all_assets" ? "all_assets" : "bitget_mt5",
    outPath,
  };
}

function normalizeDirection(value: unknown): Direction {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "LONG" || raw === "BULLISH") return "LONG";
  if (raw === "SHORT" || raw === "BEARISH") return "SHORT";
  return "NEUTRAL";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function inferBaseReturnFromPairDetail(detailRaw: unknown): number | null {
  const detail = asRecord(detailRaw);
  const percent = toNumberOrNull(detail.percent);
  if (percent === null) return null;
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

function loadCryptoGateMap(symbol: "BTC" | "ETH"): CryptoGateMap {
  const reportsDir = path.resolve(process.cwd(), "app", "reports", "bias-gate");
  const latestPath = path.join(reportsDir, `${symbol.toLowerCase()}-latest.json`);
  if (!existsSync(latestPath)) return new Map();

  try {
    const parsed = JSON.parse(readFileSync(latestPath, "utf8")) as { signals?: unknown[] };
    const rows = Array.isArray(parsed.signals) ? parsed.signals : [];
    const out = new Map<string, { decision: GateDecision; reasons: string[] }>();
    for (const rawRow of rows) {
      const row = asRecord(rawRow);
      const weekStart = String(row.weekStartUtc ?? row.week_start_utc ?? "").trim();
      if (!weekStart) continue;
      const canonical = normalizeWeekOpenUtc(weekStart) ?? weekStart;
      const decisionRaw = String(row.gateDecision ?? row.gate_decision ?? "NO_DATA").trim().toUpperCase();
      const decision: GateDecision =
        decisionRaw === "PASS" || decisionRaw === "REDUCE" || decisionRaw === "SKIP" || decisionRaw === "NO_DATA"
          ? (decisionRaw as GateDecision)
          : "NO_DATA";
      const reasonsRaw = row.gateReasons ?? row.gate_reasons;
      const reasons = Array.isArray(reasonsRaw) ? reasonsRaw.map((item) => String(item)) : [];
      out.set(canonical, { decision, reasons });
    }
    return out;
  } catch {
    return new Map();
  }
}

function weekOpenFromCotReportDate(reportDate: string): string | null {
  const report = DateTime.fromISO(reportDate, { zone: "utc" }).startOf("day");
  if (!report.isValid) return null;
  const weekOpen = report.startOf("week").plus({ weeks: 1 }).toUTC().toISO();
  return weekOpen ?? null;
}

function parseCotNet(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveCotMarketId(assetClass: AssetClassId, marketId: string): string | null {
  const raw = String(marketId ?? "").trim().toUpperCase();
  if (!raw) return null;
  if ((assetClass === "indices" || assetClass === "commodities") && raw === "USD") return null;
  return COT_MARKET_ALIASES.get(raw) ?? raw;
}

function resolveCotMarketNet(
  snapshot: CotSnapshot,
  assetClass: AssetClassId,
  marketId: string,
): number | null {
  const resolvedMarketId = resolveCotMarketId(assetClass, marketId);
  if (!resolvedMarketId) return null;
  const market = snapshot.currencies[resolvedMarketId] as Record<string, unknown> | undefined;
  if (!market) return null;

  if (assetClass === "commodities") {
    const commercialLong = parseCotNet(market.commercial_long);
    const commercialShort = parseCotNet(market.commercial_short);
    if (commercialLong !== null && commercialShort !== null) {
      return commercialLong - commercialShort;
    }
  }

  const dealerLong = parseCotNet(market.dealer_long);
  const dealerShort = parseCotNet(market.dealer_short);
  if (dealerLong === null || dealerShort === null) return null;
  return dealerShort - dealerLong;
}

function directionalPercentile(values: number[], current: number, direction: TradeDirection): number {
  const n = values.length;
  if (n === 0) return 0;
  if (direction === "LONG") {
    return (values.filter((value) => value <= current).length / n) * 100;
  }
  return (values.filter((value) => value >= current).length / n) * 100;
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

  (["fx", "indices", "commodities"] as AssetClassId[]).forEach((assetClass) => {
    for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
      const canonicalPair = pairDef.pair.trim().toUpperCase();
      const meta = { assetClass, base: pairDef.base, quote: pairDef.quote } satisfies CotPairMeta;
      pairMeta.set(canonicalPair, meta);
      for (const [alias, target] of COT_PAIR_ALIASES.entries()) {
        if (target.trim().toUpperCase() === canonicalPair) {
          pairMeta.set(alias, meta);
        }
      }
    }
  });

  for (const assetClass of ["fx", "indices", "commodities"] as AssetClassId[]) {
    const history = await readSnapshotHistory(assetClass, 260);
    const weeks = history
      .map((snapshot) => {
        const weekOpen = weekOpenFromCotReportDate(snapshot.report_date);
        if (!weekOpen) return null;
        const canonical = normalizeWeekOpenUtc(weekOpen) ?? weekOpen;
        const millis = DateTime.fromISO(canonical, { zone: "utc" }).toMillis();
        if (!Number.isFinite(millis)) return null;
        return {
          weekOpenCanonical: canonical,
          weekOpenMs: millis,
          snapshot,
        } satisfies CotWeekSnapshot;
      })
      .filter((entry): entry is CotWeekSnapshot => entry !== null)
      .sort((a, b) => a.weekOpenMs - b.weekOpenMs);

    byAssetClass.set(assetClass, { assetClass, weeks });
  }

  return {
    byAssetClass,
    pairMeta,
    minHistoryWeeks: 10,
    skipPercentile: 90,
    reducePercentile: 75,
  };
}

function evaluateCotPercentileGate(options: {
  pair: string;
  weekOpenUtc: string;
  direction: TradeDirection;
  assetClass: AssetClassId;
  context: CotGateContext;
}): { decision: GateDecision; reasons: string[] } {
  if (options.assetClass !== "fx" && options.assetClass !== "indices" && options.assetClass !== "commodities") {
    return { decision: "NO_DATA", reasons: ["COT_UNSUPPORTED_ASSET_CLASS"] };
  }

  const { canonicalPair, aliasApplied } = normalizeCotPairAlias(options.pair);
  const meta = options.context.pairMeta.get(canonicalPair);
  if (!meta) return { decision: "NO_DATA", reasons: ["COT_PAIR_META_MISSING"] };

  const assetHistory = options.context.byAssetClass.get(meta.assetClass);
  if (!assetHistory || assetHistory.weeks.length === 0) {
    return { decision: "NO_DATA", reasons: ["COT_HISTORY_MISSING"] };
  }

  const targetWeek = normalizeWeekOpenUtc(options.weekOpenUtc) ?? options.weekOpenUtc;
  const targetMs = DateTime.fromISO(targetWeek, { zone: "utc" }).toMillis();
  if (!Number.isFinite(targetMs)) return { decision: "NO_DATA", reasons: ["COT_INVALID_WEEK"] };

  let snapshotIndex = -1;
  for (let i = 0; i < assetHistory.weeks.length; i += 1) {
    if (assetHistory.weeks[i].weekOpenMs <= targetMs) snapshotIndex = i;
    else break;
  }
  if (snapshotIndex < 0) return { decision: "NO_DATA", reasons: ["COT_NO_PRIOR_SNAPSHOT"] };
  if (snapshotIndex + 1 < options.context.minHistoryWeeks) {
    return { decision: "NO_DATA", reasons: ["COT_INSUFFICIENT_HISTORY"] };
  }

  const baseTradeDirection: TradeDirection = options.direction;
  const quoteTradeDirection: TradeDirection = options.direction === "LONG" ? "SHORT" : "LONG";
  const weeksSlice = assetHistory.weeks.slice(0, snapshotIndex + 1);

  const baseMarketId = resolveCotMarketId(meta.assetClass, meta.base);
  const quoteMarketId = resolveCotMarketId(meta.assetClass, meta.quote);
  if (!baseMarketId) return { decision: "NO_DATA", reasons: ["COT_BASE_MARKET_UNRESOLVED"] };

  const baseSeries = weeksSlice
    .map((row) => resolveCotMarketNet(row.snapshot, meta.assetClass, baseMarketId))
    .filter((value): value is number => value !== null);
  const quoteSeries = quoteMarketId
    ? weeksSlice
        .map((row) => resolveCotMarketNet(row.snapshot, meta.assetClass, quoteMarketId))
        .filter((value): value is number => value !== null)
    : [];

  if (baseSeries.length < options.context.minHistoryWeeks) {
    return { decision: "NO_DATA", reasons: ["COT_BASE_HISTORY_GAPS"] };
  }
  if (quoteMarketId && quoteSeries.length < options.context.minHistoryWeeks) {
    return { decision: "NO_DATA", reasons: ["COT_QUOTE_HISTORY_GAPS"] };
  }

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

function isTradableByProfile(profile: ProfileId, signal: PairWeekSignal): boolean {
  if (signal.direction !== "LONG" && signal.direction !== "SHORT") return false;
  if (profile === "all_assets") return true;
  if (signal.assetClass === "fx") return true;
  if (signal.assetClass === "commodities") {
    const pair = signal.pair.trim().toUpperCase();
    return pair === "XAUUSD" || pair === "XAGUSD";
  }
  if (signal.assetClass === "crypto") {
    const pair = signal.pair.trim().toUpperCase();
    return pair === "BTCUSD" || pair === "ETHUSD";
  }
  return false;
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

function historyStats(history: PairHistory): {
  actionableSignals: number;
  consistency: number;
  flips: number;
  winRatePct: number | null;
  cumulativePnlPct: number | null;
  maxDrawdownPct: number | null;
} {
  const actionableSignals = history.signals.filter((signal) => signal !== "NEUTRAL").length;
  const longCount = history.signals.filter((signal) => signal === "LONG").length;
  const shortCount = history.signals.filter((signal) => signal === "SHORT").length;
  const consistency = actionableSignals > 0 ? Math.max(longCount, shortCount) / actionableSignals : 0.5;

  let flips = 0;
  let prev: Direction | null = null;
  for (const signal of history.signals) {
    if (signal === "NEUTRAL") continue;
    if (prev && prev !== signal) flips += 1;
    prev = signal;
  }

  if (history.returns.length === 0) {
    return {
      actionableSignals,
      consistency,
      flips,
      winRatePct: null,
      cumulativePnlPct: null,
      maxDrawdownPct: null,
    };
  }

  const wins = history.returns.filter((value) => value > 0).length;
  const cumulative = history.returns.reduce((sum, value) => sum + value, 0);
  const drawdown = computeMaxDrawdown(history.returns);

  return {
    actionableSignals,
    consistency,
    flips,
    winRatePct: (wins / history.returns.length) * 100,
    cumulativePnlPct: cumulative,
    maxDrawdownPct: drawdown,
  };
}

function scoreCandidate(signal: PairWeekSignal, history: PairHistory): RankedCandidate {
  const stats = historyStats(history);
  const tierWeight = signal.tier === "HIGH" ? 100 : signal.tier === "MEDIUM" ? 60 : 20;
  let score = tierWeight;
  score += stats.consistency * 25;
  score += Math.min(stats.actionableSignals, 8) * 1.5;
  score -= Math.min(stats.flips, 8) * 2;

  if (stats.winRatePct !== null && stats.cumulativePnlPct !== null && stats.maxDrawdownPct !== null) {
    score += stats.winRatePct * 0.15;
    score += stats.cumulativePnlPct * 3;
    score -= stats.maxDrawdownPct * 1.5;
    score += Math.min(history.returns.length, 8) * 0.5;
  } else {
    score -= 6;
  }

  return {
    signal,
    gateDecision: "NO_DATA",
    gateReasons: [],
    score,
    history: stats,
  };
}

function buildPairWeekSignals(
  weekOpenUtc: string,
  snapshots: PerformanceSnapshot[],
): Map<string, PairWeekSignal> {
  type Mutable = {
    weekOpenUtc: string;
    assetClass: AssetClassId;
    pair: string;
    dealer: Direction;
    commercial: Direction;
    sentiment: Direction;
    baseByModel: Record<"dealer" | "commercial" | "sentiment", number | null>;
  };

  const byPair = new Map<string, Mutable>();

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
        weekOpenUtc,
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

  const out = new Map<string, PairWeekSignal>();
  for (const [key, value] of byPair.entries()) {
    const classified = classifyWeeklyBias(value.dealer, value.commercial, value.sentiment);
    let baseSource: "dealer" | "commercial" | "sentiment" | null = null;
    let baseReturnPct: number | null = null;
    for (const candidate of ["dealer", "commercial", "sentiment"] as const) {
      const inferred = value.baseByModel[candidate];
      if (inferred === null) continue;
      baseSource = candidate;
      baseReturnPct = inferred;
      break;
    }
    const tradePnlPct = tradeReturnFromBase(baseReturnPct, classified.direction);
    out.set(key, {
      weekOpenUtc: value.weekOpenUtc,
      assetClass: value.assetClass,
      pair: value.pair,
      dealer: value.dealer,
      commercial: value.commercial,
      sentiment: value.sentiment,
      direction: classified.direction,
      tier: classified.tier,
      baseReturnPct,
      tradePnlPct,
      baseSource,
    });
  }

  return out;
}

function writeArtifacts(output: Record<string, unknown>, outPath: string) {
  const stamp = DateTime.utc().toFormat("yyyy-LL-dd_HHmmss");
  const reportsDir = path.resolve(process.cwd(), "app", "reports", "bias-gate");
  mkdirSync(reportsDir, { recursive: true });
  const latestPath = path.join(reportsDir, "daily-top-pick-backtest-latest.json");
  const datedPath = path.join(reportsDir, `daily-top-pick-backtest-${stamp}.json`);
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
  if (weeksDesc.length === 0) {
    throw new Error("No performance snapshot weeks available.");
  }
  const selectedWeeks = [...weeksDesc.slice(0, config.weeks)].sort((a, b) => a.localeCompare(b));

  const btcGateMap = loadCryptoGateMap("BTC");
  const ethGateMap = loadCryptoGateMap("ETH");
  const cotContext = await buildCotGateContext();

  const pairHistory = new Map<string, PairHistory>();
  const decisionRows: DecisionDayRow[] = [];
  const tradedReturns: number[] = [];

  for (const weekOpenUtc of selectedWeeks) {
    const snapshots = await readPerformanceSnapshotsByWeek(weekOpenUtc);
    const pairSignals = buildPairWeekSignals(weekOpenUtc, snapshots);
    const weekCanonical = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;

    const tradableSignals = [...pairSignals.values()].filter((signal) => isTradableByProfile(config.profile, signal));
    const actionableSignals = tradableSignals.filter(
      (signal) => signal.direction === "LONG" || signal.direction === "SHORT",
    );

    const ranked: RankedCandidate[] = [];
    let candidatesPassedGate = 0;

    for (const signal of actionableSignals) {
      const historyKey = `${signal.assetClass}|${signal.pair}`;
      const history = pairHistory.get(historyKey) ?? { signals: [], returns: [] };
      const candidate = scoreCandidate(signal, history);

      let gateDecision: GateDecision = "NO_DATA";
      let gateReasons: string[] = [];

      if (signal.assetClass === "crypto") {
        const gateEntry =
          signal.pair === "BTCUSD" ? btcGateMap.get(weekCanonical)
            : signal.pair === "ETHUSD" ? ethGateMap.get(weekCanonical)
            : null;
        gateDecision = gateEntry?.decision ?? "NO_DATA";
        gateReasons = gateEntry?.reasons ?? ["CRYPTO_GATE_NO_DATA"];
      } else {
        const cot = evaluateCotPercentileGate({
          pair: signal.pair,
          weekOpenUtc: weekCanonical,
          direction: signal.direction as TradeDirection,
          assetClass: signal.assetClass,
          context: cotContext,
        });
        gateDecision = cot.decision;
        gateReasons = cot.reasons;
      }

      if (config.reduceAsSkip && gateDecision === "REDUCE") {
        gateDecision = "SKIP";
        gateReasons = [...gateReasons, "REDUCE_ESCALATED_TO_SKIP"];
      }

      candidate.gateDecision = gateDecision;
      candidate.gateReasons = gateReasons;

      const passGate = gateDecision === "PASS" || (!config.strict && gateDecision === "NO_DATA");
      if (passGate && signal.tradePnlPct !== null) {
        candidatesPassedGate += 1;
        ranked.push(candidate);
      }
    }

    ranked.sort((a, b) => b.score - a.score || a.signal.pair.localeCompare(b.signal.pair));
    const selected = ranked.slice(0, config.topN);
    const selectedPnls = selected
      .map((item) => item.signal.tradePnlPct)
      .filter((value): value is number => value !== null);
    const pnlPct =
      selectedPnls.length > 0
        ? selectedPnls.reduce((sum, value) => sum + value, 0) / selectedPnls.length
        : null;

    let outcome: DecisionDayRow["outcome"] = "NO_TRADE";
    if (pnlPct !== null) {
      tradedReturns.push(pnlPct);
      if (pnlPct > 0) outcome = "WIN";
      else if (pnlPct < 0) outcome = "LOSS";
      else outcome = "FLAT";
    }

    decisionRows.push({
      weekOpenUtc: weekCanonical,
      selectedCount: selected.length,
      selectedPairs: selected.map((item) => ({
        pair: item.signal.pair,
        assetClass: item.signal.assetClass,
        direction: item.signal.direction as TradeDirection,
        tier: item.signal.tier,
        tradePnlPct: round(item.signal.tradePnlPct ?? 0, 6),
        score: round(item.score, 4),
        gateDecision: item.gateDecision,
        gateReasons: item.gateReasons,
      })),
      pnlPct: pnlPct === null ? null : round(pnlPct, 6),
      outcome,
      candidatesConsidered: actionableSignals.length,
      candidatesPassedGate,
    });

    // Update historical memory after this decision day (no lookahead).
    for (const signal of actionableSignals) {
      const key = `${signal.assetClass}|${signal.pair}`;
      const current = pairHistory.get(key) ?? { signals: [], returns: [] };
      current.signals.push(signal.direction);
      if (signal.tradePnlPct !== null) {
        current.returns.push(signal.tradePnlPct);
      }
      pairHistory.set(key, current);
    }
  }

  const tradedDays = decisionRows.filter((row) => row.outcome !== "NO_TRADE");
  const winDays = tradedDays.filter((row) => row.outcome === "WIN").length;
  const lossDays = tradedDays.filter((row) => row.outcome === "LOSS").length;
  const flatDays = tradedDays.filter((row) => row.outcome === "FLAT").length;
  const cumulativePnl = tradedReturns.reduce((sum, value) => sum + value, 0);
  const avgPnl = tradedReturns.length > 0 ? cumulativePnl / tradedReturns.length : 0;
  const summary: BacktestSummary = {
    decisionDaysTotal: decisionRows.length,
    tradedDays: tradedDays.length,
    noTradeDays: decisionRows.length - tradedDays.length,
    winDays,
    lossDays,
    flatDays,
    winRatePct: tradedDays.length > 0 ? (winDays / tradedDays.length) * 100 : 0,
    avgPnlPct: avgPnl,
    cumulativePnlPct: cumulativePnl,
    maxDrawdownPct: computeMaxDrawdown(tradedReturns),
  };

  console.log("=== Top Pick Decision-Day Backtest ===");
  console.log(`Profile: ${config.profile}`);
  console.log(`Weeks used: ${selectedWeeks.length}`);
  console.log(`Top picks per decision day: ${config.topN}`);
  console.log(`Strict gate mode: ${config.strict ? "ON" : "OFF"}`);
  console.table(
    decisionRows.map((row) => ({
      week: row.weekOpenUtc.slice(0, 10),
      selected: row.selectedPairs.map((pair) => pair.pair).join(",") || "NONE",
      pnl_pct: row.pnlPct,
      outcome: row.outcome,
      considered: row.candidatesConsidered,
      passed_gate: row.candidatesPassedGate,
    })),
  );
  console.table([
    {
      decision_days_total: summary.decisionDaysTotal,
      traded_days: summary.tradedDays,
      no_trade_days: summary.noTradeDays,
      win_days: summary.winDays,
      loss_days: summary.lossDays,
      flat_days: summary.flatDays,
      win_rate_pct: round(summary.winRatePct, 2),
      avg_pnl_pct: round(summary.avgPnlPct, 6),
      cumulative_pnl_pct: round(summary.cumulativePnlPct, 6),
      max_drawdown_pct: round(summary.maxDrawdownPct, 6),
    },
  ]);

  const output = {
    generated_utc: new Date().toISOString(),
    config,
    weeks: selectedWeeks,
    decision_rows: decisionRows,
    summary: {
      ...summary,
      winRatePct: round(summary.winRatePct, 6),
      avgPnlPct: round(summary.avgPnlPct, 6),
      cumulativePnlPct: round(summary.cumulativePnlPct, 6),
      maxDrawdownPct: round(summary.maxDrawdownPct, 6),
    },
    notes: [
      "Decision-day backtest uses weekly anchors due current stored signal/gate cadence.",
      "Pair scoring uses only prior-week history (no lookahead).",
      "Crypto gate uses btc/eth backtest artifacts; non-crypto uses COT percentile gate.",
    ],
  };

  writeArtifacts(output, config.outPath);
}

main()
  .catch((error) => {
    console.error("backtest-daily-top-pick failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
