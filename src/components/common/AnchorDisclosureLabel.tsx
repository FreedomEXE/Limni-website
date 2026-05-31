/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AnchorDisclosureLabel.tsx
 *
 * Description:
 * Small disclosure label for surfaces with a locked return anchor.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import type { AnchorValue } from "@/lib/viewMode/viewModeTypes";

const ANCHOR_DISCLOSURE: Record<AnchorValue, string> = {
  execution: "Returns measured from execution open (Mon 00:00 UTC)",
  canonical: "Returns measured from canonical market open (asset-class-specific)",
};

type Props = {
  anchor: AnchorValue;
};

export default function AnchorDisclosureLabel({ anchor }: Props) {
  return (
    <p className="text-[10px] uppercase tracking-[0.2em] text-(--muted)/70">
      {ANCHOR_DISCLOSURE[anchor]}
    </p>
  );
}
