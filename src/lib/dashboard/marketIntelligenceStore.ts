"use client";

import { useSyncExternalStore } from "react";
import type { MarketIntelligencePayload } from "@/lib/dashboard/marketIntelligencePayload";

type MarketIntelligenceStatus = "idle" | "loading" | "ready" | "error";

type MarketIntelligenceState = {
  payload: MarketIntelligencePayload | null;
  status: MarketIntelligenceStatus;
  error: string | null;
  lastFetchedUtc: string | null;
};

const listeners = new Set<() => void>();
const inflightByKey = new Map<string, Promise<void>>();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

let state: MarketIntelligenceState = {
  payload: null,
  status: "idle",
  error: null,
  lastFetchedUtc: null,
};

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function setState(next: MarketIntelligenceState) {
  state = next;
  emit();
}

function normalizeAsset(asset?: string | null) {
  return asset && asset.length > 0 ? asset : "all";
}

type FetchMarketIntelligenceOptions = {
  includeAllReports?: boolean;
};

function mergePayload(
  current: MarketIntelligencePayload | null,
  incoming: MarketIntelligencePayload,
): MarketIntelligencePayload {
  if (!current || current.selectedAsset !== incoming.selectedAsset) {
    return incoming;
  }

  return {
    ...incoming,
    cotDataByReport: {
      ...current.cotDataByReport,
      ...incoming.cotDataByReport,
    },
    sentimentDataByReport: {
      ...current.sentimentDataByReport,
      ...incoming.sentimentDataByReport,
    },
    strengthDataByReport: {
      ...current.strengthDataByReport,
      ...incoming.strengthDataByReport,
    },
    provenanceByReport: {
      ...current.provenanceByReport,
      ...incoming.provenanceByReport,
    },
  };
}

export function seedMarketIntelligence(payload: MarketIntelligencePayload): void {
  const mergedPayload = mergePayload(state.payload, payload);
  setState({
    payload: mergedPayload,
    status: "ready",
    error: null,
    lastFetchedUtc: mergedPayload.fetchedAtUtc,
  });
}

export async function fetchAndSeedMarketIntelligence(
  asset?: string | null,
  report?: string | null,
  options: FetchMarketIntelligenceOptions = {},
): Promise<void> {
  const requestedAsset = normalizeAsset(asset ?? state.payload?.selectedAsset);
  const requestKey = `${requestedAsset}:${options.includeAllReports ? "all-reports" : report ?? "default"}`;
  const existingInflight = inflightByKey.get(requestKey);
  if (existingInflight) return existingInflight;

  setState({
    ...state,
    status: state.payload ? "ready" : "loading",
    error: null,
  });

  const request = (async () => {
    try {
      const params = new URLSearchParams({ asset: requestedAsset });
      if (report) params.set("report", report);
      if (options.includeAllReports) params.set("allReports", "1");
      const response = await fetch(
        `/api/dashboard/payload?${params.toString()}`,
        { method: "GET", cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(`Market intelligence request failed (${response.status})`);
      }
      const payload = (await response.json()) as MarketIntelligencePayload;
      const mergedPayload = mergePayload(state.payload, payload);
      setState({
        payload: mergedPayload,
        status: "ready",
        error: null,
        lastFetchedUtc: mergedPayload.fetchedAtUtc,
      });
    } catch (error) {
      setState({
        ...state,
        status: state.payload ? "ready" : "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })().finally(() => {
    inflightByKey.delete(requestKey);
  });

  inflightByKey.set(requestKey, request);
  return request;
}

export function scheduleMarketIntelligenceRefresh(asset?: string | null, report?: string | null): void {
  clearMarketIntelligenceRefresh();

  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(5, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCHours(next.getUTCHours() + 1);
  }

  refreshTimer = setTimeout(() => {
    void fetchAndSeedMarketIntelligence(asset, report);
    refreshInterval = setInterval(() => {
      void fetchAndSeedMarketIntelligence(asset, report);
    }, 3_600_000);
  }, Math.max(next.getTime() - now.getTime(), 1000));
}

export function clearMarketIntelligenceRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

export function useMarketIntelligence() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
