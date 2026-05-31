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
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type ExecutionAnchorVersion = "execution_monday_utc_v1";

export const EXECUTION_ANCHOR_VERSION: ExecutionAnchorVersion = "execution_monday_utc_v1";

export type ExecutionWindow = {
  logicalWeekOpenUtc: string;
  windowOpenUtc: DateTime;
  windowCloseUtc: DateTime;
  offsetHours: number;
  anchorVersion: ExecutionAnchorVersion;
};

const EXECUTION_WINDOW_OFFSET_HOURS: Record<AssetClass, number> = {
  fx: 3,
  indices: 2,
  commodities: 2,
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

function getMondayUtcOpen(logicalWeekOpenUtc: string) {
  const { normalized, parsed } = parseLogicalWeek(logicalWeekOpenUtc);
  const utc = parsed.toUTC();

  if (utc.weekday === 1) {
    return utc.startOf("day");
  }

  if (utc.weekday === 7) {
    return utc.plus({ days: 1 }).startOf("day");
  }

  const reparsed = DateTime.fromISO(normalizeWeekOpenUtc(normalized) ?? normalized, { zone: "utc" });
  if (!reparsed.isValid) {
    throw new Error(`Invalid normalized execution week open: ${logicalWeekOpenUtc}`);
  }
  return reparsed.weekday === 7
    ? reparsed.plus({ days: 1 }).startOf("day")
    : reparsed.startOf("day");
}

export function getExecutionWeekWindow(
  logicalWeekOpenUtc: string,
  assetClass: AssetClass,
): ExecutionWindow {
  const { normalized } = parseLogicalWeek(logicalWeekOpenUtc);
  const windowOpenUtc = getMondayUtcOpen(normalized);
  const canonicalWindow = getCanonicalWeekWindow(normalized, assetClass);
  const windowCloseUtc = assetClass === "crypto"
    ? windowOpenUtc.plus({ days: 7 })
    : canonicalWindow.closeUtc;

  return {
    logicalWeekOpenUtc: normalized,
    windowOpenUtc,
    windowCloseUtc,
    offsetHours: EXECUTION_WINDOW_OFFSET_HOURS[assetClass],
    anchorVersion: EXECUTION_ANCHOR_VERSION,
  };
}
