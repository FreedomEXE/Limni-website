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

type BasketSignal = {
  symbol: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  model: "antikythera" | "blended" | "dealer" | "commercial" | "sentiment";
  asset_class: string;
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
};

const BOT_ID = "oanda_universal_bot";
const TICK_SECONDS = Number(process.env.BOT_TICK_SECONDS ?? "30");
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const TRAIL_START_PCT = Number(process.env.OANDA_TRAIL_START_PCT ?? "20");
const TRAIL_OFFSET_PCT = Number(process.env.OANDA_TRAIL_OFFSET_PCT ?? "10");
const MARGIN_BUFFER = Number(process.env.OANDA_MARGIN_BUFFER ?? "0.1");
const TRADING_ENABLED = process.env.OANDA_TRADING_ENABLED === "true";

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

async function fetchLatestSignals(): Promise<BasketSignal[]> {
  if (!APP_BASE_URL) {
    throw new Error("APP_BASE_URL is not configured for OANDA bot.");
  }
  const url = new URL("/api/cot/baskets/latest", APP_BASE_URL);
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

  const tradeSignals = signals.filter((signal) => signal.direction !== "NEUTRAL");
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
  for (const signal of tradeSignals) {
    const instrument = getOandaInstrument(signal.symbol);
    const spec = instrumentMap.get(instrument);
    const price = priceMap.get(instrument);
    if (!spec || !price) {
      skipped += 1;
      continue;
    }

    const { quote } = parseInstrumentCurrencies(instrument);
    const usdPerQuote = convertToUsd(1, quote, priceMap);
    if (!usdPerQuote) {
      skipped += 1;
      continue;
    }

    const notionalUsdPerUnit = price * usdPerQuote;
    const targetNotionalUsd = nav;
    const rawUnits = targetNotionalUsd / notionalUsdPerUnit;
    const precision = spec.tradeUnitsPrecision ?? 0;
    const units = Number(rawUnits.toFixed(Math.max(0, precision)));

    const marginRate = Number(spec.marginRate ?? "0");
    if (Number.isFinite(marginRate)) {
      totalMargin += targetNotionalUsd * marginRate;
    }

    plan.push({
      instrument,
      units,
      direction: signal.direction,
      model: signal.model,
      symbol: signal.symbol,
    });
  }

  const buffer = nav * (1 - MARGIN_BUFFER);
  const scale = totalMargin > 0 ? Math.min(1, buffer / totalMargin) : 1;
  if (skipped > 0) {
    log("Skipped instruments (missing price/spec/FX conversion).", { skipped });
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
  if (!TRADING_ENABLED) {
    log("OANDA_TRADING_ENABLED=false; skipping live orders.", {
      trades: sizing.plan.length,
      scale: sizing.scale,
      margin: sizing.totalMargin,
    });
    return sizing.nav;
  }

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
  }

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
    };

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

    if (profitPct >= TRAIL_START_PCT) {
      state.trailing_active = true;
      const minLock = TRAIL_START_PCT - TRAIL_OFFSET_PCT;
      const nextLock = Math.max(minLock, peakPct - TRAIL_OFFSET_PCT);
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
  log("OANDA universal bot starting...");
  await tick();
  setInterval(() => {
    void tick();
  }, TICK_SECONDS * 1000);
}

main().catch((error) => {
  console.error("OANDA bot failed to start:", error);
  process.exit(1);
});
