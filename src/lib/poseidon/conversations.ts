/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: conversations.ts
 *
 * Description:
 * Persists Proteus chat history to the database (poseidon_kv table) so
 * Telegram context survives container restarts with bounded history length.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { kvGet, kvSet } from "@/lib/poseidon/state-db";
import { config } from "@/lib/poseidon/config";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

type ChatMessage = Pick<Message, "role" | "content">;

const KV_KEY = "conversations";
let loaded = false;
let history: Message[] = [];

async function saveHistory() {
  await kvSet(KV_KEY, JSON.stringify(history));
}

export async function loadHistory() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await kvGet(KV_KEY);
    if (raw) {
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
    }
    console.log(`[poseidon.conversations] Loaded ${history.length} messages from DB`);
  } catch (error) {
    console.error("[poseidon.conversations] Failed to load from DB:", error);
    history = [];
    await saveHistory().catch((persistError) => {
      console.error("[poseidon.conversations] Failed to persist fallback history:", persistError);
    });
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

export async function bufferMessage(content: string, userName?: string): Promise<void> {
  await loadHistory();
  const tagged = userName ? `[${userName}]: ${content}` : content;

  const last = history[history.length - 1];
  if (last && last.role === "user") {
    last.content += `\n${tagged}`;
    last.timestamp = Date.now();
  } else {
    history.push({ role: "user", content: tagged, timestamp: Date.now() });
  }

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

export async function getConversationCount(): Promise<number> {
  await loadHistory();
  return history.length;
}
