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

const WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
] as const;

const TARGET_ACCOUNT_SIZE_USD = Number(process.env.ACCOUNT_SIZE_USD ?? "100000");
const ACCOUNT_ID_OVERRIDE = process.env.MT5_ACCOUNT_ID?.trim() || null;

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type Tier = 1 | 2 | 3;
type Version = "v1" | "v2" | "v3";

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

type SystemEval = {
  trades: number;
  priced_trades: number;
  wins: number;
  margin_used_usd: number;
  pnl_usd: number;
  return_pct_on_100k: number;
};

type TieredTrade = {
  symbol: string;
  assetClass: AssetClass;
  direction: "LONG" | "SHORT";
  tier: Tier;
  adjusted_percent: number | null;
};

type VersionWeekRow = {
  version: Version;
  week_open_utc: string;
  week_label: string;
  universal: SystemEval;
  tiered: SystemEval;
  tiered_normalized_to_universal_margin: SystemEval & { scale: number };
  tier_counts: { tier1: number; tier2: number; tier3: number };
};

type VersionTotals = {
  universal: ReturnType<typeof aggregateSystem>;
  tiered: ReturnType<typeof aggregateSystem>;
  tiered_normalized_to_universal_margin: ReturnType<typeof aggregateSystem>;
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
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function fmtUsd(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function fmtPct(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
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

function keyForRow(assetClass: AssetClass, model: PerformanceModel) {
  return `${assetClass}|${model}`;
}

function pairKey(assetClass: AssetClass, pair: string) {
  return `${assetClass}|${pair}`;
}

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy-LL-dd");
}

function normalizeDirection(value: unknown): Direction {
  if (value === "LONG" || value === "SHORT") {
    return value;
  }
  return "NEUTRAL";
}

function classifyTierForVotes(
  directionalLong: number,
  directionalShort: number,
  neutral: number,
  voters: number,
): { tier: Tier; direction: "LONG" | "SHORT" } | null {
  if (voters <= 0) {
    return null;
  }

  // Tiered V2 rules (2 voters): no Tier 3 by design.
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

  // Tier 3 rule: bare minimum, as long as one direction strictly wins.
  if (directionalLong > directionalShort && directionalLong > 0) {
    return { tier: 3, direction: "LONG" };
  }
  if (directionalShort > directionalLong && directionalShort > 0) {
    return { tier: 3, direction: "SHORT" };
  }
  return null;
}

async function loadEightcapAccount(): Promise<Mt5AccountRow> {
  const rows = await query<Mt5AccountRow>(
    `SELECT account_id, label, broker, server, currency, equity, baseline_equity, lot_map
       FROM mt5_accounts
      WHERE LOWER(broker) LIKE '%eightcap%'
      ORDER BY equity DESC`,
  );
  const filtered = rows.filter((row) => parseLotMapRows(row.lot_map).length > 0);
  if (filtered.length === 0) {
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

function deriveAntikytheraV2Rows(rows: SnapshotModelRow[]): SnapshotModelRow[] {
  const byKey = new Map<string, SnapshotModelRow>();
  for (const row of rows) {
    byKey.set(keyForRow(row.asset_class, row.model), row);
  }
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

function evaluateUniversal(options: {
  models: PerformanceModel[];
  allSignals: BasketSignal[];
  signalMap: Map<string, ComputedSignal>;
  marketReturns: Map<string, number>;
  lotMapRows: LotMapRow[];
  accountScale: number;
}): SystemEval {
  const filteredSignals = options.allSignals.filter((signal) =>
    options.models.includes(signal.model),
  );
  const plannedPairs = groupSignals(filteredSignals, options.models, { dropNetted: false });

  let trades = 0;
  let priced = 0;
  let wins = 0;
  let margin = 0;
  let pnl = 0;

  for (const pair of plannedPairs) {
    const lotRow = findLotMapEntry(options.lotMapRows, pair.symbol);
    const marginPerLeg = toNum(lotRow?.margin_required);
    const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum(lotRow?.move_1pct_per_lot_usd);

    if (marginPerLeg && marginPerLeg > 0) {
      margin += (marginPerLeg * options.accountScale) * pair.legs.length;
    }

    for (const leg of pair.legs) {
      trades += 1;
      const signal = options.signalMap.get(
        `${pair.assetClass}|${leg.model}|${pair.symbol}|${leg.direction}`,
      );
      if (!signal || !move1pct || move1pct <= 0) continue;

      const raw = options.marketReturns.get(pairKey(pair.assetClass as AssetClass, pair.symbol));
      if (raw === undefined) continue;

      const adjusted = leg.direction === "LONG" ? raw : -raw;
      const tradePnl = adjusted * (move1pct * options.accountScale);
      pnl += tradePnl;
      priced += 1;
      if (tradePnl > 0) wins += 1;
    }
  }

  return {
    trades,
    priced_trades: priced,
    wins,
    margin_used_usd: round(margin),
    pnl_usd: round(pnl),
    return_pct_on_100k: round((pnl / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
  };
}

function buildTieredTrades(options: {
  rows: SnapshotModelRow[];
  sourceModels: PerformanceModel[];
  marketReturns: Map<string, number>;
}): TieredTrade[] {
  const { rows, sourceModels, marketReturns } = options;
  const sourceMap = new Map<PerformanceModel, Map<string, Direction>>();
  for (const model of sourceModels) {
    sourceMap.set(model, new Map<string, Direction>());
  }

  for (const row of rows) {
    if (!sourceMap.has(row.model)) continue;
    const map = sourceMap.get(row.model)!;
    for (const detail of row.pair_details ?? []) {
      map.set(pairKey(row.asset_class, detail.pair), normalizeDirection(detail.direction));
    }
  }

  const allPairs = new Set<string>();
  for (const model of sourceModels) {
    for (const key of sourceMap.get(model)?.keys() ?? []) {
      allPairs.add(key);
    }
  }

  const trades: TieredTrade[] = [];
  for (const key of allPairs) {
    const [assetClassRaw = "fx", symbol = ""] = key.split("|");
    const assetClass = assetClassRaw as AssetClass;

    let longCount = 0;
    let shortCount = 0;
    let neutralCount = 0;
    for (const model of sourceModels) {
      const dir = sourceMap.get(model)?.get(key) ?? "NEUTRAL";
      if (dir === "LONG") longCount += 1;
      else if (dir === "SHORT") shortCount += 1;
      else neutralCount += 1;
    }

    const classified = classifyTierForVotes(
      longCount,
      shortCount,
      neutralCount,
      sourceModels.length,
    );
    if (!classified) continue;

    const raw = marketReturns.get(key);
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

function evaluateTiered(options: {
  trades: TieredTrade[];
  lotMapRows: LotMapRow[];
  accountScale: number;
  weights?: { 1: number; 2: number; 3: number };
}): SystemEval {
  const weights = options.weights ?? { 1: 1, 2: 1, 3: 1 };
  let trades = 0;
  let priced = 0;
  let wins = 0;
  let margin = 0;
  let pnl = 0;

  for (const trade of options.trades) {
    const w = weights[trade.tier];
    if (!Number.isFinite(w) || w <= 0) continue;
    trades += 1;

    const lotRow = findLotMapEntry(options.lotMapRows, trade.symbol);
    const marginPerLeg = toNum(lotRow?.margin_required);
    const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum(lotRow?.move_1pct_per_lot_usd);

    if (marginPerLeg && marginPerLeg > 0) {
      margin += marginPerLeg * options.accountScale * w;
    }
    if (trade.adjusted_percent === null || !move1pct || move1pct <= 0) continue;

    const tradePnl = trade.adjusted_percent * (move1pct * options.accountScale * w);
    pnl += tradePnl;
    priced += 1;
    if (tradePnl > 0) wins += 1;
  }

  return {
    trades,
    priced_trades: priced,
    wins,
    margin_used_usd: round(margin),
    pnl_usd: round(pnl),
    return_pct_on_100k: round((pnl / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
  };
}

function withScale(base: SystemEval, scale: number): SystemEval & { scale: number } {
  if (!Number.isFinite(scale) || scale <= 0) {
    return {
      ...base,
      scale: 0,
      margin_used_usd: 0,
      pnl_usd: 0,
      return_pct_on_100k: 0,
    };
  }
  return {
    ...base,
    scale: round(scale, 6),
    margin_used_usd: round(base.margin_used_usd * scale),
    pnl_usd: round(base.pnl_usd * scale),
    return_pct_on_100k: round(base.return_pct_on_100k * scale, 4),
  };
}

function aggregateSystem(rows: Array<SystemEval & { return_pct_on_100k: number }>) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.pnl_usd += row.pnl_usd;
      acc.margin_used_usd += row.margin_used_usd;
      acc.trades += row.trades;
      acc.priced_trades += row.priced_trades;
      acc.wins += row.wins;
      acc.arithmetic_return_pct += row.return_pct_on_100k;
      acc.weekly_returns.push(row.return_pct_on_100k);
      return acc;
    },
    {
      pnl_usd: 0,
      margin_used_usd: 0,
      trades: 0,
      priced_trades: 0,
      wins: 0,
      arithmetic_return_pct: 0,
      weekly_returns: [] as number[],
    },
  );

  const growth = totals.weekly_returns.reduce((acc, ret) => acc * (1 + (ret / 100)), 1);
  return {
    pnl_usd: round(totals.pnl_usd),
    margin_used_usd: round(totals.margin_used_usd),
    trades: totals.trades,
    priced_trades: totals.priced_trades,
    wins: totals.wins,
    win_rate: totals.priced_trades > 0 ? round((totals.wins / totals.priced_trades) * 100, 2) : 0,
    arithmetic_return_pct_on_100k: round(totals.arithmetic_return_pct, 4),
    compounded_return_pct_on_100k: round((growth - 1) * 100, 4),
    avg_return_per_priced_trade_pct:
      totals.priced_trades > 0 ? round(totals.arithmetic_return_pct / totals.priced_trades, 4) : 0,
  };
}

async function main() {
  if (!Number.isFinite(TARGET_ACCOUNT_SIZE_USD) || TARGET_ACCOUNT_SIZE_USD <= 0) {
    throw new Error(`Invalid ACCOUNT_SIZE_USD: ${String(TARGET_ACCOUNT_SIZE_USD)}`);
  }

  const account = await loadEightcapAccount();
  const liveLotMap = parseLotMapRows(account.lot_map);
  if (liveLotMap.length === 0) {
    throw new Error("No live lot_map rows available.");
  }

  const rowsOut: VersionWeekRow[] = [];

  for (const weekOpenUtc of WEEKS) {
    const frozen = await loadClosestFrozenPlan(account.account_id, weekOpenUtc);
    const frozenLotMap = parseLotMapRows(frozen?.lot_map ?? null);
    const useFrozen = frozenLotMap.length > 0;
    const lotMapRows = useFrozen ? frozenLotMap : liveLotMap;

    const baselineEquity =
      toNum(useFrozen ? frozen?.baseline_equity : account.baseline_equity) ??
      toNum(account.baseline_equity) ??
      TARGET_ACCOUNT_SIZE_USD;
    const accountScale =
      baselineEquity > 0 ? TARGET_ACCOUNT_SIZE_USD / baselineEquity : 1;

    const [rows, marketReturns] = await Promise.all([
      loadWeekRows(weekOpenUtc),
      loadMarketReturns(weekOpenUtc),
    ]);
    const { allSignals, signalMap } = buildSystemSignals(rows);

    for (const version of ["v1", "v2", "v3"] as const) {
      const universal = evaluateUniversal({
        models: VERSION_MODELS[version],
        allSignals,
        signalMap,
        marketReturns,
        lotMapRows,
        accountScale,
      });

      const tieredTrades = buildTieredTrades({
        rows,
        sourceModels: TIER_SOURCES[version],
        marketReturns,
      });
      const tiered = evaluateTiered({
        trades: tieredTrades,
        lotMapRows,
        accountScale,
      });

      const scale =
        tiered.margin_used_usd > 0 ? universal.margin_used_usd / tiered.margin_used_usd : 0;

      rowsOut.push({
        version,
        week_open_utc: weekOpenUtc,
        week_label: weekLabel(weekOpenUtc),
        universal,
        tiered,
        tiered_normalized_to_universal_margin: withScale(tiered, scale),
        tier_counts: {
          tier1: tieredTrades.filter((trade) => trade.tier === 1).length,
          tier2: tieredTrades.filter((trade) => trade.tier === 2).length,
          tier3: tieredTrades.filter((trade) => trade.tier === 3).length,
        },
      });
    }
  }

  const totalsByVersion: Record<Version, VersionTotals> = {
    v1: {
      universal: aggregateSystem(rowsOut.filter((row) => row.version === "v1").map((row) => row.universal)),
      tiered: aggregateSystem(rowsOut.filter((row) => row.version === "v1").map((row) => row.tiered)),
      tiered_normalized_to_universal_margin: aggregateSystem(
        rowsOut.filter((row) => row.version === "v1").map((row) => row.tiered_normalized_to_universal_margin),
      ),
    },
    v2: {
      universal: aggregateSystem(rowsOut.filter((row) => row.version === "v2").map((row) => row.universal)),
      tiered: aggregateSystem(rowsOut.filter((row) => row.version === "v2").map((row) => row.tiered)),
      tiered_normalized_to_universal_margin: aggregateSystem(
        rowsOut.filter((row) => row.version === "v2").map((row) => row.tiered_normalized_to_universal_margin),
      ),
    },
    v3: {
      universal: aggregateSystem(rowsOut.filter((row) => row.version === "v3").map((row) => row.universal)),
      tiered: aggregateSystem(rowsOut.filter((row) => row.version === "v3").map((row) => row.tiered)),
      tiered_normalized_to_universal_margin: aggregateSystem(
        rowsOut.filter((row) => row.version === "v3").map((row) => row.tiered_normalized_to_universal_margin),
      ),
    },
  };

  const report = {
    generated_utc: DateTime.utc().toISO(),
    account_size_usd: TARGET_ACCOUNT_SIZE_USD,
    weeks: [...WEEKS],
    account: {
      account_id: account.account_id,
      label: account.label,
      broker: account.broker,
      server: account.server,
      currency: account.currency,
      equity_now: round(Number(account.equity)),
      baseline_equity_now: round(Number(account.baseline_equity)),
    },
    tier_logic: {
      v1: "4 voters (blended/dealer/commercial/sentiment): T1=4/4, T2=3/4, T3=strict directional winner in remaining states.",
      v2: "2 voters (dealer/sentiment): T1=2/2, T2=1 directional + 1 neutral, no T3.",
      v3: "3 voters (dealer/commercial/sentiment): T1=3/3, T2=2/3, T3=strict directional winner in remaining states.",
    },
    weekly: rowsOut,
    totals_by_version: totalsByVersion,
    assumptions: [
      "Universal systems use existing model baskets (V1/V2/V3) with raw leg summation.",
      "Tiered systems use per-pair vote classification and execute one directional trade per classified pair.",
      "Tier 3 uses strict directional winner rule for systems with >=3 voters.",
      "Weekly USD move conversion uses lot_map.move_1pct_usd; margin uses lot_map.margin_required.",
      "Weekly lot map source = frozen weekly plan when available, else current live lot map fallback.",
      "Normalized tiered mode rescales tiered each week to match that version's universal margin usage.",
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/eightcap-100k-5week-universal-vs-tiered-${stamp}.json`;
  const mdPath = `reports/eightcap-100k-5week-universal-vs-tiered-${stamp}.md`;
  const latestJsonPath = "reports/eightcap-100k-5week-universal-vs-tiered-latest.json";
  const latestMdPath = "reports/eightcap-100k-5week-universal-vs-tiered-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Eightcap 100k - Universal vs Tiered (5 Weeks)");
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Weeks: ${WEEKS.join(", ")}`);
  md.push(`Account: ${report.account.account_id} (${report.account.label})`);
  md.push("");

  md.push("## Totals By Version");
  for (const version of ["v1", "v2", "v3"] as const) {
    const t = totalsByVersion[version];
    md.push("");
    md.push(`### ${version.toUpperCase()}`);
    md.push("| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |");
    md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    md.push(`| Universal | ${fmtUsd(t.universal.pnl_usd)} | ${fmtPct(t.universal.arithmetic_return_pct_on_100k)} | ${fmtPct(t.universal.compounded_return_pct_on_100k)} | ${fmtUsd(t.universal.margin_used_usd)} | ${t.universal.priced_trades} | ${t.universal.win_rate.toFixed(2)}% | ${fmtPct(t.universal.avg_return_per_priced_trade_pct)} |`);
    md.push(`| Tiered (base) | ${fmtUsd(t.tiered.pnl_usd)} | ${fmtPct(t.tiered.arithmetic_return_pct_on_100k)} | ${fmtPct(t.tiered.compounded_return_pct_on_100k)} | ${fmtUsd(t.tiered.margin_used_usd)} | ${t.tiered.priced_trades} | ${t.tiered.win_rate.toFixed(2)}% | ${fmtPct(t.tiered.avg_return_per_priced_trade_pct)} |`);
    md.push(`| Tiered (scaled to Universal margin) | ${fmtUsd(t.tiered_normalized_to_universal_margin.pnl_usd)} | ${fmtPct(t.tiered_normalized_to_universal_margin.arithmetic_return_pct_on_100k)} | ${fmtPct(t.tiered_normalized_to_universal_margin.compounded_return_pct_on_100k)} | ${fmtUsd(t.tiered_normalized_to_universal_margin.margin_used_usd)} | ${t.tiered_normalized_to_universal_margin.priced_trades} | ${t.tiered_normalized_to_universal_margin.win_rate.toFixed(2)}% | ${fmtPct(t.tiered_normalized_to_universal_margin.avg_return_per_priced_trade_pct)} |`);
  }

  md.push("");
  md.push("## Weekly Breakdown");
  for (const version of ["v1", "v2", "v3"] as const) {
    md.push("");
    md.push(`### ${version.toUpperCase()} Weekly`);
    md.push("| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |");
    md.push("| --- | ---: | ---: | ---: | ---: | --- |");
    const rows = rowsOut.filter((row) => row.version === version);
    for (const row of rows) {
      md.push(
        `| ${row.week_label} | ${fmtPct(row.universal.return_pct_on_100k)} | ${fmtPct(row.tiered.return_pct_on_100k)} | ${row.tiered_normalized_to_universal_margin.scale.toFixed(3)}x | ${fmtPct(row.tiered_normalized_to_universal_margin.return_pct_on_100k)} | T1=${row.tier_counts.tier1}, T2=${row.tier_counts.tier2}, T3=${row.tier_counts.tier3} |`,
      );
    }
  }

  md.push("");
  md.push("## Assumptions");
  report.assumptions.forEach((line) => md.push(`- ${line}`));
  md.push("");
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
