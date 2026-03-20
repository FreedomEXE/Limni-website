import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_PATH = path.resolve(
  process.cwd(),
  "reports",
  "manual-session-matrix-backtest-latest.json",
);

type LiveSizingReport = {
  generatedUtc?: string;
  positionSizingResearch?: unknown;
};

export async function GET() {
  try {
    if (!existsSync(REPORT_PATH)) {
      return NextResponse.json(
        { error: "Live sizing report not found." },
        { status: 404 },
      );
    }

    const parsed = JSON.parse(readFileSync(REPORT_PATH, "utf8")) as LiveSizingReport;
    return NextResponse.json({
      generatedUtc: parsed.generatedUtc ?? null,
      positionSizingResearch: parsed.positionSizingResearch ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load live sizing." },
      { status: 500 },
    );
  }
}
