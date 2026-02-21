// Set DATABASE_URL before any imports.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import fs from "node:fs";
import { DateTime } from "luxon";
import { getPool, query, queryOne } from "../src/lib/db";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { PerformanceModel } from "../src/lib/performanceLab";
import {
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
} from "../src/lib/performance/modelConfig";
import type { BasketSignal } from "../src/lib/basketSignals";
import { groupSignals } from "../src/lib/plannedTrades";
import { findLotMapEntry, type LotMapRow } from "../src/lib/accounts/mt5ViewHelpers";

const TARGET_WEEK_OPEN_UTC =
  process.env.WEEK_OPEN_UTC?.trim() || "2026-02-16T00:00:00.000Z";
const TARGET_ACCOUNT_SIZE_USD = Number(process.env.ACCOUNT_SIZE_USD ?? "100000");
const ACCOUNT_ID_OVERRIDE = process.env.MT5_ACCOUNT_ID?.trim() || null;

type SnapshotPairDetail = {
  pair: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
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
  balance: string;
  baseline_equity: string;
  free_margin: string;
  margin: string;
  lot_map: LotMapRow[] | string | null;
};

type FrozenPlanRow = {
  week_open_utc: Date;
  baseline_equity: string;
  captured_sync_utc: Date;
  lot_map: LotMapRow[] | string;
};

type ClosedWeekRow = {
  net_usd: string | null;
  trades: string | null;
};

type ComputedSignal = {
  symbol: string;
  assetClass: AssetClass;
  model: PerformanceModel;
  direction: "LONG" | "SHORT";
  percent: number | null;
};

type BaseSystemResult = {
  system: "V1" | "V2";
  pairs: number;
  legs: number;
  priced_legs: number;
  winning_legs: number;
  margin_used_usd: number;
  pnl_usd: number;
  return_pct_on_100k: number;
};

type Tier = 1 | 2 | 3;
type V3Trade = {
  key: string;
  symbol: string;
  assetClass: AssetClass;
  tier: Tier;
  direction: "LONG" | "SHORT";
  raw_percent: number | null;
  adjusted_percent: number | null;
  pattern: string;
};

type V3Scenario = {
  id: string;
  label: string;
  weights: { 1: number; 2: number; 3: number };
  include: Set<Tier>;
};

type V3ScenarioResult = {
  id: string;
  label: string;
  weights: { 1: number; 2: number; 3: number };
  trades: number;
  priced_trades: number;
  winning_trades: number;
  margin_used_usd: number;
  pnl_usd: number;
  return_pct_on_100k: number;
};

type TierSummary = {
  tier: Tier;
  trades: number;
  priced_trades: number;
  winning_trades: number;
  win_rate: number;
  sum_adjusted_percent: number;
  avg_adjusted_percent: number;
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

function weekOpenUtcForTimestampLegacy(timestampIso: string): string | null {
  const parsed = DateTime.fromISO(timestampIso, { zone: "utc" });
  if (!parsed.isValid) return null;
  const ny = parsed.setZone("America/New_York");
  const weekday = ny.weekday; // 1=Mon .. 7=Sun
  let monday = ny;
  if (weekday === 7) {
    monday = ny.plus({ days: 1 });
  } else {
    const daysSinceMonday = (weekday + 6) % 7;
    monday = ny.minus({ days: daysSinceMonday });
  }
  return monday
    .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toISO();
}

async function loadEightcapAccount(): Promise<Mt5AccountRow> {
  const rows = await query<Mt5AccountRow>(
    `SELECT account_id, label, broker, server, currency, equity, balance, baseline_equity, free_margin, margin, lot_map
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

async function loadClosestFrozenPlan(accountId: string, targetWeekOpenUtc: string): Promise<FrozenPlanRow | null> {
  return queryOne<FrozenPlanRow>(
    `SELECT week_open_utc, baseline_equity, captured_sync_utc, lot_map
       FROM mt5_weekly_plans
      WHERE account_id = $1
      ORDER BY ABS(EXTRACT(EPOCH FROM (week_open_utc - $2::timestamptz))) ASC
      LIMIT 1`,
    [accountId, targetWeekOpenUtc],
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

  return rows
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
            const parsed = JSON.parse(row.pair_details);
            return Array.isArray(parsed) ? (parsed as SnapshotPairDetail[]) : [];
          } catch {
            return [];
          }
        }
        return [];
      })(),
    }));
}

function deriveAntikytheraV2Rows(rows: SnapshotModelRow[]): SnapshotModelRow[] {
  const byKey = new Map<string, SnapshotModelRow>();
  for (const row of rows) {
    byKey.set(keyForRow(row.asset_class, row.model), row);
  }
  const out = [...rows];
  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    const antikyV2Key = keyForRow(assetClass, "antikythera_v2");
    if (byKey.has(antikyV2Key)) {
      continue;
    }
    const dealer = byKey.get(keyForRow(assetClass, "dealer"));
    const sentiment = byKey.get(keyForRow(assetClass, "sentiment"));
    if (!dealer || !sentiment) {
      continue;
    }
    const dealerByPair = new Map(
      (dealer.pair_details ?? []).map((row) => [`${row.pair}|${row.direction}`, row]),
    );
    const pairDetails: SnapshotPairDetail[] = [];
    for (const row of sentiment.pair_details ?? []) {
      if (row.direction !== "LONG" && row.direction !== "SHORT") {
        continue;
      }
      const matched = dealerByPair.get(`${row.pair}|${row.direction}`);
      if (!matched) {
        continue;
      }
      pairDetails.push({
        pair: row.pair,
        direction: row.direction,
        reason: ["Dealer COT bias aligned", "Sentiment bias aligned (derived)"],
        percent:
          typeof matched.percent === "number"
            ? matched.percent
            : typeof row.percent === "number"
              ? row.percent
              : null,
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

function buildSystemSignals(rows: SnapshotModelRow[]): {
  allSignals: BasketSignal[];
  signalMap: Map<string, ComputedSignal>;
} {
  const allSignals: BasketSignal[] = [];
  const signalMap = new Map<string, ComputedSignal>();
  for (const row of rows) {
    for (const detail of row.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") {
        continue;
      }
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
          percent: typeof detail.percent === "number" ? detail.percent : null,
        },
      );
    }
  }
  return { allSignals, signalMap };
}

function evaluateBaseSystem(options: {
  system: "V1" | "V2";
  models: PerformanceModel[];
  allSignals: BasketSignal[];
  signalMap: Map<string, ComputedSignal>;
  lotMapRows: LotMapRow[];
  accountScale: number;
}): BaseSystemResult {
  const filteredSignals = options.allSignals.filter((signal) =>
    options.models.includes(signal.model),
  );
  const plannedPairs = groupSignals(filteredSignals, options.models, { dropNetted: false });

  let legs = 0;
  let pricedLegs = 0;
  let winningLegs = 0;
  let marginUsed = 0;
  let pnlUsd = 0;

  for (const pair of plannedPairs) {
    const lotRow = findLotMapEntry(options.lotMapRows, pair.symbol);
    const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum(lotRow?.move_1pct_per_lot_usd);
    const marginPerLeg = toNum(lotRow?.margin_required);
    if (marginPerLeg && marginPerLeg > 0) {
      marginUsed += (marginPerLeg * options.accountScale) * pair.legs.length;
    }
    for (const leg of pair.legs) {
      legs += 1;
      const signal = options.signalMap.get(
        `${pair.assetClass}|${leg.model}|${pair.symbol}|${leg.direction}`,
      );
      if (!signal || signal.percent === null || !move1pct || move1pct <= 0) {
        continue;
      }
      const legPnl = signal.percent * (move1pct * options.accountScale);
      pnlUsd += legPnl;
      pricedLegs += 1;
      if (legPnl > 0) {
        winningLegs += 1;
      }
    }
  }

  return {
    system: options.system,
    pairs: plannedPairs.length,
    legs,
    priced_legs: pricedLegs,
    winning_legs: winningLegs,
    margin_used_usd: round(marginUsed),
    pnl_usd: round(pnlUsd),
    return_pct_on_100k: round((pnlUsd / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
  };
}

function buildV3Trades(rows: SnapshotModelRow[]): V3Trade[] {
  const dealerByKey = new Map<string, SnapshotPairDetail>();
  const commercialByKey = new Map<string, SnapshotPairDetail>();
  const sentimentByKey = new Map<string, SnapshotPairDetail>();
  const allKeys = new Set<string>();
  const rawReturnByKey = new Map<string, number>();
  const symbolByKey = new Map<string, string>();
  const assetByKey = new Map<string, AssetClass>();

  const pushRows = (
    row: SnapshotModelRow | undefined,
    target: Map<string, SnapshotPairDetail>,
  ) => {
    if (!row) return;
    for (const detail of row.pair_details ?? []) {
      const key = `${row.asset_class}|${detail.pair}`;
      target.set(key, detail);
      allKeys.add(key);
      symbolByKey.set(key, detail.pair);
      assetByKey.set(key, row.asset_class);

      if (
        (detail.direction === "LONG" || detail.direction === "SHORT") &&
        typeof detail.percent === "number" &&
        Number.isFinite(detail.percent)
      ) {
        const raw = detail.direction === "LONG" ? detail.percent : -detail.percent;
        if (!rawReturnByKey.has(key)) {
          rawReturnByKey.set(key, raw);
        }
      }
    }
  };

  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    pushRows(
      rows.find((row) => row.asset_class === assetClass && row.model === "dealer"),
      dealerByKey,
    );
    pushRows(
      rows.find((row) => row.asset_class === assetClass && row.model === "commercial"),
      commercialByKey,
    );
    pushRows(
      rows.find((row) => row.asset_class === assetClass && row.model === "sentiment"),
      sentimentByKey,
    );
  }

  const toDir = (value: SnapshotPairDetail | undefined) =>
    value?.direction === "LONG" || value?.direction === "SHORT" ? value.direction : "NEUTRAL";

  const classify = (s: string, d: string, c: string) => {
    const votes = {
      LONG: 0,
      SHORT: 0,
      NEUTRAL: 0,
    };
    votes[s as "LONG" | "SHORT" | "NEUTRAL"] += 1;
    votes[d as "LONG" | "SHORT" | "NEUTRAL"] += 1;
    votes[c as "LONG" | "SHORT" | "NEUTRAL"] += 1;

    if (votes.LONG === 3) return { tier: 1 as Tier, direction: "LONG" as const };
    if (votes.SHORT === 3) return { tier: 1 as Tier, direction: "SHORT" as const };
    if (votes.LONG === 2) return { tier: 2 as Tier, direction: "LONG" as const };
    if (votes.SHORT === 2) return { tier: 2 as Tier, direction: "SHORT" as const };
    if (votes.LONG === 1 && votes.NEUTRAL === 2) return { tier: 3 as Tier, direction: "LONG" as const };
    if (votes.SHORT === 1 && votes.NEUTRAL === 2) return { tier: 3 as Tier, direction: "SHORT" as const };
    return null;
  };

  const trades: V3Trade[] = [];
  for (const key of allKeys) {
    const s = toDir(sentimentByKey.get(key));
    const d = toDir(dealerByKey.get(key));
    const c = toDir(commercialByKey.get(key));
    const classified = classify(s, d, c);
    if (!classified) {
      continue;
    }
    const raw = rawReturnByKey.get(key) ?? null;
    const adjusted =
      raw === null
        ? null
        : classified.direction === "LONG"
          ? raw
          : -raw;
    trades.push({
      key,
      symbol: symbolByKey.get(key) ?? key.split("|")[1] ?? "",
      assetClass: assetByKey.get(key) ?? "fx",
      tier: classified.tier,
      direction: classified.direction,
      raw_percent: raw,
      adjusted_percent: adjusted,
      pattern: `${s[0]}/${d[0]}/${c[0]}`,
    });
  }

  return trades.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function evaluateV3Scenario(options: {
  scenario: V3Scenario;
  trades: V3Trade[];
  lotMapRows: LotMapRow[];
  accountScale: number;
}): V3ScenarioResult {
  let count = 0;
  let priced = 0;
  let wins = 0;
  let margin = 0;
  let pnl = 0;

  for (const trade of options.trades) {
    if (!options.scenario.include.has(trade.tier)) {
      continue;
    }
    count += 1;
    const tierWeight = options.scenario.weights[trade.tier];
    if (!Number.isFinite(tierWeight) || tierWeight <= 0) {
      continue;
    }
    const lotRow = findLotMapEntry(options.lotMapRows, trade.symbol);
    const marginPerLeg = toNum(lotRow?.margin_required);
    const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum(lotRow?.move_1pct_per_lot_usd);

    if (marginPerLeg && marginPerLeg > 0) {
      margin += marginPerLeg * options.accountScale * tierWeight;
    }
    if (trade.adjusted_percent === null || !move1pct || move1pct <= 0) {
      continue;
    }
    const tradePnl = trade.adjusted_percent * (move1pct * options.accountScale * tierWeight);
    pnl += tradePnl;
    priced += 1;
    if (tradePnl > 0) {
      wins += 1;
    }
  }

  return {
    id: options.scenario.id,
    label: options.scenario.label,
    weights: options.scenario.weights,
    trades: count,
    priced_trades: priced,
    winning_trades: wins,
    margin_used_usd: round(margin),
    pnl_usd: round(pnl),
    return_pct_on_100k: round((pnl / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
  };
}

function scaleScenario(result: V3ScenarioResult, scale: number): V3ScenarioResult {
  if (!Number.isFinite(scale) || scale <= 0) {
    return {
      ...result,
      margin_used_usd: 0,
      pnl_usd: 0,
      return_pct_on_100k: 0,
    };
  }
  return {
    ...result,
    margin_used_usd: round(result.margin_used_usd * scale),
    pnl_usd: round(result.pnl_usd * scale),
    return_pct_on_100k: round(result.return_pct_on_100k * scale, 4),
  };
}

function summarizeTier(trades: V3Trade[], tier: Tier): TierSummary {
  const selected = trades.filter((trade) => trade.tier === tier);
  const priced = selected.filter((trade) => typeof trade.adjusted_percent === "number");
  const wins = priced.filter((trade) => (trade.adjusted_percent ?? 0) > 0).length;
  const sum = priced.reduce((acc, trade) => acc + (trade.adjusted_percent ?? 0), 0);
  const pricedCount = priced.length;
  return {
    tier,
    trades: selected.length,
    priced_trades: pricedCount,
    winning_trades: wins,
    win_rate: pricedCount > 0 ? round((wins / pricedCount) * 100, 2) : 0,
    sum_adjusted_percent: round(sum, 4),
    avg_adjusted_percent: pricedCount > 0 ? round(sum / pricedCount, 4) : 0,
  };
}

async function computeClosedWeekV1Realized(accountId: string, mt5WeekOpenUtc: string) {
  const start = DateTime.fromISO(mt5WeekOpenUtc, { zone: "utc" });
  if (!start.isValid) {
    return { net_usd: 0, trades: 0 };
  }
  const end = start.plus({ days: 7 });
  const row = await queryOne<ClosedWeekRow>(
    `SELECT COALESCE(SUM(profit + swap + commission), 0) AS net_usd,
            COUNT(*)::text AS trades
       FROM mt5_closed_positions
      WHERE account_id = $1
        AND close_time >= $2
        AND close_time < $3`,
    [accountId, start.toJSDate(), end.toJSDate()],
  );
  return {
    net_usd: round(Number(row?.net_usd ?? 0)),
    trades: Number(row?.trades ?? 0),
  };
}

function toList(result: {
  margin_used_usd: number;
  pnl_usd: number;
  return_pct_on_100k: number;
  priced_legs?: number;
  legs?: number;
  winning_legs?: number;
  priced_trades?: number;
  trades?: number;
  winning_trades?: number;
}) {
  const lines: string[] = [];
  lines.push(`- Margin used: ${fmtUsd(result.margin_used_usd)}`);
  if (typeof result.legs === "number" && typeof result.priced_legs === "number") {
    lines.push(
      `- Legs: ${result.legs} (priced ${result.priced_legs}, wins ${result.winning_legs ?? 0})`,
    );
  }
  if (typeof result.trades === "number" && typeof result.priced_trades === "number") {
    lines.push(
      `- Trades: ${result.trades} (priced ${result.priced_trades}, wins ${result.winning_trades ?? 0})`,
    );
  }
  lines.push(`- PnL on 100k: ${fmtUsd(result.pnl_usd)} (${fmtPct(result.return_pct_on_100k)})`);
  return lines;
}

async function main() {
  if (!Number.isFinite(TARGET_ACCOUNT_SIZE_USD) || TARGET_ACCOUNT_SIZE_USD <= 0) {
    throw new Error(`Invalid ACCOUNT_SIZE_USD: ${String(TARGET_ACCOUNT_SIZE_USD)}`);
  }

  const account = await loadEightcapAccount();
  const frozen = await loadClosestFrozenPlan(account.account_id, TARGET_WEEK_OPEN_UTC);
  const frozenLotMap = parseLotMapRows(frozen?.lot_map ?? null);
  const liveLotMap = parseLotMapRows(account.lot_map);
  const useFrozen = frozenLotMap.length > 0;
  const lotMapRows = useFrozen ? frozenLotMap : liveLotMap;
  if (lotMapRows.length === 0) {
    throw new Error("No lot_map rows available for sizing.");
  }

  const baselineEquity =
    toNum(useFrozen ? frozen?.baseline_equity : account.baseline_equity) ??
    toNum(account.baseline_equity) ??
    TARGET_ACCOUNT_SIZE_USD;
  const accountScale =
    baselineEquity > 0 ? TARGET_ACCOUNT_SIZE_USD / baselineEquity : 1;

  const mt5WeekOpenUtc =
    (frozen?.week_open_utc && DateTime.fromJSDate(frozen.week_open_utc, { zone: "utc" }).toISO()) ||
    weekOpenUtcForTimestampLegacy(TARGET_WEEK_OPEN_UTC) ||
    TARGET_WEEK_OPEN_UTC;
  const liveV1Closed = await computeClosedWeekV1Realized(account.account_id, mt5WeekOpenUtc);

  let rows = await loadWeekRows(TARGET_WEEK_OPEN_UTC);
  rows = deriveAntikytheraV2Rows(rows);
  const { allSignals, signalMap } = buildSystemSignals(rows);

  const v1Base = evaluateBaseSystem({
    system: "V1",
    models: PERFORMANCE_V1_MODELS,
    allSignals,
    signalMap,
    lotMapRows,
    accountScale,
  });
  const v2Base = evaluateBaseSystem({
    system: "V2",
    models: PERFORMANCE_V2_MODELS,
    allSignals,
    signalMap,
    lotMapRows,
    accountScale,
  });

  const v3Trades = buildV3Trades(rows);
  const tierCounts = {
    tier1: v3Trades.filter((trade) => trade.tier === 1).length,
    tier2: v3Trades.filter((trade) => trade.tier === 2).length,
    tier3: v3Trades.filter((trade) => trade.tier === 3).length,
  };
  const tierSummaries = {
    tier1: summarizeTier(v3Trades, 1),
    tier2: summarizeTier(v3Trades, 2),
    tier3: summarizeTier(v3Trades, 3),
  };

  const scenarios: V3Scenario[] = [
    {
      id: "all_tiers_equal",
      label: "All tiers (1x/1x/1x)",
      weights: { 1: 1, 2: 1, 3: 1 },
      include: new Set<Tier>([1, 2, 3]),
    },
    {
      id: "tier1_only",
      label: "Tier 1 only",
      weights: { 1: 1, 2: 0, 3: 0 },
      include: new Set<Tier>([1]),
    },
    {
      id: "tier2_only",
      label: "Tier 2 only",
      weights: { 1: 0, 2: 1, 3: 0 },
      include: new Set<Tier>([2]),
    },
    {
      id: "tier3_only",
      label: "Tier 3 only",
      weights: { 1: 0, 2: 0, 3: 1 },
      include: new Set<Tier>([3]),
    },
    {
      id: "tier3_focus_1_1_2",
      label: "Tier3 focus (1x/1x/2x)",
      weights: { 1: 1, 2: 1, 3: 2 },
      include: new Set<Tier>([1, 2, 3]),
    },
    {
      id: "tier3_focus_0_1_2",
      label: "Tier3 focus (0x/1x/2x)",
      weights: { 1: 0, 2: 1, 3: 2 },
      include: new Set<Tier>([2, 3]),
    },
  ];

  const scenarioBase = scenarios.map((scenario) =>
    evaluateV3Scenario({
      scenario,
      trades: v3Trades,
      lotMapRows,
      accountScale,
    }),
  );

  const v1MarginBudget = v1Base.margin_used_usd;
  const scenarioNormalized = scenarioBase.map((result) => {
    const scale =
      result.margin_used_usd > 0 ? v1MarginBudget / result.margin_used_usd : 0;
    return {
      ...scaleScenario(result, scale),
      scale_to_v1_margin: round(scale, 6),
    };
  });

  const report = {
    generated_utc: DateTime.utc().toISO(),
    target_week_open_utc: TARGET_WEEK_OPEN_UTC,
    account_size_usd: TARGET_ACCOUNT_SIZE_USD,
    account: {
      account_id: account.account_id,
      label: account.label,
      broker: account.broker,
      server: account.server,
      currency: account.currency,
      equity_now: round(Number(account.equity)),
      baseline_equity_now: round(Number(account.baseline_equity)),
    },
    sizing: {
      source: useFrozen ? "frozen_week_plan" : "live_lot_map",
      lot_map_rows: lotMapRows.length,
      baseline_equity_used: round(baselineEquity),
      account_scale: round(accountScale, 6),
      frozen_week_open_utc: frozen?.week_open_utc
        ? DateTime.fromJSDate(frozen.week_open_utc, { zone: "utc" }).toISO()
        : null,
      frozen_captured_sync_utc: frozen?.captured_sync_utc
        ? DateTime.fromJSDate(frozen.captured_sync_utc, { zone: "utc" }).toISO()
        : null,
    },
    live_reference: {
      v1_closed_pnl_usd: liveV1Closed.net_usd,
      v1_closed_return_pct_on_100k: round((liveV1Closed.net_usd / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
      mt5_week_open_utc: mt5WeekOpenUtc,
      closed_trades: liveV1Closed.trades,
    },
    v1_base: v1Base,
    v2_base: v2Base,
    v3: {
      tier_counts: tierCounts,
      total_candidate_trades: v3Trades.length,
      tier_summaries: tierSummaries,
      scenarios_base: scenarioBase,
      scenarios_normalized_to_v1_margin: scenarioNormalized,
      trades: v3Trades,
      trades_by_tier: {
        tier1: v3Trades.filter((trade) => trade.tier === 1),
        tier2: v3Trades.filter((trade) => trade.tier === 2),
        tier3: v3Trades.filter((trade) => trade.tier === 3),
      },
    },
    assumptions: [
      "V1 and V2 keep existing basket behavior and use lot_map-based USD conversion.",
      "V3 is computed as agreement vote tiers from dealer/commercial/sentiment (not antikythera-only).",
      "Trade USD move uses lot_map.move_1pct_usd; margin uses lot_map.margin_required.",
      "Normalized scenarios scale each strategy to the same margin budget used by V1 base.",
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/eightcap-100k-v3-tier-test-${stamp}.json`;
  const mdPath = `reports/eightcap-100k-v3-tier-test-${stamp}.md`;
  const latestJsonPath = "reports/eightcap-100k-v3-tier-test-latest.json";
  const latestMdPath = "reports/eightcap-100k-v3-tier-test-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Eightcap 100k V3 Tier Test (Week of Feb 16, 2026)");
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Week: ${report.target_week_open_utc}`);
  md.push(`Account: ${report.account.account_id} (${report.account.label})`);
  md.push(`Sizing source: ${report.sizing.source}`);
  md.push(`Lot map rows: ${report.sizing.lot_map_rows}`);
  md.push("");
  md.push("## Live V1 Reference");
  md.push(`- Closed PnL: ${fmtUsd(report.live_reference.v1_closed_pnl_usd)} (${fmtPct(report.live_reference.v1_closed_return_pct_on_100k)})`);
  md.push(`- Closed trades: ${report.live_reference.closed_trades}`);
  md.push("");
  md.push("## Baseline Systems");
  md.push("");
  md.push("### V1 (as-is, GOD mode 1:1)");
  toList(v1Base).forEach((line) => md.push(line));
  md.push("");
  md.push("### V2 (as-is)");
  toList(v2Base).forEach((line) => md.push(line));
  md.push("");
  md.push("## V3 Tier Structure");
  md.push(`- Tier 1 trades: ${tierCounts.tier1}`);
  md.push(`- Tier 2 trades: ${tierCounts.tier2}`);
  md.push(`- Tier 3 trades: ${tierCounts.tier3}`);
  md.push(`- Total candidate trades: ${v3Trades.length}`);
  md.push("");
  md.push("## V3 Tier Performance (Equal 1x Weight)");
  for (const key of ["tier1", "tier2", "tier3"] as const) {
    const tier = tierSummaries[key];
    md.push(`- Tier ${tier.tier}: ${tier.trades} trades (priced ${tier.priced_trades}), wins ${tier.winning_trades}, win rate ${tier.win_rate.toFixed(2)}%, sum return ${fmtPct(tier.sum_adjusted_percent)}, avg/trade ${fmtPct(tier.avg_adjusted_percent)}`);
  }
  md.push("");
  md.push("## Tier 3 Trade List");
  const tier3Trades = v3Trades
    .filter((trade) => trade.tier === 3)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (tier3Trades.length === 0) {
    md.push("- No Tier 3 trades.");
  } else {
    for (const trade of tier3Trades) {
      const ret = trade.adjusted_percent === null ? "N/A" : fmtPct(trade.adjusted_percent);
      md.push(`- ${trade.symbol} | ${trade.direction} | ${trade.pattern} | ${ret}`);
    }
  }
  md.push("");
  md.push("## V3 Scenarios (Base)");
  for (const row of scenarioBase) {
    md.push("");
    md.push(`### ${row.label}`);
    toList(row).forEach((line) => md.push(line));
  }
  md.push("");
  md.push("## V3 Scenarios (Scaled To V1 Margin Budget)");
  md.push(`- V1 margin budget: ${fmtUsd(v1Base.margin_used_usd)}`);
  for (const row of scenarioNormalized) {
    md.push("");
    md.push(`### ${row.label} (${row.scale_to_v1_margin.toFixed(4)}x)`);
    toList(row).forEach((line) => md.push(line));
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
