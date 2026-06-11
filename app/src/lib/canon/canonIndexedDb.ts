/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonIndexedDb.ts
 *
 * Description:
 * IndexedDB wrapper for legacy monolithic canon bundles and the v2.0.2
 * per-week shard stores used by the kernel architecture.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import type {
  CanonInventoryRecord,
  CanonKernelMetaRecord,
  CanonShardRecord,
} from "@/lib/canon/canonShardTypes";

const DB_NAME = "limni-canon";
const DB_VERSION = 2;
const BUNDLES_STORE = "bundles";
const META_STORE = "meta";
const WEEK_SHARDS_STORE = "weekShards";
const INVENTORIES_STORE = "inventories";
const KERNEL_META_STORE = "kernelMeta";

type StoreName =
  | typeof BUNDLES_STORE
  | typeof META_STORE
  | typeof WEEK_SHARDS_STORE
  | typeof INVENTORIES_STORE
  | typeof KERNEL_META_STORE;

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openCanonDb(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error("IndexedDB unavailable in this runtime"));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open canon IndexedDB"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BUNDLES_STORE)) db.createObjectStore(BUNDLES_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(WEEK_SHARDS_STORE)) {
        const store = db.createObjectStore(WEEK_SHARDS_STORE, { keyPath: "key" });
        store.createIndex("canonVersion", "canonVersion");
        store.createIndex("strategyVariant", "strategyVariant");
        store.createIndex("canonVersion_strategyVariant", ["canonVersion", "strategyVariant"]);
        store.createIndex("canonVersion_strategyVariant_weekOpenUtc", [
          "canonVersion",
          "strategyVariant",
          "weekOpenUtc",
        ]);
      }
      if (!db.objectStoreNames.contains(INVENTORIES_STORE)) {
        const store = db.createObjectStore(INVENTORIES_STORE, { keyPath: "key" });
        store.createIndex("canonVersion", "canonVersion");
        store.createIndex("strategyVariant", "strategyVariant");
      }
      if (!db.objectStoreNames.contains(KERNEL_META_STORE)) {
        const store = db.createObjectStore(KERNEL_META_STORE, { keyPath: "key" });
        store.createIndex("canonVersion", "canonVersion");
        store.createIndex("cacheNamespace", "cacheNamespace");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openCanonDb().then((db) =>
    new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = run(store);
      request.onerror = () => reject(request.error ?? new Error(`IndexedDB ${storeName} request failed`));
      request.onsuccess = () => resolve(request.result);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => {
        db.close();
        reject(transaction.error ?? new Error(`IndexedDB ${storeName} transaction failed`));
      };
    }),
  );
}

export function canonBundleKey(appVersion: string, strategyVariant: string) {
  return `${appVersion}::${strategyVariant}::all`;
}

export function canonMetaKey(appVersion: string) {
  return appVersion;
}

export async function readCanonBundle<T>(key: string): Promise<T | null> {
  const result = await withStore<T | undefined>(BUNDLES_STORE, "readonly", (store) => store.get(key));
  return result ?? null;
}

export async function writeCanonBundle<T>(key: string, value: T): Promise<void> {
  await withStore<IDBValidKey>(BUNDLES_STORE, "readwrite", (store) => store.put(value, key));
}

export async function readCanonMeta<T>(key: string): Promise<T | null> {
  const result = await withStore<T | undefined>(META_STORE, "readonly", (store) => store.get(key));
  return result ?? null;
}

export async function writeCanonMeta<T>(key: string, value: T): Promise<void> {
  await withStore<IDBValidKey>(META_STORE, "readwrite", (store) => store.put(value, key));
}

export async function hasCanonBundles(keys: string[]) {
  for (const key of keys) {
    const value = await readCanonBundle<unknown>(key);
    if (!value) return false;
  }
  return true;
}

export async function readCanonWeekShardRecord(key: string): Promise<CanonShardRecord | null> {
  const result = await withStore<CanonShardRecord | undefined>(
    WEEK_SHARDS_STORE,
    "readonly",
    (store) => store.get(key),
  );
  return result ?? null;
}

export async function writeCanonWeekShardRecord(record: CanonShardRecord): Promise<void> {
  await withStore<IDBValidKey>(WEEK_SHARDS_STORE, "readwrite", (store) => store.put(record));
}

export async function deleteCanonWeekShardRecord(key: string): Promise<void> {
  await withStore<undefined>(WEEK_SHARDS_STORE, "readwrite", (store) => store.delete(key));
}

export async function listCanonWeekShardRecords(options: {
  canonVersion: string;
  strategyVariant: string;
}): Promise<CanonShardRecord[]> {
  const result = await withStore<CanonShardRecord[]>(
    WEEK_SHARDS_STORE,
    "readonly",
    (store) =>
      store.index("canonVersion_strategyVariant").getAll([
        options.canonVersion,
        options.strategyVariant,
      ]),
  );
  return result ?? [];
}

export async function writeCanonInventoryRecord(record: CanonInventoryRecord): Promise<void> {
  await withStore<IDBValidKey>(INVENTORIES_STORE, "readwrite", (store) => store.put(record));
}

export async function readCanonInventoryRecord(key: string): Promise<CanonInventoryRecord | null> {
  const result = await withStore<CanonInventoryRecord | undefined>(
    INVENTORIES_STORE,
    "readonly",
    (store) => store.get(key),
  );
  return result ?? null;
}

export async function writeCanonKernelMeta(record: CanonKernelMetaRecord): Promise<void> {
  await withStore<IDBValidKey>(KERNEL_META_STORE, "readwrite", (store) => store.put(record));
}

export async function readCanonKernelMeta(key: string): Promise<CanonKernelMetaRecord | null> {
  const result = await withStore<CanonKernelMetaRecord | undefined>(
    KERNEL_META_STORE,
    "readonly",
    (store) => store.get(key),
  );
  return result ?? null;
}
