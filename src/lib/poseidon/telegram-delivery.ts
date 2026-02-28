/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: telegram-delivery.ts
 *
 * Description:
 * Shared Telegram delivery helpers for Poseidon subsystems. Handles
 * long-message chunking, parse-mode fallback, and retry/backoff for
 * transient Telegram API failures.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { Telegram } from "telegraf";

type ParseMode = "Markdown" | "HTML";

type SendTelegramTextOptions = {
  parseMode?: ParseMode;
  replyToMessageId?: number;
  chunkSize?: number;
};

const DEFAULT_CHUNK_SIZE = 3_800;
const MIN_CHUNK_SIZE = 700;
const MAX_SEND_RETRIES = 2;

function normalizeChunkSize(raw?: number): number {
  if (!Number.isFinite(raw) || !raw || raw <= 0) return DEFAULT_CHUNK_SIZE;
  return Math.max(MIN_CHUNK_SIZE, Math.min(4_000, Math.floor(raw)));
}

function normalizeText(text: string): string {
  return (text || "").replace(/\r\n/g, "\n").trim();
}

function pickSplitIndex(chunk: string): number {
  const minPreferred = Math.floor(chunk.length * 0.55);
  const breakpoints = ["\n\n", "\n", ". ", " "];

  for (const marker of breakpoints) {
    const idx = chunk.lastIndexOf(marker);
    if (idx >= minPreferred) {
      return idx + marker.length;
    }
  }

  return chunk.length;
}

export function splitTelegramMessage(text: string, chunkSize = DEFAULT_CHUNK_SIZE): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return ["No response generated."];

  const safeChunkSize = normalizeChunkSize(chunkSize);
  if (normalized.length <= safeChunkSize) return [normalized];

  const parts: string[] = [];
  let remaining = normalized;

  while (remaining.length > safeChunkSize) {
    const window = remaining.slice(0, safeChunkSize);
    const splitAt = pickSplitIndex(window);
    const head = remaining.slice(0, splitAt).trim();

    if (!head) {
      parts.push(remaining.slice(0, safeChunkSize));
      remaining = remaining.slice(safeChunkSize).trimStart();
      continue;
    }

    parts.push(head);
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts.filter(Boolean);
}

function getTelegramErrorCode(error: unknown): number | null {
  if (error instanceof Error && "response" in error) {
    const response = (error as { response?: { error_code?: number } }).response;
    if (typeof response?.error_code === "number") {
      return response.error_code;
    }
  }
  return null;
}

function getRetryAfterSeconds(error: unknown): number | null {
  if (error instanceof Error && "response" in error) {
    const response = (
      error as {
        response?: {
          parameters?: {
            retry_after?: number;
          };
        };
      }
    ).response;
    const retryAfter = response?.parameters?.retry_after;
    if (typeof retryAfter === "number" && Number.isFinite(retryAfter) && retryAfter > 0) {
      return retryAfter;
    }
  }
  return null;
}

function isMessageTooLongError(error: unknown): boolean {
  const code = getTelegramErrorCode(error);
  if (code === 400 && error instanceof Error) {
    return /message is too long|text is too long|entities too long/i.test(error.message);
  }
  if (error instanceof Error) {
    return /message is too long|text is too long|entities too long/i.test(error.message);
  }
  return false;
}

function isRetryableTelegramError(error: unknown): boolean {
  const code = getTelegramErrorCode(error);
  if (code === 429 || code === 500 || code === 502 || code === 503 || code === 504) {
    return true;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("etimedout") ||
      msg.includes("econnreset") ||
      msg.includes("socket hang up")
    );
  }

  return false;
}

async function sendWithRetry(
  telegram: Telegram,
  chatId: number,
  text: string,
  parseMode?: ParseMode,
  replyToMessageId?: number,
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_SEND_RETRIES; attempt += 1) {
    try {
      await telegram.sendMessage(chatId, text, {
        ...(parseMode ? { parse_mode: parseMode } : {}),
        ...(typeof replyToMessageId === "number"
          ? { reply_parameters: { message_id: replyToMessageId } }
          : {}),
      });
      return;
    } catch (error) {
      if (!isRetryableTelegramError(error) || attempt === MAX_SEND_RETRIES) {
        throw error;
      }

      const retryAfter = getRetryAfterSeconds(error);
      const delayMs = retryAfter ? retryAfter * 1_000 : (attempt + 1) * 1_000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function sendChunk(
  telegram: Telegram,
  chatId: number,
  chunk: string,
  parseMode?: ParseMode,
  replyToMessageId?: number,
): Promise<void> {
  if (parseMode) {
    try {
      await sendWithRetry(telegram, chatId, chunk, parseMode, replyToMessageId);
      return;
    } catch {
      await sendWithRetry(telegram, chatId, chunk, undefined, replyToMessageId);
      return;
    }
  }

  await sendWithRetry(telegram, chatId, chunk, undefined, replyToMessageId);
}

export async function sendTelegramText(
  telegram: Telegram,
  chatId: number,
  text: string,
  options: SendTelegramTextOptions = {},
): Promise<void> {
  const parseMode = options.parseMode;
  const initialReplyTo = options.replyToMessageId;
  const chunkSize = normalizeChunkSize(options.chunkSize);

  let queue = splitTelegramMessage(text, chunkSize);
  let firstChunk = true;

  while (queue.length > 0) {
    const chunk = queue.shift();
    if (!chunk) continue;

    try {
      await sendChunk(
        telegram,
        chatId,
        chunk,
        parseMode,
        firstChunk ? initialReplyTo : undefined,
      );
      firstChunk = false;
    } catch (error) {
      if (isMessageTooLongError(error) && chunk.length > MIN_CHUNK_SIZE) {
        const smaller = splitTelegramMessage(chunk, Math.max(MIN_CHUNK_SIZE, Math.floor(chunk.length / 2)));
        queue = [...smaller, ...queue];
        continue;
      }
      throw error;
    }
  }
}

