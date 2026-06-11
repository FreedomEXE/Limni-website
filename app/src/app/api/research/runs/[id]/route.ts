import { NextResponse } from "next/server";
import { getResearchRun } from "@/lib/researchRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "Run id is required." }, { status: 400 });
    }
    const run = await getResearchRun(id);
    if (!run) {
      return NextResponse.json({ ok: false, error: "Run not found." }, { status: 404 });
    }
    const result = run.result ? { ...run.result, runId: run.id } : null;
    return NextResponse.json(
      {
        ok: true,
        runId: run.id,
        result,
        status: run.status,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
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
