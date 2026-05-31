/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: types.ts
 *
 * Description:
 * Domain-agnostic types for the shared trade-list component.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ReactNode } from "react";
import type { AssetClass } from "@/lib/cotMarkets";

export type TradeListProps = {
  nodes: TradeListNode[];
  columns: TradeListColumn[];
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  onNodeClick?: (node: TradeListNode) => void;
  density?: "compact" | "comfortable";
  emptyState?: ReactNode;
};

export type TradeListNode = {
  id: string;
  level: string;
  label: string;
  assetClass?: AssetClass;
  direction?: "LONG" | "SHORT" | null;
  values: Record<string, unknown>;
  children?: TradeListNode[];
  expandable?: boolean;
};

export type TradeListColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  defaultDirection?: "asc" | "desc";
  format?: (value: unknown, node: TradeListNode) => ReactNode;
  width?: string;
};

export type SortState = { key: string; direction: "asc" | "desc" };
