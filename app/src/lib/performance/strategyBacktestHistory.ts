/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyBacktestHistory.ts
 *
 * Description:
 * Read helpers for strategy_backtest_runs / strategy_backtest_weekly /
 * strategy_backtest_trades. Provides DB-first series loading and
 * latest-run coverage snapshots for Performance and Research surfaces.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query } from "@/lib/db";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

const STRATEGY_BACKTEST_HISTORY_CACHE_TTL_MS = Number(
  process.env.STRATEGY_BACKTEST_HISTORY_CACHE_TTL_MS ?? "15000",
);

function getStrategyBacktestHistoryCacheTtlMs() {
  if (
    Number.isFinite(STRATEGY_BACKTEST_HISTORY_CACHE_TTL_MS)
    && STRATEGY_BACKTEST_HISTORY_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(STRATEGY_BACKTEST_HISTORY_CACHE_TTL_MS);
  }
  return 15000;
}

function toFinite(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toPositiveInt(value: unknown, fallback = 0) {
  const numeric = toFinite(value, fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.trunc(numeric));
}

function toIsoUtc(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
}

type StrategyBacktestRunRow = {
  id: unknown;
  bot_id: unknown;
  variant: unknown;
  market: unknown;
  generated_utc: unknown;
};

type StrategyBacktestWeeklyRow = {
  week_open_utc: unknown;
  return_pct: unknown;
  trades: unknown;
  wins: unknown;
  drawdown_pct: unknown;
  gross_profit_pct: unknown;
  gross_loss_pct: unknown;
};

export type BacktestComparisonWeeklyRow = {
  week_open_utc: string;
  return_percent: number;
  priced_trades: number;
  wins: number;
  trade_returns: number[];
  week_max_drawdown: number | null;
  gross_profit_pct: number | null;
  gross_loss_pct: number | null;
};

export type StrategyBacktestWeeklySeries = {
  runId: number;
  botId: string;
  variant: string;
  market: string;
  generatedUtc: string | null;
  sourcePath: string;
  requestedWeek: string | null;
  fellBackToAllTime: boolean;
  rows: BacktestComparisonWeeklyRow[];
};

export type StrategyBacktestLatestRun = {
  runId: number;
  botId: string;
  variant: string;
  market: string;
  generatedUtc: string | null;
  weeklyCount: number;
  tradeCount: number;
  latestWeekOpenUtc: string | null;
};

export async function readStrategyBacktestWeeklySeries(options: {
  botId: string;
  variant: string;
  market: string;
  configKey?: string | null;
  requestedWeek?: string | null;
  fallbackToAllTime?: boolean;
}): Promise<StrategyBacktestWeeklySeries | null> {
  const key = `performance:strategyBacktestWeeklySeries:${options.botId}:${options.variant}:${options.market}:${options.configKey ?? ""}:${options.requestedWeek ?? ""}:${options.fallbackToAllTime === false ? "strict" : "fallback"}`;
  return getOrSetRuntimeCache(key, getStrategyBacktestHistoryCacheTtlMs(), async () => {
    const botId = options.botId.trim();
    const variant = options.variant.trim();
    const market = options.market.trim();
    if (!botId || !variant || !market) return null;

    const runQueryBase =
      `SELECT id, bot_id, variant, market, generated_utc
       FROM strategy_backtest_runs
       WHERE bot_id = $1
         AND variant = $2
         AND market = $3`;
    const runRows = options.configKey && options.configKey.trim().length > 0
      ? await query<StrategyBacktestRunRow>(
          `${runQueryBase}
           AND config_key = $4
           ORDER BY generated_utc DESC, id DESC
           LIMIT 1`,
          [botId, variant, market, options.configKey.trim()],
        )
      : await query<StrategyBacktestRunRow>(
          `${runQueryBase}
           ORDER BY generated_utc DESC, id DESC
           LIMIT 1`,
          [botId, variant, market],
        );
    if (runRows.length === 0) return null;

    const run = runRows[0];
    const runId = toPositiveInt(run.id, 0);
    if (runId <= 0) return null;

    const weeklyRowsRaw = await query<StrategyBacktestWeeklyRow>(
      `SELECT
         week_open_utc,
         return_pct,
         trades,
         wins,
         drawdown_pct,
         gross_profit_pct,
         gross_loss_pct
       FROM strategy_backtest_weekly
       WHERE run_id = $1
       ORDER BY week_open_utc ASC`,
      [runId],
    );
    if (weeklyRowsRaw.length === 0) return null;

    const weeklyRows = weeklyRowsRaw.flatMap((row) => {
      const weekIso = toIsoUtc(row.week_open_utc);
      if (!weekIso) return [];
      return [{
        week_open_utc: weekIso,
        return_percent: toFinite(row.return_pct, 0),
        priced_trades: toPositiveInt(row.trades, 0),
        wins: toPositiveInt(row.wins, 0),
        trade_returns: [] as number[],
        week_max_drawdown: toFinite(row.drawdown_pct, Number.NaN),
        gross_profit_pct: toFinite(row.gross_profit_pct, Number.NaN),
        gross_loss_pct: toFinite(row.gross_loss_pct, Number.NaN),
      }];
    });
    if (weeklyRows.length === 0) return null;

    const requestedWeek = options.requestedWeek
      ? normalizeWeekOpenUtc(options.requestedWeek) ?? options.requestedWeek
      : null;
    let rows = weeklyRows;
    let fellBackToAllTime = false;
    if (requestedWeek) {
      const filtered = weeklyRows.filter((row) => {
        const canonical = normalizeWeekOpenUtc(row.week_open_utc) ?? row.week_open_utc;
        return canonical === requestedWeek;
      });
      if (filtered.length > 0 || options.fallbackToAllTime === false) {
        rows = filtered;
      } else {
        rows = weeklyRows;
        fellBackToAllTime = true;
      }
    }

    return {
      runId,
      botId: typeof run.bot_id === "string" ? run.bot_id : botId,
      variant: typeof run.variant === "string" ? run.variant : variant,
      market: typeof run.market === "string" ? run.market : market,
      generatedUtc: toIsoUtc(run.generated_utc),
      sourcePath: `db:strategy_backtest_runs:${runId}`,
      requestedWeek,
      fellBackToAllTime,
      rows,
    };
  });
}

type StrategyBacktestLatestRunRow = {
  id: unknown;
  bot_id: unknown;
  variant: unknown;
  market: unknown;
  generated_utc: unknown;
  weekly_count: unknown;
  trade_count: unknown;
  latest_week_open_utc: unknown;
};

export async function listLatestStrategyBacktestRuns(): Promise<StrategyBacktestLatestRun[]> {
  const key = "performance:strategyBacktestLatestRuns";
  return getOrSetRuntimeCache(key, getStrategyBacktestHistoryCacheTtlMs(), async () => {
    const rows = await query<StrategyBacktestLatestRunRow>(
      `SELECT DISTINCT ON (r.bot_id, r.variant, r.market)
         r.id,
         r.bot_id,
         r.variant,
         r.market,
         r.generated_utc,
         COALESCE(w.weekly_count, 0) AS weekly_count,
         COALESCE(w.trade_count, 0) AS trade_count,
         w.latest_week_open_utc
       FROM strategy_backtest_runs r
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS weekly_count,
           COALESCE(SUM(trades), 0)::int AS trade_count,
           MAX(week_open_utc) AS latest_week_open_utc
         FROM strategy_backtest_weekly
         WHERE run_id = r.id
       ) w ON true
       ORDER BY r.bot_id, r.variant, r.market, r.generated_utc DESC, r.id DESC`,
    );

    return rows.flatMap((row) => {
      const runId = toPositiveInt(row.id, 0);
      const botId = typeof row.bot_id === "string" ? row.bot_id : "";
      const variant = typeof row.variant === "string" ? row.variant : "";
      const market = typeof row.market === "string" ? row.market : "";
      if (runId <= 0 || !botId || !variant || !market) return [];
      return [{
        runId,
        botId,
        variant,
        market,
        generatedUtc: toIsoUtc(row.generated_utc),
        weeklyCount: toPositiveInt(row.weekly_count, 0),
        tradeCount: toPositiveInt(row.trade_count, 0),
        latestWeekOpenUtc: toIsoUtc(row.latest_week_open_utc),
      }];
    });
  });
}
