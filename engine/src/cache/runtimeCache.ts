type CacheValue<T> = {
  expiresAt: number;
  value: T;
};

type CachePending<T> = {
  promise: Promise<T>;
};

type CacheEntry<T> = CacheValue<T> | CachePending<T>;

const CACHE_SYMBOL = Symbol.for("limni.runtimeCache.store");
const STATS_SYMBOL = Symbol.for("limni.runtimeCache.stats");

type RuntimeCacheNamespaceStats = {
  gets: number;
  hits: number;
  misses: number;
  pendingHits: number;
  sets: number;
  deletes: number;
};

export type RuntimeCacheStats = {
  gets: number;
  hits: number;
  misses: number;
  pendingHits: number;
  sets: number;
  loadErrors: number;
  deletes: number;
  clearByPrefixCalls: number;
  clearKeyCalls: number;
  clearAllCalls: number;
  entriesCleared: number;
  entries: number;
  namespaces: Record<string, RuntimeCacheNamespaceStats>;
};

function getStore() {
  const scoped = globalThis as typeof globalThis & {
    [CACHE_SYMBOL]?: Map<string, CacheEntry<unknown>>;
  };
  if (!scoped[CACHE_SYMBOL]) {
    scoped[CACHE_SYMBOL] = new Map<string, CacheEntry<unknown>>();
  }
  return scoped[CACHE_SYMBOL]!;
}

function emptyNamespaceStats(): RuntimeCacheNamespaceStats {
  return {
    gets: 0,
    hits: 0,
    misses: 0,
    pendingHits: 0,
    sets: 0,
    deletes: 0,
  };
}

function emptyStats(): RuntimeCacheStats {
  return {
    gets: 0,
    hits: 0,
    misses: 0,
    pendingHits: 0,
    sets: 0,
    loadErrors: 0,
    deletes: 0,
    clearByPrefixCalls: 0,
    clearKeyCalls: 0,
    clearAllCalls: 0,
    entriesCleared: 0,
    entries: 0,
    namespaces: {},
  };
}

function getStatsRef() {
  const scoped = globalThis as typeof globalThis & {
    [STATS_SYMBOL]?: RuntimeCacheStats;
  };
  if (!scoped[STATS_SYMBOL]) {
    scoped[STATS_SYMBOL] = emptyStats();
  }
  return scoped[STATS_SYMBOL]!;
}

function cacheNamespace(key: string) {
  return key.split(":")[0] || "unknown";
}

function getNamespaceStats(key: string) {
  const stats = getStatsRef();
  const namespace = cacheNamespace(key);
  stats.namespaces[namespace] ??= emptyNamespaceStats();
  return stats.namespaces[namespace]!;
}

function cloneStats(stats: RuntimeCacheStats): RuntimeCacheStats {
  return {
    ...stats,
    namespaces: Object.fromEntries(
      Object.entries(stats.namespaces).map(([namespace, values]) => [
        namespace,
        { ...values },
      ]),
    ),
  };
}

export function resetRuntimeCacheStats() {
  const stats = getStatsRef();
  const next = emptyStats();
  Object.assign(stats, next);
}

export function getRuntimeCacheStats(): RuntimeCacheStats {
  const stats = getStatsRef();
  return cloneStats({
    ...stats,
    entries: getStore().size,
  });
}

export async function getOrSetRuntimeCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const store = getStore();
  const entry = store.get(key) as CacheEntry<T> | undefined;
  const stats = getStatsRef();
  const namespaceStats = getNamespaceStats(key);
  stats.gets += 1;
  namespaceStats.gets += 1;

  if (entry) {
    if ("promise" in entry) {
      stats.pendingHits += 1;
      namespaceStats.pendingHits += 1;
      return entry.promise;
    }
    if (entry.expiresAt > now) {
      stats.hits += 1;
      namespaceStats.hits += 1;
      return entry.value;
    }
    store.delete(key);
    stats.deletes += 1;
    namespaceStats.deletes += 1;
  }

  stats.misses += 1;
  namespaceStats.misses += 1;
  const promise = loader()
    .then((value) => {
      store.set(key, {
        value,
        expiresAt: Date.now() + Math.max(ttlMs, 0),
      });
      stats.sets += 1;
      namespaceStats.sets += 1;
      return value;
    })
    .catch((error) => {
      store.delete(key);
      stats.loadErrors += 1;
      stats.deletes += 1;
      namespaceStats.deletes += 1;
      throw error;
    });

  store.set(key, { promise });
  return promise;
}

export function clearRuntimeCacheByPrefix(prefix: string) {
  const store = getStore();
  const stats = getStatsRef();
  stats.clearByPrefixCalls += 1;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      stats.deletes += 1;
      stats.entriesCleared += 1;
      getNamespaceStats(key).deletes += 1;
    }
  }
}

export function clearRuntimeCacheKey(key: string) {
  const deleted = getStore().delete(key);
  const stats = getStatsRef();
  stats.clearKeyCalls += 1;
  if (deleted) {
    stats.deletes += 1;
    stats.entriesCleared += 1;
    getNamespaceStats(key).deletes += 1;
  }
}

export function clearRuntimeCacheAll() {
  const store = getStore();
  const stats = getStatsRef();
  stats.clearAllCalls += 1;
  stats.entriesCleared += store.size;
  stats.deletes += store.size;
  for (const key of store.keys()) {
    getNamespaceStats(key).deletes += 1;
  }
  store.clear();
}
