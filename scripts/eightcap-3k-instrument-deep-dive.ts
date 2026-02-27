// Set DATABASE_URL before any imports.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import fs from "node:fs";
import { DateTime } from "luxon";
import { getPool, query, queryOne } from "../src/lib/db";
import type { AssetClass } from "../src/lib/cotMarkets";
import { readMarketSnapshot } from "../src/lib/priceStore";
import type { PerformanceModel } from "../src/lib/performanceLab";
import {
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
} from "../src/lib/performance/modelConfig";
import type { BasketSignal } from "../src/lib/basketSignals";
import { groupSignals } from "../src/lib/plannedTrades";
import { findLotMapEntry, type LotMapRow } from "../src/lib/accounts/mt5ViewHelpers";

const DEFAULT_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
] as const;

const TARGET_ACCOUNT_SIZE_USD = Number(process.env.ACCOUNT_SIZE_USD ?? "3000");
const ACCOUNT_ID_OVERRIDE = process.env.MT5_ACCOUNT_ID?.trim() || null;
const MT5_MIN_LOT = Number(process.env.MT5_MIN_LOT ?? "0.01");
const MT5_LOT_STEP = Number(process.env.MT5_LOT_STEP ?? "0.01");
const TIER1_WEIGHT = Number(process.env.TIER1_WEIGHT ?? "1");
const TIER2_WEIGHT = Number(process.env.TIER2_WEIGHT ?? "1");
const TIER3_WEIGHT = Number(process.env.TIER3_WEIGHT ?? "1");

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type Tier = 1 | 2 | 3;
type Version = "v1" | "v2" | "v3";
type Mode = "universal" | "tiered";

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

type ComputedSignal = {
  symbol: string;
  assetClass: AssetClass;
  model: PerformanceModel;
  direction: "LONG" | "SHORT";
};

type TieredTrade = {
  symbol: string;
  assetClass: AssetClass;
  direction: "LONG" | "SHORT";
  tier: Tier;
  adjusted_percent: number | null;
};

type PositionRow = {
  week_open_utc: string;
  week_label: string;
  version: Version;
  mode: Mode;
  symbol: string;
  asset_class: AssetClass;
  model: PerformanceModel | null;
  tier: Tier | null;
  direction: "LONG" | "SHORT";
  adjusted_percent: number;
  pnl_usd: number;
  margin_usd: number;
  is_win: boolean;
};

type InstrumentAggregate = {
  symbol: string;
  asset_class: AssetClass;
  trades: number;
  wins: number;
  win_rate: number;
  net_pnl_usd: number;
  avg_pnl_usd: number;
  total_margin_usd: number;
  pnl_on_margin_pct: number;
  avg_return_pct: number;
  worst_trade_usd: number;
  best_trade_usd: number;
  worst_week_usd: number;
  best_week_usd: number;
  weekly_volatility_usd: number;
  weeks_traded: number;
  profit_factor: number;
};

type ScopeResult = {
  scope: string;
  rows: InstrumentAggregate[];
  worst_by_net: InstrumentAggregate[];
  worst_by_avg_min3: InstrumentAggregate[];
  best_by_net: InstrumentAggregate[];
};

const VERSION_MODELS: Record<Version, PerformanceModel[]> = {
  v1: PERFORMANCE_V1_MODELS,
  v2: PERFORMANCE_V2_MODELS,
  v3: PERFORMANCE_V3_MODELS,
};

const TIER_SOURCES: Record<Version, PerformanceModel[]> = {
  v1: ["blended", "dealer", "commercial", "sentiment"],
  v2: ["dealer", "sentiment"],
  v3: ["dealer", "commercial", "sentiment"],
};

function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value: number, digits = 4): number {
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

function floorToLotStep(value: number, step = MT5_LOT_STEP, minLot = MT5_MIN_LOT): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const floored = Math.floor(value / step) * step;
  return Number(Math.max(minLot, floored).toFixed(2));
}

function resolveReferenceLot(row: LotMapRow | null | undefined): number | null {
  const candidates = [
    toNum(row?.lot),
    toNum((row as { post_clamp_lot?: unknown })?.post_clamp_lot),
    toNum((row as { target_lot?: unknown })?.target_lot),
    toNum((row as { solved_lot_raw?: unknown })?.solved_lot_raw),
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function effectiveLotScale(
  row: LotMapRow | null | undefined,
  accountScale: number,
  multiplier = 1,
): number {
  const linearScale = accountScale * multiplier;
  const refLot = resolveReferenceLot(row);
  if (!refLot || !Number.isFinite(refLot) || refLot <= 0) {
    return linearScale;
  }
  const targetLot = refLot * linearScale;
  if (!Number.isFinite(targetLot) || targetLot <= 0) {
    return 0;
  }
  const clampedLot = floorToLotStep(targetLot);
  return clampedLot / refLot;
}

function weekLabel(weekOpenUtc: string): string {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy-LL-dd");
}

function keyForRow(assetClass: AssetClass, model: PerformanceModel): string {
  return `${assetClass}|${model}`;
}

function pairKey(assetClass: AssetClass, pair: string): string {
  return `${assetClass}|${pair}`;
}

function normalizeDirection(value: unknown): Direction {
  if (value === "LONG" || value === "SHORT") return value;
  return "NEUTRAL";
}

function classifyTierForVotes(
  directionalLong: number,
  directionalShort: number,
  neutral: number,
  voters: number,
): { tier: Tier; direction: "LONG" | "SHORT" } | null {
  if (voters <= 0) return null;

  // Tiered V2 rules (2 voters): no Tier 3.
  if (voters === 2) {
    if (directionalLong === 2) return { tier: 1, direction: "LONG" };
    if (directionalShort === 2) return { tier: 1, direction: "SHORT" };
    if (directionalLong === 1 && neutral === 1) return { tier: 2, direction: "LONG" };
    if (directionalShort === 1 && neutral === 1) return { tier: 2, direction: "SHORT" };
    return null;
  }

  if (directionalLong === voters) return { tier: 1, direction: "LONG" };
  if (directionalShort === voters) return { tier: 1, direction: "SHORT" };

  const maxDirectional = Math.max(directionalLong, directionalShort);
  if (maxDirectional === voters - 1) {
    return directionalLong > directionalShort
      ? { tier: 2, direction: "LONG" }
      : { tier: 2, direction: "SHORT" };
  }

  if (directionalLong > directionalShort && directionalLong > 0) {
    return { tier: 3, direction: "LONG" };
  }
  if (directionalShort > directionalLong && directionalShort > 0) {
    return { tier: 3, direction: "SHORT" };
  }
  return null;
}

function deriveAntikytheraV2Rows(rows: SnapshotModelRow[]): SnapshotModelRow[] {
  const byKey = new Map<string, SnapshotModelRow>();
  for (const row of rows) byKey.set(keyForRow(row.asset_class, row.model), row);
  const out = [...rows];

  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    const antikyV2Key = keyForRow(assetClass, "antikythera_v2");
    if (byKey.has(antikyV2Key)) continue;

    const dealer = byKey.get(keyForRow(assetClass, "dealer"));
    const sentiment = byKey.get(keyForRow(assetClass, "sentiment"));
    if (!dealer || !sentiment) continue;

    const dealerByPair = new Map(
      (dealer.pair_details ?? []).map((detail) => [`${detail.pair}|${detail.direction}`, detail]),
    );

    const pairDetails: SnapshotPairDetail[] = [];
    for (const detail of sentiment.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      const matched = dealerByPair.get(`${detail.pair}|${detail.direction}`);
      if (!matched) continue;
      pairDetails.push({
        pair: detail.pair,
        direction: detail.direction,
        reason: ["Dealer COT bias aligned", "Sentiment bias aligned (derived)"],
        percent: null,
      });
    }

    out.push({
      asset_class: assetClass,
      model: "antikythera_v2",
      pair_details: pairDetails,
    });
  }

  return out;
}

async function loadEightcapAccount(): Promise<Mt5AccountRow> {
  const rows = await query<Mt5AccountRow>(
    `SELECT account_id, label, broker, server, currency, equity, baseline_equity, lot_map
       FROM mt5_accounts
      WHERE LOWER(broker) LIKE '%eightcap%'
      ORDER BY equity DESC`,
  );
  const filtered = rows.filter((row) => parseLotMapRows(row.lot_map).length > 0);
  if (!filtered.length) {
    throw new Error("No Eightcap account with lot_map rows found.");
  }
  if (ACCOUNT_ID_OVERRIDE) {
    const selected = filtered.find((row) => row.account_id === ACCOUNT_ID_OVERRIDE);
    if (selected) return selected;
  }
  return filtered[0]!;
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

async function loadWeekRows(weekOpenUtc: string): Promise<SnapshotModelRow[]> {
  const models: PerformanceModel[] = Array.from(
    new Set([
      ...PERFORMANCE_V1_MODELS,
      ...PERFORMANCE_V2_MODELS,
      ...PERFORMANCE_V3_MODELS,
      "dealer",
      "commercial",
      "sentiment",
      "blended",
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

async function resolveWeeks(): Promise<string[]> {
  const weeksCsv = process.env.WEEKS_CSV?.trim();
  if (weeksCsv) {
    return weeksCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const weeksCountRaw = process.env.WEEKS_COUNT?.trim();
  const weeksCount = weeksCountRaw ? Number(weeksCountRaw) : NaN;
  if (Number.isFinite(weeksCount) && weeksCount > 0) {
    const rows = await query<{ week_open_utc: Date }>(
      `SELECT DISTINCT week_open_utc
         FROM performance_snapshots
        ORDER BY week_open_utc DESC
        LIMIT $1`,
      [Math.floor(weeksCount)],
    );
    return rows
      .map((r) => r.week_open_utc.toISOString())
      .sort((a, b) => DateTime.fromISO(a).toMillis() - DateTime.fromISO(b).toMillis());
  }

  return [...DEFAULT_WEEKS];
}

async function loadMarketReturns(weekOpenUtc: string): Promise<Map<string, number>> {
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

function buildSystemSignals(rows: SnapshotModelRow[]): {
  allSignals: BasketSignal[];
  signalMap: Map<string, ComputedSignal>;
} {
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
          symbol: detail.pair,
          assetClass: row.asset_class,
          model: row.model,
          direction: detail.direction,
        },
      );
    }
  }
  return { allSignals, signalMap };
}

function buildTieredTrades(options: {
  rows: SnapshotModelRow[];
  sourceModels: PerformanceModel[];
  marketReturns: Map<string, number>;
}): TieredTrade[] {
  const sourceMap = new Map<PerformanceModel, Map<string, Direction>>();
  for (const model of options.sourceModels) sourceMap.set(model, new Map<string, Direction>());

  for (const row of options.rows) {
    if (!sourceMap.has(row.model)) continue;
    const map = sourceMap.get(row.model)!;
    for (const detail of row.pair_details ?? []) {
      map.set(pairKey(row.asset_class, detail.pair), normalizeDirection(detail.direction));
    }
  }

  const allPairs = new Set<string>();
  for (const model of options.sourceModels) {
    for (const key of sourceMap.get(model)?.keys() ?? []) allPairs.add(key);
  }

  const trades: TieredTrade[] = [];
  for (const key of allPairs) {
    const [assetClassRaw = "fx", symbol = ""] = key.split("|");
    const assetClass = assetClassRaw as AssetClass;

    let longCount = 0;
    let shortCount = 0;
    let neutralCount = 0;
    for (const model of options.sourceModels) {
      const dir = sourceMap.get(model)?.get(key) ?? "NEUTRAL";
      if (dir === "LONG") longCount += 1;
      else if (dir === "SHORT") shortCount += 1;
      else neutralCount += 1;
    }

    const classified = classifyTierForVotes(
      longCount,
      shortCount,
      neutralCount,
      options.sourceModels.length,
    );
    if (!classified) continue;

    const raw = options.marketReturns.get(key);
    const adjusted =
      raw === undefined ? null : classified.direction === "LONG" ? raw : -raw;

    trades.push({
      symbol,
      assetClass,
      direction: classified.direction,
      tier: classified.tier,
      adjusted_percent: adjusted,
    });
  }

  return trades.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function stddev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function aggregateInstruments(rows: PositionRow[]): InstrumentAggregate[] {
  const byInstrument = new Map<
    string,
    {
      symbol: string;
      asset_class: AssetClass;
      trades: number;
      wins: number;
      net_pnl_usd: number;
      total_margin_usd: number;
      adjusted_sum: number;
      worst_trade_usd: number;
      best_trade_usd: number;
      gross_win: number;
      gross_loss_abs: number;
      week_pnl: Map<string, number>;
    }
  >();

  for (const row of rows) {
    const key = `${row.asset_class}|${row.symbol}`;
    if (!byInstrument.has(key)) {
      byInstrument.set(key, {
        symbol: row.symbol,
        asset_class: row.asset_class,
        trades: 0,
        wins: 0,
        net_pnl_usd: 0,
        total_margin_usd: 0,
        adjusted_sum: 0,
        worst_trade_usd: Number.POSITIVE_INFINITY,
        best_trade_usd: Number.NEGATIVE_INFINITY,
        gross_win: 0,
        gross_loss_abs: 0,
        week_pnl: new Map<string, number>(),
      });
    }
    const acc = byInstrument.get(key)!;
    acc.trades += 1;
    acc.wins += row.is_win ? 1 : 0;
    acc.net_pnl_usd += row.pnl_usd;
    acc.total_margin_usd += row.margin_usd;
    acc.adjusted_sum += row.adjusted_percent;
    acc.worst_trade_usd = Math.min(acc.worst_trade_usd, row.pnl_usd);
    acc.best_trade_usd = Math.max(acc.best_trade_usd, row.pnl_usd);
    if (row.pnl_usd > 0) acc.gross_win += row.pnl_usd;
    if (row.pnl_usd < 0) acc.gross_loss_abs += Math.abs(row.pnl_usd);
    acc.week_pnl.set(row.week_open_utc, (acc.week_pnl.get(row.week_open_utc) ?? 0) + row.pnl_usd);
  }

  const out: InstrumentAggregate[] = [];
  for (const acc of byInstrument.values()) {
    const weekly = Array.from(acc.week_pnl.values());
    out.push({
      symbol: acc.symbol,
      asset_class: acc.asset_class,
      trades: acc.trades,
      wins: acc.wins,
      win_rate: acc.trades > 0 ? round((acc.wins / acc.trades) * 100, 2) : 0,
      net_pnl_usd: round(acc.net_pnl_usd, 2),
      avg_pnl_usd: acc.trades > 0 ? round(acc.net_pnl_usd / acc.trades, 4) : 0,
      total_margin_usd: round(acc.total_margin_usd, 2),
      pnl_on_margin_pct: acc.total_margin_usd > 0 ? round((acc.net_pnl_usd / acc.total_margin_usd) * 100, 4) : 0,
      avg_return_pct: acc.trades > 0 ? round(acc.adjusted_sum / acc.trades, 4) : 0,
      worst_trade_usd: round(acc.worst_trade_usd, 4),
      best_trade_usd: round(acc.best_trade_usd, 4),
      worst_week_usd: weekly.length ? round(Math.min(...weekly), 4) : 0,
      best_week_usd: weekly.length ? round(Math.max(...weekly), 4) : 0,
      weekly_volatility_usd: weekly.length ? round(stddev(weekly), 4) : 0,
      weeks_traded: weekly.length,
      profit_factor: acc.gross_loss_abs > 0 ? round(acc.gross_win / acc.gross_loss_abs, 4) : Number.POSITIVE_INFINITY,
    });
  }

  return out.sort((a, b) => a.net_pnl_usd - b.net_pnl_usd);
}

function buildScope(scope: string, rows: PositionRow[]): ScopeResult {
  const agg = aggregateInstruments(rows);
  const worstByNet = [...agg].sort((a, b) => a.net_pnl_usd - b.net_pnl_usd).slice(0, 15);
  const worstByAvg = [...agg]
    .filter((r) => r.trades >= 3)
    .sort((a, b) => a.avg_pnl_usd - b.avg_pnl_usd)
    .slice(0, 15);
  const bestByNet = [...agg].sort((a, b) => b.net_pnl_usd - a.net_pnl_usd).slice(0, 15);
  return {
    scope,
    rows: agg,
    worst_by_net: worstByNet,
    worst_by_avg_min3: worstByAvg,
    best_by_net: bestByNet,
  };
}

function tableHeader() {
  return "| Symbol | Asset | Trades | Win % | Net PnL | Avg PnL | Worst Trade | Worst Week | PF |";
}

function tableSep() {
  return "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |";
}

function tableRow(r: InstrumentAggregate) {
  const pf = Number.isFinite(r.profit_factor) ? r.profit_factor.toFixed(2) : "inf";
  return `| ${r.symbol} | ${r.asset_class} | ${r.trades} | ${r.win_rate.toFixed(2)}% | ${r.net_pnl_usd.toFixed(2)} | ${r.avg_pnl_usd.toFixed(4)} | ${r.worst_trade_usd.toFixed(4)} | ${r.worst_week_usd.toFixed(4)} | ${pf} |`;
}

async function main() {
  const weeks = await resolveWeeks();
  if (!weeks.length) {
    throw new Error("No weeks resolved for deep dive.");
  }

  const account = await loadEightcapAccount();
  const fallbackLotMapRows = parseLotMapRows(account.lot_map);
  const fallbackBaseline = toNum(account.baseline_equity) ?? 100000;

  const rowsOut: PositionRow[] = [];

  for (const weekOpenUtc of weeks) {
    const frozenPlan = await loadClosestFrozenPlan(account.account_id, weekOpenUtc);
    const lotMapRows = frozenPlan ? parseLotMapRows(frozenPlan.lot_map) : fallbackLotMapRows;
    const baselineEquity = (frozenPlan ? toNum(frozenPlan.baseline_equity) : null) ?? fallbackBaseline;
    const accountScale = baselineEquity > 0 ? TARGET_ACCOUNT_SIZE_USD / baselineEquity : 1;

    const [weekRows, marketReturns] = await Promise.all([
      loadWeekRows(weekOpenUtc),
      loadMarketReturns(weekOpenUtc),
    ]);
    const { allSignals, signalMap } = buildSystemSignals(weekRows);

    for (const version of ["v1", "v2", "v3"] as const) {
      const models = VERSION_MODELS[version];
      const filteredSignals = allSignals.filter((signal) => models.includes(signal.model));
      const plannedPairs = groupSignals(filteredSignals, models, { dropNetted: false });

      for (const pair of plannedPairs) {
        const lotRow = findLotMapEntry(lotMapRows, pair.symbol);
        const marginPerLeg = toNum(lotRow?.margin_required) ?? 0;
        const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum((lotRow as { move_1pct_per_lot_usd?: unknown })?.move_1pct_per_lot_usd);
        const legScale = effectiveLotScale(lotRow, accountScale, 1);
        if (!move1pct || move1pct <= 0) continue;

        for (const leg of pair.legs) {
          if (leg.direction === "NEUTRAL") continue;
          const signal = signalMap.get(`${pair.assetClass}|${leg.model}|${pair.symbol}|${leg.direction}`);
          if (!signal) continue;
          const raw = marketReturns.get(pairKey(pair.assetClass as AssetClass, pair.symbol));
          if (raw === undefined) continue;
          const adjusted = leg.direction === "LONG" ? raw : -raw;
          const pnl = adjusted * (move1pct * legScale);
          rowsOut.push({
            week_open_utc: weekOpenUtc,
            week_label: weekLabel(weekOpenUtc),
            version,
            mode: "universal",
            symbol: pair.symbol,
            asset_class: pair.assetClass as AssetClass,
            model: leg.model,
            tier: null,
            direction: leg.direction,
            adjusted_percent: round(adjusted, 6),
            pnl_usd: round(pnl, 6),
            margin_usd: round(marginPerLeg * legScale, 6),
            is_win: pnl > 0,
          });
        }
      }

      const tieredTrades = buildTieredTrades({
        rows: weekRows,
        sourceModels: TIER_SOURCES[version],
        marketReturns,
      });
      for (const trade of tieredTrades) {
        const w = trade.tier === 1 ? TIER1_WEIGHT : trade.tier === 2 ? TIER2_WEIGHT : TIER3_WEIGHT;
        if (!Number.isFinite(w) || w <= 0) continue;
        const lotRow = findLotMapEntry(lotMapRows, trade.symbol);
        const marginPerLeg = toNum(lotRow?.margin_required) ?? 0;
        const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum((lotRow as { move_1pct_per_lot_usd?: unknown })?.move_1pct_per_lot_usd);
        const legScale = effectiveLotScale(lotRow, accountScale, w);
        if (trade.adjusted_percent === null || !move1pct || move1pct <= 0) continue;
        const pnl = trade.adjusted_percent * (move1pct * legScale);
        rowsOut.push({
          week_open_utc: weekOpenUtc,
          week_label: weekLabel(weekOpenUtc),
          version,
          mode: "tiered",
          symbol: trade.symbol,
          asset_class: trade.assetClass,
          model: null,
          tier: trade.tier,
          direction: trade.direction,
          adjusted_percent: round(trade.adjusted_percent, 6),
          pnl_usd: round(pnl, 6),
          margin_usd: round(marginPerLeg * legScale, 6),
          is_win: pnl > 0,
        });
      }
    }
  }

  const scopes: ScopeResult[] = [
    buildScope("all_modes_all_versions", rowsOut),
    buildScope("tiered_all_versions", rowsOut.filter((r) => r.mode === "tiered")),
    buildScope("universal_all_versions", rowsOut.filter((r) => r.mode === "universal")),
    buildScope("v3_tiered", rowsOut.filter((r) => r.version === "v3" && r.mode === "tiered")),
    buildScope("v3_universal", rowsOut.filter((r) => r.version === "v3" && r.mode === "universal")),
  ];

  const report = {
    generated_utc: DateTime.utc().toISO(),
    account: {
      account_id: account.account_id,
      label: account.label,
      broker: account.broker,
      server: account.server,
    },
    account_size_usd: TARGET_ACCOUNT_SIZE_USD,
    tier_weights: {
      tier1: TIER1_WEIGHT,
      tier2: TIER2_WEIGHT,
      tier3: TIER3_WEIGHT,
    },
    weeks,
    rows_count: rowsOut.length,
    scopes,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/eightcap-3k-instrument-deep-dive-${stamp}.json`;
  const mdPath = `reports/eightcap-3k-instrument-deep-dive-${stamp}.md`;
  const latestJsonPath = "reports/eightcap-3k-instrument-deep-dive-latest.json";
  const latestMdPath = "reports/eightcap-3k-instrument-deep-dive-latest.md";
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Eightcap 3k Instrument Deep Dive");
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Weeks: ${weeks.join(", ")}`);
  md.push(`Account: ${account.account_id} (${account.label})`);
  md.push(`Tier Weights: T1=${TIER1_WEIGHT}, T2=${TIER2_WEIGHT}, T3=${TIER3_WEIGHT}`);
  md.push(`Rows analyzed: ${rowsOut.length}`);
  md.push("");

  for (const scope of scopes) {
    md.push(`## ${scope.scope}`);
    md.push("");
    md.push("### Worst By Net PnL");
    md.push(tableHeader());
    md.push(tableSep());
    scope.worst_by_net.forEach((r) => md.push(tableRow(r)));
    md.push("");

    md.push("### Worst By Avg PnL (min 3 trades)");
    md.push(tableHeader());
    md.push(tableSep());
    scope.worst_by_avg_min3.forEach((r) => md.push(tableRow(r)));
    md.push("");

    md.push("### Best By Net PnL");
    md.push(tableHeader());
    md.push(tableSep());
    scope.best_by_net.forEach((r) => md.push(tableRow(r)));
    md.push("");
  }

  md.push(`JSON: \`${jsonPath}\``);
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(latestMdPath, md.join("\n"), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${latestJsonPath}`);
  console.log(`Wrote ${latestMdPath}`);
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await getPool().end();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
