/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: probe-menthorq-gex.ts
 *
 * Day-1 MenthorQ capability probe:
 * - endpoint/auth discovery for GEX-like data
 * - symbol coverage checks
 * - historical lookback depth checks
 * - writes dated + latest capability artifacts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { loadEnvConfig } from "@next/env";

type CliConfig = {
  baseUrl: string;
  apiKey: string;
  endpoints: string[];
  symbols: string[];
  interval: string;
  lookbackDays: number[];
  timeoutMs: number;
  outPath: string;
  dryRun: boolean;
};

type EndpointProbe = {
  endpoint: string;
  success: boolean;
  status: number | null;
  authMode: string | null;
  queryMode: string | null;
  url: string | null;
  hasData: boolean;
  rowCount: number | null;
  error: string | null;
};

type SymbolCoverageRow = {
  symbol: string;
  ok: boolean;
  status: number | null;
  hasData: boolean;
  rowCount: number | null;
  error: string | null;
};

type LookbackRow = {
  days: number;
  ok: boolean;
  status: number | null;
  hasData: boolean;
  rowCount: number | null;
  earliestTimestampUtc: string | null;
  error: string | null;
};

const DEFAULT_BASE_URL = "https://api.menthorq.com";
const DEFAULT_ENDPOINTS = [
  "/v1/gex",
  "/v1/gamma-exposure",
  "/v1/options/gex",
  "/v1/market/gex",
  "/api/v1/gex",
  "/api/v1/gamma-exposure",
];
const DEFAULT_SYMBOLS = ["SPX", "NDX", "VIX", "DXY", "ES", "NQ"];
const DEFAULT_LOOKBACK_DAYS = [7, 30, 90, 180, 365];

function parseArgs(): CliConfig {
  const byKey = new Map<string, string>();
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    byKey.set(key.trim(), rest.join("="));
  }

  const baseUrl = (byKey.get("base-url")?.trim() || process.env.MENTHORQ_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const apiKey = byKey.get("api-key")?.trim() || process.env.MENTHORQ_API_KEY || "";
  const endpoints = parseCsv(byKey.get("endpoints"), DEFAULT_ENDPOINTS).map((value) => (value.startsWith("/") ? value : `/${value}`));
  const symbols = parseCsv(byKey.get("symbols"), DEFAULT_SYMBOLS).map((value) => value.toUpperCase());
  const interval = byKey.get("interval")?.trim() || process.env.MENTHORQ_INTERVAL || "1h";
  const timeoutRaw = Number(byKey.get("timeout-ms"));
  const timeoutMs = Number.isFinite(timeoutRaw) ? Math.max(1000, Math.floor(timeoutRaw)) : 15000;
  const outPath = byKey.get("out")?.trim() || "app/reports/bias-gate/menthorq-capability-latest.json";
  const dryRunRaw = String(byKey.get("dry-run") ?? "").trim().toLowerCase();
  const dryRun = dryRunRaw === "1" || dryRunRaw === "true" || dryRunRaw === "yes" || dryRunRaw === "on";
  const lookbackDays = parseCsv(byKey.get("lookback-days"), DEFAULT_LOOKBACK_DAYS.map(String))
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.floor(value));

  return {
    baseUrl,
    apiKey,
    endpoints,
    symbols,
    interval,
    lookbackDays: lookbackDays.length > 0 ? lookbackDays : DEFAULT_LOOKBACK_DAYS,
    timeoutMs,
    outPath,
    dryRun,
  };
}

function parseCsv(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || raw.trim().length === 0) return fallback;
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return parsed.length > 0 ? parsed : fallback;
}

function buildAuthModes(apiKey: string) {
  if (!apiKey) return [];
  return [
    {
      mode: "bearer",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    {
      mode: "x-api-key",
      headers: { "x-api-key": apiKey },
    },
  ];
}

function buildQueryVariants(symbol: string, interval: string, startUtc: string, endUtc: string) {
  const shared = {
    interval,
    timeframe: interval,
    tf: interval,
    start: startUtc,
    end: endUtc,
    start_time: startUtc,
    end_time: endUtc,
  };
  return [
    {
      mode: "symbol",
      params: {
        symbol,
        interval: shared.interval,
        start: shared.start,
        end: shared.end,
      },
    },
    {
      mode: "ticker",
      params: {
        ticker: symbol,
        timeframe: shared.timeframe,
        start_time: shared.start_time,
        end_time: shared.end_time,
      },
    },
    {
      mode: "underlying",
      params: {
        underlying: symbol,
        tf: shared.tf,
        from: shared.start,
        to: shared.end,
      },
    },
  ];
}

function withParams(url: string, params: Record<string, string>) {
  const u = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value.trim().length > 0) u.searchParams.set(key, value);
  });
  return u.toString();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonSafe(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function extractRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
  }
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const candidates = [obj.data, obj.rows, obj.items, obj.results, obj.result];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
    }
  }
  return [];
}

function extractEarliestTimestampUtc(rows: Array<Record<string, unknown>>): string | null {
  const keys = ["timestamp", "time", "datetime", "date", "ts", "t"];
  const millis: number[] = [];
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value !== "string" && typeof value !== "number") continue;
      const parsed = typeof value === "number"
        ? DateTime.fromMillis(value > 10_000_000_000 ? value : value * 1000, { zone: "utc" })
        : DateTime.fromISO(value, { zone: "utc" });
      if (parsed.isValid) {
        millis.push(parsed.toMillis());
      }
    }
  }
  if (millis.length === 0) return null;
  const min = Math.min(...millis);
  return DateTime.fromMillis(min, { zone: "utc" }).toISO();
}

async function tryRequest(options: {
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
}) {
  try {
    const response = await fetchWithTimeout(
      options.url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...options.headers,
        },
      },
      options.timeoutMs,
    );
    const text = await response.text();
    const payload = parseJsonSafe(text);
    const rows = extractRows(payload);
    return {
      ok: response.ok,
      status: response.status,
      hasData: rows.length > 0,
      rowCount: rows.length,
      earliestTimestampUtc: extractEarliestTimestampUtc(rows),
      payload,
      error: response.ok ? null : `HTTP_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      hasData: false,
      rowCount: 0,
      earliestTimestampUtc: null,
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeEndpoints(options: {
  config: CliConfig;
  authModes: Array<{ mode: string; headers: Record<string, string> }>;
  seedSymbol: string;
}): Promise<{ probes: EndpointProbe[]; winner: EndpointProbe | null }> {
  const endUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const startUtc = DateTime.utc().minus({ days: 7 }).toISO() ?? new Date().toISOString();
  const probes: EndpointProbe[] = [];

  for (const endpoint of options.config.endpoints) {
    let best: EndpointProbe = {
      endpoint,
      success: false,
      status: null,
      authMode: null,
      queryMode: null,
      url: null,
      hasData: false,
      rowCount: null,
      error: "NOT_TESTED",
    };

    for (const auth of options.authModes) {
      const queries = buildQueryVariants(options.seedSymbol, options.config.interval, startUtc, endUtc);
      for (const query of queries) {
        const url = withParams(`${options.config.baseUrl}${endpoint}`, query.params);
        const result = await tryRequest({
          url,
          headers: auth.headers,
          timeoutMs: options.config.timeoutMs,
        });

        const probe: EndpointProbe = {
          endpoint,
          success: result.ok && (result.hasData || result.status === 200),
          status: result.status,
          authMode: auth.mode,
          queryMode: query.mode,
          url,
          hasData: result.hasData,
          rowCount: result.rowCount,
          error: result.error,
        };

        if (probe.success) {
          best = probe;
          break;
        }
        if (!best.success && (best.status === null || (result.status ?? 0) > (best.status ?? 0))) {
          best = probe;
        }
      }
      if (best.success) break;
    }
    probes.push(best);
  }

  const winner = probes.find((probe) => probe.success) ?? null;
  return { probes, winner };
}

async function probeSymbolCoverage(options: {
  config: CliConfig;
  winner: EndpointProbe;
  authModes: Array<{ mode: string; headers: Record<string, string> }>;
}): Promise<SymbolCoverageRow[]> {
  const out: SymbolCoverageRow[] = [];
  if (!options.winner.authMode || !options.winner.queryMode) return out;

  const auth = options.authModes.find((mode) => mode.mode === options.winner.authMode);
  if (!auth) return out;

  const endUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const startUtc = DateTime.utc().minus({ days: 7 }).toISO() ?? new Date().toISOString();

  for (const symbol of options.config.symbols) {
    const query = buildQueryVariants(symbol, options.config.interval, startUtc, endUtc).find(
      (variant) => variant.mode === options.winner.queryMode,
    );
    if (!query) continue;
    const url = withParams(`${options.config.baseUrl}${options.winner.endpoint}`, query.params);
    const result = await tryRequest({
      url,
      headers: auth.headers,
      timeoutMs: options.config.timeoutMs,
    });
    out.push({
      symbol,
      ok: result.ok,
      status: result.status,
      hasData: result.hasData,
      rowCount: result.rowCount,
      error: result.error,
    });
  }
  return out;
}

async function probeHistoricalDepth(options: {
  config: CliConfig;
  winner: EndpointProbe;
  authModes: Array<{ mode: string; headers: Record<string, string> }>;
  symbol: string;
}): Promise<LookbackRow[]> {
  const out: LookbackRow[] = [];
  if (!options.winner.authMode || !options.winner.queryMode) return out;
  const auth = options.authModes.find((mode) => mode.mode === options.winner.authMode);
  if (!auth) return out;

  for (const days of options.config.lookbackDays) {
    const endUtc = DateTime.utc().toISO() ?? new Date().toISOString();
    const startUtc = DateTime.utc().minus({ days }).toISO() ?? new Date().toISOString();
    const query = buildQueryVariants(options.symbol, options.config.interval, startUtc, endUtc).find(
      (variant) => variant.mode === options.winner.queryMode,
    );
    if (!query) continue;
    const url = withParams(`${options.config.baseUrl}${options.winner.endpoint}`, query.params);
    const result = await tryRequest({
      url,
      headers: auth.headers,
      timeoutMs: options.config.timeoutMs,
    });
    out.push({
      days,
      ok: result.ok,
      status: result.status,
      hasData: result.hasData,
      rowCount: result.rowCount,
      earliestTimestampUtc: result.earliestTimestampUtc,
      error: result.error,
    });
  }
  return out;
}

function writeArtifacts(outPath: string, payload: Record<string, unknown>) {
  const stamp = DateTime.utc().toFormat("yyyy-LL-dd_HHmmss");
  const reportsDir = path.resolve(process.cwd(), "app", "reports", "bias-gate");
  mkdirSync(reportsDir, { recursive: true });
  const latestPath = path.join(reportsDir, "menthorq-capability-latest.json");
  const datedPath = path.join(reportsDir, `menthorq-capability-${stamp}.json`);
  const customPath = path.resolve(process.cwd(), outPath);
  writeFileSync(latestPath, JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(datedPath, JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(customPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Report written (latest): ${latestPath}`);
  console.log(`Report written (dated): ${datedPath}`);
  console.log(`Report written (custom): ${customPath}`);
}

async function main() {
  loadEnvConfig(process.cwd());
  const config = parseArgs();
  const authModes = buildAuthModes(config.apiKey);

  if (config.dryRun) {
    const payload = {
      generated_utc: new Date().toISOString(),
      dry_run: true,
      config: {
        base_url: config.baseUrl,
        endpoints: config.endpoints,
        symbols: config.symbols,
        interval: config.interval,
        lookback_days: config.lookbackDays,
        timeout_ms: config.timeoutMs,
      },
      notes: [
        "Dry run only. No network requests executed.",
        "Provide MENTHORQ_API_KEY (or --api-key) and rerun without --dry-run for live probing.",
      ],
    };
    writeArtifacts(config.outPath, payload);
    return;
  }

  if (!config.apiKey) {
    const payload = {
      generated_utc: new Date().toISOString(),
      success: false,
      error: "MENTHORQ_API_KEY missing",
      next_step: "Set MENTHORQ_API_KEY in .env or pass --api-key=... and rerun.",
    };
    writeArtifacts(config.outPath, payload);
    return;
  }

  const seedSymbol = config.symbols[0] ?? "SPX";
  const endpointResult = await probeEndpoints({
    config,
    authModes,
    seedSymbol,
  });
  const winner = endpointResult.winner;

  const symbolCoverage = winner
    ? await probeSymbolCoverage({
        config,
        winner,
        authModes,
      })
    : [];
  const historicalDepth = winner
    ? await probeHistoricalDepth({
        config,
        winner,
        authModes,
        symbol: seedSymbol,
      })
    : [];

  const maxSupportedLookbackDays = historicalDepth
    .filter((row) => row.ok && row.hasData)
    .map((row) => row.days)
    .reduce((max, value) => Math.max(max, value), 0);

  const payload = {
    generated_utc: new Date().toISOString(),
    success: Boolean(winner),
    config: {
      base_url: config.baseUrl,
      endpoints_tested: config.endpoints,
      symbols_tested: config.symbols,
      interval: config.interval,
      lookback_days_tested: config.lookbackDays,
      timeout_ms: config.timeoutMs,
    },
    endpoint_discovery: {
      winner,
      probes: endpointResult.probes,
    },
    symbol_coverage: symbolCoverage,
    historical_depth: {
      seed_symbol: seedSymbol,
      checks: historicalDepth,
      max_supported_lookback_days: maxSupportedLookbackDays,
      has_6m_plus_history: maxSupportedLookbackDays >= 180,
    },
    recommendation: !winner
      ? "No usable endpoint discovered. Verify API base URL, auth format, and endpoint paths."
      : maxSupportedLookbackDays >= 180
        ? "Historical depth appears sufficient for immediate COT+GEX backtest experiments."
        : "Historical depth appears limited. Start live ingestion now and backtest once retention grows.",
  };

  console.log("MenthorQ probe complete.");
  if (winner) {
    console.log(`Endpoint winner: ${winner.endpoint} (${winner.authMode}, ${winner.queryMode})`);
  } else {
    console.log("Endpoint winner: none");
  }
  console.log(`Max supported lookback (days): ${maxSupportedLookbackDays}`);
  writeArtifacts(config.outPath, payload);
}

main().catch((error) => {
  console.error("probe-menthorq-gex failed:", error);
  process.exit(1);
});

