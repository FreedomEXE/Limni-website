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
  captured_sync_utc: Date;
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

type V3Trade = {
  symbol: string;
  assetClass: AssetClass;
  tier: Tier;
  direction: "LONG" | "SHORT";
  adjusted_percent: number | null;
};

type WeeklySystemRow = {
  week_open_utc: string;
  week_label: string;
  sizing_source: "frozen_week_plan" | "live_lot_map";
  baseline_equity_used: number;
  account_scale: number;
  v1_base: SystemEval;
  v2_base: SystemEval;
  v3_base: SystemEval;
  v2_normalized_to_v1_margin: SystemEval & { scale: number };
  v3_normalized_to_v1_margin: SystemEval & { scale: number };
  v3_tier_counts: { tier1: number; tier2: number; tier3: number };
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

function pairKey(assetClass: string, pair: string) {
  return `${assetClass}|${pair}`;
}

function normalizeDirection(value: unknown): Direction {
  return value === "LONG" || value === "SHORT" ? value : "NEUTRAL";
}

function classifyTier(sentiment: Direction, dealer: Direction, commercial: Direction) {
  const votes = { LONG: 0, SHORT: 0, NEUTRAL: 0 };
  [sentiment, dealer, commercial].forEach((dir) => {
    votes[dir] += 1;
  });

  if (votes.LONG === 3) return { tier: 1 as Tier, direction: "LONG" as const };
  if (votes.SHORT === 3) return { tier: 1 as Tier, direction: "SHORT" as const };
  if (votes.LONG === 2) return { tier: 2 as Tier, direction: "LONG" as const };
  if (votes.SHORT === 2) return { tier: 2 as Tier, direction: "SHORT" as const };
  if (votes.LONG === 1 && votes.NEUTRAL === 2) return { tier: 3 as Tier, direction: "LONG" as const };
  if (votes.SHORT === 1 && votes.NEUTRAL === 2) return { tier: 3 as Tier, direction: "SHORT" as const };
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
    `SELECT week_open_utc, baseline_equity, captured_sync_utc, lot_map
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
      (dealer.pair_details ?? []).map((row) => [`${row.pair}|${row.direction}`, row]),
    );
    const pairDetails: SnapshotPairDetail[] = [];
    for (const row of sentiment.pair_details ?? []) {
      if (row.direction !== "LONG" && row.direction !== "SHORT") continue;
      const matched = dealerByPair.get(`${row.pair}|${row.direction}`);
      if (!matched) continue;
      pairDetails.push({
        pair: row.pair,
        direction: row.direction,
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

function evaluateSystem(options: {
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
      const raw = options.marketReturns.get(pairKey(pair.assetClass, pair.symbol));
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

function buildV3Trades(rows: SnapshotModelRow[], marketReturns: Map<string, number>): V3Trade[] {
  const dealerByKey = new Map<string, Direction>();
  const commercialByKey = new Map<string, Direction>();
  const sentimentByKey = new Map<string, Direction>();
  const allKeys = new Set<string>();

  const pushRows = (row: SnapshotModelRow | undefined, target: Map<string, Direction>) => {
    if (!row) return;
    for (const detail of row.pair_details ?? []) {
      const key = pairKey(row.asset_class, detail.pair);
      target.set(key, normalizeDirection(detail.direction));
      allKeys.add(key);
    }
  };

  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    pushRows(rows.find((row) => row.asset_class === assetClass && row.model === "dealer"), dealerByKey);
    pushRows(rows.find((row) => row.asset_class === assetClass && row.model === "commercial"), commercialByKey);
    pushRows(rows.find((row) => row.asset_class === assetClass && row.model === "sentiment"), sentimentByKey);
  }

  const trades: V3Trade[] = [];
  for (const key of allKeys) {
    const [assetClassRaw, symbol] = key.split("|");
    const assetClass = assetClassRaw as AssetClass;
    const s = sentimentByKey.get(key) ?? "NEUTRAL";
    const d = dealerByKey.get(key) ?? "NEUTRAL";
    const c = commercialByKey.get(key) ?? "NEUTRAL";
    const classified = classifyTier(s, d, c);
    if (!classified) continue;
    const raw = marketReturns.get(key);
    const adjusted =
      raw === undefined ? null : classified.direction === "LONG" ? raw : -raw;
    trades.push({
      symbol,
      assetClass,
      tier: classified.tier,
      direction: classified.direction,
      adjusted_percent: adjusted,
    });
  }

  return trades.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function evaluateV3Trades(options: {
  trades: V3Trade[];
  lotMapRows: LotMapRow[];
  accountScale: number;
  includeTiers?: Set<Tier>;
  weights?: { 1: number; 2: number; 3: number };
}): SystemEval {
  const include = options.includeTiers ?? new Set<Tier>([1, 2, 3]);
  const weights = options.weights ?? { 1: 1, 2: 1, 3: 1 };
  let trades = 0;
  let priced = 0;
  let wins = 0;
  let margin = 0;
  let pnl = 0;

  for (const trade of options.trades) {
    if (!include.has(trade.tier)) continue;
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

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy-LL-dd");
}

async function main() {
  if (!Number.isFinite(TARGET_ACCOUNT_SIZE_USD) || TARGET_ACCOUNT_SIZE_USD <= 0) {
    throw new Error(`Invalid ACCOUNT_SIZE_USD: ${String(TARGET_ACCOUNT_SIZE_USD)}`);
  }

  const account = await loadEightcapAccount();
  const liveLotMap = parseLotMapRows(account.lot_map);

  const weekly: WeeklySystemRow[] = [];
  for (const weekOpenUtc of WEEKS) {
    const frozen = await loadClosestFrozenPlan(account.account_id, weekOpenUtc);
    const frozenLotMap = parseLotMapRows(frozen?.lot_map ?? null);
    const useFrozen = frozenLotMap.length > 0;
    const lotMapRows = useFrozen ? frozenLotMap : liveLotMap;
    if (lotMapRows.length === 0) {
      throw new Error(`No lot_map rows available for ${weekOpenUtc}`);
    }

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

    const v1Base = evaluateSystem({
      models: PERFORMANCE_V1_MODELS,
      allSignals,
      signalMap,
      marketReturns,
      lotMapRows,
      accountScale,
    });
    const v2Base = evaluateSystem({
      models: PERFORMANCE_V2_MODELS,
      allSignals,
      signalMap,
      marketReturns,
      lotMapRows,
      accountScale,
    });

    const v3Trades = buildV3Trades(rows, marketReturns);
    const v3Base = evaluateV3Trades({
      trades: v3Trades,
      lotMapRows,
      accountScale,
      includeTiers: new Set<Tier>([1, 2, 3]),
      weights: { 1: 1, 2: 1, 3: 1 },
    });

    const v1Margin = v1Base.margin_used_usd;
    const v2Scale = v2Base.margin_used_usd > 0 ? v1Margin / v2Base.margin_used_usd : 0;
    const v3Scale = v3Base.margin_used_usd > 0 ? v1Margin / v3Base.margin_used_usd : 0;

    weekly.push({
      week_open_utc: weekOpenUtc,
      week_label: weekLabel(weekOpenUtc),
      sizing_source: useFrozen ? "frozen_week_plan" : "live_lot_map",
      baseline_equity_used: round(baselineEquity),
      account_scale: round(accountScale, 6),
      v1_base: v1Base,
      v2_base: v2Base,
      v3_base: v3Base,
      v2_normalized_to_v1_margin: withScale(v2Base, v2Scale),
      v3_normalized_to_v1_margin: withScale(v3Base, v3Scale),
      v3_tier_counts: {
        tier1: v3Trades.filter((trade) => trade.tier === 1).length,
        tier2: v3Trades.filter((trade) => trade.tier === 2).length,
        tier3: v3Trades.filter((trade) => trade.tier === 3).length,
      },
    });
  }

  const totals = {
    base: {
      v1: aggregateSystem(weekly.map((row) => row.v1_base)),
      v2: aggregateSystem(weekly.map((row) => row.v2_base)),
      v3: aggregateSystem(weekly.map((row) => row.v3_base)),
    },
    normalized_to_v1_margin: {
      v1: aggregateSystem(weekly.map((row) => ({ ...row.v1_base, return_pct_on_100k: row.v1_base.return_pct_on_100k }))),
      v2: aggregateSystem(weekly.map((row) => row.v2_normalized_to_v1_margin)),
      v3: aggregateSystem(weekly.map((row) => row.v3_normalized_to_v1_margin)),
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
    weekly,
    totals,
    assumptions: [
      "V1 and V2 use existing basket model definitions from performance snapshots.",
      "V3 is agreement-tier based (dealer + commercial + sentiment), all tiers included with 1x weight.",
      "Weekly USD move conversion uses lot_map.move_1pct_usd; margin uses lot_map.margin_required.",
      "Weekly lot map source = frozen weekly plan when available, else current live lot map fallback.",
      "Normalized mode rescales V2/V3 each week to match that week's V1 margin usage.",
      "Returns are arithmetic and compounded across the 5 independent weeks.",
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/eightcap-100k-5week-system-compare-${stamp}.json`;
  const mdPath = `reports/eightcap-100k-5week-system-compare-${stamp}.md`;
  const latestJsonPath = "reports/eightcap-100k-5week-system-compare-latest.json";
  const latestMdPath = "reports/eightcap-100k-5week-system-compare-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Eightcap 100k Five-Week System Comparison");
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Weeks: ${WEEKS.join(", ")}`);
  md.push(`Account: ${report.account.account_id} (${report.account.label})`);
  md.push("");

  md.push("## Totals (Base Sizing)");
  md.push("");
  md.push("| System | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  md.push(`| V1 | ${fmtUsd(totals.base.v1.pnl_usd)} | ${fmtPct(totals.base.v1.arithmetic_return_pct_on_100k)} | ${fmtPct(totals.base.v1.compounded_return_pct_on_100k)} | ${fmtUsd(totals.base.v1.margin_used_usd)} | ${totals.base.v1.priced_trades} | ${totals.base.v1.win_rate.toFixed(2)}% | ${fmtPct(totals.base.v1.avg_return_per_priced_trade_pct)} |`);
  md.push(`| V2 | ${fmtUsd(totals.base.v2.pnl_usd)} | ${fmtPct(totals.base.v2.arithmetic_return_pct_on_100k)} | ${fmtPct(totals.base.v2.compounded_return_pct_on_100k)} | ${fmtUsd(totals.base.v2.margin_used_usd)} | ${totals.base.v2.priced_trades} | ${totals.base.v2.win_rate.toFixed(2)}% | ${fmtPct(totals.base.v2.avg_return_per_priced_trade_pct)} |`);
  md.push(`| V3 | ${fmtUsd(totals.base.v3.pnl_usd)} | ${fmtPct(totals.base.v3.arithmetic_return_pct_on_100k)} | ${fmtPct(totals.base.v3.compounded_return_pct_on_100k)} | ${fmtUsd(totals.base.v3.margin_used_usd)} | ${totals.base.v3.priced_trades} | ${totals.base.v3.win_rate.toFixed(2)}% | ${fmtPct(totals.base.v3.avg_return_per_priced_trade_pct)} |`);
  md.push("");

  md.push("## Totals (V2/V3 Scaled To V1 Weekly Margin)");
  md.push("");
  md.push("| System | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  md.push(`| V1 | ${fmtUsd(totals.normalized_to_v1_margin.v1.pnl_usd)} | ${fmtPct(totals.normalized_to_v1_margin.v1.arithmetic_return_pct_on_100k)} | ${fmtPct(totals.normalized_to_v1_margin.v1.compounded_return_pct_on_100k)} | ${fmtUsd(totals.normalized_to_v1_margin.v1.margin_used_usd)} | ${totals.normalized_to_v1_margin.v1.priced_trades} | ${totals.normalized_to_v1_margin.v1.win_rate.toFixed(2)}% | ${fmtPct(totals.normalized_to_v1_margin.v1.avg_return_per_priced_trade_pct)} |`);
  md.push(`| V2 | ${fmtUsd(totals.normalized_to_v1_margin.v2.pnl_usd)} | ${fmtPct(totals.normalized_to_v1_margin.v2.arithmetic_return_pct_on_100k)} | ${fmtPct(totals.normalized_to_v1_margin.v2.compounded_return_pct_on_100k)} | ${fmtUsd(totals.normalized_to_v1_margin.v2.margin_used_usd)} | ${totals.normalized_to_v1_margin.v2.priced_trades} | ${totals.normalized_to_v1_margin.v2.win_rate.toFixed(2)}% | ${fmtPct(totals.normalized_to_v1_margin.v2.avg_return_per_priced_trade_pct)} |`);
  md.push(`| V3 | ${fmtUsd(totals.normalized_to_v1_margin.v3.pnl_usd)} | ${fmtPct(totals.normalized_to_v1_margin.v3.arithmetic_return_pct_on_100k)} | ${fmtPct(totals.normalized_to_v1_margin.v3.compounded_return_pct_on_100k)} | ${fmtUsd(totals.normalized_to_v1_margin.v3.margin_used_usd)} | ${totals.normalized_to_v1_margin.v3.priced_trades} | ${totals.normalized_to_v1_margin.v3.win_rate.toFixed(2)}% | ${fmtPct(totals.normalized_to_v1_margin.v3.avg_return_per_priced_trade_pct)} |`);
  md.push("");

  md.push("## Weekly Breakdown");
  md.push("");
  md.push("| Week | V1 Base | V2 Base | V3 Base | V2 Scale->V1 | V3 Scale->V1 | V2 Norm | V3 Norm |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of weekly) {
    md.push(`| ${row.week_label} | ${fmtPct(row.v1_base.return_pct_on_100k)} | ${fmtPct(row.v2_base.return_pct_on_100k)} | ${fmtPct(row.v3_base.return_pct_on_100k)} | ${row.v2_normalized_to_v1_margin.scale.toFixed(3)}x | ${row.v3_normalized_to_v1_margin.scale.toFixed(3)}x | ${fmtPct(row.v2_normalized_to_v1_margin.return_pct_on_100k)} | ${fmtPct(row.v3_normalized_to_v1_margin.return_pct_on_100k)} |`);
  }
  md.push("");

  md.push("## Notes");
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
