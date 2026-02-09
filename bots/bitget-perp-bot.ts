import { DateTime } from "luxon";
import { fetchBitgetFuturesSnapshot } from "@/lib/bitget";
import {
  fetchBitgetAccount,
  fetchBitgetContracts,
  fetchBitgetPositions,
  placeBitgetOrder,
  setBitgetLeverage,
  setBitgetPositionMode,
  getBitgetProductType,
} from "@/lib/bitgetTrade";
import { readBotState, writeBotState } from "@/lib/botState";
import {
  loadConnectedAccountSecrets,
  updateConnectedAccountAnalysis,
} from "@/lib/connectedAccounts";

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
  current_equity: number | null;
};

const BOT_ID = "bitget_perp_bot";
let tickSeconds = Number(process.env.BOT_TICK_SECONDS ?? "30");
function resolveAppBaseUrl() {
  const raw = (process.env.APP_BASE_URL ?? "").trim();
  if (!raw || raw.includes("your-app.onrender.com")) {
    const fallback = (process.env.LIMNI_API_BASE ?? "").trim();
    return fallback || "https://limni-website-nine.vercel.app";
  }
  return raw;
}

let appBaseUrl = resolveAppBaseUrl();
let leverage = Number(process.env.BITGET_LEVERAGE ?? "10");
let trailStartPct = Number(process.env.BITGET_TRAIL_START_PCT ?? "20");
let trailOffsetPct = Number(process.env.BITGET_TRAIL_OFFSET_PCT ?? "10");
let linkedAccountKey: string | null = null;
let linkedAccountBase: Record<string, unknown> | null = null;

const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
const REQUIRED_MODELS: BasketSignal["model"][] = [
  "antikythera",
  "dealer",
  "commercial",
  "sentiment",
];

let running = false;

function toBitgetSymbol(symbol: string) {
  const upper = String(symbol ?? "").trim().toUpperCase();
  if (upper === "BTCUSD") return "BTCUSDT";
  if (upper === "ETHUSD") return "ETHUSDT";
  return upper;
}

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
  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL is not configured for Bitget bot.");
  }
  const url = new URL("/bot/cot/baskets/latest", appBaseUrl);
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
  const pairs = payload.pairs ?? [];
  log(`Fetched ${pairs.length} crypto signals`, {
    symbols: Array.from(new Set(pairs.map(p => p.symbol))).join(", "),
    models: Array.from(new Set(pairs.map(p => p.model))).join(", "),
  });
  return pairs;
}

function resolveAlignment(
  pairs: BasketSignal[],
):
  | { ok: true; direction: "LONG" | "SHORT" }
  | { ok: false; reason: string } {
  const map = new Map<string, Map<BasketSignal["model"], BasketSignal["direction"]>>();
  for (const pair of pairs) {
    const mapped = toBitgetSymbol(pair.symbol);
    if (!SYMBOLS.includes(mapped as typeof SYMBOLS[number])) {
      continue;
    }
    if (!map.has(mapped)) {
      map.set(mapped, new Map());
    }
    map.get(mapped)!.set(pair.model, pair.direction);
  }

  let direction: "LONG" | "SHORT" | null = null;
  for (const symbol of SYMBOLS) {
    const modelMap = map.get(symbol);
    if (!modelMap) {
      log(`Missing signals for ${symbol}`, {
        availableSymbols: Array.from(map.keys()).join(", "),
        mapSize: map.size,
      });
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
  const contractList = await fetchBitgetContracts(symbol);
  log(`Fetched ${contractList.length} contracts for ${symbol}`, {
    symbols: contractList.map(c => c.symbol).join(", "),
  });
  const contract =
    contractList.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase()) ??
    contractList[0];
  if (!contract) {
    const allContracts = await fetchBitgetContracts();
    log(`All available contracts:`, {
      count: allContracts.length,
      samples: allContracts.slice(0, 10).map(c => c.symbol).join(", "),
    });
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

  // Skip programmatic leverage setting - use whatever is configured in Bitget UI
  // Bitget may restrict programmatic leverage changes depending on account tier
  log("Using leverage configured in Bitget UI (not setting programmatically)", {
    targetLeverage: leverage
  });

  const account = await fetchBitgetAccount();
  const equity = Number(account?.usdtEquity ?? account?.equity ?? account?.available ?? "0");
  if (!Number.isFinite(equity) || equity <= 0) {
    throw new Error("Invalid Bitget equity.");
  }

  // Use 50% of equity as margin per symbol (user wants 50% on EACH of BTC and ETH)
  // With $100 account: $50 margin per symbol
  // At 10x leverage: $50 * 10 = $500 notional per position
  // Note: We specify NOTIONAL size to the API, Bitget calculates margin = notional / leverage
  const notionalPerSymbol = (equity * 0.5) * leverage;
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
      entry_prices: null,
      entry_notional: null,
      peak_equity: null,
      peak_unlevered_pct: null,
      trailing_active: false,
      locked_pct: null,
      trail_hit_at: null,
      last_direction: null,
      current_equity: null,
    };

    // Fetch current account balance on every tick
    try {
      const account = await fetchBitgetAccount();
      const currentEquity = Number(account?.usdtEquity ?? account?.equity ?? account?.available ?? "0");
      if (Number.isFinite(currentEquity) && currentEquity > 0) {
        state.current_equity = currentEquity;
        if (linkedAccountKey) {
          await updateConnectedAccountAnalysis(linkedAccountKey, {
            ...(linkedAccountBase ?? {}),
            equity: currentEquity,
            currency: "USDT",
            fetched_at: DateTime.utc().toISO(),
          });
        }
      }
    } catch (error) {
      log("Failed to fetch current equity", { error: error instanceof Error ? error.message : String(error) });
    }

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
          ["BTCUSDT", Number(snapshots[0]?.lastPrice ?? NaN)],
          ["ETHUSDT", Number(snapshots[1]?.lastPrice ?? NaN)],
        ]);
        let weighted = 0;
        for (const [symbol, entryPrice] of entries) {
          const current = priceMap.get(symbol);
          if (current === undefined || !Number.isFinite(current) || current <= 0) {
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

    if (profitPct >= trailStartPct) {
      state.trailing_active = true;
      const minLock = trailStartPct - trailOffsetPct;
      const nextLock = Math.max(minLock, peakPct - trailOffsetPct);
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
  log("Bitget perp bot starting...", {
    appBaseUrl,
    tickSeconds,
    symbols: SYMBOLS,
    productType: getBitgetProductType(),
  });
  await hydrateConnectedAccount();
  await tick();
  setInterval(() => {
    void tick();
  }, tickSeconds * 1000);
}

main().catch((error) => {
  console.error("Bitget bot failed to start:", error);
  process.exit(1);
});

async function hydrateConnectedAccount() {
  try {
    const record = await loadConnectedAccountSecrets({
      provider: "bitget",
      botType: "bitget_perp",
    });
    if (!record) {
      return;
    }
    linkedAccountKey = record.account.account_key;
    linkedAccountBase = (record.account.analysis ?? {}) as Record<string, unknown>;
    const secrets = record.secrets as Record<string, unknown>;
    if (typeof secrets.apiKey === "string") {
      process.env.BITGET_API_KEY = secrets.apiKey;
    }
    if (typeof secrets.apiSecret === "string") {
      process.env.BITGET_API_SECRET = secrets.apiSecret;
    }
    if (typeof secrets.apiPassphrase === "string") {
      process.env.BITGET_API_PASSPHRASE = secrets.apiPassphrase;
    }
    if (typeof secrets.env === "string") {
      process.env.BITGET_ENV = secrets.env;
    }
    if (typeof secrets.productType === "string") {
      process.env.BITGET_PRODUCT_TYPE = secrets.productType;
    }
    if (typeof secrets.leverage === "number") {
      leverage = secrets.leverage;
    } else if (typeof secrets.leverage === "string") {
      leverage = Number(secrets.leverage);
    }
    if (typeof record.account.trail_start_pct === "number") {
      trailStartPct = record.account.trail_start_pct;
    }
    if (typeof record.account.trail_offset_pct === "number") {
      trailOffsetPct = record.account.trail_offset_pct;
    }
    if (typeof record.account.config === "object" && record.account.config) {
      const config = record.account.config as Record<string, unknown>;
      if (typeof config.appBaseUrl === "string") {
        appBaseUrl = config.appBaseUrl.trim() || resolveAppBaseUrl();
      }
    }
  } catch (error) {
    log("Failed to load connected account secrets.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
