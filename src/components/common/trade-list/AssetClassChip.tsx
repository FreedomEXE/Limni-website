/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AssetClassChip.tsx
 *
 * Description:
 * Small semantic asset-class chip for trade-list rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";
import { ASSET_CLASS_CHIP, ASSET_CLASS_LABEL } from "./formatters";

type AssetClassChipProps = {
  assetClass: AssetClass;
};

export default function AssetClassChip({ assetClass }: AssetClassChipProps) {
  const tone = ASSET_CLASS_CHIP[assetClass];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${tone.bg} ${tone.text} ${tone.border}`}
    >
      {ASSET_CLASS_LABEL[assetClass]}
    </span>
  );
}
