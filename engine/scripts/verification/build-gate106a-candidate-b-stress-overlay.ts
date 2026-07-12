import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { sha256Text } from "@engine/research/hash";

import {
  AlphaLedgerRow,
  gitCommit,
  loadAlphaRows,
  readJson,
  readJsonl,
  round,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

type CandidateBLedgerRow = {
  row_key: string;
  locked_algorithm_id: string;
  architecture_version: string;
  frozen_reference_capsule_id: string;
  frozen_reference_capsule_sha256: string;
  default_candidate_id: string;
  week_open_utc: string;
  year: number;
  symbol: string;
  base_currency: string | null;
  quote_currency: string | null;
  final_direction: "BASE_CURRENCY" | "QUOTE_CURRENCY";
  final_side: "LONG" | "SHORT";
  reason_codes: string[];
  warning_active: boolean;
  fallback_used: boolean;
  veto_used: boolean;
  cell_roles: Record<string, string>;
  cell_quality_states: Record<string, string>;
  scenario_group_key: string | null;
  source_decision_content_hash: string;
  decision_hash: string;
};

type Gate69Manifest = {
  default_candidate_id: string;
  frozen_reference_capsule_sha256: string;
  gate68_decision_ledger_hash: string;
  gate68_outcome_scoring_hash: string;
  final_ledger_hash: string;
  final_candidate_metrics: {
    candidate_id: string;
    decision_signature_sha256: string;
  };
};

const GATE_ID = "Gate 106A: candidate-b-stress-overlay-export";
const GATE_DATE = "2026-07-09";
const ARTIFACT_DIR = "docs/research/gates/gate106a/artifacts/candidate-b-stress-overlay-2026-07-09";
const REPORT_PATH = "docs/research/gates/gate106a/GATE106A_CANDIDATE_B_STRESS_OVERLAY_2026-07-09.md";
const CANDIDATE_LEDGER =
  "docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay/final-forced28-decision-ledger.rows.jsonl";
const GATE69_MANIFEST =
  "docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay/final-forced28-ledger.manifest.json";
const GATE68_CAPSULE =
  "docs/research/gates/gate68c/artifacts/gate68c-frozen-seven-year-reference-capsule/frozen-reference-capsule.manifest.json";
const REVMA_REPORT = "C:/Users/User/Desktop/LIMNI/Baktests/Revma/0.01 tp. no sl. all 28 pairs. 0.1 grid spacing..html";

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(";") : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function writeCsv(filePath: string, rows: Array<Record<string, unknown>>, columns: string[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  await writeText(filePath, `${lines.join("\n")}\n`);
}

function yyyyMmDd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseMt5Period(html: string) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const match = text.match(/M1\s*\(\s*(\d{4})\.(\d{2})\.(\d{2})\s*-\s*(\d{4})\.(\d{2})\.(\d{2})\s*\)/);
  if (!match) return null;
  return {
    start: `${match[1]}-${match[2]}-${match[3]}`,
    end: `${match[4]}-${match[5]}-${match[6]}`,
  };
}

function alphaKey(row: Pick<AlphaLedgerRow, "week" | "instrument">) {
  return `${row.week.week_open_utc}|${row.instrument.symbol}`;
}

function outcomeForDirection(alpha: AlphaLedgerRow | undefined, direction: "BASE_CURRENCY" | "QUOTE_CURRENCY") {
  if (!alpha) return null;
  return direction === "BASE_CURRENCY" ? alpha.outcomes.weekly_hold.long : alpha.outcomes.weekly_hold.short;
}

function directionText(row: CandidateBLedgerRow) {
  return row.final_direction === "BASE_CURRENCY" ? `${row.base_currency} over ${row.quote_currency}` : `${row.quote_currency} over ${row.base_currency}`;
}

function stressNote(row: CandidateBLedgerRow, thisWeek: number | null, nextWeek: number | null) {
  const notes: string[] = [];
  if (row.symbol.includes("JPY")) notes.push(row.final_direction === "QUOTE_CURRENCY" && row.quote_currency === "JPY" ? "candidate_b_jpy_strength" : "candidate_b_not_jpy_strength");
  if (row.warning_active) notes.push("candidate_b_warning_active");
  if (row.fallback_used) notes.push("candidate_b_fallback_used");
  if (thisWeek !== null && thisWeek > 0) notes.push("this_week_direction_profitable");
  if (thisWeek !== null && thisWeek <= 0) notes.push("this_week_direction_unprofitable");
  if (nextWeek !== null && nextWeek > 0) notes.push("next_week_direction_profitable");
  if (nextWeek !== null && nextWeek <= 0) notes.push("next_week_direction_unprofitable");
  return notes.join(";");
}

async function main() {
  const artifactDir = path.resolve(ARTIFACT_DIR);
  await mkdir(artifactDir, { recursive: true });

  const [candidateRows, alphaRows, manifest, capsule, revmaHtmlBytes] = await Promise.all([
    readJsonl<CandidateBLedgerRow>(CANDIDATE_LEDGER),
    loadAlphaRows(),
    readJson<Gate69Manifest>(GATE69_MANIFEST),
    readJson<Record<string, unknown>>(GATE68_CAPSULE),
    readFile(REVMA_REPORT),
  ]);
  const revmaHtml =
    revmaHtmlBytes[0] === 0xff && revmaHtmlBytes[1] === 0xfe
      ? revmaHtmlBytes.toString("utf16le")
      : revmaHtmlBytes.toString("utf8");

  const revmaPeriod = parseMt5Period(revmaHtml);
  if (!revmaPeriod) throw new Error("Could not parse MT5 report period from Revma HTML.");

  const alphaByWeekSymbol = new Map(alphaRows.map((row) => [alphaKey(row), row]));
  const candidateByWeekSymbol = new Map(candidateRows.map((row) => [`${row.week_open_utc}|${row.symbol}`, row]));
  const ledgerMin = candidateRows[0]?.week_open_utc ?? null;
  const ledgerMax = candidateRows[candidateRows.length - 1]?.week_open_utc ?? null;
  const sourceManifestHash = sha256Text(JSON.stringify({
    gate69_final_ledger_hash: manifest.final_ledger_hash,
    gate68_decision_ledger_hash: manifest.gate68_decision_ledger_hash,
    gate68_outcome_scoring_hash: manifest.gate68_outcome_scoring_hash,
    frozen_reference_capsule_sha256: manifest.frozen_reference_capsule_sha256,
  }));

  const fullStart = new Date("2020-01-01T00:00:00.000Z");
  const fullEnd = new Date(`${revmaPeriod.end}T23:59:59.000Z`);
  const fullRows = candidateRows
    .filter((row) => {
      const week = new Date(row.week_open_utc);
      return week >= fullStart && week <= fullEnd;
    })
    .map((row) => {
      const weekStart = new Date(row.week_open_utc);
      const weekEnd = addDays(weekStart, 7);
      return {
        week_start: yyyyMmDd(weekStart),
        week_end: yyyyMmDd(weekEnd),
        decision_asof: yyyyMmDd(weekStart),
        pair: row.symbol,
        candidate_b_direction: directionText(row),
        candidate_b_score: "",
        base_currency: row.base_currency,
        quote_currency: row.quote_currency,
        base_currency_direction_contribution: "",
        quote_currency_direction_contribution: "",
        formula_id: row.default_candidate_id,
        formula_hash: manifest.final_candidate_metrics.decision_signature_sha256,
        config_hash: manifest.final_ledger_hash,
        source_manifest_hash: sourceManifestHash,
        point_in_time_ok: true,
      };
    });

  const stressStart = new Date("2024-07-15T00:00:00.000Z");
  const stressEnd = new Date("2024-09-30T23:59:59.000Z");
  const stressRows = candidateRows
    .filter((row) => {
      const week = new Date(row.week_open_utc);
      return week >= stressStart && week <= stressEnd;
    })
    .map((row) => {
      const alpha = alphaByWeekSymbol.get(`${row.week_open_utc}|${row.symbol}`);
      const thisWeek = outcomeForDirection(alpha, row.final_direction);
      const nextWeekDate = addDays(new Date(row.week_open_utc), 7).toISOString();
      const nextAlpha = alphaByWeekSymbol.get(`${nextWeekDate}|${row.symbol}`);
      const nextWeek = outcomeForDirection(nextAlpha, row.final_direction);
      return {
        week_start: yyyyMmDd(new Date(row.week_open_utc)),
        week_end: yyyyMmDd(addDays(new Date(row.week_open_utc), 7)),
        decision_asof: yyyyMmDd(new Date(row.week_open_utc)),
        pair: row.symbol,
        candidate_b_direction: directionText(row),
        realized_pair_return_this_week: round(thisWeek),
        realized_pair_return_next_week: round(nextWeek),
        candidate_b_correct_this_week: thisWeek === null ? "" : thisWeek > 0,
        candidate_b_correct_next_week: nextWeek === null ? "" : nextWeek > 0,
        was_jpy_pair: row.symbol.includes("JPY"),
        was_usd_pair: row.symbol.includes("USD"),
        stress_notes: stressNote(row, thisWeek, nextWeek),
        revma_deposit_load_pct: "",
        revma_equity_dd_pct: "",
        revma_managed_positions: "",
        revma_open_grids: "",
        revma_pair_floating_pnl: "",
        revma_currency_exposure: "",
        candidate_b_aligned_with_revma_inventory: "",
        candidate_b_opposed_revma_inventory: "",
        candidate_b_would_have_blocked_or_warned: row.warning_active || row.fallback_used || row.veto_used,
      };
    });

  const jpyRows = stressRows.filter((row) => row.was_jpy_pair);
  const jpyStrengthRows = stressRows.filter((row) => row.was_jpy_pair && String(row.candidate_b_direction).startsWith("JPY over"));
  const jpyThisCorrect = jpyRows.filter((row) => row.candidate_b_correct_this_week === true).length;
  const jpyNextCorrect = jpyRows.filter((row) => row.candidate_b_correct_next_week === true).length;
  const warningRows = stressRows.filter((row) => row.candidate_b_would_have_blocked_or_warned === true).length;
  const stressThisCorrect = stressRows.filter((row) => row.candidate_b_correct_this_week === true).length;
  const stressNextCorrect = stressRows.filter((row) => row.candidate_b_correct_next_week === true).length;
  const stressAnswered = stressRows.filter((row) => row.candidate_b_correct_this_week !== "").length;
  const stressNextAnswered = stressRows.filter((row) => row.candidate_b_correct_next_week !== "").length;

  const directionsPath = path.join(artifactDir, "candidate_b_weekly_directions.csv");
  const stressPath = path.join(artifactDir, "candidate_b_stress_alignment.csv");
  const summaryPath = path.join(artifactDir, "gate106a-summary.json");
  const reportPath = path.resolve(REPORT_PATH);
  const shaPath = path.join(artifactDir, "gate106a-sha256.txt");

  await writeCsv(directionsPath, fullRows, [
    "week_start",
    "week_end",
    "decision_asof",
    "pair",
    "candidate_b_direction",
    "candidate_b_score",
    "base_currency",
    "quote_currency",
    "base_currency_direction_contribution",
    "quote_currency_direction_contribution",
    "formula_id",
    "formula_hash",
    "config_hash",
    "source_manifest_hash",
    "point_in_time_ok",
  ]);
  await writeCsv(stressPath, stressRows, [
    "week_start",
    "week_end",
    "decision_asof",
    "pair",
    "candidate_b_direction",
    "realized_pair_return_this_week",
    "realized_pair_return_next_week",
    "candidate_b_correct_this_week",
    "candidate_b_correct_next_week",
    "was_jpy_pair",
    "was_usd_pair",
    "stress_notes",
    "revma_deposit_load_pct",
    "revma_equity_dd_pct",
    "revma_managed_positions",
    "revma_open_grids",
    "revma_pair_floating_pnl",
    "revma_currency_exposure",
    "candidate_b_aligned_with_revma_inventory",
    "candidate_b_opposed_revma_inventory",
    "candidate_b_would_have_blocked_or_warned",
  ]);

  const summary = {
    gate_id: GATE_ID,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    revma_report: REVMA_REPORT,
    revma_report_sha256: sha256Text(revmaHtml),
    revma_period: revmaPeriod,
    locked_candidate_b: {
      formula_id: manifest.default_candidate_id,
      formula_hash: manifest.final_candidate_metrics.decision_signature_sha256,
      config_hash: manifest.final_ledger_hash,
      frozen_reference_capsule_sha256: manifest.frozen_reference_capsule_sha256,
      gate68_decision_ledger_hash: manifest.gate68_decision_ledger_hash,
      gate68_outcome_scoring_hash: manifest.gate68_outcome_scoring_hash,
      source_manifest_hash: sourceManifestHash,
      point_in_time_ok: true,
      ledger_min_week_open_utc: ledgerMin,
      ledger_max_week_open_utc: ledgerMax,
    },
    coverage: {
      requested_start: "2020-01-01",
      requested_end: revmaPeriod.end,
      exported_direction_rows: fullRows.length,
      stress_window_start: "2024-07-15",
      stress_window_end: "2024-09-30",
      stress_rows: stressRows.length,
      source_gap_after_locked_ledger: new Date(ledgerMax ?? "1970-01-01") < fullEnd,
      source_gap_note: new Date(ledgerMax ?? "1970-01-01") < fullEnd ? `Locked Gate 69B ledger ends at ${ledgerMax}; no Candidate B rows exported after that date.` : "none",
    },
    stress_metrics: {
      candidate_b_correct_this_week: `${stressThisCorrect}/${stressAnswered}`,
      candidate_b_correct_next_week: `${stressNextCorrect}/${stressNextAnswered}`,
      jpy_pair_rows: jpyRows.length,
      jpy_strength_direction_rows: jpyStrengthRows.length,
      jpy_strength_share: jpyRows.length > 0 ? round(jpyStrengthRows.length / jpyRows.length) : null,
      jpy_correct_this_week: `${jpyThisCorrect}/${jpyRows.length}`,
      jpy_correct_next_week: `${jpyNextCorrect}/${jpyRows.length}`,
      warning_or_fallback_rows: warningRows,
      warning_or_fallback_share: stressRows.length > 0 ? round(warningRows / stressRows.length) : null,
    },
    revma_join: {
      joined: false,
      reason: "Desktop MT5 HTML report exposes period and deal rows, but not machine-readable weekly deposit-load/equity-dd/open-grid inventory. Gate 106A leaves Revma stress fields blank instead of inferring them from chart pixels.",
    },
    artifacts: {
      candidate_b_weekly_directions: toRepoRelative(directionsPath),
      candidate_b_stress_alignment: toRepoRelative(stressPath),
      summary: toRepoRelative(summaryPath),
      report: toRepoRelative(reportPath),
      sha_identity: toRepoRelative(shaPath),
    },
  };

  await writeJson(summaryPath, summary);
  await writeText(reportPath, renderReport(summary));
  await writeShaManifest(shaPath, GATE_ID, "tsx engine/scripts/verification/build-gate106a-candidate-b-stress-overlay.ts", [
    { label: "candidate_b_weekly_directions", path: directionsPath },
    { label: "candidate_b_stress_alignment", path: stressPath },
    { label: "summary_json", path: summaryPath },
    { label: "report", path: reportPath },
  ]);

  console.log("PASS_GATE106A_CANDIDATE_B_STRESS_OVERLAY_EXPORT");
  console.log(JSON.stringify(summary.coverage, null, 2));
  console.log(JSON.stringify(summary.stress_metrics, null, 2));
}

function renderReport(summary: Record<string, any>) {
  return [
    "# Gate 106A - Candidate B Stress Overlay",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    "`PASS_GATE106A_CANDIDATE_B_STRESS_OVERLAY_EXPORT_REVIEW_ONLY_NO_EA_CHANGE`",
    "",
    "## Scope",
    "",
    "- Review/export only.",
    "- Locked Gate 69 Candidate B weekly forced-28 direction rows only.",
    "- No EA code changes, no Revma formula changes, no Candidate B tuning, no optimization.",
    "- Revma HTML report used only for MT5 period and source identity.",
    "",
    "## Source Identity",
    "",
    "```json",
    JSON.stringify({
      revma_report: summary.revma_report,
      revma_report_sha256: summary.revma_report_sha256,
      revma_period: summary.revma_period,
      locked_candidate_b: summary.locked_candidate_b,
      coverage: summary.coverage,
    }, null, 2),
    "```",
    "",
    "## Stress Metrics",
    "",
    "```json",
    JSON.stringify(summary.stress_metrics, null, 2),
    "```",
    "",
    "## Answers",
    "",
    `1. During the 2024 Aug/Sep stress, Candidate B was mixed-positive, not dominant: \`${summary.stress_metrics.candidate_b_correct_this_week}\` correct this-week and \`${summary.stress_metrics.candidate_b_correct_next_week}\` correct next-week across stress pair-weeks.`,
    `2. Candidate B was only partly on the JPY carry-unwind side: \`${summary.stress_metrics.jpy_strength_direction_rows}/${summary.stress_metrics.jpy_pair_rows}\` JPY-pair rows pointed to JPY strength, with JPY correctness \`${summary.stress_metrics.jpy_correct_this_week}\` this-week and \`${summary.stress_metrics.jpy_correct_next_week}\` next-week.`,
    `3. Candidate B would have warned or fallen back on \`${summary.stress_metrics.warning_or_fallback_rows}\` stress rows, but Gate 106A cannot prove no-new-risk usefulness without a machine-readable Revma inventory/load join. The right future test is opposed-inventory-at-deposit-load-spike, not raw direction alone.`,
    "4. Candidate B did fail or lag on a substantial minority/near-half of rows. Rows with `candidate_b_correct_next_week=false` or `candidate_b_correct_this_week=false` are the fail/late candidates to inspect before any overlay design.",
    "5. Candidate B remains promising as a future regime-overlay/no-new-risk diagnostic, especially as a stress warning layer, but this evidence is not strong enough to promote it as a live Revma filter or to change Revma.",
    "",
    "## Fail-Closed Notes",
    "",
    `- Locked Candidate B source ends at \`${summary.locked_candidate_b.ledger_max_week_open_utc}\`; the Revma report period ends at \`${summary.revma_period.end}\`. Rows after the locked ledger end are not invented.`,
    `- Revma stress fields are blank because: ${summary.revma_join.reason}`,
    "- Candidate B score and currency contribution fields are blank because the locked Gate 69B ledger preserves direction and hashes, not numeric contribution scores.",
    "",
    "## Artifacts",
    "",
    `- Candidate B weekly directions: \`${summary.artifacts.candidate_b_weekly_directions}\``,
    `- Stress alignment CSV: \`${summary.artifacts.candidate_b_stress_alignment}\``,
    `- Summary JSON: \`${summary.artifacts.summary}\``,
    `- SHA identity: \`${summary.artifacts.sha_identity}\``,
    "",
  ].join("\n");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
