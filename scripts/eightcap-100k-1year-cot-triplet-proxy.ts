// Set DATABASE_URL before any imports.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import fs from "node:fs";
import { DateTime } from "luxon";
import { getPool, query, queryOne } from "../src/lib/db";
import type { AssetClass } from "../src/lib/cotMarkets";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { getPairPerformance } from "../src/lib/pricePerformance";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { PairSnapshot } from "../src/lib/cotTypes";
import {
  computeModelPerformance,
  type PerformanceModel,
} from "../src/lib/performanceLab";
import type { BasketSignal } from "../src/lib/basketSignals";
import { groupSignals } from "../src/lib/plannedTrades";
import { findLotMapEntry, type LotMapRow } from "../src/lib/accounts/mt5ViewHelpers";

const LOOKBACK_WEEKS = Number(process.env.COT_ONLY_LOOKBACK_WEEKS ?? "52");
const TARGET_ACCOUNT_SIZE_USD = Number(process.env.ACCOUNT_SIZE_USD ?? "100000");
const ACCOUNT_ID_OVERRIDE = process.env.MT5_ACCOUNT_ID?.trim() || null;

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type Tier = 1 | 2 | 3;
type Profile = "dc" | "triplet";

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
  adjusted_percent: number | null;
};

type TieredTrade = {
  symbol: string;
  assetClass: AssetClass;
  direction: "LONG" | "SHORT";
  tier: Tier;
  adjusted_percent: number | null;
};

type SystemEval = {
  trades: number;
  priced_trades: number;
  wins: number;
  margin_used_usd: number;
  pnl_usd: number;
  return_pct_on_100k: number;
};

type WeeklyRow = {
  profile: Profile;
  week_open_utc: string;
  week_label: string;
  universal: SystemEval;
  tiered: SystemEval;
  tiered_normalized_to_universal_margin: SystemEval & { scale: number };
  tier_counts: { tier1: number; tier2: number; tier3: number };
};

type CoverageSummary = {
  total_weeks: number;
  priced_weeks_universal: number;
  priced_weeks_tiered: number;
  first_priced_week: string | null;
  last_priced_week: string | null;
};

const PROFILE_MODELS: Record<Profile, PerformanceModel[]> = {
  dc: ["dealer", "commercial"],
  triplet: ["dealer", "commercial", "antikythera"],
};

const PROFILE_TIER_SOURCES: Record<Profile, PerformanceModel[]> = {
  dc: ["dealer", "commercial"],
  triplet: ["dealer", "commercial", "antikythera"],
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

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function fmtUsd(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function fmtPct(value: number): string {
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

function pairKey(assetClass: AssetClass, pair: string): string {
  return `${assetClass}|${pair}`;
}

function weekLabel(weekOpenUtc: string): string {
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

function getTradingWeekOpenFromReportDate(reportDate: string): string | null {
  const report = DateTime.fromISO(reportDate, { zone: "America/New_York" });
  if (!report.isValid) return null;
  const daysUntilSunday = (7 - (report.weekday % 7)) % 7;
  const sundayOpen = report.plus({ days: daysUntilSunday }).set({
    hour: 19,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return sundayOpen.toUTC().toISO();
}

async function loadCotOnlyWeeks(limit: number): Promise<string[]> {
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`Invalid COT_ONLY_LOOKBACK_WEEKS: ${String(limit)}`);
  }

  const fxHistory = await readSnapshotHistory("fx", Math.max(Math.floor(limit) + 20, 80));
  const currentWeekOpenUtc = DateTime.utc().startOf("week").toISO();

  const weeks = fxHistory
    .map((item) => getTradingWeekOpenFromReportDate(item.report_date))
    .filter((value): value is string => Boolean(value))
    .filter((value) => (currentWeekOpenUtc ? value < currentWeekOpenUtc : true));

  return Array.from(new Set(weeks))
    .sort()
    .slice(-Math.floor(limit));
}

function getReportDateForWeek(weekOpenUtc: string): string {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" })
    .setZone("America/New_York")
    .minus({ days: 5 })
    .toISODate()!;
}

function buildAllPairs(assetClass: AssetClass): Record<string, PairSnapshot> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const pairs: Record<string, PairSnapshot> = {};
  for (const pairDef of pairDefs) {
    pairs[pairDef.pair] = {
      direction: "LONG",
      base_bias: "NEUTRAL",
      quote_bias: "NEUTRAL",
    };
  }
  return pairs;
}

async function readRawSnapshotForWeek(assetClass: AssetClass, weekOpenUtc: string) {
  const targetReportDate = getReportDateForWeek(weekOpenUtc);
  const history = await readSnapshotHistory(assetClass, 260);
  return history.find((item) => item.report_date <= targetReportDate) ?? null;
}

function deriveAntikytheraFromDealerCommercial(rows: SnapshotModelRow[]): SnapshotModelRow[] {
  const out = [...rows];
  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    const dealer = rows.find((row) => row.asset_class === assetClass && row.model === "dealer");
    const commercial = rows.find((row) => row.asset_class === assetClass && row.model === "commercial");
    if (!dealer || !commercial) {
      continue;
    }

    const dealerMap = new Map<string, SnapshotPairDetail>();
    for (const d of dealer.pair_details ?? []) {
      if (d.direction === "LONG" || d.direction === "SHORT") {
        dealerMap.set(d.pair, d);
      }
    }

    const derived: SnapshotPairDetail[] = [];
    for (const c of commercial.pair_details ?? []) {
      if (c.direction !== "LONG" && c.direction !== "SHORT") continue;
      const d = dealerMap.get(c.pair);
      if (!d) continue;
      if (d.direction !== c.direction) continue;
      const pct = typeof d.percent === "number"
        ? d.percent
        : typeof c.percent === "number"
          ? c.percent
          : null;
      derived.push({
        pair: c.pair,
        direction: c.direction,
        reason: ["Derived antikythera proxy: dealer + commercial agreement"],
        percent: pct,
      });
    }

    out.push({
      asset_class: assetClass,
      model: "antikythera",
      pair_details: derived,
    });
  }
  return out;
}

async function loadWeekRows(weekOpenUtc: string): Promise<SnapshotModelRow[]> {
  const baseModels: PerformanceModel[] = ["dealer", "commercial"];
  const out: SnapshotModelRow[] = [];

  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    const snapshot = await readRawSnapshotForWeek(assetClass, weekOpenUtc);
    if (!snapshot) continue;

    const allPairs = buildAllPairs(assetClass);
    const performance = await getPairPerformance(allPairs, {
      assetClass,
      reportDate: snapshot.report_date,
      isLatestReport: false,
    });

    for (const model of baseModels) {
      const computed = await computeModelPerformance({
        model,
        assetClass,
        snapshot,
        sentiment: [],
        performance,
      });

      out.push({
        asset_class: assetClass,
        model,
        pair_details: computed.pair_details as SnapshotPairDetail[],
      });
    }
  }

  return deriveAntikytheraFromDealerCommercial(out);
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
          adjusted_percent: typeof detail.percent === "number" ? detail.percent : null,
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
      if (typeof signal.adjusted_percent !== "number") continue;

      const tradePnl = signal.adjusted_percent * (move1pct * options.accountScale);
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
}): TieredTrade[] {
  const sourceMap = new Map<
    PerformanceModel,
    Map<string, { direction: Direction; adjusted_percent: number | null }>
  >();
  for (const model of options.sourceModels) {
    sourceMap.set(model, new Map());
  }

  for (const row of options.rows) {
    if (!sourceMap.has(row.model)) continue;
    const map = sourceMap.get(row.model)!;
    for (const detail of row.pair_details ?? []) {
      map.set(pairKey(row.asset_class, detail.pair), {
        direction: normalizeDirection(detail.direction),
        adjusted_percent: typeof detail.percent === "number" ? detail.percent : null,
      });
    }
  }

  const allPairs = new Set<string>();
  for (const model of options.sourceModels) {
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
    for (const model of options.sourceModels) {
      const dir = sourceMap.get(model)?.get(key)?.direction ?? "NEUTRAL";
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

    let raw: number | null = null;
    for (const model of options.sourceModels) {
      const source = sourceMap.get(model)?.get(key);
      if (!source || typeof source.adjusted_percent !== "number") continue;
      if (source.direction === "LONG") {
        raw = source.adjusted_percent;
        break;
      }
      if (source.direction === "SHORT") {
        raw = -source.adjusted_percent;
        break;
      }
    }

    const adjusted = raw === null ? null : classified.direction === "LONG" ? raw : -raw;
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

function buildCoverage(rows: WeeklyRow[]): CoverageSummary {
  const pricedRows = rows.filter(
    (row) => row.universal.priced_trades > 0 || row.tiered.priced_trades > 0,
  );
  return {
    total_weeks: rows.length,
    priced_weeks_universal: rows.filter((row) => row.universal.priced_trades > 0).length,
    priced_weeks_tiered: rows.filter((row) => row.tiered.priced_trades > 0).length,
    first_priced_week: pricedRows[0]?.week_open_utc ?? null,
    last_priced_week: pricedRows.at(-1)?.week_open_utc ?? null,
  };
}

async function main() {
  if (!Number.isFinite(TARGET_ACCOUNT_SIZE_USD) || TARGET_ACCOUNT_SIZE_USD <= 0) {
    throw new Error(`Invalid ACCOUNT_SIZE_USD: ${String(TARGET_ACCOUNT_SIZE_USD)}`);
  }

  const weeks = await loadCotOnlyWeeks(LOOKBACK_WEEKS);
  if (!weeks.length) {
    throw new Error("No COT weeks found.");
  }

  const account = await loadEightcapAccount();
  const liveLotMap = parseLotMapRows(account.lot_map);
  if (!liveLotMap.length) {
    throw new Error("No live lot_map rows available.");
  }

  const rowsOut: WeeklyRow[] = [];

  for (const weekOpenUtc of weeks) {
    const frozen = await loadClosestFrozenPlan(account.account_id, weekOpenUtc);
    const frozenLotMap = parseLotMapRows(frozen?.lot_map ?? null);
    const useFrozen = frozenLotMap.length > 0;
    const lotMapRows = useFrozen ? frozenLotMap : liveLotMap;

    const baselineEquity =
      toNum(useFrozen ? frozen?.baseline_equity : account.baseline_equity) ??
      toNum(account.baseline_equity) ??
      TARGET_ACCOUNT_SIZE_USD;
    const accountScale = baselineEquity > 0 ? TARGET_ACCOUNT_SIZE_USD / baselineEquity : 1;

    const weekRows = await loadWeekRows(weekOpenUtc);
    const { allSignals, signalMap } = buildSystemSignals(weekRows);

    for (const profile of ["dc", "triplet"] as const) {
      const universal = evaluateUniversal({
        models: PROFILE_MODELS[profile],
        allSignals,
        signalMap,
        lotMapRows,
        accountScale,
      });

      const tieredTrades = buildTieredTrades({
        rows: weekRows,
        sourceModels: PROFILE_TIER_SOURCES[profile],
      });
      const tiered = evaluateTiered({
        trades: tieredTrades,
        lotMapRows,
        accountScale,
      });

      const scale =
        tiered.margin_used_usd > 0 ? universal.margin_used_usd / tiered.margin_used_usd : 0;

      rowsOut.push({
        profile,
        week_open_utc: weekOpenUtc,
        week_label: weekLabel(weekOpenUtc),
        universal,
        tiered,
        tiered_normalized_to_universal_margin: withScale(tiered, scale),
        tier_counts: {
          tier1: tieredTrades.filter((t) => t.tier === 1).length,
          tier2: tieredTrades.filter((t) => t.tier === 2).length,
          tier3: tieredTrades.filter((t) => t.tier === 3).length,
        },
      });
    }
  }

  const totalsByProfile = (["dc", "triplet"] as const).reduce((acc, profile) => {
    const rows = rowsOut.filter((row) => row.profile === profile);
    acc[profile] = {
      universal: aggregateSystem(rows.map((row) => row.universal)),
      tiered: aggregateSystem(rows.map((row) => row.tiered)),
      tiered_normalized_to_universal_margin: aggregateSystem(
        rows.map((row) => row.tiered_normalized_to_universal_margin),
      ),
    };
    return acc;
  }, {} as Record<Profile, {
    universal: ReturnType<typeof aggregateSystem>;
    tiered: ReturnType<typeof aggregateSystem>;
    tiered_normalized_to_universal_margin: ReturnType<typeof aggregateSystem>;
  }>);

  const coverageByProfile = (["dc", "triplet"] as const).reduce((acc, profile) => {
    acc[profile] = buildCoverage(rowsOut.filter((row) => row.profile === profile));
    return acc;
  }, {} as Record<Profile, CoverageSummary>);

  const report = {
    generated_utc: DateTime.utc().toISO(),
    account_size_usd: TARGET_ACCOUNT_SIZE_USD,
    weeks,
    account: {
      account_id: account.account_id,
      label: account.label,
      broker: account.broker,
      server: account.server,
      currency: account.currency,
      equity_now: round(Number(account.equity)),
      baseline_equity_now: round(Number(account.baseline_equity)),
    },
    definitions: {
      dc_universal: "Dealer + Commercial only",
      triplet_universal: "Dealer + Commercial + Antikythera proxy (dealer/commercial pair agreement)",
      dc_tiered: "2-voter tiering (dealer/commercial)",
      triplet_tiered: "3-voter tiering (dealer/commercial/antikythera-proxy)",
      antikythera_proxy:
        "Sentiment-free proxy. Pair included when dealer and commercial have same direction; this replaces true antikythera (dealer+sentiment) for long-history testing.",
    },
    weekly: rowsOut,
    coverage_by_profile: coverageByProfile,
    totals_by_profile: totalsByProfile,
    assumptions: [
      "COT history drives dealer/commercial signals across the full lookback window.",
      "Antikythera in this report is a proxy based on dealer+commercial agreement, not dealer+sentiment.",
      "Weekly USD conversion uses lot_map.move_1pct_usd and lot_map.margin_required.",
      "Weekly lot map source uses frozen weekly plan when available, else live lot map fallback.",
      "Normalized tiered mode rescales tiered each week to match that profile's universal margin usage.",
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/eightcap-100k-1year-cot-triplet-proxy-${stamp}.json`;
  const mdPath = `reports/eightcap-100k-1year-cot-triplet-proxy-${stamp}.md`;
  const latestJsonPath = "reports/eightcap-100k-1year-cot-triplet-proxy-latest.json";
  const latestMdPath = "reports/eightcap-100k-1year-cot-triplet-proxy-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Eightcap 100k - 1Y COT Triplet Proxy");
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Weeks (${weeks.length}): ${weeks[0]} -> ${weeks[weeks.length - 1]}`);
  md.push(`Account: ${report.account.account_id} (${report.account.label})`);
  md.push("");
  md.push("## Coverage");
  md.push("| Profile | Total Weeks | Priced Weeks (Universal) | Priced Weeks (Tiered) | First Priced Week | Last Priced Week |");
  md.push("| --- | ---: | ---: | ---: | --- | --- |");
  for (const profile of ["dc", "triplet"] as const) {
    const c = coverageByProfile[profile];
    md.push(
      `| ${profile} | ${c.total_weeks} | ${c.priced_weeks_universal} | ${c.priced_weeks_tiered} | ${c.first_priced_week ?? "-"} | ${c.last_priced_week ?? "-"} |`,
    );
  }
  md.push("");

  md.push("## Totals By Profile");
  for (const profile of ["dc", "triplet"] as const) {
    const t = totalsByProfile[profile];
    md.push("");
    md.push(`### ${profile}`);
    md.push("| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |");
    md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
    md.push(`| Universal | ${fmtUsd(t.universal.pnl_usd)} | ${fmtPct(t.universal.arithmetic_return_pct_on_100k)} | ${fmtPct(t.universal.compounded_return_pct_on_100k)} | ${fmtUsd(t.universal.margin_used_usd)} | ${t.universal.priced_trades} | ${t.universal.win_rate.toFixed(2)}% | ${fmtPct(t.universal.avg_return_per_priced_trade_pct)} |`);
    md.push(`| Tiered (base) | ${fmtUsd(t.tiered.pnl_usd)} | ${fmtPct(t.tiered.arithmetic_return_pct_on_100k)} | ${fmtPct(t.tiered.compounded_return_pct_on_100k)} | ${fmtUsd(t.tiered.margin_used_usd)} | ${t.tiered.priced_trades} | ${t.tiered.win_rate.toFixed(2)}% | ${fmtPct(t.tiered.avg_return_per_priced_trade_pct)} |`);
    md.push(`| Tiered (scaled to Universal margin) | ${fmtUsd(t.tiered_normalized_to_universal_margin.pnl_usd)} | ${fmtPct(t.tiered_normalized_to_universal_margin.arithmetic_return_pct_on_100k)} | ${fmtPct(t.tiered_normalized_to_universal_margin.compounded_return_pct_on_100k)} | ${fmtUsd(t.tiered_normalized_to_universal_margin.margin_used_usd)} | ${t.tiered_normalized_to_universal_margin.priced_trades} | ${t.tiered_normalized_to_universal_margin.win_rate.toFixed(2)}% | ${fmtPct(t.tiered_normalized_to_universal_margin.avg_return_per_priced_trade_pct)} |`);
  }

  md.push("");
  md.push("## Weekly Breakdown");
  for (const profile of ["dc", "triplet"] as const) {
    md.push("");
    md.push(`### ${profile} Weekly`);
    md.push("| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |");
    md.push("| --- | ---: | ---: | ---: | ---: | --- |");
    const rows = rowsOut.filter((row) => row.profile === profile);
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

