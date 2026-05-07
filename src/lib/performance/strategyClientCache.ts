import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";

export type StrategyClientScope = "performance" | "matrix";

const payloadCache = new Map<string, StrategyClientPayload | null>();
const inflightCache = new Map<string, Promise<StrategyClientPayload | null>>();

function buildSelectionKey(selection: RuntimeStrategySelection, scope: StrategyClientScope) {
  return `${scope}:${selection.strategy}:${selection.f1}:${selection.f2}`;
}

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
      payloadCache.set(cacheKey, null);
      return null;
    })
    .finally(() => {
      inflightCache.delete(cacheKey);
    });

  inflightCache.set(cacheKey, request);
  return request;
}
