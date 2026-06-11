/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: HierarchySortControl.tsx
 *
 * Description:
 * Small sort control for Basket hierarchy levels.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import SegmentedToggle from "@/components/common/SegmentedToggle";

export type HierarchySortMode = "default" | "return" | "oldest";

type HierarchySortControlProps = {
  value: HierarchySortMode;
  onChange: (next: HierarchySortMode) => void;
  includeOldest?: boolean;
};

export default function HierarchySortControl({ value, onChange, includeOldest = false }: HierarchySortControlProps) {
  return (
    <SegmentedToggle
      value={value}
      onChange={onChange}
      ariaLabel="Hierarchy sort"
      size="sm"
      items={[
        { value: "default", label: includeOldest ? "Newest" : "A-Z" },
        ...(includeOldest ? [{ value: "oldest" as const, label: "Oldest" }] : []),
        { value: "return", label: "Return" },
      ]}
    />
  );
}
