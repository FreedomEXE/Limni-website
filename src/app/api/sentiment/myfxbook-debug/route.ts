import { NextResponse } from "next/server";
import { MyfxbookProvider } from "@/lib/sentiment/providers/myfxbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("x-admin-token") ?? "";
  const expectedToken = process.env.ADMIN_TOKEN ?? "";

  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const provider = new MyfxbookProvider();
    const result = await provider.fetchOutlookRaw();

    const symbols = result.parsed?.symbols?.map((symbol) => symbol.name) ?? [];

    return NextResponse.json({
      ok: result.http_status === 200 && !result.parsed?.error,
      http_status: result.http_status,
      status_text: result.status_text,
      latency_ms: result.latency_ms,
      headers: result.headers,
      parse_error: result.parse_error,
      api_error: result.parsed?.error ?? null,
      api_message: result.parsed?.message ?? null,
      symbol_count: symbols.length,
      symbols,
      body_excerpt: result.body_excerpt,
      fetched_at_utc: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Myfxbook debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
