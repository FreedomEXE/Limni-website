import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { getRepoRoot } from "@/lib/server/repoPaths";

const ROOT_ENV_FILENAMES = [".env.local", ".env"];
const ROOT_ENV_EXCLUDED_KEYS = new Set(["AUTH_BYPASS"]);

let loaded = false;

function parseEnvValue(rawValue: string) {
  const trimmed = rawValue.trim();
  const quoted =
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  return quoted ? trimmed.slice(1, -1) : trimmed;
}

export function ensureRootServerEnvLoaded() {
  if (loaded) return;

  for (const filename of ROOT_ENV_FILENAMES) {
    const candidate = path.join(getRepoRoot(), filename);
    if (!existsSync(candidate)) continue;

    const lines = readFileSync(candidate, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*(?:export\s+)?([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      const key = match[1].trim();
      if (ROOT_ENV_EXCLUDED_KEYS.has(key) || process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = parseEnvValue(match[2]);
    }
  }

  loaded = true;
}

export function rootServerEnv(key: string) {
  ensureRootServerEnvLoaded();
  return process.env[key];
}
