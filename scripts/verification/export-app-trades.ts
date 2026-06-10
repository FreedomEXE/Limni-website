/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-app-trades.ts
 *
 * Description:
 * Exports canonical app-side ADR Grid + Pair Fill Cap ledger rows for
 * TradingView indicator parity verification.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { getPool, query } from "@/lib/db";

loadEnvConfig(process.cwd());

type AnchorType = "canonical" | "execution";
type SystemId = "tiered" | "tandem";
type RowKind = "grid" | "fill";

type TradeRow = {
  trade_id: string;
  strategy_variant: string;
  anchor_type: AnchorType;
  symbol: string;
  direction: "LONG" | "SHORT" | null;
  source_model: string | null;
  tier: number | null;
  week_open_utc: Date | string;
  entry_utc: Date | string | null;
  exit_utc: Date | string | null;
  entry_price: string | number | null;
  exit_price: string | number | null;
  raw_pct: string | number | null;
  adr_normalized_pct: string | number | null;
  adr_pct: string | number | null;
  exit_reason: string | null;
  parent_trade_id: string | null;
  fill_seq: number | null;
  active_fills_at_entry: number | null;
  cap_threshold_at_entry: number | null;
  cap_violated: boolean;
};

type VerificationRow = {
  source: "app";
  system: SystemId;
  strategyVariant: string;
  anchorType: AnchorType;
  weekOpenUtc: string;
  rowKind: RowKind;
  gridKey: string;
  parentTradeId: string | null;
  tradeId: string;
  pair: string;
  direction: "LONG" | "SHORT" | null;
  sourceModel: string | null;
  tier: number | null;
  fillSeq: number | null;
  entryUtc: string | null;
  exitUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  returnRawPct: number | null;
  returnAdrNormalizedPct: number | null;
  adrPct: number | null;
  exitReason: string | null;
  activeFillsAtEntry: number | null;
  capThresholdAtEntry: number | null;
  capViolated: boolean;
};

type WeeklyTotal = {
  system: SystemId;
  strategyVariant: string;
  weekOpenUtc: string;
  gridCount: number;
  fillCount: number;
  returnRawPct: number;
  returnAdrNormalizedPct: number | null;
};

const SYSTEM_VARIANTS: Record<SystemId, string> = {
  tiered: "tiered_4w-adr_grid-pair_fill_cap",
  tandem: "tandem-adr_grid-pair_fill_cap",
};

const CSV_COLUMNS = [
  "source",
  "system",
  "strategyVariant",
  "anchorType",
  "weekOpenUtc",
  "rowKind",
  "gridKey",
  "parentTradeId",
  "tradeId",
  "pair",
  "direction",
  "sourceModel",
  "tier",
  "fillSeq",
  "entryUtc",
  "exitUtc",
  "entryPrice",
  "exitPrice",
  "returnRawPct",
  "returnAdrNormalizedPct",
  "adrPct",
  "exitReason",
  "activeFillsAtEntry",
  "capThresholdAtEntry",
  "capViolated",
] as const;

const INDICATOR_TEMPLATE_COLUMNS = [
  "source",
  "system",
  "strategyVariant",
  "anchorType",
  "weekOpenUtc",
  "rowKind",
  "gridKey",
  "pair",
  "direction",
  "sourceModel",
  "tier",
  "fillSeq",
  "entryUtc",
  "exitUtc",
  "entryPrice",
  "exitPrice",
  "returnRawPct",
  "returnAdrNormalizedPct",
  "adrPct",
  "exitReason",
  "activeFillsAtEntry",
  "capThresholdAtEntry",
] as const;

let usedDbPool = false;

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parseList(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSystems(): SystemId[] {
  const value = argValue("system") ?? "all";
  if (value === "all") return ["tiered", "tandem"];
  const systems = value.split(",").map((item) => item.trim()).filter(Boolean);
  for (const system of systems) {
    if (system !== "tiered" && system !== "tandem") {
      throw new Error(`Unsupported --system value "${system}". Use tiered, tandem, or all.`);
    }
  }
  return systems as SystemId[];
}

function parseAnchor(): AnchorType {
  const value = argValue("anchor") ?? "execution";
  if (value !== "execution" && value !== "canonical") {
    throw new Error(`Unsupported --anchor value "${value}". Use execution or canonical.`);
  }
  return value;
}

function normalizeIso(value: Date | string | null) {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function numberOrNull(value: string | number | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function systemFromVariant(strategyVariant: string): SystemId {
  return strategyVariant.startsWith("tiered_4w-") ? "tiered" : "tandem";
}

function parentGridKey(row: Pick<VerificationRow, "weekOpenUtc" | "system" | "sourceModel" | "tier" | "pair" | "direction">) {
  return [
    row.weekOpenUtc,
    row.system,
    row.sourceModel ?? "",
    row.tier ?? "",
    row.pair,
    row.direction ?? "",
  ].join("|");
}

function toVerificationRow(row: TradeRow): VerificationRow {
  const system = systemFromVariant(row.strategy_variant);
  const weekOpenUtc = normalizeIso(row.week_open_utc)!;
  const base = {
    source: "app" as const,
    system,
    strategyVariant: row.strategy_variant,
    anchorType: row.anchor_type,
    weekOpenUtc,
    rowKind: row.parent_trade_id ? "fill" as const : "grid" as const,
    parentTradeId: row.parent_trade_id,
    tradeId: row.trade_id,
    pair: row.symbol,
    direction: row.direction,
    sourceModel: row.source_model,
    tier: row.tier,
    fillSeq: row.fill_seq,
    entryUtc: normalizeIso(row.entry_utc),
    exitUtc: normalizeIso(row.exit_utc),
    entryPrice: numberOrNull(row.entry_price),
    exitPrice: numberOrNull(row.exit_price),
    returnRawPct: numberOrNull(row.raw_pct),
    returnAdrNormalizedPct: numberOrNull(row.adr_normalized_pct),
    adrPct: numberOrNull(row.adr_pct),
    exitReason: row.exit_reason,
    activeFillsAtEntry: row.active_fills_at_entry,
    capThresholdAtEntry: row.cap_threshold_at_entry,
    capViolated: row.cap_violated,
  };
  return {
    ...base,
    gridKey: parentGridKey(base),
  };
}

function rowSort(left: VerificationRow, right: VerificationRow) {
  return (
    left.weekOpenUtc.localeCompare(right.weekOpenUtc) ||
    left.system.localeCompare(right.system) ||
    (left.sourceModel ?? "").localeCompare(right.sourceModel ?? "") ||
    (left.tier ?? -1) - (right.tier ?? -1) ||
    left.pair.localeCompare(right.pair) ||
    (left.direction ?? "").localeCompare(right.direction ?? "") ||
    (left.rowKind === right.rowKind ? 0 : left.rowKind === "grid" ? -1 : 1) ||
    (left.fillSeq ?? Number.MAX_SAFE_INTEGER) - (right.fillSeq ?? Number.MAX_SAFE_INTEGER) ||
    (left.entryUtc ?? "").localeCompare(right.entryUtc ?? "")
  );
}

function formatNumber(value: number | null) {
  return value === null ? "" : String(Number(value.toFixed(8)));
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "number" ? formatNumber(value) : String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll("\"", "\"\"")}"` : raw;
}

function toCsv(rows: VerificationRow[]) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function indicatorTemplateCsv() {
  return `${INDICATOR_TEMPLATE_COLUMNS.join(",")}\n`;
}

function weeklyTotals(rows: VerificationRow[]): WeeklyTotal[] {
  const groups = new Map<string, VerificationRow[]>();
  for (const row of rows) {
    const key = `${row.system}|${row.strategyVariant}|${row.weekOpenUtc}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.values())
    .map((group) => {
      const first = group[0]!;
      const gridRows = group.filter((row) => row.rowKind === "grid");
      const fillRows = group.filter((row) => row.rowKind === "fill");
      const adrValues = gridRows
        .map((row) => row.returnAdrNormalizedPct)
        .filter((value): value is number => value !== null);
      return {
        system: first.system,
        strategyVariant: first.strategyVariant,
        weekOpenUtc: first.weekOpenUtc,
        gridCount: gridRows.length,
        fillCount: fillRows.length,
        returnRawPct: gridRows.reduce((sum, row) => sum + (row.returnRawPct ?? 0), 0),
        returnAdrNormalizedPct: adrValues.length === gridRows.length
          ? adrValues.reduce((sum, value) => sum + value, 0)
          : null,
      };
    })
    .sort((left, right) => (
      left.weekOpenUtc.localeCompare(right.weekOpenUtc) ||
      left.system.localeCompare(right.system)
    ));
}

async function loadRows(systems: SystemId[], anchorType: AnchorType) {
  usedDbPool = true;
  const variants = systems.map((system) => SYSTEM_VARIANTS[system]);
  const clauses = [
    "origin = 'backtest'",
    "strategy_family = 'adr_grid'",
    "strategy_variant = ANY($1::text[])",
    "anchor_type = $2",
  ];
  const params: unknown[] = [variants, anchorType];
  const week = argValue("week");
  const fromWeek = argValue("from-week") ?? week;
  const toWeek = argValue("to-week") ?? week;
  const symbols = parseList(argValue("symbols") ?? argValue("symbol"))
    .map((symbol) => symbol.toUpperCase());
  if (fromWeek) {
    params.push(fromWeek);
    clauses.push(`week_open_utc >= $${params.length}::timestamptz`);
  }
  if (toWeek) {
    params.push(toWeek);
    clauses.push(`week_open_utc <= $${params.length}::timestamptz`);
  }
  if (symbols.length > 0) {
    params.push(symbols);
    clauses.push(`symbol = ANY($${params.length}::text[])`);
  }

  const rows = await query<TradeRow>(
    `SELECT trade_id::text AS trade_id, strategy_variant, anchor_type, symbol,
            direction, source_model, tier, week_open_utc, entry_utc, exit_utc,
            entry_price, exit_price, raw_pct, adr_normalized_pct, adr_pct,
            exit_reason, parent_trade_id::text AS parent_trade_id, fill_seq,
            active_fills_at_entry, cap_threshold_at_entry, cap_violated
       FROM trades
      WHERE ${clauses.join(" AND ")}
      ORDER BY week_open_utc ASC, strategy_variant ASC, symbol ASC, source_model ASC NULLS FIRST,
               tier ASC NULLS FIRST, direction ASC NULLS FIRST, parent_trade_id ASC NULLS FIRST,
               fill_seq ASC NULLS FIRST, entry_utc ASC NULLS FIRST`,
    params,
  );
  return rows.map(toVerificationRow).sort(rowSort);
}

async function main() {
  const systems = parseSystems();
  const anchorType = parseAnchor();
  const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? "reports/data-verification/app");
  const rows = await loadRows(systems, anchorType);
  const generatedAtUtc = new Date().toISOString();
  const slug = `${systems.join("-")}-${anchorType}`;
  const jsonPath = path.join(outDir, `${slug}-app-trades.json`);
  const csvPath = path.join(outDir, `${slug}-app-trades.csv`);
  const templatePath = path.join(outDir, `${slug}-indicator-template.csv`);
  const totals = weeklyTotals(rows);

  await mkdir(outDir, { recursive: true });
  await writeFile(jsonPath, JSON.stringify({
    schemaVersion: 1,
    generatedAtUtc,
    source: "app",
    systems,
    strategyVariants: systems.map((system) => SYSTEM_VARIANTS[system]),
    anchorType,
    filters: {
      week: argValue("week"),
      fromWeek: argValue("from-week"),
      toWeek: argValue("to-week"),
      symbols: parseList(argValue("symbols") ?? argValue("symbol")).map((symbol) => symbol.toUpperCase()),
    },
    counts: {
      rows: rows.length,
      grids: rows.filter((row) => row.rowKind === "grid").length,
      fills: rows.filter((row) => row.rowKind === "fill").length,
    },
    weeklyTotals: totals,
    allTimeTotals: systems.map((system) => {
      const systemTotals = totals.filter((total) => total.system === system);
      const adrTotals = systemTotals
        .map((total) => total.returnAdrNormalizedPct)
        .filter((value): value is number => value !== null);
      return {
        system,
        strategyVariant: SYSTEM_VARIANTS[system],
        weeks: systemTotals.length,
        gridCount: systemTotals.reduce((sum, total) => sum + total.gridCount, 0),
        fillCount: systemTotals.reduce((sum, total) => sum + total.fillCount, 0),
        returnRawPct: systemTotals.reduce((sum, total) => sum + total.returnRawPct, 0),
        returnAdrNormalizedPct: adrTotals.length === systemTotals.length
          ? adrTotals.reduce((sum, value) => sum + value, 0)
          : null,
      };
    }),
    rows,
  }, null, 2));
  await writeFile(csvPath, toCsv(rows));
  if (hasFlag("template")) {
    await writeFile(templatePath, indicatorTemplateCsv());
  }

  console.log(`[verification] Exported ${rows.length} app rows`);
  console.log(`[verification] JSON: ${jsonPath}`);
  console.log(`[verification] CSV:  ${csvPath}`);
  if (hasFlag("template")) console.log(`[verification] Indicator template: ${templatePath}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!usedDbPool) return;
    try {
      await getPool().end();
    } catch {
      // No pool was created, or shutdown is already in progress.
    }
  });
