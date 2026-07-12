import { mkdir } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized, query } from "@database/db/client";
import { getExecutionWeekWindow } from "@engine/evaluation/executionPriceWindows";
import { getAdrPct, getTargetAdrPct } from "@engine/price/adrLookup";
import { localM1WarehouseExists, readLocalM1Bars } from "@engine/price/localM1Warehouse";
import type { CanonicalPriceBar } from "@engine/price/canonicalPriceBars";
import { readBasketPathWarehouseDiagnostics } from "@engine/research/basketPathWarehouse";
import { sha256Stable, sha256Text } from "@engine/research/hash";
import {
  beginTradeLegPathWarehouse,
  buildTradeLegPathWarehouseConfig,
  buildTradeLegPathWarehouseManifestId,
  completeTradeLegPathWarehouse,
  hashTradeLegFirstTouches,
  hashTradeLegPathPayload,
  hashTradeLegPathWarehouseConfig,
  markTradeLegPathWarehouseFailed,
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehousePairWeek,
  TRADE_LEG_PATH_CONTRACT_ID,
  TRADE_LEG_PATH_PAYLOAD_CODEC,
  type TradeLegFirstTouchRow,
  type TradeLegPathColumnarPayload,
  type TradeLegPathPairWeek,
} from "@engine/research/tradeLegPathWarehouse";

import { fileHash, gitCommit, parseArgMap, readJson, round, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";
import {
  DEFAULT_CANDIDATE_B_LEDGER_PATH,
  DEFAULT_GATE71A_DIR,
  GATE71_ASSET_CLASS,
  GATE71_EXPECTED_SYMBOLS_PER_WEEK,
  GATE71_EXPECTED_WEEKS,
  GATE71_PATH_RESOLUTION,
  GATE71_PRICE_BUNDLE_ID,
  directionSign,
  groupCandidateBRowsByWeek,
  loadCandidateBRows,
  loadGate71aSummary,
  preloadGate71AdrMaps,
  validateCandidateBRows,
  type CandidateBDecisionRow,
} from "./gate71-utils";
import {
  LOCKED_DEFAULT_CANDIDATE_ID,
  LOCKED_FINAL_ALGORITHM_ID,
} from "./gate70-utils";

const GATE_ID = "Gate 74B: trade-leg-path-materialization";
const GATE_DATE = "2026-06-29";
const COMMAND = "npm run engine:gate74b:trade-leg-path-materialization";
const DEFAULT_GATE74A_DIR = "docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze";
const DEFAULT_GATE71BM_SUMMARY_PATH =
  "docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse/gate71bm-summary.json";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate74b/GATE74B_TRADE_LEG_PATH_MATERIALIZATION_${GATE_DATE}.md`;

const TOUCH_THRESHOLDS_ADR = [-5, -3, -2, -1.5, -1, -0.75, -0.5, -0.25, 0, 0.1, 0.2, 0.25, 0.3, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5] as const;

type Gate74aSummary = {
  verdict: string;
  validation: {
    candidate_b_forced28_preserved: boolean;
    base_warehouse_materialization_started: boolean;
    replay_adapters_started: boolean;
    policy_optimization_started: boolean;
    risk_layer_started: boolean;
    mt5_live_runtime_started: boolean;
    brain_truth_mutated: boolean;
  };
};

type Gate74aProtocol = {
  upstream_bindings: {
    candidate_b_final_ledger_hash: string;
    candidate_b_ledger_file_sha256: string;
    gate71bm_basket_path_manifest_id: string;
    gate71bm_basket_path_warehouse_hash: string;
  };
  path_contract: {
    asset_class: string;
    price_bundle_id: string;
    path_resolution: string;
    adr_target_pct: number;
    entry_reference: string;
    weekly_cutoff_reference: string;
  };
};

type Gate74aBaseContract = {
  forbidden_base_fields: string[];
  required_manifest_fields: string[];
  required_path_point_fields: string[];
};

type Gate71bmSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    weeks: number;
    point_count: number;
  };
};

type DirectionLifecycle = {
  direction_streak_id: string;
  flip_week_open_utc: string | null;
  flip_boundary_utc: string | null;
};

type CoverageAccumulator = {
  complete_pair_weeks: number;
  partial_pair_weeks: number;
  missing_pair_weeks: number;
  default_adr_pair_weeks: number;
  min_actual_bars: number | null;
  max_actual_bars: number | null;
  partial_samples: Array<{
    week_open_utc: string;
    pair: string;
    expected_bar_count: number;
    actual_bar_count: number;
    coverage_state: string;
  }>;
};

function parseOptions() {
  const args = parseArgMap();
  const maxWeeksRaw = args.get("--max-weeks");
  return {
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    gate74aDir: args.get("--gate74a-dir") ?? DEFAULT_GATE74A_DIR,
    gate71aDir: args.get("--gate71a-dir") ?? DEFAULT_GATE71A_DIR,
    gate71bmSummaryPath: args.get("--gate71bm-summary") ?? DEFAULT_GATE71BM_SUMMARY_PATH,
    candidateBLedgerPath: args.get("--candidate-b-ledger") ?? DEFAULT_CANDIDATE_B_LEDGER_PATH,
    manifestId: args.get("--manifest-id"),
    overwrite: process.argv.includes("--overwrite"),
    logProgress: process.argv.includes("--log-progress"),
    maxWeeks: maxWeeksRaw ? Number(maxWeeksRaw) : null,
  };
}

function iso(value: string | Date | null | undefined) {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function round6(value: number) {
  return round(value, 6) ?? value;
}

function expectedBarCount(windowOpenUtc: string, windowCloseUtc: string) {
  const diffMs = Date.parse(windowCloseUtc) - Date.parse(windowOpenUtc);
  return Math.max(0, Math.round(diffMs / 60_000));
}

function buildDirectionLifecycle(rows: CandidateBDecisionRow[]) {
  const bySymbol = new Map<string, CandidateBDecisionRow[]>();
  for (const row of rows) {
    const symbol = row.symbol.toUpperCase();
    const symbolRows = bySymbol.get(symbol) ?? [];
    symbolRows.push(row);
    bySymbol.set(symbol, symbolRows);
  }
  const lifecycleByRowKey = new Map<string, DirectionLifecycle>();
  for (const [symbol, symbolRows] of bySymbol.entries()) {
    const sorted = [...symbolRows].sort((left, right) => left.week_open_utc.localeCompare(right.week_open_utc));
    let streakIndex = 0;
    let currentSide: CandidateBDecisionRow["final_side"] | null = null;
    let streakStartWeek = "";
    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index]!;
      if (row.final_side !== currentSide) {
        streakIndex += 1;
        currentSide = row.final_side;
        streakStartWeek = row.week_open_utc;
      }
      const nextFlip = sorted.slice(index + 1).find((future) => future.final_side !== row.final_side) ?? null;
      const flipWindow = nextFlip ? getExecutionWeekWindow(nextFlip.week_open_utc, GATE71_ASSET_CLASS) : null;
      const streakHash = sha256Stable({
        symbol,
        side: row.final_side,
        streak_index: streakIndex,
        streak_start_week: streakStartWeek,
      }).slice(0, 10);
      lifecycleByRowKey.set(row.row_key, {
        direction_streak_id: `gate74b_${symbol}_${row.final_side}_${streakStartWeek.slice(0, 10)}_${streakHash}`,
        flip_week_open_utc: nextFlip?.week_open_utc ?? null,
        flip_boundary_utc: flipWindow?.windowOpenUtc.toUTC().toISO() ?? null,
      });
    }
  }
  return lifecycleByRowKey;
}

function buildPayloadHashRoot(payloadWithoutRoot: Omit<TradeLegPathColumnarPayload, "point_hash_root">) {
  return sha256Text(JSON.stringify(payloadWithoutRoot));
}

function buildFirstTouchRows(payload: TradeLegPathColumnarPayload): TradeLegFirstTouchRow[] {
  return TOUCH_THRESHOLDS_ADR.map((threshold) => {
    let firstCloseIndex: number | null = null;
    let firstTouchIndex: number | null = null;
    for (let index = 0; index < payload.timestamp_utc.length; index += 1) {
      const close = payload.directed_close_adr[index] ?? 0;
      const high = payload.directed_high_adr[index] ?? 0;
      const low = payload.directed_low_adr[index] ?? 0;
      const closeHit = threshold >= 0 ? close >= threshold : close <= threshold;
      const touchHit = threshold >= 0 ? high >= threshold : low <= threshold;
      if (firstCloseIndex === null && closeHit) firstCloseIndex = index;
      if (firstTouchIndex === null && touchHit) firstTouchIndex = index;
      if (firstCloseIndex !== null && firstTouchIndex !== null) break;
    }
    const touchTimestamp = firstTouchIndex === null ? null : payload.timestamp_utc[firstTouchIndex] ?? null;
    const closeTimestamp = firstCloseIndex === null ? null : payload.timestamp_utc[firstCloseIndex] ?? null;
    const sameBarCrossedZero = firstTouchIndex === null
      ? null
      : threshold > 0
        ? (payload.directed_low_adr[firstTouchIndex] ?? 0) <= 0
        : threshold < 0
          ? (payload.directed_high_adr[firstTouchIndex] ?? 0) >= 0
          : false;
    return {
      threshold_adr: threshold,
      first_close_index: firstCloseIndex,
      first_close_timestamp_utc: closeTimestamp,
      first_touch_index: firstTouchIndex,
      first_touch_timestamp_utc: touchTimestamp,
      touch_source: firstTouchIndex === null ? null : firstTouchIndex === firstCloseIndex ? "close" : "high_low",
      same_bar_crossed_zero: sameBarCrossedZero,
    };
  });
}

function directedAdrValues(options: {
  bar: CanonicalPriceBar;
  side: "LONG" | "SHORT";
  entryPrice: number;
  pairAdrPct: number;
}) {
  const sign = directionSign(options.side);
  const toAdr = (price: number) => ((price - options.entryPrice) / options.entryPrice) * 100 * sign / options.pairAdrPct;
  const directedOpen = toAdr(options.bar.openPrice);
  const directedClose = toAdr(options.bar.closePrice);
  const favorableExtreme = options.side === "LONG" ? toAdr(options.bar.highPrice) : toAdr(options.bar.lowPrice);
  const adverseExtreme = options.side === "LONG" ? toAdr(options.bar.lowPrice) : toAdr(options.bar.highPrice);
  return {
    directedOpen: round6(directedOpen),
    directedHigh: round6(Math.max(directedOpen, directedClose, favorableExtreme)),
    directedLow: round6(Math.min(directedOpen, directedClose, adverseExtreme)),
    directedClose: round6(directedClose),
  };
}

function buildPairWeekPath(options: {
  row: CandidateBDecisionRow;
  bars: CanonicalPriceBar[];
  weekOpenUtc: string;
  windowOpenUtc: string;
  windowCloseUtc: string;
  pathResolution: string;
  pairAdrPct: number;
  adrWasDefault: boolean;
  lifecycle: DirectionLifecycle;
}): TradeLegPathPairWeek {
  const symbol = options.row.symbol.toUpperCase();
  const bars = [...options.bars].sort((left, right) => left.barOpenUtc.localeCompare(right.barOpenUtc));
  const first = bars.find((bar) => Number.isFinite(bar.openPrice) && bar.openPrice > 0) ?? null;
  const entryPrice = first?.openPrice ?? null;
  const entryTimestampUtc = first?.barOpenUtc ?? options.windowOpenUtc;
  const expectedBars = expectedBarCount(options.windowOpenUtc, options.windowCloseUtc);
  const coverageState = bars.length === 0 ? "missing" : bars.length < expectedBars ? "partial" : "complete";
  const timestamps = [entryTimestampUtc];
  const directedOpen = [0];
  const directedHigh = [0];
  const directedLow = [0];
  const directedClose = [0];
  const basketContributionClose = [0];
  const mfeToDate = [0];
  const maeToDate = [0];
  let mfe = 0;
  let mae = 0;
  let mfeTimestamp = entryTimestampUtc;
  let maeTimestamp = entryTimestampUtc;
  let firstGreenTimestamp: string | null = null;
  let firstRedTimestamp: string | null = null;

  if (entryPrice !== null && entryPrice > 0) {
    for (const bar of bars) {
      const directed = directedAdrValues({
        bar,
        side: options.row.final_side,
        entryPrice,
        pairAdrPct: options.pairAdrPct,
      });
      const timestamp = bar.barCloseUtc;
      if (directed.directedHigh > mfe) {
        mfe = directed.directedHigh;
        mfeTimestamp = timestamp;
      }
      if (directed.directedLow < mae) {
        mae = directed.directedLow;
        maeTimestamp = timestamp;
      }
      if (firstGreenTimestamp === null && directed.directedHigh > 0) firstGreenTimestamp = timestamp;
      if (firstRedTimestamp === null && directed.directedLow < 0) firstRedTimestamp = timestamp;
      timestamps.push(timestamp);
      directedOpen.push(directed.directedOpen);
      directedHigh.push(directed.directedHigh);
      directedLow.push(directed.directedLow);
      directedClose.push(directed.directedClose);
      basketContributionClose.push(directed.directedClose);
      mfeToDate.push(round6(mfe));
      maeToDate.push(round6(mae));
    }
  }

  const payloadWithoutRoot = {
    schema_version: 1 as const,
    representation: "columnar_trade_leg_path_points_v1" as const,
    week_open_utc: new Date(options.weekOpenUtc).toISOString(),
    pair: symbol,
    candidate_b_side: options.row.final_side,
    direction_streak_id: options.lifecycle.direction_streak_id,
    direction_still_valid: true,
    flip_boundary_utc: options.lifecycle.flip_boundary_utc,
    coverage_state: coverageState,
    timestamp_utc: timestamps.map((timestamp) => new Date(timestamp).toISOString()),
    directed_open_adr: directedOpen.map(round6),
    directed_high_adr: directedHigh.map(round6),
    directed_low_adr: directedLow.map(round6),
    directed_close_adr: directedClose.map(round6),
    basket_contribution_close_adr: basketContributionClose.map(round6),
    mfe_adr_to_date: mfeToDate.map(round6),
    mae_adr_to_date: maeToDate.map(round6),
    first_green_timestamp_utc: firstGreenTimestamp,
    first_red_timestamp_utc: firstRedTimestamp,
  };
  const payload: TradeLegPathColumnarPayload = {
    ...payloadWithoutRoot,
    point_hash_root: buildPayloadHashRoot(payloadWithoutRoot),
  };
  const firstTouchRows = buildFirstTouchRows(payload);
  const pathHash = hashTradeLegPathPayload(payload);
  const firstTouchHash = hashTradeLegFirstTouches(firstTouchRows);
  const summaryBase = {
    week_open_utc: payload.week_open_utc,
    pair: symbol,
    candidate_b_side: options.row.final_side,
    final_direction: options.row.final_direction,
    candidate_row_key: options.row.row_key,
    decision_hash: options.row.decision_hash,
    direction_streak_id: options.lifecycle.direction_streak_id,
    flip_boundary_utc: options.lifecycle.flip_boundary_utc,
    flip_week_open_utc: options.lifecycle.flip_week_open_utc,
    entry_timestamp_utc: entryTimestampUtc,
    friday_cutoff_timestamp_utc: options.windowCloseUtc,
    pair_adr_pct: round6(options.pairAdrPct),
    adr_was_default: options.adrWasDefault,
    entry_price: entryPrice,
    expected_bar_count: expectedBars,
    actual_bar_count: bars.length,
    point_count: payload.timestamp_utc.length,
    coverage_state: coverageState,
    first_bar_utc: first?.barOpenUtc ?? null,
    last_bar_utc: bars.at(-1)?.barCloseUtc ?? null,
    first_green_timestamp_utc: firstGreenTimestamp,
    first_red_timestamp_utc: firstRedTimestamp,
    mfe_adr: round6(mfe),
    mfe_timestamp_utc: mfeTimestamp,
    mae_adr: round6(mae),
    mae_timestamp_utc: maeTimestamp,
    friday_close_adr: payload.directed_close_adr.at(-1) ?? 0,
    path_hash: pathHash,
    first_touch_hash: firstTouchHash,
  };
  const summaryHash = sha256Stable(summaryBase);
  return {
    ...summaryBase,
    path_resolution: options.pathResolution,
    direction_still_valid: true,
    pair_adr_pct: round6(options.pairAdrPct),
    entry_price: entryPrice === null ? null : round6(entryPrice),
    first_touch_indexes: firstTouchRows,
    path_payload: payload,
    summary_hash: summaryHash,
    content_hash: sha256Stable({ ...summaryBase, summary_hash: summaryHash }),
  };
}

function updateCoverage(coverage: CoverageAccumulator, row: TradeLegPathPairWeek) {
  if (row.coverage_state === "complete") coverage.complete_pair_weeks += 1;
  if (row.coverage_state === "partial") coverage.partial_pair_weeks += 1;
  if (row.coverage_state === "missing") coverage.missing_pair_weeks += 1;
  if (row.adr_was_default) coverage.default_adr_pair_weeks += 1;
  coverage.min_actual_bars = coverage.min_actual_bars === null ? row.actual_bar_count : Math.min(coverage.min_actual_bars, row.actual_bar_count);
  coverage.max_actual_bars = coverage.max_actual_bars === null ? row.actual_bar_count : Math.max(coverage.max_actual_bars, row.actual_bar_count);
  if (row.coverage_state !== "complete" && coverage.partial_samples.length < 50) {
    coverage.partial_samples.push({
      week_open_utc: row.week_open_utc,
      pair: row.pair,
      expected_bar_count: row.expected_bar_count,
      actual_bar_count: row.actual_bar_count,
      coverage_state: row.coverage_state,
    });
  }
}

function noPolicyFieldAudit(baseContract: Gate74aBaseContract) {
  const manifestFields = [
    "manifest_id",
    "contract_id",
    "status",
    "config_hash",
    "warehouse_hash",
    "candidate_b_ledger_file_sha256",
    "candidate_b_final_ledger_hash",
    "price_bundle_id",
    "path_resolution",
    "adr_target_pct",
    "week_count",
    "pair_week_count",
    "path_point_count",
    "chunk_count",
    "generated_at",
    "git_commit",
  ];
  const pairWeekFields = [
    "week_open_utc",
    "timestamp_utc",
    "pair",
    "candidate_b_side",
    "direction_streak_id",
    "directed_open_adr",
    "directed_high_adr",
    "directed_low_adr",
    "directed_close_adr",
    "basket_contribution_close_adr",
    "mfe_adr_to_date",
    "mae_adr_to_date",
    "first_green_timestamp_utc",
    "first_red_timestamp_utc",
    "direction_still_valid",
    "flip_boundary_utc",
    "coverage_state",
    "content_hash",
    "path_hash",
    "first_touch_indexes",
  ];
  const forbidden = new Set(baseContract.forbidden_base_fields);
  const checkedFields = [...manifestFields, ...pairWeekFields];
  return {
    forbidden_base_fields: baseContract.forbidden_base_fields,
    checked_field_count: checkedFields.length,
    forbidden_field_violations: checkedFields.filter((field) => forbidden.has(field)),
    required_manifest_fields_present: baseContract.required_manifest_fields.every((field) => manifestFields.includes(field)),
    required_path_point_fields_present: baseContract.required_path_point_fields.every((field) => pairWeekFields.includes(field)),
    columnar_storage_note:
      "Path points are stored as compressed columnar arrays with pair-week path_hash and chunk_hash durability, not one physical DB row per minute point.",
  };
}

async function loadChunkHashes(manifestId: string) {
  const rows = await query<{
    chunk_index: number | string;
    week_open_utc: Date | string;
    pair_week_count: number | string;
    path_point_count: number | string;
    chunk_hash: string;
  }>(
    `SELECT chunk_index, week_open_utc, pair_week_count, path_point_count, chunk_hash
       FROM research_trade_leg_path_chunks
      WHERE manifest_id = $1
      ORDER BY chunk_index ASC`,
    [manifestId],
  );
  return rows.map((row) => ({
    chunk_index: Number(row.chunk_index),
    week_open_utc: iso(row.week_open_utc),
    pair_week_count: Number(row.pair_week_count),
    path_point_count: Number(row.path_point_count),
    chunk_hash: row.chunk_hash,
  }));
}

function renderReport(summary: {
  generated_at: string;
  verdict: string;
  warehouse: unknown;
  coverage: unknown;
  reconstruction_audit: unknown;
  no_policy_field_audit: unknown;
  validation: unknown;
  artifacts: Record<string, string>;
}) {
  return [
    "# Gate 74B Trade-Leg Path Materialization",
    "",
    `Generated: \`${summary.generated_at}\``,
    "",
    "## Verdict",
    "",
    `\`${summary.verdict}\``,
    "",
    "## Scope",
    "",
    "- Materializes policy-neutral Candidate B pair/trade-leg path primitives.",
    "- Stores directed pair OHLC ADR paths in a compressed columnar pair-week warehouse.",
    "- Supports future replay adapters such as per-pair fixed ADR targets without testing those policies in this gate.",
    "- Does not run exit-policy replay, target selection, promotion, risk, MT5/live, or Brain/source mutation.",
    "",
    "## Warehouse",
    "",
    "```json",
    JSON.stringify(summary.warehouse, null, 2),
    "```",
    "",
    "## Coverage",
    "",
    "```json",
    JSON.stringify(summary.coverage, null, 2),
    "```",
    "",
    "## Reconstruction Audit",
    "",
    "```json",
    JSON.stringify(summary.reconstruction_audit, null, 2),
    "```",
    "",
    "## No-Drift / No-Policy Audit",
    "",
    "```json",
    JSON.stringify(summary.no_policy_field_audit, null, 2),
    "```",
    "",
    "## Validation",
    "",
    "```json",
    JSON.stringify(summary.validation, null, 2),
    "```",
    "",
    "## Artifacts",
    "",
    `- Summary: \`${summary.artifacts.summaryJson}\``,
    `- Schema receipt: \`${summary.artifacts.schemaReceipt}\``,
    `- Missing/partial report: \`${summary.artifacts.missingPartialReport}\``,
    `- Row counts: \`${summary.artifacts.rowCounts}\``,
    `- Chunk hashes: \`${summary.artifacts.chunkHashes}\``,
    `- Reconstruction audit: \`${summary.artifacts.reconstructionAudit}\``,
    `- No-policy audit: \`${summary.artifacts.noPolicyAudit}\``,
    `- SHA identity: \`${summary.artifacts.shaIdentity}\``,
    "",
    "## Stop Line",
    "",
    "Gate 74B materializes base path primitives only. Gate 74C replay adapters, fixed 0.2 ADR per-pair target tests, close-winners/hold-losers, carry-until-flip performance, dynamic exits, risk, MT5/live, source mutation, Brain mutation, and promotion remain closed until explicitly opened.",
    "",
  ].join("\n");
}

async function main() {
  const options = parseOptions();
  if (options.maxWeeks !== null && (!Number.isInteger(options.maxWeeks) || options.maxWeeks <= 0)) {
    throw new Error(`Invalid --max-weeks: ${options.maxWeeks}`);
  }
  if (!localM1WarehouseExists()) {
    throw new Error("Local canonical M1 warehouse is required for Gate 74B materialization.");
  }
  const artifactDir = path.resolve(options.artifactDir);
  const reportPath = path.resolve(options.reportPath);
  await mkdir(artifactDir, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });

  const gate74aSummary = await readJson<Gate74aSummary>(path.join(options.gate74aDir, "gate74a-summary.json"));
  const gate74aProtocol = await readJson<Gate74aProtocol>(path.join(options.gate74aDir, "trade-leg-path-warehouse-protocol-freeze.json"));
  const gate74aBaseContract = await readJson<Gate74aBaseContract>(path.join(options.gate74aDir, "base-warehouse-contract.json"));
  const gate71a = await loadGate71aSummary(options.gate71aDir);
  const gate71bm = await readJson<Gate71bmSummary>(options.gate71bmSummaryPath);
  const candidateRows = await loadCandidateBRows(options.candidateBLedgerPath);
  const candidateShape = validateCandidateBRows(candidateRows);
  const candidateBLedgerFileHash = (await fileHash(options.candidateBLedgerPath)).toUpperCase();
  const groupedWeeks = groupCandidateBRowsByWeek(candidateRows).slice(0, options.maxWeeks ?? undefined);
  const selectedWeeks = groupedWeeks.map(([week]) => week);
  const selectedRows = groupedWeeks.flatMap(([, rows]) => rows);
  const selectedSymbols = Array.from(new Set(selectedRows.map((row) => row.symbol.toUpperCase()))).sort();
  const config = buildTradeLegPathWarehouseConfig({
    priceBundleId: GATE71_PRICE_BUNDLE_ID,
    assetClass: GATE71_ASSET_CLASS,
    pathResolution: GATE71_PATH_RESOLUTION,
    candidateId: LOCKED_DEFAULT_CANDIDATE_ID,
    lockedAlgorithmId: LOCKED_FINAL_ALGORITHM_ID,
    candidateBLedgerHash: gate74aProtocol.upstream_bindings.candidate_b_final_ledger_hash,
    candidateBLedgerFileSha256: candidateBLedgerFileHash,
    candidateBFinalLedgerHash: gate74aProtocol.upstream_bindings.candidate_b_final_ledger_hash,
    entryExposureModelId: gate71a.protocol.clean_entry_exposure_model_id,
    adrTargetPct: getTargetAdrPct(),
    symbols: selectedSymbols,
    weeks: selectedWeeks,
  });
  const manifestId = options.manifestId ?? buildTradeLegPathWarehouseManifestId(config);
  const configHash = hashTradeLegPathWarehouseConfig(config);
  const expectedWeeks = options.maxWeeks ?? GATE71_EXPECTED_WEEKS;
  const lifecycleByRowKey = buildDirectionLifecycle(candidateRows);
  const adrMaps = await preloadGate71AdrMaps({
    weeks: selectedWeeks,
    symbols: selectedSymbols,
  });
  const startedAt = Date.now();
  const coverage: CoverageAccumulator = {
    complete_pair_weeks: 0,
    partial_pair_weeks: 0,
    missing_pair_weeks: 0,
    default_adr_pair_weeks: 0,
    min_actual_bars: null,
    max_actual_bars: null,
    partial_samples: [],
  };
  const basketCloseByWeek = new Map<string, number>();

  await beginTradeLegPathWarehouse({
    manifestId,
    config,
    overwrite: options.overwrite,
  });

  try {
    for (const [chunkIndex, [weekOpenUtc, weekRows]] of groupedWeeks.entries()) {
      const executionWindow = getExecutionWeekWindow(weekOpenUtc, GATE71_ASSET_CLASS);
      const windowOpenUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? weekOpenUtc;
      const windowCloseUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? weekOpenUtc;
      const barsBySymbol = readLocalM1Bars(
        weekRows.map((row) => row.symbol),
        windowOpenUtc,
        windowCloseUtc,
        GATE71_PATH_RESOLUTION,
      );
      const adrMap = adrMaps.get(weekOpenUtc) ?? new Map();
      const pairRows: TradeLegPathPairWeek[] = [];
      for (const row of weekRows) {
        const symbol = row.symbol.toUpperCase();
        const lifecycle = lifecycleByRowKey.get(row.row_key);
        if (!lifecycle) throw new Error(`Missing direction lifecycle metadata for ${row.row_key}`);
        const pairAdrPct = getAdrPct(adrMap, symbol, GATE71_ASSET_CLASS);
        const pairWeek = buildPairWeekPath({
          row,
          bars: barsBySymbol.get(symbol) ?? [],
          weekOpenUtc,
          windowOpenUtc,
          windowCloseUtc,
          pathResolution: GATE71_PATH_RESOLUTION,
          pairAdrPct,
          adrWasDefault: !adrMap.has(symbol),
          lifecycle,
        });
        updateCoverage(coverage, pairWeek);
        basketCloseByWeek.set(weekOpenUtc, (basketCloseByWeek.get(weekOpenUtc) ?? 0) + pairWeek.friday_close_adr);
        pairRows.push(pairWeek);
      }
      await insertWeek(manifestId, chunkIndex, weekOpenUtc, pairRows);
      if (options.logProgress) {
        const weekPointCount = pairRows.reduce((sum, row) => sum + row.point_count, 0);
        const partialCount = pairRows.filter((row) => row.coverage_state !== "complete").length;
        console.log([
          `gate74b week=${chunkIndex + 1}/${groupedWeeks.length}`,
          `week=${weekOpenUtc.slice(0, 10)}`,
          `pairRows=${pairRows.length}`,
          `points=${weekPointCount}`,
          `partial=${partialCount}`,
          `basketClose=${round6(basketCloseByWeek.get(weekOpenUtc) ?? 0)}`,
        ].join(" | "));
      }
    }

    const runtimeSeconds = Math.round(((Date.now() - startedAt) / 1000) * 10) / 10;
    const inspection = await completeTradeLegPathWarehouse({
      manifestId,
      expectedWeeks: selectedWeeks,
      expectedSymbols: selectedSymbols,
      runtimeSeconds,
      coverage: {
        ...coverage,
        runtime_seconds: runtimeSeconds,
        path_payload_codec: TRADE_LEG_PATH_PAYLOAD_CODEC,
      },
    });
    const manifest = await readTradeLegPathWarehouseManifest(manifestId);
    if (!manifest) throw new Error(`Completed manifest missing: ${manifestId}`);
    const basketDiagnostics = await readBasketPathWarehouseDiagnostics({
      manifestId: gate71bm.warehouse.manifest_id,
      weeks: selectedWeeks,
    });
    const basketDiagnosticByWeek = new Map(
      basketDiagnostics.map((diagnostic) => [diagnostic.week_open_utc, Number(diagnostic.diagnostic.friday_close_adr)]),
    );
    const reconstructionRows = selectedWeeks.map((week) => {
      const pairSum = round6(basketCloseByWeek.get(week) ?? 0);
      const basketClose = round6(basketDiagnosticByWeek.get(week) ?? Number.NaN);
      return {
        week_open_utc: week,
        pair_sum_friday_close_adr: pairSum,
        gate71bm_friday_close_adr: basketClose,
        delta_adr: round6(pairSum - basketClose),
      };
    });
    const reconstructionDeltas = reconstructionRows.map((row) => Math.abs(row.delta_adr));
    const reconstructionAudit = {
      source_basket_manifest_id: gate71bm.warehouse.manifest_id,
      source_basket_warehouse_hash: gate71bm.warehouse.warehouse_hash,
      weeks_checked: reconstructionRows.length,
      max_abs_delta_adr: round6(Math.max(...reconstructionDeltas)),
      mismatch_count_gt_0001: reconstructionRows.filter((row) => Math.abs(row.delta_adr) > 0.0001).length,
      largest_delta_rows: [...reconstructionRows].sort((left, right) => Math.abs(right.delta_adr) - Math.abs(left.delta_adr)).slice(0, 10),
    };
    const sampleRows = [
      selectedRows[0],
      selectedRows[Math.floor(selectedRows.length / 2)],
      selectedRows.at(-1),
    ].filter((row): row is CandidateBDecisionRow => Boolean(row));
    const sampleReconstruction = [];
    for (const row of sampleRows) {
      const stored = await readTradeLegPathWarehousePairWeek({
        manifestId,
        weekOpenUtc: row.week_open_utc,
        pair: row.symbol,
      });
      sampleReconstruction.push({
        week_open_utc: row.week_open_utc,
        pair: row.symbol.toUpperCase(),
        summary_friday_close_adr: stored.friday_close_adr,
        payload_friday_close_adr: stored.path_payload.directed_close_adr.at(-1) ?? null,
        path_hash_matches_payload: hashTradeLegPathPayload(stored.path_payload) === stored.path_hash,
        point_count_matches_payload: stored.point_count === stored.path_payload.timestamp_utc.length,
      });
    }
    const noPolicyAudit = noPolicyFieldAudit(gate74aBaseContract);
    const chunkHashes = await loadChunkHashes(manifestId);
    const rowCounts = {
      row_counts_by_week: inspection.row_counts_by_week,
      row_counts_by_pair: inspection.row_counts_by_pair,
      path_points_by_week: inspection.path_points_by_week,
    };
    const schemaReceipt = {
      gate_id: GATE_ID,
      manifest_id: manifestId,
      contract_id: TRADE_LEG_PATH_CONTRACT_ID,
      warehouse_version: manifest.warehouse_version,
      path_payload_codec: manifest.path_payload_codec,
      physical_storage:
        "one compressed columnar payload per Candidate B pair-week; chunks are one logical week each",
      logical_path_point_contract: gate74aBaseContract.required_path_point_fields,
      durability_hashing: {
        path_hash: "SHA-256 of canonical uncompressed columnar path payload",
        first_touch_hash: "SHA-256 of first-touch acceleration rows",
        content_hash: "SHA-256 of pair-week summary plus path and first-touch hashes",
        chunk_hash: "SHA-256 of week-level pair content hashes",
        warehouse_hash: "SHA-256 of ordered chunk hashes",
      },
      policy_fields_in_base: false,
    };
    const missingPartialReport = {
      manifest_id: manifestId,
      coverage,
      partial_samples: coverage.partial_samples,
    };
    const artifacts = {
      summaryJson: toRepoRelative(path.join(artifactDir, "gate74b-summary.json")),
      schemaReceipt: toRepoRelative(path.join(artifactDir, "schema-receipt.json")),
      missingPartialReport: toRepoRelative(path.join(artifactDir, "missing-partial-report.json")),
      rowCounts: toRepoRelative(path.join(artifactDir, "row-counts.json")),
      chunkHashes: toRepoRelative(path.join(artifactDir, "chunk-hashes.json")),
      reconstructionAudit: toRepoRelative(path.join(artifactDir, "sample-reconstruction-audit.json")),
      noPolicyAudit: toRepoRelative(path.join(artifactDir, "no-policy-fields-audit.json")),
      shaIdentity: toRepoRelative(path.join(artifactDir, "gate74b-sha256.txt")),
      report: toRepoRelative(reportPath),
    };
    const pass =
      gate74aSummary.verdict.startsWith("PASS_") &&
      gate74aSummary.validation.candidate_b_forced28_preserved &&
      !gate74aSummary.validation.base_warehouse_materialization_started &&
      gate71bm.verdict.startsWith("PASS_") &&
      gate71a.verdict.startsWith("PASS_") &&
      candidateShape.forced28_preserved &&
      candidateBLedgerFileHash === gate74aProtocol.upstream_bindings.candidate_b_ledger_file_sha256.toUpperCase() &&
      selectedWeeks.length === expectedWeeks &&
      selectedSymbols.length === GATE71_EXPECTED_SYMBOLS_PER_WEEK &&
      inspection.week_count === expectedWeeks &&
      inspection.pair_week_count === expectedWeeks * GATE71_EXPECTED_SYMBOLS_PER_WEEK &&
      inspection.duplicate_pair_week_count === 0 &&
      inspection.missing_week_count === 0 &&
      coverage.missing_pair_weeks === 0 &&
      reconstructionAudit.mismatch_count_gt_0001 === 0 &&
      sampleReconstruction.every((row) => row.path_hash_matches_payload && row.point_count_matches_payload) &&
      noPolicyAudit.forbidden_field_violations.length === 0;
    const summary = {
      gate_id: GATE_ID,
      command: COMMAND,
      generated_at: new Date().toISOString(),
      git_commit: gitCommit(),
      verdict: pass
        ? "PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY"
        : "FAIL_GATE74B_TRADE_LEG_PATH_MATERIALIZATION",
      warehouse: {
        manifest_id: manifestId,
        config_hash: configHash,
        warehouse_hash: manifest.warehouse_hash,
        contract_id: manifest.contract_id,
        warehouse_version: manifest.warehouse_version,
        path_payload_codec: manifest.path_payload_codec,
        price_bundle_id: manifest.price_bundle_id,
        path_resolution: manifest.path_resolution,
        candidate_id: manifest.candidate_id,
        locked_algorithm_id: manifest.locked_algorithm_id,
        candidate_b_final_ledger_hash: manifest.candidate_b_final_ledger_hash,
        candidate_b_ledger_file_sha256: manifest.candidate_b_ledger_file_sha256,
        entry_exposure_model_id: manifest.entry_exposure_model_id,
        adr_target_pct: manifest.adr_target_pct,
        week_count: manifest.week_count,
        pair_week_count: manifest.pair_week_count,
        path_point_count: manifest.path_point_count,
        chunk_count: manifest.chunk_count,
        materialization_runtime_seconds: runtimeSeconds,
      },
      coverage,
      reconstruction_audit: {
        ...reconstructionAudit,
        sample_reconstruction: sampleReconstruction,
      },
      no_policy_field_audit: noPolicyAudit,
      validation: {
        gate74a_passed: gate74aSummary.verdict.startsWith("PASS_"),
        gate71a_passed: gate71a.verdict.startsWith("PASS_"),
        gate71bm_passed: gate71bm.verdict.startsWith("PASS_"),
        candidate_b_forced28_preserved: candidateShape.forced28_preserved,
        candidate_b_file_hash_matches_gate74a: candidateBLedgerFileHash === gate74aProtocol.upstream_bindings.candidate_b_ledger_file_sha256.toUpperCase(),
        selected_weeks: selectedWeeks.length,
        expected_weeks: expectedWeeks,
        selected_symbols: selectedSymbols.length,
        expected_symbols_per_week: GATE71_EXPECTED_SYMBOLS_PER_WEEK,
        missing_price_pair_weeks: coverage.missing_pair_weeks,
        partial_price_pair_weeks: coverage.partial_pair_weeks,
        default_adr_pair_weeks: coverage.default_adr_pair_weeks,
        reconstruction_mismatch_count_gt_0001: reconstructionAudit.mismatch_count_gt_0001,
        no_policy_field_violations: noPolicyAudit.forbidden_field_violations.length,
        replay_adapters_started: false,
        fixed_adr_target_tests_started: false,
        close_winners_hold_losers_started: false,
        carry_until_flip_performance_started: false,
        risk_layer_started: false,
        mt5_live_runtime_started: false,
        brain_truth_mutated: false,
        source_mutation_started: false,
        exit_promotion_started: false,
      },
      artifacts,
    };
    await writeJson(path.join(artifactDir, "schema-receipt.json"), schemaReceipt);
    await writeJson(path.join(artifactDir, "missing-partial-report.json"), missingPartialReport);
    await writeJson(path.join(artifactDir, "row-counts.json"), rowCounts);
    await writeJson(path.join(artifactDir, "chunk-hashes.json"), chunkHashes);
    await writeJson(path.join(artifactDir, "sample-reconstruction-audit.json"), summary.reconstruction_audit);
    await writeJson(path.join(artifactDir, "no-policy-fields-audit.json"), noPolicyAudit);
    await writeJson(path.join(artifactDir, "gate74b-summary.json"), summary);
    await writeText(reportPath, renderReport(summary));
    await writeShaManifest(path.join(artifactDir, "gate74b-sha256.txt"), GATE_ID, COMMAND, [
      { label: "summary_json", path: path.join(artifactDir, "gate74b-summary.json") },
      { label: "schema_receipt", path: path.join(artifactDir, "schema-receipt.json") },
      { label: "missing_partial_report", path: path.join(artifactDir, "missing-partial-report.json") },
      { label: "row_counts", path: path.join(artifactDir, "row-counts.json") },
      { label: "chunk_hashes", path: path.join(artifactDir, "chunk-hashes.json") },
      { label: "sample_reconstruction_audit", path: path.join(artifactDir, "sample-reconstruction-audit.json") },
      { label: "no_policy_fields_audit", path: path.join(artifactDir, "no-policy-fields-audit.json") },
      { label: "report", path: reportPath },
    ]);
    if (!pass) throw new Error(summary.verdict);
    console.log(summary.verdict);
    console.log(JSON.stringify({ warehouse: summary.warehouse, validation: summary.validation, artifacts }, null, 2));
  } catch (error) {
    await markTradeLegPathWarehouseFailed(manifestId, error);
    throw error;
  }
}

async function insertWeek(
  manifestId: string,
  chunkIndex: number,
  weekOpenUtc: string,
  rows: TradeLegPathPairWeek[],
) {
  const { insertTradeLegPathWarehouseWeek } = await import("@engine/research/tradeLegPathWarehouse");
  await insertTradeLegPathWarehouseWeek({
    manifestId,
    chunkIndex,
    weekOpenUtc,
    rows,
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized();
    if (process.exitCode && process.exitCode !== 0) process.exit(process.exitCode);
  });
