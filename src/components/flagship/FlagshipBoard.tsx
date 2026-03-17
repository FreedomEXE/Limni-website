/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: FlagshipBoard.tsx
 *
 * Description:
 * Session-aware flagship board for manual execution.
 * Loads gated setups, applies strict overlay checks,
 * ranks conviction, and highlights the top setup.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDateTimeET } from "@/lib/time";

type GateDecision = "PASS" | "SKIP" | "NO_DATA";
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type SessionName = "ASIA" | "LONDON" | "NY" | "OFF";

type GatedSetupSignal = {
  assetClass: string;
  pair: string;
  dealer: string;
  commercial: string;
  sentiment: string;
  direction: SignalDirection;
  tier: SignalTier;
  gateDecision: GateDecision;
  gateReasons: string[];
  basePct: number | null;
  quotePct: number | null;
  actionable8w: number;
  flips8w: number;
  consistency8w: number;
  gateDecisionSource?: string;
  gateAsOfUtc?: string | null;
};

type GatedSetupsPayload = {
  sourcePath: string;
  generatedUtc: string | null;
  currentWeekOpenUtc: string | null;
  weeksUsedForStability: string[];
  summary: {
    total: number;
    pass: number;
    skip: number;
    noData: number;
    actionable: number;
    highTier: number;
    mediumTier: number;
    neutralTier: number;
  };
  signals: GatedSetupSignal[];
  skipOnlyMode: boolean;
};

type PairSummary = {
  winRatePct: number;
  cumulativePnlPct: number;
  maxDrawdownPct: number;
  pricedTrades: number;
};

type ProcessedSignal = {
  signal: GatedSetupSignal;
  score: number;
  notes: string[];
  strictPassed: boolean;
  effectiveDecision: "PASS" | "SKIP";
  effectiveReasons: string[];
  maxLeverage: number;
  sessionEligible: boolean;
  sessionTags: SessionName[];
  freshnessLabel: string;
};

type DroppedRow = {
  pair: string;
  reason: string;
};

type CurrencyStrengthRow = {
  currency: string;
  raw: number;
  normalized: number;
};

type CurrencyStrengthWindowResult = {
  snapshotTimeUtc: string;
  window: "1h" | "4h" | "24h";
  strengths: CurrencyStrengthRow[];
};

type AssetStrengthSnapshotRow = {
  asset: string;
  raw: number;
  normalized: number;
};

type AssetStrengthWindowResult = {
  snapshotTimeUtc: string;
  assetClass: "crypto" | "commodities";
  window: "1h" | "4h" | "24h";
  strengths: AssetStrengthSnapshotRow[];
};

type DailySentimentDirection = "LONG" | "SHORT" | "NEUTRAL";

type DailySentimentRow = {
  snapshotDateUtc: string;
  snapshotTimeUtc: string;
  symbol: string;
  confidenceScore: number;
  crowdingState: string;
  flipState: string;
  sentimentDirection: DailySentimentDirection;
};

type DailySentimentPayload = {
  snapshotDateUtc: string | null;
  rows: DailySentimentRow[];
};

type MenthorqOverlayCondition = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";

type MenthorqOverlayRow = {
  snapshotDateUtc: string;
  symbol: string;
  gammaCondition: MenthorqOverlayCondition;
  capturedAtUtc: string | null;
  parseConfidence: "HIGH" | "MEDIUM" | "LOW" | null;
};

type MenthorqOverlayPayload = {
  snapshotDateUtc: string | null;
  rows: MenthorqOverlayRow[];
};

const ALLOWED_COMMODITIES = new Set(["XAUUSD", "XAGUSD"]);
const ALLOWED_CRYPTO = new Set(["BTCUSD", "ETHUSD"]);
const ALLOWED_INDICES = new Set(["SPXUSD", "NDXUSD", "NIKKEIUSD"]);
const SESSION_BLOCKS: Array<{ key: Exclude<SessionName, "OFF">; start: number; end: number; label: string }> = [
  { key: "ASIA", start: 0, end: 8, label: "Asia 00-08 UTC" },
  { key: "LONDON", start: 8, end: 13, label: "London 08-13 UTC" },
  { key: "NY", start: 13, end: 21, label: "NY 13-21 UTC" },
];

function toUpper(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeAsset(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isTradableBitget(signal: GatedSetupSignal) {
  if (signal.direction !== "LONG" && signal.direction !== "SHORT") return false;
  const asset = normalizeAsset(signal.assetClass);
  const pair = toUpper(signal.pair);
  if (asset === "fx") return true;
  if (asset === "commodities") return ALLOWED_COMMODITIES.has(pair);
  if (asset === "crypto") return ALLOWED_CRYPTO.has(pair);
  if (asset === "indices") return ALLOWED_INDICES.has(pair);
  return false;
}

function getMaxLeverage(signal: GatedSetupSignal) {
  const asset = normalizeAsset(signal.assetClass);
  if (asset === "fx") return 500;
  if (asset === "commodities") return 100;
  if (asset === "crypto") return 75;
  if (asset === "indices") return 100;
  return 0;
}

function getSession(nowUtc: Date): SessionName {
  const hour = nowUtc.getUTCHours();
  if (hour >= 0 && hour < 8) return "ASIA";
  if (hour >= 8 && hour < 13) return "LONDON";
  if (hour >= 13 && hour < 21) return "NY";
  return "OFF";
}

function sessionTagsForSignal(signal: GatedSetupSignal): SessionName[] {
  const asset = normalizeAsset(signal.assetClass);
  const pair = toUpper(signal.pair);

  // Crypto: eligible in all sessions (trades 24/7, no session concept)
  if (asset === "crypto") return ["ASIA", "LONDON", "NY"];

  // FX: eligible in all sessions (forex trades 24/5)
  if (asset === "fx") return ["ASIA", "LONDON", "NY"];

  // Commodities: London and NY only (metals less liquid in Asia)
  if (asset === "commodities") return ["LONDON", "NY"];

  // Indices: pair-specific
  if (asset === "indices") {
    if (pair === "NIKKEIUSD") return ["ASIA", "LONDON"];
    // SPXUSD, NDXUSD: NY only
    return ["NY"];
  }

  // Default fallback
  return ["LONDON", "NY"];
}

function applyStrictDecision(signal: GatedSetupSignal): {
  effectiveDecision: "PASS" | "SKIP";
  effectiveReasons: string[];
  strictPassed: boolean;
} {
  const source = String(signal.gateDecisionSource ?? "WEEKLY_BOARD").trim();
  const reasons = [...signal.gateReasons];
  const asset = normalizeAsset(signal.assetClass);

  if (signal.gateDecision === "NO_DATA") {
    reasons.push("SKIP_NO_DATA_(no_data)");
    return { effectiveDecision: "SKIP", effectiveReasons: reasons, strictPassed: false };
  }
  if (signal.gateDecision === "SKIP") {
    return { effectiveDecision: "SKIP", effectiveReasons: reasons, strictPassed: true };
  }

  if (asset === "crypto") {
    if (source !== "CRYPTO_LIQUIDATION_LIVE") {
      reasons.push("SKIP_INCOMPLETE_OVERLAY_DATA");
      return { effectiveDecision: "SKIP", effectiveReasons: reasons, strictPassed: false };
    }
    return { effectiveDecision: "PASS", effectiveReasons: reasons, strictPassed: true };
  }

  if (!source.includes("MENTHORQ")) {
    reasons.push("SKIP_INCOMPLETE_OVERLAY_DATA");
    return { effectiveDecision: "SKIP", effectiveReasons: reasons, strictPassed: false };
  }

  return { effectiveDecision: "PASS", effectiveReasons: reasons, strictPassed: true };
}

function scoreSignal(signal: GatedSetupSignal, pairSummary: PairSummary | null) {
  const notes: string[] = [];
  const tierWeight = signal.tier === "HIGH" ? 100 : signal.tier === "MEDIUM" ? 60 : 20;
  let score = tierWeight;
  score += signal.consistency8w * 30;
  score += Math.min(signal.actionable8w, 8) * 2;
  score -= Math.min(signal.flips8w, 8) * 3;

  if (pairSummary) {
    score += pairSummary.winRatePct * 0.2;
    score += pairSummary.cumulativePnlPct * 4;
    score -= pairSummary.maxDrawdownPct * 2;
    score += Math.min(pairSummary.pricedTrades, 12) * 0.5;
    notes.push(
      `backtest8w wr=${pairSummary.winRatePct.toFixed(2)} cum=${pairSummary.cumulativePnlPct.toFixed(4)} dd=${pairSummary.maxDrawdownPct.toFixed(4)} n=${pairSummary.pricedTrades}`,
    );
    if (pairSummary.pricedTrades < 4) {
      score -= 20;
      notes.push("small_sample_penalty");
    }
  } else {
    score -= 12;
    notes.push("no_pair_backtest_penalty");
  }

  const source = String(signal.gateDecisionSource ?? "WEEKLY_BOARD");
  if (signal.assetClass !== "crypto" && !source.includes("MENTHORQ")) {
    score -= 8;
    notes.push("no_live_gamma_overlay_penalty");
  }
  if (signal.assetClass === "crypto" && source !== "CRYPTO_LIQUIDATION_LIVE") {
    score -= 12;
    notes.push("no_live_liquidation_overlay_penalty");
  }

  return { score, notes };
}

function decisionPillClass(decision: "PASS" | "SKIP") {
  return decision === "PASS"
    ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
    : "border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

function directionClass(direction: SignalDirection) {
  if (direction === "LONG") return "text-emerald-600";
  if (direction === "SHORT") return "text-rose-600";
  return "text-[color:var(--muted)]";
}

function tierClass(tier: SignalTier) {
  if (tier === "HIGH") return "text-emerald-700";
  if (tier === "MEDIUM") return "text-amber-700";
  return "text-[color:var(--muted)]";
}

function menthorqConditionClass(condition: MenthorqOverlayCondition) {
  if (condition === "POSITIVE") return "text-emerald-600";
  if (condition === "NEGATIVE") return "text-rose-600";
  return "text-[color:var(--muted)]";
}

function buildDroppedRows(signals: ProcessedSignal[], activeSession: SessionName): DroppedRow[] {
  const rows: DroppedRow[] = [];
  for (const row of signals) {
    if (row.effectiveDecision === "SKIP" && !row.strictPassed) {
      rows.push({ pair: row.signal.pair, reason: "incomplete_overlay_data" });
      continue;
    }
    if (row.effectiveDecision === "SKIP" && row.signal.gateDecision === "NO_DATA") {
      rows.push({ pair: row.signal.pair, reason: "no_data" });
      continue;
    }
    if (activeSession !== "OFF" && row.effectiveDecision === "PASS" && !row.sessionEligible) {
      rows.push({ pair: row.signal.pair, reason: `not_${activeSession.toLowerCase()}_session_eligible` });
    }
  }
  return rows;
}

export default function FlagshipBoard({ strategy }: { strategy: string }) {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "research" ? "research" : "board";
  const [data, setData] = useState<GatedSetupsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strengthData, setStrengthData] = useState<CurrencyStrengthWindowResult[] | null>(null);
  const [strengthLoading, setStrengthLoading] = useState(true);
  const [assetStrengthData, setAssetStrengthData] = useState<AssetStrengthWindowResult[] | null>(null);
  const [assetStrengthLoading, setAssetStrengthLoading] = useState(true);
  const [dailySentiment, setDailySentiment] = useState<DailySentimentPayload | null>(null);
  const [dailySentimentLoading, setDailySentimentLoading] = useState(true);
  const [menthorqOverlay, setMenthorqOverlay] = useState<MenthorqOverlayPayload | null>(null);
  const [menthorqOverlayLoading, setMenthorqOverlayLoading] = useState(true);
  const [nowUtc, setNowUtc] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNowUtc(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/performance/gated-setups", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = (await response.json()) as GatedSetupsPayload & { error?: string };
        if (json.error) throw new Error(json.error);
        if (!cancelled) setData(json);
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchAssetStrength() {
      try {
        const response = await fetch("/api/flagship/asset-strength", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch asset strength");
        const json = (await response.json()) as { strengths?: AssetStrengthWindowResult[] };
        if (!cancelled) {
          setAssetStrengthData(Array.isArray(json.strengths) ? json.strengths : null);
        }
      } catch {
        if (!cancelled) setAssetStrengthData(null);
      } finally {
        if (!cancelled) setAssetStrengthLoading(false);
      }
    }
    fetchAssetStrength();
    const interval = window.setInterval(fetchAssetStrength, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchDailySentiment() {
      try {
        const response = await fetch("/api/flagship/sentiment-daily", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch daily sentiment lock");
        const json = (await response.json()) as DailySentimentPayload;
        if (!cancelled) setDailySentiment(json);
      } catch {
        if (!cancelled) setDailySentiment(null);
      } finally {
        if (!cancelled) setDailySentimentLoading(false);
      }
    }
    fetchDailySentiment();
    const interval = window.setInterval(fetchDailySentiment, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchMenthorqOverlay() {
      try {
        const response = await fetch("/api/flagship/menthorq-overlay", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch MenthorQ overlay");
        const json = (await response.json()) as MenthorqOverlayPayload;
        if (!cancelled) setMenthorqOverlay(json);
      } catch {
        if (!cancelled) setMenthorqOverlay(null);
      } finally {
        if (!cancelled) setMenthorqOverlayLoading(false);
      }
    }
    fetchMenthorqOverlay();
    const interval = window.setInterval(fetchMenthorqOverlay, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchStrength() {
      try {
        const response = await fetch("/api/flagship/currency-strength", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch currency strength");
        const json = (await response.json()) as { strengths?: CurrencyStrengthWindowResult[] };
        if (!cancelled) setStrengthData(Array.isArray(json.strengths) ? json.strengths : null);
      } catch {
        if (!cancelled) setStrengthData(null);
      } finally {
        if (!cancelled) setStrengthLoading(false);
      }
    }
    fetchStrength();
    const interval = window.setInterval(fetchStrength, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const currentSession = getSession(nowUtc);
  const processed = useMemo(() => {
    const rows = (data?.signals ?? []).filter(isTradableBitget);
    return rows
      .map((signal): ProcessedSignal => {
        const strict = applyStrictDecision(signal);
        const scored = scoreSignal(signal, null);
        const tags = sessionTagsForSignal(signal);
        const sessionEligible = currentSession === "OFF" ? true : tags.includes(currentSession);
        return {
          signal,
          score: scored.score,
          notes: scored.notes,
          strictPassed: strict.strictPassed,
          effectiveDecision: strict.effectiveDecision,
          effectiveReasons: strict.effectiveReasons,
          maxLeverage: getMaxLeverage(signal),
          sessionEligible,
          sessionTags: tags,
          freshnessLabel: formatDateTimeET(
            signal.gateAsOfUtc ?? data?.generatedUtc ?? null,
            "Unknown",
          ),
        };
      })
      .sort((a, b) => b.score - a.score || a.signal.pair.localeCompare(b.signal.pair));
  }, [currentSession, data]);

  const passRows = useMemo(
    () => processed.filter((row) => row.effectiveDecision === "PASS"),
    [processed],
  );
  const sessionPassRows = useMemo(() => {
    if (currentSession === "OFF") return passRows;
    return passRows.filter((row) => row.sessionEligible);
  }, [currentSession, passRows]);
  const topPick = sessionPassRows[0] ?? null;
  const droppedRows = useMemo(
    () => buildDroppedRows(processed, currentSession),
    [currentSession, processed],
  );
  const cryptoStrengths = useMemo(
    () => (assetStrengthData ?? []).filter((row) => row.assetClass === "crypto"),
    [assetStrengthData],
  );
  const commodityStrengths = useMemo(
    () => (assetStrengthData ?? []).filter((row) => row.assetClass === "commodities"),
    [assetStrengthData],
  );

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 md:p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Flagship Manual Board
            </p>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Session Decision Board</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Strategy: <span className="font-semibold text-[var(--foreground)]">{strategy}</span>
            </p>
          </div>
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-sm">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Active Session</div>
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {currentSession === "OFF" ? "OFF-HOURS (21-00 UTC)" : currentSession}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--panel-border)] p-2">
          {SESSION_BLOCKS.map((block) => {
            const active = currentSession === block.key;
            return (
              <div
                key={block.key}
                className={`rounded-lg border px-3 py-2 text-center ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--panel-border)] bg-[var(--panel)]/60"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  {block.key}
                </div>
                <div className="text-xs text-[var(--foreground)]/80">{block.label}</div>
              </div>
            );
          })}
        </div>
        {currentSession === "OFF" ? (
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-center text-sm font-semibold text-[color:var(--muted)]">
            Markets closed — off-hours (21:00–00:00 UTC). Showing all signals for preview.
          </div>
        ) : null}

        {data ? (
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-2 text-xs">
              <div className="uppercase tracking-[0.15em] text-[color:var(--muted)]">Week</div>
              <div className="font-semibold text-[var(--foreground)]">
                {data.currentWeekOpenUtc?.slice(0, 10) ?? "Unknown"}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-2 text-xs">
              <div className="uppercase tracking-[0.15em] text-[color:var(--muted)]">PASS</div>
              <div className="font-semibold text-emerald-700">{passRows.length}</div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-2 text-xs">
              <div className="uppercase tracking-[0.15em] text-[color:var(--muted)]">Session PASS</div>
              <div className="font-semibold text-[var(--foreground)]">{sessionPassRows.length}</div>
            </div>
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-2 text-xs">
              <div className="uppercase tracking-[0.15em] text-[color:var(--muted)]">Generated</div>
              <div className="font-semibold text-[var(--foreground)]">
                {formatDateTimeET(data.generatedUtc, "Unknown")}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <details open className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          Currency Strength
        </summary>
        <div className="px-4 pb-3">
          {strengthLoading ? (
            <p className="text-xs text-[color:var(--muted)]">Loading...</p>
          ) : !strengthData || strengthData.length === 0 ? (
            <p className="text-xs text-[color:var(--muted)]">
              No currency strength data available. Run the cron endpoint to populate.
            </p>
          ) : (
            <div className="space-y-2">
              {strengthData.map((windowResult) => (
                <div key={windowResult.window}>
                  <p className="mb-1 text-xs font-medium uppercase text-[color:var(--muted)]">
                    {windowResult.window} window
                  </p>
                  <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
                    {[...windowResult.strengths]
                      .sort((a, b) => b.normalized - a.normalized)
                      .map((strength) => (
                        <div
                          key={`${windowResult.window}-${strength.currency}`}
                          className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-center"
                        >
                          <span className="text-xs font-bold text-[var(--foreground)]">{strength.currency}</span>
                          <div
                            className="mt-0.5 text-sm font-mono"
                            style={{
                              color: strength.normalized >= 60
                                ? "var(--accent-strong)"
                                : strength.normalized <= 40
                                  ? "rgb(239 68 68)"
                                  : "var(--muted)",
                            }}
                          >
                            {strength.normalized.toFixed(0)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              {strengthData[0]?.snapshotTimeUtc ? (
                <p className="text-[10px] text-[color:var(--muted)]">
                  As of {formatDateTimeET(strengthData[0].snapshotTimeUtc, "Unknown")} ET
                </p>
              ) : null}
            </div>
          )}
        </div>
      </details>

      <details open className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          Crypto Strength
        </summary>
        <div className="px-4 pb-3">
          {assetStrengthLoading ? (
            <p className="text-xs text-[color:var(--muted)]">Loading...</p>
          ) : cryptoStrengths.length === 0 ? (
            <p className="text-xs text-[color:var(--muted)]">
              No crypto strength data available. Run the cron endpoint to populate.
            </p>
          ) : (
            <div className="space-y-2">
              {cryptoStrengths.map((windowResult) => (
                <div key={`crypto-${windowResult.window}`}>
                  <p className="mb-1 text-xs font-medium uppercase text-[color:var(--muted)]">
                    {windowResult.window} window
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {[...windowResult.strengths]
                      .sort((a, b) => b.normalized - a.normalized)
                      .map((strength) => (
                        <div
                          key={`${windowResult.window}-${strength.asset}`}
                          className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-center"
                        >
                          <span className="text-xs font-bold text-[var(--foreground)]">{strength.asset}</span>
                          <div
                            className="mt-0.5 text-sm font-mono"
                            style={{
                              color: strength.normalized >= 60
                                ? "var(--accent-strong)"
                                : strength.normalized <= 40
                                  ? "rgb(239 68 68)"
                                  : "var(--muted)",
                            }}
                          >
                            {strength.normalized.toFixed(0)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              {cryptoStrengths[0]?.snapshotTimeUtc ? (
                <p className="text-[10px] text-[color:var(--muted)]">
                  As of {formatDateTimeET(cryptoStrengths[0].snapshotTimeUtc, "Unknown")} ET
                </p>
              ) : null}
            </div>
          )}
        </div>
      </details>

      <details open className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          Commodity Strength
        </summary>
        <div className="px-4 pb-3">
          {assetStrengthLoading ? (
            <p className="text-xs text-[color:var(--muted)]">Loading...</p>
          ) : commodityStrengths.length === 0 ? (
            <p className="text-xs text-[color:var(--muted)]">
              No commodity strength data available. Run the cron endpoint to populate.
            </p>
          ) : (
            <div className="space-y-2">
              {commodityStrengths.map((windowResult) => (
                <div key={`commodities-${windowResult.window}`}>
                  <p className="mb-1 text-xs font-medium uppercase text-[color:var(--muted)]">
                    {windowResult.window} window
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {[...windowResult.strengths]
                      .sort((a, b) => b.normalized - a.normalized)
                      .map((strength) => (
                        <div
                          key={`${windowResult.window}-${strength.asset}`}
                          className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-center"
                        >
                          <span className="text-xs font-bold text-[var(--foreground)]">{strength.asset}</span>
                          <div
                            className="mt-0.5 text-sm font-mono"
                            style={{
                              color: strength.normalized >= 60
                                ? "var(--accent-strong)"
                                : strength.normalized <= 40
                                  ? "rgb(239 68 68)"
                                  : "var(--muted)",
                            }}
                          >
                            {strength.normalized.toFixed(0)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              {commodityStrengths[0]?.snapshotTimeUtc ? (
                <p className="text-[10px] text-[color:var(--muted)]">
                  As of {formatDateTimeET(commodityStrengths[0].snapshotTimeUtc, "Unknown")} ET
                </p>
              ) : null}
            </div>
          )}
        </div>
      </details>

      <details className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          Daily Sentiment Lock
        </summary>
        <div className="px-4 pb-3">
          {dailySentimentLoading ? (
            <p className="text-xs text-[color:var(--muted)]">Loading...</p>
          ) : !dailySentiment || !dailySentiment.rows?.length ? (
            <p className="text-xs text-[color:var(--muted)]">
              No daily sentiment lock data available. Run the cron endpoint to populate.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--panel)]/70 text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Direction</th>
                      <th className="px-3 py-2">Crowding</th>
                      <th className="px-3 py-2">Flip</th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2">As-Of (ET)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/40">
                    {[...dailySentiment.rows]
                      .sort((a, b) => b.confidenceScore - a.confidenceScore || a.symbol.localeCompare(b.symbol))
                      .map((row) => (
                        <tr key={`${row.snapshotDateUtc}-${row.symbol}`}>
                          <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.symbol}</td>
                          <td className={`px-3 py-2 font-semibold ${directionClass(row.sentimentDirection)}`}>
                            {row.sentimentDirection}
                          </td>
                          <td className="px-3 py-2 text-[var(--foreground)]/80">{row.crowdingState}</td>
                          <td className="px-3 py-2 text-[var(--foreground)]/80">{row.flipState}</td>
                          <td className="px-3 py-2 text-[var(--foreground)]/80">
                            {Number.isFinite(row.confidenceScore) ? row.confidenceScore.toFixed(3) : "0.000"}
                          </td>
                          <td className="px-3 py-2 text-[var(--foreground)]/80">
                            {formatDateTimeET(row.snapshotTimeUtc, "Unknown")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[color:var(--muted)]">
                Snapshot date: {dailySentiment.snapshotDateUtc ?? "Unknown"}
              </p>
            </div>
          )}
        </div>
      </details>

      <details className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          MenthorQ Overlay Coverage
        </summary>
        <div className="px-4 pb-3">
          {menthorqOverlayLoading ? (
            <p className="text-xs text-[color:var(--muted)]">Loading...</p>
          ) : !menthorqOverlay || !menthorqOverlay.rows?.length ? (
            <p className="text-xs text-[color:var(--muted)]">
              No MenthorQ overlay data available. Import the daily capture to populate.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[color:var(--muted)]">
                Snapshot date: {menthorqOverlay.snapshotDateUtc ?? "Unknown"} | Symbols: {menthorqOverlay.rows.length}
              </p>
              <div className="overflow-x-auto rounded-lg border border-[var(--panel-border)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--panel)]/70 text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Gamma</th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2">Captured (ET)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/40">
                    {[...menthorqOverlay.rows]
                      .sort((a, b) => a.symbol.localeCompare(b.symbol))
                      .map((row) => (
                        <tr key={`${row.snapshotDateUtc}-${row.symbol}`}>
                          <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.symbol}</td>
                          <td className={`px-3 py-2 font-semibold ${menthorqConditionClass(row.gammaCondition)}`}>
                            {row.gammaCondition}
                          </td>
                          <td className="px-3 py-2 text-[var(--foreground)]/80">{row.parseConfidence ?? "-"}</td>
                          <td className="px-3 py-2 text-[var(--foreground)]/80">
                            {formatDateTimeET(row.capturedAtUtc, "Unknown")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </details>

      {loading ? (
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/50 p-4 text-sm text-[color:var(--muted)]">
          Loading flagship board...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          Failed to load gated setups: {error}
        </div>
      ) : null}

      {!loading && !error && topPick && currentSession !== "OFF" ? (
        <article className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--panel)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              Top Pick
            </span>
            <span className="text-xs text-[color:var(--muted)]">
              Score {topPick.score.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-lg font-semibold text-[var(--foreground)]">{topPick.signal.pair}</span>
            <span className={`font-semibold ${directionClass(topPick.signal.direction)}`}>
              {topPick.signal.direction}
            </span>
            <span className={`font-semibold ${tierClass(topPick.signal.tier)}`}>{topPick.signal.tier}</span>
            <span className="text-[color:var(--muted)]">{topPick.maxLeverage}x max</span>
            <span className="text-[color:var(--muted)]">
              Consistency {(topPick.signal.consistency8w * 100).toFixed(0)}%
            </span>
          </div>
          <p className="mt-2 text-xs text-[var(--foreground)]/80">
            Source: {topPick.signal.gateDecisionSource ?? "WEEKLY_BOARD"} | As-of {topPick.freshnessLabel}
          </p>
        </article>
      ) : null}

      {!loading && !error && sessionPassRows.length === 0 ? (
        <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
          <p className="font-semibold">No actionable setups this session.</p>
          <p className="mt-1">Strict overlay mode is active. Incomplete overlay data is treated as SKIP.</p>
          {droppedRows.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]">
              <table className="min-w-full text-xs">
                <thead className="bg-[var(--panel)]/70 text-left uppercase tracking-[0.14em] text-[var(--foreground)]">
                  <tr>
                    <th className="px-3 py-2">Pair</th>
                    <th className="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {droppedRows.map((row) => (
                    <tr key={`${row.pair}-${row.reason}`} className="border-t border-[var(--panel-border)]">
                      <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.pair}</td>
                      <td className="px-3 py-2 text-[var(--foreground)]/80">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && (view === "board" ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
          <table className="min-w-full divide-y divide-[var(--panel-border)] text-xs">
            <thead className="bg-[var(--panel)]/70">
              <tr className="text-left uppercase tracking-[0.14em] text-[color:var(--muted)]">
                <th className="px-3 py-2">Pair</th>
                <th className="px-3 py-2">Dir</th>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Gate</th>
                <th className="px-3 py-2">Reasons</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Max Lev</th>
                <th className="px-3 py-2">8W</th>
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">As-Of (ET)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--panel-border)] bg-[var(--panel)]/40">
              {processed.map((row) => (
                <tr key={`${row.signal.pair}-${row.signal.direction}-${row.signal.assetClass}`}>
                  <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{row.signal.pair}</td>
                  <td className={`px-3 py-2 font-semibold ${directionClass(row.signal.direction)}`}>
                    {row.signal.direction}
                  </td>
                  <td className="px-3 py-2 text-[var(--foreground)]/80">{row.signal.assetClass.toUpperCase()}</td>
                  <td className={`px-3 py-2 font-semibold ${tierClass(row.signal.tier)}`}>{row.signal.tier}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${decisionPillClass(row.effectiveDecision)}`}>
                      {row.effectiveDecision}
                    </span>
                  </td>
                  <td className="max-w-[200px] px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.effectiveReasons.map((reason) => (
                        <span
                          key={`${row.signal.pair}-${row.signal.direction}-${reason}`}
                          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-1.5 py-0.5 text-[9px] text-[var(--foreground)]/70"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--foreground)]/80">{row.score.toFixed(2)}</td>
                  <td className="px-3 py-2 text-[var(--foreground)]/80">{row.maxLeverage}x</td>
                  <td className="px-3 py-2 text-[var(--foreground)]/80">
                    {(row.signal.consistency8w * 100).toFixed(0)}% / {row.signal.actionable8w}
                  </td>
                  <td className="px-3 py-2 text-[var(--foreground)]/80">
                    {row.sessionTags.join("/")}
                    {currentSession !== "OFF" ? (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.sessionEligible ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {row.sessionEligible ? "LIVE" : "WAIT"}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-[var(--foreground)]/80">
                    {row.signal.gateDecisionSource ?? "WEEKLY_BOARD"}
                  </td>
                  <td className="px-3 py-2 text-[var(--foreground)]/80">{row.freshnessLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/50 p-4 text-sm text-[var(--foreground)]/80">
            Research view shows strict-overlay drop reasons and full gate reason tags for audit.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/50 p-4">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Dropped By Strict Overlay</h3>
              <ul className="mt-2 space-y-1 text-xs text-[var(--foreground)]/80">
                {droppedRows.length === 0 ? <li>None</li> : droppedRows.map((row) => (
                  <li key={`${row.pair}-${row.reason}`}>
                    <span className="font-semibold">{row.pair}</span>: {row.reason}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/50 p-4">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Pass Universe</h3>
              <ul className="mt-2 space-y-1 text-xs text-[var(--foreground)]/80">
                {passRows.length === 0 ? <li>None</li> : passRows.map((row) => (
                  <li key={`${row.signal.pair}-${row.signal.direction}`}>
                    <span className="font-semibold">{row.signal.pair}</span> {row.signal.direction} ({row.score.toFixed(2)})
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/50 p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Gate Reasons</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {processed.map((row) => (
                <div key={`${row.signal.pair}-${row.signal.assetClass}`} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2 text-xs">
                  <div className="font-semibold text-[var(--foreground)]">
                    {row.signal.pair} {row.signal.direction}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.effectiveReasons.length === 0 ? (
                      <span className="text-[color:var(--muted)]">No reasons</span>
                    ) : (
                      row.effectiveReasons.map((reason) => (
                        <span
                          key={`${row.signal.pair}-${reason}`}
                          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-0.5 text-[10px] text-[var(--foreground)]/80"
                        >
                          {reason}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
