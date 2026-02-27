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

function optionalInt(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
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
    nereus: process.env.NEREUS_MODEL?.trim() || "claude-haiku-4-5-20251001",
    poseidon: process.env.POSEIDON_MODEL?.trim() || "claude-opus-4-20250918",
  },
  db: {
    connectionString: requireEnv("DATABASE_URL"),
  },
  group: {
    enabled: process.env.PROTEUS_GROUP_ENABLED?.trim()?.toLowerCase() === "true",
    groupId: optionalInt("TELEGRAM_GROUP_ID"),
    maxContextChars: 4_000,
    scoringIntervalHours: 6,
    interjectionCooldownMs: 5 * 60_000,
    maxGroupHistory: 200,
  },
  maxConversationHistory: parseInteger(
    process.env.MAX_CONVERSATION_HISTORY?.trim() || "20",
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

