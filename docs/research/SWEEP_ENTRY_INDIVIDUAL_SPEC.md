# Katarakti — Sweep-Entry Individual Pair System

> Status: Phase 1 spec locked + first run completed
> Last updated: 2026-02-27
> Owners: Freedom + Claude + Codex

## Goal

Keep the basket-direction concept, but execute entries/exits per pair using deterministic H1 sweep-confirmation logic.

## Locked Phase 1 Rules

### Bias systems

- `universal_v1`: 5-model majority vote per pair
  - 3+ LONG votes -> LONG
  - 3+ SHORT votes -> SHORT
  - tie/non-majority -> NEUTRAL
  - no directional votes -> EXCLUDED
- `tiered_v1` (fixed, distinct logic):
  - 4/5 or 5/5 directional agreement -> `T1`
  - 3/5 directional agreement -> `T2`
  - no majority -> NEUTRAL
  - no directional votes -> EXCLUDED
- Phase 1 tier filter: only `T1` is tradable for `tiered_v1`.

### Neutral handling

- `skip`: do not trade neutral pairs.
- `both_ways`: neutral pairs can trade both long and short signals.
- No simultaneous opposite positions on the same symbol.

### Entry logic (H1, deterministic, no lookahead)

Reference windows (UTC):

- Asia ref range: `00:00-08:00`, scan `08:00-21:00`
- NY ref range: `13:00-21:00`, scan `00:00-13:00` next day

Signal requires `sweep + rejection + displacement`:

- 1-bar version: all conditions on candle `N`
- 2-bar version: sweep on candle `N`, rejection+displacement on candle `N+1`

Definitions:

- Sweep breach threshold: tested at `0.10%` and `0.25%`
- Rejection: close back inside reference range
- Displacement:
  - min body `0.05%`
  - close in top/bottom `30%` of candle range based on direction

Execution:

- Entry fill: displacement candle close
- Max entries: `1` per pair per week

### Risk and exits (fixed % stepped system)

- Risk per trade: `1%`
- Max concurrent positions: `8`
- Max portfolio risk: `8%`
- Hard stop: `-1.00%` from entry
- Step ladder:
  - at `+0.25%`: stop -> breakeven
  - at `+0.50%`: lock `+0.15%`
  - at `+0.75%`: lock `+0.35%`
  - at `+1.00%`: lock `+0.55%`
  - above `+1.00%`: trailing lock = `peak - 0.45%`
- Intrabar execution:
  - if candle range touches stop/trail, fill at stop price
  - if stop and trail are both touchable on same candle, SL priority
- Week-end: force close at candle close

### Cost model (Phase 1)

- Disabled for this pass (`0.00%`) to isolate signal + exit behavior.
- Cost normalization reintroduced in later passes.

## Phase 1 Test Matrix (6 variants)

| # | Variant ID | Bias System | Neutral Mode | Sweep Threshold |
| --- | --- | --- | --- | --- |
| 1 | `universal_v1__skip__sweep010` | Universal V1 | skip | 0.10% |
| 2 | `universal_v1__both__sweep010` | Universal V1 | both_ways | 0.10% |
| 3 | `universal_v1__skip__sweep025` | Universal V1 | skip | 0.25% |
| 4 | `universal_v1__both__sweep025` | Universal V1 | both_ways | 0.25% |
| 5 | `tiered_v1__skip__sweep010` | Tiered V1 (T1 only) | skip | 0.10% |
| 6 | `tiered_v1__skip__sweep025` | Tiered V1 (T1 only) | skip | 0.25% |

Current engine default (`2026-02-27`):

- `universal_v1__skip__sweep010` is the locked baseline.
- `both_ways` variants are excluded by default (can be re-enabled via `KATARAKTI_INCLUDE_BOTH_WAYS=true`).

Dataset:

- Weeks: `2026-01-19`, `2026-01-26`, `2026-02-02`, `2026-02-09`, `2026-02-16`
- Universe: 36 symbols
- Timeframe: H1

## First Run Snapshot (2026-02-27)

Source: `reports/katarakti-phase1-backtest-latest.json`

| Variant | Return | Max DD | Win Rate | Trades |
| --- | ---: | ---: | ---: | ---: |
| `universal_v1__skip__sweep010` | +8.60% | 1.22% | 40.00% | 30 |
| `universal_v1__both__sweep010` | +4.50% | 9.67% | 40.17% | 117 |
| `universal_v1__skip__sweep025` | +3.53% | 1.17% | 38.89% | 18 |
| `universal_v1__both__sweep025` | -2.23% | 7.63% | 37.84% | 74 |
| `tiered_v1__skip__sweep010` | +8.60% | 1.22% | 40.00% | 30 |
| `tiered_v1__skip__sweep025` | +3.53% | 1.17% | 38.89% | 18 |

## What Worked / What Did Not

Worked:

- `skip` neutral mode clearly outperformed `both_ways` on drawdown and quality.
- Stepped stop logic produced very few full hard-stop losses (1/30 on best variant).
- 0.10% sweep setting outperformed 0.25% for this 5-week window.

Did not work / unresolved:

- `both_ways` neutral mode still looks toxic (trade count balloons, DD rises sharply).
- `tiered_v1` skip variants matched `universal_v1` skip results exactly in this sample, so practical differentiation is still unproven.
- Root cause observed in this run: executed skip trades were all Tier 1 (`30/30` on `sweep010`), so Tiered T1 filtering did not remove any entries.
- Many trades still exit at breakeven; conversion from +0.25% to +1.00% remains limited.

## Diagnostics Required For Review

Already included in backtest JSON and markdown report:

- Per-trade exit step: `hard_sl`, `breakeven`, `lock_015`, `lock_035`, `lock_055`, `trailing`, `week_close`
- Per-trade peak profit % and reached milestones (`+0.25/+0.50/+0.75/+1.00`)
- Per-variant exit step distribution and milestone reach rates

## Current Engine Status

Implemented in:

- `scripts/katarakti-phase1-backtest.ts`

Outputs:

- `reports/katarakti-phase1-backtest-latest.json`
- `reports/katarakti-phase1-backtest-latest.md`

## Phase 2 — Correlation Handshake + Tiered Sizing

> Status: READY FOR IMPLEMENTATION
> Locked baseline from Phase 1: `universal_v1__skip__sweep010` (ATR/no-hard-stop mode)
> Phase 1 best result: +14.07% return, 0.38% max DD, 37% WR, 30 trades

### 2A. Correlation Handshake

**Goal**: Improve win rate by requiring correlated pair confirmation before entry, same concept that raised Bitget V2 from ~50% to 87.5% WR.

**Correlation computation** (self-computed, no external dependency):
- Source: 1h candle data already fetched by the backtest engine (OANDA)
- Method: Rolling Pearson correlation on 1h log-returns
- Lookback: 4 weeks (672 hours) of 1h bars preceding each test week
- Compute fresh matrix each Sunday before the week starts
- Store as pairwise coefficients: `corr(pair_A, pair_B)`

**Cluster building** (per week):
- Positive correlation: `corr >= +0.70` → same direction handshake
- Anti-correlation: `corr <= -0.70` → opposite direction handshake
- Uncorrelated (`-0.70 < corr < +0.70`) → no handshake value

**Handshake entry flow**:
1. Pair A generates a sweep signal (same Phase 1 detection logic)
2. Look up Pair A's correlation cluster for this week
3. If no cluster (uncorrelated with everything): enter without handshake (standalone)
4. If cluster exists: hold signal, scan same session window for other cluster signals
   - Positively correlated pair signals in SAME direction = confirmation
   - Anti-correlated pair signals in OPPOSITE direction = confirmation
5. If `confirming_signals >= HANDSHAKE_THRESHOLD` → enter ALL confirming pairs
6. If session window ends without enough confirmations → discard signal

**Handshake test variants** (sweep threshold fixed at 0.10%, neutral=skip, ATR/no-hard-stop exit):

| # | Variant ID | Bias | Corr Threshold | Handshake Min | Anti-Corr |
|---|-----------|------|---------------|--------------|-----------|
| 1 | `univ__hs2__corr070` | Universal V1 | ±0.70 | 2 (incl. trigger) | Yes |
| 2 | `univ__hs3__corr070` | Universal V1 | ±0.70 | 3 (incl. trigger) | Yes |
| 3 | `univ__hs2__corr060` | Universal V1 | ±0.60 | 2 (incl. trigger) | Yes |
| 4 | `univ__hs2__corr070__no_anti` | Universal V1 | +0.70 only | 2 (incl. trigger) | No |
| 5 | `univ__no_hs` (Phase 1 baseline) | Universal V1 | N/A | N/A | N/A |

**Key diagnostics to include per variant**:
- How many signals were generated vs how many passed handshake gate
- Handshake trigger rate (% of signals that found confirmation)
- Average cluster size per triggered handshake
- Win rate comparison: handshake-gated vs standalone entries
- Trade count impact (critical: if handshake kills >70% of trades, diminishing returns)

### 2B. Tiered V1 — T1+T2 with Tier-Weighted Sizing

**Goal**: Force Tiered V1 to differentiate from Universal V1 by allowing T2 pairs AND using tier-based risk sizing.

**Current issue**: T1-only filter on Tiered V1 produces identical results to Universal V1 because all executed trades were already T1 in this sample.

**Tier-weighted sizing**:

| Tier | Agreement | Risk Per Trade | Rationale |
|------|-----------|---------------|-----------|
| T1 | 4/5 or 5/5 | 1.5% | High conviction → bigger size |
| T2 | 3/5 | 0.75% | Moderate conviction → reduced size |
| NEUTRAL | No majority | Skip | Same as Phase 1 |

**Portfolio caps with tiered sizing**:
- Max portfolio risk still 8%
- Max concurrent positions still 8
- But individual position sizes vary by tier

**Tiered test variants** (sweep 0.10%, neutral=skip, ATR/no-hard-stop exit, no handshake):

| # | Variant ID | T1 Risk | T2 Risk | T2 Tradable |
|---|-----------|---------|---------|-------------|
| 1 | `tiered__t1_only__1pct` | 1% | N/A | No (Phase 1 baseline) |
| 2 | `tiered__t1t2__flat_1pct` | 1% | 1% | Yes, same sizing |
| 3 | `tiered__t1t2__weighted` | 1.5% | 0.75% | Yes, tier-weighted |

**Key diagnostics**:
- How many T2 pairs enter that T1 didn't (the differentiation question)
- T1 vs T2 win rate and avg return
- Does tier-weighting improve risk-adjusted return?

### 2C. Combined Run (if individual results look good)

If handshake AND tiered sizing both show improvement independently, run one combined variant:
- `tiered__t1t2__weighted__hs2__corr070`
- Tiered T1+T2 with weighted sizing + handshake gate at ±0.70 / min 2

### Implementation Notes

- Use the existing `stepped_no_hard_sl` + ATR exit mode from the latest engine (not the fixed/hard-stop mode)
- Same 5-week dataset, same OANDA candle source
- Costs remain disabled for this pass
- All variants should include the same exit diagnostics (step distribution, milestone reach rates)
- Correlation matrix should be logged per-week so we can inspect it in the report
- Reference existing specs: `docs/research/KATARAKTI_HANDSHAKE_SPEC.md`, `docs/features/CORRELATION_HEATMAP_IMPLEMENTATION.md`

## Phase 2 First Run (Implemented)

Run config:

- `KATARAKTI_TEST_PLAN=phase2`
- `KATARAKTI_LOCK_STYLE=atr`
- `KATARAKTI_EXIT_MODE=stepped_no_hard_sl`
- Costs disabled
- Same 5-week window (`2026-01-19` to `2026-02-16`)

Source:

- `reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.md`
- `reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.json`

Headline results:

| Variant | Return | Max DD | WR | Trades |
| --- | ---: | ---: | ---: | ---: |
| `univ__hs2__corr070` | +4.16% | 1.33% | 31.58% | 19 |
| `univ__hs3__corr070` | +0.22% | 0.35% | 42.86% | 7 |
| `univ__hs2__corr060` | +3.89% | 1.40% | 29.41% | 17 |
| `univ__hs2__corr070__no_anti` | +5.01% | 0.31% | 33.33% | 15 |
| `univ__no_hs` | +14.07% | 0.38% | 36.67% | 30 |
| `tiered__t1_only__1pct` | +14.07% | 0.38% | 36.67% | 30 |
| `tiered__t1t2__flat_1pct` | +14.07% | 0.38% | 36.67% | 30 |
| `tiered__t1t2__weighted` | +21.62% | 0.56% | 36.67% | 30 |
| `tiered__t1t2__weighted__hs2__corr070` | +6.24% | 2.00% | 31.58% | 19 |

Readout:

- Handshake variants reduced trade count and did not beat `univ__no_hs` in this sample.
- Tier weighting (`1.5%` T1 / `0.75%` T2) materially improved return vs flat 1%.
- Combined weighted + handshake underperformed weighted-only in this sample.
