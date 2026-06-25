import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { getPool, query } from "@/lib/db";

loadEnvConfig(process.cwd());

const GATE = "Gate 51C: selector-candidate-lockdown";
const DEFAULT_OUT_DIR = "app/reports/data-verification/macro-regime";
const MATRIX_DATASET_ID = "479624d1-f6a2-4928-82f1-981137762bdc";
const MATRIX_DATASET_HASH = "cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36";
const RRP_DATASET_ID = "220fd5fd-d017-4db2-bdde-524a3c664c72";
const RRP_DATASET_HASH = "5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742";
const SOURCE_CONTENT_INVARIANT_HASH = "fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391";
const FINAL_ACTIVE_RESOLVED_CONTENT_JOIN_MAP_HASH =
  "08723c62e089eddab7cde243a64283c9dd6bc0ebee01a070cfb32e4cb27fdbc7";

const FULL_RRP_RECEIPT =
  "app/reports/data-verification/macro-regime/gate51-rrp-regime-filter-diagnostic-full-20260623T171820.json";
const NONCOMM_LIFECYCLE_RECEIPT =
  "app/reports/data-verification/macro-regime/gate51-cot-lifecycle-rrp-interaction-noncomm_net-20260623T174919.json";
const LEV_MONEY_LIFECYCLE_RECEIPT =
  "app/reports/data-verification/macro-regime/gate51-cot-lifecycle-rrp-interaction-lev_money_net-20260623T175256.json";

const COT_SHORTLIST = [
  "cot_faces_v1_forced_selected",
  "cot_faces_v1_commercial_delta_contrarian_selected",
  "dealer_commercial_agreement_selected",
  "cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree",
  "cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree",
  "cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree",
  "cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree",
];

const STRENGTH_SHORTLIST = [
  "strength_friday_snapshot_selected",
  "strength_open_canonical_selected",
  "strength_friday_snapshot_open_canonical_fade_agree",
  "strength_friday_snapshot_open_canonical_fade_friday_remainder",
  "strength_friday_snapshot_open_canonical_fade_open_fade_remainder",
  "strength_friday_snapshot_fade",
  "strength_open_canonical_fade",
];

type JsonRecord = Record<string, unknown>;
type Direction = "LONG" | "SHORT";

type VariantRunRow = {
  variant_run_id: string;
  variant_id: string;
  variant_label: string;
};

type WeekResultRow = {
  variant_run_id: string;
  variant_id: string;
  variant_label: string;
  week_open_utc: Date | string;
  pair_contributions: JsonRecord;
};

type PairDecisionRow = {
  variant_run_id: string;
  variant_id: string;
  week_open_utc: Date | string;
  symbol: string;
  selected_side: Direction;
};

type MetricRow = {
  candidateId: string;
  candidateLabel: string;
  source: string;
  selectedRows: number;
  activeWeeks: number;
  totalAdr: number;
  maxDrawdownAdr: number;
  returnToDrawdown: number | null;
  pathSharpeAdr: number | null;
  profitFactorAdr: number | null;
  weeklyWinRateActive: number | null;
  positiveYearRate: number | null;
  worstYear: string | null;
  worstYearAdr: number | null;
  topCurrencyAbsShare?: number | null;
  note?: string;
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function isoUtc(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number | null | undefined, decimals = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Stable(value: unknown) {
  return sha256(JSON.stringify(value));
}

function yearOf(week: string) {
  return week.slice(0, 4);
}

function maxDrawdown(values: number[]) {
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;
  for (const value of values) {
    cumulative += value;
    peak = Math.max(peak, cumulative);
    drawdown = Math.min(drawdown, cumulative - peak);
  }
  return drawdown;
}

function pathStats(weeklyValues: number[]) {
  const totalAdr = weeklyValues.reduce((sum, value) => sum + value, 0);
  const mean = weeklyValues.length > 0 ? totalAdr / weeklyValues.length : 0;
  const variance = weeklyValues.length > 0
    ? weeklyValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / weeklyValues.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const positiveAdr = weeklyValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeAdr = weeklyValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const drawdown = maxDrawdown(weeklyValues);
  return {
    totalAdr: round(totalAdr) ?? 0,
    maxDrawdownAdr: round(drawdown) ?? 0,
    returnToDrawdown: drawdown < 0 ? round(totalAdr / Math.abs(drawdown)) : null,
    pathSharpeAdr: stdDev > 0 ? round((mean / stdDev) * Math.sqrt(52)) : null,
    profitFactorAdr: negativeAdr < 0 ? round(positiveAdr / Math.abs(negativeAdr)) : null,
  };
}

function metricFromWeeklyTotals(options: {
  candidateId: string;
  candidateLabel: string;
  source: string;
  weeklyTotals: Map<string, number>;
  allWeeks: string[];
  selectedRows: number;
  note?: string;
}): MetricRow {
  const weeklyValues = options.allWeeks.map((week) => round(options.weeklyTotals.get(week) ?? 0) ?? 0);
  const activeValues = weeklyValues.filter((value) => value !== 0);
  const yearAdr = new Map<string, number>();
  for (let index = 0; index < options.allWeeks.length; index += 1) {
    const week = options.allWeeks[index];
    const value = weeklyValues[index] ?? 0;
    yearAdr.set(yearOf(week), (yearAdr.get(yearOf(week)) ?? 0) + value);
  }
  const yearRows = [...yearAdr.entries()].map(([year, value]) => ({ year, value: round(value) ?? 0 }));
  const positiveYears = yearRows.filter((row) => row.value > 0).length;
  const worstYear = yearRows.sort((left, right) => left.value - right.value)[0] ?? null;
  return {
    candidateId: options.candidateId,
    candidateLabel: options.candidateLabel,
    source: options.source,
    selectedRows: options.selectedRows,
    activeWeeks: activeValues.length,
    ...pathStats(weeklyValues),
    weeklyWinRateActive: activeValues.length > 0
      ? round(activeValues.filter((value) => value > 0).length / activeValues.length)
      : null,
    positiveYearRate: yearRows.length > 0 ? round(positiveYears / yearRows.length) : null,
    worstYear: worstYear?.year ?? null,
    worstYearAdr: worstYear ? round(worstYear.value) : null,
    note: options.note,
  };
}

function modeResultToMetric(row: JsonRecord, source: string, note?: string): MetricRow {
  return {
    candidateId: String(row.variantId),
    candidateLabel: String(row.variantLabel ?? row.variantId),
    source,
    selectedRows: asNumber(row.selectedRows),
    activeWeeks: asNumber(row.activeWeeks),
    totalAdr: asNumber(row.totalAdr),
    maxDrawdownAdr: asNumber(row.maxDrawdownAdr),
    returnToDrawdown: row.returnToDrawdown === null ? null : asNumber(row.returnToDrawdown),
    pathSharpeAdr: row.pathSharpeAdr === null ? null : asNumber(row.pathSharpeAdr),
    profitFactorAdr: row.profitFactorAdr === null ? null : asNumber(row.profitFactorAdr),
    weeklyWinRateActive: row.weeklyWinRateActive === null ? null : asNumber(row.weeklyWinRateActive),
    positiveYearRate: row.positiveYearRate === null ? null : asNumber(row.positiveYearRate),
    worstYear: row.worstYear === null || row.worstYear === undefined ? null : String(row.worstYear),
    worstYearAdr: row.worstYearAdr === null || row.worstYearAdr === undefined ? null : asNumber(row.worstYearAdr),
    topCurrencyAbsShare: row.topCurrencyAbsShare === null || row.topCurrencyAbsShare === undefined
      ? null
      : asNumber(row.topCurrencyAbsShare),
    note,
  };
}

async function readJson(pathname: string) {
  return JSON.parse(await readFile(pathname, "utf8")) as JsonRecord;
}

async function readVariantRuns(variantIds: string[]) {
  return query<VariantRunRow>(
    `
      SELECT variant_run_id, variant_id, variant_label
      FROM research_matrix_variant_runs
      WHERE dataset_id = $1::uuid
        AND variant_id = ANY($2::text[])
      ORDER BY variant_id
    `,
    [MATRIX_DATASET_ID, variantIds],
  );
}

async function readWeekResults(variantRunIds: string[]) {
  return query<WeekResultRow>(
    `
      SELECT
        r.variant_run_id,
        r.variant_id,
        r.variant_label,
        w.week_open_utc,
        w.pair_contributions
      FROM research_matrix_variant_week_results w
      JOIN research_matrix_variant_runs r
        ON r.variant_run_id = w.variant_run_id
      WHERE r.variant_run_id = ANY($1::uuid[])
      ORDER BY r.variant_id, w.week_open_utc
    `,
    [variantRunIds],
  );
}

async function readPairDecisions(variantRunIds: string[]) {
  return query<PairDecisionRow>(
    `
      SELECT
        r.variant_run_id,
        r.variant_id,
        d.week_open_utc,
        d.symbol,
        d.selected_side
      FROM research_matrix_pair_decisions d
      JOIN research_matrix_variant_runs r
        ON r.variant_run_id = d.variant_run_id
      WHERE r.variant_run_id = ANY($1::uuid[])
        AND d.selected_side IN ('LONG', 'SHORT')
      ORDER BY r.variant_id, d.week_open_utc, d.symbol
    `,
    [variantRunIds],
  );
}

async function deriveFridayOpenSameDirectionAgreeMetric() {
  const variantIds = ["strength_friday_snapshot_selected", "strength_open_canonical_selected"];
  const variants = await readVariantRuns(variantIds);
  if (variants.length !== variantIds.length) {
    throw new Error(`Missing strength variant runs: expected ${variantIds.length}, found ${variants.length}`);
  }
  const variantRunIds = variants.map((row) => row.variant_run_id);
  const weekResults = await readWeekResults(variantRunIds);
  const decisions = await readPairDecisions(variantRunIds);
  const allWeeks = [...new Set(weekResults.map((row) => isoUtc(row.week_open_utc)).filter(Boolean) as string[])]
    .sort();
  const fridayRun = variants.find((row) => row.variant_id === "strength_friday_snapshot_selected");
  const openRun = variants.find((row) => row.variant_id === "strength_open_canonical_selected");
  if (!fridayRun || !openRun) throw new Error("Missing Friday/open strength run ids");

  const weekResultByRunWeek = new Map<string, WeekResultRow>();
  for (const row of weekResults) {
    const week = isoUtc(row.week_open_utc);
    if (week) weekResultByRunWeek.set(`${row.variant_run_id}|${week}`, row);
  }

  const openDecisionByWeekSymbol = new Map<string, Direction>();
  const fridayDecisions: PairDecisionRow[] = [];
  for (const row of decisions) {
    const week = isoUtc(row.week_open_utc);
    if (!week) continue;
    const key = `${week}|${row.symbol}`;
    if (row.variant_run_id === openRun.variant_run_id) {
      openDecisionByWeekSymbol.set(key, row.selected_side);
    } else if (row.variant_run_id === fridayRun.variant_run_id) {
      fridayDecisions.push(row);
    }
  }

  const weeklyTotals = new Map<string, number>();
  let selectedRows = 0;
  for (const row of fridayDecisions) {
    const week = isoUtc(row.week_open_utc);
    if (!week) continue;
    const openSide = openDecisionByWeekSymbol.get(`${week}|${row.symbol}`);
    if (openSide !== row.selected_side) continue;
    const weekResult = weekResultByRunWeek.get(`${fridayRun.variant_run_id}|${week}`);
    const contribution = asNumber(weekResult?.pair_contributions?.[row.symbol], 0);
    weeklyTotals.set(week, (weeklyTotals.get(week) ?? 0) + contribution);
    selectedRows += 1;
  }

  return metricFromWeeklyTotals({
    candidateId: "strength_friday_snapshot_open_canonical_same_direction_agree_derived",
    candidateLabel: "Friday frozen strength + open canonical strength same-direction agree",
    source: "derived_from_gate44_strength_pair_decisions",
    weeklyTotals,
    allWeeks,
    selectedRows,
    note: "Derived only from cached Gate 44 Friday/open selected pair decisions; no ADR execution rerun.",
  });
}

function selectModeRows(receipt: JsonRecord, ids: string[]) {
  const rows = (receipt.modeResults as JsonRecord[] | undefined) ?? [];
  return rows
    .filter((row) => ids.includes(String(row.variantId)) && row.mode === "selected_all" && row.thresholdPercent === 1)
    .map((row) => modeResultToMetric(row, "gate51_full_window_rrp_receipt"));
}

function selectLifecycleBucket(receipt: JsonRecord, variantId: string, bucket: string, rrpBucket: string) {
  const rows = (receipt.metricResults as JsonRecord[] | undefined) ?? [];
  const found = rows.find((row) =>
    row.variantId === variantId &&
    row.groupType === "lifecycle_polarity_x_rrp" &&
    row.lifecycleBucket === bucket &&
    row.rrpBucket === rrpBucket);
  return found ? modeResultToMetric(found, "gate51b_lifecycle_rrp_receipt", `${bucket} / ${rrpBucket}`) : null;
}

function fmt(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(4);
  return String(value);
}

function renderMetricTable(rows: MetricRow[]) {
  const lines = [
    "| Candidate | Rows | ADR | DD | R/DD | Sharpe | PF | Win | Worst year |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---|",
  ];
  for (const row of rows) {
    const candidate = row.note ? `${row.candidateId} (${row.note})` : row.candidateId;
    lines.push(`| ${[
      candidate,
      fmt(row.selectedRows),
      fmt(row.totalAdr),
      fmt(row.maxDrawdownAdr),
      fmt(row.returnToDrawdown),
      fmt(row.pathSharpeAdr),
      fmt(row.profitFactorAdr),
      fmt(row.weeklyWinRateActive),
      `${fmt(row.worstYear)} ${fmt(row.worstYearAdr)}`,
    ].join(" | ")} |`);
  }
  return lines.join("\n");
}

function renderMarkdown(receipt: JsonRecord) {
  const decision = receipt.decision as JsonRecord;
  const comparisons = receipt.comparisons as JsonRecord;
  const lines = [
    "# Gate 51C Selector Candidate Lockdown",
    "",
    `Generated: ${receipt.generatedAtUtc}`,
    "",
    "## Result",
    "",
    `- Status: ${receipt.status}`,
    `- Gate: ${receipt.gate}`,
    `- Locked COT research candidate: ${decision.lockedCotResearchCandidate}`,
    `- Locked Strength research candidate: ${decision.lockedStrengthResearchCandidate}`,
    `- Retained simple Strength anchor: ${decision.retainedSimpleStrengthAnchor}`,
    `- ADR-normalized reporting: ${receipt.adrNormalized}`,
    `- Production claim: ${receipt.productionClaim}`,
    "",
    "## COT Candidate Comparison",
    "",
    renderMetricTable(comparisons.cotShortlist as MetricRow[]),
    "",
    "## COT Lifecycle Evidence",
    "",
    renderMetricTable(comparisons.cotLifecycleKeyBuckets as MetricRow[]),
    "",
    "## Strength Candidate Comparison",
    "",
    renderMetricTable(comparisons.strengthShortlist as MetricRow[]),
    "",
    "## Decision",
    "",
    `- COT: ${decision.cotDecisionText}`,
    `- Strength: ${decision.strengthDecisionText}`,
    `- Simple Strength anchor: ${decision.simpleStrengthAnchorText}`,
    `- Frozen exclusions: ${decision.frozenExclusions}`,
    "",
    "No live, ACTIVE, production-ready, portfolio-ready, source-promotion, or Gate 52 claim is made by this receipt.",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const outDir = argValue("out-dir") ?? DEFAULT_OUT_DIR;
  await mkdir(outDir, { recursive: true });

  const [fullReceipt, noncommReceipt, levMoneyReceipt] = await Promise.all([
    readJson(FULL_RRP_RECEIPT),
    readJson(NONCOMM_LIFECYCLE_RECEIPT),
    readJson(LEV_MONEY_LIFECYCLE_RECEIPT),
  ]);

  const cotShortlist = selectModeRows(fullReceipt, COT_SHORTLIST);
  const strengthShortlist = selectModeRows(fullReceipt, STRENGTH_SHORTLIST);
  strengthShortlist.push(await deriveFridayOpenSameDirectionAgreeMetric());
  strengthShortlist.sort((left, right) =>
    (right.returnToDrawdown ?? -Infinity) - (left.returnToDrawdown ?? -Infinity));

  const cotLifecycleKeyBuckets = [
    selectLifecycleBucket(noncommReceipt, "cot_faces_v1_commercial_delta_contrarian_selected", "fade_lean", "all"),
    selectLifecycleBucket(noncommReceipt, "cot_faces_v1_commercial_delta_contrarian_selected", "with_extreme", "all"),
    selectLifecycleBucket(noncommReceipt, "cot_faces_v1_commercial_delta_contrarian_selected", "with_extreme", "confirm"),
    selectLifecycleBucket(noncommReceipt, "cot_faces_v1_commercial_delta_contrarian_selected", "with_lean", "confirm"),
    selectLifecycleBucket(noncommReceipt, "cot_faces_v1_commercial_delta_contrarian_selected", "with_lean", "weak"),
    selectLifecycleBucket(levMoneyReceipt, "cot_faces_v1_commercial_delta_contrarian_selected", "fade_lean", "confirm"),
    selectLifecycleBucket(levMoneyReceipt, "cot_faces_v1_commercial_delta_contrarian_selected", "with_extreme", "confirm"),
    selectLifecycleBucket(levMoneyReceipt, "cot_faces_v1_commercial_delta_contrarian_selected", "with_lean", "confirm"),
  ].filter(Boolean) as MetricRow[];

  const receiptWithoutHash = {
    schemaVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    gate: GATE,
    status: "PASS_SELECTOR_CANDIDATE_LOCKDOWN_DIAGNOSTIC",
    adrNormalized: true,
    rawReturnsReported: false,
    productionClaim: false,
    liveClaim: false,
    activePromotionClaim: false,
    sourcePromotionClaim: false,
    sourceRefetchPerformed: false,
    sourceRebuildPerformed: false,
    adrExecutionRerunPerformed: false,
    identity: {
      matrixDatasetId: MATRIX_DATASET_ID,
      matrixDatasetHash: MATRIX_DATASET_HASH,
      rrpDatasetId: RRP_DATASET_ID,
      rrpDatasetHash: RRP_DATASET_HASH,
      sourceContentInvariantHash: SOURCE_CONTENT_INVARIANT_HASH,
      finalActiveResolvedContentJoinMapHash: FINAL_ACTIVE_RESOLVED_CONTENT_JOIN_MAP_HASH,
      sourceReceipts: {
        fullRrpReceipt: FULL_RRP_RECEIPT,
        noncommLifecycleReceipt: NONCOMM_LIFECYCLE_RECEIPT,
        levMoneyLifecycleReceipt: LEV_MONEY_LIFECYCLE_RECEIPT,
      },
    },
    comparisons: {
      cotShortlist,
      cotLifecycleKeyBuckets,
      strengthShortlist,
    },
    decision: {
      lockedCotResearchCandidate: "cot_lifecycle_polarity_v0_noncomm_primary",
      cotDecisionText:
        "Use COT lifecycle polarity as the single COT research candidate for continued RRP pairing. Use cot_faces_v1_commercial_delta_contrarian_selected only as the frozen Gate 44 directional harness until a pure lifecycle runner is built.",
      lockedStrengthResearchCandidate: "strength_friday_snapshot_open_canonical_fade_agree",
      strengthDecisionText:
        "Use Friday frozen strength plus open canonical strength fade-agreement as the single Strength research candidate because it has the best full-window R/DD and lowest drawdown among tested/derived Strength candidates. Keep Friday snapshot selected as the broad benchmark; reject open selected for now.",
      retainedSimpleStrengthAnchor: "strength_friday_snapshot_selected",
      simpleStrengthAnchorText:
        "Retain Friday frozen strength selected as the simple Strength anchor and broad benchmark because its logic is easier to defend than Sunday/Monday open-fade behavior, even though SFA has better risk quality in Gate 51C.",
      legacySelectorsNotSourcePromoted: true,
      noCotFacesExpansion: true,
      noDealerCommercialExpansion: true,
      noStrengthCompositeExpansion: true,
      frozenExclusions:
        "Do not expand COT Faces, Dealer+Commercial, Strength open-only, or new Strength composites during Gate 51 unless this selector-lockdown gate is explicitly reopened. Friday-only may remain a benchmark/simple anchor, not a second optimization branch.",
    },
  };

  const receipt = {
    ...receiptWithoutHash,
    receiptHash: sha256Stable(receiptWithoutHash),
  };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").slice(0, 15);
  const jsonPath = path.join(outDir, `gate51-selector-candidate-lockdown-${stamp}.json`);
  const mdPath = path.join(outDir, `gate51-selector-candidate-lockdown-${stamp}.md`);
  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderMarkdown(receipt as JsonRecord), "utf8");

  console.log(JSON.stringify({
    status: receipt.status,
    lockedCotResearchCandidate: receipt.decision.lockedCotResearchCandidate,
    lockedStrengthResearchCandidate: receipt.decision.lockedStrengthResearchCandidate,
    retainedSimpleStrengthAnchor: receipt.decision.retainedSimpleStrengthAnchor,
    strengthLeader: strengthShortlist[0],
    jsonPath,
    mdPath,
    receiptHash: receipt.receiptHash,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
