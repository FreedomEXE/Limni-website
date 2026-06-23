# Gate 51D RRP Decomposition Diagnostic Lock

Date: 2026-06-23

## Decision

Gate 51D diagnostic read: ACCEPT

Broad RRP confirmation thesis: REJECT

RRP decomposition value: YES, as a regime-quality and anti-crowding diagnostic.

Production implication: NONE

Promotion implication: NONE

No further RRP optimization, selector expansion, axis expansion, threshold tuning,
source rebuild, source refetch, live claim, production claim, promotion claim, or
combined macro-regime claim is authorized by this package.

## Locked Conclusion

Gate 51D decomposed promoted RRP against the locked CLP and SFA selectors and
the FSA benchmark. The result rejects the simple RRP-confirmation thesis. RRP
appears useful as a regime-quality and adverse-context diagnostic, especially by
identifying cases where obvious real-rate support or rank advantage does not
improve outcomes and may degrade them.

The strongest repeated pattern is:

- `neutral` / `weak` RRP contexts outperform `supportive` / `confirm` contexts.
- `middle_half` or non-extreme rank zones outperform blindly high RRP percentile.
- `selected_rank_disadvantage` often outperforms `selected_rank_advantage`.

Interpretation: RRP is not behaving as "higher real-rate pressure equals better
directional trade." In this locked-selector harness it is behaving more like a
context-quality signal where obvious real-rate support may mark crowded, late,
or fragile conditions.

Required caveat: this is diagnostic-only against legacy selectors. CLP results
are CLP-valid-window only, not full-window CLP evidence.

## Evidence Identity

Source receipt: `app/reports/data-verification/macro-regime/gate51-rrp-decomposition-full-20260623T190718.json`

Source markdown receipt: `app/reports/data-verification/macro-regime/gate51-rrp-decomposition-full-20260623T190718.md`

Review artifact: `docs/research/GATE51D_RRP_DECOMPOSITION_FULL_REVIEW_ARTIFACT_20260623T190718.md`

Receipt hash: `ced6c57e87540ae2657006438c3b0f8ad22ab66ca05fc0ccad2451e2dc13c027`

Variant/decomposition grid hash: `b34956db176285ed6ceecf7006f58cc77a3581cc0b5bdb23a077a3a5e2615415`

Decomposition axis manifest: `gate51d_rrp_decomposition_axes_v1_warning_governed`

Gate 44 matrix dataset: `479624d1-f6a2-4928-82f1-981137762bdc` /
`cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36`

Gate 50 RRP dataset: `220fd5fd-d017-4db2-bdde-524a3c664c72` /
`5a1d4c7e15d928bc76b0c169b04f3b391b484ef45ab5bdd62dedb49716326742`

Gate 50 source-content invariant:
`fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391`

Gate 50 final ACTIVE join hash:
`08723c62e089eddab7cde243a64283c9dd6bc0ebee01a070cfb32e4cb27fdbc7`

Gate 51C selector lockdown receipt hash:
`bd438c8d003ca01193943d4c05dc68b1dc8c44c553e96be04e0a9d43d4ec9418`

This package is authored from the existing full diagnostic receipt. It does not
initiate a new decomposition run.

## Selector Roles

| Label | Selector ID | Role |
|---|---|---|
| CLP | `cot_lifecycle_polarity_v0_noncomm_primary` | Locked COT research candidate |
| SFA | `strength_friday_snapshot_open_canonical_fade_agree` | Locked Strength research candidate |
| FSA | `strength_friday_snapshot_selected` | Simple benchmark only |

FSA remains benchmark-only. It is not a selector to optimize or promote.

## Warning Policy Lock

| Policy | Locked handling |
|---|---|
| CLP warmup rows | Excluded as unavailable |
| CLP true missing rows | Excluded as unavailable |
| CLP valid lifecycle required | Yes |
| Missing rows neutralized | No |
| Coverage denominator | Valid required-state rows only |
| Minimum cell rows | 50 |
| Minimum active weeks | 20 |
| Low-support cells | May be shown only as exploratory / low support |
| Zero-filled contribution rows | Included as zero for Gate 44 cached contribution parity, with exclusion sensitivity reported |
| Top display | Display-only, not selection authority |

## Coverage

| Selector | Decisions | Computed | Warmup | True missing | Missing RRP | Zero-filled | Denominator impact |
|---|---:|---:|---:|---:|---:|---:|---:|
| CLP | 10332 | 6020 | 4312 | 0 | 0 | 17 | 41.7344% |
| SFA | 4618 | 4618 | 0 | 0 | 0 | 1 | 0% |
| FSA | 10292 | 10292 | 0 | 0 | 0 | 12 | 0% |

CLP is CLP-valid-window only. Do not compare CLP directly to SFA or FSA as if
all three selectors had identical sample coverage.

## Zero-Fill Audit

Zero-filled rows: 30

Top display rows contain zero-fill: true

Top display changes when zero-filled rows are excluded: false

ADR totals changed by excluding zero-filled rows: no

| Group | Count |
|---|---:|
| CLP | 17 |
| SFA | 1 |
| FSA | 12 |
| 2024 | 6 |
| 2025 | 13 |
| 2026 | 11 |

Zero-fill by pair:

| Pair | Count | Pair | Count |
|---|---:|---|---:|
| AUDCAD | 2 | CHFJPY | 2 |
| AUDCHF | 3 | EURAUD | 1 |
| AUDJPY | 1 | EURCAD | 1 |
| AUDNZD | 2 | EURNZD | 3 |
| AUDUSD | 2 | EURUSD | 2 |
| GBPNZD | 4 | NZDCHF | 2 |
| NZDJPY | 2 | USDCHF | 3 |

Any displayed cell with zero-filled rows must retain the zero-fill flag even
though ADR totals and top ordering were unchanged by exclusion.

## Baseline Selector Overview

| Selector | Rows | Weeks | ADR | DD | R/DD | Sharpe | PF | Worst year | Zero-filled |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|
| CLP | 6020 | 215 | 1025.7757 | -645.8961 | 1.5881 | 0.8387 | 1.4061 | 2024 -332.0527 | 17 |
| SFA | 4618 | 365 | 698.4142 | -208.9842 | 3.3419 | 0.6763 | 1.2978 | 2020 -20.5112 | 1 |
| FSA | 10292 | 371 | 1223.2938 | -519.9618 | 2.3527 | 0.6105 | 1.2683 | 2024 -211.6726 | 12 |

## Best Diagnostic Cells

| Selector | Axis | Bucket | Rows | Weeks | ADR | R/DD | Sharpe | PF | Worst year | Zero-filled |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| CLP | `pair_rrp_differential` | `neutral` | 2179 | 215 | 704.9733 | 3.8197 | 1.5122 | 1.8096 | 2024 3.5823 | 10 |
| CLP | `confirm_fade_weak` | `weak` | 2179 | 215 | 704.9733 | 3.8197 | 1.5122 | 1.8096 | 2024 3.5823 | 10 |
| CLP | `rrp_rank_percentile` | `top_quartile` | 1336 | 215 | 385.1817 | 4.0365 | 1.1053 | 1.5235 | 2024 -11.4374 | 3 |
| SFA | `rrp_rank_percentile` | `middle_half` | 2253 | 362 | 592.2396 | 6.0855 | 1.0286 | 1.4990 | 2020 -55.2083 | 0 |
| SFA | `spread_rank_spread` | `selected_rank_disadvantage` | 2255 | 360 | 539.8339 | 4.7000 | 0.8766 | 1.4453 | 2019 9.8727 | 0 |
| SFA | `pair_rrp_differential` | `neutral` | 2087 | 358 | 415.3735 | 3.9110 | 0.6991 | 1.3507 | 2024 -15.7650 | 0 |
| FSA | `pair_rrp_differential` | `neutral` | 4632 | 371 | 1173.7501 | 6.4202 | 1.2148 | 1.6164 | 2024 14.4259 | 5 |
| FSA | `confirm_fade_weak` | `weak` | 4632 | 371 | 1173.7501 | 6.4202 | 1.2148 | 1.6164 | 2024 14.4259 | 5 |
| FSA | `rrp_rank_percentile` | `middle_half` | 5147 | 371 | 1176.1267 | 3.4365 | 0.9744 | 1.5220 | 2024 -140.3771 | 6 |
| FSA | `spread_rank_spread` | `selected_rank_disadvantage` | 5042 | 371 | 1059.3383 | 4.4686 | 0.9132 | 1.4472 | 2019 -128.3587 | 8 |

## Failed / Weak Diagnostic Cells

| Selector | Axis | Bucket | Rows | Weeks | ADR | R/DD | Sharpe | PF | Worst year | Zero-filled |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| CLP | `pair_rrp_differential` | `supportive` | 1602 | 215 | 21.8224 | 0.0499 | 0.0350 | 1.0178 | 2024 -102.3322 | 2 |
| CLP | `confirm_fade_weak` | `confirm` | 1602 | 215 | 21.8224 | 0.0499 | 0.0350 | 1.0178 | 2024 -102.3322 | 2 |
| CLP | `rrp_level` | `two_plus` | 585 | 75 | -2.2353 | -0.0119 | -0.0128 | 0.9947 | 2024 -70.2054 | 1 |
| SFA | `rrp_rank_percentile` | `top_quartile` | 1197 | 308 | -19.2701 | -0.0859 | -0.0427 | 0.9800 | 2021 -141.2554 | 1 |
| SFA | `pair_rrp_differential` | `supportive` | 1323 | 298 | 48.0202 | 0.2471 | 0.1111 | 1.0503 | 2020 -71.3454 | 1 |
| SFA | `spread_rank_spread` | `selected_rank_advantage` | 2363 | 360 | 158.5803 | 0.6404 | 0.2344 | 1.1043 | 2021 -77.7227 | 1 |
| FSA | `pair_rrp_differential` | `supportive` | 2933 | 357 | -355.1174 | -0.5822 | -0.3120 | 0.8464 | 2021 -315.8956 | 4 |
| FSA | `confirm_fade_weak` | `confirm` | 2933 | 357 | -355.1174 | -0.5822 | -0.3120 | 0.8464 | 2021 -315.8956 | 4 |
| FSA | `rrp_rank_percentile` | `top_quartile` | 2580 | 370 | -101.1651 | -0.1967 | -0.1184 | 0.9477 | 2021 -245.2445 | 3 |
| FSA | `spread_rank_spread` | `selected_rank_advantage` | 5250 | 371 | 163.9556 | 0.2887 | 0.1138 | 1.0524 | 2021 -238.4832 | 4 |

## Top Display With Zero-Fill Flags

The receipt top display is human-scan only and sorted by absolute total ADR. It
is not candidate selection authority.

| Selector | Axis | Bucket | Rows | Weeks | ADR | R/DD | Sharpe | PF | Worst year | Zero-filled |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| FSA | `rrp_rank_percentile` | `middle_half` | 5147 | 371 | 1176.1267 | 3.4365 | 0.9744 | 1.5220 | 2024 -140.3771 | 6 |
| FSA | `pair_rrp_differential` | `neutral` | 4632 | 371 | 1173.7501 | 6.4202 | 1.2148 | 1.6164 | 2024 14.4259 | 5 |
| FSA | `supportive_adverse_neutral_masks` | `neutral` | 4632 | 371 | 1173.7501 | 6.4202 | 1.2148 | 1.6164 | 2024 14.4259 | 5 |
| FSA | `confirm_fade_weak` | `weak` | 4632 | 371 | 1173.7501 | 6.4202 | 1.2148 | 1.6164 | 2024 14.4259 | 5 |
| FSA | `spread_rank_spread` | `selected_rank_disadvantage` | 5042 | 371 | 1059.3383 | 4.4686 | 0.9132 | 1.4472 | 2019 -128.3587 | 8 |
| FSA | `rrp_level` | `negative` | 6730 | 355 | 924.5899 | 2.3952 | 0.6179 | 1.3002 | 2019 -165.5247 | 3 |
| CLP | `rrp_level` | `negative` | 3322 | 213 | 745.9804 | 2.3016 | 0.9055 | 1.5213 | 2024 -175.5539 | 6 |
| CLP | `pair_rrp_differential` | `neutral` | 2179 | 215 | 704.9733 | 3.8197 | 1.5122 | 1.8096 | 2024 3.5823 | 10 |
| CLP | `supportive_adverse_neutral_masks` | `neutral` | 2179 | 215 | 704.9733 | 3.8197 | 1.5122 | 1.8096 | 2024 3.5823 | 10 |
| CLP | `confirm_fade_weak` | `weak` | 2179 | 215 | 704.9733 | 3.8197 | 1.5122 | 1.8096 | 2024 3.5823 | 10 |

## Top Display Excluding Zero-Filled Rows

Excluding zero-filled contribution rows changed no ADR totals and did not change
top-display ordering. The table below uses the exclusion row counts from the
zero-fill sensitivity audit.

| Selector | Axis | Bucket | Rows excluding zero-fill | ADR excluding zero-fill | Zero-filled removed |
|---|---|---|---:|---:|---:|
| FSA | `rrp_rank_percentile` | `middle_half` | 5141 | 1176.1267 | 6 |
| FSA | `pair_rrp_differential` | `neutral` | 4627 | 1173.7501 | 5 |
| FSA | `supportive_adverse_neutral_masks` | `neutral` | 4627 | 1173.7501 | 5 |
| FSA | `confirm_fade_weak` | `weak` | 4627 | 1173.7501 | 5 |
| FSA | `spread_rank_spread` | `selected_rank_disadvantage` | 5034 | 1059.3383 | 8 |
| FSA | `rrp_level` | `negative` | 6727 | 924.5899 | 3 |
| CLP | `rrp_level` | `negative` | 3316 | 745.9804 | 6 |
| CLP | `pair_rrp_differential` | `neutral` | 2169 | 704.9733 | 10 |
| CLP | `supportive_adverse_neutral_masks` | `neutral` | 2169 | 704.9733 | 10 |
| CLP | `confirm_fade_weak` | `weak` | 2169 | 704.9733 | 10 |

## Year Stability And Concentration Notes

- The most stable repeated pattern is `neutral` / `weak` outperforming
  `supportive` / `confirm` across CLP, SFA, and FSA.
- CLP `neutral` / `weak` is CLP-valid-window only and has positive worst-year
  ADR: 2024 `3.5823`.
- SFA `neutral` has mild negative worst-year ADR: 2024 `-15.7650`.
- FSA `neutral` / `weak` has positive worst-year ADR: 2024 `14.4259`.
- CLP `rrp_rank_percentile` / `top_quartile` is interesting but secondary
  because top-currency concentration is USD `0.6156`.
- SFA and FSA `top_quartile` cells are weak or negative and can have inflated
  concentration ratios because total ADR is small or negative.
- Cells with concentration ratios above 1.0 are not broad institutional
  signals; they should be treated as unstable or dominated until separately
  attributed.

## Minimum Cell Support

All nonzero best and failed cells in this package pass the minimum sample
criteria of 50 rows and 20 active weeks. The `same_rank` spread bucket has zero
rows and is not evidence.

## Locked Non-Claims

- No source contract was reopened.
- No CPI, rate, or RRP materialization was rebuilt.
- No Gate 50 lifecycle, activation, or promotion manifest was reopened.
- No COT Faces expansion was run.
- No Dealer/Commercial expansion was run.
- No Strength open-only or new Strength composite was run.
- No BPR, PPP, NEER, REER, valuation, or combined macro-regime work was run.
- No live, production, or promotion claim is made.

## Next Gate Options

Gate 51E can translate the diagnostic into candidate rule language with no new
tests.

Gate 52 can move to BPR source-governance and standalone attribution.

Before either gate, Gate 51D should remain locked as:

- RRP is useful as a decomposition and diagnostic signal.
- RRP is not useful as a simple confirmation signal in this harness.
- RRP likely marks context quality, not trade direction.
