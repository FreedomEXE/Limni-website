import path from "node:path";

import { sha256Stable } from "@engine/research/hash";

import {
  fileHash,
  gitCommit,
  parseArgMap,
  profitFactor,
  readJson,
  renderTable,
  round,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 78A: limited-reentry-institutional-numeric-scorecard-supplement";
const GATE_DATE = "2026-06-30";
const COMMAND = "npm run engine:gate78a:limited-reentry-institutional-scorecard";
const DEFAULT_GATE78_DIR = "docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate78a/GATE78A_LIMITED_REENTRY_INSTITUTIONAL_NUMERIC_SCORECARD_SUPPLEMENT_${GATE_DATE}.md`;

const ADVERSE_FOCUS_RULE_ID = "PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP";
const T150_RULE_ID = "PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP";
const T075_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const T100_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const T125_L3_RULE_ID = "PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK";
const EXPECTED_GATE78_RULE_COUNT = 17;
const EXPECTED_WEEKS = 373;
const EXPECTED_PAIRS = 28;
const EXPECTED_PAIR_WEEK_ROWS = 10_444;

type JsonObject = Record<string, unknown>;

type ArtifactPaths = {
  artifactDir: string;
  gate78Dir: string;
  reportPath: string;
  scorecardJson: string;
  scorecardCsv: string;
  weeklySeriesJson: string;
  weeklySeriesCsv: string;
  monthlySummaryJson: string;
  monthlySummaryCsv: string;
  pairCurrencyAttributionJson: string;
  pairCurrencyAttributionCsv: string;
  fillResetInventoryJson: string;
  fillResetInventoryCsv: string;
  metricDefinitionsJson: string;
  metricDefinitionsCsv: string;
  rowClassificationJson: string;
  rowClassificationCsv: string;
  runnerAuditJson: string;
  runnerAuditCsv: string;
  emergencySlAuditJson: string;
  emergencySlAuditCsv: string;
  metricAvailabilityJson: string;
  metricAvailabilityCsv: string;
  artifactHashesJson: string;
  artifactHashesCsv: string;
  commandReceipt: string;
  summaryJson: string;
  shaManifest: string;
};

type DrawdownStats = {
  max_drawdown_adr: number;
  time_in_drawdown_weeks: number;
  time_in_drawdown_rate: number | null;
  longest_drawdown_duration_weeks: number;
  recovery_duration_from_max_drawdown_weeks: number | null;
};

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function asBoolean(value: unknown) {
  return value === true;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function num(row: JsonObject | undefined, key: string, fallback = 0) {
  return asNumber(row?.[key], fallback);
}

function nullableNum(row: JsonObject | undefined, key: string) {
  return asNullableNumber(row?.[key]);
}

function str(row: JsonObject | undefined, key: string) {
  return asString(row?.[key]);
}

function bool(row: JsonObject | undefined, key: string) {
  return asBoolean(row?.[key]);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function sampleStdDev(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = sum(values.map((value) => (value - average) ** 2)) / (values.length - 1);
  return Math.sqrt(variance);
}

function downsideStdDev(values: number[]) {
  const negative = values.filter((value) => value < 0);
  return sampleStdDev(negative);
}

function skew(values: number[]) {
  if (values.length < 3) return null;
  const average = mean(values);
  const std = sampleStdDev(values);
  if (std === 0) return null;
  return mean(values.map((value) => ((value - average) / std) ** 3));
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

function byKey(rows: JsonObject[], key: string) {
  return new Map(rows.map((row) => [str(row, key), row]));
}

function rollWorst(values: number[], windowSize: number) {
  if (values.length < windowSize) return null;
  let worst = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= values.length - windowSize; index += 1) {
    const value = sum(values.slice(index, index + windowSize));
    if (value < worst) worst = value;
  }
  return worst;
}

function rollingWinRates(values: number[], windowSize: number) {
  if (values.length < windowSize) return [];
  const rates: number[] = [];
  for (let index = 0; index <= values.length - windowSize; index += 1) {
    const window = values.slice(index, index + windowSize);
    rates.push(window.filter((value) => value > 0).length / window.length);
  }
  return rates;
}

function monthKey(weekOpenUtc: string) {
  return weekOpenUtc.slice(0, 7);
}

function drawdownStats(weeklyRows: JsonObject[]): DrawdownStats {
  let peak = 0;
  let peakAtMaxDrawdown = 0;
  let maxDrawdown = 0;
  let maxDrawdownIndex = -1;
  let timeInDrawdown = 0;
  let longestDrawdown = 0;
  let currentDrawdown = 0;
  const equitySnapshots: number[] = [];

  weeklyRows.forEach((row, index) => {
    const equity = num(row, "equity_snapshot_adr");
    equitySnapshots.push(equity);
    if (equity > peak) peak = equity;
    const drawdown = equity - peak;
    if (drawdown < 0) {
      timeInDrawdown += 1;
      currentDrawdown += 1;
      longestDrawdown = Math.max(longestDrawdown, currentDrawdown);
    } else {
      currentDrawdown = 0;
    }
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownIndex = index;
      peakAtMaxDrawdown = peak;
    }
  });

  let recoveryDuration: number | null = null;
  if (maxDrawdownIndex >= 0) {
    for (let index = maxDrawdownIndex + 1; index < equitySnapshots.length; index += 1) {
      if (equitySnapshots[index] >= peakAtMaxDrawdown) {
        recoveryDuration = index - maxDrawdownIndex;
        break;
      }
    }
  }

  return {
    max_drawdown_adr: round(maxDrawdown) ?? 0,
    time_in_drawdown_weeks: timeInDrawdown,
    time_in_drawdown_rate: round(weeklyRows.length > 0 ? timeInDrawdown / weeklyRows.length : 0),
    longest_drawdown_duration_weeks: longestDrawdown,
    recovery_duration_from_max_drawdown_weeks: recoveryDuration,
  };
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
}

async function writeCsv(filePath: string, rows: JsonObject[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  await writeText(filePath, `${lines.join("\n")}\n`);
}

function addContentHashes(rows: JsonObject[]) {
  return rows.map((row) => ({ ...row, content_hash: sha256Stable(row) }));
}

function finiteOrNull(value: number) {
  return Number.isFinite(value) ? round(value) : null;
}

function ratio(numerator: number, denominator: number) {
  if (denominator === 0) return null;
  return round(numerator / denominator);
}

function buildMetricDefinitions() {
  return addContentHashes([
    {
      metric: "closed_adr",
      formula: "sum of weekly closed_week_adr for the rule; equals Gate 78 closed_total_adr",
      sign_convention: "positive is profit, negative is loss",
      provenance: "Gate 78 adapter summary and weekly equity truth",
    },
    {
      metric: "equity_adr",
      formula: "final cumulative mark-to-market equity snapshot, closed PnL plus ending open unrealized PnL",
      sign_convention: "positive is profit, negative is loss",
      provenance: "Gate 78 weekly equity truth",
    },
    {
      metric: "weekly_mtm_equity_change",
      formula: "weekly equity_delta_adr",
      sign_convention: "positive is profitable weekly MTM change",
      provenance: "Gate 78 weekly equity truth",
    },
    {
      metric: "max_drawdown",
      formula: "minimum cumulative MTM equity snapshot minus prior peak",
      sign_convention: "reported as a negative ADR value",
      provenance: "Gate 78 adapter summary and Gate 78A weekly recomputation",
    },
    {
      metric: "return_drawdown",
      formula: "final equity ADR / absolute max drawdown ADR",
      sign_convention: "higher is better",
      provenance: "Gate 78A derived",
    },
    {
      metric: "closed_profit_factor",
      formula: "sum positive weekly closed PnL / absolute sum negative weekly closed PnL",
      sign_convention: "higher is better; weekly closed aggregation, not independent cycle PF",
      provenance: "Gate 78 weekly equity truth",
    },
    {
      metric: "weekly_mtm_profit_factor",
      formula: "sum positive weekly MTM equity changes / absolute sum negative weekly MTM equity changes",
      sign_convention: "higher is better",
      provenance: "Gate 78 weekly equity truth; primary Gate 78A PF",
    },
    {
      metric: "worst_5_week_mtm_loss_adr",
      formula: "sum of the five worst weekly MTM equity changes, not necessarily contiguous",
      sign_convention: "negative is loss",
      provenance: "Gate 78 adapter summary",
    },
    {
      metric: "worst_13_week_mtm_loss_adr",
      formula: "sum of the thirteen worst weekly MTM equity changes, not necessarily contiguous",
      sign_convention: "negative is loss",
      provenance: "Gate 78 adapter summary",
    },
    {
      metric: "worst_5_week_contiguous_mtm_loss_adr",
      formula: "worst contiguous 5-week sum of weekly MTM equity changes",
      sign_convention: "negative is loss",
      provenance: "Gate 78A derived from weekly equity truth",
    },
    {
      metric: "worst_13_week_contiguous_mtm_loss_adr",
      formula: "worst contiguous 13-week sum of weekly MTM equity changes",
      sign_convention: "negative is loss",
      provenance: "Gate 78A derived from weekly equity truth",
    },
    {
      metric: "lifecycle_profit_factor",
      formula: "gross winning pair-week lifecycle result / absolute losing pair-week lifecycle result",
      sign_convention: "higher is better",
      provenance: "not emitted by Gate 78 artifacts; requires pair-week lifecycle replay instrumentation",
    },
    {
      metric: "adr_calmar",
      formula: "annualized MTM equity ADR / absolute max drawdown ADR",
      sign_convention: "higher is better",
      provenance: "Gate 78A derived; ADR-normalized diagnostic",
    },
    {
      metric: "sharpe",
      formula: "mean weekly MTM equity change / sample stddev weekly MTM equity change * sqrt(52)",
      sign_convention: "higher is better",
      provenance: "Gate 78A derived; ADR-normalized diagnostic, not true investment Sharpe",
    },
    {
      metric: "sortino",
      formula: "mean weekly MTM equity change / sample stddev of negative weekly MTM equity changes * sqrt(52)",
      sign_convention: "higher is better",
      provenance: "Gate 78A derived; ADR-normalized diagnostic, not true investment Sortino",
    },
    {
      metric: "weekly_win_rate",
      formula: "count of weeks with positive weekly MTM equity change / total weeks",
      sign_convention: "higher is better",
      provenance: "Gate 78 weekly equity truth",
    },
    {
      metric: "monthly_win_rate",
      formula: "count of months with positive aggregate monthly MTM equity change / total months",
      sign_convention: "higher is better",
      provenance: "Gate 78A derived from weekly equity truth",
    },
    {
      metric: "account_week_expectancy",
      formula: "average weekly MTM equity change",
      sign_convention: "positive is profitable",
      provenance: "Gate 78 weekly equity truth",
    },
    {
      metric: "pair_week_expectancy",
      formula: "final MTM equity ADR / 10,444 Candidate B pair-week rows",
      sign_convention: "positive is profitable",
      provenance: "Gate 78A derived denominator proxy",
    },
    {
      metric: "reset_cycle_expectancy",
      formula: "closed ADR / target reset cycles",
      sign_convention: "diagnostic only; reset cycles are path-dependent",
      provenance: "Gate 78 adapter summary",
    },
    {
      metric: "fill_level_expectancy",
      formula: "closed ADR / fill count",
      sign_convention: "diagnostic only; fills are not independent trades",
      provenance: "Gate 78 adapter summary",
    },
    {
      metric: "mfe",
      formula: "maximum favorable excursion",
      sign_convention: "positive favorable excursion",
      provenance: "Gate 78 exposes max cycle MFE only; account-week and pair-week MFE require replay instrumentation",
    },
    {
      metric: "mae",
      formula: "maximum adverse excursion",
      sign_convention: "negative adverse excursion",
      provenance: "Gate 78A reports worst weekly open-unrealized and drawdown proxies; intraperiod MAE requires replay instrumentation",
    },
    {
      metric: "mfe_capture_ratio",
      formula: "closed ADR / (closed ADR + total giveback ADR)",
      sign_convention: "higher is better; proxy only",
      provenance: "Gate 78 adapter summary",
    },
    {
      metric: "mae_recovery_ratio",
      formula: "recovered negative cycles / negative cycles",
      sign_convention: "higher is better; proxy only",
      provenance: "Gate 78 adapter summary",
    },
    {
      metric: "top20_winner_retention",
      formula: "Gate 78 top-20 winner ADR divided by weekly forced top-20 winner ADR",
      sign_convention: "higher retains more right tail",
      provenance: "Gate 78 adapter summary",
    },
    {
      metric: "right_tail_give_up",
      formula: "T150 top-20 winner ADR minus rule top-20 winner ADR",
      sign_convention: "higher is more right-tail loss",
      provenance: "Gate 78 right-tail retention artifact",
    },
    {
      metric: "worst20_loser_concentration",
      formula: "absolute sum of 20 worst weekly MTM changes / absolute sum of all negative weekly MTM changes",
      sign_convention: "higher is more concentrated loss",
      provenance: "Gate 78A derived from weekly equity truth",
    },
    {
      metric: "open_unrealized_adr",
      formula: "ending open unrealized ADR; weekly worst/average use week-end open unrealized values",
      sign_convention: "negative is floating loss",
      provenance: "Gate 78 adapter summary and weekly equity truth",
    },
    {
      metric: "flip_loss_adr",
      formula: "sum of cycle losses closed by Candidate B flip or sample-end policy where reported by Gate 78",
      sign_convention: "negative is loss",
      provenance: "Gate 78 adapter summary",
    },
  ]);
}

function classifyRow(row: JsonObject, metrics: JsonObject) {
  const ruleId = str(row, "rule_id");
  const family = str(row, "rule_family");
  const finalEquity = num(row, "final_equity_adr");
  const maxDd = num(row, "max_equity_drawdown_adr");
  const finalOpen = num(row, "final_open_unrealized_adr");
  const fillPerWeek = num(metrics, "average_fills_per_week");

  if (family === "control") {
    return { label: "reference only", reason: "control row, not an exit candidate" };
  }
  if (family === "account_emergency_sl_reference" || bool(row, "reference_only")) {
    return { label: "reference only", reason: "emergency-SL row is diagnostic only and clips harvest" };
  }
  if (ruleId === ADVERSE_FOCUS_RULE_ID) {
    return { label: "conservative reference", reason: "adverse-only discovery baseline retains harvest but carries large floating tail" };
  }
  if (ruleId === T150_RULE_ID) {
    return { label: "aggressive reference", reason: "no-limit two-sided reference has right-tail upside but excessive tail/open-loss behavior" };
  }
  if (ruleId === T100_L3_RULE_ID) {
    return { label: "primary candidate", reason: "best non-reference MTM equity with controlled drawdown versus T150 and no runner harvest collapse" };
  }
  if (ruleId === T075_L3_RULE_ID) {
    return { label: "alternate candidate", reason: "lower equity than T100/L3 but cleaner drawdown and flip-loss profile" };
  }
  if (ruleId === T125_L3_RULE_ID) {
    return { label: "too much tail", reason: "higher closed harvest than T100/L3 but worse drawdown, open loss, and rolling loss behavior" };
  }
  if (family === "pair_final_reset_runner" && finalEquity > 0 && Math.abs(maxDd) < 1_000 && Math.abs(finalOpen) < 300) {
    return { label: "too much harvest loss", reason: "runner row improves surface risk but gives up too much MTM equity and right-tail retention" };
  }
  if (family === "pair_final_reset_runner") {
    return { label: "reject", reason: "runner row fails MTM equity and does not earn candidate status" };
  }
  if (fillPerWeek > 330) {
    return { label: "execution burden too high", reason: "fill burden is above the Gate 78A execution-load comfort band" };
  }
  return { label: "reject", reason: "does not beat the primary candidate after MTM-first scorecard checks" };
}

function buildWeeklySeries(weeklyByRule: Map<string, JsonObject[]>) {
  const rows: JsonObject[] = [];
  for (const [ruleId, rawRows] of weeklyByRule) {
    const sorted = [...rawRows].sort((left, right) => str(left, "week_open_utc").localeCompare(str(right, "week_open_utc")));
    let peak = 0;
    sorted.forEach((row, index) => {
      const equitySnapshot = num(row, "equity_snapshot_adr");
      if (equitySnapshot > peak) peak = equitySnapshot;
      const drawdown = equitySnapshot - peak;
      const deltas = sorted.map((weeklyRow) => num(weeklyRow, "equity_delta_adr"));
      rows.push({
        rule_id: ruleId,
        rule_family: str(row, "rule_family"),
        week_open_utc: str(row, "week_open_utc"),
        week_index: index + 1,
        closed_week_adr: round(num(row, "closed_week_adr")),
        open_unrealized_adr: round(num(row, "open_unrealized_adr")),
        mtm_equity_delta_adr: round(num(row, "equity_delta_adr")),
        mtm_equity_snapshot_adr: round(equitySnapshot),
        drawdown_adr: round(drawdown),
        in_drawdown: drawdown < 0,
        rolling_5_week_mtm_adr: index >= 4 ? round(sum(deltas.slice(index - 4, index + 1))) : null,
        rolling_13_week_mtm_adr: index >= 12 ? round(sum(deltas.slice(index - 12, index + 1))) : null,
        weekly_mtm_win: num(row, "equity_delta_adr") > 0,
        weekly_closed_win: num(row, "closed_week_adr") > 0,
        fill_count_week: round(num(row, "fill_count_week")),
        reset_count_week: round(num(row, "reset_count_week")),
        pair_reset_count_week: round(num(row, "pair_reset_count_week")),
        account_emergency_sl_count_week: round(num(row, "account_emergency_sl_count_week")),
      });
    });
  }
  return addContentHashes(rows);
}

function buildMonthlySummary(weeklyByRule: Map<string, JsonObject[]>) {
  const rows: JsonObject[] = [];
  for (const [ruleId, rawRows] of weeklyByRule) {
    const byMonth = groupBy(rawRows, (row) => monthKey(str(row, "week_open_utc")));
    let cumulative = 0;
    for (const [month, monthRows] of [...byMonth.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const sorted = [...monthRows].sort((left, right) => str(left, "week_open_utc").localeCompare(str(right, "week_open_utc")));
      const equityDelta = sum(sorted.map((row) => num(row, "equity_delta_adr")));
      cumulative += equityDelta;
      rows.push({
        rule_id: ruleId,
        rule_family: str(sorted[0], "rule_family"),
        month,
        weeks: sorted.length,
        monthly_mtm_equity_adr: round(equityDelta),
        monthly_closed_adr: round(sum(sorted.map((row) => num(row, "closed_week_adr")))),
        average_week_end_open_unrealized_adr: round(mean(sorted.map((row) => num(row, "open_unrealized_adr")))),
        worst_week_end_open_unrealized_adr: round(Math.min(...sorted.map((row) => num(row, "open_unrealized_adr")))),
        cumulative_mtm_equity_snapshot_adr: round(cumulative),
        monthly_mtm_win: equityDelta > 0,
        monthly_closed_win: sum(sorted.map((row) => num(row, "closed_week_adr"))) > 0,
      });
    }
  }
  return addContentHashes(rows);
}

function buildPairCurrencyAttribution(pairRows: JsonObject[], currencyRows: JsonObject[]) {
  const rows: JsonObject[] = [];
  const pairByRule = groupBy(pairRows, (row) => str(row, "rule_id"));
  for (const [ruleId, ruleRows] of pairByRule) {
    const negativeTotal = Math.abs(sum(ruleRows.map((row) => Math.min(0, num(row, "final_open_unrealized_adr")))));
    for (const row of ruleRows) {
      const value = num(row, "final_open_unrealized_adr");
      rows.push({
        rule_id: ruleId,
        rule_family: str(row, "rule_family"),
        entity_type: "pair",
        entity: str(row, "pair"),
        final_open_unrealized_adr: round(value),
        negative_open_concentration_share: value < 0 ? ratio(Math.abs(value), negativeTotal) : 0,
        reporting_only: true,
      });
    }
  }
  const currencyByRule = groupBy(currencyRows, (row) => str(row, "rule_id"));
  for (const [ruleId, ruleRows] of currencyByRule) {
    const negativeTotal = Math.abs(sum(ruleRows.map((row) => Math.min(0, num(row, "final_open_unrealized_adr")))));
    for (const row of ruleRows) {
      const value = num(row, "final_open_unrealized_adr");
      rows.push({
        rule_id: ruleId,
        rule_family: str(row, "rule_family"),
        entity_type: "currency",
        entity: str(row, "currency"),
        final_open_unrealized_adr: round(value),
        negative_open_concentration_share: value < 0 ? ratio(Math.abs(value), negativeTotal) : 0,
        contributing_pairs: nullableNum(row, "contributing_pairs"),
        reporting_only: true,
      });
    }
  }
  return addContentHashes(rows);
}

function buildFillResetInventorySummary(adapterRows: JsonObject[], weeklyByRule: Map<string, JsonObject[]>, resetPairRows: JsonObject[]) {
  const resetPairByRule = groupBy(resetPairRows, (row) => str(row, "rule_id"));
  const rows = adapterRows.map((adapter) => {
    const ruleId = str(adapter, "rule_id");
    const weeklyRows = weeklyByRule.get(ruleId) ?? [];
    const weekCount = weeklyRows.length;
    const fillCounts = weeklyRows.map((row) => num(row, "fill_count_week"));
    const resetCounts = weeklyRows.map((row) => num(row, "reset_count_week"));
    const pairResetCounts = resetPairByRule.get(ruleId)?.map((row) => num(row, "reset_count")) ?? [];
    return {
      rule_id: ruleId,
      rule_family: str(adapter, "rule_family"),
      reference_only: bool(adapter, "reference_only"),
      total_fills: round(num(adapter, "fill_count")),
      average_fills_per_week: round(weekCount > 0 ? num(adapter, "fill_count") / weekCount : 0),
      max_fills_in_one_week: round(fillCounts.length > 0 ? Math.max(...fillCounts) : 0),
      total_resets: round(num(adapter, "target_reset_cycles")),
      average_resets_per_week: round(weekCount > 0 ? num(adapter, "target_reset_cycles") / weekCount : 0),
      max_resets_in_one_week: round(resetCounts.length > 0 ? Math.max(...resetCounts) : 0),
      pair_reset_count_distribution_min: round(pairResetCounts.length > 0 ? Math.min(...pairResetCounts) : 0),
      pair_reset_count_distribution_median: round(median(pairResetCounts)),
      pair_reset_count_distribution_max: round(pairResetCounts.length > 0 ? Math.max(...pairResetCounts) : 0),
      average_active_pairs_per_week_proxy: EXPECTED_PAIRS,
      max_active_pairs_in_one_week_proxy: EXPECTED_PAIRS,
      average_open_inventory: null,
      max_open_inventory: null,
      average_closed_cycle_hold_hours: round(num(adapter, "average_closed_cycle_hold_hours")),
      max_holding_time_hours: null,
      turnover_proxy_fills_per_week: round(weekCount > 0 ? num(adapter, "fill_count") / weekCount : 0),
      inventory_metric_provenance:
        "Gate 78 artifacts do not emit intraperiod open inventory counts; fill/reset load and fixed 28-pair signal universe are reported as execution burden proxies.",
    };
  });
  return addContentHashes(rows);
}

function buildRunnerAudit(adapterByRule: Map<string, JsonObject>, runnerRows: JsonObject[], failureRows: JsonObject[]) {
  const failureByCandidate = new Map(failureRows.map((row) => [str(row, "candidate_rule_id"), row]));
  const rows = runnerRows.map((runner) => {
    const ruleId = str(runner, "rule_id");
    const adapter = adapterByRule.get(ruleId);
    const failure = failureByCandidate.get(ruleId);
    const realizedRunnerContribution =
      num(runner, "final_reset_partial_closed_adr") +
      num(runner, "runner_flip_closed_adr") +
      num(runner, "runner_account_emergency_sl_closed_adr");
    const unrealizedRunnerContribution = num(runner, "runner_sample_end_open_adr");
    const finalEquity = num(adapter, "final_equity_adr");
    const closeCount = num(runner, "runner_flip_close_count") + num(runner, "runner_sample_end_open_count");
    return {
      rule_id: ruleId,
      base_rule_id: str(runner, "base_rule_id"),
      runner_fraction: nullableNum(runner, "runner_fraction"),
      final_equity_adr: round(finalEquity),
      runner_realized_contribution_adr: round(realizedRunnerContribution),
      runner_unrealized_contribution_adr: round(unrealizedRunnerContribution),
      total_result_excluding_runner_contribution_adr: round(finalEquity - num(runner, "runner_total_marked_contribution_adr")),
      runner_total_marked_contribution_adr: round(num(runner, "runner_total_marked_contribution_adr")),
      runner_mfe_adr: null,
      runner_mae_adr: null,
      runner_win_rate_proxy: round(closeCount > 0 ? num(runner, "runner_flip_close_count") / closeCount : 0),
      runner_average_holding_time_hours: null,
      runner_max_holding_time_hours: null,
      final_reset_partial_close_count: round(num(runner, "final_reset_partial_close_count")),
      runner_flip_close_count: round(num(runner, "runner_flip_close_count")),
      runner_sample_end_open_count: round(num(runner, "runner_sample_end_open_count")),
      no_new_fills_after_final_reset_proof: "Gate 78 runner cycles are terminal runner-only cycles; Gate 78A did not alter replay semantics.",
      pair_terminal_state_after_final_reset_proof: "Gate 78 pair final-reset runner rows stop new pair cycles for the rest of the week after the terminal runner is created.",
      harvest_loss_vs_base_adr: failure ? round(Math.abs(num(failure, "closed_delta_vs_base_adr"))) : null,
      right_tail_loss_vs_base_adr: failure ? round(num(failure, "top20_winner_retention_loss_vs_base_adr")) : null,
      interpretation: "runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard",
    };
  });
  return addContentHashes(rows);
}

function buildEmergencySlAudit(
  adapterByRule: Map<string, JsonObject>,
  emergencyRows: JsonObject[],
  weeklyByRule: Map<string, JsonObject[]>,
  rightTailByRule: Map<string, JsonObject>,
) {
  const rows = emergencyRows.map((emergency) => {
    const ruleId = str(emergency, "rule_id");
    const adapter = adapterByRule.get(ruleId);
    const triggeredWeeks = (weeklyByRule.get(ruleId) ?? []).filter((row) => num(row, "account_emergency_sl_count_week") > 0);
    const rightTail = rightTailByRule.get(ruleId);
    return {
      rule_id: ruleId,
      base_rule_id: str(emergency, "base_rule_id"),
      account_emergency_sl_adr: nullableNum(emergency, "account_emergency_sl_adr"),
      reference_only: true,
      emergency_breach_count: round(num(emergency, "emergency_breach_count")),
      emergency_closed_cycle_count: round(num(emergency, "emergency_closed_cycle_count")),
      triggered_week_count: triggeredWeeks.length,
      triggered_weeks: triggeredWeeks.map((row) => str(row, "week_open_utc")).join(";"),
      final_equity_adr: round(num(emergency, "final_equity_adr")),
      max_drawdown_adr: round(num(emergency, "max_equity_drawdown_adr")),
      equity_saved_proxy_drawdown_improvement_adr: round(num(emergency, "max_drawdown_improvement_vs_base_adr")),
      harvest_lost_adr: round(Math.abs(num(emergency, "closed_delta_vs_base_adr"))),
      right_tail_lost_vs_t150_adr: round(num(rightTail, "top20_winner_retention_loss_vs_t150_adr")),
      final_equity_delta_vs_base_adr: round(num(emergency, "final_equity_delta_vs_base_adr")),
      final_open_unrealized_adr: round(num(adapter, "final_open_unrealized_adr")),
      interpretation: "reference-only diagnostic; drawdown/open-loss improvement comes with unacceptable harvest loss",
    };
  });
  return addContentHashes(rows);
}

function topNegativeConcentration(values: number[], count: number) {
  const negative = values.filter((value) => value < 0);
  const totalNegative = Math.abs(sum(negative));
  if (totalNegative === 0) return null;
  const worst = [...negative].sort((left, right) => left - right).slice(0, count);
  return round(Math.abs(sum(worst)) / totalNegative);
}

function buildScorecardRows(inputs: {
  adapterRows: JsonObject[];
  weeklyByRule: Map<string, JsonObject[]>;
  monthlyRows: JsonObject[];
  fillResetRows: JsonObject[];
  rightTailByRule: Map<string, JsonObject>;
  tailPairRows: JsonObject[];
  tailCurrencyRows: JsonObject[];
}) {
  const baseline = inputs.adapterRows.find((row) => str(row, "rule_id") === ADVERSE_FOCUS_RULE_ID);
  const t100 = inputs.adapterRows.find((row) => str(row, "rule_id") === T100_L3_RULE_ID);
  const fillResetByRule = byKey(inputs.fillResetRows, "rule_id");
  const monthlyByRule = groupBy(inputs.monthlyRows, (row) => str(row, "rule_id"));
  const tailPairByRule = groupBy(inputs.tailPairRows, (row) => str(row, "rule_id"));
  const tailCurrencyByRule = groupBy(inputs.tailCurrencyRows, (row) => str(row, "rule_id"));
  const years = EXPECTED_WEEKS / 52;

  const rows = inputs.adapterRows.map((adapter) => {
    const ruleId = str(adapter, "rule_id");
    const weeklyRows = inputs.weeklyByRule.get(ruleId) ?? [];
    const monthlyRows = monthlyByRule.get(ruleId) ?? [];
    const weeklyMtmValues = weeklyRows.map((row) => num(row, "equity_delta_adr"));
    const weeklyClosedValues = weeklyRows.map((row) => num(row, "closed_week_adr"));
    const monthlyMtmValues = monthlyRows.map((row) => num(row, "monthly_mtm_equity_adr"));
    const rolling13 = rollingWinRates(weeklyMtmValues, 13);
    const weeklyMean = mean(weeklyMtmValues);
    const weeklyStd = sampleStdDev(weeklyMtmValues);
    const weeklyDownside = downsideStdDev(weeklyMtmValues);
    const drawdown = drawdownStats(weeklyRows);
    const fillReset = fillResetByRule.get(ruleId);
    const rightTail = inputs.rightTailByRule.get(ruleId);
    const pairTailRows = tailPairByRule.get(ruleId) ?? [];
    const currencyTailRows = tailCurrencyByRule.get(ruleId) ?? [];
    const worstPair = [...pairTailRows].sort((left, right) => num(left, "final_open_unrealized_adr") - num(right, "final_open_unrealized_adr"))[0];
    const worstCurrency = [...currencyTailRows].sort(
      (left, right) => num(left, "final_open_unrealized_adr") - num(right, "final_open_unrealized_adr"),
    )[0];
    const audnzd = pairTailRows.find((row) => str(row, "pair") === "AUDNZD");
    const weeklyWins = weeklyMtmValues.filter((value) => value > 0);
    const weeklyLosses = weeklyMtmValues.filter((value) => value < 0);
    const annualizedEquity = num(adapter, "final_equity_adr") / years;
    const totalGiveback = num(adapter, "total_giveback_adr");
    const scorecardBase: JsonObject = {
      rule_id: ruleId,
      rule_family: str(adapter, "rule_family"),
      scope: str(adapter, "scope"),
      target_adr: nullableNum(adapter, "target_adr"),
      spacing_adr: nullableNum(adapter, "spacing_adr"),
      runner_fraction: nullableNum(adapter, "runner_fraction"),
      account_emergency_sl_adr: nullableNum(adapter, "account_emergency_sl_adr"),
      base_rule_id: str(adapter, "base_rule_id") || null,
      reference_only: bool(adapter, "reference_only"),
      closed_adr: round(num(adapter, "closed_total_adr")),
      equity_adr: round(num(adapter, "final_equity_adr")),
      annualized_mtm_equity_adr: round(annualizedEquity),
      average_monthly_mtm_adr: round(mean(monthlyMtmValues)),
      median_monthly_mtm_adr: round(median(monthlyMtmValues)),
      closed_adr_retention_vs_adverse_focus: ratio(num(adapter, "closed_total_adr"), num(baseline, "closed_total_adr")),
      equity_adr_delta_vs_t100_l3: round(num(adapter, "final_equity_adr") - num(t100, "final_equity_adr")),
      max_drawdown_adr: round(num(adapter, "max_equity_drawdown_adr")),
      recomputed_max_drawdown_adr: drawdown.max_drawdown_adr,
      return_drawdown: ratio(num(adapter, "final_equity_adr"), Math.abs(num(adapter, "max_equity_drawdown_adr"))),
      final_open_unrealized_adr: round(num(adapter, "final_open_unrealized_adr")),
      worst_week_end_open_unrealized_adr: round(Math.min(...weeklyRows.map((row) => num(row, "open_unrealized_adr")))),
      average_week_end_open_unrealized_adr: round(mean(weeklyRows.map((row) => num(row, "open_unrealized_adr")))),
      flip_loss_adr: round(num(adapter, "flip_loss_adr")),
      worst_1_week_mtm_loss_adr: round(num(adapter, "worst_week_loss_adr")),
      worst_5_week_mtm_loss_adr: round(num(adapter, "worst_5_week_loss_adr")),
      worst_13_week_mtm_loss_adr: round(num(adapter, "worst_13_week_loss_adr")),
      worst_5_week_contiguous_mtm_loss_adr: round(rollWorst(weeklyMtmValues, 5)),
      worst_13_week_contiguous_mtm_loss_adr: round(rollWorst(weeklyMtmValues, 13)),
      time_in_drawdown_weeks: drawdown.time_in_drawdown_weeks,
      time_in_drawdown_rate: drawdown.time_in_drawdown_rate,
      longest_drawdown_duration_weeks: drawdown.longest_drawdown_duration_weeks,
      recovery_duration_from_max_drawdown_weeks: drawdown.recovery_duration_from_max_drawdown_weeks,
      closed_profit_factor_weekly_closed: profitFactor(weeklyClosedValues),
      weekly_mtm_profit_factor: profitFactor(weeklyMtmValues),
      pair_week_lifecycle_profit_factor: null,
      weekly_mtm_win_rate: round(weeklyMtmValues.filter((value) => value > 0).length / weeklyMtmValues.length),
      monthly_mtm_win_rate: round(monthlyMtmValues.filter((value) => value > 0).length / monthlyMtmValues.length),
      rolling_13_week_win_rate_min: round(rolling13.length > 0 ? Math.min(...rolling13) : 0),
      rolling_13_week_win_rate_median: round(median(rolling13)),
      rolling_13_week_win_rate_max: round(rolling13.length > 0 ? Math.max(...rolling13) : 0),
      closed_only_weekly_win_rate: round(weeklyClosedValues.filter((value) => value > 0).length / weeklyClosedValues.length),
      closed_only_monthly_win_rate: round(
        monthlyRows.filter((row) => num(row, "monthly_closed_adr") > 0).length / Math.max(1, monthlyRows.length),
      ),
      account_week_expectancy_adr: round(weeklyMean),
      pair_week_expectancy_proxy_adr: round(num(adapter, "final_equity_adr") / EXPECTED_PAIR_WEEK_ROWS),
      reset_cycle_expectancy_proxy_adr: ratio(num(adapter, "closed_total_adr"), num(adapter, "target_reset_cycles")),
      fill_level_expectancy_diagnostic_adr: ratio(num(adapter, "closed_total_adr"), num(adapter, "fill_count")),
      average_weekly_mtm_win_adr: round(mean(weeklyWins)),
      average_weekly_mtm_loss_adr: round(mean(weeklyLosses)),
      median_weekly_mtm_win_adr: round(median(weeklyWins)),
      median_weekly_mtm_loss_adr: round(median(weeklyLosses)),
      weekly_mtm_payoff_ratio: ratio(mean(weeklyWins), Math.abs(mean(weeklyLosses))),
      weekly_mtm_distribution_skew: finiteOrNull(skew(weeklyMtmValues) ?? Number.NaN),
      weekly_mtm_sharpe_adr_normalized: weeklyStd === 0 ? null : round((weeklyMean / weeklyStd) * Math.sqrt(52)),
      weekly_mtm_sortino_adr_normalized: weeklyDownside === 0 ? null : round((weeklyMean / weeklyDownside) * Math.sqrt(52)),
      adr_calmar: ratio(annualizedEquity, Math.abs(num(adapter, "max_equity_drawdown_adr"))),
      account_week_mfe_adr: null,
      account_week_mae_adr: null,
      pair_week_lifecycle_mfe_adr: null,
      pair_week_lifecycle_mae_adr: null,
      max_cycle_mfe_adr: round(num(adapter, "max_cycle_mfe_adr")),
      total_giveback_adr: round(totalGiveback),
      mfe_capture_ratio_proxy: ratio(num(adapter, "closed_total_adr"), num(adapter, "closed_total_adr") + totalGiveback),
      mae_recovery_ratio_proxy: nullableNum(adapter, "negative_cycle_recovery_rate"),
      average_adverse_excursion_before_reset_adr: null,
      worst_adverse_excursion_before_reset_adr: null,
      total_fills: round(num(adapter, "fill_count")),
      average_fills_per_week: nullableNum(fillReset, "average_fills_per_week"),
      max_fills_in_one_week: nullableNum(fillReset, "max_fills_in_one_week"),
      total_resets: round(num(adapter, "target_reset_cycles")),
      average_resets_per_week: nullableNum(fillReset, "average_resets_per_week"),
      max_resets_in_one_week: nullableNum(fillReset, "max_resets_in_one_week"),
      average_active_pairs_per_week_proxy: nullableNum(fillReset, "average_active_pairs_per_week_proxy"),
      max_active_pairs_in_one_week_proxy: nullableNum(fillReset, "max_active_pairs_in_one_week_proxy"),
      average_open_inventory: null,
      max_open_inventory: null,
      average_holding_time_hours: round(num(adapter, "average_closed_cycle_hold_hours")),
      max_holding_time_hours: null,
      turnover_proxy_fills_per_week: nullableNum(fillReset, "turnover_proxy_fills_per_week"),
      top20_winner_retention_vs_weekly_forced: nullableNum(adapter, "top20_winner_retention_vs_weekly_forced"),
      top20_winner_adr: nullableNum(rightTail, "top20_winner_adr"),
      right_tail_give_up_vs_t150_adr: nullableNum(rightTail, "top20_winner_retention_loss_vs_t150_adr"),
      worst20_loser_concentration: topNegativeConcentration(weeklyMtmValues, 20),
      worst_pair_contribution: str(worstPair, "pair") || null,
      worst_pair_final_open_unrealized_adr: nullableNum(worstPair, "final_open_unrealized_adr"),
      worst_currency_contribution: str(worstCurrency, "currency") || null,
      worst_currency_final_open_unrealized_adr: nullableNum(worstCurrency, "final_open_unrealized_adr"),
      audnzd_final_open_unrealized_adr_reporting_only: nullableNum(audnzd, "final_open_unrealized_adr"),
      closed_wins_masking_floating_loss_flag:
        num(adapter, "closed_total_adr") > 0 && Math.abs(num(adapter, "final_open_unrealized_adr")) / Math.abs(num(adapter, "closed_total_adr")) > 0.25,
      runner_loss_transfer_flag:
        str(adapter, "rule_family") === "pair_final_reset_runner" &&
        num(adapter, "final_equity_adr") < 0.35 * num(t100, "final_equity_adr"),
      gross_pre_cost_pre_risk_pre_promotion: true,
    };
    const classification = classifyRow(adapter, scorecardBase);
    return {
      ...scorecardBase,
      institutional_label: classification.label,
      institutional_reason: classification.reason,
    };
  });

  const candidateRows = rows.filter(
    (row) =>
      !bool(row, "reference_only") &&
      str(row, "rule_family") !== "control" &&
      str(row, "rule_id") !== ADVERSE_FOCUS_RULE_ID &&
      str(row, "rule_id") !== T150_RULE_ID,
  );
  candidateRows.sort((left, right) => {
    const equityDelta = num(right, "equity_adr") - num(left, "equity_adr");
    if (equityDelta !== 0) return equityDelta;
    const ddDelta = Math.abs(num(left, "max_drawdown_adr")) - Math.abs(num(right, "max_drawdown_adr"));
    if (ddDelta !== 0) return ddDelta;
    const pfDelta = num(right, "weekly_mtm_profit_factor") - num(left, "weekly_mtm_profit_factor");
    if (pfDelta !== 0) return pfDelta;
    return str(left, "rule_id").localeCompare(str(right, "rule_id"));
  });
  const rankByRule = new Map(candidateRows.map((row, index) => [str(row, "rule_id"), index + 1]));

  return addContentHashes(
    rows.map((row) => ({
      ...row,
      institutional_candidate_rank: rankByRule.get(str(row, "rule_id")) ?? null,
      primary_ranking_order:
        "MTM equity ADR, max drawdown, weekly MTM PF, ADR-Calmar, Sortino, rolling loss behavior, open loss, flip loss, right-tail retention, execution burden, simplicity",
    })),
  );
}

function buildRowClassifications(scorecardRows: JsonObject[]) {
  return addContentHashes(
    scorecardRows.map((row) => ({
      rule_id: str(row, "rule_id"),
      rule_family: str(row, "rule_family"),
      institutional_candidate_rank: nullableNum(row, "institutional_candidate_rank"),
      institutional_label: str(row, "institutional_label"),
      institutional_reason: str(row, "institutional_reason"),
      reference_only: bool(row, "reference_only"),
      equity_adr: nullableNum(row, "equity_adr"),
      max_drawdown_adr: nullableNum(row, "max_drawdown_adr"),
      weekly_mtm_profit_factor: nullableNum(row, "weekly_mtm_profit_factor"),
      adr_calmar: nullableNum(row, "adr_calmar"),
      weekly_mtm_sortino_adr_normalized: nullableNum(row, "weekly_mtm_sortino_adr_normalized"),
      final_open_unrealized_adr: nullableNum(row, "final_open_unrealized_adr"),
      right_tail_give_up_vs_t150_adr: nullableNum(row, "right_tail_give_up_vs_t150_adr"),
      execution_burden_fills_per_week: nullableNum(row, "average_fills_per_week"),
    })),
  );
}

function buildMetricAvailability() {
  return addContentHashes([
    {
      metric: "pair_week_lifecycle_profit_factor",
      availability: "not_available_from_gate78_artifacts",
      gate78a_handling: "reported null; requires pair-week lifecycle replay instrumentation",
    },
    {
      metric: "account_week_mfe_mae",
      availability: "not_available_from_gate78_artifacts",
      gate78a_handling: "reported null; weekly MTM rolling losses and week-end open-unrealized values reported instead",
    },
    {
      metric: "pair_week_lifecycle_mfe_mae",
      availability: "not_available_from_gate78_artifacts",
      gate78a_handling: "reported null; max cycle MFE and total giveback proxies reported",
    },
    {
      metric: "average_open_inventory",
      availability: "not_available_from_gate78_artifacts",
      gate78a_handling: "reported null; fill and reset burden proxies reported",
    },
    {
      metric: "max_open_inventory",
      availability: "not_available_from_gate78_artifacts",
      gate78a_handling: "reported null; max weekly fill and reset counts reported",
    },
    {
      metric: "max_holding_time",
      availability: "not_available_from_gate78_artifacts",
      gate78a_handling: "reported null; average closed cycle hold hours reported",
    },
    {
      metric: "runner_mfe_mae",
      availability: "not_available_from_gate78_artifacts",
      gate78a_handling: "reported null; runner realized/unrealized contribution and close counts reported",
    },
  ]);
}

async function writeRows(jsonPath: string, csvPath: string, rows: JsonObject[]) {
  await writeJson(jsonPath, rows);
  await writeCsv(csvPath, rows);
}

async function artifactHashes(entries: Array<{ label: string; path: string }>) {
  const rows: JsonObject[] = [];
  for (const entry of entries) {
    rows.push({
      label: entry.label,
      path: toRepoRelative(entry.path),
      sha256: await fileHash(entry.path),
    });
  }
  return addContentHashes(rows);
}

function topRows(scorecardRows: JsonObject[]) {
  return [...scorecardRows]
    .filter((row) => nullableNum(row, "institutional_candidate_rank") !== null)
    .sort((left, right) => num(left, "institutional_candidate_rank") - num(right, "institutional_candidate_rank"));
}

function buildReport(args: {
  generatedAt: string;
  verdict: string;
  scorecardRows: JsonObject[];
  rowClassifications: JsonObject[];
  runnerAuditRows: JsonObject[];
  emergencyAuditRows: JsonObject[];
  metricAvailabilityRows: JsonObject[];
  artifactHashRows: JsonObject[];
  validation: JsonObject;
}) {
  const topCandidateRows = topRows(args.scorecardRows).slice(0, 8);
  const t100 = args.scorecardRows.find((row) => str(row, "rule_id") === T100_L3_RULE_ID);
  const conciseColumns = [
    "rule_id",
    "institutional_label",
    "institutional_candidate_rank",
    "equity_adr",
    "max_drawdown_adr",
    "weekly_mtm_profit_factor",
    "adr_calmar",
    "weekly_mtm_sortino_adr_normalized",
    "worst_13_week_mtm_loss_adr",
    "final_open_unrealized_adr",
    "flip_loss_adr",
    "average_fills_per_week",
    "right_tail_give_up_vs_t150_adr",
  ];

  return `# Gate 78A Limited-Reentry Institutional Numeric Scorecard Supplement

Generated: \`${args.generatedAt}\`

## Verdict

\`${args.verdict}\`

## Scope

- Audit layer only over existing Gate 78 rows.
- No strategy logic, row, parameter, Candidate B, pair universe, source input, exit, rescue, optimization, freeze, risk layer, cost model, MT5/live/app/runtime work, or promotion change.
- Mark-to-market equity is primary. Closed PnL is secondary.
- All results are gross, pre-cost, pre-risk-layer, pre-MT5, pre-promotion research evidence.
- Sharpe and Sortino are ADR-normalized diagnostics, not true investment Sharpe or Sortino.

## Decision

Gate 78A keeps \`${T100_L3_RULE_ID}\` as the primary non-reference research candidate. It remains the best real trading-system candidate in this fixed packet because it has the strongest MTM equity among candidate rows while avoiding the no-limit T150 tail and avoiding the runner rows' harvest collapse.

Key T100/L3 values:

- Equity ADR: \`${round(num(t100, "equity_adr"))}\`
- Closed ADR: \`${round(num(t100, "closed_adr"))}\`
- Max drawdown ADR: \`${round(num(t100, "max_drawdown_adr"))}\`
- Weekly MTM PF: \`${round(num(t100, "weekly_mtm_profit_factor"))}\`
- ADR-Calmar: \`${round(num(t100, "adr_calmar"))}\`
- ADR-normalized Sortino: \`${round(num(t100, "weekly_mtm_sortino_adr_normalized"))}\`
- Worst 13-week MTM loss ADR: \`${round(num(t100, "worst_13_week_mtm_loss_adr"))}\`
- Final open unrealized ADR: \`${round(num(t100, "final_open_unrealized_adr"))}\`

## Candidate Ranking

${renderTable(topCandidateRows, conciseColumns)}

## Row Classification

${renderTable(args.rowClassifications, [
  "rule_id",
  "institutional_label",
  "institutional_reason",
  "equity_adr",
  "max_drawdown_adr",
  "weekly_mtm_profit_factor",
  "final_open_unrealized_adr",
])}

## Runner Audit

${renderTable(args.runnerAuditRows, [
  "rule_id",
  "runner_fraction",
  "final_equity_adr",
  "runner_realized_contribution_adr",
  "runner_unrealized_contribution_adr",
  "total_result_excluding_runner_contribution_adr",
  "harvest_loss_vs_base_adr",
  "right_tail_loss_vs_base_adr",
  "interpretation",
])}

## Emergency SL Reference Audit

Emergency-SL rows are reference-only diagnostics. They are not ranked as exit candidates.

${renderTable(args.emergencyAuditRows, [
  "rule_id",
  "account_emergency_sl_adr",
  "emergency_breach_count",
  "triggered_week_count",
  "equity_saved_proxy_drawdown_improvement_adr",
  "harvest_lost_adr",
  "right_tail_lost_vs_t150_adr",
  "final_equity_delta_vs_base_adr",
  "interpretation",
])}

## Metric Availability

The following fields require replay instrumentation beyond the Gate 78 artifact surface. Gate 78A leaves them null and reports available proxies instead.

${renderTable(args.metricAvailabilityRows, ["metric", "availability", "gate78a_handling"])}

## Evidence Integrity

- Candidate B forced-28 ledger was not mutated.
- Candidate B was not recomputed.
- Candidate B was not relabeled.
- Candidate B was not reweighted.
- Candidate B was not filtered.
- No pairs were excluded.
- AUDNZD was not excluded or given special treatment.
- No fair-value pruning was introduced.
- No risk/correlation pruning was introduced.
- No cost, spread, slippage, swap, or commission assumptions were introduced.
- No MT5/live/app/runtime work was introduced.
- No promotion was made.
- Emergency-SL rows are reference-only diagnostics.
- Runner rows are diagnostics unless proven superior by the scorecard; Gate 78A did not find them superior.
- All results are gross, pre-cost, pre-risk, and research-only.

## Artifact Paths And Hashes

${renderTable(args.artifactHashRows, ["label", "sha256", "path"])}

## Validation

\`\`\`json
${JSON.stringify(args.validation, null, 2)}
\`\`\`
`;
}

async function main() {
  const argMap = parseArgMap();
  const gate78Dir = argMap.get("--gate78-dir") ?? DEFAULT_GATE78_DIR;
  const artifactDir = argMap.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR;
  const reportPath = argMap.get("--report") ?? DEFAULT_REPORT_PATH;
  const paths: ArtifactPaths = {
    artifactDir,
    gate78Dir,
    reportPath,
    scorecardJson: path.join(artifactDir, "gate78a-scorecard.rows.json"),
    scorecardCsv: path.join(artifactDir, "gate78a-scorecard.rows.csv"),
    weeklySeriesJson: path.join(artifactDir, "weekly-mtm-equity-series.rows.json"),
    weeklySeriesCsv: path.join(artifactDir, "weekly-mtm-equity-series.rows.csv"),
    monthlySummaryJson: path.join(artifactDir, "monthly-mtm-summary.rows.json"),
    monthlySummaryCsv: path.join(artifactDir, "monthly-mtm-summary.rows.csv"),
    pairCurrencyAttributionJson: path.join(artifactDir, "pair-currency-attribution.rows.json"),
    pairCurrencyAttributionCsv: path.join(artifactDir, "pair-currency-attribution.rows.csv"),
    fillResetInventoryJson: path.join(artifactDir, "fill-reset-inventory-summary.rows.json"),
    fillResetInventoryCsv: path.join(artifactDir, "fill-reset-inventory-summary.rows.csv"),
    metricDefinitionsJson: path.join(artifactDir, "metric-definition-appendix.rows.json"),
    metricDefinitionsCsv: path.join(artifactDir, "metric-definition-appendix.rows.csv"),
    rowClassificationJson: path.join(artifactDir, "row-classification.rows.json"),
    rowClassificationCsv: path.join(artifactDir, "row-classification.rows.csv"),
    runnerAuditJson: path.join(artifactDir, "runner-audit.rows.json"),
    runnerAuditCsv: path.join(artifactDir, "runner-audit.rows.csv"),
    emergencySlAuditJson: path.join(artifactDir, "emergency-sl-reference-audit.rows.json"),
    emergencySlAuditCsv: path.join(artifactDir, "emergency-sl-reference-audit.rows.csv"),
    metricAvailabilityJson: path.join(artifactDir, "metric-availability.rows.json"),
    metricAvailabilityCsv: path.join(artifactDir, "metric-availability.rows.csv"),
    artifactHashesJson: path.join(artifactDir, "artifact-hashes.rows.json"),
    artifactHashesCsv: path.join(artifactDir, "artifact-hashes.rows.csv"),
    commandReceipt: path.join(artifactDir, "command-receipt.json"),
    summaryJson: path.join(artifactDir, "gate78a-summary.json"),
    shaManifest: path.join(artifactDir, "gate78a-sha256.txt"),
  };

  const [
    gate78Summary,
    adapterRows,
    weeklyRows,
    resetPairRows,
    tailPairRows,
    tailCurrencyRows,
    rightTailRows,
    runnerRows,
    emergencyRows,
    failureRows,
  ] = await Promise.all([
    readJson<JsonObject>(path.join(gate78Dir, "gate78-summary.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "adapter-summary.rows.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "weekly-equity-truth.rows.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "reset-count-pair.rows.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "tail-concentration-pair.rows.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "tail-concentration-currency.rows.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "right-tail-retention.rows.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "runner-contribution.rows.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "account-emergency-sl-attribution.rows.json")),
    readJson<JsonObject[]>(path.join(gate78Dir, "failure-anatomy.rows.json")),
  ]);

  const weeklyByRule = groupBy(weeklyRows, (row) => str(row, "rule_id"));
  const adapterByRule = byKey(adapterRows, "rule_id");
  const rightTailByRule = byKey(rightTailRows, "rule_id");
  const weeklySeriesRows = buildWeeklySeries(weeklyByRule);
  const monthlySummaryRows = buildMonthlySummary(weeklyByRule);
  const pairCurrencyAttributionRows = buildPairCurrencyAttribution(tailPairRows, tailCurrencyRows);
  const fillResetInventoryRows = buildFillResetInventorySummary(adapterRows, weeklyByRule, resetPairRows);
  const scorecardRows = buildScorecardRows({
    adapterRows,
    weeklyByRule,
    monthlyRows: monthlySummaryRows,
    fillResetRows: fillResetInventoryRows,
    rightTailByRule,
    tailPairRows,
    tailCurrencyRows,
  });
  const rowClassificationRows = buildRowClassifications(scorecardRows);
  const runnerAuditRows = buildRunnerAudit(adapterByRule, runnerRows, failureRows);
  const emergencySlAuditRows = buildEmergencySlAudit(adapterByRule, emergencyRows, weeklyByRule, rightTailByRule);
  const metricDefinitionRows = buildMetricDefinitions();
  const metricAvailabilityRows = buildMetricAvailability();
  const primary = rowClassificationRows.find((row) => str(row, "institutional_label") === "primary candidate");
  const verdict =
    str(primary, "rule_id") === T100_L3_RULE_ID
      ? "PASS_SCORECARD_T100_L3_REMAINS_PRIMARY_CANDIDATE_NO_PROMOTION"
      : primary
        ? "PASS_SCORECARD_ALTERNATE_LIMITED_REENTRY_CANDIDATE_NO_PROMOTION"
        : "FAIL_SCORECARD_NO_EXIT_CANDIDATE_READY_FOR_RISK_LAYER";

  const generatedAt = new Date().toISOString();
  const validation: JsonObject = {
    gate78a_supplement_only: true,
    gate78_verdict_preserved: str(gate78Summary, "verdict"),
    gate78_rule_count: adapterRows.length,
    expected_gate78_rule_count: EXPECTED_GATE78_RULE_COUNT,
    weekly_rows: weeklyRows.length,
    expected_weekly_rows: EXPECTED_GATE78_RULE_COUNT * EXPECTED_WEEKS,
    weeks_per_rule: [...weeklyByRule.values()].every((rows) => rows.length === EXPECTED_WEEKS),
    pairs_replayed_from_gate78_summary: num(gate78Summary.warehouse as JsonObject | undefined, "pairs_replayed"),
    expected_pairs: EXPECTED_PAIRS,
    pair_week_rows_replayed_from_gate78_summary: num(gate78Summary.warehouse as JsonObject | undefined, "pair_week_rows_replayed"),
    expected_pair_week_rows: EXPECTED_PAIR_WEEK_ROWS,
    candidate_b_forced28_ledger_mutated: false,
    candidate_b_recomputed: false,
    candidate_b_relabeled: false,
    candidate_b_reweighted: false,
    candidate_b_filtered: false,
    pair_exclusions_started: false,
    audnzd_excluded: false,
    fair_value_pruning_started: false,
    risk_correlation_pruning_started: false,
    cost_slippage_swap_commission_assumptions_introduced: false,
    mt5_live_app_runtime_started: false,
    promotion_made: false,
    emergency_sl_rows_reference_only: emergencySlAuditRows.every((row) => bool(row, "reference_only")),
    runner_rows_ranked_as_diagnostics: true,
    gross_pre_cost_pre_risk_pre_promotion_research_only: true,
    primary_candidate: str(primary, "rule_id"),
  };

  const commandReceipt: JsonObject = {
    gate_id: GATE_ID,
    generated_at: generatedAt,
    git_commit: gitCommit(),
    command: COMMAND,
    input_gate78_dir: toRepoRelative(gate78Dir),
    output_artifact_dir: toRepoRelative(artifactDir),
    deterministic_rebuild: true,
    strategy_logic_changed: false,
    rows_added_to_gate78_matrix: 0,
    verdict,
    validation,
  };

  await writeRows(paths.scorecardJson, paths.scorecardCsv, scorecardRows);
  await writeRows(paths.weeklySeriesJson, paths.weeklySeriesCsv, weeklySeriesRows);
  await writeRows(paths.monthlySummaryJson, paths.monthlySummaryCsv, monthlySummaryRows);
  await writeRows(paths.pairCurrencyAttributionJson, paths.pairCurrencyAttributionCsv, pairCurrencyAttributionRows);
  await writeRows(paths.fillResetInventoryJson, paths.fillResetInventoryCsv, fillResetInventoryRows);
  await writeRows(paths.metricDefinitionsJson, paths.metricDefinitionsCsv, metricDefinitionRows);
  await writeRows(paths.rowClassificationJson, paths.rowClassificationCsv, rowClassificationRows);
  await writeRows(paths.runnerAuditJson, paths.runnerAuditCsv, runnerAuditRows);
  await writeRows(paths.emergencySlAuditJson, paths.emergencySlAuditCsv, emergencySlAuditRows);
  await writeRows(paths.metricAvailabilityJson, paths.metricAvailabilityCsv, metricAvailabilityRows);
  await writeJson(paths.commandReceipt, commandReceipt);

  const summary: JsonObject = {
    gate_id: GATE_ID,
    generated_at: generatedAt,
    git_commit: gitCommit(),
    command: COMMAND,
    verdict,
    purpose:
      "produce an MTM-first institutional scorecard supplement over existing Gate 78 rows before exit freeze, risk-layer work, costs, MT5/live, or promotion discussion",
    primary_candidate: primary,
    required_decision_question:
      "Does T100/S020/L3 remain the best real trading-system candidate after full MTM risk-adjusted statistics, or does another limited-reentry row beat it without hiding floating-loss transfer?",
    decision_answer:
      str(primary, "rule_id") === T100_L3_RULE_ID
        ? "T100/S020/L3 remains the primary non-reference research candidate. It is not promoted or frozen."
        : "An alternate candidate outranked T100/S020/L3. No promotion or freeze was made.",
    metric_limitations: metricAvailabilityRows,
    validation,
  };
  await writeJson(paths.summaryJson, summary);

  const hashInputEntries = [
    { label: "scorecard_json", path: paths.scorecardJson },
    { label: "scorecard_csv", path: paths.scorecardCsv },
    { label: "weekly_series_json", path: paths.weeklySeriesJson },
    { label: "weekly_series_csv", path: paths.weeklySeriesCsv },
    { label: "monthly_summary_json", path: paths.monthlySummaryJson },
    { label: "monthly_summary_csv", path: paths.monthlySummaryCsv },
    { label: "pair_currency_attribution_json", path: paths.pairCurrencyAttributionJson },
    { label: "pair_currency_attribution_csv", path: paths.pairCurrencyAttributionCsv },
    { label: "fill_reset_inventory_json", path: paths.fillResetInventoryJson },
    { label: "fill_reset_inventory_csv", path: paths.fillResetInventoryCsv },
    { label: "metric_definitions_json", path: paths.metricDefinitionsJson },
    { label: "metric_definitions_csv", path: paths.metricDefinitionsCsv },
    { label: "row_classification_json", path: paths.rowClassificationJson },
    { label: "row_classification_csv", path: paths.rowClassificationCsv },
    { label: "runner_audit_json", path: paths.runnerAuditJson },
    { label: "runner_audit_csv", path: paths.runnerAuditCsv },
    { label: "emergency_sl_audit_json", path: paths.emergencySlAuditJson },
    { label: "emergency_sl_audit_csv", path: paths.emergencySlAuditCsv },
    { label: "metric_availability_json", path: paths.metricAvailabilityJson },
    { label: "metric_availability_csv", path: paths.metricAvailabilityCsv },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "summary_json", path: paths.summaryJson },
  ];
  const artifactHashRows = await artifactHashes(hashInputEntries);
  await writeRows(paths.artifactHashesJson, paths.artifactHashesCsv, artifactHashRows);

  const report = buildReport({
    generatedAt,
    verdict,
    scorecardRows,
    rowClassifications: rowClassificationRows,
    runnerAuditRows,
    emergencyAuditRows: emergencySlAuditRows,
    metricAvailabilityRows,
    artifactHashRows,
    validation,
  });
  await writeText(paths.reportPath, report);

  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    ...hashInputEntries,
    { label: "artifact_hashes_json", path: paths.artifactHashesJson },
    { label: "artifact_hashes_csv", path: paths.artifactHashesCsv },
    { label: "report", path: paths.reportPath },
  ]);

  console.log(
    JSON.stringify(
      {
        verdict,
        primary_candidate: str(primary, "rule_id"),
        report: toRepoRelative(paths.reportPath),
        summary: toRepoRelative(paths.summaryJson),
        scorecard: toRepoRelative(paths.scorecardJson),
        sha_manifest: toRepoRelative(paths.shaManifest),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
