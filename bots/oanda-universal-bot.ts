import { DateTime } from "luxon";
import { getOandaInstrument } from "@/lib/oandaPrices";
import {
  fetchOandaAccountSummary,
  fetchOandaInstruments,
  fetchOandaOpenTrades,
  fetchOandaPricing,
  placeOandaMarketOrder,
  closeOandaTrade,
  closeOandaPosition,
  buildClientTag,
} from "@/lib/oandaTrade";
import { readBotState, writeBotState } from "@/lib/botState";
import { groupSignals } from "@/lib/plannedTrades";
import type { AssetClass } from "@/lib/cotMarkets";
import {
  loadConnectedAccountSecrets,
  updateConnectedAccountAnalysis,
} from "@/lib/connectedAccounts";
import { buildOandaSizingForAccount } from "@/lib/oandaSizing";

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
const debug = (process.env.OANDA_DEBUG ?? "").trim().toLowerCase() === "true";
const debugVerbose = (process.env.OANDA_DEBUG_VERBOSE ?? "").trim().toLowerCase() === "true";

function log(message: string, extra?: Record<string, unknown>) {
  const stamp = DateTime.utc().toISO() ?? new Date().toISOString();
  if (extra) {
    console.log(`${stamp} | [OandaBot] ${message}`, extra);
  } else {
    console.log(`${stamp} | [OandaBot] ${message}`);
  }
}

function parseManagedLegTag(tag: string | undefined | null) {
  const raw = String(tag ?? "").trim();
  if (!raw) return null;
  const parts = raw.split("-");
  // Expected: uni-{SYMBOL}-{MODEL}-{random}
  if (parts.length < 4) return null;
  const prefix = String(parts[0] ?? "").toLowerCase();
  const symbol = String(parts[1] ?? "").toUpperCase();
  const model = String(parts[2] ?? "").toLowerCase();
  if (prefix !== "uni" || !symbol || !model) return null;
  return { symbol, model };
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

function buildUsdConversionPairs(currency: string) {
  const upper = String(currency ?? "").trim().toUpperCase();
  if (!upper || upper === "USD") return [];
  return [`${upper}_USD`, `USD_${upper}`];
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

function roundUnits(units: number, precision: number, minUnits?: number) {
  // Truncate (never round up) to avoid opening legs larger than intended.
  const p = Math.max(0, precision);
  const factor = p > 0 ? 10 ** p : 1;
  const truncated = p > 0 ? Math.floor(units * factor) / factor : Math.floor(units);
  return Number.isFinite(truncated) ? truncated : 0;
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
  // Preferred path: reuse the same sizing logic the app uses (Analytics -> "Sizing Analysis").
  // This avoids drift between what the UI says is "safe" and what the bot trades.
  if (linkedAccountKey) {
    try {
      const tradeSignals = signals.filter(
        (signal): signal is BasketSignal & { direction: "LONG" | "SHORT" } =>
          signal.direction !== "NEUTRAL" && signal.asset_class === "fx",
      );
      const grouped = groupSignals(tradeSignals);
      const netBySymbol = new Map<string, number>();
      for (const pair of grouped) {
        netBySymbol.set(pair.symbol, Math.abs(pair.net));
      }

      const sizing = await buildOandaSizingForAccount(linkedAccountKey);
      const sizingMap = new Map(sizing.rows.map((row) => [row.symbol, row]));

      // Important: with OPEN_ONLY hedged legs, many accounts charge margin on *gross* exposure,
      // not the netted instrument exposure. Scale sizing using gross margin across legs.
      const available = Number.isFinite(sizing.marginAvailable ?? NaN)
        ? (sizing.marginAvailable as number)
        : sizing.nav;
      let totalMargin = 0;
      for (const signal of tradeSignals) {
        const row = sizingMap.get(signal.symbol);
        if (!row || !row.available) continue;
        if (!Number.isFinite(row.marginRate ?? NaN) || !Number.isFinite(row.notionalUsdPerUnit ?? NaN)) continue;
        if (!Number.isFinite(row.units ?? NaN)) continue;
        const legNotional = Math.abs((row.units ?? 0) * (row.notionalUsdPerUnit ?? 0));
        totalMargin += legNotional * (row.marginRate ?? 0);
      }
      const buffer = available * (1 - marginBuffer);
      const scale = totalMargin > 0 ? Math.min(1, buffer / totalMargin) : 1;

      let skipped = 0;
      const skippedDetails: Array<{ symbol: string; reason: string }> = [];

      const plan = tradeSignals.map((signal) => {
        const row = sizingMap.get(signal.symbol);
        if (!row) {
          skipped += 1;
          skippedDetails.push({ symbol: signal.symbol, reason: "missing sizing row" });
          return null;
        }
        if (!row.available) {
          skipped += 1;
          skippedDetails.push({ symbol: signal.symbol, reason: row.reason ?? "instrument unavailable" });
          return null;
        }
        if (!Number.isFinite(row.units ?? NaN)) {
          skipped += 1;
          skippedDetails.push({ symbol: signal.symbol, reason: row.reason ?? "invalid units" });
          return null;
        }

        const precision = row.tradeUnitsPrecision ?? 0;
        const minUnits = row.minUnits;
        const scaledUnitsRaw = roundUnits((row.units ?? 0) * scale, precision);
        if (minUnits && scaledUnitsRaw > 0 && scaledUnitsRaw < minUnits) {
          skipped += 1;
          skippedDetails.push({ symbol: signal.symbol, reason: `below minUnits after scale (${scaledUnitsRaw} < ${minUnits})` });
          return null;
        }
        const scaledUnits = scaledUnitsRaw;
        if (!Number.isFinite(scaledUnits) || scaledUnits <= 0) {
          skipped += 1;
          skippedDetails.push({ symbol: signal.symbol, reason: "scaled units <= 0" });
          return null;
        }

        return {
          instrument: row.instrument,
          units: scaledUnits,
          direction: signal.direction,
          model: signal.model,
          symbol: signal.symbol,
          precision: Math.max(0, precision),
          rawUnits: row.rawUnits ?? row.units ?? 0,
          quote: row.instrument.split("_")[1] ?? "",
          usdPerQuote: 0,
          price: row.price ?? 0,
          notionalUsdPerUnit: row.notionalUsdPerUnit ?? 0,
        };
      }).filter((row): row is NonNullable<typeof row> => Boolean(row));

      if (skipped > 0) {
        log("Skipped instruments (from sizing analysis).", { skipped, details: skippedDetails.slice(0, 25) });
      }

      return {
        plan,
        nav: sizing.nav,
        marginAvailable: Number.isFinite(sizing.marginAvailable ?? NaN) ? sizing.marginAvailable : null,
        totalMargin,
        scale,
        skipped,
        skippedDetails,
      };
    } catch (error) {
      log("Sizing analysis path failed; falling back to direct sizing.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const instruments = await fetchOandaInstruments();
  const instrumentMap = new Map(instruments.map((inst) => [inst.name, inst]));
      const summary = await fetchOandaAccountSummary();
      const nav = Number(summary.NAV);
      const marginAvailable = Number(summary.marginAvailable ?? NaN);
      if (!Number.isFinite(nav) || nav <= 0) {
        throw new Error("Invalid OANDA NAV.");
      }

  const tradeSignals = signals.filter(
    (signal): signal is BasketSignal & { direction: "LONG" | "SHORT" } =>
      signal.direction !== "NEUTRAL" && signal.asset_class === "fx",
  );

  // For OPEN_ONLY hedged legs, prefer scaling using gross margin across legs.

  // Price both the planned instruments and any required USD conversion pairs so we can size
  // non-USD quote currencies (e.g. EUR_GBP needs GBP_USD or USD_GBP pricing).
  const instrumentNames = tradeSignals.map((signal) => getOandaInstrument(signal.symbol));
  const quoteCurrencies = Array.from(
    new Set(
      instrumentNames
        .map((inst) => parseInstrumentCurrencies(inst).quote)
        .filter((quote) => Boolean(quote)),
    ),
  );
  const conversionPairsRaw = quoteCurrencies.flatMap((quote) => buildUsdConversionPairs(quote));
  // Only request conversion instruments that actually exist for this account.
  // OANDA pricing endpoint fails the entire request if ANY instrument is invalid (e.g. JPY_USD).
  const conversionPairs = conversionPairsRaw.filter((inst) => instrumentMap.has(inst));
  if (debug && conversionPairs.length !== conversionPairsRaw.length) {
    const dropped = conversionPairsRaw.filter((inst) => !instrumentMap.has(inst));
    log("Dropped invalid USD conversion instruments.", { dropped: dropped.slice(0, 20) });
  }

  const pricingList = Array.from(new Set([...instrumentNames, ...conversionPairs]));
  const pricing = await fetchOandaPricing(pricingList);
  const priceMap = buildPriceMap(pricing);
  let skipped = 0;

  const plan: Array<{
    instrument: string;
    units: number;
    direction: "LONG" | "SHORT";
    model: BasketSignal["model"];
    symbol: string;
    precision: number;
    rawUnits: number;
    quote: string;
    usdPerQuote: number;
    price: number;
    notionalUsdPerUnit: number;
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
      totalMargin += targetNotionalUsd * marginRate;
    }

    plan.push({
      instrument,
      units,
      direction: signal.direction,
      model: signal.model,
      symbol: signal.symbol,
      precision: Math.max(0, precision),
      rawUnits,
      quote,
      usdPerQuote,
      price,
      notionalUsdPerUnit,
    });
  }

      // If OANDA reports marginAvailable=0, treat it as real (no free margin), not "missing".
      const available = Number.isFinite(marginAvailable) ? marginAvailable : nav;
      const buffer = available * (1 - marginBuffer);
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
      // OANDA expects units aligned to tradeUnitsPrecision (usually 0 for FX).
      units:
        row.precision === 0
          ? Math.max(0, Math.floor(row.units * scale))
          : Math.max(0, Number((row.units * scale).toFixed(row.precision))),
    })),
    nav,
    marginAvailable: Number.isFinite(marginAvailable) ? marginAvailable : null,
    totalMargin,
    scale,
    skipped,
    skippedDetails,
  };
}

async function closeAllTrades() {
  const trades = await fetchOandaOpenTrades();
  for (const trade of trades) {
    await closeOandaTrade(trade.id);
  }
}

async function closeTradesById(tradeIds: string[]) {
  for (const id of tradeIds) {
    try {
      await closeOandaTrade(id);
    } catch (error) {
      log("Trade close failed.", { id, error: error instanceof Error ? error.message : String(error) });
    }
    // small delay to reduce rate-limit / "too many requests" bursts
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

async function wipeAllOpenTrades() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const trades = await fetchOandaOpenTrades();
    if (trades.length === 0) {
      return;
    }

    // Prefer position-level close (fewer calls, closes both sides per instrument if hedged).
    const byInstrument = new Map<string, { hasLong: boolean; hasShort: boolean; tradeIds: string[] }>();
    for (const t of trades) {
      const instrument = String(t.instrument ?? "").trim();
      if (!instrument) continue;
      const units = Number(t.currentUnits ?? 0);
      if (!Number.isFinite(units) || units === 0) continue;
      if (!byInstrument.has(instrument)) {
        byInstrument.set(instrument, { hasLong: false, hasShort: false, tradeIds: [] });
      }
      const row = byInstrument.get(instrument)!;
      if (units > 0) row.hasLong = true;
      if (units < 0) row.hasShort = true;
      row.tradeIds.push(String(t.id));
    }

    for (const [instrument, row] of Array.from(byInstrument.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      try {
        await closeOandaPosition({
          instrument,
          longUnits: row.hasLong ? "ALL" : undefined,
          shortUnits: row.hasShort ? "ALL" : undefined,
        });
      } catch (error) {
        log("Position close failed; will fall back to per-trade close.", {
          instrument,
          error: error instanceof Error ? error.message : String(error),
        });
        await closeTradesById(row.tradeIds);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const after = await fetchOandaOpenTrades();
    log("Wipe attempt complete.", { attempt, before: trades.length, after: after.length });
    if (after.length === 0) {
      return;
    }

    // Last resort: brute-force trade closes.
    await closeTradesById(after.map((t) => String(t.id)));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const remaining = await fetchOandaOpenTrades();
  if (remaining.length > 0) {
    throw new Error(`Failed to wipe open trades after retries. Remaining open trades: ${remaining.length}`);
  }
}

async function enterTrades(signals: BasketSignal[]) {
  // Always reconcile/clean the account *before* sizing. Sizing uses marginAvailable,
  // which can be 0 if there is any leftover exposure.
  let openTrades = await fetchOandaOpenTrades();
  const isManagedTrade = (trade: Awaited<ReturnType<typeof fetchOandaOpenTrades>>[number]) => {
    const tag = (trade.clientExtensions?.tag ?? trade.clientExtensions?.id ?? "").toString();
    return Boolean(parseManagedLegTag(tag));
  };

  let managedTrades = openTrades.filter(isManagedTrade);
  let unmanagedTrades = openTrades.filter((t) => !isManagedTrade(t));

  // If the account has any untagged/unmanaged trades, the bot cannot safely dedupe or reconcile.
  // User-approved behavior: close everything and rebuild from a clean slate.
  if (unmanagedTrades.length > 0) {
    log("Unmanaged trades detected. Closing all open trades before entry.", {
      totalOpen: openTrades.length,
      unmanaged: unmanagedTrades.length,
      unmanagedSamples: unmanagedTrades.slice(0, 10).map((t) => ({
        id: t.id,
        instrument: t.instrument,
        currentUnits: t.currentUnits,
        tag: t.clientExtensions?.tag ?? t.clientExtensions?.id ?? null,
      })),
    });
    await wipeAllOpenTrades();
    openTrades = [];
    managedTrades = [];
    unmanagedTrades = [];
  }

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
    return { nav: sizing.nav, pending: 0, skipped: sizing.skipped, failures: [] as any[] };
  }

  const existingLegKeys = new Set<string>();
  const unparsedTags: string[] = [];
  for (const trade of managedTrades) {
    const tag = (trade.clientExtensions?.tag ?? trade.clientExtensions?.id ?? "").toString();
    const parsed = parseManagedLegTag(tag);
    if (!parsed) {
      if (tag) unparsedTags.push(tag);
      continue;
    }
    const { symbol, model } = parsed;
    const units = Number(trade.currentUnits ?? 0);
    if (!Number.isFinite(units) || units === 0) continue;
    const dir = units > 0 ? "LONG" : "SHORT";
    existingLegKeys.add(`${symbol}:${model}:${dir}`);
  }

  const failures: Array<{ symbol: string; instrument: string; error: string }> = [];
  const orderDetails: Array<{ symbol: string; instrument: string; units: number; side: string; model: string }> = [];

  const plannedKeys = new Set<string>();
  for (const planned of sizing.plan) {
    if (!Number.isFinite(planned.units) || planned.units <= 0) continue;
    plannedKeys.add(`${planned.symbol.toUpperCase()}:${String(planned.model).toLowerCase()}:${planned.direction}`);
  }
  const missingBefore = Array.from(plannedKeys).filter((key) => !existingLegKeys.has(key));
  if (missingBefore.length > 0 || sizing.skipped > 0) {
    log("OANDA leg diff before entry.", {
      planned: plannedKeys.size,
      open: existingLegKeys.size,
      missing: missingBefore.length,
      skipped: sizing.skipped,
      scale: sizing.scale,
      nav: sizing.nav,
      marginAvailable: sizing.marginAvailable,
      marginBuffer,
      totalMargin: sizing.totalMargin,
      missingSamples: missingBefore.slice(0, 10),
      skippedSamples: (sizing.skippedDetails ?? []).slice(0, 10),
      unparsedTags: unparsedTags.slice(0, 5),
    });
    if (debugVerbose && missingBefore.length > 0) {
      const missingSet = new Set(missingBefore);
      const missingLegDetails = sizing.plan
        .filter((row) => missingSet.has(`${row.symbol.toUpperCase()}:${String(row.model).toLowerCase()}:${row.direction}`))
        .slice(0, 30)
        .map((row) => ({
          symbol: row.symbol,
          model: row.model,
          direction: row.direction,
          instrument: row.instrument,
          units: row.units,
          rawUnits: row.rawUnits,
          price: row.price,
          quote: row.quote,
          usdPerQuote: row.usdPerQuote,
          notionalUsdPerUnit: row.notionalUsdPerUnit,
        }));
      log("Missing leg details (sample).", { rows: missingLegDetails });
    }
  }

  // Hedge-first entry ordering per symbol: alternate LONG/SHORT legs to minimize transient margin spikes.
  const bySymbol = new Map<string, typeof sizing.plan>();
  for (const planned of sizing.plan) {
    const sym = planned.symbol.toUpperCase();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(planned);
  }
  const ordered: typeof sizing.plan = [];
  for (const [sym, legs] of Array.from(bySymbol.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const longs = legs.filter((l) => l.direction === "LONG");
    const shorts = legs.filter((l) => l.direction === "SHORT");
    while (longs.length > 0 || shorts.length > 0) {
      if (longs.length > 0) ordered.push(longs.shift()!);
      if (shorts.length > 0) ordered.push(shorts.shift()!);
    }
  }

  let placed = 0;
  const logMargin = async (label: string) => {
    try {
      const summary = await fetchOandaAccountSummary();
      log(label, {
        nav: Number(summary.NAV),
        balance: Number(summary.balance),
        marginUsed: Number(summary.marginUsed),
        marginAvailable: Number(summary.marginAvailable),
        unrealizedPL: Number(summary.unrealizedPL),
        currency: summary.currency,
      });
    } catch (error) {
      log("Failed to fetch margin telemetry.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  await logMargin("Margin before entry.");

  for (const planned of ordered) {
    if (!Number.isFinite(planned.units) || planned.units <= 0) continue;
    const key = `${planned.symbol.toUpperCase()}:${String(planned.model).toLowerCase()}:${planned.direction}`;
    if (existingLegKeys.has(key)) continue;

    const side = planned.direction === "LONG" ? "buy" : "sell";
    const units = Math.abs(planned.units);
    try {
      const response = await placeOandaMarketOrder({
        instrument: planned.instrument,
        units,
        side,
        clientTag: buildClientTag("uni", planned.symbol, planned.model),
        // Preserve per-leg hedging. If the account disallows offsetting legs, this fails loudly.
        positionFill: "OPEN_ONLY",
      });

      placed += 1;
      if (placed % 6 === 0) {
        await logMargin("Margin during entry.");
      }

      if (debug) {
        log("OANDA order response (sample).", {
          symbol: planned.symbol,
          model: planned.model,
          direction: planned.direction,
          instrument: planned.instrument,
          units,
          side,
          transactionId:
            response?.orderFillTransaction?.id ??
            response?.orderCreateTransaction?.id ??
            response?.orderCancelTransaction?.id ??
            null,
          tradeOpened:
            response?.orderFillTransaction?.tradeOpened?.tradeID ??
            response?.orderFillTransaction?.tradeReduced?.tradeID ??
            null,
          tradeClosed: response?.orderFillTransaction?.tradeClosed?.tradeID ?? null,
        });
      }
      orderDetails.push({
        symbol: planned.symbol,
        instrument: planned.instrument,
        units,
        side,
        model: planned.model,
      });
    } catch (error) {
      failures.push({
        symbol: planned.symbol,
        instrument: planned.instrument,
        error: error instanceof Error ? error.message : String(error),
      });
      log("OANDA order failed.", {
        symbol: planned.symbol,
        model: planned.model,
        direction: planned.direction,
        instrument: planned.instrument,
        units,
        side,
        error: error instanceof Error ? error.message : String(error),
      });
      await logMargin("Margin after order failure.");
      break;
    }
  }

  await logMargin("Margin after entry.");

  log("Placed OANDA orders (per-leg).", {
    count: orderDetails.length,
    orders: orderDetails.slice(0, 10),
    failures: failures.slice(0, 5),
    scale: sizing.scale,
  });

  const afterTrades = await fetchOandaOpenTrades();
  const afterManaged = afterTrades.filter(isManagedTrade);
  if (orderDetails.length > 0 && afterTrades.length > 0 && afterManaged.length === 0) {
    // If orders were placed but no trades are tagged, we cannot manage/dedupe/reconcile.
    // Fail closed: wipe the account and let the next tick retry.
    log("No managed trades detected after entry; closing all trades to avoid unmanaged exposure.", {
      afterTrades: afterTrades.length,
      placed: orderDetails.length,
      tagSamples: afterTrades.slice(0, 10).map((t) => ({
        id: t.id,
        instrument: t.instrument,
        currentUnits: t.currentUnits,
        tag: t.clientExtensions?.tag ?? t.clientExtensions?.id ?? null,
      })),
    });
    await closeTradesById(afterTrades.map((t) => t.id));
    return {
      nav: sizing.nav,
      pending: sizing.plan.filter((p) => Number.isFinite(p.units) && p.units > 0).length,
      skipped: sizing.skipped ?? 0,
      failures: [
        ...failures,
        { symbol: "ALL", instrument: "ALL", error: "No managed trades detected after entry; closed all." },
      ],
    };
  }
  const afterKeys = new Set<string>();
  for (const trade of afterManaged) {
    const tag = (trade.clientExtensions?.tag ?? trade.clientExtensions?.id ?? "").toString();
    const parsed = parseManagedLegTag(tag);
    if (!parsed) continue;
    const { symbol, model } = parsed;
    const units = Number(trade.currentUnits ?? 0);
    if (!Number.isFinite(units) || units === 0) continue;
    const dir = units > 0 ? "LONG" : "SHORT";
    afterKeys.add(`${symbol}:${model}:${dir}`);
  }

  let pending = 0;
  for (const planned of sizing.plan) {
    const key = `${planned.symbol.toUpperCase()}:${String(planned.model).toLowerCase()}:${planned.direction}`;
    if (!afterKeys.has(key) && planned.units > 0) {
      pending += 1;
    }
  }

  // Treat skipped legs as pending so we keep retrying until the environment/instruments support them.
  return { nav: sizing.nav, pending: pending + (sizing.skipped ?? 0), skipped: sizing.skipped ?? 0, failures };
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
          const managedTrades = openTrades.filter((trade) => {
            const tag = (trade.clientExtensions?.tag ?? trade.clientExtensions?.id ?? "").toString();
            return Boolean(parseManagedLegTag(tag));
          });
          await updateConnectedAccountAnalysis(linkedAccountKey, {
            ...(linkedAccountBase ?? {}),
            nav: currentNav,
            balance: Number(summary.balance ?? summary.NAV ?? 0),
            currency: summary.currency ?? "USD",
            // Only report managed (tagged) legs to the app. Unmanaged trades should not be surfaced.
            positions: managedTrades.map((trade) => ({
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
    // If state says entered but no actual trades exist, allow re-entry.
    if (state.entered && trades.length === 0) {
      state.entered = false;
      log("State marked entered but no trades exist; resetting to allow entry.");
    }

    // Keep attempting to fill missing legs throughout the week window.
    // `enterTrades()` is idempotent via leg-key dedupe and will no-op once everything is open.
    const signals = await fetchLatestSignals();
    const entry = await enterTrades(signals);
    if (!state.entered) {
      const entryEquity = entry.nav;
      state.entered = entry.pending === 0 && (entry.failures?.length ?? 0) === 0;
      state.entry_time_utc = now.toISO();
      state.entry_equity = entryEquity;
      state.peak_equity = entryEquity;
      state.trailing_active = false;
      state.locked_pct = null;
      log("Entry attempt complete.", { entered: state.entered, pending: entry.pending, skipped: entry.skipped ?? 0, failures: entry.failures?.length ?? 0 });
      await writeBotState(BOT_ID, state);
      return;
    } else if (entry.pending > 0 || (entry.failures?.length ?? 0) > 0) {
      log("Basket incomplete; will retry next tick.", { pending: entry.pending, skipped: entry.skipped ?? 0, failures: entry.failures?.length ?? 0 });
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
