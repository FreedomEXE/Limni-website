# Crypto OI Research Memo

Date: 2026-03-23

## Bottom Line

The repo does not currently contain a prior study that cleanly proves "increasing futures OI is bearish" from a true futures OI time series.

What it does contain is:

- a proxy-era OI experiment in [`scripts/bitget-v2-backtest.ts`](../scripts/bitget-v2-backtest.ts) and [`scripts/analyze-bitget-v2-double-session-window.ts`](../scripts/analyze-bitget-v2-double-session-window.ts)
- a generated results artifact in [`docs/bots/bitget-v2-backtest-results.md`](./bots/bitget-v2-backtest-results.md)
- an interpretation log in [`docs/bots/bitget-v2-strategy-decisions.md`](./bots/bitget-v2-strategy-decisions.md)

Those artifacts show that OI gating hurt the V2 system, but they do not confirm a robust bearish futures OI rule. They also explicitly state that the tested OI input was a volume-expansion proxy, not true historical futures OI.

Conclusion:

- prior bearish-OI claim: partially supported at best
- support type: weak proxy evidence only
- true futures OI confirmation: not found in prior backtest artifacts

## Exact Prior Artifacts Recovered

### 1. Primary historical OI test script

[`scripts/bitget-v2-backtest.ts`](../scripts/bitget-v2-backtest.ts)

- Lines 963-978: explicitly states Bitget had no historical OI series in that backtest path and defines the proxy as `((quoteVolume last 4h - prior 4h) / prior 4h) * 100`
- Lines 995-1005: `passesOiFilter(...)` accepts strong positive proxy OI and rejects strong negative proxy OI; `passesOiFilterReverse(...)` does the opposite
- Lines 3871-3874: generated recommendation text says the OI delta filter did not improve returns in sample

This is the clearest provenance for the original OI experiments.

### 2. Sister script preserving the same OI logic

[`scripts/analyze-bitget-v2-double-session-window.ts`](../scripts/analyze-bitget-v2-double-session-window.ts)

- Lines 523-526: same proxy thresholds (`+2%` confirm, `-2%` reject)
- Lines 566-603: same OI variants F/G/I/J
- Lines 963-1005: same explicit statement that the OI series is a volume proxy, not true OI
- Lines 4285-4294: same recommendation pattern; OI and OI-reverse do not beat the baseline

This file is relevant because it preserves the same OI research logic, but it looks like an extended analysis harness rather than the cleanest original provenance.

### 3. Main generated report artifact

[`docs/bots/bitget-v2-backtest-results.md`](./bots/bitget-v2-backtest-results.md)

- Lines 433-442: strategy comparison table
  - C baseline: `102.75%`
  - F OI delta filter: `54.12%`
  - G funding + OI: `51.05%`
  - I OI reverse: `13.00%`
  - J funding + OI reverse: `13.00%`
- Line 644: "OI delta method: Volume-expansion proxy..."
- Lines 661-674: F filtered out 8 baseline trades, including 7 winners and 0 losers
- Lines 678-680 onward: combined funding + OI also removed winners
- Lines 706-716: OI reverse / funding+OI reverse removed 20 trades, including 16 winners and 2 losers
- Lines 740-746: report recommendation says OI delta filter and OI reverse filter did not improve returns

This report is the strongest exact artifact for the "OI hurt returns as a hard gate" conclusion.

### 4. Decision log that interpreted the report

[`docs/bots/bitget-v2-strategy-decisions.md`](./bots/bitget-v2-strategy-decisions.md)

- Lines 35-42: in the earlier 5-week version, F/G drop returns from `112.54%` to `64.83%`, while I/J kill all trades
- Lines 55-84: explicit written conclusion is "OI and funding as hard entry gates consistently HURT performance" and "Observe, Don't Act"

This doc does not claim that rising futures OI is bearish. It argues against production OI gating.

### 5. Strategy handoff and follow-on docs

[`docs/bots/bitget-bot-strategy.md`](./bots/bitget-bot-strategy.md)

- Lines 163-172: OI expansion/contraction is listed as future work, not validated live logic
- Line 168: hourly OI collection started on 2026-02-26 to support later testing

[`docs/CRYPTO_OI_FRAMEWORK_HANDOFF_2026-03-23.md`](./CRYPTO_OI_FRAMEWORK_HANDOFF_2026-03-23.md)

- Lines 53-54: records the user-memory claim that increasing futures OI may be bearish
- Line 75: explicitly warns that prior evidence came from a volume-expansion proxy because historical OI was unavailable

## Was The Prior Result True Futures OI Or Only A Proxy?

It was only a proxy.

The decisive evidence is in both backtest scripts:

- [`scripts/bitget-v2-backtest.ts`](../scripts/bitget-v2-backtest.ts) lines 963-964
- [`scripts/analyze-bitget-v2-double-session-window.ts`](../scripts/analyze-bitget-v2-double-session-window.ts) lines 963-964

Both explicitly say the backtest path did not have historical OI series and therefore used quote-volume expansion as an OI proxy.

So:

- prior OI gating result: real artifact, yes
- true futures OI result: no
- bearish futures OI claim from that work: not confirmed

## What The Prior Work Actually Supports

The prior work supports four narrower conclusions:

1. In the V2 crypto sample, adding OI as a hard entry gate hurt returns.
2. The tested OI input was proxy OI, not true futures OI.
3. The tested sample was heavily regime-biased.
4. OI was never validated as a production directional signal.

Evidence for regime bias:

- [`docs/bots/CRYPTO_MATRIX_BOARD_DESIGN.md`](./bots/CRYPTO_MATRIX_BOARD_DESIGN.md) line 294 says all crypto backtests were SHORT/HIGH only
- same file line 219 says there was zero LONG or NEUTRAL regime diversity

That matters because even the proxy finding came from a one-sided market regime.

## Current Live Board State

The current Matrix crypto Gamma still uses true futures OI only as a size floor.

[`src/app/api/flagship/crypto-matrix/route.ts`](../src/app/api/flagship/crypto-matrix/route.ts)

- Line 60: `CRYPTO_GAMMA_MIN_OI_USD = 20_000_000`
- Lines 373-409: reads latest and 24h-ago values from `market_oi_snapshots`
- Line 763: `oiAgree = openInterest >= CRYPTO_GAMMA_MIN_OI_USD`
- Lines 984-987: computes `oiDelta24hPct`
- Lines 1012-1015: already includes `oiDelta24hPct`, `oiThresholdUsd`, and `oiThresholdPass` in the row payload

So the current board already has:

- true futures OI level
- true 24h futures OI delta

But Gamma still scores OI only as a liquidity/tradability floor, not as behavior.

The current detail panel also exposes only the level/floor framing:

- [`src/components/flagship/CryptoBoard.tsx`](../src/components/flagship/CryptoBoard.tsx) lines 341-346

## Relevant Side Findings

### Alt screener already uses futures OI as universe quality, not direction

[`scripts/alt-pair-screener.ts`](../scripts/alt-pair-screener.ts)

- Line 83: `MIN_OI_USD = 2_000_000`
- Lines 359-368: computes `openInterestUsd` from Bitget ticker/contract data and uses it only as a floor

This is consistent with the current Matrix use: OI level is treated as tradeability, not direction.

### Existing board-design docs already classify OI as contextual, not core

[`docs/bots/CRYPTO_MATRIX_BOARD_DESIGN.md`](./bots/CRYPTO_MATRIX_BOARD_DESIGN.md)

- Line 183: says OI delta should be contextual and notes gating hurt returns
- Line 290: says OI/funding gates destroy returns and should be contextual, never core

The one suspect sentence in that doc is also line 183: "Rising OI + price trending = real move." That sentence is not backed by the earlier proxy report and should not be treated as confirmed evidence.

## Recommendation: Futures OI Framework

Use futures OI in four separate layers, not one mixed boolean.

### A. OI Level

Purpose: liquidity floor only

- Keep separate from directional logic
- Use symbol-class thresholds, not one universal number
- Suggested display states:
  - `THIN`
  - `OK`
  - `DEEP`

Recommendation:

- Gamma should continue to use OI level as a floor
- failing the floor should cap confidence, not imply directional conflict

### B. OI Delta

Purpose: descriptive pressure change

- Compute both 24h delta and shorter-term delta if enough snapshots exist later
- Start with 24h because it already exists in the payload
- Normalize by symbol using trailing percentiles, not fixed universal thresholds

Suggested state labels:

- `EXPANDING`
- `FLAT`
- `CONTRACTING`

### C. OI Delta Versus Price Change

Purpose: directional interpretation

This should be the real futures OI signal, not OI level alone.

Recommended quadrant model:

| Price | Futures OI | Interpretation | Board effect |
| --- | --- | --- | --- |
| Down | Up | New short build / bearish pressure | `SHORT_CONFIRM` |
| Up | Down | Short covering / squeeze | `LONG_CONFLICT` for shorts, `SQUEEZE` context for longs |
| Down | Down | Deleveraging / move may be tiring | `SHORT_EXHAUSTION` |
| Up | Up | New long build or crowded chase | `LONG_CONFIRM_WEAK` or `CROWDING_UP`, not hard confirm |

Important:

- If you want to preserve the prior user intuition, only the `price down + futures OI up` quadrant should be treated as clearly bearish
- Do not generalize "rising futures OI is bearish" across all price states

### D. How Futures OI Should Affect Gamma

Recommendation:

- use OI level as a liquidity floor
- use OI/price interaction as a regime modifier or soft confirm/conflict
- do not use futures OI delta alone as a hard gate

Board-safe rule:

- `THIN` liquidity: Gamma cannot be `CONFIRM`
- `SHORT_CONFIRM` or `LONG_CONFIRM_WEAK`: contributes one soft confirm vote
- `SHORT_EXHAUSTION`, `SQUEEZE`, or clearly opposing quadrant: contributes one conflict vote
- otherwise: informational only

That keeps OI from overpowering price structure, funding, or liquidation context.

## Recommendation: Separate Future Spot OI Framework

Spot OI must remain a different study.

Also: "spot OI" is not a standard market primitive in the same way futures OI is, so the source definition has to be pinned down before any model is built.

Recommended process:

1. Define the source and vendor semantics first.
2. Store it in a separate table or source path from futures OI.
3. Build separate thresholds and separate backtests.
4. Never reuse futures thresholds or interpretations by default.

Proposed spot framework structure:

- spot inventory level
- spot delta
- spot delta versus price
- spot/futures divergence

Candidate hypothesis set to test separately:

| Price | Spot positioning | Candidate interpretation |
| --- | --- | --- |
| Up | Up | accumulation / bullish confirm |
| Down | Up | absorption / possible bullish divergence |
| Up | Down | distribution / possible bearish divergence |
| Down | Down | risk-off / bearish confirm |

Until this is tested, spot should not feed Gamma at all.

## Recommended Gamma Detail Display

Eventually the crypto Matrix Gamma detail should show one compact futures OI block, not raw research sprawl.

Recommended display:

- `Futures OI: $XX.XM`
- `Liquidity: Thin / OK / Deep`
- `24h OI: +X.X% / -X.X%`
- `OI vs Price: Short Build / Crowding Up / Squeeze / Deleveraging / Neutral`
- `Gamma effect: Confirm / Conflict / Informational`

Recommended summary behavior:

- Gamma headline keeps `CONFIRM / MIXED / CONFLICT`
- OI contributes only when liquidity passes and the OI-price quadrant is strong
- otherwise OI stays visible in detail but does not move the headline state

## Final Conclusion

The prior repo evidence does not confirm a true futures-OI-bearish rule.

It confirms something narrower:

- proxy OI gating hurt V2 returns
- reverse proxy OI also failed to beat the baseline
- the work was done in a SHORT/HIGH-only regime

So the correct next step is not to encode "rising futures OI is bearish" into Gamma.

The correct next step is:

- keep futures OI level as a liquidity floor
- test true futures OI delta against price change as a separate directional layer
- treat futures OI as a soft regime modifier, not a hard gate
- keep future spot positioning fully separate
