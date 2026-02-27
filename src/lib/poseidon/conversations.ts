/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: conversations.ts
 *
 * Description:
 * Persists Proteus chat history to local JSON state so Telegram context
 * survives process restarts with bounded history length.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/poseidon/config";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

type ChatMessage = Pick<Message, "role" | "content">;

const conversationsPath = path.resolve(process.cwd(), config.stateDir, "conversations.json");
let loaded = false;
let history: Message[] = [];

async function ensureStateDir() {
  await mkdir(path.dirname(conversationsPath), { recursive: true });
}

async function saveHistory() {
  await ensureStateDir();
  await writeFile(conversationsPath, JSON.stringify(history, null, 2), "utf8");
}

export async function loadHistory() {
  if (loaded) return;
  loaded = true;
  await ensureStateDir();
  try {
    const raw = await readFile(conversationsPath, "utf8");
    const parsed = JSON.parse(raw) as Message[];
    if (Array.isArray(parsed)) {
      history = parsed
        .filter((row) => row && (row.role === "user" || row.role === "assistant") && typeof row.content === "string")
        .map((row) => ({
          role: row.role,
          content: row.content,
          timestamp: Number.isFinite(row.timestamp) ? row.timestamp : Date.now(),
        }))
        .slice(-config.maxConversationHistory);
    }
  } catch {
    history = [];
    await saveHistory();
  }
}

export async function getHistory(): Promise<ChatMessage[]> {
  await loadHistory();
  return history.map((message) => ({ role: message.role, content: message.content }));
}

export async function addMessage(role: "user" | "assistant", content: string): Promise<void> {
  await loadHistory();
  history.push({ role, content, timestamp: Date.now() });
  if (history.length > config.maxConversationHistory) {
    history = history.slice(-config.maxConversationHistory);
  }
  await saveHistory();
}

export async function clearHistory(): Promise<void> {
  await loadHistory();
  history = [];
  await saveHistory();
}

