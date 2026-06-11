/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: weekly-hold/page.tsx
 *
 * Description:
 * Legacy weekly-hold route redirecting to the Flagship pill on the
 * consolidated /matrix workspace.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { redirect } from "next/navigation";

export default function WeeklyHoldForwardTestPage() {
  redirect("/matrix?tab=flagship");
}
