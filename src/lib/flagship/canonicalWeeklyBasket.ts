import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { computeTieredWeekForSystem, TIERED_DISPLAY_LABELS } from "@/lib/performance/tiered";
import type { PerformanceModel } from "@/lib/performanceLab";

export type CanonicalWeeklyTier = "HIGH" | "MEDIUM" | "LOW";
export type CanonicalWeeklyDirection = "LONG" | "SHORT";

export type CanonicalWeeklySignal = {
  pair: string;
  assetClass: string;
  direction: CanonicalWeeklyDirection;
  tier: CanonicalWeeklyTier;
  model: PerformanceModel;
  gateDecision: "PASS";
  gateReasons: string[];
};

export type CanonicalWeeklyBasketPayload = {
  generatedUtc: string;
  currentWeekOpenUtc: string;
  strategyId: string;
  strategyName: string;
  sourceLabel: string;
  sourceType: "frozen_weekly_snapshot";
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
    return "Frozen weekly Tiered V3 snapshot";
  }
  const monday = parsed.plus({ days: 1 }).startOf("day");
  return `Frozen Tiered V3 weekly snapshot · week of ${monday.toFormat("MMM dd, yyyy")}`;
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
  const currentWeekOpenUtc = String(record.currentWeekOpenUtc ?? "").trim();
  const generatedUtc = String(record.generatedUtc ?? "").trim();
  const strategyId = String(record.strategyId ?? "").trim();
  const strategyName = String(record.strategyName ?? "").trim();
  const sourceLabel = String(record.sourceLabel ?? "").trim();
  const sourceType = record.sourceType === "frozen_weekly_snapshot" ? "frozen_weekly_snapshot" : null;
  if (!currentWeekOpenUtc || !generatedUtc || !strategyId || !strategyName || !sourceLabel || !sourceType) {
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
            gateDecision: "PASS" as const,
            gateReasons: Array.isArray(signal.gateReasons)
              ? signal.gateReasons.map((reason) => String(reason)).filter(Boolean)
              : [],
          } satisfies CanonicalWeeklySignal;
        })
        .filter((signal): signal is CanonicalWeeklySignal => Boolean(signal))
    : [];

  return {
    generatedUtc,
    currentWeekOpenUtc,
    strategyId,
    strategyName,
    sourceLabel,
    sourceType,
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

  const signals: CanonicalWeeklySignal[] = computed.combined.flatMap((row) => {
    const tier = MODEL_TO_TIER[row.model];
    if (!tier) return [];
    return (row.pair_details ?? [])
      .map((detail) => {
        const direction = normalizeSignalDirection(detail.direction);
        if (!direction) return null;
        return {
          pair: detail.pair,
          assetClass: ASSET_CLASS_BY_PAIR.get(detail.pair.toUpperCase()) ?? "fx",
          direction,
          tier,
          model: row.model,
          gateDecision: "PASS" as const,
          gateReasons: [
            `PASS_${String(TIERED_DISPLAY_LABELS[row.model] ?? row.model).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
            ...(Array.isArray(detail.reason) ? detail.reason.map((reason) => String(reason).trim()).filter(Boolean) : []),
          ],
        } satisfies CanonicalWeeklySignal;
      })
      .filter((signal): signal is CanonicalWeeklySignal => Boolean(signal));
  });

  return {
    generatedUtc: new Date().toISOString(),
    currentWeekOpenUtc: weekOpenUtc,
    strategyId: "tiered_v3_gated",
    strategyName: "Tiered V3 Net Hold Gated",
    sourceLabel: buildSourceLabel(weekOpenUtc),
    sourceType: "frozen_weekly_snapshot",
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
  writePayload(computed);
  return computed;
}
