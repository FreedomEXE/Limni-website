/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: behavior.ts
 *
 * Description:
 * Runtime behavior flag storage for Poseidon, persisted to the database
 * (poseidon_kv table) and used by tools/commands to toggle alert and
 * verbosity behavior safely across restarts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { kvGet, kvSet } from "@/lib/poseidon/state-db";
import type { PoseidonBehaviorKey } from "@/lib/poseidon/config";

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

const KV_KEY = "behavior";
let loaded = false;
let behaviorState: BehaviorState = { ...defaultBehavior };

async function saveBehavior() {
  await kvSet(KV_KEY, JSON.stringify(behaviorState));
}

export async function loadBehavior(): Promise<BehaviorState> {
  if (loaded) return behaviorState;
  loaded = true;
  try {
    const raw = await kvGet(KV_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BehaviorState>;
      behaviorState = {
        ...defaultBehavior,
        ...parsed,
      };
    }
    console.log("[poseidon.behavior] Loaded behavior from DB");
  } catch (error) {
    console.error("[poseidon.behavior] Failed to load from DB:", error);
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
