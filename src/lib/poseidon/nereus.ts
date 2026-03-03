/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: nereus.ts
 *
 * Description:
 * Nereus — the Old Man of the Sea. Delivers structured pre-session briefings
 * covering ALL Limni subsystems. Runs twice daily (23:30 UTC Pre-Asia,
 * 12:30 UTC Pre-NY), gathers platform data, gets Haiku commentary, and
 * sends formatted briefings to Freedom via Telegram.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Anthropic from "@anthropic-ai/sdk";
import type { Telegram } from "telegraf";
import { appendActivityLog } from "@/lib/poseidon/activity-log";
import { config } from "@/lib/poseidon/config";
import { buildNereusHeader } from "@/lib/poseidon/animations";
import { assembleBriefingData, type SessionType } from "@/lib/poseidon/nereus-queries";
import { sendTelegramText } from "@/lib/poseidon/telegram-delivery";
import { kvSet } from "@/lib/poseidon/state-db";

// ─── Nereus Personality ───────────────────

const NEREUS_SYSTEM_PROMPT = `You are NEREUS, the Old Man of the Sea. You deliver pre-session trading briefings for Freedom at Limni Labs.

TONE:
- Calm, wise, measured. You speak like an oracle delivering a scroll.
- Brief. Your commentary is 1-3 sentences MAX. The structured data speaks for itself.
- No filler. No greetings. No sign-offs. Just insight.
- Reference specific data points in your commentary. Don't be vague.
- If everything is calm, say so briefly. If something needs attention, be direct.

EXAMPLES:
- "Short bias, clean alignment. Watch the Asia low for a sweep setup."
- "Funding deeply negative while the crowd stays short. When everyone leans, the sea corrects."
- "OANDA basket trailing at +2.1%. Let it ride unless NFP prints hot."
- "Three crons stale. Fix before NY opens."
- "Nothing demands your attention. The seas are still."

YOUR ROLE:
- You see ALL of Limni: crypto bots, forex bots, MT5 accounts, sentiment, COT, news, system health.
- Highlight what matters. Skip what doesn't.
- If a high-impact event is imminent, flag it prominently.
- If a bot is down or data is stale, lead with that.
- Your commentary goes at the bottom after the structured data.`;

// ─── Helpers ──────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Haiku Commentary ─────────────────────

async function getHaikuCommentary(structuredData: string): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const response = await client.messages.create({
    model: config.models.nereus,
    max_tokens: 200,
    system: NEREUS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the current platform state. Provide 1-3 sentences of commentary — what should Freedom focus on?\n\n${structuredData}`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return text || "The seas are still.";
}

// ─── Briefing Assembly ────────────────────

export async function buildBriefing(sessionType: SessionType): Promise<string> {
  const structured = await assembleBriefingData(sessionType);
  const commentary = await getHaikuCommentary(structured);

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toISOString().split("T")[1].slice(0, 5);

  const header = buildNereusHeader(sessionType, dateStr, timeStr);

  return `<pre>${escapeHtml(header)}</pre>\n\n${escapeHtml(structured)}\n\n<i>${escapeHtml(commentary)}</i>`;
}

// ─── Send Briefing ────────────────────────

async function sendBriefing(
  telegram: Telegram,
  ownerId: number,
  sessionType: SessionType,
): Promise<void> {
  try {
    const message = await buildBriefing(sessionType);
    await sendTelegramText(telegram, ownerId, message, { parseMode: "HTML" });
    await kvSet("nereus_last_run", new Date().toISOString()).catch(() => undefined);
    await appendActivityLog({
      deity: "nereus",
      timestamp: new Date().toISOString(),
      type: "briefing_delivered",
      summary: `${sessionType} briefing delivered.`,
    }).catch(() => undefined);
    console.log(`[nereus] ${sessionType} briefing sent`);
  } catch (err) {
    console.error(`[nereus] ${sessionType} briefing failed:`, err);
    const message = err instanceof Error ? err.message : String(err);
    await sendTelegramText(
      telegram,
      ownerId,
      `⚠️ [nereus] Briefing failed: ${message.slice(0, 400)}`,
    ).catch(() => undefined);
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

let preAsiaTimeout: NodeJS.Timeout | null = null;
let preAsiaInterval: NodeJS.Timeout | null = null;
let preNyTimeout: NodeJS.Timeout | null = null;
let preNyInterval: NodeJS.Timeout | null = null;

type NereusScheduleStatus = {
  active: boolean;
  preAsiaNextUtc: string;
  preNyNextUtc: string;
};

export function getNereusScheduleStatus(now = new Date()): NereusScheduleStatus {
  const preAsiaMs = msUntilUtcTime(23, 30);
  const preNyMs = msUntilUtcTime(12, 30);
  return {
    active: Boolean(preAsiaTimeout || preAsiaInterval || preNyTimeout || preNyInterval),
    preAsiaNextUtc: new Date(now.getTime() + preAsiaMs).toISOString(),
    preNyNextUtc: new Date(now.getTime() + preNyMs).toISOString(),
  };
}

export function scheduleNereus(telegram: Telegram, ownerId: number): void {
  const DAY_MS = 24 * 60 * 60_000;
  const scheduleStatus = getNereusScheduleStatus();

  // Pre-Asia: 23:30 UTC
  preAsiaTimeout = setTimeout(() => {
    sendBriefing(telegram, ownerId, "pre_asia").catch((e) =>
      console.error("[nereus] pre_asia error:", e),
    );
    preAsiaInterval = setInterval(() => {
      sendBriefing(telegram, ownerId, "pre_asia").catch((e) =>
        console.error("[nereus] pre_asia error:", e),
      );
    }, DAY_MS);
    preAsiaInterval.unref();
  }, msUntilUtcTime(23, 30));
  preAsiaTimeout.unref();

  // Pre-NY: 12:30 UTC
  preNyTimeout = setTimeout(() => {
    sendBriefing(telegram, ownerId, "pre_ny").catch((e) =>
      console.error("[nereus] pre_ny error:", e),
    );
    preNyInterval = setInterval(() => {
      sendBriefing(telegram, ownerId, "pre_ny").catch((e) =>
        console.error("[nereus] pre_ny error:", e),
      );
    }, DAY_MS);
    preNyInterval.unref();
  }, msUntilUtcTime(12, 30));
  preNyTimeout.unref();

  console.log(`[nereus] Scheduled - next briefing at: ${scheduleStatus.preAsiaNextUtc} (Pre-Asia)`);
  console.log(`[nereus] Scheduled - next briefing at: ${scheduleStatus.preNyNextUtc} (Pre-NY)`);
}

export function stopNereus(): void {
  if (preAsiaTimeout) { clearTimeout(preAsiaTimeout); preAsiaTimeout = null; }
  if (preAsiaInterval) { clearInterval(preAsiaInterval); preAsiaInterval = null; }
  if (preNyTimeout) { clearTimeout(preNyTimeout); preNyTimeout = null; }
  if (preNyInterval) { clearInterval(preNyInterval); preNyInterval = null; }
}
