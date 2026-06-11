"use server";

import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function deleteAccount(accountId: string) {
  try {
    // Delete account (cascade will handle positions and snapshots)
    await query("DELETE FROM mt5_accounts WHERE account_id = $1", [accountId]);

    // Revalidate the accounts page
    revalidatePath("/accounts");

    return { success: true };
  } catch (error) {
    console.error("Error deleting account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete account"
    };
  }
}

export async function deleteConnectedAccount(accountKey: string) {
  try {
    await query("DELETE FROM connected_accounts WHERE account_key = $1", [accountKey]);
    revalidatePath("/accounts");
    return { success: true };
  } catch (error) {
    console.error("Error deleting connected account:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete connected account"
    };
  }
}
