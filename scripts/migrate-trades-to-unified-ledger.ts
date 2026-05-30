/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: migrate-trades-to-unified-ledger.ts
 *
 * Description:
 * Idempotently migrates current strategy artifact shards into the universal
 * trade ledger. Legacy scanner and bot tables remain untouched.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getPool, query } from "@/lib/db";
import { deriveLegacyTradeIdWithoutDirectionV1, deriveTradeId } from "@/lib/trades/tradeIdentity";
import type { AnchorType, TradeDirection, TradeNaturalKey, TradeOrigin } from "@/lib/trades/tradeTypes";
import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";

type ShardRow = {
  selection_key: string;
  week_open_utc: Date;
  engine_version: string;
  week_result_json: WeeklyHoldResult;
};

type PairReturnRow = {
  symbol: string;
  period_open_utc: Date;
  anchor_type: AnchorType;
  return_pct: string | number;
  open_price: string | number;
  close_price: string | number;
  window_open_utc: Date | null;
  window_close_utc: Date | null;
  anchor_version: string;
};

type LedgerRow = {
  tradeId: string;
  legacyTradeId: string;
  origin: TradeOrigin;
  strategyFamily: string;
  strategyVariant: string;
  engineVersion: string;
  anchorType: AnchorType;
  anchorVersion: string;
  symbol: string;
  assetClass: string;
  direction: TradeDirection | null;
  sourceModel: string | null;
  tier: number | null;
  weekOpenUtc: string;
  entryUtc: string | null;
  exitUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  rawPct: number | null;
  adrNormalizedPct: number | null;
  adrPct: number | null;
  weight: number | null;
  exitReason: string | null;
  parentTradeId: string | null;
  fillSeq: number | null;
  activeFillsAtEntry: number | null;
  capThresholdAtEntry: number | null;
  liveTradeId: string | null;
  warnings: string[];
};

const ENGINE_VERSION_PREFIX = process.env.TRADE_LEDGER_ENGINE_VERSION_PREFIX ?? "strategy-artifact-v27";
const PAIR_FILL_CAP_THRESHOLD = 3;

function normalizeIso(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function numberOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function directionMultiplier(direction: TradeDirection) {
  return direction === "LONG" ? 1 : -1;
}

function parseSelectionKey(selectionKey: string) {
  const [strategyId = "unknown", family = "weekly_hold", overlay = "none"] = selectionKey.split(":");
  return {
    strategyId,
    strategyFamily: family,
    riskOverlay: overlay,
    strategyVariant: `${strategyId}-${family}-${overlay}`,
  };
}

function naturalKeyFor(row: Omit<LedgerRow, "tradeId" | "legacyTradeId">): TradeNaturalKey {
  return {
    origin: row.origin,
    strategyFamily: row.strategyFamily,
    strategyVariant: row.strategyVariant,
    engineVersion: row.engineVersion,
    anchorType: row.anchorType,
    anchorVersion: row.anchorVersion,
    symbol: row.symbol,
    direction: row.direction,
    weekOpenUtc: row.weekOpenUtc,
    sourceModel: row.sourceModel,
    tier: row.tier,
    parentTradeId: row.parentTradeId,
    fillSeq: row.fillSeq,
  };
}

function withTradeId(
  row: Omit<LedgerRow, "tradeId" | "legacyTradeId">,
  legacyParentTradeId?: string | null,
): LedgerRow {
  const key = naturalKeyFor(row);
  const legacyKey = {
    ...key,
    parentTradeId: legacyParentTradeId ?? key.parentTradeId,
  };
  return {
    ...row,
    tradeId: deriveTradeId(key),
    legacyTradeId: deriveLegacyTradeIdWithoutDirectionV1(legacyKey),
  };
}

function pairReturnKey(symbol: string, weekOpenUtc: string, anchorType: AnchorType) {
  return `${symbol.toUpperCase()}|${normalizeIso(weekOpenUtc)}|${anchorType}`;
}

async function loadPairReturnMap(shards: ShardRow[]) {
  const weeks = Array.from(new Set(shards.map((shard) => normalizeIso(shard.week_open_utc))));
  if (weeks.length === 0) return new Map<string, PairReturnRow>();
  const rows = await query<PairReturnRow>(
    `SELECT symbol,
            period_open_utc,
            anchor_type,
            return_pct,
            open_price,
            close_price,
            window_open_utc,
            window_close_utc,
            anchor_version
       FROM pair_period_returns
      WHERE period_type = 'weekly'
        AND period_open_utc = ANY($1::timestamptz[])
        AND anchor_type IN ('canonical','execution')`,
    [weeks],
  );
  const map = new Map<string, PairReturnRow>();
  for (const row of rows) {
    map.set(pairReturnKey(row.symbol, normalizeIso(row.period_open_utc), row.anchor_type), row);
  }
  return map;
}

function adrNormalized(rawPct: number | null, adrPct: number | null) {
  if (rawPct === null || adrPct === null || Math.abs(adrPct) <= 1e-9) return null;
  return rawPct / adrPct;
}

function buildWeeklyHoldRows(
  shard: ShardRow,
  trade: WeeklyHoldTrade,
  pairReturns: Map<string, PairReturnRow>,
): LedgerRow[] {
  const selection = parseSelectionKey(shard.selection_key);
  const weekOpenUtc = normalizeIso(shard.week_open_utc);
  const sourceModel = trade.source ?? null;
  const tier = trade.tier ?? null;
  const adrPct = numberOrNull(trade.adrPct ?? trade.detail?.adrPct);
  const rows: LedgerRow[] = [];

  for (const anchorType of ["canonical", "execution"] as const) {
    const stored = pairReturns.get(pairReturnKey(trade.symbol, weekOpenUtc, anchorType));
    const rawMarketPct = numberOrNull(stored?.return_pct);
    const rawPct = rawMarketPct === null
      ? null
      : rawMarketPct * directionMultiplier(trade.direction) * (trade.weight ?? 1);
    const row = withTradeId({
      origin: "backtest",
      strategyFamily: selection.strategyFamily,
      strategyVariant: selection.strategyVariant,
      engineVersion: shard.engine_version,
      anchorType,
      anchorVersion: stored?.anchor_version ?? (anchorType === "execution" ? "execution_monday_utc_v1" : "canonical_weekly_v2"),
      symbol: trade.symbol.toUpperCase(),
      assetClass: trade.assetClass,
      direction: trade.direction,
      sourceModel,
      tier,
      weekOpenUtc,
      entryUtc: stored?.window_open_utc ? normalizeIso(stored.window_open_utc) : null,
      exitUtc: stored?.window_close_utc ? normalizeIso(stored.window_close_utc) : null,
      entryPrice: numberOrNull(stored?.open_price ?? trade.openPrice),
      exitPrice: numberOrNull(stored?.close_price ?? trade.closePrice),
      rawPct,
      adrNormalizedPct: adrNormalized(rawPct, adrPct),
      adrPct,
      weight: trade.weight ?? 1,
      exitReason: "week_close",
      parentTradeId: null,
      fillSeq: null,
      activeFillsAtEntry: null,
      capThresholdAtEntry: null,
      liveTradeId: null,
      warnings: stored ? [] : [`${anchorType}_weekly_return_missing`],
    });
    rows.push(row);
  }

  return rows;
}

function groupKeyForGridParent(trade: WeeklyHoldTrade) {
  return [
    trade.symbol.toUpperCase(),
    trade.assetClass,
    trade.direction,
    trade.source ?? "",
    trade.tier ?? "",
  ].join("|");
}

function computeActiveFillsAtEntry(
  priorRows: LedgerRow[],
  entryUtc: string | null,
) {
  if (!entryUtc) return null;
  const entryMs = Date.parse(entryUtc);
  if (!Number.isFinite(entryMs)) return null;
  return priorRows.filter((row) => {
    if (!row.entryUtc) return false;
    const priorEntryMs = Date.parse(row.entryUtc);
    const priorExitMs = row.exitUtc ? Date.parse(row.exitUtc) : Number.POSITIVE_INFINITY;
    return Number.isFinite(priorEntryMs) && priorEntryMs <= entryMs && priorExitMs > entryMs;
  }).length;
}

function buildAdrGridRows(shard: ShardRow): LedgerRow[] {
  const selection = parseSelectionKey(shard.selection_key);
  const weekOpenUtc = normalizeIso(shard.week_open_utc);
  const grouped = new Map<string, WeeklyHoldTrade[]>();
  for (const trade of shard.week_result_json.trades) {
    const key = groupKeyForGridParent(trade);
    grouped.set(key, [...(grouped.get(key) ?? []), trade]);
  }

  const rows: LedgerRow[] = [];
  for (const trades of grouped.values()) {
    const sorted = trades.slice().sort((left, right) => {
      const leftTime = left.detail?.entryTimeUtc ?? "";
      const rightTime = right.detail?.entryTimeUtc ?? "";
      if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
      return (left.detail?.tradeNumber ?? 0) - (right.detail?.tradeNumber ?? 0);
    });
    const first = sorted[0]!;
    const rawTotal = sorted.reduce((sum, trade) => sum + (trade.rawReturnPct ?? trade.returnPct), 0);
    const normalizedTotal = sorted.reduce((sum, trade) => sum + (trade.normalizedReturnPct ?? trade.returnPct), 0);
    const parent = withTradeId({
      origin: "backtest",
      strategyFamily: selection.strategyFamily,
      strategyVariant: selection.strategyVariant,
      engineVersion: shard.engine_version,
      anchorType: "execution",
      anchorVersion: "execution_monday_utc_v1",
      symbol: first.symbol.toUpperCase(),
      assetClass: first.assetClass,
      direction: first.direction,
      sourceModel: first.source ?? null,
      tier: first.tier ?? null,
      weekOpenUtc,
      entryUtc: sorted[0]?.detail?.entryTimeUtc ?? shard.week_result_json.executionWindowOpenUtc ?? null,
      exitUtc: sorted[sorted.length - 1]?.detail?.exitTimeUtc ?? shard.week_result_json.executionWindowCloseUtc ?? null,
      entryPrice: sorted[0]?.openPrice ?? null,
      exitPrice: sorted[sorted.length - 1]?.closePrice ?? null,
      rawPct: rawTotal,
      adrNormalizedPct: normalizedTotal,
      adrPct: numberOrNull(first.adrPct ?? first.detail?.adrPct),
      weight: sorted.reduce((sum, trade) => sum + (trade.weight ?? 1), 0),
      exitReason: "grid_parent",
      parentTradeId: null,
      fillSeq: null,
      activeFillsAtEntry: null,
      capThresholdAtEntry: null,
      liveTradeId: null,
      warnings: [],
    });
    rows.push(parent);

    const childRows: LedgerRow[] = [];
    sorted.forEach((trade, index) => {
      const capEnabled = selection.riskOverlay === "pair_fill_cap";
      const entryUtc = trade.detail?.entryTimeUtc ?? null;
      const child = withTradeId({
        origin: "backtest",
        strategyFamily: selection.strategyFamily,
        strategyVariant: selection.strategyVariant,
        engineVersion: shard.engine_version,
        anchorType: "execution",
        anchorVersion: "execution_monday_utc_v1",
        symbol: trade.symbol.toUpperCase(),
        assetClass: trade.assetClass,
        direction: trade.direction,
        sourceModel: trade.source ?? null,
        tier: trade.tier ?? null,
        weekOpenUtc,
        entryUtc,
        exitUtc: trade.detail?.exitTimeUtc ?? null,
        entryPrice: trade.openPrice,
        exitPrice: trade.closePrice,
        rawPct: trade.rawReturnPct ?? trade.returnPct,
        adrNormalizedPct: trade.normalizedReturnPct ?? trade.returnPct,
        adrPct: numberOrNull(trade.adrPct ?? trade.detail?.adrPct),
        weight: trade.weight ?? 1,
        exitReason: trade.detail?.exitReason ?? null,
        parentTradeId: parent.tradeId,
        fillSeq: index + 1,
        activeFillsAtEntry: capEnabled ? computeActiveFillsAtEntry(childRows, entryUtc) : null,
        capThresholdAtEntry: capEnabled ? PAIR_FILL_CAP_THRESHOLD : null,
        liveTradeId: null,
        warnings: [],
      }, parent.legacyTradeId);
      childRows.push(child);
    });
    rows.push(...childRows);
  }

  return rows;
}

async function readCurrentShards() {
  return query<ShardRow>(
    `SELECT selection_key, week_open_utc, engine_version, week_result_json
       FROM strategy_week_shards
      WHERE engine_version LIKE $1
      ORDER BY selection_key ASC, week_open_utc ASC`,
    [`${ENGINE_VERSION_PREFIX}%`],
  );
}

async function upsertLedgerRows(rows: LedgerRow[]) {
  let changedTradeIds = 0;
  const batchSize = 500;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const identityUpdates = batch.filter((row) => row.legacyTradeId !== row.tradeId);
    if (identityUpdates.length > 0) {
      const updateParams: unknown[] = [];
      const updateValues = identityUpdates.map((row) => {
        const base = updateParams.length;
        updateParams.push(row.tradeId, row.legacyTradeId, row.parentTradeId);
        return `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::uuid)`;
      });
      const updateResult = await query<{ changed: string }>(
        `WITH identity_updates(new_trade_id, legacy_trade_id, parent_trade_id) AS (
           VALUES ${updateValues.join(",")}
         ),
         updated AS (
           UPDATE trades t
              SET trade_id = identity_updates.new_trade_id,
                  parent_trade_id = identity_updates.parent_trade_id
             FROM identity_updates
            WHERE t.trade_id = identity_updates.legacy_trade_id
              AND NOT EXISTS (
                SELECT 1 FROM trades existing WHERE existing.trade_id = identity_updates.new_trade_id
              )
            RETURNING 1
         )
         SELECT COUNT(*)::text AS changed FROM updated`,
        updateParams,
      );
      changedTradeIds += Number(updateResult[0]?.changed ?? 0);
    }

    const params: unknown[] = [];
    const values = batch.map((row) => {
      const base = params.length;
      params.push(
        row.tradeId,
        row.origin,
        row.strategyFamily,
        row.strategyVariant,
        row.engineVersion,
        row.anchorType,
        row.anchorVersion,
        row.symbol,
        row.assetClass,
        row.direction,
        row.sourceModel,
        row.tier,
        row.weekOpenUtc,
        row.entryUtc,
        row.exitUtc,
        row.entryPrice,
        row.exitPrice,
        row.rawPct,
        row.adrNormalizedPct,
        row.adrPct,
        row.weight,
        row.exitReason,
        row.parentTradeId,
        row.fillSeq,
        row.activeFillsAtEntry,
        row.capThresholdAtEntry,
        row.liveTradeId,
        JSON.stringify(row.warnings),
      );
      return `($${base + 1}::uuid, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5},
        $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12},
        $${base + 13}::timestamptz, $${base + 14}::timestamptz, $${base + 15}::timestamptz, $${base + 16}, $${base + 17},
        $${base + 18}, $${base + 19}, $${base + 20}, $${base + 21}, $${base + 22},
        $${base + 23}::uuid, $${base + 24}, $${base + 25}, $${base + 26},
        $${base + 27}, $${base + 28}::jsonb)`;
    });

    await query(
      `INSERT INTO trades (
         trade_id, origin, strategy_family, strategy_variant, engine_version,
         anchor_type, anchor_version, symbol, asset_class, direction, source_model, tier,
         week_open_utc, entry_utc, exit_utc, entry_price, exit_price,
         raw_pct, adr_normalized_pct, adr_pct, weight, exit_reason,
         parent_trade_id, fill_seq, active_fills_at_entry, cap_threshold_at_entry,
         live_trade_id, warnings
       )
       VALUES ${values.join(",")}
       ON CONFLICT (trade_id)
       DO UPDATE SET
         origin = EXCLUDED.origin,
         strategy_family = EXCLUDED.strategy_family,
         strategy_variant = EXCLUDED.strategy_variant,
         engine_version = EXCLUDED.engine_version,
         anchor_type = EXCLUDED.anchor_type,
         anchor_version = EXCLUDED.anchor_version,
         symbol = EXCLUDED.symbol,
         asset_class = EXCLUDED.asset_class,
         direction = EXCLUDED.direction,
         source_model = EXCLUDED.source_model,
         tier = EXCLUDED.tier,
         week_open_utc = EXCLUDED.week_open_utc,
         entry_utc = EXCLUDED.entry_utc,
         exit_utc = EXCLUDED.exit_utc,
         entry_price = EXCLUDED.entry_price,
         exit_price = EXCLUDED.exit_price,
         raw_pct = EXCLUDED.raw_pct,
         adr_normalized_pct = EXCLUDED.adr_normalized_pct,
         adr_pct = EXCLUDED.adr_pct,
         weight = EXCLUDED.weight,
         exit_reason = EXCLUDED.exit_reason,
         parent_trade_id = EXCLUDED.parent_trade_id,
         fill_seq = EXCLUDED.fill_seq,
         active_fills_at_entry = EXCLUDED.active_fills_at_entry,
         cap_threshold_at_entry = EXCLUDED.cap_threshold_at_entry,
         live_trade_id = EXCLUDED.live_trade_id,
         warnings = EXCLUDED.warnings`,
      params,
    );
  }
  return { changedTradeIds };
}

function addCount(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

async function main() {
  const shards = await readCurrentShards();
  const pairReturns = await loadPairReturnMap(shards);
  const rows: LedgerRow[] = [];

  for (const shard of shards) {
    const selection = parseSelectionKey(shard.selection_key);
    if (selection.strategyFamily === "weekly_hold") {
      for (const trade of shard.week_result_json.trades) {
        rows.push(...buildWeeklyHoldRows(shard, trade, pairReturns));
      }
    } else if (selection.strategyFamily === "adr_grid") {
      rows.push(...buildAdrGridRows(shard));
    }
  }

  const migrationResult = await upsertLedgerRows(rows);

  const counts = new Map<string, number>();
  let warnings = 0;
  for (const row of rows) {
    addCount(counts, `${row.origin} × ${row.strategyFamily} × ${row.anchorType}`);
    if (row.warnings.length > 0) warnings += 1;
  }

  const capViolationRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM trades
      WHERE cap_violated
        AND strategy_variant LIKE '%pair_fill_cap%'`,
  );

  console.log("Universal trade ledger migration complete");
  console.log(`Source shards: ${shards.length}`);
  console.log(`Rows upserted: ${rows.length}`);
  console.log(`Trade UUIDs changed: ${migrationResult.changedTradeIds}`);
  for (const [key, value] of [...counts.entries()].sort()) {
    console.log(`- ${key}: ${value}`);
  }
  console.log(`Warnings: ${warnings}`);
  console.log(`Pair Fill Cap violations: ${capViolationRows[0]?.count ?? "0"}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
