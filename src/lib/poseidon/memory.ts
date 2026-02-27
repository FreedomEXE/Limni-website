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
import { loadSessionState } from "@/lib/poseidon/state";

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
  { filename: "PROTEUS_CORE.md", maxChars: 4000 },
  { filename: "LIMNI_PLATFORM.md", maxChars: 4000 },
  { filename: "TRADING_FRAMEWORK.md", maxChars: 5000 },
  { filename: "BOT_OPERATIONS.md", maxChars: 4000 },
  { filename: "MARKET_KNOWLEDGE.md", maxChars: 3000 },
];

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
  if (sessionState && sessionState.length > 20) {
    sections.push(`## CURRENT SESSION STATE\n${sessionState}`);
  }

  // Session state instructions (always present)
  sections.push([
    "## SESSION STATE PROTOCOL",
    "Use `update_session_state` after meaningful decisions, strategy changes, or important trades.",
    "Your session state is loaded into every conversation and is your long-term memory.",
    "Check session state and history before saying you do not remember something.",
    "If context is genuinely missing, say you do not have that specific information.",
  ].join("\n"));

  const composed = sections.join("\n\n");
  if (composed.length > 22000) {
    return composed.slice(0, 22000);
  }
  return composed;
}
