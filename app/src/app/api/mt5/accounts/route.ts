import { NextResponse } from "next/server";
import { readMt5Accounts } from "@/lib/mt5Store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await readMt5Accounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Error reading MT5 accounts:", error);
    return NextResponse.json(
      { error: "Failed to read accounts" },
      { status: 500 }
    );
  }
}
