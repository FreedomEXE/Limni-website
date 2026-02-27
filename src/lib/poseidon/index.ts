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
import { loadSystemPrompt, diagnoseContext } from "@/lib/poseidon/memory";
import { getHistory, addMessage, clearHistory, loadHistory } from "@/lib/poseidon/conversations";
import { loadBehavior } from "@/lib/poseidon/behavior";
import { getRecoverySummary, loadSessionState } from "@/lib/poseidon/state";
import { chat } from "@/lib/poseidon/proteus";
import { toolDefinitions, handleToolCall } from "@/lib/poseidon/tools";
import { sendStartupAnimation } from "@/lib/poseidon/animations";

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

bot.use(async (ctx, next) => {
  if (ctx.from?.id !== config.telegram.ownerId) return;
  return next();
});

bot.command("start", async (ctx) => {
  await writeHeartbeat({ event: "start_command" }).catch(() => undefined);
  await ctx.reply("Proteus online. Send me a message to begin.");
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
  await ctx.reply(payload, { parse_mode: "Markdown" });
});

bot.command("clear", async (ctx) => {
  await writeHeartbeat({ event: "clear_command" }).catch(() => undefined);
  await clearHistory();
  await ctx.reply("Conversation history cleared.");
});

bot.on("text", async (ctx) => {
  const userMessage = ctx.message.text;
  if (userMessage.startsWith("/")) return;

  try {
    await writeHeartbeat({ event: "text_message" }).catch(() => undefined);
    const systemPrompt = await loadSystemPrompt();
    const history = await getHistory();
    await addMessage("user", userMessage);

    await ctx.sendChatAction("typing");

    const response = await chat(
      systemPrompt,
      [...history, { role: "user", content: userMessage }],
      toolDefinitions,
    );

    await addMessage("assistant", response);
    await ctx.reply(response, { parse_mode: "Markdown" }).catch(async () => {
      await ctx.reply(response);
    });
  } catch (error) {
    console.error("[poseidon] text handler error:", error);
    await ctx.reply("Proteus hit an error while processing that request. Try again.");
  }
});

async function launchBotWithRetry(maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await bot.launch({ dropPendingUpdates: true });
      return;
    } catch (error: unknown) {
      const is409 =
        error instanceof Error && "response" in error &&
        (error as { response?: { error_code?: number } }).response?.error_code === 409;
      if (!is409 || attempt === maxAttempts) throw error;
      const delay = attempt * 3_000;
      console.warn(`[poseidon] 409 conflict on attempt ${attempt}/${maxAttempts}, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function start() {
  console.log("[poseidon] Starting...");

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

  await launchBotWithRetry();
  botStatus = "ok";
  console.log("[poseidon] Proteus online");

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
      await bot.telegram.sendMessage(config.telegram.ownerId, recovery);
      console.log("[poseidon] Recovery context sent");
    }
  } catch (err) {
    console.warn("[poseidon] Could not send startup message:", err);
  }

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

start().catch((error) => {
  console.error("[poseidon] fatal startup error:", error);
  process.exitCode = 1;
});
