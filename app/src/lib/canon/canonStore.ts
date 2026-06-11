/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonStore.ts
 *
 * Description:
 * Version-aware immutable canon preloader and synchronous in-memory snapshot store.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useSyncExternalStore } from "react";
import type { AssetClass } from "@/lib/cotMarkets";
import type { ClosedHistoryBundle } from "@/lib/basket/basketSummaryTypes";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";
import {
  canonBundleKey,
  canonMetaKey,
  hasCanonBundles,
  readCanonBundle,
  readCanonMeta,
  writeCanonBundle,
  writeCanonMeta,
} from "@/lib/canon/canonIndexedDb";
import { normalizePerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import { clearStrategyClientPayloadCaches } from "@/lib/performance/strategyClientCache";
import { clearGlobalPreloadStamp } from "@/lib/preload/preloadContract";
import {
  isCanonArtifactStale,
  staleCanonErrorMessage,
} from "@/lib/canon/canonArtifactStatus";

const CACHE_NAMESPACE_STORAGE_KEY = "limni-cache-namespace";
const MANIFEST_STORAGE_KEY = "limni-app-manifest-summary";

export type CanonPreloadPhase =
  | "idle"
  | "checking-version"
  | "loading-cache"
  | "updating-app-version"
  | "stale-canon"
  | "ready"
  | "error";

type CanonPreloadState = {
  phase: CanonPreloadPhase;
  status: "idle" | "loading" | "ready" | "error";
  appVersion: string | null;
  total: number;
  completed: number;
  error: string | null;
};

type CanonMeta = {
  releaseLine: string;
  appVersion: string;
  semanticVersion: string;
  canonVersion: string;
  cacheNamespace: string;
  canonGeneratedAt: string;
  sourceLedgerRowCount: number;
  sourceHash: string;
  engineVersion: string;
  variantHashes: Record<string, string>;
  cachedAtUtc: string;
};

const listeners = new Set<() => void>();
const memoryBundles = new Map<string, ClosedHistoryBundle>();
let preloadInflight: Promise<void> | null = null;
let currentManifest: ReleaseManifest | null = null;
let state: CanonPreloadState = {
  phase: "idle",
  status: "idle",
  appVersion: null,
  total: 0,
  completed: 0,
  error: null,
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

function setState(next: Partial<CanonPreloadState>) {
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

function writeManifestSummary(manifest: ReleaseManifest) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(
      MANIFEST_STORAGE_KEY,
      JSON.stringify({
        appVersion: manifest.appVersion,
        displayVersion: manifest.displayVersion,
        semanticVersion: manifest.semanticVersion,
        canonVersion: manifest.canonVersion,
        cacheNamespace: manifest.cacheNamespace,
        releasedAt: manifest.releasedAt,
        preparedAt: manifest.preparedAt,
        canon: manifest.canon,
      }),
    );
  } catch {}
}

async function fetchCurrentManifest() {
  const response = await fetch("/api/version/current", { cache: "no-store" });
  if (!response.ok) throw new Error(`Version manifest request failed (${response.status})`);
  return await response.json() as ReleaseManifest;
}

async function fetchCanonBundle(canonVersion: string, strategyVariant: string) {
  const params = new URLSearchParams({ strategyVariant, scope: "all" });
  const response = await fetch(`/api/canon/${canonVersion}/historical?${params.toString()}`, {
    cache: "force-cache",
  });
  const json = await response.json() as { bundle?: ClosedHistoryBundle; error?: string };
  if (!response.ok || !json.bundle) {
    throw new Error(json.error ?? `Canon request failed (${response.status})`);
  }
  return json.bundle;
}

function canonMetaFromManifest(manifest: ReleaseManifest): CanonMeta {
  return {
    releaseLine: manifest.releaseLine,
    appVersion: manifest.appVersion,
    semanticVersion: manifest.semanticVersion,
    canonVersion: manifest.canonVersion,
    cacheNamespace: manifest.cacheNamespace,
    canonGeneratedAt: manifest.canon.generatedAt,
    sourceLedgerRowCount: manifest.canon.sourceLedgerRowCount,
    sourceHash: manifest.canon.sourceHash,
    engineVersion: manifest.components.engineVersion,
    variantHashes: Object.fromEntries(
      manifest.canon.variants.map((variant) => [variant.strategyVariant, variant.sha256]),
    ),
    cachedAtUtc: new Date().toISOString(),
  };
}

function canonMetaMatchesManifest(meta: CanonMeta | null, manifest: ReleaseManifest) {
  if (!meta) return false;
  if (meta.releaseLine !== manifest.releaseLine) return false;
  if (meta.appVersion !== manifest.appVersion) return false;
  if (meta.semanticVersion !== manifest.semanticVersion) return false;
  if (meta.canonVersion !== manifest.canonVersion) return false;
  if (meta.cacheNamespace !== manifest.cacheNamespace) return false;
  if (meta.canonGeneratedAt !== manifest.canon.generatedAt) return false;
  if (meta.sourceLedgerRowCount !== manifest.canon.sourceLedgerRowCount) return false;
  if (meta.sourceHash !== manifest.canon.sourceHash) return false;
  if (meta.engineVersion !== manifest.components.engineVersion) return false;

  for (const variant of manifest.canon.variants) {
    if (meta.variantHashes?.[variant.strategyVariant] !== variant.sha256) {
      return false;
    }
  }

  return true;
}

async function hasValidatedCanonBundles(manifest: ReleaseManifest, keys: string[]) {
  const meta = await readCanonMeta<CanonMeta>(canonMetaKey(manifest.canonVersion));
  if (!canonMetaMatchesManifest(meta, manifest)) {
    return false;
  }
  return hasCanonBundles(keys);
}

async function loadBundlesFromIndexedDb(manifest: ReleaseManifest) {
  memoryBundles.clear();
  for (const variant of manifest.canon.variants) {
    const key = canonBundleKey(manifest.canonVersion, variant.strategyVariant);
    const bundle = await readCanonBundle<ClosedHistoryBundle>(key);
    if (!bundle) throw new Error(`Missing IndexedDB canon bundle: ${key}`);
    memoryBundles.set(variant.strategyVariant, bundle);
    setState({ completed: Math.min(state.total, state.completed + 1) });
  }
}

async function fetchAndPersistBundles(manifest: ReleaseManifest) {
  memoryBundles.clear();
  const variants = manifest.canon.variants;
  setState({
    phase: "updating-app-version",
    status: "loading",
    appVersion: manifest.appVersion,
    total: variants.length,
    completed: 0,
    error: null,
  });

  for (const variant of variants) {
    const bundle = await fetchCanonBundle(manifest.canonVersion, variant.strategyVariant);
    const key = canonBundleKey(manifest.canonVersion, variant.strategyVariant);
    await writeCanonBundle(key, bundle);
    memoryBundles.set(variant.strategyVariant, bundle);
    setState({ completed: state.completed + 1 });
  }

  await writeCanonMeta(canonMetaKey(manifest.canonVersion), canonMetaFromManifest(manifest));
  writeManifestSummary(manifest);
  writeStoredCacheNamespace(manifest.cacheNamespace);
}

export function startCanonPreload() {
  if (state.status === "ready" && currentManifest) return Promise.resolve();
  if (preloadInflight) return preloadInflight;

  preloadInflight = (async () => {
    try {
      setState({
        phase: "checking-version",
        status: "loading",
        total: 0,
        completed: 0,
        error: null,
      });
      const manifest = await fetchCurrentManifest();
      currentManifest = manifest;
      const storedCacheNamespace = readStoredCacheNamespace();
      const cacheNamespaceChanged = storedCacheNamespace !== manifest.cacheNamespace;
      const keys = manifest.canon.variants.map((variant) =>
        canonBundleKey(manifest.canonVersion, variant.strategyVariant),
      );

      if (cacheNamespaceChanged) {
        clearGlobalPreloadStamp();
        await clearStrategyClientPayloadCaches();
      }

      if (isCanonArtifactStale(manifest)) {
        memoryBundles.clear();
        writeManifestSummary(manifest);
        setState({
          phase: "stale-canon",
          status: "error",
          appVersion: manifest.appVersion,
          total: keys.length,
          completed: 0,
          error: staleCanonErrorMessage(manifest),
        });
        return;
      }

      if (!cacheNamespaceChanged && await hasValidatedCanonBundles(manifest, keys)) {
        setState({
          phase: cacheNamespaceChanged ? "updating-app-version" : "loading-cache",
          status: "loading",
          appVersion: manifest.appVersion,
          total: keys.length,
          completed: 0,
          error: null,
        });
        await loadBundlesFromIndexedDb(manifest);
        writeManifestSummary(manifest);
        writeStoredCacheNamespace(manifest.cacheNamespace);
        setState({
          phase: "ready",
          status: "ready",
          appVersion: manifest.appVersion,
          total: keys.length,
          completed: keys.length,
          error: null,
        });
        return;
      }

      await fetchAndPersistBundles(manifest);
      setState({
        phase: "ready",
        status: "ready",
        appVersion: manifest.appVersion,
        total: keys.length,
        completed: keys.length,
        error: null,
      });
    } catch (error) {
      setState({
        phase: "error",
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      preloadInflight = null;
    }
  })();

  return preloadInflight;
}

export function getCanonManifestSnapshot() {
  return currentManifest;
}

export function getCanonClosedHistorySnapshot(opts: {
  strategyVariant: string;
  scope: readonly AssetClass[];
}): ClosedHistoryBundle | null {
  const bundle = memoryBundles.get(opts.strategyVariant);
  if (!bundle) return null;
  const normalizedScope = normalizePerformanceAssetSelection(opts.scope);
  const selected = new Set(normalizedScope);
  return {
    ...bundle,
    scope: normalizedScope,
    rows: bundle.rows.filter((row) => selected.has(row.assetClass)),
  };
}

export function useCanonPreloadStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
