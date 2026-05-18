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
let inflight: Promise<void> | null = null;
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

export function seedMarketIntelligence(payload: MarketIntelligencePayload): void {
  if (state.payload && state.payload.selectedAsset === payload.selectedAsset) return;
  setState({
    payload,
    status: "ready",
    error: null,
    lastFetchedUtc: payload.fetchedAtUtc,
  });
}

export async function fetchAndSeedMarketIntelligence(asset?: string | null): Promise<void> {
  const requestedAsset = normalizeAsset(asset ?? state.payload?.selectedAsset);
  if (
    inflight &&
    state.status === "loading" &&
    normalizeAsset(state.payload?.selectedAsset) === requestedAsset
  ) {
    return inflight;
  }

  setState({
    ...state,
    status: state.payload ? "ready" : "loading",
    error: null,
  });

  inflight = (async () => {
    try {
      const response = await fetch(
        `/api/dashboard/payload?asset=${encodeURIComponent(requestedAsset)}`,
        { method: "GET", cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(`Market intelligence request failed (${response.status})`);
      }
      const payload = (await response.json()) as MarketIntelligencePayload;
      setState({
        payload,
        status: "ready",
        error: null,
        lastFetchedUtc: payload.fetchedAtUtc,
      });
    } catch (error) {
      setState({
        ...state,
        status: state.payload ? "ready" : "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function scheduleMarketIntelligenceRefresh(asset?: string | null): void {
  clearMarketIntelligenceRefresh();

  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(5, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setUTCHours(next.getUTCHours() + 1);
  }

  refreshTimer = setTimeout(() => {
    void fetchAndSeedMarketIntelligence(asset);
    refreshInterval = setInterval(() => {
      void fetchAndSeedMarketIntelligence(asset);
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
