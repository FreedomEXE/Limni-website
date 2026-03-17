import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

export type SessionName = "ASIA" | "LONDON" | "NY";

export const SESSION_WINDOWS_UTC: Record<SessionName, { startHour: number; endHour: number; label: string }> = {
  ASIA: { startHour: 0, endHour: 8, label: "00:00-08:00 UTC" },
  LONDON: { startHour: 8, endHour: 13, label: "08:00-13:00 UTC" },
  NY: { startHour: 13, endHour: 21, label: "13:00-21:00 UTC" },
};

const ALL_SESSIONS: SessionName[] = ["ASIA", "LONDON", "NY"];

export const SESSION_ELIGIBILITY = new Map<string, SessionName[]>();

function registerAll(assetClass: AssetClass) {
  for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
    SESSION_ELIGIBILITY.set(pairDef.pair.trim().toUpperCase(), [...ALL_SESSIONS]);
  }
}

registerAll("fx");
registerAll("crypto");

SESSION_ELIGIBILITY.set("XAUUSD", ["LONDON", "NY"]);
SESSION_ELIGIBILITY.set("XAGUSD", ["LONDON", "NY"]);
SESSION_ELIGIBILITY.set("WTIUSD", ["LONDON", "NY"]);

SESSION_ELIGIBILITY.set("NIKKEIUSD", ["ASIA", "LONDON"]);
SESSION_ELIGIBILITY.set("SPXUSD", ["NY"]);
SESSION_ELIGIBILITY.set("NDXUSD", ["NY"]);

export function sessionForUtcHour(hourUtc: number): SessionName | null {
  if (hourUtc >= SESSION_WINDOWS_UTC.ASIA.startHour && hourUtc < SESSION_WINDOWS_UTC.ASIA.endHour) {
    return "ASIA";
  }
  if (hourUtc >= SESSION_WINDOWS_UTC.LONDON.startHour && hourUtc < SESSION_WINDOWS_UTC.LONDON.endHour) {
    return "LONDON";
  }
  if (hourUtc >= SESSION_WINDOWS_UTC.NY.startHour && hourUtc < SESSION_WINDOWS_UTC.NY.endHour) {
    return "NY";
  }
  return null;
}

export function defaultSessionFromUtcDate(nowUtc: Date): SessionName {
  const active = sessionForUtcHour(nowUtc.getUTCHours());
  return active ?? "ASIA";
}

