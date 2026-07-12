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
  type BasketPathDiagnosticRow,
  type CandidateBDecisionRow,
  groupCandidateBRowsByWeek,
  loadCandidateBRows,
  validateCandidateBRows,
} from "./gate71-utils";
import {
  DEFAULT_GATE71C_WEEKLY_ROWS_PATH,
  DEFAULT_GATE72C_DIR,
  type WeeklyMatrixRow,
} from "./gate72-utils";

const GATE73_DATE = "2026-06-29";
const GATE_ID = "Gate 73B: candidate-b-trade-leg-anatomy-and-runner-preserving-exit-design-preflight";
const COMMAND = "npm run engine:gate73b:trade-leg-anatomy-preflight";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate73b/artifacts/gate73b-trade-leg-anatomy-preflight";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate73b/GATE73B_TRADE_LEG_ANATOMY_PREFLIGHT_${GATE73_DATE}.md`;
const DEFAULT_GATE71B_DIAGNOSTIC_ROWS_PATH = "docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics/candidate-b-basket-adr-path-diagnostics.rows.jsonl";
const DEFAULT_GATE72C_SHORTLIST_PATH = path.join(DEFAULT_GATE72C_DIR, "exit-family-review-shortlist.json");
const DEFAULT_GATE73A_CLASSIFICATION_PATH = "docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/weekly-path-classification.rows.jsonl";
const DEFAULT_GATE71BM_SUMMARY_PATH = "docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse/gate71bm-summary.json";
const DEFAULT_PAIR_WEEK_OUTCOME_WAREHOUSE_ID = "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B";

type ShortlistRule = {
  rule_id: string;
  family: string;
};

type Gate73aClassifiedWeek = {
  week_open_utc: string;
  year: number;
  primary_class: string;
  monster_trend_week: boolean;
  green_then_giveback_week: boolean;
  weekly_hold_adr: number;
  mfe_adr: number;
  mae_adr: number;
  peak_to_friday_giveback_adr: number;
};

type Gate71bmSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    price_bundle_id: string;
    path_resolution: string;
    candidate_b_ledger_hash: string;
    entry_exposure_model_id: string;
    adr_target_pct: number;
    weeks: number;
    point_count: number;
  };
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

type TradeLegCompositionRow = {
  schema_version: 1;
  gate_id: typeof GATE_ID;
  week_open_utc: string;
  year: number;
  pair: string;
  candidate_b_direction: CandidateBDecisionRow["final_direction"];
  candidate_b_side: CandidateBDecisionRow["final_side"];
  trade_final_adr: number;
  basket_final_adr: number;
  basket_mfe_adr: number;
  basket_mae_adr: number;
  basket_path_class: string;
  pair_week_outcome_warehouse_id: string;
  pair_week_outcome_row_hash: string | null;
  basket_path_warehouse_manifest_id: string;
  basket_path_warehouse_hash: string;
  candidate_b_ledger_hash: string;
  missing_price: boolean;
  default_adr: boolean;
  diagnostic_only_pair_identity: true;
  content_hash: string;
};

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
    diagnosticsPath: args.get("--diagnostics") ?? DEFAULT_GATE71B_DIAGNOSTIC_ROWS_PATH,
    weeklyRowsPath: args.get("--weekly-rows") ?? DEFAULT_GATE71C_WEEKLY_ROWS_PATH,
    shortlistPath: args.get("--shortlist") ?? DEFAULT_GATE72C_SHORTLIST_PATH,
    classificationPath: args.get("--classification") ?? DEFAULT_GATE73A_CLASSIFICATION_PATH,
    gate71bmSummaryPath: args.get("--gate71bm-summary") ?? DEFAULT_GATE71BM_SUMMARY_PATH,
    pairWeekOutcomeWarehouseId: args.get("--pair-week-outcome-warehouse-id") ?? DEFAULT_PAIR_WEEK_OUTCOME_WAREHOUSE_ID,
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
  };
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function key(...parts: string[]) {
  return parts.join("|");
}

function rate(count: number, denominator: number) {
  return round(count / Math.max(1, denominator));
}

function sum(values: number[]) {
  return round(values.reduce((total, value) => total + value, 0)) ?? 0;
}

function mean(values: number[]) {
  return values.length === 0 ? 0 : round(values.reduce((total, value) => total + value, 0) / values.length) ?? 0;
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const itemKey = getKey(row);
    map.set(itemKey, [...(map.get(itemKey) ?? []), row]);
  }
  return map;
}

function sortedByFinalAdr(rows: TradeLegCompositionRow[]) {
  return [...rows].sort((left, right) => right.trade_final_adr - left.trade_final_adr || left.pair.localeCompare(right.pair));
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

function buildTradeLegRows(options: {
  decisions: CandidateBDecisionRow[];
  outcomesByKey: Map<string, PairOutcomeDbRow>;
  diagnosticsByWeek: Map<string, BasketPathDiagnosticRow>;
  classifiedByWeek: Map<string, Gate73aClassifiedWeek>;
  candidateBLedgerHash: string;
  pairWeekOutcomeWarehouseId: string;
  basketWarehouse: Gate71bmSummary["warehouse"];
}) {
  return options.decisions.map((decision): TradeLegCompositionRow => {
    const symbol = decision.symbol.toUpperCase();
    const outcome = options.outcomesByKey.get(key(decision.week_open_utc, symbol, decision.final_side));
    const diagnostic = options.diagnosticsByWeek.get(decision.week_open_utc);
    const classified = options.classifiedByWeek.get(decision.week_open_utc);
    if (!diagnostic || !classified) throw new Error(`Missing weekly context for ${decision.week_open_utc}`);
    const base = {
      schema_version: 1 as const,
      gate_id: GATE_ID,
      week_open_utc: decision.week_open_utc,
      year: decision.year,
      pair: symbol,
      candidate_b_direction: decision.final_direction,
      candidate_b_side: decision.final_side,
      trade_final_adr: round(Number(outcome?.weekly_hold_adr ?? 0)) ?? 0,
      basket_final_adr: diagnostic.friday_close_adr,
      basket_mfe_adr: diagnostic.mfe_adr,
      basket_mae_adr: diagnostic.mae_adr,
      basket_path_class: classified.primary_class,
      pair_week_outcome_warehouse_id: options.pairWeekOutcomeWarehouseId,
      pair_week_outcome_row_hash: outcome?.row_hash ?? null,
      basket_path_warehouse_manifest_id: options.basketWarehouse.manifest_id,
      basket_path_warehouse_hash: options.basketWarehouse.warehouse_hash,
      candidate_b_ledger_hash: options.candidateBLedgerHash,
      missing_price: Number(outcome?.weekly_hold_missing_price_rows ?? 1) > 0,
      default_adr: Number(outcome?.weekly_hold_default_adr_rows ?? 0) > 0,
      diagnostic_only_pair_identity: true as const,
    };
    return {
      ...base,
      content_hash: sha256Stable(base),
    };
  });
}

function topWinnerDecomposition(tradeRows: TradeLegCompositionRow[], classified: Gate73aClassifiedWeek[]) {
  const topWeeks = [...classified].sort((left, right) => right.weekly_hold_adr - left.weekly_hold_adr).slice(0, 20);
  const topWeekIds = new Set(topWeeks.map((row) => row.week_open_utc));
  const byWeek = groupBy(tradeRows.filter((row) => topWeekIds.has(row.week_open_utc)), (row) => row.week_open_utc);
  const rows = [...byWeek.entries()].map(([week, weekRows]) => {
    const sorted = sortedByFinalAdr(weekRows);
    const total = sum(weekRows.map((row) => row.trade_final_adr));
    const top1 = sum(sorted.slice(0, 1).map((row) => row.trade_final_adr));
    const top3 = sum(sorted.slice(0, 3).map((row) => row.trade_final_adr));
    const top5 = sum(sorted.slice(0, 5).map((row) => row.trade_final_adr));
    const bottom5 = sum([...weekRows].sort((left, right) => left.trade_final_adr - right.trade_final_adr).slice(0, 5).map((row) => row.trade_final_adr));
    const losers = weekRows.filter((row) => row.trade_final_adr < 0);
    return {
      week_open_utc: week,
      weekly_hold_adr: total,
      positive_trades: weekRows.filter((row) => row.trade_final_adr > 0).length,
      negative_trades: losers.length,
      top1_trade_contribution_adr: top1,
      top3_trade_contribution_adr: top3,
      top5_trade_contribution_adr: top5,
      bottom5_trade_drag_adr: bottom5,
      average_loser_drag_adr: mean(losers.map((row) => row.trade_final_adr)),
      top1_share_of_week_adr: total > 0 ? round(top1 / total) : null,
      top3_share_of_week_adr: total > 0 ? round(top3 / total) : null,
      top5_share_of_week_adr: total > 0 ? round(top5 / total) : null,
      top_pairs: sorted.slice(0, 5).map((row) => ({ pair: row.pair, adr: row.trade_final_adr })),
      bottom_pairs: [...weekRows].sort((left, right) => left.trade_final_adr - right.trade_final_adr).slice(0, 5).map((row) => ({ pair: row.pair, adr: row.trade_final_adr })),
    };
  }).sort((left, right) => right.weekly_hold_adr - left.weekly_hold_adr);
  return {
    top_weeks: rows.length,
    average_positive_trades: mean(rows.map((row) => row.positive_trades)),
    average_negative_trades: mean(rows.map((row) => row.negative_trades)),
    average_top1_trade_contribution_adr: mean(rows.map((row) => row.top1_trade_contribution_adr)),
    average_top3_trade_contribution_adr: mean(rows.map((row) => row.top3_trade_contribution_adr)),
    average_top5_trade_contribution_adr: mean(rows.map((row) => row.top5_trade_contribution_adr)),
    average_bottom5_trade_drag_adr: mean(rows.map((row) => row.bottom5_trade_drag_adr)),
    average_top1_share_of_week_adr: mean(rows.map((row) => row.top1_share_of_week_adr ?? 0)),
    average_top3_share_of_week_adr: mean(rows.map((row) => row.top3_share_of_week_adr ?? 0)),
    average_top5_share_of_week_adr: mean(rows.map((row) => row.top5_share_of_week_adr ?? 0)),
    rows,
  };
}

function greenGivebackEndState(tradeRows: TradeLegCompositionRow[], classified: Gate73aClassifiedWeek[]) {
  const givebackWeeks = new Set(classified.filter((row) => row.green_then_giveback_week).map((row) => row.week_open_utc));
  const byWeek = groupBy(tradeRows.filter((row) => givebackWeeks.has(row.week_open_utc)), (row) => row.week_open_utc);
  const rows = [...byWeek.entries()].map(([week, weekRows]) => {
    const positives = weekRows.filter((row) => row.trade_final_adr > 0);
    const negatives = weekRows.filter((row) => row.trade_final_adr < 0);
    const positiveAdr = sum(positives.map((row) => row.trade_final_adr));
    const negativeAdr = sum(negatives.map((row) => row.trade_final_adr));
    const sortedPositive = sortedByFinalAdr(weekRows).filter((row) => row.trade_final_adr > 0);
    const top5PositiveAdr = sum(sortedPositive.slice(0, 5).map((row) => row.trade_final_adr));
    const dragAbs = Math.abs(negativeAdr);
    const source =
      positives.length <= 5 && positiveAdr > 0
        ? "few_surviving_leaders"
        : negatives.length >= 18 && dragAbs > positiveAdr
          ? "broad_laggard_drag"
          : positives.length >= 18 && negativeAdr > -1
            ? "broad_participation_low_drag"
            : "mixed_end_state";
    return {
      week_open_utc: week,
      basket_final_adr: sum(weekRows.map((row) => row.trade_final_adr)),
      positive_trades_at_friday: positives.length,
      negative_trades_at_friday: negatives.length,
      positive_trade_adr: positiveAdr,
      negative_trade_drag_adr: negativeAdr,
      top5_positive_trade_adr: top5PositiveAdr,
      top5_share_of_positive_adr: positiveAdr > 0 ? round(top5PositiveAdr / positiveAdr) : null,
      primary_end_state: source,
    };
  });
  const sourceCounts = Object.fromEntries([...groupBy(rows, (row) => row.primary_end_state).entries()].map(([source, sourceRows]) => [
    source,
    {
      weeks: sourceRows.length,
      rate: rate(sourceRows.length, rows.length),
      average_positive_trades_at_friday: mean(sourceRows.map((row) => row.positive_trades_at_friday)),
      average_negative_trades_at_friday: mean(sourceRows.map((row) => row.negative_trades_at_friday)),
      average_negative_trade_drag_adr: mean(sourceRows.map((row) => row.negative_trade_drag_adr)),
    },
  ]));
  return {
    green_then_giveback_weeks: rows.length,
    source_counts: sourceCounts,
    average_positive_trades_at_friday: mean(rows.map((row) => row.positive_trades_at_friday)),
    average_negative_trades_at_friday: mean(rows.map((row) => row.negative_trades_at_friday)),
    average_negative_trade_drag_adr: mean(rows.map((row) => row.negative_trade_drag_adr)),
    rows,
  };
}

function gate72ShortlistForensics(
  tradeRows: TradeLegCompositionRow[],
  classified: Gate73aClassifiedWeek[],
  weeklyRows: WeeklyMatrixRow[],
  shortlistRules: ShortlistRule[],
) {
  const top20Weeks = new Set([...classified].sort((left, right) => right.weekly_hold_adr - left.weekly_hold_adr).slice(0, 20).map((row) => row.week_open_utc));
  const byWeek = groupBy(tradeRows, (row) => row.week_open_utc);
  const matrixByKey = new Map(weeklyRows.map((row) => [key(row.week_open_utc, row.rule_id), row]));
  return shortlistRules.map((rule) => {
    const rows = [...byWeek.entries()].filter(([week]) => top20Weeks.has(week)).map(([week, weekRows]) => {
      const sorted = sortedByFinalAdr(weekRows);
      const exitRow = matrixByKey.get(key(week, rule.rule_id));
      const weeklyHoldAdr = sum(weekRows.map((row) => row.trade_final_adr));
      return {
        week_open_utc: week,
        weekly_hold_adr: weeklyHoldAdr,
        exit_adr: exitRow?.exit_adr ?? null,
        weekly_hold_minus_exit_adr: exitRow ? round(weeklyHoldAdr - exitRow.exit_adr) : null,
        positive_trade_count_at_friday: weekRows.filter((row) => row.trade_final_adr > 0).length,
        top5_trade_final_adr: sum(sorted.slice(0, 5).map((row) => row.trade_final_adr)),
        top5_share_of_week_adr: weeklyHoldAdr > 0 ? round(sum(sorted.slice(0, 5).map((row) => row.trade_final_adr)) / weeklyHoldAdr) : null,
      };
    }).sort((left, right) => (right.weekly_hold_minus_exit_adr ?? 0) - (left.weekly_hold_minus_exit_adr ?? 0));
    return {
      rule_id: rule.rule_id,
      family: rule.family,
      top20_weekly_hold_minus_exit_adr: sum(rows.map((row) => row.weekly_hold_minus_exit_adr ?? 0)),
      average_top5_share_of_week_adr_in_damaged_weeks: mean(rows.filter((row) => (row.weekly_hold_minus_exit_adr ?? 0) > 0).map((row) => row.top5_share_of_week_adr ?? 0)),
      clipped_top20_weeks: rows.filter((row) => (row.weekly_hold_minus_exit_adr ?? 0) > 0).length,
      top_damage_weeks: rows.slice(0, 10),
    };
  });
}

function pathTimingGapArtifact(options: {
  attemptedRawPathSmokeTimedOut: boolean;
  pairWeekOutcomeWarehouseId: string;
  basketWarehouseManifestId: string;
}) {
  return {
    verdict: "TRADE_LEG_PATH_TIMING_NOT_DURABLY_AVAILABLE_FROM_EXISTING_WAREHOUSE",
    available_now: [
      "week x pair final weekly-hold ADR from pair-week path outcome warehouse",
      "basket-level MFE/MAE/timestamp anatomy from Gate 71B/Gate 73A",
      "Gate 72 shortlist weekly exit timestamps and final exit ADR",
    ],
    not_available_without_new_materialization: [
      "trade-level MFE and MAE timestamps",
      "trade contribution at basket MFE",
      "live checkpoint runner identification by pair",
      "trade-level recovery after adverse threshold",
      "trade-level source split of green-then-giveback weeks",
    ],
    governance_requirement_before_dynamic_trade_exit_matrix:
      "Create a versioned trade-leg path warehouse, or restrict Gate 73C to hypotheses answerable by current warehouses. Do not run repeated raw M1 scans for dynamic exit testing.",
    raw_path_smoke: {
      attempted_this_turn: options.attemptedRawPathSmokeTimedOut,
      result: options.attemptedRawPathSmokeTimedOut
        ? "A two-week direct SQL trade-leg path smoke timed out at the tool limit; this confirms the need for durable materialization before path-timing diagnostics."
        : "Not attempted.",
    },
    existing_pair_week_outcome_warehouse_id: options.pairWeekOutcomeWarehouseId,
    existing_basket_path_warehouse_manifest_id: options.basketWarehouseManifestId,
  };
}

function recommendation(topWinner: ReturnType<typeof topWinnerDecomposition>, giveback: ReturnType<typeof greenGivebackEndState>) {
  return {
    next_gate_recommendation: "Gate 73C: choose between trade-leg path warehouse materialization or small warehouse-answerable lifecycle matrix",
    preferred_next_step:
      "Build a durable trade-leg path warehouse if Freedom wants checkpoint/timing diagnostics; otherwise keep Gate 73C limited to final-composition-informed, basket-aware hypotheses.",
    supported_exit_design_shape: [
      "basket-aware trade-level lifecycle",
      "common rules across all pairs",
      "profit-armed before dead-leg removal",
      "runner preservation as hard metric",
      "close-all only as broad deterioration response",
    ],
    metrics_required_for_any_future_exit_candidate: [
      "top-20 winner retention ratio",
      "total ADR retention",
      "profit factor",
      "worst-week and worst-5-week tail risk",
      "year stability",
      "no pair-specific or regime-specific parameters",
    ],
    caveats: [
      `Top winners have average top-5 share ${topWinner.average_top5_share_of_week_adr}; this supports runner preservation but does not prove live runner identifiability.`,
      `Green-giveback end-state source counts are ${JSON.stringify(giveback.source_counts)}; path-timing materialization is needed before dead-leg or leader-trail rules are trusted.`,
    ],
    forbidden_next_steps: [
      "no broad dynamic-exit optimization",
      "no pair-specific tuning",
      "no Candidate B mutation",
      "no risk layer",
      "no fair-value pruning",
      "no promotion",
      "no MT5/live/runtime work",
    ],
  };
}

function renderReport(summary: Record<string, unknown>, topWinner: Record<string, unknown>, giveback: Record<string, unknown>, timingGap: Record<string, unknown>) {
  const sourceCounts = giveback.source_counts as Record<string, unknown>;
  return [
    "# Gate 73B Trade-Leg Anatomy and Runner-Preserving Exit Design Preflight",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Uses existing materialized warehouses only: Gate 57 pair-week outcomes, Gate 71B-M basket path warehouse, Gate 71B basket diagnostics, Gate 72 matrix rows, and Gate 73A path classes.",
    "- Measures Candidate B final week x pair contribution composition for top winners and green-then-giveback weeks.",
    "- Converts Gate 72 shortlist damage into final trade-leg composition clues.",
    "- Does not score new exits, optimize thresholds, mutate Candidate B, open risk, or promote an exit.",
    "",
    "## Key Finding",
    "",
    String(summary.key_finding),
    "",
    "## Top-Winner Decomposition",
    "",
    "```json",
    JSON.stringify({
      top_weeks: topWinner.top_weeks,
      average_positive_trades: topWinner.average_positive_trades,
      average_top1_share_of_week_adr: topWinner.average_top1_share_of_week_adr,
      average_top3_share_of_week_adr: topWinner.average_top3_share_of_week_adr,
      average_top5_share_of_week_adr: topWinner.average_top5_share_of_week_adr,
      average_bottom5_trade_drag_adr: topWinner.average_bottom5_trade_drag_adr,
    }, null, 2),
    "```",
    "",
    "## Green-Giveback End-State",
    "",
    "```json",
    JSON.stringify({
      green_then_giveback_weeks: giveback.green_then_giveback_weeks,
      source_counts: sourceCounts,
      average_positive_trades_at_friday: giveback.average_positive_trades_at_friday,
      average_negative_trades_at_friday: giveback.average_negative_trades_at_friday,
      average_negative_trade_drag_adr: giveback.average_negative_trade_drag_adr,
    }, null, 2),
    "```",
    "",
    "## Path Timing Gap",
    "",
    "```json",
    JSON.stringify(timingGap, null, 2),
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
    `- Trade-leg final composition ledger: \`${summary.artifacts["tradeLegFinalCompositionLedger"]}\``,
    `- Top-winner decomposition: \`${summary.artifacts["topWinnerDecomposition"]}\``,
    `- Green-giveback end-state composition: \`${summary.artifacts["greenGivebackEndStateComposition"]}\``,
    `- Gate 72 final-composition forensics: \`${summary.artifacts["gate72FinalCompositionForensics"]}\``,
    `- Trade-leg path timing gap: \`${summary.artifacts["tradeLegPathTimingGap"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
    "## Stop Line",
    "",
    "Gate 73B is diagnostic/design preflight only. Gate 73C is not opened by this receipt.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  if (options.maxWeeks !== null && (!Number.isInteger(options.maxWeeks) || options.maxWeeks <= 0)) {
    throw new Error(`Invalid --max-weeks: ${options.maxWeeks}`);
  }
  const startedAt = Date.now();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const decisions = await loadCandidateBRows(options.candidateBLedgerPath);
  const denominator = validateCandidateBRows(decisions);
  const candidateBLedgerHash = (await fileHash(options.candidateBLedgerPath)).toUpperCase();
  const diagnostics = await readJsonl<BasketPathDiagnosticRow>(options.diagnosticsPath);
  const classified = await readJsonl<Gate73aClassifiedWeek>(options.classificationPath);
  const weeklyRows = await readJsonl<WeeklyMatrixRow>(options.weeklyRowsPath);
  const shortlistRules = await readJson<ShortlistRule[]>(options.shortlistPath);
  const gate71bm = await readJson<Gate71bmSummary>(options.gate71bmSummaryPath);
  const selectedWeeks = groupCandidateBRowsByWeek(decisions).slice(0, options.maxWeeks ?? undefined).map(([week]) => week);
  const selectedWeekSet = new Set(selectedWeeks);
  const selectedDecisions = decisions.filter((row) => selectedWeekSet.has(row.week_open_utc));
  const symbols = Array.from(new Set(decisions.map((row) => row.symbol.toUpperCase()))).sort();
  const outcomesByKey = await loadPairWeekOutcomeRows({
    warehouseId: options.pairWeekOutcomeWarehouseId,
    weeks: selectedWeeks,
    symbols,
  });
  const diagnosticsByWeek = new Map(diagnostics.map((row) => [row.week_open_utc, row]));
  const classifiedByWeek = new Map(classified.map((row) => [row.week_open_utc, row]));
  const selectedClassified = classified.filter((row) => selectedWeekSet.has(row.week_open_utc));
  const selectedWeeklyRows = weeklyRows.filter((row) => selectedWeekSet.has(row.week_open_utc));
  const tradeRows = buildTradeLegRows({
    decisions: selectedDecisions,
    outcomesByKey,
    diagnosticsByWeek,
    classifiedByWeek,
    candidateBLedgerHash,
    pairWeekOutcomeWarehouseId: options.pairWeekOutcomeWarehouseId,
    basketWarehouse: gate71bm.warehouse,
  });
  const byWeek = groupBy(tradeRows, (row) => row.week_open_utc);
  const weeklyDeltaRows = [...byWeek.entries()].map(([week, rows]) => {
    const reconstructed = sum(rows.map((row) => row.trade_final_adr));
    const expected = diagnosticsByWeek.get(week)?.friday_close_adr ?? 0;
    return {
      week_open_utc: week,
      reconstructed_pair_week_final_adr: reconstructed,
      basket_path_friday_close_adr: expected,
      abs_delta_adr: round(Math.abs(reconstructed - expected)) ?? 0,
    };
  });
  const weeklyDeltas = weeklyDeltaRows.map((row) => row.abs_delta_adr);
  const topWinner = topWinnerDecomposition(tradeRows, selectedClassified);
  const giveback = greenGivebackEndState(tradeRows, selectedClassified);
  const gate72Forensics = gate72ShortlistForensics(tradeRows, selectedClassified, selectedWeeklyRows, shortlistRules);
  const timingGap = pathTimingGapArtifact({
    attemptedRawPathSmokeTimedOut: true,
    pairWeekOutcomeWarehouseId: options.pairWeekOutcomeWarehouseId,
    basketWarehouseManifestId: gate71bm.warehouse.manifest_id,
  });
  const runtimeSeconds = round((Date.now() - startedAt) / 1000) ?? 0;
  const artifacts = {
    tradeLegFinalCompositionLedger: toRepoRelative(path.join(artifactDir, "trade-leg-final-composition.rows.jsonl")),
    topWinnerDecomposition: toRepoRelative(path.join(artifactDir, "top-winner-decomposition.json")),
    greenGivebackEndStateComposition: toRepoRelative(path.join(artifactDir, "green-giveback-endstate-composition.json")),
    gate72FinalCompositionForensics: toRepoRelative(path.join(artifactDir, "gate72-shortlist-final-composition-forensics.json")),
    tradeLegPathTimingGap: toRepoRelative(path.join(artifactDir, "trade-leg-path-timing-gap.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate73b-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate73b-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const validation = {
    candidate_b_forced28_preserved: denominator.forced28_preserved,
    candidate_b_ledger_hash_matches_gate71bm: candidateBLedgerHash === gate71bm.warehouse.candidate_b_ledger_hash,
    gate71bm_passed: gate71bm.verdict.startsWith("PASS_"),
    basket_path_warehouse_manifest_id: gate71bm.warehouse.manifest_id,
    basket_path_warehouse_hash: gate71bm.warehouse.warehouse_hash,
    pair_week_outcome_warehouse_id: options.pairWeekOutcomeWarehouseId,
    pair_week_final_composition_used: true,
    raw_m1_source_rebuild_performed: false,
    direct_trade_leg_path_timing_materialized: false,
    new_exit_rules_scored: false,
    exit_promotion_performed: false,
    risk_layer_started: false,
    brain_truth_mutated: false,
    weeks_reviewed: selectedWeeks.length,
    expected_weeks: options.maxWeeks ?? GATE71_EXPECTED_WEEKS,
    trade_leg_rows: tradeRows.length,
    expected_trade_leg_rows: (options.maxWeeks ?? GATE71_EXPECTED_WEEKS) * GATE71_EXPECTED_SYMBOLS_PER_WEEK,
    candidate_b_rows_total: decisions.length,
    expected_candidate_b_rows_total: GATE71_EXPECTED_ROWS,
    missing_price_trade_rows: tradeRows.filter((row) => row.missing_price).length,
    default_adr_trade_rows: tradeRows.filter((row) => row.default_adr).length,
    reconstruction_tolerance_adr: 0.3,
    max_weekly_reconstruction_abs_delta_adr: round(Math.max(...weeklyDeltas)),
    average_weekly_reconstruction_abs_delta_adr: mean(weeklyDeltas),
    largest_weekly_reconstruction_deltas: [...weeklyDeltaRows].sort((left, right) => right.abs_delta_adr - left.abs_delta_adr).slice(0, 10),
    shortlist_rule_count: shortlistRules.length,
    runtime_seconds: runtimeSeconds,
  };
  const pass =
    validation.candidate_b_forced28_preserved &&
    validation.candidate_b_ledger_hash_matches_gate71bm &&
    validation.gate71bm_passed &&
    validation.weeks_reviewed === validation.expected_weeks &&
    validation.trade_leg_rows === validation.expected_trade_leg_rows &&
    validation.missing_price_trade_rows === 0 &&
    validation.max_weekly_reconstruction_abs_delta_adr <= validation.reconstruction_tolerance_adr &&
    validation.raw_m1_source_rebuild_performed === false &&
    validation.new_exit_rules_scored === false &&
    validation.exit_promotion_performed === false &&
    validation.risk_layer_started === false &&
    validation.brain_truth_mutated === false;
  const gate73bRecommendation = recommendation(topWinner, giveback);
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_GATE73B_TRADE_LEG_COMPOSITION_PREFLIGHT__FINAL_COMPOSITION_VISIBLE_PATH_TIMING_GAP_BOUND"
      : "FAIL_GATE73B_TRADE_LEG_COMPOSITION_PREFLIGHT",
    key_finding: `Top-20 winners average ${topWinner.average_positive_trades} positive trades and ${topWinner.average_top5_share_of_week_adr} of week ADR from the top 5 final trade legs. Existing warehouses can support final-composition diagnostics, but not live trade-leg path timing; dynamic trade exits need a dedicated trade-leg path warehouse or must stay hypothesis-led and narrow.`,
    validation,
    top_winner_decomposition_summary: {
      top_weeks: topWinner.top_weeks,
      average_positive_trades: topWinner.average_positive_trades,
      average_top1_share_of_week_adr: topWinner.average_top1_share_of_week_adr,
      average_top3_share_of_week_adr: topWinner.average_top3_share_of_week_adr,
      average_top5_share_of_week_adr: topWinner.average_top5_share_of_week_adr,
      average_bottom5_trade_drag_adr: topWinner.average_bottom5_trade_drag_adr,
    },
    green_giveback_endstate_summary: {
      green_then_giveback_weeks: giveback.green_then_giveback_weeks,
      source_counts: giveback.source_counts,
      average_positive_trades_at_friday: giveback.average_positive_trades_at_friday,
      average_negative_trades_at_friday: giveback.average_negative_trades_at_friday,
      average_negative_trade_drag_adr: giveback.average_negative_trade_drag_adr,
    },
    recommendation: gate73bRecommendation,
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "trade-leg-final-composition.rows.jsonl"), tradeRows);
  await writeJson(path.join(artifactDir, "top-winner-decomposition.json"), topWinner);
  await writeJson(path.join(artifactDir, "green-giveback-endstate-composition.json"), giveback);
  await writeJson(path.join(artifactDir, "gate72-shortlist-final-composition-forensics.json"), gate72Forensics);
  await writeJson(path.join(artifactDir, "trade-leg-path-timing-gap.json"), timingGap);
  await writeJson(path.join(artifactDir, "gate73b-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, topWinner, giveback, timingGap));
  await writeShaManifest(path.join(artifactDir, "gate73b-sha256.txt"), GATE_ID, COMMAND, [
    { label: "trade_leg_final_composition", path: path.join(artifactDir, "trade-leg-final-composition.rows.jsonl") },
    { label: "top_winner_decomposition", path: path.join(artifactDir, "top-winner-decomposition.json") },
    { label: "green_giveback_endstate_composition", path: path.join(artifactDir, "green-giveback-endstate-composition.json") },
    { label: "gate72_final_composition_forensics", path: path.join(artifactDir, "gate72-shortlist-final-composition-forensics.json") },
    { label: "trade_leg_path_timing_gap", path: path.join(artifactDir, "trade-leg-path-timing-gap.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate73b-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ validation, recommendation: gate73bRecommendation, artifacts }, null, 2));
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
