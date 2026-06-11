/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Whitepaper-style bot profile for the Katarakti CFD lite branch.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import AutomationBotProfile from "@/components/automation/AutomationBotProfile";
import AutomationBotsCards from "@/components/automation/AutomationBotsCards";
import { getAutomationBotEntryById } from "@/lib/automation/botLibrary";

export const dynamic = "force-dynamic";

export default async function Mt5ForexLiteBotPage() {
  const entry = getAutomationBotEntryById("katarakti-cfd-lite");
  if (!entry) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AutomationBotsCards active="mt5-forex-lite" />
        <AutomationBotProfile entry={entry} />
      </div>
    </DashboardLayout>
  );
}
