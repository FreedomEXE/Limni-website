/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: triton.ts
 *
 * Description:
 * Triton polling engine for full-platform alert monitoring. Runs all
 * subsystem monitors every 30s, applies behavior + dedup filters, sends
 * formatted Telegram alerts, and persists monitor state for recovery.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Telegram } from "telegraf";
import { appendActivityLog } from "@/lib/poseidon/activity-log";
import { config } from "@/lib/poseidon/config";
import { getBehavior, loadBehavior, type BehaviorState } from "@/lib/poseidon/behavior";
import {
  formatTritonAlert,
  hydrateDedupCache,
  isBiasType,
  isErrorType,
  isMilestoneType,
  markAlertSent,
  shouldSendAlert,
  snapshotDedupCache,
  type TritonAlert,
} from "@/lib/poseidon/triton-alerts";
import {
  TRITON_MONITORS,
  TRITON_MONITOR_ORDER,
  type MonitorState,
  type TritonMonitorName,
} from "@/lib/poseidon/triton-monitors";
import { sendTelegramText } from "@/lib/poseidon/telegram-delivery";

type TritonPersistedState = {
  version: number;
  updatedAt: string;
  monitors: Record<TritonMonitorName, MonitorState>;
  dedup: Array<{ key: string; sentAt: number }>;
};

const POLL_INTERVAL_MS = 30_000;
const SAVE_INTERVAL_MS = 5 * 60_000;
const STATE_VERSION = 1;

const tritonStatePath = path.resolve(process.cwd(), config.stateDir, "triton_state.json");

let pollInterval: NodeJS.Timeout | null = null;
let saveInterval: NodeJS.Timeout | null = null;
let monitorState: Record<TritonMonitorName, MonitorState> = createEmptyMonitorState();
let pollInFlight = false;
let lastPollStartedAt: string | null = null;
let lastPollFinishedAt: string | null = null;
let lastPollDurationMs: number | null = null;
let lastPollError: string | null = null;
let lastPollSkippedAt: string | null = null;

export type TritonRuntimeStatus = {
  running: boolean;
  pollIntervalMs: number;
  saveIntervalMs: number;
  inFlight: boolean;
  lastPollStartedAt: string | null;
  lastPollFinishedAt: string | null;
  lastPollDurationMs: number | null;
  lastPollError: string | null;
  lastPollSkippedAt: string | null;
};

export function getTritonRuntimeStatus(): TritonRuntimeStatus {
  return {
    running: Boolean(pollInterval),
    pollIntervalMs: POLL_INTERVAL_MS,
    saveIntervalMs: SAVE_INTERVAL_MS,
    inFlight: pollInFlight,
    lastPollStartedAt,
    lastPollFinishedAt,
    lastPollDurationMs,
    lastPollError,
    lastPollSkippedAt,
  };
}

function createEmptyMonitorState(): Record<TritonMonitorName, MonitorState> {
  return {
    bitget: {},
    oanda: {},
    mt5: {},
    connectedAccounts: {},
    sentiment: {},
    cot: {},
    cron: {},
    news: {},
    marketData: {},
  };
}

async function ensureStateDir() {
  await mkdir(path.dirname(tritonStatePath), { recursive: true });
}

function withMonitorDefaults(
  value: Record<string, unknown> | null | undefined,
): Record<TritonMonitorName, MonitorState> {
  const baseline = createEmptyMonitorState();
  if (!value) return baseline;
  for (const key of TRITON_MONITOR_ORDER) {
    const row = value[key];
    if (row && typeof row === "object" && !Array.isArray(row)) {
      baseline[key] = row as MonitorState;
    }
  }
  return baseline;
}

async function loadTritonState(): Promise<TritonPersistedState | null> {
  await ensureStateDir();
  try {
    const raw = await readFile(tritonStatePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<TritonPersistedState>;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      version: Number(parsed.version) || STATE_VERSION,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      monitors: withMonitorDefaults(parsed.monitors as Record<string, unknown>),
      dedup: Array.isArray(parsed.dedup)
        ? parsed.dedup
            .filter((row) => row && typeof row.key === "string" && Number.isFinite(row.sentAt))
            .map((row) => ({ key: row.key, sentAt: Number(row.sentAt) }))
        : [],
    };
  } catch {
    return null;
  }
}

async function saveTritonState(): Promise<void> {
  await ensureStateDir();
  const payload: TritonPersistedState = {
    version: STATE_VERSION,
    updatedAt: new Date().toISOString(),
    monitors: monitorState,
    dedup: snapshotDedupCache(),
  };
  await writeFile(tritonStatePath, JSON.stringify(payload, null, 2), "utf8");
}

function shouldDeliverAlert(alert: TritonAlert, behavior: BehaviorState): boolean {
  if (!behavior.alertsEnabled && alert.priority !== "CRITICAL") {
    return false;
  }
  if (!behavior.verboseMode && alert.priority === "LOW") {
    return false;
  }
  if (!behavior.milestoneAlerts && isMilestoneType(alert.type)) {
    return false;
  }
  if (!behavior.biasAlerts && isBiasType(alert.type)) {
    return false;
  }
  if (!behavior.errorAlerts && isErrorType(alert.type)) {
    return false;
  }
  return true;
}

async function runMonitors(sendAlerts: boolean, telegram?: Telegram, ownerId?: number): Promise<void> {
  const pendingAlerts: TritonAlert[] = [];

  for (const monitorName of TRITON_MONITOR_ORDER) {
    try {
      const monitor = TRITON_MONITORS[monitorName];
      const lastState = monitorState[monitorName] ?? {};
      const result = await monitor(lastState);
      monitorState[monitorName] = result.newState;
      if (sendAlerts) {
        pendingAlerts.push(...result.alerts);
      }
    } catch (error) {
      console.error(`[triton] monitor failed: ${monitorName}`, error);
    }
  }

  if (!sendAlerts || !telegram || typeof ownerId !== "number") {
    return;
  }

  let behavior: BehaviorState;
  try {
    behavior = await getBehavior();
  } catch {
    behavior = {
      alertsEnabled: true,
      milestoneAlerts: true,
      biasAlerts: true,
      errorAlerts: true,
      verboseMode: false,
    };
  }

  for (const alert of pendingAlerts) {
    if (!shouldDeliverAlert(alert, behavior)) continue;
    if (!shouldSendAlert(alert.type, alert.priority, alert.discriminator)) continue;

    const payload = formatTritonAlert(alert.type, alert.priority, alert.body);
    try {
      await sendTelegramText(telegram, ownerId, payload);
      await appendActivityLog({
        deity: "triton",
        timestamp: new Date().toISOString(),
        type: "alert_sent",
        summary: `${alert.type}: ${alert.body.slice(0, 100)}`,
        priority: alert.priority,
        metadata: {
          discriminator: alert.discriminator,
        },
      }).catch(() => undefined);
      markAlertSent(alert.type, alert.discriminator);
    } catch (error) {
      console.warn("[triton] failed to send alert", {
        type: alert.type,
        discriminator: alert.discriminator,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function startTriton(telegram: Telegram, ownerId: number): Promise<void> {
  if (pollInterval) {
    console.log("[triton] already running");
    return;
  }

  await loadBehavior().catch(() => undefined);

  const persisted = await loadTritonState();
  monitorState = persisted?.monitors ?? createEmptyMonitorState();
  hydrateDedupCache(persisted?.dedup ?? []);

  // Baseline run on startup: update state but suppress alerts to avoid replay noise.
  await runMonitors(false);
  await saveTritonState().catch(() => undefined);

  pollInterval = setInterval(() => {
    if (pollInFlight) {
      lastPollSkippedAt = new Date().toISOString();
      return;
    }

    pollInFlight = true;
    lastPollStartedAt = new Date().toISOString();
    const startedMs = Date.now();

    runMonitors(true, telegram, ownerId)
      .then(() => {
        lastPollError = null;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        lastPollError = message;
        console.error("[triton] poll error:", error);
      })
      .finally(() => {
        lastPollDurationMs = Date.now() - startedMs;
        lastPollFinishedAt = new Date().toISOString();
        pollInFlight = false;
      });
  }, POLL_INTERVAL_MS);
  pollInterval.unref();

  saveInterval = setInterval(() => {
    saveTritonState().catch((error) => {
      console.warn("[triton] state save failed:", error);
    });
  }, SAVE_INTERVAL_MS);
  saveInterval.unref();

  console.log("[triton] Monitoring started (30s poll interval)");
}

export function stopTriton(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
  }
  pollInFlight = false;
  saveTritonState().catch(() => undefined);
}
