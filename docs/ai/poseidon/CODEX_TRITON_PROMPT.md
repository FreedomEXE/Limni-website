# Codex Prompt: Triton — Full-Platform Alert Engine

> Give this entire prompt to Codex. Triton is the messenger of the sea — he watches ALL of Limni and alerts Freedom when something happens.

---

## Context

Triton is the alert engine for the Poseidon AI system. He monitors the ENTIRE Limni platform — not just the Bitget bot — and sends formatted Telegram notifications to Freedom whenever a significant state change occurs.

Triton already exists as a stub (`src/lib/poseidon/triton.ts`) with basic alert formatting. This task expands him into a full-platform monitoring engine with:
- State change detection across ALL Limni systems via polling
- Deduplicated, priority-based alert delivery via Telegram
- Distinct visual identity (not a box border — clean, urgent, mobile-first formatting)
- Per-system alert types covering trades, bots, accounts, sentiment, COT, crons, news

**Triton is NOT an AI model.** He is pure logic — polling queries, state diffing, and templated messages. No Claude API calls. Fast, cheap, reliable.

---

## Architecture

Triton runs as a polling loop inside the existing Poseidon process (`src/lib/poseidon/index.ts`). Every 30 seconds, he checks each subsystem for state changes since the last poll. When a change is detected, he formats and sends a Telegram alert.

### Poll Loop Flow

```
Every 30 seconds:
  1. Poll each subsystem (Bitget, OANDA, MT5, Sentiment, COT, Crons, News, Market Data)
  2. Compare current state to last-known state
  3. For each detected change, check if it passes priority/dedup filters
  4. Format alert message with Triton header
  5. Send via Telegram to Freedom's DM
  6. Update last-known state
```

### State Tracking

Triton maintains an in-memory state object that tracks last-seen values for each monitored field. On startup, it initializes from the DB (no false alerts on restart). State is also persisted to `docs/ai/poseidon/state/triton_state.json` for crash recovery.

---

## File Structure

```
src/lib/poseidon/
├── triton.ts              — REWRITE: Full alert engine with poll loop
├── triton-alerts.ts       — NEW: Alert type definitions, formatters, priority
├── triton-monitors.ts     — NEW: Per-subsystem polling functions
```

---

## Detailed Implementation

### 1. `src/lib/poseidon/triton-alerts.ts` — Alert Definitions

Define all alert types, their priorities, and Telegram message formatters.

#### Alert Priority Levels

```typescript
type AlertPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
```

- **CRITICAL**: System health issues, bot errors, connection failures. Always send immediately.
- **HIGH**: Trade opened/closed, major P/L milestones, breakeven set. Always send.
- **MEDIUM**: Signals detected, sentiment flips, weekly bias updates. Send if not too frequent.
- **LOW**: Informational (new COT data, performance snapshot ready). Batch or send with delay.

#### Alert Types — Full Platform

```typescript
type AlertType =
  // Bitget Bot
  | "bitget_trade_opened"
  | "bitget_trade_closed"
  | "bitget_milestone"
  | "bitget_breakeven"
  | "bitget_signal_detected"
  | "bitget_bot_error"
  // OANDA Bot
  | "oanda_basket_entered"
  | "oanda_trailing_active"
  | "oanda_basket_exited"
  | "oanda_bot_stale"
  // MT5
  | "mt5_api_down"
  | "mt5_basket_opened"
  | "mt5_basket_closed"
  | "mt5_position_closed"
  | "mt5_sync_stale"
  // Connected Accounts
  | "account_error"
  | "account_sync_stale"
  | "account_drawdown"
  // Sentiment
  | "sentiment_crowding"
  | "sentiment_flip"
  | "sentiment_provider_down"
  // COT
  | "cot_new_release"
  | "cot_bias_flip"
  | "cot_data_stale"
  // System Health
  | "cron_stale"
  | "cron_error"
  // News
  | "news_high_impact_upcoming"
  // Market Data
  | "funding_extreme"
  | "funding_flip"
  | "oi_surge"
  | "liquidation_flip";
```

#### Alert Formatting

**Triton's visual identity should be clean and urgent — NOT a box border.** Use line separators for mobile readability:

```typescript
function formatTritonAlert(type: AlertType, priority: AlertPriority, body: string): string {
  const priorityIcon = {
    CRITICAL: "🔴",
    HIGH: "⚡",
    MEDIUM: "📡",
    LOW: "📋",
  }[priority];

  const header = `${priorityIcon} TRITON`;
  const separator = "━".repeat(24);

  return `${header}\n${separator}\n${body}`;
}
```

**Example formatted alerts:**

```
⚡ TRITON
━━━━━━━━━━━━━━━━━━━━━━━━
TRADE OPENED
BTC SHORT @ 97,450.23
Session: ASIA_LONDON → NY
Leverage: 5x | Margin: 100 USDT
Stop: 98,234.00
```

```
⚡ TRITON
━━━━━━━━━━━━━━━━━━━━━━━━
TRADE CLOSED
BTC SHORT | +$84.20 (+4.2%)
Entry: 97,450 → Exit: 93,360
Reason: Trailing Stop
Duration: 14h 23m
```

```
🔴 TRITON
━━━━━━━━━━━━━━━━━━━━━━━━
OANDA BOT STALE
Last tick: 6 minutes ago
Status: possibly crashed
Check Render dashboard
```

```
📡 TRITON
━━━━━━━━━━━━━━━━━━━━━━━━
SENTIMENT FLIP
EURUSD flipped SHORT → LONG
Agg net: +12.3%
Sources: 4/5 active
```

```
📡 TRITON
━━━━━━━━━━━━━━━━━━━━━━━━
COT RELEASE
New report: Feb 25, 2026
Asset classes: FX, Indices, Crypto
Check /dashboard for updated bias
```

```
📋 TRITON
━━━━━━━━━━━━━━━━━━━━━━━━
HIGH-IMPACT NEWS
USD Non-Farm Payrolls
In 3h 45m (13:30 UTC)
Forecast: 180K | Previous: 256K
```

```
🔴 TRITON
━━━━━━━━━━━━━━━━━━━━━━━━
MT5 API DOWN
Account: Freedom-IC
Last sync: 8 minutes ago
Error: Connection timeout
```

```
⚡ TRITON
━━━━━━━━━━━━━━━━━━━━━━━━
OANDA BASKET ENTERED
Entry equity: $4,250
Pairs: 5 positions opened
Risk mode: 1:2
```

#### Deduplication

Each alert type has a cooldown to prevent spam:
- CRITICAL: 5 minute cooldown (same alert type + same key)
- HIGH: 10 minute cooldown
- MEDIUM: 30 minute cooldown
- LOW: 60 minute cooldown

The dedup key is `${alertType}:${discriminator}` where discriminator is a meaningful identifier (e.g., symbol, account_id, provider name).

```typescript
type DedupEntry = {
  key: string;
  sentAt: number;
};

const dedupCache: Map<string, DedupEntry> = new Map();

function shouldSend(type: AlertType, priority: AlertPriority, discriminator: string): boolean {
  const key = `${type}:${discriminator}`;
  const existing = dedupCache.get(key);
  if (!existing) return true;

  const cooldownMs = {
    CRITICAL: 5 * 60_000,
    HIGH: 10 * 60_000,
    MEDIUM: 30 * 60_000,
    LOW: 60 * 60_000,
  }[priority];

  return Date.now() - existing.sentAt > cooldownMs;
}
```

### 2. `src/lib/poseidon/triton-monitors.ts` — Subsystem Monitors

Each monitor function polls a specific subsystem and returns an array of alerts to send. All monitors are read-only DB queries.

#### Monitor Interface

```typescript
type TritonAlert = {
  type: AlertType;
  priority: AlertPriority;
  discriminator: string; // for dedup
  body: string; // formatted message body (without header)
};

type MonitorState = Record<string, unknown>;
```

#### Monitors to Implement

**1. Bitget Bot Monitor**

```typescript
async function monitorBitgetBot(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Query: SELECT * FROM bitget_bot_trades WHERE opened_at > $lastCheck ORDER BY opened_at DESC
  // Detect: new trades (entry_time_utc not in lastState.knownTradeIds)
  // Detect: closed trades (exit_time_utc was NULL, now has value)
  // Detect: milestone changes (milestones_hit JSONB grew)

  // Query: SELECT * FROM bitget_bot_signals WHERE detected_at > $lastCheck ORDER BY detected_at DESC
  // Detect: new signals

  // Query: SELECT state FROM bot_states WHERE bot_id = 'bitget_perp_v2' ORDER BY updated_at DESC LIMIT 1
  // Detect: lifecycle state change (e.g., IDLE → WATCHING_SWEEP)
  // Detect: error state
  // Detect: stale updated_at (> 5 minutes for a 1-min cron)
}
```

**2. OANDA Bot Monitor**

```typescript
async function monitorOandaBot(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Query: SELECT state, updated_at FROM bot_states WHERE bot_id = 'oanda_universal_bot'
  // Parse state JSONB
  // Detect: entered changed false → true (basket entered)
  // Detect: trailing_active changed false → true
  // Detect: trail_hit_at set (basket exited via trail)
  // Detect: entered changed true → false (basket exited)
  // Detect: updated_at stale (> 2 minutes)
}
```

**3. MT5 Monitor**

```typescript
async function monitorMt5(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Query: SELECT account_id, api_ok, basket_state, basket_pnl_pct, last_sync_utc, equity, baseline_equity FROM mt5_accounts WHERE status = 'ACTIVE'
  // Detect: api_ok flipped to false
  // Detect: basket_state changed
  // Detect: last_sync_utc stale (> 5 minutes)
  // Detect: equity drawdown (> 15% from baseline_equity)

  // Query: SELECT * FROM mt5_closed_positions WHERE close_time > $lastCheck
  // Detect: new closed positions (with P/L)
}
```

**4. Connected Accounts Monitor**

```typescript
async function monitorConnectedAccounts(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Query: SELECT account_key, provider, status, last_sync_utc, analysis FROM connected_accounts
  // Detect: status changed to 'ERROR'
  // Detect: last_sync_utc stale (> 5 minutes)
  // Detect: analysis.nav drawdown (> 10% from recent peak — track peak in lastState)
}
```

**5. Sentiment Monitor**

```typescript
async function monitorSentiment(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Query: SELECT symbol, crowding_state, flip_state, sources_used, agg_net FROM sentiment_aggregates
  //        WHERE timestamp_utc > NOW() - INTERVAL '2 hours'
  //        ORDER BY timestamp_utc DESC
  // Deduplicate by symbol (take latest per symbol)
  // Detect: crowding_state = 'EXTREME_LONG' or 'EXTREME_SHORT' (not in lastState)
  // Detect: flip_state = 'JUST_FLIPPED_LONG' or 'JUST_FLIPPED_SHORT' (not in lastState)
  // Detect: sources_used length < 3 (provider outage)
}
```

**6. COT Monitor**

```typescript
async function monitorCot(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Query: SELECT report_date, asset_class, fetched_at, pairs FROM cot_snapshots ORDER BY fetched_at DESC LIMIT 10
  // Detect: new report_date not in lastState.knownReportDates
  // Detect: bias flips by comparing latest pairs JSONB to prior week
  // Detect: staleness (no new report in > 8 days)
}
```

**7. Cron Health Monitor**

```typescript
async function monitorCronHealth(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Use getCronStatusSummary() from src/lib/cronStatus.ts
  // Detect: any subsystem state = 'stale' or 'error'
  // Detect: overall_state changed from 'ok' to 'stale' or 'error'
}
```

**8. News Monitor**

```typescript
async function monitorNews(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Query: SELECT calendar FROM news_weekly_snapshots ORDER BY fetched_at DESC LIMIT 1
  // Parse calendar JSONB for high-impact events
  // Detect: event with impact = 'HIGH' happening within next 4 hours
  // Only alert once per event (dedup by event title + time)
}
```

**9. Market Data Monitor**

```typescript
async function monitorMarketData(lastState: MonitorState): Promise<{ alerts: TritonAlert[]; newState: MonitorState }> {
  // Funding: SELECT * FROM market_funding_snapshots WHERE snapshot_time_utc > NOW() - INTERVAL '2 hours' ORDER BY snapshot_time_utc DESC
  // Detect: funding_rate > 0.01 or < -0.01 (extreme)
  // Detect: funding_rate sign flip vs lastState

  // OI: SELECT * FROM market_oi_snapshots WHERE snapshot_time_utc > NOW() - INTERVAL '2 hours' ORDER BY snapshot_time_utc DESC
  // Detect: open_interest change > 20% vs lastState

  // Liquidations: SELECT * FROM market_liquidation_snapshots WHERE snapshot_time_utc > NOW() - INTERVAL '2 hours' ORDER BY snapshot_time_utc DESC
  // Detect: dominant_side flip vs lastState
}
```

### 3. `src/lib/poseidon/triton.ts` — Main Engine (REWRITE)

Rewrite the existing `triton.ts` to be the Triton engine. It should:

1. Export a `startTriton(telegram: Telegram)` function called from `index.ts`
2. Initialize state from DB on first run (query current values so no false alerts)
3. Run a `setInterval` every 30 seconds that calls all monitors
4. Filter alerts through dedup
5. Send via Telegram with `formatTritonAlert()`
6. Persist state to `docs/ai/poseidon/state/triton_state.json` every 5 minutes (crash recovery)
7. Export `stopTriton()` for graceful shutdown

```typescript
import type { Telegram } from "telegraf";

let pollInterval: NodeJS.Timeout | null = null;
let state: Record<string, MonitorState> = {};

export async function startTriton(telegram: Telegram, ownerId: number): Promise<void> {
  // Load persisted state from disk (if exists)
  state = await loadTritonState();

  // Initialize: run all monitors once to set baseline (don't send alerts on first run)
  await initializeMonitors();

  // Start polling loop
  pollInterval = setInterval(async () => {
    try {
      await pollAllMonitors(telegram, ownerId);
    } catch (err) {
      console.error("[triton] poll error:", err);
    }
  }, 30_000);

  // Persist state every 5 minutes
  setInterval(() => {
    saveTritonState(state).catch(() => undefined);
  }, 5 * 60_000).unref();

  console.log("[triton] Monitoring started (30s poll interval)");
}

export function stopTriton(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
```

### 4. `src/lib/poseidon/index.ts` — Wire Triton

Add to the `start()` function, after Proteus is online:

```typescript
import { startTriton, stopTriton } from "@/lib/poseidon/triton";

// In start(), after bot launch:
await startTriton(bot.telegram, config.telegram.ownerId);

// In shutdown:
process.once("SIGINT", () => {
  stopTriton();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  stopTriton();
  bot.stop("SIGTERM");
});
```

### 5. `src/lib/poseidon/animations.ts` — Update Triton Header

Replace the current `buildTritonHeader()` box with the new clean format:

```typescript
export function buildTritonHeader(priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"): string {
  const icon = {
    CRITICAL: "\u{1F534}",  // 🔴
    HIGH: "\u26A1",         // ⚡
    MEDIUM: "\u{1F4E1}",    // 📡
    LOW: "\u{1F4CB}",       // 📋
  }[priority];

  return `${icon} TRITON\n${"━".repeat(24)}`;
}
```

Keep the old `AlertStyle` type and `ALERT_LABELS` for backwards compatibility but add the new priority-based header alongside.

---

## Behavior Configuration

Triton respects the existing behavior flags in `docs/ai/poseidon/state/behavior.json`:

```json
{
  "alertsEnabled": true,
  "milestoneAlerts": true,
  "biasAlerts": true,
  "errorAlerts": true,
  "verboseMode": false
}
```

If `alertsEnabled` is false, Triton sends nothing (except CRITICAL alerts — those always send).
If `milestoneAlerts` is false, skip bitget_milestone and bitget_breakeven.
If `biasAlerts` is false, skip cot_bias_flip, sentiment_flip, sentiment_crowding.
If `errorAlerts` is false, skip bot_error, cron_stale, etc. (NOT recommended).
If `verboseMode` is true, also send LOW priority alerts that are normally suppressed.

---

## Files NOT to Modify

- `src/lib/poseidon/proteus.ts` — leave as-is
- `src/lib/poseidon/memory.ts` — leave as-is
- `src/lib/poseidon/conversations.ts` — leave as-is
- `src/lib/poseidon/config.ts` — leave as-is (add new config fields if needed)
- `src/lib/poseidon/behavior.ts` — leave as-is (read behavior flags, don't change the schema)
- `src/lib/poseidon/state.ts` — leave as-is
- `docs/ai/poseidon/memory/*` — leave as-is
- Any files in `src/` outside of `src/lib/poseidon/` — DO NOT TOUCH
- Database schema — DO NOT add tables or triggers. Read-only queries only.

---

## Acceptance Criteria

1. `npx tsc` compiles with zero errors (or only pre-existing errors outside poseidon/)
2. `triton.ts` is rewritten as the polling engine with `startTriton()`/`stopTriton()` exports
3. `triton-alerts.ts` defines all alert types, priorities, formatters, and dedup logic
4. `triton-monitors.ts` implements polling functions for ALL 9 subsystems (Bitget, OANDA, MT5, Connected Accounts, Sentiment, COT, Cron Health, News, Market Data)
5. Triton is wired into `index.ts` and starts after Proteus comes online
6. No false alerts on startup (initial poll sets baseline without sending)
7. Dedup prevents spam (cooldowns per priority level)
8. Alert formatting matches the examples above (clean, no box borders, mobile-readable)
9. Behavior flags are respected (alertsEnabled, milestoneAlerts, etc.)
10. State is persisted to `triton_state.json` for crash recovery
11. No files outside `src/lib/poseidon/` and `docs/ai/poseidon/` are modified
12. All existing Proteus functionality (chat, /start, /health, /status, /clear) still works

---

## Testing

After building:
1. `npx tsc` — should compile clean
2. Start bot locally: `npx tsx src/lib/poseidon/index.ts`
3. Console should show `[triton] Monitoring started (30s poll interval)`
4. If there are existing trades/signals in the DB, Triton should NOT alert on them (baseline initialization)
5. Manually insert a test row into `bitget_bot_signals` — Triton should detect it within 30s and send alert
6. Check that alerts appear in Telegram DM with correct formatting
7. Verify dedup: same alert should not repeat within cooldown window
8. `/health` should still work
9. Proteus conversation should still work alongside Triton polling

---

## Important Notes

1. **Triton is NOT an AI model.** No Claude API calls. Pure SQL queries + template formatting. This keeps it fast and cheap.
2. **All DB access is read-only.** Triton never writes to the Limni database. It only reads.
3. **Import from existing codebase.** Use `query()` from `src/lib/db.ts`. Use `getCronStatusSummary()` from `src/lib/cronStatus.ts` if it exists and is importable.
4. **Error isolation.** If one monitor fails, it should NOT crash the others. Wrap each monitor in try/catch.
5. **Graceful degradation.** If the DB is unreachable, Triton should log a warning and retry next poll — not crash.
6. **Memory efficiency.** Don't load full table dumps. Use WHERE clauses with time bounds (last 2 hours) and LIMIT.
7. **Poll interval is 30 seconds.** This is a balance between responsiveness and DB load. Don't make it configurable for now.
