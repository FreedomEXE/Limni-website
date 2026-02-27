/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: curation-flag.ts
 *
 * Description:
 * Stores and reads curation request flags raised by memory pressure checks.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/poseidon/config";

export type CurationFlag = {
  requested: boolean;
  reason: string;
  setAt: string;
};

const FLAG_PATH = path.resolve(process.cwd(), config.stateDir, "curation_flag.json");

function defaultFlag(): CurationFlag {
  return {
    requested: false,
    reason: "",
    setAt: "",
  };
}

async function ensureDir(): Promise<void> {
  await mkdir(path.dirname(FLAG_PATH), { recursive: true });
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
  await ensureDir();
  try {
    const raw = await readFile(FLAG_PATH, "utf8");
    return asFlag(JSON.parse(raw));
  } catch {
    return defaultFlag();
  }
}

export async function writeCurationFlag(flag: CurationFlag): Promise<void> {
  await ensureDir();
  await writeFile(FLAG_PATH, JSON.stringify(flag, null, 2), "utf8");
}

export async function resetCurationFlag(): Promise<void> {
  await writeCurationFlag(defaultFlag());
}
