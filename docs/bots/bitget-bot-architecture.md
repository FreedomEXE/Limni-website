<!--
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: docs/bots/bitget-bot-architecture.md
 *
 * Description:
 * Implementation architecture for the live Bitget perpetual futures bot,
 * mapping backtest logic to production services, state, and execution modules.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
-->

# Bitget Bot Implementation Architecture

## 1. System Overview
This document defines the live implementation plan for the Bitget perp bot using the validated v4 strategy logic in [`scripts/bitget-v2-backtest.ts`](../../scripts/bitget-v2-backtest.ts). The architecture keeps strategy logic deterministic, persists state on every tick, and prioritizes restart safety, idempotency, and hard risk controls.

```text
External Cron (1-5m)
        |
        v
/api/cron/bitget-bot (auth via cronAuth)
        |
        v
bitgetBotEngine.tick()
        |
        +--> Load state (bot_states)
        +--> Fetch market + bias inputs
        +--> Evaluate state machine
        +--> Place/modify/close orders (Bitget API)
        +--> Persist state + execution logs (Postgres)
        +--> Emit notifications
```

## 2. Reuse Map (Existing Files)
- Market data: [`src/lib/bitget.ts`](../../src/lib/bitget.ts)
- Trading API: [`src/lib/bitgetTrade.ts`](../../src/lib/bitgetTrade.ts)
- State storage: [`src/lib/botState.ts`](../../src/lib/botState.ts)
- DB pool/query helpers: [`src/lib/db.ts`](../../src/lib/db.ts)
- COT logic/store: [`src/lib/cotCompute.ts`](../../src/lib/cotCompute.ts), [`src/lib/cotStore.ts`](../../src/lib/cotStore.ts)
- Sentiment aggregation/store: [`src/lib/sentiment/aggregate.ts`](../../src/lib/sentiment/aggregate.ts), [`src/lib/sentiment/store.ts`](../../src/lib/sentiment/store.ts)
- Week boundaries: [`src/lib/weekAnchor.ts`](../../src/lib/weekAnchor.ts)
- Optional liquidation source: [`src/lib/coinank.ts`](../../src/lib/coinank.ts)
- Cron auth pattern: [`src/lib/cronAuth.ts`](../../src/lib/cronAuth.ts)
- Cron route reference: [`src/app/api/cron/refresh/route.ts`](../../src/app/api/cron/refresh/route.ts)

## 3. New Modules
- `src/lib/bitgetBotEngine.ts`
- `src/lib/bitgetBotOrders.ts`
- `src/lib/bitgetBotSignals.ts`
- `src/lib/bitgetBotRisk.ts`
- `src/app/api/cron/bitget-bot/route.ts`

## 4. State Machine
## 4.1 States
- `IDLE`: bot disabled or outside active week lifecycle
- `WEEK_READY`: weekly bias computed and frozen
- `WATCHING_RANGE`: collecting session highs/lows
- `WATCHING_SWEEP`: range locked, looking for sweep + rejection + displacement
- `AWAITING_HANDSHAKE`: first symbol signaled, waiting up to 60 minutes for counterpart
- `POSITION_OPEN`: entries confirmed and opened
- `SCALING`: leverage milestone reached and applied
- `TRAILING`: breakeven/trailing stop active
- `EXITING`: reduce-only close in progress
- `ERROR`: invariant break or repeated execution failure

## 4.2 Transition Intent
- `IDLE -> WEEK_READY`: new week detected and bias available
- `WEEK_READY -> WATCHING_RANGE`: current UTC time enters range-building session
- `WATCHING_RANGE -> WATCHING_SWEEP`: range lock time reached
- `WATCHING_SWEEP -> AWAITING_HANDSHAKE`: one symbol confirmed
- `AWAITING_HANDSHAKE -> POSITION_OPEN`: second symbol confirms inside 60-minute window
- `POSITION_OPEN -> SCALING`: +1/+2/+3/+4 milestones crossed
- `POSITION_OPEN|SCALING -> TRAILING`: trailing mode activation
- Any active position state -> `EXITING`: stop/trail/week-close/kill-switch
- `EXITING -> WEEK_READY`: flat and ready for next setup
- Any state -> `ERROR`: non-recoverable condition

## 5. Engine Contract
```ts
export type BotLifecycleState =
  | "IDLE"
  | "WEEK_READY"
  | "WATCHING_RANGE"
  | "WATCHING_SWEEP"
  | "AWAITING_HANDSHAKE"
  | "POSITION_OPEN"
  | "SCALING"
  | "TRAILING"
  | "EXITING"
  | "ERROR";

export type SessionWindow =
  | "ASIA_LONDON_RANGE_NY_ENTRY"
  | "US_RANGE_ASIA_LONDON_ENTRY";

export type SymbolBase = "BTC" | "ETH";
export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type WeeklyBiasState = {
  weekOpenUtc: string;
  weekCloseUtc: string;
  btc: { tier: "HIGH" | "MEDIUM" | "NEUTRAL"; bias: Direction };
  eth: { tier: "HIGH" | "MEDIUM" | "NEUTRAL"; bias: Direction };
  computedAtUtc: string;
};

export type HandshakeState = {
  active: boolean;
  sessionWindow: SessionWindow | null;
  firstSymbol: SymbolBase | null;
  firstConfirmTs: number | null;
  expiryTs: number | null;
};

export type LivePositionState = {
  symbol: SymbolBase;
  direction: "LONG" | "SHORT";
  entryTs: number;
  entryPrice: number;
  stopPrice: number;
  initialLeverage: number;
  currentLeverage: number;
  maxLeverageReached: number;
  milestonesHit: number[];
  breakevenReached: boolean;
  trailingActive: boolean;
  trailingOffsetPct: number | null;
  sessionWindow: SessionWindow;
};

export type BitgetBotStateV1 = {
  version: 1;
  lifecycle: BotLifecycleState;
  lockOwner: string | null;
  lockAcquiredAtUtc: string | null;
  weeklyBias: WeeklyBiasState | null;
  handshake: HandshakeState;
  positions: LivePositionState[];
  entriesThisWeek: { weekOpenUtc: string; BTC: number; ETH: number };
  lastTickUtc: string;
  lastError: string | null;
};
```

Persist via `writeBotState("bitget-perp-v1", state)`.

## 6. Tick Flow (Idempotent)
1. Acquire distributed lock before processing.
2. Load bot state from `bot_states`.
3. Resolve canonical week (`getCanonicalWeekOpenUtc`).
4. If week changed, roll state forward and reset weekly counters.
5. Fetch/update weekly bias (COT + sentiment, funding fallback).
6. Build/lock session ranges from recent candles.
7. Evaluate sweep conditions.
8. Apply handshake gate if mode enabled.
9. Submit entry/updates/exits via `bitgetBotOrders`.
10. Persist state and append audit rows.
11. Release lock.

Locking options:
- Preferred: `pg_try_advisory_lock(hashtext('bitget-perp-v1'))`
- Fallback: lock row table with expiration (`locked_until_utc`)

Idempotency keys:
- `clientOid = ${botId}:${symbol}:${entryTs}:${window}`
- Unique DB constraint on `(strategy_id, symbol, entry_time_utc)` in trade log table

## 7. Data Pipeline Details
## 7.1 Weekly Bias
- Read COT history: `readSnapshotHistory("crypto", N)`
- Compute dealer/commercial directions: `derivePairDirectionsByBase(...)`
- Sentiment anchor: `getAggregatesForWeekStartWithBackfill(weekOpen, weekClose)`
- Fallback: funding-proxy direction from recent funding history if aggregate missing

## 7.2 Session Range Builders
- Asia/London range: 00:00-13:00 UTC
- US range: 13:00-21:00 UTC
- NY sweep window: 13:00-21:00 UTC
- Asia/London sweep window: 00:00-13:00 UTC next day

All time handling must stay in UTC for runtime logic; week boundaries remain tied to Sunday 19:00 ET anchor converted to UTC.

## 7.3 Signal Checks
- Sweep breach minimum: `0.1%` (neutral mode `0.3%`)
- Rejection close back inside range
- Displacement body minimum: `0.1%`
- Handshake pairing inside `<= 60` minutes within same session window

## 7.4 Market Data Snapshots
- Snapshot tables (collection-only):
  - `market_funding_snapshots`: hourly funding rates per symbol for later filter research.
  - `market_oi_snapshots`: hourly open interest + reference price per symbol for OI-delta studies.
  - `market_liquidation_snapshots`: hourly liquidation summary + cluster payload for structure analysis.
- Collection cron:
  - Endpoint: `src/app/api/cron/market-snapshots/route.ts`
  - Cadence: hourly, separate from the 1-5 minute bot tick.
  - Source modules: `src/lib/bitget.ts` and `src/lib/coinank.ts`
- Symbol scope:
  - `SNAPSHOT_SYMBOLS` lives in `src/lib/marketSnapshots.ts` and currently starts with `["BTC", "ETH"]`.
  - To expand for alts, add symbols to `SNAPSHOT_SYMBOLS` and ensure each symbol is supported by both source adapters.
- Intent notes:
  - Collection only: no filter integration or entry gating at this stage.
  - Data will be evaluated for filter use after at least 3 months of accumulated history.
  - Liquidation cluster data is a candidate input for dynamic scaling milestone targets (see strategy doc section 8).

## 8. Order Execution Layer
Implement in `src/lib/bitgetBotOrders.ts` using [`src/lib/bitgetTrade.ts`](../../src/lib/bitgetTrade.ts).

Current available primitives:
- `setBitgetPositionMode(...)`
- `setBitgetMarginMode(...)`
- `setBitgetLeverage(...)`
- `fetchBitgetAccount()` / `fetchBitgetPositions()`
- `placeBitgetOrder(...)` (market order)

Important gap to resolve:
- `setBitgetLeverage(...)` currently clamps leverage to `<= 50`. Backtest scales to `75x`. Decide production cap policy and keep runtime/backtest aligned.

Execution policy:
- Entry orders: market
- Close orders: reduce-only market (`reduceOnly: "yes"`)
- Stop/trailing: either exchange-native conditional orders (add wrapper endpoints) or client-side monitoring each tick with deterministic trigger rules

## 9. Cron Integration
Add `src/app/api/cron/bitget-bot/route.ts`.

Route behavior:
- Auth with `isCronAuthorized(request)`
- Respect feature flag (`BITGET_BOT_ENABLED`)
- Run one engine tick
- Return transition summary and diagnostics JSON

Tick cadence:
- 1 minute for tighter trailing/stop reaction
- 5 minutes acceptable if infrastructure constrained

## 10. Database Schema
Add migration for operational tables.

```sql
CREATE TABLE IF NOT EXISTS bitget_bot_trades (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  session_window TEXT NOT NULL,
  range_source TEXT NOT NULL,
  entry_time_utc TIMESTAMPTZ NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_time_utc TIMESTAMPTZ,
  exit_price NUMERIC,
  exit_reason TEXT,
  stop_price NUMERIC,
  initial_leverage NUMERIC NOT NULL,
  max_leverage_reached NUMERIC,
  milestones_hit JSONB NOT NULL DEFAULT '[]'::jsonb,
  freed_margin_usd NUMERIC NOT NULL DEFAULT 0,
  pnl_usd NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (strategy_id, symbol, entry_time_utc)
);

CREATE TABLE IF NOT EXISTS bitget_bot_ranges (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  day_utc DATE NOT NULL,
  symbol TEXT NOT NULL,
  range_source TEXT NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  locked_at_utc TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (day_utc, symbol, range_source)
);

CREATE TABLE IF NOT EXISTS bitget_bot_signals (
  id BIGSERIAL PRIMARY KEY,
  bot_id TEXT NOT NULL,
  day_utc DATE NOT NULL,
  symbol TEXT NOT NULL,
  session_window TEXT NOT NULL,
  confirm_time_utc TIMESTAMPTZ NOT NULL,
  direction TEXT NOT NULL,
  sweep_pct NUMERIC NOT NULL,
  displacement_pct NUMERIC NOT NULL,
  handshake_group_id TEXT,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitget_bot_trades_bot_time
  ON bitget_bot_trades (bot_id, entry_time_utc DESC);
CREATE INDEX IF NOT EXISTS idx_bitget_bot_trades_symbol_time
  ON bitget_bot_trades (symbol, entry_time_utc DESC);
CREATE INDEX IF NOT EXISTS idx_bitget_bot_signals_day_symbol
  ON bitget_bot_signals (day_utc, symbol);
```

## 11. Configuration
Required existing env vars:
- `DATABASE_URL`
- `BITGET_API_KEY`
- `BITGET_API_SECRET`
- `BITGET_API_PASSPHRASE`
- `BITGET_PRODUCT_TYPE`
- `BITGET_MARGIN_MODE`
- `CRON_SECRET`

New env vars:
- `BITGET_BOT_ENABLED=true|false`
- `BITGET_BOT_ID=bitget-perp-v1`
- `BITGET_BOT_DRY_RUN=true|false`
- `BITGET_BOT_HANDSHAKE_ENABLED=true|false`
- `BITGET_BOT_HANDSHAKE_WINDOW_MINUTES=60`
- `BITGET_BOT_INITIAL_LEVERAGE=5`
- `BITGET_BOT_MAX_LEVERAGE=50` (or 75 if helper and exchange support are updated)
- `BITGET_BOT_INITIAL_STOP_PCT=10`
- `BITGET_BOT_WEEKLY_MAX_ENTRIES_PER_SYMBOL=5`
- `BITGET_BOT_KILL_SWITCH=true|false`

## 12. Monitoring and Alerts
- Log every state transition with reason code and key prices.
- Emit trade open/close and kill-switch events via `sendEmail(...)` in [`src/lib/notifications/email.ts`](../../src/lib/notifications/email.ts).
- Add dashboard panel (bots page) showing:
  - current lifecycle state
  - weekly bias
  - open positions
  - milestone progress
  - realized/unrealized PnL

## 13. Risk Safeguards
- Hard cap on leverage and allocation by config
- Entry rejected when state is stale or range not locked
- Global kill switch to flatten all positions and transition to `IDLE`
- Retry with exponential backoff for transient API errors
- Reconcile live exchange positions each tick; if DB/state diverges, enter `ERROR` and pause new entries
- Forced week-boundary flatten at canonical close if still open

## 14. Restart and Recovery Rules
On process restart:
1. Load persisted state.
2. Fetch open exchange positions.
3. Reconcile with `bitget_bot_trades` open rows.
4. If mismatch cannot be auto-resolved, set `ERROR`, notify, and block new entries.
5. Resume normal tick only when state and exchange are consistent.

## 15. Implementation Sequence
1. Create DB migration and models for bot tables.
2. Implement `bitgetBotSignals.ts` (range/sweep/handshake).
3. Implement `bitgetBotRisk.ts` (scaling ladder + stop logic).
4. Implement `bitgetBotOrders.ts` wrappers and idempotent order submission.
5. Implement `bitgetBotEngine.ts` state machine and persistence.
6. Add cron route and dry-run mode.
7. Run paper mode for at least 1 week before enabling live execution.
