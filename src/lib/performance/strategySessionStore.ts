"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { AssetClass } from "@/lib/cotMarkets";
import {
  fetchCurrentWeekStrategyClientPayload,
  fetchStrategyArtifactStatus,
  fetchStrategyClientPayload,
  getStrategyClientPayload,
  setStrategyClientPayload,
} from "@/lib/performance/strategyClientCache";
import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";
import {
  buildStrategySelectionKey,
  type RuntimeStrategySelection,
} from "@/lib/performance/strategySelection";

export type SessionLoadStatus = "idle" | "loading" | "ready" | "missing" | "error";
export type SessionCurrentWeekStatus =
  | "historical-only"
  | "current-loading"
  | "current-ready"
  | "current-empty"
  | "current-error";

export type WeeklyReturnRow = {
  symbol: string;
  assetClass: AssetClass;
  returnPct: number;
  openPrice: number;
  closePrice: number;
};

export type StrategySessionRecord = {
  selection: RuntimeStrategySelection;
  selectionKey: string;
  payload: StrategyClientPayload | null;
  status: SessionLoadStatus;
  currentWeekStatus: SessionCurrentWeekStatus;
  error: string | null;
  loadedAtUtc: string | null;
  currentWeekLoadedAtUtc: string | null;
};

type WeeklyReturnStatus = "idle" | "loading" | "ready" | "error";

type StrategySessionState = {
  activeSelectionKey: string | null;
  records: Record<string, StrategySessionRecord>;
  preload: {
    status: "idle" | "loading" | "ready" | "partial" | "error";
    queuedSelectionKeys: string[];
    loadingSelectionKeys: string[];
    readySelectionKeys: string[];
    failedSelectionKeys: Record<string, string>;
  };
  weeklyReturnsByWeek: Record<string, WeeklyReturnRow[]>;
  weeklyReturnStatusByWeek: Record<string, WeeklyReturnStatus>;
};

const listeners = new Set<() => void>();
const strategyInflight = new Map<string, Promise<void>>();
const currentWeekInflight = new Map<string, Promise<void>>();
const weeklyReturnsInflight = new Map<string, Promise<void>>();
let preloadInflight: Promise<void> | null = null;
let currentWeekRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let currentWeekRefreshInterval: ReturnType<typeof setInterval> | null = null;

let state: StrategySessionState = {
  activeSelectionKey: null,
  records: {},
  preload: {
    status: "idle",
    queuedSelectionKeys: [],
    loadingSelectionKeys: [],
    readySelectionKeys: [],
    failedSelectionKeys: {},
  },
  weeklyReturnsByWeek: {},
  weeklyReturnStatusByWeek: {},
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

function selectionKey(selection: RuntimeStrategySelection) {
  return buildStrategySelectionKey(selection);
}

function emptyRecord(selection: RuntimeStrategySelection): StrategySessionRecord {
  return {
    selection,
    selectionKey: selectionKey(selection),
    payload: null,
    status: "idle",
    currentWeekStatus: "historical-only",
    error: null,
    loadedAtUtc: null,
    currentWeekLoadedAtUtc: null,
  };
}

function mergeRecordPayload(
  previous: StrategyClientPayload | null,
  next: StrategyClientPayload | null,
): StrategyClientPayload | null {
  if (!next) return previous;
  if (!previous) return next;
  return {
    engineWeekMap: mergeMap(previous.engineWeekMap, next.engineWeekMap),
    engineSimMap: mergeMap(previous.engineSimMap, next.engineSimMap),
    engineWeekResults: mergeMap(previous.engineWeekResults, next.engineWeekResults),
    sidebarStats: next.sidebarStats ?? previous.sidebarStats,
    weekOptions: mergeWeekOptions(previous.weekOptions, next.weekOptions),
    currentWeekOpenUtc: next.currentWeekOpenUtc ?? previous.currentWeekOpenUtc,
    artifactMeta: next.artifactMeta ?? previous.artifactMeta,
  };
}

function mergeMap<T>(
  previous: Record<string, T> | null | undefined,
  next: Record<string, T> | null | undefined,
) {
  if (!next) return previous ?? null;
  if (!previous) return next;
  return { ...previous, ...next };
}

function mergeWeekOptions(previous: string[] | undefined, next: string[] | undefined) {
  if (!next) return previous;
  if (!previous) return next;
  return Array.from(new Set([...next, ...previous]));
}

function hasFullPayload(payload: StrategyClientPayload | null) {
  return Boolean((payload?.engineWeekMap || payload?.engineSimMap) && payload?.engineWeekResults);
}

function gridHasActivity(payload: StrategyClientPayload | null, weekOpenUtc: string | undefined) {
  if (!weekOpenUtc) return false;
  const grid = payload?.engineWeekMap?.[weekOpenUtc];
  if (!grid) return false;
  return grid.combined.models.some((model) => (
    model.total > 0 ||
    model.returns.length > 0 ||
    Math.abs(model.percent) > 1e-9
  ));
}

function deriveCurrentWeekStatus(payload: StrategyClientPayload | null): SessionCurrentWeekStatus {
  const currentWeek = payload?.currentWeekOpenUtc;
  if (!payload || !currentWeek) return "historical-only";
  const result = payload.engineWeekResults?.[currentWeek];
  const hasCurrentPayload = Boolean(
    payload.engineWeekMap?.[currentWeek] ||
    payload.engineSimMap?.[currentWeek] ||
    result,
  );
  if (!hasCurrentPayload) return "historical-only";
  if (
    (result && result.tradeCount === 0 && Math.abs(result.totalReturnPct) < 1e-9) ||
    (payload.engineWeekMap?.[currentWeek] && !gridHasActivity(payload, currentWeek))
  ) {
    return "current-empty";
  }
  return "current-ready";
}

function updateRecord(
  selection: RuntimeStrategySelection,
  updater: (record: StrategySessionRecord) => StrategySessionRecord,
) {
  const key = selectionKey(selection);
  const current = state.records[key] ?? emptyRecord(selection);
  const next = updater(current);
  state = {
    ...state,
    records: {
      ...state.records,
      [key]: next,
    },
  };
  emit();
  return next;
}

export function seedStrategySessionPayload(
  selection: RuntimeStrategySelection,
  payload: StrategyClientPayload | null,
) {
  if (!payload) return;
  setStrategyClientPayload(selection, payload);
  updateRecord(selection, (record) => {
    const mergedPayload = mergeRecordPayload(record.payload, payload);
    return {
      ...record,
      payload: mergedPayload,
      status: hasFullPayload(mergedPayload) ? "ready" : "idle",
      currentWeekStatus: deriveCurrentWeekStatus(mergedPayload),
      error: null,
      loadedAtUtc: new Date().toISOString(),
    };
  });
}

export function setActiveStrategySessionSelection(selection: RuntimeStrategySelection) {
  const key = selectionKey(selection);
  if (state.activeSelectionKey === key) return;
  state = { ...state, activeSelectionKey: key };
  emit();
}

export function ensureStrategySession(
  selection: RuntimeStrategySelection,
  options: { currentWeek?: boolean; warm?: boolean } = {},
) {
  const loadCurrentWeek = options.currentWeek !== false;
  const key = selectionKey(selection);
  const current = state.records[key];
  if (current?.status === "ready" && hasFullPayload(current.payload)) {
    if (loadCurrentWeek) void ensureCurrentWeekSession(selection);
    return Promise.resolve();
  }
  const inflight = strategyInflight.get(key);
  if (inflight) return inflight;

  updateRecord(selection, (record) => ({
    ...record,
    status: record.payload ? "ready" : "loading",
    error: null,
  }));

  const request = (async () => {
    try {
      let payload = getStrategyClientPayload(selection, "full") ?? null;
      if (!payload || !hasFullPayload(payload)) {
        payload = await fetchStrategyClientPayload(selection, "full");
      }

      if (!payload || !hasFullPayload(payload)) {
        updateRecord(selection, (record) => ({
          ...record,
          payload: mergeRecordPayload(record.payload, payload),
          status: "missing",
          error: "Strategy artifact is not ready.",
          loadedAtUtc: new Date().toISOString(),
        }));
        return;
      }

      updateRecord(selection, (record) => {
        const mergedPayload = mergeRecordPayload(record.payload, payload);
        return {
          ...record,
          payload: mergedPayload,
          status: "ready",
          currentWeekStatus: deriveCurrentWeekStatus(mergedPayload),
          error: null,
          loadedAtUtc: new Date().toISOString(),
        };
      });

      if (loadCurrentWeek) {
        await ensureCurrentWeekSession(selection);
      }
    } catch (error) {
      updateRecord(selection, (record) => ({
        ...record,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        loadedAtUtc: new Date().toISOString(),
      }));
    }
  })().finally(() => {
    strategyInflight.delete(key);
  });

  strategyInflight.set(key, request);
  return request;
}

export function ensureCurrentWeekSession(selection: RuntimeStrategySelection) {
  return loadCurrentWeekSession(selection, { force: false });
}

export function refreshCurrentWeekSession(selection: RuntimeStrategySelection) {
  return loadCurrentWeekSession(selection, { force: true });
}

function loadCurrentWeekSession(
  selection: RuntimeStrategySelection,
  options: { force: boolean },
) {
  const key = selectionKey(selection);
  const current = state.records[key];
  if (
    !options.force &&
    (
      current?.currentWeekStatus === "current-ready" ||
      current?.currentWeekStatus === "current-empty" ||
      current?.currentWeekStatus === "current-loading"
    )
  ) {
    return currentWeekInflight.get(key) ?? Promise.resolve();
  }

  const inflight = currentWeekInflight.get(key);
  if (inflight && !options.force) return inflight;

  updateRecord(selection, (record) => ({
    ...record,
    currentWeekStatus: "current-loading",
    error: null,
  }));

  const request = (async () => {
    try {
      const payload = await fetchCurrentWeekStrategyClientPayload(selection, "full", {
        force: options.force,
      });
      if (!payload) {
        updateRecord(selection, (record) => ({
          ...record,
          currentWeekStatus: "current-error",
          error: "Current week payload is unavailable.",
          currentWeekLoadedAtUtc: new Date().toISOString(),
        }));
        return;
      }
      updateRecord(selection, (record) => {
        const mergedPayload = mergeRecordPayload(record.payload, payload);
        return {
          ...record,
          payload: mergedPayload,
          status: hasFullPayload(mergedPayload) ? "ready" : record.status,
          currentWeekStatus: deriveCurrentWeekStatus(mergedPayload),
          error: null,
          currentWeekLoadedAtUtc: new Date().toISOString(),
        };
      });
    } catch (error) {
      updateRecord(selection, (record) => ({
        ...record,
        currentWeekStatus: "current-error",
        error: error instanceof Error ? error.message : String(error),
        currentWeekLoadedAtUtc: new Date().toISOString(),
      }));
    }
  })().finally(() => {
    currentWeekInflight.delete(key);
  });

  currentWeekInflight.set(key, request);
  return request;
}

function clearHourlyCurrentWeekRefresh() {
  if (currentWeekRefreshTimer) {
    clearTimeout(currentWeekRefreshTimer);
    currentWeekRefreshTimer = null;
  }
  if (currentWeekRefreshInterval) {
    clearInterval(currentWeekRefreshInterval);
    currentWeekRefreshInterval = null;
  }
}

function scheduleHourlyCurrentWeekRefresh(selection: RuntimeStrategySelection) {
  clearHourlyCurrentWeekRefresh();

  const now = new Date();
  const msUntilNextHour =
    (60 - now.getMinutes()) * 60 * 1000 -
    now.getSeconds() * 1000 -
    now.getMilliseconds();

  currentWeekRefreshTimer = setTimeout(() => {
    void refreshCurrentWeekSession(selection);
    currentWeekRefreshInterval = setInterval(() => {
      void refreshCurrentWeekSession(selection);
    }, 3_600_000);
  }, Math.max(msUntilNextHour, 1000));
}

export function startStrategySessionPreload(activeSelection: RuntimeStrategySelection) {
  if (
    preloadInflight ||
    state.preload.status === "ready" ||
    state.preload.status === "partial" ||
    state.preload.status === "loading"
  ) {
    return preloadInflight ?? Promise.resolve();
  }

  const activeKey = selectionKey(activeSelection);
  state = {
    ...state,
    preload: {
      ...state.preload,
      status: "loading",
      queuedSelectionKeys: [],
      loadingSelectionKeys: [],
    },
  };
  emit();

  const request = (async () => {
    const status = await fetchStrategyArtifactStatus();
    if (!status) {
      state = { ...state, preload: { ...state.preload, status: "error" } };
      emit();
      return;
    }

    const pending = status.artifacts
      .filter((artifact) => artifact.key !== activeKey)
      .map((artifact) => ({
        key: artifact.key,
        selection: {
          strategy: artifact.strategy,
          f1: artifact.f1,
          f2: artifact.f2,
        },
      }));

    state = {
      ...state,
      preload: {
        ...state.preload,
        queuedSelectionKeys: pending.map((item) => item.key),
      },
    };
    emit();

    let index = 0;
    const workerCount = Math.min(1, Math.max(pending.length, 1));
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (index < pending.length) {
        const item = pending[index];
        index += 1;
        if (!item) return;
        state = {
          ...state,
          preload: {
            ...state.preload,
            queuedSelectionKeys: state.preload.queuedSelectionKeys.filter((key) => key !== item.key),
            loadingSelectionKeys: Array.from(new Set([...state.preload.loadingSelectionKeys, item.key])),
          },
        };
        emit();

        try {
          await ensureStrategySession(item.selection, { currentWeek: false, warm: false });
          state = {
            ...state,
            preload: {
              ...state.preload,
              loadingSelectionKeys: state.preload.loadingSelectionKeys.filter((key) => key !== item.key),
              readySelectionKeys: Array.from(new Set([...state.preload.readySelectionKeys, item.key])),
            },
          };
        } catch (error) {
          state = {
            ...state,
            preload: {
              ...state.preload,
              loadingSelectionKeys: state.preload.loadingSelectionKeys.filter((key) => key !== item.key),
              failedSelectionKeys: {
                ...state.preload.failedSelectionKeys,
                [item.key]: error instanceof Error ? error.message : String(error),
              },
            },
          };
        }
        emit();
      }
    }));

    const failedCount = Object.keys(state.preload.failedSelectionKeys).length;
    state = {
      ...state,
      preload: {
        ...state.preload,
        status: failedCount > 0 ? "partial" : "ready",
      },
    };
    emit();
  })().finally(() => {
    preloadInflight = null;
  });

  preloadInflight = request;
  return request;
}

export function ensureWeeklyReturns(weekOpenUtc: string | null) {
  if (!weekOpenUtc) return Promise.resolve();
  if (state.weeklyReturnStatusByWeek[weekOpenUtc] === "ready") return Promise.resolve();
  const inflight = weeklyReturnsInflight.get(weekOpenUtc);
  if (inflight) return inflight;

  state = {
    ...state,
    weeklyReturnStatusByWeek: {
      ...state.weeklyReturnStatusByWeek,
      [weekOpenUtc]: "loading",
    },
  };
  emit();

  const request = (async () => {
    try {
      const response = await fetch(`/api/matrix/weekly-returns?week=${encodeURIComponent(weekOpenUtc)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Weekly returns request failed (${response.status})`);
      const payload = (await response.json()) as { rows?: WeeklyReturnRow[] };
      state = {
        ...state,
        weeklyReturnsByWeek: {
          ...state.weeklyReturnsByWeek,
          [weekOpenUtc]: payload.rows ?? [],
        },
        weeklyReturnStatusByWeek: {
          ...state.weeklyReturnStatusByWeek,
          [weekOpenUtc]: "ready",
        },
      };
      emit();
    } catch {
      state = {
        ...state,
        weeklyReturnsByWeek: {
          ...state.weeklyReturnsByWeek,
          [weekOpenUtc]: [],
        },
        weeklyReturnStatusByWeek: {
          ...state.weeklyReturnStatusByWeek,
          [weekOpenUtc]: "error",
        },
      };
      emit();
    }
  })().finally(() => {
    weeklyReturnsInflight.delete(weekOpenUtc);
  });

  weeklyReturnsInflight.set(weekOpenUtc, request);
  return request;
}

export function useStrategySession(selection: RuntimeStrategySelection, options: {
  preload?: boolean;
} = {}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const key = selectionKey(selection);
  const { strategy, f1, f2 } = selection;

  useEffect(() => {
    const activeSelection = { strategy, f1, f2 };
    setActiveStrategySessionSelection(activeSelection);
    void ensureStrategySession(activeSelection);
    scheduleHourlyCurrentWeekRefresh(activeSelection);
    if (options.preload !== false) {
      void startStrategySessionPreload(activeSelection);
    }
    return () => clearHourlyCurrentWeekRefresh();
  }, [f1, f2, options.preload, strategy]);

  return snapshot.records[key] ?? emptyRecord(selection);
}

export function useWeeklyReturns(weekOpenUtc: string | null) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void ensureWeeklyReturns(weekOpenUtc);
  }, [weekOpenUtc]);
  return {
    rows: weekOpenUtc ? snapshot.weeklyReturnsByWeek[weekOpenUtc] ?? [] : [],
    status: weekOpenUtc ? snapshot.weeklyReturnStatusByWeek[weekOpenUtc] ?? "idle" : "idle",
  };
}
