import { DateTime } from "luxon";
import { fetchBitgetFuturesSnapshot } from "@/lib/bitget";
import {
  fetchBitgetAccount,
  fetchBitgetContracts,
  fetchBitgetPositions,
  placeBitgetOrder,
  setBitgetLeverage,
  setBitgetPositionMode,
} from "@/lib/bitgetTrade";
import { readBotState, writeBotState } from "@/lib/botState";

type BasketSignal = {
  symbol: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  model: "antikythera" | "blended" | "dealer" | "commercial" | "sentiment";
  asset_class: string;
};

type BitgetBotState = {
  week_id: string | null;
  entered: boolean;
  entry_time_utc: string | null;
  entry_equity: number | null;
  entry_prices: Record<string, number> | null;
  entry_notional: Record<string, number> | null;
  peak_equity: number | null;
  peak_unlevered_pct: number | null;
  trailing_active: boolean;
  locked_pct: number | null;
  trail_hit_at: string | null;
  last_direction: "LONG" | "SHORT" | null;
};

const BOT_ID = "bitget_perp_bot";
const TICK_SECONDS = Number(process.env.BOT_TICK_SECONDS ?? "30");
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const LEVERAGE = Number(process.env.BITGET_LEVERAGE ?? "10");
const TRAIL_START_PCT = Number(process.env.BITGET_TRAIL_START_PCT ?? "20");
const TRAIL_OFFSET_PCT = Number(process.env.BITGET_TRAIL_OFFSET_PCT ?? "10");

const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
const REQUIRED_MODELS: BasketSignal["model"][] = [
  "antikythera",
  "dealer",
  "commercial",
  "sentiment",
];

let running = false;

function log(message: string, extra?: Record<string, unknown>) {
  const stamp = DateTime.utc().toISO() ?? new Date().toISOString();
  if (extra) {
    console.log(`${stamp} | [BitgetBot] ${message}`, extra);
  } else {
    console.log(`${stamp} | [BitgetBot] ${message}`);
  }
}

function getWeekWindowUtc(now = DateTime.utc()) {
  const etNow = now.setZone("America/New_York");
  const daysSinceSunday = etNow.weekday % 7;
  const sunday = etNow.minus({ days: daysSinceSunday }).startOf("day");
  let open = sunday.set({ hour: 19, minute: 0, second: 0, millisecond: 0 });
  if (etNow < open) {
    open = open.minus({ weeks: 1 });
  }
  const close = open.plus({ weeks: 1 });
  return {
    weekId: open.toUTC().toISO() ?? new Date().toISOString(),
    openUtc: open.toUTC(),
    closeUtc: close.toUTC(),
  };
}

async function fetchLatestSignals(): Promise<BasketSignal[]> {
  if (!APP_BASE_URL) {
    throw new Error("APP_BASE_URL is not configured for Bitget bot.");
  }
  const url = new URL("/api/cot/baskets/latest", APP_BASE_URL);
  url.searchParams.set("asset", "crypto");
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Signal fetch failed: ${response.status} ${body}`);
  }
  const payload = (await response.json()) as { pairs?: BasketSignal[]; trading_allowed?: boolean };
  if (payload.trading_allowed === false) {
    throw new Error("Trading not allowed per COT freshness.");
  }
  return payload.pairs ?? [];
}

function resolveAlignment(pairs: BasketSignal[]) {
  const map = new Map<string, Map<BasketSignal["model"], BasketSignal["direction"]>>();
  for (const pair of pairs) {
    if (!SYMBOLS.includes(pair.symbol as typeof SYMBOLS[number])) {
      continue;
    }
    if (!map.has(pair.symbol)) {
      map.set(pair.symbol, new Map());
    }
    map.get(pair.symbol)!.set(pair.model, pair.direction);
  }

  let direction: "LONG" | "SHORT" | null = null;
  for (const symbol of SYMBOLS) {
    const modelMap = map.get(symbol);
    if (!modelMap) {
      return { ok: false, reason: `${symbol} missing signals` as const };
    }
    for (const model of REQUIRED_MODELS) {
      const dir = modelMap.get(model);
      if (!dir || dir === "NEUTRAL") {
        return { ok: false, reason: `${symbol} ${model} neutral` as const };
      }
      if (!direction) {
        direction = dir;
      } else if (direction !== dir) {
        return { ok: false, reason: `${symbol} ${model} mismatch` as const };
      }
    }
  }

  if (!direction) {
    return { ok: false, reason: "No aligned direction" as const };
  }
  return { ok: true, direction };
}

async function computeOrderSize(symbol: string, notionalUsd: number) {
  const [contract] = await fetchBitgetContracts(symbol);
  if (!contract) {
    throw new Error(`Missing contract info for ${symbol}`);
  }
  const snapshot = await fetchBitgetFuturesSnapshot(symbol.startsWith("BTC") ? "BTC" : "ETH");
  const price = Number(snapshot.lastPrice ?? NaN);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid price for ${symbol}`);
  }
  const sizeMultiplier = Number(contract.sizeMultiplier ?? "0");
  const minTradeNum = Number(contract.minTradeNum ?? "0");
  if (!Number.isFinite(sizeMultiplier) || sizeMultiplier <= 0) {
    throw new Error(`Invalid sizeMultiplier for ${symbol}`);
  }
  const baseQty = notionalUsd / price;
  const rawContracts = baseQty / sizeMultiplier;
  const step = minTradeNum > 0 ? minTradeNum : 1;
  const contracts = Math.floor(rawContracts / step) * step;
  if (contracts <= 0) {
    throw new Error(`Contracts too small for ${symbol}`);
  }
  const precision = Number(contract.volumePlace ?? "0");
  const size = contracts.toFixed(Math.max(0, precision));
  const notional = contracts * sizeMultiplier * price;
  return { size, price, notional };
}

async function hasOpenPositions() {
  const positions = await fetchBitgetPositions();
  return positions.some((pos) => {
    if (!SYMBOLS.includes(pos.symbol as typeof SYMBOLS[number])) {
      return false;
    }
    const total = Number(pos.total ?? pos.available ?? "0");
    return Number.isFinite(total) && Math.abs(total) > 0;
  });
}

async function closeAllPositions(direction: "LONG" | "SHORT") {
  const positions = await fetchBitgetPositions();
  for (const pos of positions) {
    if (!SYMBOLS.includes(pos.symbol as typeof SYMBOLS[number])) {
      continue;
    }
    const total = Number(pos.total ?? pos.available ?? "0");
    if (!Number.isFinite(total) || Math.abs(total) === 0) {
      continue;
    }
    const side = direction === "LONG" ? "sell" : "buy";
    await placeBitgetOrder({
      symbol: pos.symbol,
      side,
      size: Math.abs(total).toString(),
      clientOid: `close-${pos.symbol}-${Date.now()}`,
      reduceOnly: "yes",
    });
  }
}

async function enterPositions(direction: "LONG" | "SHORT") {
  await setBitgetPositionMode("one_way_mode");
  for (const symbol of SYMBOLS) {
    await setBitgetLeverage(symbol, LEVERAGE);
  }

  const account = await fetchBitgetAccount();
  const equity = Number(account?.usdtEquity ?? account?.equity ?? account?.available ?? "0");
  if (!Number.isFinite(equity) || equity <= 0) {
    throw new Error("Invalid Bitget equity.");
  }

  const notionalPerSymbol = (equity * LEVERAGE) / SYMBOLS.length;
  const side = direction === "LONG" ? "buy" : "sell";
  const entryPrices: Record<string, number> = {};
  const entryNotional: Record<string, number> = {};

  for (const symbol of SYMBOLS) {
    const { size, price, notional } = await computeOrderSize(symbol, notionalPerSymbol);
    await placeBitgetOrder({
      symbol,
      side,
      size,
      clientOid: `entry-${symbol}-${Date.now()}`,
    });
    entryPrices[symbol] = price;
    entryNotional[symbol] = notional;
  }

  return { equity, entryPrices, entryNotional };
}

async function tick() {
  if (running) {
    return;
  }
  running = true;

  try {
    const now = DateTime.utc();
    const { weekId, openUtc, closeUtc } = getWeekWindowUtc(now);
    const stateRow = await readBotState<BitgetBotState>(BOT_ID);
    const state: BitgetBotState = stateRow?.state ?? {
      week_id: null,
      entered: false,
      entry_time_utc: null,
      entry_equity: null,
      peak_equity: null,
      trailing_active: false,
      locked_pct: null,
      trail_hit_at: null,
      last_direction: null,
    };

    if (state.week_id !== weekId) {
      state.week_id = weekId;
      state.entered = false;
      state.entry_time_utc = null;
      state.entry_equity = null;
      state.entry_prices = null;
      state.entry_notional = null;
      state.peak_equity = null;
      state.peak_unlevered_pct = null;
      state.trailing_active = false;
      state.locked_pct = null;
      state.trail_hit_at = null;
      state.last_direction = null;
      log("New week detected. Resetting state.", { weekId });
    }

    if (now < openUtc || now >= closeUtc) {
      if (await hasOpenPositions()) {
        log("Week closed. Closing positions.");
        await closeAllPositions(state.last_direction ?? "LONG");
      }
      await writeBotState(BOT_ID, state);
      return;
    }

    const positionsOpen = await hasOpenPositions();
    if (!state.entered && positionsOpen) {
      state.entered = true;
      log("Detected open positions without state; marking entered.");
    }

    if (!state.entered) {
      const signals = await fetchLatestSignals();
      const alignment = resolveAlignment(signals);
      if (!alignment.ok) {
        log("Signals not aligned.", { reason: alignment.reason });
        await writeBotState(BOT_ID, state);
        return;
      }
      const entry = await enterPositions(alignment.direction);
      state.entered = true;
      state.entry_time_utc = now.toISO();
      state.entry_equity = entry.equity;
      state.entry_prices = entry.entryPrices;
      state.entry_notional = entry.entryNotional;
      state.peak_equity = entry.equity;
      state.peak_unlevered_pct = 0;
      state.trailing_active = false;
      state.locked_pct = null;
      state.last_direction = alignment.direction;
      log("Entered positions.", { direction: alignment.direction, equity: entry.equity });
      await writeBotState(BOT_ID, state);
      return;
    }

    const account = await fetchBitgetAccount();
    const equity = Number(account?.usdtEquity ?? account?.equity ?? account?.available ?? "0");
    if (!Number.isFinite(equity) || equity <= 0) {
      log("Invalid equity; skipping trailing update.");
      await writeBotState(BOT_ID, state);
      return;
    }
    if (!state.entry_equity) {
      state.entry_equity = equity;
    }
    if (!state.peak_equity || equity > state.peak_equity) {
      state.peak_equity = equity;
    }

    let unleveredPct = 0;
    if (state.entry_prices && state.entry_notional) {
      const entries = Object.entries(state.entry_prices);
      const totalNotional = Object.values(state.entry_notional).reduce((sum, val) => sum + val, 0);
      if (entries.length > 0 && totalNotional > 0) {
        const snapshots = await Promise.all([
          fetchBitgetFuturesSnapshot("BTC"),
          fetchBitgetFuturesSnapshot("ETH"),
        ]);
        const priceMap = new Map<string, number>([
          ["BTCUSDT", snapshots[0].lastPrice],
          ["ETHUSDT", snapshots[1].lastPrice],
        ]);
        let weighted = 0;
        for (const [symbol, entryPrice] of entries) {
          const current = priceMap.get(symbol);
          if (!current) {
            continue;
          }
          const direction = state.last_direction === "LONG" ? 1 : -1;
          const pct = ((current - entryPrice) / entryPrice) * 100 * direction;
          const weight = state.entry_notional[symbol] ?? 0;
          weighted += pct * (weight / totalNotional);
        }
        unleveredPct = weighted;
      }
    }

    if (unleveredPct > 0 && (!state.peak_unlevered_pct || unleveredPct > state.peak_unlevered_pct)) {
      state.peak_unlevered_pct = unleveredPct;
    }

    const profitPct = unleveredPct;
    const peakPct = state.peak_unlevered_pct ?? profitPct;

    if (profitPct >= TRAIL_START_PCT) {
      state.trailing_active = true;
      const minLock = TRAIL_START_PCT - TRAIL_OFFSET_PCT;
      const nextLock = Math.max(minLock, peakPct - TRAIL_OFFSET_PCT);
      if (!state.locked_pct || nextLock > state.locked_pct) {
        state.locked_pct = nextLock;
      }
    }

    if (state.trailing_active && state.locked_pct !== null && profitPct <= state.locked_pct) {
      log("Trailing stop hit. Closing positions.", {
        locked_pct: state.locked_pct,
        profit_pct: profitPct,
      });
      await closeAllPositions(state.last_direction ?? "LONG");
      state.entered = false;
      state.trail_hit_at = now.toISO();
    }

    await writeBotState(BOT_ID, state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Error: ${message}`);
  } finally {
    running = false;
  }
}

async function main() {
  log("Bitget perp bot starting...");
  await tick();
  setInterval(() => {
    void tick();
  }, TICK_SECONDS * 1000);
}

main().catch((error) => {
  console.error("Bitget bot failed to start:", error);
  process.exit(1);
});
