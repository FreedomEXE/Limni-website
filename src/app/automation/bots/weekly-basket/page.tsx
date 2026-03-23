/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Whitepaper-style bot profile for the weekly basket execution stack.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import AutomationBotProfile from "@/components/automation/AutomationBotProfile";
import AutomationBotsCards from "@/components/automation/AutomationBotsCards";
import { getAutomationBotEntryById } from "@/lib/automation/botLibrary";

export const dynamic = "force-dynamic";

export default async function WeeklyBasketBotPage() {
  const entry = getAutomationBotEntryById("weekly-basket");
  if (!entry) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AutomationBotsCards active="weekly-basket" />
        <AutomationBotProfile entry={entry} />
      </div>
    </DashboardLayout>
  );
}
