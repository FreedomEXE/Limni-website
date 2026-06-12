/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonKernelStore.ts
 *
 * Description:
 * Client-side runtime kernel for active-variant canon shard inventory, gap
 * detection, and IndexedDB hydration. This is intentionally additive: the
 * legacy monolithic preload path remains the rendering fallback until parity
 * tests and browser verification approve the cutover.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useSyncExternalStore } from "react";
import {
  computeCanonShardGaps,
  expectedWeeksForVariant,
} from "@/lib/canon/canonShardInventory";
import {
  canonVariantInventoryKey,
  canonWeekShardKey,
  CANON_INVENTORY_SCHEMA_VERSION,
  CANON_WEEK_SHARD_SCHEMA_VERSION,
  type CanonInventoryManifest,
  type CanonShardRecord,
  type CanonWeekShard,
} from "@/lib/canon/canonShardTypes";
import { composeClosedHistoryBundleFromShards } from "@/lib/canon/canonShardComposition";
import {
  deleteCanonWeekShardRecord,
  listCanonWeekShardRecords,
  writeCanonInventoryRecord,
  writeCanonKernelMeta,
  writeCanonWeekShardRecord,
} from "@/lib/canon/canonIndexedDb";
import type { ClosedHistoryBundle } from "@/lib/basket/basketSummaryTypes";
import type { AssetClass } from "@/lib/cotMarkets";
import { normalizePerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import { clearStrategyClientPayloadCaches } from "@/lib/performance/strategyClientCache";
import {
  strategyVariantFromRuntimeSelection,
  type RuntimeStrategySelection,
} from "@/lib/performance/strategySelection";
import { clearGlobalPreloadStamp } from "@/lib/preload/preloadContract";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";
import {
  isCanonArtifactStale,
  staleCanonErrorMessage,
} from "@/lib/canon/canonArtifactStatus";

const CACHE_NAMESPACE_STORAGE_KEY = "limni-cache-namespace";

export type CanonKernelPhase =
  | "idle"
  | "loading-release-manifest"
  | "syncing-cache-namespace"
  | "checking-closed-week-manifest"
  | "hydrating-local-canon"
  | "fetching-closed-week-deltas"
  | "composing-active-history"
  | "ready"
  | "degraded"
  | "error";

export type CanonKernelState = {
  phase: CanonKernelPhase;
  status: "idle" | "loading" | "ready" | "degraded" | "error";
  activeStrategyVariant: string | null;
  appVersion: string | null;
  canonVersion: string | null;
  cacheNamespace: string | null;
  currentWeekOpenUtc: string | null;
  latestClosedWeekOpenUtc: string | null;
  totalWeeks: number;
  readyWeeks: number;
  composedRows: number;
  fetchedWeeks: number;
  repairedWeeks: number;
  missingWeeks: string[];
  error: string | null;
  updatedAtUtc: string | null;
};

type InventoryResponse = {
  inventory?: CanonInventoryManifest;
  error?: string;
};

type WeekShardResponse = {
  shard?: CanonWeekShard;
  error?: string;
};

const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<void>>();
const composedClosedHistoryBundles = new Map<string, ClosedHistoryBundle>();
let state: CanonKernelState = {
  phase: "idle",
  status: "idle",
  activeStrategyVariant: null,
  appVersion: null,
  canonVersion: null,
  cacheNamespace: null,
  currentWeekOpenUtc: null,
  latestClosedWeekOpenUtc: null,
  totalWeeks: 0,
  readyWeeks: 0,
  composedRows: 0,
  fetchedWeeks: 0,
  repairedWeeks: 0,
  missingWeeks: [],
  error: null,
  updatedAtUtc: null,
};

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function setState(next: Partial<CanonKernelState>) {
  state = { ...state, ...next };
  emit();
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredCacheNamespace() {
  if (!canUseLocalStorage()) return null;
  try {
    return window.localStorage.getItem(CACHE_NAMESPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredCacheNamespace(cacheNamespace: string) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(CACHE_NAMESPACE_STORAGE_KEY, cacheNamespace);
  } catch {}
}

function composedBundleKey(canonVersion: string, strategyVariant: string) {
  return `${canonVersion}::${strategyVariant}`;
}

function clearAllComposedBundles() {
  composedClosedHistoryBundles.clear();
}

async function fetchReleaseManifest() {
  const response = await fetch("/api/version/current", { cache: "no-store" });
  if (!response.ok) throw new Error(`Version manifest request failed (${response.status})`);
  return await response.json() as ReleaseManifest;
}

async function fetchInventory(canonVersion: string, strategyVariant: string) {
  const params = new URLSearchParams({ strategyVariant });
  const response = await fetch(`/api/canon/${encodeURIComponent(canonVersion)}/inventory?${params.toString()}`, {
    cache: "no-store",
  });
  const json = await response.json() as InventoryResponse;
  if (!response.ok || !json.inventory) {
    throw new Error(json.error ?? `Canon inventory request failed (${response.status})`);
  }
  if (json.inventory.schemaVersion !== CANON_INVENTORY_SCHEMA_VERSION) {
    throw new Error(`Unsupported canon inventory schema: ${json.inventory.schemaVersion}`);
  }
  return json.inventory;
}

async function fetchWeekShard(options: {
  canonVersion: string;
  strategyVariant: string;
  weekOpenUtc: string;
  staleCanon: boolean;
  staleCanonError: string;
}) {
  const params = new URLSearchParams({
    strategyVariant: options.strategyVariant,
    weekOpenUtc: options.weekOpenUtc,
  });
  const response = await fetch(
    `/api/canon/${encodeURIComponent(options.canonVersion)}/week?${params.toString()}`,
    { cache: options.staleCanon ? "no-store" : "force-cache" },
  );
  const json = await response.json() as WeekShardResponse;
  if (!response.ok || !json.shard) {
    throw new Error(json.error ?? `Canon week shard request failed (${response.status})`);
  }
  if (json.shard.metadata.schemaVersion !== CANON_WEEK_SHARD_SCHEMA_VERSION) {
    throw new Error(`Unsupported canon week shard schema: ${json.shard.metadata.schemaVersion}`);
  }
  if (options.staleCanon && json.shard.metadata.source === "release-canon") {
    throw new Error(options.staleCanonError);
  }
  return json.shard;
}

function shardToRecord(shard: CanonWeekShard): CanonShardRecord {
  return {
    key: canonWeekShardKey(
      shard.metadata.canonVersion,
      shard.metadata.strategyVariant,
      shard.metadata.weekOpenUtc,
    ),
    canonVersion: shard.metadata.canonVersion,
    strategyVariant: shard.metadata.strategyVariant,
    weekOpenUtc: shard.metadata.weekOpenUtc,
    source: shard.metadata.source,
    schemaVersion: shard.metadata.schemaVersion,
    payloadHash: shard.metadata.payloadHash,
    storedAtUtc: new Date().toISOString(),
    shard,
  };
}

async function syncCacheNamespace(manifest: ReleaseManifest) {
  setState({ phase: "syncing-cache-namespace", status: "loading" });
  const storedCacheNamespace = readStoredCacheNamespace();
  if (storedCacheNamespace && storedCacheNamespace !== manifest.cacheNamespace) {
    clearGlobalPreloadStamp();
    await clearStrategyClientPayloadCaches();
  }
  writeStoredCacheNamespace(manifest.cacheNamespace);
}

async function runKernelSync(selection: RuntimeStrategySelection) {
  const activeStrategyVariant = strategyVariantFromRuntimeSelection(selection);
  setState({
    phase: "loading-release-manifest",
    status: "loading",
    activeStrategyVariant,
    totalWeeks: 0,
    readyWeeks: 0,
    composedRows: 0,
    fetchedWeeks: 0,
    repairedWeeks: 0,
    missingWeeks: [],
    error: null,
  });

  const manifest = await fetchReleaseManifest();
  const staleCanon = isCanonArtifactStale(manifest);
  const staleCanonError = staleCanonErrorMessage(manifest);
  if (staleCanon) {
    clearAllComposedBundles();
  }
  setState({
    appVersion: manifest.liveVersion,
    canonVersion: manifest.canonVersion,
    cacheNamespace: manifest.cacheNamespace,
  });
  await syncCacheNamespace(manifest);

  if (staleCanon) {
    setState({
      phase: "error",
      status: "error",
      activeStrategyVariant,
      appVersion: manifest.liveVersion,
      canonVersion: manifest.canonVersion,
      cacheNamespace: manifest.cacheNamespace,
      totalWeeks: 0,
      readyWeeks: 0,
      composedRows: 0,
      fetchedWeeks: 0,
      repairedWeeks: 0,
      missingWeeks: [],
      error: staleCanonError,
      updatedAtUtc: new Date().toISOString(),
    });
    return;
  }

  setState({ phase: "checking-closed-week-manifest", status: "loading" });
  const inventory = await fetchInventory(manifest.canonVersion, activeStrategyVariant);
  const variantInventory = inventory.variants[activeStrategyVariant];
  if (!variantInventory) {
    setState({
      phase: "degraded",
      status: "degraded",
      currentWeekOpenUtc: inventory.currentWeekOpenUtc,
      latestClosedWeekOpenUtc: inventory.latestClosedWeekOpenUtc,
      error: `No canon shard inventory for ${activeStrategyVariant}; legacy preload remains active.`,
      updatedAtUtc: new Date().toISOString(),
    });
    return;
  }

  const expectedWeeks = expectedWeeksForVariant(variantInventory);
  setState({
    phase: "hydrating-local-canon",
    status: "loading",
    currentWeekOpenUtc: inventory.currentWeekOpenUtc,
    latestClosedWeekOpenUtc: variantInventory.latestClosedWeekOpenUtc,
    totalWeeks: expectedWeeks.length,
  });

  const localRecords = staleCanon
    ? []
    : await listCanonWeekShardRecords({
        canonVersion: inventory.canonVersion,
        strategyVariant: activeStrategyVariant,
      });
  let gaps = computeCanonShardGaps(variantInventory, localRecords);
  let readyWeeks = Math.max(0, expectedWeeks.length - gaps.length);
  setState({
    readyWeeks,
    missingWeeks: gaps.map((gap) => gap.weekOpenUtc),
  });

  let fetchedWeeks = 0;
  let repairedWeeks = 0;
  const transientRecords: CanonShardRecord[] = [];
  if (gaps.length > 0) {
    setState({ phase: "fetching-closed-week-deltas", status: "loading" });
    for (const gap of gaps) {
      if (gap.local) {
        repairedWeeks += 1;
        await deleteCanonWeekShardRecord(gap.local.key);
      }
      const shard = await fetchWeekShard({
        canonVersion: inventory.canonVersion,
        strategyVariant: activeStrategyVariant,
        weekOpenUtc: gap.weekOpenUtc,
        staleCanon,
        staleCanonError,
      });
      if (shard.metadata.payloadHash !== gap.expected.sha256) {
        throw new Error(`Canon shard hash mismatch for ${activeStrategyVariant} ${gap.weekOpenUtc}`);
      }
      const record = shardToRecord(shard);
      if (staleCanon) {
        transientRecords.push(record);
      } else {
        await writeCanonWeekShardRecord(record);
      }
      fetchedWeeks += 1;
      readyWeeks = Math.min(expectedWeeks.length, readyWeeks + 1);
      setState({
        fetchedWeeks,
        repairedWeeks,
        readyWeeks,
      });
    }
  }

  const finalRecords = staleCanon
    ? transientRecords
    : await listCanonWeekShardRecords({
        canonVersion: inventory.canonVersion,
        strategyVariant: activeStrategyVariant,
      });
  gaps = computeCanonShardGaps(variantInventory, finalRecords);

  if (!staleCanon) {
    await writeCanonInventoryRecord({
      key: canonVariantInventoryKey(inventory.canonVersion, activeStrategyVariant),
      canonVersion: inventory.canonVersion,
      strategyVariant: activeStrategyVariant,
      weeks: expectedWeeks.map((week) => week.weekOpenUtc),
      latestClosedWeekOpenUtc: variantInventory.latestClosedWeekOpenUtc,
      updatedAtUtc: new Date().toISOString(),
    });
    await writeCanonKernelMeta({
      key: inventory.canonVersion,
      releaseLine: inventory.releaseLine,
      appVersion: inventory.appVersion,
      canonVersion: inventory.canonVersion,
      cacheNamespace: inventory.cacheNamespace,
      schemaVersion: inventory.schemaVersion,
      updatedAtUtc: new Date().toISOString(),
    });
  }

  const updatedAtUtc = new Date().toISOString();
  if (gaps.length > 0) {
    clearAllComposedBundles();
    setState({
      phase: "degraded",
      status: "degraded",
      readyWeeks: Math.max(0, expectedWeeks.length - gaps.length),
      missingWeeks: gaps.map((gap) => gap.weekOpenUtc),
      error: `Canon kernel still missing ${gaps.length} shard(s); legacy preload remains active.`,
      updatedAtUtc,
    });
    return;
  }

  setState({ phase: "composing-active-history", status: "loading" });
  const expectedWeekOpenUtcs = expectedWeeks.map((week) => week.weekOpenUtc);
  const composedBundle = composeClosedHistoryBundleFromShards({
    records: finalRecords,
    strategyVariant: activeStrategyVariant,
    weekOpenUtcs: expectedWeekOpenUtcs,
  });
  composedClosedHistoryBundles.set(
    composedBundleKey(inventory.canonVersion, activeStrategyVariant),
    composedBundle,
  );

  setState({
    phase: "ready",
    status: "ready",
    readyWeeks: expectedWeeks.length,
    composedRows: composedBundle.rows.length,
    missingWeeks: [],
    error: null,
    updatedAtUtc,
  });
}

export function startCanonKernelSync(selection: RuntimeStrategySelection) {
  const activeStrategyVariant = strategyVariantFromRuntimeSelection(selection);
  if (
    state.activeStrategyVariant === activeStrategyVariant
    && (state.status === "loading" || state.status === "ready" || state.status === "error" || state.status === "degraded")
  ) {
    return Promise.resolve();
  }
  const key = `${activeStrategyVariant}:${state.cacheNamespace ?? "unknown"}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = runKernelSync(selection)
    .catch((error) => {
      clearAllComposedBundles();
      setState({
        phase: "error",
        status: "error",
        activeStrategyVariant,
        error: error instanceof Error ? error.message : String(error),
        updatedAtUtc: new Date().toISOString(),
      });
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

export function useCanonKernelStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getCanonKernelClosedHistorySnapshot(opts: {
  strategyVariant: string;
  scope: readonly AssetClass[];
}) {
  if (state.status !== "ready") return null;
  if (opts.strategyVariant !== state.activeStrategyVariant) return null;
  const canonVersion = state.canonVersion;
  if (!canonVersion) return null;
  const bundle = composedClosedHistoryBundles.get(composedBundleKey(canonVersion, opts.strategyVariant));
  if (!bundle) return null;
  const normalizedScope = normalizePerformanceAssetSelection(opts.scope);
  const selected = new Set(normalizedScope);
  return {
    ...bundle,
    scope: normalizedScope,
    rows: bundle.rows.filter((row) => selected.has(row.assetClass)),
  };
}
