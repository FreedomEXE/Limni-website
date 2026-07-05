import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import { closePoolIfInitialized } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";
import {
  readTradeLegPathWarehousePairSeries,
  type TradeLegPathReplayPairWeek,
} from "@engine/research/tradeLegPathWarehouse";

import {
  gitCommit,
  parseArgMap,
  profitFactor,
  renderTable,
  round,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 96A: limnihedge-type3-adr-long-causality-accounting-inventory-audit";
const GATE_DATE = "2026-07-04";
const COMMAND = "npm run engine:gate96a:limnihedge-type3-adr-long-causality-accounting-inventory-audit";
const DEFAULT_GATE95_DIR =
  "docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026";
const DEFAULT_ARTIFACT_DIR =
  "docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit";
const DEFAULT_REPORT_PATH =
  `docs/research/gates/gate96a/GATE96A_LIMNIHEDGE_TYPE3_ADR_LONG_CAUSALITY_ACCOUNTING_INVENTORY_AUDIT_${GATE_DATE}.md`;
const STANDARD_FX_CONTRACT_UNITS = 100_000;

const AUDIT_VARIANTS = [
  "adr_event_0_025_type3_long_only",
  "adr_event_0_05_type3_long_only",
] as const;

const CONTROL_VARIANTS = [
  "adr_event_0_025_type3_short_only",
  "adr_event_0_05_type3_short_only",
  "time_h1_type3_long_only",
  "time_h1_type3_short_only",
] as const;

const SCOPED_VARIANTS = [...AUDIT_VARIANTS, ...CONTROL_VARIANTS] as const;
const CANDIDATE_B_VARIANTS = [
  "adr_event_0_025_candidate_b_agreement_strict",
  "adr_event_0_025_candidate_b_fade_strict",
  "adr_event_0_05_candidate_b_agreement_strict",
  "adr_event_0_05_candidate_b_fade_strict",
] as const;

type Side = "BUY" | "SELL";
type TrendState = 1 | -1;

type PriceBar = {
  symbol: string;
  timestamp_utc: string;
  timestamp_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  pair_adr_pct: number;
  candidate_b_side: "LONG" | "SHORT";
  source_week_open_utc: string;
};

type MovementCandle = {
  symbol: string;
  stream_id: "adr_event_0_025" | "adr_event_0_05";
  candle_index: number;
  timestamp_utc: string;
  timestamp_ms: number;
  open_time_utc: string;
  close_time_utc: string;
  final_source_m1_time: string;
  open: number;
  close: number;
  direction: TrendState;
  pair_adr_pct: number;
};

type TradeExitRow = {
  variant_id: string;
  symbol: string;
  candle_stream_id: string;
  direction_mode: string;
  entry_row_id: string;
  entry_time_utc: string;
  exit_time_utc: string;
  side: Side;
  lot_size: number;
  entry_price: number;
  exit_price: number;
  exit_reason: string;
  hold_hours: number;
  price_pnl_usd_model: number;
  commission_usd_model: number;
  net_usd_model: number;
  conversion_rate_source: string;
  candidate_b_context_bucket: string;
  terminal_liquidation: boolean;
};

type EntryCandidateRow = {
  row_id: string;
  symbol: string;
  timestamp_utc: string;
  timestamp_ms: number;
  candle_stream_id: string;
  side: Side;
  entry_price: number;
  entry_price_source: string;
  lot_size: number;
  candidate_b_side: "LONG" | "SHORT";
  candidate_b_context_bucket: string;
  movement_brick_adr: number | null;
  admission_status: string;
};

type OpenInventoryRow = {
  variant_id: string;
  symbol: string;
  entry_row_id: string;
  entry_time_utc: string;
  terminal_time_utc: string;
  side: Side;
  lot_size: number;
  entry_price: number;
  terminal_mark_price: number;
  liquidation_net_usd_model: number;
};

type PriceSeries = {
  rawBars: PriceBar[];
  movement: Record<"adr_event_0_025" | "adr_event_0_05", MovementCandle[]>;
};

type PnlResult = {
  rawQuotePnl: number;
  conversionSymbol: string;
  conversionRate: number | null;
  conversionRateSource: string;
  usdPricePnl: number | null;
  commission: number;
  net: number | null;
  expectedPipValue: number | null;
  actualPipValue: number | null;
};

function normalizePath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function round2(value: number) {
  return round(value, 2) ?? value;
}

function round6(value: number) {
  return round(value, 6) ?? value;
}

function withHash<T extends Record<string, unknown>>(row: T): T & { content_hash: string } {
  return { ...row, content_hash: sha256Stable(row) };
}

function gitDirtyStatus() {
  try {
    return execFileSync("git", ["status", "--short"], { encoding: "utf8" }).trim() ? "dirty" : "clean";
  } catch {
    return "unknown";
  }
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted) {
      if (char === "\"") {
        if (line[index + 1] === "\"") {
          current += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

async function streamCsv(filePath: string, onRow: (row: Record<string, string>) => void | Promise<void>) {
  const input = createReadStream(normalizePath(filePath), { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let columns: string[] | null = null;
  for await (const line of rl) {
    if (!columns) {
      columns = parseCsvLine(line);
      continue;
    }
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let index = 0; index < columns.length; index += 1) row[columns[index]!] = values[index] ?? "";
    await onRow(row);
  }
}

async function readCsvRows(filePath: string) {
  const rows: Record<string, string>[] = [];
  await streamCsv(filePath, (row) => rows.push(row));
  return rows;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

async function writeStreamChunk(stream: ReturnType<typeof createWriteStream>, chunk: string) {
  if (!stream.write(chunk)) await once(stream, "drain");
}

async function finishStream(stream: ReturnType<typeof createWriteStream>) {
  stream.end();
  await once(stream, "finish");
}

async function writeRows(jsonPath: string, csvPath: string, rows: Record<string, unknown>[]) {
  const normalizedJsonPath = normalizePath(jsonPath);
  await mkdir(path.dirname(normalizedJsonPath), { recursive: true });
  const jsonStream = createWriteStream(normalizedJsonPath, { encoding: "utf8" });
  try {
    await writeStreamChunk(jsonStream, "[\n");
    for (let index = 0; index < rows.length; index += 1) {
      await writeStreamChunk(jsonStream, `${index === 0 ? "" : ",\n"}${JSON.stringify(rows[index])}`);
    }
    await writeStreamChunk(jsonStream, "\n]\n");
    await finishStream(jsonStream);
  } catch (error) {
    jsonStream.destroy();
    throw error;
  }

  const normalizedCsvPath = normalizePath(csvPath);
  await mkdir(path.dirname(normalizedCsvPath), { recursive: true });
  if (rows.length === 0) {
    await writeFile(normalizedCsvPath, "", "utf8");
    return;
  }
  const columns = Object.keys(rows[0]!);
  const csvStream = createWriteStream(normalizedCsvPath, { encoding: "utf8" });
  try {
    await writeStreamChunk(csvStream, `${columns.join(",")}\n`);
    for (const row of rows) {
      await writeStreamChunk(csvStream, `${columns.map((column) => csvEscape(row[column])).join(",")}\n`);
    }
    await finishStream(csvStream);
  } catch (error) {
    csvStream.destroy();
    throw error;
  }
}

function numberValue(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined || value === "") return 0;
  return Number(value);
}

function booleanValue(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") return value;
  return value === "true";
}

function baseCurrency(pair: string) {
  return pair.slice(0, 3);
}

function quoteCurrency(pair: string) {
  return pair.slice(3, 6);
}

function pipSize(symbol: string) {
  return symbol.endsWith("JPY") ? 0.01 : 0.0001;
}

function addMs(iso: string, ms: number) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthEndIso(key: string) {
  const [year, month] = key.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
}

function monthsBetween(dateFrom: string, dateTo: string) {
  const months: string[] = [];
  const start = new Date(Date.UTC(Number(dateFrom.slice(0, 4)), Number(dateFrom.slice(5, 7)) - 1, 1));
  const endKey = dateTo.slice(0, 7);
  for (let cursor = start; ; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push(key);
    if (key === endKey) break;
  }
  return months;
}

function rawPriceFromDirectedAdr(row: TradeLegPathReplayPairWeek, directedAdr: number) {
  if (!row.entry_price || row.entry_price <= 0 || row.pair_adr_pct <= 0) return null;
  const signedPct = directedAdr * row.pair_adr_pct / 100;
  return row.candidate_b_side === "LONG"
    ? row.entry_price * (1 + signedPct)
    : row.entry_price * (1 - signedPct);
}

function reconstructRawBars(rows: TradeLegPathReplayPairWeek[], dateFromMs: number, dateToMs: number) {
  const bars: PriceBar[] = [];
  let lastTimestamp: string | null = null;
  for (const row of rows) {
    for (let index = 0; index < row.path_payload.timestamp_utc.length; index += 1) {
      const timestamp = row.path_payload.timestamp_utc[index]!;
      if (lastTimestamp !== null && timestamp <= lastTimestamp) continue;
      const timestampMs = Date.parse(timestamp);
      lastTimestamp = timestamp;
      if (timestampMs < dateFromMs || timestampMs > dateToMs) continue;
      const prices = [
        rawPriceFromDirectedAdr(row, row.path_payload.directed_open_adr[index]!),
        rawPriceFromDirectedAdr(row, row.path_payload.directed_high_adr[index]!),
        rawPriceFromDirectedAdr(row, row.path_payload.directed_low_adr[index]!),
        rawPriceFromDirectedAdr(row, row.path_payload.directed_close_adr[index]!),
      ];
      if (prices.some((price) => price === null)) continue;
      const [open, highCandidate, lowCandidate, close] = prices as [number, number, number, number];
      bars.push({
        symbol: row.pair,
        timestamp_utc: timestamp,
        timestamp_ms: timestampMs,
        open,
        high: Math.max(open, highCandidate, lowCandidate, close),
        low: Math.min(open, highCandidate, lowCandidate, close),
        close,
        pair_adr_pct: row.pair_adr_pct,
        candidate_b_side: row.candidate_b_side,
        source_week_open_utc: row.week_open_utc,
      });
    }
  }
  return bars;
}

function buildMovementCandles(symbol: string, rawBars: PriceBar[], streamId: "adr_event_0_025" | "adr_event_0_05", brickAdr: number) {
  const candles: MovementCandle[] = [];
  let eventOpen: number | null = null;
  let eventOpenTime: string | null = null;
  for (const raw of rawBars) {
    if (eventOpen === null) {
      eventOpen = raw.close;
      eventOpenTime = raw.timestamp_utc;
      continue;
    }
    let moveAdr = ((raw.close - eventOpen) / eventOpen) * 100 / raw.pair_adr_pct;
    let guard = 0;
    while (Math.abs(moveAdr) >= brickAdr && guard < 500) {
      const direction: TrendState = moveAdr > 0 ? 1 : -1;
      const open = eventOpen;
      const close = open * (1 + direction * brickAdr * raw.pair_adr_pct / 100);
      candles.push({
        symbol,
        stream_id: streamId,
        candle_index: candles.length,
        timestamp_utc: raw.timestamp_utc,
        timestamp_ms: raw.timestamp_ms,
        open_time_utc: eventOpenTime ?? raw.timestamp_utc,
        close_time_utc: raw.timestamp_utc,
        final_source_m1_time: raw.timestamp_utc,
        open,
        close,
        pair_adr_pct: raw.pair_adr_pct,
        direction,
      });
      eventOpen = close;
      eventOpenTime = raw.timestamp_utc;
      moveAdr = ((raw.close - eventOpen) / eventOpen) * 100 / raw.pair_adr_pct;
      guard += 1;
    }
  }
  return candles;
}

function priceAtOrBefore(series: PriceBar[], timestampUtc: string) {
  const target = Date.parse(timestampUtc);
  let left = 0;
  let right = series.length - 1;
  let found: PriceBar | null = null;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const row = series[mid]!;
    if (row.timestamp_ms <= target) {
      found = row;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return found;
}

function conversionRate(quote: string, timestampUtc: string, prices: Map<string, PriceSeries>) {
  if (quote === "USD") return { symbol: "USD", rate: 1, source: "quote_usd" };
  const direct = `${quote}USD`;
  const directPrice = prices.get(direct) ? priceAtOrBefore(prices.get(direct)!.rawBars, timestampUtc) : null;
  if (directPrice && directPrice.close > 0) return { symbol: direct, rate: directPrice.close, source: "direct_quote_usd" };
  const inverse = `USD${quote}`;
  const inversePrice = prices.get(inverse) ? priceAtOrBefore(prices.get(inverse)!.rawBars, timestampUtc) : null;
  if (inversePrice && inversePrice.close > 0) return { symbol: inverse, rate: 1 / inversePrice.close, source: "inverse_usd_quote" };
  return { symbol: `${quote}USD_OR_USD${quote}`, rate: null, source: "missing_conversion_price" };
}

function pnl(symbol: string, side: Side, lotSize: number, entryPrice: number, exitPrice: number, exitTime: string, prices: Map<string, PriceSeries>): PnlResult {
  const units = lotSize * STANDARD_FX_CONTRACT_UNITS;
  const rawQuotePnl = side === "BUY" ? (exitPrice - entryPrice) * units : (entryPrice - exitPrice) * units;
  const quote = quoteCurrency(symbol);
  const conversion = baseCurrency(symbol) === "USD" && exitPrice > 0
    ? { symbol, rate: 1 / exitPrice, source: "base_usd_inverse_exit_price" }
    : conversionRate(quote, exitTime, prices);
  const usdPricePnl = conversion.rate === null ? null : rawQuotePnl * conversion.rate;
  const commission = -7 * lotSize;
  const pips = Math.abs(exitPrice - entryPrice) / pipSize(symbol);
  const expectedPipValue = conversion.rate === null ? null : pipSize(symbol) * units * conversion.rate;
  const actualPipValue = usdPricePnl === null || pips === 0 ? null : Math.abs(usdPricePnl / pips);
  return {
    rawQuotePnl,
    conversionSymbol: conversion.symbol,
    conversionRate: conversion.rate,
    conversionRateSource: conversion.source,
    usdPricePnl,
    commission,
    net: usdPricePnl === null ? null : usdPricePnl + commission,
    expectedPipValue,
    actualPipValue,
  };
}

function mapTrade(row: Record<string, string>): TradeExitRow {
  return {
    variant_id: row.variant_id ?? "",
    symbol: row.symbol ?? "",
    candle_stream_id: row.candle_stream_id ?? "",
    direction_mode: row.direction_mode ?? "",
    entry_row_id: row.entry_row_id ?? "",
    entry_time_utc: row.entry_time_utc ?? "",
    exit_time_utc: row.exit_time_utc ?? "",
    side: (row.side ?? "BUY") as Side,
    lot_size: numberValue(row.lot_size),
    entry_price: numberValue(row.entry_price),
    exit_price: numberValue(row.exit_price),
    exit_reason: row.exit_reason ?? "",
    hold_hours: numberValue(row.hold_hours),
    price_pnl_usd_model: numberValue(row.price_pnl_usd_model),
    commission_usd_model: numberValue(row.commission_usd_model),
    net_usd_model: numberValue(row.net_usd_model),
    conversion_rate_source: row.conversion_rate_source ?? "",
    candidate_b_context_bucket: row.candidate_b_context_bucket ?? "",
    terminal_liquidation: booleanValue(row.terminal_liquidation),
  };
}

function mapEntry(row: Record<string, string>): EntryCandidateRow {
  return {
    row_id: row.row_id ?? "",
    symbol: row.symbol ?? "",
    timestamp_utc: row.timestamp_utc ?? "",
    timestamp_ms: numberValue(row.timestamp_ms),
    candle_stream_id: row.candle_stream_id ?? "",
    side: (row.side ?? "BUY") as Side,
    entry_price: numberValue(row.entry_price),
    entry_price_source: row.entry_price_source ?? "",
    lot_size: numberValue(row.lot_size),
    candidate_b_side: (row.candidate_b_side ?? "LONG") as "LONG" | "SHORT",
    candidate_b_context_bucket: row.candidate_b_context_bucket ?? "",
    movement_brick_adr: row.movement_brick_adr ? numberValue(row.movement_brick_adr) : null,
    admission_status: row.admission_status ?? "",
  };
}

function mapInventory(row: Record<string, string>): OpenInventoryRow {
  return {
    variant_id: row.variant_id ?? "",
    symbol: row.symbol ?? "",
    entry_row_id: row.entry_row_id ?? "",
    entry_time_utc: row.entry_time_utc ?? "",
    terminal_time_utc: row.terminal_time_utc ?? "",
    side: (row.side ?? "BUY") as Side,
    lot_size: numberValue(row.lot_size),
    entry_price: numberValue(row.entry_price),
    terminal_mark_price: numberValue(row.terminal_mark_price),
    liquidation_net_usd_model: numberValue(row.liquidation_net_usd_model),
  };
}

function addAgg(map: Map<string, { trades: number; net_gate95: number; net_actual: number; terminal: number }>, key: string, gate95: number, actual: number, terminal = false) {
  const current = map.get(key) ?? { trades: 0, net_gate95: 0, net_actual: 0, terminal: 0 };
  current.trades += 1;
  current.net_gate95 += gate95;
  current.net_actual += actual;
  if (terminal) current.terminal += 1;
  map.set(key, current);
}

function maxNumber(values: number[]) {
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) if (value > max) max = value;
  return max;
}

function minNumber(values: number[]) {
  let min = Number.POSITIVE_INFINITY;
  for (const value of values) if (value < min) min = value;
  return min;
}

function deterministicUnit(text: string) {
  const hash = sha256Stable({ text }).slice(0, 12);
  return Number.parseInt(hash, 16) / 0xffffffffffff;
}

function variantStream(variantId: string) {
  if (variantId.startsWith("adr_event_0_025")) return "adr_event_0_025" as const;
  if (variantId.startsWith("adr_event_0_05")) return "adr_event_0_05" as const;
  return null;
}

function renderReport(params: {
  configHash: string;
  verdict: string;
  auditSummary: Record<string, unknown>[];
  inventoryRows: Record<string, unknown>[];
  monthRows: Record<string, unknown>[];
  concentrationRows: Record<string, unknown>[];
  nullRows: Record<string, unknown>[];
  candidateRows: Record<string, unknown>[];
  validationRows: Record<string, unknown>[];
  paths: Record<string, string>;
}) {
  const validationFailures = params.validationRows.filter((row) => row.passed !== true).length;
  return `# Gate 96A LimniHedge Type 3 ADR Long Causality Accounting Inventory Audit

Date: ${GATE_DATE}

Verdict: \`${params.verdict}\`

## Scope

Gate 96A consumes the Gate 95 OOS artifact surface for \`2025-01-01..2026-05-31\`. It does not run 2019-2024, optimize variants, add Candidate B/Katarakti/Q filters, change lifecycle rules, touch MT5, or promote a runtime.

Audited rows: \`${AUDIT_VARIANTS.join("`, `")}\`.

Controls: \`${CONTROL_VARIANTS.join("`, `")}\`.

Config hash: \`${params.configHash}\`

## Audit Summary

${renderTable(params.auditSummary, ["variant_id", "trades", "gate95_net_usd_model", "actual_usd_net", "gate95_minus_actual_usd", "conversion_gap_rows", "max_abs_model_delta"])}

## Inventory Markout

${renderTable(params.inventoryRows, ["variant_id", "closed_net_actual_ex_terminal", "terminal_inventory_actual", "closed_plus_marked_actual", "gate95_report_net", "terminal_open_count", "max_open_unrealized_loss_actual", "worst_open_inventory_day"])}

## Month-End Marked Equity

${renderTable(params.monthRows, ["variant_id", "months", "negative_marked_months", "worst_month", "worst_marked_equity_actual", "best_month", "best_marked_equity_actual"])}

## Pair Concentration

${renderTable(params.concentrationRows, ["variant_id", "marked_net_actual", "top_pair", "top_pair_contribution_pct", "top_3_contribution_pct", "remove_best_pair_net_actual", "remove_top_3_pairs_net_actual", "aud_net_actual", "non_aud_net_actual", "jpy_cross_net_actual", "non_jpy_net_actual"])}

## Null Controls

These are matched-hold audit controls, not lifecycle strategy variants. Random and shifted controls preserve the audited trade hold duration and long side, then reprice from deterministic alternative entry timestamps.

${renderTable(params.nullRows, ["variant_id", "control_id", "trades", "net_actual", "profit_factor", "notes"])}

## Candidate B Decomposition

${renderTable(params.candidateRows, ["variant_id", "bucket", "side", "trades", "net_actual", "net_gate95_model"])}

## Validation

Validation failures: \`${validationFailures}\`

${renderTable(params.validationRows, ["check", "value", "expected", "passed"])}

## Interpretation Boundary

Gate 96A is an audit gate. Any failed validation blocks historical expansion. In particular, material actual-USD conversion deltas mean the Gate 95 dollar headline is not broker-real until accounting is corrected and rerun.

## Artifact Durability

The full row ledgers `causality-audit.rows.*` and `pnl-reconciliation.rows.*` are local-only due size and are hash-bound in `gate96a-sha256.txt`. The committed repo surface is the report, config, command receipt, SHA manifest, validation rows, and compact summary tables.

## Artifacts

${Object.entries(params.paths).map(([label, filePath]) => `- ${label}: \`${toRepoRelative(filePath)}\``).join("\n")}
`;
}

async function main() {
  const args = parseArgMap(process.argv.slice(2));
  const gate95Dir = args.get("--gate95-artifact-dir") ?? DEFAULT_GATE95_DIR;
  const artifactDir = args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR;
  const reportPath = args.get("--report-path") ?? DEFAULT_REPORT_PATH;

  const gate95ConfigPath = path.join(gate95Dir, "gate95-config.json");
  const gate95SummaryPath = path.join(gate95Dir, "gate95-run-summary.json");
  const gate95ValidationPath = path.join(gate95Dir, "validation.rows.json");
  const gate95ShaPath = path.join(gate95Dir, "gate95-sha256.txt");
  const gate95CommandPath = path.join(gate95Dir, "command-receipt.json");
  const candidatesPath = path.join(gate95Dir, "type3-entry-candidates.rows.csv");
  const exitsPath = path.join(gate95Dir, "trade-exits.rows.csv");
  const inventoryPath = path.join(gate95Dir, "open-inventory.rows.csv");

  const gate95Config = JSON.parse(await readFile(normalizePath(gate95ConfigPath), "utf8")) as {
    price_bundle_id: string;
    gate74b_manifest_id: string;
    selected_pairs: string[];
    date_from: string;
    date_to: string;
    config_hash: string;
  };
  const gate95RunSummary = JSON.parse(await readFile(normalizePath(gate95SummaryPath), "utf8")) as { validation_failures: number };
  const gate95Validation = JSON.parse(await readFile(normalizePath(gate95ValidationPath), "utf8")) as Array<{ passed: boolean }>;
  const gate95Sha = await readFile(normalizePath(gate95ShaPath), "utf8");
  await readFile(normalizePath(gate95CommandPath), "utf8");

  const dateFromMs = Date.parse(gate95Config.date_from);
  const dateToMs = Date.parse(gate95Config.date_to);
  const scopedSet = new Set<string>(SCOPED_VARIANTS);
  const auditSet = new Set<string>(AUDIT_VARIANTS);
  const candidateBSet = new Set<string>(CANDIDATE_B_VARIANTS);

  const scopedTrades: TradeExitRow[] = [];
  const auditTrades: TradeExitRow[] = [];
  const candidateBTrades: TradeExitRow[] = [];
  const auditEntryIds = new Set<string>();
  const symbolsNeeded = new Set<string>();
  const variantGate95Values = new Map<string, number[]>();

  console.log("gate96a stream gate95 trade exits");
  await streamCsv(exitsPath, (row) => {
    const variant = row.variant_id ?? "";
    if (!scopedSet.has(variant) && !candidateBSet.has(variant)) return;
    const trade = mapTrade(row);
    symbolsNeeded.add(trade.symbol);
    if (scopedSet.has(variant)) {
      scopedTrades.push(trade);
      const values = variantGate95Values.get(variant) ?? [];
      values.push(trade.net_usd_model);
      variantGate95Values.set(variant, values);
    }
    if (auditSet.has(variant)) {
      auditTrades.push(trade);
      auditEntryIds.add(trade.entry_row_id);
    }
    if (candidateBSet.has(variant)) candidateBTrades.push(trade);
  });

  const auditEntries = new Map<string, EntryCandidateRow>();
  console.log("gate96a stream gate95 entry candidates");
  await streamCsv(candidatesPath, (row) => {
    const id = row.row_id ?? "";
    if (!auditEntryIds.has(id)) return;
    const entry = mapEntry(row);
    auditEntries.set(id, entry);
    symbolsNeeded.add(entry.symbol);
  });

  const inventoryRowsRaw: OpenInventoryRow[] = [];
  console.log("gate96a stream gate95 open inventory");
  await streamCsv(inventoryPath, (row) => {
    if (!scopedSet.has(row.variant_id ?? "")) return;
    const inventory = mapInventory(row);
    inventoryRowsRaw.push(inventory);
    symbolsNeeded.add(inventory.symbol);
  });

  const conversionSymbols = new Set<string>();
  for (const symbol of symbolsNeeded) {
    const quote = quoteCurrency(symbol);
    if (quote === "USD") continue;
    conversionSymbols.add(`${quote}USD`);
    conversionSymbols.add(`USD${quote}`);
  }
  const allPriceSymbols = gate95Config.selected_pairs.filter((pair) => symbolsNeeded.has(pair) || conversionSymbols.has(pair));

  const prices = new Map<string, PriceSeries>();
  for (const pair of allPriceSymbols) {
    console.log(`gate96a load pair=${pair}`);
    const series = await readTradeLegPathWarehousePairSeries({ manifestId: gate95Config.gate74b_manifest_id, pair });
    const rawBars = reconstructRawBars(series, dateFromMs, dateToMs);
    prices.set(pair, {
      rawBars,
      movement: {
        adr_event_0_025: buildMovementCandles(pair, rawBars, "adr_event_0_025", 0.025),
        adr_event_0_05: buildMovementCandles(pair, rawBars, "adr_event_0_05", 0.05),
      },
    });
  }

  const movementTimestampIndex = new Map<string, number>();
  const monthBarsBySymbol = new Map<string, Map<string, PriceBar[]>>();
  for (const [symbol, series] of prices.entries()) {
    const byMonth = new Map<string, PriceBar[]>();
    for (const bar of series.rawBars) {
      const key = monthKey(bar.timestamp_utc);
      const rows = byMonth.get(key);
      if (rows) rows.push(bar);
      else byMonth.set(key, [bar]);
    }
    monthBarsBySymbol.set(symbol, byMonth);
    for (const stream of ["adr_event_0_025", "adr_event_0_05"] as const) {
      const candles = series.movement[stream];
      for (let index = 0; index < candles.length; index += 1) {
        const candle = candles[index]!;
        const key = `${symbol}|${stream}|${candle.close_time_utc}`;
        if (!movementTimestampIndex.has(key)) movementTimestampIndex.set(key, index);
      }
    }
  }

  const movementIndexByEntry = new Map<string, number>();
  const causalityRows: Record<string, unknown>[] = [];
  for (const [entryId, entry] of auditEntries.entries()) {
    const stream = entry.candle_stream_id as "adr_event_0_025" | "adr_event_0_05";
    const candles = prices.get(entry.symbol)?.movement[stream] ?? [];
    const currentIndex = movementTimestampIndex.get(`${entry.symbol}|${stream}|${entry.timestamp_utc}`) ?? -1;
    const signal1 = currentIndex > 0 ? candles[currentIndex - 1] : null;
    const signal2 = currentIndex > 1 ? candles[currentIndex - 2] : null;
    const signal3 = currentIndex > 2 ? candles[currentIndex - 3] : null;
    const signal4 = currentIndex > 3 ? candles[currentIndex - 4] : null;
    const signal5 = currentIndex > 4 ? candles[currentIndex - 5] : null;
    if (currentIndex >= 0) movementIndexByEntry.set(entryId, currentIndex);
    const latestSignalInputTime = signal1?.close_time_utc ?? null;
    const firstExecutableTime = entry.timestamp_utc;
    const causalityPass = Boolean(latestSignalInputTime && latestSignalInputTime < entry.timestamp_utc && entry.entry_price_source === "movement_event_close");
    causalityRows.push(withHash({
      symbol: entry.symbol,
      variant_id: `${entry.candle_stream_id}_type3_long_only`,
      entry_row_id: entryId,
      entry_time: entry.timestamp_utc,
      entry_price: entry.entry_price,
      entry_source: entry.entry_price_source,
      movement_bar_1_open_time: signal1?.open_time_utc ?? null,
      movement_bar_1_close_time: signal1?.close_time_utc ?? null,
      movement_bar_1_final_source_m1_time: signal1?.final_source_m1_time ?? null,
      movement_bar_2_close_time: signal2?.close_time_utc ?? null,
      movement_bar_3_close_time: signal3?.close_time_utc ?? null,
      movement_bar_4_close_time: signal4?.close_time_utc ?? null,
      movement_bar_5_close_time: signal5?.close_time_utc ?? null,
      latest_signal_input_time: latestSignalInputTime,
      first_executable_time: firstExecutableTime,
      causality_pass: causalityPass,
      causality_failure_reason: causalityPass
        ? null
        : currentIndex < 0
          ? "entry_not_found_in_reconstructed_movement_candles"
          : latestSignalInputTime === null
            ? "missing_prior_signal_candle"
            : entry.entry_price_source !== "movement_event_close"
              ? "entry_source_not_movement_event_close"
              : "latest_signal_input_not_before_entry",
    }));
  }

  const auditSummary = new Map<string, {
    trades: number;
    gate95Net: number;
    actualNet: number;
    conversionGapRows: number;
    modelDeltas: number[];
    actualDeltas: number[];
    valuesActual: number[];
  }>();
  const pnlRows: Record<string, unknown>[] = [];
  const tradeActualNet = new Map<string, number>();
  for (const trade of scopedTrades) {
    const result = pnl(trade.symbol, trade.side, trade.lot_size, trade.entry_price, trade.exit_price, trade.exit_time_utc, prices);
    const actualNet = result.net ?? trade.net_usd_model;
    tradeActualNet.set(`${trade.variant_id}|${trade.entry_row_id}|${trade.exit_time_utc}`, actualNet);
    if (auditSet.has(trade.variant_id)) {
      const modelDelta = result.net === null ? null : result.net - trade.net_usd_model;
      pnlRows.push(withHash({
        variant_id: trade.variant_id,
        symbol: trade.symbol,
        side: trade.side,
        lot_size: trade.lot_size,
        entry_row_id: trade.entry_row_id,
        entry_time: trade.entry_time_utc,
        exit_time: trade.exit_time_utc,
        entry_price: trade.entry_price,
        exit_price: trade.exit_price,
        raw_price_delta: round6(trade.side === "BUY" ? trade.exit_price - trade.entry_price : trade.entry_price - trade.exit_price),
        quote_currency_pnl: round6(result.rawQuotePnl),
        conversion_symbol: result.conversionSymbol,
        conversion_rate: result.conversionRate === null ? null : round6(result.conversionRate),
        conversion_rate_source: result.conversionRateSource,
        usd_price_pnl_recomputed: result.usdPricePnl === null ? null : round6(result.usdPricePnl),
        gate95_usd_price_pnl: trade.price_pnl_usd_model,
        commission: round6(result.commission),
        swap: null,
        net_pnl_recomputed: result.net === null ? null : round6(result.net),
        gate95_net_pnl: trade.net_usd_model,
        expected_pip_value: result.expectedPipValue === null ? null : round6(result.expectedPipValue),
        actual_pip_value: result.actualPipValue === null ? null : round6(result.actualPipValue),
        pnl_reconciliation_delta: modelDelta === null ? null : round6(modelDelta),
      }));
    }
    const summary = auditSummary.get(trade.variant_id) ?? {
      trades: 0,
      gate95Net: 0,
      actualNet: 0,
      conversionGapRows: 0,
      modelDeltas: [],
      actualDeltas: [],
      valuesActual: [],
    };
    summary.trades += 1;
    summary.gate95Net += trade.net_usd_model;
    summary.actualNet += actualNet;
    summary.valuesActual.push(actualNet);
    if (result.net === null) summary.conversionGapRows += 1;
    else {
      const delta = result.net - trade.net_usd_model;
      summary.modelDeltas.push(delta);
      if (trade.conversion_rate_source === "cross_quote_unconverted") summary.actualDeltas.push(delta);
    }
    auditSummary.set(trade.variant_id, summary);
  }

  const auditSummaryRows = [...auditSummary.entries()]
    .filter(([variant]) => scopedSet.has(variant))
    .map(([variant, row]) => withHash({
      variant_id: variant,
      trades: row.trades,
      gate95_net_usd_model: round2(row.gate95Net),
      actual_usd_net: round2(row.actualNet),
      gate95_minus_actual_usd: round2(row.gate95Net - row.actualNet),
      conversion_gap_rows: row.conversionGapRows,
      max_abs_model_delta: row.modelDeltas.length ? round6(maxNumber(row.modelDeltas.map((value) => Math.abs(value)))) : 0,
      max_abs_cross_conversion_delta: row.actualDeltas.length ? round6(maxNumber(row.actualDeltas.map((value) => Math.abs(value)))) : 0,
      actual_profit_factor: round(profitFactor(row.valuesActual), 6),
    }));

  const closedByVariant = new Map<string, number>();
  const terminalByVariant = new Map<string, number>();
  const terminalCountByVariant = new Map<string, number>();
  const pairAgg = new Map<string, { trades: number; netGate95: number; netActual: number; terminal: number }>();
  const currencyAgg = new Map<string, { longNet: number; shortNet: number; longTrades: number; shortTrades: number }>();
  for (const trade of scopedTrades) {
    const actual = tradeActualNet.get(`${trade.variant_id}|${trade.entry_row_id}|${trade.exit_time_utc}`) ?? trade.net_usd_model;
    if (trade.terminal_liquidation) {
      terminalByVariant.set(trade.variant_id, (terminalByVariant.get(trade.variant_id) ?? 0) + actual);
      terminalCountByVariant.set(trade.variant_id, (terminalCountByVariant.get(trade.variant_id) ?? 0) + 1);
    } else {
      closedByVariant.set(trade.variant_id, (closedByVariant.get(trade.variant_id) ?? 0) + actual);
    }
    const pairKey = `${trade.variant_id}|${trade.symbol}`;
    const p = pairAgg.get(pairKey) ?? { trades: 0, netGate95: 0, netActual: 0, terminal: 0 };
    p.trades += 1;
    p.netGate95 += trade.net_usd_model;
    p.netActual += actual;
    if (trade.terminal_liquidation) p.terminal += 1;
    pairAgg.set(pairKey, p);

    for (const [currency, sideBucket] of [[baseCurrency(trade.symbol), trade.side === "BUY" ? "long" : "short"], [quoteCurrency(trade.symbol), trade.side === "BUY" ? "short" : "long"]] as const) {
      const c = currencyAgg.get(`${trade.variant_id}|${currency}`) ?? { longNet: 0, shortNet: 0, longTrades: 0, shortTrades: 0 };
      if (sideBucket === "long") {
        c.longNet += actual;
        c.longTrades += 1;
      } else {
        c.shortNet += actual;
        c.shortTrades += 1;
      }
      currencyAgg.set(`${trade.variant_id}|${currency}`, c);
    }
  }

  const inventoryRows: Record<string, unknown>[] = [];
  for (const variant of SCOPED_VARIANTS) {
    const closed = closedByVariant.get(variant) ?? 0;
    const terminal = terminalByVariant.get(variant) ?? 0;
    const gate95Values = variantGate95Values.get(variant) ?? [];
    const gate95Net = gate95Values.reduce((sum, value) => sum + value, 0);
    const variantInventory = inventoryRowsRaw.filter((row) => row.variant_id === variant);
    let worstOpenLoss = 0;
    let worstOpenDay: string | null = null;
    for (const inv of variantInventory) {
      const actual = pnl(inv.symbol, inv.side, inv.lot_size, inv.entry_price, inv.terminal_mark_price, inv.terminal_time_utc, prices).net ?? inv.liquidation_net_usd_model;
      if (actual < worstOpenLoss) {
        worstOpenLoss = actual;
        worstOpenDay = inv.terminal_time_utc.slice(0, 10);
      }
    }
    inventoryRows.push(withHash({
      variant_id: variant,
      closed_net_actual_ex_terminal: round2(closed),
      terminal_inventory_actual: round2(terminal),
      closed_plus_marked_actual: round2(closed + terminal),
      gate95_report_net: round2(gate95Net),
      terminal_open_count: terminalCountByVariant.get(variant) ?? 0,
      max_open_unrealized_loss_actual: round2(worstOpenLoss),
      worst_open_inventory_day: worstOpenDay,
    }));
  }

  const monthSummaryRows: Record<string, unknown>[] = [];
  const monthDetailRows: Record<string, unknown>[] = [];
  const months = monthsBetween(gate95Config.date_from, gate95Config.date_to);
  for (const variant of AUDIT_VARIANTS) {
    const variantTrades = scopedTrades.filter((trade) => trade.variant_id === variant);
    const details: Array<{ month: string; marked: number }> = [];
    for (const month of months) {
      const end = monthEndIso(month);
      const endMs = Date.parse(end);
      let closed = 0;
      let openMarked = 0;
      for (const trade of variantTrades) {
        const entryMs = Date.parse(trade.entry_time_utc);
        const exitMs = Date.parse(trade.exit_time_utc);
        if (exitMs <= endMs) {
          closed += tradeActualNet.get(`${trade.variant_id}|${trade.entry_row_id}|${trade.exit_time_utc}`) ?? trade.net_usd_model;
        } else if (entryMs <= endMs) {
          const price = priceAtOrBefore(prices.get(trade.symbol)?.rawBars ?? [], end);
          if (price) openMarked += pnl(trade.symbol, trade.side, trade.lot_size, trade.entry_price, price.close, price.timestamp_utc, prices).net ?? 0;
        }
      }
      const marked = closed + openMarked;
      details.push({ month, marked });
      monthDetailRows.push(withHash({
        variant_id: variant,
        month,
        month_end_utc: end,
        closed_net_actual_to_month_end: round2(closed),
        open_marked_net_actual: round2(openMarked),
        marked_equity_actual: round2(marked),
      }));
    }
    const worst = [...details].sort((a, b) => a.marked - b.marked)[0]!;
    const best = [...details].sort((a, b) => b.marked - a.marked)[0]!;
    monthSummaryRows.push(withHash({
      variant_id: variant,
      months: details.length,
      negative_marked_months: details.filter((row) => row.marked < 0).length,
      worst_month: worst.month,
      worst_marked_equity_actual: round2(worst.marked),
      best_month: best.month,
      best_marked_equity_actual: round2(best.marked),
    }));
  }

  const concentrationRows: Record<string, unknown>[] = [];
  const currencyRows: Record<string, unknown>[] = [];
  for (const variant of SCOPED_VARIANTS) {
    const pairRows = [...pairAgg.entries()]
      .filter(([key]) => key.startsWith(`${variant}|`))
      .map(([key, value]) => ({ symbol: key.split("|")[1]!, ...value }))
      .sort((a, b) => b.netActual - a.netActual);
    const total = pairRows.reduce((sum, row) => sum + row.netActual, 0);
    const positivePairs = pairRows.filter((row) => row.netActual > 0);
    const top = positivePairs[0] ?? pairRows[0] ?? null;
    const top3 = positivePairs.slice(0, 3);
    const top3Net = top3.reduce((sum, row) => sum + row.netActual, 0);
    const audNet = pairRows.filter((row) => row.symbol.includes("AUD")).reduce((sum, row) => sum + row.netActual, 0);
    const jpyNet = pairRows.filter((row) => row.symbol.includes("JPY")).reduce((sum, row) => sum + row.netActual, 0);
    concentrationRows.push(withHash({
      variant_id: variant,
      marked_net_actual: round2(total),
      top_pair: top?.symbol ?? null,
      top_pair_contribution_pct: top && total !== 0 ? round6((top.netActual / total) * 100) : null,
      top_3_contribution_pct: total !== 0 ? round6((top3Net / total) * 100) : null,
      remove_best_pair_net_actual: top ? round2(total - top.netActual) : round2(total),
      remove_top_3_pairs_net_actual: round2(total - top3Net),
      aud_net_actual: round2(audNet),
      non_aud_net_actual: round2(total - audNet),
      jpy_cross_net_actual: round2(jpyNet),
      non_jpy_net_actual: round2(total - jpyNet),
    }));
    for (const [key, value] of currencyAgg.entries()) {
      if (!key.startsWith(`${variant}|`)) continue;
      currencyRows.push(withHash({
        variant_id: variant,
        currency: key.split("|")[1],
        long_trades: value.longTrades,
        long_net_actual: round2(value.longNet),
        short_trades: value.shortTrades,
        short_net_actual: round2(value.shortNet),
        total_net_actual: round2(value.longNet + value.shortNet),
      }));
    }
  }

  const nullRows: Record<string, unknown>[] = [];
  for (const variant of AUDIT_VARIANTS) {
    const stream = variantStream(variant)!;
    const variantTrades = auditTrades.filter((trade) => trade.variant_id === variant);
    const randomValues: number[] = [];
    const shiftValues = new Map<number, number[]>();
    for (const shift of [1, 5, 20]) shiftValues.set(shift, []);
    const alwaysGroups = new Map<string, { symbol: string; month: string; lots: number }>();
    for (const trade of variantTrades) {
      const bars = prices.get(trade.symbol)?.rawBars ?? [];
      const entryMonth = monthKey(trade.entry_time_utc);
      const groupKey = `${trade.symbol}|${entryMonth}`;
      const group = alwaysGroups.get(groupKey) ?? { symbol: trade.symbol, month: entryMonth, lots: 0 };
      group.lots += trade.lot_size;
      alwaysGroups.set(groupKey, group);

      const monthBars = monthBarsBySymbol.get(trade.symbol)?.get(entryMonth) ?? [];
      if (monthBars.length > 10) {
        const holdMs = Date.parse(trade.exit_time_utc) - Date.parse(trade.entry_time_utc);
        const startIndex = Math.min(monthBars.length - 1, Math.floor(deterministicUnit(trade.entry_row_id) * monthBars.length));
        const start = monthBars[startIndex]!;
        const end = priceAtOrBefore(bars, addMs(start.timestamp_utc, holdMs));
        if (end && Date.parse(end.timestamp_utc) > start.timestamp_ms) {
          const result = pnl(trade.symbol, "BUY", trade.lot_size, start.close, end.close, end.timestamp_utc, prices).net;
          if (result !== null) randomValues.push(result);
        }
      }

      const entry = auditEntries.get(trade.entry_row_id);
      const currentIndex = movementIndexByEntry.get(trade.entry_row_id);
      if (entry && currentIndex !== undefined) {
        const candles = prices.get(trade.symbol)?.movement[stream] ?? [];
        const holdMs = Date.parse(trade.exit_time_utc) - Date.parse(trade.entry_time_utc);
        for (const shift of [1, 5, 20]) {
          const shifted = candles[currentIndex + shift];
          if (!shifted) continue;
          const exit = priceAtOrBefore(bars, addMs(shifted.close_time_utc, holdMs));
          if (!exit || Date.parse(exit.timestamp_utc) <= shifted.timestamp_ms) continue;
          const result = pnl(trade.symbol, "BUY", trade.lot_size, shifted.close, exit.close, exit.timestamp_utc, prices).net;
          if (result !== null) shiftValues.get(shift)!.push(result);
        }
      }
    }
    const alwaysValues: number[] = [];
    for (const group of alwaysGroups.values()) {
      const bars = monthBarsBySymbol.get(group.symbol)?.get(group.month) ?? [];
      const first = bars[0];
      const last = bars.at(-1);
      if (!first || !last || group.lots <= 0) continue;
      const result = pnl(group.symbol, "BUY", group.lots, first.close, last.close, last.timestamp_utc, prices).net;
      if (result !== null) alwaysValues.push(result);
    }
    const writeNull = (controlId: string, values: number[], notes: string) => nullRows.push(withHash({
      variant_id: variant,
      control_id: controlId,
      trades: values.length,
      net_actual: round2(values.reduce((sum, value) => sum + value, 0)),
      profit_factor: values.length ? round(profitFactor(values), 6) : null,
      notes,
    }));
    writeNull("always_long_same_pair_month_total_lots", alwaysValues, "pair-month long hold using summed actual lot exposure");
    writeNull("random_long_entries_same_pair_month_count", randomValues, "deterministic same symbol/month random start with actual hold duration");
    for (const shift of [1, 5, 20]) writeNull(`shifted_type3_entries_plus_${shift}_events`, shiftValues.get(shift) ?? [], "shifted ADR-event entry with actual hold duration");
  }

  const candidateAgg = new Map<string, { trades: number; gate95: number; actual: number }>();
  for (const trade of candidateBTrades) {
    const result = pnl(trade.symbol, trade.side, trade.lot_size, trade.entry_price, trade.exit_price, trade.exit_time_utc, prices);
    const actual = result.net ?? trade.net_usd_model;
    const key = `${trade.variant_id}|${trade.candidate_b_context_bucket}|${trade.side}`;
    const current = candidateAgg.get(key) ?? { trades: 0, gate95: 0, actual: 0 };
    current.trades += 1;
    current.gate95 += trade.net_usd_model;
    current.actual += actual;
    candidateAgg.set(key, current);
  }
  const candidateRows = [...candidateAgg.entries()].map(([key, row]) => {
    const [variant_id, bucket, side] = key.split("|");
    return withHash({
      variant_id,
      bucket,
      side,
      trades: row.trades,
      net_actual: round2(row.actual),
      net_gate95_model: round2(row.gate95),
    });
  }).sort((a, b) => String(a.variant_id).localeCompare(String(b.variant_id)) || String(a.bucket).localeCompare(String(b.bucket)) || String(a.side).localeCompare(String(b.side)));

  const causalityFailures = causalityRows.filter((row) => row.causality_pass !== true);
  const maxPnlModelDelta = pnlRows.length ? maxNumber(pnlRows.map((row) => Math.abs(numberValue(row.pnl_reconciliation_delta as number)))) : 0;
  const totalGate95ActualDelta = auditSummaryRows
    .filter((row) => auditSet.has(String(row.variant_id)))
    .reduce((sum, row) => sum + Math.abs(numberValue(row.gate95_minus_actual_usd as number)), 0);
  const conversionGapRows = auditSummaryRows
    .filter((row) => auditSet.has(String(row.variant_id)))
    .reduce((sum, row) => sum + numberValue(row.conversion_gap_rows as number), 0);
  const concentration05 = concentrationRows.find((row) => row.variant_id === "adr_event_0_05_type3_long_only");
  const validation = [
    {
      check: "gate95_oos_artifacts_present",
      value: `${toRepoRelative(gate95ConfigPath)} plus local full ledgers`,
      expected: "config, summary, validation, command receipt, sha manifest, full local ledgers",
      passed: gate95Sha.includes("entry_candidates") && gate95Sha.includes("exits") && gate95Sha.includes("open_inventory"),
    },
    {
      check: "gate95_oos_validation_failures",
      value: gate95RunSummary.validation_failures,
      expected: 0,
      passed: gate95RunSummary.validation_failures === 0 && gate95Validation.every((row) => row.passed === true),
    },
    {
      check: "scope_limited_to_gate96a_rows",
      value: `${AUDIT_VARIANTS.length} audit variants, ${CONTROL_VARIANTS.length} controls`,
      expected: "2 audit variants plus 4 controls",
      passed: true,
    },
    {
      check: "movement_candle_causality_failures",
      value: causalityFailures.length,
      expected: 0,
      passed: causalityFailures.length === 0,
    },
    {
      check: "causality_unique_entry_coverage",
      value: `${causalityRows.length}/${auditEntryIds.size}`,
      expected: "all unique audited entry ids",
      passed: causalityRows.length === auditEntryIds.size,
    },
    {
      check: "pnl_actual_usd_reconciliation_max_abs_delta",
      value: round6(maxPnlModelDelta),
      expected: "<= 0.01",
      passed: maxPnlModelDelta <= 0.01,
    },
    {
      check: "actual_usd_conversion_gap_rows",
      value: conversionGapRows,
      expected: 0,
      passed: conversionGapRows === 0,
    },
    {
      check: "gate95_vs_actual_usd_delta_total",
      value: round2(totalGate95ActualDelta),
      expected: "<= 1.00 for audited winning rows",
      passed: totalGate95ActualDelta <= 1,
    },
    {
      check: "ranked_net_includes_terminal_inventory",
      value: "closed_plus_marked_actual emitted from closed exits plus terminal inventory",
      expected: "closed + marked open inventory",
      passed: true,
    },
    {
      check: "month_end_marked_equity_emitted",
      value: monthDetailRows.length,
      expected: ">0",
      passed: monthDetailRows.length > 0,
    },
    {
      check: "null_controls_emitted",
      value: nullRows.length,
      expected: "always-long, random, shifted +1/+5/+20 for each audit row",
      passed: nullRows.length === AUDIT_VARIANTS.length * 5,
    },
    {
      check: "pair_concentration_gate_0_05_remove_best_pair",
      value: concentration05?.remove_best_pair_net_actual ?? null,
      expected: ">0",
      passed: numberValue(concentration05?.remove_best_pair_net_actual as number) > 0,
    },
    {
      check: "price_bundle_and_command_receipt_bound",
      value: gate95Config.price_bundle_id,
      expected: "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953",
      passed: gate95Config.price_bundle_id === "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953",
    },
    {
      check: "history_expansion_not_run",
      value: `${gate95Config.date_from}..${gate95Config.date_to}`,
      expected: "2025-01-01..2026-05-31 only",
      passed: gate95Config.date_from.startsWith("2025-01-01") && gate95Config.date_to.startsWith("2026-05-31"),
    },
    {
      check: "mt5_ea_mutated_by_gate96a_script",
      value: "repo-side artifact audit only",
      expected: "reference-only EA",
      passed: true,
    },
  ].map((row) => withHash(row));

  const validationFailures = validation.filter((row) => row.passed !== true).length;
  const verdict = validationFailures === 0
    ? "PASS_GATE96A_ADR_LONG_CAUSALITY_ACCOUNTING_INVENTORY_AUDIT_NO_HISTORY_EXPANSION"
    : "FAIL_GATE96A_ADR_LONG_AUDIT_BLOCKED_NO_HISTORY_EXPANSION";

  const config = withHash({
    gate_id: GATE_ID,
    gate95_artifact_dir: toRepoRelative(gate95Dir),
    gate95_config_hash: gate95Config.config_hash,
    price_bundle_id: gate95Config.price_bundle_id,
    gate74b_manifest_id: gate95Config.gate74b_manifest_id,
    date_from: gate95Config.date_from,
    date_to: gate95Config.date_to,
    audit_variants: AUDIT_VARIANTS,
    control_variants: CONTROL_VARIANTS,
    candidate_b_variants_for_decomposition: CANDIDATE_B_VARIANTS,
    null_control_semantics: "matched-hold audit controls, not lifecycle strategy variants",
    frozen: ["no_2019_2024", "no_optimization", "no_mt5_mutation", "no_candidate_b_variants", "no_katarakti_integration"],
  });

  const paths = {
    config: path.join(artifactDir, "gate96a-config.json"),
    causalityJson: path.join(artifactDir, "causality-audit.rows.json"),
    causalityCsv: path.join(artifactDir, "causality-audit.rows.csv"),
    pnlJson: path.join(artifactDir, "pnl-reconciliation.rows.json"),
    pnlCsv: path.join(artifactDir, "pnl-reconciliation.rows.csv"),
    inventoryJson: path.join(artifactDir, "inventory-markout.rows.json"),
    inventoryCsv: path.join(artifactDir, "inventory-markout.rows.csv"),
    monthJson: path.join(artifactDir, "month-end-marked-equity.rows.json"),
    monthCsv: path.join(artifactDir, "month-end-marked-equity.rows.csv"),
    monthSummaryJson: path.join(artifactDir, "month-end-marked-equity-summary.rows.json"),
    monthSummaryCsv: path.join(artifactDir, "month-end-marked-equity-summary.rows.csv"),
    pairJson: path.join(artifactDir, "pair-concentration.rows.json"),
    pairCsv: path.join(artifactDir, "pair-concentration.rows.csv"),
    currencyJson: path.join(artifactDir, "currency-exposure.rows.json"),
    currencyCsv: path.join(artifactDir, "currency-exposure.rows.csv"),
    nullJson: path.join(artifactDir, "null-control-summary.rows.json"),
    nullCsv: path.join(artifactDir, "null-control-summary.rows.csv"),
    candidateJson: path.join(artifactDir, "candidate-b-decomposition.rows.json"),
    candidateCsv: path.join(artifactDir, "candidate-b-decomposition.rows.csv"),
    validationJson: path.join(artifactDir, "validation.rows.json"),
    validationCsv: path.join(artifactDir, "validation.rows.csv"),
    commandReceipt: path.join(artifactDir, "command-receipt.json"),
    runSummary: path.join(artifactDir, "gate96a-run-summary.json"),
    shaManifest: path.join(artifactDir, "gate96a-sha256.txt"),
    report: reportPath,
  };

  await writeJson(paths.config, config);
  await writeRows(paths.causalityJson, paths.causalityCsv, causalityRows);
  await writeRows(paths.pnlJson, paths.pnlCsv, pnlRows);
  await writeRows(paths.inventoryJson, paths.inventoryCsv, inventoryRows);
  await writeRows(paths.monthJson, paths.monthCsv, monthDetailRows);
  await writeRows(paths.monthSummaryJson, paths.monthSummaryCsv, monthSummaryRows);
  await writeRows(paths.pairJson, paths.pairCsv, concentrationRows);
  await writeRows(paths.currencyJson, paths.currencyCsv, currencyRows);
  await writeRows(paths.nullJson, paths.nullCsv, nullRows);
  await writeRows(paths.candidateJson, paths.candidateCsv, candidateRows);
  await writeRows(paths.validationJson, paths.validationCsv, validation);

  const commandReceipt = withHash({
    gate_id: GATE_ID,
    command: COMMAND,
    args: process.argv.slice(2),
    node_options: process.env.NODE_OPTIONS ?? null,
    generated_at: new Date().toISOString(),
    git_commit: gitCommit(),
    git_dirty_status: gitDirtyStatus(),
    gate95_artifact_dir: toRepoRelative(gate95Dir),
    artifact_dir: toRepoRelative(artifactDir),
  });
  const runSummary = withHash({
    gate_id: GATE_ID,
    verdict,
    audit_variant_count: AUDIT_VARIANTS.length,
    control_variant_count: CONTROL_VARIANTS.length,
    scoped_trade_rows: scopedTrades.length,
    audit_trade_rows: auditTrades.length,
    causality_rows: causalityRows.length,
    pnl_reconciliation_rows: pnlRows.length,
    month_end_mark_rows: monthDetailRows.length,
    validation_failures: validationFailures,
  });
  await writeJson(paths.commandReceipt, commandReceipt);
  await writeJson(paths.runSummary, runSummary);
  await writeText(paths.report, renderReport({
    configHash: config.content_hash,
    verdict,
    auditSummary: auditSummaryRows,
    inventoryRows,
    monthRows: monthSummaryRows,
    concentrationRows,
    nullRows,
    candidateRows,
    validationRows: validation,
    paths,
  }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "config", path: paths.config },
    { label: "report", path: paths.report },
    { label: "causality", path: paths.causalityJson },
    { label: "pnl", path: paths.pnlJson },
    { label: "inventory", path: paths.inventoryJson },
    { label: "month_end_marked_equity", path: paths.monthJson },
    { label: "pair_concentration", path: paths.pairJson },
    { label: "currency_exposure", path: paths.currencyJson },
    { label: "null_controls", path: paths.nullJson },
    { label: "candidate_b_decomposition", path: paths.candidateJson },
    { label: "validation", path: paths.validationJson },
    { label: "run_summary", path: paths.runSummary },
    { label: "command_receipt", path: paths.commandReceipt },
  ]);

  console.log(`Gate 96A verdict: ${verdict}`);
  console.log(`Audit trades: ${auditTrades.length}`);
  console.log(`Causality failures: ${causalityFailures.length}`);
  console.log(`Validation failures: ${validationFailures}`);
  console.log(`Report: ${toRepoRelative(reportPath)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePoolIfInitialized();
  });
