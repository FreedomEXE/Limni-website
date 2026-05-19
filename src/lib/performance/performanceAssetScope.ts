import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

export type PerformanceAssetScope = "all" | AssetClass;

export const PERFORMANCE_ASSET_SCOPES: PerformanceAssetScope[] = [
  "all",
  "fx",
  "indices",
  "commodities",
  "crypto",
];

export const PERFORMANCE_ASSET_SCOPE_LABELS: Record<PerformanceAssetScope, string> = {
  all: "All",
  fx: "FX",
  indices: "Indices",
  commodities: "Commodities",
  crypto: "Crypto",
};

const SYMBOL_ASSET_CLASS = new Map<string, AssetClass>(
  Object.entries(PAIRS_BY_ASSET_CLASS).flatMap(([assetClass, pairs]) =>
    pairs.map((pair) => [pair.pair.toUpperCase(), assetClass as AssetClass]),
  ),
);

export function parsePerformanceAssetScope(value: string | null | undefined): PerformanceAssetScope {
  return PERFORMANCE_ASSET_SCOPES.includes(value as PerformanceAssetScope)
    ? value as PerformanceAssetScope
    : "all";
}

export function inferPerformanceAssetClass(symbol: string): AssetClass {
  return SYMBOL_ASSET_CLASS.get(symbol.toUpperCase()) ?? "fx";
}

export function assetMatchesPerformanceScope(
  assetClass: string | null | undefined,
  scope: PerformanceAssetScope,
) {
  return scope === "all" || assetClass === scope;
}

export function symbolMatchesPerformanceScope(symbol: string, scope: PerformanceAssetScope) {
  return assetMatchesPerformanceScope(inferPerformanceAssetClass(symbol), scope);
}

export function performanceScopeIncludesCrypto(scope: PerformanceAssetScope) {
  return scope === "all" || scope === "crypto";
}
