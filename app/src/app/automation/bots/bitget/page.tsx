/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Whitepaper-style bot profile for the Katarakti crypto branch.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import AutomationBotProfile from "@/components/automation/AutomationBotProfile";
import AutomationBotsCards from "@/components/automation/AutomationBotsCards";
import { getAutomationBotEntryById } from "@/lib/automation/botLibrary";

export const dynamic = "force-dynamic";

export default async function BitgetBotPage() {
  const entry = getAutomationBotEntryById("katarakti-crypto");
  if (!entry) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AutomationBotsCards active="bitget" />
        <AutomationBotProfile entry={entry} />
      </div>
    </DashboardLayout>
  );
}
