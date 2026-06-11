# Composite Standardization Sweep Results

Date: 2026-04-04

## Baseline Verification

| Family | System | Filter | Trades | Total% | MaxDD% | R/DD | Win% | LW | Worst Week% |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| standalone | Dealer | raw | 230 | +73.17% | 2.20% | 33.26 | 56.5% | 3 | -1.99% |
| standalone | Sentiment | raw | 265 | +92.41% | 19.56% | 4.72 | 60.8% | 5 | -11.72% |
| standalone | Strength | raw | 335 | +80.88% | 14.98% | 5.40 | 54.6% | 4 | -6.03% |
| standalone | Commercial | raw | 360 | +21.14% | 29.04% | 0.73 | 52.5% | 4 | -19.66% |
| agreement | agree_2of3_nocomm | raw | 252 | +115.61% | 12.85% | 9.00 | 60.7% | 2 | -8.80% |

## Agreement Winner

| Family | System | Filter | Trades | Total% | MaxDD% | R/DD | Win% | LW | Worst Week% |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| agreement | agree_2of3 | tieveto | 162 | +88.78% | 5.61% | 15.83 | 65.4% | 2 | -4.35% |
| agreement | agree_2of3_nocomm | raw | 252 | +115.61% | 12.85% | 9.00 | 60.7% | 2 | -8.80% |
| agreement | agree_3of4 | raw | 139 | +94.30% | 7.41% | 12.73 | 66.9% | 3 | -5.36% |
| agreement | agree_3of4 | veto | 139 | +94.30% | 7.41% | 12.73 | 66.9% | 3 | -5.36% |
| agreement | agree_3of4 | tieveto | 133 | +84.84% | 7.46% | 11.37 | 66.2% | 3 | -5.36% |
| agreement | agree_2of3 | raw | 227 | +104.68% | 8.41% | 12.45 | 62.6% | 3 | -4.41% |
| agreement | agree_2of3_nocomm | tieveto | 198 | +101.25% | 15.32% | 6.61 | 63.1% | 3 | -10.50% |
| agreement | agree_2of3 | veto | 180 | +101.38% | 9.62% | 10.54 | 65.0% | 4 | -3.19% |
| agreement | agree_2of3_nocomm | veto | 205 | +109.28% | 17.91% | 6.10 | 62.9% | 4 | -8.72% |

Winner: `Agree 2-of-3 + TieVeto`

## Tiered Winner

| Family | System | Filter | Trades | Total% | MaxDD% | R/DD | Win% | LW | Worst Week% |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| tiered | tiered_v3 | raw | 257 | +111.51% | 6.22% | 17.93 | 62.3% | 2 | -6.22% |
| tiered | tiered_v3 | tieveto | 173 | +88.01% | 6.20% | 14.20 | 64.7% | 3 | -5.22% |
| tiered | tiered_v3 | veto | 210 | +108.20% | 7.81% | 13.85 | 64.3% | 3 | -6.40% |
| tiered | tiered_3_nocomm | tieveto | 219 | +100.79% | 19.21% | 5.25 | 61.6% | 3 | -8.44% |
| tiered | tiered_4 | tieveto | 239 | +90.45% | 22.35% | 4.05 | 61.1% | 3 | -11.48% |
| tiered | tiered_4 | raw | 299 | +117.24% | 16.24% | 7.22 | 59.9% | 4 | -6.84% |
| tiered | tiered_4 | veto | 299 | +117.24% | 16.24% | 7.22 | 59.9% | 4 | -6.84% |
| tiered | tiered_3_nocomm | raw | 285 | +114.07% | 17.98% | 6.34 | 58.6% | 4 | -6.19% |
| tiered | tiered_3_nocomm | veto | 238 | +107.73% | 23.64% | 4.56 | 60.1% | 4 | -9.83% |

Winner: `Tiered V3 Raw`

## Selector Winner

| Family | System | Filter | Trades | Total% | MaxDD% | R/DD | Win% | LW | Worst Week% |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| selector | selector | veto | 229 | +106.83% | 0.58% | 184.19 | 62.9% | 1 | -0.58% |
| selector | selector | tieveto | 209 | +104.81% | 2.45% | 42.78 | 64.6% | 2 | -2.45% |
| selector | selector | raw | 360 | +111.58% | 15.27% | 7.31 | 59.7% | 2 | -15.27% |

Winner: `Selector + Veto`

## Standalone Filter Winners

| Family | System | Filter | Trades | Total% | MaxDD% | R/DD | Win% | LW | Worst Week% |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| standalone | Dealer | tieveto | 115 | +77.38% | 1.89% | 40.94 | 67.0% | 2 | -1.89% |
| standalone | Dealer | veto | 108 | +69.40% | 2.65% | 26.19 | 64.8% | 2 | -2.48% |
| standalone | Commercial | veto | 206 | +74.50% | 9.56% | 7.79 | 60.2% | 2 | -9.56% |
| standalone | Dealer | raw | 230 | +73.17% | 2.20% | 33.26 | 56.5% | 3 | -1.99% |
| standalone | Sentiment | tieveto | 194 | +89.42% | 14.29% | 6.26 | 63.4% | 3 | -11.25% |
| standalone | Commercial | tieveto | 179 | +53.92% | 18.71% | 2.88 | 59.8% | 3 | -9.90% |
| standalone | Strength | raw | 335 | +80.88% | 14.98% | 5.40 | 54.6% | 4 | -6.03% |
| standalone | Strength | veto | 253 | +95.03% | 17.14% | 5.54 | 58.5% | 4 | -8.82% |
| standalone | Sentiment | veto | 205 | +97.66% | 19.85% | 4.92 | 62.9% | 4 | -9.41% |
| standalone | Strength | tieveto | 237 | +62.06% | 24.67% | 2.52 | 57.0% | 4 | -16.47% |
| standalone | Commercial | raw | 360 | +21.14% | 29.04% | 0.73 | 52.5% | 4 | -19.66% |
| standalone | Sentiment | raw | 265 | +92.41% | 19.56% | 4.72 | 60.8% | 5 | -11.72% |

Winner: `Dealer + TieVeto`

## Veto Universality Analysis

- Agreement winner: `Agree 2-of-3 + TieVeto`
- Tiered winner: `Tiered V3 Raw`
- Selector winner: `Selector + Veto`
- Dealer winner: `Dealer + TieVeto`
- Sentiment winner: `Sentiment + TieVeto`
- Strength winner: `Strength Raw`
- Commercial winner: `Commercial + Veto`

Winner modes diverge (tieveto, raw, veto), so veto should not be treated as universally canonical from this sweep alone. Filter 2 remains the cleaner place unless the live-layer follow-up converges further.

## Grand Ranking

| Family | System | Filter | Trades | Total% | MaxDD% | R/DD | Win% | LW | Worst Week% |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| selector | selector | veto | 229 | +106.83% | 0.58% | 184.19 | 62.9% | 1 | -0.58% |
| standalone | Dealer | tieveto | 115 | +77.38% | 1.89% | 40.94 | 67.0% | 2 | -1.89% |
| selector | selector | tieveto | 209 | +104.81% | 2.45% | 42.78 | 64.6% | 2 | -2.45% |
| standalone | Dealer | veto | 108 | +69.40% | 2.65% | 26.19 | 64.8% | 2 | -2.48% |
| agreement | agree_2of3 | tieveto | 162 | +88.78% | 5.61% | 15.83 | 65.4% | 2 | -4.35% |
| tiered | tiered_v3 | raw | 257 | +111.51% | 6.22% | 17.93 | 62.3% | 2 | -6.22% |
| standalone | Commercial | veto | 206 | +74.50% | 9.56% | 7.79 | 60.2% | 2 | -9.56% |
| agreement | agree_2of3_nocomm | raw | 252 | +115.61% | 12.85% | 9.00 | 60.7% | 2 | -8.80% |
| selector | selector | raw | 360 | +111.58% | 15.27% | 7.31 | 59.7% | 2 | -15.27% |
| standalone | Dealer | raw | 230 | +73.17% | 2.20% | 33.26 | 56.5% | 3 | -1.99% |
| tiered | tiered_v3 | tieveto | 173 | +88.01% | 6.20% | 14.20 | 64.7% | 3 | -5.22% |
| agreement | agree_3of4 | raw | 139 | +94.30% | 7.41% | 12.73 | 66.9% | 3 | -5.36% |
| agreement | agree_3of4 | veto | 139 | +94.30% | 7.41% | 12.73 | 66.9% | 3 | -5.36% |
| agreement | agree_3of4 | tieveto | 133 | +84.84% | 7.46% | 11.37 | 66.2% | 3 | -5.36% |
| tiered | tiered_v3 | veto | 210 | +108.20% | 7.81% | 13.85 | 64.3% | 3 | -6.40% |
| agreement | agree_2of3 | raw | 227 | +104.68% | 8.41% | 12.45 | 62.6% | 3 | -4.41% |
| standalone | Sentiment | tieveto | 194 | +89.42% | 14.29% | 6.26 | 63.4% | 3 | -11.25% |
| agreement | agree_2of3_nocomm | tieveto | 198 | +101.25% | 15.32% | 6.61 | 63.1% | 3 | -10.50% |
| standalone | Commercial | tieveto | 179 | +53.92% | 18.71% | 2.88 | 59.8% | 3 | -9.90% |
| tiered | tiered_3_nocomm | tieveto | 219 | +100.79% | 19.21% | 5.25 | 61.6% | 3 | -8.44% |
| tiered | tiered_4 | tieveto | 239 | +90.45% | 22.35% | 4.05 | 61.1% | 3 | -11.48% |
| agreement | agree_2of3 | veto | 180 | +101.38% | 9.62% | 10.54 | 65.0% | 4 | -3.19% |
| standalone | Strength | raw | 335 | +80.88% | 14.98% | 5.40 | 54.6% | 4 | -6.03% |
| tiered | tiered_4 | raw | 299 | +117.24% | 16.24% | 7.22 | 59.9% | 4 | -6.84% |
| tiered | tiered_4 | veto | 299 | +117.24% | 16.24% | 7.22 | 59.9% | 4 | -6.84% |
| standalone | Strength | veto | 253 | +95.03% | 17.14% | 5.54 | 58.5% | 4 | -8.82% |
| agreement | agree_2of3_nocomm | veto | 205 | +109.28% | 17.91% | 6.10 | 62.9% | 4 | -8.72% |
| tiered | tiered_3_nocomm | raw | 285 | +114.07% | 17.98% | 6.34 | 58.6% | 4 | -6.19% |
| standalone | Sentiment | veto | 205 | +97.66% | 19.85% | 4.92 | 62.9% | 4 | -9.41% |
| tiered | tiered_3_nocomm | veto | 238 | +107.73% | 23.64% | 4.56 | 60.1% | 4 | -9.83% |
| standalone | Strength | tieveto | 237 | +62.06% | 24.67% | 2.52 | 57.0% | 4 | -16.47% |
| standalone | Commercial | raw | 360 | +21.14% | 29.04% | 0.73 | 52.5% | 4 | -19.66% |
| standalone | Sentiment | raw | 265 | +92.41% | 19.56% | 4.72 | 60.8% | 5 | -11.72% |

## Recommendation

- Agreement winner: `Agree 2-of-3 + TieVeto`
- Tiered winner: `Tiered V3 Raw`
- Selector winner: `Selector + Veto`
- Standalone source winners: dealer `tieveto`, sentiment `tieveto`, strength `raw`, commercial `veto`
- Universal filter verdict: Winner modes diverge (tieveto, raw, veto), so veto should not be treated as universally canonical from this sweep alone. Filter 2 remains the cleaner place unless the live-layer follow-up converges further.
