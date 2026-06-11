/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyBacktestIngestion.ts
 *
 * Description:
 * Shared ingestion contract for strategy backtest DB persistence.
 * Validates bot/variant/market consistency against registry metadata
 * and provides a single persistence entrypoint for backtest scripts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type {
  BacktestSnapshotUpsertInput,
  BacktestSnapshotUpsertResult,
} from "@/lib/performance/strategyBacktestStore";
import { upsertStrategyBacktestSnapshot } from "@/lib/performance/strategyBacktestStore";
import { listPerformanceStrategyEntries } from "@/lib/performance/strategyRegistry";

type RegisteredContract = {
  botId: string;
  variant: string;
  market: string;
  entryId: string;
};

type IngestionLogger = Pick<Console, "log" | "warn" | "error">;

export type PersistBacktestSnapshotOptions = {
  context: string;
  snapshot: BacktestSnapshotUpsertInput;
  logger?: IngestionLogger;
};

export type PersistBacktestSnapshotResult =
  | {
      status: "persisted";
      result: BacktestSnapshotUpsertResult;
    }
  | {
      status: "skipped";
      reason: string;
    };

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildRegisteredContracts(): Map<string, RegisteredContract[]> {
  const byBotId = new Map<string, RegisteredContract[]>();
  for (const entry of listPerformanceStrategyEntries()) {
    const botId = normalizeText(entry.backtestBotId);
    const variant = normalizeText(entry.backtestVariant);
    const market = normalizeText(entry.backtestMarket);
    if (!botId || !variant || !market) {
      continue;
    }
    const rows = byBotId.get(botId) ?? [];
    rows.push({
      botId,
      variant,
      market,
      entryId: entry.entryId,
    });
    byBotId.set(botId, rows);
  }
  return byBotId;
}

const CONTRACTS_BY_BOT_ID = buildRegisteredContracts();

export function assertBacktestSnapshotContract(snapshot: BacktestSnapshotUpsertInput) {
  const botId = normalizeText(snapshot.run.botId);
  const variant = normalizeText(snapshot.run.variant);
  const market = normalizeText(snapshot.run.market);

  const contracts = CONTRACTS_BY_BOT_ID.get(botId) ?? [];
  if (contracts.length === 0) {
    throw new Error(
      `Backtest ingestion contract missing for bot_id=${botId}. Add a registry entry with backtestBotId/backtestVariant/backtestMarket before persisting.`,
    );
  }
  const matched = contracts.find(
    (contract) => contract.variant === variant && contract.market === market,
  );
  if (!matched) {
    const expected = contracts
      .map((contract) => `${contract.variant}/${contract.market}`)
      .join(", ");
    throw new Error(
      `Backtest ingestion contract mismatch for bot_id=${botId}: got ${variant}/${market}, expected one of [${expected}].`,
    );
  }
}

export async function persistStrategyBacktestSnapshot(
  options: PersistBacktestSnapshotOptions,
): Promise<PersistBacktestSnapshotResult> {
  const logger = options.logger ?? console;
  if (!process.env.DATABASE_URL) {
    const reason = "DATABASE_URL is not configured";
    logger.log(`[${options.context}] DB upsert skipped: ${reason}.`);
    return {
      status: "skipped",
      reason,
    };
  }

  assertBacktestSnapshotContract(options.snapshot);
  const result = await upsertStrategyBacktestSnapshot(options.snapshot);
  logger.log(
    `[${options.context}] DB upsert complete: run_id=${result.runId}, weekly=${result.weeklyUpserted}, trades=${result.tradesInserted}`,
  );
  return {
    status: "persisted",
    result,
  };
}
