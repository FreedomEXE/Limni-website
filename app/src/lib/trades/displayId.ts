/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: displayId.ts
 *
 * Description:
 * Human-readable trade display IDs derived from ledger columns.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import type { Trade } from "@/lib/trades/tradeTypes";

const ORIGIN_CODE: Record<Trade["origin"], string> = {
  backtest: "BT",
  simulation: "SIM",
  live: "LV",
  research: "RS",
};

const STRATEGY_CODE: Record<string, string> = {
  tandem: "TAN",
  tiered_4w: "TRD",
  agree_3of4: "AGR",
  selector: "SEL",
  weekly_hold: "WH",
  adr_grid: "GRID",
  none: "NONE",
  pair_fill_cap: "PFC",
};

function codeFor(value: string) {
  return STRATEGY_CODE[value] ?? value
    .split(/[_:-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join("");
}

export function strategyShortCode(strategyVariant: string) {
  return strategyVariant
    .split("-")
    .filter(Boolean)
    .filter((part) => part !== "none")
    .map(codeFor)
    .join("-");
}

export function isoWeekCode(weekOpenUtc: string) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!parsed.isValid) return "UNKNOWN";
  const displayWeek = parsed.plus({ days: 1 });
  return `${displayWeek.weekYear}W${String(displayWeek.weekNumber).padStart(2, "0")}`;
}

export function deriveDisplayId(trade: Trade) {
  const originCode = ORIGIN_CODE[trade.origin];
  const stratCode = strategyShortCode(trade.strategyVariant);
  const weekCode = isoWeekCode(trade.weekOpenUtc);
  const seqCode = trade.strategyFamily === "adr_grid" && trade.parentTradeId === null && trade.fillSeq === null
    ? "000"
    : String(trade.fillSeq ?? 1).padStart(3, "0");
  return `${originCode}-${stratCode}-${trade.symbol}-${weekCode}-${seqCode}`;
}
