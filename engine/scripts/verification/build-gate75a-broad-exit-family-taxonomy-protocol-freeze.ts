import { mkdir } from "node:fs/promises";
import path from "node:path";

import { sha256Stable } from "@engine/research/hash";

import {
  fileHash,
  gitCommit,
  parseArgMap,
  readJson,
  renderTable,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";
import { loadGate69Closeout } from "./gate70-utils";
import {
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  GATE71_EXPECTED_ROWS,
  GATE71_EXPECTED_SYMBOLS_PER_WEEK,
  GATE71_EXPECTED_WEEKS,
  loadCandidateBRows,
  validateCandidateBRows,
} from "./gate71-utils";

const GATE_ID = "Gate 75A: broad-exit-family-taxonomy-and-matrix-protocol-freeze";
const GATE_DATE = "2026-06-29";
const COMMAND = "npm run engine:gate75a:broad-exit-family-taxonomy-protocol-freeze";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate75a/artifacts/gate75a-broad-exit-family-taxonomy-protocol-freeze";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate75a/GATE75A_BROAD_EXIT_FAMILY_TAXONOMY_PROTOCOL_FREEZE_${GATE_DATE}.md`;
const DEFAULT_GATE72C_SUMMARY_PATH = "docs/research/gates/gate72c/artifacts/gate72c-exit-family-ranking-shortlist/gate72c-summary.json";
const DEFAULT_GATE73A_SUMMARY_PATH = "docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/gate73a-summary.json";
const DEFAULT_GATE74B_SUMMARY_PATH = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/gate74b-summary.json";
const DEFAULT_GATE74E_SUMMARY_PATH = "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/gate74e-summary.json";

type Feasibility = "replayable_now" | "requires_synchronized_account_replay" | "requires_new_trade_event_materialization" | "parked";
type FamilyGroup = "control" | "pair_level_lifecycle" | "account_level_lifecycle" | "hybrid" | "hedge_freeze_lock";

type Gate72cSummary = {
  verdict: string;
  validation: {
    promotion_eligible_count: number;
    no_clean_rule_passes_all_constraints: boolean;
    exit_promotion_performed: boolean;
    risk_layer_started: boolean;
  };
};

type Gate73aSummary = {
  verdict: string;
  validation: {
    top20_share_of_total_net_adr: number;
    green_then_giveback_rate: number;
    raw_m1_rebuild_performed: boolean;
    new_exit_rules_scored: boolean;
    exit_promotion_performed: boolean;
    risk_layer_started: boolean;
  };
};

type Gate74bSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    contract_id: string;
    price_bundle_id: string;
    path_resolution: string;
    candidate_id: string;
    locked_algorithm_id: string;
    candidate_b_final_ledger_hash: string;
    candidate_b_ledger_file_sha256: string;
    week_count: number;
    pair_week_count: number;
    path_point_count: number;
  };
  validation: {
    replay_adapters_started: boolean;
    risk_layer_started: boolean;
    mt5_live_runtime_started: boolean;
    brain_truth_mutated: boolean;
    source_mutation_started: boolean;
    exit_promotion_started: boolean;
  };
};

type Gate74eAdapter = {
  rule_id: string;
  rule_family: string;
  closed_total_adr: number;
  final_equity_adr: number;
  final_open_unrealized_adr: number;
  equity_profit_factor: number;
  equity_max_drawdown_adr: number;
  closed_adr_retention_vs_focus: number | null;
  equity_adr_retention_vs_focus: number | null;
  flip_loss_total_adr: number;
};

type Gate74eSummary = {
  verdict: string;
  focus_adapter: Gate74eAdapter;
  best_adapter_by_final_equity: Gate74eAdapter;
  best_adapter_by_drawdown_improvement: Gate74eAdapter;
  validation: {
    gate74b_passed: boolean;
    gate74c_passed: boolean;
    gate74d_passed: boolean;
    gross_only: boolean;
    costs_applied: boolean;
    raw_m1_rebuild_performed: boolean;
    exact_account_level_synchronous_containment_started: boolean;
    broad_parameter_matrix_started: boolean;
    pair_pruning_started: boolean;
    audnzd_excluded: boolean;
    risk_layer_started: boolean;
    exit_promotion_started: boolean;
    mt5_live_runtime_started: boolean;
    brain_truth_mutated: boolean;
    source_mutation_started: boolean;
  };
};

type FamilyContract = {
  family_id: string;
  group: FamilyGroup;
  description: string;
  feasibility: Feasibility;
  gate75b_status: "allowed" | "reference_only" | "parked";
  fixed_configs: Array<Record<string, unknown>>;
  evidence_basis: string[];
  constraints: string[];
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
    gate72cSummaryPath: args.get("--gate72c-summary") ?? DEFAULT_GATE72C_SUMMARY_PATH,
    gate73aSummaryPath: args.get("--gate73a-summary") ?? DEFAULT_GATE73A_SUMMARY_PATH,
    gate74bSummaryPath: args.get("--gate74b-summary") ?? DEFAULT_GATE74B_SUMMARY_PATH,
    gate74eSummaryPath: args.get("--gate74e-summary") ?? DEFAULT_GATE74E_SUMMARY_PATH,
  };
}

function withHash<T extends Record<string, unknown>>(value: T) {
  return { ...value, content_hash: sha256Stable(value) };
}

function familyContracts(): FamilyContract[] {
  return [
    {
      family_id: "controls",
      group: "control",
      description: "Baseline controls and already-observed reference rows that every Gate 75B comparison must preserve beside new families.",
      feasibility: "replayable_now",
      gate75b_status: "allowed",
      fixed_configs: [
        { adapter_id: "CONTROL_WEEKLY_FORCED_CLOSE" },
        { adapter_id: "CONTROL_CARRY_UNTIL_FLIP" },
        { adapter_id: "CONTROL_PAIR_NET_GRID_FOCUS_T075_S020" },
        { adapter_id: "CONTROL_GATE74E_MAX_FILL_075_REFERENCE" },
        { adapter_id: "CONTROL_GATE74E_MAX_AGE_2160H_REFERENCE" },
        { adapter_id: "CONTROL_GATE74E_RECOVERY_CLOSE_15_TO_MINUS_250_REFERENCE" },
      ],
      evidence_basis: [
        "Gate 72C no-promotion shortlist",
        "Gate 73A right-tail dependency",
        "Gate 74C/74D focus adapter parity",
        "Gate 74E negative containment result",
      ],
      constraints: [
        "reference controls do not imply promotion eligibility",
        "Gate 74E references must carry closed and equity PnL side by side",
      ],
    },
    {
      family_id: "pair_net_grid_cycle_reset",
      group: "pair_level_lifecycle",
      description: "Independent pair-level net-grid harvest cycles with fixed target/spacing and restart until Candidate B flip.",
      feasibility: "replayable_now",
      gate75b_status: "allowed",
      fixed_configs: [
        { adapter_id: "PAIR_NET_GRID_T050_S020", target_adr: 0.5, spacing_adr: 0.2 },
        { adapter_id: "PAIR_NET_GRID_T075_S020", target_adr: 0.75, spacing_adr: 0.2 },
        { adapter_id: "PAIR_NET_GRID_T100_S020", target_adr: 1, spacing_adr: 0.2 },
      ],
      evidence_basis: ["Gate 74C gross replay adapter pack", "Gate 74D open-loss forensics"],
      constraints: ["no spacing optimization sweep", "no pair/date exclusions", "close-mark semantics unless explicitly versioned"],
    },
    {
      family_id: "pair_profit_floor_trail",
      group: "pair_level_lifecycle",
      description: "Pair-level runner-preserving floor/trail mechanics applied to a single pair cycle, not to the whole account basket.",
      feasibility: "replayable_now",
      gate75b_status: "allowed",
      fixed_configs: [
        { adapter_id: "PAIR_TRAIL_A075_F025", activation_adr: 0.75, floor_adr: 0.25 },
        { adapter_id: "PAIR_TRAIL_A100_F050", activation_adr: 1, floor_adr: 0.5 },
      ],
      evidence_basis: ["Gate 73A runner-preserving recommendation", "Gate 74B pair path warehouse"],
      constraints: ["must report right-tail retention", "cannot clip top winners silently"],
    },
    {
      family_id: "pair_stop_floor_universal",
      group: "pair_level_lifecycle",
      description: "Universal pair lifecycle stop/floor mechanics used as diagnostics, not pair pruning.",
      feasibility: "replayable_now",
      gate75b_status: "allowed",
      fixed_configs: [
        { adapter_id: "PAIR_STOP_15_REFERENCE", stop_loss_adr: 15 },
        { adapter_id: "PAIR_STOP_20_REFERENCE", stop_loss_adr: 20 },
        { adapter_id: "PAIR_STOP_20_RECOVER_TO_MINUS_250", stop_loss_adr: 20, recovery_close_adr: -2.5 },
      ],
      evidence_basis: ["Gate 74E pair stops destroyed harvest", "Gate 74E recovery close retained harvest but did not beat focus"],
      constraints: ["not pair pruning", "must expose destroyed-harvest cases", "old 15 ADR clue remains unverified beyond observed Gate 74E result"],
    },
    {
      family_id: "max_fill_max_age_containment",
      group: "pair_level_lifecycle",
      description: "Simple universal fill-count or age guards around pair cycles.",
      feasibility: "replayable_now",
      gate75b_status: "allowed",
      fixed_configs: [
        { adapter_id: "MAX_FILL_075_REFERENCE", max_fill_count: 75 },
        { adapter_id: "MAX_AGE_2160H_REFERENCE", max_age_hours: 2160 },
      ],
      evidence_basis: ["Gate 74E best containment trade-offs were max-fill/max-age but not promotion-positive"],
      constraints: ["diagnostic containment only", "no fill/age grid expansion"],
    },
    {
      family_id: "partial_close_let_rest_run",
      group: "pair_level_lifecycle",
      description: "Close part of a profitable pair cycle at a fixed level while preserving a runner until flip or floor.",
      feasibility: "replayable_now",
      gate75b_status: "allowed",
      fixed_configs: [
        { adapter_id: "PARTIAL_50_AT_T075_REST_TO_FLIP", close_fraction: 0.5, trigger_adr: 0.75, runner_exit: "candidate_b_flip" },
        { adapter_id: "PARTIAL_50_AT_T075_REST_TRAIL_F025", close_fraction: 0.5, trigger_adr: 0.75, runner_floor_adr: 0.25 },
      ],
      evidence_basis: ["Gate 73A warns against clipping runners", "Gate 74B supports pair path replay"],
      constraints: ["runner retention must be reported", "no cost assumptions yet", "no additional partial-close grid"],
    },
    {
      family_id: "account_net_adr_reset",
      group: "account_level_lifecycle",
      description: "Reset all currently open expression when account-level net ADR reaches a fixed target.",
      feasibility: "requires_synchronized_account_replay",
      gate75b_status: "parked",
      fixed_configs: [
        { adapter_id: "ACCOUNT_NET_RESET_075", target_adr: 0.75 },
        { adapter_id: "ACCOUNT_NET_RESET_125", target_adr: 1.25 },
      ],
      evidence_basis: ["Gate 75 parking lot", "Gate 74E account-level synchronous containment not started"],
      constraints: ["requires all-pair timestamp ordering", "must not mutate Candidate B", "must keep reset closed/equity PnL visible"],
    },
    {
      family_id: "account_profit_floor_trail",
      group: "account_level_lifecycle",
      description: "Account-level profit floor/trail that attempts to protect a basket while preserving right-tail weeks.",
      feasibility: "requires_synchronized_account_replay",
      gate75b_status: "parked",
      fixed_configs: [
        { adapter_id: "ACCOUNT_TRAIL_A100_F050", activation_adr: 1, floor_adr: 0.5 },
        { adapter_id: "ACCOUNT_TRAIL_A150_F075", activation_adr: 1.5, floor_adr: 0.75 },
      ],
      evidence_basis: ["Gate 72C fixed basket exits clipped top winners", "Gate 73A runner-preserving requirement"],
      constraints: ["Pareto ranking required", "top-20 winner retention required", "no final-equity-only ranking"],
    },
    {
      family_id: "account_stop_recovery_close",
      group: "account_level_lifecycle",
      description: "Universal account-level adverse threshold followed by recovery close, treated as lifecycle containment rather than risk layer.",
      feasibility: "requires_synchronized_account_replay",
      gate75b_status: "parked",
      fixed_configs: [
        { adapter_id: "ACCOUNT_STOP_300_RECOVER_TO_MINUS_050", adverse_adr: -3, recovery_close_adr: -0.5 },
        { adapter_id: "ACCOUNT_STOP_500_RECOVER_TO_MINUS_100", adverse_adr: -5, recovery_close_adr: -1 },
      ],
      evidence_basis: ["Gate 74E pair recovery-close did not beat focus", "Gate 75A opens taxonomy only"],
      constraints: ["not a risk/correlation layer", "must report freezes/resets/stops count"],
    },
    {
      family_id: "one_reset_and_stop_weekly",
      group: "account_level_lifecycle",
      description: "A conservative weekly account reset rule that allows one reset then no more expression that week.",
      feasibility: "requires_synchronized_account_replay",
      gate75b_status: "parked",
      fixed_configs: [
        { adapter_id: "ACCOUNT_ONE_RESET_STOP_WEEK_TARGET_100", target_adr: 1 },
      ],
      evidence_basis: ["Gate 72C fixed exits risk right-tail clipping", "Gate 75A protocol requirement"],
      constraints: ["must report missed runner opportunity", "no weekly forced close unless rule explicitly defines it"],
    },
    {
      family_id: "no_reentry_after_reset",
      group: "account_level_lifecycle",
      description: "Account reset variant that prevents re-entry after reset until the next Candidate B week.",
      feasibility: "requires_synchronized_account_replay",
      gate75b_status: "parked",
      fixed_configs: [
        { adapter_id: "ACCOUNT_RESET_100_NO_REENTRY", target_adr: 1, no_reentry_until_next_week: true },
      ],
      evidence_basis: ["Gate 75A protocol requirement"],
      constraints: ["must report exposure reduction separately from edge", "no hidden risk pruning"],
    },
    {
      family_id: "pair_grid_plus_account_override",
      group: "hybrid",
      description: "Pair cycle harvesting with deterministic account-level reset or override.",
      feasibility: "requires_synchronized_account_replay",
      gate75b_status: "parked",
      fixed_configs: [
        { adapter_id: "PAIR_GRID_T075_S020_ACCOUNT_RESET_125", pair_target_adr: 0.75, pair_spacing_adr: 0.2, account_reset_adr: 1.25 },
      ],
      evidence_basis: ["Gate 74C pair net-grid harvest edge", "Gate 74E simple pair containment negative result"],
      constraints: ["account override must not delete pair floating loss", "no promotion"],
    },
    {
      family_id: "pair_cycle_with_account_floor",
      group: "hybrid",
      description: "Pair cycle harvesting under an account-level profit floor intended to preserve right-tail weeks.",
      feasibility: "requires_synchronized_account_replay",
      gate75b_status: "parked",
      fixed_configs: [
        { adapter_id: "PAIR_GRID_T075_S020_ACCOUNT_TRAIL_A150_F075", pair_target_adr: 0.75, pair_spacing_adr: 0.2, account_activation_adr: 1.5, account_floor_adr: 0.75 },
      ],
      evidence_basis: ["Gate 73A right-tail dependency", "Gate 74E focus baseline"],
      constraints: ["top-20 winner retention mandatory", "no final-equity-only ranking"],
    },
    {
      family_id: "partial_pair_close_plus_account_runner_preservation",
      group: "hybrid",
      description: "Partial pair close plus account-level runner preservation.",
      feasibility: "requires_synchronized_account_replay",
      gate75b_status: "parked",
      fixed_configs: [
        { adapter_id: "PARTIAL_PAIR_50_ACCOUNT_RUNNER_FLOOR", pair_close_fraction: 0.5, pair_trigger_adr: 0.75, account_floor_adr: 0.5 },
      ],
      evidence_basis: ["Gate 73A runner preservation", "Gate 75 parking lot"],
      constraints: ["requires synchronized runner accounting", "no costs yet"],
    },
    {
      family_id: "hedge_freeze_lock_visible_loss",
      group: "hedge_freeze_lock",
      description: "High-risk freeze/lock diagnostics where locked loss remains visible in equity accounting.",
      feasibility: "replayable_now",
      gate75b_status: "reference_only",
      fixed_configs: [
        { adapter_id: "FREEZE_LOCK_15_REFERENCE_ONLY", freeze_loss_adr: 15, locked_loss_visible: true },
      ],
      evidence_basis: ["Gate 74E freeze/lock reduced drawdown but destroyed equity"],
      constraints: ["high-risk reference only", "must not delete floating loss", "no adapter may erase loss"],
    },
  ];
}

function forbiddenBehaviorRegister() {
  return [
    "Candidate B direction recomputation",
    "Candidate B relabeling",
    "Candidate B reweighting",
    "Candidate B pair/date exclusion",
    "Candidate C promotion",
    "Candidate D retest",
    "Candidate E creation",
    "COT retuning",
    "Strength retuning",
    "Regime retuning",
    "risk/correlation pruning",
    "fair-value pruning",
    "AUDNZD exclusion",
    "pair exclusion",
    "date exclusion",
    "spread/slippage/swap/commission costs",
    "MT5/live/runtime/app work",
    "source mutation",
    "Brain mutation",
    "Alpha v2 promotion",
    "giant parameter optimization",
    "ranking by closed PnL alone",
    "ranking by final equity alone",
    "deleting or hiding floating loss",
    "exit promotion in Gate 75A or Gate 75B",
  ].map((behavior) => withHash({
    gate_id: GATE_ID,
    behavior,
    gate75b_allowed: false,
    failure_mode: "hard_fail_protocol_violation",
  }));
}

function rankingCriteria() {
  return withHash({
    gate_id: GATE_ID,
    ranking_mode: "pareto_frontier_not_final_equity_only",
    no_promotion_in_gate75a_or_gate75b: true,
    primary_metrics: [
      "final_equity_adr",
      "equity_profit_factor",
      "max_equity_drawdown_adr",
      "final_open_unrealized_adr",
      "closed_adr",
      "closed_adr_retention_vs_focus",
      "top20_winner_retention",
      "worst_week_loss_adr",
      "worst_5_week_loss_adr",
      "annual_stability",
      "negative_year_count",
      "profitable_week_rate",
      "recovery_behavior_where_applicable",
      "flip_loss_adr_where_applicable",
      "stops_resets_freezes_locks_count",
      "fill_count",
      "turnover_metadata",
      "hold_time_metadata",
      "tail_concentration_by_pair_reporting_only",
      "tail_concentration_by_currency_reporting_only",
    ],
    required_side_by_side_accounting: ["closed_pnl_adr", "mark_to_market_equity_pnl_adr"],
    reporting_only_not_pruning: ["pair_tail_concentration", "currency_tail_concentration", "AUDNZD_failure_contribution"],
    promotion_floor: "No Gate 75B row is promotion eligible, regardless of metrics. Promotion requires a later explicitly opened promotion gate.",
    negative_result_rules: [
      "Families that improve drawdown by destroying closed ADR must be labelled containment-only or failed.",
      "Families that reduce open loss by reducing exposure must report exposure reduction separately from edge.",
      "Families that retain right-tail weeks but leave unresolved loss must remain diagnostic.",
    ],
  });
}

function renderReport(summary: Record<string, unknown>, families: FamilyContract[]) {
  const familyRows = families.map((family) => ({
    family_id: family.family_id,
    group: family.group,
    feasibility: family.feasibility,
    gate75b_status: family.gate75b_status,
    configs: family.fixed_configs.length,
  }));
  return [
    "# Gate 75A Broad Exit-Family Taxonomy And Matrix Protocol Freeze",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Freezes the broad exit-family taxonomy and Gate 75B matrix plan before any broad matrix execution.",
    "- Converts Gates 72-74E evidence into predeclared families, feasibility labels, fixed configs, ranking metrics, and forbidden behavior.",
    "- Does not run Gate 75B, promote exits, start risk/correlation pruning, add costs, mutate Candidate B, mutate sources, or touch MT5/live/app/runtime.",
    "",
    "## Gate 74E Carry-Forward",
    "",
    "Simple universal containment reduced tail pain but did not fix the pair net-grid focus adapter. Gate 75B must not become another local Gate 74E parameter refinement unless a later review identifies a true near-miss.",
    "",
    "## Family Taxonomy",
    "",
    renderTable(familyRows, ["family_id", "group", "feasibility", "gate75b_status", "configs"]),
    "",
    "## Ranking Contract",
    "",
    "Gate 75B must expose a Pareto frontier across equity, PF, drawdown, open loss, tail behavior, and right-tail retention. It must not rank only by final equity or closed PnL.",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    "```json",
    JSON.stringify(summary.artifacts, null, 2),
    "```",
    "",
    "## Stop Line",
    "",
    "Gate 75A freezes protocol only. Gate 75B matrix execution, costs, risk, pair pruning, fair-value pruning, promotion, source mutation, Brain mutation, MT5/live/runtime, and app work remain closed until explicitly opened.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate69 = await loadGate69Closeout();
  const gate72c = await readJson<Gate72cSummary>(options.gate72cSummaryPath);
  const gate73a = await readJson<Gate73aSummary>(options.gate73aSummaryPath);
  const gate74b = await readJson<Gate74bSummary>(options.gate74bSummaryPath);
  const gate74e = await readJson<Gate74eSummary>(options.gate74eSummaryPath);
  const candidateRows = await loadCandidateBRows(options.candidateBLedgerPath);
  const candidateShape = validateCandidateBRows(candidateRows);
  const candidateBLedgerFileHash = (await fileHash(options.candidateBLedgerPath)).toUpperCase();
  const families = familyContracts();
  const forbidden = forbiddenBehaviorRegister();
  const ranking = rankingCriteria();

  const baselineBinding = withHash({
    gate_id: GATE_ID,
    candidate_b: {
      locked_algorithm_id: gate74b.warehouse.locked_algorithm_id,
      candidate_id: gate74b.warehouse.candidate_id,
      gate69b_final_ledger_hash: gate69.gate69b.ledger_hashes.final_ledger_hash,
      gate74b_candidate_b_final_ledger_hash: gate74b.warehouse.candidate_b_final_ledger_hash,
      candidate_b_ledger_file_sha256: candidateBLedgerFileHash,
      immutable_directional_truth: true,
      forced28_preserved: candidateShape.forced28_preserved,
      rows: candidateShape.rows,
      weeks: candidateShape.weeks,
      expected_symbols_per_week: GATE71_EXPECTED_SYMBOLS_PER_WEEK,
    },
    gate74b_warehouse: {
      manifest_id: gate74b.warehouse.manifest_id,
      warehouse_hash: gate74b.warehouse.warehouse_hash,
      contract_id: gate74b.warehouse.contract_id,
      price_bundle_id: gate74b.warehouse.price_bundle_id,
      path_resolution: gate74b.warehouse.path_resolution,
      week_count: gate74b.warehouse.week_count,
      pair_week_count: gate74b.warehouse.pair_week_count,
      path_point_count: gate74b.warehouse.path_point_count,
    },
  });

  const gate74eDecisionMemo = withHash({
    gate_id: GATE_ID,
    source_verdict: gate74e.verdict,
    accepted_as_research_evidence: true,
    interpretation:
      "simple universal containment reduced tail pain but did not fix the Gate 74C/74D focus adapter; the uncontained baseline still ranked best by final equity",
    focus_baseline_final_equity_adr: gate74e.focus_adapter.final_equity_adr,
    focus_baseline_equity_pf: gate74e.focus_adapter.equity_profit_factor,
    focus_baseline_max_drawdown_adr: gate74e.focus_adapter.equity_max_drawdown_adr,
    focus_baseline_final_open_unrealized_adr: gate74e.focus_adapter.final_open_unrealized_adr,
    no_local_74e_refinement_without_near_miss: true,
    negative_carry_forward: [
      "pair stops contained tails but destroyed harvest",
      "freeze/lock must keep loss visible and was not equity-positive",
      "max-fill and max-age were survivability trade-offs, not promotion candidates",
      "exact account-level lifecycle exits require synchronized all-pair replay",
    ],
  });

  const taxonomyContract = withHash({
    gate_id: GATE_ID,
    contract_version: "gate75a_broad_exit_family_taxonomy_v1",
    family_count: families.length,
    families,
    ranking_contract_hash: ranking.content_hash,
    forbidden_behavior_count: forbidden.length,
  });

  const feasibilityMap = withHash({
    gate_id: GATE_ID,
    statuses: {
      replayable_now: families.filter((family) => family.feasibility === "replayable_now").map((family) => family.family_id),
      requires_synchronized_account_replay: families.filter((family) => family.feasibility === "requires_synchronized_account_replay").map((family) => family.family_id),
      requires_new_trade_event_materialization: families.filter((family) => family.feasibility === "requires_new_trade_event_materialization").map((family) => family.family_id),
      parked: families.filter((family) => family.feasibility === "parked").map((family) => family.family_id),
    },
    rule: "Gate 75B may only execute replayable_now families unless Freedom explicitly opens synchronized account replay materialization first.",
  });

  const matrixPlan = withHash({
    gate_id: GATE_ID,
    planned_gate: "Gate 75B: broad-exit-family-taxonomy-matrix",
    execution_started_in_gate75a: false,
    fixed_config_count_total: families.reduce((sum, family) => sum + family.fixed_configs.length, 0),
    allowed_family_ids_for_immediate_gate75b: families
      .filter((family) => family.gate75b_status === "allowed" && family.feasibility === "replayable_now")
      .map((family) => family.family_id),
    reference_only_family_ids: families.filter((family) => family.gate75b_status === "reference_only").map((family) => family.family_id),
    parked_family_ids: families.filter((family) => family.gate75b_status === "parked").map((family) => family.family_id),
    matrix_rows: families.flatMap((family) =>
      family.fixed_configs.map((config) => ({
        family_id: family.family_id,
        group: family.group,
        feasibility: family.feasibility,
        gate75b_status: family.gate75b_status,
        ...config,
      })),
    ),
    ranking_metrics: ranking.primary_metrics,
    no_promotion: true,
  });

  const commandReceipt = withHash({
    gate_id: GATE_ID,
    command: COMMAND,
    command_role: "protocol_freeze_only",
    broad_matrix_run_started: false,
    raw_m1_rebuild_performed: false,
    generated_at: new Date().toISOString(),
  });

  const pass =
    gate69.gate69b.verdict.startsWith("PASS_") &&
    gate69.gate69b.validation.final_ledger_shape.forced28_preserved &&
    gate72c.verdict.startsWith("PASS_") &&
    gate72c.validation.promotion_eligible_count === 0 &&
    gate72c.validation.exit_promotion_performed === false &&
    gate72c.validation.risk_layer_started === false &&
    gate73a.verdict.startsWith("PASS_") &&
    gate73a.validation.raw_m1_rebuild_performed === false &&
    gate73a.validation.new_exit_rules_scored === false &&
    gate73a.validation.exit_promotion_performed === false &&
    gate74b.verdict.startsWith("PASS_") &&
    gate74b.validation.replay_adapters_started === false &&
    gate74b.validation.risk_layer_started === false &&
    gate74b.validation.brain_truth_mutated === false &&
    gate74b.validation.source_mutation_started === false &&
    gate74e.verdict.startsWith("PASS_") &&
    gate74e.validation.gross_only &&
    gate74e.validation.costs_applied === false &&
    gate74e.validation.raw_m1_rebuild_performed === false &&
    gate74e.validation.broad_parameter_matrix_started === false &&
    gate74e.validation.pair_pruning_started === false &&
    gate74e.validation.audnzd_excluded === false &&
    gate74e.validation.risk_layer_started === false &&
    gate74e.validation.exit_promotion_started === false &&
    gate74e.validation.brain_truth_mutated === false &&
    gate74e.validation.source_mutation_started === false &&
    gate74e.best_adapter_by_final_equity.rule_id === gate74e.focus_adapter.rule_id &&
    candidateShape.forced28_preserved &&
    candidateShape.rows === GATE71_EXPECTED_ROWS &&
    candidateShape.weeks === GATE71_EXPECTED_WEEKS &&
    candidateBLedgerFileHash === gate74b.warehouse.candidate_b_ledger_file_sha256 &&
    gate69.gate69b.ledger_hashes.final_ledger_hash === gate74b.warehouse.candidate_b_final_ledger_hash &&
    matrixPlan.execution_started_in_gate75a === false &&
    ranking.no_promotion_in_gate75a_or_gate75b === true &&
    forbidden.every((row) => row.gate75b_allowed === false);

  const artifacts = {
    taxonomyContract: toRepoRelative(path.join(artifactDir, "taxonomy-contract.json")),
    gate75bMatrixPlan: toRepoRelative(path.join(artifactDir, "gate75b-matrix-plan.json")),
    feasibilityMap: toRepoRelative(path.join(artifactDir, "adapter-family-feasibility-map.json")),
    baselineBinding: toRepoRelative(path.join(artifactDir, "baseline-binding.json")),
    gate74eDecisionMemo: toRepoRelative(path.join(artifactDir, "gate74e-decision-memo.json")),
    rankingCriteria: toRepoRelative(path.join(artifactDir, "ranking-and-no-promotion-criteria.json")),
    forbiddenBehaviorRegister: toRepoRelative(path.join(artifactDir, "forbidden-behavior-register.json")),
    commandReceipt: toRepoRelative(path.join(artifactDir, "command-receipt.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate75a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate75a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };

  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: commandReceipt.generated_at,
    git_commit: gitCommit(),
    verdict: pass
      ? "PASS_GATE75A_BROAD_EXIT_FAMILY_TAXONOMY_PROTOCOL_FREEZE__MATRIX_PLAN_PREDECLARED_NO_EXECUTION"
      : "FAIL_GATE75A_BROAD_EXIT_FAMILY_TAXONOMY_PROTOCOL_FREEZE",
    purpose:
      "freeze a broader exit-family taxonomy and Gate 75B matrix plan without running the broad matrix or promoting exits",
    validation: {
      gate69b_passed: gate69.gate69b.verdict.startsWith("PASS_"),
      gate72c_passed: gate72c.verdict.startsWith("PASS_"),
      gate73a_passed: gate73a.verdict.startsWith("PASS_"),
      gate74b_passed: gate74b.verdict.startsWith("PASS_"),
      gate74e_passed: gate74e.verdict.startsWith("PASS_"),
      gate72c_no_promotion_candidate: gate72c.validation.promotion_eligible_count === 0,
      gate73a_right_tail_dependency_visible: gate73a.validation.top20_share_of_total_net_adr > 1,
      gate74e_focus_still_best_by_final_equity: gate74e.best_adapter_by_final_equity.rule_id === gate74e.focus_adapter.rule_id,
      candidate_b_forced28_preserved: candidateShape.forced28_preserved,
      candidate_b_rows: candidateShape.rows,
      expected_candidate_b_rows: GATE71_EXPECTED_ROWS,
      candidate_b_weeks: candidateShape.weeks,
      expected_candidate_b_weeks: GATE71_EXPECTED_WEEKS,
      candidate_b_file_hash_matches_gate74b: candidateBLedgerFileHash === gate74b.warehouse.candidate_b_ledger_file_sha256,
      gate69b_ledger_hash_matches_gate74b: gate69.gate69b.ledger_hashes.final_ledger_hash === gate74b.warehouse.candidate_b_final_ledger_hash,
      taxonomy_family_count: families.length,
      matrix_fixed_config_count: matrixPlan.fixed_config_count_total,
      replayable_now_family_count: feasibilityMap.statuses.replayable_now.length,
      synchronized_account_family_count: feasibilityMap.statuses.requires_synchronized_account_replay.length,
      gate75b_matrix_execution_started: false,
      broad_parameter_matrix_started: false,
      costs_applied: false,
      risk_layer_started: false,
      pair_pruning_started: false,
      audnzd_excluded: false,
      fair_value_pruning_started: false,
      exit_promotion_started: false,
      mt5_live_runtime_started: false,
      app_runtime_started: false,
      brain_truth_mutated: false,
      source_mutation_started: false,
    },
    decision_hashes: {
      taxonomy_contract: taxonomyContract.content_hash,
      matrix_plan: matrixPlan.content_hash,
      feasibility_map: feasibilityMap.content_hash,
      baseline_binding: baselineBinding.content_hash,
      gate74e_decision_memo: gate74eDecisionMemo.content_hash,
      ranking_criteria: ranking.content_hash,
      command_receipt: commandReceipt.content_hash,
    },
    artifacts,
  };

  await writeJson(path.join(artifactDir, "taxonomy-contract.json"), taxonomyContract);
  await writeJson(path.join(artifactDir, "gate75b-matrix-plan.json"), matrixPlan);
  await writeJson(path.join(artifactDir, "adapter-family-feasibility-map.json"), feasibilityMap);
  await writeJson(path.join(artifactDir, "baseline-binding.json"), baselineBinding);
  await writeJson(path.join(artifactDir, "gate74e-decision-memo.json"), gate74eDecisionMemo);
  await writeJson(path.join(artifactDir, "ranking-and-no-promotion-criteria.json"), ranking);
  await writeJson(path.join(artifactDir, "forbidden-behavior-register.json"), forbidden);
  await writeJson(path.join(artifactDir, "command-receipt.json"), commandReceipt);
  await writeJson(path.join(artifactDir, "gate75a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, families));
  await writeShaManifest(path.join(artifactDir, "gate75a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "taxonomy_contract", path: path.join(artifactDir, "taxonomy-contract.json") },
    { label: "gate75b_matrix_plan", path: path.join(artifactDir, "gate75b-matrix-plan.json") },
    { label: "adapter_family_feasibility_map", path: path.join(artifactDir, "adapter-family-feasibility-map.json") },
    { label: "baseline_binding", path: path.join(artifactDir, "baseline-binding.json") },
    { label: "gate74e_decision_memo", path: path.join(artifactDir, "gate74e-decision-memo.json") },
    { label: "ranking_and_no_promotion_criteria", path: path.join(artifactDir, "ranking-and-no-promotion-criteria.json") },
    { label: "forbidden_behavior_register", path: path.join(artifactDir, "forbidden-behavior-register.json") },
    { label: "command_receipt", path: path.join(artifactDir, "command-receipt.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate75a-summary.json") },
    { label: "report", path: reportPath },
    { label: "gate74e_summary", path: options.gate74eSummaryPath },
    { label: "gate74b_summary", path: options.gate74bSummaryPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({
    validation: summary.validation,
    artifacts,
    matrix_fixed_config_count: matrixPlan.fixed_config_count_total,
    replayable_now: feasibilityMap.statuses.replayable_now,
    parked: [
      ...feasibilityMap.statuses.requires_synchronized_account_replay,
      ...feasibilityMap.statuses.requires_new_trade_event_materialization,
      ...feasibilityMap.statuses.parked,
    ],
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
