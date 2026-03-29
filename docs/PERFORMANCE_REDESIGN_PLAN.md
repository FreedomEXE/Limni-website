# Performance Section Redesign Plan

> Written 2026-03-27. Must be reviewed by Freedom before implementation.

---

## What stays (non-negotiable)

- Performance tier cards (Tier 1/2/3 with return, WR, Sharpe, max DD, profit factor, return spread)
- Sidebar flagship breakdown (total return, weekly WR, max DD, trades, trade WR)
- Summary / Simulation / Basket / Research / Notes content tabs
- The overall visual design and polish

## What changes

### 1. Week Switcher → ScrollableWeekStrip

Replace the current `<select>` dropdown with the same `ScrollableWeekStrip` used in the Data section. Same component, same `getDisplayWeekOpenUtc()` logic, same `buildDataWeekOptions()` for available weeks. Friday auto-switch included.

### 2. Strategy Selector (replaces hardcoded "Tiered V3")

Currently the sidebar says "Tiered V3 Net Hold Gated" and there's no way to switch. This becomes a selector:

**Bias Source** (where does direction come from?):
- Dealer (COT dealer positioning)
- Commercial (COT commercial positioning)
- Sentiment (retail crowd contrarian)
- Tiered V3 (dealer + commercial + sentiment voting — legacy)
- 2-of-3 Agreement (any 2 models agree)
- Tandem (all 3 running independently)

**Strategy/Filter** (how are trades entered?):
- Weekly Hold (baseline — enter at week open, exit at week close)
- *(future: ADR Pullback, ADR+Stoch, Grid — added when ready)*

For now, the Strategy selector only has "Weekly Hold." The bias source selector is where the action is. This is extensible — when we build the ADR+Stoch forward test, we add it as a strategy option without touching the rest of the page.

### 3. Sidebar Stats Adapt to Selection

The sidebar currently shows hardcoded "Tiered V3 Net Hold Gated" stats. Instead:
- Title dynamically shows selected bias source + strategy (e.g., "Dealer · Weekly Hold")
- Stats (total return, WR, max DD, etc.) compute from whatever strategy/bias is selected
- When switching bias source, sidebar recalculates

### 4. Tier Cards Adapt to Selection

Currently tiers are Tier 1/2/3 from the tiered V3 voting system. For other bias sources:
- **Dealer/Commercial/Sentiment**: No tiers (single confidence level). Show one card with overall stats instead of 3 tier cards. Or repurpose the 3 cards for asset class breakdown (FX / Commodities+Indices / Crypto).
- **Tiered V3 / 2-of-3 Agreement**: Tier cards make sense (high/medium/low confidence).
- **Tandem**: 3 cards = Dealer portfolio / Commercial portfolio / Sentiment portfolio.

This is the main design decision: **what do the 3 cards represent for each bias source?**

**Proposal**: The 3 cards always represent a meaningful breakdown:

| Bias Source | Card 1 | Card 2 | Card 3 |
|-------------|--------|--------|--------|
| Dealer | FX | Commodities + Indices | Crypto |
| Commercial | FX | Commodities + Indices | Crypto |
| Sentiment | FX | Commodities + Indices | Crypto |
| Tiered V3 | Tier 1 (High) | Tier 2 (Medium) | Tier 3 (Low) |
| 2-of-3 Agreement | FX | Commodities + Indices | Crypto |
| Tandem | Dealer | Commercial | Sentiment |

### 5. Trade Log Tab (replaces "Matrix" sub-tab)

The current "Matrix" tab in Performance shows ADR trades for one specific configuration. This becomes a general "Trade Log" that:
- Shows individual trades for the selected strategy + bias source + week
- Entry price, exit price, direction, P&L — all verifiable against TradingView
- For weekly hold: one trade per pair per week (open → close)
- For future ADR strategies: intraday entries with exact timestamps

### 6. Data Source

All performance data comes from `pair_period_returns` (canonical prices, verified against TradingView) for weekly hold returns. For future ADR strategies, data comes from `strategy_backtest_trades` or a new forward-test trades table.

The COT bias per pair comes from `cot_snapshots` (same as Data section). Sentiment comes from `sentiment_aggregates` (same as Data section). No separate data pipeline — everything reads from the same source of truth.

### 7. Legacy

Legacy strategies (old comparison data) remain queryable but aren't a top-level tab. They could be an option in the Strategy selector dropdown: "Legacy: Blended Hold", "Legacy: ADR Static", etc. Or they live under "Research" tab as historical reference.

---

## UI Layout (unchanged structure, new content)

```
┌─────────────────────────────────────────────────────┐
│  PERFORMANCE                                         │
│  [Flagship] [Trade Log] [Legacy]     ← top tabs      │
├──────────┬──────────────────────────────────────────┤
│ SIDEBAR  │  [ScrollableWeekStrip]     ← shared       │
│          │                                           │
│ Strategy │  Bias: [Dealer|Comm|Sent|V3|2of3|Tandem]  │
│ selector │  Strategy: [Weekly Hold | ...]            │
│          │                                           │
│ Headline │  [Summary|Simulation|Basket|Research|Notes]│
│ stats    │                                           │
│          │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ Total    │  │ Card 1  │ │ Card 2  │ │ Card 3  │    │
│ return   │  │ +X.XX%  │ │ +X.XX%  │ │ -X.XX%  │    │
│ WR, DD   │  │ stats   │ │ stats   │ │ stats   │    │
│ etc      │  └─────────┘ └─────────┘ └─────────┘    │
│          │                                           │
└──────────┴──────────────────────────────────────────┘
```

## Implementation Order

1. Replace week selector with ScrollableWeekStrip
2. Add bias source selector (pills or dropdown)
3. Wire bias source to existing card/stats computation
4. Adapt tier cards to show appropriate breakdown per bias source
5. Rename "Matrix" tab to "Trade Log"
6. Verify all data comes from canonical price source
7. Polish and test

---

## Design Decisions (confirmed by Freedom 2026-03-27)

1. **Two-layer selector model**:
   - **Layer 1: Bias Source** — Dealer | Commercial | Sentiment | Tiered V3 | 2-of-3 | Tandem
   - **Layer 2: Filters** — Baseline (weekly hold) | ADR Pullback | Stochastic | ADR+Stoch | (future: MA, grid, etc.)
   - Filters layer independently on top of any bias source
   - Both selectors live in the sidebar

2. **Card behavior adapts to bias source**:
   - Single source (Dealer/Commercial/Sentiment): cards = asset class breakdown (FX / Commodities+Indices / Crypto)
   - Combo source (Tiered V3, 2-of-3): cards = confidence tiers (Tier 1/2/3)
   - Tandem: cards = one per model (Dealer / Commercial / Sentiment portfolios)
   - Asset class filter pills (ALL/FX/INDICES/COMMODITIES/CRYPTO) appear on all modes

3. **Sidebar**: strategy selectors at top, aggregate stats below (adapts to current selection)

4. **Sidebar stats match page content**: if looking at Commercial-only, sidebar total = sum of the Commercial card. If looking at tiered, sidebar = sum across tiers.

5. **Filters are additive**: you can view any bias source with no filter (baseline weekly hold), or layer on ADR, stoch, ADR+stoch, etc. Each filter shows its impact on the selected bias source.

6. **All data from canonical sources**: pair_period_returns for weekly hold returns, strategy_backtest_trades for ADR trades, cot_snapshots for COT bias, sentiment_aggregates for sentiment. Same source of truth as Data section.

7. **ZERO new crons or data pipelines**: Performance is a READ-ONLY view on existing tables. No separate refresh logic. If the Data section's crons update prices/bias/sentiment, Performance sees it immediately. One source of truth, zero drift.

8. **Future-proof by design**: Adding a new bias source = adding an entry to the bias source config array. Adding a new filter = adding an entry to the filter config array. No page rewrites, no new routes, no new crons. The selectors and card rendering are driven by config, not hardcoded branches.

9. **Week logic**: Same `getDisplayWeekOpenUtc()` + `buildDataWeekOptions()` + `ScrollableWeekStrip` as the Data section. Current week shows zero trades for all strategies. Previous week shows crypto trades still open until Sunday 8pm ET. Exact same behavior everywhere.
