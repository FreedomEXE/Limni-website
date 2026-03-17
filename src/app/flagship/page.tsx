/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: flagship/page.tsx
 *
 * Description:
 * Flagship manual-trading board route that hosts the
 * session-aware gated setup dashboard.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";

export const dynamic = "force-dynamic";

const DEFAULT_FLAGSHIP_STRATEGY = "universal_v1_gated";

export default function FlagshipPage() {
  const strategy = process.env.FLAGSHIP_STRATEGY?.trim() || DEFAULT_FLAGSHIP_STRATEGY;
  return (
    <DashboardLayout>
      <FlagshipBoard strategy={strategy} />
    </DashboardLayout>
  );
}

