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

export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  tools: Anthropic.Tool[],
): Promise<string> {
  const transcript = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  })) as Anthropic.MessageParam[];

  let lastText = "";

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
      return lastText || "No response generated.";
    }

    transcript.push({
      role: "assistant",
      content: response.content as Anthropic.ContentBlock[],
    });

    const toolResultBlocks = await Promise.all(
      toolUses.map(async (toolUse) => {
        const id = String(toolUse.id ?? "");
        const name = String(toolUse.name ?? "");
        const input = (toolUse.input ?? {}) as Record<string, unknown>;
        const result = await handleToolCall(name, input);
        return {
          type: "tool_result",
          tool_use_id: id,
          content: result,
        };
      }),
    );

    transcript.push({
      role: "user",
      content: toolResultBlocks as unknown as Anthropic.ContentBlockParam[],
    });
  }

  return lastText || "I reached the tool-use limit before finishing your request.";
}
