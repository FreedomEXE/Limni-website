# Bitget Bot v2 — Strategy Decisions & Research Log

> **Owner:** Freedom_EXE
> **Last updated:** 2026-02-26
> **Status:** Phase 1 DRY_RUN built. Phase 2 (live + enhancements) pending.

This document captures every design decision, test result, rejected idea, and future research direction for the Bitget perp bot v2. If context is ever lost, this is the source of truth.

---

## 1. Core Philosophy

The Bitget bot v2 is built on a layered conviction model:

1. **Weekly macro bias** tells us WHICH direction to trade (COT + sentiment)
2. **Intraday session structure** tells us WHEN to trade (institutional session ranges)
3. **Price action confirmation** tells us WHERE to enter (sweep + rejection + displacement)
4. **Correlated asset agreement** tells us IF the move is real (handshake)
5. **Aggressive scaling into winners** tells us HOW to maximize (milestone leverage)

The system only trades when all layers align. This produces few trades (3-7/week in backtest) but with extreme precision and asymmetric risk/reward.

---

## 2. Strategy Selection — Why Variant C

We backtested 12 strategy variants over 5 weeks. Full results in `docs/bots/bitget-v2-backtest-results.md`.

### Variant Comparison Summary

| Variant | Return | Win Rate | Max DD | Trades | Decision |
|---------|--------|----------|--------|--------|----------|
| A) Handshake + Current Risk | 123.74% | 62.50% | 23.86% | 16 | Rejected: high drawdown |
| B) Independent + Scaling | 22.18% | 70.00% | 33.63% | 20 | Rejected: poor R, high DD |
| **C) Handshake + Scaling + Overnight** | **112.54%** | **87.50%** | **6.19%** | **16** | **SELECTED: best risk-adjusted** |
| D) v3 Baseline | 182.25% | 50.00% | 45.96% | 30 | Rejected: coin-flip WR, 46% DD |
| E) + Funding Filter | 64.83% | 91.67% | 6.19% | 12 | Rejected: filters out winners |
| F) + OI Delta Filter | 64.83% | 91.67% | 6.19% | 12 | Rejected: same issue as E |
| G) + Funding + OI | 64.83% | 91.67% | 6.19% | 12 | Rejected: no additive value |
| H) + Funding Reverse | 52.79% | 83.33% | 0.00% | 6 | Interesting but too few trades |
| I) + OI Reverse | 0.00% | N/A | N/A | 0 | Rejected: killed all trades |
| J) + Funding + OI Reverse | 0.00% | N/A | N/A | 0 | Rejected: killed all trades |
| K) 3-Way Handshake + Alts | 114.02% | 82.86% | 8.70% | 35 | Phase 2 candidate |

### Why Variant C Won

- Best risk-adjusted performance: 112% return with only 6.19% max drawdown
- 87.50% win rate = high conviction entries
- Handshake requirement filters noise without over-filtering
- Scaling leverage amplifies winners without increasing initial risk
- Overnight hold captures the full move (vs EOD close which exits too early)

---

## 3. OI & Funding Rate Decisions

### Tested as Hard Entry Gates (Variants E-J)

**Finding:** Using OI and funding as hard entry gates consistently HURT performance.

- Variants E/F/G filtered out 4 winning trades, dropping returns from 112% to 64%
- The filtered trades were winners — the signals correctly identified entries that OI/funding would have blocked
- Higher win rate (91.67% vs 87.50%) but much less profit — classic over-filtering

### Reverse Logic Tests (Variants H/I/J)

**Finding:** Flipping the funding logic produced a zero-drawdown result, but on only 6 trades.

- Variant H (funding reverse): 52.79% return, 0% max DD, 6 trades — intriguing but statistically insignificant
- Variant I (OI reverse): 0 trades — eliminated all opportunities
- Variant J (both reversed): 0 trades — same

### Decision: Observe, Don't Act

**OI, funding rates, and liquidation levels are NOT used for entry/exit decisions.**

Instead:
1. **Collect hourly snapshots** via `market-snapshots` cron (funding, OI, liquidation clusters)
2. **Tag every trade** with the OI/funding/liq state at time of entry and exit
3. **Display on the website** so Freedom can visually correlate patterns
4. **Accumulate data** over real trading weeks before building rules
5. **Re-evaluate after 20+ weeks** of live/paper data to see if patterns emerge

The relationship between these signals and strategy performance is not yet understood. Acting on insufficient data would be premature optimization.

---

## 4. Liquidation Levels — Dynamic Scaling Targets (Proposed, Not Yet Implemented)

### Current System: Fixed Percentage Milestones

| Unlevered Move | Leverage | Stop Action |
|----------------|----------|-------------|
| Entry | 5x | 10% initial stop |
| +1.0% | 10x | Keep stop |
| +2.0% | 25x | Move to breakeven |
| +3.0% | 50x | Activate trailing (1.5% offset) |
| +4.0% | 50x | Tighten trailing (1.0% offset) |

### Proposed: Liquidation Cluster-Based Milestones

Instead of fixed 1%/2%/3%/4% targets, use the nearest/largest liquidation cluster in our trade direction as the target, then divide by the number of scaling steps (e.g., 4 unwinds) to create dynamic milestone levels.

**Example:**
- Entry LONG at $95,000
- Nearest large liquidation cluster above: $98,000 (3.16% away)
- Divide by 4 unwinds: milestone spacing = 0.79%
- Dynamic milestones: +0.79%, +1.58%, +2.37%, +3.16%

**Rationale:** Liquidation clusters are where forced buying/selling creates momentum. Price is magnetically drawn to these levels. Using them as targets aligns our scaling with where the market is actually going to move, rather than arbitrary fixed percentages.

**Fallback:** If no significant liquidation clusters are nearby (or data unavailable), fall back to the default fixed milestone system.

**Status:** Cannot be backtested (no historical liquidation data). Must be validated via live paper trading in Phase 2. Infrastructure for collecting liquidation data is built (`market_liquidation_snapshots` table, CoinAnk integration via `src/lib/coinank.ts`).

**Open Questions:**
- Is 4 unwinds the right number, or should it vary by cluster size/distance?
- Should the cluster size (notional value) affect which cluster we target?
- How frequently should we recalculate targets if new clusters form during a trade?

---

## 5. 3-Way Handshake & Alt Expansion (Variant K — Phase 2)

### How It Works

1. **Core handshake fires** — BTC + ETH both produce sweep/rejection/displacement signals within 60 minutes
2. **Alt gate opens** — once BTC+ETH handshake confirms, the system checks screened alts
3. **Alt must signal within 60 minutes** of the ETH confirmation timestamp
4. **Alt selection** via `scripts/alt-pair-screener.ts`:
   - Minimum 0.50 Pearson correlation with BTC over 7 days
   - Scored on: BTC correlation, daily volume, volatility, OI, spread, max leverage, funding rate
   - Ranked into tiers with weighted composite scores
5. **Allocation:** 10% per alt position, max 3 alt positions alongside BTC+ETH

### Backtest Results

- Variant K: 114.02% return, 82.86% WR, 8.70% max DD, 35 trades
- Comparable return to Variant C but with 2.2x the trade count
- Slightly worse drawdown and win rate — expected with alt noise
- Good expansion candidate once core system is validated live

### Alt Screener Criteria (from `alt-pair-screener.ts`)

| Metric | Minimum | Weight in Score |
|--------|---------|----------------|
| BTC Correlation (7d) | 0.50 | 0.35 |
| Avg Daily Volume (USD) | Varies | 0.25 |
| Daily Volatility (%) | Varies | 0.15 |
| Open Interest (USD) | Varies | 0.10 |
| Spread (%) | Varies | 0.10 |
| Max Leverage | Varies | 0.03 |
| Funding Rate | Varies | 0.02 |

### Orion Tools Reference

The screener design was partially inspired by Orion Tools' correlation-based alt ranking. We evaluated Orion and decided to build our own using existing Bitget + CoinAnk APIs rather than adding a dependency. Key takeaway adopted: BTC correlation is the primary ranking factor for which alts will participate in the same directional move.

### Status

Alt expansion is stubbed in the live bot (`loadAltSymbols()` returns `["BTCUSDT", "ETHUSDT"]`). Full implementation is Phase 2 after core Variant C is validated.

---

## 6. Implementation Status

### Phase 1: DRY_RUN (COMPLETE)

| Deliverable | File | Status |
|-------------|------|--------|
| Migration | `migrations/008_bitget_bot_tables.sql` | Done |
| Signal detection | `src/lib/bitgetBotSignals.ts` | Done |
| Risk/scaling | `src/lib/bitgetBotRisk.ts` | Done |
| Order execution | `src/lib/bitgetBotOrders.ts` | Done |
| State machine engine | `src/lib/bitgetBotEngine.ts` | Done |
| Cron endpoint | `src/app/api/cron/bitget-bot/route.ts` | Done |

**Runtime validated:** `tick()` runs in DRY_RUN mode successfully.

### Known Issues for Phase 2

1. **Completed (2026-02-26): Exchange-side stop loss** — live-mode `setStopLoss` now places Bitget server-side stop-loss trigger orders via position TPSL endpoint.
2. **Completed (2026-02-26): Trailing stop exit reason** — engine now writes `TRAILING_STOP` when a trailing-active stop is hit.
3. **Completed (2026-02-26): Trade metadata tagging** — entry trades now include funding/OI plus liquidation context in `bitget_bot_trades.metadata`.
4. **Completed (2026-02-26): `handshake_group_id` wiring** — confirmed handshakes now update both BTC/ETH signal rows with shared group ID.
5. **Open: Leverage cap at 50x** — backtest tested up to 75x. Keep 50x for paper/live safety until sufficient live validation.

### Phase 2: Live Trading (PLANNED)

- Apply migrations (007 + 008)
- Implement exchange-side stop loss via Bitget trigger orders
- Tag trades with OI/funding/liquidation snapshots at entry
- Wire `handshake_group_id` for signal correlation
- Add `TRAILING_STOP` exit reason
- Build market data collection into the tick cycle
- Validate DRY_RUN results match expected behavior over 2-4 weeks
- Then: `BITGET_BOT_DRY_RUN=false` with small capital

### Phase 3: Alt Expansion + UI

- Implement full alt-pair-screener integration in live bot
- Build UI for bots section: live state, trade history, signal log, range visualization
- Display OI/funding/liquidation data alongside trades in accounts section
- Alt screener rankings display
- Performance attribution dashboard

### Phase 4: Liquidation-Based Dynamic Milestones

- Wire liquidation cluster data into risk module
- Replace fixed milestones with dynamic cluster-derived targets
- Implement fallback to fixed milestones when liq data unavailable
- Requires minimum 4 weeks of collected liquidation data before activation

---

## 7. Architecture Reference

- **Full architecture spec:** `docs/bots/bitget-bot-architecture.md`
- **Strategy detail:** `docs/bots/bitget-bot-strategy.md`
- **Liquidation intelligence implementation plan:** `docs/bots/bitget-liquidation-intelligence-implementation.md`
- **Liquidation intelligence execution checklist:** `docs/bots/bitget-liquidation-intelligence-checklist.md`
- **Backtest results:** `docs/bots/bitget-v2-backtest-results.md`
- **Backtest script:** `scripts/bitget-v2-backtest.ts`
- **Alt screener:** `scripts/alt-pair-screener.ts`
- **v1 bot (fallback):** `bots/bitget-perp-bot.ts`

---

## 8. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02 | Selected Variant C as production strategy | Best risk-adjusted: 112% return, 6.19% DD, 87.5% WR |
| 2026-02 | Rejected OI/funding as hard entry gates | Filtered winners, dropped return from 112% to 64% |
| 2026-02 | Keep OI/funding/liq as passive data collection | Relationship to strategy unclear; observe before acting |
| 2026-02 | Proposed liquidation clusters for dynamic milestones | Aligns scaling with market structure; can't backtest, needs live testing |
| 2026-02 | Adopted BTC correlation as primary alt ranking metric | Inspired by Orion Tools; built with own APIs (Bitget + CoinAnk) |
| 2026-02 | Capped leverage at 50x for Phase 1 | Match existing `setBitgetLeverage` helper; evaluate 75x after validation |
| 2026-02 | Build DRY_RUN first, live second | Validate live logic matches backtest before risking capital |
| 2026-02 | Variant K (3-way handshake + alts) deferred to Phase 2 | Core system must be proven first; alt expansion adds complexity |
| 2026-02 | Reverse funding logic (Variant H) flagged for monitoring | 0% DD on 6 trades is intriguing but sample too small |
