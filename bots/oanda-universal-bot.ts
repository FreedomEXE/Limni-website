import { DateTime } from "luxon";
import { getOandaInstrument } from "@/lib/oandaPrices";
import {
  fetchOandaAccountSummary,
  fetchOandaInstruments,
  fetchOandaOpenTrades,
  fetchOandaPricing,
  placeOandaMarketOrder,
  closeOandaTrade,
  buildClientTag,
} from "@/lib/oandaTrade";
import { readBotState, writeBotState } from "@/lib/botState";
import { groupSignals } from "@/lib/plannedTrades";
import type { AssetClass } from "@/lib/cotMarkets";
import {
  loadConnectedAccountSecrets,
  updateConnectedAccountAnalysis,
} from "@/lib/connectedAccounts";

type BasketSignal = {
  symbol: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  model: "antikythera" | "blended" | "dealer" | "commercial" | "sentiment";
  asset_class: AssetClass;
};

type OandaBotState = {
  week_id: string | null;
  entered: boolean;
  entry_time_utc: string | null;
  entry_equity: number | null;
  peak_equity: number | null;
  trailing_active: boolean;
  locked_pct: number | null;
  trail_hit_at: string | null;
  current_equity: number | null;
};

const BOT_ID = "oanda_universal_bot";
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
let trailStartPct = Number(process.env.OANDA_TRAIL_START_PCT ?? "20");
let trailOffsetPct = Number(process.env.OANDA_TRAIL_OFFSET_PCT ?? "10");
let marginBuffer = Number(process.env.OANDA_MARGIN_BUFFER ?? "0.1");
let tradingEnabled = process.env.OANDA_TRADING_ENABLED === "true";
let linkedAccountKey: string | null = null;
let linkedAccountBase: Record<string, unknown> | null = null;

let running = false;

function log(message: string, extra?: Record<string, unknown>) {
  const stamp = DateTime.utc().toISO() ?? new Date().toISOString();
  if (extra) {
    console.log(`${stamp} | [OandaBot] ${message}`, extra);
  } else {
    console.log(`${stamp} | [OandaBot] ${message}`);
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

function getFxCloseUtc(now = DateTime.utc()) {
  const etNow = now.setZone("America/New_York");
  const daysSinceSunday = etNow.weekday % 7;
  const sunday = etNow.minus({ days: daysSinceSunday }).startOf("day");
  let open = sunday.set({ hour: 19, minute: 0, second: 0, millisecond: 0 });
  if (etNow < open) {
    open = open.minus({ weeks: 1 });
  }
  const friday = open.plus({ days: 5 });
  const fxClose = friday.set({ hour: 16, minute: 30, second: 0, millisecond: 0 });
  return fxClose.toUTC();
}

async function fetchLatestSignals(): Promise<BasketSignal[]> {
  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL is not configured for OANDA bot.");
  }
  const url = new URL("/bot/cot/baskets/latest", appBaseUrl);
  url.searchParams.set("asset", "all");
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

function parseInstrumentCurrencies(instrument: string) {
  const [base, quote] = instrument.split("_");
  return { base, quote };
}

function buildPriceMap(prices: Awaited<ReturnType<typeof fetchOandaPricing>>) {
  const map = new Map<string, number>();
  for (const price of prices) {
    const bid = Number(price.closeoutBid ?? price.bids?.[0]?.price ?? NaN);
    const ask = Number(price.closeoutAsk ?? price.asks?.[0]?.price ?? NaN);
    const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
    if (Number.isFinite(mid)) {
      map.set(price.instrument, mid);
    }
  }
  return map;
}

function convertToUsd(amount: number, currency: string, priceMap: Map<string, number>) {
  if (currency === "USD") {
    return amount;
  }
  const pairDirect = `${currency}_USD`;
  const pairInverse = `USD_${currency}`;
  const direct = priceMap.get(pairDirect);
  if (direct) {
    return amount * direct;
  }
  const inverse = priceMap.get(pairInverse);
  if (inverse) {
    return amount / inverse;
  }
  return null;
}

async function buildSizing(signals: BasketSignal[]) {
  const instruments = await fetchOandaInstruments();
  const instrumentMap = new Map(instruments.map((inst) => [inst.name, inst]));
  const summary = await fetchOandaAccountSummary();
  const nav = Number(summary.NAV);
  if (!Number.isFinite(nav) || nav <= 0) {
    throw new Error("Invalid OANDA NAV.");
  }

  const tradeSignals = signals.filter(
    (signal): signal is BasketSignal & { direction: "LONG" | "SHORT" } =>
      signal.direction !== "NEUTRAL" && signal.asset_class === "fx",
  );

  // Net legs per symbol so margin is based on net exposure (OANDA nets margin on same instrument).
  const grouped = groupSignals(tradeSignals);
  const netBySymbol = new Map<string, number>();
  for (const pair of grouped) {
    netBySymbol.set(pair.symbol, Math.abs(pair.net));
  }
  const instrumentNames = tradeSignals.map((signal) => getOandaInstrument(signal.symbol));
  const pricing = await fetchOandaPricing(Array.from(new Set(instrumentNames)));
  const priceMap = buildPriceMap(pricing);
  let skipped = 0;

  const plan: Array<{
    instrument: string;
    units: number;
    direction: "LONG" | "SHORT";
    model: BasketSignal["model"];
    symbol: string;
  }> = [];

  let totalMargin = 0;
  const skippedDetails: Array<{ symbol: string; reason: string }> = [];
  for (const signal of tradeSignals) {
    const instrument = getOandaInstrument(signal.symbol);
    const spec = instrumentMap.get(instrument);
    const price = priceMap.get(instrument);
    if (!spec) {
      skipped += 1;
      skippedDetails.push({ symbol: signal.symbol, reason: "missing spec" });
      continue;
    }
    if (!price) {
      skipped += 1;
      skippedDetails.push({ symbol: signal.symbol, reason: "missing price" });
      continue;
    }

    const { quote } = parseInstrumentCurrencies(instrument);
    const usdPerQuote = convertToUsd(1, quote, priceMap);
    if (!usdPerQuote) {
      skipped += 1;
      skippedDetails.push({ symbol: signal.symbol, reason: `no FX conversion for ${quote}` });
      continue;
    }

    const notionalUsdPerUnit = price * usdPerQuote;
    const targetNotionalUsd = nav;
    const rawUnits = targetNotionalUsd / notionalUsdPerUnit;
    const precision = spec.tradeUnitsPrecision ?? 0;
    const units = Number(rawUnits.toFixed(Math.max(0, precision)));

    const marginRate = Number(spec.marginRate ?? "0");
    if (Number.isFinite(marginRate)) {
      const net = netBySymbol.get(signal.symbol) ?? 0;
      if (net > 0) {
        totalMargin += targetNotionalUsd * marginRate * net;
      }
    }

    plan.push({
      instrument,
      units,
      direction: signal.direction,
      model: signal.model,
      symbol: signal.symbol,
    });
  }

  const buffer = nav * (1 - marginBuffer);
  const scale = totalMargin > 0 ? Math.min(1, buffer / totalMargin) : 1;
  if (skipped > 0) {
    log("Skipped instruments (missing price/spec/FX conversion).", {
      skipped,
      details: skippedDetails,
    });
  }
  return {
    plan: plan.map((row) => ({
      ...row,
      units: Math.max(0, Math.floor(row.units * scale)),
    })),
    nav,
    totalMargin,
    scale,
  };
}

async function closeAllTrades() {
  const trades = await fetchOandaOpenTrades();
  for (const trade of trades) {
    await closeOandaTrade(trade.id);
  }
}

async function enterTrades(signals: BasketSignal[]) {
  const sizing = await buildSizing(signals);
  if (sizing.plan.length === 0) {
    throw new Error("No tradable instruments for OANDA.");
  }
  if (!tradingEnabled) {
    log("OANDA_TRADING_ENABLED=false; skipping live orders.", {
      trades: sizing.plan.length,
      scale: sizing.scale,
      margin: sizing.totalMargin,
    });
    return sizing.nav;
  }

  const orderDetails: Array<{ symbol: string; instrument: string; units: number; side: string }> = [];
  for (const trade of sizing.plan) {
    if (trade.units <= 0) {
      continue;
    }
    const side = trade.direction === "LONG" ? "buy" : "sell";
    await placeOandaMarketOrder({
      instrument: trade.instrument,
      units: trade.units,
      side,
      clientTag: buildClientTag("uni", trade.symbol, trade.model),
    });
    orderDetails.push({
      symbol: trade.symbol,
      instrument: trade.instrument,
      units: trade.units,
      side,
    });
  }
  log("Placed OANDA orders.", {
    count: orderDetails.length,
    orders: orderDetails.slice(0, 10),
    scale: sizing.scale,
  });

  return sizing.nav;
}

async function tick() {
  if (running) {
    return;
  }
  running = true;

  try {
    const now = DateTime.utc();
    const { weekId, openUtc, closeUtc } = getWeekWindowUtc(now);
    const stateRow = await readBotState<OandaBotState>(BOT_ID);
    const state: OandaBotState = stateRow?.state ?? {
      week_id: null,
      entered: false,
      entry_time_utc: null,
      entry_equity: null,
      peak_equity: null,
      trailing_active: false,
      locked_pct: null,
      trail_hit_at: null,
      current_equity: null,
    };

    // Fetch current account balance and positions on every tick
    try {
      const summary = await fetchOandaAccountSummary();
      const currentNav = Number(summary.NAV);
      if (Number.isFinite(currentNav) && currentNav > 0) {
        state.current_equity = currentNav;
        if (linkedAccountKey) {
          const openTrades = await fetchOandaOpenTrades();
          await updateConnectedAccountAnalysis(linkedAccountKey, {
            ...(linkedAccountBase ?? {}),
            nav: currentNav,
            balance: Number(summary.balance ?? summary.NAV ?? 0),
            currency: summary.currency ?? "USD",
            positions: openTrades.map((trade) => ({
              symbol: trade.instrument.replace("_", ""),
              type: Number(trade.currentUnits ?? 0) > 0 ? "buy" : "sell",
              lots: Math.abs(Number(trade.currentUnits ?? 0)),
              profit: Number(trade.unrealizedPL ?? 0),
              swap: 0,
              commission: 0,
              open_time: trade.openTime ?? DateTime.utc().toISO(),
              comment: trade.clientExtensions?.tag ?? "",
            })),
            fetched_at: DateTime.utc().toISO(),
          });
        }
      }
    } catch (error) {
      log("Failed to fetch current NAV", { error: error instanceof Error ? error.message : String(error) });
    }

    if (state.week_id !== weekId) {
      state.week_id = weekId;
      state.entered = false;
      state.entry_time_utc = null;
      state.entry_equity = null;
      state.peak_equity = null;
      state.trailing_active = false;
      state.locked_pct = null;
      state.trail_hit_at = null;
      log("New week detected. Resetting state.", { weekId });
    }

    const fxCloseUtc = getFxCloseUtc(now);

    if (now >= fxCloseUtc && now < closeUtc) {
      const trades = await fetchOandaOpenTrades();
      if (trades.length > 0) {
        log("FX close reached (16:30 ET). Closing OANDA trades.");
        await closeAllTrades();
      }
      state.entered = false;
      await writeBotState(BOT_ID, state);
      return;
    }

    if (now < openUtc || now >= closeUtc) {
      const trades = await fetchOandaOpenTrades();
      if (trades.length > 0) {
        log("Week closed. Closing OANDA trades.");
        await closeAllTrades();
      }
      await writeBotState(BOT_ID, state);
      return;
    }

    const trades = await fetchOandaOpenTrades();
    if (!state.entered && trades.length > 0) {
      state.entered = true;
      log("Detected open trades without state; marking entered.");
    }

    // If state says entered but no actual trades exist, allow re-entry
    if (state.entered && trades.length === 0) {
      state.entered = false;
      log("State marked entered but no trades exist; resetting to allow entry.");
    }

    if (!state.entered) {
      const signals = await fetchLatestSignals();
      const entryEquity = await enterTrades(signals);
      state.entered = true;
      state.entry_time_utc = now.toISO();
      state.entry_equity = entryEquity;
      state.peak_equity = entryEquity;
      state.trailing_active = false;
      state.locked_pct = null;
      log("Entered OANDA trades.");
      await writeBotState(BOT_ID, state);
      return;
    }

    const summary = await fetchOandaAccountSummary();
    const nav = Number(summary.NAV);
    if (!Number.isFinite(nav) || nav <= 0) {
      log("Invalid NAV; skipping trailing update.");
      await writeBotState(BOT_ID, state);
      return;
    }

    if (!state.entry_equity) {
      state.entry_equity = nav;
    }
    if (!state.peak_equity || nav > state.peak_equity) {
      state.peak_equity = nav;
    }

    const profitPct =
      state.entry_equity > 0
        ? ((nav - state.entry_equity) / state.entry_equity) * 100
        : 0;
    const peakPct =
      state.entry_equity > 0 && state.peak_equity
        ? ((state.peak_equity - state.entry_equity) / state.entry_equity) * 100
        : profitPct;

    if (profitPct >= trailStartPct) {
      state.trailing_active = true;
      const minLock = trailStartPct - trailOffsetPct;
      const nextLock = Math.max(minLock, peakPct - trailOffsetPct);
      if (!state.locked_pct || nextLock > state.locked_pct) {
        state.locked_pct = nextLock;
      }
    }

    if (state.trailing_active && state.locked_pct !== null && profitPct <= state.locked_pct) {
      log("Trailing stop hit. Closing OANDA trades.", {
        locked_pct: state.locked_pct,
        profit_pct: profitPct,
      });
      await closeAllTrades();
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
  log("OANDA universal bot starting...", {
    appBaseUrl,
    tradingEnabled,
    tickSeconds,
  });
  await hydrateConnectedAccount();
  await tick();
  setInterval(() => {
    void tick();
  }, tickSeconds * 1000);
}

main().catch((error) => {
  console.error("OANDA bot failed to start:", error);
  process.exit(1);
});

async function hydrateConnectedAccount() {
  try {
    const record = await loadConnectedAccountSecrets({
      provider: "oanda",
      botType: "oanda_universal",
    });
    if (!record) {
      return;
    }
    linkedAccountKey = record.account.account_key;
    linkedAccountBase = (record.account.analysis ?? {}) as Record<string, unknown>;
    const secrets = record.secrets as Record<string, unknown>;
    if (typeof secrets.apiKey === "string") {
      process.env.OANDA_API_KEY = secrets.apiKey;
    }
    if (typeof secrets.accountId === "string") {
      process.env.OANDA_ACCOUNT_ID = secrets.accountId;
    }
    if (typeof secrets.env === "string") {
      process.env.OANDA_ENV = secrets.env;
    }
    if (typeof record.account.trail_start_pct === "number") {
      trailStartPct = record.account.trail_start_pct;
    }
    if (typeof record.account.trail_offset_pct === "number") {
      trailOffsetPct = record.account.trail_offset_pct;
    }
    if (typeof record.account.config === "object" && record.account.config) {
      const config = record.account.config as Record<string, unknown>;
      if (typeof config.marginBuffer === "number") {
        marginBuffer = config.marginBuffer;
      }
      // Environment variable should be able to force-enable trading during incidents.
      const envTrading = (process.env.OANDA_TRADING_ENABLED ?? "").trim();
      if (!envTrading && typeof config.tradingEnabled === "boolean") {
        tradingEnabled = config.tradingEnabled;
      } else if (envTrading) {
        tradingEnabled = envTrading === "true";
      }
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
