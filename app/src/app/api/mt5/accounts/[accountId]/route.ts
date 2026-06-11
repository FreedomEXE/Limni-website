import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    // Check admin token
    const token = request.headers.get("x-admin-token") ?? "";
    const expectedToken = process.env.ADMIN_TOKEN ?? "";

    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete account (cascade will handle positions and snapshots)
    await query("DELETE FROM mt5_accounts WHERE account_id = $1", [accountId]);

    return NextResponse.json({ success: true, deleted: accountId });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
