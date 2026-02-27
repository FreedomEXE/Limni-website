# Proteus Group Mode — Limni Community Chat

> **Author:** Claude (CTO) — February 2026
> **Status:** Design spec, pending Freedom's review
> **Priority:** HIGH — extends Proteus to group presence

---

## Overview

Proteus currently runs in **private mode** — 1:1 with Freedom via DM. This spec adds
**group mode** where Proteus joins the Limni community group chat with a fundamentally
different behavioral profile, information exposure policy, and memory architecture.

**Core principle:** Same brain, different persona. Group Proteus is the Limni analyst —
sharp, knowledgeable, community-facing. He never exposes proprietary systems, account
balances, or internal infrastructure. He's there to add value to the conversation, not
to be Freedom's personal CTO in public.

---

## 1. Chat Routing Architecture

### How It Works Today

```
index.ts middleware:
  if (ctx.from.id !== ownerId) → DROP
  → all handlers (text, commands)
```

Every non-Freedom message is silently dropped. The bot only operates in DM.

### How It Should Work

```
index.ts middleware:
  if (chat.type === "private") {
    if (ctx.from.id !== ownerId) → DROP
    → private handlers (full access, existing behavior)
  }
  if (chat.type === "group" || chat.type === "supergroup") {
    if (chat.id !== allowedGroupId) → DROP
    → group handlers (restricted access, group persona)
  }
```

**New env vars:**
```
TELEGRAM_GROUP_ID=           # The Limni group chat ID
PROTEUS_GROUP_ENABLED=true   # Kill switch
```

### Activation Model

Proteus should NOT respond to every message in the group. Options:

1. **Mention-triggered**: Only responds when tagged (`@ProteusBot`) or replied to
2. **Keyword-triggered**: Responds to questions directed at him or market-related queries
3. **Freedom-summoned**: Freedom can explicitly ask Proteus to weigh in

**Recommendation:** Mention-triggered as primary, with Freedom able to invoke him
via `/ask <question>` command. This prevents Proteus from being noisy. He speaks
when spoken to.

Optional future enhancement: Proteus silently observes all messages for scoring
and context, but only speaks when triggered.

---

## 2. Information Exposure Policy

This is the most critical piece. Three tiers:

### Tier 1: PUBLIC (safe to share in group)

| Category | What Proteus Can Say |
|----------|---------------------|
| Market commentary | General analysis, structure reads, level commentary |
| COT directional bias | "Institutions are net long EUR" (no specific numbers) |
| Sentiment | "Retail is crowded short on gold" (directional, not percentages) |
| News calendar | Upcoming events, impact assessment |
| Liquidation zones | General zone commentary ("heavy cluster above 100k") |
| Educational | Explain concepts, frameworks, market mechanics |
| Research insights | Sanitized findings, no config details |
| General market data | Prices, funding rates (all public data) |

### Tier 2: RESTRICTED (Freedom only, even in group)

| Category | Why Restricted |
|----------|---------------|
| Account balances/equity | Financial privacy |
| Position sizes/entries | Trade privacy |
| PnL figures (specific $) | Performance privacy |
| Bot states/configurations | Proprietary systems |
| Connected account details | Broker privacy |
| MT5 account specifics | Prop firm compliance |
| System health/infrastructure | Internal operations |
| Memory/session state | Private context |

### Tier 3: NEVER (not even Freedom should ask in group)

| Category | Why |
|----------|-----|
| API keys/credentials | Security |
| Specific strategy parameters | IP protection |
| Exact entry/exit rules | IP protection |
| Prop firm account numbers | Compliance |

### Implementation: Tool Filtering

Group mode gets a **different tool set**. Instead of all 32 tools (after expansion),
group mode gets a curated subset:

```typescript
const GROUP_ALLOWED_TOOLS = [
  "get_live_prices",           // Public price data
  "get_cot_signals",           // Directional only, strip numbers
  "get_cot_baskets",           // Currency strength rankings
  "get_sentiment_latest",      // Directional crowding only
  "get_news_calendar",         // Public events
  "get_liquidation_heatmap",   // Zone commentary (public data)
  "get_market_snapshot",       // Funding/OI (public data)
  // Memory tools for group context only:
  "get_group_context",         // Group-specific state (NEW)
  "update_group_context",      // Group-specific state (NEW)
  "score_contribution",        // Member scoring (NEW)
];
```

**Key:** Even for allowed tools, the **system prompt** instructs Proteus to present
data conversationally without raw numbers when discussing positioning. "Institutions
are building longs in EUR" not "Net non-commercial long 142,356 contracts."

### Freedom Override

Freedom can still ask Proteus to pull restricted data in the group. Proteus should:
1. Recognize Freedom as the owner
2. DM the restricted data to Freedom privately
3. In group, say: "Sent you the details privately."

This keeps proprietary data out of group history.

---

## 3. Group Persona & System Prompt

Proteus needs a separate system prompt for group mode. Key behavioral shifts:

### Private Mode (existing)
- CTO to Freedom
- Full data access
- Casual, direct, strategic
- Discusses internal systems freely
- Uses all tools

### Group Mode (new)
- Limni's market analyst
- Restricted data access
- Knowledgeable, engaging, slightly more polished
- Never references internal systems by name
- Discusses markets, not infrastructure
- Encourages and scores member contributions

### Group System Prompt Structure

```
PROTEUS_GROUP_CORE.md (new memory file):
- Identity: "You are Proteus, the Limni market intelligence analyst"
- Behavioral rules: what to share, what to withhold
- Member interaction guidelines
- Scoring framework reference
- Freedom recognition (owner gets special handling)

TRADING_FRAMEWORK.md (shared, already exists):
- Market knowledge, session timing, etc.

MARKET_KNOWLEDGE.md (shared, already exists):
- General market mechanics
```

**NOT loaded in group mode:**
- PROTEUS_CORE.md (contains CTO identity, internal context)
- LIMNI_PLATFORM.md (contains platform architecture details)
- BOT_OPERATIONS.md (contains bot implementation details)
- PROTEUS_STATE.md (private session state)

---

## 4. Member Contribution Scoring

### Why Score?

Freedom wants to identify:
- Who brings real alpha (quality market calls, research, insights)
- Who's engaged vs lurking
- Who could be a potential contributor/collaborator
- Conversation quality over time

### Scoring Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| **Insight Quality** | 40% | Original analysis, non-obvious observations, correct calls |
| **Engagement** | 20% | Consistency of participation, responsiveness |
| **Helpfulness** | 20% | Answering others' questions, sharing resources |
| **Signal-to-Noise** | 20% | Ratio of substantive to low-value messages |

### How Scoring Works

**Passive observation:** Proteus reads every group message (even when not triggered)
and maintains per-member scoring in the database.

**Scoring is NOT done by Proteus in real-time per message** — that would burn too many
API tokens. Instead:

1. **Message logging:** Every group message is stored with metadata (user, timestamp, length,
   whether it triggered Proteus, whether Proteus found it relevant)
2. **Periodic batch scoring:** A scheduled job (like Nereus) runs through recent unscored
   messages and uses a lightweight model (Haiku) to batch-evaluate contribution quality
3. **Running scores:** Aggregated into per-member profiles over time

### Database Schema

```sql
-- New migration: 010_poseidon_group.sql

CREATE TABLE IF NOT EXISTS poseidon_group_members (
  telegram_user_id   BIGINT PRIMARY KEY,
  username           VARCHAR(100),
  first_name         VARCHAR(100),
  display_name       VARCHAR(100),     -- Freedom can override
  role               VARCHAR(20) DEFAULT 'member',  -- owner | admin | member | muted
  total_messages      INTEGER DEFAULT 0,
  insight_score       DECIMAL(6,2) DEFAULT 0,
  engagement_score    DECIMAL(6,2) DEFAULT 0,
  helpfulness_score   DECIMAL(6,2) DEFAULT 0,
  signal_noise_score  DECIMAL(6,2) DEFAULT 0,
  composite_score     DECIMAL(6,2) DEFAULT 0,
  notable_calls       JSONB DEFAULT '[]',           -- tracked predictions with outcomes
  first_seen_utc      TIMESTAMPTZ DEFAULT NOW(),
  last_seen_utc       TIMESTAMPTZ DEFAULT NOW(),
  metadata            JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS poseidon_group_messages (
  id                 BIGSERIAL PRIMARY KEY,
  telegram_message_id BIGINT,
  telegram_user_id   BIGINT REFERENCES poseidon_group_members(telegram_user_id),
  message_text       TEXT,
  message_type       VARCHAR(20) DEFAULT 'text',     -- text | command | reply | media
  triggered_proteus  BOOLEAN DEFAULT FALSE,
  scored             BOOLEAN DEFAULT FALSE,
  score_result       JSONB,                          -- batch scoring output
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_messages_user ON poseidon_group_messages(telegram_user_id);
CREATE INDEX idx_group_messages_unscored ON poseidon_group_messages(scored) WHERE scored = FALSE;

CREATE TABLE IF NOT EXISTS poseidon_group_context (
  id                 SERIAL PRIMARY KEY,
  context_type       VARCHAR(30) DEFAULT 'active',   -- active | archive
  content            TEXT NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
```

### Scoring Batch Job (Nereus-style)

Runs every 6 hours (configurable). Pulls unscored messages, groups by user, sends
to Haiku with a scoring rubric:

```
Rate these messages from [username] on a 0-10 scale across:
- Insight quality: Original analysis? Non-obvious? Correct reasoning?
- Helpfulness: Helped others? Shared useful resources?
- Signal quality: Substantive content vs noise/memes/one-liners?

Return JSON: { insight: N, helpfulness: N, signal: N }
```

Composite score: weighted average, decayed over time (recent contributions matter more).

### Freedom Commands (DM only)

| Command | Action |
|---------|--------|
| `/scores` | Show leaderboard of group member scores |
| `/member @username` | Detailed score breakdown for one member |
| `/notable` | Recent high-quality contributions flagged |
| `/promote @user admin` | Change member role |
| `/mute @user` | Proteus ignores this user in group |

---

## 5. Group Memory Architecture

**Your question, Freedom — should group context be stored the same as personal convos?**

**No. Fundamentally different structure.** Here's why and what I recommend:

### Why Different

| Aspect | Private (DM) | Group |
|--------|-------------|-------|
| Participants | 1 (Freedom) | Many |
| Signal density | High (every message matters) | Low (lots of noise) |
| Context window | Full conversation history | Summarized threads only |
| Persistence goal | Remember everything | Remember insights, not chat |
| State structure | Single markdown doc | Per-topic summaries + member profiles |

### Group Memory Model

**Three layers:**

#### Layer 1: Raw Message Log (DB)
`poseidon_group_messages` table. Every message stored with user, timestamp, scoring.
This is the source of truth. Never loaded into Proteus's context window directly
(too much noise).

#### Layer 2: Group Active Context (DB + file)
Like `PROTEUS_STATE.md` but for the group. A structured summary of:
- Current active discussion topics
- Recent notable contributions
- Running themes / consensus views
- Any predictions or calls being tracked

Updated periodically by a batch job (not on every message).
Loaded into Proteus's system prompt when responding in group.

**Structure:**
```markdown
## Active Topics
- BTC structure: group discussing potential double top at 105k
- EUR/USD: mixed views, some members see COT divergence

## Notable Recent Contributions
- @trader_mike: Called the ETH bounce at 3200 on Feb 25 (correct)
- @fx_sarah: Shared institutional flow data showing EUR accumulation

## Running Themes
- Consensus bearish on GBP
- Interest in SOL ecosystem after recent rally

## Open Predictions (tracking)
- @trader_mike: BTC 115k by March 15
- @crypto_dan: ETH/BTC ratio reversal incoming
```

#### Layer 3: Group Archives (monthly, DB)
Monthly digests of group activity:
- Top contributors that month
- Notable calls and outcomes (verified against price data)
- Key discussion themes
- Score changes

Curated by Poseidon (same way personal archives work), stored in
`poseidon_group_context` table with `context_type = 'archive'`.

### Why Not File-Based Like Private Mode?

Private mode uses `PROTEUS_STATE.md` and `archives/YYYY-MM.md` files because
it's a single user with low volume. Group chat will have:
- Higher volume (many users, many messages)
- Structured data (scores, predictions, per-member stats)
- Queryable needs (leaderboards, member lookups)

**Database is the right home for group data.** Files are fine for Freedom's 1:1 state.

---

## 6. Conversation Flow Examples

### Example 1: Member asks about markets

```
@trader_mike: What's the BTC setup looking like?

@ProteusBot: Heavy short liquidation cluster stacked above 102k — if we
break through, there's fuel for a squeeze up to the 105-106k zone.
Institutions have been quietly building longs per the latest COT data.
Funding is slightly negative which means the leverage is actually on
the short side. Interesting setup.
```

Notice: No mention of bot positions, no account data, no specific liquidation
dollar amounts. Just directional commentary using public data.

### Example 2: Freedom asks for restricted info in group

```
Freedom: @ProteusBot what's my PnL this week?

@ProteusBot: Sent you the details privately.

[DM to Freedom]: Here's your week so far:
Bitget bot: 3 trades, +$1,240 (2W/1L)
MT5 accounts: ... [full breakdown]
```

### Example 3: Member makes a good call

```
@fx_sarah: EUR/USD looks like it wants to break the weekly high.
The COT flip last week plus the DXY weakness... I think we see 1.09
before we see 1.07.

@ProteusBot: Solid read, Sarah. The institutional flow does support
that thesis — commercials flipped net short on the dollar index recently.
The 1.09 level lines up with a weekly liquidity void too. Good eye.

[Internal: logs contribution, flags for scoring, tracks prediction]
```

### Example 4: Proteus observes but doesn't respond

```
@random_member: lol anyone else buying DOGE?
@another_member: haha yeah wagmi

[Internal: logged, scored as low signal-to-noise, no response]
```

---

## 7. Implementation Plan

### Phase 1: Foundation (Days 1-2)

| Task | Description |
|------|-------------|
| Migration 010 | Create group tables (members, messages, context) |
| Config update | Add `TELEGRAM_GROUP_ID`, `PROTEUS_GROUP_ENABLED` to config |
| Chat routing | Split `index.ts` middleware into private/group paths |
| Group middleware | Auth group by chat ID, register/update members on message |
| Group system prompt | Write `PROTEUS_GROUP_CORE.md` memory file |
| Group tools subset | Filter `toolDefinitions` for group mode |

### Phase 2: Conversations (Days 3-4)

| Task | Description |
|------|-------------|
| Message logging | Store every group message in DB |
| Mention detection | Trigger Proteus on @mention or `/ask` |
| Group conversation state | Separate history per group (not shared with DM) |
| Group context loading | Load group active context into system prompt |
| Freedom override | DM restricted data when Freedom asks in group |

### Phase 3: Scoring (Days 5-6)

| Task | Description |
|------|-------------|
| Batch scorer | Scheduled job to score unscored messages via Haiku |
| Score aggregation | Weighted composite with time decay |
| Prediction tracker | Log and verify market calls against price data |
| Freedom commands | `/scores`, `/member`, `/notable` in DM |

### Phase 4: Memory Curation (Day 7)

| Task | Description |
|------|-------------|
| Group context updater | Periodic job to summarize active discussions |
| Monthly archiver | Digest group activity into monthly archives |
| Poseidon integration | Add group context to Poseidon's curation scope |

---

## 8. New Files

| File | Purpose |
|------|---------|
| `migrations/010_poseidon_group.sql` | DB tables for group mode |
| `src/lib/poseidon/group-policy.ts` | Information exposure rules, tool filtering |
| `src/lib/poseidon/group-memory.ts` | Group context load/save, conversation isolation |
| `src/lib/poseidon/group-scoring.ts` | Batch scoring logic, aggregation, prediction tracking |
| `src/lib/poseidon/group-commands.ts` | Freedom-only DM commands for group management |
| `docs/ai/poseidon/memory/PROTEUS_GROUP_CORE.md` | Group persona system prompt |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/poseidon/config.ts` | Add group config (groupId, groupEnabled) |
| `src/lib/poseidon/index.ts` | Chat routing split, group handlers |
| `src/lib/poseidon/tools.ts` | Export `groupToolDefinitions` filtered subset |
| `src/lib/poseidon/nereus.ts` | Add group scoring batch schedule |

---

## 9. Cost Considerations

| Component | Token Cost | Frequency |
|-----------|-----------|-----------|
| Group responses | ~2k tokens/response | Per mention (low) |
| Batch scoring | ~500 tokens/batch | Every 6 hours |
| Context updates | ~1k tokens | Every 6 hours |
| Monthly archives | ~3k tokens | Monthly |

**Estimated additional cost:** Minimal. Proteus only responds when mentioned, and
scoring uses Haiku (cheap). The expensive part (Sonnet for responses) is gated
behind explicit triggers.

---

## 10. Decisions (Confirmed by Freedom — Feb 27 2026)

1. **Activation model:** Both. Mention-triggered AND smart interjection on quality
   discussions. Proteus should jump in when he detects substantive market analysis
   happening, not just when explicitly tagged.

2. **Scoring visibility:** Members see a leaderboard. Build a periodic leaderboard
   post and allow members to check their standing.

3. **Group persona name:** Proteus. Same brand, same identity.

4. **Prediction tracking:** Active. Proteus calls out bold predictions ("I'll track
   that") and follows up with verification against price data.

5. **Multi-group support:** Limni group only for now, but architect the DB schema
   and routing for multi-group extensibility (group_id foreign keys, per-group
   context, etc.).
