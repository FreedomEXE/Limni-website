/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: LiveStateTab.tsx
 *
 * Description:
 * Read-only live state panel for Bitget Bot v2 showing weekly bias,
 * session ranges, handshake timing, and current open positions.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { BitgetBotStateV1 } from "@/lib/bitgetBotEngine";
import {
  toIsoString,
  toNumber,
  type BitgetRangeRow,
  type BitgetSignalRow,
} from "@/components/bitget-bot-lite/types";
import { formatDateTimeET } from "@/lib/time";

type LiveStateTabProps = {
  botState: BitgetBotStateV1 | null;
  ranges: BitgetRangeRow[];
  signals: BitgetSignalRow[];
  nowIso: string;
};

function directionTone(direction: string | null | undefined) {
  if (direction === "LONG") return { icon: "↑", tone: "text-emerald-300" };
  if (direction === "SHORT") return { icon: "↓", tone: "text-rose-300" };
  return { icon: "•", tone: "text-[color:var(--muted)]" };
}

function tierLabel(tier: string | null | undefined) {
  if (tier === "HIGH") return "T1";
  if (tier === "MEDIUM") return "T2";
  return "T3";
}

function fmtNumber(value: unknown, digits = 2) {
  const num = toNumber(value);
  return num === null ? "—" : num.toFixed(digits);
}

function fmtPct(value: unknown, digits = 2) {
  const num = toNumber(value);
  return num === null ? "—" : `${num.toFixed(digits)}%`;
}

function fmtUtc(value: unknown) {
  const iso = toIsoString(value);
  if (!iso) return "—";
  return formatDateTimeET(iso, iso);
}

function resolveRange(
  rows: BitgetRangeRow[],
  symbol: "BTC" | "ETH",
  source: "ASIA+LONDON" | "US",
) {
  const filtered = rows.filter((row) => row.symbol === symbol && row.range_source === source);
  if (!filtered.length) return null;
  return filtered
    .sort((a, b) => {
      const aLocked = Date.parse(String(a.locked_at_utc));
      const bLocked = Date.parse(String(b.locked_at_utc));
      if (Number.isFinite(aLocked) && Number.isFinite(bLocked) && aLocked !== bLocked) {
        return bLocked - aLocked;
      }
      const aDay = (a.day_utc_text ?? String(a.day_utc).slice(0, 10));
      const bDay = (b.day_utc_text ?? String(b.day_utc).slice(0, 10));
      if (aDay !== bDay) return bDay.localeCompare(aDay);
      return 0;
    })[0];
}

function getRangeDayText(row: BitgetRangeRow | null) {
  if (!row) return null;
  const day = row.day_utc_text ?? String(row.day_utc).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function isRangeStale(dayText: string | null, nowIso: string) {
  if (!dayText) return false;
  const dayMs = Date.parse(`${dayText}T00:00:00.000Z`);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(dayMs) || !Number.isFinite(nowMs)) return false;
  const nowDayStart = new Date(nowMs);
  nowDayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStartMs = nowDayStart.getTime() - 24 * 60 * 60 * 1000;
  return dayMs < yesterdayStartMs;
}

function resolveLatestSignal(rows: BitgetSignalRow[], symbol: "BTC" | "ETH") {
  const filtered = rows.filter((row) => row.symbol === symbol);
  if (!filtered.length) return null;
  return filtered
    .sort((a, b) => {
      const aConfirm = Date.parse(String(a.confirm_time_utc));
      const bConfirm = Date.parse(String(b.confirm_time_utc));
      if (Number.isFinite(aConfirm) && Number.isFinite(bConfirm) && aConfirm !== bConfirm) {
        return bConfirm - aConfirm;
      }
      const aCreated = Date.parse(String(a.created_at));
      const bCreated = Date.parse(String(b.created_at));
      if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
        return bCreated - aCreated;
      }
      return Number(b.id) - Number(a.id);
    })[0];
}

function sweepBadgeTone(signal: BitgetSignalRow | null) {
  if (!signal) return "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]";
  if (signal.status === "HANDSHAKE_CONFIRMED") return "border-emerald-300/40 bg-emerald-500/10 text-emerald-200";
  if (signal.status === "CANDIDATE") return "border-amber-300/40 bg-amber-500/10 text-amber-200";
  return "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]";
}

function sweepStatusLabel(signal: BitgetSignalRow | null) {
  if (!signal) return "No qualified sweep";
  if (signal.status === "CANDIDATE" && !signal.handshake_group_id) return "Sweep confirmed, waiting counterpart";
  if (signal.status === "HANDSHAKE_CONFIRMED") return "Handshake confirmed";
  return signal.status;
}

function expiryCountdown(expiryTs: number | null | undefined, nowIso: string) {
  if (!Number.isFinite(expiryTs ?? NaN)) return "—";
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) return "—";
  const seconds = Math.floor(((expiryTs ?? 0) - nowMs) / 1000);
  if (seconds <= 0) return "Expired";
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

function PositionCard({
  position,
}: {
  position: NonNullable<BitgetBotStateV1["positions"]>[number];
}) {
  return (
    <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">{position.symbol}</h4>
          <span
            className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
              position.direction === "LONG"
                ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
                : "border-rose-300/40 bg-rose-500/10 text-rose-200"
            }`}
          >
            {position.direction}
          </span>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {position.sessionWindow}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted)] md:grid-cols-3">
        <span>Entry: {fmtNumber(position.entryPrice, 4)}</span>
        <span>Stop: {fmtNumber(position.stopPrice, 4)}</span>
        <span>Lev: {fmtNumber(position.currentLeverage, 0)}x</span>
        <span>Max Lev: {fmtNumber(position.maxLeverageReached, 0)}x</span>
        <span>Margin: {fmtNumber(position.marginUsd, 2)} USDT</span>
        <span>Entry Time: {fmtUtc(position.entryTimeUtc)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(position.milestonesHit ?? []).length > 0 ? (
          (position.milestonesHit ?? []).map((m) => (
            <span
              key={`${position.symbol}-${m}`}
              className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
            >
              +{m}%
            </span>
          ))
        ) : (
          <span className="text-xs text-[color:var(--muted)]">No milestones hit</span>
        )}
        {position.breakevenReached ? (
          <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Breakeven
          </span>
        ) : null}
        {position.trailingActive ? (
          <span className="rounded-full border border-sky-300/40 bg-sky-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200">
            Trailing Active
          </span>
        ) : null}
      </div>
    </article>
  );
}

function RangeCell({
  label,
  range,
  nowIso,
}: {
  label: "BTC" | "ETH";
  range: BitgetRangeRow | null;
  nowIso: string;
}) {
  const dayText = getRangeDayText(range);
  const stale = isRangeStale(dayText, nowIso);
  return (
    <div className="rounded-xl border border-[var(--panel-border)] p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--foreground)]">H {fmtNumber(range?.high, 2)}</p>
      <p className="text-sm text-[var(--foreground)]">L {fmtNumber(range?.low, 2)}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--muted)]">
        <span>({dayText ?? "—"})</span>
        {stale ? (
          <span className="rounded-full border border-rose-300/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-rose-200">
            STALE
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function LiveStateTab({ botState, ranges, signals, nowIso }: LiveStateTabProps) {
  const btcAsiaLondon = resolveRange(ranges, "BTC", "ASIA+LONDON");
  const ethAsiaLondon = resolveRange(ranges, "ETH", "ASIA+LONDON");
  const btcUs = resolveRange(ranges, "BTC", "US");
  const ethUs = resolveRange(ranges, "ETH", "US");
  const btcSignal = resolveLatestSignal(signals, "BTC");
  const ethSignal = resolveLatestSignal(signals, "ETH");

  const weeklyBias = botState?.weeklyBias;
  const btcBias = weeklyBias?.btc;
  const ethBias = weeklyBias?.eth;
  const handshake = botState?.handshake;

  const sideCards = [
    { symbol: "BTC", side: btcBias },
    { symbol: "ETH", side: ethBias },
  ] as const;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Weekly Bias
            </h3>
            <span className="text-xs text-[color:var(--muted)]">
              {weeklyBias ? `${fmtUtc(weeklyBias.weekOpenUtc)} - ${fmtUtc(weeklyBias.weekCloseUtc)}` : "No week loaded"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sideCards.map(({ symbol, side }) => {
              const tone = directionTone(side?.bias);
              return (
                <div key={symbol} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[var(--foreground)]">{symbol}</h4>
                    <span className={`text-xl ${tone.tone}`}>{tone.icon}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-sm font-semibold ${tone.tone}`}>{side?.bias ?? "NEUTRAL"}</span>
                    <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                      {tierLabel(side?.tier)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-[color:var(--muted)]">
                    <p>Dealer: {side?.dealer ?? "—"}</p>
                    <p>Commercial: {side?.commercial ?? "—"}</p>
                    <p>Sentiment: {side?.sentiment ?? "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Session Ranges
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            {[
              { label: "Asia+London", btc: btcAsiaLondon, eth: ethAsiaLondon },
              { label: "US", btc: btcUs, eth: ethUs },
            ].map((block) => (
              <div key={block.label} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{block.label}</span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {block.btc?.locked_at_utc || block.eth?.locked_at_utc ? "Locked" : "Forming"}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <RangeCell label="BTC" range={block.btc} nowIso={nowIso} />
                  <RangeCell label="ETH" range={block.eth} nowIso={nowIso} />
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  Updated: {fmtUtc(block.btc?.locked_at_utc ?? block.eth?.locked_at_utc ?? null)}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Handshake Status
          </h3>
          <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)] md:grid-cols-2">
            <p>Active: <span className="font-semibold">{handshake?.active ? "Yes" : "No"}</span></p>
            <p>Session: <span className="font-semibold">{handshake?.sessionWindow ?? "—"}</span></p>
            <p>First Symbol: <span className="font-semibold">{handshake?.firstSymbol ?? "—"}</span></p>
            <p>First Confirm: <span className="font-semibold">{fmtUtc(handshake?.firstConfirmTs ? new Date(handshake.firstConfirmTs).toISOString() : null)}</span></p>
            <p>Expires: <span className="font-semibold">{handshake?.expiryTs ? fmtUtc(new Date(handshake.expiryTs).toISOString()) : "—"}</span></p>
            <p>Countdown: <span className="font-semibold">{expiryCountdown(handshake?.expiryTs, nowIso)}</span></p>
          </div>
        </article>

        <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Sweep Status
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              { symbol: "BTC", signal: btcSignal },
              { symbol: "ETH", signal: ethSignal },
            ].map(({ symbol, signal }) => (
              <div key={symbol} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">{symbol}</h4>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${sweepBadgeTone(signal)}`}>
                    {signal?.status ?? "NONE"}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-[color:var(--muted)]">
                  <p>{sweepStatusLabel(signal)}</p>
                  <p>Direction: <span className="font-semibold text-[var(--foreground)]">{signal?.direction ?? "—"}</span></p>
                  <p>Sweep %: <span className="font-semibold text-[var(--foreground)]">{fmtPct(signal?.sweep_pct, 3)}</span></p>
                  <p>Displacement %: <span className="font-semibold text-[var(--foreground)]">{fmtPct(signal?.displacement_pct, 3)}</span></p>
                  <p>Session: <span className="font-semibold text-[var(--foreground)]">{signal?.session_window ?? "—"}</span></p>
                  <p>Confirm Time: <span className="font-semibold text-[var(--foreground)]">{fmtUtc(signal?.confirm_time_utc ?? null)}</span></p>
                  <p>Handshake Group: <span className="font-semibold text-[var(--foreground)]">{signal?.handshake_group_id ?? "Pending"}</span></p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section>
        <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Open Positions
          </h3>
          <div className="mt-4 space-y-3">
            {(botState?.positions ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
                No open positions. Lifecycle: {botState?.lifecycle ?? "IDLE"}.
              </div>
            ) : (
              (botState?.positions ?? []).map((position) => (
                <PositionCard key={`${position.symbol}-${position.entryTs}`} position={position} />
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

