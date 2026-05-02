/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: weeklyHoldEngine.ts
 *
 * Description:
 * Unified strategy engine for Performance and Matrix sections.
 * Routes to the correct executor based on the intraday filter's plModel:
 *   - "weekly_hold" → reads pair_period_returns (open→close P&L)
 *   - "adr"         → reads strategy_backtest_trades (0.25% TP, week-close loss)
 *   - future models → add executor function + register in EXECUTORS map
 *
 * Data sources:
 *   - pair_period_returns: weekly open/close/return per pair
 *   - strategy_backtest_trades: intraday trade-level P&L (ADR, stoch, etc.)
 *   - cot_snapshots: dealer/commercial direction per pair per week
 *   - sentiment_aggregates: retail sentiment direction per pair per week
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query } from "@/lib/db";
import { DateTime } from "luxon";
import { getWeeklyPairReturns } from "@/lib/pairReturns";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals, type CanonicalBasketSignal } from "@/lib/performance/basketSource";
import type { BiasSourceConfig, EntryStyleConfig } from "@/lib/performance/strategyConfig";
import {
  resolveSelectorFragilityDirections,
} from "@/lib/performance/selectorEngine";
import {
  SELECTOR_STRATEGY_ID,
  SELECTOR_FRAG3_STRATEGY_ID,
  SELECTOR_SELECTIVE_STRATEGY_ID,
} from "@/lib/performance/strategyConfig";
import { readCanonicalStrengthDirections } from "@/lib/strength/canonicalDirection";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "@/lib/performance/adrLookup";

// ─── Trade types (strategy-generic) ─────────────────────────────
// "WeeklyHoldTrade" name kept for backward compat; represents any strategy trade.

export type TradeDetail = {
  tradeNumber: number;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  exitReason: string | null;
  anchorPrice: number | null;
  tpPrice: number | null;
  adrPct: number | null;
  maePct: number | null;
};

export type WeeklyHoldTrade = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  openPrice: number;
  closePrice: number;
  returnPct: number;
  /** The model that generated this signal (dealer/commercial/sentiment/etc.) */
  source: string;
  /** Tier (1=high, 2=medium, 3=low) or null */
  tier: number | null;
  /** Intraday trade detail (present for ADR/stoch trades, absent for weekly hold) */
  detail?: TradeDetail;
};
/** @alias WeeklyHoldTrade — use this name in new code */
export type StrategyTrade = WeeklyHoldTrade;

/** Canonical per-pair signal emitted by the engine for board display.
 *  For tandem strategies, signals are collapsed to one per pair via majority rule. */
export type CanonicalSignal = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  source: string;
  tier: number | null;
};

export type WeeklyHoldResult = {
  weekOpenUtc: string;
  biasSourceId: string;
  trades: WeeklyHoldTrade[];
  totalReturnPct: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  tradeCount: number;
  /** Canonical pair-level signals for this week's strategy selection.
   *  Used by Matrix for coreBias, tier display, and copy buttons. */
  signals: CanonicalSignal[];
  /** Whether this week should count toward realized aggregate stats. */
  isRealized: boolean;
  /** Directional signals that could not become trades because price data was missing. */
  missingPriceSymbols?: string[];
};
/** @alias WeeklyHoldResult — use this name in new code */
export type StrategyWeekResult = WeeklyHoldResult;

export type MultiWeekResult = {
  biasSourceId: string;
  weeks: WeeklyHoldResult[];
  totalReturnPct: number;
  totalTrades: number;
  totalWins: number;
  winRate: number;
  maxDrawdownPct: number;
  /** Per asset class breakdown */
  byAssetClass: Record<string, { returnPct: number; trades: number; wins: number }>;
};

// ─── Asset class inference from symbol ──────────────────────────

const CRYPTO_SYMBOLS = new Set(["BTCUSD", "ETHUSD", "BTCUSDT", "ETHUSDT", "SOLUSD", "SOLUSDT", "XRPUSD", "XRPUSDT", "DOGUSD", "DOGUSDT", "ADAUSD", "ADAUSDT", "AVAUSD", "AVAUSDT", "LINKUSD", "DOTUSDT"]);
const INDEX_SYMBOLS = new Set(["SPXUSD", "SPX500", "SPX500USD", "NDXUSD", "NDX100", "NAS100USD", "NIKKEIUSD", "JPN225", "JPN225USD", "UKXUSD", "UK100", "DEUUSD", "DE30", "DE40"]);
const COMMODITY_SYMBOLS = new Set(["XAUUSD", "XAGUSD", "WTIUSD", "BCOUSD", "NGUSD"]);

function inferAssetClass(symbol: string): string {
  const upper = symbol.toUpperCase().replace(/[/.]/g, "");
  if (CRYPTO_SYMBOLS.has(upper)) return "crypto";
  if (INDEX_SYMBOLS.has(upper)) return "indices";
  if (COMMODITY_SYMBOLS.has(upper)) return "commodities";
  return "fx";
}

async function applyAdrNormalization(
  result: WeeklyHoldResult,
): Promise<WeeklyHoldResult> {
  const adrMap = await loadWeeklyAdrMap(result.weekOpenUtc);
  const targetAdr = getTargetAdrPct();

  const normalizedTrades = result.trades.map((trade) => {
    const pairAdr = trade.detail?.adrPct && trade.detail.adrPct > 0
      ? trade.detail.adrPct
      : getAdrPct(adrMap, trade.symbol, trade.assetClass);
    const multiplier = targetAdr / pairAdr;
    return { ...trade, returnPct: trade.returnPct * multiplier };
  });

  const totalReturn = normalizedTrades.reduce((s, t) => s + t.returnPct, 0);
  const wins = normalizedTrades.filter((t) => t.returnPct > 0).length;
  const losses = normalizedTrades.filter((t) => t.returnPct <= 0).length;

  return {
    ...result,
    trades: normalizedTrades,
    totalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: normalizedTrades.length > 0 ? (wins / normalizedTrades.length) * 100 : 0,
  };
}

// ─── Direction resolvers — compose from canonical basketSource ──
//
// Layer A: basketSource provides canonical dealer/commercial/sentiment signals
// Layer B: this function composes derived strategies (tiered_4w, agreement, tandem)
//
// The engine NEVER independently rebuilds base-model directions from raw snapshots.

type DirectionEntry = { direction: "LONG" | "SHORT"; source: string; tier: number | null; assetClass: string };
type DirectionMap = Map<string, DirectionEntry>;

type TradeDirection = "LONG" | "SHORT";
type WeightedTierPack = {
  dealer: number;
  commercial: number;
  sentiment: number;
  strength: number;
};

const TIERED_4W_WEIGHTS: WeightedTierPack = {
  dealer: 2.0,
  commercial: 0.75,
  sentiment: 1.25,
  strength: 1.5,
};

function signalsToDirectionMap(signals: CanonicalBasketSignal[], source: string): DirectionMap {
  const map: DirectionMap = new Map();
  for (const s of signals) {
    if (s.direction === "NEUTRAL") continue;
    map.set(s.symbol, { direction: s.direction, source, tier: null, assetClass: s.assetClass });
  }
  return map;
}

function classifyFourSourceTiePattern(votes: {
  dealer?: TradeDirection;
  commercial?: TradeDirection;
  sentiment?: TradeDirection;
  strength?: TradeDirection;
}): "DC_vs_SeSt" | "DSe_vs_CSt" | "DSt_vs_CSe" | null {
  const { dealer, commercial, sentiment, strength } = votes;
  if (!dealer || !commercial || !sentiment || !strength) return null;

  if (dealer === commercial && sentiment === strength && dealer !== sentiment) {
    return "DC_vs_SeSt";
  }
  if (dealer === sentiment && commercial === strength && dealer !== commercial) {
    return "DSe_vs_CSt";
  }
  if (dealer === strength && commercial === sentiment && dealer !== commercial) {
    return "DSt_vs_CSe";
  }
  return null;
}

function resolveAgree3of4Direction(votes: {
  dealer?: DirectionEntry;
  commercial?: DirectionEntry;
  sentiment?: DirectionEntry;
  strength?: DirectionEntry;
}): TradeDirection | null {
  const directions = [votes.dealer?.direction, votes.commercial?.direction, votes.sentiment?.direction, votes.strength?.direction]
    .filter(Boolean) as TradeDirection[];
  const longs = directions.filter((direction) => direction === "LONG").length;
  const shorts = directions.filter((direction) => direction === "SHORT").length;

  if (longs >= 3) return "LONG";
  if (shorts >= 3) return "SHORT";
  if (longs !== 2 || shorts !== 2) return null;

  const tiePattern = classifyFourSourceTiePattern({
    dealer: votes.dealer?.direction,
    commercial: votes.commercial?.direction,
    sentiment: votes.sentiment?.direction,
    strength: votes.strength?.direction,
  });

  if (tiePattern === "DC_vs_SeSt") {
    return votes.sentiment?.direction ?? votes.strength?.direction ?? null;
  }
  return null;
}

function computeWeightedScore(votes: {
  dealer?: DirectionEntry;
  commercial?: DirectionEntry;
  sentiment?: DirectionEntry;
  strength?: DirectionEntry;
}, weights: WeightedTierPack) {
  let score = 0;
  if (votes.dealer?.direction === "LONG") score += weights.dealer;
  else if (votes.dealer?.direction === "SHORT") score -= weights.dealer;

  if (votes.commercial?.direction === "LONG") score += weights.commercial;
  else if (votes.commercial?.direction === "SHORT") score -= weights.commercial;

  if (votes.sentiment?.direction === "LONG") score += weights.sentiment;
  else if (votes.sentiment?.direction === "SHORT") score -= weights.sentiment;

  if (votes.strength?.direction === "LONG") score += weights.strength;
  else if (votes.strength?.direction === "SHORT") score -= weights.strength;

  return score;
}

async function resolveDirections(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
): Promise<DirectionMap> {
  // Layer A: read canonical basket truth (same source as Data section)
  const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);

  // Base model maps (non-neutral signals only)
  const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
  const commercialSignals = nonNeutralSignals(filterByModel(basketWeek, "commercial"));
  const sentimentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));

  // Layer B: compose strategy-specific direction map
  if (biasSource.id === "dealer") {
    return signalsToDirectionMap(dealerSignals, "dealer");
  }

  if (biasSource.id === "commercial") {
    return signalsToDirectionMap(commercialSignals, "commercial");
  }

  if (biasSource.id === "sentiment") {
    return signalsToDirectionMap(sentimentSignals, "sentiment");
  }

  if (biasSource.id === SELECTOR_FRAG3_STRATEGY_ID) {
    return resolveSelectorFragilityDirections(weekOpenUtc, "fragility_3");
  }

  if (biasSource.id === SELECTOR_SELECTIVE_STRATEGY_ID) {
    return resolveSelectorFragilityDirections(weekOpenUtc, "opposed_or_building_against");
  }

  if (biasSource.id === SELECTOR_STRATEGY_ID) {
    const [baseMap, selectiveMap] = await Promise.all([
      resolveSelectorFragilityDirections(weekOpenUtc, "fragility_3"),
      resolveSelectorFragilityDirections(weekOpenUtc, "opposed_or_building_against"),
    ]);
    const map: DirectionMap = new Map();
    for (const [pair, entry] of baseMap) {
      map.set(`${pair}:dealer`, { ...entry, source: "dealer" });
    }
    for (const [pair, entry] of selectiveMap) {
      map.set(`${pair}:commercial`, { ...entry, source: "commercial" });
    }
    return map;
  }

  if (biasSource.id === "strength") {
    const strengthRows = await readCanonicalStrengthDirections(weekOpenUtc);
    const map: DirectionMap = new Map();
    for (const row of strengthRows) {
      map.set(row.pair.toUpperCase(), {
        direction: row.direction,
        source: "strength",
        tier: null,
        assetClass: row.assetClass,
      });
    }
    return map;
  }

  // Build per-pair maps for composite strategies
  const dealerMap = signalsToDirectionMap(dealerSignals, "dealer");
  const commMap = signalsToDirectionMap(commercialSignals, "commercial");
  const sentMap = signalsToDirectionMap(sentimentSignals, "sentiment");
  let strengthMap: DirectionMap = new Map();
  const needsStrengthVotes =
    biasSource.id === "tiered_4w"
    || biasSource.id === "agree_3of4"
    || (biasSource.type === "tandem" && biasSource.models?.includes("strength"));

  if (needsStrengthVotes) {
    const strengthRows = await readCanonicalStrengthDirections(weekOpenUtc);
    strengthMap = new Map();
    for (const row of strengthRows) {
      strengthMap.set(row.pair.toUpperCase(), {
        direction: row.direction,
        source: "strength",
        tier: null,
        assetClass: row.assetClass,
      });
    }
  }

  const allPairs = new Set([...dealerMap.keys(), ...commMap.keys(), ...sentMap.keys(), ...strengthMap.keys()]);

  if (biasSource.id === "tiered_4w") {
    const map: DirectionMap = new Map();
    for (const pair of allPairs) {
      const de = dealerMap.get(pair);
      const ce = commMap.get(pair);
      const se = sentMap.get(pair);
      const st = strengthMap.get(pair);
      const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? st?.assetClass ?? inferAssetClass(pair);
      const score = computeWeightedScore(
        { dealer: de, commercial: ce, sentiment: se, strength: st },
        TIERED_4W_WEIGHTS,
      );
      const absScore = Math.abs(score);
      if (absScore >= 4.0) {
        map.set(pair, {
          direction: score > 0 ? "LONG" : "SHORT",
          source: "tiered_4w",
          tier: 1,
          assetClass: ac,
        });
      } else if (absScore >= 2.0) {
        map.set(pair, {
          direction: score > 0 ? "LONG" : "SHORT",
          source: "tiered_4w",
          tier: 2,
          assetClass: ac,
        });
      }
    }
    return map;
  }

  if (biasSource.id === "agree_3of4") {
    const map: DirectionMap = new Map();
    for (const pair of allPairs) {
      const de = dealerMap.get(pair);
      const ce = commMap.get(pair);
      const se = sentMap.get(pair);
      const st = strengthMap.get(pair);
      const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? st?.assetClass ?? inferAssetClass(pair);
      const direction = resolveAgree3of4Direction({
        dealer: de,
        commercial: ce,
        sentiment: se,
        strength: st,
      });
      if (direction) {
        map.set(pair, { direction, source: "agree_3of4", tier: null, assetClass: ac });
      }
    }
    return map;
  }

  if (biasSource.type === "tandem" && biasSource.models) {
    const map: DirectionMap = new Map();
    const modelSignalMap: Partial<Record<string, DirectionMap>> = {
      dealer: dealerMap,
      commercial: commMap,
      sentiment: sentMap,
    };
    if (biasSource.models.includes("strength")) modelSignalMap.strength = strengthMap;

    for (const modelId of biasSource.models) {
      const sourceMap = modelSignalMap[modelId];
      if (!sourceMap) continue;
      for (const [pair, entry] of sourceMap) {
        map.set(`${pair}:${modelId}`, { ...entry, source: modelId });
      }
    }
    return map;
  }

  return new Map();
}

// ─── Canonical signals from direction map ────────────────────────
// Faithful to strategy truth: one signal per direction entry.
// For tandem, this means multiple rows per pair (one per model).
// For single-model strategies, naturally one row per pair.
// No collapsing — the board layer decides how to display.

function buildCanonicalSignals(directions: DirectionMap): CanonicalSignal[] {
  return Array.from(directions.entries()).map(([key, entry]) => ({
    // Tandem keys are "PAIR:model" — extract the pair name
    symbol: key.includes(":") ? key.split(":")[0]! : key,
    assetClass: entry.assetClass,
    direction: entry.direction,
    source: entry.source,
    tier: entry.tier,
  }));
}

function pairFromDirectionKey(key: string) {
  return (key.includes(":") ? key.split(":")[0]! : key).toUpperCase();
}

function logMissingWeeklyPrices(
  biasSourceId: string,
  weekOpenUtc: string,
  missingPriceSymbols: string[],
) {
  if (missingPriceSymbols.length === 0) return;
  console.warn(
    `[weeklyHoldEngine] Missing weekly price rows for ${biasSourceId} ${weekOpenUtc}: ${missingPriceSymbols.join(", ")}`,
  );
}

function isWeekRealizedForAggregate(
  weekOpenUtc: string,
  currentDisplayWeekOpenUtc: string,
): boolean {
  const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const currentDisplayMs = DateTime.fromISO(currentDisplayWeekOpenUtc, { zone: "utc" }).toMillis();
  if (!Number.isFinite(weekMs) || !Number.isFinite(currentDisplayMs)) {
    return weekOpenUtc !== currentDisplayWeekOpenUtc;
  }
  return weekMs < currentDisplayMs;
}

// ─── Tier string → number mapping ───────────────────────────────

const TIER_MAP: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };

function parseTier(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return TIER_MAP[raw.toUpperCase()] ?? null;
  return null;
}

// ─── ADR trade executor (reads from strategy_backtest_trades) ───

async function executeAdr(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
): Promise<WeeklyHoldResult> {
  // Step 1: Get the bias source's direction signals for this week.
  // This determines WHICH trades to include — only trades where the
  // bias source agrees with the scanner's direction pass through.
  const directions = await resolveDirections(biasSource, weekOpenUtc);
  const signals = buildCanonicalSignals(directions);

  // Build approval lookup.
  // For non-tandem: symbol → Set of approved directions (simple filter).
  // For tandem: symbol → array of { direction, source } entries (one trade per approving model).
  const isTandem = biasSource.type === "tandem";
  const approvedDirections = new Map<string, Set<string>>();
  const tandemApprovals = new Map<string, Array<{ direction: string; source: string }>>();

  for (const [key, entry] of directions) {
    const pair = key.includes(":") ? key.split(":")[0]! : key;
    if (!approvedDirections.has(pair)) approvedDirections.set(pair, new Set());
    approvedDirections.get(pair)!.add(entry.direction);
    if (isTandem) {
      if (!tandemApprovals.has(pair)) tandemApprovals.set(pair, []);
      tandemApprovals.get(pair)!.push({ direction: entry.direction, source: entry.source });
    }
  }

  // Step 2: Query ADR trades from the scanner
  const runRows = await query<{ id: string }>(
    `SELECT id FROM strategy_backtest_runs
     WHERE bot_id = 'adr-forward' AND variant = 'fresh-start'
       AND market = 'multi-asset' AND config_key = 'default' LIMIT 1`,
    [],
  );
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const isPastWeek = weekOpenUtc !== currentWeekOpenUtc;
  const isRealized = isWeekRealizedForAggregate(weekOpenUtc, currentWeekOpenUtc);

  if (runRows.length === 0) {
    console.log("[engine] No ADR run found in strategy_backtest_runs");
    return {
      weekOpenUtc,
      biasSourceId: biasSource.id,
      trades: [],
      totalReturnPct: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      tradeCount: 0,
      signals,
      isRealized,
    };
  }
  const runId = Number(runRows[0]!.id);

  const tradeRows = await query<{
    symbol: string;
    direction: string;
    entry_price: string | null;
    exit_price: string | null;
    pnl_pct: string | null;
    exit_reason: string | null;
    entry_time_utc: string | null;
    exit_time_utc: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `SELECT symbol, direction, entry_price, exit_price, pnl_pct, exit_reason,
            entry_time_utc::text, exit_time_utc::text, metadata
     FROM strategy_backtest_trades
     WHERE run_id = $1 AND week_open_utc = $2::timestamptz
     ORDER BY entry_time_utc ASC NULLS LAST`,
    [runId, weekOpenUtc],
  );

  const closePrices = new Map<string, number>();
  if (isPastWeek) {
    const priceRows = await query<{ symbol: string; close_price: string }>(
      `SELECT symbol, close_price FROM pair_period_returns
       WHERE period_type = 'weekly' AND period_open_utc = $1::timestamptz`,
      [weekOpenUtc],
    );
    for (const r of priceRows) {
      closePrices.set(r.symbol.toUpperCase(), Number(r.close_price));
    }
  }

  // Step 3: Map trades, filtering by bias source direction
  const VALID_MODELS = new Set(["dealer", "commercial", "sentiment"]);
  const trades: WeeklyHoldTrade[] = [];
  let skippedByDirection = 0;

  for (const r of tradeRows) {
    // Direction filter: only include if bias source agrees
    const pairUpper = r.symbol.toUpperCase();
    const approved = approvedDirections.get(pairUpper) ?? approvedDirections.get(r.symbol);
    if (!approved || !approved.has(r.direction)) {
      skippedByDirection++;
      continue;
    }

    const entryPrice = r.entry_price ? Number(r.entry_price) : 0;
    let exitPrice = r.exit_price ? Number(r.exit_price) : entryPrice;
    let pnlPct = r.pnl_pct ? Number(r.pnl_pct) : 0;

    let resolvedExitReason = r.exit_reason;
    if (isPastWeek && r.exit_reason === "active" && entryPrice) {
      const weekClosePrice = closePrices.get(pairUpper);
      if (weekClosePrice) {
        exitPrice = weekClosePrice;
        const rawReturn = ((weekClosePrice - entryPrice) / entryPrice) * 100;
        pnlPct = r.direction === "SHORT" ? -rawReturn : rawReturn;
        resolvedExitReason = "week_close";
      }
    }
    // Current-week active trades should be visible in Matrix/Performance as open
    // positions, but they should not count unrealized P&L yet.
    if (!isPastWeek && r.exit_reason === "active") {
      pnlPct = 0;
      resolvedExitReason = "active";
    }

    const meta = r.metadata ?? {};
    const rawModel = (meta.model as string) ?? "";
    const fallbackSource = VALID_MODELS.has(rawModel) ? rawModel : "dealer";
    const assetClass = (meta.assetClass as string) ?? inferAssetClass(r.symbol);
    const tier = parseTier(meta.tier);
    const detail: TradeDetail = {
      tradeNumber: (meta.tradeNumber as number) ?? 1,
      entryTimeUtc: r.entry_time_utc,
      exitTimeUtc: r.exit_time_utc,
      exitReason: resolvedExitReason,
      anchorPrice: (meta.anchorPrice as number) ?? null,
      tpPrice: (meta.tpPrice as number) ?? null,
      adrPct: (meta.adrPct as number) ?? null,
      maePct: (meta.maePct as number) ?? null,
    };

    if (isTandem) {
      // Tandem: emit one trade per approving model (same as weekly hold tandem)
      const approvals = (tandemApprovals.get(pairUpper) ?? tandemApprovals.get(r.symbol) ?? [])
        .filter((a) => a.direction === r.direction);
      for (const approval of approvals) {
        trades.push({
          symbol: r.symbol, assetClass, direction: r.direction as "LONG" | "SHORT",
          openPrice: entryPrice, closePrice: exitPrice, returnPct: pnlPct,
          source: approval.source, tier, detail,
        });
      }
    } else {
      trades.push({
        symbol: r.symbol, assetClass, direction: r.direction as "LONG" | "SHORT",
        openPrice: entryPrice, closePrice: exitPrice, returnPct: pnlPct,
        source: fallbackSource, tier, detail,
      });
    }
  }

  const totalReturn = trades.reduce((s, t) => s + t.returnPct, 0);
  const wins = trades.filter((t) => t.returnPct > 0).length;
  const losses = trades.filter((t) => t.returnPct <= 0).length;

  console.log(`[engine] ADR executor (${biasSource.id}): ${weekOpenUtc} → ${trades.length} trades (${skippedByDirection} filtered out), ${totalReturn.toFixed(2)}% return`);

  return {
    weekOpenUtc,
    biasSourceId: biasSource.id,
    trades,
    totalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    tradeCount: trades.length,
    signals,
    isRealized,
  };
}

// ─── Executor registry ──────────────────────────────────────────
// Adding a new strategy = write an executor function + add one line here.

type StrategyExecutor = (
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
) => Promise<WeeklyHoldResult>;

const EXECUTORS: Record<string, StrategyExecutor> = {
  adr: executeAdr,
  // Future: stoch, adr_stoch, etc.
};

// ─── Core computation ───────────────────────────────────────────

export async function computeWeeklyHold(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
  entryStyle?: EntryStyleConfig,
  _legacyStrengthGate?: unknown,
): Promise<WeeklyHoldResult> {
  void _legacyStrengthGate;
  // Route to the correct executor based on plModel
  const plModel = entryStyle?.plModel ?? "weekly_hold";
  const executor = EXECUTORS[plModel];
  if (executor) {
    console.log(`[engine] Routing to ${plModel} executor for ${weekOpenUtc}`);
    const result = await executor(biasSource, weekOpenUtc);
    return applyAdrNormalization(result);
  }

  // Default: weekly hold (open→close from pair_period_returns)
  const directions = await resolveDirections(biasSource, weekOpenUtc);
  const signals = buildCanonicalSignals(directions);
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const isRealized = isWeekRealizedForAggregate(weekOpenUtc, currentWeekOpenUtc);
  const pairReturns = await getWeeklyPairReturns(weekOpenUtc);
  const returnMap = new Map(pairReturns.map((r) => [r.symbol.toUpperCase(), r]));

  const trades: WeeklyHoldTrade[] = [];
  const missingPriceSymbolSet = new Set<string>();

  if (pairReturns.length === 0) {
    const missingPriceSymbols = Array.from(
      new Set(Array.from(directions.keys()).map(pairFromDirectionKey)),
    ).sort();
    logMissingWeeklyPrices(biasSource.id, weekOpenUtc, missingPriceSymbols);
    return applyAdrNormalization({
      weekOpenUtc,
      biasSourceId: biasSource.id,
      trades,
      totalReturnPct: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      tradeCount: 0,
      signals,
      isRealized,
      missingPriceSymbols,
    });
  }

  for (const [key, signal] of directions) {
    // For tandem, key is "PAIR:model" — extract the pair name
    const pair = pairFromDirectionKey(key);
    const priceData = returnMap.get(pair);
    if (!priceData) {
      missingPriceSymbolSet.add(pair);
      continue;
    }

    const openPrice = priceData.openPrice;
    const closePrice = priceData.closePrice;
    const actualReturn = priceData.returnPct;
    // If direction is SHORT, negate the return (price going down = profit)
    const directedReturn = signal.direction === "SHORT" ? -actualReturn : actualReturn;

    trades.push({
      symbol: pair,
      assetClass: priceData.assetClass ?? signal.assetClass,
      direction: signal.direction,
      openPrice,
      closePrice,
      returnPct: directedReturn,
      source: signal.source,
      tier: signal.tier,
    });
  }

  const totalReturn = trades.reduce((s, t) => s + t.returnPct, 0);
  const wins = trades.filter((t) => t.returnPct > 0).length;
  const losses = trades.filter((t) => t.returnPct <= 0).length;
  const missingPriceSymbols = Array.from(missingPriceSymbolSet).sort();
  logMissingWeeklyPrices(biasSource.id, weekOpenUtc, missingPriceSymbols);

  const result: WeeklyHoldResult = {
    weekOpenUtc,
    biasSourceId: biasSource.id,
    trades,
    totalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    tradeCount: trades.length,
    signals,
    isRealized,
    missingPriceSymbols,
  };
  return applyAdrNormalization(result);
}

export async function computeMultiWeekHold(
  biasSource: BiasSourceConfig,
  weekOpenUtcs: string[],
  entryStyle?: EntryStyleConfig,
  _legacyStrengthGate?: unknown,
): Promise<MultiWeekResult> {
  void _legacyStrengthGate;
  const computedWeeks: WeeklyHoldResult[] = [];
  for (const weekOpenUtc of weekOpenUtcs) {
    try {
      const result = await computeWeeklyHold(biasSource, weekOpenUtc, entryStyle);
      computedWeeks.push(result);
    } catch (err) {
      console.warn(`[engine] Skipping week ${weekOpenUtc}:`, err instanceof Error ? err.message : err);
    }
  }

  const weeks = computedWeeks.filter((week) => week.isRealized);

  const totalReturn = weeks.reduce((s, w) => s + w.totalReturnPct, 0);
  const totalTrades = weeks.reduce((s, w) => s + w.tradeCount, 0);
  const totalWins = weeks.reduce((s, w) => s + w.winCount, 0);

  // Max drawdown from equity curve
  let peak = 0;
  let maxDD = 0;
  let cum = 0;
  for (const w of weeks) {
    cum += w.totalReturnPct;
    peak = Math.max(peak, cum);
    maxDD = Math.min(maxDD, cum - peak);
  }

  // Per asset class
  const byAssetClass: Record<string, { returnPct: number; trades: number; wins: number }> = {};
  for (const w of weeks) {
    for (const t of w.trades) {
      if (!byAssetClass[t.assetClass]) byAssetClass[t.assetClass] = { returnPct: 0, trades: 0, wins: 0 };
      byAssetClass[t.assetClass]!.returnPct += t.returnPct;
      byAssetClass[t.assetClass]!.trades++;
      if (t.returnPct > 0) byAssetClass[t.assetClass]!.wins++;
    }
  }

  return {
    biasSourceId: biasSource.id,
    weeks,
    totalReturnPct: totalReturn,
    totalTrades,
    totalWins,
    winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
    maxDrawdownPct: maxDD,
    byAssetClass,
  };
}
