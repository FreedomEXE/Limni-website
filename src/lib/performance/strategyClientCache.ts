import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";

export type StrategyClientScope = "performance" | "matrix";

const payloadCache = new Map<string, StrategyClientPayload | null>();
const inflightCache = new Map<string, Promise<StrategyClientPayload | null>>();
const warmInflightCache = new Map<string, Promise<boolean>>();
const warmRequestedAt = new Map<string, number>();
let bulkWarmInflight: Promise<StrategyBulkWarmPayload | null> | null = null;
let bulkWarmRequestedAt = 0;
const WARM_REQUEST_COOLDOWN_MS = 120000;
const BULK_WARM_REQUEST_COOLDOWN_MS = 30000;

function buildSelectionKey(selection: RuntimeStrategySelection, scope: StrategyClientScope) {
  return `${scope}:${selection.strategy}:${selection.f1}:${selection.f2}`;
}

export type StrategyArtifactStatusRow = {
  key: string;
  label: string;
  strategy: string;
  f1: string;
  f2: string;
  ready: boolean;
  reason: "ready" | "missing" | "stale";
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
  scope: StrategyClientScope = "performance",
): StrategyClientPayload | null | undefined {
  return payloadCache.get(buildSelectionKey(selection, scope));
}

export function setStrategyClientPayload(
  selection: RuntimeStrategySelection,
  payload: StrategyClientPayload | null,
  scope: StrategyClientScope = "performance",
) {
  payloadCache.set(buildSelectionKey(selection, scope), payload);
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
  scope: StrategyClientScope = "performance",
): Promise<StrategyClientPayload | null> {
  const cacheKey = buildSelectionKey(selection, scope);
  if (payloadCache.has(cacheKey)) {
    return payloadCache.get(cacheKey) ?? null;
  }
  const inflight = inflightCache.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = fetch(
    `/api/performance/strategy-page-data?strategy=${encodeURIComponent(selection.strategy)}&f1=${encodeURIComponent(selection.f1)}&f2=${encodeURIComponent(selection.f2)}&scope=${scope}`,
    { method: "GET" },
  )
    .then(async (response) => {
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
        payloadCache.set(cacheKey, data);
      }
      return data;
    })
    .catch((error) => {
      console.error("[strategyClientCache] Failed to fetch strategy payload:", error);
      return null;
    })
    .finally(() => {
      inflightCache.delete(cacheKey);
    });

  inflightCache.set(cacheKey, request);
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
  const cacheKey = buildSelectionKey(selection, "performance");
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
