/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: animations.ts
 *
 * Description:
 * ASCII art animations and branded headers for the Poseidon system.
 * Uses Telegram's edit-message technique for smooth frame-by-frame
 * animation on startup. All art is 30 chars wide (mobile-safe).
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { Telegram } from "telegraf";

const FRAME_DELAY = 400;
const W = 28; // inner width between box borders

// ─── Helpers ─────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pre(text: string): string {
  return `<pre>${escapeHtml(text)}</pre>`;
}

function center(text: string): string {
  const gap = Math.max(0, W - text.length);
  const l = Math.floor(gap / 2);
  return " ".repeat(l) + text + " ".repeat(gap - l);
}

function row(text: string): string {
  return `\u2502${text.padEnd(W).slice(0, W)}\u2502`;
}

function cRow(text: string): string {
  return `\u2502${center(text)}\u2502`;
}

const TOP = `\u250C${"\u2500".repeat(W)}\u2510`;
const MID = `\u251C${"\u2500".repeat(W)}\u2524`;
const BTM = `\u2514${"\u2500".repeat(W)}\u2518`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Proteus Boot Frames ─────────────────

const BOOT_FRAMES = [
  "> initializing proteus...",

  "> initializing proteus...\n" +
  "> loading memory banks...",

  "> initializing proteus...\n" +
  "> loading memory banks...\n" +
  "> connecting to database...",

  "> initializing proteus...\n" +
  "> loading memory banks...\n" +
  "> connecting to database...\n" +
  "> recovering session state...",
];

// ─── Banners ─────────────────────────────

export type StartupStats = {
  memoryFiles: number;
  dbConnected: boolean;
  stateRecovered: boolean;
};

export function buildProteusBanner(stats: StartupStats): string {
  return [
    TOP,
    cRow("P R O T E U S"),
    cRow("Limni Labs AI"),
    MID,
    row(` Memory .. ${String(stats.memoryFiles)} files`),
    row(` DB ...... ${stats.dbConnected ? "connected" : "DOWN"}`),
    row(` State ... ${stats.stateRecovered ? "recovered" : "fresh"}`),
    BTM,
  ].join("\n");
}

export type AlertStyle =
  | "trade_open"
  | "trade_close"
  | "milestone"
  | "breakeven"
  | "bias_change"
  | "bot_error"
  | "stale_data";

const ALERT_LABELS: Record<AlertStyle, string> = {
  trade_open: "TRADE OPENED",
  trade_close: "TRADE CLOSED",
  milestone: "MILESTONE HIT",
  breakeven: "BREAKEVEN SET",
  bias_change: "BIAS CHANGED",
  bot_error: "BOT ERROR",
  stale_data: "STALE DATA",
};

export function buildTritonHeader(style: AlertStyle): string {
  return [TOP, cRow("T R I T O N"), cRow(ALERT_LABELS[style] ?? "ALERT"), BTM].join("\n");
}

export function buildNereusHeader(): string {
  return [TOP, cRow("N E R E U S"), cRow("Session Briefing"), BTM].join("\n");
}

export function buildPoseidonHeader(): string {
  return [TOP, cRow("P O S E I D O N"), cRow("Daily Oversight"), BTM].join("\n");
}

/**
 * Wrap any body text with a deity header for Telegram.
 * Returns HTML-ready string (pre-formatted with header).
 */
export function formatBotMessage(header: string, body: string): string {
  return pre(`${header}\n\n${body}`);
}

// ─── Animation Engine ────────────────────

export async function sendStartupAnimation(
  telegram: Telegram,
  chatId: number,
  stats: StartupStats,
): Promise<void> {
  try {
    // Send first boot frame
    const msg = await telegram.sendMessage(chatId, pre(BOOT_FRAMES[0]), {
      parse_mode: "HTML",
    });

    // Animate through remaining boot frames
    for (let i = 1; i < BOOT_FRAMES.length; i++) {
      await sleep(FRAME_DELAY);
      await telegram.editMessageText(
        chatId,
        msg.message_id,
        undefined,
        pre(BOOT_FRAMES[i]),
        { parse_mode: "HTML" },
      );
    }

    // Final banner with live stats
    await sleep(FRAME_DELAY);
    await telegram.editMessageText(
      chatId,
      msg.message_id,
      undefined,
      pre(buildProteusBanner(stats)),
      { parse_mode: "HTML" },
    );
  } catch (error) {
    console.warn("[poseidon.animation] Animation failed:", error);
    // Fallback: send banner as new message
    try {
      await telegram.sendMessage(chatId, pre(buildProteusBanner(stats)), {
        parse_mode: "HTML",
      });
    } catch {
      // Silent — startup shouldn't crash on animation failure
    }
  }
}
