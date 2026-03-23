# Crypto Matrix Board — Design Memo

> Status: DESIGN — Pre-implementation research synthesis
> Author: Nyx (synthesized from Freedom's research corpus)
> Date: 2026-03-20

---

## 1. Board Purpose & Philosophy

### What This Board Is

A **manual trading decision board** for crypto — the equivalent of the FX Flagship matrix, adapted for crypto's fundamentally different market structure. It answers one question per alt, per session:

> **"Is this alt ready to trade, in what direction, and how confident should I be?"**

### What This Board Is NOT

- **Not a bot dashboard.** The V2/V3 bot runs autonomously. This board is for Freedom's manual discretionary trades.
- **Not a single binary gate.** The FX matrix works as a 3-column majority vote (COT dealer + COT commercial + sentiment). That architecture does NOT translate to crypto. Crypto has no COT data, no standardized sentiment feeds, and the edge comes from different places.
- **Not a kitchen sink.** OI, funding, liquidation clusters, handshake confirmation — these are all interesting data points. But the research clearly shows that stacking them as hard gates **destroys returns** (V2: 112% → 64% when OI/funding gating was added). The board must resist the urge to over-gate.

### Core Design Principle

**Layers, not gates.**

```
Layer 1: DIRECTION    → BTC/ETH regime tells you which way
Layer 2: QUALITY      → Alt ranking tells you which alts deserve capital
Layer 3: READINESS    → Trigger proximity tells you when to enter
Layer 4: CONTEXT      → OI/funding/liquidation inform sizing, not direction
```

Each layer narrows the field but none is a binary kill switch. Freedom reads the board top-to-bottom and makes a judgment call — exactly how the FX matrix works in practice.

---

## 2. Universe Design

### 2.1 Anchor Assets: BTC & ETH

BTC and ETH are not traded the same way as alts. They are **regime indicators** — the tide that lifts or sinks all boats.

**BTC/ETH on the board serve as:**
- Directional bias (LONG / SHORT / NEUTRAL)
- Regime classification (trending vs ranging vs volatile)
- Handshake anchors (V2 handshake = BTC/ETH confirming alt sweep direction)

**How to determine BTC/ETH bias:**
The bot already computes this. From `bitgetBotSignals.ts`, the bias vote uses:
- **Multi-timeframe trend** (4H, 1H, 15m closes vs open — 3 votes)
- **OI delta direction** (1 vote, currently disabled in production)
- Majority → HIGH/MEDIUM/NEUTRAL

For the manual board, use the same 3-vote (price-only) model but on **daily and 4H timeframes** to match manual trading horizons. This is a weekly-ish bias, not a 5-minute scalp signal.

### 2.2 Alt Universe: Dynamic Ranked Pool

**Source:** `alt-pair-rankings.md` composite scoring system.

**Current top tier (A+B):** 17 pairs from 77 analyzed.
- Tier A (≥70): SOL (86.68), XRP (70.82), SUI (70.45)
- Tier B (≥55): DOGE (69.84), LINK (67.67), ADA (65.34), AVAX (62.73), PEPE (61.65), DOT (58.23), HBAR (57.10), WIF (56.07), NEAR (55.28), BNB (53.91), TRX (52.57), RENDER (52.56), FET (50.57), AAVE (50.45)

**Scoring formula** (35% correlation + 25% volume + 15% ATR + 10% OI + 5% spread + 5% leverage + 5% funding stability) is a reasonable heuristic but has a critical gap: **it has never been validated against actual trade performance.**

**Hard fail criteria are sound:**
- Correlation to BTC < 0.50 → cut
- 24h volume < $5M → cut
- Open interest < $2M → cut

**Design decision: Universe refreshes weekly.** Run the ranking script Sunday before Asia open. The board displays the current week's ranked universe (top 15-20 alts). Pairs that fall below Tier B get dropped; new entrants get added.

### 2.3 Universe Size for Manual Trading

The FX matrix covers 36 instruments across 3 sessions. That's already the upper bound of what Freedom can monitor manually.

For crypto, target **12-15 alts** plus BTC/ETH = **14-17 total instruments.** Crypto trades 24/7 but Freedom applies session windows (Asia/London/NY), so the monitoring load is comparable to FX.

**Cut rule:** If the board grows beyond 17 instruments, drop the lowest-ranked alts until it's back to 15.

---

## 3. Board Structure & Layout

### 3.1 Row Structure

Each row = one alt. Rows sorted by composite rank (highest first).

```
┌──────────────────────────────────────────────────────────────────────┐
│ BTC REGIME: LONG (HIGH)  │  ETH REGIME: LONG (MEDIUM)              │
│ Handshake: ALIGNED       │  Market Phase: TRENDING                  │
├──────────────────────────────────────────────────────────────────────┤
│ Rank │ Alt  │ Direction │ Trigger │ Swing Target │ Context         │
├──────┼──────┼───────────┼─────────┼──────────────┼─────────────────┤
│  1   │ SOL  │ LONG ▲    │ 4H READY│ +2.4%        │ OI↑ Fund+      │
│  2   │ XRP  │ LONG ▲    │ IDLE    │ ---          │ OI— Fund+      │
│  3   │ SUI  │ SHORT ▼   │ 1H WATCH│ -1.8%        │ OI↑ Fund−      │
│  4   │ DOGE │ NEUTRAL — │ ---     │ ---          │ OI— Fund—      │
│  ...                                                                │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Column Definitions

| Column | Source | Purpose | Update Frequency |
|--------|--------|---------|-----------------|
| **Rank** | Alt ranking composite score | Position in universe. Higher = more capital-worthy | Weekly |
| **Alt** | Symbol | Identity | Static |
| **Direction** | BTC/ETH regime + alt correlation alignment | LONG / SHORT / NEUTRAL. Alt must align with BTC direction AND its own structure | Weekly bias, checked per session |
| **Trigger** | Stoch+RSI state on qualifying timeframe | IDLE → WATCHING → READY → TRIGGERED. Same cascade as FX scanner (4H→1H→15M→5M) | Every 5 minutes during sessions |
| **Swing Target** | 4H fractal-based swing target | Distance to nearest confirmed swing. Tells Freedom if the R:R is worth it | Hourly (on 4H candle close) |
| **Context** | OI delta, funding rate, liquidation proximity | Informational glyphs. NOT gates. Tells Freedom about market conditions | Every 5 minutes |

### 3.3 Direction Logic (How Alts Get LONG/SHORT/NEUTRAL)

This is the critical design question. The FX matrix uses 3 independent data sources (COT dealer, COT commercial, sentiment) and majority-votes them. Crypto has no equivalent independent sources.

**Proposed model: BTC-led direction with alt structure confirmation.**

```
Step 1: BTC weekly bias → LONG or SHORT or NEUTRAL
Step 2: If BTC is NEUTRAL → all alts NEUTRAL (no trades)
Step 3: If BTC has direction:
   a. Alt correlation to BTC > 0.75 → inherit BTC direction
   b. Alt correlation to BTC 0.50-0.75 → check alt's own 4H structure
      - Alt 4H trend aligns with BTC → inherit direction
      - Alt 4H trend opposes BTC → NEUTRAL (conflicted)
   c. Alt correlation to BTC < 0.50 → already cut from universe
```

**Why this works:**
- V3 research proved high-correlation alts (>0.75) outperform: 121 trades, 68.6% WR
- BTC regime is THE dominant factor in crypto. Fighting it is the #1 way to lose
- No fake independence — we're not inventing 3 "sources" that are really all just price

**What this does NOT include:**
- Handshake as a direction filter. Handshake is an entry confirmation, not a bias signal. The V2 bot uses it correctly (confirms sweep direction matches BTC/ETH momentum). But for the manual board's weekly direction column, handshake is too granular.

---

## 4. Orion-Style Inspiration

The FX Flagship matrix (codename Orion) works because it's:
1. **Simple to read** — 36 rows, 3 colored columns, one PASS/SKIP decision
2. **Weekly cadence** — set it Sunday, trade it all week
3. **Session-aware** — different pairs eligible per session
4. **Trigger-separated** — matrix gives direction, scanner gives timing

The crypto board should mirror this architecture:

| Orion (FX) | Crypto Board | Adaptation |
|-----------|-------------|------------|
| COT Dealer column | BTC Regime | BTC replaces institutional positioning data |
| COT Commercial column | Alt Structure | Alt's own 4H trend replaces commercial hedger data |
| Sentiment column | Correlation Alignment | High-corr alts auto-align; mid-corr need structure check |
| PASS/SKIP gate | LONG/SHORT/NEUTRAL | Same concept, different inputs |
| Session eligibility | All pairs all sessions | Crypto is 24/7 — no session filtering needed for eligibility (but scanner still runs per-session for Freedom's schedule) |
| RRanjanFX trigger | Stoch+RSI trigger (same indicator) | Use same settings (21,13,3,3) — needs validation on crypto timeframes |
| 4H swing target | 4H swing target | Same fractal logic applies |

**Key difference:** Crypto doesn't need session-based pair filtering because all pairs trade 24/7. But Freedom still operates on a session schedule, so the scanner groups notifications by session.

---

## 5. Data Point Classification

### CORE — On the board, visible, drives decisions

| Data Point | Column | Why Core |
|-----------|--------|----------|
| **BTC weekly bias** | Direction header | Dominant market driver. No alt trades against BTC trend. Proven by all backtests. |
| **Alt composite rank** | Rank column | Determines universe membership and capital priority. Top-ranked alts get first allocation. |
| **Alt direction** | Direction column | BTC alignment + alt structure. The "should I trade this?" answer. |
| **Stoch+RSI state** | Trigger column | Entry timing. Same indicator as FX, same settings. Cascade: 4H→1H→15M→5M. |
| **4H swing target** | Swing Target column | R:R assessment. If target is only 0.3% away, not worth the trade. |

### CONTEXTUAL — On the board, visible, informs but doesn't gate

| Data Point | Display | Why Contextual (Not Core) |
|-----------|---------|--------------------------|
| **OI delta (24h)** | Small glyph (↑/↓/—) | Interesting for conviction. Rising OI + price trending = real move. But as a hard gate it HURT returns (V2: 112% → 64%). Observe only. |
| **Funding rate** | Small glyph (+/−/~) | Extreme funding can signal crowded trades. But gating on it destroyed edge. Informational only. |
| **ETH regime** | Header alongside BTC | Secondary anchor. If ETH diverges from BTC, it's a warning but not a veto. |
| **Alt ATR (current vs 20-day avg)** | Tooltip or secondary row | Volatility context for sizing. High ATR = reduce size. Low ATR = normal size. |

### HIDDEN — Computed but not displayed, used internally

| Data Point | Usage | Why Hidden |
|-----------|-------|-----------|
| **Correlation coefficient** | Universe filtering (hard fail < 0.50) and direction logic (> 0.75 auto-align) | It's an input to the direction algorithm, not a standalone column. Showing it would add visual noise. |
| **Volume / OI absolute values** | Universe filtering (hard fails) | Same — they determine whether a pair is in the universe at all. Once it's in, the absolute numbers don't matter for trading decisions. |
| **Spread / leverage caps** | Universe filtering | Execution quality filters. Not decision-relevant on the board. |
| **Handshake status** | Potentially future trigger enhancement | V2 bot uses handshake as entry confirmation. For the manual board, this could enhance the trigger column in Phase 2. But it requires real-time BTC/ETH momentum computation — don't build until the base board is proven. |

### NOT USEFUL — Don't build, don't display

| Data Point | Why Not |
|-----------|---------|
| **Liquidation cluster proximity** | Only ~3 weeks of data. All thresholds provisional. Cannot be backtested (no historical data). "Research-first, minimum 8-12 weeks" — per the liquidation intelligence docs. Revisit Q2 2026 at earliest. |
| **Funding rate as hard gate** | Explicitly proven to hurt returns. Decision locked: observe, don't act, for 20+ weeks minimum. |
| **OI as hard gate** | Same as funding. The V2 decision doc is unambiguous: "OI/Funding as hard gates HURT performance." |
| **Katarakti-style entry (dwell + close-loc)** | V3 research Test 12 proved Katarakti Lite does NOT work for crypto. Different market microstructure. |
| **Multi-timeframe sentiment** | No reliable crypto sentiment feed equivalent to FX retail sentiment. Social sentiment (CT, Discord) is noise at the timeframes Freedom trades. |

---

## 6. Missing Backtests Before Implementation

These are the gaps in the research that should be filled before the board goes live. Ordered by priority.

### P0 — Must Have Before Build

| Test | What It Proves | Estimated Effort |
|------|---------------|-----------------|
| **Stoch+RSI on crypto timeframes** | Does the same indicator (21,13,3,3) produce valid oversold/overbought signals on BTC/alts on 4H/1H/15M? The FX backtest validated it for FX pairs — crypto price action is different (more volatile, more gaps). | 1-2 days. Run `validate-stoch-rsi.ts` on BTCUSD, SOLUSD, XRPUSD. Compare against TradingView. |
| **4H swing fractal on crypto** | Do 2L/2R fractals produce meaningful swing targets on crypto 4H charts? Crypto trends are more momentum-driven — swings may be less frequent or less reliable. | 1 day. Run fractal detection on 8 weeks of BTC/SOL/XRP 4H data. Measure target distance distribution and hit rate. |
| **Regime diversity test** | ALL existing crypto backtests ran during SHORT/HIGH bias weeks (bearish trend, high conviction). Zero data on LONG or NEUTRAL regimes. The edge might only exist in one regime. | 2-3 weeks (need to wait for market to provide different regimes, or find historical data from a LONG period). This is the biggest unknown. |

### P1 — Should Have Before Scaling

| Test | What It Proves | Estimated Effort |
|------|---------------|-----------------|
| **Alt ranking vs actual trade performance** | The composite scoring formula (35% corr, 25% vol...) was designed heuristically. Do higher-ranked alts actually produce better trade outcomes? Correlation is proven (>0.75 outperforms), but the rest of the score is unvalidated. | 1 week. Run V3 alt universe backtest segmented by composite rank decile. Compare WR/PF across rank tiers. |
| **BTC direction accuracy** | How often does the 3-vote multi-timeframe bias (from `bitgetBotSignals.ts`) correctly predict the next 1-week BTC direction? If it's only 55% accurate, the entire board's direction layer is shaky. | 3-4 days. Backtest the bias vote model against 6+ months of BTC weekly moves. |
| **Session-grouped crypto signals** | The FX backtest showed PAIR_SESSION > PAIR for concurrency. Does the same hold for crypto? Crypto is 24/7 so "session" is artificial — maybe PAIR is actually better here. | 2-3 days. If we build the crypto backtest, include both concurrency modes. |

### P2 — Nice to Have, Can Wait

| Test | What It Proves | Estimated Effort |
|------|---------------|-----------------|
| **Handshake as trigger enhancement** | Does requiring BTC/ETH momentum alignment (handshake) before entry improve the manual trigger WR? V2 bot uses it, but for scalp entries not swing entries. | 1 week. Add handshake check to trigger cascade and backtest. |
| **Liquidation cluster as sizing input** | Once we have 8-12 weeks of liquidation data, does proximity to large clusters predict move size? Could inform position sizing (bigger when cluster is nearby in trade direction). | 2-3 weeks of additional data collection + 1 week backtest. |
| **OI/funding as regime classifier** | Instead of gating (proven harmful), can OI/funding regimes classify the market into high-edge vs low-edge environments? e.g., "when funding is extreme, WR drops 10%" — useful for sizing, not gating. | 1 week. Need to correlate OI/funding states with trade outcomes across 20+ weeks of data. Not possible yet. |

---

## 7. Build-Now vs Phase-2

### Phase 1: Build Now (Minimum Viable Board)

**Goal:** A board Freedom can look at Sunday night and Monday morning to plan the week's crypto trades.

| Component | Description | Dependencies |
|-----------|-------------|-------------|
| **BTC/ETH regime header** | Weekly bias using 3-vote model (4H trend × 3 timeframes). Display: LONG/SHORT/NEUTRAL with confidence (HIGH/MEDIUM). | Adapt existing `bitgetBotSignals.ts` bias logic to daily/4H timeframes. |
| **Alt universe table** | 12-15 ranked alts. Rank, symbol, direction, composite score. Refreshed weekly. | Run existing `alt-pair-rankings` script. Store in DB. |
| **Direction column** | BTC-led + correlation alignment + alt 4H structure check. LONG/SHORT/NEUTRAL per alt. | BTC regime + correlation data (already computed weekly) + 4H trend check. |
| **Trigger column (static)** | Current Stoch+RSI state per alt on 4H and 1H. IDLE/OVERSOLD/OVERBOUGHT. Updated hourly. | Port `validate-stoch-rsi.ts` indicator to production. Fetch from OANDA (crypto instruments). **Requires P0 validation first.** |
| **4H swing target** | Nearest confirmed swing distance (%). | Port `buildConfirmedH4Swings` from backtest to production. **Requires P0 validation first.** |
| **Context glyphs** | OI delta (↑/↓/—), funding (+/−/~). Small, non-intrusive. | Already collected by bot infrastructure. Just display. |

**Estimated build time:** 1-2 weeks after P0 validations pass.

**What Phase 1 explicitly does NOT include:**
- Live scanner / real-time notifications (that's the Session Trigger Scanner, separate project)
- Handshake confirmation
- Liquidation data
- Engulfing candle detection
- Position sizing recommendations
- Bot integration (manual board is separate from V2/V3 bot)

### Phase 2: After 4+ Weeks of Forward Testing

| Component | Trigger to Build | Description |
|-----------|-----------------|-------------|
| **Live trigger scanner** | Phase 1 board proves directionally useful | Real-time 5-minute scanner with Telegram alerts. Same architecture as FX `SESSION_TRIGGER_SCANNER_SPEC.md`. |
| **Engulfing confirmation** | Scanner is live | Add engulfing candle detection to trigger cascade. WATCHING → TRIGGERED on engulfing close. |
| **Handshake enhancement** | P2 backtest shows WR improvement | Add BTC/ETH momentum alignment check before firing trigger. |
| **Position sizing column** | FX position sizing research complete | ATR-based dynamic sizing. Smaller for high-ATR alts, larger for stable ones. |
| **Liquidation context** | 8-12 weeks of data collected | Display proximity to major liquidation clusters as additional context glyph. |
| **Historical signal log** | Scanner running 2+ weeks | Append triggered signals to a journal. Track outcomes. |

### Phase 3: Convergence (Q3 2026+)

| Component | Description |
|-----------|-------------|
| **Unified FX + Crypto matrix** | Single board view with both FX and crypto instruments, shared trigger scanner, unified position sizing. |
| **Bot-to-board signal sharing** | V2/V3 bot signals surface on the manual board as "bot agrees" context. Not a gate — just another data point. |
| **Regime-adaptive parameters** | If LONG regime behaves differently from SHORT (likely), adjust indicator settings or trigger cascade per regime. Needs 6+ months of multi-regime data. |

---

## Appendix A: Key Research Findings That Shaped This Design

| Finding | Source | Design Impact |
|---------|--------|---------------|
| Exit engine IS the edge | V3 research Test 6 | Don't over-engineer entries. The trigger just needs to get you in near the right level. Exit management (swing target, week-close fallback) does the heavy lifting. |
| OI/funding gates destroy returns | V2 strategy decisions | Classify as CONTEXTUAL, never CORE. No gating. |
| High-corr alts outperform | V3 alt universe backtest | Correlation > 0.75 is the strongest alt filter. Bake into universe + direction logic. |
| V3 (N=30) nearly matches V2 | V3 research session | Simple sustained deviation works. Complexity for complexity's sake doesn't help. Keep the manual board simple. |
| Handshake works for crypto, not FX | V3 Test 13 | Handshake is crypto-specific. Consider for Phase 2 trigger enhancement but NOT for direction. |
| All backtests are SHORT/HIGH only | Every crypto backtest | Biggest risk. The board might work great in bearish trends and fail in bull markets. Forward test across regime changes before scaling. |
| Katarakti doesn't work for crypto | V3 Test 12 | Don't port FX mean-reversion entries to crypto. Use momentum-based triggers (Stoch+RSI oversold in trend direction). |
| Alt ranking formula is unvalidated | alt-pair-rankings.md | The scoring weights are heuristic. P1 backtest needed to confirm higher rank = better outcomes. |

---

## Appendix B: FX Flagship vs Crypto Board Comparison

| Dimension | FX Flagship (Orion) | Crypto Board |
|-----------|-------------------|--------------|
| Universe size | 36 instruments (fixed) | 14-17 instruments (dynamic, weekly refresh) |
| Direction sources | COT Dealer + COT Commercial + Sentiment (3 independent) | BTC Regime + Correlation + Alt Structure (BTC-led hierarchy) |
| Direction model | Majority vote (2/3 = PASS) | BTC-led cascade (regime → correlation → structure) |
| Trigger indicator | Stoch+RSI (21,13,3,3) | Same — pending crypto validation |
| Session filtering | Asia/London/NY (different pairs per session) | All pairs all sessions (Freedom's schedule determines monitoring windows) |
| Exit model | 4H swing target, no stop, week-close fallback | Same — pending crypto validation |
| Concurrency | PAIR_SESSION (1 trade per pair per session) | TBD — test PAIR vs PAIR_SESSION for crypto |
| Data advantage | COT (weekly, unique), sentiment (daily) | Correlation (computed), OI/funding (real-time but proven non-predictive as gates) |
| Maturity | 8-week backtest complete, forward testing ready | Design phase, P0 validations pending |

---

*"The board is a lens, not a cage. It focuses attention on what matters and ignores what doesn't. The moment it tries to make the decision FOR you, it becomes a liability."*
