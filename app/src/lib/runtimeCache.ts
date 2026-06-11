type CacheValue<T> = {
  expiresAt: number;
  value: T;
};

type CachePending<T> = {
  promise: Promise<T>;
};

type CacheEntry<T> = CacheValue<T> | CachePending<T>;

const CACHE_SYMBOL = Symbol.for("limni.runtimeCache.store");

function getStore() {
  const scoped = globalThis as typeof globalThis & {
    [CACHE_SYMBOL]?: Map<string, CacheEntry<unknown>>;
  };
  if (!scoped[CACHE_SYMBOL]) {
    scoped[CACHE_SYMBOL] = new Map<string, CacheEntry<unknown>>();
  }
  return scoped[CACHE_SYMBOL]!;
}

export async function getOrSetRuntimeCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const store = getStore();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry) {
    if ("promise" in entry) {
      return entry.promise;
    }
    if (entry.expiresAt > now) {
      return entry.value;
    }
    store.delete(key);
  }

  const promise = loader()
    .then((value) => {
      store.set(key, {
        value,
        expiresAt: Date.now() + Math.max(ttlMs, 0),
      });
      return value;
    })
    .catch((error) => {
      store.delete(key);
      throw error;
    });

  store.set(key, { promise });
  return promise;
}

export function clearRuntimeCacheByPrefix(prefix: string) {
  const store = getStore();
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function clearRuntimeCacheKey(key: string) {
  getStore().delete(key);
}

export function clearRuntimeCacheAll() {
  getStore().clear();
}
