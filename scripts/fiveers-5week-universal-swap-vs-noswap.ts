// Set DATABASE_URL before any imports.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { getPool, query, queryOne } from "../src/lib/db";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { PerformanceModel } from "../src/lib/performanceLab";
import { readMarketSnapshot } from "../src/lib/priceStore";
import { PERFORMANCE_V1_MODELS } from "../src/lib/performance/modelConfig";
import type { BasketSignal } from "../src/lib/basketSignals";
import { groupSignals } from "../src/lib/plannedTrades";
import { findLotMapEntry, type LotMapRow } from "../src/lib/accounts/mt5ViewHelpers";

const TARGET_ACCOUNT_SIZE_USD = Number(process.env.ACCOUNT_SIZE_USD ?? "3000");
const ACCOUNT_ID = (process.env.MT5_ACCOUNT_ID ?? "26043051").trim();
const WEEKS_SOURCE_PATH = "reports/eightcap-3k-5week-floor-clamped-compare-latest.json";
const MIN_SWAP_SAMPLE_TRADES = Number(process.env.MIN_SWAP_SAMPLE_TRADES ?? "1");

type Direction = "LONG" | "SHORT" | "NEUTRAL";

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

type SimLeg = {
  week_open_utc: string;
  week_label: string;
  symbol: string;
  canonical_symbol: string;
  asset_class: AssetClass;
  model: PerformanceModel;
  direction: "LONG" | "SHORT";
  effective_lot: number;
  adjusted_percent: number | null;
  pnl_usd: number;
  priced: boolean;
};

type WeekEval = {
  week_open_utc: string;
  week_label: string;
  trades: number;
  priced_trades: number;
  wins: number;
  margin_used_usd: number;
  no_swap_pnl_usd: number;
  no_swap_return_pct: number;
  est_swap_usd: number;
  with_swap_pnl_usd: number;
  with_swap_return_pct: number;
  top_swap_drag_symbols: Array<{ symbol: string; swap_usd: number }>;
};

type SwapProfile = {
  rate_per_lot_day: number;
  hold_days_avg: number;
  trades: number;
};

type ClosedSwapRow = {
  symbol: string;
  type: "BUY" | "SELL";
  lots: number;
  swap: number;
  open_time: Date;
  close_time: Date;
  comment: string | null;
};

type OpenSwapRow = {
  symbol: string;
  type: "BUY" | "SELL";
  lots: number;
  swap: number;
  open_time: Date;
  comment: string | null;
};

function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
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

function normalizeDirection(value: unknown): Direction {
  if (value === "LONG" || value === "SHORT") return value;
  return "NEUTRAL";
}

function resolveReferenceLot(row: LotMapRow | null | undefined): number | null {
  const candidates = [
    toNum(row?.lot),
    toNum(row?.post_clamp_lot),
    toNum(row?.target_lot),
    toNum(row?.solved_lot_raw),
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

function floorToLotStep(value: number, step = 0.01, minLot = 0.01) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const floored = Math.floor(value / step) * step;
  return Number(Math.max(minLot, floored).toFixed(2));
}

function effectiveLotScale(row: LotMapRow | null | undefined, accountScale: number, multiplier = 1) {
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

function canonicalSymbol(raw: string) {
  const key = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!key) return "";
  if (key === "XTIUSD" || key === "WTIUSD" || key === "USOUSD" || key === "USOIL" || key === "USCRUDE") return "WTIUSD";
  if (key === "SP500" || key === "SPX500" || key === "SPXUSD" || key === "US500" || key === "US500USD") return "SPXUSD";
  if (key === "NAS100" || key === "NDX100" || key === "NDXUSD" || key === "US100" || key === "USTEC" || key === "US100USD") return "NDXUSD";
  if (key === "JPN225" || key === "JP225" || key === "NIKKEI225" || key === "NIK225" || key === "NIKKEIUSD" || key === "N225") return "NIKKEIUSD";
  if (key.startsWith("BTCUSD")) return "BTCUSD";
  if (key.startsWith("ETHUSD")) return "ETHUSD";
  if (/^[A-Z]{6}$/.test(key)) return key;
  return key;
}

function inferAssetClass(symbol: string): AssetClass {
  const s = canonicalSymbol(symbol);
  if (s === "SPXUSD" || s === "NDXUSD" || s === "NIKKEIUSD") return "indices";
  if (s === "WTIUSD" || s === "XAUUSD" || s === "XAGUSD") return "commodities";
  if (s === "BTCUSD" || s === "ETHUSD") return "crypto";
  return "fx";
}

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy-LL-dd");
}

async function loadWeekRows(weekOpenUtc: string): Promise<SnapshotModelRow[]> {
  const models: PerformanceModel[] = [...PERFORMANCE_V1_MODELS];

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

function evaluateUniversalDetailed(options: {
  week_open_utc: string;
  models: PerformanceModel[];
  allSignals: BasketSignal[];
  signalMap: Map<string, ComputedSignal>;
  marketReturns: Map<string, number>;
  lotMapRows: LotMapRow[];
  accountScale: number;
}): { eval: Omit<WeekEval, "est_swap_usd" | "with_swap_pnl_usd" | "with_swap_return_pct" | "top_swap_drag_symbols">; legs: SimLeg[] } {
  const filteredSignals = options.allSignals.filter((signal) => options.models.includes(signal.model));
  const plannedPairs = groupSignals(filteredSignals, options.models, { dropNetted: false });

  let trades = 0;
  let priced = 0;
  let wins = 0;
  let margin = 0;
  let pnl = 0;
  const legs: SimLeg[] = [];

  for (const pair of plannedPairs) {
    const lotRow = findLotMapEntry(options.lotMapRows, pair.symbol);
    const marginPerLeg = toNum(lotRow?.margin_required);
    const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum(lotRow?.move_1pct_per_lot_usd);
    const legScale = effectiveLotScale(lotRow, options.accountScale, 1);
    const refLot = resolveReferenceLot(lotRow) ?? 0;
    const effectiveLot = refLot > 0 ? refLot * legScale : 0;

    if (marginPerLeg && marginPerLeg > 0) {
      margin += (marginPerLeg * legScale) * pair.legs.length;
    }

    for (const leg of pair.legs) {
      trades += 1;
      const signal = options.signalMap.get(`${pair.assetClass}|${leg.model}|${pair.symbol}|${leg.direction}`);
      const raw = options.marketReturns.get(pairKey(pair.assetClass as AssetClass, pair.symbol));
      const hasPrice = raw !== undefined && !!move1pct && move1pct > 0;
      let adjustedPercent: number | null = null;
      let tradePnl = 0;
      if (signal && hasPrice) {
        adjustedPercent = leg.direction === "LONG" ? raw! : -raw!;
        tradePnl = adjustedPercent * (move1pct! * legScale);
        pnl += tradePnl;
        priced += 1;
        if (tradePnl > 0) wins += 1;
      }

      legs.push({
        week_open_utc: options.week_open_utc,
        week_label: weekLabel(options.week_open_utc),
        symbol: pair.symbol,
        canonical_symbol: canonicalSymbol(pair.symbol),
        asset_class: pair.assetClass as AssetClass,
        model: leg.model as PerformanceModel,
        direction: leg.direction as "LONG" | "SHORT",
        effective_lot: round(effectiveLot, 4),
        adjusted_percent: adjustedPercent === null ? null : round(adjustedPercent, 6),
        pnl_usd: round(tradePnl, 2),
        priced: hasPrice,
      });
    }
  }

  return {
    eval: {
      week_open_utc: options.week_open_utc,
      week_label: weekLabel(options.week_open_utc),
      trades,
      priced_trades: priced,
      wins,
      margin_used_usd: round(margin),
      no_swap_pnl_usd: round(pnl),
      no_swap_return_pct: round((pnl / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
    },
    legs,
  };
}

function aggregateReturns(rows: Array<{ return_pct: number }>) {
  const arithmetic = rows.reduce((sum, row) => sum + row.return_pct, 0);
  const growth = rows.reduce((acc, row) => acc * (1 + row.return_pct / 100), 1);
  return {
    arithmetic_return_pct: round(arithmetic, 4),
    compounded_return_pct: round((growth - 1) * 100, 4),
  };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function loadSwapProfiles(accountId: string) {
  const closedRows = await query<ClosedSwapRow>(
    `SELECT symbol, type, lots, swap, open_time, close_time, comment
       FROM mt5_closed_positions
      WHERE account_id = $1
        AND comment ILIKE 'LimniClose%'`,
    [accountId],
  );
  const openRows = await query<OpenSwapRow>(
    `SELECT symbol, type, lots, swap, open_time, comment
       FROM mt5_positions
      WHERE account_id = $1
        AND comment ILIKE 'LimniBasket%'`,
    [accountId],
  );
  const nowMs = Date.now();

  const symbolSide = new Map<string, { swap: number; lotDays: number; days: number; trades: number }>();
  const symbolAny = new Map<string, { swap: number; lotDays: number; days: number; trades: number }>();
  const assetAny = new Map<AssetClass, { swap: number; lotDays: number; days: number; trades: number }>();

  const add = (
    map: Map<string, { swap: number; lotDays: number; days: number; trades: number }>,
    key: string,
    swap: number,
    lotDays: number,
    days: number,
  ) => {
    const prev = map.get(key) ?? { swap: 0, lotDays: 0, days: 0, trades: 0 };
    prev.swap += swap;
    prev.lotDays += lotDays;
    prev.days += days;
    prev.trades += 1;
    map.set(key, prev);
  };

  for (const row of closedRows) {
    const lots = Number(row.lots ?? 0);
    const swap = Number(row.swap ?? 0);
    const openMs = row.open_time instanceof Date ? row.open_time.getTime() : Date.parse(String(row.open_time));
    const closeMs = row.close_time instanceof Date ? row.close_time.getTime() : Date.parse(String(row.close_time));
    if (!Number.isFinite(lots) || lots <= 0 || !Number.isFinite(openMs) || !Number.isFinite(closeMs) || closeMs <= openMs) continue;
    const days = (closeMs - openMs) / (24 * 60 * 60 * 1000);
    if (!Number.isFinite(days) || days <= 0) continue;
    const lotDays = lots * days;
    if (!Number.isFinite(lotDays) || lotDays <= 0) continue;

    const sym = canonicalSymbol(row.symbol);
    if (!sym) continue;
    const side: "LONG" | "SHORT" = row.type === "BUY" ? "LONG" : "SHORT";
    const asset = inferAssetClass(sym);

    add(symbolSide, `${sym}|${side}`, swap, lotDays, days);
    add(symbolAny, sym, swap, lotDays, days);
    const assetPrev = assetAny.get(asset) ?? { swap: 0, lotDays: 0, days: 0, trades: 0 };
    assetPrev.swap += swap;
    assetPrev.lotDays += lotDays;
    assetPrev.days += days;
    assetPrev.trades += 1;
    assetAny.set(asset, assetPrev);
  }

  for (const row of openRows) {
    const lots = Number(row.lots ?? 0);
    const swap = Number(row.swap ?? 0);
    const openMs = row.open_time instanceof Date ? row.open_time.getTime() : Date.parse(String(row.open_time));
    if (!Number.isFinite(lots) || lots <= 0 || !Number.isFinite(openMs) || nowMs <= openMs) continue;
    const days = (nowMs - openMs) / (24 * 60 * 60 * 1000);
    if (!Number.isFinite(days) || days <= 0) continue;
    const lotDays = lots * days;
    if (!Number.isFinite(lotDays) || lotDays <= 0) continue;

    const sym = canonicalSymbol(row.symbol);
    if (!sym) continue;
    const side: "LONG" | "SHORT" = row.type === "BUY" ? "LONG" : "SHORT";
    const asset = inferAssetClass(sym);

    add(symbolSide, `${sym}|${side}`, swap, lotDays, days);
    add(symbolAny, sym, swap, lotDays, days);
    const assetPrev = assetAny.get(asset) ?? { swap: 0, lotDays: 0, days: 0, trades: 0 };
    assetPrev.swap += swap;
    assetPrev.lotDays += lotDays;
    assetPrev.days += days;
    assetPrev.trades += 1;
    assetAny.set(asset, assetPrev);
  }

  const makeProfile = (bucket: { swap: number; lotDays: number; days: number; trades: number } | undefined): SwapProfile | null => {
    if (!bucket || bucket.trades <= 0 || bucket.lotDays <= 0) return null;
    return {
      rate_per_lot_day: bucket.swap / bucket.lotDays,
      hold_days_avg: bucket.days / bucket.trades,
      trades: bucket.trades,
    };
  };

  const symbolSideProfile = new Map<string, SwapProfile>();
  for (const [k, v] of symbolSide.entries()) {
    const p = makeProfile(v);
    if (p) symbolSideProfile.set(k, p);
  }
  const symbolAnyProfile = new Map<string, SwapProfile>();
  for (const [k, v] of symbolAny.entries()) {
    const p = makeProfile(v);
    if (p) symbolAnyProfile.set(k, p);
  }
  const assetAnyProfile = new Map<AssetClass, SwapProfile>();
  for (const [k, v] of assetAny.entries()) {
    const p = makeProfile(v);
    if (p) assetAnyProfile.set(k, p);
  }

  const fallbackRates = Array.from(symbolAnyProfile.values()).map((p) => p.rate_per_lot_day);
  const fallbackHolds = Array.from(symbolAnyProfile.values()).map((p) => p.hold_days_avg);
  const globalFallback: SwapProfile = {
    rate_per_lot_day: fallbackRates.length ? median(fallbackRates) : -3,
    hold_days_avg: fallbackHolds.length ? median(fallbackHolds) : 5,
    trades: closedRows.length,
  };

  return {
    closed_rows: closedRows.length,
    open_rows: openRows.length,
    symbol_side: symbolSideProfile,
    symbol_any: symbolAnyProfile,
    asset_any: assetAnyProfile,
    global: globalFallback,
  };
}

function estimateSwapForLeg(
  leg: SimLeg,
  profiles: Awaited<ReturnType<typeof loadSwapProfiles>>,
): { swap_usd: number; source: string; rate_per_lot_day: number; hold_days: number } {
  const sym = canonicalSymbol(leg.canonical_symbol || leg.symbol);
  const sideKey = `${sym}|${leg.direction}`;
  const asset = leg.asset_class;

  let profile: SwapProfile | null = null;
  let source = "global";

  const side = profiles.symbol_side.get(sideKey);
  if (side && side.trades >= MIN_SWAP_SAMPLE_TRADES) {
    profile = side;
    source = "symbol+side";
  }
  if (!profile) {
    const any = profiles.symbol_any.get(sym);
    if (any && any.trades >= MIN_SWAP_SAMPLE_TRADES) {
      profile = any;
      source = "symbol";
    }
  }
  if (!profile) {
    const assetP = profiles.asset_any.get(asset);
    if (assetP && assetP.trades >= MIN_SWAP_SAMPLE_TRADES) {
      profile = assetP;
      source = "asset";
    }
  }
  if (!profile) {
    profile = profiles.global;
    source = "global";
  }

  const lot = Number(leg.effective_lot ?? 0);
  const rate = Number(profile.rate_per_lot_day ?? 0);
  const holdDays = Number(profile.hold_days_avg ?? 0);
  const swapUsd = lot > 0 && holdDays > 0 ? rate * lot * holdDays : 0;
  return {
    swap_usd: round(swapUsd, 4),
    source,
    rate_per_lot_day: round(rate, 6),
    hold_days: round(holdDays, 4),
  };
}

function loadWeeksFromSource(): string[] {
  const sourcePath = path.resolve(WEEKS_SOURCE_PATH);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Weeks source not found: ${WEEKS_SOURCE_PATH}`);
  }
  const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as { weeks?: string[] };
  const weeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];
  if (!weeks.length) {
    throw new Error(`No weeks found in ${WEEKS_SOURCE_PATH}`);
  }
  return [...weeks].sort((a, b) => Date.parse(a) - Date.parse(b));
}

async function loadAccount(accountId: string): Promise<Mt5AccountRow> {
  const row = await queryOne<Mt5AccountRow>(
    `SELECT account_id, label, broker, server, currency, equity, baseline_equity, lot_map
       FROM mt5_accounts
      WHERE account_id = $1`,
    [accountId],
  );
  if (!row) throw new Error(`Account not found: ${accountId}`);
  return row;
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

async function main() {
  if (!Number.isFinite(TARGET_ACCOUNT_SIZE_USD) || TARGET_ACCOUNT_SIZE_USD <= 0) {
    throw new Error(`Invalid ACCOUNT_SIZE_USD: ${String(TARGET_ACCOUNT_SIZE_USD)}`);
  }

  const weeks = loadWeeksFromSource();
  const account = await loadAccount(ACCOUNT_ID);
  const liveLotMap = parseLotMapRows(account.lot_map);
  if (!liveLotMap.length) throw new Error("No lot_map rows found for selected account.");

  const swapProfiles = await loadSwapProfiles(ACCOUNT_ID);

  const weekly: WeekEval[] = [];
  const allLegs: SimLeg[] = [];
  const allLegSwapRows: Array<SimLeg & { swap_usd: number; swap_source: string; rate_per_lot_day: number; hold_days: number }> = [];

  for (const weekOpenUtc of weeks) {
    const frozen = await loadClosestFrozenPlan(account.account_id, weekOpenUtc);
    const frozenLotMap = parseLotMapRows(frozen?.lot_map ?? null);
    const lotMapRows = frozenLotMap.length ? frozenLotMap : liveLotMap;

    const baselineEquity =
      toNum(frozen?.baseline_equity) ??
      toNum(account.baseline_equity) ??
      TARGET_ACCOUNT_SIZE_USD;
    const accountScale = baselineEquity > 0 ? TARGET_ACCOUNT_SIZE_USD / baselineEquity : 1;

    const [rows, marketReturns] = await Promise.all([
      loadWeekRows(weekOpenUtc),
      loadMarketReturns(weekOpenUtc),
    ]);
    const { allSignals, signalMap } = buildSystemSignals(rows);
    const evaluated = evaluateUniversalDetailed({
      week_open_utc: weekOpenUtc,
      models: PERFORMANCE_V1_MODELS,
      allSignals,
      signalMap,
      marketReturns,
      lotMapRows,
      accountScale,
    });

    const weekLegs = evaluated.legs;
    allLegs.push(...weekLegs);

    let weekSwap = 0;
    const symbolSwap = new Map<string, number>();
    for (const leg of weekLegs) {
      if (!leg.priced) continue;
      const est = estimateSwapForLeg(leg, swapProfiles);
      weekSwap += est.swap_usd;
      const sym = leg.canonical_symbol || leg.symbol;
      symbolSwap.set(sym, (symbolSwap.get(sym) ?? 0) + est.swap_usd);
      allLegSwapRows.push({
        ...leg,
        swap_usd: est.swap_usd,
        swap_source: est.source,
        rate_per_lot_day: est.rate_per_lot_day,
        hold_days: est.hold_days,
      });
    }

    const topSwap = Array.from(symbolSwap.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([symbol, swap]) => ({ symbol, swap_usd: round(swap, 2) }));

    const withSwapPnl = evaluated.eval.no_swap_pnl_usd + weekSwap;
    weekly.push({
      ...evaluated.eval,
      est_swap_usd: round(weekSwap, 2),
      with_swap_pnl_usd: round(withSwapPnl, 2),
      with_swap_return_pct: round((withSwapPnl / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
      top_swap_drag_symbols: topSwap,
    });
  }

  const noSwapTotals = {
    pnl_usd: round(weekly.reduce((s, w) => s + w.no_swap_pnl_usd, 0)),
    ...aggregateReturns(weekly.map((w) => ({ return_pct: w.no_swap_return_pct }))),
  };
  const swapTotals = {
    swap_usd: round(weekly.reduce((s, w) => s + w.est_swap_usd, 0)),
  };
  const withSwapTotals = {
    pnl_usd: round(weekly.reduce((s, w) => s + w.with_swap_pnl_usd, 0)),
    ...aggregateReturns(weekly.map((w) => ({ return_pct: w.with_swap_return_pct }))),
  };

  const swapSourceCounts = allLegSwapRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.swap_source] = (acc[row.swap_source] ?? 0) + 1;
    return acc;
  }, {});

  const swapBySymbol = new Map<string, number>();
  for (const row of allLegSwapRows) {
    const sym = row.canonical_symbol || row.symbol;
    swapBySymbol.set(sym, (swapBySymbol.get(sym) ?? 0) + row.swap_usd);
  }
  const topSwapSymbols = Array.from(swapBySymbol.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, 15)
    .map(([symbol, swap]) => ({ symbol, swap_usd: round(swap, 2) }));

  const swapRatesPreview = Array.from(swapProfiles.symbol_any.entries())
    .map(([symbol, p]) => ({
      symbol,
      rate_per_lot_day: round(p.rate_per_lot_day, 6),
      hold_days_avg: round(p.hold_days_avg, 4),
      trades: p.trades,
    }))
    .sort((a, b) => a.rate_per_lot_day - b.rate_per_lot_day)
    .slice(0, 25);

  const report = {
    generated_utc: DateTime.utc().toISO(),
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
    system: "v1_universal",
    weeks,
    totals: {
      no_swap: noSwapTotals,
      estimated_swap: swapTotals,
      with_swap: withSwapTotals,
      delta_due_to_swap_usd: round(withSwapTotals.pnl_usd - noSwapTotals.pnl_usd),
      delta_due_to_swap_pct_points: round(withSwapTotals.arithmetic_return_pct - noSwapTotals.arithmetic_return_pct, 4),
    },
    weekly,
    swap_calibration: {
      closed_rows_used: swapProfiles.closed_rows,
      open_rows_used: swapProfiles.open_rows,
      min_swap_sample_trades: MIN_SWAP_SAMPLE_TRADES,
      source_counts: swapSourceCounts,
      global_fallback: {
        rate_per_lot_day: round(swapProfiles.global.rate_per_lot_day, 6),
        hold_days_avg: round(swapProfiles.global.hold_days_avg, 4),
      },
      symbol_rate_preview: swapRatesPreview,
      top_swap_drag_symbols: topSwapSymbols,
    },
    assumptions: [
      "Exact same 5-week window as floor-clamped universal compare report.",
      "Exact same V1 universal leg generation and lot-map scaling logic used by existing compare script.",
      "No-swap scenario equals existing simulation style (spread/commission/swap excluded).",
      "With-swap scenario subtracts estimated swap per priced leg only.",
      "Swap estimates are calibrated from this account's own mt5_closed_positions (swap / lot-days).",
      "Rate lookup priority: symbol+side -> symbol -> asset class -> global fallback.",
      "Hold days are estimated from historical average hold-time in the same calibration bucket.",
      "This is a swap-impact estimate, not a broker tick-by-tick replay.",
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/fiveers-5week-universal-swap-vs-noswap-${stamp}.json`;
  const mdPath = `reports/fiveers-5week-universal-swap-vs-noswap-${stamp}.md`;
  const latestJsonPath = "reports/fiveers-5week-universal-swap-vs-noswap-latest.json";
  const latestMdPath = "reports/fiveers-5week-universal-swap-vs-noswap-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Fiveers V1 Universal - Swap vs No-Swap (5 Weeks)");
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Weeks: ${weeks.join(", ")}`);
  md.push(`Account: ${report.account.account_id} (${report.account.label})`);
  md.push("");
  md.push("## Totals");
  md.push("| Scenario | PnL | Arithmetic Return | Compounded Return |");
  md.push("| --- | ---: | ---: | ---: |");
  md.push(`| No swap | ${fmtUsd(report.totals.no_swap.pnl_usd)} | ${fmtPct(report.totals.no_swap.arithmetic_return_pct)} | ${fmtPct(report.totals.no_swap.compounded_return_pct)} |`);
  md.push(`| With estimated swap | ${fmtUsd(report.totals.with_swap.pnl_usd)} | ${fmtPct(report.totals.with_swap.arithmetic_return_pct)} | ${fmtPct(report.totals.with_swap.compounded_return_pct)} |`);
  md.push(`| Swap delta | ${fmtUsd(report.totals.delta_due_to_swap_usd)} | ${fmtPct(report.totals.delta_due_to_swap_pct_points)} | n/a |`);
  md.push("");
  md.push("## Weekly");
  md.push("| Week | Trades | Priced | No Swap PnL | Est Swap | With Swap PnL | No Swap Return | With Swap Return |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of report.weekly) {
    md.push(
      `| ${row.week_label} | ${row.trades} | ${row.priced_trades} | ${fmtUsd(row.no_swap_pnl_usd)} | ${fmtUsd(row.est_swap_usd)} | ${fmtUsd(row.with_swap_pnl_usd)} | ${fmtPct(row.no_swap_return_pct)} | ${fmtPct(row.with_swap_return_pct)} |`,
    );
  }
  md.push("");
  md.push("## Estimated Swap Drag By Symbol (Top)");
  md.push("| Symbol | Estimated Swap Drag |");
  md.push("| --- | ---: |");
  for (const row of report.swap_calibration.top_swap_drag_symbols.slice(0, 12)) {
    md.push(`| ${row.symbol} | ${fmtUsd(row.swap_usd)} |`);
  }
  md.push("");
  md.push("## Swap Calibration");
  md.push(`- Closed rows used: ${report.swap_calibration.closed_rows_used}`);
  md.push(`- Open rows used: ${report.swap_calibration.open_rows_used}`);
  md.push(`- Bucket sample floor: ${report.swap_calibration.min_swap_sample_trades}`);
  md.push(`- Source counts: ${Object.entries(report.swap_calibration.source_counts).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  md.push(
    `- Global fallback: rate_per_lot_day=${report.swap_calibration.global_fallback.rate_per_lot_day}, hold_days_avg=${report.swap_calibration.global_fallback.hold_days_avg}`,
  );
  md.push("");
  md.push("## Assumptions");
  for (const line of report.assumptions) {
    md.push(`- ${line}`);
  }
  md.push("");
  md.push(`JSON: \`${jsonPath}\``);

  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(latestMdPath, md.join("\n"), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${latestJsonPath}`);
  console.log(`Wrote ${latestMdPath}`);
}

main()
  .catch((error) => {
    console.error("fiveers-5week-universal-swap-vs-noswap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
