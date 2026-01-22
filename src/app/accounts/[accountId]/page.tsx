import { notFound } from "next/navigation";

import { getMt5AccountById } from "@/lib/mt5Store";
import DashboardLayout from "@/components/DashboardLayout";
import AccountDetailView from "@/components/accounts/AccountDetailView";

export const dynamic = "force-dynamic";

type AccountPageProps = {
  params: Promise<{ accountId: string }>;
};

export default async function AccountPage({ params }: AccountPageProps) {
  const { accountId } = await params;
  let account = null;
  try {
    account = await getMt5AccountById(accountId);
  } catch (error) {
    console.error(
      "Account load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!account) {
    notFound();
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {!account ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-sm text-rose-700">
            Account data could not be loaded. Check database connectivity and MT5
            push status.
          </div>
        ) : null}
        {account ? <AccountDetailView account={account} /> : null}
      </div>
    </DashboardLayout>
  );
}
