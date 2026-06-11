/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketHierarchy.ts
 *
 * Description:
 * Strategy-config-driven hierarchy helpers for the Basket tree.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { StrategyConfig } from "@/lib/performance/strategyConfig";

export type BasketLevel = "week" | "portfolio" | "tier" | "symbol" | "grid" | "fill" | "trade";

export function resolveBasketHierarchy(strategyConfig: StrategyConfig, strategyVariant: string): BasketLevel[] {
  const levels: BasketLevel[] = ["week"];
  const hasPortfolio = strategyConfig.type === "tandem" || strategyConfig.cardBreakdown === "per_model";
  const hasTier = strategyConfig.type === "tiered" || strategyConfig.cardBreakdown === "tiers";
  const hasGrid = strategyVariant.split("-").includes("adr_grid");

  if (hasPortfolio) levels.push("portfolio");
  if (hasTier) levels.push("tier");
  levels.push("symbol");
  if (hasGrid) levels.push("grid", "fill");
  else levels.push("trade");
  return levels;
}

export function hierarchyWithoutWeek(levels: BasketLevel[]) {
  return levels.filter((level) => level !== "week");
}
