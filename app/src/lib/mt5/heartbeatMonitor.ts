/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: heartbeatMonitor.ts
 *
 * Description:
 * MT5 heartbeat liveness utility for monitoring and alerting layers.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readStaleAccounts, type Mt5StaleAccount } from "@/lib/mt5Store";

export type StaleHeartbeatRecord = {
  account_id: string;
  last_heartbeat: string;
  minutes_stale: number;
};

function toRecord(row: Mt5StaleAccount): StaleHeartbeatRecord {
  return {
    account_id: row.account_id,
    last_heartbeat: row.last_heartbeat,
    minutes_stale: row.minutes_stale,
  };
}

export async function checkStaleHeartbeats(thresholdMinutes: number): Promise<StaleHeartbeatRecord[]> {
  const stale = await readStaleAccounts(thresholdMinutes);
  return stale.map(toRecord);
}
