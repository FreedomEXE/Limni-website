/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: weeklyReturnDisplay.ts
 *
 * Description:
 * Shared payload helper for weekly pair returns. It carries canonical and
 * execution raw returns together so UI surfaces can resolve display mode
 * without new backend calls.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";
import {
  getCanonicalWeeklyPairReturns,
  getExecutionWeeklyPairReturns,
} from "@/lib/pairReturns";
import { getAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";

type WeeklyReturnReaderRow = Awaited<ReturnType<typeof getCanonicalWeeklyPairReturns>>[number];

export type WeeklyReturnDisplay = {
  symbol: string;
  weekOpenUtc: string;
  canonical: { rawPct: number };
  execution: { rawPct: number } | null;
  adrPct: number;
  warnings?: string[];
};

export type WeeklyReturnDisplayRow = WeeklyReturnReaderRow & WeeklyReturnDisplay;

function keyFor(row: Pick<WeeklyReturnReaderRow, "assetClass" | "symbol">) {
  return `${row.assetClass}|${row.symbol.toUpperCase()}`;
}

export async function loadWeeklyReturnDisplayRows(
  weekOpenUtc: string,
  assetClass?: AssetClass,
): Promise<WeeklyReturnDisplayRow[]> {
  const [canonicalRows, executionRows, adrMap] = await Promise.all([
    getCanonicalWeeklyPairReturns(weekOpenUtc, assetClass),
    getExecutionWeeklyPairReturns(weekOpenUtc, assetClass),
    loadWeeklyAdrMap(weekOpenUtc),
  ]);
  const executionByKey = new Map(executionRows.map((row) => [keyFor(row), row]));

  return canonicalRows.map((canonicalRow) => {
    const executionRow = executionByKey.get(keyFor(canonicalRow)) ?? null;
    const warnings = executionRow ? undefined : ["execution_close_bar_missing"];
    return {
      ...canonicalRow,
      weekOpenUtc,
      canonical: { rawPct: canonicalRow.returnPct },
      execution: executionRow ? { rawPct: executionRow.returnPct } : null,
      adrPct: getAdrPct(adrMap, canonicalRow.symbol, canonicalRow.assetClass),
      warnings,
    };
  });
}

export function indexWeeklyReturnDisplayRows(rows: WeeklyReturnDisplayRow[]) {
  return new Map(rows.map((row) => [keyFor(row), row]));
}
