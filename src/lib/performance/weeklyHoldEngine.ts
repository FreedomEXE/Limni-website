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
import { readSnapshot } from "@/lib/cotStore";
import { derivePairDirections, resolveMarketBias } from "@/lib/cotCompute";
import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "@/lib/sentiment/daily";
import { getWeeklyPairReturns } from "@/lib/pairReturns";
import { deriveCotReportDate, findDataSectionWeekByReportDate, listDataSectionWeekEntries } from "@/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import type { BiasSourceConfig, IntradayFilterConfig } from "@/lib/performance/strategyConfig";

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

export type WeeklyHoldResult = {
  weekOpenUtc: string;
  biasSourceId: string;
  trades: WeeklyHoldTrade[];
  totalReturnPct: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  tradeCount: number;
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

// ─── Direction resolvers per bias source ────────────────────────

type DirectionEntry = { direction: "LONG" | "SHORT"; source: string; tier: number | null; assetClass: string };
type DirectionMap = Map<string, DirectionEntry>;

async function resolveDirections(
  biasSource: BiasSourceConfig,
  weekOpenUtc: string,
): Promise<DirectionMap> {
  const map: DirectionMap = new Map();
  const reportDate = deriveCotReportDate(weekOpenUtc);

  if (biasSource.id === "dealer" || biasSource.id === "commercial") {
    const model = biasSource.id as "dealer" | "commercial";
    for (const ac of ["fx", "indices", "commodities", "crypto"] as const) {
      try {
        const snapshot = await readSnapshot({ assetClass: ac, reportDate });
        if (!snapshot) continue;
        // Derive pair directions using the specific model
        for (const [pair, pairData] of Object.entries(snapshot.pairs)) {
          // Re-derive from currencies using the specific model
          const currencies = snapshot.currencies;
          const currencyData = snapshot.currencies as unknown as Record<string, Record<string, string>>;
          // For non-FX, check the market's own bias
          if (ac !== "fx") {
            const marketKey = Object.keys(currencyData)[0];
            if (marketKey) {
              const marketBias = currencyData[marketKey]?.[`${model}_bias`];
              if (marketBias === "BULLISH") map.set(pair, { direction: "LONG", source: model, tier: null, assetClass: ac });
              else if (marketBias === "BEARISH") map.set(pair, { direction: "SHORT", source: model, tier: null, assetClass: ac });
            }
            continue;
          }
          // For FX pairs, re-derive from currency-level biases
          const base = pair.slice(0, 3);
          const quote = pair.slice(3);
          const baseBias = currencyData[base]?.[`${model}_bias`];
          const quoteBias = currencyData[quote]?.[`${model}_bias`];
          if (baseBias === "BULLISH" && quoteBias === "BEARISH") {
            map.set(pair, { direction: "LONG", source: model, tier: null, assetClass: "fx" });
          } else if (baseBias === "BEARISH" && quoteBias === "BULLISH") {
            map.set(pair, { direction: "SHORT", source: model, tier: null, assetClass: "fx" });
          }
        }
      } catch {}
    }
    return map;
  }

  if (biasSource.id === "sentiment") {
    try {
      const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
      const close = open.plus({ days: 7 });
      const aggs = await getAggregatesForWeekStartWithBackfill(
        open.toUTC().toISO()!,
        close.toUTC().toISO()!,
      );
      for (const agg of aggs) {
        const dir = sentimentDirectionFromAggregate(agg);
        if (dir === "LONG" || dir === "SHORT") {
          map.set(agg.symbol, { direction: dir, source: "sentiment", tier: null, assetClass: inferAssetClass(agg.symbol) });
        }
      }
    } catch {}
    return map;
  }

  if (biasSource.id === "tiered_v3") {
    // Combine dealer + commercial + sentiment with tiered voting
    const dealerMap = await resolveDirections({ ...biasSource, id: "dealer" } as BiasSourceConfig, weekOpenUtc);
    const commMap = await resolveDirections({ ...biasSource, id: "commercial" } as BiasSourceConfig, weekOpenUtc);
    const sentMap = await resolveDirections({ ...biasSource, id: "sentiment" } as BiasSourceConfig, weekOpenUtc);

    const allPairs = new Set([...dealerMap.keys(), ...commMap.keys(), ...sentMap.keys()]);
    for (const pair of allPairs) {
      const de = dealerMap.get(pair);
      const ce = commMap.get(pair);
      const se = sentMap.get(pair);
      const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? inferAssetClass(pair);
      const votes = [de?.direction, ce?.direction, se?.direction].filter(Boolean) as ("LONG" | "SHORT")[];
      const longs = votes.filter((v) => v === "LONG").length;
      const shorts = votes.filter((v) => v === "SHORT").length;

      if (longs === 3) map.set(pair, { direction: "LONG", source: "tiered_v3", tier: 1, assetClass: ac });
      else if (shorts === 3) map.set(pair, { direction: "SHORT", source: "tiered_v3", tier: 1, assetClass: ac });
      else if (longs === 2) map.set(pair, { direction: "LONG", source: "tiered_v3", tier: 2, assetClass: ac });
      else if (shorts === 2) map.set(pair, { direction: "SHORT", source: "tiered_v3", tier: 2, assetClass: ac });
      else if (longs === 1 && shorts === 0) map.set(pair, { direction: "LONG", source: "tiered_v3", tier: 3, assetClass: ac });
      else if (shorts === 1 && longs === 0) map.set(pair, { direction: "SHORT", source: "tiered_v3", tier: 3, assetClass: ac });
    }
    return map;
  }

  if (biasSource.id === "agree_2of3") {
    const dealerMap = await resolveDirections({ ...biasSource, id: "dealer" } as BiasSourceConfig, weekOpenUtc);
    const commMap = await resolveDirections({ ...biasSource, id: "commercial" } as BiasSourceConfig, weekOpenUtc);
    const sentMap = await resolveDirections({ ...biasSource, id: "sentiment" } as BiasSourceConfig, weekOpenUtc);

    const allPairs = new Set([...dealerMap.keys(), ...commMap.keys(), ...sentMap.keys()]);
    for (const pair of allPairs) {
      const de = dealerMap.get(pair);
      const ce = commMap.get(pair);
      const se = sentMap.get(pair);
      const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? inferAssetClass(pair);
      const votes = [de?.direction, ce?.direction, se?.direction].filter(Boolean) as ("LONG" | "SHORT")[];
      const longs = votes.filter((v) => v === "LONG").length;
      const shorts = votes.filter((v) => v === "SHORT").length;
      if (longs >= 2) map.set(pair, { direction: "LONG", source: "agree_2of3", tier: null, assetClass: ac });
      else if (shorts >= 2) map.set(pair, { direction: "SHORT", source: "agree_2of3", tier: null, assetClass: ac });
    }
    return map;
  }

  if (biasSource.id === "tandem") {
    // Tandem: return ALL directions from all 3 models (can have 3 entries per pair)
    // For tandem, we use a different approach — tag each entry with its model
    const dealerMap = await resolveDirections({ ...biasSource, id: "dealer" } as BiasSourceConfig, weekOpenUtc);
    const commMap = await resolveDirections({ ...biasSource, id: "commercial" } as BiasSourceConfig, weekOpenUtc);
    const sentMap = await resolveDirections({ ...biasSource, id: "sentiment" } as BiasSourceConfig, weekOpenUtc);

    // For tandem, we need to return multiple entries per pair
    // Use composite keys: PAIR:dealer, PAIR:commercial, PAIR:sentiment
    for (const [pair, entry] of dealerMap) map.set(`${pair}:dealer`, { ...entry, source: "dealer" });
    for (const [pair, entry] of commMap) map.set(`${pair}:commercial`, { ...entry, source: "commercial" });
    for (const [pair, entry] of sentMap) map.set(`${pair}:sentiment`, { ...entry, source: "sentiment" });
    return map;
  }

  return map;
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

  // Build a quick lookup: symbol → Set of approved directions
  // For tandem, key is "PAIR:model" — extract the pair name
  const approvedDirections = new Map<string, Set<string>>();
  for (const [key, entry] of directions) {
    const pair = key.includes(":") ? key.split(":")[0]! : key;
    if (!approvedDirections.has(pair)) approvedDirections.set(pair, new Set());
    approvedDirections.get(pair)!.add(entry.direction);
  }

  // Step 2: Query ADR trades from the scanner
  const runRows = await query<{ id: string }>(
    `SELECT id FROM strategy_backtest_runs
     WHERE bot_id = 'adr-forward' AND variant = 'fresh-start'
       AND market = 'multi-asset' AND config_key = 'default' LIMIT 1`,
    [],
  );
  if (runRows.length === 0) {
    console.log("[engine] No ADR run found in strategy_backtest_runs");
    return { weekOpenUtc, biasSourceId: biasSource.id, trades: [], totalReturnPct: 0, winCount: 0, lossCount: 0, winRate: 0, tradeCount: 0 };
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

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const isPastWeek = weekOpenUtc !== currentWeekOpenUtc;

  let closePrices = new Map<string, number>();
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
    // Skip active trades on current week (no realized P&L yet)
    if (!isPastWeek && r.exit_reason === "active") continue;

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

    if (isPastWeek && r.exit_reason === "active" && entryPrice) {
      const weekClosePrice = closePrices.get(pairUpper);
      if (weekClosePrice) {
        exitPrice = weekClosePrice;
        const rawReturn = ((weekClosePrice - entryPrice) / entryPrice) * 100;
        pnlPct = r.direction === "SHORT" ? -rawReturn : rawReturn;
      }
    }

    const meta = r.metadata ?? {};
    const rawModel = (meta.model as string) ?? "";
    const source = VALID_MODELS.has(rawModel) ? rawModel : "dealer";

    // For tandem source field: use the entry's source from direction map if available
    let tradeSource = source;
    if (biasSource.id === "tandem") {
      // Find which model approved this trade
      for (const [key, entry] of directions) {
        const pair = key.includes(":") ? key.split(":")[0]! : key;
        if ((pair === pairUpper || pair === r.symbol) && entry.direction === r.direction) {
          tradeSource = entry.source;
          break;
        }
      }
    }

    trades.push({
      symbol: r.symbol,
      assetClass: (meta.assetClass as string) ?? inferAssetClass(r.symbol),
      direction: r.direction as "LONG" | "SHORT",
      openPrice: entryPrice,
      closePrice: exitPrice,
      returnPct: pnlPct,
      source: tradeSource,
      tier: parseTier(meta.tier),
      detail: {
        tradeNumber: (meta.tradeNumber as number) ?? 1,
        entryTimeUtc: r.entry_time_utc,
        exitTimeUtc: r.exit_time_utc,
        exitReason: r.exit_reason,
        anchorPrice: (meta.anchorPrice as number) ?? null,
        tpPrice: (meta.tpPrice as number) ?? null,
        adrPct: (meta.adrPct as number) ?? null,
        maePct: (meta.maePct as number) ?? null,
      },
    });
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
  intradayFilter?: IntradayFilterConfig,
): Promise<WeeklyHoldResult> {
  // Route to the correct executor based on plModel
  const plModel = intradayFilter?.plModel ?? "weekly_hold";
  const executor = EXECUTORS[plModel];
  if (executor) {
    console.log(`[engine] Routing to ${plModel} executor for ${weekOpenUtc}`);
    return executor(biasSource, weekOpenUtc);
  }

  // Default: weekly hold (open→close from pair_period_returns)
  const directions = await resolveDirections(biasSource, weekOpenUtc);
  const pairReturns = await getWeeklyPairReturns(weekOpenUtc);
  const returnMap = new Map(pairReturns.map((r) => [r.symbol, r]));

  const trades: WeeklyHoldTrade[] = [];

  for (const [key, signal] of directions) {
    // For tandem, key is "PAIR:model" — extract the pair name
    const pair = key.includes(":") ? key.split(":")[0]! : key;
    const priceData = returnMap.get(pair);

    const openPrice = priceData?.openPrice ?? 0;
    const closePrice = priceData?.closePrice ?? openPrice;
    const actualReturn = priceData?.returnPct ?? 0;
    // If direction is SHORT, negate the return (price going down = profit)
    const directedReturn = signal.direction === "SHORT" ? -actualReturn : actualReturn;

    trades.push({
      symbol: pair,
      assetClass: priceData?.assetClass ?? signal.assetClass,
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

  return {
    weekOpenUtc,
    biasSourceId: biasSource.id,
    trades,
    totalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    tradeCount: trades.length,
  };
}

export async function computeMultiWeekHold(
  biasSource: BiasSourceConfig,
  weekOpenUtcs: string[],
  intradayFilter?: IntradayFilterConfig,
): Promise<MultiWeekResult> {
  const weeks: WeeklyHoldResult[] = [];
  for (const weekOpenUtc of weekOpenUtcs) {
    try {
      const result = await computeWeeklyHold(biasSource, weekOpenUtc, intradayFilter);
      weeks.push(result);
    } catch (err) {
      console.warn(`[engine] Skipping week ${weekOpenUtc}:`, err instanceof Error ? err.message : err);
    }
  }

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
