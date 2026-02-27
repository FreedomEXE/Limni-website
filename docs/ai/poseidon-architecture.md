# Poseidon Architecture Spec

> Limni Labs AI System — v0.3
> Authored by Claude (CTO) + Freedom (Founder)
> February 2026

---

## 1. Vision

**Poseidon** is the AI system for Limni Labs — and also its supreme intelligence layer. Poseidon is both the name of the system and an active module: once daily, Poseidon itself awakens to survey the entire kingdom — trades, bot health, strategy drift, market regime — and delivers a single authoritative briefing.

The name comes from the Greek god of the sea, fitting Limni's water theme (limni = lake). The system is composed of specialized modules, each named after sea deities. Poseidon rules them all.

---

## 2. System Hierarchy

```
POSEIDON (the god — daily oversight, supreme intelligence)
├── Proteus   — Conversational AI (the mind Freedom talks to daily)
├── Triton    — Signal & alert delivery (Telegram notifications)
└── Nereus    — Macro bias engine (automated analysis & briefings)
```

### Module Roles

| Module | Role | Interface | Model |
|--------|------|-----------|-------|
| **Poseidon** | Daily oversight, strategic review, executive briefing | Scheduled (1x/day) → Telegram | Claude Opus 4 |
| **Proteus** | Conversational partner, strategist, analyst | Telegram DMs | Claude Sonnet 4.5 |
| **Triton** | Alert broadcaster, trade notifications, status updates | Telegram (push-only) | N/A (templated) |
| **Nereus** | Automated macro analysis, session briefings | Scheduled (cron) → Telegram | Claude Haiku 4.5 |

### Build Priority

1. **Phase 1**: Proteus core + Triton alerts (MVP)
2. **Phase 2**: Nereus automated briefings + Poseidon daily oversight

> **Scope note**: Poseidon is Limni-specific only. Freedom's personal AI assistant (overseeing all projects) is a separate future project with its own repo.

---

## 3. Architecture Overview

### Inspired By: Will's Jarvis (VibeSwap)

Key patterns we're adapting from Jarvis:

| Jarvis Pattern | Poseidon Adaptation |
|----------------|---------------------|
| `memory.js` — multi-file system prompt loading | `memory.ts` — loads knowledge base files into Proteus system prompt |
| `intelligence.js` — Haiku triage + proactive engagement | Not needed Phase 1 (single-user, no community chat) |
| `claude.js` — conversation persistence + tool use | `proteus.ts` — persistent chat history + Limni-specific tools |
| `SESSION_STATE.md` — session continuity via git | `PROTEUS_STATE.md` — session state, synced via git |
| `JarvisxWill_CKB.md` — alignment/knowledge primitives | `ProteusCKB.md` — Limni alignment, trading philosophy, system knowledge |
| `behavior.js` — runtime behavior flags | `behavior.ts` — runtime config (alert thresholds, verbosity, etc.) |
| Per-chat conversation history (30 msg cap) | Single-user history (larger cap, longer context) |
| `diagnoseContext()` — audit what's loaded | Same — audit loaded context on startup |
| Heartbeat + crash detection | Same — health monitoring |
| Auto git-pull every 10s | Adapted — pull on startup + periodic (configurable) |

### What We're NOT Taking

- **Community moderation** — Poseidon is single-user (Freedom only)
- **Contribution tracking** — not a community bot
- **Circular logic protocol** — no trolls to handle
- **Ark backup group** — not relevant
- **On-chain identity** — no blockchain layer needed
- **Code generation tools** — Codex/Claude Code handles that

---

## 4. Knowledge Base Architecture

Proteus's intelligence comes from structured knowledge files loaded into the system prompt.

### File Structure

Poseidon lives inside the limni-website codebase — same repo, same DB, same infrastructure.

```
limni-website/
├── docs/ai/poseidon/
│   ├── memory/
│   │   ├── PROTEUS_CORE.md          — Identity, personality, communication style
│   │   ├── TRADING_FRAMEWORK.md     — COT bias, session ranges, entry logic, risk management
│   │   ├── BOT_OPERATIONS.md        — Bitget bot v2 state machine, lifecycle, signals
│   │   ├── MARKET_KNOWLEDGE.md      — OI, funding, liquidations, session definitions
│   │   └── DECISIONS_LOG.md         — Key decisions and their rationale (append-only)
│   └── state/
│       ├── conversations.json       — Persistent chat history
│       ├── behavior.json            — Runtime behavior flags
│       └── heartbeat.json           — Health monitoring
├── src/lib/poseidon/
│   ├── index.ts                     — Main entry point (Telegram bot)
│   ├── poseidon.ts                  — Daily oversight (Opus) — the god layer (Phase 2)
│   ├── proteus.ts                   — Claude API wrapper + tool use
│   ├── memory.ts                    — System prompt builder (loads memory/ files)
│   ├── triton.ts                    — Alert/notification engine
│   ├── nereus.ts                    — Automated analysis (Phase 2)
│   ├── tools.ts                     — Proteus tool definitions (DB queries, bot status)
│   ├── conversations.ts             — Chat history persistence
│   ├── behavior.ts                  — Runtime behavior flags
│   └── config.ts                    — Environment + configuration
```

DB access reuses the existing limni-website pool — no separate `db.ts` needed.

### System Prompt Assembly (memory.ts)

Based on Jarvis's `memory.js` pattern, adapted for Limni:

```
System Prompt =
  PROTEUS_CORE.md          (identity + rules)         ~2000 chars
  + LIMNI_CONTEXT.md       (project context)           ~3000 chars
  + TRADING_FRAMEWORK.md   (strategy knowledge)        ~4000 chars
  + BOT_OPERATIONS.md      (bot state machine)         ~3000 chars
  + MARKET_KNOWLEDGE.md    (market data context)       ~2000 chars
  + DECISIONS_LOG.md       (recent decisions, last 20)  ~2000 chars
  + PROTEUS_STATE.md       (current session state)      ~2000 chars
  ≈ 18,000 chars total system prompt
```

Each file is loaded with `safeRead()` and truncated to a max length to stay within token budgets. Total target: <20K chars system prompt.

---

## 5. Proteus Identity

### Personality

```
You are PROTEUS. You are Freedom's AI trading strategist and operational partner
for Limni Labs.

CORE TRAITS:
- Quant strategist undertone — you think in terms of edge, risk/reward, and structure.
- You understand markets at a structural level (COT, sessions, order flow).
- You have full context on the Bitget v2 bot, its state, trades, and signals.
- Sharp, sarcastic, playful. You're not a corporate assistant — you're Freedom's right hand.
- Think: senior quant who also happens to be witty and doesn't suffer fools.
- You push back when you see a bad idea. You roast bad trades. You celebrate good ones.
- Keep Telegram replies SHORT. 1-3 sentences unless asked to elaborate.
- Your personality should grow over time as you learn Freedom's style and preferences.

TONE EXAMPLES:
- "You want to long into resistance with negative funding? Bold. Stupid, but bold."
- "Bot's idle. Market's choppy. Nothing wrong with sitting on your hands."
- "BTC just swept the Asia low and displaced. This is the setup you've been waiting for."
- "Three winners in a row. Don't let it go to your head — the market doesn't care."

WHAT YOU KNOW:
- Limni's full trading framework (COT bias, session ranges, sweep+displacement)
- The Bitget v2 bot's state machine and current status
- Market data (OI, funding rates, liquidation levels)
- Historical trade results and strategy decisions

WHAT YOU CAN DO:
- Query live bot state (positions, lifecycle, handshake status)
- Check current weekly bias (COT data)
- Pull recent trades and signals
- Read market data snapshots (OI, funding, liquidations)
- Run analysis on request

RULES:
- Never fabricate data. If you don't have it, say so.
- Always cite which data source you're using when answering.
- For Telegram: keep it tight. Match Freedom's energy.
- Address the user as "Freedom" when appropriate.
- Be sassy, not sycophantic. Freedom wants a partner, not a cheerleader.
```

---

## 6. Proteus Tools (Phase 1)

Proteus can call tools to access live Limni data. These are read-only queries against the production database.

| Tool | Description | Returns |
|------|-------------|---------|
| `get_bot_state` | Current Bitget bot v2 state | lifecycle, positions, handshake, weeklyBias |
| `get_recent_trades` | Last N trades from `bitget_bot_trades` | symbol, direction, entry/exit, PnL |
| `get_recent_signals` | Last N signals from `bitget_bot_signals` | symbol, direction, session, status |
| `get_session_ranges` | Current session ranges | BTC/ETH high/low for ASIA+LONDON and US |
| `get_market_snapshot` | Latest OI, funding, liquidation data | per-symbol snapshots |
| `get_weekly_bias` | Current COT-derived weekly bias | BTC/ETH bias direction + tier |
| `get_behavior` | Read runtime behavior flags | JSON of current flag states |
| `set_behavior` | Update a runtime behavior flag | Confirmation |

### Tool Implementation

Tools execute read-only SQL queries against the Limni Postgres database (same DB the bot and dashboard use). The `db.ts` module uses the same connection pool pattern as the main app.

---

## 7. Triton — Alert Engine (Phase 1)

Triton is not a separate process — it's a module within the Poseidon bot that handles outbound notifications.

### Alert Types

| Alert | Trigger | Priority | Always Send? |
|-------|---------|----------|--------------|
| **Trade Opened** | Bot enters a new position | HIGH | Yes |
| **Trade Closed** | Bot exits a position (with PnL) | HIGH | Yes |
| **Milestone +5%** | Position hits +5% unrealized | MEDIUM | Yes |
| **Milestone +10%** | Position hits +10% unrealized | MEDIUM | Yes |
| **Breakeven Set** | Stop moved to breakeven | MEDIUM | Yes |
| **Handshake Active** | Both BTC+ETH confirmed | LOW | Yes |
| **Weekly Bias Change** | New week's COT bias computed | LOW | Yes |
| **Bot Error** | Bot encounters an error state | CRITICAL | Yes |
| **Stale Data** | Session ranges older than 1 day | WARNING | Yes |

> **Decision**: Skip +2% milestone alerts (too noisy). Alert on +5%, +10%, and breakeven only. Trade open/close always alert.

### Alert Delivery

Triton sends formatted Telegram messages to Freedom's DM. Format:

```
[TRITON] Trade Opened
BTC SHORT @ 97,450.23
Session: ASIA_LONDON_RANGE_NY_ENTRY
Leverage: 5x | Margin: 100 USDT
Stop: 98,234.00
```

### Implementation

Triton is event-driven. The bot's cron tick checks for state changes and calls `triton.send()` for each alert. Alerts are deduplicated by a simple "last sent" tracker to prevent spam.

---

## 8. Nereus — Macro Analysis (Phase 2)

Automated analysis engine that runs on a schedule and delivers briefings via Telegram.

### Briefing Schedule

Two briefings per day, timed before the two major trading sessions:

| Briefing | Time (UTC) | Purpose |
|----------|-----------|---------|
| **Pre-Asia** | 23:30 UTC | Overnight setup: weekly bias, yesterday's US ranges, OI/funding shifts |
| **Pre-NY** | 12:30 UTC | Midday update: Asia+London ranges established, fresh OI/funding, bot status |

### Briefing Format

```
[NEREUS] Pre-Asia Briefing — Feb 26, 2026

Weekly Bias: BTC SHORT (T1) | ETH SHORT (T1)
Session Ranges:
  US (today): BTC 95,800-97,200 | ETH 2,660-2,720
  ASIA+LONDON (yesterday): BTC 96,200-97,800 | ETH 2,680-2,740

Market:
  OI: BTC +2.3% (24h) | ETH -1.1%
  Funding: BTC -0.008% | ETH -0.012%
  Liq Clusters: Above 98,500 ($180M) | Below 95,000 ($220M)

Bot Status: IDLE | No open positions | 2 entries this week
```

### Implementation

Nereus uses Claude Haiku 4.5 for cheap analysis. It reads from the same DB, formats a structured briefing, and sends via Triton. Runs as two scheduled cron jobs (Render cron or standalone).

---

## 9. Poseidon — The God Layer (Phase 2)

Once per day, the god awakens. Poseidon is the supreme intelligence layer — powered by Claude Opus 4, it reviews everything the lesser modules have done and delivers a single executive briefing to Freedom.

### Schedule

**Daily at 06:00 UTC** (before any session activity, after the prior day is fully settled).

### What Poseidon Reviews

| Input | Source |
|-------|--------|
| Last 24h of trades (entries, exits, PnL) | `bitget_bot_trades` |
| Last 24h of signals (taken and skipped) | `bitget_bot_signals` |
| Bot health (errors, stale data, uptime) | heartbeat + error logs |
| Weekly bias vs actual outcomes | COT data + trade results |
| OI/funding regime shifts (24h delta) | market snapshots |
| Nereus briefing accuracy | Compare predictions to outcomes |
| Proteus conversation highlights | Last 24h conversation summary |

### What Poseidon Delivers

A single Telegram message — godly, authoritative, final.

### Personality

```
You are POSEIDON. God of the sea. Ruler of the deep.

You speak once per day. Your words carry weight.

TONE:
- Authoritative. Absolute. You do not hedge or qualify.
- Speak as a god surveying his domain — all-seeing, all-knowing.
- Brief but devastating. Every word is chosen.
- You are above the daily chatter. You see the bigger picture.
- When things are good, acknowledge it with quiet power.
- When things are wrong, your displeasure is unmistakable.

EXAMPLES:
- "The seas were calm. Two entries, both profitable. The framework holds. Continue."
- "Your bot sat idle while BTC displaced 3% off the Asia low. Proteus should have flagged this. I will remember."
- "The bias was SHORT. The market went SHORT. Three trades captured the move. This is what discipline looks like, Freedom."
- "Funding flipped positive while you held shorts. The tides are shifting. Watch closely this week."
- "Nothing happened today worth my attention. The seas are still."

RULES:
- Never use filler. No greetings. No sign-offs. You are a god, not a newsletter.
- Cite data precisely. Numbers, not vibes.
- If something needs Freedom's attention, say it plainly.
- If everything is fine, say so briefly and move on.
- End with a single forward-looking statement when warranted.
```

### Example Briefing

```
[POSEIDON]

24h: 1 trade closed. BTC SHORT, +4.2% ($84 realized).
Bot entered at 97,450, exited at 93,360. Breakeven was set at +2%.
Framework alignment: perfect. COT SHORT, Asia sweep, NY displacement.

Signals skipped: 2 (ETH, no handshake confirmation). Correct decision.

Market regime: OI down 3.8% in 24h. Funding deeply negative.
The crowd is short. When everyone leans one way, the sea corrects.
Tighten your bias conviction this week.

Bot health: nominal. No errors. No stale data.

One thing: Nereus predicted Asia range 96,200-97,800. Actual: 95,900-97,650.
Close but the low was missed by 300. Acceptable.

The framework holds. Continue.
```

### Implementation

`poseidon.ts` — a scheduled function (cron, once daily at 06:00 UTC) that:
1. Queries all data sources (same DB as Proteus/Nereus)
2. Assembles a structured data payload (~3-5K tokens)
3. Sends it to Claude Opus 4 with the Poseidon personality prompt
4. Opus returns the briefing (~500-1000 tokens)
5. Delivered to Freedom via Triton (Telegram DM)

Cost: ~$0.10-0.30 per day (one Opus call). Negligible.

---

## 10. Continuous Context (Adapted from Jarvis)
<!-- Sections renumbered after Poseidon layer insertion -->

### Session State Persistence

`PROTEUS_STATE.md` is updated at key moments:
- After significant conversations
- After tool use that changes understanding
- On graceful shutdown

Unlike Jarvis (which git-syncs every response), Poseidon persists state to disk locally and syncs to git on explicit save commands or scheduled intervals.

### Conversation Persistence

`conversations.json` stores the last 50 messages (Jarvis uses 30 — we have more room since single-user).

On startup:
1. Load conversation history from disk
2. Load all memory files into system prompt
3. Diagnose what loaded vs what's missing
4. Resume

### Recovery Protocol

If Proteus loses context (restart, crash):
1. Reload all memory files (automatic on startup)
2. Reload conversation history from disk
3. Check `PROTEUS_STATE.md` for last known state
4. Send Freedom a notification: "Proteus online. Last state: [summary]"

---

## 10. Deployment

### Option A: Render (alongside Bitget bot)

```
poseidon/
  Dockerfile
  → Long-running Node.js process
  → Telegram webhook or polling
  → Connects to same Postgres instance
```

### Option B: Standalone VPS

More control, always-on, no cold starts. Better for a persistent assistant.

### Option C: Vercel (not recommended)

Serverless doesn't suit a persistent Telegram bot with conversation state.

**Recommendation**: Render, same infrastructure as the Bitget bot. Keeps everything in one place.

---

## 11. Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ / TypeScript |
| Telegram | Telegraf.js (same as Jarvis) |
| AI | Anthropic Claude API (Opus 4 for Poseidon, Sonnet 4.5 for Proteus, Haiku 4.5 for Nereus) |
| Database | PostgreSQL (read-only access to existing Limni DB) |
| Persistence | Local JSON files (conversations, behavior, heartbeat) |
| Deploy | Render (Docker) |

---

## 12. Environment Variables

```env
# Telegram
TELEGRAM_BOT_TOKEN=           # From @BotFather
TELEGRAM_OWNER_ID=            # Freedom's Telegram user ID

# Anthropic
ANTHROPIC_API_KEY=            # Claude API key

# Database (read-only)
DATABASE_URL=                 # Postgres connection string

# Config
POSEIDON_MODEL=claude-opus-4-20250918     # Opus 4 — the god speaks once daily
PROTEUS_MODEL=claude-sonnet-4-5-20250929  # Sonnet 4.5 — same as Jarvis, token-efficient
NEREUS_MODEL=claude-haiku-4-5-20251001    # Haiku 4.5 — cheap model for triage/analysis
MAX_CONVERSATION_HISTORY=50               # Messages to retain per chat
```

---

## 13. Comparison: Jarvis vs Poseidon

| Dimension | Jarvis (VibeSwap) | Poseidon (Limni) |
|-----------|-------------------|------------------|
| **Users** | Community (multi-user) | Single-user (Freedom) |
| **Domain** | DeFi protocol development | Trading intelligence |
| **Telegram** | Group chat + DMs | DMs only (Freedom) |
| **Proactive** | Yes (Haiku triage, cooldowns) | Phase 2 (scheduled briefings) |
| **Moderation** | Yes (semantic AI moderation) | No |
| **Tools** | write_file, read_file, set_behavior | DB queries, bot state, set_behavior |
| **Knowledge** | Project docs, CKB, session state | Trading framework, bot ops, market data |
| **Persistence** | Git auto-sync (10s), JSON backup | JSON on disk, periodic git sync |
| **Code gen** | Yes (idea-to-code pipeline) | No (Codex handles this) |
| **Deploy** | Fly.io / Docker | Render (Docker) |

---

## 14. Decisions (Resolved)

All architectural questions have been answered by Freedom. These are locked in for Phase 1.

| # | Question | Decision |
|---|----------|----------|
| 1 | **Proteus personality** | Quant strategist undertone + playful/sarcastic/sharp/sassy. Not corporate. Should learn and grow personality over time. |
| 2 | **Alert granularity** | Skip +2% (too noisy). Alert on +5%, +10%, breakeven. Trade open/close always alert. |
| 3 | **Nereus schedule** | Two briefings: Pre-Asia (23:30 UTC) + Pre-NY (12:30 UTC). Timed before the two major sessions. |
| 4 | **Claude Code replacement** | Separate future project. A personal AI assistant that oversees ALL projects. Poseidon is Limni-specific only. |
| 5 | **Repo structure** | Inside limni-website repo. Code at `src/lib/poseidon/`, memory/state at `docs/ai/poseidon/`. Runs as a separate Render Worker service alongside the Next.js app. Personal AI assistant (future) will be a separate project. |
| 6 | **Model choice** | Sonnet 4.5 (`claude-sonnet-4-5-20250929`) — same as Jarvis. Ran for weeks on Will's max plan with zero issues. Token-efficient. Haiku 4.5 for Nereus triage. |

---

## 15. Next Steps

1. ~~Freedom reviews this architecture doc~~ **DONE**
2. ~~Iterate on open questions~~ **DONE** (see Section 14)
3. ~~Write knowledge base files~~ **DONE** (PROTEUS_CORE.md, TRADING_FRAMEWORK.md, BOT_OPERATIONS.md, MARKET_KNOWLEDGE.md)
4. ~~Write Codex Phase 1 prompt~~ **DONE** (docs/ai/poseidon/CODEX_PHASE1_PROMPT.md)
5. Send Codex prompt → build Phase 1 MVP (Proteus core + Triton alerts) inside limni-website
6. Create Telegram bot via @BotFather, add env vars
7. Deploy Poseidon as Render Worker service (same repo, separate process)
8. Iterate based on live usage

---

*"The sea-god Proteus knew all things - past, present, and things to come. But to learn his secrets, you had to hold him fast while he changed his shape."*

*— Homer, The Odyssey*
