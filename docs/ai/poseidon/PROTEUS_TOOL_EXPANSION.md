# Proteus Tool Expansion — Full Platform Visibility

> **Author:** Claude (CTO) — February 2026
> **Status:** Spec ready for implementation
> **Priority:** HIGH — Proteus is blind to ~70% of the platform

---

## Problem

Proteus currently has **14 tools**, all scoped to **Bitget crypto + memory management**.
The platform has **24 DB tables**, **48 API routes**, and covers crypto, forex, MT5 accounts,
connected broker accounts (OANDA/Bitget/5ers/Fxify), COT institutional positioning,
multi-provider sentiment, news calendar, performance tracking (Antikythera), and a research lab.

When Freedom asks about forex, prop accounts, MT5, performance, or system health,
Proteus can only say "I don't have access to that." This is unacceptable.

### What Proteus Can See Today (14 tools)

| Tool | Domain |
|------|--------|
| `get_bot_state` | Bitget crypto bot |
| `get_recent_trades` | Bitget trades |
| `get_recent_signals` | Bitget signals |
| `get_session_ranges` | Bitget ranges |
| `get_market_snapshot` | Funding/OI/liquidation snapshots |
| `get_weekly_bias` | Bitget weekly bias |
| `get_live_prices` | Bitget futures ticker |
| `get_liquidation_heatmap` | CoinAnk heatmap (live) |
| `get_behavior` | Proteus behavior flags |
| `set_behavior` | Proteus behavior flags |
| `get_session_state` | Memory (PROTEUS_STATE.md) |
| `get_session_archive` | Memory (archives) |
| `request_poseidon_curation` | Memory curation |
| `update_session_state` | Memory state update |

### What Proteus Cannot See

- MT5 accounts (equity, positions, basket state, closed trades, EA changes)
- Connected broker accounts (OANDA, Bitget, 5ers, Fxify — status, config, PnL)
- OANDA bot state (entered, trailing, positions)
- COT institutional positioning (signals, baskets, currency strength)
- Sentiment aggregates (crowding, provider health, net positioning)
- News calendar (upcoming high-impact events)
- Performance tracking / Antikythera (model comparison, weekly returns)
- Research lab (backtest runs, candidates)
- System health (cron freshness, data staleness, overall status)

---

## Architecture Principle

**Reuse `nereus-queries.ts` patterns.** Nereus already has read-only SQL queries for every
subsystem. The tool handlers should call the same query functions or use identical SQL.
All new tools are **read-only**. No tool should execute trades, modify accounts, or change
system state (except existing behavior/memory tools).

---

## New Tools (18 total)

### Domain 1: Forex & OANDA Bot

#### `get_forex_overview`
> One-shot forex context: COT signals, OANDA bot state, sentiment crowding.

```typescript
{
  name: "get_forex_overview",
  description: "Get forex overview: COT directional signals, OANDA bot state, and sentiment crowding alerts.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler:** Call `getForexBriefingData()` from `nereus-queries.ts`.
Returns `{ signals, oandaBot, crowding }`.

---

#### `get_oanda_bot_state`
> Detailed OANDA universal bot state from `bot_states` table.

```typescript
{
  name: "get_oanda_bot_state",
  description: "Get the OANDA universal bot state — entered/trailing status, open positions, basket state, and last update time.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler SQL:**
```sql
SELECT bot_id, state, updated_at
  FROM bot_states
 WHERE bot_id = 'oanda_universal_bot'
 ORDER BY updated_at DESC LIMIT 1
```

---

### Domain 2: MT5 Accounts

#### `get_mt5_accounts`
> All active MT5 accounts with equity, basket state, API connectivity.

```typescript
{
  name: "get_mt5_accounts",
  description: "List all active MT5 accounts with equity, balance, basket state, and API health. Covers prop firm and personal accounts.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler SQL:**
```sql
SELECT account_id, label, equity, balance, basket_state, api_ok, status, updated_at
  FROM mt5_accounts
 WHERE UPPER(status) = 'ACTIVE'
 ORDER BY account_id
```

---

#### `get_mt5_positions`
> Open positions for a specific MT5 account or all accounts.

```typescript
{
  name: "get_mt5_positions",
  description: "Get open MT5 positions. Optionally filter by account_id.",
  input_schema: {
    type: "object",
    properties: {
      account_id: { type: "string", description: "MT5 account ID to filter by. Omit for all accounts." }
    },
    required: []
  }
}
```

**Handler SQL:**
```sql
-- If account_id provided:
SELECT * FROM mt5_positions WHERE account_id = $1 ORDER BY open_time DESC
-- Else:
SELECT * FROM mt5_positions ORDER BY account_id, open_time DESC
```

---

#### `get_mt5_closed_trades`
> Recent closed trades from MT5 accounts with PnL.

```typescript
{
  name: "get_mt5_closed_trades",
  description: "Get recent closed MT5 trades with profit, volume, and timing. Optionally filter by account_id.",
  input_schema: {
    type: "object",
    properties: {
      account_id: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 200 }
    },
    required: []
  }
}
```

**Handler SQL:**
```sql
SELECT ticket, account_id, symbol, direction, volume, open_price, close_price,
       profit, swap, commission, open_time, close_time
  FROM mt5_closed_positions
 WHERE ($1::text IS NULL OR account_id = $1)
 ORDER BY close_time DESC
 LIMIT $2
```

---

#### `get_mt5_changelog`
> Recent EA change log entries.

```typescript
{
  name: "get_mt5_changelog",
  description: "Get recent MT5 EA change notes (weekly changelog).",
  input_schema: {
    type: "object",
    properties: { limit: { type: "integer", minimum: 1, maximum: 50 } },
    required: []
  }
}
```

**Handler SQL:**
```sql
SELECT * FROM mt5_change_log ORDER BY created_at DESC LIMIT $1
```

---

### Domain 3: Connected Broker Accounts

#### `get_connected_accounts`
> All connected broker accounts (OANDA, Bitget, 5ers, Fxify, etc.).

```typescript
{
  name: "get_connected_accounts",
  description: "List all connected broker accounts across providers (OANDA, Bitget, MT5). Shows status, bot type, risk mode, and last sync.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler:** Call `listConnectedAccounts()` from `connectedAccounts.ts`.
Strip encrypted secrets — return only public metadata (account_key, provider, label, status,
bot_type, risk_mode, trail_mode, last_sync_utc, config, analysis).

**SECURITY NOTE:** NEVER include secrets/credentials in tool output. Only return
the `ConnectedAccount` type fields (no `secrets_encrypted` column).

---

#### `get_account_stats`
> Detailed stats for a specific connected account.

```typescript
{
  name: "get_account_stats",
  description: "Get detailed stats for a specific connected broker account — PnL, equity curve data, trade counts.",
  input_schema: {
    type: "object",
    properties: {
      account_key: { type: "string", description: "The account key (e.g. 'oanda:001-004-xxxxx' or 'bitget:main')." }
    },
    required: ["account_key"]
  }
}
```

**Handler:** Reuse patterns from `/api/accounts/connected/[accountKey]/stats`.

---

### Domain 4: COT / Institutional Positioning

#### `get_cot_signals`
> Latest COT directional signals by asset class.

```typescript
{
  name: "get_cot_signals",
  description: "Get latest Commitment of Traders directional signals. Shows institutional positioning for FX pairs, metals, energy, indices.",
  input_schema: {
    type: "object",
    properties: {
      asset_class: {
        type: "string",
        enum: ["fx", "metals", "energy", "indices", "crypto", "rates"],
        description: "Filter by asset class. Omit for all."
      }
    },
    required: []
  }
}
```

**Handler SQL:**
```sql
SELECT asset_class, report_date, pairs, fetched_at
  FROM cot_snapshots
 WHERE ($1::text IS NULL OR asset_class = $1)
 ORDER BY report_date DESC, fetched_at DESC
 LIMIT 1
```

Parse `pairs` JSON to extract direction, strength, and positioning data per instrument.

---

#### `get_cot_baskets`
> COT-derived currency basket signals (aggregate strength).

```typescript
{
  name: "get_cot_baskets",
  description: "Get COT-derived currency basket signals — aggregate currency strength rankings from institutional futures positioning.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler:** Reuse logic from `/api/cot/baskets/latest` or `/bot/cot/baskets/latest`.

---

### Domain 5: Sentiment

#### `get_sentiment_latest`
> Latest aggregated sentiment across all providers.

```typescript
{
  name: "get_sentiment_latest",
  description: "Get latest aggregated sentiment data across all providers (OANDA, MyFxBook, IG, TradingView, ForexClientSentiment). Shows net positioning and crowding state per symbol.",
  input_schema: {
    type: "object",
    properties: {
      symbols: {
        type: "array",
        items: { type: "string" },
        description: "Filter by symbols (e.g. ['EURUSD', 'GBPUSD']). Omit for all."
      }
    },
    required: []
  }
}
```

**Handler SQL:**
```sql
SELECT DISTINCT ON (symbol) symbol, crowding_state, agg_net, provider_count,
       long_pct, short_pct, timestamp_utc
  FROM sentiment_aggregates
 WHERE timestamp_utc > NOW() - INTERVAL '2 hours'
 ORDER BY symbol, timestamp_utc DESC
```

Filter by symbols if provided.

---

#### `get_sentiment_health`
> Check which sentiment providers are active and data freshness.

```typescript
{
  name: "get_sentiment_health",
  description: "Check sentiment provider health — which providers are active, last refresh time, and data freshness per provider.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler SQL:**
```sql
SELECT DISTINCT ON (provider) provider, symbol, timestamp_utc
  FROM sentiment_data
 ORDER BY provider, timestamp_utc DESC
```

Report age per provider and flag stale/offline ones.

---

### Domain 6: News Calendar

#### `get_news_calendar`
> Upcoming high-impact economic events.

```typescript
{
  name: "get_news_calendar",
  description: "Get upcoming high-impact economic events from ForexFactory. Shows events in the next 24-48 hours with forecast vs previous values.",
  input_schema: {
    type: "object",
    properties: {
      hours_ahead: { type: "integer", minimum: 1, maximum: 168, description: "Hours to look ahead (default 24)." },
      include_medium: { type: "boolean", description: "Include medium-impact events (default false)." }
    },
    required: []
  }
}
```

**Handler:** Reuse `getNewsBriefingData()` pattern from `nereus-queries.ts`, but parameterize
the horizon and optionally include medium-impact events.

---

### Domain 7: Performance / Antikythera

#### `get_performance_snapshot`
> Latest Antikythera performance model data.

```typescript
{
  name: "get_performance_snapshot",
  description: "Get latest Antikythera performance model snapshot — weekly returns by model (V1, V2, V3), comparison data.",
  input_schema: {
    type: "object",
    properties: {
      weeks: { type: "integer", minimum: 1, maximum: 52, description: "Number of weeks of history (default 4)." }
    },
    required: []
  }
}
```

**Handler SQL:**
```sql
SELECT model, week_open_utc, percent, returns, created_at
  FROM performance_snapshots
 WHERE week_open_utc >= NOW() - ($1 || ' weeks')::interval
 ORDER BY week_open_utc DESC, model
```

---

### Domain 8: Research Lab

#### `get_research_runs`
> Recent research/backtest runs and their status.

```typescript
{
  name: "get_research_runs",
  description: "Get recent research lab runs — backtests, parameter sweeps, and their results/status.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 50 },
      status: { type: "string", enum: ["pending", "running", "completed", "failed"], description: "Filter by status." }
    },
    required: []
  }
}
```

**Handler SQL:**
```sql
SELECT id, run_type, config_hash, status, result_summary, created_at, completed_at
  FROM research_runs
 WHERE ($1::text IS NULL OR status = $1)
 ORDER BY created_at DESC
 LIMIT $2
```

---

#### `get_research_candidates`
> Current research candidates.

```typescript
{
  name: "get_research_candidates",
  description: "Get current research candidates — pairs/instruments flagged for deeper analysis by the research lab.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler:** Reuse logic from `/api/research/candidates`.

---

### Domain 9: System Health

#### `get_system_health`
> Overall platform health: cron freshness, data staleness, bot connectivity.

```typescript
{
  name: "get_system_health",
  description: "Get overall platform health — cron job freshness, data staleness, and subsystem status for COT, prices, sentiment, news, and performance.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler:** Call `getCronStatusSummary()` from `cronStatus.ts`.
Returns `{ overall_state, subsystems: [{ key, label, state, last_refresh_utc, detail }] }`.

---

#### `get_platform_overview`
> One-shot "give me everything" summary across all domains.

```typescript
{
  name: "get_platform_overview",
  description: "Get a full platform overview — crypto, forex, accounts, system health, news, and performance in one call. Use this when Freedom asks 'what's going on' or wants a general status update.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

**Handler:** Call `assembleBriefingData("pre_ny")` from `nereus-queries.ts`.
This already aggregates all subsystems into a single formatted string.

---

## Implementation Plan

### Phase 1 — Quick Wins (reuse existing functions)

These tools can be wired up immediately because the query functions already exist:

| Tool | Source |
|------|--------|
| `get_forex_overview` | `nereus-queries.ts` → `getForexBriefingData()` |
| `get_oanda_bot_state` | Same pattern as `getBotState()` with different `bot_id` |
| `get_mt5_accounts` | `nereus-queries.ts` → `getAccountsBriefingData()` SQL |
| `get_connected_accounts` | `connectedAccounts.ts` → `listConnectedAccounts()` |
| `get_cot_signals` | `nereus-queries.ts` → COT query pattern |
| `get_sentiment_latest` | `nereus-queries.ts` → sentiment query pattern |
| `get_news_calendar` | `nereus-queries.ts` → `getNewsBriefingData()` |
| `get_system_health` | `cronStatus.ts` → `getCronStatusSummary()` |
| `get_platform_overview` | `nereus-queries.ts` → `assembleBriefingData()` |
| `get_performance_snapshot` | `nereus-queries.ts` → `getPerformanceData()` SQL |

**Estimated effort:** 2-3 hours. Mostly wiring up imports and `switch` cases.

### Phase 2 — New Queries

These need new SQL or adapting existing API route logic:

| Tool | Notes |
|------|-------|
| `get_mt5_positions` | New SQL against `mt5_positions` |
| `get_mt5_closed_trades` | New SQL against `mt5_closed_positions` |
| `get_mt5_changelog` | New SQL against `mt5_change_log` |
| `get_account_stats` | Adapt from `/api/accounts/connected/[accountKey]/stats` |
| `get_cot_baskets` | Adapt from `/api/cot/baskets/latest` |
| `get_sentiment_health` | New SQL against `sentiment_data` |
| `get_research_runs` | New SQL against `research_runs` |
| `get_research_candidates` | Adapt from `/api/research/candidates` |

**Estimated effort:** 3-4 hours. Some query adaptation needed.

---

## File Changes

### `src/lib/poseidon/tools.ts`

1. Add imports for `nereus-queries.ts` functions, `connectedAccounts.ts`, `cronStatus.ts`
2. Add 18 new entries to `toolDefinitions` array
3. Add 18 new `case` blocks in `handleToolCall` switch
4. Add helper functions for any new SQL queries not covered by existing imports

### New file: `src/lib/poseidon/tools-platform.ts` (optional)

If `tools.ts` gets too large (currently 747 lines), consider extracting platform tools
into a separate file with a `handlePlatformToolCall()` function that `tools.ts` delegates to.

---

## Security Guardrails

1. **No secrets in output.** Connected account tools must NEVER return encrypted credentials,
   API keys, or tokens. Only return public metadata fields.
2. **Read-only only.** No new tool should modify any database table, execute trades, or
   change account configuration.
3. **Query limits.** All list queries must have a `LIMIT` clause (max 200 rows).
4. **Input sanitization.** Reuse existing `normalizeLimit()`, `sanitizeMonthInput()`, etc.
5. **Error isolation.** Each tool handler must catch its own errors and return a descriptive
   error string, never throw into the Anthropic tool loop.

---

## Tool Count After Expansion

| Category | Before | After |
|----------|--------|-------|
| Bitget/Crypto | 8 | 8 (unchanged) |
| Forex/OANDA | 0 | 2 |
| MT5 Accounts | 0 | 4 |
| Connected Accounts | 0 | 2 |
| COT | 0 | 2 |
| Sentiment | 0 | 2 |
| News | 0 | 1 |
| Performance | 0 | 1 |
| Research | 0 | 2 |
| System | 0 | 2 |
| Memory | 6 | 6 (unchanged) |
| **Total** | **14** | **32** |

---

## System Prompt Update

After implementing the tools, Proteus's system prompt needs a section listing available
tool categories so it knows what to reach for:

```
## Your Tools
You have access to tools across the entire platform:
- **Crypto:** Bot state, trades, signals, ranges, bias, live prices, liquidation heatmaps, market snapshots
- **Forex:** Overview, OANDA bot state, COT signals, COT baskets, sentiment
- **Accounts:** MT5 accounts, MT5 positions, MT5 closed trades, connected broker accounts, account stats
- **Intelligence:** Sentiment (multi-provider), news calendar, performance/Antikythera, research lab
- **System:** Platform health, cron status, full platform overview
- **Memory:** Session state, archives, curation

When Freedom asks about any of these domains, use the appropriate tool. Never say you don't have access.
```

---

## Codex Implementation Prompt

When ready to implement, give Codex the following directive:

> Implement all 18 new tools defined in `docs/ai/poseidon/PROTEUS_TOOL_EXPANSION.md`.
> Phase 1 tools reuse existing query functions from `nereus-queries.ts`, `connectedAccounts.ts`,
> and `cronStatus.ts`. Phase 2 tools need new SQL queries — follow the SQL patterns shown in
> the spec. All tools are read-only. Never expose encrypted secrets. Add entries to both
> `toolDefinitions` and `handleToolCall` in `src/lib/poseidon/tools.ts`. If the file exceeds
> ~1000 lines, extract platform tools into `src/lib/poseidon/tools-platform.ts`.
