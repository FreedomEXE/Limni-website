/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: behavior.ts
 *
 * Description:
 * Runtime behavior flag storage for Poseidon, persisted to local JSON and
 * used by tools/commands to toggle alert and verbosity behavior safely.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoseidonBehaviorKey } from "@/lib/poseidon/config";
import { config } from "@/lib/poseidon/config";

export type BehaviorState = {
  alertsEnabled: boolean;
  milestoneAlerts: boolean;
  biasAlerts: boolean;
  errorAlerts: boolean;
  verboseMode: boolean;
};

const defaultBehavior: BehaviorState = {
  alertsEnabled: true,
  milestoneAlerts: true,
  biasAlerts: true,
  errorAlerts: true,
  verboseMode: false,
};

const behaviorPath = path.resolve(process.cwd(), config.stateDir, "behavior.json");
let loaded = false;
let behaviorState: BehaviorState = { ...defaultBehavior };

async function ensureStateDir() {
  await mkdir(path.dirname(behaviorPath), { recursive: true });
}

async function saveBehavior() {
  await ensureStateDir();
  await writeFile(behaviorPath, JSON.stringify(behaviorState, null, 2), "utf8");
}

export async function loadBehavior(): Promise<BehaviorState> {
  if (loaded) return behaviorState;
  loaded = true;
  await ensureStateDir();
  try {
    const raw = await readFile(behaviorPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<BehaviorState>;
    behaviorState = {
      ...defaultBehavior,
      ...parsed,
    };
  } catch {
    behaviorState = { ...defaultBehavior };
    await saveBehavior();
  }
  return behaviorState;
}

export async function getBehavior(): Promise<BehaviorState> {
  await loadBehavior();
  return { ...behaviorState };
}

export async function setBehavior(flag: PoseidonBehaviorKey, value: boolean): Promise<BehaviorState> {
  await loadBehavior();
  behaviorState = {
    ...behaviorState,
    [flag]: value,
  };
  await saveBehavior();
  return { ...behaviorState };
}

