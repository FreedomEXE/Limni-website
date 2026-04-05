# Veto Composite Sweep Results

Date: 2026-04-04

Closed weeks tested: 10 (Jan 19 to Mar 22)

## Baseline Verification

- Dealer raw matched `230 trades / +73.18% / 2.19% DD`.
- Sentiment raw matched `265 trades / +92.40% / 19.56% DD`.
- Strength raw matched `335 trades / +80.89% / 14.98% DD`.
- Commercial raw matched `224 trades / -38.07% / 42.04% DD`.
- 2-of-3 NoComm matched `252 trades / +115.60% / 12.85% DD`.
- Tiered V3 matched `245 trades / +96.79% / 19.57% DD`.

## Grand Ranking

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + Veto | 229 | +106.83% | 0.58% | 184.19x | 62.9% | 1 | -0.58% |
| Selector + Dealer TieVeto | 475 | +188.96% | 9.08% | 20.81x | 61.5% | 1 | -9.08% |
| Selector + GradVeto | 229 | +67.55% | 1.06% | 63.73x | 62.9% | 2 | -0.62% |
| Dealer Tie+Veto | 115 | +77.38% | 1.89% | 40.94x | 67.0% | 2 | -1.89% |
| Selector + TieVeto | 209 | +104.81% | 2.45% | 42.78x | 64.6% | 2 | -2.45% |
| Dealer Veto (std) | 108 | +69.40% | 2.65% | 26.19x | 64.8% | 2 | -2.48% |
| Selector + Dealer Filter | 230 | +115.42% | 4.52% | 25.54x | 63.5% | 2 | -4.52% |
| Tiered V3 + DealerWeightedVeto | 169 | +109.08% | 6.05% | 18.03x | 69.2% | 2 | -4.34% |
| Tiered V3 Raw | 257 | +111.51% | 6.22% | 17.93x | 62.3% | 2 | -6.22% |
| Tiered V3 + GradVeto | 210 | +78.23% | 7.67% | 10.20x | 64.3% | 2 | -5.87% |
| Commercial Veto (std) | 206 | +74.50% | 9.56% | 7.79x | 60.2% | 2 | -9.56% |
| 2-of-3 NoComm Raw | 252 | +115.61% | 12.85% | 9.00x | 60.7% | 2 | -8.80% |
| 2-of-3 NoComm + Dealer TieVeto | 367 | +192.99% | 12.91% | 14.95x | 62.7% | 2 | -10.69% |
| Dealer+Sentiment TieVeto | 309 | +166.80% | 14.35% | 11.62x | 64.7% | 2 | -13.14% |
| Selector Raw | 360 | +111.58% | 15.27% | 7.31x | 59.7% | 2 | -15.27% |
| Dealer Raw | 230 | +73.17% | 2.20% | 33.26x | 56.5% | 3 | -1.99% |
| Tiered 3 NoComm + Dealer Filter | 186 | +77.64% | 3.33% | 23.32x | 58.6% | 3 | -3.33% |
| 2-of-3 NoComm + Dealer Filter | 184 | +73.57% | 4.46% | 16.50x | 58.1% | 3 | -3.33% |
| Tiered V3 + TieVeto | 173 | +88.01% | 6.20% | 14.20x | 64.7% | 3 | -5.22% |
| Tiered V3 + Dealer Filter | 169 | +57.82% | 7.31% | 7.91x | 58.0% | 3 | -4.28% |
| Tiered V3 + Veto | 210 | +108.20% | 7.81% | 13.85x | 64.3% | 3 | -6.40% |
| Commercial Forced Raw + GradVeto | 152 | +54.62% | 10.66% | 5.12x | 61.8% | 3 | -5.63% |
| Selector + DealerWeightedVeto | 186 | +86.93% | 10.78% | 8.06x | 62.4% | 3 | -5.43% |
| Dealer TieVeto + Comm Forced Raw Veto | 267 | +144.64% | 13.51% | 10.71x | 64.0% | 3 | -6.95% |
| Sentiment Tie+Veto | 194 | +89.42% | 14.29% | 6.26x | 63.4% | 3 | -11.25% |
| 2-of-3 NoComm Veto + Dealer TieVeto | 320 | +186.66% | 14.91% | 12.52x | 64.4% | 3 | -10.61% |
| Commercial Forced Raw + Veto | 152 | +67.26% | 15.06% | 4.47x | 61.8% | 3 | -8.18% |
| 2-of-3 NoComm + TieVeto | 198 | +101.25% | 15.32% | 6.61x | 63.1% | 3 | -10.50% |
| Dealer TieVeto + Sentiment Veto | 320 | +175.04% | 17.49% | 10.01x | 64.4% | 3 | -11.30% |
| Commercial Tie+Veto | 179 | +53.92% | 18.71% | 2.88x | 59.8% | 3 | -9.90% |
| Tiered 3 NoComm + TieVeto | 219 | +100.79% | 19.21% | 5.25x | 61.6% | 3 | -8.44% |
| 2-of-3 NoComm + GradVeto | 205 | +77.78% | 9.74% | 7.99x | 62.9% | 4 | -3.94% |
| Commercial Forced Raw + TieVeto | 103 | +48.57% | 10.95% | 4.44x | 65.0% | 4 | -7.53% |
| 2-of-3 NoComm + DealerWeightedVeto | 172 | +109.74% | 11.95% | 9.18x | 66.3% | 4 | -4.56% |
| Tiered 3 NoComm + GradVeto | 238 | +78.38% | 13.14% | 5.96x | 60.1% | 4 | -4.92% |
| Strength Raw | 335 | +80.88% | 14.98% | 5.40x | 54.6% | 4 | -6.03% |
| Strength Veto (std) | 253 | +95.03% | 17.14% | 5.54x | 58.5% | 4 | -8.82% |
| Tiered 3 NoComm + DealerWeightedVeto | 205 | +108.19% | 17.66% | 6.13x | 62.4% | 4 | -7.44% |
| 2-of-3 NoComm + Veto | 205 | +109.28% | 17.91% | 6.10x | 62.9% | 4 | -8.72% |
| Tiered 3 NoComm Raw | 285 | +114.07% | 17.98% | 6.34x | 58.6% | 4 | -6.19% |
| Commercial Forced Raw | 280 | +23.41% | 18.52% | 1.26x | 52.9% | 4 | -13.40% |
| Sentiment Veto (std) | 205 | +97.66% | 19.85% | 4.92x | 62.9% | 4 | -9.41% |
| Dealer+Sentiment Veto | 313 | +167.06% | 20.81% | 8.03x | 63.6% | 4 | -8.50% |
| Tiered 3 NoComm + Veto | 238 | +107.73% | 23.64% | 4.56x | 60.1% | 4 | -9.83% |
| Strength Tie+Veto | 237 | +62.06% | 24.67% | 2.52x | 57.0% | 4 | -16.47% |
| Commercial Raw | 360 | +21.14% | 29.04% | 0.73x | 52.5% | 4 | -19.66% |
| Tandem 3 Raw | 830 | +246.46% | 29.23% | 8.43x | 57.1% | 4 | -11.79% |
| Tandem 3 Hybrid | 573 | +270.07% | 31.87% | 8.47x | 61.8% | 4 | -14.28% |
| Tandem 3 Veto | 566 | +262.09% | 37.95% | 6.91x | 61.3% | 4 | -13.72% |
| Sentiment Raw | 265 | +92.41% | 19.56% | 4.72x | 60.8% | 5 | -11.72% |

## Portfolio Ranking

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + Dealer TieVeto | 475 | +188.96% | 9.08% | 20.81x | 61.5% | 1 | -9.08% |
| 2-of-3 NoComm + Dealer TieVeto | 367 | +192.99% | 12.91% | 14.95x | 62.7% | 2 | -10.69% |
| Dealer+Sentiment TieVeto | 309 | +166.80% | 14.35% | 11.62x | 64.7% | 2 | -13.14% |
| Dealer TieVeto + Comm Forced Raw Veto | 267 | +144.64% | 13.51% | 10.71x | 64.0% | 3 | -6.95% |
| 2-of-3 NoComm Veto + Dealer TieVeto | 320 | +186.66% | 14.91% | 12.52x | 64.4% | 3 | -10.61% |
| Dealer TieVeto + Sentiment Veto | 320 | +175.04% | 17.49% | 10.01x | 64.4% | 3 | -11.30% |
| Dealer+Sentiment Veto | 313 | +167.06% | 20.81% | 8.03x | 63.6% | 4 | -8.50% |
| Tandem 3 Raw | 830 | +246.46% | 29.23% | 8.43x | 57.1% | 4 | -11.79% |
| Tandem 3 Hybrid | 573 | +270.07% | 31.87% | 8.47x | 61.8% | 4 | -14.28% |
| Tandem 3 Veto | 566 | +262.09% | 37.95% | 6.91x | 61.3% | 4 | -13.72% |

## Baseline / Standalone

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Dealer Tie+Veto | 115 | +77.38% | 1.89% | 40.94x | 67.0% | 2 | -1.89% |
| Dealer Veto (std) | 108 | +69.40% | 2.65% | 26.19x | 64.8% | 2 | -2.48% |
| Commercial Veto (std) | 206 | +74.50% | 9.56% | 7.79x | 60.2% | 2 | -9.56% |
| Dealer Raw | 230 | +73.17% | 2.20% | 33.26x | 56.5% | 3 | -1.99% |
| Sentiment Tie+Veto | 194 | +89.42% | 14.29% | 6.26x | 63.4% | 3 | -11.25% |
| Commercial Tie+Veto | 179 | +53.92% | 18.71% | 2.88x | 59.8% | 3 | -9.90% |
| Strength Raw | 335 | +80.88% | 14.98% | 5.40x | 54.6% | 4 | -6.03% |
| Strength Veto (std) | 253 | +95.03% | 17.14% | 5.54x | 58.5% | 4 | -8.82% |
| Sentiment Veto (std) | 205 | +97.66% | 19.85% | 4.92x | 62.9% | 4 | -9.41% |
| Strength Tie+Veto | 237 | +62.06% | 24.67% | 2.52x | 57.0% | 4 | -16.47% |
| Commercial Raw | 360 | +21.14% | 29.04% | 0.73x | 52.5% | 4 | -19.66% |
| Sentiment Raw | 265 | +92.41% | 19.56% | 4.72x | 60.8% | 5 | -11.72% |

## Phase 4 / Commercial Forced Raw

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Dealer TieVeto + Comm Forced Raw Veto | 267 | +144.64% | 13.51% | 10.71x | 64.0% | 3 | -6.95% |
| Commercial Forced Raw + Veto | 152 | +67.26% | 15.06% | 4.47x | 61.8% | 3 | -8.18% |
| Commercial Forced Raw + TieVeto | 103 | +48.57% | 10.95% | 4.44x | 65.0% | 4 | -7.53% |
| Commercial Forced Raw | 280 | +23.41% | 18.52% | 1.26x | 52.9% | 4 | -13.40% |

## Phase 5 / Conviction Weighting

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + GradVeto | 229 | +67.55% | 1.06% | 63.73x | 62.9% | 2 | -0.62% |
| Tiered V3 + GradVeto | 210 | +78.23% | 7.67% | 10.20x | 64.3% | 2 | -5.87% |
| Commercial Forced Raw + GradVeto | 152 | +54.62% | 10.66% | 5.12x | 61.8% | 3 | -5.63% |
| 2-of-3 NoComm + GradVeto | 205 | +77.78% | 9.74% | 7.99x | 62.9% | 4 | -3.94% |
| Tiered 3 NoComm + GradVeto | 238 | +78.38% | 13.14% | 5.96x | 60.1% | 4 | -4.92% |

## Phase 1 / Composite Baselines

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tiered V3 Raw | 257 | +111.51% | 6.22% | 17.93x | 62.3% | 2 | -6.22% |
| 2-of-3 NoComm Raw | 252 | +115.61% | 12.85% | 9.00x | 60.7% | 2 | -8.80% |
| Selector Raw | 360 | +111.58% | 15.27% | 7.31x | 59.7% | 2 | -15.27% |
| Tiered 3 NoComm Raw | 285 | +114.07% | 17.98% | 6.34x | 58.6% | 4 | -6.19% |

## Phase 1 / Composite Veto

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + Veto | 229 | +106.83% | 0.58% | 184.19x | 62.9% | 1 | -0.58% |
| Tiered V3 + Veto | 210 | +108.20% | 7.81% | 13.85x | 64.3% | 3 | -6.40% |
| 2-of-3 NoComm + Veto | 205 | +109.28% | 17.91% | 6.10x | 62.9% | 4 | -8.72% |
| Tiered 3 NoComm + Veto | 238 | +107.73% | 23.64% | 4.56x | 60.1% | 4 | -9.83% |

## Phase 2 / Composite TieVeto

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + TieVeto | 209 | +104.81% | 2.45% | 42.78x | 64.6% | 2 | -2.45% |
| Tiered V3 + TieVeto | 173 | +88.01% | 6.20% | 14.20x | 64.7% | 3 | -5.22% |
| 2-of-3 NoComm + TieVeto | 198 | +101.25% | 15.32% | 6.61x | 63.1% | 3 | -10.50% |
| Tiered 3 NoComm + TieVeto | 219 | +100.79% | 19.21% | 5.25x | 61.6% | 3 | -8.44% |

## Phase 6 / Wild Cards

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + Dealer Filter | 230 | +115.42% | 4.52% | 25.54x | 63.5% | 2 | -4.52% |
| Tiered V3 + DealerWeightedVeto | 169 | +109.08% | 6.05% | 18.03x | 69.2% | 2 | -4.34% |
| Tiered 3 NoComm + Dealer Filter | 186 | +77.64% | 3.33% | 23.32x | 58.6% | 3 | -3.33% |
| 2-of-3 NoComm + Dealer Filter | 184 | +73.57% | 4.46% | 16.50x | 58.1% | 3 | -3.33% |
| Tiered V3 + Dealer Filter | 169 | +57.82% | 7.31% | 7.91x | 58.0% | 3 | -4.28% |
| Selector + DealerWeightedVeto | 186 | +86.93% | 10.78% | 8.06x | 62.4% | 3 | -5.43% |
| 2-of-3 NoComm + DealerWeightedVeto | 172 | +109.74% | 11.95% | 9.18x | 66.3% | 4 | -4.56% |
| Tiered 3 NoComm + DealerWeightedVeto | 205 | +108.19% | 17.66% | 6.13x | 62.4% | 4 | -7.44% |

## Phase 3 / Sleeve Portfolios

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + Dealer TieVeto | 475 | +188.96% | 9.08% | 20.81x | 61.5% | 1 | -9.08% |
| 2-of-3 NoComm + Dealer TieVeto | 367 | +192.99% | 12.91% | 14.95x | 62.7% | 2 | -10.69% |
| Dealer+Sentiment TieVeto | 309 | +166.80% | 14.35% | 11.62x | 64.7% | 2 | -13.14% |
| 2-of-3 NoComm Veto + Dealer TieVeto | 320 | +186.66% | 14.91% | 12.52x | 64.4% | 3 | -10.61% |
| Dealer TieVeto + Sentiment Veto | 320 | +175.04% | 17.49% | 10.01x | 64.4% | 3 | -11.30% |
| Dealer+Sentiment Veto | 313 | +167.06% | 20.81% | 8.03x | 63.6% | 4 | -8.50% |
| Tandem 3 Raw | 830 | +246.46% | 29.23% | 8.43x | 57.1% | 4 | -11.79% |
| Tandem 3 Hybrid | 573 | +270.07% | 31.87% | 8.47x | 61.8% | 4 | -14.28% |
| Tandem 3 Veto | 566 | +262.09% | 37.95% | 6.91x | 61.3% | 4 | -13.72% |

## Top 5 By Metric

### Fewest Losing Weeks

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + Veto | 229 | +106.83% | 0.58% | 184.19x | 62.9% | 1 | -0.58% |
| Selector + Dealer TieVeto | 475 | +188.96% | 9.08% | 20.81x | 61.5% | 1 | -9.08% |
| Dealer Veto (std) | 108 | +69.40% | 2.65% | 26.19x | 64.8% | 2 | -2.48% |
| Dealer Tie+Veto | 115 | +77.38% | 1.89% | 40.94x | 67.0% | 2 | -1.89% |
| Commercial Veto (std) | 206 | +74.50% | 9.56% | 7.79x | 60.2% | 2 | -9.56% |

### Lowest Max Drawdown

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + Veto | 229 | +106.83% | 0.58% | 184.19x | 62.9% | 1 | -0.58% |
| Selector + GradVeto | 229 | +67.55% | 1.06% | 63.73x | 62.9% | 2 | -0.62% |
| Dealer Tie+Veto | 115 | +77.38% | 1.89% | 40.94x | 67.0% | 2 | -1.89% |
| Dealer Raw | 230 | +73.17% | 2.20% | 33.26x | 56.5% | 3 | -1.99% |
| Selector + TieVeto | 209 | +104.81% | 2.45% | 42.78x | 64.6% | 2 | -2.45% |

### Highest R/DD

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selector + Veto | 229 | +106.83% | 0.58% | 184.19x | 62.9% | 1 | -0.58% |
| Selector + GradVeto | 229 | +67.55% | 1.06% | 63.73x | 62.9% | 2 | -0.62% |
| Selector + TieVeto | 209 | +104.81% | 2.45% | 42.78x | 64.6% | 2 | -2.45% |
| Dealer Tie+Veto | 115 | +77.38% | 1.89% | 40.94x | 67.0% | 2 | -1.89% |
| Dealer Raw | 230 | +73.17% | 2.20% | 33.26x | 56.5% | 3 | -1.99% |

### Highest Win Rate

| System | Trades | Total % | Max DD % | R/DD | Win % | Losing Weeks | Worst Week % |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tiered V3 + DealerWeightedVeto | 169 | +109.08% | 6.05% | 18.03x | 69.2% | 2 | -4.34% |
| Dealer Tie+Veto | 115 | +77.38% | 1.89% | 40.94x | 67.0% | 2 | -1.89% |
| 2-of-3 NoComm + DealerWeightedVeto | 172 | +109.74% | 11.95% | 9.18x | 66.3% | 4 | -4.56% |
| Commercial Forced Raw + TieVeto | 103 | +48.57% | 10.95% | 4.44x | 65.0% | 4 | -7.53% |
| Dealer Veto (std) | 108 | +69.40% | 2.65% | 26.19x | 64.8% | 2 | -2.48% |

## Key Findings

- Best overall by the prompt ranking was **Selector + Veto** at +106.83% with 0.58% DD and 1 losing weeks.
- Best sleeve portfolio was **Selector + Dealer TieVeto** at +188.96% with 9.08% DD and 1 losing weeks.
- Dealer tie+veto remained strong after the earlier signedSpread fix, but it is not the 183x R/DD result from the buggy run.
- Commercial forced raw was included as a first-class test because raw pair-score forcing materially changed commercial's quality in prior work.
- Composite veto used the composite's final pair direction against all four source voters, matching the simplified interpretation in the prompt.

## Recommended Next Tests

- Run the top 3 weekly-hold systems through the actual scaled/additive live execution layer.
- If commercial forced raw stays competitive, test it only as a sleeve, not as a merged COT voter.
- If dealer-weighted veto helps composites materially, validate it over a longer window before promoting it into app logic.

