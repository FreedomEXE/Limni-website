/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyBacktestStore.ts
 *
 * Description:
 * Canonical persistence helpers for strategy backtest runs, weekly
 * aggregates, and trade-level rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { transaction } from "@/lib/db";

export type BacktestRunUpsertInput = {
  botId: string;
  variant: string;
  market: string;
  strategyName?: string | null;
  carryMode?: string | null;
  stopMode?: string | null;
  adrMultiplier?: number | null;
  universalMode?: string | null;
  backtestWeeks?: number | null;
  offsetPct?: number | null;
  slotMode?: string | null;
  positionAllocationPct?: number | null;
  generatedUtc?: string | null;
  configKey?: string | null;
  configJson?: Record<string, unknown> | null;
};

export type BacktestWeeklyUpsertRow = {
  weekOpenUtc: string;
  returnPct: number;
  trades?: number;
  wins?: number;
  losses?: number;
  stopHits?: number;
  drawdownPct?: number;
  grossProfitPct?: number;
  grossLossPct?: number;
  equityEndPct?: number | null;
  pnlUsd?: number | null;
};

export type BacktestTradeInsertRow = {
  weekOpenUtc: string;
  symbol: string;
  direction: string;
  entryTimeUtc?: string | null;
  exitTimeUtc?: string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  pnlPct?: number | null;
  pnlUsd?: number | null;
  exitReason?: string | null;
  maxMilestone?: number | null;
  leverageAtExit?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type BacktestSnapshotUpsertInput = {
  run: BacktestRunUpsertInput;
  weekly: BacktestWeeklyUpsertRow[];
  trades?: BacktestTradeInsertRow[];
};

export type BacktestSnapshotUpsertResult = {
  runId: number;
  weeklyUpserted: number;
  tradesInserted: number;
};

type PreparedWeeklyRow = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  stopHits: number;
  drawdownPct: number;
  grossProfitPct: number;
  grossLossPct: number;
  equityEndPct: number | null;
  pnlUsd: number | null;
};

type PreparedTradeRow = {
  weekOpenUtc: string;
  symbol: string;
  direction: string;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  pnlPct: number | null;
  pnlUsd: number | null;
  exitReason: string | null;
  maxMilestone: number | null;
  leverageAtExit: number | null;
  metadataJson: string;
};

const UPSERT_BATCH_SIZE = 250;

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFinite(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normalizeInteger(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((left, right) => left.localeCompare(right));
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(obj[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function resolveConfigKey(run: BacktestRunUpsertInput) {
  const explicit = normalizeText(run.configKey);
  if (explicit) return explicit;
  const derived = {
    carry_mode: normalizeText(run.carryMode) ?? "",
    stop_mode: normalizeText(run.stopMode) ?? "",
    universal_mode: normalizeText(run.universalMode) ?? "",
    adr_multiplier: normalizeFinite(run.adrMultiplier) ?? "",
    backtest_weeks: normalizeInteger(run.backtestWeeks) ?? "",
    offset_pct: normalizeFinite(run.offsetPct) ?? "",
    slot_mode: normalizeText(run.slotMode) ?? "",
    position_allocation_pct: normalizeFinite(run.positionAllocationPct) ?? "",
    config_json: run.configJson ?? {},
  };
  return stableSerialize(derived);
}

function chunkRows<T>(rows: T[], size = UPSERT_BATCH_SIZE): T[][] {
  const chunkSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : UPSERT_BATCH_SIZE;
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    out.push(rows.slice(i, i + chunkSize));
  }
  return out;
}

function prepareWeeklyRows(rows: BacktestWeeklyUpsertRow[]): PreparedWeeklyRow[] {
  return rows.flatMap((row) => {
    const weekOpenUtc = normalizeText(row.weekOpenUtc);
    const returnPct = normalizeFinite(row.returnPct);
    if (!weekOpenUtc || returnPct === null) return [];
    return [{
      weekOpenUtc,
      returnPct,
      trades: normalizeInteger(row.trades) ?? 0,
      wins: normalizeInteger(row.wins) ?? 0,
      losses: normalizeInteger(row.losses) ?? 0,
      stopHits: normalizeInteger(row.stopHits) ?? 0,
      drawdownPct: normalizeFinite(row.drawdownPct) ?? 0,
      grossProfitPct: normalizeFinite(row.grossProfitPct) ?? 0,
      grossLossPct: normalizeFinite(row.grossLossPct) ?? 0,
      equityEndPct: normalizeFinite(row.equityEndPct),
      pnlUsd: normalizeFinite(row.pnlUsd),
    }];
  });
}

function prepareTradeRows(rows: BacktestTradeInsertRow[]): PreparedTradeRow[] {
  return rows.flatMap((row) => {
    const weekOpenUtc = normalizeText(row.weekOpenUtc);
    const symbol = normalizeText(row.symbol);
    const direction = normalizeText(row.direction);
    if (!weekOpenUtc || !symbol || !direction) return [];
    return [{
      weekOpenUtc,
      symbol,
      direction,
      entryTimeUtc: normalizeText(row.entryTimeUtc),
      exitTimeUtc: normalizeText(row.exitTimeUtc),
      entryPrice: normalizeFinite(row.entryPrice),
      exitPrice: normalizeFinite(row.exitPrice),
      pnlPct: normalizeFinite(row.pnlPct),
      pnlUsd: normalizeFinite(row.pnlUsd),
      exitReason: normalizeText(row.exitReason),
      maxMilestone: normalizeInteger(row.maxMilestone),
      leverageAtExit: normalizeFinite(row.leverageAtExit),
      metadataJson: JSON.stringify(row.metadata ?? {}),
    }];
  });
}

export async function upsertStrategyBacktestSnapshot(
  input: BacktestSnapshotUpsertInput,
): Promise<BacktestSnapshotUpsertResult> {
  const botId = normalizeText(input.run.botId);
  const variant = normalizeText(input.run.variant);
  const market = normalizeText(input.run.market);
  if (!botId) {
    throw new Error("upsertStrategyBacktestSnapshot: run.botId is required");
  }
  if (!variant) {
    throw new Error("upsertStrategyBacktestSnapshot: run.variant is required");
  }
  if (!market) {
    throw new Error("upsertStrategyBacktestSnapshot: run.market is required");
  }
  const generatedUtc = normalizeText(input.run.generatedUtc) ?? new Date().toISOString();
  const configJson = input.run.configJson ?? {};
  const configKey = resolveConfigKey(input.run);
  const preparedWeeklyRows = prepareWeeklyRows(input.weekly);
  const preparedTradeRows = prepareTradeRows(input.trades ?? []);

  return transaction(async (client) => {
    const runResult = await client.query<{ id: number | string }>(
      `INSERT INTO strategy_backtest_runs (
         bot_id,
         variant,
         market,
         strategy_name,
         carry_mode,
         stop_mode,
         adr_multiplier,
         universal_mode,
         backtest_weeks,
         offset_pct,
         slot_mode,
         position_allocation_pct,
         config_key,
         config_json,
         generated_utc,
         updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14::jsonb, $15::timestamptz, NOW()
       )
       ON CONFLICT (bot_id, variant, market, config_key)
       DO UPDATE SET
         strategy_name = EXCLUDED.strategy_name,
         carry_mode = EXCLUDED.carry_mode,
         stop_mode = EXCLUDED.stop_mode,
         adr_multiplier = EXCLUDED.adr_multiplier,
         universal_mode = EXCLUDED.universal_mode,
         backtest_weeks = EXCLUDED.backtest_weeks,
         offset_pct = EXCLUDED.offset_pct,
         slot_mode = EXCLUDED.slot_mode,
         position_allocation_pct = EXCLUDED.position_allocation_pct,
         config_json = EXCLUDED.config_json,
         generated_utc = EXCLUDED.generated_utc,
         updated_at = NOW()
       RETURNING id`,
      [
        botId,
        variant,
        market,
        normalizeText(input.run.strategyName),
        normalizeText(input.run.carryMode),
        normalizeText(input.run.stopMode),
        normalizeFinite(input.run.adrMultiplier),
        normalizeText(input.run.universalMode),
        normalizeInteger(input.run.backtestWeeks),
        normalizeFinite(input.run.offsetPct),
        normalizeText(input.run.slotMode),
        normalizeFinite(input.run.positionAllocationPct),
        configKey,
        JSON.stringify(configJson),
        generatedUtc,
      ],
    );
    const runId = Number(runResult.rows[0]?.id);
    if (!Number.isFinite(runId)) {
      throw new Error("upsertStrategyBacktestSnapshot: failed to resolve run_id");
    }

    let weeklyUpserted = 0;
    for (const batch of chunkRows(preparedWeeklyRows)) {
      const params: unknown[] = [];
      const valuesSql = batch
        .map((row, index) => {
          const offset = index * 12;
          params.push(
            runId,
            row.weekOpenUtc,
            row.returnPct,
            row.trades,
            row.wins,
            row.losses,
            row.stopHits,
            row.drawdownPct,
            row.grossProfitPct,
            row.grossLossPct,
            row.equityEndPct,
            row.pnlUsd,
          );
          return `($${offset + 1}, $${offset + 2}::timestamptz, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, NOW())`;
        })
        .join(", ");
      await client.query(
        `INSERT INTO strategy_backtest_weekly (
           run_id,
           week_open_utc,
           return_pct,
           trades,
           wins,
           losses,
           stop_hits,
           drawdown_pct,
           gross_profit_pct,
           gross_loss_pct,
           equity_end_pct,
           pnl_usd,
           updated_at
         )
         VALUES ${valuesSql}
         ON CONFLICT (run_id, week_open_utc)
         DO UPDATE SET
           return_pct = EXCLUDED.return_pct,
           trades = EXCLUDED.trades,
           wins = EXCLUDED.wins,
           losses = EXCLUDED.losses,
           stop_hits = EXCLUDED.stop_hits,
           drawdown_pct = EXCLUDED.drawdown_pct,
           gross_profit_pct = EXCLUDED.gross_profit_pct,
           gross_loss_pct = EXCLUDED.gross_loss_pct,
           equity_end_pct = EXCLUDED.equity_end_pct,
           pnl_usd = EXCLUDED.pnl_usd,
           updated_at = NOW()`,
        params,
      );
      weeklyUpserted += batch.length;
    }

    await client.query("DELETE FROM strategy_backtest_trades WHERE run_id = $1", [runId]);
    let tradesInserted = 0;
    for (const batch of chunkRows(preparedTradeRows)) {
      const params: unknown[] = [];
      const valuesSql = batch
        .map((row, index) => {
          const offset = index * 14;
          params.push(
            runId,
            row.weekOpenUtc,
            row.symbol,
            row.direction,
            row.entryTimeUtc,
            row.exitTimeUtc,
            row.entryPrice,
            row.exitPrice,
            row.pnlPct,
            row.pnlUsd,
            row.exitReason,
            row.maxMilestone,
            row.leverageAtExit,
            row.metadataJson,
          );
          return `($${offset + 1}, $${offset + 2}::timestamptz, $${offset + 3}, $${offset + 4}, $${offset + 5}::timestamptz, $${offset + 6}::timestamptz, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}::jsonb)`;
        })
        .join(", ");
      await client.query(
        `INSERT INTO strategy_backtest_trades (
           run_id,
           week_open_utc,
           symbol,
           direction,
           entry_time_utc,
           exit_time_utc,
           entry_price,
           exit_price,
           pnl_pct,
           pnl_usd,
           exit_reason,
           max_milestone,
           leverage_at_exit,
           metadata
         )
         VALUES ${valuesSql}`,
        params,
      );
      tradesInserted += batch.length;
    }

    return {
      runId,
      weeklyUpserted,
      tradesInserted,
    };
  });
}
