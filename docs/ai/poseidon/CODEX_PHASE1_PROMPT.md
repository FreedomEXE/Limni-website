# Codex Prompt: Poseidon Phase 1 Scaffold

> Give this entire prompt to Codex. It has everything needed to build the Phase 1 MVP.

---

## Task

Build the Poseidon Telegram bot — Phase 1 MVP. This is a Telegram bot that serves as Freedom's AI trading strategist for Limni Labs. It has two active modules in Phase 1:

1. **Proteus** — Conversational AI (Claude Sonnet 4.5) that answers Freedom's questions about the trading bot, market data, and strategy.
2. **Triton** — Alert engine that pushes trade notifications, milestone alerts, and error alerts to Freedom's Telegram DM.

## Project Setup

Poseidon lives **inside the existing limni-website codebase** — same repo, same DB, same infrastructure. The bot modules go under `src/lib/poseidon/` and the memory/state files go under `docs/ai/poseidon/`.

### Additional Dependencies to Add

Add these to the existing `package.json`:
```json
{
  "telegraf": "^4.16.0"
}
```

The project already has `@anthropic-ai/sdk`, `pg`, and TypeScript configured. Use the existing `tsconfig.json`.

---

## File Structure

Poseidon modules live inside the existing limni-website project:

```
limni-website/
├── docs/ai/poseidon/
│   ├── memory/
│   │   ├── PROTEUS_CORE.md           (already written)
│   │   ├── TRADING_FRAMEWORK.md      (already written)
│   │   ├── BOT_OPERATIONS.md         (already written)
│   │   └── MARKET_KNOWLEDGE.md       (already written)
│   └── state/
│       ├── conversations.json        (auto-created at runtime)
│       ├── behavior.json             (auto-created at runtime)
│       └── heartbeat.json            (auto-created at runtime)
├── src/lib/poseidon/
│   ├── index.ts                      — Entry point: start Telegram bot
│   ├── config.ts                     — Env vars + configuration
│   ├── proteus.ts                    — Claude API wrapper + tool use
│   ├── memory.ts                     — System prompt builder (loads .md files)
│   ├── triton.ts                     — Alert engine (templated Telegram messages)
│   ├── tools.ts                      — Proteus tool definitions + handlers
│   ├── conversations.ts              — Chat history persistence
│   └── behavior.ts                   — Runtime behavior flags
```

**Note**: The project already has `src/lib/db.ts` (or equivalent DB connection). Poseidon reuses the existing DB pool — do NOT create a separate DB module. Import from the existing codebase.

---

## Implementation Details

### 1. `src/config.ts`

Load environment variables. Export a typed config object.

```typescript
export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    ownerId: Number(process.env.TELEGRAM_OWNER_ID!),
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },
  models: {
    proteus: process.env.PROTEUS_MODEL || 'claude-sonnet-4-5-20250929',
  },
  db: {
    connectionString: process.env.DATABASE_URL!,
  },
  maxConversationHistory: Number(process.env.MAX_CONVERSATION_HISTORY || '50'),
  memoryDir: process.env.MEMORY_DIR || './memory',
  stateDir: process.env.STATE_DIR || './state',
};
```

### 2. Database Access

**Do NOT create a new DB module.** Import the existing database query function from the limni-website codebase. Look for the existing `pool` or `query` export in `src/lib/db.ts` (or similar) and import it into the Poseidon tools module.

### 3. `src/lib/poseidon/memory.ts`

Loads all `.md` files from the memory/ directory into a single system prompt string.

Pattern: same as Jarvis `memory.js`. Use `safeRead()` — try to read, log warning if missing, return null.

Files to load (in order):
1. `PROTEUS_CORE.md` — truncate to 3000 chars
2. `TRADING_FRAMEWORK.md` — truncate to 5000 chars
3. `BOT_OPERATIONS.md` — truncate to 4000 chars
4. `MARKET_KNOWLEDGE.md` — truncate to 3000 chars

Total system prompt target: <20K chars.

Export `loadSystemPrompt()` and `diagnoseContext()` (returns { loaded, missing, totalChars }).

### 4. `src/tools.ts`

Define Proteus tools as Anthropic tool definitions. Each tool executes a read-only SQL query.

**Tools to implement:**

| Tool Name | SQL Query | Returns |
|-----------|-----------|---------|
| `get_bot_state` | `SELECT * FROM bot_states ORDER BY updated_at DESC LIMIT 1` | Current bot state (lifecycle, positions, bias) |
| `get_recent_trades` | `SELECT * FROM bitget_bot_trades ORDER BY opened_at DESC LIMIT $1` | Last N trades with PnL |
| `get_recent_signals` | `SELECT * FROM bitget_bot_signals ORDER BY detected_at DESC LIMIT $1` | Last N signals |
| `get_session_ranges` | `SELECT * FROM bitget_bot_ranges WHERE range_date >= CURRENT_DATE - 1 ORDER BY range_date DESC, session_window` | Today + yesterday ranges |
| `get_market_snapshot` | `SELECT * FROM market_funding_snapshots WHERE snapshot_time_utc >= NOW() - INTERVAL '24 hours' ORDER BY snapshot_time_utc DESC` (same for OI and liquidations) | Latest market data |
| `get_weekly_bias` | `SELECT * FROM bot_states ORDER BY updated_at DESC LIMIT 1` then extract `weekly_bias` field | Current bias direction + tier |
| `get_behavior` | Read from `state/behavior.json` | Runtime flags |
| `set_behavior` | Write to `state/behavior.json` | Confirmation |

Each tool should be defined in Anthropic's tool format:
```typescript
{
  name: 'get_bot_state',
  description: 'Get the current Bitget bot state including lifecycle, open positions, weekly bias, and handshake status.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
}
```

Export `toolDefinitions` (array) and `handleToolCall(name, input)` (async function that executes the tool and returns a string result).

### 5. `src/proteus.ts`

Core Claude API wrapper with tool use support.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

export async function chat(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  tools: Anthropic.Tool[]
): Promise<string> {
  // Call Claude with tools enabled
  // Handle tool_use responses: execute tool, send result back in an agentic loop
  // Max 5 tool use rounds per message to prevent infinite loops
  // Return final text response
}
```

The agentic loop:
1. Send message to Claude with tools
2. If response contains `tool_use` blocks, execute each tool via `handleToolCall()`
3. Append tool results as `tool_result` content blocks
4. Send back to Claude
5. Repeat until Claude returns a `text` response (or 5 rounds max)

Model: `config.models.proteus` (Sonnet 4.5)
Max tokens: 2048

### 6. `src/conversations.ts`

Persist conversation history to `state/conversations.json`.

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Load from disk on startup
// Append new messages
// Trim to maxConversationHistory
// Save to disk after each message
```

Export `getHistory()`, `addMessage(role, content)`, `clearHistory()`.

### 7. `src/triton.ts`

Alert engine. Sends formatted Telegram messages. No AI model — pure templates.

```typescript
export async function sendAlert(bot: Telegraf, alertType: string, data: Record<string, any>) {
  const message = formatAlert(alertType, data);
  await bot.telegram.sendMessage(config.telegram.ownerId, message, { parse_mode: 'Markdown' });
}
```

Alert types and formats:

**TRADE_OPENED:**
```
[TRITON] Trade Opened
{symbol} {direction} @ {price}
Session: {session}
Leverage: {leverage}x | Margin: {margin} USDT
Stop: {stopPrice}
```

**TRADE_CLOSED:**
```
[TRITON] Trade Closed
{symbol} {direction} | PnL: {pnl} ({pnlPct}%)
Entry: {entryPrice} → Exit: {exitPrice}
Reason: {exitReason}
Duration: {duration}
```

**MILESTONE:**
```
[TRITON] Milestone Hit
{symbol} {direction} | +{milestone}% unrealized
Current: {currentPrice} (entry: {entryPrice})
Leverage: {leverage}x
```

**BREAKEVEN_SET:**
```
[TRITON] Breakeven Set
{symbol} {direction} | Stop moved to entry
Entry: {entryPrice}
```

**BIAS_CHANGE:**
```
[TRITON] Weekly Bias Updated
BTC: {btcDirection} ({btcTier})
ETH: {ethDirection} ({ethTier})
Source: COT + Sentiment
```

**BOT_ERROR:**
```
[TRITON] Bot Error
State: {state}
Error: {error}
Time: {timestamp}
```

**STALE_DATA:**
```
[TRITON] Stale Data Warning
{description}
Last update: {lastUpdate}
```

### 8. `src/behavior.ts`

Runtime behavior flags, persisted to `state/behavior.json`.

Default flags:
```json
{
  "alertsEnabled": true,
  "milestoneAlerts": true,
  "biasAlerts": true,
  "errorAlerts": true,
  "verboseMode": false
}
```

Export `getBehavior()`, `setBehavior(flag, value)`, `loadBehavior()`.

### 9. `src/index.ts`

Main entry point. Wires everything together.

```typescript
import { Telegraf } from 'telegraf';

const bot = new Telegraf(config.telegram.botToken);

// Owner-only middleware
bot.use((ctx, next) => {
  if (ctx.from?.id !== config.telegram.ownerId) return; // Silently ignore non-owner
  return next();
});

// On text message
bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;

  // Load system prompt (memory files)
  const systemPrompt = await loadSystemPrompt();

  // Get conversation history
  const history = getHistory();

  // Add user message to history
  addMessage('user', userMessage);

  // Send typing indicator
  await ctx.sendChatAction('typing');

  // Get response from Proteus
  const response = await chat(systemPrompt, [...history, { role: 'user', content: userMessage }], toolDefinitions);

  // Add response to history
  addMessage('assistant', response);

  // Send response
  await ctx.reply(response, { parse_mode: 'Markdown' });
});

// Health check command
bot.command('health', async (ctx) => {
  const diag = await diagnoseContext();
  const dbOk = await checkDbConnection();
  await ctx.reply(`Proteus Online\nMemory: ${diag.loaded.length} files (${diag.totalChars} chars)\nMissing: ${diag.missing.join(', ') || 'none'}\nDB: ${dbOk ? 'connected' : 'DISCONNECTED'}`);
});

// Status command
bot.command('status', async (ctx) => {
  // Quick bot state check (direct DB query, no Claude)
  const state = await handleToolCall('get_bot_state', {});
  await ctx.reply(`\`\`\`\n${state}\n\`\`\``, { parse_mode: 'Markdown' });
});

// Clear history command
bot.command('clear', async (ctx) => {
  clearHistory();
  await ctx.reply('Conversation history cleared.');
});

// Startup
async function start() {
  console.log('[poseidon] Starting...');

  // Diagnose context
  const diag = await diagnoseContext();
  console.log(`[poseidon] Memory loaded: ${diag.loaded.join(', ')}`);
  if (diag.missing.length) console.warn(`[poseidon] Missing: ${diag.missing.join(', ')}`);

  // Test DB connection
  try {
    await query('SELECT 1');
    console.log('[poseidon] DB connected');
  } catch (err) {
    console.error('[poseidon] DB connection failed:', err);
  }

  // Load behavior
  loadBehavior();

  // Start bot
  await bot.launch();
  console.log('[poseidon] Proteus online');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

start();
```

### 10. Environment Variables

Add these to the existing `.env` (the project already has `DATABASE_URL` and `ANTHROPIC_API_KEY`):

```env
# Poseidon (Telegram Bot)
TELEGRAM_BOT_TOKEN=              # From @BotFather
TELEGRAM_OWNER_ID=               # Freedom's Telegram user ID
PROTEUS_MODEL=claude-sonnet-4-5-20250929
MAX_CONVERSATION_HISTORY=50
POSEIDON_MEMORY_DIR=./docs/ai/poseidon/memory
POSEIDON_STATE_DIR=./docs/ai/poseidon/state
```

### 11. Running the Bot

Poseidon runs as a separate long-running process alongside the Next.js app. Add a script to `package.json`:

```json
{
  "scripts": {
    "poseidon": "tsx src/lib/poseidon/index.ts",
    "poseidon:dev": "tsx watch src/lib/poseidon/index.ts"
  }
}
```

On Render, Poseidon runs as a separate Worker service using `npm run poseidon`, connecting to the same Postgres instance.

---

## Important Notes

1. **Owner-only**: ALL interactions are filtered to `TELEGRAM_OWNER_ID`. Non-owner messages are silently dropped.
2. **Read-only DB**: The bot NEVER writes to the Limni database. It only reads. All persistence is local JSON files.
3. **Tool use is agentic**: Proteus decides which tools to call based on the conversation. The agentic loop handles multi-tool chains.
4. **Memory files are pre-written**: The 4 `.md` files in `memory/` are already written and will be copied in. Codex should create placeholder files that explain where to put them.
5. **Triton is not a separate process**: It's a module that Proteus can call, or that can be triggered externally via a webhook (Phase 2).
6. **No Nereus or Poseidon yet**: Those are Phase 2. Don't build them, but leave room in the architecture.
7. **Error handling**: Wrap all Claude API calls and DB queries in try/catch. Log errors. If Proteus fails, send a simple error message to Freedom, don't crash.
8. **Typing indicator**: Send `typing` action before Claude API call so Freedom sees the bot is thinking.

---

## What NOT to Build

- Nereus (Phase 2)
- Poseidon god layer (Phase 2)
- Webhook mode for Triton (Phase 2)
- Git sync (Phase 2)
- Session state file (Phase 2)
- Alt coin tools (Phase 2)

---

## Testing

After building:
1. `npm install`
2. `npx tsc` should compile with zero errors
3. Create `.env` from `.env.example` with real values
4. `npx tsx src/index.ts` should start the bot and connect to Telegram + DB
5. Send a message in DM — Proteus should respond
6. `/health` should show memory files loaded and DB connected
7. `/status` should show current bot state from DB
