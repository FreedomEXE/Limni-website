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

type StaticPromptCacheEntry = {
  value: string;
  expiresAt: number;
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
const DEFAULT_MAX_SESSION_STATE_PROMPT_CHARS = 8_000;
const DEFAULT_STATIC_MEMORY_CACHE_TTL_MS = 60_000;
const SESSION_STATE_PROTOCOL = [
  "## SESSION STATE PROTOCOL",
  "Use `update_session_state` after meaningful decisions, strategy changes, or important trades.",
  "Your session state is loaded into every conversation and is your long-term memory.",
  "Check session state and history before saying you do not remember something.",
  "If context is genuinely missing, say you do not have that specific information.",
  "RULE: When answering current system-state questions (bot status, account health, trade history, strategy configs, market data), ALWAYS query live tools. Never rely on static knowledge files for operational facts.",
].join("\n");
const staticPromptCache = new Map<string, StaticPromptCacheEntry>();

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const MAX_SESSION_STATE_PROMPT_CHARS = parsePositiveInt(
  process.env.PROTEUS_MAX_SESSION_STATE_PROMPT_CHARS,
  DEFAULT_MAX_SESSION_STATE_PROMPT_CHARS,
);
const STATIC_MEMORY_CACHE_TTL_MS = parsePositiveInt(
  process.env.PROTEUS_STATIC_MEMORY_CACHE_TTL_MS,
  DEFAULT_STATIC_MEMORY_CACHE_TTL_MS,
);

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

async function loadStaticMemoryPart(specs: MemorySpec[], cacheKey: string): Promise<string> {
  const now = Date.now();
  const cached = staticPromptCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const sections: string[] = [];
  for (const spec of specs) {
    const fullPath = path.resolve(process.cwd(), config.memoryDir, spec.filename);
    const content = await safeRead(fullPath, spec.maxChars);
    if (!content) continue;
    sections.push(`## ${spec.filename}\n${content}`);
  }

  const value = sections.join("\n\n");
  staticPromptCache.set(cacheKey, {
    value,
    expiresAt: now + STATIC_MEMORY_CACHE_TTL_MS,
  });
  return value;
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

/**
 * Structured system prompt with static (cacheable) and dynamic parts.
 * Static = memory files (rarely change, cached by Anthropic for 5 min).
 * Dynamic = session state + protocol (changes every conversation).
 */
export type SystemPromptParts = {
  staticPart: string;
  dynamicPart: string;
};

export async function loadSystemPrompt(): Promise<SystemPromptParts> {
  const staticPart = await loadStaticMemoryPart(MEMORY_FILES, "private");

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

  // Build dynamic part: session state + protocol
  const dynamicSections: string[] = [];

  if (sessionState && sessionState.length > 20) {
    const statePrefix = "## CURRENT SESSION STATE\n";
    const truncationNote = "\n\n[Oldest session state truncated to fit prompt budget. Run /reckoning or request curation to archive.]";

    // Budget for state: total limit minus static, protocol, and joining overhead
    const protocolAndPadding = SESSION_STATE_PROTOCOL.length + 20; // joining padding
    const availableForStateBudget =
      MAX_SYSTEM_PROMPT_CHARS -
      staticPart.length -
      statePrefix.length -
      truncationNote.length -
      protocolAndPadding;
    const availableForState = Math.min(
      MAX_SESSION_STATE_PROMPT_CHARS,
      Math.max(0, availableForStateBudget),
    );

    const cappedState = capStateToNewestWindow(sessionState, availableForState);
    if (!cappedState) {
      dynamicSections.push(
        "## CURRENT SESSION STATE\n[State omitted from this turn due to prompt budget; run curation if this persists.]",
      );
      dynamicSections.push(SESSION_STATE_PROTOCOL);
      return { staticPart, dynamicPart: dynamicSections.join("\n\n") };
    }
    const stateSection = cappedState.length === sessionState.length
      ? `${statePrefix}${cappedState}`
      : `${statePrefix}${cappedState}${truncationNote}`;
    dynamicSections.push(stateSection);
  }

  dynamicSections.push(SESSION_STATE_PROTOCOL);
  const dynamicPart = dynamicSections.join("\n\n");

  return { staticPart, dynamicPart };
}

/**
 * Load the system prompt for group mode conversations.
 * Uses the group-specific memory files (no CTO identity, no platform internals)
 * and injects group active context from the database instead of session state.
 */
export async function loadGroupSystemPrompt(groupId: number): Promise<string> {
  const sections: string[] = [];
  const staticPart = await loadStaticMemoryPart(GROUP_MEMORY_FILES, "group");
  if (staticPart) {
    sections.push(staticPart);
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
