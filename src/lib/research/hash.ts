import { createHash } from "node:crypto";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, stableValue(val)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function hashResearchConfig(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
