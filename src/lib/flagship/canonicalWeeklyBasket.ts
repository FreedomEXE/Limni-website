import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { computeTieredWeekForSystem, TIERED_DISPLAY_LABELS } from "@/lib/performance/tiered";
import type { PerformanceModel } from "@/lib/performanceLab";
import {
  buildCotGateContext,
  buildGateMap,
  evaluatePairWithGate,
  type GateDecision,
  type TradeDirection,
} from "@/lib/performance/gateEvaluation";

export type CanonicalWeeklyTier = "HIGH" | "MEDIUM" | "LOW";
export type CanonicalWeeklyDirection = "LONG" | "SHORT";

export type CanonicalWeeklySignal = {
  pair: string;
  assetClass: string;
  direction: CanonicalWeeklyDirection;
  tier: CanonicalWeeklyTier;
  model: PerformanceModel;
  gateDecision: GateDecision;
  gateReasons: string[];
  signalMode: "FLAGSHIP" | "ADR_DIP";
};

export type CanonicalWeeklyBasketPayload = {
  schemaVersion: number;
  generatedUtc: string;
  currentWeekOpenUtc: string;
  baseSystemId: string;
  strategyId: string;
  strategyName: string;
  sourceLabel: string;
  sourceType: "frozen_weekly_snapshot";
  gateMode: "reduce_as_skip";
  signals: CanonicalWeeklySignal[];
};

const OUTPUT_DIR = path.resolve(process.cwd(), "reports", "bias-gate");
const LATEST_OUTPUT_PATH = path.join(OUTPUT_DIR, "canonical-weekly-basket-latest.json");

const MODEL_TO_TIER: Record<PerformanceModel, CanonicalWeeklyTier | null> = {
  antikythera: null,
  antikythera_v2: null,
  antikythera_v3: "HIGH",
  blended: null,
  dealer: "MEDIUM",
  commercial: "LOW",
  sentiment: null,
  strength: null,
};

const ASSET_CLASS_BY_PAIR = new Map<string, string>(
  Object.entries(PAIRS_BY_ASSET_CLASS).flatMap(([assetClass, pairs]) =>
    pairs.map((pair) => [pair.pair.toUpperCase(), assetClass]),
  ),
);

function weekFileName(weekOpenUtc: string) {
  const safe = weekOpenUtc.replace(/[:]/g, "-");
  return `canonical-weekly-basket-${safe}.json`;
}

function weekFilePath(weekOpenUtc: string) {
  return path.join(OUTPUT_DIR, weekFileName(weekOpenUtc));
}

function buildSourceLabel(weekOpenUtc: string) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  if (!parsed.isValid) {
    return "Frozen Tiered V3 gated weekly snapshot";
  }
  const monday = parsed.plus({ days: 1 }).startOf("day");
  return `Frozen Tiered V3 gated weekly snapshot · week of ${monday.toFormat("MMM dd, yyyy")}`;
}

function normalizeSignalDirection(value: unknown): CanonicalWeeklyDirection | null {
  if (value === "LONG" || value === "SHORT") return value;
  return null;
}

function normalizeTier(value: unknown): CanonicalWeeklyTier | null {
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") return value;
  return null;
}

function normalizePayload(value: unknown): CanonicalWeeklyBasketPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const schemaVersion = Number(record.schemaVersion ?? 0);
  const currentWeekOpenUtc = String(record.currentWeekOpenUtc ?? "").trim();
  const generatedUtc = String(record.generatedUtc ?? "").trim();
  const baseSystemId = String(record.baseSystemId ?? "").trim();
  const strategyId = String(record.strategyId ?? "").trim();
  const strategyName = String(record.strategyName ?? "").trim();
  const sourceLabel = String(record.sourceLabel ?? "").trim();
  const sourceType = record.sourceType === "frozen_weekly_snapshot" ? "frozen_weekly_snapshot" : null;
  const gateMode = record.gateMode === "reduce_as_skip" ? "reduce_as_skip" : null;
  if (
    schemaVersion < 2 ||
    !currentWeekOpenUtc ||
    !generatedUtc ||
    !baseSystemId ||
    !strategyId ||
    !strategyName ||
    !sourceLabel ||
    !sourceType ||
    !gateMode
  ) {
    return null;
  }

  const signals = Array.isArray(record.signals)
    ? record.signals
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const signal = entry as Record<string, unknown>;
          const pair = String(signal.pair ?? "").trim().toUpperCase();
          const assetClass = String(signal.assetClass ?? "").trim().toLowerCase();
          const direction = normalizeSignalDirection(signal.direction);
          const tier = normalizeTier(signal.tier);
          const model = String(signal.model ?? "").trim() as PerformanceModel;
          if (!pair || !assetClass || !direction || !tier || !model) return null;
          return {
            pair,
            assetClass,
            direction,
            tier,
            model,
            gateDecision:
              signal.gateDecision === "PASS" || signal.gateDecision === "NO_DATA" ||
              signal.gateDecision === "SKIP" || signal.gateDecision === "REDUCE"
                ? signal.gateDecision
                : "NO_DATA",
            signalMode:
              signal.gateDecision === "PASS"
                ? "FLAGSHIP"
                : "ADR_DIP",
            gateReasons: Array.isArray(signal.gateReasons)
              ? signal.gateReasons.map((reason) => String(reason)).filter(Boolean)
              : [],
          } satisfies CanonicalWeeklySignal;
        })
        .filter((signal): signal is CanonicalWeeklySignal => Boolean(signal))
    : [];

  return {
    schemaVersion,
    generatedUtc,
    currentWeekOpenUtc,
    baseSystemId,
    strategyId,
    strategyName,
    sourceLabel,
    sourceType,
    gateMode,
    signals,
  };
}

function readPayload(filePath: string) {
  try {
    return normalizePayload(JSON.parse(readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
}

function writePayload(payload: CanonicalWeeklyBasketPayload) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(weekFilePath(payload.currentWeekOpenUtc), JSON.stringify(payload, null, 2));
  writeFileSync(LATEST_OUTPUT_PATH, JSON.stringify(payload, null, 2));
}

async function computePayload(weekOpenUtc: string): Promise<CanonicalWeeklyBasketPayload> {
  const computed = await computeTieredWeekForSystem({ weekOpenUtc, system: "v3" });
  if (!computed) {
    throw new Error(`Unable to compute Tiered V3 weekly basket for ${weekOpenUtc}`);
  }

  const gateMap = buildGateMap();
  const cotContext = await buildCotGateContext();

  const signals: CanonicalWeeklySignal[] = computed.combined.flatMap((row) => {
    const tier = MODEL_TO_TIER[row.model];
    if (!tier) return [];
    return (row.pair_details ?? [])
      .map((detail) => {
        const direction = normalizeSignalDirection(detail.direction);
        if (!direction) return null;
        const pair = detail.pair.toUpperCase();
        const assetClass = ASSET_CLASS_BY_PAIR.get(pair) ?? "fx";
        const gate = evaluatePairWithGate({
          pair,
          weekOpenUtc,
          direction: direction as TradeDirection,
          assetClass: assetClass as "fx" | "indices" | "crypto" | "commodities",
          gateMap,
          cotContext,
          reduceAsSkip: true,
        });
        const signalMode: "FLAGSHIP" | "ADR_DIP" =
          gate.decision === "PASS"
            ? "FLAGSHIP"
            : "ADR_DIP";
        return {
          pair,
          assetClass,
          direction,
          tier,
          model: row.model,
          gateDecision: gate.decision,
          signalMode,
          gateReasons: [
            ...gate.reasons,
            `PASS_${String(TIERED_DISPLAY_LABELS[row.model] ?? row.model).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
            ...(Array.isArray(detail.reason)
              ? detail.reason.map((reason) => String(reason).trim()).filter(Boolean)
              : []),
          ],
        } satisfies CanonicalWeeklySignal;
      })
      .filter((signal): signal is CanonicalWeeklySignal => Boolean(signal));
  });

  return {
    schemaVersion: 3,
    generatedUtc: new Date().toISOString(),
    currentWeekOpenUtc: weekOpenUtc,
    baseSystemId: "tiered_v3",
    strategyId: "tiered_v3_gated",
    strategyName: "Tiered V3 Net Hold Gated",
    sourceLabel: buildSourceLabel(weekOpenUtc),
    sourceType: "frozen_weekly_snapshot",
    gateMode: "reduce_as_skip",
    signals: signals.sort((left, right) => left.pair.localeCompare(right.pair)),
  };
}

export async function getCanonicalWeeklyBasket(options?: { weekOpenUtc?: string }) {
  const weekOpenUtc = options?.weekOpenUtc ?? getCanonicalWeekOpenUtc();
  const exactPath = weekFilePath(weekOpenUtc);
  const exact = readPayload(exactPath);
  if (exact?.currentWeekOpenUtc === weekOpenUtc) {
    return exact;
  }

  const latest = readPayload(LATEST_OUTPUT_PATH);
  if (latest?.currentWeekOpenUtc === weekOpenUtc) {
    return latest;
  }

  const computed = await computePayload(weekOpenUtc);
  try {
    writePayload(computed);
  } catch {
    // Serverless deployments may use a read-only filesystem. The basket can still
    // be returned safely without persisting a local snapshot artifact.
  }
  return computed;
}
