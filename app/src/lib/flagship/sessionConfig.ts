import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

export type SessionName = "ASIA" | "LONDON" | "NY";

export const SESSION_WINDOWS_UTC: Record<SessionName, { startHour: number; endHour: number }> = {
  ASIA: { startHour: 0, endHour: 8 },
  LONDON: { startHour: 8, endHour: 13 },
  NY: { startHour: 13, endHour: 21 },
};

const ALL_SESSIONS: SessionName[] = ["ASIA", "LONDON", "NY"];
const ASIA_CURRENCIES = new Set(["AUD", "NZD", "JPY"]);
const LONDON_CURRENCIES = new Set(["EUR", "GBP", "CHF"]);
const NY_CURRENCIES = new Set(["USD", "CAD"]);

export const SESSION_ELIGIBILITY = new Map<string, SessionName[]>();

function registerAll(assetClass: AssetClass) {
  for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
    SESSION_ELIGIBILITY.set(pairDef.pair.trim().toUpperCase(), [...ALL_SESSIONS]);
  }
}

function deriveFxSessions(base: string, quote: string): SessionName[] {
  const currencies = [base.toUpperCase(), quote.toUpperCase()];
  const hasAsia = currencies.some((currency) => ASIA_CURRENCIES.has(currency));
  const hasLondon = currencies.some((currency) => LONDON_CURRENCIES.has(currency));
  const hasNy = currencies.some((currency) => NY_CURRENCIES.has(currency));

  const sessions = new Set<SessionName>();

  if (hasAsia) sessions.add("ASIA");
  if (hasLondon) sessions.add("LONDON");
  if (hasNy) sessions.add("NY");

  // Ensure every pair stays tradable in at least one session.
  if (sessions.size === 0) sessions.add("LONDON");

  return Array.from(sessions);
}

for (const pairDef of PAIRS_BY_ASSET_CLASS.fx) {
  SESSION_ELIGIBILITY.set(
    pairDef.pair.trim().toUpperCase(),
    deriveFxSessions(pairDef.base, pairDef.quote),
  );
}

registerAll("crypto");

SESSION_ELIGIBILITY.set("XAUUSD", [...ALL_SESSIONS]);
SESSION_ELIGIBILITY.set("XAGUSD", [...ALL_SESSIONS]);
SESSION_ELIGIBILITY.set("WTIUSD", [...ALL_SESSIONS]);

SESSION_ELIGIBILITY.set("NIKKEIUSD", ["ASIA"]);
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

function formatEtHour(dateUtc: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(dateUtc);
}

export function sessionWindowLabelEt(session: SessionName, referenceUtc: Date = new Date()): string {
  const window = SESSION_WINDOWS_UTC[session];
  const startUtc = new Date(
    Date.UTC(
      referenceUtc.getUTCFullYear(),
      referenceUtc.getUTCMonth(),
      referenceUtc.getUTCDate(),
      window.startHour,
      0,
      0,
      0,
    ),
  );
  const endUtc = new Date(
    Date.UTC(
      referenceUtc.getUTCFullYear(),
      referenceUtc.getUTCMonth(),
      referenceUtc.getUTCDate(),
      window.endHour,
      0,
      0,
      0,
    ),
  );

  return `${formatEtHour(startUtc)}-${formatEtHour(endUtc)} ET`;
}
