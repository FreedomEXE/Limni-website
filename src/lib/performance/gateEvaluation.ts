/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: gateEvaluation.ts
 *
 * Description:
 * Shared weekly gate evaluation helpers for canonical reconstruction
 * and related research scripts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { readSnapshotHistory } from "@/lib/cotStore";
import type { CotSnapshot } from "@/lib/cotTypes";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type GateDecision = "PASS" | "REDUCE" | "SKIP" | "NO_DATA";
export type TradeDirection = "LONG" | "SHORT";
export type GateSource = "CRYPTO_LIQUIDATION" | "COT_PERCENTILE" | "NONE";
export type GateMap = Map<string, Map<string, { decision: GateDecision; reasons: string[] }>>;

type CotWeekSnapshot = {
  weekOpenCanonical: string;
  weekOpenMs: number;
  snapshot: CotSnapshot;
};

type CotAssetHistory = {
  assetClass: AssetClass;
  weeks: CotWeekSnapshot[];
};

type CotPairMeta = {
  assetClass: AssetClass;
  base: string;
  quote: string;
};

export type CotGateContext = {
  byAssetClass: Map<AssetClass, CotAssetHistory>;
  pairMeta: Map<string, CotPairMeta>;
  minHistoryWeeks: number;
  skipPercentile: number;
  reducePercentile: number;
};

type GateSignalRow = {
  weekStartUtc: string | null;
  weekStartLegacy: string | null;
  weekStartAny: string | null;
  gateDecision: GateDecision;
  gateReasons: string[];
};

export type GateEvaluation = {
  decision: GateDecision;
  reasons: string[];
  source: GateSource;
};

const GATED_PAIRS = new Map<string, string>([
  ["BTCUSD", "BTC"],
  ["ETHUSD", "ETH"],
]);

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

function parseJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function toGateDecision(value: unknown): GateDecision {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "PASS" || raw === "REDUCE" || raw === "SKIP" || raw === "NO_DATA") {
    return raw;
  }
  return "NO_DATA";
}

function coerceGateSignalRows(raw: unknown): GateSignalRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const weekStartUtc = typeof row.weekStartUtc === "string"
      ? row.weekStartUtc
      : typeof row.week_start_utc === "string"
        ? row.week_start_utc
        : null;
    const weekStartLegacy = typeof row.week_start === "string"
      ? row.week_start
      : typeof row.weekStart === "string"
        ? row.weekStart
        : null;
    const reasonsRaw = row.gateReasons ?? row.gate_reasons;
    return {
      weekStartUtc,
      weekStartLegacy,
      weekStartAny: weekStartUtc ?? weekStartLegacy,
      gateDecision: toGateDecision(row.gateDecision ?? row.gate_decision),
      gateReasons: Array.isArray(reasonsRaw)
        ? reasonsRaw.map((value: unknown) => String(value))
        : [],
    };
  });
}

export function normalizePair(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function normalizeCotPairAlias(pair: string): { canonicalPair: string; aliasApplied: boolean } {
  const normalized = normalizePair(pair);
  const alias = COT_PAIR_ALIASES.get(normalized);
  if (!alias) {
    return { canonicalPair: normalized, aliasApplied: false };
  }
  return {
    canonicalPair: alias,
    aliasApplied: alias !== normalized,
  };
}

export function weekOpenFromCotReportDate(reportDate: string): string | null {
  const report = DateTime.fromISO(reportDate, { zone: "utc" }).startOf("day");
  if (!report.isValid) return null;
  return report.startOf("week").plus({ weeks: 1 }).toUTC().toISO();
}

function parseCotNet(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveCotMarketId(assetClass: AssetClass, marketId: string): string | null {
  const raw = String(marketId ?? "").trim().toUpperCase();
  if (!raw) return null;
  if ((assetClass === "indices" || assetClass === "commodities") && raw === "USD") {
    return null;
  }
  return COT_MARKET_ALIASES.get(raw) ?? raw;
}

export function resolveCotMarketNet(
  snapshot: CotSnapshot,
  assetClass: AssetClass,
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

export function directionalPercentile(values: number[], current: number, direction: TradeDirection): number {
  if (values.length === 0) return 0;
  if (direction === "LONG") {
    return (values.filter((value) => value <= current).length / values.length) * 100;
  }
  return (values.filter((value) => value >= current).length / values.length) * 100;
}

export function buildGateMapForSymbol(symbol: string): Map<string, { decision: GateDecision; reasons: string[] }> {
  const reportsDir = path.resolve(process.cwd(), "reports", "bias-gate");
  const localLatest = path.join(reportsDir, `${symbol.toLowerCase()}-latest.json`);
  const rootLatest = path.resolve(process.cwd(), "reports", `backtest-${symbol.toLowerCase()}-bias-gate-latest.json`);
  const source =
    parseJsonFile<Record<string, unknown>>(localLatest) ??
    parseJsonFile<Record<string, unknown>>(rootLatest);
  const output = new Map<string, { decision: GateDecision; reasons: string[] }>();
  if (!source) return output;

  for (const row of coerceGateSignalRows(source.signals)) {
    const candidates = [row.weekStartUtc, row.weekStartLegacy, row.weekStartAny]
      .filter((value): value is string => Boolean(value));
    for (const candidate of candidates) {
      const iso = candidate.includes("T") ? candidate : `${candidate}T00:00:00.000Z`;
      const canonical = normalizeWeekOpenUtc(iso) ?? normalizeWeekOpenUtc(candidate) ?? candidate;
      output.set(canonical, {
        decision: row.gateDecision,
        reasons: row.gateReasons,
      });
    }
  }

  return output;
}

export function buildGateMap(): GateMap {
  const gateMap: GateMap = new Map();
  for (const symbol of GATED_PAIRS.values()) {
    gateMap.set(symbol, buildGateMapForSymbol(symbol));
  }
  return gateMap;
}

export async function buildCotGateContext(
  options?: { minHistoryWeeks?: number; skipPercentile?: number; reducePercentile?: number },
): Promise<CotGateContext> {
  const pairMeta = new Map<string, CotPairMeta>();
  for (const assetClass of ["fx", "indices", "commodities"] as AssetClass[]) {
    for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
      const canonicalPair = normalizePair(pairDef.pair);
      const meta: CotPairMeta = {
        assetClass,
        base: pairDef.base,
        quote: pairDef.quote,
      };
      pairMeta.set(canonicalPair, meta);
      for (const [alias, target] of COT_PAIR_ALIASES.entries()) {
        if (normalizePair(target) === canonicalPair) {
          pairMeta.set(alias, meta);
        }
      }
    }
  }

  const byAssetClass = new Map<AssetClass, CotAssetHistory>();
  for (const assetClass of ["fx", "indices", "commodities"] as AssetClass[]) {
    const history = await readSnapshotHistory(assetClass, 260);
    const weeks = history
      .map((snapshot) => {
        const weekOpen = weekOpenFromCotReportDate(snapshot.report_date);
        if (!weekOpen) return null;
        const canonical = normalizeWeekOpenUtc(weekOpen) ?? weekOpen;
        const weekOpenMs = DateTime.fromISO(canonical, { zone: "utc" }).toMillis();
        if (!Number.isFinite(weekOpenMs)) return null;
        return {
          weekOpenCanonical: canonical,
          weekOpenMs,
          snapshot,
        } satisfies CotWeekSnapshot;
      })
      .filter((entry): entry is CotWeekSnapshot => entry !== null)
      .sort((left, right) => left.weekOpenMs - right.weekOpenMs);

    byAssetClass.set(assetClass, {
      assetClass,
      weeks,
    });
  }

  return {
    byAssetClass,
    pairMeta,
    minHistoryWeeks: options?.minHistoryWeeks ?? 10,
    skipPercentile: options?.skipPercentile ?? 90,
    reducePercentile: options?.reducePercentile ?? 75,
  };
}

export function evaluateCotPercentileGate(options: {
  pair: string;
  weekOpenUtc: string;
  direction: TradeDirection;
  assetClass: AssetClass;
  context: CotGateContext;
}): { decision: GateDecision; reasons: string[] } {
  if (options.assetClass !== "fx" && options.assetClass !== "indices" && options.assetClass !== "commodities") {
    return { decision: "NO_DATA", reasons: ["COT_UNSUPPORTED_ASSET_CLASS"] };
  }

  const { canonicalPair, aliasApplied } = normalizeCotPairAlias(options.pair);
  const meta = options.context.pairMeta.get(canonicalPair);
  if (!meta) {
    return { decision: "NO_DATA", reasons: ["COT_PAIR_META_MISSING"] };
  }

  const assetHistory = options.context.byAssetClass.get(meta.assetClass);
  if (!assetHistory || assetHistory.weeks.length === 0) {
    return { decision: "NO_DATA", reasons: ["COT_HISTORY_MISSING"] };
  }

  const targetWeek = normalizeWeekOpenUtc(options.weekOpenUtc) ?? options.weekOpenUtc;
  const targetMs = DateTime.fromISO(targetWeek, { zone: "utc" }).toMillis();
  if (!Number.isFinite(targetMs)) {
    return { decision: "NO_DATA", reasons: ["COT_INVALID_WEEK"] };
  }

  let snapshotIndex = -1;
  for (let index = 0; index < assetHistory.weeks.length; index += 1) {
    if (assetHistory.weeks[index]!.weekOpenMs <= targetMs) {
      snapshotIndex = index;
    } else {
      break;
    }
  }
  if (snapshotIndex < 0) {
    return { decision: "NO_DATA", reasons: ["COT_NO_PRIOR_SNAPSHOT"] };
  }

  if (snapshotIndex + 1 < options.context.minHistoryWeeks) {
    return { decision: "NO_DATA", reasons: ["COT_INSUFFICIENT_HISTORY"] };
  }

  const baseTradeDirection: TradeDirection = options.direction === "LONG" ? "LONG" : "SHORT";
  const quoteTradeDirection: TradeDirection = options.direction === "LONG" ? "SHORT" : "LONG";
  const weeksSlice = assetHistory.weeks.slice(0, snapshotIndex + 1);

  const baseMarketId = resolveCotMarketId(meta.assetClass, meta.base);
  const quoteMarketId = resolveCotMarketId(meta.assetClass, meta.quote);
  if (!baseMarketId) {
    return { decision: "NO_DATA", reasons: ["COT_BASE_MARKET_UNRESOLVED"] };
  }

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

  const baseCurrent = baseSeries[baseSeries.length - 1]!;
  const basePct = directionalPercentile(baseSeries, baseCurrent, baseTradeDirection);
  const quoteCurrent = quoteSeries.length > 0 ? quoteSeries[quoteSeries.length - 1]! : null;
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

export function gateMultiplier(decision: GateDecision, reduceAsSkip = true): number {
  if (decision === "SKIP") return 0;
  if (decision === "REDUCE") return reduceAsSkip ? 0 : 0.5;
  return 1;
}

export function evaluatePairWithGate(options: {
  pair: string;
  weekOpenUtc: string;
  direction: TradeDirection | null;
  assetClass: AssetClass | null;
  gateMap: GateMap;
  cotContext: CotGateContext | null;
  reduceAsSkip: boolean;
}): GateEvaluation {
  const pair = normalizePair(options.pair);
  const cryptoSymbol = GATED_PAIRS.get(pair);

  if (cryptoSymbol) {
    const gate = options.gateMap.get(cryptoSymbol)?.get(options.weekOpenUtc);
    const rawDecision = gate?.decision ?? "NO_DATA";
    const decision = options.reduceAsSkip && rawDecision === "REDUCE" ? "SKIP" : rawDecision;
    const reasons = gate?.reasons?.length ? [...gate.reasons] : [`CRYPTO_GATE_${rawDecision}`];
    if (options.reduceAsSkip && rawDecision === "REDUCE") {
      reasons.push("REDUCE_ESCALATED_TO_SKIP");
    }
    return {
      decision,
      reasons,
      source: "CRYPTO_LIQUIDATION",
    };
  }

  if (options.cotContext && options.direction && options.assetClass && options.assetClass !== "crypto") {
    const cot = evaluateCotPercentileGate({
      pair,
      weekOpenUtc: options.weekOpenUtc,
      direction: options.direction,
      assetClass: options.assetClass,
      context: options.cotContext,
    });
    const decision = options.reduceAsSkip && cot.decision === "REDUCE" ? "SKIP" : cot.decision;
    const reasons = [...cot.reasons];
    if (options.reduceAsSkip && cot.decision === "REDUCE") {
      reasons.push("REDUCE_ESCALATED_TO_SKIP");
    }
    return {
      decision,
      reasons,
      source: "COT_PERCENTILE",
    };
  }

  const reasons: string[] = [];
  if (!options.direction) reasons.push("COT_DIRECTION_MISSING");
  if (!options.assetClass) reasons.push("ASSET_CLASS_MISSING");
  if (!options.cotContext && options.assetClass !== "crypto") reasons.push("COT_CONTEXT_MISSING");
  if (reasons.length === 0) reasons.push("GATE_NOT_APPLICABLE");
  return {
    decision: "NO_DATA",
    reasons,
    source: "NONE",
  };
}
