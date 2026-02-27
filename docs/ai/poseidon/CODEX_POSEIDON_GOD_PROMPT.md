# Codex Prompt: Poseidon — The God Layer (Daily Reckoning)

> Give this entire prompt to Codex. Poseidon is the god of the sea — once per day he surveys his entire kingdom and delivers a reckoning.

---

## Context

Poseidon is the supreme intelligence layer of the Limni AI system. Once per day, he awakens. Powered by Claude Opus 4, he reviews everything that happened in the last 24 hours across ALL Limni systems — every trade, every signal, every bot, every account, every anomaly — and delivers a single authoritative briefing to Freedom.

Poseidon speaks once. His words carry weight. He is not verbose. He is not casual. He is a god surveying his domain.

**Schedule**: Daily at 06:00 UTC (after the prior day is fully settled, before any new session activity).

---

## Architecture

Poseidon is a single scheduled function that:
1. Gathers 24 hours of data from every Limni subsystem
2. Assembles a structured data payload (~3-5K tokens)
3. Sends it to Claude Opus 4 with the Poseidon personality prompt
4. Opus returns the reckoning (~300-800 tokens)
5. Formats with the Poseidon header and sends to Freedom via Telegram

**Cost**: ~$0.10-0.30 per day (one Opus call). Negligible.

---

## File Structure

```
src/lib/poseidon/
├── poseidon-god.ts        — NEW: Daily reckoning engine (scheduler + data assembly + Opus call)
```

Poseidon reuses `nereus-queries.ts` for data gathering (same queries, different time window — 24h lookback instead of current state).

---

## Detailed Implementation

### 1. Poseidon Personality (Opus System Prompt)

```typescript
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
```

### 2. Data Assembly (24h Lookback)

```typescript
async function gatherReckoningData(): Promise<string> {
  // TRADES (last 24h)
  // Bitget: SELECT * FROM bitget_bot_trades WHERE opened_at > NOW() - INTERVAL '24 hours' OR exit_time_utc > NOW() - INTERVAL '24 hours'
  // MT5: SELECT * FROM mt5_closed_positions WHERE close_time > NOW() - INTERVAL '24 hours'
  // OANDA: SELECT state FROM bot_states WHERE bot_id = 'oanda_universal_bot' → check for trail exits

  // SIGNALS (last 24h)
  // SELECT * FROM bitget_bot_signals WHERE detected_at > NOW() - INTERVAL '24 hours'
  // Count: taken (FILLED), skipped (SKIPPED), expired (EXPIRED)

  // BOT HEALTH
  // Bitget: lifecycle state, any errors in last 24h, uptime
  // OANDA: last updated_at, any gaps > 2 min
  // MT5: api_ok status for all active accounts, last_sync gaps

  // ACCOUNT HEALTH
  // MT5: equity change (24h delta), basket_pnl_pct
  // Connected: equity change, margin usage, position count changes
  // Total portfolio value across all accounts

  // WEEKLY BIAS
  // Current bias direction + tier for BTC/ETH/FX pairs
  // Did bias align with actual price direction in last 24h?

  // SENTIMENT
  // Any extreme crowding events in last 24h
  // Any flips
  // Provider health (any outages?)

  // SYSTEM HEALTH
  // Cron status: any failures or staleness in last 24h?
  // Data freshness across all subsystems

  // MARKET DATA
  // Funding: any extremes (>0.01)?
  // OI: any surges (>20% delta)?
  // Liquidations: any dominant_side flips?

  // NEWS
  // Any high-impact events that occurred in last 24h?
  // Any upcoming in next 24h?

  // Format everything as a structured text block for Opus
  return assembleReckoningPayload({
    trades, signals, botHealth, accountHealth,
    weeklyBias, sentiment, systemHealth, marketData, news,
  });
}
```

The payload sent to Opus should be structured plaintext (NOT markdown), roughly:

```
DAILY RECKONING DATA — Feb 26, 2026 (06:00 UTC)
Last 24 hours reviewed.

TRADES
  Bitget: 1 trade closed. BTC SHORT, +$84.20 (+4.2%). Entry 97,450 → Exit 93,360. Trailing stop.
  Bitget: 0 trades opened.
  OANDA: basket active, +1.2% unrealized, 5 positions.
  MT5: 2 positions closed. EURUSD SELL +$32, GBPUSD SELL +$18.

SIGNALS
  Bitget: 3 signals detected. 1 filled (BTC SHORT), 1 skipped (ETH, no handshake), 1 expired.

BOT HEALTH
  Bitget: WATCHING_SWEEP. No errors. 1440/1440 ticks (100% uptime).
  OANDA: active. Last tick 12 seconds ago. No errors.
  MT5: 2 accounts active. Both api_ok. Last sync 45 seconds ago.

ACCOUNTS
  MT5 total equity: $12,450 (+$50 from 24h ago, +0.4%)
  OANDA connected: $4,250 equity, 18% margin used.
  Bitget connected: demo mode, $50,000 virtual.
  Portfolio total: $66,700

WEEKLY BIAS
  BTC: SHORT (MEDIUM, 2/3 votes). Price moved -2.1% in 24h. ALIGNED.
  ETH: SHORT (HIGH, 3/3 votes). Price moved -3.4% in 24h. ALIGNED.
  FX: EURUSD SHORT (aligned), GBPUSD SHORT (aligned), AUDUSD LONG (misaligned, +0.1% but bias was LONG).

SENTIMENT
  No extreme crowding events.
  EURUSD flipped SHORT → LONG at 14:30 UTC. Note: this was AFTER the FX session close.
  All 5 providers active.

SYSTEM
  All 10 crons healthy. No staleness.
  COT data: last refresh 18h ago (normal — not Friday).

MARKET DATA
  BTC funding: -0.008% (normal negative).
  ETH funding: -0.012% (normal negative).
  OI: BTC -1.2% (24h), ETH +0.8% (24h). No surges.
  Liquidations: dominant side SHORT for both. No flips.

NEWS
  No high-impact events occurred.
  Upcoming: USD GDP (tomorrow 13:30 UTC).
```

### 3. Opus Call

```typescript
async function getReckoningFromOpus(data: string): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const response = await client.messages.create({
    model: config.models.poseidon, // claude-opus-4-20250918
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
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return text || "The seas are still. Nothing demands my attention.";
}
```

### 4. Header & Formatting

```typescript
function formatPoseidonReckoning(reckoning: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  const header = [
    "═".repeat(30),
    "       P O S E I D O N",
    "        ─── \u2629 ───",
    "       Daily Reckoning",
    `       ${dateStr}`,
    "═".repeat(30),
  ].join("\n");

  return `<pre>${escapeHtml(header)}</pre>\n\n${escapeHtml(reckoning)}`;
}
```

The animation for Poseidon should be SLOW — 800ms between frames (double Proteus's 400ms). He's not in a rush.

```typescript
const POSEIDON_FRAMES = [
  "═══════════════════════════════",

  "═══════════════════════════════\n" +
  "       P O S E I D O N",

  "═══════════════════════════════\n" +
  "       P O S E I D O N\n" +
  "        ─── \u2629 ───",

  "═══════════════════════════════\n" +
  "       P O S E I D O N\n" +
  "        ─── \u2629 ───\n" +
  "       Daily Reckoning",
];

const POSEIDON_FRAME_DELAY = 800; // Slow. Godly.
```

Add a `sendPoseidonAnimation()` function to `animations.ts` (same pattern as `sendStartupAnimation` but with POSEIDON_FRAMES and the slower delay).

### 5. Scheduler

```typescript
function schedulePoseidon(telegram: Telegram, ownerId: number): void {
  function msUntilUtcTime(hour: number, minute: number): number {
    const now = new Date();
    const target = new Date(now);
    target.setUTCHours(hour, minute, 0, 0);
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    return target.getTime() - now.getTime();
  }

  // Daily at 06:00 UTC
  setTimeout(async () => {
    await sendReckoning(telegram, ownerId);
    setInterval(() => sendReckoning(telegram, ownerId), 24 * 60 * 60_000);
  }, msUntilUtcTime(6, 0));

  console.log("[poseidon-god] Daily Reckoning scheduled: 06:00 UTC");
}

async function sendReckoning(telegram: Telegram, ownerId: number): Promise<void> {
  try {
    // Send animation first
    await sendPoseidonAnimation(telegram, ownerId);

    // Gather data and get Opus reckoning
    const data = await gatherReckoningData();
    const reckoning = await getReckoningFromOpus(data);
    const message = formatPoseidonReckoning(reckoning);

    await telegram.sendMessage(ownerId, message, { parse_mode: "HTML" });
    console.log("[poseidon-god] Daily Reckoning delivered");
  } catch (err) {
    console.error("[poseidon-god] Reckoning failed:", err);
    // Send a fallback message
    try {
      await telegram.sendMessage(ownerId, "Poseidon could not complete the Daily Reckoning. Check logs.");
    } catch {
      // Silent — don't crash
    }
  }
}
```

### 6. Manual Trigger

Add a `/reckoning` command in `index.ts`:

```typescript
bot.command("reckoning", async (ctx) => {
  await ctx.sendChatAction("typing");
  await sendReckoning(ctx.telegram, config.telegram.ownerId);
});
```

### 7. Wire Into `index.ts`

```typescript
import { schedulePoseidon } from "@/lib/poseidon/poseidon-god";

// In start(), after Nereus:
schedulePoseidon(bot.telegram, config.telegram.ownerId);
```

### 8. Config — Add Poseidon Model

```typescript
models: {
  proteus: process.env.PROTEUS_MODEL || "claude-sonnet-4-5-20250929",
  nereus: process.env.NEREUS_MODEL || "claude-haiku-4-5-20251001",
  poseidon: process.env.POSEIDON_MODEL || "claude-opus-4-20250918",
},
```

---

## Files to Modify

- `src/lib/poseidon/poseidon-god.ts` — NEW: the entire god layer
- `src/lib/poseidon/animations.ts` — ADD: `sendPoseidonAnimation()` with slow frames
- `src/lib/poseidon/config.ts` — ADD: `poseidon` model to models config
- `src/lib/poseidon/index.ts` — ADD: `/reckoning` command + `schedulePoseidon()` call

## Files NOT to Modify

- `src/lib/poseidon/proteus.ts` — leave as-is
- `src/lib/poseidon/memory.ts` — leave as-is
- `src/lib/poseidon/conversations.ts` — leave as-is
- `src/lib/poseidon/triton.ts` — leave as-is
- `src/lib/poseidon/triton-alerts.ts` — leave as-is
- `src/lib/poseidon/triton-monitors.ts` — leave as-is
- `src/lib/poseidon/nereus.ts` — leave as-is
- `src/lib/poseidon/nereus-queries.ts` — leave as-is (Poseidon can import and reuse query functions)
- `docs/ai/poseidon/memory/*` — leave as-is
- Any files in `src/` outside of `src/lib/poseidon/` — DO NOT TOUCH

---

## Acceptance Criteria

1. `npx tsc` compiles clean (or only pre-existing errors outside poseidon/)
2. `poseidon-god.ts` implements the full reckoning engine
3. Data gathering covers ALL subsystems (trades, signals, bots, accounts, bias, sentiment, system health, market data, news)
4. Opus generates the reckoning with the Poseidon personality (authoritative, brief, no filler)
5. Reckoning is scheduled daily at 06:00 UTC
6. `/reckoning` command triggers a manual reckoning
7. Poseidon animation is slow (800ms frames) with the ═══ border style
8. Config includes `poseidon` model ID (Opus 4)
9. Wired into `index.ts`
10. No files outside `src/lib/poseidon/` and `docs/ai/poseidon/` modified
11. All existing functionality (Proteus, Triton, Nereus) still works

---

## Testing

After building:
1. `npx tsc` — should compile clean
2. Start bot: `npx tsx src/lib/poseidon/index.ts`
3. Console should show `[poseidon-god] Daily Reckoning scheduled: 06:00 UTC`
4. Send `/reckoning` in Telegram — should see slow animation, then the reckoning
5. Reckoning should reference data from ALL systems (not just Bitget)
6. Reckoning should be 1-3 paragraphs of authoritative prose (no bullet points, no headers)
7. Proteus, Triton, and Nereus should all still work

---

## Example Reckoning Output

What Freedom should see in Telegram:

```
═══════════════════════════════
       P O S E I D O N
        ─── ☩ ───
       Daily Reckoning
       2026-02-26
═══════════════════════════════

One trade closed. BTC SHORT, entered at 97,450, exited at
93,360 via trailing stop. $84 realized, 4.2% return. The
framework aligned perfectly — COT SHORT, Asia sweep, NY
displacement, handshake confirmed. This is what the system
was built for.

The OANDA basket sits at +1.2% unrealized with five
positions. Trailing has not triggered. Your MT5 accounts
closed two small winners totaling $50. Portfolio equity
stands at $66,700, up 0.4% from yesterday.

All systems nominal. Ten crons healthy, all data fresh.
Funding remains negative — the crowd is still short.
USD GDP prints tomorrow at 13:30. If it runs hot, your
short bias may face headwinds. Stay sharp.
```
