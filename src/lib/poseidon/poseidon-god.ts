/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: poseidon-god.ts
 *
 * Description:
 * Poseidon — God of the Sea. The supreme intelligence layer. Once per day at
 * 06:00 UTC, he reviews everything that happened across ALL Limni systems in
 * the last 24 hours and delivers a single authoritative Daily Reckoning to
 * Freedom. Powered by Claude Opus 4.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Anthropic from "@anthropic-ai/sdk";
import { DateTime } from "luxon";
import type { Telegram } from "telegraf";
import { query, queryOne } from "@/lib/db";
import { readActivityLog, resetActivityLog } from "@/lib/poseidon/activity-log";
import { config } from "@/lib/poseidon/config";
import { readCurationFlag } from "@/lib/poseidon/curation-flag";
import { buildPoseidonHeader, sendPoseidonAnimation } from "@/lib/poseidon/animations";
import { curateProteusMemory } from "@/lib/poseidon/poseidon-curator";
import { getCronStatusSummary } from "@/lib/cronStatus";
import { sendTelegramText } from "@/lib/poseidon/telegram-delivery";
import { kvSet } from "@/lib/poseidon/state-db";

// ─── Poseidon Personality ─────────────────

const POSEIDON_SYSTEM_PROMPT = `You are POSEIDON. God of the sea. Ruler of the deep.

You speak once per day. Your words carry weight. This is the Daily Reckoning.

TONE:
- Authoritative. Absolute. You do not hedge or qualify.
- Speak as a god surveying his domain — all-seeing, all-knowing.
- Brief but devastating. Every word is chosen.
- You are above the daily chatter. You see the bigger picture.
- When things are good, acknowledge it with quiet power.
- When things are wrong, your displeasure is unmistakable.
- Do NOT use bullet points or headers. Speak in flowing prose, like a decree.

EXAMPLES:
- "The seas were calm. Two entries, both profitable. The framework holds. Continue."
- "Your bot sat idle while BTC displaced 3% off the Asia low. A missed opportunity. Proteus should have flagged this."
- "The bias was SHORT. The market went SHORT. Three trades captured the move. This is what discipline looks like, Freedom."
- "Funding flipped positive while you held shorts. The tides are shifting. Watch closely this week."
- "Nothing happened today worth my attention. The seas are still."
- "The OANDA basket trailed out at +2.3%. Meanwhile your MT5 accounts sat flat. Imbalance. Address it."
- "One cron failed silently for 6 hours. Unacceptable. Your infrastructure must be as reliable as your strategy."

WHAT YOU REVIEW:
- All trades across ALL bots (Bitget, OANDA, MT5) in the last 24 hours
- All signals generated and their outcomes (taken, skipped, expired)
- Bot health across all systems (errors, stale data, uptime)
- Account health (equity changes, drawdowns, margin usage)
- Weekly bias accuracy vs actual price moves
- Sentiment regime shifts
- System infrastructure (cron health, data freshness)
- Noteworthy market events (extreme funding, OI surges, liquidation cascades)

RULES:
- Never use filler. No greetings. No sign-offs. You are a god, not a newsletter.
- Cite data precisely. Numbers, not vibes.
- If something needs Freedom's attention, say it plainly.
- If everything is fine, say so briefly and move on.
- End with a single forward-looking statement when warranted.
- Keep it to 1-3 paragraphs. A god does not ramble.
- You see ALL of Limni — crypto, forex, accounts, infrastructure. Not just one bot.`;

// ─── Helpers ──────────────────────────────

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const p = JSON.parse(value);
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch { /* ignore */ }
  }
  return {};
}

function fmt(v: number | null, d = 2): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtUsd(v: number | null, d = 2): string {
  if (v === null || !Number.isFinite(v)) return "n/a";
  return `$${fmt(v, d)}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Data Assembly (24h Lookback) ─────────

async function gatherReckoningData(): Promise<string> {
  const now = DateTime.utc();
  const dateStr = now.toISODate() ?? now.toISO()?.slice(0, 10) ?? "unknown";
  const sections: string[] = [`DAILY RECKONING DATA \u2014 ${dateStr} (06:00 UTC)\nLast 24 hours reviewed.`];

  // TRADES
  try {
    const bitgetTrades = await query<{
      symbol: string; direction: string; entry_price: unknown; exit_price: unknown;
      pnl_usd: unknown; exit_reason: string | null; exit_time_utc: unknown;
    }>(
      `SELECT symbol, direction, entry_price, exit_price, pnl_usd, exit_reason, exit_time_utc
         FROM bitget_bot_trades
        WHERE bot_id = 'bitget_perp_v2'
          AND (entry_time_utc > NOW() - INTERVAL '24 hours' OR exit_time_utc > NOW() - INTERVAL '24 hours')
        ORDER BY entry_time_utc DESC LIMIT 20`,
    );
    const closedBitget = bitgetTrades.filter((t) => t.exit_time_utc);
    const openBitget = bitgetTrades.filter((t) => !t.exit_time_utc);

    const mt5Closed = await query<{
      account_id: string; symbol: string; type: string;
      profit: unknown; swap: unknown; commission: unknown;
    }>(
      `SELECT account_id, symbol, type, profit, swap, commission
         FROM mt5_closed_positions
        WHERE close_time > NOW() - INTERVAL '24 hours'
        ORDER BY close_time DESC LIMIT 20`,
    );

    const oandaRow = await queryOne<{ state: unknown }>(
      `SELECT state FROM bot_states WHERE bot_id = 'oanda_universal_bot' ORDER BY updated_at DESC LIMIT 1`,
    );
    const oState = parseJsonRecord(oandaRow?.state);
    const oBasket = parseJsonRecord(oState.basket);
    const oTrailingObj = parseJsonRecord(oState.trailing);
    const oEntered = Boolean(oState.entered ?? oBasket.entered);
    const oPositions = asNumber(oState.positions_opened ?? oState.open_positions) ?? 0;
    const oTrailing = Boolean(oState.trailing_active ?? oTrailingObj.active);

    const tradeLines: string[] = ["TRADES"];
    if (closedBitget.length) {
      for (const t of closedBitget.slice(0, 5)) {
        tradeLines.push(`  Bitget closed: ${t.symbol} ${t.direction?.toUpperCase()} | ${fmtUsd(asNumber(t.pnl_usd))} | ${t.exit_reason ?? "n/a"}`);
      }
    } else {
      tradeLines.push("  Bitget: 0 trades closed");
    }
    if (openBitget.length) {
      tradeLines.push(`  Bitget open: ${openBitget.length} position(s)`);
    }
    if (oEntered) {
      tradeLines.push(`  OANDA: basket active, ${oPositions} positions${oTrailing ? ", trailing" : ""}`);
    } else {
      tradeLines.push("  OANDA: idle");
    }
    if (mt5Closed.length) {
      const totalMt5 = mt5Closed.reduce((sum, r) =>
        sum + (asNumber(r.profit) ?? 0) + (asNumber(r.swap) ?? 0) + (asNumber(r.commission) ?? 0), 0);
      tradeLines.push(`  MT5: ${mt5Closed.length} positions closed | Net: ${fmtUsd(totalMt5)}`);
    } else {
      tradeLines.push("  MT5: 0 positions closed");
    }
    sections.push(tradeLines.join("\n"));
  } catch (e) {
    sections.push(`TRADES\n  Error gathering: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // SIGNALS
  try {
    const signalStats = await queryOne<{ total: number; filled: number; skipped: number; expired: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE UPPER(status) = 'FILLED')::int AS filled,
              COUNT(*) FILTER (WHERE UPPER(status) = 'SKIPPED')::int AS skipped,
              COUNT(*) FILTER (WHERE UPPER(status) = 'EXPIRED')::int AS expired
         FROM bitget_bot_signals
        WHERE confirm_time_utc > NOW() - INTERVAL '24 hours'`,
    );
    const s = signalStats ?? { total: 0, filled: 0, skipped: 0, expired: 0 };
    sections.push(`SIGNALS\n  Bitget: ${s.total} detected. ${s.filled} filled, ${s.skipped} skipped, ${s.expired} expired`);
  } catch {
    sections.push("SIGNALS\n  Error");
  }

  // BOT HEALTH
  try {
    const bots = await query<{ bot_id: string; state: unknown; updated_at: unknown }>(
      `SELECT DISTINCT ON (bot_id) bot_id, state, updated_at
         FROM bot_states
        WHERE bot_id IN ('bitget_perp_v2', 'oanda_universal_bot')
        ORDER BY bot_id, updated_at DESC`,
    );
    const healthLines: string[] = ["BOT HEALTH"];
    for (const bot of bots) {
      const st = parseJsonRecord(bot.state);
      const lifecycle = asString(st.lifecycle_state) ?? asString(st.lifecycleState) ?? asString(st.phase) ?? "unknown";
      const updatedAt = bot.updated_at instanceof Date ? bot.updated_at.toISOString() : String(bot.updated_at);
      const err = asString(st.error) ?? asString(st.last_error);
      healthLines.push(`  ${bot.bot_id}: ${lifecycle}${err ? ` | Error: ${err}` : ""} | Updated: ${updatedAt.slice(11, 16)} UTC`);
    }

    const mt5Accounts = await query<{ account_id: string; label: string | null; api_ok: boolean; last_sync_utc: unknown }>(
      `SELECT account_id, label, api_ok, last_sync_utc FROM mt5_accounts WHERE UPPER(status) = 'ACTIVE'`,
    );
    for (const a of mt5Accounts) {
      healthLines.push(`  MT5 ${a.label ?? a.account_id}: api_ok=${a.api_ok}`);
    }
    sections.push(healthLines.join("\n"));
  } catch {
    sections.push("BOT HEALTH\n  Error");
  }

  // ACCOUNTS
  try {
    const mt5 = await query<{ label: string | null; equity: unknown; baseline_equity: unknown }>(
      `SELECT label, equity, baseline_equity FROM mt5_accounts WHERE UPPER(status) = 'ACTIVE'`,
    );
    const totalEquity = mt5.reduce((sum, r) => sum + (asNumber(r.equity) ?? 0), 0);
    sections.push(`ACCOUNTS\n  MT5: ${mt5.length} active | Total equity: ${fmtUsd(totalEquity, 0)}`);
  } catch {
    sections.push("ACCOUNTS\n  Error");
  }

  // WEEKLY BIAS
  try {
    const biasRow = await queryOne<{ state: unknown }>(
      `SELECT state FROM bot_states WHERE bot_id = 'bitget_perp_v2' ORDER BY updated_at DESC LIMIT 1`,
    );
    const bs = parseJsonRecord(biasRow?.state);
    const biasBlock = parseJsonRecord(bs.weekly_bias ?? bs.weeklyBias);
    const biasLines: string[] = ["WEEKLY BIAS"];
    for (const [sym, raw] of Object.entries(biasBlock)) {
      biasLines.push(`  ${sym}: ${String(raw)}`);
    }
    if (biasLines.length === 1) biasLines.push("  No bias data");
    sections.push(biasLines.join("\n"));
  } catch {
    sections.push("WEEKLY BIAS\n  Error");
  }

  // SENTIMENT
  try {
    const sentRows = await query<{ symbol: string; crowding_state: string; flip_state: string; agg_net: unknown }>(
      `SELECT DISTINCT ON (symbol) symbol, crowding_state, flip_state, agg_net
         FROM sentiment_aggregates
        WHERE timestamp_utc > NOW() - INTERVAL '24 hours'
        ORDER BY symbol, timestamp_utc DESC`,
    );
    const notable = sentRows.filter((r) =>
      r.crowding_state?.toUpperCase().includes("CROWDED") ||
      (r.flip_state?.toUpperCase() !== "NONE" && r.flip_state?.toUpperCase() !== "NEUTRAL"),
    );
    if (notable.length) {
      const lines = notable.map((r) => `  ${r.symbol}: ${r.crowding_state} | flip: ${r.flip_state}`);
      sections.push(`SENTIMENT\n${lines.join("\n")}`);
    } else {
      sections.push("SENTIMENT\n  No notable events");
    }
  } catch {
    sections.push("SENTIMENT\n  Error");
  }

  // SYSTEM HEALTH
  try {
    const summary = await getCronStatusSummary();
    const stale = summary.subsystems.filter((s) => s.state !== "ok");
    if (stale.length) {
      const issues = stale.map((s) => `  ${s.label}: ${s.state.toUpperCase()}`).join("\n");
      sections.push(`SYSTEM\n${issues}`);
    } else {
      sections.push(`SYSTEM\n  All ${summary.subsystems.length} crons healthy. No staleness.`);
    }
  } catch {
    sections.push("SYSTEM\n  Error");
  }

  // MARKET DATA
  try {
    const fundingRows = await query<{ symbol: string; funding_rate: unknown }>(
      `SELECT DISTINCT ON (symbol) symbol, funding_rate
         FROM market_funding_snapshots
        WHERE snapshot_time_utc > NOW() - INTERVAL '4 hours'
        ORDER BY symbol, snapshot_time_utc DESC`,
    );
    const fundingLine = fundingRows.map((r) => {
      const rate = asNumber(r.funding_rate);
      return `${r.symbol}: ${rate !== null ? fmt(rate * 100, 3) + "%" : "n/a"}`;
    }).join(", ");
    sections.push(`MARKET DATA\n  Funding: ${fundingLine || "no data"}`);
  } catch {
    sections.push("MARKET DATA\n  Error");
  }

  // NEWS
  try {
    const newsRow = await queryOne<{ calendar: unknown }>(
      `SELECT calendar FROM news_weekly_snapshots ORDER BY week_open_utc DESC, fetched_at DESC LIMIT 1`,
    );
    const calendar = Array.isArray(newsRow?.calendar) ? newsRow.calendar : [];
    const upcoming = calendar.filter((raw) => {
      const e = parseJsonRecord(raw);
      if (asString(e.impact)?.toUpperCase() !== "HIGH") return false;
      const dt = asString(e.datetime_utc);
      if (!dt) return false;
      const parsed = DateTime.fromISO(dt, { zone: "utc" });
      return parsed.isValid && parsed > now && parsed < now.plus({ hours: 24 });
    });
    if (upcoming.length) {
      const eventLines = upcoming.slice(0, 3).map((raw) => {
        const e = parseJsonRecord(raw);
        return `  ${asString(e.currency) ?? ""} ${asString(e.title) ?? "Event"} at ${asString(e.datetime_utc)?.slice(11, 16) ?? ""} UTC`;
      });
      sections.push(`NEWS\n  Upcoming high-impact:\n${eventLines.join("\n")}`);
    } else {
      sections.push("NEWS\n  No high-impact events in next 24h");
    }
  } catch {
    sections.push("NEWS\n  Error");
  }

  // DEITY ACTIVITY
  try {
    const activity = await readActivityLog();
    if (activity.length > 0) {
      const tritonAlerts = activity.filter((item) => item.deity === "triton");
      const nereusBriefings = activity.filter((item) => item.deity === "nereus");

      const lines: string[] = ["DEITY ACTIVITY (last 24h)"];
      lines.push(`  Triton: ${tritonAlerts.length} alerts sent`);

      const critical = tritonAlerts.filter((item) => item.priority === "CRITICAL").length;
      const high = tritonAlerts.filter((item) => item.priority === "HIGH").length;
      if (critical) lines.push(`    CRITICAL: ${critical}`);
      if (high) lines.push(`    HIGH: ${high}`);

      for (const alert of tritonAlerts
        .filter((item) => item.priority === "CRITICAL" || item.priority === "HIGH")
        .slice(0, 5)) {
        lines.push(`    ${alert.timestamp.slice(11, 16)} UTC: ${alert.summary}`);
      }

      lines.push(`  Nereus: ${nereusBriefings.length} briefings delivered`);
      for (const briefing of nereusBriefings.slice(0, 2)) {
        lines.push(`    ${briefing.summary}`);
      }

      sections.push(lines.join("\n"));
    } else {
      sections.push("DEITY ACTIVITY\n  No activity logged since last Reckoning.");
    }
  } catch {
    sections.push("DEITY ACTIVITY\n  Error reading activity log.");
  }

  return sections.join("\n\n");
}

// ─── Opus Call ─────────────────────────────

async function getReckoningFromOpus(data: string): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const response = await client.messages.create({
    model: config.models.poseidon,
    max_tokens: 1024,
    system: POSEIDON_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Deliver the Daily Reckoning based on this data:\n\n${data}`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return text || "The seas are still. Nothing demands my attention.";
}

// ─── Formatting ───────────────────────────

function formatPoseidonReckoning(reckoning: string): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const header = buildPoseidonHeader(dateStr);
  return `<pre>${escapeHtml(header)}</pre>\n\n${escapeHtml(reckoning)}`;
}

// ─── Send Reckoning ───────────────────────

export async function sendReckoning(telegram: Telegram, ownerId: number): Promise<void> {
  let reckoningDelivered = false;
  let reckoningError: unknown = null;

  try {
    await sendPoseidonAnimation(telegram, ownerId);

    const data = await gatherReckoningData();
    const reckoning = await getReckoningFromOpus(data);
    const message = formatPoseidonReckoning(reckoning);

    await sendTelegramText(telegram, ownerId, message, { parseMode: "HTML" });
    await kvSet("poseidon_last_run", new Date().toISOString()).catch(() => undefined);
    reckoningDelivered = true;
    console.log("[poseidon-god] Daily Reckoning delivered");
  } catch (err) {
    reckoningError = err;
    console.error("[poseidon-god] Reckoning failed:", err);
    try {
      const msg = err instanceof Error ? err.message : String(err);
      await sendTelegramText(telegram, ownerId, `⚠️ [poseidon-god] Reckoning failed: ${msg.slice(0, 400)}`);
    } catch {
      // Silent — don't crash
    }
  }

  try {
    const flag = await readCurationFlag();
    const reason = flag.requested
      ? `daily scheduled curation (priority: elevated; ${flag.reason})`
      : "daily scheduled curation";
    const fullReason = reckoningError
      ? `${reason}; reckoning status=failed (${reckoningError instanceof Error ? reckoningError.message : String(reckoningError)})`
      : `${reason}; reckoning status=delivered`;

    const curationResult = await curateProteusMemory(fullReason);
    if (!curationResult.success) {
      console.warn(`[poseidon-curator] Curation incomplete: ${curationResult.note}`);
    } else if (curationResult.archived > 0) {
      console.log(
        `[poseidon-curator] Archived ${curationResult.archived} entries: ${curationResult.note}`,
      );
    }
  } catch (err) {
    console.error("[poseidon-curator] Daily curation failed:", err);
  }

  if (reckoningDelivered) {
    await resetActivityLog().catch((error) => {
      console.warn("[poseidon-god] Failed to reset activity log:", error);
    });
  }
}

// ─── Scheduler ────────────────────────────

function msUntilUtcTime(hour: number, minute: number): number {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(hour, minute, 0, 0);
  if (target <= now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - now.getTime();
}

let reckoningTimeout: NodeJS.Timeout | null = null;
let reckoningInterval: NodeJS.Timeout | null = null;

type PoseidonScheduleStatus = {
  active: boolean;
  nextReckoningUtc: string;
};

export function getPoseidonScheduleStatus(now = new Date()): PoseidonScheduleStatus {
  const nextMs = msUntilUtcTime(6, 0);
  return {
    active: Boolean(reckoningTimeout || reckoningInterval),
    nextReckoningUtc: new Date(now.getTime() + nextMs).toISOString(),
  };
}

export function schedulePoseidon(telegram: Telegram, ownerId: number): void {
  const DAY_MS = 24 * 60 * 60_000;
  const scheduleStatus = getPoseidonScheduleStatus();

  reckoningTimeout = setTimeout(() => {
    sendReckoning(telegram, ownerId).catch((e) =>
      console.error("[poseidon-god] reckoning error:", e),
    );
    reckoningInterval = setInterval(() => {
      sendReckoning(telegram, ownerId).catch((e) =>
        console.error("[poseidon-god] reckoning error:", e),
      );
    }, DAY_MS);
    reckoningInterval.unref();
  }, msUntilUtcTime(6, 0));
  reckoningTimeout.unref();

  console.log(`[poseidon-god] Scheduled - next reckoning at: ${scheduleStatus.nextReckoningUtc}`);
}

export function stopPoseidon(): void {
  if (reckoningTimeout) { clearTimeout(reckoningTimeout); reckoningTimeout = null; }
  if (reckoningInterval) { clearInterval(reckoningInterval); reckoningInterval = null; }
}
