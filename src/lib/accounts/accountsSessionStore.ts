"use client";

import { useSyncExternalStore } from "react";
import type { AccountsPayload } from "@/lib/accounts/accountsPayload";

type AccountsStatus = "idle" | "loading" | "ready" | "error";

type AccountsSessionState = {
  payload: AccountsPayload | null;
  status: AccountsStatus;
  error: string | null;
  lastFetchedUtc: string | null;
};

const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

let state: AccountsSessionState = {
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

function setState(next: AccountsSessionState) {
  state = next;
  emit();
}

export function seedAccountsPayload(payload: AccountsPayload): void {
  if (state.payload?.fetchedAtUtc === payload.fetchedAtUtc) return;
  setState({
    payload,
    status: "ready",
    error: null,
    lastFetchedUtc: payload.fetchedAtUtc,
  });
}

export async function fetchAndSeedAccounts(): Promise<void> {
  if (inflight) return inflight;

  setState({
    ...state,
    status: state.payload ? "ready" : "loading",
    error: null,
  });

  inflight = (async () => {
    try {
      const response = await fetch("/api/accounts/payload", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Accounts request failed (${response.status})`);
      }
      const payload = (await response.json()) as AccountsPayload;
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

export function useAccountsSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
