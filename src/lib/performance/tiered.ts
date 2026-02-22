import { DateTime } from "luxon";
import { query, queryOne } from "@/lib/db";
import { readMarketSnapshot } from "@/lib/priceStore";
import type { AssetClass } from "@/lib/cotMarkets";
import type { PerformanceModel, ModelPerformance } from "@/lib/performanceLab";
import { computeReturnStats } from "@/lib/performanceLab";
import {
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
  type PerformanceSystem,
} from "@/lib/performance/modelConfig";
import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import type { BasketSignal } from "@/lib/basketSignals";
import { groupSignals } from "@/lib/plannedTrades";
import { findLotMapEntry, type LotMapRow } from "@/lib/accounts/mt5ViewHelpers";

const DEFAULT_ACCOUNT_SIZE_USD = Number(process.env.PERFORMANCE_TIERED_ACCOUNT_SIZE_USD ?? "100000");

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type Tier = 1 | 2 | 3;

type SnapshotPairDetail = {
  pair: string;
  direction: Direction;
  reason: string[];
  percent: number | null;
};

type SnapshotModelRow = {
  asset_class: AssetClass;
  model: PerformanceModel;
  pair_details: SnapshotPairDetail[] | null;
};

type Mt5AccountRow = {
  account_id: string;
  label: string;
  broker: string;
  server: string;
  currency: string;
  equity: string;
  baseline_equity: string;
  lot_map: LotMapRow[] | string | null;
};

type FrozenPlanRow = {
  week_open_utc: Date;
  baseline_equity: string;
  lot_map: LotMapRow[] | string;
};

type ComputedSignal = {
  assetClass: AssetClass;
  model: PerformanceModel;
  symbol: string;
  direction: "LONG" | "SHORT";
};

type TieredTradeEval = {
  symbol: string;
  assetClass: AssetClass;
  direction: "LONG" | "SHORT";
  tier: Tier;
  base_return_percent: number | null;
  margin_used_usd: number;
  pnl_usd: number;
  account_return_pct: number;
};

type TierBucket = {
  total: number;
  priced: number;
  wins: number;
  percent: number;
  pnl_usd: number;
  margin_used_usd: number;
  returns: Array<{ pair: string; percent: number }>;
  pair_details: ModelPerformance["pair_details"];
};

type TieredWeekComputed = {
  week_open_utc: string;
  system: PerformanceSystem;
  scale_to_universal_margin: number;
  universal_margin_used_usd: number;
  tiered_margin_used_usd: number;
  combined: ModelPerformance[];
  perAsset: Record<AssetClass, ModelPerformance[]>;
  summary: {
    return_percent: number;
    trades: number;
    priced_trades: number;
    wins: number;
    win_rate: number;
    margin_used_usd: number;
    universal_margin_used_usd: number;
    scale_to_universal_margin: number;
  };
  tier_counts: { tier1: number; tier2: number; tier3: number };
};

type TieredAllTimeView = {
  combined: ModelPerformance[];
  perAsset: Record<string, ModelPerformance[]>;
  weekly_totals: Array<{
    week_open_utc: string;
    return_percent: number;
    trades: number;
    priced_trades: number;
    wins: number;
  }>;
};

const UNIVERSAL_MODEL_MAP: Record<PerformanceSystem, PerformanceModel[]> = {
  v1: PERFORMANCE_V1_MODELS,
  v2: PERFORMANCE_V2_MODELS,
  v3: PERFORMANCE_V3_MODELS,
};

const TIER_SOURCE_MODELS: Record<PerformanceSystem, PerformanceModel[]> = {
  v1: ["blended", "dealer", "commercial", "sentiment"],
  v2: ["dealer", "sentiment"],
  v3: ["dealer", "commercial", "sentiment"],
};

const TIER_MODEL_MAP: Record<Tier, PerformanceModel> = {
  1: "antikythera_v3",
  2: "dealer",
  3: "commercial",
};

export const TIERED_DISPLAY_LABELS: Record<PerformanceModel, string> = {
  blended: "Blended",
  dealer: "Tier 2",
  commercial: "Tier 3",
  sentiment: "Sentiment",
  antikythera: "Antikythera",
  antikythera_v2: "Antikythera",
  antikythera_v3: "Tier 1",
};

export const TIERED_DISPLAY_MODELS: PerformanceModel[] = [
  "antikythera_v3",
  "dealer",
  "commercial",
];

function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function parseLotMapRows(value: unknown): LotMapRow[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as LotMapRow[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as LotMapRow[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function pairKey(assetClass: AssetClass, pair: string) {
  return `${assetClass}|${pair}`;
}

function rowKey(assetClass: AssetClass, model: PerformanceModel) {
  return `${assetClass}|${model}`;
}

function normalizeDirection(value: unknown): Direction {
  return value === "LONG" || value === "SHORT" ? value : "NEUTRAL";
}

function emptyModelPerformance(model: PerformanceModel, note: string): ModelPerformance {
  return {
    model,
    percent: 0,
    priced: 0,
    total: 0,
    note,
    returns: [],
    pair_details: [],
    stats: {
      avg_return: 0,
      median_return: 0,
      win_rate: 0,
      volatility: 0,
      best_pair: null,
      worst_pair: null,
    },
  };
}

function emptyTierBucket(): TierBucket {
  return {
    total: 0,
    priced: 0,
    wins: 0,
    percent: 0,
    pnl_usd: 0,
    margin_used_usd: 0,
    returns: [],
    pair_details: [],
  };
}

function initTierBuckets() {
  return new Map<Tier, TierBucket>([
    [1, emptyTierBucket()],
    [2, emptyTierBucket()],
    [3, emptyTierBucket()],
  ]);
}

function classifyTierForVotes(longCount: number, shortCount: number, neutralCount: number, voters: number) {
  if (voters === 2) {
    if (longCount === 2) return { tier: 1 as Tier, direction: "LONG" as const };
    if (shortCount === 2) return { tier: 1 as Tier, direction: "SHORT" as const };
    if (longCount === 1 && neutralCount === 1) return { tier: 2 as Tier, direction: "LONG" as const };
    if (shortCount === 1 && neutralCount === 1) return { tier: 2 as Tier, direction: "SHORT" as const };
    return null;
  }

  if (longCount === voters) return { tier: 1 as Tier, direction: "LONG" as const };
  if (shortCount === voters) return { tier: 1 as Tier, direction: "SHORT" as const };

  const maxDirectional = Math.max(longCount, shortCount);
  if (maxDirectional === voters - 1) {
    return longCount > shortCount
      ? { tier: 2 as Tier, direction: "LONG" as const }
      : { tier: 2 as Tier, direction: "SHORT" as const };
  }

  if (longCount > shortCount && longCount > 0) return { tier: 3 as Tier, direction: "LONG" as const };
  if (shortCount > longCount && shortCount > 0) return { tier: 3 as Tier, direction: "SHORT" as const };
  return null;
}

async function loadEightcapAccount(): Promise<Mt5AccountRow | null> {
  const rows = await query<Mt5AccountRow>(
    `SELECT account_id, label, broker, server, currency, equity, baseline_equity, lot_map
       FROM mt5_accounts
      WHERE LOWER(broker) LIKE '%eightcap%'
      ORDER BY equity DESC`,
  );
  const filtered = rows.filter((row) => parseLotMapRows(row.lot_map).length > 0);
  return filtered[0] ?? null;
}

async function loadClosestFrozenPlan(accountId: string, weekOpenUtc: string): Promise<FrozenPlanRow | null> {
  return queryOne<FrozenPlanRow>(
    `SELECT week_open_utc, baseline_equity, lot_map
       FROM mt5_weekly_plans
      WHERE account_id = $1
      ORDER BY ABS(EXTRACT(EPOCH FROM (week_open_utc - $2::timestamptz))) ASC
      LIMIT 1`,
    [accountId, weekOpenUtc],
  );
}

function deriveAntikytheraV2Rows(rows: SnapshotModelRow[]): SnapshotModelRow[] {
  const byKey = new Map<string, SnapshotModelRow>();
  rows.forEach((row) => byKey.set(rowKey(row.asset_class, row.model), row));
  const out = [...rows];
  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    const v2Key = rowKey(assetClass, "antikythera_v2");
    if (byKey.has(v2Key)) continue;

    const dealer = byKey.get(rowKey(assetClass, "dealer"));
    const sentiment = byKey.get(rowKey(assetClass, "sentiment"));
    if (!dealer || !sentiment) continue;

    const dealerByPair = new Map(
      (dealer.pair_details ?? []).map((detail) => [`${detail.pair}|${detail.direction}`, detail]),
    );
    const derived: SnapshotPairDetail[] = [];
    for (const detail of sentiment.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      if (!dealerByPair.has(`${detail.pair}|${detail.direction}`)) continue;
      derived.push({
        pair: detail.pair,
        direction: detail.direction,
        reason: ["Dealer COT bias aligned", "Sentiment bias aligned (derived)"],
        percent: null,
      });
    }
    out.push({ asset_class: assetClass, model: "antikythera_v2", pair_details: derived });
  }
  return out;
}

async function loadWeekSnapshotRows(weekOpenUtc: string): Promise<SnapshotModelRow[]> {
  const models: PerformanceModel[] = Array.from(
    new Set([
      ...PERFORMANCE_V1_MODELS,
      ...PERFORMANCE_V2_MODELS,
      ...PERFORMANCE_V3_MODELS,
      "blended",
      "dealer",
      "commercial",
      "sentiment",
    ]),
  );

  const rows = await query<{
    asset_class: AssetClass;
    model: string;
    pair_details: SnapshotPairDetail[] | string | null;
  }>(
    `SELECT asset_class, model, pair_details
     FROM performance_snapshots
     WHERE week_open_utc = $1
       AND model = ANY($2::text[])`,
    [weekOpenUtc, models],
  );

  const parsed = rows
    .filter((row): row is typeof row & { model: PerformanceModel } =>
      models.includes(row.model as PerformanceModel),
    )
    .map((row) => ({
      asset_class: row.asset_class,
      model: row.model as PerformanceModel,
      pair_details: (() => {
        if (!row.pair_details) return [];
        if (Array.isArray(row.pair_details)) return row.pair_details;
        if (typeof row.pair_details === "string") {
          try {
            const parsedJson = JSON.parse(row.pair_details);
            return Array.isArray(parsedJson) ? (parsedJson as SnapshotPairDetail[]) : [];
          } catch {
            return [];
          }
        }
        return [];
      })(),
    }));

  return deriveAntikytheraV2Rows(parsed);
}

async function loadMarketReturns(weekOpenUtc: string) {
  const out = new Map<string, number>();
  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    const snapshot = await readMarketSnapshot(weekOpenUtc, assetClass);
    if (!snapshot) continue;
    for (const [pair, data] of Object.entries(snapshot.pairs ?? {})) {
      if (data && typeof data.percent === "number" && Number.isFinite(data.percent)) {
        out.set(pairKey(assetClass, pair), data.percent);
      }
    }
  }
  return out;
}

function buildSystemSignals(rows: SnapshotModelRow[]) {
  const allSignals: BasketSignal[] = [];
  const signalMap = new Map<string, ComputedSignal>();
  for (const row of rows) {
    for (const detail of row.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      allSignals.push({
        symbol: detail.pair,
        direction: detail.direction,
        model: row.model,
        asset_class: row.asset_class,
      });
      signalMap.set(
        `${row.asset_class}|${row.model}|${detail.pair}|${detail.direction}`,
        {
          assetClass: row.asset_class,
          model: row.model,
          symbol: detail.pair,
          direction: detail.direction,
        },
      );
    }
  }
  return { allSignals, signalMap };
}

function evaluateUniversalMargin(options: {
  rows: SnapshotModelRow[];
  system: PerformanceSystem;
  lotMapRows: LotMapRow[];
  accountScale: number;
}) {
  const { allSignals, signalMap } = buildSystemSignals(options.rows);
  const models = UNIVERSAL_MODEL_MAP[options.system];
  const plannedPairs = groupSignals(
    allSignals.filter((signal) => models.includes(signal.model)),
    models,
    { dropNetted: false },
  );

  let marginUsed = 0;
  for (const pair of plannedPairs) {
    const lotRow = findLotMapEntry(options.lotMapRows, pair.symbol);
    const marginPerLeg = toNum(lotRow?.margin_required);
    if (marginPerLeg && marginPerLeg > 0) {
      marginUsed += (marginPerLeg * options.accountScale) * pair.legs.length;
    }
    // signalMap referenced so compiler doesn't complain when planned pair generated from mismatched data
    void signalMap;
  }
  return round(marginUsed);
}

function buildTieredTrades(options: {
  rows: SnapshotModelRow[];
  sourceModels: PerformanceModel[];
  marketReturns: Map<string, number>;
  lotMapRows: LotMapRow[];
  accountScale: number;
  accountSizeUsd: number;
}) {
  const { rows, sourceModels, marketReturns, lotMapRows, accountScale, accountSizeUsd } = options;
  const sourceDirMaps = new Map<PerformanceModel, Map<string, Direction>>();
  sourceModels.forEach((model) => sourceDirMaps.set(model, new Map<string, Direction>()));
  for (const row of rows) {
    const map = sourceDirMaps.get(row.model);
    if (!map) continue;
    for (const detail of row.pair_details ?? []) {
      map.set(pairKey(row.asset_class, detail.pair), normalizeDirection(detail.direction));
    }
  }

  const allPairs = new Set<string>();
  sourceModels.forEach((model) => {
    for (const key of sourceDirMaps.get(model)?.keys() ?? []) {
      allPairs.add(key);
    }
  });

  const trades: TieredTradeEval[] = [];
  for (const key of allPairs) {
    const [assetClassRaw, symbol] = key.split("|");
    const assetClass = assetClassRaw as AssetClass;

    let longCount = 0;
    let shortCount = 0;
    let neutralCount = 0;
    sourceModels.forEach((model) => {
      const dir = sourceDirMaps.get(model)?.get(key) ?? "NEUTRAL";
      if (dir === "LONG") longCount += 1;
      else if (dir === "SHORT") shortCount += 1;
      else neutralCount += 1;
    });

    const classified = classifyTierForVotes(longCount, shortCount, neutralCount, sourceModels.length);
    if (!classified) continue;

    const rawReturn = marketReturns.get(key);
    const adjusted = rawReturn === undefined ? null : (classified.direction === "LONG" ? rawReturn : -rawReturn);

    const lotRow = findLotMapEntry(lotMapRows, symbol);
    const marginPerLeg = toNum(lotRow?.margin_required) ?? 0;
    const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum(lotRow?.move_1pct_per_lot_usd) ?? 0;
    const marginUsed = marginPerLeg > 0 ? (marginPerLeg * accountScale) : 0;
    const pnlUsd =
      adjusted !== null && move1pct > 0
        ? adjusted * (move1pct * accountScale)
        : 0;
    const accountReturnPct = accountSizeUsd > 0 ? (pnlUsd / accountSizeUsd) * 100 : 0;

    trades.push({
      symbol,
      assetClass,
      direction: classified.direction,
      tier: classified.tier,
      base_return_percent: adjusted,
      margin_used_usd: marginUsed,
      pnl_usd: pnlUsd,
      account_return_pct: accountReturnPct,
    });
  }

  return trades;
}

function buildTierModelPerformance(options: {
  tier: Tier;
  bucket: TierBucket;
  scale: number;
  note: string;
}): ModelPerformance {
  const scaledReturns = options.bucket.returns.map((row) => ({
    pair: row.pair,
    percent: row.percent * options.scale,
  }));
  const scaledPairDetails = options.bucket.pair_details.map((row) => ({
    ...row,
    percent: typeof row.percent === "number" ? row.percent * options.scale : row.percent,
  }));
  const percent = scaledReturns.reduce((sum, row) => sum + row.percent, 0);
  return {
    model: TIER_MODEL_MAP[options.tier],
    percent: round(percent),
    priced: options.bucket.priced,
    total: options.bucket.total,
    note: options.note,
    returns: scaledReturns,
    pair_details: scaledPairDetails,
    stats: computeReturnStats(scaledReturns),
  };
}

function finalizeTierBucketsToModels(
  buckets: Map<Tier, TierBucket>,
  scale: number,
  note: string,
): ModelPerformance[] {
  return ([1, 2, 3] as const).map((tier) =>
    buildTierModelPerformance({
      tier,
      bucket: buckets.get(tier) ?? emptyTierBucket(),
      scale,
      note,
    }),
  );
}

function makeAssetRecord<T>(factory: () => T): Record<AssetClass, T> {
  return {
    fx: factory(),
    indices: factory(),
    crypto: factory(),
    commodities: factory(),
  };
}

async function computeTieredWeekShared(options: {
  weekOpenUtc: string;
  accountSizeUsd: number;
}) {
  const accountSizeUsd = Number.isFinite(options.accountSizeUsd ?? DEFAULT_ACCOUNT_SIZE_USD)
    ? (options.accountSizeUsd ?? DEFAULT_ACCOUNT_SIZE_USD)
    : DEFAULT_ACCOUNT_SIZE_USD;

  const account = await loadEightcapAccount();
  if (!account) {
    return null;
  }
  const liveLotMap = parseLotMapRows(account.lot_map);
  if (liveLotMap.length === 0) {
    return null;
  }

  const frozen = await loadClosestFrozenPlan(account.account_id, options.weekOpenUtc);
  const frozenLotMap = parseLotMapRows(frozen?.lot_map ?? null);
  const lotMapRows = frozenLotMap.length > 0 ? frozenLotMap : liveLotMap;

  const baselineEquity =
    toNum(frozenLotMap.length > 0 ? frozen?.baseline_equity : account.baseline_equity) ??
    toNum(account.baseline_equity) ??
    accountSizeUsd;
  const accountScale = baselineEquity > 0 ? accountSizeUsd / baselineEquity : 1;

  const [rows, marketReturns] = await Promise.all([
    loadWeekSnapshotRows(options.weekOpenUtc),
    loadMarketReturns(options.weekOpenUtc),
  ]);
  return {
    weekOpenUtc: options.weekOpenUtc,
    accountSizeUsd,
    rows,
    marketReturns,
    lotMapRows,
    accountScale,
  };
}

function computeTieredWeekFromShared(shared: NonNullable<Awaited<ReturnType<typeof computeTieredWeekShared>>>, system: PerformanceSystem): TieredWeekComputed {
  const universalMargin = evaluateUniversalMargin({
    rows: shared.rows,
    system,
    lotMapRows: shared.lotMapRows,
    accountScale: shared.accountScale,
  });

  const trades = buildTieredTrades({
    rows: shared.rows,
    sourceModels: TIER_SOURCE_MODELS[system],
    marketReturns: shared.marketReturns,
    lotMapRows: shared.lotMapRows,
    accountScale: shared.accountScale,
    accountSizeUsd: shared.accountSizeUsd,
  });

  const combinedBuckets = initTierBuckets();
  const perAssetBuckets = makeAssetRecord(initTierBuckets);
  let totalTrades = 0;
  let pricedTrades = 0;
  let wins = 0;
  let tieredMargin = 0;

  for (const trade of trades) {
    totalTrades += 1;
    tieredMargin += trade.margin_used_usd;
    const combinedBucket = combinedBuckets.get(trade.tier)!;
    const assetBucket = perAssetBuckets[trade.assetClass].get(trade.tier)!;
    combinedBucket.total += 1;
    assetBucket.total += 1;

    combinedBucket.margin_used_usd += trade.margin_used_usd;
    assetBucket.margin_used_usd += trade.margin_used_usd;

    const reason = [`Tier ${trade.tier} agreement vote`];
    const pairLabel = trade.symbol;
    if (trade.base_return_percent !== null) {
      pricedTrades += 1;
      combinedBucket.priced += 1;
      assetBucket.priced += 1;

      combinedBucket.returns.push({ pair: pairLabel, percent: trade.account_return_pct });
      assetBucket.returns.push({ pair: pairLabel, percent: trade.account_return_pct });
      combinedBucket.percent += trade.account_return_pct;
      assetBucket.percent += trade.account_return_pct;
      combinedBucket.pnl_usd += trade.pnl_usd;
      assetBucket.pnl_usd += trade.pnl_usd;
      if (trade.pnl_usd > 0) {
        wins += 1;
        combinedBucket.wins += 1;
        assetBucket.wins += 1;
      }
    }

    const pairDetail = {
      pair: pairLabel,
      direction: trade.direction,
      reason,
      percent: trade.base_return_percent !== null ? trade.account_return_pct : null,
    } as ModelPerformance["pair_details"][number];
    combinedBucket.pair_details.push(pairDetail);
    assetBucket.pair_details.push(pairDetail);
  }

  const scale = tieredMargin > 0 ? universalMargin / tieredMargin : 0;
  const note = `Tiered ${system.toUpperCase()} (scaled ${scale.toFixed(3)}x to universal margin)`;
  const combined = finalizeTierBucketsToModels(combinedBuckets, scale, note);
  const perAsset: Record<AssetClass, ModelPerformance[]> = {
    fx: finalizeTierBucketsToModels(perAssetBuckets.fx, scale, note),
    indices: finalizeTierBucketsToModels(perAssetBuckets.indices, scale, note),
    crypto: finalizeTierBucketsToModels(perAssetBuckets.crypto, scale, note),
    commodities: finalizeTierBucketsToModels(perAssetBuckets.commodities, scale, note),
  };

  const combinedReturnPercent = combined.reduce((sum, row) => sum + row.percent, 0);

  return {
    week_open_utc: shared.weekOpenUtc,
    system,
    scale_to_universal_margin: round(scale, 6),
    universal_margin_used_usd: round(universalMargin),
    tiered_margin_used_usd: round(tieredMargin),
    combined,
    perAsset,
    summary: {
      return_percent: round(combinedReturnPercent),
      trades: totalTrades,
      priced_trades: pricedTrades,
      wins,
      win_rate: pricedTrades > 0 ? round((wins / pricedTrades) * 100, 2) : 0,
      margin_used_usd: round(tieredMargin * scale),
      universal_margin_used_usd: round(universalMargin),
      scale_to_universal_margin: round(scale, 6),
    },
    tier_counts: {
      tier1: trades.filter((trade) => trade.tier === 1).length,
      tier2: trades.filter((trade) => trade.tier === 2).length,
      tier3: trades.filter((trade) => trade.tier === 3).length,
    },
  };
}

export async function computeTieredWeekForSystem(options: {
  weekOpenUtc: string;
  system: PerformanceSystem;
  accountSizeUsd?: number;
}): Promise<TieredWeekComputed | null> {
  const accountSizeUsd = Number.isFinite(options.accountSizeUsd ?? DEFAULT_ACCOUNT_SIZE_USD)
    ? (options.accountSizeUsd ?? DEFAULT_ACCOUNT_SIZE_USD)
    : DEFAULT_ACCOUNT_SIZE_USD;
  const shared = await computeTieredWeekShared({
    weekOpenUtc: options.weekOpenUtc,
    accountSizeUsd,
  });
  if (!shared) {
    return null;
  }
  return computeTieredWeekFromShared(shared, options.system);
}

export async function computeTieredWeekForAllSystems(options: {
  weekOpenUtc: string;
  accountSizeUsd?: number;
}): Promise<Record<PerformanceSystem, TieredWeekComputed | null>> {
  const accountSizeUsd = Number.isFinite(options.accountSizeUsd ?? DEFAULT_ACCOUNT_SIZE_USD)
    ? (options.accountSizeUsd ?? DEFAULT_ACCOUNT_SIZE_USD)
    : DEFAULT_ACCOUNT_SIZE_USD;
  const shared = await computeTieredWeekShared({
    weekOpenUtc: options.weekOpenUtc,
    accountSizeUsd,
  });
  if (!shared) {
    return { v1: null, v2: null, v3: null };
  }
  const v1 = computeTieredWeekFromShared(shared, "v1");
  const v2 = computeTieredWeekFromShared(shared, "v2");
  const v3 = computeTieredWeekFromShared(shared, "v3");
  return { v1, v2, v3 };
}

function buildAllTimeModelsFromWeeks(weeks: TieredWeekComputed[]) {
  const tierAgg = new Map<PerformanceModel, Array<{ pair: string; percent: number }>>();
  TIERED_DISPLAY_MODELS.forEach((model) => tierAgg.set(model, []));

  for (const week of weeks) {
    for (const model of week.combined) {
      if (!tierAgg.has(model.model)) continue;
      tierAgg.get(model.model)!.push({
        pair: weekLabelFromOpen(week.week_open_utc),
        percent: model.percent,
      });
    }
  }

  return TIERED_DISPLAY_MODELS.map((model) => {
    const returns = tierAgg.get(model) ?? [];
    const totalPercent = returns.reduce((sum, row) => sum + row.percent, 0);
    return {
      model,
      percent: round(totalPercent),
      priced: returns.length,
      total: returns.length,
      note: "All-time tiered aggregation (scaled to universal margin).",
      returns,
      pair_details: [],
      stats: computeReturnStats(returns),
    } satisfies ModelPerformance;
  });
}

function buildAllTimePerAssetModels(weeks: TieredWeekComputed[]) {
  const assets: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
  const out: Record<string, ModelPerformance[]> = {};

  for (const asset of assets) {
    const tierAgg = new Map<PerformanceModel, Array<{ pair: string; percent: number }>>();
    TIERED_DISPLAY_MODELS.forEach((model) => tierAgg.set(model, []));

    for (const week of weeks) {
      for (const model of week.perAsset[asset] ?? []) {
        if (!tierAgg.has(model.model)) continue;
        tierAgg.get(model.model)!.push({
          pair: weekLabelFromOpen(week.week_open_utc),
          percent: model.percent,
        });
      }
    }

    out[asset] = TIERED_DISPLAY_MODELS.map((model) => {
      const returns = tierAgg.get(model) ?? [];
      const totalPercent = returns.reduce((sum, row) => sum + row.percent, 0);
      return {
        model,
        percent: round(totalPercent),
        priced: returns.length,
        total: returns.length,
        note: "All-time tiered aggregation (scaled to universal margin).",
        returns,
        pair_details: [],
        stats: computeReturnStats(returns),
      } satisfies ModelPerformance;
    });
  }

  return out;
}

export async function computeTieredForWeeksAllSystems(options: {
  weeks: string[];
  accountSizeUsd?: number;
}) {
  const bySystem: Record<PerformanceSystem, TieredWeekComputed[]> = {
    v1: [],
    v2: [],
    v3: [],
  };

  for (const week of options.weeks) {
    const result = await computeTieredWeekForAllSystems({
      weekOpenUtc: week,
      accountSizeUsd: options.accountSizeUsd,
    });
    (["v1", "v2", "v3"] as const).forEach((system) => {
      if (result[system]) {
        bySystem[system].push(result[system]!);
      }
    });
  }

  return bySystem;
}

export function buildTieredAllTimeViewsFromWeekly(
  weeklyBySystem: Record<PerformanceSystem, TieredWeekComputed[]>,
): Record<PerformanceSystem, TieredAllTimeView> {
  const out = {} as Record<PerformanceSystem, TieredAllTimeView>;
  (["v1", "v2", "v3"] as const).forEach((system) => {
    const weeks = [...weeklyBySystem[system]].sort((a, b) =>
      DateTime.fromISO(a.week_open_utc, { zone: "utc" }).toMillis() -
      DateTime.fromISO(b.week_open_utc, { zone: "utc" }).toMillis(),
    );
    out[system] = {
      combined: buildAllTimeModelsFromWeeks(weeks),
      perAsset: buildAllTimePerAssetModels(weeks),
      weekly_totals: weeks.map((week) => ({
        week_open_utc: week.week_open_utc,
        return_percent: week.summary.return_percent,
        trades: week.summary.trades,
        priced_trades: week.summary.priced_trades,
        wins: week.summary.wins,
      })),
    };
  });
  return out;
}
