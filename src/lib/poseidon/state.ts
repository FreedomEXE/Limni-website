/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: state.ts
 *
 * Description:
 * Perpetual session state for Proteus. Writes PROTEUS_STATE.md to disk
 * so Proteus can survive restarts and context loss. This is the "memory"
 * that makes Proteus feel persistent — it knows what was discussed,
 * what decisions were made, and what's happening right now.
 *
 * Inspired by Will's Jarvis SESSION_STATE.md pattern.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/poseidon/config";
import { withStateLock } from "@/lib/poseidon/state-mutex";

const STATE_FILENAME = "PROTEUS_STATE.md";
const statePath = path.resolve(process.cwd(), config.stateDir, STATE_FILENAME);
export const STATE_SOFT_LIMIT_CHARS = 40_000;

let cachedState: string | null = null;

async function ensureStateDir() {
  await mkdir(path.dirname(statePath), { recursive: true });
}

/**
 * Load the current session state from disk.
 * Returns the markdown content, or a default "no state" message.
 */
export async function loadSessionState(): Promise<string> {
  if (cachedState !== null) return cachedState;
  await ensureStateDir();
  try {
    const raw = await readFile(statePath, "utf8");
    cachedState = raw;
    console.log(`[poseidon.state] Loaded PROTEUS_STATE.md (${cachedState.length} chars)`);
    return cachedState;
  } catch {
    cachedState = "";
    console.log("[poseidon.state] No existing PROTEUS_STATE.md — fresh start");
    return cachedState;
  }
}

/**
 * Read the current state (for tools).
 */
export async function getSessionState(): Promise<string> {
  return await loadSessionState();
}

function stripStateHeader(content: string): string {
  return content.replace(/^# Proteus Session State\s*\n+(?:> Last updated:.*\n+)?/i, "").trim();
}

function formatStateDocument(content: string): string {
  const now = new Date().toISOString();
  const header = `# Proteus Session State\n\n> Last updated: ${now}\n\n`;
  const body = stripStateHeader(content);
  return `${header}${body}`;
}

export async function writeStateRaw(content: string): Promise<string> {
  await ensureStateDir();
  const full = formatStateDocument(content);

  await writeFile(statePath, full, "utf8");
  cachedState = full;
  console.log(`[poseidon.state] Updated PROTEUS_STATE.md (${full.length} chars)`);
  if (full.length > STATE_SOFT_LIMIT_CHARS) {
    console.warn(
      `[poseidon.state] State file exceeds soft limit (${full.length} chars) - curation recommended`,
    );
  }
  return `Session state updated (${full.length} chars)`;
}

/**
 * Write new session state to disk. Called by Proteus via the
 * update_session_state tool when something meaningful happens.
 *
 * The state is a markdown string that captures:
 * - What's currently happening (bot state, market context)
 * - Recent conversation highlights
 * - Decisions made
 * - What Freedom asked about last
 * - Any open threads or pending items
 */
export async function updateSessionState(content: string): Promise<string> {
  return await withStateLock(async () => await writeStateRaw(content));
}

export async function getStateSize(): Promise<number> {
  const state = await loadSessionState();
  return state.length;
}

/**
 * Get a recovery summary for the startup message.
 * Returns null if there's no meaningful state to recover.
 */
export async function getRecoverySummary(): Promise<string | null> {
  const state = await loadSessionState();
  if (!state || state.length < 20) return null;

  // Extract the "Last updated" timestamp if present
  const match = state.match(/Last updated:\s*(.+)/);
  const lastUpdated = match?.[1]?.trim() ?? "unknown";

  return `Proteus online. Recovered state from ${lastUpdated}.\n\nLast known context:\n${state.slice(0, 500)}`;
}
