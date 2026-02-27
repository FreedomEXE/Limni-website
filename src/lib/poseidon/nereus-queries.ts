/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: nereus-queries.ts
 *
 * Description:
 * Read-only DB queries for Nereus pre-session briefings. Gathers structured
 * data from every Limni subsystem: crypto, forex, accounts, system health,
 * news, performance, and market data.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { query, queryOne } from "@/lib/db";
import { getCronStatusSummary, type CronStatusSummary } from "@/lib/cronStatus";

// ─── Helpers ──────────────────────────────

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch { /* ignore */ }
  }
  return {};
}

function fmt(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtUsd(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `$${fmt(value, digits)}`;
}

function fmtPct(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${fmt(value, digits)}%`;
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const dt = DateTime.fromISO(value, { zone: "utc" });
    if (dt.isValid) return dt.toUTC().toISO();
    const d2 = DateTime.fromSQL(value, { zone: "utc" });
    if (d2.isValid) return d2.toUTC().toISO();
  }
  return null;
}

// ─── CRYPTO ───────────────────────────────

export type CryptoBriefing = {
  weeklyBias: string;
  botLifecycle: string;
  openPositions: number;
  ranges: string;
  oiDeltas: string;
  funding: string;
  tradesThisWeek: string;
};

export async function getCryptoBriefingData(): Promise<CryptoBriefing> {
  // Bot state + weekly bias
  const botRow = await queryOne<{ state: unknown; updated_at: unknown }>(
    `SELECT state, updated_at FROM bot_states WHERE bot_id = 'bitget_perp_v2' ORDER BY updated_at DESC LIMIT 1`,
  );
  const botState = parseJsonRecord(botRow?.state);
  const lifecycle = asString(botState.lifecycle_state) ?? asString(botState.lifecycleState) ?? asString(botState.phase) ?? "unknown";

  // Weekly bias from state
  const biasBlock = parseJsonRecord(botState.weekly_bias ?? botState.weeklyBias);
  const btcBias = asString(biasBlock.BTC ?? biasBlock.btc) ?? "n/a";
  const ethBias = asString(biasBlock.ETH ?? biasBlock.eth) ?? "n/a";
  const weeklyBias = `BTC ${btcBias} | ETH ${ethBias}`;

  // Open positions
  const openCount = asNumber(botState.open_positions ?? botState.openPositions) ?? 0;

  // Session ranges
  const rangeRows = await query<{
    symbol: string; high: unknown; low: unknown;
  }>(
    `SELECT symbol, high, low FROM bitget_bot_ranges WHERE day_utc >= CURRENT_DATE - 1 ORDER BY day_utc DESC, symbol`,
  );
  const rangeEntries = rangeRows.slice(0, 4).map((r) => {
    const h = asNumber(r.high);
    const l = asNumber(r.low);
    return `${r.symbol} ${fmt(l, 0)}-${fmt(h, 0)}`;
  });
  const ranges = rangeEntries.join(" | ") || "no ranges";

  // Funding
  const fundingRows = await query<{ symbol: string; funding_rate: unknown }>(
    `SELECT DISTINCT ON (symbol) symbol, funding_rate
       FROM market_funding_snapshots
      WHERE snapshot_time_utc > NOW() - INTERVAL '4 hours'
      ORDER BY symbol, snapshot_time_utc DESC`,
  );
  const fundingEntries = fundingRows.map((r) => `${r.symbol} ${fmtPct(asNumber(r.funding_rate) !== null ? asNumber(r.funding_rate)! * 100 : null, 3)}`);
  const funding = fundingEntries.join(" | ") || "no data";

  // OI deltas (latest vs 24h ago)
  const oiLatest = await query<{ symbol: string; open_interest: unknown }>(
    `SELECT DISTINCT ON (symbol) symbol, open_interest
       FROM market_oi_snapshots
      WHERE snapshot_time_utc > NOW() - INTERVAL '4 hours'
      ORDER BY symbol, snapshot_time_utc DESC`,
  );
  const oi24hAgo = await query<{ symbol: string; open_interest: unknown }>(
    `SELECT DISTINCT ON (symbol) symbol, open_interest
       FROM market_oi_snapshots
      WHERE snapshot_time_utc BETWEEN NOW() - INTERVAL '28 hours' AND NOW() - INTERVAL '20 hours'
      ORDER BY symbol, snapshot_time_utc DESC`,
  );
  const oi24Map = new Map(oi24hAgo.map((r) => [r.symbol, asNumber(r.open_interest)]));
  const oiDeltas = oiLatest.map((r) => {
    const current = asNumber(r.open_interest);
    const prev = oi24Map.get(r.symbol);
    if (current === null || prev === null || !prev) return `${r.symbol} n/a`;
    const delta = ((current - prev) / prev) * 100;
    return `${r.symbol} ${delta >= 0 ? "+" : ""}${fmt(delta, 1)}%`;
  }).join(" | ") || "no data";

  // Trades this week
  const weekStart = DateTime.utc().startOf("week").toISO();
  const tradeStats = await queryOne<{ total: number; wins: number; losses: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE COALESCE((pnl_usd)::numeric, 0) > 0)::int AS wins,
            COUNT(*) FILTER (WHERE COALESCE((pnl_usd)::numeric, 0) <= 0)::int AS losses
       FROM bitget_bot_trades
      WHERE bot_id = 'bitget_perp_v2'
        AND entry_time_utc >= $1`,
    [weekStart],
  );
  const t = tradeStats ?? { total: 0, wins: 0, losses: 0 };
  const tradesThisWeek = `${t.total} (${t.wins}W, ${t.losses}L)`;

  return { weeklyBias, botLifecycle: lifecycle, openPositions: openCount, ranges, oiDeltas, funding, tradesThisWeek };
}

// ─── FOREX ────────────────────────────────

export type ForexBriefing = {
  signals: string;
  oandaBot: string;
  crowding: string;
};

export async function getForexBriefingData(): Promise<ForexBriefing> {
  // COT signals (latest FX snapshot)
  const cotRow = await queryOne<{ pairs: unknown }>(
    `SELECT pairs FROM cot_snapshots WHERE asset_class = 'fx' ORDER BY report_date DESC, fetched_at DESC LIMIT 1`,
  );
  const pairs = parseJsonRecord(cotRow?.pairs);
  const signalEntries: string[] = [];
  for (const [pair, raw] of Object.entries(pairs)) {
    const data = parseJsonRecord(raw);
    const dir = asString(data.direction)?.toUpperCase();
    if (dir) signalEntries.push(`${pair} ${dir}`);
  }
  const signals = signalEntries.slice(0, 6).join(", ") || "no signals";

  // OANDA bot state
  const oandaRow = await queryOne<{ state: unknown; updated_at: unknown }>(
    `SELECT state, updated_at FROM bot_states WHERE bot_id = 'oanda_universal_bot' ORDER BY updated_at DESC LIMIT 1`,
  );
  const oState = parseJsonRecord(oandaRow?.state);
  const basketObj = parseJsonRecord(oState.basket);
  const trailingObj = parseJsonRecord(oState.trailing);
  const entered = Boolean(oState.entered ?? basketObj.entered);
  const trailing = Boolean(oState.trailing_active ?? trailingObj.active);
  const positions = asNumber(oState.positions_opened ?? oState.open_positions) ?? 0;
  const botLabel = trailing ? "trailing" : entered ? "entered" : "idle";
  const oandaBot = `${botLabel} | ${positions} positions`;

  // Sentiment crowding
  const sentimentRows = await query<{ symbol: string; crowding_state: string; agg_net: unknown }>(
    `SELECT DISTINCT ON (symbol) symbol, crowding_state, agg_net
       FROM sentiment_aggregates
      WHERE timestamp_utc > NOW() - INTERVAL '2 hours'
      ORDER BY symbol, timestamp_utc DESC`,
  );
  const crowded = sentimentRows
    .filter((r) => r.crowding_state?.toUpperCase().includes("CROWDED"))
    .map((r) => `${r.symbol} ${r.crowding_state.toUpperCase()}`);
  const crowding = crowded.join(", ") || "none";

  return { signals, oandaBot, crowding };
}

// ─── ACCOUNTS ─────────────────────────────

export type AccountsBriefing = {
  mt5Summary: string;
  connectedSummary: string;
};

export async function getAccountsBriefingData(): Promise<AccountsBriefing> {
  // MT5
  const mt5Rows = await query<{
    account_id: string; label: string | null; equity: unknown;
    basket_state: string | null; api_ok: boolean;
  }>(
    `SELECT account_id, label, equity, basket_state, api_ok
       FROM mt5_accounts WHERE UPPER(status) = 'ACTIVE' ORDER BY account_id`,
  );
  const mt5Count = mt5Rows.length;
  const totalEquity = mt5Rows.reduce((sum, r) => sum + (asNumber(r.equity) ?? 0), 0);
  const basketStates = [...new Set(mt5Rows.map((r) => r.basket_state?.toUpperCase()).filter(Boolean))];
  const mt5Summary = `${mt5Count} active | ${fmtUsd(totalEquity)} equity | basket ${basketStates.join("/") || "n/a"}`;

  // Connected accounts
  const connRows = await query<{ account_key: string; provider: string; status: string | null }>(
    `SELECT DISTINCT ON (account_key) account_key, provider, status
       FROM connected_accounts ORDER BY account_key, updated_at DESC`,
  );
  const providers = new Map<string, number>();
  for (const r of connRows) {
    providers.set(r.provider, (providers.get(r.provider) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [prov, count] of providers.entries()) {
    parts.push(`${prov}: ${count}`);
  }
  const connectedSummary = parts.join(", ") || "none";

  return { mt5Summary, connectedSummary };
}

// ─── SYSTEM HEALTH ────────────────────────

export type SystemHealthBriefing = {
  cronLine: string;
  dataLine: string;
};

export async function getSystemHealthData(): Promise<SystemHealthBriefing> {
  let summary: CronStatusSummary;
  try {
    summary = await getCronStatusSummary();
  } catch {
    return { cronLine: "error fetching cron status", dataLine: "" };
  }

  const stale = summary.subsystems.filter((s) => s.state !== "ok");
  if (!stale.length) {
    return { cronLine: "all healthy \u2713", dataLine: "all fresh \u2713" };
  }

  const cronIssues = stale.map((s) => `${s.label} ${s.state.toUpperCase()}`).join(", ");
  return { cronLine: cronIssues, dataLine: `${stale.length}/${summary.subsystems.length} issues` };
}

// ─── NEWS ─────────────────────────────────

export type NewsBriefing = {
  lines: string[];
};

export async function getNewsBriefingData(): Promise<NewsBriefing> {
  const row = await queryOne<{ calendar: unknown }>(
    `SELECT calendar FROM news_weekly_snapshots ORDER BY week_open_utc DESC, fetched_at DESC LIMIT 1`,
  );
  const calendar = Array.isArray(row?.calendar) ? row.calendar : [];
  const now = DateTime.utc();
  const horizon = now.plus({ hours: 24 });
  const lines: string[] = [];

  for (const raw of calendar) {
    const event = parseJsonRecord(raw);
    const impact = asString(event.impact)?.toUpperCase();
    if (impact !== "HIGH") continue;

    const datetimeUtc = asString(event.datetime_utc);
    if (!datetimeUtc) continue;

    const dt = DateTime.fromISO(datetimeUtc, { zone: "utc" });
    if (!dt.isValid || dt < now || dt > horizon) continue;

    const title = asString(event.title) ?? "Event";
    const currency = asString(event.currency) ?? "";
    const forecast = asString(event.forecast) ?? "n/a";
    const previous = asString(event.previous) ?? "n/a";
    const timeStr = dt.toFormat("HH:mm 'UTC'");
    const diffMins = Math.floor(dt.diff(now, "minutes").minutes);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    const timeUntil = h > 0 ? `in ${h}h${m > 0 ? ` ${m}m` : ""}` : `in ${m}m`;

    lines.push(`\u26A0 ${currency} ${title} ${timeUntil} (${timeStr}) | F: ${forecast} P: ${previous}`);
    if (lines.length >= 5) break;
  }

  return { lines };
}

// ─── PERFORMANCE (Pre-NY only) ────────────

export type PerformanceBriefing = {
  line: string;
};

export async function getPerformanceData(): Promise<PerformanceBriefing> {
  const weekStart = DateTime.utc().startOf("week").toISO();
  const rows = await query<{ model: string; percent: unknown; returns: unknown }>(
    `SELECT model, percent, returns FROM performance_snapshots WHERE week_open_utc >= $1 ORDER BY model`,
    [weekStart],
  );
  if (!rows.length) return { line: "no data this week" };
  const parts = rows.map((r) => `${r.model}: ${fmtPct(asNumber(r.percent), 1)}`);
  return { line: parts.join(" | ") };
}

// ─── MARKET DATA ──────────────────────────

export type MarketDataBriefing = {
  liquidations: string;
};

export async function getMarketDataBriefing(): Promise<MarketDataBriefing> {
  const liqRows = await query<{ symbol: string; dominant_side: string; total_long_usd: unknown; total_short_usd: unknown }>(
    `SELECT DISTINCT ON (symbol) symbol, dominant_side, total_long_usd, total_short_usd
       FROM market_liquidation_snapshots
      WHERE snapshot_time_utc > NOW() - INTERVAL '2 hours'
      ORDER BY symbol, snapshot_time_utc DESC`,
  );
  const parts = liqRows.map((r) => `${r.symbol} dom ${r.dominant_side?.toUpperCase() ?? "?"}`);
  return { liquidations: parts.join(" | ") || "no data" };
}

// ─── ASSEMBLE ALL ─────────────────────────

export type SessionType = "pre_asia" | "pre_ny";

export async function assembleBriefingData(sessionType: SessionType): Promise<string> {
  const [crypto, forex, accounts, health, news, performance, market] = await Promise.all([
    getCryptoBriefingData().catch(() => null),
    getForexBriefingData().catch(() => null),
    getAccountsBriefingData().catch(() => null),
    getSystemHealthData().catch(() => null),
    getNewsBriefingData().catch(() => null),
    sessionType === "pre_ny" ? getPerformanceData().catch(() => null) : Promise.resolve(null),
    getMarketDataBriefing().catch(() => null),
  ]);

  const sections: string[] = [];

  // CRYPTO
  if (crypto) {
    sections.push([
      "CRYPTO",
      `  Bias: ${crypto.weeklyBias}`,
      `  Bot: ${crypto.botLifecycle} | ${crypto.openPositions} positions`,
      `  Ranges: ${crypto.ranges}`,
      `  OI: ${crypto.oiDeltas}`,
      `  Funding: ${crypto.funding}`,
      `  Trades this week: ${crypto.tradesThisWeek}`,
    ].join("\n"));
  }

  // FOREX
  if (forex) {
    sections.push([
      "FOREX",
      `  Signals: ${forex.signals}`,
      `  OANDA Bot: ${forex.oandaBot}`,
      `  Crowding: ${forex.crowding}`,
    ].join("\n"));
  }

  // ACCOUNTS
  if (accounts) {
    sections.push([
      "ACCOUNTS",
      `  MT5: ${accounts.mt5Summary}`,
      `  Connected: ${accounts.connectedSummary}`,
    ].join("\n"));
  }

  // SYSTEM
  if (health) {
    sections.push([
      "SYSTEM",
      `  Crons: ${health.cronLine}`,
      `  Data: ${health.dataLine}`,
    ].join("\n"));
  }

  // NEWS
  if (news && news.lines.length > 0) {
    sections.push(["NEWS", ...news.lines.map((l) => `  ${l}`)].join("\n"));
  } else {
    sections.push("NEWS\n  No high-impact events in next 24h");
  }

  // MARKET DATA
  if (market) {
    sections.push([
      "MARKET",
      `  Liquidations: ${market.liquidations}`,
    ].join("\n"));
  }

  // PERFORMANCE (Pre-NY only)
  if (performance && sessionType === "pre_ny") {
    sections.push([
      "PERFORMANCE",
      `  ${performance.line}`,
    ].join("\n"));
  }

  return sections.join("\n\n");
}
