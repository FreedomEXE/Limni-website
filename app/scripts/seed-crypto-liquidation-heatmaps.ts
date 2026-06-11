/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: seed-crypto-liquidation-heatmaps.ts
 *
 * Description:
 * Seeds 1d CoinAnk liquidation heatmaps for the active Bitget USDT-M
 * futures universe so the crypto matrix can show liquidation context
 * beyond BTC/ETH.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { fetchBitgetMarketContracts } from "../src/lib/bitget";
import { fetchLiquidationHeatmap } from "../src/lib/coinank";
import { getPool, query } from "../src/lib/db";
import { storeLiquidationHeatmapSnapshot } from "../src/lib/marketSnapshots";

loadEnvConfig(process.cwd());

const EXCHANGE_GROUP = "binance_bybit";
const INTERVAL = "1d";
const CONCURRENCY = 4;

type ExistingRow = {
  symbol: string;
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value).trim().toUpperCase()).filter(Boolean))).sort();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const contracts = await fetchBitgetMarketContracts();
  const activeSymbols = uniqueSorted(
    contracts
      .filter((contract) => contract.symbol.endsWith("USDT"))
      .filter((contract) => String(contract.symbolStatus ?? "").toLowerCase() === "normal")
      .map((contract) => contract.baseCoin),
  );

  const existing = await query<ExistingRow>(
    `SELECT DISTINCT symbol
       FROM market_liquidation_heatmap_snapshots
      WHERE interval = $1
        AND exchange_group = $2
        AND snapshot_time_utc >= NOW() - INTERVAL '6 hours'`,
    [INTERVAL, EXCHANGE_GROUP],
  );
  const existingSet = new Set(existing.map((row) => String(row.symbol).toUpperCase()));

  const targets = activeSymbols.filter((symbol) => !existingSet.has(symbol));
  let inserted = 0;
  let unchanged = 0;
  const errors: string[] = [];

  await mapWithConcurrency(targets, CONCURRENCY, async (symbol) => {
    try {
      const heatmap = await fetchLiquidationHeatmap(symbol, {
        interval: INTERVAL,
        exchanges: ["Binance", "Bybit"],
        includeNodes: true,
      });
      const stored = await storeLiquidationHeatmapSnapshot({
        symbol,
        interval: INTERVAL,
        exchangeGroup: EXCHANGE_GROUP,
        heatmap,
      });
      if (stored) {
        inserted += 1;
      } else {
        unchanged += 1;
      }
    } catch (error) {
      errors.push(`${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  console.log(
    JSON.stringify(
      {
        interval: INTERVAL,
        exchangeGroup: EXCHANGE_GROUP,
        activeSymbols: activeSymbols.length,
        attempted: targets.length,
        skippedFresh: activeSymbols.length - targets.length,
        inserted,
        unchanged,
        errors: errors.slice(0, 50),
        errorCount: errors.length,
      },
      null,
      2,
    ),
  );

  await getPool().end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  try {
    await getPool().end();
  } catch {
    // no-op
  }
  process.exitCode = 1;
});
