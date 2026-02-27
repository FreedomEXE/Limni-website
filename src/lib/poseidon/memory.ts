/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: memory.ts
 *
 * Description:
 * Loads Poseidon memory markdown files from disk, truncates each section
 * to safe lengths, and composes a single system prompt string for Proteus.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/poseidon/config";
import { readCurationFlag, writeCurationFlag } from "@/lib/poseidon/curation-flag";
import { loadSessionState, STATE_SOFT_LIMIT_CHARS } from "@/lib/poseidon/state";
import { loadGroupContext } from "@/lib/poseidon/group-memory";

type MemorySpec = {
  filename: string;
  maxChars: number;
};

type ContextDiagnosis = {
  loaded: string[];
  missing: string[];
  totalChars: number;
};

const MEMORY_FILES: MemorySpec[] = [
  { filename: "PROTEUS_CORE.md", maxChars: 5000 },
  { filename: "LIMNI_PLATFORM.md", maxChars: 5000 },
  { filename: "TRADING_FRAMEWORK.md", maxChars: 6000 },
  { filename: "BOT_OPERATIONS.md", maxChars: 5000 },
  { filename: "MARKET_KNOWLEDGE.md", maxChars: 4000 },
];

/**
 * Group mode loads a different set of memory files.
 * No PROTEUS_CORE (contains CTO identity), no LIMNI_PLATFORM (architecture),
 * no BOT_OPERATIONS (bot internals). Only market knowledge + group persona.
 */
const GROUP_MEMORY_FILES: MemorySpec[] = [
  { filename: "PROTEUS_GROUP_CORE.md", maxChars: 4000 },
  { filename: "TRADING_FRAMEWORK.md", maxChars: 6000 },
  { filename: "MARKET_KNOWLEDGE.md", maxChars: 4000 },
];
const MAX_SYSTEM_PROMPT_CHARS = 50_000;
const SESSION_STATE_PROTOCOL = [
  "## SESSION STATE PROTOCOL",
  "Use `update_session_state` after meaningful decisions, strategy changes, or important trades.",
  "Your session state is loaded into every conversation and is your long-term memory.",
  "Check session state and history before saying you do not remember something.",
  "If context is genuinely missing, say you do not have that specific information.",
].join("\n");

export function capStateToNewestWindow(state: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  if (state.length <= maxChars) return state;
  return state.slice(-maxChars);
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Truncated to ${maxChars} chars]`;
}

async function safeRead(filePath: string, maxChars: number): Promise<string | null> {
  try {
    await access(filePath);
    const raw = await readFile(filePath, "utf8");
    return truncate(raw, maxChars);
  } catch (error) {
    console.warn(
      "[poseidon.memory] missing/unreadable file:",
      filePath,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function diagnoseContext(): Promise<ContextDiagnosis> {
  const loaded: string[] = [];
  const missing: string[] = [];
  let totalChars = 0;

  for (const spec of MEMORY_FILES) {
    const fullPath = path.resolve(process.cwd(), config.memoryDir, spec.filename);
    const content = await safeRead(fullPath, spec.maxChars);
    if (!content) {
      missing.push(spec.filename);
      continue;
    }
    loaded.push(spec.filename);
    totalChars += content.length;
  }

  return { loaded, missing, totalChars };
}

export async function loadSystemPrompt(): Promise<string> {
  const sections: string[] = [];

  for (const spec of MEMORY_FILES) {
    const fullPath = path.resolve(process.cwd(), config.memoryDir, spec.filename);
    const content = await safeRead(fullPath, spec.maxChars);
    if (!content) continue;
    sections.push(`## ${spec.filename}\n${content}`);
  }

  // Load session state (perpetual memory across restarts)
  const sessionState = await loadSessionState();
  if (sessionState.length > STATE_SOFT_LIMIT_CHARS) {
    const reason = `State size ${sessionState.length} exceeds soft limit ${STATE_SOFT_LIMIT_CHARS}`;
    const existingFlag = await readCurationFlag();
    if (!existingFlag.requested || existingFlag.reason !== reason) {
      await writeCurationFlag({
        requested: true,
        reason,
        setAt: new Date().toISOString(),
      });
    }
    console.warn(
      `[poseidon.memory] State exceeds soft limit (${sessionState.length} chars) - curation flagged`,
    );
  }

  const baseSections = [...sections, SESSION_STATE_PROTOCOL];
  const baseComposed = baseSections.join("\n\n");

  if (!sessionState || sessionState.length <= 20) {
    if (baseComposed.length <= MAX_SYSTEM_PROMPT_CHARS) {
      return baseComposed;
    }
    return baseComposed.slice(0, MAX_SYSTEM_PROMPT_CHARS);
  }

  const statePrefix = "## CURRENT SESSION STATE\n";
  const joinPadding = "\n\n";
  const truncationNote = "\n\n[Oldest session state truncated to fit prompt budget. Run /reckoning or request curation to archive.]";
  const availableForState =
    MAX_SYSTEM_PROMPT_CHARS -
    baseComposed.length -
    joinPadding.length -
    statePrefix.length -
    truncationNote.length;
  const cappedState = capStateToNewestWindow(sessionState, availableForState);

  const stateSection = cappedState.length === sessionState.length
    ? `${statePrefix}${cappedState}`
    : `${statePrefix}${cappedState}${truncationNote}`;

  const withState = [sections.join("\n\n"), stateSection, SESSION_STATE_PROTOCOL]
    .filter(Boolean)
    .join("\n\n");

  if (withState.length <= MAX_SYSTEM_PROMPT_CHARS) {
    return withState;
  }

  // Fallback safety cap if memory files unexpectedly exceed budget.
  return withState.slice(0, MAX_SYSTEM_PROMPT_CHARS);
}

/**
 * Load the system prompt for group mode conversations.
 * Uses the group-specific memory files (no CTO identity, no platform internals)
 * and injects group active context from the database instead of session state.
 */
export async function loadGroupSystemPrompt(groupId: number): Promise<string> {
  const sections: string[] = [];

  for (const spec of GROUP_MEMORY_FILES) {
    const fullPath = path.resolve(process.cwd(), config.memoryDir, spec.filename);
    const content = await safeRead(fullPath, spec.maxChars);
    if (!content) continue;
    sections.push(`## ${spec.filename}\n${content}`);
  }

  // Load group active context from DB
  const groupContext = await loadGroupContext(groupId);
  if (groupContext && groupContext.length > 20) {
    const capped = truncate(groupContext, config.group.maxContextChars);
    sections.push(`## GROUP CONTEXT\n${capped}`);
  }

  sections.push([
    "## GROUP CONTEXT PROTOCOL",
    "Use `get_group_context` to check what topics the group has been discussing.",
    "Use `update_group_context` after notable discussions to save important context.",
    "You do NOT have access to private session state, bot internals, or account data in group mode.",
    "If Freedom asks for restricted data in the group, tell him you'll send it privately.",
  ].join("\n"));

  const composed = sections.join("\n\n");
  if (composed.length <= MAX_SYSTEM_PROMPT_CHARS) {
    return composed;
  }
  return composed.slice(0, MAX_SYSTEM_PROMPT_CHARS);
}
