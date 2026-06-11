/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: tools.ts
 *
 * Description:
 * Anthropic-compatible tool registry and handlers for Proteus. Tools are
 * primarily read-only SQL queries plus local behavior-state controls.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Anthropic from "@anthropic-ai/sdk";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { query, queryOne } from "@/lib/db";
import { fetchLiquidationHeatmap } from "@/lib/coinank";
import { getBehavior, setBehavior, type BehaviorState } from "@/lib/poseidon/behavior";
import { getSessionState, updateSessionState } from "@/lib/poseidon/state";
import { config, type PoseidonBehaviorKey } from "@/lib/poseidon/config";
import { curateProteusMemory } from "@/lib/poseidon/poseidon-curator";
import { getGroupToolDefinitions } from "@/lib/poseidon/group-policy";
import { loadGroupContext, saveGroupContext } from "@/lib/poseidon/group-memory";

type ToolInput = Record<string, unknown>;
type LivePriceRow = {
  symbol: string;
  pair: string;
  price: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  timestamp: string | null;
};

type BitgetTickerResponse = {
  code?: string;
  msg?: string;
  data?: Array<{
    symbol?: string;
    lastPr?: string;
    change24h?: string;
    usdtVolume?: string;
    quoteVolume?: string;
    ts?: string;
  }>;
};

const BEHAVIOR_KEYS: PoseidonBehaviorKey[] = [
  "alertsEnabled",
  "milestoneAlerts",
  "biasAlerts",
  "errorAlerts",
  "verboseMode",
];
const BITGET_BASE_URL = "https://api.bitget.com";
const LIVE_PRICE_CACHE_TTL_MS = 10_000;
const MAX_LIVE_PRICE_SYMBOLS = 12;
const MAX_HEATMAP_SYMBOLS = 6;
const HEATMAP_DEFAULT_EXCHANGES = ["Binance", "Bybit"];
const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;
const ARCHIVE_MAX_RESPONSE_CHARS = 8_000;
const ARCHIVE_MAX_QUERY_SECTION_CHARS = 4_000;
const livePriceCache = new Map<string, { expiresAt: number; row: LivePriceRow }>();

function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function normalizeLimit(raw: unknown, fallback = 20, cap = 200) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), cap);
}

function isBehaviorKey(value: unknown): value is PoseidonBehaviorKey {
  return typeof value === "string" && BEHAVIOR_KEYS.includes(value as PoseidonBehaviorKey);
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBitgetProductType() {
  const raw = String(process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES").trim();
  return raw || "USDT-FUTURES";
}

function normalizeLivePriceSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return null;

  const full = clean.endsWith("USDT") ? clean : `${clean}USDT`;
  if (!/^[A-Z0-9]{4,18}$/.test(full)) return null;
  return full;
}

function formatTimestamp(ts: unknown): string | null {
  const millis = Number(ts);
  if (!Number.isFinite(millis) || millis <= 0) return null;
  return new Date(millis).toISOString();
}

function compactSymbol(pair: string): string {
  return pair.endsWith("USDT") ? pair.slice(0, -4) : pair;
}

function normalizeBaseSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return null;
  return clean.endsWith("USDT") ? clean.slice(0, -4) : clean;
}

function normalizeHeatmapInterval(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  return text || "1d";
}

function normalizeHeatmapExchanges(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return HEATMAP_DEFAULT_EXCHANGES;
  }

  const normalized = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!normalized.length) {
    return HEATMAP_DEFAULT_EXCHANGES;
  }
  return Array.from(new Set(normalized));
}

function sanitizeMonthInput(raw: string): string | null {
  const trimmed = raw.trim();
  return MONTH_FORMAT.test(trimmed) ? trimmed : null;
}

function assertPathContainment(filePath: string, allowedDir: string): void {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(allowedDir);
  const relative = path.relative(resolvedDir, resolvedFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path traversal blocked");
  }
}

function filterArchiveSections(content: string, query: string): string {
  const sections = content.split(/(?=^### )/m);
  const matches = sections.filter((section) => section.toLowerCase().includes(query));
  return matches.join("\n").trim().slice(0, ARCHIVE_MAX_QUERY_SECTION_CHARS);
}

function extractArchiveSummary(content: string): string {
  const match = content.match(/## Summary\n([\s\S]*?)(?=\n---|\n## )/);
  return match?.[1]?.trim().slice(0, 300) || "No summary available.";
}

async function getSessionArchive(input: ToolInput): Promise<string> {
  const archiveDir = path.resolve(process.cwd(), config.stateDir, "..", "archives");
  const queryText = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
  const rawMonth = typeof input.month === "string" ? input.month.trim() : "";

  if (rawMonth) {
    const month = sanitizeMonthInput(rawMonth);
    if (!month) {
      return "Invalid month format. Use YYYY-MM (e.g. '2026-02').";
    }

    const filePath = path.join(archiveDir, `${month}.md`);
    assertPathContainment(filePath, archiveDir);
    try {
      const content = await readFile(filePath, "utf8");
      if (!queryText) {
        return content.slice(0, ARCHIVE_MAX_RESPONSE_CHARS);
      }
      const filtered = filterArchiveSections(content, queryText);
      return filtered || `No archive entries found in ${month} matching "${queryText}".`;
    } catch {
      return `No archive found for ${month}.`;
    }
  }

  try {
    const files = await readdir(archiveDir);
    const mdFiles = files
      .filter((file) => file.endsWith(".md"))
      .sort()
      .reverse();

    if (!mdFiles.length) return "No archives exist yet.";

    if (!queryText) {
      const summaries: string[] = [];
      for (const file of mdFiles.slice(0, 12)) {
        const filePath = path.join(archiveDir, file);
        assertPathContainment(filePath, archiveDir);
        const content = await readFile(filePath, "utf8");
        summaries.push(`**${file.replace(".md", "")}**: ${extractArchiveSummary(content)}`);
      }
      return summaries.join("\n\n");
    }

    const results: string[] = [];
    for (const file of mdFiles) {
      const filePath = path.join(archiveDir, file);
      assertPathContainment(filePath, archiveDir);
      const content = await readFile(filePath, "utf8");
      const matches = filterArchiveSections(content, queryText);
      if (matches) {
        results.push(`--- ${file.replace(".md", "")} ---\n${matches}`);
      }
    }

    if (!results.length) return `No archive entries found matching "${queryText}".`;
    return results.join("\n\n").slice(0, ARCHIVE_MAX_RESPONSE_CHARS);
  } catch {
    return "Archive directory not found. No archives exist yet.";
  }
}

async function fetchBitgetTicker(symbol: string): Promise<LivePriceRow> {
  const productType = getBitgetProductType();
  const url = new URL(`${BITGET_BASE_URL}/api/v2/mix/market/ticker`);
  url.searchParams.set("productType", productType);
  url.searchParams.set("symbol", symbol);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const suffix = body ? `: ${body.slice(0, 200)}` : "";
    throw new Error(`Bitget ticker failed (${response.status})${suffix}`);
  }

  const payload = (await response.json()) as BitgetTickerResponse;
  const row = Array.isArray(payload.data) ? payload.data[0] : null;
  if (!row || (payload.code && payload.code !== "00000")) {
    throw new Error(payload.msg || `No ticker data for ${symbol}`);
  }

  return {
    symbol: compactSymbol(symbol),
    pair: symbol,
    price: toFiniteNumber(row.lastPr),
    change24hPct: (() => {
      const ratio = toFiniteNumber(row.change24h);
      return ratio === null ? null : ratio * 100;
    })(),
    volume24hUsd: toFiniteNumber(row.usdtVolume ?? row.quoteVolume),
    timestamp: formatTimestamp(row.ts),
  };
}

async function getLivePricesFromInput(input: ToolInput) {
  const rawSymbols = Array.isArray(input.symbols) ? input.symbols : [];
  const normalized = rawSymbols
    .map(normalizeLivePriceSymbol)
    .filter((value): value is string => Boolean(value));
  const uniqueSymbols = Array.from(new Set(normalized)).slice(0, MAX_LIVE_PRICE_SYMBOLS);

  if (!uniqueSymbols.length) {
    return {
      error: "get_live_prices requires `symbols` as a non-empty string array (e.g. [\"BTC\", \"ETH\"]).",
      results: [] as LivePriceRow[],
    };
  }

  const now = Date.now();
  const cacheHits: LivePriceRow[] = [];
  const toFetch: string[] = [];

  for (const symbol of uniqueSymbols) {
    const cached = livePriceCache.get(symbol);
    if (cached && cached.expiresAt > now) {
      cacheHits.push(cached.row);
      continue;
    }
    toFetch.push(symbol);
  }

  const fetched = await Promise.all(
    toFetch.map(async (symbol) => {
      try {
        const row = await fetchBitgetTicker(symbol);
        livePriceCache.set(symbol, { row, expiresAt: Date.now() + LIVE_PRICE_CACHE_TTL_MS });
        return row;
      } catch (error) {
        return {
          symbol: compactSymbol(symbol),
          pair: symbol,
          price: null,
          change24hPct: null,
          volume24hUsd: null,
          timestamp: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const merged = [...cacheHits, ...fetched];
  const order = new Map(uniqueSymbols.map((symbol, idx) => [symbol, idx]));
  merged.sort((a, b) => (order.get(a.pair) ?? 99) - (order.get(b.pair) ?? 99));

  return {
    productType: getBitgetProductType(),
    cachedTtlMs: LIVE_PRICE_CACHE_TTL_MS,
    asOfUtc: new Date().toISOString(),
    results: merged,
  };
}

async function getLiquidationHeatmapFromInput(input: ToolInput) {
  const rawSymbols = Array.isArray(input.symbols) ? input.symbols : [];
  const symbols = Array.from(
    new Set(
      rawSymbols
        .map(normalizeBaseSymbol)
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, MAX_HEATMAP_SYMBOLS);

  if (!symbols.length) {
    return {
      error: "get_liquidation_heatmap requires `symbols` as a non-empty string array (e.g. [\"BTC\", \"ETH\"]).",
      results: [],
    };
  }

  const interval = normalizeHeatmapInterval(input.interval);
  const exchanges = normalizeHeatmapExchanges(input.exchanges);

  const settled = await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        return await fetchLiquidationHeatmap(symbol, { interval, exchanges });
      } catch (error) {
        return {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const results: Array<Record<string, unknown>> = [];
  for (const item of settled) {
    if (item.status === "fulfilled") {
      results.push(item.value as Record<string, unknown>);
    } else {
      results.push({
        symbol: "unknown",
        error: item.reason instanceof Error ? item.reason.message : String(item.reason),
      });
    }
  }

  return {
    asOfUtc: new Date().toISOString(),
    interval,
    exchanges,
    results,
  };
}

async function getBotState() {
  const row = await queryOne<{
    bot_id: string;
    state: Record<string, unknown> | null;
    updated_at: string;
  }>(
    `SELECT bot_id, state, updated_at
       FROM bot_states
      WHERE bot_id = 'bitget_perp_v2'
      ORDER BY updated_at DESC
      LIMIT 1`,
  );
  if (row) return row;

  return await queryOne<{
    bot_id: string;
    state: Record<string, unknown> | null;
    updated_at: string;
  }>(
    `SELECT bot_id, state, updated_at
       FROM bot_states
      ORDER BY updated_at DESC
      LIMIT 1`,
  );
}

async function getRecentTrades(limit: number) {
  return await query(
    `SELECT id, bot_id, strategy_id, symbol, direction, session_window, range_source,
            entry_time_utc, entry_price, exit_time_utc, exit_price, exit_reason,
            stop_price, initial_leverage, max_leverage_reached, milestones_hit,
            freed_margin_usd, pnl_usd, metadata, created_at, updated_at
       FROM bitget_bot_trades
      ORDER BY entry_time_utc DESC
      LIMIT $1`,
    [limit],
  );
}

async function getRecentSignals(limit: number) {
  return await query(
    `SELECT id, bot_id, day_utc, symbol, session_window, confirm_time_utc,
            direction, sweep_pct, displacement_pct, handshake_group_id, status, metadata, created_at
       FROM bitget_bot_signals
      ORDER BY confirm_time_utc DESC
      LIMIT $1`,
    [limit],
  );
}

async function getSessionRanges() {
  return await query(
    `SELECT id, bot_id, day_utc, symbol, range_source, high, low, locked_at_utc, created_at
       FROM bitget_bot_ranges
      WHERE day_utc >= CURRENT_DATE - 1
      ORDER BY day_utc DESC, range_source, symbol`,
  );
}

async function getMarketSnapshot(limit: number) {
  const [funding, oi, liquidation] = await Promise.all([
    query(
      `SELECT symbol, funding_rate, next_funding_time, snapshot_time_utc, source
         FROM market_funding_snapshots
        WHERE snapshot_time_utc >= NOW() - INTERVAL '24 hours'
        ORDER BY snapshot_time_utc DESC
        LIMIT $1`,
      [limit],
    ),
    query(
      `SELECT symbol, open_interest, price_at_snapshot, snapshot_time_utc, source
         FROM market_oi_snapshots
        WHERE snapshot_time_utc >= NOW() - INTERVAL '24 hours'
        ORDER BY snapshot_time_utc DESC
        LIMIT $1`,
      [limit],
    ),
    query(
      `SELECT symbol, total_long_usd, total_short_usd, dominant_side, reference_price,
              largest_above_price, largest_above_notional, largest_below_price, largest_below_notional,
              clusters_json, snapshot_time_utc, source
         FROM market_liquidation_snapshots
        WHERE snapshot_time_utc >= NOW() - INTERVAL '24 hours'
        ORDER BY snapshot_time_utc DESC
        LIMIT $1`,
      [limit],
    ),
  ]);

  return { funding, oi, liquidation };
}

async function getWeeklyBias() {
  const row = await getBotState();
  const state = row?.state;
  if (!state || typeof state !== "object") {
    return { bot_id: row?.bot_id ?? null, weekly_bias: null, updated_at: row?.updated_at ?? null };
  }
  return {
    bot_id: row?.bot_id ?? null,
    weekly_bias: state.weeklyBias ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

async function setBehaviorFromInput(input: ToolInput): Promise<BehaviorState> {
  const updatesRaw = input.updates;
  if (updatesRaw && typeof updatesRaw === "object" && !Array.isArray(updatesRaw)) {
    for (const [key, value] of Object.entries(updatesRaw)) {
      if (!isBehaviorKey(key)) continue;
      await setBehavior(key, Boolean(value));
    }
    return await getBehavior();
  }

  const flag = input.flag;
  const value = input.value;
  if (!isBehaviorKey(flag)) {
    throw new Error(`Invalid behavior flag. Allowed: ${BEHAVIOR_KEYS.join(", ")}`);
  }
  if (typeof value !== "boolean") {
    throw new Error("set_behavior requires boolean `value`.");
  }
  return await setBehavior(flag, value);
}

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_bot_state",
    description: "Get the current Bitget bot state including lifecycle, positions, weekly bias, and handshake status.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_recent_trades",
    description: "Get recent Bitget trades with PnL and execution details.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 200 },
      },
      required: [],
    },
  },
  {
    name: "get_recent_signals",
    description: "Get recent Bitget signal detections and statuses.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 200 },
      },
      required: [],
    },
  },
  {
    name: "get_session_ranges",
    description: "Get today and yesterday session ranges from Bitget bot range tracking.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_market_snapshot",
    description: "Get recent market funding/open-interest/liquidation snapshots (not real-time ticker prices).",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 200 },
      },
      required: [],
    },
  },
  {
    name: "get_weekly_bias",
    description: "Get currently active weekly bias (direction + tier) for BTC/ETH from bot state.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_live_prices",
    description: "Get live Bitget futures ticker prices on-demand for specific symbols. Use this for current/real-time price questions.",
    input_schema: {
      type: "object",
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: MAX_LIVE_PRICE_SYMBOLS,
          description: "Base symbols or pairs (e.g. [\"BTC\", \"ETH\"] or [\"BTCUSDT\"]).",
        },
      },
      required: ["symbols"],
    },
  },
  {
    name: "get_liquidation_heatmap",
    description: "Get swing-level liquidation heatmap density bands (±2/5/10/15/25%) for big-zone analysis. Use only when user asks for swing heatmap/big liquidation zones.",
    input_schema: {
      type: "object",
      properties: {
        symbols: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: MAX_HEATMAP_SYMBOLS,
          description: "Base symbols or pairs (e.g. [\"BTC\", \"ETH\"] or [\"BTCUSDT\"]).",
        },
        interval: {
          type: "string",
          description: "CoinAnk heatmap interval (default: 1d).",
        },
        exchanges: {
          type: "array",
          items: { type: "string" },
          description: "Optional exchange list. Defaults to Binance + Bybit.",
        },
      },
      required: ["symbols"],
    },
  },
  {
    name: "get_behavior",
    description: "Read Poseidon runtime behavior flags from local state.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "set_behavior",
    description: "Update Poseidon runtime behavior flags in local state.",
    input_schema: {
      type: "object",
      properties: {
        flag: {
          type: "string",
          enum: BEHAVIOR_KEYS,
        },
        value: {
          type: "boolean",
        },
        updates: {
          type: "object",
          additionalProperties: { type: "boolean" },
        },
      },
      required: [],
    },
  },
  {
    name: "get_session_state",
    description: "Read the current PROTEUS_STATE.md — your persistent memory of what's been discussed, decisions made, and current context.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_session_archive",
    description: "Search archived memory for resolved projects, past trades, and historical decisions by keyword or month.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword/phrase to search archives (e.g. 'ETH trade', 'liquidation research').",
        },
        month: {
          type: "string",
          description: "Specific month in YYYY-MM format (e.g. '2026-02').",
        },
      },
      required: [],
    },
  },
  {
    name: "request_poseidon_curation",
    description: "Call Poseidon to curate memory by archiving resolved items and keeping active state lean.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Optional reason for curation request.",
        },
      },
      required: [],
    },
  },
  {
    name: "update_session_state",
    description: "Update your persistent session state (PROTEUS_STATE.md). Call this after significant conversations — decisions made, important discussions, strategy changes, or when Freedom asks you to remember something. Write in markdown. Include: current focus, recent decisions, open threads, anything you need to remember across restarts.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Markdown content for the session state. Should capture: current context, recent decisions, open threads, key things to remember.",
        },
      },
      required: ["content"],
    },
  },
];

export { getGroupToolDefinitions };

/** Active group ID for group tool calls. Set by the group handler before invoking chat. */
let activeGroupId: number | null = null;

export function setActiveGroupId(groupId: number | null): void {
  activeGroupId = groupId;
}

export async function handleToolCall(name: string, input: ToolInput): Promise<string> {
  try {
    switch (name) {
      case "get_bot_state": {
        return toJson(await getBotState());
      }
      case "get_recent_trades": {
        const limit = normalizeLimit(input.limit, 20);
        return toJson(await getRecentTrades(limit));
      }
      case "get_recent_signals": {
        const limit = normalizeLimit(input.limit, 20);
        return toJson(await getRecentSignals(limit));
      }
      case "get_session_ranges": {
        return toJson(await getSessionRanges());
      }
      case "get_market_snapshot": {
        const limit = normalizeLimit(input.limit, 100);
        return toJson(await getMarketSnapshot(limit));
      }
      case "get_weekly_bias": {
        return toJson(await getWeeklyBias());
      }
      case "get_live_prices": {
        return toJson(await getLivePricesFromInput(input));
      }
      case "get_liquidation_heatmap": {
        return toJson(await getLiquidationHeatmapFromInput(input));
      }
      case "get_behavior": {
        return toJson(await getBehavior());
      }
      case "set_behavior": {
        return toJson(await setBehaviorFromInput(input));
      }
      case "get_session_state": {
        const state = await getSessionState();
        return state || "No session state saved yet.";
      }
      case "get_session_archive": {
        return await getSessionArchive(input);
      }
      case "request_poseidon_curation": {
        const reason = typeof input.reason === "string" ? input.reason.trim() : "";
        const result = await curateProteusMemory(reason || undefined);
        return toJson(result);
      }
      case "update_session_state": {
        const content = input.content;
        if (typeof content !== "string" || !content.trim()) {
          return "Error: content is required and must be a non-empty string.";
        }
        return await updateSessionState(content);
      }
      case "get_group_context": {
        if (!activeGroupId) return "No active group context.";
        const ctx = await loadGroupContext(activeGroupId);
        return ctx || "No group context saved yet.";
      }
      case "update_group_context": {
        if (!activeGroupId) return "Error: no active group.";
        const content = input.content;
        if (typeof content !== "string" || !content.trim()) {
          return "Error: content is required and must be a non-empty string.";
        }
        await saveGroupContext(activeGroupId, content);
        return "Group context updated.";
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Tool error [${name}]: ${error instanceof Error ? error.message : String(error)}`;
  }
}
