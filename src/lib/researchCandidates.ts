import fs from "node:fs/promises";
import path from "node:path";

export type StrategyCandidateStatus = "candidate";

export type StrategyCandidateVariant = {
  scenario_id: string;
  mode: string;
  checkpoint_day: number;
  trigger_threshold_pct: number;
  retrace_target_pct_of_winner: number | null;
  metrics: {
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
  rationale: string;
};

export type StrategyCandidateRecord = {
  id: string;
  title: string;
  status: StrategyCandidateStatus;
  strategy_family: string;
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
  shortlisted_variants: StrategyCandidateVariant[];
  notes: string[];
  next_hypothesis: string;
};

export type StrategyCandidateRegistry = {
  generated_utc: string;
  candidates: StrategyCandidateRecord[];
};

const REGISTRY_PATH = path.join(process.cwd(), "data", "research_strategy_candidates.json");

export async function readStrategyCandidateRegistry(): Promise<StrategyCandidateRegistry> {
  try {
    const text = await fs.readFile(REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(text) as StrategyCandidateRegistry;
    if (!Array.isArray(parsed.candidates)) {
      return { generated_utc: new Date().toISOString(), candidates: [] };
    }
    return parsed;
  } catch {
    return { generated_utc: new Date().toISOString(), candidates: [] };
  }
}

const researchCandidates = {
  readStrategyCandidateRegistry,
};

export default researchCandidates;
