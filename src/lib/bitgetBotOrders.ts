/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitgetBotOrders.ts
 *
 * Description:
 * Execution wrapper for Bitget Bot v2 with DRY_RUN-first behavior.
 * Provides idempotent action keys, retry/backoff, and persistent
 * audit logging to bitget_bot_dry_run_log for every execution intent.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import crypto from "node:crypto";
import {
  fetchBitgetContracts,
  fetchBitgetPositions,
  placeBitgetOrder,
  placeBitgetPositionStopLoss,
  setBitgetLeverage,
  setBitgetMarginMode,
  type BitgetContract,
} from "@/lib/bitgetTrade";
import { fetchBitgetFuturesSnapshot } from "@/lib/bitget";
import { query } from "@/lib/db";

type Direction = "LONG" | "SHORT";

type BaseOrderOptions = {
  botId: string;
  weekId: string;
  actionTsMs?: number;
};

type OpenPositionOptions = BaseOrderOptions & {
  priceHint?: number | null;
};

type ClosePositionOptions = BaseOrderOptions & {
  direction?: Direction;
  sizeHint?: string | null;
  priceHint?: number | null;
};

type AdjustLeverageOptions = BaseOrderOptions;
type StopLossOptions = BaseOrderOptions & { direction: Direction };

type OrderResult = {
  ok: boolean;
  dryRun: boolean;
  clientOid: string;
  symbol: string;
  direction?: Direction;
  size?: string | null;
  price?: number | null;
  notionalUsd?: number | null;
  message?: string;
};

function isDryRunMode() {
  return String(process.env.BITGET_BOT_DRY_RUN ?? "true").toLowerCase() !== "false";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBase(symbol: string): "BTC" | "ETH" | "SOL" | null {
  const upper = symbol.toUpperCase();
  if (upper.startsWith("BTC")) return "BTC";
  if (upper.startsWith("ETH")) return "ETH";
  if (upper.startsWith("SOL")) return "SOL";
  return null;
}

function clampLeverage(leverage: number) {
  if (!Number.isFinite(leverage)) return 10;
  return Math.max(1, Math.min(50, Math.floor(leverage)));
}

function computeOrderSize(
  notionalUsd: number,
  price: number,
  contract: BitgetContract | null,
) {
  if (!(notionalUsd > 0) || !(price > 0)) {
    return null;
  }
  const precision = Number(contract?.volumePlace ?? "0");
  const sizeMultiplier = Number(contract?.sizeMultiplier ?? "0");
  const minTradeNum = Number(contract?.minTradeNum ?? "0");
  const qtyStep = Math.max(
    0,
    Number.isFinite(sizeMultiplier) ? sizeMultiplier : 0,
    Number.isFinite(minTradeNum) ? minTradeNum : 0,
  );
  const fallbackStep = Math.pow(10, -Math.max(0, precision));
  const step = qtyStep > 0 ? qtyStep : fallbackStep;

  const rawQty = notionalUsd / price;
  const steppedQty = Math.floor(rawQty / step) * step;
  const qty = Number(steppedQty.toFixed(Math.max(0, precision)));
  if (!(qty > 0)) return null;
  if (minTradeNum > 0 && qty < minTradeNum) return null;
  return qty.toFixed(Math.max(0, precision));
}

function makeClientOid(
  botId: string,
  symbol: string,
  weekId: string,
  action: string,
  actionTsMs: number,
) {
  const raw = `${botId}|${symbol}|${weekId}|${action}|${actionTsMs}`;
  const digest = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 18);
  return `${botId}:${action}:${symbol}:${digest}`;
}

async function withRetry<T>(fn: () => Promise<T>) {
  let attempt = 0;
  let delayMs = 1000;
  while (attempt < 3) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt >= 3) throw error;
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
  throw new Error("Retry loop exhausted.");
}

async function writeAuditLog(params: {
  botId: string;
  tickTimeUtc: string;
  action: string;
  symbol?: string | null;
  direction?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await query(
      `INSERT INTO bitget_bot_dry_run_log
        (bot_id, tick_time_utc, action, symbol, direction, details)
       VALUES ($1, $2::timestamptz, $3, $4, $5, $6::jsonb)`,
      [
        params.botId,
        params.tickTimeUtc,
        params.action,
        params.symbol ?? null,
        params.direction ?? null,
        JSON.stringify(params.details ?? {}),
      ],
    );
  } catch (error) {
    console.warn(
      "[bitgetBotOrders] Failed to write bitget_bot_dry_run_log:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function openPosition(
  symbol: string,
  direction: Direction,
  marginUsd: number,
  leverage: number,
  opts: OpenPositionOptions,
): Promise<OrderResult> {
  const dryRun = isDryRunMode();
  const actionTsMs = opts.actionTsMs ?? Date.now();
  const clientOid = makeClientOid(opts.botId, symbol, opts.weekId, "open", actionTsMs);
  const base = resolveBase(symbol);
  const lev = clampLeverage(leverage);

  const snapshot = base
    ? await fetchBitgetFuturesSnapshot(base).catch(() => null)
    : null;
  const fillPrice = opts.priceHint ?? snapshot?.lastPrice ?? null;
  const notionalUsd = marginUsd > 0 ? marginUsd * lev : 0;

  let size: string | null = null;
  if (fillPrice && fillPrice > 0) {
    const contracts = await fetchBitgetContracts(symbol).catch(() => []);
    size = computeOrderSize(notionalUsd, fillPrice, contracts[0] ?? null);
  }

  await writeAuditLog({
    botId: opts.botId,
    tickTimeUtc: new Date(actionTsMs).toISOString(),
    action: dryRun ? "OPEN_POSITION_DRY_RUN" : "OPEN_POSITION",
    symbol,
    direction,
    details: { clientOid, marginUsd, leverage: lev, fillPrice, size, notionalUsd },
  });

  if (dryRun) {
    return {
      ok: true,
      dryRun,
      clientOid,
      symbol,
      direction,
      size,
      price: fillPrice,
      notionalUsd,
      message: "Dry run only. No real order placed.",
    };
  }

  if (!size || !(fillPrice && fillPrice > 0)) {
    return {
      ok: false,
      dryRun,
      clientOid,
      symbol,
      direction,
      size,
      price: fillPrice,
      notionalUsd,
      message: "Unable to compute executable size/price.",
    };
  }

  const side = direction === "LONG" ? "buy" : "sell";
  await withRetry(async () => {
    await setBitgetMarginMode(symbol, "isolated");
    await setBitgetLeverage(symbol, lev, { marginMode: "isolated" });
    await placeBitgetOrder({
      symbol,
      side,
      size,
      clientOid,
      marginMode: "isolated",
      reduceOnly: "no",
    });
  });

  return {
    ok: true,
    dryRun,
    clientOid,
    symbol,
    direction,
    size,
    price: fillPrice,
    notionalUsd,
  };
}

export async function closePosition(
  symbol: string,
  opts: ClosePositionOptions,
): Promise<OrderResult> {
  const dryRun = isDryRunMode();
  const actionTsMs = opts.actionTsMs ?? Date.now();
  const clientOid = makeClientOid(opts.botId, symbol, opts.weekId, "close", actionTsMs);

  let closeSide: "buy" | "sell" = opts.direction === "LONG" ? "sell" : "buy";
  let size = opts.sizeHint ?? null;
  let fillPrice = opts.priceHint ?? null;

  if (!size) {
    const positions = await fetchBitgetPositions().catch(() => []);
    const row = positions.find((p) => p.symbol.toUpperCase() === symbol.toUpperCase());
    if (row) {
      const total = Math.abs(Number(row.total ?? row.available ?? "0"));
      if (total > 0) {
        size = String(total);
      }
      const holdSide = String(row.holdSide ?? "").toLowerCase();
      if (holdSide === "short") closeSide = "buy";
      if (holdSide === "long") closeSide = "sell";
    }
  }

  const base = resolveBase(symbol);
  if (fillPrice === null && base) {
    const snapshot = await fetchBitgetFuturesSnapshot(base).catch(() => null);
    fillPrice = snapshot?.lastPrice ?? null;
  }

  await writeAuditLog({
    botId: opts.botId,
    tickTimeUtc: new Date(actionTsMs).toISOString(),
    action: dryRun ? "CLOSE_POSITION_DRY_RUN" : "CLOSE_POSITION",
    symbol,
    direction: opts.direction ?? null,
    details: { clientOid, closeSide, size, fillPrice },
  });

  if (dryRun) {
    return {
      ok: true,
      dryRun,
      clientOid,
      symbol,
      direction: opts.direction,
      size,
      price: fillPrice,
      message: "Dry run only. No real close order placed.",
    };
  }

  if (!size) {
    return {
      ok: false,
      dryRun,
      clientOid,
      symbol,
      direction: opts.direction,
      size: null,
      price: fillPrice,
      message: "No size available to close position.",
    };
  }

  await withRetry(async () => {
    await placeBitgetOrder({
      symbol,
      side: closeSide,
      size,
      clientOid,
      reduceOnly: "yes",
      marginMode: "isolated",
    });
  });

  return {
    ok: true,
    dryRun,
    clientOid,
    symbol,
    direction: opts.direction,
    size,
    price: fillPrice,
  };
}

export async function adjustLeverage(
  symbol: string,
  newLeverage: number,
  opts: AdjustLeverageOptions,
): Promise<OrderResult> {
  const dryRun = isDryRunMode();
  const actionTsMs = opts.actionTsMs ?? Date.now();
  const clientOid = makeClientOid(opts.botId, symbol, opts.weekId, "adjust-leverage", actionTsMs);
  const leverage = clampLeverage(newLeverage);

  await writeAuditLog({
    botId: opts.botId,
    tickTimeUtc: new Date(actionTsMs).toISOString(),
    action: dryRun ? "ADJUST_LEVERAGE_DRY_RUN" : "ADJUST_LEVERAGE",
    symbol,
    details: { clientOid, leverage },
  });

  if (dryRun) {
    return {
      ok: true,
      dryRun,
      clientOid,
      symbol,
      message: "Dry run only. Leverage change logged.",
    };
  }

  await withRetry(async () => {
    await setBitgetLeverage(symbol, leverage, { marginMode: "isolated" });
  });

  return { ok: true, dryRun, clientOid, symbol };
}

export async function setStopLoss(
  symbol: string,
  stopPrice: number,
  opts: StopLossOptions,
): Promise<OrderResult> {
  const dryRun = isDryRunMode();
  const actionTsMs = opts.actionTsMs ?? Date.now();
  const clientOid = makeClientOid(opts.botId, symbol, opts.weekId, "set-stop", actionTsMs);

  await writeAuditLog({
    botId: opts.botId,
    tickTimeUtc: new Date(actionTsMs).toISOString(),
    action: dryRun ? "SET_STOP_DRY_RUN" : "SET_STOP",
    symbol,
    direction: opts.direction,
    details: {
      clientOid,
      stopPrice,
      mode: dryRun ? "dry_run" : "manual_monitoring_required",
    },
  });

  if (dryRun) {
    return {
      ok: true,
      dryRun,
      clientOid,
      symbol,
      direction: opts.direction,
      price: stopPrice,
      message: "Dry run only. Stop update logged.",
    };
  }

  const holdSideCandidates = opts.direction === "LONG"
    ? (["buy", "long"] as const)
    : (["sell", "short"] as const);

  let lastError: string | null = null;
  for (const holdSide of holdSideCandidates) {
    try {
      const placed = await withRetry(async () =>
        placeBitgetPositionStopLoss({
          symbol,
          holdSide,
          triggerPrice: stopPrice,
          triggerType: "mark_price",
          stopLossClientOid: clientOid,
        }),
      );

      await writeAuditLog({
        botId: opts.botId,
        tickTimeUtc: new Date().toISOString(),
        action: "SET_STOP_CONFIRMED",
        symbol,
        direction: opts.direction,
        details: {
          clientOid,
          stopPrice,
          holdSide,
          orderId: placed.orderId,
          stopLossClientOid: placed.stopLossClientOid,
        },
      });

      return {
        ok: true,
        dryRun,
        clientOid,
        symbol,
        direction: opts.direction,
        price: stopPrice,
        message: `Server-side stop loss placed (${holdSide}).`,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await writeAuditLog({
        botId: opts.botId,
        tickTimeUtc: new Date().toISOString(),
        action: "SET_STOP_ATTEMPT_FAILED",
        symbol,
        direction: opts.direction,
        details: { clientOid, stopPrice, holdSide, error: lastError },
      });
    }
  }

  return {
    ok: false,
    dryRun,
    clientOid,
    symbol,
    direction: opts.direction,
    price: stopPrice,
    message: `Failed to place server-side stop loss: ${lastError ?? "unknown error"}`,
  };
}
