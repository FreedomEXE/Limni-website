/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: config.ts
 *
 * Description:
 * Centralized runtime configuration for Poseidon Phase 1, including
 * Telegram, Anthropic model settings, database connection references,
 * and local memory/state paths.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parseInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer for ${name}: ${value}`);
  }
  return parsed;
}

export const config = {
  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    ownerId: parseInteger(requireEnv("TELEGRAM_OWNER_ID"), "TELEGRAM_OWNER_ID"),
  },
  anthropic: {
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
  },
  models: {
    proteus: process.env.PROTEUS_MODEL?.trim() || "claude-sonnet-4-5-20250929",
  },
  db: {
    connectionString: requireEnv("DATABASE_URL"),
  },
  maxConversationHistory: parseInteger(
    process.env.MAX_CONVERSATION_HISTORY?.trim() || "50",
    "MAX_CONVERSATION_HISTORY",
  ),
  memoryDir: process.env.POSEIDON_MEMORY_DIR?.trim() || "./docs/ai/poseidon/memory",
  stateDir: process.env.POSEIDON_STATE_DIR?.trim() || "./docs/ai/poseidon/state",
} as const;

export type PoseidonBehaviorKey =
  | "alertsEnabled"
  | "milestoneAlerts"
  | "biasAlerts"
  | "errorAlerts"
  | "verboseMode";

