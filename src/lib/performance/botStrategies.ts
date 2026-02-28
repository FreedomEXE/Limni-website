/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: botStrategies.ts
 *
 * Description:
 * Fetches aggregated performance summaries for all bot strategies
 * (Bitget Perp, Katarakti) for display on the main Performance page.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { queryOne } from "@/lib/db";
import type { StrategySummary } from "@/components/performance/StrategyPerformanceSummary";

type TradeAgg = {
  total_trades: number | string;
  wins: number | string;
  total_pnl: number | string;
};

async function safeQueryOne<T>(
  sql: string,
  params?: readonly unknown[],
): Promise<T | null> {
  try {
    return await queryOne<T>(sql, params);
  } catch {
    return null;
  }
}

type StrategyConfig = {
  name: string;
  href: string;
  status: StrategySummary["status"];
  table: "bitget_trades" | "katarakti_trades";
  botId: string;
};

const STRATEGY_CONFIGS: readonly StrategyConfig[] = [
  {
    name: "Crypto Perp Bot (Bitget)",
    href: "/automation/bots/bitget",
    status: "LIVE",
    table: "bitget_trades",
    botId: "bitget_perp_v2",
  },
  {
    name: "Katarakti (MT5 Forex)",
    href: "/automation/bots/mt5-forex",
    status: "LIVE",
    table: "katarakti_trades",
    botId: "katarakti_v1",
  },
];

async function readTradeAggregateForStrategy(
  config: StrategyConfig,
): Promise<TradeAgg | null> {
  return safeQueryOne<TradeAgg>(
    `SELECT
       COUNT(*)::int AS total_trades,
       COUNT(*) FILTER (WHERE pnl_usd > 0)::int AS wins,
       COALESCE(SUM(pnl_usd), 0)::double precision AS total_pnl
     FROM ${config.table}
     WHERE bot_id = $1
       AND exit_time_utc IS NOT NULL`,
    [config.botId],
  );
}

type StrategyAggregateResult = {
  config: StrategyConfig;
  aggregate: TradeAgg | null;
};

function hasAggregate(
  entry: StrategyAggregateResult,
): entry is StrategyAggregateResult & { aggregate: TradeAgg } {
  return entry.aggregate !== null;
}

export async function readBotStrategySummaries(): Promise<StrategySummary[]> {
  const aggregates: StrategyAggregateResult[] = await Promise.all(
    STRATEGY_CONFIGS.map(async (config) => ({
      config,
      aggregate: await readTradeAggregateForStrategy(config),
    })),
  );

  return aggregates
    .filter(hasAggregate)
    .map(({ config, aggregate }) => ({
      name: config.name,
      href: config.href,
      totalTrades: Number(aggregate.total_trades) || 0,
      wins: Number(aggregate.wins) || 0,
      totalPnlUsd: Number(aggregate.total_pnl) || 0,
      maxDrawdownPct: null,
      status: config.status,
    }));
}
