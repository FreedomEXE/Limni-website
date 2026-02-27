/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: triton.ts
 *
 * Description:
 * Template-based Telegram alert formatter and sender for Poseidon's
 * Triton module. This layer sends deterministic alert messages only.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { Telegraf } from "telegraf";
import { config } from "@/lib/poseidon/config";

function asString(value: unknown, fallback = "n/a") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

export function formatAlert(alertType: string, data: Record<string, unknown>): string {
  switch (alertType) {
    case "TRADE_OPENED":
      return [
        "[TRITON] Trade Opened",
        `${asString(data.symbol)} ${asString(data.direction)} @ ${asString(data.price)}`,
        `Session: ${asString(data.session)}`,
        `Leverage: ${asString(data.leverage)}x | Margin: ${asString(data.margin)} USDT`,
        `Stop: ${asString(data.stopPrice)}`,
      ].join("\n");
    case "TRADE_CLOSED":
      return [
        "[TRITON] Trade Closed",
        `${asString(data.symbol)} ${asString(data.direction)} | PnL: ${asString(data.pnl)} (${asString(data.pnlPct)}%)`,
        `Entry: ${asString(data.entryPrice)} -> Exit: ${asString(data.exitPrice)}`,
        `Reason: ${asString(data.exitReason)}`,
        `Duration: ${asString(data.duration)}`,
      ].join("\n");
    case "MILESTONE":
      return [
        "[TRITON] Milestone Hit",
        `${asString(data.symbol)} ${asString(data.direction)} | +${asString(data.milestone)}% unrealized`,
        `Current: ${asString(data.currentPrice)} (entry: ${asString(data.entryPrice)})`,
        `Leverage: ${asString(data.leverage)}x`,
      ].join("\n");
    case "BREAKEVEN_SET":
      return [
        "[TRITON] Breakeven Set",
        `${asString(data.symbol)} ${asString(data.direction)} | Stop moved to entry`,
        `Entry: ${asString(data.entryPrice)}`,
      ].join("\n");
    case "BIAS_CHANGE":
      return [
        "[TRITON] Weekly Bias Updated",
        `BTC: ${asString(data.btcDirection)} (${asString(data.btcTier)})`,
        `ETH: ${asString(data.ethDirection)} (${asString(data.ethTier)})`,
        "Source: COT + Sentiment",
      ].join("\n");
    case "BOT_ERROR":
      return [
        "[TRITON] Bot Error",
        `State: ${asString(data.state)}`,
        `Error: ${asString(data.error)}`,
        `Time: ${asString(data.timestamp)}`,
      ].join("\n");
    case "STALE_DATA":
      return [
        "[TRITON] Stale Data Warning",
        `${asString(data.description)}`,
        `Last update: ${asString(data.lastUpdate)}`,
      ].join("\n");
    default:
      return `[TRITON] ${alertType}\n${JSON.stringify(data, null, 2)}`;
  }
}

export async function sendAlert(
  bot: Telegraf,
  alertType: string,
  data: Record<string, unknown>,
) {
  const message = formatAlert(alertType, data);
  await bot.telegram.sendMessage(config.telegram.ownerId, message, {
    parse_mode: "Markdown",
  });
}

