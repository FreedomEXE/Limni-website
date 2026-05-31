/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonIndexedDb.ts
 *
 * Description:
 * Small IndexedDB wrapper for versioned immutable canon bundles.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

const DB_NAME = "limni-canon";
const DB_VERSION = 1;
const BUNDLES_STORE = "bundles";
const META_STORE = "meta";

type StoreName = typeof BUNDLES_STORE | typeof META_STORE;

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
