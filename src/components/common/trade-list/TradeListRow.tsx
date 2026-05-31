/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: TradeListRow.tsx
 *
 * Description:
 * Recursive row primitive for the shared TradeList component.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { isValidElement, useId, useState } from "react";
import DisclosureChevron from "@/components/common/disclosure/DisclosureChevron";
import { useDisclosureHeight } from "@/components/common/disclosure/useDisclosureHeight";
import AssetClassChip from "./AssetClassChip";
import DirectionBadge from "./DirectionBadge";
import { getSignedNumberClass } from "./formatters";
import type { TradeListColumn, TradeListNode } from "./types";

type TradeListRowProps = {
  node: TradeListNode;
  columns: TradeListColumn[];
  gridTemplateColumns: string;
  depth?: number;
  density: "compact" | "comfortable";
  onNodeClick?: (node: TradeListNode) => void;
};

function alignmentClass(align: TradeListColumn["align"]) {
  if (align === "right") return "justify-end text-right";
  if (align === "center") return "justify-center text-center";
  return "justify-start text-left";
}

function formatRawValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  if (typeof value === "string") return value;
  if (isValidElement(value)) return value;
  return String(value);
}

function cellToneClass(column: TradeListColumn, value: unknown) {
  const lowerKey = column.key.toLowerCase();
  if (lowerKey.includes("return") || lowerKey.includes("pct") || lowerKey.includes("pnl")) {
    return getSignedNumberClass(value);
  }
  return "text-(--foreground)";
}

function renderLabelContent(node: TradeListNode, isExpandable: boolean, isOpen: boolean) {
  const levelClass =
    node.level === "symbol"
      ? "font-mono text-[13px] font-semibold tracking-[0.04em] text-(--foreground)"
      : "font-semibold text-(--foreground)";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-(--muted)">
        {isExpandable ? (
          <DisclosureChevron open={isOpen} size={14} rotationDegrees={90} />
        ) : (
          <span className="h-1 w-1 rounded-full bg-(--muted)/50" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 truncate">
        <span className={levelClass}>{node.label}</span>
      </span>
      {node.assetClass ? <AssetClassChip assetClass={node.assetClass} /> : null}
      {node.level === "fill" || node.level === "trade" ? (
        <DirectionBadge direction={node.direction} />
      ) : null}
    </div>
  );
}

export default function TradeListRow({
  node,
  columns,
  gridTemplateColumns,
  depth = 0,
  density,
  onNodeClick,
}: TradeListRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const childRegionId = useId();
  const isExpandable = node.expandable ?? Boolean(node.children?.length);
  const hasChildren = Boolean(node.children?.length);
  const { contentRef, contentStyle } = useDisclosureHeight(isOpen);
  const rowPadding = density === "comfortable" ? "px-4 py-3" : "px-3 py-2";
  const childIndentClass = depth > 0 ? "border-l border-(--panel-border)/50" : "";

  const handlePrimaryAction = () => {
    if (isExpandable && hasChildren) {
      setIsOpen((current) => !current);
      return;
    }
    onNodeClick?.(node);
  };

  return (
    <div className={childIndentClass} data-level={node.level}>
      <div
        className={`group/row grid min-h-10 border-b border-(--panel-border)/45 border-l-2 border-l-transparent text-xs transition hover:border-l-(--accent) hover:bg-(--accent)/5 ${rowPadding}`}
        style={{ gridTemplateColumns }}
        role="row"
        data-testid="trade-list-row"
      >
        {columns.map((column) => {
          const value = column.key === "label" ? node.label : node.values[column.key];
          const content =
            column.key === "label"
              ? renderLabelContent(node, isExpandable && hasChildren, isOpen)
              : column.format
                ? column.format(value, node)
                : formatRawValue(value);

          const labelPadding = column.key === "label" ? depth * 18 : 0;
          const isInteractiveLabel = column.key === "label" && (isExpandable || onNodeClick);

          return (
            <div
              key={column.key}
              className={`flex min-w-0 items-center ${alignmentClass(column.align)} ${cellToneClass(column, value)}`}
              style={column.key === "label" ? { paddingLeft: labelPadding } : undefined}
            >
              {isInteractiveLabel ? (
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="min-w-0 rounded-sm text-left outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent)"
                  aria-expanded={isExpandable && hasChildren ? isOpen : undefined}
                  aria-controls={isExpandable && hasChildren ? childRegionId : undefined}
                >
                  {content}
                </button>
              ) : (
                <span className="min-w-0 truncate">{content}</span>
              )}
            </div>
          );
        })}
      </div>

      {hasChildren ? (
        <div
          id={childRegionId}
          ref={contentRef}
          style={contentStyle}
          className="overflow-hidden transition-[height] duration-300 ease-out"
          aria-hidden={!isOpen}
        >
          <div>
            {node.children?.map((child) => (
              <TradeListRow
                key={child.id}
                node={child}
                columns={columns}
                gridTemplateColumns={gridTemplateColumns}
                depth={depth + 1}
                density={density}
                onNodeClick={onNodeClick}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
