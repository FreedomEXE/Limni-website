import { mkdir } from "node:fs/promises";
import path from "node:path";

import { getPool, query } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";

import {
  fileHash,
  gitCommit,
  parseArgMap,
  readJson,
  readJsonl,
  renderTable,
  round,
  toRepoRelative,
  writeJson,
  writeJsonl,
  writeShaManifest,
  writeText,
} from "./gate65-utils";
import {
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  GATE71_EXPECTED_ROWS,
  GATE71_EXPECTED_SYMBOLS_PER_WEEK,
  GATE71_EXPECTED_WEEKS,
  type CandidateBDecisionRow,
  groupCandidateBRowsByWeek,
  loadCandidateBRows,
  validateCandidateBRows,
} from "./gate71-utils";

const GATE73_DATE = "2026-06-29";
const GATE_ID = "Gate 73C: candidate-b-direction-continuation-lifecycle-diagnostic";
const COMMAND = "npm run engine:gate73c:direction-continuation-lifecycle";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate73c/GATE73C_DIRECTION_CONTINUATION_LIFECYCLE_${GATE73_DATE}.md`;
const DEFAULT_GATE71BM_SUMMARY_PATH = "docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse/gate71bm-summary.json";
const DEFAULT_GATE73A_CLASSIFICATION_PATH = "docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/weekly-path-classification.rows.jsonl";
const DEFAULT_PAIR_WEEK_OUTCOME_WAREHOUSE_ID = "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B";

const STANDARD_COST_PER_TRANSACTION_ADR = 0.01;
const HARSH_COST_PER_TRANSACTION_ADR = 0.03;

type Gate71bmSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    candidate_b_ledger_hash: string;
    entry_exposure_model_id: string;
    price_bundle_id: string;
    path_resolution: string;
    adr_target_pct: number;
  };
};

type Gate73aClassifiedWeek = {
  week_open_utc: string;
  year: number;
  weekly_hold_adr: number;
};

type PairOutcomeDbRow = {
  week_open_utc: Date | string;
  symbol: string;
  direction: CandidateBDecisionRow["final_side"];
  weekly_hold_adr: number | string;
  weekly_hold_missing_price_rows: number | string;
  weekly_hold_default_adr_rows: number | string;
  row_hash: string;
};

type PairWeekRow = {
  week_open_utc: string;
  year: number;
  pair: string;
  candidate_b_direction: CandidateBDecisionRow["final_direction"];
  candidate_b_side: CandidateBDecisionRow["final_side"];
  weekly_hold_adr: number;
  missing_price: boolean;
  default_adr: boolean;
  row_hash: string | null;
};

type DirectionStreakRow = {
  schema_version: 1;
  gate_id: typeof GATE_ID;
  pair: string;
  direction: CandidateBDecisionRow["final_side"];
  streak_start_week: string;
  streak_end_week: string;
  terminal_streak: boolean;
  streak_length_weeks: number;
  weekly_close_sum_adr: number;
  carry_until_flip_gross_adr: number;
  delta_vs_weekly_close_gross_adr: number;
  weekly_forced_close_transactions: number;
  carry_until_flip_transactions: number;
  turnover_reduction_transactions: number;
  weekly_forced_close_standard_cost_adr: number;
  carry_until_flip_standard_cost_adr: number;
  carry_until_flip_cost_adjusted_adr: number;
  delta_vs_weekly_close_cost_adjusted_adr: number;
  carry_until_flip_harsh_cost_adr: number;
  carry_until_flip_harsh_cost_adjusted_adr: number;
  delta_vs_weekly_close_harsh_cost_adr: number;
  max_weekly_drawdown_proxy_adr: number;
  final_streak_pnl_adr: number;
  weeks_positive_count: number;
  weeks_negative_count: number;
  weeks_flat_count: number;
  candidate_b_ledger_hash: string;
  pair_week_outcome_warehouse_id: string;
  basket_path_warehouse_manifest_id: string;
  gross_model_note: string;
  content_hash: string;
};

type ContinuationEventRow = {
  schema_version: 1;
  gate_id: typeof GATE_ID;
  pair: string;
  direction: CandidateBDecisionRow["final_side"];
  week_open_utc: string;
  year: number;
  streak_start_week: string;
  streak_end_week: string;
  week_index_in_streak: number;
  streak_length_weeks: number;
  friday_state: "winning" | "losing" | "flat";
  week_adr: number;
  remaining_streak_adr_after_week: number;
  cumulative_from_week_to_streak_end_adr: number;
  later_recovered_to_breakeven_weekly_proxy: boolean;
  later_became_profitable_weekly_proxy: boolean;
  later_continued_higher_weekly_proxy: boolean;
  later_gave_back_weekly_proxy: boolean;
  material_worsening_after_week_proxy: boolean;
};

type FlipQualityRow = {
  pair: string;
  flip_week: string;
  prior_direction: CandidateBDecisionRow["final_side"];
  next_direction: CandidateBDecisionRow["final_side"];
  prior_streak_start_week: string;
  prior_streak_end_week: string;
  prior_streak_length_weeks: number;
  prior_streak_adr: number;
  prior_last_week_adr: number;
  next_first_week_adr: number;
  next_streak_adr: number;
  flip_after_losing_streak: boolean;
  flip_after_losing_last_week: boolean;
  next_direction_first_week_positive: boolean;
  flip_saved_loss_proxy: boolean;
  flip_arrived_late_proxy: boolean;
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
    gate71bmSummaryPath: args.get("--gate71bm-summary") ?? DEFAULT_GATE71BM_SUMMARY_PATH,
    classificationPath: args.get("--classification") ?? DEFAULT_GATE73A_CLASSIFICATION_PATH,
    pairWeekOutcomeWarehouseId: args.get("--pair-week-outcome-warehouse-id") ?? DEFAULT_PAIR_WEEK_OUTCOME_WAREHOUSE_ID,
    standardCostPerTransactionAdr: Number(args.get("--standard-cost-per-transaction-adr") ?? STANDARD_COST_PER_TRANSACTION_ADR),
    harshCostPerTransactionAdr: Number(args.get("--harsh-cost-per-transaction-adr") ?? HARSH_COST_PER_TRANSACTION_ADR),
  };
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function key(...parts: string[]) {
  return parts.join("|");
}

function sum(values: number[]) {
  return round(values.reduce((total, value) => total + value, 0)) ?? 0;
}

function mean(values: number[]) {
  return values.length === 0 ? 0 : round(values.reduce((total, value) => total + value, 0) / values.length) ?? 0;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : sorted[mid]) ?? 0;
}

function rate(count: number, denominator: number) {
  return round(count / Math.max(1, denominator));
}

function profitFactor(values: number[]) {
  const grossProfit = values.filter((value) => value > 0).reduce((total, value) => total + value, 0);
  const grossLoss = values.filter((value) => value < 0).reduce((total, value) => total + value, 0);
  return grossLoss < 0 ? round(grossProfit / Math.abs(grossLoss)) : null;
}

function maxDrawdown(values: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  return round(maxDd) ?? 0;
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const itemKey = getKey(row);
    map.set(itemKey, [...(map.get(itemKey) ?? []), row]);
  }
  return map;
}

function lengthBucket(length: number) {
  return length >= 5 ? "5_plus" : String(length);
}

async function loadPairWeekOutcomeRows(options: {
  warehouseId: string;
  weeks: string[];
  symbols: string[];
}) {
  const rows = await query<PairOutcomeDbRow>(
    `SELECT week_open_utc, symbol, direction, weekly_hold_adr,
            weekly_hold_missing_price_rows, weekly_hold_default_adr_rows,
            row_hash
       FROM research_pair_week_path_outcomes
      WHERE manifest_id = $1
        AND week_open_utc = ANY($2::timestamptz[])
        AND symbol = ANY($3::text[])
      ORDER BY week_open_utc ASC, symbol ASC, direction ASC`,
    [options.warehouseId, options.weeks, options.symbols],
  );
  return new Map(rows.map((row) => [
    key(iso(row.week_open_utc), row.symbol.toUpperCase(), row.direction),
    row,
  ]));
}

function buildPairWeekRows(decisions: CandidateBDecisionRow[], outcomesByKey: Map<string, PairOutcomeDbRow>) {
  return decisions.map((decision): PairWeekRow => {
    const symbol = decision.symbol.toUpperCase();
    const outcome = outcomesByKey.get(key(decision.week_open_utc, symbol, decision.final_side));
    return {
      week_open_utc: decision.week_open_utc,
      year: decision.year,
      pair: symbol,
      candidate_b_direction: decision.final_direction,
      candidate_b_side: decision.final_side,
      weekly_hold_adr: round(Number(outcome?.weekly_hold_adr ?? 0)) ?? 0,
      missing_price: Number(outcome?.weekly_hold_missing_price_rows ?? 1) > 0,
      default_adr: Number(outcome?.weekly_hold_default_adr_rows ?? 0) > 0,
      row_hash: outcome?.row_hash ?? null,
    };
  });
}

function buildStreaks(options: {
  pairWeekRows: PairWeekRow[];
  candidateBLedgerHash: string;
  pairWeekOutcomeWarehouseId: string;
  basketPathWarehouseManifestId: string;
  standardCostPerTransactionAdr: number;
  harshCostPerTransactionAdr: number;
}) {
  const rowsByPair = groupBy(options.pairWeekRows, (row) => row.pair);
  const streaks: DirectionStreakRow[] = [];
  for (const [pair, rows] of [...rowsByPair.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const sorted = [...rows].sort((left, right) => left.week_open_utc.localeCompare(right.week_open_utc));
    let start = 0;
    for (let index = 1; index <= sorted.length; index += 1) {
      const current = sorted[index];
      const previous = sorted[index - 1];
      const ended = !current || current.candidate_b_side !== previous?.candidate_b_side;
      if (!ended) continue;
      const streakRows = sorted.slice(start, index);
      const first = streakRows[0];
      const last = streakRows.at(-1);
      if (!first || !last) continue;
      const weeklyValues = streakRows.map((row) => row.weekly_hold_adr);
      const gross = sum(weeklyValues);
      const weeklyTransactions = streakRows.length * 2;
      const carryTransactions = 2;
      const weeklyStandardCost = round(weeklyTransactions * options.standardCostPerTransactionAdr) ?? 0;
      const carryStandardCost = round(carryTransactions * options.standardCostPerTransactionAdr) ?? 0;
      const weeklyHarshCost = round(weeklyTransactions * options.harshCostPerTransactionAdr) ?? 0;
      const carryHarshCost = round(carryTransactions * options.harshCostPerTransactionAdr) ?? 0;
      const base = {
        schema_version: 1 as const,
        gate_id: GATE_ID,
        pair,
        direction: first.candidate_b_side,
        streak_start_week: first.week_open_utc,
        streak_end_week: last.week_open_utc,
        terminal_streak: index === sorted.length,
        streak_length_weeks: streakRows.length,
        weekly_close_sum_adr: gross,
        carry_until_flip_gross_adr: gross,
        delta_vs_weekly_close_gross_adr: 0,
        weekly_forced_close_transactions: weeklyTransactions,
        carry_until_flip_transactions: carryTransactions,
        turnover_reduction_transactions: weeklyTransactions - carryTransactions,
        weekly_forced_close_standard_cost_adr: weeklyStandardCost,
        carry_until_flip_standard_cost_adr: carryStandardCost,
        carry_until_flip_cost_adjusted_adr: round(gross - carryStandardCost) ?? 0,
        delta_vs_weekly_close_cost_adjusted_adr: round((gross - carryStandardCost) - (gross - weeklyStandardCost)) ?? 0,
        carry_until_flip_harsh_cost_adr: carryHarshCost,
        carry_until_flip_harsh_cost_adjusted_adr: round(gross - carryHarshCost) ?? 0,
        delta_vs_weekly_close_harsh_cost_adr: round((gross - carryHarshCost) - (gross - weeklyHarshCost)) ?? 0,
        max_weekly_drawdown_proxy_adr: maxDrawdown(weeklyValues),
        final_streak_pnl_adr: gross,
        weeks_positive_count: weeklyValues.filter((value) => value > 0).length,
        weeks_negative_count: weeklyValues.filter((value) => value < 0).length,
        weeks_flat_count: weeklyValues.filter((value) => value === 0).length,
        candidate_b_ledger_hash: options.candidateBLedgerHash,
        pair_week_outcome_warehouse_id: options.pairWeekOutcomeWarehouseId,
        basket_path_warehouse_manifest_id: options.basketPathWarehouseManifestId,
        gross_model_note: "Gross carry-until-flip equals the sum of materialized weekly-hold pair outcomes; continuous raw-price carry path is not reconstructed in Gate 73C.",
      };
      streaks.push({
        ...base,
        content_hash: sha256Stable(base),
      });
      start = index;
    }
  }
  return streaks;
}

function buildContinuationEvents(streaks: DirectionStreakRow[], pairWeekRows: PairWeekRow[]) {
  const rowsByStreakKey = groupBy(pairWeekRows, (row) => key(row.pair, row.candidate_b_side));
  const events: ContinuationEventRow[] = [];
  for (const streak of streaks) {
    const rows = (rowsByStreakKey.get(key(streak.pair, streak.direction)) ?? [])
      .filter((row) => row.week_open_utc >= streak.streak_start_week && row.week_open_utc <= streak.streak_end_week)
      .sort((left, right) => left.week_open_utc.localeCompare(right.week_open_utc));
    for (let index = 0; index < rows.length - 1; index += 1) {
      const current = rows[index];
      if (!current) continue;
      const futureValues = rows.slice(index + 1).map((row) => row.weekly_hold_adr);
      const currentAndFutureValues = rows.slice(index).map((row) => row.weekly_hold_adr);
      let cumulative = current.weekly_hold_adr;
      let recovered = current.weekly_hold_adr >= 0;
      let becameProfitable = current.weekly_hold_adr > 0;
      let minCumulative = cumulative;
      for (const futureValue of futureValues) {
        cumulative += futureValue;
        minCumulative = Math.min(minCumulative, cumulative);
        if (cumulative >= 0) recovered = true;
        if (cumulative > 0) becameProfitable = true;
      }
      const remaining = sum(futureValues);
      const fromWeekToEnd = sum(currentAndFutureValues);
      events.push({
        schema_version: 1,
        gate_id: GATE_ID,
        pair: current.pair,
        direction: current.candidate_b_side,
        week_open_utc: current.week_open_utc,
        year: current.year,
        streak_start_week: streak.streak_start_week,
        streak_end_week: streak.streak_end_week,
        week_index_in_streak: index + 1,
        streak_length_weeks: rows.length,
        friday_state: current.weekly_hold_adr > 0 ? "winning" : current.weekly_hold_adr < 0 ? "losing" : "flat",
        week_adr: current.weekly_hold_adr,
        remaining_streak_adr_after_week: remaining,
        cumulative_from_week_to_streak_end_adr: fromWeekToEnd,
        later_recovered_to_breakeven_weekly_proxy: recovered,
        later_became_profitable_weekly_proxy: becameProfitable,
        later_continued_higher_weekly_proxy: current.weekly_hold_adr > 0 && remaining > 0,
        later_gave_back_weekly_proxy: current.weekly_hold_adr > 0 && remaining < 0,
        material_worsening_after_week_proxy: minCumulative <= current.weekly_hold_adr - 1,
      });
    }
  }
  return events;
}

function buildFlipQualityRows(streaks: DirectionStreakRow[], pairWeekRows: PairWeekRow[]) {
  const rowsByStreakStart = new Map(streaks.map((streak) => [key(streak.pair, streak.streak_start_week), streak]));
  const pairWeeksByKey = new Map(pairWeekRows.map((row) => [key(row.pair, row.week_open_utc), row]));
  const streaksByPair = groupBy(streaks, (row) => row.pair);
  const rows: FlipQualityRow[] = [];
  for (const [pair, pairStreaks] of streaksByPair.entries()) {
    const sorted = [...pairStreaks].sort((left, right) => left.streak_start_week.localeCompare(right.streak_start_week));
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const prior = sorted[index];
      const next = sorted[index + 1];
      if (!prior || !next) continue;
      const priorLastWeek = pairWeeksByKey.get(key(pair, prior.streak_end_week));
      const nextFirstWeek = pairWeeksByKey.get(key(pair, next.streak_start_week));
      const nextStreak = rowsByStreakStart.get(key(pair, next.streak_start_week));
      const priorLastWeekAdr = priorLastWeek?.weekly_hold_adr ?? 0;
      const nextFirstWeekAdr = nextFirstWeek?.weekly_hold_adr ?? 0;
      rows.push({
        pair,
        flip_week: next.streak_start_week,
        prior_direction: prior.direction,
        next_direction: next.direction,
        prior_streak_start_week: prior.streak_start_week,
        prior_streak_end_week: prior.streak_end_week,
        prior_streak_length_weeks: prior.streak_length_weeks,
        prior_streak_adr: prior.final_streak_pnl_adr,
        prior_last_week_adr: priorLastWeekAdr,
        next_first_week_adr: nextFirstWeekAdr,
        next_streak_adr: nextStreak?.final_streak_pnl_adr ?? 0,
        flip_after_losing_streak: prior.final_streak_pnl_adr < 0,
        flip_after_losing_last_week: priorLastWeekAdr < 0,
        next_direction_first_week_positive: nextFirstWeekAdr > 0,
        flip_saved_loss_proxy: prior.final_streak_pnl_adr < 0 && nextFirstWeekAdr > 0,
        flip_arrived_late_proxy: prior.final_streak_pnl_adr < -1 && priorLastWeekAdr < 0,
      });
    }
  }
  return rows;
}

function summarizeValues(values: number[]) {
  return {
    observations: values.length,
    total_adr: sum(values),
    average_adr: mean(values),
    median_adr: median(values),
    gross_profit_adr: sum(values.filter((value) => value > 0)),
    gross_loss_adr: sum(values.filter((value) => value < 0)),
    profit_factor_adr: profitFactor(values),
    win_rate: rate(values.filter((value) => value > 0).length, values.filter((value) => value !== 0).length),
    max_drawdown_adr: maxDrawdown(values),
  };
}

function streakLengthDistribution(streaks: DirectionStreakRow[]) {
  return [...groupBy(streaks, (row) => lengthBucket(row.streak_length_weeks)).entries()]
    .sort(([left], [right]) => {
      const leftValue = left === "5_plus" ? 5 : Number(left);
      const rightValue = right === "5_plus" ? 5 : Number(right);
      return leftValue - rightValue;
    })
    .map(([bucket, rows]) => {
      const values = rows.map((row) => row.final_streak_pnl_adr);
      return {
        streak_length_bucket: bucket,
        streaks: rows.length,
        total_weeks: rows.reduce((total, row) => total + row.streak_length_weeks, 0),
        average_streak_length: mean(rows.map((row) => row.streak_length_weeks)),
        average_adr: mean(values),
        median_adr: median(values),
        total_adr: sum(values),
        profit_factor_adr: profitFactor(values),
        contribution_to_total_adr: null as number | null,
      };
    });
}

function applyContributionShare(rows: ReturnType<typeof streakLengthDistribution>) {
  const total = rows.reduce((sumValue, row) => sumValue + row.total_adr, 0);
  return rows.map((row) => ({
    ...row,
    contribution_to_total_adr: total !== 0 ? round(row.total_adr / total) : null,
  }));
}

function buildCostAllocatedWeeklySeries(options: {
  pairWeekRows: PairWeekRow[];
  streaks: DirectionStreakRow[];
  costPerTransactionAdr: number;
}) {
  const grossByWeek = new Map<string, number>();
  for (const row of options.pairWeekRows) {
    grossByWeek.set(row.week_open_utc, (grossByWeek.get(row.week_open_utc) ?? 0) + row.weekly_hold_adr);
  }
  const carryTransactionsByWeek = new Map<string, number>();
  for (const streak of options.streaks) {
    carryTransactionsByWeek.set(streak.streak_start_week, (carryTransactionsByWeek.get(streak.streak_start_week) ?? 0) + 1);
    carryTransactionsByWeek.set(streak.streak_end_week, (carryTransactionsByWeek.get(streak.streak_end_week) ?? 0) + 1);
  }
  return [...grossByWeek.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([week, gross]) => {
    const forcedTransactions = GATE71_EXPECTED_SYMBOLS_PER_WEEK * 2;
    const carryTransactions = carryTransactionsByWeek.get(week) ?? 0;
    return {
      week_open_utc: week,
      year: new Date(week).getUTCFullYear(),
      gross_adr: round(gross) ?? 0,
      weekly_forced_cost_adr: round(forcedTransactions * options.costPerTransactionAdr) ?? 0,
      carry_until_flip_cost_adr: round(carryTransactions * options.costPerTransactionAdr) ?? 0,
      weekly_forced_net_adr: round(gross - forcedTransactions * options.costPerTransactionAdr) ?? 0,
      carry_until_flip_net_adr: round(gross - carryTransactions * options.costPerTransactionAdr) ?? 0,
      weekly_forced_transactions: forcedTransactions,
      carry_until_flip_transactions: carryTransactions,
    };
  });
}

function lifecycleComparison(options: {
  pairWeekRows: PairWeekRow[];
  streaks: DirectionStreakRow[];
  standardCostPerTransactionAdr: number;
  harshCostPerTransactionAdr: number;
}) {
  const pairWeekValues = options.pairWeekRows.map((row) => row.weekly_hold_adr);
  const streakGrossValues = options.streaks.map((row) => row.final_streak_pnl_adr);
  const weeklyForcedTransactions = options.pairWeekRows.length * 2;
  const carryTransactions = options.streaks.length * 2;
  const standardWeeklySeries = buildCostAllocatedWeeklySeries({
    pairWeekRows: options.pairWeekRows,
    streaks: options.streaks,
    costPerTransactionAdr: options.standardCostPerTransactionAdr,
  });
  const harshWeeklySeries = buildCostAllocatedWeeklySeries({
    pairWeekRows: options.pairWeekRows,
    streaks: options.streaks,
    costPerTransactionAdr: options.harshCostPerTransactionAdr,
  });
  return {
    cost_model: {
      standard_cost_per_transaction_adr: options.standardCostPerTransactionAdr,
      harsh_cost_per_transaction_adr: options.harshCostPerTransactionAdr,
      transaction_definition: "one pair-side open or close event in ADR units",
      gross_model_note: "Gross carry-until-flip uses weekly outcome aggregation and equals weekly forced close gross by construction; cost and lifecycle grouping are the first-order warehouse-answerable differences.",
    },
    weekly_forced_close_gross_pair_week: summarizeValues(pairWeekValues),
    carry_until_flip_gross_streak_lifecycle: summarizeValues(streakGrossValues),
    weekly_forced_close_standard_cost_weekly_series: summarizeValues(standardWeeklySeries.map((row) => row.weekly_forced_net_adr)),
    carry_until_flip_standard_cost_weekly_series: summarizeValues(standardWeeklySeries.map((row) => row.carry_until_flip_net_adr)),
    weekly_forced_close_harsh_cost_weekly_series: summarizeValues(harshWeeklySeries.map((row) => row.weekly_forced_net_adr)),
    carry_until_flip_harsh_cost_weekly_series: summarizeValues(harshWeeklySeries.map((row) => row.carry_until_flip_net_adr)),
    turnover: {
      weekly_forced_close_transactions: weeklyForcedTransactions,
      carry_until_flip_transactions: carryTransactions,
      turnover_reduction_transactions: weeklyForcedTransactions - carryTransactions,
      turnover_reduction_rate: rate(weeklyForcedTransactions - carryTransactions, weeklyForcedTransactions),
      standard_cost_saved_adr: round((weeklyForcedTransactions - carryTransactions) * options.standardCostPerTransactionAdr) ?? 0,
      harsh_cost_saved_adr: round((weeklyForcedTransactions - carryTransactions) * options.harshCostPerTransactionAdr) ?? 0,
    },
    standard_weekly_series: standardWeeklySeries,
    harsh_weekly_series: harshWeeklySeries,
  };
}

function continuationSummaries(events: ContinuationEventRow[]) {
  const losing = events.filter((row) => row.friday_state === "losing");
  const winning = events.filter((row) => row.friday_state === "winning");
  return {
    losing_friday_continuation: {
      count: losing.length,
      recovered_to_breakeven_rate: rate(losing.filter((row) => row.later_recovered_to_breakeven_weekly_proxy).length, losing.length),
      later_became_profitable_rate: rate(losing.filter((row) => row.later_became_profitable_weekly_proxy).length, losing.length),
      materially_worsened_rate: rate(losing.filter((row) => row.material_worsening_after_week_proxy).length, losing.length),
      average_remaining_streak_adr_after_week: mean(losing.map((row) => row.remaining_streak_adr_after_week)),
      median_remaining_streak_adr_after_week: median(losing.map((row) => row.remaining_streak_adr_after_week)),
      total_adr_effect_of_carrying: sum(losing.map((row) => row.remaining_streak_adr_after_week)),
    },
    winning_friday_continuation: {
      count: winning.length,
      continued_higher_rate: rate(winning.filter((row) => row.later_continued_higher_weekly_proxy).length, winning.length),
      gave_back_rate: rate(winning.filter((row) => row.later_gave_back_weekly_proxy).length, winning.length),
      average_continuation_gain_adr: mean(winning.filter((row) => row.remaining_streak_adr_after_week > 0).map((row) => row.remaining_streak_adr_after_week)),
      average_giveback_adr: mean(winning.filter((row) => row.remaining_streak_adr_after_week < 0).map((row) => row.remaining_streak_adr_after_week)),
      median_remaining_streak_adr_after_week: median(winning.map((row) => row.remaining_streak_adr_after_week)),
      total_adr_effect_of_carrying: sum(winning.map((row) => row.remaining_streak_adr_after_week)),
    },
  };
}

function flipQualitySummary(rows: FlipQualityRow[]) {
  return {
    flips: rows.length,
    flip_after_losing_streak_rate: rate(rows.filter((row) => row.flip_after_losing_streak).length, rows.length),
    flip_after_losing_last_week_rate: rate(rows.filter((row) => row.flip_after_losing_last_week).length, rows.length),
    next_direction_first_week_positive_rate: rate(rows.filter((row) => row.next_direction_first_week_positive).length, rows.length),
    flip_saved_loss_proxy_rate: rate(rows.filter((row) => row.flip_saved_loss_proxy).length, rows.length),
    flip_arrived_late_proxy_rate: rate(rows.filter((row) => row.flip_arrived_late_proxy).length, rows.length),
    average_prior_streak_adr: mean(rows.map((row) => row.prior_streak_adr)),
    average_next_first_week_adr: mean(rows.map((row) => row.next_first_week_adr)),
    average_next_streak_adr: mean(rows.map((row) => row.next_streak_adr)),
  };
}

function annualComparison(series: ReturnType<typeof buildCostAllocatedWeeklySeries>) {
  return [...groupBy(series, (row) => String(row.year)).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([year, rows]) => ({
      year: Number(year),
      weeks: rows.length,
      weekly_forced_net_adr: sum(rows.map((row) => row.weekly_forced_net_adr)),
      carry_until_flip_net_adr: sum(rows.map((row) => row.carry_until_flip_net_adr)),
      delta_adr: sum(rows.map((row) => row.carry_until_flip_net_adr - row.weekly_forced_net_adr)),
      weekly_forced_profit_factor: profitFactor(rows.map((row) => row.weekly_forced_net_adr)),
      carry_until_flip_profit_factor: profitFactor(rows.map((row) => row.carry_until_flip_net_adr)),
    }));
}

function topWinnerStability(options: {
  classified: Gate73aClassifiedWeek[];
  standardWeeklySeries: ReturnType<typeof buildCostAllocatedWeeklySeries>;
}) {
  const top20 = [...options.classified].sort((left, right) => right.weekly_hold_adr - left.weekly_hold_adr).slice(0, 20);
  const top20Set = new Set(top20.map((row) => row.week_open_utc));
  const seriesByWeek = new Map(options.standardWeeklySeries.map((row) => [row.week_open_utc, row]));
  const oldTop = top20.map((row) => {
    const series = seriesByWeek.get(row.week_open_utc);
    return {
      week_open_utc: row.week_open_utc,
      weekly_hold_gross_adr: row.weekly_hold_adr,
      weekly_forced_standard_net_adr: series?.weekly_forced_net_adr ?? null,
      carry_until_flip_standard_net_adr: series?.carry_until_flip_net_adr ?? null,
      delta_adr: series ? round(series.carry_until_flip_net_adr - series.weekly_forced_net_adr) : null,
    };
  });
  const topCarry = [...options.standardWeeklySeries].sort((left, right) => right.carry_until_flip_net_adr - left.carry_until_flip_net_adr).slice(0, 20);
  return {
    baseline_top20_gross_adr: sum(top20.map((row) => row.weekly_hold_adr)),
    same_top20_weekly_forced_standard_net_adr: sum(oldTop.map((row) => row.weekly_forced_standard_net_adr ?? 0)),
    same_top20_carry_until_flip_standard_net_adr: sum(oldTop.map((row) => row.carry_until_flip_standard_net_adr ?? 0)),
    same_top20_carry_vs_weekly_standard_delta_adr: sum(oldTop.map((row) => row.delta_adr ?? 0)),
    top20_retention_ratio_vs_gross: sum(oldTop.map((row) => row.carry_until_flip_standard_net_adr ?? 0)) / Math.max(1, sum(top20.map((row) => row.weekly_hold_adr))),
    new_top20_carry_weeks_not_in_baseline_top20: topCarry.filter((row) => !top20Set.has(row.week_open_utc)).length,
    baseline_top20_weeks: oldTop,
    carry_top20_weeks: topCarry.map((row) => ({
      week_open_utc: row.week_open_utc,
      carry_until_flip_standard_net_adr: row.carry_until_flip_net_adr,
      weekly_forced_standard_net_adr: row.weekly_forced_net_adr,
      was_baseline_top20: top20Set.has(row.week_open_utc),
    })),
  };
}

function recommendation(comparison: ReturnType<typeof lifecycleComparison>, continuation: ReturnType<typeof continuationSummaries>) {
  const turnover = comparison.turnover;
  const standardForced = comparison.weekly_forced_close_standard_cost_weekly_series;
  const standardCarry = comparison.carry_until_flip_standard_cost_weekly_series;
  const notes = [
    "Do not promote carry-until-flip from Gate 73C; this is lifecycle diagnostics only.",
    "Do not use this as a substitute for dynamic intrawEEK trade-leg exits.",
    "Gross carry equals weekly gross under current warehouses; continuous raw-price carry would need a separate materialized path contract.",
  ];
  if ((standardCarry.profit_factor_adr ?? 0) > (standardForced.profit_factor_adr ?? 0)) {
    notes.push("Cost-adjusted weekly carry series improves PF versus weekly forced close under the standard sensitivity.");
  }
  if (turnover.turnover_reduction_rate > 0.2) {
    notes.push("Same-direction continuation meaningfully reduces modeled turnover.");
  }
  if (continuation.losing_friday_continuation.later_became_profitable_rate > 0.35) {
    notes.push("Losing-Friday continuation often recovers on a weekly-close proxy; weekly force-close may be prematurely realizing some valid directions.");
  }
  return {
    next_gate_recommendation: "Gate 73D: continuation verdict and baseline decision preflight",
    decision_options: [
      "keep weekly forced close as baseline and return to profit-protection tests",
      "treat carry-until-flip as a candidate lifecycle baseline requiring continuous-path materialization before promotion",
      "run a small cost-sensitivity-only continuation review if Freedom wants more conservative transaction assumptions",
    ],
    notes,
    forbidden_next_steps: [
      "no promotion",
      "no risk layer",
      "no dynamic intrawEEK trade-leg exit matrix",
      "no pair-specific parameters",
      "no source or Candidate B mutation",
      "no MT5/live/runtime work",
    ],
  };
}

function renderReport(summary: Record<string, unknown>, distribution: Array<Record<string, unknown>>, comparison: Record<string, unknown>, continuation: Record<string, unknown>, flips: Record<string, unknown>) {
  return [
    "# Gate 73C Direction-Continuation Lifecycle Diagnostic",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Tests whether Candidate B pair directions persist enough to justify a continuation lifecycle diagnostic.",
    "- Uses locked Candidate B directions plus existing pair-week weekly-hold outcomes.",
    "- Compares weekly forced close versus carry-until-flip under gross aggregation and cost sensitivity.",
    "- Does not run dynamic intrawEEK trade exits, rebuild raw M1, mutate Candidate B, start risk, or promote a lifecycle.",
    "",
    "## Key Finding",
    "",
    String(summary.key_finding),
    "",
    "## Streak Length Distribution",
    "",
    renderTable(distribution, ["streak_length_bucket", "streaks", "total_weeks", "average_streak_length", "average_adr", "median_adr", "total_adr", "profit_factor_adr", "contribution_to_total_adr"]),
    "",
    "## Lifecycle Comparison",
    "",
    "```json",
    JSON.stringify({
      cost_model: comparison.cost_model,
      weekly_forced_close_gross_pair_week: comparison.weekly_forced_close_gross_pair_week,
      carry_until_flip_gross_streak_lifecycle: comparison.carry_until_flip_gross_streak_lifecycle,
      weekly_forced_close_standard_cost_weekly_series: comparison.weekly_forced_close_standard_cost_weekly_series,
      carry_until_flip_standard_cost_weekly_series: comparison.carry_until_flip_standard_cost_weekly_series,
      turnover: comparison.turnover,
    }, null, 2),
    "```",
    "",
    "## Continuation Summary",
    "",
    "```json",
    JSON.stringify(continuation, null, 2),
    "```",
    "",
    "## Flip Quality Summary",
    "",
    "```json",
    JSON.stringify(flips, null, 2),
    "```",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Recommendation",
    "",
    "```json",
    JSON.stringify(summary.recommendation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Direction streak ledger: \`${summary.artifacts["directionStreakLedger"]}\``,
    `- Continuation event ledger: \`${summary.artifacts["continuationEventLedger"]}\``,
    `- Flip quality ledger: \`${summary.artifacts["flipQualityLedger"]}\``,
    `- Streak length distribution: \`${summary.artifacts["streakLengthDistribution"]}\``,
    `- Lifecycle comparison: \`${summary.artifacts["lifecycleComparison"]}\``,
    `- Continuation summaries: \`${summary.artifacts["continuationSummaries"]}\``,
    `- Flip quality summary: \`${summary.artifacts["flipQualitySummary"]}\``,
    `- Annual stability: \`${summary.artifacts["annualStability"]}\``,
    `- Top-winner stability: \`${summary.artifacts["topWinnerStability"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 73C is diagnostic only. No continuation lifecycle is promoted by this receipt.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  if (!Number.isFinite(options.standardCostPerTransactionAdr) || options.standardCostPerTransactionAdr < 0) {
    throw new Error(`Invalid standard cost: ${options.standardCostPerTransactionAdr}`);
  }
  if (!Number.isFinite(options.harshCostPerTransactionAdr) || options.harshCostPerTransactionAdr < 0) {
    throw new Error(`Invalid harsh cost: ${options.harshCostPerTransactionAdr}`);
  }
  const startedAt = Date.now();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const decisions = await loadCandidateBRows(options.candidateBLedgerPath);
  const denominator = validateCandidateBRows(decisions);
  const candidateBLedgerHash = (await fileHash(options.candidateBLedgerPath)).toUpperCase();
  const gate71bm = await readJson<Gate71bmSummary>(options.gate71bmSummaryPath);
  const classified = await readJsonl<Gate73aClassifiedWeek>(options.classificationPath);
  const weeks = groupCandidateBRowsByWeek(decisions).map(([week]) => week);
  const symbols = Array.from(new Set(decisions.map((row) => row.symbol.toUpperCase()))).sort();
  const outcomesByKey = await loadPairWeekOutcomeRows({
    warehouseId: options.pairWeekOutcomeWarehouseId,
    weeks,
    symbols,
  });
  const pairWeekRows = buildPairWeekRows(decisions, outcomesByKey);
  const streaks = buildStreaks({
    pairWeekRows,
    candidateBLedgerHash,
    pairWeekOutcomeWarehouseId: options.pairWeekOutcomeWarehouseId,
    basketPathWarehouseManifestId: gate71bm.warehouse.manifest_id,
    standardCostPerTransactionAdr: options.standardCostPerTransactionAdr,
    harshCostPerTransactionAdr: options.harshCostPerTransactionAdr,
  });
  const continuationEvents = buildContinuationEvents(streaks, pairWeekRows);
  const flipRows = buildFlipQualityRows(streaks, pairWeekRows);
  const streakDistribution = applyContributionShare(streakLengthDistribution(streaks));
  const comparison = lifecycleComparison({
    pairWeekRows,
    streaks,
    standardCostPerTransactionAdr: options.standardCostPerTransactionAdr,
    harshCostPerTransactionAdr: options.harshCostPerTransactionAdr,
  });
  const continuation = continuationSummaries(continuationEvents);
  const flips = flipQualitySummary(flipRows);
  const annual = annualComparison(comparison.standard_weekly_series);
  const topWinners = topWinnerStability({
    classified,
    standardWeeklySeries: comparison.standard_weekly_series,
  });
  const runtimeSeconds = round((Date.now() - startedAt) / 1000) ?? 0;
  const artifacts = {
    directionStreakLedger: toRepoRelative(path.join(artifactDir, "direction-streak-ledger.rows.jsonl")),
    continuationEventLedger: toRepoRelative(path.join(artifactDir, "continuation-event-ledger.rows.jsonl")),
    flipQualityLedger: toRepoRelative(path.join(artifactDir, "flip-quality-ledger.rows.jsonl")),
    streakLengthDistribution: toRepoRelative(path.join(artifactDir, "streak-length-distribution.json")),
    lifecycleComparison: toRepoRelative(path.join(artifactDir, "weekly-close-vs-carry-comparison.json")),
    continuationSummaries: toRepoRelative(path.join(artifactDir, "losing-winning-friday-continuation-summary.json")),
    flipQualitySummary: toRepoRelative(path.join(artifactDir, "flip-quality-summary.json")),
    annualStability: toRepoRelative(path.join(artifactDir, "annual-stability.json")),
    topWinnerStability: toRepoRelative(path.join(artifactDir, "top-winner-stability.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate73c-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate73c-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const weeklyForcedStandard = comparison.weekly_forced_close_standard_cost_weekly_series;
  const carryStandard = comparison.carry_until_flip_standard_cost_weekly_series;
  const validation = {
    candidate_b_forced28_preserved: denominator.forced28_preserved,
    candidate_b_ledger_hash_matches_gate71bm: candidateBLedgerHash === gate71bm.warehouse.candidate_b_ledger_hash,
    gate71bm_passed: gate71bm.verdict.startsWith("PASS_"),
    pair_week_outcome_warehouse_id: options.pairWeekOutcomeWarehouseId,
    raw_m1_rebuild_performed: false,
    dynamic_intrweek_exit_matrix_started: false,
    continuation_lifecycle_diagnostic_only: true,
    exit_promotion_performed: false,
    risk_layer_started: false,
    brain_truth_mutated: false,
    weeks_reviewed: weeks.length,
    expected_weeks: GATE71_EXPECTED_WEEKS,
    pair_week_rows: pairWeekRows.length,
    expected_pair_week_rows: GATE71_EXPECTED_ROWS,
    symbols: symbols.length,
    expected_symbols_per_week: GATE71_EXPECTED_SYMBOLS_PER_WEEK,
    direction_streaks: streaks.length,
    continuation_events: continuationEvents.length,
    flip_events: flipRows.length,
    missing_price_pair_week_rows: pairWeekRows.filter((row) => row.missing_price).length,
    default_adr_pair_week_rows: pairWeekRows.filter((row) => row.default_adr).length,
    standard_cost_per_transaction_adr: options.standardCostPerTransactionAdr,
    harsh_cost_per_transaction_adr: options.harshCostPerTransactionAdr,
    weekly_forced_standard_total_adr: weeklyForcedStandard.total_adr,
    carry_until_flip_standard_total_adr: carryStandard.total_adr,
    carry_minus_weekly_standard_total_adr: round(carryStandard.total_adr - weeklyForcedStandard.total_adr),
    weekly_forced_standard_pf: weeklyForcedStandard.profit_factor_adr,
    carry_until_flip_standard_pf: carryStandard.profit_factor_adr,
    turnover_reduction_rate: comparison.turnover.turnover_reduction_rate,
    runtime_seconds: runtimeSeconds,
  };
  const pass =
    validation.candidate_b_forced28_preserved &&
    validation.candidate_b_ledger_hash_matches_gate71bm &&
    validation.gate71bm_passed &&
    validation.weeks_reviewed === validation.expected_weeks &&
    validation.pair_week_rows === validation.expected_pair_week_rows &&
    validation.symbols === validation.expected_symbols_per_week &&
    validation.missing_price_pair_week_rows === 0 &&
    validation.raw_m1_rebuild_performed === false &&
    validation.dynamic_intrweek_exit_matrix_started === false &&
    validation.exit_promotion_performed === false &&
    validation.risk_layer_started === false &&
    validation.brain_truth_mutated === false;
  const gateRecommendation = recommendation(comparison, continuation);
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_GATE73C_DIRECTION_CONTINUATION_LIFECYCLE__PERSISTENCE_AND_COST_SENSITIVITY_VISIBLE"
      : "FAIL_GATE73C_DIRECTION_CONTINUATION_LIFECYCLE",
    key_finding: `Candidate B produced ${streaks.length} pair-direction streaks across ${pairWeekRows.length} pair-week rows. Gross carry-until-flip equals weekly forced close under the existing weekly outcome warehouse, but standard-cost carry saves ${comparison.turnover.standard_cost_saved_adr} ADR through ${comparison.turnover.turnover_reduction_rate} turnover reduction; carry standard PF is ${carryStandard.profit_factor_adr} versus weekly forced standard PF ${weeklyForcedStandard.profit_factor_adr}.`,
    validation,
    streak_length_distribution: streakDistribution,
    lifecycle_comparison_summary: {
      cost_model: comparison.cost_model,
      weekly_forced_close_standard_cost_weekly_series: comparison.weekly_forced_close_standard_cost_weekly_series,
      carry_until_flip_standard_cost_weekly_series: comparison.carry_until_flip_standard_cost_weekly_series,
      turnover: comparison.turnover,
    },
    continuation_summary: continuation,
    flip_quality_summary: flips,
    recommendation: gateRecommendation,
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "direction-streak-ledger.rows.jsonl"), streaks);
  await writeJsonl(path.join(artifactDir, "continuation-event-ledger.rows.jsonl"), continuationEvents);
  await writeJsonl(path.join(artifactDir, "flip-quality-ledger.rows.jsonl"), flipRows);
  await writeJson(path.join(artifactDir, "streak-length-distribution.json"), streakDistribution);
  await writeJson(path.join(artifactDir, "weekly-close-vs-carry-comparison.json"), comparison);
  await writeJson(path.join(artifactDir, "losing-winning-friday-continuation-summary.json"), continuation);
  await writeJson(path.join(artifactDir, "flip-quality-summary.json"), flips);
  await writeJson(path.join(artifactDir, "annual-stability.json"), annual);
  await writeJson(path.join(artifactDir, "top-winner-stability.json"), topWinners);
  await writeJson(path.join(artifactDir, "gate73c-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, streakDistribution, comparison, continuation, flips));
  await writeShaManifest(path.join(artifactDir, "gate73c-sha256.txt"), GATE_ID, COMMAND, [
    { label: "direction_streak_ledger", path: path.join(artifactDir, "direction-streak-ledger.rows.jsonl") },
    { label: "continuation_event_ledger", path: path.join(artifactDir, "continuation-event-ledger.rows.jsonl") },
    { label: "flip_quality_ledger", path: path.join(artifactDir, "flip-quality-ledger.rows.jsonl") },
    { label: "streak_length_distribution", path: path.join(artifactDir, "streak-length-distribution.json") },
    { label: "lifecycle_comparison", path: path.join(artifactDir, "weekly-close-vs-carry-comparison.json") },
    { label: "continuation_summaries", path: path.join(artifactDir, "losing-winning-friday-continuation-summary.json") },
    { label: "flip_quality_summary", path: path.join(artifactDir, "flip-quality-summary.json") },
    { label: "annual_stability", path: path.join(artifactDir, "annual-stability.json") },
    { label: "top_winner_stability", path: path.join(artifactDir, "top-winner-stability.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate73c-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ validation, recommendation: gateRecommendation, artifacts }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Pool may not have been created.
    }
    if (process.exitCode && process.exitCode !== 0) process.exit(process.exitCode);
  });
