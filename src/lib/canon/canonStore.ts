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
  writeCanonBundle,
  writeCanonMeta,
} from "@/lib/canon/canonIndexedDb";
import { normalizePerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";

const APP_VERSION_STORAGE_KEY = "limni-app-version";
const MANIFEST_STORAGE_KEY = "limni-app-manifest-summary";

export type CanonPreloadPhase =
  | "idle"
  | "checking-version"
  | "loading-cache"
  | "updating-app-version"
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
  appVersion: string;
  semanticVersion: string;
  canonGeneratedAt: string;
  sourceLedgerRowCount: number;
  sourceHash: string;
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

function readStoredVersion() {
  if (!canUseLocalStorage()) return null;
  try {
    return window.localStorage.getItem(APP_VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredVersion(version: string) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, version);
  } catch {}
}

function writeManifestSummary(manifest: ReleaseManifest) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(
      MANIFEST_STORAGE_KEY,
      JSON.stringify({
        appVersion: manifest.appVersion,
        semanticVersion: manifest.semanticVersion,
        releasedAt: manifest.releasedAt,
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

async function fetchCanonBundle(appVersion: string, strategyVariant: string) {
  const params = new URLSearchParams({ strategyVariant, scope: "all" });
  const response = await fetch(`/api/canon/${appVersion}/historical?${params.toString()}`, {
    cache: "force-cache",
  });
  const json = await response.json() as { bundle?: ClosedHistoryBundle; error?: string };
  if (!response.ok || !json.bundle) {
    throw new Error(json.error ?? `Canon request failed (${response.status})`);
  }
  return json.bundle;
}

async function loadBundlesFromIndexedDb(manifest: ReleaseManifest) {
  memoryBundles.clear();
  for (const variant of manifest.canon.variants) {
    const key = canonBundleKey(manifest.appVersion, variant.strategyVariant);
    const bundle = await readCanonBundle<ClosedHistoryBundle>(key);
    if (!bundle) throw new Error(`Missing IndexedDB canon bundle: ${key}`);
    memoryBundles.set(variant.strategyVariant, bundle);
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
    const bundle = await fetchCanonBundle(manifest.appVersion, variant.strategyVariant);
    const key = canonBundleKey(manifest.appVersion, variant.strategyVariant);
    await writeCanonBundle(key, bundle);
    memoryBundles.set(variant.strategyVariant, bundle);
    setState({ completed: state.completed + 1 });
  }

  const meta: CanonMeta = {
    appVersion: manifest.appVersion,
    semanticVersion: manifest.semanticVersion,
    canonGeneratedAt: manifest.canon.generatedAt,
    sourceLedgerRowCount: manifest.canon.sourceLedgerRowCount,
    sourceHash: manifest.canon.sourceHash,
    cachedAtUtc: new Date().toISOString(),
  };
  await writeCanonMeta(canonMetaKey(manifest.appVersion), meta);
  writeManifestSummary(manifest);
  writeStoredVersion(manifest.appVersion);
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
      const storedVersion = readStoredVersion();
      const keys = manifest.canon.variants.map((variant) =>
        canonBundleKey(manifest.appVersion, variant.strategyVariant),
      );

      if (storedVersion === manifest.appVersion && await hasCanonBundles(keys)) {
        setState({
          phase: "loading-cache",
          status: "loading",
          appVersion: manifest.appVersion,
          total: keys.length,
          completed: 0,
          error: null,
        });
        await loadBundlesFromIndexedDb(manifest);
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
