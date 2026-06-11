/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: intraday/page.tsx
 *
 * Description:
 * Legacy intraday route redirecting to the CFD pill on the
 * consolidated /matrix workspace.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { redirect } from "next/navigation";

export default function IntradayForwardTestPage() {
  redirect("/matrix");
}
