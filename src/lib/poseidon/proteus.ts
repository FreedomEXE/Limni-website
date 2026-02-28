/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: proteus.ts
 *
 * Description:
 * Claude API wrapper for Proteus with agentic tool-use loop support.
 * Executes tool chains up to a bounded number of rounds and returns
 * the final assistant response text.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/poseidon/config";
import { handleToolCall } from "@/lib/poseidon/tools";
import type { SystemPromptParts } from "@/lib/poseidon/memory";

const client = new Anthropic({ apiKey: config.anthropic.apiKey });
const DEFAULT_MAX_TOOL_ROUNDS = 4;
const CLAUDE_TIMEOUT_MS = 90_000;
const TOOL_TIMEOUT_MS = 15_000;
const TYPING_KEEPALIVE_MS = 4_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const DEFAULT_MAX_RESPONSE_CHARS = 5_000;
const MAX_PERSIST_CHARS = 10_000;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  displayText: string;
  persistText: string;
};

export type ChatOptions = {
  /** Override the default model (e.g. Haiku for group mode) */
  model?: string;
  maxOutputTokens?: number;
  maxToolRounds?: number;
  requestTimeoutMs?: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const MAX_OUTPUT_TOKENS = parsePositiveInt(process.env.PROTEUS_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS);
const MAX_RESPONSE_CHARS = parsePositiveInt(process.env.PROTEUS_MAX_RESPONSE_CHARS, DEFAULT_MAX_RESPONSE_CHARS);
const MAX_TOOL_ROUNDS = parsePositiveInt(process.env.PROTEUS_MAX_TOOL_ROUNDS, DEFAULT_MAX_TOOL_ROUNDS);
const CLAUDE_REQUEST_TIMEOUT_MS = parsePositiveInt(
  process.env.PROTEUS_REQUEST_TIMEOUT_MS,
  CLAUDE_TIMEOUT_MS,
);

function summarizeToolResult(result: string, maxChars = 120): string {
  const compact = result.replace(/\s+/g, " ").trim();
  if (!compact) return "no data";
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars)}...`;
}

function clampResponseText(text: string, maxChars: number): string {
  const normalized = (text || "").trim();
  if (!normalized) return "No response generated.";
  if (normalized.length <= maxChars) return normalized;
  const note = "\n\n[Response truncated to keep Telegram delivery fast. Ask me to continue if needed.]";
  const budget = Math.max(300, maxChars - note.length);
  return `${normalized.slice(0, budget).trimEnd()}${note}`;
}

function buildChatResponse(lastText: string, toolsUsed: string[]): ChatResponse {
  const displayText = clampResponseText(lastText || "No response generated.", MAX_RESPONSE_CHARS);
  if (!toolsUsed.length) {
    return { displayText, persistText: clampResponseText(displayText, MAX_PERSIST_CHARS) };
  }

  const capped = toolsUsed.slice(0, 6);
  const overflow = toolsUsed.length > 6 ? `; +${toolsUsed.length - 6} more` : "";
  const toolNote = `\n\n[Tools used: ${capped.join("; ")}${overflow}]`;
  const persistText = clampResponseText(`${displayText}${toolNote}`, MAX_PERSIST_CHARS);
  return {
    displayText,
    persistText,
  };
}

function extractTextFromContent(content: Anthropic.Message["content"]): string {
  const blocks = content as unknown as Array<Record<string, unknown>>;
  return blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => String(block.text))
    .join("\n")
    .trim();
}

function extractToolUseBlocks(content: Anthropic.Message["content"]): Array<Record<string, unknown>> {
  const blocks = content as unknown as Array<Record<string, unknown>>;
  return blocks.filter((block) => block.type === "tool_use");
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Anthropic.RateLimitError) return true;
  if (error instanceof Anthropic.InternalServerError) return true;
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.APIError && error.status === 529) return true;

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("socket hang up")
    ) {
      return true;
    }
  }

  return false;
}

async function callClaudeWithRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxRetries = 2,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await client.messages.create(params);
    } catch (error) {
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      const delay = (attempt + 1) * 2_000;
      console.warn(
        `[proteus] API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
        error instanceof Error ? error.message : String(error),
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Unreachable");
}

async function forceFinalTextWithoutTools(
  model: string,
  maxOutputTokens: number,
  requestTimeoutMs: number,
  systemParam: string | Anthropic.TextBlockParam[],
  transcript: Anthropic.MessageParam[],
): Promise<string> {
  const finalizeInstruction: Anthropic.MessageParam = {
    role: "user",
    content:
      "Tool phase is complete. Respond to Freedom now with your final answer in plain text. Do not call tools.",
  };

  const response = await withTimeout(
    callClaudeWithRetry({
      model,
      max_tokens: maxOutputTokens,
      system: systemParam,
      messages: [...transcript, finalizeInstruction],
    }),
    requestTimeoutMs,
    "Claude finalization call",
  );

  return extractTextFromContent(response.content);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Build the `system` parameter for the Anthropic API.
 * When given structured parts, applies cache_control to the static portion
 * so Anthropic caches it across calls (90% cost reduction on cache hits).
 * Falls back to a plain string for simple cases (e.g. group mode).
 */
function buildSystemParam(
  prompt: SystemPromptParts | string,
): string | Anthropic.TextBlockParam[] {
  if (typeof prompt === "string") {
    return prompt;
  }

  const blocks: Anthropic.TextBlockParam[] = [];

  if (prompt.staticPart) {
    blocks.push({
      type: "text" as const,
      text: prompt.staticPart,
      cache_control: { type: "ephemeral" as const },
    });
  }

  if (prompt.dynamicPart) {
    blocks.push({
      type: "text" as const,
      text: prompt.dynamicPart,
    });
  }

  return blocks.length ? blocks : "";
}

export async function chat(
  systemPrompt: SystemPromptParts | string,
  messages: ChatMessage[],
  tools: Anthropic.Tool[],
  typingFn?: () => Promise<unknown>,
  options?: ChatOptions,
): Promise<ChatResponse> {
  const transcript = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  })) as Anthropic.MessageParam[];

  const systemParam = buildSystemParam(systemPrompt);
  const model = options?.model || config.models.proteus;
  const maxOutputTokens = options?.maxOutputTokens && options.maxOutputTokens > 0
    ? Math.floor(options.maxOutputTokens)
    : MAX_OUTPUT_TOKENS;
  const maxToolRounds = options?.maxToolRounds && options.maxToolRounds > 0
    ? Math.floor(options.maxToolRounds)
    : MAX_TOOL_ROUNDS;
  const requestTimeoutMs = options?.requestTimeoutMs && options.requestTimeoutMs > 0
    ? Math.floor(options.requestTimeoutMs)
    : CLAUDE_REQUEST_TIMEOUT_MS;

  let typingInterval: NodeJS.Timeout | null = null;
  if (typingFn) {
    await typingFn().catch(() => undefined);
    typingInterval = setInterval(() => {
      typingFn().catch(() => undefined);
    }, TYPING_KEEPALIVE_MS);
    typingInterval.unref();
  }

  let lastText = "";
  const toolsUsed: string[] = [];
  const toolsEnabled = tools.length > 0;
  const roundLimit = toolsEnabled ? maxToolRounds : 1;

  try {
    for (let round = 0; round < roundLimit; round += 1) {
      const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: maxOutputTokens,
        system: systemParam,
        messages: transcript,
        ...(toolsEnabled ? { tools } : {}),
      };
      const response = await withTimeout(
        callClaudeWithRetry(requestParams),
        requestTimeoutMs,
        "Claude API call",
      );

      const roundText = extractTextFromContent(response.content);
      if (roundText) {
        lastText = roundText;
      }

      const rawToolUses = extractToolUseBlocks(response.content);
      if (!rawToolUses.length) {
        return buildChatResponse(lastText, toolsUsed);
      }
      const toolUses = rawToolUses.filter(
        (block) =>
          typeof block.id === "string" &&
          block.id.trim().length > 0 &&
          typeof block.name === "string" &&
          block.name.trim().length > 0,
      );
      if (!toolUses.length) {
        return buildChatResponse(
          lastText || "I hit a tool formatting issue and returned without tool execution.",
          toolsUsed,
        );
      }

      transcript.push({
        role: "assistant",
        content: response.content as Anthropic.ContentBlock[],
      });

      const toolSettled = await Promise.allSettled(
        toolUses.map(async (toolUse) => {
          const id = String(toolUse.id ?? "");
          const name = String(toolUse.name ?? "");
          const input = (toolUse.input ?? {}) as Record<string, unknown>;
          const result = await withTimeout(
            handleToolCall(name, input),
            TOOL_TIMEOUT_MS,
            `Tool ${name}`,
          );
          return { id, name, result };
        }),
      );

      const toolExecutions = toolSettled.map((settled, idx) => {
        if (settled.status === "fulfilled") return settled.value;
        const toolUse = toolUses[idx];
        return {
          id: String(toolUse.id ?? ""),
          name: String(toolUse.name ?? "unknown"),
          result: `Tool error: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
        };
      });

      for (const execution of toolExecutions) {
        const summary = summarizeToolResult(execution.result);
        toolsUsed.push(`${execution.name} -> ${summary}`);
      }

      const toolResultBlocks = toolExecutions.map((execution) => ({
        type: "tool_result",
        tool_use_id: execution.id,
        content: execution.result,
      }));

      transcript.push({
        role: "user",
        content: toolResultBlocks as unknown as Anthropic.ContentBlockParam[],
      });
    }

    if (toolsEnabled) {
      try {
        const finalized = await forceFinalTextWithoutTools(
          model,
          maxOutputTokens,
          requestTimeoutMs,
          systemParam,
          transcript,
        );
        if (finalized) {
          return buildChatResponse(finalized, toolsUsed);
        }
      } catch (error) {
        console.warn("[proteus] finalization after tool rounds failed:", error);
      }
    }

    return buildChatResponse(
      lastText || "I hit an internal tool loop, but your request is saved. Send 'continue' and I will finish directly.",
      toolsUsed,
    );
  } finally {
    if (typingInterval) {
      clearInterval(typingInterval);
    }
  }
}
