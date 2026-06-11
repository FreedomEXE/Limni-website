/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: matrix/page.tsx
 *
 * Description:
 * Consolidated matrix workspace hosting the CFD and Crypto boards.
 * Uses the shared StrategySelector in the sidebar (same pattern as
 * Performance section). Strategy selection drives both boards.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import MatrixQuarantineNotice from "@/components/matrix/MatrixQuarantineNotice";

export const dynamic = "force-dynamic";

export default async function MatrixPage() {
  return (
    <DashboardLayout>
      <MatrixQuarantineNotice />
    </DashboardLayout>
  );
}
