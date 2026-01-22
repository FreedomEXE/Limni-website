import DashboardLayout from "@/components/DashboardLayout";
import { readMt5Accounts } from "@/lib/mt5Store";
import AccountsOverview from "@/components/accounts/AccountsOverview";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  let accounts: Awaited<ReturnType<typeof readMt5Accounts>> = [];
  try {
    accounts = await readMt5Accounts();
  } catch (error) {
    console.error(
      "Accounts load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  return (
    <DashboardLayout>
      <AccountsOverview accounts={accounts} />
    </DashboardLayout>
  );
}
