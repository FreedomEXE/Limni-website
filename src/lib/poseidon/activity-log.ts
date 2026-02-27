/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: activity-log.ts
 *
 * Description:
 * Lightweight append-only activity log for deity actions. Triton and Nereus
 * write entries; Poseidon reads and resets the log during Daily Reckoning.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/poseidon/config";
import { withStateLock } from "@/lib/poseidon/state-mutex";

export type ActivityEntry = {
  deity: "triton" | "nereus";
  timestamp: string;
  type: string;
  summary: string;
  priority?: string;
  metadata?: Record<string, unknown>;
};

const LOG_PATH = path.resolve(process.cwd(), config.stateDir, "activity_log.json");
const MAX_ENTRIES = 200;

async function ensureDir(): Promise<void> {
  await mkdir(path.dirname(LOG_PATH), { recursive: true });
}

function sanitizeEntry(raw: unknown): ActivityEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const deity = row.deity;
  if (deity !== "triton" && deity !== "nereus") return null;

  const timestamp = typeof row.timestamp === "string" ? row.timestamp : "";
  const type = typeof row.type === "string" ? row.type : "";
  const summary = typeof row.summary === "string" ? row.summary : "";
  if (!timestamp || !type || !summary) return null;

  const entry: ActivityEntry = {
    deity,
    timestamp,
    type,
    summary,
  };

  if (typeof row.priority === "string" && row.priority) {
    entry.priority = row.priority;
  }
  if (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
    entry.metadata = row.metadata as Record<string, unknown>;
  }

  return entry;
}

async function readRawLog(): Promise<ActivityEntry[]> {
  await ensureDir();
  try {
    const raw = await readFile(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeEntry(entry))
      .filter((entry): entry is ActivityEntry => entry !== null);
  } catch {
    return [];
  }
}

export async function appendActivityLog(entry: ActivityEntry): Promise<void> {
  await withStateLock(async () => {
    const entries = await readRawLog();
    entries.push(entry);

    const capped = entries.length > MAX_ENTRIES
      ? entries.slice(-MAX_ENTRIES)
      : entries;

    await writeFile(LOG_PATH, JSON.stringify(capped, null, 2), "utf8");
  });
}

export async function readActivityLog(): Promise<ActivityEntry[]> {
  return await readRawLog();
}

export async function resetActivityLog(): Promise<void> {
  await withStateLock(async () => {
    await ensureDir();
    await writeFile(LOG_PATH, "[]", "utf8");
  });
}
