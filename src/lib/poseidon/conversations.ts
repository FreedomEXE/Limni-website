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
type PersistMode = "await" | "defer";
type PersistOptions = {
  persist?: PersistMode;
};

const KV_KEY = "conversations";
const DEFAULT_MAX_HISTORY_MESSAGE_CHARS = 2_000;
const DEFAULT_MAX_HISTORY_TOTAL_CHARS = 12_000;
const HISTORY_TRUNCATION_NOTE = "\n[Message truncated to keep conversation context responsive.]";
let loaded = false;
let history: Message[] = [];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const MAX_HISTORY_MESSAGE_CHARS = parsePositiveInt(
  process.env.PROTEUS_MAX_HISTORY_MESSAGE_CHARS,
  DEFAULT_MAX_HISTORY_MESSAGE_CHARS,
);
const MAX_HISTORY_TOTAL_CHARS = parsePositiveInt(
  process.env.PROTEUS_MAX_HISTORY_TOTAL_CHARS,
  DEFAULT_MAX_HISTORY_TOTAL_CHARS,
);

async function saveHistory() {
  await kvSet(KV_KEY, JSON.stringify(history));
}

async function persistHistory(mode: PersistMode = "await"): Promise<void> {
  const write = saveHistory();
  if (mode === "defer") {
    void write.catch((error) => {
      console.error("[poseidon.conversations] Deferred save failed:", error);
    });
    return;
  }
  await write;
}

function clampHistoryContent(content: string): string {
  const normalized = (content || "").trim();
  if (normalized.length <= MAX_HISTORY_MESSAGE_CHARS) return normalized;
  const budget = Math.max(200, MAX_HISTORY_MESSAGE_CHARS - HISTORY_TRUNCATION_NOTE.length);
  return `${normalized.slice(0, budget).trimEnd()}${HISTORY_TRUNCATION_NOTE}`;
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
            content: clampHistoryContent(row.content),
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
  const out: ChatMessage[] = [];
  let usedChars = 0;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];
    const content = clampHistoryContent(row.content);
    const next = usedChars + content.length;
    if (out.length > 0 && next > MAX_HISTORY_TOTAL_CHARS) break;
    out.push({ role: row.role, content });
    usedChars = next;
  }

  return out.reverse();
}

export async function addMessage(
  role: "user" | "assistant",
  content: string,
  options: PersistOptions = {},
): Promise<void> {
  await loadHistory();
  history.push({ role, content: clampHistoryContent(content), timestamp: Date.now() });
  if (history.length > config.maxConversationHistory) {
    history = history.slice(-config.maxConversationHistory);
  }
  await persistHistory(options.persist ?? "await");
}

export async function bufferMessage(
  content: string,
  userName?: string,
  options: PersistOptions = {},
): Promise<void> {
  await loadHistory();
  const tagged = clampHistoryContent(userName ? `[${userName}]: ${content}` : content);

  const last = history[history.length - 1];
  if (last && last.role === "user") {
    last.content = clampHistoryContent(`${last.content}\n${tagged}`);
    last.timestamp = Date.now();
  } else {
    history.push({ role: "user", content: tagged, timestamp: Date.now() });
  }

  if (history.length > config.maxConversationHistory) {
    history = history.slice(-config.maxConversationHistory);
  }
  await persistHistory(options.persist ?? "await");
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
