import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { getSessionRole } from "@/lib/auth";

export const runtime = "nodejs";

const SOURCE_FILES: Record<string, { filePath: string; downloadName: string }> = {
  ea: {
    filePath: path.join(process.cwd(), "mt5", "Experts", "LimniBasketEA.mq5"),
    downloadName: "LimniBasketEA.mq5",
  },
  sizer: {
    filePath: path.join(process.cwd(), "mt5", "Scripts", "LimniSizingAudit.mq5"),
    downloadName: "LimniSizingAudit.mq5",
  },
};

export async function GET(request: NextRequest) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = request.nextUrl.searchParams.get("file") ?? "";
  const selected = SOURCE_FILES[key];
  if (!selected) {
    return NextResponse.json({ error: "Invalid source file key." }, { status: 400 });
  }

  try {
    const content = await fs.readFile(selected.filePath, "utf8");
    return new Response(content, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="${selected.downloadName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
