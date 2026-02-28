/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: index.ts
 *
 * Description:
 * Poseidon Phase 1 Telegram entrypoint. Boots Proteus conversational mode,
 * wires owner-only command handling, and runs health/status/history controls.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { Telegraf } from "telegraf";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db";
import { config } from "@/lib/poseidon/config";
import { loadSystemPrompt, loadGroupSystemPrompt, diagnoseContext } from "@/lib/poseidon/memory";
import {
  getHistory,
  addMessage,
  bufferMessage,
  clearHistory,
  loadHistory,
} from "@/lib/poseidon/conversations";
import { getBehavior, loadBehavior } from "@/lib/poseidon/behavior";
import { getRecoverySummary, getStateSize, loadSessionState } from "@/lib/poseidon/state";
import { chat } from "@/lib/poseidon/proteus";
import { toolDefinitions, handleToolCall, getGroupToolDefinitions, setActiveGroupId } from "@/lib/poseidon/tools";
import { sendStartupAnimation } from "@/lib/poseidon/animations";
import { getTritonRuntimeStatus, startTriton, stopTriton } from "@/lib/poseidon/triton";
import { getNereusScheduleStatus, scheduleNereus, stopNereus, buildBriefing } from "@/lib/poseidon/nereus";
import { getPoseidonScheduleStatus, schedulePoseidon, stopPoseidon, sendReckoning } from "@/lib/poseidon/poseidon-god";
import { persistTurnWithRetry } from "@/lib/poseidon/turn-persistence";
import { isOwnerInGroup, isRestrictedQuery } from "@/lib/poseidon/group-policy";
import { sendTelegramText } from "@/lib/poseidon/telegram-delivery";
import { readCurationFlag } from "@/lib/poseidon/curation-flag";
import {
  upsertGroupMember,
  logGroupMessage,
  buildGroupChatHistory,
} from "@/lib/poseidon/group-memory";
import { runGroupScoring, formatLeaderboard } from "@/lib/poseidon/group-scoring";

const bot = new Telegraf(config.telegram.botToken);
const heartbeatPath = path.resolve(process.cwd(), config.stateDir, "heartbeat.json");

async function writeHeartbeat(extra: Record<string, unknown> = {}) {
  const payload = {
    lastSeenUtc: new Date().toISOString(),
    pid: process.pid,
    ...extra,
  };
  await mkdir(path.dirname(heartbeatPath), { recursive: true });
  await writeFile(heartbeatPath, JSON.stringify(payload, null, 2), "utf8");
}

async function checkDbConnection() {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

// ─── Chat Type Detection ─────────────────────

type ChatType = "private" | "group" | "supergroup" | "channel";

function isGroupChat(type: ChatType): boolean {
  return type === "group" || type === "supergroup";
}

function isAllowedGroup(chatId: number): boolean {
  return config.group.enabled && config.group.groupId === chatId;
}

// ─── Smart Interjection ──────────────────────
// Proteus can jump in on quality discussions without being mentioned.
// Cooldown prevents being noisy.

let lastInterjectionAt = 0;

const QUALITY_PATTERNS = [
  /\b(analysis|structure|divergence|confluenc|setup)\b/i,
  /\b(cot|commitment.of.traders|institutional|positioning)\b/i,
  /\b(liquidation|squeeze|cluster|heatmap)\b/i,
  /\b(funding|open.interest|oi|basis)\b/i,
  /\b(support|resistance|fib|level|sweep|displacement)\b/i,
  /\b(bias|bearish|bullish)\s+(on|for)\s+/i,
  /\b(i think|my view|imo|prediction|call)\b.*\b(btc|eth|eur|gbp|gold|oil|spy|nasdaq)\b/i,
];

function isQualityDiscussion(text: string): boolean {
  const matches = QUALITY_PATTERNS.filter((p) => p.test(text)).length;
  return matches >= 2 && text.length > 50;
}

function canInterject(): boolean {
  const now = Date.now();
  if (now - lastInterjectionAt < config.group.interjectionCooldownMs) return false;
  return true;
}

const chatQueues = new Map<number, Promise<unknown>>();

async function runSerializedByChat<T>(chatId: number, task: () => Promise<T>): Promise<T> {
  const previous = chatQueues.get(chatId) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(async () => task());
  chatQueues.set(chatId, current);

  void current.finally(() => {
    if (chatQueues.get(chatId) === current) {
      chatQueues.delete(chatId);
    }
  }).catch(() => undefined);

  return current;
}

let botUsernamePromise: Promise<string> | null = null;

async function getBotUsername(): Promise<string> {
  if (!botUsernamePromise) {
    botUsernamePromise = bot.telegram
      .getMe()
      .then((botInfo) => botInfo.username || "ProteusBot")
      .catch((error) => {
        console.warn("[poseidon] getMe failed, using fallback bot username:", error);
        return "ProteusBot";
      });
  }
  return botUsernamePromise;
}

function shouldProteusRespond(text: string, botUsername: string): { respond: boolean; reason: string } {
  // Check explicit mention
  const mentionRegex = new RegExp(`@${botUsername}\\b`, "i");
  if (mentionRegex.test(text)) {
    return { respond: true, reason: "mention" };
  }

  // Check /ask command style
  if (text.startsWith("/ask ")) {
    return { respond: true, reason: "ask_command" };
  }

  // Check smart interjection on quality discussions
  if (isQualityDiscussion(text) && canInterject()) {
    return { respond: true, reason: "interjection" };
  }

  return { respond: false, reason: "none" };
}

// ─── Middleware ───────────────────────────────

bot.use(async (ctx, next) => {
  const chatType = ctx.chat?.type as ChatType | undefined;
  const userId = ctx.from?.id;

  if (!chatType || !userId) return;

  // Private chat: owner only
  if (chatType === "private") {
    if (userId !== config.telegram.ownerId) return;
    return next();
  }

  // Group chat: only allowed group
  if (isGroupChat(chatType)) {
    const chatId = ctx.chat?.id;
    if (!chatId || !isAllowedGroup(chatId)) return;
    return next();
  }

  // All other chat types: ignore
});

bot.command("start", async (ctx) => {
  await writeHeartbeat({ event: "start_command" }).catch(() => undefined);

  const diag = await diagnoseContext();
  const dbOk = await checkDbConnection();
  const recovery = await getRecoverySummary();
  const chatId = ctx.chat?.id;
  if (typeof chatId !== "number") return;
  await sendStartupAnimation(ctx.telegram, chatId, {
    memoryFiles: diag.loaded.length,
    dbConnected: dbOk,
    stateRecovered: !!recovery,
  });

  const systemPrompt = await loadSystemPrompt();
  const greeting = await chat(
    systemPrompt,
    [
      {
        role: "user",
        content: "[SYSTEM: You just came online. Greet Freedom briefly. 1-2 sentences max. Be yourself - sharp, casual, ready. Do NOT call any tools. Do NOT present any data.]",
      },
    ],
    [],
    undefined,
  );

  await addMessage("assistant", greeting.persistText);
  await sendTelegramText(ctx.telegram, chatId, greeting.displayText, { parseMode: "Markdown" });
});

bot.command("health", async (ctx) => {
  await writeHeartbeat({ event: "health_command" }).catch(() => undefined);
  const diag = await diagnoseContext();
  const dbOk = await checkDbConnection();
  const message = [
    "Proteus Online",
    `Memory: ${diag.loaded.length} files (${diag.totalChars} chars)`,
    `Missing: ${diag.missing.join(", ") || "none"}`,
    `DB: ${dbOk ? "connected" : "DISCONNECTED"}`,
  ].join("\n");
  await ctx.reply(message);
});

bot.command("status", async (ctx) => {
  await writeHeartbeat({ event: "status_command" }).catch(() => undefined);
  const state = await handleToolCall("get_bot_state", {});
  const payload = `\`\`\`\n${state}\n\`\`\``;
  const chatId = ctx.chat?.id;
  if (typeof chatId !== "number") return;
  await sendTelegramText(ctx.telegram, chatId, payload, { parseMode: "Markdown" });
});

bot.command("clear", async (ctx) => {
  await writeHeartbeat({ event: "clear_command" }).catch(() => undefined);
  await clearHistory();
  await ctx.reply("Conversation history cleared.");
});

bot.command("briefing", async (ctx) => {
  await writeHeartbeat({ event: "briefing_command" }).catch(() => undefined);
  await ctx.sendChatAction("typing");
  const chatId = ctx.chat?.id;
  if (typeof chatId !== "number") return;
  try {
    const message = await buildBriefing("pre_ny");
    await sendTelegramText(ctx.telegram, chatId, message, { parseMode: "HTML" });
  } catch (error) {
    console.error("[poseidon] briefing command error:", error);
    await sendTelegramText(ctx.telegram, chatId, "Nereus could not assemble the briefing. Check logs.");
  }
});

bot.command("reckoning", async (ctx) => {
  await writeHeartbeat({ event: "reckoning_command" }).catch(() => undefined);
  await ctx.sendChatAction("typing");
  await sendReckoning(ctx.telegram, config.telegram.ownerId);
});

bot.command("leaderboard", async (ctx) => {
  const chatType = ctx.chat?.type as ChatType;
  const groupId = ctx.chat?.id;
  if (!groupId) return;

  // Works in both group (shows publicly) and DM (Freedom can check from DM)
  const targetGroupId = isGroupChat(chatType) ? groupId : config.group.groupId;
  if (!targetGroupId) {
    await ctx.reply("No group configured.");
    return;
  }

  try {
    const board = await formatLeaderboard(targetGroupId);
    const chatId = ctx.chat?.id;
    if (typeof chatId !== "number") return;
    await sendTelegramText(ctx.telegram, chatId, board, { parseMode: "Markdown" });
  } catch (error) {
    console.error("[poseidon] leaderboard error:", error);
    await ctx.reply("Could not load leaderboard.");
  }
});

bot.command("scores", async (ctx) => {
  // Alias for /leaderboard, DM only (Freedom command)
  if (ctx.chat?.type !== "private") return;
  const targetGroupId = config.group.groupId;
  if (!targetGroupId) {
    await ctx.reply("No group configured.");
    return;
  }
  try {
    const board = await formatLeaderboard(targetGroupId);
    const chatId = ctx.chat?.id;
    if (typeof chatId !== "number") return;
    await sendTelegramText(ctx.telegram, chatId, board, { parseMode: "Markdown" });
  } catch (error) {
    console.error("[poseidon] scores error:", error);
    await ctx.reply("Could not load scores.");
  }
});

bot.command("deitystatus", async (ctx) => {
  const chatId = ctx.chat?.id;
  if (typeof chatId !== "number") return;
  if (ctx.from?.id !== config.telegram.ownerId) return;

  try {
    const [behavior, curationFlag, stateSize] = await Promise.all([
      getBehavior(),
      readCurationFlag(),
      getStateSize(),
    ]);
    const triton = getTritonRuntimeStatus();
    const nereus = getNereusScheduleStatus();
    const poseidon = getPoseidonScheduleStatus();

    const lines = [
      "Deity Runtime Status",
      "",
      `Triton: ${triton.running ? "running" : "stopped"}${triton.inFlight ? " (polling)" : ""}`,
      `Triton last poll: ${triton.lastPollFinishedAt ?? "n/a"}${triton.lastPollDurationMs !== null ? ` (${triton.lastPollDurationMs}ms)` : ""}`,
      `Triton last error: ${triton.lastPollError ?? "none"}`,
      `Triton skipped tick: ${triton.lastPollSkippedAt ?? "n/a"}`,
      "",
      `Nereus schedule: ${nereus.active ? "active" : "inactive"}`,
      `Nereus next pre-asia: ${nereus.preAsiaNextUtc}`,
      `Nereus next pre-ny: ${nereus.preNyNextUtc}`,
      "",
      `Poseidon schedule: ${poseidon.active ? "active" : "inactive"}`,
      `Poseidon next reckoning: ${poseidon.nextReckoningUtc}`,
      `Curation flag: ${curationFlag.requested ? `requested (${curationFlag.reason || "no reason"})` : "clear"}`,
      "",
      `State size: ${stateSize} chars`,
      `Behavior alertsEnabled: ${behavior.alertsEnabled}`,
      `Behavior milestoneAlerts: ${behavior.milestoneAlerts}`,
      `Behavior biasAlerts: ${behavior.biasAlerts}`,
      `Behavior errorAlerts: ${behavior.errorAlerts}`,
      `Behavior verboseMode: ${behavior.verboseMode}`,
    ];

    await sendTelegramText(ctx.telegram, chatId, lines.join("\n"));
  } catch (error) {
    console.error("[poseidon] deitystatus error:", error);
    await sendTelegramText(ctx.telegram, chatId, "Could not load deity runtime status.");
  }
});

// ─── Private Text Handler ────────────────────

bot.on("text", async (ctx) => {
  const userMessage = ctx.message.text;
  if (userMessage.startsWith("/")) return;

  const chatType = ctx.chat?.type as ChatType;
  const chatId = ctx.chat?.id;
  if (typeof chatId !== "number") return;

  await runSerializedByChat(chatId, async () => {
    // ─── GROUP TEXT HANDLER ──────────────────────
    if (isGroupChat(chatType)) {
      const groupId = chatId;
      const userId = ctx.from?.id;
      if (!userId) return;

      try {
        // Always log + register member
        await upsertGroupMember(
          groupId,
          userId,
          ctx.from?.username || null,
          ctx.from?.first_name || null,
        );
        await logGroupMessage(
          groupId,
          ctx.message.message_id,
          userId,
          userMessage,
        );

        const botUsername = await getBotUsername();

        // Determine if Proteus should respond
        const decision = shouldProteusRespond(userMessage, botUsername);

        // Freedom asking restricted data in group → DM redirect
        if (decision.respond && isOwnerInGroup(userId) && isRestrictedQuery(userMessage)) {
          await sendTelegramText(ctx.telegram, groupId, "Sent you the details privately.", {
            replyToMessageId: ctx.message.message_id,
          });
          // Forward to private handler via DM (use full private prompt + tools)
          const privatePrompt = await loadSystemPrompt();
          const dmResponse = await chat(
            privatePrompt,
            [{ role: "user", content: userMessage }],
            toolDefinitions,
          );
          await sendTelegramText(ctx.telegram, config.telegram.ownerId, dmResponse.displayText, {
            parseMode: "Markdown",
          });
          return;
        }

        if (!decision.respond) return;

        // Mark interjection timestamp
        if (decision.reason === "interjection") {
          lastInterjectionAt = Date.now();
        }

        // Update message as triggering Proteus
        await logGroupMessage(
          groupId,
          ctx.message.message_id,
          userId,
          userMessage,
          "text",
          true,
        );

        // Build group system prompt and chat history
        let response: Awaited<ReturnType<typeof chat>>;
        setActiveGroupId(groupId);
        try {
          const systemPrompt = await loadGroupSystemPrompt(groupId);
          const groupHistory = await buildGroupChatHistory(groupId, 30);
          const groupTools = getGroupToolDefinitions();

          response = await chat(
            systemPrompt,
            groupHistory,
            groupTools,
            () => ctx.sendChatAction("typing"),
          );
        } finally {
          setActiveGroupId(null);
        }

        // Log Proteus's response as a group message too
        await logGroupMessage(groupId, null, config.telegram.ownerId, response.persistText, "text", false);

        await sendTelegramText(ctx.telegram, groupId, response.displayText, {
          parseMode: "Markdown",
          replyToMessageId: ctx.message.message_id,
        });
      } catch (error) {
        console.error("[poseidon] group text handler error:", error);
        // DM Freedom the error instead of spamming the group
        const errMsg = error instanceof Error ? error.message : String(error);
        await sendTelegramText(
          ctx.telegram,
          config.telegram.ownerId,
          `⚠️ Group handler error: ${errMsg.slice(0, 500)}`,
        ).catch(() => undefined);
      }
      return;
    }

    // ─── PRIVATE TEXT HANDLER ────────────────────
    try {
      await writeHeartbeat({ event: "text_message" }).catch(() => undefined);
      const systemPrompt = await loadSystemPrompt();
      const historyBefore = await getHistory();
      const isNewConversation = historyBefore.length === 0;
      if (isNewConversation) {
        systemPrompt.dynamicPart += "\n\nThis is the start of a new conversation. Greet Freedom briefly. Do NOT call any tools unless he asks for specific data.";
      }

      await bufferMessage(
        userMessage,
        ctx.from?.username || ctx.from?.first_name || undefined,
      );
      const history = await getHistory();

      const response = await chat(
        systemPrompt,
        history,
        toolDefinitions,
        () => ctx.sendChatAction("typing"),
      );

      await addMessage("assistant", response.persistText);
      await persistTurnWithRetry(userMessage, response.persistText);
      await sendTelegramText(ctx.telegram, chatId, response.displayText, { parseMode: "Markdown" });
    } catch (error) {
      console.error("[poseidon] text handler error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await persistTurnWithRetry(
        userMessage,
        `[System error while generating response] ${errorMessage.slice(0, 400)}`,
      ).catch(() => undefined);

      if (/timed out/i.test(errorMessage)) {
        await sendTelegramText(
          ctx.telegram,
          chatId,
          "Proteus timed out while processing that request. Your message was still logged to memory. Send it again and I will continue.",
        );
        return;
      }

      await sendTelegramText(ctx.telegram, chatId, "Proteus hit an error while processing that request. Try again.");
    }
  });
});

function is409Error(error: unknown): boolean {
  // Check TelegramError response shape
  if (
    error instanceof Error &&
    "response" in error &&
    (error as { response?: { error_code?: number } }).response?.error_code === 409
  ) {
    return true;
  }
  // Fallback: check error message string for 409/conflict
  if (error instanceof Error && /409.*conflict|conflict.*409/i.test(error.message)) {
    return true;
  }
  return false;
}

const MAX_LAUNCH_ATTEMPTS = 20;
let shutdownRequested = false;

async function launchBotWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_LAUNCH_ATTEMPTS; attempt += 1) {
    if (shutdownRequested) {
      console.log("[poseidon] Shutdown requested, aborting launch retry loop.");
      process.exit(0);
    }

    try {
      // Clear any stale webhook/polling state before each attempt
      await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => undefined);

      await bot.launch({ dropPendingUpdates: true });
      return;
    } catch (error: unknown) {
      if (!is409Error(error)) throw error;

      if (attempt === MAX_LAUNCH_ATTEMPTS) {
        console.error(`[poseidon] 409 conflict persisted after ${MAX_LAUNCH_ATTEMPTS} attempts, giving up.`);
        throw error;
      }

      // Exponential backoff: 5s, 8s, 11s, 14s... capped at 30s
      // Gives the old instance up to ~90s total to die
      const delay = Math.min(30_000, 5_000 + (attempt - 1) * 3_000);
      console.warn(
        `[poseidon] 409 conflict on attempt ${attempt}/${MAX_LAUNCH_ATTEMPTS}, retrying in ${delay / 1000}s...`,
      );
      await new Promise((r) => setTimeout(r, delay));

      // Stop the bot to reset Telegraf internal state before retrying
      try { bot.stop("retry"); } catch { /* ignore if not started */ }
    }
  }
}

async function detectPendingOfflineMessages(): Promise<boolean> {
  try {
    const info = await bot.telegram.getWebhookInfo();
    return (info.pending_update_count ?? 0) > 0;
  } catch {
    return false;
  }
}

async function start() {
  console.log("[poseidon] Starting...");

  // Register shutdown handlers IMMEDIATELY so SIGTERM kills the process
  // even if we're stuck in the launch retry loop
  function handleShutdown(signal: string) {
    console.log(`[poseidon] ${signal} received, shutting down...`);
    shutdownRequested = true;
    stopPoseidon();
    stopNereus();
    stopTriton();
    try { bot.stop(signal); } catch { /* may not be running */ }

    // Force exit after 5s grace period — prevents zombie instances
    // that keep retrying and block the next deploy
    setTimeout(() => {
      console.log("[poseidon] Forcing exit after grace period.");
      process.exit(0);
    }, 5_000).unref();
  }

  process.once("SIGINT", () => handleShutdown("SIGINT"));
  process.once("SIGTERM", () => handleShutdown("SIGTERM"));

  // Start health HTTP server FIRST so Render sees port binding immediately
  const PORT = Number(process.env.PORT) || 10000;
  const startedAt = new Date().toISOString();
  let botStatus = "starting";
  createServer((_req, res) => {
    const payload = JSON.stringify({
      status: botStatus,
      service: "poseidon",
      uptime: process.uptime(),
      startedAt,
      pid: process.pid,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(payload);
  }).listen(PORT, () => {
    console.log(`[poseidon] Health server listening on port ${PORT}`);
  });

  const diag = await diagnoseContext();
  console.log(`[poseidon] Memory loaded: ${diag.loaded.join(", ")}`);
  if (diag.missing.length) {
    console.warn(`[poseidon] Missing memory files: ${diag.missing.join(", ")}`);
  }

  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
    console.log("[poseidon] DB connected");
  } catch (error) {
    console.error("[poseidon] DB connection failed:", error);
  }

  await loadHistory();
  await loadBehavior();
  await loadSessionState();
  await writeHeartbeat({ event: "startup" });
  setInterval(() => {
    writeHeartbeat({ event: "heartbeat" }).catch(() => undefined);
  }, 60_000).unref();

  const hadPendingOfflineMessages = await detectPendingOfflineMessages();
  await launchBotWithRetry();
  botStatus = "ok";
  console.log("[poseidon] Proteus online");
  try {
    await startTriton(bot.telegram, config.telegram.ownerId);
  } catch (error) {
    console.error("[poseidon] Triton failed to start:", error);
    await sendTelegramText(
      bot.telegram,
      config.telegram.ownerId,
      `⚠️ Triton failed to start: ${error instanceof Error ? error.message : String(error)}`,
    ).catch(() => undefined);
  }
  try {
    scheduleNereus(bot.telegram, config.telegram.ownerId);
  } catch (error) {
    console.error("[poseidon] Nereus scheduler failed to start:", error);
    await sendTelegramText(
      bot.telegram,
      config.telegram.ownerId,
      `⚠️ Nereus scheduler failed: ${error instanceof Error ? error.message : String(error)}`,
    ).catch(() => undefined);
  }
  try {
    schedulePoseidon(bot.telegram, config.telegram.ownerId);
  } catch (error) {
    console.error("[poseidon] Poseidon scheduler failed to start:", error);
    await sendTelegramText(
      bot.telegram,
      config.telegram.ownerId,
      `⚠️ Poseidon scheduler failed: ${error instanceof Error ? error.message : String(error)}`,
    ).catch(() => undefined);
  }

  // Group scoring schedule
  if (config.group.enabled && config.group.groupId) {
    const scoringMs = config.group.scoringIntervalHours * 60 * 60_000;
    const groupId = config.group.groupId;
    const scoringInterval = setInterval(() => {
      runGroupScoring(groupId).catch((err) =>
        console.error("[poseidon] group scoring error:", err),
      );
    }, scoringMs);
    scoringInterval.unref();
    console.log(`[poseidon] Group scoring scheduled every ${config.group.scoringIntervalHours}h for group ${groupId}`);
  }

  // Animated startup message to Freedom
  try {
    const recovery = await getRecoverySummary();
    await sendStartupAnimation(bot.telegram, config.telegram.ownerId, {
      memoryFiles: diag.loaded.length,
      dbConnected: dbOk,
      stateRecovered: !!recovery,
    });
    console.log("[poseidon] Startup animation sent to Freedom");

    // Send recovery context as follow-up if available
    if (recovery) {
      await sendTelegramText(bot.telegram, config.telegram.ownerId, recovery);
      console.log("[poseidon] Recovery context sent");
    }

    if (hadPendingOfflineMessages) {
      await sendTelegramText(
        bot.telegram,
        config.telegram.ownerId,
        "I was offline and missed some messages. Let me know if you want me to pick up where we left off.",
      );
      console.log("[poseidon] Offline-gap notification sent");
    }
  } catch (err) {
    console.warn("[poseidon] Could not send startup message:", err);
  }

}

start().catch((error) => {
  console.error("[poseidon] fatal startup error:", error);
  process.exitCode = 1;
});
