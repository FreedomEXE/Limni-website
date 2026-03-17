# Flagship Manual Trading System Handoff

## Objective
- Simplify workflow around one manual trading flow.
- Stop mixing weekly research overlays inside `Performance`.
- Add a dedicated `Flagship` area for current actionable setups and session-aware execution.

## Scope Lock
- Backtest scope stays at `8 weeks` for now.
- Do not expand to 6+ month sentiment-dependent tests yet (sentiment depth is limited).
- Keep this as research + UI architecture for manual forward trading, not automation deployment.

## Product Changes Requested

### 1) Navigation Update
- Current nav: `L(Data) I(Performance) M(Automation) N(Accounts) I(Status)`.
- New nav: `L(Data) I(Performance) M(Automation) N(Accounts) I(Flagship)`.
- Move `Status` to a lower-level independent page (below News section / secondary nav).

### 2) Performance Section Cleanup
- Remove gated setup presentation from `Performance`.
- `Performance` should remain system analytics/history, not live manual decision workflow.
- Keep metrics consistent across Universal/Tiered variants (aggregation and drawdown methodology must be consistent).

### 3) New Flagship Section
- Purpose: show the current week’s tradable gated universe for manual execution.
- Surface only actionable outcomes for trader:
  - `PASS`
  - `SKIP`
- `REDUCE` should be removed for this workflow (simpler execution and margin management).
- For each setup show:
  - Pair
  - Direction
  - Asset class
  - Gate decision
  - Gate reason codes
  - Session eligibility
  - Timestamp/freshness

## Strategy Selection Question (Needs Explicit Resolution)
- Decide one flagship baseline for forward trading:
  - `Universal v1 gated`
  - `Universal v2 gated`
  - `Universal v3 gated`
  - or a Tiered variant
- Current UI behavior suggests gated tabs may not be differentiating as expected; this must be validated before final selection.

## Backtest Requirement (Corrected)

### What was wrong
- Prior test labeled “daily top pick” was weekly-anchor selection, not true session-level selection.

### What is needed now
- Backtest by **session** (Asia/London/New York), not just week-open.
- Weekly bias + weekly gate defines eligible universe.
- Session layer selects best candidate(s) among weekly PASS trades for that session.
- Track “if we only took the best setup for each session/day” performance.

### Minimum output metrics
- Sessions tested
- Trade sessions vs no-trade sessions
- Win sessions / loss sessions / flat
- Win rate
- Avg PnL per session
- Cumulative PnL
- Max drawdown
- Concurrent open trades (margin load proxy)

## Immediate Functional Example
- During Asia session, if only one pair qualifies (example: Nikkei short), Flagship should show only that as actionable.
- This is the intended behavior: fewer trades, higher clarity, capital concentration.

## Gate Model Direction

### Current
- COT percentile gate used as structural weekly filter.
- Crypto liquidation gate currently mostly week-open in historical test context.

### Desired
- Keep weekly COT gate as primary structural filter.
- Add dynamic overlays where available:
  - Crypto: liquidation (intraweek refresh)
  - Non-crypto (where available): GEX-style overlay inputs
- Output still simplified to PASS/SKIP for trader.

## MenthorQ Context (Important)
- Trial data access appears to provide futures gamma condition and related panels, but not full forex “levels.”
- Architecture should support symbol mapping and partial coverage.
- Missing overlay data under strict mode should yield no-trade rather than soft-scored entry.

## Open Architecture Questions for Claude
1. Exact session windows and timezone standardization for backtest and live board.
2. Ranking formula for selecting “best” setup per session from PASS universe.
3. Data freshness policy per overlay source (weekly COT vs intraday liquidation/GEX).
4. Strict vs permissive mode behavior for missing overlay data.
5. Whether Flagship should support `Top-1` only or optional `Top-2` with correlation cap.
6. Canonical drawdown/equity methodology to keep Universal and Tiered comparable.

## Deliverables Requested Next
1. Claude-authored spec for `Flagship` page architecture and data contracts.
2. Session-level backtest spec (Top-1 baseline, Top-2 optional).
3. Implementation plan to migrate gated decision UX out of `Performance` into `Flagship`.
4. Validation checklist to confirm per-strategy gated differentiation is functioning.
