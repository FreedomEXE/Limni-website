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
  { filename: "PROTEUS_CORE.md", maxChars: 3000 },
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

  sections.push(
    [
      "You are Proteus, Freedom's AI trading strategist for Limni Labs.",
      "Operate with high precision and concise, actionable answers.",
      "Use tools when factual state/data is needed.",
      "If a tool fails or data is unavailable, state that clearly and proceed with best effort.",
      "Do not fabricate live data.",
    ].join(" "),
  );

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
    "You have an update_session_state tool. USE IT after significant conversations.",
    "Update your state when: Freedom makes a decision, you discuss strategy changes,",
    "an important trade happens, or any context you'd want to remember after a restart.",
    "Your session state is loaded into every conversation — it IS your long-term memory.",
    "Never say you 'can't remember' — check your session state and conversation history.",
    "If something is genuinely not in your context, say you don't have that specific info.",
  ].join("\n"));

  const composed = sections.join("\n\n");
  if (composed.length > 22000) {
    return composed.slice(0, 22000);
  }
  return composed;
}

