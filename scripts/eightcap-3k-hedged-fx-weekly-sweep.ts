// Set DATABASE_URL before imports for standalone script runs.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import fs from "node:fs";
import { DateTime } from "luxon";
import { getPool, query, queryOne } from "../src/lib/db";
import { fetchOandaCandleSeries, getOandaInstrument } from "../src/lib/oandaPrices";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { derivePairDirections, type BiasMode } from "../src/lib/cotCompute";
import type { MarketSnapshot, PairSnapshot } from "../src/lib/cotTypes";
import { findLotMapEntry, type LotMapRow } from "../src/lib/accounts/mt5ViewHelpers";

const TARGET_ACCOUNT_SIZE_USD = Number(process.env.ACCOUNT_SIZE_USD ?? "3000");
const LOOKBACK_WEEKS = Number(process.env.LOOKBACK_WEEKS ?? "52");
const ACCOUNT_ID_OVERRIDE = process.env.MT5_ACCOUNT_ID?.trim() || null;
const MT5_MIN_LOT = Number(process.env.MT5_MIN_LOT ?? "0.01");
const MT5_LOT_STEP = Number(process.env.MT5_LOT_STEP ?? "0.01");
const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY ?? "6");
const CHECKPOINT_DAYS = [2, 3] as const; // Tue/Wed 17:00 NY from Sunday 17:00 NY open.
const TRIGGER_THRESHOLDS_PCT = (process.env.TRIGGER_THRESHOLDS_PCT ?? "0,10,20")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);
const RETRACE_TARGETS_PCT_OF_WINNER = (process.env.RETRACE_TARGETS_PCT_OF_WINNER ?? "50")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);
const COT_BIAS_MODE = (process.env.COT_BIAS_MODE ?? "blended") as BiasMode;
const COT_VARIANT = process.env.COT_VARIANT ?? "FutOnly";

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

type PairSeriesPoint = {
  ts: number; // candle open time (ms, UTC)
  open: number;
  close: number;
};

type PairWeekData = {
  pair: string;
  value_per_pct_usd: number;
  margin_per_leg_usd: number;
  raw_by_hour: Array<number | null>; // index h means mark at weekOpen + h hours, h in [0..120]
};

type CotSnapshotRow = {
  report_date: Date | string;
  variant: string;
  currencies: Record<string, MarketSnapshot> | string | null;
  pairs: Record<string, PairSnapshot> | string | null;
};

type WeekState = {
  week_open_utc: string;
  week_label: string;
  initial_margin_usd: number;
  runner_margin_usd: number;
  pairs_total: number;
  pairs_priced: number;
  cot_report_date: string | null;
  cot_pairs_directional: number;
  cot_alignment_rate_pct: number;
  cot_direction_by_pair: Record<string, "LONG" | "SHORT" | "NEUTRAL">;
  pairs: PairWeekData[];
};

type ScenarioMode =
  | "side_hold"
  | "side_net_positive"
  | "side_retrace"
  | "cot_non_aligned_profit_close"
  | "cot_non_aligned_profit_close_staged"
  | "cot_non_aligned_profit_close_carry_aligned_losers"
  | "pair_hold"
  | "pair_net_positive";

type Scenario = {
  id: string;
  mode: ScenarioMode;
  checkpoint_day: 2 | 3;
  checkpoint_hour: number;
  trigger_threshold_pct: number;
  retrace_target_pct_of_winner: number | null;
};

type WeekScenarioResult = {
  week_open_utc: string;
  week_label: string;
  return_pct_on_3k: number;
  pnl_usd: number;
  triggered: boolean;
  early_exit: boolean;
  exit_hour: number | null;
  realized_at_checkpoint_usd: number;
  initial_margin_usd: number;
  runner_margin_usd: number;
  pairs_priced: number;
};

type ScenarioSummary = {
  id: string;
  mode: ScenarioMode;
  checkpoint_day: number;
  trigger_threshold_pct: number;
  retrace_target_pct_of_winner: number | null;
  stats: {
    weeks: number;
    arithmetic_total_pct: number;
    compounded_total_pct: number;
    avg_weekly_pct: number;
    best_week_pct: number;
    worst_week_pct: number;
    win_weeks: number;
    loss_weeks: number;
    trigger_rate_pct: number;
    early_exit_rate_pct: number;
    avg_realized_at_checkpoint_pct: number;
    avg_initial_margin_pct_of_3k: number;
    avg_runner_margin_pct_of_3k: number;
  };
  weekly: WeekScenarioResult[];
};

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

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy-LL-dd");
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

function parseJsonObject<T extends object>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as T;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function floorToLotStep(value: number, step = MT5_LOT_STEP, minLot = MT5_MIN_LOT) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const floored = Math.floor(value / step) * step;
  return Number(Math.max(minLot, floored).toFixed(2));
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

function effectiveLotScale(row: LotMapRow | null | undefined, accountScale: number, multiplier = 1) {
  const linearScale = accountScale * multiplier;
  const refLot = resolveReferenceLot(row);
  if (!refLot || !Number.isFinite(refLot) || refLot <= 0) return linearScale;
  const targetLot = refLot * linearScale;
  if (!Number.isFinite(targetLot) || targetLot <= 0) return 0;
  const clampedLot = floorToLotStep(targetLot);
  return clampedLot / refLot;
}

function fxSymbol(pair: string) {
  return `${pair.slice(0, 3)}/${pair.slice(3)}`;
}

function getSundaySessionOpenUtc(now: DateTime) {
  const nyNow = now.setZone("America/New_York");
  const daysSinceSunday = nyNow.weekday % 7;
  let sunday = nyNow.minus({ days: daysSinceSunday });
  const openToday = sunday.set({
    hour: 17,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  if (daysSinceSunday === 0 && nyNow.toMillis() < openToday.toMillis()) {
    sunday = sunday.minus({ days: 7 });
  }
  return sunday
    .set({
      hour: 17,
      minute: 0,
      second: 0,
      millisecond: 0,
    })
    .toUTC();
}

function buildCompletedWeekOpens(lookbackWeeks: number) {
  const now = DateTime.utc();
  const thisWeekOpen = getSundaySessionOpenUtc(now);
  const thisWeekClose = thisWeekOpen.plus({ days: 5 });
  const lastCompletedOpen =
    now.toMillis() >= thisWeekClose.toMillis() ? thisWeekOpen : thisWeekOpen.minus({ weeks: 1 });

  const weeks: string[] = [];
  for (let i = Math.max(0, lookbackWeeks - 1); i >= 0; i -= 1) {
    weeks.push(lastCompletedOpen.minus({ weeks: i }).toISO()!);
  }
  return weeks;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
) {
  const out: R[] = [];
  const chunkSize = Math.max(1, limit);
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const rows = await Promise.all(chunk.map((item) => task(item)));
    out.push(...rows);
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
  if (filtered.length === 0) {
    throw new Error("No Eightcap account with lot_map rows found.");
  }
  if (ACCOUNT_ID_OVERRIDE) {
    const selected = filtered.find((row) => row.account_id === ACCOUNT_ID_OVERRIDE);
    if (selected) return selected;
  }
  return filtered[0]!;
}

async function loadClosestFrozenPlan(
  accountId: string,
  weekOpenUtc: string,
): Promise<FrozenPlanRow | null> {
  return queryOne<FrozenPlanRow>(
    `SELECT week_open_utc, baseline_equity, lot_map
       FROM mt5_weekly_plans
      WHERE account_id = $1
      ORDER BY ABS(EXTRACT(EPOCH FROM (week_open_utc - $2::timestamptz))) ASC
      LIMIT 1`,
    [accountId, weekOpenUtc],
  );
}

async function loadCotFxHistory(): Promise<Array<{ report_date: string; direction_by_pair: Record<string, "LONG" | "SHORT" | "NEUTRAL"> }>> {
  const rows = await query<CotSnapshotRow>(
    `SELECT report_date, variant, currencies, pairs
       FROM cot_snapshots
      WHERE asset_class = 'fx'
        AND variant = $1
      ORDER BY report_date ASC`,
    [COT_VARIANT],
  );

  const out: Array<{ report_date: string; direction_by_pair: Record<string, "LONG" | "SHORT" | "NEUTRAL"> }> = [];
  for (const row of rows) {
    const reportDate =
      row.report_date instanceof Date
        ? row.report_date.toISOString().slice(0, 10)
        : String(row.report_date).slice(0, 10);
    if (!reportDate) continue;

    const directionByPair: Record<string, "LONG" | "SHORT" | "NEUTRAL"> = {};
    for (const pair of PAIRS_BY_ASSET_CLASS.fx.map((item) => item.pair)) {
      directionByPair[pair] = "NEUTRAL";
    }

    const currencies = parseJsonObject<Record<string, MarketSnapshot>>(row.currencies);
    if (currencies) {
      const derived = derivePairDirections(currencies, PAIRS_BY_ASSET_CLASS.fx, COT_BIAS_MODE);
      for (const [pair, snap] of Object.entries(derived)) {
        if (snap.direction === "LONG" || snap.direction === "SHORT") {
          directionByPair[pair] = snap.direction;
        }
      }
    } else {
      const pairs = parseJsonObject<Record<string, PairSnapshot>>(row.pairs);
      if (pairs) {
        for (const [pair, snap] of Object.entries(pairs)) {
          if (snap.direction === "LONG" || snap.direction === "SHORT") {
            directionByPair[pair] = snap.direction;
          }
        }
      }
    }

    out.push({
      report_date: reportDate,
      direction_by_pair: directionByPair,
    });
  }

  return out;
}

function resolveCotForWeek(
  history: Array<{ report_date: string; direction_by_pair: Record<string, "LONG" | "SHORT" | "NEUTRAL"> }>,
  weekOpenUtc: string,
) {
  const weekDate = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toISODate() ?? weekOpenUtc.slice(0, 10);
  let selected: { report_date: string; direction_by_pair: Record<string, "LONG" | "SHORT" | "NEUTRAL"> } | null = null;
  for (const row of history) {
    if (row.report_date <= weekDate) {
      selected = row;
      continue;
    }
    break;
  }

  if (!selected) {
    const empty: Record<string, "LONG" | "SHORT" | "NEUTRAL"> = {};
    for (const pair of PAIRS_BY_ASSET_CLASS.fx.map((item) => item.pair)) empty[pair] = "NEUTRAL";
    return {
      report_date: null as string | null,
      direction_by_pair: empty,
    };
  }
  return selected;
}

function binaryFirstAtOrAfter(points: PairSeriesPoint[], targetTs: number) {
  let left = 0;
  let right = points.length - 1;
  let best = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (points[mid]!.ts >= targetTs) {
      best = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return best;
}

function binaryLastBefore(points: PairSeriesPoint[], targetTs: number) {
  let left = 0;
  let right = points.length - 1;
  let best = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (points[mid]!.ts < targetTs) {
      best = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return best;
}

function buildRawByHour(points: PairSeriesPoint[], weekOpenTs: number) {
  const rawByHour: Array<number | null> = new Array(121).fill(null);
  rawByHour[0] = 0;

  const openIndex = binaryFirstAtOrAfter(points, weekOpenTs - 2 * 60 * 60 * 1000);
  if (openIndex < 0) {
    return rawByHour;
  }
  const openPoint = points[openIndex]!;
  if (openPoint.ts > weekOpenTs + 3 * 60 * 60 * 1000) {
    return rawByHour;
  }
  const openPrice = openPoint.open;
  if (!Number.isFinite(openPrice) || openPrice <= 0) {
    return rawByHour;
  }

  for (let hour = 1; hour <= 120; hour += 1) {
    const markTs = weekOpenTs + hour * 60 * 60 * 1000;
    const closeIndex = binaryLastBefore(points, markTs + 1);
    if (closeIndex < openIndex) {
      rawByHour[hour] = null;
      continue;
    }
    const closePrice = points[closeIndex]!.close;
    if (!Number.isFinite(closePrice) || closePrice <= 0) {
      rawByHour[hour] = null;
      continue;
    }
    rawByHour[hour] = ((closePrice - openPrice) / openPrice) * 100;
  }

  return rawByHour;
}

function buildScenarios() {
  const out: Scenario[] = [];
  for (const checkpointDay of CHECKPOINT_DAYS) {
    for (const thresholdPct of TRIGGER_THRESHOLDS_PCT) {
      for (const mode of [
        "side_hold",
        "side_net_positive",
        "pair_hold",
        "pair_net_positive",
        "cot_non_aligned_profit_close",
        "cot_non_aligned_profit_close_carry_aligned_losers",
      ] as const) {
        out.push({
          id: `${mode}-d${checkpointDay}-t${thresholdPct}`,
          mode,
          checkpoint_day: checkpointDay,
          checkpoint_hour: checkpointDay * 24,
          trigger_threshold_pct: thresholdPct,
          retrace_target_pct_of_winner: null,
        });
      }
      if (checkpointDay === 2) {
        out.push({
          id: `cot_non_aligned_profit_close_staged-d${checkpointDay}-t${thresholdPct}`,
          mode: "cot_non_aligned_profit_close_staged",
          checkpoint_day: checkpointDay,
          checkpoint_hour: checkpointDay * 24,
          trigger_threshold_pct: thresholdPct,
          retrace_target_pct_of_winner: null,
        });
      }
      for (const retracePct of RETRACE_TARGETS_PCT_OF_WINNER) {
        out.push({
          id: `side_retrace-d${checkpointDay}-t${thresholdPct}-r${retracePct}`,
          mode: "side_retrace",
          checkpoint_day: checkpointDay,
          checkpoint_hour: checkpointDay * 24,
          trigger_threshold_pct: thresholdPct,
          retrace_target_pct_of_winner: retracePct,
        });
      }
    }
  }
  return out;
}

function computeStats(values: number[]) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  const avg = values.length > 0 ? sum / values.length : 0;
  const worst = values.length > 0 ? Math.min(...values) : 0;
  const best = values.length > 0 ? Math.max(...values) : 0;
  const wins = values.filter((value) => value > 0).length;
  const losses = values.filter((value) => value < 0).length;
  let growth = 1;
  for (const value of values) growth *= 1 + value / 100;
  return {
    arithmetic_total_pct: round(sum, 4),
    compounded_total_pct: round((growth - 1) * 100, 4),
    avg_weekly_pct: round(avg, 4),
    best_week_pct: round(best, 4),
    worst_week_pct: round(worst, 4),
    win_weeks: wins,
    loss_weeks: losses,
  };
}

function simulateWeek(week: WeekState, scenario: Scenario): WeekScenarioResult {
  const cp = scenario.checkpoint_hour;
  const end = 120;
  const triggerThresholdUsd = (scenario.trigger_threshold_pct / 100) * TARGET_ACCOUNT_SIZE_USD;

  const usablePairs = week.pairs.filter((pair) => pair.raw_by_hour[cp] !== null && pair.raw_by_hour[end] !== null);
  if (usablePairs.length === 0) {
    return {
      week_open_utc: week.week_open_utc,
      week_label: week.week_label,
      return_pct_on_3k: 0,
      pnl_usd: 0,
      triggered: false,
      early_exit: false,
      exit_hour: null,
      realized_at_checkpoint_usd: 0,
      initial_margin_usd: week.initial_margin_usd,
      runner_margin_usd: week.runner_margin_usd,
      pairs_priced: 0,
    };
  }

  const rawAt = (pair: PairWeekData, hour: number) => pair.raw_by_hour[hour] ?? 0;
  let realized = 0;
  let runnerAtHour = (_hour: number) => 0;

  if (
    scenario.mode === "cot_non_aligned_profit_close" ||
    scenario.mode === "cot_non_aligned_profit_close_staged"
  ) {
    type CotLeg = {
      pair: PairWeekData;
      direction: "LONG" | "SHORT";
      aligned: boolean;
      open: boolean;
    };
    const legs: CotLeg[] = [];
    for (const pair of usablePairs) {
      const cotDirection = week.cot_direction_by_pair[pair.pair] ?? "NEUTRAL";

      legs.push({
        pair,
        direction: "LONG",
        aligned: cotDirection === "LONG",
        open: true,
      });
      legs.push({
        pair,
        direction: "SHORT",
        aligned: cotDirection === "SHORT",
        open: true,
      });
    }

    const legPnlAtHour = (leg: CotLeg, hour: number) => {
      const raw = rawAt(leg.pair, hour);
      return leg.direction === "LONG"
        ? raw * leg.pair.value_per_pct_usd
        : -raw * leg.pair.value_per_pct_usd;
    };

    const checkpointHours =
      scenario.mode === "cot_non_aligned_profit_close_staged"
        ? [48, 72, 96] // Tue/Wed/Thu checkpoints, always flatten Friday.
        : [cp];

    let triggered = false;
    let realizedCumulative = 0;
    for (const checkpointHour of checkpointHours) {
      const closeable = legs.filter(
        (leg) => leg.open && !leg.aligned && legPnlAtHour(leg, checkpointHour) > 0,
      );
      const closeableProfit = closeable.reduce(
        (acc, leg) => acc + legPnlAtHour(leg, checkpointHour),
        0,
      );
      if (closeableProfit >= triggerThresholdUsd && closeableProfit > 0) {
        triggered = true;
        realizedCumulative += closeableProfit;
        for (const leg of closeable) {
          leg.open = false;
        }
      }
    }

    if (!triggered) {
      return {
        week_open_utc: week.week_open_utc,
        week_label: week.week_label,
        return_pct_on_3k: 0,
        pnl_usd: 0,
        triggered: false,
        early_exit: false,
        exit_hour: null,
        realized_at_checkpoint_usd: 0,
        initial_margin_usd: week.initial_margin_usd,
        runner_margin_usd: week.runner_margin_usd,
        pairs_priced: usablePairs.length,
      };
    }

    realized = realizedCumulative;
    const kept = legs.filter((leg) => leg.open);
    const runnerEndPnl = kept.reduce((acc, leg) => acc + legPnlAtHour(leg, end), 0);
    const pnl = realized + runnerEndPnl;
    return {
      week_open_utc: week.week_open_utc,
      week_label: week.week_label,
      return_pct_on_3k: round((pnl / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
      pnl_usd: round(pnl, 2),
      triggered: true,
      early_exit: false,
      exit_hour: end,
      realized_at_checkpoint_usd: round(realized, 2),
      initial_margin_usd: week.initial_margin_usd,
      runner_margin_usd: week.runner_margin_usd,
      pairs_priced: usablePairs.length,
    };
  }

  if (
    scenario.mode === "side_hold" ||
    scenario.mode === "side_net_positive" ||
    scenario.mode === "side_retrace"
  ) {
    let longCp = 0;
    for (const pair of usablePairs) {
      longCp += rawAt(pair, cp) * pair.value_per_pct_usd;
    }
    const shortCp = -longCp;
    const winnerDirection = longCp >= shortCp ? "LONG" : "SHORT";
    const winnerPnl = Math.max(longCp, shortCp);
    const triggered = winnerPnl >= triggerThresholdUsd && winnerPnl > 0;
    if (!triggered) {
      return {
        week_open_utc: week.week_open_utc,
        week_label: week.week_label,
        return_pct_on_3k: 0,
        pnl_usd: 0,
        triggered: false,
        early_exit: false,
        exit_hour: null,
        realized_at_checkpoint_usd: 0,
        initial_margin_usd: week.initial_margin_usd,
        runner_margin_usd: week.runner_margin_usd,
        pairs_priced: usablePairs.length,
      };
    }
    realized = winnerPnl;
    const runnerSign = winnerDirection === "LONG" ? -1 : 1;
    runnerAtHour = (hour: number) => {
      let rawSum = 0;
      for (const pair of usablePairs) {
        rawSum += rawAt(pair, hour) * pair.value_per_pct_usd;
      }
      return runnerSign * rawSum;
    };
  } else {
    const loserSigns = new Map<string, number>(); // +1 long, -1 short
    let winnersCp = 0;
    for (const pair of usablePairs) {
      const rawCp = rawAt(pair, cp);
      const winnerSign = rawCp >= 0 ? 1 : -1;
      const loserSign = -winnerSign;
      loserSigns.set(pair.pair, loserSign);
      winnersCp += Math.abs(rawCp) * pair.value_per_pct_usd;
    }
    const triggered = winnersCp >= triggerThresholdUsd && winnersCp > 0;
    if (!triggered) {
      return {
        week_open_utc: week.week_open_utc,
        week_label: week.week_label,
        return_pct_on_3k: 0,
        pnl_usd: 0,
        triggered: false,
        early_exit: false,
        exit_hour: null,
        realized_at_checkpoint_usd: 0,
        initial_margin_usd: week.initial_margin_usd,
        runner_margin_usd: week.runner_margin_usd,
        pairs_priced: usablePairs.length,
      };
    }
    realized = winnersCp;
    runnerAtHour = (hour: number) => {
      let total = 0;
      for (const pair of usablePairs) {
        const sign = loserSigns.get(pair.pair) ?? 0;
        total += sign * rawAt(pair, hour) * pair.value_per_pct_usd;
      }
      return total;
    };
  }

  let exitHour = end;
  let earlyExit = false;
  if (scenario.mode === "side_net_positive" || scenario.mode === "pair_net_positive") {
    for (let hour = cp + 1; hour <= end; hour += 1) {
      const net = realized + runnerAtHour(hour);
      if (net > 0) {
        exitHour = hour;
        earlyExit = hour < end;
        break;
      }
    }
  } else if (scenario.mode === "side_retrace") {
    const retracePct = scenario.retrace_target_pct_of_winner ?? 0;
    const netTarget = realized * (retracePct / 100);
    for (let hour = cp + 1; hour <= end; hour += 1) {
      const net = realized + runnerAtHour(hour);
      if (net >= netTarget) {
        exitHour = hour;
        earlyExit = hour < end;
        break;
      }
    }
  }

  const runnerPnl = runnerAtHour(exitHour);
  const pnl = realized + runnerPnl;
  return {
    week_open_utc: week.week_open_utc,
    week_label: week.week_label,
    return_pct_on_3k: round((pnl / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
    pnl_usd: round(pnl, 2),
    triggered: true,
    early_exit: earlyExit,
    exit_hour: exitHour,
    realized_at_checkpoint_usd: round(realized, 2),
    initial_margin_usd: week.initial_margin_usd,
    runner_margin_usd: week.runner_margin_usd,
    pairs_priced: usablePairs.length,
  };
}

function simulateCarryAlignedLosers(weeks: WeekState[], scenario: Scenario): WeekScenarioResult[] {
  type CarryLeg = {
    pair: string;
    direction: "LONG" | "SHORT";
    cumulative_pnl_usd: number;
  };
  type WorkingLeg = {
    pair: PairWeekData;
    direction: "LONG" | "SHORT";
    aligned: boolean;
    source: "fresh" | "carry";
    closed: boolean;
    cumulative_pnl_usd: number;
  };

  const cp = scenario.checkpoint_hour;
  const end = 120;
  const triggerThresholdUsd = (scenario.trigger_threshold_pct / 100) * TARGET_ACCOUNT_SIZE_USD;
  let carried: CarryLeg[] = [];
  const weekly: WeekScenarioResult[] = [];

  for (const week of weeks) {
    const usablePairs = week.pairs.filter((pair) => pair.raw_by_hour[cp] !== null && pair.raw_by_hour[end] !== null);
    const pairByName = new Map(usablePairs.map((pair) => [pair.pair, pair]));

    // Keep only carried positions that still match this week's COT direction and have marks.
    carried = carried.filter((leg) => {
      const pair = pairByName.get(leg.pair);
      if (!pair) return false;
      const direction = week.cot_direction_by_pair[leg.pair] ?? "NEUTRAL";
      return direction === leg.direction;
    });

    const carriedStartMargin = carried.reduce((acc, leg) => {
      const pair = pairByName.get(leg.pair);
      return acc + (pair?.margin_per_leg_usd ?? 0);
    }, 0);

    const rawAt = (pair: PairWeekData, hour: number) => pair.raw_by_hour[hour] ?? 0;
    const legPnlAtHour = (leg: WorkingLeg, hour: number) => {
      const raw = rawAt(leg.pair, hour);
      return leg.direction === "LONG"
        ? raw * leg.pair.value_per_pct_usd
        : -raw * leg.pair.value_per_pct_usd;
    };

    const legs: WorkingLeg[] = [];
    for (const leg of carried) {
      const pair = pairByName.get(leg.pair);
      if (!pair) continue;
      legs.push({
        pair,
        direction: leg.direction,
        aligned: true,
        source: "carry",
        closed: false,
        cumulative_pnl_usd: leg.cumulative_pnl_usd,
      });
    }
    for (const pair of usablePairs) {
      const cotDirection = week.cot_direction_by_pair[pair.pair] ?? "NEUTRAL";
      legs.push({
        pair,
        direction: "LONG",
        aligned: cotDirection === "LONG",
        source: "fresh",
        closed: false,
        cumulative_pnl_usd: 0,
      });
      legs.push({
        pair,
        direction: "SHORT",
        aligned: cotDirection === "SHORT",
        source: "fresh",
        closed: false,
        cumulative_pnl_usd: 0,
      });
    }

    const closeable = legs.filter(
      (leg) => leg.source === "fresh" && !leg.aligned && !leg.closed && legPnlAtHour(leg, cp) > 0,
    );
    const closeableProfit = closeable.reduce((acc, leg) => acc + legPnlAtHour(leg, cp), 0);
    const triggered = closeableProfit >= triggerThresholdUsd && closeableProfit > 0;
    let realizedAtCheckpoint = 0;
    if (triggered) {
      realizedAtCheckpoint = closeableProfit;
      for (const leg of closeable) leg.closed = true;
    }

    let pnl = realizedAtCheckpoint;
    for (const leg of legs) {
      if (leg.closed) continue;
      const weekMove = legPnlAtHour(leg, end);
      leg.cumulative_pnl_usd += weekMove;
      pnl += weekMove;
    }

    // Friday: close aligned winners, carry aligned losers if still aligned; always close non-aligned.
    const nextCarried: CarryLeg[] = [];
    for (const leg of legs) {
      if (leg.closed) continue;
      if (!leg.aligned) continue;
      if (leg.cumulative_pnl_usd <= 0) {
        nextCarried.push({
          pair: leg.pair.pair,
          direction: leg.direction,
          cumulative_pnl_usd: leg.cumulative_pnl_usd,
        });
      }
    }

    const carriedEndMargin = nextCarried.reduce((acc, leg) => {
      const pair = pairByName.get(leg.pair);
      return acc + (pair?.margin_per_leg_usd ?? 0);
    }, 0);
    carried = nextCarried;

    weekly.push({
      week_open_utc: week.week_open_utc,
      week_label: week.week_label,
      return_pct_on_3k: round((pnl / TARGET_ACCOUNT_SIZE_USD) * 100, 4),
      pnl_usd: round(pnl, 2),
      triggered,
      early_exit: false,
      exit_hour: end,
      realized_at_checkpoint_usd: round(realizedAtCheckpoint, 2),
      initial_margin_usd: round(week.initial_margin_usd + carriedStartMargin, 2),
      runner_margin_usd: round(carriedEndMargin, 2),
      pairs_priced: usablePairs.length,
    });
  }

  return weekly;
}

function summarizeScenario(scenario: Scenario, weekly: WeekScenarioResult[]): ScenarioSummary {
  const returns = weekly.map((row) => row.return_pct_on_3k);
  const core = computeStats(returns);
  const triggeredWeeks = weekly.filter((row) => row.triggered).length;
  const earlyExitWeeks = weekly.filter((row) => row.early_exit).length;
  const realizedTriggered = weekly
    .filter((row) => row.triggered)
    .map((row) => (row.realized_at_checkpoint_usd / TARGET_ACCOUNT_SIZE_USD) * 100);
  const avgRealized =
    realizedTriggered.length > 0
      ? realizedTriggered.reduce((acc, value) => acc + value, 0) / realizedTriggered.length
      : 0;
  const avgInitialMargin = weekly.reduce((acc, row) => acc + row.initial_margin_usd, 0) / Math.max(1, weekly.length);
  const avgRunnerMargin = weekly.reduce((acc, row) => acc + row.runner_margin_usd, 0) / Math.max(1, weekly.length);

  return {
    id: scenario.id,
    mode: scenario.mode,
    checkpoint_day: scenario.checkpoint_day,
    trigger_threshold_pct: scenario.trigger_threshold_pct,
    retrace_target_pct_of_winner: scenario.retrace_target_pct_of_winner,
    stats: {
      weeks: weekly.length,
      ...core,
      trigger_rate_pct: round((triggeredWeeks / Math.max(1, weekly.length)) * 100, 2),
      early_exit_rate_pct: round((earlyExitWeeks / Math.max(1, weekly.length)) * 100, 2),
      avg_realized_at_checkpoint_pct: round(avgRealized, 4),
      avg_initial_margin_pct_of_3k: round((avgInitialMargin / TARGET_ACCOUNT_SIZE_USD) * 100, 2),
      avg_runner_margin_pct_of_3k: round((avgRunnerMargin / TARGET_ACCOUNT_SIZE_USD) * 100, 2),
    },
    weekly,
  };
}

async function main() {
  if (!Number.isFinite(TARGET_ACCOUNT_SIZE_USD) || TARGET_ACCOUNT_SIZE_USD <= 0) {
    throw new Error(`Invalid ACCOUNT_SIZE_USD: ${String(TARGET_ACCOUNT_SIZE_USD)}`);
  }
  if (!Number.isFinite(LOOKBACK_WEEKS) || LOOKBACK_WEEKS <= 0) {
    throw new Error(`Invalid LOOKBACK_WEEKS: ${String(LOOKBACK_WEEKS)}`);
  }
  if (TRIGGER_THRESHOLDS_PCT.length === 0) {
    throw new Error("No trigger thresholds configured.");
  }
  if (RETRACE_TARGETS_PCT_OF_WINNER.length === 0) {
    throw new Error("No retrace targets configured.");
  }

  const account = await loadEightcapAccount();
  const liveLotMap = parseLotMapRows(account.lot_map);
  if (liveLotMap.length === 0) {
    throw new Error("No lot_map rows available on selected Eightcap account.");
  }

  const weeks = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  const firstWeek = DateTime.fromISO(weeks[0]!, { zone: "utc" });
  const lastWeek = DateTime.fromISO(weeks[weeks.length - 1]!, { zone: "utc" });
  const fetchFrom = firstWeek.minus({ hours: 8 });
  const fetchTo = lastWeek.plus({ days: 5, hours: 2 });
  const cotHistory = await loadCotFxHistory();

  const fxPairs = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair);
  const pairSeriesRows = await runWithConcurrency(
    fxPairs,
    FETCH_CONCURRENCY,
    async (pair) => {
      const candles = await fetchOandaCandleSeries(
        getOandaInstrument(fxSymbol(pair)),
        fetchFrom,
        fetchTo,
      );
      return {
        pair,
        points: candles.map((row) => ({ ts: row.ts, open: row.open, close: row.close }) as PairSeriesPoint),
      };
    },
  );
  const pairSeries = new Map(pairSeriesRows.map((row) => [row.pair, row.points]));

  const weekStates: WeekState[] = [];
  for (const weekOpenUtc of weeks) {
    const cotSelection = resolveCotForWeek(cotHistory, weekOpenUtc);
    const frozen = await loadClosestFrozenPlan(account.account_id, weekOpenUtc);
    const frozenLotMap = parseLotMapRows(frozen?.lot_map ?? null);
    const useFrozen = frozenLotMap.length > 0;
    const lotMap = useFrozen ? frozenLotMap : liveLotMap;
    const baselineEquity =
      toNum(useFrozen ? frozen?.baseline_equity : account.baseline_equity) ??
      toNum(account.baseline_equity) ??
      TARGET_ACCOUNT_SIZE_USD;
    const accountScale = baselineEquity > 0 ? TARGET_ACCOUNT_SIZE_USD / baselineEquity : 1;
    const weekOpenTs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();

    const pairs: PairWeekData[] = [];
    let initialMargin = 0;
    let runnerMargin = 0;

    for (const pair of fxPairs) {
      const points = pairSeries.get(pair) ?? [];
      if (points.length === 0) continue;

      const rawByHour = buildRawByHour(points, weekOpenTs);
      if (rawByHour[120] === null) continue;

      const lotRow = findLotMapEntry(lotMap, pair);
      const move1pct = toNum(lotRow?.move_1pct_usd) ?? toNum(lotRow?.move_1pct_per_lot_usd);
      const marginPerLeg = toNum(lotRow?.margin_required);
      if (!move1pct || move1pct <= 0) continue;

      const legScale = effectiveLotScale(lotRow, accountScale, 1);
      const valuePerPct = move1pct * legScale;
      const marginLeg = marginPerLeg && marginPerLeg > 0 ? marginPerLeg * legScale : 0;

      initialMargin += marginLeg * 2;
      runnerMargin += marginLeg;
      pairs.push({
        pair,
        value_per_pct_usd: valuePerPct,
        margin_per_leg_usd: marginLeg,
        raw_by_hour: rawByHour,
      });
    }

    weekStates.push({
      week_open_utc: weekOpenUtc,
      week_label: weekLabel(weekOpenUtc),
      initial_margin_usd: round(initialMargin, 2),
      runner_margin_usd: round(runnerMargin, 2),
      pairs_total: fxPairs.length,
      pairs_priced: pairs.length,
      cot_report_date: cotSelection.report_date,
      cot_pairs_directional: Object.values(cotSelection.direction_by_pair).filter((dir) => dir !== "NEUTRAL").length,
      cot_alignment_rate_pct: round(
        (pairs.filter((pair) => {
          const dir = cotSelection.direction_by_pair[pair.pair] ?? "NEUTRAL";
          return dir === "LONG" || dir === "SHORT";
        }).length / Math.max(1, pairs.length)) * 100,
        2,
      ),
      cot_direction_by_pair: cotSelection.direction_by_pair,
      pairs,
    });
  }

  const scenarios = buildScenarios();
  const summaries = scenarios.map((scenario) => {
    const weekly =
      scenario.mode === "cot_non_aligned_profit_close_carry_aligned_losers"
        ? simulateCarryAlignedLosers(weekStates, scenario)
        : weekStates.map((week) => simulateWeek(week, scenario));
    return summarizeScenario(scenario, weekly);
  });

  summaries.sort((a, b) => b.stats.compounded_total_pct - a.stats.compounded_total_pct);

  const report = {
    generated_utc: DateTime.utc().toISO(),
    account_size_usd: TARGET_ACCOUNT_SIZE_USD,
    lookback_weeks: LOOKBACK_WEEKS,
    trigger_thresholds_pct: TRIGGER_THRESHOLDS_PCT,
    retrace_targets_pct_of_winner: RETRACE_TARGETS_PCT_OF_WINNER,
    checkpoints_days: [...CHECKPOINT_DAYS],
    account: {
      account_id: account.account_id,
      label: account.label,
      broker: account.broker,
      server: account.server,
      baseline_equity_now: round(Number(account.baseline_equity), 2),
      equity_now: round(Number(account.equity), 2),
    },
    weeks: weekStates.map((week) => ({
      week_open_utc: week.week_open_utc,
      week_label: week.week_label,
      pairs_priced: week.pairs_priced,
      pairs_total: week.pairs_total,
      cot_report_date: week.cot_report_date,
      cot_pairs_directional: week.cot_pairs_directional,
      cot_alignment_rate_pct: week.cot_alignment_rate_pct,
      initial_margin_usd: week.initial_margin_usd,
      runner_margin_usd: week.runner_margin_usd,
    })),
    scenarios_ranked: summaries,
    assumptions: [
      "FX-only, 28 pairs, weekly open Sunday 17:00 New York.",
      "Initial entries are fully hedged per pair: 28 longs + 28 shorts.",
      "Sizing uses Eightcap lot_map with account scale to 3k and MT5 lot floor clamp (0.01 step 0.01).",
      "Costs (spread/commission/swap/slippage) ignored for this first pass.",
      "Checkpoint modes: day 2 (Tuesday) and day 3 (Wednesday), both at 17:00 New York equivalent.",
      "Mode side_* closes basket winner (long side or short side) at checkpoint; pair_* closes each pair winner leg at checkpoint.",
      "Mode *_hold keeps losing runner basket to Friday close.",
      "Mode *_net_positive exits runner early at first hourly mark where realized + runner > 0; else Friday close.",
      "Mode side_retrace exits runner when net recovers to >= (retrace_target_pct_of_winner * winner checkpoint profit).",
      "Mode cot_non_aligned_profit_close closes profitable legs that are not COT-aligned at checkpoint, then holds remaining legs to Friday close.",
      "Mode cot_non_aligned_profit_close_staged repeats that COT non-aligned profitable-leg closure at Tue/Wed/Thu checkpoints, then closes all remaining legs Friday.",
      "Mode cot_non_aligned_profit_close_carry_aligned_losers closes profitable fresh non-aligned legs at checkpoint (threshold-gated), closes aligned winners on Friday, and carries aligned losers while alignment persists.",
      "Trigger threshold is checkpoint realized winner profit as % of 3k.",
      "Historical marks are from OANDA H1 candles with hourly close approximation.",
      `COT alignment uses fx cot_snapshots variant ${COT_VARIANT} and bias mode ${COT_BIAS_MODE}; week uses latest report_date <= week open.`,
    ],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/eightcap-3k-hedged-fx-weekly-sweep-${stamp}.json`;
  const latestJsonPath = "reports/eightcap-3k-hedged-fx-weekly-sweep-latest.json";
  const mdPath = `reports/eightcap-3k-hedged-fx-weekly-sweep-${stamp}.md`;
  const latestMdPath = "reports/eightcap-3k-hedged-fx-weekly-sweep-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Eightcap 3k Hedged FX Weekly Sweep");
  md.push("");
  md.push(`Generated: ${report.generated_utc}`);
  md.push(`Weeks: ${weekStates[0]?.week_open_utc ?? "n/a"} -> ${weekStates[weekStates.length - 1]?.week_open_utc ?? "n/a"} (${weekStates.length} weeks)`);
  md.push(`Account: ${report.account.account_id} (${report.account.label})`);
  md.push("");
  md.push("## Top 12 Scenarios");
  md.push("| Rank | Scenario | Mode | CP Day | Trigger | Retrace | Return (arith) | Return (comp) | Avg/Wk | Worst Wk | Win Wks | Trigger Rate | Early Exit |");
  md.push("| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [idx, scenario] of report.scenarios_ranked.slice(0, 12).entries()) {
    const retraceCol =
      scenario.retrace_target_pct_of_winner === null
        ? "-"
        : `${scenario.retrace_target_pct_of_winner.toFixed(2)}%`;
    md.push(
      `| ${idx + 1} | ${scenario.id} | ${scenario.mode} | ${scenario.checkpoint_day} | ${scenario.trigger_threshold_pct.toFixed(2)}% | ${retraceCol} | ${scenario.stats.arithmetic_total_pct.toFixed(2)}% | ${scenario.stats.compounded_total_pct.toFixed(2)}% | ${scenario.stats.avg_weekly_pct.toFixed(2)}% | ${scenario.stats.worst_week_pct.toFixed(2)}% | ${scenario.stats.win_weeks}/${scenario.stats.weeks} | ${scenario.stats.trigger_rate_pct.toFixed(2)}% | ${scenario.stats.early_exit_rate_pct.toFixed(2)}% |`,
    );
  }
  md.push("");
  md.push("## Weekly Coverage");
  md.push("| Week | Pairs Priced | COT Report | COT Directional Pairs | Start Margin | Runner Margin |");
  md.push("| --- | ---: | --- | ---: | ---: | ---: |");
  for (const week of report.weeks) {
    md.push(
      `| ${week.week_label} | ${week.pairs_priced}/${week.pairs_total} | ${week.cot_report_date ?? "n/a"} | ${week.cot_pairs_directional} (${week.cot_alignment_rate_pct.toFixed(2)}%) | ${week.initial_margin_usd.toFixed(2)} | ${week.runner_margin_usd.toFixed(2)} |`,
    );
  }
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
