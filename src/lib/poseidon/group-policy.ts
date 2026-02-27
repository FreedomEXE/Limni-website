/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: group-policy.ts
 *
 * Description:
 * Information exposure rules for Proteus group mode. Controls which tools
 * are available, detects when Freedom asks restricted questions in group,
 * and provides the filtered tool definition subset for group conversations.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/poseidon/config";
import { toolDefinitions } from "@/lib/poseidon/tools";

/**
 * Tools allowed in group mode. Only market-facing, public-data tools.
 * No account data, no bot internals, no session state, no behavior flags.
 */
const GROUP_ALLOWED_TOOL_NAMES = new Set([
  "get_live_prices",
  "get_liquidation_heatmap",
  "get_market_snapshot",
  "get_weekly_bias",
]);

/**
 * Group-specific tools (defined here, handled in tools.ts).
 */
const GROUP_ONLY_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_group_context",
    description:
      "Read the current group discussion context — active topics, notable contributions, running themes, and tracked predictions.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "update_group_context",
    description:
      "Update the group active context with new topics, contributions, or predictions being tracked.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string" as const,
          description: "Markdown content for the group context update.",
        },
      },
      required: ["content"],
    },
  },
];

/**
 * Returns the filtered tool set for group mode conversations.
 */
export function getGroupToolDefinitions(): Anthropic.Tool[] {
  const fromPrivate = toolDefinitions.filter((tool) =>
    GROUP_ALLOWED_TOOL_NAMES.has(tool.name),
  );
  return [...fromPrivate, ...GROUP_ONLY_TOOLS];
}

/**
 * Returns true if the sender is Freedom (the bot owner).
 */
export function isOwnerInGroup(telegramUserId: number): boolean {
  return telegramUserId === config.telegram.ownerId;
}

/**
 * Detects if a message is asking for restricted/private data that should
 * not be answered in the group. Used to trigger the DM redirect flow.
 */
const RESTRICTED_PATTERNS = [
  /\b(pnl|p&l|profit|loss|balance|equity)\b/i,
  /\b(account|position|entry|exit)\s*(size|price|detail)/i,
  /\bmy\s+(trades?|positions?|portfolio|account)/i,
  /\b(api|key|secret|credential|password)\b/i,
  /\b(strategy|config|parameter|setting)\s*(detail|value|number)/i,
  /\b(prop\s*firm|fxify|5ers)\s*(account|number|balance)/i,
  /\b(mt5|metatrader)\s*(account|balance|equity)/i,
  /\b(bot\s*(state|config|status)|system\s*health)\b/i,
];

export function isRestrictedQuery(text: string): boolean {
  return RESTRICTED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Returns true if a tool name is allowed in group mode.
 */
export function isGroupAllowedTool(toolName: string): boolean {
  return (
    GROUP_ALLOWED_TOOL_NAMES.has(toolName) ||
    toolName === "get_group_context" ||
    toolName === "update_group_context"
  );
}
