import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_GATED_SETUPS_BOARD } from "@/lib/performance/gatedSetupsDefault";

const SKIP_ONLY_MODE = process.env.PERFORMANCE_GATE_SKIP_ONLY !== "0";

type GateDecision = "PASS" | "SKIP" | "NO_DATA";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";

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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
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

function parsePayload(raw: Record<string, unknown>, sourcePath: string): GatedSetupsPayload {
  const signalRows = asArray(raw.signals);
  const signals: GatedSetupSignal[] = signalRows
    .map((item) => asRecord(item))
    .flatMap((row) => {
      const pair = String(row.pair ?? "").trim().toUpperCase();
      if (!pair) return [];
      return [{
        assetClass: String(row.assetClass ?? "unknown").trim().toLowerCase(),
        pair,
        dealer: String(row.dealer ?? "NEUTRAL").trim().toUpperCase(),
        commercial: String(row.commercial ?? "NEUTRAL").trim().toUpperCase(),
        sentiment: String(row.sentiment ?? "NEUTRAL").trim().toUpperCase(),
        direction: normalizeDirection(row.direction),
        tier: normalizeTier(row.tier),
        gateDecision: normalizeDecision(row.gateDecision),
        gateReasons: asArray(row.gateReasons).map((reason) => String(reason)).filter(Boolean),
        basePct: toFinite(row.basePct),
        quotePct: toFinite(row.quotePct),
        actionable8w: toInt(row.actionable8w),
        flips8w: toInt(row.flips8w),
        consistency8w: toFinite(row.consistency8w) ?? 0,
      }];
    });

  const sortedSignals = [...signals].sort((a, b) => {
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

  const summary = {
    total: sortedSignals.length,
    pass: sortedSignals.filter((item) => item.gateDecision === "PASS").length,
    skip: sortedSignals.filter((item) => item.gateDecision === "SKIP").length,
    noData: sortedSignals.filter((item) => item.gateDecision === "NO_DATA").length,
    actionable: sortedSignals.filter((item) => item.gateDecision !== "SKIP").length,
    highTier: sortedSignals.filter((item) => item.tier === "HIGH").length,
    mediumTier: sortedSignals.filter((item) => item.tier === "MEDIUM").length,
    neutralTier: sortedSignals.filter((item) => item.tier === "NEUTRAL").length,
  };

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

function readGatedSetups(): GatedSetupsPayload {
  const envPath = process.env.PERFORMANCE_GATED_SETUPS_PATH?.trim();
  const candidates = [
    envPath ? path.resolve(process.cwd(), envPath) : null,
    path.resolve(process.cwd(), "reports", "bias-gate", "weekly-signal-board-latest.json"),
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

export async function GET() {
  try {
    return NextResponse.json(readGatedSetups());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build gated setups board",
      },
      { status: 500 },
    );
  }
}
