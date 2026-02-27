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
const MAX_TOOL_ROUNDS = 3;
const CLAUDE_TIMEOUT_MS = 90_000;
const TOOL_TIMEOUT_MS = 15_000;
const TYPING_KEEPALIVE_MS = 4_000;

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
};

function summarizeToolResult(result: string, maxChars = 120): string {
  const compact = result.replace(/\s+/g, " ").trim();
  if (!compact) return "no data";
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars)}...`;
}

function buildChatResponse(lastText: string, toolsUsed: string[]): ChatResponse {
  const displayText = lastText || "No response generated.";
  if (!toolsUsed.length) {
    return { displayText, persistText: displayText };
  }

  const capped = toolsUsed.slice(0, 6);
  const overflow = toolsUsed.length > 6 ? `; +${toolsUsed.length - 6} more` : "";
  const toolNote = `\n\n[Tools used: ${capped.join("; ")}${overflow}]`;
  return {
    displayText,
    persistText: `${displayText}${toolNote}`,
  };
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

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const response = await withTimeout(
        callClaudeWithRetry({
          model,
          max_tokens: 4096,
          system: systemParam,
          messages: transcript,
          tools,
        }),
        CLAUDE_TIMEOUT_MS,
        "Claude API call",
      );

      const blocks = response.content as unknown as Array<Record<string, unknown>>;
      const textBlocks = blocks
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => String(block.text));
      if (textBlocks.length) {
        lastText = textBlocks.join("\n").trim();
      }

      const toolUses = blocks.filter((block) => block.type === "tool_use");
      if (!toolUses.length) {
        return buildChatResponse(lastText, toolsUsed);
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

    return buildChatResponse(
      lastText || "I reached the tool-use limit before finishing your request.",
      toolsUsed,
    );
  } finally {
    if (typingInterval) {
      clearInterval(typingInterval);
    }
  }
}
