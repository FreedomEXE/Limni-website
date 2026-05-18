"use client";

import { useSyncExternalStore } from "react";
import type { NewsPayload } from "@/lib/news/newsPayload";

type NewsStatus = "idle" | "loading" | "ready" | "error";

type NewsSessionState = {
  payload: NewsPayload | null;
  status: NewsStatus;
  error: string | null;
  lastFetchedUtc: string | null;
};

const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

let state: NewsSessionState = {
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

function setState(next: NewsSessionState) {
  state = next;
  emit();
}

export function seedNewsPayload(payload: NewsPayload): void {
  if (state.payload?.fetchedAtUtc === payload.fetchedAtUtc) return;
  setState({
    payload,
    status: "ready",
    error: null,
    lastFetchedUtc: payload.fetchedAtUtc,
  });
}

export async function fetchAndSeedNews(week?: string | null): Promise<void> {
  if (inflight) return inflight;

  setState({
    ...state,
    status: state.payload ? "ready" : "loading",
    error: null,
  });

  inflight = (async () => {
    try {
      const params = new URLSearchParams();
      if (week) params.set("week", week);
      const response = await fetch(`/api/news/payload${params.size ? `?${params}` : ""}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`News request failed (${response.status})`);
      }
      const payload = (await response.json()) as NewsPayload;
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

export function useNewsSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
