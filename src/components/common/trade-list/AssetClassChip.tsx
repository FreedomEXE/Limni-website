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
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${tone.bg} ${tone.text} ${tone.border}`}
    >
      {ASSET_CLASS_LABEL[assetClass]}
    </span>
  );
}
