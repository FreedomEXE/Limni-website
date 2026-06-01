/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonArtifact.ts
 *
 * Description:
 * Shared contract for materialized immutable release canon artifacts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ClosedHistoryBundle } from "@/lib/basket/basketSummaryTypes";

export type CanonArtifactMetadata = {
  releaseLine?: string;
  appVersion: string;
  semanticVersion: string;
  canonVersion?: string;
  preparedAt?: string;
  releasedAt: string | null;
  canonGeneratedAt: string;
  strategyVariant: string;
  sourceLedgerRowCount: number;
  sourceHash: string;
};

export type CanonArtifact = {
  metadata: CanonArtifactMetadata;
  bundle: ClosedHistoryBundle;
};

export function strategyVariantToCanonFileSlug(strategyVariant: string) {
  return strategyVariant
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "__")
    .replace(/^__+|__+$/g, "")
    .toLowerCase();
}

export function canonFileNameForStrategyVariant(strategyVariant: string) {
  return `${strategyVariantToCanonFileSlug(strategyVariant)}.json`;
}
