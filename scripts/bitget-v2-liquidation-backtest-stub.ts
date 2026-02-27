/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitget-v2-liquidation-backtest-stub.ts
 *
 * Description:
 * Research scaffold for comparing baseline (fixed milestones) vs
 * liquidation-aware advisory logic using stored heatmap snapshots.
 *
 * NOTE:
 * This is a stub harness. It does not alter live strategy behavior.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { getPool, query } from "../src/lib/db";
import { readNearestLiquidationHeatmapSnapshot } from "../src/lib/marketSnapshots";
import { buildLiquidationAdvisory } from "../src/lib/bitgetLiquidationFeatures";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";

type ClosedTradeRow = {
  id: number;
  symbol: string;
  direction: Direction;
  entry_time_utc: string;
  exit_time_utc: string;
  entry_price: number;
  exit_price: number | null;
  pnl_usd: number | null;
};

type BacktestConfig = {
  limit: number;
  interval: string;
  exchangeGroup: string;
  opposingThreshold: number;
  outputPath: string;
};

type TradeFeature = {
  tradeId: number;
  symbol: string;
  direction: Direction;
  entryTimeUtc: string;
  snapshotTimeUtc: string | null;
  directionalFuelUsd: number;
  opposingRiskUsd: number;
  fuelRiskRatio: number;
  skipSuggested: boolean;
  milestonePriceHints: number[];
  baselinePnlUsd: number;
};

type Summary = {
  tradesEvaluated: number;
  tradesMissingHeatmap: number;
  totalBaselinePnlUsd: number;
  totalLiquidationAwarePnlUsd: number;
  skippedTrades: number;
  keptTrades: number;
  avgFuelRiskRatio: number;
};

function parseArgs(): BacktestConfig {
  const args = process.argv.slice(2);
  const byKey = new Map<string, string>();

  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...valueParts] = arg.slice(2).split("=");
    byKey.set(rawKey, valueParts.join("="));
  }

  const limit = Number.parseInt(byKey.get("limit") ?? "500", 10);
  const threshold = Number.parseFloat(byKey.get("opposing-threshold") ?? "1.2");
  const output = byKey.get("out")?.trim() || "reports/bitget-liquidation-backtest-stub.json";

  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500,
    interval: byKey.get("interval")?.trim() || "1d",
    exchangeGroup: byKey.get("exchange-group")?.trim() || "binance_bybit",
    opposingThreshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 1.2,
    outputPath: output,
  };
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asIsoUtc(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return value;
  }
  return "";
}

function normalizeDirection(value: unknown): Direction | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if (upper === "LONG" || upper === "SHORT") return upper;
  return null;
}

function round(value: number, decimals = 2): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

async function loadClosedTrades(limit: number): Promise<ClosedTradeRow[]> {
  const rows = await query<{
    id: unknown;
    symbol: unknown;
    direction: unknown;
    entry_time_utc: unknown;
    exit_time_utc: unknown;
    entry_price: unknown;
    exit_price: unknown;
    pnl_usd: unknown;
  }>(
    `SELECT id, symbol, direction, entry_time_utc, exit_time_utc, entry_price, exit_price, pnl_usd
       FROM bitget_bot_trades
      WHERE exit_time_utc IS NOT NULL
      ORDER BY entry_time_utc DESC
      LIMIT $1`,
    [limit],
  );

  return rows
    .map((row) => {
      const direction = normalizeDirection(row.direction);
      const id = asNumber(row.id);
      const entryPrice = asNumber(row.entry_price);
      if (!direction || id === null || !entryPrice) return null;

      return {
        id,
        symbol: String(row.symbol ?? "").toUpperCase(),
        direction,
        entry_time_utc: asIsoUtc(row.entry_time_utc),
        exit_time_utc: asIsoUtc(row.exit_time_utc),
        entry_price: entryPrice,
        exit_price: asNumber(row.exit_price),
        pnl_usd: asNumber(row.pnl_usd),
      } satisfies ClosedTradeRow;
    })
    .filter((row): row is ClosedTradeRow => Boolean(row));
}

function buildFeature(
  trade: ClosedTradeRow,
  snapshot: Awaited<ReturnType<typeof readNearestLiquidationHeatmapSnapshot>>,
  opposingThreshold: number,
): TradeFeature {
  const baselinePnl = trade.pnl_usd ?? 0;
  if (!snapshot) {
    return {
      tradeId: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      entryTimeUtc: trade.entry_time_utc,
      snapshotTimeUtc: null,
      directionalFuelUsd: 0,
      opposingRiskUsd: 0,
      fuelRiskRatio: 0,
      skipSuggested: false,
      milestonePriceHints: [],
      baselinePnlUsd: baselinePnl,
    };
  }

  const advisory = buildLiquidationAdvisory(snapshot, trade.direction, {
    opposingThreshold,
  });

  return {
    tradeId: trade.id,
    symbol: trade.symbol,
    direction: trade.direction,
    entryTimeUtc: trade.entry_time_utc,
    snapshotTimeUtc: snapshot.snapshot_time_utc,
    directionalFuelUsd: round(advisory.directional_fuel_usd, 2),
    opposingRiskUsd: round(advisory.opposing_risk_usd, 2),
    fuelRiskRatio: round(advisory.fuel_risk_ratio, 4),
    skipSuggested: advisory.skip_suggested,
    milestonePriceHints: advisory.milestone_hints.map((hint) => round(hint.price_level, 2)),
    baselinePnlUsd: round(baselinePnl, 2),
  };
}

function summarize(features: TradeFeature[]): Summary {
  const totalBaselinePnlUsd = features.reduce((sum, feature) => sum + feature.baselinePnlUsd, 0);
  const kept = features.filter((feature) => !feature.skipSuggested);
  const skipped = features.length - kept.length;
  const liquidationAwarePnl = kept.reduce((sum, feature) => sum + feature.baselinePnlUsd, 0);
  const missing = features.filter((feature) => !feature.snapshotTimeUtc).length;
  const avgRatio =
    features.length === 0
      ? 0
      : features.reduce((sum, feature) => sum + feature.fuelRiskRatio, 0) / features.length;

  return {
    tradesEvaluated: features.length,
    tradesMissingHeatmap: missing,
    totalBaselinePnlUsd: round(totalBaselinePnlUsd, 2),
    totalLiquidationAwarePnlUsd: round(liquidationAwarePnl, 2),
    skippedTrades: skipped,
    keptTrades: kept.length,
    avgFuelRiskRatio: round(avgRatio, 4),
  };
}

async function main() {
  const config = parseArgs();

  console.log("[liq-backtest-stub] Config:", config);
  const trades = await loadClosedTrades(config.limit);
  console.log(`[liq-backtest-stub] Loaded ${trades.length} closed trades.`);

  if (trades.length === 0) {
    throw new Error("No closed trades found in bitget_bot_trades.");
  }

  const features: TradeFeature[] = [];
  for (const trade of trades) {
    const symbolBase = trade.symbol.replace("USDT", "").trim().toUpperCase();
    const snapshot = await readNearestLiquidationHeatmapSnapshot({
      symbol: symbolBase,
      atUtc: trade.entry_time_utc,
      interval: config.interval,
      exchangeGroup: config.exchangeGroup,
      maxAgeMinutes: 360,
    });
    features.push(buildFeature(trade, snapshot, config.opposingThreshold));
  }

  const output = {
    generated_utc: new Date().toISOString(),
    config,
    summary: summarize(features),
    sample: features.slice(0, 50),
    notes: [
      "Stub result: liquidation-aware PnL only simulates skip decisions; it does not yet simulate dynamic leverage scaling or adaptive exits.",
      "Next step: plug milestone hints into trade path replay to estimate scaling-specific PnL impact.",
    ],
  };

  const absoluteOutput = path.resolve(process.cwd(), config.outputPath);
  mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  writeFileSync(absoluteOutput, JSON.stringify(output, null, 2), "utf8");
  console.log(`[liq-backtest-stub] Report written to ${absoluteOutput}`);

  await getPool().end();
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[liq-backtest-stub] fatal:", message);
  try {
    await getPool().end();
  } catch {
    // no-op
  }
  process.exitCode = 1;
});
