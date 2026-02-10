import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/research/backtestEngine";
import { hashResearchConfig } from "@/lib/research/hash";
import { findRunByConfigHash, saveResearchRun } from "@/lib/researchRuns";
import type { ResearchConfig } from "@/lib/research/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidConfig(config: Partial<ResearchConfig>): config is ResearchConfig {
  return (
    !!config &&
    typeof config === "object" &&
    isNonEmptyString(config.mode) &&
    isNonEmptyString(config.provider) &&
    !!config.dateRange &&
    isNonEmptyString(config.dateRange.from) &&
    isNonEmptyString(config.dateRange.to) &&
    Array.isArray(config.models) &&
    config.models.length > 0
  );
}

function validateConfig(config: Partial<ResearchConfig>): string | null {
  if (!config || typeof config !== "object") return "Config payload is required.";
  if (!isNonEmptyString(config.mode)) return "Config.mode is required.";
  if (!isNonEmptyString(config.provider)) return "Config.provider is required.";
  if (!config.dateRange || !isNonEmptyString(config.dateRange.from) || !isNonEmptyString(config.dateRange.to)) {
    return "Config.dateRange.from and Config.dateRange.to are required.";
  }
  if (!Array.isArray(config.models) || config.models.length === 0) {
    return "Config.models must include at least one model.";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { config?: Partial<ResearchConfig> };
    const config = payload?.config ?? {};
    const validationError = validateConfig(config);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }
    if (!isValidConfig(config)) {
      return NextResponse.json({ ok: false, error: "Invalid config." }, { status: 400 });
    }

    const configHash = hashResearchConfig(config);
    const cached = await findRunByConfigHash(configHash);
    if (cached && cached.result) {
      const result = { ...cached.result, runId: cached.id };
      return NextResponse.json(
        {
          ok: true,
          cached: true,
          runId: cached.id,
          result,
          createdAt: cached.createdAt,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await runBacktest(config);
    const saved = await saveResearchRun(config, result);
    const savedResult = saved.result ? { ...saved.result, runId: saved.id } : null;
    return NextResponse.json(
      {
        ok: true,
        cached: false,
        runId: saved.id,
        result: savedResult,
        createdAt: saved.createdAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
