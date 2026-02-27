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

const client = new Anthropic({ apiKey: config.anthropic.apiKey });
const MAX_TOOL_ROUNDS = 5;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  displayText: string;
  persistText: string;
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

export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  tools: Anthropic.Tool[],
): Promise<ChatResponse> {
  const transcript = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  })) as Anthropic.MessageParam[];

  let lastText = "";
  const toolsUsed: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await client.messages.create({
      model: config.models.proteus,
      max_tokens: 2048,
      system: systemPrompt,
      messages: transcript,
      tools,
    });

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

    const toolExecutions = await Promise.all(
      toolUses.map(async (toolUse) => {
        const id = String(toolUse.id ?? "");
        const name = String(toolUse.name ?? "");
        const input = (toolUse.input ?? {}) as Record<string, unknown>;
        const result = await handleToolCall(name, input);
        return {
          id,
          name,
          result,
        };
      }),
    );

    for (const execution of toolExecutions) {
      const summary = summarizeToolResult(execution.result);
      toolsUsed.push(`${execution.name} -> ${summary}`);
    }

    const toolResultBlocks = toolExecutions.map((execution) => {
      return {
        type: "tool_result",
        tool_use_id: execution.id,
        content: execution.result,
      };
    });

    transcript.push({
      role: "user",
      content: toolResultBlocks as unknown as Anthropic.ContentBlockParam[],
    });
  }

  return buildChatResponse(
    lastText || "I reached the tool-use limit before finishing your request.",
    toolsUsed,
  );
}
