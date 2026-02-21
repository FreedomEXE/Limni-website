// Set DATABASE_URL before any imports.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import fs from "node:fs";
import { DateTime } from "luxon";
import { getPool, query, queryOne } from "../src/lib/db";
import type { AssetClass } from "../src/lib/cotMarkets";
import {
  type PerformanceModel,
} from "../src/lib/performanceLab";
import {
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
} from "../src/lib/performance/modelConfig";
import type { BasketSignal } from "../src/lib/basketSignals";
import { groupSignals, type PlannedPair } from "../src/lib/plannedTrades";
import { findLotMapEntry, type LotMapRow } from "../src/lib/accounts/mt5ViewHelpers";

const TARGET_WEEK_OPEN_UTC =
  process.env.WEEK_OPEN_UTC?.trim() || "2026-02-16T00:00:00.000Z";
const TARGET_ACCOUNT_SIZE_USD = Number(process.env.ACCOUNT_SIZE_USD ?? "100000");
const ACCOUNT_ID_OVERRIDE = process.env.MT5_ACCOUNT_ID?.trim() || null;

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
  lot_map_updated_utc: Date | null;
  last_sync_utc: Date | null;
};

type FrozenPlanRow = {
  account_id: string;
  week_open_utc: Date;
  baseline_equity: string;
  captured_sync_utc: Date;
  lot_map: LotMapRow[] | string;
};

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

type SystemName = "V1" | "V2" | "V3";

type SystemEvaluation = {
  system: SystemName;
  models: PerformanceModel[];
  pairs: number;
  legs: number;
  priced_legs: number;
  winning_legs: number;
  unpriced_legs: number;
  unsized_legs: number;
  margin_used_usd: number;
  margin_best_case_usd: number;
  pnl_usd: number;
  return_pct_on_100k: number;
};

function parseLotMapRows(value: unknown): LotMapRow[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as LotMapRow[];
  }
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

function weekOpenUtcForTimestampLegacy(timestampIso: string): string | null {
  const parsed = DateTime.fromISO(timestampIso, { zone: "utc" });
  if (!parsed.isValid) {
    return null;
  }
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
    `SELECT account_id, label, broker, server, currency, equity, balance, baseline_equity, free_margin, margin,
            lot_map, lot_map_updated_utc, last_sync_utc
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
    if (selected) {
      return selected;
    }
  }
  return filtered[0]!;
}

async function loadClosestFrozenPlan(accountId: string, targetWeekOpenUtc: string): Promise<FrozenPlanRow | null> {
  return queryOne<FrozenPlanRow>(
    `SELECT account_id, week_open_utc, baseline_equity, captured_sync_utc, lot_map
       FROM mt5_weekly_plans
      WHERE account_id = $1
      ORDER BY ABS(EXTRACT(EPOCH FROM (week_open_utc - $2::timestamptz))) ASC
      LIMIT 1`,
    [accountId, targetWeekOpenUtc],
  );
}

function buildSystemSignals(rows: SnapshotModelRow[]): { signals: BasketSignal[]; signalMap: Map<string, ComputedSignal> } {
  const signals: BasketSignal[] = [];
  const signalMap = new Map<string, ComputedSignal>();

  for (const row of rows) {
    for (const detail of row.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") {
        continue;
      }
      const signal: BasketSignal = {
        symbol: detail.pair,
        direction: detail.direction,
        model: row.model,
        asset_class: row.asset_class,
      };
      signals.push(signal);
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

  return { signals, signalMap };
}

function keyForRow(assetClass: AssetClass, model: PerformanceModel) {
  return `${assetClass}|${model}`;
}

function deriveAntikytheraV2Rows(rows: SnapshotModelRow[]): SnapshotModelRow[] {
  const byKey = new Map<string, SnapshotModelRow>();
  for (const row of rows) {
    byKey.set(keyForRow(row.asset_class, row.model), row);
  }

  const out = [...rows];
  for (const assetClass of ["fx", "indices", "crypto", "commodities"] as const) {
    const v2Key = keyForRow(assetClass, "antikythera_v2");
    if (byKey.has(v2Key)) {
      continue;
    }

    const dealer = byKey.get(keyForRow(assetClass, "dealer"));
    const sentiment = byKey.get(keyForRow(assetClass, "sentiment"));
    if (!dealer || !sentiment) {
      continue;
    }

    const dealerByPair = new Map(
      (dealer.pair_details ?? []).map((detail) => [`${detail.pair}|${detail.direction}`, detail]),
    );
    const derived: SnapshotPairDetail[] = [];
    for (const detail of sentiment.pair_details ?? []) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") {
        continue;
      }
      const matched = dealerByPair.get(`${detail.pair}|${detail.direction}`);
      if (!matched) {
        continue;
      }
      derived.push({
        pair: detail.pair,
        direction: detail.direction,
        reason: ["Dealer COT bias aligned", "Sentiment bias aligned (derived from snapshot rows)"],
        percent:
          typeof matched.percent === "number"
            ? matched.percent
            : typeof detail.percent === "number"
              ? detail.percent
              : null,
      });
    }

    out.push({
      asset_class: assetClass,
      model: "antikythera_v2",
      pair_details: derived,
    });
  }

  return out;
}

function evaluateSystem(options: {
  system: SystemName;
  models: PerformanceModel[];
  allSignals: BasketSignal[];
  signalMap: Map<string, ComputedSignal>;
  lotMapRows: LotMapRow[];
  accountScale: number;
  dropNetted: boolean;
}): SystemEvaluation {
  const { system, models, allSignals, signalMap, lotMapRows, accountScale, dropNetted } = options;
  const modelSet = new Set(models);
  const filteredSignals = allSignals.filter((row) => modelSet.has(row.model));
  const plannedPairs = groupSignals(filteredSignals, models, { dropNetted });

  let legs = 0;
  let pricedLegs = 0;
  let winningLegs = 0;
  let unpricedLegs = 0;
  let unsizedLegs = 0;
  let marginUsed = 0;
  let marginBestCase = 0;
  let pnlUsd = 0;

  for (const pair of plannedPairs) {
    const lotRow = findLotMapEntry(lotMapRows, pair.symbol);
    const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum(lotRow?.move_1pct_per_lot_usd);
    const marginPerLeg = toNum(lotRow?.margin_required);

    if (marginPerLeg && marginPerLeg > 0) {
      marginUsed += (marginPerLeg * accountScale) * pair.legs.length;
      marginBestCase += (marginPerLeg * accountScale) * Math.abs(pair.net);
    }

    for (const leg of pair.legs) {
      legs += 1;
      const key = `${pair.assetClass}|${leg.model}|${pair.symbol}|${leg.direction}`;
      const computed = signalMap.get(key);
      if (!computed || computed.percent === null || !Number.isFinite(computed.percent)) {
        unpricedLegs += 1;
        continue;
      }
      if (!move1pct || !Number.isFinite(move1pct) || move1pct <= 0) {
        unsizedLegs += 1;
        continue;
      }
      const legPnl = computed.percent * (move1pct * accountScale);
      pnlUsd += legPnl;
      pricedLegs += 1;
      if (legPnl > 0) {
        winningLegs += 1;
      }
    }
  }

  return {
    system,
    models,
    pairs: plannedPairs.length,
    legs,
    priced_legs: pricedLegs,
    winning_legs: winningLegs,
    unpriced_legs: unpricedLegs,
    unsized_legs: unsizedLegs,
    margin_used_usd: round(marginUsed),
    margin_best_case_usd: round(marginBestCase),
    pnl_usd: round(pnlUsd),
    return_pct_on_100k: round((pnlUsd / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
  };
}

function withScale(base: SystemEvaluation, scale: number): SystemEvaluation {
  if (!Number.isFinite(scale) || scale <= 0) {
    return {
      ...base,
      margin_used_usd: 0,
      margin_best_case_usd: 0,
      pnl_usd: 0,
      return_pct_on_100k: 0,
    };
  }
  return {
    ...base,
    margin_used_usd: round(base.margin_used_usd * scale),
    margin_best_case_usd: round(base.margin_best_case_usd * scale),
    pnl_usd: round(base.pnl_usd * scale),
    return_pct_on_100k: round(base.return_pct_on_100k * scale, 4),
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
    net_usd: round(Number(row?.net_usd ?? 0), 2),
    trades: Number(row?.trades ?? 0),
  };
}

async function loadWeekModelRows(weekOpenUtc: string): Promise<SnapshotModelRow[]> {
  const models: PerformanceModel[] = Array.from(
    new Set([
      ...PERFORMANCE_V1_MODELS,
      ...PERFORMANCE_V2_MODELS,
      ...PERFORMANCE_V3_MODELS,
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

function toListLines(result: SystemEvaluation) {
  return [
    `- Margin used: ${fmtUsd(result.margin_used_usd)}`,
    `- Margin best-case (netted): ${fmtUsd(result.margin_best_case_usd)}`,
    `- Trades (legs): ${result.legs} (priced ${result.priced_legs}, wins ${result.winning_legs})`,
    `- PnL on 100k: ${fmtUsd(result.pnl_usd)} (${fmtPct(result.return_pct_on_100k)})`,
  ];
}

async function main() {
  if (!Number.isFinite(TARGET_ACCOUNT_SIZE_USD) || TARGET_ACCOUNT_SIZE_USD <= 0) {
    throw new Error(`Invalid ACCOUNT_SIZE_USD: ${String(TARGET_ACCOUNT_SIZE_USD)}`);
  }

  const account = await loadEightcapAccount();
  const targetWeek = DateTime.fromISO(TARGET_WEEK_OPEN_UTC, { zone: "utc" });
  if (!targetWeek.isValid) {
    throw new Error(`Invalid WEEK_OPEN_UTC: ${TARGET_WEEK_OPEN_UTC}`);
  }

  const frozenPlan = await loadClosestFrozenPlan(account.account_id, TARGET_WEEK_OPEN_UTC);
  const frozenLotMap = parseLotMapRows(frozenPlan?.lot_map ?? null);
  const liveLotMap = parseLotMapRows(account.lot_map);
  const useFrozen = frozenLotMap.length > 0;
  const sizingLotMapRows = useFrozen ? frozenLotMap : liveLotMap;
  if (sizingLotMapRows.length === 0) {
    throw new Error("No lot_map rows available (live or frozen).");
  }

  const sizingBaselineEquity =
    toNum(useFrozen ? frozenPlan?.baseline_equity : account.baseline_equity) ??
    toNum(account.baseline_equity) ??
    TARGET_ACCOUNT_SIZE_USD;
  const accountScale =
    sizingBaselineEquity > 0 ? TARGET_ACCOUNT_SIZE_USD / sizingBaselineEquity : 1;

  const mt5WeekOpenUtc =
    (frozenPlan?.week_open_utc && DateTime.fromJSDate(frozenPlan.week_open_utc, { zone: "utc" }).toISO()) ||
    weekOpenUtcForTimestampLegacy(targetWeek.toUTC().toISO()!) ||
    TARGET_WEEK_OPEN_UTC;
  const liveV1Closed = await computeClosedWeekV1Realized(account.account_id, mt5WeekOpenUtc);

  const weekRows = await loadWeekModelRows(TARGET_WEEK_OPEN_UTC);
  const { signals, signalMap } = buildSystemSignals(weekRows);
  const dropNetted = false;

  const baseV1 = evaluateSystem({
    system: "V1",
    models: PERFORMANCE_V1_MODELS,
    allSignals: signals,
    signalMap,
    lotMapRows: sizingLotMapRows,
    accountScale,
    dropNetted,
  });
  const baseV2 = evaluateSystem({
    system: "V2",
    models: PERFORMANCE_V2_MODELS,
    allSignals: signals,
    signalMap,
    lotMapRows: sizingLotMapRows,
    accountScale,
    dropNetted,
  });
  const baseV3 = evaluateSystem({
    system: "V3",
    models: PERFORMANCE_V3_MODELS,
    allSignals: signals,
    signalMap,
    lotMapRows: sizingLotMapRows,
    accountScale,
    dropNetted,
  });

  const v1MarginBudget = baseV1.margin_used_usd;
  const normV1 = withScale(baseV1, 1);
  const normV2 = withScale(baseV2, baseV2.margin_used_usd > 0 ? v1MarginBudget / baseV2.margin_used_usd : 0);
  const normV3 = withScale(baseV3, baseV3.margin_used_usd > 0 ? v1MarginBudget / baseV3.margin_used_usd : 0);

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
      equity_now: round(Number(account.equity), 2),
      baseline_equity_now: round(Number(account.baseline_equity), 2),
      free_margin_now: round(Number(account.free_margin), 2),
      margin_now: round(Number(account.margin), 2),
    },
    sizing_source: {
      mode: useFrozen ? "frozen_week_plan" : "live_lot_map",
      lot_map_rows: sizingLotMapRows.length,
      baseline_equity_used: round(sizingBaselineEquity, 2),
      account_scale: round(accountScale, 6),
      frozen_week_open_utc: frozenPlan?.week_open_utc
        ? DateTime.fromJSDate(frozenPlan.week_open_utc, { zone: "utc" }).toISO()
        : null,
      frozen_captured_sync_utc: frozenPlan?.captured_sync_utc
        ? DateTime.fromJSDate(frozenPlan.captured_sync_utc, { zone: "utc" }).toISO()
        : null,
    },
    live_v1_realized_reference: {
      mt5_week_open_utc: mt5WeekOpenUtc,
      net_usd: liveV1Closed.net_usd,
      return_pct_on_100k: round((liveV1Closed.net_usd / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
      trades: liveV1Closed.trades,
    },
    systems: {
      base_lot_map: {
        v1: baseV1,
        v2: baseV2,
        v3: baseV3,
      },
      normalized_to_v1_margin_budget: {
        v1_margin_budget_usd: round(v1MarginBudget, 2),
        v1: normV1,
        v2: normV2,
        v3: normV3,
      },
    },
    assumptions: [
      "Signals/returns are computed from the same weekly performance engine used by the app.",
      "Sizing uses Eightcap lot_map rows (frozen weekly plan when available, else live lot_map).",
      "USD PnL conversion uses lot_map.move_1pct_usd per leg; margin uses lot_map.margin_required per leg.",
      "Normalized scenario scales each system uniformly so margin used matches V1 base margin budget.",
      "This is a model-based week simulation, not a broker fill-by-fill replay for V2/V3.",
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/eightcap-100k-system-compare-week-${stamp}.json`;
  const mdPath = `reports/eightcap-100k-system-compare-week-${stamp}.md`;
  const latestJsonPath = "reports/eightcap-100k-system-compare-week-latest.json";
  const latestMdPath = "reports/eightcap-100k-system-compare-week-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Eightcap 100k One-Week System Comparison");
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Target week: ${report.target_week_open_utc}`);
  md.push(`Account size: $${report.account_size_usd.toFixed(2)}`);
  md.push("");
  md.push("## Setup");
  md.push("");
  md.push(`- Account: ${report.account.account_id} (${report.account.label})`);
  md.push(`- Broker: ${report.account.broker} / ${report.account.server}`);
  md.push(`- Sizing source: ${report.sizing_source.mode}`);
  md.push(`- Lot map rows: ${report.sizing_source.lot_map_rows}`);
  md.push(`- Baseline equity used: $${report.sizing_source.baseline_equity_used.toFixed(2)}`);
  md.push(`- Account scale applied: ${report.sizing_source.account_scale.toFixed(6)}x`);
  if (report.sizing_source.frozen_week_open_utc) {
    md.push(`- Frozen plan week key: ${report.sizing_source.frozen_week_open_utc}`);
  }
  md.push("");
  md.push("## Live Reference (V1 broker closed PnL)");
  md.push("");
  md.push(`- MT5 week key: ${report.live_v1_realized_reference.mt5_week_open_utc}`);
  md.push(`- Closed PnL: ${fmtUsd(report.live_v1_realized_reference.net_usd)} (${fmtPct(report.live_v1_realized_reference.return_pct_on_100k)})`);
  md.push(`- Closed trades: ${report.live_v1_realized_reference.trades}`);
  md.push("");
  md.push("## Base Lot Map (No Reallocation)");
  md.push("");
  md.push("### V1");
  toListLines(baseV1).forEach((line) => md.push(line));
  md.push("");
  md.push("### V2");
  toListLines(baseV2).forEach((line) => md.push(line));
  md.push("");
  md.push("### V3");
  toListLines(baseV3).forEach((line) => md.push(line));
  md.push("");
  md.push("## Normalized To V1 Margin Budget");
  md.push("");
  md.push(`- V1 margin budget target: ${fmtUsd(v1MarginBudget)}`);
  md.push("");
  md.push("### V1 (1.00x)");
  toListLines(normV1).forEach((line) => md.push(line));
  md.push("");
  md.push(`### V2 (${baseV2.margin_used_usd > 0 ? (v1MarginBudget / baseV2.margin_used_usd).toFixed(4) : "0.0000"}x)`);
  toListLines(normV2).forEach((line) => md.push(line));
  md.push("");
  md.push(`### V3 (${baseV3.margin_used_usd > 0 ? (v1MarginBudget / baseV3.margin_used_usd).toFixed(4) : "0.0000"}x)`);
  toListLines(normV3).forEach((line) => md.push(line));
  md.push("");
  md.push("## Assumptions");
  md.push("");
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
