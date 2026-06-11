/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: viewModeStore.ts
 *
 * Description:
 * External store for per-surface view-mode preferences. Hydrates from
 * localStorage after mount so SSR and first client render stay aligned.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  SURFACE_DEFAULTS,
  type ViewMode,
  type ViewSurface,
} from "./viewModeTypes";

type ViewModeMap = Record<ViewSurface, ViewMode>;

const STORAGE_KEY = "limni-viewmode";

const DEFAULT_STATE: ViewModeMap = {
  performance: { ...SURFACE_DEFAULTS.performance },
  matrix: { ...SURFACE_DEFAULTS.matrix },
  data: { ...SURFACE_DEFAULTS.data },
  research: { ...SURFACE_DEFAULTS.research },
};

let state: ViewModeMap = { ...DEFAULT_STATE };
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function mergeWithDefaults(parsed: Partial<ViewModeMap>): ViewModeMap {
  return {
    performance: { ...SURFACE_DEFAULTS.performance, ...parsed.performance },
    matrix: { ...SURFACE_DEFAULTS.matrix, ...parsed.matrix },
    data: { ...SURFACE_DEFAULTS.data, ...parsed.data },
    research: { ...SURFACE_DEFAULTS.research, ...parsed.research },
  };
}

function hydrateFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ViewModeMap>;
    state = mergeWithDefaults(parsed);
  } catch {
    state = { ...DEFAULT_STATE };
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Preference persistence is best-effort; UI state still updates in memory.
  }
}

function ensureHydrated() {
  if (hydrated) return;
  hydrateFromStorage();
  hydrated = true;
  emit();
}

export function getViewMode(surface: ViewSurface): ViewMode {
  return state[surface];
}

export function setViewMode(surface: ViewSurface, next: ViewMode): void {
  ensureHydrated();
  state = {
    ...state,
    [surface]: { ...next },
  };
  persist();
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useViewMode(surface: ViewSurface): [ViewMode, (next: ViewMode) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => getViewMode(surface),
    () => SURFACE_DEFAULTS[surface],
  );

  useEffect(() => {
    ensureHydrated();
  }, []);

  return [value, (next: ViewMode) => setViewMode(surface, next)];
}
