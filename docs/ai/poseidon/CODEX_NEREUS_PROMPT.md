# Codex Prompt: Nereus — Full-Platform Macro Briefings

> Give this entire prompt to Codex. Nereus is the wise old man of the sea — he delivers structured pre-session briefings covering ALL of Limni.

---

## Context

Nereus is the automated analysis module of the Poseidon system. Twice per day, he gathers data from every Limni subsystem, passes it through Claude Haiku for a quick AI-generated commentary, and delivers a structured briefing to Freedom via Telegram.

Nereus is NOT a conversational AI. He runs on a schedule, queries the DB, formats a structured briefing, adds a 1-2 sentence AI insight via Haiku, and sends it via Telegram. That's it.

**Two briefings per day:**

| Briefing | Time (UTC) | Purpose |
|----------|-----------|---------|
| Pre-Asia | 23:30 UTC | Overnight setup: what to watch during Asia session |
| Pre-NY | 12:30 UTC | Midday update: Asia+London ranges established, fresh data before NY |

---

## Architecture

Nereus runs as two scheduled functions inside the Poseidon process. They can be triggered by:
1. `setTimeout`/`setInterval` calculated from current UTC time to next briefing time
2. A `/briefing` command in Telegram (manual trigger for testing)

### Briefing Flow

```
1. Query ALL subsystems (same DB as Triton, same tables)
2. Assemble structured data payload (~2-3K chars)
3. Send payload to Claude Haiku with Nereus personality prompt
4. Haiku returns the briefing with a 1-2 sentence commentary
5. Format with Nereus header + structured data
6. Send to Freedom via Telegram
```

---

## File Structure

```
src/lib/poseidon/
├── nereus.ts              — NEW: Briefing engine (scheduler + data assembly + Haiku call)
├── nereus-queries.ts      — NEW: All DB queries for briefing data
```

---

## Detailed Implementation

### 1. `src/lib/poseidon/nereus-queries.ts` — Data Gathering

All queries Nereus needs to build a complete briefing. Every function returns typed, structured data.

```typescript
// CRYPTO
async function getCryptoBriefingData(): Promise<CryptoBriefing> {
  // Weekly bias: SELECT state FROM bot_states WHERE bot_id = 'bitget_perp_v2' → extract weekly_bias
  // Bot state: lifecycle, open positions, entries this week
  // Session ranges: SELECT * FROM bitget_bot_ranges WHERE day_utc >= CURRENT_DATE - 1
  // Funding: SELECT * FROM market_funding_snapshots WHERE snapshot_time_utc > NOW() - INTERVAL '4 hours' ORDER BY snapshot_time_utc DESC LIMIT 2 (one per symbol)
  // OI: SELECT * FROM market_oi_snapshots WHERE snapshot_time_utc > NOW() - INTERVAL '4 hours' ORDER BY snapshot_time_utc DESC LIMIT 2
  // OI 24h delta: compare latest vs 24h ago
  // Liquidations: SELECT * FROM market_liquidation_snapshots ORDER BY snapshot_time_utc DESC LIMIT 2 (latest per symbol)
  // Recent trades this week: SELECT * FROM bitget_bot_trades WHERE opened_at > (current week start)
}

// FOREX
async function getForexBriefingData(): Promise<ForexBriefing> {
  // Antikythera signals: SELECT pairs FROM cot_snapshots WHERE asset_class = 'fx' ORDER BY fetched_at DESC LIMIT 1
  // OANDA bot state: SELECT state FROM bot_states WHERE bot_id = 'oanda_universal_bot'
  // Sentiment: SELECT symbol, agg_net, crowding_state, flip_state, sources_used FROM sentiment_aggregates
  //            WHERE timestamp_utc > NOW() - INTERVAL '2 hours' ORDER BY timestamp_utc DESC
  //            (deduplicate by symbol, take latest)
  // Connected OANDA accounts: SELECT account_key, analysis FROM connected_accounts WHERE provider = 'oanda'
}

// ACCOUNTS
async function getAccountsBriefingData(): Promise<AccountsBriefing> {
  // MT5 accounts: SELECT account_id, label, equity, basket_state, basket_pnl_pct, open_positions, api_ok FROM mt5_accounts WHERE status = 'ACTIVE'
  // Connected accounts: SELECT account_key, provider, status, analysis FROM connected_accounts
  // Total equity across all accounts
}

// SYSTEM HEALTH
async function getSystemHealthData(): Promise<SystemHealth> {
  // Use getCronStatusSummary() from src/lib/cronStatus.ts (if importable)
  // OR query the tables directly for last refresh timestamps
  // Return: each cron subsystem status (ok/stale/error)
}

// NEWS
async function getNewsBriefingData(): Promise<NewsBriefing> {
  // SELECT calendar FROM news_weekly_snapshots ORDER BY fetched_at DESC LIMIT 1
  // Parse for events in next 24 hours with impact = 'HIGH'
  // Return: list of upcoming high-impact events with time, currency, forecast, previous
}

// PERFORMANCE (Pre-NY only — weekly results from current week)
async function getPerformanceData(): Promise<PerformanceBriefing> {
  // SELECT model, percent, returns FROM performance_snapshots WHERE week_open_utc = (current week) ORDER BY model
  // Return: per-model win rates for current week
}
```

### 2. `src/lib/poseidon/nereus.ts` — Briefing Engine

#### Nereus Personality (Haiku System Prompt)

```typescript
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
```

#### Briefing Assembly

```typescript
async function buildBriefing(sessionType: "pre_asia" | "pre_ny"): Promise<string> {
  // 1. Gather all data
  const crypto = await getCryptoBriefingData();
  const forex = await getForexBriefingData();
  const accounts = await getAccountsBriefingData();
  const health = await getSystemHealthData();
  const news = await getNewsBriefingData();
  const performance = sessionType === "pre_ny" ? await getPerformanceData() : null;

  // 2. Format structured section
  const structured = formatBriefingData(sessionType, { crypto, forex, accounts, health, news, performance });

  // 3. Get Haiku commentary
  const commentary = await getHaikuCommentary(structured);

  // 4. Combine with Nereus header
  return formatNereusBriefing(sessionType, structured, commentary);
}
```

#### Nereus Header & Formatting

```typescript
function formatNereusBriefing(sessionType: string, structured: string, commentary: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toISOString().split("T")[1].slice(0, 5);
  const sessionLabel = sessionType === "pre_asia" ? "Pre-Asia Briefing" : "Pre-NY Briefing";

  const header = [
    "┌────────────────────────────┐",
    "│      N E R E U S           │",
    "│    The Old Man of the Sea  │",
    "├────────────────────────────┤",
    `│  ${sessionLabel.padEnd(26)}│`,
    `│  ${dateStr} · ${timeStr} UTC`.padEnd(29) + "│",
    "└────────────────────────────┘",
  ].join("\n");

  return `<pre>${escapeHtml(header)}</pre>\n\n${structured}\n\n<i>${escapeHtml(commentary)}</i>`;
}
```

#### Structured Data Format

The structured section should look like this in the Telegram message:

```
CRYPTO
  Bias: BTC SHORT (T1) | ETH SHORT (T1)
  Bot: WATCHING_SWEEP | 0 positions
  Ranges: BTC 95,800-97,200 | ETH 2,660-2,720
  OI: BTC +2.3% (24h) | ETH -1.1%
  Funding: BTC -0.008% | ETH -0.012%
  Trades this week: 2 (1W, 1L)

FOREX
  Signals: EURUSD SHORT, GBPUSD SHORT, AUDUSD LONG
  OANDA Bot: entered | 5 positions | +1.2% unreal
  Crowding: EURUSD CROWDED_SHORT

ACCOUNTS
  MT5: 2 active | $12,450 equity | basket OPEN
  OANDA: 1 connected | margin 18%
  Bitget: demo mode | no positions

SYSTEM
  Crons: all healthy ✓
  Data: all fresh ✓

NEWS
  ⚠ USD NFP in 6h (13:30 UTC) | F: 180K P: 256K
```

Keep it tight. Use abbreviations (F = Forecast, P = Previous, unreal = unrealized). This is Telegram, not a report.

#### Haiku Call

```typescript
async function getHaikuCommentary(structuredData: string): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const response = await client.messages.create({
    model: config.models.nereus, // claude-haiku-4-5-20251001
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
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return text || "The seas are still.";
}
```

Cost: ~$0.001 per briefing (Haiku is extremely cheap). 2 briefings/day = ~$0.06/month.

#### Scheduler

```typescript
function scheduleNereus(telegram: Telegram, ownerId: number): void {
  // Calculate ms until next 23:30 UTC and next 12:30 UTC
  // Use setTimeout for the first one, then setInterval(24h) for recurring

  function msUntilUtcTime(hour: number, minute: number): number {
    const now = new Date();
    const target = new Date(now);
    target.setUTCHours(hour, minute, 0, 0);
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    return target.getTime() - now.getTime();
  }

  // Pre-Asia: 23:30 UTC
  setTimeout(async () => {
    await sendBriefing(telegram, ownerId, "pre_asia");
    setInterval(() => sendBriefing(telegram, ownerId, "pre_asia"), 24 * 60 * 60_000);
  }, msUntilUtcTime(23, 30));

  // Pre-NY: 12:30 UTC
  setTimeout(async () => {
    await sendBriefing(telegram, ownerId, "pre_ny");
    setInterval(() => sendBriefing(telegram, ownerId, "pre_ny"), 24 * 60 * 60_000);
  }, msUntilUtcTime(12, 30));

  console.log("[nereus] Briefings scheduled: Pre-Asia 23:30 UTC, Pre-NY 12:30 UTC");
}

async function sendBriefing(telegram: Telegram, ownerId: number, sessionType: "pre_asia" | "pre_ny"): Promise<void> {
  try {
    const message = await buildBriefing(sessionType);
    await telegram.sendMessage(ownerId, message, { parse_mode: "HTML" });
    console.log(`[nereus] ${sessionType} briefing sent`);
  } catch (err) {
    console.error(`[nereus] ${sessionType} briefing failed:`, err);
  }
}
```

#### Manual Trigger

Add a `/briefing` command in `index.ts`:

```typescript
bot.command("briefing", async (ctx) => {
  await ctx.sendChatAction("typing");
  const message = await buildBriefing("pre_ny"); // default to pre-NY format
  await ctx.reply(message, { parse_mode: "HTML" });
});
```

### 3. `src/lib/poseidon/index.ts` — Wire Nereus

Add to the `start()` function, after Triton starts:

```typescript
import { scheduleNereus } from "@/lib/poseidon/nereus";

// In start(), after Triton:
scheduleNereus(bot.telegram, config.telegram.ownerId);
```

### 4. `src/lib/poseidon/config.ts` — Add Nereus Model

Ensure the Nereus model is configured:

```typescript
models: {
  proteus: process.env.PROTEUS_MODEL || "claude-sonnet-4-5-20250929",
  nereus: process.env.NEREUS_MODEL || "claude-haiku-4-5-20251001",
},
```

### 5. `src/lib/poseidon/animations.ts` — Update Nereus Header

Replace the current `buildNereusHeader()` with the scroll-style header:

```typescript
export function buildNereusHeader(sessionType: string, dateStr: string, timeStr: string): string {
  const label = sessionType === "pre_asia" ? "Pre-Asia Briefing" : "Pre-NY Briefing";
  return [
    TOP,
    cRow("N E R E U S"),
    cRow("The Old Man of the Sea"),
    MID,
    row(` ${label}`),
    row(` ${dateStr} \u00B7 ${timeStr} UTC`),
    BTM,
  ].join("\n");
}
```

---

## Files NOT to Modify

- `src/lib/poseidon/proteus.ts` — leave as-is
- `src/lib/poseidon/memory.ts` — leave as-is
- `src/lib/poseidon/conversations.ts` — leave as-is
- `src/lib/poseidon/triton-alerts.ts` — leave as-is (Nereus sends via Telegram directly, not through Triton)
- `src/lib/poseidon/triton-monitors.ts` — leave as-is
- `docs/ai/poseidon/memory/*` — leave as-is
- Any files in `src/` outside of `src/lib/poseidon/` — DO NOT TOUCH
- Database schema — DO NOT modify. Read-only queries only.

---

## Acceptance Criteria

1. `npx tsc` compiles clean (or only pre-existing errors outside poseidon/)
2. `nereus.ts` implements the full briefing engine with scheduler
3. `nereus-queries.ts` gathers data from ALL subsystems (crypto, forex, accounts, system health, news, performance)
4. Haiku generates 1-3 sentence commentary using the Nereus personality
5. Briefings are scheduled at 23:30 UTC (Pre-Asia) and 12:30 UTC (Pre-NY)
6. `/briefing` command triggers a manual briefing
7. Briefing format is compact, mobile-readable, uses abbreviations
8. Nereus header uses the scroll-style box with session type and date
9. Config includes `nereus` model ID
10. Wired into `index.ts` via `scheduleNereus()`
11. No files outside `src/lib/poseidon/` and `docs/ai/poseidon/` modified
12. All existing functionality (Proteus chat, Triton alerts, commands) still works

---

## Testing

After building:
1. `npx tsc` — should compile clean
2. Start bot: `npx tsx src/lib/poseidon/index.ts`
3. Console should show `[nereus] Briefings scheduled: Pre-Asia 23:30 UTC, Pre-NY 12:30 UTC`
4. Send `/briefing` in Telegram — should receive a formatted briefing within 10 seconds
5. Briefing should contain sections for CRYPTO, FOREX, ACCOUNTS, SYSTEM, NEWS
6. Bottom should have an italicized Haiku-generated commentary
7. Proteus chat should still work
8. Triton alerts should still work
