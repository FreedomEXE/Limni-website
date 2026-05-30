/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Quarantined legacy paginated Basket week-pairs endpoint.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // QUARANTINED 2026-05-30 - legacy paginated Basket endpoint.
  // Replaced by /api/basket/closed-history bundle loading. Preserved as an
  // explicit disabled endpoint until a future cleanup pass removes the old
  // Phase 2 pagination path. See docs/QUARANTINED_CODE_INVENTORY.md.
  return NextResponse.json(
    { error: "Legacy Basket pagination endpoint is quarantined; use /api/basket/closed-history." },
    { status: 410 },
  );
}
