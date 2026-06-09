"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { AssetClass } from "@/lib/cotMarkets";
import type { ReturnMatrix } from "@/lib/viewMode/resolveDisplayValue";
import {
  fetchCurrentWeekStrategyClientPayload,
  fetchStrategyArtifactStatus,
  fetchStrategyClientPayload,
  fetchStrategyKernelPayload,
  getStrategyClientPayload,
  setStrategyClientPayload,
  type StrategyArtifactStatusPayload,
} from "@/lib/performance/strategyClientCache";
import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";
import {
  hasHistoricalStrategyPayload,
  mergeStrategyWeekOptions,
} from "@/lib/performance/strategyPayloadCompleteness";
import {
  buildStrategySelectionKey,
  type RuntimeStrategySelection,
} from "@/lib/performance/strategySelection";
import type {
  PreloadManifest,
  PreloadTask,
  StrategyPreloadTask,
} from "@/lib/preload/preloadRegistry";
import {
  clearGlobalPreloadStamp,
  hasTrustedGlobalPreloadStamp,
  writeGlobalPreloadStamp,
} from "@/lib/preload/preloadContract";

export type SessionLoadStatus = "idle" | "loading" | "ready" | "missing" | "error";
export type SessionCurrentWeekStatus =
  | "historical-only"
  | "current-loading"
  | "current-ready"
  | "current-empty"
  | "current-error";
export type PreloadPhase =
  | "checking-updates"
  | "loading-active"
  | "loading-market-data"
  | "loading-strategies"
  | "computing-live-data"
  | "ready";

export type WeeklyReturnRow = {
  symbol: string;
  assetClass: AssetClass;
  returnPct: number;
  openPrice: number;
  closePrice: number;
  canonical?: { rawPct: number };
  execution?: { rawPct: number } | null;
  adrPct?: number;
  warnings?: string[];
  returnMatrix?: ReturnMatrix;
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
    phase: PreloadPhase;
    status: "idle" | "loading" | "ready" | "partial" | "error";
    completedOnce: boolean;
    queuedSelectionKeys: string[];
    loadingSelectionKeys: string[];
    readySelectionKeys: string[];
    failedSelectionKeys: Record<string, string>;
  };
  weeklyReturnsByWeek: Record<string, WeeklyReturnRow[]>;
  weeklyReturnStatusByWeek: Record<string, WeeklyReturnStatus>;
};

type StrategySessionPreloadOptions = {
  trustGlobalStamp?: boolean;
  includeBackgroundStrategyTasks?: boolean;
  useKernelPayload?: boolean;
};

const listeners = new Set<() => void>();
const strategyInflight = new Map<string, Promise<void>>();
const currentWeekInflight = new Map<string, Promise<void>>();
const weeklyReturnsInflight = new Map<string, Promise<void>>();
let preloadInflight: Promise<void> | null = null;
let backgroundRepairInflight: Promise<void> | null = null;
let currentWeekRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let currentWeekRefreshInterval: ReturnType<typeof setInterval> | null = null;
const preloadedEngineVersions = new Map<string, string>();
const PRELOAD_GATE_ARTIFACT_STATUS_TIMEOUT_MS = 5_000;
const PRELOAD_BACKGROUND_ARTIFACT_STATUS_TIMEOUT_MS = 30_000;

let state: StrategySessionState = {
  activeSelectionKey: null,
  records: {},
  preload: {
    phase: "ready",
    status: "idle",
    completedOnce: false,
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
    weekOptions: mergeStrategyWeekOptions(
      previous.weekOptions,
      next.weekOptions,
      next.currentWeekOpenUtc ?? previous.currentWeekOpenUtc,
    ),
    currentWeekOpenUtc: next.currentWeekOpenUtc ?? previous.currentWeekOpenUtc,
    artifactMeta: next.artifactMeta ?? previous.artifactMeta,
    selectedTradeRowsBundle: next.selectedTradeRowsBundle ?? previous.selectedTradeRowsBundle ?? null,
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

function hasMissingArtifactWeeks(payload: StrategyClientPayload | null | undefined) {
  return (payload?.artifactMeta?.missingWeeks?.length ?? 0) > 0;
}

function hasFullPayload(payload: StrategyClientPayload | null) {
  if (hasMissingArtifactWeeks(payload)) return false;
  return Boolean(
    (payload?.engineWeekMap || payload?.engineSimMap) &&
    payload?.engineWeekResults &&
    hasHistoricalStrategyPayload(payload) &&
    payload.selectedTradeRowsBundle?.ledgerIdentity
  );
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

function currentUtcHourBucket(date = new Date()) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCHours()).padStart(2, "0"),
  ].join("-");
}

function loadedThisUtcHour(loadedAtUtc: string | null | undefined) {
  if (!loadedAtUtc) return false;
  const loadedAt = new Date(loadedAtUtc);
  if (Number.isNaN(loadedAt.getTime())) return false;
  return currentUtcHourBucket(loadedAt) === currentUtcHourBucket();
}

function assetSeriesMismatchForCurrentWeek(payload: StrategyClientPayload | null) {
  const currentWeek = payload?.currentWeekOpenUtc;
  if (!payload || !currentWeek) return false;

  const result = payload.engineWeekResults?.[currentWeek];
  const simulation = payload.engineSimMap?.[currentWeek];
  if (!result || !simulation) return false;

  const expected = new Map<string, { trades: number; returnPct: number }>();
  for (const trade of result.trades ?? []) {
    const current = expected.get(trade.assetClass) ?? { trades: 0, returnPct: 0 };
    current.trades += 1;
    current.returnPct += trade.returnPct;
    expected.set(trade.assetClass, current);
  }

  for (const [assetClass, stats] of expected) {
    if (stats.trades <= 0) continue;
    const series = simulation.series.find((item) => item.id === `asset:${assetClass}`);
    if (!series) return true;
    if ((series.trades ?? 0) !== stats.trades) return true;
    const lastPoint = series.points.at(-1);
    const actualReturn = lastPoint?.equity_pct ?? 0;
    if (Math.abs(actualReturn - stats.returnPct) > 0.05) return true;
  }

  return false;
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
  options: { currentWeek?: boolean; force?: boolean; warm?: boolean; kernel?: boolean } = {},
) {
  const loadCurrentWeek = options.currentWeek !== false;
  const key = selectionKey(selection);
  const current = state.records[key];
  if (!options.force && current?.status === "ready" && hasFullPayload(current.payload)) {
    if (loadCurrentWeek) void ensureCurrentWeekSession(selection);
    return Promise.resolve();
  }
  const inflightKey = options.force ? `${key}:force` : key;
  const inflight = strategyInflight.get(inflightKey);
  if (inflight) return inflight;

  updateRecord(selection, (record) => ({
    ...record,
    status: record.payload ? "ready" : "loading",
    error: null,
  }));

  const request = (async () => {
    try {
      let payload = options.kernel ? null : getStrategyClientPayload(selection, "full") ?? null;
      if (options.force || !payload || !hasFullPayload(payload)) {
        const fetchPayload = options.kernel ? fetchStrategyKernelPayload : fetchStrategyClientPayload;
        payload = await fetchPayload(selection, "full", {
          force: options.force === true,
        });
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
    strategyInflight.delete(inflightKey);
  });

  strategyInflight.set(inflightKey, request);
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
  const hasFreshCurrentWeek =
    loadedThisUtcHour(current?.currentWeekLoadedAtUtc) &&
    (
      current?.currentWeekStatus === "current-ready" ||
      current?.currentWeekStatus === "current-empty"
    );
  const currentWeekAssetMismatch = assetSeriesMismatchForCurrentWeek(current?.payload ?? null);
  if (!options.force && current?.currentWeekStatus === "current-loading") {
    return currentWeekInflight.get(key) ?? Promise.resolve();
  }
  if (!options.force && hasFreshCurrentWeek && !currentWeekAssetMismatch) {
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

function resetPreloadState(overrides: Partial<StrategySessionState["preload"]> = {}) {
  state = {
    ...state,
    preload: {
      phase: "checking-updates",
      status: "loading",
      completedOnce: false,
      queuedSelectionKeys: [],
      loadingSelectionKeys: [],
      readySelectionKeys: [],
      failedSelectionKeys: {},
      ...overrides,
    },
  };
  emit();
}

function markPreloadTaskLoading(task: PreloadTask) {
  state = {
    ...state,
    preload: {
      ...state.preload,
      queuedSelectionKeys: state.preload.queuedSelectionKeys.filter((key) => key !== task.id),
      loadingSelectionKeys: Array.from(new Set([...state.preload.loadingSelectionKeys, task.id])),
    },
  };
  emit();
}

function markPreloadTaskReady(task: PreloadTask) {
  state = {
    ...state,
    preload: {
      ...state.preload,
      loadingSelectionKeys: state.preload.loadingSelectionKeys.filter((key) => key !== task.id),
      readySelectionKeys: Array.from(new Set([...state.preload.readySelectionKeys, task.id])),
    },
  };
  emit();
}

function markPreloadTaskFailed(task: PreloadTask, error: unknown) {
  state = {
    ...state,
    preload: {
      ...state.preload,
      loadingSelectionKeys: state.preload.loadingSelectionKeys.filter((key) => key !== task.id),
      failedSelectionKeys: {
        ...state.preload.failedSelectionKeys,
        [task.id]: error instanceof Error ? error.message : String(error),
      },
    },
  };
  emit();
}

function isStrategyPreloadTask(task: PreloadTask | undefined): task is StrategyPreloadTask {
  return Boolean(task && task.domain === "strategy");
}

function postGateTaskPriority(task: PreloadTask) {
  if (task.domain === "market-intelligence") return 0;
  if (task.domain === "strategy") return 1;
  if (task.domain === "accounts") return 2;
  return 3;
}

function repairKeysFromStatus(status: StrategyArtifactStatusPayload | null) {
  if (!status) return new Set<string>();
  return new Set(
    status.artifacts
      .filter((artifact) => !artifact.ready)
      .map((artifact) => artifact.key),
  );
}

async function runBackgroundRepairs(manifest: PreloadManifest, repairKeys: Set<string>) {
  if (repairKeys.size === 0 || backgroundRepairInflight) return backgroundRepairInflight;

  const repairTasks = manifest.tasks.filter((task) => repairKeys.has(task.id));
  if (repairTasks.length === 0) return null;
  clearGlobalPreloadStamp();

  backgroundRepairInflight = (async () => {
    let failed = false;
    for (const task of repairTasks) {
      try {
        await task.run({ force: true });
      } catch (error) {
        failed = true;
        console.error(
          `[strategySessionStore] Background repair failed for ${task.id}:`,
          error,
        );
      }
    }
    if (!failed) {
      writeGlobalPreloadStamp();
    }
  })().finally(() => {
    backgroundRepairInflight = null;
  });

  return backgroundRepairInflight;
}

async function runPostGatePreloadTasks(
  manifest: PreloadManifest,
  repairKeys: Set<string>,
  options: StrategySessionPreloadOptions = {},
) {
  const tasks = manifest.tasks
    .filter((task) => task.id !== manifest.activeTaskId)
    .filter((task) =>
      options.includeBackgroundStrategyTasks === false
        ? task.domain !== "strategy"
        : true,
    )
    .sort((left, right) => postGateTaskPriority(left) - postGateTaskPriority(right));
  if (tasks.length === 0) return;

  state = {
    ...state,
    preload: {
      ...state.preload,
      queuedSelectionKeys: Array.from(new Set([
        ...state.preload.queuedSelectionKeys,
        ...tasks.map((task) => task.id),
      ])),
    },
  };
  emit();

  let index = 0;
  const concurrency = Math.min(3, tasks.length);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < tasks.length) {
      const task = tasks[index];
      index += 1;
      if (!task) return;

      markPreloadTaskLoading(task);
      try {
        await task.run({
          force: repairKeys.has(task.id),
          kernel: options.useKernelPayload === true,
        });
        markPreloadTaskReady(task);
      } catch (error) {
        markPreloadTaskFailed(task, error);
      }
    }
  }));
}

function activeManifestRecordIsReady(manifest: PreloadManifest) {
  const activeTask = manifest.tasks.find(
    (task): task is StrategyPreloadTask =>
      task.id === manifest.activeTaskId && isStrategyPreloadTask(task),
  );
  if (!activeTask) return true;
  const record = state.records[activeTask.id];
  return Boolean(record?.status === "ready" && hasFullPayload(record.payload));
}

export function startStrategySessionPreload(
  manifest: PreloadManifest,
  options: StrategySessionPreloadOptions = {},
) {
  if (preloadInflight) return preloadInflight;

  const trustGlobalStamp = options.trustGlobalStamp !== false;
  if (
    trustGlobalStamp &&
    !state.preload.completedOnce &&
    hasTrustedGlobalPreloadStamp()
  ) {
    state = {
      ...state,
      preload: {
        ...state.preload,
        phase: "ready",
        status: "ready",
        completedOnce: true,
      },
    };
    emit();
    if (options.useKernelPayload !== true) {
      void checkVersionsAndRepreload(manifest);
    }
    return Promise.resolve();
  }

  if (state.preload.completedOnce && (trustGlobalStamp || activeManifestRecordIsReady(manifest))) {
    if (options.useKernelPayload !== true) {
      void checkVersionsAndRepreload(manifest);
    }
    return Promise.resolve();
  }

  resetPreloadState();

  const request = runPreload(manifest, options);
  preloadInflight = request;
  return request;
}

async function checkVersionsAndRepreload(manifest: PreloadManifest) {
  const status = await fetchStrategyArtifactStatus(undefined, {
    timeoutMs: PRELOAD_BACKGROUND_ARTIFACT_STATUS_TIMEOUT_MS,
  });
  if (!status) return;

  const versionChanged = status.artifacts.some((artifact) => {
    const previous = preloadedEngineVersions.get(artifact.key);
    return previous !== artifact.expectedEngineVersion;
  });
  const repairKeys = repairKeysFromStatus(status);

  if (!versionChanged && repairKeys.size === 0) return;

  for (const artifact of status.artifacts) {
    preloadedEngineVersions.set(artifact.key, artifact.expectedEngineVersion);
  }

  if (!versionChanged) {
    void runBackgroundRepairs(manifest, repairKeys);
    return;
  }

  clearGlobalPreloadStamp();
  resetPreloadState();
  state = {
    ...state,
    records: {},
  };
  emit();

  preloadInflight = runPreload(manifest);
}

async function runPreload(
  manifest: PreloadManifest,
  options: StrategySessionPreloadOptions = {},
) {
  try {
    state = {
      ...state,
      preload: {
        ...state.preload,
        phase: "checking-updates",
        status: "loading",
      },
    };
    emit();

    const activeTask = manifest.tasks.find(
      (task): task is StrategyPreloadTask =>
        task.id === manifest.activeTaskId && isStrategyPreloadTask(task),
    );
    const status = options.useKernelPayload === true
      ? null
      : activeTask
      ? await fetchStrategyArtifactStatus(activeTask.id, {
          timeoutMs: PRELOAD_GATE_ARTIFACT_STATUS_TIMEOUT_MS,
        })
      : null;
    if (status) {
      for (const artifact of status.artifacts) {
        preloadedEngineVersions.set(artifact.key, artifact.expectedEngineVersion);
      }
    }
    const repairKeys = repairKeysFromStatus(status);

    if (activeTask) {
      state = {
        ...state,
        preload: {
          ...state.preload,
          phase: "loading-active",
        },
      };
      emit();

      markPreloadTaskLoading(activeTask);
      try {
        await activeTask.run({
          force: repairKeys.has(activeTask.id),
          kernel: options.useKernelPayload === true,
        });
        markPreloadTaskReady(activeTask);
      } catch (error) {
        markPreloadTaskFailed(activeTask, error);
      }
    }

    if (activeTask && activeTask.loadCurrentWeek !== false) {
      state = {
        ...state,
        preload: {
          ...state.preload,
          phase: "computing-live-data",
        },
      };
      emit();
      await loadCurrentWeekSession(activeTask.selection, { force: false });
    }

    const finalStatus = options.useKernelPayload === true
      ? status
      : repairKeys.size > 0 && activeTask
      ? await fetchStrategyArtifactStatus(activeTask.id, {
          timeoutMs: PRELOAD_GATE_ARTIFACT_STATUS_TIMEOUT_MS,
        }) ?? status
      : status;
    const stillMissingKeys = repairKeysFromStatus(finalStatus);
    const failedSelectionKeys = {
      ...state.preload.failedSelectionKeys,
      ...(activeTask && stillMissingKeys.has(activeTask.id)
        ? { [activeTask.id]: "Historical weeks are still rebuilding" }
        : {}),
    };
    const activeFailed = Boolean(activeTask && failedSelectionKeys[activeTask.id]);
    state = {
      ...state,
      preload: {
        ...state.preload,
        phase: "ready",
        status: activeFailed ? "partial" : "ready",
        completedOnce: !activeFailed,
        failedSelectionKeys,
      },
    };
    emit();

    if (!activeFailed) {
      if (options.useKernelPayload !== true) {
        writeGlobalPreloadStamp();
      }
      void runPostGatePreloadTasks(manifest, repairKeys, options);
    }
  } finally {
    preloadInflight = null;
  }
}

export function usePreloadStatus() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snapshot.preload;
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
      const rows = (payload.rows ?? []).map((row) => ({
        ...row,
        returnMatrix: row.returnMatrix ?? (
          row.canonical && typeof row.adrPct === "number"
            ? {
                canonical: row.canonical,
                execution: row.execution ?? null,
                adrPct: row.adrPct,
              }
            : undefined
        ),
      }));
      state = {
        ...state,
        weeklyReturnsByWeek: {
          ...state.weeklyReturnsByWeek,
          [weekOpenUtc]: rows,
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

export function useStrategySession(
  selection: RuntimeStrategySelection,
  options: { kernel?: boolean; currentWeek?: boolean } = {},
) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const key = selectionKey(selection);
  const { strategy, f1, f2 } = selection;

  useEffect(() => {
    const activeSelection = { strategy, f1, f2 };
    setActiveStrategySessionSelection(activeSelection);
    const loadCurrentWeek = options.currentWeek !== false;
    void ensureStrategySession(activeSelection, {
      currentWeek: loadCurrentWeek,
      kernel: options.kernel === true,
    });
    if (!loadCurrentWeek) {
      clearHourlyCurrentWeekRefresh();
      return () => {};
    }
    scheduleHourlyCurrentWeekRefresh(activeSelection);
    return () => clearHourlyCurrentWeekRefresh();
  }, [f1, f2, options.currentWeek, options.kernel, strategy]);

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
