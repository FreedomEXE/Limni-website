/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AssetClassBadge.tsx
 *
 * Description:
 * Compact asset-class badge for Basket symbol rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";
import { PERFORMANCE_ASSET_SCOPE_LABELS } from "@/lib/performance/performanceAssetScope";

export default function AssetClassBadge({ assetClass }: { assetClass: AssetClass }) {
  return (
    <span className="rounded-full border border-(--panel-border) px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-(--muted)">
      {PERFORMANCE_ASSET_SCOPE_LABELS[assetClass]}
    </span>
  );
}
