/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: group-memory.ts
 *
 * Description:
 * Group chat memory layer for Proteus. Handles member registration,
 * message logging to DB, group context load/save, and conversation
 * history for group mode. All data is per-group for multi-group readiness.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "@/lib/db";
import { config } from "@/lib/poseidon/config";

// ─── Types ───────────────────────────────────

export type GroupMember = {
  telegramUserId: number;
  groupId: number;
  username: string | null;
  firstName: string | null;
  displayName: string | null;
  role: string;
  totalMessages: number;
  compositeScore: number;
  lastSeenUtc: Date;
};

export type GroupMessage = {
  id: number;
  groupId: number;
  telegramMessageId: number | null;
  telegramUserId: number;
  messageText: string;
  messageType: string;
  triggeredProteus: boolean;
  scored: boolean;
  createdAt: Date;
};

type GroupContextRow = {
  id: number;
  group_id: number;
  context_type: string;
  content: string;
  updated_at: Date;
};

type GroupMemberRow = {
  telegram_user_id: string;
  group_id: string;
  username: string | null;
  first_name: string | null;
  display_name: string | null;
  role: string;
  total_messages: number;
  composite_score: string;
  last_seen_utc: Date;
};

const DEFAULT_GROUP_HISTORY_MESSAGE_CHARS = 700;
const DEFAULT_GROUP_HISTORY_TOTAL_CHARS = 14_000;
const GROUP_HISTORY_TRUNCATION_NOTE = " [truncated]";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const MAX_GROUP_HISTORY_MESSAGE_CHARS = parsePositiveInt(
  process.env.PROTEUS_GROUP_HISTORY_MESSAGE_CHARS,
  DEFAULT_GROUP_HISTORY_MESSAGE_CHARS,
);
const MAX_GROUP_HISTORY_TOTAL_CHARS = parsePositiveInt(
  process.env.PROTEUS_GROUP_HISTORY_TOTAL_CHARS,
  DEFAULT_GROUP_HISTORY_TOTAL_CHARS,
);

function clampGroupHistoryText(text: string): string {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_GROUP_HISTORY_MESSAGE_CHARS) return normalized;
  const budget = Math.max(100, MAX_GROUP_HISTORY_MESSAGE_CHARS - GROUP_HISTORY_TRUNCATION_NOTE.length);
  return `${normalized.slice(0, budget).trimEnd()}${GROUP_HISTORY_TRUNCATION_NOTE}`;
}

// ─── Member Management ───────────────────────

/**
 * Register or update a group member on every message. Upserts the member
 * record and increments total_messages.
 */
export async function upsertGroupMember(
  groupId: number,
  userId: number,
  username: string | null,
  firstName: string | null,
): Promise<void> {
  await query(
    `INSERT INTO poseidon_group_members (telegram_user_id, group_id, username, first_name, total_messages, last_seen_utc)
     VALUES ($1, $2, $3, $4, 1, NOW())
     ON CONFLICT (telegram_user_id, group_id)
     DO UPDATE SET
       username = COALESCE(EXCLUDED.username, poseidon_group_members.username),
       first_name = COALESCE(EXCLUDED.first_name, poseidon_group_members.first_name),
       total_messages = poseidon_group_members.total_messages + 1,
       last_seen_utc = NOW()`,
    [userId, groupId, username || null, firstName || null],
  );
}

/**
 * Get a member by user ID and group.
 */
export async function getGroupMember(
  groupId: number,
  userId: number,
): Promise<GroupMember | null> {
  const row = await queryOne<GroupMemberRow>(
    `SELECT telegram_user_id, group_id, username, first_name, display_name,
            role, total_messages, composite_score, last_seen_utc
       FROM poseidon_group_members
      WHERE telegram_user_id = $1 AND group_id = $2`,
    [userId, groupId],
  );
  if (!row) return null;

  return {
    telegramUserId: Number(row.telegram_user_id),
    groupId: Number(row.group_id),
    username: row.username,
    firstName: row.first_name,
    displayName: row.display_name,
    role: row.role,
    totalMessages: row.total_messages,
    compositeScore: Number(row.composite_score),
    lastSeenUtc: row.last_seen_utc,
  };
}

/**
 * Get all members for a group, ordered by composite score descending.
 */
export async function getGroupLeaderboard(
  groupId: number,
  limit = 20,
): Promise<GroupMember[]> {
  const rows = await query<GroupMemberRow>(
    `SELECT telegram_user_id, group_id, username, first_name, display_name,
            role, total_messages, composite_score, last_seen_utc
       FROM poseidon_group_members
      WHERE group_id = $1
      ORDER BY composite_score DESC
      LIMIT $2`,
    [groupId, limit],
  );

  return rows.map((row) => ({
    telegramUserId: Number(row.telegram_user_id),
    groupId: Number(row.group_id),
    username: row.username,
    firstName: row.first_name,
    displayName: row.display_name,
    role: row.role,
    totalMessages: row.total_messages,
    compositeScore: Number(row.composite_score),
    lastSeenUtc: row.last_seen_utc,
  }));
}

// ─── Message Logging ─────────────────────────

/**
 * Log a group message to the database. Every message gets logged
 * for later batch scoring, regardless of whether Proteus responds.
 */
export async function logGroupMessage(
  groupId: number,
  telegramMessageId: number | null,
  userId: number,
  text: string,
  messageType = "text",
  triggeredProteus = false,
): Promise<void> {
  await query(
    `INSERT INTO poseidon_group_messages
       (group_id, telegram_message_id, telegram_user_id, message_text, message_type, triggered_proteus)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [groupId, telegramMessageId, userId, text, messageType, triggeredProteus],
  );
}

/**
 * Get recent group messages for building conversation context.
 * Returns the most recent N messages for the group.
 */
export async function getRecentGroupMessages(
  groupId: number,
  limit?: number,
): Promise<Array<{ userId: number; username: string | null; text: string; createdAt: Date }>> {
  const cap = limit ?? config.group.maxGroupHistory;
  const rows = await query<{
    telegram_user_id: string;
    username: string | null;
    message_text: string;
    created_at: Date;
  }>(
    `SELECT gm.telegram_user_id, mb.username, gm.message_text, gm.created_at
       FROM poseidon_group_messages gm
       LEFT JOIN poseidon_group_members mb
         ON gm.telegram_user_id = mb.telegram_user_id AND gm.group_id = mb.group_id
      WHERE gm.group_id = $1
      ORDER BY gm.created_at DESC
      LIMIT $2`,
    [groupId, cap],
  );

  return rows.reverse().map((row) => ({
    userId: Number(row.telegram_user_id),
    username: row.username,
    text: row.message_text,
    createdAt: row.created_at,
  }));
}

/**
 * Get unscored messages for batch scoring.
 */
export async function getUnscoredMessages(
  groupId: number,
  limit = 500,
): Promise<Array<{ id: number; userId: number; text: string; createdAt: Date }>> {
  const rows = await query<{
    id: string;
    telegram_user_id: string;
    message_text: string;
    created_at: Date;
  }>(
    `SELECT id, telegram_user_id, message_text, created_at
       FROM poseidon_group_messages
      WHERE group_id = $1 AND scored = FALSE
      ORDER BY created_at ASC
      LIMIT $2`,
    [groupId, limit],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    userId: Number(row.telegram_user_id),
    text: row.message_text,
    createdAt: row.created_at,
  }));
}

/**
 * Mark messages as scored after batch processing.
 */
export async function markMessagesScored(
  messageIds: number[],
  scoreResult: Record<string, unknown>,
): Promise<void> {
  if (!messageIds.length) return;
  await query(
    `UPDATE poseidon_group_messages
        SET scored = TRUE, score_result = $2
      WHERE id = ANY($1::bigint[])`,
    [messageIds, JSON.stringify(scoreResult)],
  );
}

// ─── Group Context ───────────────────────────

/**
 * Load the active group context (summarized discussion state).
 * This gets injected into Proteus's system prompt for group responses.
 */
export async function loadGroupContext(groupId: number): Promise<string> {
  const row = await queryOne<GroupContextRow>(
    `SELECT content FROM poseidon_group_context
      WHERE group_id = $1 AND context_type = 'active'
      ORDER BY updated_at DESC LIMIT 1`,
    [groupId],
  );
  return row?.content ?? "";
}

/**
 * Save/update the active group context.
 */
export async function saveGroupContext(groupId: number, content: string): Promise<void> {
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM poseidon_group_context
      WHERE group_id = $1 AND context_type = 'active'
      LIMIT 1`,
    [groupId],
  );

  if (existing) {
    await query(
      `UPDATE poseidon_group_context
          SET content = $2, updated_at = NOW()
        WHERE id = $1`,
      [existing.id, content],
    );
  } else {
    await query(
      `INSERT INTO poseidon_group_context (group_id, context_type, content)
       VALUES ($1, 'active', $2)`,
      [groupId, content],
    );
  }
}

/**
 * Save a monthly archive digest for the group.
 */
export async function saveGroupArchive(groupId: number, content: string): Promise<void> {
  await query(
    `INSERT INTO poseidon_group_context (group_id, context_type, content)
     VALUES ($1, 'archive', $2)`,
    [groupId, content],
  );
}

/**
 * Build a conversation-style history from recent group messages
 * for passing to Proteus as chat context.
 *
 * Consecutive user messages are merged into a single "user" turn
 * because the Anthropic API requires strictly alternating roles.
 * Without merging, the model hallucinates fake user messages.
 */
export async function buildGroupChatHistory(
  groupId: number,
  limit = 30,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const messages = await getRecentGroupMessages(groupId, limit);
  const botId = config.telegram.ownerId;

  const raw = messages
    .filter((msg) => msg.text?.trim())
    .map((msg) => {
      const text = clampGroupHistoryText(msg.text);
      if (msg.userId === botId) {
        return { role: "assistant" as const, content: text };
      }
      const tag = msg.username ? `@${msg.username}` : `User#${msg.userId}`;
      return { role: "user" as const, content: `[${tag}]: ${text}` };
    });

  // Merge consecutive same-role messages into single turns
  const merged: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const entry of raw) {
    const last = merged[merged.length - 1];
    if (last && last.role === entry.role) {
      last.content += `\n${entry.content}`;
    } else {
      merged.push({ ...entry });
    }
  }

  const budgeted: Array<{ role: "user" | "assistant"; content: string }> = [];
  let usedChars = 0;
  for (let i = merged.length - 1; i >= 0; i -= 1) {
    const row = merged[i];
    const next = usedChars + row.content.length;
    if (budgeted.length > 0 && next > MAX_GROUP_HISTORY_TOTAL_CHARS) break;
    budgeted.push(row);
    usedChars = next;
  }

  return budgeted.reverse();
}
