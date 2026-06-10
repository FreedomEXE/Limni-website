# COT Sentiment Proxy Research - 2026-06-05

Status: saved for near-term return. Do not treat this as an approved v2.0.3
source-policy change until it is tested and Freedom explicitly approves the
source model.

## Purpose

Broker sentiment history remains the v2.0.3 blocker because the live DB lacks
raw Jan/Feb Myfxbook provider rows. While Myfxbook/OANDA/EODHD sentiment
backfill options remain under research, this note preserves a faster and simpler
interim idea: build a sentiment source from CFTC positioning categories.

This would create a new source version, not a fake repair of old Myfxbook rows.

Candidate name:

```text
sentiment_cot_proxy_v1
```

## Rationale

CFTC data is free, official, timestamped, verifiable, and already part of the
Limni source stack. A COT-derived sentiment proxy would let Limni test far
beyond the current 19-week sentiment window while keeping the universe
symmetrical:

```text
COT mapping + sentiment proxy + canonical price + Strength = composite eligible
```

This is attractive because the current Myfxbook gap blocks long-history
Agreement/Tiered/Tandem research. If every COT-backed instrument can receive a
CFTC-native sentiment proxy, we can stress test systems over a much longer
history before adding richer broker/social sentiment later.

## Important Classification Notes

COT-derived sentiment is not true retail sentiment.

| Category | Meaning | Research interpretation |
|---|---|---|
| `nonreportable` | Positions below CFTC reporting thresholds, derived from total open interest minus reportables. | Closest CFTC proxy to smaller/speculative crowd, but noisy and still futures-market data. |
| `noncommercial` | Legacy report large speculative/reportable traders. | Cleaner broad speculator signal, but these are large players, not retail. |
| `managed_money` / `leveraged_funds` | More specific speculative categories in disaggregated/TFF-style reports. | Potentially useful but report-family mapping must be handled carefully. |
| blended spec score | Composite of nonreportable plus speculative reportable categories. | Likely worth testing after single-category baselines. |

Plain language: this is "speculative positioning sentiment," not "dumb retail
money." It can be passable and useful, but it should be named honestly.

## Symmetry Rule

For now, composite systems should remain symmetrical. An instrument should only
enter Agreement/Tiered/Tandem-style baskets when it has:

- COT mapping,
- sentiment mapping or approved sentiment proxy,
- canonical price data,
- Strength support,
- Friday/source lock support,
- source-readiness audit coverage.

If an instrument has COT data but no sentiment/proxy, it can stay in research
inventory but should not enter composite systems yet.

## Candidate Signals To Test

Test these as separate research variants before combining anything:

| Variant | Direction idea |
|---|---|
| `nonreportable_contrarian` | Nonreportables net long = bearish; net short = bullish. |
| `nonreportable_aligned` | Nonreportables net long = bullish; net short = bearish. |
| `noncommercial_contrarian` | Noncommercials net long = bearish; net short = bullish. |
| `noncommercial_aligned` | Noncommercials net long = bullish; net short = bearish. |
| `spec_blend_contrarian` | Blend speculative categories, then trade opposite crowd. |
| `spec_blend_aligned` | Blend speculative categories, then trade with crowd. |
| `extreme_only` | Emit direction only when percentile/z-score is extreme; otherwise neutral. |
| `change_based` | Use weekly change in positioning, not only net position. |

Recommended first pass:

1. Nonreportable contrarian.
2. Noncommercial contrarian.
3. Spec blend contrarian.
4. Extreme-only variants.

## Scoring Candidates

Possible normalized inputs:

```text
net_contracts = long_contracts - short_contracts
net_pct_oi = (long_contracts - short_contracts) / open_interest
long_share = long_contracts / (long_contracts + short_contracts)
z_score = current net_pct_oi vs trailing N-week history
percentile = current net_pct_oi percentile vs trailing N-week history
weekly_change = current net_pct_oi - prior net_pct_oi
```

Do not pick a final formula by instinct. Compare variants against canonical
Dealer/Commercial/Strength/Sentiment baselines first.

## Research Protocol

1. Use canonical `basketSource.ts` parity rules before trusting any backtest.
2. Build the COT sentiment proxy as read-only research first.
3. Compare against the current clean consecutive composite baseline, not the
   deprecated 19-week full-composite window with missing sentiment proof.
4. Extend to the longest reliable COT history available for the mapped universe.
5. Test with:
   - Dealer + Strength only,
   - Dealer + Strength + Commercial,
   - Dealer + Strength + current Myfxbook where available,
   - Dealer + Strength + COT sentiment proxy,
   - Dealer + Strength + Myfxbook + COT sentiment proxy,
   - Commercial included/excluded/reweighted.
6. Report return, drawdown, trade count, week win %, and source coverage.
7. Do not regenerate v33 canon until the source policy is explicitly chosen.

## Clean Baseline Accounting

The provisional app/composite baseline should maximize consecutive trusted
weeks, not calendar neatness. Fourteen consecutive clean weeks is better than
twelve March-only clean weeks if all four active sources are trusted in the
fourteen-week span.

Current provisional clean app comparison baseline:

```bash
npm run source:completion:clean14
npm run source:freeze:clean14
```

Window name: `v2.0.3-clean-14w`.

Window: `2026-02-23T00:00:00.000Z` through
`2026-05-24T23:00:00.000Z`.

`source:completion:clean14` proves the old/current source timing. `source:freeze:clean14`
proves Friday 17:00 `America/New_York` freeze coverage for the same 14 weeks.
The Friday-freeze Sentiment evidence is `aggregate_derived`; raw Myfxbook
provider evidence remains missing historically and must not be implied.

This is a research/comparison baseline, not full v2.0.3 release approval. The
full 19-week command remains:

```bash
npm run source:completion:release
```

and stays blocked until Jan/Feb Sentiment is source-trusted or Freedom approves
an explicit source-policy change.

Do not use a split baseline with holes. If a source-trust gap appears in the
middle of a window, either start after the gap or end before the gap.

The deprecated 19-week full-composite window can still be useful as forensic
history, but it should not be the app's current composite truth while four
sentiment weeks lack raw source proof.

## Broader Optimization Paths

After Dealer, Commercial, and Strength are locked and the Friday freeze semantics
are stable, test three strategic paths:

| Path | Description | Why it matters |
|---|---|---|
| Replace Myfxbook | Use COT-derived sentiment in place of Myfxbook. | Fastest official-data route to years of symmetric history. |
| Blend with Myfxbook | Combine COT-derived sentiment with Myfxbook future locks. | May outperform either standalone source if the signals are complementary. |
| Drop sentiment | Use three-source systems: Dealer, Commercial, Strength. | Tandem can run without sentiment; Agreement/Tiered/Selector can be adapted to 2-of-3 or 3-source logic. |

Treat "no sentiment" as a real candidate, not a failure case. If Dealer +
Strength or Dealer + Strength + Commercial outperforms sentiment composites,
then the system should be allowed to simplify.

## Relationship To Myfxbook/OANDA/EODHD

This idea does not cancel broker/social sentiment research.

Longer-term sentiment can become an ensemble:

```text
sentiment_v2 = COT speculative proxy + broker positioning + social/news sentiment
```

But the COT proxy may be the fastest official-data path to:

- unblock long-history stress tests,
- keep source coverage symmetrical,
- avoid spending on unverified Myfxbook history,
- delay EODHD/OANDA integration until coverage is proven.

## Open Questions

- Which COT report family should own the first proxy per asset class: Legacy,
  TFF, or Disaggregated?
- Should nonreportable be interpreted contrarian, aligned, or only at extremes?
- Does nonreportable add independent information when Dealer and Commercial are
  already CFTC-derived?
- Should Commercial be retired, inverted, or reweighted if the proxy performs
  better?
- How should neutral/no-signal weeks behave in Agreement/Tiered systems?
- Does a three-source system without sentiment outperform the four-source
  systems after proper freeze semantics and source readiness are locked?
- If COT proxy plus Myfxbook works best, what weighting or tie-break logic keeps
  the aggregate simple enough to operate safely?

## Human Breakdown

What changed: this note preserves the COT-derived sentiment proxy idea for
near-term research, including replace/blend/drop-sentiment paths.

Why it matters: it may provide an official, free, historical sentiment proxy
that lets Limni test far beyond the 19-week Myfxbook-limited window.

What passed/failed: no code was changed and no proxy was approved. This is a
saved research direction only.

Next gate: prototype `sentiment_cot_proxy_v1` read-only, then compare
nonreportable/noncommercial/spec-blend variants against current 19-week results
and longer COT history.
