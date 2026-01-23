import { NextResponse } from "next/server";

import { readMt5ClosedPositions } from "@/lib/mt5Store";

export const runtime = "nodejs";

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
    return `"${value.replace(/\"/g, "\"\"")}"`;
  }
  return value;
}

function toCsv(rows: Awaited<ReturnType<typeof readMt5ClosedPositions>>) {
  const header = [
    "ticket",
    "symbol",
    "type",
    "lots",
    "open_price",
    "close_price",
    "profit",
    "swap",
    "commission",
    "open_time",
    "close_time",
    "magic_number",
    "comment",
  ];
  const lines = [header.join(",")];
  rows.forEach((row) => {
    const line = [
      row.ticket,
      row.symbol,
      row.type,
      row.lots,
      row.open_price,
      row.close_price,
      row.profit,
      row.swap,
      row.commission,
      row.open_time,
      row.close_time,
      row.magic_number ?? "",
      escapeCsv(row.comment ?? ""),
    ];
    lines.push(line.join(","));
  });
  return lines.join("\n");
}

export async function GET(
  request: Request,
  { params }: { params: { accountId: string } },
) {
  const { accountId } = params;
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const format = searchParams.get("format") ?? "json";
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 500;

  if (!accountId) {
    return NextResponse.json({ error: "account_id is required." }, { status: 400 });
  }

  const rows = await readMt5ClosedPositions(accountId, Number.isFinite(limit) ? limit : 500);

  if (format === "csv") {
    const csv = toCsv(rows);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${accountId}-closed-positions.csv"`,
      },
    });
  }

  return NextResponse.json({
    account_id: accountId,
    count: rows.length,
    positions: rows,
  });
}
