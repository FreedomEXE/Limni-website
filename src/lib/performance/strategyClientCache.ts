import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type {
  StrategyClientPayload,
  StrategyClientPayloadScope,
} from "@/lib/performance/strategyClientPayload";

const payloadCache = new Map<string, StrategyClientPayload | null>();
const inflightCache = new Map<string, Promise<StrategyClientPayload | null>>();
const warmInflightCache = new Map<string, Promise<boolean>>();
const warmRequestedAt = new Map<string, number>();
let bulkWarmInflight: Promise<StrategyBulkWarmPayload | null> | null = null;
let bulkWarmRequestedAt = 0;
const WARM_REQUEST_COOLDOWN_MS = 120000;
const BULK_WARM_REQUEST_COOLDOWN_MS = 30000;

function buildSelectionKey(selection: RuntimeStrategySelection) {
  return `${selection.strategy}:${selection.f1}:${selection.f2}`;
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
  reason: "ready" | "missing" | "stale" | "stale_week" | "stale_options" | "stale_fingerprint";
  shardProgress?: {
    ready: number;
    total: number;
  } | null;
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
  if (payload?.artifactMeta?.stale === true) {
    payloadCache.delete(cacheKey);
    return;
  }
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
    engineWeekMap: next.engineWeekMap ?? previous.engineWeekMap,
    engineSimMap: next.engineSimMap ?? previous.engineSimMap,
    engineWeekResults: next.engineWeekResults ?? previous.engineWeekResults,
    sidebarStats: next.sidebarStats ?? previous.sidebarStats,
    weekOptions: next.weekOptions ?? previous.weekOptions,
    currentWeekOpenUtc: next.currentWeekOpenUtc ?? previous.currentWeekOpenUtc,
    artifactMeta: next.artifactMeta ?? previous.artifactMeta,
  };
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

export async function fetchStrategyClientPayload(
  selection: RuntimeStrategySelection,
  scope: StrategyClientPayloadScope = "performance",
): Promise<StrategyClientPayload | null> {
  const cacheKey = buildSelectionKey(selection);
  const cached = payloadCache.get(cacheKey);
  if (cached !== undefined && cached !== null && hasScopePayload(cached, scope)) {
    return cached;
  }
  if (cached === null) {
    return null;
  }
  const inflightKey = `${cacheKey}:${scope}`;
  const inflight = inflightCache.get(inflightKey);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const url =
      `/api/performance/strategy-page-data?strategy=${encodeURIComponent(selection.strategy)}` +
      `&f1=${encodeURIComponent(selection.f1)}` +
      `&f2=${encodeURIComponent(selection.f2)}` +
      `&scope=${scope}`;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, { method: "GET" });
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
        if (data.artifactMeta?.cachedAtUtc !== null && data.artifactMeta?.stale !== true) {
          payloadCache.set(cacheKey, mergeStrategyClientPayload(payloadCache.get(cacheKey) ?? null, data));
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
        reason: ok ? "ready" : "missing",
      },
      after: {
        key: `${selection.strategy}:${selection.f1}:${selection.f2}`,
        label: `${selection.strategy} · ${selection.f1} · ${selection.f2}`,
        strategy: selection.strategy,
        f1: selection.f1,
        f2: selection.f2,
        ready: ok,
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
): Promise<StrategyArtifactStatusPayload | null> {
  const query = key ? `?key=${encodeURIComponent(key)}` : "";
  return fetch(`/api/performance/strategy-artifacts/status${query}`, { method: "GET" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Strategy artifact status request failed (${response.status})`);
      }
      return (await response.json()) as StrategyArtifactStatusPayload;
    })
    .catch((error) => {
      console.error("[strategyClientCache] Failed to fetch strategy artifact status:", error);
      return null;
    });
}
