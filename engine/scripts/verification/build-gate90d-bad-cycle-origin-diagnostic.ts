import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { sha256Stable } from "@engine/research/hash";
import { DateTime } from "luxon";

import { gitCommit, parseArgMap, renderTable, round, toRepoRelative, writeJson, writeShaManifest, writeText } from "./gate65-utils";

const GATE_ID = "Gate 90D: bad-cycle-origin-and-trailing-research";
const GATE_DATE = "2026-07-03";
const COMMAND = "npm run engine:gate90d:bad-cycle-origin-diagnostic";
const INITIAL_DEPOSIT_USD = 10_000;
const DEFAULT_CLOSE_EVENTS_CSV =
  "docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/close-events.rows.csv";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate90/artifacts/gate90d-2019-open-bad-cycle-origin-diagnostic";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate90/GATE90D_2019_OPEN_BAD_CYCLE_ORIGIN_AND_TRAILING_RESEARCH_${GATE_DATE}.md`;

type OriginClass =
  | "target_captured"
  | "trail_captured"
  | "green_to_red_giveback"
  | "green_profit_leak"
  | "ugly_no_profit"
  | "adverse_no_profit"
  | "small_red_no_profit"
  | "eod_green_leftover"
  | "other";

type LiveStateClass =
  | "profit_1q_before_pain_1q"
  | "pain_2q_before_profit_0_5q"
  | "pain_1q_before_profit_0_5q"
  | "pain_1q_before_profit_1q"
  | "profit_0_5q_only"
  | "inside_1q"
  | "timestamp_unavailable"
  | "other";

type CloseEventRow = {
  variant_id: string;
  activation_rule_id: string;
  protection_mode: string;
  cycle_id: string;
  pair: string;
  side: string;
  close_reason: string;
  start_timestamp_utc: string;
  close_timestamp_utc: string;
  anchor_week_open_utc: string;
  fill_count: number;
  adverse_fill_count: number;
  expansion_fill_count: number;
  price_pnl_adr: number;
  price_pnl_usd: number;
  commission_usd: number;
  swap_usd: number;
  net_usd: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  min_pnl_timestamp_utc: string | null;
  max_pnl_timestamp_utc: string | null;
  first_mfe_0_5q_timestamp_utc: string | null;
  first_mfe_1q_timestamp_utc: string | null;
  first_mfe_2q_timestamp_utc: string | null;
  first_mfe_3q_timestamp_utc: string | null;
  first_mae_0_5q_timestamp_utc: string | null;
  first_mae_1q_timestamp_utc: string | null;
  first_mae_2q_timestamp_utc: string | null;
  first_mae_3q_timestamp_utc: string | null;
  reset_ordinal_at_start: number;
  completed_reset_ordinal: number | null;
  max_fill_age_days: number;
  cycle_spacing_adr: number;
  triangle_trigger_key: string | null;
};

type ClassifiedEvent = CloseEventRow & {
  origin_class: OriginClass;
  live_state_class: LiveStateClass;
  start_date_et: string;
  mfe_adr: number;
  mae_adr_abs: number;
  mfe_q: number | null;
  mae_q: number | null;
  giveback_adr: number;
  capture_ratio: number | null;
  trail_1q_1q_theoretical_improvement_adr: number;
  trail_1q_0_5q_theoretical_improvement_adr: number;
  trail_addressable_loss: boolean;
  trail_no_activation_loss: boolean;
};

type Accumulator = {
  key: string;
  activation_rule_id: string;
  protection_mode: string;
  origin_class: string;
  live_state_class: string;
  pair: string;
  side: string;
  close_reason: string;
  start_date_et: string;
  count: number;
  win_count: number;
  loss_count: number;
  flat_count: number;
  fill_count: number;
  total_realized_pnl_adr: number;
  net_usd: number;
  gross_profit_usd: number;
  gross_loss_abs_usd: number;
  mfe_adr_sum: number;
  mae_adr_abs_sum: number;
  giveback_adr_sum: number;
  capture_ratio_sum: number;
  capture_ratio_count: number;
  mfe_1q_hit_count: number;
  mae_1q_hit_count: number;
  trail_addressable_loss_count: number;
  trail_no_activation_loss_count: number;
  trail_1q_1q_theoretical_improvement_adr: number;
  trail_1q_0_5q_theoretical_improvement_adr: number;
};

type SummaryRow = {
  group_type: "variant" | "origin_class" | "live_state" | "pair_side_origin" | "close_reason" | "start_date_origin";
  activation_rule_id: string;
  protection_mode: string;
  origin_class: string;
  live_state_class: string;
  pair: string;
  side: string;
  close_reason: string;
  start_date_et: string;
  close_event_count: number;
  win_count: number;
  loss_count: number;
  win_pct: number | null;
  fill_count: number;
  adr_normalized_return_pct: number;
  account_return_pct: number;
  gross_profit_usd: number;
  gross_loss_abs_usd: number;
  profit_factor: number | null;
  avg_realized_pnl_adr: number | null;
  avg_mfe_adr: number | null;
  avg_mae_adr_abs: number | null;
  avg_giveback_adr: number | null;
  aggregate_capture_ratio: number | null;
  avg_capture_ratio: number | null;
  mfe_1q_hit_pct: number | null;
  mae_1q_hit_pct: number | null;
  trail_addressable_loss_count: number;
  trail_no_activation_loss_count: number;
  trail_addressable_loss_pct_of_losses: number | null;
  trail_1q_1q_theoretical_improvement_adr: number;
  trail_1q_0_5q_theoretical_improvement_adr: number;
  content_hash: string;
};

type Options = {
  closeEventsCsv: string;
  artifactDir: string;
  reportPath: string;
  activationRules: Set<string> | null;
  protectionModes: Set<string> | null;
};

function parseOptions(): Options {
  const args = parseArgMap();
  const activationRules = parseSet(args.get("--activation-rules"));
  const protectionModes = parseSet(args.get("--protection-modes") ?? args.get("--protection-mode"));
  return {
    closeEventsCsv: args.get("--close-events-csv") ?? DEFAULT_CLOSE_EVENTS_CSV,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    activationRules,
    protectionModes,
  };
}

function parseSet(value: string | undefined) {
  if (!value) return null;
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? new Set(values) : null;
}

function parseNumber(value: string | undefined) {
  if (value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumber(value: string | undefined) {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvRow(header: string[], line: string): CloseEventRow {
  const values = line.split(",");
  const get = (name: string) => values[header.indexOf(name)];
  return {
    variant_id: get("variant_id") ?? "",
    activation_rule_id: get("activation_rule_id") ?? "",
    protection_mode: get("protection_mode") ?? "",
    cycle_id: get("cycle_id") ?? "",
    pair: get("pair") ?? "",
    side: get("side") ?? "",
    close_reason: get("close_reason") ?? "",
    start_timestamp_utc: get("start_timestamp_utc") ?? "",
    close_timestamp_utc: get("close_timestamp_utc") ?? "",
    anchor_week_open_utc: get("anchor_week_open_utc") ?? "",
    fill_count: parseNumber(get("fill_count")),
    adverse_fill_count: parseNumber(get("adverse_fill_count")),
    expansion_fill_count: parseNumber(get("expansion_fill_count")),
    price_pnl_adr: parseNumber(get("price_pnl_adr")),
    price_pnl_usd: parseNumber(get("price_pnl_usd")),
    commission_usd: parseNumber(get("commission_usd")),
    swap_usd: parseNumber(get("swap_usd")),
    net_usd: parseNumber(get("net_usd")),
    min_pnl_adr: parseNumber(get("min_pnl_adr")),
    max_pnl_adr: parseNumber(get("max_pnl_adr")),
    min_pnl_timestamp_utc: get("min_pnl_timestamp_utc") || null,
    max_pnl_timestamp_utc: get("max_pnl_timestamp_utc") || null,
    first_mfe_0_5q_timestamp_utc: get("first_mfe_0_5q_timestamp_utc") || null,
    first_mfe_1q_timestamp_utc: get("first_mfe_1q_timestamp_utc") || null,
    first_mfe_2q_timestamp_utc: get("first_mfe_2q_timestamp_utc") || null,
    first_mfe_3q_timestamp_utc: get("first_mfe_3q_timestamp_utc") || null,
    first_mae_0_5q_timestamp_utc: get("first_mae_0_5q_timestamp_utc") || null,
    first_mae_1q_timestamp_utc: get("first_mae_1q_timestamp_utc") || null,
    first_mae_2q_timestamp_utc: get("first_mae_2q_timestamp_utc") || null,
    first_mae_3q_timestamp_utc: get("first_mae_3q_timestamp_utc") || null,
    reset_ordinal_at_start: parseNumber(get("reset_ordinal_at_start")),
    completed_reset_ordinal: parseNullableNumber(get("completed_reset_ordinal")),
    max_fill_age_days: parseNumber(get("max_fill_age_days")),
    cycle_spacing_adr: parseNumber(get("cycle_spacing_adr")),
    triangle_trigger_key: get("triangle_trigger_key") || null,
  };
}

function timestampBeforeOrSame(left: string | null, right: string | null) {
  return left !== null && (right === null || left <= right);
}

function liveStateClass(event: CloseEventRow): LiveStateClass {
  const hasTimestampFields =
    event.first_mfe_0_5q_timestamp_utc !== null
    || event.first_mfe_1q_timestamp_utc !== null
    || event.first_mae_1q_timestamp_utc !== null
    || event.first_mae_2q_timestamp_utc !== null
    || event.max_pnl_timestamp_utc !== null
    || event.min_pnl_timestamp_utc !== null;
  if (!hasTimestampFields) return "timestamp_unavailable";
  if (timestampBeforeOrSame(event.first_mfe_1q_timestamp_utc, event.first_mae_1q_timestamp_utc)) return "profit_1q_before_pain_1q";
  if (timestampBeforeOrSame(event.first_mae_2q_timestamp_utc, event.first_mfe_0_5q_timestamp_utc)) return "pain_2q_before_profit_0_5q";
  if (timestampBeforeOrSame(event.first_mae_1q_timestamp_utc, event.first_mfe_0_5q_timestamp_utc)) return "pain_1q_before_profit_0_5q";
  if (timestampBeforeOrSame(event.first_mae_1q_timestamp_utc, event.first_mfe_1q_timestamp_utc)) return "pain_1q_before_profit_1q";
  if (event.first_mfe_0_5q_timestamp_utc !== null && event.first_mfe_1q_timestamp_utc === null && event.first_mae_1q_timestamp_utc === null) {
    return "profit_0_5q_only";
  }
  if (event.first_mfe_1q_timestamp_utc === null && event.first_mae_1q_timestamp_utc === null) return "inside_1q";
  return "other";
}

function classify(event: CloseEventRow): ClassifiedEvent {
  const mfeAdr = Math.max(0, event.max_pnl_adr);
  const maeAdrAbs = Math.max(0, -event.min_pnl_adr);
  const q = event.cycle_spacing_adr > 0 ? event.cycle_spacing_adr : null;
  const mfeQ = q ? mfeAdr / q : null;
  const maeQ = q ? maeAdrAbs / q : null;
  const captureRatio = mfeAdr > 0 ? event.price_pnl_adr / mfeAdr : null;
  const givebackAdr = Math.max(0, mfeAdr - event.price_pnl_adr);
  const trailActivated = q !== null && mfeAdr >= q;
  const trail1Q1QFloor = trailActivated && q !== null ? mfeAdr - q : event.price_pnl_adr;
  const trail1Q05QFloor = trailActivated && q !== null ? mfeAdr - q * 0.5 : event.price_pnl_adr;
  const trail1Q1QImprovement = Math.max(0, trail1Q1QFloor - event.price_pnl_adr);
  const trail1Q05QImprovement = Math.max(0, trail1Q05QFloor - event.price_pnl_adr);
  const isLoss = event.net_usd < 0;
  const trailAddressableLoss = isLoss && event.close_reason !== "target" && trailActivated;
  const trailNoActivationLoss = isLoss && event.close_reason !== "target" && !trailActivated;
  const startDateEt = DateTime.fromISO(event.start_timestamp_utc, { zone: "utc" }).setZone("America/New_York").toISODate() ?? "";
  let originClass: OriginClass = "other";

  if (event.close_reason === "target") {
    originClass = "target_captured";
  } else if (event.close_reason === "protection_trail" && event.net_usd > 0) {
    originClass = "trail_captured";
  } else if (event.price_pnl_adr < 0 && trailActivated) {
    originClass = "green_to_red_giveback";
  } else if (event.price_pnl_adr >= 0 && trailActivated && captureRatio !== null && captureRatio < 0.5) {
    originClass = "green_profit_leak";
  } else if (event.price_pnl_adr < 0 && !trailActivated && maeQ !== null && maeQ >= 2) {
    originClass = "ugly_no_profit";
  } else if (event.price_pnl_adr < 0 && !trailActivated && maeQ !== null && maeQ >= 1) {
    originClass = "adverse_no_profit";
  } else if (event.price_pnl_adr < 0) {
    originClass = "small_red_no_profit";
  } else if (event.close_reason === "session_flatten" && event.price_pnl_adr >= 0) {
    originClass = "eod_green_leftover";
  }

  return {
    ...event,
    origin_class: originClass,
    live_state_class: liveStateClass(event),
    start_date_et: startDateEt,
    mfe_adr: round(mfeAdr) ?? 0,
    mae_adr_abs: round(maeAdrAbs) ?? 0,
    mfe_q: round(mfeQ),
    mae_q: round(maeQ),
    giveback_adr: round(givebackAdr) ?? 0,
    capture_ratio: round(captureRatio),
    trail_1q_1q_theoretical_improvement_adr: round(trail1Q1QImprovement) ?? 0,
    trail_1q_0_5q_theoretical_improvement_adr: round(trail1Q05QImprovement) ?? 0,
    trail_addressable_loss: trailAddressableLoss,
    trail_no_activation_loss: trailNoActivationLoss,
  };
}

function createAccumulator(key: string, event: ClassifiedEvent, group: Partial<Accumulator>): Accumulator {
  return {
    key,
    activation_rule_id: group.activation_rule_id ?? event.activation_rule_id,
    protection_mode: group.protection_mode ?? event.protection_mode,
    origin_class: group.origin_class ?? "",
    live_state_class: group.live_state_class ?? "",
    pair: group.pair ?? "",
    side: group.side ?? "",
    close_reason: group.close_reason ?? "",
    start_date_et: group.start_date_et ?? "",
    count: 0,
    win_count: 0,
    loss_count: 0,
    flat_count: 0,
    fill_count: 0,
    total_realized_pnl_adr: 0,
    net_usd: 0,
    gross_profit_usd: 0,
    gross_loss_abs_usd: 0,
    mfe_adr_sum: 0,
    mae_adr_abs_sum: 0,
    giveback_adr_sum: 0,
    capture_ratio_sum: 0,
    capture_ratio_count: 0,
    mfe_1q_hit_count: 0,
    mae_1q_hit_count: 0,
    trail_addressable_loss_count: 0,
    trail_no_activation_loss_count: 0,
    trail_1q_1q_theoretical_improvement_adr: 0,
    trail_1q_0_5q_theoretical_improvement_adr: 0,
  };
}

function addToAccumulator(acc: Accumulator, event: ClassifiedEvent) {
  acc.count += 1;
  acc.fill_count += event.fill_count;
  acc.total_realized_pnl_adr += event.price_pnl_adr;
  acc.net_usd += event.net_usd;
  acc.mfe_adr_sum += event.mfe_adr;
  acc.mae_adr_abs_sum += event.mae_adr_abs;
  acc.giveback_adr_sum += event.giveback_adr;
  acc.trail_1q_1q_theoretical_improvement_adr += event.trail_1q_1q_theoretical_improvement_adr;
  acc.trail_1q_0_5q_theoretical_improvement_adr += event.trail_1q_0_5q_theoretical_improvement_adr;
  if (event.capture_ratio !== null) {
    acc.capture_ratio_sum += event.capture_ratio;
    acc.capture_ratio_count += 1;
  }
  if (event.cycle_spacing_adr > 0) {
    if (event.mfe_adr >= event.cycle_spacing_adr) acc.mfe_1q_hit_count += 1;
    if (event.mae_adr_abs >= event.cycle_spacing_adr) acc.mae_1q_hit_count += 1;
  }
  if (event.trail_addressable_loss) acc.trail_addressable_loss_count += 1;
  if (event.trail_no_activation_loss) acc.trail_no_activation_loss_count += 1;
  if (event.net_usd > 0) {
    acc.win_count += 1;
    acc.gross_profit_usd += event.net_usd;
  } else if (event.net_usd < 0) {
    acc.loss_count += 1;
    acc.gross_loss_abs_usd += Math.abs(event.net_usd);
  } else {
    acc.flat_count += 1;
  }
}

function rowFromAccumulator(groupType: SummaryRow["group_type"], acc: Accumulator): SummaryRow {
  const base = {
    group_type: groupType,
    activation_rule_id: acc.activation_rule_id,
    protection_mode: acc.protection_mode,
    origin_class: acc.origin_class,
    live_state_class: acc.live_state_class,
    pair: acc.pair,
    side: acc.side,
    close_reason: acc.close_reason,
    start_date_et: acc.start_date_et,
    close_event_count: acc.count,
    win_count: acc.win_count,
    loss_count: acc.loss_count,
    win_pct: pct(acc.win_count, acc.count),
    fill_count: acc.fill_count,
    adr_normalized_return_pct: round(acc.total_realized_pnl_adr) ?? 0,
    account_return_pct: round((acc.net_usd / INITIAL_DEPOSIT_USD) * 100) ?? 0,
    gross_profit_usd: round(acc.gross_profit_usd, 2) ?? 0,
    gross_loss_abs_usd: round(acc.gross_loss_abs_usd, 2) ?? 0,
    profit_factor: acc.gross_loss_abs_usd > 0 ? round(acc.gross_profit_usd / acc.gross_loss_abs_usd) : null,
    avg_realized_pnl_adr: acc.count ? round(acc.total_realized_pnl_adr / acc.count) : null,
    avg_mfe_adr: acc.count ? round(acc.mfe_adr_sum / acc.count) : null,
    avg_mae_adr_abs: acc.count ? round(acc.mae_adr_abs_sum / acc.count) : null,
    avg_giveback_adr: acc.count ? round(acc.giveback_adr_sum / acc.count) : null,
    aggregate_capture_ratio: acc.mfe_adr_sum > 0 ? round(acc.total_realized_pnl_adr / acc.mfe_adr_sum) : null,
    avg_capture_ratio: acc.capture_ratio_count ? round(acc.capture_ratio_sum / acc.capture_ratio_count) : null,
    mfe_1q_hit_pct: pct(acc.mfe_1q_hit_count, acc.count),
    mae_1q_hit_pct: pct(acc.mae_1q_hit_count, acc.count),
    trail_addressable_loss_count: acc.trail_addressable_loss_count,
    trail_no_activation_loss_count: acc.trail_no_activation_loss_count,
    trail_addressable_loss_pct_of_losses: pct(acc.trail_addressable_loss_count, acc.loss_count),
    trail_1q_1q_theoretical_improvement_adr: round(acc.trail_1q_1q_theoretical_improvement_adr) ?? 0,
    trail_1q_0_5q_theoretical_improvement_adr: round(acc.trail_1q_0_5q_theoretical_improvement_adr) ?? 0,
  };
  return { ...base, content_hash: sha256Stable(base) };
}

function pct(numerator: number, denominator: number) {
  return denominator ? round((numerator / denominator) * 100) : null;
}

function addGroup(map: Map<string, Accumulator>, key: string, event: ClassifiedEvent, group: Partial<Accumulator>) {
  let acc = map.get(key);
  if (!acc) {
    acc = createAccumulator(key, event, group);
    map.set(key, acc);
  }
  addToAccumulator(acc, event);
}

async function classifyCloseEvents(options: Options) {
  const variantAccumulators = new Map<string, Accumulator>();
  const originAccumulators = new Map<string, Accumulator>();
  const liveStateAccumulators = new Map<string, Accumulator>();
  const pairSideOriginAccumulators = new Map<string, Accumulator>();
  const closeReasonAccumulators = new Map<string, Accumulator>();
  const startDateOriginAccumulators = new Map<string, Accumulator>();
  let header: string[] | null = null;
  let scannedRows = 0;
  let includedRows = 0;

  const stream = readline.createInterface({
    input: createReadStream(options.closeEventsCsv),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of stream) {
    if (!header) {
      header = line.split(",");
      continue;
    }
    if (!line.trim()) continue;
    scannedRows += 1;
    const event = parseCsvRow(header, line);
    if (options.activationRules && !options.activationRules.has(event.activation_rule_id)) continue;
    if (options.protectionModes && !options.protectionModes.has(event.protection_mode)) continue;
    includedRows += 1;
    const classified = classify(event);
    const variantKey = [classified.activation_rule_id, classified.protection_mode].join("|");
    const originKey = [variantKey, classified.origin_class].join("|");
    const liveStateKey = [variantKey, classified.live_state_class].join("|");
    const pairSideOriginKey = [variantKey, classified.pair, classified.side, classified.origin_class].join("|");
    const closeReasonKey = [variantKey, classified.close_reason].join("|");
    const startDateOriginKey = [variantKey, classified.start_date_et, classified.origin_class].join("|");

    addGroup(variantAccumulators, variantKey, classified, {
      activation_rule_id: classified.activation_rule_id,
      protection_mode: classified.protection_mode,
    });
    addGroup(originAccumulators, originKey, classified, {
      activation_rule_id: classified.activation_rule_id,
      protection_mode: classified.protection_mode,
      origin_class: classified.origin_class,
    });
    addGroup(liveStateAccumulators, liveStateKey, classified, {
      activation_rule_id: classified.activation_rule_id,
      protection_mode: classified.protection_mode,
      live_state_class: classified.live_state_class,
    });
    addGroup(pairSideOriginAccumulators, pairSideOriginKey, classified, {
      activation_rule_id: classified.activation_rule_id,
      protection_mode: classified.protection_mode,
      pair: classified.pair,
      side: classified.side,
      origin_class: classified.origin_class,
    });
    addGroup(closeReasonAccumulators, closeReasonKey, classified, {
      activation_rule_id: classified.activation_rule_id,
      protection_mode: classified.protection_mode,
      close_reason: classified.close_reason,
    });
    addGroup(startDateOriginAccumulators, startDateOriginKey, classified, {
      activation_rule_id: classified.activation_rule_id,
      protection_mode: classified.protection_mode,
      start_date_et: classified.start_date_et,
      origin_class: classified.origin_class,
    });
  }

  const variantRows = [...variantAccumulators.values()]
    .map((acc) => rowFromAccumulator("variant", acc))
    .sort((a, b) => a.activation_rule_id.localeCompare(b.activation_rule_id) || a.protection_mode.localeCompare(b.protection_mode));
  const originRows = [...originAccumulators.values()]
    .map((acc) => rowFromAccumulator("origin_class", acc))
    .sort(
      (a, b) =>
        a.activation_rule_id.localeCompare(b.activation_rule_id)
        || a.protection_mode.localeCompare(b.protection_mode)
        || b.close_event_count - a.close_event_count,
    );
  const liveStateRows = [...liveStateAccumulators.values()]
    .map((acc) => rowFromAccumulator("live_state", acc))
    .sort(
      (a, b) =>
        a.activation_rule_id.localeCompare(b.activation_rule_id)
        || a.protection_mode.localeCompare(b.protection_mode)
        || b.close_event_count - a.close_event_count,
    );
  const pairSideOriginRows = [...pairSideOriginAccumulators.values()]
    .map((acc) => rowFromAccumulator("pair_side_origin", acc))
    .sort((a, b) => a.account_return_pct - b.account_return_pct);
  const closeReasonRows = [...closeReasonAccumulators.values()]
    .map((acc) => rowFromAccumulator("close_reason", acc))
    .sort(
      (a, b) =>
        a.activation_rule_id.localeCompare(b.activation_rule_id)
        || a.protection_mode.localeCompare(b.protection_mode)
      || a.close_reason.localeCompare(b.close_reason),
    );
  const startDateOriginRows = [...startDateOriginAccumulators.values()]
    .map((acc) => rowFromAccumulator("start_date_origin", acc))
    .sort((a, b) => a.account_return_pct - b.account_return_pct);

  return {
    scannedRows,
    includedRows,
    variantRows,
    originRows,
    liveStateRows,
    pairSideOriginRows,
    closeReasonRows,
    startDateOriginRows,
  };
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function writeCsv(filePath: string, rows: Array<Record<string, unknown>>) {
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  await writeText(filePath, `${lines.join("\n")}\n`);
}

function selectedVariantRows(rows: SummaryRow[]) {
  const wanted = new Set([
    "triangle_v0_no_candidate_b|baseline",
    "triangle_v0_no_candidate_b|protected_flatten_1q",
    "triangle_v0_no_candidate_b|trail_1q_0_5q",
    "david_contra|baseline",
    "david_contra|lock_1q_stop_adds",
    "triangle_v1_david_contra_extension|baseline",
  ]);
  return rows.filter((row) => wanted.has([row.activation_rule_id, row.protection_mode].join("|")));
}

function selectedOriginRows(rows: SummaryRow[], activationRuleId: string, protectionMode: string) {
  return rows
    .filter((row) => row.activation_rule_id === activationRuleId && row.protection_mode === protectionMode)
    .sort((a, b) => b.close_event_count - a.close_event_count);
}

function selectedLiveStateRows(rows: SummaryRow[], activationRuleId: string, protectionMode: string) {
  return rows
    .filter((row) => row.activation_rule_id === activationRuleId && row.protection_mode === protectionMode)
    .sort((a, b) => b.close_event_count - a.close_event_count);
}

function worstPairSideRows(rows: SummaryRow[], activationRuleId: string, protectionMode: string, limit = 12) {
  return rows
    .filter((row) => row.activation_rule_id === activationRuleId && row.protection_mode === protectionMode && row.account_return_pct < 0)
    .slice(0, limit);
}

function worstStartDateRows(rows: SummaryRow[], activationRuleId: string, protectionMode: string, limit = 12) {
  return rows
    .filter(
      (row) =>
        row.activation_rule_id === activationRuleId
        && row.protection_mode === protectionMode
        && row.account_return_pct < 0
        && ["ugly_no_profit", "green_to_red_giveback"].includes(row.origin_class),
    )
    .slice(0, limit);
}

function conciseRow(row: SummaryRow) {
  return {
    rule: row.activation_rule_id,
    protection: row.protection_mode,
    cycles: row.close_event_count,
    "ADR %": row.adr_normalized_return_pct,
    "Acct %": row.account_return_pct,
    PF: row.profit_factor,
    "Win %": row.win_pct,
    "Avg ADR": row.avg_realized_pnl_adr,
    "Avg MFE": row.avg_mfe_adr,
    "Avg MAE": row.avg_mae_adr_abs,
    "Capture": row.aggregate_capture_ratio,
    "MFE 1Q %": row.mfe_1q_hit_pct,
    "Trail-able losses": row.trail_addressable_loss_count,
    "No-trail losses": row.trail_no_activation_loss_count,
  };
}

function originTableRow(row: SummaryRow) {
  return {
    origin: row.origin_class,
    cycles: row.close_event_count,
    losses: row.loss_count,
    "ADR %": row.adr_normalized_return_pct,
    "Acct %": row.account_return_pct,
    PF: row.profit_factor,
    "Avg ADR": row.avg_realized_pnl_adr,
    "Avg MFE": row.avg_mfe_adr,
    "Avg MAE": row.avg_mae_adr_abs,
    "Giveback": row.avg_giveback_adr,
    "MFE 1Q %": row.mfe_1q_hit_pct,
    "Trail-able": row.trail_addressable_loss_count,
    "No-trail": row.trail_no_activation_loss_count,
    "Trail 1Q ADR": row.trail_1q_1q_theoretical_improvement_adr,
  };
}

function liveStateTableRow(row: SummaryRow) {
  return {
    state: row.live_state_class,
    cycles: row.close_event_count,
    losses: row.loss_count,
    "ADR %": row.adr_normalized_return_pct,
    "Acct %": row.account_return_pct,
    PF: row.profit_factor,
    "Avg ADR": row.avg_realized_pnl_adr,
    "Avg MFE": row.avg_mfe_adr,
    "Avg MAE": row.avg_mae_adr_abs,
    "Giveback": row.avg_giveback_adr,
    "MFE 1Q %": row.mfe_1q_hit_pct,
    "Trail-able": row.trail_addressable_loss_count,
    "No-trail": row.trail_no_activation_loss_count,
  };
}

function pairTableRow(row: SummaryRow) {
  return {
    pair: row.pair,
    side: row.side,
    origin: row.origin_class,
    cycles: row.close_event_count,
    "ADR %": row.adr_normalized_return_pct,
    "Acct %": row.account_return_pct,
    "Avg MFE": row.avg_mfe_adr,
    "Avg MAE": row.avg_mae_adr_abs,
    "Trail-able": row.trail_addressable_loss_count,
    "No-trail": row.trail_no_activation_loss_count,
  };
}

function startDateTableRow(row: SummaryRow) {
  return {
    "start ET": row.start_date_et,
    origin: row.origin_class,
    cycles: row.close_event_count,
    losses: row.loss_count,
    "ADR %": row.adr_normalized_return_pct,
    "Acct %": row.account_return_pct,
    "Avg MFE": row.avg_mfe_adr,
    "Avg MAE": row.avg_mae_adr_abs,
    "Trail-able": row.trail_addressable_loss_count,
    "No-trail": row.trail_no_activation_loss_count,
  };
}

function renderReport(input: {
  options: Options;
  scannedRows: number;
  includedRows: number;
  variantRows: SummaryRow[];
  originRows: SummaryRow[];
  liveStateRows: SummaryRow[];
  pairSideOriginRows: SummaryRow[];
  closeReasonRows: SummaryRow[];
  startDateOriginRows: SummaryRow[];
  artifactPaths: Record<string, string>;
}) {
  const strictOriginRows = selectedOriginRows(input.originRows, "triangle_v0_no_candidate_b", "baseline");
  const strictLiveStateRows = selectedLiveStateRows(input.liveStateRows, "triangle_v0_no_candidate_b", "baseline");
  const strictProtectedOriginRows = selectedOriginRows(input.originRows, "triangle_v0_no_candidate_b", "protected_flatten_1q");
  const strictWorstRows = worstPairSideRows(input.pairSideOriginRows, "triangle_v0_no_candidate_b", "baseline");
  const strictWorstStartDateRows = worstStartDateRows(input.startDateOriginRows, "triangle_v0_no_candidate_b", "baseline");
  const davidOriginRows = selectedOriginRows(input.originRows, "david_contra", "baseline");
  const variantRows = selectedVariantRows(input.variantRows);
  const strictGreenGiveback = strictOriginRows.find((row) => row.origin_class === "green_to_red_giveback");
  const strictNoProfit =
    strictOriginRows.find((row) => row.origin_class === "ugly_no_profit")
    ?? strictOriginRows.find((row) => row.origin_class === "adverse_no_profit");
  const strictProfitFirst = strictLiveStateRows.find((row) => row.live_state_class === "profit_1q_before_pain_1q");
  const strictPainFirst =
    strictLiveStateRows.find((row) => row.live_state_class === "pain_2q_before_profit_0_5q")
    ?? strictLiveStateRows.find((row) => row.live_state_class === "pain_1q_before_profit_0_5q")
    ?? strictLiveStateRows.find((row) => row.live_state_class === "pain_1q_before_profit_1q");

  return `# Gate 90D 2019 Open Bad-Cycle Origin And Trailing Research

Generated: ${GATE_DATE}

## Verdict

\`PASS_GATE90D_BAD_CYCLE_ORIGIN_VISIBLE_TRAILING_IS_SEGMENT_TOOL_NO_PROMOTION\`

This pass did not run a new replay. It reads the existing 2019 open-price
no-Candidate-B close-event ledger and classifies each closed side-cycle by
excursion behavior.

The useful institutional framing is **MFE/MAE excursion capture**:

- MFE: Maximum Favorable Excursion, the best profit the cycle offered.
- MAE: Maximum Adverse Excursion, the worst pain the cycle took.
- Capture ratio: realized ADR divided by MFE ADR.
- Giveback: MFE ADR minus realized ADR.

Plain read: a trailing stop can only help the trades that first had enough MFE
to activate. If a losing cycle never reaches \`1Q\` MFE, the fix is start
quality, pair/side avoidance, heat control, or ugly-cycle protection. It is not
a trailing stop.

## Scope

- Source close events:
  \`${toRepoRelative(input.options.closeEventsCsv)}\`
- Rows scanned: \`${input.scannedRows}\`
- Rows included: \`${input.includedRows}\`
- Return convention: ADR-normalized percent, where \`1 ADR = 1%\`.
- Account percent remains costed USD/equity truth against \`${INITIAL_DEPOSIT_USD}\`.

No MT5/live/app work, promotion, red-news implementation, 2020/year-by-year
expansion, full matrix restart, or full seven-pair handshake gate was opened.

## Variant Read

${renderTable(variantRows.map(conciseRow), [
    "rule",
    "protection",
    "cycles",
    "ADR %",
    "Acct %",
    "PF",
    "Win %",
    "Avg ADR",
    "Avg MFE",
    "Avg MAE",
    "Capture",
    "MFE 1Q %",
    "Trail-able losses",
    "No-trail losses",
  ])}

## Strict Katarakti Baseline Origin

${renderTable(strictOriginRows.map(originTableRow), [
    "origin",
    "cycles",
    "losses",
    "ADR %",
    "Acct %",
    "PF",
    "Avg ADR",
    "Avg MFE",
    "Avg MAE",
    "Giveback",
    "MFE 1Q %",
    "Trail-able",
    "No-trail",
    "Trail 1Q ADR",
  ])}

## Strict Live-State Order

${renderTable(strictLiveStateRows.map(liveStateTableRow), [
    "state",
    "cycles",
    "losses",
    "ADR %",
    "Acct %",
    "PF",
    "Avg ADR",
    "Avg MFE",
    "Avg MAE",
    "Giveback",
    "MFE 1Q %",
    "Trail-able",
    "No-trail",
  ])}

## Strict Protected-Flatten Origin

${renderTable(strictProtectedOriginRows.map(originTableRow), [
    "origin",
    "cycles",
    "losses",
    "ADR %",
    "Acct %",
    "PF",
    "Avg ADR",
    "Avg MFE",
    "Avg MAE",
    "Giveback",
    "MFE 1Q %",
    "Trail-able",
    "No-trail",
    "Trail 1Q ADR",
  ])}

## Standalone David Baseline Origin

${renderTable(davidOriginRows.map(originTableRow), [
    "origin",
    "cycles",
    "losses",
    "ADR %",
    "Acct %",
    "PF",
    "Avg ADR",
    "Avg MFE",
    "Avg MAE",
    "Giveback",
    "MFE 1Q %",
    "Trail-able",
    "No-trail",
    "Trail 1Q ADR",
  ])}

## Strict Worst Pair-Side Origins

${renderTable(strictWorstRows.map(pairTableRow), [
    "pair",
    "side",
    "origin",
    "cycles",
    "ADR %",
    "Acct %",
    "Avg MFE",
    "Avg MAE",
    "Trail-able",
    "No-trail",
  ])}

## Strict Worst Start-Date Origins

${renderTable(strictWorstStartDateRows.map(startDateTableRow), [
    "start ET",
    "origin",
    "cycles",
    "losses",
    "ADR %",
    "Acct %",
    "Avg MFE",
    "Avg MAE",
    "Trail-able",
    "No-trail",
  ])}

## Decision Read

The previous protection sweep already showed that global \`1Q\` trailing and
protected flatten reduce or reshuffle return rather than fixing the strict
baseline. This classifier explains why: trailing is only relevant to the
\`green_to_red_giveback\` bucket. It cannot help the no-profit buckets because
those cycles never earned the right to activate the trail.

For strict no-Candidate-B, the next v1 shape should therefore split exits:

1. **Target close:** keep normal MA-reversion close for ordinary captured wins.
2. **Giveback candidate:** only consider trailing/lock rules when MFE reaches
   \`1Q\` or better.
3. **No-profit adverse bucket:** fix entry quality, pair/side eligibility, or
   heat before adding risk.
4. **Ugly no-profit bucket:** this is protection/no-start territory, not a
   profit trail.
5. **Katarakti premium class:** can still earn larger targets, but only when
   excursion evidence says it offers enough MFE.

Plain monkey version:

- A trail can protect food that is already on the table.
- If the trade never put food on the table, the trail has nothing to protect.
- So do not hunt for one magic trailing stop.
- First separate: bad start, good start that gave back, and premium start that
  deserves a bigger target.

## Runner Caveat

This is an artifact-derived diagnostic. Existing close-event rows have MFE/MAE
amounts, and newer ledgers also include first profit/pain quantum timestamps.
The theoretical trail-improvement columns are still **upper-bound evidence**,
not a replayed promise. A final trail rule still needs targeted replay before
freeze.

Key strict references from this run:

- Strict green-to-red bucket:
  \`${strictGreenGiveback ? `${strictGreenGiveback.close_event_count} cycles, ${strictGreenGiveback.adr_normalized_return_pct}% ADR, ${strictGreenGiveback.trail_addressable_loss_count} trail-addressable losses` : "not present"}\`.
- Strict no-profit bucket:
  \`${strictNoProfit ? `${strictNoProfit.origin_class}, ${strictNoProfit.close_event_count} cycles, ${strictNoProfit.adr_normalized_return_pct}% ADR, ${strictNoProfit.trail_no_activation_loss_count} no-trail losses` : "not present"}\`.
- Strict live profit-first bucket:
  \`${strictProfitFirst ? `${strictProfitFirst.close_event_count} cycles, ${strictProfitFirst.adr_normalized_return_pct}% ADR, ${strictProfitFirst.loss_count} losses` : "not present"}\`.
- Strict live pain-first bucket:
  \`${strictPainFirst ? `${strictPainFirst.live_state_class}, ${strictPainFirst.close_event_count} cycles, ${strictPainFirst.adr_normalized_return_pct}% ADR, ${strictPainFirst.loss_count} losses` : "not present"}\`.

## Artifacts

- Variant summary:
  \`${toRepoRelative(input.artifactPaths.variantRowsJson)}\`
- Origin summary:
  \`${toRepoRelative(input.artifactPaths.originRowsJson)}\`
- Live-state summary:
  \`${toRepoRelative(input.artifactPaths.liveStateRowsJson)}\`
- Pair-side origin summary:
  \`${toRepoRelative(input.artifactPaths.pairSideOriginRowsJson)}\`
- Close-reason summary:
  \`${toRepoRelative(input.artifactPaths.closeReasonRowsJson)}\`
- Start-date origin summary:
  \`${toRepoRelative(input.artifactPaths.startDateOriginRowsJson)}\`
- SHA receipt:
  \`${toRepoRelative(input.artifactPaths.sha)}\`

## Stop Line

Research-only. This does not freeze trailing stops, promote Triangle v1, or open
MT5/live/app work.
`;
}

async function main() {
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  const result = await classifyCloseEvents(options);
  const artifactPaths = {
    variantRowsJson: path.join(options.artifactDir, "cycle-origin-variant-summary.rows.json"),
    variantRowsCsv: path.join(options.artifactDir, "cycle-origin-variant-summary.rows.csv"),
    originRowsJson: path.join(options.artifactDir, "cycle-origin-summary.rows.json"),
    originRowsCsv: path.join(options.artifactDir, "cycle-origin-summary.rows.csv"),
    liveStateRowsJson: path.join(options.artifactDir, "cycle-live-state-summary.rows.json"),
    liveStateRowsCsv: path.join(options.artifactDir, "cycle-live-state-summary.rows.csv"),
    pairSideOriginRowsJson: path.join(options.artifactDir, "cycle-origin-pair-side.rows.json"),
    pairSideOriginRowsCsv: path.join(options.artifactDir, "cycle-origin-pair-side.rows.csv"),
    closeReasonRowsJson: path.join(options.artifactDir, "cycle-origin-close-reason.rows.json"),
    closeReasonRowsCsv: path.join(options.artifactDir, "cycle-origin-close-reason.rows.csv"),
    startDateOriginRowsJson: path.join(options.artifactDir, "cycle-origin-start-date.rows.json"),
    startDateOriginRowsCsv: path.join(options.artifactDir, "cycle-origin-start-date.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    sha: path.join(options.artifactDir, "gate90d-bad-cycle-origin-sha256.txt"),
  };

  await writeJson(artifactPaths.variantRowsJson, result.variantRows);
  await writeCsv(artifactPaths.variantRowsCsv, result.variantRows as unknown as Array<Record<string, unknown>>);
  await writeJson(artifactPaths.originRowsJson, result.originRows);
  await writeCsv(artifactPaths.originRowsCsv, result.originRows as unknown as Array<Record<string, unknown>>);
  await writeJson(artifactPaths.liveStateRowsJson, result.liveStateRows);
  await writeCsv(artifactPaths.liveStateRowsCsv, result.liveStateRows as unknown as Array<Record<string, unknown>>);
  await writeJson(artifactPaths.pairSideOriginRowsJson, result.pairSideOriginRows);
  await writeCsv(artifactPaths.pairSideOriginRowsCsv, result.pairSideOriginRows as unknown as Array<Record<string, unknown>>);
  await writeJson(artifactPaths.closeReasonRowsJson, result.closeReasonRows);
  await writeCsv(artifactPaths.closeReasonRowsCsv, result.closeReasonRows as unknown as Array<Record<string, unknown>>);
  await writeJson(artifactPaths.startDateOriginRowsJson, result.startDateOriginRows);
  await writeCsv(artifactPaths.startDateOriginRowsCsv, result.startDateOriginRows as unknown as Array<Record<string, unknown>>);
  await writeJson(artifactPaths.commandReceipt, {
    gate_id: GATE_ID,
    command: COMMAND,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    input_close_events_csv: toRepoRelative(options.closeEventsCsv),
    scanned_rows: result.scannedRows,
    included_rows: result.includedRows,
    activation_rules: options.activationRules ? [...options.activationRules] : "all",
    protection_modes: options.protectionModes ? [...options.protectionModes] : "all",
    artifact_dir: toRepoRelative(options.artifactDir),
    report_path: toRepoRelative(options.reportPath),
  });
  await writeText(
    options.reportPath,
    renderReport({
      options,
      scannedRows: result.scannedRows,
      includedRows: result.includedRows,
      variantRows: result.variantRows,
      originRows: result.originRows,
      liveStateRows: result.liveStateRows,
      pairSideOriginRows: result.pairSideOriginRows,
      closeReasonRows: result.closeReasonRows,
      startDateOriginRows: result.startDateOriginRows,
      artifactPaths,
    }),
  );
  await writeShaManifest(artifactPaths.sha, GATE_ID, COMMAND, [
    { label: "variant_rows_json", path: artifactPaths.variantRowsJson },
    { label: "origin_rows_json", path: artifactPaths.originRowsJson },
    { label: "live_state_rows_json", path: artifactPaths.liveStateRowsJson },
    { label: "pair_side_origin_rows_json", path: artifactPaths.pairSideOriginRowsJson },
    { label: "close_reason_rows_json", path: artifactPaths.closeReasonRowsJson },
    { label: "start_date_origin_rows_json", path: artifactPaths.startDateOriginRowsJson },
    { label: "command_receipt", path: artifactPaths.commandReceipt },
    { label: "report", path: options.reportPath },
  ]);
  console.log(
    JSON.stringify(
      {
        gate_id: GATE_ID,
        scanned_rows: result.scannedRows,
        included_rows: result.includedRows,
        report_path: toRepoRelative(options.reportPath),
        artifact_dir: toRepoRelative(options.artifactDir),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
