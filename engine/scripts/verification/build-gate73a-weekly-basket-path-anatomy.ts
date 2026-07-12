import { mkdir } from "node:fs/promises";
import path from "node:path";

import { gitCommit, parseArgMap, readJson, readJsonl, renderTable, round, toRepoRelative, writeJson, writeJsonl, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_GATE71B_DIR,
  GATE71_EXPECTED_WEEKS,
  type BasketPathDiagnosticRow,
} from "./gate71-utils";
import {
  DEFAULT_GATE71C_WEEKLY_ROWS_PATH,
  DEFAULT_GATE72C_DIR,
  WEEKLY_HOLD_CONTROL_ID,
  type WeeklyMatrixRow,
} from "./gate72-utils";

const GATE73_DATE = "2026-06-29";
const GATE_ID = "Gate 73A: weekly-basket-path-anatomy";
const COMMAND = "npm run engine:gate73a:weekly-basket-path-anatomy";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate73a/GATE73A_WEEKLY_BASKET_PATH_ANATOMY_${GATE73_DATE}.md`;
const DEFAULT_GATE71B_DIAGNOSTIC_ROWS_PATH = path.join(DEFAULT_GATE71B_DIR, "candidate-b-basket-adr-path-diagnostics.rows.jsonl");
const DEFAULT_GATE72C_SHORTLIST_PATH = path.join(DEFAULT_GATE72C_DIR, "exit-family-review-shortlist.json");

type ShortlistRule = {
  rule_id: string;
  family: string;
};

type ClassifiedWeek = {
  week_open_utc: string;
  year: number;
  mfe_adr: number;
  mae_adr: number;
  friday_close_adr: number;
  peak_to_friday_giveback_adr: number;
  time_to_mfe_hours: number | null;
  time_to_mae_hours: number | null;
  first_profit_hours: number | null;
  first_drawdown_hours: number | null;
  profit_before_drawdown: boolean | null;
  drawdown_before_profit: boolean | null;
  hit_plus_025: boolean;
  hit_plus_050: boolean;
  hit_plus_075: boolean;
  hit_plus_100: boolean;
  hit_plus_125: boolean;
  hit_plus_150: boolean;
  hit_plus_200: boolean;
  hit_minus_050: boolean;
  hit_minus_100: boolean;
  hit_minus_150: boolean;
  hit_minus_200: boolean;
  hit_minus_300: boolean;
  clean_winner_week: boolean;
  green_then_giveback_week: boolean;
  volatile_recovery_week: boolean;
  late_runner_week: boolean;
  never_green_loser_week: boolean;
  monster_trend_week: boolean;
  primary_class: string;
  weekly_hold_adr: number;
  shortlist_exit_delta_vs_weekly_hold: Record<string, number>;
};

function parseOptions() {
  const args = parseArgMap();
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    diagnosticsPath: args.get("--diagnostics") ?? DEFAULT_GATE71B_DIAGNOSTIC_ROWS_PATH,
    weeklyRowsPath: args.get("--weekly-rows") ?? DEFAULT_GATE71C_WEEKLY_ROWS_PATH,
    shortlistPath: args.get("--shortlist") ?? DEFAULT_GATE72C_SHORTLIST_PATH,
  };
}

function hoursBetween(start: string, end: string | null) {
  if (!end) return null;
  const delta = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(delta)) return null;
  return round(delta / 3_600_000);
}

function quantile(values: number[], q: number) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return round(lowerValue + (upperValue - lowerValue) * (pos - lower));
}

function distribution(values: number[]) {
  return {
    count: values.length,
    mean: round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)),
    min: round(Math.min(...values)),
    p05: quantile(values, 0.05),
    p10: quantile(values, 0.1),
    p25: quantile(values, 0.25),
    p50: quantile(values, 0.5),
    p75: quantile(values, 0.75),
    p90: quantile(values, 0.9),
    p95: quantile(values, 0.95),
    max: round(Math.max(...values)),
  };
}

function rate(count: number, denominator: number) {
  return round(count / Math.max(1, denominator));
}

function asTime(value: unknown) {
  return typeof value === "string" ? value : null;
}

function hit(record: Record<string, string | null>, key: string) {
  return Boolean(record[key]);
}

function before(left: string | null, right: string | null) {
  if (!left || !right) return false;
  return Date.parse(left) < Date.parse(right);
}

function matrixByWeekAndRule(rows: WeeklyMatrixRow[]) {
  return new Map(rows.map((row) => [`${row.week_open_utc}|${row.rule_id}`, row]));
}

function classifyPrimary(flags: {
  monsterTrend: boolean;
  greenThenGiveback: boolean;
  volatileRecovery: boolean;
  lateRunner: boolean;
  neverGreenLoser: boolean;
  cleanWinner: boolean;
}) {
  if (flags.monsterTrend) return "monster_trend";
  if (flags.greenThenGiveback) return "green_then_giveback";
  if (flags.volatileRecovery) return "volatile_recovery";
  if (flags.lateRunner) return "late_runner";
  if (flags.neverGreenLoser) return "never_green_loser";
  if (flags.cleanWinner) return "clean_winner";
  return "mixed_or_neutral";
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(getKey(row), [...(map.get(getKey(row)) ?? []), row]);
  return map;
}

function classSummary(rows: ClassifiedWeek[]) {
  const groups = groupBy(rows, (row) => row.primary_class);
  return [...groups.entries()]
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .map(([primaryClass, classRows]) => ({
      primary_class: primaryClass,
      weeks: classRows.length,
      rate: rate(classRows.length, rows.length),
      total_weekly_hold_adr: round(classRows.reduce((sum, row) => sum + row.weekly_hold_adr, 0)),
      average_weekly_hold_adr: round(classRows.reduce((sum, row) => sum + row.weekly_hold_adr, 0) / Math.max(1, classRows.length)),
      average_mfe_adr: round(classRows.reduce((sum, row) => sum + row.mfe_adr, 0) / Math.max(1, classRows.length)),
      average_mae_adr: round(classRows.reduce((sum, row) => sum + row.mae_adr, 0) / Math.max(1, classRows.length)),
      average_giveback_adr: round(classRows.reduce((sum, row) => sum + row.peak_to_friday_giveback_adr, 0) / Math.max(1, classRows.length)),
    }));
}

function thresholdSummary(rows: BasketPathDiagnosticRow[]) {
  const positiveThresholds = ["plus_025", "plus_050", "plus_075", "plus_100", "plus_125", "plus_150", "plus_200"];
  const adverseThresholds = ["minus_050", "minus_100", "minus_150", "minus_200", "minus_300"];
  return {
    positive_hits: Object.fromEntries(positiveThresholds.map((key) => [
      key,
      {
        hit_weeks: rows.filter((row) => hit(row.first_positive_hits, key)).length,
        hit_rate: rate(rows.filter((row) => hit(row.first_positive_hits, key)).length, rows.length),
        median_first_hit_hours: quantile(rows.map((row) => hoursBetween(row.entry_timestamp_utc, asTime(row.first_positive_hits[key]))).filter((value): value is number => value !== null), 0.5),
      },
    ])),
    adverse_hits: Object.fromEntries(adverseThresholds.map((key) => [
      key,
      {
        hit_weeks: rows.filter((row) => hit(row.first_adverse_hits, key)).length,
        hit_rate: rate(rows.filter((row) => hit(row.first_adverse_hits, key)).length, rows.length),
        median_first_hit_hours: quantile(rows.map((row) => hoursBetween(row.entry_timestamp_utc, asTime(row.first_adverse_hits[key]))).filter((value): value is number => value !== null), 0.5),
      },
    ])),
    adverse_before_profit_target: Object.fromEntries(
      ["plus_050", "plus_075", "plus_100", "plus_125"].map((profitKey) => [
        profitKey,
        Object.fromEntries(
          ["minus_050", "minus_100", "minus_150", "minus_200"].map((adverseKey) => {
            const count = rows.filter((row) => before(asTime(row.first_adverse_hits[adverseKey]), asTime(row.first_positive_hits[profitKey]))).length;
            return [adverseKey, { weeks: count, rate: rate(count, rows.length) }];
          }),
        ),
      ]),
    ),
  };
}

function topWinnerDependency(classified: ClassifiedWeek[], shortlistRules: ShortlistRule[]) {
  const sorted = [...classified].sort((left, right) => right.weekly_hold_adr - left.weekly_hold_adr);
  const totalAdr = classified.reduce((sum, row) => sum + row.weekly_hold_adr, 0);
  const positiveAdr = classified.filter((row) => row.weekly_hold_adr > 0).reduce((sum, row) => sum + row.weekly_hold_adr, 0);
  return [10, 20, 50].map((topN) => {
    const top = sorted.slice(0, topN);
    const topHoldAdr = top.reduce((sum, row) => sum + row.weekly_hold_adr, 0);
    const lossesByRule = Object.fromEntries(shortlistRules.map((rule) => {
      const clipped = top.map((row) => row.shortlist_exit_delta_vs_weekly_hold[rule.rule_id] ?? 0);
      return [rule.rule_id, {
        weekly_hold_minus_exit_adr: round(clipped.reduce((sum, value) => sum + value, 0)),
        average_weekly_hold_minus_exit_adr: round(clipped.reduce((sum, value) => sum + value, 0) / Math.max(1, top.length)),
        clipped_week_count: clipped.filter((value) => value > 0).length,
      }];
    }));
    return {
      top_weeks: topN,
      weekly_hold_adr: round(topHoldAdr),
      share_of_total_net_adr: round(topHoldAdr / Math.max(1, totalAdr)),
      share_of_positive_adr: round(topHoldAdr / Math.max(1, positiveAdr)),
      weeks: top.map((row) => ({ week_open_utc: row.week_open_utc, weekly_hold_adr: row.weekly_hold_adr, mfe_adr: row.mfe_adr, giveback_adr: row.peak_to_friday_giveback_adr })),
      shortlist_losses_vs_weekly_hold: lossesByRule,
    };
  });
}

function shortlistAttribution(classified: ClassifiedWeek[], shortlistRules: ShortlistRule[]) {
  return shortlistRules.map((rule) => {
    const deltas = classified.map((row) => row.shortlist_exit_delta_vs_weekly_hold[rule.rule_id] ?? 0);
    const monster = classified.filter((row) => row.monster_trend_week);
    const giveback = classified.filter((row) => row.green_then_giveback_week);
    return {
      rule_id: rule.rule_id,
      family: rule.family,
      total_weekly_hold_minus_exit_adr: round(deltas.reduce((sum, value) => sum + value, 0)),
      average_weekly_hold_minus_exit_adr: round(deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length)),
      weeks_clipped_vs_weekly_hold: deltas.filter((value) => value > 0).length,
      weeks_helped_vs_weekly_hold: deltas.filter((value) => value < 0).length,
      monster_week_loss_adr: round(monster.reduce((sum, row) => sum + (row.shortlist_exit_delta_vs_weekly_hold[rule.rule_id] ?? 0), 0)),
      green_giveback_week_saved_adr: round(-giveback.filter((row) => (row.shortlist_exit_delta_vs_weekly_hold[rule.rule_id] ?? 0) < 0).reduce((sum, row) => sum + (row.shortlist_exit_delta_vs_weekly_hold[rule.rule_id] ?? 0), 0)),
    };
  });
}

function recommendation(anatomy: {
  greenThenGivebackRate: number;
  top20Share: number;
  volatileRecoveryRate: number;
  lateRunnerRate: number;
}) {
  const notes = [
    "Do not run another broad fixed-target matrix yet.",
    "Next exit matrix should preserve right-tail weeks and test profit protection without hard caps.",
  ];
  if (anatomy.top20Share > 0.5) notes.push("Top-winner dependency is high; hard profit targets are structurally dangerous unless paired with a runner-preservation rule.");
  if (anatomy.greenThenGivebackRate > 0.25) notes.push("Green-then-giveback support is high enough to justify delayed/wider basket profit-floor trailing tests.");
  if (anatomy.volatileRecoveryRate > 0.2) notes.push("Volatile recovery support argues against tight adverse stops.");
  if (anatomy.lateRunnerRate > 0.1) notes.push("Late-runner support argues against early time-based capture.");
  return {
    next_gate_recommendation: "Gate 73B: runner-preserving-profit-protection-design",
    recommended_matrix_direction: [
      "no hard TP as the default next test",
      "delayed activation trails such as +1.25/+0.25, +1.50/+0.50, +2.00/+0.75",
      "peak-distance trailing after meaningful profit rather than fixed close-all targets",
      "wide or absent adverse stops until volatile recovery is quantified more tightly",
    ],
    notes,
  };
}

function renderReport(summary: Record<string, unknown>, classRows: ReturnType<typeof classSummary>) {
  return [
    "# Gate 73A Weekly Basket Path Anatomy",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Uses Gate 71B basket path diagnostics and Gate 71C/72C exit result ledgers.",
    "- Classifies weekly basket paths and measures MFE, MAE, giveback, time-to-extreme, threshold hits, right-tail dependency, and shortlist attribution.",
    "- Does not introduce new exit rules, optimize thresholds, promote exits, or open risk/live work.",
    "",
    "## Classification Summary",
    "",
    renderTable(classRows, ["primary_class", "weeks", "rate", "total_weekly_hold_adr", "average_weekly_hold_adr", "average_mfe_adr", "average_mae_adr", "average_giveback_adr"]),
    "",
    "## Key Finding",
    "",
    String(summary.key_finding),
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
    `- Weekly classification ledger: \`${summary.artifacts["weeklyClassificationLedger"]}\``,
    `- Path anatomy percentiles: \`${summary.artifacts["pathAnatomyPercentiles"]}\``,
    `- Threshold anatomy: \`${summary.artifacts["thresholdAnatomy"]}\``,
    `- Top-winner dependency: \`${summary.artifacts["topWinnerDependency"]}\``,
    `- Shortlist attribution: \`${summary.artifacts["shortlistAttribution"]}\``,
    `- Summary: \`${summary.artifacts["summaryJson"]}\``,
    `- SHA identity: \`${summary.artifacts["shaIdentity"]}\``,
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const diagnostics = await readJsonl<BasketPathDiagnosticRow>(options.diagnosticsPath);
  const weeklyRows = await readJsonl<WeeklyMatrixRow>(options.weeklyRowsPath);
  const shortlistRules = await readJson<ShortlistRule[]>(options.shortlistPath);
  const weeklyByKey = matrixByWeekAndRule(weeklyRows);
  const weeklyHoldByWeek = new Map(
    weeklyRows
      .filter((row) => row.rule_id === WEEKLY_HOLD_CONTROL_ID)
      .map((row) => [row.week_open_utc, row.exit_adr]),
  );
  const sortedWeeklyHold = [...weeklyHoldByWeek.entries()].sort((left, right) => right[1] - left[1]);
  const monsterWeeks = new Set(sortedWeeklyHold.slice(0, 20).map(([week]) => week));

  const classified: ClassifiedWeek[] = diagnostics.map((row) => {
    const weeklyHoldAdr = weeklyHoldByWeek.get(row.week_open_utc) ?? row.friday_close_adr;
    const firstProfitHours = hoursBetween(row.entry_timestamp_utc, asTime(row.first_positive_hits.plus_025));
    const firstDrawdownHours = hoursBetween(row.entry_timestamp_utc, asTime(row.first_adverse_hits.minus_050));
    const timeToMfeHours = hoursBetween(row.entry_timestamp_utc, row.mfe_timestamp_utc);
    const timeToMaeHours = hoursBetween(row.entry_timestamp_utc, row.mae_timestamp_utc);
    const cleanWinner = row.friday_close_adr > 0 && row.mfe_adr >= 0.5 && row.peak_to_friday_giveback_adr <= Math.max(1, row.mfe_adr * 0.25);
    const greenThenGiveback = row.mfe_adr >= 0.5 && (row.friday_close_adr < 0 || row.peak_to_friday_giveback_adr >= Math.max(1, row.mfe_adr * 0.5));
    const volatileRecovery = row.mae_adr <= -2 && row.drawdown_before_profit === true && row.friday_close_adr > 0;
    const lateRunner = firstProfitHours !== null && firstProfitHours >= 72 && row.friday_close_adr > 0;
    const neverGreenLoser = row.mfe_adr < 0.25 && row.friday_close_adr < 0;
    const monsterTrend = monsterWeeks.has(row.week_open_utc);
    const deltas = Object.fromEntries(shortlistRules.map((rule) => {
      const exitRow = weeklyByKey.get(`${row.week_open_utc}|${rule.rule_id}`);
      return [rule.rule_id, round(weeklyHoldAdr - (exitRow?.exit_adr ?? 0)) ?? 0];
    }));
    return {
      week_open_utc: row.week_open_utc,
      year: row.year,
      mfe_adr: row.mfe_adr,
      mae_adr: row.mae_adr,
      friday_close_adr: row.friday_close_adr,
      peak_to_friday_giveback_adr: row.peak_to_friday_giveback_adr,
      time_to_mfe_hours: timeToMfeHours,
      time_to_mae_hours: timeToMaeHours,
      first_profit_hours: firstProfitHours,
      first_drawdown_hours: firstDrawdownHours,
      profit_before_drawdown: row.profit_before_drawdown,
      drawdown_before_profit: row.drawdown_before_profit,
      hit_plus_025: hit(row.first_positive_hits, "plus_025"),
      hit_plus_050: hit(row.first_positive_hits, "plus_050"),
      hit_plus_075: hit(row.first_positive_hits, "plus_075"),
      hit_plus_100: hit(row.first_positive_hits, "plus_100"),
      hit_plus_125: hit(row.first_positive_hits, "plus_125"),
      hit_plus_150: hit(row.first_positive_hits, "plus_150"),
      hit_plus_200: hit(row.first_positive_hits, "plus_200"),
      hit_minus_050: hit(row.first_adverse_hits, "minus_050"),
      hit_minus_100: hit(row.first_adverse_hits, "minus_100"),
      hit_minus_150: hit(row.first_adverse_hits, "minus_150"),
      hit_minus_200: hit(row.first_adverse_hits, "minus_200"),
      hit_minus_300: hit(row.first_adverse_hits, "minus_300"),
      clean_winner_week: cleanWinner,
      green_then_giveback_week: greenThenGiveback,
      volatile_recovery_week: volatileRecovery,
      late_runner_week: lateRunner,
      never_green_loser_week: neverGreenLoser,
      monster_trend_week: monsterTrend,
      primary_class: classifyPrimary({
        monsterTrend,
        greenThenGiveback,
        volatileRecovery,
        lateRunner,
        neverGreenLoser,
        cleanWinner,
      }),
      weekly_hold_adr: weeklyHoldAdr,
      shortlist_exit_delta_vs_weekly_hold: deltas,
    };
  });

  const classRows = classSummary(classified);
  const anatomyPercentiles = {
    mfe_adr: distribution(classified.map((row) => row.mfe_adr)),
    mae_adr: distribution(classified.map((row) => row.mae_adr)),
    friday_close_adr: distribution(classified.map((row) => row.friday_close_adr)),
    peak_to_friday_giveback_adr: distribution(classified.map((row) => row.peak_to_friday_giveback_adr)),
    time_to_mfe_hours: distribution(classified.map((row) => row.time_to_mfe_hours).filter((value): value is number => value !== null)),
    time_to_mae_hours: distribution(classified.map((row) => row.time_to_mae_hours).filter((value): value is number => value !== null)),
  };
  const thresholds = thresholdSummary(diagnostics);
  const topDependency = topWinnerDependency(classified, shortlistRules);
  const attribution = shortlistAttribution(classified, shortlistRules);
  const top20Share = topDependency.find((row) => row.top_weeks === 20)?.share_of_total_net_adr ?? 0;
  const greenThenGivebackRate = rate(classified.filter((row) => row.green_then_giveback_week).length, classified.length) ?? 0;
  const volatileRecoveryRate = rate(classified.filter((row) => row.volatile_recovery_week).length, classified.length) ?? 0;
  const lateRunnerRate = rate(classified.filter((row) => row.late_runner_week).length, classified.length) ?? 0;
  const recommendationSummary = recommendation({
    greenThenGivebackRate,
    top20Share,
    volatileRecoveryRate,
    lateRunnerRate,
  });
  const validation = {
    diagnostics_weeks: diagnostics.length,
    expected_weeks: GATE71_EXPECTED_WEEKS,
    weekly_hold_rows: weeklyRows.filter((row) => row.rule_id === WEEKLY_HOLD_CONTROL_ID).length,
    shortlist_rule_count: shortlistRules.length,
    raw_m1_rebuild_performed: false,
    new_exit_rules_scored: false,
    exit_promotion_performed: false,
    risk_layer_started: false,
    classified_week_count: classified.length,
    class_summary_count: classRows.length,
    top20_share_of_total_net_adr: top20Share,
    green_then_giveback_rate: greenThenGivebackRate,
    volatile_recovery_rate: volatileRecoveryRate,
    late_runner_rate: lateRunnerRate,
  };
  const pass =
    diagnostics.length === GATE71_EXPECTED_WEEKS &&
    weeklyRows.filter((row) => row.rule_id === WEEKLY_HOLD_CONTROL_ID).length === GATE71_EXPECTED_WEEKS &&
    shortlistRules.length === 4 &&
    classified.length === GATE71_EXPECTED_WEEKS;
  const artifacts = {
    weeklyClassificationLedger: toRepoRelative(path.join(artifactDir, "weekly-path-classification.rows.jsonl")),
    pathAnatomyPercentiles: toRepoRelative(path.join(artifactDir, "path-anatomy-percentiles.json")),
    thresholdAnatomy: toRepoRelative(path.join(artifactDir, "threshold-hit-anatomy.json")),
    topWinnerDependency: toRepoRelative(path.join(artifactDir, "top-winner-dependency.json")),
    shortlistAttribution: toRepoRelative(path.join(artifactDir, "shortlist-vs-weekly-hold-attribution.json")),
    summaryJson: toRepoRelative(path.join(artifactDir, "gate73a-summary.json")),
    shaIdentity: toRepoRelative(path.join(artifactDir, "gate73a-sha256.txt")),
    report: toRepoRelative(reportPath),
  };
  const summary = {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    verdict: pass ? "PASS_GATE73A_WEEKLY_BASKET_PATH_ANATOMY__RIGHT_TAIL_AND_GIVEBACK_PROFILE_VISIBLE" : "FAIL_GATE73A_WEEKLY_BASKET_PATH_ANATOMY",
    key_finding: `Top 20 weekly-hold winners contribute ${top20Share}x total net ADR, while green-then-giveback weeks occur at ${greenThenGivebackRate}. This supports runner-preserving profit protection rather than fixed close-all targets.`,
    validation,
    classification_summary: classRows,
    anatomy_percentiles: anatomyPercentiles,
    recommendation: recommendationSummary,
    artifacts,
  };

  await writeJsonl(path.join(artifactDir, "weekly-path-classification.rows.jsonl"), classified);
  await writeJson(path.join(artifactDir, "path-anatomy-percentiles.json"), anatomyPercentiles);
  await writeJson(path.join(artifactDir, "threshold-hit-anatomy.json"), thresholds);
  await writeJson(path.join(artifactDir, "top-winner-dependency.json"), topDependency);
  await writeJson(path.join(artifactDir, "shortlist-vs-weekly-hold-attribution.json"), attribution);
  await writeJson(path.join(artifactDir, "gate73a-summary.json"), summary);
  await writeText(reportPath, renderReport(summary, classRows));
  await writeShaManifest(path.join(artifactDir, "gate73a-sha256.txt"), GATE_ID, COMMAND, [
    { label: "weekly_classification_ledger", path: path.join(artifactDir, "weekly-path-classification.rows.jsonl") },
    { label: "path_anatomy_percentiles", path: path.join(artifactDir, "path-anatomy-percentiles.json") },
    { label: "threshold_anatomy", path: path.join(artifactDir, "threshold-hit-anatomy.json") },
    { label: "top_winner_dependency", path: path.join(artifactDir, "top-winner-dependency.json") },
    { label: "shortlist_attribution", path: path.join(artifactDir, "shortlist-vs-weekly-hold-attribution.json") },
    { label: "summary_json", path: path.join(artifactDir, "gate73a-summary.json") },
    { label: "report", path: reportPath },
  ]);

  if (!pass) throw new Error(summary.verdict);
  console.log(summary.verdict);
  console.log(JSON.stringify({ artifacts, validation, recommendation: recommendationSummary }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
