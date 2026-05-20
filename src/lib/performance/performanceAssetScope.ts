import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

export type PerformanceAssetScope = "all" | AssetClass;
export type PerformanceAssetSelection = AssetClass[];

export const PERFORMANCE_ASSET_CLASSES: AssetClass[] = [
  "fx",
  "indices",
  "commodities",
  "crypto",
];

export const ALL_PERFORMANCE_ASSET_SELECTION: PerformanceAssetSelection = [
  ...PERFORMANCE_ASSET_CLASSES,
];

export const PERFORMANCE_ASSET_SCOPES: PerformanceAssetScope[] = [
  "all",
  ...PERFORMANCE_ASSET_CLASSES,
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

export function parsePerformanceAssetSelection(value: string | null | undefined): PerformanceAssetSelection {
  if (!value || value === "all") return [...ALL_PERFORMANCE_ASSET_SELECTION];
  const selected = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is AssetClass => PERFORMANCE_ASSET_CLASSES.includes(item as AssetClass));
  return normalizePerformanceAssetSelection(selected);
}

export function formatPerformanceAssetSelection(selection: readonly AssetClass[]) {
  const normalized = normalizePerformanceAssetSelection(selection);
  return isAllPerformanceAssetSelection(normalized) ? "all" : normalized.join(",");
}

export function isAllPerformanceAssetSelection(selection: readonly AssetClass[]) {
  const selected = new Set(selection);
  return PERFORMANCE_ASSET_CLASSES.every((assetClass) => selected.has(assetClass));
}

export function normalizePerformanceAssetSelection(
  selection: readonly AssetClass[] | null | undefined,
): PerformanceAssetSelection {
  if (!selection || selection.length === 0) return [...ALL_PERFORMANCE_ASSET_SELECTION];
  const selected = new Set(
    selection.filter((assetClass): assetClass is AssetClass =>
      PERFORMANCE_ASSET_CLASSES.includes(assetClass),
    ),
  );
  if (selected.size === 0) return [...ALL_PERFORMANCE_ASSET_SELECTION];
  return PERFORMANCE_ASSET_CLASSES.filter((assetClass) => selected.has(assetClass));
}

export function togglePerformanceAssetSelection(
  selection: readonly AssetClass[] | null | undefined,
  assetClass: AssetClass,
): PerformanceAssetSelection {
  const current = new Set(normalizePerformanceAssetSelection(selection));
  if (current.has(assetClass)) {
    if (current.size === 1) return normalizePerformanceAssetSelection(Array.from(current));
    current.delete(assetClass);
  } else {
    current.add(assetClass);
  }
  return normalizePerformanceAssetSelection(Array.from(current));
}

export function inferPerformanceAssetClass(symbol: string): AssetClass {
  return SYMBOL_ASSET_CLASS.get(symbol.toUpperCase()) ?? "fx";
}

export function assetMatchesPerformanceScope(
  assetClass: string | null | undefined,
  scope: PerformanceAssetScope | readonly AssetClass[],
) {
  if (Array.isArray(scope)) return Boolean(assetClass && scope.includes(assetClass as AssetClass));
  return scope === "all" || assetClass === scope;
}

export function symbolMatchesPerformanceScope(
  symbol: string,
  scope: PerformanceAssetScope | readonly AssetClass[],
) {
  return assetMatchesPerformanceScope(inferPerformanceAssetClass(symbol), scope);
}

export function performanceScopeIncludesCrypto(scope: PerformanceAssetScope | readonly AssetClass[]) {
  return Array.isArray(scope) ? scope.includes("crypto") : scope === "all" || scope === "crypto";
}
