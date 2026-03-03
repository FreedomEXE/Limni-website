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
import {
  readKataraktiMarketSnapshots,
  readKataraktiMarketSnapshotsByVariant,
} from "@/lib/performance/kataraktiHistory";

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
  market: StrategySummary["market"];
  name: string;
  href: string;
  status: StrategySummary["status"];
  fallbackTable: "bitget_bot_trades" | "katarakti_trades";
  botId: string;
};

const STRATEGY_CONFIGS: readonly StrategyConfig[] = [
  {
    market: "crypto_futures",
    name: "Katarakti (Bitget)",
    href: "/automation/bots/bitget",
    status: "LIVE",
    fallbackTable: "bitget_bot_trades",
    botId: "bitget_perp_v2",
  },
  {
    market: "crypto_futures",
    name: "Katarakti v3 (Liq Sweep)",
    href: "/automation/bots/bitget-v3",
    status: "BACKTEST",
    fallbackTable: "bitget_bot_trades",
    botId: "katarakti_v3_liq_sweep",
  },
  {
    market: "mt5_forex",
    name: "Katarakti (CFD)",
    href: "/automation/bots/mt5-forex",
    status: "LIVE",
    fallbackTable: "katarakti_trades",
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
     FROM ${config.fallbackTable}
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
  const [snapshotsByMarket, v3SnapshotsByMarket] = await Promise.all([
    readKataraktiMarketSnapshots(),
    readKataraktiMarketSnapshotsByVariant("v3"),
  ]);
  const resolveSnapshotForConfig = (config: StrategyConfig) => {
    if (config.botId === "katarakti_v3_liq_sweep") {
      return v3SnapshotsByMarket.crypto_futures;
    }
    return snapshotsByMarket[config.market];
  };
  const snapshotSummaries = STRATEGY_CONFIGS
    .map((config) => {
      const snapshot = resolveSnapshotForConfig(config);
      if (!snapshot) return null;
      return {
        market: config.market,
        name: config.name,
        href: config.href,
        totalTrades: snapshot.totalTrades,
        wins: snapshot.wins,
        totalPnlUsd: snapshot.totalPnlUsd,
        maxDrawdownPct: snapshot.maxDrawdownPct,
        status: config.status,
      } satisfies StrategySummary;
    })
    .filter((entry): entry is StrategySummary => entry !== null);

  if (snapshotSummaries.length === STRATEGY_CONFIGS.length) {
    return snapshotSummaries;
  }

  const aggregates: StrategyAggregateResult[] = await Promise.all(
    STRATEGY_CONFIGS
      .filter((config) => !resolveSnapshotForConfig(config))
      .map(async (config) => ({
      config,
      aggregate: await readTradeAggregateForStrategy(config),
      })),
  );

  const fallbackSummaries = aggregates
    .filter(hasAggregate)
    .map(({ config, aggregate }) => ({
      market: config.market,
      name: config.name,
      href: config.href,
      totalTrades: Number(aggregate.total_trades) || 0,
      wins: Number(aggregate.wins) || 0,
      totalPnlUsd: Number(aggregate.total_pnl) || 0,
      maxDrawdownPct: null,
      status: config.status,
    }));

  const fallbackByMarket = new Map(
    fallbackSummaries.map((summary) => [summary.market, summary] as const),
  );
  const snapshotByMarket = new Map(
    snapshotSummaries.map((summary) => [summary.market, summary] as const),
  );

  return STRATEGY_CONFIGS
    .map((config) => snapshotByMarket.get(config.market) ?? fallbackByMarket.get(config.market) ?? null)
    .filter((summary): summary is StrategySummary => summary !== null);
}
