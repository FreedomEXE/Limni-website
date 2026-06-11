/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Account overview page backed by a server-built payload and client session store.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
import DashboardLayout from "@/components/DashboardLayout";
import AccountsPageClient from "@/components/accounts/AccountsPageClient";
import { loadAccountsPayload } from "@/lib/accounts/loadAccountsPayload";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const payload = await loadAccountsPayload();

  return (
    <DashboardLayout>
      <AccountsPageClient initialPayload={payload} />
    </DashboardLayout>
  );
}
