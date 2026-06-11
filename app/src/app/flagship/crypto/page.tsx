/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: crypto/page.tsx
 *
 * Description:
 * Legacy crypto route redirecting to the Crypto pill on the
 * consolidated /matrix workspace.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { redirect } from "next/navigation";

export default function FlagshipCryptoPage() {
  redirect("/matrix?tab=crypto");
}
