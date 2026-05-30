/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BasketHierarchyLevel.tsx
 *
 * Description:
 * Generic row renderer for Basket hierarchy nodes.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import MissingReturnCell from "@/components/common/MissingReturnCell";
import AssetClassBadge from "@/components/common/basket/AssetClassBadge";
import type { AssetClass } from "@/lib/cotMarkets";
import type { BasketLevel } from "@/lib/basket/basketHierarchy";

export type BasketHierarchyNode = {
  id: string;
  level: BasketLevel;
  label: string;
  preview: string;
  returnText: string | null;
  returnTone: string;
  assetClass?: AssetClass;
  expanded?: boolean;
  expandable?: boolean;
  onClick?: () => void;
  onToggle?: () => void;
  testId?: string;
};

export default function BasketHierarchyLevel({ node }: { node: BasketHierarchyNode }) {
  const activate = node.onClick ?? node.onToggle;
  return (
    <div
      role={activate ? "button" : undefined}
      tabIndex={activate ? 0 : undefined}
      data-testid={node.testId ?? `basket-${node.level}-row`}
      data-node-id={node.id}
      onClick={activate}
      onKeyDown={(event) => {
        if (!activate) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
      className="grid w-full grid-cols-[minmax(12rem,1fr)_7rem] items-center gap-3 rounded-lg border border-(--panel-border) bg-(--panel)/65 px-4 py-3 text-left transition hover:border-(--accent)/40"
    >
      <span className="flex min-w-0 items-center gap-3">
        {node.expandable ? (
          <button
            type="button"
            aria-label={`${node.expanded ? "Collapse" : "Expand"} ${node.label}`}
            onClick={(event) => {
              event.stopPropagation();
              (node.onToggle ?? node.onClick)?.();
            }}
            className="w-4 text-[11px] text-(--muted) hover:text-(--accent-strong)"
          >
            {node.expanded ? "v" : ">"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-(--foreground)">{node.label}</span>
            {node.assetClass ? <AssetClassBadge assetClass={node.assetClass} /> : null}
          </span>
          <span className="mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em] text-(--muted)">
            {node.preview}
          </span>
        </span>
      </span>
      <span className={`text-right text-sm font-semibold ${node.returnTone}`}>
        {node.returnText ?? <MissingReturnCell />}
      </span>
    </div>
  );
}
