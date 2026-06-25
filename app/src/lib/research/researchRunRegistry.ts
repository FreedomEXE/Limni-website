import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sha256Stable } from "@/lib/research/hash";

export type ResearchRunRegistryStatus =
  | "exploratory"
  | "diagnostic"
  | "blocked"
  | "accepted"
  | "superseded"
  | "archived";

export type ResearchRunDuplicateKey = {
  input_manifest_hash: string;
  price_bundle_id: string;
  feature_bundle_id: string | null;
  source_context_ids: string[];
  evaluator_version: string;
  evaluators: string[];
  path_resolution: string;
  config_hash: string;
};

export type ResearchRunRegistryEntry = {
  schema_version: 1;
  run_id: string;
  gate_id: string;
  hypothesis_id: string;
  command: string;
  git_commit: string;
  input_manifest_hash: string;
  price_bundle_id: string;
  feature_bundle_id: string | null;
  source_context_ids: string[];
  evaluator_version: string;
  evaluators: string[];
  path_resolution: string;
  config_hash: string;
  output_result_hash: string;
  receipt_hash: string;
  status: ResearchRunRegistryStatus;
  supersedes?: string[];
  superseded_by?: string | null;
  rerun_reason?: string | null;
  equivalence_key_hash: string;
  manifest_path: string;
  result_path: string;
  receipt_path: string;
  hashes_path: string;
  created_at_utc: string;
};

export function buildResearchRunEquivalenceKey(input: ResearchRunDuplicateKey) {
  return {
    ...input,
    input_manifest_hash: input.input_manifest_hash.toUpperCase(),
    source_context_ids: [...input.source_context_ids].sort(),
    evaluators: [...input.evaluators].sort(),
    config_hash: input.config_hash.toUpperCase(),
  };
}

export function hashResearchRunEquivalenceKey(input: ResearchRunDuplicateKey) {
  return sha256Stable(buildResearchRunEquivalenceKey(input));
}

export async function readResearchRunRegistry(registryPath: string): Promise<ResearchRunRegistryEntry[]> {
  let raw = "";
  try {
    raw = await readFile(registryPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const entries: ResearchRunRegistryEntry[] = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as ResearchRunRegistryEntry);
    } catch (error) {
      throw new Error(`Invalid research registry JSONL at ${registryPath}:${index + 1}: ${(error as Error).message}`);
    }
  }
  return entries;
}

export function findEquivalentResearchRun(
  entries: ResearchRunRegistryEntry[],
  key: ResearchRunDuplicateKey,
) {
  const hash = hashResearchRunEquivalenceKey(key);
  return entries.find((entry) =>
    entry.equivalence_key_hash === hash &&
    entry.status !== "blocked" &&
    entry.status !== "superseded" &&
    entry.status !== "archived"
  ) ?? null;
}

export async function appendResearchRunRegistryEntry(
  registryPath: string,
  entry: ResearchRunRegistryEntry,
) {
  await mkdir(path.dirname(registryPath), { recursive: true });
  const existing = await readResearchRunRegistry(registryPath);
  if (existing.some((row) => row.run_id === entry.run_id)) {
    throw new Error(`Research run registry already contains run_id ${entry.run_id}.`);
  }
  const next = [...existing, entry].map((row) => JSON.stringify(row)).join("\n");
  await writeFile(registryPath, `${next}\n`, "utf8");
}
