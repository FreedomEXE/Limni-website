<!--
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: docs/CRYPTO_OI_FRAMEWORK_HANDOFF_2026-03-23.md
 *
 * Description:
 * Handoff brief for the next OI research pass on the Matrix crypto board.
 * Scope is futures OI first, spot OI later and separate.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
-->

# Crypto OI Framework Handoff

## Objective
Build a more robust crypto OI framework for the Matrix board.

This is not for immediate frontend redesign. This is a research and framework handoff so another agent can:
- recover the prior OI findings
- test a better futures OI model
- define how spot OI should be added later without mixing the two concepts

## Current Board State

The current crypto board uses a simple futures OI threshold only.

Current implementation:
- File: `src/app/api/flagship/crypto-matrix/route.ts`
- Current rule: `oiAgree = openInterest >= 20_000_000`
- This is an absolute futures OI size filter, not an OI behavior model
- It does not currently encode:
  - rising futures OI
  - falling futures OI
  - futures OI trend vs price trend
  - spot OI

Important:
- This current threshold is only acting as a liquidity / tradability floor
- It should not be interpreted as a directional OI framework

## User Direction

What the user wants preserved:
- Futures OI and spot OI are different and should stay separate
- Current board can keep the simple threshold for now
- Longer term, the OI input should reflect actual research

What the user stated:
- backtests suggested increasing futures OI had a negative correlation with price
- that implies rising futures OI may be bearish in this framework
- spot OI may later have the opposite effect, but should be tested separately

## Likely Existing Research Hooks

The most relevant existing script appears to be:
- `scripts/analyze-bitget-v2-double-session-window.ts`

Relevant lines and labels found:
- `OI_PROXY_LOOKBACK_BARS`
- `OI_PROXY_CONFIRM_PCT`
- `OI_PROXY_REJECT_PCT`
- `passesOiFilter(...)`
- `passesOiFilterReverse(...)`
- variants:
  - `F) Handshake + Scaling + Overnight + OI Delta Filter`
  - `G) Handshake + Scaling + Overnight + Funding + OI`
  - `I) Handshake + Scaling + Overnight + OI Reverse`
  - `J) Handshake + Scaling + Overnight + Funding + OI Reverse`

Important caveat:
- that script used an OI proxy from volume expansion because historical OI series was not available in that backtest path at the time
- so the prior finding may be a proxy-OI finding, not a true futures OI series finding

Also relevant:
- `docs/bots/bitget-bot-strategy.md`
  - explicitly mentions future work for OI expansion / contraction filters
- `scripts/alt-pair-screener.ts`
  - currently uses `MIN_OI_USD = 2_000_000` as a universe floor

## Current Data Sources Available

Board path:
- `src/app/api/flagship/crypto-matrix/route.ts`

Current live sources:
- futures OI level from Bitget ticker / DB fallback
- funding from Bitget ticker / DB fallback
- liquidation heatmap context when available

Stored market data tables already referenced in code:
- `market_oi_snapshots`
- `market_funding_snapshots`
- `market_liquidation_snapshots`

What is missing in current board usage:
- non-anchor alt rows do not currently use true OI delta in Gamma
- non-anchor alt rows do not currently use spot OI

## Research Tasks For Next Agent

### 1. Recover the prior OI conclusion
Goal:
- confirm exactly which script / report supported the claim that increasing futures OI was bearish

Deliverables:
- exact script(s)
- exact report artifact(s)
- whether that result came from:
  - true futures OI time series
  - or volume / OI proxy logic

### 2. Test futures OI as behavior, not size
Goal:
- design a futures OI framework that is directional, not just a liquidity threshold

Candidate inputs to test:
- current futures OI level
- 24h futures OI delta %
- futures OI delta aligned against price change
- rising OI + falling price
- rising OI + rising price
- falling OI + rising price
- falling OI + falling price

Questions to answer:
- should OI be used as:
  - confirm
  - conflict
  - regime modifier
  - or only a hard tradeability floor

### 3. Keep spot OI separate
Goal:
- define a future spot OI path without mixing it into futures OI logic

Requirements:
- separate source
- separate signal definition
- separate backtest
- no reuse of futures thresholds by default

### 4. Recommend a board-ready simplification
Goal:
- reduce the research output into one board-safe input

Examples:
- `OI Confirm`
- `OI Conflict`
- `OI Thin`
- or a small 2-state / 3-state framework

The board should not expose raw complexity if the framework is adopted.

## Immediate Non-Research Constraint

For the live board right now:
- keep the current futures OI threshold idea
- do not switch Gamma to OI-delta interpretation until research is confirmed

## Current Threshold Implementation

Current live threshold:
- `20_000_000` USD futures OI

Current universe floor elsewhere:
- `2_000_000` USD futures OI in `scripts/alt-pair-screener.ts`

This mismatch should be reviewed later.

Key question:
- should the board threshold stay at `20M`
- or should threshold vary by tier / market class / contract quality

## Expected Output From Next Agent

The next agent should return:
- the exact prior OI study artifacts
- a clear statement on whether the bearish OI finding is confirmed
- a proposed futures OI framework
- a separate spot OI framework proposal
- a recommendation for how Gamma should consume OI in the crypto matrix
