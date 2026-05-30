/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketModeStore.ts
 *
 * Description:
 * External store for the Performance Basket section mode preference.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useSyncExternalStore } from "react";

export type BasketMode = "this_week" | "all_time";

const STORAGE_KEY = "limni-performance-basket-mode";
const DEFAULT_MODE: BasketMode = "this_week";

let state: BasketMode = DEFAULT_MODE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function isBasketMode(value: unknown): value is BasketMode {
  return value === "this_week" || value === "all_time";
}

function hydrateFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (isBasketMode(parsed)) state = parsed;
  } catch {
    state = DEFAULT_MODE;
  }
}

function persist() {
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

export function getBasketMode() {
  return state;
}

export function setBasketMode(next: BasketMode) {
  ensureHydrated();
  state = next;
  persist();
  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBasketMode(): [BasketMode, (next: BasketMode) => void] {
  const value = useSyncExternalStore(subscribe, getBasketMode, () => DEFAULT_MODE);

  useEffect(() => {
    ensureHydrated();
  }, []);

  return [value, setBasketMode];
}
