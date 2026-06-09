/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: executionPriceWindows.ts
 *
 * Description:
 * Execution-layer weekly window helpers. These preserve the canonical logical
 * week key while exposing the tradable window used by strategy execution.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import type { AssetClass } from "@/lib/cotMarkets";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type ExecutionAnchorVersion = "execution_ny_fri9_entry_fri11_close_v1" | "execution_ny_crypto_sun20_v2";

export const EXECUTION_ANCHOR_VERSION: ExecutionAnchorVersion = "execution_ny_fri9_entry_fri11_close_v1";

export type ExecutionWindow = {
  logicalWeekOpenUtc: string;
  windowOpenUtc: DateTime;
  entryCutoffUtc: DateTime;
  windowCloseUtc: DateTime;
  offsetHours: number;
  anchorVersion: ExecutionAnchorVersion;
};

const EXECUTION_WINDOW_OFFSET_HOURS: Record<AssetClass, number> = {
  fx: 1,
  indices: 1,
  commodities: 1,
  crypto: 0,
};

function parseLogicalWeek(logicalWeekOpenUtc: string) {
  const normalized = normalizeWeekOpenUtc(logicalWeekOpenUtc) ?? logicalWeekOpenUtc;
  const parsed = DateTime.fromISO(normalized, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid execution logical week open: ${logicalWeekOpenUtc}`);
  }
  return { normalized, parsed };
}

function getExecutionSundayNy(logicalWeekOpenUtc: string) {
  const { parsed } = parseLogicalWeek(logicalWeekOpenUtc);
  const nyWeek = parsed.setZone("America/New_York");
  const daysSinceSunday = nyWeek.weekday % 7;
  return nyWeek.minus({ days: daysSinceSunday }).startOf("day");
}

export function getExecutionWeekWindow(
  logicalWeekOpenUtc: string,
  assetClass: AssetClass,
): ExecutionWindow {
  const { normalized } = parseLogicalWeek(logicalWeekOpenUtc);
  const executionSundayNy = getExecutionSundayNy(normalized);
  const windowOpenUtc = executionSundayNy.set({
    hour: 20,
    minute: 0,
    second: 0,
    millisecond: 0,
  }).toUTC();
  const fridayNy = executionSundayNy.plus({ days: 5 });
  const entryCutoffUtc = fridayNy.set({
    hour: 9,
    minute: 0,
    second: 0,
    millisecond: 0,
  }).toUTC();
  const windowCloseUtc = fridayNy.set({
    hour: 11,
    minute: 0,
    second: 0,
    millisecond: 0,
  }).toUTC();

  return {
    logicalWeekOpenUtc: normalized,
    windowOpenUtc,
    entryCutoffUtc,
    windowCloseUtc,
    offsetHours: EXECUTION_WINDOW_OFFSET_HOURS[assetClass],
    anchorVersion: EXECUTION_ANCHOR_VERSION,
  };
}
