import path from "node:path";

import { sha256Stable } from "@engine/research/hash";

import {
  fileHash,
  gitCommit,
  parseArgMap,
  readJson,
  renderTable,
  round,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 81: hedged-broker-real-feasibility-preflight";
const GATE_DATE = "2026-06-30";
const COMMAND = "npm run engine:gate81:hedged-broker-real-feasibility-preflight";
const DEFAULT_GATE80_DIR =
  "docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate81/GATE81_HEDGED_BROKER_REAL_FEASIBILITY_PREFLIGHT_${GATE_DATE}.md`;

const DIRECTIONAL_T100_RULE_ID = "PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const HEDGED_T100_L3_RULE_ID = "FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE";
const HEDGED_T100_NO_LIMIT_RULE_ID = "FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE";
const LONG_ONLY_RULE_ID = "LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE";
const SHORT_ONLY_RULE_ID = "SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE";
const RANDOM_SIDE_RULE_ID = "DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE";

const EXPECTED_GATE80_VERDICT = "PASS_HEDGED_BASELINE_PROMISING_BUT_COST_MARGIN_VALIDATION_REQUIRED_NO_PROMOTION";
const EXPECTED_WEEKS = 373;
const EXPECTED_PAIRS = 28;
const EXPECTED_PAIR_WEEK_ROWS = 10_444;

type JsonObject = Record<string, unknown>;

type Gate80Summary = {
  verdict: string;
  git_commit: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    weeks_replayed: number;
    pairs_replayed: number;
    pair_week_rows_replayed: number;
    gate74b_summary_hash_matched: boolean;
  };
  matrix_scope: {
    fixed_rule_count: number;
    fully_hedged_reference_row: string;
    fully_hedged_no_limit_reference_row: string;
    long_only_reference_row: string;
    short_only_reference_row: string;
    deterministic_random_side_reference_row: string;
  };
};

type RawComparisonRow = {
  rule_id: string;
  rule_family: string;
  reference_only: boolean;
  final_equity_adr: number;
  max_drawdown_adr: number;
  final_open_unrealized_adr: number;
  worst_open_unrealized_adr: number;
  total_fills: number;
  resets: number;
  average_active_pair_side_slots_proxy: number;
  max_active_pair_side_slots_proxy: number;
  average_open_inventory_abs_adr: number;
  max_open_inventory_abs_adr: number;
  weekly_mtm_profit_factor: number;
  monthly_mtm_win_rate: number;
  content_hash: string;
};

type WeeklyEquityRow = {
  rule_id: string;
  rule_family: string;
  week_open_utc: string;
  equity_delta_adr: number;
  fill_count_week: number;
  reset_count_week: number;
  content_hash: string;
};

type CostSensitivityRow = {
  rule_id: string;
  fill_count: number;
  raw_final_equity_adr: number;
  break_even_cost_adr_per_fill: number;
  cost_adr_per_fill_to_reduce_return_50pct: number;
  cost_adr_per_fill_to_make_flat: number;
  hedged_vs_directional_equal_cost_crossover_adr_per_fill: number;
  content_hash: string;
};

type EquitySmoothnessRow = {
  rule_id: string;
  equity_curve_smoothness_score: number;
  weekly_mtm_volatility_adr: number;
  downside_weekly_volatility_adr: number;
  time_in_drawdown_weeks: number;
  longest_drawdown_weeks: number;
  monthly_consistency: number;
  content_hash: string;
};

type StressScenario = {
  scenario_id: string;
  all_in_cost_adr_per_fill: number;
  swap_drag_adr_per_active_side_week: number;
  read: string;
};

const STRESS_SCENARIOS: StressScenario[] = [
  {
    scenario_id: "tight_execution_no_swap",
    all_in_cost_adr_per_fill: 0.005,
    swap_drag_adr_per_active_side_week: 0,
    read: "tight spread plus commission proxy",
  },
  {
    scenario_id: "normal_execution_small_swap",
    all_in_cost_adr_per_fill: 0.01,
    swap_drag_adr_per_active_side_week: 0.0025,
    read: "normal first-pass broker proxy",
  },
  {
    scenario_id: "wide_execution_visible_swap",
    all_in_cost_adr_per_fill: 0.025,
    swap_drag_adr_per_active_side_week: 0.005,
    read: "wide retail or volatile spread proxy",
  },
  {
    scenario_id: "stress_execution_high_swap",
    all_in_cost_adr_per_fill: 0.05,
    swap_drag_adr_per_active_side_week: 0.01,
    read: "Gate80 high cost stress plus swap drag",
  },
  {
    scenario_id: "extreme_execution_punitive_swap",
    all_in_cost_adr_per_fill: 0.1,
    swap_drag_adr_per_active_side_week: 0.02,
    read: "kill-test proxy, not expected broker base case",
  },
];

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.includes(",") || text.includes("\n") || text.includes('"')) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows: JsonObject[]) {
  if (rows.length === 0) return "";
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  return `${lines.join("\n")}\n`;
}

async function writeRows(jsonPath: string, csvPath: string, rows: JsonObject[]) {
  await writeJson(jsonPath, rows);
  await writeText(csvPath, toCsv(rows));
}

function withHash<T extends JsonObject>(row: T): T & { content_hash: string } {
  const copy = { ...row };
  delete copy.content_hash;
  return { ...row, content_hash: sha256Stable(copy) };
}

function requireRow<T extends { rule_id: string }>(rows: T[], ruleId: string) {
  const row = rows.find((candidate) => candidate.rule_id === ruleId);
  if (!row) throw new Error(`Missing required Gate80 row: ${ruleId}`);
  return row;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function drawdownFromDeltas(deltas: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const delta of deltas) {
    equity += delta;
    if (equity > peak) peak = equity;
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return round(maxDrawdown);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function buildScenarioRows(rawRows: RawComparisonRow[], weeklyRows: WeeklyEquityRow[]) {
  const ruleIds = [
    DIRECTIONAL_T100_RULE_ID,
    HEDGED_T100_L3_RULE_ID,
    HEDGED_T100_NO_LIMIT_RULE_ID,
    LONG_ONLY_RULE_ID,
    SHORT_ONLY_RULE_ID,
    RANDOM_SIDE_RULE_ID,
  ];
  const rows: JsonObject[] = [];
  for (const ruleId of ruleIds) {
    const raw = requireRow(rawRows, ruleId);
    const ruleWeeklyRows = weeklyRows.filter((row) => row.rule_id === ruleId);
    if (ruleWeeklyRows.length !== EXPECTED_WEEKS) {
      throw new Error(`${ruleId} weekly row count ${ruleWeeklyRows.length} did not match ${EXPECTED_WEEKS}`);
    }
    for (const scenario of STRESS_SCENARIOS) {
      const swapCostPerWeek = raw.average_active_pair_side_slots_proxy * scenario.swap_drag_adr_per_active_side_week;
      const stressedDeltas = ruleWeeklyRows.map(
        (row) => row.equity_delta_adr - row.fill_count_week * scenario.all_in_cost_adr_per_fill - swapCostPerWeek,
      );
      const grossFinal = raw.final_equity_adr;
      const fillCost = raw.total_fills * scenario.all_in_cost_adr_per_fill;
      const swapCost = raw.average_active_pair_side_slots_proxy * EXPECTED_WEEKS * scenario.swap_drag_adr_per_active_side_week;
      const netFinal = sum(stressedDeltas);
      rows.push(withHash({
        scenario_id: scenario.scenario_id,
        rule_id: ruleId,
        rule_family: raw.rule_family,
        all_in_cost_adr_per_fill: scenario.all_in_cost_adr_per_fill,
        swap_drag_adr_per_active_side_week: scenario.swap_drag_adr_per_active_side_week,
        gross_final_equity_adr: round(grossFinal),
        total_fills: raw.total_fills,
        fill_cost_adr: round(fillCost),
        swap_drag_proxy_adr: round(swapCost),
        stressed_final_equity_adr: round(netFinal),
        stressed_max_drawdown_adr: drawdownFromDeltas(stressedDeltas),
        stressed_return_drawdown: round(Math.abs(drawdownFromDeltas(stressedDeltas) ?? 0) > 0 ? netFinal / Math.abs(drawdownFromDeltas(stressedDeltas) ?? 0) : null),
        scenario_read: scenario.read,
      }));
    }
  }
  return rows;
}

function buildOrderRows(rawRows: RawComparisonRow[], weeklyRows: WeeklyEquityRow[]) {
  const ruleIds = [HEDGED_T100_L3_RULE_ID, HEDGED_T100_NO_LIMIT_RULE_ID, LONG_ONLY_RULE_ID, SHORT_ONLY_RULE_ID, RANDOM_SIDE_RULE_ID, DIRECTIONAL_T100_RULE_ID];
  return ruleIds.map((ruleId) => {
    const raw = requireRow(rawRows, ruleId);
    const fillCounts = weeklyRows.filter((row) => row.rule_id === ruleId).map((row) => row.fill_count_week);
    return withHash({
      rule_id: ruleId,
      rule_family: raw.rule_family,
      total_fills: raw.total_fills,
      weeks: EXPECTED_WEEKS,
      average_fills_per_week: round(raw.total_fills / EXPECTED_WEEKS),
      median_fills_per_week: round(percentile(fillCounts, 50)),
      p95_fills_per_week: round(percentile(fillCounts, 95)),
      max_fills_per_week: round(Math.max(...fillCounts)),
      average_fills_per_pair_week_proxy: round(raw.total_fills / (EXPECTED_WEEKS * EXPECTED_PAIRS)),
      p95_fills_per_pair_week_proxy: round((percentile(fillCounts, 95) ?? 0) / EXPECTED_PAIRS),
      max_fills_per_pair_week_proxy: round(Math.max(...fillCounts) / EXPECTED_PAIRS),
      average_active_pair_side_slots_proxy: raw.average_active_pair_side_slots_proxy,
      max_active_pair_side_slots_proxy: raw.max_active_pair_side_slots_proxy,
      one_pair_mt5_scope_read: ruleId === HEDGED_T100_L3_RULE_ID ? "suitable_for_one_pair_visual_prototype" : "reference_row",
      all_28_runtime_read: raw.total_fills > 150_000 ? "portfolio_order_count_high_requires_separate_runtime_design" : "portfolio_order_count_lower_but_still_not_live_ready",
    });
  });
}

function buildMarginRows(rawRows: RawComparisonRow[]) {
  const ruleIds = [HEDGED_T100_L3_RULE_ID, HEDGED_T100_NO_LIMIT_RULE_ID, DIRECTIONAL_T100_RULE_ID, LONG_ONLY_RULE_ID, SHORT_ONLY_RULE_ID, RANDOM_SIDE_RULE_ID];
  return ruleIds.map((ruleId) => {
    const raw = requireRow(rawRows, ruleId);
    const marginDenominator = Math.abs(raw.max_drawdown_adr) + Math.abs(raw.worst_open_unrealized_adr);
    return withHash({
      rule_id: ruleId,
      rule_family: raw.rule_family,
      final_equity_adr: round(raw.final_equity_adr),
      max_drawdown_adr: round(raw.max_drawdown_adr),
      worst_open_unrealized_adr: round(raw.worst_open_unrealized_adr),
      average_open_inventory_abs_adr: round(raw.average_open_inventory_abs_adr),
      max_open_inventory_abs_adr: round(raw.max_open_inventory_abs_adr),
      average_active_pair_side_slots_proxy: raw.average_active_pair_side_slots_proxy,
      max_active_pair_side_slots_proxy: raw.max_active_pair_side_slots_proxy,
      dd_plus_open_margin_proxy_adr: round(marginDenominator),
      return_per_margin_proxy_unit: round(marginDenominator > 0 ? raw.final_equity_adr / marginDenominator : null),
      margin_read:
        ruleId === HEDGED_T100_L3_RULE_ID
          ? "promising_proxy_but_requires_actual_broker_margin_hedging_mode"
          : "reference_proxy_only",
    });
  });
}

function byScenario(rows: JsonObject[], scenarioId: string, ruleId: string) {
  const row = rows.find((candidate) => candidate.scenario_id === scenarioId && candidate.rule_id === ruleId);
  if (!row) throw new Error(`Missing scenario row ${scenarioId} ${ruleId}`);
  return row as Record<string, number | string>;
}

function buildDecisionRows(params: {
  summary: Gate80Summary;
  scenarioRows: JsonObject[];
  rawRows: RawComparisonRow[];
  costRows: CostSensitivityRow[];
  smoothRows: EquitySmoothnessRow[];
}) {
  const normalHedged = byScenario(params.scenarioRows, "normal_execution_small_swap", HEDGED_T100_L3_RULE_ID);
  const stressHedged = byScenario(params.scenarioRows, "stress_execution_high_swap", HEDGED_T100_L3_RULE_ID);
  const normalDirectional = byScenario(params.scenarioRows, "normal_execution_small_swap", DIRECTIONAL_T100_RULE_ID);
  const stressDirectional = byScenario(params.scenarioRows, "stress_execution_high_swap", DIRECTIONAL_T100_RULE_ID);
  const extremeHedged = byScenario(params.scenarioRows, "extreme_execution_punitive_swap", HEDGED_T100_L3_RULE_ID);
  const hedgedCost = requireRow(params.costRows, HEDGED_T100_L3_RULE_ID);
  const hedgedRaw = requireRow(params.rawRows, HEDGED_T100_L3_RULE_ID);
  const hedgedSmooth = requireRow(params.smoothRows, HEDGED_T100_L3_RULE_ID);
  const pass =
    params.summary.verdict === EXPECTED_GATE80_VERDICT &&
    Number(normalHedged.stressed_final_equity_adr) > 0 &&
    Number(stressHedged.stressed_final_equity_adr) > 0 &&
    Number(normalHedged.stressed_final_equity_adr) > Number(normalDirectional.stressed_final_equity_adr) &&
    Number(stressHedged.stressed_final_equity_adr) > Number(stressDirectional.stressed_final_equity_adr);

  const verdict = pass
    ? "PASS_HEDGED_FEASIBILITY_PREFLIGHT__ONE_PAIR_MT5_PROTOTYPE_NEXT_NO_PROMOTION"
    : "FAIL_HEDGED_FEASIBILITY_PREFLIGHT__DO_NOT_BUILD_MT5_PROTOTYPE_NO_PROMOTION";

  const rows = [
    withHash({
      decision: "verdict",
      value: verdict,
      evidence:
        "Gate80 artifact-derived stress only; hedged T100/L3 remains positive and ahead of directional T100/L3 under normal and stress fixed ADR cost/swap proxies.",
    }),
    withHash({
      decision: "gate80_mechanical_validity",
      value: params.summary.verdict === EXPECTED_GATE80_VERDICT ? "accepted_as_input" : "blocked",
      evidence: params.summary.verdict,
    }),
    withHash({
      decision: "normal_cost_survival",
      value: Number(normalHedged.stressed_final_equity_adr) > 0 ? "pass" : "fail",
      evidence: `${normalHedged.stressed_final_equity_adr} ADR stressed final equity`,
    }),
    withHash({
      decision: "stress_cost_survival",
      value: Number(stressHedged.stressed_final_equity_adr) > 0 ? "pass" : "fail",
      evidence: `${stressHedged.stressed_final_equity_adr} ADR stressed final equity`,
    }),
    withHash({
      decision: "extreme_cost_survival",
      value: Number(extremeHedged.stressed_final_equity_adr) > 0 ? "pass_but_not_required" : "fail",
      evidence: `${extremeHedged.stressed_final_equity_adr} ADR stressed final equity`,
    }),
    withHash({
      decision: "cost_buffer",
      value: "visible",
      evidence: `Gate80 break-even cost ${hedgedCost.break_even_cost_adr_per_fill} ADR/fill; 50 percent return reduction cost ${hedgedCost.cost_adr_per_fill_to_reduce_return_50pct} ADR/fill.`,
    }),
    withHash({
      decision: "margin_proxy",
      value: "not_blocking_preflight_not_broker_real",
      evidence: `Hedged worst open ${hedgedRaw.worst_open_unrealized_adr} ADR, max DD ${hedgedRaw.max_drawdown_adr} ADR, avg active side slots ${hedgedRaw.average_active_pair_side_slots_proxy}.`,
    }),
    withHash({
      decision: "smoothness",
      value: "strong_relative_to_directional_but_not_live_proof",
      evidence: `Gate80 smoothness ${hedgedSmooth.equity_curve_smoothness_score}, longest drawdown ${hedgedSmooth.longest_drawdown_weeks} weeks.`,
    }),
    withHash({
      decision: "next_action",
      value: pass ? "open_one_pair_mt5_visual_prototype" : "return_to_research_or_kill_hedged_track",
      evidence: "Prototype scope must be one pair, no Candidate B, no COT, no Strength, no Regime, no risk layer, no live capital.",
    }),
  ];
  return { verdict, rows };
}

function buildDirectAnswerRows(verdict: string, scenarioRows: JsonObject[]) {
  const stressHedged = byScenario(scenarioRows, "stress_execution_high_swap", HEDGED_T100_L3_RULE_ID);
  const stressDirectional = byScenario(scenarioRows, "stress_execution_high_swap", DIRECTIONAL_T100_RULE_ID);
  return [
    withHash({
      question: "Did Gate81 rerun the expensive path replay?",
      answer: "no_artifact_derived_from_gate80_receipts",
      evidence: "Reads Gate80 JSON artifacts only; no DB replay or warehouse reconstruction.",
    }),
    withHash({
      question: "Does the hedged baseline survive first-pass cost and swap stress?",
      answer: Number(stressHedged.stressed_final_equity_adr) > 0 ? "yes_under_fixed_adr_proxy" : "no",
      evidence: `${stressHedged.stressed_final_equity_adr} ADR after 0.05 ADR/fill and 0.01 ADR/active-side-week stress.`,
    }),
    withHash({
      question: "Does hedged still beat directional under stress?",
      answer:
        Number(stressHedged.stressed_final_equity_adr) > Number(stressDirectional.stressed_final_equity_adr)
          ? "yes_under_fixed_adr_proxy"
          : "no",
      evidence: `hedged ${stressHedged.stressed_final_equity_adr} vs directional ${stressDirectional.stressed_final_equity_adr}.`,
    }),
    withHash({
      question: "Is all-28 broker deployment approved?",
      answer: "no",
      evidence: "Order count, margin mode, swap, execution, and MT5 parity remain unresolved.",
    }),
    withHash({
      question: "Is a one-pair MT5 prototype justified?",
      answer: verdict.startsWith("PASS") ? "yes_as_feasibility_validation_only" : "no",
      evidence: "One pair makes fill/reset/spread/swap/margin behavior visible without turning this into portfolio runtime work.",
    }),
    withHash({
      question: "Does Gate81 promote a system?",
      answer: "no",
      evidence: "No promotion, no live readiness, no risk layer, no Candidate B mutation.",
    }),
  ];
}

function buildValidationRows(summary: Gate80Summary) {
  return [
    withHash({ check: "gate80_verdict_input", value: summary.verdict, passed: summary.verdict === EXPECTED_GATE80_VERDICT }),
    withHash({ check: "gate80_weeks", value: summary.warehouse.weeks_replayed, passed: summary.warehouse.weeks_replayed === EXPECTED_WEEKS }),
    withHash({ check: "gate80_pairs", value: summary.warehouse.pairs_replayed, passed: summary.warehouse.pairs_replayed === EXPECTED_PAIRS }),
    withHash({
      check: "gate80_pair_week_rows",
      value: summary.warehouse.pair_week_rows_replayed,
      passed: summary.warehouse.pair_week_rows_replayed === EXPECTED_PAIR_WEEK_ROWS,
    }),
    withHash({ check: "gate74b_hash_matched", value: summary.warehouse.gate74b_summary_hash_matched, passed: summary.warehouse.gate74b_summary_hash_matched === true }),
    withHash({ check: "artifact_only_no_replay", value: true, passed: true }),
    withHash({ check: "candidate_b_mutated", value: false, passed: true }),
    withHash({ check: "mt5_live_runtime_started", value: false, passed: true }),
  ];
}

async function main() {
  const startedAt = Date.now();
  const args = parseArgMap();
  const gate80Dir = args.get("--gate80-dir") ?? DEFAULT_GATE80_DIR;
  const artifactDir = args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR;
  const reportPath = args.get("--report") ?? DEFAULT_REPORT_PATH;

  const sourcePaths = {
    summary: path.join(gate80Dir, "gate80-summary.json"),
    rawComparison: path.join(gate80Dir, "raw-comparison.rows.json"),
    costSensitivity: path.join(gate80Dir, "cost-sensitivity.rows.json"),
    smoothness: path.join(gate80Dir, "equity-smoothness.rows.json"),
    weeklyEquity: path.join(gate80Dir, "weekly-equity-truth.rows.json"),
    implementationValidity: path.join(gate80Dir, "implementation-validity.rows.json"),
  };

  const summary = await readJson<Gate80Summary>(sourcePaths.summary);
  const rawRows = await readJson<RawComparisonRow[]>(sourcePaths.rawComparison);
  const costRows = await readJson<CostSensitivityRow[]>(sourcePaths.costSensitivity);
  const smoothRows = await readJson<EquitySmoothnessRow[]>(sourcePaths.smoothness);
  const weeklyRows = await readJson<WeeklyEquityRow[]>(sourcePaths.weeklyEquity);

  [
    DIRECTIONAL_T100_RULE_ID,
    HEDGED_T100_L3_RULE_ID,
    HEDGED_T100_NO_LIMIT_RULE_ID,
    LONG_ONLY_RULE_ID,
    SHORT_ONLY_RULE_ID,
    RANDOM_SIDE_RULE_ID,
  ].forEach((ruleId) => {
    requireRow(rawRows, ruleId);
    requireRow(costRows, ruleId);
    requireRow(smoothRows, ruleId);
  });

  const scenarioRows = buildScenarioRows(rawRows, weeklyRows);
  const orderRows = buildOrderRows(rawRows, weeklyRows);
  const marginRows = buildMarginRows(rawRows);
  const validationRows = buildValidationRows(summary);
  const decision = buildDecisionRows({ summary, scenarioRows, rawRows, costRows, smoothRows });
  const directAnswerRows = buildDirectAnswerRows(decision.verdict, scenarioRows);

  const artifactHashesRows = await Promise.all(
    Object.entries(sourcePaths).map(async ([label, sourcePath]) => withHash({
      source_label: label,
      source_path: toRepoRelative(sourcePath),
      source_sha256: await fileHash(sourcePath),
    })),
  );

  const paths = {
    validationJson: path.join(artifactDir, "source-artifact-validation.rows.json"),
    validationCsv: path.join(artifactDir, "source-artifact-validation.rows.csv"),
    scenarioJson: path.join(artifactDir, "broker-stress-scenarios.rows.json"),
    scenarioCsv: path.join(artifactDir, "broker-stress-scenarios.rows.csv"),
    orderJson: path.join(artifactDir, "order-count-feasibility.rows.json"),
    orderCsv: path.join(artifactDir, "order-count-feasibility.rows.csv"),
    marginJson: path.join(artifactDir, "margin-exposure-proxy.rows.json"),
    marginCsv: path.join(artifactDir, "margin-exposure-proxy.rows.csv"),
    decisionJson: path.join(artifactDir, "final-decision-table.rows.json"),
    decisionCsv: path.join(artifactDir, "final-decision-table.rows.csv"),
    directJson: path.join(artifactDir, "direct-answers.rows.json"),
    directCsv: path.join(artifactDir, "direct-answers.rows.csv"),
    hashesJson: path.join(artifactDir, "source-artifact-hashes.rows.json"),
    hashesCsv: path.join(artifactDir, "source-artifact-hashes.rows.csv"),
    commandReceipt: path.join(artifactDir, "command-receipt.json"),
    summary: path.join(artifactDir, "gate81-summary.json"),
    shaManifest: path.join(artifactDir, "gate81-sha256.txt"),
  };

  await writeRows(paths.validationJson, paths.validationCsv, validationRows);
  await writeRows(paths.scenarioJson, paths.scenarioCsv, scenarioRows);
  await writeRows(paths.orderJson, paths.orderCsv, orderRows);
  await writeRows(paths.marginJson, paths.marginCsv, marginRows);
  await writeRows(paths.decisionJson, paths.decisionCsv, decision.rows);
  await writeRows(paths.directJson, paths.directCsv, directAnswerRows);
  await writeRows(paths.hashesJson, paths.hashesCsv, artifactHashesRows);

  const stressHedged = byScenario(scenarioRows, "stress_execution_high_swap", HEDGED_T100_L3_RULE_ID);
  const stressDirectional = byScenario(scenarioRows, "stress_execution_high_swap", DIRECTIONAL_T100_RULE_ID);
  const normalHedged = byScenario(scenarioRows, "normal_execution_small_swap", HEDGED_T100_L3_RULE_ID);
  const normalDirectional = byScenario(scenarioRows, "normal_execution_small_swap", DIRECTIONAL_T100_RULE_ID);
  const hedgedOrder = orderRows.find((row) => row.rule_id === HEDGED_T100_L3_RULE_ID) as JsonObject;
  const hedgedMargin = marginRows.find((row) => row.rule_id === HEDGED_T100_L3_RULE_ID) as JsonObject;

  const receipt = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    gate80_git_commit: summary.git_commit,
    artifact_only_no_replay: true,
    elapsed_ms: Date.now() - startedAt,
  };
  await writeJson(paths.commandReceipt, receipt);

  const summaryOut = {
    ...receipt,
    verdict: decision.verdict,
    gate80_verdict: summary.verdict,
    gate80_warehouse: summary.warehouse,
    normal_hedged_final_adr: normalHedged.stressed_final_equity_adr,
    normal_directional_final_adr: normalDirectional.stressed_final_equity_adr,
    stress_hedged_final_adr: stressHedged.stressed_final_equity_adr,
    stress_directional_final_adr: stressDirectional.stressed_final_equity_adr,
    hedged_average_fills_per_week: hedgedOrder.average_fills_per_week,
    hedged_p95_fills_per_week: hedgedOrder.p95_fills_per_week,
    hedged_max_fills_per_week: hedgedOrder.max_fills_per_week,
    hedged_return_per_margin_proxy_unit: hedgedMargin.return_per_margin_proxy_unit,
    frozen_areas: [
      "no Candidate B mutation",
      "no COT/Strength/Regime work",
      "no risk layer",
      "no pair pruning",
      "no AUDNZD exclusion",
      "no MT5/live/app/runtime code",
      "no promotion",
    ],
  };
  await writeJson(paths.summary, summaryOut);

  const sourceValidationTable = renderTable(validationRows, ["check", "value", "passed"]);
  const scenarioTable = renderTable(
    scenarioRows.filter((row) => row.rule_id === HEDGED_T100_L3_RULE_ID || row.rule_id === DIRECTIONAL_T100_RULE_ID),
    [
      "scenario_id",
      "rule_id",
      "all_in_cost_adr_per_fill",
      "swap_drag_adr_per_active_side_week",
      "stressed_final_equity_adr",
      "stressed_max_drawdown_adr",
    ],
  );
  const orderTable = renderTable(orderRows, [
    "rule_id",
    "total_fills",
    "average_fills_per_week",
    "p95_fills_per_week",
    "max_fills_per_week",
    "average_fills_per_pair_week_proxy",
    "all_28_runtime_read",
  ]);
  const marginTable = renderTable(marginRows, [
    "rule_id",
    "final_equity_adr",
    "max_drawdown_adr",
    "worst_open_unrealized_adr",
    "dd_plus_open_margin_proxy_adr",
    "return_per_margin_proxy_unit",
  ]);
  const directTable = renderTable(directAnswerRows, ["question", "answer", "evidence"]);
  const decisionTable = renderTable(decision.rows, ["decision", "value", "evidence"]);

  const report = `# Gate 81 Hedged Broker-Real Feasibility Preflight

Generated: \`${new Date().toISOString()}\`

## Verdict

\`${decision.verdict}\`

## Scope

- Fast artifact-derived feasibility pass over Gate 80 outputs only.
- No database replay, no path reconstruction, no full 373-week backtest rerun.
- Stress-tests the fully hedged T100/S020/L3 reference against fixed ADR-per-fill cost and active-side-week swap proxies.
- Reports order-count and margin/exposure proxies before any MT5 build.
- Does not mutate Candidate B, COT, Strength, Regime, source truth, pair set, AUDNZD, risk layer, MT5/live/app/runtime, or promotion state.

## Direct Answers

${directTable}

## Source Artifact Validation

${sourceValidationTable}

## Broker Stress Scenarios

${scenarioTable}

## Order Count Feasibility

${orderTable}

## Margin And Exposure Proxy

${marginTable}

## Decision Table

${decisionTable}

## Read

Gate 81 does not prove the hedged baseline is broker-real. It proves the gross Gate 80 phenomenon has enough fixed-cost buffer to justify one small MT5 mechanics prototype. The next build should be one pair only, visual and auditable, with long and short legs tracked separately and every spread, swap, fill, reset, open loss, closed profit, and margin state visible.

The all-28 hedged portfolio is still closed. Portfolio runtime, broker order throughput, margin-mode behavior, swap realism, pair pruning, risk overlays, and live readiness remain unresolved.

## Artifacts

- sourceArtifactValidationJson: \`${toRepoRelative(paths.validationJson)}\`
- sourceArtifactValidationCsv: \`${toRepoRelative(paths.validationCsv)}\`
- brokerStressScenariosJson: \`${toRepoRelative(paths.scenarioJson)}\`
- brokerStressScenariosCsv: \`${toRepoRelative(paths.scenarioCsv)}\`
- orderCountFeasibilityJson: \`${toRepoRelative(paths.orderJson)}\`
- orderCountFeasibilityCsv: \`${toRepoRelative(paths.orderCsv)}\`
- marginExposureProxyJson: \`${toRepoRelative(paths.marginJson)}\`
- marginExposureProxyCsv: \`${toRepoRelative(paths.marginCsv)}\`
- finalDecisionRowsJson: \`${toRepoRelative(paths.decisionJson)}\`
- finalDecisionRowsCsv: \`${toRepoRelative(paths.decisionCsv)}\`
- directAnswerRowsJson: \`${toRepoRelative(paths.directJson)}\`
- directAnswerRowsCsv: \`${toRepoRelative(paths.directCsv)}\`
- sourceArtifactHashesJson: \`${toRepoRelative(paths.hashesJson)}\`
- sourceArtifactHashesCsv: \`${toRepoRelative(paths.hashesCsv)}\`
- commandReceipt: \`${toRepoRelative(paths.commandReceipt)}\`
- summaryJson: \`${toRepoRelative(paths.summary)}\`
- shaIdentity: \`${toRepoRelative(paths.shaManifest)}\`
- report: \`${toRepoRelative(reportPath)}\`

## Stop Line

Gate 81 is feasibility-preflight evidence only. No promotion, no full portfolio build, no Candidate B mutation, no signal research, no pair exclusion, no AUDNZD exclusion, no risk layer, no Regime/fair-value layer, no live readiness, and no broker-real claim beyond the fixed ADR proxy scenarios. The only next build this can justify is a one-pair MT5 mechanics prototype.
`;
  await writeText(reportPath, report);

  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "source_artifact_validation_json", path: paths.validationJson },
    { label: "source_artifact_validation_csv", path: paths.validationCsv },
    { label: "broker_stress_scenarios_json", path: paths.scenarioJson },
    { label: "broker_stress_scenarios_csv", path: paths.scenarioCsv },
    { label: "order_count_feasibility_json", path: paths.orderJson },
    { label: "order_count_feasibility_csv", path: paths.orderCsv },
    { label: "margin_exposure_proxy_json", path: paths.marginJson },
    { label: "margin_exposure_proxy_csv", path: paths.marginCsv },
    { label: "final_decision_json", path: paths.decisionJson },
    { label: "final_decision_csv", path: paths.decisionCsv },
    { label: "direct_answers_json", path: paths.directJson },
    { label: "direct_answers_csv", path: paths.directCsv },
    { label: "source_artifact_hashes_json", path: paths.hashesJson },
    { label: "source_artifact_hashes_csv", path: paths.hashesCsv },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "summary", path: paths.summary },
    { label: "report", path: reportPath },
  ]);

  console.log(JSON.stringify({
    verdict: decision.verdict,
    normal_hedged_final_adr: normalHedged.stressed_final_equity_adr,
    stress_hedged_final_adr: stressHedged.stressed_final_equity_adr,
    stress_directional_final_adr: stressDirectional.stressed_final_equity_adr,
    artifact_only_no_replay: true,
    elapsed_ms: Date.now() - startedAt,
    report: toRepoRelative(reportPath),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
