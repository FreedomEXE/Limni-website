import fs from "node:fs";
import { DateTime } from "luxon";

type ScenarioSummary = {
  id: string;
  mode: string;
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
};

type HedgeSweepReport = {
  generated_utc: string;
  account_size_usd: number;
  lookback_weeks: number;
  scenarios_ranked: ScenarioSummary[];
};

type CandidateRegistry = {
  generated_utc: string;
  candidates: CandidateRecord[];
};

type CandidateRecord = {
  id: string;
  title: string;
  status: "candidate";
  strategy_family: "hedged_fx_weekly";
  last_updated_utc: string;
  summary: string;
  source_artifacts: {
    script: string;
    report_latest_json: string;
    report_latest_md: string;
    recent_raw_runs: string[];
  };
  test_scope: {
    account_size_usd: number;
    lookback_weeks: number;
    universe: string;
    entry: string;
    sizing: string;
    costs_assumed: string;
  };
  shortlisted_variants: Array<{
    scenario_id: string;
    mode: string;
    checkpoint_day: number;
    trigger_threshold_pct: number;
    retrace_target_pct_of_winner: number | null;
    metrics: ScenarioSummary["stats"];
    rationale: string;
  }>;
  notes: string[];
  next_hypothesis: string;
};

const REPORT_LATEST_JSON = "reports/eightcap-3k-hedged-fx-weekly-sweep-latest.json";
const REGISTRY_PATH = "data/research_strategy_candidates.json";

function safeReadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, "utf8");
  return JSON.parse(text) as T;
}

function upsertCandidate(registry: CandidateRegistry, candidate: CandidateRecord): CandidateRegistry {
  const existing = registry.candidates.filter((row) => row.id !== candidate.id);
  return {
    generated_utc: DateTime.utc().toISO() ?? new Date().toISOString(),
    candidates: [candidate, ...existing],
  };
}

function pickScenario(report: HedgeSweepReport, id: string) {
  return report.scenarios_ranked.find((row) => row.id === id) ?? null;
}

function requireScenario(report: HedgeSweepReport, id: string): ScenarioSummary {
  const found = pickScenario(report, id);
  if (!found) {
    throw new Error(`Scenario not found in report: ${id}`);
  }
  return found;
}

function requireFirstScenario(report: HedgeSweepReport, ids: string[]): ScenarioSummary {
  for (const id of ids) {
    const found = pickScenario(report, id);
    if (found) return found;
  }
  throw new Error(`None of the candidate scenarios were found: ${ids.join(", ")}`);
}

function main() {
  const report = safeReadJson<HedgeSweepReport>(REPORT_LATEST_JSON);
  if (!report) {
    throw new Error(`Missing report file: ${REPORT_LATEST_JSON}`);
  }

  const bestBalanced = requireFirstScenario(report, [
    "side_retrace-d3-t2-r50",
    "side_retrace-d3-t2-r40",
    "side_retrace-d3-t3-r50",
    "side_retrace-d3-t3-r40",
  ]);
  const altBalanced = requireFirstScenario(report, [
    "side_retrace-d3-t3-r40",
    "side_retrace-d3-t3-r50",
    "side_retrace-d3-t4-r40",
    "side_retrace-d3-t4-r50",
    "side_retrace-d3-t5-r40",
    "side_retrace-d3-t5-r50",
  ]);
  const smootherComp = requireFirstScenario(report, [
    "pair_net_positive-d2-t10",
    "pair_net_positive-d2-t6",
    "pair_net_positive-d2-t5",
    "pair_net_positive-d2-t4",
    "pair_net_positive-d2-t3",
    "pair_net_positive-d2-t2",
    "pair_net_positive-d2-t1",
    "pair_net_positive-d2-t0",
  ]);
  const aggressive = requireFirstScenario(report, [
    "pair_hold-d2-t10",
    "pair_hold-d2-t6",
    "pair_hold-d2-t5",
    "pair_hold-d2-t4",
    "pair_hold-d2-t3",
    "pair_hold-d2-t2",
    "pair_hold-d2-t1",
    "pair_hold-d2-t0",
  ]);
  const cotGated = requireFirstScenario(report, [
    "cot_non_aligned_profit_close-d2-t7",
    "cot_non_aligned_profit_close-d2-t6",
    "cot_non_aligned_profit_close-d2-t5",
    "cot_non_aligned_profit_close-d2-t8",
    "cot_non_aligned_profit_close-d3-t10",
    "cot_non_aligned_profit_close-d3-t9",
  ]);
  const cotGatedStaged = requireFirstScenario(report, [
    "cot_non_aligned_profit_close_staged-d2-t3",
    "cot_non_aligned_profit_close_staged-d2-t0",
    "cot_non_aligned_profit_close_staged-d2-t2",
    "cot_non_aligned_profit_close_staged-d2-t7",
  ]);

  const candidate: CandidateRecord = {
    id: "fx_hedged_weekly_v1",
    title: "FX Hedged Weekly (Winner Close + Loser Recovery)",
    status: "candidate",
    strategy_family: "hedged_fx_weekly",
    last_updated_utc: DateTime.utc().toISO() ?? new Date().toISOString(),
    summary:
      "Weekly fully-hedged 28-FX basket candidate with checkpoint winner realization and loser-side recovery exits. Promising middle-ground behavior identified in Wednesday retrace variants.",
    source_artifacts: {
      script: "scripts/eightcap-3k-hedged-fx-weekly-sweep.ts",
      report_latest_json: "reports/eightcap-3k-hedged-fx-weekly-sweep-latest.json",
      report_latest_md: "reports/eightcap-3k-hedged-fx-weekly-sweep-latest.md",
      recent_raw_runs: [
        "temp/eightcap_3k_hedged_fx_weekly_sweep_raw.txt",
        "temp/eightcap_3k_hedged_fx_weekly_sweep_retrace_10_50_raw.txt",
        "temp/eightcap_3k_hedged_fx_weekly_sweep_retrace_0_10_raw.txt",
        "temp/eightcap_3k_hedged_fx_weekly_sweep_focus_grid_raw.txt",
      ],
    },
    test_scope: {
      account_size_usd: report.account_size_usd,
      lookback_weeks: report.lookback_weeks,
      universe: "FX 28 pairs",
      entry: "Sunday 17:00 NY, fully hedged (long + short each pair)",
      sizing: "Eightcap lot_map scaled to 3k, MT5 floor-clamped (0.01 step 0.01)",
      costs_assumed: "Ignored in first-pass research",
    },
    shortlisted_variants: [
      {
        scenario_id: bestBalanced.id,
        mode: bestBalanced.mode,
        checkpoint_day: bestBalanced.checkpoint_day,
        trigger_threshold_pct: bestBalanced.trigger_threshold_pct,
        retrace_target_pct_of_winner: bestBalanced.retrace_target_pct_of_winner,
        metrics: bestBalanced.stats,
        rationale:
          "Best return/activation balance in focused Wednesday retrace sweep.",
      },
      {
        scenario_id: altBalanced.id,
        mode: altBalanced.mode,
        checkpoint_day: altBalanced.checkpoint_day,
        trigger_threshold_pct: altBalanced.trigger_threshold_pct,
        retrace_target_pct_of_winner: altBalanced.retrace_target_pct_of_winner,
        metrics: altBalanced.stats,
        rationale:
          "Alternative with slightly lower trigger frequency and comparable downside profile.",
      },
      {
        scenario_id: smootherComp.id,
        mode: smootherComp.mode,
        checkpoint_day: smootherComp.checkpoint_day,
        trigger_threshold_pct: smootherComp.trigger_threshold_pct,
        retrace_target_pct_of_winner: smootherComp.retrace_target_pct_of_winner,
        metrics: smootherComp.stats,
        rationale:
          "Comparator variant with smoother close profile and non-negative weekly floor in current no-cost test.",
      },
      {
        scenario_id: aggressive.id,
        mode: aggressive.mode,
        checkpoint_day: aggressive.checkpoint_day,
        trigger_threshold_pct: aggressive.trigger_threshold_pct,
        retrace_target_pct_of_winner: aggressive.retrace_target_pct_of_winner,
        metrics: aggressive.stats,
        rationale:
          "High-return reference mode retained for risk/return envelope comparisons.",
      },
      {
        scenario_id: cotGated.id,
        mode: cotGated.mode,
        checkpoint_day: cotGated.checkpoint_day,
        trigger_threshold_pct: cotGated.trigger_threshold_pct,
        retrace_target_pct_of_winner: cotGated.retrace_target_pct_of_winner,
        metrics: cotGated.stats,
        rationale:
          "COT-gated extension: closes only profitable legs that are not COT-aligned at checkpoint, then holds the remaining basket.",
      },
      {
        scenario_id: cotGatedStaged.id,
        mode: cotGatedStaged.mode,
        checkpoint_day: cotGatedStaged.checkpoint_day,
        trigger_threshold_pct: cotGatedStaged.trigger_threshold_pct,
        retrace_target_pct_of_winner: cotGatedStaged.retrace_target_pct_of_winner,
        metrics: cotGatedStaged.stats,
        rationale:
          "Staged COT extension: applies non-aligned profitable-leg closures across Tue/Wed/Thu checkpoints before Friday flatten.",
      },
    ],
    notes: [
      "Wednesday checkpoint materially outperformed Tuesday for side_retrace variants in recent sweeps.",
      "Trigger threshold sweet spot observed between 2% and 5% of account-level checkpoint winner profit.",
      "Retrace 60% variants showed materially worse tail behavior vs 40-50% in focused grid.",
      "No-cost assumption likely overstates low-threshold variants; costs/slippage test is mandatory before promotion.",
      "COT-gated mode now tested and tracked as an extension candidate (non-aligned profitable-leg checkpoint closure).",
      "Staged daily COT-gated mode tested; in current blended run it improved low-threshold behavior but underperformed single-checkpoint mode at higher thresholds.",
    ],
    next_hypothesis:
      "Add COT-informed direction/regime gating to decide whether long-side or short-side realization logic should be enabled each week.",
  };

  const current = safeReadJson<CandidateRegistry>(REGISTRY_PATH) ?? {
    generated_utc: DateTime.utc().toISO() ?? new Date().toISOString(),
    candidates: [],
  };
  const next = upsertCandidate(current, candidate);
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(next, null, 2), "utf8");
  console.log(`Wrote ${REGISTRY_PATH}`);
}

main();
