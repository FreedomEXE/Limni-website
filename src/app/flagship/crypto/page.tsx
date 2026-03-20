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

import DashboardLayout from "@/components/DashboardLayout";
import CryptoBoard from "@/components/flagship/CryptoBoard";

export const dynamic = "force-dynamic";

export default function FlagshipCryptoPage() {
  return (
    <DashboardLayout>
      <CryptoBoard />
    </DashboardLayout>
  );
}
