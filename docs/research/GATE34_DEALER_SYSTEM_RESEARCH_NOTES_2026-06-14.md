# Gate 34 Dealer System Research Notes

Generated: 2026-06-14

## Current Dealer Algorithm

The app does not literally follow Dealer futures direction. It uses a sell-side/contrarian Dealer interpretation.

Source path:

- `basketSource.ts` derives the COT report date from the execution week, reads the FX snapshot, then calls `derivePairDirectionsWithNeutral(..., "dealer")`.
- `cotCompute.ts` builds Dealer net as `dealer_short - dealer_long`.
- If Dealer short is larger than Dealer long, the currency is marked `BULLISH`.
- If Dealer long is larger than Dealer short, the currency is marked `BEARISH`.

That means the direct pair rule is effectively:

- base Dealer net bullish and quote Dealer net bearish => pair `LONG`
- base Dealer net bearish and quote Dealer net bullish => pair `SHORT`

This is not a pure "dealers are long, so we are long" model. It assumes Dealer inventory is sell-side risk transfer or client accommodation, so the useful signal is often the opposite side of the Dealer book.

When base and quote do not have clean opposed Dealer bias, the app falls back through neutral/tiebreaker tiers:

1. Dealer directional ratio: `abs(dealer_net) / (abs(dealer_net) + dealer_spread)`
2. Dealer delta persistence
3. Dealer delta confirmed by open-interest delta
4. Raw Dealer delta difference
5. Forced raw Dealer net difference

The first tier is signless. It measures which side has the cleaner outright Dealer imbalance after spread is accounted for. It is not the same thing as Dealer direction.

## External Source Read

CFTC's TFF notes define Dealer/Intermediary as sell-side participants. They may not primarily sell futures; they design/sell financial assets to clients and tend to run matched books or offset risk across markets and clients. Futures are used for pricing and balancing risk.

CFTC also states that COT categories are based on trader business purpose, not the specific reason for a position. Staff classifies traders, not each trading activity.

That matters here because a raw Dealer net sign can mean different things in different regimes:

- client-flow hedge
- dealer inventory offset
- cross-market hedge
- spread residual after matched-book activity
- not a directional macro view

Academic FX COT work is consistent with that caution: speculative positions often line up with continuation, while hedging-position measures often line up with reversal; simple net positions by themselves are not reliably informative except in stronger peak/trough contexts.

## Current Evidence

The corrected 2024-2026 audit says the bad 2024 result is not explained by missing COT snapshots, wrong source weeks, frozen-ledger substitution, missing price rows, or default ADR coverage. The source path and test path are internally consistent.

The failure is concentrated in the direct opposed-bias rule:

- 2024 current rule: `-169.48% ADR`
- 2024 direct opposed-bias rows: `-173.48% ADR`
- 2024 neutral/tiebreaker-only rows: `+4.00% ADR`

2026 looks better because both families worked:

- 2026 current rule: `+73.70% ADR`
- 2026 direct opposed-bias rows: `+29.99% ADR`
- 2026 neutral/tiebreaker-only rows: `+43.71% ADR`

The clean 2025 + current 2026 stitched window is profitable under current logic, but the variant audit shows a stronger candidate:

- current: `+95.03% ADR`, weekly PF `1.46`, weekly DD `61.46%`
- neutral only: `+49.34% ADR`, weekly PF `1.40`, weekly DD `38.70%`
- direct inverted: `+3.66% ADR`, weekly PF `1.02`, weekly DD `62.73%`
- direct delta override: `+169.63% ADR`, weekly PF `2.15`, weekly DD `32.50%`

Full inversion is not a solution. It fixes 2024 but damages the stitched 2025-2026 window.

## Spread Bucket Test

The first spread-penalized test answered an important nuance.

Signed spread score does not change direct opposed-bias direction. If base and quote Dealer signs are already opposed, spread can shrink the magnitude but cannot flip the sign unless the signal is zeroed. In the direct rows, signed spread direction agreed with current direct raw direction on every tested row.

Therefore spread is useful only as a quality filter, not as a direction vote.

The stricter per-leg cleanliness filter used:

`min(abs(baseNet)/(abs(baseNet)+baseSpread), abs(quoteNet)/(abs(quoteNet)+quoteSpread))`

Results:

- 2024 `direct_min_leg_ratio0p75`: `-137.40% ADR`, weekly PF `0.55`, weekly DD `223.39%`
- clean 2025 `direct_min_leg_ratio0p75`: `+6.49% ADR`, weekly PF `1.04`, weekly DD `61.62%`
- current 2026 `direct_min_leg_ratio0p75`: `+82.26% ADR`, weekly PF `3.49`, weekly DD `23.00%`
- clean 2025 + current 2026 `direct_min_leg_ratio0p75`: `+88.74% ADR`, weekly PF `1.46`, weekly DD `61.62%`

Combining raw/delta agreement with leg-ratio cleanliness helped 2026 risk quality but still did not solve 2024:

- 2024 `direct_raw_delta_leg_ratio0p75`: `-78.38% ADR`, weekly PF `0.65`, weekly DD `148.86%`
- clean 2025 `direct_raw_delta_leg_ratio0p75`: `+48.92% ADR`, weekly PF `1.44`, weekly DD `40.67%`
- current 2026 `direct_raw_delta_leg_ratio0p75`: `+80.82% ADR`, weekly PF `3.40`, weekly DD `18.65%`
- clean 2025 + current 2026 `direct_raw_delta_leg_ratio0p75`: `+129.74% ADR`, weekly PF `1.90`, weekly DD `40.67%`

This means spread cleanliness is not the missing 2024 fix by itself. It can make strong years cleaner, but it does not turn the bad 2024 direct-bias regime into a pass.

## Fixed-Band Source-Rule Test

A follow-up fixed-band audit tested the main source-rule candidates with market-week `TP 1.2x ADR / SL 2.45x ADR`.

Key result:

- 2024 remains a failure under every tested source rule and exit combination.
- Clean 2025 + current 2026 is best under `direct_delta_override`.
- Fixed TP/SL improves current Dealer in the stitched 2025-2026 window, but cuts the stronger week-close delta-override upside.

Canonical stitched 62-week comparison:

- current week-close: `+95.03% ADR`, DD `50.34%`
- current TP1.2/SL2.45: `+113.48% ADR`, DD `34.02%`
- direct delta confirmed week-close: `+132.33% ADR`, DD `31.87%`
- direct delta confirmed TP1.2/SL2.45: `+102.93% ADR`, DD `32.95%`
- direct delta override week-close: `+169.63% ADR`, DD `37.32%`
- direct delta override TP1.2/SL2.45: `+125.79% ADR`, DD `27.54%`

Receipt: `docs/research/GATE34_DEALER_SOURCE_RULE_FIXED_BAND_AUDIT_2026-06-14.md`

## Working Hypothesis

Dealer source is not useless. The current direct opposed-bias interpretation is too broad and regime-sensitive.

The more robust information appears to be:

- neutral/tiebreaker directional-ratio rows, because they avoid assuming Dealer net sign is always directional
- Dealer delta-diff behavior on direct rows, because it captures recent Dealer positioning change rather than static inventory sign
- spread cleanliness as a quality filter only, not as a bullish/bearish input

The next improvement path should not promote `direct_delta_override` yet. It could be a 2025-2026 fit until tested farther back. The defensible next test is:

1. Keep Dealer-only scope.
2. Re-run 2024, clean 2025, current 2026, stitched 2025-2026 with fixed TP/SL bands using:
   - current rule
   - neutral/tiebreaker-only
   - direct delta-confirmed
   - direct delta-override
   - ratio-confirmed direct
3. Expand backward one year at a time only where COT and canonical price coverage is receipt-backed.
4. Rank by weekly PF, trade PF, expectancy, weekly drawdown, DD/return, Sharpe-style stability, and sizing-normalized return.

## Receipts

- Rule candidate audit: `docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md`
- Rule candidate JSON: `app/reports/data-verification/weekly-hold-audit/dealer-rule-candidate-audit-20260614.json`
- Corrected 2024-2026 audit: `docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md`

## External References

- CFTC TFF explanatory notes: https://www.cftc.gov/sites/default/files/idc/groups/public/%40commitmentsoftraders/documents/file/tfmexplanatorynotes.pdf
- CFTC Commitments of Traders overview: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
- Office of Financial Research TFF data note: https://www.financialresearch.gov/hedge-fund-monitor/datasets/tff/
- Tornell/Yuan FX COT paper: https://economics.umbc.edu/files/2014/09/wp_09_116.pdf
