import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_GATED_SETUPS_BOARD } from "@/lib/performance/gatedSetupsDefault";
import {
  readNearestLiquidationHeatmapSnapshot,
  type LiquidationHeatmapSnapshotRow,
} from "@/lib/marketSnapshots";
import {
  buildLiquidationAdvisory,
  type LiquidationTradeDirection,
} from "@/lib/bitgetLiquidationFeatures";
import { readLatestMenthorqSnapshots } from "@/lib/menthorqOverlay";

const SKIP_ONLY_MODE = process.env.PERFORMANCE_GATE_SKIP_ONLY !== "0";
const DEFAULT_WEEKLY_BOARD_PATH = path.resolve(
  process.cwd(),
  "reports",
  "bias-gate",
  "weekly-signal-board-latest.json",
);
const DEFAULT_MENTHORQ_GAMMA_CSV = path.resolve(
  process.cwd(),
  "reports",
  "bias-gate",
  "menthorq-gamma-daily.csv",
);
const DEFAULT_MENTHORQ_MAP_CSV = path.resolve(
  process.cwd(),
  "reports",
  "bias-gate",
  "menthorq-gamma-symbol-map-template.csv",
);
const CRYPTO_SYMBOL_BY_PAIR = new Map<string, "BTC" | "ETH">([
  ["BTCUSD", "BTC"],
  ["ETHUSD", "ETH"],
]);
const HEATMAP_INTERVALS = ["6h", "1d", "7d", "30d"] as const;

type GateDecision = "PASS" | "SKIP" | "NO_DATA";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type GateDecisionSource =
  | "WEEKLY_BOARD"
  | "CRYPTO_LIQUIDATION_LIVE"
  | "MENTHORQ_GAMMA_DAILY"
  | "WEEKLY_BOARD_PLUS_MENTHORQ";
type GammaCondition = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";

type GatedSetupSignal = {
  assetClass: string;
  pair: string;
  dealer: string;
  commercial: string;
  sentiment: string;
  direction: SignalDirection;
  tier: SignalTier;
  gateDecision: GateDecision;
  gateReasons: string[];
  basePct: number | null;
  quotePct: number | null;
  actionable8w: number;
  flips8w: number;
  consistency8w: number;
  gateDecisionSource: GateDecisionSource;
  gateAsOfUtc: string | null;
};

type GatedSetupsPayload = {
  sourcePath: string;
  generatedUtc: string | null;
  currentWeekOpenUtc: string | null;
  weeksUsedForStability: string[];
  summary: {
    total: number;
    pass: number;
    skip: number;
    noData: number;
    actionable: number;
    highTier: number;
    mediumTier: number;
    neutralTier: number;
  };
  signals: GatedSetupSignal[];
  skipOnlyMode: boolean;
};

type GammaSnapshotEntry = {
  dateIso: string;
  dateMs: number;
  condition: GammaCondition;
};

type GammaPairMapEntry = {
  pair: string;
  baseSymbol: string | null;
  quoteSymbol: string | null;
  enabled: boolean;
};

type GammaContext = {
  bySymbol: Map<string, GammaSnapshotEntry[]>;
  pairMap: Map<string, GammaPairMapEntry>;
  maxAgeDays: number;
};

type GammaContextSource = "DB" | "CSV" | null;

type CryptoDynamicGate = {
  decision: GateDecision;
  reasons: string[];
  asOfUtc: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function parseNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function normalizePair(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

const GAMMA_SYMBOL_PREFIXES = [
  "6E",
  "6B",
  "6J",
  "6A",
  "6S",
  "6C",
  "6N",
  "DX",
  "ES",
  "NQ",
  "GC",
  "SI",
  "CL",
] as const;

function normalizeGammaSymbol(value: unknown): string {
  const raw = normalizePair(value).replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  const prefix = GAMMA_SYMBOL_PREFIXES.find((candidate) => raw.startsWith(candidate));
  return prefix ?? raw;
}

function normalizeDecision(value: unknown): GateDecision {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "REDUCE") {
    return SKIP_ONLY_MODE ? "SKIP" : "PASS";
  }
  if (normalized === "PASS" || normalized === "SKIP") {
    return normalized;
  }
  return "NO_DATA";
}

function normalizeTier(value: unknown): SignalTier {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "HIGH" || normalized === "MEDIUM") return normalized;
  return "NEUTRAL";
}

function normalizeDirection(value: unknown): SignalDirection {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "LONG" || normalized === "SHORT") return normalized;
  return "NEUTRAL";
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sortSignals(signals: GatedSetupSignal[]): GatedSetupSignal[] {
  return [...signals].sort((a, b) => {
    const tierRank = a.tier === b.tier ? 0 : a.tier === "HIGH" ? -1 : b.tier === "HIGH" ? 1 : 0;
    if (tierRank !== 0) return tierRank;
    const decisionWeight = (value: GateDecision) => {
      if (value === "PASS") return 0;
      if (value === "SKIP") return 1;
      return 2;
    };
    const decisionRank = decisionWeight(a.gateDecision) - decisionWeight(b.gateDecision);
    if (decisionRank !== 0) return decisionRank;
    return a.pair.localeCompare(b.pair);
  });
}

function buildSummary(signals: GatedSetupSignal[]) {
  return {
    total: signals.length,
    pass: signals.filter((item) => item.gateDecision === "PASS").length,
    skip: signals.filter((item) => item.gateDecision === "SKIP").length,
    noData: signals.filter((item) => item.gateDecision === "NO_DATA").length,
    actionable: signals.filter((item) => item.gateDecision !== "SKIP").length,
    highTier: signals.filter((item) => item.tier === "HIGH").length,
    mediumTier: signals.filter((item) => item.tier === "MEDIUM").length,
    neutralTier: signals.filter((item) => item.tier === "NEUTRAL").length,
  };
}

function parsePayload(raw: Record<string, unknown>, sourcePath: string): GatedSetupsPayload {
  const signalRows = asArray(raw.signals);
  const parsedSignals = signalRows
    .map((item) => asRecord(item))
    .flatMap((row) => {
      const pair = normalizePair(row.pair);
      if (!pair) return [];
      return [
        {
          assetClass: String(row.assetClass ?? "unknown").trim().toLowerCase(),
          pair,
          dealer: String(row.dealer ?? "NEUTRAL").trim().toUpperCase(),
          commercial: String(row.commercial ?? "NEUTRAL").trim().toUpperCase(),
          sentiment: String(row.sentiment ?? "NEUTRAL").trim().toUpperCase(),
          direction: normalizeDirection(row.direction),
          tier: normalizeTier(row.tier),
          gateDecision: normalizeDecision(row.gateDecision),
          gateReasons: dedupeStrings(
            asArray(row.gateReasons)
              .map((reason) => String(reason))
              .filter(Boolean),
          ),
          basePct: toFinite(row.basePct),
          quotePct: toFinite(row.quotePct),
          actionable8w: toInt(row.actionable8w),
          flips8w: toInt(row.flips8w),
          consistency8w: toFinite(row.consistency8w) ?? 0,
          gateDecisionSource: "WEEKLY_BOARD" as const,
          gateAsOfUtc: null,
        } satisfies GatedSetupSignal,
      ];
    });

  const sortedSignals = sortSignals(parsedSignals);
  const summary = buildSummary(sortedSignals);

  const generatedRaw = raw.generated_utc;
  const generatedUtc = typeof generatedRaw === "string" ? generatedRaw : null;
  const currentWeekRaw = raw.current_week_open_utc;
  const currentWeekOpenUtc = typeof currentWeekRaw === "string" ? currentWeekRaw : null;
  const weeksUsedForStability = asArray(raw.weeks_used_for_stability)
    .map((item) => String(item))
    .filter(Boolean);

  return {
    sourcePath,
    generatedUtc,
    currentWeekOpenUtc,
    weeksUsedForStability,
    summary,
    signals: sortedSignals,
    skipOnlyMode: SKIP_ONLY_MODE,
  };
}

function readStaticGatedSetups(): GatedSetupsPayload {
  const envPath = process.env.PERFORMANCE_GATED_SETUPS_PATH?.trim();
  const candidates = [
    envPath ? path.resolve(process.cwd(), envPath) : null,
    DEFAULT_WEEKLY_BOARD_PATH,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(readFileSync(candidate, "utf8")) as Record<string, unknown>;
      if (Array.isArray(parsed.signals)) {
        return parsePayload(parsed, candidate);
      }
    } catch {
      // Ignore and continue to embedded fallback.
    }
  }

  return parsePayload(
    DEFAULT_GATED_SETUPS_BOARD as unknown as Record<string, unknown>,
    "embedded:src/lib/performance/gatedSetupsDefault.ts",
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseCsvObjects(filePath: string): Array<Record<string, string>> {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseGammaCondition(value: string): GammaCondition {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw.startsWith("POS")) return "POSITIVE";
  if (raw.startsWith("NEG")) return "NEGATIVE";
  if (raw.startsWith("NEU")) return "NEUTRAL";
  return "UNKNOWN";
}

function gammaConditionToDirection(condition: GammaCondition): SignalDirection {
  if (condition === "POSITIVE") return "LONG";
  if (condition === "NEGATIVE") return "SHORT";
  return "NEUTRAL";
}

function toDayIso(dateUtc: string): string {
  return dateUtc.slice(0, 10);
}

function resolveGammaSnapshotForDate(
  context: GammaContext,
  symbol: string,
  targetDateIso: string,
): GammaSnapshotEntry | null {
  const series = context.bySymbol.get(normalizeGammaSymbol(symbol));
  if (!series || series.length === 0) return null;

  const targetMs = Date.parse(`${targetDateIso}T00:00:00.000Z`);
  if (!Number.isFinite(targetMs)) return null;

  let best: GammaSnapshotEntry | null = null;
  for (const entry of series) {
    if (entry.dateMs <= targetMs) {
      best = entry;
    } else {
      break;
    }
  }
  if (!best) return null;

  const ageDays = Math.floor((targetMs - best.dateMs) / 86_400_000);
  if (ageDays > context.maxAgeDays) return null;
  return best;
}

function buildGammaPairMap(): Map<string, GammaPairMapEntry> | null {
  const mapCsvEnv = process.env.PERFORMANCE_MENTHORQ_PAIR_MAP_CSV?.trim();
  const mapCsvPath = mapCsvEnv
    ? path.resolve(process.cwd(), mapCsvEnv)
    : DEFAULT_MENTHORQ_MAP_CSV;
  const mapRows = parseCsvObjects(mapCsvPath);
  if (mapRows.length === 0) return null;

  const pairMap = new Map<string, GammaPairMapEntry>();
  for (const row of mapRows) {
    const pair = normalizePair(row.pair || "");
    const base = normalizeGammaSymbol(row.base_gamma_symbol || row.base_symbol || row.base || "");
    const quote = normalizeGammaSymbol(row.quote_gamma_symbol || row.quote_symbol || row.quote || "");
    const enabledRaw = String(row.enabled ?? "1").trim().toLowerCase();
    const enabled = !(enabledRaw === "0" || enabledRaw === "false" || enabledRaw === "no");
    if (!pair || (!base && !quote)) continue;
    pairMap.set(pair, {
      pair,
      baseSymbol: base || null,
      quoteSymbol: quote || null,
      enabled,
    });
  }
  return pairMap.size > 0 ? pairMap : null;
}

function buildGammaContextFromCsv(pairMap: Map<string, GammaPairMapEntry>, maxAgeDays: number): GammaContext | null {
  const gammaCsvEnv = process.env.PERFORMANCE_MENTHORQ_GAMMA_CSV?.trim();
  const gammaCsvPath = gammaCsvEnv
    ? path.resolve(process.cwd(), gammaCsvEnv)
    : DEFAULT_MENTHORQ_GAMMA_CSV;
  const snapshotRows = parseCsvObjects(gammaCsvPath);
  if (snapshotRows.length === 0) {
    return null;
  }

  const bySymbol = new Map<string, GammaSnapshotEntry[]>();
  for (const row of snapshotRows) {
    const dateIso = String(row.date ?? "").trim();
    const symbol = normalizeGammaSymbol(row.page_symbol || row.symbol_input || row.symbol || "");
    if (!symbol || !dateIso) continue;
    const dayMs = Date.parse(`${dateIso}T00:00:00.000Z`);
    if (!Number.isFinite(dayMs)) continue;
    const list = bySymbol.get(symbol) ?? [];
    list.push({
      dateIso,
      dateMs: dayMs,
      condition: parseGammaCondition(row.gamma_condition || row.gammacondition || ""),
    });
    bySymbol.set(symbol, list);
  }
  for (const list of bySymbol.values()) {
    list.sort((a, b) => a.dateMs - b.dateMs);
  }

  return {
    bySymbol,
    pairMap,
    maxAgeDays,
  };
}

async function buildGammaContextFromDb(
  pairMap: Map<string, GammaPairMapEntry>,
  maxAgeDays: number,
  targetDateIso: string,
): Promise<{ context: GammaContext | null; reason: string }> {
  try {
    const latest = await readLatestMenthorqSnapshots();
    if (!latest || latest.rows.length === 0) {
      return { context: null, reason: "MENTHORQ_DB_NO_ROWS" };
    }

    const targetMs = Date.parse(`${targetDateIso}T00:00:00.000Z`);
    const latestMs = Date.parse(`${latest.snapshotDateUtc}T00:00:00.000Z`);
    if (!Number.isFinite(targetMs) || !Number.isFinite(latestMs)) {
      return { context: null, reason: "MENTHORQ_DB_STALE" };
    }

    const ageDays = Math.floor((targetMs - latestMs) / 86_400_000);
    if (ageDays > maxAgeDays) {
      return { context: null, reason: "MENTHORQ_DB_STALE" };
    }

    const bySymbol = new Map<string, GammaSnapshotEntry[]>();
    for (const row of latest.rows) {
      const symbol = normalizeGammaSymbol(row.symbol);
      if (!symbol) continue;
      const dateIso = latest.snapshotDateUtc;
      const dayMs = Date.parse(`${dateIso}T00:00:00.000Z`);
      if (!Number.isFinite(dayMs)) continue;
      bySymbol.set(symbol, [
        {
          dateIso,
          dateMs: dayMs,
          condition: parseGammaCondition(row.gammaCondition),
        },
      ]);
    }

    return {
      context: {
        bySymbol,
        pairMap,
        maxAgeDays,
      },
      reason: "MENTHORQ_DB_CONTEXT_USED",
    };
  } catch {
    return { context: null, reason: "MENTHORQ_DB_NO_ROWS" };
  }
}

function evaluateMenthorqGate(options: {
  pair: string;
  direction: SignalDirection;
  targetDateIso: string;
  context: GammaContext;
}): { decision: GateDecision; reasons: string[]; asOfUtc: string | null } {
  if (options.direction !== "LONG" && options.direction !== "SHORT") {
    return { decision: "NO_DATA", reasons: ["MENTHORQ_DIRECTION_MISSING"], asOfUtc: null };
  }

  const map = options.context.pairMap.get(normalizePair(options.pair));
  if (!map || !map.enabled) {
    return { decision: "NO_DATA", reasons: ["MENTHORQ_PAIR_NOT_MAPPED"], asOfUtc: null };
  }

  const baseSnapshot = map.baseSymbol
    ? resolveGammaSnapshotForDate(options.context, map.baseSymbol, options.targetDateIso)
    : null;
  const quoteSnapshot = map.quoteSymbol
    ? resolveGammaSnapshotForDate(options.context, map.quoteSymbol, options.targetDateIso)
    : null;
  if (!baseSnapshot && !quoteSnapshot) {
    return { decision: "NO_DATA", reasons: ["MENTHORQ_SYMBOL_DATA_MISSING"], asOfUtc: null };
  }

  const desiredBase = options.direction;
  const desiredQuote: SignalDirection = options.direction === "LONG" ? "SHORT" : "LONG";
  let conflict = false;
  let aligned = 0;
  const reasons: string[] = [];
  const asOfDates: string[] = [];

  if (baseSnapshot) {
    const baseDirection = gammaConditionToDirection(baseSnapshot.condition);
    asOfDates.push(baseSnapshot.dateIso);
    reasons.push(`MENTHORQ_BASE_DATE_${baseSnapshot.dateIso}`);
    if (baseDirection === desiredBase) {
      aligned += 1;
    } else if (baseDirection !== "NEUTRAL") {
      conflict = true;
      reasons.push("MENTHORQ_BASE_CONFLICT");
    }
  }

  if (quoteSnapshot) {
    const quoteDirection = gammaConditionToDirection(quoteSnapshot.condition);
    asOfDates.push(quoteSnapshot.dateIso);
    reasons.push(`MENTHORQ_QUOTE_DATE_${quoteSnapshot.dateIso}`);
    if (quoteDirection === desiredQuote) {
      aligned += 1;
    } else if (quoteDirection !== "NEUTRAL") {
      conflict = true;
      reasons.push("MENTHORQ_QUOTE_CONFLICT");
    }
  }

  const asOfUtc =
    asOfDates.length > 0 ? `${asOfDates.sort()[asOfDates.length - 1]}T00:00:00.000Z` : null;

  if (conflict) {
    reasons.push("MENTHORQ_GAMMA_SKIP_CONFLICT");
    return { decision: "SKIP", reasons: dedupeStrings(reasons), asOfUtc };
  }

  if (aligned > 0) {
    reasons.push("MENTHORQ_GAMMA_PASS_ALIGNED");
    return { decision: "PASS", reasons: dedupeStrings(reasons), asOfUtc };
  }

  return {
    decision: "NO_DATA",
    reasons: dedupeStrings([...reasons, "MENTHORQ_GAMMA_NEUTRAL"]),
    asOfUtc,
  };
}

function isOpposingNode(
  sideRaw: string,
  direction: LiquidationTradeDirection,
  distancePct: number,
): boolean {
  const side = sideRaw.trim().toLowerCase();
  if (side.includes("above")) return direction === "SHORT";
  if (side.includes("below")) return direction === "LONG";
  if (side.includes("short")) return direction === "SHORT";
  if (side.includes("long")) return direction === "LONG";
  return direction === "SHORT" ? distancePct >= 0 : distancePct <= 0;
}

function extractNearestOpposingCluster(
  snapshots: LiquidationHeatmapSnapshotRow[],
  direction: LiquidationTradeDirection,
): { distancePct: number | null; notionalUsd: number | null; notionalPercentile: number | null } {
  const candidates: Array<{ distancePct: number; notionalUsd: number }> = [];

  for (const snapshot of snapshots) {
    const nodes = Array.isArray(snapshot.nodes_json) ? snapshot.nodes_json : [];
    for (const rawNode of nodes) {
      const node = asRecord(rawNode);
      const price = toFinite(node.price_level);
      const notional = toFinite(node.estimated_liquidations_usd);
      if ((price ?? 0) <= 0 || (notional ?? 0) <= 0) continue;

      const sideRaw = String(node.side ?? "");
      let distancePct = toFinite(node.distance_pct);
      if (distancePct === null) {
        distancePct = (((price ?? 0) - snapshot.current_price) / Math.max(snapshot.current_price, 1)) * 100;
      }
      if (!isOpposingNode(sideRaw, direction, distancePct)) continue;

      candidates.push({
        distancePct: Math.abs(distancePct),
        notionalUsd: notional ?? 0,
      });
    }
  }

  if (candidates.length === 0) {
    return { distancePct: null, notionalUsd: null, notionalPercentile: null };
  }

  const best = candidates.sort((a, b) => (
    a.distancePct !== b.distancePct ? a.distancePct - b.distancePct : b.notionalUsd - a.notionalUsd
  ))[0];
  const distribution = candidates.map((item) => item.notionalUsd).sort((a, b) => a - b);
  const rank = distribution.filter((value) => value <= best.notionalUsd).length;
  const percentile = distribution.length > 0 ? (rank / distribution.length) * 100 : null;

  return {
    distancePct: best.distancePct,
    notionalUsd: best.notionalUsd,
    notionalPercentile: percentile === null ? null : Number(percentile.toFixed(2)),
  };
}

function extractNearFieldOpposingUsd(
  snapshots: LiquidationHeatmapSnapshotRow[],
  direction: LiquidationTradeDirection,
): number {
  const sideKey = direction === "SHORT" ? "shorts" : "longs";
  let total = 0;

  for (const snapshot of snapshots) {
    const bands = asRecord(snapshot.bands_json);
    const rows = asArray(bands[sideKey]);
    for (const rawRow of rows) {
      const row = asRecord(rawRow);
      const bandPct = Math.abs(
        toFinite(row.band_pct) ?? toFinite(row.distance_pct) ?? Number.POSITIVE_INFINITY,
      );
      if (!Number.isFinite(bandPct) || bandPct > 2) continue;
      const incremental = toFinite(row.incremental_liquidations_usd) ?? 0;
      const cumulative = toFinite(row.estimated_liquidations_usd) ?? 0;
      total += incremental > 0 ? incremental : cumulative;
    }
  }

  return total;
}

async function evaluateLiveCryptoLiquidationGate(
  pair: string,
  direction: SignalDirection,
): Promise<CryptoDynamicGate> {
  if (!process.env.DATABASE_URL) {
    return { decision: "NO_DATA", reasons: ["LIQUIDATION_DYNAMIC_DB_NOT_CONFIGURED"], asOfUtc: null };
  }
  const symbol = CRYPTO_SYMBOL_BY_PAIR.get(normalizePair(pair));
  if (!symbol || (direction !== "LONG" && direction !== "SHORT")) {
    return { decision: "NO_DATA", reasons: ["LIQUIDATION_DYNAMIC_NOT_APPLICABLE"], asOfUtc: null };
  }

  const atUtc = new Date().toISOString();
  const maxAgeMinutes = Math.max(60, Math.floor(parseNumberEnv("PERFORMANCE_LIQ_DYNAMIC_MAX_AGE_MINUTES", 72 * 60)));
  const exchangeGroup = process.env.PERFORMANCE_LIQ_EXCHANGE_GROUP?.trim() || "binance_bybit";
  const opposingThreshold = Math.max(0.1, parseNumberEnv("PERFORMANCE_LIQ_OPPOSING_THRESHOLD", 1.2));
  const skipRatio = parseNumberEnv("PERFORMANCE_LIQ_SKIP_RATIO", 0.8);
  const skipSuggestedMinCount = Math.max(1, Math.floor(parseNumberEnv("PERFORMANCE_LIQ_SKIP_SUGGESTED_MIN_COUNT", 2)));
  const nearSkipDistancePct = parseNumberEnv("PERFORMANCE_LIQ_SKIP_NEAR_DISTANCE_PCT", 2.0);
  const nearSkipUsd = parseNumberEnv("PERFORMANCE_LIQ_SKIP_NEAR_USD", 3_000_000_000);
  const nearSkipPercentile = parseNumberEnv("PERFORMANCE_LIQ_SKIP_NEAR_PERCENTILE", 90);
  const nearReduceDistancePct = parseNumberEnv("PERFORMANCE_LIQ_REDUCE_NEAR_DISTANCE_PCT", 3.5);
  const reduceRatioLow = parseNumberEnv("PERFORMANCE_LIQ_REDUCE_RATIO_LOW", 0.8);
  const reduceRatioHigh = parseNumberEnv("PERFORMANCE_LIQ_REDUCE_RATIO_HIGH", 1.2);
  const nearFieldHighUsd = parseNumberEnv("PERFORMANCE_LIQ_NEARFIELD_HIGH_USD", 1_000_000_000);

  const snapshots = await Promise.all(
    HEATMAP_INTERVALS.map((interval) =>
      readNearestLiquidationHeatmapSnapshot({
        symbol,
        atUtc,
        interval,
        exchangeGroup,
        maxAgeMinutes,
      }),
    ),
  );

  const availableSnapshots = snapshots.filter(
    (snapshot): snapshot is LiquidationHeatmapSnapshotRow => Boolean(snapshot),
  );
  if (availableSnapshots.length === 0) {
    return { decision: "NO_DATA", reasons: ["LIQUIDATION_DYNAMIC_NO_RECENT_SNAPSHOT"], asOfUtc: null };
  }

  const advisories = availableSnapshots.map((snapshot) =>
    buildLiquidationAdvisory(snapshot, direction as LiquidationTradeDirection, {
      opposingThreshold,
    }),
  );
  const advisoryByInterval = new Map(advisories.map((advisory) => [advisory.interval, advisory]));
  const skipSuggestedCount = advisories.filter((advisory) => advisory.skip_suggested).length;
  const dailyRatio = advisoryByInterval.get("1d")?.fuel_risk_ratio ?? null;
  const weeklyRatio = advisoryByInterval.get("7d")?.fuel_risk_ratio ?? null;
  const nearestOpposing = extractNearestOpposingCluster(
    availableSnapshots,
    direction as LiquidationTradeDirection,
  );
  const nearFieldOpposingUsd = extractNearFieldOpposingUsd(
    availableSnapshots,
    direction as LiquidationTradeDirection,
  );

  const nearClusterDistanceHit =
    (nearestOpposing.distancePct ?? Number.POSITIVE_INFINITY) <= nearSkipDistancePct;
  const nearClusterUsdHit = (nearestOpposing.notionalUsd ?? 0) >= nearSkipUsd;
  const nearClusterPercentileHit = (nearestOpposing.notionalPercentile ?? -1) >= nearSkipPercentile;
  const skipByNearestCluster = nearClusterDistanceHit && (nearClusterUsdHit || nearClusterPercentileHit);
  const skipByMultiTfOpposing = skipSuggestedCount >= skipSuggestedMinCount;
  const skipByDualRatio =
    dailyRatio !== null && weeklyRatio !== null && dailyRatio < skipRatio && weeklyRatio < skipRatio;

  const anyRatioInReduceBand = advisories.some(
    (advisory) =>
      advisory.fuel_risk_ratio >= reduceRatioLow && advisory.fuel_risk_ratio < reduceRatioHigh,
  );
  const reduceByNearestCluster =
    (nearestOpposing.distancePct ?? Number.POSITIVE_INFINITY) <= nearReduceDistancePct;
  const reduceByNearField = nearFieldOpposingUsd >= nearFieldHighUsd;

  const reasons: string[] = [];
  if (skipByNearestCluster && nearClusterUsdHit) reasons.push("SKIP_NEAR_OPPOSING_CLUSTER_USD");
  if (skipByNearestCluster && nearClusterPercentileHit) reasons.push("SKIP_NEAR_OPPOSING_CLUSTER_PERCENTILE");
  if (skipByMultiTfOpposing) reasons.push("SKIP_OPPOSING_DOMINANCE_MULTI_TF");
  if (skipByDualRatio) reasons.push("SKIP_LOW_RATIO_1D_7D");
  if (SKIP_ONLY_MODE && reduceByNearestCluster) reasons.push("SKIP_FROM_REDUCE_NEAR_OPPOSING_CLUSTER");
  if (SKIP_ONLY_MODE && anyRatioInReduceBand) reasons.push("SKIP_FROM_REDUCE_RATIO_BAND");
  if (SKIP_ONLY_MODE && reduceByNearField) reasons.push("SKIP_FROM_REDUCE_NEAR_FIELD_OPPOSING_DENSITY");

  const lastSnapshotUtc = availableSnapshots
    .map((snapshot) => snapshot.snapshot_time_utc)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] ?? null;

  const shouldSkip =
    skipByNearestCluster ||
    skipByMultiTfOpposing ||
    skipByDualRatio ||
    (SKIP_ONLY_MODE && (reduceByNearestCluster || anyRatioInReduceBand || reduceByNearField));

  if (shouldSkip) {
    return {
      decision: "SKIP",
      reasons: dedupeStrings(
        reasons.length > 0 ? reasons : ["SKIP_LIQUIDATION_DYNAMIC_RULE"],
      ),
      asOfUtc: lastSnapshotUtc,
    };
  }

  return {
    decision: "PASS",
    reasons: dedupeStrings(["PASS_LIQUIDATION_DYNAMIC"]),
    asOfUtc: lastSnapshotUtc,
  };
}

async function applyDynamicOverlays(payload: GatedSetupsPayload): Promise<GatedSetupsPayload> {
  const gammaTargetDateIso = toDayIso(new Date().toISOString());
  const maxAgeDays = Math.max(1, Math.trunc(parseNumberEnv("PERFORMANCE_MENTHORQ_MAX_AGE_DAYS", 8)));
  const pairMap = buildGammaPairMap();
  let gammaContext: GammaContext | null = null;
  let gammaSource: GammaContextSource = null;
  const gammaBootstrapReasons: string[] = [];

  if (pairMap) {
    const dbContext = await buildGammaContextFromDb(pairMap, maxAgeDays, gammaTargetDateIso);
    if (dbContext.context) {
      gammaContext = dbContext.context;
      gammaSource = "DB";
      gammaBootstrapReasons.push("MENTHORQ_DB_CONTEXT_USED");
    } else {
      gammaBootstrapReasons.push(dbContext.reason);
      const csvContext = buildGammaContextFromCsv(pairMap, maxAgeDays);
      if (csvContext) {
        gammaContext = csvContext;
        gammaSource = "CSV";
        gammaBootstrapReasons.push("MENTHORQ_CSV_FALLBACK_USED");
      }
    }
  } else {
    gammaBootstrapReasons.push("MENTHORQ_PAIR_MAP_MISSING");
  }

  const signals = await Promise.all(
    payload.signals.map(async (signal): Promise<GatedSetupSignal> => {
      let next = { ...signal };

      if (next.assetClass === "crypto") {
        try {
          const liveGate = await evaluateLiveCryptoLiquidationGate(next.pair, next.direction);
          if (liveGate.decision !== "NO_DATA") {
            next = {
              ...next,
              gateDecision: liveGate.decision,
              gateReasons: liveGate.reasons,
              gateDecisionSource: "CRYPTO_LIQUIDATION_LIVE",
              gateAsOfUtc: liveGate.asOfUtc,
            };
          }
        } catch {
          next = {
            ...next,
            gateReasons: dedupeStrings([...next.gateReasons, "LIQUIDATION_DYNAMIC_READ_ERROR"]),
          };
        }
        return next;
      }

      if (next.direction === "NEUTRAL") {
        return next;
      }

      if (!gammaContext) {
        return {
          ...next,
          gateDecision: next.gateDecision === "PASS" ? "NO_DATA" : next.gateDecision,
          gateReasons: dedupeStrings([
            ...next.gateReasons,
            ...gammaBootstrapReasons,
            "MENTHORQ_CONTEXT_UNAVAILABLE",
          ]),
        };
      }

      const gamma = evaluateMenthorqGate({
        pair: next.pair,
        direction: next.direction,
        targetDateIso: gammaTargetDateIso,
        context: gammaContext,
      });

      const combinedReasons = dedupeStrings([
        ...next.gateReasons,
        ...gammaBootstrapReasons,
        ...gamma.reasons,
      ]);

      if (gamma.decision === "NO_DATA") {
        return {
          ...next,
          gateDecision: next.gateDecision === "PASS" ? "NO_DATA" : next.gateDecision,
          gateReasons: combinedReasons,
          gateDecisionSource:
            next.gateDecisionSource === "WEEKLY_BOARD" && gammaSource
              ? "WEEKLY_BOARD_PLUS_MENTHORQ"
              : next.gateDecisionSource,
          gateAsOfUtc: gamma.asOfUtc ?? next.gateAsOfUtc,
        };
      }

      if (gamma.decision === "SKIP") {
        return {
          ...next,
          gateDecision: "SKIP",
          gateReasons: combinedReasons,
          gateDecisionSource:
            next.gateDecisionSource === "WEEKLY_BOARD"
              ? "WEEKLY_BOARD_PLUS_MENTHORQ"
              : next.gateDecisionSource,
          gateAsOfUtc: gamma.asOfUtc,
        };
      }

      if (next.gateDecision === "NO_DATA") {
        return {
          ...next,
          gateDecision: "PASS",
          gateReasons: combinedReasons,
          gateDecisionSource: "MENTHORQ_GAMMA_DAILY",
          gateAsOfUtc: gamma.asOfUtc,
        };
      }

      return {
        ...next,
        gateReasons: combinedReasons,
        gateDecisionSource:
          next.gateDecisionSource === "WEEKLY_BOARD"
            ? "WEEKLY_BOARD_PLUS_MENTHORQ"
            : next.gateDecisionSource,
        gateAsOfUtc: gamma.asOfUtc ?? next.gateAsOfUtc,
      };
    }),
  );

  const sortedSignals = sortSignals(signals);
  return {
    ...payload,
    signals: sortedSignals,
    summary: buildSummary(sortedSignals),
  };
}

export async function GET() {
  try {
    const staticPayload = readStaticGatedSetups();
    const payload = await applyDynamicOverlays(staticPayload);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build gated setups board",
      },
      { status: 500 },
    );
  }
}
