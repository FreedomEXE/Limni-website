/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: curation-flag.ts
 *
 * Description:
 * Stores and reads curation request flags raised by memory pressure checks.
 * Persisted to database (poseidon_kv table) for deploy safety.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { kvGet, kvSet } from "@/lib/poseidon/state-db";

export type CurationFlag = {
  requested: boolean;
  reason: string;
  setAt: string;
};

const KV_KEY = "curation_flag";

function defaultFlag(): CurationFlag {
  return {
    requested: false,
    reason: "",
    setAt: "",
  };
}

function asFlag(raw: unknown): CurationFlag {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultFlag();
  }

  const row = raw as Record<string, unknown>;
  return {
    requested: Boolean(row.requested),
    reason: typeof row.reason === "string" ? row.reason : "",
    setAt: typeof row.setAt === "string" ? row.setAt : "",
  };
}

export async function readCurationFlag(): Promise<CurationFlag> {
  try {
    const raw = await kvGet(KV_KEY);
    if (!raw) return defaultFlag();
    return asFlag(JSON.parse(raw));
  } catch {
    return defaultFlag();
  }
}

export async function writeCurationFlag(flag: CurationFlag): Promise<void> {
  await kvSet(KV_KEY, JSON.stringify(flag));
}

export async function resetCurationFlag(): Promise<void> {
  await writeCurationFlag(defaultFlag());
}
