import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";

export type StrategyClientScope = "performance" | "matrix";

const payloadCache = new Map<string, StrategyClientPayload | null>();
const inflightCache = new Map<string, Promise<StrategyClientPayload | null>>();
const warmInflightCache = new Map<string, Promise<boolean>>();
const warmRequestedAt = new Map<string, number>();
const WARM_REQUEST_COOLDOWN_MS = 120000;

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
};

export type StrategyArtifactStatusPayload = {
  readyCount: number;
  totalCount: number;
  artifacts: StrategyArtifactStatusRow[];
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
  const cacheKey = buildSelectionKey(selection, "performance");
  const inflight = warmInflightCache.get(cacheKey);
  if (inflight) {
    return inflight;
  }
  const lastRequestedAt = warmRequestedAt.get(cacheKey) ?? 0;
  if (Date.now() - lastRequestedAt < WARM_REQUEST_COOLDOWN_MS) {
    return false;
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
      const data = (await response.json()) as { ok?: unknown };
      return data.ok === true;
    })
    .catch((error) => {
      console.error("[strategyClientCache] Failed to request strategy artifact warm:", error);
      return false;
    })
    .finally(() => {
      warmInflightCache.delete(cacheKey);
    });

  warmInflightCache.set(cacheKey, request);
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
