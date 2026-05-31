/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: preloadContract.ts
 *
 * Description:
 * Client-safe preload contract versioning. Historical app data may be reused
 * across refresh/login when this contract version matches; live/current-week
 * data remains refreshed separately.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export const GLOBAL_PRELOAD_CACHE_VERSION =
  "global-preload-v1:canonical-weekly-v3-full-coverage:execution-weekly-v1:strategy-artifact-v28:dashboard-cache-v2";

const GLOBAL_PRELOAD_STAMP_KEY = "limni:global-preload:stamp:v1";
const GLOBAL_PRELOAD_STAMP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type GlobalPreloadStamp = {
  version: string;
  completedAtUtc: string;
  expiresAt: number;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readGlobalPreloadStamp(): GlobalPreloadStamp | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(GLOBAL_PRELOAD_STAMP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GlobalPreloadStamp>;
    if (
      parsed.version !== GLOBAL_PRELOAD_CACHE_VERSION ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(GLOBAL_PRELOAD_STAMP_KEY);
      return null;
    }
    return {
      version: parsed.version,
      completedAtUtc: typeof parsed.completedAtUtc === "string"
        ? parsed.completedAtUtc
        : new Date().toISOString(),
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function hasTrustedGlobalPreloadStamp() {
  return Boolean(readGlobalPreloadStamp());
}

export function writeGlobalPreloadStamp() {
  if (!canUseLocalStorage()) return;
  try {
    const stamp: GlobalPreloadStamp = {
      version: GLOBAL_PRELOAD_CACHE_VERSION,
      completedAtUtc: new Date().toISOString(),
      expiresAt: Date.now() + GLOBAL_PRELOAD_STAMP_TTL_MS,
    };
    window.localStorage.setItem(GLOBAL_PRELOAD_STAMP_KEY, JSON.stringify(stamp));
  } catch {
    // Preload stamp is an optimization; persistent payload validation still works without it.
  }
}

export function clearGlobalPreloadStamp() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(GLOBAL_PRELOAD_STAMP_KEY);
  } catch {}
}
