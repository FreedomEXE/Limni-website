import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type {
  StrategyClientPayload,
  StrategyClientPayloadScope,
} from "@/lib/performance/strategyClientPayload";

const payloadCache = new Map<string, StrategyClientPayload | null>();
const inflightCache = new Map<string, Promise<StrategyClientPayload | null>>();
const currentWeekInflightCache = new Map<string, Promise<StrategyClientPayload | null>>();
const warmInflightCache = new Map<string, Promise<boolean>>();
const warmRequestedAt = new Map<string, number>();
const cachedSelectionEngineVersions = new Map<string, string>();
let bulkWarmInflight: Promise<StrategyBulkWarmPayload | null> | null = null;
let bulkWarmRequestedAt = 0;
const WARM_REQUEST_COOLDOWN_MS = 120000;
const BULK_WARM_REQUEST_COOLDOWN_MS = 30000;
const PERSISTENT_PAYLOAD_CACHE_NAME = "limni-strategy-payload-v3";
const PERSISTENT_PAYLOAD_META_PREFIX = "limni:strategy-payload:v3:";
const PERSISTENT_PAYLOAD_TTL_MS = 6 * 60 * 60 * 1000;

function buildSelectionKey(selection: RuntimeStrategySelection) {
  return `${selection.strategy}:${selection.f1}:${selection.f2}`;
}

function currentHourBucket() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export type StrategyArtifactStatusRow = {
  key: string;
  label: string;
  strategy: string;
  f1: string;
  f2: string;
  ready: boolean;
  expectedEngineVersion: string;
  actualEngineVersion?: string | null;
  reason: "ready" | "missing" | "stale" | "stale_week" | "stale_options" | "stale_fingerprint";
  shardProgress?: {
    ready: number;
    total: number;
  } | null;
  missingWeeks?: string[];
  staleWeeks?: string[];
};

export type StrategyArtifactStatusPayload = {
  readyCount: number;
  totalCount: number;
  artifacts: StrategyArtifactStatusRow[];
};

export type StrategyBulkWarmPayload = {
  ok: boolean;
  timedOut: boolean;
  durationMs: number;
  before: {
    ready: number;
    total: number;
  };
  after: {
    ready: number;
    total: number;
  };
  warmed: Array<{
    key: string;
    label: string;
    ok: boolean;
    reason: string;
    durationMs: number;
    error?: string;
  }>;
  failed: Array<{
    key: string;
    label: string;
    ok: boolean;
    reason: string;
    durationMs: number;
    error?: string;
  }>;
};

export type StrategyArtifactWarmPayload = {
  ok: boolean;
  selectionKey: string;
  status: string;
  before: StrategyArtifactStatusRow;
  after: StrategyArtifactStatusRow;
  durationMs: number;
};

export function getStrategyClientPayload(
  selection: RuntimeStrategySelection,
  scope: StrategyClientPayloadScope = "performance",
): StrategyClientPayload | null | undefined {
  const payload = payloadCache.get(buildSelectionKey(selection));
  if (payload === undefined || payload === null) return payload;
  return hasScopePayload(payload, scope) ? payload : undefined;
}

export function setStrategyClientPayload(
  selection: RuntimeStrategySelection,
  payload: StrategyClientPayload | null,
) {
  const cacheKey = buildSelectionKey(selection);
  if (payload === null) {
    payloadCache.set(cacheKey, null);
    return;
  }
  payloadCache.set(cacheKey, mergeStrategyClientPayload(payloadCache.get(cacheKey) ?? null, payload));
}

function hasScopePayload(payload: StrategyClientPayload, scope: StrategyClientPayloadScope) {
  if (scope === "matrix") {
    return Boolean(payload.engineWeekResults);
  }
  if (scope === "full") {
    return Boolean(
      (payload.engineWeekMap || payload.engineSimMap) &&
      payload.engineWeekResults
    );
  }
  return Boolean(payload.engineWeekMap || payload.engineSimMap || payload.sidebarStats);
}

function mergeStrategyClientPayload(
  previous: StrategyClientPayload | null,
  next: StrategyClientPayload,
): StrategyClientPayload {
  if (!previous) return next;
  return {
    engineWeekMap: mergeRecordPayload(previous.engineWeekMap, next.engineWeekMap),
    engineSimMap: mergeRecordPayload(previous.engineSimMap, next.engineSimMap),
    engineWeekResults: mergeRecordPayload(previous.engineWeekResults, next.engineWeekResults),
    sidebarStats: next.sidebarStats ?? previous.sidebarStats,
    weekOptions: mergeWeekOptions(previous.weekOptions, next.weekOptions),
    currentWeekOpenUtc: next.currentWeekOpenUtc ?? previous.currentWeekOpenUtc,
    artifactMeta: next.artifactMeta ?? previous.artifactMeta,
  };
}

function mergeRecordPayload<T>(
  previous: Record<string, T> | null | undefined,
  next: Record<string, T> | null | undefined,
) {
  if (!next) return previous ?? null;
  if (!previous) return next;
  return { ...previous, ...next };
}

function mergeWeekOptions(
  previous: string[] | undefined,
  next: string[] | undefined,
) {
  if (!next) return previous;
  if (!previous) return next;
  return Array.from(new Set([...next, ...previous]));
}

function isStrategyClientPayload(value: unknown): value is StrategyClientPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    "engineWeekMap" in record &&
    "engineSimMap" in record &&
    "engineWeekResults" in record &&
    "sidebarStats" in record
  );
}

function canUsePersistentPayloadCache() {
  return (
    typeof window !== "undefined" &&
    "caches" in window &&
    typeof window.localStorage !== "undefined"
  );
}

function toPersistentPayloadUrl(url: string) {
  return new URL(url, window.location.origin).toString();
}

function persistentPayloadMetaKey(url: string) {
  return `${PERSISTENT_PAYLOAD_META_PREFIX}${url}`;
}

type PersistentPayloadMeta = {
  storedAt: number | null;
  engineVersion: string | null;
};

function readPersistentPayloadMeta(url: string): PersistentPayloadMeta | null {
  try {
    const raw = window.localStorage.getItem(persistentPayloadMetaKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { storedAt?: unknown; engineVersion?: unknown };
    return {
      storedAt: typeof parsed.storedAt === "number" ? parsed.storedAt : null,
      engineVersion: typeof parsed.engineVersion === "string" ? parsed.engineVersion : null,
    };
  } catch {
    return null;
  }
}

async function deletePersistentPayload(url: string) {
  if (!canUsePersistentPayloadCache()) return;
  try {
    window.localStorage.removeItem(persistentPayloadMetaKey(url));
    const cache = await window.caches.open(PERSISTENT_PAYLOAD_CACHE_NAME);
    await cache.delete(url);
  } catch {
    // Browser cache storage is an opportunistic fast path.
  }
}

async function readPersistentPayload(
  url: string,
  selection: RuntimeStrategySelection,
  scope: StrategyClientPayloadScope,
): Promise<StrategyClientPayload | null> {
  if (!canUsePersistentPayloadCache()) return null;

  const absoluteUrl = toPersistentPayloadUrl(url);
  const storedMeta = readPersistentPayloadMeta(absoluteUrl);
  const storedAt = storedMeta?.storedAt ?? null;
  if (!storedAt || Date.now() - storedAt > PERSISTENT_PAYLOAD_TTL_MS) {
    await deletePersistentPayload(absoluteUrl);
    return null;
  }

  const selectionKey = buildSelectionKey(selection);
  const expectedEngineVersion = await ensureSelectionEngineVersion(selection);
  if (
    storedMeta?.engineVersion &&
    expectedEngineVersion &&
    storedMeta.engineVersion !== expectedEngineVersion
  ) {
    await deletePersistentPayload(absoluteUrl);
    return null;
  }

  try {
    const cache = await window.caches.open(PERSISTENT_PAYLOAD_CACHE_NAME);
    const cachedResponse = await cache.match(absoluteUrl);
    if (!cachedResponse) return null;
    const data = (await cachedResponse.clone().json()) as unknown;
    if (!isStrategyClientPayload(data) || !hasScopePayload(data, scope)) {
      await deletePersistentPayload(absoluteUrl);
      return null;
    }

    payloadCache.set(selectionKey, mergeStrategyClientPayload(payloadCache.get(selectionKey) ?? null, data));
    return payloadCache.get(selectionKey) ?? data;
  } catch {
    await deletePersistentPayload(absoluteUrl);
    return null;
  }
}

async function writePersistentPayload(url: string, data: StrategyClientPayload) {
  if (
    !canUsePersistentPayloadCache() ||
    data.artifactMeta?.cachedAtUtc === null ||
    data.artifactMeta?.stale === true
  ) {
    return;
  }

  const absoluteUrl = toPersistentPayloadUrl(url);
  try {
    const cache = await window.caches.open(PERSISTENT_PAYLOAD_CACHE_NAME);
    await cache.put(
      absoluteUrl,
      new Response(JSON.stringify(data), {
        headers: { "content-type": "application/json" },
      }),
    );
    window.localStorage.setItem(
      persistentPayloadMetaKey(absoluteUrl),
      JSON.stringify({
        storedAt: Date.now(),
        engineVersion: data.artifactMeta?.engineVersion ?? null,
      }),
    );
  } catch {
    // Ignore quota/private-mode failures; the in-memory cache still works.
  }
}

export async function fetchStrategyClientPayload(
  selection: RuntimeStrategySelection,
  scope: StrategyClientPayloadScope = "performance",
  options: { force?: boolean } = {},
): Promise<StrategyClientPayload | null> {
  const cacheKey = buildSelectionKey(selection);
  const cached = payloadCache.get(cacheKey);
  if (!options.force && cached !== undefined && cached !== null && hasScopePayload(cached, scope)) {
    return cached;
  }
  if (!options.force && cached === null) {
    return null;
  }
  const inflightKey = `${cacheKey}:${scope}${options.force ? ":force" : ""}`;
  const inflight = inflightCache.get(inflightKey);
  if (inflight) {
    return inflight;
  }

  const url =
    `/api/performance/strategy-page-data?strategy=${encodeURIComponent(selection.strategy)}` +
    `&f1=${encodeURIComponent(selection.f1)}` +
    `&f2=${encodeURIComponent(selection.f2)}` +
    `&scope=${scope}` +
    `${options.force ? "&repair=1" : ""}`;
  const persistentPayload = options.force
    ? null
    : await readPersistentPayload(url, selection, scope);
  if (!options.force && persistentPayload) {
    return persistentPayload;
  }

  const request = (async () => {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: "GET",
          cache: options.force ? "no-store" : "default",
        });
        if (!response.ok) {
          throw new Error(`Strategy payload request failed (${response.status})`);
        }
        const data = (await response.json()) as unknown;
        if (
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
        ) {
          const errorData = data as { error: string };
          throw new Error(errorData.error);
        }
        if (!isStrategyClientPayload(data)) {
          throw new Error("Unexpected strategy payload shape");
        }
        if (data.artifactMeta?.cachedAtUtc !== null) {
          payloadCache.set(cacheKey, mergeStrategyClientPayload(payloadCache.get(cacheKey) ?? null, data));
          await writePersistentPayload(url, data);
        }
        return payloadCache.get(cacheKey) ?? data;
      } catch (error) {
        if (attempt === maxAttempts) {
          console.error("[strategyClientCache] Failed to fetch strategy payload:", error);
          return null;
        }
        await wait(750 * attempt);
      }
    }

    return null;
  })()
    .finally(() => {
      inflightCache.delete(inflightKey);
    });

  inflightCache.set(inflightKey, request);
  return request;
}

export async function fetchCurrentWeekStrategyClientPayload(
  selection: RuntimeStrategySelection,
  scope: StrategyClientPayloadScope = "performance",
  options: { force?: boolean } = {},
): Promise<StrategyClientPayload | null> {
  const cacheKey = buildSelectionKey(selection);
  const hourBucket = currentHourBucket();
  const url =
    `/api/performance/strategy-current-week?strategy=${encodeURIComponent(selection.strategy)}` +
    `&f1=${encodeURIComponent(selection.f1)}` +
    `&f2=${encodeURIComponent(selection.f2)}` +
    `&scope=${scope}` +
    `&hour=${encodeURIComponent(hourBucket)}`;
  const inflightKey = `${cacheKey}:${scope}:${hourBucket}${options.force ? ":force" : ""}`;
  const inflight = currentWeekInflightCache.get(inflightKey);
  if (inflight && !options.force) {
    return inflight;
  }

  const request = (async () => {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, { method: "GET", cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Current week strategy payload request failed (${response.status})`);
        }
        const data = (await response.json()) as unknown;
        if (!isStrategyClientPayload(data)) {
          throw new Error("Unexpected current week strategy payload shape");
        }
        payloadCache.set(cacheKey, mergeStrategyClientPayload(payloadCache.get(cacheKey) ?? null, data));
        return payloadCache.get(cacheKey) ?? data;
      } catch (error) {
        if (attempt === maxAttempts) {
          console.error("[strategyClientCache] Failed to fetch current week strategy payload:", error);
          return null;
        }
        await wait(1000 * attempt);
      }
    }
    return null;
  })()
    .finally(() => {
      currentWeekInflightCache.delete(inflightKey);
    });

  currentWeekInflightCache.set(inflightKey, request);
  return request;
}

export async function requestStrategyArtifactWarm(
  selection: RuntimeStrategySelection,
): Promise<boolean> {
  const result = await requestStrategyArtifactWarmPayload(selection);
  return result?.ok === true;
}

export async function requestStrategyArtifactWarmPayload(
  selection: RuntimeStrategySelection,
): Promise<StrategyArtifactWarmPayload | null> {
  const cacheKey = buildSelectionKey(selection);
  const inflight = warmInflightCache.get(cacheKey);
  if (inflight) {
    return inflight.then((ok) => ({
      ok,
      selectionKey: `${selection.strategy}:${selection.f1}:${selection.f2}`,
      status: ok ? "ready" : "cooldown_or_failed",
      before: {
        key: `${selection.strategy}:${selection.f1}:${selection.f2}`,
        label: `${selection.strategy} · ${selection.f1} · ${selection.f2}`,
        strategy: selection.strategy,
        f1: selection.f1,
        f2: selection.f2,
        ready: ok,
        expectedEngineVersion: cachedSelectionEngineVersions.get(cacheKey) ?? "",
        reason: ok ? "ready" : "missing",
      },
      after: {
        key: `${selection.strategy}:${selection.f1}:${selection.f2}`,
        label: `${selection.strategy} · ${selection.f1} · ${selection.f2}`,
        strategy: selection.strategy,
        f1: selection.f1,
        f2: selection.f2,
        ready: ok,
        expectedEngineVersion: cachedSelectionEngineVersions.get(cacheKey) ?? "",
        reason: ok ? "ready" : "missing",
      },
      durationMs: 0,
    }));
  }
  const lastRequestedAt = warmRequestedAt.get(cacheKey) ?? 0;
  if (Date.now() - lastRequestedAt < WARM_REQUEST_COOLDOWN_MS) {
    return null;
  }
  warmRequestedAt.set(cacheKey, Date.now());

  const request = fetch("/api/performance/strategy-artifacts/request-warm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      strategy: selection.strategy,
      f1: selection.f1,
      f2: selection.f2,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Strategy artifact warm request failed (${response.status})`);
      }
      return (await response.json()) as StrategyArtifactWarmPayload;
    })
    .catch((error) => {
      console.error("[strategyClientCache] Failed to request strategy artifact warm:", error);
      return null;
    })
    .finally(() => {
      warmInflightCache.delete(cacheKey);
    });

  warmInflightCache.set(cacheKey, request.then((payload) => payload?.ok === true));
  return request;
}

export async function requestVisibleStrategyArtifactsWarm(): Promise<StrategyBulkWarmPayload | null> {
  if (bulkWarmInflight) {
    return bulkWarmInflight;
  }
  if (Date.now() - bulkWarmRequestedAt < BULK_WARM_REQUEST_COOLDOWN_MS) {
    return null;
  }
  bulkWarmRequestedAt = Date.now();

  const request = fetch("/api/performance/strategy-artifacts/request-bulk-warm", {
    method: "POST",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Strategy artifact bulk warm request failed (${response.status})`);
      }
      return (await response.json()) as StrategyBulkWarmPayload;
    })
    .catch((error) => {
      console.error("[strategyClientCache] Failed to request visible strategy artifact warm:", error);
      return null;
    })
    .finally(() => {
      bulkWarmInflight = null;
    });

  bulkWarmInflight = request;
  return request;
}

export async function prefetchVisibleStrategyPayloads(options: {
  currentSelection?: RuntimeStrategySelection;
  concurrency?: number;
  delayMs?: number;
  scope?: StrategyClientPayloadScope;
  shouldContinue?: () => boolean;
} = {}): Promise<void> {
  const {
    currentSelection,
    concurrency = 1,
    delayMs = 1500,
    scope = "performance",
    shouldContinue = () => true,
  } = options;
  const status = await fetchStrategyArtifactStatus();
  if (!status || !shouldContinue()) return;

  const currentKey = currentSelection ? buildSelectionKey(currentSelection) : null;
  const selections = (status.artifacts ?? [])
    .filter((artifact) => artifact.key !== currentKey)
    .map((artifact) => ({
      strategy: artifact.strategy,
      f1: artifact.f1,
      f2: artifact.f2,
    }));

  const prefetchSelections = async () => {
    let nextIndex = 0;
    const requestedConcurrency =
      Number.isFinite(concurrency) && concurrency > 0
        ? Math.floor(concurrency)
        : 3;
    const workerCount = Math.max(1, Math.min(requestedConcurrency, Math.max(selections.length, 1)));
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (shouldContinue()) {
          const selection = selections[nextIndex];
          nextIndex += 1;
          if (!selection) return;
          await fetchStrategyClientPayload(selection, scope);
          if (delayMs > 0 && shouldContinue()) {
            await wait(delayMs);
          }
        }
      }),
    );
  };

  await prefetchSelections();
}

export async function fetchStrategyArtifactStatus(
  key?: string,
  options: { timeoutMs?: number } = {},
): Promise<StrategyArtifactStatusPayload | null> {
  const query = key ? `?key=${encodeURIComponent(key)}` : "";
  const controller = typeof AbortController !== "undefined" && options.timeoutMs
    ? new AbortController()
    : null;
  const timeout = controller && options.timeoutMs
    ? window.setTimeout(() => controller.abort(), options.timeoutMs)
    : null;
  return fetch(`/api/performance/strategy-artifacts/status${query}`, {
    method: "GET",
    signal: controller?.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Strategy artifact status request failed (${response.status})`);
      }
      const status = (await response.json()) as StrategyArtifactStatusPayload;
      for (const artifact of status.artifacts ?? []) {
        cachedSelectionEngineVersions.set(artifact.key, artifact.expectedEngineVersion);
      }
      return status;
    })
    .catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("[strategyClientCache] Failed to fetch strategy artifact status:", error);
      }
      return null;
    })
    .finally(() => {
      if (timeout) window.clearTimeout(timeout);
    });
}

async function ensureSelectionEngineVersion(selection: RuntimeStrategySelection) {
  const key = buildSelectionKey(selection);
  const cached = cachedSelectionEngineVersions.get(key);
  if (cached) return cached;
  const status = await fetchStrategyArtifactStatus(key);
  return status?.artifacts?.[0]?.expectedEngineVersion ?? null;
}
