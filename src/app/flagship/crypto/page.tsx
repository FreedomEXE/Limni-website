/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Crypto matrix route for the manual trading board.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function FlagshipCryptoPage() {
  redirect("/flagship?tab=crypto");
}
