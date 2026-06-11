# Source Canonicalization Results

Date: 2026-04-04

## Coverage Table

| Source | Version | Trades | Trades/Wk | Coverage% | Forced Pairs | Total% | MaxDD% | R/DD | Win% |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| dealer | A | 230 | 23.0 | 63.9% | — | +73.17% | 2.20% | 33.26x | 56.5% |
| dealer | B | 360 | 36.0 | 100.0% | 130 | +40.66% | 7.37% | 5.52x | 50.8% |
| sentiment | A | 265 | 26.5 | 73.6% | — | +92.41% | 19.56% | 4.72x | 60.8% |
| sentiment | B | 347 | 34.7 | 96.4% | 82 | +82.50% | 24.13% | 3.42x | 59.1% |
| strength | A | 335 | 33.5 | 93.1% | — | +80.88% | 14.98% | 5.40x | 54.6% |
| strength | B | 351 | 35.1 | 97.5% | 16 | +78.72% | 15.09% | 5.22x | 54.4% |
| commercial | current | 360 | 36.0 | 100.0% | — | +21.14% | 29.04% | 0.73x | 52.5% |

## Per-Week Coverage Grid

| Week | D[A] | D[B] | S[A] | S[B] | Str[A] | Str[B] | Comm | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Jan 19 | 20 | 36 | 30 | 35 | 32 | 33 | 36 | 36 |
| Jan 26 | 20 | 36 | 30 | 35 | 32 | 34 | 36 | 36 |
| Feb 02 | 23 | 36 | 28 | 34 | 35 | 36 | 36 | 36 |
| Feb 09 | 24 | 36 | 28 | 35 | 35 | 36 | 36 | 36 |
| Feb 16 | 24 | 36 | 28 | 35 | 34 | 34 | 36 | 36 |
| Feb 23 | 24 | 36 | 20 | 34 | 34 | 36 | 36 | 36 |
| Mar 02 | 24 | 36 | 24 | 34 | 36 | 36 | 36 | 36 |
| Mar 08 | 24 | 36 | 27 | 35 | 30 | 34 | 36 | 36 |
| Mar 15 | 23 | 36 | 26 | 35 | 33 | 36 | 36 | 36 |
| Mar 22 | 24 | 36 | 24 | 35 | 34 | 36 | 36 | 36 |

## Standalone Damage Assessment

| Source | Δ Total% | Δ MaxDD% | Δ Win% | Δ Trades | Verdict |
|---|---:|---:|---:|---:|---|
| Dealer | -32.51% | +5.17pp | -5.7pp | +130 | concerning |
| Sentiment | -9.91% | +4.57pp | -1.7pp | +82 | acceptable |
| Strength | -2.16% | +0.11pp | -0.2pp | +16 | acceptable |

## Composite Comparison

| System | Trades | Total% | MaxDD% | R/DD | Win% | LW |
|---|---:|---:|---:|---:|---:|---:|
| agree_2of3 [A] (engine) | 227 | +104.68% | 8.41% | 12.45x | 62.6% | 3 |
| agree_2of3 [B] | 347 | +102.87% | 13.51% | 7.61x | 59.6% | 2 |
| agree_2of3_nocomm [A] (engine) | 252 | +115.61% | 12.85% | 9.00x | 60.7% | 2 |
| agree_2of3_nocomm [B] | 350 | +97.67% | 10.19% | 9.58x | 56.6% | 2 |
| tiered_v3 [A] (engine) | 257 | +111.51% | 6.22% | 17.93x | 62.3% | 2 |
| tiered_v3 [B] | 347 | +102.87% | 13.51% | 7.61x | 59.6% | 2 |
| tiered_3_nocomm [A] (engine) | 285 | +114.07% | 17.98% | 6.34x | 58.6% | 4 |
| tiered_3_nocomm [B] | 350 | +97.67% | 10.19% | 9.58x | 56.6% | 2 |
| 2-of-4 Agree [B] | 241 | +93.56% | 17.71% | 5.28x | 60.2% | 4 |
| 3-of-4 Agree [B] | 220 | +103.47% | 9.87% | 10.48x | 62.7% | 3 |
| Tiered 4 [B] | 241 | +93.56% | 17.71% | 5.28x | 60.2% | 4 |

## Decision Summary

QUESTION 1: Does full coverage make composites cleaner?
→ Existing-family [B] comparisons: agree_2of3 -1.81%, agree_2of3_nocomm -17.94%, tiered_v3 -8.64%, tiered_3_nocomm -16.40%.

QUESTION 2: Which sources should be upgraded?
→ Dealer: concerning
→ Sentiment: acceptable
→ Strength: acceptable

QUESTION 3: Is 4-source standardized better than current 3-source composites?
→ 2-of-4 [B]: +93.56% | 3-of-4 [B]: +103.47% | Tiered 4 [B]: +93.56%
