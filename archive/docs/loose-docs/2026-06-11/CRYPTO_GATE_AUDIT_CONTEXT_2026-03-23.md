# Crypto Gate Audit Context

Date: 2026-03-23

## Why this note exists

This note saves the current state of the crypto gate audit before additional user context is provided.

## Current confirmed findings

- The 9-week canonical weekly flagship sample for `tiered_v3_gated` includes BTC and ETH.
- In that 9-week sample:
  - `BTCUSD` trades: `6`
  - `ETHUSD` trades: `6`
  - total crypto trades: `12`
  - total flagship trades: `104`
- Crypto contributed `242.752428%` of the total `263.181732%` simple return.
- Crypto therefore contributed about `92.24%` of total flagship return.

## Important methodology issue

- The historical flagship result was not driven by crypto `PASS` gate decisions.
- For the first 6 weeks in the 9-week sample, BTC and ETH were admitted under `NO_DATA`.
- In the canonical gated reconstruction, `NO_DATA` is treated as full size.
- That means the historical flagship result labeled as gated is materially dependent on crypto trades being allowed through because the gate had no data.

## What happened in the last 3 weeks

- The base `tiered_v3` model still selected BTC and ETH in all 9 weeks.
- BTC and ETH disappeared from the gated flagship in the last 3 weeks because of the crypto gate, not because the base model stopped selecting them.
- For BTC and ETH:
  - week of `2026-03-02`: `SKIP`
  - week of `2026-03-08T23:00:00Z` / mapped artifact week `2026-03-09`: `SKIP`
  - week of `2026-03-15T23:00:00Z` / mapped artifact week `2026-03-16`: `REDUCE`
- Since flagship uses `reduce_as_skip`, that final `REDUCE` week was also removed from the basket.

## Crypto liquidation gate plain-English summary

The BTC/ETH liquidation gate checks liquidation heatmap structure at the start of the trading week across:

- `6h`
- `1d`
- `7d`
- `30d`

It tries to determine whether there is too much opposing liquidation pressure near price for the planned weekly bias trade.

Decision behavior:

- `SKIP`
  - multiple timeframes suggest opposing dominance
  - or opposing liquidation structure is too close and too threatening
  - or both `1d` and `7d` fuel/risk ratios are weak
- `REDUCE`
  - opposing pressure is present but not severe enough to skip
  - near opposing cluster
  - or near-field opposing liquidation density is high
  - or one or more ratios fall into a caution band
- `PASS`
  - those warning conditions are absent
- `NO_DATA`
  - no usable liquidation heatmap data was available at the gate evaluation point

## Results from honesty variants already tested

### Current canonical behavior

- crypto gate source: liquidation
- `NO_DATA = full size`
- result:
  - return: `263.181732%`
  - max DD: `1.551656%`

### Strict current crypto handling

- crypto gate source: liquidation
- `NO_DATA = skip`
- result:
  - return: `20.429304%`
  - max DD: `6.884868%`

Interpretation:

- if crypto `NO_DATA` is treated honestly as not tradable, the flagship result collapses.

### Crypto using same COT-style gate as other assets

- crypto gate source: COT percentile, base-market only
- result:
  - return: `181.301382%`
  - max DD: `69.931219%`

Interpretation:

- crypto can technically be run through the same COT-style gate
- but it does not behave like a safe replacement for the liquidation gate
- it allowed through a very large losing crypto week and dramatically worsened drawdown

## User questions that still need answers

The user wants these answered next:

1. How would the liquidation gate have behaved in the first 6 weeks if usable historical liquidation data had actually been available?
2. Is there any way to recover or reconstruct liquidation data for the past 9 weeks, even if it was not stored locally?
3. Since the liquidation gate is dynamic and can be re-evaluated during the week, can we test the past 3 weeks on a daily or hourly re-check basis to see whether BTC/ETH would have become tradable later in the week?
4. Is the crypto gate genuinely useful, or is it just removing trades after the fact in a way that looks good?

## User thoughts/preferences to preserve

- If the crypto skip logic has a real, logical basis and is not curve fitting, the user is open to it.
- If not, this is a serious issue because crypto is responsible for more than `220%` of the total gains.
- The user also believes crypto should probably not be sized as aggressively as other assets even if all data agrees, but that is a separate issue from the gate honesty problem.
- Before any further implementation, the user wanted this context saved.

## Recommended next audit steps

1. Investigate whether historical liquidation data can be recovered externally or reconstructed from any remaining vendor/API path.
2. Prototype a daily/hourly intraweek crypto gate replay for the last 3 weeks to see whether skipped crypto names would have become valid later.
3. Produce a decision memo comparing:
   - liquidation gate with `NO_DATA = allow`
   - liquidation gate with `NO_DATA = skip`
   - liquidation gate with intraweek re-evaluation
   - crypto excluded from flagship
