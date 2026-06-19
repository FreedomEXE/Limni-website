# Gate 34 Dealer System Decision Log

Generated: 2026-06-15

## Purpose

This is the running decision log for Dealer-only Weekly Hold research.

Use this file to prevent looping back into old logic without a reason. Old tests
remain useful benchmarks, but they are not active candidates unless a later audit
proves the test setup was flawed.

Frozen scope remains Dealer source only. Do not pull in Commercial, Sentiment,
Strength, ADR Grid, Pair Fill Cap, tandem/tiered/composite systems, release
canon, or live strategy promotion from this file.

## Stop Line

Everything tested before the normalized Dealer score model is not good enough
for promotion.

Known rejected or insufficient logic:

- Current app Dealer logic.
- Current app Dealer logic with fixed ADR TP/SL bands.
- `direct_ratio_override`.
- `ratio_direction_all`.
- `ratio_direction_all` with fixed ADR TP/SL bands.
- `dealer_normalized_score_forced28` with week-close or `TP 1.6x / SL 2.45x`;
  it was the least-bad 2019 row but failed 2020 and is not an active baseline
  candidate.
- `ratio_direction_all_current_fallback`; this was diagnostic only and should
  not become the design direction.
- Direct inversion.
- Direct delta and spread-cleanliness variants tested so far; some improve
  windows, but none solve the cross-year risk profile.

These can be rerun only for parity checks, receipt repair, or if the backtest
engine itself is proven flawed. They should not be treated as fresh strategy
ideas.

## Lessons So Far

The current app Dealer model is too regime-sensitive. It can work in some
windows, but 2024 and 2019 show the return-to-drawdown profile is unacceptable.

The ratio rule found useful information, especially because it measures Dealer
imbalance cleanliness after spread. But exact `ratio_direction_all` can still
drop neutral/tied rows, and the forced current fallback variant is not a proper
model.

Fixed ADR exits can reduce drawdown for current Dealer, but they do not fix a
bad source model. On 2019, `ratio_direction_all + TP1.6/SL2.45` was worse than
`ratio_direction_all` week-close by return and profit factor, even though its
drawdown improved.

Spread is signal quality metadata. It is not a standalone bullish or bearish
vote.

Every future candidate must emit all 28 FX pair rows every week with a reason.
No silent row dropping.

## Next Hypothesis

The latest tested model was a Dealer-only normalized currency scoreboard:

`dealer_normalized_score_forced28`

This is not the separate Limni Strength source. It only borrowed the same
principle: normalize each currency first, then compare base currency against
quote currency.

### Currency Components

For each FX currency in a report week:

1. Raw Dealer inventory score:
   `dealer_pct_of_oi = (dealer_short - dealer_long) / open_interest`
2. Dealer imbalance cleanliness:
   `dealer_directional_ratio = abs(dealer_net) / (abs(dealer_net) + dealer_spread)`
3. Dealer delta score:
   `dealer_delta_net / open_interest`

Each component is normalized cross-sectionally across the FX currency universe
for the same report week. That avoids comparing raw contract counts directly
between currencies with different futures markets.

The first version used equal weights:

```txt
currency_score = raw_component_norm + ratio_component_norm + delta_component_norm
pair_score = base_currency_score - quote_currency_score
```

Direction:

- `pair_score > 0`: `LONG`
- `pair_score < 0`: `SHORT`
- exact ties are resolved only by deterministic score-detail tiebreakers and
  must be marked in the row reason.

### Evidence Required

Every receipt must report:

- ADR return
- raw return
- ADR max drawdown
- return/DD ratio
- weekly profit factor
- trade profit factor
- expectancy
- weekly W/L
- trade W/L
- pair contribution and drag in follow-up analysis
- source rule reason per pair row
- full 28-pair coverage per selected week

## First Test Order

1. Implement `dealer_normalized_score_forced28` as research-only source logic.
2. Run clean 2019 first with:
   - week-close
   - market-week `TP 1.6x / SL 2.45x`
3. Compare against current Dealer and `ratio_direction_all` on the same 43-week
   sample.
4. Stop and inspect the result before continuing year by year.

## 2019 First Test Result

Receipt:

`app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-43w-20260615-153747.md`

Scope:

- Clean 2019 43-week sample.
- 28 FX pairs.
- Source rules: current Dealer, `ratio_direction_all`, and
  `dealer_normalized_score_forced28`.
- Exit rules: week-close and market-week `TP 1.6x / SL 2.45x`.

Summary:

| Variant | ADR | Raw | ADR DD | Return/DD | Weekly PF | Weekly W/L |
|---|---:|---:|---:|---:|---:|---:|
| Current Dealer / Week Close | -124.90% | -89.37% | 122.20% | -1.02 | 0.61 | 17/26/0 |
| Current Dealer / TP1.6 SL2.45 | -60.00% | -40.34% | 75.85% | -0.79 | 0.72 | 21/22/0 |
| Ratio Direction All / Week Close | -71.92% | -26.53% | 103.26% | -0.70 | 0.68 | 18/25/0 |
| Ratio Direction All / TP1.6 SL2.45 | -76.87% | -30.93% | 83.42% | -0.92 | 0.58 | 15/28/0 |
| Dealer Normalized Score Forced 28 / Week Close | -65.57% | -39.02% | 113.91% | -0.58 | 0.77 | 20/23/0 |
| Dealer Normalized Score Forced 28 / TP1.6 SL2.45 | -42.03% | -29.03% | 67.92% | -0.62 | 0.76 | 23/20/0 |

Read:

- The normalized score model is still negative in 2019. It is not a pass.
- It is the best tested Dealer variant so far on the 2019 return-to-drawdown
  profile, weekly PF, and full-pair coverage.
- The market-week ADR band helps the normalized model materially, unlike
  `ratio_direction_all`, where the same band made 2019 worse.
- The normalized score model forced all 1,204 pair-weeks with zero neutral,
  missing, no-trade, pre-entry invalidated, missing-return, or missing-path-bar
  rows.
- Current Dealer and `ratio_direction_all` benchmark rows in this receipt match
  the prior 2019 receipt exactly.

Decision:

Do not promote. Continue one year at a time only if Freedom accepts this as the
new active hypothesis. The next useful check is clean 2020, then clean 2021, not
more 2019 tuning.

## 2020 Second Test Result

Receipt:

`app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260615-162927.md`

Scope:

- Clean 2020 52-week sample.
- 28 FX pairs.
- Source rules: current Dealer, `ratio_direction_all`, and
  `dealer_normalized_score_forced28`.
- Exit rules: week-close and market-week `TP 1.6x / SL 2.45x`.

Summary:

| Variant | ADR | Raw | ADR DD | Return/DD | Weekly PF | Trade PF | Weekly W/L |
|---|---:|---:|---:|---:|---:|---:|---:|
| Current Dealer / Week Close | +118.30% | +28.78% | 55.05% | 2.15 | 1.45 | 1.15 | 29/23/0 |
| Current Dealer / TP1.6 SL2.45 | +23.76% | -18.96% | 62.77% | 0.38 | 1.09 | 1.03 | 27/25/0 |
| Ratio Direction All / Week Close | +112.27% | +61.51% | 32.97% | 3.41 | 1.61 | 1.15 | 26/26/0 |
| Ratio Direction All / TP1.6 SL2.45 | -32.46% | -64.54% | 81.86% | - | 0.85 | 0.96 | 24/28/0 |
| Dealer Normalized Score Forced 28 / Week Close | -16.06% | -68.38% | 72.38% | - | 0.95 | 0.98 | 24/28/0 |
| Dealer Normalized Score Forced 28 / TP1.6 SL2.45 | -80.58% | -93.32% | 97.62% | - | 0.72 | 0.90 | 27/25/0 |

Coverage:

- `dealer_normalized_score_forced28` emitted all 1,456 source rows
  (52 weeks x 28 pairs).
- Week-close had zero skipped or missing rows.
- Market-week TP/SL had two pre-entry invalidated rows, both on 2020-03-09:
  `EURCAD` long and `CADJPY` short. This is an exit-path invalidation, not a
  source-rule neutral row.
- `ratio_direction_all` still did not cover all source rows in this receipt:
  1,405 rows instead of 1,456.

Read:

- 2020 rejects the idea that the normalized score model is obviously better.
- The best 2020 line is `ratio_direction_all` week-close by return/DD and
  weekly PF, but it is not a full 28-pair forced model.
- The market-week `TP 1.6x / SL 2.45x` band hurt all three 2020 variants versus
  week-close, including the normalized score model.
- This means the 2019 normalized-score TP/SL improvement is not stable enough
  to become the baseline without more evidence.
- Do not move to ADR Grid from this result. Continue year-by-year diagnostics or
  inspect why 2020 strongly prefers ratio week-close before changing logic.

Decision:

The normalized score model is rejected as a current baseline candidate. It solved
neither the cross-year stability problem nor the TP/SL problem. Gate 34 still has
no Dealer-only baseline that is good enough for promotion:

- best 2020 performance came from `ratio_direction_all` week-close, but it does
  not force all 28 pair rows;
- best 2019 forced-28 result was still negative;
- market-week `TP 1.6x / SL 2.45x` is not a stable rescue rule and hurt every
  tested 2020 variant.

Next work should redesign the forced-28 Dealer baseline and rethink exits before
running more promotion-style sweeps. Do not retest old logic unless a concrete
test flaw is found.

## Receipt Pointers

Existing benchmarks:

- 2019 current/ratio/fixed-band receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-43w-20260615-150205.md`
- Historical ratio weekly audit:
  `docs/research/GATE34_DEALER_RATIO_RULE_WEEKLY_AUDIT_2026-06-14.md`
- Source-rule candidate audit:
  `docs/research/GATE34_DEALER_RULE_CANDIDATE_AUDIT_2026-06-14.md`
- Dealer system research notes:
  `docs/research/GATE34_DEALER_SYSTEM_RESEARCH_NOTES_2026-06-14.md`
